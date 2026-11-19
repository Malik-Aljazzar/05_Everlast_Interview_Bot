import { useEffect, useMemo, useState } from 'react';
import { legeStelleAn, loescheStelle, speichereStelle } from './api';
import type { Stelle } from './types';
import Dialog from './Dialog';
import { Feld } from './Bausteine';
import StelleAnsicht from './KonfigStelle';
import Bewertung from './KonfigBewertung';
import Leitfaden from './KonfigLeitfaden';

type Reiter = 'stelle' | 'bewertung' | 'leitfaden';
type Meldung = { art: 'ok' | 'fehler'; text: string };
type Offen = { art: 'neu' } | { art: 'loeschen' } | { art: 'verwerfen'; weiter: () => void } | null;

export default function Konfiguration({ stellen, geladen, onNeuLaden }: { stellen: Stelle[]; geladen: boolean; onNeuLaden: () => Promise<void> }) {
  const [auswahl, setAuswahl] = useState('');
  const [entwurf, setEntwurf] = useState<Stelle | null>(null);
  const [reiter, setReiter] = useState<Reiter>('stelle');
  const [speichert, setSpeichert] = useState(false);
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [offen, setOffen] = useState<Offen>(null);

  const original = useMemo(() => stellen.find((s) => s.assistantId === auswahl) ?? null, [stellen, auswahl]);
  const geaendert = useMemo(() => JSON.stringify(entwurf) !== JSON.stringify(original), [entwurf, original]);

  // Erste Stelle vorauswählen; nach dem Löschen auf eine verbleibende springen.
  useEffect(() => {
    if (stellen.length && !stellen.some((s) => s.assistantId === auswahl)) setAuswahl(stellen[0].assistantId);
  }, [stellen, auswahl]);

  useEffect(() => {
    setEntwurf(original ? structuredClone(original) : null);
  }, [original]);

  useEffect(() => {
    if (!geaendert) return;
    const warnen = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warnen);
    return () => window.removeEventListener('beforeunload', warnen);
  }, [geaendert]);

  useEffect(() => {
    if (meldung?.art !== 'ok') return;
    const t = setTimeout(() => setMeldung(null), 6000);
    return () => clearTimeout(t);
  }, [meldung]);

  if (!geladen) return <div className="leer">Lade Konfiguration …</div>;
  if (!stellen.length) return <div className="leer">Noch keine Stelle angelegt. Die erste Stelle entsteht mit python vapi/deploy.py --job &lt;stelle&gt;.</div>;
  if (!entwurf) return null;

  const setze = (teil: Partial<Stelle>) => {
    setEntwurf((e) => (e ? { ...e, ...teil } : e));
    if (meldung?.art === 'fehler') setMeldung(null);
  };
  const verwerfen = () => setEntwurf(original ? structuredClone(original) : null);
  // Ungespeicherte Änderungen gehen beim Wechsel verloren, deshalb vorher nachfragen.
  const mitVerwerfen = (weiter: () => void) => (geaendert ? setOffen({ art: 'verwerfen', weiter }) : weiter());

  const speichern = async () => {
    setSpeichert(true);
    setMeldung(null);
    try {
      const r = await speichereStelle(entwurf);
      await onNeuLaden();
      setMeldung(
        r.sync === 'ok'
          ? { art: 'ok', text: 'Gespeichert. Der Agent nutzt den neuen Stand ab dem nächsten Anruf.' }
          : { art: 'fehler', text: `Gespeichert, aber die Übertragung an Vapi ist fehlgeschlagen: ${r.syncFehler}` },
      );
    } catch (e) {
      setMeldung({ art: 'fehler', text: (e as Error).message });
    } finally {
      setSpeichert(false);
    }
  };

  const reiterListe: [Reiter, string, number | null][] = [
    ['stelle', 'Stelle', null],
    ['bewertung', 'Bewertung', entwurf.kriterien.length],
    ['leitfaden', 'Leitfaden', entwurf.leitfaden.length],
  ];

  return (
    <section className="konfig">
      <nav className="stellen" aria-label="Stellen">
        <p className="stellen-titel">Stellen</p>
        {stellen.map((s) => {
          const aktiv = s.assistantId === auswahl;
          const zeige = aktiv ? entwurf : s;
          return (
            <button
              key={s.assistantId}
              className={aktiv ? 'stelle-eintrag aktiv' : 'stelle-eintrag'}
              aria-current={aktiv}
              onClick={() => !aktiv && mitVerwerfen(() => setAuswahl(s.assistantId))}
            >
              <span className="stelle-name">
                {zeige.stelle || 'Ohne Bezeichnung'}
                {aktiv && geaendert && <span className="ungespeichert" title="Ungespeicherte Änderungen" />}
              </span>
              <span className="stelle-meta">
                {zeige.kriterien.length} Kriterien · {zeige.leitfaden.length} Fragen
              </span>
            </button>
          );
        })}
        <button className="stelle-neu" onClick={() => mitVerwerfen(() => setOffen({ art: 'neu' }))}>
          + Neue Stelle
        </button>
      </nav>

      <div className="stelle-bereich">
        <div className="stelle-kopf">
          <div>
            <h1>{entwurf.stelle || 'Ohne Bezeichnung'}</h1>
            <p className="assistant-id">
              Vapi-Assistant <code>{entwurf.assistantId}</code>
            </p>
          </div>
          <button className="text-knopf gefahr" onClick={() => setOffen({ art: 'loeschen' })}>
            Stelle löschen
          </button>
        </div>

        <div className="unterreiter" role="tablist">
          {reiterListe.map(([r, text, zahl]) => (
            <button key={r} role="tab" aria-selected={reiter === r} className={reiter === r ? 'aktiv' : ''} onClick={() => setReiter(r)}>
              {text}
              {zahl !== null && <span className="zahl">{zahl}</span>}
            </button>
          ))}
        </div>

        {reiter === 'stelle' && <StelleAnsicht entwurf={entwurf} setze={setze} />}
        {reiter === 'bewertung' && <Bewertung entwurf={entwurf} setze={setze} />}
        {reiter === 'leitfaden' && <Leitfaden entwurf={entwurf} setze={setze} />}
      </div>

      {(geaendert || meldung) && (
        <div className={`speicherleiste ${meldung?.art ?? ''}`} role="status">
          <span className="speicherleiste-text">{meldung ? meldung.text : 'Ungespeicherte Änderungen'}</span>
          {geaendert ? (
            <>
              <button className="knopf geist" disabled={speichert} onClick={verwerfen}>
                Verwerfen
              </button>
              <button className="knopf hell" disabled={speichert} onClick={speichern}>
                {speichert ? 'Speichert …' : 'Speichern'}
              </button>
            </>
          ) : (
            <button className="schliessen hell" aria-label="Meldung schließen" onClick={() => setMeldung(null)}>
              ✕
            </button>
          )}
        </div>
      )}

      {offen?.art === 'neu' && (
        <NeueStelleDialog
          stellen={stellen}
          vorauswahl={auswahl}
          onSchliessen={() => setOffen(null)}
          onAngelegt={async (id, syncOk) => {
            await onNeuLaden();
            setAuswahl(id);
            setReiter('stelle');
            setOffen(null);
            setMeldung(
              syncOk
                ? { art: 'ok', text: 'Stelle und Vapi-Assistant angelegt. Trag jetzt Aufgaben und Anforderungen ein.' }
                : { art: 'fehler', text: 'Assistant angelegt, aber der Leitfaden kam nicht in Vapi an. Speicher die Stelle einmal, dann wird er erneut übertragen.' },
            );
          }}
        />
      )}
      {offen?.art === 'loeschen' && (
        <LoeschenDialog
          stelle={original ?? entwurf}
          onSchliessen={() => setOffen(null)}
          onGeloescht={async () => {
            await onNeuLaden();
            setOffen(null);
            setMeldung({ art: 'ok', text: 'Stelle und Vapi-Assistant gelöscht.' });
          }}
        />
      )}
      {offen?.art === 'verwerfen' && (
        <Dialog
          titel="Änderungen verwerfen?"
          onSchliessen={() => setOffen(null)}
          fuss={
            <>
              <button className="knopf zweit" onClick={() => setOffen(null)}>
                Weiter bearbeiten
              </button>
              <button
                className="knopf gefahr"
                onClick={() => {
                  const weiter = offen.weiter;
                  verwerfen();
                  setOffen(null);
                  weiter();
                }}
              >
                Verwerfen
              </button>
            </>
          }
        >
          <p>Die ungespeicherten Änderungen an „{entwurf.stelle}“ gehen verloren.</p>
        </Dialog>
      )}
    </section>
  );
}

function NeueStelleDialog({
  stellen,
  vorauswahl,
  onAngelegt,
  onSchliessen,
}: {
  stellen: Stelle[];
  vorauswahl: string;
  onAngelegt: (assistantId: string, syncOk: boolean) => Promise<void>;
  onSchliessen: () => void;
}) {
  const [name, setName] = useState('');
  const [vorlage, setVorlage] = useState(vorauswahl);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const bereit = name.trim() !== '' && !laeuft;

  const anlegen = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      const r = await legeStelleAn(name.trim(), vorlage);
      await onAngelegt(r.assistantId, r.sync === 'ok');
    } catch (e) {
      setFehler((e as Error).message);
      setLaeuft(false);
    }
  };

  return (
    <Dialog
      titel="Neue Stelle"
      unter="Legt in Vapi einen eigenen Interview-Assistant an."
      gesperrt={laeuft}
      onSchliessen={onSchliessen}
      fuss={
        <>
          <button className="knopf zweit" disabled={laeuft} onClick={onSchliessen}>
            Abbrechen
          </button>
          <button className="knopf" disabled={!bereit} onClick={anlegen}>
            {laeuft ? 'Wird angelegt …' : 'Anlegen'}
          </button>
        </>
      }
    >
      <Feld label="Bezeichnung">
        <input
          value={name}
          placeholder="z. B. Werkstudent Marketing (m/w/d)"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && bereit && anlegen()}
        />
      </Feld>
      <Feld label="Vorlage" hilfe="Übernimmt Stimme, Gesprächsstil und Dauer sowie Kriterien und Leitfaden. Aufgaben und Anforderungen trägst du danach selbst ein.">
        <select value={vorlage} onChange={(e) => setVorlage(e.target.value)}>
          {stellen.map((s) => (
            <option key={s.assistantId} value={s.assistantId}>
              {s.stelle}
            </option>
          ))}
        </select>
      </Feld>
      {fehler && <div className="hinweis fehler">{fehler}</div>}
    </Dialog>
  );
}

function LoeschenDialog({ stelle, onGeloescht, onSchliessen }: { stelle: Stelle; onGeloescht: () => Promise<void>; onSchliessen: () => void }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const loeschen = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      await loescheStelle(stelle.assistantId);
      await onGeloescht();
    } catch (e) {
      setFehler((e as Error).message);
      setLaeuft(false);
    }
  };

  return (
    <Dialog
      titel="Stelle löschen?"
      gesperrt={laeuft}
      onSchliessen={onSchliessen}
      fuss={
        <>
          <button className="knopf zweit" disabled={laeuft} onClick={onSchliessen}>
            Abbrechen
          </button>
          <button className="knopf gefahr" disabled={laeuft} onClick={loeschen}>
            {laeuft ? 'Wird gelöscht …' : 'Endgültig löschen'}
          </button>
        </>
      }
    >
      <p>„{stelle.stelle}“ wird endgültig entfernt:</p>
      <ul className="punkte">
        <li>der Interview-Assistant in Vapi; Anrufe auf ihn funktionieren danach nicht mehr</li>
        <li>Angaben zur Stelle, Kriterien und Leitfaden</li>
      </ul>
      <p className="leise">Bereits geführte Protokolle bleiben erhalten.</p>
      {fehler && <div className="hinweis fehler">{fehler}</div>}
    </Dialog>
  );
}
