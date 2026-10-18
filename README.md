# QuiZone — family learning application

**Play Together. Solve the World.**

This branch repairs the missing Next.js application in `ef9ab4e` and implements a **guardian-led, shared-screen pilot**. It does not certify every feature in the wider PRD or replace any unpublished local W13 implementation.

## Implemented

- Responsive public landing page and token-based branding.
- Supabase guardian signup, email confirmation, login, password recovery, reset, and signout.
- Persisted household consent, child nicknames/ages/avatars/interests, and default-deny WorldZone/hint permissions.
- Five versioned, data-driven starter challenges. QuickZone questions; SolveZone's six-category island budget and changing scenario; BuildZone's costed shelter design and guided pitch; DebateZone's six guided argument/evidence/reflection stages; WorldZone's country challenge.
- Server-authoritative lobby, ready, active, paused, complete, cancelled, and expired states, five-second synchronization, saved answers, exact-once completion XP, and guardian session limits.
- Saved progress, household-only passport stamps, parent summaries, reviewed hint history, and game-night calendar entries.
- Staff-only draft creation/publication with explicit age-review confirmation, moderation-case review, and append-only audit records through the application.
- API authorization plus PostgreSQL RLS, transaction locks, immutable published content, bounded inputs, and restricted SQL command access. No service-role key is used by the app.

## Run

Requires Node.js 22+.

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
```

The public site builds without secrets. Account actions remain disabled until Supabase is configured; there is no fake account or in-memory persistence fallback.

## Connect the backend

1. Use a dedicated **QuiZone** Supabase project. Do not apply this migration to another product's database.
2. Apply `supabase/migrations/20261018190538_quizone_pilot.sql` to a reviewed empty pilot database using Supabase migrations. Existing production schemas need reconciliation first.
3. Copy `.env.example` to `.env.local`, then set the project URL, publishable key, and canonical app origin locally. Never commit keys or passwords.
4. Enable email confirmation and configure your Supabase Auth site URL and redirect allowlist for `/auth/callback` and `/auth/callback?next=/reset-password` on the intended domain.
5. Configure production SMTP and validate delivery before inviting families.
6. Deploy the same environment variables to Vercel. Use repository root, Next.js preset, `npm run build`, and the default output directory.

A staff role is provisioned by a database operator in `private.staff` for an existing confirmed guardian UUID. It cannot be self-assigned through the client or user metadata. Give `admin` only to content publishers and `moderator` to report reviewers.

See [deployment runbook](docs/DEPLOYMENT.md), [implementation evidence and limits](docs/IMPLEMENTATION_STATUS.md), [architecture](docs/ARCHITECTURE.md), and [family safety charter](FAMILY.md).

## Verification boundary

The automated integration suite uses actual PostgreSQL through PGlite with controlled Auth identity stubs and separate database roles. It exercises the real migration and command functions. It does **not** validate hosted Supabase Auth email delivery, PostgREST embeds, Vercel cookies, browser accessibility, multi-device synchronization, or production recovery.

The connected Supabase account did not contain a QuiZone project, and no matching project was found in the connected Vercel account/team. No hosted migration or production release has been performed.

## Remaining PRD scope

Live-model Q and its evaluations; family-member invitations; multi-device host/join game-code flows; timed synchronized QuickZone reveal; richer rubric-based reasoning and submissions; media uploads; cross-household moderated WorldZone and regional comparisons; full multi-step CMS editing/version duplication/retirement; notifications; account export/deletion; legal approval of consent, age bands, and markets; hosted/browser/security/performance certification.

The pilot's 8–17 age range is an implementation default requiring product and legal review, not an approved market policy. Family consent is stored as adult self-attestation; a legally sufficient verifiable parental-consent program is not implemented. Do not invite children to production until the launch gates are closed.
