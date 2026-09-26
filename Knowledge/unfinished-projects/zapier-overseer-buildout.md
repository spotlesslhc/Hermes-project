---
title: Zapier Overseer buildout
tags: [zapier-overseer, zapier]
started: 2026-09-22
updated: 2026-09-26
status: Invoicing Zap Paths E and G fixed (v6); calendar Zap's cancellation handling fixed (v16); stale field mappings and access design still open
---

# Zapier Overseer buildout

## What this is

Give the Zapier Overseer agent real functionality. Bryce prioritized this
ahead of the bookkeeping playbooks rollout, since cleaning events flow
through Zapier upstream of both the Scheduler and the Bookkeeper's
invoicing. Bryce defines "oversight" as being able to **view and edit
any part of Zapier**, not just get failure notifications.

`zapier_overseer` in `DEFAULT_STATUS` (`src/index.js`) is still a
hardcoded stub (`zapsWatched: 6, errors: 0`) that nothing updates.

## Done

Full current state of both Zaps is in [[zapier-automations]]. Summary:
- Both Zaps fully documented (after a first pass missed off-screen
  paths — see [[2026-09-22-zapier-review-missed-paths]]).
- Invoicing Zap: dead Path D removed (v3); Paths A/B/C no longer create
  a Wave customer on a miss (v4); **Path E invoice deletion fixed and
  verified live (v5)** — it had never worked before.
- Unused "1328 Piper Dr" Zap moved to Zapier's trash.
- **Calendar Zap's cancellation handling fixed end to end (v16,
  2026-09-26)** — two real bugs and a wrong-calendar issue, all found
  chasing down one real Hospitable cancellation. Full writeup in
  [[decisions/2026-09-26-calendar-zap-cancellation-bugs]]:
  1. Find Events could never match an event (exclusive time-bound
     compared against an exact-match timestamp) — fixed with a Formatter
     step, verified against the real failed run.
  2. Three of four create-paths had no status check at all, so a
     cancellation immediately got a fresh duplicate event created right
     after the old one was deleted — fixed by adding the same status
     guard QueensBay's path already had.
  3. All 8 Google Calendar steps in this Zap (4 create-paths, 2
     cancellation Find Events, 2 cancellation Delete Event) pointed at a
     leftover "Test Auto Cleanings" calendar instead of the real "Cleans"
     calendar — switched.
- Editing live Zapier code needs Bryce approving each edit in an
  approval-gated session — full-auto mode blocks it. See
  [[2026-09-25-zapier-code-edit-permission-block]].
- **Path G fixed and verified live (v6, 2026-09-26)** — had Path E's
  original mechanical bugs, plus a structural one of its own (searched
  for the old invoice by a `code` field that no invoice ever actually
  stores). Full writeup in
  [[decisions/2026-09-26-invoicing-zap-path-g-bugs]]. A throwaway test
  draft invoice (#469, "1795 Palo Verde Boulevard South", 2026-08-16)
  from verifying this is still sitting in Wave and needs deleting.

## What's left

1. **Fix the stale Hospitable field-mapping warnings** on Paths A, B
   and C.
2. **Design "full view and edit" access for Deja** (Zapier's own API, a
   stored key, and real thought about blast radius, since the account
   already holds a cleartext Wave token — see
   [[2026-09-22-zapier-wave-token-cleartext]]) before wiring anything
   into `src/index.js`.

## Blocked on

Nothing — pick up any item whenever.
