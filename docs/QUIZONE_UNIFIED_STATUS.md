# QuiZone AI — unified status and batch log

**Branch:** `claude/gracious-bohr-a6k3nv` (draft PR [olu3242/QuiZone-AI#2](https://github.com/olu3242/QuiZone-AI/pull/2), stacked on PR #1).
**Reconciliation (QZ-11):** PR #1's head `73bc00e` is a direct ancestor of this branch. PR #1 has 0 commits PR #2 lacks; `main` has 0 commits beyond either; one worktree, clean. Nothing needed merging. **The unified application baseline is PR #2's head.**

| Batch                       | Commit               | Outcome                                                                                                                                                   |
| --------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QZ-01 Deployment blockers   | `e86dce1`            | Next.js RCE patched; CI audit gate restored                                                                                                               |
| QZ-02 Guardian data rights  | `2063b92`            | Explorer edit/archive/delete, export, password, sign-out-all, deletion                                                                                    |
| QZ-09 E2E + accessibility   | `e0820c6`            | Real-stack browser suite; 22 contrast fixes; overflow fix                                                                                                 |
| QZ-03 QuickZone             | `e8562b4`            | Speed/streak scoring; play again                                                                                                                          |
| Docs                        | `1116918`            | QZ certification docs                                                                                                                                     |
| SafeZone MVP                | `088b231`            | Moderated card-only town halls behind a flag                                                                                                              |
| SafeZone docs               | `59ee8a5`            | Spec, safety review, evidence                                                                                                                             |
| QZ-04 Security hardening    | `f01e035`            | Recovery-only reset; DB rate limits; error contract; rollback scripts; resilience/keyboard E2E                                                            |
| QZ-17 SafeZone integration  | `67577a0`            | Export v2 includes SafeZone; Parent Hub SafeZone oversight                                                                                                |
| Docs                        | `0e7f633`            | SZ-11–20 certification set; unified product docs                                                                                                          |
| QZ-06 Zone journeys + flags | `3eabfb4`            | Browser E2E for SolveZone, BuildZone, DebateZone, WorldZone, Q hints, report → admin review, CMS publish; operator kill switch per zone; 3 contrast fixes |
| QZ-21 Content metadata      | `d551737`            | Subject + difficulty, filters, admin metadata editor                                                                                                      |
| QZ-22 CMS authoring         | `44c8112`, `98aae7a` | Multi-step drafts, new versions, auto-retire on publish, retirement; fixed silent draft-step delete and a runtime array bug                               |
| QZ-23 Quality gate          | `bf35337`            | Publish refused in the database while quality issues remain                                                                                               |
| QZ-24 Levels + badges       | `e30d4e9`            | PRD levels; 9 child + 3 family badges from recorded activity only                                                                                         |
| QZ-25 Practice mode         | `3518a54`            | Real play, no XP/badges/stamps (triggers drop the progression rows)                                                                                       |
| QZ-26 Parent Hub progress   | `6dc978b`            | Per-explorer progress; history paginated beyond 100 via `/api/history`                                                                                    |
| QZ-27 Consent versioning    | `58b2f0d`            | Versioned consent, records, re-consent gate, banner, history, export                                                                                      |
| QZ-28 Operations overview   | `bb9fdd8`            | Staff-only aggregates (no personal data)                                                                                                                  |
| QZ-29 Q hint budget         | `7e6a3df`            | Guardian daily limit, attributable usage, displayed and enforced                                                                                          |
| QZ-30 Certification         | see `git log`        | `e2e/platform` suite (11); 2 app bugs fixed (history cursor, export ordering); 63/63 browser, 111/111 unit/DB                                             |
| QZ-31 Family members        | see `git log`        | Guardian-issued single-use invite codes (hash-only, 72h); members host and play on their own device; lobby presence; guardian-only areas refused in UI, API, DB |
| QZ-32 Explorer mode         | see `git log`        | Server-side shared-screen lock bound to the Auth session; play only; guardian oversight data unreadable via RLS; password unlock; explorer dashboard |
| QZ-33 Global Connect        | see `git log`        | Aggregate WorldZone answer distributions across households, k ≥ 5, one vote per household, no identities; kill switch `global_compare` |
| QZ-34 Q provider boundary   | see `git log`        | Claude adapter (official SDK) for admin hint *suggestions* only; screened, rate-limited, audited; flag `q_live` off; never shown to a child unreviewed |

## Unified roadmap: where each requested batch stands

| Requested                          | State                                                   | Note                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QZ-11 Reconciliation               | **Done**                                                | See above                                                                                                                                                             |
| QZ-12 Shared identity              | **Done: guardian, family member, staff**                | Children have no accounts by design; the shared screen uses Explorer mode (QZ-32). Educator: PRD §2 non-goal for the pilot                                          |
| QZ-13 Unified dashboards           | **Done for pilot roles**                                | Guardian Home/Parent Hub, member Family view, Explorer-mode dashboard, moderator console, admin CMS + operations overview                                            |
| QZ-14 QuizZone                     | **Verified**                                            | Subject/difficulty filters, CMS-authored content, practice mode, badges (QZ-21–25). Adaptive/AI generation needs the provider decision                                |
| QZ-15 BuildZone / QZ-16 DebateZone | **Verified** (pilot scope)                              | Browser journeys pass (zones 2–3); portfolio and AI feedback pending                                                                                                  |
| QZ-17 SafeZone                     | **Verified locally, integrated**                        | Hosted blocked                                                                                                                                                        |
| QZ-18 Game Night                   | **Verified, multi-device**                              | Invited adults join on their own devices; state polls every 5s with a newest-response guard; lobby shows who has the game open                                     |
| QZ-19 Global Connect               | **Verified (aggregate, k ≥ 5)**                         | Cross-household answer distributions only. Free-text cross-household submissions stay out (`FAMILY.md` §2–3). International privacy review still required before real children |
| QZ-20 Unified certification        | **Local PASS; hosted BLOCKED**                          | `QUIZONE_E2E_RESULTS.md`                                                                                                                                              |

## Decisions taken under `/goal` (owner can reverse)

- **Family members:** adults invited by the guardian with single-use, 72-hour codes (only a SHA-256 hash is stored, at most 3 outstanding, at most 4 members). Members host and play; the guardian alone manages explorers, permissions, consent, hint limits, SafeZone, invitations, export, and deletion.
- **Child sign-in:** none. Explorer mode locks the signed-in adult's session on the shared screen. The lock is a row keyed by the JWT `session_id`, so no client state can remove it; unlocking re-authenticates with the password, which mints a new session.
- **Global Connect:** aggregates only, shown once at least five households answered a step; each household counts once; practice rounds excluded.
- **AI provider (changed from the announced default):** the Claude adapter writes *suggestions for content authors*, not live hints for children. Reason: `FAMILY.md` §5 requires that what a child sees is logged for moderators. With no service-role writer, the server can't prove to the database that logged text came from the model; a client could forge its own family's log. Live child-facing generation needs a trusted server-side writer (for example an Edge Function holding a signing secret) and a safeguarding review first.
- **Educator Hub:** not built. PRD §2 lists Teacher as post-MVP.

## Recommended next batch

- Hosted UAT once an environment is authorized (all suites run unchanged against it).
- A trusted server-side writer for Q output, then the safeguarding review, before any live child-facing Q.
- Manual screen-reader pass across the new surfaces (Explorer dashboard, member Family view, Global Connect bars).

