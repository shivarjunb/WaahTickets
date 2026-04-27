# Waahtickets

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
Account-created emails include a one-click verify button (`/api/auth/verify-email`) to authenticate the email address.

- `EMAIL_FROM` (plain env var)
- `SENDGRID_API_KEY` (Wrangler secret)

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
- Returns `email_queue_bound`, `sendgrid_api_key_configured`, `email_from_configured`, `can_attempt_send`, `runtime_note`.

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

Khalti also provides public keys. Store them in admin settings (not as Wrangler secrets):

- `Settings -> Payments -> Test public key`
- `Settings -> Payments -> Live public key`

After setting secrets, configure Khalti from admin:

- `Settings -> Payments`
- Toggle `Enable Khalti checkout`
- Select `Mode` (`test` or `live`)
- Set `Return URL` and `Website URL`
- Save public keys for both modes
