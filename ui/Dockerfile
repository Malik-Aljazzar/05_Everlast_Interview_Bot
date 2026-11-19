# Liefert die fertig gebaute React-App (npm run build -> dist/) mit nginx aus.
# Gebaut wird lokal, nicht auf dem Server: der hat nur 1 GB RAM und n8n braucht davon den Großteil.
FROM nginx:1.30.7-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html
