// Blocchi dei diagrammi di machine learning classico: tabella dei dati, suddivisione
// train/val/test, k-fold, dendrogramma, foresta di alberi, importanza delle feature, scree plot.
// Senza cornice, come gli istogrammi della libreria di base: usano i colori del blocco.
import { parseGrid, poly, rng, shade, type ClipRect, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef } from '../registry';
import { AXIS, CLS, INK, PLAIN, TEXT, clamp, disc, faded, flag, line, marker, seg, text, type P2 } from './ml-kit';

const TRAIN = (n: NodeModel) => ({ fill: n.fill === 'none' ? '#DAE8FC' : n.fill, stroke: n.stroke === 'none' ? '#6C8EBF' : n.stroke });
const HELD = { fill: '#FFD8A8', stroke: '#D79B00' };
const TEST = { fill: '#D5E8D4', stroke: '#82B366' };
const EXTRA = [{ fill: '#E1D5E7', stroke: '#9673A6' }, { fill: '#F8CECC', stroke: '#B85450' }];

/** Larghezza stimata di un testo breve (per decidere se entra in una cella). */
const fits = (t: string, size: number, room: number) => t.replace(/\$|\\[a-z]+|[_^{}]/g, '').length * size * 0.52 <= room;

// ---------------------------------------------------------------- tabella dei dati

function table(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const [rows, cols] = parseGrid(n.spec, 5);
  const target = flag(n, 'y');
  const R = rows + 1;
  const cw = w / cols, ch = h / R;
  const fill = n.fill === 'none' ? '#FFFFFF' : n.fill;
  const ink = n.stroke === 'none' ? '#666666' : n.stroke;
  const head = shade(fill === '#FFFFFF' ? '#E5E7EB' : fill, fill === '#FFFFFF' ? 0 : -0.12);
  const zebra = fill === '#FFFFFF' ? '#F6F7F9' : faded(fill, 0.55);
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: 0, fill: '#FFFFFF' }];
  for (let j = 0; j < R; j++) {
    const rowFill = j === 0 ? head : j % 2 ? '#FFFFFF' : zebra;
    parts.push({ kind: 'rect', x, y: y + j * ch, w, h: ch, r: 0, fill: rowFill, stroke: 'none' });
    if (target) parts.push({ kind: 'rect', x: x + (cols - 1) * cw, y: y + j * ch, w: cw, h: ch, r: 0, fill: j === 0 ? '#FFD8A8' : j % 2 ? '#FFF4E6' : '#FFEAD2', stroke: 'none' });
  }
  // nomi delle colonne (x₁ … x_d e y) se leggibili, altrimenti trattini come i valori
  const names = Array.from({ length: cols }, (_, i) => (target && i === cols - 1 ? '$y$' : `$x_{${i + 1}}$`));
  const hsz = clamp(ch * 0.66, 6, 11);
  const named = !flag(n, 'plain') && ch >= 8 && names.every((t) => fits(t, hsz, cw - 3));
  if (named) names.forEach((t, i) => parts.push(text(x + i * cw + cw / 2, y + ch / 2, t, hsz, shade(ink, -0.35))));
  // "valori" nelle celle: trattini grigi di lunghezza variabile
  if (ch >= 7 && cw >= 12) {
    const rand = rng(rows * 29 + cols);
    const txt: Cmd[] = [], hdr: Cmd[] = [];
    for (let j = named ? 1 : 0; j < R; j++)
      for (let i = 0; i < cols; i++) {
        const len = cw * (j === 0 ? 0.55 : 0.3 + 0.35 * rand());
        const cx = x + i * cw + cw / 2, cy = y + j * ch + ch / 2;
        (j === 0 ? hdr : txt).push(...seg([cx - len / 2, cy], [cx + len / 2, cy]));
      }
    const tw = clamp(ch * 0.16, 0.8, 2.2);
    parts.push(line(txt, shade(ink, 0.45), tw));
    if (hdr.length) parts.push(line(hdr, shade(ink, -0.1), tw * 1.4));
  }
  const grid: Cmd[] = [];
  for (let i = 1; i < cols; i++) grid.push(...seg([x + i * cw, y], [x + i * cw, y + h]));
  for (let j = 1; j < R; j++) grid.push(...seg([x, y + j * ch], [x + w, y + j * ch]));
  parts.push(line(grid, ink, n.strokeWidth * 0.5));
  parts.push(line(seg([x, y + ch], [x + w, y + ch]), ink, n.strokeWidth * 0.9));
  if (target) parts.push(line(seg([x + (cols - 1) * cw, y], [x + (cols - 1) * cw, y + h]), '#D79B00', n.strokeWidth * 0.9));
  parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
  return parts;
}

// ---------------------------------------------------------------- k-fold

/** Geometria del k-fold (righe, colonne, margini per le etichette): serve anche ai modelli. */
export function kfoldLayout(n: NodeModel) {
  const { x, y, w, h } = n;
  const k = clamp(Math.round(n.count), 2, 10);
  const time = flag(n, 'time');
  const withTest = flag(n, 'test');
  const row0 = h / (k + (k - 1) * 0.4);
  // etichette solo se le righe sono abbastanza alte da restare leggibili
  const labels = !flag(n, 'plain') && row0 >= 10;
  const sz = clamp(Math.min(row0 * 0.62, w * 0.07), 6.5, 10);
  const left = labels ? `Split ${k}`.length * sz * 0.52 + 6 : 0;
  const top = labels ? sz * 1.7 : 0;
  const x0 = x + left, y0 = y + top, W = w - left, H = h - top;
  const rowH = H / (k + (k - 1) * 0.4);
  const segs = time ? k + 1 : k;
  const testW = withTest ? W / (segs + 1) : 0;
  const gapX = withTest ? Math.min(testW * 0.3, 8) : 0;
  const cw = (W - testW - gapX) / segs;
  const rowY = Array.from({ length: k }, (_, r) => y0 + r * rowH * 1.4);
  return { k, time, withTest, labels, sz, x0, y0, W, rowH, segs, testW, cw, rowY, right: x + w };
}

function kfold(n: NodeModel): Part[] {
  const L = kfoldLayout(n);
  const tr = TRAIN(n);
  const sw = n.strokeWidth * 0.8;
  const parts: Part[] = [];
  L.rowY.forEach((ry, r) => {
    const later: Part[] = [];
    for (let i = 0; i < L.segs; i++) {
      const cell = { kind: 'rect' as const, x: L.x0 + i * L.cw, y: ry, w: L.cw, h: L.rowH, r: 0, sw, solid: true };
      if (L.time) {
        if (i <= r) parts.push({ ...cell, ...tr });
        else if (i === r + 1) later.push({ ...cell, ...HELD });
        else parts.push({ ...cell, fill: '#F5F5F5', stroke: '#C8C8C8' });
      } else if (i === r) later.push({ ...cell, ...HELD });
      else parts.push({ ...cell, ...tr });
    }
    parts.push(...later);
    if (L.withTest) parts.push({ kind: 'rect', x: L.right - L.testW, y: ry, w: L.testW, h: L.rowH, r: 0, sw, solid: true, ...TEST });
    if (L.labels) parts.push(text(L.x0 - 5, ry + L.rowH / 2, `Split ${r + 1}`, L.sz, TEXT, 'end'));
  });
  if (L.labels) {
    const hy = L.y0 - L.sz * 0.85;
    if (!L.time)
      for (let i = 0; i < L.k; i++) {
        const t = fits(`Fold ${i + 1}`, L.sz, L.cw - 2) ? `Fold ${i + 1}` : String(i + 1);
        parts.push(text(L.x0 + (i + 0.5) * L.cw, hy, t, L.sz, TEXT));
      }
    else parts.push(text(L.x0, hy, 'time →', L.sz, TEXT, 'start'));
    if (L.withTest && fits('Test', L.sz, L.testW + 6)) parts.push(text(L.right - L.testW / 2, hy, 'Test', L.sz, TEXT));
  }
  return parts;
}

// ---------------------------------------------------------------- suddivisione train / val / test

function split(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const nums = n.spec.split(/[^\d.]+/).map(Number).filter((v) => v > 0).slice(0, 5);
  const fr = nums.length >= 2 ? nums : [70, 15, 15];
  const tot = fr.reduce((a, b) => a + b, 0);
  // due parti: train / test (verde, come nel k-fold); tre o più: train / val / test / ...
  const colors = fr.length === 2 ? [TRAIN(n), TEST] : [TRAIN(n), HELD, TEST, ...EXTRA];
  const names = fr.length === 2 ? ['train', 'test'] : ['train', 'val', 'test', 'extra', 'extra'];
  const horiz = w >= h;
  const r = Math.min(n.radius, w / 2, h / 2);
  const clip: ClipRect = { x, y, w, h, r };
  const parts: Part[] = [];
  const words: Part[] = [];
  const sz = clamp(Math.min(w, h) * 0.5, 6.5, 11);
  let acc = 0;
  fr.forEach((f, i) => {
    const a = acc / tot, b = (acc + f) / tot;
    acc += f;
    const c = colors[i];
    parts.push(
      horiz
        ? { kind: 'rect', x: x + a * w, y, w: (b - a) * w, h, r: 0, fill: c.fill, stroke: 'none', clip }
        : { kind: 'rect', x, y: y + a * h, w, h: (b - a) * h, r: 0, fill: c.fill, stroke: 'none', clip },
    );
    // nome della parte (con la percentuale se c'è spazio)
    const room = horiz ? (b - a) * w - 4 : w - 4;
    const tall = horiz ? h : (b - a) * h;
    const full = `${names[i]} ${Math.round((f / tot) * 100)}%`;
    const t = fits(full, sz, room) ? full : fits(names[i], sz, room) ? names[i] : '';
    if (t && tall >= sz * 1.3 && !flag(n, 'plain')) {
      const [cx, cy] = horiz ? [x + ((a + b) / 2) * w, y + h / 2] : [x + w / 2, y + ((a + b) / 2) * h];
      words.push(text(cx, cy, t, sz, '#333333'));
    }
  });
  acc = 0;
  const cuts: Cmd[] = [];
  for (const f of fr.slice(0, -1)) {
    acc += f;
    const t = acc / tot;
    cuts.push(...(horiz ? seg([x + t * w, y], [x + t * w, y + h]) : seg([x, y + t * h], [x + w, y + t * h])));
  }
  parts.push(line(cuts, n.stroke === 'none' ? '#666666' : n.stroke, n.strokeWidth * 0.8));
  parts.push({ kind: 'rect', x, y, w, h, r, fill: 'none' }, ...words);
  return parts;
}

// ---------------------------------------------------------------- dendrogramma

interface Merge {
  a: number;
  b: number;
  h: number;
}

/** Clustering agglomerativo (average linkage) su punti 2D generati: dendrogramma plausibile. */
function agglomerate(N: number): { merges: Merge[]; order: number[] } {
  const rand = rng(1500 + N);
  const C: P2[] = [[0.2, 0.3], [0.7, 0.25], [0.5, 0.8]];
  const pts: P2[] = Array.from({ length: N }, (_, i) => {
    const c = C[i % 3];
    return [c[0] + (rand() - 0.5) * 0.25, c[1] + (rand() - 0.5) * 0.25];
  });
  const members = new Map<number, number[]>(pts.map((_, i) => [i, [i]]));
  const d = (a: number[], b: number[]) => a.reduce((s, i) => s + b.reduce((t, j) => t + Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]), 0), 0) / (a.length * b.length);
  const merges: Merge[] = [];
  let next = N;
  while (members.size > 1) {
    let best: [number, number, number] = [-1, -1, Infinity];
    const ids = [...members.keys()];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const v = d(members.get(ids[i])!, members.get(ids[j])!);
        if (v < best[2]) best = [ids[i], ids[j], v];
      }
    const [a, b, h] = best;
    merges.push({ a, b, h: Math.max(h, merges.length ? merges[merges.length - 1].h : 0) });
    members.set(next++, [...members.get(a)!, ...members.get(b)!]);
    members.delete(a);
    members.delete(b);
  }
  const order: number[] = [];
  const walk = (id: number) => {
    if (id < N) order.push(id);
    else {
      walk(merges[id - N].a);
      walk(merges[id - N].b);
    }
  };
  walk(2 * N - 2);
  return { merges, order };
}

function dendrogram(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const N = clamp(Math.round(n.count), 3, 24);
  const { merges, order } = agglomerate(N);
  const hmax = merges[merges.length - 1].h;
  const cut = hmax * 0.62;
  const base = y + h * 0.94;
  const top = y + h * 0.04;
  const Yh = (v: number) => base - (base - top) * (v / hmax);
  const X: number[] = new Array(2 * N - 1);
  const Yn: number[] = new Array(2 * N - 1).fill(base);
  const color: number[] = new Array(2 * N - 1).fill(-1);
  order.forEach((leaf, i) => (X[leaf] = x + (w * (i + 0.5)) / N));
  merges.forEach((m, i) => {
    X[N + i] = (X[m.a] + X[m.b]) / 2;
    Yn[N + i] = Yh(m.h);
  });
  // colori dei cluster sotto la soglia (come color_threshold di SciPy)
  let nc = 0;
  const paint = (id: number, c: number) => {
    color[id] = c;
    if (id >= N) {
      paint(merges[id - N].a, c);
      paint(merges[id - N].b, c);
    }
  };
  for (let i = merges.length - 1; i >= 0; i--) {
    const m = merges[i];
    if (m.h > cut) for (const ch of [m.a, m.b]) if ((ch < N || merges[ch - N].h <= cut) && color[ch] < 0) paint(ch, nc++ % CLS.length);
  }
  const sw = clamp(Math.min(w, h) * 0.014, 1, 2);
  const parts: Part[] = [];
  const byColor = new Map<number, Cmd[]>();
  merges.forEach((m, i) => {
    const c = m.h > cut ? -1 : color[N + i];
    const cmds = byColor.get(c) ?? [];
    cmds.push(['M', X[m.a], Yn[m.a]], ['L', X[m.a], Yn[N + i]], ['L', X[m.b], Yn[N + i]], ['L', X[m.b], Yn[m.b]]);
    byColor.set(c, cmds);
  });
  for (const [c, cmds] of byColor) parts.push(line(cmds, c < 0 ? INK : CLS[c].stroke, sw));
  if (flag(n, 'cut')) {
    const yc = Yh(cut);
    const dl = clamp(Math.min(w, h) * 0.035, 2.5, 5);
    const d: Cmd[] = [];
    for (let px = x; px < x + w; px += dl * 1.7) d.push(...seg([px, yc], [Math.min(px + dl, x + w), yc]));
    parts.push(line(d, '#C0392B', 1));
  }
  const lr = clamp(Math.min(w / N, h) * 0.16, 1.2, 3);
  order.forEach((leaf) => parts.push(disc(X[leaf], base + lr * 1.6, lr, color[leaf] < 0 ? '#999999' : CLS[color[leaf]].stroke)));
  return parts;
}

// ---------------------------------------------------------------- foresta (random forest)

type TNode = 0 | 1 | [TNode, TNode];
const TREES: { t: TNode; path: number[] }[] = [
  { t: [[0, 1], [1, [0, 1]]], path: [1, 0] },
  { t: [[0, [1, 0]], 1], path: [0, 1, 0] },
  { t: [0, [[0, 1], 1]], path: [0] },
  { t: [[[1, 0], 0], [0, 1]], path: [1, 1] },
  { t: [[1, 0], [[0, 1], 0]], path: [1, 0, 1] },
  { t: [[0, 1], [1, 0]], path: [0, 1] },
];

const leaves = (t: TNode): number => (Array.isArray(t) ? leaves(t[0]) + leaves(t[1]) : 1);

function forest(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const T = clamp(Math.round(n.count), 1, 6);
  const first = clamp(parseInt(n.spec, 10) || 1, 1, TREES.length) - 1;
  const trees = Array.from({ length: T }, (_, i) => TREES[(first + i) % TREES.length]);
  const slot = w / T;
  const depth = 3;
  const maxLeaves = Math.max(...trees.map((d) => leaves(d.t)));
  const r = clamp(Math.min((slot * 0.94) / maxLeaves, h / (depth + 1)) * 0.38, 1.8, 7);
  const edges: Part[] = [], nodes: Part[] = [];
  const fill = n.fill === 'none' ? '#FFFFFF' : n.fill;
  const ink = n.stroke === 'none' ? '#666666' : n.stroke;
  trees.forEach((d, ti) => {
    const sx = x + ti * slot + slot * 0.03, sw = slot * 0.94;
    let li = 0;
    const L = leaves(d.t);
    const place = (t: TNode, lvl: number, onPath: boolean, path: number[]): P2 => {
      const py = y + r + ((h - 2 * r) * lvl) / depth;
      if (!Array.isArray(t)) {
        const px = sx + (sw * (li++ + 0.5)) / L;
        const c = CLS[t];
        nodes.push({ kind: 'ellipse', cx: px, cy: py, rx: r, ry: r, fill: c.fill, stroke: onPath ? INK : c.stroke, sw: onPath ? 1.6 : n.strokeWidth * 0.8, solid: true });
        return [px, py];
      }
      const kids = t.map((c, i) => place(c, lvl + 1, onPath && path[0] === i, onPath && path[0] === i ? path.slice(1) : []));
      const px = (kids[0][0] + kids[1][0]) / 2;
      kids.forEach((k, i) => {
        const hot = onPath && path[0] === i;
        edges.push(line(seg([px, py], k), hot ? INK : ink, hot ? 1.7 : n.strokeWidth * 0.7));
      });
      nodes.push({ kind: 'ellipse', cx: px, cy: py, rx: r, ry: r, fill: onPath ? shade(fill, -0.18) : fill, stroke: onPath ? INK : ink, sw: onPath ? 1.4 : n.strokeWidth * 0.8, solid: true });
      return [px, py];
    };
    place(d.t, 0, true, d.path);
  });
  return [...edges, ...nodes];
}

// ---------------------------------------------------------------- importanza delle feature

function importance(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const k = clamp(Math.round(n.count), 2, 14);
  const rand = rng(900 + k);
  const raw = Array.from({ length: k }, (_, i) => Math.exp(-0.42 * i) * (0.86 + 0.14 * rand())).sort((a, b) => b - a);
  const vals = raw.map((v) => v / raw[0]);
  const slot = h / k, bh = slot * 0.64;
  const maxW = w * 0.86;
  const parts: Part[] = [];
  const err: Cmd[] = [];
  vals.forEach((v, i) => {
    const cy = y + i * slot + slot / 2;
    parts.push({ kind: 'rect', x, y: cy - bh / 2, w: maxW * v, h: bh, r: 0, fill: n.fill, sw: n.strokeWidth * 0.8 });
    const e = maxW * (0.03 + 0.07 * v);
    const a = x + maxW * v - e, b = x + maxW * v + e;
    err.push(...seg([a, cy], [b, cy]), ...seg([a, cy - bh * 0.25], [a, cy + bh * 0.25]), ...seg([b, cy - bh * 0.25], [b, cy + bh * 0.25]));
  });
  parts.push(line(err, INK, 0.8));
  parts.push(line(seg([x, y], [x, y + h]), n.stroke === 'none' ? INK : n.stroke, n.strokeWidth));
  return parts;
}

// ---------------------------------------------------------------- scree plot (varianza spiegata)

function scree(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const k = clamp(Math.round(n.count), 2, 14);
  const raw = Array.from({ length: k }, (_, i) => Math.exp(-0.62 * i));
  const tot = raw.reduce((a, b) => a + b, 0) * 1.04;
  const ratio = raw.map((v) => v / tot);
  const slot = w / k;
  const base = y + h;
  const H = h * 0.96;
  const parts: Part[] = [line([['M', x, y], ['L', x, base], ['L', x + w, base]], AXIS, 0.9)];
  ratio.forEach((v, i) => parts.push({ kind: 'rect', x: x + slot * (i + 0.18), y: base - H * v, w: slot * 0.64, h: H * v, r: 0, fill: n.fill, sw: n.strokeWidth * 0.8 }));
  let acc = 0;
  const cum: P2[] = ratio.map((v, i) => {
    acc += v;
    return [x + slot * (i + 0.5), base - H * acc];
  });
  const r = clamp(Math.min(slot, h) * 0.08, 1.5, 3.5);
  parts.push(line(poly(cum, false), '#C0392B', clamp(Math.min(w, h) * 0.014, 1, 2)));
  for (const q of cum) parts.push(marker('o', q[0], q[1], r, { fill: '#FFFFFF', stroke: '#C0392B' }, 1.1));
  return parts;
}

export const BLOCK_SHAPES: ShapeDef[] = [
  {
    kind: 'ml-table', name: 'Tabella dati', parts: table, specLabel: 'Righe x colonne',
    specOptions: [
      { title: 'Dimensioni', mode: 'value', choices: ['3x3', '4x3', '5x4', '5x5', '6x6', '8x6'] },
      { mode: 'many', choices: [{ value: 'y', label: 'Colonna target y' }, { value: 'plain', label: 'Senza nomi' }] },
    ],
  },
  {
    kind: 'ml-kfold', name: 'K-fold', parts: kfold, countLabel: 'Fold (k)', countMax: 10, specLabel: 'Varianti',
    specOptions: [{ mode: 'many', choices: [{ value: 'test', label: 'Test finale' }, { value: 'time', label: 'Serie temporale' }, { value: 'plain', label: 'Senza testo' }] }],
  },
  {
    kind: 'ml-split', name: 'Train / val / test', parts: split, specLabel: 'Proporzioni',
    specOptions: [{ title: 'Proporzioni', mode: 'value', choices: [{ value: '70,15,15', label: '70/15/15' }, { value: '80,10,10', label: '80/10/10' }, { value: '60,20,20', label: '60/20/20' }, { value: '80,20', label: '80/20' }, { value: '70,30', label: '70/30' }] }, PLAIN],
  },
  {
    kind: 'ml-dendrogram', name: 'Dendrogramma', parts: dendrogram, countLabel: 'Foglie', countMax: 24, specLabel: 'Varianti',
    specOptions: [{ mode: 'many', choices: [{ value: 'cut', label: 'Linea di taglio' }] }],
  },
  {
    kind: 'ml-forest', name: 'Foresta di alberi', parts: forest, countLabel: 'Alberi', countMax: 6, specLabel: 'Primo albero',
    specOptions: [{ title: 'Primo albero', mode: 'value', choices: ['1', '2', '3', '4', '5', '6'] }],
  },
  { kind: 'ml-importance', name: 'Importanza feature', parts: importance, countLabel: 'Feature', countMax: 14 },
  { kind: 'ml-scree', name: 'Scree plot (PCA)', parts: scree, countLabel: 'Componenti', countMax: 14 },
];
