---
title: Invoice payment tracking (reported cash/Zelle/Venmo done, hands-free auto-matching next)
tags: [bookkeeper, wave, venmo, zelle]
started: 2026-09-28
updated: 2026-09-28
status: reporting for all three methods built and live-tested; hands-free (no reporting) auto-matching not started
---

# Invoice payment tracking (reported cash/Zelle/Venmo done, hands-free auto-matching next)

## What this is

Bryce wants Wave invoice payments tracked without him manually opening
Wave every time: (1) tell Deja when he's been paid and have her mark the
invoice paid, correctly routed by method, (2) eventually have Venmo and
Zelle payments matched automatically with no reporting needed at all.

## Done: reported payments (cash, Zelle, Venmo)

`record_invoice_payment` Deja tool (`src/index.js`) -- Bryce says "I got
$250 cash from Sparks" or "Silvia paid $169.75 by Zelle," Deja finds the
matching open Wave invoice and marks it paid. **Cash, Zelle, and Venmo all
post into Cash on Hand by default** -- confirmed directly with Bryce
2026-09-28: the outside bank account his Zelle/Venmo payments land in
("checking...6481") isn't linked to Wave at all, so he's always put those
in Cash on Hand too, same as cash. `account_name` (looked up via
`findWaveAccountByName`) is only used when Bryce explicitly names one of
the two accounts that *are* actually linked to Wave -- "SPOTLESS CLEANING
(694)" or "TOT FREE 0004 (301)" -- never inferred from the payment method.
An earlier version of this tool wrongly assumed Zelle/Venmo always needed
a named bank account; see
[[2026-09-28-correct-invoice-payment-left-invoice-unpaid]] for what that
cost.

Also added `correct_invoice_payment` for when a payment's already been
marked paid with the wrong method/account -- deletes the existing Wave
payment and re-records it correctly, since `record_invoice_payment` only
ever touches *open* invoices and can't fix its own mistake.

**Live-tested, in a roundabout way.** The first real attempt (recording
$169.75 cash from Silvia, 2026-09-28) failed with
`GRAPHQL_VALIDATION_FAILED` -- the guessed mutation name and field names
were wrong. Fixed by confirming the real schema directly against Wave's
published API reference (see
[[2026-09-28-record-invoice-payment-wrong-graphql-mutation]]). The second
attempt succeeded (invoice #474, marked paid as cash) -- except it turned
out Bryce actually got paid by Zelle, which is what surfaced the need for
payment-method routing in the first place, and became the live test for
`correct_invoice_payment` too.

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

Bryce confirmed 2026-09-28: he does want the hands-free phase eventually,
but wants to watch the reporting-based version (above) run correctly for
a while first before building the bigger automation on top of it --
deliberate staging, not an open question about whether to build it. Don't
start the Venmo/Zelle auto-matching project until he says he's ready to
move past manual reporting.
