# Developer onboarding — BCP Build Lab

Welcome. This gets you from zero to a running local copy in a few minutes. You
work against your own development database, so nothing here touches production.

## 1. Access

- Accept the GitHub invite to `darren-dudley/build-lab.dev`, then clone it:
  ```bash
  git clone https://github.com/darren-dudley/build-lab.dev.git
  cd build-lab.dev
  npm install
  ```

## 2. Your own database (Neon Postgres, free)

1. Create a project at https://neon.tech (the free tier is plenty).
2. From the project dashboard, copy the two connection strings:
   - the **pooled** one (host contains `-pooler`) into `DATABASE_URL`
   - the **direct** one (host without `-pooler`) into `DIRECT_DATABASE_URL`

## 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | How to get it |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string (host has `-pooler`) |
| `DIRECT_DATABASE_URL` | Neon direct connection string (no `-pooler`) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `SEED_PASSWORD` | Any password; used for the seeded demo users |
| `ANTHROPIC_API_KEY` | Optional. Your own key from https://console.anthropic.com. Only the "Draft with AI" triage button needs it. |

## 4. Set up the database and run

```bash
npm run db:migrate     # create the schema in your dev database
npm run db:seed        # foundation data + demo users/companies/initiatives
npm run dev            # http://localhost:3000
```

Sign in at http://localhost:3000/login with `admin@build-lab.dev` and the
`SEED_PASSWORD` you chose.

## 5. How to ship changes

Production (build-lab.dev) auto-deploys from `main` and is used by the live team,
so **please do not push directly to `main`**. Work on a branch and open a pull
request:

```bash
git checkout -b your-change
# ... make changes ...
git commit -m "Describe the change"
git push -u origin your-change
```

Opening the PR gives you an automatic Vercel **preview URL** to check your work.
Darren reviews and merges; merging to `main` is what deploys to production.

## Useful commands

```bash
npm run dev        # local dev server
npm run build      # production build (run before pushing)
npm test           # vitest suite (scoring, workflow, RBAC, governance)
npm run db:migrate # apply schema changes to your dev DB
npm run db:seed    # (re)seed your dev DB
```

## Project map

- `src/app` — routes (App Router). `(app)/` is the authenticated shell; `/submit` is public intake.
- `src/server/<module>` — all business logic (auth, rbac, scoring, workflow, triage, governance, projects, ...). Never put business logic in components.
- `src/components` — UI. `prisma/schema.prisma` — data model. `docs/01`–`05` — architecture.

See `CLAUDE.md` for the non-negotiable product principles before making structural changes.
