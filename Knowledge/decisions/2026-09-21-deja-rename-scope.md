---
title: Deja rename is scoped to display name and persona only
tags: [decision, systems, hermes]
updated: 2026-09-21
---

# Deja rename is scoped to display name and persona only

## What was decided

The dashboard's on-screen name and chat persona were renamed from Hermes to
**Deja**. This is intentionally partial: the GitHub repo
(`spotlesslhc/Hermes-project`), the Worker's URL
(`hermes-project.spotlesscleaninglhc.workers.dev`), all backend file and
variable names (`HERMES_KV`, `HERMES_SYSTEM_PROMPT`, etc.), and this vault
all keep the name "Hermes."

## Why

This is a standing decision, not an oversight or half-finished rename. A
future session (human or Claude) looking at the mismatch between "Deja" in
the UI and "Hermes" everywhere else in the code should not assume it needs
fixing or "finishing" — leave the backend naming as Hermes unless Bryce
explicitly decides otherwise.

## What this touches

See [[systems-overview]] for the current state of the dashboard UI. No
code, repo names, or infrastructure identifiers should change as a result
of this note — this documents a boundary that already exists, so it stays
that way.
