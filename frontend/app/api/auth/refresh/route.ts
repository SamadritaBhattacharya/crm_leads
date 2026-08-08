import { NextRequest, NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/api/config";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    const response = NextResponse.json({ error: "Refresh failed" }, { status: 401 });
    response.cookies.set("access_token", "", { path: "/", maxAge: 0 });
    response.cookies.set("refresh_token", "", { path: "/api/auth/refresh", maxAge: 0 });
    return response;
  }

  const tokens = await res.json();
  const response = NextResponse.json({ success: true });

  response.cookies.set("access_token", tokens.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  });

  return response;
}
