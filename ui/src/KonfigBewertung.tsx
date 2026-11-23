import { useState } from 'react';
import Dialog from './Dialog';
import { Feld, LoeschenKnopf, Reihenfolge, verschieben } from './Bausteine';
import type { Kriterium, Stelle } from './types';

const STUFEN = ['score1', 'score2', 'score3', 'score4', 'score5'] as const;
const leeresKriterium = (): Kriterium => ({ kriterium: '', gewicht: null, beschreibung: '', score1: '', score2: '', score3: '', score4: '', score5: '' });

// Anteil jedes Kriteriums am Gesamtscore in Prozent. Leere Gewichte zählen wie der Durchschnitt der übrigen (gleiche Regel wie in der Auswertung).
export function anteile(gewichte: (number | null)[]): number[] {
  const eingetragen = gewichte.filter((g): g is number => typeof g === 'number' && g > 0);
  const standard = eingetragen.length ? eingetragen.reduce((a, b) => a + b, 0) / eingetragen.length : 1;
  const werte = gewichte.map((g) => (typeof g === 'number' && g > 0 ? g : standard));
  const summe = werte.reduce((a, b) => a + b, 0) || 1;
  return werte.map((w) => Math.round((w / summe) * 100));
}

export default function Bewertung({ entwurf, setze }: { entwurf: Stelle; setze: (teil: Partial<Stelle>) => void }) {
  const [offen, setOffen] = useState<number | 'neu' | null>(null);
  const [schwellenOffen, setSchwellenOffen] = useState(false);
  const { kriterien, leitfaden } = entwurf;
  const prozent = anteile(kriterien.map((k) => k.gewicht));
  const index = typeof offen === 'number' ? offen : -1;

  const uebernehmen = (k: Kriterium) => {
    if (index < 0) {
      setze({ kriterien: [...kriterien, k] });
    } else {
      // Beim Umbenennen ziehen die Verweise im Leitfaden mit.
      const alt = kriterien[index].kriterium;
      setze({
        kriterien: kriterien.map((x, j) => (j === index ? k : x)),
        leitfaden: alt && alt !== k.kriterium ? leitfaden.map((f) => (f.kriterium === alt ? { ...f, kriterium: k.kriterium } : f)) : leitfaden,
      });
    }
    setOffen(null);
  };

  const loeschen = () => {
    const name = kriterien[index].kriterium;
    setze({
      kriterien: kriterien.filter((_, j) => j !== index),
      leitfaden: leitfaden.map((f) => (f.kriterium === name ? { ...f, kriterium: '' } : f)),
    });
    setOffen(null);
  };

  return (
    <>
      <section className="flaeche">
        <div className="flaeche-kopf">
          <h2>Empfehlung</h2>
          <button className="knopf zweit" onClick={() => setSchwellenOffen(true)}>
            Bearbeiten
          </button>
        </div>
        <Skala absage={entwurf.absageUnter ?? 45} einladen={entwurf.einladenAb ?? 70} />
        <p className="leise fussnote">Schwere Red Flag oder unvollständiges Gespräch: höchstens „Prüfen“.</p>
      </section>

      <section className="flaeche">
        <div className="flaeche-kopf">
          <h2>Kriterien</h2>
          <button className="knopf zweit" onClick={() => setOffen('neu')}>
            + Kriterium
          </button>
        </div>
        {kriterien.length ? (
          <ol className="zeilen">
            {kriterien.map((k, i) => (
              <li className="zeile" key={i}>
                <button className="zeile-haupt" onClick={() => setOffen(i)}>
                  <span className="zeile-titel">{k.kriterium || 'Ohne Namen'}</span>
                  <span className="zeile-text">{k.beschreibung || 'Keine Beschreibung'}</span>
                </button>
                <div className="anteil" title="Anteil am Gesamtscore">
                  <div className="anteil-balken">
                    <span style={{ width: `${prozent[i]}%` }} />
                  </div>
                  <span className="anteil-zahl">{prozent[i]} %</span>
                </div>
                <Reihenfolge i={i} anzahl={kriterien.length} onSchieben={(r) => setze({ kriterien: verschieben(kriterien, i, r) })} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="leer-klein">Noch keine Kriterien. Ohne Kriterium kann Claude nichts bewerten.</p>
        )}
      </section>

      {offen !== null && (
        <KriteriumDialog
          start={index < 0 ? leeresKriterium() : kriterien[index]}
          neu={index < 0}
          andereGewichte={kriterien.filter((_, j) => j !== index).map((k) => k.gewicht)}
          vergebeneNamen={kriterien.filter((_, j) => j !== index).map((k) => k.kriterium.trim().toLowerCase())}
          fragen={index < 0 ? 0 : leitfaden.filter((f) => f.kriterium === kriterien[index].kriterium).length}
          onUebernehmen={uebernehmen}
          onLoeschen={loeschen}
          onSchliessen={() => setOffen(null)}
        />
      )}
      {schwellenOffen && (
        <SchwellenDialog
          einladenAb={entwurf.einladenAb ?? 70}
          absageUnter={entwurf.absageUnter ?? 45}
          onUebernehmen={(einladenAb, absageUnter) => {
            setze({ einladenAb, absageUnter });
            setSchwellenOffen(false);
          }}
          onSchliessen={() => setSchwellenOffen(false)}
        />
      )}
    </>
  );
}

function Skala({ absage, einladen }: { absage: number; einladen: number }) {
  const teile = [
    { name: 'Absage', text: `unter ${absage} %`, breite: absage, farbe: 'rot' },
    { name: 'Prüfen', text: einladen > absage ? `${absage} bis ${einladen - 1} %` : 'entfällt', breite: einladen - absage, farbe: 'gelb' },
    { name: 'Einladen', text: `ab ${einladen} %`, breite: 100 - einladen, farbe: 'gruen' },
  ];
  return (
    <div className="skala">
      <div className="skala-balken">
        {teile.map((t) => (
          <span key={t.name} className={t.farbe} style={{ flexGrow: Math.max(t.breite, 0) }} />
        ))}
      </div>
      <div className="skala-legende">
        {teile.map((t) => (
          <div key={t.name} style={{ flexGrow: Math.max(t.breite, 14) }}>
            <b className={t.farbe}>{t.name}</b>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SchwellenDialog({
  einladenAb,
  absageUnter,
  onUebernehmen,
  onSchliessen,
}: {
  einladenAb: number;
  absageUnter: number;
  onUebernehmen: (einladenAb: number, absageUnter: number) => void;
  onSchliessen: () => void;
}) {
  const [einladen, setEinladen] = useState(String(einladenAb));
  const [absage, setAbsage] = useState(String(absageUnter));
  const e = Number(einladen);
  const a = Number(absage);
  const gueltig = einladen !== '' && absage !== '' && a >= 0 && e <= 100 && a <= e;

  return (
    <Dialog
      titel="Schwellen für die Empfehlung"
      onSchliessen={onSchliessen}
      fuss={
        <>
          <button className="knopf zweit" onClick={onSchliessen}>
            Abbrechen
          </button>
          <button className="knopf" disabled={!gueltig} onClick={() => onUebernehmen(e, a)}>
            Übernehmen
          </button>
        </>
      }
    >
      <div className="zwei">
        <Feld label="Einladen ab (%)">
          <input type="number" min={0} max={100} value={einladen} onChange={(x) => setEinladen(x.target.value)} />
        </Feld>
        <Feld label="Absage unter (%)">
          <input type="number" min={0} max={100} value={absage} onChange={(x) => setAbsage(x.target.value)} />
        </Feld>
      </div>
      {gueltig ? <Skala absage={a} einladen={e} /> : <div className="hinweis fehler">„Absage unter“ muss zwischen 0 und „Einladen ab“ liegen, „Einladen ab“ höchstens bei 100.</div>}
    </Dialog>
  );
}

function KriteriumDialog({
  start,
  neu,
  andereGewichte,
  vergebeneNamen,
  fragen,
  onUebernehmen,
  onLoeschen,
  onSchliessen,
}: {
  start: Kriterium;
  neu: boolean;
  andereGewichte: (number | null)[];
  vergebeneNamen: string[];
  fragen: number;
  onUebernehmen: (k: Kriterium) => void;
  onLoeschen: () => void;
  onSchliessen: () => void;
}) {
  const [k, setK] = useState(start);
  const setze = (teil: Partial<Kriterium>) => setK({ ...k, ...teil });
  const name = k.kriterium.trim();
  const doppelt = vergebeneNamen.includes(name.toLowerCase());
  const anteil = anteile([...andereGewichte, k.gewicht]).at(-1);

  return (
    <Dialog
      titel={neu ? 'Neues Kriterium' : 'Kriterium bearbeiten'}
      breit
      onSchliessen={onSchliessen}
      fuss={
        <>
          {!neu && <LoeschenKnopf frage={fragen ? `Löschen? ${fragen} ${fragen === 1 ? 'Frage verliert' : 'Fragen verlieren'} die Zuordnung` : undefined} onLoeschen={onLoeschen} />}
          <button className="knopf zweit" onClick={onSchliessen}>
            Abbrechen
          </button>
          <button className="knopf" disabled={!name || doppelt} onClick={() => onUebernehmen({ ...k, kriterium: name })}>
            {neu ? 'Hinzufügen' : 'Übernehmen'}
          </button>
        </>
      }
    >
      <div className="name-gewicht">
        <Feld label="Name" hilfe={doppelt ? <span className="fehler-text">Diesen Namen gibt es schon.</span> : undefined}>
          <input value={k.kriterium} placeholder="z. B. Kommunikation" onChange={(e) => setze({ kriterium: e.target.value })} />
        </Feld>
        <Feld label="Gewicht" hilfe={`= ${anteil} % des Gesamtscores`}>
          <input type="number" min={0} value={k.gewicht ?? ''} onChange={(e) => setze({ gewicht: e.target.value === '' ? null : Number(e.target.value) })} />
        </Feld>
      </div>
      <Feld label="Was wird bewertet">
        <textarea rows={3} value={k.beschreibung} onChange={(e) => setze({ beschreibung: e.target.value })} />
      </Feld>
      <div className="feld">
        <span className="feld-label">Stufen</span>
        <span className="hilfe">Woran Claude die Stufe erkennt. Leer lassen für den Standardtext.</span>
        <div className="stufen">
          {STUFEN.map((s, n) => (
            <div className="stufe" key={s}>
              <span className="stufe-nr" aria-hidden="true">
                {n + 1}
              </span>
              <textarea rows={2} aria-label={`Stufe ${n + 1}`} value={k[s]} onChange={(e) => setze({ [s]: e.target.value })} />
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
