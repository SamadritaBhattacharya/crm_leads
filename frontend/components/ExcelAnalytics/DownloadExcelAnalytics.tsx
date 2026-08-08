"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useExportLeadsMutation } from "@/lib/api/leadsApi";
import type { LeadsQuery } from "@/lib/schemas/lead";

// TABLE_SPEC.md §15 — backed by GET /api/leads/export (Tech Spec §4.8),
// which streams the CSV for the *current filtered view*, not just the
// current page — so this always re-requests with page_size stripped
// rather than reconstructing from in-memory table rows.
export function DownloadExcelAnalytics({
  query,
  fileName,
}: {
  query: Partial<LeadsQuery>;
  fileName: string;
}) {
  const [exportLeads, { isLoading }] = useExportLeadsMutation();
  const [justDownloaded, setJustDownloaded] = useState(false);

  async function handleExport() {
    try {
      const csv = await exportLeads(query).unwrap();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setJustDownloaded(true);
      toast.success("Export ready", { description: `${fileName}.csv downloaded` });
      setTimeout(() => setJustDownloaded(false), 1500);
    } catch {
      toast.error("Export failed", { description: "Please try again." });
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={handleExport}
          disabled={isLoading}
          className="rounded-full bg-zinc-100/70 text-zinc-600 hover:bg-zinc-200 h-full cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        {justDownloaded ? "Downloaded" : "Export current view"}
      </TooltipContent>
    </Tooltip>
  );
}
