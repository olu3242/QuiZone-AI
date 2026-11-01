# QuiZone E2E certification record

> Latest counts are in `QUIZONE_E2E_RESULTS.md` (75 unit/DB, 42 browser across family, resilience, and SafeZone suites). The tables below record the first certification run.

**Certification level reached: LOCAL REAL-STACK.** Hosted certification: **NOT CERTIFIED** (no hosted QuiZone backend).

## Environment

- App: `next start` production build of this branch on `http://localhost:3000`.
- Backend: Supabase CLI 2.121.0 local stack — Postgres 17, GoTrue, PostgREST, Kong, Mailpit — with all 3 migrations applied via `supabase start` / `supabase db reset --local`.
- Browser: Chromium via Playwright 1.63.0; axe-core 4.10.3 (WCAG 2.0/2.1/2.2 A+AA rules).
- Accounts: synthetic `guardian-a-<run>@example.test`, `guardian-b-<run>@example.test`; synthetic explorers "Nova", "Pixel".

## Results — final run

| Suite                                            | Pass     | Fail | Skip | Blocked |
| ------------------------------------------------ | -------- | ---- | ---- | ------- |
| Unit + PGlite DB (`npm test`, 6 files)           | 46       | 0    | 0    | 0       |
| Browser E2E (`npm run test:e2e`)                 | 17       | 0    | 0    | 0       |
| plpgsql_check (`supabase db lint --level error`) | 0 errors | —    | —    | —       |
| Hosted UAT (`DEPLOYMENT.md` §15 steps)           | 0        | 0    | 0    | **15**  |

First E2E run: 14/16 — failures were real defects (hero overflow, 22 contrast violations), fixed in `e0820c6`.

## Requested coverage → evidence

| #   | Requirement                    | Evidence                         | Status                              |
| --- | ------------------------------ | -------------------------------- | ----------------------------------- |
| 1   | Guardian registration & login  | E2E 2, 13, 14                    | PASS                                |
| 2   | Child profile creation         | E2E 3, 4                         | PASS                                |
| 3   | Family invitations             | —                                | NOT IMPLEMENTED                     |
| 4   | Game creation & participation  | E2E 5, 5b                        | PASS                                |
| 5   | Quiz completion & scoring      | E2E 5, 5b, 6; scoring DB tests   | PASS                                |
| 6   | BuildZone submission           | DB tests only                    | PASS (DB) / no browser journey      |
| 7   | DebateZone participation       | DB tests only                    | PASS (DB) / no browser journey      |
| 8   | AI-generated activities        | —                                | BLOCKED (no provider)               |
| 9   | Guardian reporting             | E2E 7, 9                         | PASS                                |
| 10  | Unauthorized access prevention | E2E 8, 9 (401), DB suites        | PASS                                |
| 11  | Cross-family isolation         | E2E 8 (API + PostgREST)          | PASS                                |
| 12  | Mobile responsiveness          | E2E 10 (390/1024/1440, 6 routes) | PASS                                |
| 13  | Accessibility                  | E2E 11 (10 routes), 12           | PASS (automated only)               |
| 14  | Session recovery               | E2E 5 reload; DB pause/expiry    | PARTIAL                             |
| 15  | API failure & retry            | —                                | NOT TESTED (no fault injection yet) |

## Reproduce

```bash
npx supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta
```

Write `.env.local` from `npx supabase status -o env` (`API_URL`, `PUBLISHABLE_KEY`), then:

```bash
npm run build && npx next start -p 3000
```

```bash
E2E_SUPABASE_KEY=<PUBLISHABLE_KEY> npm run test:e2e
```

CI runs the same in `.github/workflows/e2e.yml`. Against a hosted preview set `E2E_BASE_URL`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_KEY`; Mailpit-based steps (2, 8, 14) need a test inbox adapter for real SMTP.
