import { useEffect } from 'react';
import {
  addImage,
  copyStyle,
  deleteSelection,
  docForExport,
  duplicateSelection,
  groupSelection,
  pasteStyle,
  reorder,
  nudge,
  pasteSerialized,
  resetPasteOffset,
  selectAll,
  serializeSelection,
  updateSettings,
  zoomBy,
  zoomFit,
} from './actions';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { Palette } from './components/Palette';
import { Shortcuts, StatusBar, Toast } from './components/Overlays';
import { UpdateNotice } from './components/UpdateNotice';
import { About, StarNudge, noteExport } from './components/About';
import { Toolbar } from './components/Toolbar';
import { Tooltip } from './components/Tooltip';
import { PacksPanel } from './components/PacksPanel';
import { FeedbackPanel } from './components/FeedbackPanel';
import { getFeedback, openFeedback } from './feedback';
import { closePacks } from './packs';
import { Onboarding } from './components/Onboarding';
import { ProfilePanel } from './components/ProfilePanel';
import { getOnboarding, openOnboarding, useOnboarding } from './onboarding';
import { buildPng, buildSvg } from './export/svg';
import { buildTikz, type TikzImage } from './export/tikz';
import { prepareGeneratedAssets } from './generated-assets';
import { dataUrlBytes, pickImageFile, readImage } from './images';
import { demoDoc, emptyDoc, normalizeDoc, type Doc } from './model';
import { syncPaper } from './papersync';
import { closeWindow, copyPng, copyText, exportPdf, onFileChanged, onMenu, onOpenFile, openFile, readFile, saveExport, saveFile, setDirty, saveSideFiles, watchFile } from './platform';
import { merge3 } from './merge';
import { getState, loadDoc, markSaved, redo, setDoc, setEditing, setSel, undo, useStore } from './store';
import { getUi, setUi, toast, useUi } from './ui';
import { t, useLanguage } from './i18n';
import { syncNativeLanguage } from './native-language';

const APP_NAME = 'HeroFig';

function baseName(path: string | null): string {
  if (!path) return 'pipeline';
  return path.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, '');
}

function confirmDiscard(): boolean {
  return !getState().dirty || window.confirm(t('Ci sono modifiche non salvate. Continuare senza salvare?'));
}

/** Ultima versione letta o scritta sul disco: è la base per unire le modifiche di un'altra persona. */
let disk: { path: string; doc: Doc } | null = null;

const conflictNote = (n: number) => (n ? t(' · conflitti: {count}; tenuta la tua versione', { count: n }) : '');

async function save(saveAs: boolean): Promise<boolean> {
  const { filePath } = getState();
  let mergedNote = '';
  // cartella condivisa: se nel frattempo un'altra persona ha salvato, si uniscono le due versioni
  if (!saveAs && filePath && disk?.path === filePath) {
    try {
      const theirs = normalizeDoc(JSON.parse(await readFile(filePath)));
      if (JSON.stringify(theirs) !== JSON.stringify(disk.doc)) {
        // la propria versione si legge dopo la lettura del file: comprende le modifiche fatte nel frattempo
        const m = merge3(disk.doc, getState().doc, theirs);
        setDoc(m.doc);
        mergedNote = t(' · unite le modifiche di un’altra persona{conflicts}', { conflicts: conflictNote(m.conflicts) });
      }
    } catch {
      // file non leggibile (spostato, a metà sincronizzazione, versione web): si salva e basta
    }
  }
  const { doc } = getState();
  const content = JSON.stringify(doc, null, 2);
  const res = await saveFile(content, saveAs ? null : filePath, baseName(filePath));
  if (res.ok) {
    const path = res.path ?? filePath;
    disk = path ? { path, doc: normalizeDoc(JSON.parse(content)) } : null;
    // le modifiche fatte mentre si scriveva il file restano da salvare
    markSaved(res.path ?? filePath, doc);
    // nel browser non c'è un percorso: il file scaricato si chiama <nome>.hfig
    const saved = res.path ?? filePath;
    // figura collegata al paper: PDF e TikZ si aggiornano a ogni salvataggio
    const paper = doc.settings.paperDir ? await syncPaper(doc, saved) : null;
    const paperNote = paper?.ok && paper.files ? t(paper.pushed ? ' · inviata a Overleaf ({files})' : ' · aggiornata nel paper ({files})', { files: paper.files }) : '';
    toast(t('Salvato: {name}{merged}{paper}', { name: saved ? saved.split(/[\\/]/).pop()! : baseName(saved) + '.hfig', merged: mergedNote, paper: paperNote }), mergedNote ? 'info' : 'ok');
    if (paper && !paper.ok) toast(t('Salvato, ma il paper non è aggiornato: {error}', { error: paper.error ?? '' }), 'info');
    else if (paper?.pushError) toast(t('Salvato nella copia locale, ma non inviato a Overleaf: {error}', { error: paper.pushError }), 'info');
  }
  return res.ok;
}

/** La figura aperta è appena stata scritta in `path` (pannello Progetti): diventa la base per le unioni. */
export function adoptSaved(path: string, doc: Doc) {
  disk = { path, doc: normalizeDoc(JSON.parse(JSON.stringify(doc))) };
  markSaved(path, doc);
}

/** Apre una figura già letta dal disco (pannello Progetti); false se l'utente tiene le modifiche correnti. */
export function openFigure(content: string, path: string): boolean {
  if (!confirmDiscard()) return false;
  openDocument(content, path);
  return true;
}

function openDocument(content: string, path: string | null) {
  const opened = normalizeDoc(JSON.parse(content));
  disk = path ? { path, doc: opened } : null;
  loadDoc(opened, path);
  zoomFit(opened);
}

// caselle, colori e cursori non sono campi di testo: dopo un clic su «Contenitore» ⌘Z, ⌫ e le frecce agiscono sul disegno
const TEXT_FIELD = 'input:not([type="checkbox"], [type="radio"], [type="color"], [type="range"], [type="button"], [type="submit"], [type="file"]), textarea, select, [contenteditable]';
const inTextField = () => !!document.activeElement?.closest(TEXT_FIELD);
/** Una finestra modale aperta (Pacchetti, Progetti, Informazioni, Scorciatoie…): il disegno sotto non si tocca. */
const dialogOpen = () => !!document.querySelector('[aria-modal="true"], dialog[open]');

export type Command =
  | 'new' | 'example' | 'open' | 'save' | 'saveAs' | 'saveAndClose'
  | 'exportSvg' | 'exportPdf' | 'exportPng' | 'exportTikz' | 'copyPng' | 'copySvg'
  | 'undo' | 'redo' | 'delete' | 'duplicate' | 'selectAll'
  | 'copyStyle' | 'pasteStyle' | 'groupSelection' | 'bringFront' | 'sendBack'
  | 'zoomIn' | 'zoomOut' | 'zoomFit' | 'zoomReset' | 'zoomSelection' | 'toggleGrid' | 'shortcuts' | 'about'
  | 'focusSearch' | 'editLabel' | 'insertImage' | 'toggleLibrary' | 'toggleInspector' | 'togglePanels' | 'onboarding' | 'feedback' | 'profile';


/** Avvia la scrittura dell'etichetta dell'unico blocco o freccia selezionato. */
function editSelectedLabel() {
  const { sel } = getState();
  if (sel.nodes.length === 1 && !sel.edges.length) setEditing({ kind: 'node', id: sel.nodes[0] });
  else if (sel.edges.length === 1 && !sel.nodes.length) setEditing({ kind: 'edge', id: sel.edges[0] });
}

function focusSearch() {
  // se la libreria è nascosta la si riapre prima di portarvi il cursore
  if (getUi().hideLibrary) setUi({ hideLibrary: false });
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>('.palette .search input');
    input?.focus();
    input?.select();
  });
}

/** Conferma l'export con il nome del file (niente messaggio se l'utente ha annullato). */
function exported(path: string | null) {
  if (!path) return;
  const ai = getState().doc.nodes.filter((n) => n.ai).length;
  const name = path.split(/[\\/]/).pop();
  noteExport();
  // molte riviste chiedono di dichiarare le immagini generate con l'IA
  if (ai) toast(t('Esportato: {name} · immagini IA: {count}. Dichiarale nel paper.', { name: name ?? '', count: ai }), 'info');
  else toast(t('Esportato: {name}', { name: name ?? '' }));
}

export async function run(cmd: Command) {
  // Anche i menu nativi devono rispettare la finestra di configurazione.
  // Le azioni sui campi di testo e il salvataggio prima di chiudere restano disponibili.
  if (getOnboarding().open && cmd !== 'saveAndClose' && !(inTextField() && ['undo', 'redo', 'selectAll'].includes(cmd))) return;
  if (getFeedback().open && !['feedback', 'saveAndClose'].includes(cmd) && !(inTextField() && ['undo', 'redo', 'selectAll'].includes(cmd))) return;
  if (getUi().profile && !['profile', 'saveAndClose'].includes(cmd) && !(inTextField() && ['undo', 'redo', 'selectAll'].includes(cmd))) return;
  // anche le altre finestre modali: dal menu nativo restano solo il comando che le apre/chiude e il salvataggio
  const own = (cmd === 'shortcuts' && getUi().shortcuts) || (cmd === 'about' && getUi().about) || (cmd === 'feedback' && getFeedback().open) || (cmd === 'profile' && getUi().profile);
  if (dialogOpen() && !own && cmd !== 'saveAndClose' && !(inTextField() && ['undo', 'redo', 'selectAll'].includes(cmd))) return;
  const { doc: fullDoc, filePath, view } = getState();
  const name = baseName(filePath);
  // gli export rispettano l'opzione "solo selezione"
  const doc = cmd.startsWith('export') || cmd.startsWith('copy') ? docForExport(getUi().selectionOnly) : fullDoc;
  try {
    if (cmd.startsWith('export') || cmd === 'copyPng' || cmd === 'copySvg') await prepareGeneratedAssets(doc);
    switch (cmd) {
      case 'new':
        if (confirmDiscard()) loadDoc(emptyDoc(), null);
        break;
      case 'example': {
        if (fullDoc.nodes.length && !window.confirm(t("Sostituire il disegno corrente con l'esempio?"))) break;
        const demo = demoDoc();
        loadDoc(demo, null);
        zoomFit(demo);
        break;
      }
      case 'open': {
        if (!confirmDiscard()) break;
        const file = await openFile();
        if (file) openDocument(file.content, file.path);
        break;
      }
      case 'save': await save(false); break;
      case 'saveAs': await save(true); break;
      case 'saveAndClose': if (await save(false)) closeWindow(); break;
      case 'exportSvg':
        exported(await saveExport(name, 'svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + buildSvg(doc).svg));
        break;
      case 'exportPdf': {
        const { svg, width, height } = buildSvg(doc);
        exported(await exportPdf(name, svg, width, height));
        break;
      }
      case 'exportPng': exported(await saveExport(name, 'png', await buildPng(doc, getUi().pngScale))); break;
      case 'exportTikz': {
        const images: TikzImage[] = [];
        const path = await saveExport(name, 'tex', buildTikz(doc, { imageBase: name, images }));
        if (path && images.length) await saveSideFiles(path, images.map((im) => ({ name: im.name, data: dataUrlBytes(im.dataUrl) })));
        if (path && images.length) {
          toast(t('Esportato {name} con {count} immagini accanto', { name: path.split(/[\\/]/).pop() ?? '', count: images.length }));
          noteExport();
        } else exported(path);
        break;
      }
      case 'insertImage': {
        const file = await pickImageFile();
        if (file) {
          addImage(await readImage(file));
          toast(t('Immagine inserita: trascina i bordi per ridimensionarla'));
        }
        break;
      }
      case 'copyPng':
        await copyPng(await buildPng(doc, getUi().pngScale));
        toast(t('Immagine copiata: incollala in PowerPoint, Keynote, Word…'));
        break;
      case 'copySvg':
        await copyText(buildSvg(doc).svg);
        toast(t('SVG copiato negli appunti'));
        break;
      case 'copyStyle':
        if (copyStyle()) toast(t('Stile copiato: seleziona altri elementi e usa ⌥⌘V'));
        break;
      case 'pasteStyle': {
        const before = getState().doc;
        pasteStyle();
        const { sel } = getState();
        if (getState().doc !== before) toast(t('Stile applicato: {count} elementi', { count: sel.nodes.length + sel.edges.length }));
        else if (sel.nodes.length || sel.edges.length) toast(t('Nessuno stile da incollare: prima copialo con ⌥⌘C'), 'info');
        break;
      }
      case 'groupSelection': {
        const before = getState().doc;
        groupSelection();
        if (getState().doc !== before) toast(t('Contenitore creato: doppio clic sul titolo per rinominarlo'));
        break;
      }
      case 'bringFront': reorder('front'); break;
      case 'sendBack': reorder('back'); break;
      case 'shortcuts': setUi({ shortcuts: !getUi().shortcuts }); break;
      case 'about': setUi({ about: !getUi().about }); break;
      case 'onboarding': openOnboarding(); break;
      case 'profile': closePacks(); setUi({ profile: true, about: false, shortcuts: false, starNudge: false }); break;
      case 'feedback': closePacks(); setUi({ about: false, shortcuts: false }); openFeedback(); break;
      // con il cursore in un campo di testo, annulla/ripeti e seleziona tutto agiscono sul campo
      case 'undo': inTextField() ? document.execCommand('undo') : undo(); break;
      case 'redo': inTextField() ? document.execCommand('redo') : redo(); break;
      case 'selectAll': inTextField() ? document.execCommand('selectAll') : selectAll(); break;
      case 'delete': {
        const { sel } = getState();
        const count = sel.nodes.length + sel.edges.length;
        deleteSelection();
        if (count > 1) toast(t('Elementi eliminati: {count} · ⌘Z per annullare', { count }));
        break;
      }
      case 'duplicate': duplicateSelection(); break;
      case 'zoomIn': zoomBy(1.25); break;
      case 'zoomOut': zoomBy(0.8); break;
      case 'zoomFit': zoomFit(); break;
      case 'zoomReset': zoomBy(1 / view.zoom); break;
      // con una selezione inquadra solo quella (docForExport la isola), altrimenti tutto
      case 'zoomSelection': zoomFit(docForExport(true)); break;
      case 'toggleGrid': updateSettings({ grid: !fullDoc.settings.grid }); break;
      case 'focusSearch': focusSearch(); break;
      case 'toggleLibrary': setUi({ hideLibrary: !getUi().hideLibrary }); break;
      case 'toggleInspector': setUi({ hideInspector: !getUi().hideInspector }); break;
      case 'togglePanels': {
        // ⇧⌘F: solo foglio, oppure tutti e due i pannelli di nuovo visibili
        const show = getUi().hideLibrary || getUi().hideInspector;
        setUi({ hideLibrary: !show, hideInspector: !show });
        break;
      }
      case 'editLabel': editSelectedLabel(); break;
    }
  } catch (err) {
    window.alert(err instanceof Error ? err.message : String(err));
  }
}

const KEYS: Record<string, Command> = {
  z: 'undo', y: 'redo', s: 'save', o: 'open', n: 'new', d: 'duplicate', a: 'selectAll',
  '=': 'zoomIn', '+': 'zoomIn', '-': 'zoomOut', '0': 'zoomFit', '1': 'zoomReset', '2': 'zoomSelection',
  g: 'groupSelection', '/': 'shortcuts', ']': 'bringFront', '[': 'sendBack', f: 'focusSearch', '\\': 'togglePanels',
};
/** Scorciatoie attive anche con il cursore in un campo di testo. */
const GLOBAL_CMDS: Command[] = ['save', 'saveAs', 'open', 'new', 'focusSearch', 'shortcuts'];
const SHIFT_KEYS: Record<string, Command> = { z: 'redo', s: 'saveAs', c: 'copyPng', f: 'togglePanels', i: 'insertImage' };
const ALT_KEYS: Record<string, Command> = { c: 'copyStyle', v: 'pasteStyle' };
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};
const CODE_KEYS: Record<string, string> = { BracketLeft: '[', BracketRight: ']', Slash: '/', Backslash: '\\', Equal: '=', Minus: '-' };

/** Tasto di una scorciatoia: con una tastiera non latina (russo, arabo, coreano…) e.key è la lettera locale, si usa il tasto fisico. */
function shortcutKey(e: KeyboardEvent): string {
  if (e.key.length !== 1) return e.key;
  if (/^[\x20-\x7e]$/.test(e.key)) return e.key.toLowerCase();
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  return CODE_KEYS[e.code] ?? e.key.toLowerCase();
}

export function App() {
  const language = useLanguage();
  const filePath = useStore((s) => s.filePath);
  const dirty = useStore((s) => s.dirty);
  const theme = useUi((s) => s.theme);
  const onboarding = useOnboarding();
  const profileOpen = useUi((s) => s.profile);

  useEffect(() => {
    document.documentElement.lang = language;
    syncNativeLanguage(language);
  }, [language]);

  // tema dell'interfaccia: "system" segue macOS via prefers-color-scheme
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.title = `${dirty ? '● ' : ''}${baseName(filePath)} — ${APP_NAME}`;
    setDirty(dirty);
  }, [filePath, dirty]);

  // cartella condivisa: se un'altra persona salva la figura aperta, la si ricarica
  useEffect(() => {
    watchFile(filePath);
  }, [filePath]);
  useEffect(
    () =>
      onFileChanged((file) => {
        const { filePath: current, dirty: unsaved } = getState();
        if (file.path !== current) return;
        let changed;
        try {
          changed = normalizeDoc(JSON.parse(file.content));
        } catch {
          return; // file a metà sincronizzazione: arriverà di nuovo intero
        }
        if (unsaved) {
          // modifiche da entrambe le parti: si uniscono, elemento per elemento
          const m = merge3(disk?.path === current ? disk.doc : changed, getState().doc, changed);
          disk = { path: current, doc: changed };
          setDoc(m.doc);
          toast(t('Unite le modifiche di un’altra persona{conflicts}', { conflicts: conflictNote(m.conflicts) }), 'info');
          return;
        }
        disk = { path: current, doc: changed };
        loadDoc(changed, current);
        toast(t("Figura aggiornata: l'ha modificata un'altra persona"));
      }),
    [],
  );

  // file aperti dal Finder (doppio clic su .hfig, .tfig o .mlsketch)
  useEffect(
    () =>
      onOpenFile((file) => {
        if (!confirmDiscard()) return;
        try {
          openDocument(file.content, file.path);
        } catch (err) {
          window.alert(err instanceof Error ? err.message : String(err));
        }
      }),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (getOnboarding().open || getFeedback().open || getUi().profile) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = mod ? shortcutKey(e) : e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const typing = !!(e.target as HTMLElement).closest(TEXT_FIELD);
      let cmd: Command | undefined;
      // con Alt su macOS e.key è un carattere speciale (ç, √): si usa il codice del tasto
      if (mod && e.altKey) cmd = ALT_KEYS[e.code.replace(/^Key/, '').toLowerCase()];
      else if (mod) cmd = (e.shiftKey ? SHIFT_KEYS[k] : undefined) ?? KEYS[k];
      // nei campi di testo restano attive solo le scorciatoie di file (e la ricerca)
      if (typing && !(cmd && GLOBAL_CMDS.includes(cmd))) return;
      // i pulsanti (libreria, menu) usano Invio e Spazio per sé
      const onControl = !!(e.target as HTMLElement).closest('button, a, [role="button"]');
      if (!mod && (k === 'Delete' || k === 'Backspace')) cmd = 'delete';
      if (!mod && !e.altKey && k === '/') cmd = 'focusSearch';
      if (!mod && k === 'Enter' && !onControl) cmd = 'editLabel';
      // con la finestra delle scorciatoie aperta i tasti non toccano il disegno sotto
      if (getUi().shortcuts && k !== 'Escape' && cmd !== 'shortcuts') return;
      if (getUi().about && k !== 'Escape') return;
      if (cmd) {
        e.preventDefault();
        void run(cmd);
      } else if (!mod && ARROWS[k] && !dialogOpen()) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudge(ARROWS[k][0] * step, ARROWS[k][1] * step);
      } else if (k === 'Escape') {
        if (getUi().about) setUi({ about: false });
        else if (getUi().shortcuts) setUi({ shortcuts: false });
        else setSel({ nodes: [], edges: [] });
      }
    };
    const onCopy = (e: ClipboardEvent) => {
      if (getOnboarding().open || getFeedback().open || getUi().profile || dialogOpen()) return;
      if (inTextField()) return;
      const text = serializeSelection();
      if (!text) return;
      e.preventDefault();
      e.clipboardData?.setData('text/plain', text);
      resetPasteOffset();
      if (e.type === 'cut') deleteSelection();
    };
    const onPaste = (e: ClipboardEvent) => {
      if (getOnboarding().open || getFeedback().open || getUi().profile || dialogOpen()) return;
      if (inTextField()) return;
      if (pasteSerialized(e.clipboardData?.getData('text/plain') ?? '')) {
        e.preventDefault();
        return;
      }
      // immagine negli appunti (screenshot, figura copiata da un altro programma)
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        readImage(file)
          .then((img) => {
            addImage(img);
            toast(t('Immagine incollata'));
          })
          .catch((err) => toast(err instanceof Error ? err.message : String(err), 'info'));
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    const offMenu = onMenu((action) => void run(action as Command));
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
      offMenu();
    };
  }, []);

  // al primo avvio centra il disegno nella finestra
  useEffect(() => {
    zoomFit();
  }, []);

  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <Palette />
        <Canvas />
        <Inspector />
      </div>
      <StatusBar />
      <Shortcuts />
      <About />
      <StarNudge />
      <PacksPanel />
      <FeedbackPanel />
      <Toast />
      <UpdateNotice />
      <Tooltip />
      {profileOpen && <ProfilePanel />}
      {onboarding.open && <Onboarding />}
    </div>
  );
}
