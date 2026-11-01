# QuiZone AI — E2E results (latest run)

**Run:** 2026-11-01, QZ-30. Fresh `supabase db reset --local` with all 14 migrations. Production build of the branch. Chromium (Playwright 1.63.0) and axe-core 4.10.3. Synthetic accounts only. Method and reproduction: `QUIZONE_E2E_CERTIFICATION.md`.

| Suite                                            | Pass              | Fail | Skip | Blocked                             |
| ------------------------------------------------ | ----------------- | ---- | ---- | ----------------------------------- |
| Unit + PGlite DB (`npm test`, 17 files)          | **111**           | 0    | 0    | 0                                   |
| Browser: family (`e2e/family-journey`)           | **17**            | 0    | 0    | 0                                   |
| Browser: platform (`e2e/platform`, QZ-21–29)     | **11**            | 0    | 0    | 0                                   |
| Browser: resilience (`e2e/resilience`)           | **7**             | 0    | 0    | 0                                   |
| Browser: SafeZone (`e2e/safezone-journey`)       | **18**            | 0    | 0    | 0                                   |
| Browser: zones (`e2e/zones`)                     | **10**            | 0    | 0    | 0                                   |
| **Browser total**                                | **63**            | 0    | 0    | 0                                   |
| plpgsql_check (`supabase db lint --level error`) | 0 errors          |      |      |                                     |
| `npm audit` (full tree)                          | 0 vulnerabilities |      |      |                                     |
| Hosted UAT                                       | 0                 | 0    | 0    | **all** (no authorized environment) |

Unit/DB by file: database 22 · safezone 17 · content 10 · validation 8 · family-controls 8 · hardening 6 · zone-flags 5 · rollback 5 · progression 5 · tooling 4 · quickzone-scoring 4 · practice 4 · consent 4 · q-budget 3 · ops 3 · errors 2 · progress 1.

After the full run the shared database is left clean: consent is back to version 1 and the SafeZone flag is off (both suites restore them in `after()`).

## Platform suite (QZ-21–29)

| Batch    | Journey                                                                                                                                                         | Result |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| QZ-22/23 | Admin drafts a challenge; adding a duplicate-option step shows the checklist; **publish is refused by the server**; fixing the step clears it; publish succeeds | PASS   |
| QZ-21    | Admin sets subject/difficulty; guardian filters by subject and by difficulty; card shows both                                                                   | PASS   |
| QZ-22    | New version → edit → publish: v1 retired, v2 published; the family's next session is on v2                                                                      | PASS   |
| QZ-24    | Completion earns child and family badges; Passport shows the PRD level and honest locked badges                                                                 | PASS   |
| QZ-25    | Practice round: labelled, plays fully, results say nothing was recorded; no new score events or badges; Parent Hub labels it                                    | PASS   |
| QZ-26    | Parent Hub progress card (level, zones played); with 104 seeded older sessions, history pages past the newest 100 from the server                               | PASS   |
| QZ-27    | Operator publishes consent v2: banner on every page; new play refused until the guardian accepts; history shows v1 superseded, v2 current; export lists both    | PASS   |
| QZ-28    | Staff operations tiles render; no personal data in the panel; a guardian gets 403                                                                               | PASS   |
| QZ-29    | Guardian sets a 1-hint daily limit; card shows "1 of 1 used"; second hint refused                                                                               | PASS   |
| —        | axe WCAG 2.2 AA + no overflow at 390 and 1280 on every new surface                                                                                              | PASS   |
| —        | No uncaught console errors                                                                                                                                      | PASS   |

## Defects found by the suites and fixed (QZ-21–30)

- `/api/history` rejected Postgres timestamps (`+00:00` offset), so older history never loaded. Fixed with `datetime({ offset: true })`.
- Data export assigned query results to the wrong variables after the consent query was added: `consentRecords` held family badges and the badge sections were wrong. Fixed the `Promise.all` order.
- `private.quality_issues` errored at runtime on literal-message checks (array-literal coercion). Caught by plpgsql_check.
- The consent gate referenced `NEW.status` on `game_sessions`, because PL/pgSQL `AND` doesn't short-circuit. It broke every session insert until fixed (30 DB tests caught it).
- The pilot immutability trigger returned `NEW` on DELETE, which silently cancelled deletes of draft steps.

Earlier defects (QZ-01–06) are recorded in `git log` and `QUIZONE_UNIFIED_STATUS.md`.
