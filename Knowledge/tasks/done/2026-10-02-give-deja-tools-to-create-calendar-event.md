---
title: Give Deja tools to create calendar events and Wave invoices
requested: 2026-10-02T01:28:44.132Z
target: dashboard
status: pending
---

# Give Deja tools to create calendar events and Wave invoices

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Bryce wants Deja to have two new tools:

1) create_clean_event (Scheduler): create a new event on the "Cleans" Google Calendar for a property on a given date, the same way the Zapier calendar zap does. Use the standard event format from Knowledge/systems/scheduler.md: timed single-day event 10:00-16:00 America/Phoenix on the checkout date, with title, location and description copied from that property's previous cleans, and color Basil (colorId 10) if the description says "Same day checkin", otherwise Peacock (colorId 7). It should also match properties by street number and handle nicknames like "Ryan" (1885 E Birkdale Ln) so the address is on the event.

2) create_wave_invoice (Bookkeeper): create a DRAFT Wave invoice for a property cleaning on a given date, just as the invoicing Zapier zap would. It should use the customer and catalog item with the property's standard rate and street number, and apply any standing discount from set_invoice_discount. It should leave the invoice as a draft so the 4pm check and dashboard approval flow still applies to sending it.

Immediate use case: Bryce wants a Columbine (206 Columbine Drive) clean added to the calendar for 2026-10-05. He also wants invoices created for Fremont (2230 Fremont Dr) on 2026-09-24 and 2026-09-28, and for Bluegill (3628 Bluegill Dr) on 2026-09-29. Then Deja will mark both Fremont invoices paid at $250 and the Bluegill invoice paid at $425. Past-dated invoices may need to be created and marked paid without being sent.

Consider whether creation should need dashboard approval (Bryce's call), and note that the "Ryan" event on 2026-10-07 had no street number so assign_cleaner could not match it.
