---
title: Zapier Overseer buildout
tags: [zapier-overseer, zapier]
started: 2026-09-22
updated: 2026-09-22
---

# Zapier Overseer buildout

## What this is

Give the Zapier Overseer agent real functionality. Bryce wants this
prioritized ahead of the bookkeeping playbooks rollout, since cleaning
events flow through Zapier upstream of both the Scheduler and the
Bookkeeper's invoice automation — getting real visibility here first
makes the downstream work more trustworthy.

## What's done so far

Investigated the current state: **there is no real functionality yet.**
`zapier_overseer` in `DEFAULT_STATUS` (`src/index.js`) is a hardcoded stub
(`zapsWatched: 6, errors: 0`) that nothing ever updates. The one real
webhook that exists, `/webhooks/reservation` (`src/index.js:747`),
updates the **Scheduler's** status when a new booking comes in — it has
nothing to do with Zapier Overseer today.

Walked the real Zapier account directly (Bryce signed the browser in)
and documented both remaining Zaps in full — see [[zapier-automations]].
The first documentation pass badly undercounted the invoicing Zap's real
structure (missed paths off-screen); corrected within the same session —
see [[2026-09-22-zapier-review-missed-paths]] for that mistake and the
now-standing rule about fully scrolling a Zap's canvas before concluding
something doesn't exist.

Corrected findings:

- The invoicing Zap actually has 7 lettered paths (A–G, F deleted).
  Paths A/B/C consistently create a Wave invoice when that specific
  property's reservation is cancelled — almost certainly a cancellation
  fee, not backwards logic as first guessed.
- **Path D was genuinely dead code** (impossible AND conditions across
  all three properties) — Bryce confirmed he didn't know what it was for
  and asked it be removed. **Done**, published as v3.
- **Paths A/B/C's "Find or Create Customer" steps could silently create a
  duplicate Wave customer** if the name/email search ever missed —
  confirmed live in the editor (the "Create Wave Customer if it doesn't
  exist yet?" checkbox was on for all three). Bryce was explicit
  (2026-09-24, while this same fix was being applied to the new Turno
  automation): every property's invoicing must find existing
  records and never create new ones. **Fixed and published as v4** —
  unchecked the create toggle on all three paths (Path A: QueensBay
  Unit #324, Path B: 206 Columbine Drive, Path C: 1795 Palo Verde
  Boulevard South), leaving Wave's default "stopped: halted" behavior on
  a miss instead of a silent create. Re-tested each step live afterward —
  all three still correctly find the real "Jacob Whitaker" customer
  (#97496415, created 2025-10-06, not a fresh duplicate). The invoice
  line items themselves were already safe — each `Create Invoice` step
  references a specific existing Wave product by name (not a
  find-or-create field), so no fix was needed there.
- **The invoice-deletion logic Bryce described does exist** (Path E: any
  cancelled reservation → Code-by-Zapier Python → find a DRAFT Wave
  invoice matching checkout date + property, delete it). It hardcodes
  the customer name to "Jacob Whitaker" rather than reading the parsed
  `user` field — Bryce confirmed every real reservation from this
  webhook is under that name, so this isn't currently a bug. **Whether
  this logic is actually working in practice is still unconfirmed** —
  Bryce asked for deletion to be "rebuilt" before this was found; unclear
  if he knew it existed and it's actually broken, or wasn't aware of it.
- Path G (fires on `reservation.changed`) has a second Code step using a
  hardcoded Wave customer ID — not fully read line-by-line yet.
- The disabled, incomplete "1328 Piper Dr" Zap is confirmed unused by
  Bryce. **Done** — moved to Zapier's trash (30-day recoverable).
- Stale Hospitable field-mapping warnings recur across Paths A, B, and C
  — not yet fixed.
- Bryce clarified "oversight" means Zapier Overseer should be able to
  **view and edit any part of Zapier** — full access, not just failure
  notifications. He also said Zapier holds no sensitive data; corrected —
  the cleartext API token from
  [[2026-09-22-zapier-wave-token-cleartext]] lives in the invoicing Zap's
  Code steps.

Stray auto-created editor drafts were cleaned up along the way (no real
edits in any of them).

Bryce confirmed he never got to properly test the deletion path — the Zap
was too tangled to test with confidence. Tested Path E's Code step
directly via Zapier's "Test step" against a real throwaway DRAFT invoice
created in Wave for this purpose (customer Jacob Whitaker, invoice date
2019-01-01, item description containing "1795 Palo Verde Boulevard
South" — deleted again after testing). Found two real, confirmed bugs:

1. **Wrong endpoint URL**: the code used `https://gql.waveapps.com/`,
   missing the required path. The working endpoint used elsewhere in this
   codebase (`waveGraphQL` in `src/index.js`) is
   `https://gql.waveapps.com/graphql/public`. Every run of this deletion
   logic has been hitting a 404 before ever reaching Wave's API — this
   fully explains why it never worked. **Confirmed via live test**: fixing
   just this one string took the error from a 404 to a real GraphQL
   validation error, proving the rest of the token/auth setup is fine.
2. **Wrong query shape**: the query calls a top-level `invoices(...)`
   field, but Wave's schema returned: `"Cannot query field \"invoices\"
   on type \"Query\"."` It needs to be nested under `businesses`, the
   same way `getWaveBusinessId` in `src/index.js` already successfully
   queries `{ businesses { edges { node { id name } } } }` — i.e.
   `businesses { edges { node { invoices(...) { ... } } } }`.

**Not yet applied**: attempted to make this second fix live in the
Zapier code editor, but repeated auto-indent/line-wrapping quirks in its
CodeMirror editor (magnified by the code-editing classifier intermittently
blocking individual keystrokes mid-sequence, appropriately cautious about
automated edits to production code) corrupted the in-progress edit twice.
Rather than risk leaving broken code live, the draft was discarded both
times — the Zap is currently back at clean v3 (endpoint still broken,
Path D removed). The exact fix is known and small; it just needs to be
applied more carefully (ideally via a real paste rather than simulated
keystrokes) — see "What's left" below for the literal replacement text.

## What's left

1. **Apply the two-line fix to Path E's Code step** (`Run Python`, in
   "Hospitable Reservations to Wave Invoices"):
   - Endpoint line: change `'https://gql.waveapps.com/'` to
     `'https://gql.waveapps.com/graphql/public'`.
   - Replace the `query = f'''...'''` block's `invoices(...)` query so it's
     nested three levels deeper — `businesses { edges { node {
     invoices(first: 100, filter: {customer: {name: "..."}}) { edges {
     node { id invoiceNumber status invoiceDate items { description } } }
     } } } }` — and update the parsing line right after
     `result = response.json()` from
     `invoices = result.get('data', {}).get('invoices', {}).get('edges', [])`
     to drill through `data.businesses.edges[0].node.invoices.edges`
     instead.
   - Re-test with a throwaway DRAFT Wave invoice (same recipe as above)
     before trusting it against real cancellations.
2. **Check whether Path G has the same two bugs** — it wasn't tested this
   session; only confirmed it uses a hardcoded Wave `customer_id` instead
   of a name lookup, which is a different (and probably safer) approach,
   but its endpoint/query shape is unverified.
3. Fix the stale Hospitable field mappings on Paths A, B, and C.
4. Design what "full view and edit" access for Hermes actually requires
   (Zapier's own API, an API key to store, real thought about
   scope/blast radius given the account already holds one live secret)
   before wiring anything into `src/index.js`.

## Blocked on

Applying and re-verifying the Path E fix (either by Claude Code in a
future session with a more careful editing approach, or by Bryce pasting
the corrected block directly), then the remaining items above.
