---
title: Build Turno property into Zapier automations
tags: [unfinished, zapier, scheduler, bookkeeper]
started: 2026-09-23
updated: 2026-09-23
---

# Build Turno property into Zapier automations

Source task: `Knowledge/tasks/2026-09-23-build-turno-property-into-zapier-automat.md`
(still in `Knowledge/tasks/`, not moved to `done/` — this isn't finished).

## What this is

Bryce cleans one property (2211 Sahara Drive, Lake Havasu City) for an
owner ("Urlaub Properties") who manages it themselves via their own
Hospitable account — Bryce doesn't own or manage this listing, isn't on
its Hospitable/Hostaway integration, and gets no webhook access to it.
The goal is the same as the other two Zaps (calendar event, cleaner
assignment, Wave invoice, cancellation handling) but for this property,
built around what Bryce actually has access to.

## Key finding: no direct trigger source

- Turno itself has no Zapier app and no public API (confirmed via
  Zapier's app directory search and web research).
- Airbnb has no native Zapier integration either — this is *why* the
  existing two Zaps are built on Hospitable/Hostaway specifically, not
  Airbnb directly.
- Resolution (from Bryce): he receives an automatic **Hospitable-branded
  email** at his personal `bryce55777@gmail.com` (not his business
  Gmail) every time this property gets a new reservation — sent by the
  owner's Hospitable account, asking if he's available to clean. That
  email has everything needed: address, check-in, check-out, guest
  count, reservation code. This is the trigger source.

## Cleaner assignment logic (from Bryce, verbatim intent)

A priority cascade, not a single assignment:
1. **Amy** first, if she doesn't already have a cleaning that day.
2. If Amy already has a cleaning that day, or if Amy **declines** the
   invite → **Ashley**.
3. If Ashley already has a cleaning that day, or Ashley is unable to
   attend / declines → **Zac**.
4. Zac's email isn't in the roster yet — Bryce will provide it next time
   he sees him. Don't build the Zac fallback as a dead end; just note it
   needs his email added to `DEFAULT_CLEANER_ROSTER` (or KV
   `cleaner_roster`) in `src/index.js` before it can actually fire.

This is meaningfully more complex than the existing `assign_cleaner` tool
(see [[systems/scheduler]]), which only does a single manual invite when
asked. This needs to be *fully automatic* on a new reservation, including
watching for declines and re-inviting the next person — no manual
"assign_cleaner" call in the loop.

**Checking "already has a cleaning that day"**: means checking the shared
"Cleans" Google Calendar for an existing event with that cleaner as an
attendee on the same date — not their personal calendar (Bryce doesn't
have access to that).

**Detecting a decline automatically**: Google Calendar's Zapier
integration has no dedicated "attendee declined" trigger. The workable
approach is the **"New or Updated Event" (instant)** trigger, which fires
on any attendee-status change too (since that's technically an event
update) — filtered down to events on the Cleans calendar where the
invited cleaner's response status is "declined." Needs careful path
design so it doesn't fire on unrelated event edits.

## Progress so far

- Created a Zapier **Email Parser** mailbox:
  **`i0zblclu@robot.zapier.com`**. A real sample email (the one above,
  for 2211 Sahara Drive) has been forwarded there and saved as the
  mailbox's initial template.
- Decided **not** to fight the Parser UI's manual text-highlighting tool
  (dragging to select exact field boundaries proved fragile/imprecise
  over several attempts) — instead, plan is to pull the raw parsed email
  body into a **Code by Zapier** step in the actual Zap and regex-extract
  the address, check-in, check-out, and reservation code from the
  consistent "Reservation:" / "Listing:" block. More robust than
  fighting pixel-perfect drag-selection, and the email format is
  consistent enough (see the saved template) to regex reliably.
- **Gmail auto-forward is now live.** The "Add a forwarding address"
  flow silently failed (dialog just closed, no confirmation email) every
  time it was driven from this session's built-in browser pane — even
  with Bryce completing Google's identity re-verification. It only
  actually went through once Bryce ran the same steps through **Claude
  in his real Chrome browser** instead; see
  [[agent-notes/browser-automation-notes]] for the lesson. Once the
  forwarding address was verified (confirmation link clicked from the
  parser mailbox), a targeted Gmail filter was created:
  `from:(support@hospitable.com)` → forward to
  `i0zblclu@robot.zapier.com`. Only Hospitable's notification emails
  forward — nothing else in Bryce's personal inbox is affected, and nothing
  needs to be forwarded by hand anymore.

## Still open / blocked

1. **Wave invoice customer**: still need the customer name/details this
   property's invoices should be billed under (different from Bryce's
   other properties). Asked, not yet answered.
2. **Zac's email**: not yet available; needed before the third fallback
   tier can actually work.
3. **The actual Zap hasn't been built yet** — only the Email Parser
   mailbox/template and the Gmail-side trigger pipeline exist. Still to
   do once the above unblock:
   - Trigger: New email in the parser mailbox.
   - Code step: regex-extract address, check-in, check-out, reservation
     code from the raw body.
   - Find/create the calendar event on the Cleans calendar.
   - Check Amy's availability that day → invite her, or fall through
     to Ashley → Zac per the cascade above.
   - Separate path/Zap watching for a decline on one of these events to
     trigger the next fallback invite.
   - Wave invoice creation under the correct customer once known.
   - Cancellation handling: delete the calendar event and the draft
     invoice if the reservation is cancelled. Note: the existing
     invoice-deletion logic (Path E in the invoicing Zap) is
     itself still broken/unfixed per
     [[unfinished-projects/zapier-overseer-buildout]] — don't copy it
     as-is; fix or verify it first.

## Why this is tracked here and not just in the task queue

This spans way more than one session's worth of back-and-forth
(technical discovery about Turno/Airbnb/Hospitable, several rounds of
requirements from Bryce, live Zapier/Gmail account work) — exactly what
`Knowledge/unfinished-projects/` is for. Delete this file once the Zap is
actually built, tested, and the source task is moved to
`Knowledge/tasks/done/`.
