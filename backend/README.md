```txt
npm install
npm run test
```

Local D1 dev uses Wrangler's local database by default. This command applies local migrations first, then starts the Worker with persisted local state:

```txt
npm run dev
```

If you want to apply migrations without starting the server:

```txt
npm run db:migrate:local
```

For production, set the real D1 `database_id` in `wrangler.jsonc`, then deploy:

```txt
npm run db:migrate:remote
npm run deploy
```

The GitHub Actions deploy workflow lives at repo root in `.github/workflows/deploy-cloudflare.yml` and expects these secrets:

```txt
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The microbit demo frontend lives in `frontend/index.html` and is deployed to Cloudflare Pages from `.github/workflows/deploy-pages.yml`.

The Pages app uses these public backend routes:

```txt
GET /v1/app/devices/{deviceId}
POST /v1/app/devices/{deviceId}/command
```

You can smoke-test the full API from repo root with [local.http](/Users/baoren/playground/microbit-backend/local.http) or [dev.http](/Users/baoren/playground/microbit-backend/dev.http). Use `local.http` against `wrangler dev` and `dev.http` against the deployed Worker URL, then paste the returned `sessionToken`, `apiKey`, `cmdId`, and `requestId` back into the variables at the top of the file.

The login request in each file is named `login`, and the bearer token is read from `{{login.response.body.$.sessionToken}}` so you do not have to copy the token by hand. Run the login request once first in REST Client, then the later requests reuse the captured token.

Fresh installs seed one admin API key automatically:

```txt
velozz_admin_seed
```

To reset the local D1 database to a clean state and reapply the seed migration, run:

```txt
npm run db:reset:local
```

To run the local smoke test end to end, including a clean DB reset and a temporary `wrangler dev` session:

```txt
npm run smoke:local
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```
