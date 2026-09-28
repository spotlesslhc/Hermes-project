---
title: correct_invoice_payment briefly left a real invoice with no payment
tags: [decisions, hermes, bug, wave]
date: 2026-09-28
---

# correct_invoice_payment briefly left a real invoice with no payment

## What happened

Correcting invoice #474 (Silvia's $169.75, mis-recorded as cash instead of
Zelle) failed mid-correction: the old cash payment was deleted, then the
new Zelle payment failed to record because the account lookup couldn't
find "checking6481". Invoice #474 was left `SENT` with no payment on it
for several minutes, real money notwithstanding — the actual Zelle deposit
was never at risk, only Wave's record of it.

## Why, two separate bugs

1. **`findWaveAccountByName`'s query wasn't filtered.** Wave's chart of
   accounts includes a system "Accounts Receivable" sub-account per
   customer, which drowned out the real bank accounts in the unfiltered
   200-item page — the error message that's supposed to list real accounts
   for Bryce to pick from was useless noise instead. Fixed by filtering
   the query to `subtypes: [CASH_AND_BANK]`.
2. **`correctWaveInvoicePayment` deleted before validating.** It deleted
   the existing payment, *then* tried to resolve the destination account —
   so a bad account name (triggered by bug 1) left the invoice with
   nothing on it. Fixed by extracting the account resolution into
   `resolveWavePaymentAccount` and calling it before any delete happens,
   so a validation failure now leaves the original payment untouched. If
   the create step itself somehow still fails after the delete, the error
   now says plainly "invoice #X currently has NO payment in Wave, retry
   immediately" instead of a generic message.

## What caught it

Deja herself. She refused to guess at the invoice's state after the first
failure and asked for the exact account name and confirmation before
retrying — which is what surfaced the real problem instead of stacking a
second bad write on top of the first. This is worth reinforcing, not just
noting: it's the "common sense" Bryce asked about earlier the same day
([[deja-memory]]) — grounded caution here, not a rule anyone wrote for her.

## Worth remembering

1. **Any "correct/replace" tool that deletes-then-creates needs to validate
   everything it can *before* the delete**, not discover a problem
   mid-flight. `record_cleaner_payment` and `record_invoice_payment` don't
   have this shape (they only ever create), so this risk is specific to
   `correct_invoice_payment` and anything built like it later.
2. **A lookup's own error-listing is only useful if the underlying query
   is filtered to what a human would actually recognize.** "Real accounts:
   [200 Accounts Receivable entries]" isn't a usable answer to "which
   account did this land in" — worth checking any other Wave lookup in
   this codebase for the same kind of noise before it causes the same
   problem elsewhere.
