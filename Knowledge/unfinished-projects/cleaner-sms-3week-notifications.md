---
title: Cleaner text notifications — what's left
tags: [scheduler, google-calendar, sms, google-voice, telegram]
started: 2026-09-27
updated: 2026-09-28
status: PAUSED 2026-09-29 by Bryce — cleaners get calendar invite emails only; see Knowledge/systems/cleaner-text-notifications.md for how to resume
---

# Cleaner text notifications — what's left

The system itself (3-week reminders, cascade auto-invite, Telegram
approval, Google Voice staging) is built and documented as a real system
in [[systems/cleaner-text-notifications]] — read that first for how it
actually works. This file only tracks what's still open.

## What's left

1. **First real end-to-end proof.** Every piece has been tested
   individually (Access bypass via curl, webhook registration, a no-op
   scheduled-task dry run), but no real cleaning has yet gone through the
   full cycle: 3-week trigger → real Telegram approval → real staged text
   in Google Voice. Watch the first few live days closely.
2. **Zac has no email on file** — can't be cascade-assigned or texted
   until Bryce provides one.
3. **No response-timeout escalation** — the cascade only advances on an
   explicit decline, not on silence. Revisit if that turns out to matter
   in practice.

## Rejected along the way (context if this ever comes up again)

Twilio was considered and dropped (Bryce wanted to keep his real Google
Voice number). Deja logging into Google Voice herself was ruled out
(would mean storing Bryce's real Google credentials as a Worker secret,
plus likely blocked by Google's bot detection) — landed on Claude Code
driving Google Voice in Bryce's own signed-in browser instead, which is
what's built.

## Blocked on

Nothing active — waiting on real-world use (item 1) and Bryce's own
follow-through (items 2–3).
