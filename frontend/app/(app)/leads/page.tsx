"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import type { LeadOut } from "@/lib/schemas/lead";

export default function LeadsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function openLead(lead: LeadOut) {
    setSelectedId(lead.id);
    setSheetOpen(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col gap-3"
    >
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Leads</h2>
        <p className="text-xs text-zinc-500">
          Every valuation enquiry that&apos;s come through the public site, live.
        </p>
      </div>

      <LeadsTable onRowClick={openLead} />

      <LeadDetailSheet leadId={selectedId} open={sheetOpen} onOpenChange={setSheetOpen} />
    </motion.div>
  );
}
