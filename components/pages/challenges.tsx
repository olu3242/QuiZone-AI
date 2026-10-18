"use client";
import { zones } from "@/lib/content";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "../modal";

import {
  avatar,
  ChallengeCard,
  Empty,
  Heading,
  NeedHousehold,
} from "../family-ui";
import { command, useFamily } from "../workspace";
export function ChallengesPage({
  initialSelected = "",
}: {
  initialSelected?: string;
}) {
  const router = useRouter();
  const { data, refresh } = useFamily();
  const [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState(initialSelected),
    [players, setPlayers] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!data) return null;
  const eligible = data.challenges.filter((c) =>
    c.versions.some((v) => v.status === "published"),
  );
  const selectedChallenge = eligible.find((c) => c.id === selected);
  async function launch() {
    setBusy(true);
    setError("");
    try {
      const result = await command("create", {
        challenge: selected,
        children: players,
      });
      await refresh();
      router.push("/play/" + result.session);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create the adventure.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="FOLLOW YOUR CURIOSITY"
        title="An adventure for every kind of mind."
        description="Choose your Zone. Gather your crew. See where a little curiosity takes you."
      />
      <div className="filters" role="group" aria-label="Filter game modes">
        <button
          onClick={() => setFilter("all")}
          className={filter === "all" ? "active" : ""}
        >
          All adventures
        </button>
        {zones.map((z) => (
          <button
            key={z.mode}
            onClick={() => setFilter(z.mode)}
            className={filter === z.mode ? "active" : ""}
          >
            {z.icon} {z.name}
          </button>
        ))}
      </div>
      <div className="challenge-grid">
        {eligible
          .filter((c) => filter === "all" || c.mode === filter)
          .map((c) => (
            <div key={c.id}>
              <ChallengeCard challenge={c} />
              <button
                className="btn secondary full"
                onClick={() => {
                  setSelected(c.id);
                  setPlayers(data.children.map((c) => c.id));
                  setError("");
                }}
              >
                Choose this adventure <ArrowRight size={16} />
              </button>
            </div>
          ))}
      </div>
      {!eligible.length && (
        <Empty
          title="Fresh adventures are on their way."
          description="No reviewed challenges have been published yet."
        />
      )}
      {selectedChallenge && (
        <Modal onClose={() => setSelected("")}>
          <section className="modal">
            <button
              className="close"
              aria-label="Close adventure setup"
              onClick={() => setSelected("")}
            >
              ×
            </button>
            <p className="eyebrow">GATHER YOUR CREW</p>
            <h2 id="launch-title">{selectedChallenge.title}</h2>
            <p>
              This is a guardian-led adventure on one shared screen. Pick who’s
              joining.
            </p>
            {!data.household ? (
              <NeedHousehold />
            ) : !data.children.length ? (
              <Empty
                title="Add your first explorer."
                description="Create a family profile before playing."
                href="/family"
                label="Add an explorer"
              />
            ) : (
              <>
                {data.children.map((c) => (
                  <label className="player-choice" key={c.id}>
                    <input
                      type="checkbox"
                      checked={players.includes(c.id)}
                      onChange={(e) =>
                        setPlayers((p) =>
                          e.target.checked
                            ? [...p, c.id]
                            : p.filter((id) => id !== c.id),
                        )
                      }
                    />
                    <span>{avatar[c.avatar]}</span>
                    <strong>{c.nickname}</strong>
                  </label>
                ))}
                <p className="muted">
                  Your family’s session limit: {data.permissions?.minutes}{" "}
                  minutes.
                </p>
                {error && (
                  <p className="notice error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="btn full"
                  onClick={launch}
                  disabled={busy || !players.length}
                >
                  {busy ? "Creating your lobby…" : "Create game night"}{" "}
                  <ArrowRight size={18} />
                </button>
              </>
            )}
          </section>
        </Modal>
      )}
    </>
  );
}
