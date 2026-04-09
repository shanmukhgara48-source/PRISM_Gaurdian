import { useState } from 'react'
import { Flame, ChevronDown, ChevronRight, File } from 'lucide-react'
import { Hotspot, Severity } from '../types'

interface Props {
  hotspots: Hotspot[]
}

const SEV_DOT: Record<Severity, string> = {
  critical: 'bg-red-400',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
}

const SEV_BAR: Record<Severity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
}

export default function HotspotPanel({ hotspots }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const maxCount = Math.max(...hotspots.map(h => h.count), 1)

  const toggle = (file: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(file) ? next.delete(file) : next.add(file)
      return next
    })
  }

  if (!hotspots.length) return null

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-[#30363d]">
        <Flame className="w-4 h-4 text-orange-400" />
        <h3 className="text-white font-semibold">Hotspots</h3>
        <span className="text-[#484f58] text-xs">Files with highest issue density</span>
      </div>
      <div className="divide-y divide-[#21262d]">
        {hotspots.map((h, i) => (
          <div key={h.file}>
            <div
              className="flex items-center gap-3 px-5 py-3 hover:bg-[#1c2128] cursor-pointer transition-colors"
              onClick={() => toggle(h.file)}
            >
              <span className="text-[#484f58] text-xs w-5 text-right shrink-0">{i + 1}</span>
              {expanded.has(h.file)
                ? <ChevronDown className="w-3.5 h-3.5 text-[#484f58] shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-[#484f58] shrink-0" />
              }
              <File className="w-3.5 h-3.5 text-[#8b949e] shrink-0" />
              <span className="text-xs font-mono text-[#e6edf3] flex-1 truncate" title={h.file}>{h.file}</span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-24 h-1.5 bg-[#0d1117] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${SEV_BAR[h.max_severity as Severity] || 'bg-blue-500'} rounded-full`}
                    style={{ width: `${(h.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-white w-6 text-right">{h.count}</span>
                <div className={`w-2 h-2 rounded-full ${SEV_DOT[h.max_severity as Severity] || 'bg-blue-400'}`} />
              </div>
            </div>
            {expanded.has(h.file) && (
              <div className="px-14 pb-3 space-y-1">
                {h.findings.map((f, j) => (
                  <div key={j} className="flex items-start gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEV_DOT[f.severity as Severity] || 'bg-blue-400'}`} />
                    <span className="text-[#8b949e]">L{f.line}:</span>
                    <span className="text-[#e6edf3]">{f.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
