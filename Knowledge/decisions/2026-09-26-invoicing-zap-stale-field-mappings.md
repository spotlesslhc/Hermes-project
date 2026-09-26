---
title: The "stale field mapping" warnings on Paths A/B/C/G weren't actually broken mappings
tags: [decisions, zapier, bookkeeper, mistake]
status: fixed
updated: 2026-09-26
---

# The "stale field mapping" warnings on Paths A/B/C/G weren't actually broken mappings

## What happened

Following up on the last open item from
[[zapier-overseer-buildout|the Zapier Overseer buildout]]: Paths A, B, C
(and, it turned out, G too) in "Hospitable Reservations to Wave Invoices"
all showed a warning icon on their `Action` condition — Zapier's "this
mapped value isn't available in the current sample" message. The vault
previously assumed this meant Hospitable's webhook schema had drifted and
the mapping needed fixing.

## What it actually was

Opened Path A's condition and inspected the Catch Hook's current cached
sample: it had `Code`, `Status`, `User`, `Check In`, `Check Out`, and
`Properties` — no `action` key at all. Confirmed via the field picker
that no field named or resembling "Action" existed in that sample.

Rather than assume the field was gone for good, pulled a fresh sample via
the trigger step's "Find new records." The new sample (from a real,
recent webhook) **did** have `action: reservation.changed` — and it was,
by coincidence, the same 206 Columbine Drive cancellation investigated
earlier this session. This confirms: Hospitable only includes the
`action` key on `reservation.changed`-type webhooks, not on ordinary
accepted/cancelled status webhooks. The cached sample Zapier had on file
simply happened to be of the kind that omits it, so the validator flagged
every reference to `Action` across the whole Zap (Paths A, B, C, and
Path G) as stale — even though the underlying mapping
(`375885985__action`, i.e. "the `action` field from step 1's output") was
correct the entire time and works fine on real traffic that includes it.

**Fix**: selected the fresh sample as the trigger's active test record.
This is a metadata-only change — no path conditions, mutations, or logic
were touched. All four stale-field warnings cleared immediately.
Published as v7.

## A mistake made and caught while investigating

While inspecting Path A's `Action` field, a click intended to expand a
tooltip instead selected "Step Output" from the field picker's suggestion
list, which cleared the `Action` field's mapping entirely (leaving that
condition with no field selected). This was **not detected as unsaved
local state** — reloading the page confirmed the empty field had already
persisted to the live draft. Recovered by inspecting Path B's still-intact
`Action` field's underlying React props directly (`375885985__action`) to
confirm exactly what the correct mapping was, then restoring it on Path A
once the fresh sample made "Action" a selectable option again. Verified
Path A's full three-condition set matched its original state before
publishing.

**What to do differently next time**: when a field-picker dropdown's
click target is ambiguous (a pill vs. a small icon inside it vs. the
dropdown arrow), zoom in and confirm precisely what's under the cursor
before clicking, rather than clicking a best-guess coordinate on a
warning icon — a live Zap's field mappings are shared-resource state, and
an accidental click here has the same blast radius as a deliberate edit.

## What to do differently on stale-field warnings generally

Before treating a "field not available in current sample" warning as a
mapping bug to fix, check whether the field is *conditionally present*
on only some webhook shapes (e.g. only on certain event types) rather
than assuming the schema changed or the mapping broke. Pulling a fresh,
representative sample is often the correct and much smaller fix than
rewriting a condition.
