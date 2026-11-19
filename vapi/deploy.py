#!/usr/bin/env python3
"""Deploy the Everlast interview assistants to Vapi (stdlib only), one assistant per job.

Steps:
  1. Read secrets from <repo>/.env (VAPI_API_KEY, WEBHOOK_SECRET; optional
     VAPI_CREDENTIAL_ID and the job's assistant ID, e.g. VAPI_ASSISTANT_ID).
  2. Create the server credential (custom-credential, bearer type, header
     X-Vapi-Secret without "Bearer " prefix) unless VAPI_CREDENTIAL_ID is set.
  3. Build the assistant payload from vapi/assistant.json (shared), the job
     overlay vapi/jobs/<job>.json and vapi/system-prompt.md.
  4. POST /assistant, or PATCH /assistant/{id} if the job's assistant ID is set.
  5. Append newly created IDs (IDs only, never secrets) to .env.
  6. GET the assistant back and verify the stored config matches the payload.

The prompt sections "# Stelle" and "# Leitfaden" are maintained in Google Sheets
and synced into Vapi by the n8n workflow "Vapi – Leitfaden synchronisieren". When
updating an existing assistant, this script keeps the live versions of those
sections; the text in system-prompt.md is only the initial value.

Usage (every command takes --job <name>, default junior-entwickler):
  python vapi/deploy.py                    # deploy + verify
  python vapi/deploy.py --job cyber-security
  python vapi/deploy.py --dry-run          # build payload and print summary, no API calls
  python vapi/deploy.py --verify           # only GET + verify the existing assistant
  python vapi/deploy.py --reset-sections   # overwrite the synced sections with system-prompt.md
  python vapi/deploy.py --discard-draft    # delete the stale dashboard draft before testing there

Secrets are never printed: every line of output passes through redact().
Note: PATCH replaces the top-level objects that are sent, but fields that
were removed from assistant.json stay on the stored assistant.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

API_BASE = "https://api.vapi.ai"
# Cloudflare in front of api.vapi.ai rejects the default "Python-urllib" agent (error 1010).
USER_AGENT = "everlast-interview-bot-deploy/1.0"

VAPI_DIR = Path(__file__).resolve().parent
REPO_ROOT = VAPI_DIR.parent
ENV_PATH = REPO_ROOT / ".env"
ASSISTANT_PATH = VAPI_DIR / "assistant.json"
PROMPT_PATH = VAPI_DIR / "system-prompt.md"
JOBS_DIR = VAPI_DIR / "jobs"
DEFAULT_JOB = "junior-entwickler"

PROMPT_PLACEHOLDER = "__SYSTEM_PROMPT__"
KEYTERMS_PLACEHOLDER = "__KEYTERMS__"
CREDENTIAL_PLACEHOLDER = "__VAPI_CREDENTIAL_ID__"
CREDENTIAL_NAME = "everlast-n8n-x-vapi-secret"
SECRET_HEADER = "X-Vapi-Secret"

_SECRETS: list[str] = []


# --------------------------------------------------------------------------- output


def redact(text: str) -> str:
    for secret in _SECRETS:
        if secret:
            text = text.replace(secret, "<redacted>")
    return text


def say(*parts: object) -> None:
    print(redact(" ".join(str(p) for p in parts)))


def fail(message: str) -> None:
    say("FEHLER:", message)
    sys.exit(1)


# --------------------------------------------------------------------------- .env


def read_env_text() -> str:
    raw = ENV_PATH.read_bytes()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        # The file was saved by a Windows editor in cp1252 (umlauts in comments).
        return raw.decode("cp1252")


def load_env() -> dict[str, str]:
    if not ENV_PATH.exists():
        fail(f"{ENV_PATH} nicht gefunden.")
    env: dict[str, str] = {}
    for line in read_env_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    # Register every secret-looking value for redaction.
    for key, value in env.items():
        if any(tag in key.upper() for tag in ("KEY", "SECRET", "TOKEN", "PASSWORD")):
            _SECRETS.append(value)
    return env


def append_env(values: dict[str, str]) -> None:
    """Append IDs to .env (ASCII only, so the existing encoding is preserved)."""
    if not values:
        return
    raw = ENV_PATH.read_bytes()
    header = "# Vapi IDs (written by vapi/deploy.py)"
    lines = []
    if raw and not raw.endswith(b"\n"):
        lines.append("")
    if header.encode("ascii") not in raw:
        lines.append(header)
    lines += [f"{k}={v}" for k, v in values.items()]
    with ENV_PATH.open("ab") as fh:
        fh.write(("\n".join(lines) + "\n").encode("ascii"))
    say("IDs in .env ergänzt:", ", ".join(values))


# --------------------------------------------------------------------------- HTTP


def api(method: str, path: str, api_key: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        API_BASE + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            text = resp.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")
        fail(f"{method} {path} -> HTTP {err.code}: {detail[:2000]}")
    except urllib.error.URLError as err:
        fail(f"{method} {path} -> {err.reason}")
    return json.loads(text) if text else {}


# --------------------------------------------------------------------------- payload


def strip_private_keys(obj):
    """Remove documentation keys (prefixed with '_') recursively."""
    if isinstance(obj, dict):
        return {k: strip_private_keys(v) for k, v in obj.items() if not k.startswith("_")}
    if isinstance(obj, list):
        return [strip_private_keys(v) for v in obj]
    return obj


def deep_merge(base, overlay):
    """Overlay wins: dicts are merged recursively, lists and values are replaced."""
    if isinstance(base, dict) and isinstance(overlay, dict):
        merged = dict(base)
        for key, value in overlay.items():
            merged[key] = deep_merge(base[key], value) if key in base else value
        return merged
    return overlay


def load_job(name: str) -> dict:
    path = JOBS_DIR / f"{name}.json"
    if not path.exists():
        known = ", ".join(p.stem for p in sorted(JOBS_DIR.glob("*.json")))
        fail(f"{path} nicht gefunden. Vorhandene Stellen: {known}")
    job = json.loads(path.read_text(encoding="utf-8"))
    if not job.get("_assistantIdEnv"):
        fail(f"{path}: _assistantIdEnv fehlt.")
    return job


def load_prompt(variables: dict[str, str]) -> str:
    text = PROMPT_PATH.read_text(encoding="utf-8")
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)  # drop maintainer comments
    text = re.sub(r"\n{3,}", "\n\n", text)  # removed comments leave blank lines behind
    for key, value in variables.items():
        text = text.replace("{{" + key + "}}", value)
    missing = sorted(set(re.findall(r"\{\{(\w+)\}\}", text)))
    if missing:
        fail(f"Platzhalter ohne Wert in _prompt der Stelle: {', '.join(missing)}")
    return text.strip() + "\n"


# Sections synced from Google Sheets by n8n: (heading, next heading).
SYNCED_SECTIONS = [("# Stelle", "# Leitfaden"), ("# Leitfaden", "# Gesprächsregeln")]


def keep_synced_sections(prompt: str, live_prompt: str) -> str:
    """Replace the synced sections in the repo prompt with their live versions."""
    for start, end in SYNCED_SECTIONS:
        pattern = re.compile(rf"({re.escape(start)}\n)(.*?)(\n{re.escape(end)}\n)", re.DOTALL)
        live = pattern.search(live_prompt)
        if live and pattern.search(prompt):
            prompt = pattern.sub(lambda m: m.group(1) + live.group(2) + m.group(3), prompt, count=1)
    return prompt


def live_system_prompt(api_key: str, assistant_id: str) -> str:
    stored = api("GET", f"/assistant/{assistant_id}", api_key)
    for msg in stored.get("model", {}).get("messages", []):
        if msg.get("role") == "system":
            return msg.get("content", "")
    return ""


def discard_drafts(api_key: str, assistant_id: str) -> None:
    """Delete the dashboard drafts: "Talk to Assistant" tests the draft, not the latest version."""
    drafts = api("GET", f"/assistant/{assistant_id}/draft", api_key).get("results", [])
    for draft in drafts:
        api("DELETE", f"/assistant/{assistant_id}/draft/{draft['id']}", api_key)
    say(f"Dashboard-Entwürfe verworfen: {len(drafts)}")


def build_payload(job: dict, credential_id: str, live_prompt: str = "") -> dict:
    base = json.loads(ASSISTANT_PATH.read_text(encoding="utf-8"))
    payload = strip_private_keys(deep_merge(base, job))
    prompt = load_prompt(job.get("_prompt", {}))
    if live_prompt:
        prompt = keep_synced_sections(prompt, live_prompt)
    replaced = False
    for msg in payload.get("model", {}).get("messages", []):
        if msg.get("content") == PROMPT_PLACEHOLDER:
            msg["content"] = prompt
            replaced = True
    if not replaced:
        fail(f"Platzhalter {PROMPT_PLACEHOLDER} nicht in model.messages gefunden.")
    if (payload.get("server") or {}).get("credentialId") == CREDENTIAL_PLACEHOLDER:
        payload["server"]["credentialId"] = credential_id
    # The fallback transcriber gets the same terms as the main one.
    for fallback in get_path(payload, "transcriber.fallbackPlan.transcribers") or []:
        if fallback.get("customVocabulary") == KEYTERMS_PLACEHOLDER:
            fallback["customVocabulary"] = get_path(payload, "transcriber.keytermsPrompt") or []
    return payload


# --------------------------------------------------------------------------- verify

_MISSING = object()


def diff(expected, actual, path: str = "") -> list[str]:
    """Subset comparison: everything we sent must be stored identically."""
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return [f"{path}: erwartet Objekt, gespeichert {actual!r}"]
        out: list[str] = []
        for key, value in expected.items():
            out += diff(value, actual.get(key, _MISSING), f"{path}.{key}" if path else key)
        return out
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            return [f"{path}: erwartet {expected!r}, gespeichert {actual!r}"]
        out = []
        for i, (e, a) in enumerate(zip(expected, actual)):
            out += diff(e, a, f"{path}[{i}]")
        return out
    if expected is None:  # null in assistant.json removes the field
        return [] if actual is None or actual is _MISSING else [f"{path}: erwartet entfernt, gespeichert {actual!r}"]
    if actual is _MISSING:
        return [f"{path}: fehlt (erwartet {expected!r})"]
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)) \
            and not isinstance(expected, bool):
        return [] if abs(expected - actual) < 1e-9 else [f"{path}: erwartet {expected}, gespeichert {actual}"]
    return [] if expected == actual else [f"{path}: erwartet {expected!r}, gespeichert {actual!r}"]


def get_path(obj, dotted: str):
    for part in dotted.split("."):
        if isinstance(obj, dict):
            obj = obj.get(part)
        else:
            return None
    return obj


def print_summary(stored: dict) -> None:
    voice = stored.get("voice", {})
    trans = stored.get("transcriber", {})
    model = stored.get("model", {})
    analysis = stored.get("analysisPlan", {})
    prompt = (model.get("messages") or [{}])[0].get("content", "")
    fallback_voices = [f"{v.get('provider')}/{v.get('voiceId')}"
                       for v in (voice.get("fallbackPlan") or {}).get("voices", [])]
    rows = [
        ("Assistant", f"{stored.get('name')} ({stored.get('id')})"),
        ("Model", f"{model.get('provider')}/{model.get('model')} temp={model.get('temperature')} "
                  f"maxTokens={model.get('maxTokens')} tools={[t.get('type') for t in model.get('tools', [])]}"),
        ("Prompt", f"{len(prompt)} Zeichen"),
        ("Voice", f"{voice.get('provider')}/{voice.get('model')} voiceId={voice.get('voiceId')} "
                  f"fallback={fallback_voices}"),
        ("Transcriber", f"{trans.get('provider')}/{trans.get('model') or trans.get('speechModel')} "
                        f"languages={trans.get('languages') or trans.get('languageCodes')} "
                        f"keyterms={len(trans.get('keyterm') or trans.get('keytermsPrompt') or [])}"),
        ("Server", f"{get_path(stored, 'server.url')} credentialId={get_path(stored, 'server.credentialId')}"),
        ("serverMessages", stored.get("serverMessages")),
        ("maxDurationSeconds", stored.get("maxDurationSeconds")),
        ("waitSeconds", get_path(stored, "startSpeakingPlan.waitSeconds")),
        ("Hooks", [h.get("name") for h in stored.get("hooks", [])]),
        ("Aufnahme", f"recordingEnabled={get_path(stored, 'artifactPlan.recordingEnabled')} "
                     f"format={get_path(stored, 'artifactPlan.recordingFormat')}"),
        ("Vapi-Analyse", "summary={} structuredData={} successEvaluation={}".format(
            get_path(analysis, "summaryPlan.enabled"),
            get_path(analysis, "structuredDataPlan.enabled"),
            get_path(analysis, "successEvaluationPlan.enabled"))),
    ]
    width = max(len(k) for k, _ in rows)
    for key, value in rows:
        say(f"  {key.ljust(width)}  {value}")


def verify(api_key: str, assistant_id: str, payload: dict) -> bool:
    stored = api("GET", f"/assistant/{assistant_id}", api_key)
    say("\nGespeicherte Konfiguration:")
    print_summary(stored)
    problems = diff(payload, stored)
    if problems:
        say(f"\nWARNUNG: {len(problems)} Abweichung(en) zwischen assistant.json und Vapi:")
        for p in problems:
            say("  -", p)
        return False
    say("\nOK: Gespeicherte Konfiguration entspricht vollständig assistant.json + system-prompt.md.")
    return True


# --------------------------------------------------------------------------- main


def ensure_credential(env: dict[str, str], api_key: str, new_ids: dict[str, str]) -> str:
    cred_id = env.get("VAPI_CREDENTIAL_ID")
    if cred_id:
        say("Credential vorhanden (aus .env):", cred_id)
        return cred_id
    secret = env.get("WEBHOOK_SECRET")
    if not secret:
        fail("WEBHOOK_SECRET fehlt in .env.")
    body = {
        "provider": "custom-credential",
        "name": CREDENTIAL_NAME,
        "authenticationPlan": {
            "type": "bearer",
            "token": secret,
            "headerName": SECRET_HEADER,
            "bearerPrefixEnabled": False,
        },
    }
    created = api("POST", "/credential", api_key, body)
    cred_id = created.get("id")
    if not cred_id:
        fail("Credential angelegt, aber keine ID in der Antwort.")
    say(f"Credential angelegt: {cred_id} (Header {SECRET_HEADER}, ohne Bearer-Präfix)")
    new_ids["VAPI_CREDENTIAL_ID"] = cred_id
    return cred_id


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    argv = sys.argv[1:]
    args = set(argv)
    job_name = DEFAULT_JOB
    if "--job" in argv:
        index = argv.index("--job")
        if index + 1 >= len(argv):
            fail("--job braucht den Namen einer Datei in vapi/jobs/, z. B. --job cyber-security.")
        job_name = argv[index + 1]
    job = load_job(job_name)
    id_env = job["_assistantIdEnv"]
    say(f"Stelle: {job_name} ({id_env})")

    env = load_env()
    api_key = env.get("VAPI_API_KEY")
    if not api_key:
        fail("VAPI_API_KEY fehlt in .env.")

    if "--dry-run" in args:
        payload = build_payload(job, env.get("VAPI_CREDENTIAL_ID", CREDENTIAL_PLACEHOLDER))
        say("Dry run – keine API-Aufrufe. Payload-Zusammenfassung:")
        print_summary({**payload, "id": env.get(id_env, "(neu)")})
        say(f"  Payload-Größe: {len(json.dumps(payload))} Bytes")
        return

    assistant_id = env.get(id_env)
    if "--discard-draft" in args:
        if not assistant_id:
            fail(f"{id_env} fehlt in .env.")
        discard_drafts(api_key, assistant_id)
        return

    live_prompt = ""
    if assistant_id and "--reset-sections" not in args:
        live_prompt = live_system_prompt(api_key, assistant_id)
        say("Abschnitte „Stelle“ und „Leitfaden“ werden aus dem Live-Assistant übernommen (Google-Sheets-Sync).")

    if "--verify" in args:
        if not assistant_id:
            fail(f"{id_env} fehlt in .env.")
        payload = build_payload(job, env.get("VAPI_CREDENTIAL_ID", CREDENTIAL_PLACEHOLDER), live_prompt)
        sys.exit(0 if verify(api_key, assistant_id, payload) else 2)

    new_ids: dict[str, str] = {}
    try:
        cred_id = ensure_credential(env, api_key, new_ids)
        payload = build_payload(job, cred_id, live_prompt)
        if assistant_id:
            api("PATCH", f"/assistant/{assistant_id}", api_key, payload)
            say("Assistant aktualisiert (PATCH):", assistant_id)
        else:
            created = api("POST", "/assistant", api_key, payload)
            assistant_id = created.get("id")
            if not assistant_id:
                fail("Assistant angelegt, aber keine ID in der Antwort.")
            say("Assistant angelegt (POST):", assistant_id)
            new_ids[id_env] = assistant_id
    finally:
        # Persist whatever was created, even if a later step failed.
        append_env(new_ids)

    ok = verify(api_key, assistant_id, payload)
    say("\nDashboard: https://dashboard.vapi.ai/assistants/" + assistant_id)
    sys.exit(0 if ok else 2)


if __name__ == "__main__":
    main()
