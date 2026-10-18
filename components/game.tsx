"use client";
import { zones } from "@/lib/content";
import type { GameData } from "@/lib/game-data";
import {
  ArrowRight,
  Check,
  Clock3,
  Flag,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Allocation } from "./allocation";
import { Blueprint } from "./blueprint";
import { command, useFamily } from "./workspace";
export function Game({
  id,
  initialData,
  initialNow,
}: {
  id: string;
  initialData: GameData;
  initialNow: number;
}) {
  const { refresh } = useFamily();
  const [game, setGame] = useState<GameData | null>(initialData),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [choice, setChoice] = useState<number | null>(null),
    [hint, setHint] = useState(""),
    [reason, setReason] = useState("technical"),
    [notice, setNotice] = useState(""),
    [now, setNow] = useState(initialNow);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/session?id=" + encodeURIComponent(id), {
          cache: "no-store",
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setGame(j);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection interrupted. Your saved answers will load when you reconnect.",
      );
    }
  }, [id]);
  useEffect(() => {
    const interval = setInterval(() => void load(), 5000),
      clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
  }, [load]);
  async function act(
    action: "transition" | "answer" | "plan" | "blueprint" | "hint" | "report",
    extra: Record<string, unknown>,
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await command(action, { session: id, ...extra });
      if (result.hint) setHint(result.hint);
      if (action === "report")
        setNotice(
          "Your report is saved for review. Follow its status in Parent Hub.",
        );
      await load();
      if (action === "answer" || action === "plan" || action === "blueprint") {
        setChoice(null);
        setHint("");
        await refresh();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Retry when connected.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!game)
    return (
      <div className="empty-state" role="status">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="btn" onClick={() => void load()}>
              Try again <RefreshCw size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="loading" />
            <p>Opening your adventure…</p>
          </>
        )}
      </div>
    );
  const { session, version, steps, answers, players } = game,
    c = version.challenges,
    z = zones.find((z) => z.mode === c.mode) || zones[0],
    current = steps.find((s) => !answers.some((a) => a.step_id === s.id)),
    expired =
      now >= new Date(session.expires_at).getTime() &&
      !["complete", "cancelled"].includes(session.state),
    seconds = Math.max(
      0,
      Math.floor((new Date(session.expires_at).getTime() - now) / 1000),
    );
  return (
    <div className="game">
      <div className="game-breadcrumb">
        <Link href="/challenges">← All adventures</Link>
        <span className="pill">
          {z.icon} {z.name}
        </span>
        <span className="muted">{session.code}</span>
      </div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR FAMILY’S ADVENTURE</p>
          <h1>{c.title}</h1>
          <p>
            <Users size={16} />{" "}
            {players.map((p) => p.child_profiles.nickname).join(" + ")}
          </p>
        </div>
        <div className="game-clock">
          <Clock3 size={18} />
          <span aria-label="Time remaining">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
          <small>session limit</small>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error} <button onClick={() => void load()}>Reconnect</button>
        </div>
      )}
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      {expired || session.state === "expired" ? (
        <div className="empty-state">
          <Clock3 />
          <h2>Time for a little break.</h2>
          <p>
            This session has expired. Saved answers remain below. You can start
            a new adventure whenever your family is ready.
          </p>
          <Link href="/challenges" className="btn">
            Find a new adventure
          </Link>
        </div>
      ) : ["lobby", "ready"].includes(session.state) ? (
        <div className="lobby">
          <div className="lobby-art">
            {z.icon}
            <span>✦</span>
          </div>
          <p className="eyebrow">
            {session.state === "lobby" ? "GATHER YOUR CREW" : "ALL SET?"}
          </p>
          <h2>Great ideas need good company.</h2>
          <p className="scenario">{version.scenario}</p>
          <div className="pill">
            <Users size={16} /> {players.length} explorers · One shared screen ·
            Guardian-led
          </div>
          <p>
            Read the scenario together. Make room for everyone’s ideas before
            choosing an answer.
          </p>
          <button
            disabled={busy}
            className="btn"
            onClick={() =>
              void act("transition", {
                state: session.state === "lobby" ? "ready" : "active",
              })
            }
          >
            {busy
              ? "Saving…"
              : session.state === "lobby"
                ? "Our crew is ready"
                : "Start the adventure"}{" "}
            <ArrowRight size={18} />
          </button>
        </div>
      ) : session.state === "paused" ? (
        <div className="empty-state">
          <Pause />
          <h2>A moment to think.</h2>
          <p>
            Your answers are saved. The guardian’s session limit continues
            during a pause.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => void act("transition", { state: "active" })}
          >
            Resume together <Play size={17} />
          </button>
        </div>
      ) : session.state === "cancelled" ? (
        <div className="empty-state">
          <h2>This adventure has ended.</h2>
          <p>
            Any saved answers are available below. No completion XP is awarded
            for a cancelled session.
          </p>
          <Link href="/challenges" className="btn">
            Explore another challenge
          </Link>
        </div>
      ) : session.state === "complete" ? (
        <section className="results">
          <span className="celebration">✦</span>
          <Trophy size={58} />
          <p className="eyebrow">LOOK WHAT YOU FIGURED OUT TOGETHER</p>
          <h2>That’s a family win.</h2>
          <p>You shared ideas, made decisions, and completed your adventure.</p>
          <strong>
            {session.total_score}
            <span>team points</span>
          </strong>
          <div className="result-stats">
            <span>
              <Check /> {answers.length} decisions saved
            </span>
            <span>
              <Users /> {players.length} explorers
            </span>
          </div>
          <div className="reflection">
            <h3>Before your next adventure…</h3>
            <p>
              What changed your mind? What would you try differently? Give
              everyone a chance to share.
            </p>
          </div>
          <div className="button-row">
            <Link className="btn" href="/challenges">
              One more adventure <ArrowRight size={17} />
            </Link>
            <Link className="btn secondary" href="/parent">
              View parent summary
            </Link>
          </div>
        </section>
      ) : current ? (
        <div className="content-split game-columns">
          <section className="panel question">
            <div className="question-top">
              <span className="eyebrow">
                DECISION {answers.length + 1} OF {steps.length}
              </span>
              <button
                className="icon-button"
                aria-label="Pause adventure"
                disabled={busy}
                onClick={() => void act("transition", { state: "paused" })}
              >
                <Pause size={19} />
              </button>
            </div>
            <div className="step-progress">
              {steps.map((s) => (
                <span
                  key={s.id}
                  className={
                    answers.some((a) => a.step_id === s.id)
                      ? "done"
                      : s.id === current.id
                        ? "current"
                        : ""
                  }
                />
              ))}
            </div>
            <h2>{current.prompt}</h2>
            <p>Talk it through, then choose your family’s answer.</p>
            {current.kind === "blueprint" ? (
              <Blueprint
                key={current.id}
                disabled={busy}
                onSubmit={(design) =>
                  void act("blueprint", { step: current.id, design })
                }
              />
            ) : current.kind === "allocation" ? (
              <Allocation
                key={current.id}
                disabled={busy}
                onSubmit={(allocation) =>
                  void act("plan", { step: current.id, allocation })
                }
              />
            ) : (
              <>
                <fieldset className="answer-options">
                  <legend className="sr-only">Choose an answer</legend>
                  {current.options.map((option, i) => (
                    <label className={choice === i ? "chosen" : ""} key={i}>
                      <input
                        type="radio"
                        name="answer"
                        value={i}
                        checked={choice === i}
                        onChange={() => setChoice(i)}
                        disabled={busy}
                      />
                      <span>{String.fromCharCode(65 + i)}</span>
                      <strong>{option}</strong>
                      {choice === i && <Check size={18} />}
                    </label>
                  ))}
                </fieldset>
                <button
                  disabled={choice === null || busy}
                  className="btn full"
                  onClick={() =>
                    void act("answer", { step: current.id, choice })
                  }
                >
                  {busy ? "Saving your decision…" : "Lock in our answer"}{" "}
                  <ArrowRight size={18} />
                </button>
              </>
            )}
          </section>
          <aside>
            <div className="panel scenario-panel">
              <p className="eyebrow">THE BIG PICTURE</p>
              <h3>Keep your mission in mind.</h3>
              <p>{version.scenario}</p>
            </div>
            <div className="q-card">
              <span className="q-avatar">Q</span>
              <h3>A little nudge?</h3>
              <p>
                Q can offer a reviewed, prewritten hint to help your family
                think it through.
              </p>
              {hint && (
                <p className="hint" role="status">
                  {hint}
                </p>
              )}
              <button
                className="btn secondary full"
                disabled={busy}
                onClick={() => void act("hint", {})}
              >
                <Sparkles size={16} /> Ask for a hint
              </button>
              <small>A guardian can enable hints in Family preferences.</small>
            </div>
          </aside>
        </div>
      ) : (
        <p role="status">Refreshing your saved session…</p>
      )}
      {answers.length > 0 && (
        <section className="answer-history">
          <h2>Your thinking trail</h2>
          {answers.map((a) => (
            <article className="panel" key={a.id}>
              <div>
                <span className="round-icon">
                  <Check size={18} />
                </span>
                <h3>{steps.find((s) => s.id === a.step_id)?.prompt}</h3>
                <span className="pill">+{a.points} points</span>
              </div>
              <p>
                <strong>Your choice:</strong>{" "}
                {a.design
                  ? Object.entries(a.design)
                      .filter(([, enabled]) => enabled)
                      .map(([feature]) => feature)
                      .join(", ")
                  : a.allocation
                    ? Object.entries(a.allocation)
                        .map(
                          ([key, value]) =>
                            `${key}: $${value.toLocaleString()}`,
                        )
                        .join(" · ")
                    : a.choice !== null
                      ? steps.find((s) => s.id === a.step_id)?.options[a.choice]
                      : ""}
              </p>
              <p>{a.feedback}</p>
            </article>
          ))}
        </section>
      )}
      <div className="game-footer">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act("report", { reason });
          }}
        >
          <label htmlFor="report-reason">
            <Flag size={16} /> Something needs a grown-up’s attention?
          </label>
          <select
            id="report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="technical">Technical issue</option>
            <option value="incorrect">Incorrect content</option>
            <option value="inappropriate">Inappropriate content</option>
            <option value="privacy">Privacy concern</option>
          </select>
          <button className="btn secondary small" disabled={busy}>
            Submit report
          </button>
        </form>
        {!["complete", "cancelled", "expired"].includes(session.state) &&
          !expired && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "End this adventure? Saved answers remain, but completion XP will not be awarded.",
                  )
                )
                  void act("transition", { state: "cancelled" });
              }}
            >
              End this adventure
            </button>
          )}
      </div>
    </div>
  );
}
