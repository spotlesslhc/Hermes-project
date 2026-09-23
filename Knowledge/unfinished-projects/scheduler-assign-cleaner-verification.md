---
title: Verify assign_cleaner's success path against a real booking
tags: [scheduler]
started: 2026-09-23
updated: 2026-09-23
---

# Verify assign_cleaner's success path against a real booking

## What this is

`assign_cleaner` (see [[systems/scheduler]]) shipped and was smoke-tested
live via the dashboard's "Ask Deja" box the same night — but only the
**failure path** got a real end-to-end test (asking to assign Amy to
1795 Palo Verde correctly returned "no unassigned turnover found," since
the `reservations` KV list was genuinely empty at the time). The
**success path** — finding a real unassigned reservation and actually
sending the calendar invite through the new Zap — was never exercised
through the live tool. The Zap itself (the 3 steps: Catch Hook → Find
Event → Add Attendee) was tested successfully in isolation via Zapier's
own "Test step," but that's not the same as Hermes's `assignCleaner()`
function actually finding a match and calling it correctly end to end.

A synthetic test reservation was attempted (writing directly to the
`reservations` KV key) to force a real success-path test without waiting
for an actual booking, but that write was blocked by the coding
sandbox's safety classifier as a bulk-overwrite risk. Rather than push
past that late at night, this was deliberately left for a real booking
instead.

## What's left

Next time a real reservation comes in and needs a cleaner assigned:
watch that `assign_cleaner` actually finds it and the invite lands
correctly (check the Cleans calendar event gets the right attendee).
If it doesn't work as expected, this is the first real signal something
in the matching logic (street-number extraction, reservation lookup) is
off — until then, treat that path as unverified in production, even
though the code and the Zap are each individually confirmed working.

## Blocked on

A real unassigned booking arriving, or explicit permission to write test
data directly into the `reservations` KV key.
