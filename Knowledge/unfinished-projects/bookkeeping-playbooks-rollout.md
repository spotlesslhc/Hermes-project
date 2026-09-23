---
title: Bookkeeping playbooks rollout
tags: [bookkeeper, playbooks]
started: 2026-09-22
updated: 2026-09-22
---

# Bookkeeping playbooks rollout

## What this is

Give the Bookkeeper agent real bookkeeping ability in Wave (categorizing
transactions, reconciling, etc. — things Wave's API can't do, only its
web UI can) without unsupervised AI edits to Bryce's actual books. See
`Knowledge/playbooks/README.md` for the full model: Claude Code does a
task once with a real browser against Wave while Bryce supervises,
documents it as a dated playbook, and only the mechanical/repetitive
piece of a stable playbook gets wired into Hermes as a real tool gated
through the approval queue.

## What's done so far

- Convention and format defined: `Knowledge/playbooks/README.md`.
- Workflow codified in `CLAUDE.md`.
- PR open: `add/bookkeeping-playbooks-convention` (not yet merged).

## What's left

1. Bryce merges the convention PR.
2. Pick the first pilot task (candidates raised: categorizing
   cleaning-supply expenses, or reconciling the Zapier-created invoices
   against actual payouts — Bryce hasn't picked yet).
3. Set up browser access to Bryce's real Wave account — either the Claude
   in Chrome extension (his own logged-in session) or logging into Wave
   inside a session's own browser pane. Not yet decided which.
4. Run the pilot task with Bryce supervising, write it up as the first
   file in `Knowledge/playbooks/`.
5. Decide whether any piece of it is mechanical/low-risk enough to become
   a real Hermes tool, and if so, wire it in via `APPROVAL_REQUIRED_TOOLS`.

## Blocked on

Bryce: merge the convention PR, pick the pilot task, and decide how
Claude should get browser access to Wave.
