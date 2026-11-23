import type { Protokoll, Stelle } from './types';

// Alle Aufrufe gehen an /api; nginx im Container (bzw. der Vite-Dev-Server) leitet sie an die n8n-Webhooks /webhook/ui weiter.
async function anfrage<T>(pfad: string, init?: RequestInit): Promise<T> {
  const antwort = await fetch('/api' + pfad, { headers: { 'Content-Type': 'application/json' }, ...init });
  const text = await antwort.text();
  const daten = text ? JSON.parse(text) : {};
  if (!antwort.ok) throw new Error(daten.fehler ?? `Fehler ${antwort.status}`);
  return daten as T;
}

export const ladeProtokolle = () => anfrage<{ protokolle: Protokoll[] }>('/protokolle').then((d) => d.protokolle);

export const ladeConfig = () => anfrage<{ stellen: Stelle[] }>('/config').then((d) => d.stellen);

export interface SpeichernAntwort {
  ok: boolean;
  kriterien: number;
  fragen: number;
  sync: 'ok' | 'fehler';
  syncFehler: string | null;
}

export const speichereStelle = (stelle: Stelle) =>
  anfrage<SpeichernAntwort>('/config', {
    method: 'POST',
    body: JSON.stringify({
      assistantId: stelle.assistantId,
      stelle: {
        stelle: stelle.stelle,
        unternehmen: stelle.unternehmen,
        beschreibung: stelle.beschreibung,
        einladenAb: stelle.einladenAb,
        absageUnter: stelle.absageUnter,
      },
      kriterien: stelle.kriterien,
      leitfaden: stelle.leitfaden,
    }),
  });

export interface AnlegenAntwort {
  ok: boolean;
  assistantId: string;
  name: string;
  sync: 'ok' | 'fehler';
  syncFehler: string | null;
}

// Legt in Vapi einen neuen Assistant als Kopie der Vorlage an und übernimmt deren Kriterien und Leitfaden.
export const legeStelleAn = (stelle: string, vorlage: string) =>
  anfrage<AnlegenAntwort>('/stelle', { method: 'POST', body: JSON.stringify({ stelle, vorlage }) });

// Löscht den Vapi-Assistant und die Zeilen der Stelle; Protokolle bleiben.
export const loescheStelle = (assistantId: string) =>
  anfrage<{ ok: boolean }>('/stelle?assistantId=' + encodeURIComponent(assistantId), { method: 'DELETE' });
