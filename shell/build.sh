#!/bin/bash

# Check if --clean flag is provided
CLEAN_INSTALL=false
for arg in "$@"
do
    if [ "$arg" == "--clean" ]; then
        CLEAN_INSTALL=true
    fi
done

if [ "$CLEAN_INSTALL" = true ]; then
    # Full cleanup (only when --clean parameter is provided)
    echo "Performing clean installation..."
    echo "Cleaning npm cache and removing existing modules..."
    npm cache clean --force
    rm -rf node_modules package-lock.json dist .next
    
    # Install dependencies fresh
    echo "Installing dependencies..."
    npm install
else
    echo "Skipping full cleanup. Using existing node_modules..."
    # Just clean the build artifacts
    rm -rf dist .next
fi

# Rebuild better-sqlite3 specifically
echo "Rebuilding better-sqlite3..."
npm rebuild better-sqlite3 --build-from-source

# Build the Next.js application
echo "Building Next.js application..."
npm run build

# Additional rebuild and dist commands
echo "Running final rebuild and dist..."
npm run rebuild
npm run dist

echo "Build process completed!"