---
title: Cleaner payroll automation beyond the browser-assisted flow
tags: [bookkeeper, payroll]
started: 2026-09-26
updated: 2026-09-26
---

# Cleaner payroll automation beyond the browser-assisted flow

## What this is

Bryce wants cleaner payments as automated as possible. The realistic
version — weekly nudge, Claude prefills the payment in Bryce's browser,
he clicks Send — is **built**, see [[payroll]]. This file tracks the one
further step beyond that: removing Bryce's final click entirely.

## What's done so far

Everything except the final click: computing what's owed, generating a
privacy-safe payment note, the weekly Activity-log reminder, and the
session-start check that opens Venmo/Zelle prefilled. See [[payroll]] for
all of it.

## What's left

Removing the final "Bryce clicks Send" step is **not just a permission
change** — Claude never sends money unattended, full stop, regardless of
approval history. Actually removing that step would require:

1. Bryce moving off Venmo/Zelle/Cash App (none have a programmatic
   send-money API) to something that does — a payment processor, or his
   bank's own ACH API. Not evaluated; not something to research further
   until Bryce actually wants to consider switching payment methods.
2. A real payment tool gated through `APPROVAL_REQUIRED_TOOLS` (like
   `cancel_turno_clean`), so Bryce still approves each individual payment
   on the dashboard even if Claude is the one submitting it — this
   wouldn't become fully unattended, just remove the manual browser click.
3. Supervised trial runs before trusting it, same pattern as
   [[bookkeeping-playbooks-rollout]].

## Blocked on

Bryce deciding whether switching payment methods is worth it. Nothing
here blocks the browser-assisted flow already built — that works fine
with Venmo/Zelle as-is.
