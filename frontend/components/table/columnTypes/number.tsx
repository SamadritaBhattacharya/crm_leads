import { registerColumnType } from "@/components/table/columnTypes/registry";

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 2,
});

registerColumnType<number | null>("number", {
  render: (value) =>
    value === null || value === undefined ? (
      <span className="text-zinc-300">—</span>
    ) : (
      <span className="tabular-nums text-zinc-700">{currencyFormatter.format(value)}</span>
    ),
  exportValue: (value) => value ?? "",
});
