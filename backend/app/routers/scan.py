from fastapi import APIRouter, HTTPException

from app.models import ExplainRequest, ScanRequest
from app.store import scans
from app.pipeline.orchestrator import start_scan
from app.pipeline.llm_client import generate_explanation, get_code_context
from pathlib import Path
from app.pipeline.cloner import CLONE_BASE

router = APIRouter(prefix="/api")


@router.post("/scan")
async def create_scan(body: ScanRequest):
    scan_id = await start_scan(body.repo_url)
    return {"scan_id": scan_id}


@router.get("/scan/{scan_id}")
async def get_scan(scan_id: str):
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail="Scan not found")
    state = scans[scan_id]
    if state.result:
        return state.result
    return {
        "scan_id": scan_id,
        "status": "error" if state.error else "running",
        "error": state.error,
    }


@router.post("/explain")
async def explain_finding(body: ExplainRequest):
    finding = body.finding
    code_context = body.code_context or ""

    # Try to auto-fetch code context if not supplied
    if not code_context:
        scan_id = finding.get("scan_id", "")
        file_rel = finding.get("file", "")
        line = finding.get("line", 0)
        if scan_id and file_rel:
            full_path = str(Path(CLONE_BASE) / scan_id / file_rel)
            code_context = await get_code_context(full_path, line)

    explanation = await generate_explanation(finding, code_context)
    return {"explanation": explanation}
