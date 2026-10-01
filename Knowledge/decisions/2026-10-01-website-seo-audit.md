---
title: spotlesslhc.com SEO / AEO / GEO audit (2026-10-01)
tags: [website, seo, aeo, geo, local-seo, audit]
updated: 2026-10-01
---

# spotlesslhc.com — SEO, AEO and GEO audit

Read-only audit of the live site, run 2026-10-01 following the
SEO-AEO-GEO Ultimate suite's method (`.claude/plugins/seo-aeo-geo/`):
evidence first, findings classed as **confirmed defect / supported
opportunity / experiment / unknown**, and **no blended score** (the suite
refuses one on purpose). Nothing on the site or in its repo was changed.
Related: [[spotlesslhc-website]], [[website-next-steps]],
[[google-business-profile]].

**Bottom line:** the page itself is technically excellent. The weak spots
are *reach* (one URL), *proof* (no reviews or photos yet), *consistency with
the Google profile*, and *measurement* (none). Two small hosting fixes are
quick wins.

## Scope and limits (read before trusting any finding)

- Audited: `https://spotlesslhc.com/` and its static assets, headers,
  `robots.txt`, `sitemap.xml`, JSON-LD, the reviews API, and a Chromium
  load test (mobile 390 px and desktop 1366 px).
- **No access** to Search Console, analytics, or the Google Business
  Profile this session. GBP facts below come from the vault note
  dated 2026-09-30, not a live look.
- Performance numbers are **lab** numbers from a datacenter with no
  throttling. They are not field data from real visitors.
- No competitor or keyword-demand data was collected, so nothing here
  claims a ranking, traffic, or call increase.
- The suite's formal `seo-findings.json` bundle and validator were **not**
  run, so this report is a provisional handoff, not a validated one.
- Raw captures were taken in the Claude Code container's scratch space and
  are not committed.

## Confirmed defects (fix first; small and low risk)

| # | Finding | Evidence | Fix | Owner |
|---|---|---|---|---|
| 1 | **Plain `http://` is served as a full page, not redirected to HTTPS.** Two URLs for the same page; visitors on HTTP get no encryption. | `curl -I http://spotlesslhc.com/` returned `200 OK`, zero redirects, on two separate requests. | Cloudflare dashboard: SSL/TLS → Edge Certificates → **Always Use HTTPS**. Verify with the same curl. Rollback: toggle off. | Bryce (Cloudflare) |
| 2 | **`www.spotlesslhc.com` does not resolve.** Anyone typing or linking `www.` gets an error. | No address record for `www` from this container's resolver; HTTP and HTTPS both failed. (Confirm with a public DNS lookup before acting.) | Add a proxied DNS record for `www` plus a redirect rule to `https://spotlesslhc.com`. | Bryce (Cloudflare) |

## Supported opportunities

| # | Finding | Evidence | Suggested next step |
|---|---|---|---|
| 3 | **The site is one URL.** Services, vacation-rental work, move-out cleaning and commercial all share one page, so each can't target its own local search. | `sitemap.xml` lists only `/`; headings show 3 service cards and no deeper pages. | Dedicated pages, starting with vacation-rental turnovers (your core work and the least developed card). Needs real content from Bryce. Avoid near-duplicate "doorway" pages per town. |
| 4 | **Thin structured data.** The business markup has name, phone, email, logo and city only. | JSON-LD `HouseCleaningService` has no `sameAs`, hours, `priceRange`, or service list. | Add Facebook/Instagram `sameAs`, services, and hours. **Hold the hours and name until finding 5 is decided**, so site and Google match exactly. |
| 5 | **Site and Google profile don't agree** (name and hours). | Vault note 2026-09-30: profile says "Spotless Cleaning Lake Havasu", hours 10-8; the site and logo say "Spotless Cleaning". The profile note lists this as an undecided item. | Decide the real-world name and hours, then make site, markup and profile match. A keyword in the profile name is a guideline risk (already flagged in the vault). |
| 6 | **No proof on the page.** No reviews, no work photos, no named owner or "about". | Reviews API returned `[]`; only two `<img>` tags, both the logo. | Collect genuine reviews from past customers (never invented), add real before/after photos with permission, add a short owner/about block. Only add `aggregateRating` markup once real reviews exist. |
| 7 | **No measurement.** | No analytics or tag scripts in the page; Search Console status unknown. | Verify Search Console and submit the sitemap; add Cloudflare Web Analytics (cookie-free); track quote submissions and phone taps. Take a baseline before changing anything so results are comparable. |
| 8 | **Sitemap has no `lastmod`, and `robots.txt` lists no sitemap.** | `robots.txt` is only Cloudflare's comment header, with no directives. | Low priority. Vault says no custom `robots.txt` by decision, so submit the sitemap in Search Console instead. |
| 9 | **Security headers absent.** | Response had no HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy` or frame protection. | Hygiene, not a ranking factor. Add via the Worker or a headers file. HSTS only after finding 1 is fixed. |

## Experiments and unknowns (don't treat as defects)

- **Title wording (experiment).** `Spotless Cleaning | Lake Havasu City, AZ`
  (40 chars) is brand-first. A version naming the services is worth trying,
  but only with Search Console data to compare against.
- **AEO / GEO.** The FAQ is good for answer extraction (7 questions with
  matching `FAQPage` markup), but the answers are short and generic
  ("across the Lake Havasu City area"). More concrete answers help both
  people and AI answers: what a standard vs deep clean includes, vacation
  rental turnaround, which areas you serve. Whether Google shows FAQ rich
  results for a site like this is **unknown**; check current Google docs
  before expecting one.
- **`llms.txt`: absent (404).** Optional. The suite itself notes Google
  ignores it for Search, so it is low value; only add it if someone will
  keep it current.
- **Tap-target size (unknown).** About 20 to 23 controls measured under
  44 px in the load test. Not yet checked which ones (some may be inline
  links, which are exempt); needs a manual look.
- **Mobile hero (minor polish).** The headline leaves "for" on its own line
  and the trust bullets are indented; neither affects function.

## What checked out (evidence, no action needed)

HTTPS with HTTP/2 and Brotli (about 14.5 KB over the wire); one `h1` and a
clean heading outline; canonical, `lang`, viewport, and Open Graph/Twitter
tags all present; favicon, apple-touch-icon and logo all return 200; fonts
self-hosted and preloaded; no third-party scripts (only the Formspree form
post); `/index.html` redirects to `/`; a bad URL returns a real 404; JSON-LD
parses as valid JSON; skip link, landmarks and image `alt` text present;
9 requests, none failing.
**Lab performance:** mobile LCP about 0.83 s, layout shift 0.000; desktop
LCP about 0.39 s, layout shift 0.004. The earlier 0.045 layout-shift worry
from the preview build does **not** reproduce on the live site.

## Suggested order

1. **This week (minutes each):** findings 1 and 2 (Cloudflare toggles);
   Search Console and analytics (finding 7).
2. **Decisions from Bryce:** business name and hours (5), then enrich the
   markup (4); start collecting real reviews and photos (6).
3. **Content projects:** vacation-rental page and richer FAQ answers (3, AEO
   note), once Bryce supplies real details.

Nothing above is an implementation approval. Any site change goes on a
branch and PR in `spotlesslhc/spotlesslhc-website`; Bryce merges.
