"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardStatus = "online" | "starting" | "stopped" | "stopping" | "unknown";

type StatusResponse = {
  status: DashboardStatus;
  publicIp: string | null;
  minecraftAddress: string | null;
  error?: string;
};

const STATUS_META: Record<DashboardStatus, { label: string; dot: string; text: string }> = {
  online: { label: "Online", dot: "bg-emerald-500", text: "text-emerald-400" },
  starting: { label: "Starting", dot: "bg-yellow-500 animate-pulse", text: "text-yellow-400" },
  stopped: { label: "Stopped", dot: "bg-red-500", text: "text-red-400" },
  stopping: { label: "Stopping", dot: "bg-orange-500 animate-pulse", text: "text-orange-400" },
  unknown: { label: "Unknown", dot: "bg-neutral-500", text: "text-neutral-400" },
};

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<"start" | "stop" | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [whitelist, setWhitelist] = useState<string[] | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = (await res.json()) as StatusResponse;
      setData(json);
    } catch {
      // transient poll failure; keep last known state
    }
  }, [router]);

  const fetchWhitelist = useCallback(async () => {
    try {
      const res = await fetch("/api/whitelist", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setWhitelist(json.players ?? []);
    } catch {
      // ignore transient failure
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (data?.status === "online") fetchWhitelist();
    else setWhitelist(null);
  }, [data?.status, fetchWhitelist]);

  async function handleAddUsername(e: React.FormEvent) {
    e.preventDefault();
    setWhitelistError(null);
    setWhitelistLoading(true);
    try {
      const res = await fetch("/api/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add username");
      setNewUsername("");
      await fetchWhitelist();
    } catch (e) {
      setWhitelistError(e instanceof Error ? e.message : "Failed to add username");
    } finally {
      setWhitelistLoading(false);
    }
  }

  async function handleStart() {
    setErrorMsg(null);
    setActionLoading("start");
    try {
      const res = await fetch("/api/start", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to start server");
      }
      await fetchStatus();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to start server");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStop() {
    setConfirmStop(false);
    setErrorMsg(null);
    setActionLoading("stop");
    try {
      const res = await fetch("/api/stop", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to stop server");
      }
      await fetchStatus();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to stop server");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const status = data?.status ?? "unknown";
  const meta = STATUS_META[status];
  const canStart = status === "stopped" && actionLoading === null;
  const canStop = (status === "online" || status === "starting") && actionLoading === null;

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <button
            onClick={handleLogout}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition"
          >
            Log out
          </button>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
          <h1 className="text-2xl font-semibold text-neutral-100 mb-6">Minecraft Server</h1>

          <div className="flex items-center gap-2 mb-6">
            <span className={`h-3 w-3 rounded-full ${meta.dot}`} />
            <span className={`text-lg font-medium ${meta.text}`}>{meta.label}</span>
          </div>

          <div className="space-y-4 mb-8">
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Public IP</div>
              <div className="font-mono text-neutral-200">{data?.publicIp ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Minecraft Address
              </div>
              <div className="font-mono text-lg text-neutral-100 select-all">
                {data?.minecraftAddress ?? "—"}
              </div>
            </div>
          </div>

          {errorMsg && (
            <p className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {actionLoading === "start" ? "Starting..." : "START SERVER"}
            </button>

            {!confirmStop ? (
              <button
                onClick={() => setConfirmStop(true)}
                disabled={!canStop}
                className="w-full rounded-lg border border-red-800 bg-red-950/40 py-3 font-medium text-red-300 transition hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionLoading === "stop" ? "Stopping..." : "STOP SERVER"}
              </button>
            ) : (
              <div className="rounded-lg border border-red-800 bg-red-950/40 p-3">
                <p className="text-sm text-red-200 mb-3">
                  Stop the server? This saves the world and shuts the instance down.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleStop}
                    className="flex-1 rounded-lg bg-red-700 py-2 text-sm font-medium text-white hover:bg-red-600 transition"
                  >
                    Yes, stop it
                  </button>
                  <button
                    onClick={() => setConfirmStop(false)}
                    className="flex-1 rounded-lg border border-neutral-700 py-2 text-sm text-neutral-300 hover:bg-neutral-800 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-neutral-800 pt-6">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-3">
              Whitelist
            </div>

            {data?.status !== "online" ? (
              <p className="text-sm text-neutral-500">Start the server to manage the whitelist.</p>
            ) : (
              <>
                <form onSubmit={handleAddUsername} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Friend's Minecraft username"
                    maxLength={16}
                    className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-emerald-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={whitelistLoading || newUsername.trim().length < 3}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {whitelistLoading ? "Adding..." : "Add"}
                  </button>
                </form>

                {whitelistError && (
                  <p className="mb-3 text-sm text-red-400">{whitelistError}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {whitelist === null ? (
                    <span className="text-sm text-neutral-500">Loading...</span>
                  ) : whitelist.length === 0 ? (
                    <span className="text-sm text-neutral-500">No one whitelisted yet.</span>
                  ) : (
                    whitelist.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-neutral-800 px-3 py-1 text-sm text-neutral-200"
                      >
                        {name}
                      </span>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
