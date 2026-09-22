\---

name: obsidian-notes
description: Use this skill whenever creating, updating, or reorganizing notes in the /knowledge folder of this project (the Obsidian vault). Covers note formatting, frontmatter, linking, and folder conventions specific to the Hermes / Spotless Cleaning knowledge base.
---

# Obsidian Notes — Hermes Knowledge Base

The `/knowledge` folder in this repo is an Obsidian vault shared between
Bryce, Claude Code, and Claude in chat. It's the single source of truth for
how the business and the Hermes system work. Every note in it should follow
these conventions so it stays usable as an actual Obsidian vault, not just a
folder of loose markdown.

## Folder structure

```
knowledge/
  business/       facts about Spotless Cleaning itself
  systems/         how Hermes and its infrastructure work
  agents/          one note per sub-agent (Scheduler, Bookkeeper, etc.)
  decisions/       dated log entries for meaningful decisions made
```

Create a subfolder if a new category doesn't fit one of these. Don't dump
unrelated topics into one file — one note per subject.

## Every note needs frontmatter

Start every note with YAML frontmatter:

```yaml
---
title: Short Title
tags: \\\[business, agents, decision]
updated: 2026-09-20
---
```

Pick tags from the existing vault where possible — check other notes'
frontmatter before inventing a new tag.

## Use real Obsidian links, not plain text references

When a note mentions something that has (or should have) its own note, link
it: `\\\[\\\[Scheduler Agent]]` not "the Scheduler agent." This is what makes the
Graph view and backlinks actually useful. If the linked note doesn't exist
yet, create it — a red/unresolved link is a signal something's missing, not
something to avoid.

## Decisions get logged, not just made

When a meaningful decision is made (an architecture choice, a tradeoff, a
"we're doing X instead of Y and here's why"), add a dated entry to
`knowledge/decisions/`, one file per decision:
`knowledge/decisions/2026-09-20-repo-visibility.md`. Keep these short: what
was decided, why, and what it affects. Link to the systems/agents notes it
touches.

## Keep notes current, don't just append forever

When something changes (a tool gets swapped, a decision gets reversed), edit
the existing note to reflect reality — update the `updated` date in
frontmatter — rather than leaving stale info in place and adding a
correction below it. The vault should always describe how things *are*, not
a chronological diary (that's what `decisions/` is for).

## Writing style

Plain, direct, no filler — matching how Bryce and Claude talk elsewhere in
this project. These notes get read by a business owner, not other
engineers. Short sentences. Explain acronyms and tool names the first time
they appear in a note.



