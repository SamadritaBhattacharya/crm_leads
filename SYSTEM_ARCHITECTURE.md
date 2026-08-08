# System Architecture — Alliance Australia Property: Leads CRM

**Companion to:** PRD.md, ENGINEERING_RULES_AND_GOALS.md, TECH_SPEC.md
**Scope:** greenfield project — Next.js frontend, FastAPI backend, Supabase Postgres. Leads capture + CRM + dashboard. Nothing else.

---

## 1. High-level architecture

**Repo boundary, stated up front:** this repo contains two things — the FastAPI backend and the Next.js **staff CRM dashboard**. It does **not** contain, deploy, or version the lead-capture forms. Those live in a separate, independently owned repo/website, whose stack we don't assume and whose release cycle we don't control. The only thing connecting the two systems is the `POST /api/leads` HTTP contract.

```
┌──────────────────────────────┐
│  External lead-capture site   │   ◄── SEPARATE REPO, separate deploy,
│  (separate repo — stack,      │       stack unspecified/not ours.
│  deploy, and release cycle    │       We do not build or own this.
│  are NOT part of this project)│
└───────────────┬────────────────┘
        │ POST /api/leads (JSON, HTTPS, CORS)
        ▼
┌────────────────────────────────────────┐
│        FastAPI backend (this repo)      │
│  routers → services → domain → infra    │
└───────────────┬──────────────────────────┘
        │ asyncpg
        ▼
┌────────────────────────────────────────┐
│      Supabase (managed Postgres)        │
│  leads · lead_notes · admin_users       │
│  mv_monthly_rollup (dashboard)          │
│  Realtime (WAL → Postgres Changes),     │
│  RLS-gated                              │
└───────────────┬──────────────────────────┘
        │ wss:// (direct, bypasses FastAPI)
        ▼
┌────────────────────────────────────────┐
│   Next.js CRM dashboard (this repo)     │
│   Authenticated only — no public routes │
│   /dashboard, /leads, /leads/[id]       │
│   Tailwind CSS · Recharts · Lucide      │
│   RTK Query · Zod · Supabase JS client  │
└──────────────────────────────────────────┘
```

**Two independent paths, by design:**

- **Writes go through FastAPI.** Every mutation (lead creation from the external site, status update, notes) is validated (Pydantic), authorized where applicable (JWT + role), and persisted (SQLAlchemy) in one place.
- **Live reads bypass FastAPI entirely.** The Next.js CRM dashboard subscribes directly to Supabase Realtime's WAL stream. This is what makes "live" scale for free — adding FastAPI instances never changes how Realtime fans out events, because that fan-out happens outside the app process, at the database layer.

This asymmetry avoids a hand-rolled WebSocket broadcaster, which would only reach clients on the same worker and force a Redis pub/sub layer to fan out across instances. The cost is a second trust boundary (RLS) that must be correct — see §5.

**Why the API contract matters more here than in a single-repo setup:** because the caller of `POST /api/leads` is a codebase we don't control, this endpoint is a genuine public API, not an internal implementation detail we can refactor freely. Treat request/response shape changes with the same discipline as a third-party-facing API — see §7.

---

## 2. Design principles applied (SOLID / OOP)

### Single Responsibility Principle
- `routers/` change when the HTTP contract changes.
- `services/` change when a business rule changes (e.g. status-transition validity).
- `repositories/` change when the persistence mechanism changes.
- `infra/db/orm_models.py` changes when the schema changes.

A `PATCH /api/leads/{id}` handler that also decides whether a status transition is valid is a router doing a service's job — that belongs in `lead_service.py`.

### Open/Closed Principle
`LeadSource` and `LeadStatus` are closed for modification at the call-site level and open for extension via enum + migration. Adding a 6th lead-capture form later is a new enum value and a new Next.js form component — not a rewritten conditional tree in the backend.

### Liskov Substitution Principle
`LeadRepository` is an abstract interface (`domain/repositories.py`). `SQLAlchemyLeadRepository` is the only implementation today, but any future implementation must be swappable without `services/lead_service.py` knowing or caring.

### Interface Segregation Principle
`LeadRepository` exposes only what leads need. `LeadNoteRepository` is separate and narrower — a service that only adds notes never depends on lead-deletion capability it doesn't use.

### Dependency Inversion Principle
```
routers  →  services  →  domain (interfaces)
                              ↑
                         infra (implementations)
```
`domain/` never imports SQLAlchemy, FastAPI, or asyncpg. This is what makes business rules (honeypot handling, status transitions) unit-testable with zero database.

**What this buys us concretely:** the Realtime/RLS trust boundary (§5) is entirely orthogonal to this dependency graph — clean OOP layering inside FastAPI does not secure that boundary; it must be reasoned about and tested separately.

---

## 3. Frontend structure (Next.js — CRM dashboard only, no public routes)

```
apps/web/
├── app/
│   ├── login/page.tsx
│   ├── dashboard/page.tsx              # KPI tiles + Recharts
│   ├── leads/
│   │   ├── page.tsx                    # table view
│   │   └── [id]/page.tsx               # detail drawer/route
│   └── layout.tsx
├── components/
│   ├── table/
│   │   ├── LeadsTable.tsx
│   │   └── columnTypes/                # registry: badge, enum, date, etc.
│   ├── dashboard/
│   │   ├── KpiTile.tsx
│   │   └── charts/                     # Recharts components
│   └── ui/                             # Tailwind + Lucide primitives
├── lib/
│   ├── api/                            # fetch client + typed calls to FastAPI
│   ├── realtime/                       # Supabase client, channel subscribers
│   ├── schemas/                        # Zod schemas (mirrors FastAPI Pydantic)
│   └── auth/
└── styles/
```

Every route in this app requires authentication. There is no public-facing page here — a visitor never lands on this app; only staff do, after login. This is a meaningful simplification versus a mixed public/authenticated app: no honeypot/rate-limit concerns on the frontend, no SEO/marketing-page requirements, no anonymous-user code paths at all.

**Realtime is a client-only concern.** `lib/realtime/` opens the Supabase channel and patches RTK Query's cache (or local state) on inbound events. It never has write access — all mutations go through `lib/api/` to FastAPI.

---

## 4. Backend structure (FastAPI)

```
crm-backend/
├── app/
│   ├── main.py
│   ├── config.py                # DB URL, JWT secret, SMTP, CORS origins (Next.js app URL)
│   ├── domain/
│   │   ├── models.py             # plain dataclasses — no ORM
│   │   ├── repositories.py       # ABCs
│   │   └── rules.py              # status-transition validity, honeypot policy
│   ├── services/
│   │   ├── lead_service.py
│   │   ├── auth_service.py
│   │   └── notification_service.py
│   ├── infra/
│   │   ├── db/
│   │   │   ├── orm_models.py     # SQLAlchemy 2.0 declarative models
│   │   │   ├── session.py        # async engine, pool config
│   │   │   └── mappers.py        # ORM ↔ domain dataclass
│   │   └── repositories/
│   │       ├── sqlalchemy_lead_repo.py
│   │       ├── sqlalchemy_lead_note_repo.py
│   │       └── sqlalchemy_admin_user_repo.py
│   ├── schemas/                  # Pydantic — source of OpenAPI → codegen'd to TS
│   ├── routers/
│   │   ├── leads_public.py       # POST /api/leads
│   │   ├── leads_admin.py        # GET/PATCH/DELETE/export
│   │   └── auth.py
│   └── security/                 # jwt.py, passwords.py, rate_limit.py
├── alembic/
│   └── versions/                 # incl. the ALTER PUBLICATION migration
├── tests/
│   ├── unit/                     # domain + services, no DB
│   └── integration/              # real Postgres in Docker, real RLS
├── requirements.txt
└── .env
```

`domain/rules.py`: honeypot policy and the status state machine are pure functions, zero I/O — the cheapest thing in the system to unit test, and the first thing to break silently if left inline in a router.

---

## 5. The two trust boundaries

| | FastAPI JWT | Supabase RLS |
|---|---|---|
| Protects | `/api/leads/*` mutation endpoints | The Realtime WAL subscription (Next.js → Supabase, direct) |
| Issued by | `auth_service.py` on login | Supabase, scoped by policy |
| Checked by | FastAPI dependency | Postgres, at the row level, per WAL event |
| Bypassed by | N/A | **Nothing** — this is the only thing standing between the anon key and full lead data |

A staff member's browser holds two credentials: the FastAPI JWT (every `PATCH`/`POST`/`DELETE`) and a Supabase-issued token governed by RLS (Realtime channel only). Getting the RLS policy wrong doesn't break a mutation — it silently exposes the live read-stream to anyone holding the Supabase anon key. This is a hard launch blocker (PRD §9), not a nice-to-have — a bug here produces zero errors and a fully "working" product right up until someone points a script at the anon key.

```sql
-- Illustrative — finalized against real auth design, see Tech Spec §6
create policy leads_realtime_staff_only on leads for select
  using (auth.role() = 'authenticated');
```

---

## 6. Data flow — end to end

```
1. Visitor submits a Next.js lead-capture form
2. Client-side Zod validation → fetch POST /api/leads (FastAPI)
3. routers/leads_public.py → Pydantic validates LeadCreate (server-authoritative)
4. services/lead_service.py → domain/rules.py checks honeypot
5. infra/repositories/sqlalchemy_lead_repo.py → INSERT via async SQLAlchemy
6. services/notification_service.py → BackgroundTasks sends staff email
7. Response returned: { success: true, lead_id } → Next.js redirects to /thank-you
   ─────────────────────────────────────────────────────────
8. The INSERT commits → Postgres WAL records it
9. Supabase Realtime reads the WAL, checks RLS, pushes to subscribed browsers
10. lib/realtime/ in the Next.js dashboard receives the event, patches table/dashboard state
    — steps 8–10 involve zero FastAPI code
```

Step 7 and step 9 race — the frontend must not assume its own POST response is what puts a row on the staff dashboard. The row appears via Realtime; the POST response only confirms submission to the visitor.

---

## 7. Type-sharing strategy (Python backend ↔ TypeScript frontend)

For **this repo's own frontend** (the CRM dashboard, which we control): FastAPI's auto-generated OpenAPI schema (from Pydantic) → `openapi-typescript` generates the TS types consumed by the Zod schemas and API client. CI step: any PR changing a Pydantic model used by the CRM dashboard must regenerate TS types in the same PR, or the diff check fails.

**For the external lead-capture repo** (which we don't control): no codegen relationship exists or can exist — we don't own their build pipeline. `LeadCreate` is instead treated as a **versioned public API contract**, documented in Tech Spec §4.1 and communicated out-of-band (shared doc, API changelog, or an OpenAPI spec published for them to consume manually). A field rename or a new required field is a breaking change to a system we cannot see the source of — treat it with the caution of a public API, not an internal refactor.

---

## 8. Deployment topology

- **This repo's Next.js CRM dashboard** on Vercel.
- **FastAPI** as a separate deployed service within this repo's pipeline — e.g. Fly.io, Render, or a container platform.
- The CRM dashboard and FastAPI are cross-origin by default; CORS on FastAPI allows the CRM dashboard's own production + preview origins.
- **Separately, and unrelated to the above:** CORS on FastAPI must also allow the external lead-capture site's origin(s), for `POST /api/leads` specifically. This is a distinct CORS entry, coordinated with that repo's maintainers (PRD §9.2) — not something inferred from our own deploy config.
- Supabase is externally hosted regardless.

---

## 9. Scaling posture

| Concern | v1 posture | Escalation trigger |
|---|---|---|
| FastAPI instances | Single instance, multiple workers | Public endpoint P95 latency creeps under real load |
| Realtime fan-out | Handled entirely by Supabase | N/A — this is the point of the architecture |
| Postgres | Single Supabase instance | Row count / query latency signals |
| Rate limiting | In-process `slowapi`, per-IP | Bot traffic outpaces in-process limiting → Redis-backed limiter |
| Next.js bundle | Route-based code splitting (App Router default) | Bundle budget (250 KB gzip) exceeded |

No message queue, no custom broadcaster, no read replica in v1.
