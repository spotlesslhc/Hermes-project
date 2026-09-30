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

## In flight: customer reviews — branch `site-reviews`, commit `4f7d930`

Not merged, no PR opened (no `gh`). Compare link:
`https://github.com/spotlesslhc/spotlesslhc-website/compare/main...site-reviews?expand=1`

Built: reviews section + on-site review form that **publishes instantly**
(Bryce's decision), backed by `worker.js` + a KV binding `REVIEWS`
(`/api/reviews` GET/POST, DELETE with token). Protections: links rejected,
`<`/`>` stripped, min 10 chars, honeypot, 3 reviews/hour per IP, output escaped.
Tested locally only (wrangler dev), phone width. The Google button is hidden
until `GOOGLE_REVIEW_URL` is set in `index.html`.

Before merging:
1. **KV namespace.** `wrangler.jsonc` declares `kv_namespaces` without an id and
   relies on wrangler auto-provisioning. Unconfirmed. If the preview build fails,
   create the namespace (dashboard or `wrangler kv namespace create REVIEWS`)
   and put its id in `wrangler.jsonc`.
2. **`ADMIN_TOKEN` secret** on the Worker (Cloudflare settings) so a bad review
   can be removed: `DELETE /api/reviews/<id>` with `Authorization: Bearer <token>`.
3. **Turnstile** (free captcha) is strongly recommended for instant-publish:
   create a widget, set `TURNSTILE_SECRET`; the page still needs the widget
   added (Worker already checks it when the secret exists).
4. Check the preview build, then the tablet/desktop layout (only phone tested).

Policy notes: only delete spam/abuse/non-customers, never honest negative
reviews (consumer-protection rules on review suppression). Don't route only
happy customers to Google (Google review-gating rule). No `aggregateRating`
markup until real reviews exist.

## Later projects

- **Google reviews**: need Bryce's Google review link (GBP dashboard →
  "Ask for reviews", see [[google-business-profile]]) to show the button.
  Auto-pull of Google reviews later, once some exist: Places API key + a
  Worker route (key stays server-side).
- **Photos / before-after gallery**: needs photos from Bryce (check people in
  shots are OK).
- **Expanded service area section**: needs the real list of towns/neighborhoods
  served (same list feeds GBP service areas).
- **About blurb**: needs real facts (years in business, etc.). Don't invent.
- **CLS 0.045** on the preview: cause unconfirmed (font swap was the guess).
- **Tablet/desktop checks** of the 3-step form and FAQ; real Formspree submit
  not yet tested end to end by Bryce.
- **Move the site into `public/`** so the assets dir can't expose repo
  internals (see the deploy-config note). Do when Bryce isn't editing
  `index.html`.
