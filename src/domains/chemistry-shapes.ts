// Forme del modulo "Chimica e molecole": molecole (sfere e bastoncini, formula di struttura,
// grafo molecolare, SMILES, nuvola 3D con raggio di cutoff), cristalli, reazioni, profili e
// superfici di energia, docking, tavola periodica, spettri e vetreria di laboratorio.
// Tutte procedurali e deterministiche, disegnate con le primitive `Part`: identiche in SVG,
// PDF, PNG e TikZ. Le molecole hanno coordinate vere (2D da disegno e 3D ottimizzate con
// RDKit + MMFF), in fondo al file; le varianti si scelgono con `spec` (pulsanti in `specOptions`).
import { arc, mix, poly, rng, roundPoly, shade, smooth, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';

type P2 = [number, number];
type P3 = [number, number, number];
type N = NodeModel;
type Anchor = 'start' | 'middle' | 'end';

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const AXIS = '#8A9099';
const TEXT = '#4B5563';
const DARK = '#1F2937';
const STICK = ['#C9CDD3', '#80868E'];

const inkOf = (n: N, fb = '#333333') => (n.stroke === 'none' ? fb : n.stroke);
const has = (spec: string, word: string) => new RegExp(`(^|[^a-z0-9-])${word}([^a-z0-9-]|$)`, 'i').test(spec);
const kindOf = <T extends string>(spec: string, kinds: readonly T[], fb: T): T => kinds.find((k) => has(spec, k)) ?? fb;
const tint = (c: string, t: number) => mix(c, '#FFFFFF', t);

const line = (cmds: Cmd[], stroke: string, sw: number): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true });
const area = (cmds: Cmd[], fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'path', cmds, fill, stroke, sw, solid: true });
const disc = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true });
const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];
const text = (x: number, y: number, t: string, size: number, anchor: Anchor = 'middle', fill = TEXT, bold = false): Part => ({ kind: 'text', x, y, text: t, size, fill, anchor, bold });

const add = (a: P2, b: P2): P2 => [a[0] + b[0], a[1] + b[1]];
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const mul = (a: P2, k: number): P2 => [a[0] * k, a[1] * k];
const dot = (a: P2, b: P2) => a[0] * b[0] + a[1] * b[1];
const len = (a: P2) => Math.hypot(a[0], a[1]);
const unit = (a: P2): P2 => mul(a, 1 / (len(a) || 1));
const perp = (a: P2): P2 => [-a[1], a[0]];
const mean = (pts: P2[]): P2 => mul(pts.reduce((s, p) => add(s, p), [0, 0] as P2), 1 / Math.max(1, pts.length));

function head(tip: P2, dx: number, dy: number, size: number, color: string): Part {
  const u = unit([dx, dy]);
  const b = sub(tip, mul(u, size));
  const hw = size * 0.45;
  return { kind: 'path', fill: color, stroke: 'none', cmds: poly([tip, add(b, mul(perp(u), hw)), sub(b, mul(perp(u), hw))]) };
}

function arrow(a: P2, b: P2, color: string, sw: number, size: number, both = false): Part[] {
  const u = unit(sub(b, a));
  const cut = Math.min(size * 0.8, len(sub(b, a)) * 0.45);
  const s = both ? add(a, mul(u, cut)) : a;
  const parts = [line(seg(s, sub(b, mul(u, cut))), color, sw), head(b, u[0], u[1], size, color)];
  if (both) parts.push(head(a, -u[0], -u[1], size, color));
  return parts;
}

/** Tratteggio lungo una polilinea (le primitive non hanno un tratteggio proprio). */
function dashes(pts: P2[], on = 3, off = 2.5): Cmd[] {
  const out: Cmd[] = [];
  let drawing = true, left = on, pen = false;
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    let L = Math.hypot(bx - ax, by - ay);
    if (L === 0) continue;
    const ux = (bx - ax) / L, uy = (by - ay) / L;
    while (L > 1e-6) {
      const step = Math.min(left, L);
      const nx = ax + ux * step, ny = ay + uy * step;
      if (drawing) {
        if (!pen) {
          out.push(['M', ax, ay]);
          pen = true;
        }
        out.push(['L', nx, ny]);
      }
      ax = nx;
      ay = ny;
      L -= step;
      left -= step;
      if (left <= 1e-6) {
        drawing = !drawing;
        left = drawing ? on : off;
        pen = false;
      }
    }
  }
  return out;
}

const circlePts = (cx: number, cy: number, r: number, k = 72, ry = r): P2[] =>
  Array.from({ length: k + 1 }, (_, i): P2 => [cx + r * Math.cos((TAU * i) / k), cy + ry * Math.sin((TAU * i) / k)]);

/** Capsula (segmento con estremi arrotondati) da a a b, raggio r. */
function capsule(a: P2, b: P2, r: number): Cmd[] {
  const u = unit(sub(b, a)), nv = perp(u);
  const ang = Math.atan2(u[1], u[0]);
  const cmds: Cmd[] = [['M', ...add(a, mul(nv, r))], ['L', ...add(b, mul(nv, r))]];
  cmds.push(...arc(b[0], b[1], r, ang + Math.PI / 2, ang - Math.PI / 2).slice(1));
  cmds.push(['L', ...sub(a, mul(nv, r))]);
  cmds.push(...arc(a[0], a[1], r, ang - Math.PI / 2, ang - (3 * Math.PI) / 2).slice(1));
  cmds.push(['Z']);
  return cmds;
}

// ---------------- larghezza del testo (Helvetica, in em) ----------------

const CW: Record<string, number> = { i: 0.22, l: 0.22, j: 0.22, I: 0.28, f: 0.28, t: 0.28, r: 0.33, ' ': 0.28, '(': 0.33, ')': 0.33, ',': 0.28, '.': 0.28, '-': 0.33, m: 0.83, w: 0.72, M: 0.83, W: 0.94, '+': 0.58 };
const charW = (c: string) => CW[c] ?? (/[A-Z]/.test(c) ? 0.68 : /[0-9]/.test(c) ? 0.56 : 0.52);
const strW = (s: string) => [...s].reduce((t, c) => t + charW(c), 0);

/** Formula chimica in riga: `_n` è un pedice (es. 'K_2CO_3'). Testo dritto, senza LaTeX. */
function formulaW(s: string, size: number) {
  return s.split(/(_\d+)/).reduce((t, r) => t + (r.startsWith('_') ? strW(r.slice(1)) * size * 0.7 : strW(r) * size), 0);
}
function formula(x: number, y: number, s: string, size: number, color: string, anchor: Anchor = 'middle'): Part[] {
  const total = formulaW(s, size);
  let cx = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
  const parts: Part[] = [];
  for (const r of s.split(/(_\d+)/)) {
    if (!r) continue;
    const isSub = r.startsWith('_');
    const t = isSub ? r.slice(1) : r;
    const sz = isSub ? size * 0.7 : size;
    parts.push(text(cx, isSub ? y + size * 0.3 : y, t, sz, 'start', color));
    cx += strW(t) * sz;
  }
  return parts;
}

// ======================================================================
// Atomi: colori CPK ammorbiditi
// ======================================================================

const CPK: Record<string, [string, string]> = {
  H: ['#FFFFFF', '#9AA0A6'],
  C: ['#8E949C', '#4E545C'],
  N: ['#8DB0E6', '#3F6DB5'],
  O: ['#F2938B', '#B8473F'],
  S: ['#F3D86E', '#A88A22'],
  Cl: ['#93D48D', '#4E9A48'],
  F: ['#B9E2A2', '#69A853'],
  Br: ['#C99278', '#8A4F35'],
  I: ['#B794D4', '#76509A'],
  P: ['#F6B877', '#C07A2E'],
  B: ['#F4C7A6', '#BF8A60'],
  Na: ['#B9A3E3', '#7360AE'],
  Cs: ['#C7A6E8', '#7D58A8'],
  Sr: ['#93D48D', '#4E9A48'],
  Ti: ['#8DB0E6', '#3F6DB5'],
  M: ['#A9B8D6', '#5F739A'],
  X: ['#E3C6E8', '#9673A6'],
};
const cpk = (el: string) => CPK[el] ?? CPK.X;
/** Colore delle etichette degli eteroatomi nelle formule (come nei paper di chimica). */
const LABEL_INK: Record<string, string> = { O: '#C0392B', N: '#2F5FB0', S: '#A07D12', Cl: '#2E8B57', F: '#3E8E41', Br: '#8A4B32', I: '#6A3E8E', P: '#C0702E', B: '#B26A2A' };
const BALL: Record<string, number> = { H: 0.24, C: 0.36, N: 0.35, O: 0.34, S: 0.46, Cl: 0.44, Br: 0.48, F: 0.32, P: 0.44, B: 0.36 };
const VDW: Record<string, number> = { H: 1.1, C: 1.7, N: 1.55, O: 1.52, S: 1.8, Cl: 1.75, Br: 1.85, F: 1.47, P: 1.8, B: 1.92 };

/** Sfera lucida: disco, riflesso diffuso e punto speculare; `fog` schiarisce gli atomi lontani. */
function sphere(cx: number, cy: number, r: number, el: string, fog = 0, flat = false, sw = 0.8): Part[] {
  const [f0, k0] = cpk(el);
  const f = tint(f0, fog), k = tint(k0, fog * 0.8);
  const parts: Part[] = [disc(cx, cy, r, el === 'H' ? '#F1F2F4' : f, k, Math.min(sw, r * 0.25))];
  if (!flat && r > 2) parts.push(disc(cx - r * 0.2, cy - r * 0.22, r * 0.68, tint(f, el === 'H' ? 1 : 0.28)), disc(cx - r * 0.34, cy - r * 0.38, r * 0.24, tint(f, 0.78)));
  return parts;
}

// ======================================================================
// Molecole: dati e utilità
// ======================================================================

interface MolData {
  a: string;
  h: string;
  r: number[][];
  xy: number[];
  b: number[];
  a3: string;
  xyz: number[];
  b3: number[];
}
interface Bond {
  i: number;
  j: number;
  o: number;
  ar: boolean;
}
interface Mol2 {
  el: string[];
  hs: number[];
  p: P2[];
  bonds: Bond[];
  rings: number[][];
}
interface Mol3 {
  el: string[];
  p: P3[];
  bonds: Bond[];
}

const cache2 = new Map<string, Mol2>();
const cache3 = new Map<string, Mol3>();

function mol2(name: string): Mol2 {
  const hit = cache2.get(name);
  if (hit) return hit;
  const d = MOLS[name] ?? MOLS.caffeine;
  const el = d.a.split(' ');
  const bonds: Bond[] = [];
  for (let k = 0; k < d.b.length; k += 4) bonds.push({ i: d.b[k], j: d.b[k + 1], o: d.b[k + 2], ar: d.b[k + 3] === 1 });
  const m: Mol2 = { el, hs: [...d.h].map(Number), p: el.map((_, i): P2 => [d.xy[2 * i], d.xy[2 * i + 1]]), bonds, rings: d.r };
  cache2.set(name, m);
  return m;
}

function mol3(name: string): Mol3 {
  const hit = cache3.get(name);
  if (hit) return hit;
  const d = MOLS[name] ?? MOLS.caffeine;
  const el = d.a3.split(' ');
  const bonds: Bond[] = [];
  for (let k = 0; k < d.b3.length; k += 3) bonds.push({ i: d.b3[k], j: d.b3[k + 1], o: d.b3[k + 2], ar: false });
  const m: Mol3 = { el, p: el.map((_, i): P3 => [d.xyz[3 * i], d.xyz[3 * i + 1], d.xyz[3 * i + 2]]), bonds };
  cache3.set(name, m);
  return m;
}

/** Catena a zig-zag di k atomi di carbonio. */
function chainMol(k: number): Mol2 {
  const c = clamp(Math.round(k), 2, 16);
  const p = Array.from({ length: c }, (_, i): P2 => [i * 0.866 - ((c - 1) * 0.866) / 2, i % 2 ? -0.25 : 0.25]);
  const bonds = Array.from({ length: c - 1 }, (_, i): Bond => ({ i, j: i + 1, o: 1, ar: false }));
  return { el: p.map(() => 'C'), hs: p.map((_, i) => (i === 0 || i === c - 1 ? 3 : 2)), p, bonds, rings: [] };
}

/** Anello di k atomi (lato unitario), con un vertice in alto. */
function ringMol(k: number): Mol2 {
  const c = clamp(Math.round(k), 3, 8);
  const R = 0.5 / Math.sin(Math.PI / c);
  const p = Array.from({ length: c }, (_, i): P2 => [R * Math.cos(-Math.PI / 2 + (TAU * i) / c), R * Math.sin(-Math.PI / 2 + (TAU * i) / c)]);
  const bonds = Array.from({ length: c }, (_, i): Bond => ({ i, j: (i + 1) % c, o: 1, ar: false }));
  return { el: p.map(() => 'C'), hs: p.map(() => 2), p, bonds, rings: [p.map((_, i) => i)] };
}

function molFromSpec(n: N, fb: string): Mol2 {
  if (has(n.spec, 'chain')) return chainMol(n.count);
  if (has(n.spec, 'ring')) return ringMol(n.count);
  return mol2(kindOf(n.spec, MOL_KEYS, fb));
}

/** Adatta i punti al riquadro: scala (lunghezza di un legame in px) e funzione di posizionamento. */
function fitPts(pts: P2[], x: number, y: number, w: number, h: number, pad: number, maxL = 60) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const L = Math.max(0.5, Math.min((w - 2 * pad) / Math.max(x1 - x0, 1e-3), (h - 2 * pad) / Math.max(y1 - y0, 1e-3), maxL));
  const cx = x + w / 2, cy = y + h / 2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  return { L, at: (p: P2): P2 => [cx + (p[0] - mx) * L, cy + (p[1] - my) * L] };
}

const neighbours = (m: Mol2) => {
  const nb: number[][] = m.el.map(() => []);
  for (const b of m.bonds) {
    nb[b.i].push(b.j);
    nb[b.j].push(b.i);
  }
  return nb;
};

// ---------------- scomposizione ad albero (JT-VAE, Jin et al. 2018) ----------------

const JT_COLORS = ['#4F81B8', '#2F6B35', '#E8953A', '#8E2A1A', '#F2D04B', '#86C35A', '#86C35A', '#9673A6', '#45A29E', '#D46A8F', '#8C6A55', '#6C8EBF'];
const JT_ATOM = '#A8ACB2';

interface Cluster {
  atoms: number[];
  color: string;
  at: P2;
  ring: boolean;
}

/** Cluster di JT-VAE: anelli, legami fuori dagli anelli e atomi condivisi da 3+ cluster; archi dell'albero. */
function jtClusters(m: Mol2): { cl: Cluster[]; edges: [number, number][] } {
  const rings = [...m.rings].sort((a, b) => b.length - a.length);
  const inRing = (i: number, j: number) => m.rings.some((r) => r.includes(i) && r.includes(j));
  const bonds = m.bonds.filter((b) => !inRing(b.i, b.j)).reverse();
  const cl: Cluster[] = [];
  let k = 0;
  for (const r of rings) cl.push({ atoms: r, color: JT_COLORS[k++ % JT_COLORS.length], at: mean(r.map((i) => m.p[i])), ring: true });
  for (const b of bonds) cl.push({ atoms: [b.i, b.j], color: JT_COLORS[k++ % JT_COLORS.length], at: mean([m.p[b.i], m.p[b.j]]), ring: false });
  const count = m.el.map((_, i) => cl.filter((c) => c.atoms.includes(i)).length);
  const single = new Set(m.el.map((_, i) => i).filter((i) => count[i] >= 3));
  const base = cl.length;
  for (const i of single) cl.push({ atoms: [i], color: JT_ATOM, at: m.p[i], ring: false });
  // archi pesati per atomi condivisi; gli atomi singoli fanno da snodo
  const cand: [number, number, number][] = [];
  for (let a = 0; a < base; a++)
    for (let b = a + 1; b < base; b++) {
      const shared = cl[a].atoms.filter((i) => cl[b].atoms.includes(i) && !single.has(i));
      if (shared.length) cand.push([a, b, shared.length]);
    }
  cl.forEach((c, s) => {
    if (s < base) return;
    for (let a = 0; a < base; a++) if (cl[a].atoms.includes(c.atoms[0])) cand.push([a, s, 1]);
  });
  cand.sort((p, q) => q[2] - p[2]);
  const root = cl.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  const edges: [number, number][] = [];
  for (const [a, b] of cand) {
    const ra = find(a), rb = find(b);
    if (ra === rb) continue;
    root[ra] = rb;
    edges.push([a, b]);
  }
  return { cl, edges };
}

// ======================================================================
// Formula di struttura (scheletrica)
// ======================================================================

interface SkelOpts {
  ink: string;
  sw: number;
  fs: number;
  color: boolean;
  circle: boolean;
  clusters?: boolean;
}

type HSide = 'right' | 'left' | 'down' | 'up';

/** Lato più libero per gli idrogeni: a destra se possibile, poi a sinistra, sotto, sopra. */
function hSide(dirs: P2[], el: string): HSide {
  if (!dirs.length) return el === 'O' || el === 'S' ? 'left' : 'right';
  const cands: [HSide, P2][] = [['right', [1, 0]], ['left', [-1, 0]], ['down', [0, 1]], ['up', [0, -1]]];
  const score = (v: P2) => Math.max(...dirs.map((d) => dot(d, v)));
  return (cands.find(([, v]) => score(v) < 0.35) ?? cands.reduce((a, b) => (score(b[1]) < score(a[1]) ? b : a)))[0];
}

function atomLabel(x: number, y: number, el: string, hs: number, fs: number, color: string, side: HSide): Part[] {
  const we = strW(el) * fs;
  if (!hs) return [text(x, y, el, fs, 'middle', color)];
  const ss = fs * 0.7, digits = hs > 1 ? String(hs) : '';
  const parts: Part[] = [];
  if (side === 'down' || side === 'up') {
    const hy = y + (side === 'down' ? 1 : -1) * fs * 1.02;
    parts.push(text(x, y, el, fs, 'middle', color), text(x - (digits ? strW(digits) * ss * 0.5 : 0), hy, 'H', fs, 'middle', color));
    if (digits) parts.push(text(x + strW('H') * fs * 0.5 - strW(digits) * ss * 0.5, hy + fs * 0.3, digits, ss, 'start', color));
    return parts;
  }
  if (side === 'right') {
    let cx = x - we / 2;
    parts.push(text(cx, y, el, fs, 'start', color));
    cx += we;
    parts.push(text(cx, y, 'H', fs, 'start', color));
    cx += strW('H') * fs;
    if (digits) parts.push(text(cx, y + fs * 0.3, digits, ss, 'start', color));
  } else {
    let cx = x + we / 2;
    parts.push(text(cx, y, el, fs, 'end', color));
    cx -= we;
    if (digits) {
      parts.push(text(cx, y + fs * 0.3, digits, ss, 'end', color));
      cx -= strW(digits) * ss;
    }
    parts.push(text(cx, y, 'H', fs, 'end', color));
  }
  return parts;
}

function clusterParts(m: Mol2, at: (p: P2) => P2, L: number): Part[] {
  const { cl } = jtClusters(m);
  const back: Part[] = [], dots: Part[] = [];
  for (const c of cl) {
    const P = c.atoms.map((i) => at(m.p[i]));
    const g = at(c.at);
    if (c.ring) back.push(disc(g[0], g[1], Math.max(...P.map((p) => len(sub(p, g)))) + L * 0.32, tint(c.color, 0.72)));
    else if (P.length === 2) back.push(area(capsule(P[0], P[1], L * 0.26), tint(c.color, 0.72)));
    dots.push(disc(g[0], g[1], L * (c.atoms.length === 1 ? 0.2 : 0.22), c.color));
  }
  return [...back, ...dots];
}

function skeletalParts(m: Mol2, at: (p: P2) => P2, L: number, o: SkelOpts): Part[] {
  const parts: Part[] = [];
  const P = m.p.map(at);
  const nb = neighbours(m);
  const shown = m.el.map((e, i) => e !== 'C' || nb[i].length === 0);
  const gap = o.fs * 0.6;
  const ink = o.clusters ? '#7D838B' : o.ink;
  if (o.clusters) parts.push(...clusterParts(m, at, L));
  const cmds: Cmd[] = [];
  const ringOf = (i: number, j: number) => m.rings.filter((r) => r.includes(i) && r.includes(j)).sort((a, b) => a.length - b.length)[0];
  for (const b of m.bonds) {
    const a = P[b.i], c = P[b.j];
    const u = unit(sub(c, a)), nv = perp(u);
    const a1 = shown[b.i] ? add(a, mul(u, gap)) : a;
    const c1 = shown[b.j] ? sub(c, mul(u, gap)) : c;
    const order = b.ar && o.circle ? 1 : b.o;
    if (order === 1) {
      cmds.push(...seg(a1, c1));
      continue;
    }
    if (order === 3) {
      const off = L * 0.15;
      cmds.push(...seg(a1, c1), ...seg(add(a1, mul(nv, off)), add(c1, mul(nv, off))), ...seg(sub(a1, mul(nv, off)), sub(c1, mul(nv, off))));
      continue;
    }
    const off = L * 0.18;
    const ring = ringOf(b.i, b.j);
    let side = 0;
    if (ring) side = dot(sub(mean(ring.map((i) => P[i])), a), nv) > 0 ? 1 : -1;
    else if (nb[b.i].length > 1 && nb[b.j].length > 1) {
      const s = [...nb[b.i].filter((k) => k !== b.j).map((k) => dot(sub(P[k], a), nv)), ...nb[b.j].filter((k) => k !== b.i).map((k) => dot(sub(P[k], c), nv))].reduce((t, v) => t + v, 0);
      side = s >= 0 ? 1 : -1;
    }
    if (!side) {
      const hh = off / 2;
      cmds.push(...seg(add(a1, mul(nv, hh)), add(c1, mul(nv, hh))), ...seg(sub(a1, mul(nv, hh)), sub(c1, mul(nv, hh))));
    } else {
      const s = L * 0.13;
      const ia = add(add(a1, mul(u, shown[b.i] ? 0 : s)), mul(nv, off * side));
      const ic = add(sub(c1, mul(u, shown[b.j] ? 0 : s)), mul(nv, off * side));
      cmds.push(...seg(a1, c1), ...seg(ia, ic));
    }
  }
  parts.push(line(cmds, ink, o.sw));
  if (o.circle)
    for (const r of m.rings) {
      const arom = r.every((i, k) => m.bonds.some((b) => b.ar && ((b.i === i && b.j === r[(k + 1) % r.length]) || (b.j === i && b.i === r[(k + 1) % r.length]))));
      if (!arom) continue;
      const g = mean(r.map((i) => P[i]));
      const ap = mean(r.map((i, k) => mean([P[i], P[r[(k + 1) % r.length]]])).map((q) => [len(sub(q, g)), 0] as P2))[0];
      parts.push(line(circlePts(g[0], g[1], ap * 0.6, 48).flatMap((p, k): Cmd[] => [[k ? 'L' : 'M', p[0], p[1]]]), ink, o.sw));
    }
  m.el.forEach((e, i) => {
    if (!shown[i]) return;
    const side = hSide(nb[i].map((k) => unit(sub(P[k], P[i]))), e);
    parts.push(...atomLabel(P[i][0], P[i][1], e, m.hs[i], o.fs, o.color ? (LABEL_INK[e] ?? ink) : ink, side));
  });
  return parts;
}

/** Riquadro della molecola in unità di legame, compreso lo spazio per le etichette. */
function molBox(m: Mol2) {
  const nb = neighbours(m);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  m.p.forEach((p, i) => {
    const lab = m.el[i] !== 'C' || !nb[i].length;
    const ex = lab ? 0.32 + (m.hs[i] ? 0.45 : 0) : 0, ey = lab ? 0.3 : 0;
    x0 = Math.min(x0, p[0] - ex);
    x1 = Math.max(x1, p[0] + ex);
    y0 = Math.min(y0, p[1] - ey);
    y1 = Math.max(y1, p[1] + ey);
  });
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function skeletalShape(n: N): Part[] {
  const m = molFromSpec(n, 'aspirin');
  const bx = molBox(m);
  const pad = 2;
  const L = Math.max(1, Math.min((n.w - 2 * pad) / Math.max(bx.w, 0.8), (n.h - 2 * pad) / Math.max(bx.h, 0.8), 46));
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  const at = (p: P2): P2 => [cx + (p[0] - bx.cx) * L, cy + (p[1] - bx.cy) * L];
  const fs = clamp(L * 0.52, 5, 15);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(n.radius, n.w / 2, n.h / 2), fill: n.fill });
  parts.push(...skeletalParts(m, at, L, { ink: inkOf(n), sw: n.strokeWidth, fs, color: has(n.spec, 'color'), circle: has(n.spec, 'circle'), clusters: has(n.spec, 'clusters') }));
  return parts;
}

// ======================================================================
// Grafo molecolare (nodi = atomi, archi = legami) e albero di giunzione
// ======================================================================

const luminance = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return Number.isNaN(v) ? 1 : (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
};

function molGraphShape(n: N): Part[] {
  const m = molFromSpec(n, 'paracetamol');
  const jt = has(n.spec, 'jtree'), labels = has(n.spec, 'labels'), mono = has(n.spec, 'mono'), msgs = has(n.spec, 'messages');
  const pad = Math.min(n.w, n.h) * 0.08 + 3;
  const { L, at } = fitPts(m.p, n.x, n.y, n.w, n.h, pad, 40);
  const r = clamp(L * (labels ? 0.3 : 0.24), 2.2, 13);
  const edgeInk = mono ? shade(inkOf(n), -0.1) : '#5B6068';
  const sw = n.strokeWidth;
  const parts: Part[] = [];
  if (jt) {
    const { cl, edges } = jtClusters(m);
    const rr = clamp(L * 0.26, 2.4, 13);
    parts.push(line(edges.flatMap(([a, b]) => seg(at(cl[a].at), at(cl[b].at))), '#333333', sw));
    for (const c of cl) {
      const g = at(c.at);
      parts.push(disc(g[0], g[1], rr, c.color, shade(c.color, -0.25), 0.8));
    }
    return parts;
  }
  const P = m.p.map(at);
  const nb = neighbours(m);
  const t = clamp(Math.round(n.count), 1, m.el.length) - 1;
  if (msgs) parts.push(disc(P[t][0], P[t][1], r * 2.1, '#FFF2CC', '#D6B656', 1));
  const solid: Cmd[] = [], dash: Cmd[] = [];
  const ringOf = (i: number, j: number) => m.rings.find((q) => q.includes(i) && q.includes(j));
  for (const b of m.bonds) {
    const a = P[b.i], c = P[b.j];
    const u = unit(sub(c, a)), nv = perp(u);
    if (b.ar) {
      const ring = ringOf(b.i, b.j);
      const side = ring && dot(sub(mean(ring.map((i) => P[i])), a), nv) < 0 ? -1 : 1;
      const off = L * 0.16, s = L * 0.2;
      solid.push(...seg(a, c));
      dash.push(...dashes([add(add(a, mul(u, s)), mul(nv, off * side)), add(sub(c, mul(u, s)), mul(nv, off * side))], Math.max(1.5, L * 0.09), Math.max(1.2, L * 0.07)));
    } else if (b.o === 1) solid.push(...seg(a, c));
    else {
      const offs = b.o === 2 ? [-0.09, 0.09] : [-0.14, 0, 0.14];
      for (const k of offs) solid.push(...seg(add(a, mul(nv, L * k)), add(c, mul(nv, L * k))));
    }
  }
  parts.push(line(solid, edgeInk, sw));
  if (dash.length) parts.push(line(dash, edgeInk, sw * 0.85));
  if (msgs)
    for (const j of nb[t]) {
      const u = unit(sub(P[t], P[j]));
      const a = add(P[j], mul(u, r * 1.1)), b = sub(P[t], mul(u, r * 1.15));
      parts.push(...arrow(a, b, '#D9822B', Math.max(1.6, sw * 1.5), clamp(L * 0.24, 4, 8)));
    }
  m.el.forEach((e, i) => {
    const [f, k] = mono ? [n.fill === 'none' ? '#5A5F66' : n.fill, inkOf(n)] : cpk(e);
    const hl = msgs && (i === t || nb[t].includes(i));
    parts.push(disc(P[i][0], P[i][1], r, f, hl ? (i === t ? '#B8860B' : '#D9822B') : k, hl ? 1.6 : 1));
    if (labels) parts.push(text(P[i][0], P[i][1], e, clamp(r * (e.length > 1 ? 0.85 : 1.05), 5, 12), 'middle', luminance(f) < 0.55 ? '#FFFFFF' : DARK));
  });
  return parts;
}

// ======================================================================
// Scene 3D: sfere e bastoncini, nuvola di atomi, cristalli
// ======================================================================

/** Rotazione: imbardata attorno all'asse verticale, poi beccheggio (z verso chi guarda). */
function rotator(yaw: number, pitch: number) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (p: P3): P3 => {
    const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
    return [x1, p[1] * cp - z1 * sp, p[1] * sp + z1 * cp];
  };
}

interface Item {
  z: number;
  parts: Part[];
}
const paint = (items: Item[]) => items.sort((a, b) => a.z - b.z).flatMap((i) => i.parts);

/** Proiezione ortografica nel riquadro: scala e centro, dati i raggi degli atomi (in Å). */
function fit3(pts: P3[], radii: number[], x: number, y: number, w: number, h: number, pad: number) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  pts.forEach((p, i) => {
    x0 = Math.min(x0, p[0] - radii[i]);
    x1 = Math.max(x1, p[0] + radii[i]);
    y0 = Math.min(y0, p[1] - radii[i]);
    y1 = Math.max(y1, p[1] + radii[i]);
  });
  const s = Math.max(0.5, Math.min((w - 2 * pad) / Math.max(x1 - x0, 0.5), (h - 2 * pad) / Math.max(y1 - y0, 0.5)));
  const zs = pts.map((p) => p[2]);
  const z0 = Math.min(...zs), z1 = Math.max(...zs);
  return {
    s,
    at: (p: P3): P2 => [x + w / 2 + (p[0] - (x0 + x1) / 2) * s, y + h / 2 + (p[1] - (y0 + y1) / 2) * s],
    fog: (z: number) => (z1 - z0 < 1e-3 ? 0 : (1 - (z - z0) / (z1 - z0)) * 0.3),
  };
}

/** Bastoncino tra due atomi; con `order` > 1 legami paralleli più sottili. */
function stick(a: P2, b: P2, rw: number, order: number, fog: number, cols = STICK): Part[] {
  const u = unit(sub(b, a)), nv = perp(u);
  const offs = order === 2 ? [-1, 1] : order === 3 ? [-1.6, 0, 1.6] : [0];
  const w = order > 1 ? rw * 0.62 : rw;
  return offs.map((k) => {
    const o = mul(nv, k * rw * 0.95);
    const a1 = add(a, o), b1 = add(b, o);
    return area(poly([add(a1, mul(nv, w)), add(b1, mul(nv, w)), sub(b1, mul(nv, w)), sub(a1, mul(nv, w))]), tint(cols[0], fog), tint(cols[1], fog), 0.6);
  });
}

function ballStickShape(n: N): Part[] {
  const m = mol3(kindOf(n.spec, MOL_KEYS, 'caffeine'));
  const noH = has(n.spec, 'noh'), full = has(n.spec, 'spacefill'), labels = has(n.spec, 'labels'), flat = has(n.spec, 'flat');
  const R = rotator(((Math.round(n.count) % 24) * Math.PI) / 12, 0.3);
  const keep = m.el.map((e) => !(noH && e === 'H'));
  const idx = m.el.map((_, i) => i).filter((i) => keep[i]);
  const P = m.p.map(R);
  const rad = m.el.map((e) => (full ? (VDW[e] ?? 1.8) * 0.82 : BALL[e] ?? 0.45));
  const F = fit3(idx.map((i) => P[i]), idx.map((i) => rad[i]), n.x, n.y, n.w, n.h, 2);
  const S = m.el.map((_, i) => F.at(P[i]));
  const items: Item[] = [];
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(n.radius, n.w / 2, n.h / 2), fill: n.fill });
  for (const i of idx) {
    const r = rad[i] * F.s;
    const ps = sphere(S[i][0], S[i][1], r, m.el[i], F.fog(P[i][2]), flat, n.strokeWidth * 0.75);
    if (labels && m.el[i] !== 'H' && r > 4) ps.push(text(S[i][0], S[i][1], m.el[i], clamp(r * 0.95, 5, 13), 'middle', m.el[i] === 'C' ? '#FFFFFF' : DARK));
    items.push({ z: P[i][2], parts: ps });
  }
  if (!full)
    for (const b of m.bonds) {
      if (!keep[b.i] || !keep[b.j]) continue;
      // il bastoncino parte dal bordo dell'atomo più lontano, verso chi guarda
      const [bk, fr] = P[b.i][2] < P[b.j][2] ? [b.i, b.j] : [b.j, b.i];
      const d3 = [P[fr][0] - P[bk][0], P[fr][1] - P[bk][1], P[fr][2] - P[bk][2]];
      const l3 = Math.hypot(d3[0], d3[1], d3[2]) || 1;
      const start = add(S[bk], [(d3[0] / l3) * rad[bk] * F.s * 0.85, (d3[1] / l3) * rad[bk] * F.s * 0.85]);
      const z = (P[b.i][2] + P[b.j][2]) / 2;
      items.push({ z: z - 1e-3, parts: stick(start, S[fr], 0.1 * F.s, b.o, F.fog(z)) });
    }
  return [...parts, ...paint(items)];
}

// ---------------- molecola 3D come nuvola di punti (cutoff, vettori, rumore) ----------------

const NOISE_COLORS = ['#F2938B', '#8DB0E6', '#93D48D', '#F3D86E', '#B794D4', '#F6B877', '#8E949C', '#7FD1C7'];

function cloudShape(n: N): Part[] {
  const m = mol3(kindOf(n.spec, MOL_KEYS, 'aspirin'));
  const noH = has(n.spec, 'noh'), dark = has(n.spec, 'dark'), cutoff = has(n.spec, 'cutoff'), edges = has(n.spec, 'edges');
  const vectors = has(n.spec, 'vectors'), axes = has(n.spec, 'axes'), labels = has(n.spec, 'labels'), bonds = has(n.spec, 'bonds');
  const level = has(n.spec, 'noise-high') ? 3 : has(n.spec, 'noise-mid') ? 2 : has(n.spec, 'noise-low') ? 1 : 0;
  const sigma = [0, 0.3, 0.75, 1.5][level];
  const rand = rng(31 + m.el.length * 7 + level);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(TAU * rand());
  const idx = m.el.map((_, i) => i).filter((i) => !(noH && m.el[i] === 'H'));
  const el = m.el.map((e) => (level >= 2 && rand() < (level === 3 ? 0.85 : 0.45) ? 'Z' + Math.floor(rand() * NOISE_COLORS.length) : e));
  const R = rotator(0.55, 0.38);
  const P = m.p.map((p) => R([p[0] + sigma * gauss(), p[1] + sigma * gauss(), p[2] + sigma * gauss()] as P3));
  const rad = m.el.map((e) => (BALL[e] ?? 0.45) * (level ? 1.3 + 0.2 * level : 1.1));
  const parts: Part[] = [];
  const panel = dark ? '#15181D' : n.fill;
  if (panel !== 'none') parts.push({ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(n.radius, n.w / 2, n.h / 2), fill: panel });
  const pad = Math.min(n.w, n.h) * (cutoff ? 0.05 : 0.08) + 2;
  const F = fit3(idx.map((i) => P[i]), idx.map((i) => rad[i] + (cutoff ? 0 : 0)), n.x, n.y + (axes ? -n.h * 0.04 : 0), n.w, n.h, pad);
  const S = P.map((p) => F.at(p));
  const c = idx[clamp(Math.round(n.count), 1, idx.length) - 1];
  const rc = 2.6;
  const d3 = (i: number, j: number) => Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1], P[i][2] - P[j][2]);
  const inside = new Set(idx.filter((i) => len(sub(S[i], S[c])) <= rc * F.s));
  const items: Item[] = [];
  const bondInk = dark ? '#D5D9DF' : '#9AA0A6';
  if (bonds) {
    const cmds: Cmd[] = [];
    for (let a = 0; a < idx.length; a++)
      for (let b = a + 1; b < idx.length; b++) {
        const i = idx[a], j = idx[b];
        const lim = (m.el[i] === 'H' || m.el[j] === 'H' ? 1.25 : 1.7) + sigma * 0.8;
        if (d3(i, j) < lim) cmds.push(...seg(S[i], S[j]));
      }
    parts.push(line(cmds, bondInk, Math.max(0.8, F.s * 0.07)));
  }
  if (edges) {
    const cmds: Cmd[] = [];
    for (let a = 0; a < idx.length; a++)
      for (let b = a + 1; b < idx.length; b++) if (d3(idx[a], idx[b]) <= rc) cmds.push(...seg(S[idx[a]], S[idx[b]]));
    parts.push(line(cmds, dark ? '#8A9099' : '#B9BEC6', 0.7));
  }
  const accent = inkOf(n, '#C0392B');
  if (cutoff) {
    parts.push(area(circlePts(S[c][0], S[c][1], rc * F.s, 96).flatMap((p, k): Cmd[] => [[k ? 'L' : 'M', p[0], p[1]]]), tint(accent, 0.93)));
    parts.push(line(dashes(circlePts(S[c][0], S[c][1], rc * F.s, 96), 3, 2.5), accent, 1));
  }
  for (const i of idx) {
    const fog = F.fog(P[i][2]) + (cutoff && !inside.has(i) ? 0.45 : 0);
    const e = el[i];
    const ps = e.startsWith('Z')
      ? [disc(S[i][0], S[i][1], rad[i] * F.s, tint(NOISE_COLORS[+e.slice(1)], fog), tint(shade(NOISE_COLORS[+e.slice(1)], -0.3), fog), 0.7)]
      : sphere(S[i][0], S[i][1], rad[i] * F.s, e, fog, false, 0.7);
    items.push({ z: P[i][2], parts: ps });
  }
  const top: Part[] = [];
  if (cutoff) {
    const cm: Cmd[] = [];
    for (const j of inside) if (j !== c) cm.push(...seg(S[c], S[j]));
    top.push(line(cm, accent, 1.1));
    // il raggio punta dove ci sono meno atomi
    const angs = [...inside].filter((j) => j !== c).map((j) => Math.atan2(S[j][1] - S[c][1], S[j][0] - S[c][0]));
    const gapTo = (a: number) => Math.min(Math.PI, ...angs.map((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))));
    const ang = Array.from({ length: 24 }, (_, k) => (k * TAU) / 24).reduce((a, b) => (gapTo(b) > gapTo(a) ? b : a));
    const u: P2 = [Math.cos(ang), Math.sin(ang)];
    const e = add(S[c], mul(u, rc * F.s));
    top.push(...arrow(S[c], e, accent, 1, 4));
    if (labels) top.push(text(...add(e, mul(u, 9)), '$r_c$', clamp(F.s * 0.5, 8, 12), 'middle', accent));
  }
  if (vectors) {
    const vr = rng(5 + m.el.length);
    for (const i of idx) {
      if (m.el[i] === 'H' && !noH) continue;
      const a = vr() * TAU, l = (0.6 + vr() * 0.5) * F.s;
      const s: P2 = add(S[i], [Math.cos(a) * rad[i] * F.s, Math.sin(a) * rad[i] * F.s]);
      top.push(...arrow(s, add(s, [Math.cos(a) * l, Math.sin(a) * l]), '#E07A5F', 1.1, 4));
    }
  }
  if (axes) {
    const o: P2 = [n.x + Math.min(n.w, n.h) * 0.1 + 4, n.y + n.h - Math.min(n.w, n.h) * 0.1 - 4];
    const l = clamp(Math.min(n.w, n.h) * 0.13, 9, 18);
    const R2 = rotator(0.55, 0.38);
    const ax: [P3, string][] = [[[1, 0, 0], '$x$'], [[0, -1, 0], '$y$'], [[0, 0, 1], '$z$']];
    for (const [v, lab] of ax) {
      const q = R2(v);
      const e = add(o, [q[0] * l, q[1] * l]);
      top.push(...arrow(o, e, dark ? '#D5D9DF' : '#555555', 0.9, 3.2), text(e[0] + q[0] * 6, e[1] + q[1] * 6, lab, 8, 'middle', dark ? '#D5D9DF' : TEXT));
    }
  }
  return [...parts, ...paint(items), ...top];
}

// ======================================================================
// SMILES: stringa divisa in token (Schwaller et al.) e fingerprint a bit
// ======================================================================

const SMI_RE = /(\[[^\]]+\]|>>|Br|Cl|Si|@@|%\d{2}|[BCNOSPFIbcnosp]|\(|\)|\.|=|#|-|\+|\\|\/|:|~|@|\?|>|\*|\$|\d)/g;
const SMI_FLAGS = ['mono', 'bits'];

function tokenColor(t: string): [string, string] {
  if (/^\d$|^%/.test(t)) return ['#FFF2CC', '#D6B656'];
  if (t === '(' || t === ')') return ['#F2F3F5', '#8A9099'];
  if (/^[=#\-:/\\~]$/.test(t)) return ['#E1D5E7', '#9673A6'];
  if (t === '.' || t === '>>' || t === '>') return ['#FFFFFF', '#555555'];
  const el = t.replace(/^\[|\].*$|[^A-Za-z]/g, '').replace(/^([a-z])/, (c) => c.toUpperCase()).replace(/^([A-Z][a-z]?).*/, '$1');
  if (el === 'C' || el === 'H') return ['#EEF0F3', '#8E949C'];
  const [f, k] = cpk(el);
  return [tint(f, 0.5), k];
}

function smilesShape(n: N): Part[] {
  const words = n.spec.trim().split(/\s+/).filter(Boolean);
  const smi = words.find((w) => !SMI_FLAGS.includes(w)) ?? 'CC(=O)Oc1ccccc1C(=O)O';
  const { x, y, w, h } = n;
  const vertical = h > w * 1.5;
  const parts: Part[] = [];
  if (has(n.spec, 'bits')) {
    // fingerprint (ECFP): bit accesi derivati in modo deterministico dalla stringa
    const k = clamp(n.count >= 8 ? Math.round(n.count) : 32, 8, 128);
    let hsh = 7;
    for (const ch of smi) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
    const rand = rng(hsh);
    const cw = (vertical ? h : w) / k;
    for (let i = 0; i < k; i++) {
      const on = rand() < 0.3;
      const r = vertical ? { x, y: y + i * cw, w, h: cw } : { x: x + i * cw, y, w: cw, h };
      parts.push({ kind: 'rect', ...r, r: 0, fill: on ? inkOf(n, '#3A3F47') : '#FFFFFF', stroke: '#9AA0A6', sw: 0.5, solid: true });
    }
    parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none', stroke: inkOf(n, '#3A3F47'), sw: 0.9, solid: true });
    return parts;
  }
  const toks = smi.match(SMI_RE) ?? [smi];
  const wt = toks.map((t) => clamp(t.length * 0.55, 1, 2.6));
  const total = wt.reduce((a, b) => a + b, 0);
  const span = vertical ? h : w;
  const unitW = span / total;
  const gap = clamp(unitW * 0.12, 0.8, 3);
  let pos = vertical ? y : x;
  toks.forEach((t, i) => {
    const sz = wt[i] * unitW;
    const r = vertical ? { x, y: pos + gap / 2, w, h: sz - gap } : { x: pos + gap / 2, y, w: sz - gap, h };
    const [f, k] = has(n.spec, 'mono') ? [n.fill, inkOf(n)] : tokenColor(t);
    parts.push({ kind: 'rect', ...r, r: Math.min(n.radius, r.w / 2, r.h / 2, 3), fill: f, stroke: k, sw: 0.8, solid: true });
    const fs = clamp(Math.min((r.w / Math.max(1, strW(t))) * 0.92, r.h * 0.56), 4, 14);
    parts.push(text(r.x + r.w / 2, r.y + r.h / 2, t.replace(/\\/g, '∖'), fs, 'middle', DARK));
    pos += sz;
  });
  return parts;
}

// ======================================================================
// Cristalli, celle periodiche, box di dinamica molecolare, grafo cristallino
// ======================================================================

interface Site {
  f: P3;
  el: string;
  r: number;
}

const LATTICES: Record<string, Site[]> = {
  sc: [{ f: [0, 0, 0], el: 'M', r: 0.22 }],
  bcc: [{ f: [0, 0, 0], el: 'M', r: 0.2 }, { f: [0.5, 0.5, 0.5], el: 'M', r: 0.2 }],
  fcc: [{ f: [0, 0, 0], el: 'M', r: 0.17 }, { f: [0.5, 0.5, 0], el: 'M', r: 0.17 }, { f: [0.5, 0, 0.5], el: 'M', r: 0.17 }, { f: [0, 0.5, 0.5], el: 'M', r: 0.17 }],
  nacl: [
    ...[[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]].map((f): Site => ({ f: f as P3, el: 'Cl', r: 0.17 })),
    ...[[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5], [0.5, 0.5, 0.5]].map((f): Site => ({ f: f as P3, el: 'Na', r: 0.11 })),
  ],
  cscl: [{ f: [0, 0, 0], el: 'Cs', r: 0.2 }, { f: [0.5, 0.5, 0.5], el: 'Cl', r: 0.17 }],
  perovskite: [{ f: [0, 0, 0], el: 'Sr', r: 0.17 }, { f: [0.5, 0.5, 0.5], el: 'Ti', r: 0.11 }, { f: [0.5, 0.5, 0], el: 'O', r: 0.1 }, { f: [0.5, 0, 0.5], el: 'O', r: 0.1 }, { f: [0, 0.5, 0.5], el: 'O', r: 0.1 }],
  diamond: [
    ...[[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]].map((f): Site => ({ f: f as P3, el: 'C', r: 0.085 })),
    ...[[0.25, 0.25, 0.25], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75]].map((f): Site => ({ f: f as P3, el: 'C', r: 0.085 })),
  ],
};
const BONDED: Record<string, number> = { nacl: 0.5, cscl: 0.87, perovskite: 0.5, diamond: 0.44 };
const CRYSTALS = ['nacl', 'perovskite', 'cscl', 'bcc', 'fcc', 'sc', 'diamond', 'graphene', 'liquid', 'graph', 'cell2d'] as const;

function framePanel(n: N): Part[] {
  return n.fill !== 'none' ? [{ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(n.radius, n.w / 2, n.h / 2), fill: n.fill }] : [];
}

function crystalShape(n: N): Part[] {
  const kind = kindOf(n.spec, CRYSTALS, 'nacl');
  if (kind === 'graphene') return grapheneShape(n);
  if (kind === 'graph') return crystalGraphShape(n);
  if (kind === 'cell2d') return cell2dShape(n);
  const rep = has(n.spec, 'supercell') ? 2 : 1;
  const R = rotator(-0.52, 0.42);
  const edgesInk = '#7A808A';
  const items: Item[] = [];
  const sites: { p: P3; el: string; r: number }[] = [];
  const corners: P3[] = [];
  for (const a of [0, rep]) for (const b of [0, rep]) for (const c of [0, rep]) corners.push([a - rep / 2, b - rep / 2, c - rep / 2]);
  if (kind === 'liquid') {
    // box di simulazione con molecole d'acqua orientate a caso
    const rand = rng(11);
    const k = clamp(Math.round(n.count) > 3 ? Math.round(n.count) : 16, 4, 40);
    const g = Math.ceil(Math.cbrt(k));
    const cells = Array.from({ length: g * g * g }, (_, i) => i).sort(() => rand() - 0.5).slice(0, k);
    for (const cell of cells) {
      const q = [cell % g, Math.floor(cell / g) % g, Math.floor(cell / (g * g))];
      const o = q.map((v) => ((v + 0.5 + (rand() - 0.5) * 0.6) / g - 0.5) * 0.86) as P3;
      const a = rand() * TAU, b = rand() * TAU, d = 0.085;
      const u: P3 = [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)];
      const v: P3 = [-Math.sin(a), 0, Math.cos(a)];
      sites.push({ p: o, el: 'O', r: 0.068 });
      for (const s of [1, -1]) sites.push({ p: [o[0] + d * (0.79 * u[0] + s * 0.61 * v[0]), o[1] + d * (0.79 * u[1] + s * 0.61 * v[1]), o[2] + d * (0.79 * u[2] + s * 0.61 * v[2])], el: 'H', r: 0.043 });
    }
  } else {
    const basis = LATTICES[kind] ?? LATTICES.nacl;
    for (const s of basis)
      for (let i = -1; i <= rep; i++)
        for (let j = -1; j <= rep; j++)
          for (let k = -1; k <= rep; k++) {
            const f: P3 = [s.f[0] + i, s.f[1] + j, s.f[2] + k];
            if (f.some((v) => v < -1e-6 || v > rep + 1e-6)) continue;
            sites.push({ p: [f[0] - rep / 2, f[1] - rep / 2, f[2] - rep / 2], el: s.el, r: s.r });
          }
  }
  const P = sites.map((s) => R(s.p));
  const C = corners.map(R);
  const F = fit3([...P, ...C], [...sites.map((s) => s.r), ...C.map(() => 0.02)], n.x, n.y, n.w, n.h, Math.min(n.w, n.h) * 0.04 + 2);
  const S = P.map((p) => F.at(p));
  const CS = C.map((p) => F.at(p));
  // spigoli della cella (le celle interne della supercella più sottili)
  const lines3: [P3, P3, boolean][] = [];
  for (let a = 0; a <= rep; a++)
    for (let b = 0; b <= rep; b++) {
      const outer = (v: number) => v === 0 || v === rep;
      const o = outer(a) && outer(b);
      const h = rep / 2;
      lines3.push([[-h, a - h, b - h], [h, a - h, b - h], o], [[a - h, -h, b - h], [a - h, h, b - h], o], [[a - h, b - h, -h], [a - h, b - h, h], o]);
    }
  for (const [a, b, outer] of lines3) {
    const pa = R(a), pb = R(b);
    const z = (pa[2] + pb[2]) / 2;
    items.push({ z: z - 0.05, parts: [line(seg(F.at(pa), F.at(pb)), tint(edgesInk, outer ? F.fog(z) : 0.45), outer ? 1 : 0.6)] });
  }
  const bondLen = BONDED[kind];
  if (bondLen && (has(n.spec, 'bonds') || kind === 'diamond'))
    for (let a = 0; a < sites.length; a++)
      for (let b = a + 1; b < sites.length; b++) {
        if (kind !== 'diamond' && sites[a].el === sites[b].el) continue;
        const d = Math.hypot(sites[a].p[0] - sites[b].p[0], sites[a].p[1] - sites[b].p[1], sites[a].p[2] - sites[b].p[2]);
        if (Math.abs(d - bondLen) > 0.02) continue;
        const z = (P[a][2] + P[b][2]) / 2, mid = mean([S[a], S[b]]);
        const fog = F.fog(z);
        items.push({
          z: z - 1e-3,
          parts: [...stick(S[a], mid, 0.02 * F.s, 1, fog, cpk(sites[a].el)), ...stick(mid, S[b], 0.02 * F.s, 1, fog, cpk(sites[b].el))],
        });
      }
  sites.forEach((s, i) => items.push({ z: P[i][2], parts: sphere(S[i][0], S[i][1], s.r * F.s, s.el, F.fog(P[i][2]), false, 0.8) }));
  const parts = [...framePanel(n), ...paint(items)];
  if (has(n.spec, 'vectors')) {
    const o = CS[0];
    const tips: [number, string][] = [[4, '$\\mathbf{a}$'], [2, '$\\mathbf{b}$'], [1, '$\\mathbf{c}$']];
    for (const [k, lab] of tips) {
      const e = CS[k];
      parts.push(...arrow(o, e, '#C0392B', 1.4, 5));
      const u = unit(sub(e, o));
      parts.push(text(e[0] + u[0] * 9, e[1] + u[1] * 9, lab, 11, 'middle', '#C0392B'));
    }
  }
  return parts;
}

/** Grafene: reticolo a nido d'ape visto dall'alto. */
function grapheneShape(n: N): Part[] {
  const k = clamp(Math.round(n.count) > 1 ? Math.round(n.count) : 4, 2, 10);
  const pts: P2[] = [];
  const key = (p: P2) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;
  const seen = new Map<string, number>();
  const bonds: [number, number][] = [];
  const at = (p: P2) => {
    const s = key(p);
    if (!seen.has(s)) {
      seen.set(s, pts.length);
      pts.push(p);
    }
    return seen.get(s)!;
  };
  const rows = Math.max(2, Math.round(k * 0.7));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < k; c++) {
      const cx = c * Math.sqrt(3) + (r % 2 ? Math.sqrt(3) / 2 : 0), cy = r * 1.5;
      const hex = Array.from({ length: 6 }, (_, i): P2 => [cx + Math.cos(-Math.PI / 2 + (i * TAU) / 6), cy + Math.sin(-Math.PI / 2 + (i * TAU) / 6)]).map(at);
      hex.forEach((a, i) => {
        const b = hex[(i + 1) % 6];
        if (!bonds.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) bonds.push([a, b]);
      });
    }
  const { L, at: to } = fitPts(pts, n.x, n.y, n.w, n.h, Math.min(n.w, n.h) * 0.06 + 3, 60);
  const S = pts.map(to);
  const parts = framePanel(n);
  parts.push(line(bonds.flatMap(([a, b]) => seg(S[a], S[b])), '#6B7179', Math.max(1, L * 0.12)));
  S.forEach((p) => parts.push(...sphere(p[0], p[1], L * 0.22, 'C', 0, false, 0.7)));
  return parts;
}

const CELL2D = ['#EF6A4C', '#6FC8B5'];

/** Cella periodica 2D (stile CDVAE): `noisy` = posizioni e tipi perturbati, `random` = inizializzazione casuale. */
function cell2dShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const noisy = has(n.spec, 'noisy'), random = has(n.spec, 'random');
  const base: [number, number, number][] = [[0.27, 0.3, 0], [0.73, 0.27, 1], [0.3, 0.72, 1], [0.72, 0.7, 0]];
  const k = clamp(Math.round(n.count) >= 2 ? Math.round(n.count) : 4, 2, 9);
  const rand = rng(7 + k + (noisy ? 3 : 0) + (random ? 5 : 0));
  const sites: [number, number, number][] = [];
  for (let i = 0; i < k; i++) {
    const b = base[i % 4];
    const fx = i < 4 ? b[0] : 0.2 + rand() * 0.6, fy = i < 4 ? b[1] : 0.2 + rand() * 0.6;
    sites.push(random ? [0.15 + rand() * 0.7, 0.15 + rand() * 0.7, rand() < 0.5 ? 0 : 1] : noisy ? [fx + (rand() - 0.5) * 0.28, fy + (rand() - 0.5) * 0.28, rand() < 0.3 ? 1 - b[2] : b[2]] : [fx, fy, b[2]]);
  }
  const s = Math.min(w, h);
  const parts: Part[] = [...framePanel(n)];
  const r0 = s * (random ? 0.07 : 0.12);
  sites.forEach(([fx, fy, t], i) => {
    const r = random ? r0 * (0.8 + 0.4 * rand()) : r0;
    const col = CELL2D[t];
    parts.push(disc(x + fx * w, y + fy * h, r, col, shade(col, -0.2), 0.6));
    if (random && i % 2) parts.push(disc(x + fx * w + r * 0.9, y + fy * h - r * 0.4, r * 0.7, CELL2D[1 - t], shade(CELL2D[1 - t], -0.2), 0.6));
  });
  return parts;
}

/** Grafo cristallino multi-arco (CGCNN, Xie & Grossman 2018). */
function crystalGraphShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const cx = x + w / 2, cy = y + h / 2, rx = w * 0.42, ry = h * 0.42;
  const nodes: P2[] = [...Array.from({ length: 6 }, (_, i): P2 => [cx + rx * Math.cos(-Math.PI / 2 + (i * TAU) / 6), cy + ry * Math.sin(-Math.PI / 2 + (i * TAU) / 6)]), [cx, cy - ry * 0.32], [cx, cy + ry * 0.32]];
  const kind = (i: number) => (i < 6 ? i % 2 : i - 6);
  const pairs: [number, number][] = [];
  for (let i = 0; i < 6; i++) pairs.push([i, (i + 1) % 6]);
  for (let i = 0; i < 6; i++) if (kind(i) === 0) pairs.push([i, 7]);
  for (let i = 0; i < 6; i++) if (kind(i) === 1) pairs.push([i, 6]);
  pairs.push([0, 3], [1, 4], [2, 5], [6, 7]);
  const cmds: Cmd[] = [];
  for (const [a, b] of pairs) {
    const A = nodes[a], B = nodes[b];
    const d = sub(B, A), nv = perp(unit(d)), m = mean([A, B]);
    for (const s of [-1, 1]) {
      const c = add(m, mul(nv, s * len(d) * 0.13));
      cmds.push(['M', ...A], ['C', A[0] + (c[0] - A[0]) * 0.66, A[1] + (c[1] - A[1]) * 0.66, B[0] + (c[0] - B[0]) * 0.66, B[1] + (c[1] - B[1]) * 0.66, B[0], B[1]]);
    }
  }
  const parts: Part[] = [...framePanel(n), line(cmds, inkOf(n, '#5B78B0'), n.strokeWidth)];
  const r = clamp(Math.min(w, h) * 0.045, 2.5, 9);
  const cols: [string, string][] = [cpk('Cl'), cpk('Na')];
  nodes.forEach((p, i) => parts.push(disc(p[0], p[1], r, cols[kind(i)][0], cols[kind(i)][1], 0.8)));
  return parts;
}

// ======================================================================
// Schema di reazione: reagenti + condizioni → prodotti (anche retrosintesi ⇒)
// ======================================================================

interface Scheme {
  left: string[];
  right: string[];
  above: string;
  below: string;
  eq?: boolean;
}
const SCHEMES: Record<string, Scheme> = {
  esterification: { left: ['aceticacid', 'ethanol'], right: ['ethylacetate', 'f:H_2O'], above: 'H_2SO_4', below: 'Δ', eq: true },
  amide: { left: ['acetylchloride', 'benzylamine'], right: ['benzylacetamide', 'f:HCl'], above: 'Et_3N', below: 'DCM, rt' },
  suzuki: { left: ['bromobenzene', 'phenylboronic'], right: ['biphenyl'], above: 'Pd(PPh_3)_4', below: 'K_2CO_3, Δ' },
  dielsalder: { left: ['butadiene', 'ethylene'], right: ['cyclohexene'], above: 'Δ', below: '' },
  acetylation: { left: ['aminophenol', 'aceticanhydride'], right: ['paracetamol', 'aceticacid'], above: 'H_2O', below: 'Δ' },
};
const SCHEME_KEYS = Object.keys(SCHEMES);

function reactionShape(n: N): Part[] {
  const sc = SCHEMES[kindOf(n.spec, SCHEME_KEYS, 'esterification')];
  const retro = has(n.spec, 'retro'), bare = has(n.spec, 'noconditions') || retro;
  const eq = (sc.eq || has(n.spec, 'equilibrium')) && !retro;
  const ink = inkOf(n);
  const color = has(n.spec, 'color');
  const left = retro ? sc.right.filter((s) => !s.startsWith('f:')).slice(0, 1) : sc.left;
  const right = retro ? sc.left : sc.right;
  // larghezze in unità di legame (fs = 0.52 L)
  type It = { kind: 'mol'; m: Mol2; bx: ReturnType<typeof molBox> } | { kind: 'f'; s: string } | { kind: 'plus' } | { kind: 'arrow' };
  const items: It[] = [];
  const pushSide = (side: string[]) =>
    side.forEach((s, i) => {
      if (i) items.push({ kind: 'plus' });
      if (s.startsWith('f:')) items.push({ kind: 'f', s: s.slice(2) });
      else {
        const m = mol2(s);
        items.push({ kind: 'mol', m, bx: molBox(m) });
      }
    });
  pushSide(left);
  items.push({ kind: 'arrow' });
  pushSide(right);
  const condW = bare ? 0 : Math.max(formulaW(sc.above, 0.47), formulaW(sc.below, 0.47));
  const arrowW = Math.max(2.2, condW + 0.7);
  const gapU = 0.35;
  const widthU = (it: It) => (it.kind === 'mol' ? it.bx.w : it.kind === 'f' ? formulaW(it.s, 0.52) : it.kind === 'plus' ? 0.7 : arrowW);
  const totalU = items.reduce((t, it) => t + widthU(it), 0) + gapU * (items.length - 1);
  const maxH = Math.max(1.2, ...items.map((it) => (it.kind === 'mol' ? it.bx.h : 0.7)), bare ? 0 : 2.1);
  const L = Math.max(1, Math.min(n.w / totalU, n.h / maxH, 40));
  const fs = clamp(L * 0.52, 5, 15);
  const cy = n.y + n.h / 2;
  let cx = n.x + (n.w - totalU * L) / 2;
  const parts: Part[] = [...framePanel(n)];
  for (const it of items) {
    const wpx = widthU(it) * L;
    if (it.kind === 'mol') {
      const ox = cx + wpx / 2;
      const at = (p: P2): P2 => [ox + (p[0] - it.bx.cx) * L, cy + (p[1] - it.bx.cy) * L];
      parts.push(...skeletalParts(it.m, at, L, { ink, sw: n.strokeWidth, fs, color, circle: false }));
    } else if (it.kind === 'f') parts.push(...formula(cx + wpx / 2, cy, it.s, fs, color ? '#2F5FB0' : ink));
    else if (it.kind === 'plus') parts.push(text(cx + wpx / 2, cy, '+', fs * 1.15, 'middle', ink));
    else {
      const a: P2 = [cx + L * 0.1, cy], b: P2 = [cx + wpx - L * 0.1, cy];
      const hs = clamp(L * 0.22, 4, 8);
      if (retro) {
        const o = L * 0.09;
        parts.push(line([...seg([a[0], cy - o], [b[0] - hs * 0.6, cy - o]), ...seg([a[0], cy + o], [b[0] - hs * 0.6, cy + o])], ink, n.strokeWidth));
        parts.push(line([['M', b[0] - hs, cy - hs * 0.75], ['L', b[0], cy], ['L', b[0] - hs, cy + hs * 0.75]], ink, n.strokeWidth));
      } else if (eq) {
        const o = L * 0.08;
        parts.push(line([...seg([a[0], cy - o], [b[0], cy - o]), ['L', b[0] - hs, cy - o - hs * 0.55], ...seg([b[0], cy + o], [a[0], cy + o]), ['L', a[0] + hs, cy + o + hs * 0.55]], ink, n.strokeWidth));
      } else parts.push(...arrow(a, b, ink, n.strokeWidth, hs));
      if (!bare) {
        const cs = fs * 0.9;
        if (sc.above) parts.push(...formula(cx + wpx / 2, cy - L * 0.42 - cs * 0.3, sc.above, cs, ink));
        if (sc.below) parts.push(...formula(cx + wpx / 2, cy + L * 0.42 + cs * 0.3, sc.below, cs, ink));
      }
    }
    cx += wpx + gapU * L;
  }
  return parts;
}

// ======================================================================
// Grafici: assi comuni
// ======================================================================

interface Frame {
  parts: Part[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  X: (u: number) => number;
  Y: (v: number) => number;
  ls: number;
}

/** Riquadro con assi a freccia; con `labels` i nomi degli assi (sotto e in alto a sinistra). */
function axesFrame(n: N, xName: string, yName: string): Frame {
  const { x, y, w, h } = n;
  const parts: Part[] = [...framePanel(n)];
  const boxed = n.fill !== 'none';
  const p = boxed ? clamp(Math.min(w, h) * 0.08, 3, 7) : 1;
  const ls = has(n.spec, 'labels') ? clamp(Math.min(w, h) * 0.085, 7, 11) : 0;
  const x0 = x + p + (ls && yName ? 2 : 0), x1 = x + w - p - (ls && xName ? 0 : 0);
  const y0 = y + p + (ls && yName ? ls * 1.3 : 0), y1 = y + h - p - (ls && xName ? ls * 1.5 : 0);
  const hs = clamp(Math.min(w, h) * 0.06, 2.8, 4.5);
  parts.push(...arrow([x0, y1], [x1, y1], AXIS, 0.8, hs), ...arrow([x0, y1], [x0, y0], AXIS, 0.8, hs));
  if (ls && xName) parts.push(text((x0 + x1) / 2, y1 + ls * 0.95, xName, ls, 'middle', TEXT));
  if (ls && yName) parts.push(text(x0 - 1, y0 - ls * 0.7, yName, ls, 'start', TEXT));
  const ix0 = x0 + 3, ix1 = x1 - hs - 3, iy0 = y0 + hs + 2, iy1 = y1 - 2;
  return { parts, x0: ix0, x1: ix1, y0: iy0, y1: iy1, X: (u) => ix0 + u * (ix1 - ix0), Y: (v) => iy1 - v * (iy1 - iy0), ls };
}

const polyline = (pts: P2[]): Cmd[] => pts.map((p, i): Cmd => [i ? 'L' : 'M', p[0], p[1]]);

// ======================================================================
// Profilo energetico di reazione
// ======================================================================

/** Interpolazione coseno fra punti chiave (derivata nulla nei massimi e minimi). */
function keyCurve(keys: [number, number][]) {
  return (u: number) => {
    if (u <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++)
      if (u <= keys[i][0]) {
        const [ua, ea] = keys[i - 1], [ub, eb] = keys[i];
        const t = (u - ua) / (ub - ua);
        return ea + ((eb - ea) * (1 - Math.cos(Math.PI * t))) / 2;
      }
    return keys[keys.length - 1][1];
  };
}

function energyShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['exo', 'endo', 'catalyzed', 'intermediate'] as const, 'exo');
  const annot = has(n.spec, 'annot');
  const F = axesFrame(n, 'Reaction coordinate', 'Energy');
  const parts = F.parts;
  const col = inkOf(n, '#2F6FB2');
  const sw = Math.max(1.2, n.strokeWidth * 1.3);
  // punti chiave (coordinata, energia): reagenti, stato di transizione, (intermedio), prodotti
  const keys: Record<string, [number, number][]> = {
    exo: [[0.13, 0.52], [0.5, 0.92], [0.86, 0.24]],
    endo: [[0.13, 0.24], [0.5, 0.9], [0.86, 0.58]],
    catalyzed: [[0.13, 0.52], [0.5, 0.66], [0.86, 0.24]],
    intermediate: [[0.1, 0.5], [0.33, 0.88], [0.5, 0.46], [0.67, 0.74], [0.88, 0.22]],
  };
  const sample = (f: (u: number) => number) => Array.from({ length: 121 }, (_, i): P2 => [F.X(i / 120), F.Y(f(i / 120))]);
  const k = keys[kind];
  const uncat: [number, number][] = [[0.13, 0.52], [0.5, 0.92], [0.86, 0.24]];
  if (kind === 'catalyzed') parts.push(line(dashes(sample(keyCurve(uncat)), 4, 3), '#9AA0A6', sw * 0.85));
  parts.push(line(polyline(sample(keyCurve(k))), col, sw));
  if (!annot) return parts;
  const ts = clamp(Math.min(n.w, n.h) * 0.075, 7, 11);
  const r = k[0], p = k[k.length - 1];
  const peak = kind === 'catalyzed' ? uncat[1] : k[1];
  const yR = F.Y(r[1]), yP = F.Y(p[1]), yT = F.Y(peak[1]);
  const xH = F.X(1);
  parts.push(line(dashes([[F.X(r[0]), yR], [xH + 2, yR]], 3, 2.5), '#9AA0A6', 0.8));
  parts.push(line(dashes([[F.X(p[0]), yP], [xH + 2, yP]], 3, 2.5), '#9AA0A6', 0.8));
  // energia di attivazione: freccia sotto il picco, etichetta dentro la "collina"
  const xa = F.X(peak[0]);
  parts.push(...arrow([xa, yR], [xa, yT + 1], DARK, 0.9, 3.6, true));
  parts.push(text(xa + 3, yR - (yR - yT) * (kind === 'catalyzed' ? 0.7 : 0.45), '$E_a$', ts * 1.1, 'start', DARK));
  parts.push(...arrow([xH, yR], [xH, yP], DARK, 0.9, 3.6, true));
  parts.push(text(xH - 3, (yR + yP) / 2, '$\\Delta H$', ts * 1.1, 'end', DARK));
  parts.push(text(xa, yT - ts * 0.85, kind === 'catalyzed' ? 'uncatalyzed' : 'TS', ts, 'middle', kind === 'catalyzed' ? '#7A808A' : TEXT));
  if (kind === 'intermediate') parts.push(text(F.X(k[3][0]), F.Y(k[3][1]) - ts * 0.85, 'TS', ts, 'middle', TEXT), text(F.X(k[2][0]), F.Y(k[2][1]) + ts * 0.95, 'Int.', ts, 'middle', TEXT));
  if (kind === 'catalyzed') parts.push(text(F.X(0.7), F.Y(0.64), 'catalyzed', ts * 0.9, 'start', col));
  parts.push(text(F.X(r[0] * 0.5), yR + ts * 0.85, 'Reactants', ts, 'start', TEXT), text(F.X(p[0] - 0.02), yP + ts * 0.85, 'Products', ts, 'middle', TEXT));
  return parts;
}

// ======================================================================
// Superficie di energia potenziale (3D o a curve di livello) e potenziali di coppia
// ======================================================================

const RAMP = ['#2E4C8C', '#3577A8', '#4FA3B5', '#7CC4A4', '#BCDD97', '#F2E7A0'];
function ramp(t: number): string {
  const u = clamp(t, 0, 1) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(u));
  return mix(RAMP[i], RAMP[i + 1], u - i);
}

/** Superficie con due minimi separati da un punto di sella (stile Müller-Brown), valori in [0, 1]. */
function pesF(x: number, y: number) {
  const g = (dx: number, dy: number, sx: number, sy: number) => Math.exp(-((dx * dx) / (sx * sx) + (dy * dy) / (sy * sy)));
  const v = 0.95 - 0.95 * g(x + 0.45, y + 0.3, 0.38, 0.32) - 0.8 * g(x - 0.5, y - 0.28, 0.32, 0.36) - 0.3 * g(x - 0.35, y + 0.6, 0.3, 0.25) + 0.22 * (x * x + y * y) + 0.05 * Math.sin(3 * x + 1) * Math.cos(2 * y);
  return clamp((v - 0.1) / 1.0, 0, 1);
}
const PES_MIN: P2[] = [[-0.45, -0.3], [0.5, 0.28]];
const PES_SADDLE: P2 = [0.05, 0.02];

function pesShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['surface', 'contour', 'morse', 'lj'] as const, 'surface');
  if (kind === 'morse' || kind === 'lj') return pairPotential(n, kind);
  const path = has(n.spec, 'path');
  const { x, y, w, h } = n;
  if (kind === 'contour') {
    const parts: Part[] = [];
    const clip = { x, y, w, h, r: Math.min(n.radius, w / 2, h / 2) };
    const nx = clamp(Math.round(w / 3), 16, 64), ny = clamp(Math.round(h / 3), 12, 54);
    const cw = w / nx, ch = h / ny;
    const val = (i: number, j: number) => pesF(-1 + (2 * i) / nx, -1 + (2 * j) / ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) parts.push({ kind: 'rect', x: x + i * cw, y: y + j * ch, w: cw + 0.4, h: ch + 0.4, r: 0, fill: ramp(val(i + 0.5, j + 0.5) * 1.05), stroke: 'none', clip });
    // curve di livello (marching squares)
    const levels = Array.from({ length: 8 }, (_, k) => 0.08 + k * 0.1);
    const fine = 1;
    const gx = nx * fine, gy = ny * fine;
    const V = (i: number, j: number) => pesF(-1 + (2 * i) / gx, -1 + (2 * j) / gy);
    const cmds: Cmd[] = [];
    const P = (i: number, j: number): P2 => [x + (i / gx) * w, y + (j / gy) * h];
    for (const lv of levels)
      for (let j = 0; j < gy; j++)
        for (let i = 0; i < gx; i++) {
          const c = [V(i, j), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1)];
          const corners = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
          const cut: P2[] = [];
          for (let e = 0; e < 4; e++) {
            const a = c[e], b = c[(e + 1) % 4];
            if ((a < lv) !== (b < lv)) {
              const t = (lv - a) / (b - a);
              cut.push(add(corners[e], mul(sub(corners[(e + 1) % 4], corners[e]), t)));
            }
          }
          if (cut.length >= 2) cmds.push(...seg(cut[0], cut[1]));
          if (cut.length === 4) cmds.push(...seg(cut[2], cut[3]));
        }
    parts.push({ kind: 'path', cmds, fill: 'none', stroke: '#FFFFFF', sw: 0.6, solid: true, clip });
    if (path) {
      const S = (p: P2): P2 => [x + ((p[0] + 1) / 2) * w, y + ((p[1] + 1) / 2) * h];
      const mep = smooth([S(PES_MIN[0]), S([-0.2, -0.18]), S(PES_SADDLE), S([0.28, 0.12]), S(PES_MIN[1])], false);
      parts.push({ kind: 'path', cmds: mep, fill: 'none', stroke: '#C0392B', sw: 1.6, solid: true, clip });
      for (const m of PES_MIN) parts.push(disc(...S(m), clamp(Math.min(w, h) * 0.025, 2, 4), '#FFFFFF', '#C0392B', 1.2));
      const sp = S(PES_SADDLE), r = clamp(Math.min(w, h) * 0.03, 2.5, 5);
      parts.push(line([...seg([sp[0] - r, sp[1] - r], [sp[0] + r, sp[1] + r]), ...seg([sp[0] - r, sp[1] + r], [sp[0] + r, sp[1] - r])], '#FFFFFF', 1.6));
    }
    parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill: 'none', stroke: inkOf(n), sw: n.strokeWidth, solid: true });
    return parts;
  }
  // superficie 3D a quadrilateri, dipinta dal fondo
  const K = 22;
  const R = rotator(0.62, -0.62);
  const H = 0.75;
  const pt = (i: number, j: number): P3 => {
    const u = -1 + (2 * i) / K, v = -1 + (2 * j) / K;
    return R([u, -pesF(u, v) * H, v]);
  };
  const grid: P3[][] = Array.from({ length: K + 1 }, (_, i) => Array.from({ length: K + 1 }, (_, j) => pt(i, j)));
  const flat = grid.flat();
  const F = fit3(flat, flat.map(() => 0), x, y, w, h, 3);
  const items: Item[] = [];
  for (let i = 0; i < K; i++)
    for (let j = 0; j < K; j++) {
      const q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
      const z = q.reduce((t, p) => t + p[2], 0) / 4;
      const f = ramp(pesF(-1 + (2 * (i + 0.5)) / K, -1 + (2 * (j + 0.5)) / K) * 1.05);
      items.push({ z, parts: [area(poly(q.map((p) => F.at(p))), f, shade(f, -0.25), 0.4)] });
    }
  const parts = [...framePanel(n), ...paint(items)];
  if (path) {
    const lift = (p: P2): P2 => F.at(R([p[0], -pesF(p[0], p[1]) * H - 0.01, p[1]]));
    const pts: P2[] = [];
    const way: P2[] = [PES_MIN[0], [-0.2, -0.18], PES_SADDLE, [0.28, 0.12], PES_MIN[1]];
    for (let s = 0; s < way.length - 1; s++) for (let t = 0; t < 10; t++) pts.push(lift(add(way[s], mul(sub(way[s + 1], way[s]), t / 10))));
    pts.push(lift(way[way.length - 1]));
    parts.push(line(polyline(pts), '#C0392B', 1.6));
    for (const m of PES_MIN) parts.push(disc(...lift(m), 2.6, '#FFFFFF', '#C0392B', 1.1));
  }
  return parts;
}

function pairPotential(n: N, kind: 'morse' | 'lj'): Part[] {
  const F = axesFrame(n, '$r$', kind === 'lj' ? '$V_{\\mathrm{LJ}}(r)$' : '$V(r)$');
  const parts = F.parts;
  const col = inkOf(n, '#2F6FB2');
  // r in [0.75, 2.6], energia normalizzata: minimo -1 in r0 = 1.12 (LJ) o 1.2 (Morse)
  const V = kind === 'lj' ? (r: number) => 4 * (Math.pow(1 / r, 12) - Math.pow(1 / r, 6)) : (r: number) => Math.pow(1 - Math.exp(-2.2 * (r - 1.2)), 2) - 1;
  const r0 = kind === 'lj' ? Math.pow(2, 1 / 6) : 1.2;
  const rx = (u: number) => 0.82 + u * 1.9;
  const vy = (v: number) => clamp((v + 1.15) / 2.3, -0.05, 1.05);
  const zero = F.Y(vy(0));
  const pts: P2[] = [];
  for (let i = 0; i <= 160; i++) {
    const u = i / 160, v = V(rx(u));
    if (v > 1.15) continue;
    pts.push([F.X(u), F.Y(vy(v))]);
  }
  parts.push(line(dashes([[F.x0, zero], [F.x1, zero]], 3, 2.5), '#B9BEC6', 0.8));
  parts.push(line(polyline(pts), col, Math.max(1.2, n.strokeWidth * 1.3)));
  if (has(n.spec, 'labels')) {
    const um = (r0 - 0.82) / 1.9, xm = F.X(um), ym = F.Y(vy(-1));
    const ts = F.ls;
    parts.push(line(dashes([[xm, ym], [xm, F.y1 + 2]], 2.5, 2), '#9AA0A6', 0.8));
    parts.push(...arrow([F.X(um + 0.28), zero], [F.X(um + 0.28), ym], DARK, 0.8, 3, true));
    parts.push(text(F.X(um + 0.28) + 3, (zero + ym) / 2, kind === 'lj' ? '$\\varepsilon$' : '$D_e$', ts * 1.1, 'start', DARK));
    parts.push(text(xm + 2, ym + ts * 0.9, kind === 'lj' ? '$r_m$' : '$r_e$', ts, 'start', DARK));
  }
  return parts;
}

// ======================================================================
// Docking: superficie della proteina con tasca e ligando (o pose multiple, come DiffDock)
// ======================================================================

const POSE_COLORS = ['#B03A2E', '#E67E22', '#C039B5', '#2E4FC9', '#2BB5C8', '#3FA34D', '#D4B23A'];
const DOCK = ['docked', 'apart', 'protein', 'random', 'mid', 'final', 'zoom'] as const;

interface Protein {
  parts: Part[];
  /** Centro e raggio della tasca (cerchio scavato nella superficie). */
  pc: P2;
  rp: number;
  dir: P2;
  R: number;
  theta: number;
}

type Clip = { x: number; y: number; w: number; h: number; r: number };
const withClip = (parts: Part[], clip?: Clip) => (clip ? parts.map((p) => ({ ...p, clip })) : parts);

/** Superficie molecolare: unione di sfere sul bordo di un profilo, con una tasca a U verso `theta`. */
function protein(cx: number, cy: number, R: number, fill: string, ink: string, sw: number, seed: number, theta = -0.8, clip?: Clip): Protein {
  const rand = rng(seed);
  const dir: P2 = [Math.cos(theta), Math.sin(theta)];
  const pc = add([cx, cy], mul(dir, R * 0.8)), rp = R * 0.36;
  const d0 = sub(pc, [cx, cy]);
  const rad = (t: number) => {
    const r0 = R * (1 + 0.07 * Math.sin(3 * t + 0.4) + 0.05 * Math.sin(5 * t + 1.3) + 0.03 * Math.sin(9 * t));
    // il raggio entra nella tasca: ci si ferma sul cerchio scavato
    const u: P2 = [Math.cos(t), Math.sin(t)];
    const b = dot(u, d0), q = b * b - (dot(d0, d0) - rp * rp);
    if (q <= 0) return r0;
    const r1 = b - Math.sqrt(q);
    return r1 > 0 && r1 < r0 ? r1 : r0;
  };
  const K = 84;
  const rim: P2[] = [], balls: [number, number, number][] = [];
  for (let i = 0; i < K; i++) {
    const t = (i / K) * TAU;
    const r = rad(t);
    rim.push([cx + Math.cos(t) * r * 0.9, cy + Math.sin(t) * r * 0.9]);
    const rb = R * (0.075 + 0.04 * rand());
    balls.push([cx + Math.cos(t) * (r - rb * 0.55), cy + Math.sin(t) * (r - rb * 0.55), rb]);
  }
  const parts: Part[] = [];
  for (const [bx, by, rb] of balls) parts.push(disc(bx, by, rb, fill, ink, sw * 1.6));
  parts.push(area(smooth(rim), fill));
  for (const [bx, by, rb] of balls) parts.push(disc(bx, by, rb, fill));
  // parete della tasca in ombra
  const back = Math.atan2(-dir[1], -dir[0]);
  const outer = arc(pc[0], pc[1], rp + R * 0.1, back - 0.95, back + 0.95);
  const inner = arc(pc[0], pc[1], rp + R * 0.01, back + 0.95, back - 0.95).slice(1);
  parts.push(area([...outer, ['L', pc[0] + (rp + R * 0.01) * Math.cos(back + 0.95), pc[1] + (rp + R * 0.01) * Math.sin(back + 0.95)], ...inner, ['Z']], shade(fill, -0.06)));
  return { parts: withClip(parts, clip), pc, rp, dir, R, theta };
}

/** Residui della tasca (sfere arancioni lungo la parete). */
function pocketResidues(pr: Protein, clip?: Clip): Part[] {
  const back = Math.atan2(-pr.dir[1], -pr.dir[0]);
  const parts = [-0.9, -0.45, 0, 0.45, 0.9].map((k) => {
    const c = add(pr.pc, [Math.cos(back + k) * (pr.rp + pr.R * 0.05), Math.sin(back + k) * (pr.rp + pr.R * 0.05)]);
    return disc(c[0], c[1], pr.R * 0.06, '#FBD7B0', '#D79B00', 0.8);
  });
  return withClip(parts, clip);
}

/** Ligando a bastoncini: atomi di carbonio nel colore della posa, N e O in blu e rosso. */
function ligandParts(c: P2, size: number, rot: number, color: string, cpkColors: boolean, sw: number, clip?: { x: number; y: number; w: number; h: number; r: number }): Part[] {
  const m = mol2('dockligand');
  const bx = molBox(m);
  const L = size / Math.max(bx.w, bx.h);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const P = m.p.map((p): P2 => {
    const dx = (p[0] - bx.cx) * L, dy = (p[1] - bx.cy) * L;
    return [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs];
  });
  const col = (e: string) => (!cpkColors || e === 'C' ? color : e === 'N' ? '#2E4FC9' : e === 'O' ? '#D03A2E' : color);
  const parts: Part[] = [];
  for (const b of m.bonds) {
    const mid = mean([P[b.i], P[b.j]]);
    for (const [a, e] of [[P[b.i], m.el[b.i]], [P[b.j], m.el[b.j]]] as [P2, string][]) {
      const p: Part = line(seg(a, mid), col(e), sw);
      parts.push(clip ? { ...p, clip } : p);
    }
  }
  return parts;
}

function dockingShape(n: N): Part[] {
  const kind = kindOf(n.spec, DOCK, 'docked');
  const { x, y, w, h } = n;
  const fill = n.fill === 'none' ? '#ECEDF0' : n.fill, ink = inkOf(n, '#A3A8AF');
  const sw = Math.max(0.8, n.strokeWidth * 0.8);
  if (kind === 'zoom') {
    // dettaglio: la superficie riempie il riquadro, la tasca al centro
    const clip = { x, y, w, h, r: Math.min(n.radius, w / 2, h / 2) };
    const R = Math.max(h * 0.95, w * 0.62);
    const pr = protein(x + w * 0.5, y + h * 0.2 + R, R, fill, ink, sw, 17, -Math.PI / 2, clip);
    const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: clip.r, fill: '#FFFFFF' }, ...pr.parts];
    if (has(n.spec, 'pocket')) parts.push(...pocketResidues(pr, clip));
    parts.push(...ligandParts(add(pr.pc, [0, -h * 0.02]), Math.min(w * 0.6, pr.rp * 2.2), 0.4, POSE_COLORS[(Math.round(n.count) + 5) % POSE_COLORS.length], false, Math.max(1.6, Math.min(w, h) * 0.035), clip));
    parts.push({ kind: 'rect', x, y, w, h, r: clip.r, fill: 'none', stroke: '#C9CED6', sw: 1, solid: true });
    return parts;
  }
  const R = Math.min(w * 0.4, h * 0.42);
  const cxy: P2 = [x + w * 0.47, y + h * 0.55];
  const pr = protein(cxy[0], cxy[1], R, fill, ink, sw, 23);
  const parts: Part[] = [...pr.parts];
  if (has(n.spec, 'pocket')) parts.push(...pocketResidues(pr));
  if (kind === 'protein') return parts;
  const lsw = Math.max(1.3, R * 0.035);
  const size = R * 0.62;
  const home = add(pr.pc, mul(pr.dir, -R * 0.04));
  if (kind === 'docked' || kind === 'apart') {
    const c = kind === 'docked' ? home : add(pr.pc, mul(pr.dir, R * 0.75));
    const rot = 0.35;
    parts.push(...ligandParts(c, size, rot, '#3FA34D', true, lsw));
    if (has(n.spec, 'hbonds') && kind === 'docked') {
      const m = mol2('dockligand');
      const bx = molBox(m), L = size / Math.max(bx.w, bx.h);
      const hb: Cmd[] = [];
      m.el.forEach((e, i) => {
        if (e !== 'N' && e !== 'O') return;
        const dx = (m.p[i][0] - bx.cx) * L, dy = (m.p[i][1] - bx.cy) * L;
        const q: P2 = [c[0] + dx * Math.cos(rot) - dy * Math.sin(rot), c[1] + dx * Math.sin(rot) + dy * Math.cos(rot)];
        const wq = add(pr.pc, mul(unit(sub(q, pr.pc)), pr.rp));
        if (len(sub(wq, q)) < R * 0.3 && dot(sub(q, pr.pc), pr.dir) < R * 0.1) hb.push(...dashes([q, wq], 2, 1.6));
      });
      parts.push(line(hb, '#D6A520', 1.1));
    }
    return parts;
  }
  // pose multiple durante la diffusione inversa (t = T → 0)
  const k = clamp(Math.round(n.count) > 1 ? Math.round(n.count) : 7, 2, 12);
  const rand = rng(41);
  const t = kind === 'random' ? 0 : kind === 'mid' ? 0.55 : 0.95;
  for (let i = 0; i < k; i++) {
    const a = rand() * TAU, rr = R * (0.3 + rand() * 0.8);
    const start = add(cxy, [Math.cos(a) * rr, Math.sin(a) * rr]);
    const tt = i === 0 && kind === 'final' ? 0.12 : t;
    const target = add(home, mul([rand() - 0.5, rand() - 0.5], R * 0.12));
    const c = add(start, mul(sub(target, start), tt));
    const rot = rand() * TAU * (1 - tt) + 0.35 * tt;
    parts.push(...ligandParts(c, size * (0.8 + rand() * 0.2), rot, POSE_COLORS[i % POSE_COLORS.length], false, lsw * 0.9));
  }
  return parts;
}

// ======================================================================
// Tavola periodica: tessera di un elemento e tavola in miniatura
// ======================================================================

interface Elem {
  z: number;
  sym: string;
  name: string;
  mass: string;
}
let elemCache: Elem[] | null = null;
function elements(): Elem[] {
  if (!elemCache)
    elemCache = ELEMENTS.split('|').map((s, i) => {
      const [sym, name, mass] = s.split(' ');
      return { z: i + 1, sym, name, mass };
    });
  return elemCache;
}
const elemBySym = (s: string) => elements().find((e) => e.sym === s);

type Cat = 'alkali' | 'alkaline' | 'transition' | 'post' | 'metalloid' | 'nonmetal' | 'halogen' | 'noble' | 'lanthanide' | 'actinide';
function category(z: number): Cat {
  const inList = (l: number[]) => l.includes(z);
  if (inList([3, 11, 19, 37, 55, 87])) return 'alkali';
  if (inList([4, 12, 20, 38, 56, 88])) return 'alkaline';
  if (z >= 57 && z <= 71) return 'lanthanide';
  if (z >= 89 && z <= 103) return 'actinide';
  if (inList([5, 14, 32, 33, 51, 52])) return 'metalloid';
  if (inList([1, 6, 7, 8, 15, 16, 34])) return 'nonmetal';
  if (inList([9, 17, 35, 53, 85, 117])) return 'halogen';
  if (inList([2, 10, 18, 36, 54, 86, 118])) return 'noble';
  if (inList([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116])) return 'post';
  return 'transition';
}
const CAT_COLORS: Record<Cat, [string, string]> = {
  alkali: ['#F8CECC', '#B85450'],
  alkaline: ['#FFE6CC', '#D79B00'],
  transition: ['#FFF2CC', '#D6B656'],
  post: ['#D5E8D4', '#82B366'],
  metalloid: ['#D0ECE7', '#45A29E'],
  nonmetal: ['#DAE8FC', '#6C8EBF'],
  halogen: ['#E1D5E7', '#9673A6'],
  noble: ['#EDE4F5', '#8E7DB6'],
  lanthanide: ['#FADBE8', '#C2577F'],
  actinide: ['#EADFD6', '#8C6A55'],
};

/** Posizione (riga, colonna) nella tavola; i blocchi f nelle righe 8-9 (`f` = true). */
function tablePos(z: number): { row: number; col: number; f: boolean } {
  const ends = [2, 10, 18, 36, 54, 86, 118];
  const period = ends.findIndex((e) => z <= e) + 1;
  const k = z - (period > 1 ? ends[period - 2] : 0);
  if (period === 1) return { row: 1, col: z === 1 ? 1 : 18, f: false };
  if (period <= 3) return { row: period, col: k <= 2 ? k : k + 10, f: false };
  if (period <= 5) return { row: period, col: k, f: false };
  if (k <= 3) return { row: period, col: k, f: false };
  if (k <= 17) return { row: period + 2, col: k - 1, f: true };
  return { row: period, col: k - 14, f: false };
}

function elementShape(n: N): Part[] {
  const e = elemBySym(n.spec.split(/\s+/).find((t) => !!elemBySym(t)) ?? 'C') ?? elements()[5];
  const { x, y, w, h } = n;
  const [f, k] = has(n.spec, 'cat') ? CAT_COLORS[category(e.z)] : [n.fill, inkOf(n)];
  const compact = has(n.spec, 'compact');
  const ink = shade(k, -0.45);
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill: f, stroke: k, sw: n.strokeWidth, solid: true }];
  const s = Math.min(w, h);
  const pad = s * 0.08;
  parts.push(text(x + pad, y + pad + s * 0.08, String(e.z), s * 0.15, 'start', ink));
  if (compact) {
    parts.push(text(x + w / 2, y + h * 0.56, e.sym, s * 0.42, 'middle', DARK, true));
    return parts;
  }
  parts.push(text(x + w / 2, y + h * 0.47, e.sym, s * 0.36, 'middle', DARK, true));
  parts.push(text(x + w / 2, y + h * 0.72, e.name, Math.min(s * 0.125, (w * 0.9) / Math.max(1, strW(e.name))), 'middle', ink));
  parts.push(text(x + w / 2, y + h * 0.87, e.mass, s * 0.11, 'middle', ink));
  return parts;
}

const BLOCK_COLORS: Record<string, [string, string]> = { s: ['#F8CECC', '#B85450'], p: ['#DAE8FC', '#6C8EBF'], d: ['#FFF2CC', '#D6B656'], f: ['#D5E8D4', '#82B366'] };
function blockOf(z: number) {
  const p = tablePos(z);
  if (p.f) return 'f';
  if (p.col <= 2 || z === 2) return 's';
  if (p.col >= 13) return 'p';
  return 'd';
}

function ptableShape(n: N): Part[] {
  const toks = n.spec.split(/\s+/);
  const hl = toks.filter((t) => !!elemBySym(t));
  const fblock = has(n.spec, 'fblock'), cats = has(n.spec, 'cats'), blocks = has(n.spec, 'blocks'), heat = has(n.spec, 'heat');
  const rows = fblock ? 9.4 : 7;
  const c = Math.min(n.w / 18, n.h / rows);
  const ox = n.x + (n.w - 18 * c) / 2, oy = n.y + (n.h - rows * c) / 2;
  const gap = Math.max(0.5, c * 0.07);
  const parts: Part[] = [];
  for (const e of elements()) {
    const p = tablePos(e.z);
    if (p.f && !fblock) continue;
    const cx = ox + (p.col - 1) * c, cy = oy + (p.row - 1 + (p.f ? 0.4 : 0)) * c;
    const i = hl.indexOf(e.sym);
    let fill = '#F3F4F6', stroke = '#C9CED6';
    if (cats) [fill, stroke] = CAT_COLORS[category(e.z)];
    if (blocks) [fill, stroke] = BLOCK_COLORS[blockOf(e.z)];
    if (i >= 0) {
      fill = heat ? mix(inkOf(n), '#FFFFFF', 0.12 + (0.7 * i) / Math.max(1, hl.length - 1)) : n.fill === 'none' ? '#FFE6CC' : n.fill;
      stroke = inkOf(n);
    }
    parts.push({ kind: 'rect', x: cx + gap / 2, y: cy + gap / 2, w: c - gap, h: c - gap, r: Math.min(2, c * 0.12), fill, stroke, sw: i >= 0 ? 1 : 0.6, solid: true });
    if (c >= 9) parts.push(text(cx + c / 2, cy + c / 2, e.sym, c * 0.42, 'middle', i >= 0 && heat && i < hl.length / 2 ? '#FFFFFF' : DARK, i >= 0));
  }
  return parts;
}

// ======================================================================
// Laboratorio: vetreria, piastre, braccio robotico
// ======================================================================

const LAB = ['flask', 'roundflask', 'beaker', 'tubes', 'plate', 'robotarm', 'pipette'] as const;

function labShape(n: N): Part[] {
  const kind = kindOf(n.spec, LAB, 'flask');
  const { x, y, w, h } = n;
  const liquid = n.fill === 'none' ? '#DAE8FC' : n.fill, glass = inkOf(n, '#6C8EBF');
  const sw = n.strokeWidth;
  const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const white = '#FFFFFF';
  switch (kind) {
    case 'roundflask': {
      const cx = x + w / 2, R = Math.min(w * 0.46, h * 0.36), cy = y + h - R - h * 0.02;
      const nw = R * 0.32, top = y + h * 0.04;
      const lv = cy + R * 0.15, a = Math.asin(clamp((lv - cy) / R, -1, 1));
      const liq: Cmd[] = [['M', cx + R * Math.cos(a), lv], ...arc(cx, cy, R, a, Math.PI - a).slice(1), ['Z']];
      return [
        disc(cx, cy, R, white, glass, sw),
        { kind: 'rect', x: cx - nw / 2, y: top, w: nw, h: cy - R - top + R * 0.2, r: 0, fill: white, stroke: 'none' },
        area(liq, liquid),
        line([...seg([cx - nw / 2, top], [cx - nw / 2, cy - R * 0.94]), ...seg([cx + nw / 2, top], [cx + nw / 2, cy - R * 0.94])], glass, sw),
        line(seg([cx - nw * 0.75, top], [cx + nw * 0.75, top]), glass, sw * 1.4),
        disc(cx - R * 0.2, lv + R * 0.3, R * 0.07, tint(liquid, 0.6)),
        disc(cx + R * 0.25, lv + R * 0.5, R * 0.05, tint(liquid, 0.6)),
      ];
    }
    case 'beaker': {
      const body = roundPoly([P(0.14, 0.08), P(0.86, 0.08), P(0.86, 0.96), P(0.14, 0.96)], Math.min(w, h) * 0.06);
      const ticks: Cmd[] = [];
      for (let i = 0; i < 4; i++) ticks.push(...seg(P(0.2, 0.32 + i * 0.14), P(i % 2 ? 0.34 : 0.28, 0.32 + i * 0.14)));
      return [
        area(body, white, glass, sw),
        area(roundPoly([P(0.145, 0.45), P(0.855, 0.45), P(0.855, 0.955), P(0.145, 0.955)], Math.min(w, h) * 0.05), liquid),
        line(ticks, glass, sw * 0.7),
        line([['M', ...P(0.06, 0.02)], ['L', ...P(0.14, 0.1)]], glass, sw),
        line(body, glass, sw),
      ];
    }
    case 'tubes': {
      const parts: Part[] = [];
      const k = clamp(Math.round(n.count) > 1 ? Math.round(n.count) : 3, 2, 8);
      const tw = (w * 0.8) / k;
      for (let i = 0; i < k; i++) {
        const tx = x + w * 0.1 + i * tw + tw * 0.18, tww = tw * 0.64;
        const top = y + h * 0.04, bot = y + h * 0.9;
        const lv = top + (bot - top) * (0.35 + 0.12 * ((i * 7) % 3));
        const tube = (t: number): Cmd[] => [['M', tx, t], ['L', tx, bot - tww / 2], ...arc(tx + tww / 2, bot - tww / 2, tww / 2, Math.PI, 0).slice(1), ['L', tx + tww, t]];
        parts.push(area([...tube(top), ['Z']], white));
        parts.push(area([...tube(lv), ['Z']], i % 2 ? tint(liquid, 0.25) : liquid));
        parts.push(line(tube(top), glass, sw));
      }
      parts.push({ kind: 'rect', x: x + w * 0.04, y: y + h * 0.6, w: w * 0.92, h: h * 0.08, r: 1, fill: '#E9EBEE', stroke: glass, sw, solid: true });
      return parts;
    }
    case 'plate': {
      const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius + 2, w / 2, h / 2), fill: '#F5F6F8', stroke: glass, sw, solid: true }];
      const cols = 12, rows = 8;
      const cw = (w * 0.9) / cols, ch = (h * 0.86) / rows, r = Math.min(cw, ch) * 0.36;
      const rand = rng(9);
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const v = rand();
          parts.push(disc(x + w * 0.05 + (i + 0.5) * cw, y + h * 0.07 + (j + 0.5) * ch, r, v < 0.55 ? mix(liquid, glass, v * 0.6) : '#FFFFFF', shade('#C9CED6', -0.1), 0.5));
        }
      return parts;
    }
    case 'robotarm': {
      const col = n.fill === 'none' ? '#E9EBEE' : n.fill;
      const j1 = P(0.32, 0.72), j2 = P(0.62, 0.28), tip = P(0.86, 0.48);
      const t = Math.min(w, h) * 0.11;
      const limb = (a: P2, b: P2, r: number) => area(capsule(a, b, r), col, glass, sw);
      return [
        area(roundPoly([P(0.1, 0.86), P(0.54, 0.86), P(0.5, 0.97), P(0.14, 0.97)], 2), shade(col, -0.08), glass, sw),
        limb(P(0.32, 0.86), j1, t * 0.8),
        limb(j1, j2, t * 0.7),
        limb(j2, tip, t * 0.55),
        disc(j1[0], j1[1], t * 0.75, shade(col, -0.1), glass, sw),
        disc(j2[0], j2[1], t * 0.62, shade(col, -0.1), glass, sw),
        line([['M', tip[0] - t * 0.5, tip[1] + t * 0.2], ['L', tip[0] - t * 0.5, tip[1] + t * 1.2], ['M', tip[0] + t * 0.5, tip[1] + t * 0.2], ['L', tip[0] + t * 0.5, tip[1] + t * 1.2]], glass, sw * 1.5),
        disc(tip[0], tip[1], t * 0.45, shade(col, -0.1), glass, sw),
      ];
    }
    case 'pipette': {
      const cx = x + w / 2;
      return [
        area(roundPoly([[cx - w * 0.16, y + h * 0.04], [cx + w * 0.16, y + h * 0.04], [cx + w * 0.16, y + h * 0.5], [cx - w * 0.16, y + h * 0.5]], 3), '#E9EBEE', glass, sw),
        area(poly([[cx - w * 0.1, y + h * 0.5], [cx + w * 0.1, y + h * 0.5], [cx + w * 0.03, y + h * 0.86], [cx - w * 0.03, y + h * 0.86]]), white, glass, sw),
        area(poly([[cx - w * 0.075, y + h * 0.62], [cx + w * 0.075, y + h * 0.62], [cx + w * 0.03, y + h * 0.86], [cx - w * 0.03, y + h * 0.86]]), liquid),
        area([['M', cx, y + h * 0.89], ['C', cx + w * 0.07, y + h * 0.95, cx + w * 0.05, y + h * 0.99, cx, y + h * 0.99], ['C', cx - w * 0.05, y + h * 0.99, cx - w * 0.07, y + h * 0.95, cx, y + h * 0.89], ['Z']], liquid, glass, sw * 0.7),
      ];
    }
    default: {
      const neck = [P(0.4, 0.06), P(0.6, 0.06)];
      const body: P2[] = [neck[0], neck[1], P(0.6, 0.36), P(0.9, 0.94), P(0.1, 0.94), P(0.4, 0.36)];
      const shape = roundPoly(body, Math.min(w, h) * 0.05);
      const lv = 0.58;
      const xl = 0.4 - ((lv - 0.36) / 0.58) * 0.3, xr = 0.6 + ((lv - 0.36) / 0.58) * 0.3;
      return [
        area(shape, white, glass, sw),
        area(roundPoly([P(xl + 0.01, lv), P(xr - 0.01, lv), P(0.885, 0.93), P(0.115, 0.93)], Math.min(w, h) * 0.04), liquid),
        disc(...P(0.42, 0.78), Math.min(w, h) * 0.04, tint(liquid, 0.6)),
        disc(...P(0.58, 0.7), Math.min(w, h) * 0.03, tint(liquid, 0.6)),
        line(shape, glass, sw),
        line(seg(P(0.35, 0.06), P(0.65, 0.06)), glass, sw * 1.5),
      ];
    }
  }
}

// ======================================================================
// Spettri: XRD, IR, NMR, massa, UV-vis
// ======================================================================

const SPECTRA = ['xrd', 'ir', 'nmr', 'ms', 'uvvis', 'rdf'] as const;
const SPEC_AXES: Record<string, string> = { xrd: '$2\\theta$', ir: '$\\tilde{\\nu}$', nmr: '$\\delta$ (ppm)', ms: '$m/z$', uvvis: '$\\lambda$ (nm)', rdf: '$r$' };
const SPEC_Y: Record<string, string> = { xrd: 'Intensity', ir: 'T (%)', nmr: '', ms: 'Abundance', uvvis: 'Abs.', rdf: '$g(r)$' };

function spectrumShape(n: N): Part[] {
  const kind = kindOf(n.spec, SPECTRA, 'xrd');
  const F = axesFrame(n, SPEC_AXES[kind], SPEC_Y[kind]);
  const parts = F.parts;
  const col = inkOf(n, '#2F6FB2');
  const sw = Math.max(1, n.strokeWidth);
  const lorentz = (u: number, c: number, wd: number) => 1 / (1 + ((u - c) / wd) ** 2);
  const peaks: Record<string, [number, number, number][]> = {
    xrd: [[0.14, 0.55, 0.006], [0.22, 1, 0.006], [0.31, 0.35, 0.006], [0.45, 0.62, 0.007], [0.53, 0.25, 0.007], [0.66, 0.4, 0.008], [0.78, 0.18, 0.008], [0.88, 0.22, 0.009]],
    ir: [[0.12, 0.45, 0.04], [0.3, 0.3, 0.015], [0.48, 0.85, 0.012], [0.62, 0.35, 0.01], [0.7, 0.5, 0.008], [0.78, 0.65, 0.007], [0.86, 0.4, 0.008], [0.93, 0.55, 0.006]],
    nmr: [[0.12, 0.5, 0.003], [0.14, 0.5, 0.003], [0.35, 0.9, 0.003], [0.55, 0.3, 0.003], [0.57, 0.6, 0.003], [0.59, 0.3, 0.003], [0.8, 0.25, 0.003], [0.82, 0.75, 0.003], [0.84, 0.75, 0.003], [0.86, 0.25, 0.003]],
    uvvis: [[0.3, 0.9, 0.09], [0.58, 0.35, 0.07]],
  };
  if (kind === 'ms') {
    const cmds: Cmd[] = [];
    const rand = rng(13);
    for (let i = 0; i < 18; i++) {
      const u = 0.05 + rand() * 0.9, v = i === 0 ? 1 : i === 1 ? 0.62 : rand() * 0.45;
      cmds.push(...seg([F.X(u), F.y1], [F.X(u), F.Y(v * 0.95)]));
    }
    parts.push(line(cmds, col, sw * 1.2));
    return parts;
  }
  const g = (u: number, c: number, wd: number) => Math.exp(-(((u - c) / wd) ** 2));
  const rdf = (u: number) => clamp((u - 0.19) / 0.05, 0, 1) ** 2 * (0.35 + 0.6 * g(u, 0.265, 0.035) - 0.12 * g(u, 0.37, 0.045) + 0.1 * g(u, 0.48, 0.05) - 0.04 * g(u, 0.6, 0.05));
  const f = (u: number) => {
    if (kind === 'rdf') return rdf(u);
    const s = peaks[kind].reduce((t, [c, a, wd]) => t + a * lorentz(u, c, wd), 0);
    return kind === 'ir' ? 0.92 - 0.82 * Math.min(1, s) : Math.min(1, s) * 0.95 + (kind === 'xrd' ? 0.03 + 0.03 * Math.exp(-u * 4) : 0.01);
  };
  const N = kind === 'nmr' || kind === 'xrd' ? 500 : 240;
  const pts = Array.from({ length: N + 1 }, (_, i): P2 => [F.X(i / N), F.Y(f(i / N))]);
  if (has(n.spec, 'compare')) {
    const g = (u: number) => f(u + 0.004) * 0.92;
    parts.push(line(dashes(Array.from({ length: N + 1 }, (_, i): P2 => [F.X(i / N), F.Y(g(i / N) * 0.85 + 0.08)]), 3, 2), '#C0392B', sw));
  }
  parts.push(line(polyline(pts), col, sw));
  return parts;
}

// ======================================================================
// Ottimizzazione bayesiana: surrogato (media ± 2σ, osservazioni) e funzione di acquisizione
// ======================================================================

function boShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const col = inkOf(n, '#7E57C2');
  const acq = !has(n.spec, 'noacq');
  const k = clamp(Math.round(n.count) >= 2 ? Math.round(n.count) : 5, 2, 9);
  const obs = Array.from({ length: k }, (_, i) => 0.08 + (0.84 * i) / (k - 1) + (i % 2 ? -0.04 : 0.03) * (i > 0 && i < k - 1 ? 1 : 0));
  const f = (u: number) => 0.5 + 0.22 * Math.sin(TAU * 1.2 * u + 0.6) + 0.12 * Math.sin(TAU * 2.9 * u);
  const gap = (u: number) => Math.min(...obs.map((o) => Math.abs(u - o)));
  const mean = (u: number) => f(u) + 0.1 * Math.sin(9 * u) * Math.min(1, gap(u) * 6);
  const sd = (u: number) => 0.02 + Math.min(0.17, gap(u) * 1.1);
  const parts: Part[] = [...framePanel(n)];
  const p = n.fill !== 'none' ? 5 : 1;
  const x0 = x + p, x1 = x + w - p;
  const t0 = y + p, t1 = y + h * (acq ? 0.68 : 1) - p;
  const X = (u: number) => x0 + u * (x1 - x0);
  const Y = (v: number) => t1 - clamp(v, -0.05, 1.05) * (t1 - t0) * 0.9;
  const N = 100;
  const us = Array.from({ length: N + 1 }, (_, i) => i / N);
  parts.push(area(poly([...us.map((u): P2 => [X(u), Y(mean(u) + 2 * sd(u))]), ...[...us].reverse().map((u): P2 => [X(u), Y(mean(u) - 2 * sd(u))])]), tint(col, 0.8)));
  parts.push(line(dashes(us.map((u): P2 => [X(u), Y(f(u))]), 2.5, 2), '#9AA0A6', 0.8));
  parts.push(line(polyline(us.map((u): P2 => [X(u), Y(mean(u))])), col, Math.max(1.2, n.strokeWidth * 1.2)));
  for (const o of obs) parts.push(disc(X(o), Y(f(o)), clamp(Math.min(w, h) * 0.025, 1.6, 3.2), '#222222'));
  parts.push(line(seg([x0, t1], [x1, t1]), AXIS, 0.8));
  if (acq) {
    const a0 = y + h * 0.76, a1 = y + h - p;
    const alpha = (u: number) => mean(u) + 1.6 * sd(u);
    const vals = us.map(alpha);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const A = (v: number) => a1 - ((v - lo) / (hi - lo || 1)) * (a1 - a0);
    parts.push(area(poly([[X(0), a1], ...us.map((u, i): P2 => [X(u), A(vals[i])]), [X(1), a1]]), tint('#2E8B57', 0.75), '#2E8B57', 0.9));
    const best = us[vals.indexOf(hi)];
    parts.push(line(dashes([[X(best), A(hi)], [X(best), t0 + 2]], 2.5, 2), '#C0392B', 0.9));
    parts.push(head([X(best), A(hi) - 1], 0, 1, clamp(h * 0.06, 3, 5), '#C0392B'));
    parts.push(line(seg([x0, a1], [x1, a1]), AXIS, 0.8));
    if (has(n.spec, 'labels')) parts.push(text(x0 + 1, a0 + 1, '$\\alpha(\\mathbf{x})$', clamp(h * 0.09, 7, 10), 'start', '#2E8B57'));
  }
  return parts;
}

// ======================================================================
// Vettore di feature (barre o celle in scala di colore)
// ======================================================================

function featShape(n: N): Part[] {
  const vals = n.spec.split(/[\s,;]+/).filter((t) => /^-?\d*\.?\d+$/.test(t)).map(Number);
  const v = vals.length ? vals : [0.35, 0.6, 0.9];
  const { x, y, w, h } = n;
  const ink = inkOf(n);
  const vertical = h > w;
  const k = v.length;
  const parts: Part[] = [];
  if (has(n.spec, 'cells')) {
    const cs = (vertical ? h : w) / k;
    v.forEach((val, i) => {
      const r = vertical ? { x, y: y + i * cs, w, h: cs } : { x: x + i * cs, y, w: cs, h };
      parts.push({ kind: 'rect', ...r, r: 0, fill: mix('#FFFFFF', ink, clamp(val, 0, 1)), stroke: shade(ink, 0.2), sw: 0.6, solid: true });
    });
    parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none', stroke: ink, sw: n.strokeWidth, solid: true });
    return parts;
  }
  // barre: la base sta sullo zero, anche con valori negativi
  const hi = Math.max(0, ...v), lo = Math.min(0, ...v);
  const span = hi - lo || 1;
  const base = y + h * (hi / span);
  const bw = w / k;
  v.forEach((val, i) => {
    const bh = (Math.abs(val) / span) * h;
    parts.push({ kind: 'rect', x: x + bw * (i + 0.14), y: val >= 0 ? base - bh : base, w: bw * 0.72, h: Math.max(0.5, bh), r: 0, fill: n.fill, stroke: ink, sw: n.strokeWidth * 0.8, solid: true });
  });
  parts.push(line(seg([x - 1, base], [x + w + 1, base]), shade(ink, -0.3), n.strokeWidth));
  return parts;
}

// ======================================================================
// Imbuto di screening, basi radiali, armoniche sferiche
// ======================================================================

function funnelShape(n: N): Part[] {
  const k = clamp(Math.round(n.count), 2, 8);
  const { x, y, w, h } = n;
  const spout = has(n.spec, 'nospout') ? 0 : h * 0.1;
  const bh = (h - spout) / k;
  const g = Math.min(3, bh * 0.12);
  const cx = x + w / 2;
  const half = (v: number) => (w / 2) * (1 - 0.78 * v);
  const base = n.fill === 'none' ? '#DAE8FC' : n.fill, ink = inkOf(n, '#6C8EBF');
  const parts: Part[] = [];
  for (let i = 0; i < k; i++) {
    const v0 = (i * bh) / (h - spout), v1 = ((i + 1) * bh - g) / (h - spout);
    const y0 = y + i * bh, y1 = y + (i + 1) * bh - g;
    const f = mix(base, ink, (0.5 * i) / Math.max(1, k - 1));
    parts.push(area(roundPoly([[cx - half(v0), y0], [cx + half(v0), y0], [cx + half(v1), y1], [cx - half(v1), y1]], Math.min(4, bh * 0.2)), f, ink, n.strokeWidth));
  }
  if (spout) {
    const sw2 = half(1) * 0.7;
    parts.push(area(roundPoly([[cx - sw2, y + h - spout], [cx + sw2, y + h - spout], [cx + sw2, y + h], [cx - sw2, y + h]], 2), mix(base, ink, 0.6), ink, n.strokeWidth));
  }
  return parts;
}

const BASIS_COLS = ['#2E4C8C', '#3577A8', '#45A29E', '#6AAE5E', '#B5A33A', '#D9822B', '#C0392B', '#9673A6'];

function basisShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['gauss', 'bessel', 'cosine'] as const, 'gauss');
  const F = axesFrame(n, '$r$', kind === 'cosine' ? '$f_c(r)$' : '$e_k(r)$');
  const parts = F.parts;
  const K = clamp(Math.round(n.count), 1, 16);
  const cut = has(n.spec, 'cutoff') || kind === 'cosine';
  const rc = cut ? 0.9 : 1;
  const fc = (u: number) => (u >= rc ? 0 : 0.5 * (Math.cos((Math.PI * u) / rc) + 1));
  const N = 160;
  const curve = (f: (u: number) => number) => polyline(Array.from({ length: N + 1 }, (_, i): P2 => [F.X(i / N), F.Y(f(i / N))]));
  const sw = Math.max(1, n.strokeWidth);
  if (kind !== 'cosine')
    for (let k = 0; k < K; k++) {
      const col = BASIS_COLS[Math.round((k * (BASIS_COLS.length - 1)) / Math.max(1, K - 1))];
      const f =
        kind === 'gauss'
          ? (u: number) => Math.exp(-((u - (rc * k) / Math.max(1, K - 1) * 0.92 - 0.04) ** 2) / (2 * (0.42 / K) ** 2)) * 0.82 * (cut ? fc(u) ** 0.3 : 1)
          : (u: number) => {
              const r = Math.max(u, 0.02);
              return u >= rc ? 0.45 : 0.45 + (0.42 * Math.sin(((k + 1) * Math.PI * r) / rc)) / (1 + (k + 1) * r * 1.6) * 1.6 * (cut ? fc(u) : 1);
            };
      parts.push(line(curve(f), col, sw));
    }
  if (cut) {
    parts.push(line(dashes(Array.from({ length: N + 1 }, (_, i): P2 => [F.X(i / N), F.Y(fc(i / N) * 0.9)]), 3, 2.5), kind === 'cosine' ? inkOf(n, '#2F6FB2') : '#555555', kind === 'cosine' ? sw * 1.3 : 0.9));
    parts.push(line(dashes([[F.X(rc), F.y0], [F.X(rc), F.y1]], 2.5, 2), '#9AA0A6', 0.8));
    if (has(n.spec, 'labels')) parts.push(text(F.X(rc) + 2, F.y0 + 4, '$r_c$', F.ls, 'start', DARK));
  }
  return parts;
}

const ORB_POS = ['#F8CECC', '#B85450'];
const ORB_NEG = ['#DAE8FC', '#6C8EBF'];

/** Lobo a goccia lungo `dir`; `fore` accorcia il lobo (orientato verso chi guarda). */
function lobe(c: P2, R: number, dir: number, fore: number, pos: boolean, sw: number): Part {
  const pts: P2[] = [];
  for (let i = 0; i <= 40; i++) {
    const phi = -Math.PI / 2 + (Math.PI * i) / 40;
    const r = R * Math.pow(Math.max(0, Math.cos(phi)), 1.4);
    const lx = r * Math.cos(phi) * fore, ly = r * Math.sin(phi) * 0.95;
    pts.push([c[0] + lx * Math.cos(dir) - ly * Math.sin(dir), c[1] + lx * Math.sin(dir) + ly * Math.cos(dir)]);
  }
  const [f, k] = pos ? ORB_POS : ORB_NEG;
  return area(smooth(pts), f, k, sw);
}

/** Orbitale (l, m) stilizzato: s, p, d e d_z² (con il toro). */
function orbital(c: P2, R: number, l: number, m: number, sw: number): Part[] {
  if (l === 0) return [disc(c[0], c[1], R * 0.62, ORB_POS[0], ORB_POS[1], sw)];
  if (l === 1) {
    const d = m === 0 ? -Math.PI / 2 : m === 1 ? 0 : -Math.PI / 4;
    const fore = m === -1 ? 0.62 : 1;
    return [lobe(c, R, d + Math.PI, fore, false, sw), lobe(c, R, d, fore, true, sw)];
  }
  if (m === 0) {
    const ring = (half: 0 | 1): Part => {
      const pts = Array.from({ length: 25 }, (_, i): P2 => {
        const t = half ? (Math.PI * i) / 24 : Math.PI + (Math.PI * i) / 24;
        return [c[0] + R * 0.55 * Math.cos(t), c[1] + R * 0.2 * Math.sin(t)];
      });
      const inner = Array.from({ length: 25 }, (_, i): P2 => {
        const t = half ? Math.PI - (Math.PI * i) / 24 : 2 * Math.PI - (Math.PI * i) / 24;
        return [c[0] + R * 0.3 * Math.cos(t), c[1] + R * 0.08 * Math.sin(t)];
      });
      return area(poly([...pts, ...inner]), ORB_NEG[0], ORB_NEG[1], sw);
    };
    return [ring(0), lobe(c, R, -Math.PI / 2, 1, true, sw), lobe(c, R, Math.PI / 2, 1, true, sw), ring(1)];
  }
  const rot = Math.abs(m) === 2 ? (m > 0 ? 0 : Math.PI / 4) : Math.PI / 4;
  const sq = m === 1 ? 0.65 : m === -2 ? 0.7 : 1;
  const parts: Part[] = [];
  for (let k = 0; k < 4; k++) {
    const d = rot + (k * Math.PI) / 2;
    const v: P2 = [Math.cos(d), Math.sin(d) * sq];
    parts.push(lobe(c, R * 0.8 * Math.hypot(v[0], v[1]), Math.atan2(v[1], v[0]), 1, k % 2 === 0, sw));
  }
  return parts;
}

function orbitalShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['s', 'p', 'd', 'dz2', 'table'] as const, 'table');
  const { x, y, w, h } = n;
  const sw = Math.max(0.6, n.strokeWidth * 0.7);
  if (kind !== 'table') {
    const R = Math.min(w, h) * 0.48;
    const c: P2 = [x + w / 2, y + h / 2];
    const lm: Record<string, [number, number]> = { s: [0, 0], p: [1, 1], d: [2, -1], dz2: [2, 0] };
    return orbital(c, R, ...lm[kind], sw);
  }
  const L = clamp(Math.round(n.count), 0, 2);
  const cell = Math.min(w / (2 * L + 1), h / (L + 1));
  const parts: Part[] = [];
  for (let l = 0; l <= L; l++)
    for (let m = -l; m <= l; m++) {
      const c: P2 = [x + w / 2 + m * cell, y + (h - (L + 1) * cell) / 2 + (l + 0.5) * cell];
      parts.push(...orbital(c, cell * 0.47, l, m, sw));
    }
  return parts;
}

// ---------------- varianti mostrate come pulsanti nel pannello ----------------

const MOL_LIST: [string, string][] = [
  ['water', 'Acqua'], ['methane', 'Metano'], ['ammonia', 'Ammoniaca'], ['co2', 'CO₂'], ['ethylene', 'Etilene'], ['ethanol', 'Etanolo'],
  ['aceticacid', 'Acido acetico'], ['glycine', 'Glicina'], ['benzene', 'Benzene'], ['pyridine', 'Piridina'], ['cyclohexane', 'Cicloesano'],
  ['naphthalene', 'Naftalene'], ['phenol', 'Fenolo'], ['paracetamol', 'Paracetamolo'], ['aspirin', 'Aspirina'], ['ibuprofen', 'Ibuprofene'],
  ['caffeine', 'Caffeina'], ['dopamine', 'Dopamina'], ['ethylnaphthalene', 'Etilnaftalene'], ['jtmol', 'Benzotiofene (JT-VAE)'],
  ['dockligand', 'Ligando (DiffDock)'], ['ethylacetate', 'Acetato di etile'], ['acetylchloride', 'Cloruro di acetile'], ['benzylamine', 'Benzilammina'],
  ['benzylacetamide', 'N-benzilacetammide'], ['bromobenzene', 'Bromobenzene'], ['phenylboronic', 'Ac. fenilboronico'], ['biphenyl', 'Bifenile'],
  ['butadiene', 'Butadiene'], ['cyclohexene', 'Cicloesene'], ['aminophenol', '4-Amminofenolo'], ['aceticanhydride', 'Anidride acetica'],
];
const MOL_KEYS = MOL_LIST.map(([k]) => k);

const c = (value: string, label: string) => ({ value, label });
const MOL_CHOICES = MOL_LIST.map(([v, l]) => c(v, l));
const MOL_GROUP: SpecGroup = { title: 'Molecola', choices: MOL_CHOICES };

const OPTIONS: Record<string, SpecGroup[]> = {
  'chem-molecule': [MOL_GROUP, { title: 'Stile', mode: 'many', choices: [c('noh', 'Senza idrogeni'), c('spacefill', 'Spazio pieno (CPK)'), c('labels', 'Simboli'), c('flat', 'Senza riflessi')] }],
  'chem-skeletal': [
    { title: 'Molecola', choices: [...MOL_CHOICES, c('chain', 'Catena (n atomi)'), c('ring', 'Anello (n atomi)')] },
    { title: 'Stile', mode: 'many', choices: [c('circle', 'Cerchio aromatico'), c('color', 'Eteroatomi a colori'), c('clusters', 'Cluster (JT-VAE)')] },
  ],
  'chem-molgraph': [
    { title: 'Molecola', choices: [...MOL_CHOICES, c('chain', 'Catena (n atomi)'), c('ring', 'Anello (n atomi)')] },
    { title: 'Stile', mode: 'many', choices: [c('labels', 'Simboli'), c('mono', 'Un colore'), c('messages', 'Messaggi verso l\'atomo n'), c('jtree', 'Albero di giunzione')] },
  ],
  'chem-smiles': [
    {
      title: 'SMILES',
      mode: 'value',
      choices: [
        c('CC(=O)Oc1ccccc1C(=O)O', 'Aspirina'), c('Cn1cnc2c1c(=O)n(C)c(=O)n2C', 'Caffeina'), c('CC(C)Cc1ccc(cc1)C(C)C(=O)O', 'Ibuprofene'),
        c('CC(=O)Nc1ccc(O)cc1', 'Paracetamolo'), c('CCO', 'Etanolo'), c('c1ccccc1', 'Benzene'), c('CC(=O)Cl.NCc1ccccc1>>CC(=O)NCc1ccccc1', 'Reazione'),
      ],
    },
    { title: 'Stile', mode: 'many', choices: [c('mono', 'Un colore'), c('bits', 'Fingerprint a bit')] },
  ],
  'chem-mol3d': [
    MOL_GROUP,
    { title: 'Rumore (diffusione)', choices: [c('noise-low', 'Basso'), c('noise-mid', 'Medio'), c('noise-high', 'Alto')] },
    {
      title: 'Elementi',
      mode: 'many',
      choices: [c('cutoff', 'Cutoff attorno all\'atomo n'), c('edges', 'Grafo a raggio'), c('bonds', 'Legami'), c('vectors', 'Vettori'), c('axes', 'Assi xyz'), c('labels', 'Etichette'), c('noh', 'Senza H'), c('dark', 'Sfondo scuro')],
    },
  ],
  'chem-crystal': [
    {
      title: 'Struttura',
      choices: [
        c('nacl', 'Salgemma (NaCl)'), c('perovskite', 'Perovskite ABX₃'), c('cscl', 'CsCl'), c('bcc', 'Cubica a corpo centrato'), c('fcc', 'Cubica a facce centrate'),
        c('sc', 'Cubica semplice'), c('diamond', 'Diamante'), c('graphene', 'Grafene'), c('liquid', 'Box MD (acqua)'), c('graph', 'Grafo cristallino'), c('cell2d', 'Cella 2D'),
      ],
    },
    { title: 'Opzioni', mode: 'many', choices: [c('supercell', 'Supercella 2×2×2'), c('bonds', 'Legami'), c('vectors', 'Vettori a, b, c'), c('noisy', 'Cella 2D rumorosa'), c('random', 'Cella 2D casuale')] },
  ],
  'chem-reaction': [
    { title: 'Reazione', choices: [c('esterification', 'Esterificazione'), c('amide', 'Ammide'), c('suzuki', 'Suzuki'), c('dielsalder', 'Diels-Alder'), c('acetylation', 'Paracetamolo')] },
    { title: 'Opzioni', mode: 'many', choices: [c('retro', 'Retrosintesi ⇒'), c('equilibrium', 'Equilibrio ⇌'), c('noconditions', 'Senza condizioni'), c('color', 'Eteroatomi a colori')] },
  ],
  'chem-energy': [
    { title: 'Profilo', choices: [c('exo', 'Esotermico'), c('endo', 'Endotermico'), c('catalyzed', 'Con catalizzatore'), c('intermediate', 'Con intermedio')] },
    { title: 'Testo', mode: 'many', choices: [c('annot', 'Ea, ΔH e stati'), c('labels', 'Nomi assi')] },
  ],
  'chem-pes': [
    { title: 'Grafico', choices: [c('surface', 'Superficie 3D'), c('contour', 'Curve di livello'), c('morse', 'Morse'), c('lj', 'Lennard-Jones')] },
    { title: 'Opzioni', mode: 'many', choices: [c('path', 'Cammino di minima energia'), c('labels', 'Nomi e simboli')] },
  ],
  'chem-docking': [
    { title: 'Scena', choices: [c('docked', 'Ligando nella tasca'), c('apart', 'Ligando separato'), c('protein', 'Solo proteina'), c('random', 'Pose casuali (t = T)'), c('mid', 'Pose a metà'), c('final', 'Pose finali (t = 0)'), c('zoom', 'Dettaglio della tasca')] },
    { title: 'Opzioni', mode: 'many', choices: [c('pocket', 'Residui della tasca'), c('hbonds', 'Legami a idrogeno')] },
  ],
  'chem-element': [
    { title: 'Elemento', choices: ['H', 'Li', 'C', 'N', 'O', 'F', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'K', 'Ca', 'Ti', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ag', 'Sn', 'Pt', 'Au', 'Pb', 'U'] },
    { title: 'Opzioni', mode: 'many', choices: [c('cat', 'Colore per categoria'), c('compact', 'Solo simbolo')] },
  ],
  'chem-ptable': [
    { title: 'Evidenzia', mode: 'value', choices: [c('Li Co Ni Mn O', 'Batterie'), c('C H N O S F Cl Br', 'Organici'), c('Fe Co Ni Cu Pd Ag Pt Au', 'Catalizzatori'), c('cats', 'Nessuno')] },
    { title: 'Colori', mode: 'many', choices: [c('cats', 'Categorie'), c('blocks', 'Blocchi s p d f'), c('heat', 'Scala di colore'), c('fblock', 'Lantanidi e attinidi')] },
  ],
  'chem-lab': [{ title: 'Oggetto', choices: [c('flask', 'Beuta'), c('roundflask', 'Pallone'), c('beaker', 'Becher'), c('tubes', 'Provette'), c('plate', 'Piastra 96 pozzetti'), c('robotarm', 'Braccio robotico'), c('pipette', 'Pipetta')] }],
  'chem-spectrum': [
    { title: 'Spettro', choices: [c('xrd', 'XRD'), c('ir', 'IR'), c('nmr', 'NMR'), c('ms', 'Massa'), c('uvvis', 'UV-vis'), c('rdf', 'RDF g(r)')] },
    { title: 'Opzioni', mode: 'many', choices: [c('compare', 'Confronto (riferimento)'), c('labels', 'Nomi assi')] },
  ],
  'chem-bo': [{ title: 'Opzioni', mode: 'many', choices: [c('noacq', 'Senza acquisizione'), c('labels', 'Etichetta α(x)')] }],
  'chem-feat': [
    { title: 'Valori', mode: 'value', choices: [c('0.35 0.6 0.9', 'Barre'), c('0.5 -0.2 0.8', 'Con negativi'), c('cells 0.9 0.4 0 0.9 0.2 0.7 0.4 0 0.9', 'Celle (latente)'), c('cells 0.9 0.6 0.3 0.6 0.9', 'Celle (probabilità)')] },
    { title: 'Stile', mode: 'many', choices: [c('cells', 'Celle a colori')] },
  ],
  'chem-funnel': [{ title: 'Opzioni', mode: 'many', choices: [c('nospout', 'Senza beccuccio')] }],
  'chem-basis': [{ title: 'Funzioni', choices: [c('gauss', 'Gaussiane (RBF)'), c('bessel', 'Bessel'), c('cosine', 'Solo cutoff coseno')] }, { title: 'Opzioni', mode: 'many', choices: [c('cutoff', 'Cutoff'), c('labels', 'Nomi assi')] }],
  'chem-orbital': [{ title: 'Orbitale', choices: [c('table', 'Tabella Y_lm'), c('s', 's'), c('p', 'p'), c('d', 'd'), c('dz2', 'd_z²')] }],
};

const DEFS: Omit<ShapeDef, 'specOptions'>[] = [
  { kind: 'chem-molecule', name: 'Molecola (sfere e bastoncini)', parts: ballStickShape, countLabel: 'Rotazione (×15°)', countMax: 23, specLabel: 'Molecola' },
  { kind: 'chem-skeletal', name: 'Formula di struttura', parts: skeletalShape, countLabel: 'Atomi (catena/anello)', countMax: 16, specLabel: 'Molecola' },
  { kind: 'chem-molgraph', name: 'Grafo molecolare', parts: molGraphShape, countLabel: 'Atomo evidenziato', countMax: 40, specLabel: 'Molecola' },
  { kind: 'chem-smiles', name: 'Stringa SMILES (token)', parts: smilesShape, countLabel: 'Bit (fingerprint)', countMax: 128, specLabel: 'SMILES' },
  { kind: 'chem-mol3d', name: 'Molecola 3D (coordinate, cutoff)', parts: cloudShape, countLabel: 'Atomo centrale', countMax: 40, specLabel: 'Variante' },
  { kind: 'chem-crystal', name: 'Cristallo / cella unitaria', parts: crystalShape, countLabel: 'Molecole / atomi', countMax: 40, specLabel: 'Struttura' },
  { kind: 'chem-reaction', name: 'Schema di reazione', parts: reactionShape, specLabel: 'Reazione' },
  { kind: 'chem-energy', name: 'Profilo energetico di reazione', parts: energyShape, specLabel: 'Variante' },
  { kind: 'chem-pes', name: 'Superficie di energia potenziale', parts: pesShape, specLabel: 'Variante' },
  { kind: 'chem-docking', name: 'Tasca proteica + ligando', parts: dockingShape, countLabel: 'Pose', countMax: 12, specLabel: 'Scena' },
  { kind: 'chem-element', name: 'Elemento (tavola periodica)', parts: elementShape, specLabel: 'Simbolo' },
  { kind: 'chem-ptable', name: 'Tavola periodica', parts: ptableShape, specLabel: 'Elementi evidenziati' },
  { kind: 'chem-lab', name: 'Laboratorio (vetreria, robot)', parts: labShape, countLabel: 'Provette', countMax: 8, specLabel: 'Oggetto' },
  { kind: 'chem-spectrum', name: 'Spettro (XRD, IR, NMR…)', parts: spectrumShape, specLabel: 'Spettro' },
  { kind: 'chem-bo', name: 'Ottimizzazione bayesiana (surrogato)', parts: boShape, countLabel: 'Osservazioni', countMax: 9, specLabel: 'Opzioni' },
  { kind: 'chem-feat', name: 'Vettore di feature (barre, celle)', parts: featShape, specLabel: 'Valori' },
  { kind: 'chem-funnel', name: 'Imbuto di screening', parts: funnelShape, countLabel: 'Stadi', countMax: 8, specLabel: 'Opzioni' },
  { kind: 'chem-basis', name: 'Basi radiali (RBF, Bessel)', parts: basisShape, countLabel: 'Funzioni', countMax: 16, specLabel: 'Funzioni' },
  { kind: 'chem-orbital', name: 'Armoniche sferiche / orbitali', parts: orbitalShape, countLabel: 'Grado massimo l', countMax: 2, specLabel: 'Orbitale' },
];

export const CHEM_SHAPES: ShapeDef[] = DEFS.map((d) => ({ ...d, specOptions: OPTIONS[d.kind] }));

// ======================================================================
// Dati: elementi (simbolo, nome inglese, massa atomica) e molecole
// ======================================================================

const ELEMENTS = [
  'H Hydrogen 1.008|He Helium 4.003|Li Lithium 6.94|Be Beryllium 9.012|B Boron 10.81|C Carbon 12.011|N Nitrogen 14.007|O Oxygen 15.999|F Fluorine 18.998',
  'Ne Neon 20.180|Na Sodium 22.990|Mg Magnesium 24.305|Al Aluminium 26.982|Si Silicon 28.085|P Phosphorus 30.974|S Sulfur 32.06|Cl Chlorine 35.45',
  'Ar Argon 39.95|K Potassium 39.098|Ca Calcium 40.078|Sc Scandium 44.956|Ti Titanium 47.867|V Vanadium 50.942|Cr Chromium 51.996|Mn Manganese 54.938',
  'Fe Iron 55.845|Co Cobalt 58.933|Ni Nickel 58.693|Cu Copper 63.546|Zn Zinc 65.38|Ga Gallium 69.723|Ge Germanium 72.630|As Arsenic 74.922',
  'Se Selenium 78.971|Br Bromine 79.904|Kr Krypton 83.798|Rb Rubidium 85.468|Sr Strontium 87.62|Y Yttrium 88.906|Zr Zirconium 91.224|Nb Niobium 92.906',
  'Mo Molybdenum 95.95|Tc Technetium [98]|Ru Ruthenium 101.07|Rh Rhodium 102.91|Pd Palladium 106.42|Ag Silver 107.87|Cd Cadmium 112.41|In Indium 114.82',
  'Sn Tin 118.71|Sb Antimony 121.76|Te Tellurium 127.60|I Iodine 126.90|Xe Xenon 131.29|Cs Caesium 132.91|Ba Barium 137.33|La Lanthanum 138.91',
  'Ce Cerium 140.12|Pr Praseodymium 140.91|Nd Neodymium 144.24|Pm Promethium [145]|Sm Samarium 150.36|Eu Europium 151.96|Gd Gadolinium 157.25',
  'Tb Terbium 158.93|Dy Dysprosium 162.50|Ho Holmium 164.93|Er Erbium 167.26|Tm Thulium 168.93|Yb Ytterbium 173.05|Lu Lutetium 174.97|Hf Hafnium 178.49',
  'Ta Tantalum 180.95|W Tungsten 183.84|Re Rhenium 186.21|Os Osmium 190.23|Ir Iridium 192.22|Pt Platinum 195.08|Au Gold 196.97|Hg Mercury 200.59',
  'Tl Thallium 204.38|Pb Lead 207.2|Bi Bismuth 208.98|Po Polonium [209]|At Astatine [210]|Rn Radon [222]|Fr Francium [223]|Ra Radium [226]',
  'Ac Actinium [227]|Th Thorium 232.04|Pa Protactinium 231.04|U Uranium 238.03|Np Neptunium [237]|Pu Plutonium [244]|Am Americium [243]|Cm Curium [247]',
  'Bk Berkelium [247]|Cf Californium [251]|Es Einsteinium [252]|Fm Fermium [257]|Md Mendelevium [258]|No Nobelium [259]|Lr Lawrencium [266]',
  'Rf Rutherfordium [267]|Db Dubnium [268]|Sg Seaborgium [269]|Bh Bohrium [270]|Hs Hassium [277]|Mt Meitnerium [278]|Ds Darmstadtium [281]',
  'Rg Roentgenium [282]|Cn Copernicium [285]|Nh Nihonium [286]|Fl Flerovium [289]|Mc Moscovium [290]|Lv Livermorium [293]|Ts Tennessine [294]|Og Oganesson [294]',
].join('|');

// Coordinate generate con RDKit: `xy` disegno 2D (legame = 1, y verso il basso) degli atomi pesanti
// con idrogeni impliciti `h`, legami [i, j, ordine, aromatico] e anelli `r`; `xyz` conformero 3D
// con idrogeni (Å, ETKDG + MMFF) e legami [i, j, ordine] in forma di Kekulé.
const MOLS: Record<string, MolData> = {
  water: {
    a: 'O', h: '2', r: [],
    xy: [0, 0],
    b: [],
    a3: 'O H H',
    xyz: [0, 0, 0, 0.76, -0.6, 0, -0.76, -0.6, 0],
    b3: [0, 1, 1, 0, 2, 1],
  },
  methane: {
    a: 'C', h: '4', r: [],
    xy: [0, 0],
    b: [],
    a3: 'C H H H H',
    xyz: [0, 0, 0, 1.01, -0.18, 0.36, -0.67, 0.16, 0.85, 0, 0.89, -0.64, -0.34, -0.86, -0.58],
    b3: [0, 1, 1, 0, 2, 1, 0, 3, 1, 0, 4, 1],
  },
  ammonia: {
    a: 'N', h: '3', r: [],
    xy: [0, 0],
    b: [],
    a3: 'N H H H',
    xyz: [0, 0, 0, 0.82, -0.46, -0.39, -0.81, -0.48, -0.39, -0.01, 0.94, -0.39],
    b3: [0, 1, 1, 0, 2, 1, 0, 3, 1],
  },
  co2: {
    a: 'O C O', h: '000', r: [],
    xy: [-1, 0, 0, 0, 1, 0],
    b: [0, 1, 2, 0, 1, 2, 2, 0],
    a3: 'O C O',
    xyz: [-1.4, 0, 0, 0, 0, 0, 1.41, 0, 0],
    b3: [0, 1, 2, 1, 2, 2],
  },
  ethylene: {
    a: 'C C', h: '22', r: [],
    xy: [-0.5, 0, 0.5, 0],
    b: [0, 1, 2, 0],
    a3: 'C C H H H H',
    xyz: [-0.67, 0, 0, 0.67, 0, 0, -1.23, -0.93, 0, -1.23, 0.93, 0, 1.23, 0.93, 0, 1.23, -0.93, 0],
    b3: [0, 1, 2, 0, 2, 1, 0, 3, 1, 1, 4, 1, 1, 5, 1],
  },
  ethanol: {
    a: 'C C O', h: '321', r: [],
    xy: [-0.87, -0.17, 0, 0.33, 0.87, -0.17],
    b: [0, 1, 1, 0, 1, 2, 1, 0],
    a3: 'C C O H H H H H H',
    xyz: [
      -1.23, -0.26, 0, 0.05, 0.56, 0, 1.18, -0.3, 0, -2.11, 0.38, 0.02, -1.25, -0.93, 0.87, -1.27, -0.9, -0.89, 0.09, 1.21, -0.88, 0.09, 1.19, 0.89, 1.13,
      -0.84, -0.8,
    ],
    b3: [0, 1, 1, 1, 2, 1, 0, 3, 1, 0, 4, 1, 0, 5, 1, 1, 6, 1, 1, 7, 1, 2, 8, 1],
  },
  aceticacid: {
    a: 'C C O O', h: '3001', r: [],
    xy: [-0.87, 0.5, 0, 0, 0, -1, 0.87, 0.5],
    b: [0, 1, 1, 0, 1, 2, 2, 0, 1, 3, 1, 0],
    a3: 'C C O O H H H H',
    xyz: [-1.41, 0.22, 0, 0.07, 0.06, 0, 0.9, 0.96, 0, 0.45, -1.23, 0, -1.84, -0.24, 0.9, -1.66, 1.28, 0, -1.84, -0.24, -0.9, 1.43, -1.19, 0],
    b3: [0, 1, 1, 1, 2, 2, 1, 3, 1, 0, 4, 1, 0, 5, 1, 0, 6, 1, 3, 7, 1],
  },
  glycine: {
    a: 'N C C O O', h: '22001', r: [],
    xy: [-1.39, 0, -0.52, 0.5, 0.35, 0, 0.35, -1, 1.21, 0.5],
    b: [0, 1, 1, 0, 1, 2, 1, 0, 2, 3, 2, 0, 2, 4, 1, 0],
    a3: 'N C C O O H H H H H',
    xyz: [
      -1.9, 0.1, -0.23, -0.79, -0.71, 0.29, 0.56, -0.05, 0.02, 1.62, -0.63, -0.17, 0.52, 1.3, 0.09, -2.77, -0.21, 0.2, -1.75, 1.06, 0.07, -0.89, -0.85,
      1.37, -0.8, -1.69, -0.2, 1.44, 1.56, -0.1,
    ],
    b3: [0, 1, 1, 1, 2, 1, 2, 3, 2, 2, 4, 1, 0, 5, 1, 0, 6, 1, 1, 7, 1, 1, 8, 1, 4, 9, 1],
  },
  benzene: {
    a: 'C C C C C C', h: '111111', r: [[0, 5, 4, 3, 2, 1]],
    xy: [0.87, 0.5, 0, 1, -0.87, 0.5, -0.87, -0.5, 0, -1, 0.87, -0.5],
    b: [0, 1, 1, 1, 1, 2, 2, 1, 2, 3, 1, 1, 3, 4, 2, 1, 4, 5, 1, 1, 5, 0, 2, 1],
    a3: 'C C C C C C H H H H H H',
    xyz: [
      0.4, -1.34, 0, 1.36, -0.32, 0, 0.96, 1.01, 0, -0.4, 1.34, 0, -1.36, 0.32, 0, -0.96, -1.01, 0, 0.71, -2.38, 0, 2.41, -0.58, 0, 1.71, 1.8, 0, -0.71,
      2.38, 0, -2.41, 0.58, 0, -1.71, -1.8, 0,
    ],
    b3: [0, 1, 1, 1, 2, 2, 2, 3, 1, 3, 4, 2, 4, 5, 1, 5, 0, 2, 0, 6, 1, 1, 7, 1, 2, 8, 1, 3, 9, 1, 4, 10, 1, 5, 11, 1],
  },
  pyridine: {
    a: 'C C C N C C', h: '111011', r: [[0, 5, 4, 3, 2, 1]],
    xy: [-0.87, -0.5, -0.87, 0.5, 0, 1, 0.87, 0.5, 0.87, -0.5, 0, -1],
    b: [0, 1, 2, 1, 1, 2, 1, 1, 2, 3, 2, 1, 3, 4, 1, 1, 4, 5, 2, 1, 5, 0, 1, 1],
    a3: 'C C C N C C H H H H H',
    xyz: [
      -1.4, 0, 0, -0.69, -1.2, 0, 0.69, -1.15, 0, 1.4, 0, 0, 0.69, 1.15, 0, -0.69, 1.2, 0, -2.48, 0, 0, -1.21, -2.15, 0, 1.28, -2.06, 0, 1.28, 2.06, 0,
      -1.21, 2.15, 0,
    ],
    b3: [0, 1, 2, 1, 2, 1, 2, 3, 2, 3, 4, 1, 4, 5, 2, 5, 0, 1, 0, 6, 1, 1, 7, 1, 2, 8, 1, 4, 9, 1, 5, 10, 1],
  },
  cyclohexane: {
    a: 'C C C C C C', h: '222222', r: [[0, 5, 4, 3, 2, 1]],
    xy: [0.87, 0.5, 0, 1, -0.87, 0.5, -0.87, -0.5, 0, -1, 0.87, -0.5],
    b: [0, 1, 1, 0, 1, 2, 1, 0, 2, 3, 1, 0, 3, 4, 1, 0, 4, 5, 1, 0, 5, 0, 1, 0],
    a3: 'C C C C C C H H H H H H H H H H H H',
    xyz: [
      -1.35, 0.56, -0.23, -0.19, 1.45, 0.23, 1.16, 0.89, -0.23, 1.35, -0.56, 0.23, 0.19, -1.45, -0.23, -1.16, -0.89, 0.23, -1.43, 0.59, -1.32, -2.29, 0.95,
      0.17, -0.32, 2.46, -0.17, -0.2, 1.53, 1.32, 1.22, 0.94, -1.32, 1.97, 1.51, 0.17, 2.29, -0.95, -0.17, 1.43, -0.59, 1.32, 0.32, -2.46, 0.17, 0.2,
      -1.53, -1.32, -1.22, -0.94, 1.32, -1.97, -1.51, -0.17,
    ],
    b3: [
      0, 1, 1, 1, 2, 1, 2, 3, 1, 3, 4, 1, 4, 5, 1, 5, 0, 1, 0, 6, 1, 0, 7, 1, 1, 8, 1, 1, 9, 1, 2, 10, 1, 2, 11, 1, 3, 12, 1, 3, 13, 1, 4, 14, 1, 4, 15, 1,
      5, 16, 1, 5, 17, 1,
    ],
  },
  naphthalene: {
    a: 'C C C C C C C C C C', h: '1110111101', r: [[0, 9, 8, 3, 2, 1], [4, 5, 6, 7, 8, 3]],
    xy: [-1.73, -0.5, -1.73, 0.5, -0.87, 1, 0, 0.5, 0.87, 1, 1.73, 0.5, 1.73, -0.5, 0.87, -1, 0, -0.5, -0.87, -1],
    b: [0, 1, 2, 1, 1, 2, 1, 1, 2, 3, 2, 1, 3, 4, 1, 1, 4, 5, 2, 1, 5, 6, 1, 1, 6, 7, 2, 1, 7, 8, 1, 1, 8, 9, 2, 1, 9, 0, 1, 1, 8, 3, 1, 1],
    a3: 'C C C C C C C C C C H H H H H H H H',
    xyz: [
      -2.43, 0.7, 0, -2.43, -0.7, 0, -1.23, -1.39, 0, 0, -0.71, 0, 1.23, -1.39, 0, 2.43, -0.7, 0, 2.43, 0.7, 0, 1.23, 1.39, 0, 0, 0.71, 0, -1.23, 1.39, 0,
      -3.37, 1.24, 0, -3.37, -1.24, 0, -1.25, -2.48, 0, 1.25, -2.48, 0, 3.37, -1.24, 0, 3.37, 1.24, 0, 1.25, 2.48, 0, -1.25, 2.48, 0,
    ],
    b3: [
      0, 1, 2, 1, 2, 1, 2, 3, 2, 3, 4, 1, 4, 5, 2, 5, 6, 1, 6, 7, 2, 7, 8, 1, 8, 9, 2, 9, 0, 1, 8, 3, 1, 0, 10, 1, 1, 11, 1, 2, 12, 1, 4, 13, 1, 5, 14, 1,
      6, 15, 1, 7, 16, 1, 9, 17, 1,
    ],
  },
  phenol: {
    a: 'O C C C C C C', h: '1011111', r: [[1, 6, 5, 4, 3, 2]],
    xy: [-1.48, -0.86, -0.62, -0.36, 0.25, -0.86, 1.11, -0.36, 1.11, 0.64, 0.25, 1.14, -0.62, 0.64],
    b: [0, 1, 1, 0, 1, 2, 2, 1, 2, 3, 1, 1, 3, 4, 2, 1, 4, 5, 1, 1, 5, 6, 2, 1, 6, 1, 1, 1],
    a3: 'O C C C C C C H H H H H H',
    xyz: [
      -2.36, 0, 0, -0.99, 0.02, 0, -0.29, 1.22, 0, 1.11, 1.2, 0, 1.79, -0.02, 0, 1.07, -1.22, 0, -0.32, -1.2, 0, -2.68, 0.91, 0, -0.8, 2.18, 0, 1.67, 2.13,
      0, 2.87, -0.04, 0, 1.6, -2.17, 0, -0.89, -2.13, 0,
    ],
    b3: [0, 1, 1, 1, 2, 2, 2, 3, 1, 3, 4, 2, 4, 5, 1, 5, 6, 2, 6, 1, 1, 0, 7, 1, 2, 8, 1, 3, 9, 1, 4, 10, 1, 5, 11, 1, 6, 12, 1],
  },
  paracetamol: {
    a: 'C C O N C C C C O C C', h: '30010110111', r: [[4, 10, 9, 7, 6, 5]],
    xy: [-2.77, -0.55, -1.77, -0.55, -1.27, -1.42, -1.27, 0.31, -0.27, 0.31, 0.23, 1.18, 1.23, 1.18, 1.73, 0.31, 2.73, 0.31, 1.23, -0.55, 0.23, -0.55],
    b: [0, 1, 1, 0, 1, 2, 2, 0, 1, 3, 1, 0, 3, 4, 1, 0, 4, 5, 1, 1, 5, 6, 2, 1, 6, 7, 1, 1, 7, 8, 1, 0, 7, 9, 2, 1, 9, 10, 1, 1, 10, 4, 2, 1],
    a3: 'C C O N C C C C O C C H H H H H H H H H',
    xyz: [
      -3.98, 0.58, 0, -2.67, -0.16, 0, -2.64, -1.38, -0.02, -1.59, 0.7, 0.01, -0.22, 0.36, 0, 0.26, -0.95, 0.01, 1.64, -1.21, 0.01, 2.53, -0.15, 0, 3.88,
      -0.36, 0, 2.08, 1.16, -0.01, 0.7, 1.41, -0.01, -4.24, 0.86, -1.02, -4.77, -0.07, 0.41, -3.93, 1.48, 0.63, -1.79, 1.69, 0, -0.41, -1.81, 0.02, 1.98,
      -2.24, 0.01, 4.05, -1.31, 0, 2.79, 1.98, -0.01, 0.37, 2.45, -0.01,
    ],
    b3: [
      0, 1, 1, 1, 2, 2, 1, 3, 1, 3, 4, 1, 4, 5, 1, 5, 6, 2, 6, 7, 1, 7, 8, 1, 7, 9, 2, 9, 10, 1, 10, 4, 2, 0, 11, 1, 0, 12, 1, 0, 13, 1, 3, 14, 1, 5, 15,
      1, 6, 16, 1, 8, 17, 1, 9, 18, 1, 10, 19, 1,
    ],
  },
  aspirin: {
    a: 'C C O O C C C C C C C O O', h: '3000011110001', r: [[4, 9, 8, 7, 6, 5]],
    xy: [
      -2.66, -0.31, -1.8, 0.19, -1.8, 1.19, -0.93, -0.31, -0.07, 0.19, -0.07, 1.19, 0.8, 1.69, 1.67, 1.19, 1.67, 0.19, 0.8, -0.31, 0.8, -1.31, -0.07,
      -1.81, 1.67, -1.81,
    ],
    b: [
      0, 1, 1, 0, 1, 2, 2, 0, 1, 3, 1, 0, 3, 4, 1, 0, 4, 5, 2, 1, 5, 6, 1, 1, 6, 7, 2, 1, 7, 8, 1, 1, 8, 9, 2, 1, 9, 10, 1, 0, 10, 11, 2, 0, 10, 12, 1, 0,
      9, 4, 1, 1,
    ],
    a3: 'C C O O C C C C C C C O O H H H H H H H H',
    xyz: [
      -3.48, -0.69, 0.21, -2.07, -0.72, -0.29, -1.76, -0.77, -1.48, -1.2, -0.71, 0.79, 0.14, -0.64, 0.41, 0.85, -1.85, 0.41, 2.2, -1.85, 0.06, 2.84, -0.65,
      -0.28, 2.12, 0.55, -0.26, 0.76, 0.57, 0.09, 0.01, 1.85, 0.13, -1.14, 2.01, 0.49, 0.74, 2.9, -0.28, -3.69, -1.6, 0.79, -4.17, -0.64, -0.63, -3.63,
      0.2, 0.83, 0.36, -2.78, 0.68, 2.76, -2.78, 0.05, 3.89, -0.65, -0.55, 2.64, 1.47, -0.53, 0.12, 3.66, -0.22,
    ],
    b3: [
      0, 1, 1, 1, 2, 2, 1, 3, 1, 3, 4, 1, 4, 5, 2, 5, 6, 1, 6, 7, 2, 7, 8, 1, 8, 9, 2, 9, 10, 1, 10, 11, 2, 10, 12, 1, 9, 4, 1, 0, 13, 1, 0, 14, 1, 0, 15,
      1, 5, 16, 1, 6, 17, 1, 7, 18, 1, 8, 19, 1, 12, 20, 1,
    ],
  },
  ibuprofen: {
    a: 'C C C C C C C C C C C C C O O', h: '313201101113001', r: [[4, 9, 8, 7, 6, 5]],
    xy: [
      -3.58, -1.13, -2.71, -0.63, -2.71, 0.37, -1.85, -1.13, -0.98, -0.63, -0.98, 0.37, -0.12, 0.87, 0.75, 0.37, 0.75, -0.63, -0.12, -1.13, 1.62, 0.87,
      1.62, 1.87, 2.48, 0.37, 2.48, -0.63, 3.35, 0.87,
    ],
    b: [
      0, 1, 1, 0, 1, 2, 1, 0, 1, 3, 1, 0, 3, 4, 1, 0, 4, 5, 1, 1, 5, 6, 2, 1, 6, 7, 1, 1, 7, 8, 2, 1, 8, 9, 1, 1, 7, 10, 1, 0, 10, 11, 1, 0, 10, 12, 1, 0,
      12, 13, 2, 0, 12, 14, 1, 0, 9, 4, 2, 1,
    ],
    a3: 'C C C C C C C C C C C C C O O H H H H H H H H H H H H H H H H H H',
    xyz: [
      -5.22, 0.31, -0.7, -3.73, 0.55, -0.43, -3.57, 1.67, 0.59, -3.07, -0.76, 0.03, -1.56, -0.68, 0.12, -0.92, -0.64, 1.36, 0.47, -0.56, 1.44, 1.26, -0.53,
      0.28, 0.61, -0.56, -0.96, -0.78, -0.64, -1.04, 2.77, -0.43, 0.39, 3.48, -1.58, -0.32, 3.28, 0.93, -0.05, 3.37, 1.92, 0.65, 3.6, 1.01, -1.36, -5.74,
      -0.02, 0.2, -5.35, -0.46, -1.47, -5.7, 1.22, -1.06, -3.27, 0.88, -1.37, -4.09, 2.58, 0.26, -3.98, 1.38, 1.57, -2.52, 1.93, 0.74, -3.32, -1.57, -0.67,
      -3.48, -1.07, 1, -1.5, -0.66, 2.28, 0.94, -0.52, 2.43, 1.19, -0.53, -1.89, -1.25, -0.67, -2.02, 3.06, -0.52, 1.45, 3.29, -1.6, -1.4, 4.57, -1.5,
      -0.19, 3.16, -2.55, 0.09, 3.85, 1.95, -1.48,
    ],
    b3: [
      0, 1, 1, 1, 2, 1, 1, 3, 1, 3, 4, 1, 4, 5, 1, 5, 6, 2, 6, 7, 1, 7, 8, 2, 8, 9, 1, 7, 10, 1, 10, 11, 1, 10, 12, 1, 12, 13, 2, 12, 14, 1, 9, 4, 2, 0,
      15, 1, 0, 16, 1, 0, 17, 1, 1, 18, 1, 2, 19, 1, 2, 20, 1, 2, 21, 1, 3, 22, 1, 3, 23, 1, 5, 24, 1, 6, 25, 1, 8, 26, 1, 9, 27, 1, 10, 28, 1, 11, 29, 1,
      11, 30, 1, 11, 31, 1, 14, 32, 1,
    ],
  },
  caffeine: {
    a: 'C N C N C C C O N C C O N C', h: '30100000030003', r: [[1, 2, 3, 4, 5], [6, 8, 10, 12, 4, 5]],
    xy: [
      -1.76, 1.67, -1.47, 0.71, -2.07, -0.09, -1.5, -0.91, -0.54, -0.62, -0.52, 0.38, 0.35, 0.87, 0.37, 1.87, 1.21, 0.35, 2.08, 0.84, 1.19, -0.65, 2.05,
      -1.16, 0.32, -1.13, 0.3, -2.13,
    ],
    b: [
      0, 1, 1, 0, 1, 2, 1, 1, 2, 3, 2, 1, 3, 4, 1, 1, 4, 5, 2, 1, 5, 6, 1, 1, 6, 7, 2, 0, 6, 8, 1, 1, 8, 9, 1, 0, 8, 10, 1, 1, 10, 11, 2, 0, 10, 12, 1, 1,
      12, 13, 1, 0, 5, 1, 1, 1, 12, 4, 1, 1,
    ],
    a3: 'C N C N C C C O N C C O N C H H H H H H H H H H',
    xyz: [
      -3.17, 1.24, 0, -2.22, 0.16, 0, -2.51, -1.18, 0, -1.42, -1.91, 0, -0.4, -1.01, 0, -0.86, 0.27, 0, 0, 1.4, 0, -0.42, 2.56, 0, 1.36, 1.06, 0, 2.34,
      2.12, 0, 1.87, -0.26, 0, 3.09, -0.47, 0, 0.94, -1.3, 0, 1.39, -2.69, 0, -3.01, 1.84, -0.9, -3.01, 1.84, 0.9, -4.18, 0.84, 0, -3.53, -1.55, 0, 2.97,
      2.03, -0.89, 1.88, 3.12, 0, 2.97, 2.03, 0.89, 1, -3.18, 0.89, 2.48, -2.76, 0, 1, -3.18, -0.89,
    ],
    b3: [
      0, 1, 1, 1, 2, 1, 2, 3, 2, 3, 4, 1, 4, 5, 2, 5, 6, 1, 6, 7, 2, 6, 8, 1, 8, 9, 1, 8, 10, 1, 10, 11, 2, 10, 12, 1, 12, 13, 1, 5, 1, 1, 12, 4, 1, 0, 14,
      1, 0, 15, 1, 0, 16, 1, 2, 17, 1, 9, 18, 1, 9, 19, 1, 9, 20, 1, 13, 21, 1, 13, 22, 1, 13, 23, 1,
    ],
  },
  dopamine: {
    a: 'N C C C C C C O C O C', h: '22201101011', r: [[3, 10, 8, 6, 5, 4]],
    xy: [-3.07, 0.77, -2.2, 0.27, -1.34, 0.77, -0.47, 0.27, -0.47, -0.73, 0.39, -1.23, 1.26, -0.73, 2.13, -1.23, 1.26, 0.27, 2.13, 0.77, 0.39, 0.77],
    b: [0, 1, 1, 0, 1, 2, 1, 0, 2, 3, 1, 0, 3, 4, 1, 1, 4, 5, 2, 1, 5, 6, 1, 1, 6, 7, 1, 0, 6, 8, 2, 1, 8, 9, 1, 0, 8, 10, 1, 1, 10, 3, 2, 1],
    a3: 'N C C C C C C O C O C H H H H H H H H H H H',
    xyz: [
      -3.61, 0.83, -0.66, -3.13, -0.55, -0.5, -2.19, -0.72, 0.7, -0.77, -0.26, 0.43, -0.46, 1.11, 0.45, 0.85, 1.54, 0.2, 1.85, 0.61, -0.06, 3.13, 1.02,
      -0.31, 1.55, -0.75, -0.08, 2.54, -1.65, -0.34, 0.24, -1.19, 0.16, -4.23, 0.88, -1.46, -4.16, 1.1, 0.16, -2.64, -0.87, -1.42, -4.01, -1.19, -0.35,
      -2.16, -1.79, 0.97, -2.58, -0.21, 1.59, -1.24, 1.84, 0.64, 1.06, 2.61, 0.21, 3.16, 1.99, -0.28, 2.17, -2.54, -0.32, 0.01, -2.25, 0.15,
    ],
    b3: [
      0, 1, 1, 1, 2, 1, 2, 3, 1, 3, 4, 1, 4, 5, 2, 5, 6, 1, 6, 7, 1, 6, 8, 2, 8, 9, 1, 8, 10, 1, 10, 3, 2, 0, 11, 1, 0, 12, 1, 1, 13, 1, 1, 14, 1, 2, 15,
      1, 2, 16, 1, 4, 17, 1, 5, 18, 1, 7, 19, 1, 9, 20, 1, 10, 21, 1,
    ],
  },
  ethylnaphthalene: {
    a: 'C C C C C C C C C C C C', h: '320111011110', r: [[2, 11, 6, 5, 4, 3], [7, 8, 9, 10, 11, 6]],
    xy: [
      -0.07, -2.12, 0.79, -1.62, 0.79, -0.62, 1.66, -0.13, 1.66, 0.87, 0.79, 1.38, -0.07, 0.88, -0.94, 1.37, -1.8, 0.88, -1.8, -0.12, -0.94, -0.63, -0.07,
      -0.12,
    ],
    b: [
      0, 1, 1, 0, 1, 2, 1, 0, 2, 3, 2, 1, 3, 4, 1, 1, 4, 5, 2, 1, 5, 6, 1, 1, 6, 7, 2, 1, 7, 8, 1, 1, 8, 9, 2, 1, 9, 10, 1, 1, 10, 11, 2, 1, 11, 2, 1, 1,
      11, 6, 1, 1,
    ],
    a3: 'C C C C C C C C C C C C H H H H H H H H H H H H',
    xyz: [
      -3.67, -1.2, 0, -2.16, -1.42, 0, -1.26, -0.19, 0, -1.81, 1.11, 0, -1, 2.24, 0, 0.39, 2.09, 0, 0.97, 0.82, 0, 2.37, 0.7, 0, 2.99, -0.55, 0, 2.21,
      -1.69, 0, 0.81, -1.59, 0, 0.16, -0.34, 0, -3.99, -0.65, -0.89, -4.19, -2.16, 0, -3.99, -0.65, 0.89, -1.92, -2.01, -0.89, -1.92, -2.01, 0.89, -2.89,
      1.26, 0, -1.44, 3.23, 0, 1, 2.99, 0, 3, 1.59, 0, 4.07, -0.62, 0, 2.68, -2.67, 0, 0.24, -2.51, 0,
    ],
    b3: [
      0, 1, 1, 1, 2, 1, 2, 3, 2, 3, 4, 1, 4, 5, 2, 5, 6, 1, 6, 7, 2, 7, 8, 1, 8, 9, 2, 9, 10, 1, 10, 11, 2, 11, 2, 1, 11, 6, 1, 0, 12, 1, 0, 13, 1, 0, 14,
      1, 1, 15, 1, 1, 16, 1, 3, 17, 1, 4, 18, 1, 5, 19, 1, 7, 20, 1, 8, 21, 1, 9, 22, 1, 10, 23, 1,
    ],
  },
  jtmol: {
    a: 'C N C O C S C C C C C C C Cl', h: '31000001111000', r: [[4, 5, 6, 11, 12], [7, 8, 9, 10, 11, 6]],
    xy: [
      3.28, -0.42, 2.29, -0.58, 1.66, 0.2, 2.02, 1.13, 0.67, 0.04, 0.22, -0.85, -0.77, -0.69, -1.55, -1.32, -2.48, -0.96, -2.64, 0.02, -1.86, 0.65, -0.93,
      0.29, -0.04, 0.75, 0.12, 1.74,
    ],
    b: [
      0, 1, 1, 0, 1, 2, 1, 0, 2, 3, 2, 0, 2, 4, 1, 0, 4, 5, 1, 1, 5, 6, 1, 1, 6, 7, 2, 1, 7, 8, 1, 1, 8, 9, 2, 1, 9, 10, 1, 1, 10, 11, 2, 1, 11, 12, 1, 1,
      12, 13, 1, 0, 12, 4, 2, 1, 11, 6, 1, 1,
    ],
    a3: 'C N C O C S C C C C C C C Cl H H H H H H H H',
    xyz: [
      -4.63, -1.06, 0.06, -3.19, -1.05, -0.04, -2.48, 0.14, -0.02, -3.06, 1.22, 0, -1.02, 0, -0.01, -0.29, -1.55, -0.01, 1.3, -0.9, 0, 2.51, -1.63, 0,
      3.72, -0.94, 0.01, 3.74, 0.44, 0.01, 2.54, 1.16, 0.01, 1.29, 0.49, 0, -0.06, 1, 0, -0.38, 2.69, 0, -4.99, -2.04, -0.25, -4.92, -0.87, 1.1, -5.06,
      -0.29, -0.59, -2.69, -1.91, 0.06, 2.5, -2.72, 0, 4.66, -1.5, 0.01, 4.69, 0.98, 0.02, 2.58, 2.25, 0.01,
    ],
    b3: [
      0, 1, 1, 1, 2, 1, 2, 3, 2, 2, 4, 1, 4, 5, 1, 5, 6, 1, 6, 7, 2, 7, 8, 1, 8, 9, 2, 9, 10, 1, 10, 11, 2, 11, 12, 1, 12, 13, 1, 12, 4, 2, 11, 6, 1, 0,
      14, 1, 0, 15, 1, 0, 16, 1, 1, 17, 1, 7, 18, 1, 8, 19, 1, 9, 20, 1, 10, 21, 1,
    ],
  },
  dockligand: {
    a: 'C C C C O N N C C C C N C C C C C N C C', h: '30100000011011122122', r: [[1, 7, 6, 5, 3, 2], [9, 10, 11, 12, 13, 8], [15, 16, 17, 18, 19, 14]],
    xy: [
      -1.73, 1.8, -0.87, 1.3, 0, 1.8, 0.87, 1.3, 1.73, 1.8, 0.87, 0.3, 0, -0.2, -0.87, 0.3, -1.73, -0.2, -2.6, 0.3, -3.46, -0.2, -3.46, -1.2, -2.6, -1.7,
      -1.73, -1.2, 1.73, -0.2, 1.73, -1.2, 2.6, -1.7, 3.46, -1.2, 3.46, -0.2, 2.6, 0.3,
    ],
    b: [
      0, 1, 1, 0, 1, 2, 2, 1, 2, 3, 1, 1, 3, 4, 2, 0, 3, 5, 1, 1, 5, 6, 1, 1, 6, 7, 2, 1, 7, 8, 1, 0, 8, 9, 1, 1, 9, 10, 2, 1, 10, 11, 1, 1, 11, 12, 2, 1,
      12, 13, 1, 1, 5, 14, 1, 0, 14, 15, 1, 0, 15, 16, 1, 0, 16, 17, 1, 0, 17, 18, 1, 0, 18, 19, 1, 0, 7, 1, 1, 1, 13, 8, 2, 1, 19, 14, 1, 0,
    ],
    a3: 'C C C C O N N C C C C N C C C C C N C C H H H H H H H H H H H H H H H H H H',
    xyz: [
      -2.61, 2.62, -0.31, -1.26, 2.01, -0.09, -0.14, 2.74, -0.06, 1.19, 2.12, 0.09, 2.19, 2.85, 0.07, 1.21, 0.74, 0.23, 0.09, -0.04, 0.16, -1.06, 0.54,
      0.04, -2.26, -0.32, -0.01, -2.4, -1.22, -1.07, -3.52, -2.03, -1.07, -4.47, -2, -0.1, -4.28, -1.15, 0.92, -3.19, -0.29, 1.02, 2.51, 0.04, 0.29, 3.03,
      -0.27, -1.12, 4.37, -0.99, -1.04, 4.29, -2.2, -0.23, 3.84, -1.91, 1.13, 2.47, -1.24, 1.14, -3.13, 2.14, -1.14, -3.22, 2.55, 0.59, -2.53, 3.69, -0.55,
      -0.14, 3.82, -0.17, -1.66, -1.28, -1.86, -3.69, -2.75, -1.87, -5.04, -1.17, 1.69, -3.08, 0.36, 1.88, 3.22, 0.73, 0.77, 3.14, 0.65, -1.7, 2.3, -0.89,
      -1.66, 5.14, -0.32, -0.64, 4.69, -1.26, -2.05, 5.21, -2.65, -0.19, 4.58, -1.28, 1.65, 3.78, -2.85, 1.69, 1.73, -1.94, 0.75, 2.18, -1, 2.17,
    ],
    b3: [
      0, 1, 1, 1, 2, 2, 2, 3, 1, 3, 4, 2, 3, 5, 1, 5, 6, 1, 6, 7, 2, 7, 8, 1, 8, 9, 2, 9, 10, 1, 10, 11, 2, 11, 12, 1, 12, 13, 2, 5, 14, 1, 14, 15, 1, 15,
      16, 1, 16, 17, 1, 17, 18, 1, 18, 19, 1, 7, 1, 1, 13, 8, 1, 19, 14, 1, 0, 20, 1, 0, 21, 1, 0, 22, 1, 2, 23, 1, 9, 24, 1, 10, 25, 1, 12, 26, 1, 13, 27,
      1, 14, 28, 1, 15, 29, 1, 15, 30, 1, 16, 31, 1, 16, 32, 1, 17, 33, 1, 18, 34, 1, 18, 35, 1, 19, 36, 1, 19, 37, 1,
    ],
  },
  ethylacetate: {
    a: 'C C O C C O', h: '320030', r: [],
    xy: [-1.88, 0.42, -1.01, -0.08, -0.14, 0.42, 0.72, -0.08, 1.59, 0.42, 0.72, -1.08],
    b: [0, 1, 1, 0, 1, 2, 1, 0, 2, 3, 1, 0, 3, 4, 1, 0, 3, 5, 2, 0],
    a3: 'C C O C C O H H H H H H H H',
    xyz: [
      -2.2, -0.14, 0.65, -1.41, 0.24, -0.59, -0.14, 0.78, -0.22, 0.86, -0.12, -0.04, 2.13, 0.58, 0.34, 0.76, -1.34, -0.15, -1.68, -0.93, 1.22, -2.3, 0.72,
      1.32, -3.19, -0.51, 0.39, -1.3, -0.61, -1.27, -1.95, 1.02, -1.13, 2.93, -0.15, 0.48, 1.99, 1.12, 1.28, 2.42, 1.27, -0.46,
    ],
    b3: [0, 1, 1, 1, 2, 1, 2, 3, 1, 3, 4, 1, 3, 5, 2, 0, 6, 1, 0, 7, 1, 0, 8, 1, 1, 9, 1, 1, 10, 1, 4, 11, 1, 4, 12, 1, 4, 13, 1],
  },
  acetylchloride: {
    a: 'C C Cl O', h: '3000', r: [],
    xy: [-0.87, -0.5, 0, 0, 0, 1, 0.87, -0.5],
    b: [0, 1, 1, 0, 1, 2, 1, 0, 1, 3, 2, 0],
    a3: 'C C Cl O H H H',
    xyz: [-0.83, -1.2, 0, -0.1, 0.11, 0, 1.63, -0.1, 0, -0.7, 1.19, 0, -0.58, -1.77, 0.9, -0.58, -1.77, -0.9, -1.91, -1.02, 0],
    b3: [0, 1, 1, 1, 2, 1, 1, 3, 2, 0, 4, 1, 0, 5, 1, 0, 6, 1],
  },
  benzylamine: {
    a: 'N C C C C C C C', h: '22011111', r: [[2, 7, 6, 5, 4, 3]],
    xy: [-2.06, 0.31, -1.19, 0.81, -0.32, 0.31, 0.54, 0.81, 1.41, 0.31, 1.41, -0.69, 0.54, -1.19, -0.32, -0.69],
    b: [0, 1, 1, 0, 1, 2, 1, 0, 2, 3, 2, 1, 3, 4, 1, 1, 4, 5, 2, 1, 5, 6, 1, 1, 6, 7, 2, 1, 7, 2, 1, 1],
    a3: 'N C C C C C C C H H H H H H H H H',
    xyz: [
      -2.83, 0.27, -0.62, -2.05, -0.32, 0.47, -0.57, -0.15, 0.24, 0.25, -1.27, 0.04, 1.63, -1.11, -0.17, 2.19, 0.17, -0.18, 1.38, 1.29, 0.01, 0.01, 1.13,
      0.21, -3.81, 0.02, -0.49, -2.53, -0.16, -1.5, -2.31, -1.38, 0.57, -2.32, 0.16, 1.42, -0.17, -2.27, 0.05, 2.26, -1.98, -0.32, 3.25, 0.29, -0.35, 1.81,
      2.28, -0.01, -0.62, 2.01, 0.35,
    ],
    b3: [
      0, 1, 1, 1, 2, 1, 2, 3, 2, 3, 4, 1, 4, 5, 2, 5, 6, 1, 6, 7, 2, 7, 2, 1, 0, 8, 1, 0, 9, 1, 1, 10, 1, 1, 11, 1, 3, 12, 1, 4, 13, 1, 5, 14, 1, 6, 15, 1,
      7, 16, 1,
    ],
  },
  benzylacetamide: {
    a: 'C C O N C C C C C C C', h: '30012011111', r: [[5, 10, 9, 8, 7, 6]],
    xy: [-2.91, -0.05, -2.05, -0.55, -2.05, -1.55, -1.18, -0.05, -0.31, -0.55, 0.55, -0.05, 1.42, -0.55, 2.28, -0.05, 2.28, 0.95, 1.42, 1.45, 0.55, 0.95],
    b: [0, 1, 1, 0, 1, 2, 2, 0, 1, 3, 1, 0, 3, 4, 1, 0, 4, 5, 1, 0, 5, 6, 2, 1, 6, 7, 1, 1, 7, 8, 2, 1, 8, 9, 1, 1, 9, 10, 2, 1, 10, 5, 1, 1],
    a3: 'C C O N C C C C C C C H H H H H H H H H H H',
    xyz: [
      -3.48, -0.13, -1.34, -2.61, -0.12, -0.11, -2.75, -0.96, 0.78, -1.67, 0.88, -0.1, -0.67, 0.96, 0.94, 0.65, 0.41, 0.45, 1.65, 1.27, -0.02, 2.86, 0.76,
      -0.49, 3.08, -0.62, -0.5, 2.08, -1.48, -0.04, 0.87, -0.97, 0.43, -4.53, -0.27, -1.05, -3.17, -0.94, -2, -3.41, 0.82, -1.89, -1.5, 1.39, -0.95, -0.57,
      2.01, 1.21, -0.99, 0.42, 1.84, 1.5, 2.35, -0.02, 3.63, 1.43, -0.85, 4.02, -1.02, -0.86, 2.25, -2.56, -0.05, 0.1, -1.65, 0.78,
    ],
    b3: [
      0, 1, 1, 1, 2, 2, 1, 3, 1, 3, 4, 1, 4, 5, 1, 5, 6, 2, 6, 7, 1, 7, 8, 2, 8, 9, 1, 9, 10, 2, 10, 5, 1, 0, 11, 1, 0, 12, 1, 0, 13, 1, 3, 14, 1, 4, 15,
      1, 4, 16, 1, 6, 17, 1, 7, 18, 1, 8, 19, 1, 9, 20, 1, 10, 21, 1,
    ],
  },
  bromobenzene: {
    a: 'Br C C C C C C', h: '0011111', r: [[1, 6, 5, 4, 3, 2]],
    xy: [-1.48, -0.86, -0.62, -0.36, 0.25, -0.86, 1.11, -0.36, 1.11, 0.64, 0.25, 1.14, -0.62, 0.64],
    b: [0, 1, 1, 0, 1, 2, 2, 1, 2, 3, 1, 1, 3, 4, 2, 1, 4, 5, 1, 1, 5, 6, 2, 1, 6, 1, 1, 1],
    a3: 'Br C C C C C C H H H H H',
    xyz: [
      -2.81, 0, 0, -0.92, 0, 0, -0.23, -1.21, 0, 1.17, -1.21, 0, 1.86, 0, 0, 1.17, 1.21, 0, -0.23, 1.21, 0, -0.77, -2.16, 0, 1.71, -2.15, 0, 2.95, 0, 0,
      1.71, 2.15, 0, -0.77, 2.16, 0,
    ],
    b3: [0, 1, 1, 1, 2, 2, 2, 3, 1, 3, 4, 2, 4, 5, 1, 5, 6, 2, 6, 1, 1, 2, 7, 1, 3, 8, 1, 4, 9, 1, 5, 10, 1, 6, 11, 1],
  },
  phenylboronic: {
    a: 'O B O C C C C C C', h: '101011111', r: [[3, 8, 7, 6, 5, 4]],
    xy: [-1.06, -1.61, -1.06, -0.61, -1.92, -0.11, -0.19, -0.11, -0.19, 0.89, 0.67, 1.39, 1.54, 0.89, 1.54, -0.11, 0.67, -0.61],
    b: [0, 1, 1, 0, 1, 2, 1, 0, 1, 3, 1, 0, 3, 4, 2, 1, 4, 5, 1, 1, 5, 6, 2, 1, 6, 7, 1, 1, 7, 8, 2, 1, 8, 3, 1, 1],
    a3: 'O B O C C C C C C H H H H H H H',
    xyz: [
      -2.44, -1.02, 0.79, -1.81, -0.16, -0.24, -2.53, 1.09, -0.49, -0.25, -0.05, -0.11, 0.52, -1.18, -0.33, 1.91, -1.13, -0.24, 2.5, 0.09, 0.09, 1.74,
      1.22, 0.31, 0.37, 1.15, 0.21, -1.93, -1.83, 0.97, -3.24, 1.02, -1.15, 0.11, -2.14, -0.59, 2.52, -2.02, -0.41, 3.57, 0.2, 0.19, 2.2, 2.15, 0.57,
      -0.28, 2.02, 0.38,
    ],
    b3: [0, 1, 1, 1, 2, 1, 1, 3, 1, 3, 4, 2, 4, 5, 1, 5, 6, 2, 6, 7, 1, 7, 8, 2, 8, 3, 1, 0, 9, 1, 2, 10, 1, 4, 11, 1, 5, 12, 1, 6, 13, 1, 7, 14, 1, 8, 15, 1],
  },
  biphenyl: {
    a: 'C C C C C C C C C C C C', h: '111011011111', r: [[0, 5, 4, 3, 2, 1], [7, 8, 9, 10, 11, 6]],
    xy: [-2.5, 0, -2, 0.87, -1, 0.87, -0.5, 0, -1, -0.87, -2, -0.87, 0.5, 0, 1, -0.87, 2, -0.87, 2.5, 0, 2, 0.87, 1, 0.87],
    b: [
      0, 1, 2, 1, 1, 2, 1, 1, 2, 3, 2, 1, 3, 4, 1, 1, 4, 5, 2, 1, 3, 6, 1, 0, 6, 7, 2, 1, 7, 8, 1, 1, 8, 9, 2, 1, 9, 10, 1, 1, 10, 11, 2, 1, 5, 0, 1, 1,
      11, 6, 1, 1,
    ],
    a3: 'C C C C C C C C C C C C H H H H H H H H H H',
    xyz: [
      -3.56, 0, 0, -2.86, -1.07, -0.55, -1.46, -1.07, -0.55, -0.74, 0, 0, -1.46, 1.07, 0.55, -2.86, 1.07, 0.55, 0.74, 0, 0, 1.46, -1.07, 0.55, 2.86, -1.07,
      0.55, 3.56, 0, 0, 2.86, 1.07, -0.55, 1.46, 1.07, -0.55, -4.64, 0, 0, -3.4, -1.91, -0.98, -0.93, -1.92, -0.99, -0.93, 1.92, 0.99, -3.4, 1.91, 0.98,
      0.93, -1.92, 0.99, 3.4, -1.91, 0.98, 4.64, 0, 0, 3.4, 1.91, -0.98, 0.93, 1.92, -0.99,
    ],
    b3: [
      0, 1, 2, 1, 2, 1, 2, 3, 2, 3, 4, 1, 4, 5, 2, 3, 6, 1, 6, 7, 2, 7, 8, 1, 8, 9, 2, 9, 10, 1, 10, 11, 2, 5, 0, 1, 11, 6, 1, 0, 12, 1, 1, 13, 1, 2, 14,
      1, 4, 15, 1, 5, 16, 1, 7, 17, 1, 8, 18, 1, 9, 19, 1, 10, 20, 1, 11, 21, 1,
    ],
  },
  butadiene: {
    a: 'C C C C', h: '2112', r: [],
    xy: [-1.3, 0.25, -0.43, -0.25, 0.43, 0.25, 1.3, -0.25],
    b: [0, 1, 2, 0, 1, 2, 1, 0, 2, 3, 2, 0],
    a3: 'C C C C H H H H H H',
    xyz: [
      -1.83, -0.13, 0, -0.6, 0.4, 0, 0.6, -0.4, 0, 1.83, 0.13, 0, -1.99, -1.2, 0, -2.7, 0.51, 0, -0.49, 1.48, 0, 0.49, -1.48, 0, 2.7, -0.51, 0, 1.99, 1.2,
      0,
    ],
    b3: [0, 1, 2, 1, 2, 1, 2, 3, 2, 0, 4, 1, 0, 5, 1, 1, 6, 1, 2, 7, 1, 3, 8, 1, 3, 9, 1],
  },
  cyclohexene: {
    a: 'C C C C C C', h: '112222', r: [[0, 5, 4, 3, 2, 1]],
    xy: [0.87, 0.5, 0, 1, -0.87, 0.5, -0.87, -0.5, 0, -1, 0.87, -0.5],
    b: [0, 1, 2, 0, 1, 2, 1, 0, 2, 3, 1, 0, 3, 4, 1, 0, 4, 5, 1, 0, 5, 0, 1, 0],
    a3: 'C C C C C C H H H H H H H H H H',
    xyz: [
      0.67, 1.25, 0.06, -0.67, 1.25, -0.06, -1.49, 0, -0.12, -0.7, -1.25, 0.3, 0.7, -1.25, -0.3, 1.49, 0, 0.12, 1.2, 2.2, 0.12, -1.2, 2.2, -0.12, -2.36,
      0.1, 0.54, -1.86, -0.13, -1.14, -0.63, -1.29, 1.4, -1.25, -2.15, -0.01, 0.63, -1.29, -1.4, 1.25, -2.15, 0.01, 1.86, -0.13, 1.14, 2.36, 0.1, -0.54,
    ],
    b3: [0, 1, 2, 1, 2, 1, 2, 3, 1, 3, 4, 1, 4, 5, 1, 5, 0, 1, 0, 6, 1, 1, 7, 1, 2, 8, 1, 2, 9, 1, 3, 10, 1, 3, 11, 1, 4, 12, 1, 4, 13, 1, 5, 14, 1, 5, 15, 1],
  },
  aminophenol: {
    a: 'N C C C C O C C', h: '20110111', r: [[1, 7, 6, 4, 3, 2]],
    xy: [-2, 0, -1, 0, -0.5, -0.87, 0.5, -0.87, 1, 0, 2, 0, 0.5, 0.87, -0.5, 0.87],
    b: [0, 1, 1, 0, 1, 2, 1, 1, 2, 3, 2, 1, 3, 4, 1, 1, 4, 5, 1, 0, 4, 6, 2, 1, 6, 7, 1, 1, 7, 1, 2, 1],
    a3: 'N C C C C O C C H H H H H H H',
    xyz: [
      -2.79, 0.02, -0.05, -1.4, 0.01, 0.06, -0.68, 1.2, 0, 0.72, 1.19, 0, 1.4, -0.02, 0, 2.76, 0.02, -0.01, 0.7, -1.22, 0, -0.7, -1.2, 0.01, -3.23, 0.86,
      0.3, -3.24, -0.82, 0.31, -1.2, 2.16, -0.03, 1.27, 2.13, -0.03, 3.09, -0.89, -0.03, 1.22, -2.17, -0.03, -1.24, -2.15, -0.03,
    ],
    b3: [0, 1, 1, 1, 2, 1, 2, 3, 2, 3, 4, 1, 4, 5, 1, 4, 6, 2, 6, 7, 1, 7, 1, 2, 0, 8, 1, 0, 9, 1, 2, 10, 1, 3, 11, 1, 5, 12, 1, 6, 13, 1, 7, 14, 1],
  },
  aceticanhydride: {
    a: 'C C O O C C O', h: '3000030', r: [],
    xy: [-1.73, 0.57, -0.87, 0.07, -0.87, -0.93, 0, 0.57, 0.87, 0.07, 1.73, 0.57, 0.87, -0.93],
    b: [0, 1, 1, 0, 1, 2, 2, 0, 1, 3, 1, 0, 3, 4, 1, 0, 4, 5, 1, 0, 4, 6, 2, 0],
    a3: 'C C O O C C O H H H H H H',
    xyz: [
      -2.31, 0.94, 0, -1.16, -0.03, 0, -1.32, -1.24, 0, 0, 0.67, 0, 1.16, -0.03, 0, 2.31, 0.94, 0, 1.32, -1.24, 0, -3.25, 0.38, 0, -2.27, 1.56, -0.9,
      -2.27, 1.56, 0.9, 2.27, 1.56, 0.9, 2.27, 1.56, -0.9, 3.25, 0.38, 0,
    ],
    b3: [0, 1, 1, 1, 2, 2, 1, 3, 1, 3, 4, 1, 4, 5, 1, 4, 6, 2, 0, 7, 1, 0, 8, 1, 0, 9, 1, 5, 10, 1, 5, 11, 1, 5, 12, 1],
  },
};
