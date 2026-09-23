---
title: Zapier Overseer buildout
tags: [zapier-overseer, zapier]
started: 2026-09-22
updated: 2026-09-22
---

# Zapier Overseer buildout

## What this is

Give the Zapier Overseer agent real functionality. Bryce wants this
prioritized ahead of the bookkeeping playbooks rollout, since cleaning
events flow through Zapier upstream of both the Scheduler and the
Bookkeeper's invoice automation — getting real visibility here first
makes the downstream work more trustworthy.

## What's done so far

Investigated the current state: **there is no real functionality yet.**
`zapier_overseer` in `DEFAULT_STATUS` (`src/index.js`) is a hardcoded stub
(`zapsWatched: 6, errors: 0`) that nothing ever updates. The one real
webhook that exists, `/webhooks/reservation` (`src/index.js:747`),
updates the **Scheduler's** status when a new booking comes in — it has
nothing to do with Zapier Overseer today.

Walked the real Zapier account directly (Bryce signed the browser in)
and documented both remaining Zaps in full — see [[zapier-automations]].
The first documentation pass badly undercounted the invoicing Zap's real
structure (missed paths off-screen); corrected within the same session —
see [[2026-09-22-zapier-review-missed-paths]] for that mistake and the
now-standing rule about fully scrolling a Zap's canvas before concluding
something doesn't exist.

Corrected findings:

- The invoicing Zap actually has 7 lettered paths (A–G, F deleted).
  Paths A/B/C consistently create a Wave invoice when that specific
  property's reservation is cancelled — almost certainly a cancellation
  fee, not backwards logic as first guessed.
- **Path D was genuinely dead code** (impossible AND conditions across
  all three properties) — Bryce confirmed he didn't know what it was for
  and asked it be removed. **Done**, published as v3.
- **The invoice-deletion logic Bryce described does exist** (Path E: any
  cancelled reservation → Code-by-Zapier Python → find a DRAFT Wave
  invoice matching checkout date + property, delete it). It hardcodes
  the customer name to "Jacob Whitaker" rather than reading the parsed
  `user` field — Bryce confirmed every real reservation from this
  webhook is under that name, so this isn't currently a bug. **Whether
  this logic is actually working in practice is still unconfirmed** —
  Bryce asked for deletion to be "rebuilt" before this was found; unclear
  if he knew it existed and it's actually broken, or wasn't aware of it.
- Path G (fires on `reservation.changed`) has a second Code step using a
  hardcoded Wave customer ID — not fully read line-by-line yet.
- The disabled, incomplete "1328 Piper Dr" Zap is confirmed unused by
  Bryce. **Done** — moved to Zapier's trash (30-day recoverable).
- Stale Hospitable field-mapping warnings recur across Paths A, B, and C
  — not yet fixed.
- Bryce clarified "oversight" means Zapier Overseer should be able to
  **view and edit any part of Zapier** — full access, not just failure
  notifications. He also said Zapier holds no sensitive data; corrected —
  the cleartext API token from
  [[2026-09-22-zapier-wave-token-cleartext]] lives in the invoicing Zap's
  Code steps.

Stray auto-created editor drafts were cleaned up along the way (no real
edits in any of them).

## What's left

1. **Ask Bryce directly**: does Path E's existing delete-on-cancel logic
   actually work, or has he observed it failing? Don't rebuild something
   that might already be fine.
2. Read Path G's Code step in full to confirm what it actually updates.
3. Fix the stale Hospitable field mappings on Paths A, B, and C.
4. Design what "full view and edit" access for Hermes actually requires
   (Zapier's own API, an API key to store, real thought about
   scope/blast radius given the account already holds one live secret)
   before wiring anything into `src/index.js`.

## Blocked on

Bryce's answer on whether Path E's deletion logic is actually broken,
and his decisions on the remaining items above.
