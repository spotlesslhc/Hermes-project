---
title: Browser automation notes — Zapier, Wave, Google Calendar
tags: [agent-notes, zapier, wave, google-calendar, browser-automation]
updated: 2026-09-23
---

# Browser automation notes — Zapier, Wave, Google Calendar

Lessons from driving these tools live via browser automation on
2026-09-22/23 (see [[2026-09-22-zapier-review-missed-paths]] and the
Path D/E and Scheduler work in [[unfinished-projects/zapier-overseer-buildout]]
and [[systems/scheduler]]). Written up so the next session doesn't
rediscover these the slow way.

## Zapier's editor

- **The read-only Zap canvas view under-renders.** It only shows what's
  scrolled into view, and can genuinely hide entire paths that exist
  further left/right — not a collapse, they're just off-screen. Always
  open the real **"Edit Zap"** editor and scroll the full canvas in every
  direction before concluding a path or step doesn't exist. This is what
  caused a real, corrected mistake — see
  [[2026-09-22-zapier-review-missed-paths]].
- **A text field's Home/End keys operate per *visual* line, not per
  *logical* line**, once a field's content wraps across multiple
  displayed rows (e.g. a long Search Term expression). Pressing `End`
  only reaches the end of the current wrapped row, not the whole value —
  this silently truncates selections and caused several failed edits
  before the pattern was recognized. To select a whole wrapped field
  reliably: click inside it, `Home`, then `shift+Down` enough times to
  cover every wrapped row, then `shift+End`.
- **Typing multi-line content (with literal Enter keypresses) into the
  Code-by-Zapier Python editor triggers cascading auto-indent** that
  compounds with each newline and corrupts the code. GraphQL and JSON
  don't care about whitespace/newlines, so when inserting or replacing a
  multi-line block (like a GraphQL query string), write it as **one
  continuous line with no literal newlines** instead — much more
  reliable than trying to reproduce nice formatting.
- If an edit gets tangled and hard to reason about, **don't try to
  manually un-corrupt it** — open the Versions panel and delete the
  draft. The last *published* version is untouched regardless of how
  messy the draft got, so discarding and starting the specific edit over
  is faster and safer than debugging scrambled whitespace.
- Zapier auto-creates a "draft based on vN" the moment you open a Zap's
  editor, even just to look around — clean these up afterward (Versions
  panel → trash icon) if no real change was intended, so stray drafts
  don't pile up in the account.
- A trigger step needs **real sample data** before its fields can be
  properly mapped by clicking a chip (rather than guessing at raw
  reference syntax). If "Skip test" was used earlier, go back and
  re-test the trigger once real data exists — "Find new records" picks
  up anything sent to the webhook URL since the last check.
- Formula functions in the field-mapping panel (`Formulas` tab, e.g.
  `Text.extract_number()`) don't always evaluate as expected in every
  field context — one attempt to extract a street number this way
  silently failed to match. When a formula doesn't behave as expected,
  prefer doing the transformation **before** the data reaches Zapier
  (e.g. have the calling code send an already-clean field) over
  debugging the formula further.

## Testing webhooks safely, without a working curl/fetch path

The sandbox blocks several natural ways to POST test data to a webhook
from inside a session:
- `curl` with an `Authorization` header gets blocked as credential
  leakage risk, even for a non-sensitive test.
- `curl`/`fetch` POSTs to an external webhook can get blocked as a
  "real-world transaction," even when the payload is harmless test data.
- The in-browser `javascript_tool`'s `fetch()` is restricted from making
  arbitrary outbound requests (fails with "Failed to fetch" regardless of
  target, including from a neutral page).

**What reliably works**: ask the human to paste a GET-request URL (with
the test payload as query parameters) into their *own* browser and hit
enter. Zapier's Catch Hook (and similar webhook-catchers) parse GET query
params the same as a POST body. This sidesteps every sandbox restriction
since the human's browser — not the agent — makes the request, and it's
a 10-second ask each time real sample data is needed.

## Cloudflare KV, from this environment

- `wrangler kv key get`/`put` for a **single key** work fine and are
  low-risk (get is basically free quota-wise; a single put is a normal
  write).
- `wrangler kv key put` that **overwrites an entire list-shaped key**
  (e.g. a whole `reservations` array) gets blocked by the sandbox as a
  mass-write/delete risk, even when the key is currently empty. If a
  temporary test value is genuinely needed in a list-shaped key, prefer
  adding it through whatever *endpoint* normally appends to that list
  (e.g. the real `/webhooks/reservation` route) rather than overwriting
  the KV value directly — or ask the human to grant the specific
  permission if there's no such endpoint.
- Never use `wrangler kv key list` (or any `list()` call) to check
  state casually — it draws from a much smaller, separately-metered
  daily quota than reads. This is exactly what caused
  [[2026-09-22-kv-list-quota-exhaustion]]. Check specific known keys with
  `get` instead.

## Gmail settings (forwarding addresses)

- Gmail serves at least two different "Forwarding and POP/IMAP" settings
  layouts, and reloading the same URL doesn't reliably pick one — a
  compact layout with a plain `<input>` for the forwarding address, and a
  modal-based layout with a proper "Add a forwarding address" button.
  **Only the modal-based "Add a forwarding address" flow actually sends
  a verification email**; typing a brand-new address directly into the
  compact layout's field always fails with "Invalid forwarding address"
  even though visually it looks like a normal text box.
- Even when the modal-based flow is used correctly (address typed,
  Next/Continue clicked with the mouse, Google's identity
  re-verification completed), it **silently failed every time it was
  driven from this session's built-in browser pane** — the dialog just
  closed with no confirmation, no error, nothing sent. It only worked
  once the exact same steps were run through Claude in the user's real
  Chrome browser instead (see [[unfinished-projects/turno-property-zapier-buildout]]
  for the case this came up in). If a Gmail forwarding-address or
  filter-creation flow seems to silently fail in the built-in browser
  pane, hand it to Claude in Chrome rather than continuing to retry.
- Filter creation (Settings → Filters and Blocked Addresses → Create a
  new filter) can also silently no-op if the "Create filter" button
  click lands on the wrong DOM node (e.g. a `generic` element wrapping
  the real button rather than the button itself) — the modal closes but
  nothing is added to the filter list. Always verify by reloading
  Settings → Filters afterward and confirming the new rule is actually
  listed, don't assume the click worked.
- The verification email Google sends lands wherever the *destination*
  address's inbox is — for a Zapier Email Parser mailbox, that's its
  History page (`parser.zapier.com/mailboxes/<id>/history/`), not
  anywhere in the Gmail account being configured. The confirmation link
  in that email is safe to click directly (it only confirms the mailbox
  accepts forwards, no login involved).

## Google Calendar (Bryce's actual setup)

- Event **color is not a cleaner indicator** — Bryce uses it to flag
  same-day-checkin cleans (Basil) vs. not (Peacock). The real signal for
  "who's assigned" is the invited **attendee email** on the event.
- Calendar event titles don't necessarily match the address format used
  elsewhere (Hospitable/Zapier data) — e.g. "1795 Paloverde Blvd South"
  on the calendar vs. "1795 Palo Verde Boulevard South" in Hospitable's
  field. When matching an external record to a calendar event, match on
  something format-independent like the street number, not the full
  address string.
- For reading or creating Cleans events, the Google Calendar connector
  (on `spotlesscleaninglhc@gmail.com`) is far more reliable than the
  browser. Full event format rules are in [[scheduler]].

## Hospitable, Turno, Gmail accounts, GitHub forms (2026-09-25)

- "Claude co-work" is what Bryce calls Claude in Chrome (his real,
  signed-in Chrome).
- **Hospitable**: Bryce's login only has Home and Calendar (no
  reservations list). On the Calendar grid, clicking a reservation bar
  opens a side panel with dates. Clicking another bar while it's open
  often just closes it, so press Escape before each click. Horizontal
  scroll moves about 2 days per wheel tick and the view shows about 15
  days — step 7 ticks at a time or you'll skip dates. "Blocked" bars
  don't open a panel.
- **Turno** (`app.turno.com/cleaner/projects/view`): the date arrows page
  by month, and `get_page_text` lists every project for the month.
  Projects show only the clean date and time, not guest check-in.
- **Gmail**: `/mail/u/0` is the business account, `/mail/u/1` is
  Bryce's personal `bryce55777@gmail.com`, where the Sahara Hospitable
  emails arrive.
- **GitHub**: `form_input` works for filling the new-PR title and body,
  but the PR comment box ignored it (the comment never posted). The
  "Create pull request" button often needs a second, coordinate-based
  click after the first click just scrolls the page.
