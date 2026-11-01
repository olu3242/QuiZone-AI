# SafeZone safeguarding checklist

The operational checklist for running town halls. It complements the technical controls in `SAFEZONE_SECURITY_MATRIX.md` and the policy in `QUIZONE_CHILD_SAFETY.md`.

**Communication policy (owner decision, 2026-11-01): card-only.** Children never type text that reaches other users. `FAMILY.md` §2 stands unchanged.

## Before SafeZone opens to any real family (one-time)

- [ ] Legal sign-off: verifiable parental consent method, COPPA / UK AADC / GDPR-K applicability, retention schedule
- [ ] Moderator program: background checks, safeguarding training, code of conduct, named safeguarding lead and deputy
- [ ] Incident response: escalation contacts, response-time targets by severity (`urgent` / `high` / `low`), a route to report to the authorities
- [ ] Card-authoring guidelines: age-appropriate, neutral, no leading or shaming framings, reviewed by a second person before publishing
- [ ] Hosted certification passed (`SAFEZONE_HOSTED_CERTIFICATION.md`)
- [ ] An operator enables `private.feature_flags.safezone`, with a recorded approval

## Per town hall

- [ ] Two adults assigned: the moderator plus an observer or safeguarding lead (organizational rule; the software doesn't enforce it yet)
- [ ] Cards reviewed by a second person before **Publish & open registration**
- [ ] Age band and capacity set (minimum capacity policy to protect pseudonymity)
- [ ] Moderator rehearsed: removal (reason shown to the guardian), emergency close, report queue

## During

- [ ] Grant one speaking turn at a time; approve or decline each card promptly
- [ ] Watch the report form and the safeguarding queue
- [ ] Remove a participant with a factual reason. Never put a child's identity in a reason
- [ ] Use **Emergency close** for any safeguarding concern; it escalates an urgent incident

## After

- [ ] Complete the town hall (this closes polls and publishes the summary)
- [ ] Resolve every report with a decision and a staff-only note
- [ ] The safeguarding lead reviews urgent and high incidents within the agreed time
- [ ] Periodically review `audit_events` for moderator actions
