---
title: Workflow tab — live map of every agent and app
tags: [systems, dashboard, hermes]
updated: 2026-10-02
---

# Workflow tab

`/workflow` (`public/workflow.html`) is the dashboard's second tab. It draws
each agent's real flow as a lane of steps joined by arrows, one box per
app, and glows a box while that agent is in that app: **Running** (green),
**Waiting** (amber, needs Bryce) or **Error** (red). Arrows leaving a running
step animate. The page polls `GET /api/flow` every 5s while visible.

## How the glow works

- `withActivity(env, agent, apps, detail, fn)` in `src/index.js` marks
  `<agent>:<app>` running in KV key `app_activity`, runs `fn`, then marks it
  idle, or error if it threw (or a webhook returned 5xx). Best-effort: a failed
  write never breaks the real work.
- It wraps: every cron job, every webhook, `/api/ask` (Claude), `/api/speak`
  (ElevenLabs), and every chat tool via `dispatchTool` using the
  `TOOL_ACTIVITY` map (tool name -> agent + apps).
- A "running" entry older than 5 min counts as idle (the Worker was cut off);
  errors fade after 24h or on the next success.
- **Waiting** is derived, not stored: pending approvals light the "Your
  approval" step in the Bookkeeper and Site Editor lanes; the Zapier
  Overseer's own `attn` status lights its Zapier step.
- A step glows only for its own lane's agent (matched on agent + app).

## Changing it

The lanes are the `LANES` array in `workflow.html`; edit it when a real
workflow changes (add a step, add a lane). Apps live in `APPS` there. To make
a new piece of work glow, wrap it in `withActivity` (or add its tool to
`TOOL_ACTIVITY`) using the same agent and app ids the lane uses.

Cost note: each tracked run is ~2 KV writes (start, end); the free plan allows
1,000 writes/day, shared with the Activity log.
