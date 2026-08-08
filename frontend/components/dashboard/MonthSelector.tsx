"use client";

import { addMonths, format, isSameMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MonthSelector({
  month,
  onChange,
}: {
  month: Date;
  onChange: (month: Date) => void;
}) {
  const isCurrentMonth = isSameMonth(month, new Date());

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
      <Button variant="ghost" size="icon-sm" onClick={() => onChange(subMonths(month, 1))}>
        <ChevronLeft className="size-3.5" />
      </Button>
      <span className="min-w-28 text-center text-sm font-medium text-zinc-800">
        {format(month, "MMMM yyyy")}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isCurrentMonth}
        onClick={() => onChange(addMonths(month, 1))}
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}
