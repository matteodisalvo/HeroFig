// Forme del modulo "Genomica e proteine": doppia elica, sequenze colorate, k-mer, reads
// allineate, modello di gene, cromosomi, tracce genomiche, MSA, proteine (cartoon, catena,
// mappa di contatti), grafici di genomica (Manhattan, volcano, heatmap, UMAP), alberi
// filogenetici, RNA, CRISPR-Cas9, cellule, trascrittomica spaziale, logo di sequenza e
// strumenti di laboratorio. Tutte procedurali e deterministiche (rng): identiche in SVG,
// PDF, PNG e TikZ. Le varianti si scelgono con `spec` (parole): i valori ammessi sono in
// `OPTIONS`, in fondo al file. Dove serve, la prima parola che non è un'opzione è la
// sequenza scritta dall'utente (es. "ATGCGT index").
import { arc, mix, poly, rng, shade, smooth, type ClipRect, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';

type P2 = [number, number];
type N = NodeModel;
type Rand = () => number;
type Anchor = 'start' | 'middle' | 'end';

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const AXIS = '#9AA0A6';
const TEXT = '#4B5563';
const INK = '#333333';

const words = (n: N) => n.spec.split(/\s+/).filter(Boolean);
const has = (n: N, w: string) => words(n).some((x) => x.toLowerCase() === w);
const kindOf = <T extends string>(n: N, kinds: readonly T[], fb: T): T => kinds.find((k) => has(n, k)) ?? fb;
/** Prima parola di `spec` che non è un'opzione: la sequenza scritta dall'utente. */
const seqOf = (n: N, flags: readonly string[], fb: string) => words(n).find((w) => !flags.includes(w.toLowerCase())) ?? fb;
const inkOf = (n: N, fb = '#444444') => (n.stroke === 'none' ? fb : n.stroke);
const fillOf = (n: N, fb: string) => (n.fill === 'none' ? fb : n.fill);
const tint = (c: string, t: number) => mix(c, '#FFFFFF', t);

const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];
const line = (cmds: Cmd[], stroke: string, sw: number, clip?: ClipRect): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true, ...(clip ? { clip } : {}) });
const area = (cmds: Cmd[], fill: string, stroke = 'none', sw = 0.8, clip?: ClipRect): Part => ({ kind: 'path', cmds, fill, stroke, sw, solid: true, ...(clip ? { clip } : {}) });
const disc = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 0.8): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true });
const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = 'none', sw = 0.8, r = 0, clip?: ClipRect): Part => ({
  kind: 'rect', x, y, w, h, r, fill, stroke, sw, solid: true, ...(clip ? { clip } : {}),
});
const text = (x: number, y: number, t: string, size: number, fill = TEXT, anchor: Anchor = 'middle', bold = false): Part => ({ kind: 'text', x, y, text: t, size, fill, anchor, bold });

function head(tip: P2, dx: number, dy: number, size: number, color: string): Part {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const bx = tip[0] - ux * size, by = tip[1] - uy * size;
  const hw = size * 0.45;
  return area(poly([tip, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]), color);
}

function arrow(a: P2, b: P2, color: string, sw: number, size: number): Part[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const cut = Math.min(size * 0.8, l * 0.5);
  const end: P2 = [b[0] - ((b[0] - a[0]) / l) * cut, b[1] - ((b[1] - a[1]) / l) * cut];
  return [line(seg(a, end), color, sw), head(b, b[0] - a[0], b[1] - a[1], size, color)];
}

/** Tratteggio lungo una polilinea (le primitive non hanno uno stile tratteggiato proprio). */
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
        if (!pen) out.push(['M', ax, ay]);
        pen = true;
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

function gauss(rand: Rand): number {
  const u = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand());
}

/** Punti di un contorno organico (ellisse ruotata con bordo irregolare). */
function blobPts(cx: number, cy: number, rx: number, ry: number, rot: number, wobble: number, rand: Rand, k = 12): P2[] {
  const c = Math.cos(rot), s = Math.sin(rot);
  return Array.from({ length: k }, (_, i): P2 => {
    const a = (TAU * i) / k;
    const r = 1 + (rand() * 2 - 1) * wobble;
    const ex = rx * r * Math.cos(a), ey = ry * r * Math.sin(a);
    return [cx + c * ex - s * ey, cy + s * ex + c * ey];
  });
}

function insidePoly(pts: P2[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ---------- colori ----------

/** Nucleotidi: tinta della cella e colore della lettera (convenzione dei genome browser). */
const NT: Record<string, { fill: string; ink: string }> = {
  A: { fill: '#D5EDCF', ink: '#2E8B3A' },
  C: { fill: '#D6E4F5', ink: '#2F6FB2' },
  G: { fill: '#FDE6C2', ink: '#C27400' },
  T: { fill: '#F9D3CF', ink: '#C0392B' },
  U: { fill: '#F9D3CF', ink: '#C0392B' },
  N: { fill: '#EEEEEE', ink: '#777777' },
};
/** Colori pieni per le basi (logo, mismatch, coppie di basi). */
const BASE: Record<string, string> = { A: '#2E9E44', C: '#2F6FB2', G: '#E8A317', T: '#D7263D', U: '#D7263D', N: '#888888' };
const COMP: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C', U: 'A', N: 'N' };

/** Amminoacidi per proprietà chimica (schema simile a Clustal). */
const AA_GROUPS: [string, { fill: string; ink: string }][] = [
  ['AILMFWV', { fill: '#D6E4F5', ink: '#2F6FB2' }],
  ['KR', { fill: '#F9D3CF', ink: '#C0392B' }],
  ['DE', { fill: '#EADCF2', ink: '#8E44AD' }],
  ['NQST', { fill: '#D5EDCF', ink: '#2E8B3A' }],
  ['HY', { fill: '#D0ECE7', ink: '#2D8A80' }],
  ['C', { fill: '#FBDDEA', ink: '#C2185B' }],
  ['G', { fill: '#FDE6C2', ink: '#C27400' }],
  ['P', { fill: '#FFF1B8', ink: '#9A7B00' }],
];
const AA_ALPHABET = 'ACDEFGHIKLMNPQRSTVWY';
const MASK = { fill: '#E3E5E8', ink: '#6B7280' };
const aaColor = (c: string) => AA_GROUPS.find(([g]) => g.includes(c))?.[1] ?? NT.N;
const isNucleic = (s: string) => /^[ACGTUN?\-.]+$/i.test(s);
const resColor = (c: string, nucleic: boolean) => (c === '?' ? MASK : nucleic ? NT[c] ?? NT.N : aaColor(c));

/** Colori categorici per cluster, cladi, tracce. */
const CAT = ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2', '#EECA3B', '#FF9DA6', '#9D755D', '#79706E', '#8CD17D', '#D37295'];

const RAMPS: Record<string, string[]> = {
  viridis: ['#440154', '#414487', '#2A788E', '#22A884', '#7AD151', '#FDE725'],
  blues: ['#F7FBFF', '#C6DBEF', '#6BAED6', '#2171B5', '#08306B'],
  oranges: ['#FFF5EB', '#FDD0A2', '#FD8D3C', '#D94801', '#7F2704'],
  purples: ['#FCFBFD', '#DADAEB', '#9E9AC8', '#6A51A3', '#3F007D'],
  greens: ['#F7FCF5', '#C7E9C0', '#74C476', '#238B45', '#00441B'],
  rdbu: ['#2166AC', '#67A9CF', '#D1E5F0', '#F7F7F7', '#FDDBC7', '#EF8A62', '#B2182B'],
  magma: ['#000004', '#3B0F70', '#8C2981', '#DE4968', '#FE9F6D', '#FCFDBF'],
};
function ramp(name: string, t: number): string {
  const s = RAMPS[name] ?? RAMPS.blues;
  const x = clamp(t, 0, 1) * (s.length - 1);
  const i = Math.min(s.length - 2, Math.floor(x));
  return mix(s[i], s[i + 1], x - i);
}
const RAINBOW = ['#3E64B5', '#3FA2C8', '#4FAF6A', '#DDBB3F', '#EE8B3A', '#D8504D'];
function rainbow(t: number): string {
  const x = clamp(t, 0, 1) * (RAINBOW.length - 1);
  const i = Math.min(RAINBOW.length - 2, Math.floor(x));
  return mix(RAINBOW[i], RAINBOW[i + 1], x - i);
}

/** Lettere con un colore ciascuna, centrate in (cx, cy). */
function coloredWord(word: string, cx: number, cy: number, size: number, colorOf: (c: string) => string, bold = true): Part[] {
  const cw = size * 0.7;
  const x0 = cx - (cw * (word.length - 1)) / 2;
  return [...word].map((c, i): Part => text(x0 + cw * i, cy, c, size, colorOf(c), 'middle', bold));
}

// ======================================================================
// DNA e sequenze
// ======================================================================

/** Doppia elica con solchi maggiore/minore, profondità (filamento dietro più chiaro) e coppie di basi. */
function helixShape(n: N): Part[] {
  const vertical = n.h > n.w * 1.15;
  const L = vertical ? n.h : n.w, H = vertical ? n.w : n.h;
  const at = (u: number, v: number): P2 => (vertical ? [n.x + v, n.y + u] : [n.x + u, n.y + v]);
  const turns = clamp(Math.round(n.count) || 2, 1, 16);
  const ends = has(n, 'ends'), open = has(n, 'open'), mono = has(n, 'mono');
  const tube = clamp(H * 0.07, 1.4, 4.2);
  const fs = clamp(H * 0.24, 7, 11);
  const pad = ends ? fs * 1.5 : tube;
  const u0 = pad, u1 = L - pad;
  const A = H / 2 - tube - 0.5;
  const OFF = Math.PI * 0.72;
  const t01 = (u: number) => (u - u0) / (u1 - u0);
  const bub = (u: number) => (open ? Math.exp(-(((t01(u) - 0.5) / 0.13) ** 4)) : 0);
  const ph = (u: number) => TAU * turns * t01(u);
  const vOf = (k: number, u: number) => {
    const hv = H / 2 - A * Math.sin(ph(u) + k * OFF);
    const sep = H / 2 + (k ? 1 : -1) * A;
    return hv + (sep - hv) * bub(u);
  };
  const zOf = (k: number, u: number) => (1 - bub(u)) * Math.cos(ph(u) + k * OFF) + bub(u);
  const c0 = inkOf(n, '#2F6FB2');
  const cols = [c0, mono ? c0 : shade(c0, 0.4)];
  const M = Math.max(60, turns * 48);
  const back: Part[] = [], front: Part[] = [];
  for (let k = 0; k < 2; k++) {
    let run: P2[] = [];
    let sign = zOf(k, u0) >= 0;
    const flush = () => {
      if (run.length < 2) return;
      const c = cols[k];
      const cmds = poly(run, false);
      if (sign) front.push(line(cmds, shade(c, -0.3), tube + 1.3), line(cmds, c, tube));
      else back.push(line(cmds, tint(c, 0.3), tube + 1.3), line(cmds, tint(c, 0.62), tube));
    };
    for (let i = 0; i <= M; i++) {
      const u = lerp(u0, u1, i / M);
      const p = at(u, vOf(k, u));
      const s = zOf(k, u) >= 0;
      if (s !== sign) {
        run.push(p);
        flush();
        run = [p];
        sign = s;
      } else run.push(p);
    }
    flush();
  }
  const rungs: Part[] = [];
  const rand = rng(41 + turns);
  const bp = turns * 10;
  const rw = Math.max(1, tube * 0.75);
  for (let j = 0; j < bp; j++) {
    const u = lerp(u0, u1, (j + 0.5) / bp);
    const b = 'ACGT'[Math.floor(rand() * 4)];
    const ca = mono ? '#9AA0A6' : BASE[b], cb = mono ? '#9AA0A6' : BASE[COMP[b]];
    const v0 = vOf(0, u), v1 = vOf(1, u);
    if (bub(u) > 0.2) {
      // filamenti separati: basi spaiate verso l'interno
      const st = H * 0.13 * bub(u);
      rungs.push(line(seg(at(u, v0), at(u, v0 + st)), ca, rw), line(seg(at(u, v1), at(u, v1 - st)), cb, rw));
      continue;
    }
    if (Math.abs(v0 - v1) < tube * 1.4) continue;
    const vm = (v0 + v1) / 2;
    rungs.push(line(seg(at(u, v0), at(u, vm)), ca, rw), line(seg(at(u, vm), at(u, v1)), cb, rw));
  }
  const parts = [...back, ...rungs, ...front];
  if (ends) {
    const e = pad * 0.5;
    parts.push(
      text(...at(u0 - e, vOf(0, u0)), "5'", fs, TEXT), text(...at(u1 + e, vOf(0, u1)), "3'", fs, TEXT),
      text(...at(u0 - e, vOf(1, u0)), "3'", fs, TEXT), text(...at(u1 + e, vOf(1, u1)), "5'", fs, TEXT),
    );
  }
  return parts;
}

const SEQ_FLAGS = ['plain', 'index', 'ends', 'codons'];

/** Sequenza in celle colorate: nucleotidi (A/C/G/T/U) o amminoacidi; '?' = mascherato, minuscola = evidenziata. */
function seqShape(n: N): Part[] {
  const seq = seqOf(n, SEQ_FLAGS, 'ATGCGTACGTTAGC');
  const chars = [...seq];
  const nucleic = isNucleic(seq);
  const plain = has(n, 'plain'), index = has(n, 'index'), ends = has(n, 'ends'), codons = has(n, 'codons') && nucleic;
  const fsE = clamp(n.h * 0.5, 7, 11);
  const endW = ends ? fsE * 1.7 : 0;
  const top = index ? clamp(n.h * 0.36, 7, 11) : 0;
  const x0 = n.x + endW, x1 = n.x + n.w - endW, y0 = n.y + top, H = n.h - top;
  const cw = (x1 - x0) / Math.max(1, chars.length);
  const gap = codons ? 0 : Math.min(2, cw * 0.1);
  const size = clamp(Math.min(cw * 0.8, H * 0.62), 4, 22);
  const parts: Part[] = [];
  chars.forEach((c, i) => {
    const cx = x0 + cw * (i + 0.5), cy = y0 + H / 2;
    if (c === '.') {
      parts.push(text(cx, cy, '$\\cdots$', size, TEXT));
      return;
    }
    const up = c.toUpperCase();
    const hi = c !== up;
    const col = c === '-' ? { fill: '#FFFFFF', ink: '#9AA0A6' } : resColor(up, nucleic);
    if (!plain) {
      const r = Math.min(3, cw * 0.18);
      parts.push(rect(x0 + cw * i + gap / 2, y0, cw - gap, H, hi ? shade(col.fill, -0.08) : col.fill, hi ? INK : shade(col.fill, -0.18), hi ? 1.6 : 0.7, r));
    }
    if (cw >= 4.5) parts.push(text(cx, cy, up, size, col.ink, 'middle', true));
    if (index && (i % 5 === 0 || chars.length <= 12)) parts.push(text(cx, n.y + top / 2, String(i + 1), Math.min(top * 0.85, 9), AXIS));
  });
  if (codons && !plain) {
    // triplette: bordo più marcato ogni tre basi
    for (let i = 0; i + 3 <= chars.length; i += 3) parts.push(rect(x0 + cw * i, y0, cw * 3, H, 'none', INK, 1.1, 2));
  }
  if (ends) {
    const [a, b] = nucleic ? ["5'", "3'"] : ['N', 'C'];
    parts.push(text(n.x + endW / 2, y0 + H / 2, a, fsE, TEXT), text(n.x + n.w - endW / 2, y0 + H / 2, b, fsE, TEXT));
  }
  return parts;
}

const KMER_FLAGS = ['tokens', 'cls', 'mask', 'stride'];

/** Tokenizzazione in k-mer: sequenza e finestre scorrevoli (a scala) oppure riga di token. */
function kmerShape(n: N): Part[] {
  const seq = seqOf(n, KMER_FLAGS, 'ATGGCTACG').toUpperCase().replace(/[^ACGTUN]/g, '') || 'ATGGCTACG';
  const k = clamp(Math.round(n.count) || 3, 1, 8);
  const stride = has(n, 'stride') ? k : 1;
  const kmers: string[] = [];
  for (let i = 0; i + k <= seq.length; i += stride) kmers.push(seq.slice(i, i + k));
  const ink = inkOf(n, '#D6B656');
  const fill = fillOf(n, '#FFF2CC');
  const ntInk = (c: string) => NT[c]?.ink ?? TEXT;
  const parts: Part[] = [];
  if (has(n, 'tokens')) {
    const toks = [...kmers];
    if (has(n, 'mask') && toks.length > k + 1) {
      const m0 = Math.floor((toks.length - k) / 2);
      for (let i = m0; i < m0 + k; i++) toks[i] = '[MASK]';
    }
    if (has(n, 'cls')) toks.unshift('[CLS]'), toks.push('[SEP]');
    const gap = clamp(n.w * 0.012, 1.5, 4);
    const tw = (n.w - gap * (toks.length - 1)) / toks.length;
    const longest = Math.max(k, 1);
    const size = clamp(Math.min(n.h * 0.46, (tw - 4) / (longest * 0.78)), 4, 14);
    toks.forEach((t, i) => {
      const x = n.x + i * (tw + gap), cx = x + tw / 2, cy = n.y + n.h / 2;
      const special = t.startsWith('[');
      const masked = t === '[MASK]';
      parts.push(rect(x, n.y, tw, n.h, masked ? '#D9DCE1' : special ? '#F1F2F4' : fill, masked ? '#8A9099' : special ? '#A9AFB7' : ink, 0.9, Math.min(4, n.h * 0.2)));
      if (special) parts.push(text(cx, cy, t.slice(1, -1), clamp(Math.min(tw / 3.6, n.h * 0.4), 4, 11), masked ? '#4B5563' : '#6B7280', 'middle', true));
      else parts.push(...coloredWord(t, cx, cy, size, ntInk));
    });
    return parts;
  }
  // sequenza in alto, finestre sotto (righe a scala: i k-mer adiacenti non si sovrappongono)
  const L = seq.length;
  const cw = n.w / L;
  const rows = stride === 1 ? Math.min(k, kmers.length) : 1;
  const sh = clamp(Math.min(n.h * 0.3, cw * 1.25), 6, 26);
  const gapY = clamp(n.h * 0.06, 2, 6);
  const rh = (n.h - sh - gapY) / Math.max(1, rows);
  const lsz = clamp(Math.min(cw * 0.8, sh * 0.66), 4, 16);
  [...seq].forEach((c, i) => {
    parts.push(rect(n.x + cw * i + 0.5, n.y, cw - 1, sh, NT[c]?.fill ?? NT.N.fill, shade(NT[c]?.fill ?? NT.N.fill, -0.18), 0.7, 2));
    parts.push(text(n.x + cw * (i + 0.5), n.y + sh / 2, c, lsz, ntInk(c), 'middle', true));
  });
  const tsz = clamp(Math.min(rh * 0.55, (cw * k - 6) / (k * 0.78)), 4, 13);
  const masked = has(n, 'mask') ? Math.floor(kmers.length / 2) : -1;
  kmers.forEach((km, i) => {
    const r = i % rows;
    const x = n.x + cw * i * stride + 1.5, w = cw * k - 3;
    const y = n.y + sh + gapY + r * rh + rh * 0.1, h = rh * 0.8;
    const isM = i === masked;
    parts.push(rect(x, y, w, h, isM ? '#D9DCE1' : fill, isM ? '#8A9099' : ink, 0.9, Math.min(4, h * 0.25)));
    if (isM) parts.push(text(x + w / 2, y + h / 2, 'MASK', tsz * 0.8, '#4B5563', 'middle', true));
    else parts.push(...coloredWord(km, x + w / 2, y + h / 2, tsz, ntInk));
  });
  return parts;
}

/** Reads di sequenziamento allineate a un riferimento (stile IGV): copertura, mismatch, variante. */
function readsShape(n: N): Part[] {
  const depth = clamp(Math.round(n.count) || 6, 1, 30);
  const ref = has(n, 'ref'), variant = has(n, 'variant'), cov = has(n, 'coverage'), paired = has(n, 'paired'), strand = has(n, 'strand');
  const rand = rng(53 + depth * 7);
  const { x, y, w, h } = n;
  const cols = clamp(Math.round(w / 6.5), 12, 140);
  const cw = w / cols;
  const refH = ref ? clamp(h * 0.12, 7, 13) : 0;
  const covH = cov ? clamp(h * 0.2, 8, 28) : 0;
  const top = y + (cov ? covH + 3 : 0), bot = y + h - (ref ? refH + 3 : 0);
  const rowH = (bot - top) / depth;
  const rh = Math.max(1.5, rowH * 0.7);
  const vc = Math.round(cols * 0.56);
  const refSeq = Array.from({ length: cols }, () => 'ACGT'[Math.floor(rand() * 4)]);
  const altOf = (b: string) => 'ACGT'.replace(b, '')[1];
  const alt = altOf(refSeq[vc]);
  type Read = { a: number; b: number; fwd: boolean; row: number; mm: [number, string][]; cutA: boolean; cutB: boolean; mate?: number };
  const reads: Read[] = [];
  const mk = (a: number, b: number, fwd: boolean, row: number): Read => {
    const r: Read = { a: Math.max(0, a), b: Math.min(cols, b), fwd, row, mm: [], cutA: a < 0, cutB: b > cols };
    if (variant && r.a <= vc && vc < r.b && rand() < 0.55) r.mm.push([vc, alt]);
    if (rand() < 0.22) {
      const c = Math.floor(lerp(r.a, r.b, rand()));
      if (c !== vc && c < cols) r.mm.push([c, altOf(refSeq[c])]);
    }
    return r;
  };
  for (let row = 0; row < depth; row++) {
    let c = -Math.floor(rand() * cols * 0.3);
    while (c < cols) {
      const len = Math.round(cols * (0.2 + 0.18 * rand()));
      if (paired) {
        const g = 2 + Math.floor(rand() * Math.max(2, cols * 0.08));
        const r1 = mk(c, c + len, true, row), r2 = mk(c + len + g, c + 2 * len + g, false, row);
        if (r1.b > r1.a) reads.push(r1);
        if (r2.b > r2.a) {
          if (r1.b > r1.a) r2.mate = reads.length - 1;
          reads.push(r2);
        }
        c += 2 * len + g + 2 + Math.floor(rand() * 3);
      } else {
        const r = mk(c, c + len, rand() < 0.5, row);
        if (r.b > r.a) reads.push(r);
        c += len + 1 + Math.floor(rand() * 3);
      }
    }
  }
  const parts: Part[] = [];
  const X = (c: number) => x + c * cw;
  if (cov) {
    const depthAt = Array.from({ length: cols }, (_, c) => reads.filter((r) => r.a <= c && c < r.b).length);
    const mx = Math.max(1, ...depthAt);
    const base = y + covH;
    const pts: P2[] = [[X(0), base]];
    depthAt.forEach((d, c) => pts.push([X(c), base - (d / mx) * covH], [X(c + 1), base - (d / mx) * covH]));
    pts.push([X(cols), base]);
    parts.push(area(poly(pts), '#C9CDD3'), line(seg([X(0), base], [X(cols), base]), AXIS, 0.6));
    if (variant) {
      const d = depthAt[vc], a = reads.filter((r) => r.mm.some(([c]) => c === vc)).length;
      const hT = (d / mx) * covH, hA = (a / mx) * covH;
      parts.push(rect(X(vc), base - hT, cw, hT - hA, BASE[refSeq[vc]]), rect(X(vc), base - hA, cw, hA, BASE[alt]));
    }
  }
  const fwdC = strand ? { fill: '#F4CFCB', stroke: '#C98A84' } : { fill: fillOf(n, '#E6E8EB'), stroke: inkOf(n, '#9AA0A6') };
  const revC = strand ? { fill: '#CFDDF2', stroke: '#7E9CC8' } : fwdC;
  const tip = Math.min(rh * 0.7, cw * 1.6);
  reads.forEach((r) => {
    const yy = top + r.row * rowH + (rowH - rh) / 2;
    const a = X(r.a), b = X(r.b), m = yy + rh / 2;
    const c = r.fwd ? fwdC : revC;
    if (r.mate !== undefined) {
      const o = reads[r.mate];
      parts.push(line(seg([X(o.b), m], [a, m]), c.stroke, 0.7));
    }
    const pts: P2[] =
      r.fwd && !r.cutB
        ? [[a, yy], [b - tip, yy], [b, m], [b - tip, yy + rh], [a, yy + rh]]
        : !r.fwd && !r.cutA
          ? [[a + tip, yy], [b, yy], [b, yy + rh], [a + tip, yy + rh], [a, m]]
          : [[a, yy], [b, yy], [b, yy + rh], [a, yy + rh]];
    parts.push(area(poly(pts), c.fill, c.stroke, 0.6));
    for (const [cc, bb] of r.mm) parts.push(rect(X(cc) + 0.3, yy + 0.3, cw - 0.6, rh - 0.6, BASE[bb]));
  });
  if (ref) {
    const ry = y + h - refH;
    refSeq.forEach((b, c) => {
      parts.push(rect(X(c), ry, cw, refH, NT[b].fill, 'none'));
      if (cw >= 6) parts.push(text(X(c) + cw / 2, ry + refH / 2, b, Math.min(cw * 0.95, refH * 0.75), NT[b].ink, 'middle', true));
    });
    parts.push(rect(x, ry, w, refH, 'none', AXIS, 0.6));
    if (variant) parts.push(rect(X(vc), ry, cw, refH, 'none', INK, 1.2));
  }
  if (variant) parts.push(rect(X(vc) - 0.5, top - 1, cw + 1, bot - top + 2, 'none', '#555555', 0.8));
  return parts;
}

/** Modello di gene: esoni (CDS spessa, UTR sottili), introni con verso di trascrizione, TSS, splicing. */
function geneShape(n: N): Part[] {
  const k = clamp(Math.round(n.count) || 4, 1, 14);
  const utr = has(n, 'utr'), tss = has(n, 'tss'), rev = has(n, 'reverse'), splice = has(n, 'splice'), labels = has(n, 'labels');
  const rand = rng(29 + k * 5);
  const { x, y, w, h } = n;
  const ink = inkOf(n, '#333333');
  const ef = fillOf(n, '#DAE8FC');
  const gH = splice ? h * 0.5 : h;
  const tssH = tss ? clamp(gH * 0.3, 6, 16) : 0;
  const cy = y + tssH + (gH - tssH) / 2;
  const eh = clamp((gH - tssH) * 0.62, 4, 30), uh = eh * 0.55;
  const x0 = x + 1, x1 = x + w - 1;
  const ew = Array.from({ length: k }, () => 0.5 + rand());
  const iw = Array.from({ length: k - 1 }, () => 0.8 + 1.2 * rand());
  const S = (x1 - x0) / (sum(ew) + sum(iw));
  const M = (v: number) => (rev ? x0 + x1 - v : v);
  const exons: [number, number][] = [];
  let c = x0;
  ew.forEach((e, i) => {
    exons.push([c, c + e * S]);
    c += e * S + (i < k - 1 ? iw[i] * S : 0);
  });
  const parts: Part[] = [];
  // introni con frecce nel verso della trascrizione
  const ch = Math.min(eh * 0.2, 3.5);
  for (let i = 0; i + 1 < k; i++) {
    const a = exons[i][1], b = exons[i + 1][0];
    parts.push(line(seg([M(a), cy], [M(b), cy]), ink, 1));
    const cmds: Cmd[] = [];
    const cnt = Math.floor((b - a) / 10);
    for (let j = 1; j <= cnt; j++) {
      const cxp = M(a + ((b - a) * j) / (cnt + 1)), d = rev ? -1 : 1;
      cmds.push(['M', cxp - d * ch * 0.6, cy - ch], ['L', cxp + d * ch * 0.6, cy], ['L', cxp - d * ch * 0.6, cy + ch]);
    }
    if (cmds.length) parts.push(line(cmds, ink, 0.8));
  }
  const piece = (a: number, b: number, hh: number, f: string, yy = cy) => {
    const l = Math.min(M(a), M(b)), r = Math.max(M(a), M(b));
    parts.push(rect(l, yy - hh / 2, r - l, hh, f, ink, 1, 1));
  };
  /** Parte UTR di ogni esone (frazioni a sinistra/destra, nel verso del gene). */
  const utrOf = (i: number): [number, number] => {
    if (!utr) return [0, 0];
    if (k === 1) return [0.25, 0.3];
    return [i === 0 ? 0.45 : 0, i === k - 1 ? 0.55 : 0];
  };
  const drawExons = (ex: [number, number][], yy: number, scale: number) => {
    ex.forEach(([a, b], i) => {
      const [ul, ur] = utrOf(i);
      const la = a + (b - a) * ul, rb = b - (b - a) * ur;
      if (ul > 0) piece(a, la, uh * scale, tint(ef, 0.45), yy);
      if (ur > 0) piece(rb, b, uh * scale, tint(ef, 0.45), yy);
      piece(la, rb, eh * scale, ef, yy);
    });
  };
  drawExons(exons, cy, 1);
  if (labels) {
    exons.forEach(([a, b], i) => {
      const [ul, ur] = utrOf(i);
      const la = a + (b - a) * ul, rb = b - (b - a) * ur;
      const fsz = Math.min(eh * 0.5, 9, (rb - la) * 0.42);
      if (fsz >= 6) parts.push(text(M((la + rb) / 2), cy, `E${i + 1}`, fsz, shade(ink, 0.1)));
    });
  }
  if (tss) {
    const sx = M(exons[0][0]), d = rev ? -1 : 1;
    const ty = y + 2, al = clamp(w * 0.06, 8, 16);
    parts.push(line([['M', sx, cy - eh / 2], ['L', sx, ty], ['L', sx + d * (al - 3), ty]], ink, 1.2), head([sx + d * al, ty], d, 0, 4.5, ink));
  }
  if (splice) {
    // trascritto maturo: esoni uniti, cappuccio al 5' e coda poli-A al 3'
    const tot = sum(exons.map(([a, b]) => b - a));
    const tail = clamp(w * 0.1, 14, 36);
    const mw = Math.min(tot, (x1 - x0) * 0.8 - tail);
    const sc = mw / tot;
    const my = y + h - (h - gH) * 0.45;
    let m0 = x + (w - mw - tail) / 2;
    const mex: [number, number][] = exons.map(([a, b]) => {
      const seg0: [number, number] = [m0, m0 + (b - a) * sc];
      m0 = seg0[1];
      return seg0;
    });
    exons.forEach(([a, b], i) => {
      const [ma, mb] = mex[i];
      const guide = (ax: number, bx: number) => line(dashes([[M(ax), cy + eh / 2 + 1], [M(bx), my - eh * 0.4 - 1]], 2.2, 2), AXIS, 0.7);
      parts.push(guide(a, ma), guide(b, mb));
    });
    mex.forEach(([a, b], i) => {
      const [ul, ur] = utrOf(i);
      const la = a + (b - a) * ul, rb = b - (b - a) * ur;
      const pc = (p: number, q: number, hh: number, f: string) => {
        const l = Math.min(M(p), M(q)), r = Math.max(M(p), M(q));
        parts.push(rect(l, my - hh / 2, r - l, hh, f, ink, 1, 1));
      };
      if (ul > 0) pc(a, la, uh * 0.8, tint(ef, 0.45));
      if (ur > 0) pc(rb, b, uh * 0.8, tint(ef, 0.45));
      pc(la, rb, eh * 0.8, ef);
    });
    const s5 = M(mex[0][0]), s3 = M(mex[k - 1][1]), d = rev ? -1 : 1;
    parts.push(disc(s5 - d * 3.5, my, 2.6, '#555555'));
    const fsz = clamp(eh * 0.45, 6, 10);
    parts.push(text(s3 + d * 3, my, 'AAAA', fsz, TEXT, rev ? 'end' : 'start'));
  }
  return parts;
}

// ---------- cromosomi ----------

const CHR_LEN = [248, 242, 198, 190, 181, 171, 159, 145, 138, 134, 135, 133, 114, 107, 102, 90, 83, 80, 59, 64, 47, 51, 156, 57];
const CHR_CEN = [123, 93, 91, 50, 48, 60, 60, 45, 43, 40, 53, 35, 17, 17, 19, 36, 25, 18, 26, 28, 12, 15, 60, 10];
const CHR_NAME = (i: number) => (i < 22 ? String(i + 1) : i === 22 ? 'X' : 'Y');
const BANDS = ['#FFFFFF', '#D9D9D9', '#A6A6A6', '#7A7A7A', '#4D4D4D'];
const ACEN = '#D98C8C';

/** Ideogramma a bande G: due bracci arrotondati che si toccano al centromero. */
function ideogram(ax: number, ay: number, len: number, thick: number, cen: number, vertical: boolean, rand: Rand, ink: string): { parts: Part[]; box: (u0: number, u1: number) => { x: number; y: number; w: number; h: number } } {
  const R = (u0: number, u1: number) => (vertical ? { x: ax, y: ay + u0, w: thick, h: u1 - u0 } : { x: ax + u0, y: ay, w: u1 - u0, h: thick });
  const rp = Math.min(thick / 2, cen / 2), rq = Math.min(thick / 2, (len - cen) / 2);
  const clipP: ClipRect = { ...R(0, cen), r: rp };
  const clipQ: ClipRect = { ...R(cen, len), r: rq };
  const parts: Part[] = [];
  const band = (u0: number, u1: number, f: string) => {
    if (u0 < cen) {
      const b = R(u0, Math.min(u1, cen));
      parts.push(rect(b.x, b.y, b.w, b.h, f, 'none', 0, 0, clipP));
    }
    if (u1 > cen) {
      const b = R(Math.max(u0, cen), u1);
      parts.push(rect(b.x, b.y, b.w, b.h, f, 'none', 0, 0, clipQ));
    }
  };
  let u = 0, dark = rand() < 0.5;
  while (u < len) {
    const u2 = Math.min(len, u + len * (0.025 + 0.05 * rand()));
    band(u, u2, dark ? BANDS[1 + Math.floor(rand() * 4)] : BANDS[0]);
    dark = !dark;
    u = u2;
  }
  const a = Math.min(thick * 0.55, cen), b = Math.min(thick * 0.55, len - cen);
  band(cen - a, cen + b, ACEN);
  const p = R(0, cen), q = R(cen, len);
  parts.push(rect(p.x, p.y, p.w, p.h, 'none', ink, 0.9, rp), rect(q.x, q.y, q.w, q.h, 'none', ink, 0.9, rq));
  return { parts, box: R };
}

function chromShape(n: N): Part[] {
  const k = clamp(Math.round(n.count) || 1, 1, 24);
  const labels = has(n, 'labels'), locus = has(n, 'locus');
  const ink = inkOf(n, '#555555');
  const rand = rng(97 + k);
  const parts: Part[] = [];
  const mark = (b: { x: number; y: number; w: number; h: number }) => parts.push(rect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3, 'none', '#E5484D', 1.6, 1));
  if (k === 1) {
    const vertical = n.h > n.w;
    const L = vertical ? n.h : n.w, T0 = vertical ? n.w : n.h;
    const lab = labels ? clamp(T0 * 0.3, 8, 12) : 0;
    const thick = clamp((T0 - lab) * 0.75, 5, 40);
    const off = (T0 - lab - thick) / 2;
    const ax = vertical ? n.x + off : n.x + 1, ay = vertical ? n.y + 1 : n.y + off;
    const cen = (L - 2) * 0.4;
    const ch = ideogram(ax, ay, L - 2, thick, cen, vertical, rand, ink);
    parts.push(...ch.parts);
    if (locus) mark(ch.box((L - 2) * 0.7, (L - 2) * 0.74));
    if (labels) {
      const fs = Math.min(lab * 0.9, 11);
      const tp = (u: number): P2 => (vertical ? [ax + thick + 3 + fs * 0.3, ay + u] : [ax + u, ay + thick + 2 + fs * 0.55]);
      parts.push(text(...tp(cen / 2), 'p', fs, TEXT, vertical ? 'start' : 'middle'), text(...tp(cen + (L - 2 - cen) / 2), 'q', fs, TEXT, vertical ? 'start' : 'middle'));
    }
    return parts;
  }
  // cariotipo: cromosomi verticali allineati al centromero
  const colW = n.w / k;
  const lab = labels ? clamp(colW * 0.7, 7, 11) : 0;
  const thick = clamp(colW * 0.48, 3, 16);
  const ids = Array.from({ length: k }, (_, i) => i);
  const maxP = Math.max(...ids.map((i) => CHR_CEN[i])), maxQ = Math.max(...ids.map((i) => CHR_LEN[i] - CHR_CEN[i]));
  const sc = (n.h - lab - 3) / (maxP + maxQ);
  ids.forEach((i) => {
    const ax = n.x + colW * i + (colW - thick) / 2;
    const ay = n.y + (maxP - CHR_CEN[i]) * sc;
    const ch = ideogram(ax, ay, CHR_LEN[i] * sc, thick, CHR_CEN[i] * sc, true, rng(300 + i * 17), ink);
    parts.push(...ch.parts);
    if (locus && i === Math.min(6, k - 1)) mark(ch.box(CHR_LEN[i] * sc * 0.72, CHR_LEN[i] * sc * 0.78));
    if (labels) parts.push(text(ax + thick / 2, n.y + n.h - lab / 2, CHR_NAME(i), lab * 0.95, TEXT));
  });
  return parts;
}

// ---------- tracce del genome browser ----------

const TRACK_COLS = ['#2F6FB2', '#1F9E74', '#E8913A', '#7E57C2', '#C0392B', '#2D8A80', '#C9A000', '#6B7280'];
const TRACK_NAMES = ['DNase', 'H3K27ac', 'CTCF', 'CAGE', 'ATAC', 'H3K4me3', 'RNA-seq', 'H3K27me3', 'POLR2A', 'phyloP', 'H3K36me3', 'EP300'];

function tracksShape(n: N): Part[] {
  const T = clamp(Math.round(n.count) || 4, 1, 12);
  const names = has(n, 'names'), gene = has(n, 'gene'), hl = has(n, 'highlight'), ruler = has(n, 'ruler'), mono = has(n, 'mono');
  const rand = rng(211 + T);
  const { x, y, w, h } = n;
  const fs = clamp(Math.min(h / T, 18) * 0.45, 6, 10);
  const nameW = names ? Math.min(w * 0.3, fs * 4.4) : 0;
  const rulerH = ruler ? fs * 1.6 : 0;
  const geneH = gene ? clamp(h * 0.13, 8, 16) : 0;
  const tx0 = x + nameW, tw = w - nameW;
  const tH = (h - rulerH - geneH - (gene ? 3 : 0)) / T;
  const peaks = Array.from({ length: 10 }, () => ({ p: 0.04 + 0.92 * rand(), s: 0.004 + 0.012 * rand() }));
  peaks[0].p = 0.52;
  peaks[0].s = 0.008;
  const M = clamp(Math.round(tw / 1.1), 40, 500);
  const parts: Part[] = [];
  for (let t = 0; t < T; t++) {
    const broad = t % 3 === 1;
    const amp = peaks.map((_, i) => (i === 0 ? 0.6 + 0.4 * rand() : rand() < 0.55 ? 0.15 + 0.85 * rand() : 0));
    let noise = 0;
    const vals = Array.from({ length: M + 1 }, (_, i) => {
      const u = i / M;
      noise = 0.6 * noise + 0.4 * rand();
      return 0.04 + 0.08 * noise + sum(peaks.map((pk, j) => amp[j] * Math.exp(-(((u - pk.p) / (pk.s * (broad ? 2.6 : 1))) ** 2))));
    });
    const mx = Math.max(...vals);
    const base = y + rulerH + (t + 1) * tH - 1;
    const col = mono ? inkOf(n, '#2F6FB2') : TRACK_COLS[t % TRACK_COLS.length];
    const pts: P2[] = [[tx0, base], ...vals.map((v, i): P2 => [tx0 + (tw * i) / M, base - (v / mx) * (tH * 0.84)]), [tx0 + tw, base]];
    parts.push(area(poly(pts), col), line(seg([tx0, base], [tx0 + tw, base]), shade(col, -0.1), 0.6));
    if (names) parts.push(text(tx0 - 4, base - tH * 0.35, TRACK_NAMES[t % TRACK_NAMES.length], fs, TEXT, 'end'));
  }
  if (gene) {
    const gy = y + h - geneH / 2;
    const g0 = tx0 + tw * 0.38, g1 = tx0 + tw * 0.86;
    parts.push(line(seg([g0, gy], [g1, gy]), '#555555', 0.9));
    const ex = [0.38, 0.47, 0.6, 0.71, 0.82].map((u) => tx0 + tw * u);
    ex.forEach((e, i) => parts.push(rect(e, gy - geneH * 0.32, tw * (i === 0 ? 0.03 : 0.025), geneH * 0.64, '#555555', 'none')));
    const cmds: Cmd[] = [];
    for (let u = 0.42; u < 0.84; u += 0.045) cmds.push(['M', tx0 + tw * u - 1.5, gy - 2], ['L', tx0 + tw * u + 1, gy], ['L', tx0 + tw * u - 1.5, gy + 2]);
    parts.push(line(cmds, '#555555', 0.7));
    if (names) parts.push(text(tx0 - 4, gy, 'Genes', fs, TEXT, 'end'));
  }
  if (hl) {
    const cx = tx0 + tw * 0.52, hw = Math.max(4, tw * 0.025);
    parts.push(rect(cx - hw, y + rulerH, hw * 2, tH * T + 1, 'none', INK, 1.1));
  }
  if (ruler) {
    const r1 = tx0 + tw - 2, r0 = r1 - tw * 0.22, ry = y + rulerH * 0.62;
    parts.push(line([...seg([r0, ry], [r1, ry]), ...seg([r0, ry - 3], [r0, ry + 3]), ...seg([r1, ry - 3], [r1, ry + 3])], '#555555', 0.9));
    parts.push(text(r0 - 3, ry, '20 kb', fs, TEXT, 'end'));
  }
  return parts;
}

/** Logo di sequenza: lettere impilate, altezza = contenuto informativo (bit). */
const LOGO_FLAGS = ['axis'];
function glyph(c: string, x: number, y: number, w: number, h: number): Cmd[] {
  const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const ring = (a0: number, a1: number, ro: number, ri: number): Cmd[] => {
    const K = 28;
    const pts: P2[] = [];
    for (let i = 0; i <= K; i++) {
      const a = lerp(a0, a1, i / K);
      pts.push(P(0.5 + ro * Math.cos(a), 0.5 + ro * Math.sin(a)));
    }
    for (let i = K; i >= 0; i--) {
      const a = lerp(a0, a1, i / K);
      pts.push(P(0.5 + ri * Math.cos(a), 0.5 + ri * 1.02 * Math.sin(a)));
    }
    return poly(pts);
  };
  switch (c) {
    case 'A':
      return [
        ...poly([P(0, 1), P(0.39, 0), P(0.61, 0), P(1, 1), P(0.77, 1), P(0.68, 0.74), P(0.32, 0.74), P(0.23, 1)]),
        ...poly([P(0.38, 0.56), P(0.62, 0.56), P(0.5, 0.24)]),
      ];
    case 'T':
      return poly([P(0, 0), P(1, 0), P(1, 0.2), P(0.61, 0.2), P(0.61, 1), P(0.39, 1), P(0.39, 0.2), P(0, 0.2)]);
    case 'C':
      return ring(0.24 * Math.PI, 1.76 * Math.PI, 0.5, 0.29);
    case 'G':
      return [...ring(0.06 * Math.PI, 1.76 * Math.PI, 0.5, 0.29), ...poly([P(0.54, 0.48), P(1, 0.48), P(1, 0.66), P(0.54, 0.66)])];
    default:
      return poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)]);
  }
}

function logoShape(n: N): Part[] {
  const cons = seqOf(n, LOGO_FLAGS, '').toUpperCase().replace(/[^ACGT]/g, '');
  const L = cons.length || clamp(Math.round(n.count) || 8, 2, 24);
  const axis = has(n, 'axis');
  const rand = rng(17 + L * 11);
  const fs = clamp(n.h * 0.13, 6, 9);
  const ax = axis ? fs * 3.6 : 0;
  const x0 = n.x + ax, cw = (n.w - ax) / L;
  const base = n.y + n.h - 1, H = n.h - 2;
  const parts: Part[] = [];
  if (axis) {
    parts.push(line([['M', x0 - 2, n.y + 1], ['L', x0 - 2, base]], AXIS, 0.8));
    parts.push(line([...seg([x0 - 5, n.y + 1], [x0 - 2, n.y + 1]), ...seg([x0 - 5, base], [x0 - 2, base])], AXIS, 0.8));
    parts.push(text(x0 - 6, n.y + 1 + fs * 0.4, '2', fs, TEXT, 'end'), text(x0 - 6, base - fs * 0.4, '0', fs, TEXT, 'end'), text(n.x, n.y + n.h / 2, 'bits', fs, TEXT, 'start'));
  }
  for (let i = 0; i < L; i++) {
    const top = cons[i] ?? 'ACGT'[Math.floor(rand() * 4)];
    const p = 0.5 + 0.48 * rand() ** 0.6;
    const rest = 'ACGT'.replace(top, '').split('');
    const r = rest.map(() => rand());
    const rs = sum(r);
    const freq: [string, number][] = [[top, p], ...rest.map((c, j): [string, number] => [c, ((1 - p) * r[j]) / rs])];
    const ic = 2 + sum(freq.map(([, f]) => (f > 0 ? f * Math.log2(f) : 0)));
    freq.sort((a, b) => a[1] - b[1]);
    let yb = base;
    for (const [c, f] of freq) {
      const lh = (f * ic * H) / 2;
      if (lh < 1.5) {
        yb -= lh;
        continue;
      }
      parts.push(area(glyph(c, x0 + cw * i + cw * 0.05, yb - lh, cw * 0.9, lh), BASE[c]));
      yb -= lh;
    }
  }
  return parts;
}

// ======================================================================
// Proteine
// ======================================================================

/** Allineamento multiplo di sequenze: colonne conservate, gap, colori per proprietà o "heat". */
function msaShape(n: N): Part[] {
  const rows = clamp(Math.round(n.count) || 6, 1, 32);
  const scheme = kindOf(n, ['clustal', 'nucleotide', 'heat', 'mono'] as const, 'clustal');
  const letters = has(n, 'letters'), consv = has(n, 'conservation'), gaps = has(n, 'gaps');
  const rand = rng(61 + rows * 3);
  const consH = consv ? clamp(n.h * 0.2, 6, 24) : 0;
  const y0 = n.y + consH + (consv ? 2 : 0);
  const gh = n.y + n.h - y0;
  const chh = gh / rows;
  const cols = clamp(Math.round(n.w / clamp(chh, 5, 14)), 4, 80);
  const cw = n.w / cols;
  const alpha = scheme === 'nucleotide' ? 'ACGT' : AA_ALPHABET;
  const pick = () => alpha[Math.floor(rand() * alpha.length)];
  const base = Array.from({ length: cols }, pick);
  const cons = Array.from({ length: cols }, () => (rand() < 0.35 ? 1 : 0.35 + 0.5 * rand()));
  const grid = Array.from({ length: rows }, (_, r) => {
    const row = base.map((b, j) => (r === 0 || rand() < cons[j] ? b : pick()));
    if (gaps && r > 0 && rand() < 0.5) {
      const g0 = Math.floor(rand() * cols * 0.85), gl = 1 + Math.floor(rand() * 3);
      for (let j = g0; j < Math.min(cols, g0 + gl); j++) row[j] = '-';
    }
    return row;
  });
  const ink = inkOf(n, '#D79B00');
  const fill = fillOf(n, '#FFE6CC');
  const g = Math.min(0.8, cw * 0.08);
  const parts: Part[] = [];
  grid.forEach((row, r) =>
    row.forEach((c, j) => {
      const col = scheme === 'nucleotide' ? NT[c] ?? NT.N : aaColor(c);
      const f =
        c === '-' ? '#FFFFFF'
          : scheme === 'heat' ? mix(tint(fill, 0.4), ink, 0.05 + 0.6 * rand())
            : scheme === 'mono' ? (cons[j] === 1 ? fill : '#FFFFFF')
              : col.fill;
      const cx = n.x + j * cw, cy = y0 + r * chh;
      parts.push(rect(cx + g / 2, cy + g / 2, cw - g, chh - g, f));
      if (letters && cw >= 5.5 && chh >= 5.5) {
        const li = c === '-' ? AXIS : scheme === 'heat' || scheme === 'mono' ? INK : col.ink;
        parts.push(text(cx + cw / 2, cy + chh / 2, c, Math.min(cw, chh) * 0.72, li, 'middle', true));
      }
    }),
  );
  if (consv) {
    base.forEach((b, j) => {
      const fr = grid.filter((row) => row[j] === b).length / rows;
      const bh = consH * fr;
      parts.push(rect(n.x + j * cw + g / 2, n.y + consH - bh, cw - g, bh, scheme === 'heat' || scheme === 'mono' ? tint(ink, 0.3) : '#8A9AB8'));
    });
  }
  parts.push(rect(n.x, y0, n.w, gh, 'none', scheme === 'heat' ? ink : '#B8BEC6', 0.7));
  return parts;
}

// ---------- cartoon della proteina ----------

type SSE = { t: 'H' | 'E' | 'L'; pts: P2[] };
/** Ripiegamenti d'esempio in coordinate unitarie: eliche, foglietto β antiparallelo, anse. */
const FOLDS: SSE[][] = [
  [
    { t: 'L', pts: [[0.04, 0.94], [0.08, 0.84]] },
    { t: 'H', pts: [[0.13, 0.74], [0.37, 0.17]] },
    { t: 'L', pts: [[0.44, 0.04], [0.53, 0.08]] },
    { t: 'E', pts: [[0.56, 0.15], [0.58, 0.66]] },
    { t: 'L', pts: [[0.62, 0.79], [0.69, 0.76]] },
    { t: 'E', pts: [[0.715, 0.67], [0.705, 0.16]] },
    { t: 'L', pts: [[0.74, 0.05], [0.82, 0.08]] },
    { t: 'E', pts: [[0.86, 0.15], [0.88, 0.66]] },
    { t: 'L', pts: [[0.93, 0.8], [0.86, 0.9]] },
    { t: 'H', pts: [[0.78, 0.9], [0.3, 0.88]] },
    { t: 'L', pts: [[0.2, 0.9], [0.14, 0.97]] },
  ],
  [
    { t: 'L', pts: [[0.03, 0.04], [0.1, 0.06]] },
    { t: 'H', pts: [[0.14, 0.16], [0.25, 0.8]] },
    { t: 'L', pts: [[0.3, 0.95], [0.41, 0.92]] },
    { t: 'H', pts: [[0.45, 0.8], [0.5, 0.16]] },
    { t: 'L', pts: [[0.55, 0.03], [0.66, 0.06]] },
    { t: 'H', pts: [[0.7, 0.18], [0.8, 0.76]] },
    { t: 'L', pts: [[0.86, 0.9], [0.95, 0.96]] },
  ],
];
const PLDDT = { vhigh: '#0053D6', high: '#65CBF3', low: '#FFDB13', vlow: '#FF7D45' };

interface Ribbon {
  t: 'H' | 'E' | 'L';
  a: P2;
  b: P2;
  pts: P2[];
  f0: number;
  f1: number;
  idx: number;
}

/** Elica α come nastro: mezzi giri davanti (colore pieno) e dietro (più scuro). */
function helixRibbon(a: P2, b: P2, R: number, colAt: (t: number) => string): { back: Part[]; front: Part[]; trace: P2[] } {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const d: P2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const nm: P2 = [-d[1], d[0]];
  const turns = Math.max(1.5, Math.round((len / (1.55 * R)) * 2) / 2);
  const hw = Math.min(R * 0.42, len / turns / 4);
  const th = (t: number) => -Math.PI / 2 + TAU * turns * t;
  const C = (t: number): P2 => [a[0] + d[0] * len * t + nm[0] * R * Math.sin(th(t)), a[1] + d[1] * len * t + nm[1] * R * Math.sin(th(t))];
  const back: Part[] = [], front: Part[] = [];
  const halves = Math.round(turns * 2);
  for (let j = 0; j < halves; j++) {
    const t0 = j / halves, t1 = (j + 1) / halves;
    const top: P2[] = [], bot: P2[] = [];
    for (let i = 0; i <= 14; i++) {
      const c = C(lerp(t0, t1, i / 14));
      top.push([c[0] + d[0] * hw, c[1] + d[1] * hw]);
      bot.push([c[0] - d[0] * hw, c[1] - d[1] * hw]);
    }
    const col = colAt((t0 + t1) / 2);
    const isFront = j % 2 === 0;
    const f = isFront ? col : shade(col, -0.28);
    (isFront ? front : back).push(area(poly([...top, ...bot.reverse()]), f, shade(col, -0.45), 0.7));
  }
  const cnt = Math.max(2, Math.round(turns * 3.6));
  const trace = Array.from({ length: cnt }, (_, i) => C(i / (cnt - 1)));
  return { back, front, trace };
}

function strandArrow(a: P2, b: P2, ws: number, col: string, ink: string): Part {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const d: P2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const nm: P2 = [-d[1], d[0]];
  const hl = Math.min(ws * 1.25, len * 0.45), bw = ws / 2, hwid = ws * 0.95;
  const q = (p: P2, s: number, o: number): P2 => [p[0] + d[0] * s + nm[0] * o, p[1] + d[1] * s + nm[1] * o];
  return area(poly([q(a, 0, bw), q(b, -hl, bw), q(b, -hl, hwid), b, q(b, -hl, -hwid), q(b, -hl, -bw), q(a, 0, -bw)]), col, ink, 0.8);
}

function tube(pts: P2[], col: string, lt: number): Part[] {
  const cmds = smooth(pts, false);
  return [line(cmds, shade(col, -0.4), lt + 1.3), line(cmds, col, lt)];
}

function ribbonShape(n: N): Part[] {
  const mode = kindOf(n, ['fold', 'linear', 'helix', 'sheet', 'cloud', 'noisy', 'partial'] as const, 'fold');
  const scheme = kindOf(n, ['rainbow', 'ss', 'plddt', 'mono'] as const, mode === 'linear' || mode === 'helix' || mode === 'sheet' ? 'ss' : 'rainbow');
  const m = Math.min(n.w, n.h);
  const pal = (t: 'H' | 'E' | 'L', f: number, idx: number, last: number): string => {
    switch (scheme) {
      case 'rainbow':
        return rainbow(f);
      case 'ss':
        return t === 'H' ? '#D9665F' : t === 'E' ? '#E3B23C' : '#8E959E';
      case 'plddt':
        if (t === 'L') return idx === 0 || idx === last ? PLDDT.vlow : idx % 4 === 2 ? PLDDT.low : PLDDT.high;
        return idx === last - 1 ? PLDDT.high : PLDDT.vhigh;
      default:
        return t === 'L' ? inkOf(n, '#6C8EBF') : fillOf(n, '#DAE8FC');
    }
  };
  const inkFor = (col: string) => (scheme === 'mono' ? inkOf(n, '#6C8EBF') : shade(col, -0.45));
  const parts: Part[] = [];
  if (mode === 'sheet') {
    const k = clamp(Math.round(n.count) || 4, 2, 10);
    const ws = clamp((n.w / k) * 0.42, 3, 22);
    const pad = ws, top = n.y + ws * 0.9, bot = n.y + n.h - ws * 0.9;
    const xs = Array.from({ length: k }, (_, i) => n.x + pad + ((n.w - 2 * pad) * i) / Math.max(1, k - 1));
    const lt = clamp(m * 0.025, 1.1, 3);
    const loopCol = pal('L', 0.5, 1, k + 2);
    for (let i = 0; i + 1 < k; i++) {
      const yy = i % 2 ? top : bot, s = i % 2 ? -1 : 1;
      const xm = (xs[i] + xs[i + 1]) / 2;
      parts.push(...tube([[xs[i], yy], [xm, yy + s * ws * 0.8], [xs[i + 1], yy]], loopCol, lt));
      // legami idrogeno fra filamenti adiacenti
      for (let j = 1; j <= 3; j++) {
        const hy = lerp(top + ws, bot - ws, j / 4);
        parts.push(line(dashes([[xs[i] + ws * 0.55, hy], [xs[i + 1] - ws * 0.55, hy]], 1.6, 1.6), AXIS, 0.8));
      }
    }
    xs.forEach((x, i) => {
      const col = pal('E', i / Math.max(1, k - 1), 1, k + 2);
      parts.push(i % 2 ? strandArrow([x, top], [x, bot], ws, col, inkFor(col)) : strandArrow([x, bot], [x, top], ws, col, inkFor(col)));
    });
    return parts;
  }
  // elementi in coordinate del blocco
  let els: SSE[];
  let R: number;
  if (mode === 'linear' || mode === 'helix') {
    const k = mode === 'helix' ? 1 : clamp(Math.round(n.count) || 3, 1, 7);
    const types: ('H' | 'E')[] = Array.from({ length: k }, (_, i) => (i % 2 ? 'E' : 'H'));
    const wgt = types.map((t) => (t === 'H' ? 1.6 : 1.1));
    const lw = mode === 'helix' ? 0.12 : 0.4;
    const tot = sum(wgt) + lw * (k + 1);
    els = [];
    let u = 0;
    const amp = 0.12;
    types.forEach((t, i) => {
      const ue = u + lw / tot;
      els.push({ t: 'L', pts: [[u, 0.5], [(u + ue) / 2, i % 2 ? 0.5 + amp : 0.5 - amp]] });
      const end = ue + wgt[i] / tot;
      els.push({ t, pts: [[ue, 0.5], [end, 0.5]] });
      u = end;
    });
    els.push({ t: 'L', pts: [[(u + 1) / 2, 0.5 + amp], [1, 0.5]] });
    R = clamp(n.h * 0.3, 2.5, 30);
  } else {
    els = FOLDS[(Math.max(1, Math.round(n.count) || 1) - 1) % FOLDS.length];
    R = clamp(m * 0.082, 2.5, 18);
  }
  const ws = mode === 'linear' || mode === 'helix' ? R * 1.2 : clamp(m * 0.075, 3, 16);
  const lt = clamp(m * 0.022, 1.1, 3.2);
  const pad = Math.max(R, ws) + 2;
  const P = (p: P2): P2 => [n.x + pad + p[0] * (n.w - 2 * pad), n.y + pad + p[1] * (n.h - 2 * pad)];
  // anse: congiungono la fine dell'elemento precedente all'inizio del successivo
  const rib: Ribbon[] = [];
  const last = els.length - 1;
  els.forEach((e, i) => {
    const f0 = i / (last + 1), f1 = (i + 1) / (last + 1);
    if (e.t === 'L') rib.push({ t: 'L', a: P(e.pts[0]), b: P(e.pts[e.pts.length - 1]), pts: e.pts.map(P), f0, f1, idx: i });
    else rib.push({ t: e.t, a: P(e.pts[0]), b: P(e.pts[1]), pts: [], f0, f1, idx: i });
  });
  const helices = new Map<number, ReturnType<typeof helixRibbon>>();
  rib.forEach((r, i) => {
    if (r.t === 'H') helices.set(i, helixRibbon(r.a, r.b, R, (t) => pal('H', lerp(r.f0, r.f1, t), r.idx, last)));
  });
  const startOf = (i: number): P2 => {
    const h = helices.get(i);
    return h ? h.trace[0] : rib[i].a;
  };
  const endOf = (i: number): P2 => {
    const h = helices.get(i);
    return h ? h.trace[h.trace.length - 1] : rib[i].b;
  };
  const loops: { pts: P2[]; col: string }[] = [];
  rib.forEach((r, i) => {
    if (r.t !== 'L') return;
    const pts = [...(i > 0 ? [endOf(i - 1)] : []), ...r.pts, ...(i < rib.length - 1 ? [startOf(i + 1)] : [])];
    loops.push({ pts, col: pal('L', (r.f0 + r.f1) / 2, r.idx, last) });
  });
  if (mode === 'cloud' || mode === 'noisy' || mode === 'partial') {
    // traccia della catena (residui) e posizioni rumorose, come in un processo di diffusione
    const trace: P2[] = [];
    rib.forEach((r, i) => {
      const h = helices.get(i);
      if (h) trace.push(...h.trace);
      else if (r.t === 'E') {
        const k = Math.max(2, Math.round(Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) / (ws * 0.8)));
        for (let j = 0; j <= k; j++) trace.push([lerp(r.a[0], r.b[0], j / k), lerp(r.a[1], r.b[1], j / k)]);
      } else {
        const lp = loops.find((l) => l.pts.includes(r.pts[0]))?.pts ?? r.pts;
        for (let j = 1; j < lp.length - 1; j++) trace.push(lp[j]);
      }
    });
    const rand = rng(7 + (Math.round(n.count) || 1));
    const noise = mode === 'cloud' ? 1 : mode === 'noisy' ? 0.45 : 0.18;
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const rr = clamp(m * 0.032, 1.4, 4.5);
    trace.forEach((p, i) => {
      const q: P2 = [cx + gauss(rand) * n.w * 0.17, cy + gauss(rand) * n.h * 0.17];
      const x = clamp(lerp(p[0], q[0], noise), n.x + rr, n.x + n.w - rr), y = clamp(lerp(p[1], q[1], noise), n.y + rr, n.y + n.h - rr);
      const col = scheme === 'mono' ? fillOf(n, '#DAE8FC') : rainbow(i / Math.max(1, trace.length - 1));
      parts.push(disc(x, y, rr, tint(col, 0.15), scheme === 'mono' ? inkOf(n, '#6C8EBF') : shade(col, -0.35), 0.5));
    });
    return parts;
  }
  for (const l of loops) parts.push(...tube(l.pts, l.col, lt));
  rib.forEach((r) => {
    if (r.t !== 'E') return;
    const col = pal('E', (r.f0 + r.f1) / 2, r.idx, last);
    parts.push(strandArrow(r.a, r.b, ws, col, inkFor(col)));
  });
  for (const h of helices.values()) parts.push(...h.back, ...h.front);
  return parts;
}

const CHAIN_FLAGS = ['wave', 'plain', 'ends'];

/** Catena di amminoacidi: perle colorate per proprietà, con la lettera del residuo. */
function chainShape(n: N): Part[] {
  const seq = seqOf(n, CHAIN_FLAGS, 'MKTAYIAKQR').toUpperCase().replace(/[^A-Z?]/g, '') || 'MKTAYIAKQR';
  const wave = has(n, 'wave'), plain = has(n, 'plain'), ends = has(n, 'ends');
  const L = seq.length;
  const fsE = clamp(n.h * 0.4, 7, 11);
  const ew = ends ? fsE * 1.3 : 0;
  const x0 = n.x + ew, x1 = n.x + n.w - ew;
  const R = Math.min(wave ? n.h * 0.3 : n.h * 0.45, ((x1 - x0) / Math.max(1, L)) * 0.4);
  const cy = n.y + n.h / 2;
  const amp = wave ? n.h / 2 - R - 1 : 0;
  const pts = [...seq].map((_, i): P2 => [x0 + R + ((x1 - x0 - 2 * R) * i) / Math.max(1, L - 1), cy + (i % 2 ? amp : -amp) * 0.85]);
  const parts: Part[] = [line(poly(pts, false), '#7A808A', clamp(R * 0.25, 1, 2.4))];
  [...seq].forEach((c, i) => {
    const col = c === '?' ? MASK : aaColor(c);
    parts.push(disc(pts[i][0], pts[i][1], R, col.fill, col.ink, 1));
    if (!plain && R >= 3.5) parts.push(text(pts[i][0], pts[i][1], c, R * 1.05, col.ink, 'middle', true));
  });
  if (ends) parts.push(text(n.x + ew / 2, pts[0][1], 'N', fsE, TEXT), text(n.x + n.w - ew / 2, pts[L - 1][1], 'C', fsE, TEXT));
  return parts;
}

/** Residui (x, y, z) del ripiegamento `idx` in coordinate unitarie: eliche (3,6 residui per giro), filamenti e anse. */
function foldResidues(idx: number): [number, number, number][] {
  const els = FOLDS[idx % FOLDS.length];
  const R = 0.08;
  const along = (pts: P2[], step: number, skipEnds: boolean): [number, number, number][] => {
    const out: [number, number, number][] = [];
    let carry = skipEnds ? step : 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const L = Math.hypot(bx - ax, by - ay);
      for (let d = carry; d <= L; d += step) out.push([ax + ((bx - ax) * d) / L, ay + ((by - ay) * d) / L, 0]);
      carry = step - ((L - carry) % step);
    }
    return skipEnds && out.length ? out.slice(0, -1) : out;
  };
  const segs = els.map((e): [number, number, number][] => {
    if (e.t === 'E') return along(e.pts, 0.032, false);
    if (e.t !== 'H') return [];
    const [a, b] = e.pts;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d: P2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    const turns = Math.max(1.5, Math.round((len / (1.55 * R)) * 2) / 2);
    const k = Math.round(turns * 3.6);
    return Array.from({ length: k }, (_, i): [number, number, number] => {
      const t = i / (k - 1), th = -Math.PI / 2 + TAU * turns * t;
      return [a[0] + d[0] * len * t - d[1] * R * Math.sin(th), a[1] + d[1] * len * t + d[0] * R * Math.sin(th), R * Math.cos(th)];
    });
  });
  const res: [number, number, number][] = [];
  els.forEach((e, i) => {
    if (e.t !== 'L') {
      res.push(...segs[i]);
      return;
    }
    const prev = segs[i - 1]?.[segs[i - 1].length - 1], next = segs[i + 1]?.[0];
    const pts: P2[] = [...(prev ? [[prev[0], prev[1]] as P2] : []), ...e.pts, ...(next ? [[next[0], next[1]] as P2] : [])];
    res.push(...along(pts, 0.036, !!prev));
  });
  return res;
}

/** Mappa di contatti / distanze fra residui, calcolata dalla geometria del cartoon (stesso ripiegamento). */
function contactShape(n: N): Part[] {
  const L = clamp(Math.round(n.count) || 32, 8, 80);
  const mode = kindOf(n, ['distance', 'contact'] as const, 'distance');
  const cmap = kindOf(n, ['blues', 'viridis', 'oranges', 'purples', 'greens'] as const, mode === 'distance' ? 'viridis' : 'blues');
  const split = has(n, 'split');
  const all = foldResidues(0);
  // ricampiona a L residui lungo la catena
  const res = Array.from({ length: L }, (_, i) => {
    const f = (i * (all.length - 1)) / (L - 1), k = Math.min(all.length - 2, Math.floor(f)), t = f - k;
    return all[k].map((v, j) => lerp(v, all[k + 1][j], t));
  });
  const dist = (i: number, j: number) => Math.hypot(res[i][0] - res[j][0], res[i][1] - res[j][1], res[i][2] - res[j][2]);
  const side = Math.min(n.w, n.h);
  const x0 = n.x + (n.w - side) / 2, y0 = n.y + (n.h - side) / 2;
  const cs = side / L;
  const parts: Part[] = [rect(x0, y0, side, side, '#FFFFFF')];
  const rand = rng(5 + L);
  for (let i = 0; i < L; i++) {
    for (let j = 0; j < L; j++) {
      const d = dist(i, j);
      const lower = split && i > j;
      if (mode === 'contact') {
        let on = d < 0.21 || Math.abs(i - j) < 2;
        // la mappa predetta (sopra la diagonale) ha qualche errore
        if (split && !lower && Math.abs(i - j) > 3 && rand() < 0.04) on = !on && d < 0.32;
        if (on) parts.push(rect(x0 + j * cs, y0 + i * cs, cs + 0.1, cs + 0.1, lower ? '#8A9099' : ramp(cmap, 0.65 + 0.35 * clamp(1 - d / 0.21, 0, 1))));
      } else {
        const v = clamp(1 - d / 0.75, 0, 1) ** 1.4 + 0.03 * (rand() - 0.5);
        parts.push(rect(x0 + j * cs, y0 + i * cs, cs + 0.15, cs + 0.15, lower ? ramp('greens', 0.05 + 0.9 * v) : ramp(cmap, cmap === 'viridis' ? v : 0.04 + 0.92 * v)));
      }
    }
  }
  if (split) parts.push(line(seg([x0, y0], [x0 + side, y0 + side]), '#FFFFFF', 1));
  parts.push(rect(x0, y0, side, side, 'none', n.stroke === 'none' ? AXIS : n.stroke, 0.8));
  return parts;
}

// ======================================================================
// Grafici di genomica
// ======================================================================

interface Frame {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  fs: number;
  parts: Part[];
}

/** Assi a L; con `labels` i nomi degli assi (y in cima all'asse, x al centro sotto). */
function frame(n: N, xName: string, yName: string, extraBottom = 0): Frame {
  const labels = has(n, 'labels');
  const fs = clamp(Math.min(n.w, n.h) * 0.08, 6.5, 9.5);
  const x0 = n.x + (labels ? fs * 1.7 : 2), x1 = n.x + n.w - 2;
  const y0 = n.y + (labels ? fs * 1.6 : 2), y1 = n.y + n.h - (labels ? fs * 1.8 : 2) - extraBottom;
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push(rect(n.x, n.y, n.w, n.h, n.fill, n.stroke, n.strokeWidth, Math.min(n.radius, 6)));
  parts.push(line([['M', x0, y0 - 2], ['L', x0, y1], ['L', x1, y1]], AXIS, 0.9));
  if (labels) parts.push(text(x0 - fs * 0.4, n.y + fs * 0.75, yName, fs, TEXT, 'start'), text((x0 + x1) / 2, n.y + n.h - fs * 0.75, xName, fs, TEXT));
  return { x0, x1, y0, y1, fs, parts };
}

function manhattanShape(n: N): Part[] {
  const loci = clamp(Math.round(n.count) || 3, 1, 12);
  const labels = has(n, 'labels');
  const rand = rng(401 + loci * 7);
  const tickH = labels ? clamp(Math.min(n.w, n.h) * 0.08, 6.5, 9.5) * 1.1 : 0;
  const F = frame(n, 'Chromosome', '$-\\log_{10} p$', tickH);
  const { x0, x1, y0, y1 } = F;
  const parts = F.parts;
  const ink = inkOf(n, '#3B6FB6');
  const ymax = 12;
  const Y = (v: number) => y1 - (y1 - y0) * clamp(v / ymax, 0, 1);
  const tot = sum(CHR_LEN.slice(0, 22));
  const hits = Array.from({ length: loci + 3 }, (_, i) => ({ c: Math.floor(rand() * 22), u: 0.2 + 0.6 * rand(), h: i < loci ? 8 + 3.6 * rand() : 4 + 2 * rand() }));
  const total = clamp(Math.round((x1 - x0) * 3), 150, 1000);
  const r = clamp(Math.min(n.w, n.h) * 0.012, 0.9, 1.9);
  const HIT = '#D7263D';
  const thr = 7.3;
  let cx = x0 + 2;
  let lastLab = -1e9;
  const W = x1 - x0 - 4;
  for (let c = 0; c < 22; c++) {
    const cw = (W * CHR_LEN[c]) / tot;
    const col = c % 2 ? tint(ink, 0.5) : ink;
    const pts: [number, number][] = [];
    const m = Math.round((total * CHR_LEN[c]) / tot);
    for (let i = 0; i < m; i++) pts.push([rand(), -Math.log10(Math.max(1e-6, rand())) * 1.05]);
    for (const h of hits.filter((q) => q.c === c)) {
      for (let i = 0; i < (h.h > 7 ? 26 : 12); i++) {
        const u = clamp(h.u + gauss(rand) * 0.035, 0, 1);
        pts.push([u, h.h * Math.exp(-(((u - h.u) / 0.04) ** 2)) * (0.3 + 0.7 * rand())]);
      }
    }
    for (const [u, v] of pts) parts.push(disc(cx + u * cw, Y(v), r, v > thr ? HIT : col));
    if (labels) {
      const lx = cx + cw / 2, tw = String(c + 1).length * F.fs * 0.55;
      if (lx - tw / 2 > lastLab + 2) {
        parts.push(text(lx, y1 + F.fs * 0.75, String(c + 1), F.fs * 0.85, TEXT));
        lastLab = lx + tw / 2;
      }
    }
    cx += cw;
  }
  if (has(n, 'threshold')) parts.push(line(dashes([[x0, Y(thr)], [x1, Y(thr)]], 3, 2), HIT, 0.8));
  return parts;
}

const GENES_UP = ['MYC', 'IL6', 'CXCL8', 'VEGFA'];
const GENES_DOWN = ['CDKN1A', 'SOX2', 'PTEN', 'KLF4'];

function volcanoShape(n: N): Part[] {
  const F = frame(n, '$\\log_2$ fold change', '$-\\log_{10} p$');
  const { x0, x1, y0, y1 } = F;
  const parts = F.parts;
  const rand = rng(77);
  const M = clamp(Math.round((n.w * n.h) / 35), 120, 700);
  const pts: P2[] = [];
  for (let i = 0; i < M; i++) {
    const tail = rand() < 0.2 ? Math.sign(rand() - 0.45) * (0.8 + 2.4 * rand()) : 0;
    const fc = gauss(rand) * 0.75 + tail;
    const p = Math.abs(fc) ** 1.5 * (0.7 + 2.3 * rand()) + -Math.log10(Math.max(1e-4, rand())) * 0.7;
    pts.push([fc, p]);
  }
  const ymax = Math.max(...pts.map((p) => p[1])) * 1.05;
  const X = (v: number) => lerp(x0 + 3, x1 - 2, (clamp(v, -4.5, 4.5) + 4.5) / 9);
  const Y = (v: number) => y1 - (y1 - y0 - 2) * (v / ymax);
  const r = clamp(Math.min(n.w, n.h) * 0.014, 1, 2.1);
  const up = '#D9534F', down = '#3B6FB6', ns = '#BFC4CB';
  const sig = (q: P2) => Math.abs(q[0]) > 1 && q[1] > 2;
  if (has(n, 'thresholds')) {
    for (const v of [-1, 1]) parts.push(line(dashes([[X(v), y0], [X(v), y1]], 2.5, 2), AXIS, 0.7));
    parts.push(line(dashes([[x0, Y(2)], [x1, Y(2)]], 2.5, 2), AXIS, 0.7));
  }
  for (const q of pts) parts.push(disc(X(q[0]), Y(q[1]), r, !sig(q) ? ns : q[0] > 0 ? up : down));
  if (has(n, 'genes')) {
    const fs = clamp(Math.min(n.w, n.h) * 0.07, 6, 8.5);
    // i due punti più significativi per lato, abbastanza distanti da non sovrapporre i nomi
    const pick = (cand: P2[]) => cand.sort((a, b) => b[1] - a[1]).reduce<P2[]>((acc, q) => (acc.length < 2 && acc.every((o) => Math.abs(Y(o[1]) - Y(q[1])) > fs * 1.5) ? [...acc, q] : acc), []);
    const topUp = pick(pts.filter((q) => q[0] > 1.2)), topDn = pick(pts.filter((q) => q[0] < -1.2));
    topUp.forEach((q, i) => parts.push(text(X(q[0]) - r - 1.5, Y(q[1]), GENES_UP[i], fs, '#8E2B28', 'end')));
    topDn.forEach((q, i) => parts.push(text(X(q[0]) + r + 1.5, Y(q[1]), GENES_DOWN[i], fs, '#24497F', 'start')));
  }
  return parts;
}

interface Den {
  lo: number;
  hi: number;
  h: number;
  pos: number;
  kids: Den[];
}

/** Dendrogramma coerente con i blocchi: foglie unite prima dentro ogni cluster, poi i cluster. */
function dendro(groups: number[], rand: Rand): Den {
  const leaf = (i: number): Den => ({ lo: i, hi: i + 1, h: 0, pos: i + 0.5, kids: [] });
  const join = (a: Den, b: Den, h: number): Den => ({ lo: a.lo, hi: b.hi, h, pos: (a.pos + b.pos) / 2, kids: [a, b] });
  const build = (items: Den[], hLo: number, hHi: number): Den => {
    if (items.length === 1) return items[0];
    const m = Math.ceil(items.length / 2);
    const a = build(items.slice(0, m), hLo, hHi), b = build(items.slice(m), hLo, hHi);
    return join(a, b, Math.max(a.h, b.h) + lerp(hLo, hHi, rand()));
  };
  const clusters: Den[] = [];
  let i = 0;
  for (const g of groups) {
    clusters.push(build(Array.from({ length: g }, (_, k) => leaf(i + k)), 0.05, 0.15));
    i += g;
  }
  return build(clusters, 0.3, 0.6);
}

function denParts(t: Den, map: (pos: number, h: number) => P2, col: string, sw: number): Part[] {
  const cmds: Cmd[] = [];
  const walk = (d: Den) => {
    if (!d.kids.length) return;
    const [a, b] = d.kids;
    cmds.push(['M', ...map(a.pos, a.h)], ['L', ...map(a.pos, d.h)], ['L', ...map(b.pos, d.h)], ['L', ...map(b.pos, b.h)]);
    walk(a);
    walk(b);
  };
  walk(t);
  return [line(cmds, col, sw)];
}

function splitGroups(total: number, k: number, rand: Rand): number[] {
  const kk = Math.max(1, Math.min(k, total));
  const w = Array.from({ length: kk }, () => 0.6 + rand());
  const s = sum(w);
  const g = w.map((v) => Math.max(1, Math.round((v / s) * total)));
  g[g.length - 1] += total - sum(g);
  while (g[g.length - 1] < 1) {
    const j = g.findIndex((v) => v > 1);
    g[j]--;
    g[g.length - 1]++;
  }
  return g;
}

/** Heatmap di espressione (geni × campioni) con dendrogrammi e barra dei gruppi. */
function exprHeatShape(n: N): Part[] {
  const m = /(\d+)\s*[x×]\s*(\d+)/.exec(n.spec);
  const rows = clamp(m ? +m[1] : 16, 2, 60), cols = clamp(m ? +m[2] : 10, 2, 60);
  const k = clamp(Math.round(n.count) || 3, 1, 6);
  const rowtree = has(n, 'rowtree'), coltree = has(n, 'coltree'), annot = has(n, 'annot');
  const cmap = kindOf(n, ['rdbu', 'viridis', 'magma'] as const, 'rdbu');
  const rand = rng(131 + rows * 7 + cols);
  const tw = rowtree ? n.w * 0.16 : 0, th = coltree ? n.h * 0.16 : 0, ah = annot ? clamp(n.h * 0.05, 3, 7) : 0;
  const x0 = n.x + tw + (rowtree ? 1 : 0), y0 = n.y + th + (coltree ? 1 : 0) + (annot ? ah + 1.5 : 0);
  const gw = n.x + n.w - x0, gh = n.y + n.h - y0;
  const cw = gw / cols, rh = gh / rows;
  const rg = splitGroups(rows, k, rand), cg = splitGroups(cols, Math.min(k, 4), rand);
  const pat = rg.map(() => cg.map(() => (rand() < 0.5 ? -1 : 1) * (0.35 + 0.6 * rand())));
  const rIdx = rg.flatMap((g, i) => Array<number>(g).fill(i)), cIdx = cg.flatMap((g, i) => Array<number>(g).fill(i));
  const parts: Part[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = clamp(pat[rIdx[i]][cIdx[j]] + gauss(rand) * 0.28, -1, 1);
      parts.push(rect(x0 + j * cw, y0 + i * rh, cw + 0.15, rh + 0.15, ramp(cmap, (v + 1) / 2)));
    }
  }
  parts.push(rect(x0, y0, gw, gh, 'none', '#B8BEC6', 0.6));
  const ink = '#555555';
  if (rowtree) {
    const t = dendro(rg, rand);
    parts.push(...denParts(t, (p, h) => [x0 - 1 - (h / t.h) * (tw - 2), y0 + p * rh], ink, 0.8));
  }
  if (coltree) {
    const t = dendro(cg, rand);
    parts.push(...denParts(t, (p, h) => [x0 + p * cw, n.y + th - (h / t.h) * (th - 2)], ink, 0.8));
  }
  if (annot) {
    let j = 0;
    cg.forEach((g, i) => {
      parts.push(rect(x0 + j * cw, y0 - ah - 1.5, g * cw, ah, CAT[i % CAT.length]));
      j += g;
    });
  }
  return parts;
}

/** UMAP di cellule singole: cluster a forma irregolare, colori categorici o espressione di un gene. */
function umapShape(n: N): Part[] {
  const k = clamp(Math.round(n.count) || 6, 1, 12);
  const mode = kindOf(n, ['clusters', 'gray', 'expr', 'batch'] as const, 'clusters');
  const labels = has(n, 'labels'), axes = has(n, 'axes');
  const rand = rng(71 + k * 13);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push(rect(n.x, n.y, n.w, n.h, n.fill, n.stroke, n.strokeWidth, Math.min(n.radius, 6)));
  const pad = 4;
  const ax = n.x + pad, ay = n.y + pad, aw = n.w - 2 * pad, ah = n.h - 2 * pad;
  const centers: P2[] = [];
  const corner = (u: number, v: number) => axes && u < 0.34 && v > 0.62;
  for (let tries = 0; centers.length < k && tries < 3000; tries++) {
    const c: P2 = [0.16 + 0.68 * rand(), 0.14 + 0.66 * rand()];
    const gap = 0.62 / Math.sqrt(k + 1);
    if (!corner(c[0] - 0.08, c[1] + 0.08) && centers.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) > gap)) centers.push(c);
  }
  while (centers.length < k) centers.push([0.2 + 0.6 * rand(), 0.2 + 0.6 * rand()]);
  const total = clamp(Math.round((n.w * n.h) / 22), 150, 1100);
  const sizes = centers.map(() => 0.5 + rand());
  const ss = sum(sizes);
  const r = clamp(Math.min(n.w, n.h) * 0.016, 1, 2.2);
  const hot = Math.floor(rand() * k);
  const spread = 0.42 / Math.sqrt(k + 1);
  const pts: { x: number; y: number; c: number; v: number }[] = [];
  centers.forEach((c, i) => {
    const cnt = Math.round((total * sizes[i]) / ss);
    const sx = spread * (0.55 + 0.5 * rand()) * Math.sqrt(sizes[i]), sy = sx * (0.45 + 0.6 * rand());
    const rot = rand() * Math.PI, bend = (rand() - 0.5) * 2.2;
    for (let j = 0; j < cnt; j++) {
      const a = gauss(rand) * sx * 0.55, b = gauss(rand) * sy * 0.55 + bend * a * a * 3;
      const u = c[0] + a * Math.cos(rot) - b * Math.sin(rot), v = c[1] + a * Math.sin(rot) + b * Math.cos(rot);
      const dx = Math.hypot(u - centers[hot][0], v - centers[hot][1]);
      if (corner(u, v)) continue;
      pts.push({ x: clamp(u, 0.02, 0.98), y: clamp(v, 0.02, 0.98), c: i, v: clamp(Math.exp(-dx * 6) + 0.15 * rand(), 0, 1) });
    }
  });
  // ordine sparso: i cluster vicini si mescolano come nei grafici veri
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  if (mode === 'expr') pts.sort((a, b) => a.v - b.v);
  for (const p of pts) {
    const col = mode === 'gray' ? '#B8BEC6' : mode === 'expr' ? mix('#E3E3E8', '#4B1F86', p.v ** 1.4) : mode === 'batch' ? CAT[(p.c + Math.floor(p.x * 7 + p.y * 3)) % 3] : CAT[p.c % CAT.length];
    parts.push(disc(ax + p.x * aw, ay + p.y * ah, r, col));
  }
  if (labels && mode === 'clusters') {
    const fs = clamp(Math.min(n.w, n.h) * 0.08, 6.5, 11);
    centers.forEach((_, i) => {
      const mine = pts.filter((p) => p.c === i);
      const mx = sum(mine.map((p) => p.x)) / Math.max(1, mine.length), my = sum(mine.map((p) => p.y)) / Math.max(1, mine.length);
      parts.push(text(ax + mx * aw, ay + my * ah, String(i), fs, '#1A1A1A', 'middle', true));
    });
  }
  if (axes) {
    const fs = clamp(Math.min(n.w, n.h) * 0.06, 5.5, 8);
    const ox = n.x + 3, oy = n.y + n.h - 3, L = Math.min(n.w, n.h) * 0.18;
    parts.push(...arrow([ox, oy], [ox + L, oy], '#555555', 0.9, 3.5), ...arrow([ox, oy], [ox, oy - L], '#555555', 0.9, 3.5));
    parts.push(text(ox + L + 2, oy, 'UMAP1', fs, TEXT, 'start'), text(ox + 2, oy - L - fs * 0.6, 'UMAP2', fs, TEXT, 'start'));
  }
  return parts;
}

// ---------- alberi filogenetici ----------

const TAXA = ['Human', 'Chimpanzee', 'Gorilla', 'Macaque', 'Mouse', 'Rat', 'Dog', 'Cow', 'Chicken', 'Zebrafish', 'Fruit fly', 'Yeast'];

interface Tn {
  leaf: number;
  kids: Tn[];
  h: number;
  y: number;
  clade: number;
}

function phyloShape(n: N): Part[] {
  const L = clamp(Math.round(n.count) || 6, 2, 32);
  const layout = kindOf(n, ['rect', 'slanted', 'radial'] as const, 'rect');
  const names = has(n, 'names'), scale = has(n, 'scale'), support = has(n, 'support');
  const rand = rng(91 + L * 5);
  // con i nomi delle specie la topologia segue la filogenesi nota (primati, roditori, ...)
  const species = names && L <= TAXA.length;
  const build = (lo: number, hi: number): Tn => {
    if (hi - lo === 1) return { leaf: lo, kids: [], h: 0, y: lo, clade: 0 };
    let m = lo + 1;
    if (hi - lo > 2 && species) m = hi === 6 && lo < 4 ? 4 : hi === 8 && lo < 6 ? 6 : hi - 1;
    else if (hi - lo > 2) {
      m = hi - Math.min(rand() < 0.55 ? 1 : 2, hi - lo - 1);
      if (hi - lo >= 6 && rand() < 0.35) m = lo + Math.floor((hi - lo) / 2);
    }
    const a = build(lo, m), b = build(m, hi);
    return { leaf: -1, kids: [a, b], h: Math.max(a.h, b.h) + 0.35 + 0.8 * rand(), y: (a.y + b.y) / 2, clade: 0 };
  };
  const root = build(0, L);
  const setClade = (t: Tn, c: number) => {
    t.clade = c;
    t.kids.forEach((k) => setClade(k, c));
  };
  let ci = 0;
  for (const k of root.kids) {
    if (k.kids.length && k.kids.every((g) => g.kids.length)) k.kids.forEach((g) => setClade(g, ci++));
    else setClade(k, ci++);
  }
  // primati, roditori, altri mammiferi, altri vertebrati, invertebrati, lieviti
  const SPECIES_CLADE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 5];
  const cladeOf = (i: number) => (species ? SPECIES_CLADE[i] : findLeaf(root, i)?.clade ?? 0);
  const ink = inkOf(n, '#555555');
  const sw = Math.max(0.9, n.strokeWidth * 0.9);
  const fs = clamp(Math.min((n.h / L) * 0.8, n.h * 0.12), 5.5, 10) * (layout === 'radial' ? 0.85 : 1);
  const nameOf = (i: number) => (L <= TAXA.length ? TAXA[i] : `Taxon ${i + 1}`);
  const nameW = names ? Math.max(...Array.from({ length: L }, (_, i) => nameOf(i).length)) * fs * 0.55 + 4 : 0;
  const parts: Part[] = [];
  const cmds: Cmd[] = [];
  const tipR = clamp(fs * 0.3, 1.5, 3);
  if (layout === 'radial') {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const Rm = Math.max(10, Math.min(n.w / 2 - nameW - tipR - 2, n.h / 2 - (names ? fs * 1.3 : 0) - tipR - 1));
    const ang = (y: number) => -Math.PI / 2 + (TAU * (y + 0.5)) / L;
    const rad = (h: number) => Rm * (1 - h / root.h);
    const pt = (y: number, h: number): P2 => [cx + rad(h) * Math.cos(ang(y)), cy + rad(h) * Math.sin(ang(y))];
    const walk = (t: Tn) => {
      for (const k of t.kids) {
        cmds.push(['M', ...pt(k.y, t.h)], ['L', ...pt(k.y, k.h)]);
        walk(k);
      }
      if (t.kids.length) cmds.push(...arc(cx, cy, rad(t.h), ang(t.kids[0].y), ang(t.kids[t.kids.length - 1].y)));
    };
    walk(root);
    parts.push(line(cmds, ink, sw));
    for (let i = 0; i < L; i++) {
      const [px, py] = pt(i, 0);
      parts.push(disc(px, py, tipR, CAT[cladeOf(i) % CAT.length]));
      if (names) {
        const a = ang(i), c = Math.cos(a);
        const o = Rm + tipR + 3, s = Math.sin(a);
        parts.push(text(cx + o * c, cy + o * s + (Math.abs(c) < 0.2 ? s * fs * 0.5 : 0), nameOf(i), fs, TEXT, c > 0.2 ? 'start' : c < -0.2 ? 'end' : 'middle'));
      }
    }
    return parts;
  }
  const sb = scale ? fs * 1.6 : 0;
  const x0 = n.x + 2, x1 = n.x + n.w - nameW - tipR - 2;
  const yTop = n.y + fs * 0.6, yBot = n.y + n.h - fs * 0.6 - sb;
  const X = (h: number) => x0 + (x1 - x0) * (1 - h / root.h);
  const Y = (y: number) => (L === 1 ? (yTop + yBot) / 2 : yTop + ((yBot - yTop) * y) / (L - 1));
  const walk = (t: Tn) => {
    for (const k of t.kids) {
      if (layout === 'slanted') cmds.push(['M', X(t.h), Y(t.y)], ['L', X(k.h), Y(k.y)]);
      else cmds.push(['M', X(t.h), Y(k.y)], ['L', X(k.h), Y(k.y)]);
      walk(k);
    }
    if (t.kids.length && layout === 'rect') cmds.push(['M', X(t.h), Y(t.kids[0].y)], ['L', X(t.h), Y(t.kids[t.kids.length - 1].y)]);
  };
  walk(root);
  cmds.push(['M', X(root.h) - 5, Y(root.y)], ['L', X(root.h), Y(root.y)]);
  parts.push(line(cmds, ink, sw));
  if (support) {
    const sup = (t: Tn) => {
      if (!t.kids.length) return;
      if (t !== root) parts.push(disc(X(t.h), Y(t.y), tipR * 0.8, rand() < 0.7 ? '#333333' : '#FFFFFF', '#333333', 0.7));
      t.kids.forEach(sup);
    };
    sup(root);
  }
  for (let i = 0; i < L; i++) {
    parts.push(disc(X(0), Y(i), tipR, CAT[cladeOf(i) % CAT.length]));
    if (names) parts.push(text(X(0) + tipR + 3, Y(i), nameOf(i), fs, TEXT, 'start', false));
  }
  if (scale) {
    const by = n.y + n.h - fs * 0.5, bl = (x1 - x0) * 0.2;
    parts.push(line([...seg([x0, by], [x0 + bl, by]), ...seg([x0, by - 2], [x0, by + 2]), ...seg([x0 + bl, by - 2], [x0 + bl, by + 2])], ink, 0.9));
    parts.push(text(x0 + bl + 4, by, '0.1', fs * 0.9, TEXT, 'start'));
  }
  return parts;
}

function findLeaf(t: Tn, i: number): Tn | undefined {
  if (!t.kids.length) return t.leaf === i ? t : undefined;
  for (const k of t.kids) {
    const f = findLeaf(k, i);
    if (f) return f;
  }
  return undefined;
}

// ======================================================================
// RNA, CRISPR, cellule
// ======================================================================

/** Forcina di RNA (stem-loop): stelo appaiato, ansa, code a singolo filamento. */
function hairpinShape(n: N): Part[] {
  const bp = clamp(Math.round(n.count) || 6, 2, 20);
  const letters = has(n, 'letters'), tail = has(n, 'tail'), ends = has(n, 'ends');
  const horizontal = n.w > n.h * 1.25;
  const rand = rng(23 + bp);
  const loopN = 6;
  const d = 2.3;
  const Rl = ((loopN + 1) + d) / TAU;
  const al = Math.asin(Math.min(0.99, d / 2 / Rl));
  const vTop = bp - 1;
  const ccv = vTop + Rl * Math.cos(al);
  const nts: { p: P2; b: string }[] = [];
  const pair: [number, number][] = [];
  const tl = tail ? 3 : 0;
  const stem: string[] = Array.from({ length: bp }, () => 'GCAUGC'[Math.floor(rand() * 6)]);
  const comp = (b: string) => (b === 'G' ? (rand() < 0.15 ? 'U' : 'C') : b === 'C' ? 'G' : b === 'A' ? 'U' : 'A');
  for (let t = tl; t >= 1; t--) nts.push({ p: [-d / 2 - t * 0.55, -t * 0.85], b: 'ACGU'[Math.floor(rand() * 4)] });
  for (let i = 0; i < bp; i++) nts.push({ p: [-d / 2, i], b: stem[i] });
  for (let j = 0; j < loopN; j++) {
    const a = -Math.PI / 2 - al - ((j + 1) * (TAU - 2 * al)) / (loopN + 1);
    nts.push({ p: [Rl * Math.cos(a), ccv + Rl * Math.sin(a)], b: 'ACGU'[Math.floor(rand() * 4)] });
  }
  const right0 = nts.length;
  for (let i = bp - 1; i >= 0; i--) nts.push({ p: [d / 2, i], b: comp(stem[i]) });
  for (let t = 1; t <= tl; t++) nts.push({ p: [d / 2 + t * 0.55, -t * 0.85], b: 'ACGU'[Math.floor(rand() * 4)] });
  for (let i = 0; i < bp; i++) pair.push([tl + i, right0 + (bp - 1 - i)]);
  // adatta al riquadro
  const xs = nts.map((q) => q.p[0]), vs = nts.map((q) => q.p[1]);
  const minX = Math.min(...xs) - 0.6, maxX = Math.max(...xs) + 0.6, minV = Math.min(...vs) - 0.6, maxV = Math.max(...vs) + 0.6;
  const ew = ends ? 1.4 : 0;
  const spanU = maxX - minX, spanV = maxV - minV + ew;
  const sc = horizontal ? Math.min(n.h / spanU, n.w / spanV) : Math.min(n.w / spanU, n.h / spanV);
  const cxu = (minX + maxX) / 2;
  const to = (p: P2): P2 =>
    horizontal
      ? [n.x + (n.w - spanV * sc) / 2 + (p[1] - minV + ew) * sc, n.y + n.h / 2 + (p[0] - cxu) * sc]
      : [n.x + n.w / 2 + (p[0] - cxu) * sc, n.y + n.h - (n.h - spanV * sc) / 2 - (p[1] - minV + ew) * sc];
  const pts = nts.map((q) => to(q.p));
  const r = sc * 0.36;
  const parts: Part[] = [line(smooth(pts, false), '#9AA0A6', Math.max(0.8, sc * 0.1))];
  for (const [a, b] of pair) {
    const pa = pts[a], pb = pts[b];
    const ux = (pb[0] - pa[0]) / Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), uy = (pb[1] - pa[1]) / Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    parts.push(line(seg([pa[0] + ux * r, pa[1] + uy * r], [pb[0] - ux * r, pb[1] - uy * r]), '#555555', Math.max(0.8, sc * 0.09)));
  }
  nts.forEach((q, i) => {
    const c = NT[q.b];
    parts.push(disc(pts[i][0], pts[i][1], r, c.fill, c.ink, 0.9));
    if (letters && r >= 3.5) parts.push(text(pts[i][0], pts[i][1], q.b, r * 1.1, c.ink, 'middle', true));
  });
  if (ends) {
    const fs = clamp(sc * 0.75, 6, 11);
    const e5 = to([nts[0].p[0], nts[0].p[1] - 1.1]), e3 = to([nts[nts.length - 1].p[0], nts[nts.length - 1].p[1] - 1.1]);
    parts.push(text(e5[0], e5[1], "5'", fs, TEXT), text(e3[0], e3[1], "3'", fs, TEXT));
  }
  return parts;
}

/** Cas9 con RNA guida: R-loop sul DNA bersaglio, PAM (NGG), siti di taglio, scaffold dell'sgRNA. */
function crisprShape(n: N): Part[] {
  const labels = has(n, 'labels'), cut = has(n, 'cut'), nocas = has(n, 'nocas');
  const { x, y, w, h } = n;
  const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const ink = inkOf(n, '#8E7DB6');
  const casFill = fillOf(n, '#EEEAF7');
  const dna = '#3B4A6B';
  const guide = '#E07B39';
  const sw = clamp(h * 0.025, 1.4, 3);
  const fs = clamp(h * 0.085, 7, 11);
  const yT = 0.66, yB = 0.78, xa = 0.3, xb = 0.62, xp = 0.7;
  const parts: Part[] = [];
  if (!nocas) {
    const rand = rng(3);
    parts.push(area(smooth(blobPts(x + w * 0.47, y + h * 0.45, w * 0.3, h * 0.42, -0.06, 0.05, rand, 12)), casFill, ink, 1.2));
    parts.push(area(smooth(blobPts(x + w * 0.52, y + h * 0.8, w * 0.22, h * 0.14, 0.04, 0.05, rand, 10)), shade(casFill, -0.06), ink, 1));
  }
  // DNA: filamento non bersaglio (sopra, spostato nell'R-loop) e bersaglio (sotto)
  const rungs: Cmd[] = [];
  const step = 0.022;
  for (let u = 0.02; u < 0.99; u += step) {
    if (u > xa - 0.005 && u < xb + 0.005) continue;
    rungs.push(...seg(P(u, yT), P(u, yB)));
  }
  for (let u = xa + step / 2; u < xb; u += step) rungs.push(...seg(P(u, yB - 0.045), P(u, yB)));
  parts.push(line(rungs, '#A9B1C2', Math.max(0.8, sw * 0.5)));
  const top: P2[] = [P(0.01, yT), P(xa - 0.04, yT), P(xa, yT - 0.05), P((xa + xb) / 2, yT - 0.2), P(xb, yT - 0.05), P(xb + 0.04, yT), P(0.99, yT)];
  parts.push(line(smooth(top, false), dna, sw), line(seg(P(0.01, yB), P(0.99, yB)), dna, sw));
  // PAM sul filamento non bersaglio, subito a 3' del protospaziatore
  const pam = { x: x + w * (xb + 0.035), y: y + h * yT - fs * 0.75, w: w * (xp - xb - 0.01), h: fs * 1.5 };
  parts.push(rect(pam.x, pam.y, pam.w, pam.h, '#FFF2CC', '#D6B656', 1, 2), text(pam.x + pam.w / 2, pam.y + pam.h / 2, 'NGG', fs * 0.85, '#7A5C00', 'middle', true));
  // sgRNA: spaziatore appaiato al bersaglio, poi scaffold con due forcine dentro la Cas9 e coda 3'
  const sp: P2[] = [P(xa, yB - 0.045), P(xb - 0.015, yB - 0.045)];
  const stems: [number, number, number][] = [[0.47, 0.36, 0.13], [0.62, 0.36, 0.12]];
  const scaf: P2[] = [sp[1], P(xb - 0.035, 0.6), P(0.5, 0.43), P(0.455, 0.36)];
  for (const [sx, sy, top] of stems) {
    if (sx > 0.5) scaf.push(P(sx - 0.015, sy + 0.01));
    scaf.push(P(sx - 0.012, sy), P(sx - 0.012, top + 0.08), P(sx - 0.03, top + 0.02), P(sx + 0.015, top - 0.03), P(sx + 0.05, top + 0.03), P(sx + 0.03, top + 0.09), P(sx + 0.03, sy));
  }
  scaf.push(P(0.72, 0.4), P(0.82, 0.36), P(0.9, 0.3));
  const sc = smooth(scaf, false);
  parts.push(line(sc, shade(guide, -0.2), sw * 1.6), line(sc, guide, sw * 0.95));
  const bpTicks: Cmd[] = [];
  for (const [sx, sy, top] of stems) for (let v = top + 0.11; v < sy - 0.01; v += 0.06) bpTicks.push(...seg(P(sx - 0.004, v), P(sx + 0.022, v)));
  parts.push(line(bpTicks, shade(guide, -0.25), Math.max(0.7, sw * 0.45)));
  parts.push(line(seg(sp[0], sp[1]), shade(guide, -0.2), sw * 1.7), line(seg(sp[0], sp[1]), guide, sw));
  if (cut) {
    const cx = xb - 0.06;
    const tri = (p: P2, dir: number): Part => area(poly([[p[0], p[1] + dir * 1.5], [p[0] - 4, p[1] + dir * 8], [p[0] + 4, p[1] + dir * 8]]), '#E5484D');
    parts.push(tri(P(cx, yB), 1));
    const tp = P(cx + 0.015, yT - 0.12);
    parts.push(tri(tp, -1));
  }
  if (labels) {
    parts.push(text(...P(0.28, 0.3), 'Cas9', fs * 1.15, shade(ink, -0.3), 'middle', true));
    parts.push(text(...P(0.86, 0.22), 'sgRNA', fs, shade(guide, -0.3), 'start'));
    parts.push(text(pam.x + pam.w / 2, pam.y - fs * 0.7, 'PAM', fs * 0.9, '#7A5C00'));
    parts.push(text(...P(0.005, yT - 0.08), "5'", fs * 0.9, TEXT, 'start'), text(...P(0.995, yT - 0.08), "3'", fs * 0.9, TEXT, 'end'));
    parts.push(text(...P(0.005, yB + 0.08), "3'", fs * 0.9, TEXT, 'start'), text(...P(0.995, yB + 0.08), "5'", fs * 0.9, TEXT, 'end'));
  }
  return parts;
}

/** Cellula schematica: nucleo e cromatina, dogma centrale, goccia con bead (10x), tessuto. */
function cellShape(n: N): Part[] {
  const mode = kindOf(n, ['nucleus', 'dogma', 'droplet', 'tissue'] as const, 'nucleus');
  const { x, y, w, h } = n;
  const fill = fillOf(n, '#D5E8D4');
  const ink = inkOf(n, '#82B366');
  const rand = rng(11 + (Math.round(n.count) || 1));
  const parts: Part[] = [];
  const nucFill = '#E6DDF0', nucInk = '#8E7DB6';
  const chromatin = (cx: number, cy: number, rx: number, ry: number, k: number) => {
    for (let i = 0; i < k; i++) {
      const pts: P2[] = [];
      const a0 = rand() * TAU, rr = 0.25 + 0.5 * rand();
      for (let j = 0; j < 6; j++) {
        const a = a0 + j * 0.9 + rand() * 0.6, q = rr * (0.6 + 0.4 * rand());
        pts.push([cx + rx * q * Math.cos(a), cy + ry * q * Math.sin(a)]);
      }
      parts.push(line(smooth(pts, false), '#9B7BC0', Math.max(0.8, Math.min(w, h) * 0.012)));
    }
  };
  if (mode === 'droplet') {
    const r = Math.min(w, h) / 2 - 1;
    const cx = x + w / 2, cy = y + h / 2;
    parts.push(disc(cx, cy, r, '#EAF4FB', '#7FA7CF', 1.2));
    // bead in gel con oligonucleotidi a codice a barre
    const br = r * 0.36, bx = cx + r * 0.3, by = cy + r * 0.12;
    const oligo: Cmd[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (TAU * i) / 16;
      oligo.push(...seg([bx + br * Math.cos(a), by + br * Math.sin(a)], [bx + br * 1.35 * Math.cos(a), by + br * 1.35 * Math.sin(a)]));
    }
    parts.push(line(oligo, '#E07B39', Math.max(0.8, r * 0.035)), disc(bx, by, br, '#FDE6C2', '#D79B00', 1));
    const cr = r * 0.3, ccx = cx - r * 0.38, ccy = cy - r * 0.2;
    parts.push(area(smooth(blobPts(ccx, ccy, cr, cr * 0.9, 0.3, 0.06, rand, 9)), fill, ink, 1), disc(ccx - cr * 0.1, ccy, cr * 0.45, nucFill, nucInk, 0.8));
    return parts;
  }
  if (mode === 'tissue') {
    const k = clamp(Math.round(n.count) || 14, 3, 60);
    const cols = Math.max(2, Math.round(Math.sqrt((k * w) / h)));
    const rows = Math.ceil(k / cols);
    const cw = w / cols, ch = h / rows;
    const types = [fill, '#F8CECC', '#DAE8FC', '#FFE6CC'];
    const inks = [ink, '#B85450', '#6C8EBF', '#D79B00'];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols && i * cols + j < k; j++) {
        const cx = x + cw * (j + 0.5 + (i % 2 ? 0.18 : -0.18) * (cols > 2 ? 1 : 0)) + (rand() - 0.5) * cw * 0.12;
        const cy = y + ch * (i + 0.5) + (rand() - 0.5) * ch * 0.12;
        const t = Math.floor(rand() * 4);
        const rx = cw * 0.47, ry = ch * 0.47;
        parts.push(area(smooth(blobPts(clamp(cx, x + rx, x + w - rx), cy, rx, ry, rand() * Math.PI, 0.08, rand, 9)), types[t], inks[t], 0.9));
        parts.push(disc(clamp(cx, x + rx, x + w - rx) + (rand() - 0.5) * rx * 0.3, cy + (rand() - 0.5) * ry * 0.3, Math.min(rx, ry) * 0.36, nucFill, nucInk, 0.7));
      }
    }
    return parts;
  }
  const memb = blobPts(x + w / 2, y + h / 2, w * 0.48, h * 0.46, 0.15, 0.05, rand, 14);
  parts.push(area(smooth(memb), fill, ink, Math.max(1.2, n.strokeWidth)));
  if (mode === 'dogma') {
    // nucleo con DNA, mRNA che esce da un poro, ribosoma e catena nascente nel citoplasma
    const ncx = x + w * 0.33, ncy = y + h * 0.5, nrx = w * 0.24, nry = h * 0.32;
    parts.push({ kind: 'ellipse', cx: ncx, cy: ncy, rx: nrx, ry: nry, fill: nucFill, stroke: nucInk, sw: 1.1, solid: true });
    const hx0 = ncx - nrx * 0.7, hx1 = ncx + nrx * 0.5, hy = ncy - nry * 0.15, ha = nry * 0.22;
    const s1: P2[] = [], s2: P2[] = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30, a = u * TAU * 1.5;
      s1.push([lerp(hx0, hx1, u), hy + ha * Math.sin(a)]);
      s2.push([lerp(hx0, hx1, u), hy - ha * Math.sin(a)]);
    }
    const rr: Cmd[] = [];
    for (let i = 1; i < 30; i += 3) rr.push(...seg(s1[i], s2[i]));
    parts.push(line(rr, '#A9B1C2', 0.8), line(poly(s1, false), '#3B4A6B', 1.4), line(poly(s2, false), '#7A8BB0', 1.4));
    const mr: P2[] = [[ncx - nrx * 0.3, ncy + nry * 0.35], [ncx + nrx * 0.3, ncy + nry * 0.45], [ncx + nrx * 0.98, ncy + nry * 0.1], [x + w * 0.66, y + h * 0.56], [x + w * 0.8, y + h * 0.62]];
    const mcmds = smooth(mr, false);
    parts.push(line(mcmds, '#C0392B', Math.max(1.2, Math.min(w, h) * 0.02)));
    parts.push(disc(ncx + nrx * 0.98, ncy + nry * 0.1, Math.min(w, h) * 0.025, '#FFFFFF', nucInk, 0.9));
    const rbx = x + w * 0.73, rby = y + h * 0.58;
    parts.push({ kind: 'ellipse', cx: rbx, cy: rby - h * 0.05, rx: w * 0.06, ry: h * 0.06, fill: '#FFE6CC', stroke: '#D79B00', sw: 0.9, solid: true });
    parts.push({ kind: 'ellipse', cx: rbx, cy: rby + h * 0.035, rx: w * 0.045, ry: h * 0.035, fill: '#FFE6CC', stroke: '#D79B00', sw: 0.9, solid: true });
    const pr = Math.min(w, h) * 0.022;
    const chain: P2[] = [[rbx + w * 0.02, rby - h * 0.12], [rbx + w * 0.06, rby - h * 0.18], [rbx + w * 0.1, rby - h * 0.15], [rbx + w * 0.13, rby - h * 0.21], [rbx + w * 0.15, rby - h * 0.28]];
    parts.push(line(poly(chain, false), '#7A808A', 0.8));
    chain.forEach((p, i) => parts.push(disc(p[0], p[1], pr, [ '#DAE8FC', '#F8CECC', '#D5E8D4', '#FFF2CC', '#E1D5E7'][i], '#6B7280', 0.6)));
    return parts;
  }
  const ncx = x + w * 0.45, ncy = y + h * 0.48, nrx = w * 0.2, nry = h * 0.22;
  // reticolo endoplasmatico attorno al nucleo
  const er: Cmd[] = [];
  for (const k of [1.32, 1.55]) er.push(...arc(ncx, ncy, nrx * k, 0.3, 2.2));
  parts.push(line(er, '#C9A6D9', Math.max(0.8, Math.min(w, h) * 0.015)));
  parts.push({ kind: 'ellipse', cx: ncx, cy: ncy, rx: nrx, ry: nry, fill: nucFill, stroke: nucInk, sw: 1.1, solid: true });
  chromatin(ncx, ncy, nrx, nry, 5);
  parts.push(disc(ncx + nrx * 0.25, ncy - nry * 0.2, Math.min(nrx, nry) * 0.22, '#9B7BC0'));
  for (let i = 0; i < 8; i++) {
    const a = (TAU * i) / 8 + 0.2;
    parts.push(disc(ncx + nrx * Math.cos(a), ncy + nry * Math.sin(a), Math.min(w, h) * 0.012, '#FFFFFF', nucInk, 0.6));
  }
  const mito: [number, number, number][] = [[0.76, 0.32, 0.6], [0.72, 0.72, -0.4], [0.22, 0.72, 0.3]];
  for (const [u, v, a] of mito) {
    parts.push(area(smooth(blobPts(x + w * u, y + h * v, w * 0.08, h * 0.045, a, 0.04, rand, 8)), '#F8CECC', '#B85450', 0.8));
  }
  for (let i = 0; i < 14; i++) {
    const a = rand() * TAU, q = 0.62 + 0.28 * rand();
    parts.push(disc(x + w / 2 + w * 0.46 * q * Math.cos(a), y + h / 2 + h * 0.44 * q * Math.sin(a), Math.min(w, h) * 0.012, '#6B7280'));
  }
  return parts;
}

/** Trascrittomica spaziale: spot a reticolo esagonale sopra una sezione di tessuto. */
function spatialShape(n: N): Part[] {
  const mode = kindOf(n, ['clusters', 'gene', 'tissue', 'array'] as const, 'clusters');
  const k = clamp(Math.round(n.count) || 14, 5, 48);
  const { x, y, w, h } = n;
  const rand = rng(19);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push(rect(x, y, w, h, n.fill, n.stroke, n.strokeWidth, Math.min(n.radius, 4)));
  const tis = blobPts(x + w * 0.5, y + h * 0.5, w * 0.4, h * 0.38, 0.4, 0.12, rand, 11);
  if (mode !== 'array') parts.push(area(smooth(tis), mode === 'tissue' ? '#F3C6DA' : '#F4EEF3', mode === 'tissue' ? '#C77FA0' : '#D9C7D6', 0.9));
  if (mode === 'tissue') {
    for (let i = 0; i < 160; i++) {
      const px = x + w * (0.1 + 0.8 * rand()), py = y + h * (0.1 + 0.8 * rand());
      if (insidePoly(tis, px, py)) parts.push(disc(px, py, Math.min(w, h) * 0.008 + 0.4, '#8E5BA8'));
    }
  }
  const sp = (w - 4) / (k + 0.5);
  const rows = Math.floor((h - 4) / (sp * 0.866));
  const rr = sp * 0.36;
  const oy = y + (h - (rows - 1) * sp * 0.866) / 2;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < k; j++) {
      const px = x + 2 + sp * (j + 0.5 + (i % 2 ? 0.5 : 0)) - sp * 0.25, py = oy + i * sp * 0.866;
      const inT = insidePoly(tis, px, py);
      if (mode === 'array' || !inT) {
        if (mode === 'array' || mode === 'tissue') parts.push(disc(px, py, rr, 'none', '#B8BEC6', 0.6));
        continue;
      }
      if (mode === 'tissue') {
        parts.push(disc(px, py, rr, 'none', '#7A808A', 0.6));
        continue;
      }
      const u = (px - x) / w, v = (py - y) / h;
      if (mode === 'gene') {
        const e = Math.exp(-(((u - 0.38) / 0.16) ** 2 + ((v - 0.42) / 0.2) ** 2)) + 0.6 * Math.exp(-(((u - 0.7) / 0.1) ** 2 + ((v - 0.68) / 0.12) ** 2));
        parts.push(disc(px, py, rr, ramp('purples', 0.1 + 0.85 * clamp(e + 0.08 * rand(), 0, 1))));
      } else {
        const layer = clamp(Math.floor((u * 0.75 + v * 0.55 + 0.08 * Math.sin(v * 9)) * 4.2) - 1, 0, 6);
        parts.push(disc(px, py, rr, CAT[layer % CAT.length]));
      }
    }
  }
  return parts;
}

/** Strumenti di laboratorio: sequenziatore, flow cell, provetta, piastra a 96 pozzetti. */
function labShape(n: N): Part[] {
  const kind = kindOf(n, ['sequencer', 'flowcell', 'tube', 'plate'] as const, 'sequencer');
  const { x, y, w, h } = n;
  const fill = fillOf(n, '#F5F5F5');
  const ink = inkOf(n, '#666666');
  const sw = Math.max(1, n.strokeWidth);
  const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
  switch (kind) {
    case 'flowcell': {
      const parts: Part[] = [rect(x, y + h * 0.1, w, h * 0.8, '#EAF4FB', '#7FA7CF', sw, Math.min(w, h) * 0.08)];
      const lanes = 8;
      for (let i = 0; i < lanes; i++) {
        const ly = y + h * (0.2 + (0.6 * (i + 0.5)) / lanes);
        parts.push(rect(x + w * 0.12, ly - h * 0.025, w * 0.76, h * 0.05, '#BFD7F0', 'none', 0, h * 0.025));
        parts.push(disc(x + w * 0.08, ly, h * 0.022, '#FFFFFF', '#7FA7CF', 0.6), disc(x + w * 0.92, ly, h * 0.022, '#FFFFFF', '#7FA7CF', 0.6));
      }
      return parts;
    }
    case 'tube': {
      const liquid = '#F8CECC';
      return [
        rect(x + w * 0.18, y + h * 0.02, w * 0.64, h * 0.1, fill, ink, sw, 2),
        area(poly([P(0.86, 0.06), P(1, 0.02), P(1, 0.1), P(0.86, 0.12)]), fill, ink, sw * 0.8),
        area([['M', ...P(0.22, 0.14)], ['L', ...P(0.78, 0.14)], ['L', ...P(0.72, 0.62)], ['C', ...P(0.66, 0.9), ...P(0.58, 0.98), ...P(0.5, 0.98)], ['C', ...P(0.42, 0.98), ...P(0.34, 0.9), ...P(0.28, 0.62)], ['Z']], '#FFFFFF', ink, sw),
        area([['M', ...P(0.255, 0.45)], ['L', ...P(0.745, 0.45)], ['L', ...P(0.72, 0.62)], ['C', ...P(0.66, 0.9), ...P(0.58, 0.96), ...P(0.5, 0.96)], ['C', ...P(0.42, 0.96), ...P(0.34, 0.9), ...P(0.28, 0.62)], ['Z']], liquid, 'none'),
      ];
    }
    case 'plate': {
      const parts: Part[] = [rect(x, y, w, h, fill, ink, sw, Math.min(w, h) * 0.06)];
      const rows = 8, cols = 12;
      const px = w * 0.06, py = h * 0.08;
      const cw = (w - 2 * px) / cols, ch = (h - 2 * py) / rows;
      const r = Math.min(cw, ch) * 0.36;
      const rand = rng(5);
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const f = rand() < 0.6 ? ['#F8CECC', '#DAE8FC', '#D5E8D4', '#FFE6CC'][Math.floor(rand() * 4)] : '#FFFFFF';
          parts.push(disc(x + px + cw * (j + 0.5), y + py + ch * (i + 0.5), r, f, shade(ink, 0.2), 0.5));
        }
      }
      return parts;
    }
    default: {
      // sequenziatore da banco: schermo, sportello della flow cell, spia
      const parts: Part[] = [
        rect(x, y + h * 0.08, w, h * 0.92, fill, ink, sw, Math.min(w, h) * 0.08),
        rect(x + w * 0.08, y + h * 0.2, w * 0.4, h * 0.34, '#2F3A4A', ink, sw * 0.8, 2),
        rect(x + w * 0.56, y + h * 0.24, w * 0.34, h * 0.08, shade(fill, -0.12), ink, sw * 0.7, 1.5),
        rect(x + w * 0.08, y + h * 0.66, w * 0.84, h * 0.06, shade(fill, -0.08), 'none', 0, 1),
        disc(x + w * 0.86, y + h * 0.84, Math.min(w, h) * 0.04, '#5CB85C', 'none'),
      ];
      const bars: Cmd[] = [];
      for (let i = 0; i < 4; i++) bars.push(...seg([x + w * 0.13, y + h * (0.28 + i * 0.065)], [x + w * (0.22 + 0.2 * ((i * 7) % 5) / 5), y + h * (0.28 + i * 0.065)]));
      parts.push(line(bars, '#7AD151', Math.max(0.8, h * 0.025)));
      return parts;
    }
  }
}

// ---------------- varianti mostrate come pulsanti nel pannello ----------------

const c = (value: string, label: string) => ({ value, label });

const OPTIONS: Record<string, SpecGroup[]> = {
  'gen-helix': [{ title: 'Opzioni', mode: 'many', choices: [c('ends', "Estremità 5'/3'"), c('open', 'Bolla aperta'), c('mono', 'Basi grigie')] }],
  'gen-seq': [
    { title: 'Sequenza', choices: [c('ATGCGTACGTTAGC', 'DNA'), c('AUGGCUCUGUAA', 'mRNA'), c('MKTAYIAKQRQISFVKSHFSRQ', 'Proteina'), c('ACGT?GCA?TGA', 'Mascherata'), c('GACGCTAGCTAgGCAT', 'Variante')] },
    { title: 'Opzioni', mode: 'many', choices: [c('ends', 'Estremità'), c('index', 'Posizioni'), c('codons', 'Codoni'), c('plain', 'Solo lettere')] },
  ],
  'gen-kmer': [
    { title: 'Sequenza', choices: [c('ATGGCTACG', 'ATGGCTACG'), c('AGCGCACACTCTTTG', 'Più lunga')] },
    { title: 'Opzioni', mode: 'many', choices: [c('tokens', 'Riga di token'), c('cls', '[CLS] / [SEP]'), c('mask', 'Maschera'), c('stride', 'Senza sovrapposizione')] },
  ],
  'gen-reads': [{ title: 'Opzioni', mode: 'many', choices: [c('ref', 'Riferimento'), c('coverage', 'Copertura'), c('variant', 'Variante (SNV)'), c('paired', 'Paired-end'), c('strand', 'Colori per filamento')] }],
  'gen-gene': [{ title: 'Opzioni', mode: 'many', choices: [c('utr', 'UTR'), c('tss', 'TSS'), c('labels', 'Nomi esoni'), c('splice', 'Splicing → mRNA'), c('reverse', 'Filamento −')] }],
  'gen-chrom': [{ title: 'Opzioni', mode: 'many', choices: [c('labels', 'Nomi'), c('locus', 'Locus evidenziato')] }],
  'gen-tracks': [{ title: 'Opzioni', mode: 'many', choices: [c('names', 'Nomi tracce'), c('gene', 'Annotazione geni'), c('highlight', 'Finestra'), c('ruler', 'Scala'), c('mono', 'Un colore')] }],
  'gen-logo': [
    { title: 'Motivo', choices: [c('TGACTCA', 'AP-1'), c('CCGCGGGG', 'CTCF (parte)'), c('TATAAA', 'TATA box'), c('CACGTG', 'E-box')] },
    { title: 'Opzioni', mode: 'many', choices: [c('axis', 'Asse (bit)')] },
  ],
  'gen-msa': [
    { title: 'Colori', choices: [c('clustal', 'Per proprietà'), c('nucleotide', 'Nucleotidi'), c('heat', 'Rappresentazione'), c('mono', 'Colonne conservate')] },
    { title: 'Opzioni', mode: 'many', choices: [c('letters', 'Lettere'), c('conservation', 'Conservazione'), c('gaps', 'Gap')] },
  ],
  'gen-ribbon': [
    { title: 'Forma', choices: [c('fold', 'Ripiegata'), c('linear', 'Strutture in fila'), c('helix', 'α-elica'), c('sheet', 'Foglietto β'), c('partial', 'Quasi ripiegata'), c('noisy', 'Parz. rumorosa'), c('cloud', 'Nuvola di residui')] },
    { title: 'Colori', choices: [c('rainbow', 'N→C arcobaleno'), c('ss', 'Per struttura'), c('plddt', 'pLDDT'), c('mono', 'Colori del blocco')] },
  ],
  'gen-chain': [
    { title: 'Sequenza', choices: [c('MKTAYIAKQR', 'MKTAYIAKQR'), c('GSHMLEDP', 'GSHMLEDP'), c('MK?AYI?KQR', 'Mascherata')] },
    { title: 'Opzioni', mode: 'many', choices: [c('wave', 'Zig-zag'), c('ends', 'N / C'), c('plain', 'Senza lettere')] },
  ],
  'gen-contact': [
    { title: 'Tipo', choices: [c('distance', 'Distanze'), c('contact', 'Contatti')] },
    { title: 'Colori', choices: [c('viridis', 'Viridis'), c('blues', 'Blu'), c('oranges', 'Arancio'), c('purples', 'Viola'), c('greens', 'Verde')] },
    { title: 'Opzioni', mode: 'many', choices: [c('split', 'Predetta / vera')] },
  ],
  'gen-manhattan': [{ title: 'Opzioni', mode: 'many', choices: [c('labels', 'Nomi assi'), c('threshold', 'Soglia 5e-8')] }],
  'gen-volcano': [{ title: 'Opzioni', mode: 'many', choices: [c('labels', 'Nomi assi'), c('thresholds', 'Soglie'), c('genes', 'Nomi geni')] }],
  'gen-heatmap': [
    { title: 'Righe × colonne', mode: 'value', choices: [c('16x10', '16×10'), c('24x12', '24×12'), c('12x6', '12×6')] },
    { title: 'Colori', choices: [c('rdbu', 'Blu-rosso'), c('viridis', 'Viridis'), c('magma', 'Magma')] },
    { title: 'Opzioni', mode: 'many', choices: [c('rowtree', 'Dendrogramma righe'), c('coltree', 'Dendrogramma colonne'), c('annot', 'Gruppi')] },
  ],
  'gen-umap': [
    { title: 'Colori', choices: [c('clusters', 'Cluster'), c('expr', 'Espressione gene'), c('batch', 'Batch'), c('gray', 'Grigio')] },
    { title: 'Opzioni', mode: 'many', choices: [c('labels', 'Numeri cluster'), c('axes', 'Assi UMAP')] },
  ],
  'gen-phylo': [
    { title: 'Forma', choices: [c('rect', 'Rettangolare'), c('slanted', 'Obliqua'), c('radial', 'Radiale')] },
    { title: 'Opzioni', mode: 'many', choices: [c('names', 'Nomi specie'), c('scale', 'Scala'), c('support', 'Supporto nodi')] },
  ],
  'gen-hairpin': [{ title: 'Opzioni', mode: 'many', choices: [c('letters', 'Lettere'), c('tail', 'Code'), c('ends', "5'/3'")] }],
  'gen-crispr': [{ title: 'Opzioni', mode: 'many', choices: [c('labels', 'Nomi'), c('cut', 'Siti di taglio'), c('nocas', 'Senza Cas9')] }],
  'gen-cell': [{ title: 'Variante', choices: [c('nucleus', 'Nucleo'), c('dogma', 'Dogma centrale'), c('droplet', 'Goccia + bead'), c('tissue', 'Tessuto')] }],
  'gen-spatial': [{ title: 'Variante', choices: [c('clusters', 'Domini'), c('gene', 'Espressione'), c('tissue', 'Tessuto + spot'), c('array', 'Array vuoto')] }],
  'gen-lab': [{ title: 'Strumento', choices: [c('sequencer', 'Sequenziatore'), c('flowcell', 'Flow cell'), c('tube', 'Provetta'), c('plate', 'Piastra 96')] }],
};

const DEFS: Omit<ShapeDef, 'specOptions'>[] = [
  { kind: 'gen-helix', name: 'Doppia elica (DNA)', parts: helixShape, countLabel: 'Giri', countMax: 16, specLabel: 'Opzioni' },
  { kind: 'gen-seq', name: 'Sequenza (DNA/RNA/proteina)', parts: seqShape, specLabel: 'Sequenza e opzioni' },
  { kind: 'gen-kmer', name: 'Tokenizzazione k-mer', parts: kmerShape, countLabel: 'k', countMax: 8, specLabel: 'Sequenza e opzioni' },
  { kind: 'gen-reads', name: 'Reads allineate (pileup)', parts: readsShape, countLabel: 'Profondità', countMax: 30, specLabel: 'Opzioni' },
  { kind: 'gen-gene', name: 'Modello di gene', parts: geneShape, countLabel: 'Esoni', countMax: 14, specLabel: 'Opzioni' },
  { kind: 'gen-chrom', name: 'Cromosoma / cariotipo', parts: chromShape, countLabel: 'Cromosomi', countMax: 24, specLabel: 'Opzioni' },
  { kind: 'gen-tracks', name: 'Tracce genomiche', parts: tracksShape, countLabel: 'Tracce', countMax: 12, specLabel: 'Opzioni' },
  { kind: 'gen-logo', name: 'Logo di sequenza', parts: logoShape, countLabel: 'Posizioni', countMax: 24, specLabel: 'Motivo e opzioni' },
  { kind: 'gen-msa', name: 'Allineamento multiplo (MSA)', parts: msaShape, countLabel: 'Sequenze', countMax: 32, specLabel: 'Variante' },
  { kind: 'gen-ribbon', name: 'Proteina (cartoon)', parts: ribbonShape, countLabel: 'Elementi / variante', countMax: 10, specLabel: 'Variante' },
  { kind: 'gen-chain', name: 'Catena di amminoacidi', parts: chainShape, specLabel: 'Sequenza e opzioni' },
  { kind: 'gen-contact', name: 'Mappa di contatti / distanze', parts: contactShape, countLabel: 'Residui', countMax: 80, specLabel: 'Variante' },
  { kind: 'gen-manhattan', name: 'Manhattan plot', parts: manhattanShape, countLabel: 'Loci significativi', countMax: 12, specLabel: 'Opzioni' },
  { kind: 'gen-volcano', name: 'Volcano plot', parts: volcanoShape, specLabel: 'Opzioni' },
  { kind: 'gen-heatmap', name: 'Heatmap di espressione', parts: exprHeatShape, countLabel: 'Cluster', countMax: 6, specLabel: 'Variante' },
  { kind: 'gen-umap', name: 'UMAP single-cell', parts: umapShape, countLabel: 'Cluster', countMax: 12, specLabel: 'Variante' },
  { kind: 'gen-phylo', name: 'Albero filogenetico', parts: phyloShape, countLabel: 'Foglie', countMax: 32, specLabel: 'Variante' },
  { kind: 'gen-hairpin', name: 'Forcina di RNA', parts: hairpinShape, countLabel: 'Coppie nello stelo', countMax: 20, specLabel: 'Opzioni' },
  { kind: 'gen-crispr', name: 'CRISPR-Cas9 + sgRNA', parts: crisprShape, specLabel: 'Opzioni' },
  { kind: 'gen-cell', name: 'Cellula (nucleo, goccia, tessuto)', parts: cellShape, countLabel: 'Cellule / variante', countMax: 60, specLabel: 'Variante' },
  { kind: 'gen-spatial', name: 'Trascrittomica spaziale', parts: spatialShape, countLabel: 'Spot per riga', countMax: 48, specLabel: 'Variante' },
  { kind: 'gen-lab', name: 'Strumento di laboratorio', parts: labShape, specLabel: 'Strumento' },
];

export const GENOMICS_SHAPES: ShapeDef[] = DEFS.map((d) => ({ ...d, specOptions: OPTIONS[d.kind] }));
