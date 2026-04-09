<<<<<<< HEAD
import { useScan } from "./useScan";
import { STAGE_ORDER } from "./types";
import type { StageStatus } from "./types";
import "./app.css";

const STAGE_LABEL: Record<string, string> = {
  start: "Initialising",
  clone: "Cloning repository",
  bandit: "Bandit security scan",
  pylint: "Pylint lint check",
  radon: "Radon complexity",
  scoring: "Computing score",
  done: "Finished",
};

function StatusIcon({ status }: { status: StageStatus }) {
  if (status === "done") return <span className="icon done">✓</span>;
  if (status === "running") return <span className="icon running">⟳</span>;
  if (status === "error") return <span className="icon error">✗</span>;
  return <span className="icon pending">·</span>;
}

export default function App() {
  const { repoUrl, setRepoUrl, scanning, stages, result, error, streamError, scan } =
    useScan();

  const hasActivity = Object.values(stages).some((s) => s.status !== "pending");

  return (
    <div className="container">
      <header className="app-header">
        <h1>PRISM Guardian</h1>
        <p className="subtitle">AI-powered repository security scanner</p>
      </header>

      <section className="input-section">
        <input
          type="text"
          className="repo-input"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && scan()}
          disabled={scanning}
        />
        <button
          className="scan-btn"
          onClick={scan}
          disabled={scanning || !repoUrl.trim()}
        >
          {scanning ? "Scanning…" : "Scan"}
        </button>
      </section>

      {error && <div className="banner error-banner">⚠ {error}</div>}
      {streamError && (
        <div className="banner error-banner">⚠ Connection lost — SSE stream failed.</div>
      )}

      {hasActivity && (
        <section className="progress-section">
          <h2>Progress</h2>
          <ul className="stage-list">
            {STAGE_ORDER.map((key) => {
              const s = stages[key];
              return (
                <li key={key} className={`stage-item ${s.status}`}>
                  <StatusIcon status={s.status} />
                  <span className="stage-label">{STAGE_LABEL[key] ?? key}</span>
                  {s.message && <span className="stage-msg">{s.message}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {result && (
        <section className="result-section">
          <h2>Result</h2>
          <div className="result-card">
            <div className="result-row">
              <span className="result-key">Status</span>
              <span className={`badge ${result.status}`}>{result.status}</span>
            </div>
            {result.score !== undefined && (
              <div className="result-row">
                <span className="result-key">Score</span>
                <span className="result-val score">{result.score} / 100</span>
              </div>
            )}
            <div className="result-row">
              <span className="result-key">Scan ID</span>
              <span className="result-val mono">{result.scan_id}</span>
            </div>
            <details>
              <summary>Raw JSON</summary>
              <pre className="raw-json">{JSON.stringify(result, null, 2)}</pre>
            </details>
          </div>
        </section>
      )}
    </div>
  );
=======
import { useState, useRef, useCallback } from 'react'
import { Shield, RefreshCw, AlertTriangle } from 'lucide-react'
import ScanInput from './components/ScanInput'
import StreamingPanel from './components/StreamingPanel'
import HealthScoreCard from './components/HealthScoreCard'
import CategoryBreakdown from './components/CategoryBreakdown'
import FindingsTable from './components/FindingsTable'
import HotspotPanel from './components/HotspotPanel'
import ExplainModal from './components/ExplainModal'
import { startScan, startPRReview, getScanResult, streamScan } from './api/client'
import { StreamEvent, ScanResult, Finding } from './types'

type Phase = 'idle' | 'streaming' | 'done' | 'error'

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [scanId, setScanId] = useState<string | null>(null)
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [explainData, setExplainData] = useState<{ finding: Finding; explanation: string } | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const addEvent = useCallback((e: StreamEvent) => {
    setEvents(prev => [...prev, e])
  }, [])

  const handleScanDone = useCallback(async (id: string) => {
    try {
      const res = await getScanResult(id)
      setResult(res)
      setPhase('done')
    } catch (err) {
      setError(`Failed to fetch results: ${err}`)
      setPhase('error')
    }
  }, [])

  const initiateScan = async (getIdFn: () => Promise<string>) => {
    setPhase('streaming')
    setEvents([])
    setResult(null)
    setError(null)

    let id: string
    try {
      id = await getIdFn()
    } catch (err) {
      setError(String(err))
      setPhase('error')
      return
    }

    setScanId(id)

    // Connect to SSE stream
    esRef.current?.close()
    esRef.current = streamScan(
      id,
      addEvent,
      () => handleScanDone(id),
      (msg) => { setError(msg); setPhase('error') },
    )
  }

  const handleReset = () => {
    esRef.current?.close()
    setPhase('idle')
    setScanId(null)
    setEvents([])
    setResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Nav bar */}
      <nav className="border-b border-[#30363d] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          <span className="text-white font-semibold text-sm">PRISM Guardian AI</span>
          <span className="text-[#484f58] text-xs ml-1">v1.0</span>
        </div>
        {phase !== 'idle' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[#8b949e] hover:text-white text-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New Scan
          </button>
        )}
      </nav>

      {/* Content */}
      {phase === 'idle' && (
        <ScanInput
          onScan={(url) => initiateScan(() => startScan(url))}
          onPRReview={(url) => initiateScan(() => startPRReview(url))}
          isLoading={false}
        />
      )}

      {(phase === 'streaming' || (phase === 'done' && events.length > 0)) && scanId && (
        <StreamingPanel events={events} scanId={scanId} />
      )}

      {phase === 'error' && (
        <div className="max-w-2xl mx-auto mt-12 px-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Scan Failed</h3>
            <p className="text-red-300 text-sm mb-4">{error}</p>
            <button onClick={handleReset} className="bg-[#161b22] border border-[#30363d] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#1c2128] transition-colors">
              Try Again
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="max-w-6xl mx-auto px-4 pb-12 space-y-5">
          {/* Top row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <HealthScoreCard result={result} />
            </div>
            <div>
              <CategoryBreakdown scores={result.category_scores} />
            </div>
          </div>

          {/* Findings table */}
          <FindingsTable
            findings={result.findings}
            scanId={result.scan_id}
            onExplain={(finding, explanation) => setExplainData({ finding, explanation })}
          />

          {/* Hotspots */}
          {result.hotspots.length > 0 && (
            <HotspotPanel hotspots={result.hotspots} />
          )}

          {result.findings.length === 0 && (
            <div className="text-center py-12 bg-[#161b22] border border-[#30363d] rounded-xl">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="text-white font-semibold text-lg">No Issues Found</h3>
              <p className="text-[#8b949e] text-sm mt-1">This repository looks clean!</p>
            </div>
          )}
        </div>
      )}

      {/* Explain modal */}
      {explainData && (
        <ExplainModal
          finding={explainData.finding}
          explanation={explainData.explanation}
          onClose={() => setExplainData(null)}
        />
      )}
    </div>
  )
>>>>>>> 2e70c2b (PRISM Guardian AI full system (local LLM + pipeline))
}
