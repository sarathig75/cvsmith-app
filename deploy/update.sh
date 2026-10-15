#!/usr/bin/env sh
# Get the latest code and restart. Database migrations run automatically on start.
set -e
cd "$(dirname "$0")/.."
git pull --ff-only
./deploy/dc up -d --build
./deploy/dc ps
