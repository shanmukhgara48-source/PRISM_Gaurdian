import { ScanResult, StreamEvent } from '../types'

const BASE = '/api'

export async function startScan(repoUrl: string): Promise<string> {
  const res = await fetch(`${BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl }),
  })
  if (!res.ok) throw new Error(`Scan failed: ${await res.text()}`)
  const data = await res.json()
  return data.scan_id
}

export async function startPRReview(prUrl: string): Promise<string> {
  const res = await fetch(`${BASE}/pr-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pr_url: prUrl }),
  })
  if (!res.ok) throw new Error(`PR review failed: ${await res.text()}`)
  const data = await res.json()
  return data.scan_id
}

export async function getScanResult(scanId: string): Promise<ScanResult> {
  const res = await fetch(`${BASE}/scan/${scanId}`)
  if (!res.ok) throw new Error(`Failed to fetch results: ${await res.text()}`)
  return res.json()
}

export function streamScan(
  scanId: string,
  onEvent: (e: StreamEvent) => void,
  onDone: () => void,
  onError: (err: string) => void,
): EventSource {
  const es = new EventSource(`${BASE}/stream/${scanId}`)

  es.onmessage = (e) => {
    try {
      const data: StreamEvent = JSON.parse(e.data)
      onEvent(data)
      if (data.event === 'done' || data.event === 'error') {
        es.close()
        if (data.event === 'done') onDone()
        else onError(data.message || 'Unknown error')
      }
    } catch {
      // ignore parse errors (pings)
    }
  }

  es.onerror = () => {
    es.close()
    onError('Stream connection lost')
  }

  return es
}

export async function explainFinding(finding: object, codeContext = ''): Promise<string> {
  const res = await fetch(`${BASE}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finding, code_context: codeContext }),
  })
  if (!res.ok) throw new Error('Explain failed')
  const data = await res.json()
  return data.explanation
}
