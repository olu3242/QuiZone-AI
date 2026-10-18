"use client";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
const features = [
  ["roof", "Rain cover", 4000],
  ["access", "Step-free path", 2500],
  ["seating", "Comfortable seats", 2000],
  ["lighting", "Solar lighting", 1500],
  ["mural", "Community mural", 2000],
] as const;
export function Blueprint({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (design: Record<string, boolean>) => void;
}) {
  const [design, setDesign] = useState<Record<string, boolean>>({
    roof: false,
    access: false,
    seating: false,
    lighting: false,
    mural: false,
  });
  const total = features.reduce(
    (sum, [key, , cost]) => sum + (design[key] ? cost : 0),
    0,
  );
  return (
    <form
      className="allocation"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(design);
      }}
    >
      <div
        className="shelter-preview"
        aria-label="Your selected shelter features"
      >
        <span>{design.roof ? "☂" : "☀"}</span>
        <div>
          {design.access ? "♿" : "◌"} {design.seating ? "▰ ▰" : "▱"}{" "}
          {design.lighting ? "✦" : "◦"} {design.mural ? "▧" : ""}
        </div>
        <p>
          {Object.values(design).some(Boolean)
            ? "Your shelter is taking shape."
            : "What does your community need?"}
        </p>
      </div>
      <div className="budget-summary">
        <span>Build budget</span>
        <strong>$10,000</strong>
        <div className="xp-track">
          <span
            style={{
              width: Math.min(total / 100, 100) + "%",
              background: total > 10000 ? "#cf3656" : "#7c4dff",
            }}
          />
        </div>
        <p aria-live="polite">
          ${total.toLocaleString()} selected · $
          {(10000 - total).toLocaleString()} remaining
        </p>
      </div>
      {features.map(([key, label, cost]) => (
        <label className="design-choice" key={key}>
          <input
            type="checkbox"
            checked={design[key]}
            disabled={disabled}
            onChange={(e) =>
              setDesign((p) => ({ ...p, [key]: e.target.checked }))
            }
          />
          <strong>{label}</strong>
          <span>${cost.toLocaleString()}</span>
        </label>
      ))}
      <p className="muted">
        Choose a practical design together. Be ready to explain what you
        prioritized and what you left out.
      </p>
      <button
        className="btn full"
        disabled={disabled || total === 0 || total > 10000}
      >
        {disabled ? "Saving your design…" : "Save our shelter design"}{" "}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
