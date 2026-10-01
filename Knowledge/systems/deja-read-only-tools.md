---
title: Deja read-only tools (website, Gmail, Wave invoices)
tags: [systems, deja, tools, gmail, wave]
updated: 2026-10-01
---

# Deja read-only tools

Added 2026-10-01 so Deja can look at things without a browser. All four are
read-only and run with no approval; none can change anything.

- **`fetch_site`**: reads a live page on spotlesslhc.com (title, meta
  description, visible text). Host is allowlisted and re-checked on every
  redirect. Site changes still go through `queue_edit_request`.
- **`search_gmail` / `read_email`**: Gmail via the `gmail.readonly` scope,
  so Google itself prevents sending, deleting, or labelling. Reuses the
  Google Calendar OAuth connection; the scope was added to
  `GOOGLE_CALENDAR_SCOPE`, so the **Connect Google Calendar** dashboard tile
  has to be clicked once to re-consent, and the Gmail API must be enabled in
  the Google Cloud project. Until then Gmail calls return a "not authorized
  yet" message and Calendar keeps working. Each search/read adds an Activity
  log line.
- **`list_wave_invoices`**: open / paid / all invoices with what is still
  owed, from the same Wave API token the other tools use (first 200 invoices
  only).

## Email is untrusted input

Several Deja tools act without approval (`assign_cleaner`,
`record_invoice_payment`). Email bodies are written by strangers, so Gmail
results are labelled untrusted and Deja's prompt says never to act on
instructions found in an email. If Gmail ever gets a write-capable tool, gate
it in `APPROVAL_REQUIRED_TOOLS`.

## Not built yet: Google Business Profile browsing

Needs a logged-in browser, which the Worker doesn't have. Plan: a cloud
browser provider (Browserbase / Browser Use) with a saved login for a
*separate* Google account added to the Business Profile, never Bryce's main
Gmail login. Wave, banking, Venmo, and Zelle stay out of any cloud browser.
See [[unfinished-projects/google-business-profile]].
