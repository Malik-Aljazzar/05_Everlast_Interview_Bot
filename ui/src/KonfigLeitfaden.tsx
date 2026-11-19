import { useState } from 'react';
import Dialog from './Dialog';
import { Feld, LoeschenKnopf, Reihenfolge, verschieben } from './Bausteine';
import type { Frage, Stelle } from './types';

const leereFrage = (): Frage => ({ thema: '', frage: '', kriterium: '', hinweis: '' });

export default function Leitfaden({ entwurf, setze }: { entwurf: Stelle; setze: (teil: Partial<Stelle>) => void }) {
  const [offen, setOffen] = useState<number | 'neu' | null>(null);
  const { leitfaden } = entwurf;
  const index = typeof offen === 'number' ? offen : -1;
  const kriterien = entwurf.kriterien.map((k) => k.kriterium).filter((k) => k.trim());

  const uebernehmen = (f: Frage) => {
    setze({ leitfaden: index < 0 ? [...leitfaden, f] : leitfaden.map((x, j) => (j === index ? f : x)) });
    setOffen(null);
  };

  return (
    <>
      <section className="flaeche">
        <div className="flaeche-kopf">
          <div>
            <h2>Leitfaden</h2>
            <p className="leise">Der Agent stellt die Fragen in dieser Reihenfolge, eine pro Redebeitrag.</p>
          </div>
          <button className="knopf zweit" onClick={() => setOffen('neu')}>
            + Frage
          </button>
        </div>
        <ol className="zeilen">
          {leitfaden.map((f, i) => (
            <li className="zeile" key={i}>
              <span className="nr">{i + 1}</span>
              <button className="zeile-haupt" onClick={() => setOffen(i)}>
                <span className="zeile-titel">{f.thema || `Frage ${i + 1}`}</span>
                <span className="zeile-text">„{f.frage}“</span>
                {(f.kriterium || f.hinweis) && (
                  <span className="chips">
                    {f.kriterium && <span className="chip">{f.kriterium}</span>}
                    {f.hinweis && <span className="chip grau">mit Hinweis</span>}
                  </span>
                )}
              </button>
              <Reihenfolge i={i} anzahl={leitfaden.length} onSchieben={(r) => setze({ leitfaden: verschieben(leitfaden, i, r) })} />
            </li>
          ))}
          <li className="zeile abschluss">
            <span className="nr">✓</span>
            <span>Abschluss: nächste Schritte nennen und verabschieden (automatisch)</span>
          </li>
        </ol>
      </section>

      {offen !== null && (
        <FrageDialog
          start={index < 0 ? leereFrage() : leitfaden[index]}
          neu={index < 0}
          kriterien={kriterien}
          onUebernehmen={uebernehmen}
          onLoeschen={() => {
            setze({ leitfaden: leitfaden.filter((_, j) => j !== index) });
            setOffen(null);
          }}
          onSchliessen={() => setOffen(null)}
        />
      )}
    </>
  );
}

function FrageDialog({
  start,
  neu,
  kriterien,
  onUebernehmen,
  onLoeschen,
  onSchliessen,
}: {
  start: Frage;
  neu: boolean;
  kriterien: string[];
  onUebernehmen: (f: Frage) => void;
  onLoeschen: () => void;
  onSchliessen: () => void;
}) {
  const [f, setF] = useState(start);
  const setze = (teil: Partial<Frage>) => setF({ ...f, ...teil });

  return (
    <Dialog
      titel={neu ? 'Neue Frage' : 'Frage bearbeiten'}
      breit
      onSchliessen={onSchliessen}
      fuss={
        <>
          {!neu && <LoeschenKnopf onLoeschen={onLoeschen} />}
          <button className="knopf zweit" onClick={onSchliessen}>
            Abbrechen
          </button>
          <button className="knopf" disabled={!f.frage.trim()} onClick={() => onUebernehmen({ ...f, thema: f.thema.trim(), frage: f.frage.trim() })}>
            {neu ? 'Hinzufügen' : 'Übernehmen'}
          </button>
        </>
      }
    >
      <div className="zwei">
        <Feld label="Thema">
          <input value={f.thema} placeholder="z. B. Motivation" onChange={(e) => setze({ thema: e.target.value })} />
        </Feld>
        <Feld label="Zählt für Kriterium">
          <select value={f.kriterium} onChange={(e) => setze({ kriterium: e.target.value })}>
            <option value="">Keines</option>
            {kriterien.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Feld>
      </div>
      <Feld label="Frage" hilfe="Der Agent stellt sie sinngemäß so, damit alle Bewerber dieselbe Kernfrage bekommen.">
        <textarea rows={3} value={f.frage} onChange={(e) => setze({ frage: e.target.value })} />
      </Feld>
      <Feld label="Hinweis für den Agent" hilfe="Optional, zum Beispiel wann er einmal nachfragen soll.">
        <textarea rows={3} value={f.hinweis} onChange={(e) => setze({ hinweis: e.target.value })} />
      </Feld>
    </Dialog>
  );
}
