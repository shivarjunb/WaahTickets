#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"
DB_NAME="${DB_NAME:-waahtickets-db}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@waahtickets.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-password}"
ADMIN_PASSWORD_HASH="${ADMIN_PASSWORD_HASH:-}"
RUN_ID="$(date +%Y%m%d%H%M%S)-$RANDOM"
EMAIL="account-queue-test-${RUN_ID}@example.com"
PASSWORD="Passw0rd!123"
COOKIE_JAR="/tmp/waah-account-${RUN_ID}.cookies"

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
health_response="$(curl -sS -o /tmp/waah-account-health-${RUN_ID}.json -w '%{http_code}' "${BASE_URL}/health" || true)"
if [[ "$health_response" != "200" ]]; then
  echo "Wrangler dev is not reachable at ${BASE_URL}. Start it first:" >&2
  echo "  npx wrangler dev --port 8787" >&2
  exit 1
fi
rm -f /tmp/waah-account-health-${RUN_ID}.json

log "Registering test user: ${EMAIL}"
register_payload="$(request_json POST "${BASE_URL}/api/auth/register" "{\"first_name\":\"Account\",\"last_name\":\"Queue\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" 200)"
USER_ID="$(extract_json_field "$register_payload" "id")"
if [[ -z "$USER_ID" ]]; then
  echo "Unable to parse user id from register response:" >&2
  echo "$register_payload" >&2
  exit 1
fi

log "Waiting 4 seconds for account-created queue processing"
sleep 4

log "Inspecting account-created queue/message rows"
created_queue_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT
  notification_queue.id,
  notification_queue.status,
  notification_queue.retry_count,
  notification_queue.last_error,
  notification_queue.provider,
  notification_queue.provider_message_id,
  messages.message_type,
  messages.status AS message_status,
  messages.recipient_email,
  messages.subject
FROM notification_queue
JOIN messages ON messages.id = notification_queue.message_id
WHERE messages.regarding_entity_type = 'user'
  AND messages.regarding_entity_id = '${USER_ID}'
  AND messages.message_type = 'account_created'
ORDER BY notification_queue.created_at DESC;
")"

created_message_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT id, message_type, status, recipient_email, subject, updated_at
FROM messages
WHERE regarding_entity_type = 'user'
  AND regarding_entity_id = '${USER_ID}'
  AND message_type = 'account_created'
ORDER BY created_at DESC;
")"

created_queue_count="$(json_count "$created_queue_json")"
created_message_count="$(json_count "$created_message_json")"

if [[ "$created_queue_count" -eq 0 || "$created_message_count" -eq 0 ]]; then
  cat <<TROUBLESHOOT >&2

Account-created queue/message rows were not created for user ${USER_ID}.
Troubleshooting:
1. Confirm wrangler dev is running from this repo with EMAIL_QUEUE binding.
2. Confirm /api/auth/register succeeded and returned a user id.
3. Confirm you're testing local DB state used by wrangler dev (--local).
4. Tail logs: npx wrangler tail --format pretty
TROUBLESHOOT
  exit 1
fi

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

log "Deleting user ${USER_ID} via admin API"
request_json DELETE "${BASE_URL}/api/users/${USER_ID}" "" 200 >/dev/null

log "Waiting 4 seconds for account-deleted queue processing"
sleep 4

log "Inspecting account-deleted queue/message rows"
deleted_queue_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT
  notification_queue.id,
  notification_queue.status,
  notification_queue.retry_count,
  notification_queue.last_error,
  notification_queue.provider,
  notification_queue.provider_message_id,
  messages.message_type,
  messages.status AS message_status,
  messages.recipient_email,
  messages.subject
FROM notification_queue
JOIN messages ON messages.id = notification_queue.message_id
WHERE messages.regarding_entity_type = 'user'
  AND messages.regarding_entity_id = '${USER_ID}'
  AND messages.message_type = 'account_deleted'
ORDER BY notification_queue.created_at DESC;
")"

deleted_message_json="$(npx wrangler d1 execute "$DB_NAME" --local --json --command "
SELECT id, message_type, status, recipient_email, subject, updated_at
FROM messages
WHERE regarding_entity_type = 'user'
  AND regarding_entity_id = '${USER_ID}'
  AND message_type = 'account_deleted'
ORDER BY created_at DESC;
")"

deleted_queue_count="$(json_count "$deleted_queue_json")"
deleted_message_count="$(json_count "$deleted_message_json")"

if [[ "$deleted_queue_count" -eq 0 || "$deleted_message_count" -eq 0 ]]; then
  cat <<TROUBLESHOOT >&2

Account-deleted queue/message rows were not created for user ${USER_ID}.
Troubleshooting:
1. Confirm admin delete request succeeded for /api/users/${USER_ID}.
2. Confirm EMAIL_QUEUE binding is active in worker startup output.
3. Confirm you're checking local D1 state used by wrangler dev (--local).
4. Tail logs: npx wrangler tail --format pretty
TROUBLESHOOT
  exit 1
fi

echo "$created_queue_json"
echo "$created_message_json"
echo "$deleted_queue_json"
echo "$deleted_message_json"

cat <<SUMMARY

Done. Account lifecycle queue test passed.
Run id: ${RUN_ID}
User id: ${USER_ID}
User email: ${EMAIL}
Account-created queue rows: ${created_queue_count}
Account-created message rows: ${created_message_count}
Account-deleted queue rows: ${deleted_queue_count}
Account-deleted message rows: ${deleted_message_count}

Expected outcomes:
- Without verified sender/API key: queue rows may retry/fail with provider error.
- With valid sender/API key: queue rows should become 'sent' and provider_message_id should be populated.
SUMMARY
