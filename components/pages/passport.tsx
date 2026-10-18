"use client";
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
        <h2>Practice you can point to</h2>
      </div>
      <div className="children-grid">
        {data.children.map((c) => {
          const events = data.scores.filter((s) => s.child_id === c.id),
            xp = events.reduce((a, s) => a + s.points, 0);
          return (
            <article className="panel" key={c.id}>
              <h3>
                {avatar[c.avatar]} {c.nickname}
              </h3>
              <strong className="big-number">{xp} XP</strong>
              <p>
                {xp >= 1800 ? "Solver" : xp >= 600 ? "Thinker" : "Explorer"} ·{" "}
                {events.length} completed adventures
              </p>
              <div className="xp-track">
                <span style={{ width: Math.min(100, (xp % 600) / 6) + "%" }} />
              </div>
              <p className="muted">
                {600 - (xp % 600)} XP to the next milestone
              </p>
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
