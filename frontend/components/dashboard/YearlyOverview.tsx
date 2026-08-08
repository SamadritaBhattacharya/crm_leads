"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, CalendarRange, Percent, Trophy } from "lucide-react";

import { KpiTile } from "@/components/dashboard/KpiTile";
import {
  FinancialYearSelector,
  currentFinancialYear,
} from "@/components/dashboard/FinancialYearSelector";
import { FyVolumeBarChart } from "@/components/dashboard/charts/FyVolumeBarChart";
import { BreakdownDonutChart } from "@/components/dashboard/charts/BreakdownDonutChart";
import { useGetDashboardYearlyQuery } from "@/lib/api/leadsApi";

export function YearlyOverview() {
  const [fyStartYear, setFyStartYear] = useState(currentFinancialYear());
  const { data, isFetching } = useGetDashboardYearlyQuery(fyStartYear);

  const stats = [
    {
      key: "total",
      label: "Leads This Year",
      value: data?.total_valuations ?? 0,
      icon: CalendarRange,
    },
    {
      key: "converted",
      label: "Converted",
      value: data?.completed_inspections ?? 0,
      icon: Building2,
    },
    {
      key: "rate",
      label: "Conversion Rate",
      value: `${data?.conversion_rate ?? 0}%`,
      icon: Percent,
    },
    {
      key: "busiest",
      label: "Busiest Month",
      value: data?.busiest_month ?? "—",
      icon: Trophy,
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-5"
    >
      {/* One filter row above everything it scopes — every chart below reads
          the same financial year. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Yearly overview</h2>
          <p className="text-sm text-zinc-500">
            Full financial year, July through June, across the whole valuation book.
          </p>
        </div>
        <FinancialYearSelector fyStartYear={fyStartYear} onChange={setFyStartYear} />
      </div>

      <div className="flex flex-wrap gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: index * 0.05 }}
            className="grid min-w-[200px] flex-1 basis-[calc(50%-0.5rem)] lg:basis-0"
          >
            <KpiTile
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              isLoading={isFetching}
            />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.08 }}
      >
        <FyVolumeBarChart data={data?.by_month ?? []} isLoading={isFetching} />
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          {
            key: "property",
            title: "Property type mix",
            subtitle: "Where the year's valuation work sat.",
            data: (data?.by_property_type ?? []).map((d) => ({
              label: d.type,
              count: d.count,
            })),
          },
          {
            key: "purpose",
            title: "Purpose of valuation",
            subtitle: "Why clients commissioned a valuation.",
            data: (data?.by_purpose ?? []).map((d) => ({
              label: d.purpose,
              count: d.count,
            })),
          },
          {
            key: "survey",
            title: "Survey type mix",
            subtitle: "Inspection effort behind the book.",
            data: (data?.by_survey_type ?? []).map((d) => ({
              label: d.survey_type,
              count: d.count,
            })),
          },
        ].map((chart, index) => (
          <motion.div
            key={chart.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut", delay: 0.12 + index * 0.06 }}
          >
            <BreakdownDonutChart
              title={chart.title}
              subtitle={chart.subtitle}
              data={chart.data}
              isLoading={isFetching}
            />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
