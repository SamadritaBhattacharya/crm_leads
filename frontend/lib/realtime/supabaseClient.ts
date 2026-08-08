import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// SYSTEM_ARCHITECTURE.md §5 — this client authenticates via a Supabase
// token + RLS, entirely independent of the FastAPI JWT. It is never given
// write access from the frontend; all mutations go through lib/api/.
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Expected in mock/dev mode (lib/api/config.ts USE_MOCK) — Realtime
    // simply stays off rather than throwing, since RLS/token wiring is an
    // explicit Tech Spec §6 open decision, not something to fake here.
    return null;
  }

  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}
