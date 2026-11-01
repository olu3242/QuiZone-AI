# QuiZone remaining gaps — ordered backlog

Ordered by: release blockers → security → core journeys → breadth. Each batch should keep the established pattern (additive migration → command boundary → API → UI → DB tests → browser E2E).

## Release blockers (external — need you)

1. **Hosted Supabase project** for UAT. The connector sees none, but the GitHub integration links `orjremljufkflomsjelr`. Confirm and grant access.
2. **Vercel connector scope** for `qui-zone-ai` env/deployments, plus the 3 env vars.
3. **Merge path to `main`** — `main` cannot build until the app lands.
4. **Legal/product decisions**: approved age bands (8–17 is a placeholder), verifiable parental consent program, safety-record retention vs erasure on account deletion, international privacy review for WorldZone.
5. **Custom SMTP** and a test-inbox strategy for hosted E2E.

6. **SafeZone decisions**: amend `FAMILY.md` §2 or keep card-only; moderator vetting program; enablement sign-off (`SAFEZONE_SAFETY_REVIEW.md` §4).

## Next engineering batches

| Batch                                         | Scope                                                                                                                                                                                                                               | Why now                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **QZ-04 Security hardening**                  | Recovery-session check on `reset-password`; app-level rate limits on `/api/command` + `/api/account`; stable error codes; restrict `challenges` read to published/staff; fault-injection E2E for API failure/retry (requirement 15) | Closes the Medium findings before any real family uses UAT                     |
| **QZ-05 Family membership + multi-device**    | `household_members` (guardian/member roles), invite codes (hashed, expiring, single-use), role-aware `private.owns`, Realtime broadcast replacing polling, presence/reconnect states                                                | Unlocks "family invitations" and real multiplayer — the largest functional gap |
| **QZ-06 Browser journeys for existing modes** | E2E for SolveZone allocation, BuildZone blueprint, DebateZone six stages, WorldZone permission gate, Q hints, report → staff review, CMS draft → publish                                                                            | These exist and are DB-tested but have no browser evidence                     |
| **QZ-07 Content model**                       | Subject + difficulty columns and filters; multi-step CMS editing/duplication/retirement; question quality checks (option uniqueness, length, reading level)                                                                         | Required before any AI generation                                              |
| **QZ-08 Q live provider**                     | Provider interface behind `private`/server boundary, bounded prompts, output moderation, per-household daily token budget, `ai_evaluations` cost columns, graceful fallback to curated hints                                        | Blocked on provider choice + key                                               |
| **QZ-09 Guardian dashboard depth**            | Session history pagination, per-child progress over time, badges/levels model (PRD §11), consent version records, safety notifications                                                                                              |                                                                                |
| **QZ-10 Educator**                            | Classes/groups, assignments, progress reports — PRD lists Teacher as post-MVP; schedule after pilot feedback                                                                                                                        |                                                                                |

## Known technical debt

- `private.command` is a single large function; consolidate once the router has stabilized (one deliberate migration with full regression run).
- Scoring logic is split between `private.command` and triggers — documented in `QUIZONE_ARCHITECTURE.md`; fold together during consolidation.
- 5-second polling for game state.
- `docs/IMPLEMENTATION_STATUS.md` (Oct 18) is superseded by `QUIZONE_CURRENT_STATE.md`.
- Manual screen-reader and real-device testing not yet done (automated axe only).
