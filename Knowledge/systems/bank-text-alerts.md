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
   `{"text": "<the message>", "sender": "<the number it came from>"}` (`sender`
   is optional; a plain-text body also works).
2. `handleBankAlertWebhook` (`src/index.js`) checks the secret (and, if
   `BANK_ALERT_SENDERS` is set, the sender), then `processBankAlert` decides what
   the text is. **Anything it is not sure about goes to a human, never to a guess:**
   - not clearly a deposit (no "received / deposited / credited / sent you") -> ignored, logged;
   - reads like both a deposit and a payment out -> a human;
   - several dollar figures and none next to the deposit word (a balance is
     usually in there too) -> a human; otherwise the amount next to the deposit
     word is used;
   - doesn't say "Zelle" -> a human (only Zelle deposits are matched here).
3. Matches open (non-draft, unpaid) Wave invoices whose **amount due equals the
   deposit exactly**, reading up to 1,000 invoices. **If the text names a sender,
   only invoices whose customer shares a word with that name count; a name that
   matches nobody is a "needs a human", not a fall-back to amount-only.** With
   no sender name in the text, a unique amount match is allowed and the card says
   so.
4. **Exactly one match** -> a `record_invoice_payment` pending action with the raw
   text in the reason, plus a Telegram ping. **At most one card per invoice**: a
   re-worded second alert for the same invoice makes no second card. The card
   also carries the amount due it was matched on; **at approval the invoice is
   re-read and the payment is refused if it is no longer open or the amount due
   changed** (paid in the meantime, reported in chat, edited).
5. **Zero or several matches**: no card; an Activity log line and a Telegram message
   tell Bryce, and he can tell Deja which invoice it covers.

**Retries.** A phone that resends the same text is recognised for 15 minutes, but
only *after* the first copy was fully handled: if Wave errors, the route answers
500, logs it, and the retry runs normally (an earlier version marked the text
"seen" first, so a failure meant the retry was dropped and the deposit was lost).
This is not a "same payment" rule: a second identical payment later is processed.

The alert text is untrusted input: it is only parsed for an amount and a name,
never followed as instructions.

## One-time setup

1. **Secret (must exist before this ships):** create `BANK_ALERT_SECRET` in the
   Cloudflare Secrets Store (Zero Trust is not involved: Workers & Pages ->
   Secrets Store -> the store `8f15d642...` -> Add secret). Pick a long random
   value; Secrets Store values can't be read back, so keep it for the phone. The
   binding is in `wrangler.jsonc`, so **a deploy fails (and keeps failing, for
   every later push too) until the secret exists**; the PR's build check shows
   red while it's missing.
2. **Optional but recommended: `BANK_ALERT_SENDERS`.** A plain variable (not a
   secret) in `wrangler.jsonc` under `vars`: a comma-separated list of the
   number(s) or short code(s) the bank's alerts come from, e.g. `"22000"`. When
   set, the phone must send a `sender` field and anything else is ignored and
   logged, so a random text containing the right words can't become a card. Leave
   it unset until you know the real sender.
3. **Phone forwarding** (Bryce does this; the secret is typed on his phone):
   - *iPhone:* Shortcuts -> Automation -> New -> Message. Sender = the
     bank's alert number (or Message Contains "Zelle"/"deposit"), Run Immediately.
     Action "Get Contents of URL": the URL above, Method POST, header
     `x-bank-alert-secret`, Request Body JSON with `text` = Shortcut Input.
   - *Android:* an SMS-forwarding app (e.g. SMS Forwarder, or Tasker) with the
     same URL, header and a JSON body containing the message text.
   - Only forward the bank's alert texts, not all texts.
4. Send a test alert and check the dashboard's Pending Actions panel.

## Known unknowns / to tune

The parser was written without seeing a real Foothills alert (no sample yet).
The first real texts will show whether the amount, "from NAME" and
incoming/outgoing wording are recognised; unparsed ones land in the Activity
log as "Bank text ignored". Tune `parseBankAlert` from real examples.
