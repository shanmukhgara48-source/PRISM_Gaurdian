import httpx
import json
import re

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "llama3"


async def validate_findings_batch(findings: list) -> list:
    if not findings:
        return findings

    try:
        findings_json = json.dumps(findings, indent=2)
    except (TypeError, ValueError) as e:
        print(f"[LLM Serialize Error] {e}")
        return findings

    prompt = f"""You are a strict code security reviewer.

Analyze the following code findings and return ONLY a valid JSON array — no explanation, no markdown, no extra text.

Each object in the array must match this exact shape:
{{
  "is_valid": true or false,
  "confidence": a float between 0.0 and 1.0,
  "explanation": "one sentence explaining the finding",
  "fix": "one sentence describing the fix"
}}

The array must have exactly {len(findings)} entries, one per finding, in the same order.

Findings:
{findings_json}

Respond with ONLY the JSON array. No other text."""

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(
                OLLAMA_URL,
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            res.raise_for_status()

        raw = res.json().get("response", "").strip()

        # Extract JSON array even if the model wraps it in prose
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not match:
            print("[LLM Parse Error] no JSON array found in response")
            return findings

        parsed = json.loads(match.group())

        if not isinstance(parsed, list):
            print("[LLM Parse Error] parsed result is not a list")
            return findings

        for i, finding in enumerate(findings):
            if i < len(parsed):
                item = parsed[i]
                finding["is_valid"] = bool(item.get("is_valid", True))
                finding["confidence"] = float(item.get("confidence", 0.8))
                finding["explanation"] = str(item.get("explanation", ""))
                finding["fix"] = str(item.get("fix", ""))

        return findings

    except Exception as e:
        print(f"[LLM Error] {e}")
        return findings


async def get_code_context(file_path: str, line_number: int, context: int = 5) -> str:
    try:
        with open(file_path, "r", errors="replace") as f:
            lines = f.readlines()

        start = max(0, line_number - context - 1)
        end = min(len(lines), line_number + context)

        return "".join(lines[start:end])

    except Exception as e:
        print(f"[Context Error] {e}")
        return ""


async def generate_explanation(finding: dict, code_context: str = "") -> str:
    context_block = f"\n\nCode context:\n{code_context}" if code_context else ""
    prompt = f"""Explain this code security finding clearly and provide a concrete fix.

Finding:
{json.dumps(finding, indent=2)}{context_block}

Be concise: 2-3 sentences max."""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(
                OLLAMA_URL,
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            res.raise_for_status()
        return res.json().get("response", "").strip()

    except Exception as e:
        print(f"[Explain Error] {e}")
        return "Explanation unavailable"
