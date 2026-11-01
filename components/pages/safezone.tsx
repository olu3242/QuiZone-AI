"use client";
import { safezone } from "@/lib/content";
import type { Child, Hall, SafeZoneLobby } from "@/lib/types";
import {
  Bell,
  CalendarClock,
  Landmark,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Empty, Feedback, Heading, NeedHousehold } from "../family-ui";
import { consent, loadLobby, when } from "../safezone/api";
import { ConsentDialog } from "../safezone/consent-dialog";
import { ModeratorConsole } from "../safezone/moderator-console";
import { command, useFamily } from "../workspace";

function eligibility(c: Child, h: Hall, lobby: SafeZoneLobby) {
  const reg = lobby.registrations.find(
    (r) => r.hall === h.id && r.child === c.id,
  );
  if (reg?.status === "registered") return "Already registered";
  if (reg?.status === "removed") return "Removed by moderator";
  if (c.age < h.minAge || c.age > h.maxAge)
    return `For ages ${h.minAge}–${h.maxAge}`;
  return null;
}

export function SafeZonePage() {
  const { data } = useFamily();
  const [lobby, setLobby] = useState<SafeZoneLobby | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState("all"),
    [registering, setRegistering] = useState<Hall | null>(null),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setLobby(await loadLobby());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "SafeZone is unavailable.");
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);
  const done = async (note: string) => {
    setRegistering(null);
    await refresh();
    setMessage(note);
  };
  if (!data) return null;
  const heading = (
    <Heading
      eyebrow={safezone.tagline.toUpperCase()}
      title="SafeZone town halls"
      description="Moderated, guardian-approved town halls where explorers share ideas, ask questions, and vote on solutions."
    />
  );
  if (error)
    return (
      <>
        {heading}
        <p className="notice error" role="alert">
          {error} <button onClick={() => void refresh()}>Try again</button>
        </p>
      </>
    );
  if (!lobby)
    return (
      <>
        {heading}
        <div className="empty-state" role="status">
          <div className="loading" />
          <h2>Loading town halls…</h2>
        </div>
      </>
    );
  const crew = data.children.filter((c) => !c.archived_at);
  const nameOf = (id: string) =>
    data.children.find((c) => c.id === id)?.nickname ?? "Explorer";
  const halls = lobby.halls.filter(
    (h) => h.state !== "draft" && (filter === "all" || h.category === filter),
  );
  const upcoming = halls.filter((h) =>
    ["scheduled", "open", "active"].includes(h.state),
  );
  const history = lobby.registrations
    .map((r) => ({ r, h: lobby.halls.find((h) => h.id === r.hall) }))
    .filter((x) => x.h && ["completed", "cancelled"].includes(x.h.state));
  async function withdraw(hall: string, child: string) {
    setBusy(true);
    try {
      await command("sz_withdraw", { hall, child });
      await done(
        "Consent withdrawn. Their contributions and votes were removed.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not withdraw.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {heading}
      <Feedback message={message} />
      {!lobby.enabled && (
        <div className="notice" role="status">
          <ShieldCheck size={18} /> SafeZone is in safety review and isn’t open
          to families yet.
          {lobby.staff ? " Moderators can prepare town halls below." : ""}
        </div>
      )}
      {lobby.enabled && !data.household && !lobby.staff && <NeedHousehold />}
      {lobby.enabled && data.household && (
        <div className="content-split">
          <section>
            {!lobby.permission ? (
              <section className="panel form-panel">
                <h2>
                  <ShieldCheck size={22} /> Turn on SafeZone for your family
                </h2>
                <p>
                  You’ll still approve each town hall separately. Your password
                  confirms a grown-up is making this choice.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    setBusy(true);
                    consent("sz_permission", String(fd.get("password")), {
                      enabled: true,
                    })
                      .then(() =>
                        done("SafeZone is on. Choose a town hall to approve."),
                      )
                      .catch((err) =>
                        setMessage(
                          err instanceof Error
                            ? err.message
                            : "Could not save.",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  <label>
                    Guardian password
                    <input
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <button className="btn" disabled={busy}>
                    Enable SafeZone
                  </button>
                </form>
              </section>
            ) : (
              <>
                <div
                  className="filters"
                  role="group"
                  aria-label="Filter by topic"
                >
                  {["all", ...Object.keys(safezone.categories)].map((k) => (
                    <button
                      key={k}
                      className={filter === k ? "active" : ""}
                      aria-pressed={filter === k}
                      onClick={() => setFilter(k)}
                    >
                      {k === "all" ? "All topics" : safezone.categories[k]}
                    </button>
                  ))}
                </div>
                {upcoming.length === 0 ? (
                  <Empty
                    title="No town halls scheduled right now."
                    description="New moderated sessions are added regularly. Check back soon."
                  />
                ) : (
                  <div className="sz-hall-grid">
                    {upcoming.map((h) => {
                      const mine = lobby.registrations.filter(
                        (r) => r.hall === h.id,
                      );
                      return (
                        <article className="panel sz-hall" key={h.id}>
                          <div className="sz-hall-top">
                            <span className="pill">
                              {safezone.categories[h.category]}
                            </span>
                            <span className={"sz-state state-" + h.state}>
                              {safezone.states[h.state]}
                            </span>
                          </div>
                          <h3>{h.title}</h3>
                          <p>{h.summary}</p>
                          <ul className="sz-facts">
                            <li>
                              <CalendarClock size={15} /> {when(h.startsAt)} ·{" "}
                              {h.duration} min
                            </li>
                            <li>
                              <Users size={15} /> Ages {h.minAge}–{h.maxAge} ·{" "}
                              {h.registered}/{h.capacity} seats
                            </li>
                          </ul>
                          {h.agenda && (
                            <details>
                              <summary>Agenda</summary>
                              <ol>
                                {h.agenda.map((a) => (
                                  <li key={a.ordinal}>
                                    {a.title} — {a.minutes} min
                                  </li>
                                ))}
                              </ol>
                            </details>
                          )}
                          {mine.map((r) => (
                            <div className="sz-reg" key={r.child}>
                              <span>
                                <strong>{nameOf(r.child)}</strong> appears as{" "}
                                <em>{r.handle}</em>
                                {r.status !== "registered" && ` · ${r.status}`}
                              </span>
                              {r.status === "registered" && (
                                <span className="card-actions">
                                  {["open", "active"].includes(h.state) && (
                                    <Link
                                      className="btn small"
                                      href={`/safezone/${h.id}?child=${r.child}`}
                                    >
                                      Enter room
                                    </Link>
                                  )}
                                  <button
                                    className="btn small secondary"
                                    disabled={busy}
                                    onClick={() => void withdraw(h.id, r.child)}
                                  >
                                    Withdraw consent
                                  </button>
                                </span>
                              )}
                            </div>
                          ))}
                          {["scheduled", "open"].includes(h.state) &&
                            h.registered < h.capacity && (
                              <button
                                className="btn small secondary"
                                onClick={() => setRegistering(h)}
                              >
                                Approve an explorer
                              </button>
                            )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {history.length > 0 && (
              <section className="panel">
                <h3>Participation history</h3>
                {history.map(({ r, h }) => (
                  <div className="sz-console-row" key={r.hall + r.child}>
                    <div>
                      <strong>{h!.title}</strong>
                      <small>
                        {nameOf(r.child)} as {r.handle} ·{" "}
                        {safezone.states[h!.state]} · {when(h!.startsAt)}
                      </small>
                    </div>
                    {r.status === "registered" && (
                      <span className="card-actions">
                        {h!.state === "completed" && (
                          <Link
                            className="btn small secondary"
                            href={`/safezone/${h!.id}?child=${r.child}`}
                          >
                            View summary
                          </Link>
                        )}
                        <button
                          className="btn small secondary"
                          disabled={busy}
                          onClick={() => void withdraw(h!.id, r.child)}
                        >
                          Withdraw & erase contributions
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </section>
            )}
          </section>
          <aside>
            <section className="panel">
              <h3>
                <Landmark size={18} /> How SafeZone stays safe
              </h3>
              <ul className="checklist">
                {safezone.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h3>
                <Bell size={18} /> Safety notifications
              </h3>
              {lobby.notifications.length === 0 ? (
                <p className="muted">Nothing yet.</p>
              ) : (
                <ul className="sz-notes">
                  {lobby.notifications.map((n) => (
                    <li key={n.id} className={"note-" + n.kind}>
                      {n.message}
                      <small>{when(n.createdAt)}</small>
                    </li>
                  ))}
                </ul>
              )}
              {lobby.reports.length > 0 && !lobby.staff && (
                <>
                  <h4>Your reports</h4>
                  <ul className="sz-notes">
                    {lobby.reports.map((r) => (
                      <li key={r.id}>
                        {safezone.reportReasons[r.reason] ?? r.reason} ·{" "}
                        {r.status.replace("_", " ")}
                        <small>{when(r.createdAt)}</small>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            {lobby.permission && (
              <button
                className="btn small secondary full"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  command("sz_permission", { enabled: false })
                    .then(() =>
                      done(
                        "SafeZone is off. All upcoming registrations were withdrawn.",
                      ),
                    )
                    .catch((e) =>
                      setMessage(
                        e instanceof Error ? e.message : "Could not save.",
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Turn off SafeZone for my family
              </button>
            )}
          </aside>
        </div>
      )}
      {lobby.staff && <ModeratorConsole lobby={lobby} onChange={done} />}
      {registering && (
        <ConsentDialog
          hall={registering}
          explorers={crew.map((c) => ({
            child: c,
            reason: eligibility(c, registering, lobby),
          }))}
          onClose={() => setRegistering(null)}
          onDone={done}
        />
      )}
    </>
  );
}
