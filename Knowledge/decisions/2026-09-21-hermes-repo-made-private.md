---
title: spotlesslhc/Hermes-project switched from public to private
tags: [decision, systems, hermes, security]
updated: 2026-09-21
---

# spotlesslhc/Hermes-project switched from public to private

## What was decided

The `spotlesslhc/Hermes-project` GitHub repo (the dashboard + Worker source,
and this vault) was switched from public to private on 2026-09-21, by Bryce
directly in GitHub's settings.

## Why

Giving [[Deja]] read access to the vault (see [[vault-access]]) meant the
vault had to actually be committed and pushed to this repo for the first
time — it had only ever lived on disk before. The repo was still public at
that point, which would have made business specifics in the vault (revenue
figures, the Wave client secret note, decision rationale) world-readable.
Making the repo private first, then pushing, avoided ever exposing that
content publicly.

Note `spotlesslhc/spotlesslhc-website` (the actual customer-facing site) is
a **separate repo and stays public** — this decision only affects the
dashboard/Worker repo.

## What was checked afterward

The concern going in was whether `GITHUB_TOKEN` (used for everything the
Worker does against GitHub — [[site-editor]]'s PRs and both vault tools)
would lose access if it only had `public_repo` scope rather than full
`repo` scope. Tested directly after the switch by asking Deja to run
`list_vault_notes` against the now-private repo — it worked, confirming the
token has full `repo` scope. No functional side effects from this change.

## What this touches

If `GITHUB_TOKEN` is ever rotated, whoever generates the new one needs to
give it full `repo` scope (not `public_repo`), or [[site-editor]] and
[[vault-access]] will both silently break against this repo.
