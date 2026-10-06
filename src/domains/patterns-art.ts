// Aiuti di disegno del modulo pattern recognition & computer vision (patterns.ts):
// primitive, frecce, ellissi ruotate, marcatori, ritaglio di poligoni (celle di Voronoi).
// Le "fotografie" procedurali sono in patterns-photo.ts.
// Tutto è deterministico e fatto di primitive `Part`: identico in SVG, PDF, PNG e TikZ.
import { arc, poly, type Box, type ClipRect, type Cmd, type Part } from '../draw';

export type P2 = [number, number];

export const TAU = Math.PI * 2;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const has = (spec: string, word: string) => new RegExp(`\\b${word}\\b`, 'i').test(spec);

// ---------- colori ----------

export const AXIS = '#9AA0A6';
export const INK = '#374151';

/** Classi: tinta pastello (regioni), colore pieno (punti) e bordo. */
export const CLS = [
  { tint: '#DCE8F8', fill: '#9DBDE8', stroke: '#3B6FB6' },
  { tint: '#FDE8D2', fill: '#F6C08A', stroke: '#C96F12' },
  { tint: '#DDF0DA', fill: '#A3D49D', stroke: '#3E8E3A' },
  { tint: '#ECE3F5', fill: '#C8B0E2', stroke: '#7B52A6' },
  { tint: '#FADCD9', fill: '#EFA39B', stroke: '#C0392B' },
  { tint: '#D8F0EC', fill: '#93D4CB', stroke: '#2D8A80' },
];
export const cls = (k: number) => CLS[((k % CLS.length) + CLS.length) % CLS.length];

/** Colori vivaci per box, istanze, scheletri. */
export const VIVID = ['#E5484D', '#3B82C4', '#2F9E44', '#F5A524', '#8E4EC6', '#12A594'];

export function gray(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const l = Math.round(0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255));
  const c = l.toString(16).padStart(2, '0').toUpperCase();
  return `#${c}${c}${c}`;
}

/** Colore da tinta (gradi), saturazione e luminosità in [0, 1]. */
export function hsv(h: number, s: number, v: number): string {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const k = v - c;
  const ch = (u: number) => Math.round((u + k) * 255).toString(16).padStart(2, '0');
  return ('#' + ch(r) + ch(g) + ch(b)).toUpperCase();
}

export const isDark = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex) && parseInt(gray(hex).slice(1, 3), 16) < 110;

// ---------- primitive ----------

export const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];

export const line = (cmds: Cmd[], stroke: string, sw: number): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true });

export const area = (cmds: Cmd[], fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'path', cmds, fill, stroke, sw, solid: true });

export const disc = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 0.8): Part => ({
  kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true,
});

export const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = 'none', sw = 1, r = 0): Part => ({
  kind: 'rect', x, y, w, h, r, fill, stroke, sw, solid: true,
});

export const rectCmds = (x: number, y: number, w: number, h: number): Cmd[] => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);

/** Punta di freccia piena con vertice in `tip`, orientata lungo (dx, dy). */
export function head(tip: P2, dx: number, dy: number, size: number, color: string): Part {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const bx = tip[0] - ux * size, by = tip[1] - uy * size;
  const hw = size * 0.45;
  return { kind: 'path', fill: color, stroke: 'none', cmds: poly([tip, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]) };
}

export function arrow(a: P2, b: P2, color: string, sw: number, size = 4): Part[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const cut = Math.min(size * 0.8, l * 0.6);
  const end: P2 = [b[0] - ((b[0] - a[0]) / l) * cut, b[1] - ((b[1] - a[1]) / l) * cut];
  return [line(seg(a, end), color, sw), head(b, b[0] - a[0], b[1] - a[1], Math.min(size, l * 0.9), color)];
}

/** Segmento tratteggiato come sequenza di tratti (le forme non hanno il tratteggio per parte). */
export function dashed(a: P2, b: P2, on = 4, off = 3): Cmd[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / (l || 1), uy = (b[1] - a[1]) / (l || 1);
  const cmds: Cmd[] = [];
  for (let s = 0; s < l; s += on + off) {
    const e = Math.min(l, s + on);
    cmds.push(['M', a[0] + ux * s, a[1] + uy * s], ['L', a[0] + ux * e, a[1] + uy * e]);
  }
  return cmds;
}

export const dashedRect = (x: number, y: number, w: number, h: number, on = 4, off = 3): Cmd[] => [
  ...dashed([x, y], [x + w, y], on, off),
  ...dashed([x + w, y], [x + w, y + h], on, off),
  ...dashed([x + w, y + h], [x, y + h], on, off),
  ...dashed([x, y + h], [x, y], on, off),
];

export function dashedCircle(cx: number, cy: number, r: number, n = 24): Cmd[] {
  const cmds: Cmd[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (TAU * i) / n;
    cmds.push(...arc(cx, cy, r, a0, a0 + (TAU / n) * 0.55));
  }
  return cmds;
}

/** Ellisse ruotata (angolo in radianti) come quattro curve di Bézier. */
export function rotEllipse(cx: number, cy: number, rx: number, ry: number, rot: number): Cmd[] {
  const k = 0.5523;
  const c = Math.cos(rot), s = Math.sin(rot);
  const T = (u: number, v: number): [number, number] => [cx + c * u * rx - s * v * ry, cy + s * u * rx + c * v * ry];
  return [
    ['M', ...T(1, 0)],
    ['C', ...T(1, k), ...T(k, 1), ...T(0, 1)],
    ['C', ...T(-k, 1), ...T(-1, k), ...T(-1, 0)],
    ['C', ...T(-1, -k), ...T(-k, -1), ...T(0, -1)],
    ['C', ...T(k, -1), ...T(1, -k), ...T(1, 0)],
    ['Z'],
  ];
}

/** Capsula (segmento spesso con estremi tondi) da a a b, raggio r. */
export function capsule(a: P2, b: P2, r: number): Cmd[] {
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const c1 = arc(b[0], b[1], r, th - Math.PI / 2, th + Math.PI / 2);
  const c2 = arc(a[0], a[1], r, th + Math.PI / 2, th + (3 * Math.PI) / 2);
  return [...c1, ['L', c2[0][1] as number, c2[0][2] as number], ...c2.slice(1), ['Z']];
}

/** Marcatori distinti per classe (stampabili in bianco e nero): ●, ×, ▲, ■, ◆, +. */
export function marker(k: number, cx: number, cy: number, r: number, sw = 0.9): Part {
  const c = cls(k);
  switch (k % 6) {
    case 1:
      return line([...seg([cx - r, cy - r], [cx + r, cy + r]), ...seg([cx - r, cy + r], [cx + r, cy - r])], c.stroke, sw * 1.5);
    case 2: {
      const s = r * 1.2;
      return area(poly([[cx, cy - s], [cx + s * 0.95, cy + s * 0.68], [cx - s * 0.95, cy + s * 0.68]]), c.fill, c.stroke, sw);
    }
    case 3:
      return rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7, c.fill, c.stroke, sw);
    case 4:
      return area(poly([[cx, cy - r * 1.2], [cx + r, cy], [cx, cy + r * 1.2], [cx - r, cy]]), c.fill, c.stroke, sw);
    case 5:
      return line([...seg([cx - r * 1.1, cy], [cx + r * 1.1, cy]), ...seg([cx, cy - r * 1.1], [cx, cy + r * 1.1])], c.stroke, sw * 1.5);
    default:
      return disc(cx, cy, r, c.fill, c.stroke, sw);
  }
}

/** Assi del grafico (a L) in grigio, con piccole punte. */
export function axes(x0: number, y0: number, x1: number, y1: number, arrows = true): Part[] {
  const parts: Part[] = [line([['M', x0, y0], ['L', x0, y1], ['L', x1, y1]], AXIS, 0.8)];
  if (arrows) parts.push(head([x0, y0 - 1], 0, -1, 3.5, AXIS), head([x1 + 1, y1], 1, 0, 3.5, AXIS));
  return parts;
}

export function withClip(parts: Part[], clip: ClipRect): Part[] {
  return parts.map((p) => ({ ...p, stroke: p.stroke ?? 'none', clip }));
}

// ---------- geometria: poligoni convessi ----------

/** Sutherland–Hodgman: tiene la parte del poligono con a·x + b·y ≤ c. */
export function clipHalf(pts: P2[], a: number, b: number, c: number): P2[] {
  const out: P2[] = [];
  const f = (p: P2) => a * p[0] + b * p[1] - c;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const fp = f(p), fq = f(q);
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** Celle del diagramma di potenza (Voronoi pesato) dei siti nel rettangolo. */
export function powerCells(sites: P2[], weights: number[], b: Box): P2[][] {
  return sites.map((p, i) => {
    let cell: P2[] = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
    sites.forEach((q, j) => {
      if (j === i || !cell.length) return;
      // |x-p|² - wi ≤ |x-q|² - wj  ⇔  2(q-p)·x ≤ |q|² - |p|² + wi - wj
      cell = clipHalf(cell, 2 * (q[0] - p[0]), 2 * (q[1] - p[1]), q[0] ** 2 + q[1] ** 2 - p[0] ** 2 - p[1] ** 2 + weights[i] - weights[j]);
    });
    return cell;
  });
}

/** Infittisce i lati di un poligono (per deformarlo poi in modo continuo). */
export function densify(pts: P2[], step: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const k = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step));
    for (let j = 0; j < k; j++) out.push([p[0] + ((q[0] - p[0]) * j) / k, p[1] + ((q[1] - p[1]) * j) / k]);
  }
  return out;
}

export function boundsOf(cmds: Cmd[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cmds)
    for (let i = 1; i + 1 < c.length; i += 2) {
      const px = c[i] as number, py = c[i + 1] as number;
      x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
