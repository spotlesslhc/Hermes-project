---
title: Mobile Dashboard Setup
tags: [decision, systems, hermes, voice]
updated: 2026-09-23
---

# Mobile Dashboard Setup — making the dashboard and Talk to Deja work on iPhone

Bryce asked for the dashboard (and specifically the "Talk to Deja" chat —
see [[voice-and-conversation]]) to work correctly from his iPhone's
browser (Chrome, not Safari), with the desktop version left exactly as-is.
This note is the precise, reviewable record of what changed, why, and
exactly how to undo it if needed.

## Where the change lives right now

**Not deployed yet.** As of 2026-09-23 this is an open, unmerged pull
request — nothing below is live on the dashboard until Bryce merges it.

- Branch: `mobile-responsive-dashboard`
- Commit: `fa786f500e080d64c956fe3b8a0cf5e80dd43291`
- PR: [#19](https://github.com/spotlesslhc/Hermes-project/pull/19) — "Make
  the dashboard and Talk to Deja chat work on iPhone"
- Base: `main`
- Files touched: **`public/index.html` only** — no changes to
  `src/index.js`, `wrangler.jsonc`, or anything backend/Worker-side.

## How to reverse this, precisely

- **Before merging:** close PR #19 without merging, or delete the
  `mobile-responsive-dashboard` branch. Nothing on `main` or the live site
  is affected either way.
- **After merging:** `git revert fa786f500e080d64c956fe3b8a0cf5e80dd43291`
  on `main` and push — it's a single self-contained commit touching one
  file, so the revert is clean. There's also nothing stateful involved (no
  KV writes, no schema, no new secrets) — reversing it is purely a static
  file change that redeploys within about a minute, same as any other
  dashboard edit.

## Exactly what changed, and why

All of it is additions plus two one-line edits in `public/index.html`;
nothing was deleted. Every visual fix is scoped inside
`@media (max-width:600px)` so it cannot affect desktop rendering — verified
by screenshotting the dashboard at full desktop width before and after and
confirming pixel-identical output.

**1. Section headers stacking (CSS, `.section-head` rule, ~line 164)**
Added:
```css
@media (max-width:600px){
  .section-head{ flex-direction:column; align-items:flex-start; gap:4px; }
  .section-head-right{ width:100%; justify-content:space-between; }
}
```
Before this, "Talk to Deja," "Agents," "Pending Actions," and "Financial
Snapshot" headings and their hint text/buttons were fighting for space on
one row on a phone-width screen, wrapping into an overlapping, hard-to-read
mess. Confirmed visually in a local test before fixing.

**2. Ask Deja row wrapping (CSS, `.ask-who` rule, ~line 304)**
Changed:
```css
.ask-who{display:flex; align-items:center; gap:12px; margin-bottom:14px;}
```
to:
```css
.ask-who{display:flex; align-items:center; flex-wrap:wrap; row-gap:8px; gap:12px; margin-bottom:14px;}
```
Just adds `flex-wrap:wrap` (and a bit of row spacing) so the avatar, name,
"Speak replies," and "Listen for Hey Deja" controls can drop to a second
line instead of cramming onto one. `flex-wrap:wrap` only does anything when
content doesn't fit — on desktop's wider panel it never triggers, so
desktop is unaffected.

**3. Ask input not overflowing (CSS, `.ask-input` rule, ~line 337)**
Added `min-width:0;` to the existing `.ask-input` rule. Flex items default
to `min-width:auto`, which was letting the text input refuse to shrink
below its placeholder text's natural width and push the mic/Send buttons
out of the visible area on narrow screens. `min-width:0` is a standard,
purely corrective flexbox fix with no visual effect at wider widths.

**4. iOS auto-zoom and touch targets (CSS, new block after `.ask-input:focus-visible`, ~line 342)**
Added:
```css
@media (max-width:600px){
  .ask-input, .finance-entry input{ font-size:16px; }
  .mic-btn{ width:44px; height:44px; }
  .voice-toggle input{ width:16px; height:16px; }
}
```
iOS Safari/WebKit auto-zooms the whole page when you focus any text input
with a font size under 16px — this affects every browser on iPhone, not
just Safari (see below). The dashboard's inputs were 13.5px. This block
only changes font size and tap-target size below 600px width, so desktop
keeps its original 13.5px inputs.

**5. Voice input gracefully disabled where it can't work (JS, `setUpVoice`, ~line 944)**
Changed:
```js
if(!SpeechRecognitionAPI){
  micBtn.disabled = true;
  micBtn.title = "Voice input isn't supported in this browser - try Chrome";
  return;
}
```
to:
```js
if(!SpeechRecognitionAPI){
  micBtn.style.display = 'none';
  if(wakeToggle){
    const wakeLabel = wakeToggle.closest('label');
    if(wakeLabel) wakeLabel.style.display = 'none';
  }
  return;
}
```
**Why this exists — the one thing that can't be fixed with code:** Apple
requires every browser on iOS, including Chrome, to run on Apple's own
WebKit engine (this is an App Store policy, not a Google or Chrome
choice). WebKit has never implemented the Web Speech API's
`SpeechRecognition`, which is what the mic button and the "Hey Deja" wake
word (see [[voice-and-conversation]]) both depend on. So voice **input**
(tapping the mic, or saying "Hey Deja") cannot work in any browser on
Bryce's iPhone — not a bug, a platform restriction with no code
workaround. The old message ("try Chrome") was actively misleading on
iPhone, since Chrome-for-iOS is WebKit too and would hit the exact same
wall. Rather than leave a dead, confusing mic button, it and the "Listen
for Hey Deja" toggle now just hide themselves when the API isn't there.
**Typed chat and Deja's spoken replies are unaffected** — only tap/voice
*input* is impossible on iPhone.

**6. Unlocking spoken replies on iPhone (JS, new `unlockAudioForIOS` IIFE, ~line 899)**
Added a self-contained block that, on the very first tap anywhere on the
page, plays a silent `Audio` element and a silent (volume 0)
`SpeechSynthesisUtterance`:
```js
(function unlockAudioForIOS(){
  let unlocked = false;
  function unlock(){
    if(unlocked) return;
    unlocked = true;
    try{
      const silence = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
      silence.play().catch(() => {});
    }catch(e){}
    try{
      if('speechSynthesis' in window){
        const primer = new SpeechSynthesisUtterance('');
        primer.volume = 0;
        window.speechSynthesis.speak(primer);
      }
    }catch(e){}
  }
  document.addEventListener('touchstart', unlock, { once:true, passive:true });
  document.addEventListener('pointerdown', unlock, { once:true, passive:true });
})();
```
**Why:** iOS only allows audio/speech playback that traces back to a real,
synchronous tap. Deja's spoken replies (see [[voice-and-conversation]])
are triggered from inside an `async` `fetch` callback — by the time the
reply comes back and tries to play, iOS no longer sees it as connected to
the original tap, and blocks it. This was very likely silently breaking
"Speak replies" on iPhone even though it looks fine on desktop. The fix
primes both audio APIs on the page's first genuine tap so playback stays
unlocked for the rest of that session. It's a no-op on desktop (a
near-silent zero-length sound and an empty utterance).

## What was deliberately left alone

- The "Float Deja on top" button (see [[floating-orb]]) already
  feature-detects Document Picture-in-Picture and hides itself on browsers
  that don't support it — true on every iPhone browser already, no change
  needed.
- No change to `src/index.js` or any Worker/backend behavior.
- No change to how anything looks or behaves on desktop, by design and
  verified by screenshot comparison.

## What still needs a real device check

Automated testing can't grant microphone/audio permission or fully
reproduce iOS's WebKit engine quirks. Verified so far: local
`wrangler dev` session at iPhone width (390×844) via a test harness,
confirming the layout fixes render correctly and a chat round-trip works
with no console errors. **Not yet verified: actually opening it on
Bryce's iPhone in Chrome** — that's the real confirmation this note is
waiting on before it can be called fully done.

## A note on how this was built: a concurrent session in the same repo

While working on this, another Claude session (Bryce's Claude Desktop,
mid-way through the [[2026-09-23-build-turno-property-into-zapier-automat|Turno property Zapier build]])
was actively editing uncommitted changes in this same shared checkout, on
`feature/turno-property-automation`. To avoid mixing the two unrelated
changes together or clobbering either session's work:

1. Confirmed via the session-messaging tool that the other session was
   real and active, and got its confirmation before proceeding.
2. Used `git add -p` to stage only the mobile-responsiveness hunks in
   `public/index.html`, deliberately leaving its in-progress
   "Connect Calendar (Turno)" app tile addition untouched and unstaged.
3. Committed and pushed only the mobile-responsiveness hunks to a fresh
   branch off `main` (not off the Turno branch), then restored the shared
   working directory back to `feature/turno-property-automation` exactly
   as it was found, confirmed byte-for-byte identical.

No files were lost or overwritten. Worth remembering if two sessions ever
end up working in this checkout at the same time again.
