# CLAUDE.md

Instructions for Claude (via Claude Code or any agentic coding session)
working in this repository.

## What this repo is right now

This is the **QuiZone public landing page + starter kit** — not the product.
It ships one real page (`/`), two honest placeholder routes (`/login`,
`/signup`), the full brand/design token system, and the four docs in this
root (`README.md`, `AGENTS.md`, `FAMILY.md`, `PRD.md`). There is no auth, no
database, no game engine here yet. Don't infer that any of that exists because
the PRD describes it — check the actual code.

Read `PRD.md` for the full product scope and the wave-by-wave rollout plan,
and `FAMILY.md` before touching anything involving child data, child-to-child
interaction, or AI-generated content shown to a child — it outranks this file
and the PRD when they conflict.

## Tech stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS 3 · React 18.
Later waves add Supabase (Postgres/Auth/Realtime/Storage) and Vercel — see
`.env.example` for the variables that will matter then. Nothing here needs
any environment variable to run.

```
npm install
npm run dev         # local dev server
npm run build        # production build
npm run lint          # eslint .
npm run typecheck   # tsc --noEmit
```

All three of `build`, `lint`, and `typecheck` pass clean as of this commit.
Keep it that way — don't add a file that breaks any of them without fixing it
in the same change.

## Conventions already in place

- **Content is data.** Copy for the zones, steps, benefits, safety points,
  FAQ, and nav lives in `lib/content.ts`, not hardcoded in JSX. Add to that
  file, don't inline new copy in a component. This mirrors the "challenges
  must be data-driven" principle the full product will follow later.
- **Components are small and single-purpose** (`components/*.tsx`), composed
  in `app/page.tsx`. Don't grow one component to cover two sections.
- **Brand tokens are the source of truth.** `tailwind.config.ts` reads
  `brand/brand-tokens.json` directly — if a token changes, change it there,
  not by hand-editing hex codes into the Tailwind config or a component.
- **Fonts load via `<link>` in `app/layout.tsx`**, not `next/font/google`.
  This was a deliberate choice (see the comment in that file) so the build
  doesn't require network access to fonts.googleapis.com — keep it this way
  unless you've confirmed the build environment can reach Google Fonts.
- **No dead links.** Every nav/footer link either points to a real in-page
  section or a real route. If you add a nav item, build what it points to
  first, or don't add it yet.

## Non-negotiables once real backend work starts (Wave 2+)

- Session/game state is **authoritative server-side**. Never trust a
  client-submitted score.
- **RLS on every table holding user data**, plus independent server-side
  authorization — RLS is a backstop, not the only check.
- **No service-role or other privileged credentials in client code**, ever.
- No fake persistence: no success toast standing in for a real database
  write, no hardcoded numbers presented as if they were live data.
- Every important surface needs its loading/empty/populated/error/disabled/
  permission-denied states — not just the happy path.
- A feature isn't "done" without: UI + validation + domain logic +
  server/backend + persistence + authorization + RLS + the UX states above +
  at least a basic automated test. Partial credit isn't done.

## The public/internal line

This account maintains one rule across every product it builds, and QuiZone
follows it too: **the public site is consumer-marketing only.** It can say
"parent-controlled accounts" and "real moderation" — it never describes
scoring formulas, moderation internals, the data model, or the roadmap.
`PRD.md`, `FAMILY.md`, and this file are internal and can be as detailed as
they need to be; `app/page.tsx` and anything else served to a visitor cannot
carry that detail. If you're ever unsure which side of the line something
belongs on, keep it out of the public page and put it here instead.

## What to build next

Follow `PRD.md` §19 in order — Wave 2 (Auth) first. Don't build Wave 6+
UI against data that Wave 2–5 haven't actually created yet; it's better to
have less UI that's real than more UI that's wired to nothing.
