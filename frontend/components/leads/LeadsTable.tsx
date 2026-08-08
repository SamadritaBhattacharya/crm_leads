"use client";

import { useMemo, useState } from "react";
import type { ColumnDef, RowSelectionState, PaginationState, SortingState } from "@tanstack/react-table";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TanstackTable } from "@/components/table/TanstackTable";
import { adaptColumns } from "@/components/table/utils/adaptor";
import { useTableState } from "@/components/table/hooks/useTableState";
import { leadColumns } from "@/components/leads/leadColumns";
import { RowActions } from "@/components/leads/RowActions";
import { TableFilterHeader, type LeadFilters } from "@/components/leads/TableFilterHeader";
import { StatusTabs } from "@/components/leads/StatusTabs";
import { useDeleteLeadMutation, useGetLeadsQuery } from "@/lib/api/leadsApi";
import type { ColumnFilter, ColumnFilters } from "@/components/table/types";
import type { LeadOut, LeadStatus, LeadsQuery } from "@/lib/schemas/lead";

const SEARCH_COLUMNS = ["first_name", "last_name", "email", "property_address"];

// Column id -> the query param its "options" filter feeds. Anything not listed
// has no server-side equivalent, so it must not be marked filterable.
const OPTION_FILTER_PARAMS = {
  status: "status",
  source: "source",
  assigned_to: "assigned_to",
  survey_type: "survey_type",
  company: "company",
  property_type: "property_type",
  purpose: "purpose",
} as const;

export function LeadsTable({ onRowClick }: { onRowClick: (lead: LeadOut) => void }) {
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [filters, setFilters] = useState<LeadFilters>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [isEnterPressed, setIsEnterPressed] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deleteLead] = useDeleteLeadMutation();
  const selectedIds = useMemo(() => Object.keys(rowSelection).map(Number), [rowSelection]);

  // TABLE_SPEC.md §8 — default sort created_at desc, not the first column.
  const { tableState, handleSorting, handlePagination } = useTableState<LeadOut>(
    25,
    "created_at"
  );

  // Edit reuses the same row-click handler that opens the detail sheet — the
  // Actions column button is just a more discoverable trigger for it.
  const actionsColumn: ColumnDef<LeadOut> = useMemo(
    () => ({
      id: "actions",
      meta: { label: "Actions", columnType: "text", align: "center", width: "w-16" },
      cell: ({ row }) => (
        <RowActions lead={row.original} onEdit={() => onRowClick(row.original)} />
      ),
    }),
    [onRowClick]
  );

  const columns = useMemo(
    () => [...adaptColumns(leadColumns), actionsColumn],
    [actionsColumn]
  );

  function handleToggleSelectMode() {
    setSelectMode((prev) => {
      if (prev) setRowSelection({});
      return !prev;
    });
    setBulkConfirmOpen(false);
  }

  async function handleBulkDelete() {
    setIsBulkDeleting(true);
    const results = await Promise.allSettled(selectedIds.map((id) => deleteLead(id).unwrap()));
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = selectedIds.length - failed;

    setIsBulkDeleting(false);
    setBulkConfirmOpen(false);
    setRowSelection({});

    if (failed === 0) {
      toast.success(
        `${succeeded} lead${succeeded === 1 ? "" : "s"} deleted successfully`
      );
    } else {
      toast.error(`Deleted ${succeeded} of ${selectedIds.length} leads`, {
        description: `${failed} couldn't be deleted — please try again.`,
      });
    }
  }

  // TABLE_SPEC.md §5.3 — 1:1 with Tech Spec §4.3 query params.
  const query: Partial<LeadsQuery> = useMemo(() => {
    const sort = tableState.sorting[0];

    // Column filters are folded in after the toolbar's, so a header filter on
    // a column the toolbar also controls (status, source, assignee) wins — it
    // is the more specific, more recent choice.
    const fromColumns: Partial<LeadsQuery> = {};
    Object.entries(columnFilters).forEach(([columnId, filter]) => {
      if (filter.type === "compare") {
        if (columnId === "amount") {
          fromColumns.amount_op = filter.operator;
          fromColumns.amount_value = filter.value;
        }
        return;
      }
      const param = OPTION_FILTER_PARAMS[columnId as keyof typeof OPTION_FILTER_PARAMS];
      if (param) {
        Object.assign(fromColumns, { [param]: filter.values });
      }
    });

    return {
      status: status === "all" ? undefined : [status],
      source: filters.source ? [filters.source as NonNullable<LeadsQuery["source"]>[number]] : undefined,
      assigned_to: filters.assignedTo ? [filters.assignedTo] : undefined,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      search: committedSearch || undefined,
      ...fromColumns,
      sort: sort?.id,
      order: sort ? (sort.desc ? "desc" : "asc") : undefined,
      page: tableState.pagination.pageIndex + 1,
      page_size: tableState.pagination.pageSize,
    };
  }, [
    status,
    filters,
    columnFilters,
    committedSearch,
    tableState.sorting,
    tableState.pagination,
  ]);

  // A filter change re-scopes the whole result set, so staying on page 4 of
  // the old one would show an empty table.
  function handleColumnFilterChange(columnId: string, filter: ColumnFilter | null) {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (filter === null) delete next[columnId];
      else next[columnId] = filter;
      return next;
    });
    handlePagination((prev) => ({ ...prev, pageIndex: 0 }));
  }

  const { data, isFetching } = useGetLeadsQuery(query);

  function handleSearchSubmit() {
    setCommittedSearch(searchInput);
    setIsEnterPressed(true);
    handlePagination((prev) => ({ ...prev, pageIndex: 0 }));
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <StatusTabs value={status} onChange={setStatus} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TableFilterHeader
          filters={filters}
          onFiltersChange={setFilters}
          searchTerm={searchInput}
          onSearchTermChange={(term) => {
            setSearchInput(term);
            setIsEnterPressed(false);
          }}
          onSearchSubmit={handleSearchSubmit}
          exportQuery={query}
          exportFileName="Leads"
          selectMode={selectMode}
          onToggleSelectMode={handleToggleSelectMode}
          activeStatus={status}
        />
      </div>

      {selectMode && selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5">
          <span className="text-xs font-medium text-zinc-700">
            {selectedIds.length} row{selectedIds.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-[11px] text-red-600 cursor-pointer hover:bg-red-50 hover:text-red-700"
              onClick={() => setBulkConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Delete selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] cursor-pointer"
              onClick={() => setRowSelection({})}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <TanstackTable<LeadOut>
        data={data?.items ?? []}
        columns={columns}
        enablePagination
        stickyTable
        manual
        total={data?.total ?? 0}
        isLoading={isFetching}
        searchColumns={SEARCH_COLUMNS}
        tableSearchTerm={committedSearch}
        isEnterPressed={isEnterPressed}
        sorting={tableState.sorting}
        onSortingChange={(s: SortingState) => handleSorting(s)}
        pagination={tableState.pagination}
        onPaginationChange={(p: PaginationState) => handlePagination(p)}
        columnFilters={columnFilters}
        onColumnFilterChange={handleColumnFilterChange}
        initialSortColumnId="created_at"
        onRowClick={onRowClick}
        emptyMessage="No leads found. Try adjusting your filters or search terms."
        enableRowSelection={selectMode}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />

      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedIds.length} lead{selectedIds.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.length} row
              {selectedIds.length === 1 ? "" : "s"}? This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
