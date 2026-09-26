---
title: Recording a cleaner payment as a Wave payroll expense
tags: [systems, hermes, bookkeeper, playbooks, payroll]
updated: 2026-09-25
status: stable
---

# Recording a cleaner payment as a Wave payroll expense

## What this covers

Every time Bryce actually pays Amy or Ashley (Venmo or Zelle), the
payment also needs a matching expense entry in Wave so his books stay
current. Bryce doesn't use Wave's built-in Payroll feature for this —
these are plain manual expense transactions.

## Steps

Done once by hand on 2026-09-25 (see
`Knowledge/unfinished-projects/` git history and
[[unfinished-projects/cleaner-payroll-automation]]), then wired into
`createWavePayrollExpense` (`src/index.js`), called automatically by
`recordCleanerPayment` right after a payment is logged:

1. Create a **withdrawal** transaction (Wave's `moneyTransactionCreate`
   mutation — found via live schema introspection, since Wave's docs
   don't cover it): anchored on the **Cash on Hand** account, `direction:
   WITHDRAWAL`.
2. Its one line item is categorized to **Payroll – Salary & Wages**,
   `balance: INCREASE` (confirmed live: this is what actually shows up
   as an expense in that category, not `DEBIT`/`CREDIT`, which are also
   valid enum values but not the ones that produce the expected result).
3. **Description**: `"<Cleaner>- <job> <date> <job> <date> ..."` — the
   same `paymentNote` already computed for the Venmo/Zelle note (see
   [[payroll]]), full property street names (no house numbers), no
   abbreviations. Matches the format Bryce used in his own manual
   entries once he confirmed he only abbreviated to save time and full
   names were preferred.
4. **Date**: the day the payment was actually sent (not the last job
   date) — Bryce's explicit instruction on 2026-09-25, a deliberate
   change from his own older habit of dating by the last job covered.
5. `externalId` is set to the payment record's own KV id (a UUID) so a
   retried call can't create a duplicate transaction in Wave.

Account IDs are hardcoded in `src/index.js`
(`WAVE_CASH_ON_HAND_ACCOUNT_ID`, `WAVE_PAYROLL_SALARY_ACCOUNT_ID`) —
Wave's API has no way to look up an account by name, only by paginating
the full account list (which, for this business, includes hundreds of
auto-generated per-invoice "Accounts Receivable" entries). If Bryce ever
renames these two Wave accounts, these constants need updating by hand.

## Judgment calls

- **Backfilling missed payments** (e.g. a Venmo payment that was never
  logged in Wave): find it by checking Venmo's payment history with that
  cleaner directly (the "Between you" tab on their Venmo profile filters
  out everyone else), one Wave transaction per Venmo payment, dated by
  when it was actually sent.
- **Wave categorization only** — this never touches Venmo/Zelle or moves
  real money. It's purely a bookkeeping record of a payment that already
  happened.

## How to reverse this

Wave's API has no delete mutation for transactions (confirmed via schema
introspection) — undo one by hand in Wave's UI: Accounting > Transactions
> find it > the row's dropdown menu > Delete. Confirmed working during
testing: a $0.01 throwaway test transaction was created, verified
correct in the UI, then deleted this way with no trace left.

## What Hermes can do vs. what stays Claude/Bryce-only

**Fully automated, no approval gate** — this is a deliberate exception to
this repo's usual default (gate anything real-world through
[[approval-queue]]): Bryce explicitly said, while this was being built,
"you can go ahead and create the expense as it is not moving any actual
money and it will be easy to delete or edit if it is wrong." Unlike
`cancel_turno_clean` (which deletes a real invoice and calendar invite)
or any future tool that actually sends a payment, a Wave bookkeeping
entry is cheap to correct and doesn't touch money in motion, so it runs
automatically as part of `recordCleanerPayment` — the same moment the
payroll tracking itself gets updated, not a separate step. If it fails,
`recordCleanerPayment` still succeeds and logs the failure to Activity
for Bryce to enter manually — it never blocks payroll tracking.

**Still a one-time human judgment call**: fixing a mismatch (Bryce paid a
different amount than computed) or backfilling a payment from before
this system existed.
