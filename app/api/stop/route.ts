import { NextResponse } from "next/server";
import { stopInstance } from "@/lib/ec2";

// A single EC2 StopInstances call already does the graceful sequence:
// AWS sends the OS a normal shutdown signal (not a power pull), systemd
// stops the minecraft.service with SIGTERM, and the server's own shutdown
// hook saves the world before the process exits. No separate SSH step
// needed to "tell Minecraft to stop" first — the instance stop IS that.
export async function POST() {
  try {
    await stopInstance();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to stop instance" },
      { status: 500 }
    );
  }
}
