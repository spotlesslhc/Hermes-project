---
title: Pushed a follow-up commit to a PR that had already been merged
tags: [decisions, mistakes, git]
date: 2026-09-25
---

# Pushed a follow-up commit to a PR that had already been merged

**What happened:** PR #26 (Turno calendar event format) was opened, then
Bryce asked for more Turno changes (invoice date = cleaning date,
cancellation handling). Those were committed and pushed to the same
branch, on the assumption #26 was still open. Bryce had already merged
#26 in the meantime, so the new commit sat on a merged branch and never
reached `main` — it only turned up when checking `git log origin/main`
later. It was cherry-picked onto a fresh branch and shipped as PR #27.

**Why:** "The PR I opened a few minutes ago is still open" was assumed,
not checked. Bryce merges quickly, often without saying so.

**Next time:** before adding commits to an existing PR branch, check
whether the PR is still open (`git fetch` then
`git merge-base --is-ancestor <branch-tip> origin/main` — if the branch
is already in `main`, it's merged). If it is, start a new branch from
`main` and open a new PR instead.
