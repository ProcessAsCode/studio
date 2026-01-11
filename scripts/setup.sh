#!/bin/bash
set -e
echo "🔧 Algomation Studio Setup"
if [ ! -f .env ]; then
    cp .env.example .env
    POSTGRES_PASSWORD=$(openssl rand -base64 24)
    REDIS_PASSWORD=$(openssl rand -base64 24)
    SESSION_SECRET=$(openssl rand -base64 32)
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" .env
    sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASSWORD}/" .env
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" .env
    echo "✅ .env created - Update AUTH0 credentials"
fi
mkdir -p data/postgres data/redis logs logs/nginx backups
echo "✅ Setup complete"
