"use client";
import { Globe2 } from "lucide-react";
import { useEffect, useState } from "react";

type Step = {
  step: number;
  prompt: string;
  options: string[];
  yourChoice: number | null;
  available: boolean;
  needed: number;
  distribution: { option: number; percent: number }[] | null;
};
type Compare = { enabled: boolean; steps?: Step[] };

// How families across QuiZone answered the same WorldZone steps. Aggregates only;
// nothing here identifies another family or explorer.
export function GlobalCompare({ session }: { session: string }) {
  const [data, setData] = useState<Compare | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch(`/api/compare?session=${encodeURIComponent(session)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (live) setData(j);
      })
      .catch(
        (e) =>
          live && setError(e instanceof Error ? e.message : "Unavailable."),
      );
    return () => {
      live = false;
    };
  }, [session]);
  if (error)
    return (
      <p className="notice error" role="alert">
        Global Connect is unavailable: {error}
      </p>
    );
  if (!data)
    return (
      <p className="muted" role="status">
        Loading how other families answered…
      </p>
    );
  if (!data.enabled) return null;
  return (
    <section className="panel global-compare" aria-labelledby="global-title">
      <h2 id="global-title">
        <Globe2 size={20} /> How families around QuiZone answered
      </h2>
      <p className="muted">
        Totals from many families, never names. Each family counts once.
      </p>
      {(data.steps ?? []).map((s) => (
        <div className="compare-step" key={s.step}>
          <h3>{s.prompt}</h3>
          {s.available && s.distribution ? (
            <ul>
              {s.distribution.map((d) => (
                <li key={d.option}>
                  <span className="compare-label">
                    {s.options[d.option]}
                    {s.yourChoice === d.option && (
                      <strong className="compare-you"> · your pick</strong>
                    )}
                  </span>
                  <span
                    className="compare-bar"
                    role="img"
                    aria-label={`${d.percent}% of families`}
                  >
                    <span style={{ width: `${d.percent}%` }} />
                  </span>
                  <span className="compare-pct">{d.percent}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              We’ll show how other families answered once at least {s.needed}{" "}
              families have played this step.
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
