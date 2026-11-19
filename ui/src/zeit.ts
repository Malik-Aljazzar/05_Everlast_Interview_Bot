import { useEffect, useState } from 'react';

/** Aktuelle Zeit, die sich jede Sekunde aktualisiert (für laufende Anrufe). */
export function useJetzt(aktiv: boolean): number {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (!aktiv) return;
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, [aktiv]);
  return jetzt;
}

export function dauer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function datum(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
