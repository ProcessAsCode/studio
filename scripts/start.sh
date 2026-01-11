#!/bin/bash
set -e
echo "🚀 Starting services..."
[ ! -f .env ] && echo "Run ./scripts/setup.sh first" && exit 1
WSL_IP=$(ip addr show eth0 | grep "inet\b" | awk '{print $2}' | cut -d/ -f1)
echo "WSL IP: $WSL_IP"
docker compose up -d
sleep 15
docker compose ps
echo "✅ Started - Access: https://studio.algomation.io"
