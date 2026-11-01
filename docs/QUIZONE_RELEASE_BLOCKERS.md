# QuiZone AI — release blockers (owner actions)

Engineering can't close these. Each one names the action that unblocks it.

| #   | Blocker                                                                                | Blocks                                     | Action needed                                                                                                                             |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | UAT Supabase project not authorized: the connector is denied on `orjremljufkflomsjelr` | All hosted certification                   | Confirm that project (or create an empty one) and grant the Supabase connector access to its org; approve applying the 5 migrations to it |
| 2   | Vercel connector gets 404/403 on `qui-zone-ai` env vars and deployments                | Preview configuration evidence             | Grant project read access; set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` for Preview     |
| 3   | `main` has no app; PRs #1 → #2 unmerged                                                | Any deployment from `main`                 | Review, then merge #2 into #1, then #1 into `main` (your approval)                                                                        |
| 4   | Custom SMTP and a test inbox                                                           | Hosted signup/recovery E2E                 | Configure SMTP on UAT; choose a test-inbox service                                                                                        |
| 5   | Verifiable parental consent and approved age bands                                     | Real children (all zones)                  | Legal decision                                                                                                                            |
| 6   | Moderator program (vetting, training, two-adult rule)                                  | Real children in SafeZone                  | Operational decision                                                                                                                      |
| 7   | Retention schedule; safety records on account deletion                                 | Real children                              | Legal decision                                                                                                                            |
| 8   | AI provider for Q                                                                      | AI companion, quiz generation, AI feedback | Choose a provider; supply a server-only key through env (never in chat)                                                                   |
| 9   | Product decisions: child sign-in model, family-member invitations, Educator Hub timing | QZ-05 onward                               | See `QUIZONE_MASTER_ARCHITECTURE.md` decisions table                                                                                      |

Decided: **SafeZone stays card-only** (2026-11-01).
