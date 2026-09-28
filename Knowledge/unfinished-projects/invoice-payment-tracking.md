---
title: Invoice payment tracking (cash done, Venmo/Zelle auto-matching next)
tags: [bookkeeper, wave, venmo, zelle]
started: 2026-09-28
updated: 2026-09-28
status: cash reporting built (PR feature/record-invoice-payment, not yet live-tested); Venmo/Zelle auto-matching not started
---

# Invoice payment tracking (cash done, Venmo/Zelle auto-matching next)

## What this is

Bryce wants Wave invoice payments tracked without him manually opening
Wave every time: (1) tell Deja when he's paid in cash and have her mark
the invoice paid, (2) have Venmo and Zelle payments automatically matched
to the right invoice, no manual reporting needed for those two.

## Done: cash reporting

New `record_invoice_payment` Deja tool (`src/index.js`) -- Bryce says "I
got $250 cash from Sparks," Deja finds the matching open Wave invoice and
marks it paid. Always posts into **Cash on Hand**, confirmed directly with
Bryce and in Wave's own "Record a manual payment" UI -- Wave's chart of
accounts also showed the two real bank accounts payments must never touch:
"SPOTLESS CLEANING (694)" and "TOT FREE 0004 (301)".

**Not yet live-tested.** The `invoicePaymentCreate` mutation's exact field
names came from public docs/search results, not confirmed against Wave's
live GraphQL schema directly -- couldn't get a working introspection
session (the public playground at gql.waveapps.com needs a bearer token
we don't have without extracting the live secret, and Wave's own
account-scoped GraphQL explorer wasn't reachable in the time available).
First real use of this tool, with Bryce watching, is what actually proves
or fixes the field names -- same pattern as how
`WAVE_CASH_ON_HAND_ACCOUNT_ID` itself was originally confirmed (see the
"live schema introspection" comment above it in `src/index.js`).

## Not started: Venmo/Zelle auto-matching

Same fundamental problem as [[cleaner-sms-3week-notifications|the Google
Voice texting project]]: neither Venmo nor Zelle (Foothills Bank) has a
public API for reading transaction history. Likely needs the same shape
of solution already built for that project -- a scheduled Claude Code
task using Claude in Chrome to periodically check Bryce's real,
signed-in Venmo and Zelle activity, then match incoming payments to open
Wave invoices by amount and sender name.

Open design questions, not yet discussed with Bryce:
1. **Confidence threshold for auto-marking paid.** An exact amount + name
   match to a single open invoice is probably safe to mark automatically
   (mirrors what `record_invoice_payment` already does for cash). What
   happens on an ambiguous match -- multiple open invoices, or a payer
   name that doesn't exactly match a Wave customer name (Venmo/Zelle
   display names vs. Wave customer names could differ)?
2. **How often to check**, and whether it reuses the same daily scheduled
   task as the cleaner-text pipeline or gets its own.
3. Whether marking paid should require any confirmation at all, or run
   fully automatically once matched -- this is reading + recording a fact
   (not moving money), so it may not need the same approval bar as things
   like assign_cleaner, but worth confirming with Bryce rather than
   assuming.

## Blocked on

Bryce watching a live test of `record_invoice_payment` against a real
cash payment (to confirm the Wave mutation actually works as written)
before starting the Venmo/Zelle phase.
