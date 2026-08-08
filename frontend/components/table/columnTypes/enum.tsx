import { registerColumnType } from "@/components/table/columnTypes/registry";
import { LEAD_SOURCE_LABELS } from "@/lib/schemas/lead";

const KNOWN_LABELS: Record<string, string> = LEAD_SOURCE_LABELS;

// Generic pill renderer for any single-value enum column (source, company,
// survey_type, ...). Looks up a friendly label only for values that have
// one registered (LEAD_SOURCE_LABELS); anything else — e.g. "AAP"/"CPV"/
// "TAMN", or a survey type string — renders as-is, so this one column type
// stays reusable rather than growing a bespoke type per enum.
registerColumnType<string | null>("enum", {
  render: (value) =>
    value ? (
      <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600">
        {KNOWN_LABELS[value] ?? value}
      </span>
    ) : (
      <span className="text-zinc-300">—</span>
    ),
  exportValue: (value) => (value ? KNOWN_LABELS[value] ?? value : ""),
});
