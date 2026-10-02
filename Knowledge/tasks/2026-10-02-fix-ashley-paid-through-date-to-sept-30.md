---
title: Fix Ashley paid-through date to Sept 30
requested: 2026-10-02T19:29:25.435Z
target: dashboard
status: pending
---

# Fix Ashley paid-through date to Sept 30

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Ashley's cleaner payroll record has paidThrough = 2026-10-01. Bryce says payroll actually went out on September 30th, so it should be 2026-09-30. Because of the wrong date, her 2211 Sahara Drive clean on Oct 1 is treated as already paid, and she still hasn't been paid for it. Please change her paid-through date to 2026-09-30, then check get_cleaner_payroll for Ashley and confirm that the Oct 1 Sahara clean now shows as owed, with the amount. Deja has no tool to edit a paid-through date. record_cleaner_payment only moves it forward.
