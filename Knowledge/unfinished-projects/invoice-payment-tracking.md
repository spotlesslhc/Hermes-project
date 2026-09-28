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
$250 cash from Sparks" or "Silvia paid $169.75 by Zelle into checking6481,"
Deja finds the matching open Wave invoice and marks it paid. Cash always
posts into **Cash on Hand** (confirmed directly with Bryce and in Wave's
own "Record a manual payment" UI); Zelle/Venmo post into whichever real
bank account Bryce names, looked up by name via `findWaveAccountByName`
rather than hardcoded -- Bryce has more real accounts than the two
originally known ("SPOTLESS CLEANING (694)" and "TOT FREE 0004 (301)");
"checking6481" turned up 2026-09-28 recording the Silvia payment below.

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

Bryce deciding whether the hands-free phase is worth building at all --
it's a real new project (scheduled Claude in Chrome automation against
his signed-in Venmo/Zelle, same shape as the cleaner-texting pipeline),
not a small extension of what exists now. The reporting-based version
above (tell Deja, she matches and posts correctly) may be good enough on
its own.
