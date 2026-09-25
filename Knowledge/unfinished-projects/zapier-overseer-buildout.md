---
title: Zapier Overseer buildout
tags: [zapier-overseer, zapier]
started: 2026-09-22
updated: 2026-09-25
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

## 2026-09-25 session: fix fully drafted and verified, but blocked on applying it

Picked this up to apply the Path E fix. Read the *live* current code in
the Zapier editor directly (not just the description above) to confirm
it word-for-word before touching anything — see "Exact current Path E
code" and "Exact corrected replacement" below.

**A real bug was found in the fix as originally planned**, before
anything was pasted: the replacement parsing line written above,
`data.businesses.edges[0].node.invoices.edges`, would have "fixed" the
endpoint and query shape but still silently queried the wrong business.
`src/index.js` (`getWaveBusinessId`, ~line 734) has an explicit comment
that this Wave account has **two businesses** — "Personal" and "Spotless
Cleaning" — and that `edges[0]` silently grabs the empty "Personal" one;
that's exactly why `getWaveBusinessId` matches by
`name === "Spotless Cleaning"` instead of taking the first edge. Using
`edges[0]` in Path E would have meant the "fixed" code always queried
the empty business, always found zero invoices, and never deleted
anything — while still returning a normal success-shaped response, i.e.
exactly the "looks like an ordinary successful run" failure mode already
flagged below under "Run history". The corrected replacement matches by
business name instead, same pattern as `getWaveBusinessId`.

**Could not actually apply the fix.** Claude in Chrome, driving Bryce's
real Zapier session, opened the Zap, opened Path E's Code step, and read
the live code successfully (that's how the exact-code sections below got
verified). But every attempt to *edit* that code step's content — typing
a replacement after a mouse-selected range, and even `ctrl+z` to undo an
accidental corruption — was refused by Claude Code's own auto-mode
permission classifier with "Modify Shared Resources." This is a hard
block at the tool-permission layer, not a Zapier UI problem, and it
applies to this specific action (writing into that code editor) rather
than to reading it. See [[2026-09-25-zapier-code-edit-permission-block]]
for the full incident, including a real accidental corruption (caused by
an unrelated `key`-action mistake, not by this permission block) that
was cleanly recovered via the Versions panel with **zero live impact** —
the published v4 was never touched, and no stray drafts were left
behind.

**Path G checked (read-only) — has the same two bug classes as Path E**,
confirmed by reading its live code directly:
- Same endpoint bug: `wave_endpoint = 'https://gql.waveapps.com/'` (line
  14), missing `/graphql/public`.
- Same query-shape bug: its search step queries a top-level
  `invoices(first: 100, filter: {description: "{code}"})` (line 24),
  which doesn't exist in Wave's schema — same "Cannot query field
  invoices on type Query" error Path E hit.
- Difference from Path E: Path G already hardcodes both a
  `customer_id = '97496415'` *and* a `business_id =
  '022c8b78-3bbd-41cc-88e4-d7dfdce5632c'` (lines 11–12). The `business_id`
  doesn't appear to be used in the broken search query itself (that
  query has no business scoping at all, hardcoded or otherwise) — it's
  presumably consumed later in the invoice-creation step (Step 3,
  starting ~line 72), which wasn't read in full this session since it
  was out of scope (only asked to check the endpoint/query-shape bugs).
  Not fixed or tested — same live-editing block applies, and this was a
  read-only check per the original ask.

## What's left

1. **Apply the exact corrected code below to Path E's Code step**
   (`Run Python`, in "Hospitable Reservations to Wave Invoices") — fully
   drafted and verified against the live current code, just blocked on
   the permission issue above. Either Bryce pastes it directly, or a
   future session with different permissions (or explicit
   sign-off/config change from Bryce for this class of edit) applies it.
   Re-test with a throwaway DRAFT Wave invoice (same recipe as before —
   customer Jacob Whitaker, item description containing one of the three
   real property addresses) before trusting it against real
   cancellations.
2. **Apply the same two fixes to Path G's search step**, once its full
   Step 3 (invoice creation) has been read to confirm `business_id`'s
   role and the fix doesn't need to touch that part too. Not tested.
3. Fix the stale Hospitable field mappings on Paths A, B, and C.
4. Design what "full view and edit" access for Hermes actually requires
   (Zapier's own API, an API key to store, real thought about
   scope/blast radius given the account already holds one live secret)
   before wiring anything into `src/index.js`.

### Exact current Path E code (verified live, 2026-09-25, v4 — unchanged)

```python
import requests
import json
from datetime import datetime

# Get input data (already parsed from webhook)
check_out = input_data.get('check_out', '')
properties = input_data.get('properties', '')
user = input_data.get('user', '')
code = input_data.get('code', '')
status = input_data.get('status', '')
wave_api_token = input_data.get('wave_api_token', '')

# For cancelled bookings, extract date for invoice matching
# The webhook data is already parsed, so we can use it directly
customer_name = 'Jacob Whitaker'
checkout_date = check_out[:10] if check_out else ''  # Extract YYYY-MM-DD from ISO format
property_name = properties.split(',')[0].strip() if properties else ''  # Get first part of property string

if not wave_api_token:
    return {'success': False, 'error': 'Wave API token not provided.'}

if not checkout_date:
    return {'success': False, 'error': 'No checkout date found in webhook'}

if not property_name:
    return {'success': False, 'error': 'No property name found in webhook'}

if status.lower() != 'cancelled':
    return {'success': False, 'error': f'Booking status is {status}, not cancelled. Skipping deletion.'}

endpoint = 'https://gql.waveapps.com/'
headers = {
    'Authorization': f'Bearer {wave_api_token}',
    'Content-Type': 'application/json'
}

try:
    query = f'''
    query {{
      invoices(first: 100, filter: {{customer: {{name: "{customer_name}"}}}}) {{
        edges {{
          node {{
            id
            invoiceNumber
            status
            invoiceDate
            items {{
              description
            }}
          }}
        }}
      }}
    }}
    '''

    response = requests.post(endpoint, headers=headers, json={'query': query})
    response.raise_for_status()
    result = response.json()

    if 'errors' in result:
        return {'success': False, 'error': f'GraphQL error: {result["errors"][0]["message"]}'}

    matching_id = None
    matching_number = None

    invoices = result.get('data', {}).get('invoices', {}).get('edges', [])

    for edge in invoices:
        invoice = edge['node']
        if invoice['status'] != 'DRAFT':
            continue

        invoice_date = invoice.get('invoiceDate', '')
        if invoice_date != checkout_date:
            continue

        items_description = ' '.join([item.get('description', '') for item in invoice.get('items', [])])
        if property_name.lower() in items_description.lower():
            matching_id = invoice['id']
            matching_number = invoice.get('invoiceNumber', '')
            break

    if not matching_id:
        return {
            'success': False,
            'error': f'No matching DRAFT invoice found for {property_name} with date {checkout_date}'
        }

    mutation = f'''
    mutation {{
      invoiceDelete(input: {{id: "{matching_id}"}}) {{
        deletedId
        userErrors {{
          message
        }}
      }}
    }}
    '''

    delete_response = requests.post(endpoint, headers=headers, json={'query': mutation})
    delete_response.raise_for_status()
    delete_result = delete_response.json()

    if 'errors' in delete_result:
        return {'success': False, 'error': f'Delete error: {delete_result["errors"][0]["message"]}'}

    delete_data = delete_result.get('data', {}).get('invoiceDelete', {})
    user_errors = delete_data.get('userErrors', [])

    if user_errors:
        return {'success': False, 'error': f'Wave error: {user_errors[0]["message"]}'}

    deleted_id = delete_data.get('deletedId')

    if deleted_id:
        return {
            'success': True,
            'deleted_invoice_id': deleted_id,
            'invoice_number': matching_number,
            'property': property_name,
            'checkout_date': checkout_date,
            'message': f'Invoice {matching_number} deleted successfully'
        }
    else:
        return {'success': False, 'error': 'Deletion returned no ID'}

except requests.exceptions.RequestException as e:
    return {'success': False, 'error': f'Request error: {str(e)}'}
except Exception as e:
    return {'success': False, 'error': f'Error: {str(e)}'}
```

### Exact corrected replacement (drafted, NOT yet applied)

Only three things change from the code above: the `endpoint` line, the
`query = f'''...'''` block (collapsed to one line and nested under
`businesses`, per the browser-automation-notes.md guidance on avoiding
literal newlines in a pasted multi-line block), and the `invoices = ...`
parsing line (now matches the business by name first). Everything else
is identical.

```python
endpoint = 'https://gql.waveapps.com/graphql/public'
```

```python
    query = f'''query {{ businesses {{ edges {{ node {{ name invoices(first: 100, filter: {{customer: {{name: "{customer_name}"}}}}) {{ edges {{ node {{ id invoiceNumber status invoiceDate items {{ description }} }} }} }} }} }} }} }}'''
```

```python
    business_edges = result.get('data', {}).get('businesses', {}).get('edges', [])
    business_node = next((e['node'] for e in business_edges if e['node'].get('name') == 'Spotless Cleaning'), None)
    invoices = business_node.get('invoices', {}).get('edges', []) if business_node else []
```

## Blocked on

Getting the Path E fix actually applied — blocked on the permission
issue in [[2026-09-25-zapier-code-edit-permission-block]], not on
knowing what to change. Once applied and re-tested, pick up items 2–4
above.
