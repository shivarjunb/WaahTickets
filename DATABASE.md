# Waahtickets D1 Database

The initial schema lives in:

```bash
migrations/0001_initial_schema.sql
```

Runtime settings (including R2 and ticket QR URL settings) are persisted in:

```bash
migrations/0006_app_settings.sql
```

Event featuring support (`events.is_featured`) is added in:

```bash
migrations/0007_events_featured_flag.sql
```

## Local D1

Apply migrations to Wrangler's local D1 database:

```bash
npm run db:migrate:local
```

Inspect local tables:

```bash
npx wrangler d1 execute waahtickets-db --local --command "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;"
```

## Cloudflare D1

Create the remote database:

```bash
npm run db:create
```

Copy the returned `database_id` into `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "waahtickets-db",
    "database_id": "your-cloudflare-d1-database-id",
    "migrations_dir": "migrations"
  }
]
```

Apply migrations to the remote database:

```bash
npm run db:migrate:remote
```

Deploy the Worker and React assets:

```bash
npm run deploy
```
