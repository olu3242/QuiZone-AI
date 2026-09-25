# QuiZone — Product Requirements Document

**Status:** Living document. This PRD is an internal engineering artifact — unlike the
public landing page, it's meant to hold the full picture, including things that
should never appear in consumer-facing copy (see `FAMILY.md` and `CLAUDE.md` for
why that separation matters).

**Tagline:** Play Together. Solve the World.

---

## 1. Overview & Vision

QuiZone is a family learning and global problem-solving platform. Families play
together — quizzing, reasoning through scenarios, building and pitching ideas,
debating, and connecting with families in other countries — through a shared
game-night experience designed for a living room, not a classroom.

**Problem it addresses:** Family time and screen time are usually opposites.
Existing "educational" apps skew toward solo drilling (flashcards, individual
quizzes) or toward pure entertainment with no learning value. Few products are
built for the family to sit down *together* and think together, and fewer still
give a child safe, structured exposure to how kids in other parts of the world
see the same problem.

**Vision:** Make the moment a family gathers around one screen (or several,
joined by one game code) the highlight of the week — and make what happens in
that moment count as real practice in reasoning, collaboration, and empathy.

**Design character:** Nintendo energy + Duolingo-style progression + a
trustworthy, modern consumer product. Explicitly *not* an enterprise dashboard,
a school LMS, a casino, or preschool software.

---

## 2. Goals & Non-Goals

### Goals (MVP / pilot)
- A complete, real (not mocked) family game-night loop: sign up → build a
  household → play → progress → get a parent summary → log back in and see it
  all persisted.
- Reward *reasoning and participation*, not only correct answers.
- Give kids safe, structured exposure to global peers — never unrestricted
  contact.
- Give parents a trustworthy, honest picture of what their kids actually did.

### Non-Goals (explicitly out of scope for MVP)
- Unrestricted child-to-child messaging or open chat of any kind.
- A full collaborative canvas for BuildZone (structured submission is enough
  for v1).
- A Teacher/classroom persona (the architecture should not preclude it later,
  but it isn't a launch blocker).
- Live video, voice chat, or anything that puts a child's live image/voice in
  front of strangers.
- Deciding actual subscription pricing (see §18 — flagged as an open question,
  not a decision this document makes).

---

## 3. Personas

| Persona | Summary |
|---|---|
| **Guardian** | Creates the household, adds/manages children, sets permissions, hosts game nights, views insights. The accountable party. |
| **Child** | Plays within a household, constrained entirely by guardian permissions. Never has an account independent of a household. |
| **Family Member** | Invited into a household to join game nights (e.g. a grandparent, aunt/uncle) without guardian-level control. |
| **Moderator** | Reviews reports and moderation cases; internal role, not a customer-facing persona. |
| **Administrator** | Manages challenge content, categories, media, users, and platform operations via the Admin CMS. |
| **Teacher** *(future, not MVP)* | Architecture should not block this later, but no teacher-facing surface ships in the pilot. |

---

## 4. Core Experience — the Primary Loop

```
Discover → Join → Play → Think → Collaborate → Build → Present → Reflect → Progress → Return
```

Every mode maps onto this loop differently, but a session should always leave a
family with something to talk about afterward, not just a score.

---

## 5. Information Architecture

**Public (marketing, unauthenticated):**
`/`, `/how-it-works`, `/challenges`, `/challenges/[slug]`, `/safety`, `/about`,
`/pricing`, `/login`, `/signup`, `/forgot-password`, `/reset-password`,
`/auth/callback`

> Status: this starter kit ships `/` (as in-page sections rather than separate
> routes for how-it-works/challenges/safety/pricing) plus real `/login` and
> `/signup` route placeholders. Splitting the in-page sections into standalone
> routes is a Wave 1 follow-up, not a rebuild.

**Authenticated nav:** Home · Play · Challenges · World · Passport · Family
**Guardian-only:** Parent Hub
**Admin-only:** Admin

Mobile uses a 5-item bottom bar; secondary destinations live under
More/Profile. Do not compress the full nav into a mobile bar.

---

## 6. Household & Profiles

Entities: `households`, `household_members`, `child_profiles`,
`guardian_permissions`.

A guardian can create a household, manage children, manage permissions, invite
family members, host game nights, and view learning summaries. A child's
access is constrained entirely by household membership and the permissions a
guardian has granted — a child can never query or interact with another
household's data, and this must be enforced server-side and via RLS, not just
hidden in the UI.

Onboarding, in order, with every step persisted (no faked "step complete"
state): **Welcome → Create Household → Add Child → Avatar/Interests →
Guardian Permissions → Game Night Preferences → Complete.**

---

## 7. Challenge Engine

Challenges are data, not code. Nothing about a specific challenge should be
hardcoded into a page component — the engine renders whatever a published
challenge version describes.

**Model:** challenge → challenge_version → mode, subject, age bands,
difficulty, duration, learning objectives, skills, player limits, scenario,
instructions, resources, constraints, steps, questions, answer options,
scoring, rubric, hints, reflection prompts, media, status.

**Lifecycle:** `DRAFT → REVIEW → PUBLISHED → RETIRED`. A published version must
stay reproducible forever — a family that played a challenge last year should
be able to have that exact session replayed/reviewed even if the challenge has
since been revised.

**Admin CMS** must let a non-engineer create, edit, duplicate, preview, test,
publish, unpublish, and archive challenges — including questions, answers,
steps, resources, media, rubrics, skill tags, age eligibility, scoring, hints,
and reflection prompts — with zero code deployment required for ordinary
content changes.

---

## 8. Game Modes

Persistent color identity per mode (see brand tokens in `/brand`):

| Mode | Identity | What it is |
|---|---|---|
| **QuickZone** | Yellow/Orange | Multiple choice & true/false, timed rounds, synchronized reveal, speed + streak scoring. The warm-up. |
| **SolveZone** | Blue | Scenario + evidence + constraints + resources → a decision, explained and submitted as a team. |
| **BuildZone** | Violet | Structured submission of an idea, budget, design, pitch, and supporting media. No collaborative canvas in v1. |
| **DebateZone** | Coral | Topic → assigned position → evidence → opening → counterargument → rebuttal → closing → reflection. No unrestricted child messaging. |
| **WorldZone** | Sky/Green | Asynchronous global challenges, regional comparisons, anonymized submissions, structured reactions, passport entries. |

### Reference challenge: "Power the Island" (SolveZone)
This is the challenge the engine is built and tested against first — it must
work completely end-to-end before any other SolveZone content ships.

- A team has **$100,000** to allocate across: Solar, Wind, Battery Storage,
  Diesel, Grid Repair, Energy Efficiency.
- Scenario events are injected mid-session (fuel price increases, storm
  damage, demand spikes) that can change what the "right" allocation looks
  like.
- Scored on: Problem Solving, Mathematical Reasoning, Systems Thinking,
  Collaboration.

---

## 9. Game Runtime

**Session lifecycle:** `DRAFT → LOBBY → READY → ACTIVE → PAUSED → COMPLETE`,
with exception states `CANCELLED` and `EXPIRED`.

**Question/step lifecycle:** `PENDING → ACTIVE → LOCKED → REVEAL → CLOSED`.

Session state is authoritative **server-side**, always. Client-side score
calculation is never trusted. Realtime sync (Supabase Realtime or equivalent)
keeps players' clients in sync with server state, not the other way around.

**Lobby:** host creates a game, gets a human-readable code (`QZ-7283`), and
sees players/avatars/ready state/connection state/teams before starting. Host
can only start once requirements are actually valid — not just once a button
is clickable.

---

## 10. Q — the AI Game Master

Q is a contextual facilitator, not an open chatbot. It offers: a hint, a
reasoning prompt, a constraint reminder, encouragement, or a reflection
question — e.g. *"You've allocated $120,000, but your budget is $100,000.
What would you change?"*

Rules:
- Runs **server-side only**. The provider sits behind an interface so it can
  be swapped without touching gameplay code.
- Every AI evaluation persists its metadata: provider/model, prompt version,
  rubric version, input reference, output, timestamp.
- The product must degrade **gracefully** when AI is unavailable — a session
  should never break because Q didn't respond.
- Q never becomes an open-ended conversation surface for a child. See
  `FAMILY.md`.

---

## 11. Scoring & Progression

**Scoring dimensions (server-authoritative, every score event persisted):**
- QuickZone: correctness, speed, streak (optional)
- SolveZone: reasoning, evidence use, creativity, feasibility, constraint
  adherence
- BuildZone: problem understanding, creativity, completeness, practicality,
  presentation

**Progression:** XP, levels, badges, skill events, a skill profile.

**Levels:** Explorer → Thinker → Solver → Builder → Strategist → Innovator →
Leader → Global Challenger

**Skills tracked:** Problem Solving, Critical Thinking, Creativity,
Collaboration, Communication, Mathematical Reasoning, Scientific Reasoning,
Financial Literacy, Digital Literacy, AI Literacy, Leadership, Systems
Thinking.

**Important constraint:** none of this is framed as a psychological or
intelligence measurement. Every skill/level claim must trace back to actual
recorded activity, not an inferred trait.

---

## 12. Passport & WorldZone

The **QuiZone Passport** shows profile, level, countries explored, global
challenges, collaborations, and badges/stamps — a visual "different places,
different perspectives, better ideas" narrative.

WorldZone MVP is deliberately narrow: asynchronous challenges, regional/country
comparisons, anonymized or aggregated submissions, structured reactions, and
passport entries. **No unrestricted cross-child DMs, now or as an accidental
side effect of a future feature.** No private child identity should ever be
derivable from a global/aggregate view.

---

## 13. Parent Hub

Routes: overview, children, child detail, learning insights, session
summaries, safety, interaction permissions, game-night scheduling,
account/privacy.

Visually calmer than the child/game surfaces — less illustration, more
information hierarchy. After every session, a parent should be able to answer:
*what did my child do, what were they practicing, what's worth asking about
at dinner, and is this safe?* Every insight shown must trace to real recorded
activity — never a generated-sounding claim with nothing behind it.

---

## 14. Safety & Moderation

See `FAMILY.md` for the non-negotiable safety charter this section summarizes.
Core mechanisms: guardian permissions, age eligibility checks, structured (not
open) interaction, reporting, moderation cases, an activity audit trail,
content status, and account restrictions where warranted.

**Moderation case states:** `OPEN → UNDER_REVIEW → ACTIONED / DISMISSED /
ESCALATED`, each recording reporter, session, content/event reference, reason,
severity, status, reviewer, actions taken, and timestamps. Every important
moderation decision needs auditable history — not just a final status flag.

---

## 15. Admin CMS

Sidebar: Dashboard, Challenges, Categories, Media, Moderation, Users,
Analytics, Settings. Should feel like a modern content management tool, not a
reskinned version of the child/family UI.

---

## 16. Data Model — Table Groups

(Full column-level schema belongs in migrations, not this document — this is
the map, not the territory.)

- **Identity/household:** profiles, households, household_members,
  child_profiles, guardian_permissions
- **Challenge content:** challenge_categories, challenges, challenge_versions,
  challenge_skills, challenge_steps, challenge_questions, question_options,
  challenge_resources, challenge_rubrics
- **Runtime:** game_sessions, session_players, session_teams, session_rounds,
  session_questions
- **Answers/scoring:** player_answers, team_answers, score_events,
  session_scores
- **Progression:** skills, player_skill_events, player_skill_profiles,
  badges, player_badges, levels, player_progress
- **World/passport:** passport_entries, collaborations, family_streaks
- **Trust & safety:** reports, moderation_cases, audit_events
- **Platform:** notifications, ai_evaluations, media_assets, feature_flags

All UUIDs, real foreign keys, constraints, and indexes. Core relational
entities are real columns/tables — not collapsed into giant JSON blobs. RLS is
enabled on every table holding user data, with server-side authorization as a
second, independent layer (RLS is a backstop, not the only check).

---

## 17. Non-Functional Requirements

- **Responsive targets:** Desktop 1440, Tablet 1024, Mobile 390, and a
  shared/TV landscape presentation mode for the lobby and shared-screen play.
  Layouts are designed per target, not just shrunk from desktop.
- **Accessibility:** keyboard navigation, visible focus, semantic controls,
  screen-reader labels, contrast compliance, reduced-motion support,
  accessible timers, and non-color status indicators. Target WCAG 2.2 AA
  behavior.
- **Required UX states**, on every important surface: loading, empty,
  populated, error, disabled, permission denied. Realtime gameplay
  additionally needs: waiting, ready, paused, disconnected, reconnecting,
  rejoined, completed, expired.
- **No fake states.** No success toasts standing in for real persistence, no
  hard-coded dashboard numbers, no client-only scores.

---

## 18. Suggested Success Metrics *(proposed — not yet validated with stakeholders)*

These are starting candidates for what "working" looks like, flagged
explicitly as proposals since no target numbers or business model decisions
have been made yet:

- Sessions completed end-to-end (lobby → results) as a % of sessions started
- Return rate: households that play a second game night within 14 days
- Parent Hub open rate after a session (are the insights actually being read?)
- Reports resolved within a defined SLA, by severity
- % of published challenges reused across 2+ sessions (content isn't a
  one-shot cost)

---

## 19. Rollout Plan

| Wave | Focus |
|---|---|
| W1 | Foundation + design system |
| W2 | Auth |
| W3 | Household |
| W4 | Challenge engine / Admin CMS |
| W5 | Game runtime |
| W6 | QuickZone |
| W7 | SolveZone (reference: Power the Island) |
| W8 | Progression |
| W9 | Passport / WorldZone |
| W10 | Q — AI Game Master |
| W11 | Parent Hub |
| W12 | Safety / moderation |
| W13 | BuildZone / DebateZone |
| W14 | Accessibility, security, performance hardening |
| W15 | Certification & deployment |

Do not build later-wave UI on top of skipped earlier-wave dependencies just to
look further along than the product actually is.

---

## 20. What This Starter Kit Actually Ships

To be explicit about scope, since this repo is the very first deliverable, not
the product:

**Included:** the public landing page (Nav, Hero, five Zones, How It Works,
Benefits, Safety, FAQ, final CTA, Footer), placeholder `/login` and `/signup`
routes, the full brand/design token system wired into Tailwind, and this
document set (`README.md`, `CLAUDE.md`, `AGENTS.md`, `FAMILY.md`, `PRD.md`).

**Not included yet:** everything in Waves 2–15 above — auth, household,
database, the challenge engine, game runtime, any scoring, Q, Passport,
Parent Hub, Admin, or moderation. The `/login` and `/signup` routes are
intentionally honest placeholders, not stubs pretending to work.

---

## 21. Open Questions & Risks

- **Pricing** is undecided. The landing page intentionally avoids inventing
  numbers — `/pricing` needs real business input before it ships.
- **Age bands** (exact ranges, not just "age-based") need a decision before
  the challenge engine's eligibility logic can be built.
- **AI provider** for Q is not yet chosen; the interface-behind-a-boundary
  requirement in §10 exists specifically so this decision doesn't block
  earlier waves.
- **International data/privacy requirements** (COPPA-equivalent rules in
  markets beyond the US) need legal review before WorldZone leaves MVP scope.

---

## 22. Appendix — Brand Reference

Full token values live in `/brand/brand-tokens.json` and `/brand/theme.css`,
and are wired directly into `tailwind.config.ts` — this section is a quick
human-readable summary, not the source of truth.

**Color:** Primary Blue `#0B5FFF` · Deep Blue `#083A8C` · Navy `#102A56` ·
Sky `#00B8D9` · Violet `#7C4DFF` · Coral `#FF4D6D` · Orange `#FF8A00` ·
Yellow `#FFD43B` · Green `#35C76F` · Ink `#17223B` · Muted `#667085`

**Mode identity:** QuickZone (Yellow/Orange) · SolveZone (Blue) · WorldZone
(Sky/Green) · BuildZone (Violet) · DebateZone (Coral)

**Type:** Poppins (display/headings) · Inter (body/UI)
