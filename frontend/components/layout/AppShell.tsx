"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useLeadsRealtime } from "@/lib/realtime/useLeadsRealtime";

export function AppShell({ children }: { children: React.ReactNode }) {
  useLeadsRealtime();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
