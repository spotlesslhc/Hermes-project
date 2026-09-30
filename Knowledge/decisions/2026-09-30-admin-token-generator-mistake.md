---
title: Mistake: the first ADMIN_TOKEN generator command was not random
tags: [website, security, decisions, mistakes]
date: 2026-09-30
---

# The first `ADMIN_TOKEN` command produced a predictable value

While setting up the reviews admin token for spotlesslhc.com
(see [[website-next-steps]]), I gave Bryce this PowerShell one-liner:

`-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})`

`-join` binds tighter than the pipe, so it joined the whole ASCII range into
one fixed string (`4849505152535455…`) *before* `Get-Random` ran. The
output was not random. Bryce saved it as the Worker secret, then hit parse
errors when he pasted it unquoted, which is how it was noticed.

**Impact:** the secret was guessable for a few minutes. It only gates
`DELETE /api/reviews/<id>` and the reviews feature was not yet merged, so
nothing was exposed. A second token was then pasted into the chat, so a third
rotation was recommended.

**Do differently:**
- Never hand over a generator command without running it first and reading the
  output. Look at it: a counting sequence is not a secret.
- Use a cryptographic source, not `Get-Random`:
  `$b = New-Object byte[] 30; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ([Convert]::ToBase64String($b) -replace '[+/=]','')`
- Tell the user to keep secrets out of chats and to quote them in PowerShell.
