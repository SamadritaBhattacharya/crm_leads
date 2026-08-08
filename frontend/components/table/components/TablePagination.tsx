"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// custom-table.md §8 — outside the scrollable table area, right-aligned.
// TABLE_SPEC.md §9 — server-driven: pageIndex/pageSize drive page/page_size
// query params; `total` from the API response drives page count.
export function TablePagination<T>({
  table,
  enablePagination,
  total,
}: {
  table: Table<T>;
  enablePagination: boolean;
  total: number;
}) {
  if (!enablePagination) return null;

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <div className="flex items-center justify-between gap-4 self-end pt-1 text-xs text-zinc-500">
      <span className="tabular-nums">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-3">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => table.setPageSize(Number(v))}
        >
          <SelectTrigger size="sm" className="w-27.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                <span className="text-zinc-700 text-xs">
                  {size} / page
                </span>
                
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="flex h-4 min-w-12 items-center justify-center rounded-md border border-zinc-200 px-2 font-medium text-zinc-700 tabular-nums text-xs ">
            {pageIndex + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
