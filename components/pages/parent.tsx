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
export function ParentPage() {
  const { data, refresh } = useFamily(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!data) return null;
  if (!data.household) return <NeedHousehold />;
  const complete = data.sessions.filter((s) => s.state === "complete");
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
            complete.map((s) => {
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
                      </small>
                    </div>
                    <Link href={"/play/" + s.id}>Review →</Link>
                  </div>
                  <p>
                    <strong>Practiced:</strong>{" "}
                    {[
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
          <div className="mini-heading">
            <h2>Q’s hint history</h2>
          </div>
          <p className="muted">
            Q currently uses reviewed, prewritten hints, rather than a live AI
            model.
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
