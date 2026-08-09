import { Rcon } from "rcon-client";
import { getInstanceInfo } from "./ec2";

const RCON_PORT = Number(process.env.RCON_PORT || 25575);
const RCON_PASSWORD = process.env.RCON_PASSWORD as string;

// Minecraft usernames: 3-16 chars, letters/digits/underscore only.
// Enforced here too (not just client-side) since this string reaches a live
// server console command.
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name);
}

async function withRcon<T>(host: string, fn: (rcon: Rcon) => Promise<T>): Promise<T> {
  const rcon = await Rcon.connect({ host, port: RCON_PORT, password: RCON_PASSWORD, timeout: 5000 });
  try {
    return await fn(rcon);
  } finally {
    rcon.end();
  }
}

async function requireOnlineHost(): Promise<string> {
  const { state, publicIp } = await getInstanceInfo();
  if (state !== "running" || !publicIp) {
    throw new Error("Server must be online to manage the whitelist");
  }
  return publicIp;
}

export async function addToWhitelist(username: string): Promise<string> {
  if (!isValidUsername(username)) {
    throw new Error("Invalid Minecraft username");
  }
  const host = await requireOnlineHost();
  return withRcon(host, (rcon) => rcon.send(`whitelist add ${username}`));
}

export async function listWhitelist(): Promise<string[]> {
  const host = await requireOnlineHost();
  const res = await withRcon(host, (rcon) => rcon.send("whitelist list"));
  const match = res.match(/:\s*(.+)$/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
