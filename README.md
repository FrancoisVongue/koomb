# Koomb

Node.js (Express, TypeScript) backend + React (Vite, TypeScript) frontend, in an npm workspaces monorepo.

## Structure

```
frontend/   React + Vite (port 3033)
backend/    Express API (port 3031)
```

## Getting started

```sh
npm install
npm run dev      # runs backend + frontend; open http://localhost:3033
```

The Vite dev server proxies `/api/*` to the backend.

**Scraping is slowed down on purpose in development.** `npm run dev` waits
3 seconds before fetching each page (`SCRAPE_DELAY_MS=3000`). Most pages are
scraped in well under a second, so without the delay the "in progress" status
is never visible. We decided to keep it that way. Set `SCRAPE_DELAY_MS=0` in
`backend/.env` to turn it off; `npm start` and the tests don't use it.

```sh
npm run typecheck   # tsc --noEmit in both workspaces
```

## Docker (local testing)

```sh
docker compose up --build   # same two dev servers; open http://localhost:3033
```

The SQLite database is kept in the `data` volume.
