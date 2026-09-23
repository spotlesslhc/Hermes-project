---
title: Zapier automations — what's actually there
tags: [systems, zapier, zapier-overseer, bookkeeper, scheduler]
updated: 2026-09-22
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

### 1. "Add Hostaway reservations to Google Calendar" (v13, active)

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
   - Path E / "If reservation.changed" → **Find Events + Delete Event**
     (cancellation/change handling for the calendar side)
   - A nested split: QueensBay Unit #324 → create event, and an
     **"Other properties (fallback)"** branch → create event for anything
     not explicitly matched

Reasonably complete — real fallback and cancellation-handling logic.

### 2. "Hospitable Reservations to Wave Invoices" (now v3, active)

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
  field-mapping staleness issue (see below).
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
  changes.
- **Path G**: fires on `Action` exactly matching "reservation.changed" →
  a second Code-by-Zapier Python step, using a hardcoded Wave
  `customer_id` (not a name lookup) — presumably updates rather than
  deletes. Not fully read line-by-line; worth a closer pass if this
  becomes load-bearing.

**Open question, not yet resolved**: Bryce said "invoice deletion needs
rebuilding," which was said believing (based on this doc's first,
incorrect pass) that no such logic existed. Now that Path E is confirmed
to exist and look plausible, it's unclear whether it's actually broken in
practice (worth asking Bryce directly what he's observed) or whether he
just wasn't aware it existed. Don't assume either way — ask before
"rebuilding" something that might already work.

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
