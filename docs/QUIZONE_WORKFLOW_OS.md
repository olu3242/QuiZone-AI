# QuiZone Workflow OS (QZ-39)

A database-native workflow engine: typed events in a transactional outbox, versioned workflow definitions stored as data, and a runtime with retries, idempotency, dead letters, and a per-step run log. No extra services or vendors. Source: `supabase/migrations/20261101320000_workflow_os.sql`.

```
domain change (trigger) ──▶ private.wf_emit ──▶ private.wf_events   (idempotency_key unique)
                                                   │ dispatch inline (same transaction)
private.wf_definitions (live = highest version) ──▶ private.wf_runs ──▶ private.wf_steps
                                                   ▲
pg_cron "qz-workflows" every minute ───────────────┘ private.wf_tick()
```

## Concepts

| Piece          | What it is                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Event**      | A typed fact (`badge.awarded`, `member.joined`, `member.left`, `report.status_changed`, `consent.published`, `game.completed`, `clock.quarter_hour`) with an idempotency key. Emitting the same key twice is a no-op.     |
| **Definition** | `(key, version, event, steps[], max_attempts, enabled)`. The highest version is live. Steps may only name whitelisted actions (`private.wf_known_action`), enforced by a trigger: definitions are data, actions are code. |
| **Run**        | One per (workflow, event): `pending → running → succeeded`, or `failed` (retry with backoff 30 s, 2 min, 8 min, 32 min, then hourly) and finally `dead` after `max_attempts`. `paused` while the workflow is paused.      |
| **Step log**   | One row per step attempt: action, status, duration, scrubbed error (ids removed). Retries resume after the last succeeded step.                                                                                           |
| **Runtime**    | Inline dispatch keeps the user-visible effect immediate; `private.wf_tick()` retries due runs, releases resumed runs, emits the quarter-hour clock, and prunes 30-day-old fully succeeded history.                        |

## Workflows shipped

| Key                                           | Event                           | Steps                | Replaces                                                   |
| --------------------------------------------- | ------------------------------- | -------------------- | ---------------------------------------------------------- |
| `badge.notify`                                | `badge.awarded`                 | `notify_badge`       | QZ-36 badge trigger                                        |
| `member.joined.notify` / `member.left.notify` | `member.joined` / `member.left` | `notify_member`      | QZ-36 member trigger                                       |
| `report.status.notify`                        | `report.status_changed`         | `notify_report`      | QZ-36 report trigger                                       |
| `consent.notify`                              | `consent.published`             | `notify_consent`     | QZ-36 consent trigger                                      |
| `game.member_hosted.notify`                   | `game.completed`                | `notify_member_game` | new: the guardian hears when a family member hosted a game |
| `ops.maintenance`                             | `clock.quarter_hour`            | `maintenance`        | QZ-35's separate `qz-maintenance` cron job                 |

## Operating it

- **Console:** Content & safety → Workflows (administrators). Shows each live definition, 24-hour outcomes, dead letters, due runs, and the last 30 runs with step logs. Pause/resume a workflow, retry a failed or dead run, or run a tick now. Every action is audited.
- **Cron:** `select * from cron.job where jobname='qz-workflows';` and `select * from cron.job_run_details order by start_time desc limit 5;`.
- **Dead letters:** `select id, workflow_key, last_error from private.wf_runs where status='dead';` Fix the cause, then Retry in the console (the attempt count resets).
- **Pausing** never loses work: events keep arriving and their runs wait as `paused` until resumed.

## Adding a workflow

1. Add the action to `private.wf_known_action` and a branch in `private.wf_action` (idempotent; use `private.notify` dedupe refs where possible).
2. Emit the event from a trigger with `private.wf_emit(type, household, ref, payload, idempotency_key)`.
3. Insert the definition (`version 1`). To change steps later, insert `version n+1`; runs keep the version they started with.
4. Add DB tests (`tests/workflow-os.test.ts` style) and a browser check; update `e2e/scenarios.json` (the catalog test enforces it).

## Security

Every table and function is private (no client grants). Administrators read through `private.wf_overview` (no household ids, payloads, or names) and steer through `private.wf_command`; both check the staff role in the database, and the routes refuse Explorer-mode sessions. Errors are scrubbed of UUIDs before they are stored.
