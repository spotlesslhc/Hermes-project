---
title: Social media/ads agent — organic tracking now, paid auto-adjust later
tags: [marketing, facebook, instagram, meta-api]
started: 2026-09-27
updated: 2026-09-27
status: blocked on Bryce creating a Meta Developer App; nothing built yet
---

# Social media/ads agent — organic tracking now, paid auto-adjust later

## What Bryce wants (end state)

An agent that tracks how ads/social posts perform and, over time,
automatically shifts ad spend and creative toward what's winning — but
only executes spend changes with his approval, same gate as payroll
(`APPROVAL_REQUIRED_TOOLS`, [[systems/approval-queue]]).

## Current reality: organic only, no paid ads running

There's no Meta Ads account with spend yet — Bryce's marketing today is
organic (Facebook local groups, his business page). That means "auto-
adjust ad spend" has literally nothing to adjust yet. Building that phase
now would be speculative — no data to learn from, no budget to shift.

## Phase 1 (buildable once set up): track organic performance

Pull post-level engagement (reach, likes, comments, video views) from the
Spotless Facebook Page and Instagram professional account via the Meta
Graph API, store it, and send Bryce a periodic Telegram digest — "before/
after clips outperformed talking-head 3:1 this week," same shape as the
existing payroll/cascade Telegram notices.

**Blocked on Bryce, one-time setup** (needs his own Facebook login, can't
be done by Claude):
1. Create a Meta for Developers app (developers.facebook.com) tied to the
   Spotless Facebook Page.
2. Confirm the Instagram account is a Professional/Business account
   linked to that Page (required for IG insights via the API at all).
3. Generate a long-lived Page Access Token with `pages_read_engagement`
   and `instagram_basic`/`instagram_manage_insights` permissions.
4. Hand that token to Claude Code to store as a Worker secret
   (`secrets_store_secrets`, same pattern as `WAVE_API_TOKEN` etc.).

Once that token exists, this is a normal build: a scheduled Claude Code
task or a Worker cron pulls Graph API insights, tags posts by type
(before/after, talking-head, time posted), and reports what's winning.

**TikTok gap**: no practical read API for a personal/creator account
without applying for TikTok's own business API — flag this to Bryce if
TikTok becomes a real channel; may end up being screenshot-reported
manually rather than automated.

## Phase 2 (not started, blocked on Phase 1 + real ad spend)

Once Bryce is actually running paid Meta ads:
- Pull spend + performance via the Meta Marketing/Ads Insights API
  (separate permission scope from Phase 1's Page insights).
- Add an approval-gated tool (same shape as `record_cleaner_payment`/
  payroll) that proposes a specific budget or creative shift — e.g.
  "shift $20/day from ad B to ad A, B is underperforming 3x" — and only
  executes after Bryce approves via Telegram, never automatically.
- Open design question not yet discussed with Bryce: does "adjusting
  creative" mean swapping between videos Bryce already filmed, or
  generating new video variants automatically (a much bigger, likely
  paid-tool-dependent build)? Don't assume — ask when this phase starts.

## Next concrete step

Ask Bryce if he wants to do the Meta Developer App setup now (Phase 1) or
hold until he's ready to also start paid ads (so both phases get wired up
together instead of twice).
