# SafeZone UAT test plan (hosted, synthetic accounts only)

**Preconditions (all required; otherwise the run is BLOCKED, not PASS):**

- the UAT Supabase project is explicitly authorized
- migrations are reviewed and applied to UAT only
- the preview has the 3 env vars
- custom SMTP or a test inbox is available
- the deployment is isolated from production

## Accounts (synthetic)

| Role                                             | Setup                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Moderator `M`                                    | Sign up, then an operator runs `insert into private.staff select id,'moderator' from auth.users where email=…` |
| Guardian A, explorers "Nova" (11) and "Tiny" (8) | Sign up, household                                                                                             |
| Guardian B, explorer "Orbit" (12)                | Sign up, household                                                                                             |

An operator enables the flag only on UAT: `update private.feature_flags set enabled=true where flag='safezone'`.

## Automated run

```bash
E2E_BASE_URL=<preview origin> E2E_SUPABASE_URL=<uat api url> E2E_SUPABASE_KEY=<uat publishable key> E2E_DB_URL=<uat db url, operator machine only> npm run test:e2e
```

Mail-dependent steps need a test-inbox adapter in place of Mailpit (`e2e/support.ts` `mailLink`). Mark them BLOCKED until one exists.

## Manual checks (record pass/fail with timestamp)

| #   | Step                                                                                      | Expected                                                         |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Guardian logs in, enables SafeZone with a wrong password, then the correct one            | Refused, then enabled                                            |
| 2   | Approve Tiny (8) for a 10–13 hall                                                         | Option disabled ("For ages 10–13")                               |
| 3   | Approve Nova with consent and password                                                    | Registered; a session name is shown                              |
| 4   | Wait 6 minutes, approve again with **no** password (direct API)                           | Refused                                                          |
| 5   | Moderator opens and starts the room; Nova raises a hand; moderator gives the turn         | Statement cards enabled only during the turn                     |
| 6   | Nova shares a card; Orbit's view before and after approval                                | Hidden before, then shown with Nova's session name, never "Nova" |
| 7   | Orbit asks a question card                                                                | Shown as "Anonymous question"                                    |
| 8   | Poll: each explorer votes once; moderator closes it                                       | Second vote refused; results appear only after closing           |
| 9   | Orbit reports; moderator records a decision with a note                                   | Family sees the status; the note is never visible to the family  |
| 10  | Moderator removes Orbit with a reason                                                     | Orbit's room shows the removal; Guardian B is notified           |
| 11  | Second hall: emergency close                                                              | Room closed; urgent escalated incident; all families notified    |
| 12  | Guardian A withdraws consent                                                              | Nova's contributions disappear from summaries; votes deleted     |
| 13  | Guardian A exports data                                                                   | `safezone` section present; no staff notes; no Guardian B data   |
| 14  | 390 / 1024 / 1440 viewports; keyboard-only run of steps 3, 5, 8; screen reader spot check | Usable; visible focus; labelled controls                         |
| 15  | Supabase security and performance advisors on UAT                                         | No unresolved errors                                             |
