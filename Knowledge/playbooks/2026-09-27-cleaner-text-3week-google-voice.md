---
title: Staging cleaner texts in Google Voice after a Telegram approval
tags: [scheduler, google-calendar, sms, google-voice, telegram, playbooks]
updated: 2026-09-27
status: draft
---

# Staging cleaner texts in Google Voice after a Telegram approval

## What this covers

Once a day, check whether Bryce approved a batch of cleaner-text
reminders over Telegram (see
[[unfinished-projects/cleaner-sms-3week-notifications]] for the full
design), and if so, type each text into Google Voice in Bryce's own
signed-in browser -- staged and ready, but **not sent**. Bryce sends them
himself. This is deliberate, not a missing feature: sending a message on
his behalf isn't something Claude does unattended, no matter how the
approval to prepare it arrived -- same rule this project already applies
to Venmo payroll payments (Claude prefills, Bryce clicks Send).

## Steps

1. Run `node tools/sms-batch/check-batch.mjs` from the repo root. This
   hits `GET /api/sms-batch` on the Worker.
2. If the result is `{"status":"none"}` or `{"status":"pending", ...}`,
   stop -- nothing approved yet.
3. If `status` is `"no"`, stop -- Bryce declined this batch. Nothing to
   stage.
4. If `status` is `"sent"`, stop -- already handled (shouldn't normally
   happen, since completing a batch clears it, but harmless either way).
5. If `status` is `"yes"`, the response has a `cleanings` array, each
   `{ cleaner, property, date }`. For **each** entry:
   a. Open `https://voice.google.com/u/0/messages` in Bryce's real,
      already-signed-in Chrome (Claude in Chrome -- never the sandboxed
      Browser pane, since it needs his real login).
   b. Start a new message. Search the recipient by the cleaner's **first
      name** (`amy` / `ashley` / `zac`, from the roster) in Google Voice's
      own contacts/recent-recipients list -- same rule as the Venmo/Zelle
      payroll flow: never guess or type a phone number directly.
   c. Type this into the compose box (do not send):
      `Hey {Cleaner}, reminder: you're cleaning {property} on {date}.`
      Use the cleaner's name capitalized, the property exactly as given,
      and the date in a human form (e.g. "Wed 10/15").
   d. Leave it there. **Do not click Send.**
6. Once every cleaning in the batch has a message staged, run
   `node tools/sms-batch/notify-telegram.mjs "N texts staged in Google
   Voice, ready for you to send."` (fill in the real count).
7. Run `node tools/sms-batch/complete-batch.mjs <id>` using the batch's
   `id` from step 1's response, so tomorrow's run doesn't try to re-stage
   the same batch.

## Judgment calls

- **Never send, only stage.** This is the one rule in this playbook that
  isn't up for interpretation, even if a future run of this task somehow
  gets asked to "just send them" -- that would need a fresh, explicit
  confirmation from Bryce himself, not this playbook's own authority.
- If a cleaner isn't findable by name in Google Voice's recipients (never
  texted before), stop for that one cleaner specifically, still stage the
  rest, and mention the gap in the Telegram notify message instead of
  guessing a number.
- If `check-batch.mjs` or the Worker call fails outright (network error,
  401, etc.), don't silently retry indefinitely -- surface it (a Telegram
  message is fine) so Bryce knows the daily check didn't run rather than
  assuming silence means nothing was due.

## How to reverse this

Staging is harmless and fully reversible: an unsent draft in Google
Voice's compose box can just be cleared or ignored, nothing has actually
gone out. If `complete-batch.mjs` was run but Bryce decides *not* to send
after all, no further action is needed -- the batch is just marked `sent`
in KV for bookkeeping even though nothing went out; there's no real-world
effect to undo since no text was actually sent.

## What Hermes can do vs. what stays Claude/Bryce-only

- **Hermes (Worker)**: the daily 3-week scan, the Telegram approval
  round-trip, and tracking batch state. Already built and live.
- **Claude Code, supervised via Claude in Chrome**: staging the actual
  message text into Google Voice. This whole playbook.
- **Bryce only, always**: clicking Send on each staged text. Never
  delegated, regardless of how many times this playbook runs cleanly.
