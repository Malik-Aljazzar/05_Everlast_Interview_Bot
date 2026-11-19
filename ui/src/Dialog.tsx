import { useEffect, useId, useRef, type ReactNode } from 'react';

// Modaler Dialog auf Basis von <dialog>: Fokus, Esc und abgedunkelter Hintergrund kommen vom Browser.
export default function Dialog({
  titel,
  unter,
  fuss,
  breit,
  gesperrt,
  onSchliessen,
  children,
}: {
  titel: string;
  unter?: string;
  fuss?: ReactNode;
  breit?: boolean;
  // Während eine Anfrage läuft, schließen weder Esc noch das X.
  gesperrt?: boolean;
  onSchliessen: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d || d.open) return;
    d.showModal();
    // Fokus aufs erste Eingabefeld, in Rückfragen ohne Feld auf „Abbrechen“ statt aufs ✕.
    d.querySelector<HTMLElement>('.dialog-inhalt :is(input, textarea, select), .dialog-fuss .knopf.zweit')?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className={breit ? 'dialog breit' : 'dialog'}
      aria-labelledby={id}
      onCancel={(e) => gesperrt && e.preventDefault()}
      onClose={onSchliessen}
    >
      <header className="dialog-kopf">
        <div>
          <h2 id={id}>{titel}</h2>
          {unter && <p className="leise">{unter}</p>}
        </div>
        <button className="schliessen" aria-label="Schließen" disabled={gesperrt} onClick={onSchliessen}>
          ✕
        </button>
      </header>
      <div className="dialog-inhalt">{children}</div>
      {fuss && <footer className="dialog-fuss">{fuss}</footer>}
    </dialog>
  );
}
