---
title: Worker security controls (what's in place and how to operate them)
tags: [systems, security, worker]
updated: 2026-10-02
---

# Worker security controls

Added 2026-10-02 after a security audit of `src/index.js`
(see [[unfinished-projects/worker-security-hardening]]). Six changes, each its
own PR (#81 to #86). This note says what each one does in practice, because
some of them change how Deja and the dashboard behave.

## 1. Outside text can't trigger actions (taint gate)

Once a conversation has read email, a web page, a Google Business page or a
Google Voice message list, every tool that isn't plainly read-only goes to the
approval queue instead of running. Details and the exact tool lists:
[[approval-queue]]. **What you'll notice:** if Bryce asks Deja to read his mail
and then do something in the same chat, there's an extra approval card. Start a
new conversation (reload the dashboard) to get back to normal. `set_cleaner_phone`
always needs approval.

## 2. A text approval shows who it goes to

The card for a text shows the last 4 digits of the recipient's number, and
sending fails if the saved number changed after the text was queued. If an old
approval fails with "queued without a recipient check", ask Deja to queue it again.

## 3. An approved action runs once

The action is claimed and marked `running` before it executes, so a second click
or a second open tab can't run it twice (the second gets "Already being handled").
If the Worker is killed mid-action the item stays `running` and isn't offered
again; ask Deja to queue it again.

## 4. Sign-in callbacks check `state`

The Spotify and Google (Calendar + Gmail) logins mint a single-use value that the
callback must present (10 minute expiry). If a sign-in is interrupted, start it
again from the dashboard tile.

## 5. Cross-site request guard

Any state-changing request must be `application/json` and must not be marked
cross-site by the browser; the four Browserbase login-session routes refuse
cross-site navigations. `/webhooks/*` and the OAuth callbacks are exempt.
**Any script that POSTs to `/api/*` must send `Content-Type: application/json`**
(the existing `tools/` scripts already do).

## 6. The Worker verifies the Cloudflare Access token

Nothing else in the Worker authenticates the dashboard API; Access is the gate.
This check confirms the Access token on every non-webhook request, so an
address left uncovered by Access fails closed. **Currently LOG-ONLY**
(`CF_ACCESS_MODE: "log"` in `wrangler.jsonc`): it records problems in the
Activity log (at most once an hour) and blocks nothing.

**To switch to enforcing** (do this after a few quiet days):
1. Check the Activity feed for entries starting "Access check (log-only)". If
   there are none, it has been quiet. If there are, read the reason in the entry
   and explain it first (for example, "no Access token on the request" on a
   particular route means Access isn't in front of it the way we assume).
2. Change `CF_ACCESS_MODE` to `"enforce"` in `wrangler.jsonc`, in a PR.
3. After the deploy, load the dashboard and ask Deja something. If it breaks,
   change the mode back to `"log"` (one-line revert); the cause will be in the log.

Config values (not secrets): team domain `plain-poetry-7846.cloudflareaccess.com`
and the AUD tags of the two Access applications ("Hermes dashboard" for the
workers.dev address and preview URLs, "hermes" for hermes.spotlesslhc.com).

## Verified from outside (2026-10-02)

Both addresses redirect every non-webhook request to the Access login;
`/webhooks/*` on the custom domain reaches the Worker's own secret check
(401 without the secret); four path tricks aimed at the webhook exemption
returned a login or 404. Re-check after any Access or domain change.

## Known limits

Calendar event text is not treated as outside text (the taint gate would make
cleaner assignment unusable). The GitHub token the Worker uses can write to
`main` of this public repo (it files the task queue); scope it to this repo only,
and don't add branch protection on `main` without changing how tasks are queued.
