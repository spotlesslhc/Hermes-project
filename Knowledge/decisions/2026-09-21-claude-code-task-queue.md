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

## Update 2026-09-22: automatic pickup via a scheduled cloud routine

Originally the hand-off only happened when Bryce manually started a
Claude Code session in this project — CLAUDE.md's instruction has no
trigger of its own, so a queued task could sit for however long until
someone opened a session. Fixed by creating a scheduled cloud routine
("Hermes daily task-queue check", id `trig_01JLoic6eABThkj9ig4u8VCm`,
https://claude.ai/code/routines/trig_01JLoic6eABThkj9ig4u8VCm) that runs
daily at 13:00 UTC (~6:00 AM Arizona time — fixed offset year-round since
AZ doesn't observe DST) and does exactly what a manually-started session
would: read `CLAUDE.md`, check `Knowledge/tasks/`, handle anything
pending. This is real polling now, not the "still isn't listening"
limitation described below when this note was first written — Bryce no
longer has to open Claude Code himself for a queued request to get
picked up, just wait until the next morning.

**Deliberately still does not auto-merge the PRs it opens.** Discussed
explicitly with Bryce: every request passes through two separate AI
interpretation steps before a diff exists (Deja turning his chat message
into a task file, then Claude Code — running fully unsupervised in the
cloud — turning that task file into an actual edit), and the PR review is
the one point a human confirms the result actually matches what he
meant, the same principle behind why `propose_site_edit` and the
approval queue never publish/execute directly. Auto-merging would remove
that checkpoint from a pipeline nobody is watching in real time — a
misread request would go live on the actual business site before anyone
noticed, instead of just sitting as a harmless unmerged PR.

**Bryce's call, not permanent:** manual review for now; if the routine
runs cleanly for a while with no bad edits, he said he'd consider letting
it auto-merge. If that comes up again, this is the context — it's a
trust question, not a technical limitation (auto-merge could be added to
the routine's allowed tools/prompt in minutes).

This still isn't the "Deja can reach out to Claude Code the instant she
wants to" architecture discussed and deliberately deferred earlier (see
[[2026-09-21-deja-claude-code-bridge]]) — the routine checks once a day
on a fixed schedule, not the moment a task gets queued. A request made
right after the daily run still waits until the next one.

## What this touches

`propose_site_edit` still exists and still works exactly as before — it's
now the "I want this done immediately, cost doesn't matter" option
instead of the default. Deja's system prompt was updated to prefer
`queue_edit_request` and explain the tradeoff plainly to Bryce (queued,
not done yet) rather than implying it already happened.
