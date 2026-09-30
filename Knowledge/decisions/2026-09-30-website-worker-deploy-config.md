---
title: spotlesslhc.com is a Cloudflare Worker (static assets); deploy config added, and my .assetsignore mistake
tags: [website, cloudflare, decisions, mistakes]
date: 2026-09-30
---

# spotlesslhc.com deploy: it's a Worker, builds failed until a wrangler config existed

Updates [[2026-09-20-spotlesslhc-website-github-migration]], which assumed a
Cloudflare **Pages** project. The real setup, read from the Cloudflare
dashboard on 2026-09-30:

- `spotlesslhc-website` is a Cloudflare **Worker** serving static assets, with
  Workers Builds connected to `spotlesslhc/spotlesslhc-website`.
- Its three existing versions were all **manually deployed** on 2026-09-21; the
  active one (`a129c569`, 100% traffic) is the old ~350 KB page. No Git build
  had ever deployed anything.
- Every Git build failed in ~17 s with `Missing entry-point to Worker script
  or to assets directory`: the repo had no `wrangler.jsonc`. Branch builds run
  `npx wrangler versions upload` (preview version only, never production).

## Fix

Add `wrangler.jsonc` (`name: spotlesslhc-website`, `assets.directory: "./"`)
plus `.assetsignore` at the repo root. Added by Bryce through the GitHub web
editor (the PowerShell Claude session's permission classifier blocks commits
that add a wrangler config, and approval in chat does not lift that — don't
route around it). Once it is on `main`, **merging to `main` becomes the publish
step** for the live site.

## Mistake: my first `.assetsignore` uploaded the whole repo

I specified `wrangler.jsonc`, `.assetsignore`, `.gitignore`, `README.md` only.
With the repo root as the assets directory, wrangler read 55 files and uploaded
`/.git/...` and `/.wrangler/tmp/...` as public assets (seen in build log
#dd7512c0). The repo is public so nothing secret was exposed, and it was only a
preview version, but a production deploy would have served `/.git/` at
spotlesslhc.com. Fix: `.assetsignore` must also list `.git`, `.wrangler`,
`node_modules`. **Next time:** read the wrangler "Read N files" / upload list
in the first build log before calling a static-assets config done; better
still, put the site in a `public/` folder so the assets directory can't
include repo internals.

## Resolution and verified state (same day)

- Bryce added `.git`, `.wrangler`, `node_modules` to `.assetsignore` (commit
  `b037f29`). The next build's preview serves only `index.html` and
  `logo.webp`; `/.git/*`, `/wrangler.jsonc`, `/.assetsignore`, `/.wrangler/*`
  all return 404. Verified with curl against the preview URLs.
- **Pre-existing exposure:** the *live* site (version `a129c569`, created by an
  earlier Cloudflare build on `main`, auto-generated config with
  `assets.directory: "."`) already serves `/.git/HEAD`, `/.git/config`,
  `/.git/index`, `/.git/refs/heads/main`, `/.gitignore` and `/wrangler.jsonc`
  (HTTP 200). Checked: `.git/config` holds only the public repo URL, no
  credentials; the repo is public. Low severity, but it disappears once a
  version built from this config is deployed.
- Production settings (Cloudflare → Worker → Settings): production branch
  `main`, production deploy command `npx wrangler deploy`; non-production
  branch builds stay on on `npx wrangler versions upload` (preview only). So
  **merging to `main` deploys to spotlesslhc.com.** The live domain is served
  by this Worker (the exposed files came from it).
- Preview alias for the branch:
  `https://site-mobile-nav-honeypot-logos-spotlesslhc-website.spotlesscleaninglhc.workers.dev`
