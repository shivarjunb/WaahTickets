# Waahtickets API

The Cloudflare Worker exposes D1-backed CRUD endpoints under `/api`.

## Discovery

List supported resources:

```bash
curl http://localhost:8787/api/resources
```

Check the D1 binding and tables:

```bash
curl http://localhost:8787/api/database/status
```

## CRUD Pattern

Every schema table can be accessed with the same shape:

```bash
GET    /api/:resource
POST   /api/:resource
GET    /api/:resource/:id
PATCH  /api/:resource/:id
DELETE /api/:resource/:id
```

Examples:

```bash
curl -X POST http://localhost:8787/api/customers \
  -H 'Content-Type: application/json' \
  -d '{"first_name":"Asha","last_name":"Customer","email":"asha@example.com"}'
```

```bash
curl -X POST http://localhost:8787/api/events \
  -H 'Content-Type: application/json' \
  -d '{
    "organization_id": "org_123",
    "name": "Launch Night",
    "slug": "launch-night",
    "start_datetime": "2026-06-01T18:00:00.000Z",
    "end_datetime": "2026-06-01T22:00:00.000Z"
  }'
```

```bash
curl 'http://localhost:8787/api/events?organization_id=org_123&limit=20'
```

```bash
curl -X PATCH http://localhost:8787/api/events/event_123 \
  -H 'Content-Type: application/json' \
  -d '{"status":"published"}'
```

## Resources

Supported resources:

```text
users
organizations
organization_users
files
events
event_locations
ticket_types
orders
order_items
payments
tickets
messages
notification_queue
ticket_scans
coupons
coupon_redemptions
```

Convenience aliases:

```text
customers -> users
event-locations -> event_locations
organization-users -> organization_users
ticket-types -> ticket_types
order-items -> order_items
notification-queue -> notification_queue
ticket-scans -> ticket_scans
coupon-redemptions -> coupon_redemptions
```

The API automatically fills `id`, `created_at`, and `updated_at` when those columns exist and the request does not provide them.

## Admin UI

The React app includes an admin CRUD console at:

```text
/#admin
```

Run the Worker with D1 bindings before using it:

```bash
npm run build
npx wrangler dev --local --port 8787
```

Then open:

```text
http://localhost:8787/#admin
```
