---
title: Fix Deja losing track of her own tool calls
requested: 2026-10-01T08:07:00.496Z
target: dashboard
status: pending
---

# Fix Deja losing track of her own tool calls

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Bryce reports Deja's memory is failing within a conversation. Symptoms in one chat on about 2026-09-29/30: (1) Deja couldn't see her own earlier tool calls and told Bryce she had no record of calling queue_edit_request (invoice-timing change) or list_wave_invoices (live re-check), when Bryce says she did run them. She then told him to treat the queued edit as not queued. (2) Earlier in the same chat she flip-flopped on whether Spotify commands (Clair de Lune, Laufey) had actually run. Likely cause to investigate: prior-turn tool_use/tool_result blocks aren't being included in the conversation history sent to the model on later turns, so she only sees plain text and can't tell what she actually did. Check how history is stored and replayed in /api/ask, and make sure tool calls and results persist across turns. Also check whether the invoice-timing edit request (no invoices sent before the cleaning date; send on cleaning day after 4pm) actually landed in the queue, since Deja can't confirm it.
