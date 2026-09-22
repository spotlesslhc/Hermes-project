---
title: Claude Code task queue — cheap alternative to propose_site_edit
tags: [decision, hermes, tasks, cost]
updated: 2026-09-21
---

# Claude Code task queue — cheap alternative to propose_site_edit

## What was decided

Added `queue_edit_request`, a new Deja tool that's now the *default* way
site/dashboard edit requests get handled, ahead of `propose_site_edit`.

## Why

`propose_site_edit` works, but it's genuinely expensive to run: it reads
the entire target file into a dedicated Claude API call just to draft the
find-and-replace edit, billed pay-as-you-go against `ANTHROPIC_API_KEY`.
For spotlesslhc.com's ~85,000-token `index.html`, that's a real cost on
every single edit no matter how small. Bryce wants a way to make site
edits without that cost hitting his API billing every time.

Claude Code already has the same editing capability — reading files,
drafting precise changes, opening PRs — and Bryce already has access to
Claude Code through a separate subscription, not per-token API billing.
So instead of the Worker doing the expensive drafting work itself,
`queue_edit_request` just writes a small task note (title + Bryce's
request, verbatim) straight to `Knowledge/tasks/` — a cheap GitHub write,
no drafting call at all — and Claude Code picks it up and does the actual
work the next time Bryce starts a session in this project. See
[[systems-overview]] and `Knowledge/tasks/README.md` for the mechanics.

## What this doesn't solve

This isn't the "Deja can reach out to Claude Code whenever she wants"
architecture discussed and deliberately deferred earlier (see
[[2026-09-21-deja-claude-code-bridge]]) — Claude Code still isn't
listening or polling for anything. The hand-off only actually happens
because Claude Code reads this repo's `CLAUDE.md` at the start of every
session, and that file points at this folder. If Bryce queues something
and doesn't open Claude Code again for a while, it just waits — there's
no notification, no urgency, nothing pushing it forward until a session
starts here.

## What this touches

`propose_site_edit` still exists and still works exactly as before — it's
now the "I want this done immediately, cost doesn't matter" option
instead of the default. Deja's system prompt was updated to prefer
`queue_edit_request` and explain the tradeoff plainly to Bryce (queued,
not done yet) rather than implying it already happened.
