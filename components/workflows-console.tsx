"use client";
import { Pause, Play, RefreshCw, RotateCcw, Workflow } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { workflowStatusLabels } from "@/lib/content";
import { command } from "./workspace";

type Definition = {
  key: string;
  version: number;
  versions: number;
  event: string;
  steps: string[];
  description: string;
  enabled: boolean;
  maxAttempts: number;
  last24h: Record<string, number>;
};
type Run = {
  id: number;
  workflow: string;
  version: number;
  event: string;
  status: string;
  attempt: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  nextAttemptAt: string | null;
  steps: {
    action: string;
    attempt: number;
    status: string;
    ms: number;
    error: string | null;
  }[];
};
type Overview = {
  definitions: Definition[];
  runs: Run[];
  deadLetters: number;
  due: number;
};

// Workflow OS console (administrators): every workflow, its live version and steps,
// 24-hour outcomes, recent runs with per-step logs, and pause / resume / retry / tick.
export function WorkflowsConsole() {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/workflows", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || "Workflows are unavailable.");
    else {
      setData(j);
      setError("");
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  async function act(
    key: string,
    action: Parameters<typeof command>[0],
    payload: unknown,
    done: string,
  ) {
    setBusy(key);
    setNote("");
    setError("");
    try {
      const r = await command(action, payload);
      setNote(
        action === "wf_tick"
          ? `Tick ran: ${r.succeeded} succeeded, ${r.failed} failed, ${r.dead} dead.`
          : done,
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update the workflow.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel workflows-console" aria-labelledby="wf-title">
      <div className="mini-heading">
        <h2 id="wf-title">
          <Workflow size={20} /> Workflows
        </h2>
        <button
          className="btn secondary small"
          disabled={Boolean(busy)}
          onClick={() => void act("tick", "wf_tick", {}, "")}
        >
          <RefreshCw size={15} />{" "}
          {busy === "tick" ? "Running…" : "Run tick now"}
        </button>
      </div>
      <p className="muted">
        Events from across QuiZone run these workflows as they happen. Failed
        steps retry with backoff; after the last attempt a run moves to dead
        letters. The runtime also ticks every minute.
      </p>
      {note && (
        <p className="notice success" role="status">
          {note}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        !error && <p role="status">Loading…</p>
      ) : (
        <>
          <dl className="wf-stats">
            <div>
              <dt>Dead letters</dt>
              <dd>{data.deadLetters}</dd>
            </div>
            <div>
              <dt>Due now</dt>
              <dd>{data.due}</dd>
            </div>
          </dl>
          <ul className="wf-definitions">
            {data.definitions.map((d) => (
              <li key={d.key} className={d.enabled ? "" : "paused"}>
                <div>
                  <strong>{d.key}</strong>{" "}
                  <span className="pill">
                    v{d.version}
                    {d.versions > 1 ? ` of ${d.versions}` : ""}
                  </span>
                  {!d.enabled && (
                    <span className="pill wf-paused-pill">paused</span>
                  )}
                  <p>{d.description}</p>
                  <small>
                    on <code>{d.event}</code> → {d.steps.join(" → ")} · up to{" "}
                    {d.maxAttempts} attempts · 24 h:{" "}
                    {Object.keys(d.last24h).length
                      ? Object.entries(d.last24h)
                          .map(
                            ([k, v]) => `${workflowStatusLabels[k] ?? k} ${v}`,
                          )
                          .join(" · ")
                      : "no runs"}
                  </small>
                </div>
                <button
                  className="btn secondary small"
                  disabled={Boolean(busy)}
                  aria-label={`${d.enabled ? "Pause" : "Resume"} ${d.key}`}
                  onClick={() =>
                    void act(
                      d.key,
                      d.enabled ? "wf_pause" : "wf_resume",
                      { workflow: d.key },
                      `${d.key} ${d.enabled ? "paused" : "resumed"}.`,
                    )
                  }
                >
                  {d.enabled ? <Pause size={15} /> : <Play size={15} />}{" "}
                  {d.enabled ? "Pause" : "Resume"}
                </button>
              </li>
            ))}
          </ul>
          <h3>Recent runs</h3>
          {data.runs.length === 0 ? (
            <p className="simple-empty">No runs yet.</p>
          ) : (
            <ul className="wf-runs">
              {data.runs.map((r) => (
                <li key={r.id} className={`wf-run ${r.status}`}>
                  <details>
                    <summary>
                      <span className={`wf-status ${r.status}`}>
                        {workflowStatusLabels[r.status] ?? r.status}
                      </span>{" "}
                      <strong>{r.workflow}</strong> · {r.event} · attempt{" "}
                      {r.attempt} · {new Date(r.createdAt).toLocaleTimeString()}
                    </summary>
                    <ol>
                      {r.steps.map((s, i) => (
                        <li key={i}>
                          {s.action} (attempt {s.attempt}): {s.status}, {s.ms}{" "}
                          ms
                          {s.error ? ` — ${s.error}` : ""}
                        </li>
                      ))}
                    </ol>
                    {r.nextAttemptAt && (
                      <p className="muted">
                        Next attempt{" "}
                        {new Date(r.nextAttemptAt).toLocaleTimeString()}
                      </p>
                    )}
                  </details>
                  {(r.status === "failed" || r.status === "dead") && (
                    <button
                      className="btn secondary small"
                      disabled={Boolean(busy)}
                      aria-label={`Retry run ${r.id}`}
                      onClick={() =>
                        void act(
                          `retry${r.id}`,
                          "wf_retry",
                          { run: r.id },
                          `Run ${r.id} queued for retry.`,
                        )
                      }
                    >
                      <RotateCcw size={15} /> Retry
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
