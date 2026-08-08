"use client";

import { ListChecks, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { cn } from "@/lib/utils";
import type { LeadStatus, LeadsQuery } from "@/lib/schemas/lead";
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
import ExcelImport from "@/components/ExcelAnalytics/ExcelImport";
import { DownloadExcelAnalytics } from "@/components/ExcelAnalytics/DownloadExcelAnalytics";

const ASSIGNEES = ["staff1", "staff2", "staff3"];

// `source` has no control here anymore — it moved to the Source column's own
// header filter — but the field stays because the owning table still maps it
// into its query.
export type LeadFilters = {
  source?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function TableFilterHeader({
  filters,
  onFiltersChange,
  searchTerm,
  onSearchTermChange,
  onSearchSubmit,
  exportQuery,
  exportFileName,
  selectMode,
  onToggleSelectMode,
  activeStatus,
}: {
  filters: LeadFilters;
  onFiltersChange: (filters: LeadFilters) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onSearchSubmit: () => void;
  /**
   * The owning table's fully-built query — the export re-requests with it, so
   * the CSV always matches what the table is currently showing.
   */
  exportQuery: Partial<LeadsQuery>;
  exportFileName: string;
  /** Whether the row-checkbox column is currently showing. */
  selectMode: boolean;
  onToggleSelectMode: () => void;
  /** Current StatusTabs selection — decides which status imported rows land in. */
  activeStatus: LeadStatus | "all";
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-1.5 min-w-0 sm:flex-nowrap">
        <div className="relative h-8 w-full min-w-[10rem] sm:w-48">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search name, email, address…"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearchSubmit();
            }}
            className="h-8 pl-7 text-xs"
          />
        </div>

        <Select
          value={filters.assignedTo ?? "all"}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, assignedTo: v === "all" ? undefined : v })
          }
        >
          <SelectTrigger size="sm" className="w-32 text-xs">
            <SelectValue placeholder="Assigned to" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {ASSIGNEES.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangeFilter filters={filters} onFiltersChange={onFiltersChange} />

        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs font-normal text-zinc-600 cursor-pointer",
            selectMode && "border-zinc-400 bg-zinc-100 text-zinc-900"
          )}
          onClick={onToggleSelectMode}
        >
          <ListChecks className="size-3.5" />
          {selectMode ? "Selecting…" : "Select"}
        </Button>
      </div>

      <div className="flex h-8 shrink-0 gap-1.5">
        <AddLeadDialog />
        <ExcelImport activeStatus={activeStatus} />
        <DownloadExcelAnalytics query={exportQuery} fileName={exportFileName} />
      </div>
    </div>
  );
}
