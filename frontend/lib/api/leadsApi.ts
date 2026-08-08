import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

import { API_BASE_URL, USE_MOCK } from "@/lib/api/config";
import {
  mockAddNote,
  mockCreateManualLead,
  mockDeleteLead,
  mockDashboardMonthly,
  mockDashboardYearly,
  mockExportCsv,
  mockGetLead,
  mockListLeads,
  mockUpdateLead,
} from "@/lib/mock/server";
import type {
  DashboardMonthly,
  DashboardYearly,
  LeadDetail,
  LeadManualCreate,
  LeadNoteCreate,
  LeadOut,
  LeadUpdate,
  LeadsListResponse,
  LeadsQuery,
} from "@/lib/schemas/lead";

// TECH_SPEC.md §4.3 — query params the real GET /api/leads accepts.
function toSearchParams(query: Partial<LeadsQuery>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    // Multi-select column filters go out as repeated params, which is what
    // FastAPI's `list[X] | None = Query(None)` reads back as a list.
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, String(entry)));
      return;
    }
    params.set(key, String(value));
  });
  return params.toString();
}

async function realFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include", // HttpOnly cookie JWT — TECH_SPEC.md §6.2
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Custom async baseQuery (not fetchBaseQuery) so it can transparently route
// through lib/mock/server.ts in dev — see lib/api/config.ts. Both branches
// honor the exact TECH_SPEC.md §4 request/response contract.
export const leadsApi = createApi({
  reducerPath: "leadsApi",
  baseQuery: fakeBaseQuery<string>(),
  tagTypes: ["Lead", "LeadList", "Dashboard"],
  endpoints: (builder) => ({
    getLeads: builder.query<LeadsListResponse, Partial<LeadsQuery>>({
      async queryFn(query) {
        try {
          const full = { page: 1, page_size: 25, ...query } as LeadsQuery;
          const data = USE_MOCK
            ? await mockListLeads(full)
            : await realFetch<LeadsListResponse>(
                `/api/leads?${toSearchParams(full)}`
              );
          return { data };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((l) => ({ type: "Lead" as const, id: l.id })),
              { type: "LeadList" as const, id: "LIST" },
            ]
          : [{ type: "LeadList" as const, id: "LIST" }],
    }),

    getLead: builder.query<LeadDetail, number>({
      async queryFn(id) {
        try {
          const data = USE_MOCK
            ? await mockGetLead(id)
            : await realFetch<LeadDetail>(`/api/leads/${id}`);
          return { data };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
      providesTags: (_r, _e, id) => [{ type: "Lead", id }],
    }),

    // TECH_SPEC.md folder structure / backend/app/routers/leads_admin.py —
    // POST /api/leads/manual, JWT-protected, staff entering a lead by hand
    // (phone call, walk-in, referral). Server always sets
    // source=manual_entry and status=new.
    createManualLead: builder.mutation<LeadOut, LeadManualCreate>({
      async queryFn(payload) {
        try {
          const data = USE_MOCK
            ? await mockCreateManualLead(payload)
            : await realFetch<LeadOut>(`/api/leads/manual`, {
                method: "POST",
                body: JSON.stringify(payload),
              });
          return { data };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
      invalidatesTags: [{ type: "LeadList", id: "LIST" }],
    }),

    updateLead: builder.mutation<LeadOut, { id: number; patch: LeadUpdate }>({
      async queryFn({ id, patch }) {
        try {
          const data = USE_MOCK
            ? await mockUpdateLead(id, patch)
            : await realFetch<LeadOut>(`/api/leads/${id}`, {
                method: "PATCH",
                body: JSON.stringify(patch),
              });
          return { data };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
      async onQueryStarted({ id, patch }, { dispatch, queryFulfilled }) {
        // Optimistic update per TABLE_SPEC.md §14 — rolled back on 409.
        const patches = [
          dispatch(
            leadsApi.util.updateQueryData("getLead", id, (draft) => {
              Object.assign(draft, patch);
            })
          ),
        ];
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Lead", id },
        { type: "LeadList", id: "LIST" },
      ],
    }),

    addLeadNote: builder.mutation<
      { id: number; author: string; note: string; created_at: string },
      { id: number; note: LeadNoteCreate }
    >({
      async queryFn({ id, note }) {
        try {
          const data = USE_MOCK
            ? await mockAddNote(id, note)
            : await realFetch(`/api/leads/${id}/notes`, {
                method: "POST",
                body: JSON.stringify(note),
              });
          return { data: data as never };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: "Lead", id }],
    }),

    deleteLead: builder.mutation<void, number>({
      async queryFn(id) {
        try {
          if (USE_MOCK) await mockDeleteLead(id);
          else await realFetch(`/api/leads/${id}`, { method: "DELETE" });
          return { data: undefined };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
      invalidatesTags: [{ type: "LeadList", id: "LIST" }],
    }),

    exportLeads: builder.mutation<string, Partial<LeadsQuery>>({
      async queryFn(query) {
        try {
          const full = { page: 1, page_size: 25, ...query } as LeadsQuery;
          if (USE_MOCK) {
            const csv = await mockExportCsv(full);
            return { data: csv };
          }
          const res = await fetch(
            `${API_BASE_URL}/api/leads/export?${toSearchParams(full)}`,
            { credentials: "include" }
          );
          if (!res.ok) throw new Error("Export failed");
          return { data: await res.text() };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),

    getDashboardMonthly: builder.query<DashboardMonthly, string>({
      async queryFn(month) {
        try {
          const data = USE_MOCK
            ? await mockDashboardMonthly(month)
            : await realFetch<DashboardMonthly>(
                `/api/dashboard/monthly?month=${month}`
              );
          return { data };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
      providesTags: [{ type: "Dashboard", id: "MONTHLY" }],
    }),

    getDashboardYearly: builder.query<DashboardYearly, number>({
      async queryFn(fyStartYear) {
        try {
          const data = USE_MOCK
            ? await mockDashboardYearly(fyStartYear)
            : await realFetch<DashboardYearly>(
                `/api/dashboard/yearly?fy=${fyStartYear}`
              );
          return { data };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
      providesTags: [{ type: "Dashboard", id: "YEARLY" }],
    }),
  }),
});

export const {
  useGetLeadsQuery,
  useGetLeadQuery,
  useCreateManualLeadMutation,
  useUpdateLeadMutation,
  useAddLeadNoteMutation,
  useDeleteLeadMutation,
  useExportLeadsMutation,
  useGetDashboardMonthlyQuery,
  useGetDashboardYearlyQuery,
} = leadsApi;
