"use client";
import { Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { maintenanceLabels } from "@/lib/content";

type Run = { ranAt: string; source: string; result: Record<string, number> };

// Scheduled maintenance (every 15 minutes via pg_cron) and an on-demand run.
export function MaintenancePanel() {
  const [runs, setRuns] = useState<Run[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/maintenance", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || "Maintenance history is unavailable.");
    else {
      setRuns(j);
      setError("");
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  return (
    <section className="panel maintenance-panel" aria-labelledby="maint-title">
      <div className="mini-heading">
        <h2 id="maint-title">Scheduled maintenance</h2>
        <button
          className="btn secondary small"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            const r = await fetch("/api/maintenance", { method: "POST" });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) setError(j.error || "Maintenance failed.");
            await load();
            setBusy(false);
          }}
        >
          {busy ? <RefreshCw size={15} /> : <Play size={15} />}{" "}
          {busy ? "Running…" : "Run now"}
        </button>
      </div>
      <p className="muted">
        Runs every 15 minutes: expires games past their time limit, clears old
        rate-limit, invite, lock, and device records, and sends game-night
        reminders. Counts only.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {runs === null && !error ? (
        <p role="status">Loading…</p>
      ) : runs && runs.length === 0 ? (
        <p className="simple-empty">No runs recorded yet.</p>
      ) : (
        <ul className="maintenance-runs">
          {(runs ?? []).map((r) => (
            <li key={r.ranAt}>
              <strong>{new Date(r.ranAt).toLocaleString()}</strong>{" "}
              <span className="pill">{r.source}</span>
              <span className="muted">
                {Object.entries(r.result)
                  .map(([k, v]) => `${maintenanceLabels[k] ?? k} ${v}`)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
