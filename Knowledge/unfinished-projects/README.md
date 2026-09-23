---
title: Unfinished projects — tracking multi-session work in progress
tags: [systems, meta]
updated: 2026-09-22
---

# Unfinished projects — tracking multi-session work in progress

A running list of initiatives that take more than one session to finish,
so nothing gets silently dropped between conversations. This is different
from `Knowledge/tasks/`, which is for one-shot site/dashboard edit
requests Deja queues for Claude Code — this folder is for the bigger,
open-ended things: a new capability being designed, a rollout that's
partway done, an open question blocking further work.

## Format

One file per initiative, named for the initiative
(`kebab-case-name.md`). Frontmatter (`title`, `tags`, `started`,
`updated`), then:

- **What this is** — the goal, in plain terms.
- **What's done so far.**
- **What's left** — concrete next step(s), specific enough that a future
  session (or Bryce) can pick it up cold.
- **Blocked on** (if anything) — whose input or decision it's waiting on.

## Lifecycle

- Create a file the moment a multi-step initiative starts.
- Update it as status changes — don't let it go stale.
- **Delete it entirely once the initiative is completely finished.** There
  is no `done/` archive here, unlike `Knowledge/tasks/`. Once something's
  actually done, whatever's worth remembering long-term belongs in a
  proper `Knowledge/systems/` doc (how it works) or `Knowledge/decisions/`
  note (why it was built that way) — not left behind as a stale WIP
  tracker nobody needs anymore.
