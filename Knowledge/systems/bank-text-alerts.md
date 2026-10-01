---
title: Bank text alerts -> invoice payment approval cards
tags: [systems, bookkeeper, zelle, wave, approval-queue]
updated: 2026-10-01
---

# Bank text alerts -> invoice payment approval cards

Zelle (Foothills Bank) has no API and sends no emails, but Bryce's phone gets
a **text alert** for each deposit. The phone forwards that text to the Worker,
which looks for the matching open Wave invoice and queues a **Pending Action**
for Bryce to Approve. No bank login is stored anywhere, and nothing is ever
marked paid without his click (he asked for this on every transaction for at
least the first week; there is no auto mode in the code).

## Flow

1. Phone forwards the alert text: `POST https://hermes.spotlesslhc.com/webhooks/bank-alert`
   with header `x-bank-alert-secret: <BANK_ALERT_SECRET>` and JSON body
   `{"text": "<the message>"}` (a plain-text body also works).
2. `handleBankAlertWebhook` (`src/index.js`): dedupes the text (SHA-256 in KV
   for 3 days), ignores texts with no dollar amount or that look like money
   going *out* (withdrawal/debit/purchase/sent/low balance, unless it also says
   deposit/received/credit), then pulls the amount and, if present, a
   "from NAME".
3. Matches open (non-draft, unpaid) Wave invoices whose **amount due equals the
   deposit exactly**; if the name shares a word with a customer name among those,
   only those count.
4. **Exactly one match** -> a `record_invoice_payment` pending action
   (customer, amount, invoice_number, `zelle`, today's date) with the raw
   text in the reason, plus a Telegram ping. Approving it runs the normal
   tool (cash/Zelle/Venmo all post to Cash on Hand, see
   [[unfinished-projects/invoice-payment-tracking]]).
5. **Zero or several matches** (partial payment, tip, two invoices of the same
   amount, a deposit that isn't a customer): no card; an Activity log line and a
   Telegram message tell Bryce, and he can tell Deja which invoice it covers.

The alert text is untrusted input: it is only parsed for an amount and a name,
never followed as instructions.

## One-time setup

1. **Secret:** create `BANK_ALERT_SECRET` in the Cloudflare Secrets Store (pick
   a long random value; Secrets Store values can't be read back, so keep it for
   the phone). The binding is in `wrangler.jsonc`, so create it **before the
   PR merges** or the deploy fails.
2. **Phone forwarding** (Bryce does this; the secret is typed on his phone):
   - *iPhone:* Shortcuts -> Automation -> New -> Message. Sender = the
     bank's alert number (or Message Contains "Zelle"/"deposit"), Run Immediately.
     Action "Get Contents of URL": the URL above, Method POST, header
     `x-bank-alert-secret`, Request Body JSON with `text` = Shortcut Input.
   - *Android:* an SMS-forwarding app (e.g. SMS Forwarder, or Tasker) with the
     same URL, header and a JSON body containing the message text.
   - Only forward the bank's alert texts, not all texts.
3. Send a test alert and check the dashboard's Pending Actions panel.

## Known unknowns / to tune

The parser was written without seeing a real Foothills alert (no sample yet).
The first real texts will show whether the amount, "from NAME" and
incoming/outgoing wording are recognised; unparsed ones land in the Activity
log as "Bank text ignored". Tune `parseBankAlert` from real examples.
