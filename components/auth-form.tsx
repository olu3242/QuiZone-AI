"use client";
import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "./brand";
export function AuthForm({
  mode,
  available,
}: {
  mode: "login" | "signup" | "forgot-password" | "reset-password";
  available: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  const title = {
    login: "Welcome back, explorer.",
    signup: "Great adventures start here.",
    "forgot-password": "Let’s get you back in.",
    "reset-password": "A fresh start.",
  }[mode];
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          email: form.get("email"),
          password: form.get("password"),
          guardian: form.get("guardian") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.redirect) {
        router.push(result.redirect);
        router.refresh();
        return;
      }
      setMessage(result.message);
      setSuccess(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not connect. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-shell">
      <div className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">PLAY TOGETHER. SOLVE THE WORLD.</span>
          <h1>
            A little curiosity.
            <br />A whole lot of
            <br />
            <span>wonder.</span>
          </h1>
          <div className="auth-friends">
            🦊 <span>✦</span> 🐼
          </div>
          <p>
            The next big idea might be sitting
            <br />
            right beside you.
          </p>
        </div>
        <p>
          <ShieldCheck size={18} /> A guardian-led space for family adventures.
        </p>
      </div>
      <div className="auth-panel">
        <Link href="/" className="back-link">
          ← Back to QuiZone
        </Link>
        <div className="auth-form">
          <p className="eyebrow">YOUR FAMILY’S NEXT CHAPTER</p>
          <h2>{title}</h2>
          <p>
            {mode === "signup"
              ? "Create your guardian account, then bring your family together."
              : mode === "login"
                ? "Your family’s next adventure is waiting."
                : "Use the email linked to your guardian account."}
          </p>
          {!available && (
            <div className="notice" role="status">
              Account services are not connected yet. Sign-up and login will be
              available after the QuiZone database is configured.
            </div>
          )}
          <form onSubmit={submit}>
            {mode !== "reset-password" && (
              <label>
                Email address
                <input
                  autoComplete="email"
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                />
              </label>
            )}
            {mode !== "forgot-password" && (
              <label>
                Password
                <input
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  type="password"
                  name="password"
                  required
                  minLength={12}
                  maxLength={128}
                  placeholder="At least 12 characters"
                />
              </label>
            )}
            {mode === "signup" && (
              <label className="checkbox">
                <input type="checkbox" name="guardian" required /> I am 18 or
                older and will supervise this household’s use of QuiZone.
              </label>
            )}
            {message && (
              <div
                role={success ? "status" : "alert"}
                className={success ? "notice success" : "notice error"}
              >
                {message}
              </div>
            )}
            <button className="btn" disabled={busy || !available}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Let’s get playing"
                  : mode === "signup"
                    ? "Create guardian account"
                    : mode === "forgot-password"
                      ? "Send reset link"
                      : "Save new password"}{" "}
              <ArrowRight size={18} />
            </button>
          </form>
          {mode === "login" ? (
            <>
              <Link href="/forgot-password">Forgot your password?</Link>
              <p>
                New to the adventure?{" "}
                <Link href="/signup">Create an account</Link>
              </p>
            </>
          ) : (
            <p>
              Already have an account? <Link href="/login">Log in</Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
