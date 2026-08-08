// When USE_MOCK is off, send FastAPI requests through a same-origin Next.js
// proxy (/api/proxy/*) so the HttpOnly access_token cookie attached by
// /api/auth/exchange is forwarded as Authorization: Bearer on every call —
// browsers refuse to send cookies cross-origin, and a CORS/credential setup
// would require the backend to opt in explicitly.
const REAL_BACKEND =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_USE_MOCK === "false" ? "/api/proxy" : REAL_BACKEND;

// `exportLeads` is a CSV stream download — bypass the proxy because the
// browser's blob handling is friendlier with a direct fetch than streaming a
// Response body double-hop through Next.js.
export const DIRECT_BACKEND_URL = REAL_BACKEND;

// Dev-only convenience: renders the full CRM UI against lib/mock/ instead of
// a live FastAPI + Supabase backend. Defaults on so `npm run dev` works out
// of the box; set NEXT_PUBLIC_USE_MOCK=false once the real backend + env is
// configured. Never read inside domain/business logic — it only decides
// which data source the API layer talks to.
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

// Server-only: the real FastAPI backend. Used by Next.js API routes that act
// as an upstream (proxy, /api/auth/me, etc.). Never import this from a
// client-only module — the client should keep using API_BASE_URL so the
// HttpOnly JWT cookie flows same-origin and avoids CORS altogether.
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";
