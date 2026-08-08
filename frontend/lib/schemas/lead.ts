import { z } from "zod";

// Mirrors backend TECH_SPEC.md §2 — LeadSource / LeadStatus enums.
// Source of truth is the FastAPI Pydantic models; this file is kept in sync
// with them by hand until OpenAPI codegen (TECH_SPEC.md §1) is wired up.

// `property_type` is a free-text VARCHAR(100) server-side (backend/app/infra/db/orm_models.py)
// — there's no backend enum for it. These options are a frontend-only UX
// convenience (matches the valuation categories in PRD.md §1 / dashboard
// breakdowns); the value submitted is still a plain string, not validated
// against this list server-side.
export const PROPERTY_TYPE_OPTIONS = [
  "Residential",
  "Commercial",
  "Rural",
  "Industrial",
  "Vacant Land",
] as const;

// Same story as PROPERTY_TYPE_OPTIONS above — `purpose` is free-text
// VARCHAR(100) server-side, no backend enum. Matches the categories already
// seen in TECH_SPEC.md §4.9's dashboard sample response and lib/mock/data.ts.
export const PURPOSE_OPTIONS = [
  "Sale",
  "Purchase",
  "Refinance",
  "Capital Gains Tax",
  "Stamp Duty",
  "Family Law",
  "Probate",
  "SMSF",
] as const;

// `company` and `survey_type` are real backend enums as of migration
// 0004_add_lead_valuation_fields.py (backend/app/domain/models.py) — no
// longer frontend-only.
export const COMPANY_VALUES = ["AAP", "CPV" , "TAMN"] as const;
export const companySchema = z.enum(COMPANY_VALUES);
export type Company = z.infer<typeof companySchema>;

export const SURVEY_TYPE_VALUES = [
  "Inspection",
  "External / Desktop Valuation",
  "Kerbside Valuation",
] as const;
export const surveyTypeSchema = z.enum(SURVEY_TYPE_VALUES);
export type SurveyType = z.infer<typeof surveyTypeSchema>;

export const LEAD_SOURCE_VALUES = [
  "hero_quote_form",
  "cta_quote_form",
  "residential_valuation",
  "commercial_valuation",
  "rural_valuation",
  // Additive (OCP) — backend migration 0003_add_manual_entry_lead_source.py.
  // Always assigned server-side by POST /api/leads/manual; staff never pick
  // this as a filter value for *creating* a lead, only ever see it on read.
  "manual_entry",
  // Additive (OCP) — backend migration 0004_add_lead_valuation_fields.py.
  "google",
] as const;

export const leadSourceSchema = z.enum(LEAD_SOURCE_VALUES);
export type LeadSource = z.infer<typeof leadSourceSchema>;

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  hero_quote_form: "Hero Quote Form",
  cta_quote_form: "CTA Quote Form",
  residential_valuation: "Residential Valuation",
  commercial_valuation: "Commercial Valuation",
  rural_valuation: "Rural Valuation",
  manual_entry: "Manual Entry",
  google: "Google",
};

export const LEAD_STATUS_VALUES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
] as const;

export const leadStatusSchema = z.enum(LEAD_STATUS_VALUES);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
};

// TECH_SPEC.md §2 — valid status transitions. Mirrors the backend's
// authoritative table in `backend/app/domain/rules.py::is_valid_status_transition`.
// The frontend only gates the dropdown menu (which options to render); any
// other PATCH field is independent and unaffected. Keep these two tables
// in sync — frontend drift causes a 409 from
// `app/routers/leads_admin.py::update_lead` because the server enforces
// its own copy on every PATCH.
export const LEAD_STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted"],
  contacted: ["qualified", "lost"],
  qualified: ["converted", "lost"],
  converted: [],
  lost: [],
};

export const leadNoteSchema = z.object({
  id: z.number(),
  author: z.string(),
  note: z.string(),
  created_at: z.string(),
});
export type LeadNote = z.infer<typeof leadNoteSchema>;

// TECH_SPEC.md §5 — LeadOut
export const leadOutSchema = z.object({
  id: z.number(),
  source: leadSourceSchema,
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
  property_address: z.string().nullable(),
  property_type: z.string().nullable(),
  purpose: z.string().nullable(),
  status: leadStatusSchema,
  assigned_to: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  // Real backend columns as of migration 0004_add_lead_valuation_fields.py.
  company: companySchema.nullable(),
  amount: z.number().nullable(),
  date_of_valuation: z.string().nullable(),
  file_no: z.string().nullable(),
  survey_type: surveyTypeSchema.nullable(),
});
export type LeadOut = z.infer<typeof leadOutSchema>;

export const leadDetailSchema = leadOutSchema.extend({
  notes: z.array(leadNoteSchema),
});
export type LeadDetail = z.infer<typeof leadDetailSchema>;

// TECH_SPEC.md §5 — LeadUpdate. PATCH /api/leads/{id} now accepts the full
// record (backend/app/schemas/lead.py LeadUpdate, backend/app/routers/leads_admin.py)
// — `status`/`assigned_to` are the only fields subject to the status
// transition rules (TECH_SPEC.md §2); everything else is a plain overwrite.
export const leadUpdateSchema = z.object({
  status: leadStatusSchema.optional(),
  assigned_to: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: z.string().email("Enter a valid email").optional(),
  phone: z.string().nullable().optional(),
  property_address: z.string().nullable().optional(),
  property_type: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  source: leadSourceSchema.optional(),
  company: companySchema.nullable().optional(),
  amount: z.number().nullable().optional(),
  date_of_valuation: z.string().nullable().optional(),
  file_no: z.string().nullable().optional(),
  survey_type: surveyTypeSchema.nullable().optional(),
});
export type LeadUpdate = z.infer<typeof leadUpdateSchema>;

// backend/app/schemas/lead.py LeadManualCreate — POST /api/leads/manual,
// JWT-protected (staff entering a phone/walk-in/referral lead). Always
// recorded server-side as source=manual_entry, status starts at `new`.
export const leadManualCreateSchema = z.object({
  first_name: z.string().min(1, "First name is required").nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: z.string().email("Enter a valid email"),
  phone: z.string().nullable().optional(),
  property_address: z.string().nullable().optional(),
  property_type: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  // Real backend columns as of migration 0004_add_lead_valuation_fields.py.
  company: companySchema.nullable().optional(),
  amount: z.number().nullable().optional(),
  date_of_valuation: z.string().nullable().optional(),
  file_no: z.string().nullable().optional(),
  survey_type: surveyTypeSchema.nullable().optional(),
});
export type LeadManualCreate = z.infer<typeof leadManualCreateSchema>;

// TECH_SPEC.md §5 — LeadNoteCreate
export const leadNoteCreateSchema = z.object({
  note: z.string().min(1, "Note can't be empty"),
  author: z.string(),
});
export type LeadNoteCreate = z.infer<typeof leadNoteCreateSchema>;

// TECH_SPEC.md §4.3 — GET /api/leads query params
// The multi-value fields are arrays because the table's column filters are
// multi-select; they go on the wire as repeated params (`?status=new&status=lost`),
// which the backend reads as a list either way.
export const leadsQuerySchema = z.object({
  status: z.array(leadStatusSchema).optional(),
  source: z.array(leadSourceSchema).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  assigned_to: z.array(z.string()).optional(),
  search: z.string().optional(),
  survey_type: z.array(surveyTypeSchema).optional(),
  company: z.array(companySchema).optional(),
  property_type: z.array(z.string()).optional(),
  purpose: z.array(z.string()).optional(),
  file_no: z.string().optional(),
  amount_op: z.enum([">", "<", "=", ">=", "<="]).optional(),
  amount_value: z.number().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.number().default(1),
  page_size: z.number().default(25),
});
export type LeadsQuery = z.infer<typeof leadsQuerySchema>;

export const leadsListResponseSchema = z.object({
  items: z.array(leadOutSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
});
export type LeadsListResponse = z.infer<typeof leadsListResponseSchema>;

// TECH_SPEC.md §4.9 — GET /api/dashboard/monthly
export const dashboardMonthlySchema = z.object({
  total_valuations: z.number(),
  completed_inspections: z.number(),
  by_property_type: z.array(z.object({ type: z.string(), count: z.number() })),
  by_purpose: z.array(z.object({ purpose: z.string(), count: z.number() })),
  by_survey_type: z.array(z.object({ survey_type: z.string(), count: z.number() })),
});
export type DashboardMonthly = z.infer<typeof dashboardMonthlySchema>;

// GET /api/dashboard/yearly — the Australian financial year runs July→June,
// so `fy_start_year` 2025 means July 2025 – June 2026.
export const dashboardYearlySchema = z.object({
  fy_start_year: z.number(),
  fy_label: z.string(),
  total_valuations: z.number(),
  completed_inspections: z.number(),
  conversion_rate: z.number(),
  busiest_month: z.string().nullable(),
  by_month: z.array(
    z.object({
      month: z.string(),
      label: z.string(),
      total: z.number(),
      converted: z.number(),
    })
  ),
  by_property_type: z.array(z.object({ type: z.string(), count: z.number() })),
  by_purpose: z.array(z.object({ purpose: z.string(), count: z.number() })),
  by_survey_type: z.array(z.object({ survey_type: z.string(), count: z.number() })),
});
export type DashboardYearly = z.infer<typeof dashboardYearlySchema>;
