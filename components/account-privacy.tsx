"use client";
import { Download, KeyRound, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "./modal";

async function account(body: Record<string, unknown>) {
  const r = await fetch("/api/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
  return j as { message?: string; redirect?: string };
}

export function AccountPrivacy({
  householdName,
  member = false,
}: {
  householdName: string | null;
  member?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [confirming, setConfirming] = useState(false);
  async function run(
    key: string,
    body: Record<string, unknown>,
    form?: HTMLFormElement,
  ) {
    setBusy(key);
    setMessage("");
    setError("");
    try {
      const r = await account(body);
      if (r.redirect) {
        router.push(r.redirect);
        router.refresh();
        return;
      }
      setMessage(r.message || "Done.");
      form?.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section
      className="panel form-panel account-panel"
      aria-labelledby="account-title"
    >
      <h2 id="account-title">Account &amp; privacy</h2>
      <p>
        Your family’s data belongs to you. Download it, secure your sign-in, or
        delete everything.
      </p>
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {error && !confirming && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="account-actions">
        {householdName && !member && (
          <a className="btn secondary small" href="/api/account" download>
            <Download size={16} /> Download family data
          </a>
        )}
        <button
          className="btn secondary small"
          disabled={Boolean(busy)}
          onClick={() => void run("signout", { action: "signout-all" })}
        >
          <LogOut size={16} />
          {busy === "signout" ? "Signing out…" : "Sign out on every device"}
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void run(
            "password",
            {
              action: "change-password",
              current: fd.get("current"),
              next: fd.get("next"),
            },
            e.currentTarget,
          );
        }}
      >
        <h3>
          <KeyRound size={17} /> Change password
        </h3>
        <div className="form-grid">
          <label>
            Current password
            <input
              name="current"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            New password (12+ characters)
            <input
              name="next"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
        </div>
        <button className="btn secondary small" disabled={Boolean(busy)}>
          {busy === "password" ? "Saving…" : "Update password"}
        </button>
      </form>
      <div className="danger-zone">
        <h3>Delete account</h3>
        <p>
          Permanently erases your household, every explorer profile, all
          adventures, scores, stamps, reports, and your sign-in.
        </p>
        <button
          className="btn small danger"
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
        >
          <Trash2 size={16} /> Delete account
        </button>
      </div>
      {confirming && (
        <Modal onClose={() => setConfirming(false)} labelledBy="delete-title">
          <section className="modal">
            <button
              className="close"
              aria-label="Close"
              onClick={() => setConfirming(false)}
            >
              ×
            </button>
            <p className="eyebrow">PERMANENT</p>
            <h2 id="delete-title">Delete your QuiZone account?</h2>
            <p>
              Download your family data first if you want a copy. This can’t be
              undone.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run("delete", {
                  action: "delete",
                  confirm: new FormData(e.currentTarget).get("confirm"),
                });
              }}
            >
              <label>
                Type <strong>{householdName ?? "DELETE"}</strong> to confirm
                <input name="confirm" required autoComplete="off" />
              </label>
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              <button className="btn full danger" disabled={Boolean(busy)}>
                {busy === "delete" ? "Deleting…" : "Delete everything"}
              </button>
            </form>
          </section>
        </Modal>
      )}
    </section>
  );
}
