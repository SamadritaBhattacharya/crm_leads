import { registerColumnType } from "@/components/table/columnTypes/registry";

registerColumnType<string | null>("link", {
  render: (value) =>
    value ? (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-blue-600 hover:text-blue-700 hover:underline"
      >
        {value}
      </a>
    ) : (
      <span className="text-zinc-300">—</span>
    ),
  exportValue: (value) => value ?? "",
});
