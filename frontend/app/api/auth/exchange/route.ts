import { NextRequest, NextResponse } from "next/server";

// Always use mock mode for the exchange route when no backend is running.
// Set NEXT_PUBLIC_DISABLE_MOCK_AUTH=true once the FastAPI backend is live.
const USE_MOCK = process.env.NEXT_PUBLIC_DISABLE_MOCK_AUTH !== "true";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    if (USE_MOCK) {
      const response = NextResponse.json({
        username: "staff",
        role: "staff",
        fullName: "Staff User",
      });

      response.cookies.set("access_token", idToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8, // 8 hours for dev convenience
      });

      return response;
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/firebase`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: data.detail ?? "Token exchange failed" },
        { status: res.status }
      );
    }

    const tokens = await res.json();

    const payloadBase64 = tokens.access_token.split(".")[1];
    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf-8")
    );

    const response = NextResponse.json({
      username: payload.sub,
      role: payload.role ?? "staff",
      fullName: payload.full_name ?? "",
    });

    response.cookies.set("access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    response.cookies.set("refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/refresh",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error("Token exchange error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
