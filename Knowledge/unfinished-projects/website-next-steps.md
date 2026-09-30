---
title: spotlesslhc.com — open items and later projects
tags: [website, cloudflare, reviews, seo]
started: 2026-09-30
updated: 2026-09-30
---

# spotlesslhc.com: open items (saved for later)

Context: [[2026-09-30-website-worker-deploy-config]]. Repo
`spotlesslhc/spotlesslhc-website`; **merging to `main` publishes the live site**
(Worker, `npx wrangler deploy`). Site work goes on a branch + PR.

## Already live (merged 2026-09-30)

Mobile menu, honeypot, logo file (PR #1); self-hosted fonts, contrast,
favicon, OG/Twitter, JSON-LD, sitemap (PR #2); 3-step quote form with the price
shown only after submit plus a "Change add-ons" button that resubmits as an
UPDATED request (PR #3); FAQ + FAQPage JSON-LD (PR #4). Decided: **no
`robots.txt`** (Cloudflare's managed one stays).

## Status (2026-09-30, end of session)

- **Reviews** (branch `site-reviews`, `4f7d930`): built and tested; how it works
  is in [[spotlesslhc-website]]. The live site **already runs it** (promoted
  from the preview build), but the **PR is not merged, so `main` lacks
  `worker.js`**. Until merged, the next `main` deploy would remove the reviews
  API. Merge link:
  `https://github.com/spotlesslhc/spotlesslhc-website/compare/main...site-reviews?expand=1`
  (Bryce merges; Claude never merges).
- `ADMIN_TOKEN` is set and delete was verified live. The first value was not
  random ([[2026-09-30-admin-token-generator-mistake]]) and a second one was
  pasted into chat: **rotate once more**, keep it out of chats.
- Turnstile not added; recommended because reviews publish instantly.

## Later projects (need input, or set aside)

- **Facebook reviews** (set aside by Bryce): he sent
  `facebook.com/profile.php?id=61594968927651&sk=reviews`. The Google Business
  note lists page id `1347130178484829`; confirm which is right. Plan: a
  "Review us on Facebook" button (easy). Pulling FB reviews needs a Meta app
  and page token (separate project).
- **Google reviews**: need his Google review link (GBP, "Ask for reviews",
  see [[google-business-profile]]); auto-pull later via Places API in a Worker
  route (key server-side).
- **Photos / before-after**, **expanded service area**, **About blurb**: need
  real content from Bryce; don't invent.
- **CLS 0.045** on preview, cause unconfirmed. Tablet/desktop layouts
  unchecked; Bryce still to test the real quote submit.
- **Move the site into `public/`** so the assets dir can't expose repo
  internals; do when Bryce isn't editing `index.html`.
