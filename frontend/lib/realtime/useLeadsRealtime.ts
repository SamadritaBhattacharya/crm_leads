"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { leadsApi } from "@/lib/api/leadsApi";
import { getSupabaseClient } from "@/lib/realtime/supabaseClient";
import type { AppDispatch } from "@/lib/store";

// SYSTEM_ARCHITECTURE.md §6 — Realtime patches land here and invalidate the
// RTK Query cache that feeds the table/dashboard; the table itself has no
// awareness of Supabase. No-ops safely if Realtime isn't configured (mock
// mode, or before the RLS design spike in Tech Spec §6 lands).
export function useLeadsRealtime() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel("leads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          dispatch(leadsApi.util.invalidateTags([{ type: "LeadList", id: "LIST" }]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dispatch]);
}
