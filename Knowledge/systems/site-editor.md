---
title: Site Editor — how site edits get made
tags: [systems, hermes, site-editor]
updated: 2026-09-21
---

# Site Editor — how site edits get made

[[Site Editor Agent]] is the first of Hermes' four agent areas to get a real
tool: `propose_site_edit`. This note describes how it actually works today,
confirmed by a live test on 2026-09-20/21.

## How it works

When Bryce asks [[Hermes]] for a change to spotlesslhc.com or the dashboard
itself, Hermes can call `propose_site_edit` with a target repo, a file path,
and plain-language instructions. Behind the scenes:

1. It reads the current file straight from GitHub.
2. It asks Claude to draft the change as a small batch of exact
   find-and-replace edits (old text → new text), not a full-file rewrite.
   This keeps the cost cheap and safe even for a large file — the model
   only has to output the part that's changing, not the whole file, and it
   can't get cut off mid-file the way a full rewrite could.
3. It applies those edits locally, commits the result to a new branch, and
   opens a pull request. **It never pushes to main** — Bryce reviews and
   merges (or closes) every PR himself on GitHub.

This mirrors Bryce's own review workflow: nothing Site Editor drafts goes
live until a human looks at the diff.

## Confirmed working

The mechanism was tested end-to-end on the dashboard itself (cheap, low
risk, easily reverted) rather than the real website. Authentication
(Cloudflare Access, with a dedicated Service Auth policy for the token),
the GitHub branch/commit/PR flow, and the reply back through chat all work
correctly.

Two tests confirm the current behavior:

- **Nonexistent target ("Get a Quote" button, which isn't on the
  dashboard):** Hermes replies plainly that it couldn't find the text and
  asks Bryce to confirm the exact wording. No branch, commit, or PR gets
  created.
- **Real, existing target (the "Talk to Hermes" heading):** Hermes opens a
  PR with a clean, minimal, accurate one-line diff
  ([#2](https://github.com/spotlesslhc/Hermes-project/pull/2), closed
  without merging — it was a sanity check, not a real requested change).

### The no-op gap (fixed 2026-09-21)

The first version of this tool didn't check whether a drafted edit actually
changed anything. When asked to edit text that didn't exist in the file, it
still opened a PR — with an empty diff, identical file SHA to main — and
reported success rather than failure. That PR
([#1](https://github.com/spotlesslhc/Hermes-project/pull/1), closed without
merging) is what caught the bug.

The fix: `proposeSiteEdit` now compares the drafted content against the
original before creating a branch, commit, or PR. If they're identical, it
throws an error instead, telling Bryce plainly that the edit didn't match
anything rather than silently opening an empty PR.

## Batching, not one-at-a-time

`propose_edits` (the tool Claude uses internally to draft edits) accepts
multiple find-and-replace pairs in a single call, which becomes a single
PR. Because drafting an edit still costs input tokens proportional to file
size — meaningful for spotlesslhc.com's ~85,000-token `index.html` — Bryce
is deliberately holding off on real edits to the live website for now. The
plan is to collect a full list of desired changes first, then send them to
Hermes together so they land in one PR instead of paying the file-read cost
once per small change.

When Bryce has a batch ready, he should give Hermes the whole list in one
message.
