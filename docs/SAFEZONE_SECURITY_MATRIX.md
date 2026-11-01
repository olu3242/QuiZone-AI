# SafeZone security matrix

Each control is listed with where it's enforced and the test that proves it. **API** means the Next.js route, **DB** means the SQL function, trigger, or constraint, and **RLS** means row-level policy.

## Database certification items (SZ-13)

| Item                        | Control                                                                                                 | Enforced                                | Proven by                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| Guardian–child relationship | A child-scoped command needs this household's active explorer                                           | API `ownsChild` + DB `safezone_command` | DB `safezone` 4, 6, 10; E2E SZ 5                                      |
| Moderator role assignment   | `private.staff`, granted with SQL only; hall-scoped commands need the assigned moderator or an admin    | DB                                      | DB `safezone` 2, 7; E2E SZ 2                                          |
| Town hall access            | Drafts are staff-only; the room needs a registration (or moderator); sanitized reads only               | RLS + definer reads                     | DB `safezone` 3, 6                                                    |
| Registration authorization  | Flag on, household permission, `consent=true`, password `amr` under 5 min, capacity under the hall lock | DB (+ API password check)               | DB `safezone` 4, 5; E2E SZ 3, 4                                       |
| Age eligibility             | `min_age ≤ age ≤ max_age` at registration; archived explorers refused                                   | DB                                      | DB `safezone` 4; E2E SZ 3                                             |
| Household isolation         | Raw rows are household-private; no other household's ids or nicknames in any payload                    | RLS + read shaping                      | DB `safezone` 6, 10; E2E SZ 5 (PostgREST with another guardian's JWT) |
| Report confidentiality      | Reports visible to the reporting household and staff; **notes are staff-only**                          | RLS                                     | DB `safezone` 12                                                      |
| Vote uniqueness             | PK `(poll_id, child_id)`; results hidden until the poll closes                                          | DB constraint                           | DB `safezone` 9; E2E SZ 9                                             |
| Consent withdrawal          | Erases that explorer's votes, marks contributions withdrawn, lowers hands                               | DB `sz_release`                         | DB `safezone` 14; E2E SZ 14                                           |
| Data deletion               | All SafeZone foreign keys cascade on explorer/account deletion                                          | DB constraint                           | DB `safezone` 16, 17                                                  |
| Audit logging               | Every `sz_*` command writes `audit_events`; removal and emergency closure also write an incident        | DB                                      | DB `safezone` 11, 12, 15                                              |

## Platform controls SafeZone relies on (QZ-04)

| Control                                                                    | Enforced                                              | Proven by                            |
| -------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| Rate limits: reauth 10/15 min, export 5/h, commands 300/min                | DB `private.rate_limit` (SQLSTATE `QZ429` → HTTP 429) | DB `hardening` 1–4; E2E resilience 6 |
| Stable error contract, no internals leaked                                 | API `lib/errors.ts`                                   | unit `errors`; E2E resilience 5      |
| Password reset only from a recovery session (`amr=recovery`, under 15 min) | API `/api/auth`                                       | E2E resilience 1                     |
| Same-origin check on every mutating route                                  | API `sameOrigin`                                      | existing route tests                 |
| No service-role key anywhere                                               | Code review: `grep` finds none                        | —                                    |

## Known residual risks

| Risk                                                                           | Severity | Mitigation / owner                                                                                      |
| ------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| For 5 minutes after consent, the signed-in device can register more sessions   | Low      | Shorten the window or require a password per registration (product decision)                            |
| A failed command rolls back its own rate-limit hit, so failures aren't metered | Low      | Failures are cheap and still authorization-checked. Add an IP limit at the edge (Vercel WAF) for hosted |
| Small rooms make it easier to guess who is behind a pseudonym                  | Low      | Set a minimum-capacity policy (safeguarding)                                                            |
| A single moderator can publish a hall                                          | Medium   | Two-person review before publishing (`SAFEZONE_SAFEGUARDING_CHECKLIST.md`)                              |
