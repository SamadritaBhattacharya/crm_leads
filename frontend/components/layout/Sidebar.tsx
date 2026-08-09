"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSession } from "@/lib/auth/session";
import { getFirebaseAuth } from "@/lib/firebase/config";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
];

const COLLAPSE_KEY = "crm_sidebar_collapsed";

// Reads external, client-only stores (cookie session, localStorage
// preference) via useSyncExternalStore rather than useEffect+setState — this
// is the React-blessed way to read a value that doesn't exist during SSR
// without a hydration mismatch or a "setState in effect" cascade.
const noopSubscribe = () => () => {};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const session = useSyncExternalStore(noopSubscribe, getSession, () => null);
  const storedCollapsed = useSyncExternalStore(
    noopSubscribe,
    () => localStorage.getItem(COLLAPSE_KEY) === "true",
    () => false
  );

  // Local override so toggling is instant; falls back to the persisted
  // preference until the user clicks (a plain event handler, not an effect).
  const [override, setOverride] = useState<boolean | null>(null);
  const collapsed = override ?? storedCollapsed;

  function toggleCollapsed() {
    const next = !collapsed;
    localStorage.setItem(COLLAPSE_KEY, String(next));
    setOverride(next);
  }

  async function handleLogout() {
    try {
      const auth = getFirebaseAuth();
      await auth.signOut();
    } catch { /* ignore client-side signOut errors */ }
    await fetch("/api/auth/logout", { method: "POST" });
    document.cookie = "crm_session=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 232 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative z-30 flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/60 py-3"
    >
      <div className={cn("flex items-center gap-2 px-3", collapsed && "justify-center px-0")}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-xs font-semibold text-zinc-50">
          AA
        </div>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="truncate text-sm font-semibold text-zinc-800"
          >
            Leads
          </motion.span>
        )}
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const link = (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-zinc-900 text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );

          return collapsed ? (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 px-2">
        <button
          onClick={toggleCollapsed}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" />
              <span>Collapse</span>
            </>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-200/60",
                collapsed && "justify-center px-0"
              )}
            >
              <Avatar className="size-7">
                <AvatarFallback>
                  {((session?.fullName?.trim() || session?.username || "?")
                    .split(" ")
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    || "?"
                  ).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-800">
                    {session?.fullName?.trim() || session?.username || "Admin"}
                  </p>
                  <p className="truncate text-[11px] text-zinc-400 capitalize">
                    {session?.role ?? "admin"}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuLabel>{session?.fullName?.trim() || session?.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.aside>
  );
}
