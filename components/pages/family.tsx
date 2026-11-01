"use client";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AccountPrivacy } from "../account-privacy";
import { ChildFields, childPayload, ExplorerCard } from "../explorer-card";
import { Feedback, Heading } from "../family-ui";
import { command, useFamily } from "../workspace";
export function FamilyPage() {
  const { data, refresh } = useFamily();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!data) return null;
  const active = data.children.filter((c) => !c.archived_at),
    archived = data.children.filter((c) => c.archived_at);
  async function saved(note: string) {
    await refresh();
    setMessage(note);
  }
  async function save(
    e: React.FormEvent<HTMLFormElement>,
    action: "household" | "child" | "permissions",
  ) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const form = e.currentTarget,
      fd = new FormData(form);
    const payload =
      action === "household"
        ? { name: fd.get("name"), consent: fd.get("consent") === "on" }
        : action === "child"
          ? childPayload(fd)
          : {
              world: fd.get("world") === "on",
              q: fd.get("q") === "on",
              minutes: Number(fd.get("minutes")),
            };
    try {
      await command(action, payload);
      await refresh();
      setMessage("Saved to your family’s account.");
      if (action === "child") form.reset();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="YOUR PEOPLE. YOUR PLACE."
        title={
          data.household
            ? data.household.name
            : "Let’s build your family’s space."
        }
        description="Every explorer belongs to a household guided by a grown-up."
      />
      <div className="onboarding-track">
        <span className={data.household ? "done" : "current"}>
          1 · Create household
        </span>
        <span
          className={
            data.children.length ? "done" : data.household ? "current" : ""
          }
        >
          2 · Add explorers
        </span>
        <span className={data.children.length ? "current" : ""}>
          3 · Choose permissions
        </span>
        <span>4 · Play together</span>
      </div>
      <Feedback message={message} />
      {!data.household ? (
        <section className="panel form-panel">
          <h2>A name for your crew</h2>
          <p>
            Use a family nickname. There’s no need for a surname or address.
          </p>
          <form onSubmit={(e) => void save(e, "household")}>
            <label>
              Household name
              <input
                name="name"
                required
                minLength={2}
                maxLength={50}
                placeholder="The Curious Crew"
              />
            </label>
            <label className="checkbox">
              <input name="consent" type="checkbox" required />I am the adult
              guardian and consent to storing family nicknames, age in years,
              preferences, and gameplay activity. I will supervise play. I
              understand there is no child messaging.
            </label>
            <button disabled={busy} className="btn">
              {busy ? "Saving…" : "Create household"} <ArrowRight size={17} />
            </button>
          </form>
        </section>
      ) : (
        <div className="content-split">
          <section>
            <div className="mini-heading">
              <h2>Your explorers</h2>
              <span>{data.children.length} / 8 profiles</span>
            </div>
            <div className="children-grid">
              {active.map((c) => (
                <ExplorerCard key={c.id} child={c} onSaved={saved} />
              ))}
            </div>
            {archived.length > 0 && (
              <details className="archived-explorers">
                <summary>Archived explorers ({archived.length})</summary>
                <p>
                  Archived profiles keep their history but can’t join new
                  adventures. They still count toward the eight-profile limit.
                </p>
                <div className="children-grid">
                  {archived.map((c) => (
                    <ExplorerCard key={c.id} child={c} onSaved={saved} />
                  ))}
                </div>
              </details>
            )}
            <section className="panel form-panel">
              <h2>
                <Plus size={22} /> Add an explorer
              </h2>
              <p>
                Nicknames only. Don’t include a school, address, or contact
                details. The current pilot supports ages 8–17 with a guardian.
              </p>
              <form onSubmit={(e) => void save(e, "child")}>
                <ChildFields />
                <button
                  className="btn"
                  disabled={busy || data.children.length >= 8}
                >
                  Add to the crew <Plus size={17} />
                </button>
              </form>
            </section>
          </section>
          <aside className="panel form-panel">
            <ShieldCheck className="accent" />
            <h2>Your family’s boundaries</h2>
            <p>
              These choices are checked when a game starts. You can change them
              here.
            </p>
            <form
              onSubmit={(e) => void save(e, "permissions")}
              key={JSON.stringify(data.permissions)}
            >
              <label className="checkbox">
                <input
                  name="world"
                  type="checkbox"
                  defaultChecked={data.permissions?.world}
                />
                Enable WorldZone’s guided country challenges
              </label>
              <label className="checkbox">
                <input
                  name="q"
                  type="checkbox"
                  defaultChecked={data.permissions?.q}
                />
                Allow Q’s reviewed, prewritten hints
              </label>
              <label>
                Game session limit (minutes)
                <input
                  type="number"
                  name="minutes"
                  min={5}
                  max={120}
                  defaultValue={data.permissions?.minutes || 30}
                />
              </label>
              <button className="btn secondary full" disabled={busy}>
                Save family preferences
              </button>
            </form>
            <div className="quiet-note">
              <ShieldCheck size={18} />
              <p>
                No open chat. No child account independent of your household.
                Play happens together on a shared screen.
              </p>
            </div>
          </aside>
        </div>
      )}
      <AccountPrivacy householdName={data.household?.name ?? null} />
    </>
  );
}
