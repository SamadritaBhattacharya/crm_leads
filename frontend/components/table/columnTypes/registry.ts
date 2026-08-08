import type { ColumnType, ColumnTypeHandler } from "@/components/table/types";

// TABLE_SPEC.md §7 — the extension point. Every columnTypes/*.tsx file
// self-registers on import (side-effect import in TanstackTable.tsx). Adding
// a new type is a new file — nothing else changes (Open/Closed, mirrors the
// backend LeadSource/LeadStatus pattern).
const registry = new Map<ColumnType, ColumnTypeHandler<unknown>>();

export function registerColumnType<V>(type: ColumnType, handler: ColumnTypeHandler<V>) {
  registry.set(type, handler as unknown as ColumnTypeHandler<unknown>);
}

export function getColumnType<V = unknown>(type: ColumnType): ColumnTypeHandler<V> {
  const handler = registry.get(type);
  if (!handler) {
    throw new Error(`Unknown column type: "${type}". Register it in columnTypes/registry.ts.`);
  }
  return handler as unknown as ColumnTypeHandler<V>;
}
