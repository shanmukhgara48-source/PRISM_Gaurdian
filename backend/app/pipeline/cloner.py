import asyncio
import os

CLONE_BASE = "/tmp/prism_repos"


async def clone_repo(repo_url: str, scan_id: str) -> str:
    """Clone a GitHub repository and return the local path."""
    os.makedirs(CLONE_BASE, exist_ok=True)

    if not (repo_url.startswith("https://github.com/") or repo_url.startswith("https://gitlab.com/")):
        raise ValueError(f"Only GitHub/GitLab URLs are supported. Got: {repo_url}")

    repo_path = os.path.join(CLONE_BASE, scan_id)

    if os.path.exists(repo_path):
        return repo_path

    proc = await asyncio.create_subprocess_exec(
        "git", "clone", "--depth", "1", repo_url, repo_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=90)
    except asyncio.TimeoutError:
        proc.kill()
        raise TimeoutError(f"Git clone timed out for {repo_url}")

    if proc.returncode != 0:
        err = stderr.decode(errors="ignore")
        raise RuntimeError(f"Git clone failed: {err}")

    return repo_path
