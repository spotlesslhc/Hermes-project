---
title: Payroll paid-through was stamped with the recording date
tags: [decisions, payroll, bug]
date: 2026-10-02
---

# Payroll paid-through was stamped with the recording date

## What happened

The Sept 30 payroll run was recorded on Oct 1, and `recordCleanerPayment`
set `payroll:paid_through:ashley` to Oct 1 (the recording date). "Owed"
only counts jobs through yesterday, so the payment covered jobs through
Sept 30, but the Oct 1 Sahara job was treated as already paid.

A queued task asked to reset her date to 2026-09-30. That would have
been wrong: Bryce had already paid Sahara by hand on Oct 1 and booked it
in Wave, so Oct 1 was correct by coincidence and resetting it would have
caused a double payment.

## Fix

PR #87: paid-through is now the last job the payment actually covered
(unchanged if none), not the day it was recorded.

## Next time

- Before "correcting" stored dates or amounts, ask whether the real-world
  payment has already happened outside the system.
- Paid-through means "jobs covered," not "when it was recorded."
