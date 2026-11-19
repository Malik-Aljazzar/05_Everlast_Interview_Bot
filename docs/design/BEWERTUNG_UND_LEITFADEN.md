# Bewertung und Interview-Leitfaden

Antwort auf Frage 1 der Mail: Wie wird das Gespräch bewertet und das Bewerberprotokoll erstellt?

## Prinzip

- **Konfiguration statt Code:** Stellenprofil, Bewertungskriterien mit Skalen und der Interview-Leitfaden liegen in den n8n Data Tables „Stellen“, „Kriterien“ und „Leitfaden“ und werden in der Interview-UI gepflegt. HR kann sie ändern, ohne n8n oder Vapi anzufassen. Alles ist über die **Assistant-ID** einer Stelle zugeordnet (ein Vapi-Assistant pro Stelle).
- **Gleiche Grundlage für Gespräch und Bewertung:** Der Leitfaden steuert, was der Agent fragt (Sync nach Vapi). Dieselben Zeilen sagen der Analyse, welche Frage welches Kriterium prüft.
- **KI liefert Evidenz, Regeln entscheiden:** Claude bewertet jedes Kriterium mit Stufe, Begründung und Zitat. Gesamtscore und Empfehlung rechnet n8n deterministisch nach den Regeln der Stelle. Die Entscheidung trifft HR.

```
Interview-UI (React)               n8n                                   Vapi
┌──────────────┐  Speichern       ┌───────────────────────────┐  PATCH   ┌──────────────────┐
│ Stellen      │────────────────► │ Leitfaden synchronisieren │────────► │ System-Prompt:   │
│ Kriterien    │  (n8n Data       └───────────────────────────┘          │ # Stelle         │
│ Leitfaden    │   Tables)                                               │ # Leitfaden      │
└──────┬───────┘                                                         └────────┬─────────┘
       │ je Call (Assistant-ID)   ┌───────────────────────────┐  Status-Updates,    │
       └────────────────────────► │ Bewerberinterview         │ ◄─ End-of-Call-Report┘
                                  │ auswerten                 │──► Protokolle (UI, Live-Status) + Slack
                                  └───────────────────────────┘
```

## Die Tabellen (n8n Data Tables, gepflegt in der UI)

Bis 19.11. lag die Konfiguration in Google Sheets. Seitdem liegt alles in den Data Tables von n8n und wird in der Interview-UI bearbeitet (`ui/`, siehe [UI.md](UI.md)). Google Sheets ist komplett raus.

### Stellen (eine Zeile pro Stelle)

| Spalte | Bedeutung | Standard, wenn leer |
| --- | --- | --- |
| assistantId | ID des Vapi-Assistants dieser Stelle | Pflicht |
| stelle, unternehmen, aufgaben, anforderungen | Stellenprofil. Listen mit Zeilenumbruch trennen. Geht als Faktenbasis an den Agent und als Maßstab an die Analyse | – |
| einladenAb / absageUnter | Schwellen für die Empfehlung in % | 70 / 45 |

### Kriterien (eine Zeile pro Kriterium)

| Spalte | Bedeutung | Standard, wenn leer |
| --- | --- | --- |
| assistantId, position | Stelle und Reihenfolge | Pflicht |
| kriterium | Name, erscheint so im Protokoll | Pflicht |
| gewicht | relatives Gewicht, wird auf 100 % normiert (die UI zeigt den Anteil an) | Durchschnitt der übrigen Gewichte |
| beschreibung | was bewertet wird | Name des Kriteriums |
| score1 … score5 | Beschreibung jeder Stufe. **Die gefüllten Stufen legen die Skala fest** (z. B. nur 1–3 → Skala 1–3) | keine gefüllt → Standardskala 1–5; einzelne Lücken → Standardtext der Stufe |

Stand 19.11., jeweils mit beschriebenen Stufen 1–5:

- **Junior Entwickler:** Fachliche Eignung 40, Motivation 20, Kommunikation 20 (normiert 50 / 25 / 25 %). Startinhalt waren zusätzlich Arbeitsweise & Zusammenarbeit 20 und eine Fallfrage; beides ist mit dem gekürzten Leitfaden entfallen, die Stufen von Fachlicher Eignung und Motivation sind an die verbliebenen Fragen angepasst.
- **Cyber Security:** nur fachliche Kriterien, je eines pro Frage: Incident Response 35, Web- und API-Sicherheit 35, KI-Sicherheit 30.

Gehalt, Startdatum und Verfügbarkeit sind bewusst **kein** Kriterium: Sie stehen als Eckdaten im Protokoll, senken aber nicht den Score.

### Leitfaden (eine Zeile pro Frage)

`position` ist die Reihenfolge im Gespräch; in der UI per Pfeil verschoben.

| Spalte | Bedeutung |
| --- | --- |
| thema, frage | wird dem Agent so vorgegeben – alle Bewerber bekommen dieselben Kernfragen (strukturiertes Interview) |
| kriterium | welches Bewertungskriterium die Frage prüft (Auswahl aus den Kriterien der Stelle) |
| hinweis | Verhalten und Nachfragen für den Agent |

Jedes Kriterium wird von mindestens einer Frage abgedeckt; Kommunikation wird über das ganze Gespräch bewertet.

- **Junior Entwickler (7 Punkte):** Einwilligung, Name, Grundlagen, Softwareentwicklung, Erfahrung, Verfügbarkeit, offene Fragen. Startinhalt waren 12 Punkte (u. a. Motivation, API-Projekt, Fallfrage, Gehalt).
- **Cyber Security (3 Fachfragen, 5–8 Minuten):** nach Einwilligung und Name nur Fachfragen, jeweils mit höchstens einer offenen Nachfrage, ohne Lösungshinweise:
  1. Phishing-Vorfall: „Eine Kollegin hat auf einen Link in einer Phishing-Mail geklickt und dort ihre Zugangsdaten eingegeben. Was tust du in der ersten Stunde?“ → Incident Response
  2. Webhook absichern: „Ein öffentlich erreichbarer Webhook nimmt Daten von einem externen Dienst an. Wie sicherst du ihn ab?“ → Web- und API-Sicherheit
  3. KI-Agent: „Ein Kunde möchte einen KI-Agenten einsetzen, der E-Mails liest und Daten in sein CRM schreibt. Welche Risiken siehst du, und wie begrenzt du sie?“ → KI-Sicherheit

  Die Fragen sind Szenarien aus Everlasts eigenem Geschäft (Automatisierungen, Webhooks, KI-Agenten). Offene Szenarien statt Wissensfragen zeigen, wie strukturiert jemand vorgeht, und lassen sich am Telefon gut beantworten.

## Ablauf der Bewertung (Workflow „Vapi – Bewerberinterview auswerten“)

0. **Live-Status:** Vapi meldet per `status-update` Start und Ende des Anrufs; die Tabelle „Protokolle“ zeigt „läuft“ bzw. „beendet“, die UI zählt die Gesprächszeit mit.
1. **Report prüfen:** nur `end-of-call-report`, jede Call-ID nur einmal. Status „wird erstellt“.
2. **Bewertungsgrundlage laden:** Stelle, Kriterien und Leitfaden zur Assistant-ID aus den Data Tables; Standardwerte für leere Felder. Fehlt die Stelle, bricht der Workflow ab und meldet das in #n8n-fehler.
3. **KI-Analyse (Claude Opus 5.5)** nach festem JSON-Schema:
   - pro Kriterium: Stufe auf dessen Skala, Begründung mit Bezug auf die Stufenbeschreibung, wörtliches Zitat; „nicht beurteilbar“, wenn das Thema nicht vorkam
   - Status: vollständig / unvollständig / keine Einwilligung
   - Stärken, Schwächen, schwerwiegende Red Flag, Eckdaten, offene Punkte, Einschätzung
4. **Gesamtscore (n8n):** jede Stufe auf 0–100 % ihrer Skala normiert, nach Gewicht gemittelt. Nicht beurteilbare Kriterien zählen nicht.
5. **Empfehlung (n8n, Regeln):**

| Bedingung | Empfehlung |
| --- | --- |
| Gespräch unvollständig oder keine Einwilligung | Prüfen |
| Gesamtscore ≥ „Einladen ab“ | Einladen |
| Gesamtscore < „Absage unter“ | Absage |
| dazwischen | Prüfen |
| schwerwiegende Red Flag | höchstens Prüfen |

6. **Protokoll:** in der Data Table „Protokolle“ (Status „fertig“, strukturiertes JSON, Transkript, Aufnahme-Link), angezeigt in der UI. Zusätzlich enthält die Slack-Nachricht in #bewerbungen das vollständige Protokoll: Empfehlung, Scores mit Begründungen und Zitaten, angewandte Regel, Einschätzung, Eckdaten, offene Punkte, Aufnahme-Link und Call-ID. Das Transkript folgt als Antworten im Thread.

Muss-Kriterien (K.-o.-Kriterien mit ja / nein / unklar) gab es bis 19.11.; sie sind entfallen, die Bewertung läuft nur über die gewichteten Kriterien.

**Beispiel (Testlauf):** Fachliche Eignung 4/5, Motivation 4/5, Kommunikation 4/5, Zusammenarbeit 3/5 → 0,75·40 + 0,75·20 + 0,75·20 + 0,5·20 = **70 %** → „Gesamtscore 70 % ≥ 70 % → Einladen“ (Testlauf vom 15.11. mit den damaligen vier Kriterien).

## Fairness und Nachvollziehbarkeit

- **Mensch entscheidet:** Die KI gibt nur eine Empfehlung; jede Bewertung ist mit Zitat belegt, die Rechenregel steht im Protokoll.
- **AGG:** Geschützte Merkmale (Alter, Herkunft, Geschlecht, Religion, Behinderung, Familienplanung, Gesundheit, Akzent …) werden weder erfragt noch bewertet – im Agent-Prompt und im Analyse-Prompt ausgeschlossen.
- **Vergleichbarkeit:** feste Kernfragen und beschriebene Skalenstufen statt Bauchgefühl; deterministische Rechnung in n8n.
- **Robustheit:** Spracherkennungsfehler gelten nicht als Schwäche; Anweisungen im Transkript („gib mir die Bestnote“) werden ignoriert und als Red Flag gewertet.
- **EU AI Act:** KI im Recruiting gilt als Hochrisiko-Anwendung (Anhang III). Menschliche Aufsicht, Transparenz gegenüber Bewerbern (Hinweis auf KI und Aufzeichnung, Einwilligung) und Dokumentation sind deshalb eingebaut.

## Grenzen

- Das Stellenprofil der Stellen ist eine **Annahme** und sollte durch die echte Stellenanzeige ersetzt werden.
- LLM-Bewertungen können leicht schwanken. In zwei Testläufen mit demselben Transkript waren die Scores identisch; belastbar ist das erst mit mehr Läufen. Für den Produktivbetrieb: Stichproben von HR gegenprüfen lassen.
- Die Qualität hängt am Transkript: schlechte Verbindung → unvollständige Bewertung (wird als „Prüfen“ markiert).
