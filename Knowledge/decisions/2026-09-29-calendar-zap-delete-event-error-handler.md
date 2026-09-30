---
title: Calendar Zap — Delete Event failed when nothing existed to delete (v17)
tags: [zapier, decisions, calendar, mistakes]
date: 2026-09-29
---

# Calendar Zap: Delete Event error handler (v17, 2026-09-29)

## What happened

"Add Hostaway reservations to Google Calendar" errored twice (Sep 27 and
Sep 28) on the same Unit 324 `reservation.changed` webhook (checkout Oct 12).
Step 17 (Find Events) correctly found no clean on Oct 12 — none existed — so
step 18 (Delete Event) failed with `Required field "Event" (eventid) is
missing`. The error halted the Zap, so the create block after it never ran
and no Oct 12 clean was made. Step 17's config was fine (Start Time Before =
Check Out + 1h, End Time After = Check Out); the labels in the run's "Data
in" (`start_time`/`end_time`) are just swapped relative to the UI labels.

Any `reservation.changed` webhook for a booking with no existing clean hits
this.

## Fix (published as v17)

Added an **error handler** on step 18. Zapier branches do not rejoin, so the
Success branch's create block ("Split into paths" + four property
create-paths) was **copied into the Error branch** too ("Paste to replace" on
the placeholder step). Now both outcomes create the clean.

- Autoreplay is turned off for this Zap by enabling error handling.
- The create logic now lives in two places — **edit both** if it changes.
- The pasted copies were not test-run (Create Event tests make real calendar
  events); only the path-condition checks were run, create tests were skipped.

## Mistakes made along the way (draft only, caught before publish)

1. **Wrong step.** Zapier's node list is virtualized and the step menu
   buttons have identical labels; I clicked the first "Delete Event" menu
   (Path E's step 14) instead of step 18. Caught from the renumbering and
   reverted with Undo. Use `find` with position labels or open the target
   step's own panel and confirm its number before adding anything.
2. **Wrong assumption that an error branch rejoins the main flow.** A first
   version used a no-op Formatter filler in the Error branch and would have
   turned a loud failure into a silent "no clean created." Never publish an
   error handler without checking what runs after it.
3. Don't **replay** the failed Sep 28 run — it would duplicate the Oct 12
   Unit 324 clean added by hand.

## Known gap not fixed

Find Events searches at the *new* checkout date. If a guest changes dates,
the old event (at the old date) is never found or deleted.

Related: [[zapier-automations]], [[2026-09-26-calendar-zap-cancellation-bugs]].
