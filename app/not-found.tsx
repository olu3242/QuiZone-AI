import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="narrow">
      <p className="eyebrow">OFF THE MAP</p>
      <h1>This adventure isn’t here.</h1>
      <p>Let’s find your way back.</p>
      <Link className="btn" href="/">
        Back to QuiZone
      </Link>
    </main>
  );
}
