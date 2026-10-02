---
title: Cleaner text notifications — 3-week reminders and cascade auto-invite
tags: [systems, hermes, scheduler, sms, telegram, google-voice]
updated: 2026-09-28
---

# Cleaner text notifications — 3-week reminders and cascade auto-invite

> **PAUSED 2026-09-29 (Bryce's call, while traveling).** `runDailyCleanTextCheck`
> no longer sends reminders or queues texts/Telegram approvals. It still runs
> daily: it invites the next cascade cleaner to any unstaffed clean in the next
> 3 weeks via the calendar (Google emails the invite), sends the Telegram
> alerts for stuck cleans and 48h-unanswered invites, and logs each invite to
> Activity. To resume texting, restore the reminder push and the
> `createTelegramApproval` call in that function (see git history before this
> change) and re-enable the `cleaner-text-3week-check` scheduled task. The
> rest of this doc describes the paused design.
>
> **Unanswered invites (added 2026-09-29):** if an invited cleaner hasn't
> accepted or declined after 48h, Bryce gets a Telegram question with the
> clean's details and who's next in the cascade. "yes" removes the silent
> cleaner from the event (Google sends them a removal notice) and invites the
> next one; "no" keeps waiting and it never asks about that pair again. One
> open question at a time (stale after 24h); a removed cleaner is remembered
> in KV (`cleaning_skipped:<eventId>`) so the cascade never loops back to
> them. Telegram replies "yes"/"no" go to this question first
> (`answerAdvanceAsk`), then to the paused text-approval batch. If nobody
> else is available Bryce gets a plain alert instead.

> **Deja-driven texting added 2026-10-02.** Separate from the paused daily
> reminders above: the Scheduler can now text a cleaner itself, from Bryce's
> Google Voice, via a Browserbase cloud browser (no kept-online Claude Code
> session needed). See "Texting through Browserbase" at the bottom.

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

## Texting through Browserbase (2026-10-02)

Why: Amy (iCloud, no Google Calendar app) never received her invite emails,
so Bryce wanted the scheduling agent to text her instead. This is *not* the
rejected "Deja logs into Google Voice with stored credentials" idea — Bryce
signs in once himself in a Browserbase live view and the login is kept as a
Browserbase Context (same pattern as the Google Business tools); the Worker
never sees a password.

- **One-time setup:** open `/api/browserbase/voice-login`, sign in to Google
  Voice in the window that opens (use the Google account that owns his
  Voice number), then open `/api/browserbase/voice-login/done`. Ask Deja to
  run `check_google_voice` to confirm. If Google challenges the cloud
  browser or the login expires, redo it.
- **Numbers:** `set_cleaner_phone` (Deja, no approval) saves a roster
  cleaner's number in KV `cleaner_phones`. Only roster cleaners with a saved
  number can ever be texted — never an arbitrary number.
- **Sending:** `text_cleaner` (custom text) and `text_cleaner_schedule` (a
  standard list of a cleaner's next 14 days: property, day, time only; no door
  codes or customer details). Both end in a **dashboard approval** showing the
  exact recipient and message (`text_cleaner` is in `APPROVAL_REQUIRED_TOOLS`;
  the schedule tool also sends a Telegram nudge). On approval
  `sendGoogleVoiceText` drives voice.google.com: new message → recipient →
  Enter → checks the number's last 4 digits appear → types the message →
  clicks Send → checks the text appears in the thread. Any failure before the
  Send click sends nothing; only `voice.google.com` is ever opened.
- **Invite links:** `get_clean_invite_links` (read-only) returns a cleaner's
  upcoming cleans with each event's Google Calendar `htmlLink`, so Deja can
  paste links into `text_cleaner`. Property, date, time, response and link only;
  never descriptions (door codes, customer contacts). 600-character limit per
  text, so she splits long lists. The link opens the event for someone signed
  in to Google with the invited address, so a texted link may not work for an
  iCloud-only cleaner like Amy; the text should also say the property and day.
- **Replies** land in Bryce's Google Voice, not in Hermes; he reads and
  answers them himself.
- **Untested against live Google Voice when it shipped.** The page selectors
  (labels like "Send new message", "Type a message", "Send message") are
  best guesses at Google Voice's current labels. Expect to tune them on the
  first real attempt: the first text is approved by Bryce, and a failure
  before Send is harmless. The Activity log records each attempt.
- The paused 3-week reminder system could be switched to use this instead of
  the staged-text/Claude Code route if Bryce wants it resumed.
