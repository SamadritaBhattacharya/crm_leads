import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { getColumnType } from "@/components/table/columnTypes/registry";
import type { ColumnConfig, CustomColumnMeta } from "@/components/table/types";

export type ColumnConfigWithRender<T> = ColumnConfig<T> & {
  // Escape hatch for display-only composition (e.g. the leads table's
  // combined "Name" column, TABLE_SPEC.md §14) — never business logic,
  // purely how to render the cell.
  render?: (row: T) => ReactNode;
};

// TABLE_SPEC.md §4.3 — ColumnConfig<T>[] -> TanStack ColumnDef<T>[]. The cell
// renderer is resolved via the registry (§7), not a local switch statement —
// this is the Open/Closed boundary called out in SYSTEM_ARCHITECTURE.md §2.
export function adaptColumns<T extends { id: number }>(
  configs: ColumnConfigWithRender<T>[]
): ColumnDef<T>[] {
  return configs.map((config) => {
    const columnType = getColumnType(config.type);
    const id = String(config.key);

    const meta: CustomColumnMeta = {
      width: config.width,
      align: config.align,
      columnType: config.type,
      editable: config.editable,
      editorConfig: config.editorConfig,
      label: config.label,
      filterable: config.filterable,
      filterType: config.filterType,
      // Enum columns already declare their canonical values for the inline
      // editor — reuse them rather than restating the list per column.
      filterOptions:
        config.filterOptions ??
        (config.editorConfig?.options as readonly string[] | undefined),
      filterOptionLabels: config.filterOptionLabels,
    };

    const column: ColumnDef<T> = {
      id,
      accessorFn: (row) => row[config.key],
      header: config.label,
      enableSorting: Boolean(config.sortable),
      sortingFn: "reactComponent",
      meta,
      cell: ({ row, getValue }) =>
        config.render
          ? config.render(row.original)
          : columnType.render(getValue(), row.original as Record<string, unknown>, {}),
    };

    return column;
  });
}
