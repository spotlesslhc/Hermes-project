---
title: PowerShell's echo prepended a BOM that silently corrupted a piped secret
tags: [decision, mistake, powershell, spotify, agent-notes]
updated: 2026-09-23
---

# PowerShell's echo prepended a BOM that silently corrupted a piped secret

## What happened

While setting up Spotify OAuth (see [[systems/spotify-control]]), the
`SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` values were piped into
`wrangler secrets-store secret create` using PowerShell's `echo` (an alias
for `Write-Output`):

```powershell
echo "031a7a9306294b8ba1e899c2eb58c782" | npx wrangler secrets-store secret create ...
```

The secret was accepted without error and showed as "active" in
`secret list`. But the OAuth login later failed with Spotify returning
`client_id: Invalid`, and the redirect URL showed the client_id starting
with `%EF%BB%BF` — a UTF-8 byte-order-mark. PowerShell's default pipe
encoding prepended a BOM to the piped text, so the stored secret was
`"﻿031a7a..."` instead of the real value, three bytes off from what
Bryce had actually typed. Nothing in the create/list output indicated
this — the value looked identical everywhere it was echoed back
(truncated/redacted displays), and the command reported success.

## Also relevant: the earlier `--remote` mistake, same session

Separately (documented here since it happened right before this and is
easy to conflate): the very first attempt to create these two secrets
used the CLI's default **local** simulated Secrets Store, not the actual
Cloudflare account, because `--remote` was omitted. `secret list` (also
without `--remote`) then dutifully showed them as "active" — from the
local store — which looked like confirmation but wasn't. The real error
only surfaced in the Cloudflare Workers Build log: `Secrets Store binding
'SPOTIFY_CLIENT_ID' ... were not found`. Fixed by recreating both with
`--remote` explicitly.

## What to do differently

- **Never pipe a secret value through PowerShell's `echo`/`Write-Output`**
  when the receiving process reads raw stdin bytes. Use Bash's `printf`
  instead (no trailing newline, no BOM) — confirmed clean by piping into
  `wc -c` and checking the byte count matches the expected string length
  exactly.
- **Always pass `--remote` explicitly** for any `wrangler secrets-store
  secret` (or similar dual local/remote) command in this project — don't
  trust the default, and don't trust `secret list` as confirmation unless
  it was also run with `--remote`.
- When something downstream fails with a vague "invalid" error after a
  credential was "successfully" stored, suspect silent transport
  corruption (BOM, trailing newline, wrong encoding) before assuming the
  value itself was mistyped.
