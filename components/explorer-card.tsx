"use client";
import type { Child } from "@/lib/types";
import { Archive, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { avatar } from "./family-ui";
import { Modal } from "./modal";
import { command } from "./workspace";

// Shared by the add and edit forms so validation hints never drift apart.
export function ChildFields({ child }: { child?: Child }) {
  return (
    <div className="form-grid">
      <label>
        Nickname
        <input
          name="nickname"
          required
          minLength={2}
          maxLength={24}
          title="Letters, numbers, spaces, or dashes only."
          placeholder="Cosmic Fox"
          defaultValue={child?.nickname}
        />
      </label>
      <label>
        Age in years
        <input
          name="age"
          type="number"
          required
          min={8}
          max={17}
          defaultValue={child?.age ?? 10}
        />
      </label>
      <label>
        Avatar
        <select name="avatar" defaultValue={child?.avatar}>
          <option value="fox">🦊 Fox</option>
          <option value="panda">🐼 Panda</option>
          <option value="owl">🦉 Owl</option>
          <option value="rocket">🚀 Rocket</option>
        </select>
      </label>
      <label>
        Favorite kind of discovery
        <select name="interest" defaultValue={child?.interest}>
          <option value="science">Science</option>
          <option value="nature">Nature</option>
          <option value="creativity">Creativity</option>
          <option value="world">The world</option>
        </select>
      </label>
    </div>
  );
}

export function childPayload(fd: FormData) {
  return {
    nickname: String(fd.get("nickname") || ""),
    age: Number(fd.get("age")),
    avatar: fd.get("avatar"),
    interest: fd.get("interest"),
  };
}

type Dialog = "" | "edit" | "delete";
export function ExplorerCard({
  child,
  onSaved,
}: {
  child: Child;
  onSaved: (message: string) => Promise<void>;
}) {
  const [dialog, setDialog] = useState<Dialog>(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const archived = Boolean(child.archived_at);
  async function run(
    action: "child_update" | "child_archive" | "child_delete",
    data: Record<string, unknown>,
    done: string,
  ) {
    setBusy(true);
    setError("");
    try {
      await command(action, { child: child.id, ...data });
      setDialog("");
      await onSaved(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  const titleId = `explorer-${child.id}`;
  return (
    <article className={"panel child-card" + (archived ? " archived" : "")}>
      <span aria-hidden="true">{avatar[child.avatar]}</span>
      <h3>{child.nickname}</h3>
      <p>
        Age {child.age} · {child.interest}
      </p>
      <span className="pill">{archived ? "Archived" : "Family profile"}</span>
      {error && !dialog && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="card-actions">
        {archived ? (
          <>
            <button
              className="btn small secondary"
              disabled={busy}
              onClick={() =>
                void run(
                  "child_archive",
                  { archived: false },
                  `${child.nickname} is back in the crew.`,
                )
              }
            >
              <RotateCcw size={15} /> Restore
            </button>
            <button
              className="btn small danger"
              disabled={busy}
              onClick={() => setDialog("delete")}
            >
              <Trash2 size={15} /> Delete
            </button>
          </>
        ) : (
          <>
            <button
              className="btn small secondary"
              disabled={busy}
              onClick={() => setDialog("edit")}
              aria-label={`Edit ${child.nickname}`}
            >
              <Pencil size={15} /> Edit
            </button>
            <button
              className="btn small secondary"
              disabled={busy}
              aria-label={`Archive ${child.nickname}`}
              onClick={() =>
                void run(
                  "child_archive",
                  { archived: true },
                  `${child.nickname} was archived. Their history is kept.`,
                )
              }
            >
              <Archive size={15} /> Archive
            </button>
          </>
        )}
      </div>
      {dialog && (
        <Modal onClose={() => setDialog("")} labelledBy={titleId}>
          <section className="modal">
            <button
              className="close"
              aria-label="Close"
              onClick={() => setDialog("")}
            >
              ×
            </button>
            {dialog === "edit" ? (
              <>
                <p className="eyebrow">UPDATE PROFILE</p>
                <h2 id={titleId}>Edit {child.nickname}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      "child_update",
                      childPayload(new FormData(e.currentTarget)),
                      "Profile updated.",
                    );
                  }}
                >
                  <ChildFields child={child} />
                  {error && (
                    <p className="notice error" role="alert">
                      {error}
                    </p>
                  )}
                  <button className="btn full" disabled={busy}>
                    {busy ? "Saving…" : "Save changes"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="eyebrow">PERMANENT</p>
                <h2 id={titleId}>Delete {child.nickname}?</h2>
                <p>
                  This permanently removes the profile, adventures they played
                  alone, their points, and passport stamps. Shared adventures
                  stay for the rest of the crew. This can’t be undone.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      "child_delete",
                      {
                        confirm: String(
                          new FormData(e.currentTarget).get("confirm") || "",
                        ),
                      },
                      `${child.nickname}’s profile and activity were deleted.`,
                    );
                  }}
                >
                  <label>
                    Type <strong>{child.nickname}</strong> to confirm
                    <input name="confirm" required autoComplete="off" />
                  </label>
                  {error && (
                    <p className="notice error" role="alert">
                      {error}
                    </p>
                  )}
                  <button className="btn full danger" disabled={busy}>
                    {busy ? "Deleting…" : "Delete permanently"}
                  </button>
                </form>
              </>
            )}
          </section>
        </Modal>
      )}
    </article>
  );
}
