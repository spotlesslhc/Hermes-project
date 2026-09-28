---
title: Bryce's own calendar account was silently counted as "the cleaner"
tags: [decisions, hermes, bug, scheduler]
date: 2026-09-28
---

# Bryce's own calendar account was silently counted as "the cleaner"

## What happened

Bryce got the daily 3-week-out Telegram approval text and noticed several
"reminder" lines (cleanings framed as already having an accepted cleaner)
were actually attributed to `spotlesscleaninglhc@gmail.com` — his own
account, not a real cleaner. He flagged it: that address shows up as an
attendee on his Cleans calendar events as a leftover from when he used to
share the calendar manually, and should always be ignored when looking
for who's actually assigned.

## Why

`runDailyCleanTextCheck` (`src/index.js`) scanned **every** calendar
attendee for a `responseStatus === "accepted"` match, with no check for
whether that attendee was an actual cleaner. Google Calendar auto-marks
an event's organizer/sharer as "accepted" — so `spotlesscleaninglhc@gmail.com`
always came back as "the accepted cleaner" on any event where no real
cleaner had ever been invited, before the code even got a chance to check
whether one had been.

The consequence was worse than a cosmetic text-message mislabel: because
those cleanings looked staffed, the **invite-cascade logic below it never
ran for them at all** — no cascade invite ever went out to Amy or Ashley
for a cleaning that genuinely had nobody assigned. The bug was silently
suppressing real cleaner invites, not just misnaming who was in them.

Concretely, on 2230 Fremont Dr (9/28): Ashley *had* actually accepted her
invite — the event genuinely was staffed. But `.find()` returns the first
match, and Bryce (the organizer) was listed before Ashley in the attendee
array, so the check found him first and never got to her. It wasn't that
the cascade silently failed on every affected event — some were genuinely
unassigned, some (like this one) were staffed but mislabeled. Either way,
the check couldn't be trusted without filtering to real cleaners first.

## Fix

Filter calendar attendees down to the roster's real cleaner emails
(`cleanerEmails = new Set(Object.values(roster))`) once per event, before
any of the accepted/pending/tried logic runs. Fixes all three spots that
had the same unfiltered-attendee-scan shape in this function. Also added
a read-only `list_upcoming_cleanings` Deja tool using the same fixed
logic, so "what's unscheduled" can be answered by checking live instead
of reasoning from an old Telegram message or a calendar screenshot.

## Worth remembering

1. **A calendar's attendee list can carry stale, human artifacts that look
   like real data** — an old sharing habit, an auto-accepted organizer,
   anything not cleaned up when the workflow moved on. Any code reading
   `event.attendees` needs to filter to the specific set it actually cares
   about (roster emails here), never scan everyone and assume the first
   match is meaningful.
2. This kind of bug is invisible from the output alone — the Telegram
   message looked plausible ("cleaner: property, date") right up until
   Bryce recognized his own email. Worth treating any list Deja/Hermes
   produces with a "does a name in here actually make sense" skepticism,
   not just trusting the code ran without erroring.
3. **Don't re-diagnose a live system from a stale snapshot.** The first
   attempt to answer "what's actually unscheduled" reasoned from the same
   old Telegram text instead of checking current state, and called at
   least one already-staffed cleaning "unassigned" as a result. Once a bug
   like this is suspected, the old output is untrustworthy for anything
   beyond spotting the bug itself — verify live, don't extrapolate.
