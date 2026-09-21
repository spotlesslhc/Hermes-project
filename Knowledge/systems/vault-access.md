---
title: Deja's read access to the knowledge vault
tags: [systems, hermes, deja]
updated: 2026-09-21
---

# Deja's read access to the knowledge vault

[[Deja]]/Hermes can read this vault directly during a conversation, via two
tools on `/api/ask`:

- **`list_vault_notes`** — lists every `.md` file under `Knowledge/` in the
  dashboard repo (`spotlesslhc/Hermes-project`), via GitHub's tree API.
- **`read_vault_note`** — reads one note's content by path, e.g.
  `Knowledge/systems/wave-integration.md`.

Both reuse the `GITHUB_TOKEN` secret already bound for [[site-editor]] —
no new credentials were added. `HERMES_SYSTEM_PROMPT` tells her to use
these before answering questions about the business's history or how a
system works, instead of guessing.

## Read-only, on purpose

Neither tool can write. If a vault note needs to change, that still goes
through `propose_site_edit` (target `"dashboard"`, path starting with
`"Knowledge/"`) — the same PR-and-review flow used for any other dashboard
or website edit. There's no direct-write vault tool, so Deja can't edit her
own knowledge base without Bryce reviewing the diff first.

## Dependency: the vault has to actually be in the repo

These tools read from GitHub, not the local filesystem — so `Knowledge/`
had to be committed and pushed before this worked at all. It hadn't been
before 2026-09-21 (see [[2026-09-21-hermes-repo-made-private]] for what
that push prompted). Anything added to the vault only on disk, never
pushed, is invisible to Deja until it's pushed.

## What this touches

Built alongside [[deja-bridge]] but is a separate capability — the bridge
is about Claude Code relaying messages to Deja; this is about Deja looking
things up for herself, regardless of who's asking.
