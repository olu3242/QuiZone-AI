# QuiZone AI — scenario catalog

Generated from `e2e/scenarios.json` by `node scripts/scenarios.mjs`. `tests/scenarios.test.ts` fails if a scenario cites a test that doesn't exist, or if any browser test or DB test file isn't mapped here.

**101 scenarios** · 97 with browser evidence · 4 DB-only (with a stated reason).

## Admin / guardian

| ID             | Scenario                                                                                          | Browser evidence        | DB / unit evidence                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| automation:001 | A1. CMS authors a 13–17 challenge in every non-Quick zone; age bands hold in each                 | `e2e/automation.e2e.ts` | `tests/ops-automation.test.ts`, `tests/family-notifications.test.ts`, `tests/content.test.ts`                                                                                      |
| automation:002 | A2. archived explorers are refused in every zone; active ones can play a CMS challenge end to end | `e2e/automation.e2e.ts` | `tests/ops-automation.test.ts`, `tests/family-notifications.test.ts`, `tests/content.test.ts`                                                                                      |
| automation:003 | A3. the family inbox shows earned badges and report reviews; read state persists                  | `e2e/automation.e2e.ts` | `tests/ops-automation.test.ts`, `tests/family-notifications.test.ts`, `tests/content.test.ts`                                                                                      |
| automation:004 | A4. scheduled maintenance: admin runs it; stale games expire; reminders reach the inbox once      | `e2e/automation.e2e.ts` | `tests/ops-automation.test.ts`, `tests/family-notifications.test.ts`, `tests/content.test.ts`                                                                                      |
| automation:005 | A5. the BuildZone portfolio shows the family's saved design                                       | `e2e/automation.e2e.ts` | `tests/ops-automation.test.ts`, `tests/family-notifications.test.ts`, `tests/content.test.ts`                                                                                      |
| automation:006 | A6. accessibility (axe WCAG 2.2 AA) and no overflow on every new surface                          | `e2e/automation.e2e.ts` | —                                                                                                                                                                                  |
| automation:007 | A7. no uncaught client console errors                                                             | `e2e/automation.e2e.ts` | —                                                                                                                                                                                  |
| platform:044   | QZ-22/23: admin drafts a challenge; publish is refused until quality checks pass                  | `e2e/platform.e2e.ts`   | `tests/content.test.ts`, `tests/progression.test.ts`, `tests/practice.test.ts`, `tests/consent.test.ts`, `tests/ops.test.ts`, `tests/q-budget.test.ts`, `tests/q-provider.test.ts` |
| platform:045   | QZ-21: admin sets subject/difficulty; families filter by them                                     | `e2e/platform.e2e.ts`   | `tests/content.test.ts`, `tests/progression.test.ts`, `tests/practice.test.ts`, `tests/consent.test.ts`, `tests/ops.test.ts`, `tests/q-budget.test.ts`, `tests/q-provider.test.ts` |
| platform:046   | QZ-22: a new version supersedes the old one; families play the newest                             | `e2e/platform.e2e.ts`   | `tests/content.test.ts`, `tests/progression.test.ts`, `tests/practice.test.ts`, `tests/consent.test.ts`, `tests/ops.test.ts`, `tests/q-budget.test.ts`, `tests/q-provider.test.ts` |
| platform:047   | QZ-24: completion earns badges and a PRD level on the Passport                                    | `e2e/platform.e2e.ts`   | `tests/content.test.ts`, `tests/progression.test.ts`, `tests/practice.test.ts`, `tests/consent.test.ts`, `tests/ops.test.ts`, `tests/q-budget.test.ts`, `tests/q-provider.test.ts` |
| platform:048   | QZ-25: practice rounds play fully but record no XP or badges                                      | `e2e/platform.e2e.ts`   | `tests/content.test.ts`, `tests/progression.test.ts`, `tests/practice.test.ts`, `tests/consent.test.ts`, `tests/ops.test.ts`, `tests/q-budget.test.ts`, `tests/q-provider.test.ts` |
| platform:049   | QZ-26: Parent Hub progress by explorer and history beyond the newest 100                          | `e2e/platform.e2e.ts`   | `tests/content.test.ts`, `tests/progression.test.ts`, `tests/practice.test.ts`, `tests/consent.test.ts`, `tests/ops.test.ts`, `tests/q-budget.test.ts`, `tests/q-provider.test.ts` |
| platform:050   | QZ-27: a new consent version gates new play until the guardian accepts                            | `e2e/platform.e2e.ts`   | `tests/content.test.ts`, `tests/progression.test.ts`, `tests/practice.test.ts`, `tests/consent.test.ts`, `tests/ops.test.ts`, `tests/q-budget.test.ts`, `tests/q-provider.test.ts` |
| platform:051   | QZ-28: staff operations tiles show aggregates only                                                | `e2e/platform.e2e.ts`   | `tests/content.test.ts`, `tests/progression.test.ts`, `tests/practice.test.ts`, `tests/consent.test.ts`, `tests/ops.test.ts`, `tests/q-budget.test.ts`, `tests/q-provider.test.ts` |
| platform:052   | QZ-29: the guardian's daily hint limit is shown and enforced                                      | `e2e/platform.e2e.ts`   | `tests/content.test.ts`, `tests/progression.test.ts`, `tests/practice.test.ts`, `tests/consent.test.ts`, `tests/ops.test.ts`, `tests/q-budget.test.ts`, `tests/q-provider.test.ts` |
| platform:053   | QZ-30: accessibility and layout across every new surface (390 + 1280)                             | `e2e/platform.e2e.ts`   | —                                                                                                                                                                                  |
| platform:054   | no uncaught client console errors                                                                 | `e2e/platform.e2e.ts`   | —                                                                                                                                                                                  |

## Explorer

| ID           | Scenario                                                                    | Browser evidence      | DB / unit evidence             |
| ------------ | --------------------------------------------------------------------------- | --------------------- | ------------------------------ |
| explorer:008 | X1. an adult turns on Explorer mode; explorers get their own dashboard      | `e2e/explorer.e2e.ts` | `tests/explorer-mode.test.ts`  |
| explorer:009 | X2. guardian areas are closed in the UI, the app API, and Supabase directly | `e2e/explorer.e2e.ts` | `tests/explorer-mode.test.ts`  |
| explorer:010 | X3. play works while locked, start to finish                                | `e2e/explorer.e2e.ts` | `tests/explorer-mode.test.ts`  |
| explorer:011 | X4. the lock survives reloads and new tabs (it isn't client state)          | `e2e/explorer.e2e.ts` | `tests/explorer-mode.test.ts`  |
| explorer:012 | X5. the grown-up unlocks with their password; everything returns            | `e2e/explorer.e2e.ts` | `tests/explorer-mode.test.ts`  |
| explorer:013 | X6. accessibility (axe WCAG 2.2 AA) and no overflow on every new surface    | `e2e/explorer.e2e.ts` | —                              |
| explorer:014 | X7. no uncaught client console errors                                       | `e2e/explorer.e2e.ts` | —                              |
| global:032   | G1. after WorldZone, the family sees aggregate answers from other families  | `e2e/global.e2e.ts`   | `tests/global-connect.test.ts` |
| global:033   | G2. nothing identifies another family, on the page or in the API            | `e2e/global.e2e.ts`   | `tests/global-connect.test.ts` |
| global:034   | G3. the operator kill switch hides comparisons                              | `e2e/global.e2e.ts`   | `tests/global-connect.test.ts` |
| global:035   | G4. accessibility (axe WCAG 2.2 AA) and no overflow                         | `e2e/global.e2e.ts`   | —                              |
| global:036   | G5. no uncaught client console errors                                       | `e2e/global.e2e.ts`   | —                              |

## Guardian

| ID                 | Scenario                                                                   | Browser evidence            | DB / unit evidence              |
| ------------------ | -------------------------------------------------------------------------- | --------------------------- | ------------------------------- |
| family-journey:015 | 1. public landing, auth routes, and health respond without dead links      | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:016 | 2. guardian signup requires email confirmation before login                | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:017 | 3. household, explorers, and permissions persist across reload             | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:018 | 4. explorer edit, archive excludes from play, restore returns              | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:019 | 5. QuickZone game night: lobby → active → answers → persisted results      | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:020 | 5b. QuickZone bonuses are server-scored and Play again opens a new lobby   | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:021 | 6. client-supplied scores and replays are rejected by the server           | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:022 | 7. Parent Hub reflects real recorded activity                              | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:023 | 8. cross-family isolation via app API and direct Supabase REST             | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:024 | 9. guardian data export is complete and scoped                             | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:025 | 10. responsive layouts at 390 / 1024 / 1440 without horizontal scroll      | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:026 | 11. accessibility: no critical/serious WCAG 2.2 AA violations on key pages | `e2e/family-journey.e2e.ts` | —                               |
| family-journey:027 | 12. keyboard: skip to content and focusable primary navigation             | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:028 | 13. password change re-verifies, then old password stops working           | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:029 | 14. password recovery by email resets the password                         | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:030 | 15. account deletion erases the household and the sign-in                  | `e2e/family-journey.e2e.ts` | `tests/family-controls.test.ts` |
| family-journey:031 | 16. no uncaught client console errors during the journey                   | `e2e/family-journey.e2e.ts` | —                               |

## Family member

| ID          | Scenario                                                                    | Browser evidence     | DB / unit evidence             |
| ----------- | --------------------------------------------------------------------------- | -------------------- | ------------------------------ |
| members:037 | M1. guardian creates a single-use invite code, shown once                   | `e2e/members.e2e.ts` | `tests/family-members.test.ts` |
| members:038 | M2. an adult joins with the code; a wrong code is refused                   | `e2e/members.e2e.ts` | `tests/family-members.test.ts` |
| members:039 | M3. members get no guardian controls, in the UI or the API                  | `e2e/members.e2e.ts` | `tests/family-members.test.ts` |
| members:040 | M4. a member hosts on their own device; both devices see the same live game | `e2e/members.e2e.ts` | `tests/family-members.test.ts` |
| members:041 | M5. removing a member ends their access immediately                         | `e2e/members.e2e.ts` | `tests/family-members.test.ts` |
| members:042 | M6. accessibility (axe WCAG 2.2 AA) and no overflow on every new surface    | `e2e/members.e2e.ts` | —                              |
| members:043 | M7. no uncaught client console errors                                       | `e2e/members.e2e.ts` | —                              |

## Platform

| ID             | Scenario                                                                                        | Browser evidence        | DB / unit evidence                                                            |
| -------------- | ----------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| resilience:055 | 1. reset-password refuses an ordinary signed-in session (recovery link required)                | `e2e/resilience.e2e.ts` | `tests/hardening.test.ts`, `tests/errors.test.ts`, `tests/validation.test.ts` |
| resilience:056 | 2. dropped polls show a reconnect state and recover without losing the session                  | `e2e/resilience.e2e.ts` | `tests/hardening.test.ts`, `tests/errors.test.ts`, `tests/validation.test.ts` |
| resilience:057 | 3. a failed write (503) is surfaced, nothing is saved, and retry succeeds exactly once          | `e2e/resilience.e2e.ts` | `tests/hardening.test.ts`, `tests/errors.test.ts`, `tests/validation.test.ts` |
| resilience:058 | 4. a lost response after the server saved is safe to retry: no duplicate answer or double score | `e2e/resilience.e2e.ts` | `tests/hardening.test.ts`, `tests/errors.test.ts`, `tests/validation.test.ts` |
| resilience:059 | 5. database internals are not leaked in API errors                                              | `e2e/resilience.e2e.ts` | `tests/hardening.test.ts`, `tests/errors.test.ts`, `tests/validation.test.ts` |
| resilience:060 | 6. password re-verification is rate limited (10 per 15 minutes)                                 | `e2e/resilience.e2e.ts` | `tests/hardening.test.ts`, `tests/errors.test.ts`, `tests/validation.test.ts` |
| resilience:061 | 7. draft challenge titles are hidden from guardians end-to-end                                  | `e2e/resilience.e2e.ts` | `tests/hardening.test.ts`, `tests/errors.test.ts`, `tests/validation.test.ts` |
| db:090         | Every post-pilot migration rolls back and forward cleanly                                       | —                       | `tests/rollback.test.ts`                                                      |
| db:091         | Dependency tooling and audit facade behave as specified                                         | —                       | `tests/tooling.test.ts`                                                       |
| db:092         | PRD levels are computed only from recorded XP                                                   | —                       | `tests/progress.test.ts`                                                      |
| db:093         | The scenario catalog stays in sync with every automated test                                    | —                       | `tests/scenarios.test.ts`                                                     |

## Moderator / guardian

| ID                   | Scenario                                                                                                                 | Browser evidence              | DB / unit evidence       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ------------------------ |
| safezone-journey:062 | 1. SafeZone is closed to families until an operator enables it                                                           | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:063 | 2. only an operator-granted moderator gets the console; moderator drafts and publishes a town hall                       | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:064 | 3. guardian enables SafeZone and gives per-session consent with their password; age band enforced                        | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:065 | 4. second household registers; consent API without a password is refused                                                 | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:066 | 5. cross-family isolation: room, REST, and API refuse the other household's explorer                                     | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:067 | 6. explorers wait until the moderator opens and starts the room                                                          | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:068 | 6b. a dropped room connection shows Reconnecting… and recovers in place                                                  | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:069 | 7. raise hand → moderator grants the turn → statement shared → held for approval → visible to peers by session name only | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:070 | 8. questions are anonymous to peers                                                                                      | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:071 | 9. polls: one vote per explorer; results only after closing                                                              | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:072 | 10. reports reach the safeguarding queue and the decision is recorded                                                    | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:073 | 11. moderator removes a participant with a reason; their guardian is notified                                            | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:074 | 12. idea support, completion, and a privacy-safe summary                                                                 | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:075 | 12b. one journey: Parent Hub and the family data export include SafeZone activity                                        | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:076 | 13. responsive and accessible: lobby, room, and console at 390 / 1024 / 1280                                             | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:077 | 13b. keyboard: every Tab stop in the moderator console is visible and focus is never lost                                | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:078 | 14. withdrawing consent removes the explorer's contributions from the record                                             | `e2e/safezone-journey.e2e.ts` | `tests/safezone.test.ts` |
| safezone-journey:079 | 15. no uncaught client console errors                                                                                    | `e2e/safezone-journey.e2e.ts` | —                        |

## Explorer / guardian

| ID        | Scenario                                                                                          | Browser evidence   | DB / unit evidence                                                                      |
| --------- | ------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------- |
| zones:080 | 1. SolveZone: budget guard on client and server, saved plan, events, completion                   | `e2e/zones.e2e.ts` | `tests/database.test.ts`, `tests/zone-flags.test.ts`, `tests/quickzone-scoring.test.ts` |
| zones:081 | 2. BuildZone: costed blueprint, overspend refused, design saved, pitch steps complete             | `e2e/zones.e2e.ts` | `tests/database.test.ts`, `tests/zone-flags.test.ts`, `tests/quickzone-scoring.test.ts` |
| zones:082 | 3. DebateZone: six fixed stages, no free-text field anywhere, completion                          | `e2e/zones.e2e.ts` | `tests/database.test.ts`, `tests/zone-flags.test.ts`, `tests/quickzone-scoring.test.ts` |
| zones:083 | 4. Q hints: off by default, guardian enables, hint logged in Parent Hub, operator pause respected | `e2e/zones.e2e.ts` | `tests/database.test.ts`, `tests/zone-flags.test.ts`, `tests/quickzone-scoring.test.ts` |
| zones:084 | 5. game report → admin review → guardian sees the decision                                        | `e2e/zones.e2e.ts` | `tests/database.test.ts`, `tests/zone-flags.test.ts`, `tests/quickzone-scoring.test.ts` |
| zones:085 | 6. CMS: admin draft is invisible and unplayable until age review + publish                        | `e2e/zones.e2e.ts` | `tests/database.test.ts`, `tests/zone-flags.test.ts`, `tests/quickzone-scoring.test.ts` |
| zones:086 | 7. WorldZone: permission gate, completion, household-private passport stamp                       | `e2e/zones.e2e.ts` | `tests/database.test.ts`, `tests/zone-flags.test.ts`, `tests/quickzone-scoring.test.ts` |
| zones:087 | 8. operator kill switch: a paused zone is shown as paused and refused by the server               | `e2e/zones.e2e.ts` | `tests/database.test.ts`, `tests/zone-flags.test.ts`, `tests/quickzone-scoring.test.ts` |
| zones:088 | 9. accessibility and layout across every zone surface (390 + 1280)                                | `e2e/zones.e2e.ts` | —                                                                                       |
| zones:089 | 10. no uncaught client console errors                                                             | `e2e/zones.e2e.ts` | —                                                                                       |

## Admin

| ID            | Scenario                                                                       | Browser evidence       | DB / unit evidence          |
| ------------- | ------------------------------------------------------------------------------ | ---------------------- | --------------------------- |
| workflows:094 | W1. the console lists every workflow with its live version, trigger, and steps | `e2e/workflows.e2e.ts` | `tests/workflow-os.test.ts` |
| workflows:095 | W2. a completed game runs the badge workflow end to end, with a step log       | `e2e/workflows.e2e.ts` | `tests/workflow-os.test.ts` |
| workflows:096 | W3. pausing a workflow queues its runs; resuming and ticking delivers them     | `e2e/workflows.e2e.ts` | `tests/workflow-os.test.ts` |
| workflows:097 | W4. a dead-letter run can be retried from the console                          | `e2e/workflows.e2e.ts` | `tests/workflow-os.test.ts` |
| workflows:098 | W5. guardians can't see or steer workflows                                     | `e2e/workflows.e2e.ts` | `tests/workflow-os.test.ts` |
| workflows:099 | W6. pg_cron runs the runtime every minute on the real stack                    | `e2e/workflows.e2e.ts` | `tests/workflow-os.test.ts` |
| workflows:100 | W7. accessibility (axe WCAG 2.2 AA) and no overflow                            | `e2e/workflows.e2e.ts` | —                           |
| workflows:101 | W8. no uncaught client console errors                                          | `e2e/workflows.e2e.ts` | —                           |
