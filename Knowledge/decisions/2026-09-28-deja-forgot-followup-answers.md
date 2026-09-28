---
title: Deja forgot her own clarifying questions between turns
tags: [decisions, hermes, bug]
date: 2026-09-28
---

# Deja forgot her own clarifying questions between turns

## What happened

Bryce reported: he'd tell Deja to do something, she'd reply with a
clarifying question, he'd answer it — and her next reply showed no sign
she remembered asking, only the bare answer he'd just typed.

## Why

`/api/ask` was, and still is, stateless per request — but the dashboard's
`askForm` handler (`public/index.html`) only ever sent `{ message }`, the
single new thing typed, never anything from earlier in the same on-screen
exchange. This was already flagged as a known limitation in
[[deja-bridge]] ("`/api/ask` still only accepts a single `message` string
per call... whichever side is driving the conversation is responsible for
including prior turns"), but nothing on the dashboard side actually did
that — Deja's own clarifying question never made it back to her.

## Fix

The dashboard now keeps a small in-memory list of the last few user/Deja
turns for the current page session (`dejaHistory` in `public/index.html`,
capped at 6 exchanges / 12 messages) and sends it as `history` alongside
`message`. `handleAsk` (`src/index.js`) validates and re-caps it
server-side, then prepends it to the `messages` array sent to Claude —
still one live API round trip per `/api/ask` call, no new storage added.

Deliberately small (6 exchanges, not a long backscroll): this fixes the
actual failure mode — a two-step "she asks, he answers" exchange — without
letting an extended conversation's cost grow unbounded, since the whole
history gets resent on every turn. It resets on page reload, same as
before; it's conversation continuity within one sitting, not persistent
memory (that's [[deja-memory]]'s job).

## Worth remembering

`/api/ask`'s statelessness was known and documented before this — the gap
was that the doc only covered the Claude Code bridge, not the dashboard's
own chat box, so the same fix hadn't been applied to the path Bryce
actually uses day to day. When a limitation is written up for one caller
of a shared endpoint, check whether it silently applies to the others too.
