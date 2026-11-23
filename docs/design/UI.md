# Interview-UI

Web-Oberfläche für HR (seit 2026-11-19, REQUIREMENTS F10). Ersetzt Google Sheets als Ort für Konfiguration und Protokolle. Die Slack-Benachrichtigung bleibt.

| | |
| --- | --- |
| Adresse | `https://everlast.mal-zeta.de` (nur von der Admin-IP; Login folgt) |
| Code | [`ui/`](../../ui/): React 19 + TypeScript, Vite |
| Betrieb | Container `ui` (nginx) in `/opt/n8n` auf dem Hetzner-Server, siehe [`server/`](../../server/) |
| Ausliefern | `bash ui/deploy.sh` (baut lokal, kopiert `dist/` auf den Server, baut den Container neu) |
| Lokal entwickeln | `cd ui && npm install && npm run dev` (der Dev-Server leitet `/api` an `https://n8n.mal-zeta.de/webhook/ui`) |

## Aufbau

```
Browser ──► nginx-Proxy ──► ui:80 ──/api/*──► n8n:5678/webhook/ui/*  (Workflow „UI – API“) ──► n8n Data Tables
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

**Konfiguration** (`#konfiguration`): links die Stellen, rechts die gewählte Stelle in drei Reitern. Die Seite zeigt nur Lesefassungen; bearbeitet wird in Dialogen.

| Reiter | Ansicht | Dialog |
| --- | --- | --- |
| Stelle | Unternehmen, Aufgaben und Anforderungen als eine Liste | Bezeichnung, Unternehmen, Aufgaben und Anforderungen (ein Feld) |
| Bewertung | Skala Absage / Prüfen / Einladen; Kriterien als Zeilen mit Anteil am Gesamtscore | Schwellen mit Vorschau; Kriterium mit Name, Gewicht, Beschreibung, Stufen 1–5 |
| Leitfaden | Fragen in Reihenfolge mit Kriterium und Hinweis-Markierung, danach der automatische Abschluss | Thema, Frage, Kriterium, Hinweis für den Agent |

- Reihenfolge per Pfeil am Zeilenende (erscheint bei Hover). Umbenennen eines Kriteriums zieht die Verweise im Leitfaden mit; Löschen entfernt sie.
- Dialoge ändern nur den Entwurf. Dann erscheint unten die Leiste „Ungespeicherte Änderungen“ mit Verwerfen und Speichern. Speichern: n8n prüft die Eingaben (Pflichtfelder, eindeutige Kriterien, Leitfaden verweist nur auf vorhandene Kriterien, Schwellen), ersetzt Kriterien und Leitfaden der Stelle und startet den Leitfaden-Sync. Der Agent nutzt die Änderung ab dem nächsten Anruf.
- Wechsel der Stelle mit ungespeicherten Änderungen fragt nach; Neuladen der Seite warnt der Browser. Der Wechsel zu „Protokolle“ behält den Entwurf.
- **+ Neue Stelle:** Bezeichnung und Vorlage (eine bestehende Stelle). n8n kopiert den Vapi-Assistant der Vorlage (Stimme, Modell, Transcriber, Gesprächsstil, Dauer), setzt Name, Begrüßung, Voicemail, Transcriber-Kontext und Fachbegriffe neu und übernimmt Unternehmen, Schwellen, Kriterien und Leitfaden. Aufgaben und Anforderungen bleiben leer. Danach läuft der Sync, die Stelle ist sofort anrufbar.
- **Stelle löschen:** löscht den Vapi-Assistant und die Zeilen in Stellen, Kriterien und Leitfaden. Abgelehnt, solange eine Vapi-Telefonnummer auf den Assistant zeigt. Protokolle bleiben.

## API (Workflow „UI – API“)

| Methode und Pfad | Antwort |
| --- | --- |
| `GET /webhook/ui/protokolle` | `{ protokolle: [...] }`, Feld `protokoll` als ausgepacktes JSON |
| `GET /webhook/ui/config` | `{ stellen: [{ ...stelle, kriterien: [...], leitfaden: [...] }] }` |
| `POST /webhook/ui/config` | Body `{ assistantId, stelle, kriterien, leitfaden }` → `{ ok, kriterien, fragen, sync }` oder 400 `{ ok: false, fehler }` |
| `POST /webhook/ui/stelle` | Body `{ stelle, vorlage }` (Vorlage = Assistant-ID) → `{ ok, assistantId, name, sync }`; 400 bei fehlenden Angaben, 502 wenn Vapi ablehnt |
| `DELETE /webhook/ui/stelle?assistantId=…` | `{ ok, assistantId }`; 400 ohne ID oder bei verbundener Telefonnummer, 502 wenn Vapi ablehnt. Ein schon gelöschter Assistant (404) gilt als erledigt |

## Offen

- DNS-Name (z. B. `interview.mal-zeta.de`) mit HTTPS über den vorhandenen nginx und certbot.
- Login, bevor die IP-Sperre fällt.
- In der UI angelegte Assistants haben keine Datei in `vapi/jobs/`. Änderungen an `vapi/assistant.json` erreichen sie über `deploy.py` nicht; sie behalten den Stand der Vorlage vom Zeitpunkt des Anlegens.
- Fachbegriffe für die Spracherkennung sind bei neuen Stellen nur „Everlast“; ein Feld dafür in der UI fehlt noch.
