#!/usr/bin/env bash

set -euo pipefail

# Ensure we are running from the project root.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
PROJECT_NAME="$(basename "$PROJECT_DIR")"

FIRST_ZIP="${PROJECT_NAME}.zip"
SECOND_ZIP="${FIRST_ZIP}.zip"

cd "$PROJECT_DIR"

echo "Project: $PROJECT_NAME"
echo "Step 1: creating $FIRST_ZIP (excluding node_modules)..."

# Clean old outputs to avoid stale content.
rm -f "$FIRST_ZIP" "$SECOND_ZIP"

# First compression: zip the current project except node_modules.
zip -r "$FIRST_ZIP" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x ".cursor/*" \
  -x "$FIRST_ZIP" \
  -x "$SECOND_ZIP"

echo "Step 2: creating $SECOND_ZIP from $FIRST_ZIP..."

# Second compression: compress the first zip file itself.
zip "$SECOND_ZIP" "$FIRST_ZIP"

# Remove intermediate zip file.
rm -f "$FIRST_ZIP"

echo "Done."
echo "Output: $PROJECT_DIR/$SECOND_ZIP"
