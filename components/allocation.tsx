"use client";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
const resources = [
  ["solar", "☀", "Solar"],
  ["wind", "〰", "Wind"],
  ["battery", "▣", "Battery storage"],
  ["diesel", "◉", "Diesel"],
  ["grid", "⌁", "Grid repair"],
  ["efficiency", "✦", "Energy efficiency"],
] as const;
export function Allocation({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (allocation: Record<string, number>) => void;
}) {
  const [plan, setPlan] = useState<Record<string, number>>({
    solar: 0,
    wind: 0,
    battery: 0,
    diesel: 0,
    grid: 0,
    efficiency: 0,
  });
  const total = Object.values(plan).reduce((a, b) => a + b, 0);
  return (
    <form
      className="allocation"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(plan);
      }}
    >
      <div className="budget-summary">
        <span>Island budget</span>
        <strong>$100,000</strong>
        <div className="xp-track">
          <span
            style={{
              width: Math.min(total / 1000, 100) + "%",
              background: total > 100000 ? "#cf3656" : "#0b5fff",
            }}
          />
        </div>
        <p aria-live="polite">
          ${total.toLocaleString()} allocated · $
          {(100000 - total).toLocaleString()} remaining
        </p>
      </div>
      <div className="allocation-grid">
        {resources.map(([key, icon, label]) => (
          <label key={key}>
            <span>
              {icon} {label}
            </span>
            <input
              type="number"
              min={0}
              max={100000}
              step={1000}
              value={plan[key]}
              disabled={disabled}
              onChange={(e) =>
                setPlan((p) => ({ ...p, [key]: Number(e.target.value) }))
              }
              required
            />
          </label>
        ))}
      </div>
      <p className="muted">
        Consider storage, renewable supply, and efficiency. Talk about the
        tradeoffs before submitting your plan.
      </p>
      <button
        className="btn full"
        disabled={disabled || total === 0 || total > 100000}
      >
        {disabled ? "Saving your plan…" : "Submit our island plan"}{" "}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
