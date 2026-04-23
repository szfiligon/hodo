#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
SKIP_BUILD="${SKIP_BUILD:-0}"

cd "$PROJECT_DIR"

echo "[1/3] Building standalone deploy package..."
if [ "$SKIP_BUILD" = "1" ]; then
  SKIP_BUILD=1 bash "$SCRIPT_DIR/build-next-deploy-package.sh"
else
  bash "$SCRIPT_DIR/build-next-deploy-package.sh"
fi

echo "[2/3] Locating latest deploy archive..."
LATEST_ARCHIVE="$(ls -t "${PROJECT_NAME}-nextjs-deploy-"*.tar.gz 2>/dev/null | head -n 1 || true)"
if [ -z "$LATEST_ARCHIVE" ]; then
  echo "Error: deploy archive not found."
  exit 1
fi

TRANSFER_ZIP="${LATEST_ARCHIVE}.zip"
rm -f "$TRANSFER_ZIP"

echo "[3/3] Creating transfer zip..."
zip -j "$TRANSFER_ZIP" "$LATEST_ARCHIVE" "${LATEST_ARCHIVE}.sha256"

cat <<EOF
Done.
Transfer package: $PROJECT_DIR/$TRANSFER_ZIP

Target machine steps:
1) unzip $(basename "$TRANSFER_ZIP")
2) tar -xzf $(basename "$LATEST_ARCHIVE")
3) cd ${PROJECT_NAME}-nextjs-deploy-*
4) node server.js
EOF
