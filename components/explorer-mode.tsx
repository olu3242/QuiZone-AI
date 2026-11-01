"use client";
import { levelFor } from "@/lib/progress";
import type { Snapshot } from "@/lib/types";
import { ArrowRight, BookOpen, Compass, Lock, Unlock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { avatar, challengeFor, zoneFor } from "./family-ui";
import { Modal } from "./modal";
import { command, useFamily } from "./workspace";

// Adults hand the shared screen to explorers. The lock lives on the server, bound
// to this sign-in; only the adult's password lifts it.
export function LockCard() {
  const { refresh } = useFamily();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="explorer-lock-card">
      <Lock />
      <h3>Explorer mode</h3>
      <p>
        Handing the screen to your explorers? Lock it so only play is available.
        You’ll need your password to unlock it.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <button
        className="btn secondary small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await command("explorer_lock", {});
            await refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not lock.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Lock size={15} /> {busy ? "Locking…" : "Turn on Explorer mode"}
      </button>
    </div>
  );
}

export function UnlockButton({ className = "logout" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        <Unlock size={16} /> Grown-up unlock
      </button>
      {open && <UnlockDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function UnlockDialog({ onClose }: { onClose: () => void }) {
  const { refresh } = useFamily();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal onClose={onClose} labelledBy="unlock-title">
      <section className="modal">
        <button className="close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">FOR GROWN-UPS</p>
        <h2 id="unlock-title">Leave Explorer mode</h2>
        <p>Enter the password for the account signed in on this screen.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const password = String(
              new FormData(e.currentTarget).get("password") || "",
            );
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/explorer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });
              const j = await r.json();
              if (!r.ok) throw new Error(j.error || "Could not unlock.");
              await refresh();
              onClose();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not unlock.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button className="btn" disabled={busy}>
            {busy ? "Checking…" : "Unlock"} <Unlock size={16} />
          </button>
        </form>
      </section>
    </Modal>
  );
}

// The explorers' own dashboard while the screen is locked.
export function ExplorerHome({ data }: { data: Snapshot }) {
  const crew = data.children.filter((c) => !c.archived_at);
  const xpFor = (id: string) =>
    data.scores
      .filter((s) => s.child_id === id)
      .reduce((a, s) => a + s.points, 0);
  const open = data.sessions.filter((s) =>
    ["lobby", "ready", "active", "paused"].includes(s.state),
  );
  return (
    <>
      <div className="explorer-hero">
        <p className="eyebrow">EXPLORER MODE</p>
        <h1>Ready for an adventure?</h1>
        <p>Pick a challenge, play together, and fill your passport.</p>
        <div className="explorer-actions">
          <Link className="btn" href="/challenges">
            <Compass size={18} /> Pick an adventure
          </Link>
          <Link className="btn secondary" href="/passport">
            <BookOpen size={18} /> Our passport
          </Link>
        </div>
      </div>
      <section aria-labelledby="crew-title">
        <h2 id="crew-title" className="explorer-subtitle">
          Our crew
        </h2>
        <ul className="explorer-crew">
          {crew.map((c) => {
            const level = levelFor(xpFor(c.id));
            return (
              <li key={c.id}>
                <span className="explorer-avatar" aria-hidden="true">
                  {avatar[c.avatar]}
                </span>
                <strong>{c.nickname}</strong>
                <span>
                  Level {level.index} · {level.name}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      {open.length > 0 && (
        <section aria-labelledby="continue-title">
          <h2 id="continue-title" className="explorer-subtitle">
            Keep playing
          </h2>
          <div className="explorer-continue">
            {open.map((s) => {
              const c = challengeFor(s, data),
                z = zoneFor(c?.mode || "quick");
              return (
                <Link key={s.id} href={"/play/" + s.id} className="session-row">
                  <span aria-hidden="true">{z.icon}</span>
                  <strong>{c?.title || "Adventure"}</strong>
                  <ArrowRight size={16} />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

export function ExplorerLocked() {
  return (
    <div className="empty-state">
      <Lock size={30} />
      <h3>This part is for grown-ups.</h3>
      <p>Explorer mode is on. A grown-up can unlock it with their password.</p>
      <div className="explorer-actions">
        <Link className="btn small" href="/home">
          Back to adventures <ArrowRight size={16} />
        </Link>
        <UnlockButton className="btn secondary small" />
      </div>
    </div>
  );
}
