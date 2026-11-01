"use client";
import type { Challenge } from "@/lib/types";
import type { AppAction } from "@/lib/validation";
import { useCallback, useEffect, useState } from "react";

type Step = {
  id: string;
  ordinal: number;
  kind: string;
  prompt: string;
  options: string[];
  hint: string;
  correct: number | null;
  explanation: string | null;
};
type DraftView = {
  id: string;
  version: number;
  scenario: string;
  minAge: number;
  maxAge: number;
  issues: string[];
  steps: Step[];
};
type Run = (action: AppAction["action"], payload: unknown) => Promise<void>;

function stepPayload(f: FormData) {
  return {
    prompt: String(f.get("prompt") || ""),
    options: String(f.get("options") || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    correct: Number(f.get("correct")),
    hint: String(f.get("hint") || ""),
    explanation: String(f.get("explanation") || ""),
  };
}

function StepFields({ step }: { step?: Step }) {
  return (
    <>
      <label>
        Prompt
        <textarea
          name="prompt"
          required
          minLength={10}
          maxLength={500}
          defaultValue={step?.prompt}
        />
      </label>
      <label>
        Options (one per line)
        <textarea
          name="options"
          required
          defaultValue={step?.options.join("\n")}
        />
      </label>
      <label>
        Correct option number (first is 0)
        <input
          name="correct"
          type="number"
          min={0}
          max={5}
          required
          defaultValue={step?.correct ?? 0}
        />
      </label>
      <label>
        Hint
        <textarea
          name="hint"
          required
          minLength={10}
          maxLength={300}
          defaultValue={step?.hint}
        />
      </label>
      <label>
        Explanation
        <textarea
          name="explanation"
          required
          minLength={10}
          maxLength={500}
          defaultValue={step?.explanation ?? ""}
        />
      </label>
    </>
  );
}

function DraftEditor({ versionId, run }: { versionId: string; run: Run }) {
  const [view, setView] = useState<DraftView | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    const r = await fetch(`/api/cms?version=${versionId}`, {
      cache: "no-store",
    });
    const j = await r.json();
    if (!r.ok) setError(j.error || "Could not load the draft.");
    else setView(j);
  }, [versionId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  const act: Run = async (a, p) => {
    await run(a, p);
    await load();
  };
  if (error)
    return (
      <p className="notice error" role="alert">
        {error}
      </p>
    );
  if (!view) return <p role="status">Loading draft…</p>;
  return (
    <div className="cms-draft">
      <h4>Editing draft v{view.version}</h4>
      {view.issues.length > 0 ? (
        <div className="notice error" role="status">
          <strong>Fix before publishing:</strong>
          <ul>
            {view.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="notice success" role="status">
          Quality checks pass. An age review is still required to publish.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void act("cms_version_update", {
            version: view.id,
            scenario: f.get("scenario"),
            minAge: Number(f.get("minAge")),
            maxAge: Number(f.get("maxAge")),
          });
        }}
      >
        <label>
          Scenario
          <textarea
            name="scenario"
            required
            minLength={20}
            maxLength={1000}
            defaultValue={view.scenario}
          />
        </label>
        <div className="form-grid">
          <label>
            Youngest age
            <input
              name="minAge"
              type="number"
              min={8}
              max={17}
              defaultValue={view.minAge}
            />
          </label>
          <label>
            Oldest age
            <input
              name="maxAge"
              type="number"
              min={8}
              max={17}
              defaultValue={view.maxAge}
            />
          </label>
        </div>
        <button className="btn small secondary">
          Save scenario &amp; ages
        </button>
      </form>
      {view.steps.map((s) => (
        <details className="cms-step" key={s.id}>
          <summary>
            Step {s.ordinal}: {s.prompt}
          </summary>
          {s.kind !== "choice" ? (
            <p className="muted">
              This {s.kind} step is defined in code and copied as-is.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act("cms_step_update", {
                  step: s.id,
                  ...stepPayload(new FormData(e.currentTarget)),
                });
              }}
            >
              <StepFields step={s} />
              <div className="card-actions">
                <button className="btn small secondary">Save step</button>
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => void act("cms_step_delete", { step: s.id })}
                >
                  Delete step
                </button>
              </div>
            </form>
          )}
        </details>
      ))}
      <details className="cms-step">
        <summary>Add a step</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            void act("cms_step_add", {
              version: view.id,
              ...stepPayload(new FormData(form)),
            }).then(() => form.reset());
          }}
        >
          <StepFields />
          <button className="btn small secondary">Add step</button>
        </form>
      </details>
    </div>
  );
}

export function CmsVersions({
  challenge,
  busy,
  run,
}: {
  challenge: Challenge;
  busy: boolean;
  run: Run;
}) {
  const [open, setOpen] = useState("");
  const draft = challenge.versions.find(
    (v) => v.status === "draft" || v.status === "review",
  );
  const published = challenge.versions.find((v) => v.status === "published");
  return (
    <div className="cms-versions">
      <div className="card-actions">
        {!draft && (
          <button
            className="btn small secondary"
            disabled={busy}
            onClick={() =>
              void run("cms_version_new", { challenge: challenge.id })
            }
          >
            New version
          </button>
        )}
        {draft && (
          <button
            className="btn small secondary"
            onClick={() => setOpen(open ? "" : draft.id)}
            aria-expanded={open === draft.id}
          >
            {open ? "Close editor" : `Edit draft v${draft.version}`}
          </button>
        )}
        {published && (
          <button
            className="btn small secondary"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Retire this version? Families will no longer be able to start it. Past sessions keep their content.",
                )
              )
                void run("cms_version_retire", { version: published.id });
            }}
          >
            Retire v{published.version}
          </button>
        )}
      </div>
      {open && draft && <DraftEditor versionId={draft.id} run={run} />}
    </div>
  );
}
