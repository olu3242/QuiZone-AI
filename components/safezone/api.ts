"use client";
import type { Room, SafeZoneLobby } from "@/lib/types";

async function json<T>(r: Response): Promise<T> {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "SafeZone is unavailable right now.");
  return j as T;
}
export const loadLobby = () =>
  fetch("/api/safezone", { cache: "no-store" }).then((r) =>
    json<SafeZoneLobby>(r),
  );
export const loadRoom = (hall: string, child: string | null) =>
  fetch(
    `/api/safezone?hall=${encodeURIComponent(hall)}${child ? `&child=${encodeURIComponent(child)}` : ""}`,
    { cache: "no-store" },
  ).then((r) => json<Room>(r));
// Consent-granting actions: password travels once, over the same-origin API.
export const consent = (
  action: "sz_permission" | "sz_register",
  password: string,
  data: Record<string, unknown>,
) =>
  fetch("/api/safezone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, password, data }),
  }).then((r) => json<{ handle?: string }>(r));
export function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
