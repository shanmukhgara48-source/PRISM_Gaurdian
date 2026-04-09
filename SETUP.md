# PRISM Guardian AI — Setup Guide

## Prerequisites
- Python 3.14+ with pip
- Node.js 18+
- Git

## 1. Configure API Key

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set your ANTHROPIC_API_KEY
```

## 2. Install Backend Dependencies

```bash
cd backend
python3.14 -m pip install -r requirements.txt
```

## 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

## 4. Start the Application

```bash
# From /Prism root
./start.sh
```

Or start manually:

```bash
# Terminal 1 — Backend
cd backend
python3.14 -m uvicorn main:app --port 8000 --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:5173**

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/scan | Start a repo scan |
| GET | /api/scan/{id} | Get scan results |
| GET | /api/stream/{id} | SSE live stream |
| POST | /api/pr-review | Start a PR review |
| POST | /api/explain | AI explanation for a finding |
| GET | /health | Health check |

Interactive docs: **http://localhost:8000/docs**

## Demo Flow

1. Open http://localhost:5173
2. Paste a public GitHub repo URL (e.g. `https://github.com/pallets/flask`)
3. Click **Scan** — live streaming panel activates
4. Watch Bandit/Pylint/Radon run in real time
5. View dashboard: health score, risk verdict, findings table
6. Click any row to expand — shows AI-generated fix suggestion
7. Click **Explain with AI** for a full contextual explanation
8. Check the Hotspots panel for the riskiest files

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for LLM validation |
| `GITHUB_TOKEN` | No | For scanning private repos / higher rate limits |
