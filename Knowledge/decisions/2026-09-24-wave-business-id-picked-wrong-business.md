---
title: getWaveBusinessId() silently queried the wrong Wave business
tags: [decision, mistake, wave, bookkeeper]
updated: 2026-09-24
---

# getWaveBusinessId() silently queried the wrong Wave business

## What happened

While building Wave invoice creation for the Turno property (see
[[unfinished-projects/turno-property-zapier-buildout]]), a live query for
customers and products against Wave's GraphQL API kept coming back
completely empty — zero customers, zero products — despite Wave's own
web UI showing 21 customers and 70+ catalog items under the same
account.

The cause: this Wave account actually has **two businesses** —
"Personal" (empty, presumably created by default when the account was
set up) and "Spotless Cleaning" (the real one, with all the customers,
products, and invoices). `getWaveBusinessId()` in `src/index.js` picked
`businesses.edges[0]` — whichever business the API happened to list
first — with no check on name. That happened to be "Personal". The
function then cached that wrong ID in KV (`wave:business_id`), so every
call kept using it silently, with no error to signal anything was wrong
— an empty result set looks identical to "this business really has no
customers."

## Why this matters beyond the Turno feature

`getWaveBusinessId()` is a shared helper used by every Wave-touching
feature in this codebase, not something new to this session. Any past
or future Wave read/write that went through it was querying "Personal"
instead of "Spotless Cleaning" the whole time, unless something else
happened to override the cache. Confirmed via
[[systems/wave-integration]]'s own history: the original Wave-automation
plan for financial reporting was abandoned in September because the API
"couldn't read financial activity by date" — that conclusion may be
worth revisiting given this bug existed at the same time, though the
documented reasoning (no report-shaped query in the schema at all) reads
as independently valid regardless of which business was queried.

## Fix

`getWaveBusinessId()` now matches by business name (`"Spotless
Cleaning"`, a new `WAVE_BUSINESS_NAME` constant) instead of trusting
list order, falling back to `edges[0]` only if no name match is found.
The poisoned `wave:business_id` KV entry was deleted so the fix actually
takes effect instead of continuing to serve the cached wrong ID.

## What to do differently

- An empty result set from an API is not the same as "nothing exists" —
  when a query that should obviously return data comes back empty,
  check whether it's scoped to the right parent/tenant/account before
  assuming the data itself is missing.
- When code picks the first item from a list without an explicit
  ordering guarantee or a name/ID check, treat that as a bug waiting to
  surface the moment the account gains a second item of that kind —
  this pattern is worth grep'ing for elsewhere in this codebase
  (`edges?.[0]`, `edges[0]`) if similar bugs need ruling out.
