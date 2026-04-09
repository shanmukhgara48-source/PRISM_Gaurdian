import { useEffect, useRef } from 'react'
import { Terminal, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { StreamEvent } from '../types'

const STAGES = [
  { id: 0, label: 'Clone' },
  { id: 2, label: 'Bandit' },
  { id: 3, label: 'Pylint' },
  { id: 4, label: 'Radon' },
  { id: 5, label: 'AI Validate' },
  { id: 6, label: 'Scoring' },
  { id: 7, label: 'Done' },
]

interface Props {
  events: StreamEvent[]
  scanId: string
}

function eventIcon(event: StreamEvent) {
  if (event.event === 'done') return <CheckCircle className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
  if (event.event === 'error') return <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
  if (event.event === 'ping') return null
  return <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
}

function eventColor(event: StreamEvent) {
  if (event.event === 'done') return 'text-green-400'
  if (event.event === 'error') return 'text-red-400'
  if (event.event === 'cloning' || event.event === 'cloned') return 'text-yellow-400'
  if (event.event === 'validation' || event.event === 'validation_complete') return 'text-purple-400'
  if (event.event === 'scoring') return 'text-cyan-400'
  return 'text-[#e6edf3]'
}

export default function StreamingPanel({ events, scanId }: Props) {
  const logRef = useRef<HTMLDivElement>(null)
  const currentStage = events.reduce((max, e) => Math.max(max, e.stage ?? 0), 0)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events])

  const isDone = events.some(e => e.event === 'done')
  const hasError = events.some(e => e.event === 'error')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span className="text-white font-medium text-sm">Live Scan</span>
            <span className="text-[#484f58] text-xs font-mono">#{scanId}</span>
          </div>
          {!isDone && !hasError && (
            <div className="flex items-center gap-1.5 text-xs text-[#8b949e]">
              <Loader className="w-3.5 h-3.5 animate-spin" />
              Running…
            </div>
          )}
          {isDone && <span className="text-xs text-green-400 font-medium">Complete</span>}
          {hasError && <span className="text-xs text-red-400 font-medium">Failed</span>}
        </div>

        {/* Stage progress */}
        <div className="px-5 py-3 border-b border-[#30363d] flex items-center gap-2 overflow-x-auto">
          {STAGES.map((stage, i) => {
            const done = currentStage > stage.id || (isDone && stage.id === 7)
            const active = currentStage === stage.id && !isDone
            return (
              <div key={stage.id} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  done ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  active ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  'bg-[#0d1117] text-[#484f58] border border-[#30363d]'
                }`}>
                  {done && <CheckCircle className="w-3 h-3" />}
                  {active && <Loader className="w-3 h-3 animate-spin" />}
                  {stage.label}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`w-4 h-px ${done ? 'bg-green-500/40' : 'bg-[#30363d]'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Log feed */}
        <div ref={logRef} className="h-64 overflow-y-auto font-mono text-xs p-4 space-y-1.5 bg-[#0d1117]">
          {events.filter(e => e.event !== 'ping' && e.message).map((e, i) => (
            <div key={i} className="flex items-start gap-2">
              {eventIcon(e)}
              <span className={eventColor(e)}>{e.message}</span>
            </div>
          ))}
          {!events.length && (
            <span className="text-[#484f58]">Connecting to scan stream…</span>
          )}
        </div>
      </div>
    </div>
  )
}
