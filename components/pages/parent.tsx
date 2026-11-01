"use client";
import { zones } from "@/lib/content";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Flag,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  challengeFor,
  Empty,
  Feedback,
  Heading,
  NeedHousehold,
  zoneFor,
} from "../family-ui";
import { command, useFamily } from "../workspace";
import { SafeZoneGuardianSummary } from "../safezone/guardian-summary";
import { ProgressPanel } from "../progress-panel";
import type { Session } from "@/lib/types";
export function ParentPage() {
  const { data, refresh } = useFamily(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(5),
    [older, setOlder] = useState<Session[]>([]),
    [olderMore, setOlderMore] = useState(true),
    [loadingOlder, setLoadingOlder] = useState(false),
    [historyError, setHistoryError] = useState("");
  if (!data) return null;
  if (!data.household) return <NeedHousehold />;
  const recent = data.sessions.filter((s) => s.state === "complete");
  const complete = [
    ...recent,
    ...older.filter((o) => !recent.some((r) => r.id === o.id)),
  ];
  // The snapshot holds the newest 100 sessions; older ones page in from the server.
  const canLoadOlder = olderMore && data.sessions.length >= 100;
  async function loadOlder() {
    const last = complete[complete.length - 1];
    if (!last) return;
    setLoadingOlder(true);
    setHistoryError("");
    try {
      const r = await fetch(
        `/api/history?before=${encodeURIComponent(last.created_at)}`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setOlder((o) => [...o, ...j.sessions]);
      setOlderMore(j.more);
      setVisible((v) => v + j.sessions.length);
    } catch (e) {
      setHistoryError(
        e instanceof Error ? e.message : "Could not load older adventures.",
      );
    } finally {
      setLoadingOlder(false);
    }
  }
  async function schedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await command("schedule", {
        at: new Date(String(fd.get("at"))).toISOString(),
        mode: fd.get("mode"),
      });
      await refresh();
      setMessage(
        "Game night saved. This calendar entry does not send a notification.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="A LITTLE CLARITY FOR GROWN-UPS"
        title="Their discoveries. Your conversation starters."
        description="A record of the adventures your family actually completed."
      >
        <Link className="btn secondary small" href="/family">
          <Settings2 size={16} /> Family preferences
        </Link>
      </Heading>
      <div className="stats-row">
        <div>
          <ShieldCheck />
          <div>
            <strong>{data.children.length}</strong>
            <span>Guardian-managed profiles</span>
          </div>
        </div>
        <div>
          <Check />
          <div>
            <strong>{complete.length}</strong>
            <span>Completed sessions</span>
          </div>
        </div>
        <div>
          <Flag />
          <div>
            <strong>
              {
                data.reports.filter(
                  (r) => !["actioned", "dismissed"].includes(r.status),
                ).length
              }
            </strong>
            <span>Open safety reports</span>
          </div>
        </div>
      </div>
      <div className="content-split">
        <section>
          <div className="mini-heading">
            <h2>Learning moments</h2>
          </div>
          {!complete.length ? (
            <Empty
              title="Your first learning moment is ahead."
              description="Complete an adventure to see saved decisions, skills practiced, and a conversation starter."
              href="/challenges"
              label="Choose an adventure"
            />
          ) : (
            complete.slice(0, visible).map((s) => {
              const c = challengeFor(s, data);
              return (
                <article className="panel summary-card" key={s.id}>
                  <div className="summary-title">
                    <span className={"round-icon mode-" + c?.mode}>
                      {zoneFor(c?.mode || "quick").icon}
                    </span>
                    <div>
                      <h3>{c?.title || "Family adventure"}</h3>
                      <small>
                        {new Date(
                          s.completed_at || s.created_at,
                        ).toLocaleDateString()}{" "}
                        · {s.total_score} team points
                        {s.practice ? " · practice round (no XP)" : ""}
                      </small>
                    </div>
                    <Link href={"/play/" + s.id}>Review →</Link>
                  </div>
                  <p>
                    <strong>Practiced:</strong>{" "}
                    {s.practice
                      ? "practice round, not recorded as progress"
                      : [
                          ...new Set(
                            data.scores
                              .filter((x) => x.session_id === s.id)
                              .map((x) => x.skill),
                          ),
                        ].join(", ")}
                  </p>
                  <p className="conversation">
                    <strong>Try asking:</strong> “What made you choose your
                    plan, and what would you change next time?”
                  </p>
                </article>
              );
            })
          )}
          {historyError && (
            <p className="notice error" role="alert">
              {historyError}
            </p>
          )}
          <div className="card-actions history-more">
            {visible < complete.length && (
              <button
                className="btn small secondary"
                onClick={() => setVisible((v) => v + 5)}
              >
                Show more ({complete.length - visible} more)
              </button>
            )}
            {visible >= complete.length && canLoadOlder && (
              <button
                className="btn small secondary"
                disabled={loadingOlder}
                onClick={() => void loadOlder()}
              >
                {loadingOlder ? "Loading…" : "Load older adventures"}
              </button>
            )}
          </div>
          <ProgressPanel data={data} />
          <div className="mini-heading">
            <h2>Q’s hint history</h2>
          </div>
          <p className="muted">
            Q currently uses reviewed, prewritten hints, rather than a live AI
            model.
            {data.qUsage
              ? ` ${data.qUsage.used} of ${data.qUsage.limit} daily hints used in the last 24 hours.`
              : ""}
          </p>
          {data.qLogs.length ? (
            data.qLogs.map((q) => (
              <div className="hint-log" key={q.id}>
                <Sparkles size={16} />
                <div>
                  <p>{q.output}</p>
                  <small>{new Date(q.created_at).toLocaleString()}</small>
                </div>
              </div>
            ))
          ) : (
            <div className="simple-empty">No hints have been requested.</div>
          )}
          <div className="mini-heading">
            <h2>Your safety reports</h2>
          </div>
          {data.reports.length ? (
            data.reports.map((r) => (
              <div className="session-row" key={r.id}>
                <Flag size={18} />
                <div>
                  <strong>{r.reason}</strong>
                  <small>{new Date(r.created_at).toLocaleString()}</small>
                </div>
                <span className="status">{r.status.replace("_", " ")}</span>
              </div>
            ))
          ) : (
            <div className="simple-empty">
              No reports submitted. You can report an issue from any saved game
              session.
            </div>
          )}
          <SafeZoneGuardianSummary explorers={data.children} />
          <div className="mini-heading">
            <h2>Consent history</h2>
          </div>
          {data.consent?.history.length ? (
            data.consent.history.map((r) => (
              <div className="session-row" key={r.version}>
                <ShieldCheck size={18} />
                <div>
                  <strong>Consent version {r.version}</strong>
                  <small>
                    Accepted {new Date(r.acceptedAt).toLocaleString()}
                  </small>
                </div>
                <span className="status">
                  {r.version === data.consent?.current
                    ? "current"
                    : "superseded"}
                </span>
              </div>
            ))
          ) : (
            <div className="simple-empty">No consent recorded yet.</div>
          )}
        </section>
        <aside>
          <section className="panel form-panel">
            <CalendarDays className="accent" />
            <h2>Make time for together.</h2>
            <p>Save your next family game night.</p>
            <form onSubmit={schedule}>
              <label>
                Local date & time
                <input name="at" type="datetime-local" required />
              </label>
              <label>
                Adventure style
                <select name="mode">
                  {zones.map((z) => (
                    <option value={z.mode} key={z.mode}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn full" disabled={busy}>
                Save game night <Plus size={17} />
              </button>
            </form>
            <Feedback message={message} />
            {data.schedules.map((s) => (
              <div key={s.id} className="calendar-entry">
                <CalendarDays size={18} />
                <div>
                  <strong>{zoneFor(s.mode).name}</strong>
                  <small>{new Date(s.scheduled_at).toLocaleString()}</small>
                </div>
              </div>
            ))}
          </section>
          <div className="quiet-note">
            <ShieldCheck />
            <p>
              Skills describe recorded practice, not intelligence or
              psychological traits. This summary is based on your family’s saved
              sessions.
            </p>
          </div>
          <Link href="/passport" className="btn secondary full">
            View learning progress <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </>
  );
}
