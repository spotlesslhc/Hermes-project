---
title: Zapier Overseer buildout
tags: [zapier-overseer, zapier]
started: 2026-09-22
updated: 2026-09-26
status: Invoicing Zap Paths E and G fixed (v6), stale field mappings resolved (v7); calendar Zap's cancellation handling fixed (v16); Deja's Zapier access designed and half-built (error webhook), Zap-side wiring left
---

# Zapier Overseer buildout

## What this is

Give the Zapier Overseer agent real functionality. Bryce prioritized this
ahead of the bookkeeping playbooks rollout, since cleaning events flow
through Zapier upstream of both the Scheduler and the Bookkeeper's
invoicing. Bryce defines "oversight" as being able to **view and edit
any part of Zapier**, not just get failure notifications.

**Turns out full API access for either half doesn't exist on any Zapier
plan** — see
[[decisions/2026-09-26-deja-zapier-oversight-design]]. "View" is now a
real webhook endpoint (built, needs the Zap-side wiring below); "edit"
stays a human-supervised browser session, which is what it already was
and is the only way Zapier itself supports editing a Zap's config.

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
- **Stale `Action` field-mapping warnings on Paths A, B, C, G resolved
  (v7, 2026-09-26)** — turned out not to be a broken mapping at all, just
  a trigger sample that happened to be from a webhook type without an
  `action` key. Fixed by refreshing the sample, zero logic changes. Full
  writeup in
  [[decisions/2026-09-26-invoicing-zap-stale-field-mappings]], including
  a mistake made and caught mid-investigation (an accidental click
  cleared Path A's `Action` mapping; restored before publishing).
- **Deja's Zapier oversight designed, "view" half built (2026-09-26)** —
  confirmed directly against Zapier's account settings and API docs that
  no plan (Bryce is on Pro) offers an API for a personal account to read
  or edit its own Zaps; the real "Zap Management API" belongs to a
  different product ("Powered by Zapier," for embedding Zapier in
  someone else's SaaS product). Full design in
  [[decisions/2026-09-26-deja-zapier-oversight-design]]. Built
  `POST /webhooks/zapier-status` (PR: `feature/zapier-error-webhook`) —
  a shared-secret-authenticated endpoint a Zap's own code step can call
  on a real failure, replacing the permanently-static `zapsWatched: 6,
  errors: 0` stub with live data and a weekly-resetting error count.

## What's left

1. **Bryce: create the `ZAPIER_WEBHOOK_SECRET` value** — run
   `wrangler secrets-store secret create 8f15d6429b5741f9ac32e05415413a65
   --name ZAPIER_WEBHOOK_SECRET --scopes workers` and paste a random value
   at the prompt (not via a script/flag, so it never hits shell history).
2. **Wire Path E and Path G's Python code to actually call the new
   webhook** on failure (`requests.post` to
   `https://<worker-domain>/webhooks/zapier-status` with header
   `X-Zapier-Secret`, body `{zap, step, error}`). This is a live Zapier
   edit — needs a session with Bryce present, same as every other change
   this week.

## Blocked on

Item 1 needs Bryce to actually run the wrangler command (Claude Code
won't generate/set the real secret value itself — see the design doc).
Item 2 needs a session where Bryce can approve live Zapier edits.
