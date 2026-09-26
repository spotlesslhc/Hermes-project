---
title: Zapier automations — what's actually there
tags: [systems, zapier, zapier-overseer, bookkeeper, scheduler]
updated: 2026-09-26
---

# Zapier automations — what's actually there

Documented 2026-09-22 by Claude Code, driving Bryce's real Zapier account
directly (Bryce signed the session's browser into Zapier), as groundwork
for the [[zapier-overseer-buildout|Zapier Overseer buildout]]. This
started as a read-only survey but ended up including two real edits Bryce
explicitly authorized — see "Changes made" at the bottom.

**Note on the review process**: the first pass at this doc badly
undercounted both Zaps' actual structure — Zapier's canvas only renders
what's in view, and paths sitting further left/right of the visible
window are easy to miss entirely, not just collapsed. See
[[2026-09-22-zapier-review-missed-paths]] for what went wrong and the
now-standing rule: always scroll a Zap's full canvas in every direction,
and use "Edit Zap" rather than the read-only view, before concluding a
path or step doesn't exist.

## The Zaps (2 remaining; a third was deleted, see below)

### 1. "Add Hostaway reservations to Google Calendar" (v16, active)

Despite the name, **its trigger is a Hospitable webhook**, not a native
Hostaway trigger — Bryce confirmed Hostaway itself isn't actually used;
the name is just stale. Flow:

1. Catch the Hospitable webhook.
2. POST the payload onward to a second Zapier catch-hook URL
   (`hooks.zapier.com/hooks/catch/28466122/...`) — this is what feeds the
   invoicing Zap below.
3. Split into paths by property:
   - 206 Columbine Drive → create calendar event
   - 1795 Palo Verde Boulevard South → create calendar event
   - Path E ("If [property] AND status = cancelled") → **Find Events +
     Delete Event**
   - "If reservation.changed" → a Formatter (Date/Time) step, then
     **Find Events + Delete Event** — the other cancellation-handling
     path, for webhooks where Hospitable's `Action` is
     `reservation.changed` rather than a plain `status: cancelled`
   - A nested split: QueensBay Unit #324 → create event, and an
     **"Other properties (fallback)"** branch → create event for anything
     not explicitly matched

Reasonably complete — real fallback and cancellation-handling logic.
Both cancellation paths, and all four create-paths, now correctly guard
against re-processing a cancelled reservation — see the two real bugs
fixed 2026-09-26 below.

**Two real bugs found and fixed 2026-09-26** (root cause + what to watch
for next time is in
[[decisions/2026-09-26-calendar-zap-cancellation-bugs]]):

1. **Find Events never actually matched anything** (v13→v15). Both
   cancellation paths' `Start Time Before` field was set to the
   reservation's own `Check Out` timestamp, but Zapier's `Start Time
   Before` bound is *exclusive* and a cleaning event's start time always
   *equals* checkout exactly — so the search silently matched zero events
   on every single run, for every property, since this Zap existed. The
   Delete Event step then always failed with `Required field "Event"
   (eventid) is missing`. Fixed by adding a Formatter (Date/Time,
   Add/Subtract Time) step that computes `Check Out + 1 hour` and using
   *that* as `Start Time Before` instead. A plain text-append hack
   (`+1 hour` typed next to the Check Out pill) does **not** work — Zapier
   doesn't run relative-offset text through its date parser when a pill
   already resolves to an explicit ISO timestamp; it has to be a real
   Formatter step.
2. **Cancelled reservations still created a fresh "confirmed" event**
   (v15→v16). The 206 Columbine, 1795 Palo Verde, and "Other properties
   (fallback)" create-paths only checked the property name — no status
   condition at all — so they ran on *every* webhook for that property,
   cancellations included. QueensBay's path already had `AND Status does
   not exactly match cancelled` (matching the invoicing Zap's own
   Paths A/B/C pattern below); the other three didn't. Fixed by adding
   the same condition to all three. This is very likely what produced the
   duplicate "Cleaning - [property]" events found and deleted on
   2026-09-26 — every past cancellation for those three properties
   probably re-created the event moments after (or before) the
   since-fixed Find+Delete step failed to remove it.
3. **All Google Calendar steps pointed at the wrong calendar.** Both
   cancellation paths and all four create-paths had their `Calendar`
   field set to "Test Auto Cleanings" (a leftover dev/testing calendar,
   ID `7d08e24f...@group.calendar.google.com`) instead of the real
   "Cleans" calendar Bryce actually uses (`spotlesscleaninglhc@gmail.com`).
   Switched all 8 steps to Cleans in v16. Watch for this: changing a
   step's Calendar field in Zapier's UI silently clears any "Event"
   field on a downstream Delete Event step that was mapped by picking a
   specific event from that calendar's list — it has to be switched to
   "Custom value" and re-mapped to the Find Events step's `ID` field
   after the calendar change, or the step ends up with an empty
   required field.

### 2. "Hospitable Reservations to Wave Invoices" (now v6, active)

Triggered by a Catch Hook, fed by Zap #1's POST step. This one is much
bigger than it first looked — **7 paths total (A, B, C, D, E, F, G)**,
though F appears to have been deleted at some point (no gap-filling
theory needed elsewhere — see the linked mistake note for why that
distinction matters):

- **Path A** (QueensBay Unit #324), **Path B** (206 Columbine Drive),
  **Path C** (1795 Palo Verde Boulevard South): each fires when *that
  property's* reservation status is exactly "cancelled" (and Action ≠
  "reservation.changed") → Wave Find-or-Create-Customer → Wave Create
  Invoice. This is consistent across all three, so it's very likely
  intentional — almost certainly a **cancellation-fee invoice**, not
  backwards logic (an earlier pass here wrongly called Path C's logic
  "backwards"; retracted). All three have a live "field not available in
  current sample" warning on their Action condition — a real, shared
  field-mapping staleness issue (see below). Since **v4** the Find
  Customer steps no longer create a customer on a miss (Bryce's rule:
  always find existing Wave records, never create). Each Create Invoice
  step's **Invoice Date is mapped to `1. Check Out`**, i.e. the cleaning
  date — Bryce's rule that invoice date = cleaning date is already met
  here (confirmed in v5, 2026-09-25).
- **Path D**: required the property field to equal all three properties
  above simultaneously (AND, not OR) — logically impossible, dead code.
  **Bryce confirmed he didn't know what it was for and asked it be
  removed; it has been deleted and republished (now v3).**
- **Path E**: fires on **any** cancelled reservation (no property
  filter) → a Code-by-Zapier Python step that queries Wave's GraphQL API
  for a **DRAFT** invoice matching the checkout date + property name (via
  item description), and deletes it if found. This is the invoice
  cancellation-deletion logic Bryce described earlier in the session —
  it does exist, contrary to what the first pass at this doc concluded.
  The customer name it searches by is **hardcoded to "Jacob Whitaker"**
  rather than read from the parsed `user` field — Bryce confirmed every
  reservation from this Hospitable webhook is actually under that name,
  so this isn't currently a bug, just non-obvious/fragile if that ever
  changes. **It never worked until v5** (2026-09-25): wrong endpoint,
  wrong query shape, and wrong mutation fields meant every run failed
  before touching Wave. Fixed and verified end to end on a real throwaway
  draft invoice (#469, confirmed gone in Wave's own UI). The live code
  lives in the Zap itself; the full debugging trail is in git history for
  `Knowledge/unfinished-projects/zapier-overseer-buildout.md`.
- **Path G**: fires on `Action` exactly matching "reservation.changed" →
  a second Code-by-Zapier Python step that finds the reservation's
  existing invoice, deletes it, and recreates it with the updated
  checkout date/property. **Never worked until v6 (2026-09-26)** — see
  [[decisions/2026-09-26-invoicing-zap-path-g-bugs]]: it had the exact
  same endpoint/query/mutation-field bugs Path E had before its own fix,
  plus a structural one of its own — it searched for the old invoice by
  matching the reservation's `code` against the invoice description, but
  no invoice this account creates ever has that code written anywhere on
  it, so the search could never have found anything even with the
  mechanical bugs fixed. Fixed by switching to Path E's already-verified
  matching approach (customer + DRAFT status + invoice date + property
  name in an item description) and replacing the hardcoded business/
  customer/product IDs with name-based lookups. Verified end to end
  against the real Wave API (create-when-missing, then find+delete+
  recreate on a second run).

**Wave GraphQL gotchas learned fixing Path E** (apply to Path G and any
new Wave code — `src/index.js`'s working queries are the reliable
reference):
- Endpoint is `https://gql.waveapps.com/graphql/public`.
- The account has **two businesses** ("Personal" and "Spotless
  Cleaning") — always select by name, never `edges[0]`.
- Invoices live under `business(id:) { invoices(...) }`, not top-level.
  `invoices` takes **no `filter` argument** and paginates with
  `page`/`pageSize`, not `first` — match customer/date/status client-side.
- `invoiceDelete(input: { invoiceId })` returns `didSucceed` and
  `inputErrors`, like `invoiceCreate`.
- `raise_for_status()` hides Wave's error body — include
  `e.response.text` in the error so GraphQL errors are actually visible.

**Run history**: 40 runs in the last 30 days (as of the first pass),
zero errored / handled-error / needs-review / filtered. All "successful."
Important limitation either way: Zapier's own success/failure tracking
won't catch a path with impossible conditions, or one that quietly finds
no matching invoice to delete — both look like ordinary successful runs.

### 3. "1328 Piper Dr - Hostaway to Google Calendar" — deleted

Was disabled, hadn't run in 60+ days, and was sitting as an incomplete,
unpublishable draft (pre-existing, not something this review caused).
Bryce confirmed he doesn't use it. **Moved to Zapier's trash** (30-day
recoverable window, then permanent) during this session.

## Cross-cutting issue: stale Hospitable field mappings

Multiple warnings across the invoicing Zap's Paths A, B, and C (and
previously the deleted draft on Zap #3) all say the same thing: *"This
mapped value isn't available in the current sample."* Consistent with
Hospitable's webhook payload schema having changed at some point without
every downstream field mapping catching up. Worth fixing directly in
Zapier at some point — a good early candidate for what real Zapier
Overseer functionality should watch for, beyond "did a run error."

## Changes made during this review (both explicitly authorized by Bryce)

1. **Deleted Path D** from "Hospitable Reservations to Wave Invoices" —
   impossible conditions, confirmed dead code, Bryce didn't know its
   purpose and asked for it to be removed. Published as v3.
2. **Moved "1328 Piper Dr - Hostaway to Google Calendar" to trash** —
   confirmed unused by Bryce, was already broken/incomplete and disabled.

Also cleaned up: two stray "draft based on v_" copies that Zapier
auto-created when this review opened the editors for Zaps #1 and #2 were
deleted (no actual edits in either, just navigation).
