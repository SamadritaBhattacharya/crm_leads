"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CATEGORICAL_STEPS,
  CHART_SURFACE,
  TOOLTIP_STYLE,
  toTopSlices,
} from "@/components/dashboard/charts/chartTheme";

/**
 * Part-to-whole at a glance, capped at six slices. The legend below carries
 * name + count + share for every slice, which is what makes a gray ramp
 * readable: no value here is reachable by fill alone.
 */
export function BreakdownDonutChart({
  title,
  subtitle,
  data,
  isLoading,
}: {
  title: string;
  subtitle?: string;
  data: { label: string; count: number }[];
  isLoading?: boolean;
}) {
  const slices = toTopSlices(data);
  const total = slices.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </CardHeader>
      <CardContent className="px-4">
        {total === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-zinc-400">
            {isLoading ? "Loading…" : "No data for this financial year."}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="count"
                    nameKey="label"
                    innerRadius="62%"
                    outerRadius="92%"
                    startAngle={90}
                    endAngle={-270}
                    // A 2px surface ring rather than a border, so adjacent
                    // gray steps separate without drawing outlines.
                    stroke={CHART_SURFACE}
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={450}
                  >
                    {slices.map((slice, index) => (
                      <Cell
                        key={slice.label}
                        fill={CATEGORICAL_STEPS[index % CATEGORICAL_STEPS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => {
                      const count = Number(value ?? 0);
                      return [
                        `${count} (${Math.round((count / total) * 100)}%)`,
                        String(name ?? ""),
                      ];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* The headline the donut is really about, in the hole. */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold text-zinc-900">{total}</span>
                <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                  leads
                </span>
              </div>
            </div>

            <dl className="flex flex-col gap-1.5">
              {slices.map((slice, index) => (
                <div key={slice.label} className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        CATEGORICAL_STEPS[index % CATEGORICAL_STEPS.length],
                    }}
                  />
                  <dt className="truncate text-zinc-600">{slice.label}</dt>
                  <dd className="ml-auto shrink-0 tabular-nums text-zinc-500">
                    {slice.count}
                    <span className="ml-1.5 text-zinc-400">
                      {Math.round((slice.count / total) * 100)}%
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
