import { registeredPresets } from './registry';
export type BuiltinShape =
  | 'rect'
  | 'line'
  | 'pill'
  | 'ellipse'
  | 'diamond'
  | 'hexagon'
  | 'parallelogram'
  | 'triangle'
  | 'blockarrow'
  | 'trapezoid'
  | 'stack'
  | 'cuboid'
  | 'cylinder'
  | 'cells'
  | 'grid'
  | 'heatmap'
  | 'patches'
  | 'image'
  | 'document'
  | 'waveform'
  | 'neurons'
  | 'mlp'
  | 'graph'
  | 'plot'
  | 'barchart'
  | 'brace'
  | 'snowflake'
  | 'flame'
  | 'unet'
  | 'cnn'
  | 'pyramid'
  | 'rnn'
  | 'bipartite'
  | 'bottleneck'
  | 'tree'
  | 'kernel'
  | 'rgb'
  | 'frames'
  | 'mask'
  | 'detection'
  | 'diffchain'
  | 'dice'
  | 'clock'
  | 'scatter'
  | 'confmat'
  | 'posenc'
  | 'cycle'
  | 'stopgrad'
  | 'check'
  | 'xmark'
  | 'lock'
  | 'gear'
  | 'cloud'
  | 'user'
  | 'robot'
  | 'bubble'
  | 'magnifier'
  | 'scan'
  | 'photo'
  | 'he'
  | 'autofluo'
  | 'mpm'
  | 'ihc'
  | 'fluor'
  | 'wsi'
  | 'ct'
  | 'mri'
  | 'xray'
  | 'us'
  | 'fundus'
  | 'oct'
  | 'derm'
  | 'ecg'
  | 'dna'
  | 'microscope'
  | 'brain'
  | 'lungs'
  | 'heart'
  | 'cell'
  | 'text'
  | 'group';
/** Le forme dei moduli di dominio (src/domains) sono stringhe registrate a runtime. */
export type ShapeKind = BuiltinShape | (string & {});
/** Ruolo di un blocco nella pipeline; '' = nessuno (colori scelti a mano). */
export type Role = '' | 'data' | 'encoder' | 'latent' | 'attention' | 'block' | 'decoder' | 'head' | 'loss';
export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Routing = 'ortho' | 'straight' | 'curve';
export type LabelPos = 'center' | 'above' | 'below';
export type EdgeLabelPos = 'center' | 'above' | 'below';
export type FontFamily = 'sans' | 'serif' | 'mono';

export interface NodeModel {
  id: string;
  shape: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sublabel: string; // seconda riga più piccola sotto l'etichetta (es. ℰ + "Encoder")
  subSize: number;
  fill: string; // '#rrggbb' oppure 'none'
  stroke: string; // '#rrggbb' oppure 'none'
  strokeWidth: number;
  dashed: boolean;
  radius: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  textColor: string;
  labelPos: LabelPos;
  align: 'center' | 'left' | 'right';
  direction: Side; // trapezoid: lato stretto; triangle/blockarrow/brace: verso della punta
  count: number; // stack: fogli; cells/neurons/barchart: elementi
  spec: string; // mlp: "3,4,2"; grid/heatmap/patches: "4x4"; plot: nome della funzione
  depth: number; // cuboid: profondità come frazione del lato minore
  container: boolean; // racchiude altri blocchi: sta sullo sfondo e li trascina con sé
  src: string; // immagine importata (data URL), solo per la forma 'photo'
  srcRatio: number; // larghezza / altezza dell'immagine originale
  ai: string; // descrizione usata per generare l'immagine con l'IA; vuota se è un file dell'utente
  role: Role; // cosa rappresenta nel modello: con un tema ne decide i colori (vedi themes.ts)
  rotation?: number; // gradi in senso orario attorno al centro, fra -180 e 180; assente = non ruotato
}

export interface EdgeEnd {
  node: string;
  side: Side | 'auto';
}

export interface EdgeModel {
  id: string;
  from: EdgeEnd;
  to: EdgeEnd;
  routing: Routing;
  dashed: boolean;
  arrowStart: boolean;
  arrowEnd: boolean;
  color: string;
  width: number;
  label: string;
  labelPos: EdgeLabelPos;
  offset: number; // spostamento del tratto centrale nei percorsi ortogonali
  fontSize: number;
}

export interface Settings {
  fontFamily: FontFamily;
  grid: boolean;
  snap: boolean;
  background: 'transparent' | 'white';
  venue: string; // vista Pagina: formato della rivista (vedi paper.ts)
  caption: string; // vista Pagina: didascalia mostrata sotto la figura
  theme: string; // tema dei colori per ruolo ('' = colori scelti a mano)
  paperDir: string; // cartella del paper collegata, relativa al .hfig se possibile ('' = nessuna)
  paperName: string; // nome dei file scritti nel paper ('' = nome del .hfig)
}

/** Commento appuntato sul foglio (relatore, coautori): resta nel file, non finisce negli export. */
export interface Comment {
  id: string;
  x: number;
  y: number;
  author: string;
  text: string;
  time: number; // ms
  done: boolean;
}

export interface Doc {
  version: 1;
  nodes: NodeModel[];
  edges: EdgeModel[];
  settings: Settings;
  comments?: Comment[];
}

export const GRID = 10;
export const LINE_H = 1.25;

export const FONT_CSS: Record<FontFamily, string> = {
  sans: 'Helvetica, Arial, sans-serif',
  serif: "'Times New Roman', Times, serif",
  mono: 'Menlo, Consolas, monospace',
};

export const SHAPE_NAMES: Record<BuiltinShape, string> = {
  rect: 'Rettangolo',
  line: 'Linea',
  pill: 'Pillola',
  ellipse: 'Ellisse',
  diamond: 'Rombo',
  hexagon: 'Esagono',
  parallelogram: 'Parallelogramma',
  triangle: 'Triangolo',
  blockarrow: 'Freccia piena',
  trapezoid: 'Trapezio',
  stack: 'Pila (feature maps)',
  cuboid: 'Cuboide (tensore)',
  cylinder: 'Cilindro',
  cells: 'Celle (sequenza)',
  grid: 'Matrice',
  heatmap: 'Heatmap',
  patches: 'Patch',
  image: 'Immagine',
  document: 'Documento',
  waveform: 'Forma d\'onda',
  neurons: 'Strato di neuroni',
  mlp: 'Rete fully-connected',
  graph: 'Grafo',
  plot: 'Grafico di funzione',
  barchart: 'Istogramma',
  brace: 'Graffa',
  snowflake: 'Fiocco (congelato)',
  flame: 'Fiamma (addestrabile)',
  unet: 'U-Net',
  cnn: 'CNN (stadi)',
  pyramid: 'Piramide di feature',
  rnn: 'RNN srotolata',
  bipartite: 'Legami di attention',
  bottleneck: 'Collo di bottiglia',
  tree: 'Albero',
  kernel: 'Kernel su griglia',
  rgb: 'Canali RGB',
  frames: 'Fotogrammi video',
  mask: 'Maschera',
  detection: 'Rilevamento oggetti',
  diffchain: 'Catena di diffusione',
  dice: 'Dado (campionamento)',
  clock: 'Orologio (timestep)',
  scatter: 'Scatter (spazio latente)',
  confmat: 'Matrice di confusione',
  posenc: 'Positional encoding',
  cycle: 'Ciclo',
  stopgrad: 'Stop-gradient',
  check: 'Spunta',
  xmark: 'Croce',
  lock: 'Lucchetto',
  gear: 'Ingranaggio',
  cloud: 'Nuvola',
  user: 'Utente',
  robot: 'Agente/robot',
  bubble: 'Fumetto (prompt)',
  magnifier: 'Lente (retrieval)',
  scan: 'Scansione medica (schematica)',
  photo: 'Immagine importata',
  he: 'Istologia H&E',
  autofluo: 'Autofluorescenza',
  mpm: 'Multifotone (SHG/TPEF)',
  ihc: 'Immunoistochimica (IHC)',
  fluor: 'Fluorescenza (DAPI)',
  wsi: 'Whole-slide image',
  ct: 'TC assiale (torace)',
  mri: 'RM encefalo',
  xray: 'Radiografia torace',
  us: 'Ecografia',
  fundus: 'Fondo oculare',
  oct: 'OCT retina',
  derm: 'Dermatoscopia',
  ecg: 'ECG',
  dna: 'DNA',
  microscope: 'Microscopio',
  brain: 'Cervello (icona)',
  lungs: 'Polmoni (icona)',
  heart: 'Cuore (icona)',
  cell: 'Cellula',
  text: 'Testo',
  group: 'Gruppo',
};

export const PLOT_NAMES: Record<string, string> = {
  relu: 'ReLU',
  sigmoid: 'Sigmoide',
  tanh: 'Tanh',
  gauss: 'Gaussiana',
  step: 'Gradino',
  sine: 'Seno',
  linear: 'Lineare',
  loss: 'Curva di loss',
  cosine: 'Cosine decay',
  warmup: 'Warmup + cosine',
};

// Coppie riempimento/bordo pastello, lo stile tipico delle figure da paper.
export const SWATCHES = [
  { name: 'Blu', fill: '#DAE8FC', stroke: '#6C8EBF' },
  { name: 'Verde', fill: '#D5E8D4', stroke: '#82B366' },
  { name: 'Arancio', fill: '#FFE6CC', stroke: '#D79B00' },
  { name: 'Giallo', fill: '#FFF2CC', stroke: '#D6B656' },
  { name: 'Rosso', fill: '#F8CECC', stroke: '#B85450' },
  { name: 'Viola', fill: '#E1D5E7', stroke: '#9673A6' },
  { name: 'Turchese', fill: '#D0ECE7', stroke: '#45A29E' },
  { name: 'Grigio', fill: '#F5F5F5', stroke: '#666666' },
  { name: 'Bianco', fill: '#FFFFFF', stroke: '#333333' },
] as const;

const sw = (i: number) => ({ fill: SWATCHES[i].fill, stroke: SWATCHES[i].stroke });
const [BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE] = SWATCHES.map((_, i) => sw(i));
export const COLORS = { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE };

/** Gruppi e blocchi-contenitore: disegnati sullo sfondo, afferrabili dal bordo. */
export const isContainer = (n: NodeModel) => n.shape === 'group' || n.container;

export function uid(prefix = 'n'): string {
  return prefix + Math.random().toString(36).slice(2, 10);
}

export function makeNode(p: Partial<NodeModel> = {}): NodeModel {
  return {
    id: uid('n'),
    shape: 'rect',
    x: 0,
    y: 0,
    w: 120,
    h: 50,
    label: '',
    sublabel: '',
    subSize: 11,
    fill: '#FFFFFF',
    stroke: '#333333',
    strokeWidth: 1.5,
    dashed: false,
    radius: 6,
    fontSize: 14,
    bold: false,
    italic: false,
    textColor: '#1A1A1A',
    labelPos: 'center',
    align: 'center',
    direction: 'right',
    count: 3,
    spec: '',
    depth: 0.25,
    container: false,
    src: '',
    srcRatio: 0,
    ai: '',
    role: '',
    ...p,
  };
}

export function makeEdge(from: EdgeEnd, to: EdgeEnd, p: Partial<EdgeModel> = {}): EdgeModel {
  return {
    id: uid('e'),
    from,
    to,
    routing: 'ortho',
    dashed: false,
    arrowStart: false,
    arrowEnd: true,
    color: '#333333',
    width: 1.5,
    label: '',
    labelPos: 'center',
    offset: 0,
    fontSize: 12,
    ...p,
  };
}

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: 'sans',
  grid: true,
  snap: true,
  background: 'transparent',
  venue: 'cvpr-full',
  caption: '',
  theme: '',
  paperDir: '',
  paperName: '',
};

export function emptyDoc(): Doc {
  return { version: 1, nodes: [], edges: [], settings: { ...DEFAULT_SETTINGS } };
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];
const ROLES: readonly Role[] = ['', 'data', 'encoder', 'latent', 'attention', 'block', 'decoder', 'head', 'loss'];
const oneOf = <T>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
/** Identificativo come stringa: i file scritti a mano possono usare numeri. */
const idOf = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

/**
 * Tiene i campi del tipo giusto (numeri finiti; "12" e 12 si convertono fra numero e testo) e rimette
 * il valore predefinito agli altri, nello stesso ordine di `defaults`; i campi sconosciuti (scritti da
 * una versione più nuova) restano com'erano.
 */
function typed<T extends object>(raw: Rec, defaults: T): T {
  const out = { ...defaults } as Rec;
  for (const [k, v] of Object.entries(raw)) {
    const d = (defaults as Rec)[k];
    if (k === '__proto__') continue;
    if (d === undefined) out[k] = v;
    else if (typeof d === 'number') {
      const x = typeof v === 'string' && v.trim() ? Number(v) : v;
      if (typeof x === 'number' && Number.isFinite(x)) out[k] = x;
    } else if (typeof d === 'string') {
      const s = idOf(v);
      if (typeof v === 'string' || s) out[k] = s;
    } else if (typeof v === typeof d && v !== null) out[k] = v;
  }
  return out as T;
}

/** Restituisce `id` se è libero, altrimenti uno nuovo (file con identificativi ripetuti). */
function freshId(id: string, used: Set<string>, prefix: string): string {
  let out = id;
  while (!out || used.has(out)) out = uid(prefix);
  used.add(out);
  return out;
}

function normalizeEnd(raw: unknown): EdgeEnd {
  // i file scritti a mano possono indicare solo il blocco ("from": "n1")
  const r = isRec(raw) ? raw : { node: raw };
  return { node: idOf(r.node), side: oneOf<Side | 'auto'>(r.side, [...SIDES, 'auto'], 'auto') };
}

/** Una rotazione in gradi riportata fra -180 e 180 (un decimo di grado al più); 0 se non è un numero. */
export function normalRotation(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  const r = Math.round((((v % 360) + 540) % 360 - 180) * 10) / 10;
  return r === -180 ? 180 : r === 0 ? 0 : r;
}

/**
 * Valida un documento letto da file/clipboard e riempie i campi mancanti, così anche i file delle versioni
 * precedenti (.tfig, .mlsketch) o rovinati si aprono senza bloccare il disegno.
 */
export function normalizeDoc(raw: unknown): Doc {
  const r = raw as { nodes?: unknown; edges?: unknown; settings?: unknown; comments?: unknown } | null;
  if (!r || typeof r !== 'object' || !Array.isArray(r.nodes) || !Array.isArray(r.edges)) {
    throw new Error('File non valido: non è un documento HeroFig.');
  }
  const nodeDefaults = makeNode({ id: '' });
  const usedNodes = new Set<string>();
  const nodes = r.nodes.filter(isRec).map((n): NodeModel => {
    const { rotation: _rotation, ...node } = typed(n, nodeDefaults);
    const rotation = normalRotation(n.rotation);
    return {
      ...node,
      id: freshId(node.id, usedNodes, 'n'),
      w: Math.max(0, node.w),
      h: Math.max(0, node.h),
      labelPos: oneOf(node.labelPos, ['center', 'above', 'below'], 'center'),
      align: oneOf(node.align, ['center', 'left', 'right'], 'center'),
      direction: oneOf(node.direction, SIDES, 'right'),
      role: oneOf(node.role, ROLES, ''),
      ...(rotation ? { rotation } : {}),
    };
  });
  const edgeDefaults = makeEdge({ node: '', side: 'auto' }, { node: '', side: 'auto' }, { id: '' });
  const usedEdges = new Set<string>();
  const edges = r.edges
    .filter(isRec)
    .map((e): EdgeModel => {
      const edge = typed({ ...e, from: null, to: null }, edgeDefaults);
      return {
        ...edge,
        from: normalizeEnd(e.from),
        to: normalizeEnd(e.to),
        routing: oneOf(edge.routing, ['ortho', 'straight', 'curve'], 'ortho'),
        labelPos: oneOf(edge.labelPos, ['center', 'above', 'below'], 'center'),
      };
    })
    .filter((e) => usedNodes.has(e.from.node) && usedNodes.has(e.to.node))
    .map((e) => ({ ...e, id: freshId(e.id, usedEdges, 'e') }));
  const settings = typed(isRec(r.settings) ? r.settings : {}, DEFAULT_SETTINGS);
  settings.fontFamily = oneOf(settings.fontFamily, Object.keys(FONT_CSS) as FontFamily[], 'sans');
  settings.background = oneOf(settings.background, ['transparent', 'white'], 'transparent');
  const usedComments = new Set<string>();
  const comments = (Array.isArray(r.comments) ? r.comments : [])
    .filter((c): c is Comment => !!c && typeof c === 'object' && Number.isFinite(c.x) && Number.isFinite(c.y) && typeof c.text === 'string')
    .map((c, i) => ({
      id: freshId(String(c.id ?? `c${i}`), usedComments, 'c'),
      x: c.x,
      y: c.y,
      author: String(c.author ?? ''),
      text: c.text,
      time: Number(c.time) || 0,
      done: !!c.done,
    }));
  return { version: 1, nodes, edges, settings, ...(comments.length ? { comments } : {}) };
}

export interface Preset {
  id: string;
  name: string;
  category: string;
  node: Partial<NodeModel>;
}

export const ICON = { labelPos: 'below' as const, fontSize: 12 };
/** Immagine da paper: passe-partout bianco, cornice grigia, titolo in grassetto sopra. */
export const MED_IMG = {
  w: 90,
  h: 90,
  radius: 2,
  fill: '#FFFFFF',
  stroke: '#C9CED6',
  strokeWidth: 1,
  labelPos: 'above' as const,
  fontSize: 11,
  bold: true,
};

/** Encoder/decoder nello stile delle figure recenti: trapezio arrotondato, simbolo calligrafico e nome. */
export const ENC_STYLE = {
  shape: 'trapezoid' as const,
  direction: 'right' as const,
  w: 120,
  h: 140,
  radius: 12,
  fill: '#E5F2EC',
  stroke: '#6E9E8B',
  strokeWidth: 1.5,
  fontSize: 27,
  textColor: '#2F5246',
  subSize: 11,
};
export const DEC_STYLE = { ...ENC_STYLE, direction: 'left' as const, fill: '#EEEAF7', stroke: '#8E7DB6', textColor: '#4A3D6B' };

export const GROUP_STYLE = {
  shape: 'group' as const,
  fill: 'none',
  stroke: '#888888',
  dashed: true,
  radius: 10,
  strokeWidth: 1.2,
  fontSize: 12,
  textColor: '#555555',
};

export const PRESETS: Preset[] = [
  // Forme base
  { id: 'rect', name: 'Rettangolo', category: 'Forme base', node: { ...WHITE } },
  { id: 'pill', name: 'Pillola', category: 'Forme base', node: { shape: 'pill', h: 40, ...BLUE } },
  { id: 'circle', name: 'Cerchio', category: 'Forme base', node: { shape: 'ellipse', w: 60, h: 60, ...GREEN } },
  { id: 'cond', name: 'Rombo', category: 'Forme base', node: { shape: 'diamond', w: 70, h: 70, ...YELLOW } },
  { id: 'hexagon', name: 'Esagono', category: 'Forme base', node: { shape: 'hexagon', w: 100, h: 60, ...PURPLE } },
  { id: 'para', name: 'Parallelogr.', category: 'Forme base', node: { shape: 'parallelogram', w: 110, h: 50, ...TEAL } },
  { id: 'triangle', name: 'Triangolo', category: 'Forme base', node: { shape: 'triangle', w: 60, h: 70, ...ORANGE } },
  { id: 'blockarrow', name: 'Freccia', category: 'Forme base', node: { shape: 'blockarrow', w: 90, h: 44, ...GRAY } },
  // una linea semplice: il riquadro serve solo a prenderla; la si gira con la maniglia di rotazione
  { id: 'line', name: 'Linea', category: 'Forme base', node: { shape: 'line', w: 140, h: 20, fill: 'none', stroke: '#333333', strokeWidth: 2, labelPos: 'above' } },
  // Dati
  { id: 'image', name: 'Immagine', category: 'Dati', node: { shape: 'image', label: 'Input', w: 80, h: 70, radius: 4, ...ICON, ...BLUE } },
  { id: 'patches', name: 'Patch', category: 'Dati', node: { shape: 'patches', label: 'Patch', w: 76, h: 76, spec: '3x3', ...ICON, ...BLUE } },
  {
    id: 'tensor',
    name: 'Tensore',
    category: 'Dati',
    node: { shape: 'cuboid', label: '$H \\times W \\times C$', w: 70, h: 80, ...ICON, ...BLUE },
  },
  {
    id: 'slab',
    name: 'Volume conv',
    category: 'Dati',
    node: { shape: 'cuboid', label: 'conv', w: 44, h: 110, depth: 0.6, ...ICON, ...ORANGE },
  },
  { id: 'fmaps', name: 'Feature maps', category: 'Dati', node: { shape: 'stack', label: 'Feature maps', w: 80, h: 80, count: 3, ...ICON, ...ORANGE } },
  { id: 'tokens', name: 'Token', category: 'Dati', node: { shape: 'cells', w: 150, h: 30, count: 5, radius: 3, ...YELLOW } },
  { id: 'vector', name: 'Vettore', category: 'Dati', node: { shape: 'cells', w: 26, h: 120, count: 5, radius: 3, ...GREEN } },
  { id: 'matrix', name: 'Matrice', category: 'Dati', node: { shape: 'grid', w: 80, h: 80, spec: '4x4', radius: 0, ...ICON, ...PURPLE } },
  { id: 'heatmap', name: 'Attention map', category: 'Dati', node: { shape: 'heatmap', label: 'Attention', w: 80, h: 80, spec: '6x6', ...ICON, ...RED } },
  { id: 'noise', name: 'Rumore', category: 'Dati', node: { shape: 'heatmap', label: '$\\epsilon \\sim N(0, I)$', w: 70, h: 70, spec: '10x10', ...ICON, ...GRAY } },
  { id: 'doc', name: 'Testo/doc', category: 'Dati', node: { shape: 'document', label: 'Testo', w: 60, h: 76, ...ICON, ...WHITE } },
  { id: 'audio', name: 'Audio', category: 'Dati', node: { shape: 'waveform', label: 'Audio', w: 110, h: 50, fill: 'none', stroke: '#6C8EBF', ...ICON } },
  { id: 'dataset', name: 'Dataset', category: 'Dati', node: { shape: 'cylinder', label: 'Dataset', w: 90, h: 70, ...GRAY } },
  // Reti
  { id: 'neurons', name: 'Strato', category: 'Reti', node: { shape: 'neurons', w: 30, h: 130, count: 4, ...ICON, ...BLUE } },
  { id: 'mlp', name: 'MLP', category: 'Reti', node: { shape: 'mlp', label: 'MLP', w: 150, h: 120, spec: '3,5,5,2', strokeWidth: 1.2, ...ICON, ...GREEN } },
  { id: 'graph', name: 'Grafo', category: 'Reti', node: { shape: 'graph', label: 'Grafo', w: 100, h: 90, strokeWidth: 1.2, ...ICON, ...PURPLE } },
  { id: 'encoder', name: 'Encoder', category: 'Reti', node: { ...ENC_STYLE, label: '$\\mathcal{E}$', sublabel: 'Encoder' } },
  { id: 'decoder', name: 'Decoder', category: 'Reti', node: { ...DEC_STYLE, label: '$\\mathcal{D}$', sublabel: 'Decoder' } },
  {
    id: 'latentcode',
    name: 'Descrittore',
    category: 'Reti',
    node: { label: '$f$', sublabel: 'Image descriptor', w: 96, h: 62, radius: 8, fill: '#F8F3E4', stroke: '#CDBD94', fontSize: 20, subSize: 10, textColor: '#5A4A22' },
  },
  {
    id: 'losspaper',
    name: 'Loss (formula)',
    category: 'Reti',
    node: {
      label: 'Pixel-level loss',
      sublabel: '$\\mathcal{L}_{\\mathrm{MAE}} = \\mathrm{MAE}(Y, Y^*)$',
      w: 180,
      h: 70,
      radius: 10,
      fill: '#FAFAFB',
      stroke: '#B8BEC8',
      fontSize: 11,
      bold: true,
      subSize: 14,
    },
  },
  {
    id: 'encbox',
    name: 'Encoder (contenitore)',
    category: 'Reti',
    node: { ...ENC_STYLE, container: true, label: 'Encoder', bold: true, fontSize: 13, radius: 16, w: 280, h: 200, fill: '#F1F8F5' },
  },
  {
    id: 'decbox',
    name: 'Decoder (contenitore)',
    category: 'Reti',
    node: { ...DEC_STYLE, container: true, label: 'Decoder', bold: true, fontSize: 13, radius: 16, w: 280, h: 200, fill: '#F5F2FA' },
  },
  { id: 'backbone', name: 'Backbone', category: 'Reti', node: { label: 'Backbone', w: 130, h: 70, ...PURPLE } },
  { id: 'head', name: 'Head', category: 'Reti', node: { label: 'MLP\nHead', w: 90, h: 56, ...TEAL } },
  { id: 'unet', name: 'U-Net', category: 'Reti', node: { shape: 'unet', label: 'U-Net', w: 150, h: 100, count: 3, strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'cnn', name: 'CNN', category: 'Reti', node: { shape: 'cnn', label: 'CNN', w: 190, h: 90, count: 3, strokeWidth: 1.2, ...ICON, ...ORANGE } },
  { id: 'pyramid', name: 'FPN', category: 'Reti', node: { shape: 'pyramid', label: 'Feature pyramid', w: 120, h: 90, count: 3, ...ICON, ...PURPLE } },
  { id: 'rnnun', name: 'RNN', category: 'Reti', node: { shape: 'rnn', label: 'RNN', w: 170, h: 100, count: 3, ...ICON, ...TEAL } },
  { id: 'autoenc', name: 'Autoencoder', category: 'Reti', node: { shape: 'bottleneck', w: 150, h: 90, ...ICON, ...BLUE } },
  { id: 'lora', name: 'LoRA', category: 'Reti', node: { shape: 'bottleneck', direction: 'bottom', label: 'LoRA', w: 60, h: 80, ...ICON, ...ORANGE } },
  { id: 'attnlinks', name: 'Attention', category: 'Reti', node: { shape: 'bipartite', w: 150, h: 90, count: 5, strokeWidth: 1.2, ...ICON, ...YELLOW } },
  { id: 'tree', name: 'Albero', category: 'Reti', node: { shape: 'tree', w: 120, h: 90, count: 3, strokeWidth: 1.2, ...ICON, ...GREEN } },
  { id: 'posenc', name: 'Pos. enc.', category: 'Reti', node: { shape: 'posenc', w: 34, h: 34, ...ICON, ...WHITE } },
  // Visione
  { id: 'rgb', name: 'RGB', category: 'Visione', node: { shape: 'rgb', label: 'RGB', w: 80, h: 80, ...ICON } },
  { id: 'kernel', name: 'Kernel', category: 'Visione', node: { shape: 'kernel', label: '$3 \\times 3$ conv', w: 80, h: 80, spec: '5x5', count: 3, ...ICON, ...BLUE } },
  { id: 'frames', name: 'Video', category: 'Visione', node: { shape: 'frames', label: 'Video', w: 86, h: 76, ...ICON, ...BLUE } },
  { id: 'mask', name: 'Maschera', category: 'Visione', node: { shape: 'mask', label: 'Maschera', w: 76, h: 70, radius: 4, ...ICON, ...GRAY } },
  { id: 'detection', name: 'Detection', category: 'Visione', node: { shape: 'detection', label: 'Detection', w: 90, h: 76, radius: 4, ...ICON, ...BLUE } },
  {
    id: 'photo',
    name: 'Tua immagine',
    category: 'Dati',
    node: { shape: 'photo', label: 'Image', ...MED_IMG, w: 120, h: 90 },
  },
  // Imaging medico: immagini in cornice, titolo sopra come nelle figure dei paper
  { id: 'he', name: 'H&E', category: 'Imaging medico', node: { shape: 'he', label: 'H&E', ...MED_IMG } },
  { id: 'autofluo', name: 'Autofluorescenza', category: 'Imaging medico', node: { shape: 'autofluo', label: 'Autofluorescence', ...MED_IMG } },
  { id: 'autofluogray', name: 'Autofluor. (grigi)', category: 'Imaging medico', node: { shape: 'autofluo', label: 'Autofluorescence', spec: 'gray', ...MED_IMG } },
  { id: 'unstained', name: 'Non colorato', category: 'Imaging medico', node: { shape: 'he', label: 'Unstained section', spec: 'unstained', ...MED_IMG } },
  { id: 'mpm', name: 'Multifotone', category: 'Imaging medico', node: { shape: 'mpm', label: 'MPM', ...MED_IMG } },
  { id: 'ihc', name: 'IHC', category: 'Imaging medico', node: { shape: 'ihc', label: 'IHC', ...MED_IMG } },
  { id: 'fluor', name: 'Fluorescenza', category: 'Imaging medico', node: { shape: 'fluor', label: 'Fluorescenza', ...MED_IMG } },
  { id: 'wsi', name: 'WSI + tile', category: 'Imaging medico', node: { shape: 'wsi', label: 'Whole-slide image', spec: '6x8', ...MED_IMG, w: 120, h: 90 } },
  { id: 'ct', name: 'TC', category: 'Imaging medico', node: { shape: 'ct', label: 'CT', ...MED_IMG } },
  { id: 'mri', name: 'RM', category: 'Imaging medico', node: { shape: 'mri', label: 'MRI', ...MED_IMG } },
  { id: 'ctseg', name: 'TC + segment.', category: 'Imaging medico', node: { shape: 'ct', label: 'CT segmentation', spec: 'seg', ...MED_IMG } },
  { id: 'mriseg', name: 'RM + tumore', category: 'Imaging medico', node: { shape: 'mri', label: 'Tumor segmentation', spec: 'seg', ...MED_IMG } },
  { id: 'xray', name: 'Raggi X', category: 'Imaging medico', node: { shape: 'xray', label: 'X-ray', ...MED_IMG } },
  { id: 'us', name: 'Ecografia', category: 'Imaging medico', node: { shape: 'us', label: 'Ultrasound', ...MED_IMG } },
  { id: 'fundus', name: 'Fondo oculare', category: 'Imaging medico', node: { shape: 'fundus', label: 'Fundus', ...MED_IMG } },
  { id: 'oct', name: 'OCT', category: 'Imaging medico', node: { shape: 'oct', label: 'OCT', ...MED_IMG, w: 120, h: 80 } },
  { id: 'derm', name: 'Dermatoscopia', category: 'Imaging medico', node: { shape: 'derm', label: 'Dermoscopy', ...MED_IMG } },
  { id: 'ecg', name: 'ECG', category: 'Imaging medico', node: { shape: 'ecg', label: 'ECG', ...MED_IMG, w: 140, h: 70 } },
  { id: 'scanseg', name: 'Maschera seg.', category: 'Imaging medico', node: { shape: 'mask', spec: 'medical', label: 'Segmentation mask', ...MED_IMG, fill: '#F5F5F5', stroke: '#666666' } },
  // Icone biomediche
  { id: 'dna', name: 'DNA', category: 'Icone bio', node: { shape: 'dna', w: 90, h: 34, fill: 'none', stroke: '#3B4A6B', strokeWidth: 1.2, ...ICON } },
  { id: 'microscope', name: 'Microscopio', category: 'Icone bio', node: { shape: 'microscope', w: 44, h: 54, strokeWidth: 1.2, ...ICON, ...GRAY } },
  { id: 'brainicon', name: 'Cervello', category: 'Icone bio', node: { shape: 'brain', w: 60, h: 48, strokeWidth: 1.2, ...ICON, ...RED } },
  { id: 'lungsicon', name: 'Polmoni', category: 'Icone bio', node: { shape: 'lungs', w: 54, h: 54, strokeWidth: 1.2, ...ICON, ...RED } },
  { id: 'hearticon', name: 'Cuore', category: 'Icone bio', node: { shape: 'heart', w: 44, h: 40, strokeWidth: 1.2, ...ICON, fill: '#F8CECC', stroke: '#B85450' } },
  { id: 'cell', name: 'Cellula', category: 'Icone bio', node: { shape: 'cell', w: 70, h: 56, strokeWidth: 1.2, ...ICON, ...GREEN } },
  // Generativi
  { id: 'diffchain', name: 'Diffusione', category: 'Generativi', node: { shape: 'diffchain', label: '$x_0 \\to x_T$', w: 230, h: 50, count: 4, ...ICON, ...BLUE } },
  { id: 'timestep', name: 'Timestep', category: 'Generativi', node: { shape: 'clock', label: '$t$', w: 30, h: 30, strokeWidth: 1.2, ...ICON, ...WHITE } },
  { id: 'dice', name: 'Sampling', category: 'Generativi', node: { shape: 'dice', w: 30, h: 30, strokeWidth: 1.2, ...ICON, ...WHITE } },
  { id: 'latent', name: 'Spazio latente', category: 'Generativi', node: { shape: 'scatter', label: 'Spazio latente', w: 90, h: 76, radius: 4, ...ICON, ...WHITE } },
  // Layer
  { id: 'conv', name: 'Conv', category: 'Layer', node: { label: 'Conv', ...BLUE } },
  { id: 'pool', name: 'Pooling', category: 'Layer', node: { label: 'Pooling', ...RED } },
  { id: 'linear', name: 'Linear', category: 'Layer', node: { label: 'Linear', ...GREEN } },
  { id: 'norm', name: 'Norm', category: 'Layer', node: { label: 'LayerNorm', ...YELLOW } },
  { id: 'act', name: 'Attivazione', category: 'Layer', node: { label: 'ReLU', ...ORANGE } },
  { id: 'dropout', name: 'Dropout', category: 'Layer', node: { label: 'Dropout', dashed: true, ...GRAY } },
  { id: 'embed', name: 'Embedding', category: 'Layer', node: { label: 'Embedding', ...PURPLE } },
  { id: 'attn', name: 'Attention', category: 'Layer', node: { label: 'Multi-Head\nAttention', h: 56, ...ORANGE } },
  { id: 'ffn', name: 'Feed Forward', category: 'Layer', node: { label: 'Feed\nForward', h: 56, ...BLUE } },
  { id: 'rnn', name: 'LSTM', category: 'Layer', node: { label: 'LSTM', ...TEAL } },
  { id: 'softmax', name: 'Softmax', category: 'Layer', node: { label: 'Softmax', ...GRAY } },
  // Funzioni
  { id: 'relu', name: 'ReLU', category: 'Funzioni', node: { shape: 'plot', spec: 'relu', w: 56, h: 56, ...ICON, ...ORANGE } },
  { id: 'sigmoid', name: 'Sigmoide', category: 'Funzioni', node: { shape: 'plot', spec: 'sigmoid', w: 56, h: 56, ...ICON, ...ORANGE } },
  { id: 'tanh', name: 'Tanh', category: 'Funzioni', node: { shape: 'plot', spec: 'tanh', w: 56, h: 56, ...ICON, ...ORANGE } },
  { id: 'gauss', name: 'Gaussiana', category: 'Funzioni', node: { shape: 'plot', spec: 'gauss', label: '$N(\\mu, \\sigma^2)$', w: 70, h: 56, ...ICON, ...PURPLE } },
  { id: 'probs', name: 'Probabilità', category: 'Funzioni', node: { shape: 'barchart', label: '$p(y|x)$', w: 80, h: 60, count: 5, ...ICON, ...TEAL } },
  { id: 'losscurve', name: 'Loss', category: 'Funzioni', node: { shape: 'plot', spec: 'loss', label: 'Loss', w: 80, h: 56, ...ICON, ...RED } },
  { id: 'lrsched', name: 'LR schedule', category: 'Funzioni', node: { shape: 'plot', spec: 'warmup', label: 'LR', w: 80, h: 56, ...ICON, ...GREEN } },
  { id: 'confmat', name: 'Confusione', category: 'Funzioni', node: { shape: 'confmat', w: 70, h: 70, spec: '5x5', ...ICON, ...BLUE } },
  { id: 'embvec', name: 'Embedding', category: 'Funzioni', node: { shape: 'heatmap', w: 140, h: 18, spec: '1x10', ...ICON, ...PURPLE } },
  // Operatori
  { id: 'add', name: 'Somma', category: 'Operatori', node: { shape: 'ellipse', label: '+', w: 30, h: 30, fontSize: 18, ...WHITE } },
  { id: 'mul', name: 'Prodotto', category: 'Operatori', node: { shape: 'ellipse', label: '×', w: 30, h: 30, fontSize: 18, ...WHITE } },
  { id: 'concat', name: 'Concat', category: 'Operatori', node: { shape: 'ellipse', label: 'C', w: 30, h: 30, fontSize: 14, ...WHITE } },
  { id: 'sigma', name: 'Sigma', category: 'Operatori', node: { shape: 'ellipse', label: '$\\sigma$', w: 30, h: 30, fontSize: 16, ...WHITE } },
  // Output
  { id: 'loss', name: 'Loss', category: 'Output', node: { label: 'Loss', w: 90, ...RED } },
  { id: 'output', name: 'Output', category: 'Output', node: { label: 'Output', w: 90, ...WHITE } },
  { id: 'pred', name: 'Predizione', category: 'Output', node: { label: '$\\hat{y}$', w: 60, h: 40, fontSize: 16, ...GRAY } },
  // Annotazioni
  { id: 'text', name: 'Testo', category: 'Annotazioni', node: { shape: 'text', label: 'Testo', w: 80, h: 30, fill: 'none', stroke: 'none' } },
  { id: 'group', name: 'Gruppo', category: 'Annotazioni', node: { ...GROUP_STYLE, label: 'Modulo', w: 260, h: 160 } },
  { id: 'brace', name: 'Graffa', category: 'Annotazioni', node: { shape: 'brace', direction: 'bottom', w: 160, h: 18, fill: 'none', stroke: '#555555', ...ICON } },
  { id: 'frozen', name: 'Congelato', category: 'Icone', node: { shape: 'snowflake', w: 24, h: 24, fill: 'none', stroke: '#3B82C4', ...ICON } },
  { id: 'lock', name: 'Lucchetto', category: 'Icone', node: { shape: 'lock', w: 24, h: 28, strokeWidth: 1.2, ...ICON, ...GRAY } },
  { id: 'gear', name: 'Ingranaggio', category: 'Icone', node: { shape: 'gear', w: 34, h: 34, strokeWidth: 1.2, ...ICON, ...GRAY } },
  { id: 'cloud', name: 'Nuvola', category: 'Icone', node: { shape: 'cloud', label: 'API', w: 100, h: 62, ...BLUE } },
  { id: 'user', name: 'Utente', category: 'Icone', node: { shape: 'user', label: 'Utente', w: 40, h: 44, ...ICON, ...BLUE } },
  { id: 'robot', name: 'Agente', category: 'Icone', node: { shape: 'robot', label: 'Agente', w: 44, h: 46, strokeWidth: 1.2, ...ICON, ...TEAL } },
  { id: 'bubble', name: 'Prompt', category: 'Icone', node: { shape: 'bubble', label: 'Prompt', w: 110, h: 60, radius: 10, ...YELLOW } },
  { id: 'magnifier', name: 'Retrieval', category: 'Icone', node: { shape: 'magnifier', w: 34, h: 34, ...ICON, ...BLUE } },
  { id: 'cycle', name: 'Ciclo', category: 'Icone', node: { shape: 'cycle', label: '$\\times T$', w: 44, h: 44, fill: 'none', stroke: '#555555', fontSize: 12 } },
  { id: 'stopgrad', name: 'Stop-grad', category: 'Icone', node: { shape: 'stopgrad', w: 18, h: 18, fill: 'none', stroke: '#B85450', ...ICON } },
  { id: 'check', name: 'Corretto', category: 'Icone', node: { shape: 'check', w: 22, h: 20, fill: 'none', stroke: '#2F9E44', ...ICON } },
  { id: 'xmark', name: 'Errato', category: 'Icone', node: { shape: 'xmark', w: 20, h: 20, fill: 'none', stroke: '#E5484D', ...ICON } },
  { id: 'trainable', name: 'Addestrabile', category: 'Icone', node: { shape: 'flame', w: 22, h: 28, fill: '#FB923C', stroke: '#C2410C', strokeWidth: 1.2, ...ICON } },
];

/** Pipeline d'esempio mostrata al primo avvio. */
export function demoDoc(): Doc {
  const n = (p: Partial<NodeModel>) => makeNode(p);
  const image = n({ shape: 'image', label: 'Input', x: 40, y: 120, w: 70, h: 70, radius: 4, ...ICON, ...BLUE });
  const patches = n({ shape: 'patches', label: 'Patch', x: 150, y: 120, w: 70, h: 70, spec: '3x3', ...ICON, ...BLUE });
  const enc = n({ ...ENC_STYLE, label: '$\\mathcal{E}$', sublabel: 'Encoder', x: 260, y: 100, w: 100, h: 110, fontSize: 24 });
  const frozen = n({ shape: 'snowflake', x: 350, y: 92, w: 22, h: 22, fill: 'none', stroke: '#3B82C4' });
  const z = n({ shape: 'cuboid', label: '$z_t \\in R^{d}$', x: 410, y: 120, w: 60, h: 70, ...ICON, ...ORANGE });
  const group = n({ ...GROUP_STYLE, label: 'Transformer Block  $\\times N$', x: 520, y: 60, w: 310, h: 170 });
  const attn = n({ label: 'Multi-Head\nAttention', x: 540, y: 127, w: 110, h: 56, ...ORANGE });
  const add = n({ shape: 'ellipse', label: '+', x: 680, y: 140, w: 30, h: 30, fontSize: 18, ...WHITE });
  const ffn = n({ label: 'Feed\nForward', x: 730, y: 127, w: 85, h: 56, ...BLUE });
  const head = n({ label: 'MLP\nHead', x: 880, y: 127, w: 90, h: 56, ...TEAL });
  const flame = n({ shape: 'flame', x: 958, y: 108, w: 20, h: 26, fill: '#FB923C', stroke: '#C2410C', strokeWidth: 1.2 });
  const probs = n({ shape: 'barchart', label: '$p(y|x)$', x: 1020, y: 125, w: 80, h: 60, count: 5, ...ICON, ...TEAL });
  const seq = [image, patches, enc, z, attn, add, ffn, head, probs];
  const edges = seq.slice(1).map((b, i) => makeEdge({ node: seq[i].id, side: 'right' }, { node: b.id, side: 'left' }));
  edges.push(makeEdge({ node: z.id, side: 'top' }, { node: add.id, side: 'top' }, { dashed: true, label: 'skip' }));
  return { version: 1, nodes: [group, ...seq, frozen, flame], edges, settings: { ...DEFAULT_SETTINGS } };
}

/** Blocchi della libreria: quelli di base più quelli dei moduli di dominio. */
export function allPresets(): Preset[] {
  return [...PRESETS, ...registeredPresets()];
}
