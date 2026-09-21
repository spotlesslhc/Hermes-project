---
title: "Open loose end: Wave Client Secret may have been exposed"
tags: [decision, security, wave]
updated: 2026-09-21
---

# Open loose end: Wave Client Secret may have been exposed

**Status: unconfirmed — needs checking.**

## What happened

While setting up Wave's "hermes-bookkeeper" app page on 2026-09-21, the
app's Client Secret was visible on screen during setup. Bryce was advised
to reset it in Wave's dashboard as a precaution.

## Why it's lower-risk than it sounds

Nothing built in this project actually uses that Client Secret — the
Worker authenticates to Wave using the separately-stored `WAVE_API_TOKEN`
(see [[wave-integration]] and [[systems-overview]]), not this app's OAuth
Client Secret. So even if it leaked, it's not wired into anything live
here.

## What's still open

It is **not confirmed** whether Bryce actually went and reset the Client
Secret in Wave's dashboard. Next time this comes up: ask directly whether
that reset happened, and if not, flag it again — don't assume it's done
just because time has passed.
