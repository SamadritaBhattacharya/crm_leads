"use client";

import type { SessionUser } from "@/lib/schemas/auth";

// TECH_SPEC.md §6.2 — HttpOnly cookie is the recommended storage model for
// the real backend's JWT; that cookie is set server-side and invisible to
// this module. SESSION_COOKIE here only carries the *non-secret* display
// identity (username/role) so the sidebar/middleware can render without a
// round-trip, mirroring what a real "whoami" endpoint would return.
const SESSION_COOKIE = "crm_session";

export function setSession(user: SessionUser) {
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(
    JSON.stringify(user)
  )}; path=/; max-age=${60 * 60 * 8}; SameSite=Lax`;
}

export function clearSession() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

// Cached by raw cookie value so callers using this as a useSyncExternalStore
// snapshot (components/layout/Sidebar.tsx) get a referentially stable
// result when the cookie hasn't changed — otherwise a fresh object on every
// call reads as "always changed" and React errors on an infinite loop.
let lastRaw: string | null = null;
let lastValue: SessionUser | null = null;

export function getSession(): SessionUser | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${SESSION_COOKIE}=`));
  const raw = match?.split("=")[1] ?? null;

  if (raw === lastRaw) return lastValue;
  lastRaw = raw;
  if (!raw) {
    lastValue = null;
    return lastValue;
  }
  try {
    lastValue = JSON.parse(decodeURIComponent(raw));
  } catch {
    lastValue = null;
  }
  return lastValue;
}

export { SESSION_COOKIE };
