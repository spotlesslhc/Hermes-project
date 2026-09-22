# Hermes / Deja — project notes for Claude Code

This is the Hermes-project repo: a Cloudflare Worker + static dashboard
for Spotless Cleaning (Lake Havasu City, AZ). The on-screen persona is
"Deja"; the repo, Worker, and code all still say "Hermes" — that split is
deliberate, see `Knowledge/decisions/2026-09-21-deja-rename-scope.md`.

Read `Knowledge/systems/systems-overview.md` first for how everything
actually fits together. The rest of `Knowledge/` is a shared Obsidian
vault between Bryce, Deja, and Claude Code — check it before assuming how
something works.

**Deploys automatically.** Any push to `main` redeploys the live Worker
within about a minute. There's no test suite or staging environment.
Ship real changes on a branch and open a PR for Bryce to review — see
recent PRs for the pattern. Pure documentation-only changes to `Knowledge/`
are low-risk enough to commit straight to `main` (established practice
throughout this project).

## Check for queued site-edit tasks at the start of every session

`Knowledge/tasks/` is where Deja queues site/dashboard edit requests for
Claude Code to handle directly, instead of drafting them herself through
the Worker's metered API key — see `Knowledge/tasks/README.md` and
`Knowledge/decisions/2026-09-21-claude-code-task-queue.md` for why.

At the start of a session in this repo, check `Knowledge/tasks/` (via
`ls`/glob, not by asking Bryce) for any `.md` files directly in that
folder (not in `Knowledge/tasks/done/`). If any exist:

1. Read each one — it has the title, target (website/dashboard, if
   known), and Bryce's request in his own words.
2. Make the actual edit yourself: same workflow as any other change here
   — branch, edit, commit, push, open a PR for Bryce to review. Don't
   push straight to `main` for a real site/code change.
3. Move the task file into `Knowledge/tasks/done/` (create that folder if
   it doesn't exist yet) once the PR is open, and commit that move.
4. Tell Bryce what you found and did, including the PR link.

If the folder is empty (or only has files under `done/`), there's nothing
to do here — no need to mention it unless asked.
