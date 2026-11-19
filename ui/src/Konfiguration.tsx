import { useEffect, useMemo, useState } from 'react';
import { speichereStelle } from './api';
import type { Frage, Kriterium, Stelle } from './types';

const leeresKriterium = (): Kriterium => ({ kriterium: '', gewicht: null, beschreibung: '', score1: '', score2: '', score3: '', score4: '', score5: '' });
const leereFrage = (): Frage => ({ thema: '', frage: '', kriterium: '', hinweis: '' });
const STUFEN = ['score1', 'score2', 'score3', 'score4', 'score5'] as const;

function verschieben<T>(liste: T[], i: number, richtung: -1 | 1): T[] {
  const j = i + richtung;
  if (j < 0 || j >= liste.length) return liste;
  const neu = [...liste];
  [neu[i], neu[j]] = [neu[j], neu[i]];
  return neu;
}

export default function Konfiguration({ stellen, onGespeichert }: { stellen: Stelle[]; onGespeichert: () => Promise<void> }) {
  const [auswahl, setAuswahl] = useState<string>('');
  const [entwurf, setEntwurf] = useState<Stelle | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);

  const original = useMemo(() => stellen.find((s) => s.assistantId === auswahl) ?? null, [stellen, auswahl]);

  useEffect(() => {
    if (!auswahl && stellen.length) setAuswahl(stellen[0].assistantId);
  }, [stellen, auswahl]);

  useEffect(() => {
    setEntwurf(original ? structuredClone(original) : null);
  }, [original]);

  const geaendert = useMemo(() => JSON.stringify(entwurf) !== JSON.stringify(original), [entwurf, original]);

  if (!stellen.length) return <div className="leer">Lade Konfiguration …</div>;
  if (!entwurf) return null;

  const setze = (teil: Partial<Stelle>) => setEntwurf({ ...entwurf, ...teil });
  const setzeKriterium = (i: number, teil: Partial<Kriterium>) =>
    setze({ kriterien: entwurf.kriterien.map((k, j) => (j === i ? { ...k, ...teil } : k)) });
  const setzeFrage = (i: number, teil: Partial<Frage>) => setze({ leitfaden: entwurf.leitfaden.map((f, j) => (j === i ? { ...f, ...teil } : f)) });

  // Leere Gewichte zählen wie der Durchschnitt der übrigen (gleiche Regel wie in der Auswertung).
  const eingetragen = entwurf.kriterien.map((k) => k.gewicht).filter((g): g is number => typeof g === 'number' && g > 0);
  const standard = eingetragen.length ? eingetragen.reduce((a, b) => a + b, 0) / eingetragen.length : 1;
  const gewichte = entwurf.kriterien.map((k) => (typeof k.gewicht === 'number' && k.gewicht > 0 ? k.gewicht : standard));
  const summe = gewichte.reduce((a, b) => a + b, 0) || 1;

  const speichern = async () => {
    setSpeichert(true);
    setMeldung(null);
    try {
      const r = await speichereStelle(entwurf);
      await onGespeichert();
      setMeldung(
        r.sync === 'ok'
          ? { art: 'ok', text: `Gespeichert: ${r.kriterien} Kriterien, ${r.fragen} Fragen. Der Agent nutzt den neuen Leitfaden ab dem nächsten Anruf.` }
          : { art: 'fehler', text: `Gespeichert, aber die Übertragung an Vapi ist fehlgeschlagen: ${r.syncFehler}` },
      );
    } catch (e) {
      setMeldung({ art: 'fehler', text: (e as Error).message });
    } finally {
      setSpeichert(false);
    }
  };

  return (
    <section className="konfig">
      <div className="abschnitt-kopf">
        <h1>Konfiguration</h1>
        <select value={auswahl} onChange={(e) => setAuswahl(e.target.value)} disabled={geaendert}>
          {stellen.map((s) => (
            <option key={s.assistantId} value={s.assistantId}>
              {s.stelle}
            </option>
          ))}
        </select>
      </div>

      <div className="panel">
        <h2>Stelle</h2>
        <div className="feld">
          <label>Bezeichnung</label>
          <input value={entwurf.stelle} onChange={(e) => setze({ stelle: e.target.value })} />
        </div>
        <div className="feld">
          <label>Unternehmen</label>
          <textarea rows={2} value={entwurf.unternehmen} onChange={(e) => setze({ unternehmen: e.target.value })} />
        </div>
        <div className="spalten">
          <div className="feld">
            <label>Aufgaben (eine pro Zeile)</label>
            <textarea rows={8} value={entwurf.aufgaben} onChange={(e) => setze({ aufgaben: e.target.value })} />
          </div>
          <div className="feld">
            <label>Anforderungen (eine pro Zeile)</label>
            <textarea rows={8} value={entwurf.anforderungen} onChange={(e) => setze({ anforderungen: e.target.value })} />
          </div>
        </div>
        <div className="spalten drei">
          <div className="feld">
            <label>Einladen ab (%)</label>
            <input type="number" min={0} max={100} value={entwurf.einladenAb ?? ''} onChange={(e) => setze({ einladenAb: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div className="feld">
            <label>Absage unter (%)</label>
            <input type="number" min={0} max={100} value={entwurf.absageUnter ?? ''} onChange={(e) => setze({ absageUnter: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div className="feld">
            <label>Vapi-Assistant</label>
            <input value={entwurf.assistantId} readOnly className="leise" />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-kopf">
          <h2>Bewertungskriterien</h2>
          <button className="knopf zweit" onClick={() => setze({ kriterien: [...entwurf.kriterien, leeresKriterium()] })}>
            + Kriterium
          </button>
        </div>
        {entwurf.kriterien.map((k, i) => (
          <div className="eintrag" key={i}>
            <div className="eintrag-kopf">
              <span className="nummer">{i + 1}</span>
              <input className="eintrag-titel" placeholder="Name des Kriteriums" value={k.kriterium} onChange={(e) => setzeKriterium(i, { kriterium: e.target.value })} />
              <label className="gewicht">
                Gewicht
                <input type="number" min={0} value={k.gewicht ?? ''} onChange={(e) => setzeKriterium(i, { gewicht: e.target.value === '' ? null : Number(e.target.value) })} />
                <span className="leise">= {Math.round((gewichte[i] / summe) * 100)} %</span>
              </label>
              <Werkzeuge
                hoch={() => setze({ kriterien: verschieben(entwurf.kriterien, i, -1) })}
                runter={() => setze({ kriterien: verschieben(entwurf.kriterien, i, 1) })}
                weg={() => setze({ kriterien: entwurf.kriterien.filter((_, j) => j !== i) })}
              />
            </div>
            <div className="feld">
              <label>Was wird bewertet</label>
              <textarea rows={2} value={k.beschreibung} onChange={(e) => setzeKriterium(i, { beschreibung: e.target.value })} />
            </div>
            <div className="stufen">
              {STUFEN.map((s, n) => (
                <div className="feld" key={s}>
                  <label>Stufe {n + 1}</label>
                  <textarea rows={6} value={k[s]} placeholder="leer = Standardtext" onChange={(e) => setzeKriterium(i, { [s]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-kopf">
          <h2>Leitfaden</h2>
          <button className="knopf zweit" onClick={() => setze({ leitfaden: [...entwurf.leitfaden, leereFrage()] })}>
            + Frage
          </button>
        </div>
        <p className="leise">Der Agent stellt die Fragen in dieser Reihenfolge. Danach folgt automatisch der Abschluss.</p>
        {entwurf.leitfaden.map((f, i) => (
          <div className="eintrag" key={i}>
            <div className="eintrag-kopf">
              <span className="nummer">{i + 1}</span>
              <input className="eintrag-titel" placeholder="Thema" value={f.thema} onChange={(e) => setzeFrage(i, { thema: e.target.value })} />
              <select value={f.kriterium} onChange={(e) => setzeFrage(i, { kriterium: e.target.value })}>
                <option value="">kein Kriterium</option>
                {entwurf.kriterien
                  .filter((k) => k.kriterium.trim())
                  .map((k) => (
                    <option key={k.kriterium} value={k.kriterium}>
                      {k.kriterium}
                    </option>
                  ))}
              </select>
              <Werkzeuge
                hoch={() => setze({ leitfaden: verschieben(entwurf.leitfaden, i, -1) })}
                runter={() => setze({ leitfaden: verschieben(entwurf.leitfaden, i, 1) })}
                weg={() => setze({ leitfaden: entwurf.leitfaden.filter((_, j) => j !== i) })}
              />
            </div>
            <div className="spalten">
              <div className="feld">
                <label>Frage</label>
                <textarea rows={2} value={f.frage} onChange={(e) => setzeFrage(i, { frage: e.target.value })} />
              </div>
              <div className="feld">
                <label>Hinweis für den Agent</label>
                <textarea rows={2} value={f.hinweis} onChange={(e) => setzeFrage(i, { hinweis: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="leiste">
        {meldung && <div className={`hinweis ${meldung.art}`}>{meldung.text}</div>}
        <div className="leiste-knoepfe">
          <span className="leise">{geaendert ? 'Ungespeicherte Änderungen' : 'Alles gespeichert'}</span>
          <button className="knopf zweit" disabled={!geaendert || speichert} onClick={() => setEntwurf(original ? structuredClone(original) : null)}>
            Verwerfen
          </button>
          <button className="knopf" disabled={!geaendert || speichert} onClick={speichern}>
            {speichert ? 'Speichert …' : 'Speichern und an Vapi übertragen'}
          </button>
        </div>
      </div>
    </section>
  );
}

function Werkzeuge({ hoch, runter, weg }: { hoch: () => void; runter: () => void; weg: () => void }) {
  return (
    <div className="werkzeuge">
      <button title="Nach oben" onClick={hoch}>
        ↑
      </button>
      <button title="Nach unten" onClick={runter}>
        ↓
      </button>
      <button title="Entfernen" className="weg" onClick={weg}>
        ✕
      </button>
    </div>
  );
}
