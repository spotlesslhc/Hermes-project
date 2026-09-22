---
title: Claude Code task queue
tags: [systems, hermes, tasks]
updated: 2026-09-21
---

# Claude Code task queue

This folder is how Deja hands off site/dashboard edits to Claude Code
instead of drafting them herself. See
[[2026-09-21-claude-code-task-queue]] for why this exists.

## How it works

- Deja's `queue_edit_request` tool writes one small markdown file here per
  request — a title, what Bryce actually asked for, and which site it's
  about if known. It writes straight to `main`, no branch or PR, since
  this file is just an internal note-to-self, not published content.
- Claude Code reads this repo's `CLAUDE.md` at the start of every session
  working here, which points here. Any file directly in this folder
  (not in `done/`) is a pending request — Claude Code should read it,
  actually make the requested edit (using his own access, the normal
  read/edit/branch/PR workflow, not the Worker's API key), and then move
  the file into `done/` once the PR is opened (or the edit is otherwise
  handled).
- Bryce can ask Deja "did you get that site edit done" at any time —
  she can check this folder herself via `list_vault_notes`/
  `read_vault_note` and tell him whether it's still pending or moved to
  `done/`.

## File naming

`YYYY-MM-DD-short-slug.md`, e.g. `2026-09-22-change-heading-to-chat.md`.
