---
title: Bookkeeping playbooks — how repetitive Wave tasks get documented
tags: [systems, hermes, bookkeeper, playbooks]
updated: 2026-09-22
---

# Bookkeeping playbooks — how repetitive Wave tasks get documented

Wave's public API doesn't expose real bookkeeping operations (see
[[wave-integration]]) — categorizing transactions, reconciling, and
similar tasks only exist in Wave's own web UI. Doing that safely and
repeatably works like this:

1. **Claude Code does the task once**, driving a real browser against
   Bryce's actual Wave account (his own logged-in Chrome, or a session's
   own browser) while Bryce watches and approves each step.
2. While doing it, Claude writes up the exact process as a dated playbook
   in this folder — one file per distinct task.
3. Only the purely mechanical, low-risk, repetitive piece of a *stable*
   playbook gets wired into Hermes itself as an actual tool, gated through
   [[approval-queue]] like any other tool that changes real-world state —
   and it must follow that playbook exactly unless Bryce says otherwise
   for that specific instance.
4. Any Hermes action taken under a playbook must log enough detail in the
   activity log to be manually reversed — the specific values/record IDs
   touched, not just "did X."

## Playbook format

Each file: `YYYY-MM-DD-task-name.md`, frontmatter (`title`, `tags`,
`updated`, `status: draft | stable`), then:

- **What this covers** — the task, in plain terms.
- **Steps** — the exact sequence, specific enough to repeat without
  guessing (exact fields, buttons, or API calls used).
- **Judgment calls** — any decision rules involved (e.g. how an expense
  gets categorized), stated explicitly so they can be followed
  mechanically rather than re-decided each time.
- **How to reverse this** — the specific steps to undo it if it turns out
  wrong. If a task can't be cleanly reversed, say so plainly instead of
  guessing — that's a reason to keep it human-only rather than hand it to
  Hermes.
- **What Hermes can do vs. what stays Claude/Bryce-only** — which part
  (if any) is mechanical enough to become a real gated tool, and which
  part still needs judgment and should stay a manual, supervised task.

A playbook starts as `draft` after its first real run and only becomes
`stable` once it's been followed successfully a few times without
surprises — `status: draft` is a signal to double-check it, not a
guarantee it's wrong.
