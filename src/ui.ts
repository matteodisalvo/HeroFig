// Stato dell'interfaccia che non fa parte del documento: preferenze (export, tema,
// libreria), elementi recenti e preferiti, finestra delle scorciatoie, notifiche.
// Le preferenze sono ricordate fra le sessioni in localStorage.
import { useSyncExternalStore } from 'react';
import { keys } from './os';

export type Theme = 'system' | 'light' | 'dark';
export type LibraryTab = 'blocks' | 'templates';
/** Come si disegna la griglia del foglio: è un gusto di chi disegna, non fa parte della figura. */
export type GridStyle = 'lines' | 'cross' | 'dots';
/** Lavagna: griglia infinita per disegnare; Pagina: lo stesso disegno sulla pagina del paper. */
export type CanvasView = 'lavagna' | 'pagina';
/** Anteprima di stampa nella vista Pagina: solo sullo schermo, non tocca la figura né gli export. */
export type PaperPreview = 'colori' | 'grigi' | 'daltonici';
/** Chiave di un elemento della libreria: `p:<id>` per i blocchi, `t:<id>` per i modelli. */
export type LibraryKey = `p:${string}` | `t:${string}`;

export interface UiState {
  pngScale: number;
  selectionOnly: boolean;
  theme: Theme;
  libraryTab: LibraryTab;
  recent: LibraryKey[];
  favorites: LibraryKey[];
  hideLibrary: boolean;
  hideInspector: boolean;
  canvasView: CanvasView;
  gridStyle: GridStyle;
  shortcuts: boolean;
  about: boolean; // finestra «Informazioni»: autore e GitHub
  profile: boolean; // spazio personale; l'apertura non è una preferenza persistente
  starNudge: boolean; // invito a lasciare una stella alla repo
  commentMode: boolean; // il prossimo clic sul foglio appunta un commento
  commentFocus: string | null; // commento da aprire sul foglio (scelto dall'elenco di «Insieme»)
  paperPreview: PaperPreview;
  paperHighlight: boolean; // vista Pagina: contorna sulla pagina le scritte troppo piccole
  toast: { text: string; kind: 'ok' | 'info' } | null;
}

type Prefs = Pick<UiState, 'pngScale' | 'selectionOnly' | 'theme' | 'libraryTab' | 'recent' | 'favorites' | 'hideLibrary' | 'hideInspector' | 'canvasView' | 'gridStyle'>;

const PREFS_KEY = 'mlsketch:prefs';
const PERSISTED: (keyof Prefs)[] = ['pngScale', 'selectionOnly', 'theme', 'libraryTab', 'recent', 'favorites', 'hideLibrary', 'hideInspector', 'canvasView', 'gridStyle'];
const RECENT_MAX = 8;

const keyList = (v: unknown): LibraryKey[] =>
  Array.isArray(v) ? v.filter((k): k is LibraryKey => typeof k === 'string' && /^[pt]:/.test(k)) : [];

function loadPrefs(): Prefs {
  let p: Record<string, unknown> = {};
  try {
    p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') ?? {};
  } catch {
    // preferenze corrotte o storage assente: valori predefiniti
  }
  return {
    pngScale: [1, 2, 3, 4].includes(p.pngScale as number) ? (p.pngScale as number) : 3,
    selectionOnly: !!p.selectionOnly,
    theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'system',
    libraryTab: p.libraryTab === 'templates' ? 'templates' : 'blocks',
    recent: keyList(p.recent).slice(0, RECENT_MAX),
    favorites: keyList(p.favorites),
    hideLibrary: !!p.hideLibrary,
    hideInspector: !!p.hideInspector,
    canvasView: p.canvasView === 'pagina' ? 'pagina' : 'lavagna',
    gridStyle: p.gridStyle === 'dots' || p.gridStyle === 'cross' ? p.gridStyle : 'lines',
  };
}

let ui: UiState = { ...loadPrefs(), shortcuts: false, about: false, profile: false, starNudge: false, commentMode: false, commentFocus: null, paperPreview: 'colori', paperHighlight: false, toast: null };
const listeners = new Set<() => void>();

export const getUi = () => ui;

export function setUi(patch: Partial<UiState>) {
  ui = { ...ui, ...patch };
  if (PERSISTED.some((k) => k in patch)) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(Object.fromEntries(PERSISTED.map((k) => [k, ui[k]]))));
    } catch {
      // le preferenze sono una comodità: se lo storage non c'è si usano i valori predefiniti
    }
  }
  listeners.forEach((l) => l());
}

// stabile fra un render e l'altro: una funzione nuova a ogni render farebbe riscrivere l'iscrizione a React
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useUi<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(ui));
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** Messaggio temporaneo in basso: `info` per avvisi, `ok` per azioni riuscite. */
export function toast(text: string, kind: 'ok' | 'info' = 'ok') {
  clearTimeout(toastTimer);
  setUi({ toast: { text: keys(text), kind } });
  toastTimer = setTimeout(() => setUi({ toast: null }), kind === 'info' ? 3200 : 2400);
}

/** Ricorda un blocco o un modello appena inserito (sezione "Recenti" della libreria). */
export function noteRecent(key: LibraryKey) {
  setUi({ recent: [key, ...ui.recent.filter((k) => k !== key)].slice(0, RECENT_MAX) });
}

export function toggleFavorite(key: LibraryKey) {
  const on = ui.favorites.includes(key);
  setUi({ favorites: on ? ui.favorites.filter((k) => k !== key) : [...ui.favorites, key] });
}
