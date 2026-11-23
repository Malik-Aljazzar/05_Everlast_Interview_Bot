#!/usr/bin/env bash
# Baut die UI lokal und spielt sie auf den Hetzner-Server (SSH-Alias mal-private) aus.
# Auf dem Server läuft sie als Container "ui" in /opt/n8n (docker-compose.yml) hinter nginx.
# Die Admin-IP steht nicht im Repo: nginx.conf enthält den Platzhalter ADMIN_IP, der Wert kommt aus ../.env.
set -euo pipefail
cd "$(dirname "$0")"

ADMIN_IP=$(grep -E '^ADMIN_IP=' ../.env | cut -d= -f2- | tr -d "\"' \r" || true)
[ -n "$ADMIN_IP" ] || { echo "ADMIN_IP fehlt in .env" >&2; exit 1; }

npm run build
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
sed "s/ADMIN_IP/$ADMIN_IP/g" nginx.conf > "$tmp/nginx.conf"
ssh mal-private 'mkdir -p /opt/n8n/ui && rm -rf /opt/n8n/ui/dist'
scp -q -r Dockerfile "$tmp/nginx.conf" dist mal-private:/opt/n8n/ui/
ssh mal-private 'cd /opt/n8n && docker compose build -q ui && docker compose up -d ui'
echo "UI ausgeliefert: https://everlast.mal-zeta.de"
