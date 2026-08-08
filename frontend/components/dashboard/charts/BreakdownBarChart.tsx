"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Monochrome bars — the CRM shell stays strictly black/white/gray; colored
// accents are reserved for the leads table's status badges (TABLE_SPEC.md §7).
export function BreakdownBarChart({
  title,
  data,
}: {
  title: string;
  data: { label: string; count: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64 px-2">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            No data for this month.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f2" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#71717a" }}
                axisLine={{ stroke: "#e4e4e7" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "#f4f4f5" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e4e4e7",
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                }}
              />
              <Bar dataKey="count" fill="#27272a" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
