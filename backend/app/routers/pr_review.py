import asyncio
import os
import re
import uuid

import httpx
from fastapi import APIRouter, HTTPException

from app.models import PRReviewRequest
from app.pipeline.cloner import CLONE_BASE
from app.pipeline.orchestrator import run_scan_pipeline
from app.store import ScanState, scans

router = APIRouter(prefix="/api")


def _parse_pr_url(pr_url: str):
    """Return (owner, repo, pr_number) from a GitHub PR URL."""
    m = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", pr_url)
    if not m:
        raise ValueError(f"Cannot parse GitHub PR URL: {pr_url}")
    return m.group(1), m.group(2), int(m.group(3))


@router.post("/pr-review")
async def review_pr(body: PRReviewRequest):
    try:
        owner, repo, pr_number = _parse_pr_url(body.pr_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    headers = {"Accept": "application/vnd.github.v3+json"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"

    # Fetch PR metadata to get the head clone URL
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
            headers=headers,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"GitHub API error: {resp.text}")
        pr_data = resp.json()

    clone_url: str = pr_data["head"]["repo"]["clone_url"]
    head_ref: str = pr_data["head"]["ref"]

    scan_id = str(uuid.uuid4())[:8]
    state = ScanState(scan_id=scan_id)
    scans[scan_id] = state

    state.add_event({
        "event": "pr_start",
        "message": f"Cloning PR #{pr_number} branch '{head_ref}'…",
        "scan_id": scan_id,
        "stage": 0,
    })

    os.makedirs(CLONE_BASE, exist_ok=True)
    repo_path = f"{CLONE_BASE}/{scan_id}"

    proc = await asyncio.create_subprocess_exec(
        "git", "clone", "--depth", "1", "--branch", head_ref, clone_url, repo_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=90)
    except asyncio.TimeoutError:
        proc.kill()
        raise HTTPException(status_code=500, detail="Git clone timed out")

    if proc.returncode != 0:
        raise HTTPException(status_code=400, detail=f"Clone failed: {stderr.decode(errors='ignore')}")

    state.add_event({"event": "cloned", "message": "PR branch cloned ✓", "scan_id": scan_id})
    asyncio.create_task(run_scan_pipeline(scan_id, repo_path, body.pr_url))

    return {
        "scan_id": scan_id,
        "pr_number": pr_number,
        "repo": f"{owner}/{repo}",
        "branch": head_ref,
    }
