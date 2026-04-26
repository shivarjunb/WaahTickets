#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"
DB_NAME="${DB_NAME:-waahtickets-db}"
RUN_ID="$(date +%Y%m%d%H%M%S)-$RANDOM"
EMAIL="queue-test-${RUN_ID}@example.com"
PASSWORD="Passw0rd!123"
COOKIE_JAR="/tmp/waah-${RUN_ID}.cookies"

ORG_ID="org-${RUN_ID}"
ORG_USER_LINK_ID="org-user-${RUN_ID}"
EVENT_ID="evt-${RUN_ID}"
LOCATION_ID="loc-${RUN_ID}"
TICKET_TYPE_ID="tt-${RUN_ID}"
ORDER_ID="ord-${RUN_ID}"
ORDER_ITEM_ID="oi-${RUN_ID}"
TICKET_ID="tkt-${RUN_ID}"
PAYMENT_ID="pay-${RUN_ID}"

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

log() {
  printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd npx
require_cmd node

request_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local expected_status="${4:-200}"

  local response
  local status
  local payload

  if [[ -n "$body" ]]; then
    response="$(curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X "$method" "$url" -H 'Content-Type: application/json' -d "$body" -w $'\n%{http_code}')"
  else
    response="$(curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X "$method" "$url" -w $'\n%{http_code}')"
  fi

  status="${response##*$'\n'}"
  payload="${response%$'\n'*}"

  if [[ "$status" != "$expected_status" ]]; then
    echo "Request failed: $method $url" >&2
    echo "Expected status: $expected_status, got: $status" >&2
    echo "Response: $payload" >&2
    exit 1
  fi

  printf '%s' "$payload"
}

extract_json_field() {
  local json="$1"
  local regex="$2"
  printf '%s' "$json" | sed -n "s/.*\"${regex}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n 1
}

log "Checking local worker health at ${BASE_URL}/health"
health_response="$(curl -sS -o /tmp/waah-health-${RUN_ID}.json -w '%{http_code}' "${BASE_URL}/health" || true)"
if [[ "$health_response" != "200" ]]; then
  echo "Wrangler dev is not reachable at ${BASE_URL}. Start it first:" >&2
  echo "  npx wrangler dev --port 8787" >&2
  exit 1
fi
rm -f /tmp/waah-health-${RUN_ID}.json

log "Registering test user: ${EMAIL}"
register_payload="$(request_json POST "${BASE_URL}/api/auth/register" "{\"first_name\":\"Queue\",\"last_name\":\"Tester\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" 200)"

USER_ID="$(extract_json_field "$register_payload" "id")"
if [[ -z "$USER_ID" ]]; then
  echo "Unable to parse user id from register response:" >&2
  echo "$register_payload" >&2
  exit 1
fi
log "Test user id: ${USER_ID}"

log "Promoting user to Organizations and creating org link"
npx wrangler d1 execute "$DB_NAME" --local --command "
UPDATE users SET webrole='Organizations' WHERE id='${USER_ID}';
INSERT INTO organizations (id,name,created_at,updated_at)
VALUES ('${ORG_ID}','Queue Test Org ${RUN_ID}',datetime('now'),datetime('now'));
INSERT INTO organization_users (id,organization_id,user_id,role,created_at)
VALUES ('${ORG_USER_LINK_ID}','${ORG_ID}','${USER_ID}','admin',datetime('now'));
"

log "Creating event"
request_json POST "${BASE_URL}/api/events" "{\"id\":\"${EVENT_ID}\",\"organization_id\":\"${ORG_ID}\",\"name\":\"Queue Test Event ${RUN_ID}\",\"slug\":\"queue-test-event-${RUN_ID}\",\"start_datetime\":\"2026-06-01T18:00:00.000Z\",\"end_datetime\":\"2026-06-01T21:00:00.000Z\",\"status\":\"published\"}" 201 >/dev/null

log "Creating event location"
request_json POST "${BASE_URL}/api/event-locations" "{\"id\":\"${LOCATION_ID}\",\"event_id\":\"${EVENT_ID}\",\"name\":\"Queue Test Hall\",\"address\":\"123 Test St\",\"is_active\":1}" 201 >/dev/null

log "Creating ticket type"
request_json POST "${BASE_URL}/api/ticket-types" "{\"id\":\"${TICKET_TYPE_ID}\",\"event_id\":\"${EVENT_ID}\",\"event_location_id\":\"${LOCATION_ID}\",\"name\":\"General Admission\",\"price_paisa\":10000,\"currency\":\"USD\",\"quantity_available\":100,\"is_active\":1}" 201 >/dev/null

log "Creating pending order (no queue yet)"
request_json POST "${BASE_URL}/api/orders" "{\"id\":\"${ORDER_ID}\",\"order_number\":\"WT-${RUN_ID}\",\"customer_id\":\"${USER_ID}\",\"event_id\":\"${EVENT_ID}\",\"event_location_id\":\"${LOCATION_ID}\",\"status\":\"pending\",\"subtotal_amount_paisa\":10000,\"discount_amount_paisa\":0,\"tax_amount_paisa\":0,\"total_amount_paisa\":10000,\"currency\":\"USD\",\"order_datetime\":\"2026-04-26T00:00:00.000Z\"}" 201 >/dev/null

log "Seeding order item, ticket, and payment directly in D1"
npx wrangler d1 execute "$DB_NAME" --local --command "
INSERT INTO order_items (
  id, order_id, ticket_type_id, quantity, unit_price_paisa,
  subtotal_amount_paisa, discount_amount_paisa, total_amount_paisa,
  description, created_at
) VALUES (
  '${ORDER_ITEM_ID}', '${ORDER_ID}', '${TICKET_TYPE_ID}', 1, 10000,
  10000, 0, 10000,
  'General Admission', datetime('now')
);

INSERT INTO tickets (
  id, ticket_number, order_id, order_item_id, event_id,
  event_location_id, ticket_type_id, customer_id,
  qr_code_value, barcode_value, status, is_paid,
  created_at, updated_at
) VALUES (
  '${TICKET_ID}', 'TKT-${RUN_ID}', '${ORDER_ID}', '${ORDER_ITEM_ID}', '${EVENT_ID}',
  '${LOCATION_ID}', '${TICKET_TYPE_ID}', '${USER_ID}',
  'QR-${RUN_ID}', 'BAR-${RUN_ID}', 'active', 1,
  datetime('now'), datetime('now')
);

INSERT INTO payments (
  id, order_id, customer_id, payment_provider, amount_paisa,
  currency, status, payment_datetime, created_at, updated_at
) VALUES (
  '${PAYMENT_ID}', '${ORDER_ID}', '${USER_ID}', 'manual', 10000,
  'USD', 'initiated', datetime('now'), datetime('now'), datetime('now')
);
"

log "Triggering queue by updating order status to paid"
request_json PATCH "${BASE_URL}/api/orders/${ORDER_ID}" "{\"status\":\"paid\"}" 200 >/dev/null

log "Waiting 4 seconds for queue consumer"
sleep 4

log "Notification queue rows for order ${ORDER_ID}"
queue_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT
  notification_queue.id,
  notification_queue.status,
  notification_queue.retry_count,
  notification_queue.sent_at,
  notification_queue.last_error,
  notification_queue.provider,
  notification_queue.provider_message_id,
  messages.recipient_email,
  messages.subject
FROM notification_queue
JOIN messages ON messages.id = notification_queue.message_id
WHERE messages.regarding_entity_type = 'order'
  AND messages.regarding_entity_id = '${ORDER_ID}'
ORDER BY notification_queue.created_at DESC;
")"

echo "$queue_json"

queue_count="$(printf '%s' "$queue_json" | node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const rows=(data[0]&&data[0].results)||[];process.stdout.write(String(rows.length));")"

log "Message rows for order ${ORDER_ID}"
message_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT id, message_type, status, subject, recipient_email, updated_at
FROM messages
WHERE regarding_entity_type = 'order'
  AND regarding_entity_id = '${ORDER_ID}'
ORDER BY created_at DESC;
")"

echo "$message_json"

message_count="$(printf '%s' "$message_json" | node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const rows=(data[0]&&data[0].results)||[];process.stdout.write(String(rows.length));")"

if [[ "$queue_count" -eq 0 || "$message_count" -eq 0 ]]; then
  cat <<TROUBLESHOOT >&2

Queue/message rows were not created for order ${ORDER_ID}.
Troubleshooting:
1. Confirm wrangler dev is running from this repo and freshly restarted after queue config changes.
2. Confirm EMAIL_QUEUE binding is active in worker startup output.
3. Confirm order status PATCH to 'paid' succeeded (script does check this).
4. Confirm you're testing local DB state used by wrangler dev (--local).
TROUBLESHOOT
  exit 1
fi

cat <<SUMMARY

Done. Test run id: ${RUN_ID}
Order id: ${ORDER_ID}
User email: ${EMAIL}

Expected outcomes:
- Without verified sender/API key: queue row typically retries/fails with provider error.
- With valid sender/API key: queue row should become 'sent' and provider_message_id should be populated.
SUMMARY
