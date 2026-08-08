"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  icon: Icon,
  isLoading,
  onClick,
}: {
  label: string;
  /** Strings pass through as-is (rates, month names); numbers get grouped. */
  value: number | string;
  icon: LucideIcon;
  isLoading?: boolean;
  /** When set, the whole tile becomes a button that drills into the figure. */
  onClick?: () => void;
}) {
  const card = (
    <Card
      className={cn(
        "h-full gap-3",
        onClick && "transition-colors group-hover:border-zinc-300 group-hover:bg-zinc-50"
      )}
    >
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <motion.p
            key={value}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums text-zinc-900",
              isLoading && "text-zinc-300"
            )}
          >
            {isLoading ? "—" : typeof value === "number" ? value.toLocaleString() : value}
          </motion.p>
        </div>
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500",
            onClick && "transition-colors group-hover:bg-zinc-200 group-hover:text-zinc-700"
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );

  if (!onClick) return card;

  // A real <button> rather than an onClick div — keyboard activation and
  // focus semantics come for free.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} — view leads`}
      className="group grid h-full w-full cursor-pointer rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
    >
      {card}
    </button>
  );
}
