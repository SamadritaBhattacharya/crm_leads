import { registerColumnType } from "@/components/table/columnTypes/registry";

registerColumnType<string | null>("text", {
  render: (value) => (
    <span className={value ? "text-zinc-700" : "text-zinc-300"}>
      {value || "—"}
    </span>
  ),
  exportValue: (value) => value ?? "",
});
