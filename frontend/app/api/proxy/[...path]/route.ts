import { NextRequest, NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/api/config";

async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/^\/api\/proxy/, "");
  const accessToken = request.cookies.get("access_token")?.value;

  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const ct = request.headers.get("Content-Type");
  if (ct) headers["Content-Type"] = ct;

  const fetchInit: RequestInit = {
    method: request.method,
    headers,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    fetchInit.body = await request.text();
  }

  const url = `${BACKEND_URL}${path}${request.nextUrl.search}`;
  const res = await fetch(url, fetchInit);

  const outHeaders = new Headers();
  const contentType = res.headers.get("Content-Type");
  if (contentType) outHeaders.set("Content-Type", contentType);
  if (res.status === 204) return new NextResponse(null, { status: 204, headers: outHeaders });

  const body = await res.text();
  return new NextResponse(body, { status: res.status, headers: outHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
