---
title: Cleaner payroll — tracking what's owed to 1099 contractors
tags: [systems, hermes, bookkeeper, payroll]
updated: 2026-09-26
---

# Cleaner payroll

Amy and Ashley are 1099 contractors, not W-2 employees, so this is not
payroll in the withholding/tax sense — there's no tax to withhold. What
this system does is track what each cleaner is owed for completed jobs
and let Bryce record a payment he already made. **It never moves money.**
Bryce still pays them himself via Venmo, Zelle (through Foothills Bank),
or Cash App — the apps-tile links on the dashboard for those are just
external bookmarks, not integrations.

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

## Phase 2 (not started): Deja sends the payment herself

Deferred until Phase 1 proves reliable, and it's a genuinely bigger lift
than a code change: **Venmo, Zelle, and Cash App have no public API for a
business to push money to an individual programmatically.** Zelle is a
bank-network feature (Foothills Bank's own online banking), not a
standalone service with a developer API. Before this can be built,
someone needs to research a real path — options worth checking:
- Wave's own bill-pay / vendor-payment features, if any exist beyond
  invoicing (Wave's public GraphQL API was already found to have no
  reporting capability — see [[wave-integration]] — so check what it
  *can* do for outgoing payments specifically, not assume).
- A bank ACH API (Foothills Bank or a fintech layered on top of it).
- Whether Zapier has anything usable here (it doesn't have a native
  Venmo/Zelle action for sending money, as far as investigated).

Don't build toward this without confirming a real, callable API exists —
"automate it" isn't possible with Bryce's current payment methods as-is.
