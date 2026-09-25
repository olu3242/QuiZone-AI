# AGENTS.md

Operating instructions for any AI coding agent working in this repository —
not specific to one tool. If you're Claude Code, `CLAUDE.md` has more detail
on this codebase specifically; read both.

## Source of truth, in priority order

1. **`FAMILY.md`** — non-negotiable child/family safety rules. Overrides
   everything else here if they ever conflict.
2. **`PRD.md`** — what QuiZone is, what's in scope for the current wave, and
   what "done" means for a feature.
3. **`CLAUDE.md`** — codebase-specific conventions for this repo.
4. This file — general process rules that apply regardless of which of the
   above a task touches.

## Ground rules

- **Don't build ahead of what's real.** This repo is the landing page + a
  starter kit (see `PRD.md` §20 for exactly what's included). Don't add UI
  that implies a backend feature exists if it doesn't yet.
- **Don't fake success.** No mock persistence, no hardcoded data presented as
  live, no success state for an action that didn't actually happen.
- **Verify before claiming.** Run the actual build/lint/typecheck/test
  commands and report what they actually returned — don't report a pass you
  didn't observe.
- **Public vs. internal stays separated.** Anything shipped to
  `app/page.tsx` (or any other visitor-facing surface) is consumer marketing
  only — no architecture, scoring logic, moderation internals, or roadmap
  detail. That detail belongs in `PRD.md`, `FAMILY.md`, or `CLAUDE.md`, which
  are internal documents and can be as complete as they need to be.
- **Safety-sensitive work gets `FAMILY.md`'s checklist**, every time — not
  just when a task obviously mentions children or safety by name.
- **Flag blockers honestly.** If something is genuinely blocked by a missing
  external dependency (an API key, a design decision, a legal review), say so
  explicitly rather than substituting a mock and calling it complete.

## Working style

- Prefer small, verifiable changes over large speculative ones.
- Keep content in `lib/content.ts` data-driven rather than hardcoded in
  components — this repo already follows that pattern; extend it, don't
  break it.
- When a requirement in an issue or prompt conflicts with `FAMILY.md`, stop
  and raise the conflict rather than quietly picking a side.
