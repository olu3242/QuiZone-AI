# QuiZone AI — hosted readiness

Configuration inspection and the env checklist: `QUIZONE_DEPLOYMENT_READINESS.md`. SafeZone-specific hosted status: `SAFEZONE_HOSTED_CERTIFICATION.md`.

## Current hosted state (observed 2026-11-01)

| Target               | State                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions       | `verify` + `e2e` green on `59ee8a5`; re-run expected on the new head                                                                                           |
| Vercel `qui-zone-ai` | The preview for this branch builds (Ready). It has no Supabase env, so it renders the "not connected" state. The connector can't read env vars or deployments. |
| Supabase             | Candidate `orjremljufkflomsjelr` is linked by the GitHub integration (its "Supabase Preview" check is skipped). The connector is **denied**. Not touched.      |
| Production           | Untouched                                                                                                                                                      |

## Isolation rules for the hosted run

- Use a dedicated UAT project. Never point a preview at a database with real families.
- Use only the publishable key in Vercel. The DB URL stays on the operator's machine (for `supabase db push`, rollback, and E2E operator SQL).
- Keep the SafeZone flag off on UAT except during a synthetic run, and record who turned it on and when.
- Allow-list only the exact preview `…/auth/callback` URLs.
- Turn on `secure_password_change` (local config already has it) and set the email rate limits for UAT.

## Hosted run order (each step needs your go-ahead)

1. Authorize the UAT project and connector access.
2. `supabase link` → `supabase db push`, applying the 5 migrations in order. Keep `supabase/rollback/` ready.
3. Set the 3 Preview env vars on Vercel; redeploy the branch preview.
4. Run `npm run test:e2e` against the preview (`E2E_BASE_URL`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_KEY`, `E2E_DB_URL` operator-only) with a test-inbox adapter.
5. Run `SAFEZONE_UAT_TEST_PLAN.md` manual items and the Supabase security/performance advisors.
6. Record the results in `QUIZONE_E2E_RESULTS.md` and re-issue `QUIZONE_RELEASE_DECISION.md`.
