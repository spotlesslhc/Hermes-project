---
title: Build Turno property into Zapier automations
requested: 2026-09-23T22:50:27.759Z
target: website
status: pending
---

# Build Turno property into Zapier automations

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Bryce has one Airbnb property scheduled through Turno instead of Hospitable/Hostaway, and it's currently not wired into any Zap or webhook at all. He wants it built out to match the same general structure as the existing two Zaps ("Add Hostaway reservations to Google Calendar" and "Hospitable Reservations to Wave Invoices"), adapted for Turno and this specific property:

1. New reservation from Turno → create the Google Calendar event (like the per-property paths in Zap #1).
2. Automatically schedule/invite a cleaner for the turnover.
3. Create the Wave invoice for the job — but billed under a different customer/person than the other properties (Bryce will specify who).
4. Support deleting the draft invoice if the reservation is cancelled (same shape as Path E's invoice-deletion logic in the invoicing Zap — but note that logic is currently broken/unfixed per the zapier-overseer-buildout note, so don't just copy it as-is without checking that fix).
5. Delete the calendar event on cancellation too (like Zap #1's "reservation.changed"/cancellation path).

Needs figuring out: does Turno have a native Zapier trigger/app, or does this need a webhook like the Hospitable side does? Check what's available before building. Should probably be its own path/branch off the existing Zaps if Turno's payload shape is compatible, or a parallel small Zap pair if not — use judgment based on what Turno actually offers.

Also flag to Bryce once scoped: this depends on knowing which cleaner to auto-assign for this property and which customer name/details go on this property's invoices.
