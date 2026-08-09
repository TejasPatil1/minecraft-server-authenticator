import { NextResponse } from "next/server";
import { startInstance } from "@/lib/ec2";

export async function POST() {
  try {
    await startInstance();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to start instance" },
      { status: 500 }
    );
  }
}
