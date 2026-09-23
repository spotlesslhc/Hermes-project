---
title: Spotify playback control
tags: [systems, deja, spotify]
updated: 2026-09-23
---

# Spotify playback control

Deja can play, pause, skip, go back, and search-and-play a specific song on
Bryce's Spotify, via a `control_spotify` tool. This is a personal
convenience, not one of the four business roles (Zapier Overseer,
Scheduler, Bookkeeper, Site Editor) — it doesn't touch the business's data
or workflows at all.

## How it works

- One-time OAuth 2.0 Authorization Code flow: Bryce clicks the "Connect
  Spotify" tile on the dashboard, which hits `/api/spotify/login` and
  redirects to Spotify's consent screen. Approving it redirects back to
  `/api/spotify/callback`, which exchanges the auth code for an access
  token + refresh token and stores the refresh token in KV
  (`spotify_refresh_token`).
- Every real playback call mints a short-lived access token from that
  refresh token as needed (`getSpotifyAccessToken` in `src/index.js`),
  cached in KV (`spotify_access_token_cache`) until it's close to
  expiring. Bryce never has to re-authorize unless he revokes access on
  Spotify's own account settings.
- `control_spotify(action, query)` supports `play`, `pause`, `next`,
  `previous`, and `play_song` (searches Spotify and plays the first
  match). It acts on whatever device currently has Spotify open — there's
  no device picker. If nothing's active, Spotify's API returns 404 and
  Deja is told to say "open Spotify somewhere first" rather than retry.
- Requires Spotify **Premium** on the connected account — the Web API's
  playback-control endpoints (play/pause/skip) don't work on Free.

## Credentials

`SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` live in the same
Cloudflare Secrets Store as the other API keys (see `wrangler.jsonc`).
The Client ID isn't actually sensitive (Spotify's own docs treat it as
public — it's sent in the browser-visible authorize URL), but it's stored
alongside the secret for consistency with how every other credential in
this project is handled.

The redirect URI is hardcoded to
`https://hermes-project.spotlesscleaninglhc.workers.dev/api/spotify/callback`
and must exactly match one of the URIs registered on the Spotify
Developer app, or the OAuth exchange fails.

## What this doesn't do

- No device selection — always targets whatever's currently active.
- No playlist/queue management, volume control, or "what's playing"
  readback — just the five actions above. Easy to extend if Bryce wants
  more (Spotify's Web API covers all of it), but nothing beyond what was
  asked for got built.
- Not gated by `APPROVAL_REQUIRED_TOOLS` — playback actions are trivially
  reversible, so it runs immediately like `assign_cleaner` and
  `record_monthly_finance` do.
