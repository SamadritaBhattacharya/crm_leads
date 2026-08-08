import type { ColumnConfigWithRender } from "@/components/table/utils/adaptor";
import {
  COMPANY_VALUES,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_VALUES,
  LEAD_STATUS_VALUES,
  PROPERTY_TYPE_OPTIONS,
  PURPOSE_OPTIONS,
  SURVEY_TYPE_VALUES,
  type LeadOut,
} from "@/lib/schemas/lead";

// TABLE_SPEC.md §14 (base columns) plus a frontend-only extension — see the
// COMPANY_VALUES note in lib/schemas/lead.ts for what's not backed by the
// database yet.
export const leadColumns: ColumnConfigWithRender<LeadOut>[] = [
  { key: "created_at", label: "Date", type: "date", sortable: true, width: "w-24" },
  {
    key: "first_name",
    label: "Name",
    type: "text",
    sortable: true,
    width: "w-40",
    render: (row) => (
      <span className="font-medium text-zinc-800">
        {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
      </span>
    ),
  },
  { key: "email", label: "Email", type: "email", sortable: false, width: "w-56" },
  { key: "phone", label: "Phone", type: "phone", sortable: false, width: "w-32" },
  {
    key: "source",
    label: "Source",
    type: "enum",
    sortable: true,
    width: "w-40",
    editorConfig: { options: LEAD_SOURCE_VALUES },
    filterable: true,
    filterType: "options",
    filterOptions: LEAD_SOURCE_VALUES,
    filterOptionLabels: LEAD_SOURCE_LABELS,
  },
  {
    key: "property_type",
    label: "Property",
    type: "text",
    sortable: false,
    width: "w-28",
    filterable: true,
    filterType: "options",
    filterOptions: PROPERTY_TYPE_OPTIONS,
  },
  {
    key: "purpose",
    label: "Purpose",
    type: "text",
    sortable: false,
    width: "w-32",
    filterable: true,
    filterType: "options",
    filterOptions: PURPOSE_OPTIONS,
  },
  {
    key: "company",
    label: "Company",
    type: "enum",
    sortable: true,
    width: "w-20",
    editorConfig: { options: COMPANY_VALUES },
    filterable: true,
    filterType: "options",
  },
  {
    key: "survey_type",
    label: "Survey Type",
    type: "enum",
    sortable: true,
    width: "w-64",
    editorConfig: { options: SURVEY_TYPE_VALUES },
    filterable: true,
    filterType: "options",
  },
  { key: "file_no", label: "File No.", type: "text", sortable: true, width: "w-50" },
  {
    key: "date_of_valuation",
    label: "Date of Valuation",
    type: "date",
    sortable: true,
    width: "w-28",
  },
  {
    key: "amount",
    label: "Amount",
    type: "number",
    sortable: true,
    align: "right",
    width: "w-28",
    filterable: true,
    filterType: "compare",
  },
  {
    key: "status",
    label: "Status",
    type: "badge",
    sortable: true,
    editable: true,
    width: "w-28",
    filterable: true,
    filterType: "options",
    filterOptions: LEAD_STATUS_VALUES,
  },
  { key: "assigned_to", label: "Assigned", type: "user", sortable: false, editable: true, width: "w-32" },
];
