import { useSyncExternalStore } from 'react';
import { demoDoc, normalizeDoc, type Doc } from './model';
import { toast } from './ui';

export interface Selection {
  nodes: string[];
  edges: string[];
}
export interface View {
  x: number;
  y: number;
  zoom: number;
}
export interface Editing {
  kind: 'node' | 'edge';
  id: string;
}
export interface State {
  doc: Doc;
  sel: Selection;
  view: View;
  filePath: string | null;
  dirty: boolean;
  editing: Editing | null;
  canUndo: boolean;
  canRedo: boolean;
}

const AUTOSAVE_KEY = 'mlsketch:autosave';
const HISTORY_LIMIT = 200;
const COALESCE_MS = 1500;

function initialDoc(): Doc {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) return normalizeDoc(JSON.parse(saved));
  } catch {
    // autosave assente o corrotto: si riparte dall'esempio
  }
  return demoDoc();
}

let state: State = {
  doc: initialDoc(),
  sel: { nodes: [], edges: [] },
  view: { x: 40, y: 60, zoom: 1 },
  filePath: null,
  dirty: false,
  editing: null,
  canUndo: false,
  canRedo: false,
};

let past: Doc[] = [];
let future: Doc[] = [];
let lastKey: string | null = null;
let lastTime = 0;
const listeners = new Set<() => void>();

function set(p: Partial<State>) {
  const next = { ...state, ...p, canUndo: past.length > 0, canRedo: future.length > 0 };
  // un documento nuovo (annulla, modifica di un'altra persona, unione) può aver tolto elementi selezionati
  if (next.doc !== state.doc || next.sel !== state.sel) next.sel = pruneSel(next.sel, next.doc);
  if (next.editing && next.doc !== state.doc && !(next.editing.kind === 'node' ? next.doc.nodes : next.doc.edges).some((x) => x.id === next.editing!.id)) next.editing = null;
  state = next;
  listeners.forEach((l) => l());
}

export const getState = () => state;

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Il selettore deve restituire un riferimento stabile (un campo dello stato). */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/** Toglie dalla selezione gli elementi che non ci sono più; se non manca niente restituisce la stessa selezione. */
function pruneSel(sel: Selection, doc: Doc): Selection {
  if (!sel.nodes.length && !sel.edges.length) return sel;
  const n = new Set(doc.nodes.map((x) => x.id));
  const e = new Set(doc.edges.map((x) => x.id));
  if (sel.nodes.every((id) => n.has(id)) && sel.edges.every((id) => e.has(id))) return sel;
  return { nodes: sel.nodes.filter((id) => n.has(id)), edges: sel.edges.filter((id) => e.has(id)) };
}

/**
 * Sostituisce il documento. Con `history: false` (trascinamenti) non tocca la
 * cronologia: a fine gesto si chiama `pushHistory`. `coalesce` fonde in un solo
 * passo di undo le modifiche ravvicinate con la stessa chiave (es. digitazione).
 */
export function setDoc(doc: Doc, opts: { history?: boolean; coalesce?: string } = {}) {
  if (opts.history !== false) {
    const now = Date.now();
    const merge = !!opts.coalesce && opts.coalesce === lastKey && now - lastTime < COALESCE_MS;
    if (!merge) {
      past.push(state.doc);
      if (past.length > HISTORY_LIMIT) past.shift();
    }
    future = [];
    lastKey = opts.coalesce ?? null;
    lastTime = now;
  }
  set({ doc, dirty: true });
}

export function pushHistory(prev: Doc) {
  if (prev === state.doc) return;
  past.push(prev);
  if (past.length > HISTORY_LIMIT) past.shift();
  future = [];
  lastKey = null;
  set({});
}

export function undo() {
  const doc = past.pop();
  if (!doc) return;
  future.push(state.doc);
  lastKey = null;
  set({ doc, dirty: true, editing: null });
}

export function redo() {
  const doc = future.pop();
  if (!doc) return;
  past.push(state.doc);
  lastKey = null;
  set({ doc, dirty: true, editing: null });
}

let loads = 0;
/** Quante volte è stata aperta una figura nuova (non conta le modifiche): serve a chi lavora insieme. */
export const loadCount = () => loads;

export function loadDoc(doc: Doc, filePath: string | null) {
  loads++;
  past = [];
  future = [];
  lastKey = null;
  set({ doc, filePath, dirty: false, sel: { nodes: [], edges: [] }, editing: null });
}

export const setSel = (sel: Selection) => set({ sel });
export function setView(view: View) {
  // uno zoom calcolato su un foglio di misura zero darebbe NaN o Infinity e la vista sparirebbe
  if (Number.isFinite(view.x) && Number.isFinite(view.y) && Number.isFinite(view.zoom) && view.zoom > 0) set({ view });
}
export const setEditing = (editing: Editing | null) => set({ editing });
/** `doc` è la versione scritta: se nel frattempo il documento è cambiato resta da salvare. */
export const markSaved = (filePath: string | null, doc?: Doc) => set({ filePath, dirty: !!doc && doc !== state.doc });

let timer: ReturnType<typeof setTimeout> | undefined;
let autosaveWarned = false;
let savedDoc = state.doc;
subscribe(() => {
  if (state.doc === savedDoc) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    savedDoc = state.doc;
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedDoc));
      autosaveWarned = false;
    } catch {
      // storage pieno (immagini molto grandi) o non disponibile: si avvisa una volta sola
      if (!autosaveWarned) toast('Autosalvataggio non riuscito (documento grande): salva il file con ⌘S', 'info');
      autosaveWarned = true;
    }
  }, 400);
});
