# QuiZone — Landing Page Starter Kit

**Play Together. Solve the World.**

QuiZone is a family learning and global problem-solving platform. This repo
is the **public landing page and a starter kit for the real build** — not the
product itself. See `PRD.md` §20 for an explicit list of what's included here
versus what's still ahead.

## What's in this repo

- A real, working Next.js landing page (`/`) — nav, hero, the five Zones, How
  It Works, Benefits, a Safety section, an FAQ, a final CTA, and a footer.
- Honest placeholder routes at `/login` and `/signup` (no dead links; they
  say plainly that auth isn't wired up yet).
- The QuiZone brand/design token system (`/brand`), wired directly into
  Tailwind — not re-derived by hand.
- Four docs for whoever (human or AI agent) picks up development next:
  `CLAUDE.md`, `AGENTS.md`, `FAMILY.md`, and the complete `PRD.md`.

**What's deliberately not here:** authentication, a database, the challenge
engine, game runtime, scoring, Q, Passport, Parent Hub, Admin, or moderation.
Those are Waves 2–15 in `PRD.md` §19.

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

```bash
npm run build       # production build
npm run lint         # eslint .
npm run typecheck   # tsc --noEmit
```

All three pass clean as shipped. No environment variables are required to run
this repo — `.env.example` documents what later waves (auth, database, Q)
will eventually need.

## Project structure

```
app/                  Next.js App Router pages
  layout.tsx           Root layout — fonts, metadata
  page.tsx              The landing page itself (composes components/)
  icon.svg               Favicon (the QuiZone mark)
  login/, signup/        Placeholder routes
components/           Landing page sections and UI primitives
lib/content.ts          All landing page copy, as data
brand/                 Design tokens (brand-tokens.json, theme.css) —
                          the actual source handed off for this build
public/                  Static assets, including the full logo lockup
```

## The other docs

| File | For |
|---|---|
| `PRD.md` | The complete product requirements — vision, personas, every mode, data model, safety, rollout plan. Start here for "what is QuiZone." |
| `FAMILY.md` | The non-negotiable child/family safety charter. Read before touching anything involving child data or interaction. |
| `CLAUDE.md` | Codebase conventions and non-negotiables for continuing this build in Claude Code. |
| `AGENTS.md` | The same, tool-agnostic — for any other AI coding agent working in this repo. |

## One rule that spans every product this account builds

The public landing page is consumer marketing only. It never carries
architecture, scoring/moderation logic, or roadmap detail — that stays in
`PRD.md`, `FAMILY.md`, and `CLAUDE.md`. See those files for the reasoning.

## Next step

Wave 2 (Auth) per `PRD.md` §19 — real guardian sign-up, session handling, and
password recovery, backed by Supabase.
