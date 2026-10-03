---
title: Amy's calendar invites never reached her — it wasn't the email address
tags: [decisions, scheduler, google-calendar, icloud]
date: 2026-10-02
---

# Amy's calendar invites never reached her — it wasn't the email address

## What happened

Amy couldn't see any cleans. Bryce asked to switch her email to
`Abyers402@icloud.com`. The roster already had `abyers402@icloud.com`: the
only difference was a capital A, and email addresses ignore case, so changing
it would have done nothing. Her events showed that address as "awaiting" and
her inbox was empty. She has no Google Calendar app and relies only on the
emails, so the real problem was that Google's invite emails weren't arriving
(iCloud filtering/junk), not the address.

## What to do differently

- Before changing an address, compare it to what's stored and check whether
  the difference is real (case, dots, aliases) and whether invites show
  "awaiting" on the event; that points at delivery, not the address.
- For cleaners who rely on email only, don't depend on Google invites alone.
  The working fix was `resend_cleaner_invites` plus texting the schedule and
  event links from Google Voice (see [[systems/cleaner-text-notifications]]).
- A Google event link may not open for someone with only an iCloud address, so
  texts should also say the property, day and time in plain words.
