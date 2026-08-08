import type { ReactNode } from "react";

import {
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";

// TABLE_SPEC.md §4.1
export type ColumnType =
  | "text"
  | "email"
  | "phone"
  | "address"
  | "date"
  | "datetime"
  | "enum"
  | "multiEnum"
  | "badge"
  | "user"
  | "link"
  | "number"
  | "numberCompare";

export type ColumnConfig<T> = {
  key: keyof T;
  label: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: string;
  type: ColumnType;
  editable?: boolean;
  editorConfig?: Record<string, unknown>;
  visibleForRoles?: ("admin" | "staff")[];
  // components/filter/filter.md §3 — per-column header filter. `options` is a
  // checkbox list, `compare` a numeric operator + value.
  filterable?: boolean;
  filterType?: ColumnFilterType;
  /**
   * Canonical option list for a `filterType: "options"` column. Omit and the
   * dropdown derives options from the loaded rows — fine for a client-side
   * table, but on a server-paginated one that only sees the current page, so
   * prefer an explicit list (or `editorConfig.options`) here.
   */
  filterOptions?: readonly string[];
  /**
   * Optional value -> human label map for a `filterType: "options"` column.
   * The filter value on the wire stays the raw option; only the checkbox label
   * shown in the dropdown is swapped. Omit and the raw value is displayed.
   */
  filterOptionLabels?: Record<string, string>;
};

// components/filter/filter.md §4.2/§4.3 — the two filter shapes, kept as the
// spec names them so the wire format reads the same.
export type ColumnFilterType = "options" | "compare";

export type CompareOperator = ">" | "<" | "=" | ">=" | "<=";

export const COMPARE_OPERATORS: { value: CompareOperator; label: string }[] = [
  { value: ">", label: "Greater than" },
  { value: "<", label: "Less than" },
  { value: "=", label: "Equal to" },
  { value: ">=", label: "Greater or equal" },
  { value: "<=", label: "Less or equal" },
];

export type ColumnFilter =
  | { type: "options"; values: string[] }
  | { type: "compare"; operator: CompareOperator; value: number };

/** Keyed by column id — exactly the `activeFilters` map from the spec. */
export type ColumnFilters = Record<string, ColumnFilter>;

// TABLE_SPEC.md §4.2
export type CustomColumnMeta = {
  width?: string;
  align?: "left" | "right" | "center";
  columnType: ColumnType;
  editable?: boolean;
  editorConfig?: Record<string, unknown>;
  label: string;
  filterable?: boolean;
  filterType?: ColumnFilterType;
  filterOptions?: readonly string[];
  filterOptionLabels?: Record<string, string>;
};

// TABLE_SPEC.md §5.2 — Filter type union
export type Filter =
  | { type: "multiSelect"; values: string[] }
  | { type: "singleSelect"; values: string[] }
  | { type: "number"; min?: number; max?: number }
  | { type: "numberCompare"; operator: ">" | "<" | ">=" | "<=" | "="; value: number }
  | { type: "value"; value: string };

export type FilterConfig<T> = {
  column: keyof T;
  filter: Filter;
};

export type RenderCtx = {
  isHighlighted?: boolean;
};

export type FilterUiProps<V> = {
  value: V | undefined;
  onChange: (value: V) => void;
};

export type EditorProps<V> = {
  value: V;
  row: Record<string, unknown>;
  onCommit: (value: V) => void;
  onCancel: () => void;
};

export type ColumnTypeHandler<V> = {
  render: (value: V, row: Record<string, unknown>, ctx: RenderCtx) => ReactNode;
  filterUi?: React.FC<FilterUiProps<unknown>>;
  editor?: React.FC<EditorProps<V>>;
  exportValue: (value: V) => string | number | boolean;
  toFilter?: (uiState: unknown) => Filter;
};


export type TanStackTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  filterConfig?: FilterConfig<T>[];
  enablePagination?: boolean;
  className?: string;
  searchColumns?: string[];
  tableSearchTerm?: string;
  isEnterPressed?: boolean;
  stickyTable?: boolean;
  defaultSortColumnId?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;

  // TABLE_SPEC.md §3 — server-paginated deviation. When `manual` is true,
  // filtering/sorting/pagination state is the source of truth for API query
  // params (owned by the consumer), not for filtering an in-memory array.
  manual?: boolean;
  total?: number;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  pagination?: PaginationState;
  onPaginationChange?: (pagination: PaginationState) => void;

  // Header-dropdown filters. Controlled by the consumer for the same reason
  // sorting is: on a manual table these become API query params.
  columnFilters?: ColumnFilters;
  onColumnFilterChange?: (columnId: string, filter: ColumnFilter | null) => void;
  /** Column id whose sort the reset button restores. */
  initialSortColumnId?: string;

  // Checkbox column, prepended automatically when true — a "Select" toggle
  // in the consumer's toolbar flips this on rather than the column always
  // being present. Selection is keyed by row id (not index), so it survives
  // a manual-mode page change.
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
};