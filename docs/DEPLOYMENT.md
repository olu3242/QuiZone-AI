# QuiZone deployment runbook

## Target and source

- Repository: `olu3242/QuiZone-AI`
- Repair branch: `work/quizone-e2e-20261018`
- Base: `ef9ab4e123a21987606da6f5b8671895764249b1`
- Framework: existing Next.js App Router, React 18, TypeScript, Tailwind 4.
- Existing Vercel project identified by the approved Git upload: `qui-zone-ai` (`prj_At3aDMHerUaIExGySYmhvZEslB49`) in `eduradiusllc`. Its initial repair preview reached READY.
- Hosting target: existing Vercel project from the failed build. No replacement Site or production project has been created.

## Database preparation

Review the migration against the intended database before applying. It creates public application tables and private authorization/answer-key structures; applying it to an unknown or populated database is not a reconciliation strategy.

Use a dedicated empty test project first. Configure the Supabase CLI through its supported login/link workflow on your own machine, then review `supabase db push --help` and perform the migration. Keep credentials outside the repository and command history. The app needs only the publishable key; it never needs a service-role key.

The migration explicitly revokes direct client mutations. `public.qz_command` is a SECURITY INVOKER wrapper around an authenticated private transactional command function. The private function uses a fixed empty search path and explicit confirmed-user, ownership, staff, age, permission, state, and input checks. It is the sole privileged mutation boundary; RLS provides independent read isolation. Do not grant client writes to make an error disappear.

Enable email confirmation. Configure Auth redirect URLs for the exact preview and production origins, not arbitrary wildcard domains. Set the canonical origin in `NEXT_PUBLIC_SITE_URL` for the environment being tested. Use real production SMTP and verify reset/confirmation delivery.

## Vercel settings

| Setting | Value |
|---|---|
| Root Directory | Repository root |
| Framework | Next.js |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Default Next.js output |
| Node.js | 22 or newer supported LTS |
| Environment | URL, publishable key, canonical origin from `.env.example` |

Push to the repair branch and inspect its Git-connected preview deployment. The missing `app` error is addressed in this branch, but successful local compilation is not proof that a hosted deployment succeeded.

## Hosted acceptance procedure — pending execution

1. Sign up with a dedicated adult test email; confirm email; log out and log in.
2. Request a password reset; open the mailed link; change the password; verify old password rejection.
3. Create a household; add a nickname; choose avatar and interests; save permissions; reload and verify persistence.
4. In a second adult account, create a second household. Verify it cannot read or mutate the first household's child, session, answers, plan, score, stamp, or report through API or REST.
5. Complete QuickZone. Verify invalid transition, repeated answer, and client-supplied score rejection. Reload results.
6. Submit a real SolveZone budget; reject overspending; pause/resume; complete. Check saved allocation in parent review.
7. Save a BuildZone blueprint within budget and finish its pitch/reflection choices. Verify saved total and completed progression.
8. Complete the six DebateZone stages; verify no messaging surface or unrestricted text submission exists.
9. Verify WorldZone is denied until permission is enabled; complete it; inspect household-only stamp.
10. Disable and enable Q hints; inspect persisted curated-provider hint history. Do not call it live AI.
11. Submit a safety report; review as staff; verify status and audit history. Nonstaff review must be rejected.
12. Create a challenge draft; verify it cannot be played; explicitly review age appropriateness; publish; complete a session against that exact immutable version.
13. Expire a session using a controlled test database; verify no further answer or score is accepted. Test refresh/offline/reconnect and a second device with the same guardian.
14. Inspect accessibility at 390, 1024, and 1440 pixels: keyboard focus, native modal, radios, error announcements, readable timer, reduced motion, contrast, and landscape presentation.
15. Run Supabase security/performance advisors, `npm run audit`, production build, and load/recovery tests. Reconcile findings before production.

## Release and recovery

Keep production data out of test artifacts. Take an operator-managed backup and verify restore procedures before onboarding real families. Retain the previous Vercel deployment for rollback. A UI rollback must not delete gameplay data or attempt to undo an additive schema migration. Review backward compatibility before each later migration.

A production release requires closure of the legal/consent, age-band, SMTP, hosted isolation, browser, security, and recovery gates. No production release or remote schema change is asserted by this branch.
