---
title: Social media tracking — weekly Facebook/Instagram digest
tags: [systems, hermes, marketing, facebook, instagram, meta-api]
updated: 2026-09-28
---

# Social media tracking — weekly Facebook/Instagram digest

Built 2026-09-28. Full build history, rejected/open questions, and the
paid-ads phase 2 plan are in
[[unfinished-projects/social-media-ads-agent]] — this doc is just how the
organic-tracking piece works today.

## What exists

- **Facebook Page**: "Spotless Cleaning Lake Havasu City" (id
  `1347130178484829`) — logo, bio, category, and services (Residential /
  Commercial / Vacation Rental Cleaning) filled in.
- **Instagram**: `@spotless_havasu` (id `17841476769091300`), converted to
  a Business account and linked to the Page above.
- **Meta Developer App**: "Spotless Hermes Insights" (id
  `1022635747467889`) with `pages_show_list`, `pages_read_engagement`,
  `pages_read_user_content`, `read_insights`, `instagram_basic`,
  `instagram_manage_insights` permissions.
- Both assets live in the same Meta Business Portfolio (under Bryce's
  personal account) — they have to be, or Facebook's own Page↔Instagram
  connect flow silently fails (see "known gaps" below).

## What it does

Every Monday at 8:30am Phoenix (`runWeeklySocialDigest` in `src/index.js`,
cron `30 15 * * 1`), pulls follower/post counts for both accounts via the
Meta Graph API and sends Bryce a Telegram digest, e.g.:

```
📊 Weekly social snapshot
Facebook (Spotless Cleaning Lake Havasu City): 0 followers
Instagram (@spotless_havasu): 0 followers, 0 posts
```

Auth is a Page Access Token stored as the `META_PAGE_ACCESS_TOKEN` Worker
secret — Page tokens generated from a long-lived user token don't expire
on their own the way user tokens do.

## Known gaps

- **Only account-level counts so far** — no per-post "before/after clips
  outperformed talking-head" comparison yet, because both accounts
  started at 0 posts/followers. That needs real post history to exist
  first; revisit once Bryce is actually posting regularly.
- **TikTok isn't covered** — no practical read API for a personal/creator
  account without applying for TikTok's own business API.
- **Cloudflare Secrets Store CLI is unreliable for `secret create`** — it
  reported success twice without the secret ever appearing in `secret
  list`; only creating it through the Cloudflare dashboard UI
  (Storage & databases → Secrets Store) actually stuck. Use the dashboard
  for any future secret here, not `wrangler secrets-store secret create`.
- Not yet proven against a real Monday run with real data — the first
  live digest is still the true test that the metrics/permissions hold up
  over time (Page tokens can be revoked if the underlying user token is,
  e.g. by a password change).
