import { NextResponse } from "next/server";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  const correctPassword = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  if (!correctPassword || !secret) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { password } = await req.json().catch(() => ({ password: "" }));

  if (typeof password !== "string" || password !== correctPassword) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const cookieValue = await createSessionCookieValue(secret);
  const res = NextResponse.json({ ok: true });
  // No maxAge/expires: this is a browser session cookie. It's gone as soon
  // as the browser closes, so the password is required again on every new
  // visit - not just once ever.
  res.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return res;
}
