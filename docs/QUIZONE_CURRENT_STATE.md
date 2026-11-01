# QuiZone — current state (2026-11-01)

**Decision: local pilot functionally verified on a real Supabase stack. Hosted UAT BLOCKED (no QuiZone Supabase project; Vercel connector lacks env/deployment scope). Production NO-GO.**

## Repository facts (observed, not inherited)

| Item                                                                                         | State                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main` (`ef9ab4e`)                                                                           | Config + docs only. **No `app/`, `components/`, `lib/`, `brand/`** — any Vercel build of `main` fails. CLAUDE.md/README on `main` describe files that do not exist there. |
| `work/quizone-e2e-20261018` (`73bc00e`, draft PR #1)                                         | The actual application: Next.js App Router, Supabase SSR auth, one transactional command boundary, 1 migration, PGlite DB tests.                                          |
| `claude/gracious-bohr-a6k3nv` (this branch)                                                  | PR #1 + 4 commits below. Stacked on PR #1; nothing on `main` was changed.                                                                                                 |
| Prior claims "43 domain tests / 199 DB assertions / BuildZone + DebateZone browser journeys" | **Not present in any branch.** PR #1 itself states the unpublished local W13 work was not included. Treat as unrecoverable unless the original machine still has it.      |

## Commits on this branch

| SHA       | Batch    | Summary                                                                                                                                                                                                                 |
| --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e86dce1` | QZ-01    | `next` 16.3.8 → 16.4.3 (**critical unauthenticated RCE** GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr; DoS GHSA-p3m5-59mp-jv5r). minimatch facade clears GHSA-g3hv-75wg-m249 so CI's `--audit-level=low` gate passes again. |
| `2063b92` | QZ-02    | Guardian data rights: explorer edit/archive/restore/delete, JSON export, password change, global sign-out, account deletion.                                                                                            |
| `e0820c6` | QZ-01/09 | Real-stack browser E2E (Playwright + axe) and CI job; fixed 22 serious contrast failures and hero overflow at all widths.                                                                                               |
| `e8562b4` | QZ-03    | Server-timed QuickZone speed + streak scoring; Play again.                                                                                                                                                              |
| `088b231` | SafeZone | Guardian-approved, moderated, card-based town halls behind an off-by-default flag. See `SAFEZONE_SPEC.md`, `SAFEZONE_SAFETY_REVIEW.md`, `SAFEZONE_EVIDENCE.md`.                                                         |

## Verification run in this session

| Gate                                                         | Result                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Unit + PGlite DB suites (`npm test`)                         | **62 pass / 0 fail / 0 skip** (baseline was 31)                                             |
| Browser E2E on local Supabase CLI stack (`npm run test:e2e`) | **32 pass / 0 fail / 0 skip** (17 family + 15 SafeZone); also green in GitHub Actions `e2e` |
| axe WCAG 2.2 AA (serious/critical) on 10 routes              | 0 violations (after fixes; 22 before)                                                       |
| `npm run lint`, `npm run typecheck`, `npm run build`         | Pass                                                                                        |
| `npm audit` (full tree, `--audit-level=low`)                 | 0 vulnerabilities (was 1 critical runtime + moderate dev chain)                             |
| `supabase db lint --level error` (plpgsql_check)             | 0 errors                                                                                    |
| Migrations applied on Supabase Postgres 17 (CLI stack)       | 3/3 applied; RLS on all 16 public tables                                                    |
| Hosted Supabase / Vercel preview UAT                         | **Not executed — blocked** (see `QUIZONE_DEPLOYMENT_READINESS.md`)                          |
| GitHub Actions for this branch                               | Pending first run after push                                                                |

The local stack is the same Supabase images (GoTrue, PostgREST, Postgres 17, Mailpit) as hosted, so email confirmation, PKCE callback, password recovery, JWT-scoped RLS through PostgREST and `auth.users` deletion were exercised for real — but it is not hosted evidence (no real SMTP, domain, cookies over HTTPS, or Vercel runtime).

See `QUIZONE_FEATURE_MATRIX.md` for per-feature status and `QUIZONE_REMAINING_GAPS.md` for the ordered backlog.
