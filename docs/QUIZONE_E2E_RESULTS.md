# QuiZone AI — E2E results (latest run)

**Run:** 2026-11-01. Fresh `supabase db reset --local` with all 5 migrations. Production build of the branch at `67577a0`. Chromium (Playwright 1.63.0) and axe-core 4.10.3. Synthetic accounts only. Method and reproduction: `QUIZONE_E2E_CERTIFICATION.md`.

| Suite                                            | Pass              | Fail | Skip | Blocked                             |
| ------------------------------------------------ | ----------------- | ---- | ---- | ----------------------------------- |
| Unit + PGlite DB (`npm test`, 9 files)           | **75**            | 0    | 0    | 0                                   |
| Browser: family (`e2e/family-journey`)           | **17**            | 0    | 0    | 0                                   |
| Browser: resilience (`e2e/resilience`)           | **7**             | 0    | 0    | 0                                   |
| Browser: SafeZone (`e2e/safezone-journey`)       | **18**            | 0    | 0    | 0                                   |
| plpgsql_check (`supabase db lint --level error`) | 0 errors          |      |      |                                     |
| `npm audit` (full tree, `--audit-level=low`)     | 0 vulnerabilities |      |      |                                     |
| Hosted UAT                                       | 0                 | 0    | 0    | **all** (no authorized environment) |

Unit/DB breakdown: database 22 · safezone 17 · family-controls 8 · validation 8 · hardening 6 · quickzone-scoring 4 · rollback 4 · tooling 4 · errors 2.

## Requested certification journeys

| #   | Journey                     | Result                                                              |
| --- | --------------------------- | ------------------------------------------------------------------- |
| 1   | Guardian registration       | PASS (F2)                                                           |
| 2   | Child profile creation      | PASS (F3, F4)                                                       |
| 3   | Guardian consent            | PASS (F3; S3, S4)                                                   |
| 4   | Quiz completion             | PASS (F5, F5b)                                                      |
| 5   | BuildZone                   | DB-only PASS; **no browser journey yet**                            |
| 6   | DebateZone                  | DB-only PASS; **no browser journey yet**                            |
| 7   | Family Game Night           | PASS shared-screen (F5); multi-device **NOT IMPL**                  |
| 8   | SafeZone town hall          | PASS (S1–S14)                                                       |
| 9   | Global collaboration        | DB-only PASS (WorldZone gate); cross-household **NOT IMPL**         |
| 10  | Learning progress reporting | PASS (F7, S12b)                                                     |
| 11  | Safety reporting            | PASS (S10, S11); game-side DB-only                                  |
| 12  | Consent withdrawal          | PASS (S14)                                                          |
| 13  | Cross-family isolation      | PASS (F8, S5: app API + direct PostgREST)                           |
| 14  | Responsive mobile           | PASS (F10, S13 at 390/1024/1280–1440)                               |
| 15  | Accessibility               | PASS automated (F11, F12, S13, S13b); manual screen reader **open** |
| +   | API failure & retry         | PASS (R2–R5, S6b)                                                   |

## Defects found by these suites and fixed (all sessions)

22 contrast failures; hero overflow; mobile-nav contrast at 390px; agenda label contrast; no visible focus on one date-input stop; a removed explorer was shown the wrong message; report notes were visible to families; no post-session withdrawal; export omitted SafeZone; moderators saw a family set-up prompt.
