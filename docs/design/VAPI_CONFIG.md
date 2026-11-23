# Vapi-Konfiguration – Everlast Interview Bot

Antwort auf **Frage 2** (Instructions, Voice, Advanced/Messaging) und **Frage 4** (Latenz).
Benchmarks, Preise und Alternativen stehen in [PROVIDER_RESEARCH.md](../analysis/PROVIDER_RESEARCH.md), die Anforderungen in [REQUIREMENTS.md](../analysis/REQUIREMENTS.md) (F1, F2, F7).

| | |
| --- | --- |
| Assistants (einer pro Stelle) | `Everlast Interview - Junior Entwickler` (`90e79eb0-631e-4186-b1f3-22301718ebf1`), `Everlast Interview - Cyber Security` (`36eabb5b-888b-4af9-b199-c0ea025223a5`) |
| Konfiguration | [`vapi/assistant.json`](../../vapi/assistant.json) (gemeinsam) + [`vapi/jobs/<stelle>.json`](../../vapi/jobs/) (Name, Begrüßung, Metadaten, Transcriber-Kontext und Keyterms, Prompt-Platzhalter) + [`vapi/system-prompt.md`](../../vapi/system-prompt.md) |
| Deployment | `python vapi/deploy.py --job <stelle>` (Standard `junior-entwickler`): legt Credential und Assistant an (bzw. PATCH) und prüft danach die gespeicherte Konfiguration. Optionen: `--dry-run`, `--verify`, `--reset-sections`, `--discard-draft` |
| Neue Stelle | In der UI „+ Neue Stelle“ mit Vorlage: n8n kopiert den Assistant der Vorlage in Vapi und übernimmt Kriterien und Leitfaden (siehe [UI.md](UI.md)). Alternativ als Code: `vapi/jobs/<stelle>.json` anlegen (eigene Variable für die Assistant-ID in `_assistantIdEnv`), `deploy.py --job <stelle>` ausführen und die Stelle danach in den Data Tables anlegen. Nur Stellen mit Job-Datei bekommen Änderungen an `assistant.json` über `deploy.py` |
| Stand | 2026-11-15, alle Feldnamen gegen `https://api.vapi.ai/api-json` und die Live-API geprüft |

**Grundprinzip:** Vapi führt nur das Live-Gespräch. Während des Calls gibt es keine Aufrufe an n8n oder andere Tools (außer `endCall`). Nach dem Call geht genau ein Event an n8n.

## Überblick

| Bereich | Einstellung |
| --- | --- |
| LLM | OpenAI `gpt-4.1`, Temperatur 0,4, `maxTokens` 150, Fallback `gpt-4.1-mini` |
| Voice | ElevenLabs `eleven_v4_turbo` mit nativer deutscher Stimme aus der Voice Library, Fallback Cartesia „Jonas“, dann Azure `de-DE-FlorianMultilingualNeural` |
| Transcriber | AssemblyAI `universal-3-6-pro` (Deutsch), Gesprächskontext, 15 Keyterms, Fallback Soniox `stt-rt-v6` |
| Server | n8n-Webhook mit Header `X-Vapi-Secret` (Org-Einstellungen), nur `end-of-call-report` |
| Gespräch | Agent spricht zuerst, max. 20 Minuten (Cyber Security 12), Stille-Hooks, Aufnahme an, Vapi-Analyse aus |

Alle Provider außer ElevenLabs laufen über Vapis eigene Keys. Für ElevenLabs ist Maliks eigener Key in Vapi hinterlegt (Integrations), weil native deutsche ElevenLabs-Stimmen über Vapis Key nicht verfügbar sind.

---

## 1. Instructions (System Prompt)

Der Prompt liegt in `vapi/system-prompt.md` und gilt für alle Stellen. Das Deploy-Skript entfernt die HTML-Kommentare, füllt die Platzhalter `{{GESPRAECHSART}}`, `{{ZIEL}}` und `{{DAUER}}` aus `_prompt` der Stelle und setzt den Text als System-Message ein. Stelle und Leitfaden kommen aus den n8n Data Tables (gepflegt in der UI); vor dem ersten Sync steht dort ein neutraler Text, mit dem der Agent kein Interview führt.

| Abschnitt | Inhalt | Warum |
| --- | --- | --- |
| Rolle | KI-Assistent von Everlast, Art des Gesprächs je Stelle (Kennenlerngespräch bzw. kurzes Fachgespräch), entscheidet nichts | Klare Identität; offen als KI erkennbar (Transparenz, EU AI Act) |
| Ziel | Leitfaden vollständig abdecken, Dauer je Stelle (Junior Entwickler 10–15 Minuten, Cyber Security 5–8 Minuten, nur Fachfragen) | n8n braucht alle Punkte für das Bewerberprotokoll |
| Stelle | Unternehmen, Aufgaben und Anforderungen. Alles andere: „weiß ich nicht, das beantwortet HR“ | Verhindert erfundene Aussagen zu Gehalt, Remote, Benefits oder Team |
| Leitfaden | Aus der Data Table „Leitfaden“ (UI), Reihenfolge = position. Junior Entwickler: Einwilligung → Name → Grundlagen → Softwareentwicklung → Erfahrung → Verfügbarkeit → Fragen des Bewerbers. Cyber Security: Einwilligung → Name → Phishing-Vorfall → Webhook absichern → KI-Agent mit CRM-Zugriff | REQ-1.3; feste Reihenfolge macht Gespräche vergleichbar |
| Gesprächsregeln | 1 Frage pro Beitrag, höchstens 2 Sätze, max. 2 Nachfragen pro Thema, kein Feedback, keine Lösungen oder Stichworte bei Fachfragen, keine AGG-Themen, Zahlen als Wörter, kein Markdown | REQ-1.4; kurze Beiträge senken die Latenz; die TTS liest alles wörtlich vor |
| Tonalität | locker, per Du, wertschätzend, nimmt Nervosität raus | REQ-1.5, passt zur Ansprache von Everlast |
| Sonderfälle | Stille, schlechte Verbindung, Beleidigung (1× Grenze setzen, 2× beenden), Abbruchwunsch, Frage nach Ergebnis, falsche Person, Prompt-Injection | REQ-1.7 |
| Abschluss | nächste Schritte nennen, dann `endCall` aufrufen, selbst nicht „Tschüss“ sagen | REQ-1.6; die Verabschiedung kommt als `endCallMessage`, so gibt es sie nur einmal |

> **Annahme – durch echte Stellenanzeige ersetzen:** Aufgaben und Anforderungen im Abschnitt „Stelle“ sind aus dem Profil von Everlast (KI-Automatisierungen, AI Voice Agents) abgeleitet, nicht aus einer echten Anzeige.

**Modell (`model`)**

| Einstellung | Wert | Warum |
| --- | --- | --- |
| `model` | `gpt-4.1` | Bessere Gesprächsführung als `gpt-4.1-mini` bei fast gleicher Time-to-First-Token im EU-Benchmark (P50 339 ms gegenüber 316 ms), gutes Deutsch, kein Reasoning-Overhead. Bis 19.11. lief `gpt-4.1-mini` |
| `temperature` | 0,4 | Hält sich an den Leitfaden, klingt aber nicht roboterhaft |
| `maxTokens` | 150 (Default 250) | Erzwingt kurze Beiträge |
| `fallbackModels` | `gpt-4.1-mini` | Weiterlaufen, wenn das Hauptmodell ausfällt |
| `promptCacheRetention` | `24h` | Der Prompt (rund 2.000 Token) bleibt gecacht, auch wenn zwischen zwei Interviews Stunden liegen |
| `tools` | `endCall` mit `rejectionPlan` | Der Agent legt selbst auf. Eine Regex blockiert das Auflegen, wenn die letzte Aussage des Bewerbers „warte“, „Moment“ oder „noch eine Frage“ enthält |

---

## 2. Voice

**Gewählt: ElevenLabs `eleven_v4_turbo`, native deutsche Stimme aus der ElevenLabs Voice Library (`gVOibprogMfmHVVyo5r6`, von Malik ausgewählt).**

**Wie es dazu kam:**

- **Start mit Cartesia „Jonas“** (`sonic-3.6`). Im ersten Testanruf klang die Stimme hörbar synthetisch.
- **Getestet**, alle über Vapis eigene Keys: MiniMax (`German_FriendlyMan`, `German_SweetLady`), OpenAI `gpt-4o-mini-tts` (`cedar`, `marin` mit Anweisung „akzentfreies Hochdeutsch“) und Deepgram Aura‑2 (`julius`, `viktoria`). Keine kam an ElevenLabs heran.
- **Native deutsche ElevenLabs-Stimmen** gibt es nur mit eigenem Key. Über Vapis Key bietet die Bibliothek nur englische Standardstimmen, und ihre Keyword-Suche (`GET /voice-library/11labs?keyword=…`) findet nur einen Bruchteil der ElevenLabs-Bibliothek.
- **Einrichtung:**
  1. ElevenLabs-Key in Vapi unter Integrations hinterlegen.
  2. Die Stimme in ElevenLabs zu „My Voices“ hinzufügen. Das verlangt Vapi.
  3. `voiceId` in `assistant.json` setzen und deployen.
- **Modell `eleven_v4_turbo`:** 129–150 ms bis zum ersten Audio, Elo 1339 (PROVIDER_RESEARCH.md, Abschnitt 1). Vapi ignoriert bei diesem Modell `similarityBoost`, `style`, `speed` und `optimizeStreamingLatency`. `eleven_flash_v2_5` wäre schneller, aber flacher. `multilingual_v2` und `v3` sind zu langsam für Live-Turns.
- **Free-Plan:** 10.000 Zeichen im Monat. Ein 6‑Minuten-Gespräch braucht rund 1.900 Zeichen Agent-Sprache.

| Einstellung | Wert | Warum |
| --- | --- | --- |
| `fallbackPlan.voices` | 1. Cartesia `sonic-3.6` „Jonas“, 2. Azure `de-DE-FlorianMultilingualNeural` | Beide laufen über Vapis Keys. Ist das ElevenLabs-Kontingent aufgebraucht oder fällt ElevenLabs aus, spricht der Agent trotzdem weiter |
| `chunkPlan.minCharacters` | 12 (Default 30) | Der erste Satzteil geht früher an die TTS, der Agent fängt schneller an zu sprechen |
| `chunkPlan.formatPlan.formattersEnabled` | nur `markdown`, `asterisk`, `stripAsterisk`, `quote`, `newline` | Vapis Zahlen- und Datumsformatter sind englisch („1200“ wird zu „twelve hundred“). Stattdessen schreibt das LLM Zahlen als deutsche Wörter (Prompt-Regel) |
| `chunkPlan.formatPlan.replacements` | siehe Tabelle | Aussprache englischer Fachbegriffe. Das funktioniert unabhängig vom Provider und gilt auch für den Fallback |

| Im Text | Gesprochen als | Grund |
| --- | --- | --- |
| n8n | „n eight n“ | offizielle Aussprache |
| Vapi | „Wapi“ | deutsch gelesen würde es „Fapi“ |
| API, APIs | „A P I“ | wird als Buchstaben gesprochen |
| LLM, LLMs | „L L M“ | wird als Buchstaben gesprochen |
| Make | „Mejk“ | deutsch gelesen würde es „Ma-ke“ |

`n8n` wird mit `replaceAllEnabled: true` ersetzt, weil `exact`-Ersetzungen sonst nur das erste Vorkommen treffen. Klingt „n eight n“ im Test falsch, ist „En-Äjt-En“ die Alternative.

---

## 3. Transcriber

| Einstellung | Wert | Warum |
| --- | --- | --- |
**Gewechselt von Deepgram Flux zu AssemblyAI** nach dem ersten Testanruf. Flux (`flux-general-multi`) hat dort mehrere Fehler gemacht:

- Den Namen „Malik Aljazzar“ hat es als „Medical Azure“ erkannt.
- Im Transkript standen Hindi-Schriftzeichen.
- Auf das Ende einer Aussage hat es bis zu 3,8 s gewartet, im Schnitt kam die Antwort nach 1,7 s.
- Bei Denkpausen ist der Agent trotzdem ins Wort gefallen.

| Einstellung | Wert | Warum |
| --- | --- | --- |
| `provider`, `speechModel` | `assembly-ai`, `universal-3-6-pro` | Im deutschen WER-Vergleich deutlich vor Deepgram (1,86 % gegenüber 4,35 % bei Nova‑3, PROVIDER_RESEARCH.md). Hat eingebaute semantische End-of-Turn-Erkennung |
| `language`, `languageCodes` | `multi`, `["de"]` | Die Pro-Modelle laufen als „multi“, `languageCodes` lenkt sie fest auf Deutsch |
| `agentContext` | Kurzbeschreibung des Gesprächs (Bewerbungsgespräch, oft nicht-deutsche Namen, Fachbegriffe) | Kontext für die Erkennung, vor allem bei Namen |
| `agentContextAutoUpdateEnabled` | `true` | Nach jedem Agent-Beitrag bekommt AssemblyAI die gerade gestellte Frage. Die Antwort wird im Kontext der Frage erkannt |
| `keytermsPrompt` | Everlast, n8n, Vapi, JavaScript, TypeScript, Python, React, API, Webhook, GitHub, LLM, Make, CRM, Bachelorarbeit, Kündigungsfrist | Bei den Pro-Modellen ohne Aufpreis |
| `endOfTurnConfidenceThreshold`, `minEndOfTurnSilenceWhenConfident`, `maxTurnSilence` | 0,7 / 500 ms / 1800 ms | Ist das Modell sicher, antwortet der Agent nach 0,5 s. Bei Denkpausen wartet er bis zu 1,8 s, statt ins Wort zu fallen. Die Defaults (160 / 400 ms) sind für Interviews zu ungeduldig |
| `vadAssistedEndpointingEnabled` | `true` | Solange die Sprachaktivitätserkennung noch Sprache hört, wird das Turn-Ende zurückgehalten |
| `startSpeakingPlan.smartEndpointingPlan` | nicht gesetzt | Sonst würde Vapi die End-of-Turn-Erkennung von AssemblyAI ignorieren |
| `fallbackPlan.transcribers` | Soniox `stt-rt-v6`, Deutsch, `agentTextInputEnabled`, dieselben Begriffe als `customVocabulary` | Zweiter Anbieter mit eigener semantischer Turn-Erkennung, falls AssemblyAI ausfällt |

---

## 4. Advanced / Messaging

### Server und Webhook

| Einstellung | Wert | Warum |
| --- | --- | --- |
| Server-URL (Org-Einstellungen) | `https://n8n.mal-zeta.de/webhook/vapi/interview` | Production-URL des n8n-Webhooks (REQ-2.4). Vapi nimmt die erste vorhandene URL in der Reihenfolge Assistant → Telefonnummer → Organisation |
| Credential (Org-Einstellungen) | `everlast-n8n-x-vapi-secret` (`07b6d617-0959-44bb-8e9f-495fe910a22e`) | Typ `custom-credential` mit Bearer-Plan, `headerName: "X-Vapi-Secret"` und `bearerPrefixEnabled: false`. Vapi sendet damit `X-Vapi-Secret: <Secret>`, und n8n prüft den Header per Header Auth. Das Secret steht nur in `.env` und im Credential, nie im Repo |
| `server` am Assistant | `null` | Bewusst leer, damit die Org-Einstellung greift (siehe unten). `null` in `assistant.json` entfernt einen früher gespeicherten Wert, ein fehlendes Feld würde ihn beim `PATCH` stehen lassen |
| `serverMessages` | `["end-of-call-report", "status-update"]` | Der Report für die Auswertung, `status-update` (Anruf läuft / beendet) für den Live-Status in der UI. Der Default schickt zusätzlich `conversation-update`, `speech-update` und weitere Events, also viele unnötige Aufrufe |

> **Warum der Webhook in den Org-Einstellungen steht**
>
> - **Problem:** „Talk to Assistant“ schickt die komplette Konfiguration als `assistantOverrides` mit. Stand `server` am Assistant, galt die Server-URL damit als „vom Request geliefert“, und Vapi ließ das Credential weg (`serverMessage.credentialsWithheld` im Call-Log). n8n bekam den Bericht ohne `X-Vapi-Secret`, antwortete mit 403 und legte keine Ausführung an.
> - **Lösung (seit 19.11.):** Server-URL und Credential sind auf Organisationsebene gesetzt (nur im Dashboard möglich, die Org-API ist mit dem privaten Key nicht erreichbar). Org-Einstellungen gelten als vertrauenswürdig, das Credential wird bei allen Anrufen mitgeschickt.
> - **Nebenwirkung:** Der `backoffPlan` (3 Retries) hing an `server` am Assistant. Ob die Org-Einstellung Retries hat, lässt sich per API nicht prüfen. Doppelte Zustellungen fängt n8n weiter über die Call-ID ab (REQ-3.7).
> - **Verpasster Report:** `GET /call/{id}` bei Vapi holen und als `end-of-call-report` mit Secret an den Webhook schicken.

### Nachrichten

| Feld | Wert | Warum |
| --- | --- | --- |
| `firstMessage` | „Hallo und schön, dass du da bist! Ich bin der KI-Assistent von Everlast Consulting und führe heute ein erstes Kennenlerngespräch mit dir für die Stelle als Junior Entwickler. Kurz vorab: Das Gespräch wird aufgezeichnet und automatisch ausgewertet, die Entscheidung trifft aber immer unser HR-Team. Bist du damit einverstanden?“ | REQ-1.2: KI-Hinweis, Zweck, Aufnahme und automatische Auswertung, Entscheidung bei HR, Frage nach Einwilligung |
| `firstMessageMode`, `firstMessageInterruptionsEnabled` | `assistant-speaks-first`, `false` | Der Hinweis wird vollständig gesprochen, bevor der Bewerber antwortet |
| `endCallMessage` | „Danke dir für deine Zeit und alles Gute. Tschüss!“ | Wird gesprochen, wenn das LLM `endCall` aufruft, weil das Tool keine eigene Ansage hat |
| `endCallPhrases` | „tschüss“, „auf wiederhören“ | Sicherheitsnetz: Verabschiedet sich das LLM doch selbst, wird trotzdem aufgelegt |
| `voicemailMessage` | „Hallo, hier ist der KI-Assistent von Everlast Consulting. Wir wollten mit dir ein erstes Kennenlerngespräch für die Stelle als Junior Entwickler führen. Wir melden uns noch einmal bei dir. Bis bald!“ | REQ-2.4 |
| `voicemailDetection` | `{"provider": "vapi", "type": "audio"}` | Greift nur bei ausgehenden Anrufen. Bei Web-Calls und eingehenden Anrufen hat es keine Wirkung |

### Stille, Dauer und Unterbrechungen

`silenceTimeoutSeconds` und `messagePlan.idleMessages` gibt es im aktuellen Schema nicht mehr. Stille wird über `hooks` mit `customer.speech.timeout` gesteuert:

| Hook | Auslöser | Aktion |
| --- | --- | --- |
| `stille-nachfragen` | 12 s Stille, höchstens 2× pro Pause (Zähler wird zurückgesetzt, sobald der Bewerber spricht) | „Bist du noch da?“ oder „Lass dir ruhig Zeit. Bist du noch da?“ |
| `stille-beenden` | 30 s Stille | `endCall` mit eigener Ansage: „Ich höre leider nichts mehr von dir, deshalb beende ich das Gespräch jetzt. Melde dich gern noch einmal. Tschüss!“ |

| Einstellung | Wert | Warum |
| --- | --- | --- |
| `maxDurationSeconds` | 1200 (Default 600) | Ziel sind 10–15 Minuten. Mit dem Default würden längere Interviews nach 10 Minuten abgeschnitten |
| `stopSpeakingPlan.numWords` | 1 | Ein echtes Wort unterbricht den Agent sofort, reine Rückmeldelaute nicht |
| `stopSpeakingPlan.acknowledgementPhrases` | ja, mhm, okay, ok, genau, aha, hm, stimmt, alles klar | Die Default-Liste ist englisch. Ein deutsches „mhm“ soll den Agent nicht stoppen |
| `stopSpeakingPlan.interruptionPhrases` | stopp, warte, moment, nein, aber, eigentlich, entschuldigung, sorry | Unterbrechen immer sofort (Default-Liste ist englisch) |
| `backgroundSpeechDenoisingPlan.smartDenoisingPlan.enabled` | `true` (Krisp) | Filtert Hintergrundgeräusche und fremde Stimmen, dadurch weniger falsche Unterbrechungen |

### Aufnahme, Transkript und Analyse

| Einstellung | Wert | Warum |
| --- | --- | --- |
| `artifactPlan.recordingEnabled`, `recordingFormat` | `true`, `mp3` | Damit HR das Gespräch nachhören kann (Link in der Slack-Nachricht). Vapi legt Mono, Einzelspuren und Stereo an. Die Dateien liegen privat, die vorsignierten Links (`artifact.presignedStereoUrl`) gelten nur 30 Minuten. Die Slack-Nachricht verlinkt deshalb auf den n8n-Workflow „Vapi – Aufnahme abrufen“ (`/webhook/vapi/aufnahme?call=<Call-ID>`), der bei jedem Klick einen frischen Link holt und weiterleitet; n8n speichert keine Kopie. MP3 ist deutlich kleiner als WAV. Eine eigene Transkription aus der Aufnahme wird bewusst nicht umgesetzt (siehe REQUIREMENTS F6) |
| `artifactPlan.transcriptPlan.enabled` | `true` | Das Vapi-Transkript ist die Grundlage der Analyse in n8n |
| `analysisPlan.summaryPlan`, `structuredDataPlan`, `successEvaluationPlan` | alle `enabled: false` | REQ-4.1: Die Analyse läuft in n8n, damit Kriterien, Modell und Speicherort in eigener Hand bleiben. Vapi erstellt keine eigene Zusammenfassung oder Bewertung |
| `metadata` | `jobId`, `jobTitle`, `company` | Zusätzliche Stellenzuordnung neben der Assistant-ID (REQ-3.6) |

---

## 5. Latenz (Frage 4)

Ziel (REQ-7.1): weniger als etwa 1 Sekunde vom Ende der Aussage bis zum Beginn der Antwort.

| Maßnahme | Einstellung | Effekt |
| --- | --- | --- |
| Schnelle Turn-Erkennung | Semantische End-of-Turn-Erkennung von AssemblyAI, kein `smartEndpointingPlan` | Ist das Modell sicher, antwortet der Agent nach 0,5 s statt nach festen Pausen. Mit Flux lag der Schnitt im ersten Test bei 1,7 s, weil es bei Unsicherheit bis zu 5 s wartete |
| Kurze Mindestwartezeit | `startSpeakingPlan.waitSeconds` 0,3 (Default 0,4) | Die Untergrenze sinkt um 100 ms. Ist die Pipeline ohnehin langsamer, ändert das nichts |
| Schnelles LLM | `gpt-4.1` mit Prompt-Caching (24 h) | TTFT P50 rund 339 ms |
| Kurze Antworten | `maxTokens` 150, Prompt: höchstens 2 Sätze, 1 Frage | Weniger Text bis zum ersten Satzende, kürzere Turns |
| Früher TTS-Start | `chunkPlan.minCharacters` 12 | Die TTS startet schon mit dem ersten Satzteil |
| Schnelle TTS | ElevenLabs `eleven_v4_turbo` | 129–150 ms bis zum ersten Audio (EU-Benchmark bzw. Hersteller) |
| Kein Ballast | `backgroundSound: "off"`, keine Tools außer `endCall`, n8n erst nach dem Call | Keine Tool-Roundtrips im Gespräch (REQ-7.2) |
| Region | Vapi-Organisation und die Provider laufen in den USA | Keine Sprünge zwischen Regionen pro Turn. Für Bewerber in Deutschland kommt eine transatlantische Strecke dazu (rund 100 ms) [?] |

**Grobe Rechnung pro Turn (Schätzung):** End-of-Turn 0,2–0,4 s + LLM ~0,3 s + TTS 0,15–0,27 s + Transport ≈ **0,7–1,0 s**.

**Messen (REQ-7.3):** `artifact.performanceMetrics` im End-of-Call-Report bzw. die Call-Logs im Dashboard zeigen die Turn-Latenz pro Komponente. Für Vorher/Nachher eignet sich der Vergleich mit dem Standard-Assistant „Riley“.

**Weitere Hebel, bewusst nicht aktiv:** `eotThreshold` senken (schneller, aber mehr Unterbrechungen), `serviceTier: "fast"` (teurer), `gpt-4.1-nano` (schwächere Gesprächsführung), `customEndpointingRules` (z. B. längere Pause nach offenen Fragen).

---

## 6. Abweichungen von PROVIDER_RESEARCH.md

Geprüft am 2026-11-15 gegen die OpenAPI-Spec und die Live-API:

- **Stille:** `silenceTimeoutSeconds` und `messagePlan.idleMessages` gibt es nicht mehr. Ersatz sind `hooks` mit `customer.speech.timeout`.
- **Flux Multilingual:** Die Sprache wird über `transcriber.languages: ["de"]` gesetzt, nicht über `language`.
- **Credential:** `provider: "custom-credential"` mit `authenticationPlan.type: "bearer"`. `POST /credential` fehlt in der öffentlichen Spec, funktioniert aber.
- **Cartesia als Fallback:** `FallbackCartesiaVoice` hat inzwischen ein `model`-Feld (Stand Spec 2026-11-15), `sonic-3.6` wird gespeichert.
- **Stimmen:** ElevenLabs bietet über Vapis Key nur die Standardstimmen, für native deutsche Stimmen braucht es einen eigenen Key. Die Cartesia-Stimmen „Nico“ und „Viktoria“ lehnt die API ab.
- **Versionen:** Die Organisation hat Assistant-Versionierung. Jeder `PATCH` veröffentlicht eine neue Version (`GET /assistant/{id}/versions`). Das Dashboard bearbeitet einen eigenen Entwurf (`GET /assistant/{id}/draft`), den spätere API-Änderungen nicht erreichen. **„Talk to Assistant“ testet diesen Entwurf** (er wird als `assistantOverrides` mitgeschickt), nicht die veröffentlichte Version. Nach jedem Deploy oder Sync deshalb den Entwurf verwerfen, bevor man testet: im Dashboard oder mit `python vapi/deploy.py --discard-draft` (`DELETE /assistant/{id}/draft/{draftId}`). Das Dashboard legt beim nächsten Öffnen einen frischen Entwurf aus der neuesten Version an. Einen veralteten Entwurf nie veröffentlichen, er würde die Konfiguration zurückdrehen (so geschehen mit v7 am 15.11.).
- **Dashboard-Testanrufe:** Mit `server` am Assistant kamen sie ohne Webhook-Credential an. Deshalb steht der Webhook in den Org-Einstellungen (Abschnitt 4).
- **Formatter:** Die `formatPlan`-Formatter sind englisch und deshalb eingeschränkt.
- **Ersetzungen:** `exact`-Replacements ersetzen standardmäßig nur das erste Vorkommen, daher `replaceAllEnabled: true`.
- **API-Zugriff:** Die API verlangt einen eigenen User-Agent. Cloudflare blockt den Standard-Agent von Python (Fehler 1010).

## 7. Offene Punkte

- **Testgespräch im Dashboard** („Talk to Assistant“): Stimme, Aussprache (n8n, Vapi, Everlast, Make), Stille-Hooks und Auflegen prüfen, insbesondere ob es genau eine Verabschiedung gibt.
- **n8n:** Webhook `/webhook/vapi/interview` als Production-URL aktiv; Header-Auth-Credential mit Header `X-Vapi-Secret` und demselben Secret wie in `.env`.
- **Telefonnummer (REQ-1.8):** nicht angelegt. Bei Bedarf in Vapi kaufen oder importieren und diesem Assistant zuweisen.
- **Optional:** `artifactPlan.transcriptPlan.assistantName` / `userName` (z. B. „Interviewer“ / „Bewerber“) für ein lesbareres Transkript. Nur zusammen mit dem n8n-Workflow ändern, falls dieser die Präfixe „AI:“ / „User:“ auswertet.
