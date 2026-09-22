---
title: Approval queue — how risky actions get gated
tags: [systems, hermes, security]
updated: 2026-09-21
---

# Approval queue — how risky actions get gated

Built 2026-09-21, alongside the voice/conversation upgrade. This is the
mechanism for making sure Deja never actually executes something risky
without Bryce explicitly saying yes on the dashboard first.

## Why this exists

Bryce wants Deja to eventually oversee more of the business (payments,
calendar changes, Wave writes) — but wanted a safety net before any of
that gets built, not after. Rather than bolt safety onto each new risky
tool one at a time, this is a reusable framework: any future tool that's
genuinely risky or hard to reverse gets gated through the same mechanism.

**Nothing is gated today.** Hermes' three real tools don't need it:
`propose_site_edit` already has its own review gate (opens a GitHub PR,
Bryce reviews before anything merges — see [[site-editor]]),
`record_monthly_finance` is Bryce reporting his own numbers back to
himself. This framework is plumbing for whenever a real risky tool shows
up, not something retrofitted onto what exists.

## How it works

1. A tool gets added to `APPROVAL_REQUIRED_TOOLS` (currently empty) in
   `src/index.js`.
2. When Claude calls that tool, instead of running it, the Worker writes a
   `pending:<uuid>` record to `HERMES_KV` (status `pending`) and tells
   Deja to say plainly that it's waiting on Bryce's review — never that
   it's done.
3. The dashboard's **Pending Actions** panel (new section, between the
   agent cards and Financial Snapshot) polls `GET /api/pending` and shows
   each one with Approve/Deny buttons.
4. Clicking a button calls `POST /api/pending/decide`. Approve actually
   runs the tool (via `dispatchTool`, the same function the live chat path
   uses, so there's only one place a tool's execution logic lives). Deny
   just marks it denied. Either way it's logged to the activity feed.

## Why approval only happens via the dashboard buttons, never chat/voice

This was Bryce's explicit call, not a default. A "yes, do it" in chat or
a voice conversation is exactly the kind of thing a misheard word or an
ambiguous follow-up could trigger by accident — for something meant to
prevent real damage, that's not an acceptable failure mode. The dashboard
button is a deliberate, persistent, unambiguous action instead of a
transient reply Deja has to interpret.

## Adding a real gated tool later

Three touch points in `src/index.js`, no redesign needed:
1. Register the tool in the `tools` array (same pattern as the existing
   three).
2. Add its execution branch to `dispatchTool`.
3. Add its name to `APPROVAL_REQUIRED_TOOLS`.

## Testing it without a real risky tool

There's a debug-only tool, `test_approval_probe` (a harmless no-op), that
only registers when the plain `HERMES_DEBUG_TOOLS` var is `"true"` — always
`"false"` in production, only ever set via `--var HERMES_DEBUG_TOOLS:true`
on `wrangler dev`. It exists so the whole pending → dashboard → approve/
deny → execute loop can be re-verified end to end in the future without
needing a real risky tool to exist yet.
