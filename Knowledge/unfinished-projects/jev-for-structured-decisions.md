---
title: Evaluate Jev for structured decisions, once the rest of Hermes is built out
tags: [unfinished, hermes]
started: 2026-09-28
updated: 2026-09-28
---

# Evaluate Jev for structured decisions, once the rest of Hermes is built out

## What this is

Bryce asked about [Jev](https://www.jevai.org/) (TypeSafe AI's decision-only
model — takes an input, returns a yes/no with confidence, a category pick,
or a numeric score; no free text) for "some of the functions we need."
Deliberately deferred rather than adopted now — see below.

## What's done so far

Nothing built. This is a placeholder so the idea isn't lost, not an
active initiative.

## Why deferred

- Jev was released 2026-09-15 — two weeks old at the time this was raised,
  from a company founded in 2024. No track record yet on anything that
  touches real money.
- It fits structured/categorical decisions, not conversation — so it
  wouldn't touch Deja's chat at all. The candidate use cases are places
  Hermes doesn't have yet: the [[Bookkeeper Agent]]'s still-unbuilt
  propose-and-approve layer (categorizing Wave transactions is the
  obvious fit — see "what's not built yet" in
  [[systems-overview]]), and possibly [[Scheduler Agent]] logic once that
  has real tool access.

## What's left

Revisit once those systems actually exist to plug it into — there's
nothing to attach it to yet. When picking this back up:

1. Check whether Jev has an actual track record by then (uptime, other
   companies using it for financial decisions, whether TypeSafe AI is
   still around).
2. Identify a real candidate function once it exists — most likely
   transaction categorization in a built-out Bookkeeper.
3. Given it's a single-vendor dependency for a real business decision,
   design it so Jev's call can fail closed (fall back to asking Bryce)
   rather than silently guessing wrong.

## Blocked on

The rest of Hermes being built out first (Bookkeeper's propose-and-approve
layer, Scheduler's real tool access) — there's no function to wire this
into yet.
