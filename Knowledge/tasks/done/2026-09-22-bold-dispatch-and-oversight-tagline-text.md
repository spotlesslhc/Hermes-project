---
title: Bold "dispatch and oversight" tagline text
requested: 2026-09-22T05:43:02.082Z
target: dashboard
status: done
pr: https://github.com/spotlesslhc/Hermes-project/pull/new/task/bold-dashboard-tagline
---

# Bold "dispatch and oversight" tagline text

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Where the dashboard/site says "dispatch and oversight for Spotless Cleaning, Lake Havasu City" — make that text bold.

## What was done

Added `font-weight:600` to the `.brand .tag` CSS rule in `public/index.html`
(that's the only place this text renders — a single shared class, no
separate copy on the actual spotlesslhc.com site). Verified visually via
local `wrangler dev` before opening the PR.
