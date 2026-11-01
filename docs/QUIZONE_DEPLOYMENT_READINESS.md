# QuiZone deployment readiness (2026-11-01)

**Preview/UAT: BLOCKED. Production: NO-GO.** Nothing was deployed and no hosted database was touched.

## Inspection results

| Target                   | Observed                                                                                                                                                                                                                                                           | Status                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| GitHub Actions           | `ci.yml` (audit/test/lint/type/build) now also runs on `claude/**` and PRs to any base; new `e2e.yml`                                                                                                                                                              | Pending first run on this branch                                                            |
| Vercel project           | `qui-zone-ai` (`prj_At3aDMHerUaIExGySYmhvZEslB49`) in team Eduradius LLC is visible to the connector, but env-var listing returns 404 and deployment listing 403                                                                                                   | **BLOCKED — connector permission scope**                                                    |
| Vercel production branch | `main` has no `app/` → builds fail until PR #1 (and this stack) merge                                                                                                                                                                                              | **Deployment blocker**                                                                      |
| Supabase                 | Connector org has Foundry, MEDLINK, BTG AI (all inactive). **However**, the repo's Supabase GitHub integration reports a "Supabase Preview" check linked to project `orjremljufkflomsjelr` (skipped on PR #2). That project is in an org the connector cannot see. | **BLOCKED — grant connector access to that org, or confirm it is the intended UAT project** |
| Migrations               | 3 files, applied cleanly to Supabase Postgres 17 locally; not applied anywhere hosted                                                                                                                                                                              | Ready for review                                                                            |
| Auth callbacks           | Code uses `${NEXT_PUBLIC_SITE_URL}/auth/callback` and `.../auth/callback?next=/reset-password`                                                                                                                                                                     | Must be allow-listed per environment                                                        |

## Missing environment variables (names only)

Vercel (Preview and, later, Production — per environment):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy fallback `NEXT_PUBLIC_SUPABASE_ANON_KEY` is read if absent)
- [ ] `NEXT_PUBLIC_SITE_URL` (exact canonical origin, no trailing slash)

Operator machine only (never in Vercel or the repo):

- [ ] `SUPABASE_DB_URL` or `supabase login` + `supabase link` for migration push

Not needed: any service-role key (the app never uses one). Future, when Q goes live: a server-only provider key (name TBD with the provider choice).

## SafeZone operator controls (no app UI by design)

- [ ] Leave `private.feature_flags.safezone = false` until the gates in `SAFEZONE_SAFETY_REVIEW.md` §4 close.
- [ ] Grant moderators with SQL into `private.staff`, only after vetting and training.

## Supabase project settings required

- [ ] Email confirmation **on**; minimum password length 12
- [ ] Site URL = preview origin; redirect allow-list = exact `/auth/callback` and `/auth/callback?next=/reset-password` URLs (no broad wildcards)
- [ ] Custom SMTP for confirmation/recovery mail
- [ ] Auth email rate limit appropriate for UAT (local config raised to 20/h for E2E only)

## Safest rollout order (each step needs your explicit go-ahead)

1. Create a dedicated **empty** `quizone-uat` Supabase project (or grant the connector access to the intended one).
2. Review the 3 migrations, then `supabase db push` to that project only.
3. Set the 3 Vercel env vars for **Preview** scope; grant the Vercel connector project read access (or run checks from the dashboard).
4. Merge order: this branch → `work/quizone-e2e-20261018` (PR #1) → `main`, or retarget as you prefer. Preview deploy from the branch first.
5. Run `npm run test:e2e` against the preview with a real test inbox, then the manual items in `DEPLOYMENT.md` §15.
6. Run Supabase security/performance advisors on the hosted project; resolve findings.
7. Production only after the legal/consent, age-band, SMTP, backup/restore, rate-limit and the Medium items in `QUIZONE_SECURITY_REVIEW.md` close.
