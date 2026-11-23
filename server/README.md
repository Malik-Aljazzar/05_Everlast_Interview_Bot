# Server (Hetzner, n8n.mal-zeta.de)

Kopien der Konfiguration aus `/opt/n8n` auf dem Hetzner-Server (SSH-Alias `mal-private`). Secrets stehen nur in `/opt/n8n/.env` auf dem Server, nicht hier.

| Datei | Auf dem Server | Zweck |
| --- | --- | --- |
| `docker-compose.yml` | `/opt/n8n/docker-compose.yml` | Container `nginx`, `ui`, `n8n`; `certbot` nur für Zertifikate |
| `nginx/n8n.conf` | `/opt/n8n/nginx/conf.d/n8n.conf` | Reverse Proxy für n8n: HTTPS, `/webhook/*` öffentlich, `/webhook/ui/*` und alles andere nur Admin-IP |
| `nginx/everlast.conf` | `/opt/n8n/nginx/conf.d/everlast.conf` | Interview-UI unter `https://everlast.mal-zeta.de`, nur Admin-IP |
| `certbot-renew.cron` | `/etc/cron.d/certbot-renew` | Zertifikat zweimal täglich prüfen und bei Bedarf verlängern, danach nginx neu laden |

Die UI-Dateien (`Dockerfile`, `nginx.conf`, `dist/`) liegen in `/opt/n8n/ui` und kommen per `bash ui/deploy.sh`.

## Historie

- 2026-11-15: Caddy als Reverse Proxy.
- 2026-11-19: Caddy durch nginx 1.30.7 + certbot 5.10.0 ersetzt (Let's Encrypt per Webroot, Ausfall rund 30 Sekunden). Rückweg: `docker-compose.yml.bak-caddy-*` und `Caddyfile` liegen noch in `/opt/n8n`, das Volume `n8n_caddy_data` ebenfalls.
- 2026-11-19: Container `ui` (Interview-UI, Port 8080).
- 2026-11-22: UI unter `https://everlast.mal-zeta.de` (DNS bei Cloudflare, nur DNS, kein Proxy), Port 8080 geschlossen.

## Admin-IP ändern

In `nginx/conf.d/n8n.conf`, `nginx/conf.d/everlast.conf` und `ui/nginx.conf` die Zeile `allow ADMIN_IP;` anpassen, dann:

```sh
cd /opt/n8n
docker compose exec -T nginx nginx -t && docker compose exec -T nginx nginx -s reload
docker compose build -q ui && docker compose up -d ui
```
