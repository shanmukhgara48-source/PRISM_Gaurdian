export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type RiskLevel = 'low' | 'medium' | 'high'
export type MergeDecision = 'Approved' | 'Needs Review' | 'Blocked'

export interface Finding {
  id: string
  severity: Severity
  confidence: number
  file: string
  line: number
  description: string
  fix?: string
  explanation?: string
  tool: string
}

export interface CategoryScore {
  security: number
  quality: number
  complexity: number
  maintainability: number
}

export interface Hotspot {
  file: string
  count: number
  max_severity: Severity
  findings: Array<{ severity: string; description: string; line: number }>
}

export interface ScanResult {
  scan_id: string
  repo_url: string
  health_score: number
  risk_level: RiskLevel
  merge_decision: MergeDecision
  findings: Finding[]
  category_scores: CategoryScore
  hotspots: Hotspot[]
  status: string
}

export interface StreamEvent {
  event: string
  message?: string
  stage?: number
  tool?: string
  health_score?: number
  risk_level?: string
  merge_decision?: string
  findings_count?: number
  scan_id?: string
}
