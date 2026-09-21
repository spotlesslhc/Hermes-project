---
title: Wave integration — resolved as manual monthly entry
tags: [systems, hermes, bookkeeper, wave]
updated: 2026-09-21
---

# Wave integration — resolved as manual monthly entry

The [[Bookkeeper Agent]] and the dashboard's Financial Snapshot section
(revenue, net profit, net margin cards + charts) were originally meant to
run on numbers pulled automatically from [Wave](https://www.waveapps.com/),
the bookkeeping tool Spotless Cleaning uses. That turned out to be
impossible with the API access available (see below), so as of 2026-09-21
it works a different way: Bryce enters each month's numbers himself, and
Hermes stores them.

## How it actually works now

- The dashboard's Financial Snapshot section has a **"+ Add this month"**
  form — Bryce types in the month, revenue, and expenses (read straight off
  Wave's own report screen) and saves it.
- He can also just tell Hermes/[[Deja]] the numbers in chat — e.g. "revenue
  was $6,200 and expenses were $2,350 in August" — and it calls the
  `record_monthly_finance` tool to store the same thing. No approval step,
  since these are numbers Bryce is stating himself, not something being
  inferred or fetched.
- Both paths write to the same place: Cloudflare KV, one entry per month
  (`finance:month:YYYY-MM`, e.g. `finance:month:2026-08`), holding just
  `{ revenue, expenses }`.
- `/api/finance` (`GET`) reads the most recent 6 months of entries and
  returns the shape the dashboard charts expect — labels, per-month
  revenue/expenses/margin, and totals. `/api/finance` (`POST`) is what both
  the form and the chat tool call to save a new month.
- If no months have been entered yet, the dashboard shows preview/example
  numbers instead of a broken chart.

This was tested end-to-end on 2026-09-21: one real month via the dashboard
form, a different month via chat, and both correctly combined into the
totals and charts. (One quirk hit during testing: Cloudflare KV's `list()`
can lag a few seconds behind a `put()`, so the very first refresh right
after saving can briefly show stale data before it catches up — not a bug
in the numbers themselves, just a timing gap worth knowing about.)

## Why the original Wave-automation plan didn't work

Wave's public GraphQL API (`gql.waveapps.com/graphql/public`) has no way to
read financial activity by date — confirmed by directly introspecting the
live schema with the real token, not by reading docs:

- No `reports`, `profitAndLoss`, or any report-shaped query exists
  anywhere in the schema (checked the full root `Query` type and every
  field on `Business` — nothing).
- `Transaction` exists as a type but only exposes an `id` field. It's used
  as a return type for *creating* transactions (`moneyTransactionsCreate`
  and similar mutations), not for reading transaction history back.
- `Account.balance` is a snapshot of right now, with no date argument.
  `Business.accounts` only filters by type/subtype/archived status — no
  date range there either.

In short: this API can tell you an account's current balance and let you
create new transactions, but it cannot tell you what happened financially
in any given month. There's no field name that would have fixed this — the
capability isn't in the schema. Rather than build against a different Wave
API tier or a CSV-export workaround, manual entry was simpler and $0 cost,
so that's what got built.

`WAVE_API_TOKEN` and the Wave GraphQL connection code (`getWaveBusinessId`,
`waveGraphQL`) are still in `src/index.js` and still work, in case a real
read API becomes available later — they're just not used by
`getFinanceSummary` anymore.

## Open loose end

There's an unrelated, unconfirmed security follow-up from setting up
Wave's app page — see [[2026-09-21-wave-client-secret-exposure]].
