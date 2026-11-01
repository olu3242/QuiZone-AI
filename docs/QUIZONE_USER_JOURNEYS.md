# QuiZone AI — user journeys

All journeys use one guardian account and shared child profiles. **E2E** refers to `e2e/*.e2e.ts` step numbers: **F** family, **R** resilience, **S** SafeZone.

## Guardian (the account holder)

| Step | Experience                                                                                                     | Status   | Evidence               |
| ---- | -------------------------------------------------------------------------------------------------------------- | -------- | ---------------------- |
| 1    | Sign up → confirm email → log in                                                                               | VERIFIED | F2                     |
| 2    | Create household with consent → add explorers                                                                  | VERIFIED | F3                     |
| 3    | Set permissions (World, Q hints, session limit)                                                                | VERIFIED | F3                     |
| 4    | Edit, archive, restore, delete an explorer                                                                     | VERIFIED | F4; DB family-controls |
| 5    | Host a game night: choose challenge → players → lobby → play → results → play again                            | VERIFIED | F5, F5b                |
| 6    | Turn on SafeZone (password) → approve an explorer per town hall (password)                                     | VERIFIED | S3, S4                 |
| 7    | Watch oversight in the Parent Hub: sessions, answers, hints, reports, SafeZone participation and notifications | VERIFIED | F7, S12b               |
| 8    | Withdraw consent / turn SafeZone off                                                                           | VERIFIED | S14; DB safezone       |
| 9    | Export all family data (every zone)                                                                            | VERIFIED | F9, S12b               |
| 10   | Change password, sign out everywhere, recover a password, delete the account                                   | VERIFIED | F13–F15, R1            |

## Explorer (child, using the guardian's screen)

| Step | Experience                                                                                                          | Status                                 | Evidence        |
| ---- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------- |
| 1    | Pick an adventure with the family; answer, plan, build, or debate with structured choices                           | VERIFIED (Quick); DB-VERIFIED (others) | F5; DB database |
| 2    | See XP, skills, and passport stamps                                                                                 | VERIFIED (render)                      | F10, F11        |
| 3    | Join an approved town hall under a session name; raise a hand; share cards when given a turn; ask anonymously; vote | VERIFIED                               | S6–S9           |
| 4    | Report something that feels wrong                                                                                   | VERIFIED                               | S10             |
| 5    | Recover from a dropped connection without losing their place                                                        | VERIFIED                               | R2, S6b         |

## Moderator (staff)

| Step | Experience                                                                 | Status   | Evidence            |
| ---- | -------------------------------------------------------------------------- | -------- | ------------------- |
| 1    | Operator grants the role → console appears                                 | VERIFIED | S2                  |
| 2    | Draft a town hall with cards → publish → open → start                      | VERIFIED | S2, S6              |
| 3    | Run turns, approve cards, run polls, remove with a reason, emergency close | VERIFIED | S7–S11; DB safezone |
| 4    | Work the safeguarding queue with staff-only notes                          | VERIFIED | S10                 |

## Admin (staff)

| Step | Experience                                                    | Status      | Evidence      |
| ---- | ------------------------------------------------------------- | ----------- | ------------- |
| 1    | Draft a challenge → explicit age review → publish (immutable) | DB-VERIFIED | DB database   |
| 2    | Review game safety reports with an audited history            | DB-VERIFIED | DB database   |
| 3    | Assign SafeZone moderators                                    | DB-VERIFIED | DB safezone 2 |

## Added in QZ-31–38

| Journey                                                                                                                                        | Evidence                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Family member: join with a guardian's code → host and play on their own device → see live state from another device → lose access when removed | E2E members M1–M5                     |
| Explorer mode: an adult locks the shared screen → explorer dashboard → play only → adult unlocks with a password                               | E2E explorer X1–X5                    |
| Global Connect: after WorldZone, see how other families answered (aggregates, k ≥ 5)                                                           | E2E global G1–G3                      |
| Guardian: family inbox (badges, report reviews, members, consent updates, game-night reminders), mark read                                     | E2E automation A3–A4                  |
| Explorer: "Our designs" portfolio in the Passport                                                                                              | E2E automation A5                     |
| Admin: author challenges in every zone (incl. WorldZone country), run maintenance, review Q suggestions                                        | E2E automation A1, A4; platform QZ-34 |

Every journey step maps to automated evidence in `QUIZONE_SCENARIOS.md` (validated by `tests/scenarios.test.ts`).

## Not yet available

- Educator journeys (post-MVP per PRD)
- Live child-facing Q (needs a trusted server-side writer and a safeguarding review)
