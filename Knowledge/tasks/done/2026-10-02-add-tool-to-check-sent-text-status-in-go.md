---
title: Add tool to check sent text status in Google Voice
requested: 2026-10-02T02:41:27.954Z
target: dashboard
status: pending
---

# Add tool to check sent text status in Google Voice

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Bryce approved Deja's two queued texts to Amy (#cca68574 and #04a291eb, invite links) but sees no sent texts in his Google Voice. Deja has no way to tell whether an approved text actually went out. Please add a read-only tool for Deja (e.g. check_text_status) that returns the real outcome of recent approved text actions (sent / failed / error message) and ideally reads the Google Voice conversation with a given cleaner via the cloud browser to confirm the message appears as sent. Also please look into why Amy's texts did not show up in Google Voice (possible causes: Voice login expired, browser step failing silently, wrong number). Amy's number is saved as 909-264-0249. Tell Deja about the new tool in her system prompt tool list.

## Resolved (2026-10-02)

Added `check_text_status` and failure diagnostics; see
[[cleaner-text-notifications]]. Root cause of Amy's missing texts still needs
`check_text_status` run live (the stored error for the two approvals).
