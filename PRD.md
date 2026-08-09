# PRD —  Leads Property: Leads CRM (v1)

**Owner:** Principal Staff Engineer
**Status:** Final v1
**Last updated:** 2026-07-16

---

## 1. Problem

 Leads Property needs a system to receive property valuation leads (residential, commercial, rural, plus general quote requests) and let staff work them — see them arrive live, filter, assign, note, and move through a status pipeline.

**This repo is the CRM only** — a FastAPI backend + a Next.js staff dashboard. **The lead-capture forms themselves live in a separate, independently maintained website/repo, outside this project entirely.** That other codebase's stack, deploy pipeline, and release cycle are not ours to control or assume. Our responsibility ends at, and starts from, a versioned public API contract: `POST /api/leads`. Anything upstream of that call is someone else's system.

## 2. Goal

1. **Receive** — a public, unauthenticated API endpoint (`POST /api/leads`) that the external site integrates against, documented as a stable contract (see Tech Spec §4.1).
2. **Persist** — leads land in a dedicated Postgres database (Supabase).
3. **Notify** — staff get an email the moment a lead arrives.
4. **Manage** — an authenticated CRM view (Next.js) lets staff list, filter, search, view, note, and update lead status.
5. **Visualize** — a dashboard (Recharts) shows monthly rollups: total valuations, completed inspections, breakdowns by property type and purpose.
6. **Live** — the CRM table and dashboard update in real time across every open staff session, with no manual refresh, without a custom WebSocket server.

## 3. Non-goals (v1)

- **Building, hosting, or maintaining the lead-capture forms.** They exist in a separate repo/website. We provide and document the API they call; we do not own their UI, their validation UX, or their deploy.
- Automatic lead → job conversion (schema kept compatible, not built).
- SMS notifications, lead scoring, third-party CRM sync (Salesforce/HubSpot).
- Multi-tier valuation billing workflow (invoicing, consultant payouts) — out of scope for this leads-focused v1. If needed later, it's a new PRD against the same `leads` table.

## 4. Users

| Role | Can do |
|---|---|
| `staff` | List/filter/view leads, add notes, update status, assign leads, export CSV, view dashboard |
| `admin` | Everything `staff` can, plus delete a lead (e.g. spam) |

Two roles only in v1 — matches `admin_users.role`.

## 5. Data model

```
Lead
├── id (bigserial)
├── source (enum: hero_quote_form | cta_quote_form | residential_valuation
│                | commercial_valuation | rural_valuation)
├── first_name, last_name (nullable)
├── email (required)
├── phone (nullable)
├── property_address, property_type, purpose (nullable)
├── status (enum: new | contacted | qualified | converted | lost)
├── assigned_to (nullable, staff username)
├── page_url, ip_address (capture context)
├── created_at, updated_at

LeadNote
├── id, lead_id (FK), author, note, created_at

AdminUser
├── id, username, email, hashed_password, role (admin|staff), created_at
```

No billing/invoicing fields in v1 — this is deliberately a narrow, leads-focused schema.

## 6. Functional requirements

### 6.1 Public lead-capture API (contract with an external repo)

- `POST /api/leads` is the entire integration surface with the external lead-capture site. We do not control what calls it, only what it accepts and returns.
- Server-side Pydantic validation is the *only* validation this system can rely on — the calling site's client-side validation, if any, is invisible to us and not something we can assume exists or is correct.
- Honeypot field — if populated, backend responds as if successful but silently drops the row. (Whether the external site actually implements a honeypot UI is out of our control; the field is optional and ignored if absent.)
- Rate-limited per IP on the backend, since the external site is a black box to us and could itself be compromised or misconfigured.
- CORS on the FastAPI backend allows only the external site's known origin(s) — coordinated with whoever owns that repo, not assumed.
- The request/response shape (Tech Spec §4.1) is treated as a **versioned public contract**. Breaking changes require coordinating with the external repo's maintainers before deploy, not after.

### 6.2 Staff CRM (Next.js, authenticated)

- Login → JWT.
- Leads table: filter by `status`, `source`, date range, `assigned_to`, free-text search; server-paginated.
- Lead detail view/drawer: full record + notes, chronological.
- Update status / reassign.
- Add a note.
- Delete a lead — admin only.
- CSV export of the current filtered view.

### 6.3 Dashboard (Next.js + Recharts)

- Month selector.
- KPI tiles: Total Valuations, Completed Inspections.
- Charts: Valuation Types breakdown (bar), Purpose of Valuation breakdown (bar).
- Driven by a Postgres materialized view refreshed on write — not client-side aggregation.

### 6.4 Live updates

- The leads table and dashboard reflect new leads and status changes across every open staff session, without polling, without a custom WebSocket server.
- Mechanism: the Next.js frontend uses the Supabase JS client to subscribe directly to the `leads` table's Realtime (WAL) stream. FastAPI's only job is writing correctly to Postgres.
- Scales horizontally for free — fan-out happens at the database layer, independent of how many FastAPI instances are running.

### 6.5 Security-critical requirement

Realtime subscriptions authenticate via Supabase's own token + Row Level Security — **not** FastAPI's JWT. This is a second, independent trust boundary. RLS policies on `leads`/`lead_notes` must restrict the Realtime channel to authenticated staff only, or the Supabase anon key becomes a full data leak. Hard launch blocker (§9).

## 7. Non-functional requirements

| NFR | Target |
|---|---|
| Public endpoint P95 latency | < 300 ms |
| Realtime propagation (write → dashboard) | < 1 s |
| Rate limit on `/api/leads` | e.g. 10 req/min/IP, tunable |
| Availability | 99.9% monthly |
| Data at rest | Encrypted (Supabase-managed) |
| PII in logs | Never logged in plaintext |
| Frontend bundle | ≤ 250 KB gzipped initial JS |

## 8. Success metrics

- 100% of form submissions land in `leads` with zero silent drops (excluding honeypot catches).
- Staff sees a new lead in the CRM within 1 second of submission, without refreshing.
- Dashboard figures match the underlying `leads` table exactly, always (no stale-cache drift).

## 9. Launch blockers

1. **RLS policy for `leads`/`lead_notes`** — written, reviewed, tested against the anon key before any staff access.
2. **CORS origin(s) for the external lead-capture site confirmed with its maintainers** — cannot be guessed or left as a wildcard.
3. **`POST /api/leads` contract published and shared with the external repo's team** before they build against it — field names, required vs. optional, response shape, error codes. A mismatch here is a silent lead-loss bug, not a visible one.
4. **Auth token storage model** — HttpOnly cookie vs. bearer header for the CRM dashboard's own JWT (Tech Spec §6) — internal to this repo, unrelated to the external site.

## 10. Milestones

| # | Milestone | Exit criteria |
|---|---|---|
| M0 | Foundations | Repo, Supabase project, Alembic baseline (incl. `ALTER PUBLICATION`), staging env. |
| M1 | Public capture API | `POST /api/leads` live and documented; honeypot + rate-limit tested; contract shared with the external repo's team so they can integrate. |
| M2 | Staff auth + CRUD API | Login, list/filter/detail/update/notes/delete working end-to-end. |
| M3 | Realtime dashboard | RLS policy tested; two staff browsers see each other's changes < 1 s. |
| M4 | Dashboard charts | Recharts KPI tiles + breakdowns wired to the materialized view. |
| M5 | Hardening + integration verification | Load test public endpoint; RLS runbook; on-call handoff; confirm the external site's live integration against staging before go-live. |

## 11. Explicitly deferred

- Lead → Job promotion into any future case-tracking system — schema kept compatible, not built.
