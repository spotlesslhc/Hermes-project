---
title: Add tool to get Cleans calendar event invite links
requested: 2026-10-02T02:29:15.770Z
target: dashboard
status: pending
---

# Add tool to get Cleans calendar event invite links

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Bryce wants Deja to be able to text cleaners their Google Calendar invite links. Please add a read-only tool for Deja (e.g. get_clean_invite_links) that takes a cleaner's first name and a number of days (default 14) and returns, for each of that cleaner's upcoming cleans on the Cleans calendar: property, date, time, and the event's Google Calendar link (htmlLink). Deja would then paste them into a text with text_cleaner, which still needs Bryce's dashboard approval and has a 600 character limit, so she may split it into two texts. Bryce says none of the links or event descriptions contain anything sensitive. Context: Deja queued a standard schedule text for Amy (#946ec68f), which has no links because she currently can't read event URLs. Once the tool exists, Deja should be told about it in her system prompt tool list.
