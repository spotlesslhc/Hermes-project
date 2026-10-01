---
title: Invoice payment tracking (reported cash/Zelle/Venmo done, hands-free auto-matching next)
tags: [bookkeeper, wave, venmo, zelle]
started: 2026-09-28
updated: 2026-10-01
status: reporting live; Zelle auto-matching via bank text alerts built (needs secret + phone forwarding + first real alert to tune); Venmo not started
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

## Zelle auto-matching via bank text alerts (built 2026-10-01)

Bryce said he is ready to move past manual reporting. Decisions (2026-10-01):
daily/ongoing, and **every match goes to Deja's Pending Actions for his click
for at least the first week** (no auto mode exists in the code yet; consider
one only after he's watched it run). Browser-driven Venmo/Zelle logins were
set aside: his bank sends no Zelle emails, so instead his phone forwards the
bank's deposit **text alerts** to a Worker webhook. Design, setup steps and
the open "tune the parser" item: [[systems/bank-text-alerts]].

Left to do: Bryce creates `BANK_ALERT_SECRET`, sets up phone forwarding, and
we adjust `parseBankAlert` against the first real alert. After a week of
clean approvals, decide whether any matches can skip approval.

## Not started: Venmo

Venmo has no text/email forwarding set up here yet. If Venmo sends email
notifications, the same pending-action pattern can read them with the Gmail
tool; otherwise it needs a browser. Neither Venmo nor Zelle has a public API.
Browserbase was ruled out for banking logins (see
[[systems/deja-read-only-tools]]); that boundary stands unless Bryce says
otherwise.

## Original design questions (answered above)

1. Confidence: exact amount (and name when present) to a single open invoice.
2. Frequency: event-driven, per alert text (no polling).
3. Confirmation: always, for now.
