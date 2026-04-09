from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Finding(BaseModel):
    id: str
    severity: Severity
    confidence: float  # 0.0 - 1.0, LLM-assigned
    file: str
    line: int
    description: str
    fix: Optional[str] = None
    explanation: Optional[str] = None
    tool: str  # bandit | pylint | radon


class CategoryScore(BaseModel):
    security: float
    quality: float
    complexity: float
    maintainability: float


class ScanResult(BaseModel):
    scan_id: str
    repo_url: str
    health_score: float
    risk_level: str   # low | medium | high
    merge_decision: str  # Approved | Needs Review | Blocked
    findings: List[dict]
    category_scores: dict
    hotspots: List[dict]
    status: str
    error: Optional[str] = None


class ScanRequest(BaseModel):
    repo_url: str


class PRReviewRequest(BaseModel):
    pr_url: str


class ExplainRequest(BaseModel):
    finding: dict
    code_context: Optional[str] = ""
