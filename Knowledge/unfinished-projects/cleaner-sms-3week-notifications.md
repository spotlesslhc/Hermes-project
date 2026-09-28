---
title: Text cleaners their cleanings 3 weeks out (Google Voice)
tags: [scheduler, google-calendar, sms, google-voice]
started: 2026-09-27
updated: 2026-09-27
---

# Text cleaners their cleanings 3 weeks out (Google Voice)

## What this is

Bryce wants cleaners notified by text, not just by being added to the
Cleans calendar event — but only once a cleaning is within **3 weeks** of
its date. Cleanings further out than that shouldn't be surfaced to
cleaners at all yet. Applies to **all properties** (Sahara, Columbine,
Palo Verde, Unit 324, and Fremont/Bluegill once
[[fremont-bluegill-airbnb-automation|that's built]]), not just the two
new Airbnb properties that prompted the conversation.

Decisions made 2026-09-27 (via AskUserQuestion):
- **Scope**: all properties, not just Fremont/Bluegill.
- **Notification mode**: text is **in addition to** the existing Cleans
  calendar invite/attendee, not a replacement.
- **Channel**: Bryce wants to keep using his existing **Google Voice**
  number specifically (rejected Twilio) — accepting the risk of an
  unofficial/reverse-engineered integration over buying a new number.

## Research so far (2026-09-27)

Google has no official API for sending SMS through Google Voice. A quick
search turned up only community-maintained, apparently unmaintained
reverse-engineered libraries (e.g. `node-google-voice`, `autogvoice` on
GitHub) that scrape/replay Google's internal web protocol — no official
support, no stability guarantee, and technically against Google's terms
of service for that product. None have been evaluated hands-on yet (not
installed, not tested against Bryce's real account).

**Flag for Bryce**: this is a real risk for something the cleaning
business will depend on weekly — an unofficial library can silently break
whenever Google changes something client-side, with no changelog or
warning. Worth deciding explicitly whether that's acceptable before
building on top of one, versus the Twilio alternative already declined.

## What's left

1. **Bryce decides**: proceed with an unofficial Google Voice library
   (and which one), or revisit Twilio/another real API, before any code
   gets written against a specific approach.
2. **Design the 3-week trigger.** Likely a scheduled check (reusing the
   existing Cloudflare Cron Trigger pattern from
   [[systems/payroll|the payroll reminder]]) that scans upcoming Cleans
   calendar events and fires a text the first time a cleaning crosses the
   3-week-out threshold — needs a way to avoid re-texting the same
   cleaning every time the cron runs (e.g. a KV flag per event once
   texted).
3. **Message content**: property, date, time, cleaner pay — same info
   already in the calendar event description, reformatted for a text.
4. **Sending mechanism itself**: once the library/approach is picked,
   this is a real "send a message on Bryce's behalf" action — per this
   project's safety rules, sending messages isn't something Claude/Hermes
   does unattended without an explicit approval step, so this likely
   needs to go through the approval queue
   ([[systems/approval-queue|APPROVAL_REQUIRED_TOOLS]]) like other
   real-world-effect tools, at least until proven reliable — same
   "build once supervised, document as a playbook, then wire in the
   mechanical piece" pattern as
   [[playbooks/README|the bookkeeping playbooks]].
5. **Test against a real upcoming cleaning** crossing the 3-week mark
   before trusting it for all cleaners.

## Blocked on

Bryce's decision on the Google Voice integration approach (item 1 above).
