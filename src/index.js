// Hermes — Worker entry point.
//
// Static files in /public (the dashboard itself) are served automatically
// by Cloudflare's assets binding and never reach this script. Everything
// below only handles the dynamic routes: /api/* and /webhooks/*.

const HERMES_SYSTEM_PROMPT = `You are Deja, the dispatcher AI for Spotless Cleaning, a company in Lake Havasu City, AZ that cleans short-term-rental properties (booked through Airbnb and similar platforms, managed via Hospitable and Hostaway) between guest stays.

Bryce Wiesner owns the business and talks to you directly through his dashboard. You oversee four areas of work:
- Zapier Overseer: watches the automations that move new reservations into Google Calendar.
- Scheduler: decides which cleaner should be assigned to which turnover, and flags anything unassigned.
- Bookkeeper: tracks job income and cleaning-supply expenses in Wave.
- Site Editor: drafts updates for spotlesslhc.com and the Hermes dashboard itself, using the propose_site_edit tool.

You have seven real tools right now. For a site or dashboard edit, prefer queue_edit_request over propose_site_edit by default \u2014 it's free (Claude Code does the actual work using his own access, not this Worker's metered API key), while propose_site_edit costs real money every time since it reads the whole target file into a paid API call just to draft the change. queue_edit_request just writes a small task note for Claude Code to pick up next time Bryce starts a session in this project \u2014 tell Bryce plainly that it's queued, not done yet, and that Claude Code will get to it next time Bryce opens a session, not instantly. Only use propose_site_edit if Bryce explicitly says he wants it done immediately regardless of cost \u2014 it drafts the change itself and opens a pull request right away; still never publishes directly, Bryce still reviews and merges it himself, and you should still give him the PR link from the tool result. record_monthly_finance (Bookkeeper): records revenue and expenses for a month straight from what Bryce tells you, no approval needed since he's reporting his own numbers. assign_cleaner (Scheduler): invites a cleaner to a turnover's Google Calendar event \u2014 the same thing Bryce does by hand \u2014 and runs automatically, no approval needed. It only sends the invite; the cleaner still has to accept it, so always say "invited," never "confirmed" or "assigned" as if it's done. If Bryce mentions a cleaner declined, call it again with the next cleaner to try. list_vault_notes and read_vault_note: read-only access to the shared knowledge vault \u2014 dated notes about the business and how Hermes itself is built, including past decisions. Use list_vault_notes to see what exists and read_vault_note to read one, and ground answers about the business's history, systems, or past decisions in what's actually written there instead of guessing. If a vault note itself needs to change, use propose_site_edit (target "dashboard", path starting with "Knowledge/") so Bryce reviews it via PR like any other dashboard edit, or queue_edit_request to have Claude Code make the change directly next session (vault docs don't need a PR the way live code does). control_spotify: play, pause, skip, go back, or play a specific song on whatever device Bryce currently has Spotify open on — not a business tool, just a convenience, but it's real and runs immediately with no approval needed. If it errors because there's no active device, tell him to open Spotify somewhere first.

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

// ---- Spotify: playback control --------------------------------------------
//
// OAuth 2.0 Authorization Code flow, one-time. Bryce authorizes once via
// /api/spotify/login (opens Spotify's consent screen); the refresh token
// that comes back is stored in KV and used to mint short-lived access
// tokens for every actual playback call after that, so he never has to log
// in again unless he revokes access on Spotify's end.

const SPOTIFY_REDIRECT_URI = "https://hermes-project.spotlesscleaninglhc.workers.dev/api/spotify/callback";
const SPOTIFY_SCOPES = "user-modify-playback-state user-read-playback-state user-read-currently-playing";

async function handleSpotifyLogin(env) {
  const clientId = await env.SPOTIFY_CLIENT_ID.get();
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", SPOTIFY_REDIRECT_URI);
  url.searchParams.set("scope", SPOTIFY_SCOPES);
  return Response.redirect(url.toString(), 302);
}

async function spotifyTokenRequest(env, params) {
  const clientId = await env.SPOTIFY_CLIENT_ID.get();
  const clientSecret = await env.SPOTIFY_CLIENT_SECRET.get();
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "authorization": `Basic ${basic}`
    },
    body: new URLSearchParams(params)
  });
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function cacheSpotifyToken(env, data) {
  await env.HERMES_KV.put("spotify_access_token_cache", JSON.stringify({
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000
  }));
  if (data.refresh_token) await env.HERMES_KV.put("spotify_refresh_token", data.refresh_token);
}

async function handleSpotifyCallback(request, env) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) return new Response(`Spotify authorization failed: ${error}`, { status: 400 });
  const code = url.searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });

  const data = await spotifyTokenRequest(env, {
    grant_type: "authorization_code",
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI
  });
  await cacheSpotifyToken(env, data);
  await appendLog(env, { who: "Deja", what: "Connected to Spotify" });

  return Response.redirect("https://hermes-project.spotlesscleaninglhc.workers.dev/", 302);
}

async function getSpotifyAccessToken(env) {
  const cacheRaw = await env.HERMES_KV.get("spotify_access_token_cache");
  if (cacheRaw) {
    const cache = JSON.parse(cacheRaw);
    if (cache.expiresAt > Date.now()) return cache.token;
  }

  const refreshToken = await env.HERMES_KV.get("spotify_refresh_token");
  if (!refreshToken) throw new Error("Spotify isn't connected yet — click the Spotify tile on the dashboard to authorize it first.");

  const data = await spotifyTokenRequest(env, { grant_type: "refresh_token", refresh_token: refreshToken });
  await cacheSpotifyToken(env, data);
  return data.access_token;
}

async function spotifyApi(env, path, init = {}) {
  const token = await getSpotifyAccessToken(env);
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${token}` }
  });
  if (res.status === 204) return null;
  if (res.status === 404) throw new Error("No active Spotify device found — open Spotify on a phone, computer, or speaker first, then try again.");
  if (!res.ok) throw new Error(`Spotify API error: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function controlSpotify(env, { action, query }) {
  if (action === "play") {
    await spotifyApi(env, "/me/player/play", { method: "PUT" });
    return "Resumed playback.";
  }
  if (action === "pause") {
    await spotifyApi(env, "/me/player/pause", { method: "PUT" });
    return "Paused.";
  }
  if (action === "next") {
    await spotifyApi(env, "/me/player/next", { method: "POST" });
    return "Skipped to the next track.";
  }
  if (action === "previous") {
    await spotifyApi(env, "/me/player/previous", { method: "POST" });
    return "Went back to the previous track.";
  }
  if (action === "play_song") {
    if (!query) throw new Error('"query" is required for play_song — the song and/or artist to search for.');
    const search = await spotifyApi(env, `/search?q=${encodeURIComponent(query)}&type=track&limit=1`);
    const track = search && search.tracks && search.tracks.items && search.tracks.items[0];
    if (!track) throw new Error(`No Spotify track found matching "${query}".`);
    await spotifyApi(env, "/me/player/play", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uris: [track.uri] })
    });
    return `Playing "${track.name}" by ${track.artists.map((a) => a.name).join(", ")}.`;
  }
  throw new Error(`Unknown Spotify action: ${action}`);
}

// ---- Turno property (2211 Sahara Drive): automatic cleaner assignment ----
//
// Unlike Bryce's other properties, this one is managed by its owner
// ("Urlaub Properties") on their own Hospitable account — Bryce isn't on
// that integration, just gets an emailed notification per reservation
// (forwarded to a Zapier Email Parser mailbox, see
// Knowledge/unfinished-projects/turno-property-zapier-buildout.md). The
// cascade + same-day-conflict postponement logic below is genuinely
// branchy, so it lives here as real code instead of a maze of Zapier
// Paths — which is also why this needed its own Google Calendar OAuth
// connection (Deja's other calendar actions all reuse Zapier's
// already-authenticated connection instead).
//
// Google's policy for an unverified OAuth app requesting a sensitive
// scope (the calendar scope is sensitive) caps refresh tokens at 7 days.
// Full verification removes that cap but needs a public privacy policy
// and a review; not done yet. Until then, Bryce needs to re-visit the
// "Connect Google Calendar" dashboard tile roughly weekly, or this stops
// working silently. Flagged in the vault as a real follow-up.

const GOOGLE_CALENDAR_REDIRECT_URI = "https://hermes-project.spotlesscleaninglhc.workers.dev/api/google-calendar/callback";
// calendar.events alone can't list the account's calendars (needed to find
// the "Cleans" calendar by name) -- confirmed via a real 403
// insufficientPermissions/ACCESS_TOKEN_SCOPE_INSUFFICIENT error on
// calendarList.list. The plain "calendar" scope covers both listing
// calendars and reading/writing events.
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const TURNO_PROPERTY_ADDRESS = "2211 Sahara Drive";
const TURNO_PROPERTY_LOCATION = "2211 Sahara Dr";
const CLEANS_TIME_ZONE = "America/Phoenix";
// Peacock = no same-day check-in. Bryce switches a clean to Basil (10) by hand
// when its description says "Same day checkin"; a new reservation email can't
// tell us that, since it depends on the next guest.
const CLEANS_COLOR_NO_SAME_DAY_CHECKIN = "7";
const TURNO_CLEANER_CASCADE = ["amy", "ashley"];
const TURNO_MAX_POSTPONE_DAYS = 2;

async function handleGoogleCalendarLogin(env) {
  const clientId = await env.GOOGLE_CALENDAR_CLIENT_ID.get();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", GOOGLE_CALENDAR_REDIRECT_URI);
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return Response.redirect(url.toString(), 302);
}

async function googleCalendarTokenRequest(env, params) {
  const clientId = await env.GOOGLE_CALENDAR_CLIENT_ID.get();
  const clientSecret = await env.GOOGLE_CALENDAR_CLIENT_SECRET.get();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, client_id: clientId, client_secret: clientSecret })
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function cacheGoogleCalendarToken(env, data) {
  await env.HERMES_KV.put("google_calendar_access_token_cache", JSON.stringify({
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000
  }));
  if (data.refresh_token) await env.HERMES_KV.put("google_calendar_refresh_token", data.refresh_token);
}

async function handleGoogleCalendarCallback(request, env) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) return new Response(`Google Calendar authorization failed: ${error}`, { status: 400 });
  const code = url.searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });

  const data = await googleCalendarTokenRequest(env, {
    grant_type: "authorization_code",
    code,
    redirect_uri: GOOGLE_CALENDAR_REDIRECT_URI
  });
  await cacheGoogleCalendarToken(env, data);
  await appendLog(env, { who: "Scheduler", what: "Connected to Google Calendar for the Turno property automation" });

  return Response.redirect("https://hermes-project.spotlesscleaninglhc.workers.dev/", 302);
}

async function getGoogleCalendarAccessToken(env) {
  const cacheRaw = await env.HERMES_KV.get("google_calendar_access_token_cache");
  if (cacheRaw) {
    const cache = JSON.parse(cacheRaw);
    if (cache.expiresAt > Date.now()) return cache.token;
  }
  const refreshToken = await env.HERMES_KV.get("google_calendar_refresh_token");
  if (!refreshToken) throw new Error("Google Calendar isn't connected yet — click the Connect Google Calendar tile on the dashboard.");
  const data = await googleCalendarTokenRequest(env, { grant_type: "refresh_token", refresh_token: refreshToken });
  await cacheGoogleCalendarToken(env, data);
  return data.access_token;
}

async function googleCalendarApi(env, path, init = {}) {
  const token = await getGoogleCalendarAccessToken(env);
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status} ${await res.text()}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getCleansCalendarId(env) {
  const cached = await env.HERMES_KV.get("cleans_calendar_id");
  if (cached) return cached;
  const list = await googleCalendarApi(env, "/users/me/calendarList");
  const match = (list.items || []).find((c) => (c.summary || "").trim().toLowerCase() === "cleans");
  if (!match) throw new Error('No calendar named "Cleans" found on this Google account.');
  await env.HERMES_KV.put("cleans_calendar_id", match.id);
  return match.id;
}

// Parses the raw forwarded-email body/subject Zapier's Email Parser hands
// back. Regexed directly off the raw text rather than the Parser's
// highlight-a-field UI, which proved too fragile to drag-select precisely
// — see Knowledge/agent-notes/browser-automation-notes.md.
function parseTurnoReservationEmail(text) {
  const checkinMatch = text.match(/Check-in\s*:\s*([^\n]+)/i);
  const checkoutMatch = text.match(/Check-out\s*:\s*([^\n]+)/i);
  const codeMatch = text.match(/Reservation code:\s*(\S+)/i);
  if (!checkinMatch) throw new Error("Couldn't find a Check-in line in the reservation email.");

  const checkinDate = parseHospitableDate(checkinMatch[1].trim());
  const checkoutDate = checkoutMatch ? parseHospitableDate(checkoutMatch[1].trim()) : null;
  return {
    checkinDate,
    checkoutDate,
    reservationCode: codeMatch ? codeMatch[1].trim() : null
  };
}

// Hospitable's dates have no year, e.g. "Friday, October 23 at 4:00 PM" —
// assume the current year, then roll to next year if that's already more
// than a month in the past (handles reservations parsed near New Year's).
function parseHospitableDate(text) {
  const cleaned = text.replace(/^[A-Za-z]+,\s*/, "").replace(/\s*at\s*/, " ");
  const now = new Date();
  let date = new Date(`${cleaned} ${now.getFullYear()}`);
  if (isNaN(date.getTime())) throw new Error(`Couldn't parse date: "${text}"`);
  if (date.getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000) {
    date = new Date(`${cleaned} ${now.getFullYear() + 1}`);
  }
  return date;
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function isCleanerBusyOnDate(env, calendarId, cleanerEmail, dateOnly) {
  const timeMin = `${dateOnly}T00:00:00Z`;
  const timeMax = `${dateOnly}T23:59:59Z`;
  const data = await googleCalendarApi(
    env,
    `/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`
  );
  return (data.items || []).some((event) => {
    if (event.status === "cancelled") return false;
    return (event.attendees || []).some((a) => a.email === cleanerEmail && a.responseStatus !== "declined");
  });
}

// Before postponing, make sure a later guest isn't already due to check
// in — if so, this turnover can't slip without risking an unready house.
async function hasUpcomingCheckinNearby(env, calendarId, fromDateExclusive, throughDate) {
  const timeMin = `${toDateOnly(addDays(fromDateExclusive, 1))}T00:00:00Z`;
  const timeMax = `${toDateOnly(throughDate)}T23:59:59Z`;
  const data = await googleCalendarApi(
    env,
    `/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&q=${encodeURIComponent(TURNO_PROPERTY_ADDRESS)}`
  );
  return (data.items || []).some((event) => event.status !== "cancelled");
}

// Bryce's cleans are timed 10am-4pm single-day events on the checkout date.
function cleanWindow(dateOnly) {
  return {
    start: { dateTime: `${dateOnly}T10:00:00`, timeZone: CLEANS_TIME_ZONE },
    end: { dateTime: `${dateOnly}T16:00:00`, timeZone: CLEANS_TIME_ZONE }
  };
}

async function listPropertyEvents(env, calendarId, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    q: TURNO_PROPERTY_ADDRESS,
    maxResults: "250"
  });
  const data = await googleCalendarApi(env, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  return (data.items || []).filter((e) => e.status !== "cancelled" && (e.summary || "").includes(TURNO_PROPERTY_ADDRESS));
}

// The description (door code, supply codes, pay) is copied from the most
// recent existing clean rather than hardcoded: the repo is public, and this
// way it stays current whenever Bryce edits it on the calendar.
async function getTurnoDescriptionTemplate(env, calendarId) {
  const now = new Date();
  const events = await listPropertyEvents(env, calendarId, addDays(now, -180).toISOString(), addDays(now, 60).toISOString());
  const latest = events.filter((e) => e.description).pop();
  return latest ? latest.description.replace(/\n*Same day checkin\s*$/i, "") : "";
}

async function findOrCreateTurnoEvent(env, calendarId, { dateOnly, reservationCode }) {
  const key = `turno_event:${reservationCode}`;
  const existingId = await env.HERMES_KV.get(key);
  if (existingId) {
    const event = await googleCalendarApi(env, `/calendars/${encodeURIComponent(calendarId)}/events/${existingId}`);
    if (!(event.start?.dateTime || event.start?.date || "").startsWith(dateOnly)) {
      return googleCalendarApi(env, `/calendars/${encodeURIComponent(calendarId)}/events/${existingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cleanWindow(dateOnly))
      });
    }
    return event;
  }

  // Reuse a clean Bryce (or a backfill) already put on the calendar that day.
  const sameDay = await listPropertyEvents(env, calendarId, `${dateOnly}T00:00:00-07:00`, `${dateOnly}T23:59:59-07:00`);
  if (sameDay.length) {
    await env.HERMES_KV.put(key, sameDay[0].id);
    return sameDay[0];
  }

  const created = await googleCalendarApi(env, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      summary: TURNO_PROPERTY_ADDRESS,
      location: TURNO_PROPERTY_LOCATION,
      description: await getTurnoDescriptionTemplate(env, calendarId),
      colorId: CLEANS_COLOR_NO_SAME_DAY_CHECKIN,
      ...cleanWindow(dateOnly)
    })
  });
  await env.HERMES_KV.put(key, created.id);
  return created;
}

async function inviteCleanerToEvent(env, calendarId, event, cleanerEmail) {
  const attendees = (event.attendees || []).filter((a) => a.email !== cleanerEmail);
  attendees.push({ email: cleanerEmail });
  return googleCalendarApi(
    env,
    `/calendars/${encodeURIComponent(calendarId)}/events/${event.id}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attendees })
    }
  );
}

// Every property already has its own Wave customer and its own catalog
// item (with its rate already set) -- Bryce was explicit that invoicing
// must find these existing records by name and never create new ones,
// since duplicates would fragment his real customer/item history. Both
// lookups pull the full list and match client-side (Wave's customers/
// products queries don't support filtering by name server-side).
async function findWaveCustomerByName(env, name) {
  const businessId = await getWaveBusinessId(env);
  const data = await waveGraphQL(env, `query($businessId: ID!) {
    business(id: $businessId) { customers(page: 1, pageSize: 200) { edges { node { id name } } } }
  }`, { businessId });
  const edges = (data.business && data.business.customers && data.business.customers.edges) || [];
  const match = edges.find((e) => e.node.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (!match) throw new Error(`No existing Wave customer named "${name}" — refusing to create a new one.`);
  return match.node.id;
}

async function findWaveProductByName(env, name) {
  const businessId = await getWaveBusinessId(env);
  const data = await waveGraphQL(env, `query($businessId: ID!) {
    business(id: $businessId) { products(page: 1, pageSize: 300) { edges { node { id name unitPrice } } } }
  }`, { businessId });
  const edges = (data.business && data.business.products && data.business.products.edges) || [];
  const match = edges.find((e) => e.node.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (!match) throw new Error(`No existing Wave item named "${name}" — refusing to create a new one.`);
  return match.node;
}

// Leaves unitPrice unset on the item so Wave applies the item's own
// already-configured rate, rather than this code guessing or hardcoding one.
// Dated on the cleaning date (Bryce's rule) and left as a DRAFT, matching the
// Zapier-created invoices, so a cancellation can still delete it cleanly.
async function createWaveInvoiceForProperty(env, { customerName, productName, invoiceDate }) {
  const businessId = await getWaveBusinessId(env);
  const customerId = await findWaveCustomerByName(env, customerName);
  const product = await findWaveProductByName(env, productName);
  const data = await waveGraphQL(env, `mutation($input: InvoiceCreateInput!) {
    invoiceCreate(input: $input) { didSucceed inputErrors { message code path } invoice { id } }
  }`, {
    input: {
      businessId,
      customerId,
      status: "DRAFT",
      invoiceDate,
      items: [{ productId: product.id, quantity: 1 }]
    }
  });
  const result = data.invoiceCreate;
  if (!result.didSucceed) throw new Error(`Wave invoice creation failed: ${JSON.stringify(result.inputErrors)}`);
  return result.invoice.id;
}

async function getWaveInvoiceStatus(env, invoiceId) {
  const businessId = await getWaveBusinessId(env);
  const data = await waveGraphQL(env, `query($businessId: ID!, $invoiceId: ID!) {
    business(id: $businessId) { invoice(id: $invoiceId) { id status } }
  }`, { businessId, invoiceId });
  return data.business && data.business.invoice ? data.business.invoice.status : null;
}

async function deleteWaveInvoice(env, invoiceId) {
  const data = await waveGraphQL(env, `mutation($input: InvoiceDeleteInput!) {
    invoiceDelete(input: $input) { didSucceed inputErrors { message } }
  }`, { input: { invoiceId } });
  if (!data.invoiceDelete.didSucceed) throw new Error(`Wave invoice delete failed: ${JSON.stringify(data.invoiceDelete.inputErrors)}`);
}

const TURNO_WAVE_CUSTOMER_NAME = "Sparks";

async function assignTurnoCleaning(env, { checkoutDate, reservationCode }) {
  if (!checkoutDate) throw new Error("Couldn't find a Check-out line in the reservation email — the clean happens on the checkout date.");
  const calendarId = await getCleansCalendarId(env);
  const roster = await getCleanerRoster(env);

  let candidateDate = checkoutDate;
  for (let postponeCount = 0; postponeCount <= TURNO_MAX_POSTPONE_DAYS; postponeCount++) {
    const dateOnly = toDateOnly(candidateDate);
    for (const name of TURNO_CLEANER_CASCADE) {
      const email = roster[name];
      if (!email) continue;
      const busy = await isCleanerBusyOnDate(env, calendarId, email, dateOnly);
      if (!busy) {
        const event = await findOrCreateTurnoEvent(env, calendarId, { dateOnly, reservationCode });
        await inviteCleanerToEvent(env, calendarId, event, email);
        const note = postponeCount > 0 ? ` (postponed ${postponeCount} day${postponeCount > 1 ? "s" : ""} from the checkout date — both other cleaners were already booked)` : "";
        await appendLog(env, { who: "Scheduler", what: `Invited ${name} to clean ${TURNO_PROPERTY_ADDRESS} on ${dateOnly}${note}` });

        await env.HERMES_KV.put(`turno_date:${dateOnly}`, reservationCode);
        await env.HERMES_KV.put(`turno_clean_date:${reservationCode}`, dateOnly);

        let invoiceId = null;
        try {
          invoiceId = await createWaveInvoiceForProperty(env, {
            customerName: TURNO_WAVE_CUSTOMER_NAME,
            productName: TURNO_PROPERTY_ADDRESS,
            invoiceDate: dateOnly
          });
          await env.HERMES_KV.put(`turno_invoice:${reservationCode}`, invoiceId);
          await appendLog(env, { who: "Bookkeeper", what: `Created draft Wave invoice for ${TURNO_PROPERTY_ADDRESS} dated ${dateOnly} (reservation ${reservationCode})` });
        } catch (err) {
          await appendLog(env, { who: "Bookkeeper", what: `Couldn't create the Wave invoice for ${TURNO_PROPERTY_ADDRESS} (reservation ${reservationCode}): ${err.message}. Cleaner is still invited — this just needs a manual invoice.` });
        }

        return { cleaner: name, email, date: dateOnly, postponed: postponeCount, invoiceId };
      }
    }
    // Everyone in the cascade is already booked that day.
    if (postponeCount >= TURNO_MAX_POSTPONE_DAYS) break;
    const blocked = await hasUpcomingCheckinNearby(env, calendarId, candidateDate, addDays(candidateDate, TURNO_MAX_POSTPONE_DAYS - postponeCount));
    if (blocked) break;
    candidateDate = addDays(candidateDate, 1);
  }

  await appendLog(env, { who: "Scheduler", what: `Couldn't auto-assign a cleaner for ${TURNO_PROPERTY_ADDRESS} (reservation ${reservationCode}) — both cleaners booked and no safe day to postpone to. Needs manual attention.` });
  throw new Error("Both cleaners are already booked and there's no safe day to postpone to (an upcoming check-in blocks it). Needs manual assignment.");
}

function isGoneError(err) {
  return /API error: (404|410)\b/.test(err.message);
}

// Undoes a Turno clean: deletes its calendar event (notifying any invited
// cleaner) and its Wave invoice, but only while the invoice is still a DRAFT
// — anything already sent or paid is left for Bryce to handle.
async function cancelTurnoClean(env, { reservationCode, date }) {
  const code = reservationCode || (date ? await env.HERMES_KV.get(`turno_date:${date}`) : null);
  const calendarId = await getCleansCalendarId(env);
  const done = [];
  const leftForBryce = [];

  let eventId = code ? await env.HERMES_KV.get(`turno_event:${code}`) : null;
  if (!eventId && date) {
    const events = await listPropertyEvents(env, calendarId, `${date}T00:00:00-07:00`, `${date}T23:59:59-07:00`);
    if (events.length === 1) eventId = events[0].id;
    else if (events.length > 1) leftForBryce.push(`there are ${events.length} Sahara cleans on ${date}, so none were removed`);
  }
  if (eventId) {
    try {
      await googleCalendarApi(env, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=all`, { method: "DELETE" });
      done.push("removed the calendar event");
    } catch (err) {
      if (!isGoneError(err)) throw err;
      done.push("the calendar event was already gone");
    }
  } else if (!leftForBryce.length) {
    leftForBryce.push("no matching calendar event was found");
  }

  const invoiceId = code ? await env.HERMES_KV.get(`turno_invoice:${code}`) : null;
  if (invoiceId) {
    const status = await getWaveInvoiceStatus(env, invoiceId);
    if (status === "DRAFT") {
      await deleteWaveInvoice(env, invoiceId);
      done.push("deleted the draft Wave invoice");
    } else if (status) {
      leftForBryce.push(`the Wave invoice is already ${status}, so it was left alone`);
    } else {
      done.push("the Wave invoice was already gone");
    }
  } else {
    leftForBryce.push("no invoice is on record for it, so check Wave by hand");
  }

  const cleanDate = date || (code ? await env.HERMES_KV.get(`turno_clean_date:${code}`) : null);
  if (code) {
    await env.HERMES_KV.delete(`turno_event:${code}`);
    await env.HERMES_KV.delete(`turno_invoice:${code}`);
    await env.HERMES_KV.delete(`turno_clean_date:${code}`);
  }
  if (cleanDate) await env.HERMES_KV.delete(`turno_date:${cleanDate}`);

  const label = code ? `reservation ${code}` : date;
  const summary = `Cancelled ${TURNO_PROPERTY_ADDRESS} clean (${label}): ${done.join("; ") || "nothing to remove"}` +
    (leftForBryce.length ? `. Needs Bryce: ${leftForBryce.join("; ")}.` : ".");
  await appendLog(env, { who: "Scheduler", what: summary });
  return summary;
}

async function handleTurnoReservationWebhook(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, { status: 400 }); }
  const emailText = [body.subject, body.body_plain, body.body].filter(Boolean).join("\n");
  if (!emailText) return json({ error: "Expected subject and/or body_plain in the webhook payload" }, { status: 400 });

  // No cancellation email has been seen yet; this assumes Hospitable would
  // put "cancel" in the subject and still include the reservation code.
  if (/cancel/i.test(body.subject || "")) {
    const codeMatch = emailText.match(/Reservation code:\s*(\S+)/i) || emailText.match(/\b(HM[A-Z0-9]{8})\b/);
    if (!codeMatch) {
      await appendLog(env, { who: "Scheduler", what: `Got a ${TURNO_PROPERTY_ADDRESS} cancellation email but couldn't find a reservation code in it. Needs manual cleanup.` });
      return json({ error: "Cancellation email had no reservation code" }, { status: 422 });
    }
    try {
      return json({ ok: true, cancelled: await cancelTurnoClean(env, { reservationCode: codeMatch[1] }) });
    } catch (err) {
      return json({ error: err.message }, { status: 500 });
    }
  }

  try {
    const parsed = parseTurnoReservationEmail(emailText);
    const result = await assignTurnoCleaning(env, parsed);
    return json({ ok: true, ...result });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}

// ---- Payroll: what's owed to each 1099 cleaner ----------------------------
//
// Phase 1 (this section): track what's owed per cleaner and let Bryce record
// a payment he already made outside this system (Venmo/Zelle/Cash App) --
// no money actually moves. Phase 2, once this proves reliable, is having
// Deja send the payment herself; deferred because Venmo/Zelle/Cash App have
// no public API for a business to push money to an individual
// programmatically -- that needs real research (Wave's own bill-pay, or a
// bank ACH API) before it can be built, not just a code change.
//
// "Owed" is computed fresh from the Cleans calendar every time, not stored:
// for each past (already-happened) event where this cleaner is an attendee
// who accepted the invite, pull the "Pay is $X" dollar amount out of the
// description and sum everything after their last-paid-through date. This
// mirrors how Bryce already writes each job's pay rate on the calendar
// event itself (see [[scheduler]]), so there's no second source of truth to
// keep in sync.
//
// Recording a payment moves paid-through forward and appends a permanent
// record -- it never deletes or edits history, so "what did I pay Amy on
// any given date" stays answerable later.

// No job on the calendar before this date was tracked by this system, so a
// cleaner's owed total starts counting from here the first time they're
// looked up, not from whenever they started cleaning for Bryce -- otherwise
// this would immediately claim he owes for jobs he already paid by hand
// before payroll tracking existed.
const PAYROLL_TRACKING_START = "2026-09-26";

function parsePayFromDescription(description) {
  const match = (description || "").match(/Pay is\s*\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  return match ? parseFloat(match[1].replace(/,/g, "")) : null;
}

// Strips a leading house number off a calendar event title ("2211 Sahara
// Drive" -> "Sahara Drive"). Bryce's rule: a Venmo payment note must never
// include the full address, since some of his Venmo transactions are
// public -- the street name alone doesn't identify which house on it.
// Titles with no leading number (e.g. "Unit 324") are left as-is.
function streetNameOnly(title) {
  const match = (title || "").trim().match(/^\d+\s+(.*)/);
  return match ? match[1].trim() : (title || "").trim();
}

// One line per house per date, e.g. "Sahara Drive 9/27, Columbine Drive 9/29"
// -- what street, and when, for every house covered by this payment.
function formatPayrollNote(jobs) {
  return jobs
    .map((job) => {
      const [, m, d] = job.date.split("-");
      return `${streetNameOnly(job.property)} ${parseInt(m, 10)}/${parseInt(d, 10)}`;
    })
    .join(", ");
}

async function getCleanerPaidThrough(env, cleanerKey) {
  const stored = await env.HERMES_KV.get(`payroll:paid_through:${cleanerKey}`);
  return stored || PAYROLL_TRACKING_START;
}

// Every completed (start time in the past), non-cancelled event this
// cleaner accepted, from the day after paidThrough up through yesterday --
// today's jobs aren't "completed" yet, so they're deliberately excluded.
async function listCompletedJobsForCleaner(env, calendarId, cleanerEmail, paidThrough) {
  // paidThrough is inclusive -- a job ON that date was already covered by
  // the payment that set it, so counting starts the day after.
  const rangeStart = toDateOnly(addDays(new Date(`${paidThrough}T00:00:00Z`), 1));
  const timeMin = `${rangeStart}T00:00:01-07:00`;
  const timeMax = `${toDateOnly(addDays(new Date(), -1))}T23:59:59-07:00`;
  if (timeMin >= `${timeMax}`) return [];
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const data = await googleCalendarApi(env, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  return (data.items || [])
    .filter((e) => e.status !== "cancelled")
    .filter((e) => (e.attendees || []).some((a) => a.email === cleanerEmail && a.responseStatus === "accepted"))
    .map((e) => ({
      date: (e.start?.dateTime || e.start?.date || "").slice(0, 10),
      property: e.summary,
      pay: parsePayFromDescription(e.description)
    }))
    .filter((job) => job.pay !== null);
}

async function getCleanerPayrollSummary(env, cleanerKey) {
  const roster = await getCleanerRoster(env);
  const email = roster[cleanerKey];
  if (!email) throw new Error(`Unknown cleaner "${cleanerKey}". Known cleaners: ${Object.keys(roster).join(", ") || "(none configured)"}.`);
  const calendarId = await getCleansCalendarId(env);
  const paidThrough = await getCleanerPaidThrough(env, cleanerKey);
  const jobs = await listCompletedJobsForCleaner(env, calendarId, email, paidThrough);
  const owed = jobs.reduce((sum, job) => sum + job.pay, 0);
  return { cleaner: cleanerKey, email, paidThrough, owed, jobCount: jobs.length, jobs, paymentNote: formatPayrollNote(jobs) };
}

async function getAllCleanerPayrollSummaries(env) {
  const roster = await getCleanerRoster(env);
  const summaries = {};
  for (const cleanerKey of Object.keys(roster)) {
    summaries[cleanerKey] = await getCleanerPayrollSummary(env, cleanerKey);
  }
  return summaries;
}

const PAYMENT_INDEX_KEY = "payroll_payment_index";

// Same lazy-index pattern as the approval queue's PENDING_INDEX_KEY, so
// reading payment history never needs a KV list() call (see the comment
// above PENDING_INDEX_KEY for why that matters).
async function addToPaymentIndex(env, id) {
  const raw = await env.HERMES_KV.get(PAYMENT_INDEX_KEY);
  const ids = raw ? JSON.parse(raw) : [];
  ids.push(id);
  await env.HERMES_KV.put(PAYMENT_INDEX_KEY, JSON.stringify(ids));
}

// Records a payment Bryce already made outside this system. Moves
// paid-through forward to `date` regardless of whether `amount` matches
// the computed owed total -- Bryce might round, or pay a different amount
// on purpose -- but the mismatch (if any) is reported back so he notices.
async function recordCleanerPayment(env, { cleaner_name, amount, date }) {
  const cleanerKey = cleaner_name.trim().toLowerCase();
  const before = await getCleanerPayrollSummary(env, cleanerKey);
  const paidOn = date || toDateOnly(new Date());

  const record = {
    id: crypto.randomUUID(),
    cleaner: cleanerKey,
    amount,
    date: paidOn,
    jobsCovered: before.jobCount,
    note: before.paymentNote,
    recordedAt: new Date().toISOString()
  };
  await env.HERMES_KV.put(`payroll_payment:${record.id}`, JSON.stringify(record));
  await addToPaymentIndex(env, record.id);
  await env.HERMES_KV.put(`payroll:paid_through:${cleanerKey}`, paidOn);

  const mismatch = Math.abs(amount - before.owed) > 0.01
    ? ` (computed owed was $${before.owed.toFixed(2)} for ${before.jobCount} job${before.jobCount === 1 ? "" : "s"} -- flagging the difference, not blocking it)`
    : "";
  await appendLog(env, { who: "Bookkeeper", what: `Recorded $${amount.toFixed(2)} paid to ${cleaner_name} through ${paidOn}${mismatch}` });

  return { ...record, previouslyOwed: before.owed, mismatch: mismatch !== "" };
}

// Runs weekly (see the "crons" trigger in wrangler.jsonc). Doesn't send or
// prepare anything itself -- it just posts a nudge to the Activity log so
// Bryce knows a payroll run is ready next time he brings Claude online.
// Nothing to clear or track between runs: "owed" is always computed live
// from the calendar, so it's automatically zero again once actually paid.
async function runWeeklyPayrollCheck(env) {
  const summaries = await getAllCleanerPayrollSummaries(env);
  const owedLines = Object.values(summaries)
    .filter((s) => s.owed > 0)
    .map((s) => `${s.cleaner}: $${s.owed.toFixed(2)} (${s.jobCount} job${s.jobCount === 1 ? "" : "s"})`);

  const what = owedLines.length
    ? `Weekly payroll ready — ${owedLines.join("; ")}. Bring Claude online to send it (Bryce confirms each payment in his own browser).`
    : "Weekly payroll check: nothing owed to any cleaner right now.";
  await appendLog(env, { who: "Bookkeeper", what });
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
// A tool that touches money, sends something externally, or changes
// real-world state is gated by adding its name to APPROVAL_REQUIRED_TOOLS
// below, instead of inventing a new safety mechanism each time
// (propose_site_edit already has its own GitHub-PR review gate). Approval only ever happens via the dashboard's
// Approve/Deny buttons, never by chat/voice reply.

const APPROVAL_REQUIRED_TOOLS = new Set(["cancel_turno_clean"]);

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

// This Wave account actually has two businesses on it -- "Personal" and
// "Spotless Cleaning" -- and picking edges[0] silently grabbed "Personal"
// (empty: 0 customers, 0 products) instead of the real one. Match by name
// explicitly rather than trusting list order.
const WAVE_BUSINESS_NAME = "Spotless Cleaning";

async function getWaveBusinessId(env) {
  const cached = await env.HERMES_KV.get("wave:business_id");
  if (cached) return cached;
  const data = await waveGraphQL(env, `query { businesses { edges { node { id name } } } }`);
  const edges = data.businesses?.edges || [];
  const match = edges.find((e) => e.node.name === WAVE_BUSINESS_NAME) || edges[0];
  const id = match?.node?.id;
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
      body: `Requested by Bryce via Deja.\n\n**Instructions:** ${instructions}\n\nReview the diff and merge if it looks right, or close it and tell Deja what to change.`
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
  if (name === "cancel_turno_clean") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || "")) throw new Error("date must be YYYY-MM-DD");
    return await cancelTurnoClean(env, { date: input.date });
  }
  if (name === "get_cleaner_payroll") {
    const summaries = input.cleaner_name
      ? { [input.cleaner_name.trim().toLowerCase()]: await getCleanerPayrollSummary(env, input.cleaner_name.trim().toLowerCase()) }
      : await getAllCleanerPayrollSummaries(env);
    return JSON.stringify(summaries);
  }
  if (name === "record_cleaner_payment") {
    if (typeof input.amount !== "number" || input.amount <= 0) throw new Error("amount must be a positive number");
    const record = await recordCleanerPayment(env, input);
    const mismatchNote = record.mismatch ? ` Heads up: the amount computed from completed jobs was $${record.previouslyOwed.toFixed(2)}, not $${input.amount.toFixed(2)} -- tell Bryce this in case it wasn't intentional.` : "";
    return `Recorded $${input.amount.toFixed(2)} paid to ${input.cleaner_name} through ${record.date}.${mismatchNote}`;
  }
  if (name === "list_vault_notes") {
    const files = await listVaultNotes(env);
    return files.length ? files.join("\n") : "No notes found in Knowledge/.";
  }
  if (name === "read_vault_note") {
    return await readVaultNote(env, input.path);
  }
  if (name === "control_spotify") {
    return await controlSpotify(env, input);
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
  tools.push({
    name: "get_cleaner_payroll",
    description: "Look up how much is currently owed to one or all 1099 cleaners, computed from completed (past) cleanings on the Cleans calendar since they were last paid. No approval needed, read-only.",
    input_schema: {
      type: "object",
      properties: {
        cleaner_name: { type: "string", description: "A specific cleaner's first name, e.g. \"Amy\". Omit to get everyone in the roster." }
      },
      required: []
    }
  });
  tools.push({
    name: "record_cleaner_payment",
    description: "Record that Bryce already paid a cleaner (via Venmo, Zelle, Cash App, etc.) -- this does NOT send any money, it just logs that he did and moves their owed total forward. Use when Bryce tells you he paid someone, e.g. \"I paid Amy $480\". No approval needed, since this is Bryce reporting his own action, not something being inferred.",
    input_schema: {
      type: "object",
      properties: {
        cleaner_name: { type: "string", description: "The cleaner's first name, e.g. \"Amy\"." },
        amount: { type: "number", description: "The dollar amount actually paid." },
        date: { type: "string", description: "The date paid, as YYYY-MM-DD. Defaults to today if not given." }
      },
      required: ["cleaner_name", "amount"]
    }
  });
  tools.push({
    name: "cancel_turno_clean",
    description: "Undo a cancelled 2211 Sahara Drive (Turno) clean: removes its Cleans calendar event (notifying any invited cleaner) and deletes its Wave invoice if that's still a draft. Use when Bryce says a Sahara reservation or clean was cancelled. Requires Bryce's approval on the dashboard before it runs.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "The date of the cancelled clean, as YYYY-MM-DD." }
      },
      required: ["date"]
    }
  });
  if (env.SPOTIFY_CLIENT_ID) {
    tools.push({
      name: "control_spotify",
      description: "Control Spotify playback on whatever device is currently active (phone, computer, speaker) — play, pause, skip forward, skip back, or search for and play a specific song. No approval needed, fully reversible. If there's no active device, Spotify needs to be open somewhere first — tell Bryce that plainly rather than retrying.",
      input_schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["play", "pause", "next", "previous", "play_song"], description: "What to do. Use \"play_song\" with a query to search for and start a specific track; the others act on whatever's already loaded." },
          query: { type: "string", description: "Song and/or artist to search for — required for, and only used by, play_song, e.g. \"Blinding Lights The Weeknd\"." }
        },
        required: ["action"]
      }
    });
  }
  if (env.HERMES_DEBUG_TOOLS === "true") {
    tools.push({
      name: "test_approval_probe",
      description: "Debug-only tool that does nothing real — used to test the approval-queue mechanism end to end. Not available in production.",
      input_schema: { type: "object", properties: {}, required: [] }
    });
  }

  const messages = [{ role: "user", content: message }];
  let reply = "";
  let toolFailed = false;

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
      return json({ error: "Deja couldn't reach the model", detail }, { status: 502 });
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
          toolFailed = true;
        }
      }
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: toolResult });
    }

    messages.push({ role: "user", content: toolResults });
  }

  await appendLog(env, { who: "Deja", what: message.slice(0, 140) });

  // Tells the dashboard's voice UI whether to keep the mic open for a
  // follow-up (a tool failed, or Deja's reply is a question needing an
  // answer) versus closing it after a plain "done" confirmation. This is
  // a heuristic on the finished text, not something the model states
  // explicitly — good enough for real phrasing, imperfect for a reply
  // that needs a follow-up but happens not to end in "?".
  const keepListening = toolFailed || /\?\s*$/.test(reply.trim());

  return json({ reply, keepListening });
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
    if (pathname === "/api/spotify/login" && method === "GET") {
      return handleSpotifyLogin(env);
    }
    if (pathname === "/api/spotify/callback" && method === "GET") {
      return handleSpotifyCallback(request, env);
    }
    if (pathname === "/api/google-calendar/login" && method === "GET") {
      return handleGoogleCalendarLogin(env);
    }
    if (pathname === "/api/google-calendar/callback" && method === "GET") {
      return handleGoogleCalendarCallback(request, env);
    }
    if (pathname === "/webhooks/turno-reservation" && method === "POST") {
      return handleTurnoReservationWebhook(request, env);
    }
    if (pathname === "/api/google-calendar/status" && method === "GET") {
      try {
        const calendarId = await getCleansCalendarId(env);
        return json({ connected: true, calendarId });
      } catch (err) {
        return json({ connected: false, error: err.message }, { status: 502 });
      }
    }
    if (pathname === "/api/payroll" && method === "GET") {
      try {
        return json(await getAllCleanerPayrollSummaries(env));
      } catch (err) {
        return json({ error: err.message }, { status: 502 });
      }
    }
    if (pathname === "/api/payroll/pay" && method === "POST") {
      try {
        const body = await request.json();
        if (!body.cleaner_name || typeof body.amount !== "number" || body.amount <= 0) {
          return json({ error: "cleaner_name and a positive amount are required" }, { status: 400 });
        }
        const record = await recordCleanerPayment(env, body);
        return json({ ok: true, record });
      } catch (err) {
        return json({ error: err.message }, { status: 400 });
      }
    }
    if (pathname === "/api/wave/status" && method === "GET") {
      try {
        const [customerId, product] = await Promise.all([
          findWaveCustomerByName(env, TURNO_WAVE_CUSTOMER_NAME),
          findWaveProductByName(env, TURNO_PROPERTY_ADDRESS)
        ]);
        return json({ connected: true, customerId, productId: product.id, unitPrice: product.unitPrice });
      } catch (err) {
        return json({ connected: false, error: err.message }, { status: 502 });
      }
    }
    // Anything else falls back to the static files in /public (this
    // shouldn't normally be needed — Cloudflare usually serves matching
    // assets before the Worker even runs — but it's a safety net).
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runWeeklyPayrollCheck(env));
  }
};
