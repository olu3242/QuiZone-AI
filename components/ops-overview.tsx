"use client";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Ops = {
  generatedAt: string;
  households: number;
  explorers: { active: number; archived: number };
  sessions7d: Record<string, number>;
  completions30d: Record<string, number>;
  practice30d: number;
  openGameReports: number;
  openSafeZoneReports: Record<string, number>;
  flags: Record<string, boolean>;
  rateLimitHits1h: Record<string, number>;
  accountDeletions: { total: number; last30d: number };
  consent: { current: number; householdsPending: number };
  badgesAwarded7d: number;
  publishedChallenges: number;
  draftChallenges: number;
};
const sum = (m: Record<string, number>) =>
  Object.values(m).reduce((a, b) => a + b, 0);
const list = (m: Record<string, number>) =>
  Object.keys(m).length
    ? Object.entries(m)
        .map(([k, v]) => `${k} ${v}`)
        .join(" · ")
    : "none";

// Staff-only aggregates. No names, emails, or identifiers are returned.
export function OpsOverview() {
  const [ops, setOps] = useState<Ops | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/ops", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || "Operations data is unavailable.");
    else {
      setOps(j);
      setError("");
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  const tiles: [string, string | number, string?][] = ops
    ? [
        ["Households", ops.households],
        [
          "Active explorers",
          ops.explorers.active,
          `${ops.explorers.archived} archived`,
        ],
        ["Sessions (7 days)", sum(ops.sessions7d), list(ops.sessions7d)],
        [
          "Completions (30 days)",
          sum(ops.completions30d),
          list(ops.completions30d),
        ],
        ["Practice rounds (30 days)", ops.practice30d],
        ["Open game reports", ops.openGameReports],
        [
          "Open SafeZone reports",
          sum(ops.openSafeZoneReports),
          list(ops.openSafeZoneReports),
        ],
        [
          "Pending re-consent",
          ops.consent.householdsPending,
          `current version ${ops.consent.current}`,
        ],
        [
          "Rate-limit hits (1 hour)",
          sum(ops.rateLimitHits1h),
          list(ops.rateLimitHits1h),
        ],
        [
          "Account deletions",
          ops.accountDeletions.total,
          `${ops.accountDeletions.last30d} in 30 days`,
        ],
        ["Badges awarded (7 days)", ops.badgesAwarded7d],
        [
          "Challenges",
          ops.publishedChallenges,
          `${ops.draftChallenges} open drafts`,
        ],
      ]
    : [];
  return (
    <section className="ops" aria-labelledby="ops-title">
      <div className="mini-heading">
        <h2 id="ops-title">Operations</h2>
        <button className="btn small secondary" onClick={() => void load()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : !ops ? (
        <p role="status">Loading operations data…</p>
      ) : (
        <>
          <dl className="ops-grid">
            {tiles.map(([label, value, detail]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <strong>{value}</strong>
                  {detail && <small>{detail}</small>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="muted ops-flags">
            Feature flags:{" "}
            {Object.entries(ops.flags)
              .sort()
              .map(([k, v]) => `${k} ${v ? "on" : "off"}`)
              .join(" · ")}{" "}
            · as of {new Date(ops.generatedAt).toLocaleTimeString()}
          </p>
        </>
      )}
    </section>
  );
}
