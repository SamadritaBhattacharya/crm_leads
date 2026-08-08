"use client";

import { useState } from "react";
import { CalendarIcon, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";

// Backend LeadManualCreate.date_of_valuation is a `date`, not `datetime`
// (backend/app/schemas/lead.py) — Pydantic v2 rejects ISO datetime strings
// (with the T00:00:00 suffix) for `date` fields, returning 422. Use the
// YYYY-MM-DD shape the backend expects.
const DATE_VALUE_FORMAT = "yyyy-MM-dd";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useCreateManualLeadMutation } from "@/lib/api/leadsApi";
import {
  COMPANY_VALUES,
  leadManualCreateSchema,
  PROPERTY_TYPE_OPTIONS,
  PURPOSE_OPTIONS,
  SURVEY_TYPE_VALUES,
  type LeadManualCreate,
} from "@/lib/schemas/lead";
import { cn } from "@/lib/utils";

const ASSIGNEES = ["staff1", "staff2", "staff3"];

const EMPTY_FORM: LeadManualCreate = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  property_address: "",
  property_type: "",
  purpose: "",
  assigned_to: null,
  company: null,
  amount: null,
  date_of_valuation: null,
  file_no: "",
  survey_type: null,
};

// backend/app/schemas/lead.py LeadManualCreate via POST /api/leads/manual —
// for staff entering a lead the public form never captured (phone call,
// walk-in, referral). Always lands as source=manual_entry, status=new
// (backend §14), so this form only collects the fields that schema accepts.
export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LeadManualCreate>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof LeadManualCreate, string>>>({});
  const [createLead, { isLoading }] = useCreateManualLeadMutation();

  function update<K extends keyof LeadManualCreate>(key: K, value: LeadManualCreate[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetAndClose() {
    setForm(EMPTY_FORM);
    setErrors({});
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = leadManualCreateSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof LeadManualCreate;
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    try {
      const created = await createLead(result.data).unwrap();
      toast.success("Lead added", {
        description: [created.first_name, created.last_name].filter(Boolean).join(" ") || created.email,
      });
      resetAndClose();
    } catch (err) {
      // RTK Query's `unwrap()` failure is `{ status, data }`, not a string
      // or Error. The backend returns `{ detail: ... }` for validation
      // failures, which can itself be a string OR an array of field errors
      // (FastAPI 422 shape) — collapse both into a readable line.
      const data = (err as { data?: unknown })?.data;
      const detail = (data as { detail?: unknown })?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail
                .map((e) =>
                  typeof e === "object" && e !== null && "msg" in e
                    ? String((e as { msg: unknown }).msg)
                    : JSON.stringify(e)
                )
                .join("; ")
            : typeof err === "string"
              ? err
              : (err as { message?: string })?.message;
      toast.error("Couldn't add lead", {
        description: message || "Please check the details and try again.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-full gap-1.5 text-xs cursor-pointer">
          <Plus className="size-4" />
          Add lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md lg:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a lead manually</DialogTitle>
          <DialogDescription>
            For enquiries that didn&apos;t come through the public site — a phone call, walk-in, or referral.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                value={form.first_name ?? ""}
                onChange={(e) => update("first_name", e.target.value)}
              />
              {errors.first_name && <p className="text-xs text-red-600">{errors.first_name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                value={form.last_name ?? ""}
                onChange={(e) => update("last_name", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
            {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="property_type">Property type</Label>
              <Select
                value={form.property_type ?? ""}
                onValueChange={(v) => update("property_type", v)}
              >
                <SelectTrigger id="property_type" size="sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="property_address">Property address</Label>
            <Textarea
              id="property_address"
              className="min-h-14"
              value={form.property_address ?? ""}
              onChange={(e) => update("property_address", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company">Company</Label>
              <Select
                value={form.company ?? ""}
                onValueChange={(v) => update("company", v as LeadManualCreate["company"])}
              >
                <SelectTrigger id="company" size="sm">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_VALUES.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="survey_type">Survey type</Label>
              <Select
                value={form.survey_type ?? ""}
                onValueChange={(v) => update("survey_type", v as LeadManualCreate["survey_type"])}
              >
                <SelectTrigger id="survey_type" size="sm">
                  <SelectValue placeholder="Select survey type" />
                </SelectTrigger>
                <SelectContent>
                  {SURVEY_TYPE_VALUES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="file_no">File No.</Label>
              <Input
                id="file_no"
                value={form.file_no ?? ""}
                onChange={(e) => update("file_no", e.target.value.toUpperCase())}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Date of valuation</Label>
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
                    {form.date_of_valuation
                      ? format(new Date(form.date_of_valuation), "dd MMM yyyy")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <Calendar
                    mode="single"
                    selected={form.date_of_valuation ? new Date(form.date_of_valuation) : undefined}
                    onSelect={(date) =>
                      update("date_of_valuation", date ? format(date, DATE_VALUE_FORMAT) : null)
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purpose">Purpose</Label>
              <Select
                value={form.purpose ?? ""}
                onValueChange={(v) => update("purpose", v)}
              >
                <SelectTrigger id="purpose" size="sm">
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map((purpose) => (
                    <SelectItem key={purpose} value={purpose}>
                      {purpose}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount ?? ""}
                onChange={(e) => update("amount", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Assign to</Label>
            <Select
              value={form.assigned_to ?? "unassigned"}
              onValueChange={(v) => update("assigned_to", v === "unassigned" ? null : v)}
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

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Add lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
