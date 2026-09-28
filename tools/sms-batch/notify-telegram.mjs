#!/usr/bin/env node
// Sends a plain Telegram message to Bryce -- used to tell him texts are
// staged in Google Voice and ready for him to actually hit send. This is
// a separate, local credential from the Worker's own TELEGRAM_BOT_TOKEN
// secret (same value, just also kept here so this local tool can notify
// without needing a round trip through the Worker).
//
// Usage:
//   node notify-telegram.mjs "message text"
//   echo "message text" | node notify-telegram.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

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

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function main() {
  const env = loadEnvFile(join(HERE, ".env.local"));
  const token = process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("Missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID in .env.local.");
    process.exit(1);
  }

  const argText = process.argv.slice(2).join(" ").trim();
  const text = argText || (await readStdin());
  if (!text) {
    console.error('No message given. Usage: node notify-telegram.mjs "message text"');
    process.exit(1);
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Telegram returned ${res.status}: ${body}`);
    process.exit(1);
  }
  console.log("Sent.");
}

main();
