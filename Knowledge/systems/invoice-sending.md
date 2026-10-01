# Invoice sending (4pm job)

Bryce's rule (2026-10-01): **an invoice is sent on its cleaning date, after
the cleaning, and cleanings end at 4pm Arizona.** Never earlier. Every
invoice the system creates (the Worker for Sahara/Turno, the Zapier
"Hospitable Reservations to Wave Invoices" zap for the rest) is a Wave
**DRAFT** dated on the cleaning date; sending is a separate step done only
by this job. See [[zapier-automations]] and [[turno-scheduling]].

## What runs, when

`runInvoiceSendCheck` (`src/index.js`), cron `0 23 * * *` = 4pm Arizona daily
(Arizona has no DST). Steps:

1. **Fact-check** (`auditDraftInvoices`): every draft is compared with the
   Cleans calendar. The property comes from the invoice's catalog item
   (street number); the invoice is **ok** only if a clean for that property
   is on the invoice date.
2. **Postponed cleans**: if there's no clean that day, the Bookkeeper looks
   in the move log (KV `clean_moves`, written by `reschedule_clean`, follows
   A→B→C chains). If the log proves the clean moved, the draft's date is
   corrected automatically (`moveDraftInvoiceDate`: creates the replacement
   draft first, then deletes the old one, logging both numbers/ids; Wave
   gives the new draft a new invoice number).
3. **Cancelled cleans**: `cancel_clean` (Deja's tool, approval-gated; removes
   the calendar event and emails invited cleaners) and `cancel_turno_clean`
   (Sahara) both write to the KV `clean_cancellations` log. If a draft has no
   clean on its date and the log has a cancellation for that property and
   date, the Bookkeeper **deletes the draft** (logging customer, items and
   id so it can be recreated). `keep_invoice: true` (a cancellation fee Bryce
   wants to bill) holds the draft for him instead; it's never auto-sent or
   deleted. Deletion only happens when the calendar has no clean that day, so
   a re-booked date is safe.
4. **Amount check**: every line must be billed at its catalog item's standard
   rate in Wave (`item.price` vs `product.unitPrice`), and the total can't be
   $0. A different price (discount, typo, rate change) is held as a problem,
   not sent; Bryce either fixes the draft in Wave or sends it himself. Date
   fixes preserve the original line price.
5. **Anything else is a problem**, never auto-fixed or sent: no clean on that
   date and no recorded move (maybe cancelled), duplicate drafts for the same
   property/date, no recognizable property, no customer email. Bryce gets a
   Telegram message (once per problem per week) and an Activity log entry.
6. Drafts that passed and are dated today or earlier go into **one pending
   approval** (`send_wave_invoices`) on the dashboard, plus a Telegram
   nudge. Future-dated drafts are never sent.
7. When Bryce approves, `sendWaveInvoices` re-checks every invoice (still a
   draft, still matches the calendar, amount still right, not future-dated), then calls Wave's
   `invoiceApprove` and `invoiceSend` (PDF attached, to the customer's Wave
   email). Wave can't un-send, so it's deliberately strict. If approve
   succeeds but send fails, the Activity log says so loudly: Bryce sends that
   one from Wave.

`audit_draft_invoices` is Deja's read-only version (changes nothing).

## Known gaps / things to watch

- **Untested against live Wave.** `invoiceApprove`/`invoiceSend` and the
  `customer { email }`, `items { product }` query fields come from Wave's
  published schema but had not been run when this shipped. First run is
  gated by Bryce's approval; check the Activity log after it.
- **Cancellations made by hand in Google Calendar aren't logged** either; an
  orphan draft then shows as a mismatch. Tell Deja to cancel.
- Zapier's cancelled-reservation paths (A-C) create invoices for cancelled
  reservations, likely cancellation fees; if one of those lands as a draft
  with no clean on its date, it shows as a mismatch for Bryce, not deleted.
- A deliberately discounted invoice is held by the amount check; fix it to
  the standard rate or send it by hand.
- `price`/`unitPrice` Wave field names are from the published schema and
  untested live; if the audit query errors, check those first.
- **Moves made by hand in Google Calendar aren't in the move log**, only
  `reschedule_clean` ones. Such an invoice shows as a mismatch and Bryce is
  told (calendar dates are listed in the message); he fixes the date.
- The audit looks 14 days back / 90 days ahead on the calendar and the first
  1,000 Wave invoices.
- Recurring/Zapier invoices with several properties on one invoice are
  flagged for hand-checking, not sent.
- To reverse a date move: recreate the draft with the old date (old number
  and id are in the Activity log). A sent invoice can't be reversed.
