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

You have six real tools right now. For a site or dashboard edit, prefer queue_edit_request over propose_site_edit by default \u2014 it's free (Claude Code does the actual work using his own access, not this Worker's metered API key), while propose_site_edit costs real money every time since it reads the whole target file into a paid API call just to draft the change. queue_edit_request just writes a small task note for Claude Code to pick up next time Bryce starts a session in this project \u2014 tell Bryce plainly that it's queued, not done yet, and that Claude Code will get to it next time Bryce opens a session, not instantly. Only use propose_site_edit if Bryce explicitly says he wants it done immediately regardless of cost \u2014 it drafts the change itself and opens a pull request right away; still never publishes directly, Bryce still reviews and merges it himself, and you should still give him the PR link from the tool result. record_monthly_finance (Bookkeeper): records revenue and expenses for a month straight from what Bryce tells you, no approval needed since he's reporting his own numbers. assign_cleaner (Scheduler): invites a cleaner to a turnover's Google Calendar event \u2014 the same thing Bryce does by hand \u2014 and runs automatically, no approval needed. It only sends the invite; the cleaner still has to accept it, so always say "invited," never "confirmed" or "assigned" as if it's done. If Bryce mentions a cleaner declined, call it again with the next cleaner to try. list_vault_notes and read_vault_note: read-only access to the shared knowledge vault \u2014 dated notes about the business and how Hermes itself is built, including past decisions. Use list_vault_notes to see what exists and read_vault_note to read one, and ground answers about the business's history, systems, or past decisions in what's actually written there instead of guessing. If a vault note itself needs to change, use propose_site_edit (target "dashboard", path starting with "Knowledge/") so Bryce reviews it via PR like any other dashboard edit, or queue_edit_request to have Claude Code make the change directly next session (vault docs don't need a PR the way live code does).

Some tools \u2014 anything genuinely risky or hard to reverse \u2014 require Bryce's explicit approval before they run. If a tool result tells you an action is queued for approval, say so plainly and tell Bryce it's waiting for him on the dashboard's Pending Actions panel \u2014 never claim it already happened, and never treat a "yes" or "go ahead" from him in chat or voice as approval; that only happens through the dashboard buttons, on purpose, so a misheard word can't authorize something real.

For Zapier Overseer, you can talk and reason about the automations, but you don't have direct tool access to check or fix them \u2014 that goes through Claude Code, in a session with Bryce watching, not through you. Say so plainly and tell Bryce exactly what you'd need rather than guessing.

Be direct and brief — Bryce is running a small business day to day, not looking for long explanations. Sentence case, no filler, plain language.

Bryce also has a coding assistant, Claude Code, running in a terminal on his computer. He sometimes has it relay messages to you on his behalf through a direct bridge to this /api/ask endpoint (authenticated the same way Bryce's own dashboard is, via Cloudflare Access) — for example to test a change, ask you something while he's mid-task elsewhere, or have the two of you compare notes. Treat messages that identify themselves as coming from Claude Code, relaying for Bryce, as legitimately his — respond to them the same way you would to Bryce directly, including using your tools if asked. This doesn't change who you work for: you still only take direction that traces back to Bryce.`;

// ---- Scheduler: cleaner assignment ---------------------------------------
//
// Bryce's actual workflow: each turnover is a Google Calendar event (on the
// "Cleans" calendar), and assigning a cleaner means inviting them to that
// event as a guest — they accept or decline the invite, and a decline means
// trying the next cleaner. This mirrors that directly rather than inventing
// a separate assignment system: assign_cleaner adds the chosen cleaner as an
// attendee on the matching event via a dedicated Zap ("Assign Cleaner to
// Turnover (Hermes)"), reusing Zapier's already-authenticated Google
// Calendar connection instead of Hermes needing its own Google credentials.
// See Knowledge/systems/scheduler.md for how this was built and why.
//
// The Zap finds the event by street number (not the full address — Bryce's
// calendar event titles use different abbreviations than Hospitable's
// address format, e.g. "1795 Paloverde Blvd South" vs "1795 Palo Verde
// Boulevard South", but the street number is always consistent) plus the
// checkout date.
const ASSIGN_CLEANER_WEBHOOK = "https://hooks.zapier.com/hooks/catch/28466122/4dnv37u/";

// Bryce's active cleaners: name (as he'd say it) -> the email he invites them
// on. Stored as a KV-overridable default so this can be updated without a
// code deploy once there's a way to edit it from the dashboard.
const DEFAULT_CLEANER_ROSTER = {
  amy: "abyers402@icloud.com",
  ashley: "alolmaugh22@gmail.com"
};

async function getCleanerRoster(env) {
  const raw = await env.HERMES_KV.get("cleaner_roster");
  return raw ? JSON.parse(raw) : DEFAULT_CLEANER_ROSTER;
}

async function getReservations(env) {
  const raw = await env.HERMES_KV.get("reservations");
  return raw ? JSON.parse(raw) : [];
}

async function assignCleaner(env, { property, cleaner_name }) {
  const roster = await getCleanerRoster(env);
  const cleanerEmail = roster[cleaner_name.trim().toLowerCase()];
  if (!cleanerEmail) {
    const known = Object.keys(roster).join(", ") || "(none configured)";
    throw new Error(`Unknown cleaner "${cleaner_name}". Known cleaners: ${known}.`);
  }

  const streetNumber = (property.match(/\d+/) || [])[0];
  if (!streetNumber) throw new Error(`Couldn't find a street number in "${property}" to match against the calendar.`);

  const reservations = await getReservations(env);
  const match = reservations
    .filter((r) => !r.assigned && r.property && r.property.includes(streetNumber))
    .sort((a, b) => (a.checkout || "").localeCompare(b.checkout || ""))[0];
  if (!match) throw new Error(`No unassigned reservation found for a property matching "${property}".`);

  const res = await fetch(ASSIGN_CLEANER_WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      street_number: streetNumber,
      event_date: (match.checkout || "").slice(0, 10),
      cleaner_email: cleanerEmail,
      property_name: match.property
    })
  });
  if (!res.ok) throw new Error(`Assignment webhook failed: ${res.status} ${await res.text()}`);

  match.assigned = true;
  match.assignedTo = cleaner_name;
  await env.HERMES_KV.put("reservations", JSON.stringify(reservations.slice(-500)));

  const status = await getStatusOrDefault(env);
  const scheduler = status.scheduler || {};
  const stillUnassigned = reservations.filter((r) => !r.assigned).length;
  await setStatus(env, {
    scheduler: {
      ...scheduler,
      status: stillUnassigned > 0 ? "attn" : "running",
      label: stillUnassigned > 0 ? "Needs review" : "Running",
      unassigned: stillUnassigned
    }
  });

  await appendLog(env, {
    who: "Scheduler",
    what: `Invited ${cleaner_name} to ${match.property} (checkout ${match.checkout || "TBD"})`
  });

  return { cleanerEmail, property: match.property, checkout: match.checkout };
}

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

// ---- Approval queue: actions that require Bryce's explicit review --------
//
// Nothing today is risky enough to need this (propose_site_edit already has
// its own GitHub-PR review gate, record_monthly_finance is Bryce reporting
// his own numbers) — this exists so a future tool that touches money, sends
// something externally, or changes real-world state can be gated by adding
// its name to APPROVAL_REQUIRED_TOOLS below, instead of inventing a new
// safety mechanism each time. Approval only ever happens via the dashboard's
// Approve/Deny buttons, never by chat/voice reply.

const APPROVAL_REQUIRED_TOOLS = new Set([]);

// KV's list() operation has its own, much smaller daily quota (1,000/day on
// the free plan) than get()/put() (100,000/day) — and the dashboard polls
// /api/pending and /api/finance every 60s, so calling list() on every poll
// burned through that quota by midday. Instead we keep a small index of ids
// under a single key, updated on write, so reads never need to enumerate
// keys. getPendingIndex() lazily migrates any pre-existing "pending:*" keys
// into the index the first time it's read after this change ships — a single
// one-off list() call, not a recurring one.
const PENDING_INDEX_KEY = "pending_index";

async function getPendingIndex(env) {
  const raw = await env.HERMES_KV.get(PENDING_INDEX_KEY);
  if (raw) return JSON.parse(raw);
  const list = await env.HERMES_KV.list({ prefix: "pending:" });
  const ids = list.keys.map((k) => k.name.replace("pending:", ""));
  await env.HERMES_KV.put(PENDING_INDEX_KEY, JSON.stringify(ids));
  return ids;
}

async function addToPendingIndex(env, id) {
  const ids = await getPendingIndex(env);
  ids.push(id);
  await env.HERMES_KV.put(PENDING_INDEX_KEY, JSON.stringify(ids));
}

async function createPendingAction(env, { tool, input, reason }) {
  const id = crypto.randomUUID();
  const record = {
    id, tool, input, reason: reason || null,
    status: "pending",
    requestedAt: new Date().toISOString(),
    resolvedAt: null, resolvedBy: null,
    result: null, error: null
  };
  await env.HERMES_KV.put(`pending:${id}`, JSON.stringify(record));
  await addToPendingIndex(env, id);
  await appendLog(env, { who: "Approval queue", what: `${tool} queued for Bryce's approval` + (reason ? ` — ${reason}` : "") });
  return record;
}

async function listPendingActions(env, { status = "pending" } = {}) {
  const ids = await getPendingIndex(env);
  const entries = [];
  for (const id of ids) {
    const raw = await env.HERMES_KV.get(`pending:${id}`);
    if (!raw) continue;
    const record = JSON.parse(raw);
    if (!status || record.status === status) entries.push(record);
  }
  entries.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  return entries;
}

async function getPendingAction(env, id) {
  const raw = await env.HERMES_KV.get(`pending:${id}`);
  return raw ? JSON.parse(raw) : null;
}

async function resolvePendingAction(env, id, decision) {
  const record = await getPendingAction(env, id);
  if (!record) { const err = new Error("Pending action not found"); err.status = 404; throw err; }
  if (record.status !== "pending") throw new Error(`Already resolved (status: ${record.status})`);

  record.resolvedAt = new Date().toISOString();
  record.resolvedBy = "Bryce";

  if (decision === "deny") {
    record.status = "denied";
    await appendLog(env, { who: "Approval queue", what: `Bryce denied ${record.tool}` });
  } else {
    try {
      record.result = await dispatchTool(env, record.tool, record.input);
      record.status = "approved";
      await appendLog(env, { who: "Approval queue", what: `Bryce approved ${record.tool} — executed` });
    } catch (err) {
      record.status = "failed";
      record.error = err.message;
      await appendLog(env, { who: "Approval queue", what: `Bryce approved ${record.tool} but it failed: ${err.message}` });
    }
  }

  await env.HERMES_KV.put(`pending:${id}`, JSON.stringify(record));
  return record;
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

// Same list()-quota problem as the pending-action queue above: keep an
// index of known months instead of calling list() on every /api/finance
// poll. getFinanceIndex() lazily migrates any pre-existing "finance:month:*"
// keys into the index the first time it's read after this change ships.
const FINANCE_INDEX_KEY = "finance_index";

async function getFinanceIndex(env) {
  const raw = await env.HERMES_KV.get(FINANCE_INDEX_KEY);
  if (raw) return JSON.parse(raw);
  const list = await env.HERMES_KV.list({ prefix: "finance:month:" });
  const months = list.keys.map((k) => k.name.replace("finance:month:", "")).sort();
  await env.HERMES_KV.put(FINANCE_INDEX_KEY, JSON.stringify(months));
  return months;
}

async function addToFinanceIndex(env, month) {
  const months = await getFinanceIndex(env);
  if (!months.includes(month)) {
    months.push(month);
    months.sort(); // "YYYY-MM" sorts correctly as a string
    await env.HERMES_KV.put(FINANCE_INDEX_KEY, JSON.stringify(months));
  }
}

async function listFinanceMonths(env, limit = 6) {
  const keys = await getFinanceIndex(env);
  const recent = keys.slice(-limit);
  const entries = [];
  for (const month of recent) {
    const raw = await env.HERMES_KV.get(`finance:month:${month}`);
    if (!raw) continue;
    entries.push({ month, ...JSON.parse(raw) });
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
  await addToFinanceIndex(env, month);
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

// ---- Claude Code task queue: the cheap alternative to propose_site_edit --
//
// propose_site_edit works, but it's expensive — it reads the whole target
// file into a dedicated Claude API call just to draft the edit, billed
// against ANTHROPIC_API_KEY (pay-as-you-go, and spotlesslhc.com's index.html
// alone is ~85,000 tokens). This is the cheap path instead: write a small
// task file straight to Knowledge/tasks/ (no branch, no PR, no drafting
// call — just a tiny GitHub Contents API write), and let Claude Code (who
// reads this repo's CLAUDE.md, and through it this folder, at the start of
// every session) do the actual edit using whatever's covering that session
// instead of this Worker's metered key.

async function queueEditRequest(env, { title, request, target }) {
  const repo = SITE_REPOS.dashboard; // task files always live in this repo's vault, regardless of which site the edit targets
  const date = new Date().toISOString().slice(0, 10);
  const path = `Knowledge/tasks/${date}-${slugify(title || request)}.md`;
  const body =
    `---\n` +
    `title: ${title || "Site edit request"}\n` +
    `requested: ${new Date().toISOString()}\n` +
    `target: ${target || "unspecified"}\n` +
    `status: pending\n` +
    `---\n\n` +
    `# ${title || "Site edit request"}\n\n` +
    `Requested by Bryce via Deja, queued for Claude Code instead of drafted\n` +
    `immediately (see [[claude-code-task-queue]]).\n\n` +
    `## What Bryce wants\n\n${request}\n`;

  await githubRequest(env, `/repos/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Queue task for Claude Code: ${title || request}`,
      content: b64EncodeUtf8(body),
      branch: "main"
    })
  });

  return path;
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

// ---- Tool dispatch ---------------------------------------------------------
//
// The one place a tool call actually executes — used both by the live
// chat loop below and by the approval queue when Bryce approves a pending
// action, so the two paths can never drift apart.

async function dispatchTool(env, name, input) {
  if (name === "propose_site_edit") {
    const prUrl = await proposeSiteEdit(env, input);
    await setStatus(env, { site_editor: { status: "attn", label: "Needs review", lastPublish: new Date().toISOString() } });
    await appendLog(env, { who: "Site Editor", what: `Opened PR — ${input.summary} (${prUrl})` });
    return `Pull request opened: ${prUrl}`;
  }
  if (name === "queue_edit_request") {
    const path = await queueEditRequest(env, input);
    await appendLog(env, { who: "Site Editor", what: `Queued for Claude Code — ${input.title || input.request} (${path})` });
    return `Queued at ${path}. Tell Bryce this is waiting for Claude Code, not done yet — Claude Code picks it up automatically the next time Bryce starts a session in this project, not instantly.`;
  }
  if (name === "record_monthly_finance") {
    const summary = await recordFinanceMonth(env, input);
    return `Recorded. Updated totals: revenue $${Math.round(summary.totals.revenue).toLocaleString()}, net income $${Math.round(summary.totals.netIncome).toLocaleString()}, margin ${Math.round(summary.totals.netMarginPct * 100)}%.`;
  }
  if (name === "assign_cleaner") {
    const result = await assignCleaner(env, input);
    return `Invited ${input.cleaner_name} (${result.cleanerEmail}) to the ${result.property} turnover, checkout ${result.checkout || "TBD"}. Tell Bryce it's sent, not confirmed — the cleaner still has to accept the invite.`;
  }
  if (name === "list_vault_notes") {
    const files = await listVaultNotes(env);
    return files.length ? files.join("\n") : "No notes found in Knowledge/.";
  }
  if (name === "read_vault_note") {
    return await readVaultNote(env, input.path);
  }
  if (name === "test_approval_probe") {
    return "Test probe executed — no real system was touched.";
  }
  throw new Error(`Unknown tool: ${name}`);
}

// ---- Voice: ElevenLabs text-to-speech (server-side proxy) -----------------
//
// The Worker proxies this so the API key never reaches the browser. Falls
// back to the browser's own speechSynthesis on the frontend if this isn't
// configured yet or fails — see the dashboard's speak() function.

// TODO(Bryce): swap for the real voice picked via the ElevenLabs MCP connector.
const ELEVENLABS_VOICE_ID = "hpp4J3VqNfWAUOO0d1Us"; // testing: Bella, from Bryce's ElevenLabs "My Voices"

async function elevenLabsSpeak(env, text) {
  const apiKey = await env.ELEVENLABS_API_KEY.get();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "xi-api-key": apiKey,
      "accept": "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
  return res;
}

async function handleSpeak(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = (body.text || "").toString().slice(0, 2000);
  if (!text) return json({ error: "text is required" }, { status: 400 });
  if (!env.ELEVENLABS_API_KEY) return json({ error: "ELEVENLABS_API_KEY is not bound yet" }, { status: 501 });
  try {
    const upstream = await elevenLabsSpeak(env, text);
    return new Response(upstream.body, { status: 200, headers: { "content-type": "audio/mpeg" } });
  } catch (err) {
    return json({ error: err.message }, { status: 502 });
  }
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
    tools.push({
      name: "queue_edit_request",
      description: "Cheaper alternative to propose_site_edit for a change to spotlesslhc.com or the Hermes dashboard. Instead of drafting the edit yourself right now (which costs real API tokens reading the whole file), this just writes a small task note for Claude Code to pick up and do himself the next time Bryce starts a session in this project — free, but not instant. Use this by default for any real site-editing request. Only use propose_site_edit instead if Bryce explicitly says he wants it done immediately, right now, regardless of cost.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short (under 10 words) title for the task" },
          request: { type: "string", description: "Bryce's request in his own words — as much detail as he gave you, don't summarize away specifics" },
          target: { type: "string", enum: ["website", "dashboard"], description: "Which site this is about, if known" }
        },
        required: ["title", "request"]
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
  tools.push({
    name: "assign_cleaner",
    description: "Assign a cleaner to an unassigned turnover by inviting them to the job's Google Calendar event, the same way Bryce does it himself — the cleaner then accepts or declines the invite. No approval needed; this is Scheduler's core job. If the cleaner later declines, call this again with the next cleaner to try. Runs automatically, so make sure the property matches a real unassigned reservation before calling — check current status first if unsure.",
    input_schema: {
      type: "object",
      properties: {
        property: { type: "string", description: "The property address or a distinctive part of it, e.g. \"1795 Palo Verde\" or \"206 Columbine Drive\" — only needs to contain the street number." },
        cleaner_name: { type: "string", description: "The cleaner's first name as Bryce would say it, e.g. \"Amy\" or \"Ashley\". Must match a name in the current roster." }
      },
      required: ["property", "cleaner_name"]
    }
  });
  if (env.HERMES_DEBUG_TOOLS === "true") {
    tools.push({
      name: "test_approval_probe",
      description: "Debug-only tool that does nothing real — used to test the approval-queue mechanism end to end. Not available in production.",
      input_schema: { type: "object", properties: {}, required: [] }
    });
  }

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
    const toolUses = (data.content || []).filter((b) => b.type === "tool_use");

    if (!toolUses.length) break;

    messages.push({ role: "assistant", content: data.content });

    // Claude can call more than one tool in a single turn (e.g. Deja checking
    // list_vault_notes and read_vault_note back to back). Every tool_use here
    // needs a matching tool_result in the SAME next message, or the API
    // rejects the whole conversation on the next turn \u2014 so resolve them all
    // before pushing anything back.
    const toolResults = [];
    for (const toolUse of toolUses) {
      let toolResult;
      if (APPROVAL_REQUIRED_TOOLS.has(toolUse.name)) {
        const pending = await createPendingAction(env, { tool: toolUse.name, input: toolUse.input });
        toolResult = `This requires Bryce's approval before it runs. Queued on the dashboard as pending action #${pending.id.slice(0, 8)}. Tell him plainly you're waiting on his review there \u2014 don't say it's done.`;
      } else {
        try {
          toolResult = await dispatchTool(env, toolUse.name, toolUse.input);
        } catch (err) {
          toolResult = `Failed: ${err.message}`;
        }
      }
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: toolResult });
    }

    messages.push({ role: "user", content: toolResults });
  }

  await appendLog(env, { who: "Deja", what: message.slice(0, 140) });

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

async function handlePendingList(env) {
  return json(await listPendingActions(env));
}

async function handlePendingDecide(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, { status: 400 }); }
  const { id, decision } = body || {};
  if (decision !== "approve" && decision !== "deny") {
    return json({ error: 'decision must be "approve" or "deny"' }, { status: 400 });
  }
  try {
    const record = await resolvePendingAction(env, id, decision);
    return json({ ok: true, record });
  } catch (err) {
    return json({ error: err.message }, { status: err.status || 400 });
  }
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
    if (pathname === "/api/speak" && method === "POST") {
      return handleSpeak(request, env);
    }
    if (pathname === "/api/pending" && method === "GET") {
      return handlePendingList(env);
    }
    if (pathname === "/api/pending/decide" && method === "POST") {
      return handlePendingDecide(request, env);
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
