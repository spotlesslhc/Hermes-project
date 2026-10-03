---
title: spotlesslhc.com — how the site is built and deployed
tags: [systems, website, cloudflare]
updated: 2026-09-30
---

# spotlesslhc.com

Repo `spotlesslhc/spotlesslhc-website` (public). Separate from this repo's
Worker. Deploy history and the `.assetsignore` mistake:
[[2026-09-30-website-worker-deploy-config]]. Open work:
[[website-next-steps]].

## Shape
- One static `index.html` (no build step) + `logo.webp`, `fonts/` (self-hosted
  WOFF2, OFL), favicons, `og-image.jpg`, `sitemap.xml`. No `robots.txt` on
  purpose (Cloudflare's managed one).
- Cloudflare **Worker with static assets**, `wrangler.jsonc` at the repo root,
  assets dir `./` (see `.assetsignore`). **Merging to `main` publishes.**
  Branch pushes only make previews at
  `https://<branch>-spotlesslhc-website.spotlesscleaninglhc.workers.dev`
  (`noindex`, so preview Lighthouse SEO reads ~69).
- `index.html` is **CRLF**; scripted edits must match on `\r\n`.

## Quote form
Two pages (changed 2026-10-02, website PR #7): page 1 is one form with
everything (details, space, add-ons, notes) and a single "Submit and get quote"
button; page 2 is the quote, with a "Back - change my answers" button that
returns to the form with answers kept. Price shown only after submit, posts to
Formspree (`xppanjew`, honeypot `_gotcha`). Resubmitting after Back sends an
`UPDATED quote request` (Bryce accepted multiple emails). It used to be a
3-step wizard with Next/Back. Pricing table lives in the page's inline JS
(`PRICING`).

## Reviews (Worker + KV)
- `worker.js` handles `/api/reviews*`, everything else goes to assets
  (`run_worker_first: ["/api/*"]`). KV binding `REVIEWS`, key `list`
  (newest first, max 200).
- `POST` publishes instantly: name, rating 1–5, text ≥10 chars, links rejected,
  `<>` stripped, honeypot field `website`, 3 posts/hour/IP, optional Turnstile
  when `TURNSTILE_SECRET` is set. `GET` lists.
- **Removing a review:** `DELETE /api/reviews/<id>` with
  `Authorization: Bearer <ADMIN_TOKEN>` (Worker secret). Only remove
  spam/abuse/non-customers, never honest negatives.
- "Review us on Google" button is driven by `GOOGLE_REVIEW_URL` in
  `index.html` (hidden while empty).

## Testing tips (Windows)
- Local Worker: copy the site to a temp dir and run
  `npx wrangler dev --local --persist-to <tmp>`; running it inside the repo
  loops on its own `.wrangler` folder.
- Browser checks: `puppeteer-core` with Chrome's path, mocking Formspree
  (answer the CORS preflight) so no real lead is emailed.
- Buttons with `hidden` need an explicit CSS rule: `.btn` sets `display` and
  overrides the attribute (bit us twice).
