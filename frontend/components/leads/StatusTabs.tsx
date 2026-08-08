"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LEAD_STATUS_LABELS, LEAD_STATUS_VALUES, type LeadStatus } from "@/lib/schemas/lead";

const OPTIONS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...LEAD_STATUS_VALUES.map((v) => ({ value: v, label: LEAD_STATUS_LABELS[v] })),
];

// PRD.md §6.2 — filter by status; Salesforce-style list-view tabs rather
// than a dropdown, since status is the primary way staff triage the queue.
export function StatusTabs({
  value,
  onChange,
}: {
  value: LeadStatus | "all";
  onChange: (value: LeadStatus | "all") => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as LeadStatus | "all")}>
      <TabsList>
        {OPTIONS.map((opt) => (
          <TabsTrigger key={opt.value} value={opt.value}>
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
