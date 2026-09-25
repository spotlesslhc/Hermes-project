---
title: Turno property (2211 Sahara Drive) scheduling & invoicing
tags: [scheduler, bookkeeper, zapier, google-calendar, wave]
---

# Turno property (2211 Sahara Drive) automation

Bryce cleans this property for an owner ("Urlaub Properties") who manages
their own Hospitable account — Bryce isn't on that integration and gets
no webhook access to it. This system exists to get the same automation
(calendar event, cleaner assignment, invoice) that the Hospitable/Hostaway
properties get, built around what Bryce actually receives.

## Trigger path

Turno has no Zapier app or public API, and Airbnb has no native Zapier
integration either. The real trigger is a Hospitable-branded email the
owner's account sends to Bryce's **personal** Gmail
(`bryce55777@gmail.com`) on every new reservation, asking if he's
available. A Gmail filter (`from:(support@hospitable.com)`) auto-forwards
those to a Zapier Email Parser mailbox. A small Zap ("Turno property
(2211 Sahara) to Deja") POSTs the raw subject + body to the Worker's
`/webhooks/turno-reservation` — that's Zapier's entire job here, no Paths
or Code steps.

## Why this is real Worker code, not Zapier Paths

The cleaner cascade plus the postponement rule ("if more than two
cleanings on a day, push to the next day or two, as long as no upcoming
check-in blocks it") is genuinely branchy logic. Same call as the Spotify
integration: real code in `src/index.js`, not a maze of Zapier Paths.
This required giving Deja her own Google Calendar OAuth connection (a
first — every other calendar action reuses Zapier's own connection
instead), since the Worker needs to *read* calendar availability, not
just fire a one-way webhook.

## What's live (`src/index.js`, "Turno property automation" section)

- `parseTurnoReservationEmail` / `parseHospitableDate` — regex-extract
  check-in, check-out, reservation code from the raw email text.
- `assignTurnoCleaning` — the cascade: try Amy, then Ashley, on the
  check-in date (checked against the shared "Cleans" Google Calendar, not
  their personal calendars). If both already have a cleaning that day and
  the Cleans calendar shows no other check-in within the next 2 days
  (`TURNO_MAX_POSTPONE_DAYS`), postpones a day at a time, retrying the
  cascade fresh each day. If still stuck, logs to the Activity feed for
  manual attention instead of guessing.
- `findOrCreateTurnoEvent` / `inviteCleanerToEvent` — creates or moves an
  all-day event on the Cleans calendar and invites the chosen cleaner via
  a real Calendar API call.
- `createWaveInvoiceForProperty` — runs automatically right after a
  cleaner is successfully invited. Finds customer "Sparks" (Wave
  customer #94260584) and product "2211 Sahara Drive" ($150, Wave's own
  configured rate) by exact case-insensitive name match; **never creates**
  either if no match is found — throws instead, so a lookup miss can't
  silently fragment Bryce's real records. Doesn't block the cleaner
  invite if invoicing fails; logs it separately as needing a manual
  invoice.
- Google Calendar OAuth (`handleGoogleCalendarLogin/Callback`,
  `getGoogleCalendarAccessToken`) — one-time-authorize, refresh-token-in-
  KV pattern, same as [[spotify-control]]. "Connect Calendar (Turno)"
  dashboard tile starts it. Must be connected as
  `spotlesscleaninglhc@gmail.com` specifically — that's the account that
  owns the "Cleans" calendar (Bryce has two Google accounts; whichever
  authorizes last wins, since only one refresh token is stored).
- Two read-only diagnostic routes, safe to hit any time without creating
  real events/invoices: `/api/google-calendar/status`,
  `/api/wave/status`.

## Known limitation: 7-day token cap

The Google OAuth app is unverified (External, requesting the sensitive
`calendar` scope). Google caps refresh tokens for unverified apps
requesting sensitive scopes at **7 days** regardless of publish status.
Bryce needs to revisit "Connect Calendar (Turno)" roughly weekly or this
silently stops working (calls fail with "Google Calendar isn't connected
yet"). Real fix is submitting the OAuth app for Google verification
(needs a public privacy policy page + a review that can take days) — not
done.

## Deliberately not built

- **Zac (third cascade tier)**: Bryce said build it without him for now.
  Once his email exists, add `zac: "<email>"` to `DEFAULT_CLEANER_ROSTER`
  and append `"zac"` to `TURNO_CLEANER_CASCADE` in `src/index.js` — the
  cascade loop is roster-driven, no other code changes needed.
- **Automatic decline handling**: `isCleanerBusyOnDate` only runs at
  initial-assignment time; nothing re-triggers the cascade if a cleaner
  declines after the fact. Not asked for. Would need either a Cloudflare
  Cron polling the Cleans calendar, or a Zapier "New or Updated Event"
  trigger (Google Calendar has no dedicated "attendee declined" trigger)
  filtered to declined-status changes on the Cleans calendar, calling a
  new Worker webhook.
- **Cancellation handling**: no invoice-deletion or calendar-event-
  deletion logic for this property yet — no observed cancellation-email
  format to parse. Don't copy Path E's invoice-deletion logic from the
  Hospitable invoicing Zap as-is if this gets built later; see
  [[zapier-automations]] for its current state.

## Related fixes made while building this

Two bugs found and fixed that affect more than just this property:

1. `getWaveBusinessId()` was picking `businesses.edges[0]` (an empty
   "Personal" business) instead of matching by name — this affected
   *every* Wave-touching feature in the codebase, not just this one. See
   [[2026-09-24-wave-business-id-picked-wrong-business]].
2. The Hospitable invoicing Zap's find-or-create logic had the same
   duplicate-customer risk this property's requirements called out
   explicitly — checked and fixed across all three of its paths too. See
   [[zapier-overseer-buildout]] (folded into that tracker's history) and
   [[feedback_generalize_fixes_across_equivalent_systems]] for why that
   check happened proactively.
