"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="narrow">
      <h1>Let’s try that again.</h1>
      <p>
        We couldn’t load this page. Your saved progress is still in your
        account.
      </p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
      <Link href="/">Return home</Link>
    </main>
  );
}
