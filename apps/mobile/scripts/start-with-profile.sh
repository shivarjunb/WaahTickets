#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-expo-go}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

case "$PROFILE" in
  expo-go)
    ENV_FILE="$ROOT_DIR/.env.expo-go"
    ;;
  dev-build)
    ENV_FILE="$ROOT_DIR/.env.dev-build"
    ;;
  *)
    echo "Unknown profile: $PROFILE"
    echo "Use one of: expo-go, dev-build"
    exit 1
    ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

cp "$ENV_FILE" "$ROOT_DIR/.env.local"

echo "Using mobile profile: $PROFILE"
echo "Loaded env: $ENV_FILE"

cd "$ROOT_DIR"
shift || true
npx expo start "$@"
