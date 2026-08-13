# Build-Lab.dev

## What this is

Build-Lab.dev is a hub for rapid-deployment projects — a launchpad for spinning up and shipping many small projects quickly.

- **Repo:** https://github.com/darren-dudley/build-lab.dev
- **Stage:** Initial setup (August 2026). Nothing built yet.

## Decisions not yet made

- Monorepo vs. separate repos per project
- Hub site tech stack (Next.js on Vercel is the working assumption, not decided)
- Domain/deployment setup

When starting new work here, check with Darren on these before assuming a structure.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
