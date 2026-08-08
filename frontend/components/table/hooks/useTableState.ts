"use client";

import { useState } from "react";
import type { ExpandedState, PaginationState, SortingState } from "@tanstack/react-table";

import type { Filter } from "@/components/table/types";

// custom-table.md §9 — centralizes filters/sorting/pagination/expanded in
// one hook instead of scattering useState calls, wired directly into
// useReactTable's controlled state + onXChange props.
export function useTableState<T extends object>(
  pageSize = 25,
  defaultSortColumnId?: string
) {
  const [filters, setFilters] = useState<Partial<Record<keyof T, Filter>>>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [sorting, setSorting] = useState<SortingState>(
    defaultSortColumnId ? [{ id: defaultSortColumnId, desc: true }] : []
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  function handleFilter(column: keyof T, filter: Filter | undefined) {
    setFilters((prev) => {
      const next = { ...prev };
      if (filter === undefined) delete next[column];
      else next[column] = filter;
      return next;
    });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }

  function clearFilters() {
    setFilters({});
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }

  return {
    tableState: { filters, expanded, sorting, pagination },
    handleFilter,
    clearFilters,
    handleExpanded: setExpanded,
    handleSorting: setSorting,
    handlePagination: setPagination,
  };
}
