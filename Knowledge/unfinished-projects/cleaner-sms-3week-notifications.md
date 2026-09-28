---
title: Text cleaners their cleanings 3 weeks out (Google Voice + Telegram approval)
tags: [scheduler, google-calendar, sms, google-voice, telegram]
started: 2026-09-27
updated: 2026-09-28
status: Live -- Access policy confirmed working, webhook registered, cascade auto-invite added; needs a real end-to-end test
---

# Text cleaners their cleanings 3 weeks out (Google Voice + Telegram approval)

## What this is

Bryce wants cleaners notified by text, not just by being added to the
Cleans calendar event — but only once a cleaning is within **3 weeks** of
its date. Cleanings further out shouldn't be surfaced to cleaners at all
yet. Applies to **all properties** (Sahara, Columbine, Palo Verde, Unit
324, and Fremont/Bluegill once
[[fremont-bluegill-airbnb-automation|that's built]]).

## Design history (2026-09-27) — landed on Google Voice + Telegram, not Twilio

Went through two pivots in one conversation:

1. **First considered Twilio** after ruling out Deja logging into Google
   Voice herself (would mean storing Bryce's real Google credentials as a
   Worker secret — bigger blast radius than an API key, and likely to get
   blocked by Google's bot detection on repeated automated sign-ins from a
   datacenter IP anyway; see
   [[decisions/2026-09-21-wave-client-secret-exposure]] for why this
   project is wary of that class of secret).
2. **Bryce chose to keep Google Voice after all**, but via a different
   mechanism than Deja logging in: a kept-online Claude Code session drives
   **Claude in Chrome inside Bryce's own already-signed-in browser**
   ("Claude cowork") to actually send the texts — no credential storage
   anywhere, since it's Bryce's real session, not an automated login.
3. **Approval via Telegram**, not just the dashboard, since Bryce can
   reach Telegram from anywhere. Bryce created a bot via @BotFather;
   `TELEGRAM_BOT_TOKEN` stored and confirmed active in the Secrets Store,
   `TELEGRAM_CHAT_ID` (2051302886, not secret) added as a plain var.

## The Cloudflare Access wrinkle (and how it got fixed)

First pass (PR `feature/cleaner-text-3week-telegram-approval`, merged)
deliberately shipped **without** an incoming `/webhooks/telegram` route:
the whole Worker sat behind a whole-worker Cloudflare Access app on the
bare `*.workers.dev` address, which has no path field — the same
constraint that already blocked the Turno webhook fix from being solved by
splitting Access per-path (see
[[decisions/2026-09-26-webhook-secret-auth]]). Telegram's webhook mechanism
can't attach a Cloudflare Access Service Token either, so a real webhook
there would've silently never arrived. That version instead had Claude
Code poll both `/api/sms-batch` and Telegram's own `getUpdates` API
directly.

**Bryce then confirmed he owns spotlesslhc.com**, and it's already a
Cloudflare-managed zone (the website already runs there on Pages — see
[[decisions/2026-09-20-spotlesslhc-website-github-migration]]), so no
DNS/nameserver migration was needed. Second PR
(`feature/hermes-subdomain-telegram-webhook`) added `hermes.spotlesslhc.com`
as a **Worker custom domain** — a dedicated subdomain rather than a path on
the main site, so it can't collide with the Pages-hosted website's own
routing. A custom domain uses Cloudflare Access's "Public Hostname"
destination type, which *does* support path-scoped policies, unlocking a
real `/webhooks/telegram` route (protected by its own `TELEGRAM_WEBHOOK_SECRET`
check, same shape as the other webhooks) once Bryce excludes `/webhooks/*`
from that hostname's Access policy.

**Left for Bryce specifically** (not delegated to an AI agent): the
Cloudflare Access policy change itself. Modifying a live security boundary
isn't something this project has an AI agent do — a misconfigured policy
could leave the whole Worker (real Wave/Calendar tokens, the API) exposed
with no auth. Everything else (the wrangler custom-domain route, the
webhook handler, the secret) was built and shipped in the PR.

## How the pieces fit together once both PRs are live

1. **Scheduler** (`runDailyCleanTextCheck`, daily cron) finds Cleans events
   newly inside the 3-week window and creates a pending approval batch.
2. It texts Bryce via Telegram with the batch and asks yes/no.
3. Bryce replies on Telegram from wherever he is.
4. `/webhooks/telegram` (on `hermes.spotlesslhc.com`) receives the reply
   and resolves the batch immediately in KV.
5. Claude Code (kept online) polls `GET /api/sms-batch`; once it sees
   `status: "yes"`, it drives Google Voice in Bryce's real signed-in
   Chrome via Claude in Chrome to actually send each cleaner their text,
   then calls `POST /api/sms-batch/complete` to close it out.

## Extended to cover unassigned cleanings too (2026-09-28)

Bryce noticed cleanings past Oct 4 existed on the calendar but had no
cleaner invited at all yet -- so the daily check now does two things
instead of one (see `getCascadeForCleaning` and the rewritten
`runDailyCleanTextCheck` in `src/index.js`, and the playbook at
[[playbooks/2026-09-27-cleaner-text-3week-google-voice]]):

- **Already-assigned cleaning** (unchanged): one-time reminder text at 3
  weeks out, `kind: "reminder"`.
- **Unassigned cleaning**: at 3 weeks out, the Worker itself picks the
  next untried, unbusy candidate from that property's cascade and adds
  them as a real calendar attendee (`inviteCleanerToEvent`, same
  mechanism as `assign_cleaner` -- happens immediately, doesn't wait on
  Telegram approval, since it's the same low-risk/reversible action). The
  text (which *does* wait on Telegram approval, same as a reminder) is
  `kind: "invite"` and includes an `eventLink` so the cleaner can accept
  straight from the text.

**Confirmed cascade order** (2026-09-28): Amy first for Sahara, Columbine,
Palo Verde, Unit 324, Arapaho, and Unit 303; Ashley first for Fremont and
Bluegill. **Piper is excluded entirely** -- Bryce confirmed that property
isn't cleaned anymore, so leftover calendar events for it are skipped
rather than auto-assigned (worth telling Bryce those Piper events on the
calendar through December are stale and could be deleted, next time
that's convenient).

Note this cascade is independent of `TURNO_CLEANER_CASCADE` (the
existing, separate real-time assignment logic for new Sahara/Turno
reservations) -- confirmed with Bryce that one stays Amy-first too, so
both are consistent, but they're still two different code paths that
happen to agree right now rather than one shared source of truth.

If nobody in a property's cascade is available (all busy or already
declined), or a cleaning's property doesn't match any known cascade,
Bryce gets an immediate one-time Telegram alert (`alertOnceForEvent`) --
not folded into the daily batch, since it needs his attention regardless
of the yes/no approval flow.

## What's left

All the infrastructure is built and confirmed working piece by piece
(Access bypass tested with curl, webhook registered and receiving
`pending_update_count: 0`, sms-batch scripts tested live, a dry run of the
scheduled task correctly did nothing when there was no pending batch).
What's **not yet confirmed**: a real end-to-end run where an actual
cleaning crosses the 3-week mark (or is genuinely unassigned), a real
Telegram approval round-trip happens, and Claude Code actually stages a
real text in Google Voice. Worth watching the first few real days closely
rather than assuming it's fully proven.

Also still true from the original design:
- **Zac** isn't in the cleaner roster (no email on file) — he can't be
  cascade-assigned or texted until that's added.
- No timeout/escalation if an invited cleaner just never responds
  (neither accepts nor declines) — the cascade only advances on an
  explicit decline. Worth revisiting if that turns out to happen in
  practice.

## Also surfaced, tracked separately

While building the first PR, found that `requireZapierWebhookSecret`
(`src/index.js`) compares `env.ZAPIER_WEBHOOK_SECRET` directly instead of
calling `.get()` on it like every other secrets-store binding in this
file — possibly means `/webhooks/reservation` and the Turno webhook have
been silently rejecting every real call despite passing Cloudflare
Access. Not yet verified or fixed (couldn't extract the live secret value
to test) — worth a dedicated look.

## Blocked on

Bryce doing the Cloudflare Access policy step (item 1 above) — nothing
past that point can be tested live until it's done.
