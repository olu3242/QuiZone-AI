# FAMILY.md — Child & Family Safety Charter

This document outranks feature requests, deadlines, and convenience. If a
requirement elsewhere in this repo (PRD, an issue, a "quick fix") conflicts
with anything here, this file wins, and the conflict gets flagged rather than
silently resolved in the feature's favor.

**Core principle:** kids are not small adults, and QuiZone is not a normal
consumer app. Every design and engineering decision defaults to the *safer*
option first, then looks for ways to make the safer option also feel good to
use.

---

## 1. Guardians are accountable, and access is scoped accordingly

- A child never has an account independent of a household. Every child
  profile exists inside a household a guardian created and controls.
- A guardian's access is scoped to the households/children they actually
  manage — never to households/children in general.
- A child must not be able to query, view, or interact with another child
  outside a structure a guardian has explicitly enabled (e.g. a moderated
  WorldZone challenge). "The API technically allows it" is a bug, not an edge
  case, if RLS and server-side checks don't both independently enforce this.

## 2. No unrestricted child messaging — anywhere, ever

- Kids never get an open chat surface. Not with other kids, not with Q, not
  with anyone.
- DebateZone, WorldZone, and any future collaboration feature must route
  through a **fixed structure** (assigned position, a template, a required
  format) — never a free-text box aimed at another user.
- If a future feature seems to require open messaging to work, the answer is
  to redesign the feature, not to add messaging.

## 3. Data minimization for children

- Never expose a child's full legal identity, home address, school name, or
  personal contact details anywhere in the product — including in aggregate,
  global, or "anonymized" views. If a feature can't work without this, the
  feature needs a different design.
- Passport entries, WorldZone submissions, and any cross-household view use
  aggregate or genuinely anonymized data only.

## 4. Age-appropriate by construction

- A challenge's age-band eligibility is checked before a child ever sees it —
  this is enforced server-side, not left to the UI to hide the wrong content.
- Content review (Admin CMS) includes an explicit age-appropriateness check
  before publish, not just a subject/skill tag.

## 5. Q (the AI Game Master) has a fixed, narrow role

- Q gives hints, reasoning prompts, constraint reminders, encouragement, and
  reflection questions — nothing else.
- Q is never a general-purpose chatbot for a child, regardless of how a
  prompt is phrased or how a feature request is framed.
- Q's behavior, prompts, and outputs are logged (see PRD §10) specifically so
  a moderator can review what a child was actually shown.

## 6. Moderation is a real system, not a formality

- Every report becomes a `moderation_case` with an auditable trail: reporter,
  reference, reason, severity, status, reviewer, actions, timestamps.
- A moderation decision that materially affects a child's account (a
  restriction, a removal) needs a reviewable history, not just a final status
  flag with no record of how it got there.

## 7. Storage and media are access-controlled by default

- Avatars, build submissions, and moderation evidence live in access-scoped
  buckets — nothing defaults to public just because it was convenient during
  development.
- Moderation evidence in particular is treated as sensitive: viewable only by
  roles that need it for review.

## 8. The public site follows the same discipline

- The public landing page is allowed to talk about safety features in plain
  language (parent-controlled accounts, structured collaboration, real
  moderation) — that builds trust and is expected.
- The public site never publishes the internal mechanics behind those
  features: scoring/moderation logic, the exact age-band boundaries, prompt
  templates for Q, or anything else that would help someone work around the
  safety model rather than just understand that it exists. This is the same
  public/internal separation rule already established for other products
  under this account — see `CLAUDE.md`.

## 9. "Safe enough to ship" checklist

Before any feature touching child data, child-to-child interaction, or
AI-generated content ships, it should be able to honestly answer yes to all
of:

- [ ] Does a child's access stay scoped to their own household, enforced both
      server-side and via RLS?
- [ ] Is any interaction between children structured, not open-ended?
- [ ] Is there a guardian-visible, honest record of what happened (no faked
      or inferred activity)?
- [ ] Can this be reported, and does a report create a real, auditable
      moderation case?
- [ ] Does this expose anything that could identify or locate a specific
      child to anyone outside their own household?

If any answer is "no" or "not sure," that's the blocker — not a note for
later.
