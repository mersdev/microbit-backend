# microbit-backend

Repo split:

- `backend/` contains the Cloudflare Worker API, D1 schema, smoke test, HTTP request files, and backend docs.
- `frontend/` contains the Cloudflare Pages app, its Pages config, and only frontend assets.

## What runs where

- Backend Worker: `backend/`
- Backend tests: `backend/test`
- Local smoke runner: `backend/scripts/smoke-local.mjs`
- Pages app: `frontend/index.html`
- Pages config: `frontend/wrangler.jsonc`

## Backend

The backend is a Hono Worker with D1 as the only persistence layer. It serves:

- dashboard auth: `/v1/auth/login`, `/v1/auth/logout`, `/v1/auth/me`
- microbit transport: `/v1/microbit/pull`, `/v1/microbit/send`, `/v1/microbit/ack`, `/v1/microbit/heartbeat`
- app-facing routes: `/v1/app/devices/:deviceId`, `/v1/app/devices/:deviceId/stream`, `/v1/app/devices/:deviceId/command`
- admin routes under `/v1/admin/*`
- Swagger UI: `https://microbit-backend.velozz.workers.dev/v1/docs`

Local commands:

```txt
cd backend
npm install
npm run test
npm run dev
npm run smoke:local
```

Useful backend files:

- `backend/wrangler.jsonc` for Worker + D1 config
- `backend/migrations/0001_init.sql` for schema and seed data
- `backend/http/local.http` for local REST Client smoke
- `backend/http/dev.http` for deployed REST Client smoke

## Frontend

The frontend is a plain static microbit control page with two buttons and a live display. It talks to the backend through the app routes and listens to SSE for live updates.

Pages deployment is configured in `frontend/wrangler.jsonc` and deployed by `.github/workflows/deploy-pages.yml`.

Local asset file:

- `frontend/index.html`

## Cloudflare deploy

The repo has two independent deploy flows:

- Worker deploy: `.github/workflows/deploy-cloudflare.yml`
- Pages deploy: `.github/workflows/deploy-pages.yml`

Required GitHub secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Recommended token permissions:

- `D1: Edit`
- `Workers Scripts: Edit`
- `Pages: Edit`

## REST Client

The HTTP files are intentionally minimal:

- `backend/http/local.http` targets local `wrangler dev`
- `backend/http/dev.http` targets the deployed Worker

Both files include:

- login and bearer token capture
- admin API key creation
- app snapshot and SSE stream
- microbit `pull`, `ack`, `send`, and `heartbeat`

## Reset and smoke

Reset local D1 and rerun seed migration:

```txt
cd backend
npm run db:reset:local
```

Run the end-to-end local smoke test:

```txt
cd backend
npm run smoke:local
```

## Notes

- Seeded admin login: `admin@velozz.com`
- Seeded admin password: `XDman100#`
- Seeded API key: `velozzadminseed`
- Generated API keys are letters-only, start with `velozz`, and contain no symbols or digits.
- Frontend API key/device identity is the query param `deviceId`
- The frontend is meant to live on Cloudflare Pages, not inside the Worker bundle
