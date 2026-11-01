"use client";
import { levelFor } from "@/lib/progress";
import { ArrowRight, Globe2 } from "lucide-react";
import Link from "next/link";

import { avatar, Empty, Heading, NeedHousehold } from "../family-ui";
import { useFamily } from "../workspace";
export function PassportPage() {
  const { data } = useFamily();
  if (!data) return null;
  if (!data.household) return <NeedHousehold />;
  return (
    <>
      <Heading
        eyebrow="A WORLD OF LITTLE DISCOVERIES"
        title="Your family’s passport."
        description="Places explored. Ideas discovered. A story built one adventure at a time."
      />
      <section className="passport-banner">
        <Globe2 size={60} />
        <div>
          <h2>Different places. New perspectives.</h2>
          <p>
            Complete a country challenge to add a stamp to your explorer’s
            passport.
          </p>
        </div>
        <Link href="/world" className="btn white">
          Explore the world <ArrowRight size={16} />
        </Link>
      </section>
      {!data.passport.length ? (
        <Empty
          title="Your first stamp is waiting."
          description="Enable WorldZone in family preferences, then complete a country challenge together."
          href="/world"
          label="Find a global adventure"
        />
      ) : (
        <div className="children-grid">
          {data.children.map((c) => (
            <article key={c.id} className="panel">
              <h3>
                {avatar[c.avatar]} {c.nickname}
              </h3>
              <div className="stamps">
                {[
                  ...new Set(
                    data.passport
                      .filter((p) => p.child_id === c.id)
                      .map((p) => p.country),
                  ),
                ].map((country) => (
                  <div className="stamp" key={country}>
                    <Globe2 />
                    <strong>{country}</strong>
                    <small>EXPLORED TOGETHER</small>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="mini-heading">
        <h2>Family badges</h2>
      </div>
      <ul className="badge-list family" aria-label="Family badges">
        {data.badges
          .filter((b) => b.scope === "household")
          .map((b) => {
            const got = data.familyBadges.some((e) => e.badge_code === b.code);
            return (
              <li
                key={b.code}
                className={got ? "earned" : "locked"}
                title={b.description}
              >
                {got ? "★" : "☆"} {b.name}
                <span className="sr-only">
                  {got ? " (earned)" : " (not yet)"}
                </span>
              </li>
            );
          })}
      </ul>
      <div className="mini-heading">
        <h2>Practice you can point to</h2>
      </div>
      <div className="children-grid">
        {data.children.map((c) => {
          const events = data.scores.filter((s) => s.child_id === c.id),
            xp = events.reduce((a, s) => a + s.points, 0),
            lv = levelFor(xp);
          return (
            <article className="panel" key={c.id}>
              <h3>
                {avatar[c.avatar]} {c.nickname}
              </h3>
              <strong className="big-number">{xp} XP</strong>
              <p>
                Level {lv.index} · {lv.name} · {events.length} completed
                adventures
              </p>
              <div
                className="xp-track"
                role="progressbar"
                aria-label={`Progress to ${lv.next ?? "top level"}`}
                aria-valuenow={Math.round(lv.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: Math.round(lv.progress * 100) + "%" }} />
              </div>
              <p className="muted">
                {lv.next
                  ? `${lv.toNext} XP to ${lv.next}`
                  : "Top level reached"}
              </p>
              <ul className="badge-list" aria-label={`${c.nickname}'s badges`}>
                {data.badges
                  .filter((b) => b.scope === "child")
                  .map((b) => {
                    const got = data.childBadges.some(
                      (e) => e.child_id === c.id && e.badge_code === b.code,
                    );
                    return (
                      <li
                        key={b.code}
                        className={got ? "earned" : "locked"}
                        title={b.description}
                      >
                        {got ? "★" : "☆"} {b.name}
                        <span className="sr-only">
                          {got ? " (earned)" : " (not yet)"}
                        </span>
                      </li>
                    );
                  })}
              </ul>
              {[...new Set(events.map((e) => e.skill))].map((skill) => (
                <span className="skill-tag" key={skill}>
                  {skill}
                </span>
              ))}
            </article>
          );
        })}
      </div>
    </>
  );
}
