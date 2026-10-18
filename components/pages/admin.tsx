"use client";
import { zones } from "@/lib/content";
import type { AppAction } from "@/lib/validation";
import { Plus } from "lucide-react";
import { useState } from "react";

import { Empty, Feedback, Heading, zoneFor } from "../family-ui";
import { command, useFamily } from "../workspace";
export function AdminPage() {
  const { data, refresh } = useFamily(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!data) return null;
  if (!data.admin)
    return (
      <Empty
        title="Guardian space only."
        description="Content and safety tools require a separately assigned staff role."
      />
    );
  async function execute(action: AppAction["action"], payload: unknown) {
    setBusy(true);
    setMessage("");
    try {
      await command(action, payload);
      await refresh();
      setMessage("Saved with an audit record.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="CONTENT & SAFETY"
        title="Review with care."
        description="Staff access is assigned in the database, never through a profile preference."
      />
      <Feedback message={message} />
      <div className="content-split">
        <section>
          <h2>Challenge library</h2>
          {data.challenges.map((c) => (
            <article className="panel summary-card" key={c.id}>
              <h3>{c.title}</h3>
              <p>{zoneFor(c.mode).name}</p>
              {c.versions.map((v) => (
                <div className="session-row" key={v.id}>
                  <span>
                    v{v.version} · {v.status}
                  </span>
                  {v.status === "draft" && (
                    <button
                      disabled={busy}
                      className="btn small secondary"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Confirm that you reviewed this challenge for age appropriateness, accuracy, and family safety. Publish it?",
                          )
                        )
                          void execute("publish", {
                            version: v.id,
                            ageReviewed: true,
                          });
                      }}
                    >
                      Confirm age review & publish
                    </button>
                  )}
                </div>
              ))}
            </article>
          ))}
          <h2>Moderation queue</h2>
          {data.cases.length ? (
            data.cases.map((c) => (
              <article className="panel summary-card" key={c.id}>
                <h3>{c.reason}</h3>
                <p>
                  {c.status} · {new Date(c.created_at).toLocaleString()}
                </p>
                <div className="button-row">
                  {["under_review", "actioned", "dismissed", "escalated"].map(
                    (status) => (
                      <button
                        disabled={
                          busy || ["actioned", "dismissed"].includes(c.status)
                        }
                        className="btn secondary small"
                        key={status}
                        onClick={() =>
                          void execute("review", { caseId: c.id, status })
                        }
                      >
                        {status.replace("_", " ")}
                      </button>
                    ),
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="simple-empty">No reports in the queue.</div>
          )}
        </section>
        <aside className="panel form-panel">
          <h2>Create a guided challenge</h2>
          <p>
            A draft is never playable until an administrator completes an age
            and content review.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void execute("draft", {
                title: f.get("title"),
                mode: f.get("mode"),
                scenario: f.get("scenario"),
                prompt: f.get("prompt"),
                options: String(f.get("options"))
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                correct: Number(f.get("correct")),
                hint: f.get("hint"),
                explanation: f.get("explanation"),
              });
            }}
          >
            <label>
              Title
              <input name="title" required minLength={4} maxLength={100} />
            </label>
            <label>
              Mode
              <select name="mode">
                {zones.map((z) => (
                  <option key={z.mode} value={z.mode}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Scenario
              <textarea
                name="scenario"
                required
                minLength={20}
                maxLength={1000}
              />
            </label>
            <label>
              Step prompt
              <textarea name="prompt" required minLength={10} maxLength={500} />
            </label>
            <label>
              Options (2–6, one per line)
              <textarea name="options" required />
            </label>
            <label>
              Best answer index (starting at 0)
              <input name="correct" type="number" min={0} max={5} required />
            </label>
            <label>
              Hint
              <textarea name="hint" required minLength={10} maxLength={300} />
            </label>
            <label>
              Feedback
              <textarea
                name="explanation"
                required
                minLength={10}
                maxLength={500}
              />
            </label>
            <button className="btn full" disabled={busy}>
              Save draft <Plus size={16} />
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
