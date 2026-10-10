// Accesso a file ed export: via Electron (window.api, vedi electron/preload.cjs)
// oppure con i ripieghi del browser quando l'app gira con `npm run dev:web`.

export interface OpenedFile {
  path: string | null;
  content: string;
}

export interface ProjectFigureFile {
  name: string; // nome del file, con estensione
  path: string;
  mtime: number;
  content: string | null; // null se il file è troppo grande per l'anteprima
}
export interface ProjectFolder {
  meta: unknown; // contenuto di progetto.tfproj, null se manca
  figures: ProjectFigureFile[];
}

/** Un'altra persona con una figura del progetto aperta. */
export interface Presence {
  name: string;
  figure: string; // nome del file
}

export interface ImageArgs {
  prompt: string;
  style: string; // vedi STYLES in electron/images.cjs
}

/** Il risultato è l'immagine (data URL) oppure un testo da tradurre con t(); `needsToken` chiede la chiave di Hugging Face. */
export interface ImageResult {
  src?: string;
  error?: string;
  detail?: string; // per «Generazione non riuscita: {detail}»
  needsToken?: boolean;
}

/** Da dove viene la chiave di Hugging Face: salvata nell'app, HF_TOKEN (o HUGGING_FACE_HUB_TOKEN) o «hf auth login»; null se manca. */
export type ImageKeySource = 'app' | 'env' | 'cli' | null;

/** La provenienza della chiave e, se viene dall'ambiente, il nome della variabile (mai la chiave). */
export interface ImageKeyInfo {
  source: ImageKeySource;
  variable?: string;
}

/** Dove il paper usa una figura: \includegraphics o \input in un file .tex. */
export interface PaperRef {
  file: string;
  line: number;
  command: string;
  target: string;
}

export interface PaperScan {
  ok: boolean;
  error?: string;
  root?: string;
  sub?: string; // sottocartella delle figure (figures, figs, images…)
  refs?: PaperRef[];
  family?: 'cvpr' | 'icml' | 'ieee' | 'neurips' | 'miccai' | null; // template riconosciuto dal preambolo
  span?: 'col' | 'full' | null; // figure o figure* intorno al primo uso
  cloud?: 'gdrive' | 'dropbox' | 'onedrive' | null; // cartella sincronizzata da un servizio cloud
  overleaf?: boolean; // copia Git di un progetto Overleaf: ogni salvataggio viene inviato
  texCount?: number; // file .tex trovati: 0 vuol dire cartella di scambio, non il paper
  pdfTime?: number; // ultima modifica del PDF nel paper (0 se non c'è)
  tfigTime?: number; // ultima modifica del .hfig
}

export interface PaperWrite {
  dir: string;
  base: string | null; // percorso del .hfig, per risolvere dir relativa
  name: string;
  svg: string;
  width: number;
  height: number;
  tex: string;
  side: { name: string; data: Uint8Array }[];
}

interface ElectronApi {
  openFile(): Promise<OpenedFile | null>;
  saveFile(args: { path: string | null; content: string; defaultName: string }): Promise<string | null>;
  saveExport(args: { defaultName: string; ext: string; data: string | Uint8Array }): Promise<string | null>;
  exportPdf(args: { defaultName: string; svg: string; width: number; height: number }): Promise<string | null>;
  onMenu(cb: (action: string) => void): () => void;
  setDirty(value: boolean): void;
  setLanguage?(args: { language: string; labels: Record<string, string> }): void;
  saveSideFiles(args: { nextTo: string; files: { name: string; data: Uint8Array }[] }): Promise<void>;
  closeWindow(): void;
  openExternal?(url: string): void;
  feedbackSubmit?(payload: Record<string, string>): Promise<{ ok: boolean; result: unknown }>;
  copyPng(png: Uint8Array): Promise<void>;
  copyText(text: string): Promise<void>;
  onOpenFile(cb: (file: OpenedFile) => void): () => void;
  projectPick?(): Promise<string | null>;
  projectRead?(args: { dir: string }): Promise<ProjectFolder | null>;
  projectWriteMeta?(args: { dir: string; meta: unknown }): Promise<void>;
  projectWriteFigure?(args: { dir: string; name: string; content: string }): Promise<{ path?: string; error?: string }>;
  readFile?(args: { path: string }): Promise<string>;
  watchFile?(args: { path: string | null }): void;
  onFileChanged?(cb: (file: { path: string; content: string }) => void): () => void;
  presenceSet?(args: { dir: string; id: string; name: string; figure: string | null }): Promise<void>;
  presenceList?(args: { dir: string; id: string }): Promise<Presence[]>;
  groupStatus?(): Promise<GroupHost | null>;
  groupCreate?(args: { name: string; openAtLogin: boolean }): Promise<GroupHost>;
  groupLogin?(on: boolean): Promise<void>;
  groupStop?(): Promise<void>;
  imageGenerate?(args: ImageArgs): Promise<ImageResult>;
  imageStop?(): void;
  imageTokenSource?(): Promise<ImageKeyInfo>;
  setImageToken?(token: string): Promise<{ ok?: boolean; error?: string }>;
  clearImageToken?(): Promise<{ ok?: boolean; error?: string }>;
  onImageStep?(cb: (text: string) => void): () => void;
  updateStatus?(): Promise<UpdateInfo | null>;
  updateInstall?(): Promise<{ ok?: boolean; file?: string; error?: string }>;
  updateStop?(): void;
  updateQuit?(): void;
  onUpdate?(cb: (state: UpdateState) => void): () => void;
  paperChoose?(args: { base: string | null }): Promise<{ dir: string; abs: string } | null>;
  paperScan?(args: { dir: string; base: string | null; name: string }): Promise<PaperScan>;
  paperWrite?(args: PaperWrite): Promise<{ ok: boolean; sub?: string; error?: string; pushed?: number; pushError?: string }>;
  paperDrive?(): Promise<{ dir: string; abs: string } | null>;
  overleafLink?(args: { url: string; token: string }): Promise<{ ok: boolean; dir?: string; id?: string; error?: string }>;
  overleafHasToken?(): Promise<boolean>;
  paperReveal?(args: { dir: string; base: string | null; name: string }): Promise<void>;
}

const api = (window as unknown as { api?: ElectronApi }).api;

export const isDesktop = !!api;

export function setAppLanguage(language: string, labels: Record<string, string>) {
  api?.setLanguage?.({ language, labels });
}

function download(name: string, data: string | Uint8Array, mime: string) {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openFile(): Promise<OpenedFile | null> {
  if (api) return api.openFile();
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.hfig,.tfig,.mlsketch,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { path: null, content: await file.text() } : null);
    };
    input.click();
  });
}

/** `ok` è false se l'utente annulla; `path` è null nel browser, dove si scarica una copia. */
export async function saveFile(
  content: string,
  path: string | null,
  defaultName: string,
): Promise<{ ok: boolean; path: string | null }> {
  if (api) {
    const saved = await api.saveFile({ path, content, defaultName });
    return { ok: !!saved, path: saved };
  }
  download(defaultName + '.hfig', content, 'application/json');
  return { ok: true, path: null };
}

const MIME: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', tex: 'text/x-tex' };

/** Restituisce il percorso del file salvato, `null` se l'utente annulla (nel browser: il nome scaricato). */
export async function saveExport(defaultName: string, ext: string, data: string | Uint8Array): Promise<string | null> {
  if (api) return api.saveExport({ defaultName, ext, data });
  download(`${defaultName}.${ext}`, data, MIME[ext] ?? 'application/octet-stream');
  return `${defaultName}.${ext}`;
}

export async function exportPdf(defaultName: string, svg: string, width: number, height: number): Promise<string | null> {
  if (api) return api.exportPdf({ defaultName, svg, width, height });
  // nel browser: finestra con pagina su misura, da salvare con "Stampa → PDF"
  const w = window.open('', '_blank');
  if (!w) return null;
  w.document.write(
    `<!doctype html><title>${defaultName}</title><style>@page{size:${width}px ${height}px;margin:0}html,body{margin:0}svg{display:block}</style>${svg}`,
  );
  w.document.close();
  w.focus();
  w.print();
  return null;
}

export function onMenu(cb: (action: string) => void): () => void {
  return api ? api.onMenu(cb) : () => {};
}

export function setDirty(value: boolean) {
  api?.setDirty(value);
}

export function closeWindow() {
  if (api) api.closeWindow();
  else window.close();
}

/** Apre un indirizzo nel browser predefinito (nell'app desktop non dentro la finestra). */
export function openExternal(url: string) {
  if (api?.openExternal) api.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}

export async function copyPng(png: Uint8Array) {
  if (api) return api.copyPng(png);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([png as BlobPart], { type: 'image/png' }) })]);
}

export async function copyText(text: string) {
  if (api) return api.copyText(text);
  await navigator.clipboard.writeText(text);
}

export function onOpenFile(cb: (file: OpenedFile) => void): () => void {
  return api ? api.onOpenFile(cb) : () => {};
}

/** Salva file aggiuntivi (le immagini del TikZ) nella stessa cartella di un export. */
export async function saveSideFiles(nextTo: string, files: { name: string; data: Uint8Array }[]) {
  if (api) return api.saveSideFiles({ nextTo, files });
  for (const f of files) download(f.name, f.data, f.name.endsWith('.png') ? 'image/png' : 'image/jpeg');
}

/** I progetti sono cartelle sul disco: esistono solo nell'app desktop. */
export const hasProjects = !!api?.projectRead;

export const projectPick = () => api?.projectPick?.() ?? Promise.resolve(null);
export const projectRead = (dir: string) => api?.projectRead?.({ dir }) ?? Promise.resolve(null);
export const projectWriteMeta = (dir: string, meta: unknown) => api?.projectWriteMeta?.({ dir, meta }) ?? Promise.resolve();
export const projectWriteFigure = (dir: string, name: string, content: string): Promise<{ path?: string; error?: string }> =>
  api?.projectWriteFigure?.({ dir, name, content }) ?? Promise.resolve({ error: "Disponibile solo nell'app da installare (Mac o Windows)." });
export const readFile = (path: string) => api?.readFile?.({ path }) ?? Promise.reject(new Error("Disponibile solo nell'app da installare (Mac o Windows)."));

/** Osserva la figura aperta: in una cartella condivisa può cambiarla un'altra persona. */
export const watchFile = (path: string | null) => api?.watchFile?.({ path });
export const onFileChanged = (cb: (file: { path: string; content: string }) => void): (() => void) => api?.onFileChanged?.(cb) ?? (() => {});
export const presenceSet = (dir: string, id: string, name: string, figure: string | null) =>
  api?.presenceSet?.({ dir, id, name, figure }) ?? Promise.resolve();
export const presenceList = (dir: string, id: string): Promise<Presence[]> => api?.presenceList?.({ dir, id }) ?? Promise.resolve([]);

/** Il server del gruppo che gira su questo computer: `invite` va ai colleghi, `local` serve a noi. */
export interface GroupHost {
  name: string;
  invite: string;
  local: string;
  openAtLogin: boolean;
}

/** Ospitare il server del gruppo richiede l'app desktop; per collegarsi basta l'invito. */
export const canHostGroup = !!api?.groupCreate;
export const groupStatus = (): Promise<GroupHost | null> => api?.groupStatus?.() ?? Promise.resolve(null);
export const groupCreate = (args: { name: string; openAtLogin: boolean }): Promise<GroupHost> =>
  api?.groupCreate?.(args) ?? Promise.reject(new Error("Disponibile solo nell'app da installare (Mac o Windows)."));
export const groupLogin = (on: boolean) => api?.groupLogin?.(on) ?? Promise.resolve();
export const groupStop = () => api?.groupStop?.() ?? Promise.resolve();

/** Le immagini illustrative le genera FLUX su Hugging Face: serve l'app desktop, che custodisce la chiave dell'utente. */
/** Una versione più nuova pubblicata su GitHub (electron/update.cjs). */
export interface UpdateInfo {
  version: string;
  notes: string;
  page: string; // la pagina della release, con le novità
  canInstall: boolean; // c'è il file per questo computer, con la sua impronta
  platform: string;
}
export type UpdateState = ({ kind: 'available' } & UpdateInfo) | { kind: 'progress'; done: number; total: number };

export const hasUpdates = !!api?.updateStatus;
export const updateStatus = (): Promise<UpdateInfo | null> => api?.updateStatus?.() ?? Promise.resolve(null);
export const updateInstall = () => api?.updateInstall?.() ?? Promise.resolve({ error: 'Disponibile solo nell’app installata.' });
export const updateStop = () => api?.updateStop?.();
export const updateQuit = () => api?.updateQuit?.();
export const onUpdate = (cb: (state: UpdateState) => void) => api?.onUpdate?.(cb) ?? (() => {});

export const hasImageGen = !!api?.imageGenerate;
export const imageGenerate = (args: ImageArgs): Promise<ImageResult> =>
  api?.imageGenerate?.(args) ?? Promise.resolve({ error: "Disponibile solo nell'app da installare (Mac o Windows)." });
export const imageStop = () => api?.imageStop?.();
export const onImageStep = (cb: (text: string) => void): (() => void) => api?.onImageStep?.(cb) ?? (() => {});
/** Solo da dove viene la chiave: la chiave resta nel processo principale. */
export const imageTokenSource = (): Promise<ImageKeyInfo> =>
  api?.imageTokenSource?.().then((r) => ({ source: r?.source ?? null, variable: r?.variable })) ?? Promise.resolve({ source: null });
export const setImageToken = (token: string): Promise<{ ok?: boolean; error?: string }> =>
  api?.setImageToken?.(token) ?? Promise.resolve({ error: "Disponibile solo nell'app da installare (Mac o Windows)." });
export const clearImageToken = (): Promise<{ ok?: boolean; error?: string }> => api?.clearImageToken?.() ?? Promise.resolve({ ok: true });

/** Figura collegata al paper: solo nell'app desktop, che può scrivere nella cartella del paper. */
export const hasPaperSync = !!api?.paperChoose;

export const paperChoose = (base: string | null) => api?.paperChoose?.({ base }) ?? Promise.resolve(null);
export const paperScan = (dir: string, base: string | null, name: string): Promise<PaperScan> =>
  api?.paperScan?.({ dir, base, name }) ?? Promise.resolve({ ok: false, error: "Disponibile solo nell'app da installare (Mac o Windows)." });
export const paperWrite = (args: PaperWrite) =>
  api?.paperWrite?.(args) ?? Promise.resolve({ ok: false, error: "Disponibile solo nell'app da installare (Mac o Windows)." });
export const paperDrive = () => api?.paperDrive?.() ?? Promise.resolve(null);
export const paperReveal = (dir: string, base: string | null, name: string) => api?.paperReveal?.({ dir, base, name }) ?? Promise.resolve();
export const overleafLink = (url: string, token: string) =>
  api?.overleafLink?.({ url, token }) ?? Promise.resolve({ ok: false, error: "Disponibile solo nell'app da installare (Mac o Windows)." });
export const overleafHasToken = () => api?.overleafHasToken?.() ?? Promise.resolve(false);
