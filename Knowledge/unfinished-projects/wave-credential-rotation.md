---
title: Wave credential rotation (two open items)
tags: [security, wave]
started: 2026-09-21
updated: 2026-10-02
---

# Wave credential rotation (two open items)

## What this is

Two separate Wave credentials have been flagged as exposed and need
rotating. Tracked here just as a pointer so they don't get lost between
sessions — full detail lives in each decision note.

## What's done so far

Both identified and documented. **Update 2026-10-02: Bryce reset the Client
Secret and confirmed the Wave connection works.** Only the Zapier token remains:

1. **Wave OAuth Client Secret** — possibly exposed on-screen during app
   setup on 2026-09-21. See
   [[2026-09-21-wave-client-secret-exposure]]. Unconfirmed whether Bryce
   ever reset it in Wave's dashboard.
2. **Wave API token in a Zapier Code step** — stored in cleartext in the
   Zap's step config. See
   [[2026-09-22-zapier-wave-token-cleartext]]. Rotation explicitly
   deferred at Bryce's request on 2026-09-22 — don't push on this until
   he brings it up again.

## What's left

When Bryce is ready, rotate the Zapier token (generate new in Wave, update the Zap's Code steps, revoke the old
one).

## Blocked on

Bryce's timing — both are explicitly his call on when, not urgent fixes.
