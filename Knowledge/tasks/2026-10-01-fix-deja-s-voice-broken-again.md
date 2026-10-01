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
