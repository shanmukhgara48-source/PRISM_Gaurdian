import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench, BookOpen, Filter } from 'lucide-react'
import { Finding, Severity } from '../types'
import { explainFinding } from '../api/client'

interface Props {
  findings: Finding[]
  scanId: string
  onExplain: (finding: Finding, explanation: string) => void
}

const SEV_STYLE: Record<Severity, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const TOOL_STYLE: Record<string, string> = {
  bandit: 'bg-red-500/10 text-red-300',
  pylint: 'bg-blue-500/10 text-blue-300',
  radon: 'bg-purple-500/10 text-purple-300',
}

const SEV_ORDER: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 }

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`text-xs font-mono ${color}`}>{pct}%</span>
}

function ExpandedRow({ finding, scanId, onExplain }: { finding: Finding; scanId: string; onExplain: (f: Finding, e: string) => void }) {
  const [explaining, setExplaining] = useState(false)

  const handleExplain = async () => {
    setExplaining(true)
    try {
      const explanation = await explainFinding({ ...finding, scan_id: scanId })
      onExplain(finding, explanation)
    } catch (e) {
      onExplain(finding, 'Failed to generate explanation.')
    } finally {
      setExplaining(false)
    }
  }

  return (
    <tr className="bg-[#0d1117]/50">
      <td colSpan={7} className="px-4 py-3">
        <div className="space-y-3">
          {finding.fix && (
            <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3">
              <p className="text-xs text-green-400 font-medium mb-1 flex items-center gap-1">
                <Wrench className="w-3 h-3" /> Suggested Fix
              </p>
              <p className="text-xs text-[#e6edf3]">{finding.fix}</p>
            </div>
          )}
          {finding.explanation && (
            <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
              <p className="text-xs text-blue-400 font-medium mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Explanation
              </p>
              <p className="text-xs text-[#e6edf3]">{finding.explanation}</p>
            </div>
          )}
          {!finding.explanation && (
            <button
              onClick={handleExplain}
              disabled={explaining}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              {explaining ? (
                <div className="w-3 h-3 border border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              ) : (
                <BookOpen className="w-3 h-3" />
              )}
              {explaining ? 'Generating…' : 'Explain with AI'}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function FindingsTable({ findings, scanId, onExplain }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [toolFilter, setToolFilter] = useState<string>('all')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const tools = [...new Set(findings.map(f => f.tool))]

  const filtered = findings
    .filter(f => severityFilter === 'all' || f.severity === severityFilter)
    .filter(f => toolFilter === 'all' || f.tool === toolFilter)
    .sort((a, b) => {
      const diff = SEV_ORDER[b.severity] - SEV_ORDER[a.severity]
      return sortDir === 'desc' ? diff : -diff
    })

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d] gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#8b949e]" />
          <h3 className="text-white font-semibold">Findings</h3>
          <span className="bg-[#30363d] text-[#8b949e] text-xs px-2 py-0.5 rounded-full">{filtered.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value as Severity | 'all')}
            className="bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={toolFilter}
            onChange={e => setToolFilter(e.target.value)}
            className="bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Tools</option>
            {tools.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="bg-[#0d1117] border border-[#30363d] text-[#8b949e] text-xs rounded-lg px-2 py-1.5 hover:text-white transition-colors"
          >
            Severity {sortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[#484f58]">
          <p className="text-lg">No findings match your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363d]">
                <th className="w-8 px-4 py-3" />
                <th className="px-4 py-3 text-left text-xs text-[#8b949e] font-medium">Severity</th>
                <th className="px-4 py-3 text-left text-xs text-[#8b949e] font-medium">Confidence</th>
                <th className="px-4 py-3 text-left text-xs text-[#8b949e] font-medium">File</th>
                <th className="px-4 py-3 text-left text-xs text-[#8b949e] font-medium">Line</th>
                <th className="px-4 py-3 text-left text-xs text-[#8b949e] font-medium">Description</th>
                <th className="px-4 py-3 text-left text-xs text-[#8b949e] font-medium">Tool</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d]">
              {filtered.map(f => (
                <>
                  <tr
                    key={f.id}
                    className="hover:bg-[#1c2128] cursor-pointer transition-colors"
                    onClick={() => toggle(f.id)}
                  >
                    <td className="px-4 py-3">
                      {expanded.has(f.id)
                        ? <ChevronDown className="w-3.5 h-3.5 text-[#8b949e]" />
                        : <ChevronRight className="w-3.5 h-3.5 text-[#8b949e]" />
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium uppercase ${SEV_STYLE[f.severity]}`}>
                        {f.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge value={f.confidence} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-[#8b949e] max-w-[180px] truncate block" title={f.file}>
                        {f.file}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-[#8b949e]">{f.line}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[320px]">
                      <span className="text-xs text-[#e6edf3] line-clamp-2">{f.description}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${TOOL_STYLE[f.tool] || 'bg-[#30363d] text-[#8b949e]'}`}>
                        {f.tool}
                      </span>
                    </td>
                  </tr>
                  {expanded.has(f.id) && (
                    <ExpandedRow key={`${f.id}-exp`} finding={f} scanId={scanId} onExplain={onExplain} />
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
