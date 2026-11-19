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

type Angaben = Pick<Stelle, 'stelle' | 'unternehmen' | 'aufgaben' | 'anforderungen'>;

export default function StelleAnsicht({ entwurf, setze }: { entwurf: Stelle; setze: (teil: Partial<Stelle>) => void }) {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <section className="flaeche">
        <div className="flaeche-kopf">
          <div>
            <h2>Was der Agent über die Stelle weiß</h2>
            <p className="leise">Fragen der Bewerber beantwortet er nur mit diesen Angaben, alles andere verweist er an HR.</p>
          </div>
          <button className="knopf zweit" onClick={() => setOffen(true)}>
            Bearbeiten
          </button>
        </div>
        <div className="fakt">
          <h3>Unternehmen</h3>
          {entwurf.unternehmen ? <p>{entwurf.unternehmen}</p> : <p className="leer-text">Nicht eingetragen</p>}
        </div>
        <div className="zwei">
          <Punkte titel="Aufgaben" eintraege={punkte(entwurf.aufgaben)} />
          <Punkte titel="Anforderungen" eintraege={punkte(entwurf.anforderungen)} />
        </div>
      </section>
      {offen && (
        <StelleDialog
          start={{ stelle: entwurf.stelle, unternehmen: entwurf.unternehmen, aufgaben: entwurf.aufgaben, anforderungen: entwurf.anforderungen }}
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
        <ul className="punkte">
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
      <div className="zwei">
        <Feld label="Aufgaben" hilfe="Eine pro Zeile">
          <textarea rows={8} value={a.aufgaben} onChange={(e) => setze({ aufgaben: e.target.value })} />
        </Feld>
        <Feld label="Anforderungen" hilfe="Eine pro Zeile">
          <textarea rows={8} value={a.anforderungen} onChange={(e) => setze({ anforderungen: e.target.value })} />
        </Feld>
      </div>
    </Dialog>
  );
}
