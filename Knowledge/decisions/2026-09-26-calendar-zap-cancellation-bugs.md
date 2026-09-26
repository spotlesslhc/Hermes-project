---
title: Two real bugs in the calendar Zap's cancellation handling
tags: [decisions, zapier, scheduler, mistake]
status: fixed
updated: 2026-09-26
---

# Two real bugs in the calendar Zap's cancellation handling

## What happened

A real Hospitable cancellation (206 Columbine Drive, checkout 2026-09-27)
came through and Zapier flagged the run as errored. Investigating it
turned up two separate, real bugs in "Add Hostaway reservations to Google
Calendar" — see [[systems/zapier-automations]] for the live Zap detail —
plus a third issue (wrong calendar) found while fixing them.

## Bug 1: Find Events could never match, for any property, ever

Both cancellation-handling paths (`Path E` and `If reservation.changed`)
delete the matching Cleans calendar event by first running Find Events
with `Start Time Before` set to the reservation's own `Check Out`
timestamp. Zapier's `Start Time Before` is an **exclusive** bound — it
only matches events whose start is strictly earlier — but every cleaning
event's start time is set to exactly checkout, never before it. So the
search always returned zero results, and Delete Event always failed with
`Required field "Event" (eventid) is missing`.

**Why this wasn't caught sooner**: an errored Delete Event step still
means the run shows as "Errored" in Zapier's history, which should have
been visible — but nothing was watching that history until a cancellation
happened to be looked into directly. This is the same blind spot flagged
in [[systems/zapier-automations]]'s note on the invoicing Zap: Zapier's
own success/failure tracking doesn't distinguish "ran fine" from "ran and
silently did nothing useful" unless something downstream also fails
loudly.

**Fix**: added a Formatter by Zapier (Date/Time → Add/Subtract Time) step
that computes `Check Out + 1 hour`, and used that computed value as
`Start Time Before` instead of `Check Out` directly. Verified by loading
the real failed run's data as a test record and confirming Find Events
now returns the actual duplicate "Cleaning - 206 Columbine Drive" event.

**A dead end worth remembering**: the first fix attempt just typed
`+1 hour` as literal text next to the `Check Out` pill in the same field.
This produced garbage (`+1 hour2026-09-27T10:00:00-07:00` if the pill
comes second, or an unparsed literal either way) — Zapier does not run a
field through its relative-date parser when it already contains a pill
that resolves to an explicit ISO timestamp. A real Formatter step is
required for date math on top of a mapped value.

## Bug 2: cancelled reservations still created a fresh duplicate event

Once Bug 1 was fixed and the stale event was actually being deleted, a
full "Replay this run" on the cancelled reservation immediately created a
**new** "confirmed" event for the same slot. The 206 Columbine, 1795 Palo
Verde, and "Other properties (fallback)" create-paths only ever checked
the property name (`Address Display contains "<property>"`) — no status
condition at all — so they run on *every* webhook for that property,
including cancellations, unconditionally re-creating the event the
cancellation path had just removed.

QueensBay Unit #324's create-path was the one exception: it already had
`AND Status does not exactly match cancelled` `AND Action does not
exactly match reservation.changed`, matching the pattern the *other* Zap
("Hospitable Reservations to Wave Invoices") already uses on its own
Paths A/B/C. Nobody had gone back and applied that same guard to the
three paths added after QueensBay's.

**Fix**: added `AND Status does not exactly match cancelled` to all three
missing paths.

**What this likely explains**: the handful of duplicate "Cleaning - 206
Columbine Drive" events found and deleted on 2026-09-26 (dated back to
2026-09-21) were almost certainly created this way — a past cancellation
(or even just Hospitable re-sending the same webhook) hitting the
unconditioned create-path.

## Bug 3 (found while fixing the above): wrong calendar entirely

All 8 Google Calendar steps across both cancellation paths and all four
create-paths were pointed at "Test Auto Cleanings" — a leftover
development/testing calendar — instead of the real "Cleans" calendar
Bryce actually uses day to day. Fixed by switching all 8 to Cleans.

**Operational gotcha hit while doing this**: switching a step's
`Calendar` field in Zapier's UI silently clears any `Event` field on a
downstream Delete Event step that had been set by picking a specific
event from a static list scoped to the old calendar. The field has to be
switched to "Custom value" and remapped to the upstream Find Events
step's `ID` output after changing the calendar, or Delete Event ends up
with an empty required field and the step looks broken again.

## What to do differently next time

- When one path in a set of sibling paths (same trigger, same kind of
  action) has a guard the others don't, treat that as a real bug to fix,
  not a style inconsistency — QueensBay having the status check while its
  three siblings didn't was the actual root cause of Bug 2, and it was
  visible in the Zap the whole time.
- Before trusting a Google Calendar "Find X then delete/update X" pattern
  in Zapier, check whether any time-bound field (`Start Time Before/
  After`, `End Time Before/After`) is being compared against a value that
  could land exactly on the boundary — Zapier's bounds are exclusive, and
  an event whose start time is deliberately set to match some other
  timestamp exactly (like checkout time here) is exactly that case.
- After changing a Calendar field on any Google Calendar step, re-check
  every other field on that same step (and on any step downstream that
  references "the event" by a specific static value) before assuming the
  edit was self-contained.
