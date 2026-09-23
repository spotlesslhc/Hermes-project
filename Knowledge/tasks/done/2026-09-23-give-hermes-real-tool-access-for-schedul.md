---
title: Give Hermes real tool access for Scheduler/Zapier
requested: 2026-09-23T08:01:56.792Z
target: dashboard
status: done
pr: https://github.com/spotlesslhc/Hermes-project/pull/new/task/scheduler-assign-cleaner
---

# Give Hermes real tool access for Scheduler/Zapier

Requested by Bryce via Deja, queued for Claude Code instead of drafted
immediately (see [[claude-code-task-queue]]).

## What Bryce wants

Bryce wants Hermes to have "actual control" — not just talk/reason about Scheduler and Zapier Overseer, but real tool access to actually do things: assign cleaners to turnovers, flag/fix unassigned jobs, and check/fix the Zapier automations that move new reservations into Google Calendar. Right now Hermes can only discuss these areas, it has no tools for them. Please build out the actual integrations/tools so Hermes can take real action here, same pattern as the existing tools (propose_site_edit, record_monthly_finance, vault access) — flag anything risky/hard-to-reverse so it still routes through Bryce's Pending Actions approval like other sensitive actions.

## What was done

Two separate asks here ended up resolved differently, both by design after
talking it through with Bryce:

**Scheduler — built.** Added a real `assign_cleaner` tool. Confirmed
directly from Bryce's actual Google Calendar that assigning a cleaner
means inviting them to the turnover's Calendar event as a guest — so
that's exactly what this automates, rather than inventing a separate
assignment system. A new Zap ("Assign Cleaner to Turnover (Hermes)")
finds the right event and adds the cleaner, reusing Zapier's own
already-authenticated Google Calendar connection instead of giving
Hermes its own Google credentials. Bryce chose to let this run
automatically rather than gate it through Pending Actions, since it's
low-risk (an invite is easy to undo) and gating every single assignment
would defeat the point of Scheduler doing it for him. Full writeup:
[[systems/scheduler]].

**Zapier Overseer — deliberately *not* given a Hermes tool.** Checked:
Zapier's API for checking Zap run history requires becoming an approved
Zapier Partner (full OAuth2 app registration), not practical for
monitoring one account. Bryce chose "report problems, Claude Code fixes
them" over giving Hermes its own Zapier credentials — matches how this
session's other Zapier work already went (a real bug found and partly
fixed by Claude Code directly, with Bryce watching). Tracked as ongoing
work in `Knowledge/unfinished-projects/zapier-overseer-buildout.md`,
not a new tool on Hermes.
