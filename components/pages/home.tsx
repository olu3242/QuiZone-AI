"use client";
import {
  ArrowRight,
  Compass,
  Globe2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import {
  avatar,
  ChallengeCard,
  challengeFor,
  Heading,
  NeedHousehold,
  zoneFor,
} from "../family-ui";
import { useFamily } from "../workspace";
export function HomePage() {
  const { data } = useFamily();
  if (!data) return null;
  if (!data.household)
    return (
      <>
        <Heading
          eyebrow="A NEW CHAPTER"
          title="Welcome to your family’s next adventure."
          description="Let’s make a little space for curiosity."
        />
        <NeedHousehold />
      </>
    );
  const completed = data.sessions.filter((s) => s.state === "complete");
  const xp = data.scores.reduce((a, s) => a + s.points, 0);
  return (
    <>
      <Heading
        eyebrow="GOOD IDEAS GROW TOGETHER"
        title={`Hello, ${data.household.name} 👋`}
        description="A new discovery is always better with your people."
      >
        <Link className="btn small" href="/challenges">
          Find an adventure <ArrowRight size={17} />
        </Link>
      </Heading>
      <section className="home-banner">
        <div>
          <span className="pill">YOUR NEXT FAMILY NIGHT</span>
          <h2>
            What will you
            <br />
            figure out together?
          </h2>
          <p>
            A quick warm-up. A big “what if.”
            <br />A little time that means a lot.
          </p>
          <Link className="btn white" href="/challenges">
            Let’s explore <ArrowRight size={18} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <span className="banner-star">✦</span>
          <span className="banner-globe">🌍</span>
          <span className="banner-fox">🦊</span>
          <span className="banner-bubble">We’ve got an idea!</span>
        </div>
      </section>
      <div className="stats-row">
        <div>
          <span className="stat-icon yellow">
            <Compass />
          </span>
          <div>
            <strong>{completed.length}</strong>
            <span>Adventures completed</span>
          </div>
        </div>
        <div>
          <span className="stat-icon purple">
            <Sparkles />
          </span>
          <div>
            <strong>{xp.toLocaleString()}</strong>
            <span>Family XP earned</span>
          </div>
        </div>
        <div>
          <span className="stat-icon mint">
            <Globe2 />
          </span>
          <div>
            <strong>{new Set(data.passport.map((x) => x.country)).size}</strong>
            <span>Places explored</span>
          </div>
        </div>
      </div>
      <div className="content-split">
        <section>
          <div className="mini-heading">
            <h2>Pick your next adventure</h2>
            <Link href="/challenges">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="challenge-grid compact">
            {data.challenges
              .filter((c) => c.versions.some((v) => v.status === "published"))
              .slice(0, 2)
              .map((c) => (
                <ChallengeCard key={c.id} challenge={c} />
              ))}
          </div>
          <div className="mini-heading">
            <h2>Keep the adventure going</h2>
          </div>
          {data.sessions.filter(
            (s) =>
              !["complete", "cancelled", "expired"].includes(s.state) &&
              new Date(s.expires_at) > new Date(),
          ).length === 0 ? (
            <div className="simple-empty">
              No adventures in progress. Pick a challenge and make a start.
            </div>
          ) : (
            data.sessions
              .filter(
                (s) =>
                  !["complete", "cancelled", "expired"].includes(s.state) &&
                  new Date(s.expires_at) > new Date(),
              )
              .map((s) => (
                <Link className="session-row" href={"/play/" + s.id} key={s.id}>
                  <span className="round-icon">
                    {zoneFor(challengeFor(s, data)?.mode || "quick").icon}
                  </span>
                  <div>
                    <strong>
                      {challengeFor(s, data)?.title || "Family adventure"}
                    </strong>
                    <small>
                      {s.state} · {s.code}
                    </small>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              ))
          )}
        </section>
        <aside>
          <div className="panel family-mini">
            <h3>Your adventure crew</h3>
            {data.children.length ? (
              data.children.map((c) => (
                <div className="crew-row" key={c.id}>
                  <span>{avatar[c.avatar]}</span>
                  <div>
                    <strong>{c.nickname}</strong>
                    <small>
                      {data.scores
                        .filter((s) => s.child_id === c.id)
                        .reduce((a, s) => a + s.points, 0)}{" "}
                      XP · Family explorer
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <p>Add your first explorer to get started.</p>
            )}
            <Link href="/family" className="text-link">
              Manage family <ArrowRight size={15} />
            </Link>
          </div>
          <div className="parent-nudge">
            <ShieldCheck />
            <h3>A little insight for grown-ups</h3>
            <p>
              See what your family practiced, and find a question for your next
              conversation.
            </p>
            <Link href="/parent">
              Open Parent Hub <ArrowRight size={15} />
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
