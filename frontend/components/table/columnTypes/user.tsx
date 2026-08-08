import { registerColumnType } from "@/components/table/columnTypes/registry";

function initials(name: string): string {
  return name
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

registerColumnType<string | null>("user", {
  render: (value) =>
    value ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="flex size-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-50">
          {initials(value)}
        </span>
        <span className="text-zinc-700">{value}</span>
      </span>
    ) : (
      <span className="text-zinc-300">Unassigned</span>
    ),
  exportValue: (value) => value ?? "",
});
