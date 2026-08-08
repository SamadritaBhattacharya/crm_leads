// custom-table.md §14 — display formatting fallback for column types that
// don't need a bespoke renderer.
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}
