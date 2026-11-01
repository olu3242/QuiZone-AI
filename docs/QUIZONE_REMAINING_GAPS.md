# QuiZone remaining gaps — ordered backlog (updated QZ-38)

The engineering backlog from the original list (QZ-04 to QZ-09) has shipped; see `QUIZONE_UNIFIED_STATUS.md` for each batch. What remains needs access or a decision from the owner.

## Release blockers (external)

1. **Hosted Supabase project** for UAT: the connector is denied on `orjremljufkflomsjelr`. Grant access, or name an empty project.
2. **Vercel connector scope** for `qui-zone-ai` env/deployments, plus the env vars in `QUIZONE_DEPLOYMENT_READINESS.md`.
3. **Merge path to `main`**: `main` cannot build until the app lands.
4. **Legal/product**: verifiable parental consent, approved age bands (8–17 is a placeholder), retention of safety records on deletion, international privacy review (Global Connect is aggregate-only, k ≥ 5).
5. **Custom SMTP** and a test-inbox strategy for hosted E2E.
6. **SafeZone**: moderator vetting program and enablement sign-off (card-only by owner decision).

## Closed since the original list

| Gap                                                                                                                                   | Batch           |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Security hardening, rate limits, error contract                                                                                       | QZ-04           |
| Browser journeys for every zone; CMS authoring in every non-Quick zone, with age-band and archived-explorer rules checked per zone    | QZ-06, QZ-38    |
| Content model, multi-step CMS, quality gate; WorldZone country editable in the CMS (previously blocked every CMS WorldZone challenge) | QZ-21–23, QZ-38 |
| Levels, badges, history, consent versions                                                                                             | QZ-24–27        |
| Family members and multi-device play                                                                                                  | QZ-31           |
| Child dashboard (Explorer mode, no child accounts)                                                                                    | QZ-32           |
| Cross-household WorldZone (aggregates)                                                                                                | QZ-33           |
| Q provider boundary (author suggestions only)                                                                                         | QZ-34           |
| Scheduled maintenance (pg_cron) with an admin run log                                                                                 | QZ-35           |
| Guardian notifications beyond SafeZone (family inbox)                                                                                 | QZ-36           |
| BuildZone portfolio                                                                                                                   | QZ-37           |
| Scenario catalog with traceability validation                                                                                         | QZ-38           |

## Still open (engineering)

- **Live child-facing Q**: needs a trusted server-side writer (e.g. an Edge Function with a signing secret) and a safeguarding review (`QUIZONE_UNIFIED_STATUS.md`, decisions).
- **Realtime instead of polling**: the game polls every 5 s with a newest-response guard. Supabase Realtime is excluded from the local stack; adopt it once the hosted project exists.
- **Educator Hub**: PRD §2 lists Teacher as post-MVP.
- **Role/flag management UI**: SQL-only by design (operator controls in `QUIZONE_DEPLOYMENT_READINESS.md`).

## Known technical debt

- `private.command` is still one large function, now copied twice by additive migrations (QZ-31 member resolution). Consolidate in one deliberate migration with a full regression run.
- Manual screen-reader and real-device testing not yet done (automated axe only).
- `docs/IMPLEMENTATION_STATUS.md` (Oct 18) is superseded by `QUIZONE_UNIFIED_STATUS.md`.
