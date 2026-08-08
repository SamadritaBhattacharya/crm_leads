"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Car, ClipboardList, Monitor, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { KpiTile } from "@/components/dashboard/KpiTile";
import { SurveyTypeLeadsDialog } from "@/components/dashboard/SurveyTypeLeadsDialog";
import { YearlyOverview } from "@/components/dashboard/YearlyOverview";
import { BreakdownBarChart } from "@/components/dashboard/charts/BreakdownBarChart";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { useGetDashboardMonthlyQuery } from "@/lib/api/leadsApi";
import type { SurveyType } from "@/lib/schemas/lead";

type SurveyTileConfig = { surveyType: SurveyType; label: string; icon: LucideIcon };

// One tile per `survey_type` enum member (lib/schemas/lead.ts) — typing
// `surveyType` as SurveyType keeps these keys in lockstep with the backend
// enum, so a renamed value fails the build instead of silently rendering 0.
const SURVEY_TILES: SurveyTileConfig[] = [
  { surveyType: "Inspection", label: "Inspections", icon: Search },
  { surveyType: "External / Desktop Valuation", label: "External / Desktop", icon: Monitor },
  { surveyType: "Kerbside Valuation", label: "Kerbside", icon: Car },
];

export default function DashboardPage() {
  const [month, setMonth] = useState(new Date());
  const monthParam = format(month, "yyyy-MM");
  const { data, isFetching } = useGetDashboardMonthlyQuery(monthParam);

  // Kept set after the dialog closes so its exit animation still has a title
  // to render; `open` alone drives visibility.
  const [activeTile, setActiveTile] = useState<SurveyTileConfig | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // by_survey_type only carries the types present in the month, so absent
  // types have to fall back to 0 rather than dropping their tile.
  const surveyCounts = new Map(
    (data?.by_survey_type ?? []).map((d) => [d.survey_type, d.count])
  );

  const tiles = [
    {
      key: "total_valuations",
      label: "Total Valuations",
      value: data?.total_valuations ?? 0,
      icon: ClipboardList,
      config: undefined as SurveyTileConfig | undefined,
    },
    ...SURVEY_TILES.map((tile) => ({
      key: tile.surveyType,
      label: tile.label,
      value: surveyCounts.get(tile.surveyType) ?? 0,
      icon: tile.icon,
      config: tile,
    })),
  ];

  function openSurveyTile(config: SurveyTileConfig) {
    setActiveTile(config);
    setDialogOpen(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Monthly overview</h2>
          <p className="text-sm text-zinc-500">
            Rollup figures for the selected month, driven by the materialized view.
          </p>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      {/* One row of four on lg+; the basis/min-width pair drops it to two-up
          then one-up as the viewport narrows, without a second breakpoint. */}
      <div className="flex flex-wrap gap-4">
        {tiles.map(({ config, ...tile }, index) => (
          <motion.div
            key={tile.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: index * 0.05 }}
            whileHover={config ? { y: -3 } : undefined}
            whileTap={config ? { scale: 0.985 } : undefined}
            // `grid` (not block) so the card stretches to the row's tallest
            // tile when a label wraps at narrow widths.
            className="grid min-w-[200px] flex-1 basis-[calc(50%-0.5rem)] lg:basis-0"
          >
            <KpiTile
              label={tile.label}
              value={tile.value}
              icon={tile.icon}
              isLoading={isFetching}
              onClick={config ? () => openSurveyTile(config) : undefined}
            />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownBarChart
          title="Valuation types"
          data={(data?.by_property_type ?? []).map((d) => ({ label: d.type, count: d.count }))}
        />
        <BreakdownBarChart
          title="Purpose of valuation"
          data={(data?.by_purpose ?? []).map((d) => ({ label: d.purpose, count: d.count }))}
        />
      </div>

      <div className="h-px bg-zinc-200" />

      {/* yearly overview added with Aus FYI*/}
      <YearlyOverview />

      {activeTile && (
        // Keyed on the survey type so switching tiles remounts with fresh
        // sort/page state instead of inheriting the last tile's.
        <SurveyTypeLeadsDialog
          key={activeTile.surveyType}
          surveyType={activeTile.surveyType}
          label={activeTile.label}
          month={month}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </motion.div>
  );
}
