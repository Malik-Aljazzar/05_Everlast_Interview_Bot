import { useEffect, useState } from 'react';
import { ladeProtokolle } from './api';
import type { Protokoll, Stelle } from './types';
import { datum, dauer, useJetzt } from './zeit';

const ABFRAGE_MS = 3000;
// Länger als das sollte die Auswertung nie dauern; danach ist vermutlich etwas schiefgelaufen (#n8n-fehler).
const HAENGT_MS = 5 * 60 * 1000;

export default function Protokolle({ stellen }: { stellen: Stelle[] }) {
  const [protokolle, setProtokolle] = useState<Protokoll[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    const laden = () =>
      ladeProtokolle()
        .then((p) => {
          if (!aktiv) return;
          setProtokolle(p);
          setFehler(null);
        })
        .catch((e: Error) => aktiv && setFehler(e.message));
    laden();
    const t = setInterval(laden, ABFRAGE_MS);
    return () => {
      aktiv = false;
      clearInterval(t);
    };
  }, []);

  const stelleVon = (p: Protokoll) => p.stelle ?? stellen.find((s) => s.assistantId === p.assistantId)?.stelle ?? 'Unbekannte Stelle';

  if (!protokolle) return <div className="leer">{fehler ? `Protokolle konnten nicht geladen werden: ${fehler}` : 'Lade Protokolle …'}</div>;

  const laufend = protokolle.filter((p) => p.status !== 'fertig' && p.status !== 'fehler').length;

  return (
    <section>
      <div className="abschnitt-kopf">
        <h1>Protokolle</h1>
        <div className="abschnitt-info">
          {protokolle.length} {protokolle.length === 1 ? 'Gespräch' : 'Gespräche'}{laufend ? ` · ${laufend} in Bearbeitung` : ''} · aktualisiert alle {ABFRAGE_MS / 1000} s
        </div>
      </div>
      {fehler && <div className="hinweis fehler">Verbindung unterbrochen: {fehler}</div>}
      {protokolle.length === 0 && <div className="leer">Noch keine Gespräche. Sobald ein Anruf startet, erscheint er hier.</div>}
      <div className="liste">
        {protokolle.map((p) => (
          <ProtokollKarte
            key={p.callId}
            p={p}
            stelle={stelleVon(p)}
            offen={offen === p.callId}
            umschalten={() => setOffen(offen === p.callId ? null : p.callId)}
          />
        ))}
      </div>
    </section>
  );
}

function StatusAnzeige({ p }: { p: Protokoll }) {
  const laeuft = p.status === 'laeuft';
  const wartet = p.status === 'beendet' || p.status === 'wird_erstellt';
  const jetzt = useJetzt(laeuft || wartet);

  if (laeuft) {
    const seit = p.startedAt ? jetzt - new Date(p.startedAt).getTime() : 0;
    return (
      <span className="status status-laeuft">
        <span className="puls" /> Anruf läuft · {dauer(seit)}
      </span>
    );
  }
  if (wartet) {
    const seit = jetzt - new Date(p.endedAt ?? p.updatedAt).getTime();
    if (seit > HAENGT_MS) return <span className="status status-fehler">Keine Rückmeldung seit {Math.floor(seit / 60000)} Min. – siehe #n8n-fehler</span>;
    return (
      <span className="status status-arbeit">
        <span className="kreisel" /> Protokoll wird erstellt · {dauer(seit)}
      </span>
    );
  }
  if (p.status === 'fehler') return <span className="status status-fehler">Fehler{p.fehler ? `: ${p.fehler}` : ''}</span>;

  const empfehlung = p.protokoll?.empfehlung ?? p.empfehlung ?? '–';
  const klasse = empfehlung === 'Einladen' ? 'gut' : empfehlung === 'Absage' ? 'schlecht' : 'mittel';
  return (
    <span className={`status status-${klasse}`}>
      {empfehlung}
      {p.gesamtscore !== null && p.gesamtscore !== undefined ? ` · ${p.gesamtscore} %` : ''}
    </span>
  );
}

function ProtokollKarte({ p, stelle, offen, umschalten }: { p: Protokoll; stelle: string; offen: boolean; umschalten: () => void }) {
  const fertig = p.status === 'fertig' && p.protokoll;
  return (
    <article className={`karte ${offen ? 'offen' : ''}`}>
      <button className="karte-kopf" onClick={umschalten} disabled={!fertig && !p.transkript}>
        <div>
          <div className="karte-name">{p.name ?? (p.status === 'laeuft' ? 'Gespräch läuft' : 'Name folgt')}</div>
          <div className="karte-meta">
            {stelle} · {datum(p.startedAt ?? p.createdAt)}
          </div>
        </div>
        <StatusAnzeige p={p} />
      </button>
      {offen && <Details p={p} />}
    </article>
  );
}

function Liste({ titel, punkte }: { titel: string; punkte: string[] }) {
  return (
    <div className="block">
      <h3>{titel}</h3>
      {punkte.length ? (
        <ul>
          {punkte.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="leise">–</p>
      )}
    </div>
  );
}

function Details({ p }: { p: Protokoll }) {
  const d = p.protokoll;
  return (
    <div className="details">
      {d && (
        <>
          <div className="block">
            <h3>Zusammenfassung</h3>
            <p>{d.zusammenfassung}</p>
          </div>
          <div className="block">
            <h3>Bewertung</h3>
            <table className="tabelle">
              <thead>
                <tr>
                  <th>Kriterium</th>
                  <th>Stufe</th>
                  <th>Begründung</th>
                </tr>
              </thead>
              <tbody>
                {d.bewertungen.map((b) => (
                  <tr key={b.name}>
                    <td className="fett">{b.name}</td>
                    <td className="stufe">{b.score === null ? '–' : `${b.score}/${b.max}`}</td>
                    <td>
                      {b.begruendung}
                      {b.zitat && <div className="zitat">„{b.zitat}“</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="regel">Regel: {d.regeln.join('; ')}</p>
          </div>
          <div className="spalten">
            <Liste titel="Stärken" punkte={d.staerken} />
            <Liste titel="Schwächen / Red Flags" punkte={d.schwaechen} />
          </div>
          <div className="block">
            <h3>Einschätzung</h3>
            <p>{d.einschaetzung}</p>
          </div>
          <div className="spalten drei">
            <div className="block">
              <h3>Gehaltsvorstellung</h3>
              <p>{d.eckdaten.gehaltsvorstellung || '–'}</p>
            </div>
            <div className="block">
              <h3>Verfügbarkeit</h3>
              <p>{d.eckdaten.verfuegbarkeit || '–'}</p>
            </div>
            <div className="block">
              <h3>Startdatum</h3>
              <p>{d.eckdaten.startdatum || '–'}</p>
            </div>
          </div>
          <Liste titel="Offene Punkte für HR" punkte={d.offenePunkte} />
        </>
      )}
      <div className="fuss">
        {p.aufnahmeUrl && (
          <a className="knopf zweit" href={p.aufnahmeUrl} target="_blank" rel="noreferrer">
            Aufnahme anhören
          </a>
        )}
        <span className="leise">
          Call-ID {p.callId}
          {d ? ` · ${String(d.dauerMin).replace('.', ',')} Min. · ${d.gespraechsende}` : ''}
        </span>
      </div>
      {p.transkript && (
        <details className="transkript">
          <summary>Transkript</summary>
          {p.transkript.split('\n').map((zeile, i) => {
            const agent = zeile.startsWith('Agent:');
            return (
              <p key={i} className={agent ? 'agent' : 'bewerber'}>
                {zeile}
              </p>
            );
          })}
        </details>
      )}
    </div>
  );
}
