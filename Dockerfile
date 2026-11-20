# Local testing only: runs the same two dev servers as `npm run dev`.
FROM node:22

WORKDIR /app
COPY . .
RUN npm ci

EXPOSE 3031 3033
# --host so the Vite dev server is reachable from outside the container;
# Vite still proxies /api to the backend on localhost:3031, as locally.
CMD ["npx", "concurrently", "-n", "backend,frontend", "npm run dev -w backend", "npm run dev -w frontend -- --host"]
