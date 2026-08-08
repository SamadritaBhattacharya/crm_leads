import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

import { API_BASE_URL, USE_MOCK } from "@/lib/api/config";
import { mockLogin } from "@/lib/mock/server";
import type { LoginRequest } from "@/lib/schemas/auth";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fakeBaseQuery<string>(),
  endpoints: (builder) => ({
    // TECH_SPEC.md §4.2 — POST /api/auth/login. Real mode expects the
    // backend (or a Next.js API route proxy, per §6 recommendation) to set
    // the HttpOnly cookie; the JSON body here is only used in mock mode to
    // decide the session's display name/role client-side.
    login: builder.mutation<{ username: string; role: "admin" | "staff" }, LoginRequest>({
      async queryFn({ username, password }) {
        try {
          if (USE_MOCK) {
            const res = await mockLogin(username, password);
            return { data: { username: res.username, role: res.role as "admin" | "staff" } };
          }
          const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
          if (!res.ok) throw new Error("Invalid credentials");
          const role: "admin" | "staff" = username.toLowerCase().includes("admin")
            ? "admin"
            : "staff";
          return { data: { username, role } };
        } catch (error) {
          return { error: (error as Error).message };
        }
      },
    }),
  }),
});

export const { useLoginMutation } = authApi;
