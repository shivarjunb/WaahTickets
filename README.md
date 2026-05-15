# Waahtickets

Waahtickets is a ticketing platform with:

- a React + Vite web app
- a Hono API
- a Cloudflare Worker deployment target
- a Cloudflare D1 database
- Redis-backed caching and queue-driven email notifications

This repository has now started the transition from a single web app layout to a shared `web + mobile` structure.

The mobile foundation is now in its second phase: the Expo app has moved beyond a placeholder and now includes shared API wiring, environment-based backend configuration, and secure-storage helpers for the upcoming mobile auth flow.

The mobile workspace is now targeting `Expo SDK 54` so it can be tested more easily with the current store-distributed Expo Go app.

Push notifications are now in a transition phase: Expo token delivery is still active, and the backend now includes provider-aware scaffolding (`expo`, `fcm`, `apns`) plus optional campaign `image_url` fields for rich-notification rollout.

## Documentation Rule

Moving forward, every meaningful structural or architectural change should also update this `README.md`.

The goal is to keep this file useful for:

- understanding the current repo layout
- onboarding later contributors
- tracing why major structure decisions were made
- making future refactors safer

If code changes affect setup, scripts, architecture, package boundaries, auth flow, or runtime assumptions, update this file in the same change.

## Current Architecture

- Web frontend: React 19 + Vite
- API server: Hono
- Runtime target: Node for local server, Cloudflare Worker for deployment
- Database: Cloudflare D1
- Cache: Upstash Redis
- Email delivery: Cloudflare Queues + SendGrid
- Planned mobile app: Expo / React Native

## Repository Structure

This is the current intended structure after the first mobile-app scaffold:

```text
.
├── apps/
│   ├── mobile/
│   │   ├── .env.example
│   │   ├── App.tsx
│   │   ├── app.json
│   │   ├── babel.config.js
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── config/api.ts
│   │   │   └── lib/session-storage.ts
│   │   └── tsconfig.json
│   └── web/
│       └── src/
│           ├── main.tsx
│           └── styles.css
├── client/
│   ├── main.tsx
│   └── styles.css
├── migrations/
├── packages/
│   ├── api-client/
│   │   ├── package.json
│   │   └── src/index.ts
│   └── shared-types/
│       ├── package.json
│       └── src/index.ts
├── public/
├── scripts/
├── src/
│   ├── api/
│   ├── auth/
│   ├── cache/
│   ├── db/
│   ├── notifications/
│   ├── types/
│   ├── utils/
│   ├── app.ts
│   ├── index.ts
│   └── worker.ts
├── tests/
├── API.md
├── DATABASE.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.jsonc
```

## What Changed In Phase 1

The first phase was intentionally non-destructive.

- `apps/web/src/main.tsx` now holds the real web app entry file.
- `apps/web/src/styles.css` now holds the real web stylesheet.
- `client/main.tsx` is now a compatibility shim that imports `apps/web/src/main.tsx`.
- `client/styles.css` is now a compatibility shim that imports `apps/web/src/styles.css`.
- `apps/mobile/` has been scaffolded as a new Expo app.
- `packages/shared-types/` has been added for shared domain types.
- `packages/api-client/` has been added for shared API access logic.
- root `package.json` now declares npm workspaces and adds mobile helper scripts.

This keeps the current web app working while we gradually move toward a cleaner monorepo layout.

## What Changed In Phase 3

The third mobile-app phase turns the Expo scaffold into a workable app surface instead of a static placeholder.

- `apps/mobile/App.tsx` now includes a modern mobile shell with `Discover`, `Tickets`, and `Account` sections.
- the mobile app now uses the shared workspace packages instead of only local placeholder values
- `packages/api-client/` now exposes reusable JSON POST auth helpers and clearer network error messaging
- `packages/shared-types/` now includes mobile session, list-envelope, and auth-session payload types
- `apps/mobile/.env.example` documents `EXPO_PUBLIC_API_BASE_URL`
- `apps/mobile/src/config/api.ts` centralizes mobile API base URL resolution
- `apps/mobile/src/lib/session-storage.ts` centralizes secure token/session persistence
- the mobile app now loads public events and event ticket types from the same public API used by web
- mobile login and register now return bearer-token sessions for Expo secure storage
- protected backend routes now accept either the existing web cookie or a bearer token backed by `auth_sessions`

This keeps the current web runtime intact while making the mobile app genuinely usable for shared API work.

## Why This Structure

The long-term goal is:

- one backend API shared by web and mobile
- one database behind the API only
- shared business/domain code where it helps
- separate UI layers for web and mobile

What we want to share:

- API client code
- TypeScript domain types
- validation helpers
- cart, ticket, pricing, and checkout business rules

What should stay platform-specific:

- React web UI
- React Native UI
- browser-only behavior
- native device integrations like camera, notifications, and secure storage

## Web App Notes

The web app still builds through the existing Vite setup.

Important note:

- `index.html` still points at `/client/main.tsx`
- `client/main.tsx` now forwards to `apps/web/src/main.tsx`

That is temporary and intentional. It lets us move files without breaking the current web build on day one.

## Settings Surface Notes

- Admin settings now includes a dedicated `Hero` tab for configuring the public homepage hero.
- Hero configuration is stored in the shared `app_settings` table and exposed to the storefront through `GET /api/public/hero/settings`.
- The public homepage hero reads slider behavior, slide content, CTA links, and fallback overlay text from that saved hero configuration.

## Mobile App Notes

The mobile app scaffold lives in `apps/mobile/` and is intended for Expo / React Native.

Current status:

- initial Expo package scaffold added
- modern app shell added with event hero, richer cards, and account state
- shared API client wired in
- secure mobile session storage helpers added
- public events feed wired to the same backend used by web
- public ticket-type loading wired to the same backend used by web
- mobile login / register flow now returns secure bearer-token sessions
- bearer-token auth now works on the backend alongside the web cookie session flow
- mobile workspace moved from Expo SDK 55 to Expo SDK 54 for broader Expo Go compatibility
- workspace dependencies installed
- Expo dev server verified to start successfully

Planned mobile-first feature path:

1. Sign in / register
2. Event list
3. Event details
4. Cart / checkout
5. My tickets
6. Ticket validator / QR scan flow

## Auth Direction

Current web auth is cookie-session based.

For shared web + mobile support, the intended direction is:

- Web: keep cookie-session auth
- Mobile: add token-based auth suitable for secure device storage

That mobile-friendly flow is now in place for email/password auth while preserving the current web-cookie behavior.

## Shared Packages

### `packages/shared-types`

This package is the starting point for shared domain and API-facing types.

Current contents include:

- auth user type
- auth session payload type
- public event type
- ticket type
- cart item type
- generic API envelope type
- list envelope type
- mobile session state

### `packages/api-client`

This package is the starting point for shared API access logic.

Current contents include:

- `createApiClient(...)`
- bearer-token aware request helper
- JSON request helper
- starter methods for:
  - `GET /api/auth/me`
  - `GET /api/public/events`
  - `GET /api/public/events/:id/ticket-types`

These packages are intentionally small right now. They will grow as we extract code from the current web app and align mobile usage.

## Root Scripts

Current root scripts include:

- `npm run dev`
- `npm run dev:server`
- `npm run dev:cloudflare`
- `npm run dev:cloudflare:lan`
- `npm run dev:cloudflare:remote`
- `npm run build`
- `npm test`
- `npm run deploy`

New mobile helper scripts added:

- `npm run mobile:dev`
- `npm run mobile:android`
- `npm run mobile:ios`

Important:

- Expo local device testing will also need a reachable API base URL, not `127.0.0.1`, when running on a physical phone

## Local Development

### Web frontend

```bash
npm run dev
```

### Local Node server

```bash
npm run dev:server
```

### Local Cloudflare Worker

```bash
npm run build
npx wrangler dev --local --port 8787
```

For physical-phone testing on the same Wi-Fi, start the Worker on your LAN too:

```bash
npm run dev:cloudflare:lan
```

### Mobile app

Inside `apps/mobile`, create `.env` from `.env.example` if needed:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8787
```

Then run from the repo root:

```bash
npm run mobile:dev
```

Important for device testing:

- `127.0.0.1` works for simulators running on the same machine in some setups
- for a physical phone, point `EXPO_PUBLIC_API_BASE_URL` at your computer's LAN IP or a public tunnel URL
- for this machine, use `http://192.168.1.83:8787` after starting `npm run dev:cloudflare:lan`
- the mobile app now shows connection guidance inline when a loopback URL is used on a device
- SDK 54 is being used intentionally so the project is easier to open in the current App Store / Play Store Expo Go release

## API Overview

The Cloudflare Worker exposes D1-backed CRUD endpoints under `/api`.

See [API.md](./API.md) for:

- resource discovery
- CRUD patterns
- authentication endpoints
- public events endpoints
- notification behavior

Push notification endpoints now support a phased native rollout:

- `POST /api/mobile/push/register` accepts `provider` (`expo` / `fcm` / `apns`) and optional device metadata (`device_id`, `app_bundle_id`, `environment`).
- `POST /api/admin/push/send` accepts optional `image_url` in addition to `title`, `body`, and `event_id`.
- Current delivery behavior is still Expo-first; native provider senders are scaffolded for subsequent phases.

## Database Overview

The D1 schema and migration details live in [DATABASE.md](./DATABASE.md).

Key commands:

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

## Redis Cache Environment Variables

Upstash Redis caching uses these environment variable names:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Cloudflare Wrangler

Set URL in `wrangler.jsonc` under `vars`:

```jsonc
"vars": {
  "UPSTASH_REDIS_REST_URL": "https://YOUR-UPSTASH-ENDPOINT.upstash.io"
}
```

Set token as a secret:

```bash
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

### Local Node Runtime

When running `npm run dev:server`, export:

```bash
export UPSTASH_REDIS_REST_URL="https://YOUR-UPSTASH-ENDPOINT.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="YOUR-UPSTASH-TOKEN"
```

## Queue + Email Variables

Order confirmations are queued through Cloudflare Queues and sent by the Worker queue consumer.
Account created/deleted emails use the same queue + consumer path.
Account-created emails include a one-click verify button at `/api/auth/verify-email`.

- `EMAIL_FROM`
- `SENDGRID_API_KEY`

Create queue once:

```bash
npx wrangler queues create waahtickets-email-queue
```

Set secret:

```bash
npx wrangler secret put SENDGRID_API_KEY
```

For local Wrangler development (`npm run dev:cloudflare`), set in `.dev.vars`:

```bash
EMAIL_FROM="WaahTickets <tickets@your-domain.com>"
SENDGRID_API_KEY="SG.xxxxx.yyyyy"
```

For deployed environments, keep `EMAIL_FROM` in `wrangler.jsonc` `vars` and set `SENDGRID_API_KEY` with:

```bash
npx wrangler secret put SENDGRID_API_KEY
```

Admin runtime diagnostics:

- `GET /api/settings/notifications`
- returns `email_queue_bound`, `sendgrid_api_key_configured`, `email_from_configured`, `can_attempt_send`, `runtime_note`

Run local queue integration tests:

```bash
./scripts/test-email-queue-local.sh
./scripts/test-account-email-queue-local.sh
```

## Khalti Payment Secrets

Khalti checkout supports sandbox (`test`) and production (`live`) modes.

Set these Worker secrets:

- `KHALTI_TEST_SECRET_KEY`
- `KHALTI_LIVE_SECRET_KEY`

```bash
npx wrangler secret put KHALTI_TEST_SECRET_KEY
npx wrangler secret put KHALTI_LIVE_SECRET_KEY
```

Khalti public keys are stored in admin settings, not Wrangler secrets:

- `Settings -> Payments -> Test public key`
- `Settings -> Payments -> Live public key`

After setting secrets, configure Khalti from admin:

- `Settings -> Payments`
- toggle `Enable Khalti checkout`
- select `Mode` (`test` or `live`)
- set `Return URL` and `Website URL`
- save public keys for both modes

## Next Recommended Steps

Suggested next implementation phases:

1. Build signed-in customer ticket and checkout screens in Expo.
2. Extract more business logic from the large web app into shared packages.
3. Add the validator scan flow with `expo-camera`.
4. Add mobile-friendly Google sign-in or deep-link auth completion.
5. Split the mobile shell into smaller screen/components files as the feature set grows.

## Verification Notes

This phase was designed to keep the existing web app path intact while introducing the new folder structure.

What was not completed in this phase:

- mobile checkout flow
- validating the full mobile UI on a simulator or physical device
- extracting the large web app into smaller modules yet

Those are expected follow-up steps.

## Expo Version Notes

The mobile workspace is pinned to `Expo SDK 54`.

Reason:

- Expo's official SDK compatibility table lists SDK `54.0.0` with `React Native 0.81` and `React 19.1.0`
- Expo's official package docs for SDK 54 list bundled package versions including:
  - `expo-camera ~17.0.10`
  - `expo-secure-store ~15.0.8`
  - `expo-status-bar ~3.0.9`
- Expo CLI also expects the SDK 54 line to use `react-native 0.81.5` and `@types/react ~19.1.10` for a clean local dev experience
- the current store-distributed Expo Go app has had a transition period around SDK 55, so SDK 54 is the safer target for straightforward device testing

Sources:

- https://docs.expo.dev/versions/v54.0.0
- https://docs.expo.dev/versions/v54.0.0/sdk/camera/
- https://docs.expo.dev/versions/v54.0.0/sdk/securestore/
- https://docs.expo.dev/versions/v54.0.0/sdk/status-bar/
- https://expo.dev/changelog/expo-go-and-app-store-may-2026
