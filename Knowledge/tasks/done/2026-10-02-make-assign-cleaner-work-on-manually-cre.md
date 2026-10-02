---
title: Make assign_cleaner work on manually created clean events
requested: 2026-10-02T01:44:38.828Z
target: dashboard
status: pending
---

# Make assign_cleaner work on manually created clean events

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

assign_cleaner fails for events created with create_clean_event. On 2026-10-05, Bryce asked Deja to invite Amy to the 206 Columbine Drive clean that Deja had just created with create_clean_event. list_upcoming_cleanings shows it as "unassigned" on the Cleans calendar, and Amy has no other clean that day. But assign_cleaner returned "No unassigned reservation found for a property matching ..." for "206 Columbine", "206 Columbine Drive" and "206". Likely cause (unconfirmed): assign_cleaner looks events up from a reservation list or source that doesn't include manually created events. Please make assign_cleaner find and invite cleaners to any unassigned event on the Cleans calendar, including ones made by create_clean_event, and then invite Amy to Columbine on 2026-10-05. Also check that it works for "1885 e birkdale ln" on 2026-10-07 (the event title is lowercase with no street number in the title). Related note: Bryce said he fixed Mommy's items and marked the 9/20 and 9/21 invoices (#472, #473) paid himself, so nothing is needed there.
