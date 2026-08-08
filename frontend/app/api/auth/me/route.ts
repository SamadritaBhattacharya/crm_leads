import { NextRequest, NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/api/config";

async function forwardToBackend(
  request: NextRequest,
  method: "GET" | "PATCH",
  body?: unknown
) {
  const accessToken = request.cookies.get("access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function GET(request: NextRequest) {
  return forwardToBackend(request, "GET");
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    return forwardToBackend(request, "PATCH", body);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
