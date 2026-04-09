import { useState, useRef, useCallback } from "react";
import { startScan, openStream, fetchResult } from "./api";
import type { ScanResult, StageStatus } from "./types";
import { STAGE_ORDER } from "./types";

type StageMap = Record<string, { status: StageStatus; message?: string }>;

function initStages(): StageMap {
  return Object.fromEntries(STAGE_ORDER.map((s) => [s, { status: "pending" }]));
}

export function useScan() {
  const [repoUrl, setRepoUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [stages, setStages] = useState<StageMap>(initStages());
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  // prevents onerror from firing "connection lost" after we intentionally close
  const closedIntentionally = useRef(false);

  const reset = useCallback(() => {
    closedIntentionally.current = true;
    esRef.current?.close();
    setStages(initStages());
    setResult(null);
    setError(null);
    setStreamError(false);
  }, []);

  const scan = useCallback(async () => {
    if (!repoUrl.trim()) return;
    reset();
    closedIntentionally.current = false;
    setScanning(true);

    let scanId: string;
    try {
      scanId = await startScan(repoUrl.trim());
    } catch (e) {
      setError((e as Error).message);
      setScanning(false);
      return;
    }

    const es = openStream(scanId);
    esRef.current = es;

    // ── "stage" events ────────────────────────────────────────────────────────
    // Backend emits: { stage, status: "ok", message, repo_url }
    // Mark the arrived stage as done, mark the next one as running.
    es.addEventListener("stage", (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as {
          stage: string;
          status: string;
          message?: string;
        };

        console.log("SSE [stage]:", data);

        setStages((prev) => {
          const next = { ...prev };
          next[data.stage] = { status: "done", message: data.message };
          // mark the next stage as running so the spinner shows immediately
          const idx = STAGE_ORDER.indexOf(data.stage as typeof STAGE_ORDER[number]);
          const nextStage = STAGE_ORDER[idx + 1];
          if (nextStage && next[nextStage].status === "pending") {
            next[nextStage] = { status: "running" };
          }
          return next;
        });
      } catch {
        // ignore malformed payloads
      }
    });

    // ── "done" event ──────────────────────────────────────────────────────────
    // Terminal event — always emitted by the backend, success or failure.
    es.addEventListener("done", (ev: MessageEvent) => {
      console.log("SSE [done]:", ev.data);
      closedIntentionally.current = true;
      es.close();

      let doneStatus: "done" | "error" = "done";
      let doneMessage = "Pipeline completed";
      try {
        const payload = JSON.parse(ev.data) as {
          status?: string;
          message?: string;
        };
        doneStatus = payload.status === "error" ? "error" : "done";
        doneMessage = payload.message ?? doneMessage;
      } catch { /* ignore */ }

      setStages((prev) => ({
        ...prev,
        done: { status: doneStatus, message: doneMessage },
      }));

      // Fetch authoritative result from the REST endpoint regardless of inline payload
      fetchResult(scanId)
        .then((data) => {
          setResult(data);
          setScanning(false);
        })
        .catch((e) => {
          setError((e as Error).message);
          setScanning(false);
        });
    });

    // ── "error" event ─────────────────────────────────────────────────────────
    // Backend-reported pipeline error (not a transport error).
    // NOTE: EventSource also fires "error" for transport drops — those have no
    // ev.data. We must ignore them here and let onerror handle them instead.
    es.addEventListener("error", (ev: MessageEvent) => {
      if (!ev.data) return;   // transport error — not a backend pipeline error
      try {
        const data = JSON.parse(ev.data) as { message?: string; failed_stage?: string };
        console.error("SSE [error]:", data);
        const stage = data.failed_stage;
        if (stage) {
          setStages((prev) => ({
            ...prev,
            [stage]: { status: "error", message: data.message },
          }));
        }
        setError(data.message ?? "Pipeline error");
      } catch {
        setError("Pipeline error");
      }
      closedIntentionally.current = true;
      es.close();
      setScanning(false);
    });

    // ── "heartbeat" events ────────────────────────────────────────────────────
    // Keep-alive pings from the backend — nothing to do.
    es.addEventListener("heartbeat", () => {
      console.log("SSE [heartbeat]");
    });

    // ── Transport error ───────────────────────────────────────────────────────
    // Only treat as "connection lost" if we didn't close it ourselves.
    es.onerror = () => {
      if (closedIntentionally.current) return;
      console.error("SSE transport error — connection lost");
      es.close();
      setStreamError(true);
      setScanning(false);
    };
  }, [repoUrl, reset]);

  return { repoUrl, setRepoUrl, scanning, stages, result, error, streamError, scan };
}
