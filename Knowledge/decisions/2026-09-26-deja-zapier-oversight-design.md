---
title: Deja's Zapier oversight — what "view and edit" actually turned out to mean
tags: [decisions, zapier-overseer, zapier, security]
status: view half built; edit deliberately stays human-supervised
updated: 2026-09-26
---

# Deja's Zapier oversight — what "view and edit" actually turned out to mean

## The original ask

[[unfinished-projects/zapier-overseer-buildout]] tracked "design full view
and edit access for Deja" as an open item — Bryce's own framing was that
oversight means being able to view and edit any part of Zapier, not just
get failure notifications.

## The reality check

Checked Zapier's actual account settings and public API docs directly
before designing anything. Two findings:

1. **Bryce's account is on the Pro plan** ($239.88/yr) — not Team or
   Company.
2. **There is no API, on any Zapier plan, for a personal account to read
   or write its own existing Zaps' configurations.** The one real "Zap
   Management API" that exists (`GET/PATCH /v2/zaps/{id}` etc., found at
   `docs.zapier.com/powered-by-zapier/...`) belongs to **"Powered by
   Zapier"** — a white-label product for a company that embeds Zapier
   inside its *own* SaaS product, so *its own customers* can build
   automations without leaving that product. It's an OAuth flow where an
   "end user" of that partner's app grants access; it has nothing to do
   with a person managing their own zapier.com account. This applies
   regardless of plan tier — Team and Company add user/seat management
   and SSO, not a personal Zap-management API.

This means "full view and edit access for Deja" as a stored API
credential was never actually achievable, on any plan. Every live edit
made across this session (Path E, Path G, the calendar Zap's cancellation
bugs, the field-mapping fix) went through a real browser session signed
into Bryce's own Zapier account — because that is, in fact, the only way
to edit a Zap's configuration that exists.

## The design that's actually real

**View — built 2026-09-26**: a new endpoint, `POST /webhooks/zapier-status`,
authenticated by a shared secret (`ZAPIER_WEBHOOK_SECRET`, header
`X-Zapier-Secret`) that only Zapier and this Worker know — not a Zapier
account credential, so it doesn't add to the cleartext-token exposure
already logged in [[2026-09-22-zapier-wave-token-cleartext]]. A Zap's own
Code-by-Zapier step can `POST` `{ zap, step, error }` here when it catches
a real failure. Wired into `src/index.js`:
- Increments `zapier_overseer.errors` and sets `lastChecked` in KV.
- Logs a real entry to the Activity feed (`who: "Zapier Overseer"`).
- `errors` resets to 0 every Monday via the existing payroll cron trigger
  (`resetWeeklyZapierErrorCount`), matching the dashboard's existing
  "Errors this week" label.
- `zapsWatched` corrected from a stale hardcoded `6` to the real current
  count, `2` (only two Zaps remain active — see [[zapier-automations]]).

This replaces the permanently-static `zapsWatched: 6, errors: 0` stub
that's existed since the dashboard was first built, with real signal —
without ever giving Deja a credential that could edit or delete anything
in the Zapier account.

**Edit — stays exactly as it works today, by design, not as a fallback**:
a human-supervised Claude Code session driving Bryce's own logged-in
browser, with every Publish click and every delete confirmed by Bryce.
This isn't a workaround for a missing API — it's the correct shape given
Zapier's actual product surface, and it already matches the standing
auto-mode classifier protections ("Modify Shared Resources," "Irreversible
Deletion") that blocked automated Publish/delete attempts earlier this
session. No further design work needed here; nothing to build.

## What's left

The Worker-side endpoint is built and on a PR (`feature/zapier-error-webhook`),
but two things still need doing before it's actually live:

1. **Bryce needs to create the real secret value** — run
   `wrangler secrets-store secret create 8f15d6429b5741f9ac32e05415413a65
   --name ZAPIER_WEBHOOK_SECRET --scopes workers` and paste in a random
   value at the interactive prompt (never typed into a script or command
   flag, so it never touches shell history). This wasn't done by Claude
   Code — generating and setting the actual secret value was blocked by
   the session's own credential-handling safeguard, correctly, since a
   shared secret is exactly the kind of value that shouldn't pass through
   an automated flow if it can be avoided.
2. **Wire the actual Zaps to call it** — add a `requests.post()` call to
   `https://<worker-domain>/webhooks/zapier-status` inside the existing
   `except`/failure-return branches of the two Code-by-Zapier steps (Path
   E and Path G's Python code), with the shared secret in the
   `X-Zapier-Secret` header. This is a live Zapier edit, so it needs the
   same human-supervised approach as every other change this session —
   not something to start without Bryce present. Left as the next
   concrete step in [[unfinished-projects/zapier-overseer-buildout]].
