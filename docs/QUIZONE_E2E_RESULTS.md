# QuiZone AI — E2E results (latest run)

**Run:** 2026-11-01, QZ-06. Fresh `supabase db reset --local` with all 6 migrations. Production build of the branch. Chromium (Playwright 1.63.0) and axe-core 4.10.3. Synthetic accounts only. Method and reproduction: `QUIZONE_E2E_CERTIFICATION.md`.

| Suite                                            | Pass              | Fail | Skip | Blocked                             |
| ------------------------------------------------ | ----------------- | ---- | ---- | ----------------------------------- |
| Unit + PGlite DB (`npm test`, 10 files)          | **80**            | 0    | 0    | 0                                   |
| Browser: family (`e2e/family-journey`)           | **17**            | 0    | 0    | 0                                   |
| Browser: resilience (`e2e/resilience`)           | **7**             | 0    | 0    | 0                                   |
| Browser: SafeZone (`e2e/safezone-journey`)       | **18**            | 0    | 0    | 0                                   |
| Browser: zones (`e2e/zones`)                     | **10**            | 0    | 0    | 0                                   |
| **Browser total**                                | **52**            | 0    | 0    | 0                                   |
| plpgsql_check (`supabase db lint --level error`) | 0 errors          |      |      |                                     |
| `npm audit` (full tree)                          | 0 vulnerabilities |      |      |                                     |
| Hosted UAT                                       | 0                 | 0    | 0    | **all** (no authorized environment) |

Unit/DB breakdown: database 22 · safezone 17 · family-controls 8 · validation 8 · hardening 6 · zone-flags 5 · quickzone-scoring 4 · rollback 4 · tooling 4 · errors 2.

## Zones suite (QZ-06)

| #   | Journey                                                                                                                                              | Result                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | **SolveZone:** client blocks overspend; server rejects a forged overspend; saved allocation exact; storm/fuel steps; score = sum of answers          | PASS                                   |
| 2   | **BuildZone:** $12,000 design blocked; forged design rejected; $8,500 design saved (`build_submissions.total_cost`); pitch steps                     | PASS                                   |
| 3   | **DebateZone:** six fixed stages; **no free-text input in the game UI**; completion                                                                  | PASS                                   |
| 4   | **Q hints:** refused until the guardian enables them; hint shown and logged in Parent Hub; operator pause disables the button and the server refuses | PASS                                   |
| 5   | **Game report → admin review:** guardian reports, admin moves it to under review then actioned, guardian sees the status; a guardian can't review    | PASS                                   |
| 6   | **CMS:** admin draft is invisible to guardians (UI and API) until explicit age review and publish; then playable                                     | PASS                                   |
| 7   | **WorldZone:** permission gate; completion; Singapore stamp on the passport; a second household sees no stamps and gets 404 on every session         | PASS                                   |
| 8   | **Kill switch:** paused BuildZone shows "Paused for now" and the server refuses; paused WorldZone shows a notice; both restored                      | PASS                                   |
| 9   | **Accessibility and layout** (390 + 1280) on allocation, blueprint, debate stage, world step, passport, challenges, admin, results                   | PASS (after fixing 3 contrast defects) |
| 10  | No uncaught console errors                                                                                                                           | PASS                                   |

## Requested certification journeys (all sessions)

| #   | Journey                                     | Result                                                                               |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1–4 | Registration, child profiles, consent, quiz | PASS (family F2–F5b; SafeZone S3–S4)                                                 |
| 5   | BuildZone                                   | **PASS** (zones 2)                                                                   |
| 6   | DebateZone                                  | **PASS** (zones 3)                                                                   |
| 7   | Family Game Night                           | PASS shared-screen; multi-device **NOT IMPL**                                        |
| 8   | SafeZone                                    | PASS (S1–S14)                                                                        |
| 9   | Global collaboration                        | **PASS** WorldZone gate, completion, privacy (zones 7); cross-household **NOT IMPL** |
| 10  | Learning progress reporting                 | PASS (F7, S12b, zones 4)                                                             |
| 11  | Safety reporting                            | **PASS** both sides (S10–S11, zones 5)                                               |
| 12  | Consent withdrawal                          | PASS (S14)                                                                           |
| 13  | Cross-family isolation                      | PASS (F8, S5, zones 7)                                                               |
| 14  | Responsive mobile                           | PASS (F10, S13, zones 9)                                                             |
| 15  | Accessibility                               | PASS automated; manual screen reader **open**                                        |
| +   | API failure & retry                         | PASS (R2–R5, S6b)                                                                    |

## Defects found by the suites and fixed (cumulative)

- 22 + 3 contrast failures (this run: the Q card note, the budget label, the shelter caption)
- hero overflow; mobile-nav contrast; agenda label contrast
- a date-input focus stop with no visible ring
- a removed explorer was shown the wrong message
- report notes were visible to families
- no post-session withdrawal
- export omitted SafeZone
- a moderator saw a family set-up prompt
- **the SafeZone suite left the flag enabled after the run** (now restored in `after()`)
