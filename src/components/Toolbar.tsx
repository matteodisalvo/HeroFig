import { t as tr } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { run, type Command } from '../App';
import { useStore } from '../store';
import { setUi, useUi } from '../ui';
import { Icon, type IconName } from './Icon';
import { ViewSwitch } from './PaperPage';
import { ProjectsButton } from './ProjectsPanel';
import { TogetherButton } from './Live';
import { ImageButton } from './ImagePanel';
import { keys } from '../os';
import { profileInitials, useProfile } from '../profile';

function ToolButton(p: { icon: IconName; tip: string; keys?: string; cmd: Command; disabled?: boolean }) {
  return (
    <button className="tool icon-only" onClick={() => run(p.cmd)} disabled={p.disabled} data-tip={tr(p.tip)} data-keys={p.keys} aria-label={tr(p.tip)}>
      <Icon name={p.icon} />
    </button>
  );
}

const EXPORTS: [Command, string, string][] = [
  ['exportPdf', 'PDF', 'Vettoriale, per \\includegraphics in LaTeX'],
  ['exportSvg', 'SVG', 'Vettoriale, modificabile in Inkscape / Illustrator'],
  ['exportPng', 'PNG', 'Raster ad alta risoluzione, per slide e poster'],
  ['exportTikz', 'TikZ', 'Codice LaTeX nativo, da includere con \\input'],
];

/** Menu a comparsa: si chiude con un clic fuori o con Esc, e con la tastiera parte dalla prima voce. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      ref.current?.querySelector<HTMLButtonElement>(':scope > button')?.focus();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key, true);
    ref.current?.querySelector<HTMLButtonElement>('.menu button')?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key, true);
    };
  }, [open]);
  // frecce su/giù fra le voci del menu
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    e.stopPropagation();
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.menu > button') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };
  return { open, setOpen, ref, onKeyDown };
}

const FILE_ITEMS: ([Command, IconName, string, string?] | null)[] = [
  ['new', 'new', 'Nuova figura', '⌘N'],
  ['open', 'open', 'Apri…', '⌘O'],
  null,
  ['save', 'save', 'Salva', '⌘S'],
  ['saveAs', 'duplicate', 'Salva con nome…', '⇧⌘S'],
  null,
  ['example', 'example', "Carica l'esempio"],
  null,
  ['profile', 'user', 'Il tuo spazio'],
  ['onboarding', 'monitor', 'Configura HeroFig…'],
];

/** Le azioni sul file, raccolte in un solo menu: nella barra resta solo Salva. */
function FileMenu() {
  const m = useMenu();
  return (
    <div className="export file-menu" ref={m.ref}>
      <button className="tool minor" onClick={() => m.setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={m.open} aria-label={tr("File")} data-tip={tr("Nuova figura, apri, salva con nome, esempio")}>
        <Icon name="doc" />
        <span>{tr("File")}</span>
        <Icon name="chevronDown" size={12} />
      </button>
      {m.open && (
        <div className="menu" role="menu" onKeyDown={m.onKeyDown}>
          {FILE_ITEMS.map((item, i) =>
            item ? (
              <button
                key={item[0]}
                role="menuitem"
                onClick={() => {
                  m.setOpen(false);
                  void run(item[0]);
                }}
              >
                <Icon name={item[1]} />
                <span className="menu-label">{tr(item[2])}</span>
                {item[3] && <kbd>{keys(item[3])}</kbd>}
              </button>
            ) : (
              <div key={i} className="menu-sep" />
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function Toolbar() {
  const profile = useProfile();
  const canUndo = useStore((s) => s.canUndo);
  const canRedo = useStore((s) => s.canRedo);
  const selCount = useStore((s) => s.sel.nodes.length);
  const hasSel = selCount > 0;
  const pngScale = useUi((s) => s.pngScale);
  const selectionOnly = useUi((s) => s.selectionOnly);
  const hideLibrary = useUi((s) => s.hideLibrary);
  const hideInspector = useUi((s) => s.hideInspector);
  const dirty = useStore((s) => s.dirty);
  const exportMenu = useMenu();
  const menu = exportMenu.open;
  const setMenu = exportMenu.setOpen;
  const menuRef = exportMenu.ref;
  const onMenuKey = exportMenu.onKeyDown;

  const pick = (cmd: Command) => {
    setMenu(false);
    void run(cmd);
  };

  return (
    <header className="toolbar">
      <button className="brand" onClick={() => run('about')} aria-label={tr("Informazioni su HeroFig")} data-tip={tr("Informazioni su HeroFig e autore")}>
        <svg viewBox="0 0 64 64" className="brand-mark" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="#14284B" />
          <rect x="11" y="14" width="13" height="37" rx="3.5" fill="#E4C6F0" />
          <rect x="40" y="14" width="13" height="37" rx="3.5" fill="#A9DAF8" />
          <path d="M25.5 32.5 H33.5" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M31.5 26 L38.6 32.5 L31.5 39 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        className="tool icon-only"
        onClick={() => run('toggleLibrary')}
        aria-pressed={!hideLibrary}
        aria-label={tr("Mostra o nascondi la libreria")}
        data-tip={tr(hideLibrary ? 'Mostra la libreria (⇧⌘F: entrambi i pannelli)' : 'Nascondi la libreria (⇧⌘F: entrambi i pannelli)')}
      >
        <Icon name="sidebarLeft" />
      </button>
      {/* documento */}
      <div className="tool-group">
        <ProjectsButton />
        <FileMenu />
        <button
          className={dirty ? 'tool icon-only save-tool dirty' : 'tool icon-only save-tool'}
          onClick={() => run('save')}
          aria-label={tr("Salva")}
          data-tip={tr(dirty ? 'Salva le modifiche' : 'Tutto salvato')}
          data-keys="⌘S"
        >
          <Icon name="save" />
        </button>
      </div>
      {/* modifica: raggruppa e copia stile stanno nel menu del tasto destro e nella barra della selezione */}
      <div className="tool-group">
        <ToolButton icon="undo" tip={tr("Annulla modifica")} keys="⌘Z" cmd="undo" disabled={!canUndo} />
        <ToolButton icon="redo" tip={tr("Ripeti")} keys="⇧⌘Z" cmd="redo" disabled={!canRedo} />
      </div>
      {/* inserisci */}
      <div className="tool-group">
        <ImageButton />
      </div>
      <div className="spacer" />
      <ViewSwitch />
      <div className="spacer" />
      {/* insieme agli altri */}
      <div className="tool-group">
        <TogetherButton />
      </div>
      <button className="tool minor" data-feedback-launcher onClick={() => run('feedback')}
        aria-label={tr('Richieste e segnalazioni')} data-tip={tr('Richieste e segnalazioni')}>
        <Icon name="comment" /><span>{tr('Feedback')}</span>
      </button>
      <div className="export" ref={menuRef}>
        <button className="primary" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
          {tr("Esporta")}
          <Icon name="chevronDown" size={14} />
        </button>
        {menu && (
          <div className="menu" role="menu" onKeyDown={onMenuKey}>
            {EXPORTS.map(([cmd, name, hint]) => (
              <button key={cmd} role="menuitem" onClick={() => pick(cmd)}>
                <span className="format-badge">{name}</span>
                <span className="menu-text">
                  <strong>{tr("Esporta {name}…", { name })}</strong>
                  <small>{tr(hint)}</small>
                </span>
              </button>
            ))}
            <div className="menu-sep" />
            <button role="menuitem" onClick={() => pick('copyPng')}>
              <span className="format-badge ghost">
                <Icon name="image" size={14} />
              </span>
              <span className="menu-text">
                <strong>{tr("Copia come immagine")}</strong>
                <small>{tr("Negli appunti, da incollare nelle slide")}</small>
              </span>
              <kbd>{keys('⇧⌘C')}</kbd>
            </button>
            <button role="menuitem" onClick={() => pick('copySvg')}>
              <span className="format-badge ghost">
                <Icon name="copy" size={14} />
              </span>
              <span className="menu-text">
                <strong>{tr("Copia SVG")}</strong>
                <small>{tr("Negli appunti, per Figma o Inkscape")}</small>
              </span>
            </button>
            <div className="menu-sep" />
            <div className="menu-options">
              <label className="check">
                <input type="checkbox" checked={selectionOnly} onChange={(e) => setUi({ selectionOnly: e.target.checked })} />
                <span>
                  {tr("Solo la selezione")}
                  <small>
                    {hasSel ? ` · ${tr(selCount === 1 ? '{count} blocco' : '{count} blocchi', { count: selCount })}` : selectionOnly ? ` · ${tr('nessuna: tutta la figura')}` : ''}
                  </small>
                </span>
              </label>
              <label className="row-inline">
                <span>{tr("Risoluzione PNG")}</span>
                <select value={pngScale} onChange={(e) => setUi({ pngScale: Number(e.target.value) })}>
                  {[1, 2, 3, 4].map((s) => (
                    <option key={s} value={s}>
                      {s}× ({s * 96} dpi)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
      <button
        className="tool icon-only"
        onClick={() => run('toggleInspector')}
        aria-pressed={!hideInspector}
        aria-label={tr("Mostra o nascondi il pannello proprietà")}
        data-tip={tr(hideInspector ? 'Mostra le proprietà (⇧⌘F: entrambi i pannelli)' : 'Nascondi le proprietà (⇧⌘F: entrambi i pannelli)')}
      >
        <Icon name="sidebarRight" />
      </button>
      <button className="tool icon-only profile-launcher" data-profile-launcher onClick={() => run('profile')}
        aria-label={tr('Il tuo spazio')} aria-haspopup="dialog" data-tip={tr('Il tuo spazio')}>
        <span className="profile-launcher-avatar" data-profile-color={profile.color} aria-hidden="true">{profileInitials(profile.name)}</span>
      </button>
    </header>
  );
}
