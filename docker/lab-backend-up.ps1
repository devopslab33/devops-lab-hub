$ErrorActionPreference = "Stop"
docker network create lab-net 2>$null
docker compose -f docker-compose.lab.yml up -d --build
