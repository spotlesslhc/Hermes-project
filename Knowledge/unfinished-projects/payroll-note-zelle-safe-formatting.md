---
title: Make payroll payment notes Zelle-safe automatically
tags: [payroll]
started: 2026-09-25
updated: 2026-09-25
---

# Make payroll payment notes Zelle-safe automatically

## What this is

`formatPayrollNote` (`src/index.js`) builds notes like "Sahara Drive
9/27, Columbine Drive 9/29" for both Venmo and Zelle. Discovered live
during the first real payroll run (2026-09-25): Foothills Bank's Zelle
note field rejects `/` outright ("This character is not allowed") and
caps notes at 140 characters. Venmo has no such restriction. Amy is paid
via Zelle; Ashley via Venmo — so today this had to be caught and
reformatted by hand (dates written as "9-27" instead of "9/27") while
staging her payment.

## What's left

Give `formatPayrollNote` (or a variant) a Zelle-safe mode — swap `/` for
`-` in dates — and have the session-start payroll check
(`CLAUDE.md`) use it automatically for whichever cleaner is being paid
via Zelle, rather than relying on Claude to notice and reformat live
each time. Also worth checking the 140-character cap doesn't get
exceeded on a week with many jobs for one cleaner; today's note landed
at exactly 140/140 with 7 jobs, so a busier week could overflow it and
needs a sensible truncation or summarization rule.

## Blocked on

Nothing — small, self-contained fix. Not urgent since today's workaround
(manual reformat) works, just adds a step each time.
