"use client";
import { levelFor } from "@/lib/progress";
import type { Snapshot } from "@/lib/types";
import { avatar, zoneFor } from "./family-ui";

// Per-explorer progress, computed only from rows the server recorded.
export function ProgressPanel({ data }: { data: Snapshot }) {
  const modeOf = (sessionId: string) => {
    const s = data.sessions.find((x) => x.id === sessionId);
    const c =
      s &&
      data.challenges.find((ch) =>
        ch.versions.some((v) => v.id === s.challenge_version_id),
      );
    return c?.mode;
  };
  const explorers = data.children.filter((c) => !c.archived_at);
  if (!explorers.length) return null;
  return (
    <>
      <div className="mini-heading">
        <h2>Progress by explorer</h2>
      </div>
      <div className="progress-grid">
        {explorers.map((c) => {
          const events = data.scores.filter((s) => s.child_id === c.id);
          const lv = levelFor(events.reduce((a, s) => a + s.points, 0));
          const skills = Object.entries(
            events.reduce<Record<string, number>>(
              (m, e) => ({ ...m, [e.skill]: (m[e.skill] ?? 0) + e.points }),
              {},
            ),
          ).sort((a, b) => b[1] - a[1]);
          const top = skills[0]?.[1] ?? 1;
          const zonesPlayed = [
            ...new Set(events.map((e) => modeOf(e.session_id)).filter(Boolean)),
          ] as string[];
          const badges = data.childBadges.filter((b) => b.child_id === c.id);
          const latest = [...badges].sort((a, b) =>
            b.awarded_at.localeCompare(a.awarded_at),
          )[0];
          const latestName =
            latest &&
            data.badges.find((b) => b.code === latest.badge_code)?.name;
          return (
            <article className="panel progress-card" key={c.id}>
              <h3>
                <span aria-hidden="true">{avatar[c.avatar]}</span> {c.nickname}
              </h3>
              <p>
                <strong>
                  Level {lv.index} · {lv.name}
                </strong>{" "}
                · {lv.xp} XP · {events.length} recorded adventures
              </p>
              <p className="muted">
                Zones played:{" "}
                {zonesPlayed.length
                  ? zonesPlayed.map((m) => zoneFor(m).name).join(", ")
                  : "none yet"}
              </p>
              {skills.length > 0 && (
                <ul
                  className="skill-bars"
                  aria-label={`${c.nickname}'s practiced skills`}
                >
                  {skills.map(([skill, pts]) => (
                    <li key={skill}>
                      <span>{skill}</span>
                      <span className="bar" aria-hidden="true">
                        <span
                          style={{
                            width:
                              Math.max(6, Math.round((pts / top) * 100)) + "%",
                          }}
                        />
                      </span>
                      <span>{pts} XP</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="muted">
                Badges: {badges.length} of{" "}
                {data.badges.filter((b) => b.scope === "child").length}
                {latestName ? ` · latest: ${latestName}` : ""}
              </p>
            </article>
          );
        })}
      </div>
      <p className="muted progress-note">
        Progress reflects completed adventures your family recorded. It is not a
        measure of ability.
      </p>
    </>
  );
}
