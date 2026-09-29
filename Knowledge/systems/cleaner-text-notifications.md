---
title: Cleaner text notifications — 3-week reminders and cascade auto-invite
tags: [systems, hermes, scheduler, sms, telegram, google-voice]
updated: 2026-09-28
---

# Cleaner text notifications — 3-week reminders and cascade auto-invite

Built 2026-09-27/28. Full build history and rejected alternatives (Twilio,
Google-Voice-via-Deja-login) are in
[[unfinished-projects/cleaner-sms-3week-notifications]] if ever needed —
this doc is just how it works today.

## What it does

Daily (`runDailyCleanTextCheck` in `src/index.js`, cron `0 15 * * *` =
8am Phoenix), for every Cleans calendar event within 3 weeks:

- **Already has an accepted cleaner** → one-time reminder text, sent once
  per event (`cleaning_texted:<eventId>` KV flag).
- **No accepted cleaner yet** → the next available candidate from that
  property's cascade (below) is added as a real calendar attendee
  immediately (`inviteCleanerToEvent`, same mechanism as `assign_cleaner`,
  no approval needed), then texted a direct link to accept. Cascade
  progress is read straight from the event's own attendee list (a decline
  naturally advances to the next candidate the next day) — no separate
  tracking needed.
- **Nobody available, or property has no cascade** → immediate one-off
  Telegram alert to Bryce (`alertOnceForEvent`), not folded into the daily
  batch.

## Cascade order (confirmed with Bryce 2026-09-28)

| First pick | Properties |
|---|---|
| Amy | Sahara, Columbine, Palo Verde, Unit 324, Arapaho, Unit 303 |
| Ashley | Fremont, Bluegill |

**1328 Piper is excluded** — no longer cleaned; leftover calendar events
for it are skipped, not auto-assigned.

## The approval flow

Every text (reminder or invite) waits on Bryce's yes/no over **Telegram**,
not just the dashboard — he can approve from anywhere. Bot token
(`TELEGRAM_BOT_TOKEN`) and his chat id (`TELEGRAM_CHAT_ID`) are configured
in `wrangler.jsonc`. A real incoming `/webhooks/telegram` route resolves
his reply instantly, protected by its own secret (`TELEGRAM_WEBHOOK_SECRET`)
rather than Cloudflare Access.

Hermes never sends the text itself — no trustworthy Google Voice API
exists. Once approved, a kept-online Claude Code session (scheduled task
`cleaner-text-3week-check`, daily) polls `GET /api/sms-batch`, and per
[[playbooks/2026-09-27-cleaner-text-3week-google-voice|this playbook]]
drives Google Voice in Bryce's own signed-in Chrome to **stage** each text
(cleaner found by name, message typed in) — it never clicks Send; Bryce
does that himself. `POST /api/sms-batch/complete` closes out the batch
once sent.

## Why a custom domain exists

`hermes.spotlesslhc.com` (added alongside the original `*.workers.dev`
address — both must stay live, see
[[decisions/2026-09-28-custom-domain-disabled-workers-dev]]) exists
specifically so `/webhooks/*` can bypass Cloudflare Access via a
path-scoped policy, which the bare `*.workers.dev` address can't do
(whole-worker Access only). Two Access apps: the hostname's root
(login/service-token required) and a second one scoped to path
`/webhooks/*` (Bypass, Everyone).

## Known gaps

- **Zac** isn't in the cleaner roster (no email on file) — can't be
  cascade-assigned or texted until added.
- An invited cleaner who never responds doesn't advance the cascade (only
  an explicit decline does), but Bryce now gets a one-time Telegram alert
  after 48h of silence (added 2026-09-29).
- Not yet proven against a real end-to-end cycle (real cleaning → real
  Telegram approval → real staged text) — watch the first few live days.
