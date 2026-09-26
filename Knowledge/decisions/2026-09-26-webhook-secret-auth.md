---
title: Every Hermes webhook now checks its own shared secret, not just Cloudflare Access
tags: [decisions, security, zapier-overseer, scheduler]
status: fixed (code); Turno Zap headers still need adding by Bryce
updated: 2026-09-26
---

# Every Hermes webhook now checks its own shared secret, not just Cloudflare Access

## What happened

While building the Zapier Overseer's new error-webhook
([[2026-09-26-deja-zapier-oversight-design]]), testing turned up a real,
already-live gap: the whole Worker sits behind Cloudflare Access
(documented in [[systems-overview]] since 2026-09-21), and any automated
caller — including Zapier — needs a Cloudflare Access **Service Token**
to get past it. A token already exists ("Hermes_Cloudflare Auth"), and
`tools/deja-bridge` already uses it correctly. But the "Turno property
(2211 Sahara) to Deja" Zap's `Webhooks by Zapier` step, which POSTs to
`/webhooks/turno-reservation`, has **no such headers configured at all**.

Confirmed directly: a plain `curl` POST to `/webhooks/turno-reservation`
(and `/webhooks/reservation`) gets a 302 redirect to Cloudflare Access's
login page, not the Worker's actual route logic. Since a 302 is a normal,
non-error HTTP response, Zapier's run history would show this as a
"successful" run even though nothing on Hermes' side ever happens — the
same "looks fine, does nothing" failure shape already hit twice this
session with Path E and Path G. This lines up with
[[unfinished-projects/verify-scheduling-with-real-bookings]] already
flagging the Turno automation as never confirmed against a real booking.

## Why the fix isn't "split Access by path"

The first instinct was to let `/webhooks/*` bypass Access entirely (since
each endpoint could check its own secret) and leave the dashboard/API
paths protected as before. Checked this directly in the Cloudflare
dashboard before proposing it as real: **not achievable on the current
setup**. The Access application protects the Worker via the "Workers"
destination type, which has no path field — it's whole-worker-or-nothing.
Path-scoped destinations only exist for the "Public hostname" type, which
requires a real DNS zone Bryce owns in Cloudflare; a `*.workers.dev`
address doesn't qualify. Splitting this by path would need a real custom
domain added to the project — out of scope for this fix.

## What actually changed

**Access stays exactly as it is** — still the primary gate, still
whole-worker. On top of that, every webhook handler in `src/index.js` now
independently checks a shared secret (`ZAPIER_WEBHOOK_SECRET`, header
`X-Zapier-Secret`) via a new `requireZapierWebhookSecret()` helper:
- `/webhooks/reservation`
- `/webhooks/turno-reservation`
- `/webhooks/zapier-status` (already had this from the original build)

This means a Cloudflare-side misconfiguration (like the missing Turno
token) can no longer cause a *silent* failure — without the secret,
callers now get an explicit `401`, both at the Access layer (if the
Service Token is also missing) and, if that layer is ever bypassed or
misconfigured, from the Worker's own code too.

## What's still needed

The Turno Zap's `Webhooks by Zapier POST` step still needs its actual
headers added — this fixes the code side but doesn't retroactively add
headers to the live Zap:
1. **Cloudflare Access Service Token** (`CF-Access-Client-Id` /
   `CF-Access-Client-Secret`) — using the existing "Hermes_Cloudflare
   Auth" token. Bryce needs to locate its Client ID/Secret (Cloudflare
   only shows a token's secret once, at creation — check
   `tools/deja-bridge/.env.local` first, since that script already uses
   this same token).
2. **The new shared secret** (`X-Zapier-Secret`, same value as
   `ZAPIER_WEBHOOK_SECRET`) — needs adding to this step too, now that the
   Worker checks for it.

Same two headers will be needed on `/webhooks/reservation`'s calling Zap
(not yet identified/audited this session) and on whatever eventually
calls `/webhooks/zapier-status` from Path E/Path G.

## What to do differently next time

When Cloudflare Access (or any edge-level gate) sits in front of a set of
webhooks, don't assume every consumer is correctly configured just
because the infrastructure exists — audit each Zap's actual header
configuration directly, the same way Zapier field mappings and path
conditions got audited earlier this session. An edge gate with an
inconsistently-applied bypass is worse than no gate at all, because it
fails silently rather than loudly.
