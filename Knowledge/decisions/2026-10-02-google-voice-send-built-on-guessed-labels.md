---
title: Google Voice texting shipped on guessed page labels and took four rounds to fix
tags: [decisions, mistakes, google-voice, browserbase, scheduler]
date: 2026-10-02
---

# Google Voice texting shipped on guessed page labels and took four rounds to fix

## What happened

`text_cleaner` (Deja texting a cleaner from Bryce's Google Voice through a
Browserbase browser) was written without ever seeing Voice's page from the
cloud browser. The first approved texts to Amy failed or reported success
without sending. It took four fixes (#74-#78) to reach a send that works.
Each round was blocked on something only visible on screen:

- The Voice login had expired (the page landed on `workspace.google.com`).
- The Send control is an **icon-only paper plane** with no "Send" text, and my
  fallback matched any button containing "send" (it could click "Send new
  message").
- Typing the number into the new-message box doesn't create a recipient; the
  Send button stayed disabled. The old recipient check passed falsely because
  the suggestion dropdown also contained the digits.
- After searching, Voice showed a results page with "Message ..." and
  "Call ..." options and no "Send new message" button, so the fallbacks failed.

Early texts were also reported as "approved" when they hadn't gone out, which
hid the problem until `check_text_status` existed.

## Why

Browser automation against a page nobody had looked at, built from guessed
labels, with success judged by "no error thrown" instead of an observable
result.

## What to do differently

- For any browser-driven tool, ship the **diagnostics first**: step
  screenshots, a list of the controls actually on the page in every error, and
  a **dry run that sends nothing** (`test_voice_compose`). Build the real flow
  from what those show, not from guesses; ask Bryce for a screenshot of the real
  layout early.
- Define success as something observable (button enabled, box cleared, text
  visible in the thread), never "the click didn't error". Record unconfirmed
  results as failures.
- Never match a button by substring when a wrong click is harmful (Voice's
  results page has a "Call" option next to "Message").
- Verify who a message is going to (the thread header must show the number)
  before typing it.

The working method is documented in [[systems/cleaner-text-notifications]].
