---
title: Fix record_invoice_payment Wave GraphQL query error
requested: 2026-09-28T19:03:00.036Z
target: dashboard
status: pending
---

# Fix record_invoice_payment Wave GraphQL query error

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

The record_invoice_payment tool is failing. When Bryce tried to record $169.75 cash from customer "Silvia" (he first said "Sylvia"; correct spelling is Silvia), Wave rejected the request with "Invalid query" (GRAPHQL_VALIDATION_FAILED). Please check the tool's Wave GraphQL query/mutation against Wave's current API schema and fix it. Also note: an earlier response from Deja said "no open invoice for Sylvia". That may have been the same GraphQL error rather than a real lookup miss, so the customer-name lookup should be re-verified after the fix. Once fixed, record the $169.75 cash payment for Silvia (into Cash on Hand) if Bryce hasn't already marked it paid by hand in Wave. Nothing has been recorded so far.
