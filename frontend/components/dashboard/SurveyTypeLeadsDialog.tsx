"use client";

import { useMemo } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { motion } from "framer-motion";
import type { PaginationState, SortingState } from "@tanstack/react-table";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TanstackTable } from "@/components/table/TanstackTable";
import { adaptColumns } from "@/components/table/utils/adaptor";
import { useTableState } from "@/components/table/hooks/useTableState";
import { leadColumns } from "@/components/leads/leadColumns";
import { DownloadExcelAnalytics } from "@/components/ExcelAnalytics/DownloadExcelAnalytics";
import { useGetLeadsQuery } from "@/lib/api/leadsApi";
import type { LeadOut, LeadsQuery, SurveyType } from "@/lib/schemas/lead";

// Every row in this table shares the survey type named in the title, so that
// column would be dead width — the rest of the leads-table config is reused
// verbatim so the drill-down reads exactly like the Leads page.
const DIALOG_COLUMNS = leadColumns.filter((column) => column.key !== "survey_type");

export function SurveyTypeLeadsDialog({
  surveyType,
  label,
  month,
  open,
  onOpenChange,
}: {
  surveyType: SurveyType;
  label: string;
  month: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { tableState, handleSorting, handlePagination } = useTableState<LeadOut>(
    10,
    "created_at"
  );

  const columns = useMemo(() => adaptColumns(DIALOG_COLUMNS), []);

  const query: Partial<LeadsQuery> = useMemo(() => {
    const sort = tableState.sorting[0];
    return {
      survey_type: [surveyType],
      // The tile counts leads by created_at month (that's how the rollup view
      // groups), so the drill-down has to use the same window or the row count
      // won't match the number on the tile. date_to is exclusive server-side,
      // hence the first of the *next* month.
      date_from: format(startOfMonth(month), "yyyy-MM-dd"),
      date_to: format(addMonths(startOfMonth(month), 1), "yyyy-MM-dd"),
      sort: sort?.id,
      order: sort ? (sort.desc ? "desc" : "asc") : undefined,
      page: tableState.pagination.pageIndex + 1,
      page_size: tableState.pagination.pageSize,
    };
  }, [surveyType, month, tableState.sorting, tableState.pagination]);

  const { data, isFetching } = useGetLeadsQuery(query, { skip: !open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* flex + overflow-hidden (not the default grid) so the table below can
          be told to shrink: a grid/flex child defaults to min-width/height
          auto, which lets the fixed-width lead columns push the table straight
          out of the modal instead of scrolling inside it. */}
      <DialogContent className="flex max-h-[85vh] max-w-[min(96vw,72rem)] flex-col gap-3 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex shrink-0 items-start justify-between gap-3 pr-8"
        >
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {isFetching ? "Loading…" : `${data?.total ?? 0} leads`} for{" "}
              {format(month, "MMMM yyyy")}.
            </DialogDescription>
          </DialogHeader>

          {/* Same export path as the Leads page: it re-requests the CSV with
              this dialog's filters, so you get every matching lead for the
              month, not just the page on screen. */}
          <DownloadExcelAnalytics
            query={query}
            fileName={`${label} - ${format(month, "MMMM yyyy")}`}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut", delay: 0.06 }}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <TanstackTable<LeadOut>
            data={data?.items ?? []}
            columns={columns}
            enablePagination
            stickyTable
            manual
            total={data?.total ?? 0}
            isLoading={isFetching}
            sorting={tableState.sorting}
            onSortingChange={(s: SortingState) => handleSorting(s)}
            pagination={tableState.pagination}
            onPaginationChange={(p: PaginationState) => handlePagination(p)}
            className="min-h-0 min-w-0 flex-1 py-0"
            emptyMessage={`No ${label.toLowerCase()} leads in ${format(month, "MMMM yyyy")}.`}
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
