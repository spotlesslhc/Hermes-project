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
- **Checking what really happened (`check_text_status`, 2026-10-02):** the
  first two approved texts to Amy showed no sent messages in Voice and Deja
  couldn't tell why. `check_text_status` (read-only) returns the approval
  queue's real outcome for the last `text_cleaner` actions (approved, or
  failed with the error) and, when a cleaner is named, looks in Bryce's Voice
  message list for her number / the last text sent. Failures now include the
  list of buttons/inputs Google Voice was actually showing, and
  `check_google_voice` lists them too, so label guesses can be corrected from
  evidence. A text whose Send click couldn't be confirmed in the thread now
  fails as `UNCONFIRMED` instead of reporting success. Removed a too-loose
  recipient-box fallback ("to") that could have matched a search box.
  **Why Amy's two texts didn't appear is not known**: the live Worker
  couldn't be inspected from the Claude Code session; run `check_text_status`
  for Amy (it shows the stored error for #cca68574 / #04a291eb) and
  `check_google_voice`, then tune the labels in `sendGoogleVoiceText`.
- **Send step rewrite (2026-10-02, task "texts not sending"):** `check_text_status`
  showed both approved link texts to Amy as UNCONFIRMED and Bryce saw nothing
  in Voice, with login ruled out. Without live access the cause couldn't be
  reproduced, so the send step was made stricter and self-documenting
  (`runVoiceCompose`): it reads the compose box after typing (aborts if empty
  or only partly filled, so long/newline/link texts can't half-enter), finds the
  Send button by exact label nearest the compose box (the old substring
  fallback `"send"` could click "Send new message" instead of Send), nudges the
  box if Send is disabled (framework didn't register the inserted text), clicks,
  and only reports success if the box emptied and the text is in the thread; a
  message left in the box is reported as not sent. Screenshots of each step
  (`start`, `recipient`, `typed`, `after_send`, `error`) are kept in KV for a
  day and viewable at `/api/voice-screenshot?step=...` (behind Access).
  **`test_voice_compose`** (no approval) runs the whole flow as a dry run that
  never clicks Send, for diagnosing by eye; try a short plain message with no
  links first, then the real one. If it still fails, the screenshots and the
  controls list in the error say exactly where.
- **Send button is an icon (2026-10-02, from Bryce's screenshot):** in Google
  Voice the compose box ("Type a message") has an icon-only paper-plane at its
  right end — no visible "Send" text, and the page also has a keypad panel on
  the right ("Call as", "Enter a name or number") and an attach-image button on
  the left. `findSend` therefore looks first for an exact `Send`/`Send message`
  label and otherwise takes the small button on the compose box's row just to
  its right (not the left attach button, not the keypad panel); the outcome
  reports which method found it. If the box doesn't clear after the click it
  presses Enter once (Voice sends on Enter).
- **Send button stayed disabled (2026-10-02, dry run):** `test_voice_compose`
  found "Send message" by label with the message fully typed, but the button
  stayed disabled even after nudging, i.e. Voice didn't accept the recipient
  (the number was just text in the To box; the old check passed because the
  suggestion dropdown also contained the digits). The compose flow now (1)
  opens the cleaner's **existing thread** by clicking its left-list row (by name
  or number) and verifies the thread header shows the number, which also needs
  no recipient step; otherwise (2) types the number in the new-message box and
  **clicks the suggestion** directly under it (never the dialer panel on the
  right) instead of pressing Enter. Either way the real proof is the Send
  button becoming enabled. New screenshot step `suggest`. Not yet re-run live.
- **Search route first (Bryce, 2026-10-02):** from a screenshot of the cloud
  browser's Voice page, the flow is now: click the **Search Google Voice** box,
  type the number, click the matching number or the contact (e.g. Amy) in the
  dropdown, which opens the thread, and only proceed if the thread header
  shows the number. Fallbacks, in order: the cleaner's row in the left list,
  then the new-message flow. Screenshot step `search`.
- **Search results fix (2026-10-02, second dry run):** the dry run stopped
  with "couldn't find the new-message button" and a controls list showing
  search results with "Message 909 264 0249" / "Call 909 264 0249" options,
  because the search stayed active (the dropdown click didn't match, then the
  fallbacks ran against the results page). `pickSuggestion` now prefers the
  **"Message <number>"** option, then the contact row (by name), then any row
  with the number, only below/left of the search box, and **never a "Call ..."
  option** (that would dial). If the search route doesn't open the thread the
  inbox is reloaded (`reset`) before the fallbacks, so a stale search can't
  hide the buttons.
- **Replies** land in Bryce's Google Voice, not in Hermes; he reads and
  answers them himself.
- **Untested against live Google Voice when it shipped.** The page selectors
  (labels like "Send new message", "Type a message", "Send message") are
  best guesses at Google Voice's current labels. Expect to tune them on the
  first real attempt: the first text is approved by Bryce, and a failure
  before Send is harmless. The Activity log records each attempt.
- The paused 3-week reminder system could be switched to use this instead of
  the staged-text/Claude Code route if Bryce wants it resumed.

## Established method for sending Amy her cleaning invites (confirmed 2026-10-02)

Proven live: two approved link texts to Amy went out and showed in her Google
Voice thread. Amy has no Google Calendar app and her invite emails never
reached her inbox, so this is how she gets her cleans from now on:

1. Calendar invite goes out as usual (`assign_cleaner`, or
   `resend_cleaner_invites` if she says she never saw it).
2. Ask Deja to text Amy her upcoming cleans. Deja pulls the links with
   `get_clean_invite_links` and queues `text_cleaner` (600 characters max, so
   she splits long lists into several texts of 1-3 cleans, each with its link
   and the property/day/time written out, since the link may not open for an
   iCloud-only cleaner).
3. Bryce approves each text in Pending Actions, **one at a time**, and Deja
   confirms with `check_text_status` (and the thread in Google Voice) before
   the next. Never treat "approved" as "delivered".
4. If a send fails or is UNCONFIRMED, run `test_voice_compose` (sends nothing)
   and check `/api/voice-screenshot?step=...` before retrying. If Voice
   reports an expired login, redo `/api/browserbase/voice-login`.

Why the flow works: it searches Amy's number in the Google Voice search box
and opens her **existing thread**, requiring the header to show her number
before typing anything; the Send button must be enabled, the box must clear,
and the text must appear in the thread. Same method applies to any roster
cleaner once their number is saved with `set_cleaner_phone`.
