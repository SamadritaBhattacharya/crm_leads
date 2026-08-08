"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  CalendarIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_COLORS } from "@/components/table/columnTypes/badge";
import {
  useAddLeadNoteMutation,
  useDeleteLeadMutation,
  useUpdateLeadMutation,
} from "@/lib/api/leadsApi";
import {
  COMPANY_VALUES,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_VALUES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TRANSITIONS,
  PROPERTY_TYPE_OPTIONS,
  PURPOSE_OPTIONS,
  SURVEY_TYPE_VALUES,
  type LeadDetail,
  type LeadUpdate,
} from "@/lib/schemas/lead";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const ASSIGNEES = ["staff1", "staff2", "staff3"];

// Every field below except id/created_at/updated_at/notes is editable in
// this form. Only `status` and `assigned_to` are part of the real backend
// PATCH /api/leads/{id} contract (TECH_SPEC.md §5) — the rest (name,
// contact, property, source, and the company/amount/date_of_valuation/
// file_no/survey_type group) are frontend-only until the backend's
// LeadUpdate schema and `leads` table grow to match (see lib/schemas/lead.ts).
const EDITABLE_KEYS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "property_address",
  "property_type",
  "purpose",
  "source",
  "company",
  "survey_type",
  "file_no",
  "date_of_valuation",
  "amount",
  "status",
  "assigned_to",
] as const satisfies readonly (keyof LeadDetail)[];

function diffPatch(original: LeadDetail, draft: LeadDetail): LeadUpdate {
  const patch: Record<string, unknown> = {};
  EDITABLE_KEYS.forEach((key) => {
    if (draft[key] !== original[key]) patch[key] = draft[key];
  });
  return patch as LeadUpdate;
}

// Shared detail body used by both the row-click Sheet (components/leads/
// LeadDetailSheet.tsx) and the deep-linkable /leads/[id] route
// (SYSTEM_ARCHITECTURE.md §3) — one implementation, two shells. The parent
// keys this component by lead.id so switching leads resets the draft below.
export function LeadDetailContent({
  lead,
  onDeleted,
}: {
  lead: LeadDetail;
  onDeleted?: () => void;
}) {
  const [updateLead, { isLoading: isSaving }] = useUpdateLeadMutation();
  const [addNote, { isLoading: isAddingNote }] = useAddLeadNoteMutation();
  const [deleteLead, { isLoading: isDeleting }] = useDeleteLeadMutation();

  const [form, setForm] = useState<LeadDetail>(lead);
  const [noteText, setNoteText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const session = getSession();

  const patch = diffPatch(lead, form);
  const isDirty = Object.keys(patch).length > 0;

  function set<K extends keyof LeadDetail>(key: K, value: LeadDetail[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!isDirty) return;

    // An invalid staged status must not block saving everything else the
    // user changed — drop just that key and keep going, rather than
    // silently discarding the whole patch (File No., Amount, etc. included).
    const finalPatch = { ...patch };
    if (finalPatch.status && finalPatch.status !== lead.status) {
      const allowed = LEAD_STATUS_TRANSITIONS[lead.status];
      if (!allowed.includes(finalPatch.status)) {
        toast.error("Status change skipped", {
          description: `Can't move from ${LEAD_STATUS_LABELS[lead.status]} to ${LEAD_STATUS_LABELS[finalPatch.status]} — other changes were still saved.`,
        });
        delete finalPatch.status;
      }
    }

    if (Object.keys(finalPatch).length === 0) return;

    try {
      await updateLead({ id: lead.id, patch: finalPatch }).unwrap();
      toast.success("Lead saved");
    } catch {
      toast.error("Couldn't save changes", { description: "Please try again." });
    }
  }

  async function handleAddNote() {
    if (!noteText.trim() || !session) return;
    try {
      await addNote({ id: lead.id, note: { note: noteText.trim(), author: session.username } }).unwrap();
      setNoteText("");
    } catch {
      toast.error("Couldn't add note");
    }
  }

  async function handleDelete() {
    try {
      await deleteLead(lead.id).unwrap();
      toast.success("Lead deleted");
      setConfirmDelete(false);
      onDeleted?.();
    } catch {
      toast.error("Couldn't delete lead");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2 pr-8">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              {[form.first_name, form.last_name].filter(Boolean).join(" ") || "Unnamed lead"}
            </h2>
            <p className="text-xs text-zinc-500">Lead #{lead.id}</p>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium",
              STATUS_COLORS[lead.status]
            )}
          >
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">First name</label>
            <Input
              value={form.first_name ?? ""}
              onChange={(e) => set("first_name", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Last name</label>
            <Input
              value={form.last_name ?? ""}
              onChange={(e) => set("last_name", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Phone</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
              <Input
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Source</label>
            <Select value={form.source} onValueChange={(v) => set("source", v as LeadDetail["source"])}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCE_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">Property address</label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-zinc-400" />
            <Textarea
              value={form.property_address ?? ""}
              onChange={(e) => set("property_address", e.target.value)}
              className="min-h-14 pl-8 text-sm"
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Property type</label>
            <Select
              value={form.property_type ?? ""}
              onValueChange={(v) => set("property_type", v)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Purpose</label>
            <Select value={form.purpose ?? ""} onValueChange={(v) => set("purpose", v)}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Select purpose" />
              </SelectTrigger>
              <SelectContent>
                {PURPOSE_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-zinc-400">Received</p>
            <p className="text-zinc-700">{format(new Date(lead.created_at), "dd MMM yyyy, HH:mm")}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Last updated</p>
            <p className="text-zinc-700">{format(new Date(lead.updated_at), "dd MMM yyyy, HH:mm")}</p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Company</label>
            <Select
              value={form.company ?? "none"}
              onValueChange={(v) => set("company", v === "none" ? null : (v as LeadDetail["company"]))}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {COMPANY_VALUES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Survey type</label>
            <Select
              value={form.survey_type ?? "none"}
              onValueChange={(v) =>
                set("survey_type", v === "none" ? null : (v as LeadDetail["survey_type"]))
              }
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {SURVEY_TYPE_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">File No.</label>
            <Input
              value={form.file_no ?? ""}
              onChange={(e) => set("file_no", e.target.value.toUpperCase())}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Date of valuation</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start gap-1.5 font-normal text-zinc-600",
                    form.date_of_valuation && "text-zinc-900"
                  )}
                >
                  <CalendarIcon className="size-3.5" />
                  {form.date_of_valuation ? format(new Date(form.date_of_valuation), "dd MMM yyyy") : "—"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <Calendar
                  mode="single"
                  selected={form.date_of_valuation ? new Date(form.date_of_valuation) : undefined}
                  onSelect={(date) => set("date_of_valuation", date ? date.toISOString() : null)}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Amount</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.amount ?? ""}
              onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Status</label>
            <Select value={form.status} onValueChange={(v) => set("status", v as LeadDetail["status"])}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={lead.status}>{LEAD_STATUS_LABELS[lead.status]}</SelectItem>
                {LEAD_STATUS_TRANSITIONS[lead.status].map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Assigned to</label>
            <Select
              value={form.assigned_to ?? "unassigned"}
              onValueChange={(v) => set("assigned_to", v === "unassigned" ? null : v)}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {ASSIGNEES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-zinc-500">Notes</p>
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            {lead.notes.length === 0 && <p className="text-xs text-zinc-400">No notes yet.</p>}
            {lead.notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-xs">
                <div className="mb-1 flex items-center justify-between text-zinc-400">
                  <span className="font-medium text-zinc-600">{note.author}</span>
                  <span>{format(new Date(note.created_at), "dd MMM, HH:mm")}</span>
                </div>
                <p className="text-zinc-700">{note.note}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note…"
              className="min-h-16 text-xs"
            />
            <Button
              size="icon"
              className="shrink-0 self-end"
              onClick={handleAddNote}
              disabled={isAddingNote || !noteText.trim()}
            >
              {isAddingNote ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <Button onClick={handleSave} disabled={!isDirty || isSaving} className="gap-2">
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save changes
          </Button>

          <Button
            variant="outline"
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            Delete lead
          </Button>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this lead?</DialogTitle>
            <DialogDescription>
              This permanently removes the lead and its notes. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
