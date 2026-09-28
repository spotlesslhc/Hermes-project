---
title: Social media/ads agent — phase 1 live, phase 2 not started
tags: [marketing, facebook, instagram, meta-api]
started: 2026-09-27
updated: 2026-09-28
status: phase 1 (organic tracking) live; see Knowledge/systems/social-media-tracking.md for how it works
---

# Social media/ads agent — phase 1 live, phase 2 not started

Phase 1 (weekly Facebook/Instagram follower/post digest) is built and
documented in [[systems/social-media-tracking]] — read that first for how
it actually works. This file only tracks what's still open.

## What's left

1. **First real Monday digest** — deployed 2026-09-28, cron hasn't fired
   yet. Watch that it actually sends and the numbers look right.
2. **Post-level "what's working" comparison** — needs Bryce to actually be
   posting regularly first; both accounts started at 0 posts.
3. **TikTok** — no practical automated read access; would likely be
   manual/screenshot-reported if it becomes a real channel.

## Phase 2: paid ad spend auto-adjust (not started)

Bryce wants an agent that eventually shifts ad spend and creative toward
what's winning, approval-gated the same way payroll is
(`APPROVAL_REQUIRED_TOOLS`, [[systems/approval-queue]]). Blocked on Bryce
actually running paid Meta ads — nothing to adjust or learn from yet.
When that starts:
- Pull spend/performance via the Meta Marketing/Ads Insights API (a
  separate permission scope from phase 1's Page insights).
- Add an approval-gated tool that proposes a specific shift (e.g. "move
  $20/day from ad B to ad A") and only executes after Telegram approval.
- Unresolved: does "adjusting creative" mean swapping between videos
  Bryce already filmed, or generating new variants automatically? Ask
  Bryce when this phase actually starts, don't assume.

## Blocked on

Nothing active for phase 1 — waiting on real-world use (items 1-2).
Phase 2 is blocked on Bryce starting real paid ad spend.
