# QuiZone AI — E2E results (latest run)

**Run:** 2026-11-01, QZ-31–34. Fresh `supabase db reset --local` with all 18 migrations. Production build of the branch. Chromium (Playwright 1.63.0) and axe-core 4.10.3. Synthetic accounts only. Method and reproduction: `QUIZONE_E2E_CERTIFICATION.md`.

| Suite                                              | Pass              | Fail | Skip | Blocked                             |
| -------------------------------------------------- | ----------------- | ---- | ---- | ----------------------------------- |
| Unit + PGlite DB (`npm test`, 21 files)            | **135**           | 0    | 0    | 0                                   |
| Browser: explorer (`e2e/explorer`, QZ-32)          | **7**             | 0    | 0    | 0                                   |
| Browser: family (`e2e/family-journey`)             | **17**            | 0    | 0    | 0                                   |
| Browser: global (`e2e/global`, QZ-33)              | **5**             | 0    | 0    | 0                                   |
| Browser: members (`e2e/members`, QZ-31)            | **7**             | 0    | 0    | 0                                   |
| Browser: platform (`e2e/platform`, QZ-21–29 + 34)  | **11**            | 0    | 0    | 0                                   |
| Browser: resilience (`e2e/resilience`)             | **7**             | 0    | 0    | 0                                   |
| Browser: SafeZone (`e2e/safezone-journey`)         | **18**            | 0    | 0    | 0                                   |
| Browser: zones (`e2e/zones`)                       | **10**            | 0    | 0    | 0                                   |
| **Browser total**                                  | **82**            | 0    | 0    | 0                                   |
| plpgsql_check (`supabase db lint --level error`)   | 0 errors          |      |      |                                     |
| `npm audit` (full tree, incl. `@anthropic-ai/sdk`) | 0 vulnerabilities |      |      |                                     |
| Hosted UAT                                         | 0                 | 0    | 0    | **all** (no authorized environment) |

New DB/unit files: family-members 10 · explorer-mode 6 · global-connect 4 · q-provider 4 (the Messages API is a local stand-in: no key, no network, no spend). Rollback covers all 17 post-pilot migrations.

After the full run the shared database is left clean: consent at version 1; `safezone` and `q_live` off; `global_compare` on (suites restore all three in `after()`); the Global Connect suite deletes its five synthetic households through the normal account-deletion path.

## QZ-31–34 suites

| Suite    | Journey                                                                                                                                                                                                                                                             | Result |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| members  | M1 guardian creates a one-time code (gone after reload) · M2 wrong code refused, right code joins · M3 no guardian controls in UI or API · M4 member hosts on their own device; both devices see live state and each other in the lobby · M5 removal ends access    | PASS   |
| explorer | X1 lock → explorer dashboard, reduced nav · X2 guardian pages, app API, and direct Supabase REST/RPC all refused; wrong password doesn't unlock · X3 full game while locked · X4 survives reload, new tab, cleared storage · X5 password unlock restores everything | PASS   |
| global   | G1 aggregate card after WorldZone · G2 no identities on page or API; other household's session 404 · G3 kill switch hides it                                                                                                                                        | PASS   |
| platform | QZ-34: Q suggestion hidden and 404 while `q_live` is off; with it on and no server key, the CMS shows "not configured" (503); a guardian gets 403                                                                                                                   | PASS   |
| all      | axe WCAG 2.2 AA + no overflow at 390 and 1280 on every new surface; no uncaught console errors                                                                                                                                                                      | PASS   |

## Defects found and fixed (QZ-31–34)

- Failed invite-code guesses rolled back their own rate-limit hit (raise inside the metered transaction), so guessing was unmetered. Wrong codes now return `{joined:false}`.
- The game screen could be rolled back by an older in-flight poll after an action (two devices make this likelier). Added a newest-response guard.
- The account route validated input before the Explorer lock check, so a locked session got 400 instead of 403. The lock check now runs first.

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
