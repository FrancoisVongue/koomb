# CLAUDE.md

## Project

Web scraper: a user submits a URL, the app scrapes the page in the background
and stores every `<a>` link found on it. Requirements are in `docs/TASK.md`.
Decisions are in `docs/PLAN.md`; it grows step by step, read it before starting
a part.

## Architecture

    HTTP route -> controller -> business logic + services (db/etc)
    add URL    -> page saved as "in progress" -> background job
               -> fetch page -> parse links -> save -> page marked done

- A request never waits for scraping.
- The database is the single source of truth, including page status.
- Everything external or async (database, page fetcher, events, cron, clock)
  is a service. `backend/src/index.ts` creates all services once, in one typed
  container (`Services`), and passes it to routes, from routes to
  controllers, and to the worker. Nothing else imports or creates a service.
- Stack and architecture decisions are recorded in `docs/PLAN.md`. Do not make
  new ones yourself.

## Folder map

```
frontend/                 # React app (Vite)
shared/                   # DTO types used by BOTH frontend and backend
backend/
  src/
    models/
      <model>/            # one folder per feature
        routes.ts
        controller.ts
        types.ts          # types + their pure functions
        adapter.ts        # complex logic around service calls (when needed)
    services/             # all I/O: database, page fetcher, events, cron, clock
    lib/                  # pure wrappers over third-party libraries (HTML parser); no I/O
    index.ts              # creates the Services container, starts server and worker
e2e/                      # end-to-end tests
docs/                     # TASK.md, PLAN.md, sessions/
```

## Commands

Filled in when the project skeleton is committed. Until then there is nothing
to run; do not invent commands.

| Task        | Command |
|-------------|---------|
| Install     |         |
| Run (dev)   |         |
| Test        |         |
| Lint        |         |
| Format      |         |

## Coding conventions

- TypeScript, strict. No `any`.
- Routes own HTTP: parse input, call the controller, map the result to a
  response. Controllers never receive `req` or `res`.
- Controllers, adapters and the worker get their services from the container
  they are given. They never call `fetch`, the database, timers or other I/O
  directly, and never import a service module (only its types). A new external
  dependency means a new service, or a method on an existing one.
- Controllers read as the user story (important!); this should be the most
  readable part of the code. Logic that talks to the outside world lives in
  `services/`. If calling a service needs complex logic, it goes in
  `models/<model>/adapter.ts`. Don't make the controller unreadable; fight to
  keep it as readable as possible.
- Expected outcomes are returned, not thrown: `venum('ok', data)`,
  `venum('notFound', { message })`. The route handles every case with `match`.
- No `try/catch` for expected branches. Real infrastructure failures bubble to
  the global error handler.
- Failures of the page being scraped (unreachable, timeout, bad status,
  non-HTML) are expected outcomes: return a venum and store the page as failed.
  Only our own infrastructure failures (DB down, bugs) are thrown. Refined in
  `docs/PLAN.md` when the scraping part is planned.
- Outside input (request body, query, fetched HTML) is parsed into a named type
  at the boundary. Models, DTOs and outcomes are named types, not inline shapes.
- Pure functions (parsing, transforms) do no I/O. They are defined on types, in
  a namespace with the same name as the type, so code reads as
  `TypeX.action(x, ...args)` and it is clear which method you call and that it
  is pure. Related types go in the same namespace (`Page.Status`):

  ```ts
  export type Page = { url: string; status: Page.Status; links: Link[] };
  export namespace Page {
    export type Status = 'queued' | 'processing' | 'done' | 'failed';
    export const linkCount = (page: Page): number => page.links.length;
  }
  ```
- `shared/` contains only types used by both frontend and backend, plus their
  namespaces of pure functions. If it is not shared, it does not go in
  `shared/`.
- Code is grouped by feature, not by technical layer. We use hexagonal
  architecture, so do not create top-level folders such as `controllers/` or
  `repositories/` (`services/` is the one exception: shared infrastructure).
  Controllers are managers of both services and business logic.
  Business logic is defined in types.
  A service is an external program/process that we use to do certain functions.
- Use venum for complete handling of errors (pre-approved dependency; read its
  README before first use).
- Frontend: clean and simple, nice to look at. Use Tailwind and shadcn/ui
  (Base UI primitives).

## Testing

- Every part ships with its tests in the same commit. Unit tests should be easy
  to write. Put unit tests next to the things they test (`*.test.ts`); no
  separate folder for unit tests.
- Pure functions are tested directly on fixtures.
- Routes are tested through HTTP, not by calling controllers.
- Controllers and the worker are tested with a container of fake services.
  Substitute services through the container; no `vi.mock` of service modules.
- End-to-end tests live in `e2e/`.
- Tests never touch the real internet: use HTML fixtures or a local server.
- Tools are added here once chosen.

## Workflow

1. Before building a part, write its decisions into `docs/PLAN.md` and stop for
   my review.
2. Build one part at a time. Small commits, one meaning each.
3. Commit only after my explicit approval or when I ask.
4. Before committing, run `/review` on the staged changes if it was not
   already run on them. If any agent reports FAIL, show the findings and wait
   for my decision before committing.
5. Run lint and tests before calling a task done; say plainly if something
   was not run.
6. If the plan turns out wrong, say so and change the plan first, in its own
   commit.
7. Log notable mistakes and hand-written code in `AI_USAGE.md`.

## Do not (IMPORTANT!!!!!)

- Do not read or write `.env`. New variables go in `.env.example`.
- Do not commit secrets.
- Do not add a dependency without asking.
- Do not skip, delete or weaken a failing test to make the suite pass.
- Do not scrape inside a request handler.
- Do not force-push or rewrite history unless I ask. Never remove co-author
  trailers.
- Do not make architecture or stack decisions on your own: propose, then wait.
