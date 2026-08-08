"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/** The financial year that the given date falls in — July starts a new one. */
export function currentFinancialYear(today = new Date()): number {
  return today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
}

export function financialYearLabel(fyStartYear: number): string {
  return `FY ${fyStartYear}–${String(fyStartYear + 1).slice(-2)}`;
}

export function FinancialYearSelector({
  fyStartYear,
  onChange,
}: {
  fyStartYear: number;
  onChange: (fyStartYear: number) => void;
}) {
  const isCurrent = fyStartYear >= currentFinancialYear();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
      <Button variant="ghost" size="icon-sm" onClick={() => onChange(fyStartYear - 1)}>
        <ChevronLeft className="size-3.5" />
      </Button>
      <span className="min-w-24 text-center text-sm font-medium text-zinc-800">
        {financialYearLabel(fyStartYear)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isCurrent}
        onClick={() => onChange(fyStartYear + 1)}
      >
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}
