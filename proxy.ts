import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/login" || pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET;
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = secret ? await verifySessionCookieValue(cookie, secret) : false;

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
