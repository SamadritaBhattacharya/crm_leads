"use client";

import { Loader2 } from "lucide-react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useGetLeadQuery } from "@/lib/api/leadsApi";
import { LeadDetailContent } from "@/components/leads/LeadDetailContent";

export function LeadDetailSheet({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: lead, isLoading } = useGetLeadQuery(leadId ?? -1, { skip: !leadId });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto px-6 py-6">
        {isLoading || !lead ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-zinc-400" />
          </div>
        ) : (
          <LeadDetailContent key={lead.id} lead={lead} onDeleted={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  );
}
