---
title: Path G (invoicing Zap) had Path E's original bugs, plus a matching field that never existed
tags: [decisions, zapier, bookkeeper, mistake]
status: fixed
updated: 2026-09-26
---

# Path G (invoicing Zap) had Path E's original bugs, plus a matching field that never existed

## What happened

Following up on [[zapier-overseer-buildout|the Zapier Overseer buildout]]'s
open item to fix Path G in "Hospitable Reservations to Wave Invoices" —
flagged back when Path E was first fixed, since both paths were written
at the same time and Path G was "not fully read line-by-line."

Path G fires on `Action` exactly matching `reservation.changed` and is
meant to find the invoice for the reservation being changed, delete it,
and recreate it with the updated details (new checkout date, possibly a
different property). It had never worked, same as Path E before its own
fix.

## Bug 1: same three mechanical bugs as Path E, before its fix

- Endpoint was `https://gql.waveapps.com/` instead of
  `https://gql.waveapps.com/graphql/public`.
- Search query was a top-level `invoices(first: 100, filter: {...})` —
  Wave's schema has no top-level `invoices` field and no `filter`
  argument; invoices live under `business(id:) { invoices(page:,
  pageSize:) }` and have to be matched client-side.
- The `invoiceDelete` and `invoiceCreate` mutations used the wrong
  input/output field names (`id` instead of `invoiceId`, `deletedId` and
  `userErrors` instead of `didSucceed` and `inputErrors`). Wave's real API
  never returns a `userErrors` field, so the old code's own error-checking
  would have silently done nothing even if the mutation partially worked.

## Bug 2: the old invoice was never findable by design, not just by typo

Past the mechanical bugs, Path G searched for the old invoice by matching
the reservation's `code` against the invoice `description` field. Checked
directly against a real Create Invoice step (Path B, "8. Create Invoice")
in Zapier's own Configure screen: **Item Description is left blank on
every invoice this account creates**, and there's no other field where a
reservation code gets written. So even with the endpoint and query fixed,
this search would have returned zero results every time — the same "always
zero, for a structural reason, not a typo" shape as Path E's original Bug 1.

**Fix**: replaced the code-based search with the same matching approach
already verified working in Path E — filter the business's invoices
client-side by customer name (`Jacob Whitaker`) + `DRAFT` status +
`invoiceDate` equal to the checkout date + the property name appearing in
an item's `description` (Wave apparently backfills a blank line-item
description with the product's own name when read back — this is why
Path E's identical approach works against real invoices despite the
Item Description field being blank at creation time).

## Also replaced: hardcoded business/customer/product IDs

The original code hardcoded `business_id`, `customer_id`, and a
property-name-to-`product_id` mapping. None of these had ever been
exercised successfully, so there was no way to know if they were even
correct. Replaced all three with name-based lookups (business
"Spotless Cleaning", customer "Jacob Whitaker", product matched to
`property_name`) — the same "always resolve by name, never trust a
hardcoded ID" rule already called out for the two-business account in
[[systems/zapier-automations]], now applied consistently everywhere this
account's code touches Wave.

## Verification

Ran "Run Code" twice against the step's real (non-synthetic) test data,
hitting the live Wave API both times:

1. First run: no matching DRAFT invoice existed yet → correctly created a
   new one (invoice #469, "1795 Palo Verde Boulevard South", checkout
   2026-08-16).
2. Second run: found that exact invoice, deleted it, and created a fresh
   replacement (Wave reused invoice number 469) — confirming both the
   delete and the create halves work end to end, not just one or the
   other.

Published as v6. The resulting throwaway draft invoice from testing
(#469, 1795 Palo Verde, 2026-08-16) needs deleting from Wave the same way
Path E's #469 test invoice did.

## What to do differently next time

- When a bug is found in one code step written alongside a sibling step
  (Path E and Path G were built together), check the sibling directly
  rather than assuming "probably has the same issue" — Path G turned out
  to have an *extra*, structurally different bug (matching by a field
  that was never populated) that a search-and-replace fix modeled purely
  on Path E's diff would have missed entirely.
- Before trusting that a "search by X" pattern will work, confirm X is
  actually written somewhere retrievable by checking a real, already-
  configured create/write step in the same tool — don't assume a field
  name implies the data is actually there.
