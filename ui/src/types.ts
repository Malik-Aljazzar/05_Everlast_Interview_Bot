export type Status = 'laeuft' | 'beendet' | 'wird_erstellt' | 'fertig' | 'fehler';

export interface Bewertung {
  name: string;
  gewicht: number;
  min: number;
  max: number;
  score: number | null;
  begruendung: string;
  zitat: string;
}

export interface ProtokollDetails {
  name: string;
  stelle: string;
  datum: string;
  dauerMin: number;
  gespraechsende: string;
  status: string;
  empfehlung: 'Einladen' | 'Prüfen' | 'Absage';
  gesamtscore: number | null;
  regeln: string[];
  zusammenfassung: string;
  einschaetzung: string;
  bewertungen: Bewertung[];
  staerken: string[];
  schwaechen: string[];
  eckdaten: { gehaltsvorstellung?: string; verfuegbarkeit?: string; startdatum?: string };
  offenePunkte: string[];
}

export interface Protokoll {
  id: number;
  callId: string;
  assistantId: string;
  stelle: string | null;
  status: Status;
  startedAt: string | null;
  endedAt: string | null;
  name: string | null;
  empfehlung: string | null;
  gesamtscore: number | null;
  protokoll: ProtokollDetails | null;
  transkript: string | null;
  aufnahmeUrl: string | null;
  fehler: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Kriterium {
  kriterium: string;
  gewicht: number | null;
  beschreibung: string;
  score1: string;
  score2: string;
  score3: string;
  score4: string;
  score5: string;
}

export interface Frage {
  thema: string;
  frage: string;
  kriterium: string;
  hinweis: string;
}

export interface Stelle {
  assistantId: string;
  stelle: string;
  unternehmen: string;
  // Aufgaben und Anforderungen in einem Feld, eine Angabe pro Zeile.
  beschreibung: string;
  einladenAb: number | null;
  absageUnter: number | null;
  kriterien: Kriterium[];
  leitfaden: Frage[];
}
