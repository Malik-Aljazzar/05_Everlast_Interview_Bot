# Interview-UI

Web-Oberfläche für HR (seit 2026-11-19, REQUIREMENTS F10). Ersetzt Google Sheets als Ort für Konfiguration und Protokolle. Die Slack-Benachrichtigung bleibt.

| | |
| --- | --- |
| Adresse | `http://n8n.mal-zeta.de:8080` (vorerst HTTP, nur von der Admin-IP; DNS-Name, HTTPS und Login folgen) |
| Code | [`ui/`](../../ui/): React 19 + TypeScript, Vite |
| Betrieb | Container `ui` (nginx) in `/opt/n8n` auf dem Hetzner-Server, siehe [`server/`](../../server/) |
| Ausliefern | `bash ui/deploy.sh` (baut lokal, kopiert `dist/` auf den Server, baut den Container neu) |
| Lokal entwickeln | `cd ui && npm install && npm run dev` (der Dev-Server leitet `/api` an `https://n8n.mal-zeta.de/webhook/ui`) |

## Aufbau

```
Browser ──► ui (nginx, Port 8080) ──/api/*──► n8n:5678/webhook/ui/*  (Workflow „UI – API“) ──► n8n Data Tables
                                                                                               Stellen, Kriterien,
Vapi ──status-update / end-of-call-report──► Workflow „Bewerberinterview auswerten“ ─────────► Leitfaden, Protokolle
```

- Die UI spricht nur mit `/api`. nginx im Container leitet das im Docker-Netz direkt an n8n weiter, ohne Umweg über das Internet.
- Auf der öffentlichen Domain sind `/webhook/ui/*` ebenfalls auf die Admin-IP beschränkt (`server/nginx/n8n.conf`).
- Gebaut wird lokal: Der Server hat nur 1 GB RAM, den Großteil braucht n8n.

## Ansichten

**Protokolle** (`#protokolle`): alle Gespräche, neueste zuerst, Abfrage alle 3 Sekunden.

| Status in der Tabelle | Anzeige | Quelle |
| --- | --- | --- |
| `laeuft` | „Anruf läuft · mm:ss“ mit mitlaufender Zeit | Vapi `status-update` `in-progress` |
| `beendet`, `wird_erstellt` | „Protokoll wird erstellt · mm:ss“, nach 5 Minuten Hinweis auf #n8n-fehler | `status-update` `ended`, End-of-Call-Report |
| `fertig` | Empfehlung und Gesamtscore; aufklappbar: Zusammenfassung, Scores mit Begründung und Zitat, Regel, Stärken, Schwächen, Eckdaten, offene Punkte, Aufnahme, Transkript | Auswertung durch Claude |

Ein verspätetes `ended` setzt ein fertiges Protokoll nicht zurück (Knoten „Status bestimmen“).

**Konfiguration** (`#konfiguration`): eine Stelle auswählen und bearbeiten.

- Stelle: Bezeichnung, Unternehmen, Aufgaben, Anforderungen, Schwellen „Einladen ab“ und „Absage unter“.
- Kriterien: Name, Gewicht (mit Anteil in %), Beschreibung, Stufen 1–5; verschieben, hinzufügen, entfernen.
- Leitfaden: Thema, Frage, Kriterium (Auswahl), Hinweis für den Agent; Reihenfolge per Pfeil.
- „Speichern und an Vapi übertragen“: n8n prüft die Eingaben (Pflichtfelder, eindeutige Kriterien, Leitfaden verweist nur auf vorhandene Kriterien, Schwellen), ersetzt Kriterien und Leitfaden der Stelle und startet den Leitfaden-Sync. Der Agent nutzt die Änderung ab dem nächsten Anruf.

## API (Workflow „UI – API“)

| Methode und Pfad | Antwort |
| --- | --- |
| `GET /webhook/ui/protokolle` | `{ protokolle: [...] }`, Feld `protokoll` als ausgepacktes JSON |
| `GET /webhook/ui/config` | `{ stellen: [{ ...stelle, kriterien: [...], leitfaden: [...] }] }` |
| `POST /webhook/ui/config` | Body `{ assistantId, stelle, kriterien, leitfaden }` → `{ ok, kriterien, fragen, sync }` oder 400 `{ ok: false, fehler }` |

## Offen

- DNS-Name (z. B. `interview.mal-zeta.de`) mit HTTPS über den vorhandenen nginx und certbot.
- Login, bevor die IP-Sperre fällt.
- Neue Stellen legt weiterhin `deploy.py --job` als Vapi-Assistant an; die UI pflegt nur deren Inhalte.
