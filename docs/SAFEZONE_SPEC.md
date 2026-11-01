# SafeZone — feature specification, architecture, and schema (MVP)

**Tagline:** Your Voice. Your Ideas. A Safer World.
**Status:** implemented on `claude/gracious-bohr-a6k3nv`; feature flag **off** by default; synthetic accounts only. Not approved for real children.

## 1. Charter reconciliation (read first)

The SafeZone brief asked for "moderated text contributions", free-text ideas, and questions shared across households. `FAMILY.md` §2 forbids "a free-text box aimed at another user" and says to redesign rather than add messaging. Per `AGENTS.md`, the conflict is **flagged, not silently resolved**. The MVP takes the charter's safer default:

| Brief asked for                         | MVP delivers                                                                       | To change it                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Free-text contributions                 | Moderator-authored **statement cards**, usable only during a granted speaking turn | Amend `FAMILY.md` §2, then add a `body text` column + PII screening + human review (additive) |
| Free-text idea board                    | Moderator-authored **idea cards** explorers support; summary ranks by supporters   | Same                                                                                          |
| Anonymous free-text questions           | Moderator-authored **question cards**, shown with no session name                  | Same                                                                                          |
| AI facilitator                          | Not implemented: no provider approved (PRD §21)                                    | Provider choice + server-only key + human-in-the-loop review                                  |
| Live audio/video, recording, livestream | Not implemented; no code path exists                                               | Separate safety and privacy certification                                                     |

Every child contribution, card-based or not, is **held for moderator approval** before peers see it.

## 2. Roles and identity

- **Guardian** (confirmed account, owns a household): enables SafeZone, gives per-town-hall consent, withdraws, reports, sees notifications.
- **Explorer** (child profile, no credentials): acts through the guardian's signed-in device, as in the rest of the pilot. Appears to others **only as a per-session handle** (e.g. "Teal Otter 4"), never by nickname.
- **Moderator / admin** (`private.staff`, granted by an operator in SQL): creates and runs town halls and works the safeguarding queue. An admin can assign another moderator.
- **Operator**: enables the `safezone` feature flag and grants staff roles. No app UI exists for either.

**Why consent needs the password:** because a child uses the guardian's signed-in device, a single checkbox would let the child approve themselves. Enabling SafeZone and every registration re-verify the guardian password in `/api/safezone`. The database also checks the resulting JWT `amr` password timestamp is under 5 minutes old (`private.recent_reauth`). This holds even if someone calls the RPC directly.

## 3. Lifecycle

```
draft ──► scheduled ──► open ──► active ──► completed
  └──────────┴──────────┴─────────┴──► cancelled   (moderator cancel, or emergency close)
```

- `draft`: moderators only.
- `scheduled`: visible to families; registration open; must start in the future.
- `open`: room open; registration still open; explorers wait.
- `active`: hands, cards, polls.
- `completed`: polls auto-close; summary published.
- `cancelled`: families notified. An emergency close also escalates an urgent incident.

## 4. Modules → implementation

| Module                                                   | Where                                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Town Hall Lobby (topics, upcoming, history, safety info) | `/safezone` → `components/pages/safezone.tsx`, `qz_safezone_lobby()`                         |
| Session registration + guardian approval                 | `ConsentDialog` → `POST /api/safezone` (`sz_register`)                                       |
| Moderated discussion + agenda                            | `/safezone/[id]` → `components/safezone/room.tsx`; `sz_agenda`                               |
| Raise your hand / speaking turns                         | `sz_hand`, `sz_turn`. Partial unique index: at most one speaker per hall                     |
| Idea board / anonymous questions                         | `sz_say` with idea and question cards → `sz_review`                                          |
| Community polls                                          | `sz_poll_create`, `sz_poll_state`, `sz_vote` (primary key = one vote per explorer per poll)  |
| Guardian dashboard                                       | Lobby panels: notifications, reports, history; withdraw consent; turn SafeZone off           |
| Safety Center                                            | In-room report form + per-item report; `sz_remove`, `sz_emergency_close`, `sz_report_review` |
| Impact tracker                                           | **Not implemented** (proposals have no post-session lifecycle yet)                           |

## 5. Schema (migration `20261101140000_safezone.sql`)

| Table                                         | Key constraints                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `private.feature_flags`                       | `safezone=false`; no client grants                                                                         |
| `guardian_permissions.safezone`               | default `false`                                                                                            |
| `town_halls`                                  | age 8–17, `min_age ≤ max_age`, capacity 2–30, duration 15–90, state check, `moderator_id` must be staff    |
| `town_hall_agenda`                            | PK (hall, ordinal 1–10)                                                                                    |
| `town_hall_options`                           | kind ∈ contribution/question/idea; text 3–200 characters; optional agenda scoping                          |
| `town_hall_registrations`                     | PK (hall, child); unique (hall, handle); status registered/withdrawn/removed; consent timestamp            |
| `town_hall_hands`                             | partial unique: one open hand per child; one `speaking` per hall                                           |
| `town_hall_contributions`                     | unique (hall, child, option); status pending/approved/rejected/withdrawn                                   |
| `town_hall_polls` / `town_hall_votes`         | 2–6 choices; vote PK (poll, child)                                                                         |
| `safezone_reports` / `safezone_report_events` | severity low/high/urgent; status open → under_review → actioned/dismissed/escalated; events **staff-only** |
| `safezone_notifications`                      | household-scoped                                                                                           |

All foreign keys to `households` / `child_profiles` cascade, so explorer and account deletion leave no orphans (tested). RLS is on for all 11 tables, raw rows are household-private or staff-only, and `anon` has no grants. Cross-household views go only through `private.safezone_lobby()` and `private.safezone_room()`. These return handles and approved card text, never nicknames, child ids, household ids, or moderator notes.

## 6. Commands (`public.qz_command`, prefix `sz_`)

| Command                                                                                                    | Who                                         | Key checks                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `sz_hall_create`                                                                                           | moderator/admin                             | agenda 1–10, ≥1 statement card, valid agenda references, staff moderator                                               |
| `sz_hall_state` / `sz_agenda` / `sz_turn` / `sz_review` / `sz_poll_*` / `sz_remove` / `sz_emergency_close` | assigned moderator or admin                 | legal transition; active state; reason required for removal and closure                                                |
| `sz_report_review`                                                                                         | any staff                                   | not already resolved; event recorded; family notified                                                                  |
| `sz_permission` (enable) / `sz_register`                                                                   | guardian, flag on, **fresh password**       | household permission, explicit consent, active explorer, age band, capacity under the hall lock, not removed           |
| `sz_withdraw` / `sz_permission` (disable)                                                                  | guardian                                    | erases that explorer's contributions and votes for the hall(s)                                                         |
| `sz_hand` / `sz_say` / `sz_vote`                                                                           | guardian on behalf of a registered explorer | hall active; turn required for statements; card belongs to hall and current item; 5s rate limit; 20 per hall; one vote |
| `sz_report`                                                                                                | guardian of a registered household          | reason enum; 10 per hour per guardian                                                                                  |

Every command writes `audit_events`. Removal and emergency closure also write a `safezone_reports` incident and its first event.
