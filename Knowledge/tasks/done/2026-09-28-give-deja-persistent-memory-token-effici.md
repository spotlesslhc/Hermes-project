---
title: Give Deja persistent memory, token-efficient
requested: 2026-09-28T06:53:53.626Z
target: dashboard
status: pending
---

# Give Deja persistent memory, token-efficient

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Bryce wants Deja (the dispatcher AI) to have persistent memory across sessions, but implemented efficiently so it doesn't burn a bunch of tokens on every request.

Suggested approach for Claude Code to evaluate: don't dump full conversation history into every prompt. Instead keep a small, curated memory store (e.g. a "Knowledge/deja-memory.md" note or a lightweight key-value/summary file) that only gets appended to when something worth remembering happens (decisions, preferences, recurring facts Bryce states), and only pull in the relevant slice at request time rather than the whole file. Consider:
- A short rolling summary instead of raw transcript logs
- Writing memory updates async/on a schedule rather than every single turn
- Capping size and pruning old/stale entries
- Reusing the existing vault (Knowledge/) mechanism already in place rather than building a new storage system

Goal: Deja should remember useful context (recent decisions, ongoing issues, Bryce's preferences) between sessions without materially increasing API costs per request.
