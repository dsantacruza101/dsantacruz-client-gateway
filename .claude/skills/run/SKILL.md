---
name: run
description: Launch the client-gateway NestJS app locally, including its NATS dependency. Use when asked to run, start, or verify this gateway is working (e.g. "run the app", "start the server", "check the contact-me endpoint works").
---

# Run client-gateway

This is a NestJS **API gateway** — it has no database, but it does nothing useful
without a NATS broker to talk to, and its one live route (`POST /api/portfolio/contact-me`)
also needs a downstream `mail`-pattern microservice to fully succeed. See
[context.md](../../../context.md) for full architecture details.

## 1. Check `.env`

The app fails to boot (Joi validation error) without these vars set:
`PORT`, `NATS_SERVERS`, `CORS_ALLOW_DOMAINS`, `CORS_ALLOW_IPS`, `CORS_ENV`, `HCAPTCHA_SECRET`.

A `.env` already exists in this repo for local dev (`PORT=3000`,
`NATS_SERVERS=nats://localhost:4222`, `CORS_ENV=development`). If it's missing, stop and
ask the user for values rather than inventing secrets (especially `HCAPTCHA_SECRET`).

With `CORS_ENV=development`, `SecurityMiddleware`'s IP/domain allowlist is bypassed, so
local requests from any origin/IP are allowed through (CORS itself still applies for
browser calls, but plain `curl`/Postman requests work regardless).

## 2. Ensure a NATS broker is running

The gateway connects to `NATS_SERVERS` on boot. Check first, don't blindly start a new one:

```bash
lsof -iTCP:4222 -sTCP:LISTEN
```

If nothing is listening, start one with Docker (per README.md):

```bash
docker run -d --name nats-server -p 4222:4222 -p 8222:8222 nats
```

(A `nats-server.conf` exists in the repo root for a more tuned config, but the plain
`nats` image above is what the README documents and is sufficient for local dev.)

If a container named `nats-server` already exists but is stopped: `docker start nats-server`
instead of creating a new one.

## 3. Install dependencies (if needed)

```bash
[ -d node_modules ] || npm install
```

## 4. Start the app

```bash
npm run start:dev
```

This runs with `--watch` (hot reload). Wait for the log line:

```
[Main-Gateway] Gateway running and ready
```

Run it with `run_in_background: true` (Bash tool) or as a background task — it's a
long-running dev server, not a one-shot command.

## 5. Verify it's actually working

The app has global prefix `api`, so there is no bare `/`. There's also no dedicated
health-check route. Confirm liveness by hitting the one real endpoint:

```bash
curl -i -X POST http://localhost:3000/api/portfolio/contact-me \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","subject":"Testing","message":"Just checking the gateway is up.","captchaToken":"placeholder"}'
```

Expected outcomes, both of which confirm the gateway itself is healthy:

- **`403 Forbidden`** — hCaptcha rejected the placeholder token. This is expected without
  a real token and proves the app booted, routing, validation, and the hCaptcha guard all work.
- **`503 Service Unavailable`** (`"Service temporarily unavailable"`) — only reachable if
  hCaptcha somehow passes; means NATS is up but no `mail`-pattern microservice is listening
  downstream. That's expected too, since that service isn't part of this repo.

A **`400`** with validation messages means the DTO shape was wrong (fine, adjust the payload).
A connection error/refused means the app itself never started — check the `npm run start:dev`
logs and confirm NATS is reachable at the configured `NATS_SERVERS`.

## Stopping

- App: stop the `npm run start:dev` background process.
- NATS: `docker stop nats-server` (leave it running across sessions if you'll re-run the
  app repeatedly — no need to tear it down each time).

## CI/CD awareness

`.github/workflows/ci-pipeline.yml` runs on every push/PR to `main`: lint → test → build,
and — only on a direct push to `main`, only if that job passes — triggers a **live
production deploy** to `api.dsantacruz.com` via a signed webhook. Do not push to `main`
casually; treat it as a deploy trigger, not just a CI trigger.

As of the last check, `npm run lint` and `npm test` both **currently fail** on this repo
as-is (pre-existing `any`-related lint errors, and zero `*.spec.ts` files for Jest to run)
— see [context.md](../../../context.md) for the verified details. That means:

- A failure from `npm run lint` or `npm test` while running this app is **not necessarily
  something you broke** — check whether it fails the same way on a clean checkout before
  assuming your change caused it.
- The `build-and-test` CI job is currently red on every run, so `deploy` never actually
  fires today regardless of what's pushed. Don't assume a green pipeline; check the Actions
  tab if it matters for the task at hand.
