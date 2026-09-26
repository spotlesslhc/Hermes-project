---
title: Fremont & Bluegill Airbnb automation
tags: [scheduler, bookkeeper, zapier, google-calendar, wave, airbnb]
started: 2026-09-25
updated: 2026-09-26
---

# Fremont & Bluegill Airbnb automation

## What this is

Two more Airbnb properties, same owner ("Jamie - Dube Vacation Rentals"),
need the same full automation the Hospitable/Hostaway properties and
[[turno-scheduling|2211 Sahara Drive]] already have: calendar event on
cleaning day, cleaner assignment/invite, Wave invoice. Bryce has real
account access to the owner's Airbnb account ("pair it any way needed")
but explicitly does **not** have access to the owner's email inbox —
that rules out simply repeating 2211 Sahara's Gmail-forwarding trigger
as-is, since there's no inbox to forward *from* on the owner's side.

## What's done so far

**Both properties identified and confirmed live in Wave/Calendar
already** (all verified directly, not assumed):

- **2230 Fremont Dr, Lake Havasu City, AZ 86406** — 6BR/3.5BA. Airbnb
  listing title: "Sleeps 16 Pool, Spa, Game Room, Casita, Fire Table"
  (Airbnb's internal short name for it: "Fremont").
- **3628 Bluegill Dr, Lake Havasu City, AZ 86406** — 8BR/4BA. Likely
  Airbnb listing "HavaMansion-Sleeps 22 Casita Pool Pickleball Spa"
  (internal name "Bluegill HavaMansion") — **address not yet confirmed
  against this listing**, see "Blocked on."

**Wave already has what's needed, no new records required:**
- Customer **"Mommy"** (scoobydubedo@hot..., existing balance
  $1,175/$675 overdue as of 2026-09-25) — both properties bill to this
  one customer, per Bryce.
- Products **"Fremont"** ($250) and **"BlueGill"** ($425) already exist
  with those exact names.

**Both already have manually-maintained events on the "Cleans" Google
Calendar** — title "2230 Fremont Dr" / "3628 Bluegill Dr", 10am–4pm
(matches the standard format in [[systems/scheduler|scheduler]]),
description includes door codes + cleaner pay ($180 Fremont, $300
Bluegill) + a permanent "Same day checkin" note. No reservation-source
metadata on them — Bryce appears to be maintaining these by hand today,
which is exactly what this project replaces. Fremont's checked instance
already had Ashley invited as cleaner; Bluegill's checked instance had
none.

**Cleaner cascade wanted: Ashley primary, Amy secondary** — the reverse
of [[turno-scheduling|Turno's]] `TURNO_CLEANER_CASCADE = ["amy", "ashley"]`
order. Roster emails already known from `src/index.js`:
`DEFAULT_CLEANER_ROSTER` — `amy: abyers402@icloud.com`,
`ashley: alolmaugh22@gmail.com`.

**Trigger mechanism decided: co-host, not iCal polling.** Bryce found
out he can add himself as a co-host on the owner's Airbnb listings —
Airbnb sends reservation/cancellation notifications to a co-host's own
inbox, which solves the no-email-access problem entirely. This means
the plan reuses 2211 Sahara's proven mechanism (Gmail filter → Zapier
Email Parser → Worker webhook → real branchy code) almost exactly, but
with **first-party Airbnb emails** landing directly in Bryce's own
`bryce55777@gmail.com`, not secondhand/guessed-format forwarded ones —
actually more reliable than what 2211 Sahara has today (whose
cancellation-email handling is still unverified against a real email).

**Co-host invite in progress**, done via a second Claude session/agent
("Claude cowork") that had the owner's Airbnb account open in its own
browser — Bryce relayed instructions and responses back and forth
manually rather than the two sessions messaging directly.

- Access level chosen: **"Calendar and messaging access"**, not Full
  access. Reasoning: the automation only needs to *detect* bookings/
  cancellations, not edit anything on Airbnb's side — Full access would
  additionally grant calendar editing, listing changes, damage-request
  handling, and the ability to add other co-hosts, none of which this
  needs, on someone else's real business account. (Airbnb's third tier,
  view-only "Calendar access," was rejected because it's unclear whether
  view-only calendar actually generates the email notifications this
  whole plan depends on — messaging access is the more likely real
  channel for that.)
- Fremont invite: sent to `bryce55777@gmail.com` as of 2026-09-26.
- Bluegill invite: **status unconfirmed** — see "Blocked on."
- Whether Bryce has actually accepted either invite yet (co-host access
  isn't live until accepted): **unconfirmed.**

## What's left

1. **Confirm co-host status**: both invites sent (Bluegill's address
   matched against 3628 Bluegill Dr first), and `bryce55777@gmail.com`
   has accepted both. Nothing else here can be tested until this is
   real and live.
2. **Set up the email trigger**: a Gmail filter on `bryce55777@gmail.com`
   for Airbnb's actual reservation/cancellation notification emails
   (need a real one to arrive first to know the exact `from:`/subject
   pattern — don't guess, this is exactly the mistake 2211 Sahara's
   cancellation path made), auto-forwarding to a new (or reused) Zapier
   Email Parser mailbox.
3. **New Worker webhook route + logic** in `src/index.js`, modeled
   directly on the Turno property section (`parseTurnoReservationEmail`-
   equivalent parsing, `assignTurnoCleaning`-equivalent cascade with
   `["ashley", "amy"]` order for these two properties specifically —
   don't touch the existing Turno cascade order, this is a separate,
   per-property cascade — calendar event create/move via
   `findOrCreateTurnoEvent`-equivalent, `createWaveInvoiceForProperty`
   reused as-is with customer "Mommy" and product "Fremont" or
   "BlueGill" depending on which property parsed out of the email).
   Whether this can literally reuse the existing Turno functions
   (parameterized by property) or needs its own near-duplicate section
   is a real design call to make once the actual email format is known.
4. **Test end-to-end** with a real (or realistically simulated) booking
   and cancellation before trusting it — same bar as
   [[zapier-overseer-buildout|Path E's fix]]: verify both the code's own
   report and the actual downstream state (calendar event, Wave
   invoice), not just that it ran without erroring.
5. Decide whether the existing "Same day checkin" note that's hardcoded
   into both properties' current manual event descriptions needs to
   become dynamic (computed per booking, like the Hospitable properties'
   same-day-checkin color convention) or can stay a permanent fixed note
   — unclear from what's been seen so far whether that's literally
   always true for these two properties or just happened to be true on
   every checked instance.

## Blocked on

Waiting on Bryce to relay back from the "Claude cowork" session: whether
the Bluegill invite was sent (and its address confirmed as 3628 Bluegill
Dr), and whether `bryce55777@gmail.com` has received and accepted both
co-host invites. Nothing in "What's left" can start until co-host access
is confirmed live.
