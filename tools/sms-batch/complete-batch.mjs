#!/usr/bin/env node
// Marks a cleaner-text batch as sent (POST /api/sms-batch/complete). Call
// this only after the texts have actually been sent in Bryce's browser --
// see Knowledge/playbooks/2026-09-27-cleaner-text-3week-google-voice.md.
//
// Usage: node complete-batch.mjs <batch-id>

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER_URL = "https://hermes.spotlesslhc.com/api/sms-batch/complete";

function loadEnvFile(path) {
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

function loadCredentials() {
  const own = loadEnvFile(join(HERE, ".env.local"));
  const dejaBridge = loadEnvFile(join(HERE, "..", "deja-bridge", ".env.local"));
  return {
    clientId: process.env.CF_ACCESS_CLIENT_ID || own.CF_ACCESS_CLIENT_ID || dejaBridge.CF_ACCESS_CLIENT_ID,
    clientSecret: process.env.CF_ACCESS_CLIENT_SECRET || own.CF_ACCESS_CLIENT_SECRET || dejaBridge.CF_ACCESS_CLIENT_SECRET
  };
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: node complete-batch.mjs <batch-id>");
    process.exit(1);
  }

  const { clientId, clientSecret } = loadCredentials();
  if (!clientId || !clientSecret) {
    console.error("Missing CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET (see check-batch.mjs).");
    process.exit(1);
  }

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "CF-Access-Client-Id": clientId,
      "CF-Access-Client-Secret": clientSecret
    },
    body: JSON.stringify({ id })
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Worker returned ${res.status}: ${text}`);
    process.exit(1);
  }
  console.log(text);
}

main();
