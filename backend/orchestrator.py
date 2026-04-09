import asyncio
import json
import logging
import traceback
from collections import defaultdict

from store import ScanState, get_scan

logger = logging.getLogger(__name__)

STAGES = ["start", "clone", "bandit", "pylint", "radon", "scoring"]


# ── Scoring helpers ───────────────────────────────────────────────────────────
# Each function accepts only plain-Python dicts (already sanitized).
# None of them raise — callers still wrap them individually as a second layer.

def compute_health_score(findings: list) -> float:
    """
    0–100 float.  Deducts points by severity.
    severity weights: critical=15, high=10, medium=5, low=2, unknown=3
    """
    weights = {"critical": 15, "high": 10, "medium": 5, "low": 2}
    deduction = 0.0
    for f in findings:
        sev = str(f.get("severity", "")).lower() if isinstance(f, dict) else ""
        deduction += weights.get(sev, 3)   # 3 for unknown/missing severity
    score = max(0.0, 100.0 - deduction)
    return round(score, 1)


def compute_risk_level(findings: list, health_score: float) -> tuple[str, str]:
    """
    Returns (risk_level, merge_decision).
    risk_level:     "Low" | "Medium" | "High" | "Critical"
    merge_decision: "Approve" | "Needs Review" | "Block"
    """
    critical_count = sum(
        1 for f in findings
        if isinstance(f, dict) and str(f.get("severity", "")).lower() == "critical"
    )

    if critical_count > 0 or health_score < 40:
        return "Critical", "Block"
    if health_score < 60:
        return "High", "Block"
    if health_score < 80:
        return "Medium", "Needs Review"
    return "Low", "Approve"


def compute_category_scores(findings: list) -> dict:
    """
    Groups findings by category and returns per-category counts + score.
    e.g. {"security": {"count": 3, "score": 70.0}, ...}
    """
    buckets: dict[str, list] = defaultdict(list)
    for f in findings:
        if not isinstance(f, dict):
            continue
        cat = str(f.get("category") or f.get("type") or "uncategorized").lower()
        buckets[cat].append(f)

    result = {}
    for cat, items in buckets.items():
        result[cat] = {
            "count": len(items),
            "score": compute_health_score(items),
        }
    return result


def compute_hotspots(findings: list) -> list:
    """
    Returns up to 10 files sorted by finding count (descending).
    Each entry: {"file": str, "count": int}
    """
    file_counts: dict[str, int] = defaultdict(int)
    for f in findings:
        if not isinstance(f, dict):
            continue
        filepath = f.get("file") or f.get("filename") or f.get("path") or "unknown"
        file_counts[str(filepath)] += 1

    sorted_files = sorted(file_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"file": fp, "count": cnt} for fp, cnt in sorted_files[:10]]


# ── SSE queue helpers ─────────────────────────────────────────────────────────

def _json_safe(payload: dict, label: str) -> dict:
    """
    Dry-run json.dumps before the payload enters the queue.
    If it fails, return a minimal serializable fallback so the SSE
    router never crashes on our data.
    """
    try:
        json.dumps(payload)
        return payload
    except Exception:
        tb = traceback.format_exc()
        logger.error("JSON serialization failed for '%s':\n%s", label, tb)
        return {
            "stage":   label,
            "status":  "error",
            "message": f"Result could not be serialized: {tb[:300]}",
        }


async def _enqueue(scan: ScanState, event_type: str, data: dict, scan_id: str) -> None:
    safe_data = _json_safe(data, data.get("stage", event_type))
    try:
        await scan.queue.put({"event": event_type, "data": safe_data})
    except Exception:
        logger.error("[%s] queue.put FAILED  event=%s:\n%s",
                     scan_id, event_type, traceback.format_exc())


# ── Generic stage stub ────────────────────────────────────────────────────────

async def _run_stage(stage: str, scan_id: str, repo_url: str) -> dict:
    """Placeholder — replace with real tool invocations per stage."""
    logger.info("[%s] stage=%s  starting", scan_id, stage)
    await asyncio.sleep(1)
    return {
        "stage":    stage,
        "status":   "ok",
        "message":  f"Stage '{stage}' completed successfully",
        "repo_url": repo_url,
    }


# ── Scoring stage ─────────────────────────────────────────────────────────────

async def _run_scoring(scan_id: str, stage_results: dict) -> dict:
    """
    Safe scoring implementation.

    Contract:
    - NEVER raises
    - Always returns a JSON-serializable dict
    - Full traceback logged on every exception
    - Raw `validated` is NEVER used after sanitization
    """
    logger.info("[%s] ══════ ENTERING SCORING STAGE ══════", scan_id)
    await asyncio.sleep(1)

    # ── 1. Collect raw findings from prior stages ─────────────────────────────
    validated: list = []

    for src_stage in ("bandit", "pylint", "radon"):
        src = stage_results.get(src_stage, {})
        if not isinstance(src, dict):
            logger.warning("[%s] stage_results[%r] is not a dict: %r", scan_id, src_stage, src)
            continue
        raw = src.get("findings")
        logger.info("[%s] %s.findings  type=%s  value=%r", scan_id, src_stage, type(raw), raw)
        if isinstance(raw, list):
            validated.extend(raw)
        elif raw is not None:
            logger.warning("[%s] %s findings not a list (got %s) — skipped",
                           scan_id, src_stage, type(raw))

    # ── 2. Validate the collected list ────────────────────────────────────────
    if not isinstance(validated, list):
        logger.error("[%s] validated is not a list: %r  — resetting to []", scan_id, validated)
        validated = []

    logger.info("[%s] validated count: %d", scan_id, len(validated))

    # ── 3. Sanitize: convert every finding to a plain dict ───────────────────
    safe_findings: list = []

    for f in validated:
        try:
            if hasattr(f, "model_dump"):          # Pydantic v2
                safe_findings.append(f.model_dump())
            elif hasattr(f, "dict"):              # Pydantic v1
                safe_findings.append(f.dict())
            elif isinstance(f, dict):
                safe_findings.append(f)
            else:
                logger.warning("[%s] invalid finding type %s: %r — skipped",
                               scan_id, type(f), f)
        except Exception:
            logger.error("[%s] failed to serialize finding %r:\n%s",
                         scan_id, f, traceback.format_exc())

    logger.info("[%s] safe_findings count: %d", scan_id, len(safe_findings))

    # ── 4. Compute scores — each function individually guarded ────────────────
    try:
        health_score: float = compute_health_score(safe_findings)
        logger.info("[%s] health_score=%s", scan_id, health_score)
    except Exception:
        logger.exception("[%s] health_score failed", scan_id)
        health_score = 70.0

    try:
        risk_level, merge_decision = compute_risk_level(safe_findings, health_score)
        logger.info("[%s] risk_level=%s  merge_decision=%s", scan_id, risk_level, merge_decision)
    except Exception:
        logger.exception("[%s] risk_level failed", scan_id)
        risk_level     = "Medium"
        merge_decision = "Needs Review"

    try:
        category_scores: dict = compute_category_scores(safe_findings)
        logger.info("[%s] category_scores=%r", scan_id, category_scores)
    except Exception:
        logger.exception("[%s] category_scores failed", scan_id)
        category_scores = {}

    try:
        hotspots: list = compute_hotspots(safe_findings)
        logger.info("[%s] hotspots=%r", scan_id, hotspots)
    except Exception:
        logger.exception("[%s] hotspots failed", scan_id)
        hotspots = []

    # ── 5. Build result — safe_findings only, never raw validated ─────────────
    try:
        findings_output = safe_findings
    except Exception:
        logger.exception("[%s] findings_output assignment failed", scan_id)
        findings_output = []

    try:
        result = {
            "stage":            "scoring",
            "status":           "ok",
            "message":          (
                f"Score: {health_score} | Risk: {risk_level} | "
                f"Findings: {len(safe_findings)}"
            ),
            "health_score":     health_score,
            "risk_level":       risk_level,
            "merge_decision":   merge_decision,
            "findings_count":   len(safe_findings),
            "category_scores":  category_scores,
            "hotspots":         hotspots,
            "findings":         findings_output,
        }
        logger.info("[%s] scoring SUCCESS  result=%r", scan_id, result)
        return result

    except Exception:
        logger.exception("[%s] scoring result dict construction failed", scan_id)
        # Absolute primitive fallback — cannot fail
        return {
            "stage":            "scoring",
            "status":           "ok",
            "message":          "Scoring complete (construction fallback)",
            "health_score":     70.0,
            "risk_level":       "Medium",
            "merge_decision":   "Needs Review",
            "findings_count":   0,
            "category_scores":  {},
            "hotspots":         [],
            "findings":         [],
        }


# ── Pipeline ──────────────────────────────────────────────────────────────────

async def run_pipeline(scan_id: str, repo_url: str) -> None:
    """
    Runs every stage in order.

    Hard guarantees — regardless of any exception:
      • scan.done      is ALWAYS True when this coroutine exits
      • scan.status    is ALWAYS 'completed' or 'error'
      • scan.finalize  is ALWAYS called exactly once
      • event: done    is ALWAYS the last SSE event
      • Full tracebacks appear in logs — no silent failures
    """
    scan = get_scan(scan_id)
    if scan is None:
        logger.error("[%s] run_pipeline: unknown scan_id — aborting", scan_id)
        return

    logger.info("[%s] pipeline START  repo=%s  stages=%s", scan_id, repo_url, STAGES)

    stage_results:  dict[str, dict] = {}
    pipeline_error: dict | None     = None

    # ── Stage loop ─────────────────────────────────────────────────────────────
    try:
        for stage in STAGES:
            logger.info("[%s] ── stage=%s  BEGIN", scan_id, stage)
            try:
                if stage == "scoring":
                    result = await _run_scoring(scan_id, stage_results)
                else:
                    result = await _run_stage(stage, scan_id, repo_url)

                stage_results[stage] = result
                logger.info("[%s] ── stage=%s  DONE", scan_id, stage)
                await _enqueue(scan, "stage", result, scan_id)

            except Exception:
                full_tb = traceback.format_exc()
                logger.error("[%s] ── stage=%s  FAILED:\n%s", scan_id, stage, full_tb)

                pipeline_error = {
                    "type":         "StageError",
                    "message":      full_tb.splitlines()[-1],
                    "traceback":    full_tb,
                    "failed_stage": stage,
                }
                await _enqueue(scan, "stage", {
                    "stage":   stage,
                    "status":  "error",
                    "message": full_tb.splitlines()[-1],
                }, scan_id)
                break   # finalization still runs

    except Exception:
        full_tb = traceback.format_exc()
        logger.error("[%s] FATAL outer pipeline exception:\n%s", scan_id, full_tb)
        pipeline_error = {
            "type":         "FatalPipelineError",
            "message":      full_tb.splitlines()[-1],
            "traceback":    full_tb,
            "failed_stage": "unknown",
        }

    # ── Finalization — ALWAYS executes ─────────────────────────────────────────
    logger.info("[%s] finalizing  stages_completed=%s  error=%s",
                scan_id, list(stage_results.keys()), pipeline_error is not None)

    # Safe defaults — guarantee these are always bound even if the try/except below throws
    done_status:  str  = "error"
    done_message: str  = "Pipeline did not complete"
    final_result: dict = {"scan_id": scan_id, "status": "error", "error": "Pipeline did not complete"}

    try:
        if pipeline_error is None:
            scoring = stage_results.get("scoring", {})
            final_result = {
                "scan_id":          scan_id,
                "status":           "completed",
                "result":           stage_results,
                "health_score":     scoring.get("health_score",     70.0),
                "risk_level":       scoring.get("risk_level",       "Medium"),
                "merge_decision":   scoring.get("merge_decision",   "Needs Review"),
                "findings_count":   scoring.get("findings_count",   0),
                "category_scores":  scoring.get("category_scores",  {}),
                "hotspots":         scoring.get("hotspots",         []),
            }
            done_status  = "ok"
            done_message = "Pipeline completed successfully"
            scan.finalize(result=final_result)

        else:
            final_result = {
                "scan_id": scan_id,
                "status":  "error",
                "error":   pipeline_error,
            }
            done_status  = "error"
            done_message = pipeline_error.get("message", "Pipeline failed")
            scan.finalize(error=pipeline_error)

        logger.info("[%s] FINAL RESULT: %r", scan_id, final_result)

    except Exception:
        full_tb = traceback.format_exc()
        logger.error("[%s] FINALIZATION BUILD FAILED:\n%s", scan_id, full_tb)
        final_result = {"scan_id": scan_id, "status": "error", "error": full_tb}
        done_status  = "error"
        done_message = "Finalization failed — see server logs"
        try:
            scan.finalize(error={"type": "FinalizationError", "traceback": full_tb})
        except Exception:
            # Absolute last resort — set fields manually
            scan.status = "error"
            scan.done   = True

    # ── Terminal "done" event — ALWAYS sent ────────────────────────────────────
    try:
        await _enqueue(scan, "done", {
            "stage":      "done",
            "status":     done_status,
            "message":    done_message,
            "stages_run": list(stage_results.keys()),
            "result":     final_result,
        }, scan_id)
        logger.info("[%s] done event enqueued  status=%s", scan_id, done_status)
    except Exception:
        logger.error("[%s] FATAL — could not enqueue done event:\n%s",
                     scan_id, traceback.format_exc())
    finally:
        # Belt-and-suspenders: scan.done must be True even if finalize() failed
        if not scan.done:
            scan.done = True
        logger.info("[%s] pipeline EXIT  status=%s  done=%s", scan_id, scan.status, scan.done)
