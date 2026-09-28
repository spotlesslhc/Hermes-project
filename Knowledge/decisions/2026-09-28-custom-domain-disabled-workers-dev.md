---
title: Adding the custom domain silently killed the workers.dev address
tags: [decisions, security, zapier-overseer, bug, outage]
status: found and fixed 2026-09-28, needs live re-verification of the Turno Zap
updated: 2026-09-28
---

# Adding the custom domain silently killed the workers.dev address

## What happened

While trying to verify the [[2026-09-28-zapier-webhook-secret-get-bug|Zapier
webhook secret fix]] with a real Zapier test run, the step failed with a
**404**, not the expected 401-then-success. Checked directly with curl: the
entire `hermes-project.spotlesscleaninglhc.workers.dev` address was
returning 404 for **every path**, including `/` and `/api/status` — not
just the webhook. The new custom domain, `hermes.spotlesslhc.com`, was
working fine (302, the expected Access redirect).

Root cause: `wrangler.jsonc` gained a `"routes"` entry for the custom
domain (`feature/hermes-subdomain-telegram-webhook`, merged earlier this
session) without also setting `"workers_dev": true`. Wrangler's default
behavior when a `routes` array is present and `workers_dev` isn't
explicitly set is to disable the `*.workers.dev` address entirely on
deploy — it assumes routes-only deployment. This has been live and broken
since that PR merged and deployed, meaning:

- The live dashboard (bookmarked at the `.workers.dev` URL) has been
  unreachable.
- The Turno Zap's webhook (`/webhooks/turno-reservation`) has been 404ing,
  not 401ing.
- `tools/deja-bridge` and `tools/sms-batch/*` would have failed too, had
  they been used against the old URL during this window (they weren't,
  since testing happened against `hermes.spotlesslhc.com` directly).

## The fix

Added `"workers_dev": true` to `wrangler.jsonc` alongside the `routes`
entry, so both addresses stay live simultaneously. PR:
`fix/restore-workers-dev-route`.

## What this means for the Zapier secret bug fix

The 404 masked whether [[2026-09-28-zapier-webhook-secret-get-bug]]'s fix
actually works — the request never got far enough to hit either
Cloudflare Access or the Worker's own secret check. **Needs a fresh
Zapier test run once this fix deploys** to actually confirm the secret
check works now.

## What to do differently next time

Test the *unrelated-seeming* paths after any Worker config change, not
just the one you're changing. This session tested the new custom domain
thoroughly and never once re-checked that the old, already-working
address still worked — an easy blind spot, since the change felt purely
additive ("add a domain") rather than something that could regress
existing behavior. A one-line curl to the root URL after every
`wrangler.jsonc` change would have caught this within the same session
instead of it sitting live and broken for hours.
