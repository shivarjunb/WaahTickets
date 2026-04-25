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
