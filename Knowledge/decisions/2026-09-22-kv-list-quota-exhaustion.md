---
title: "Mistake: dashboard polling exhausted Cloudflare KV's list() quota"
tags: [decision, mistake, bug, kv, dashboard, bookkeeper]
updated: 2026-09-22
---

# Mistake: dashboard polling exhausted Cloudflare KV's list() quota

**Status: fixed, documented so it doesn't happen again in a new form.**

## What happened

Bryce noticed the dashboard's Financial Snapshot Save button (and the
Pending Actions panel) started failing around midday with "KV list()
limit exceeded for the day," and that the activity log showed April's
financials saved twice.

Root cause: the dashboard polls `/api/pending` and `/api/finance` every
60 seconds (see `public/index.html`), and both handlers called
`env.HERMES_KV.list()` to enumerate their keys (`pending:*` and
`finance:month:*` respectively). Cloudflare KV's free plan meters `list()`
**separately from, and much lower than**, `get()`/`put()` — 1,000/day vs
100,000/day for reads. Two `list()` calls a minute is 2,880/day, so the
quota was gone in under six hours. (The "April saved twice" log entry was
a separate, minor bug — the Save button wasn't disabled during its
request, so a double-click fired two POSTs. Fixed alongside this.)

## The fix

[PR #11](https://github.com/spotlesslhc/Hermes-project/pull/11) replaced
both `list()` calls with a small index key (`pending_index`,
`finance_index`) updated on every write, so reads never enumerate keys.
See `src/index.js` (`getPendingIndex`/`getFinanceIndex` and their
`addTo*Index` helpers) and [[wave-integration]] for how the finance side
is used.

## The mistake within the fix

The index-building code still had a **lazy migration**: if the index key
didn't exist yet, it fell back to one `list()` call to build it from the
pre-existing prefixed keys, then cached the result. That's fine in
general — but it meant the very first write after deploying the fix still
needed `list()` to succeed once. Since the account's daily quota was
*already* exhausted when the fix shipped, that one-time bootstrap call
kept failing too, so Save kept erroring right up until the fix — the same
symptom, for a subtler reason.

Worked around same-day by writing `finance_index` directly with a single
`wrangler kv key put` (confirmed via individual `kv key get` calls, never
`list()`, that `finance:month:2026-04` was the only existing month), so
the write path never needed `list()` to succeed at all.

## Lesson for next time

A recovery/migration path that depends on the very resource that's
currently exhausted won't self-heal until the resource resets — plan for
that explicitly (seed the fallback state directly, or make the migration
retry-safe and cheap) rather than assuming "it'll just work once" during
an incident. More generally: before polling any external API on an
interval, check whether the specific operation used has its own quota
separate from the general one — `list()`/enumeration calls are often far
more restricted than plain reads or writes.
