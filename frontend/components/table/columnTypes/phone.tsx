import { registerColumnType } from "@/components/table/columnTypes/registry";

registerColumnType<string | null>("phone", {
  render: (value) =>
    value ? (
      <span className="tabular-nums text-zinc-700">{value}</span>
    ) : (
      <span className="text-zinc-300">—</span>
    ),
  exportValue: (value) => value ?? "",
});
