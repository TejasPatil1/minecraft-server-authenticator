import { Client } from "ssh2";
import { Rcon } from "rcon-client";
import { getInstanceInfo } from "./ec2";

const RCON_PORT = Number(process.env.RCON_PORT || 25575);
const RCON_PASSWORD = process.env.RCON_PASSWORD as string;
const SSH_USER = process.env.SSH_USER || "ubuntu";
const SSH_PRIVATE_KEY = (process.env.SSH_PRIVATE_KEY || "").replace(/\\n/g, "\n");

// Minecraft usernames: 3-16 chars, letters/digits/underscore only.
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name);
}

async function requireOnlineHost(): Promise<string> {
  const { state, publicIp } = await getInstanceInfo();
  if (state !== "running" || !publicIp) {
    throw new Error("Server must be online to manage the whitelist");
  }
  return publicIp;
}

// This key is restricted server-side to a forced command
// (/opt/minecraft/whitelist-add.sh) via authorized_keys - it cannot run
// arbitrary shell commands even though the connection itself is exposed to
// the internet (Vercel has no static outbound IP to allow-list). The
// "command" sent here is just the raw username; the server maps it through
// $SSH_ORIGINAL_COMMAND into the forced script, which validates it again,
// computes the correct offline-mode UUID, writes whitelist.json directly,
// and reloads - bypassing vanilla's buggy `/whitelist add`, which tries an
// online Mojang lookup even on an offline server and can store the wrong
// UUID (see: jics incident).
export async function addToWhitelist(username: string): Promise<void> {
  if (!isValidUsername(username)) {
    throw new Error("Invalid Minecraft username");
  }
  const host = await requireOnlineHost();

  const output = await new Promise<string>((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.exec(username, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          let stdout = "";
          let stderr = "";
          stream
            .on("close", (code: number) => {
              conn.end();
              if (code !== 0) return reject(new Error(stderr || `Whitelist script exited ${code}`));
              resolve(stdout);
            })
            .on("data", (d: Buffer) => (stdout += d.toString()))
            .stderr.on("data", (d: Buffer) => (stderr += d.toString()));
        });
      })
      .on("error", reject)
      .connect({ host, port: 22, username: SSH_USER, privateKey: SSH_PRIVATE_KEY, readyTimeout: 8000 });
  });

  if (!output.includes("whitelisted")) {
    throw new Error("Whitelist update did not confirm success");
  }
}

export async function listWhitelist(): Promise<string[]> {
  const host = await requireOnlineHost();
  const rcon = await Rcon.connect({ host, port: RCON_PORT, password: RCON_PASSWORD, timeout: 5000 });
  let res: string;
  try {
    res = await rcon.send("whitelist list");
  } finally {
    rcon.end();
  }
  const match = res.match(/:\s*(.+)$/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
