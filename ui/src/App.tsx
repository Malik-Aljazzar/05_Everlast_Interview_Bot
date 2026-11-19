import { useEffect, useState } from 'react';
import { ladeConfig } from './api';
import type { Stelle } from './types';
import Protokolle from './Protokolle';
import Konfiguration from './Konfiguration';

type Ansicht = 'protokolle' | 'konfiguration';

// Der Reiter steht im Anker (#konfiguration), damit Links und Neuladen in derselben Ansicht landen.
const ausAnker = (): Ansicht => (window.location.hash === '#konfiguration' ? 'konfiguration' : 'protokolle');

export default function App() {
  const [ansicht, setAnsichtState] = useState<Ansicht>(ausAnker);
  const setAnsicht = (a: Ansicht) => {
    window.location.hash = a;
    setAnsichtState(a);
  };
  const [stellen, setStellen] = useState<Stelle[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const neuLaden = () =>
    ladeConfig()
      .then((s) => {
        setStellen(s);
        setFehler(null);
      })
      .catch((e: Error) => setFehler(e.message))
      .finally(() => setGeladen(true));

  useEffect(() => {
    neuLaden();
  }, []);

  return (
    <div className="app">
      <header className="kopf">
        <div className="marke">
          <span className="marke-punkt" />
          <div>
            <div className="marke-titel">Everlast Interview Bot</div>
            <div className="marke-unter">Bewerberprotokolle und Interview-Konfiguration</div>
          </div>
        </div>
        <nav className="reiter">
          <button className={ansicht === 'protokolle' ? 'aktiv' : ''} onClick={() => setAnsicht('protokolle')}>
            Protokolle
          </button>
          <button className={ansicht === 'konfiguration' ? 'aktiv' : ''} onClick={() => setAnsicht('konfiguration')}>
            Konfiguration
          </button>
        </nav>
      </header>
      <main className="inhalt">
        {fehler && <div className="hinweis fehler">Konfiguration konnte nicht geladen werden: {fehler}</div>}
        {/* Beide Ansichten bleiben gemountet, damit ein Entwurf in der Konfiguration den Reiterwechsel übersteht. */}
        <div hidden={ansicht !== 'protokolle'}>
          <Protokolle stellen={stellen} />
        </div>
        <div hidden={ansicht !== 'konfiguration'}>
          <Konfiguration stellen={stellen} geladen={geladen} onNeuLaden={neuLaden} />
        </div>
      </main>
    </div>
  );
}
