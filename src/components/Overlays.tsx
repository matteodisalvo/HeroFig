import { t as tr } from '../i18n';
import { useEffect, useRef } from 'react';
import { run } from '../App';
import { useStore } from '../store';
import { setUi, useUi } from '../ui';
import { Icon } from './Icon';
import { PresenceChip } from './Comments';
import { keys } from '../os';

const SHORTCUTS: [string, [string, string][]][] = [
  [
    'File',
    [
      ['⌘N', 'Nuovo documento'],
      ['⌘O', 'Apri'],
      ['⌘S', 'Salva'],
      ['⇧⌘S', 'Salva con nome'],
      ['⇧⌘C', 'Copia come immagine (per slide e documenti)'],
    ],
  ],
  [
    'Modifica',
    [
      ['⌘Z / ⇧⌘Z', 'Annulla / Ripeti'],
      ['⌘C ⌘X ⌘V', 'Copia, taglia, incolla blocchi'],
      ['⌘D', 'Duplica'],
      ['⌘A', 'Seleziona tutto'],
      ['⌥⌘C / ⌥⌘V', 'Copia / incolla lo stile'],
      ['⌘G', 'Raggruppa in un contenitore'],
      ['⌘] / ⌘[', 'Porta davanti / dietro'],
      ['⌫', 'Elimina la selezione'],
      ['Frecce', 'Sposta di 1 px (con ⇧: 10 px)'],
    ],
  ],
  [
    'Foglio e vista',
    [
      ['↩ o doppio clic', "Scrivi l'etichetta di un blocco o di una freccia"],
      ['Pallini blu', 'Trascina per collegare due blocchi'],
      ['Pallino sulla freccia', 'Trascina per spostare il tratto centrale'],
      ['⇧ + clic', 'Aggiungi o togli dalla selezione'],
      ['Tasto destro', 'Menu con le azioni rapide'],
      ['⌥ + trascina', "Disattiva l'aggancio"],
      ['Spazio + trascina', 'Sposta la vista'],
      ['⌘ + rotella', 'Zoom'],
      ['⌘0 / ⌘1 / ⌘2', 'Adatta alla finestra / 100% / selezione'],
      ['⇧⌘F', 'Solo foglio: nascondi o mostra i pannelli laterali'],
    ],
  ],
  [
    'Libreria',
    [
      ['⌘F o /', 'Cerca blocchi e modelli'],
      ['↩ nella ricerca', 'Inserisci il primo risultato'],
      ['↓ e frecce', 'Scorri i risultati, ↩ per inserire'],
      ['Esc', 'Cancella la ricerca'],
      ['☆', 'Aggiungi ai preferiti (al passaggio del mouse)'],
    ],
  ],
];

export function Shortcuts() {
  const open = useUi((s) => s.shortcuts);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // alla chiusura il focus torna dove era (il pulsante o il campo da cui si è aperta la finestra)
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => {
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onPointerDown={() => setUi({ shortcuts: false })}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={tr("Scorciatoie da tastiera")} tabIndex={-1} ref={ref} onPointerDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{tr("Scorciatoie da tastiera")}</h2>
          <button className="tool icon-only" onClick={() => setUi({ shortcuts: false })} aria-label={tr("Chiudi")} data-tip={tr("Chiudi")} data-keys="Esc">
            <Icon name="close" />
          </button>
        </header>
        <div className="shortcut-cols">
          {SHORTCUTS.map(([title, rows]) => (
            <section key={tr(title)}>
              <h3>{tr(title)}</h3>
              <dl>
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt>
                      <kbd>{keys(tr(k))}</kbd>
                    </dt>
                    <dd>{keys(tr(v))}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatusBar() {
  const doc = useStore((s) => s.doc);
  const sel = useStore((s) => s.sel);
  const zoom = useStore((s) => s.view.zoom);
  const filePath = useStore((s) => s.filePath);
  const dirty = useStore((s) => s.dirty);
  const selected = sel.nodes.length + sel.edges.length;
  let hint: React.ReactNode;
  if (sel.nodes.length > 1) hint = <>{tr("Usa la barra sopra la selezione per allineare ·")} <kbd>{keys('⌘G')}</kbd> {tr("raggruppa")}</>;
  else if (selected) hint = <><kbd>{keys('↩')}</kbd> {tr("scrivi l'etichetta · tasto destro per le azioni rapide ·")} <kbd>{keys('⌥⌘C')}</kbd>/<kbd>{keys('⌥⌘V')}</kbd> {tr("copia e incolla lo stile")}</>;
  else hint = <>{tr("Trascina i blocchi dalla libreria ·")} <kbd>{keys('⌘F')}</kbd> {tr("cerca · doppio clic per scrivere ·")} <kbd>{keys('⌘/')}</kbd> {tr("scorciatoie")}</>;
  return (
    <footer className="statusbar">
      <span className="status-counts">
        {tr("{nodes} blocchi · {edges} connessioni", { nodes: doc.nodes.length, edges: doc.edges.length })}
        {selected > 0 && <span className="status-sel"> · {tr("{count} selezionati", { count: selected })}</span>}
      </span>
      <span className="statusbar-hint">{hint}</span>
      <span className="status-file">
        <span className={dirty ? 'dot dirty' : 'dot'} aria-hidden="true" />
        <span data-tip={filePath ?? tr('Documento non ancora salvato (autosalvataggio attivo)')} data-tip-place="above">
          {filePath ? filePath.split(/[\\/]/).pop() : tr('Senza titolo')}
        </span>
        <PresenceChip />
        <span className="status-muted">{dirty ? tr('modificato') : filePath ? tr('salvato') : ''}</span>
        {/* lo zoom sta qui, vicino al foglio, e non nella barra in alto */}
        <span className="status-zoom-group">
          <button className="status-btn" onClick={() => run('zoomOut')} aria-label={tr("Riduci")} data-tip={tr("Riduci")} data-keys="⌘−" data-tip-place="above">
            <Icon name="minus" size={13} />
          </button>
          <button className="status-zoom" onClick={() => run('zoomReset')} data-tip={tr("Zoom al 100%")} data-keys="⌘1" data-tip-place="above">
            {Math.round(zoom * 100)}%
          </button>
          <button className="status-btn" onClick={() => run('zoomIn')} aria-label={tr("Ingrandisci")} data-tip={tr("Ingrandisci")} data-keys="⌘+" data-tip-place="above">
            <Icon name="plus" size={13} />
          </button>
          <button className="status-btn" onClick={() => run('zoomFit')} aria-label={tr("Adatta alla finestra")} data-tip={tr("Adatta alla finestra")} data-keys="⌘0" data-tip-place="above">
            <Icon name="fit" size={13} />
          </button>
        </span>
        <button className="status-btn" onClick={() => run('shortcuts')} aria-label={tr("Scorciatoie da tastiera")} data-tip={tr("Scorciatoie da tastiera")} data-keys="⌘/" data-tip-place="above">
          <Icon name="help" size={13} />
        </button>
      </span>
    </footer>
  );
}

export function Toast() {
  const t = useUi((s) => s.toast);
  return t ? (
    <div className={`toast ${t.kind}`} role="status" key={t.text}>
      <Icon name={t.kind === 'ok' ? 'check' : 'info'} size={14} />
      <span>{t.text}</span>
    </div>
  ) : null;
}
