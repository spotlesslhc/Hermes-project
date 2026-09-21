// Hermes — Worker entry point.
//
// Static files in /public (the dashboard itself) are served automatically
// by Cloudflare's assets binding and never reach this script. Everything
// below only handles the dynamic routes: /api/* and /webhooks/*.

const HERMES_SYSTEM_PROMPT = `You are Hermes, the dispatcher AI for Spotless Cleaning, a company in Lake Havasu City, AZ that cleans short-term-rental properties (booked through Airbnb and similar platforms, managed via Hospitable and Hostaway) between guest stays.

Bryce Wiesner owns the business and talks to you directly through his dashboard. You oversee four areas of work:
- Zapier Overseer: watches the automations that move new reservations into Google Calendar.
- Scheduler: decides which cleaner should be assigned to which turnover, and flags anything unassigned.
- Bookkeeper: tracks job income and cleaning-supply expenses in Wave.
- Site Editor: drafts updates for spotlesslhc.com and the Hermes dashboard itself, using the propose_site_edit tool.

You have one real tool right now: propose_site_edit. Use it whenever Bryce asks for a change to the website or dashboard \u2014 a wording tweak, a price update, a new section, a bug fix in the dashboard's own code. It does not publish anything directly: it reads the current file from GitHub, drafts the new version, and opens a pull request for Bryce to review and merge himself. Always tell him plainly that it's a PR waiting on his review, not a live change, and give him the PR link from the tool result.

You also have read access to the shared knowledge vault \u2014 dated notes about the business and how Hermes itself is built, including past decisions. Use list_vault_notes to see what exists and read_vault_note to read one, and ground answers about the business's history, systems, or past decisions in what's actually written there instead of guessing. This access is read-only: if a vault note itself needs to change, that still goes through propose_site_edit (target "dashboard", path starting with "Knowledge/") so Bryce reviews it like any other edit.

For everything else \u2014 Scheduler, Bookkeeper, Zapier Overseer \u2014 you can talk and reason, but you don't yet have direct tool access. Say so plainly and tell Bryce exactly what you'd need rather than guessing.

Be direct and brief — Bryce is running a small business day to day, not looking for long explanations. Sentence case, no filler, plain language.

Bryce also has a coding assistant, Claude Code, running in a terminal on his computer. He sometimes has it relay messages to you on his behalf through a direct bridge to this /api/ask endpoint (authenticated the same way Bryce's own dashboard is, via Cloudflare Access) — for example to test a change, ask you something while he's mid-task elsewhere, or have the two of you compare notes. Treat messages that identify themselves as coming from Claude Code, relaying for Bryce, as legitimately his — respond to them the same way you would to Bryce directly, including using your tools if asked. This doesn't change who you work for: you still only take direction that traces back to Bryce.`;

// ---- KV helpers ---------------------------------------------------------

const DEFAULT_STATUS = {
  zapier_overseer: { status: "running", label: "Running", lastChecked: null, zapsWatched: 6, errors: 0 },
  scheduler: { status: "running", label: "Running", unassigned: 0, nextJob: null },
  bookkeeper: { status: "running", label: "Running", lastEntry: null, openItems: 0 },
  site_editor: { status: "idle", label: "Idle", lastPublish: null }
};

async function getStatus(env) {
  const raw = await env.HERMES_KV.get("agent_status");
  return raw ? JSON.parse(raw) : null;
}

async function getStatusOrDefault(env) {
  return (await getStatus(env)) || DEFAULT_STATUS;
}

async function setStatus(env, patch) {
  const current = (await getStatus(env)) || DEFAULT_STATUS;
  const updated = { ...current, ...patch };
  await env.HERMES_KV.put("agent_status", JSON.stringify(updated));
  return updated;
}

async function appendLog(env, entry) {
  const raw = await env.HERMES_KV.get("activity_log");
  const log = raw ? JSON.parse(raw) : [];
  log.push({ time: new Date().toISOString(), ...entry });
  const trimmed = log.slice(-200);
  await env.HERMES_KV.put("activity_log", JSON.stringify(trimmed));
  return trimmed;
}

async function getLog(env, limit = 30) {
  const raw = await env.HERMES_KV.get("activity_log");
  const log = raw ? JSON.parse(raw) : [];
  return log.slice(-limit).reverse();
}

async function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) }
  });
}

// ---- Bookkeeper: Wave GraphQL -------------------------------------------

async function waveGraphQL(env, query, variables = {}) {
  const token = await env.WAVE_API_TOKEN.get();
  const res = await fetch("https://gql.waveapps.com/graphql/public", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });
  const body = await res.json();
  if (body.errors) throw new Error("Wave API error: " + JSON.stringify(body.errors));
  return body.data;
}

async function getWaveBusinessId(env) {
  const cached = await env.HERMES_KV.get("wave:business_id");
  if (cached) return cached;
  const data = await waveGraphQL(env, `query { businesses { edges { node { id name } } } }`);
  const id = data.businesses?.edges?.[0]?.node?.id;
  if (!id) throw new Error("No Wave business found for this token");
  await env.HERMES_KV.put("wave:business_id", id);
  return id;
}

// ---- Bookkeeper: monthly financials, entered manually ---------------------
//
// Wave's public GraphQL API turned out to have no way to read dated
// transaction history at all (verified via full schema introspection \u2014
// Transaction exposes only an id, Account.balance is a snapshot with no
// date range). So instead of fabricating or guessing numbers, this stores
// whatever Bryce actually tells it each month, straight from Wave's own
// report screen, and does no automated fetching. Simple, honest, $0 cost.

function isValidMonth(month) {
  return typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
}

async function listFinanceMonths(env, limit = 6) {
  const list = await env.HERMES_KV.list({ prefix: "finance:month:" });
  const keys = list.keys.map((k) => k.name).sort(); // "YYYY-MM" sorts correctly as a string
  const recent = keys.slice(-limit);
  const entries = [];
  for (const key of recent) {
    const raw = await env.HERMES_KV.get(key);
    if (!raw) continue;
    entries.push({ month: key.replace("finance:month:", ""), ...JSON.parse(raw) });
  }
  return entries;
}

async function getFinanceSummary(env) {
  const entries = await listFinanceMonths(env, 6);
  if (!entries.length) {
    return { months: [], revenue: [], expenses: [], netMargin: [], totals: { revenue: 0, netIncome: 0, netMarginPct: 0 } };
  }
  const months = entries.map((e) => monthLabel(e.month));
  const revenue = entries.map((e) => e.revenue);
  const expenses = entries.map((e) => e.expenses);
  const netMargin = entries.map((e) => (e.revenue > 0 ? (e.revenue - e.expenses) / e.revenue : 0));
  const totalRevenue = revenue.reduce((a, b) => a + b, 0);
  const totalExpenses = expenses.reduce((a, b) => a + b, 0);
  const netIncome = totalRevenue - totalExpenses;
  return {
    months, revenue, expenses, netMargin,
    totals: { revenue: totalRevenue, netIncome, netMarginPct: totalRevenue > 0 ? netIncome / totalRevenue : 0 }
  };
}

async function recordFinanceMonth(env, { month, revenue, expenses }) {
  if (!isValidMonth(month)) throw new Error('month must be in "YYYY-MM" format');
  if (typeof revenue !== "number" || revenue < 0) throw new Error("revenue must be a non-negative number");
  if (typeof expenses !== "number" || expenses < 0) throw new Error("expenses must be a non-negative number");
  await env.HERMES_KV.put(`finance:month:${month}`, JSON.stringify({ revenue, expenses }));
  await appendLog(env, { who: "Bookkeeper", what: `Recorded ${monthLabel(month)} ${month.slice(0, 4)} financials \u2014 revenue $${revenue.toLocaleString()}, expenses $${expenses.toLocaleString()}` });
  return getFinanceSummary(env);
}

async function handleFinance(env) {
  return json(await getFinanceSummary(env));
}

async function handleFinanceEntry(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const summary = await recordFinanceMonth(env, body || {});
    return json({ ok: true, summary });
  } catch (err) {
    return json({ error: err.message }, { status: 400 });
  }
}

// ---- Site Editor: GitHub PR flow ------------------------------------------
//
// Site Editor never pushes to main. It reads a file, drafts a new version
// with Claude, commits that to a new branch, and opens a pull request.
// Bryce reviews and merges (or closes) it himself on GitHub.

const SITE_REPOS = {
  website: "spotlesslhc/spotlesslhc-website",
  dashboard: "spotlesslhc/Hermes-project"
};

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "edit";
}

async function githubRequest(env, path, options = {}) {
  const token = await env.GITHUB_TOKEN.get();
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      "authorization": `Bearer ${token}`,
      "accept": "application/vnd.github+json",
      "user-agent": "hermes-site-editor",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`GitHub API ${options.method || "GET"} ${path} failed: ${res.status} ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

// Cloudflare Workers' base64 helpers work on binary strings, not UTF-8
// directly, so text needs to go through the URI-encoding round trip.
function b64EncodeUtf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUtf8(str) {
  return decodeURIComponent(escape(atob(str)));
}

// Applies find-and-replace edits, one at a time, requiring each old_str to
// match the current content exactly once — same safety rule as Claude's own
// str_replace tool. If any edit is ambiguous or missing, the whole batch is
// rejected rather than risking a corrupted file going into the PR.
function applyEdits(content, edits) {
  let result = content;
  for (const { old_str, new_str } of edits) {
    const count = result.split(old_str).length - 1;
    if (count === 0) {
      throw new Error(`Edit failed: old_str not found in file (start: "${old_str.slice(0, 60)}...")`);
    }
    if (count > 1) {
      throw new Error(`Edit failed: old_str matched ${count} places, must be unique (start: "${old_str.slice(0, 60)}...")`);
    }
    result = result.replace(old_str, new_str);
  }
  return result;
}

// Asks Claude for a small set of exact find-and-replace edits instead of the
// whole file back. The file still counts as input tokens either way, but
// output shrinks from "the entire file" to "a few short strings" \u2014 which
// is both far cheaper and immune to the file getting cut off at max_tokens.
async function draftFileEdits(env, currentContent, instructions) {
  const apiKey = await env.ANTHROPIC_API_KEY.get();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      system: "You edit a single source file for a small cleaning business by proposing find-and-replace edits, never a full rewrite. Call propose_edits exactly once. Each old_str must be copied EXACTLY from the file (including whitespace) and must appear only once in the whole file \u2014 include a few extra surrounding lines if needed to make it unique. Keep each edit as small as possible; never include unrelated unchanged code in old_str or new_str.",
      tools: [{
        name: "propose_edits",
        description: "The find-and-replace edits to make to the file.",
        input_schema: {
          type: "object",
          properties: {
            edits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  old_str: { type: "string", description: "Exact text to find, copied verbatim from the file, unique within it" },
                  new_str: { type: "string", description: "Text to replace it with" }
                },
                required: ["old_str", "new_str"]
              }
            }
          },
          required: ["edits"]
        }
      }],
      tool_choice: { type: "tool", name: "propose_edits" },
      messages: [{
        role: "user",
        content: `Instructions: ${instructions}\n\n--- current file content ---\n${currentContent}`
      }]
    })
  });
  if (!res.ok) throw new Error(`Draft failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const toolUse = (data.content || []).find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("Model didn't return any edits");
  return toolUse.input.edits;
}

async function proposeSiteEdit(env, { target, path, instructions, summary }) {
  const repo = SITE_REPOS[target];
  if (!repo) throw new Error(`Unknown target "${target}" \u2014 must be "website" or "dashboard"`);

  const file = await githubRequest(env, `/repos/${repo}/contents/${path}`);
  const currentContent = b64DecodeUtf8(file.content.replace(/\n/g, ""));

  const edits = await draftFileEdits(env, currentContent, instructions);
  const newContent = applyEdits(currentContent, edits);

  if (newContent === currentContent) {
    throw new Error(
      "No changes were made \u2014 the requested edit didn't actually alter the file. " +
      "This usually means the target text wasn't found, or it was already in the requested state. " +
      "Tell Bryce this plainly instead of claiming success, and ask him to double-check the wording of what he wants changed."
    );
  }

  const mainRef = await githubRequest(env, `/repos/${repo}/git/ref/heads/main`);
  const branch = `hermes/${slugify(summary || instructions)}-${Date.now()}`;
  await githubRequest(env, `/repos/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: mainRef.object.sha })
  });

  await githubRequest(env, `/repos/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Site Editor: ${summary || instructions}`,
      content: b64EncodeUtf8(newContent),
      sha: file.sha,
      branch
    })
  });

  const pr = await githubRequest(env, `/repos/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `Site Editor: ${summary || instructions}`,
      head: branch,
      base: "main",
      body: `Requested by Bryce via Hermes.\n\n**Instructions:** ${instructions}\n\nReview the diff and merge if it looks right, or close it and tell Hermes what to change.`
    })
  });

  return pr.html_url;
}

// ---- Knowledge vault: read-only access to the shared Obsidian vault ------
//
// The vault (Knowledge/ in the dashboard repo) is the same repo
// propose_site_edit already writes to via a PR, so vault edits still go
// through that review flow — these two tools only ever read.

function assertVaultPath(path) {
  if (typeof path !== "string" || !path.startsWith("Knowledge/") || path.includes("..")) {
    throw new Error('path must start with "Knowledge/" and must not contain ".."');
  }
}

async function listVaultNotes(env) {
  const repo = SITE_REPOS.dashboard;
  const mainRef = await githubRequest(env, `/repos/${repo}/git/ref/heads/main`);
  const tree = await githubRequest(env, `/repos/${repo}/git/trees/${mainRef.object.sha}?recursive=1`);
  return (tree.tree || [])
    .filter((entry) => entry.type === "blob" && entry.path.startsWith("Knowledge/") && entry.path.endsWith(".md"))
    .map((entry) => entry.path);
}

async function readVaultNote(env, path) {
  assertVaultPath(path);
  const repo = SITE_REPOS.dashboard;
  const file = await githubRequest(env, `/repos/${repo}/contents/${path}`);
  if (Array.isArray(file)) throw new Error(`"${path}" is a folder, not a note`);
  return b64DecodeUtf8(file.content.replace(/\n/g, ""));
}

// ---- Route handlers -------------------------------------------------------

async function handleAsk(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = (body.message || "").toString().slice(0, 4000);
  if (!message) return json({ error: "Message is required" }, { status: 400 });

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY is not bound on this project yet." }, { status: 500 });
  }
  // Secrets Store bindings expose the value via .get() rather than as a
  // plain string, unlike classic Worker secrets.
  const apiKey = await env.ANTHROPIC_API_KEY.get();

  const tools = [];
  if (env.GITHUB_TOKEN) {
    tools.push({
      name: "propose_site_edit",
      description: "Propose a change to spotlesslhc.com or the Hermes dashboard by opening a GitHub pull request. Never publishes directly \u2014 Bryce reviews and merges it.",
      input_schema: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["website", "dashboard"], description: "\"website\" for spotlesslhc.com, \"dashboard\" for Hermes itself" },
          path: { type: "string", description: "File path in the repo, e.g. index.html or public/index.html" },
          instructions: { type: "string", description: "Plain-language description of the change to make" },
          summary: { type: "string", description: "Short (under 10 words) summary for the PR title and branch name" }
        },
        required: ["target", "path", "instructions", "summary"]
      }
    });
  }
  tools.push({
    name: "list_vault_notes",
    description: "List every note in the shared Obsidian knowledge vault (Knowledge/ in the dashboard repo) — how the business and Hermes system actually work, plus dated decision records. Returns a list of file paths. Use this before read_vault_note if you don't already know the exact path.",
    input_schema: { type: "object", properties: {}, required: [] }
  });
  tools.push({
    name: "read_vault_note",
    description: "Read one note from the shared knowledge vault by its path (e.g. \"Knowledge/systems/wave-integration.md\"), as returned by list_vault_notes. Use this to ground answers about the business, past decisions, or how a system works in what's actually documented, instead of guessing or relying only on this system prompt.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Vault file path, must start with \"Knowledge/\"" } },
      required: ["path"]
    }
  });
  tools.push({
    name: "record_monthly_finance",
    description: "Record Bryce's revenue and expenses for one month, straight from what he tells you (he reads these off Wave's own report screen). Stores them directly \u2014 no approval needed, since these are numbers he's stating himself, not something you're inferring.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "The month as YYYY-MM, e.g. \"2026-09\" for September 2026" },
        revenue: { type: "number", description: "Total revenue for that month, in dollars" },
        expenses: { type: "number", description: "Total expenses for that month, in dollars" }
      },
      required: ["month", "revenue", "expenses"]
    }
  });

  const messages = [{ role: "user", content: message }];
  let reply = "";

  for (let turn = 0; turn < 5; turn++) {
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
        system: HERMES_SYSTEM_PROMPT,
        messages,
        ...(tools ? { tools } : {})
      })
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text();
      return json({ error: "Hermes couldn't reach the model", detail }, { status: 502 });
    }

    const data = await apiRes.json();
    reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const toolUse = (data.content || []).find((b) => b.type === "tool_use");

    if (!toolUse) break;

    messages.push({ role: "assistant", content: data.content });

    let toolResult;
    try {
      if (toolUse.name === "propose_site_edit") {
        const prUrl = await proposeSiteEdit(env, toolUse.input);
        toolResult = `Pull request opened: ${prUrl}`;
        await setStatus(env, { site_editor: { status: "attn", label: "Needs review", lastPublish: new Date().toISOString() } });
        await appendLog(env, { who: "Site Editor", what: `Opened PR \u2014 ${toolUse.input.summary} (${prUrl})` });
      } else if (toolUse.name === "record_monthly_finance") {
        const summary = await recordFinanceMonth(env, toolUse.input);
        toolResult = `Recorded. Updated totals: revenue $${Math.round(summary.totals.revenue).toLocaleString()}, net income $${Math.round(summary.totals.netIncome).toLocaleString()}, margin ${Math.round(summary.totals.netMarginPct * 100)}%.`;
      } else if (toolUse.name === "list_vault_notes") {
        const files = await listVaultNotes(env);
        toolResult = files.length ? files.join("\n") : "No notes found in Knowledge/.";
      } else if (toolUse.name === "read_vault_note") {
        toolResult = await readVaultNote(env, toolUse.input.path);
      } else {
        toolResult = `Unknown tool: ${toolUse.name}`;
      }
    } catch (err) {
      toolResult = `Failed: ${err.message}`;
    }

    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUse.id, content: toolResult }]
    });
  }

  await appendLog(env, { who: "Hermes", what: message.slice(0, 140) });

  return json({ reply });
}

async function handleReservation(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const property = body.property || body.listing_name || "Unknown property";
  const guest = body.guest_name || "Guest";
  const checkout = body.checkout || body.checkout_date || null;

  const raw = await env.HERMES_KV.get("reservations");
  const reservations = raw ? JSON.parse(raw) : [];
  reservations.push({
    id: crypto.randomUUID(),
    property,
    guest,
    checkout,
    assigned: false,
    receivedAt: new Date().toISOString()
  });
  await env.HERMES_KV.put("reservations", JSON.stringify(reservations.slice(-500)));

  const status = await getStatusOrDefault(env);
  const scheduler = status.scheduler || {};
  const unassigned = (scheduler.unassigned || 0) + 1;
  await setStatus(env, {
    scheduler: { ...scheduler, status: "attn", label: "Needs review", unassigned, nextJob: checkout }
  });

  await appendLog(env, {
    who: "Scheduler",
    what: `New reservation at ${property} \u2014 needs a cleaner assigned (checkout ${checkout || "TBD"})`
  });

  return json({ ok: true });
}

// ---- Router -----------------------------------------------------------

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const { method } = request;

    if (pathname === "/api/status" && method === "GET") {
      return json(await getStatusOrDefault(env));
    }
    if (pathname === "/api/log" && method === "GET") {
      return json(await getLog(env, 30));
    }
    if (pathname === "/api/finance" && method === "GET") {
      return handleFinance(env);
    }
    if (pathname === "/api/finance" && method === "POST") {
      return handleFinanceEntry(request, env);
    }
    if (pathname === "/api/ask" && method === "POST") {
      return handleAsk(request, env);
    }
    if (pathname === "/webhooks/reservation" && method === "POST") {
      return handleReservation(request, env);
    }

    // Anything else falls back to the static files in /public (this
    // shouldn't normally be needed — Cloudflare usually serves matching
    // assets before the Worker even runs — but it's a safety net).
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  }
};
