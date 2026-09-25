---
title: Scheduler — cleaner assignment via Google Calendar invites
tags: [systems, hermes, scheduler]
updated: 2026-09-23
---

# Scheduler — cleaner assignment via Google Calendar invites

Built 2026-09-23, requested via the Claude Code task queue (see
[[claude-code-task-queue]]) alongside a broader ask to give Hermes real
tool access for Scheduler and Zapier Overseer.

## How Bryce actually assigns cleaners

Confirmed directly from his real Google Calendar, not assumed: every
turnover is one event on the **"Cleans"** calendar. Assigning a cleaner
means inviting them to that event as a guest (by email); they accept or
decline the invite, and a decline means Bryce tries the next cleaner.
Event descriptions hold job details as free text — bed/bath count, door
code, supply location, pay amount. Calendar event **color** (Peacock vs
Basil) is **not** about which cleaner is assigned — Bryce clarified it
marks same-day-checkin cleans (Basil) vs. not (Peacock).

**Standard event format** (confirmed with Bryce 2026-09-25, when backfilling
cleans the webhooks missed): a timed **single-day** event, 10:00–16:00
America/Phoenix, on the checkout date — never multi-day (the few multi-day
events on the calendar are Bryce's own one-off edits, not a pattern to
copy). Title, location and description are copied from that property's
previous cleans. The color rule is driven by the description text: if it
says "Same day checkin", use Basil (`colorId` 10); otherwise Peacock
(`colorId` 7). Columbine's events are marked Free rather than Busy. No
cleaners are invited when an event is created — that's a separate step.

The Turno automation's `findOrCreateTurnoEvent` (`src/index.js`) follows
this format (fixed 2026-09-25): it copies the description from the latest
existing Sahara clean rather than hardcoding it — the repo is public, and
descriptions hold door and supply codes — reuses any Sahara clean already
on that date, and always creates Peacock, since a new reservation email
can't know whether the next guest checks in the same day.

This system automates exactly that motion rather than inventing a
separate assignment mechanism.

## How it works

1. Hermes calls the `assign_cleaner` tool (in `src/index.js`) with a
   property and a cleaner name.
2. `assignCleaner()` looks up the most recent unassigned reservation for
   that property in the `reservations` KV list (the same list
   `/webhooks/reservation` writes to), resolves the cleaner's email from
   a small roster, and POSTs to a dedicated Zap's webhook.
3. That Zap — **"Assign Cleaner to Turnover (Hermes)"** in Zapier —
   finds the matching Cleans calendar event and adds the cleaner as a
   guest, using Zapier's own already-authenticated Google Calendar
   connection. Hermes never needed its own Google credentials for this.
4. On success, the reservation is marked `assigned: true` in KV, the
   Scheduler status card's `unassigned` count updates, and the action is
   logged.

This only sends the invite — it doesn't know if the cleaner accepts. If
Bryce later says someone declined, he (or Hermes) just calls
`assign_cleaner` again with the next cleaner to try, the same way Bryce
already works today.

## Why the Zap matches by street number, not full address

Hospitable's property-name format doesn't match Bryce's calendar event
titles — e.g. `"1795 Palo Verde Boulevard South"` (Hospitable/Zapier
invoicing data) vs. `"1795 Paloverde Blvd South"` (the actual calendar
event title). A full-address search found nothing. The street number
alone is consistent across both and is unique across Bryce's active
properties, so the Zap's "Find Event" step searches on that instead —
`Text.extract_number()` was tried first but didn't evaluate as expected
in that field, so the Worker sends a pre-extracted `street_number` field
directly in the webhook payload instead of relying on a Zapier formula.

## The cleaner roster

`DEFAULT_CLEANER_ROSTER` in `src/index.js` — currently just Amy
(`abyers402@icloud.com`) and Ashley (`alolmaugh22@gmail.com`), found by
reading Bryce's actual calendar invites. Bryce also uses a third cleaner,
**Zac**, "when needed," but his email wasn't findable in the calendar or
Google Contacts — add him to the roster once Bryce has that email
(`HERMES_KV` key `cleaner_roster`, JSON object of `name: email`,
overrides the default; there's no dashboard UI for editing it yet).

## What this doesn't do (yet)

- No automatic detection of a decline — Bryce (or Hermes, if told) still
  has to notice and re-assign.
- No approval gating — Bryce explicitly chose automatic sending over
  requiring his approval per assignment, since that's Scheduler's whole
  job and the action is low-risk/reversible (removing an attendee is
  simple if it picks wrong).
- `zapier_overseer` in `DEFAULT_STATUS` is still a hardcoded stub —
  unrelated to this build, tracked separately in
  [[unfinished-projects/zapier-overseer-buildout]] (formerly
  `Knowledge/unfinished-projects/zapier-overseer-buildout.md`).

## Related: what each cleaner is owed

The "Pay is $X" line in each event's description (documented above) is
also what [[payroll]] reads to compute what's owed to each cleaner —
built 2026-09-26, see that doc for how it works.
