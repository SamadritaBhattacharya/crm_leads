import { registerColumnType } from "@/components/table/columnTypes/registry";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/schemas/lead";

// TABLE_SPEC.md §7 — fixed lookup, not inferred.
export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-amber-100 text-amber-800",
  qualified: "bg-purple-100 text-purple-800",
  converted: "bg-green-100 text-green-800",
  lost: "bg-zinc-200 text-zinc-500",
};

registerColumnType<LeadStatus>("badge", {
  render: (value) => (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[value]}`}
    >
      {LEAD_STATUS_LABELS[value] ?? value}
    </span>
  ),
  // Exports the raw enum string, not the badge markup — TABLE_SPEC.md §15.
  exportValue: (value) => LEAD_STATUS_LABELS[value] ?? value,
});
