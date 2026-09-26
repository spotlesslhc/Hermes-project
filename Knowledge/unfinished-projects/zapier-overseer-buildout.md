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

- **`ZAPIER_WEBHOOK_SECRET` created (2026-09-26)** — Bryce ran the
  `wrangler secrets-store secret create` command himself. Merged and
  deployed (`e32b632`).
- **Found a real, likely-live bug while verifying the above (2026-09-26)**:
  the Turno webhook Zap has no Cloudflare Access Service Token configured,
  so it's probably been silently unreachable since Access went live
  2026-09-21 — Zapier would see a redirect and call it a success. Full
  writeup in [[decisions/2026-09-26-webhook-secret-auth]] and
  [[verify-scheduling-with-real-bookings]]. Considered (and ruled out)
  splitting Cloudflare Access by path to let webhooks bypass it entirely —
  not achievable without adding a real custom domain, since the "Workers"
  Access destination type has no path field. Fixed the code side instead:
  every webhook handler (`/webhooks/reservation`,
  `/webhooks/turno-reservation`, `/webhooks/zapier-status`) now
  independently checks `ZAPIER_WEBHOOK_SECRET` via
  `requireZapierWebhookSecret()`, so a Cloudflare-side misconfiguration
  can't cause a silent failure again. PR: `feature/webhook-secret-auth`.

## What's left

1. **Bryce: add headers to the Turno Zap's webhook step** — both the
   existing "Hermes_Cloudflare Auth" Cloudflare Access Service Token
   (`CF-Access-Client-Id` / `CF-Access-Client-Secret` — check
   `tools/deja-bridge/.env.local` for the values, since that script
   already uses this same token) and the new shared secret
   (`X-Zapier-Secret`, same value as `ZAPIER_WEBHOOK_SECRET`). Without
   both, this automation still can't reach Hermes at all.
2. **Audit whatever Zap calls `/webhooks/reservation`** for the same gap
   — not yet identified/checked this session.
3. **Wire Path E and Path G's Python code to actually call
   `/webhooks/zapier-status`** on failure (`requests.post` with the same
   two headers as above, body `{zap, step, error}`). This is a live
   Zapier edit — needs a session with Bryce present, same as every other
   change this week.

## Blocked on

Items 1–3 all need Bryce present (adding real Access/secret credentials
to Zapier steps isn't something Claude Code does itself, and item 3 is a
live Zapier edit needing approval same as always).
