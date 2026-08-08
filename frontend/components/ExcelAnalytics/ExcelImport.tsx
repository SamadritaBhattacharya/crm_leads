"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreateManualLeadMutation, useUpdateLeadMutation } from "@/lib/api/leadsApi";
import {
  buildIncorrectRowsCsv,
  downloadCsv,
  downloadTemplate,
  extractApiErrorMessage,
  IMPORT_ROW_LIMIT,
  parseImportSource,
  resolveTargetStatus,
  statusTransitionPath,
  type ParseOutcome,
  type ParsedRow,
} from "@/lib/leadImport";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/schemas/lead";
import { cn } from "@/lib/utils";

type ImportResult = {
  createdCount: number;
  statusIssueCount: number;
  failedRows: ParsedRow[];
};

// Which status tab the user was on decides where imported rows land — see
// resolveTargetStatus in lib/leadImport.ts. Passed down from LeadsTable so
// "Import Excel" while viewing Qualified actually creates Qualified leads
// (walking new -> contacted -> qualified under the hood, since the backend
// only ever creates a lead as `new` — TECH_SPEC.md §4.4/§2).
export default function ExcelImport({ activeStatus }: { activeStatus: LeadStatus | "all" }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"file" | "paste" | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseOutcome | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createLead] = useCreateManualLeadMutation();
  const [updateLead] = useUpdateLeadMutation();

  const rows = parseResult?.rows ?? [];
  const validRows = rows.filter((r) => r.payload);
  const invalidRows = rows.filter((r) => !r.payload);
  const incorrectRows = [...invalidRows, ...(result?.failedRows ?? [])];
  const targetLabel =
    activeStatus === "all" ? "each row's Status column (defaults to New)" : LEAD_STATUS_LABELS[activeStatus];

  function resetImportState() {
    setSource(null);
    setFileName(null);
    setPasteText("");
    setParseResult(null);
    setParseError(null);
    setIsParsing(false);
    setResult(null);
    setProgress(null);
  }

  function resetAndClose() {
    if (isSubmitting) return;
    resetImportState();
    setOpen(false);
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error("Unsupported file", { description: "Upload a .xlsx, .xls, or .csv file." });
      return;
    }
    setSource("file");
    setFileName(file.name);
    setPasteText("");
    setResult(null);
    setParseError(null);
    setIsParsing(true);
    try {
      const outcome = await parseImportSource(file);
      setParseResult(outcome);
      if (outcome.rows.length === 0) setParseError("No data rows found in this file.");
    } catch {
      setParseResult(null);
      setParseError("Couldn't read this file — make sure it's a valid Excel or CSV file.");
    } finally {
      setIsParsing(false);
    }
  }

  function handlePasteChange(value: string) {
    setSource(value.trim() ? "paste" : null);
    setFileName(null);
    setResult(null);
    setPasteText(value);
    if (!value.trim()) {
      setParseResult(null);
      setParseError(null);
    }
  }

  // Debounced so a large pasted block doesn't get re-parsed on every keystroke.
  useEffect(() => {
    if (source !== "paste" || !pasteText.trim()) return;
    const handle = setTimeout(async () => {
      setIsParsing(true);
      setParseError(null);
      try {
        const outcome = await parseImportSource(pasteText);
        setParseResult(outcome);
        if (outcome.rows.length === 0) setParseError("No data rows found in the pasted text.");
      } catch {
        setParseResult(null);
        setParseError("Couldn't parse the pasted text.");
      } finally {
        setIsParsing(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [pasteText, source]);

  function clearFile() {
    setSource(null);
    setFileName(null);
    setParseResult(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDownloadIncorrect() {
    if (incorrectRows.length === 0) return;
    downloadCsv("leads_import_incorrect_rows.csv", buildIncorrectRowsCsv(parseResult?.headers ?? [], incorrectRows));
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setIsSubmitting(true);
    setProgress({ done: 0, total: validRows.length });

    const failedRows: ParsedRow[] = [];
    let createdCount = 0;
    let statusIssueCount = 0;

    for (const row of validRows) {
      try {
        const lead = await createLead(row.payload!).unwrap();
        createdCount++;

        const target = resolveTargetStatus(activeStatus, row.rowStatus);
        for (const status of statusTransitionPath(target)) {
          try {
            await updateLead({ id: lead.id, patch: { status } }).unwrap();
          } catch {
            statusIssueCount++;
            break;
          }
        }
      } catch (err) {
        failedRows.push({ ...row, errors: [extractApiErrorMessage(err) ?? "Couldn't create this lead."] });
      }
      setProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
    }

    setIsSubmitting(false);
    setProgress(null);
    setResult({ createdCount, statusIssueCount, failedRows });

    if (createdCount > 0) {
      toast.success(`${createdCount} lead${createdCount === 1 ? "" : "s"} imported`, {
        description:
          failedRows.length > 0
            ? `${failedRows.length} row${failedRows.length === 1 ? "" : "s"} failed — download to see why.`
            : statusIssueCount > 0
              ? `${statusIssueCount} landed as New — status couldn't be set automatically.`
              : undefined,
      });
    } else {
      toast.error("Import failed", { description: "No leads were created — check the failed rows below." });
    }
  }

  const addLabel =
    validRows.length > 0 ? `Add ${validRows.length} Lead${validRows.length === 1 ? "" : "s"}` : "Add Leads";

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="h-full gap-1.5 border-zinc-950 border-3 bg-white text-xs text-black cursor-pointer"
        >
          <Upload className="size-4" />
          Import Excel
        </Button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={!isSubmitting}
        onInteractOutside={(e) => isSubmitting && e.preventDefault()}
        onEscapeKeyDown={(e) => isSubmitting && e.preventDefault()}
        className="flex max-h-[88vh] flex-col gap-4 overflow-hidden sm:max-w-2xl"
      >
        <DialogHeader className="flex-row items-start justify-between gap-4 space-y-0 pr-6">
          <div>
            <DialogTitle>Import Leads</DialogTitle>
            <DialogDescription>
              Upload a spreadsheet or paste rows copied from Excel — columns are matched by header, in any order.
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 cursor-pointer"
            onClick={downloadTemplate}
          >
            <Download className="size-3.5" />
            Download template
          </Button>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <p className="text-xs text-zinc-500">
            Importing into: <span className="font-medium text-zinc-900">{targetLabel}</span>
          </p>

          {!result && (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                  isDragging ? "border-zinc-950 bg-zinc-50" : "border-zinc-300 bg-white"
                )}
              >
                {fileName ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-700">
                    <FileSpreadsheet className="size-4 text-zinc-500" />
                    <span className="font-medium">{fileName}</span>
                    <button
                      type="button"
                      onClick={clearFile}
                      className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                      aria-label="Remove file"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex size-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                      <Upload className="size-4" />
                    </span>
                    <p className="text-sm text-zinc-600">
                      Drop file or{" "}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="font-medium text-zinc-900 underline underline-offset-2 cursor-pointer"
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-[11px] text-zinc-400">.xlsx, .xls, or .csv</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lead-import-paste" className="text-xs font-normal text-zinc-500">
                  Or paste rows copied from Excel or a CSV
                </Label>
                <Textarea
                  id="lead-import-paste"
                  placeholder={
                    "First Name\tProperty Type\tSurvey Type\tEmail\t…\nJane\tResidential\tInspection\tjane@example.com\t…"
                  }
                  className="min-h-16 font-mono text-[11px]"
                  value={pasteText}
                  onChange={(e) => handlePasteChange(e.target.value)}
                />
              </div>

              {isParsing && (
                <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Loader2 className="size-3.5 animate-spin" /> Reading…
                </p>
              )}
              {parseError && <p className="text-xs text-red-600">{parseError}</p>}
              {parseResult && rows.length > 0 && (!parseResult.hasPropertyTypeColumn || !parseResult.hasSurveyTypeColumn) && (
                <p className="text-xs text-red-600">
                  {[
                    !parseResult.hasPropertyTypeColumn && "Property Type",
                    !parseResult.hasSurveyTypeColumn && "Survey Type",
                  ]
                    .filter(Boolean)
                    .join(" and ")}{" "}
                  {parseResult.hasPropertyTypeColumn || parseResult.hasSurveyTypeColumn ? "column wasn't" : "columns weren't"}{" "}
                  found — every row needs one to be imported.
                </p>
              )}

              {parseResult && rows.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                    <span className="text-zinc-600">
                      {rows.length} row{rows.length === 1 ? "" : "s"} found · {validRows.length} ready ·{" "}
                      {invalidRows.length} need attention
                    </span>
                    {parseResult.truncated && (
                      <span className="text-amber-700">Only the first {IMPORT_ROW_LIMIT} rows will be imported.</span>
                    )}
                  </div>
                  {parseResult.ignoredColumns.length > 0 && (
                    <p className="text-[11px] text-zinc-400">
                      Columns not recognized (ignored): {parseResult.ignoredColumns.join(", ")}
                    </p>
                  )}

                  <div className="max-h-56 overflow-auto rounded-lg border border-zinc-200">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-zinc-50 text-zinc-500">
                        <tr>
                          <th className="px-2 py-1.5 font-medium">#</th>
                          <th className="px-2 py-1.5 font-medium">Name</th>
                          <th className="px-2 py-1.5 font-medium">Property Type</th>
                          <th className="px-2 py-1.5 font-medium">Survey Type</th>
                          <th className="px-2 py-1.5 font-medium">Email</th>
                          <th className="px-2 py-1.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {rows.map((row) => (
                          <tr key={row.rowNumber} className={row.payload ? undefined : "bg-red-50/60"}>
                            <td className="px-2 py-1.5 text-zinc-400">{row.rowNumber}</td>
                            <td className="px-2 py-1.5 text-zinc-700">{row.preview.name}</td>
                            <td className="px-2 py-1.5 text-zinc-700">{row.preview.propertyType}</td>
                            <td className="px-2 py-1.5 text-zinc-700">{row.preview.surveyType}</td>
                            <td className="px-2 py-1.5 text-zinc-700">{row.preview.email}</td>
                            <td className="px-2 py-1.5">
                              {row.payload ? (
                                <span className="flex items-center gap-1 text-emerald-700">
                                  <CheckCircle2 className="size-3.5" />
                                  {LEAD_STATUS_LABELS[resolveTargetStatus(activeStatus, row.rowStatus)]}
                                </span>
                              ) : (
                                <span className="text-red-600" title={row.errors.join("; ")}>
                                  {row.errors[0]}
                                  {row.errors.length > 1 ? ` +${row.errors.length - 1}` : ""}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-zinc-900">
                <CheckCircle2 className="size-4 text-emerald-600" />
                {`${result.createdCount} lead${result.createdCount === 1 ? "" : "s"} imported${
                  result.failedRows.length > 0 ? `, ${result.failedRows.length} failed` : ""
                }`}
              </p>
              {result.statusIssueCount > 0 && (
                <p className="text-xs text-amber-700">
                  {`${result.statusIssueCount} lead${
                    result.statusIssueCount === 1 ? "" : "s"
                  } landed as New — their target status couldn't be set automatically.`}
                </p>
              )}
              {result.failedRows.length > 0 && (
                <p className="text-xs text-red-600">
                  {`${result.failedRows.length} row${
                    result.failedRows.length === 1 ? "" : "s"
                  } couldn't be created — download incorrect rows for details.`}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 cursor-pointer"
            disabled={incorrectRows.length === 0}
            onClick={handleDownloadIncorrect}
          >
            <Download className="size-3.5" />
            Download Incorrect Rows
          </Button>

          {result ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={resetImportState}>
                Import more
              </Button>
              <Button type="button" size="sm" className="cursor-pointer" onClick={resetAndClose}>
                Done
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              className="gap-1.5 cursor-pointer"
              disabled={validRows.length === 0 || isSubmitting}
              onClick={handleImport}
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {isSubmitting ? `Importing ${progress?.done ?? 0}/${progress?.total ?? 0}…` : addLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
