import type { LeadNote, LeadOut, LeadSource, LeadStatus } from "@/lib/schemas/lead";
import {
  COMPANY_VALUES,
  LEAD_SOURCE_VALUES,
  LEAD_STATUS_VALUES,
  PROPERTY_TYPE_OPTIONS,
  PURPOSE_OPTIONS,
  SURVEY_TYPE_VALUES,
} from "@/lib/schemas/lead";

// Dev-only seed data so the CRM UI is reviewable without a live FastAPI +
// Supabase backend. Gated behind NEXT_PUBLIC_USE_MOCK — see lib/api/config.ts.
// This never ships as the real data source; it emulates the exact
// TECH_SPEC.md §4/§5 contract shape so swapping to the real API is a
// same-shape drop-in.

const FIRST_NAMES = [
  "Jane", "Michael", "Olivia", "Liam", "Charlotte", "Noah", "Amelia", "Ethan",
  "Isla", "Jack", "Mia", "William", "Ava", "James", "Grace", "Lucas",
  "Sophie", "Henry", "Ruby", "Oscar", "Chloe", "Leo", "Zoe", "Thomas",
];
const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis",
  "Garcia", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Martin",
  "Lee", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott",
];
const SUBURBS = [
  "Sydney NSW", "Parramatta NSW", "Bondi NSW", "Newcastle NSW",
  "Chatswood NSW", "Penrith NSW", "Wollongong NSW", "Liverpool NSW",
];
const ASSIGNEES = ["staff1", "staff2", "staff3", null, null];

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

const rand = seededRandom(42);
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function buildLead(id: number): LeadOut {
  const source = pick(LEAD_SOURCE_VALUES) as LeadSource;
  const status = pick(LEAD_STATUS_VALUES) as LeadStatus;
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  // Spread across ~14 months so the dashboard's financial-year view (July→June)
  // has a full twelve months of history in mock mode, not just the last quarter.
  const daysAgo = Math.floor(rand() * 430);
  const createdAt = new Date(Date.now() - daysAgo * 86400000 - Math.floor(rand() * 86400000));
  const updatedAt = new Date(createdAt.getTime() + Math.floor(rand() * 3 * 86400000));
  const dateOfValuation = new Date(createdAt.getTime() + Math.floor(rand() * 5) * 86400000);

  return {
    id,
    source,
    first_name: first,
    last_name: last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    phone: `04${Math.floor(10000000 + rand() * 89999999)}`,
    property_address: `${Math.floor(rand() * 200) + 1} ${pick(["Example", "Park", "Church", "George", "King", "Victoria"])} St, ${pick(SUBURBS)}`,
    property_type: pick(PROPERTY_TYPE_OPTIONS),
    purpose: pick(PURPOSE_OPTIONS),
    status,
    assigned_to: pick(ASSIGNEES),
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
    // Frontend-only extension — see lib/schemas/lead.ts COMPANY_VALUES note.
    company: pick(COMPANY_VALUES),
    amount: Math.round((1500 + rand() * 8000) * 100) / 100,
    date_of_valuation: dateOfValuation.toISOString(),
    file_no: `FN-${new Date(createdAt).getFullYear()}-${1000 + id}`,
    survey_type: pick(SURVEY_TYPE_VALUES),
  };
}

export const MOCK_LEADS: LeadOut[] = Array.from({ length: 240 }, (_, i) => buildLead(i + 1));

export const MOCK_NOTES: Record<number, LeadNote[]> = {};
MOCK_LEADS.forEach((lead) => {
  const count = Math.floor(rand() * 3);
  MOCK_NOTES[lead.id] = Array.from({ length: count }, (_, i) => ({
    id: lead.id * 10 + i,
    author: pick(["staff1", "staff2", "staff3"]),
    note: pick([
      "Called, left voicemail.",
      "Sent quote by email.",
      "Client requested callback next week.",
      "Confirmed property access for inspection.",
      "Awaiting signed engagement letter.",
    ]),
    created_at: new Date(new Date(lead.created_at).getTime() + (i + 1) * 3600000).toISOString(),
  }));
});
