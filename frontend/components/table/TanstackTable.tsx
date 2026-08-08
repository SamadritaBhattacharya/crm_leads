"use client";

import "@/components/table/columnTypes";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { FileX } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Header } from "@/components/table/components/Header";
import { TablePagination } from "@/components/table/components/TablePagination";
import { useTableState } from "@/components/table/hooks/useTableState";
import { componentSortingFn } from "@/components/table/utils/sortComponents";
import { extractTextFromReactNode } from "@/components/table/utils/extractTextFromReactNode";
import { rowPassesFilters } from "@/components/table/utils/rowPassesFilters";
import type { CustomColumnMeta, Filter, FilterConfig, TanStackTableProps } from "@/components/table/types";

const SELECT_COLUMN_ID = "__select__";

export function TanstackTable<T extends { id: number }>({
  data,
  columns,
  filterConfig = [],
  enablePagination = false,
  className,
  searchColumns = [],
  tableSearchTerm = "",
  isEnterPressed = false,
  stickyTable = false,
  defaultSortColumnId,
  onRowClick,
  emptyMessage = "No data found. Try adjusting your filters or search terms.",
  isLoading = false,
  manual = false,
  total,
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
  pagination: controlledPagination,
  onPaginationChange: controlledOnPaginationChange,
  columnFilters,
  onColumnFilterChange,
  initialSortColumnId,
  enableRowSelection = false,
  rowSelection,
  onRowSelectionChange,
}: TanStackTableProps<T>) {
  const internal = useTableState<T>(controlledPagination?.pageSize ?? 25, defaultSortColumnId);

  const sorting = controlledSorting ?? internal.tableState.sorting;
  const pagination = controlledPagination ?? internal.tableState.pagination;

  const onSortingChange = (updater: unknown) => {
    const next =
      typeof updater === "function" ? updater(sorting) : (updater as SortingState);
    (controlledOnSortingChange ?? internal.handleSorting)(next);
  };

  const onPaginationChange = (updater: unknown) => {
    const next =
      typeof updater === "function" ? updater(pagination) : (updater as PaginationState);
    (controlledOnPaginationChange ?? internal.handlePagination)(next);
  };

  // custom-table.md §5.4 — client-side pipeline (inert in manual mode).
  const filteredData = useMemo(() => {
    if (manual) return data;

    const filters: Partial<Record<keyof T, Filter>> = {};
    filterConfig.forEach((fc) => {
      filters[fc.column] = fc.filter;
    });
    Object.assign(filters, internal.tableState.filters);

    let rows = Object.keys(filters).length
      ? data.filter((row) => rowPassesFilters(row as Record<string, unknown>, filters))
      : data;

    if (isEnterPressed && tableSearchTerm && searchColumns.length) {
      const term = tableSearchTerm.toLowerCase();
      rows = rows.filter((row) =>
        searchColumns.some((col) => {
          const value = (row as Record<string, unknown>)[col];
          return String(value ?? "").toLowerCase().startsWith(term);
        })
      );
    }

    return rows;
  }, [manual, data, filterConfig, internal.tableState.filters, isEnterPressed, tableSearchTerm, searchColumns]);

  // custom-table.md §6 — highlight-only match tracking, never filtering.
  const matchingRowIds = useMemo(() => {
    if (!tableSearchTerm || !searchColumns.length) return null;
    const term = tableSearchTerm.toLowerCase();
    const ids = new Set<number>();
    (manual ? data : filteredData).forEach((row) => {
      const hit = searchColumns.some((col) => {
        const raw = (row as Record<string, unknown>)[col];
        const text = extractTextFromReactNode(String(raw ?? ""));
        return text.toLowerCase().startsWith(term);
      });
      if (hit) ids.add(row.id);
    });
    return ids;
  }, [manual, data, filteredData, tableSearchTerm, searchColumns]);

  // Injected here (rather than asked of every consumer) so a "Select" toggle
  // in the toolbar can flip enableRowSelection without the caller having to
  // build a checkbox column themselves.
  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    if (!enableRowSelection) return columns;
    const selectColumn: ColumnDef<T> = {
      id: SELECT_COLUMN_ID,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select row"
        />
      ),
      meta: { width: "w-9", columnType: "text", label: "" } satisfies CustomColumnMeta,
    };
    return [selectColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data: manual ? data : filteredData,
    columns: tableColumns,
    state: { sorting, pagination, ...(enableRowSelection ? { rowSelection: rowSelection ?? {} } : {}) },
    onSortingChange,
    onPaginationChange,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection ?? {}) : updater;
      onRowSelectionChange?.(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getRowId: (row) => String(row.id),
    sortingFns: { reactComponent: componentSortingFn },
    manualFiltering: manual,
    manualSorting: manual,
    manualPagination: manual,
    enableRowSelection,
    pageCount: manual && total !== undefined ? Math.max(1, Math.ceil(total / pagination.pageSize)) : undefined,
    enableSortingRemoval: false,
    autoResetPageIndex: false,
  });

  const rows = table.getRowModel().rows;

  // filter.md §5 — options come from the column config when it declares them
  // (the only correct source on a server-paginated table, where `data` is one
  // page), otherwise they're derived from the loaded rows.
  const derivedOptions = useMemo(() => {
    const byColumn = new Map<string, string[]>();
    columns.forEach((column) => {
      const columnMeta = column.meta as CustomColumnMeta | undefined;
      const id = column.id;
      if (!id || !columnMeta?.filterable || columnMeta.filterType === "compare") return;
      if (columnMeta.filterOptions?.length) return;
      const unique = new Set<string>();
      data.forEach((row) => {
        const value = (row as Record<string, unknown>)[id];
        if (value !== null && value !== undefined && value !== "") {
          unique.add(String(value));
        }
      });
      byColumn.set(id, Array.from(unique).sort());
    });
    return byColumn;
  }, [columns, data]);

  function filterOptionsFor(
    columnId: string,
    columnMeta: CustomColumnMeta | undefined
  ): readonly string[] {
    return columnMeta?.filterOptions ?? derivedOptions.get(columnId) ?? [];
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg max-w-full isolate bg-white grow py-2",
        className
      )}
    >
      <div className="overflow-auto rounded-lg border border-zinc-200 max-h-[calc(100vh-260px)]">
        <table className="min-w-full text-xs/5">
          <thead
            className={cn(
              stickyTable && "sticky top-0 z-20 backdrop-blur-sm bg-zinc-100/90 border-b border-zinc-300"
            )}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className={cn(!stickyTable && "bg-zinc-100/90 border-b border-zinc-300")}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as CustomColumnMeta | undefined;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-2.5 py-2 text-left font-semibold text-zinc-600 first:rounded-tl-lg last:rounded-tr-lg",
                        meta?.width,
                        header.column.getIsSorted() && "bg-zinc-200"
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.id === SELECT_COLUMN_ID ? (
                        flexRender(header.column.columnDef.header, header.getContext())
                      ) : (
                        <Header
                          column={header.column}
                          columnFilters={columnFilters}
                          onColumnFilterChange={onColumnFilterChange}
                          filterOptions={filterOptionsFor(header.column.id, meta)}
                          initialSortColumnId={initialSortColumnId ?? defaultSortColumnId}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="bg-zinc-50">
            {isLoading ? (
              <tr>
                <td colSpan={tableColumns.length} className="px-3 py-10 text-center text-zinc-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={tableColumns.length} className="px-3 py-16">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-zinc-100">
                      <FileX className="size-5 text-zinc-400" />
                    </div>
                    <p className="max-w-xs text-sm text-zinc-400">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const isDimmed =
                  matchingRowIds !== null && !matchingRowIds.has(row.original.id);
                return (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, delay: Math.min(idx, 12) * 0.012 }}
                    onClick={() => onRowClick?.(row.original)}
                    className={cn(
                      "border border-zinc-100 transition-colors",
                      onRowClick && "cursor-pointer hover:bg-zinc-100",
                      isDimmed && "text-zinc-400"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as CustomColumnMeta | undefined;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-2.5 py-1.5",
                            meta?.width,
                            meta?.align === "right" && "text-right",
                            meta?.align === "center" && "text-center"
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        table={table}
        enablePagination={enablePagination}
        total={total ?? filteredData.length}
      />
    </div>
  );
}
