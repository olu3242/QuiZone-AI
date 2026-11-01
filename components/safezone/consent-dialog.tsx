"use client";
import { safezone } from "@/lib/content";
import type { Child, Hall } from "@/lib/types";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { avatar } from "../family-ui";
import { Modal } from "../modal";
import { consent } from "./api";

export function ConsentDialog({
  hall,
  explorers,
  onClose,
  onDone,
}: {
  hall: Hall;
  explorers: { child: Child; reason: string | null }[];
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const firstEligible = explorers.find((e) => !e.reason)?.child.id ?? "";
  const [child, setChild] = useState(firstEligible),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await consent("sz_register", String(fd.get("password")), {
        hall: hall.id,
        child,
        consent: fd.get("consent") === "on",
      });
      await onDone(
        `Registered as ${r.handle}. Only this session name is shown to others.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register.");
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} labelledBy="consent-title">
      <section className="modal">
        <button className="close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">GUARDIAN APPROVAL</p>
        <h2 id="consent-title">{hall.title}</h2>
        <p>
          Ages {hall.minAge}–{hall.maxAge} · {hall.duration} minutes ·{" "}
          {hall.capacity - hall.registered} seats left
        </p>
        <form onSubmit={submit}>
          <fieldset className="sz-choose">
            <legend>Who is joining?</legend>
            {explorers.map(({ child: c, reason }) => (
              <label className="player-choice" key={c.id}>
                <input
                  type="radio"
                  name="child"
                  value={c.id}
                  checked={child === c.id}
                  disabled={Boolean(reason)}
                  onChange={() => setChild(c.id)}
                />
                <span aria-hidden="true">{avatar[c.avatar]}</span>
                <strong>{c.nickname}</strong>
                {reason && <small className="muted">{reason}</small>}
              </label>
            ))}
          </fieldset>
          <label className="checkbox">
            <input name="consent" type="checkbox" required />
            {safezone.consent}
          </label>
          <label>
            Guardian password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
            <small className="muted">
              Confirms it’s really you, not an explorer at a signed-in screen.
            </small>
          </label>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button className="btn full" disabled={busy || !child}>
            <ShieldCheck size={17} />{" "}
            {busy ? "Saving consent…" : "Approve and register"}
          </button>
        </form>
      </section>
    </Modal>
  );
}
