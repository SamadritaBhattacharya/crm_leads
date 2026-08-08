import { format, isValid } from "date-fns";

import { registerColumnType } from "@/components/table/columnTypes/registry";

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? d : null;
}

registerColumnType<string | null>("date", {
  render: (value) => {
    const d = parseDate(value);
    return (
      <span className="text-zinc-600">
        {d ? format(d, "dd MMM yyyy") : "—"}
      </span>
    );
  },
  exportValue: (value) => value ?? "",
});

registerColumnType<string | null>("datetime", {
  render: (value) => {
    const d = parseDate(value);
    return (
      <span className="text-zinc-600">
        {d ? format(d, "dd MMM yyyy, HH:mm") : "—"}
      </span>
    );
  },
  exportValue: (value) => value ?? "",
});
