---
title: "Open loose end: Wave API token stored in cleartext in a Zapier Code step"
tags: [decision, security, wave, zapier]
updated: 2026-09-22
---

# Open loose end: Wave API token stored in cleartext in a Zapier Code step

**Status: known, rotation deferred at Bryce's request (2026-09-22).**

## What happened

Bryce's Zapier automation for Wave invoices uses two separate connections:

- The native Wave app integration (steps like "Find or Create Customer" and
  "Create Invoice"), authenticated via a Zapier connection.
- A raw Wave API token pasted directly as input into one or more Zapier
  Code steps, used for direct GraphQL calls (querying invoices, deleting
  them on booking cancellations, updating them on reservation changes) —
  operations the native integration doesn't cover.

That token is stored in cleartext inside the Zap's Code step configuration
in Zapier, which is a real exposure surface: anyone with access to that
Zap (or an export/share of it) can read it in plain text.

## What to do

Rotate the token in Wave's API settings, update the Zapier Code steps with
the new value, and revoke the old one — same shape as the fix for
[[2026-09-21-wave-client-secret-exposure]]. Bryce has explicitly asked to
hold off on this for now — don't rotate it or push on this until he
brings it up again.
