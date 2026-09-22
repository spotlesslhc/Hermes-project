---
title: Floating orb — the "Float Deja on top" button
tags: [systems, hermes, voice]
updated: 2026-09-21
---

# Floating orb — the "Float Deja on top" button

Added 2026-09-21. Bryce wanted Deja's orb visible and lit up while he's
using other applications, not just while the dashboard tab is in front.

## What it actually is

A button next to the orb pops it into a real floating window using
Chrome/Edge's **Document Picture-in-Picture** API
(`documentPictureInPicture.requestWindow`) — not a browser extension, not
a separate app. That window stays visible on top of other applications as
long as Chrome itself keeps running in the background. Clicking the
button again (or closing that window) brings the orb back into the
dashboard page exactly where it was.

The orb already changes appearance on listening/speaking via
`window.dejaOrbSetState` (used by the voice code — see
[[voice-and-conversation]]), and that's the same DOM node that gets moved
into the floating window, so "lights up when we're communicating" came
for free — no separate wiring needed.

## What it can't do

- **Chrome-only.** Firefox and Safari don't support Document
  Picture-in-Picture; the button feature-detects and just hides itself
  there.
- **Needs Chrome to keep running.** This is not a standalone app — if
  Chrome is fully closed, the floating window closes with it. A true
  "works even with the browser closed" version would need an actual
  native Windows app, a much bigger separate project that was explicitly
  scoped out when this was discussed.
- **Needs one real click per browser session to open.** Browsers don't
  allow a page to pop a floating window open on its own, by design —
  there's no way around this.

## What actually talks/listens while floating

The wake-word listening and reply logic (see [[voice-and-conversation]])
already run independently of which tab is focused — that part isn't new.
This feature just gives that already-working background activity a
visible home instead of an invisible one, confirmed in practice
(2026-09-21): Bryce reported the orb and conversation working correctly
while tabbed into a different application entirely.

## Testing note

The actual "click it and a window pops open" step could not be verified
from this sandbox — Document Picture-in-Picture correctly requires real
user activation, and the sandbox's automated clicks don't carry enough
browser trust for that specific API (confirmed by testing
`requestWindow()` directly and getting the expected `NotAllowedError`).
Everything else — moving the orb node in/out, theme syncing, restoring
position on close — was verified with a mocked
`documentPictureInPicture` + DOM. If this needs debugging again, a live
click in a real browser is the only way to fully test the open/close
mechanics.
