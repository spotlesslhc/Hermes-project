---
title: Text cleaners their cleanings 3 weeks out (Google Voice)
tags: [scheduler, google-calendar, sms, google-voice]
started: 2026-09-27
updated: 2026-09-27
---

# Text cleaners their cleanings 3 weeks out (Google Voice)

## What this is

Bryce wants cleaners notified by text, not just by being added to the
Cleans calendar event — but only once a cleaning is within **3 weeks** of
its date. Cleanings further out than that shouldn't be surfaced to
cleaners at all yet. Applies to **all properties** (Sahara, Columbine,
Palo Verde, Unit 324, and Fremont/Bluegill once
[[fremont-bluegill-airbnb-automation|that's built]]), not just the two
new Airbnb properties that prompted the conversation.

Decisions made 2026-09-27 (via AskUserQuestion, then follow-up):
- **Scope**: all properties, not just Fremont/Bluegill.
- **Notification mode**: text is **in addition to** the existing Cleans
  calendar invite/attendee, not a replacement.
- **Channel**: **Twilio**, not Google Voice. Bryce initially wanted to
  keep his Google Voice number, but after discussing that Deja "logging
  in" to Google Voice would mean storing his real Google credentials as a
  Worker secret (a bigger exposure risk than an API key, and likely to
  get flagged/blocked by Google's automated-login detection anyway) and
  that only unmaintained reverse-engineered libraries exist for sending
  through it, he switched to Twilio — a real API, no credential-sharing,
  no reverse-engineering risk.

## Why not Google Voice (ruled out 2026-09-27)

Google has no official API for sending SMS through Google Voice, only
unmaintained community libraries (`node-google-voice`, `autogvoice`) that
scrape Google's internal web protocol. The alternative — giving Deja a
real browser session logged in as Bryce — would mean storing his actual
Google account credentials/session as a Worker secret, which both is a
bigger blast-radius secret than an API token (this project already had
one secret-exposure incident, see
[[decisions/2026-09-21-wave-client-secret-exposure]]) and would likely get
blocked by Google's bot detection on repeated automated sign-ins from a
datacenter IP anyway. Not worth it when Twilio does this natively.

## What's left

1. **Bryce signs up for Twilio and buys a phone number** — account
   creation and any payment method entry has to be done by Bryce himself,
   not automated. Once he has an Account SID, Auth Token, and a Twilio
   phone number, hand those to Claude Code to wire in as
   `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`
   secrets (same `secrets_store_secrets` pattern as everything else in
   `wrangler.jsonc`).
2. **Design the 3-week trigger.** Likely a scheduled check (reusing the
   existing Cloudflare Cron Trigger pattern from
   [[systems/payroll|the payroll reminder]]) that scans upcoming Cleans
   calendar events and fires a text the first time a cleaning crosses the
   3-week-out threshold — needs a way to avoid re-texting the same
   cleaning every time the cron runs (e.g. a KV flag per event once
   texted).
3. **Message content**: property, date, time, cleaner pay — same info
   already in the calendar event description, reformatted for a text.
4. **Sending mechanism itself**: once the library/approach is picked,
   this is a real "send a message on Bryce's behalf" action — per this
   project's safety rules, sending messages isn't something Claude/Hermes
   does unattended without an explicit approval step, so this likely
   needs to go through the approval queue
   ([[systems/approval-queue|APPROVAL_REQUIRED_TOOLS]]) like other
   real-world-effect tools, at least until proven reliable — same
   "build once supervised, document as a playbook, then wire in the
   mechanical piece" pattern as
   [[playbooks/README|the bookkeeping playbooks]].
5. **Test against a real upcoming cleaning** crossing the 3-week mark
   before trusting it for all cleaners.

## Blocked on

Bryce signing up for Twilio and getting a phone number + credentials
(item 1 above) — nothing else can be built or tested without them.
