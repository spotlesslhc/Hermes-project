---
title: Automate actually paying cleaners (payroll phase 2)
tags: [bookkeeper, payroll]
started: 2026-09-26
updated: 2026-09-26
---

# Automate actually paying cleaners (payroll phase 2)

## What this is

Bryce wants cleaner payments fully automated eventually. Phase 1 (tracking
what's owed + Bryce recording payments he made himself) is built — see
[[payroll]]. This tracks phase 2: Deja actually sending the money.

## What's done so far

Nothing built yet. Phase 1 is deliberately structured so it can absorb
this later without a rework: `recordCleanerPayment` already separates
"a payment happened" from "how it happened," so phase 2 just needs to
call it after a real transfer succeeds, instead of Bryce calling it by
hand.

## What's left

1. **Research a real payment API first** — this is the actual blocker,
   not implementation effort. Venmo, Zelle, and Cash App (how Bryce pays
   today) have no public API for a business to push money to a person
   programmatically. Candidates to check, in [[payroll]]'s "Phase 2"
   section: Wave's bill-pay features (if any exist beyond invoicing),
   a bank ACH API via Foothills Bank, or a payment processor Bryce would
   need to newly sign up for.
2. Once a real API exists: wire it into `recordCleanerPayment`'s call
   site, gate it through `APPROVAL_REQUIRED_TOOLS` (this moves real
   money, unlike the read/record-only phase 1 tools), and have Bryce
   supervise the first several real payments before trusting it
   unattended — same pattern as [[bookkeeping-playbooks-rollout]].

## Blocked on

Bryce deciding whether to move his actual payment method to something
with a real API — Venmo/Zelle/Cash App don't have one. Don't start
implementation until that's resolved.
