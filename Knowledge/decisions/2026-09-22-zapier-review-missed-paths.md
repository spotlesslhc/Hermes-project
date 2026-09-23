---
title: "Mistake: first Zapier review missed most of a Zap's paths"
tags: [decision, mistake, zapier]
updated: 2026-09-22
---

# Mistake: first Zapier review missed most of a Zap's paths

**Status: corrected within the same session — see [[zapier-automations]].**

## What happened

While documenting Bryce's Zapier account for the
[[zapier-overseer-buildout|Zapier Overseer buildout]], the first pass at
reviewing "Hospitable Reservations to Wave Invoices" concluded it had
only two paths (C and D), no Code-by-Zapier steps anywhere, and that the
raw-GraphQL invoice-deletion logic Bryce had described didn't exist.

All of that was wrong. The Zap actually has seven lettered paths (A
through G, minus a deleted F), including two Code-by-Zapier Python steps
that do exactly the invoice-deletion/update logic Bryce described. They
were missed because Zapier's canvas only renders what's currently
scrolled into view — paths sitting further left or right of whatever's
on screen aren't collapsed or hidden, they're just not there until you
scroll to them. The read-only Zap view also renders less structure than
the "Edit Zap" view does; a calendar Zap reviewed earlier in the same
session had already demonstrated this exact failure mode (nested paths
invisible until switching to edit mode), but the lesson wasn't applied
rigorously enough on the second Zap.

A secondary, smaller mistake in the same review: Path C's "invoice
created on cancellation" logic was called "backwards" without evidence.
Once Paths A and B turned up with the identical pattern across three
different properties, it became clear this is almost certainly
intentional (a cancellation fee), not a bug — the "backwards" framing
was speculation stated as if it were a finding.

## Why it happened

Confidence that a structure had been fully seen ("only 2 paths, gap in
step numbering proves earlier ones were deleted before publishing") was
built from a plausible-sounding theory rather than from actually
confirming the canvas had no more content in any direction. The
step-numbering gap was real, but the actual explanation (paths existed,
just off-screen) was never checked against the simpler alternative
before being reported as a conclusion.

## Lesson for next time

When reviewing a Zap (or any node-based visual tool) via browser
automation: before concluding a structure is complete, scroll the full
canvas left, right, up, and down past the edges of the current viewport,
and prefer the full editor view over any read-only/summary view. A
gap in numbering, or content that "seems" complete, is not the same as
having actually looked. Report findings as confirmed only after
verifying there's nothing further off-screen — and if a theory explains
a gap, still check whether a simpler explanation (not having scrolled
far enough) fits before writing it down as a conclusion.
