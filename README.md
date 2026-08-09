# CRM Leads

CRM + AI + Data

A leads CRM for Leads Property: a public lead-capture API, an authenticated staff dashboard for managing leads, and analytics on valuation activity. Built with a **FastAPI** backend and a **Next.js** frontend, backed by **Postgres (Supabase)**.

This repo owns the CRM only — the marketing site's lead-capture forms live in a separate repo and integrate against `POST /api/leads` as a versioned public contract.

## Features

### Public lead capture

- `POST /api/leads` — unauthenticated, rate-limited endpoint that any external site can submit leads to.
- Honeypot field support — spam submissions are silently dropped while still returning a success response.
- Per-IP rate limiting on the public endpoint.
- Scoped CORS: the public endpoint and the authenticated dashboard each have independent origin allow-lists.
- New-lead email notification to staff, sent as a background task so it never blocks the response.

### Staff CRM dashboard (authenticated)

- Login via email/password (JWT) or Firebase Authentication, with access + refresh tokens.
- Leads table with server-side pagination, sorting, and multi-select filtering by status, source, company, property type, purpose, survey type, assignee, file number, amount, and date range, plus free-text search.
- Lead detail view with full record and a chronological notes thread.
- Status pipeline with enforced transitions (`new → contacted → qualified → converted/lost`).
- Manual lead entry for phone-in/walk-in leads.
- Bulk import leads from an Excel/CSV file, with a downloadable template and per-row validation.
- Edit any lead field (contact info, property details, company, valuation amount, file number, survey type).
- CSV export of the current filtered view.
- Admin-only lead deletion.
- Editable staff profile (display name).

### Analytics dashboard

- Monthly rollup: total valuations, completed inspections, breakdowns by property type, purpose, and survey type.
- Financial-year overview (Australian FY, July–June): 12-month volume chart, conversion rate, and busiest month, backed by a Postgres materialized view so figures never drift from the underlying data.
- Charts built with Recharts (bar and donut breakdowns).

### Live updates

- The leads table and dashboard update in real time across every open staff session via Supabase Realtime (Postgres WAL), with no polling and no custom WebSocket server.

## Tech stack

| Layer               | Choice                                                                             |
| ------------------- | ---------------------------------------------------------------------------------- |
| Frontend            | Next.js (App Router), TypeScript, Tailwind CSS, Radix UI, TanStack Table, Recharts |
| Frontend state/data | Redux Toolkit, Zod, Supabase JS client (Realtime)                                  |
| Backend             | FastAPI, Uvicorn                                                                   |
| ORM / migrations    | SQLAlchemy 2.0 (async) + asyncpg, Alembic                                          |
| Validation          | Pydantic v2                                                                        |
| Database            | PostgreSQL (Supabase)                                                              |
| Auth                | JWT (`python-jose` + `passlib`) and/or Firebase Authentication                 |
| Rate limiting       | `slowapi`                                                                        |

## Project structure

```
backend/
├── app/
│   ├── domain/       # framework-free models, repository interfaces, business rules
│   ├── services/      # lead, auth, firebase-auth, notification services
│   ├── infra/         # SQLAlchemy models + repository implementations
│   ├── routers/        # leads_public, leads_admin, auth
│   ├── security/       # JWT, password hashing, CORS, rate limiting, auth deps
│   └── schemas/         # Pydantic request/response models
├── alembic/versions/     # DB migrations
└── tests/                # unit (no DB) + integration tests

frontend/
├── app/                  # Next.js App Router pages (dashboard, leads, login, signup)
├── components/           # leads table, dashboard charts, Excel import/export, UI primitives
└── lib/                  # API client, auth, Firebase, Supabase realtime, Zod schemas
```

## Getting started

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows
pip install -r requirements-dev.txt

copy .env.example .env             # fill in DATABASE_URL, JWT_SECRET, etc.
alembic upgrade head
python scripts/create_admin_user.py --username admin --email admin@example.com --password "ChangeMe123!" --role admin

uvicorn app.main:app --reload --port 8000
```

API docs are served at `http://127.0.0.1:8000/docs`. See [backend/Setup_guide.md](backend/Setup_guide.md) for detailed setup, including local Postgres via Docker and Firebase Admin SDK configuration.

### Frontend

```bash
cd frontend
npm install
copy .env.example .env.local       # set NEXT_PUBLIC_API_URL, disable mock mode
npm run dev
```

The frontend can run against mock data (`NEXT_PUBLIC_USE_MOCK=true`) without a backend, or against the live FastAPI server.

### Tests

```bash
cd backend
pytest -q --cov=app.domain --cov=app.services --cov-report=term-missing
```

## Security notes

- Never commit `.env` files or the Firebase Admin SDK service account JSON — both are gitignored.
- The public `/api/leads` endpoint and the authenticated dashboard use independent CORS allow-lists; only add origins you control.
- Realtime subscriptions are gated by Supabase Row Level Security, a trust boundary independent of the FastAPI JWT — see [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) §5.

## Documentation

- [PRD.md](PRD.md) — product requirements
- [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) — architecture, trust boundaries, data flow
- [TECH_SPEC.md](TECH_SPEC.md) — API contracts, schemas, database DDL
- [backend/Setup_guide.md](backend/Setup_guide.md) — local backend setup walkthrough
