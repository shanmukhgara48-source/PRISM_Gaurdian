import asyncio
import uuid
from pathlib import Path
from typing import List

from app.models import Finding, ScanResult, Severity
from app.store import ScanState, scans
from app.pipeline.cloner import clone_repo
from app.pipeline.analyzers import run_bandit, run_pylint, run_radon
from app.pipeline.llm_client import validate_findings_batch, get_code_context
from app.pipeline.scoring import (
    compute_health_score,
    compute_risk_level,
    compute_category_scores,
    compute_hotspots,
)


def _deduplicate(findings: List[Finding]) -> List[Finding]:
    seen: set = set()
    unique: List[Finding] = []
    for f in findings:
        key = (f.file, f.line, f.severity.value, f.tool)
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique


async def _validate_with_llm(findings: List[Finding], repo_path: str) -> List[Finding]:
    if not findings:
        return []

    BATCH = 10
    validated: List[Finding] = []

    for i in range(0, len(findings), BATCH):
        batch = findings[i : i + BATCH]
        batch_data = []
        for j, f in enumerate(batch):
            full_path = str(Path(repo_path) / f.file)
            ctx = await get_code_context(full_path, f.line)
            batch_data.append({
                "index": j,
                "tool": f.tool,
                "severity": f.severity.value,
                "description": f.description,
                "file": f.file,
                "line": f.line,
                "code_context": ctx,
            })

        results = await validate_findings_batch(batch_data)
        result_map = {r.get("index", idx): r for idx, r in enumerate(results)}

        for j, f in enumerate(batch):
            r = result_map.get(j, {"valid": True, "confidence": 0.70})
            confidence: float = float(r.get("confidence", 0.70))

            if not r.get("is_valid", True) or confidence < 0.6:
                continue  # Filter false positives

            f.confidence = round(confidence, 2)
            if r.get("fix"):
                f.fix = r["fix"]
            if r.get("explanation"):
                f.explanation = r["explanation"]
            # Allow LLM to reclassify severity
            llm_sev = r.get("severity", "")
            if llm_sev:
                try:
                    f.severity = Severity(llm_sev.lower())
                except ValueError:
                    pass

            validated.append(f)

    return validated


async def run_scan_pipeline(scan_id: str, repo_path: str, repo_url: str) -> None:
    """Full analysis pipeline. Publishes SSE events via ScanState."""
    state = scans[scan_id]

    def emit(event: str, **kwargs):
        state.add_event({"event": event, "scan_id": scan_id, **kwargs})

    try:
        emit("start", message="Starting analysis pipeline…", stage=1)

        # --- Static analysis (concurrent) ---
        emit("tool_running", tool="bandit", message="Running Bandit security scan…", stage=2)
        emit("tool_running", tool="pylint", message="Running Pylint quality scan…", stage=3)
        emit("tool_running", tool="radon", message="Running Radon complexity scan…", stage=4)

        results = await asyncio.gather(
            run_bandit(repo_path),
            run_pylint(repo_path),
            run_radon(repo_path),
            return_exceptions=True,
        )

        all_findings: List[Finding] = []
        tool_names = ["bandit", "pylint", "radon"]
        for tool_name, result in zip(tool_names, results):
            if isinstance(result, list):
                all_findings.extend(result)
            else:
                emit("tool_error", tool=tool_name, message=str(result))

        emit("tool_complete", message=f"Static analysis done — {len(all_findings)} raw findings")

        # --- Deduplication ---
        all_findings = _deduplicate(all_findings)
        emit("dedup", message=f"After deduplication: {len(all_findings)} unique findings")

        # --- LLM Validation ---
        emit("validation", message="Validating findings with AI…", stage=5)
        validated = await _validate_with_llm(all_findings, repo_path)
        emit("validation_complete", message=f"Validation done — {len(validated)} confirmed findings")

        # --- Scoring ---
        emit("scoring", message="Computing health score…", stage=6)
        health_score = compute_health_score(validated)
        risk_level, merge_decision = compute_risk_level(validated, health_score)
        category_scores = compute_category_scores(validated)
        hotspots = compute_hotspots(validated)

        result_obj = ScanResult(
            scan_id=scan_id,
            repo_url=repo_url,
            health_score=health_score,
            risk_level=risk_level,
            merge_decision=merge_decision,
            findings=[f.model_dump() for f in validated],
            category_scores=category_scores.model_dump(),
            hotspots=hotspots,
            status="done",
        )

        state.result = result_obj.model_dump()

        # Emit "done" BEFORE setting state.done=True so the stream's
        # `while not state.done` loop cannot exit before the event is queued.
        emit(
            "done",
            message="Analysis complete!",
            stage=7,
            health_score=health_score,
            risk_level=risk_level,
            merge_decision=merge_decision,
            findings_count=len(validated),
        )
        state.done = True

    except Exception as exc:
        # Emit "error" BEFORE setting state.done=True for the same reason.
        emit("error", message=f"Pipeline error: {exc}")
        state.error = str(exc)
        state.done = True


async def start_scan(repo_url: str) -> str:
    """Initiate a scan: clone → pipeline. Returns scan_id immediately."""
    scan_id = str(uuid.uuid4())[:8]
    state = ScanState(scan_id=scan_id)
    scans[scan_id] = state

    state.add_event({"event": "cloning", "message": "Cloning repository…", "scan_id": scan_id, "stage": 0})

    try:
        repo_path = await clone_repo(repo_url, scan_id)
    except Exception as exc:
        state.add_event({"event": "error", "message": f"Clone failed: {exc}", "scan_id": scan_id})
        state.done = True
        state.error = str(exc)
        return scan_id

    state.add_event({"event": "cloned", "message": "Repository cloned ✓", "scan_id": scan_id})
    asyncio.create_task(run_scan_pipeline(scan_id, repo_path, repo_url))
    return scan_id
