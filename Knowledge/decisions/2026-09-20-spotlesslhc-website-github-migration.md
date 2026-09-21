---
title: spotlesslhc.com moved to GitHub-connected Cloudflare Pages
tags: [decision, systems, business]
updated: 2026-09-20
---

# spotlesslhc.com moved to GitHub-connected Cloudflare Pages

## What was decided

Move the spotlesslhc.com website off Cloudflare Pages' direct-upload mode
(files uploaded straight to Cloudflare, no repo behind them) and onto a
GitHub-connected Pages project — the same setup [[Hermes]] already uses.

## Why

Direct-upload sites have no version history and no repo to recover from if
something breaks or gets overwritten. A GitHub-connected project means every
change is a commit, changes can be reviewed before they go live, and the
site can be rebuilt from the repo if Cloudflare's project ever needs to be
recreated.

## What changed

- The site's one file, `index.html`, was pulled from
  `C:\Users\bryce\OneDrive\Desktop\Website` into a new git repo.
- That repo was pushed to a new public GitHub repo:
  [spotlesslhc/spotlesslhc-website](https://github.com/spotlesslhc/spotlesslhc-website),
  `main` branch.
- Cloudflare itself was **not** touched — no new Pages project, no DNS
  changes. That was intentional; see below.

## What's still manual (Bryce)

1. In the Cloudflare dashboard, create a new Pages project connected to the
   `spotlesslhc/spotlesslhc-website` GitHub repo (build output: the repo
   root, since it's a single static `index.html` with no build step).
2. Point the `spotlesslhc.com` custom domain at the new Pages project.
3. Retire the old direct-upload Pages project once the new one is confirmed
   live and serving the domain correctly.

This was left manual on purpose — creating a new Pages project and moving a
live custom domain isn't something to do unattended, and Bryce wanted to
watch that step happen rather than have it done automatically.

## What this touches

Doesn't change how [[Hermes]] itself runs. Relevant if/when the
[[Site Editor Agent]] is eventually built out, since that agent's whole job
will be publishing changes to this same website — having it live in a real
GitHub repo instead of direct-upload is what makes that possible at all.
