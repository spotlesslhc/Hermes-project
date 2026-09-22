# Hermes — deployment guide

This is a Cloudflare Workers project (static dashboard + serverless backend
logic, both running for free on Cloudflare's network). The only thing that
costs money is the Claude API calls Hermes makes when you talk to it
(pay-as-you-go, typically pennies to a few dollars a month at this scale).

## What's in here

```
public/index.html     The dashboard page itself (static — served directly)
src/index.js           The Worker script — handles /api/* and /webhooks/*
wrangler.jsonc          Tells Cloudflare where the static files and script live
```

Requests to `/`, `/index.html`, etc. are served straight from `public/` by
Cloudflare — the script in `src/index.js` never even runs for those. Any
request that doesn't match a file in `public/` (like `/api/ask`) falls
through to the Worker script, which handles it.

## 1. Repo structure

Make sure your GitHub repo's top level looks like this — no extra nested
folder, no leftover zip file:

```
public/
src/
wrangler.jsonc
README.md
```

## 2. Deploy settings in Cloudflare

In your project → **Settings** → Build configuration:
- **Deploy command:** `npx wrangler deploy` (this is the default — leave it
  as-is, don't change it)
- **Build command:** blank
- **Root directory:** `/`

This is different from earlier instructions you may have seen for this
project — ignore any mention of `wrangler pages deploy`. That command was
for a different Cloudflare product (Pages) than what actually got created
here (Workers). The default `npx wrangler deploy` is correct.

## 3. Create the KV namespace (Hermes' memory)

1. **Workers & Pages → KV → Create namespace.** Name it `HERMES_KV`.
2. In your project → **Bindings → Add binding → KV namespace.**
   - Variable name: `HERMES_KV`
   - KV namespace: the one you just created
3. Save, then redeploy (Deployments → Retry, or push a small change to
   GitHub).

## 4. Get a Claude API key and add it as a secret

1. Go to **console.anthropic.com**, create an account if needed, and add
   billing (pay-as-you-go — separate from any claude.ai subscription).
2. Create an API key.
3. In your project → **Settings → Variables and Secrets → Add.** Name it
   `ANTHROPIC_API_KEY`, paste the key as the value, and mark it as a
   **secret** (not a plain variable) so it stays hidden.
4. Redeploy.

## 4b. (Optional) Give Deja a real voice via ElevenLabs

Without this, Deja falls back to the browser's built-in text-to-speech —
everything still works, it just sounds robotic.

1. Create an account at **elevenlabs.io** and generate an API key.
2. In your project → **Settings → Variables and Secrets → Add.** Name it
   `ELEVENLABS_API_KEY`, paste the key as the value, mark it a **secret**.
3. In `wrangler.jsonc`, add the binding entry for it to `secrets_store_secrets`
   (same shape as the other three entries there — there's a comment marking
   where it goes). This is a separate, deliberate step from creating the
   secret itself — the binding is left out of the code until the secret
   actually exists, so a not-yet-created secret can't break deployment of
   everything else.
4. Pick a voice (elevenlabs.io/app/voice-library) and set its voice ID as
   `ELEVENLABS_VOICE_ID` near the top of `src/index.js` — it's a placeholder
   default until you do this.
5. Redeploy. `/api/speak` will start using the real voice automatically;
   nothing else needs to change.

`HERMES_DEBUG_TOOLS` in `wrangler.jsonc` is a plain (non-secret) variable,
always `"false"` in production — it only matters for local testing (see
`npx wrangler dev --var HERMES_DEBUG_TOOLS:true`), don't turn it on live.

## 5. Point Zapier at the reservation webhook

Add one more step to your existing reservation Zap, after the Google
Calendar step:

1. **+ → Webhooks by Zapier → POST**
2. URL: `https://<your-project-domain>/webhooks/reservation`
3. Payload type: **JSON**
4. Map: `property`, `guest_name`, `checkout` from your reservation data
5. Test, then publish the Zap.

## 6. Enable the public URL

Cloudflare doesn't turn on your `workers.dev` URL by default. In your
project → **Settings → Domains & Routes**, enable the `workers.dev`
subdomain (or add your own custom domain from the same screen).

## 7. (Recommended) Lock the dashboard behind a login

Cloudflare Access is free for personal use:

1. **Zero Trust → Access → Applications → Add an application → Self-hosted.**
2. Point it at your project's domain.
3. Add a policy allowing only your own email address.

## Editing Hermes' personality later

Hermes' instructions live in plain English near the top of `src/index.js`,
in the `HERMES_SYSTEM_PROMPT` constant. Edit that text, push the change to
GitHub, and Cloudflare redeploys automatically.

## Important: don't recreate the project

Deleting and recreating this project (or fully disconnecting/reconnecting
GitHub) resets all the settings above — the KV binding, the API key, the
domain. Once it's set up, just push file changes to the existing repo.
Cloudflare will redeploy on every commit automatically.
