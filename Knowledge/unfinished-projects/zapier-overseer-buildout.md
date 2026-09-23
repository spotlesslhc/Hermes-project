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

Then walked the real Zapier account directly (Bryce signed the browser
in) and documented all three Zaps in full — see
[[zapier-automations]]. Found real, concrete issues along the way:

- The invoicing Zap's Path D has logically impossible conditions (likely
  dead code, an email step that probably never fires).
- Its Path C has a stale field-mapping warning, and its own logic
  (invoicing *on cancellation*) is worth confirming with Bryce rather
  than assuming it's right.
- The raw-API-token Code steps Bryce described for deleting/updating
  invoices on cancellation **do not currently exist** in that Zap — needs
  Bryce to confirm whether that's a real gap or lives elsewhere.
- A third, disabled Zap ("1328 Piper Dr...") is sitting as an incomplete,
  unpublishable draft and is very likely obsolete now that the main
  calendar Zap has an "Other properties (fallback)" branch.
- Multiple stale Hospitable field mappings recur across Zaps — Hospitable
  likely changed its webhook payload shape at some point without every
  downstream mapping catching up.
- Bryce clarified what "oversight" means to him: Zapier Overseer should
  be able to **view and edit any part of Zapier** — full access, not just
  failure notifications. (He also said Zapier holds no sensitive data;
  that's not quite right — the cleartext API token from
  [[2026-09-22-zapier-wave-token-cleartext]] lives in one of these Zaps —
  flagged to him directly.)

Two stray auto-created drafts (from opening the Zap editors to inspect
them) were cleaned up; a third, pre-existing incomplete draft on the
disabled Zap was left alone since it may be someone's unfinished work.

## What's left

1. Confirm with Bryce: is Path D really dead code, is Path C's
   cancel-triggers-invoice logic intentional, and does the described
   invoice delete/update-on-cancellation logic exist somewhere else or
   need to be (re)built?
2. Confirm the disabled "1328 Piper Dr" Zap is truly superseded, then
   delete it.
3. Fix the stale Hospitable field mappings across the affected Zaps.
4. Design what "full view and edit" access for Hermes actually requires
   (Zapier's own API, an API key to store, and — given the account holds
   at least one live secret already — real thought about scope/blast
   radius) before wiring anything into `src/index.js`. Given the found
   bugs, real edit access arguably needs *more* care here, not less.

## Blocked on

Bryce's decisions on the items above.
