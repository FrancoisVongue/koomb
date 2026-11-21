# Koomb

A web scraper: add a URL, the app scrapes the page in the background and stores
every `<a>` link on it. The pages list shows each page's name, link count and
status (in progress, done, failed), updated live.

- Requirements: [docs/TASK.md](docs/TASK.md)
- First plan, written before any code: [docs/PLAN.md](docs/PLAN.md)
- Decisions made during development: [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md)
- How AI was used: [AI_USAGE.md](AI_USAGE.md)

## Run the app

Pick one of the two ways. Both start the same thing.

### Option 1: with npm

You need **Node 22** (see `.nvmrc`). From the repo root:

```sh
npm install
npm run dev
```

Then open **http://localhost:3062**.

### Option 2: with Docker

You need Docker (or Podman). From the repo root:

```sh
docker compose up --build
```

Then open **http://localhost:3062**. Stop it with `Ctrl+C`, or
`docker compose down`.

### Good to know

- **Ports:** the frontend is on **3062** and the backend API on **3061**. The
  frontend forwards every `/api` request to the backend.
- **Database:** SQLite, created automatically on the first start
  (`backend/data/koomb.db`, or a `data` volume with Docker). No setup needed.
- **Scraping is slowed down on purpose:** `npm run dev` waits **3 seconds**
  before fetching each page. Most pages are scraped in well under a second,
  so without the delay you would never see the "in progress" status. We
  decided to keep it that way.
- **Settings are optional.** To change them, copy `backend/.env.example` to
  `backend/.env` and edit it: `PORT`, `DATABASE_FILE`, and `SCRAPE_DELAY_MS`
  (set it to `0` to turn the delay off).

## Run the tests

From the repo root:

```sh
npm test
```

That runs the backend tests (Vitest). They never touch the internet: the page
fetcher is tested against a local HTTP server, the API through HTTP on a
temporary server, and everything else with fake services and an in-memory
database. We test what can really break (link rules, link counts, claiming
and retries, SSRF, the live updates), not what the types already guarantee.

## All commands

Run from the repo root.

| Command | What it does |
|---------|--------------|
| `npm install` | Installs everything (all workspaces) |
| `npm run dev` | Starts the backend (:3061) and the frontend (:3062) with live reload |
| `npm test` | Runs the tests |
| `npm run lint` | Checks lint and formatting (Biome); warnings fail |
| `npm run format` | Formats the code and applies safe fixes |
| `npm run typecheck` | Type-checks every workspace |
| `npm run build` | Builds the frontend into `frontend/dist` |
| `npm start` | Runs only the backend, without the dev delay |
| `docker compose up --build` | Runs the app in Docker (same as `npm run dev`) |

Try the API directly while the app runs:

```sh
curl -X POST localhost:3061/api/pages -H 'content-type: application/json' \
  -d '{"url":"https://www.w3schools.com"}'
curl 'localhost:3061/api/pages?page=1&pageSize=20'
```

## How it works

```
entrances:  app.ts (HTTP, by clients)   cron.ts (by time, every 10 s)
                  |                            |
               routes                          |
                  +------> controllers <-------+   use cases on a model (pages, links)
                             |          |
              business logic (types)   services (db, fetcher, events, background, clock)
```

- `POST /api/pages` saves the page as `queued`, answers right away, and starts
  scraping it in the background. A cron sweep every 10 s picks up pages that
  were missed or got stuck, and retries temporary failures (up to 3 attempts).
- The page's status in the database is the queue: no external queue.
- Every status change is sent over Server-Sent Events
  (`GET /api/pages/events`); the frontend refetches the list when one arrives.

API: `POST /api/pages` (201, 409 if already added, 400),
`GET /api/pages?page=&pageSize=`, `GET /api/pages/:id?page=&pageSize=`,
`DELETE /api/pages/:id`, `GET /api/pages/events`. Types in `shared/index.ts`.

## AI harness and verification loop

The project is built with Claude Code. The harness lives in the repo:

- **`CLAUDE.md`**: architecture, folder map, commands, conventions and the
  things Claude must not do.
- **`.claude/settings.json`**: Claude may run tests, lint, format, typecheck
  and read-only git without asking; installs, commits and pushes need
  approval; `.env` files and destructive commands (`rm -rf`, force-push,
  `reset --hard`, …) are denied; bypass mode is disabled.

The verification loop has two layers:

1. **Stop hook, automatic** (`.claude/hooks/verify.sh`). Whenever Claude
   finishes a turn with uncommitted changes, it runs typecheck, lint and
   tests. On failure it exits 2, which blocks Claude from stopping and shows
   it the errors, so it has to fix them first. A guard lets it stop after one
   retry, so it can't loop forever.
   *Why:* deterministic, cheap, and runs every time without anyone
   remembering to.
2. **`/review`, before each commit** (`.claude/commands/review.md`). Runs six
   read-only reviewer agents in parallel (`.claude/agents/`), each checking
   one invariant that lint can't: files in the right place, readable
   controllers, consistency with the plan, venum outcomes and pure code,
   meaningful tests, and all I/O through injected services. The command
   checks every cited line before reporting. The agents run on Sonnet with
   low effort.
   *Why:* one invariant per agent gives sharper findings than one general
   reviewer; they complement the hook, they don't replace it.

## Stack and tools

| Area | Tools |
|------|-------|
| Language | TypeScript (strict) on Node 22 |
| Backend | Express 5, tsx, Drizzle ORM + better-sqlite3 (SQLite), cheerio, node-cron, zod, dotenv, venum |
| Frontend | React 19, Vite 8, Tailwind CSS 4, shadcn/ui on Base UI, sonner, lucide-react, react-router, venum |
| Tests | Vitest |
| Lint and format | Biome |
| Monorepo | npm workspaces (`frontend`, `backend`, `shared`), concurrently |
| Local run | Docker Compose |
| AI | Claude Code (Claude Opus for the main session, Claude Sonnet for the reviewer agents) |

## Trade-offs

- **SQLite and an in-process worker.** No database server or queue to
  install, and tests use in-memory databases. The cost: one process, one
  worker; SSE events also only work within that process. Postgres would mean
  rewriting the Drizzle schema file. 
- **No CI and no per-user pages.** Lint, typecheck and tests run locally (and
  in the Stop hook); every user sees every page.
- **Basic SSRF protection.** Private and loopback addresses are rejected after
  the DNS lookup, on every redirect; DNS rebinding is not covered.
- **Link names are plain text.** The task allows storing a portion of the
  HTML; we store the visible text (or a label for icon links), which reads
  better.
- **No manual retry button.** Retries are automatic (3 attempts).
- **Development delay** of 3 s per scrape, on purpose (see above).
- **`drizzle-kit` advisory.** It pulls an old `esbuild` with a moderate,
  dev-server-only advisory; it is only used to generate migrations.
