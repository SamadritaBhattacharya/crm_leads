import { NextRequest, NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/api/config";

async function proxy(request: NextRequest, targetPath: string, init?: RequestInit) {
  const accessToken = request.cookies.get("access_token")?.value;
  const outHeaders: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  if (accessToken) outHeaders["Authorization"] = `Bearer ${accessToken}`;
  if (init?.body && !outHeaders["Content-Type"]) outHeaders["Content-Type"] = "application/json";

  const res = await fetch(`${BACKEND_URL}${targetPath}`, {
    ...init,
    headers: outHeaders,
  });

  if (res.status === 204) return new NextResponse(null, { status: 204 });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export async function GET(request: NextRequest) {
  return proxy(request, request.nextUrl.pathname.replace("/api", "/api"));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxy(request, request.nextUrl.pathname.replace("/api", "/api"), {
    method: "POST",
    body,
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.text();
  return proxy(request, request.nextUrl.pathname.replace("/api", "/api"), {
    method: "PATCH",
    body,
  });
}

export async function DELETE(request: NextRequest) {
  return proxy(request, request.nextUrl.pathname.replace("/api", "/api"), {
    method: "DELETE",
  });
}
