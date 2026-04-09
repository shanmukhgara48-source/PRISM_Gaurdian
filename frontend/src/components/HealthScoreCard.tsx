import { ScanResult } from '../types'

interface Props {
  result: ScanResult
}

function scoreColor(score: number) {
  if (score >= 80) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function mergeDecisionStyle(decision: string) {
  if (decision === 'Approved') return 'bg-green-500/10 border-green-500/30 text-green-400'
  if (decision === 'Needs Review') return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
  return 'bg-red-500/10 border-red-500/30 text-red-400'
}

function GaugeArc({ score }: { score: number }) {
  const r = 52
  const cx = 64
  const cy = 64
  const angle = (score / 100) * 180
  const rad = (angle * Math.PI) / 180
  const x = cx + r * Math.cos(Math.PI - rad)
  const y = cy - r * Math.sin(rad)
  const largeArc = angle > 90 ? 1 : 0
  const color = scoreColor(score)

  return (
    <svg viewBox="0 0 128 80" className="w-full max-w-[180px]">
      {/* Background arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#30363d"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Score arc */}
      {score > 0 && (
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
        />
      )}
      {/* Score text */}
      <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize="24" fontWeight="700" fontFamily="monospace">
        {Math.round(score)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#8b949e" fontSize="9">
        HEALTH SCORE
      </text>
    </svg>
  )
}

export default function HealthScoreCard({ result }: Props) {
  const counts = result.findings.reduce(
    (acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc },
    {} as Record<string, number>
  )

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Gauge */}
        <div className="flex flex-col items-center">
          <GaugeArc score={result.health_score} />
          <div className={`mt-3 px-4 py-1.5 rounded-full border text-sm font-semibold ${mergeDecisionStyle(result.merge_decision)}`}>
            {result.merge_decision}
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-white font-semibold text-lg mb-1">Repository Analysis</h2>
          <p className="text-[#8b949e] text-sm mb-4 truncate max-w-xs">{result.repo_url}</p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Critical', count: counts.critical || 0, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
              { label: 'High', count: counts.high || 0, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
              { label: 'Medium', count: counts.medium || 0, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
              { label: 'Low', count: counts.low || 0, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
            ].map(({ label, count, color }) => (
              <div key={label} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${color}`}>
                <span className="text-xs font-medium">{label}</span>
                <span className="text-sm font-bold">{count}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-[#30363d]">
            <span className="text-[#8b949e] text-xs">Total findings: </span>
            <span className="text-white text-xs font-semibold">{result.findings.length}</span>
            <span className="text-[#8b949e] text-xs ml-3">Risk level: </span>
            <span className={`text-xs font-semibold capitalize ${
              result.risk_level === 'high' ? 'text-red-400' :
              result.risk_level === 'medium' ? 'text-yellow-400' : 'text-green-400'
            }`}>{result.risk_level}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
