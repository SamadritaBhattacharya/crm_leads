import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthApi = pathname.startsWith("/api/auth");
  const isStatic = pathname.startsWith("/_next") || pathname === "/favicon.ico";

  if (isPublic || isAuthApi || isStatic) {
    if (request.cookies.has("access_token") && isPublic) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("access_token") || request.cookies.has("crm_session");

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
