#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"
DB_NAME="${DB_NAME:-waahtickets-db}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@waahtickets.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-password}"
RUN_ID="$(date +%Y%m%d%H%M%S)-$RANDOM"
COOKIE_JAR="/tmp/waah-btn-${RUN_ID}.cookies"

EVENT_ID="evt-btn-${RUN_ID}"
LOCATION_ID="loc-btn-${RUN_ID}"
TICKET_TYPE_ID="tt-btn-${RUN_ID}"
ORG_ID="org-btn-${RUN_ID}"
CUSTOMER_ID="customer-$(date +%s%N)"
ORDER_ID="order-$(date +%s%N)"
ORDER_ITEM_ID="oi-btn-${RUN_ID}"
SUFFIX="$(printf '%s' "${ORDER_ID}" | sed 's/^order-//')"
ORDER_NUMBER="WAH-$(printf '%s' "${SUFFIX}" | tr '[:lower:]' '[:upper:]')"

CUSTOMER_FIRST_NAME="Queue"
CUSTOMER_LAST_NAME="Button"
CUSTOMER_EMAIL="${CUSTOMER_EMAIL:-button-flow-${RUN_ID}@example.com}"
CUSTOMER_PHONE="+1555000${RANDOM}"
QUANTITY="${QUANTITY:-2}"
UNIT_PRICE_PAISA="${UNIT_PRICE_PAISA:-10000}"
TOTAL_PAISA="$((QUANTITY * UNIT_PRICE_PAISA))"
ORDER_CURRENCY="${ORDER_CURRENCY:-USD}"
ADMIN_PASSWORD_HASH="${ADMIN_PASSWORD_HASH:-}"

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

json_count() {
  local json="$1"
  printf '%s' "$json" | node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const rows=(data[0]&&data[0].results)||[];process.stdout.write(String(rows.length));"
}

json_first_id() {
  local json="$1"
  printf '%s' "$json" | node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));const rows=(data[0]&&data[0].results)||[];process.stdout.write(rows[0]?.id ?? '');"
}

bootstrap_admin_user() {
  local admin_password_hash="$ADMIN_PASSWORD_HASH"
  if [[ -z "$admin_password_hash" ]]; then
    admin_password_hash="$(node - "$ADMIN_PASSWORD" <<'NODE'
const crypto = require('crypto')
const password = process.argv[2]
const salt = crypto.randomBytes(16)
const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
process.stdout.write(`pbkdf2$100000$${salt.toString('base64')}$${hash.toString('base64')}`)
NODE
)"
  fi

  log "Bootstrapping local admin credentials for ${ADMIN_EMAIL}"
  npx wrangler d1 execute "$DB_NAME" --local --command "
INSERT OR IGNORE INTO users (
  id, first_name, last_name, email, password_hash, webrole,
  is_active, is_email_verified, auth_provider, created_at, updated_at
) VALUES (
  'local-admin-bootstrap', 'Local', 'Admin', '${ADMIN_EMAIL}', '${admin_password_hash}', 'Admin',
  1, 1, 'password', datetime('now'), datetime('now')
);

UPDATE users
SET password_hash='${admin_password_hash}', webrole='Admin', auth_provider='password', updated_at=datetime('now')
WHERE email='${ADMIN_EMAIL}';

INSERT OR IGNORE INTO user_web_roles (id, user_id, web_role_id, created_at)
SELECT 'local-admin-role-link', id, 'role-admin', datetime('now')
FROM users
WHERE email='${ADMIN_EMAIL}';
"
}

log "Checking local worker health at ${BASE_URL}/health"
health_response="$(curl -sS -o /tmp/waah-health-${RUN_ID}.json -w '%{http_code}' "${BASE_URL}/health" || true)"
if [[ "$health_response" != "200" ]]; then
  echo "Wrangler dev is not reachable at ${BASE_URL}. Start it first:" >&2
  echo "  npx wrangler dev --port 8787" >&2
  exit 1
fi
rm -f /tmp/waah-health-${RUN_ID}.json

log "Logging in as admin (${ADMIN_EMAIL})"
login_response="$(curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "${BASE_URL}/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" -w $'\n%{http_code}')"
login_status="${login_response##*$'\n'}"
login_payload="${login_response%$'\n'*}"

if [[ "$login_status" == "401" ]]; then
  bootstrap_admin_user
  login_response="$(curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "${BASE_URL}/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" -w $'\n%{http_code}')"
  login_status="${login_response##*$'\n'}"
  login_payload="${login_response%$'\n'*}"
fi

if [[ "$login_status" != "200" ]]; then
  echo "Request failed: POST ${BASE_URL}/api/auth/login" >&2
  echo "Expected status: 200, got: ${login_status}" >&2
  echo "Response: ${login_payload}" >&2
  exit 1
fi

logged_in_role="$(extract_json_field "$login_payload" "webrole")"
if [[ "${logged_in_role}" != "Admin" ]]; then
  echo "Expected Admin login, got webrole='${logged_in_role}'" >&2
  echo "$login_payload" >&2
  exit 1
fi

log "Creating event setup (organization, event, location, ticket type)"
request_json POST "${BASE_URL}/api/organizations" "{\"id\":\"${ORG_ID}\",\"name\":\"Button Flow Org ${RUN_ID}\"}" 201 >/dev/null
request_json POST "${BASE_URL}/api/events" "{\"id\":\"${EVENT_ID}\",\"organization_id\":\"${ORG_ID}\",\"name\":\"Button Flow Event ${RUN_ID}\",\"slug\":\"button-flow-event-${RUN_ID}\",\"start_datetime\":\"2026-06-01T18:00:00.000Z\",\"end_datetime\":\"2026-06-01T21:00:00.000Z\",\"status\":\"published\"}" 201 >/dev/null

request_json POST "${BASE_URL}/api/event-locations" "{\"id\":\"${LOCATION_ID}\",\"event_id\":\"${EVENT_ID}\",\"name\":\"Button Flow Hall\",\"address\":\"123 Test St\",\"is_active\":1}" 201 >/dev/null
request_json POST "${BASE_URL}/api/ticket-types" "{\"id\":\"${TICKET_TYPE_ID}\",\"event_id\":\"${EVENT_ID}\",\"event_location_id\":\"${LOCATION_ID}\",\"name\":\"General Admission\",\"price_paisa\":${UNIT_PRICE_PAISA},\"currency\":\"${ORDER_CURRENCY}\",\"quantity_available\":100,\"is_active\":1}" 201 >/dev/null

log "Running button-equivalent writes"
existing_user_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT id
FROM users
WHERE lower(email) = lower('${CUSTOMER_EMAIL}')
LIMIT 1;
")"
existing_user_id="$(json_first_id "$existing_user_json")"
if [[ -n "$existing_user_id" ]]; then
  CUSTOMER_ID="$existing_user_id"
  log "Reusing existing user for ${CUSTOMER_EMAIL}: ${CUSTOMER_ID}"
else
  request_json POST "${BASE_URL}/api/users" "{\"id\":\"${CUSTOMER_ID}\",\"first_name\":\"${CUSTOMER_FIRST_NAME}\",\"last_name\":\"${CUSTOMER_LAST_NAME}\",\"email\":\"${CUSTOMER_EMAIL}\",\"phone_number\":\"${CUSTOMER_PHONE}\",\"webrole\":\"Customers\"}" 201 >/dev/null
fi

existing_customer_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT id
FROM customers
WHERE user_id = '${CUSTOMER_ID}'
LIMIT 1;
")"
existing_customer_id="$(json_first_id "$existing_customer_json")"
if [[ -n "$existing_customer_id" ]]; then
  log "Reusing existing customer profile for user ${CUSTOMER_ID}: ${existing_customer_id}"
else
  request_json POST "${BASE_URL}/api/customers" "{\"id\":\"customer-profile-${SUFFIX}\",\"user_id\":\"${CUSTOMER_ID}\",\"display_name\":\"${CUSTOMER_FIRST_NAME} ${CUSTOMER_LAST_NAME}\",\"email\":\"${CUSTOMER_EMAIL}\",\"phone_number\":\"${CUSTOMER_PHONE}\"}" 201 >/dev/null
fi

request_json POST "${BASE_URL}/api/orders" "{\"id\":\"${ORDER_ID}\",\"order_number\":\"${ORDER_NUMBER}\",\"customer_id\":\"${CUSTOMER_ID}\",\"event_id\":\"${EVENT_ID}\",\"event_location_id\":\"${LOCATION_ID}\",\"status\":\"paid\",\"subtotal_amount_paisa\":${TOTAL_PAISA},\"total_amount_paisa\":${TOTAL_PAISA},\"currency\":\"${ORDER_CURRENCY}\",\"order_datetime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" 201 >/dev/null

request_json POST "${BASE_URL}/api/order-items" "{\"id\":\"${ORDER_ITEM_ID}\",\"order_id\":\"${ORDER_ID}\",\"ticket_type_id\":\"${TICKET_TYPE_ID}\",\"quantity\":${QUANTITY},\"unit_price_paisa\":${UNIT_PRICE_PAISA},\"subtotal_amount_paisa\":${TOTAL_PAISA},\"total_amount_paisa\":${TOTAL_PAISA}}" 201 >/dev/null

log "Waiting 4 seconds for queue consumer"
sleep 4

log "Inspecting queue/message rows"
queue_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT
  notification_queue.id,
  notification_queue.status,
  notification_queue.retry_count,
  notification_queue.last_error,
  messages.recipient_email,
  messages.subject
FROM notification_queue
JOIN messages ON messages.id = notification_queue.message_id
WHERE messages.regarding_entity_type = 'order'
  AND messages.regarding_entity_id = '${ORDER_ID}'
ORDER BY notification_queue.created_at DESC;
")"

message_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT id, message_type, status, recipient_email
FROM messages
WHERE regarding_entity_type = 'order'
  AND regarding_entity_id = '${ORDER_ID}'
ORDER BY created_at DESC;
")"

payments_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT id FROM payments WHERE order_id = '${ORDER_ID}';
")"

tickets_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT id FROM tickets WHERE order_id = '${ORDER_ID}';
")"

queue_count="$(json_count "$queue_json")"
message_count="$(json_count "$message_json")"
payments_count="$(json_count "$payments_json")"
tickets_count="$(json_count "$tickets_json")"

echo "$queue_json"
echo "$message_json"

if [[ "$queue_count" -eq 0 || "$message_count" -eq 0 ]]; then
  cat <<TROUBLESHOOT >&2

Button flow write test failed: queue/message rows were not created.
Troubleshooting:
1. Confirm wrangler dev is running with queue consumer configured.
2. Confirm this repo's latest worker code is active.
3. Confirm order status is written as 'paid'.
4. Tail logs: npx wrangler tail --format pretty
TROUBLESHOOT
  exit 1
fi

if [[ "$payments_count" -ne 0 || "$tickets_count" -ne 0 ]]; then
  cat <<TROUBLESHOOT >&2

Button flow mismatch: payments/tickets rows exist, but UI button does not create those rows directly.
payments_count=${payments_count}
tickets_count=${tickets_count}
TROUBLESHOOT
  exit 1
fi

cat <<SUMMARY

Done. Button flow DB write test passed.
Order id: ${ORDER_ID}
Customer id: ${CUSTOMER_ID}
Queue rows: ${queue_count}
Message rows: ${message_count}
Payments rows (expected 0): ${payments_count}
Tickets rows (expected 0): ${tickets_count}
SUMMARY
