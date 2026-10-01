---
title: Fix Deja's voice, broken again
requested: 2026-10-01T08:07:01.879Z
target: dashboard
status: pending
---

# Fix Deja's voice, broken again

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Bryce says Deja's voice isn't working correctly and needs to be fixed again. It has broken before, so check whether the earlier fix regressed. Bryce didn't give specifics on the symptom (no audio, wrong voice, cut off, etc.). Ask him what he's hearing at the start of the session, then diagnose.

## Progress (2026-10-01)

Bryce's symptom: Deja sounds like a robot — ElevenLabs was working before
and stopped. That means the dashboard is falling back to the browser voice.
The real cause couldn't be confirmed from the code alone (no access to the
live Worker or ElevenLabs account from the Claude Code session), so the
fallback now explains itself on screen and `/api/speak/status` reports the
cause; autoplay blocking (Safari/iPhone) is fixed directly. **Still pending:**
confirm the actual cause on the live dashboard once deployed, then fix it
(quota/plan/key/voice) and move this file to `done/`. See
[[voice-and-conversation]].

## Cause found (2026-10-01)

Bryce checked the on-screen note after PR #63 deployed: "ElevenLabs
character quota used up. This request exceeds your quota of 10000. You have
11 credits remaining, while 102 credits are required." So the voice isn't
broken — the plan's 10,000 monthly credits are spent (the current model
costs 1 credit per character, and Deja speaks every reply).

**Decision:** Bryce is waiting for the monthly reset rather than upgrading
for now. Deja stays on the robotic browser voice until then; check the reset
date at `/api/speak/status`. **Still open, if it recurs:** (a) upgrade the
ElevenLabs plan, (b) speak only the first couple of sentences of long
replies and skip links/lists, (c) try the cheaper Flash model (roughly half
the credits per character, slightly less rich). Move this file to `done/`
once the voice is back and Bryce has chosen how to avoid running out again.
