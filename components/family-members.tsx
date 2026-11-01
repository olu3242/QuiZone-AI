"use client";
import {
  Copy,
  KeyRound,
  LogOut,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { Snapshot } from "@/lib/types";
import { avatar } from "./family-ui";
import { command, useFamily } from "./workspace";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Could not save. Please try again.";

// Shown to a signed-in adult with no household: join a family with an invite code.
export function JoinHousehold() {
  const { refresh } = useFamily();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel form-panel" aria-labelledby="join-title">
      <KeyRound className="accent" />
      <h2 id="join-title">Invited by your family’s guardian?</h2>
      <p>
        Enter the code they gave you to play household games on this device. You
        won’t be able to change explorers or family settings.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const r = await command("member_join", {
              code: String(fd.get("code") || ""),
              displayName: String(fd.get("displayName") || ""),
            });
            if (!r.joined)
              throw new Error("This invite code is invalid or has expired.");
            await refresh();
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Invite code
          <input
            name="code"
            required
            autoComplete="off"
            placeholder="ABCD-1234-EF56"
            maxLength={16}
          />
        </label>
        <label>
          Your name in this family
          <input
            name="displayName"
            required
            minLength={2}
            maxLength={24}
            pattern="[A-Za-z0-9 _\-]{2,24}"
            placeholder="Aunt Bea"
          />
        </label>
        <button className="btn secondary" disabled={busy}>
          {busy ? "Joining…" : "Join this family"} <UserPlus size={17} />
        </button>
      </form>
    </section>
  );
}

// Guardian: who else can host games, plus invitations.
export function MembersPanel({ data }: { data: Snapshot }) {
  const { refresh } = useFamily();
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(
      null,
    ),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel members-panel" aria-labelledby="members-title">
      <div className="mini-heading">
        <h2 id="members-title">
          <Users size={20} /> Family adults
        </h2>
        <span>{data.members.length} / 4 members</span>
      </div>
      <p>
        Invite another adult in your family to host and play games on their own
        device. Only you can manage explorers, permissions, consent, and
        SafeZone.
      </p>
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <ul className="member-list">
        <li>
          <strong>You</strong> <span className="muted">Guardian</span>
        </li>
        {data.members.map((m) => (
          <li key={m.user_id}>
            <strong>{m.display_name}</strong>
            <span className="muted">Joined {when(m.joined_at)}</span>
            <button
              className="btn secondary small"
              disabled={Boolean(busy)}
              aria-label={`Remove ${m.display_name}`}
              onClick={() =>
                void run("remove" + m.user_id, async () => {
                  await command("member_remove", { member: m.user_id });
                  setMessage(`${m.display_name} no longer has access.`);
                })
              }
            >
              <UserMinus size={15} /> Remove
            </button>
          </li>
        ))}
      </ul>
      {code && (
        <div className="invite-code" role="status">
          <p>
            Share this code with them in person or by a message you trust. It
            works once and expires {when(code.expiresAt)}. We won’t show it
            again.
          </p>
          <code>{code.code}</code>
          <button
            className="btn secondary small"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(code.code)
                .then(() => setMessage("Code copied."))
                .catch(() => setError("Copy failed. Write the code down."))
            }
          >
            <Copy size={15} /> Copy
          </button>
        </div>
      )}
      {data.invites.length > 0 && (
        <>
          <h3>Unused invites</h3>
          <ul className="member-list">
            {data.invites.map((i) => (
              <li key={i.id}>
                <span>Created {when(i.created_at)}</span>
                <span className="muted">Expires {when(i.expires_at)}</span>
                <button
                  className="btn secondary small"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run("revoke" + i.id, async () => {
                      await command("member_uninvite", { invite: i.id });
                      setCode(null);
                      setMessage("Invite revoked.");
                    })
                  }
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        className="btn secondary"
        disabled={Boolean(busy) || data.members.length >= 4}
        onClick={() =>
          void run("invite", async () => {
            setCode(await command("member_invite", {}));
          })
        }
      >
        <UserPlus size={17} />{" "}
        {busy === "invite" ? "Creating…" : "Create an invite code"}
      </button>
    </section>
  );
}

// Member: read-only view of the family they joined.
export function MemberFamily({ data }: { data: Snapshot }) {
  const { refresh } = useFamily();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = data.children.filter((c) => !c.archived_at);
  return (
    <div className="content-split">
      <section>
        <div className="mini-heading">
          <h2>Explorers</h2>
          <span>{active.length} active</span>
        </div>
        <ul className="member-explorers">
          {active.map((c) => (
            <li key={c.id}>
              <span aria-hidden="true">{avatar[c.avatar]}</span>
              <strong>{c.nickname}</strong>
              <span className="muted">Age {c.age}</span>
            </li>
          ))}
        </ul>
      </section>
      <aside className="panel form-panel">
        <Users className="accent" />
        <h2>You’re a family member</h2>
        <p>
          You can host and play this family’s games on your own device. The
          guardian manages explorers, permissions, consent, and SafeZone.
        </p>
        <ul className="member-list">
          {data.members.map((m) => (
            <li key={m.user_id}>
              <strong>{m.display_name}</strong>
              {m.display_name === data.household?.displayName && (
                <span className="muted">You</span>
              )}
            </li>
          ))}
        </ul>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button
          className="btn secondary small"
          disabled={busy}
          onClick={async () => {
            if (
              !window.confirm(
                "Leave this family? You'll need a new invite to rejoin.",
              )
            )
              return;
            setBusy(true);
            setError("");
            try {
              await command("member_leave", {});
              await refresh();
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut size={15} /> {busy ? "Leaving…" : "Leave this family"}
        </button>
      </aside>
    </div>
  );
}

export function GuardianOnly({ what }: { what: string }) {
  return (
    <div className="empty-state">
      <Users size={30} />
      <h3>{what} is for the family’s guardian.</h3>
      <p>
        You’re a family member, so you can host and play games. Ask the guardian
        about {what.toLowerCase()} settings.
      </p>
    </div>
  );
}
