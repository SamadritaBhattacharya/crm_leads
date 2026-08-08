"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
};

function resolveTitle(pathname: string): { title: string; subtitle?: string } {
  if (pathname.startsWith("/leads/") && pathname !== "/leads") {
    return { title: "Lead detail", subtitle: pathname.split("/").pop() };
  }
  return { title: TITLES[pathname] ?? "Overview" };
}

export function Topbar() {
  const pathname = usePathname();
  const { title } = resolveTitle(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <div className="flex items-center gap-2.5">
        <h1 className="text-sm font-semibold text-zinc-900">{title}</h1>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
        Live
      </div>
    </header>
  );
}
