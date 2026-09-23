---
title: Split activity tab into 5 lists, rename Hermes to Deja
requested: 2026-09-23T07:07:38.419Z
target: dashboard
status: done
pr: https://github.com/spotlesslhc/Hermes-project/pull/new/task/split-activity-tab-rename-deja
---

# Split activity tab into 5 lists, rename Hermes to Deja

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

In the dashboard's Activity tab, create five separate lists — one for each of the four AI agents (Zapier Overseer, Scheduler, Bookkeeper, Site Editor) plus one for the main dispatcher assistant. Also rename the dispatcher assistant's label in the Activity list from "Hermes" to "Deja" everywhere it appears in that tab.

## What was done

`public/index.html`: replaced the single flat `#logList` with a
responsive `.activity-grid` (3 columns on desktop, 2 on tablet, 1 on
mobile — matching this dashboard's existing breakpoint conventions),
one `.log` list per agent (Deja, Zapier Overseer, Scheduler, Bookkeeper,
Site Editor). `loadLog()` now buckets `/api/log` entries by their `who`
field into the matching list — any `who` value that isn't one of the
five (e.g. the currently-unused "Approval queue" entries) falls back
into Deja's list, same as the old single-list fallback already did.
Each column shows its own empty state ("No activity yet") rather than
disappearing when a given agent has no recent entries.

`src/index.js`: the one place that logged activity as `who: "Hermes"`
(inside `handleAsk`, after a chat/voice turn completes) now logs
`who: "Deja"` instead — this is the only Activity-log label that said
"Hermes"; the rest of the codebase's "Hermes" naming (repo name, system
prompt, comments) is intentionally unchanged per
[[2026-09-21-deja-rename-scope]].

Verified visually by opening the static HTML directly in the browser
pane at mobile, tablet, and desktop widths (no local API responses, so
the built-in preview/placeholder rows rendered) — the grid wraps to the
right column count at each breakpoint and text stays readable.
