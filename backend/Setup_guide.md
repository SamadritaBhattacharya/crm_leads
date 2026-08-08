## 1. Python environment

  A venv already exists at backend/.venv from earlier verification, with deps installed. To rebuild from scratch, or on a different machine:

cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
requirements-dev.txt pulls in requirements.txt plus pytest/pytest-asyncio/pytest-cov/httpx. Note: bcrypt is deliberately pinned <4.1 in requirements.txt — passlib 1.7.4's backend self-test crashes on newer bcrypt (found and fixed during this build).

## 2. Configure .env

copy .env.example .env
Generate a real JWT secret rather than leaving the placeholder:

python -c "import secrets; print(secrets.token_urlsafe(48))"
Paste that into JWT_SECRET in .env. Leave DATABASE_URL for step 3.

## 3. Get a Postgres instance

  Pick one:

Option A — real Supabase project (recommended — this is what Realtime/RLS actually need eventually)

Create a free project at supabase.com.
Project Settings → Database → Connection string → URI. Use the direct connection (port 5432), not the pooled/pgbouncer one (port 6543) — DDL from Alembic doesn't play well with transaction-mode pooling.
Rewrite the scheme for asyncpg and put it in .env:

DATABASE_URL=postgresql+asyncpg://postgres:<password></password>@<project-ref></project>.supabase.co:5432/postgres
Supabase projects already have the supabase_realtime publication pre-created, so migration 0002 will apply cleanly.
Option B — local Docker Postgres (faster for pure API testing, but Realtime/RLS won't mean anything here)

docker run --name crm-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=crm -p 5432:5432 -d postgres:16

DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/crm
Vanilla Postgres has no supabase_realtime publication, so migration 0002 (ALTER PUBLICATION supabase_realtime ADD TABLE leads) will fail unless you pre-create a stub:

docker exec -it crm-postgres psql -U postgres -d crm -c "CREATE PUBLICATION supabase_realtime;"

## 4. Run migrations

alembic upgrade head
alembic current    # should show 0003_add_manual_entry_lead_source (head)

## 5. Create your first login

There's no signup route by design — use the bootstrap script I just added:

python scripts/create_admin_user.py --username admin --email admin@example.com --password "ChangeMe123!" --role admin

## 6. Run the dev server

uvicorn app.main:app --reload --port 8000
Open http://127.0.0.1:8000/docs for interactive Swagger UI — fastest way to click through every endpoint by hand.

7. Smoke-test by hand

# Health check

curl http://127.0.0.1:8000/health

# Public lead capture (no auth)

curl -X POST http://127.0.0.1:8000/api/leads -H "Content-Type: application/json" -d "{\"source\":\"residential_valuation\",\"email\":\"jane@example.com\",\"first_name\":\"Jane\"}"

# Login

curl -X POST http://127.0.0.1:8000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"ChangeMe123!\"}"

# → copy the access_token from the response

# Authenticated: list leads

curl http://127.0.0.1:8000/api/leads -H "Authorization: Bearer <access_token>"

# Authenticated: manual lead entry

curl -X POST http://127.0.0.1:8000/api/leads/manual -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" -d "{\"email\":\"phonecall@example.com\",\"first_name\":\"Walk\",\"last_name\":\"In\"}"

# Dashboard rollup for the current month

curl "http://127.0.0.1:8000/api/dashboard/monthly?month=2026-07" -H "Authorization: Bearer <access_token>"
Confirms: public capture works, honeypot/rate-limit are wired, JWT auth actually gates the admin routes, manual entry tags source=manual_entry, dashboard reads from the materialized view.

8. Run the automated test suite

pytest -q
With coverage (the CI-blocking floor is 70% on domain/+services/):

pytest -q --cov=app.domain --cov=app.services --cov-report=term-missing
These are unit tests only (fake in-memory repositories, no DB needed) — they'll pass with or without a live Postgres connection.
