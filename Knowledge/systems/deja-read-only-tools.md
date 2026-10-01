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

## `browse_google_business` (Browserbase) — built; tested logged-out, needs setup + signed-in test

Read-only look at the Google Business Profile through a Browserbase cloud
browser. No project id is used; the API key alone resolves the project.

- **How it works:** the Worker creates a Browserbase session over REST
  (`POST /v1/sessions`) with the saved Context, opens the returned `connectUrl`
  as an outbound WebSocket, and speaks raw CDP: navigate, wait for load, read
  `document.body.innerText`, release the session. It only navigates to
  `business.google.com` / `www.google.com` and only reads text -- no clicks or
  typing, so it cannot post, reply, or edit. (Browserbase's REST Fetch API
  has no Context parameter, so it can't see a logged-in page; the hosted
  Agent-run API would let an LLM click around, which is why it wasn't used.)
- **Secret:** `BROWSERBASE_API_KEY` in the Cloudflare Secrets Store (binding in
  `wrangler.jsonc`). **Create the secret before merging** or the deploy
  fails on the missing binding. The tool only appears for Deja once it's bound.
- **Account decision (2026-10-01):** Bryce chose to sign in with his *main*
  Google account instead of a separate manager account, so Deja can see
  everything that account can. Consequence: the saved Browserbase Context
  holds a full Google login (Gmail, Drive, etc., not just Business Profile).
  Mitigations in code: reads only navigate to business.google.com /
  www.google.com and never click or type. Keep Browserbase's own account
  secured (2FA), rotate the API key if it's ever exposed, and revoke the
  session from myaccount.google.com/device-activity if needed.
- **One-time sign-in:** Bryce opens `/api/browserbase/login` (behind Access),
  which makes the Context on first use, opens a blank session with `persist: true`, and redirects him to
  Browserbase's live view (no CDP connection: on the free plan a disconnect
  ends the session, which is what made the first version say "session ended").
  He types business.google.com into the live view's address bar, then types
  the login for his Google account himself (credentials never pass
  through the Worker), then opens `/api/browserbase/login/done`, which ends the
  session; ending it is what saves the cookies. Context id lives in KV key
  `browserbase_gbp_context_id`.
- **Reads use `persist: false`** so they never overwrite the saved login.
- **If Google challenges the login:** the free plan has no proxies or CAPTCHA
  solving, so a sign-in from a datacenter IP may get a challenge. If a read
  lands on accounts.google.com the tool says the login expired/was challenged.
- **Untrusted content:** reviews and Q&A are strangers' text; results carry an
  untrusted-page note like the Gmail tools. Any future write tool (post,
  reply, edit) must go in `APPROVAL_REQUIRED_TOOLS`.
- **Tested 2026-10-01** (local workerd, traffic relayed because the session
  sandbox blocks workerd's direct egress): Context create, session create with
  a Context, raw-CDP WebSocket, navigate, text read, host allowlist rejection,
  logged-out detection (lands on accounts.google.com), and session release
  all work; no sessions left running. **Not yet tested:** the signed-in path
  and whether Google challenges the login, and workerd connecting to
  Browserbase directly (the production path).
- Only Google Business belongs in this Browserbase account. Wave, banking,
  Venmo, and Zelle logins stay out of any cloud browser.

See [[unfinished-projects/google-business-profile]].
