---
title: Zapier Overseer buildout
tags: [zapier-overseer, zapier]
started: 2026-09-22
updated: 2026-09-25
status: Path E fixed (v5); Path G, field mappings and access design still open
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
- Editing live Zapier code needs Bryce approving each edit in an
  approval-gated session — full-auto mode blocks it. See
  [[2026-09-25-zapier-code-edit-permission-block]].

## What's left

1. **Fix Path G** (fires on `reservation.changed`). Read-only check
   confirmed it has Path E's original bugs: endpoint
   `https://gql.waveapps.com/` (line 14) and a top-level
   `invoices(first: 100, filter: {description: "{code}"})` query (line 24).
   It hardcodes `customer_id = '97496415'` and
   `business_id = '022c8b78-3bbd-41cc-88e4-d7dfdce5632c'` (lines 11–12);
   read its Step 3 (invoice creation, ~line 72) in full before changing
   anything. Apply the Wave gotchas listed in [[zapier-automations]], then
   test on a throwaway draft invoice, same as Path E.
2. **Fix the stale Hospitable field-mapping warnings** on Paths A, B
   and C.
3. **Design "full view and edit" access for Deja** (Zapier's own API, a
   stored key, and real thought about blast radius, since the account
   already holds a cleartext Wave token — see
   [[2026-09-22-zapier-wave-token-cleartext]]) before wiring anything
   into `src/index.js`.

## Blocked on

Nothing — pick up any item whenever. Item 1 needs a session where Bryce
can approve live Zapier edits.
