---
title: Voice and conversation — wake word, hands-free mode, and the real voice
tags: [systems, hermes, voice]
updated: 2026-09-21
---

# Voice and conversation — wake word, hands-free mode, and the real voice

Rebuilt 2026-09-21. This covers how talking to Deja by voice actually
works today, replacing the earlier one-shot "say Hey Deja, ask one thing,
done" flow.

## What Bryce asked for

- Give himself a couple extra seconds to talk before Deja starts
  responding (she was cutting him off).
- After saying "Hey Deja" once, keep the conversation going — no need to
  repeat the wake word for every follow-up — until he says "goodbye."
- A real voice instead of the browser's robotic built-in one.

## Continuous conversation mode

Saying "Hey Deja" now starts a standing conversation, not a single
exchange: after each reply, the mic reopens automatically without
needing the wake word again, until Bryce says "goodbye" (or "bye"), at
which point it falls back to wake-word-only listening. A manual click on
the mic button is still single-turn on purpose — only the wake word
starts a standing conversation.

There's a hard 3-minute safety cap on one standing conversation, armed
once when it starts and not reset by activity — insurance against the mic
staying open indefinitely if something goes wrong, not a "you paused too
long" timeout (that's handled separately, see below).

## The extra pause (silence tolerance)

The browser's SpeechRecognition API has no setting for "wait longer
before deciding I'm done talking." The fix is a resettable ~2.5 second
timer in the dashboard's own code: every time new speech comes in, the
timer resets; only real silence for that long ends the turn and sends it.

## Two real bugs found getting here (both fixed 2026-09-21)

1. **Mic went gray ~0.5s after clicking it.** Clicking the mic while the
   wake-word listener was active stopped that listener and immediately
   started capture with zero gap — capture grabbed a mic that hadn't
   actually released yet and errored out almost instantly. Fix: a 250ms
   handoff delay on manual clicks, matching the delay the wake-word path
   already had.
2. **Mic captured one word then stopped.** Chrome's SpeechRecognition
   ends its underlying session after any short pause **even with
   `continuous=true`** — that's real speech-engine behavior, not
   something continuous mode overrides. So the recognizer was ending
   Bryce's turn after his first pause between words, long before the
   2.5s silence timer ever got a chance to fire. Fix: the code now tells
   the difference between "we intentionally stopped it" (silence timer,
   manual click, safety cap) and "the engine cut itself off mid-sentence"
   — on the latter, it folds what was said so far and restarts capture
   within 50ms, invisibly to Bryce.

Both were verified with a logic-level simulation (mocked
SpeechRecognition + DOM) rather than live in a real browser, since this
sandbox's automated clicks can't grant microphone access — worth knowing
if something in this area needs debugging again later: a real live test
in an actual browser is the only way to fully confirm behavior here.

## The real voice (ElevenLabs)

`/api/speak` (`src/index.js`) proxies ElevenLabs' text-to-speech API
server-side, so the API key never reaches the browser. The dashboard's
`speak()` function tries this first and falls back to the browser's own
`speechSynthesis` if it's not configured or the request fails for any
reason — so voice replies never just break, they just sound robotic
instead of real when something's wrong.

**Current voice: Bella** (`hpp4J3VqNfWAUOO0d1Us`), picked and approved by
Bryce on 2026-09-21 after listening to a test clip. The `ELEVENLABS_API_KEY`
secret is bound in `wrangler.jsonc` (see [[systems-overview]]).

**Important thing learned while picking it:** a voice has to already be
in Bryce's ElevenLabs "My Voices" library to be usable through the API —
that's not a paid-plan restriction as it first appeared, it's specifically
that a voice never added to the account can't be called via API even with
billing set up correctly. The first placeholder voice tried (a generic
premade one never added to the account) failed with a
`payment_required` error; Bella, already in "My Voices," worked
immediately on the same account. So changing the voice later is simple:
add a candidate to "My Voices" in ElevenLabs, get its voice ID, swap the
`ELEVENLABS_VOICE_ID` constant near the top of `src/index.js`, test
against a branch preview before merging.
