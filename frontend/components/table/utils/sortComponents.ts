import type { Row, RowData, SortingFn } from "@tanstack/react-table";

import { extractTextFromReactNode } from "@/components/table/utils/extractTextFromReactNode";

// custom-table.md §7 — registers the "reactComponent" key so ColumnDef.sortingFn
// can reference it by name, same as any TanStack built-in sortingFn.
declare module "@tanstack/react-table" {
  interface SortingFns {
    reactComponent: SortingFn<RowData>;
  }
}

// custom-table.md §7 / TABLE_SPEC.md §8 — sorts by the underlying value when
// primitive, falling back to extracted text for cells rendering JSX (badges,
// icons). Inert while manualSorting=true (leads table), kept for reuse by
// any future client-side table per TABLE_SPEC.md §3.
export const componentSortingFn: SortingFn<unknown> = (
  rowA: Row<unknown>,
  rowB: Row<unknown>,
  columnId: string
) => {
  const a = rowA.getValue(columnId);
  const b = rowB.getValue(columnId);

  const normalize = (v: unknown) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string" || typeof v === "number") return v;
    return extractTextFromReactNode(v as React.ReactNode);
  };

  const av = normalize(a);
  const bv = normalize(b);

  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv));
};
