---
title: Claude Code <-> Deja bridge
tags: [systems, hermes, deja]
updated: 2026-09-21
---

# Claude Code <-> Deja bridge

A way for Claude Code (running in a terminal on Bryce's computer) to talk
directly to [[Deja]]/Hermes's `/api/ask`, the same endpoint the dashboard's
"Ask Deja" box uses — without going through the dashboard UI at all.

## How it works

- `tools/deja-bridge/ask-deja.mjs` in the repo: a small Node script that
  POSTs `{ message }` to `https://hermes-project.spotlesscleaninglhc.workers.dev/api/ask`
  and prints the reply.
- The whole Worker sits behind Cloudflare Access (see [[systems-overview]]),
  so the script authenticates with a Cloudflare Access **Service Token**
  (Client ID + Secret), sent as `CF-Access-Client-Id` /
  `CF-Access-Client-Secret` headers. This is the same kind of token used for
  any automated/API access to the Worker, not something specific to this
  script.
- Credentials live in `tools/deja-bridge/.env.local`, which is gitignored —
  never committed. `.env.local.example` documents the two required
  variables.
- There's no server-side conversation state added for this — `/api/ask`
  still only accepts a single `message` string per call, same as before.
  For a multi-turn exchange, whichever side is driving the conversation
  (currently Claude Code) is responsible for including prior turns as
  context inside the message text it sends.

## Direction of contact

This is a request/response bridge, not a persistent connection: Claude Code
always has to send the message first, and Deja can only reply within that
same HTTP response — she has no way to initiate contact back. There's no
listener on Claude Code's side for her to call, and a Cloudflare Worker
can't reach out to a local terminal session on its own. If she's asked
whether she can contact Claude Code first, "no, only reply" is the correct
answer, not a bug — worth remembering so this doesn't get re-investigated
as if it were broken. Making her able to initiate contact would need a real
architecture change (something on Bryce's machine listening and staying
running), which hasn't been decided on.

## The trust decision

The first test of this bridge failed in an informative way: Hermes replied
that she didn't know what a "bridge" was and wouldn't act on an
unfamiliar caller's say-so — correct behavior, since her system prompt only
told her she talks to Bryce directly.

`HERMES_SYSTEM_PROMPT` (in `src/index.js`) was deliberately extended to
tell her that Claude Code sometimes relays messages on Bryce's behalf
through this bridge, and that she should treat those the same as messages
from Bryce directly — including using her tools if asked. This was a
conscious choice, not an oversight: it means anything sent through this
bridge now carries the same authority Bryce's own dashboard messages do.
Deployed live 2026-09-21.

## A real bug this bridge caught (fixed 2026-09-21)

A routine check-in through this bridge ("can you confirm you're
receiving this") came back as a 502 instead of a reply. The actual cause
had nothing to do with the bridge itself: `handleAsk` only ever handled
the *first* tool Claude called in a turn. When Claude called two tools
back to back (e.g. `list_vault_notes` then `read_vault_note`, a normal
pattern given how the system prompt describes using them), the second
tool call was left without a matching result, and Claude's API rejected
the whole next request outright. Fixed the same day — every tool call in
a turn now gets handled, with all their results sent back together.

Worth remembering: this bridge is a good, low-effort way to sanity-check
`/api/ask` end to end after a deploy — the exact prompt that triggered
this bug became the regression test for the fix.

## What this touches

Doesn't change the dashboard or how Bryce talks to Deja normally. Relevant
if the bridge is ever extended (e.g. giving `/api/ask` real multi-turn
memory, or letting Deja initiate contact rather than only responding) —
see [[2026-09-21-deja-claude-code-bridge]] for the decision record.
