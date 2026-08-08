import { MOCK_LEADS, MOCK_NOTES } from "@/lib/mock/data";
import type {
  DashboardMonthly,
  DashboardYearly,
  LeadDetail,
  LeadManualCreate,
  LeadNoteCreate,
  LeadOut,
  LeadUpdate,
  LeadsListResponse,
  LeadsQuery,
} from "@/lib/schemas/lead";
import { LEAD_STATUS_TRANSITIONS } from "@/lib/schemas/lead";

// In-memory mutable copy so PATCH/DELETE/notes behave like a real backend
// across a dev session (resets on reload — deliberately, no fake persistence).
let leads: LeadOut[] = MOCK_LEADS.map((l) => ({ ...l }));
const notes = structuredClone(MOCK_NOTES);

function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fullName(l: LeadOut) {
  return `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim().toLowerCase();
}

// Multi-select column filters: an empty list means "no filter", matching
// _build_conditions in the real repository.
function matchesAny(value: unknown, selected?: readonly unknown[]) {
  if (!selected || selected.length === 0) return true;
  return selected.includes(value as never);
}

const COMPARISONS: Record<string, (a: number, b: number) => boolean> = {
  ">": (a, b) => a > b,
  "<": (a, b) => a < b,
  "=": (a, b) => a === b,
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
};

export async function mockListLeads(query: LeadsQuery): Promise<LeadsListResponse> {
  let rows = leads.slice();

  rows = rows.filter(
    (l) =>
      matchesAny(l.status, query.status) &&
      matchesAny(l.source, query.source) &&
      matchesAny(l.assigned_to, query.assigned_to) &&
      matchesAny(l.survey_type, query.survey_type) &&
      matchesAny(l.company, query.company) &&
      matchesAny(l.property_type, query.property_type) &&
      matchesAny(l.purpose, query.purpose)
  );
  if (query.file_no) {
    const term = query.file_no.toLowerCase();
    rows = rows.filter((l) => (l.file_no ?? "").toLowerCase().includes(term));
  }
  if (query.amount_op && query.amount_value !== undefined) {
    const compare = COMPARISONS[query.amount_op];
    rows = rows.filter(
      (l) => l.amount !== null && compare(l.amount, query.amount_value as number)
    );
  }
  if (query.date_from) {
    const from = new Date(query.date_from).getTime();
    rows = rows.filter((l) => new Date(l.created_at).getTime() >= from);
  }
  if (query.date_to) {
    const to = new Date(query.date_to).getTime();
    rows = rows.filter((l) => new Date(l.created_at).getTime() <= to);
  }
  if (query.search) {
    const term = query.search.toLowerCase();
    rows = rows.filter(
      (l) =>
        fullName(l).includes(term) ||
        l.email.toLowerCase().includes(term) ||
        (l.property_address ?? "").toLowerCase().includes(term)
    );
  }

  const sortKey = query.sort ?? "created_at";
  const order = query.order ?? "desc";
  rows.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortKey];
    const bv = (b as unknown as Record<string, unknown>)[sortKey];
    // Numeric fields (amount) must compare as numbers, not strings — a
    // string compare puts "9" after "10", which silently misorders the
    // Amount column and can make a just-edited row "disappear" off-page.
    let cmp: number;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av ?? "").localeCompare(String(bv ?? ""));
    }
    return order === "asc" ? cmp : -cmp;
  });

  const total = rows.length;
  const page = query.page || 1;
  const pageSize = query.page_size || 25;
  const start = (page - 1) * pageSize;
  const items = rows.slice(start, start + pageSize);

  return delay({ items, total, page, page_size: pageSize });
}

export async function mockGetLead(id: number): Promise<LeadDetail> {
  const lead = leads.find((l) => l.id === id);
  if (!lead) throw new Error("Lead not found");
  return delay({ ...lead, notes: notes[id] ?? [] });
}

// backend/app/routers/leads_admin.py create_manual_lead — always
// source=manual_entry, status starts at `new`, id/timestamps assigned here.
export async function mockCreateManualLead(payload: LeadManualCreate): Promise<LeadOut> {
  const nextId = leads.reduce((max, l) => Math.max(max, l.id), 0) + 1;
  const now = new Date().toISOString();
  const created: LeadOut = {
    id: nextId,
    source: "manual_entry",
    first_name: payload.first_name ?? null,
    last_name: payload.last_name ?? null,
    email: payload.email,
    phone: payload.phone ?? null,
    property_address: payload.property_address ?? null,
    property_type: payload.property_type ?? null,
    purpose: payload.purpose ?? null,
    status: "new",
    assigned_to: payload.assigned_to ?? null,
    created_at: now,
    updated_at: now,
    company: payload.company ?? null,
    amount: payload.amount ?? null,
    date_of_valuation: payload.date_of_valuation ?? null,
    file_no: payload.file_no ?? null,
    survey_type: payload.survey_type ?? null,
  };
  leads = [created, ...leads];
  notes[created.id] = [];
  return delay(created);
}

export async function mockUpdateLead(id: number, patch: LeadUpdate): Promise<LeadOut> {
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) throw new Error("Lead not found");
  const current = leads[idx];

  if (patch.status && patch.status !== current.status) {
    const allowed = LEAD_STATUS_TRANSITIONS[current.status];
    if (!allowed.includes(patch.status)) {
      throw new Error(
        `Invalid status transition: ${current.status} -> ${patch.status}`
      );
    }
  }

  const updated: LeadOut = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  leads[idx] = updated;
  return delay(updated);
}

export async function mockAddNote(id: number, note: LeadNoteCreate) {
  const created = {
    id: Date.now(),
    author: note.author,
    note: note.note,
    created_at: new Date().toISOString(),
  };
  notes[id] = [...(notes[id] ?? []), created];
  return delay(created);
}

export async function mockDeleteLead(id: number) {
  leads = leads.filter((l) => l.id !== id);
  return delay(undefined);
}

export async function mockDashboardMonthly(month: string): Promise<DashboardMonthly> {
  const [y, m] = month.split("-").map(Number);
  const inMonth = leads.filter((l) => {
    const d = new Date(l.created_at);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
  });

  const byType = new Map<string, number>();
  const byPurpose = new Map<string, number>();
  const bySurveyType = new Map<string, number>();
  inMonth.forEach((l) => {
    const t = l.property_type ?? "Unknown";
    const p = l.purpose ?? "Unknown";
    const s = l.survey_type ?? "Unknown";
    byType.set(t, (byType.get(t) ?? 0) + 1);
    byPurpose.set(p, (byPurpose.get(p) ?? 0) + 1);
    bySurveyType.set(s, (bySurveyType.get(s) ?? 0) + 1);
  });

  return delay({
    total_valuations: inMonth.length,
    completed_inspections: inMonth.filter((l) => l.status === "converted").length,
    by_property_type: Array.from(byType, ([type, count]) => ({ type, count })),
    by_purpose: Array.from(byPurpose, ([purpose, count]) => ({ purpose, count })),
    by_survey_type: Array.from(bySurveyType, ([survey_type, count]) => ({
      survey_type,
      count,
    })),
  });
}

// Mirrors lead_service.financial_year_rollup — July→June, all twelve months
// seeded so a quiet month renders as a gap instead of shortening the axis.
export async function mockDashboardYearly(fyStartYear: number): Promise<DashboardYearly> {
  const start = new Date(fyStartYear, 6, 1);
  const end = new Date(fyStartYear + 1, 6, 1);
  const inFy = leads.filter((l) => {
    const d = new Date(l.created_at);
    return d >= start && d < end;
  });

  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(fyStartYear, 6 + i, 1);
    const rows = inFy.filter((l) => {
      const created = new Date(l.created_at);
      return (
        created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth()
      );
    });
    return {
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
      total: rows.length,
      converted: rows.filter((l) => l.status === "converted").length,
    };
  });

  const tally = (key: "property_type" | "purpose" | "survey_type") => {
    const counts = new Map<string, number>();
    inFy.forEach((l) => {
      const value = l[key] ?? "Unspecified";
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return counts;
  };

  const total = inFy.length;
  const converted = inFy.filter((l) => l.status === "converted").length;
  const busiest = byMonth.reduce((best, m) => (m.total > best.total ? m : best), byMonth[0]);

  return delay({
    fy_start_year: fyStartYear,
    fy_label: `FY ${fyStartYear}–${String(fyStartYear + 1).slice(-2)}`,
    total_valuations: total,
    completed_inspections: converted,
    conversion_rate: total ? Math.round((converted / total) * 1000) / 10 : 0,
    busiest_month: busiest.total ? busiest.label : null,
    by_month: byMonth,
    by_property_type: Array.from(tally("property_type"), ([type, count]) => ({ type, count })),
    by_purpose: Array.from(tally("purpose"), ([purpose, count]) => ({ purpose, count })),
    by_survey_type: Array.from(tally("survey_type"), ([survey_type, count]) => ({
      survey_type,
      count,
    })),
  });
}

export async function mockExportCsv(query: LeadsQuery): Promise<string> {
  const { items } = await mockListLeads({ ...query, page: 1, page_size: 100000 });
  const header = [
    "id", "source", "first_name", "last_name", "email", "phone",
    "property_address", "property_type", "purpose", "status", "assigned_to",
    "company", "amount", "date_of_valuation", "file_no", "survey_type",
    "created_at",
  ];
  const rows = items.map((l) =>
    header.map((h) => JSON.stringify((l as unknown as Record<string, unknown>)[h] ?? "")).join(",")
  );
  return [header.join(","), ...rows].join("\n");
}

export async function mockLogin(username: string, password: string) {
  if (!username || !password) throw new Error("Invalid credentials");
  const role = username.toLowerCase().includes("admin") ? "admin" : "staff";
  return delay({
    access_token: `mock-access-${username}`,
    refresh_token: `mock-refresh-${username}`,
    token_type: "bearer",
    role,
    username,
  });
}
