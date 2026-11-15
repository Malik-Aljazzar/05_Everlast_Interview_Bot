# Requirements – Everlast Interview Bot

Quelle: [RAW_DESCRIPTION.md](../raw/RAW_DESCRIPTION.md)

## Ziel

Ein AI Voice Agent auf Basis von **Vapi** führt Vorstellungsgespräche mit Bewerbern. Nach dem Gespräch übernimmt ein **n8n-Workflow** die Analyse und benachrichtigt den **HR Manager via Slack** über das Ergebnis.

Eine vollständig fertige Automatisierung ist laut Aufgabe nicht Pflicht – der Prozess muss aber logisch erklärbar sein und seinen Zweck erfüllen.

## Komponenten

| Komponente      | Aufgabe                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| Vapi            | Gespräch in Echtzeit (STT, LLM, TTS), Aufnahme, End-of-Call-Report per Webhook            |
| n8n             | Alles nach dem Call: Webhook empfangen, Transkript, Analyse, Ablage, Slack-Versand        |
| LLM (über n8n)  | Bewertung des Gesprächs, Erstellen des Bewerberprotokolls                                |
| Ablage          | Protokolle und Transkripte in Google Sheets                                              |
| Slack           | Benachrichtigung des HR Managers                                                         |

**Keine eigene Benutzeroberfläche.** Gespräche werden über eine Telefonnummer oder – für die Demo – über das Vapi-Dashboard gestartet. Ergebnisse landen ausschließlich in Slack und in der Ablage.

## Ablauf (Überblick)

1. Bewerber ruft die Telefonnummer an bzw. das Gespräch wird für die Demo im Vapi-Dashboard gestartet.
2. Der Vapi Agent führt das Interview nach Leitfaden.
3. Nach Call-Ende sendet Vapi den End-of-Call-Report an den Webhook von n8n.
4. n8n prüft und extrahiert die Daten und lässt das **Bewerberprotokoll** per LLM erstellen.
5. n8n speichert das Protokoll in Google Sheets und sendet die Zusammenfassung an den HR Manager in Slack.

```
Webhook (Vapi) → IF: end-of-call-report? → Duplikat-Check (Call-ID) → Felder extrahieren
  → AI: Analyse mit Structured Output Parser → Google Sheets → Slack: Nachricht an HR

Error Trigger → Slack: Fehlermeldung
```

---

## F1 – Voice Agent (Interview führen)

**REQ-1.1 – Assistant in Vapi** `MUST`
Ein Assistant ist in Vapi angelegt und über das Vapi-Dashboard startbar.
_Abnahme:_ Ein Testgespräch kann von Anfang bis Ende geführt werden.

**REQ-1.2 – Begrüßung & Einwilligung** `MUST`
Der Agent stellt sich als KI-Assistent von Everlast vor, nennt den Zweck des Gesprächs und weist darauf hin, dass das Gespräch aufgezeichnet und ausgewertet wird. Er fragt nach der Zustimmung, bevor das Interview beginnt.
_Abnahme:_ Lehnt der Bewerber ab, beendet der Agent das Gespräch höflich.

**REQ-1.3 – Interviewleitfaden** `MUST`
Der Agent arbeitet einen festen Leitfaden ab, mindestens:

- Name des Bewerbers (wird später bei der Analyse aus dem Transkript übernommen)
- Kurze Vorstellung / beruflicher Hintergrund
- Motivation für die Stelle und Everlast
- Relevante Erfahrung und Skills (stellenbezogen)
- Gehaltsvorstellung
- Verfügbarkeit / frühestes Startdatum
- Offene Fragen des Bewerbers

**REQ-1.4 – Natürliche Gesprächsführung** `MUST`

- Eine Frage pro Redebeitrag, kurze Sätze.
- Nachfragen bei vagen oder sehr kurzen Antworten.
- Der Bewerber kann den Agent unterbrechen.
- Der Agent bleibt beim Thema und lenkt bei Abschweifungen zurück.

**REQ-1.5 – Sprache** `MUST`
Das Gespräch wird auf Deutsch geführt, durchgehend per **Du** (passend zur Ansprache von Everlast).

**REQ-1.6 – Gesprächsende** `MUST`
Wenn alle Punkte abgedeckt sind, fasst der Agent die nächsten Schritte zusammen, verabschiedet sich und beendet den Call selbstständig. Eine maximale Gesprächsdauer ist gesetzt.

**REQ-1.7 – Sonderfälle** `SHOULD`
Definiertes Verhalten bei: längerer Stille, Voicemail, Verbindungsabbruch, unpassenden oder beleidigenden Äußerungen, Fragen, die der Agent nicht beantworten kann (z. B. Gehalt der Stelle → Verweis auf HR).

**REQ-1.8 – Kanal Telefon** `SHOULD`
Der Agent ist über eine Telefonnummer erreichbar. Ohne eigene UI ist das der einzige Zugang für echte Bewerber; das Vapi-Dashboard dient nur der Demo.

---

## F2 – Vapi-Konfiguration (Instructions, Voice, Advanced)

**REQ-2.1 – Instructions (System Prompt)** `MUST`
Der Prompt ist strukturiert und dokumentiert: Rolle, Ziel, Stelle, Leitfaden, Gesprächsregeln, Tonalität, Umgang mit Sonderfällen, Abschlussbedingung.

**REQ-2.2 – Voice** `MUST`
Eine natürlich klingende deutsche Stimme ist gewählt. Die Wahl von Provider und Modell ist begründet (Qualität, Latenz, Kosten, Aussprache deutscher Begriffe) – siehe Frage 3.

**REQ-2.3 – Transcriber** `MUST`
Ein Speech-to-Text-Modell mit guter Erkennung für Deutsch ist konfiguriert.

**REQ-2.4 – Advanced / Messaging** `MUST`
Konfiguriert und dokumentiert sind mindestens:

- Server URL = Production-Webhook-URL von n8n, inkl. Secret im Header
- Server Messages: mindestens End-of-Call-Report (alle anderen Typen deaktiviert, um unnötige Aufrufe zu vermeiden)
- First Message, End Call Message, Voicemail Message
- Idle- / Silence-Verhalten und maximale Gesprächsdauer

**REQ-2.5 – Aufnahme** `SHOULD`
Die Aufnahme des Calls ist aktiviert und in der Ablage verlinkt, damit HR das Gespräch bei Bedarf nachhören kann.

**REQ-2.6 – Konfiguration versioniert** `SHOULD`
Die Assistant-Konfiguration liegt als Datei im Repository (z. B. JSON-Export oder per API angelegt), damit sie nachvollziehbar und reproduzierbar ist.

---

## F3 – n8n-Workflow (Orchestrierung)

**REQ-3.1 – Erreichbarkeit** `MUST`
n8n ist per HTTPS erreichbar, damit Vapi den Webhook aufrufen kann. Umsetzung: self-hosted per Docker auf Hetzner (Falkenstein, EU) hinter Caddy unter `n8n.mal-zeta.de`. Öffentlich sind nur `/webhook/*` und `/webhook-test/*`; UI, REST-API und MCP sind per IP-Allowlist beschränkt.

**REQ-3.2 – Webhook-Trigger** `MUST`
Ein Webhook-Node (POST) startet den Workflow. Seine Production-URL ist in Vapi als Server URL eingetragen.

**REQ-3.3 – Absicherung** `MUST`
Der Webhook prüft das Secret aus dem Header (Header Auth Credential). Aufrufe ohne gültiges Secret werden abgewiesen.

**REQ-3.4 – Sofortige Antwort** `SHOULD`
Der Webhook antwortet Vapi sofort; Analyse und Versand laufen danach weiter. So entstehen keine Timeouts bei langen LLM-Aufrufen.

**REQ-3.5 – Filter** `MUST`
Nur Nachrichten vom Typ `end-of-call-report` werden verarbeitet, alle anderen werden ignoriert (IF- oder Switch-Node).

**REQ-3.6 – Daten extrahieren** `MUST`
Ein Set-Node übernimmt die benötigten Felder aus dem Report: Call-ID, Transkript, Nachrichtenverlauf, Aufnahme-URL, Datum, Dauer, Grund für das Gesprächsende, Assistant-ID.
Die Stelle wird über die Assistant-ID zugeordnet (ein Assistant pro Stelle; für die Demo genau eine Stelle: **Junior Entwickler – Vollzeit (m/w/d) bei Everlast Consulting**).

**REQ-3.7 – Duplikate** `SHOULD`
Wird derselbe Report mehrfach zugestellt, entsteht nur ein Protokoll und eine Slack-Nachricht (Prüfung über die Call-ID).

**REQ-3.8 – Ablage** `MUST`
Pro Gespräch wird eine Zeile in **Google Sheets** mit Protokoll, Transkript und Aufnahme-Link gespeichert.

**REQ-3.9 – Error-Workflow** `SHOULD`
Ein separater Workflow mit Error Trigger meldet fehlgeschlagene Ausführungen mit Call-ID in einem Slack-Channel. Kein Gespräch geht unbemerkt verloren.

**REQ-3.10 – Workflow versioniert** `SHOULD`
Die Workflows liegen als JSON-Export im Repository. Credentials sind nicht enthalten.

---

## F4 – Gesprächsanalyse & Bewerberprotokoll

**REQ-4.1 – Analyse in n8n** `MUST`
Die Analyse läuft als AI-Node im n8n-Workflow (z. B. Basic LLM Chain mit Structured Output Parser).
_Hinweis für die Präsentation:_ Vapi bietet eine eigene Analyse an. Sie wird bewusst nicht genutzt, damit Kriterien, Modell und Speicherort in eigener Hand bleiben.

**REQ-4.2 – Eingangsdaten** `MUST`
Die Analyse nutzt das vollständige Transkript mit Sprecherzuordnung sowie die Metadaten aus REQ-3.6.

**REQ-4.3 – Bewertungsschema** `MUST`
Die Bewertung erfolgt nach festen Kriterien, z. B.:

- Kommunikation
- Fachliche Eignung
- Motivation
- Kultureller Fit
- Rahmenbedingungen (Gehalt, Verfügbarkeit)

Jedes Kriterium bekommt einen Score (z. B. 1–5) und eine kurze Begründung mit Bezug auf eine Aussage aus dem Gespräch.

**REQ-4.4 – Strukturiertes Protokoll** `MUST`
Das Ergebnis folgt einem festen JSON-Schema (im Structured Output Parser hinterlegt) und enthält:

- Name des Bewerbers
- Zusammenfassung (3–5 Sätze)
- Stärken
- Schwächen / Red Flags
- Scores je Kriterium + Gesamtscore
- Empfehlung: `Einladen` / `Prüfen` / `Absage`
- Eckdaten: Gehaltsvorstellung, Verfügbarkeit, Startdatum
- Offene Punkte für das nächste Gespräch

**REQ-4.5 – Mensch entscheidet** `MUST`
Der Agent gibt nur eine Empfehlung ab, die Entscheidung trifft HR. Jede Bewertung ist begründet und nachvollziehbar.

**REQ-4.6 – Fairness** `SHOULD`
Keine Bewertung anhand geschützter Merkmale (Alter, Geschlecht, Herkunft, Religion usw., vgl. AGG). Das ist im Analyse-Prompt explizit ausgeschlossen.

**REQ-4.7 – Unvollständige Gespräche** `SHOULD`
Abgebrochene oder zu kurze Gespräche werden erkannt (z. B. über Dauer und Grund für das Gesprächsende) und im Protokoll als unvollständig markiert, statt sie normal zu bewerten.

---

## F5 – Slack-Benachrichtigung

**REQ-5.1 – Versand** `MUST`
Nach der Analyse sendet ein Slack-Node das Protokoll automatisch an den HR Manager (definierter Channel oder Direktnachricht).

**REQ-5.2 – Inhalt** `MUST`
Die Nachricht enthält: Name, Stelle, Datum, Dauer, Empfehlung, Gesamtscore, Zusammenfassung, Stärken / Schwächen und einen Link zum Eintrag in der Ablage (REQ-3.8).

**REQ-5.3 – Formatierung** `SHOULD`
Die Nachricht ist übersichtlich mit Slack Block Kit formatiert. Die Empfehlung ist auf einen Blick erkennbar. Die Nachricht ist rein informativ, ohne Buttons.

**REQ-5.4 – Fehlerbehandlung** `SHOULD`
Der Slack-Node versucht es bei Fehlern erneut (Retry On Fail). Schlägt der Versand endgültig fehl, greift der Error-Workflow (REQ-3.9).

---

## F6 – Eigenes Transkript (nur Konzept)

**Entscheidung (2026-11-15):** Eine eigene Transkription wird **nicht umgesetzt**. Analyse und Ablage nutzen das Vapi-Transkript. Frage 5 aus der Mail wird in der Präsentation konzeptionell beantwortet.

**REQ-6.1 – Konzept dokumentiert** `SHOULD`
Für die Präsentation sind die Möglichkeiten erklärt:

- Nach dem Call: Aufnahme (Stereo, ein Kanal pro Sprecher) aus n8n per HTTP Request laden und von einem eigenen STT-Dienst transkribieren lassen (z. B. ElevenLabs Scribe, Deepgram EU, AssemblyAI oder Whisper selbst gehostet).
- Live: Audio-Stream parallel abgreifen und streamen (z. B. eigener Transcriber-Server bei Vapi). Mit n8n nicht sinnvoll umsetzbar.

**REQ-6.2 – Begründung dokumentiert** `SHOULD`
Erklärt ist, warum das sinnvoll sein kann: bessere Genauigkeit für Deutsch, Sprechertrennung und Zeitstempel, Kontrolle über Daten und Speicherort (EU), Unabhängigkeit vom Anbieter, eigene Archivierung, Nachweisbarkeit. Ebenso, warum es hier bewusst weggelassen wird: zusätzliche Kosten, ein weiterer Dienst mit Personendaten, längere Laufzeit, und das Vapi-Transkript reicht für die Analyse aus.

---

## F7 – Latenz (Delay verringern)

**REQ-7.1 – Zielwert** `SHOULD`
Die Zeit vom Ende der Aussage des Bewerbers bis zum Beginn der Antwort des Agents liegt unter ca. 1 Sekunde.

**REQ-7.2 – Maßnahmen** `SHOULD`
Die Maßnahmen sind konfiguriert und dokumentiert, u. a.:

- Schnelles LLM und kurzer, klarer Prompt
- Streaming-fähige STT- und TTS-Modelle mit niedriger Latenz
- Feinjustierte Erkennung des Sprechendes (Endpointing / Start Speaking Plan)
- Keine Aufrufe an n8n oder andere langsame Tools während des Gesprächs – n8n arbeitet nur nach dem Call
- Serverregion nah an den Nutzern

**REQ-7.3 – Messung** `COULD`
Die Latenz wird anhand der Call-Logs gemessen, vorher/nachher verglichen und in der Präsentation gezeigt.

---

## F8 – Datenschutz: keine Daten in die USA (Bonus)

**REQ-8.1 – Datenfluss dokumentiert** `COULD`
Für jede Komponente (Telefonie, Vapi, STT, LLM, TTS, n8n, Ablage, Slack) ist Anbieter und Datenstandort dokumentiert.

**REQ-8.2 – EU-Setup** `COULD`
Konzept für ein Setup ohne Datenübermittlung in die USA:

- n8n self-hosted auf einem Server in der EU
- EU-Regionen bzw. EU-Anbieter für STT, LLM und Ablage
- Offen ansprechen: Vapi und Slack sind US-Anbieter – was das bedeutet und welche Alternativen es gibt

**REQ-8.3 – Daten in n8n** `COULD`
n8n speichert Ausführungsdaten (inkl. Transkripten). Aufbewahrung und automatisches Löschen der Ausführungsdaten sind konfiguriert.

**REQ-8.4 – Rahmenbedingungen** `COULD`
Berücksichtigt sind: Auftragsverarbeitungsverträge (AVV), Löschfristen für Aufnahmen und Transkripte, Einwilligung des Bewerbers, Datenminimierung (nur die Zusammenfassung in Slack, nicht das volle Transkript) sowie die Einordnung von KI im Recruiting nach dem EU AI Act.

---

## F9 – AWS im Setup (Bonus)

**REQ-9.1 – Architektur auf AWS** `COULD`
Konzept, wie AWS im Setup genutzt wird, z. B.:

- n8n self-hosted auf AWS (EC2 oder ECS) hinter HTTPS
- Aufnahmen und Protokolle in S3
- LLM-Analyse über Bedrock, Transkription über Transcribe – jeweils aus n8n angesprochen
- Secrets im Secrets Manager

**REQ-9.2 – Rahmenbedingungen** `COULD`
Berücksichtigt sind: EU-Region (z. B. `eu-central-1`) und Verfügbarkeit der Modelle dort, IAM nach Least Privilege, Kosten.

---

## Nicht-funktionale Anforderungen

**NFR-1 – Secrets** `MUST`
API-Keys und Tokens liegen nur in n8n-Credentials bzw. Umgebungsvariablen, nie in Workflow-Exporten oder im Repository.

**NFR-2 – Nachvollziehbarkeit** `SHOULD`
Jede Ausführung ist in der Execution-Historie von n8n über die Call-ID auffindbar.

**NFR-3 – Kosten** `COULD`
Die Kosten pro Gespräch (Vapi, STT, LLM, TTS) und für das Hosting von n8n sind grob abgeschätzt.

---

## Zuordnung: Fragen aus der Mail → Requirements

| #   | Frage                                             | Requirements |
| --- | ------------------------------------------------- | ------------ |
| 1   | Bewertung des Gesprächs / Bewerberprotokoll       | F3, F4, F5   |
| 2   | Vapi-Einstellungen: Instructions, Voice, Advanced | F2           |
| 3   | Bestes Voice-Modell und warum                     | REQ-2.2      |
| 4   | Delay des Agents verringern                       | F7           |
| 5   | Eigenes Transkript ohne Vapi (nur Konzept)        | F6           |
| 6   | (Bonus) Keine Daten in die USA                    | F8           |
| 7   | (Bonus) AWS mit Vapi                              | F9           |

## Organisatorisches (aus der Mail)

- [ ] Aufgabe ansehen und Zeitaufwand abschätzen
- [ ] Termin über Calendly buchen – ohne Buchung in den nächsten Tagen wird die Bewerbung abgebrochen
- [ ] Aktuellen Lebenslauf senden, falls noch nicht geschehen
- [ ] Testaufgabe umsetzen und Präsentation für den Call vorbereiten (Demo + Antworten auf die 7 Fragen)

## Out of Scope

- Eigene Benutzeroberfläche (Frontend, Dashboard, Web-Widget)
- Interaktive Aktionen in Slack (Buttons wie „Einladen“ / „Absagen“)
- Eigenes Backend außerhalb von n8n
- Anbindung an ein Bewerbermanagementsystem (z. B. Personio)
- Automatischer Versand von Zu- oder Absagen an Bewerber
- Automatische Terminvereinbarung für die nächste Runde
- Eigene Transkription der Aufnahme (nur konzeptionell in der Präsentation, siehe F6)
