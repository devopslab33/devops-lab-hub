#!/usr/bin/env sh
set -e
docker network create lab-net 2>/dev/null || true
docker compose -f docker-compose.lab.yml up -d --build
