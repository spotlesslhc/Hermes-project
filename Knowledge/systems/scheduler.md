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

**Changed 2026-10-02:** steps 1-4 below describe the original Zap-based
design. `assignCleaner` now reads the Cleans calendar itself (the Worker's own
Google connection, as the Turno automation does) and invites the cleaner to the
soonest *unassigned* clean matching the property (street number, nickname or
location; optional `date`), so it works for any clean on the calendar,
including hand-made and `create_clean_event` ones, and warns if the cleaner is
already on another clean that day. The old Zap ("Assign Cleaner to Turnover
(Hermes)") is no longer called and can be left or turned off.

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

## Creating cleans from Deja (`create_clean_event`, added 2026-10-02)

Deja can add a clean herself (`createCleanEvent`): same standard format as
above, copying title, location, description and free/busy from the property's
latest earlier clean, Peacock unless `same_day_checkin` (then Basil, and the
"Same day checkin" line is added to the description). Matches by street number;
nicknames (`DEFAULT_PROPERTY_NICKNAMES`, currently `ryan` → 1885 E Birkdale Ln,
KV `property_nicknames` overrides) work, and a nicknamed event gets the address
appended so street-number matching (assign_cleaner, the invoice check) works.
No-op if that property already has a clean that day; asks for an address if
there's nothing earlier to copy. No approval (nobody is notified); undo by
deleting the event. Invites nobody — `assign_cleaner` is the next step.
An *existing* event titled just "Ryan" is not fixed by this; rename it in
Calendar (add the street number) so assign_cleaner can match it.

## Related: what each cleaner is owed

The "Pay is $X" line in each event's description (documented above) is
also what [[payroll]] reads to compute what's owed to each cleaner —
built 2026-09-26, see that doc for how it works.

## Cleaner says they never got an invite (`resend_cleaner_invites`)

Amy (iCloud address, no Google Calendar app) relies only on invite emails.
2026-10-02: her address on the events was correct (`abyers402@icloud.com` —
capitalisation doesn't matter) and showed "awaiting", but her inbox was empty.
So the calendar side was fine and the email wasn't arriving (or was sitting
in junk). `resendCleanerInvites` re-sends unanswered invites by removing and
re-adding the guest (Google only emails newly added guests; the removal uses
`sendUpdates=none` so no cancellation goes out). If the re-sent invites still
don't arrive, check Amy's iCloud **Junk** folder and that her real address is
exactly that one; the fallback is the cleaner text reminders
([[unfinished-projects/cleaner-sms-3week-notifications]]) or sharing the event
link by text.

## iCal feed sync (added 2026-10-03)

For properties that only give Bryce an iCal link (e.g. an Airbnb calendar
export), `syncIcalFeeds` reads the feed daily (8am Arizona, with the daily
staffing check) and adds **only** a clean on each reservation's checkout date
via `createCleanEvent` — standard 10am–4pm format, nothing from the feed
(guest names, check-in/out blocks, "Not available" owner blocks) reaches the
calendar. A booking starting the same day another checks out gets the
Basil / "Same day checkin" treatment.

- **Setup:** tell Deja "set the iCal feed for 2230 Fremont Dr to <link>"
  (`set_ical_feed`; empty url removes it), then `sync_ical_feeds` to run now.
  Links are stored in KV `ical_feeds`, never in the repo (public) and never
  logged — an iCal link works like a password for that listing's calendar.
- Each property needs an earlier clean on the Cleans calendar to copy
  title/location/description from (else pass an address via create_clean_event).
- Synced bookings are remembered (`ical_synced:<uid>`), so a clean Bryce
  deletes by hand isn't recreated. A changed checkout date adds a clean on
  the new date and logs a note to check the old one.
- **Not handled:** cancelled bookings disappear from the feed but their clean
  isn't deleted automatically — use `cancel_clean`. Invites nobody and makes
  no invoice (`assign_cleaner` / `create_wave_invoice` are the next steps).
