---
title: The Zapier webhook secret check has been broken since it shipped
tags: [decisions, security, zapier-overseer, bug]
status: fixed 2026-09-28, not yet verified against a real Zapier call
updated: 2026-09-28
---

# The Zapier webhook secret check has been broken since it shipped

## What happened

While building the cleaner-text Telegram webhook (2026-09-27), noticed that
`requireZapierWebhookSecret` (`src/index.js`) compared `env.ZAPIER_WEBHOOK_SECRET`
directly, instead of calling `.get()` on it first like every other
secrets-store binding in this file (`WAVE_API_TOKEN.get()`,
`GOOGLE_CALENDAR_CLIENT_ID.get()`, `TELEGRAM_BOT_TOKEN.get()`, etc.).

`ZAPIER_WEBHOOK_SECRET` is declared as a `secrets_store_secrets` binding in
`wrangler.jsonc`, same as those others -- accessing it directly (without
`.get()`) returns the binding object itself, not the actual secret string.
`timingSafeEqual` explicitly checks `typeof a !== "string"` and returns
`false` immediately if either side isn't a string. That means the secret
check was comparing a real header value (a string) against a binding
object (never a string) -- **guaranteed to fail every single time**,
regardless of what secret value the caller actually sent.

This function guards three routes: `/webhooks/reservation`,
`/webhooks/turno-reservation` (the real-money one — Sahara/Turno), and
`/webhooks/zapier-status`. If this reasoning is right, every one of them
has been returning 401 Unauthorized to every real, correctly-configured
caller since the secret check was added (`a350cd8`, 2026-09-26) -- not
just to unauthenticated ones the way it's supposed to.

## Why this wasn't caught by the original "verified live" test

[[2026-09-26-webhook-secret-auth]] documents a real test run of the Turno
Zap that supposedly "passed Cloudflare Access, passed the new secret
check, and reached Hermes' actual reservation parser." Worth resolving
this apparent contradiction once this fix is verified: either that test
predates this bug being introduced, the test's "success" was actually
Cloudflare Access's own block dressed up as expected behavior, or
something else is off. Don't assume the old note's account is wrong
without checking (or that this one's diagnosis is right without checking)
-- verify against a real Zapier send either way.

## The fix

`requireZapierWebhookSecret` is now `async` and does
`await env.ZAPIER_WEBHOOK_SECRET.get()` before comparing, same pattern as
every other secret in this file. Its three callers now `await` it. PR:
`fix/zapier-webhook-secret-get`.

## How to verify this live

Not yet done -- couldn't test the "correct secret" path from Claude Code
directly (extracting the live secret value to build a manual curl test
was refused by the sandbox's safety classifier, correctly, since that's
exactly the kind of credential materialization this project already
treats as risky). The real test:

1. In Zapier, open the Turno Zap's `Webhooks by Zapier POST` step (the one
   with the `X-Zapier-Secret` header already configured from
   [[2026-09-26-webhook-secret-auth]]).
2. Run a real **Test step** with a real or realistic sample payload.
3. Confirm it succeeds and actually reaches the Worker's reservation logic
   (check the Activity log for a new-reservation entry, or an explicit
   parse error if the sample data isn't a real reservation -- either is
   fine, both mean the request got through; a 401 means this fix didn't
   work).

## What to do differently next time

Same lesson [[2026-09-26-webhook-secret-auth]] already drew, worth
repeating since it applied here too: a secret that "looks" wired up (the
right header name, the right binding declared in `wrangler.jsonc`) still
needs its actual access pattern checked against how this specific binding
type works, not assumed from the variable name. A `secrets_store_secrets`
binding is an object with a `.get()` method, not a string -- copy-pasting
`env.SOME_SECRET` from a `vars` example (a real string) into code dealing
with a secrets-store binding is an easy, silent mistake, and the failure
mode (permanent 401) looks identical to "the caller's config is wrong,"
which is exactly what delayed catching this the first time.
