---
title: Cleaner payroll — tracking what's owed to 1099 contractors
tags: [systems, hermes, bookkeeper, payroll]
updated: 2026-09-26
---

# Cleaner payroll

Amy and Ashley are 1099 contractors, not W-2 employees, so this is not
payroll in the withholding/tax sense — there's no tax to withhold. What
this system does is track what each cleaner is owed for completed jobs
and get that payment ready to send. Bryce still clicks Send himself, in
Venmo or Zelle (through Foothills Bank) — **this never sends money on its
own**, and never will; see "Sending the payment" below for why that's a
hard line, not a caution that eases with more supervision.

## Phase 1 (built 2026-09-26): track and record

- **Owed is computed fresh, not stored.** For each cleaner, `getCleanerPayrollSummary`
  (`src/index.js`) reads the Cleans calendar for every *completed* event
  (start date in the past, not cancelled) where that cleaner is an
  attendee who **accepted** the invite, since their last-paid-through
  date. It pulls the dollar amount out of the event description's
  `Pay is $X` line (`parsePayFromDescription`) — the same line Bryce
  already writes on every job (see [[scheduler]]) — and sums it. No
  second source of truth to keep in sync.
- **Tracking starts 2026-09-26** (`PAYROLL_TRACKING_START`). Nothing
  before that date counts, on purpose — otherwise the very first lookup
  would claim months of jobs Bryce already paid by hand before this
  existed.
- **Recording a payment** (`recordCleanerPayment`) moves that cleaner's
  paid-through date forward and appends a permanent record — it never
  edits or deletes history. If the amount Bryce says he paid doesn't
  match the computed owed total, it's recorded anyway (he might round,
  or pay a different amount on purpose) but flagged in the response and
  the Activity log so he notices a real mismatch if there is one.
- **Two ways to use it:**
  - **Dashboard**: the "Cleaner Payroll" section shows each cleaner's
    owed amount and job count, with a "Mark as paid" button pre-filled
    with the owed amount (editable) — `GET /api/payroll`,
    `POST /api/payroll/pay`.
  - **Chat**: ask Deja "what do I owe Amy" (`get_cleaner_payroll` tool,
    read-only, no approval) or tell her "I paid Amy $480"
    (`record_cleaner_payment` tool, no approval — Bryce reporting his own
    action, same rationale as `record_monthly_finance`).
- KV keys: `payroll:paid_through:<cleaner>` (date), `payroll_payment:<uuid>`
  (one record per payment), `payroll_payment_index` (id list, same
  lazy-index pattern as the approval queue's `PENDING_INDEX_KEY` — see
  that comment in `src/index.js` for why a plain `list()` isn't used).

## Payment notes never include the full address

Bryce's rule (2026-09-26): some of his Venmo transactions are public, so a
payment note must never include a full address — street name and the
cleaning date(s) only, never the house number. `streetNameOnly` strips a
leading house number off the calendar event title
("2211 Sahara Drive" -> "Sahara Drive"; "Unit 324" is already safe and is
left as-is). `formatPayrollNote` builds one "Street Date" entry per
completed job, comma-joined, covering every house paid in that batch —
e.g. `"Sahara Drive 9/27, Columbine Drive 9/29"`. Both
`getCleanerPayrollSummary` (as `paymentNote`) and the dashboard's Cleaner
Payroll section (with a one-click Copy button) expose this, so it's ready
to paste into Venmo/Zelle's note field without Bryce composing it by hand.

## Phase 2 (built 2026-09-26): the weekly browser-assisted run

Bryce's actual request: Deja nudges weekly, and next time he brings
Claude Code online, it handles the browser side and he just confirms.

- A Cloudflare Cron Trigger (`triggers.crons` in `wrangler.jsonc`, Mondays
  8am `America/Phoenix`) runs `runWeeklyPayrollCheck`, which posts one
  Activity log line summarizing what's owed to each cleaner. That's all
  it does — no queue, no lock, no stored "pending run" state, because
  `owed` is already always computed live; there's nothing that could
  drift out of sync by not tracking it separately.
- See "Check for a pending cleaner payroll run at the start of every
  session" in `CLAUDE.md` for the actual session behavior: check
  `GET /api/payroll`, and if anyone's `owed > 0`, open Venmo (search by
  name — no handle is stored) or Zelle in Bryce's real Chrome, prefill
  the amount and `paymentNote`, and stop there.

### Sending the payment is never something Claude does

This is a hard rule, not a caution: **Claude never clicks Send on an
actual money transfer, in any session, no matter how many times it's
been approved before.** Prefilling the recipient, amount, and note is as
far as browser assistance goes — Bryce reviews and sends it himself every
time. Zelle additionally needs him to log into Foothills Bank manually;
there's no SSO shortcut for that step.

Once Bryce confirms he actually sent it, the session records it via
`record_cleaner_payment` (or he does it himself on the dashboard) — that's
what moves `owed` back toward zero and closes the loop.

## Possible future: a real payment API

If Bryce ever moves off Venmo/Zelle/Cash App to something with an actual
programmatic payment API (a processor, or his bank's own ACH API), the
final "click Send" step could eventually be removed — but that's a
distinct, bigger decision (new payment method, new approval gating in
`APPROVAL_REQUIRED_TOOLS` since it would newly touch real money
unattended) tracked separately in
[[unfinished-projects/cleaner-payroll-automation]]. Not needed for the
browser-assisted flow above, and not something to build toward without
Bryce explicitly choosing that path first.
