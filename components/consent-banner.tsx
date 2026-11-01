"use client";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { command, useFamily } from "./workspace";

// Shown on every page while the household's consent is behind the current version.
export function ConsentBanner() {
  const { data, refresh } = useFamily();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const c = data?.consent;
  if (!c?.pending || !c.text) return null;
  return (
    <section
      className="consent-banner"
      role="region"
      aria-labelledby="consent-banner-title"
    >
      <h2 id="consent-banner-title">
        <ShieldCheck size={20} /> Updated family consent (version {c.current})
      </h2>
      <p>
        {c.text.summary}. New adventures and town halls are paused until you
        review and accept it.
      </p>
      <details>
        <summary>Read the full consent</summary>
        <p>{c.text.body}</p>
      </details>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <button
        className="btn small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await command("consent_accept", { version: c.current });
            await refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "I have read and accept this consent"}
      </button>
    </section>
  );
}
