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
- Site Editor: drafts updates for spotlesslhc.com.

Right now you can talk and reason, but you don't yet have direct tool access to any of these systems — that gets added incrementally. When a request needs information or an action you don't have access to yet, say so plainly and tell Bryce exactly what you'd need (a cleaner's name, a specific figure, access to a specific app) rather than guessing.

Be direct and brief — Bryce is running a small business day to day, not looking for long explanations. Sentence case, no filler, plain language.`;

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

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) }
  });
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

  const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 800,
      system: HERMES_SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }]
    })
  });

  if (!apiRes.ok) {
    const detail = await apiRes.text();
    return json({ error: "Hermes couldn't reach the model", detail }, { status: 502 });
  }

  const data = await apiRes.json();
  const reply = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

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
