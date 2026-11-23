import { useState } from 'react';
import Dialog from './Dialog';
import { Feld } from './Bausteine';
import type { Stelle } from './types';

// Gleiche Trennung wie im Sync-Workflow: eine Angabe pro Zeile (oder mit Semikolon getrennt).
const punkte = (text: string) =>
  String(text ?? '')
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);

type Angaben = Pick<Stelle, 'stelle' | 'unternehmen' | 'beschreibung'>;

export default function StelleAnsicht({ entwurf, setze }: { entwurf: Stelle; setze: (teil: Partial<Stelle>) => void }) {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <section className="flaeche">
        <div className="flaeche-kopf">
          <div className="fakt">
            <h3>Unternehmen</h3>
            {entwurf.unternehmen ? <p>{entwurf.unternehmen}</p> : <p className="leer-text">Nicht eingetragen</p>}
          </div>
          <button className="knopf zweit" onClick={() => setOffen(true)}>
            Bearbeiten
          </button>
        </div>
        <Punkte titel="Aufgaben und Anforderungen" eintraege={punkte(entwurf.beschreibung)} />
      </section>
      {offen && (
        <StelleDialog
          start={{ stelle: entwurf.stelle, unternehmen: entwurf.unternehmen, beschreibung: entwurf.beschreibung }}
          onUebernehmen={(a) => {
            setze(a);
            setOffen(false);
          }}
          onSchliessen={() => setOffen(false)}
        />
      )}
    </>
  );
}

function Punkte({ titel, eintraege }: { titel: string; eintraege: string[] }) {
  return (
    <div className="fakt">
      <h3>{titel}</h3>
      {eintraege.length ? (
        <ul className="punkte punkte-spalten">
          {eintraege.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : (
        <p className="leer-text">Noch nichts eingetragen</p>
      )}
    </div>
  );
}

function StelleDialog({ start, onUebernehmen, onSchliessen }: { start: Angaben; onUebernehmen: (a: Angaben) => void; onSchliessen: () => void }) {
  const [a, setA] = useState(start);
  const setze = (teil: Partial<Angaben>) => setA({ ...a, ...teil });

  return (
    <Dialog
      titel="Stelle bearbeiten"
      breit
      onSchliessen={onSchliessen}
      fuss={
        <>
          <button className="knopf zweit" onClick={onSchliessen}>
            Abbrechen
          </button>
          <button className="knopf" disabled={!a.stelle.trim()} onClick={() => onUebernehmen({ ...a, stelle: a.stelle.trim() })}>
            Übernehmen
          </button>
        </>
      }
    >
      <Feld label="Bezeichnung">
        <input value={a.stelle} onChange={(e) => setze({ stelle: e.target.value })} />
      </Feld>
      <Feld label="Unternehmen">
        <textarea rows={2} value={a.unternehmen} onChange={(e) => setze({ unternehmen: e.target.value })} />
      </Feld>
      <Feld label="Aufgaben und Anforderungen" hilfe="Eine Angabe pro Zeile">
        <textarea rows={12} value={a.beschreibung} onChange={(e) => setze({ beschreibung: e.target.value })} />
      </Feld>
    </Dialog>
  );
}
