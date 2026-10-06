// Progetti: una cartella sul disco con le figure .hfig di un paper o di una tesi e un file
// progetto.tfproj (nome, scadenza, stato di ogni figura). L'elenco delle cartelle è una
// preferenza locale; tutto il resto sta nella cartella, così la si può condividere.
import { emptyDoc, normalizeDoc, type Doc } from './model';
import { projectRead, projectWriteFigure, projectWriteMeta, type ProjectFigureFile } from './platform';

type FigureStatus = 'bozza' | 'rivedere' | 'pronta';
export const STATUS_LABEL: Record<FigureStatus, string> = { bozza: 'Bozza', rivedere: 'Da rivedere', pronta: 'Pronta' };
const STATUS_ORDER: FigureStatus[] = ['bozza', 'rivedere', 'pronta'];
export const nextStatus = (s: FigureStatus) => STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];

export interface ProjectMeta {
  name: string;
  deadline: string; // AAAA-MM-GG, vuota se non c'è
  status: Record<string, FigureStatus>; // per nome di file
}

export interface ProjectFigure extends ProjectFigureFile {
  title: string; // nome senza estensione
  doc: Doc | null; // null se il file non è leggibile o è troppo grande
  status: FigureStatus;
}

export interface Project {
  dir: string;
  meta: ProjectMeta;
  figures: ProjectFigure[];
}

const DIRS_KEY = 'mlsketch:projects';

export const folderName = (dir: string) => dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;

// su Windows C:\Paper e c:/paper/ sono la stessa cartella (il percorso può arrivare dal dialogo, da Esplora risorse o dai recenti)
const pathKey = (p: string) => {
  const key = p.replace(/(.)[\\/]+$/, '$1');
  return /^[a-z]:|^\\\\|\\/i.test(p) ? key.replace(/\//g, '\\').toLowerCase() : key;
};
export const samePath = (a: string | null, b: string | null) => !!a && !!b && pathKey(a) === pathKey(b);

export function projectDirs(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(DIRS_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((d): d is string => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

export function saveProjectDirs(dirs: string[]) {
  try {
    localStorage.setItem(DIRS_KEY, JSON.stringify(dirs));
  } catch {
    // senza storage l'elenco vale solo per questa sessione
  }
}

/** Data AAAA-MM-GG che esiste davvero (non 2026-13-45). */
const isDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

// il contenuto letto di progetto.tfproj, per cartella: i campi scritti da una versione più nuova restano nel file
const rawMeta = new Map<string, Record<string, unknown>>();

function normalizeMeta(raw: unknown, dir: string): ProjectMeta {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Partial<ProjectMeta>;
  const status: Record<string, FigureStatus> = {};
  for (const [k, v] of Object.entries(r.status && typeof r.status === 'object' && !Array.isArray(r.status) ? r.status : {})) {
    if (STATUS_ORDER.includes(v as FigureStatus)) status[k] = v as FigureStatus;
  }
  return {
    name: typeof r.name === 'string' && r.name.trim() ? r.name : folderName(dir),
    deadline: isDate(r.deadline) ? r.deadline : '',
    status,
  };
}

/** Legge la cartella; null se non esiste più. */
export async function loadProject(dir: string): Promise<Project | null> {
  const folder = await projectRead(dir);
  if (!folder) return null;
  const meta = normalizeMeta(folder.meta, dir);
  if (folder.meta && typeof folder.meta === 'object' && !Array.isArray(folder.meta)) rawMeta.set(dir, folder.meta as Record<string, unknown>);
  const figures = folder.figures.map((f): ProjectFigure => {
    let doc: Doc | null = null;
    try {
      if (f.content) doc = normalizeDoc(JSON.parse(f.content));
    } catch {
      // file rovinato: resta in elenco senza anteprima
    }
    return { ...f, title: f.name.replace(/\.[^.]+$/, ''), doc, status: meta.status[f.name] ?? 'bozza' };
  });
  return { dir, meta, figures };
}

// una scrittura per volta per cartella: due clic veloci sullo stato non scrivono il file insieme
const writing = new Map<string, Promise<void>>();
export function saveMeta(dir: string, meta: ProjectMeta): Promise<void> {
  const next = (writing.get(dir) ?? Promise.resolve()).catch(() => {}).then(() => projectWriteMeta(dir, { ...rawMeta.get(dir), ...meta }));
  writing.set(dir, next);
  return next;
}

/** Nome di file sicuro a partire dal titolo scritto dall'utente. */
const fileNameFor = (title: string) => title.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/^\.+/, '') + '.hfig';

/** Crea una figura nella cartella: vuota, oppure con il documento passato. */
export function createFigure(dir: string, title: string, doc: Doc = emptyDoc()) {
  return projectWriteFigure(dir, fileNameFor(title), JSON.stringify(doc, null, 2));
}

/** Giorni alla scadenza (negativi se passata), null se non c'è. */
export function daysLeft(deadline: string): number | null {
  if (!isDate(deadline)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(deadline + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}
