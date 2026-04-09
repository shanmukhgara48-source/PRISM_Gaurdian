const BASE = "http://localhost:8000";

export async function startScan(repoUrl: string): Promise<string> {
  const res = await fetch(`${BASE}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_url: repoUrl }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Scan failed: ${res.status} — ${text}`);
  }
  const data = await res.json();
  return data.scan_id as string;
}

export async function fetchResult(scanId: string) {
  const res = await fetch(`${BASE}/api/scan/${scanId}`);
  if (!res.ok) throw new Error(`Result fetch failed: ${res.status}`);
  return res.json();
}

export function openStream(scanId: string): EventSource {
  return new EventSource(`${BASE}/api/stream/${scanId}`);
}
