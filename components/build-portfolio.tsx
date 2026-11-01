"use client";
import { Hammer } from "lucide-react";
import { portfolioCopy } from "@/lib/content";
import type { Snapshot } from "@/lib/types";
import { challengeFor } from "./family-ui";

const parts = ["roof", "access", "seating", "lighting", "mural"] as const;

// BuildZone portfolio: the designs the family actually saved (server-recorded).
export function BuildPortfolio({ data }: { data: Snapshot }) {
  const designs = data.builds
    .map((b) => ({
      ...b,
      session: data.sessions.find((s) => s.id === b.session_id),
    }))
    .filter((b) => b.session)
    .sort((a, b) =>
      String(b.session!.created_at).localeCompare(
        String(a.session!.created_at),
      ),
    );
  return (
    <section aria-labelledby="portfolio-title">
      <div className="mini-heading">
        <h2 id="portfolio-title">
          <Hammer size={20} /> {portfolioCopy.title}
        </h2>
        <span>{designs.length} saved</span>
      </div>
      {designs.length === 0 ? (
        <div className="simple-empty">{portfolioCopy.empty}</div>
      ) : (
        <ul className="portfolio-grid">
          {designs.map((d) => (
            <li key={d.session_id} className="panel">
              <strong>
                {challengeFor(d.session!, data)?.title ?? "BuildZone design"}
              </strong>
              <small>
                {new Date(d.session!.created_at).toLocaleDateString()}
                {d.session!.practice ? " · practice" : ""}
              </small>
              <p className="portfolio-cost">
                ${d.total_cost.toLocaleString()} of $10,000
              </p>
              <ul className="portfolio-parts" aria-label="Design choices">
                {parts.map((p) => (
                  <li key={p} className={d[p] ? "chosen" : "skipped"}>
                    {d[p] ? "✓" : "–"} {portfolioCopy.parts[p]}
                    <span className="sr-only">
                      {d[p] ? " (included)" : " (left out)"}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
