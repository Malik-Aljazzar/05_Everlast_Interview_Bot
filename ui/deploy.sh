#!/usr/bin/env bash
# Baut die UI lokal und spielt sie auf den Hetzner-Server (SSH-Alias mal-private) aus.
# Auf dem Server läuft sie als Container "ui" in /opt/n8n (docker-compose.yml), Port 8080.
set -euo pipefail
cd "$(dirname "$0")"

npm run build
ssh mal-private 'mkdir -p /opt/n8n/ui && rm -rf /opt/n8n/ui/dist'
scp -q -r Dockerfile nginx.conf dist mal-private:/opt/n8n/ui/
ssh mal-private 'cd /opt/n8n && docker compose build -q ui && docker compose up -d ui'
echo "UI ausgeliefert: http://n8n.mal-zeta.de:8080"
