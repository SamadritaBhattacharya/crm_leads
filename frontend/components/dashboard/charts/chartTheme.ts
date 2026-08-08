// Single source of chart styling for the dashboard — the CRM shell is
// strictly black/white/gray, so identity is carried by lightness steps plus
// legends and direct values, never by hue.
//
// Palette validated with the dataviz skill's validate_palette.js:
//   CVD separation PASS (worst adjacent ΔE 15.9 protan / 16.0 tritan)
//   Normal-vision floor PASS (15.9)
//   Chroma-floor and lightness-band FAILs are inherent to a grayscale brand.
//   Contrast WARN on the two lightest steps is paid off the way the skill
//   requires: every chart ships a legend listing the value for each series, so
//   no figure is reachable by color alone.

/** Fixed order, never cycled. A 6th category folds into "Other" (see CHART_OTHER_LABEL). */
export const CATEGORICAL_STEPS = [
  "#18181b",
  "#3f3f46",
  "#71717a",
  "#a1a1aa",
  "#d4d4d8",
] as const;

export const CHART_OTHER_LABEL = "Other";

/** Two-series comparison: received vs converted, echoing the mock's light/dark pairing. */
export const SERIES_COLORS = {
  primary: "#d4d4d8",
  emphasis: "#3f3f46",
} as const;

export const CHART_SURFACE = "#ffffff";
export const GRID_STROKE = "#f1f1f3";
export const AXIS_LINE = "#e4e4e7";
export const AXIS_TICK = { fontSize: 11, fill: "#71717a" } as const;

// Solid hairlines only — dashed gridlines read as "threshold" when they're
// just a grid.
export const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #e4e4e7",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
} as const;

export const TOOLTIP_CURSOR = { fill: "#f4f4f5" } as const;

/**
 * Caps a breakdown at five slices plus an "Other" bucket — past that, adjacent
 * gray steps stop being separable. Sorted descending so the ramp runs with
 * magnitude instead of against it.
 */
export function toTopSlices(
  data: { label: string; count: number }[],
  limit = CATEGORICAL_STEPS.length
): { label: string; count: number }[] {
  const sorted = [...data].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  if (sorted.length <= limit) return sorted;

  const head = sorted.slice(0, limit - 1);
  const tail = sorted.slice(limit - 1);
  return [
    ...head,
    { label: CHART_OTHER_LABEL, count: tail.reduce((sum, d) => sum + d.count, 0) },
  ];
}
