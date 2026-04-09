import asyncio
import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import List

from app.models import Finding, Severity


def _severity_from_bandit(issue_sev: str, issue_conf: str) -> Severity:
    sev = issue_sev.upper()
    conf = issue_conf.upper()
    if sev == "HIGH" and conf == "HIGH":
        return Severity.CRITICAL
    elif sev == "HIGH":
        return Severity.HIGH
    elif sev == "MEDIUM":
        return Severity.MEDIUM
    return Severity.LOW


async def run_bandit(repo_path: str) -> List[Finding]:
    findings: List[Finding] = []
    # Check if any Python files exist
    py_files = list(Path(repo_path).rglob("*.py"))
    if not py_files:
        return findings

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        output_file = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            "bandit", "-r", repo_path, "-f", "json", "-o", output_file, "-q",
            "--exit-zero",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            await asyncio.wait_for(proc.communicate(), timeout=60)
        except asyncio.TimeoutError:
            proc.kill()
            return findings

        if os.path.exists(output_file):
            with open(output_file) as f:
                data = json.load(f)
            for result in data.get("results", []):
                rel_path = os.path.relpath(result.get("filename", ""), repo_path)
                severity = _severity_from_bandit(
                    result.get("issue_severity", "LOW"),
                    result.get("issue_confidence", "LOW"),
                )
                findings.append(Finding(
                    id=str(uuid.uuid4()),
                    severity=severity,
                    confidence=0.75,
                    file=rel_path,
                    line=result.get("line_number", 0),
                    description=result.get("issue_text", ""),
                    tool="bandit",
                ))
    except Exception as e:
        print(f"[Bandit] Error: {e}")
    finally:
        if os.path.exists(output_file):
            os.unlink(output_file)

    return findings


async def run_pylint(repo_path: str) -> List[Finding]:
    findings: List[Finding] = []
    py_files = list(Path(repo_path).rglob("*.py"))
    if not py_files:
        return findings

    try:
        proc = await asyncio.create_subprocess_exec(
            "pylint",
            "--output-format=json",
            "--recursive=y",
            "--disable=C0114,C0115,C0116",  # skip missing docstrings
            repo_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        except asyncio.TimeoutError:
            proc.kill()
            return findings

        if stdout:
            try:
                results = json.loads(stdout.decode(errors="ignore"))
                for result in results:
                    msg_type = result.get("type", "convention")
                    if msg_type == "error":
                        severity = Severity.HIGH
                    elif msg_type == "warning":
                        severity = Severity.MEDIUM
                    else:
                        severity = Severity.LOW

                    rel_path = os.path.relpath(result.get("path", ""), repo_path)
                    symbol = result.get("symbol", "")
                    message = result.get("message", "")

                    findings.append(Finding(
                        id=str(uuid.uuid4()),
                        severity=severity,
                        confidence=0.70,
                        file=rel_path,
                        line=result.get("line", 0),
                        description=f"[{symbol}] {message}",
                        tool="pylint",
                    ))
            except json.JSONDecodeError:
                pass
    except Exception as e:
        print(f"[Pylint] Error: {e}")

    return findings


async def run_radon(repo_path: str) -> List[Finding]:
    findings: List[Finding] = []
    py_files = list(Path(repo_path).rglob("*.py"))
    if not py_files:
        return findings

    try:
        proc = await asyncio.create_subprocess_exec(
            "radon", "cc", repo_path, "-j",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        except asyncio.TimeoutError:
            proc.kill()
            return findings

        if stdout:
            try:
                data = json.loads(stdout.decode(errors="ignore"))
                for file_path, functions in data.items():
                    rel_path = os.path.relpath(file_path, repo_path)
                    for func in functions:
                        complexity = func.get("complexity", 0)
                        if complexity < 11:
                            continue  # A/B rank – not a problem

                        if complexity >= 26:
                            severity = Severity.CRITICAL
                        elif complexity >= 16:
                            severity = Severity.HIGH
                        else:
                            severity = Severity.MEDIUM

                        name = func.get("name", "unknown")
                        rank = func.get("rank", "?")
                        findings.append(Finding(
                            id=str(uuid.uuid4()),
                            severity=severity,
                            confidence=0.80,
                            file=rel_path,
                            line=func.get("lineno", 0),
                            description=(
                                f"High cyclomatic complexity ({complexity}, rank {rank}) "
                                f"in {func.get('type','function')} '{name}'"
                            ),
                            tool="radon",
                        ))
            except json.JSONDecodeError:
                pass
    except Exception as e:
        print(f"[Radon] Error: {e}")

    return findings
