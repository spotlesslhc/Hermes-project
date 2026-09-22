---
title: Systems Overview
tags: [systems, hermes]
updated: 2026-09-21
---


# Hermes — how it's actually built right now

Hermes is the name for both the dashboard Bryce uses and the small
piece of software behind it. This note describes what exists today —
not the long-term plan, just what's actually running.

Everything lives in one place: Cloudflare, a hosting company. Cloudflare
runs the dashboard and the backend for free. The only ongoing cost is
usage of Claude (Anthropic's AI), which is billed per use — typically
pennies to a few dollars a month at this scale.

## The dashboard

As of 2026-09-21 the dashboard's on-screen name is **Deja** — Hermes is
still the underlying system's name (the repo, the Worker, this vault), but
the UI Bryce actually sees now says Deja throughout, including the "Ask
Deja" chat box. **This split is deliberate, not partial work**: the rename
is scoped to the display name and chat persona only. Backend file names,
variable names, the repo name, and the Worker's URL are all meant to stay
"Hermes" — see [[2026-09-21-deja-rename-scope]] before "finishing" the
rename in either direction. The page also picked up a dark theme as the default look
(light mode is now the explicit toggle-on option instead of the other way
around), a network-graph "orb" hero visual, and wake-word listening (says
its name to start talking instead of only tapping the mic).

The dashboard shows:

- A tile row of the outside apps the business uses (Zapier, Google
  Calendar, Gmail, Hospitable, Hostaway, Wave, Venmo, Foothills Bank,
  the website, and Claude/claude.ai) — clicking one just opens that app
  in a new tab. Each tile is just a link; there's no deeper integration
  behind any of them.
- Four "agent" cards: [[Zapier Overseer Agent]], [[Scheduler Agent]],
  [[Bookkeeper Agent]], and [[Site Editor Agent]]. Each is meant to
  represent one area of the business Hermes will eventually oversee.
- Four "agent" cards, then a **Pending Actions** panel (see
  [[approval-queue]]) — empty today, it's where any future action that
  needs Bryce's explicit approval would show up with Approve/Deny buttons.
- A Financial Snapshot section — revenue, net profit, and net margin stat
  cards plus two charts, backed by whatever monthly numbers Bryce has
  entered so far (a form on the dashboard, or telling Hermes/Deja directly
  in chat). Shows preview numbers until at least one real month is entered.
  See [[wave-integration]] for why it's manual entry rather than automated
  from Wave.
- An activity log of recent events.
- The "Talk to Deja" chat box — as of 2026-09-21 it's the first thing under
  the orb, not the last section on the page. Bryce can type, tap the mic,
  or say "Hey Deja" to start a hands-free back-and-forth conversation that
  keeps listening until he says "goodbye" — see [[voice-and-conversation]]
  for how that actually works and the two real bugs found and fixed getting
  there. The orb itself can also be popped into a floating window that
  stays on top of other apps — see [[floating-orb]].

Deja/Hermes can also be reached outside the dashboard: Claude Code can talk
to her directly through a small bridge script, see [[deja-bridge]]. She can
also read this vault herself during any conversation — see
[[vault-access]].

**Current state of the four agent cards:** [[Zapier Overseer Agent]] and
[[Scheduler Agent]] still show placeholder numbers — neither is wired up
to actually watch Zapier or assign cleaners yet. [[Bookkeeper Agent]] and
[[Site Editor Agent]] are the two real ones: Bookkeeper can record and
read monthly financials (see [[wave-integration]]), and Site Editor can
either open real PRs itself via `propose_site_edit` (see [[site-editor]])
or, as of 2026-09-21 and now the default, hand the edit off to Claude Code
via `queue_edit_request` instead — free, but not instant, see
[[2026-09-21-claude-code-task-queue]]. "Talk to Deja" is also fully real —
it sends the question to Claude and shows a genuine reply, calling
whichever tool fits, or queuing the action for approval instead if it's
ever a tool risky enough to need that (see [[approval-queue]] — nothing
today actually is).

## The Cloudflare Worker (the backend)

A "Worker" is Cloudflare's name for a small backend program that runs
on their network on demand — there's no server to maintain or pay for
by the hour. Hermes' Worker does these jobs:

1. Answers `/api/ask` — takes whatever you typed or said to Hermes,
   sends it to Claude along with Hermes' instructions (its personality
   and job description), and returns the reply. Handles Claude calling
   more than one tool in the same turn (fixed 2026-09-21 — see
   [[deja-bridge]] for how that bug was actually found).
2. Answers `/api/status` and `/api/log` — hands the dashboard the
   current agent statuses and recent activity, so the page can update
   itself without a full reload.
3. Answers `/api/finance` — `GET` returns the last 6 months of
   revenue/expenses for the dashboard's Financial Snapshot section; `POST`
   saves one month's numbers (used by both the dashboard's entry form and
   Hermes' `record_monthly_finance` chat tool). Backed by manually entered
   numbers in KV, not a live Wave feed; see [[wave-integration]] for why.
4. Answers `/api/speak` — turns a reply's text into real speech via
   ElevenLabs (currently the "Bella" voice), proxied server-side so the
   API key never reaches the browser. Falls back to the browser's own
   built-in voice if this fails or isn't configured. See
   [[voice-and-conversation]].
5. Answers `/api/pending` (list) and `/api/pending/decide` (approve/deny)
   — the backend half of the Pending Actions panel. See
   [[approval-queue]].
6. Listens for `/webhooks/reservation` — a way for Zapier to notify
   Hermes the moment a new booking comes in, so it can eventually flag
   it for the [[Scheduler Agent]].

The dashboard page itself (the HTML you see) is *not* run by this
program — Cloudflare just serves it directly, like a plain file. The
Worker only kicks in for those API and webhook addresses.

## The KV namespace (Hermes' memory)

Workers don't remember anything between requests on their own, so
there's a separate storage bucket called a KV namespace — think of it
as a simple filing cabinet Hermes can read from and write to. It's
named `HERMES_KV`. Right now it holds five things:

- **Agent status** — the running/idle/needs-review state shown on each
  agent card.
- **Activity log** — the running list of what each agent has done
  recently (most recent 200 entries).
- **Reservations** — new bookings received from the Zapier webhook,
  each marked assigned or not yet assigned.
- **Monthly finance entries** (`finance:month:YYYY-MM`) — Bryce's
  manually entered revenue/expenses per month, powering the Financial
  Snapshot section. See [[wave-integration]].
- **Pending actions** (`pending:<uuid>`) — added 2026-09-21, holds any
  action queued for Bryce's approval. Empty today. See [[approval-queue]].

## The Secrets Store bindings

Hermes keeps its credentials in Cloudflare's Secrets Store rather than
sitting in plain text anywhere in the code — Cloudflare keeps each one
hidden even from the project's settings page after it's been saved. Each
binding has to be declared both in the Secrets Store itself and in
`wrangler.jsonc` (`secrets_store_secrets`), or the Worker won't actually
receive it. Four are bound right now:

- **`ANTHROPIC_API_KEY`** — proves to Anthropic (the company that makes
  Claude) that requests are allowed and billed to Bryce's account. The
  Worker fetches it at request time for every call to Claude, including
  Hermes' replies and the [[Site Editor Agent]]'s edit-drafting calls.
- **`GITHUB_TOKEN`** — lets the [[Site Editor Agent]] read files from and
  open pull requests against the website and dashboard repos. See
  [[site-editor]] for how it's used.
- **`WAVE_API_TOKEN`** — bound and active as of 2026-09-20. The Worker can
  authenticate to Wave and look up the business ID with it, but nothing
  reads financial data through it — Wave's public API turned out to have
  no way to read dated transaction history at all. See
  [[wave-integration]] for what actually powers the Financial Snapshot
  section instead.
- **`ELEVENLABS_API_KEY`** — bound and active as of 2026-09-21. Lets the
  Worker call ElevenLabs' text-to-speech API server-side for `/api/speak`.
  Deliberately added to `wrangler.jsonc` only *after* the actual secret
  existed in the Secrets Store — binding to a not-yet-created secret can
  fail the whole deploy, not just voice. See [[voice-and-conversation]].

## Repo structure

Everything is stored as one project in GitHub
(`spotlesslhc/Hermes-project`, **private** as of 2026-09-21 — see
[[2026-09-21-hermes-repo-made-private]]), which is what Cloudflare watches
for changes. It looks like this:

```
public/        The dashboard page itself (served directly, no code runs)
src/           The Worker script — handles /api/* and /webhooks/*
wrangler.jsonc  Tells Cloudflare where everything above lives
knowledge/      This notes vault — how the business and Hermes work
README.md      Setup / deployment instructions
```

## How a change gets live (the deploy process)

1. A change is pushed to the GitHub repo (usually by editing a file and
   committing).
2. Cloudflare notices automatically and re-deploys the project —
   nothing needs to be clicked manually.
3. The live dashboard and Worker are updated within roughly a minute.

Two settings make this work and shouldn't be changed: the deploy
command is `npx wrangler deploy` (not `wrangler pages deploy` — that's
for a different Cloudflare product this project isn't using), and the
project must stay connected to the same GitHub repo. Deleting and
recreating the Cloudflare project would wipe the KV binding, the API
key, and the domain, and everything would need to be reconnected from
scratch.

To change what Hermes says or how it behaves, its instructions are
edited in plain English inside the Worker script (the
`HERMES_SYSTEM_PROMPT` text) — no separate configuration screen for
that yet.

## What's not built yet

- [[Zapier Overseer Agent]] and [[Scheduler Agent]] have no real access
  yet — they can't check Zapier or edit the calendar. These are the two
  remaining placeholder agent cards and the next planned work.
- [[Bookkeeper Agent]] is partially built: it can record and read monthly
  revenue/expenses (see [[wave-integration]]), but the propose-and-approve
  layer — e.g. drafting transaction categorizations for Bryce to review,
  the way [[Site Editor Agent]] opens PRs — doesn't exist yet. That's a
  distinct next step, not something the Financial Snapshot work covered.
- An **Ads Agent** isn't built at all yet, deliberately — see
  [[2026-09-21-ads-agent-deferred]].
- The dashboard itself still has no separate login screen of its own, but
  as of 2026-09-21 the whole Worker (dashboard + API) sits behind
  Cloudflare Access — anyone visiting needs to authenticate through
  Access, and automated requests (like testing) need an Access Service
  Token.
- The [[approval-queue]] framework is fully built and tested but currently
  gates nothing — none of Hermes' real tools are risky enough to
  need it. It's there for whenever a real risky tool (payments, calendar
  writes, anything hard to reverse) gets added.
