# SafeZone — implementation evidence (QZ-SZ-01…10)

Branch `claude/gracious-bohr-a6k3nv`. Commit `088b231` (code) plus this documentation commit. Draft PR [olu3242/QuiZone-AI#2](https://github.com/olu3242/QuiZone-AI/pull/2).

## Batch results

| Batch                  | Acceptance                              | Result                             | Evidence                                                                                                                                        |
| ---------------------- | --------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| SZ-01 Audit            | Baseline identified                     | **Done**                           | `main` = config shell; app = PR #1 branch + this branch (see `QUIZONE_CURRENT_STATE.md`). No SafeZone code existed anywhere.                    |
| SZ-02 Schema           | Migrations, constraints, RLS tests pass | **Pass**                           | Applied to Supabase Postgres 17 (CLI stack) and PGlite; plpgsql_check 0 errors; 16 DB tests                                                     |
| SZ-03 Guardian consent | Only approved children register         | **Pass**                           | DB: permission, consent, stale/fresh `amr`, age, archived, foreign child. E2E 3–4: wrong password refused; consent API without password refused |
| SZ-04 Hall creation    | Authorized moderators schedule          | **Pass**                           | DB: non-staff refused, other moderator refused, admin assignment. E2E 2: role granted by operator before the console appears                    |
| SZ-05 Lobby            | Eligible sessions visible               | **Pass**                           | DB: drafts hidden. E2E 1–3: flag-off state, topic filter, age-ineligible explorer disabled with reason                                          |
| SZ-06 Room             | Raise hand + controlled speaking        | **Pass**                           | DB: one speaker, turn required. E2E 6–7 across three browser contexts                                                                           |
| SZ-07 Ideas/questions  | Moderated submissions persist           | **Pass**                           | DB: pending hidden from peers, approval, anonymity, 5s rate limit, de-dupe. E2E 7–8, 12                                                         |
| SZ-08 Polls            | Eligible explorers vote once            | **Pass**                           | DB: draft hidden, one vote, invalid choice, results hidden until closed. E2E 9                                                                  |
| SZ-09 Safety           | Reporting, removal, escalation          | **Pass**                           | DB: removal + notice + incident; emergency close → urgent escalated; report trail; notes staff-only. E2E 10–11                                  |
| SZ-10 Certification    | Full synthetic journey passes           | **Pass (local real stack and CI)** | `npm run test:e2e`: 32/32 (15 SafeZone) on a freshly reset DB. **Hosted: BLOCKED**                                                              |

## Test counts (final run, this session)

| Suite                                                                                                        | Pass                         | Fail | Skip |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------- | ---- | ---- |
| `npm test` (unit + PGlite DB; 7 files)                                                                       | 62                           | 0    | 0    |
| — of which `tests/safezone.test.ts`                                                                          | 16                           | 0    | 0    |
| `npm run test:e2e` (local Supabase CLI stack)                                                                | 32                           | 0    | 0    |
| — of which `e2e/safezone-journey.e2e.ts`                                                                     | 15                           | 0    | 0    |
| axe WCAG 2.2 AA serious/critical (SafeZone lobby, room, console at 390 + 1280; family pages now also at 390) | 0 violations                 |      |      |
| lint / typecheck / build / `npm audit`                                                                       | pass / pass / pass / 0 vulns |      |      |

Defects found and fixed during certification:

- Registration ordering: a removed explorer was told "registration closed" instead of "removed".
- Report notes were readable by the reporting family. Now staff-only.
- No post-session consent withdrawal in the UI. Added.
- Mobile nav contrast at 390px (pre-existing, 3.63:1).
- Agenda label contrast.

## Required-coverage map

| Requirement                         | Covered by                                                                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guardian consent                    | DB 4; E2E 3, 4                                                                                                                                           |
| Session registration                | DB 4, 5; E2E 3, 4                                                                                                                                        |
| Age eligibility                     | DB 4; E2E 3                                                                                                                                              |
| Moderator authorization             | DB 2, 7, 8, 12; E2E 2                                                                                                                                    |
| Raise-hand and speaking permissions | DB 7; E2E 7                                                                                                                                              |
| Moderation before publication       | DB 8; E2E 7, 8                                                                                                                                           |
| Poll and voting integrity           | DB 9; E2E 9                                                                                                                                              |
| Consent withdrawal                  | DB 14; E2E 14                                                                                                                                            |
| Incident reporting                  | DB 11, 12, 15; E2E 10, 11                                                                                                                                |
| Cross-family isolation              | DB 6, 10; E2E 5                                                                                                                                          |
| Session lifecycle and reconnection  | DB 3, 7, 13, 15; E2E 6. The room keeps the last good view and shows "Reconnecting…"; recovery after reload is covered, a forced network-drop test is not |
| Accessibility and mobile usability  | E2E 13                                                                                                                                                   |

## Not done / blocked

- Hosted run (no accessible QuiZone Supabase project; see deployment readiness).
- AI facilitator, impact tracker, free-text contributions (charter decision), two-moderator rule, and a second review before publishing.
- Realtime push: 3-second polling is used, which is acceptable for 30-seat text rooms but not designed for scale.
