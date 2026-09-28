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
- **Not written to the vault (`Knowledge/`).** The task suggested reusing
  the vault, but every vault write here goes through a GitHub PR
  (`propose_site_edit`) or the Claude Code task queue — both far too heavy
  for something Deja might add to several times a conversation. KV is the
  existing mechanism in this codebase for exactly this shape of
  self-managed small state.
- **No pruning logic beyond the cap.** Old entries just age out at 30;
  nothing summarizes or deduplicates yet. Fine at this scale — revisit if
  the cap starts feeling too small in practice.
