# AGENTS.md

## Cursor Cloud specific instructions

FAIMS3 is an offline field data-collection platform. It is a pnpm + Turborepo
monorepo (Node 24, `pnpm@10.7.0`). The relevant runnable services are:

| Service                   | Package               | Dev URL                       | Notes                            |
| ------------------------- | --------------------- | ----------------------------- | -------------------------------- |
| Conductor API             | `api` (`@faims3/api`) | http://localhost:8080         | Express server, talks to CouchDB |
| Data-collection app       | `app` (`@faims3/app`) | http://localhost:3000         | Vite PWA                         |
| Control Centre / Designer | `web` (`@faims3/web`) | http://localhost:3001         | Vite web app (admin UI)          |
| CouchDB                   | docker                | http://localhost:5984/\_utils | Runs in Docker, not Node         |

Shared libraries: `library/data-model` (`@faims3/data-model`) and
`library/forms` (`@faims3/forms`). Browser e2e: `e2e` (`@faims3/e2e`).

### Runtime configuration

Each runnable package exposes a typed `config` singleton parsed once from env
via Zod (shared helpers live in `@faims3/data-model` as `configHelpers`):

| Package  | Module                            | Env source               |
| -------- | --------------------------------- | ------------------------ |
| `api`    | `api/src/buildconfig.ts`          | `process.env`            |
| `app`    | `app/src/buildconfig.ts`          | `import.meta.env.VITE_*` |
| `web`    | `web/src/constants.ts`            | `import.meta.env.VITE_*` |
| designer | `web/src/designer/buildconfig.ts` | `import.meta.env.VITE_*` |

Prefer `import {config} from '…'` and `config.<field>`. See each package's
`.env.dist` for documented variables. E2e reads `e2e/.env` (from
`e2e/.env.dist`) for URLs and seed persona credentials.

### Startup (services are NOT started by the update script)

The update script only runs `pnpm install`. To bring the stack up in a fresh
session:

1. Start the Docker daemon (CouchDB runs in Docker). Docker is preinstalled in
   the snapshot but the daemon must be started each session, e.g. in a tmux
   session: `sudo dockerd`. Wait a few seconds until `sudo docker info` works.
2. Generate signing keys + CouchDB `local.ini` (idempotent; `keys/` and
   `.env` files are gitignored so they may be missing on a fresh VM):
   `pnpm run generate-local-keys`. Then create env files if missing:
   `cp ./.env.dist ./.env; for d in api web app e2e; do [ -f ./$d/.env ] || cp ./$d/.env.dist ./$d/.env; done`
3. Start CouchDB only: `sudo docker compose up -d --build couchdb`, then wait
   for `curl http://localhost:5984/_up` to return 200.
4. Initialise the database (creates the `admin` user): `pnpm run migrate-with-keys`.
5. Run all dev services with live reload: `pnpm run dev` (turbo runs api, app,
   web and the data-model watcher in parallel). Run it in a long-lived tmux
   session; it stays in the foreground.

`./localdev.sh` / `./dev.sh` automate steps 1-5 but assume `nvm`; running the
steps directly (as above) is more reliable in this VM. `./localdev.sh --all`
runs every service inside Docker instead of natively — slower and not needed
for code work.

### Non-obvious gotchas

- Shared libraries must be built before the API/migrate can resolve
  `@faims3/data-model` / `@faims3/forms` (their package `main` points at build
  output). `pnpm run dev` builds them automatically via the turbo `dev` ->
  `build` dependency; if you run `pnpm run migrate-with-keys` on a fresh tree
  first, run `pnpm build` (or `npx turbo build`) once beforehand.
- Local admin credentials: username `admin`, password
  `aSecretPasswordThatCantBeGuessed` (the `COUCHDB_PASSWORD` in `api/.env`).
  The Control Centre (`:3001`) redirects to the Conductor login at
  `:8080/login`; the green "Sign in" button is the local-login option.
- Creating a Template or Project in the Control Centre requires the user to
  belong to a Team first. Create a Team (Teams -> "+ Create Team") before
  "+ Create Template", otherwise you get "You do not have permission to create
  templates."
- The database starts empty. To load sample data, follow the README
  ("Loading sample notebooks and templates") which needs a bearer token, or run
  `cd api && pnpm seed-test-dataset` (idempotent; safe to re-run).
- For repeated e2e auth (password reset / invites), set
  `RATE_LIMITER_ENABLED=false` and `AUTH_ATTEMPT_LIMITER_ENABLED=false` in
  `api/.env` and restart the API. The former is the Express HTTP IP limiter;
  the latter gates CouchDB-backed email-code / verification-challenge limits.

### Lint / test / build (standard commands, see `package.json`)

- Lint everything: `npx turbo lint` (or `pnpm lint`). The `@faims3/forms`
  circular-dependency notice is a pre-existing warning, not a failure.
- Format: `pnpm format` (oxfmt) / `pnpm format:check`.
- Build everything: `pnpm build` (`npx turbo build`).
- Tests per package (no single repo-wide test script):
  `pnpm --filter=@faims3/data-model test` (jest),
  `pnpm --filter=@faims3/api test` (mocha; uses in-memory PouchDB, no CouchDB
  needed), `pnpm --filter=@faims3/app test` (vitest).
  Note `web` and `forms` use bare `vitest`, which watches in a TTY — pass
  `--run` (e.g. `pnpm --filter=@faims3/web exec vitest --run`) for one-shot runs.
- Browser e2e (stack must be up + seeded):
  `pnpm --filter=@faims3/e2e test:e2e:headless:ci` (smoke → web → app).
  See `e2e/README.md` and `e2e/SUITE.md`. CI:
  `.github/workflows/e2e.yml`.
