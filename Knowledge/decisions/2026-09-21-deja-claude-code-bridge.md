---
title: Hermes trusts messages relayed by Claude Code as Bryce's own
tags: [decision, systems, hermes, deja]
updated: 2026-09-21
---

# Hermes trusts messages relayed by Claude Code as Bryce's own

## What was decided

Built a direct bridge (see [[deja-bridge]]) letting Claude Code call
[[Deja]]/Hermes's `/api/ask` outside the dashboard, and extended
`HERMES_SYSTEM_PROMPT` so Hermes treats messages that identify themselves
as relayed by Claude Code as legitimately coming from Bryce — responding
and using tools (`propose_site_edit`, `record_monthly_finance`) the same
way she would if he'd typed it himself.

## Why

The bridge's transport (Cloudflare Access service token + `/api/ask`)
worked on the first try, but Hermes correctly refused to act on it — her
prompt only told her she talks to Bryce directly, so an unfamiliar caller
claiming to relay for him got no special trust, by design. Extending the
prompt was the deliberate fix, made after confirming with Bryce first
since it changes who effectively has authority to trigger her real tools
(PRs via Site Editor, recording financials via Bookkeeper).

## What this touches

- `src/index.js` — `HERMES_SYSTEM_PROMPT` now has a paragraph covering
  this. Deployed live 2026-09-21 (`npx wrangler deploy`, not yet via a
  GitHub-triggered redeploy — pushed directly to `main` after deploying).
- Anyone extending [[deja-bridge]] should know this trust extension exists:
  a message that just says it's "relaying for Bryce" is now enough for
  Hermes to act on, with no further verification. If that ever needs to be
  tightened (e.g. a shared passphrase, or scoping which tools the bridge
  can trigger), that's a future decision, not assumed here.
