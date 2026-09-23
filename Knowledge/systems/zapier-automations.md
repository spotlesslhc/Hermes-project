---
title: Zapier automations — what's actually there
tags: [systems, zapier, zapier-overseer, bookkeeper, scheduler]
updated: 2026-09-22
---

# Zapier automations — what's actually there

Documented 2026-09-22 by Claude Code, driving Bryce's real Zapier account
directly (Bryce signed the session's browser into Zapier), as groundwork
for the [[zapier-overseer-buildout|Zapier Overseer buildout]]. Nothing was
published or changed — this is a read-only survey. Zapier auto-creates an
editable "draft" copy whenever you open a Zap's editor; two were cleaned
up after this review (see below), neither published.

## The three Zaps

### 1. "Add Hostaway reservations to Google Calendar" (v13, active)

Despite the name, **its trigger is a Hospitable webhook**, not a native
Hostaway trigger — worth knowing if the name suggests otherwise. Flow:

1. Catch the Hospitable webhook.
2. POST the payload onward to a second Zapier catch-hook URL
   (`hooks.zapier.com/hooks/catch/28466122/...`) — this is what feeds Zap
   #2 below.
3. Split into paths by property:
   - 206 Columbine Drive → create calendar event
   - 1795 Palo Verde Boulevard South → create calendar event
   - Path E / "If reservation.changed" → **Find Events + Delete Event**
     (this is the cancellation/change handling for the calendar side)
   - A nested split: QueensBay Unit #324 → create event, and an
     **"Other properties (fallback)"** branch → create event for anything
     not explicitly matched

This one is reasonably complete — it has real fallback and
cancellation-handling logic, unlike Zap #2.

### 2. "Hospitable Reservations to Wave Invoices" (v2, active)

Triggered by a Catch Hook — almost certainly fed by Zap #1's POST step
above, not a separate Hospitable connection. Only **two paths currently
exist**, Path C and Path D:

- **Path C**: property is 1795 Palo Verde AND status exactly matches
  "cancelled" AND Action does not match "reservation.changed" → Wave:
  Find or Create Customer → Wave: Create Invoice. The "Action" condition
  has a live warning: *"This mapped value isn't available in the current
  sample."* Also, creating an invoice specifically when a reservation is
  cancelled is worth double-checking with Bryce — that reads backwards
  from what you'd normally expect (invoice on booking, not on
  cancellation), unless it's intentionally a cancellation-fee flow.
- **Path D**: requires the property field to simultaneously equal three
  different addresses (206 Columbine, 1795 Palo Verde, AND QueensBay Unit
  #324) — a single-value field can't match all three at once, so this
  path is very likely **dead code**; its one action, "Send Outbound
  Email," probably never runs.

**No Code-by-Zapier steps exist anywhere in this Zap today** — neither in
the live version (v2) nor in v1 (its first published version, Aug 14).
This matters: Bryce described Code steps using a raw Wave API token to
query/delete/update invoices on cancellations and reservation changes
(see [[2026-09-22-zapier-wave-token-cleartext]]) — that logic is **not
currently present** in this Zap. Either it lives somewhere not yet found,
or it was removed/never made it into what's live, in which case
cancelled/changed Hospitable reservations may not be getting their Wave
invoices deleted or updated automatically right now. Worth confirming
with Bryce directly rather than assuming either way.

Step numbering starts at 9 for Path C (not 3), even in v1 — suggesting
two earlier paths existed during drafting and were removed before this
Zap was ever published, not as a later live change.

**Run history**: 40 runs in the last 30 days, zero errored / handled-error
/ needs-review / filtered. All "successful." This is an important
limitation for any future oversight tool: Zapier's own success/failure
tracking won't catch a path with impossible conditions or backwards
logic — it just silently never fires, or fires under the wrong
conditions, and still counts as "successful." Real oversight needs
someone (or something) that understands the Zap's actual logic, not just
a poll for failed runs.

### 3. "1328 Piper Dr - Hostaway to Google Calendar" (disabled)

Off, hasn't run in 60+ days. Scoped to a single property: "Path A - 1328
Piper Dr (not cancelled)" creates calendar events, "Path B - IGNORE all
other properties" is a no-op, plus a cancellation-handling branch
(Find/Delete Events, not fully inspected).

Opening it landed directly in an **unpublished, incomplete draft** — a
path condition mapping fields "no longer available," and a "please add an
action" warning meaning it can't even be published as-is. This predates
this review (no edits were made to reach that state) — it looks like
someone started fixing or migrating this Zap and left it unfinished. It
was **not** touched or deleted, since it may be in-progress work.

This Zap is very likely obsolete: Zap #1's "Other properties (fallback)"
branch would now cover 1328 Piper Dr's calendar events. Worth confirming
with Bryce, then deleting if so — a broken, disabled, unfinished draft
sitting in the account is the kind of clutter worth removing once
confirmed dead, same as the Wave `finance_index` migration crossed
similar ground on the code side.

## Cross-cutting issue: stale Hospitable field mappings

Multiple, unrelated-looking warnings across Zaps #1 and #2 and the
draft on #3 all say the same thing: *"This mapped value isn't available
in the current sample."* This is consistent with Hospitable's webhook
payload schema having changed at some point after these Zaps were built,
without every downstream field mapping being updated to match. This is
exactly the kind of drift that's invisible until someone opens each Zap
individually — a good early candidate for what real Zapier Overseer
functionality should actually watch for, beyond "did a run error."

## What was cleaned up during this review

Two stray "draft based on v_" copies that Zapier auto-created when this
review opened Zap #1 and Zap #2's editors were deleted (neither was
published or contained any actual edits — just navigation). The
incomplete draft on Zap #3 was left alone; see above.
