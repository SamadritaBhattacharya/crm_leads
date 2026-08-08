"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AXIS_LINE,
  AXIS_TICK,
  GRID_STROKE,
  SERIES_COLORS,
  TOOLTIP_CURSOR,
  TOOLTIP_STYLE,
} from "@/components/dashboard/charts/chartTheme";

type MonthPoint = { label: string; total: number; converted: number };

/**
 * The financial year's job volume, July→June. Two series on one axis (never a
 * second y-scale): Leads received against the subset that converted, so the gap
 * between the pair reads as the month's open pipeline.
 */
export function FyVolumeBarChart({
  data,
  isLoading,
}: {
  data: MonthPoint[];
  isLoading?: boolean;
}) {
  const hasData = data.some((d) => d.total > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Valuation Leads by month</CardTitle>
        <p className="text-xs text-zinc-500">
          Leads received against those converted, July through June.
        </p>
      </CardHeader>
      {/* Height covers plot + legend + x-axis band so the axis is never
          clipped into a nested scrollbar. */}
      <CardContent className="h-80 px-2">
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            {isLoading ? "Loading…" : "No Leads recorded for this financial year."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
              barGap={2}
              barCategoryGap="22%"
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={{ stroke: AXIS_LINE }}
                tickLine={false}
                interval={0}
                height={28}
              />
              <YAxis
                allowDecimals={false}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip cursor={TOOLTIP_CURSOR} contentStyle={TOOLTIP_STYLE} />
              <Legend
                verticalAlign="top"
                align="center"
                height={28}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-zinc-600">{value}</span>
                )}
              />
              <Bar
                dataKey="total"
                name="Leads received"
                fill={SERIES_COLORS.primary}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
              <Bar
                dataKey="converted"
                name="Converted"
                fill={SERIES_COLORS.emphasis}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
