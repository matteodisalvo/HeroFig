// Aiuti di disegno per il modulo di machine learning classico (ml.ts): area del grafico,
// marcatori, tratteggi, ellissi ruotate, piccoli strumenti numerici. Tutto produce primitive
// `Part`, quindi le forme escono identiche in SVG, PDF, PNG e TikZ.
import { mix, poly, type ClipRect, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { SpecGroup } from '../registry';

export type P2 = [number, number];
export type Rand = () => number;

export const TAU = Math.PI * 2;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- colori ----------

export const INK = '#333333';
export const AXIS = '#9AA0A6';

/** Colori delle classi / serie: punto (fill + bordo) e tinta chiara per le regioni. */
export interface ClassColor {
  fill: string;
  stroke: string;
  tint: string;
}
export const CLS: ClassColor[] = [
  { fill: '#8FB4E3', stroke: '#3B6FB6', tint: '#E3ECF9' }, // blu
  { fill: '#F7BE85', stroke: '#C96F12', tint: '#FDECD9' }, // arancio
  { fill: '#9FD39A', stroke: '#3E8E3A', tint: '#E4F3E2' }, // verde
  { fill: '#F0A39B', stroke: '#C0392B', tint: '#FBE4E1' }, // rosso
  { fill: '#C7AEE0', stroke: '#7B52A6', tint: '#EEE6F7' }, // viola
  { fill: '#8FD3CA', stroke: '#2D8A80', tint: '#DFF2EF' }, // turchese
];
export const GRAY_PT: ClassColor = { fill: '#C4C8CE', stroke: '#6B7280', tint: '#F1F2F4' };

// ---------- primitive ----------

export const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];

type Extra = { clip?: ClipRect; stroke?: string; sw?: number };

export const line = (cmds: Cmd[], stroke: string, sw: number, extra: Extra = {}): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true, ...extra });

export const area = (cmds: Cmd[], fill: string, extra: Extra = {}): Part => ({ kind: 'path', cmds, fill, stroke: 'none', solid: true, ...extra });

export const disc = (cx: number, cy: number, r: number, fill: string, stroke: string | undefined = 'none', sw = 0.8): Part => ({
  kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true,
});

export type Marker = 'o' | 's' | '^' | 'x' | '+' | '-' | '*';

/** Marcatore di un punto: cerchio, quadrato, triangolo, croce, più, meno, stella. */
export function marker(kind: Marker, cx: number, cy: number, r: number, c: { fill: string; stroke: string }, sw = 0.8): Part {
  switch (kind) {
    case 's': {
      const s = r * 0.9;
      return { kind: 'rect', x: cx - s, y: cy - s, w: 2 * s, h: 2 * s, r: 0, fill: c.fill, stroke: c.stroke, sw, solid: true };
    }
    case '^': {
      const s = r * 1.25;
      return { kind: 'path', fill: c.fill, stroke: c.stroke, sw, solid: true, cmds: poly([[cx, cy - s], [cx + s * 0.92, cy + s * 0.62], [cx - s * 0.92, cy + s * 0.62]]) };
    }
    case 'x':
      return line([...seg([cx - r, cy - r], [cx + r, cy + r]), ...seg([cx - r, cy + r], [cx + r, cy - r])], c.stroke, Math.max(1.1, r * 0.42));
    case '+':
      return line([...seg([cx - r, cy], [cx + r, cy]), ...seg([cx, cy - r], [cx, cy + r])], c.stroke, Math.max(1.1, r * 0.36));
    case '-':
      return line(seg([cx - r, cy], [cx + r, cy]), c.stroke, Math.max(1.1, r * 0.36));
    case '*': {
      const pts: P2[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / 5;
        const rr = i % 2 ? r * 0.48 : r * 1.25;
        pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
      }
      return { kind: 'path', fill: c.fill, stroke: c.stroke, sw, solid: true, cmds: poly(pts) };
    }
    default:
      return disc(cx, cy, r, c.fill, c.stroke, sw);
  }
}

/** Croce del centroide con alone bianco, leggibile sopra i punti. */
export function centroid(cx: number, cy: number, r: number, color: string): Part[] {
  const arm = (k: number): Cmd[] => [...seg([cx - k, cy - k], [cx + k, cy + k]), ...seg([cx - k, cy + k], [cx + k, cy - k])];
  const w = Math.max(1.6, r * 0.55);
  return [line(arm(r), '#FFFFFF', w + 2), line(arm(r), color, w)];
}

/** Freccia (asta + punta piena) da `a` a `b`. */
export function arrow(a: P2, b: P2, color: string, sw: number, size = 5, both = false): Part[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
  const cut = Math.min(size * 0.8, l * 0.45);
  const head = (tip: P2, dx: number, dy: number): Part => {
    const bx = tip[0] - dx * size, by = tip[1] - dy * size;
    const hw = size * 0.42;
    return { kind: 'path', fill: color, stroke: 'none', cmds: poly([tip, [bx - dy * hw, by + dx * hw], [bx + dy * hw, by - dx * hw]]) };
  };
  const s: P2 = both ? [a[0] + ux * cut, a[1] + uy * cut] : a;
  const e: P2 = [b[0] - ux * cut, b[1] - uy * cut];
  const parts: Part[] = [line(seg(s, e), color, sw), head(b, ux, uy)];
  if (both) parts.push(head(a, -ux, -uy));
  return parts;
}

/** Tratteggio "a mano" lungo una polilinea (le primitive non hanno uno stile tratteggiato proprio). */
export function dashes(pts: P2[], on: number, off: number, closed = false): Cmd[] {
  const P = closed && pts.length > 1 ? [...pts, pts[0]] : pts;
  const out: Cmd[] = [];
  let drawing = true;
  let left = on;
  let pen: P2 | null = null;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = 0;
    while (L - t > 1e-6) {
      const step = Math.min(left, L - t);
      const p0: P2 = [lerp(a[0], b[0], t / L), lerp(a[1], b[1], t / L)];
      const p1: P2 = [lerp(a[0], b[0], (t + step) / L), lerp(a[1], b[1], (t + step) / L)];
      if (drawing) {
        if (!pen) out.push(['M', p0[0], p0[1]]);
        out.push(['L', p1[0], p1[1]]);
        pen = p1;
      }
      t += step;
      left -= step;
      if (left <= 1e-6) {
        drawing = !drawing;
        left = drawing ? on : off;
        pen = null;
      }
    }
  }
  return out;
}

/** Punti di un'ellisse ruotata (per contorni tratteggiati o poligoni). */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, rot = 0, k = 48): P2[] {
  const c = Math.cos(rot), s = Math.sin(rot);
  return Array.from({ length: k }, (_, i) => {
    const a = (TAU * i) / k;
    const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
    return [cx + c * ex - s * ey, cy + s * ex + c * ey] as P2;
  });
}

/** Ellisse ruotata come quattro archi di Bézier. */
export function ellipseCmds(cx: number, cy: number, rx: number, ry: number, rot = 0): Cmd[] {
  const K = 0.5523;
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (ex: number, ey: number): P2 => [cx + c * ex - s * ey, cy + s * ex + c * ey];
  const pt = (a: number) => P(rx * Math.cos(a), ry * Math.sin(a));
  const tg = (a: number) => P(-rx * Math.sin(a), ry * Math.cos(a)).map((v, i) => v - (i ? cy : cx)) as P2;
  const cmds: Cmd[] = [['M', ...pt(0)]];
  for (let q = 0; q < 4; q++) {
    const a0 = (q * Math.PI) / 2, a1 = a0 + Math.PI / 2;
    const p0 = pt(a0), p1 = pt(a1), t0 = tg(a0), t1 = tg(a1);
    cmds.push(['C', p0[0] + K * t0[0], p0[1] + K * t0[1], p1[0] - K * t1[0], p1[1] - K * t1[1], p1[0], p1[1]]);
  }
  cmds.push(['Z']);
  return cmds;
}

/** Ritaglia un poligono convesso o concavo con il semipiano a·p ≤ b (Sutherland–Hodgman). */
export function clipHalf(pts: P2[], a: P2, b: number): P2[] {
  const out: P2[] = [];
  const f = (p: P2) => a[0] * p[0] + a[1] * p[1] - b;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const fp = f(p), fq = f(q);
    if (fp <= 0) out.push(p);
    if (fp * fq < 0) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

// ---------- numeri ----------

/** Normale standard (Box–Muller) dal generatore deterministico. */
export function gauss(rand: Rand): number {
  const u = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand());
}

/** Minimi quadrati polinomiali (equazioni normali, eliminazione di Gauss). */
export function polyfit(xs: number[], ys: number[], deg: number): number[] {
  const m = deg + 1;
  const A = Array.from({ length: m }, () => new Array<number>(m + 1).fill(0));
  xs.forEach((x, k) => {
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) A[i][j] += x ** (i + j);
      A[i][m] += ys[k] * x ** i;
    }
  });
  for (let c = 0; c < m; c++) {
    let p = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < m; r++) {
      if (r === c || !A[c][c]) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= m; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row, i) => (row[i] ? row[m] / row[i] : 0));
}

export const polyval = (coef: number[], x: number) => coef.reduce((s, c, i) => s + c * x ** i, 0);

/** Interpolazione di Lagrange (polinomio di grado N−1 per N punti: l'overfitting da manuale). */
export function lagrange(xs: number[], ys: number[], x: number): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    let l = 1;
    for (let j = 0; j < xs.length; j++) if (j !== i) l *= (x - xs[j]) / (xs[i] - xs[j]);
    s += ys[i] * l;
  }
  return s;
}

// ---------- area del grafico ----------

export interface Plot {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Coordinate di dati in [0, 1]² (v verso l'alto) → pixel. */
  P: (u: number, v: number) => P2;
  X: (u: number) => number;
  Y: (v: number) => number;
  clip: ClipRect;
  /** Lato minore dell'area (scala di marcatori e linee). */
  s: number;
  /** Raggio dei marcatori e spessore delle curve, leggibili a ogni dimensione. */
  r: number;
  lw: number;
}

export function plotArea(n: NodeModel, pad: { l?: number; r?: number; t?: number; b?: number } = {}): Plot {
  const { l = 0.12, r = 0.05, t = 0.07, b = 0.12 } = pad;
  const x0 = n.x + n.w * l, x1 = n.x + n.w * (1 - r);
  const y0 = n.y + n.h * t, y1 = n.y + n.h * (1 - b);
  const X = (u: number) => x0 + (x1 - x0) * u;
  const Y = (v: number) => y1 - (y1 - y0) * v;
  const m = Math.min(n.w, n.h);
  return {
    x0, y0, x1, y1, X, Y,
    P: (u, v) => [X(u), Y(v)],
    clip: { x: x0, y: y0, w: x1 - x0, h: y1 - y0, r: 0 },
    s: Math.min(x1 - x0, y1 - y0),
    r: clamp(m * 0.03, 1.5, 4.2),
    lw: clamp(m * 0.016, 1.1, 2.2),
  };
}

/** Cornice del grafico (colori del blocco) e assi a L. */
export function panel(n: NodeModel, p: Plot, axes = true): Part[] {
  const parts: Part[] = [{ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(n.radius, n.w / 2, n.h / 2), fill: n.fill }];
  if (axes) parts.push(axesL(p));
  return parts;
}

export const axesL = (p: Plot): Part => line([['M', p.x0, p.y0 - 2], ['L', p.x0, p.y1], ['L', p.x1 + 2, p.y1]], AXIS, 0.9);

/** Polilinea di una funzione v = f(u) campionata su [u0, u1]. */
export function curve(p: Plot, f: (u: number) => number, u0 = 0, u1 = 1, N = 60): P2[] {
  return Array.from({ length: N + 1 }, (_, i) => {
    const u = u0 + ((u1 - u0) * i) / N;
    return p.P(u, f(u));
  });
}

/** Banda fra due curve (es. ± deviazione standard). */
export function band(p: Plot, lo: (u: number) => number, hi: (u: number) => number, u0 = 0, u1 = 1, N = 40): Cmd[] {
  return poly([...curve(p, hi, u0, u1, N), ...curve(p, lo, u0, u1, N).reverse()]);
}

export const faded = (c: string, t: number) => mix(c, '#FFFFFF', t);

// ---------- testo nelle forme ----------

export const TEXT = '#555555';
type Anchor = 'start' | 'middle' | 'end';

/** Testo dentro la forma (y = centro verticale); accetta formule $…$. */
export const text = (x: number, y: number, t: string, size: number, fill = TEXT, anchor: Anchor = 'middle', bold = false): Part => ({
  kind: 'text', x, y, text: t, size, fill, anchor, bold,
});

/** Interruttore comune alle forme con testo interno: grafico "muto", da etichettare a mano. */
export const PLAIN: SpecGroup = { title: 'Testo', mode: 'many', choices: [{ value: 'plain', label: 'Senza testo' }] };

/** Parole di `spec` (separate da spazi): i flag come 'plain' si accendono dal pannello. */
export const flag = (n: NodeModel, word: string) => n.spec.toLowerCase().split(/\s+/).includes(word);

/** Corpo dei nomi d'asse: leggibile anche alla dimensione della libreria. */
export const axisSize = (n: NodeModel) => clamp(Math.min(n.w, n.h) * 0.09, 7, 11);

/** Area del grafico con margini per i nomi degli assi (sotto l'asse x, sopra l'asse y). */
export function labeledArea(n: NodeModel, l = 0.12, r = 0.05): Plot {
  if (flag(n, 'plain')) return plotArea(n, { l, r });
  const s = axisSize(n);
  return plotArea(n, { l, r, t: (1.5 * s + 3) / n.h, b: (2 * s + 3) / n.h });
}

/** Nomi degli assi: x al centro sotto l'asse, y in cima all'asse (stile compatto da paper). */
export function axisNames(n: NodeModel, p: Plot, xName: string, yName: string): Part[] {
  if (flag(n, 'plain')) return [];
  const s = axisSize(n);
  return [text((p.x0 + p.x1) / 2, p.y1 + s * 1.05, xName, s), text(p.x0 - 3, p.y0 - s * 0.85, yName, s, TEXT, 'start')];
}
