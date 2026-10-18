"use client";
import { zones } from "@/lib/content";
import type { Challenge, Session, Snapshot } from "@/lib/types";
import { ArrowRight, Clock3, Sparkles } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

export const avatar: Record<string, string> = {
  fox: "🦊",
  panda: "🐼",
  owl: "🦉",
  rocket: "🚀",
};
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

export function Empty({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <Sparkles size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link className="btn small" href={href}>
          {label} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

export function NeedHousehold() {
  return (
    <Empty
      title="Let’s bring your family together."
      description="Create your household and add a nickname before starting an adventure."
      href="/family"
      label="Set up your family"
    />
  );
}

export function zoneFor(mode: string) {
  return zones.find((z) => z.mode === mode) || zones[0];
}

export function challengeFor(s: Session, data: Snapshot) {
  return data.challenges.find((c) =>
    c.versions.some((v) => v.id === s.challenge_version_id),
  );
}

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const z = zoneFor(challenge.mode);
  return (
    <Link
      className={"challenge-card mode-" + z.mode}
      href={"/challenges?challenge=" + challenge.id}
    >
      <div className="challenge-art">
        <span>{z.icon}</span>
        <small>{z.name}</small>
        <i>✦</i>
      </div>
      <div className="challenge-copy">
        <p className="eyebrow">{z.tag}</p>
        <h3>{challenge.title}</h3>
        <p>{challenge.description}</p>
        <div>
          <span>
            <Clock3 size={14} /> {challenge.minutes} min
          </span>
          <span>
            Explore together <ArrowRight size={15} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function Feedback({ message }: { message: string }) {
  return message ? (
    <p className="notice" role="status">
      {message}
    </p>
  ) : null;
}
