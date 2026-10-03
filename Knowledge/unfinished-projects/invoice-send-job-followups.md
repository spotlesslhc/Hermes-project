---
title: Invoice send job — what's still unproven
tags: [bookkeeper, invoices, wave, zapier]
started: 2026-10-01
updated: 2026-10-03
status: built and merged; waiting on real runs
---

# Invoice send job — what's still unproven

The 4pm-Arizona send job, calendar fact-check, cancellation/move logs, amount
check and standing discounts are built and merged; how they work is in
[[systems/invoice-sending]]. This file only tracks what's left.

## What's left

1. **First real 4pm runs.** `invoiceApprove`, `invoiceSend`, the invoice
   `discounts` input and the `price`/`unitPrice`/`customer.email` query fields
   follow Wave's published schema but were never exercised live when this
   shipped. Watch the Activity log (Bookkeeper entries) after the first runs
   and fix field names if the audit query errors. Bryce said it "seems to work
   well" on 2026-10-02 for what he's seen so far, but a full approve-and-send
   hasn't been recorded here.
2. **Audit the Zapier invoicing zap for anything that sends invoices early**
   (Paths A-C and the Sahara/Turno flow). Needs a browser session with Bryce
   present (Claude in Chrome); no one has looked yet. If nothing there sends,
   record that in [[systems/zapier-automations]] and close this item.
3. **Moves and cancellations made by hand in Google Calendar aren't logged**,
   so their invoices show up as mismatches for Bryce. Option later: detect
   them by comparing calendar dates to invoice dates.
4. Only Birkdale has a standing discount today (10%); add others through Deja's
   `set_invoice_discount` as Bryce names them. A one-off discount or taxed
   invoice is held back by the amount check by design.

Delete this file once items 1-2 are confirmed and 3 is decided.
