"use client";
import { safezone } from "@/lib/content";
import type { CardOption, Room } from "@/lib/types";
import type { AppAction } from "@/lib/validation";
import { Flag, Hand, Landmark, OctagonX, RefreshCw, Vote } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { command } from "../workspace";
import { loadRoom } from "./api";

export function TownHallRoom({
  hall,
  child,
}: {
  hall: string;
  child: string | null;
}) {
  const [room, setRoom] = useState<Room | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState(false);
  const load = useCallback(async () => {
    try {
      setRoom(await loadRoom(hall, child));
      setError("");
      setOffline(false);
    } catch (e) {
      // Keep the last good view; show reconnecting rather than blanking the room.
      setOffline(true);
      setError(e instanceof Error ? e.message : "Connection lost.");
    }
  }, [hall, child]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0),
      t = setInterval(() => void load(), 3000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);
  async function act(
    action: AppAction["action"],
    data: Record<string, unknown>,
    done = "",
  ) {
    setBusy(true);
    setNotice("");
    try {
      await command(action, child ? { child, ...data } : data);
      if (done) setNotice(done);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  if (!room)
    return error ? (
      <div className="empty-state">
        <Flag />
        <h2>We couldn’t open this town hall.</h2>
        <p role="alert">{error}</p>
        <Link className="btn" href="/safezone">
          Back to SafeZone
        </Link>
      </div>
    ) : (
      <div className="empty-state" role="status">
        <div className="loading" />
        <h2>Joining the town hall…</h2>
      </div>
    );
  const { hall: h, me, moderator: mod } = room;
  const header = (
    <div className="page-heading">
      <div>
        <p className="eyebrow">SAFEZONE TOWN HALL</p>
        <h1>{h.title}</h1>
        <p>
          <span className={"sz-state state-" + h.state}>
            {safezone.states[h.state]}
          </span>
          {me?.handle && (
            <>
              {" "}
              · You appear as <strong>{me.handle}</strong>
            </>
          )}
          {mod && " · You are the moderator"}
          {room.participants !== undefined &&
            ` · ${room.participants} explorers`}
        </p>
      </div>
      <Link className="btn small secondary" href="/safezone">
        Leave room
      </Link>
    </div>
  );
  const status = (
    <>
      {offline && (
        <p className="notice error" role="alert">
          <RefreshCw size={16} /> Reconnecting… your saved place is kept.{" "}
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
  if (me && me.status !== "registered")
    return (
      <>
        {header}
        <div className="empty-state">
          <Landmark />
          <h2>
            {me.status === "removed"
              ? "A moderator removed you from this town hall."
              : "Consent for this town hall was withdrawn."}
          </h2>
          {me.removedReason && <p>Reason: {me.removedReason}</p>}
          <p>Your guardian can see what happened in SafeZone notifications.</p>
        </div>
      </>
    );
  const current = room.agenda?.find((a) => a.ordinal === h.currentItem);
  const cardsFor = (kind: CardOption["kind"]) =>
    (room.options || []).filter(
      (o) =>
        o.kind === kind && (o.agenda === null || o.agenda === h.currentItem),
    );
  const sharedStatus = (id: string) =>
    me?.shared?.find((s) => s.option === id)?.status;
  const speaking = me?.hand === "speaking";
  const Card = ({ o }: { o: CardOption }) => {
    const st = sharedStatus(o.id);
    const needsTurn = o.kind === "contribution" && !speaking;
    return (
      <button
        className={"sz-card kind-" + o.kind + (st ? " shared" : "")}
        disabled={busy || Boolean(st) || needsTurn || mod}
        onClick={() =>
          void act(
            "sz_say",
            { hall: h.id, option: o.id },
            "Sent to the moderator for review.",
          )
        }
      >
        {o.text}
        {st && <small>{st === "pending" ? "Waiting for moderator" : st}</small>}
      </button>
    );
  };
  return (
    <>
      {header}
      {status}
      {h.state === "cancelled" && (
        <div className="empty-state">
          <OctagonX />
          <h2>This town hall has closed.</h2>
          <p>
            {h.closedReason?.startsWith("emergency")
              ? "The moderator closed it early for safety. A safeguarding lead will review it."
              : "It was cancelled by the moderator."}
          </p>
        </div>
      )}
      {(h.state === "scheduled" || h.state === "open") && !mod && (
        <div className="empty-state" role="status">
          <Landmark />
          <h2>
            {h.state === "open"
              ? "The room is open — the moderator will start soon."
              : "This town hall hasn’t opened yet."}
          </h2>
          <p>Stay on this page. It updates by itself.</p>
        </div>
      )}
      {h.state === "completed" && room.summary && (
        <section className="results sz-summary">
          <p className="eyebrow">TOWN HALL SUMMARY</p>
          <h2>Thank you for sharing your voice.</h2>
          <p>
            {room.summary.participants} explorers · {room.summary.contributions}{" "}
            contributions shared
          </p>
          {room.summary.ideas.length > 0 && (
            <>
              <h3>Ideas the group supported</h3>
              <ol>
                {room.summary.ideas.map((i) => (
                  <li key={i.text}>
                    {i.text} — {i.supporters} supporter
                    {i.supporters === 1 ? "" : "s"}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}
      {(h.state === "active" ||
        (mod && ["open", "active"].includes(h.state)) ||
        h.state === "completed") && (
        <div className="content-split sz-room">
          <section>
            {h.state === "active" && current && (
              <div className="panel sz-now">
                <p className="eyebrow">NOW · AGENDA ITEM {current.ordinal}</p>
                <h2>{current.title}</h2>
                {!mod && (
                  <div className="card-actions">
                    {me?.hand ? (
                      <button
                        className="btn secondary"
                        disabled={busy}
                        onClick={() =>
                          void act("sz_hand", { hall: h.id, raised: false })
                        }
                      >
                        <Hand size={17} /> Lower hand
                      </button>
                    ) : (
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            "sz_hand",
                            { hall: h.id, raised: true },
                            "Hand raised. The moderator will call on you.",
                          )
                        }
                      >
                        <Hand size={17} /> Raise hand
                      </button>
                    )}
                    {speaking && (
                      <span className="pill sz-speaking">
                        It’s your turn to speak
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            {h.state === "active" && !mod && (
              <>
                <h3>
                  Say something {speaking ? "" : "(raise your hand first)"}
                </h3>
                <div className="sz-cards">
                  {cardsFor("contribution").map((o) => (
                    <Card key={o.id} o={o} />
                  ))}
                </div>
                {cardsFor("idea").length > 0 && (
                  <>
                    <h3>Support an idea</h3>
                    <div className="sz-cards">
                      {cardsFor("idea").map((o) => (
                        <Card key={o.id} o={o} />
                      ))}
                    </div>
                  </>
                )}
                {cardsFor("question").length > 0 && (
                  <>
                    <h3>Ask a question (shared without your name)</h3>
                    <div className="sz-cards">
                      {cardsFor("question").map((o) => (
                        <Card key={o.id} o={o} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {(room.polls || []).map((p) => {
              const mine = me?.votes?.[p.id];
              return (
                <section
                  className="panel sz-poll"
                  key={p.id}
                  aria-labelledby={"poll-" + p.id}
                >
                  <h3 id={"poll-" + p.id}>
                    <Vote size={18} /> {p.question}
                  </h3>
                  <p className="muted">
                    {p.state === "draft"
                      ? "Draft — not visible to explorers"
                      : p.state === "open"
                        ? `Voting open · ${p.votes} votes`
                        : "Voting closed"}
                  </p>
                  <div className="sz-cards">
                    {p.options.map((opt, i) => (
                      <button
                        key={opt}
                        className={"sz-card" + (mine === i ? " shared" : "")}
                        disabled={
                          mod ||
                          busy ||
                          p.state !== "open" ||
                          mine !== undefined
                        }
                        aria-pressed={mine === i}
                        onClick={() =>
                          void act(
                            "sz_vote",
                            { poll: p.id, choice: i },
                            "Vote saved.",
                          )
                        }
                      >
                        {opt}
                        {p.results && <small>{p.results[i]} votes</small>}
                      </button>
                    ))}
                  </div>
                  {mod && p.state !== "closed" && (
                    <button
                      className="btn small secondary"
                      disabled={busy}
                      onClick={() =>
                        void act("sz_poll_state", {
                          poll: p.id,
                          state: p.state === "draft" ? "open" : "closed",
                        })
                      }
                    >
                      {p.state === "draft" ? "Open voting" : "Close voting"}
                    </button>
                  )}
                </section>
              );
            })}
            <section className="panel">
              <h3>Shared in this town hall</h3>
              {(room.feed || []).length === 0 ? (
                <p className="muted">
                  Approved contributions will appear here.
                </p>
              ) : (
                <ul className="sz-feed">
                  {room.feed!.map((f) => (
                    <li key={f.id} className={"kind-" + f.kind}>
                      <strong>{f.handle ?? "Anonymous question"}</strong>{" "}
                      {f.text}
                      {!mod && h.state === "active" && (
                        <button
                          className="text-link"
                          aria-label={`Report: ${f.text}`}
                          onClick={() =>
                            void act(
                              "sz_report",
                              {
                                hall: h.id,
                                reason: "inappropriate",
                                contribution: f.id,
                              },
                              "Report sent to the moderators.",
                            )
                          }
                        >
                          Report
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>
          <aside>
            <section className="panel">
              <h3>Agenda</h3>
              <ol className="sz-agenda">
                {(room.agenda || []).map((a) => (
                  <li
                    key={a.ordinal}
                    className={a.ordinal === h.currentItem ? "current" : ""}
                    aria-current={
                      a.ordinal === h.currentItem ? "step" : undefined
                    }
                  >
                    {a.title} <small>{a.minutes} min</small>
                    {mod &&
                      h.state === "active" &&
                      a.ordinal !== h.currentItem && (
                        <button
                          className="text-link"
                          disabled={busy}
                          onClick={() =>
                            void act("sz_agenda", {
                              hall: h.id,
                              item: a.ordinal,
                            })
                          }
                        >
                          Go
                        </button>
                      )}
                  </li>
                ))}
              </ol>
            </section>
            <section className="panel">
              <h3>
                <Hand size={18} /> Raised hands
              </h3>
              {(room.queue || []).length === 0 ? (
                <p className="muted">No hands raised.</p>
              ) : (
                <ol className="sz-queue">
                  {room.queue!.map((q) => (
                    <li key={q.handle}>
                      {q.handle}{" "}
                      {q.state === "speaking" && (
                        <span className="pill sz-speaking">speaking</span>
                      )}
                      {mod && q.state === "waiting" && (
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() =>
                            void act("sz_turn", { hall: h.id, hand: q.hand })
                          }
                        >
                          Give turn
                        </button>
                      )}
                      {mod && q.state === "speaking" && (
                        <button
                          className="btn small secondary"
                          disabled={busy}
                          onClick={() =>
                            void act("sz_turn", { hall: h.id, hand: null })
                          }
                        >
                          End turn
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
            {!mod && h.state === "active" && (
              <form
                className="panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const reason = new FormData(e.currentTarget).get("reason");
                  void act(
                    "sz_report",
                    { hall: h.id, reason },
                    "Thank you. A moderator will look at your report.",
                  );
                }}
              >
                <h3>
                  <Flag size={18} /> Something wrong?
                </h3>
                <label>
                  Tell a moderator
                  <select name="reason">
                    {Object.entries(safezone.reportReasons).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn small secondary" disabled={busy}>
                  Send report
                </button>
              </form>
            )}
            {mod && <ModeratorTools room={room} busy={busy} act={act} />}
          </aside>
        </div>
      )}
    </>
  );
}

function ModeratorTools({
  room,
  busy,
  act,
}: {
  room: Room;
  busy: boolean;
  act: (
    a: AppAction["action"],
    d: Record<string, unknown>,
    done?: string,
  ) => Promise<void>;
}) {
  const h = room.hall;
  return (
    <>
      <section className="panel">
        <h3>Waiting for review ({room.pending?.length ?? 0})</h3>
        {(room.pending || []).map((p) => (
          <div className="sz-review" key={p.id}>
            <p>
              <strong>{p.handle}</strong> · {p.kind}: {p.text}
            </p>
            <span className="card-actions">
              <button
                className="btn small"
                disabled={busy}
                onClick={() =>
                  void act("sz_review", { contribution: p.id, approve: true })
                }
              >
                Approve
              </button>
              <button
                className="btn small secondary"
                disabled={busy}
                onClick={() =>
                  void act("sz_review", { contribution: p.id, approve: false })
                }
              >
                Decline
              </button>
            </span>
          </div>
        ))}
      </section>
      {h.state === "open" && (
        <button
          className="btn full"
          disabled={busy}
          onClick={() =>
            void act("sz_hall_state", { hall: h.id, state: "active" })
          }
        >
          Start town hall
        </button>
      )}
      {h.state === "active" && (
        <>
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget),
                form = e.currentTarget;
              void act(
                "sz_poll_create",
                {
                  hall: h.id,
                  question: fd.get("question"),
                  options: String(fd.get("options") || "")
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
                "Poll drafted. Open voting when ready.",
              ).then(() => form.reset());
            }}
          >
            <h3>New poll</h3>
            <label>
              Question
              <input name="question" required minLength={6} maxLength={200} />
            </label>
            <label>
              Choices (one per line)
              <textarea name="options" required rows={3} />
            </label>
            <button className="btn small secondary" disabled={busy}>
              Draft poll
            </button>
          </form>
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void act(
                "sz_remove",
                {
                  hall: h.id,
                  handle: fd.get("handle"),
                  reason: fd.get("reason"),
                },
                "Participant removed; their guardian was notified.",
              );
            }}
          >
            <h3>Remove a participant</h3>
            <label>
              Session name
              <select name="handle" required>
                {(room.roster || [])
                  .filter((r) => r.status === "registered")
                  .map((r) => (
                    <option key={r.handle}>{r.handle}</option>
                  ))}
              </select>
            </label>
            <label>
              Reason (shared with their guardian)
              <input name="reason" required minLength={3} maxLength={300} />
            </label>
            <button className="btn small secondary" disabled={busy}>
              Remove
            </button>
          </form>
          <button
            className="btn full"
            disabled={busy}
            onClick={() =>
              void act(
                "sz_hall_state",
                { hall: h.id, state: "completed" },
                "Town hall completed.",
              )
            }
          >
            Complete town hall
          </button>
        </>
      )}
      {["open", "active"].includes(h.state) && (
        <form
          className="panel danger-zone"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              "sz_emergency_close",
              {
                hall: h.id,
                reason: new FormData(e.currentTarget).get("reason"),
              },
              "Town hall closed. An urgent incident was escalated.",
            );
          }}
        >
          <h3>
            <OctagonX size={18} /> Emergency close
          </h3>
          <label>
            Reason
            <input name="reason" required minLength={3} maxLength={300} />
          </label>
          <button className="btn small danger" disabled={busy}>
            Close now and escalate
          </button>
        </form>
      )}
    </>
  );
}
