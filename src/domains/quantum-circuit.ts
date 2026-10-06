// Circuiti quantistici nello stile dei libri di testo (Nielsen & Chuang, quantikz, Qiskit):
// forme dei singoli elementi (filo, porta, controlli, misura, barriera, circuito compatto) e
// `circuit()`, che dispone un circuito intero a partire da una descrizione testuale compatta.
// Le forme si registrano qui, all'import: altri moduli possono usare `circuit()` senza
// caricare blocchi e modelli del modulo quantum.
//
// ---------------------------------------------------------------------------------------------
// API
//   circuit(t: Builder, x, y, cols: string[], opts?: CircuitOpts): Circuit
//   (x, y) = inizio del primo filo; le etichette d'ingresso stanno a sinistra di x.
//   cols = colonne da sinistra a destra; più operazioni nella stessa colonna separate da '&'.
//
//   Operazione = NOME[argomento] fili…   (fili numerati da 0 dall'alto, 'a-b' = intervallo,
//   'c0', 'c1'… = bit classici aggiunti con opts.cbits)
//     H X Y Z S T SDG TDG SX I        porta su ciascun filo indicato ('H 0 1 2')
//     RX[\theta] RY RZ P U R[k]       porte con parametro: $R_x(\theta)$, $P(\lambda)$, $R_{k}$…
//     G[U_f] 0-3                      blocco generico; con un intervallo copre più fili
//     QFT 0-2, IQFT 0-2               blocchi QFT e QFT†
//     CX 0 1, CCX 0 1 2, CZ 0 1, CH 0 1, CRY[\theta] 0 1, SWAP 0 1, CSWAP 0 1 2
//                                     l'ultimo filo (o intervallo) è il bersaglio, gli altri controlli;
//                                     'o1' = controllo aperto, '!c0' o '!1' = controllo classico
//     CU[U^{2^j}] 0 3-5               controllo + blocco su più fili
//     CP[\lambda] 0 1                 fase controllata: due punti + etichetta a lato
//     M 0 1                           misura (poi il filo prosegue doppio); 'M 0>c0' = verso il bit c0
//     | (o BARRIER)                   barriera sui qubit;  SLICE[|\psi_1\rangle] = linea con etichetta
//     ...                             puntini su tutti i fili ('... 0 1' solo su alcuni)
//     TXT[\vdots] 2                   testo senza riquadro;  IN[|1\rangle] 1 = etichetta d'ingresso
//     _                               colonna vuota
//   L'argomento è una formula senza $ ('U_f'); se contiene $ resta com'è; parole semplici
//   ('Oracle') restano testo. '@orange' (blue, green, yellow, red, purple, teal, gray, white)
//   colora l'operazione, 'w=80' ne fissa la larghezza minima.
//   Opzioni utili (CircuitOpts): inputs/outputs (etichette ai lati), cbits (bit classici),
//   bundles ({ 0: 'n' } = registro), gaps (righe con ⋮), style 'pastel', trim (i fili doppi
//   finiscono all'ultimo controllo classico), pitch/gate/gap (misure in px).
//
// Esempio: stato di Bell con misura e riquadro attorno alle prime due colonne
//   const c = circuit(t, 60, 40, ['H 0', 'CX 0 1', 'M 0 1']);
//   const r = c.around(0, 1);                       // { x, y, w, h } delle colonne 0-1
//   t.group('Bell pair', r.x, r.y - 14, r.w, r.h + 14);
//   t.text('$|\\Phi^+\\rangle$', c.x1 + 8, c.ys[0] - 10, 50, 20);   // c.ys = y dei fili, c.xs = centri colonne
//   c.ops[1][0]                                     // il nodo del CNOT (qc-ctrl), modificabile
// ---------------------------------------------------------------------------------------------
import type { Builder, Color, N } from '../builder';
import { arc, poly, type Cmd, type Part } from '../draw';
import { labelBlocks, shapeParts, textWidth } from '../geometry';
import { COLORS, makeNode, type NodeModel } from '../model';
import { registerShapes, type ShapeDef, type SpecGroup } from '../registry';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
type P2 = [number, number];

/** Inchiostro di fili, punti di controllo e connettori. */
export const QC_INK = '#2B2B2B';
/** Misure di riferimento: distanza fra i fili, lato delle porte, spazio fra colonne (px). */
export const QC_PITCH = 42;
export const QC_GATE = 28;
const GAP = 14;
const BAND = '#ECEDEF';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const has = (spec: string, word: string) => new RegExp(`(^|\\s)${word}(\\s|$)`, 'i').test(spec);
const line = (cmds: Cmd[], stroke: string, sw: number): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true });
const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];
const disc = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true });
const inkOf = (n: NodeModel) => (n.stroke === 'none' ? QC_INK : n.stroke);
/** Rapporto lato porta / distanza fra i fili: `circuit()` lo salva in `depth` (campo libero per queste forme). */
const gateRatio = (n: NodeModel) => (n.depth > 0.3 && n.depth < 0.95 ? n.depth : QC_GATE / QC_PITCH);

/** Tratteggio esplicito lungo un segmento verticale (identico in SVG e TikZ). */
function vdash(x: number, y0: number, y1: number, on = 4, off = 3): Cmd[] {
  const out: Cmd[] = [];
  for (let y = y0; y < y1 - 0.5; y += on + off) out.push(['M', x, y], ['L', x, Math.min(y1, y + on)]);
  return out;
}

// ======================================================================
// Forme
// ======================================================================

/** Filo: quantistico (una linea), classico (doppia) o registro (barretta con il numero di qubit). */
function wireParts(n: NodeModel): Part[] {
  const y = n.y + n.h / 2, ink = inkOf(n), sw = n.strokeWidth;
  const x0 = n.x, x1 = n.x + n.w;
  if (has(n.spec, 'classical')) return [line([...seg([x0, y - 1.6], [x1, y - 1.6]), ...seg([x0, y + 1.6], [x1, y + 1.6])], ink, sw * 0.9)];
  const parts: Part[] = [line(seg([x0, y], [x1, y]), ink, sw)];
  if (has(n.spec, 'bundle')) {
    const sx = x0 + Math.min(16, n.w * 0.2);
    parts.push(line(seg([sx - 4, y + 6], [sx + 4, y - 6]), ink, sw));
    const word = n.spec.split(/\s+/).find((w) => w && !/^(bundle|quantum|classical)$/i.test(w));
    if (word) parts.push({ kind: 'text', x: sx + 5, y: y - 9, text: word.includes('$') ? word : `$${word}$`, size: 10, fill: ink, anchor: 'start' });
  }
  return parts;
}

/** Meter della misura: arco e lancetta dentro il riquadro. */
function meterGlyph(x: number, y: number, w: number, h: number, ink: string, sw: number): Part[] {
  const cx = x + w / 2, cy = y + h * 0.74;
  const r = Math.min(w * 0.33, h * 0.44);
  const a = -Math.PI / 4.2;
  const tip: P2 = [cx + r * 1.12 * Math.cos(a), cy + r * 1.12 * Math.sin(a)];
  const ux = Math.cos(a), uy = Math.sin(a), hs = Math.max(2.6, r * 0.32);
  const bx = tip[0] - ux * hs, by = tip[1] - uy * hs;
  return [
    line(arc(cx, cy, r, Math.PI, 2 * Math.PI), ink, sw),
    line(seg([cx, cy], [bx, by]), ink, sw),
    { kind: 'path', fill: ink, stroke: 'none', cmds: poly([tip, [bx - uy * hs * 0.45, by + ux * hs * 0.45], [bx + uy * hs * 0.45, by - ux * hs * 0.45]]) },
  ];
}

function meterParts(n: NodeModel): Part[] {
  return [{ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(n.radius, n.w / 2, n.h / 2), fill: n.fill }, ...meterGlyph(n.x, n.y, n.w, n.h, inkOf(n), n.strokeWidth)];
}

/** Porta: riquadro (anche su più fili); 'stack' = strati ripetuti, 'idx' = indici dei fili come in Qiskit. */
function gateParts(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const r = Math.min(n.radius, w / 2, h / 2);
  const parts: Part[] = [];
  if (has(n.spec, 'stack')) {
    parts.push({ kind: 'rect', x: x + 7, y: y - 7, w, h, r, fill: n.fill === 'none' ? '#FFFFFF' : n.fill });
    parts.push({ kind: 'rect', x: x + 3.5, y: y - 3.5, w, h, r, fill: n.fill === 'none' ? '#FFFFFF' : n.fill });
  }
  parts.push({ kind: 'rect', x, y, w, h, r, fill: n.fill });
  const k = clamp(Math.round(n.count), 1, 16);
  if (has(n.spec, 'idx') && k > 1) {
    const P = h / (k - 1 + gateRatio(n));
    const g = P * gateRatio(n);
    for (let i = 0; i < k; i++) parts.push({ kind: 'text', x: x + 5, y: y + g / 2 + i * P, text: String(i), size: 9, fill: inkOf(n), anchor: 'start' });
  }
  return parts;
}

/**
 * Porta controllata su più fili, un simbolo per filo in `spec` (dall'alto):
 * c controllo, o controllo aperto, k controllo classico, t bersaglio ⊕, x scambio (SWAP),
 * g riquadro con l'etichetta (righe consecutive = un solo blocco), m misura,
 * a freccia sul bit classico, '.' filo attraversato.
 */
const ctrlTokens = (spec: string) => {
  const t = spec.toLowerCase().split(/[\s,]+/).filter((s) => /^[cotxgmka.\-|]$/.test(s));
  return t.length ? t : ['c', 't'];
};

interface CtrlGeom {
  tokens: string[];
  P: number;
  cx: number;
  yc: (i: number) => number;
  bh: number;
  boxes: [number, number][];
}

function ctrlGeom(n: NodeModel): CtrlGeom {
  const tokens = ctrlTokens(n.spec);
  const P = n.h / tokens.length;
  const boxes: [number, number][] = [];
  tokens.forEach((s, i) => {
    if (s !== 'g') return;
    const last = boxes[boxes.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else boxes.push([i, i]);
  });
  return { tokens, P, cx: n.x + n.w / 2, yc: (i) => n.y + (i + 0.5) * P, bh: P * gateRatio(n), boxes };
}

function ctrlParts(n: NodeModel): Part[] {
  const { tokens, P, cx, yc, bh, boxes } = ctrlGeom(n);
  const ink = inkOf(n), sw = n.strokeWidth;
  const used = tokens.map((s, i) => (/[.\-|]/.test(s) ? -1 : i)).filter((i) => i >= 0);
  const parts: Part[] = [];
  if (used.length > 1) {
    const y0 = yc(used[0]), y1 = yc(used[used.length - 1]);
    if (tokens.some((s) => s === 'k' || s === 'a')) parts.push(line([...seg([cx - 1.6, y0], [cx - 1.6, y1]), ...seg([cx + 1.6, y0], [cx + 1.6, y1])], ink, sw * 0.9));
    else parts.push(line(seg([cx, y0], [cx, y1]), ink, sw));
  }
  const dot = clamp(P * 0.085, 2.6, 4.6);
  const rt = clamp(Math.min(P * 0.21, n.w / 2 - 0.5), 4, 13);
  const sx = clamp(P * 0.13, 3, 8);
  const r = Math.min(n.radius, n.w / 2, bh / 2);
  tokens.forEach((s, i) => {
    const y = yc(i);
    if (s === 'c' || s === 'k') parts.push(disc(cx, y, dot, ink));
    else if (s === 'o') parts.push(disc(cx, y, dot + 0.4, '#FFFFFF', ink, sw));
    else if (s === 't') parts.push(disc(cx, y, rt, '#FFFFFF', ink, sw), line([...seg([cx - rt, y], [cx + rt, y]), ...seg([cx, y - rt], [cx, y + rt])], ink, sw));
    else if (s === 'x') parts.push(line([...seg([cx - sx, y - sx], [cx + sx, y + sx]), ...seg([cx - sx, y + sx], [cx + sx, y - sx])], ink, sw * 1.15));
    else if (s === 'm') parts.push({ kind: 'rect', x: n.x, y: y - bh / 2, w: n.w, h: bh, r, fill: n.fill === 'none' ? '#FFFFFF' : n.fill }, ...meterGlyph(n.x, y - bh / 2, n.w, bh, ink, sw));
    else if (s === 'a') {
      const hs = clamp(P * 0.14, 4, 7);
      parts.push({ kind: 'path', fill: ink, stroke: 'none', cmds: poly([[cx, y], [cx - hs * 0.6, y - hs], [cx + hs * 0.6, y - hs]]) });
    }
  });
  for (const [a, b] of boxes) parts.push({ kind: 'rect', x: n.x, y: yc(a) - bh / 2, w: n.w, h: yc(b) - yc(a) + bh, r, fill: n.fill === 'none' ? '#FFFFFF' : n.fill });
  return parts;
}

function ctrlLabel(n: NodeModel) {
  const { tokens, cx, yc, boxes } = ctrlGeom(n);
  if (boxes.length) return { x: cx, y: (yc(boxes[0][0]) + yc(boxes[0][1])) / 2, anchor: 'middle' as const };
  const used = tokens.map((s, i) => (/[.\-|]/.test(s) ? -1 : i)).filter((i) => i >= 0);
  const mid = used.length ? (yc(used[0]) + yc(used[used.length - 1])) / 2 : n.y + n.h / 2;
  return { x: cx + 7, y: mid, anchor: 'start' as const };
}

/** Barriera (linea tratteggiata, con fascia grigia in stile Qiskit se 'band'). */
function barrierParts(n: NodeModel): Part[] {
  const cx = n.x + n.w / 2;
  const parts: Part[] = [];
  if (has(n.spec, 'band')) parts.push({ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: 0, fill: n.fill === 'none' ? BAND : n.fill, stroke: 'none', solid: true });
  parts.push(line(vdash(cx, n.y, n.y + n.h), inkOf(n), n.strokeWidth));
  return parts;
}

/** Circuito compatto: `spec` = colonne separate da ';' nel linguaggio di `circuit()`, `count` = qubit. */
function circuitParts(n: NodeModel): Part[] {
  const nq = clamp(Math.round(n.count), 1, 12);
  const cols = splitTop(n.spec, ';').filter((s) => s.trim());
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(n.radius, n.w / 2, n.h / 2), fill: n.fill });
  const base = layoutCircuit(0, 0, cols, { qubits: nq });
  const b = base.box;
  const pad = n.fill !== 'none' ? 8 : 2;
  const s = Math.min((n.w - 2 * pad) / b.w, (n.h - 2 * pad) / b.h, 1.6);
  if (!(s > 0)) return parts;
  const L = layoutCircuit(0, 0, cols, { qubits: nq, pitch: QC_PITCH * s, gate: QC_GATE * s, gap: GAP * s, lead: 14 * s, tail: 14 * s, fontSize: 14 * s, labelGap: 6 * s });
  const dx = n.x + (n.w - L.box.w) / 2 - L.box.x, dy = n.y + (n.h - L.box.h) / 2 - L.box.y;
  for (const p of L.items) {
    const m = makeNode({ ...p, x: (p.x ?? 0) + dx, y: (p.y ?? 0) + dy });
    for (const part of shapeParts(m)) parts.push({ ...part, stroke: part.stroke ?? m.stroke, sw: part.sw ?? m.strokeWidth, solid: true });
    for (const t of labelBlocks(m)) parts.push({ kind: 'text', x: t.x, y: t.y, text: t.text, size: t.fontSize, fill: t.color, anchor: t.anchor, bold: t.bold, italic: t.italic });
  }
  return parts;
}

const c = (value: string, label: string) => ({ value, label });

const OPTIONS: Record<string, SpecGroup[]> = {
  'qc-wire': [
    { title: 'Filo', choices: [c('quantum', 'Quantistico'), c('classical', 'Classico (doppio)'), c('bundle', 'Registro (n qubit)')] },
  ],
  'qc-gate': [{ title: 'Opzioni', mode: 'many', choices: [c('stack', 'Strati ripetuti'), c('idx', 'Indici dei fili')] }],
  'qc-ctrl': [
    {
      title: 'Porta (un simbolo per filo)',
      mode: 'value',
      choices: [
        c('c t', 'CNOT'), c('t c', 'CNOT ↑'), c('c . t', 'CNOT a distanza'), c('c c', 'CZ'), c('x x', 'SWAP'), c('c c t', 'Toffoli'), c('c x x', 'Fredkin'),
        c('c g', 'Controllata U'), c('g c', 'U ↑ controllata'), c('o t', 'Controllo aperto'), c('k g', 'Controllo classico'), c('m . a', 'Misura su bit'),
        c('c', 'Punto di controllo'), c('t', 'Bersaglio ⊕'),
      ],
    },
  ],
  'qc-barrier': [{ title: 'Stile', mode: 'many', choices: [c('band', 'Fascia grigia')] }],
  'qc-circuit': [
    {
      title: 'Circuito',
      mode: 'value',
      choices: [
        c('H 0; CX 0 1; M 0 1', 'Bell'), c('H 0; CX 0 1; CX 1 2; M 0 1 2', 'GHZ'), c('H 0 1; CZ 0 1; H 0 1', 'H-CZ-H'),
        c('RY[\\theta_1] 0 & RY[\\theta_2] 1; CX 0 1; M 0 1', 'Ansatz'), c('H 0; CU[R_2] 1 0; H 1; SWAP 0 1', 'QFT (2 qubit)'),
      ],
    },
  ],
};

const DEFS: Omit<ShapeDef, 'specOptions'>[] = [
  { kind: 'qc-wire', name: 'Filo del circuito (qubit / bit)', parts: wireParts, label: (n) => ({ x: n.x - 6, y: n.y + n.h / 2, anchor: 'end' }), specLabel: 'Tipo' },
  { kind: 'qc-gate', name: 'Porta quantistica', parts: gateParts, countLabel: 'Fili coperti', countMax: 16, specLabel: 'Opzioni' },
  { kind: 'qc-ctrl', name: 'Porta controllata (CNOT, CZ, SWAP…)', parts: ctrlParts, label: ctrlLabel, specLabel: 'Simboli per filo' },
  { kind: 'qc-meter', name: 'Misura (meter)', parts: meterParts },
  { kind: 'qc-barrier', name: 'Barriera', parts: barrierParts, specLabel: 'Stile' },
  { kind: 'qc-circuit', name: 'Circuito compatto', parts: circuitParts, countLabel: 'Qubit', countMax: 12, specLabel: 'Porte (colonne separate da ;)' },
];

export const CIRCUIT_SHAPES: ShapeDef[] = DEFS.map((d) => ({ ...d, specOptions: OPTIONS[d.kind] }));
registerShapes(CIRCUIT_SHAPES);

// ======================================================================
// Linguaggio delle porte e impaginazione
// ======================================================================

/** Divide al livello più esterno (fuori da [ ] e { }). */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const NAMED: Record<string, string> = { H: 'H', X: 'X', Y: 'Y', Z: 'Z', S: 'S', T: 'T', I: 'I', ID: 'I', NOT: 'X', SDG: 'S^\\dagger', TDG: 'T^\\dagger', SX: '\\sqrt{X}' };
const PARAM: Record<string, (a: string | null) => string> = {
  RX: (a) => `R_x(${a ?? '\\theta'})`,
  RY: (a) => `R_y(${a ?? '\\theta'})`,
  RZ: (a) => `R_z(${a ?? '\\theta'})`,
  P: (a) => `P(${a ?? '\\lambda'})`,
  PHASE: (a) => `P(${a ?? '\\lambda'})`,
  U: (a) => (a ? `U(${a})` : 'U'),
  R: (a) => `R_{${a ?? 'k'}}`,
};
const COLOR_NAMES: Record<string, Color> = { blue: BLUE, green: GREEN, orange: ORANGE, yellow: YELLOW, red: RED, purple: PURPLE, teal: TEAL, gray: GRAY, grey: GRAY, white: WHITE };

/** Colori per famiglia di porte nello stile 'pastel'. */
function familyColor(name: string): Color {
  if (name === 'H') return BLUE;
  if (/^(X|Y|Z|I|ID|NOT)$/.test(name)) return GREEN;
  if (/^(S|T|SDG|TDG|SX|P|PHASE|R)$/.test(name)) return TEAL;
  if (/^(RX|RY|RZ|U)$/.test(name)) return PURPLE;
  if (/^(QFT|IQFT)$/.test(name)) return ORANGE;
  if (name === 'M') return GRAY;
  return YELLOW;
}

const isGate = (name: string) => name in NAMED || name in PARAM || name === 'G' || name === 'QFT' || name === 'IQFT' || name === 'SWAP';

/** Etichetta da argomento: formula di default, testo se contiene $ o è una parola semplice. */
export const asLabel = (arg: string) => (arg.includes('$') ? arg : /^[A-Za-z][A-Za-z0-9 \-]+$/.test(arg.trim()) ? arg.trim() : `$${arg}$`);

function gateLabel(name: string, arg: string | null): string {
  if (name in NAMED) return `$${NAMED[name]}$`;
  if (name in PARAM) return `$${PARAM[name](arg)}$`;
  if (name === 'QFT') return '$\\mathrm{QFT}$';
  if (name === 'IQFT') return '$\\mathrm{QFT}^\\dagger$';
  return asLabel(arg ?? 'U');
}

type OpKind = 'gate' | 'ctrl' | 'meter' | 'barrier' | 'slice' | 'dots' | 'text' | 'init' | 'space';

interface Op {
  kind: OpKind;
  name: string;
  label: string;
  r0: number;
  r1: number;
  /** qc-ctrl: un simbolo per riga da r0 a r1. */
  tokens?: string[];
  /** qc-ctrl con riquadro: la larghezza dipende dall'etichetta. */
  boxed?: boolean;
  /** Etichetta a lato del connettore (fase controllata). */
  side?: boolean;
  /** Larghezza minima ('w=80' nella descrizione). */
  minW?: number;
  color: Color | null;
}

interface WireRef {
  r0: number;
  r1: number;
  mode: '' | 'o' | '!';
  to: number | null;
}

function readHead(src: string): { name: string; arg: string | null; rest: string } {
  const s = src.trim();
  const m = /^(\.\.\.|\||_|[A-Za-z][A-Za-z0-9]*)/.exec(s);
  if (!m) return { name: '', arg: null, rest: s };
  let i = m[0].length;
  let arg: string | null = null;
  if (s[i] === '[') {
    let depth = 0, j = i;
    for (; j < s.length; j++) {
      if (s[j] === '[') depth++;
      else if (s[j] === ']' && --depth === 0) break;
    }
    arg = s.slice(i + 1, j);
    i = j + 1;
  }
  return { name: m[0].toUpperCase(), arg, rest: s.slice(i) };
}

function parseOps(src: string, nq: number, nc: number): Op[] {
  const { name: raw, arg, rest } = readHead(src);
  if (!raw) return [];
  const refs: WireRef[] = [];
  let color: Color | null = null;
  let minW = 0;
  const total = nq + nc;
  for (const tok of rest.trim().split(/[\s,]+/).filter(Boolean)) {
    const cm = /^@(\w+)$/.exec(tok);
    if (cm) {
      color = COLOR_NAMES[cm[1].toLowerCase()] ?? null;
      continue;
    }
    const wm = /^w=(\d+)$/i.exec(tok);
    if (wm) {
      minW = +wm[1];
      continue;
    }
    const m = /^(o|!)?(c)?(\d+)(?:-(\d+))?(?:>c(\d+))?$/i.exec(tok);
    if (!m) continue;
    const off = m[2] ? nq : 0;
    const a = clamp(off + +m[3], 0, total - 1), b = clamp(off + +(m[4] ?? m[3]), 0, total - 1);
    const to = m[5] !== undefined ? clamp(nq + +m[5], 0, total - 1) : null;
    refs.push({ r0: Math.min(a, b), r1: Math.max(a, b), mode: (m[1]?.toLowerCase() as '' | 'o' | '!') ?? '', to });
  }
  const allQ = { r0: 0, r1: nq - 1 };
  const one = (kind: OpKind, label: string, r0: number, r1: number, extra: Partial<Op> = {}): Op => ({ kind, name: raw, label, r0, r1, color, minW, ...extra });
  const name = raw === 'CNOT' ? 'CX' : raw === 'TOFFOLI' ? 'CCX' : raw === 'FREDKIN' ? 'CSWAP' : raw;
  if (name === '_') return [one('space', '', 0, 0)];
  if (name === '|' || name === 'BARRIER') {
    const r = refs.length ? { r0: Math.min(...refs.map((w) => w.r0)), r1: Math.max(...refs.map((w) => w.r1)) } : allQ;
    return [one('barrier', '', r.r0, r.r1)];
  }
  if (name === 'SLICE') return [one('slice', arg ? asLabel(arg) : '', 0, total - 1)];
  if (name === '...' || name === 'DOTS') return (refs.length ? refs.map((w) => w.r0) : Array.from({ length: nq }, (_, i) => i)).map((r) => one('dots', '$\\cdots$', r, r));
  if (name === 'TXT') return refs.map((w) => one('text', asLabel(arg ?? ''), w.r0, w.r1));
  if (name === 'IN') return refs.map((w) => one('init', asLabel(arg ?? '|0\\rangle'), w.r0, w.r0));
  if (name === 'M' || name === 'MEASURE') {
    return refs.map((w) => {
      if (w.to === null) return one('meter', '', w.r0, w.r0);
      const lo = Math.min(w.r0, w.to), hi = Math.max(w.r0, w.to);
      const tokens = Array.from({ length: hi - lo + 1 }, (_, i) => (lo + i === w.r0 ? 'm' : lo + i === w.to ? 'a' : '.'));
      return one('ctrl', '', lo, hi, { tokens, name: 'M' });
    });
  }
  if (name === 'SWAP' || (name !== 'G' && /^C+/.test(name) && isGate(name.replace(/^C+/, '')))) {
    const target = name === 'SWAP' ? 'SWAP' : name.replace(/^C+/, '');
    const nt = target === 'SWAP' ? 2 : 1;
    if (refs.length < nt) return [];
    const tgt = refs.slice(-nt), ctl = refs.slice(0, -nt);
    const lo = Math.min(...refs.map((w) => w.r0)), hi = Math.max(...refs.map((w) => w.r1));
    const tokens = Array.from({ length: hi - lo + 1 }, () => '.');
    for (const w of ctl) tokens[w.r0 - lo] = w.mode === 'o' ? 'o' : w.mode === '!' ? 'k' : 'c';
    let label = '', boxed = false, side = false;
    if (target === 'X' || target === 'NOT') tokens[tgt[0].r0 - lo] = 't';
    else if (target === 'Z') tokens[tgt[0].r0 - lo] = 'c';
    else if (target === 'SWAP') tgt.forEach((w) => (tokens[w.r0 - lo] = 'x'));
    else if ((target === 'P' || target === 'PHASE') && tgt[0].r0 === tgt[0].r1) {
      tokens[tgt[0].r0 - lo] = 'c';
      label = gateLabel(target, arg);
      side = true;
    } else {
      for (let r = tgt[0].r0; r <= tgt[0].r1; r++) tokens[r - lo] = 'g';
      label = target === 'U' || target === 'G' ? asLabel(arg ?? 'U') : gateLabel(target, arg);
      boxed = true;
    }
    return [one('ctrl', label, lo, hi, { tokens, boxed, side, name: target })];
  }
  if (isGate(name)) return refs.map((w) => one('gate', gateLabel(name, arg), w.r0, w.r1));
  return [];
}

export interface CircuitOpts {
  /** Numero di qubit (predefinito: dedotto dalle porte). */
  qubits?: number;
  /** Bit classici in fondo (fili doppi): numero o etichette. */
  cbits?: number | string[];
  /** Etichette a sinistra dei qubit (predefinito $|0\rangle$); '' = nessuna. */
  inputs?: string[];
  /** Etichette a destra dei fili. */
  outputs?: string[];
  /** Fili disegnati come registro (barretta + nome), es. { 0: 'n' }. */
  bundles?: Record<number, string>;
  /** Righe senza filo (puntini verticali ⋮ fra i qubit). */
  gaps?: number[];
  /** 'plain' = porte bianche come nei libri (predefinito), 'pastel' = colori per famiglia. */
  style?: 'plain' | 'pastel';
  /** Colore per nome di porta, es. { G: COLORS.YELLOW, QFT: COLORS.ORANGE }. */
  colors?: Record<string, Color>;
  /** Dopo una misura il filo prosegue doppio ('classical', predefinito) o resta singolo. */
  measured?: 'classical' | 'quantum';
  /** I fili doppi dopo una misura finiscono all'ultimo controllo classico (come in Nielsen & Chuang). */
  trim?: boolean;
  /** Etichetta delle linee SLICE: sopra o sotto il circuito. */
  sliceLabels?: 'above' | 'below';
  pitch?: number;
  gate?: number;
  gap?: number;
  lead?: number;
  tail?: number;
  fontSize?: number;
  radius?: number;
  /** Larghezza minima delle colonne. */
  minCol?: number;
  labelGap?: number;
}

export interface Circuit {
  nodes: N[];
  /** Segmenti di filo (qubit e bit classici). */
  wires: N[];
  /** Nodi creati per ciascuna colonna (stesso ordine delle operazioni). */
  ops: N[][];
  /** y di ogni filo: prima i qubit, poi i bit classici. */
  ys: number[];
  /** Centro, bordo sinistro e destro di ogni colonna. */
  xs: number[];
  left: number[];
  right: number[];
  /** Inizio e fine dei fili. */
  x0: number;
  x1: number;
  /** Bordo superiore e inferiore delle porte. */
  top: number;
  bottom: number;
  pitch: number;
  gate: number;
  /** Riquadro attorno alle colonne c0..c1 e ai fili q0..q1 (predefinito: tutti i qubit). */
  around(c0: number, c1: number, q0?: number, q1?: number, pad?: number): { x: number; y: number; w: number; h: number };
}

interface Layout {
  items: Partial<NodeModel>[];
  /** Per ogni item: colonna di appartenenza (-1 = fili ed etichette). */
  colOf: number[];
  ys: number[];
  xs: number[];
  left: number[];
  right: number[];
  x0: number;
  x1: number;
  nq: number;
  box: { x: number; y: number; w: number; h: number };
}

const measure = (label: string, fs: number) => (label ? Math.max(...label.split('\n').map((l) => textWidth(l, fs, false, false, 'sans'))) : 0);

function layoutCircuit(x: number, y: number, cols: string[], o: CircuitOpts): Layout {
  const P = o.pitch ?? QC_PITCH, G = o.gate ?? QC_GATE, gap = o.gap ?? GAP, fs = o.fontSize ?? 14;
  const lead = o.lead ?? 16, tail = o.tail ?? 16, lg = o.labelGap ?? 6, rad = o.radius ?? 2;
  const nc = typeof o.cbits === 'number' ? o.cbits : (o.cbits?.length ?? 0);
  // numero di qubit: dichiarato oppure il filo più basso citato
  let nq = o.qubits ?? 0;
  if (!nq) {
    for (const col of cols) for (const s of splitTop(col, '&')) for (const m of readHead(s).rest.matchAll(/(?:^|[\s,o!])(\d+)(?:-(\d+))?/g)) nq = Math.max(nq, +(m[2] ?? m[1]) + 1);
    nq = Math.max(1, nq);
  }
  const total = nq + nc;
  const ys = Array.from({ length: total }, (_, i) => y + i * P);
  const gaps = new Set(o.gaps ?? []);
  const inputs = Array.from({ length: nq }, (_, i) => (gaps.has(i) ? '' : (o.inputs ? (o.inputs[i] ?? '') : '$|0\\rangle$')));
  const cl = typeof o.cbits === 'number' ? Array.from({ length: nc }, () => '') : (o.cbits ?? []);
  const color = (op: Op): Color => op.color ?? o.colors?.[op.name] ?? (o.style === 'pastel' ? familyColor(op.name) : WHITE);
  const minCol = o.minCol ?? G;

  // operazioni per colonna, etichette d'ingresso ricavate da IN
  const opCols: Op[][] = [];
  for (const col of cols) {
    const ops = splitTop(col, '&').flatMap((s) => parseOps(s, nq, nc));
    for (const op of ops) if (op.kind === 'init') inputs[op.r0] = op.label;
    const rest = ops.filter((op) => op.kind !== 'init');
    if (rest.length || !ops.length) opCols.push(rest);
  }
  const width = (op: Op): number => Math.max(op.minW ?? 0, baseWidth(op));
  const baseWidth = (op: Op): number => {
    const lw = measure(op.label, fs);
    switch (op.kind) {
      case 'gate': return Math.max(minCol, 2 * Math.ceil((lw + 14) / 2));
      case 'ctrl': return op.boxed ? Math.max(minCol, 2 * Math.ceil((lw + 14) / 2)) : op.side ? Math.max(minCol, 2 * Math.ceil(lw + 10)) : op.tokens?.includes('m') ? G + 4 : minCol;
      case 'meter': return G + 4;
      case 'barrier': return 10;
      case 'slice': return 12;
      case 'dots': return 22;
      case 'text': return Math.max(14, lw + 6);
      default: return minCol;
    }
  };
  const xs: number[] = [], left: number[] = [], right: number[] = [];
  let cur = x + lead;
  for (const ops of opCols) {
    const w = ops.length ? Math.max(...ops.map(width)) : minCol;
    left.push(cur);
    right.push(cur + w);
    xs.push(cur + w / 2);
    cur += w + gap;
  }
  const x1 = (opCols.length ? cur - gap : x + lead) + tail;

  // fili: segmenti quantistici/classici (dopo una misura il filo diventa doppio)
  const state: ('q' | 'c')[] = Array.from({ length: total }, (_, i) => (i < nq ? 'q' : 'c'));
  const starts: number[] = Array.from({ length: total }, () => x);
  const segs: { r: number; x0: number; x1: number; kind: 'q' | 'c' }[] = [];
  const switchTo = (r: number, k: 'q' | 'c', at: number) => {
    if (state[r] === k) return;
    segs.push({ r, x0: starts[r], x1: at, kind: state[r] });
    state[r] = k;
    starts[r] = at;
  };
  opCols.forEach((ops, ci) => {
    for (const op of ops) {
      if (op.kind === 'meter' && o.measured !== 'quantum') switchTo(op.r0, 'c', xs[ci]);
      else if (op.kind === 'gate' || (op.kind === 'ctrl' && op.name !== 'M')) {
        op.tokens?.forEach((s, i) => s !== '.' && s !== 'k' && op.r0 + i < nq && switchTo(op.r0 + i, 'q', left[ci] - gap / 2));
        if (op.kind === 'gate') for (let r = op.r0; r <= op.r1 && r < nq; r++) switchTo(r, 'q', left[ci] - gap / 2);
      }
    }
  });
  for (let r = 0; r < total; r++) {
    let end = x1;
    if (o.trim && r < nq && state[r] === 'c') {
      // ultimo uso del bit misurato (controllo classico) oppure poco dopo il meter
      const after = opCols.findIndex((ops) => ops.some((op) => op.kind === 'meter' && op.r0 === r));
      let last = -1;
      opCols.forEach((ops, ci) => ci > after && ops.some((op) => op.tokens?.[r - op.r0] === 'k') && (last = ci));
      end = last >= 0 ? xs[last] : right[after] + 10;
    }
    segs.push({ r, x0: starts[r], x1: end, kind: state[r] });
  }

  const items: Partial<NodeModel>[] = [];
  const colOf: number[] = [];
  const push = (p: Partial<NodeModel>, ci = -1) => {
    items.push(p);
    colOf.push(ci);
  };
  const base = { strokeWidth: 1, fontSize: fs, depth: G / P };
  const labelled = new Set<number>();
  segs.sort((a, b) => a.r - b.r || a.x0 - b.x0);
  for (const s of segs) {
    if (gaps.has(s.r) || s.x1 - s.x0 < 0.5) continue;
    const bundle = s.r < nq && o.bundles?.[s.r] !== undefined;
    const label = labelled.has(s.r) ? '' : s.r < nq ? inputs[s.r] : (cl[s.r - nq] ?? '');
    labelled.add(s.r);
    const spec = s.kind === 'c' ? 'classical' : bundle ? `bundle ${o.bundles![s.r]}` : 'quantum';
    push({ shape: 'qc-wire', spec, label, x: s.x0, y: ys[s.r] - (bundle ? 12 : 8), w: s.x1 - s.x0, h: bundle ? 24 : 16, fill: 'none', stroke: QC_INK, ...base });
  }
  const inW = Math.max(0, ...inputs.map((l) => measure(l, fs)));
  for (const r of gaps) if (r < nq) push({ shape: 'text', label: '$\\vdots$', x: x - lg - inW / 2 - 10, y: ys[r] - 10, w: 20, h: 20, fill: 'none', stroke: 'none', fontSize: fs });
  (o.outputs ?? []).forEach((l, r) => l && r < total && push({ shape: 'text', label: l, align: 'left', x: x1 + lg, y: ys[r] - 10, w: Math.max(20, measure(l, fs) + 4), h: 20, fill: 'none', stroke: 'none', fontSize: fs }));

  const yTop = ys[0] - G / 2, yBot = ys[total - 1] + G / 2;
  opCols.forEach((ops, ci) => {
    const cx = xs[ci];
    for (const op of ops) {
      const col = color(op);
      const w = width(op);
      switch (op.kind) {
        case 'gate':
          push({ shape: 'qc-gate', label: op.label, x: cx - w / 2, y: ys[op.r0] - G / 2, w, h: ys[op.r1] - ys[op.r0] + G, radius: rad, count: op.r1 - op.r0 + 1, ...col, ...base }, ci);
          break;
        case 'ctrl': {
          const bw = op.boxed ? w : op.tokens?.includes('m') ? G + 4 : G;
          const c2 = op.boxed || op.name === 'M' ? col : { fill: '#FFFFFF', stroke: col === WHITE ? QC_INK : col.stroke };
          push({ shape: 'qc-ctrl', spec: op.tokens!.join(' '), label: op.label, x: cx - bw / 2, y: ys[op.r0] - P / 2, w: bw, h: (op.r1 - op.r0 + 1) * P, radius: rad, ...c2, ...base, ...(op.name === 'M' && col === WHITE ? { stroke: QC_INK } : {}) }, ci);
          break;
        }
        case 'meter':
          push({ shape: 'qc-meter', x: cx - w / 2, y: ys[op.r0] - G / 2, w, h: G, radius: rad, ...col, ...base }, ci);
          break;
        case 'barrier':
          push({ shape: 'qc-barrier', spec: 'band', x: cx - 5, y: ys[op.r0] - P / 2 + 4, w: 10, h: ys[op.r1] - ys[op.r0] + P - 8, fill: BAND, stroke: '#8A8F98', strokeWidth: 1 }, ci);
          break;
        case 'slice':
          push({ shape: 'qc-barrier', spec: '', label: op.label, labelPos: o.sliceLabels ?? 'below', x: cx - 6, y: yTop - 6, w: 12, h: yBot - yTop + 12, fill: 'none', stroke: '#8A8F98', strokeWidth: 1, fontSize: fs - 1 }, ci);
          break;
        case 'dots':
          push({ shape: 'rect', label: op.label, x: cx - 11, y: ys[op.r0] - 7, w: 22, h: 14, radius: 0, fill: '#FFFFFF', stroke: 'none', fontSize: fs }, ci);
          break;
        case 'text':
          push({ shape: 'text', label: op.label, x: cx - w / 2, y: (ys[op.r0] + ys[op.r1]) / 2 - 10, w, h: 20, fill: 'none', stroke: 'none', fontSize: fs }, ci);
          break;
        default:
          break;
      }
    }
  });
  const outW = Math.max(0, ...(o.outputs ?? []).map((l) => (l ? measure(l, fs) + lg : 0)));
  const bx = x - (inW ? inW + lg : 0);
  const sliceLab = opCols.some((ops) => ops.some((op) => op.kind === 'slice' && op.label)) ? fs * 1.4 + 6 : 0;
  const by = yTop - 6 - (o.sliceLabels === 'above' ? sliceLab : 0);
  const bb = yBot + 6 + (o.sliceLabels === 'above' ? 0 : sliceLab);
  return { items, colOf, ys, xs, left, right, x0: x, x1, nq, box: { x: bx, y: by, w: x1 + outW - bx, h: bb - by } };
}

/** Dispone un circuito con fili, porte e misure come nodi modificabili (vedi l'intestazione). */
export function circuit(t: Builder, x: number, y: number, cols: string[], opts: CircuitOpts = {}): Circuit {
  const L = layoutCircuit(x, y, cols, opts);
  const P = opts.pitch ?? QC_PITCH, G = opts.gate ?? QC_GATE;
  const nodes: N[] = [], wires: N[] = [];
  const ops: N[][] = L.xs.map(() => []);
  L.items.forEach((p, i) => {
    const n = t.add(p);
    nodes.push(n);
    if (p.shape === 'qc-wire') wires.push(n);
    if (L.colOf[i] >= 0) ops[L.colOf[i]].push(n);
  });
  const top = L.ys[0] - G / 2, bottom = L.ys[L.ys.length - 1] + G / 2;
  return {
    nodes,
    wires,
    ops,
    ys: L.ys,
    xs: L.xs,
    left: L.left,
    right: L.right,
    x0: L.x0,
    x1: L.x1,
    top,
    bottom,
    pitch: P,
    gate: G,
    around: (c0, c1, q0 = 0, q1 = L.nq - 1, pad = 6) => {
      const x0 = L.left[c0] - pad, x1 = L.right[c1] + pad;
      const y0 = L.ys[q0] - G / 2 - pad, y1 = L.ys[q1] + G / 2 + pad;
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    },
  };
}
