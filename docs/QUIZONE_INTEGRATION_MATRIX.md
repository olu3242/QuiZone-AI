# QuiZone AI — integration matrix (shared services × modules)

✅ integrated and tested · ◐ integrated, browser-untested · — not applicable · ✗ gap

| Shared service                  | QuizZone | BuildZone | DebateZone | SafeZone                                      | Game Night | Global Connect | Q     |
| ------------------------------- | -------- | --------- | ---------- | --------------------------------------------- | ---------- | -------------- | ----- |
| Guardian identity (one account) | ✅       | ✅        | ✅         | ✅                                            | ✅         | ✅             | ✅    |
| Shared child profile            | ✅       | ✅        | ✅         | ✅                                            | ✅         | ✅             | ✅    |
| Archived explorers excluded     | ✅       | ✅        | ✅         | ✅                                            | ✅         | ✅             | —     |
| Age eligibility (server)        | ✅       | ◐         | ◐          | ✅                                            | ✅         | ◐              | —     |
| Guardian permission gate        | —        | —         | —          | ✅                                            | —          | ◐ (World)      | ◐ (Q) |
| Household isolation (RLS + API) | ✅       | ◐         | ◐          | ✅                                            | ✅         | ◐              | ◐     |
| Server-authoritative scoring    | ✅       | ◐         | ◐          | —                                             | ✅         | ◐              | —     |
| XP / skills / passport          | ✅       | ◐         | ◐          | ✗ (participation shown in Parent Hub, not XP) | ✅         | ◐              | —     |
| Parent Hub oversight            | ✅       | ◐         | ◐          | ✅                                            | ✅         | ◐              | ◐     |
| Reporting & moderation          | ✅       | ◐         | ◐          | ✅                                            | ✅         | ◐              | —     |
| Audit trail                     | ✅       | ✅        | ✅         | ✅                                            | ✅         | ✅             | ✅    |
| Rate limits                     | ✅       | ✅        | ✅         | ✅                                            | ✅         | ✅             | ✅    |
| Data export                     | ✅       | ✅        | ✅         | ✅ (v2)                                       | ✅         | ✅             | ✅    |
| Cascade deletion                | ✅       | ✅        | ✅         | ✅                                            | ✅         | ✅             | ✅    |
| Feature flag                    | —        | —         | —          | ✅                                            | —          | ✗              | ✗     |

## Open integration gaps

1. Browser journeys for BuildZone, DebateZone, Global Connect, Q, and the game-side report → staff review flow (all ◐). These are the cheapest way to turn ◐ into ✅.
2. SafeZone participation doesn't award XP or skills. This is deliberate for now: rewarding volume in a civic space could encourage low-quality participation. Needs a product decision on what, if anything, to recognize.
3. Global Connect and Q aren't behind feature flags, although both are partial.
