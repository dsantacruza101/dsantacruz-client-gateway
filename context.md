# Context — client-gateway

## What this is

A **NestJS API Gateway** microservice. It is the single public-facing HTTP entry point for a set of internal backend microservices that communicate over **NATS** (message broker). The gateway itself holds almost no business logic — it validates/authenticates incoming HTTP requests, then forwards them as NATS messages to downstream services and relays the response back as HTTP.

Currently it exposes exactly one feature: a **portfolio "contact me" form** endpoint that forwards submissions to a `mail` microservice (message pattern `mail.send`) — presumably `danielsantacruz.dev`'s (or similar) portfolio site backend.

- **Package name:** `client-gateway`
- **Runtime:** Node.js 21 (Alpine), NestJS 11, TypeScript 5.7
- **Repo:** `Nest/client-gateway-dsantacruz`, branch `main`

## Architecture

```
Internet ──HTTP──▶ client-gateway (this repo) ──NATS (token auth)──▶ downstream microservices
                        │
                        ├─ Helmet / CORS / Origin allowlist
                        ├─ Global rate limiting (Throttler)
                        ├─ hCaptcha verification (per-route guard)
                        ├─ DTO validation (class-validator)
                        └─ RPC → HTTP exception translation
```

This is the **Gateway** piece of a microservices architecture (per Daniel's CLAUDE.md conventions: "Microservices — multiple independent services"). It does not own a database. All actual domain logic (e.g. sending email) lives in separate services reached via NATS `client.send(pattern, payload)`.

## Folder structure

```
src/
├── main.ts                                   # Bootstrap: Helmet, CORS, body limits, global pipes/filters
├── app.module.ts                              # Root module: Throttler, SecurityMiddleware, feature modules
├── config/
│   ├── envs.ts                                 # Joi-validated environment variables → `envs` object
│   ├── services.ts                             # NATS_SERVICE DI token constant
│   └── index.ts                                # Barrel export
├── transport/
│   └── nats.module.ts                          # ClientsModule registration for the NATS client proxy
├── middleware/
│   └── security-middleware.ts                  # Global Origin allowlist (prod only)
├── common/
│   ├── guards/
│   │   └── hcaptcha.guard.ts                   # Verifies hCaptcha token against hCaptcha API
│   ├── exceptions/
│   │   └── rpc-custom-exception.filter.ts       # Translates RpcException (from downstream) → HTTP response
│   └── constants/
│       └── rpc-exception.constants.ts           # Shared regex/status-set for the exception filter
└── modules/
    └── portfolio-contact-me/
        ├── portfolio-contact-me.controller.ts   # POST /api/portfolio/contact-me
        ├── portfolio-contact-me.module.ts
        └── dto/portfolio-contact-me.dto.ts       # name, email, subject, message, captchaToken

test/
├── app.e2e-spec.ts
└── jest-e2e.json
```

## Request flow — `POST /api/portfolio/contact-me`

1. `SecurityMiddleware` (global, all routes) — in production, rejects requests whose `Origin` header isn't on the allowlist (`envs.corsAllowedOriginDomains`). Bypassed entirely when `CORS_ENV=development`. (Previously also checked client IP against `CORS_ALLOW_IPS`; that was removed — see "Recent change" below.)
2. `ThrottlerGuard` (global default 5 req/s) + route-level `@Throttle({ contact: { limit: 3, ttl: 60000 } })` — 3 requests/minute on this endpoint specifically.
3. `HCaptchaGuard` — requires `captchaToken` in the body, calls `https://api.hcaptcha.com/siteverify`, throws `403` if missing/invalid/unreachable.
4. Global `ValidationPipe` — validates `PortfolioContactMeDto` (whitelist + forbidNonWhitelisted + transform), rejects unknown/invalid fields with a structured `400`.
5. Controller strips `captchaToken` from the payload and forwards the rest via `client.send('mail.send', payload)` over NATS to the `NATS_SERVICE` client proxy.
6. Downstream errors (`RpcException`) are caught and normalized by `RpcCustomExceptionFilter` into a consistent HTTP JSON envelope: `{ status, message, timestamp, path }`. A NestJS "Empty response" RPC error (e.g. downstream service unreachable) maps to `503`.

## Security posture (`main.ts` + middleware/guards)

- `bodyParser: false` on the Nest app, with explicit `express.json`/`urlencoded` limits (10 MB) applied manually — avoids default unbounded body parsing.
- `trust proxy` enabled (expects to sit behind a reverse proxy/load balancer).
- Helmet with HSTS (1yr, includeSubDomains) and a restrictive CSP (`default-src 'none'`, `connect-src 'self'`).
- Manually added headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), camera=()`.
- CORS: origin allowlist built from env-configured domains (+ dev-only local ports 3000/4200/8080/8081/5173), `GET, POST` only, `credentials: false`.
- Global prefix `api` — all routes are `/api/*`.
- App-level `ThrottlerGuard` registered via `APP_GUARD`.
- Custom `SecurityMiddleware` applied to `*path` (all routes) — a second, coarser layer of `Origin`-header allowlisting on top of CORS, active only outside development. **Behavior change from the IP-allowlist removal:** a request with **no `Origin` header at all** now gets `Origin: ''`, which is never in the allowlist, so it's **rejected with 403** in production — there's no more IP-based fallback for non-browser clients. This directly affects the CI health-check step (see CI/CD section) and any server-to-server caller that doesn't set an `Origin` header.

## Configuration (`src/config/envs.ts`)

Validated at boot with Joi; process exits (throws) if invalid. Required env vars (see `.env`, no `.env.example` currently committed):

| Var | Purpose |
|---|---|
| `PORT` | HTTP port the gateway listens on |
| `NATS_SERVERS` | Comma-separated list of NATS server URLs |
| `NATS_TOKEN` | **New (2026-09-16 merge from `main`).** Auth token passed to the NATS client (`transport/nats.module.ts`) |
| `CORS_ALLOW_DOMAINS` | Comma-separated domains → expanded into `http(s)://domain[:port]` origins |
| `CORS_ENV` | `development` \| `production` — toggles dev-only CORS ports and disables `SecurityMiddleware` |
| `HCAPTCHA_SECRET` | Secret used to verify captcha tokens against hCaptcha's API |
| `TZ` | (present in `.env`, not validated/consumed in `envs.ts`) |

`.unknown(true)` in the Joi schema means extra env vars are tolerated silently.

**⚠️ `CORS_ALLOW_IPS` was removed** in the 2026-09-16 merge from `main` (`corsAllowedOriginIPs` / IP-based allowlisting is gone from both `envs.ts` and `SecurityMiddleware`). `NATS_TOKEN` replaced it as a required var. **As of this merge, the local `.env` still has the old `CORS_ALLOW_IPS` (now inert) and is missing `NATS_TOKEN` — the app will fail Joi validation on boot until `NATS_TOKEN` is added.**

## Transport (NATS)

- Single client proxy registered under DI token `NATS_SERVICE` (`src/config/services.ts`), connecting to `envs.natsServers` with `token: envs.natsToken`, client name `client-gateway` (`src/transport/nats.module.ts`).
- Only one message pattern is currently sent: `mail.send`.
- A local `nats-server.conf` exists for running a self-hosted NATS broker (clustering config, 10 MB max payload, 2 min ping interval) — likely for local/dev docker-compose use, though no `docker-compose.yml` is present in this repo.
- **⚠️ Verified gap:** `nats-server.conf` has no `authorization` block, so the broker doesn't actually require or check any token — the client now sends `NATS_TOKEN`, but a locally-run broker off this config will accept connections whether or not that token is correct. If token auth is meant to be enforced (not just sent), the broker config needs an `authorization { token: "..." }` (or equivalent) entry to match — otherwise `NATS_TOKEN` currently provides no real access control against this repo's own broker config.

## Docker

- `dockerfile` — dev image: `node:21-alpine3.19`, `npm install`, copies full source, runs `npm run start:dev` (hot reload, not the CLAUDE.md multi-stage pattern).
- `dockerfile.prod` — 3-stage build (`deps` → `build` → `prod`), updated in the 2026-09-16 merge: base image bumped `node:21-alpine3.19` → **`node:22-alpine`**, `npm install` → `npm ci`, prod-prune step `npm ci -f --only=production` → `npm ci --omit=dev`. Still prunes to prod deps only, copies only `dist/` + prod `node_modules` into the final stage, runs as `USER node`, `CMD ["node", "dist/main.js"]`.
- **New deviation:** `dockerfile` (dev) and `dockerfile.prod` now target **different Node major versions** (21 vs 22) — worth aligning unless intentional.
- No `docker-compose.yml` / `docker-compose.prod.yml` / `.env.example` currently in the repo (README references them as expected setup steps: run a NATS container, populate `.env` from a template that doesn't yet exist).

## Testing

- Jest configured in `package.json` (`rootDir: src`, `*.spec.ts`), plus a separate e2e Jest config (`test/jest-e2e.json`) and one e2e spec (`test/app.e2e-spec.ts`, currently the default Nest starter test hitting `/`— note the app now uses global prefix `api`, so this spec is likely stale/would fail as-is).
- No unit test files (`*.spec.ts`) currently exist alongside the modules/guards/filters in `src/`.
- **Verified:** `npm test` currently **fails** (`No tests found, exiting with code 1`) because there are zero `*.spec.ts` files under `src/`. This is not hypothetical — it's the actual, current state of the repo. See the CI/CD section below for why this matters.

## CI/CD (`.github/workflows/ci-pipeline.yml`)

GitHub Actions workflow, triggers on push and PR to `main`. Two jobs:

1. **`build-and-test`** (always runs): checkout → Node 22 (`actions/setup-node`, npm cache) → `npm ci` → `npm run lint --if-present` → `npm test --if-present` → `npm run build`.
2. **`deploy`** (only on a direct push to `main`, and only if `build-and-test` succeeds): POSTs an HMAC-SHA256-signed payload (`secrets.WEBHOOK_SECRET`) to `https://webhook.dsantacruz.com/deploy/backend` to trigger the actual deploy, waits 30s, then health-checks `https://api.dsantacruz.com/api/portfolio/contact-me` with `curl -f`.

This confirms the production domains this gateway is deployed under: **api.dsantacruz.com** (the gateway itself) and **webhook.dsantacruz.com** (a separate deploy-trigger service). Requires a `WEBHOOK_SECRET` repo/environment secret in GitHub Actions.

**⚠️ Verified currently broken, in order:**
- `npm run lint` **fails** (exit 1) — 28 errors from `@typescript-eslint/no-unsafe-*` rules, almost all from untyped/`any` values: the hCaptcha `fetch().json()` response (`hcaptcha.guard.ts`), the destructured Joi `value` (`envs.ts`), `app.getHttpAdapter().getInstance()` (`main.ts`), and the caught RPC `err` (`portfolio-contact-me.controller.ts`). This directly contradicts the "no `any`, ever" rule.
- `npm test` **fails** (exit 1) — see Testing section above; Jest exits non-zero when it matches zero spec files, and `--if-present` only skips a *missing script*, not a failing one.
- Net effect: **`build-and-test` currently fails on every push/PR to `main`, which means `deploy` never runs** (it's gated on `needs: build-and-test`). The pipeline cannot currently reach the deploy step at all until lint errors are fixed and either test files are added or `test` is changed to tolerate zero tests (e.g. `jest --passWithNoTests`).
- Separately, the health-check step (`curl -f .../api/portfolio/contact-me` with no `-X POST`) sends a **GET** to a **POST-only** route — NestJS rejects that before the hCaptcha guard. As of the 2026-09-16 merge it's now doubly broken: even a correctly-shaped `POST` would also need an `Origin` header matching `CORS_ALLOW_DOMAINS`, or `SecurityMiddleware` 403s it first (see Security posture). A bare `curl -f` from a GitHub Actions runner sends neither the right method nor an `Origin` header, so this health check cannot currently pass regardless of whether the earlier job stages are fixed.

## Notable deviations from the standard project conventions (CLAUDE.md)

- `tsconfig.json` does not set `"strict": true` (`strictNullChecks` is on, but `noImplicitAny: false`) — narrower than the "strict everywhere, no `any`" rule, and consistent with the lint failures above.
- No `.env.example` committed despite the README instructing to create `.env` "based on the env.template."
- No `docker-compose.yml` despite `README.md` and `nats-server.conf` referencing a broader local-dev setup.
- `dockerfile` (dev) doesn't follow the multi-stage pattern — expected, since it's the dev/hot-reload image, not production.
- No test coverage despite the "80%+ on services and controllers" target and the CI pipeline running `npm test`.
- `nats-server.conf` doesn't enforce the new `NATS_TOKEN` (no `authorization` block) — token is sent but not required by this repo's own broker config.
- `dockerfile` (dev) and `dockerfile.prod` now diverge on Node major version (21 vs 22) after the 2026-09-16 merge.

## Current feature surface

Only one HTTP route exists today:

- `POST /api/portfolio/contact-me` — portfolio site contact form → NATS `mail.send` → downstream mail microservice.

There is currently no README-documented list of downstream services this gateway is meant to front beyond the mail service implied by `mail.send`.
