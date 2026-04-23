#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="$PROJECT_DIR/.deploy-package"
BUNDLE_DIR="$WORK_DIR/${PROJECT_NAME}-nextjs-deploy"
ARCHIVE_NAME="${PROJECT_NAME}-nextjs-deploy-${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="$PROJECT_DIR/$ARCHIVE_NAME"
CHECKSUM_PATH="${ARCHIVE_PATH}.sha256"
SKIP_BUILD="${SKIP_BUILD:-0}"
NODE_ENV="${NODE_ENV:-production}"

echo "[1/6] Preparing build..."
cd "$PROJECT_DIR"
echo "Generating Prisma client for deployment targets..."
npm run db:generate

if [ "$SKIP_BUILD" = "1" ]; then
  echo "SKIP_BUILD=1, skipping build step."
else
  echo "Building Next.js app..."
  NEXT_TELEMETRY_DISABLED=1 npm run build
fi

echo "[2/6] Preparing deploy workspace..."
rm -rf "$WORK_DIR"
mkdir -p "$BUNDLE_DIR"

if [ -d "$PROJECT_DIR/.next/standalone" ]; then
  echo "[3/6] Detected standalone output, packaging standalone deploy bundle..."

  cp -R "$PROJECT_DIR/.next/standalone/." "$BUNDLE_DIR/"

  mkdir -p "$BUNDLE_DIR/.next"
  cp -R "$PROJECT_DIR/.next/static" "$BUNDLE_DIR/.next/static"

  if [ -d "$PROJECT_DIR/public" ]; then
    cp -R "$PROJECT_DIR/public" "$BUNDLE_DIR/public"
  fi

  if [ -f "$PROJECT_DIR/.env.production" ]; then
    cp "$PROJECT_DIR/.env.production" "$BUNDLE_DIR/.env.production"
  fi

  cat > "$BUNDLE_DIR/DEPLOY_README.txt" <<EOF
This package uses Next.js standalone output.

Run on target server:
1) export NODE_ENV=$NODE_ENV
2) node server.js
EOF
else
  echo "[3/6] Standalone output not found, packaging generic Next.js deploy bundle..."

  cp "$PROJECT_DIR/package.json" "$BUNDLE_DIR/package.json"
  cp "$PROJECT_DIR/package-lock.json" "$BUNDLE_DIR/package-lock.json"
  cp -R "$PROJECT_DIR/.next" "$BUNDLE_DIR/.next"

  if [ -d "$PROJECT_DIR/public" ]; then
    cp -R "$PROJECT_DIR/public" "$BUNDLE_DIR/public"
  fi

  if [ -d "$PROJECT_DIR/prisma" ]; then
    cp -R "$PROJECT_DIR/prisma" "$BUNDLE_DIR/prisma"
  fi

  cat > "$BUNDLE_DIR/DEPLOY_README.txt" <<'EOF'
This bundle is built without Next.js standalone output.

Deploy steps on target server:
1) npm ci --omit=dev
2) npm run start
EOF
fi

echo "[4/6] Writing build metadata..."
{
  echo "project=$PROJECT_NAME"
  echo "timestamp=$TIMESTAMP"
  echo "node=$(node -v)"
  echo "npm=$(npm -v)"
  echo "standalone=$([ -d "$PROJECT_DIR/.next/standalone" ] && echo yes || echo no)"
} > "$BUNDLE_DIR/BUILD_INFO.txt"

echo "[5/6] Creating archive..."
tar -czf "$ARCHIVE_PATH" -C "$WORK_DIR" "$(basename "$BUNDLE_DIR")"

echo "[6/6] Generating checksum and cleaning temporary files..."
shasum -a 256 "$ARCHIVE_PATH" > "$CHECKSUM_PATH"
rm -rf "$WORK_DIR"

echo "Done."
echo "Deploy package created at:"
echo "$ARCHIVE_PATH"
echo "Checksum file:"
echo "$CHECKSUM_PATH"
