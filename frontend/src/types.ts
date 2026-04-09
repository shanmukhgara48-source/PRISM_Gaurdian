export type StageStatus = "pending" | "running" | "done" | "error";

export interface StageEvent {
  stage: string;
  status: StageStatus;
  message?: string;
  detail?: unknown;
}

export interface ScanResult {
  scan_id: string;
  status: string;
  stages: Record<string, unknown>;
  score?: number;
}

export const STAGE_ORDER = [
  "start",
  "clone",
  "bandit",
  "pylint",
  "radon",
  "scoring",
  "done",
] as const;
