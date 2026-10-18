"use client";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ChallengeCard, Heading } from "../family-ui";
import { useFamily } from "../workspace";
export function WorldPage() {
  const { data } = useFamily();
  if (!data) return null;
  return (
    <>
      <Heading
        eyebrow="BIG WORLD. BRIGHT IDEAS."
        title="A new perspective is an adventure."
        description="Explore real places through guided family challenges."
      />
      <section className="world-banner">
        <span>◎</span>
        <div>
          <p className="eyebrow">OUR SHARED PLANET</p>
          <h2>
            What can we learn
            <br />
            from somewhere new?
          </h2>
          <p>A different place can spark a whole new way of thinking.</p>
        </div>
      </section>
      {!data.permissions?.world && (
        <div className="notice">
          <ShieldCheck size={18} /> WorldZone needs a guardian’s permission.{" "}
          <Link href="/family">Open family preferences →</Link>
        </div>
      )}
      <div className="challenge-grid">
        {data.challenges
          .filter(
            (c) =>
              c.mode === "world" &&
              c.versions.some((v) => v.status === "published"),
          )
          .map((c) => (
            <ChallengeCard challenge={c} key={c.id} />
          ))}
      </div>
      <div className="quiet-note">
        <ShieldCheck size={20} />
        <p>
          These are guided country activities. Your child’s profile and answers
          stay within your household. Cross-family submissions and messaging are
          not available in this pilot.
        </p>
      </div>
    </>
  );
}
