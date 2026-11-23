import { useState, type ReactNode } from 'react';

export function verschieben<T>(liste: T[], i: number, richtung: -1 | 1): T[] {
  const j = i + richtung;
  if (j < 0 || j >= liste.length) return liste;
  const neu = [...liste];
  [neu[i], neu[j]] = [neu[j], neu[i]];
  return neu;
}

export function Feld({ label, hilfe, children }: { label: string; hilfe?: ReactNode; children: ReactNode }) {
  return (
    <label className="feld">
      <span className="feld-label">{label}</span>
      {children}
      {hilfe && <span className="hilfe">{hilfe}</span>}
    </label>
  );
}

const Pfeil = ({ runter }: { runter?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={runter ? { transform: 'rotate(180deg)' } : undefined}>
    <path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Hoch/Runter-Knöpfe am Zeilenende, nur bei Hover oder Fokus sichtbar.
export function Reihenfolge({ i, anzahl, onSchieben }: { i: number; anzahl: number; onSchieben: (richtung: -1 | 1) => void }) {
  return (
    <div className="reihenfolge">
      <button title="Nach oben" aria-label="Nach oben" disabled={i === 0} onClick={() => onSchieben(-1)}>
        <Pfeil />
      </button>
      <button title="Nach unten" aria-label="Nach unten" disabled={i === anzahl - 1} onClick={() => onSchieben(1)}>
        <Pfeil runter />
      </button>
    </div>
  );
}

// Zweistufig: erster Klick fragt nach, zweiter löscht.
export function LoeschenKnopf({ frage = 'Wirklich löschen?', onLoeschen }: { frage?: string; onLoeschen: () => void }) {
  const [sicher, setSicher] = useState(false);
  return (
    <button className="text-knopf gefahr links" onClick={() => (sicher ? onLoeschen() : setSicher(true))} onBlur={() => setSicher(false)}>
      {sicher ? frage : 'Löschen'}
    </button>
  );
}
