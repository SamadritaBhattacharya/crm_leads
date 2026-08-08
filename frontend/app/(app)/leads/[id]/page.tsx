"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGetLeadQuery } from "@/lib/api/leadsApi";
import { LeadDetailContent } from "@/components/leads/LeadDetailContent";

// Deep-linkable fallback route (SYSTEM_ARCHITECTURE.md §3) — the primary UX
// is the row-click Sheet in /leads, but a direct URL to a single lead still
// resolves to a full page rendering the same shared detail content.
export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: lead, isLoading } = useGetLeadQuery(Number(id));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit gap-1.5 text-zinc-500"
        onClick={() => router.push("/leads")}
      >
        <ArrowLeft className="size-3.5" />
        Back to leads
      </Button>

      <Card>
        <CardContent>
          {isLoading || !lead ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-zinc-400" />
            </div>
          ) : (
            <LeadDetailContent key={lead.id} lead={lead} onDeleted={() => router.push("/leads")} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
