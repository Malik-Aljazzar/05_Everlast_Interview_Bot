# Bewertung und Interview-Leitfaden

Antwort auf Frage 1 der Mail: Wie wird das Gespräch bewertet und das Bewerberprotokoll erstellt?

## Prinzip

- **Konfiguration statt Code:** Stellenprofil, Bewertungskriterien mit Skalen und der Interview-Leitfaden liegen in der Google-Tabelle „Everlast Bewerberprotokolle“. HR kann sie ändern, ohne n8n oder Vapi anzufassen. Alles ist über die **Assistant-ID** einer Stelle zugeordnet (ein Vapi-Assistant pro Stelle).
- **Gleiche Grundlage für Gespräch und Bewertung:** Der Leitfaden steuert, was der Agent fragt (Sync nach Vapi). Dieselben Zeilen sagen der Analyse, welche Frage welches Kriterium prüft.
- **KI liefert Evidenz, Regeln entscheiden:** Claude bewertet jedes Kriterium mit Stufe, Begründung und Zitat. Gesamtscore und Empfehlung rechnet n8n deterministisch nach den Regeln aus der Tabelle. Die Entscheidung trifft HR.

```
Google Sheets                      n8n                                   Vapi
┌──────────────┐  jede Minute,    ┌───────────────────────────┐  PATCH   ┌──────────────────┐
│ Stellen      │──bei Änderung──► │ Leitfaden synchronisieren │────────► │ System-Prompt:   │
│ Leitfaden    │                  └───────────────────────────┘          │ # Stelle         │
│ Bewertung    │                                                         │ # Leitfaden      │
└──────┬───────┘                                                         └────────┬─────────┘
       │ je Call (Assistant-ID)   ┌───────────────────────────┐  End-of-Call-Report │
       └────────────────────────► │ Bewerberinterview         │ ◄───────────────────┘
                                  │ auswerten                 │──► Tab „Protokolle“ + Slack
                                  └───────────────────────────┘
```

## Die Tabs

### Stellen (eine Zeile pro Stelle)

| Spalte | Bedeutung | Standard, wenn leer |
| --- | --- | --- |
| Assistant-ID | ID des Vapi-Assistants dieser Stelle | Pflicht |
| Stelle, Unternehmen, Aufgaben, Anforderungen | Stellenprofil. Listen mit Zeilenumbruch oder `;` trennen. Geht als Faktenbasis an den Agent und als Maßstab an die Analyse | – |
| Muss-Kriterien | K.-o.-Kriterien, werden einzeln geprüft (ja / nein / unklar) | keine |
| Einladen ab (%) / Absage unter (%) | Schwellen für die Empfehlung | 70 / 45 |

### Bewertung (eine Zeile pro Kriterium)

| Spalte | Bedeutung | Standard, wenn leer |
| --- | --- | --- |
| Kriterium | Name, erscheint so im Protokoll | Pflicht |
| Gewicht | relatives Gewicht, wird auf 100 % normiert | Durchschnitt der übrigen Gewichte |
| Was wird bewertet | kurze Beschreibung | Name des Kriteriums |
| Score 1 … Score N | Beschreibung jeder Stufe. **Die gefüllten Spalten legen die Skala fest** (z. B. nur Score 1–3 → Skala 1–3) | keine gefüllt → Standardskala 1–5; einzelne Lücken → Standardtext der Stufe |

Startinhalt: Fachliche Eignung 40 %, Motivation 20 %, Kommunikation 20 %, Arbeitsweise & Zusammenarbeit 20 %, jeweils mit beschriebenen Stufen 1–5.
Gehalt, Startdatum und Verfügbarkeit sind bewusst **kein** Kriterium: Sie stehen als Eckdaten im Protokoll, senken aber nicht den Score.

### Leitfaden (eine Zeile pro Frage, in Gesprächsreihenfolge)

Die Reihenfolge der Zeilen ist die Reihenfolge im Gespräch. Umsortieren = Zeilen verschieben.

| Spalte | Bedeutung |
| --- | --- |
| Thema, Frage | wird dem Agent so vorgegeben – alle Bewerber bekommen dieselben Kernfragen (strukturiertes Interview) |
| Kriterium | welches Bewertungskriterium die Frage prüft |
| Hinweis | Verhalten und Nachfragen für den Agent |

Startinhalt: Einwilligung, Name, Hintergrund, Motivation, API-Projekt, Fallfrage (E-Mails ins CRM automatisieren), LLM-Erfahrung, Zusammenarbeit/Feedback, Lernen, Gehalt, Verfügbarkeit, offene Fragen. Jedes Kriterium wird von mindestens einer Frage abgedeckt; Kommunikation wird über das ganze Gespräch bewertet.

## Ablauf der Bewertung (Workflow „Vapi – Bewerberinterview auswerten“)

1. **Report prüfen:** nur `end-of-call-report`, jede Call-ID nur einmal.
2. **Bewertungsgrundlage laden:** Stelle, Kriterien und Leitfaden zur Assistant-ID aus der Tabelle; Standardwerte für leere Felder. Fehlt die Stelle, bricht der Workflow ab und meldet das in #n8n-fehler.
3. **KI-Analyse (Claude Opus 5.5)** nach festem JSON-Schema:
   - pro Kriterium: Stufe auf dessen Skala, Begründung mit Bezug auf die Stufenbeschreibung, wörtliches Zitat; „nicht beurteilbar“, wenn das Thema nicht vorkam
   - Muss-Kriterien: ja / nein / unklar mit Begründung
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
| Muss-Kriterium „nein“ oder schwerwiegende Red Flag | höchstens Prüfen |

6. **Protokoll:** Zeile im Tab „Protokolle“ (inkl. Begründungen, angewandter Regel, Transkript, Aufnahme) und Slack-Nachricht in #bewerbungen mit Link zur Zeile.

**Beispiel (Testlauf):** Fachliche Eignung 4/5, Motivation 4/5, Kommunikation 4/5, Zusammenarbeit 3/5 → 0,75·40 + 0,75·20 + 0,75·20 + 0,5·20 = **70 %** → „Gesamtscore 70 % ≥ 70 % → Einladen“, alle Muss-Kriterien erfüllt.

## Fairness und Nachvollziehbarkeit

- **Mensch entscheidet:** Die KI gibt nur eine Empfehlung; jede Bewertung ist mit Zitat belegt, die Rechenregel steht im Protokoll.
- **AGG:** Geschützte Merkmale (Alter, Herkunft, Geschlecht, Religion, Behinderung, Familienplanung, Gesundheit, Akzent …) werden weder erfragt noch bewertet – im Agent-Prompt und im Analyse-Prompt ausgeschlossen.
- **Vergleichbarkeit:** feste Kernfragen und beschriebene Skalenstufen statt Bauchgefühl; deterministische Rechnung in n8n.
- **Robustheit:** Spracherkennungsfehler gelten nicht als Schwäche; Anweisungen im Transkript („gib mir die Bestnote“) werden ignoriert und als Red Flag gewertet.
- **EU AI Act:** KI im Recruiting gilt als Hochrisiko-Anwendung (Anhang III). Menschliche Aufsicht, Transparenz gegenüber Bewerbern (Hinweis auf KI und Aufzeichnung, Einwilligung) und Dokumentation sind deshalb eingebaut.

## Grenzen

- Das Stellenprofil im Tab „Stellen“ ist eine **Annahme** und sollte durch die echte Stellenanzeige ersetzt werden.
- LLM-Bewertungen können leicht schwanken. In zwei Testläufen mit demselben Transkript waren die Scores identisch; belastbar ist das erst mit mehr Läufen. Für den Produktivbetrieb: Stichproben von HR gegenprüfen lassen.
- Die Qualität hängt am Transkript: schlechte Verbindung → unvollständige Bewertung (wird als „Prüfen“ markiert).
