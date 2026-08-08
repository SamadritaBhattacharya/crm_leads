"use client";

import { useState } from "react";
import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Filter as FilterIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HeaderFilterDropdown } from "@/components/table/components/HeaderFilterDropdown";
import type {
  ColumnFilter,
  ColumnFilters,
  CustomColumnMeta,
} from "@/components/table/types";

// custom-table.md §7 + components/filter/filter.md §4.5 — the header cell is
// the dropdown trigger: clicking it opens sorting *and* filtering for that
// column, rather than sorting on click and hiding filters elsewhere.
export function Header<T>({
  column,
  columnFilters,
  onColumnFilterChange,
  filterOptions = [],
  initialSortColumnId,
}: {
  column: Column<T, unknown>;
  columnFilters?: ColumnFilters;
  onColumnFilterChange?: (columnId: string, filter: ColumnFilter | null) => void;
  filterOptions?: readonly string[];
  initialSortColumnId?: string;
}) {
  const [open, setOpen] = useState(false);

  const meta = column.columnDef.meta as CustomColumnMeta | undefined;
  const sortable = column.getCanSort();
  const sorted = column.getIsSorted();
  const align = meta?.align ?? "left";
  const activeFilter = columnFilters?.[column.id];
  // How many values this column is filtered on — a compare filter is always
  // one condition, so only multi-select columns can reach a badge.
  const activeFilterCount =
    activeFilter?.type === "options" ? activeFilter.values.length : activeFilter ? 1 : 0;
  // Filtering needs a handler to commit to; without one the column is
  // sort-only no matter what the config says.
  const filterable = Boolean(meta?.filterable && onColumnFilterChange);

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold text-zinc-900 text-xs",
        align === "right" && "flex-row-reverse",
        align === "center" && "justify-center"
      )}
    >
      <span>{meta?.label}</span>
      {activeFilter && (
        <span
          className="relative inline-flex"
          title={`${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} applied`}
        >
          <FilterIcon className="size-2.5 text-zinc-700" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex min-w-3 items-center justify-center rounded-full bg-zinc-900 px-[3px] text-[8px] leading-[11px] font-semibold text-white tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </span>
      )}
      {(sortable || filterable) && (
        <span className="text-zinc-400">
          {sorted === "asc" ? (
            <ArrowUp className="size-3" />
          ) : sorted === "desc" ? (
            <ArrowDown className="size-3" />
          ) : (
            <ChevronsUpDown className="size-3 opacity-40" />
          )}
        </span>
      )}
    </span>
  );

  const justify = cn(
    align === "right" && "justify-end",
    align === "center" && "justify-center"
  );

  if (!sortable && !filterable) {
    return <div className={cn("flex w-full", justify)}>{content}</div>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full cursor-pointer items-center rounded px-0.5 select-none hover:text-zinc-900",
            justify
          )}
        >
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align === "right" ? "end" : "start"}
        className="w-72 p-2"
        // Stops a click inside the dropdown from reaching the row/table
        // handlers underneath — filter.md §4.5.
        onClick={(event) => event.stopPropagation()}
      >
        <HeaderFilterDropdown
          column={column}
          activeFilter={activeFilter}
          onFilter={onColumnFilterChange ?? (() => {})}
          options={filterOptions}
          initialSortColumnId={initialSortColumnId}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
