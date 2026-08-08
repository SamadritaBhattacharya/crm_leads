import type { Filter } from "@/components/table/types";

// custom-table.md §5.3/§5.4 — client-side filter pipeline. Only used by a
// fully client-side table (manual=false); the leads table is server-paginated
// and skips this entirely (TABLE_SPEC.md §3) — filtering happens in
// GET /api/leads's query handling instead.
export function rowPassesFilters<T extends Record<string, unknown>>(
  row: T,
  filters: Partial<Record<keyof T, Filter>>
): boolean {
  return Object.entries(filters).every(([key, filter]) => {
    const value = row[key as keyof T];
    const f = filter as Filter;

    switch (f.type) {
      case "multiSelect":
      case "singleSelect":
        return f.values.includes(String(value ?? "").toUpperCase());
      case "value":
        return String(value ?? "")
          .toLowerCase()
          .includes(f.value.toLowerCase());
      case "number": {
        const num = Number(value);
        if (Number.isNaN(num)) return false;
        if (f.min !== undefined && num < f.min) return false;
        if (f.max !== undefined && num > f.max) return false;
        return true;
      }
      case "numberCompare": {
        const num = Number(value);
        if (Number.isNaN(num)) return false;
        switch (f.operator) {
          case ">":
            return num > f.value;
          case "<":
            return num < f.value;
          case ">=":
            return num >= f.value;
          case "<=":
            return num <= f.value;
          case "=":
            return num === f.value;
        }
        return false;
      }
      default:
        return true;
    }
  });
}
