# Plan

20 Nov 2026 · @Francois Vongue

This is the plan for how the work will go. Decisions (stack, data model, slow
pages, tests) are added step by step, each one **before** the part it concerns
is implemented.

**How to read it:** each step lists its **decisions**; each decision has a
*why* and, where relevant, a *trade-off*. Status is one of `done`,
`in progress`, `todo`, with the commit that delivered it.

---

## 1. Throughout the project

### 1.1 Logging

- Log the work; notice and log bad answers from Claude in `AI_USAGE.md`.
- Anything written by hand goes into `AI_USAGE.md` too.

### 1.2 Git

- Keep git history and commits clean: small commits, one meaning each.
- Claude commits only after explicit approval; co-author trailers are kept.

---

## 2. Setup

### 2.1 CLAUDE.md — `done` (e55865b)

#### Architecture

- **Decision:** route → controller → business logic (types) + services.
  - *Why:* controllers read as the user story; HTTP stays in routes.
- **Decision:** code grouped by model (`backend/src/models/<model>/`:
  pages, links), hexagonal style; the use cases are controller functions,
  and controllers may call each other. `services/` is the only shared
  infrastructure folder.
  - *Why:* a model and everything done with it can be read in one place.
- **Decision:** two entrances invoke the use cases: `app.ts` (HTTP, by
  clients) and `cron.ts` (by time). They are not services. Changed while
  building: the background job first was a `models/scrape/` "feature".
  - *Why:* reads like what it is: two ways the app is told what to do.

#### Conventions

- **Decision:** expected outcomes are returned as values with `venum`, not
  thrown.
  - *Why:* every case is handled at compile time with `match`.
- **Decision:** pure functions and related types live in a namespace with the
  same name as their type (`type Page` + `namespace Page { … }`), used as
  `Page.action(page)` and `Page.Status`.
  - *Why:* everything about a model is under one name; clear which method is
    called and that it is pure.
  - *Trade-off:* namespaces are not erasable syntax, so the backend runs with
    `tsx` instead of plain Node, and Biome's `noNamespace` is off. Claude
    first pushed a companion-object pattern instead (see `AI_USAGE.md`).

#### Rules for Claude

- **Decision:** propose and wait for any stack or architecture decision; ask
  before adding a dependency; never touch `.env`.

### 2.2 Stack — `done` (scaffold not committed yet)

#### Language

- **Decision:** TypeScript, strict, on both frontend and backend.

#### Backend

- **Decision:** Node 22 + Express 5, run with `tsx` (`tsx watch` in dev), with
  no build step.
  - *Why:* no build step; `tsc --noEmit` only type-checks. `tsx` supports
    namespaces, which Node's native type stripping does not.
  - *Trade-off:* one extra dev dependency, and production also runs through
    `tsx` instead of compiled JavaScript.

#### Frontend

- **Decision:** React + Vite; Tailwind + shadcn/ui (Base UI primitives).
  - *Why:* shadcn/ui and Base UI are React-only. The first scaffold was Vue
    and was switched.
  - Clean and simple, nice to look at; the frontend is not evaluated.

#### Repo layout

- **Decision:** npm workspaces: `frontend/`, `backend/`, and later `shared/`
  (DTO types used by both sides).

#### Database, queue, tests

- Decided in 3.2.

### 2.3 `.claude/settings.json` — `done` (62fb2fb)

#### Permissions

- **Decision:** allow typecheck, lint, format, test and read-only git; ask for
  `npm install`, `git commit` and `git push`; deny `.env` files and destructive
  commands (`rm -rf`, force-push, `reset --hard`, `clean`, `restore`…).
- **Decision:** bypass permissions mode disabled for the project.
- *Trade-off:* Bash rules match the command text, so they reduce risk but are
  not a sandbox.

### 2.4 Linter and formatter — `done` (083a2a8)

#### Tool

- **Decision:** Biome, not ESLint.
  - *Why:* one tool for lint and format, a single config, and fast enough to
    run on every Claude stop.
  - *Trade-off:* no typescript-eslint type-aware rules. Biome's
    `noFloatingPromises` and `noMisusedPromises` are still in the nursery group
    and less thorough.

#### Rules

- **Decision:** recommended preset; `noExplicitAny`, `noFloatingPromises` and
  `noMisusedPromises` as errors; `noNamespace` off (see 2.1); warnings fail
  `npm run lint`.
  - *Why:* enforces CLAUDE.md rules, and catches un-awaited background scrape
    jobs.
- **Decision:** Markdown is not formatted by Biome.
  - *Why:* docs are written by hand.

### 2.5 Verification loop — `done` (62fb2fb, b2e9774)

Two layers: a deterministic check on every stop, and an AI review before
every commit.

#### Stop hook (automatic)

- **Decision:** `.claude/hooks/verify.sh` runs typecheck + lint when the
  working tree has changes, and exits 2 on failure, so Claude has to fix the
  errors before it stops.
  - *Trade-off:* it blocks only once in a row (`stop_hook_active` guard). A
    second failure is let through, so it can't loop forever.

#### `/review` (before each commit)

- **Decision:** six read-only agents in `.claude/agents/`, one invariant
  each, run in parallel by `.claude/commands/review.md` on the staged diff:
  - structure: everything in the right place;
  - controllers: readable as the user story;
  - consistency: the diff matches TASK and PLAN, and was planned first;
  - outcomes: venum outcomes, input parsed at the edge, pure code stays pure;
  - tests: changes are tested, no test weakened;
  - services: everything external goes through injected services (3.2).
  - *Why:* one invariant per agent gives sharper findings than one general
    reviewer; the checks lint can't do.
- **Decision:** agents are pinned to Sonnet.
  - *Why:* focused checks don't need the bigger model; cheaper to run often.
- **Decision:** `/review` is run before every commit. CLAUDE.md tells Claude
  to run it if I didn't, and to wait for me when an agent reports FAIL.
- *Trade-off:* LLM reviewers are slower and less deterministic than lint.
  They complement lint, typecheck and tests; they don't replace them.
  `/review` verifies each cited finding to cut false positives.

---

## 3. Implementation — `done`

Break the work into parts; write the decisions for each part here before
building it. Then do each part, write its tests, and commit.

### 3.1 Parts

Built in this order; each one ships with its unit tests.

1. Test tooling — `done`
2. Data — `done`
3. Link parsing — `done`
4. Scrape job (emits status events) — `done`
5. API (REST + SSE route) — `done`
6. Frontend — `done`

#### Requirements covered

| TASK requirement | Parts |
|------------------|-------|
| 1. Pages list with link count | 2, 5, 6 |
| 2. Page detail: links with URL and name | 3, 5, 6 |
| 3. Add a URL; `<title>` is the page name; link name may be HTML | 3, 4, 5, 6 |
| 4. Slow pages: non-blocking, status visible in the list | 4, 5, 6 |
| 5. Pagination on **both** lists | 5, 6 |
| Nice: failure handling, error state in the list, retry | 4, 6 |
| Nice: relative URLs, duplicate links | 3 |
| Nice: one-command setup | 2 (SQLite, migrations on startup) |
| Nice: CI, per-user pages | skipped (3.2 Scope) |

### 3.2 Decisions

#### Testing

- **Decision:** Vitest, unit tests only for now; no e2e.
  - *Why:* shares Vite's config and runs TS natively; unit tests cover the
    logic that matters.
  - *Trade-off:* the full flow (add URL → job → list) is not tested end to
    end. Can be added later in `e2e/`.
- **Decision:** once Vitest is set up, tests run in the Stop hook
  (`verify.sh`) together with typecheck and lint.
- **Decision:** test strategy per layer:
  - pure functions (types' namespaces, parser): directly, on HTML fixtures;
  - controllers and the worker: with a container of fake services;
  - routes: through HTTP, on a server started on port 0 with fake services
    (built-in `fetch`, no `supertest`);
  - services themselves: the database on in-memory SQLite, the page fetcher
    against a local HTTP server. Never the real internet.

#### Services and injection

- **Decision:** everything external or async that controllers use (database,
  page fetcher, events, background, clock) is a service. Services are created once, in
  `backend/src/index.ts`, into one typed container (`Services`), and passed to
  routes, from routes to controllers, and to the worker. Nothing else imports
  or creates a service.
  - *Why:* every dependency is visible and can be swapped; tests build the
    container with fakes, so no module mocking (`vi.mock`).
  - *Trade-off:* the container is passed around explicitly. No DI library.
- **Decision:** our own page fetcher service: simple functions over the
  built-in `fetch` (timeout, size limit, content type, SSRF check), returning
  venum outcomes.
- **Decision:** the clock is a service (`clock.now()`), used for timestamps
  and the "stuck" check.
  - *Why:* time-based tests set the time directly, no fake timers.
- **Decision:** a dedicated `/review` agent (`services-reviewer`) checks this
  rule on every diff.

#### Data

- **Decision:** SQLite + Drizzle ORM, with the `better-sqlite3` driver.
  Migrations with `drizzle-kit`, applied on startup.
  - *Why:* no database server, so the app starts with one command; tests can
    use an in-memory database; one process with one worker never hits
    SQLite's single-writer limit.
  - *Trade-off:* not production-like and can't scale to several workers.
    Moving to Postgres means rewriting the schema file (`sqliteTable` →
    `pgTable`); queries mostly stay.
- **Decision:** start with the simplest data model, extend it when a part
  needs more.

  ```
  pages   id, url (unique), title?, status, error?, attempts, createdAt, updatedAt
  links   id, pageId → pages.id, href, name
  ```

  - `status`: `queued` | `processing` | `done` | `failed`.
  - Link count per page is computed with `COUNT`, not stored.

#### Slow pages

- **Decision:** no external queue. The page's own `status` in the database is
  the queue.
  - *Why:* one source of truth (the database), no extra infrastructure,
    survives restarts.
  - *Trade-off:* one worker in one process.
- **Decision:** adding a URL saves the page as `queued` and starts the job
  right away, without waiting for it. A `node-cron` job every 10 s is the
  safety net: it picks up `queued` pages and puts pages stuck in `processing`
  for more than 2 min back to `queued`.
- **Decision:** automatic retry, up to 3 attempts (`attempts`), then `failed`
  with the reason in `error`. A manual retry button is a nice-to-have, not
  built.

#### Scraping

- **Decision:** `cheerio` as the HTML parser, wrapped in `backend/src/lib/`
  (sibling to `services/`).
  - *Why:* parsing is pure (HTML string in, links out); `services/` is for
    I/O. Keeping them apart keeps the purity rule simple.
- **Decision:** fetch limits: 10 s timeout, max 5 MB, only `text/html`.
  Anything else is an expected outcome: the page is stored as `failed` with a
  reason.
- **Decision:** only `http` and `https` URLs are accepted.
- **Decision:** link name is the visible text of the `<a>`, like `innerText`
  (no tags, comments or scripts; whitespace collapsed). A link without text
  (an icon, an image) is named by its `aria-label`, `title` or the image's
  `alt`; otherwise the name is empty. Cut to 500 characters.
  - *Why:* TASK allows storing a portion of the HTML, but real pages put
    icons, comments and indentation inside links; plain text reads better.
    Changed after scraping w3schools.com for real.
- **Decision:** relative `href`s are resolved against the page URL (and
  `<base>`) and lose their `#fragment`; `javascript:` and empty `href`s are
  dropped; duplicate links (same resolved `href`) are kept once, first name
  wins.

#### API

- **Decision:** endpoints:
  - `POST /api/pages`: add a URL;
  - `GET /api/pages?page=&pageSize=`: pages list with link count and status;
  - `GET /api/pages/:id?page=&pageSize=`: one page and its links;
  - `GET /api/pages/events`: SSE stream (see Live updates).
- **Decision:** pagination with the `page` and `pageSize` query params;
  responses include the total count so the UI can show page numbers.
- **Decision:** the same URL added twice does not create a new page. The API
  returns an `alreadyExists` outcome (HTTP 409) with the existing page, and
  the UI shows a warning toast, not an error. URLs are compared after
  normalization (lowercase host, no `#fragment`).

#### Live updates

- **Decision:** Server-Sent Events, used only as a "something changed"
  signal, through an in-process event bus.

  ```
  worker ── emit('page.updated', { id, status }) ──▶ services/events (EventEmitter)
                                                          │ subscribe
  SSE route GET /api/pages/events ◀───────────────────────┘
  ```

  - The worker only knows the events service; it never sees a connection.
  - The SSE route owns the connections: subscribes on connect, unsubscribes
    on close, sends a heartbeat so proxies keep the stream open.
  - On an event (and on reconnect) the frontend refetches the current page of
    the list from the REST API. The stream carries no list data.
  - *Why:* instant updates without polling, and no coupling between the
    background job and HTTP. Refetching makes missed events harmless and
    keeps pagination out of the stream.
  - *Trade-off:* one process only (multi-instance needs Redis pub/sub or
    Postgres `NOTIFY`), which SQLite already implies. The SSE route is harder
    to test than a plain route.

#### Backend

- **Decision:** Express (already in the scaffold).

#### Frontend

- **Decision:** shadcn/ui components (with Tailwind); toasts with the shadcn
  `sonner` component.
- **Decision:** `react-router` for the two screens; plain `fetch` with small
  custom hooks, no data-fetching library. `api/` is the only place that
  knows URLs and status codes and returns venum outcomes, like the backend.
- **Decision:** no frontend tests.
  - *Why:* the frontend is not evaluated; testing effort goes to the backend.
  - *Trade-off:* UI helpers such as pagination numbers are checked by hand.
- **Decision:** page name is the `<title>`; while processing, or when there
  is no title, the URL is shown. The link count column shows "in progress"
  or "failed" (with the error on hover) instead of a number.

#### Local run (Docker)

- **Decision:** Docker Compose for local testing only: one single-stage image
  running the same two dev servers as `npm run dev` (frontend on :3033,
  proxying `/api` to the backend on :3031), with the SQLite file in a volume.
  - *Why:* run the app with only Docker installed; nothing to keep in sync
    with a production setup.
  - *Trade-off:* no hot reload in the container (the source is copied, not
    mounted). The backend never serves the frontend.

#### Security

- **Decision:** the page fetcher rejects loopback and private addresses after
  the DNS lookup (SSRF).
  - *Trade-off:* a basic check; DNS rebinding and redirects to private
    addresses need more work, noted as limits.

#### Scope

- **Decision:** no CI, no per-user pages (authentication), no e2e.
  - *Why:* a finished, well-verified core over extra features.
  - *Trade-off:* lint, typecheck and tests run locally only (Stop hook);
    every user sees every page.

#### Found while building the backend

- **Decision:** `shared/` is an npm workspace (`shared`) exporting the `Api`
  namespace (types only), so both sides import it by name.
- **Decision:** the sweep claims its batch (5 pages) at once and scrapes them
  concurrently.
  - *Why:* no loop in the controller; five fetches in parallel is fine for
    SQLite and one process.
- **Decision:** the SSE heartbeat (every 20 s) goes through the scheduler
  service, so the route has no timers of its own.
- **Decision:** an optional `backend/.env` is loaded with `dotenv`, and the
  variables are validated with a `zod` schema in `Config`; every variable
  has a default (`.env.example`). An invalid value stops the start with
  zod's message.
- **Decision:** the page is also announced on SSE when it is added
  (`queued`), so other open tabs refetch the list.
- *Trade-off:* `drizzle-kit` pulls an old `esbuild` with a moderate advisory
  (dev server only). It is a dev dependency used only to generate
  migrations, so it is accepted.

### 3.3 Open questions

None for now. New questions are added here as the parts are built.

---

## 4. At the end — `todo`

### 4.1 Review

1. Create new separate agents and evaluate the work from different
   perspectives.
2. Update the repo based on the agent reviews.

### 4.2 Documentation

1. Define the trade-offs made.
2. Explain the verification loop (Stop hook + `/review`) in the README.
3. Add session transcripts to `docs/sessions/`.
4. List the stack and every tool used in the README.
5. Make sure the app starts with one command, and the README says clearly how:
   setup and run, how to run the tests, tools used, trade-offs.

### 4.3 Delivery

1. Create the repo and push.
