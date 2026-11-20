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

```sh
npm run typecheck   # tsc --noEmit in both workspaces
```

## Docker (local testing)

```sh
docker compose up --build   # same two dev servers; open http://localhost:3033
```

The SQLite database is kept in the `data` volume.
