#!/bin/bash
set -e

echo "Pulling latest branch..."
git pull

echo "Ensuring .env exists..."
[ ! -f .env ] && ./scripts/setup.sh

echo "Starting containers..."
docker compose up -d --build

echo "Logs (backend)..."
docker logs -n 80 algomation-backend || true

echo "Done."
echo "If you proxy via Apache HTTPS: COOKIE_SECURE=true is correct."
