import { z } from "zod";

export const ADMIN_ROLE_VALUES = ["admin", "staff"] as const;
export const adminRoleSchema = z.enum(ADMIN_ROLE_VALUES);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const loginRequestSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const sessionUserSchema = z.object({
  username: z.string(),
  role: adminRoleSchema,
  fullName: z.string().default(""),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;
