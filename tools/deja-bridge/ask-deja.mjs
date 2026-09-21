#!/usr/bin/env node
// Sends one message to Deja/Hermes's /api/ask and prints her reply.
//
// The Worker sits behind Cloudflare Access, so requests need a Access
// Service Token (CF-Access-Client-Id / CF-Access-Client-Secret headers),
// not just the plain fetch the dashboard itself gets away with (the
// dashboard's own browser session is what satisfies Access there).
//
// Usage:
//   node ask-deja.mjs "message text"
//   echo "message text" | node ask-deja.mjs
//
// Credentials come from CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET in
// the environment, or from a .env.local file next to this script (see
// .env.local.example) — never hardcoded here.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER_URL = "https://hermes-project.spotlesscleaninglhc.workers.dev/api/ask";

function loadEnvLocal() {
  const path = join(HERE, ".env.local");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function main() {
  const fileEnv = loadEnvLocal();
  const clientId = process.env.CF_ACCESS_CLIENT_ID || fileEnv.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET || fileEnv.CF_ACCESS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "Missing CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET.\n" +
      "Set them as env vars, or copy .env.local.example to .env.local and fill them in."
    );
    process.exit(1);
  }

  const argMessage = process.argv.slice(2).join(" ").trim();
  const message = argMessage || (await readStdin());
  if (!message) {
    console.error('No message given. Usage: node ask-deja.mjs "message text"');
    process.exit(1);
  }

  let res;
  try {
    res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "CF-Access-Client-Id": clientId,
        "CF-Access-Client-Secret": clientSecret
      },
      body: JSON.stringify({ message })
    });
  } catch (err) {
    console.error(`Request failed: ${err.message}`);
    process.exit(1);
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`Deja returned ${res.status}: ${text}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(`Non-JSON response: ${text}`);
    process.exit(1);
  }

  if (data.error) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }

  console.log(data.reply ?? "(empty reply)");
}

main();
