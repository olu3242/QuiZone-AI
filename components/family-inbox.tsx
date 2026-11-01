"use client";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Snapshot } from "@/lib/types";
import { command, useFamily } from "./workspace";

// Guardian-only family inbox. Notices are written by the database (badges, members,
// report reviews, consent updates, game-night reminders); this only marks them read.
export function FamilyInbox({ data }: { data: Snapshot }) {
  const { refresh } = useFamily();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const unread = data.notifications.filter((n) => !n.read_at).length;
  async function read(payload: { id: string } | { all: true }) {
    setBusy(true);
    setError("");
    try {
      await command("notice_read", payload);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the inbox.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel family-inbox" aria-labelledby="inbox-title">
      <div className="mini-heading">
        <h2 id="inbox-title">
          <Bell size={20} /> Family inbox
        </h2>
        <span>{unread ? `${unread} new` : "All caught up"}</span>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {data.notifications.length === 0 ? (
        <div className="simple-empty">
          Nothing yet. Badges, report updates, reminders, and family changes
          show up here.
        </div>
      ) : (
        <>
          <ul className="inbox-list">
            {data.notifications.map((n) => (
              <li key={n.id} className={n.read_at ? "read" : "unread"}>
                <div>
                  <strong>{n.title}</strong>
                  {n.body && <p>{n.body}</p>}
                  <small>{new Date(n.created_at).toLocaleString()}</small>
                </div>
                <div className="inbox-actions">
                  {n.link && (
                    <Link className="btn secondary small" href={n.link}>
                      Open
                    </Link>
                  )}
                  {!n.read_at && (
                    <button
                      className="btn secondary small"
                      disabled={busy}
                      aria-label={`Mark “${n.title}” as read`}
                      onClick={() => void read({ id: n.id })}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {unread > 0 && (
            <button
              className="btn secondary small"
              disabled={busy}
              onClick={() => void read({ all: true })}
            >
              <CheckCheck size={15} /> Mark all read
            </button>
          )}
        </>
      )}
    </section>
  );
}
