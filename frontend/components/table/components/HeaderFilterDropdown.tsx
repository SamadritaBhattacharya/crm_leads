"use client";

import { useState } from "react";
import type { Column } from "@tanstack/react-table";
import {
  ArrowUpDown,
  Check,
  ChevronsDown,
  ChevronsUp,
  Filter as FilterIcon,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  COMPARE_OPERATORS,
  type ColumnFilter,
  type CompareOperator,
  type CustomColumnMeta,
} from "@/components/table/types";

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/**
 * The dropdown body from components/filter/filter.md §6.2 — a sort row, then a
 * filter section — rebuilt on this repo's stack (Radix popover + shadcn
 * controls) instead of Ant Design, and monochrome to match the CRM shell.
 *
 * Deviation from §4.3, per the request that the popup carry Clear/Apply at the
 * bottom: options filters stage their checkboxes locally and commit on Apply,
 * rather than firing per toggle. On a server-paginated table that also means
 * one request per filter change instead of one per checkbox.
 */
export function HeaderFilterDropdown<T>({
  column,
  activeFilter,
  onFilter,
  options,
  initialSortColumnId,
  onClose,
}: {
  column: Column<T, unknown>;
  activeFilter?: ColumnFilter;
  onFilter: (columnId: string, filter: ColumnFilter | null) => void;
  options: readonly string[];
  initialSortColumnId?: string;
  onClose: () => void;
}) {
  const meta = column.columnDef.meta as CustomColumnMeta | undefined;
  const title = meta?.label ?? column.id;
  const canSort = column.getCanSort();
  const canFilter = Boolean(meta?.filterable);
  const filterType = meta?.filterType ?? "options";
  // The checkbox value stays the raw option; only its visible label is mapped.
  const optionLabels = meta?.filterOptionLabels;
  const sorted = column.getIsSorted();

  // Seeded from the applied filter rather than synced in an effect: the
  // popover unmounts its content on close, so every open starts a fresh
  // component that already shows what is actually applied.
  const [operator, setOperator] = useState<CompareOperator>(
    activeFilter?.type === "compare" ? activeFilter.operator : ">"
  );
  const [compareValue, setCompareValue] = useState(
    activeFilter?.type === "compare" ? String(activeFilter.value) : ""
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(activeFilter?.type === "options" ? activeFilter.values : [])
  );

  const isResetDisabled = initialSortColumnId
    ? column.id === initialSortColumnId
    : !sorted;

  const canApply =
    filterType === "compare"
      ? compareValue !== "" && !Number.isNaN(Number(compareValue))
      : selected.size > 0;

  function applyFilter() {
    if (filterType === "compare") {
      const value = Number(compareValue);
      if (compareValue === "" || Number.isNaN(value)) return;
      onFilter(column.id, { type: "compare", operator, value });
    } else {
      onFilter(
        column.id,
        selected.size > 0 ? { type: "options", values: Array.from(selected) } : null
      );
    }
    onClose();
  }

  function clearFilter() {
    setCompareValue("");
    setSelected(new Set());
    onFilter(column.id, null);
    onClose();
  }

  function toggleOption(option: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }

  return (
    <div className="flex flex-col text-zinc-700">
      {canSort && (
        <div className="flex items-center justify-between gap-3 px-1 py-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs">
            <ArrowUpDown className="size-3.5 text-zinc-400" />
            <span className={cn(sorted && "font-semibold text-zinc-900")}>
              {sorted ? `Sorted by ${capitalize(title)}` : `Sort by ${capitalize(title)}`}
            </span>
          </span>
          <span className="inline-flex items-center gap-0.5">
            <button
              type="button"
              title={sorted === "asc" ? "Descending" : "Ascending"}
              onClick={() => column.toggleSorting(sorted === "asc")}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            >
              {sorted === "desc" ? (
                <ChevronsDown className="size-4" />
              ) : (
                <ChevronsUp className={cn("size-4", !sorted && "text-zinc-300")} />
              )}
            </button>
            <button
              type="button"
              disabled={isResetDisabled}
              title={
                isResetDisabled
                  ? `Already sorted on ${capitalize(initialSortColumnId ?? title)}`
                  : "Reset to default sorting"
              }
              onClick={() => {
                column.clearSorting();
                onClose();
              }}
              className={cn(
                "rounded p-1 text-zinc-500 hover:bg-zinc-100",
                isResetDisabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
              )}
            >
              <Undo2 className="size-3" />
            </button>
          </span>
        </div>
      )}

      {canSort && canFilter && <div className="my-1.5 h-px bg-zinc-200" />}

      {canFilter && (
        <div className="flex flex-col gap-2 px-1">
          <h4 className="inline-flex items-center gap-1.5 text-md font-semibold text-zinc-900">
            <FilterIcon className="size-4 text-zinc-800" />
            Filter by {capitalize(title)}
          </h4>

          {filterType === "compare" ? (
            <div className="flex gap-1.5">
              <Select
                value={operator}
                onValueChange={(value) => setOperator(value as CompareOperator)}
              >
                <SelectTrigger size="sm" className="flex text-xs w-48 gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARE_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label} ({op.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                autoFocus
                placeholder="Enter value"
                value={compareValue}
                onChange={(e) => setCompareValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canApply) applyFilter();
                }}
                className="h-8 w-32 text-xs"
              />
            </div>
          ) : options.length === 0 ? (
            <p className="py-2 text-xs text-zinc-400">No values to filter on.</p>
          ) : (
            <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto pr-1">
              {options.map((option) => {
                const isSelected = selected.has(option);
                return (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-zinc-100"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(option)}
                      className="size-3.5 accent-zinc-800"
                    />
                    <span className="flex-1 truncate">{optionLabels?.[option] ?? option}</span>
                    {isSelected && <Check className="size-3 text-zinc-500" />}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {canFilter && (
        <div className="mt-2 flex gap-2 border-t border-zinc-100 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={clearFilter}
          >
            Clear
          </Button>
          <Button
            size="sm"
            className="h-7 flex-1 text-xs"
            disabled={!canApply}
            onClick={applyFilter}
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
