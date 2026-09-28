---
title: record_invoice_payment called a Wave mutation that doesn't exist
tags: [decisions, hermes, bug, wave]
date: 2026-09-28
---

# record_invoice_payment called a Wave mutation that doesn't exist

## What happened

Bryce tried to record $169.75 cash from customer Silvia (misspelled
"Sylvia" the first time he said it). Wave rejected it with
`GRAPHQL_VALIDATION_FAILED`. Deja queued the fix via
[[claude-code-task-queue]] rather than drafting it herself.

## Why

`recordWaveInvoicePayment` (`src/index.js`) called a mutation named
`invoicePaymentCreate` with fields `accountId` / a `payment` return field —
all guessed from public docs when the tool was built, and explicitly
flagged as unverified in the code comment at the time ("not yet confirmed
against Wave's live schema... the first real live test with Bryce
watching is what actually proves or fixes this"). That first live test
was this one, and it failed.

The real schema (confirmed against
[Wave's published API reference](https://developer.waveapps.com/hc/en-us/articles/360019968212-API-Reference)):

- Mutation is **`invoicePaymentCreateManual`**, not `invoicePaymentCreate`.
- Input type is `InvoicePaymentCreateManualInput`, with **`paymentAccountId`**
  (not `accountId`), and a required **`paymentMethod`** field
  (`InvoicePaymentMethod` enum — `CASH` for this tool) that the old code
  never sent at all.
- Output field is **`invoicePayment`** (not `payment`).
- `exchangeRate` is also listed as a required `Decimal!` field even though
  its description says it only matters for cross-currency payments — sent
  as `1` here since this business only deals in one currency.

Separately, Deja's earlier "no open invoice for Sylvia" reply was checked
and is **not** the same bug — `findOpenWaveInvoicesForCustomer`'s query
(`invoices`, `amountDue { value }`, `customer { name }`, etc.) was verified
field-for-field against the same schema and is correct. That was a real
miss: an exact-match, case-insensitive name filter against "Sylvia" simply
doesn't match a customer named "Silvia".

## Fix

`recordWaveInvoicePayment` now calls `invoicePaymentCreateManual` with the
correct input shape. See the updated function and its comment in
`src/index.js`.

## Worth remembering

Two things:

1. **A guessed third-party GraphQL schema is a liability the moment real
   money touches it, not before.** The original code's own comment
   correctly flagged this as unverified — but "record_invoice_payment" is
   a no-approval tool by design (Bryce reporting his own fact), so the
   unverified mutation shipped straight to production with nothing
   catching a wrong field name until Bryce hit it live. Worth a second
   look at any other Wave mutation in this codebase built the same way
   (guessed schema, no approval gate) before it gets caught the same way.
2. When a bug report says a lookup "didn't find" something and a *separate*
   mutation is known to be broken, check whether they're actually the same
   failure before assuming so — they can be two unrelated, coincidentally
   adjacent issues (here: a real spelling mismatch, not a hidden instance
   of the GraphQL bug).
