"use client";
import { safezone } from "@/lib/content";
import type { Hall, SafeZoneLobby } from "@/lib/types";
import { CalendarPlus, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { command } from "../workspace";
import { when } from "./api";

// "2: Some text" → { agenda: 2, text }; plain lines have no agenda item.
function cards(raw: FormDataEntryValue | null, kind: string) {
  return String(raw || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d{1,2})\s*:\s*(.+)$/);
      return m ? { kind, agenda: Number(m[1]), text: m[2] } : { kind, text: l };
    });
}
function agenda(raw: FormDataEntryValue | null) {
  return String(raw || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.+?)\s*\((\d{1,2})\s*min\)$/i);
      return m
        ? { title: m[1], minutes: Number(m[2]) }
        : { title: l, minutes: 5 };
    });
}
const next: Partial<Record<Hall["state"], [Hall["state"], string]>> = {
  draft: ["scheduled", "Publish & open registration"],
  scheduled: ["open", "Open the room"],
  open: ["active", "Start town hall"],
  active: ["completed", "Complete"],
};

export function ModeratorConsole({
  lobby,
  onChange,
}: {
  lobby: SafeZoneLobby;
  onChange: (message: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(
    action: Parameters<typeof command>[0],
    data: unknown,
    done: string,
  ) {
    setBusy(true);
    setError("");
    try {
      await command(action, data);
      await onChange(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sz-console" aria-labelledby="console-title">
      <div className="mini-heading">
        <h2 id="console-title">Moderator console</h2>
        <span>Staff only · every action is audited</span>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="content-split">
        <section className="panel form-panel">
          <h2>
            <CalendarPlus size={22} /> New town hall
          </h2>
          <p>
            Write every card explorers can choose. They can’t type messages, so
            your cards are the whole conversation. Prefix a card with an agenda
            number (e.g. <code>2: …</code>) to show it only during that item.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget),
                form = e.currentTarget;
              void run(
                "sz_hall_create",
                {
                  title: fd.get("title"),
                  summary: fd.get("summary"),
                  category: fd.get("category"),
                  minAge: Number(fd.get("minAge")),
                  maxAge: Number(fd.get("maxAge")),
                  capacity: Number(fd.get("capacity")),
                  startsAt: new Date(String(fd.get("startsAt"))).toISOString(),
                  duration: Number(fd.get("duration")),
                  agenda: agenda(fd.get("agenda")),
                  options: [
                    ...cards(fd.get("statements"), "contribution"),
                    ...cards(fd.get("questions"), "question"),
                    ...cards(fd.get("ideas"), "idea"),
                  ],
                },
                "Draft saved. Review it, then publish to open registration.",
              ).then(() => form.reset());
            }}
          >
            <label>
              Title
              <input name="title" required minLength={6} maxLength={100} />
            </label>
            <label>
              Summary
              <textarea
                name="summary"
                required
                minLength={20}
                maxLength={500}
                rows={2}
              />
            </label>
            <div className="form-grid">
              <label>
                Category
                <select name="category">
                  {Object.entries(safezone.categories).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Starts
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label>
                Youngest age
                <input
                  name="minAge"
                  type="number"
                  min={8}
                  max={17}
                  defaultValue={10}
                />
              </label>
              <label>
                Oldest age
                <input
                  name="maxAge"
                  type="number"
                  min={8}
                  max={17}
                  defaultValue={13}
                />
              </label>
              <label>
                Seats
                <input
                  name="capacity"
                  type="number"
                  min={2}
                  max={30}
                  defaultValue={12}
                />
              </label>
              <label>
                Minutes
                <input
                  name="duration"
                  type="number"
                  min={15}
                  max={90}
                  defaultValue={45}
                />
              </label>
            </div>
            <label>
              Agenda — one item per line, e.g. “Share ideas (15 min)”
              <textarea name="agenda" required rows={4} />
            </label>
            <label>
              Statement cards (used during speaking turns)
              <textarea name="statements" required rows={3} />
            </label>
            <label>
              Question cards (shown anonymously)
              <textarea name="questions" rows={2} />
            </label>
            <label>
              Idea cards (solutions explorers can support)
              <textarea name="ideas" rows={3} />
            </label>
            <button className="btn" disabled={busy}>
              Save draft
            </button>
          </form>
        </section>
        <aside>
          <section className="panel">
            <h3>Your town halls</h3>
            {lobby.halls.filter((h) => h.mine).length === 0 && (
              <p className="muted">None yet.</p>
            )}
            {lobby.halls
              .filter((h) => h.mine)
              .map((h) => (
                <div className="sz-console-row" key={h.id}>
                  <div>
                    <strong>{h.title}</strong>
                    <small>
                      {safezone.states[h.state]} · {when(h.startsAt)} ·{" "}
                      {h.registered}/{h.capacity}
                    </small>
                  </div>
                  <div className="card-actions">
                    {next[h.state] && (
                      <button
                        className="btn small"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            "sz_hall_state",
                            { hall: h.id, state: next[h.state]![0] },
                            `${h.title}: ${safezone.states[next[h.state]![0]]}.`,
                          )
                        }
                      >
                        {next[h.state]![1]}
                      </button>
                    )}
                    {["open", "active", "completed"].includes(h.state) && (
                      <Link
                        className="btn small secondary"
                        href={`/safezone/${h.id}`}
                      >
                        Moderate room
                      </Link>
                    )}
                    {!["completed", "cancelled"].includes(h.state) && (
                      <button
                        className="btn small secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            "sz_hall_state",
                            { hall: h.id, state: "cancelled" },
                            `${h.title} cancelled; families were notified.`,
                          )
                        }
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </section>
          <section className="panel">
            <h3>
              <ShieldAlert size={18} /> Safeguarding queue
            </h3>
            {lobby.reports.filter(
              (r) => !["actioned", "dismissed"].includes(r.status),
            ).length === 0 && <p className="muted">No open reports.</p>}
            {lobby.reports
              .filter((r) => !["actioned", "dismissed"].includes(r.status))
              .map((r) => (
                <form
                  className="sz-report"
                  key={r.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    void run(
                      "sz_report_review",
                      {
                        report: r.id,
                        status: fd.get("status"),
                        note: String(fd.get("note") || "") || undefined,
                      },
                      "Report updated; the family was notified.",
                    );
                  }}
                >
                  <strong>
                    {r.reason} ·{" "}
                    <span className={"sev-" + r.severity}>{r.severity}</span>
                  </strong>
                  <small>
                    {r.status.replace("_", " ")} · {when(r.createdAt)}
                    {r.handle ? ` · ${r.handle}` : ""}
                  </small>
                  <label>
                    Decision
                    <select name="status" defaultValue="under_review">
                      <option value="under_review">Under review</option>
                      <option value="escalated">
                        Escalate to safeguarding lead
                      </option>
                      <option value="actioned">Actioned</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </label>
                  <label>
                    Note (staff only)
                    <input name="note" maxLength={500} />
                  </label>
                  <button className="btn small secondary" disabled={busy}>
                    Record decision
                  </button>
                </form>
              ))}
          </section>
        </aside>
      </div>
    </section>
  );
}
