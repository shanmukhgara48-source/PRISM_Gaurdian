import { useState } from 'react'
import { Search, GitPullRequest, Shield } from 'lucide-react'

interface Props {
  onScan: (url: string) => void
  onPRReview: (url: string) => void
  isLoading: boolean
}

export default function ScanInput({ onScan, onPRReview, isLoading }: Props) {
  const [tab, setTab] = useState<'repo' | 'pr'>('repo')
  const [url, setUrl] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    if (tab === 'repo') onScan(url.trim())
    else onPRReview(url.trim())
  }

  return (
    <div className="max-w-2xl mx-auto mt-20 px-4">
      {/* Logo */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold text-white">PRISM <span className="text-blue-400">Guardian</span></h1>
        </div>
        <p className="text-[#8b949e] text-lg">Autonomous Pull Request Risk Engine</p>
        <p className="text-[#484f58] text-sm mt-1">Detects real issues · Filters noise · Predicts production risk</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#161b22] rounded-lg border border-[#30363d] mb-4">
        <button
          onClick={() => { setTab('repo'); setUrl('') }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
            tab === 'repo' ? 'bg-blue-600 text-white' : 'text-[#8b949e] hover:text-white'
          }`}
        >
          <Search className="w-4 h-4" />
          Repository Scan
        </button>
        <button
          onClick={() => { setTab('pr'); setUrl('') }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
            tab === 'pr' ? 'bg-blue-600 text-white' : 'text-[#8b949e] hover:text-white'
          }`}
        >
          <GitPullRequest className="w-4 h-4" />
          PR Review
        </button>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
        <label className="block text-sm text-[#8b949e] mb-2">
          {tab === 'repo' ? 'GitHub Repository URL' : 'GitHub Pull Request URL'}
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              tab === 'repo'
                ? 'https://github.com/owner/repo'
                : 'https://github.com/owner/repo/pull/123'
            }
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-white placeholder-[#484f58] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            required
          />
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                {tab === 'repo' ? 'Scan' : 'Review'}
              </>
            )}
          </button>
        </div>
        <p className="text-[#484f58] text-xs mt-3">
          Only public repositories are supported without a GitHub token.
        </p>
      </form>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-2 mt-6 justify-center">
        {['Bandit Security', 'Pylint Quality', 'Radon Complexity', 'AI Validation', 'Auto-Fix', 'Live Streaming'].map(f => (
          <span key={f} className="px-3 py-1 rounded-full bg-[#161b22] border border-[#30363d] text-[#8b949e] text-xs">
            {f}
          </span>
        ))}
      </div>
    </div>
  )
}
