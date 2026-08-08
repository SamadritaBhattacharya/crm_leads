# Tech Spec — Alliance Australia Property: Leads CRM

**Companion to:** PRD.md, SYSTEM_ARCHITECTURE.md, ENGINEERING_RULES_AND_GOALS.md
**Purpose:** implementation-ready contracts. No code, but nothing here should require re-deriving a decision.

---

## 1. Stack (final)

| Layer | Choice |
|---|---|
| Frontend (this repo — CRM dashboard only, no public pages) | Next.js (App Router), Tailwind CSS, Recharts (dashboard charts), Lucide React (icons) |
| Lead-capture forms | **Not part of this repo** — external, separately maintained site. Integrates against `POST /api/leads` only (§4.1). |
| Frontend state | RTK Query (server state) + Zod (validation, generated from backend OpenAPI) |
| Backend | FastAPI + Uvicorn (Gunicorn-managed workers in prod) |
| ORM | SQLAlchemy 2.0 (async) + `asyncpg` |
| Migrations | Alembic |
| Validation | Pydantic v2 |
| Database | Supabase (managed Postgres) |
| Live updates | Supabase Realtime (Postgres Changes / WAL), consumed via Supabase JS client — Next.js side only |
| Auth (staff) | `python-jose` (JWT) + `passlib[bcrypt]` |
| Auth (Realtime channel) | Supabase-issued token + RLS — independent of the JWT above |
| Rate limiting | `slowapi`, per-IP, on the public endpoint |
| Email | `fastapi-mail` or `smtplib`, dispatched via `BackgroundTasks` |
| Frontend ↔ backend contract | FastAPI OpenAPI → `openapi-typescript` → TS types consumed by Zod/RTK Query |

---

## 2. Enums (source of truth)

```python
class LeadSource(str, Enum):
    hero_quote_form = "hero_quote_form"
    cta_quote_form = "cta_quote_form"
    residential_valuation = "residential_valuation"
    commercial_valuation = "commercial_valuation"
    rural_valuation = "rural_valuation"
    manual_entry = "manual_entry"          # added 0003 — staff-entered leads
    google = "google"                      # added 0004

class LeadStatus(str, Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    converted = "converted"
    lost = "lost"

class AdminRole(str, Enum):
    admin = "admin"
    staff = "staff"

class Company(str, Enum):                  # added 0004
    app = "AAP"
    cpv = "CPV"
    tamn = "TAMN"

class SurveyType(str, Enum):                # added 0004
    inspection = "Inspection"
    external_desktop_valuation = "External / Desktop Valuation"
    kerbside_valuation = "Kerbside Valuation"
```

**Valid status transitions** (enforced in `domain/rules.py`):

```
new → contacted → qualified → converted
                            → lost
contacted → lost
qualified → lost
```

No transition out of `converted`/`lost` in v1 — reopening a closed lead is not a specified requirement.

---

## 3. Database DDL

```sql
CREATE TYPE lead_source AS ENUM (
    'hero_quote_form', 'cta_quote_form', 'residential_valuation',
    'commercial_valuation', 'rural_valuation'
);
-- ALTER TYPE lead_source ADD VALUE 'manual_entry';  -- migration 0003
-- ALTER TYPE lead_source ADD VALUE 'google';        -- migration 0004

CREATE TYPE lead_status AS ENUM (
    'new', 'contacted', 'qualified', 'converted', 'lost'
);

-- Added migration 0004, alongside the leads columns below
CREATE TYPE company AS ENUM ('APP', 'CPV', 'TAMN');
CREATE TYPE survey_type AS ENUM (
    'Inspection', 'External / Desktop Valuation', 'Kerbside Valuation'
);

CREATE TABLE leads (
    id                BIGSERIAL PRIMARY KEY,
    source            lead_source NOT NULL,
    first_name        VARCHAR(100),
    last_name         VARCHAR(100),
    email             VARCHAR(255) NOT NULL,
    phone             VARCHAR(50),
    property_address  TEXT,
    property_type     VARCHAR(100),
    purpose           VARCHAR(100),
    status            lead_status NOT NULL DEFAULT 'new',
    assigned_to       VARCHAR(100),
    page_url          VARCHAR(500),
    ip_address        VARCHAR(45),
    company           company,              -- added 0004
    amount            NUMERIC(12, 2),       -- added 0004
    date_of_valuation DATE,                 -- added 0004
    file_no           VARCHAR(100),         -- added 0004
    survey_type       survey_type,          -- added 0004
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);

CREATE TABLE lead_notes (
    id          BIGSERIAL PRIMARY KEY,
    lead_id     BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    author      VARCHAR(100) NOT NULL,
    note        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_notes_lead_id ON lead_notes(lead_id);

CREATE TABLE admin_users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Materialized view backing the Recharts dashboard
CREATE MATERIALIZED VIEW mv_monthly_rollup AS
SELECT
  date_trunc('month', created_at) AS month,
  property_type,
  purpose,
  survey_type,                          -- added 0005
  count(*) AS total,
  count(*) FILTER (WHERE status = 'converted') AS converted_count
FROM leads
GROUP BY 1, 2, 3, 4;

-- Required for Supabase Realtime to emit change events for this table.
-- Own Alembic migration as raw SQL (no ORM equivalent) — see Engineering Rules §4.
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
```

RLS is enabled on `leads` and `lead_notes` (policy detail is an open decision — §6).

---

## 4. API surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/leads` | none (public, rate-limited) | Create a lead — called by the **external, separately maintained** lead-capture site. Treat as a versioned public contract (Engineering Rules §1c). |
| `POST` | `/api/auth/login` | none | Staff login → JWT |
| `POST` | `/api/auth/refresh` | refresh token | New access token |
| `GET` | `/api/leads` | JWT | List/filter/paginate |
| `GET` | `/api/leads/{id}` | JWT | Detail + notes |
| `PATCH` | `/api/leads/{id}` | JWT | Update status / assignment |
| `POST` | `/api/leads/{id}/notes` | JWT | Add a note |
| `DELETE` | `/api/leads/{id}` | JWT, admin role | Remove a lead |
| `GET` | `/api/leads/export` | JWT | CSV of filtered view |
| `GET` | `/api/dashboard/monthly?month=YYYY-MM` | JWT | Rollup data for Recharts |

No `/ws/leads` route — live updates go through Supabase Realtime directly from Next.js.

### 4.1 `POST /api/leads` — external contract, share this exact shape with the lead-capture repo's team

```json
// Request
{
  "source": "residential_valuation",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@example.com",
  "phone": "0412345678",
  "property_address": "12 Example St, Sydney NSW",
  "property_type": "residential",
  "purpose": "sale",
  "page_url": "https://the-marketing-site.example.com/valuation/residential",
  "honeypot": ""
}

// 201
{ "success": true, "lead_id": 482 }

// Honeypot populated → 200, no visible row created
{ "success": true, "lead_id": null }

// 422 — validation failure · 429 — rate limited
```

`page_url` is whatever URL the external site chooses to send — we store it as-is and don't validate its domain. `source` values are fixed to the `LeadSource` enum (§2); if the external site adds a 6th form type, that's a coordinated change on both sides, not something they can send freely.

### 4.2 `POST /api/auth/login`

```json
{ "username": "staff1", "password": "..." }
// 200 → { "access_token": "...", "refresh_token": "...", "token_type": "bearer" }
// 401 — invalid credentials
```

### 4.3 `GET /api/leads?status=new&source=residential_valuation&page=1&page_size=25`

```json
{
  "items": [ /* LeadOut[] */ ],
  "total": 132,
  "page": 1,
  "page_size": 25
}
```

Query params: `status`, `source`, `date_from`, `date_to`, `assigned_to`, `search`, `page`, `page_size`.

### 4.4 `GET /api/leads/{id}`

```json
{ /* LeadOut fields */, "notes": [ { "id": 5, "author": "staff1", "note": "...", "created_at": "..." } ] }
// 404
```

### 4.5 `PATCH /api/leads/{id}`

```json
{ "status": "contacted", "assigned_to": "staff1" }
// 200 — updated LeadOut · 409 — invalid status transition
```

Any other `LeadUpdate` field (§5) may be included in the same request for a
full-record edit — e.g. `{ "company": "AAP", "amount": 1500, "file_no": "F-001" }`.
Only `status` changes are subject to the transition rules (§2); everything
else is a plain field overwrite.

Plain `UPDATE` — Supabase Realtime picks it up automatically. No additional code needed to make this "live."

### 4.6 `POST /api/leads/{id}/notes`

```json
{ "author": "staff1", "note": "Sent quote by email" }
// 201 — created note object
```

### 4.7 `DELETE /api/leads/{id}`

Admin only → `204`. Non-admin → `403`.

### 4.8 `GET /api/leads/export?status=new`

`200`, `Content-Type: text/csv`, streamed.

### 4.9 `GET /api/dashboard/monthly?month=2026-07`

```json
{
  "total_valuations": 33,
  "completed_inspections": 15,
  "by_property_type": [ { "type": "Residential", "count": 26 }, ... ],
  "by_purpose": [ { "purpose": "Capital Gains Tax", "count": 14 }, ... ],
  "by_survey_type": [ { "survey_type": "Inspection", "count": 21 }, ... ]
}
```

### 4.10 `GET /api/dashboard/yearly?fy=2025`

Australian financial year, July→June — `fy=2025` is July 2025 – June 2026.
`by_month` always carries twelve entries in FY order, zero-filled, so the chart
axis never shortens on a quiet month.

```json
{
  "fy_start_year": 2025,
  "fy_label": "FY 2025–26",
  "total_valuations": 412,
  "completed_inspections": 168,
  "conversion_rate": 40.8,
  "busiest_month": "Mar 2026",
  "by_month": [ { "month": "2025-07", "label": "Jul 25", "total": 38, "converted": 15 }, ... ],
  "by_property_type": [ { "type": "Residential", "count": 260 }, ... ],
  "by_purpose": [ { "purpose": "Capital Gains Tax", "count": 96 }, ... ],
  "by_survey_type": [ { "survey_type": "Inspection", "count": 240 }, ... ]
}
```

---

## 5. Pydantic schemas

```python
class LeadCreate(BaseModel):
    source: LeadSource
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr
    phone: str | None = None
    property_address: str | None = None
    property_type: str | None = None
    purpose: str | None = None
    page_url: str | None = None
    honeypot: str | None = None

class LeadOut(BaseModel):
    id: int
    source: LeadSource
    first_name: str | None
    last_name: str | None
    email: str
    phone: str | None
    property_address: str | None
    property_type: str | None
    purpose: str | None
    status: LeadStatus
    assigned_to: str | None
    created_at: datetime
    updated_at: datetime
    company: Company | None            # added 0004
    amount: float | None                # added 0004
    date_of_valuation: date | None      # added 0004
    file_no: str | None                 # added 0004
    survey_type: SurveyType | None      # added 0004

class LeadUpdate(BaseModel):
    """PATCH /api/leads/{id} — every field optional; only fields present in
    the request are applied. `status`/`assigned_to` are the only fields with
    historical significance (status transition rules, §2); the rest are a
    plain full-record edit, added 0004 to match the CRM detail view's edit
    form."""

    status: LeadStatus | None = None
    assigned_to: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    property_address: str | None = None
    property_type: str | None = None
    purpose: str | None = None
    source: LeadSource | None = None
    company: Company | None = None
    amount: float | None = None
    date_of_valuation: date | None = None
    file_no: str | None = None
    survey_type: SurveyType | None = None

class LeadNoteCreate(BaseModel):
    note: str
    author: str
```

---

## 6. Open decisions

1. **RLS identity mapping — how does a FastAPI-authenticated staff session become a Supabase-authenticated session for Realtime?**
   - (a) Staff also authenticate with Supabase Auth directly (separate from `admin_users`), RLS keys off `auth.uid()`. Adds a second identity system.
   - (b) FastAPI issues a short-lived, scoped Supabase-compatible token (signed JWT with a custom claim Supabase's RLS can inspect), no separate Supabase Auth login. Keeps `admin_users` the single identity source.
   **Recommendation: (b).** Needs a design spike before M3 (System Architecture §5) — not an assumption baked into code.

2. **JWT storage model** — HttpOnly cookie (simpler CSRF story with Next.js middleware) vs. bearer token in memory/header (typical SPA pattern, needed if the frontend and backend end up on fully separate domains with strict cookie policies). **Recommendation: HttpOnly cookie**, set by a Next.js API route that proxies the login call, since Next.js and FastAPI are cross-origin.

3. **Materialized view refresh strategy** — trigger-based refresh on every `leads` write (real-time-accurate dashboard, more write overhead) vs. scheduled refresh every N minutes (cheaper, slightly stale). **Recommendation: trigger-based**, given the PRD's success metric that dashboard figures must never drift from the underlying table.

---

## 7. Explicitly out of scope

- Any external site integration — this is a standalone, greenfield application.
- Lead → Job promotion into any future case-tracking system — schema kept compatible, not built.
- SMS, lead scoring, third-party CRM sync, consultant billing/payouts.
