"use client";
import { safezone } from "@/lib/content";
import type { Child, SafeZoneLobby } from "@/lib/types";
import { Landmark } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadLobby, when } from "./api";

// Parent Hub view of SafeZone: participation per explorer + safety notifications,
// from the same sanitized lobby read the SafeZone page uses.
export function SafeZoneGuardianSummary({ explorers }: { explorers: Child[] }) {
  const [lobby, setLobby] = useState<SafeZoneLobby | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(
      () =>
        void loadLobby()
          .then(setLobby)
          .catch((e) =>
            setError(e instanceof Error ? e.message : "Unavailable."),
          ),
      0,
    );
    return () => clearTimeout(t);
  }, []);
  const name = (id: string) =>
    explorers.find((c) => c.id === id)?.nickname ?? "Explorer";
  return (
    <>
      <div className="mini-heading">
        <h2>
          <Landmark size={20} /> SafeZone town halls
        </h2>
        <Link className="text-link" href="/safezone">
          Manage SafeZone
        </Link>
      </div>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : !lobby ? (
        <div className="simple-empty" role="status">
          Loading town hall activity…
        </div>
      ) : !lobby.enabled && lobby.registrations.length === 0 ? (
        <div className="simple-empty">
          SafeZone is in safety review and not open to families yet.
        </div>
      ) : (
        <>
          {lobby.registrations.length === 0 ? (
            <div className="simple-empty">
              {lobby.permission
                ? "No town halls approved yet."
                : "SafeZone is off for your family."}
            </div>
          ) : (
            lobby.registrations.map((r) => {
              const h = lobby.halls.find((x) => x.id === r.hall);
              return (
                <div className="session-row" key={r.hall + r.child}>
                  <Landmark size={18} />
                  <div>
                    <strong>{h?.title ?? "Town hall"}</strong>
                    <small>
                      {name(r.child)} as {r.handle}
                      {h ? ` · ${when(h.startsAt)}` : ""}
                    </small>
                  </div>
                  <span className="status">
                    {r.status === "registered"
                      ? safezone.states[h?.state ?? "scheduled"]
                      : r.status}
                  </span>
                </div>
              );
            })
          )}
          {lobby.notifications.slice(0, 5).map((n) => (
            <div className="session-row" key={n.id}>
              <span aria-hidden="true">•</span>
              <div>
                <strong>{n.message}</strong>
                <small>{when(n.createdAt)}</small>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
