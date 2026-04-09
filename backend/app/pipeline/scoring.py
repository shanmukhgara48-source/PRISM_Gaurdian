from collections import defaultdict
from typing import List, Tuple

from app.models import CategoryScore, Finding, Severity

_SEV_PENALTY = {
    Severity.CRITICAL: 12.0,
    Severity.HIGH: 6.0,
    Severity.MEDIUM: 2.0,
    Severity.LOW: 0.5,
}

_SEV_ORDER = {Severity.CRITICAL: 4, Severity.HIGH: 3, Severity.MEDIUM: 2, Severity.LOW: 1}


def compute_health_score(findings: List[Finding]) -> float:
    score = 100.0
    for f in findings:
        score -= _SEV_PENALTY.get(f.severity, 0)
    return round(max(0.0, min(100.0, score)), 1)


def compute_risk_level(findings: List[Finding], health_score: float) -> Tuple[str, str]:
    has_critical = any(f.severity == Severity.CRITICAL for f in findings)
    has_high = any(f.severity == Severity.HIGH for f in findings)

    if has_critical or health_score < 50:
        return "high", "Blocked"
    elif has_high or health_score < 80:
        return "medium", "Needs Review"
    return "low", "Approved"


def compute_category_scores(findings: List[Finding]) -> CategoryScore:
    bandit = [f for f in findings if f.tool == "bandit"]
    pylint = [f for f in findings if f.tool == "pylint"]
    radon = [f for f in findings if f.tool == "radon"]

    def _score(items: List[Finding]) -> float:
        penalty = sum(_SEV_PENALTY.get(f.severity, 0) for f in items)
        return round(max(0.0, 100.0 - penalty * 2), 1)

    security = _score(bandit)
    quality = _score(pylint)
    complexity = _score(radon)
    maintainability = round((security + quality + complexity) / 3, 1)

    return CategoryScore(
        security=security,
        quality=quality,
        complexity=complexity,
        maintainability=maintainability,
    )


def compute_hotspots(findings: List[Finding]) -> List[dict]:
    file_data: dict = defaultdict(lambda: {"count": 0, "max_sev_order": 0, "max_severity": "low", "findings": []})

    for f in findings:
        fd = file_data[f.file]
        fd["count"] += 1
        sev_order = _SEV_ORDER.get(f.severity, 1)
        if sev_order > fd["max_sev_order"]:
            fd["max_sev_order"] = sev_order
            fd["max_severity"] = f.severity.value
        if len(fd["findings"]) < 5:
            fd["findings"].append({
                "severity": f.severity.value,
                "description": f.description,
                "line": f.line,
            })

    hotspots = [
        {"file": file, "count": d["count"], "max_severity": d["max_severity"], "findings": d["findings"]}
        for file, d in file_data.items()
    ]
    hotspots.sort(key=lambda h: ({"critical": 4, "high": 3, "medium": 2, "low": 1}.get(h["max_severity"], 0), h["count"]), reverse=True)
    return hotspots[:10]
