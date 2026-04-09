import { X, BookOpen } from 'lucide-react'
import { Finding } from '../types'

interface Props {
  finding: Finding
  explanation: string
  onClose: () => void
}

const SEV_STYLE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

export default function ExplainModal({ finding, explanation, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <h2 className="text-white font-semibold">Issue Explanation</h2>
          </div>
          <button onClick={onClose} className="text-[#8b949e] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Finding info */}
        <div className="px-5 py-4 border-b border-[#30363d] space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full border text-xs font-medium uppercase ${SEV_STYLE[finding.severity]}`}>
              {finding.severity}
            </span>
            <span className="text-[#8b949e] text-xs font-mono">{finding.file}:{finding.line}</span>
            <span className="bg-[#30363d] text-[#8b949e] text-xs px-2 py-0.5 rounded">{finding.tool}</span>
          </div>
          <p className="text-sm text-[#e6edf3]">{finding.description}</p>
        </div>

        {/* Explanation */}
        <div className="p-5">
          <div className="prose prose-sm prose-invert max-w-none">
            {explanation.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <h4 key={i} className="text-white font-semibold mt-3 mb-1">{line.replace(/\*\*/g, '')}</h4>
              }
              if (line.match(/^\*\*.*\*\*/)) {
                return <p key={i} className="text-[#e6edf3] text-sm mb-2" dangerouslySetInnerHTML={{
                  __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                }} />
              }
              if (line.trim().startsWith('- ') || line.match(/^\d+\./)) {
                return <p key={i} className="text-[#e6edf3] text-sm ml-4 mb-1">{line}</p>
              }
              return line ? <p key={i} className="text-[#e6edf3] text-sm mb-2">{line}</p> : <div key={i} className="h-1" />
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
