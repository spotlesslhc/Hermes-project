---
title: Agent notes — operational knowledge for whoever's driving
tags: [systems, meta, agent-notes]
updated: 2026-09-23
---

# Agent notes — operational knowledge for whoever's driving

The rest of `Knowledge/` documents the **business and the system**: how
Hermes works, why decisions were made, what's still open. This folder is
different — it's operational knowledge about **how to actually get work
done** in this project's tools, for whichever agent (Claude Code, Deja,
or anything that comes after) is doing hands-on work. Think of it as a
shared runbook of tool quirks, safe patterns, and things that wasted time
once and shouldn't a second time.

## What belongs here vs. elsewhere

- **Here**: "Zapier's Search Term field does X when you Y" — true
  regardless of what task you're doing, useful the next time anyone
  touches that tool.
- `Knowledge/decisions/`: a specific incident and its lesson — "the KV
  list() quota got exhausted because X."
- `Knowledge/systems/`: how a piece of *this system* (Hermes itself)
  works.
- `Knowledge/playbooks/`: how to do a specific *business* task
  (categorizing an expense, reconciling an invoice) — not a tool quirk.

## Files

- [[browser-automation-notes]] — driving Zapier, Wave, and Google
  Calendar via browser automation: what's fragile, what's safe, what to
  do when the sandbox blocks an action.
