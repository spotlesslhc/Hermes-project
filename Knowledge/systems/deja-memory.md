---
title: Deja's memory — how she remembers between conversations
tags: [systems, hermes]
updated: 2026-09-28
---

# Deja's memory — how she remembers between conversations

Built 2026-09-28, from a task Bryce queued via Deja (see
[[claude-code-task-queue]]) asking for persistent memory that doesn't
burn tokens on every request.

## Why this exists

`/api/ask` is stateless per request — the dashboard never sends prior
turns back (see `public/index.html`'s `askForm` handler), so without this
Deja forgot everything the instant a reply was sent, even earlier in the
same on-screen conversation.

## How it works

- `HERMES_KV` key `deja_memory` holds a capped JSON array of
  `{ date, text }` entries — same pattern as `activity_log` and every
  other small-state list in this Worker (see
  [[systems-overview#the-kv-namespace-hermes-memory]]).
- Capped at 30 entries, each trimmed to 220 characters at write time, so
  the total overhead is small and bounded no matter how long the memory
  grows — old entries just fall off the end.
- Deja has a `remember` tool she calls herself when Bryce states a
  preference, decision, or recurring fact worth keeping. No approval
  needed — same as her other self-reporting tools (`record_monthly_finance`,
  etc.) — since it only ever stores what Bryce told her, not something
  inferred.
- On every `/api/ask` call, `handleAsk` reads the current memory list and
  folds it into the system prompt as a short bulleted section — no full
  transcript, no extra API round trip (it's a single KV read, same cost
  as the reads `handleAsk` already does elsewhere).

## Deliberately not built

- **Not a transcript log.** Raw conversation history was the expensive
  option the task explicitly asked to avoid — this only stores what Deja
  herself decides is worth keeping, not everything said.
- **`remember` doesn't write to the vault (`Knowledge/`).** KV is the
  existing mechanism in this codebase for self-managed small state that
  needs to ride along on every request cheaply — a vault write is a
  heavier, separate thing (see below).
- **No pruning logic beyond the cap.** Old entries just age out at 30;
  nothing summarizes or deduplicates yet. Fine at this scale — revisit if
  the cap starts feeling too small in practice.

## `save_to_vault` — permanent notes, added 2026-09-28

A second, separate tool for things worth keeping forever, not just for
the next 30 KV entries — a mistake and what Deja learned from it, an
important fact about the business, a real decision. Requested the same
day Bryce noticed Deja "lacks some common sense" and asked how to teach
her; a durable, browsable log of her own lessons (readable by both Deja
and Claude Code, and able to actually reshape her system prompt over
time) is part of the answer.

**First attempt was a direct GitHub commit to `Knowledge/decisions/` on
`main`, with no review — Claude Code's own safety classifier blocked it.**
The concern: that would let an LLM chatbot running unsupervised commit
arbitrary text straight into the repo's `main` branch, with no PR and no
human in the loop, unlike every other vault-write path in this codebase
(`propose_site_edit` ends in a PR Bryce reviews; the direct-to-main
exception in `CLAUDE.md` is scoped to Claude Code sessions where Bryce is
present, not to Deja acting alone). It's also a soft target for prompt
injection — a garbled Zapier payload or a weird customer message nudging
Deja to write something bogus into a permanent record, with nothing
catching it before it lands.

What shipped instead: `save_to_vault` reuses `queueEditRequest` (the same
function `queue_edit_request` calls) to write a task file into
`Knowledge/tasks/` asking Claude Code to actually add the note next
session — reviewed the same way any other vault change is, nothing
committed unattended.
