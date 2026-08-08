"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteLeadMutation } from "@/lib/api/leadsApi";
import type { LeadOut } from "@/lib/schemas/lead";

// Mirrors the delete flow in LeadDetailContent.tsx (same confirm-dialog
// copy) so a row can be deleted without opening the sheet. Open to any
// staff session, not just admins — see LeadDetailContent.tsx for the same.
export function RowActions({ lead, onEdit }: { lead: LeadOut; onEdit: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteLead, { isLoading }] = useDeleteLeadMutation();

  async function handleDelete() {
    try {
      await deleteLead(lead.id).unwrap();
      toast.success("Lead deleted successfully");
      setConfirmOpen(false);
    } catch {
      toast.error("Couldn't delete lead", { description: "Please try again." });
    }
  }

  return (
    <>
      <div
        className="flex items-center justify-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label="Edit lead"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-red-500 hover:bg-red-50 hover:text-red-600"
          onClick={() => setConfirmOpen(true)}
          aria-label="Delete lead"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete this lead?</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "this lead"}{" "}
              and its notes. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
