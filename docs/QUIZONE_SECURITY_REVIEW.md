# QuiZone security review (2026-11-01)

Scope: this branch's dependency changes, two new migrations, `/api/account`, new UI, plus a re-read of the pilot boundary. FAMILY.md checklist applied to every child-data change.

## Fixed in this branch

| Severity         | Finding                                                                                                          | Fix                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Critical**     | `next@16.3.8` — unauthenticated RCE (Image Optimization w/ SVG; `use cache` typed arrays) and Server Actions DoS | `next@16.4.3`; full + runtime audit now 0                                                       |
| Moderate (dev)   | `minimatch <11.0.1` ReDoS across ESLint chain; broke CI audit gate                                               | `tools/minimatch-compat` facade over `minimatch@11.0.3`; tested in `tests/tooling.test.ts`      |
| Medium (privacy) | No way for a guardian to correct, remove, export, or delete child data                                           | QZ-02 controls (see architecture)                                                               |
| Low              | Password change only via email reset (no in-session, no "other devices" revocation)                              | `change-password` re-verifies current password, then `signOut({scope:"others"})`; `signout-all` |

## Verified controls (this session)

- Cross-household reads/writes denied through the app API **and** directly through PostgREST using another guardian's real JWT (E2E 8); direct table INSERT returns 401/403; anon reads return nothing.
- New SQL commands: unconfirmed/anonymous denied; foreign `child` ids denied; `private.purge_sessions` and `private.account_deletions` not reachable by `authenticated`; `bonus`/`step_started_at` not client-writable (DB tests).
- Destructive actions require exact typed confirmation, server-side.
- No service-role key anywhere in the app; `/api/account` uses the caller's session only. `.env.local` is gitignored; the only keys in tests/CI are the Supabase CLI's public local-only defaults.

## FAMILY.md checklist — QZ-02/QZ-03

| Question                                                       | Answer                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Child access scoped to own household, server-side **and** RLS? | Yes — `authorize()` + `family_command` ownership + RLS                                     |
| Interaction between children structured?                       | Unchanged; no messaging added                                                              |
| Honest guardian-visible record?                                | Yes — every new command writes `audit_events`; export includes the audit trail             |
| Reportable with auditable case?                                | Unchanged. Explorer deletion is **blocked** while a report on their activity is unresolved |
| Anything identifying a child outside the household?            | No. Export is household-only; deletion ledger stores counts only                           |

## Open findings (not fixed here)

| Severity | Finding                                                                                                                                                                                | Recommendation                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Medium   | `/api/auth` `reset-password` mode changes the password for **any** signed-in session, without a recovery-session check; it is now the weakest path to a takeover on an unlocked device | Require an `amr` recovery claim (or a short-lived server marker set in `/auth/callback?next=/reset-password`) |
| Medium   | Account deletion erases the guardian's moderation cases with the household                                                                                                             | Legal review: retention of safety records vs erasure; consider retaining a pseudonymous case record           |
| Low      | `/api/command` returns raw Postgres error text (e.g. cast errors)                                                                                                                      | Map to stable error codes                                                                                     |
| Low      | No application-level rate limiting on `/api/command` and `/api/account` (Supabase Auth limits only cover auth)                                                                         | Add per-user limiter (Upstash/Vercel KV or DB token bucket) before public UAT                                 |
| Low      | `GET /api/account` writes an audit row (side effect on GET)                                                                                                                            | Acceptable (SameSite=Lax blocks cross-site subresource cookies); move to POST if export grows heavier         |
| Info     | `challenges` table readable in full (titles of drafts)                                                                                                                                 | Restrict to published or staff                                                                                |
| Info     | Supabase advisors not run against a hosted project                                                                                                                                     | Run `get_advisors` once a QuiZone project exists                                                              |
