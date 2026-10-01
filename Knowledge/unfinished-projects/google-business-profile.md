---
title: Google Business Profile — optimize the existing verified listing
tags: [marketing, google, local-seo]
started: 2026-09-30
updated: 2026-10-01
---

# Google Business Profile (GBP)

## What exists (found 2026-09-30, account spotlesscleaninglhc@gmail.com)

Two profiles, both named "Spotless Cleaning Lake Havasu", service-area
business (address hidden, "No location; deliveries and home services only"),
primary category "House cleaning service", phone (928) 228-5899:

- **Verified** — store code `03551801996051009497`. This is the real one.
- **Suspended** — store code `02751511392001757466`. A **duplicate** (same
  name/phone, hours 9 AM-9 PM instead of 10-8). "Not publicly visible ...
  doesn't follow the guidelines." **Do not create a third profile.**

Manage at https://business.google.com/locations (Manage profile opens the
panel inside Google Search).

## Done 2026-09-30 (all submitted; Google review ~10 min, verify they took)

On the verified profile: new description (614 chars, residential +
commercial + vacation rental, licensed & insured, locally owned, add-ons,
instant estimate, phone); website
`https://spotlesslhc.com/?utm_source=google&utm_medium=organic&utm_campaign=business_profile`;
social links (Facebook page id 1347130178484829, Instagram @spotless_havasu).
Website was previously **empty**.

## Decisions needed from Bryce (not done; don't guess)

1. **Business name.** Listed as "Spotless Cleaning Lake Havasu" but the real
   name (logo, site) is "Spotless Cleaning". Google requires the real-world
   name; a location keyword in the name is a guideline violation and a likely
   suspension cause. Changing it may trigger re-verification — confirm the
   legal/signage name first.
2. **Hours.** Verified profile says 10 AM-8 PM every day; the suspended one
   9-9. Wrong hours hurt calls/"open now". Need the true hours.
3. **Suspended duplicate:** remove it (irreversible) or appeal? Leaving a
   duplicate risks flagging the good one. Recommend remove after Bryce OKs.
4. **Service areas.** Only "Lake Havasu City" is set (up to 20 allowed, stay
   within ~2 h drive). Need which nearby towns he actually serves.
5. **Secondary categories.** Only one category. Adding commercial/office
   cleaning is recommended, but the category picker only accepts exact
   suggestions and "Commercial cleaning service" did not appear; find the
   real names by typing slowly in the UI (suggestion list needs key events).
6. **Photos** (logo, cover, team, before/after) and a **first post**. The
   Reel video is 33 s; GBP video posts max ~30 s (trim with ffmpeg) — needs
   Bryce's OK on people shown.
7. **Services list**, attributes ("Online estimates", "On-site services"),
   Q&A seeds, opening date, and a **review link** for the website/customers.

## Browserbase read access (2026-10-01, in progress)

`browse_google_business` is written (see [[systems/deja-read-only-tools]]) but
**tested locally logged-out only** (see the systems note). Left to do, in order:

1. Bryce adds the Browserbase key to the Cloudflare Secrets Store as
   `BROWSERBASE_API_KEY` (before merging the PR), then **rotates the key that
   was pasted in chat earlier** at browserbase.com/settings.
2. Merge, then Bryce opens `/api/browserbase/login`, signs in with the separate
   manager Google account (add it as a manager on the Business Profile first),
   and opens `/api/browserbase/login/done`. If Google blocks/challenges the
   login (free plan: no proxies/CAPTCHA solving), options are a paid plan with
   proxies, or doing the login from a trusted network via live view.
3. Confirm Deja can read the verified listing and check that the 2026-09-30
   changes (description, website, social links) actually took.

## Research notes (2026 sources in the session)

Primary category is the top local-pack factor; service-area businesses must
hide the address; name must match real-world name; reviews steady flow
(reply within 48 h); weekly posts help engagement, not rank directly;
keep name/phone/website identical to Facebook, Instagram, the site's
JSON-LD.

Related: [[systems/social-media-tracking]], [[2026-09-30-website-worker-deploy-config]].
