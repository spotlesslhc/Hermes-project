---
title: Verify the scheduling automations against real bookings
tags: [scheduler, turno, verification]
started: 2026-09-23
updated: 2026-09-25
---

# Verify the scheduling automations against real bookings

## What this is

Several scheduling paths are built and tested only against mocks or in
isolation. None has yet run end to end on a real booking. Until each one
has, treat it as unverified in production.

## A likely explanation for why nothing's been verified yet (2026-09-26)

The Turno Zap's webhook step (`/webhooks/turno-reservation`) has no
Cloudflare Access credentials configured, and the whole Worker has sat
behind Cloudflare Access since 2026-09-21. Confirmed directly: an
unauthenticated POST to that URL gets redirected to an Access login page,
not the Worker's actual logic — and Zapier would read that redirect as a
normal "success," not an error. **This automation may have been silently
unreachable this entire time.** Full writeup in
[[decisions/2026-09-26-webhook-secret-auth]]. Fix in progress: the Worker
now also checks its own shared secret independently of Access, but the
Turno Zap step still needs both that secret *and* a Cloudflare Access
Service Token added to its headers before this can work at all — check
that before waiting on a "next real booking."

## What's left — check on the next real booking of each kind

1. **`assign_cleaner` success path** ([[scheduler]]). Only the failure
   path has run live. The Zap it calls (Catch Hook → Find Event → Add
   Attendee) passed Zapier's own Test step, but Deja's `assignCleaner()`
   has never matched a real unassigned reservation. On the next one,
   confirm the right cleaner gets invited to the right Cleans event.
2. **Turno / 2211 Sahara automation** ([[turno-scheduling]]), after PRs
   #26 and #27 (2026-09-25). On the next new Sahara reservation email,
   confirm that:
   - the clean lands on the **checkout** date as a normal-looking event
     ("2211 Sahara Drive", 10am–4pm, blue, usual description);
   - Amy (or Ashley) gets invited;
   - a **draft** Wave invoice is created for Sparks, **dated on the
     cleaning date**.
3. **Turno cancellation.** The email trigger assumes Hospitable puts
   "cancel" in the subject; no real Sahara cancellation email has ever
   arrived. The manual path (ask Deja; approve on the dashboard) should
   work regardless — try it the first time a Sahara reservation is
   cancelled.

## Blocked on

Real bookings arriving. A synthetic test reservation (writing to the
`reservations` KV key) was blocked by the sandbox's safety classifier on
2026-09-23; don't retry that without Bryce's explicit OK.
