# NASA Space Apps 2025 — StellarCanvas

## Run
1) `cp .env.example .env.local` and confirm `NEXT_PUBLIC_BACKEND_URL` matches your FastAPI host
2) `python3 -m venv .venv && source .venv/bin/activate`
3) `pip install -r backend/requirements.txt`
4) `uvicorn backend.main:app --reload`
5) In a new terminal: `npm install`
6) `npm run dev` → http://localhost:3000

## Stack
- Next.js + TypeScript + Tailwind
- OpenSeadragon deep-zoom viewer
- FastAPI proxy for NASA GIBS imagery
