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

## What's left

Need from Bryce before any code gets written:

1. How many distinct Zaps touch cleaning events, and what does each one
   do end-to-end? (Is the reservation → Google Calendar Zap the same one
   as the invoice-creation/deletion Zap discussed for the Bookkeeper, or
   separate?)
2. What's the trigger source — Hospitable, Hostaway, or both?
3. What should "oversight" actually mean — surfacing real Zap *failures*
   (Zapier can call a webhook on step error, which could feed a new
   `/webhooks/zapier-error` endpoint), or something broader like flagging
   when expected reservations stop arriving?

Alternative: Bryce offered to let Claude look at the Zapier dashboard
directly (same browser-driven approach as Wave) instead of describing it
in chat — not yet decided which.

## Blocked on

Bryce describing the real Zap setup, or agreeing to a browser-driven
walkthrough of the Zapier dashboard instead.
