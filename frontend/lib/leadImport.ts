// Parsing/validation for the "Import Excel" flow (components/ExcelAnalytics/ExcelImport.tsx).
// Kept out of the component so the header-matching, cell-typing, and status-routing
// rules can be reasoned about (and unit-tested) independently of the dialog UI.

import * as XLSX from "xlsx";
import { format } from "date-fns";

import {
  COMPANY_VALUES,
  LEAD_STATUS_TRANSITIONS,
  LEAD_STATUS_VALUES,
  SURVEY_TYPE_VALUES,
  type LeadManualCreate,
  type LeadStatus,
} from "@/lib/schemas/lead";

// Backend LeadManualCreate.date_of_valuation is a `date` — see AddLeadDialog.tsx.
const DATE_VALUE_FORMAT = "yyyy-MM-dd";

// A .xlsx/.csv import can be sizable; every valid row costs 1 create + up to 3
// status-transition PATCHes with no bulk endpoint on the backend (TECH_SPEC.md
// §4), so an unbounded paste/file could mean thousands of sequential requests.
export const IMPORT_ROW_LIMIT = 300;

export type ImportField = keyof LeadManualCreate | "status";

// Column order for the downloadable template — also doubles as the canonical
// label for each field.
// Property Type and Survey Type lead so they read as required at a glance —
// see resolveTargetStatus/parseImportSource: they're the only two fields a
// row can't be imported without.
export const TEMPLATE_FIELDS: { field: ImportField; label: string; required?: boolean }[] = [
  { field: "first_name", label: "First Name" },
  { field: "last_name", label: "Last Name" },
  { field: "property_type", label: "Property Type", required: true },
  { field: "survey_type", label: "Survey Type", required: true },
  { field: "email", label: "Email" },
  { field: "phone", label: "Phone" },
  { field: "property_address", label: "Property Address" },
  { field: "purpose", label: "Purpose" },
  { field: "assigned_to", label: "Assigned To" },
  { field: "company", label: "Company" },
  { field: "amount", label: "Amount" },
  { field: "date_of_valuation", label: "Date of Valuation" },
  { field: "file_no", label: "File No" },
  { field: "status", label: "Status" },
];

// Header text (normalized) -> field. Lets the upload tolerate reordered
// columns, different casing, and the handful of synonyms people actually type.
const HEADER_ALIASES: Record<ImportField, string[]> = {
  first_name: ["first name", "firstname", "first"],
  last_name: ["last name", "lastname", "last", "surname"],
  email: ["email", "email address", "e mail"],
  phone: ["phone", "phone number", "mobile", "contact number", "telephone"],
  property_address: ["property address", "address"],
  property_type: ["property type", "type of property"],
  purpose: ["purpose"],
  assigned_to: ["assigned to", "assignee", "assigned"],
  company: ["company"],
  amount: ["amount", "value", "price"],
  date_of_valuation: ["date of valuation", "valuation date", "date"],
  file_no: ["file no", "file number", "file no."],
  survey_type: ["survey type"],
  status: ["status", "lead status"],
};

function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const HEADER_LOOKUP = new Map<string, ImportField>();
(Object.keys(HEADER_ALIASES) as ImportField[]).forEach((field) => {
  HEADER_LOOKUP.set(normalizeHeader(field), field);
  HEADER_ALIASES[field].forEach((alias) => HEADER_LOOKUP.set(normalizeHeader(alias), field));
});

export type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  payload: LeadManualCreate | null;
  /** The "Status" column value, if the sheet had one and it matched a known status. */
  rowStatus: LeadStatus | null;
  preview: { name: string; email: string; propertyType: string; surveyType: string };
  errors: string[];
};

export type ParseOutcome = {
  headers: string[];
  ignoredColumns: string[];
  hasPropertyTypeColumn: boolean;
  hasSurveyTypeColumn: boolean;
  rows: ParsedRow[];
  truncated: boolean;
};

type Cell = { display: string; value: unknown };

// sheet_to_json coerces "0400123456" or "007" to the numbers 400123456 / 7,
// silently eating leading zeros in phone/file-no columns. Reading cells
// directly and preferring `.w` (the original formatted text SheetJS keeps
// alongside the coerced `.v`) avoids that, while numeric/date fields below
// still use `.v` so a currency- or date-formatted Excel cell parses from its
// real value instead of a locale-formatted display string.
function cellsFromSheet(sheet: XLSX.WorkSheet): Cell[][] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: Cell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: Cell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      if (!cell) {
        row.push({ display: "", value: undefined });
        continue;
      }
      const value = cell.v;
      let display: string;
      if (typeof cell.w === "string") display = cell.w;
      else if (value instanceof Date) display = format(value, DATE_VALUE_FORMAT);
      else display = value === undefined || value === null ? "" : String(value);
      row.push({ display: display.trim(), value });
    }
    rows.push(row);
  }
  return rows;
}

async function readCells(source: File | string): Promise<Cell[][]> {
  const workbook =
    typeof source === "string"
      ? XLSX.read(source, { type: "string", cellDates: true })
      : XLSX.read(await source.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return cellsFromSheet(workbook.Sheets[sheetName]);
}

function parseAmountCell(cell: Cell | undefined): { value: number | null; error?: string } {
  if (!cell || cell.display === "") return { value: null };
  if (typeof cell.value === "number") {
    return Number.isFinite(cell.value) ? { value: cell.value } : { value: null, error: "Amount isn't a valid number" };
  }
  const cleaned = cell.display.replace(/[^0-9.\-]/g, "");
  const parsed = Number(cleaned);
  return cleaned !== "" && Number.isFinite(parsed)
    ? { value: parsed }
    : { value: null, error: "Amount isn't a valid number" };
}

function parseDateCell(cell: Cell | undefined): { value: string | null; error?: string } {
  if (!cell || cell.display === "") return { value: null };
  if (cell.value instanceof Date) {
    return Number.isNaN(cell.value.getTime())
      ? { value: null, error: "Date of valuation isn't a recognized date" }
      : { value: format(cell.value, DATE_VALUE_FORMAT) };
  }
  const parsed = new Date(cell.display);
  return Number.isNaN(parsed.getTime())
    ? { value: null, error: "Date of valuation isn't a recognized date — use YYYY-MM-DD" }
    : { value: format(parsed, DATE_VALUE_FORMAT) };
}

function parseEnumCell(
  cell: Cell | undefined,
  allowed: readonly string[],
  label: string
): { value: string | null; error?: string } {
  const text = cell?.display ?? "";
  if (text === "") return { value: null };
  const match = allowed.find((option) => option.toLowerCase() === text.toLowerCase());
  return match ? { value: match } : { value: null, error: `${label} must be one of: ${allowed.join(", ")}` };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function parseImportSource(source: File | string): Promise<ParseOutcome> {
  const grid = await readCells(source);
  const nonEmptyRows = grid.filter((row) => row.some((cell) => cell.display !== ""));
  if (nonEmptyRows.length === 0) {
    return {
      headers: [],
      ignoredColumns: [],
      hasPropertyTypeColumn: false,
      hasSurveyTypeColumn: false,
      rows: [],
      truncated: false,
    };
  }

  const headerRow = nonEmptyRows[0].map((cell) => cell.display);
  const columnByField = new Map<ImportField, number>();
  const ignoredColumns: string[] = [];
  headerRow.forEach((header, index) => {
    if (!header) return;
    const field = HEADER_LOOKUP.get(normalizeHeader(header));
    if (field) {
      if (!columnByField.has(field)) columnByField.set(field, index);
    } else {
      ignoredColumns.push(header);
    }
  });

  const dataRows = nonEmptyRows.slice(1);
  const truncated = dataRows.length > IMPORT_ROW_LIMIT;
  const limitedRows = dataRows.slice(0, IMPORT_ROW_LIMIT);

  const seenEmails = new Set<string>();
  const rows: ParsedRow[] = limitedRows.map((cells, i) => {
    const raw: Record<string, string> = {};
    headerRow.forEach((header, index) => {
      if (header) raw[header] = cells[index]?.display ?? "";
    });

    const getCell = (field: ImportField): Cell | undefined => {
      const idx = columnByField.get(field);
      return idx === undefined ? undefined : cells[idx];
    };
    const getText = (field: ImportField): string => getCell(field)?.display ?? "";

    const errors: string[] = [];

    // Email and phone are contact details, not required to bring a row in —
    // if an email is given it still has to be well-formed and unique within
    // the batch, but a blank one no longer blocks the row.
    const email = getText("email");
    if (email) {
      if (!EMAIL_RE.test(email)) errors.push("Invalid email format");
      else if (seenEmails.has(email.toLowerCase())) errors.push("Duplicate email in this import");
      else seenEmails.add(email.toLowerCase());
    }

    const amount = parseAmountCell(getCell("amount"));
    if (amount.error) errors.push(amount.error);

    const dateOfValuation = parseDateCell(getCell("date_of_valuation"));
    if (dateOfValuation.error) errors.push(dateOfValuation.error);

    const company = parseEnumCell(getCell("company"), COMPANY_VALUES, "Company");
    if (company.error) errors.push(company.error);

    // Property type and survey type identify the valuation itself, so —
    // unlike company/status — they're required rather than just validated
    // when present.
    const propertyType = getText("property_type");
    if (!propertyType) errors.push("Property type is required");

    const surveyType = parseEnumCell(getCell("survey_type"), SURVEY_TYPE_VALUES, "Survey type");
    if (!getText("survey_type")) errors.push("Survey type is required");
    else if (surveyType.error) errors.push(surveyType.error);

    // An unrecognized Status value isn't fatal — it just falls back to New
    // (resolveTargetStatus below), so no error is pushed for it.
    const statusCell = parseEnumCell(getCell("status"), LEAD_STATUS_VALUES, "Status");

    const firstName = getText("first_name");
    const lastName = getText("last_name");

    const payload: LeadManualCreate | null =
      errors.length === 0
        ? {
            first_name: firstName || null,
            last_name: lastName || null,
            email,
            phone: getText("phone") || null,
            property_address: getText("property_address") || null,
            property_type: propertyType || null,
            purpose: getText("purpose") || null,
            assigned_to: getText("assigned_to") || null,
            company: (company.value as LeadManualCreate["company"]) ?? null,
            amount: amount.value,
            date_of_valuation: dateOfValuation.value,
            file_no: getText("file_no") || null,
            survey_type: (surveyType.value as LeadManualCreate["survey_type"]) ?? null,
          }
        : null;

    return {
      rowNumber: i + 1,
      raw,
      payload,
      rowStatus: (statusCell.value as LeadStatus | null) ?? null,
      preview: {
        name: [firstName, lastName].filter(Boolean).join(" ") || "—",
        email: email || "—",
        propertyType: propertyType || "—",
        surveyType: surveyType.value ?? (getText("survey_type") || "—"),
      },
      errors,
    };
  });

  return {
    headers: headerRow.filter(Boolean),
    ignoredColumns,
    hasPropertyTypeColumn: columnByField.has("property_type"),
    hasSurveyTypeColumn: columnByField.has("survey_type"),
    rows,
    truncated,
  };
}

// BFS over LEAD_STATUS_TRANSITIONS (which only lists direct neighbors) so an
// import can land a freshly-created (always status=new — TECH_SPEC.md §4.4)
// row on any reachable status without hand-deriving the hop sequence, e.g.
// new -> contacted -> qualified for a "Qualified" tab import.
export function statusTransitionPath(target: LeadStatus): LeadStatus[] {
  if (target === "new") return [];
  const queue: LeadStatus[][] = [["new"]];
  const visited = new Set<LeadStatus>(["new"]);
  while (queue.length > 0) {
    const path = queue.shift() as LeadStatus[];
    const last = path[path.length - 1];
    if (last === target) return path.slice(1);
    for (const next of LEAD_STATUS_TRANSITIONS[last]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

// Import target per row: pinned to whichever status tab the user was viewing
// when they opened the import, except on the "All" tab where each row can
// carry its own Status column (falling back to New when absent/unrecognized).
export function resolveTargetStatus(activeStatus: LeadStatus | "all", rowStatus: LeadStatus | null): LeadStatus {
  return activeStatus === "all" ? (rowStatus ?? "new") : activeStatus;
}

function csvEscape(value: string): string {
  return /["\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildIncorrectRowsCsv(
  headers: string[],
  rows: { raw: Record<string, string>; errors: string[] }[]
): string {
  const columns = [...headers, "Import Error"];
  const lines = [columns.map(csvEscape).join(",")];
  rows.forEach(({ raw, errors }) => {
    lines.push([...headers.map((h) => csvEscape(raw[h] ?? "")), csvEscape(errors.join("; "))].join(","));
  });
  return lines.join("\n");
}

export function downloadTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    TEMPLATE_FIELDS.map((f) => (f.required ? `${f.label} *` : f.label)),
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Leads");
  XLSX.writeFile(workbook, "leads_import_template.xlsx");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// RTK Query's `unwrap()` rejection is `{ status, data }`, not an Error — same
// shape handled inline in AddLeadDialog.tsx's submit handler.
export function extractApiErrorMessage(err: unknown): string | null {
  const data = (err as { data?: unknown })?.data;
  const detail = (data as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (typeof e === "object" && e !== null && "msg" in e ? String((e as { msg: unknown }).msg) : JSON.stringify(e)))
      .join("; ");
  }
  if (typeof err === "string") return err;
  return (err as { message?: string })?.message ?? null;
}
