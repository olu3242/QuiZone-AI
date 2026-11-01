# QuiZone feature matrix (2026-11-01)

Legend — **VERIFIED**: automated test passed this session on a real Supabase stack (browser E2E and/or DB suite). **UNVERIFIED**: implemented, DB/unit tested only, no browser journey. **PARTIAL**: some of the requested scope exists. **NOT IMPL**: absent. **BLOCKED**: needs an external decision/credential.
"Hosted" status is BLOCKED for every row until hosted UAT runs.

## A. Identity & family

| Feature                                        | Status               | Evidence / note                                                                            |
| ---------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| Guardian signup + email confirmation           | VERIFIED             | E2E 2 (login refused before confirm; Mailpit link → PKCE callback)                         |
| Login / session refresh / sign out             | VERIFIED             | E2E 2, 13; `proxy.ts` refresh                                                              |
| Password recovery by email                     | VERIFIED             | E2E 14                                                                                     |
| Password change (re-verifies current)          | VERIFIED             | E2E 13 (wrong current rejected, old password stops working)                                |
| Sign out all devices                           | VERIFIED             | E2E 13                                                                                     |
| Household + consent                            | VERIFIED             | E2E 3; DB tests                                                                            |
| Child profiles (nickname/age/avatar/interest)  | VERIFIED             | E2E 3                                                                                      |
| Child edit / archive / restore / delete        | VERIFIED             | E2E 4; `family-controls.test.ts` (8 tests)                                                 |
| Data export (JSON)                             | VERIFIED             | E2E 9 (scoped, audited, 401 unauthenticated)                                               |
| Account deletion                               | VERIFIED             | E2E 15 (identity removed, other household untouched)                                       |
| Children cannot gain guardian privileges       | VERIFIED (by design) | Children have no credentials; every mutation requires a confirmed guardian JWT + ownership |
| Family-member (non-guardian adult) invitations | NOT IMPL             | Requires `household_members` role model — next batch                                       |
| Age-appropriate permissions                    | PARTIAL              | Server age-band eligibility (8–17) + WorldZone/Q toggles; age bands not product-approved   |
| Verified parental consent (COPPA-grade)        | BLOCKED              | Legal/program decision                                                                     |

## B. Family Game Night

| Feature                                                        | Status     | Evidence / note                                                                        |
| -------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| Game creation, lobby → ready → active → complete               | VERIFIED   | E2E 5                                                                                  |
| Answer submission, server scoring, results persisted on reload | VERIFIED   | E2E 5, 5b                                                                              |
| Replay / forged-score rejection                                | VERIFIED   | E2E 6; DB tests                                                                        |
| Pause / resume / cancel / expiry                               | UNVERIFIED | DB tests only                                                                          |
| Session history                                                | PARTIAL    | Parent Hub lists sessions (E2E 7); no pagination                                       |
| Play again (rematch)                                           | VERIFIED   | E2E 5b                                                                                 |
| Reconnection / recovery                                        | PARTIAL    | 5s polling + "Reconnect"; reload resumes from server state (E2E 5). No presence states |
| Multi-device multiplayer sync                                  | NOT IMPL   | Shared-screen model only; needs member accounts + Realtime                             |
| Family invitations                                             | NOT IMPL   | See A                                                                                  |
| Family achievements                                            | PARTIAL    | XP/skills/passport per child; no badge model                                           |

## C. QuizZone (QuickZone)

| Feature                                     | Status   | Evidence / note                                       |
| ------------------------------------------- | -------- | ----------------------------------------------------- |
| Quiz selection + mode filter                | VERIFIED | E2E 4–5                                               |
| Answer evaluation + explanation             | VERIFIED | E2E 5                                                 |
| Speed + streak scoring (server clock)       | VERIFIED | `quickzone-scoring.test.ts`; E2E 5b total = Σ answers |
| Subject / difficulty filters                | NOT IMPL | No subject/difficulty columns yet                     |
| AI question generation + quality validation | NOT IMPL | No provider chosen (PRD §21)                          |
| Progress tracking                           | PARTIAL  | Per-child XP + skill events                           |
| Practice mode                               | PARTIAL  | Play again; no unscored practice                      |

## D. BuildZone · E. DebateZone

| Feature                                                      | Status     | Evidence / note                                                               |
| ------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------- |
| BuildZone costed blueprint, server budget check, pitch steps | UNVERIFIED | DB tests (overspend rejected); no browser journey                             |
| BuildZone free-text pitch, media, educator review, portfolio | NOT IMPL   |                                                                               |
| AI feedback (Build/Debate)                                   | NOT IMPL   |                                                                               |
| DebateZone six fixed stages, assigned position               | UNVERIFIED | DB tests                                                                      |
| Debate history                                               | PARTIAL    | Answers saved per session                                                     |
| Safe moderation                                              | PARTIAL    | Reports + staff review exist; no content to moderate (no free text by design) |

## F. Global Learning Network

| Feature                                                                     | Status                     | Evidence / note                                         |
| --------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------- |
| Guardian-gated WorldZone                                                    | UNVERIFIED                 | DB test (denied until enabled)                          |
| Country challenge + private passport stamp                                  | UNVERIFIED                 | DB test                                                 |
| Abuse reporting                                                             | UNVERIFIED                 | DB tests (idempotent cases, audited review)             |
| No child-to-stranger messaging                                              | VERIFIED (by construction) | No messaging table, endpoint, or free-text field exists |
| Peer matching, supervised collaboration, cross-family submissions, blocking | NOT IMPL                   | Needs moderated async design + legal review             |

## G. AI Learning Companion (Q)

| Feature                                                                       | Status     | Evidence / note                                             |
| ----------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| Curated hints, permission-gated, 10/session cap, logged                       | UNVERIFIED | DB tests                                                    |
| Live-model assistance, recommendations, generation, moderation, cost controls | BLOCKED    | Provider not chosen; no key; server-only interface required |

## H. Guardian dashboard · I. Educator/admin

| Feature                                                 | Status            | Evidence / note                                                      |
| ------------------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| Parent Hub: sessions, answers, hints, reports, schedule | VERIFIED (render) | E2E 7                                                                |
| Consent management                                      | PARTIAL           | Permissions + delete/export; no consent versioning/withdrawal record |
| Safety notifications                                    | NOT IMPL          |                                                                      |
| Admin: draft → age review → publish                     | UNVERIFIED        | DB tests                                                             |
| Moderation queue + audited decisions                    | UNVERIFIED        | DB tests                                                             |
| Educator classes/assignments/reporting                  | NOT IMPL          | PRD marks Teacher as post-MVP                                        |

## J. SafeZone (youth town halls)

Full map in `SAFEZONE_EVIDENCE.md`. All rows are behind the off-by-default `safezone` flag.

| Feature                                                                  | Status   | Evidence                                       |
| ------------------------------------------------------------------------ | -------- | ---------------------------------------------- |
| Lobby, topics, upcoming, history, safety info                            | VERIFIED | SafeZone E2E 1–3, 14                           |
| Guardian consent per session (password + DB `amr` check), withdrawal     | VERIFIED | E2E 3, 4, 14; DB tests                         |
| Moderator scheduling, lifecycle, assignment                              | VERIFIED | E2E 2, 6; DB tests                             |
| Raise hand, speaking turns, card contributions, pre-publication approval | VERIFIED | E2E 7, 8                                       |
| Polls (one vote per explorer, hidden results until closed)               | VERIFIED | E2E 9                                          |
| Reports, removal, emergency closure, guardian notifications              | VERIFIED | E2E 10, 11; DB                                 |
| Free-text contributions                                                  | BLOCKED  | `FAMILY.md` §2 conflict (owner decision)       |
| AI facilitator, impact tracker                                           | NOT IMPL | Provider not chosen; no post-session lifecycle |
| Verified parental consent, moderator vetting                             | BLOCKED  | Legal/operational                              |

## Cross-cutting

| Feature                                             | Status               | Evidence                                                      |
| --------------------------------------------------- | -------------------- | ------------------------------------------------------------- |
| Cross-family isolation (app API + direct PostgREST) | VERIFIED             | E2E 8                                                         |
| RLS on every user-data table                        | VERIFIED             | DB test + local stack check                                   |
| Responsive 390/1024/1440                            | VERIFIED             | E2E 10                                                        |
| WCAG 2.2 AA (axe serious/critical)                  | VERIFIED (automated) | E2E 11; manual screen-reader pass not done                    |
| Keyboard focus                                      | PARTIAL              | E2E 12 (first focus + indicator); full traversal not scripted |
