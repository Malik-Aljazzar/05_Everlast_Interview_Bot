# Provider-Recherche – Vapi für deutsche Interviews

Stand: 2026-11-15. Grundlage für die Fragen 2–7 aus der Mail.
Legende: **[V]** = in Vapi-Doku bzw. Vapi OpenAPI-Spec (`https://api.vapi.ai/api-json`) bestätigt, **[3P]** = Drittanbieter-/Herstellerbenchmark, **[?]** = abgeleitet oder unbestätigt.

## 1. Voice (TTS) – Frage 3

**Empfehlung:** ElevenLabs `eleven_v4_turbo` mit nativer deutscher Gesprächsstimme, Fallback Cartesia `sonic-3.6` (deutsche Stimme) über `voice.fallbackPlan`.

| Modell | Latenz | Preis | Bemerkung |
| --- | --- | --- | --- |
| ElevenLabs `eleven_v4_turbo` (seit 2026-09-28) | ~150 ms bis erste Sprache (Hersteller), 129 ms TTFB P50 EU-Benchmark [3P] | $0,04 / 1k Zeichen (≈ $0,03–0,04 pro Minute Agent-Sprache, Schätzung) | Elo 1339 (#2, Artificial Analysis). Vapi ignoriert hier `optimizeStreamingLatency`, `speed`, `autoMode`, `enableSsmlParsing` [V] |
| ElevenLabs `eleven_flash_v2_5` | ~75 ms | $0,04 / 1k | weniger expressiv; nur hier und bei Turbo v2.5 greift `language: "de"` [V] |
| ElevenLabs Multilingual v2 / v3 / v4 | langsamer | $0,08 / 1k | nicht für Live-Turns |
| Cartesia `sonic-3.6` (in Vapi seit 2026-10-19) | <90 ms laut Hersteller, 143–270 ms unabhängig gemessen [3P] | $49 / 1 Mio. Zeichen | Elo 1294 (#4); deutsche Stimmen z. B. „Viktoria“, „Nico“ [3P] |
| Azure de-DE Neural | – | – | beste EU-Residency-Option, Prosodie flacher [subjektiv] |
| OpenAI TTS | – | – | keine Spracheinstellung → Akzentrisiko |
| GPT-Live-1 (Speech-to-Speech) | – | – | deutsche Stimmen seit 2026-11-02, andere Architektur, weniger Kontrolle |

- Wenn kein Modell gesetzt ist, nimmt Vapi `eleven_turbo_v2` → Modell immer explizit setzen [V].
- PlayHT steht nicht mehr in Vapis Provider-Liste.
- **Englische Fachbegriffe** („n8n“, „React“, „API“): ElevenLabs Pronunciation Dictionaries (`voice.pronunciationDictionaryLocators`; Alias-Regeln überall, IPA ab v3/v4) oder providerunabhängig `voice.chunkPlan.formatPlan.replacements` (z. B. „n8n“ → „n-eight-n“).

## 2. Transcriber (STT)

**Empfehlung:** Deepgram `flux-general-multi` mit `language: "de"` und `keyterm`-Liste (n8n, React, TypeScript, Everlast …), Fallback Soniox `stt-rt-v6`.

- Flux hat eingebaute End-of-Turn-Erkennung für Deutsch (<400 ms). Vapis LiveKit-Smart-Endpointing ist nur Englisch.
- Mit Flux **kein** `smartEndpointingPlan` setzen, stattdessen `eotThreshold` (Default 0,7) und `eotTimeoutMs` (Default 5000) tunen [V].
- $0,0078 / min, EU-Endpoint vorhanden.

Deutsche WER (EU-Benchmark Okt. 2026, nur 161 Wörter → nur Tendenz) [3P]:

| Modell | WER |
| --- | --- |
| ElevenLabs Scribe v2 | 0,62 % |
| Gemini 3.5 Transcribe | 1,24 % |
| AssemblyAI U3-RT-Pro | 1,86 % |
| Soniox v5 | 3,73 % |
| Deepgram Nova-3 | 4,35 % |

Weitere Optionen in Vapi [V]: `scribe_v2_realtime`, AssemblyAI `universal-3-6-pro`, Soniox, Speechmatics (`region: "eu"`), Gladia `solaria-1` (`region: "eu-west"`), Azure, Gemini, OpenAI `gpt-transcribe`, Cartesia `ink-2`.

## 3. LLM im Gespräch (Vapi)

**Empfehlung:** `gpt-4.1-mini` (bzw. `gpt-4.1` für mehr Qualität), Temperatur ~0,4, `maxTokens` ~150. EU-Variante: `gpt-4.1-mini-2025-04-14:germanywestcentral`.

Time to first token, EU-Voice-Benchmark Okt. 2026, P50 [3P]:

| Modell | P50 |
| --- | --- |
| gpt-4.1-mini | 316 ms |
| GPT-4.1 | 339 ms |
| gpt-4o-mini | 345 ms |
| gpt-5.4-nano | 400 ms |
| GPT-5.4 mini | 411 ms |
| Gemini Flash-Lite 3.5 / 3.1 | ~700 ms |
| gpt-5-mini (Reasoning) | 2.941 ms – vermeiden |

Ebenfalls in Vapi [V]: Anthropic `claude-haiku-5-5` / `claude-haiku-4-5` (bei Haiku 5.5 `reasoningEffort` leer oder „none“, `maxTokens` setzen), Google `gemini-3.8-flash`, Groq (US-gehostet [?]), Mistral. Claude/Gemini waren nicht im Benchmark → selbst messen.

## 4. Latenz – Frage 4

**Empfehlung:** Flux-End-of-Turn, `waitSeconds` 0,2–0,3, `chunkPlan.minCharacters` 10–15, niedriges `maxTokens`, `backgroundSound: "off"`, alle Provider in derselben Region wie Vapi.

Feldnamen aus der OpenAPI-Spec [V]:

- `startSpeakingPlan`: `waitSeconds` (Default 0,4); `smartEndpointingPlan.provider` (`vapi` | `livekit` (nur EN) | `custom-endpointing-model`); `transcriptionEndpointingPlan` (`onPunctuationSeconds` 0,1, `onNoPunctuationSeconds` 1,5, `onNumberSeconds` 0,4); `customEndpointingRules` (Regex + Timeout, z. B. längere Pausen nach offenen Fragen).
- `stopSpeakingPlan`: `numWords` 0, `voiceSeconds` 0,2, `backoffSeconds` 1; `acknowledgementPhrases` (z. B. „ja“, „mhm“, „okay“, „genau“ – unterbrechen den Agent nicht); `interruptionPhrases`.
- `voice`: `chunkPlan` (`enabled`, `minCharacters` Default 30, `punctuationBoundaries`, `formatPlan`), `optimizeStreamingLatency` 0–4, `cachingEnabled`, `fallbackPlan`.
- `model`: `maxTokens` (Default 250), `promptCacheRetention: "24h"` (GPT-4.1/5), `serviceTier`.
- `backgroundSound`: Default „office“ bei Telefon → „off“. `backgroundSpeechDenoisingPlan.smartDenoisingPlan.enabled` = Krisp.
- **`maxDurationSeconds` Default 600 (10 min)** → für Interviews erhöhen.
- Messung: `artifact.performanceMetrics` (Turn-Latenz pro Komponente).
- Region wird pro Organisation gesetzt. US-Org + EU-Provider = transatlantische Hops pro Turn.

## 5. End-of-Call-Report & Webhook – Fragen 1 und 5 [V]

**Empfehlung:** `assistant.server = { url, credentialId }` mit Bearer-Credential, `serverMessages: ["end-of-call-report"]`, Aufnahme sofort über `artifact.presignedStereoUrl` laden.

- Felder: `message.type`, `message.endedReason`, `message.startedAt`, `message.endedAt`, `message.cost(s)`, `message.analysis`, `message.call.id`, `message.call.assistantId`, `message.assistant.id`, `message.artifact.transcript`, `.messages`, `.messagesOpenAIFormatted`, `.recording.stereoUrl`, `.recording.mono.{combinedUrl, assistantUrl, customerUrl}`, `.presignedStereoUrl` / `.presignedMonoUrl` + `presignedUrlsExpiresAt`, `logUrl`, `structuredOutputs`.
- `artifact.recordingUrl` / `stereoRecordingUrl` sind deprecated. **Es gibt kein `durationSeconds`** → aus `endedAt − startedAt` berechnen.
- Roh-URLs der Aufnahmen brauchen Auth → presigned URL oder `GET /call/{id}/stereo-recording` mit API-Key.
- Auth: `server.url`, `server.credentialId`, `server.headers`, `timeoutSeconds` (Default 20), `backoffPlan`, `staticIpAddressesEnabled`. `serverUrl` / `serverUrlSecret` gibt es nicht mehr. Für den Header `X-Vapi-Secret`: Bearer-Credential mit `headerName: "X-Vapi-Secret"` und `bearerPrefixEnabled: false`. HMAC und OAuth2 ebenfalls möglich.
- Aufnahme: `artifactPlan.recordingEnabled` (Default true) erzeugt Mono, Einzelkanäle und Stereo. `recordingFormat`: `wav;l16` oder `mp3`.
- Eigener Speicher: S3 (mit Region, z. B. eu-central-1), GCS, Azure Blob, R2, Supabase, `s3-compatible` (Hetzner Object Storage sollte gehen, ungetestet). `recordingUseCustomStorageEnabled`, `recordingPath`. Vapi-Aufbewahrung 14/30/180 Tage je nach Plan, Zero Data Retention ab Core/Pro.
- Eigenes Transkript: Stereo-Datei (ein Sprecher pro Kanal) aus n8n an Scribe v2 (Batch), Deepgram EU oder selbst gehostetes Whisper auf Hetzner.

## 6. EU-Datenhaltung – Bonusfrage 6

**Empfehlung:** Komplett EU nur mit Vapi EU-Region (`dashboard.eu.vapi.ai`, `api.eu.vapi.ai`, `sip.eu.vapi.ai`; nur mit Premier Success Package über Sales) plus eigene Provider-Keys auf EU-Endpoints. Sonst Pipecat / LiveKit Agents selbst in der EU hosten.

- Vapi EU läuft vermutlich in AWS eu-central-1 (Frankfurt) [Ableitung aus IP-Ranges]. US-Übermittlung laut Vapi per SCCs abgedeckt. System-Logs und Metriken bleiben immer bei Vapi.
- EU-fähige Provider in Vapi [V]:
  - LLM: OpenAI region-pinned (`:germanywestcentral`, `:swedencentral`, `:westeurope`), eigenes Azure OpenAI EU, Bedrock eu-central-1 / eu-west-1 / eu-west-3, Mistral, Custom LLM.
  - STT: Speechmatics `eu`, Gladia `eu-west`, Soniox EU-`apiUrl`, Deepgram `api.eu.deepgram.com` (ungetestet), Azure Speech EU.
  - TTS: ElevenLabs `apiUrl: "https://api.eu.residency.elevenlabs.io"` (Enterprise-Residency nötig), Azure TTS EU, Cartesia (EU nur Enterprise).
- Alternativen: Pipecat / LiveKit Agents auf Hetzner; Plattformen wie sipgate AI Agents, Famulor, Parloa, Cognigy, telli, Gradium (FR). Statt Slack: Mattermost, Rocket.Chat, Element/Matrix, Stackfield.

## 7. AWS mit Vapi – Bonusfrage 7

**Empfehlung:** S3 in eu-central-1 für Aufnahmen; Claude über den Provider `anthropic-bedrock` (STS-Rolle) – EU-Inference-Route vorher testen. Polly und Transcribe werden nicht unterstützt.

- S3-Credential: `awsAccessKeyId`, `awsSecretAccessKey`, `region`, `s3BucketName`, `s3PathPrefix`. IAM-User nur mit `PutObject` auf das Prefix.
- Bedrock nativ: nur Claude. Auth per IAM-Rolle (Trust auf Vapis AWS-Account 533267069243 + `externalId`) oder IAM-Keys. Regionen u. a. eu-central-1, eu-west-1, eu-west-3. `global.*`-Profile routen weltweit → nicht EU-only. Haiku 5.5 in Frankfurt nur über `eu.`-Cross-Region-Profil, in Vapi nicht dokumentiert → testen [?].
- Andere Bedrock-Modelle (Nova, Llama, Mistral) nur über `custom-llm` (OpenAI-kompatibler Streaming-Endpoint, z. B. LiteLLM in eu-central-1) → ein Hop mehr.
- Polly / Transcribe gibt es im Vapi-Schema nicht; nur über Custom-Voice- bzw. Custom-Transcriber-Server (kostet Latenz und Qualität).

## Quellen

- Vapi: docs.vapi.ai/providers/voice/elevenlabs, …/voice/cartesia, …/transcriber/deepgram, …/transcriber/soniox, …/model/openai, …/model/anthropic, …/model/anthropic-bedrock, docs.vapi.ai/customization/voice-pipeline-configuration, docs.vapi.ai/server-url/events, docs.vapi.ai/server-url/server-authentication, docs.vapi.ai/assistants/call-recording, docs.vapi.ai/security-and-privacy/eu-region, docs.vapi.ai/security-and-privacy/data-flow, docs.vapi.ai/billing/pricing-and-success-packages, docs.vapi.ai/changelog, api.vapi.ai/api-json
- ElevenLabs: elevenlabs.io/blog/eleven-v4, elevenlabs.io/pricing/api, elevenlabs.io/docs/overview/administration/data-residency
- Benchmarks: artificialanalysis.ai/text-to-speech/leaderboard, famulor.io/blog/voice-ai-benchmarkchoosing-oct-2026
- Deepgram: deepgram.com/blog/deepgram-launches-flux-multilingual-press-release, deepgram.com/pricing, developers.deepgram.com/reference/regional-endpoints
- AWS: docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html
