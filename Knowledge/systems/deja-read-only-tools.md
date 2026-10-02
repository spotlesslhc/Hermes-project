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
- **`edit_google_business` (write access, added 2026-10-01):** Bryce asked for
  Deja to be able to edit. It is in `APPROVAL_REQUIRED_TOOLS`, so it only runs
  after Bryce clicks Approve on the dashboard (never by chat/voice); the
  Pending Actions row shows `summary`, url and steps. Steps are only
  `click` (by visible text/aria-label), `type` (into a labelled field, replaces
  the contents) and `wait`; every step re-checks the host allowlist and aborts
  if the page leaves business.google.com / www.google.com or hits the login
  page. Clicks/typing matching delete / remove / transfer / ownership /
  permanently / deactivate / payment / billing / password are refused outright
  (Bryce does those himself); password fields are refused. Deja is told to
  read the current value first and put "from X to Y" in `summary` (that plus
  the step list in the Activity log is how an edit gets reversed), to act only
  on Bryce's own requests, and to verify afterwards with
  `browse_google_business`. `browse_google_business` also returns the page's
  links (allowlisted hosts, business.google.com first, max 25) so Deja can open
  edit pages by URL. Mechanics tested on a public Google page (type, click,
  wait, blocked step, missing control); **not yet tried on the real Business
  Profile** -- expect label-matching to need a round or two of adjustment.
- **Security review 2026-10-01 (hardening PR):** (1) reachable pages are now
  `business.google.com` plus `www.google.com/search` only (the saved login is
  Bryce's main account, so Maps timeline/history etc. are out); (2) the edit
  blocklist is broader (owner/manager/admin/invite/access/users/account/...)
  and is also checked against the control that *actually matched*, not just
  the text Deja asked for; (3) `/api/pending/decide` (Approve/Deny) refuses
  cross-site requests (Origin / Sec-Fetch-Site), and the Browserbase sign-in
  routes refuse cross-site subresource use -- a CSRF'd approval would bypass
  the whole approval queue. Verified: the approval gate itself is sound
  (`dispatchTool` has only two callers and the chat path checks
  `APPROVAL_REQUIRED_TOOLS` first). Known residual risks: the approval card
  shows the raw steps JSON, so read it; if `/login/done` is forgotten the
  live-view link stays usable until the 15-minute timeout; a stray sign-in
  session ended with `persist: true` could overwrite the saved login with a
  logged-out one (only costs a re-sign-in).
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

## `browse_web`: other sites, with no login (2026-10-02)

Bryce wants Deja to be able to look things up on other sites, including Google
searches, but only on his say-so. Opening more of Google in the **signed-in**
session was considered and rejected (that account is Bryce's main one, so Maps
history, account pages and redirectors are out of bounds); `browse_web` covers the
need instead because it uses a **separate Browserbase session with no saved
login**, so there is no personal data for a page to reach.

- Read-only (text and links). https public hostnames only: no IP addresses,
  single-label or internal names, ports, embedded credentials, or names that
  embed an IP (the nip.io style).
- **What runs without approval is deliberately tiny**, enforced in code in the
  chat loop (`browseWebNeedsNoApproval`), because the URL itself can carry data
  out: only the *front page* of a site Bryce named in his own message (an email
  address or part of a longer name doesn't count), or a Google search whose words
  appear in his message. Anything else (a path, a query, a link found on a page)
  waits on the dashboard with the exact URL on the card.
- Also gated after the conversation has read email or web content (see
  [[approval-queue]], taint gate), and capped at 3 pages per request.
- Where a page ends up after redirects is re-checked and nothing is read from a
  place `browse_web` wouldn't have opened. Links are limited to valid public
  URLs (15 max) and are untrusted.
- Residual: a page can run script in that logged-out session before the redirect
  check; there is nothing in it to steal.
