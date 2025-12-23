# Pariksha Sarthi — Deployment Guide

This project deploys best as:
- Frontend (React) on Vercel
- Backend (FastAPI) on Render

The repo already includes:
- frontend/vercel.json (SPA rewrites)
- render.yaml (Render Web Service definition)
- backend/server.py with robust CORS origin parsing

## 1) Backend on Render

1. Create a new Web Service in Render
   - Connect this repository
   - Render will detect `render.yaml` at the repo root
   - Select the service named `pariksha-sarthi-backend`

2. Environment Variables (Render → Service → Environment)
   - `MONGO_URL` = your MongoDB Atlas SRV connection string
   - `DB_NAME` = pariksha_sarthi (or your chosen DB)
   - `JWT_SECRET_KEY` = a strong random string
   - `CORS_ORIGINS` = https://your-frontend.vercel.app,https://your-preview.vercel.app

3. Build & Start
   - Build: `pip install --upgrade pip && pip install -r backend/requirements.txt`
   - Start: `uvicorn backend.server:app --host 0.0.0.0 --port $PORT`
   - Health check path: `/health`

4. Mongo Atlas Access
   - In MongoDB Atlas, allow the Render egress (dev: "Allow from anywhere"). Tighten later.

## 2) Frontend on Vercel

1. Create New Project → Import this repo
2. Set Project Root to `frontend`
3. Build Settings
   - Build Command: `npm ci && npm run build`
   - Output Directory: `build`
4. Environment Variables
   - `REACT_APP_BACKEND_URL` = https://your-backend.onrender.com

Vercel will detect `frontend/vercel.json` and handle SPA rewrites for client routing.

## 3) CORS and Base URLs

- Backend merges localhost defaults with any provided `CORS_ORIGINS`.
- Because `allow_credentials` is true, use explicit origins (no `*`).
- Frontend uses `REACT_APP_BACKEND_URL` → axios base becomes `${REACT_APP_BACKEND_URL}/api`.

## 4) Quick Verification

- Backend: open `https://<render-service>/health` → `{ "status": "ok" }`
- Frontend: open `https://<vercel-app>/` → login → navigate dashboards
- Check Network tab → requests target `https://<render-service>/api/*` with 200 responses
- Create/Edit exams, download Excel/CSV, calendar events appear

## 5) Local sanity checks

```bash
# Backend (terminal 1)
python -m venv .venv && .venv\\Scripts\\activate
pip install -r backend/requirements.txt
set MONGO_URL="<atlas-srv>"
set DB_NAME=pariksha_sarthi
set JWT_SECRET_KEY="<secret>"
uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload

# Frontend (terminal 2)
cd frontend
npm ci
set REACT_APP_BACKEND_URL=http://localhost:8000
npm run start
```

## 6) Troubleshooting

- 401 on requests: JWT expired or missing; re-login.
- CORS error: Add the exact Vercel domain to `CORS_ORIGINS` (comma-separated) in Render.
- 500 at startup: Ensure `backend/static/` exists (it does in this repo) and `.env` variables are set.
- CSV/Excel download fails: Verify `openpyxl` installed (included in requirements) and the route permissions.

---
For automated provisioning, use Render Blueprints (render.yaml) and Vercel Project settings with the variables above.
