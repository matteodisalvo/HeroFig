import { isContainer, type EdgeModel, type FontFamily, type NodeModel, type Side, type Doc, FONT_CSS } from './model';
import { iconParts } from './icons';
import { getShape } from './registry';
import { approxWidth, layoutLine, lineHeight, needsLayout } from './mathlayout';
import { plainText } from './richtext';
import { generatedAssetParts } from './generated-assets';

export interface Pt {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Cmd =
  | ['M', number, number]
  | ['L', number, number]
  | ['C', number, number, number, number, number, number]
  | ['Z'];

/** Primitive di disegno condivise da SVG e TikZ, così i due export coincidono. */
export type Part = (
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number; fill: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string }
  | { kind: 'path'; cmds: Cmd[]; fill: string }
  /** Testo dentro una forma (y = centro verticale); accetta formule fra $…$. `fill` è il colore. */
  | { kind: 'text'; x: number; y: number; text: string; size: number; fill: string; anchor?: Anchor; bold?: boolean; italic?: boolean }
  /** Immagine raster (data URL) che riempie il riquadro, ritagliata ai bordi. */
  | { kind: 'image'; x: number; y: number; w: number; h: number; href: string; ratio: number; fill: string; fit?: 'cover' | 'contain' }
) &
  PartStyle;

/** Varianti rispetto allo stile del blocco: colore/spessore del tratto, mai tratteggiato. */
export interface PartStyle {
  stroke?: string;
  sw?: number;
  solid?: boolean;
  /** Ritaglia la primitiva a questo rettangolo (illustrazioni dentro una cornice). */
  clip?: ClipRect;
}

export interface ClipRect extends Rect {
  r: number;
}

const K = 0.5523; // costante per approssimare un quarto di ellisse con una Bézier
const STACK_D = 6;

const DIR: Record<Side, Pt> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

// ---------- colori ----------

export function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const ch = (c: number) => Math.round(c + (target - c) * t);
  const r = ch((v >> 16) & 255);
  const g = ch((v >> 8) & 255);
  const b = ch(v & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
}

// ---------- forme ----------

export const poly = (pts: [number, number][], close = true): Cmd[] => {
  const cmds: Cmd[] = pts.map(([x, y], i) => (i === 0 ? ['M', x, y] : ['L', x, y]));
  if (close) cmds.push(['Z']);
  return cmds;
};

/**
 * Poligono con angoli arrotondati di raggio `r` (limitato a metà dei lati adiacenti).
 * Ogni raccordo è una quadratica con controllo nel vertice, scritta come cubica equivalente.
 */
export function roundPoly(pts: [number, number][], r: number): Cmd[] {
  if (r <= 0.5) return poly(pts);
  const n = pts.length;
  const cmds: Cmd[] = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[i];
    const [ax, ay] = pts[(i - 1 + n) % n];
    const [bx, by] = pts[(i + 1) % n];
    const la = Math.hypot(ax - px, ay - py) || 1;
    const lb = Math.hypot(bx - px, by - py) || 1;
    const rr = Math.min(r, la / 2, lb / 2);
    const s1: [number, number] = [px + ((ax - px) / la) * rr, py + ((ay - py) / la) * rr];
    const s2: [number, number] = [px + ((bx - px) / lb) * rr, py + ((by - py) / lb) * rr];
    cmds.push(i === 0 ? ['M', s1[0], s1[1]] : ['L', s1[0], s1[1]]);
    cmds.push([
      'C',
      s1[0] + ((px - s1[0]) * 2) / 3, s1[1] + ((py - s1[1]) * 2) / 3,
      s2[0] + ((px - s2[0]) * 2) / 3, s2[1] + ((py - s2[1]) * 2) / 3,
      s2[0], s2[1],
    ]);
  }
  cmds.push(['Z']);
  return cmds;
}

const cuboidDepth = (n: NodeModel) => Math.round(Math.min(n.w, n.h) * Math.min(0.9, Math.max(0.05, n.depth)));
const stackDepth = (n: NodeModel) => (Math.max(1, n.count) - 1) * STACK_D;
const cylinderRy = (n: NodeModel) => Math.min(n.h * 0.15, 14);

function trapezoidPoints(n: NodeModel): [number, number][] {
  const { x, y, w, h } = n;
  switch (n.direction) {
    case 'right': {
      const i = h * 0.2;
      return [[x, y], [x + w, y + i], [x + w, y + h - i], [x, y + h]];
    }
    case 'left': {
      const i = h * 0.2;
      return [[x, y + i], [x + w, y], [x + w, y + h], [x, y + h - i]];
    }
    case 'top': {
      const i = w * 0.2;
      return [[x + i, y], [x + w - i, y], [x + w, y + h], [x, y + h]];
    }
    case 'bottom': {
      const i = w * 0.2;
      return [[x, y], [x + w, y], [x + w - i, y + h], [x + i, y + h]];
    }
  }
}

/** Sistema locale con la "punta" verso destra, ruotato secondo `direction`. */
export function orient(n: NodeModel): { W: number; H: number; at: (u: number, v: number) => [number, number] } {
  const { x, y, w, h } = n;
  switch (n.direction) {
    case 'right': return { W: w, H: h, at: (u, v) => [x + u, y + v] };
    case 'left': return { W: w, H: h, at: (u, v) => [x + w - u, y + v] };
    case 'bottom': return { W: h, H: w, at: (u, v) => [x + v, y + u] };
    case 'top': return { W: h, H: w, at: (u, v) => [x + v, y + h - u] };
  }
}

/** Generatore pseudo-casuale deterministico: l'aspetto di heatmap e istogrammi resta stabile. */
export function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseGrid(spec: string, fallback: number): [number, number] {
  const m = /(\d+)\s*[x×,]\s*(\d+)/i.exec(spec);
  const clamp = (v: number) => Math.min(24, Math.max(1, v));
  return m ? [clamp(+m[1]), clamp(+m[2])] : [fallback, fallback];
}

export function parseLayers(spec: string): number[] {
  const layers = spec
    .split(/[,\s]+/)
    .map((v) => parseInt(v, 10))
    .filter((v) => v > 0)
    .map((v) => Math.min(10, v))
    .slice(0, 8);
  return layers.length >= 2 ? layers : [3, 4, 2];
}

const PLOTS: Record<string, { centered: boolean; left?: boolean; f: (t: number) => number }> = {
  // curve di addestramento: asse y a sinistra, u = (t + 1) / 2 fa da "tempo"
  loss: { centered: false, left: true, f: (t) => 0.06 + 0.86 * Math.exp(-2.2 * (t + 1)) + 0.035 * Math.sin(22 * t) * Math.exp(-(t + 1)) },
  cosine: { centered: false, left: true, f: (t) => 0.45 * (1 + Math.cos((Math.PI * (t + 1)) / 2)) },
  warmup: {
    centered: false,
    left: true,
    f: (t) => {
      const u = (t + 1) / 2;
      return u < 0.15 ? (u / 0.15) * 0.9 : 0.45 * (1 + Math.cos((Math.PI * (u - 0.15)) / 0.85));
    },
  },
  relu: { centered: false, f: (t) => Math.max(0, t) * 0.9 },
  sigmoid: { centered: false, f: (t) => 1 / (1 + Math.exp(-6 * t)) },
  gauss: { centered: false, f: (t) => Math.exp(-4.5 * t * t) * 0.92 },
  tanh: { centered: true, f: (t) => Math.tanh(3 * t) },
  step: { centered: true, f: (t) => (t < 0 ? -0.8 : 0.8) },
  sine: { centered: true, f: (t) => Math.sin(Math.PI * 2 * t) * 0.8 },
  linear: { centered: true, f: (t) => t * 0.9 },
};

const GRAPH_NODES: [number, number][] = [[0.12, 0.3], [0.5, 0.1], [0.88, 0.34], [0.26, 0.86], [0.74, 0.88], [0.5, 0.5]];
const GRAPH_EDGES: [number, number][] = [[0, 1], [1, 2], [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [3, 4], [2, 4], [0, 3]];

const FLAME_OUTER: number[][] = [
  [0.5, 0],
  [0.56, 0.25, 0.92, 0.4, 0.92, 0.68],
  [0.92, 0.87, 0.73, 1, 0.5, 1],
  [0.27, 1, 0.08, 0.87, 0.08, 0.68],
  [0.08, 0.5, 0.2, 0.42, 0.28, 0.28],
  [0.31, 0.4, 0.37, 0.46, 0.45, 0.46],
  [0.41, 0.3, 0.42, 0.15, 0.5, 0],
];
const FLAME_INNER: number[][] = [
  [0.5, 0.56],
  [0.6, 0.68, 0.7, 0.76, 0.7, 0.85],
  [0.7, 0.94, 0.61, 1, 0.5, 1],
  [0.39, 1, 0.3, 0.94, 0.3, 0.85],
  [0.3, 0.76, 0.4, 0.68, 0.5, 0.56],
];

function unitPath(n: NodeModel, rows: number[][]): Cmd[] {
  const X = (u: number) => n.x + u * n.w;
  const Y = (v: number) => n.y + v * n.h;
  const cmds: Cmd[] = rows.map((r) =>
    r.length === 2 ? ['M', X(r[0]), Y(r[1])] : ['C', X(r[0]), Y(r[1]), X(r[2]), Y(r[3]), X(r[4]), Y(r[5])],
  );
  cmds.push(['Z']);
  return cmds;
}

export function shapeParts(n: NodeModel): Part[] {
  const generated = generatedAssetParts(n);
  if (generated) return generated;
  const custom = getShape(n.shape);
  if (custom) return custom.parts(n);
  const { x, y, w, h, fill } = n;
  switch (n.shape) {
    case 'text':
      return [];
    case 'line':
      // a metà altezza da un capo all'altro: il riquadro resta per prenderla, la rotazione la inclina
      return [{ kind: 'path', fill: 'none', cmds: [['M', x, y + h / 2], ['L', x + w, y + h / 2]] }];
    case 'rect':
    case 'group':
      return [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill }];
    case 'ellipse':
      return [{ kind: 'ellipse', cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, fill }];
    case 'pill':
      return [{ kind: 'rect', x, y, w, h, r: Math.min(w, h) / 2, fill }];
    case 'hexagon': {
      const i = Math.min(w * 0.22, h / 2);
      return [{ kind: 'path', fill, cmds: roundPoly([[x + i, y], [x + w - i, y], [x + w, y + h / 2], [x + w - i, y + h], [x + i, y + h], [x, y + h / 2]], n.radius) }];
    }
    case 'parallelogram': {
      const i = Math.min(w * 0.2, h * 0.5);
      return [{ kind: 'path', fill, cmds: roundPoly([[x + i, y], [x + w, y], [x + w - i, y + h], [x, y + h]], n.radius) }];
    }
    case 'triangle': {
      const o = orient(n);
      return [{ kind: 'path', fill, cmds: roundPoly([o.at(0, 0), o.at(o.W, o.H / 2), o.at(0, o.H)], n.radius) }];
    }
    case 'blockarrow': {
      const o = orient(n);
      const hl = Math.min(o.W * 0.45, o.H * 0.7);
      const a = o.H * 0.25;
      return [
        {
          kind: 'path',
          fill,
          cmds: poly([
            o.at(0, a), o.at(o.W - hl, a), o.at(o.W - hl, 0), o.at(o.W, o.H / 2),
            o.at(o.W - hl, o.H), o.at(o.W - hl, o.H - a), o.at(0, o.H - a),
          ]),
        },
      ];
    }
    case 'brace': {
      const o = orient(n);
      const m = o.W / 2;
      const q = Math.min(o.W, o.H / 4);
      const c = (a: [number, number], b: [number, number], e: [number, number]): Cmd => ['C', ...a, ...b, ...e];
      return [
        {
          kind: 'path',
          fill: 'none',
          solid: true,
          cmds: [
            ['M', ...o.at(0, 0)],
            c(o.at(m, 0), o.at(m, 0), o.at(m, q)),
            ['L', ...o.at(m, o.H / 2 - q)],
            c(o.at(m, o.H / 2), o.at(m, o.H / 2), o.at(o.W, o.H / 2)),
            c(o.at(m, o.H / 2), o.at(m, o.H / 2), o.at(m, o.H / 2 + q)),
            ['L', ...o.at(m, o.H - q)],
            c(o.at(m, o.H), o.at(m, o.H), o.at(0, o.H)),
          ],
        },
      ];
    }
    case 'grid': {
      const [rows, cols] = parseGrid(n.spec, 4);
      const lines: Cmd[] = [];
      for (let i = 1; i < cols; i++) lines.push(['M', x + (w * i) / cols, y], ['L', x + (w * i) / cols, y + h]);
      for (let j = 1; j < rows; j++) lines.push(['M', x, y + (h * j) / rows], ['L', x + w, y + (h * j) / rows]);
      const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill }];
      if (lines.length) parts.push({ kind: 'path', fill: 'none', cmds: lines, sw: n.strokeWidth * 0.6, solid: true });
      return parts;
    }
    case 'heatmap': {
      const [rows, cols] = parseGrid(n.spec, 6);
      const base = n.stroke === 'none' ? '#666666' : n.stroke;
      const rand = rng(rows * 31 + cols);
      const parts: Part[] = [];
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const t = rand();
          parts.push({
            kind: 'rect', x: x + (w * i) / cols, y: y + (h * j) / rows, w: w / cols, h: h / rows, r: 0,
            fill: shade(base, 0.95 - 0.9 * t * t), stroke: 'none',
          });
        }
      }
      parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
      return parts;
    }
    case 'patches': {
      const [rows, cols] = parseGrid(n.spec, 3);
      const gap = Math.min(5, w / cols / 4, h / rows / 4);
      const cw = (w - gap * (cols - 1)) / cols;
      const ch = (h - gap * (rows - 1)) / rows;
      const parts: Part[] = [];
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++)
          parts.push({ kind: 'rect', x: x + i * (cw + gap), y: y + j * (ch + gap), w: cw, h: ch, r: 1.5, fill, sw: n.strokeWidth * 0.8 });
      return parts;
    }
    case 'image': {
      const ink = n.stroke === 'none' ? '#888888' : shade(n.stroke, 0.25);
      const sun = Math.min(w, h) * 0.09;
      return [
        { kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill },
        { kind: 'ellipse', cx: x + w * 0.72, cy: y + h * 0.28, rx: sun, ry: sun, fill: ink, stroke: 'none' },
        {
          kind: 'path', fill: ink, stroke: 'none',
          cmds: poly([[x + w * 0.1, y + h * 0.86], [x + w * 0.37, y + h * 0.42], [x + w * 0.54, y + h * 0.68], [x + w * 0.67, y + h * 0.52], [x + w * 0.9, y + h * 0.86]]),
        },
      ];
    }
    case 'document': {
      const c = Math.min(w, h) * 0.28;
      const ink = n.stroke === 'none' ? '#999999' : shade(n.stroke, 0.45);
      const lines: Cmd[] = [];
      const top = y + c + h * 0.08;
      const count = Math.max(2, Math.min(6, Math.floor((y + h * 0.9 - top) / 9)));
      for (let i = 0; i < count; i++) {
        const ly = top + ((y + h * 0.88 - top) * i) / (count - 1);
        lines.push(['M', x + w * 0.16, ly], ['L', x + w * (i === count - 1 ? 0.6 : 0.84), ly]);
      }
      return [
        { kind: 'path', fill, cmds: poly([[x, y], [x + w - c, y], [x + w, y + c], [x + w, y + h], [x, y + h]]) },
        { kind: 'path', fill: fill === 'none' ? 'none' : shade(fill, -0.1), cmds: poly([[x + w - c, y], [x + w - c, y + c], [x + w, y + c]]) },
        { kind: 'path', fill: 'none', cmds: lines, stroke: ink, sw: n.strokeWidth * 0.8, solid: true },
      ];
    }
    case 'waveform': {
      const N = 64;
      const pts: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const env = Math.sin(Math.PI * t) ** 1.5 * (0.55 + 0.45 * Math.sin(t * 9 + 1));
        pts.push([x + w * t, y + h / 2 - (h / 2) * env * Math.sin(t * 46)]);
      }
      return [{ kind: 'path', fill: 'none', cmds: poly(pts, false), solid: true }];
    }
    case 'neurons': {
      const count = Math.max(1, n.count);
      const vertical = h >= w;
      const r = (vertical ? Math.min(w, h / count) : Math.min(h, w / count)) * 0.42;
      return Array.from({ length: count }, (_, i): Part => {
        const t = (i + 0.5) / count;
        return { kind: 'ellipse', cx: vertical ? x + w / 2 : x + w * t, cy: vertical ? y + h * t : y + h / 2, rx: r, ry: r, fill };
      });
    }
    case 'mlp': {
      const layers = parseLayers(n.spec);
      const maxN = Math.max(...layers);
      const r = Math.min(h / maxN, w / layers.length) * 0.32;
      const pos = layers.map((cnt, j) =>
        Array.from({ length: cnt }, (_, i): [number, number] => [
          x + r + ((w - 2 * r) * j) / (layers.length - 1),
          y + h / 2 + (i - (cnt - 1) / 2) * (h / maxN),
        ]),
      );
      const lines: Cmd[] = [];
      for (let j = 1; j < pos.length; j++)
        for (const a of pos[j - 1]) for (const b of pos[j]) lines.push(['M', a[0], a[1]], ['L', b[0], b[1]]);
      const link = n.stroke === 'none' ? '#999999' : shade(n.stroke, 0.3);
      return [
        { kind: 'path', fill: 'none', cmds: lines, stroke: link, sw: Math.max(0.4, n.strokeWidth * 0.4), solid: true },
        ...pos.flat().map(([cx, cy]): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill })),
      ];
    }
    case 'graph': {
      const r = Math.min(w, h) * 0.09;
      const P = GRAPH_NODES.map(([u, v]): [number, number] => [x + r + (w - 2 * r) * u, y + r + (h - 2 * r) * v]);
      const lines: Cmd[] = GRAPH_EDGES.flatMap(([a, b]): Cmd[] => [['M', P[a][0], P[a][1]], ['L', P[b][0], P[b][1]]]);
      return [
        { kind: 'path', fill: 'none', cmds: lines, sw: n.strokeWidth * 0.8, solid: true },
        ...P.map(([cx, cy]): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill })),
      ];
    }
    case 'plot': {
      const plot = PLOTS[n.spec] ?? PLOTS.relu;
      const px = w * 0.16;
      const py = h * 0.18;
      const baseY = plot.centered ? y + h / 2 : y + h - py;
      const amp = plot.centered ? h / 2 - py : h - 2 * py;
      const N = 40;
      const axisX = plot.left ? x + px * 0.75 : x + w / 2;
      const pts: [number, number][] = [];
      if (n.spec === 'step') {
        pts.push([x + px, baseY + amp * 0.8], [x + w / 2, baseY + amp * 0.8], [x + w / 2, baseY - amp * 0.8], [x + w - px, baseY - amp * 0.8]);
      } else {
        for (let i = 0; i <= N; i++) {
          const t = -1 + (2 * i) / N;
          pts.push([x + px + ((w - 2 * px) * i) / N, baseY - amp * plot.f(t)]);
        }
      }
      return [
        { kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill },
        {
          kind: 'path', fill: 'none', stroke: '#9AA0A6', sw: 0.8, solid: true,
          cmds: [['M', x + px * 0.6, baseY], ['L', x + w - px * 0.6, baseY], ['M', axisX, y + py * 0.6], ['L', axisX, y + h - py * 0.6]],
        },
        { kind: 'path', fill: 'none', cmds: poly(pts, false), sw: n.strokeWidth * 1.3, solid: true },
      ];
    }
    case 'barchart': {
      const count = Math.max(1, n.count);
      const rand = rng(count * 7 + 3);
      const bw = w / count;
      const parts: Part[] = [];
      const peak = Math.floor(rand() * count);
      for (let i = 0; i < count; i++) {
        const v = i === peak ? 1 : 0.12 + rand() * 0.5;
        parts.push({ kind: 'rect', x: x + bw * (i + 0.15), y: y + h * (1 - v), w: bw * 0.7, h: h * v, r: 0, fill, sw: n.strokeWidth * 0.8 });
      }
      parts.push({ kind: 'path', fill: 'none', cmds: [['M', x, y + h], ['L', x + w, y + h]], solid: true });
      return parts;
    }
    case 'snowflake': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const R = Math.min(w, h) / 2;
      const cmds: Cmd[] = [];
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        const ux = Math.cos(a), uy = Math.sin(a);
        cmds.push(['M', cx, cy], ['L', cx + ux * R, cy + uy * R]);
        for (const s of [-1, 1]) {
          const b = a + (s * Math.PI) / 3;
          const bx = cx + ux * R * 0.58, by = cy + uy * R * 0.58;
          cmds.push(['M', bx, by], ['L', bx + Math.cos(b) * R * 0.3, by + Math.sin(b) * R * 0.3]);
        }
      }
      return [{ kind: 'path', fill: 'none', cmds, solid: true }];
    }
    case 'flame':
      return [
        { kind: 'path', fill, cmds: unitPath(n, FLAME_OUTER), solid: true },
        { kind: 'path', fill: fill === 'none' ? 'none' : shade(fill, 0.55), cmds: unitPath(n, FLAME_INNER), stroke: 'none' },
      ];
    default:
      return iconParts(n);
    case 'diamond':
      return [{ kind: 'path', fill, cmds: roundPoly([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]], n.radius) }];
    case 'trapezoid':
      return [{ kind: 'path', fill, cmds: roundPoly(trapezoidPoints(n), n.radius) }];
    case 'stack': {
      const count = Math.max(1, n.count);
      const d = stackDepth(n);
      const parts: Part[] = [];
      for (let i = count - 1; i >= 0; i--) {
        parts.push({ kind: 'rect', x: x + i * STACK_D, y: y + d - i * STACK_D, w: w - d, h: h - d, r: 0, fill });
      }
      return parts;
    }
    case 'cuboid': {
      const d = cuboidDepth(n);
      const light = fill === 'none' ? 'none' : shade(fill, 0.45);
      const dark = fill === 'none' ? 'none' : shade(fill, -0.12);
      return [
        { kind: 'path', fill: light, cmds: poly([[x, y + d], [x + d, y], [x + w, y], [x + w - d, y + d]]) },
        { kind: 'path', fill: dark, cmds: poly([[x + w - d, y + d], [x + w, y], [x + w, y + h - d], [x + w - d, y + h]]) },
        { kind: 'rect', x, y: y + d, w: w - d, h: h - d, r: 0, fill },
      ];
    }
    case 'cylinder': {
      const ry = cylinderRy(n);
      const rx = w / 2;
      const cx = x + rx;
      const top = y + ry;
      const bot = y + h - ry;
      const body: Cmd[] = [
        ['M', x, top],
        ['L', x, bot],
        ['C', x, bot + K * ry, cx - K * rx, bot + ry, cx, bot + ry],
        ['C', cx + K * rx, bot + ry, x + w, bot + K * ry, x + w, bot],
        ['L', x + w, top],
        ['C', x + w, top - K * ry, cx + K * rx, top - ry, cx, top - ry],
        ['C', cx - K * rx, top - ry, x, top - K * ry, x, top],
        ['Z'],
      ];
      const rim: Cmd[] = [
        ['M', x, top],
        ['C', x, top + K * ry, cx - K * rx, top + ry, cx, top + ry],
        ['C', cx + K * rx, top + ry, x + w, top + K * ry, x + w, top],
      ];
      return [
        { kind: 'path', fill, cmds: body },
        { kind: 'path', fill: 'none', cmds: rim },
      ];
    }
    case 'cells': {
      const count = Math.max(1, n.count);
      const lines: Cmd[] = [];
      for (let i = 1; i < count; i++) {
        if (w >= h) {
          const cx = x + (w * i) / count;
          lines.push(['M', cx, y], ['L', cx, y + h]);
        } else {
          const cy = y + (h * i) / count;
          lines.push(['M', x, cy], ['L', x + w, cy]);
        }
      }
      const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill }];
      if (lines.length) parts.push({ kind: 'path', fill: 'none', cmds: lines });
      return parts;
    }
  }
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function cmdsToD(cmds: Cmd[]): string {
  return cmds.map((c) => (c.length === 1 ? 'Z' : c[0] + c.slice(1).map((v) => r2(v as number)).join(' '))).join(' ');
}

// ---------- etichette ----------

export type Anchor = 'middle' | 'start' | 'end';

export interface LabelLayout {
  x: number;
  y: number; // centro verticale del blocco di testo
  anchor: Anchor;
}

/** Un blocco di testo pronto da disegnare (SVG o TikZ). */
export interface TextBlock {
  text: string;
  x: number;
  y: number; // centro verticale
  anchor: Anchor;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: string;
  halo?: boolean;
}

const SUB_GAP = 3;
/** Altezza di un'etichetta: le righe con frazioni o limiti sono più alte. */
const linesH = (text: string, size: number) =>
  text ? text.split('\n').reduce((h, line) => h + lineHeight(line, size), 0) : 0;

/** Altezza complessiva di etichetta + sottotitolo. */
function labelHeight(n: NodeModel): number {
  const main = linesH(n.label, n.fontSize);
  const sub = linesH(n.sublabel, n.subSize);
  return main + sub + (main && sub ? SUB_GAP : 0);
}

export function labelBlocks(n: NodeModel): TextBlock[] {
  if (!n.label && !n.sublabel) return [];
  const l = labelLayout(n);
  const mainH = linesH(n.label, n.fontSize);
  const subH = linesH(n.sublabel, n.subSize);
  const top = l.y - labelHeight(n) / 2;
  const blocks: TextBlock[] = [];
  if (n.label) {
    blocks.push({ text: n.label, x: l.x, y: top + mainH / 2, anchor: l.anchor, fontSize: n.fontSize, bold: n.bold, italic: n.italic, color: n.textColor });
  }
  if (n.sublabel) {
    blocks.push({
      text: n.sublabel,
      x: l.x,
      y: top + mainH + (mainH ? SUB_GAP : 0) + subH / 2,
      anchor: l.anchor,
      fontSize: n.subSize,
      bold: false,
      italic: false,
      color: shade(n.textColor, 0.3),
    });
  }
  return blocks;
}

export function labelLayout(n: NodeModel): LabelLayout {
  const blockH = labelHeight(n);
  if (n.shape === 'trapezoid' && n.container) {
    // titolo centrato in alto, sotto il lato superiore (obliquo se il trapezio è orizzontale)
    const slope = n.direction === 'left' || n.direction === 'right' ? n.h * 0.1 : 0;
    return { x: n.x + n.w / 2, y: n.y + slope + 9 + blockH / 2, anchor: 'middle' };
  }
  if (isContainer(n)) return { x: n.x + 10, y: n.y + 7 + blockH / 2, anchor: 'start' };
  const cx = n.x + n.w / 2;
  if (n.labelPos === 'center' && n.align !== 'center' && !['stack', 'cuboid', 'triangle'].includes(n.shape)) {
    const pad = n.shape === 'text' ? 0 : 8;
    return n.align === 'left'
      ? { x: n.x + pad, y: n.y + n.h / 2, anchor: 'start' }
      : { x: n.x + n.w - pad, y: n.y + n.h / 2, anchor: 'end' };
  }
  if (n.labelPos === 'center') {
    const custom = getShape(n.shape)?.label?.(n);
    if (custom) return custom;
  }
  if (n.labelPos === 'above') return { x: cx, y: n.y - 5 - blockH / 2, anchor: 'middle' };
  if (n.labelPos === 'below') return { x: cx, y: n.y + n.h + 5 + blockH / 2, anchor: 'middle' };
  switch (n.shape) {
    case 'stack': {
      const d = stackDepth(n);
      return { x: n.x + (n.w - d) / 2, y: n.y + d + (n.h - d) / 2, anchor: 'middle' };
    }
    case 'cuboid': {
      const d = cuboidDepth(n);
      return { x: n.x + (n.w - d) / 2, y: n.y + d + (n.h - d) / 2, anchor: 'middle' };
    }
    case 'cylinder':
      return { x: cx, y: n.y + n.h / 2 + cylinderRy(n) / 2, anchor: 'middle' };
    case 'bubble':
      return { x: cx, y: n.y + n.h * 0.39, anchor: 'middle' };
    case 'triangle': {
      // baricentro: un terzo dalla base
      const c: Record<Side, [number, number]> = { right: [1 / 3, 0.5], left: [2 / 3, 0.5], bottom: [0.5, 1 / 3], top: [0.5, 2 / 3] };
      const [u, v] = c[n.direction];
      return { x: n.x + n.w * u, y: n.y + n.h * v, anchor: 'middle' };
    }
    default:
      return { x: cx, y: n.y + n.h / 2, anchor: 'middle' };
  }
}

let ctx: CanvasRenderingContext2D | null | undefined;

export function textWidth(line: string, fontSize: number, bold: boolean, italic: boolean, family: FontFamily): number {
  if (needsLayout(line)) return layoutLine(line, fontSize, family, bold, italic).width;
  // si misura il testo visibile (le formule già composte), non il sorgente LaTeX
  const text = plainText(line);
  if (ctx === undefined) ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!ctx) return approxWidth(text, fontSize) * (bold ? 1.06 : 1);
  ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${FONT_CSS[family]}`;
  return ctx.measureText(text).width;
}

// ---------- porte e connessioni ----------

export function portPoint(n: NodeModel, side: Side): Pt {
  const { x, y, w, h } = n;
  const p: Record<Side, Pt> = {
    top: { x: x + w / 2, y },
    right: { x: x + w, y: y + h / 2 },
    bottom: { x: x + w / 2, y: y + h },
    left: { x, y: y + h / 2 },
  };
  if (n.shape === 'line') {
    // sopra e sotto si attacca alla linea stessa
    p.top.y = y + h / 2;
    p.bottom.y = y + h / 2;
  }
  if (n.shape === 'parallelogram') {
    const i = Math.min(w * 0.2, h * 0.5) / 2;
    p.left.x += i;
    p.right.x -= i;
  }
  if (n.shape === 'triangle') {
    // i lati obliqui si incontrano a metà: lì la porta rientra di un quarto
    if (n.direction === 'left' || n.direction === 'right') {
      p.top.y += h / 4;
      p.bottom.y -= h / 4;
    } else {
      p.left.x += w / 4;
      p.right.x -= w / 4;
    }
  }
  if (n.shape === 'trapezoid') {
    // sui lati obliqui la porta sta a metà pendenza
    const horizontal = n.direction === 'left' || n.direction === 'right';
    if (horizontal) {
      p.top.y += h * 0.1;
      p.bottom.y -= h * 0.1;
    } else {
      p.left.x += w * 0.1;
      p.right.x -= w * 0.1;
    }
  }
  return p[side];
}

// ---------- rotazione ----------

const SIDE_ORDER: Side[] = ['top', 'right', 'bottom', 'left'];

/** Il lato che si trova dove era `side` dopo `quarters` quarti di giro in senso orario. */
const turnSide = (side: Side, quarters: number): Side => SIDE_ORDER[(((SIDE_ORDER.indexOf(side) + quarters) % 4) + 4) % 4];

/** I gradi di rotazione del blocco (in senso orario, attorno al centro); 0 se non è ruotato. */
export const rotationOf = (n: NodeModel): number => (n.rotation && Number.isFinite(n.rotation) ? n.rotation : 0);

/** Un punto del blocco non ruotato, portato dove sta sul foglio con la rotazione (`dir` = -1: il contrario). */
export function rotatePoint(p: Pt, n: NodeModel, dir = 1): Pt {
  const r = rotationOf(n);
  if (!r) return p;
  const a = (dir * r * Math.PI) / 180;
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Il rettangolo dritto che contiene `r` (un riquadro del blocco) una volta ruotato con lui. */
export function rotatedRect(r: Rect, n: NodeModel): Rect {
  if (!rotationOf(n)) return r;
  const pts = [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ].map((p) => rotatePoint(p, n));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** L'ingombro del blocco sul foglio: il suo riquadro, o quello che lo contiene se è ruotato. */
export const nodeBox = (n: NodeModel): Rect => rotatedRect(n, n);

/** Il punto di un lato (del blocco non ruotato) dove sta sul foglio. */
export const nodePort = (n: NodeModel, side: Side): Pt => rotatePoint(portPoint(n, side), n);

/** Quanti quarti di giro fa il blocco, arrotondati: dice verso dove guarda ogni lato. */
const quarters = (n: NodeModel) => Math.round(rotationOf(n) / 90);

function autoSide(from: NodeModel, to: NodeModel): Side {
  const dx = to.x + to.w / 2 - (from.x + from.w / 2);
  const dy = to.y + to.h / 2 - (from.y + from.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

const T = (p: Pt): Pt => ({ x: p.y, y: p.x });
const STUB = 18;

/** `off` sposta il tratto centrale del percorso (trascinabile dall'utente). */
function orthoRoute(p1: Pt, d1: Pt, p2: Pt, d2: Pt, off = 0): Pt[] {
  // ci si riconduce sempre al caso "partenza orizzontale" trasponendo gli assi
  if (d1.x === 0) return orthoRoute(T(p1), T(d1), T(p2), T(d2), off).map(T);
  const a = { x: p1.x + d1.x * STUB, y: p1.y };
  const b = { x: p2.x + d2.x * STUB, y: p2.y + d2.y * STUB };
  if (d2.x !== 0) {
    // porte affacciate quasi allineate: linea dritta invece di un gradino di pochi pixel
    if (!off && d1.x === -d2.x && Math.abs(p1.y - p2.y) < 6 && (p2.x - p1.x) * d1.x > 2 * STUB) return [p1, { x: p2.x, y: p1.y }];
    if (d1.x === -d2.x) {
      if ((b.x - a.x) * d1.x >= 0) {
        const mx = (a.x + b.x) / 2 + off;
        return [p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2];
      }
      const my = (p1.y + p2.y) / 2 + off;
      return [p1, a, { x: a.x, y: my }, { x: b.x, y: my }, b, p2];
    }
    const X = (d1.x > 0 ? Math.max(a.x, b.x) : Math.min(a.x, b.x)) + off;
    return [p1, { x: X, y: p1.y }, { x: X, y: p2.y }, p2];
  }
  const okX = (p2.x - a.x) * d1.x >= 0;
  const okY = (p1.y - b.y) * d2.y >= 0;
  if (okX && okY && !off) return [p1, { x: p2.x, y: p1.y }, p2];
  if (okX && okY) return [p1, { x: p1.x + (p2.x - p1.x) / 2 + off, y: p1.y }, { x: p1.x + (p2.x - p1.x) / 2 + off, y: b.y }, { x: p2.x, y: b.y }, p2];
  return [p1, { x: a.x + off, y: p1.y }, { x: a.x + off, y: b.y }, b, p2];
}

function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (l && Math.abs(l.x - p.x) < 0.01 && Math.abs(l.y - p.y) < 0.01) continue;
    const k = out[out.length - 2];
    if (k && l && ((k.x === l.x && l.x === p.x) || (k.y === l.y && l.y === p.y))) out.pop();
    out.push(p);
  }
  return out;
}

const norm = (p: Pt): Pt => {
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / l, y: p.y / l };
};

export interface EdgeGeom {
  pts: Pt[]; // polilinea (ortho/straight) oppure [p0, c1, c2, p3] se curve
  curve: boolean;
  rounded: boolean;
  startDir: Pt; // versore che punta verso la punta iniziale
  endDir: Pt; // versore che punta verso la punta finale
  label: Pt;
  labelDir: Pt; // tangente al percorso nel punto dell'etichetta
}

export function edgeGeometry(e: EdgeModel, nodes: Map<string, NodeModel>): EdgeGeom | null {
  const a = nodes.get(e.from.node);
  const b = nodes.get(e.to.node);
  if (!a || !b) return null;
  // con un blocco ruotato: il lato scelto (del blocco) guarda altrove sul foglio; la freccia parte dal punto ruotato, nella
  // direzione verso cui ora guarda quel lato (arrotondata al quarto di giro, così i percorsi ortogonali restano a gomito)
  const s1 = e.from.side === 'auto' ? autoSide(a, b) : turnSide(e.from.side, quarters(a));
  const s2 = e.to.side === 'auto' ? autoSide(b, a) : turnSide(e.to.side, quarters(b));
  const p1 = nodePort(a, turnSide(s1, -quarters(a)));
  const p2 = nodePort(b, turnSide(s2, -quarters(b)));
  if (e.routing === 'curve') {
    const dist = Math.max(30, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.4);
    const c1 = { x: p1.x + DIR[s1].x * dist, y: p1.y + DIR[s1].y * dist };
    const c2 = { x: p2.x + DIR[s2].x * dist, y: p2.y + DIR[s2].y * dist };
    return {
      pts: [p1, c1, c2, p2],
      curve: true,
      rounded: false,
      startDir: norm({ x: p1.x - c1.x, y: p1.y - c1.y }),
      endDir: norm({ x: p2.x - c2.x, y: p2.y - c2.y }),
      label: {
        x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8,
        y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8,
      },
      labelDir: norm({ x: p2.x + c2.x - c1.x - p1.x, y: p2.y + c2.y - c1.y - p1.y }),
    };
  }
  let pts = e.routing === 'straight' ? [p1, p2] : simplify(orthoRoute(p1, DIR[s1], p2, DIR[s2], e.offset));
  if (pts.length < 2) pts = [p1, { x: p1.x + 0.01, y: p1.y }];
  const n = pts.length;
  return {
    pts,
    curve: false,
    rounded: e.routing === 'ortho',
    startDir: norm({ x: pts[0].x - pts[1].x, y: pts[0].y - pts[1].y }),
    endDir: norm({ x: pts[n - 1].x - pts[n - 2].x, y: pts[n - 1].y - pts[n - 2].y }),
    ...polyMid(pts),
  };
}

function polyMid(pts: Pt[]): { label: Pt; labelDir: Pt } {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let acc = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc <= l && l > 0) {
      const t = acc / l;
      return {
        label: { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t },
        labelDir: norm({ x: pts[i].x - pts[i - 1].x, y: pts[i].y - pts[i - 1].y }),
      };
    }
    acc -= l;
  }
  return { label: pts[0], labelDir: { x: 1, y: 0 } };
}

/** Etichetta di una connessione: sulla linea (con alone bianco), sopra o sotto di essa. */
export function edgeLabelBlock(e: EdgeModel, g: EdgeGeom): TextBlock {
  const base = { text: e.label, fontSize: e.fontSize, bold: false, italic: false, color: e.color };
  const h = linesH(e.label, e.fontSize);
  const { label: p, labelDir: d } = g;
  if (e.labelPos === 'center') return { ...base, x: p.x, y: p.y, anchor: 'middle', halo: true };
  const sign = e.labelPos === 'above' ? -1 : 1;
  if (Math.abs(d.x) >= Math.abs(d.y)) return { ...base, x: p.x, y: p.y + sign * (h / 2 + 3 + e.width), anchor: 'middle' };
  // tratto verticale: "sopra" diventa a sinistra, "sotto" a destra
  return { ...base, x: p.x + sign * (5 + e.width), y: p.y, anchor: sign < 0 ? 'end' : 'start' };
}

/** Ingombro di un blocco di testo. */
export function textBlockRect(b: TextBlock, family: FontFamily): Rect {
  const lines = b.text.split('\n');
  const w = Math.max(...lines.map((l) => textWidth(l, b.fontSize, b.bold, b.italic, family))) + (b.halo ? 6 : 0);
  // stessa altezza delle righe disegnate: le formule con frazioni o limiti sono più alte di una riga normale
  const h = linesH(b.text, b.fontSize) + (b.halo ? 4 : 0);
  const x = b.anchor === 'middle' ? b.x - w / 2 : b.anchor === 'start' ? b.x : b.x - w;
  return { x, y: b.y - h / 2, w, h };
}

export const CORNER_R = 6;
export const arrowLen = (width: number) => 7 + 2 * width;

/** Attributo `d` SVG della connessione, accorciata alle estremità per far posto alle punte. */
export function edgePathD(g: EdgeGeom, cutStart: number, cutEnd: number): string {
  const pts = g.pts.map((p) => ({ ...p }));
  const n = pts.length;
  pts[0] = { x: pts[0].x - g.startDir.x * cutStart, y: pts[0].y - g.startDir.y * cutStart };
  pts[n - 1] = { x: pts[n - 1].x - g.endDir.x * cutEnd, y: pts[n - 1].y - g.endDir.y * cutEnd };
  const f = (p: Pt) => `${r2(p.x)} ${r2(p.y)}`;
  if (g.curve) return `M${f(pts[0])} C${f(pts[1])} ${f(pts[2])} ${f(pts[3])}`;
  let d = `M${f(pts[0])}`;
  for (let i = 1; i < n - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const l1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const l2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = g.rounded ? Math.min(CORNER_R, l1 / 2, l2 / 2) : 0;
    if (r < 0.5) {
      d += ` L${f(cur)}`;
      continue;
    }
    const u = norm({ x: prev.x - cur.x, y: prev.y - cur.y });
    const v = norm({ x: next.x - cur.x, y: next.y - cur.y });
    d += ` L${f({ x: cur.x + u.x * r, y: cur.y + u.y * r })} Q${f(cur)} ${f({ x: cur.x + v.x * r, y: cur.y + v.y * r })}`;
  }
  return d + ` L${f(pts[n - 1])}`;
}

export function arrowPoints(tip: Pt, dir: Pt, len: number): string {
  const w = len * 0.4;
  const bx = tip.x - dir.x * len;
  const by = tip.y - dir.y * len;
  const pts: Pt[] = [
    tip,
    { x: bx - dir.y * w, y: by + dir.x * w },
    { x: tip.x - dir.x * len * 0.72, y: tip.y - dir.y * len * 0.72 },
    { x: bx + dir.y * w, y: by - dir.x * w },
  ];
  return pts.map((p) => `${r2(p.x)},${r2(p.y)}`).join(' ');
}

// ---------- rettangoli e ingombri ----------

export const rectContains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

export const rectsIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function unionRect(rects: Rect[]): Rect {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Ingombro complessivo del disegno, etichette e frecce comprese. */
export function docBounds(doc: Doc): Rect {
  const rects: Rect[] = [];
  const family = doc.settings.fontFamily;
  for (const n of doc.nodes) {
    const s = n.stroke === 'none' ? 0 : n.strokeWidth / 2;
    if (n.shape !== 'text') rects.push(rotatedRect({ x: n.x - s, y: n.y - s, w: n.w + 2 * s, h: n.h + 2 * s }, n));
    for (const b of labelBlocks(n)) rects.push(rotatedRect(textBlockRect(b, family), n));
  }
  const map = new Map(doc.nodes.map((n) => [n.id, n]));
  for (const e of doc.edges) {
    const g = edgeGeometry(e, map);
    if (!g) continue;
    const m = arrowLen(e.width) * 0.4 + e.width;
    for (const p of g.pts) rects.push({ x: p.x - m, y: p.y - m, w: 2 * m, h: 2 * m });
    if (e.label) rects.push(textBlockRect(edgeLabelBlock(e, g), family));
  }
  if (!rects.length) return { x: 0, y: 0, w: 200, h: 120 };
  return unionRect(rects);
}
