# QuiZone AI — integration matrix (shared services × modules)

✅ integrated and browser-tested on a real Supabase stack · ◐ integrated, DB-tested only · — not applicable · ✗ gap

| Shared service                                 | QuizZone                   | SolveZone       | BuildZone       | DebateZone       | SafeZone                                         | Game Night        | WorldZone       | Q hints              |
| ---------------------------------------------- | -------------------------- | --------------- | --------------- | ---------------- | ------------------------------------------------ | ----------------- | --------------- | -------------------- |
| Guardian identity (one account)                | ✅                         | ✅              | ✅              | ✅               | ✅                                               | ✅                | ✅              | ✅                   |
| Shared child profile                           | ✅                         | ✅              | ✅              | ✅               | ✅                                               | ✅                | ✅              | ✅                   |
| Archived explorers excluded                    | ✅                         | ◐               | ◐               | ◐                | ✅                                               | ✅                | ◐               | —                    |
| Age eligibility (server)                       | ✅                         | ◐               | ◐               | ◐                | ✅                                               | ✅                | ◐               | —                    |
| Guardian permission gate                       | —                          | —               | —               | —                | ✅                                               | —                 | ✅              | ✅                   |
| Household isolation (RLS + API)                | ✅                         | ✅              | ✅              | ✅               | ✅                                               | ✅                | ✅              | ✅                   |
| Server-authoritative scoring                   | ✅                         | ✅ (budget)     | ✅ (cost)       | ✅               | —                                                | ✅                | ✅              | —                    |
| XP / skills / passport                         | ✅                         | ✅              | ✅              | ✅               | ✗ (by design; participation shown in Parent Hub) | ✅                | ✅ (stamp)      | —                    |
| Parent Hub oversight                           | ✅                         | ✅              | ✅              | ✅               | ✅                                               | ✅                | ✅              | ✅ (hint log)        |
| Reporting & moderation                         | ✅ (report → admin review) | ✅              | ✅              | ✅               | ✅                                               | ✅                | ✅              | —                    |
| Audit trail                                    | ✅                         | ✅              | ✅              | ✅               | ✅                                               | ✅                | ✅              | ✅                   |
| Rate limits                                    | ✅                         | ✅              | ✅              | ✅               | ✅                                               | ✅                | ✅              | ✅ (+10/session cap) |
| Data export (v2)                               | ✅                         | ✅              | ✅              | ✅               | ✅                                               | ✅                | ✅              | ✅                   |
| Cascade deletion                               | ✅                         | ✅              | ✅              | ✅               | ✅                                               | ✅                | ✅              | ✅                   |
| Operator feature flag                          | ✅ `zone_quick`            | ✅ `zone_solve` | ✅ `zone_build` | ✅ `zone_debate` | ✅ `safezone` (off)                              | ✅ via zone flags | ✅ `zone_world` | ✅ `q_hints`         |
| Content via CMS (draft → age review → publish) | ✅                         | ◐               | ◐               | ◐                | own console                                      | —                 | ◐               | —                    |
| Accessibility (axe AA, 390 + desktop)          | ✅                         | ✅              | ✅              | ✅               | ✅                                               | ✅                | ✅              | ✅                   |

"Server-authoritative" means the client can't change an outcome. SolveZone overspend and BuildZone over-budget designs are refused by the server even when the UI is bypassed (E2E zones 1–2).

## Remaining ◐ (DB-tested, no browser journey)

Archived-explorer and age-band refusals for the non-Quick zones use the same server path that the QuickZone and SafeZone browser tests already cover. A CMS-authored Solve/Build/Debate/World challenge would need multi-step CMS editing (QZ-07) before it can be authored in the UI.
