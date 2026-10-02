---
title: Worker security hardening — findings from the 2026-10-02 audit
tags: [security, worker, unfinished]
started: 2026-10-02
updated: 2026-10-02
---

# Worker security hardening

A read-only security audit of `src/index.js` and the dashboard ran on
2026-10-02 (securitymaxxing `audit`). This repo is **public**, so the findings
are deliberately **not written here** until they are fixed: a list of open
holes is a roadmap for attackers. The full report lives privately with Bryce
and the Claude Code session that produced it. To regenerate it, run
`/securitymaxxing:audit` on `src/index.js` and ask for the report in chat.

## Where it stands (updated 2026-10-02)

The audit's code fixes are **merged and live** (PRs #81 to #86; what they do and
how to operate them: [[worker-security-controls]]). Cloudflare Access was
verified from outside: no gap on either address.

## What's left

1. **Access token check is log-only.** After a few quiet days (no "Access check
   (log-only)" entries in the Activity log), switch `CF_ACCESS_MODE` to
   `"enforce"` in `wrangler.jsonc` via a PR (steps in [[worker-security-controls]]).
2. **Re-run the audit** (`/securitymaxxing:audit` on `src/index.js`) on the new
   `main` to confirm the findings are gone.
3. **Scope the GitHub token** the Worker uses to this repo only (manual, GitHub
   settings). Do **not** add branch protection on `main`: the Worker pushes
   task files there.
4. **Turn on GitHub secret scanning and push protection** (manual, repo settings).
5. **Rotate the leaked keys** (manual): the Browserbase API key and the website's
   `ADMIN_TOKEN` (see [[website-next-steps]]); the Zapier-stored Wave token is
   tracked in [[wave-credential-rotation]]. Keep new values out of chats.
6. **Delete the stray remote branch** `claude/fix-tool-call-history` on GitHub
   (Claude's delete was refused).
7. When all of the above is done, fold anything lasting into
   `Knowledge/systems/` and **delete this tracker** (see the README here).

Done since the last update: the older PRs #59 (Google Business edit guard),
#60 (`browse_web` limits) and #61 (Zelle alerts) were reworked and merged
2026-10-02.
