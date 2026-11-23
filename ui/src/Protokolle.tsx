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
          {protokolle.length} {protokolle.length === 1 ? 'Gespräch' : 'Gespräche'}{laufend ? ` · ${laufend} in Bearbeitung` : ''}
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
            {p.protokoll ? ` · ${String(p.protokoll.dauerMin).replace('.', ',')} Min.` : ''}
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
        <p className="leise">Keine</p>
      )}
    </div>
  );
}

// Claude beginnt die Begründung oft mit „Entspricht Stufe 3.“; die Stufe steht schon daneben.
const ohneStufe = (text: string) => text.replace(/^Entspricht Stufe \d+[.:]?\s*/i, '');

function Details({ p }: { p: Protokoll }) {
  const [transkriptOffen, setTranskriptOffen] = useState(false);
  const d = p.protokoll;
  const eckdaten = d
    ? [
        ['Gehalt', d.eckdaten.gehaltsvorstellung],
        ['Verfügbarkeit', d.eckdaten.verfuegbarkeit],
        ['Start', d.eckdaten.startdatum],
      ]
    : [];
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
            <ul className="bewertungen">
              {d.bewertungen.map((b) => (
                <li key={b.name} className="bewertung">
                  <span className="fett">{b.name}</span>
                  <span className="score">{b.score === null ? '–' : `${b.score}/${b.max}`}</span>
                  <div>
                    <p>{ohneStufe(b.begruendung)}</p>
                    {b.zitat && <p className="zitat">„{b.zitat}“</p>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="regel">{d.regeln.join('; ')}</p>
          </div>
          {/* Zwei Spalten nur, wenn beide Listen etwas enthalten; sonst bleibt neben „Keine“ eine Lücke. */}
          <div className={d.staerken.length && d.schwaechen.length ? 'spalten' : 'stapel'}>
            <Liste titel="Stärken" punkte={d.staerken} />
            <Liste titel="Schwächen und Red Flags" punkte={d.schwaechen} />
          </div>
          <dl className="eckdaten">
            {eckdaten.map(([label, wert]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{wert || 'nicht genannt'}</dd>
              </div>
            ))}
          </dl>
          {d.offenePunkte.length > 0 && <Liste titel="Offene Punkte für HR" punkte={d.offenePunkte} />}
        </>
      )}
      {(p.aufnahmeUrl || p.transkript) && (
        <div className="fuss">
          {p.aufnahmeUrl && (
            <a className="knopf zweit" href={p.aufnahmeUrl} target="_blank" rel="noreferrer">
              Aufnahme anhören
            </a>
          )}
          {p.transkript && (
            <button className="knopf zweit" aria-expanded={transkriptOffen} onClick={() => setTranskriptOffen(!transkriptOffen)}>
              {transkriptOffen ? 'Transkript ausblenden' : 'Transkript anzeigen'}
            </button>
          )}
        </div>
      )}
      {p.transkript && transkriptOffen && (
        <div className="transkript">
          {p.transkript.split('\n').map((zeile, i) => (
            <p key={i} className={zeile.startsWith('Agent:') ? 'agent' : 'bewerber'}>
              {zeile}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
