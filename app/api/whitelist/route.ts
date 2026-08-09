import { NextResponse } from "next/server";
import { addToWhitelist, listWhitelist } from "@/lib/whitelist";

export async function GET() {
  try {
    const players = await listWhitelist();
    return NextResponse.json({ players });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list whitelist" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { username } = await req.json().catch(() => ({ username: "" }));
    if (typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }
    await addToWhitelist(username.trim());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add to whitelist" },
      { status: 500 }
    );
  }
}
