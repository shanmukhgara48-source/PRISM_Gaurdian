import { Shield, Code, GitBranch, Wrench } from 'lucide-react'
import { CategoryScore } from '../types'

interface Props {
  scores: CategoryScore
}

const CATEGORIES = [
  { key: 'security' as const, label: 'Security', icon: Shield, color: 'from-red-500 to-orange-500' },
  { key: 'quality' as const, label: 'Code Quality', icon: Code, color: 'from-blue-500 to-cyan-500' },
  { key: 'complexity' as const, label: 'Complexity', icon: GitBranch, color: 'from-purple-500 to-pink-500' },
  { key: 'maintainability' as const, label: 'Maintainability', icon: Wrench, color: 'from-green-500 to-emerald-500' },
]

function scoreLabel(score: number) {
  if (score >= 80) return { text: 'Good', cls: 'text-green-400' }
  if (score >= 60) return { text: 'Fair', cls: 'text-yellow-400' }
  return { text: 'Poor', cls: 'text-red-400' }
}

export default function CategoryBreakdown({ scores }: Props) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
      <h3 className="text-white font-semibold mb-4">Category Breakdown</h3>
      <div className="space-y-4">
        {CATEGORIES.map(({ key, label, icon: Icon, color }) => {
          const score = scores[key]
          const lbl = scoreLabel(score)
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-[#8b949e]" />
                  <span className="text-sm text-[#e6edf3]">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${lbl.cls}`}>{lbl.text}</span>
                  <span className="text-sm font-mono font-bold text-white">{Math.round(score)}</span>
                </div>
              </div>
              <div className="h-2 bg-[#0d1117] rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
