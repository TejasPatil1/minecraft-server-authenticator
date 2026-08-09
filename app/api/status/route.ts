import { NextResponse } from "next/server";
import { getInstanceInfo } from "@/lib/ec2";
import { checkPortOpen } from "@/lib/portcheck";

export type DashboardStatus = "online" | "starting" | "stopped" | "stopping" | "unknown";

export async function GET() {
  try {
    const { state, publicIp } = await getInstanceInfo();

    let status: DashboardStatus;
    let online = false;

    if (state === "stopped") {
      status = "stopped";
    } else if (state === "stopping" || state === "shutting-down") {
      status = "stopping";
    } else if (state === "running" && publicIp) {
      online = await checkPortOpen(publicIp, 25565);
      status = online ? "online" : "starting";
    } else if (state === "pending" || state === "running") {
      status = "starting";
    } else {
      status = "unknown";
    }

    const showIp = status === "online" || status === "starting";

    return NextResponse.json({
      status,
      publicIp: showIp ? publicIp : null,
      minecraftAddress: showIp && publicIp ? `${publicIp}:25565` : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch status" },
      { status: 500 }
    );
  }
}
