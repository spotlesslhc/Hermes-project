---
title: Send invoices only after cleaning, on cleaning day
requested: 2026-10-01T08:03:27.183Z
target: dashboard
status: pending
---

# Send invoices only after cleaning, on cleaning day

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Bryce wants to change how invoicing works: "I do not want invoices sent prior to the cleaning date. They should all be sent on their cleaning date, after the cleaning. Cleanings end at 4pm on the cleaning day." So: no invoice should be sent before the cleaning date. Each invoice should go out on its cleaning date, after the cleaning is done, with 4pm (Lake Havasu City / Arizona time) treated as the end of the cleaning. Invoices can still be created as drafts earlier, but sending should be held until 4pm on the cleaning day. Check wherever invoices are currently created/sent (dashboard code, Zapier, Wave) and apply this to all customers, including the Turno/Sahara drafts.

## Progress (2026-10-01, Claude Code)

Code audit result: **nothing in this Worker sends invoices.** Every
automated path creates Wave invoices as `DRAFT` (`createWaveInvoiceForProperty`,
`invoiceCreate` with `status: "DRAFT"`), and the only other automation is the
Zapier "Hospitable Reservations to Wave Invoices" zap (see
[[zapier-automations]]). So whatever sends early is either a Zapier step
setting or Bryce sending by hand.

Bryce chose: **audit Zapier first, no new automation.** Still to do, in a
session with a real browser (Claude in Chrome, Bryce present, per
[[browser-automation-notes]]; this cloud session had no browser access to
Zapier): open each Wave Create Invoice step (Paths A, B, C and the Sahara/Turno
flow) and check for a send/approve option; turn off anything that sends
before the cleaning date; then record the rule (send only on the cleaning
date, after 4pm Arizona) in [[zapier-automations]] and [[turno-scheduling]],
and move this file to `done/`. Fallback if Zapier isn't the cause: build a
4pm-AZ send job gated through `APPROVAL_REQUIRED_TOOLS`.
