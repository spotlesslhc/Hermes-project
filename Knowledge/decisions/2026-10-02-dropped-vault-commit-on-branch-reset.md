---
title: A vault commit was dropped when the working branch was reset to main
tags: [decisions, mistakes, git, workflow]
date: 2026-10-02
---

# A vault commit was dropped when the working branch was reset to main

## What happened

After committing a docs-only vault note to the working branch, Claude Code
started the next change (the Activity-list edit) by resetting that branch to
the latest `origin/main` and force-pushing. The unmerged vault commit wasn't on
`main`, so it vanished from the branch and from the PR; Bryce only noticed
because a separate PR didn't include it. It was recovered from the local
reflog (`git cherry-pick`) and merged with the next PR.

## Why

Same family as [[2026-09-25-pushed-to-already-merged-pr]]: resetting a branch
to `main` is correct when its PR is merged, but I did it without first checking
whether the branch still carried unmerged commits.

## What to do differently

- Before `git checkout -B <branch> origin/main`, run
  `git log origin/main..HEAD` (and check for unpushed work); if there's
  anything unmerged, rebase or cherry-pick it onto the new base instead of
  discarding it.
- Don't leave a docs commit sitting alone on a branch: merge it, or put it
  straight on `main` when Bryce says so (docs-only vault changes may go to
  `main` per CLAUDE.md).
