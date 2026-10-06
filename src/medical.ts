// Illustrazioni originali per le figure di imaging medico e biologia: istologia (H&E,
// autofluorescenza, multifotone, IHC, fluorescenza), radiologia (CT, MRI, raggi X, ecografia),
// oftalmologia (fondo oculare, OCT), dermatoscopia, ECG e icone biomediche.
// Sono procedurali e deterministiche (il campo "count" fa da variante): stesse primitive
// `Part` delle altre forme, quindi identiche in SVG, PDF, PNG e TikZ.
import { poly, rng, shade, type ClipRect, type Cmd, type Part } from './geometry';
import { arc, mix } from './icons';
import type { NodeModel } from './model';

type P2 = [number, number];
export type Rand = () => number;

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pick = <T,>(rand: Rand, items: readonly T[]): T => items[Math.floor(rand() * items.length) % items.length];
const between = (rand: Rand, a: number, b: number) => a + (b - a) * rand();

/** Curva chiusa morbida (Catmull-Rom → Bézier) attraverso i punti. */
export function smooth(pts: P2[], closed = true): Cmd[] {
  const n = pts.length;
  if (n < 2) return [];
  const at = (i: number): P2 => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const cmds: Cmd[] = [['M', pts[0][0], pts[0][1]]];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    cmds.push([
      'C',
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    ]);
  }
  if (closed) cmds.push(['Z']);
  return cmds;
}

/** Forma organica: ellisse ruotata con bordo irregolare. */
export function blob(cx: number, cy: number, rx: number, ry: number, rot: number, wobble: number, rand: Rand, k = 10): Cmd[] {
  const pts: P2[] = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < k; i++) {
    const a = (TAU * i) / k;
    const r = 1 + (rand() * 2 - 1) * wobble;
    const ex = rx * r * Math.cos(a), ey = ry * r * Math.sin(a);
    pts.push([cx + c * ex - s * ey, cy + s * ex + c * ey]);
  }
  return smooth(pts);
}

/** Punto sul bordo (scalato di `f`) di un'ellisse ruotata. */
function onEllipse(cx: number, cy: number, rx: number, ry: number, rot: number, a: number, f: number): P2 {
  const ex = rx * f * Math.cos(a), ey = ry * f * Math.sin(a);
  return [cx + Math.cos(rot) * ex - Math.sin(rot) * ey, cy + Math.sin(rot) * ex + Math.cos(rot) * ey];
}

const dot = (cx: number, cy: number, r: number, fill: string, ry = r): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry, fill, stroke: 'none' });
const shape = (cmds: Cmd[], fill: string): Part => ({ kind: 'path', cmds, fill, stroke: 'none' });
const line = (cmds: Cmd[], stroke: string, sw: number): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true });

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Immagine in cornice: passe-partout (fill/stroke del blocco) e contenuto ritagliato. */
export function framed(n: NodeModel, paint: (b: Box, rand: Rand) => Part[]): Part[] {
  const mat = n.fill === 'none' ? 0 : clamp(Math.min(n.w, n.h) * 0.035, 2, 5);
  const inner: ClipRect = {
    x: n.x + mat,
    y: n.y + mat,
    w: Math.max(1, n.w - 2 * mat),
    h: Math.max(1, n.h - 2 * mat),
    r: Math.max(0, Math.min(n.radius, n.w / 2, n.h / 2) - mat),
  };
  const parts: Part[] = [];
  if (mat) parts.push({ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(n.radius, n.w / 2, n.h / 2), fill: n.fill });
  const content = paint(inner, rng(1000 + n.count * 7919));
  if (/\bbox\b/.test(n.spec)) {
    content.push({ kind: 'rect', x: inner.x + inner.w * 0.3, y: inner.y + inner.h * 0.3, w: inner.w * 0.38, h: inner.h * 0.36, r: 0, fill: 'none', stroke: '#E5484D', sw: 1.6, solid: true });
  }
  for (const p of content) parts.push({ ...p, stroke: p.stroke ?? 'none', clip: inner });
  if (!mat && n.stroke !== 'none') parts.push({ kind: 'rect', ...inner, fill: 'none' });
  return parts;
}

/** Posizioni a griglia con jitter, per strutture ripetute (cripte, cellule). */
function jitterGrid(b: Box, cell: number, rand: Rand, keep = 0.88) {
  const cols = Math.max(1, Math.round(b.w / cell));
  const rows = Math.max(1, Math.round(b.h / cell));
  const cw = b.w / cols, ch = b.h / rows;
  const out: { cx: number; cy: number; cw: number; ch: number }[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      if (rand() > keep) continue;
      out.push({
        cx: b.x + (i + 0.5 + (rand() - 0.5) * 0.35) * cw,
        cy: b.y + (j + 0.5 + (rand() - 0.5) * 0.35) * ch,
        cw,
        ch,
      });
    }
  return out;
}

const area = (b: Box) => b.w * b.h;

// ---------------- istologia ----------------

const HE = { bg: '#E2A3CD', fiber: '#DD9CC5', nuclei: ['#5B2C83', '#6E3B96', '#41205F'], rbc: '#E04A63', gland: '#A56BB8', lumen: '#F9E9F2', ring: '#4A2270', goblet: '#F2E4F4' };
const UNSTAINED = { bg: '#E9E9E9', fiber: '#E0E0E0', nuclei: ['#C4C4C4', '#BABABA', '#CFCFCF'], rbc: '#D5D5D5', gland: '#D9D9D9', lumen: '#F7F7F7', ring: '#B3B3B3', goblet: '#EFEFEF' };

function hne(b: Box, rand: Rand, c = HE): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: c.bg, stroke: 'none' }];
  for (let i = 0; i < 16; i++) {
    const y0 = b.y + rand() * b.h;
    parts.push(line(smooth([[b.x - 5, y0], [b.x + b.w * 0.35, y0 + between(rand, -12, 12)], [b.x + b.w * 0.7, y0 + between(rand, -12, 12)], [b.x + b.w + 5, y0 + between(rand, -12, 12)]], false), c.fiber, 1));
  }
  const nNuclei = Math.min(320, Math.round(area(b) / 55));
  for (let i = 0; i < nNuclei; i++) {
    const r = between(rand, 1.1, 2.1);
    parts.push(dot(b.x + rand() * b.w, b.y + rand() * b.h, r, pick(rand, c.nuclei), r * between(rand, 0.55, 1)));
  }
  for (let i = 0; i < 8; i++) parts.push(dot(b.x + rand() * b.w, b.y + rand() * b.h, 1.6, c.rbc));
  // cripte: epitelio viola, lume chiaro, corona di nuclei
  for (const g of jitterGrid(b, 27, rand, 0.92)) {
    const rx = g.cw * between(rand, 0.34, 0.44), ry = g.ch * between(rand, 0.24, 0.34), rot = rand() * Math.PI;
    parts.push(shape(blob(g.cx, g.cy, rx, ry, rot, 0.12, rand), c.gland));
    parts.push(shape(blob(g.cx, g.cy, rx * 0.5, ry * 0.42, rot, 0.2, rand), c.lumen));
    const m = Math.round((rx + ry) * 0.6);
    for (let k = 0; k < m; k++) {
      const [px, py] = onEllipse(g.cx, g.cy, rx, ry, rot, (TAU * k) / m + rand() * 0.2, between(rand, 0.72, 0.84));
      if (rand() < 0.12) parts.push(dot(px, py, 1.6, c.goblet));
      else parts.push(dot(px, py, between(rand, 1.3, 1.9), c.ring));
    }
  }
  return parts;
}

const AF = { bg: '#0C1107', glow: '#45581A', fiber: '#7E9A30', crypt: '#334414', lumen: '#0A0E05', ring: '#9DB540', gran: ['#A9C34B', '#D6E270', '#7E9A30', '#EEF19A'] };
const AF_GRAY = { bg: '#050505', glow: '#4A4A4A', fiber: '#7A7A7A', crypt: '#383838', lumen: '#070707', ring: '#BDBDBD', gran: ['#CFCFCF', '#F0F0F0', '#9A9A9A', '#FFFFFF'] };

function autofluo(b: Box, rand: Rand, c = AF): Part[] {
  const bg = c.bg;
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: bg, stroke: 'none' }];
  const m = Math.min(b.w, b.h);
  for (let i = 0; i < 9; i++) {
    parts.push(shape(blob(b.x + rand() * b.w, b.y + rand() * b.h, m * between(rand, 0.15, 0.3), m * between(rand, 0.12, 0.25), rand() * Math.PI, 0.3, rand), mix(bg, c.glow, between(rand, 0.25, 0.55))));
  }
  for (let i = 0; i < 14; i++) {
    const y0 = b.y + rand() * b.h;
    parts.push(line(smooth([[b.x, y0], [b.x + b.w * 0.3, y0 + between(rand, -15, 15)], [b.x + b.w * 0.65, y0 + between(rand, -15, 15)], [b.x + b.w, y0 + between(rand, -15, 15)]], false), mix(bg, c.fiber, between(rand, 0.4, 0.8)), between(rand, 0.5, 1)));
  }
  for (const g of jitterGrid(b, 38, rand, 0.8)) {
    const rx = g.cw * between(rand, 0.28, 0.38), ry = g.ch * between(rand, 0.22, 0.32), rot = rand() * Math.PI;
    const outer = blob(g.cx, g.cy, rx, ry, rot, 0.14, rand);
    parts.push(shape(outer, c.crypt));
    parts.push(shape(blob(g.cx, g.cy, rx * 0.5, ry * 0.45, rot, 0.2, rand), c.lumen));
    parts.push(line(outer, c.ring, 1.1));
  }
  const nGran = Math.min(300, Math.round(area(b) / 60));
  for (let i = 0; i < nGran; i++) parts.push(dot(b.x + rand() * b.w, b.y + rand() * b.h, between(rand, 0.5, 1.3), pick(rand, c.gran)));
  return parts;
}

function mpm(b: Box, rand: Rand): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#040404', stroke: 'none' }];
  // SHG (collagene, verde): fasci ondulati quasi paralleli
  for (let k = 0; k < 9; k++) {
    const y0 = b.y + rand() * b.h, tilt = between(rand, -0.4, 0.4), amp = between(rand, 3, 9), ph = rand() * TAU;
    for (let s = 0; s < 3; s++) {
      const off = (s - 1) * between(rand, 2, 4);
      const pts: P2[] = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        pts.push([b.x - 4 + (b.w + 8) * u, y0 + off + tilt * b.w * (u - 0.5) + amp * Math.sin(u * 7 + ph)]);
      }
      parts.push(line(smooth(pts, false), mix('#14A34C', '#8DF5A8', rand()), between(rand, 0.7, 1.6)));
    }
  }
  // TPEF (cellule, magenta)
  const nCells = Math.min(40, Math.round(area(b) / 320));
  for (let i = 0; i < nCells; i++) {
    const cx = b.x + rand() * b.w, cy = b.y + rand() * b.h, r = between(rand, 3, 6);
    parts.push(shape(blob(cx, cy, r, r * between(rand, 0.7, 1), rand() * Math.PI, 0.25, rand, 8), mix('#B32BC9', '#F06BFF', rand())));
    parts.push(dot(cx + between(rand, -1, 1), cy + between(rand, -1, 1), r * 0.42, '#4A0F55'));
  }
  return parts;
}

function ihc(b: Box, rand: Rand): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#EEF1F6', stroke: 'none' }];
  const m = Math.min(b.w, b.h);
  for (let i = 0; i < 10; i++) parts.push(shape(blob(b.x + rand() * b.w, b.y + rand() * b.h, m * 0.2, m * 0.12, rand() * Math.PI, 0.3, rand), '#E1E5EE'));
  const n = Math.min(240, Math.round(area(b) / 70));
  for (let i = 0; i < n; i++) {
    const cx = b.x + rand() * b.w, cy = b.y + rand() * b.h;
    if (rand() < 0.28) {
      const r = between(rand, 3.2, 4.8);
      parts.push(shape(blob(cx, cy, r, r * 0.85, rand() * Math.PI, 0.25, rand, 8), pick(rand, ['#A3622E', '#8C4F22', '#B87436'])));
      parts.push(dot(cx, cy, r * 0.42, '#55300F'));
    } else {
      const r = between(rand, 1.5, 2.5);
      parts.push(dot(cx, cy, r, pick(rand, ['#7083B8', '#5C6FA6', '#8293C4']), r * between(rand, 0.6, 1)));
    }
  }
  return parts;
}

function fluor(b: Box, rand: Rand): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#020205', stroke: 'none' }];
  const n = Math.min(36, Math.max(4, Math.round(area(b) / 380)));
  for (let i = 0; i < n; i++) {
    const cx = b.x + rand() * b.w, cy = b.y + rand() * b.h, r = between(rand, 7, 11), rot = rand() * Math.PI;
    parts.push(shape(blob(cx, cy, r, r * 0.8, rot, 0.3, rand, 9), '#0E3A17'));
    parts.push(shape(blob(cx, cy, r * 0.75, r * 0.6, rot, 0.25, rand, 9), '#23913F'));
    parts.push(dot(cx, cy, r * 0.42, '#2F55FF', r * 0.34));
    parts.push(dot(cx - r * 0.08, cy - r * 0.06, r * 0.22, '#7D95FF', r * 0.17));
    for (let k = 0; k < 2; k++) parts.push(dot(cx + between(rand, -r, r) * 0.6, cy + between(rand, -r, r) * 0.5, 0.9, '#FF5252'));
  }
  return parts;
}

function wsi(b: Box, rand: Rand, spec: string): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#F6F7F9', stroke: 'none' }];
  const tissues = [
    { cx: b.x + b.w * 0.42, cy: b.y + b.h * 0.54, rx: b.w * 0.3, ry: b.h * 0.33 },
    { cx: b.x + b.w * 0.79, cy: b.y + b.h * 0.34, rx: b.w * 0.13, ry: b.h * 0.17 },
  ];
  const inside = (x: number, y: number, f = 0.85) => tissues.some((t) => ((x - t.cx) / t.rx) ** 2 + ((y - t.cy) / t.ry) ** 2 < f * f);
  for (const t of tissues) {
    parts.push(shape(blob(t.cx, t.cy, t.rx, t.ry, rand(), 0.22, rand, 12), '#E6A7CB'));
    for (let k = 0; k < 3; k++) parts.push(shape(blob(t.cx + between(rand, -0.4, 0.4) * t.rx, t.cy + between(rand, -0.4, 0.4) * t.ry, t.rx * 0.3, t.ry * 0.25, rand(), 0.3, rand), '#C985B9'));
  }
  for (let i = 0; i < 220; i++) {
    const x = b.x + rand() * b.w, y = b.y + rand() * b.h;
    if (inside(x, y)) parts.push(dot(x, y, between(rand, 0.6, 1.1), '#8F4DA8'));
  }
  const m = /(\d+)\s*[x×,]\s*(\d+)/.exec(spec);
  const rows = m ? clamp(+m[1], 2, 20) : 6, cols = m ? clamp(+m[2], 2, 20) : 8;
  const tw = b.w / cols, th = b.h / rows;
  const tiles: P2[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) if (inside(b.x + (i + 0.5) * tw, b.y + (j + 0.5) * th, 1)) tiles.push([i, j]);
  const grid: Cmd[] = tiles.flatMap(([i, j]) => poly([[b.x + i * tw, b.y + j * th], [b.x + (i + 1) * tw, b.y + j * th], [b.x + (i + 1) * tw, b.y + (j + 1) * th], [b.x + i * tw, b.y + (j + 1) * th]]));
  if (grid.length) parts.push(line(grid, '#53627F', 0.6));
  for (let k = 0; k < Math.min(3, tiles.length); k++) {
    const [i, j] = tiles[Math.floor(rand() * tiles.length)];
    parts.push({ kind: 'rect', x: b.x + i * tw, y: b.y + j * th, w: tw, h: th, r: 0, fill: 'none', stroke: '#E5484D', sw: 1.4, solid: true });
  }
  return parts;
}

// ---------------- radiologia ----------------

function ct(b: Box, rand: Rand, seg = false): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#000000', stroke: 'none' }];
  const cx = b.x + b.w / 2, cy = b.y + b.h * 0.5;
  const rx = b.w * 0.44, ry = b.h * 0.35;
  parts.push(line(arc(cx, cy - b.h * 0.9, b.h * 1.36, Math.PI * 0.38, Math.PI * 0.62), '#3E3E3E', 2));
  parts.push(dot(cx, cy, rx, '#3D4146', ry));
  parts.push(dot(cx, cy, rx * 0.9, '#6D7176', ry * 0.86));
  for (const s of [-1, 1]) {
    const lx = cx + s * rx * 0.37, ly = cy - ry * 0.04;
    const pts: P2[] = [
      [lx - s * rx * 0.2, ly - ry * 0.55], [lx + s * rx * 0.1, ly - ry * 0.62], [lx + s * rx * 0.3, ly - ry * 0.25],
      [lx + s * rx * 0.3, ly + ry * 0.35], [lx + s * rx * 0.1, ly + ry * 0.62], [lx - s * rx * 0.15, ly + ry * 0.55],
      [lx - s * rx * 0.2, ly + ry * 0.1],
    ];
    parts.push(shape(smooth(pts), '#111315'));
    if (seg) parts.push(line(smooth(pts), '#2ECC71', 1.4));
    for (let k = 0; k < 22; k++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * 0.8;
      parts.push(dot(lx + Math.cos(a) * d * rx * 0.24, ly + Math.sin(a) * d * ry * 0.5, between(rand, 0.6, 1.4), '#3A3E42'));
    }
  }
  parts.push(shape(blob(cx + rx * 0.06, cy + ry * 0.02, rx * 0.25, ry * 0.36, 0.3, 0.08, rand), seg ? '#C9575C' : '#8F9397'));
  parts.push(dot(cx + rx * 0.12, cy + ry * 0.42, ry * 0.11, '#A3A7AB'));
  parts.push(dot(cx, cy + ry * 0.62, ry * 0.17, '#E8E8E8', ry * 0.15));
  parts.push(dot(cx, cy + ry * 0.8, ry * 0.05, '#1A1A1A'));
  parts.push(dot(cx, cy + ry * 0.93, ry * 0.05, '#D8D8D8', ry * 0.07));
  parts.push(dot(cx, cy - ry * 0.8, rx * 0.06, '#CFCFCF', ry * 0.05));
  for (const s of [-1, 1])
    for (let k = 0; k < 5; k++) {
      const a = Math.PI / 2 + s * (0.55 + k * 0.42);
      parts.push(dot(cx + Math.cos(a) * rx * 0.83, cy + Math.sin(a) * ry * 0.8, rx * 0.035, '#D2D2D2', ry * 0.05));
    }
  return parts;
}

function mri(b: Box, rand: Rand, seg = false): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#000000', stroke: 'none' }];
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const rx = Math.min(b.w * 0.4, b.h * 0.34), ry = b.h * 0.45;
  parts.push(dot(cx, cy, rx, '#A8A8A8', ry));
  parts.push(dot(cx, cy, rx * 0.93, '#151515', ry * 0.94));
  parts.push(dot(cx, cy, rx * 0.89, '#2C2C2C', ry * 0.91));
  parts.push(shape(blob(cx, cy, rx * 0.86, ry * 0.88, 0, 0.035, rand, 44), '#8E8E8E'));
  parts.push(shape(blob(cx, cy, rx * 0.66, ry * 0.7, 0, 0.08, rand, 36), '#CACACA'));
  const sulci: Cmd[] = [];
  for (let k = 0; k < 26; k++) {
    const a = (TAU * k) / 26 + rand() * 0.1;
    const r0 = 0.87, r1 = between(rand, 0.7, 0.76);
    sulci.push(['M', cx + Math.cos(a) * rx * r0, cy + Math.sin(a) * ry * r0], ['L', cx + Math.cos(a + 0.03) * rx * r1, cy + Math.sin(a + 0.03) * ry * r1]);
  }
  parts.push(line(sulci, '#3A3A3A', 1));
  parts.push(line([['M', cx, cy - ry * 0.88], ['L', cx, cy - ry * 0.3], ['M', cx, cy + ry * 0.3], ['L', cx, cy + ry * 0.88]], '#3A3A3A', 1.2));
  for (const s of [-1, 1]) parts.push(shape(blob(cx + s * rx * 0.12, cy - ry * 0.04, rx * 0.07, ry * 0.21, s * 0.22, 0.12, rand, 8), '#262626'));
  // lesione: bianca in T1 con mezzo di contrasto; in segmentazione edema giallo e nucleo rosso
  const tx = cx + rx * 0.4, ty = cy - ry * 0.3;
  parts.push(shape(blob(tx, ty, rx * 0.2, ry * 0.16, 0.4, 0.2, rand), seg ? '#F5C542' : '#B5B5B5'));
  parts.push(shape(blob(tx, ty, rx * 0.11, ry * 0.09, 0.4, 0.25, rand), seg ? '#E5484D' : '#EDEDED'));
  return parts;
}

function xray(b: Box): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#0A0A0A', stroke: 'none' }];
  const U = (u: number, v: number): P2 => [b.x + u * b.w, b.y + v * b.h];
  parts.push(shape(smooth([U(0.06, 1.05), U(0.08, 0.36), U(0.24, 0.12), U(0.42, 0.07), U(0.58, 0.07), U(0.76, 0.12), U(0.92, 0.36), U(0.94, 1.05)]), '#666666'));
  parts.push({ kind: 'rect', x: b.x + b.w * 0.47, y: b.y + b.h * 0.08, w: b.w * 0.06, h: b.h * 0.95, r: 2, fill: '#9A9A9A', stroke: 'none' });
  const lung = (s: number): P2[] =>
    [[0.17, 0.84], [0.18, 0.42], [0.27, 0.2], [0.41, 0.22], [0.45, 0.5], [0.44, 0.86], [0.3, 0.8]].map(([u, v]) => U(s < 0 ? u : 1 - u, v));
  parts.push(shape(smooth(lung(-1)), '#222222'));
  parts.push(shape(smooth(lung(1)), '#222222'));
  parts.push(shape(smooth([U(0.44, 0.52), U(0.62, 0.55), U(0.71, 0.7), U(0.64, 0.84), U(0.47, 0.84)]), '#8A8A8A'));
  const ribs: Cmd[] = [];
  for (const s of [-1, 1])
    for (let k = 0; k < 7; k++) {
      const v = 0.2 + k * 0.088;
      const M = (u: number, vv: number) => U(s < 0 ? u : 1 - u, vv);
      ribs.push(...smooth([M(0.47, v), M(0.34, v - 0.03), M(0.21, v + 0.03), M(0.16, v + 0.11)], false));
    }
  parts.push(line(ribs, '#8C8C8C', Math.max(1, b.w * 0.012)));
  parts.push(line([...smooth([U(0.2, 0.17), U(0.34, 0.2), U(0.47, 0.18)], false), ...smooth([U(0.8, 0.17), U(0.66, 0.2), U(0.53, 0.18)], false)], '#B8B8B8', Math.max(1.5, b.w * 0.02)));
  return parts;
}

function ultrasound(b: Box, rand: Rand): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#000000', stroke: 'none' }];
  const ax = b.x + b.w / 2, ay = b.y + b.h * 0.02;
  const r0 = b.h * 0.1, r1 = b.h * 0.97, th = Math.min(0.72, Math.atan2(b.w * 0.48, r1));
  const a0 = Math.PI / 2 - th, a1 = Math.PI / 2 + th;
  const outer = arc(ax, ay, r1, a0, a1);
  const inner = arc(ax, ay, r0, a1, a0);
  parts.push(shape([...outer, ['L', inner[0][1] as number, inner[0][2] as number], ...inner.slice(1), ['Z']] as Cmd[], '#2A2A2A'));
  const P = (r: number, a: number): P2 => [ax + Math.cos(a) * r, ay + Math.sin(a) * r];
  for (const f of [0.26, 0.34]) {
    const pts: P2[] = [];
    for (let i = 0; i <= 6; i++) pts.push(P(r1 * (f + 0.01 * Math.sin(i * 1.7)), a0 + ((a1 - a0) * i) / 6));
    parts.push(line(smooth(pts, false), '#9A9A9A', 1.4));
  }
  const lx = ax + b.w * 0.06, ly = ay + r1 * 0.62;
  parts.push(shape(blob(lx, ly + b.h * 0.14, b.w * 0.1, b.h * 0.12, 0, 0.15, rand), '#444444'));
  const nSpk = Math.min(380, Math.round(area(b) / 22));
  for (let i = 0; i < nSpk; i++) {
    const r = r0 + (r1 - r0) * Math.sqrt(rand()), a = a0 + (a1 - a0) * rand();
    const [x, y] = P(r, a);
    parts.push(dot(x, y, between(rand, 0.5, 1.3), mix('#555555', '#B0B0B0', rand() * (1 - r / r1) + 0.15)));
  }
  parts.push(shape(blob(lx, ly, b.w * 0.11, b.h * 0.07, 0.1, 0.1, rand), '#090909'));
  parts.push(line(blob(lx, ly, b.w * 0.11, b.h * 0.07, 0.1, 0.1, rng(3)), '#8A8A8A', 0.8));
  return parts;
}

// ---------------- oftalmologia, dermatologia, ECG ----------------

function fundus(b: Box, rand: Rand): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#000000', stroke: 'none' }];
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.min(b.w, b.h) * 0.47;
  const disc: P2 = [cx + R * 0.42, cy - R * 0.03];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    parts.push(dot(cx + (disc[0] - cx) * t * 0.25, cy, R * (1 - t * 0.62), mix('#5A1307', '#CF5A2C', t)));
  }
  parts.push(dot(cx - R * 0.12, cy, R * 0.17, '#A13A18'));
  parts.push(dot(cx - R * 0.12, cy, R * 0.06, '#7A2410'));
  const vessel = (pts: P2[], w: number) => parts.push(line(smooth(pts, false), '#7C1A0C', w));
  const D = (u: number, v: number): P2 => [cx + u * R, cy + v * R];
  for (const s of [-1, 1]) {
    vessel([disc, D(0.25, 0.3 * s), D(-0.1, 0.46 * s), D(-0.45, 0.42 * s), D(-0.75, 0.25 * s)], R * 0.035);
    vessel([disc, D(0.62, 0.38 * s), D(0.78, 0.6 * s)], R * 0.028);
    vessel([D(0.1, 0.42 * s), D(0.0, 0.25 * s), D(-0.12, 0.18 * s)], R * 0.016);
    vessel([D(-0.3, 0.45 * s), D(-0.4, 0.7 * s), D(-0.35, 0.85 * s)], R * 0.016);
    vessel([disc, D(0.12, 0.12 * s), D(-0.05, 0.1 * s)], R * 0.014);
    for (let k = 0; k < 3; k++) {
      const u = between(rand, -0.7, 0.5), v = between(rand, 0.3, 0.5) * s;
      vessel([D(u, v), D(u - 0.12, v + 0.15 * s), D(u - 0.18, v + 0.3 * s)], R * 0.01);
    }
  }
  parts.push(dot(disc[0], disc[1], R * 0.14, '#F1C46B'));
  parts.push(dot(disc[0] + R * 0.02, disc[1], R * 0.07, '#FFE6A6'));
  return parts;
}

function oct(b: Box, rand: Rand): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#050505', stroke: 'none' }];
  const N = 32;
  const g = (u: number) => Math.exp(-(((u - 0.5) / 0.12) ** 2));
  const base = (u: number) => b.y + b.h * (0.3 + 0.02 * Math.sin(u * 3.1) + 0.12 * Math.exp(-(((u - 0.5) / 0.09) ** 2)));
  const layers: { t: (u: number) => number; c: string }[] = [
    { t: (u) => 0.065 * (1 - 0.85 * g(u)), c: '#D0D0D0' },
    { t: (u) => 0.075 * (1 - 0.8 * g(u)), c: '#6E6E6E' },
    { t: (u) => 0.04 * (1 - 0.6 * g(u)), c: '#2A2A2A' },
    { t: () => 0.016, c: '#8C8C8C' },
    { t: (u) => 0.08 + 0.03 * g(u), c: '#1C1C1C' },
    { t: () => 0.013, c: '#EDEDED' },
    { t: () => 0.012, c: '#3A3A3A' },
    { t: () => 0.028, c: '#FFFFFF' },
    { t: () => 0.14, c: '#575757' },
  ];
  const us = Array.from({ length: N + 1 }, (_, i) => i / N);
  let top = us.map((u) => base(u));
  for (const L of layers) {
    const bot = us.map((u, i) => top[i] + L.t(u) * b.h);
    const pts: P2[] = [...us.map((u, i): P2 => [b.x + u * b.w, top[i]]), ...us.map((u, i): P2 => [b.x + u * b.w, bot[i]]).reverse()];
    parts.push(shape(poly(pts), L.c));
    top = bot;
  }
  const nSpk = Math.min(260, Math.round(area(b) / 40));
  for (let i = 0; i < nSpk; i++) parts.push(dot(b.x + rand() * b.w, b.y + rand() * b.h, between(rand, 0.4, 0.9), pick(rand, ['#2E2E2E', '#484848', '#7A7A7A'])));
  return parts;
}

function derm(b: Box, rand: Rand): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#000000', stroke: 'none' }];
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.min(b.w, b.h) * 0.49;
  parts.push(dot(cx, cy, R, '#E7B897'));
  for (let i = 0; i < 30; i++) {
    const y0 = cy + between(rand, -R, R), x0 = cx + between(rand, -R, R);
    parts.push(line([['M', x0 - 8, y0], ['L', x0 + 8, y0 + between(rand, -3, 3)]], '#DDA987', 0.6));
  }
  parts.push(shape(blob(cx, cy, R * 0.58, R * 0.48, rand(), 0.22, rand, 14), '#9B6243'));
  parts.push(shape(blob(cx + R * 0.04, cy, R * 0.4, R * 0.32, rand(), 0.25, rand, 12), '#6F4028'));
  parts.push(shape(blob(cx + R * 0.08, cy - R * 0.03, R * 0.16, R * 0.13, rand(), 0.3, rand, 9), '#452515'));
  for (let i = 0; i < 70; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand()) * 0.5;
    parts.push(dot(cx + Math.cos(a) * d * R, cy + Math.sin(a) * d * R * 0.85, between(rand, 0.5, 1.1), '#3A2112'));
  }
  for (let k = 0; k < 3; k++) {
    const y0 = cy + between(rand, -R, R) * 0.8;
    parts.push(line(smooth([[cx - R, y0], [cx - R * 0.3, y0 + between(rand, -R, R) * 0.3], [cx + R * 0.4, y0 + between(rand, -R, R) * 0.3], [cx + R, y0 + between(rand, -R, R) * 0.3]], false), '#2B1A10', 0.55));
  }
  return parts;
}

function ecg(b: Box): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: '#FFF4F4', stroke: 'none' }];
  const s = Math.max(3, Math.min(b.w, b.h) / 18);
  const minor: Cmd[] = [], major: Cmd[] = [];
  for (let i = 0, x = b.x; x <= b.x + b.w + 0.1; i++, x += s) (i % 5 ? minor : major).push(['M', x, b.y], ['L', x, b.y + b.h]);
  for (let i = 0, y = b.y; y <= b.y + b.h + 0.1; i++, y += s) (i % 5 ? minor : major).push(['M', b.x, y], ['L', b.x + b.w, y]);
  parts.push(line(minor, '#F5C9C9', 0.4), line(major, '#EC9B9B', 0.7));
  const G = (t: number, c: number, wd: number, a: number) => a * Math.exp(-(((t - c) / wd) ** 2));
  const beat = (t: number) => G(t, 0.16, 0.035, 0.07) - G(t, 0.27, 0.01, 0.05) + G(t, 0.3, 0.012, 0.5) - G(t, 0.33, 0.012, 0.13) + G(t, 0.56, 0.05, 0.14);
  const pts: P2[] = [];
  const bw = b.w / 2.4, y0 = b.y + b.h * 0.64;
  for (let i = 0; i <= 240; i++) {
    const x = b.x + (b.w * i) / 240;
    pts.push([x, y0 - beat(((x - b.x) / bw + 0.2) % 1) * b.h]);
  }
  parts.push(line(poly(pts, false), '#1E1E1E', 1.3));
  return parts;
}

// ---------------- icone biomediche (contorno = colore del bordo) ----------------

function unitPts(n: NodeModel, pts: number[][]): P2[] {
  return pts.map(([u, v]) => [n.x + u * n.w, n.y + v * n.h]);
}

function icon(n: NodeModel): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = n.stroke === 'none' ? '#555555' : n.stroke;
  const sw = n.strokeWidth;
  const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const body = (cmds: Cmd[], f = fill): Part => ({ kind: 'path', cmds, fill: f });
  switch (n.shape) {
    case 'dna': {
      const N = 48, turns = 2;
      const s1: P2[] = [], s2: P2[] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, a = u * turns * TAU;
        s1.push(P(u, 0.5 - 0.38 * Math.sin(a)));
        s2.push(P(u, 0.5 + 0.38 * Math.sin(a)));
      }
      const parts: Part[] = [];
      const COLORS = ['#E5484D', '#3B82C4', '#2F9E44', '#F5A524'];
      for (let k = 1; k < 16; k++) {
        const i = Math.round((k * N) / 16);
        parts.push(line([['M', s1[i][0], s1[i][1]], ['L', s2[i][0], s2[i][1]]], COLORS[k % 4], Math.max(1, sw * 0.9)));
      }
      parts.push(line(poly(s1, false), ink, sw * 1.6), line(poly(s2, false), shade(ink, 0.35), sw * 1.6));
      return parts;
    }
    case 'microscope':
      return [
        { kind: 'path', cmds: smooth(unitPts(n, [[0.62, 0.9], [0.86, 0.62], [0.8, 0.3], [0.62, 0.18]]), false), fill: 'none', sw: sw * 3, solid: true },
        body(poly(unitPts(n, [[0.3, 0.06], [0.42, 0.02], [0.6, 0.5], [0.48, 0.55]]))),
        body(poly(unitPts(n, [[0.25, 0.0], [0.42, -0.04], [0.45, 0.04], [0.28, 0.08]]))),
        body(poly(unitPts(n, [[0.5, 0.53], [0.58, 0.5], [0.62, 0.6], [0.55, 0.62]]))),
        { kind: 'rect', x: x + w * 0.28, y: y + h * 0.66, w: w * 0.5, h: h * 0.06, r: 1, fill },
        { kind: 'rect', x: x + w * 0.12, y: y + h * 0.9, w: w * 0.76, h: h * 0.1, r: Math.min(w, h) * 0.04, fill },
      ];
    case 'brain': {
      const parts: Part[] = [
        body(smooth(unitPts(n, [[0.72, 0.74], [0.9, 0.7], [0.9, 0.86], [0.74, 0.9]]))),
        body(poly(unitPts(n, [[0.56, 0.74], [0.66, 0.74], [0.64, 0.98], [0.57, 0.98]]))),
        body(smooth(unitPts(n, [[0.06, 0.55], [0.1, 0.3], [0.28, 0.1], [0.55, 0.05], [0.8, 0.14], [0.95, 0.38], [0.93, 0.6], [0.78, 0.72], [0.6, 0.7], [0.48, 0.8], [0.3, 0.78], [0.14, 0.7]]))),
      ];
      const sulci = [
        [[0.5, 0.08], [0.45, 0.3], [0.52, 0.5]],
        [[0.25, 0.25], [0.35, 0.38], [0.3, 0.52]],
        [[0.7, 0.2], [0.68, 0.38], [0.78, 0.5]],
        [[0.15, 0.6], [0.35, 0.62], [0.48, 0.68]],
        [[0.6, 0.55], [0.75, 0.6], [0.88, 0.55]],
      ];
      for (const s of sulci) parts.push({ kind: 'path', cmds: smooth(unitPts(n, s), false), fill: 'none', sw: sw * 0.9, solid: true });
      return parts;
    }
    case 'lungs': {
      const left = [[0.44, 0.32], [0.3, 0.2], [0.13, 0.45], [0.1, 0.84], [0.24, 0.96], [0.44, 0.86], [0.46, 0.56]];
      return [
        body(smooth(unitPts(n, left))),
        body(smooth(unitPts(n, left.map(([u, v]) => [1 - u, v])))),
        { kind: 'path', fill: 'none', sw: sw * 1.6, solid: true, cmds: [['M', ...P(0.5, 0.02)], ['L', ...P(0.5, 0.42)], ['M', ...P(0.5, 0.4)], ['L', ...P(0.36, 0.55)], ['M', ...P(0.5, 0.4)], ['L', ...P(0.64, 0.55)]] },
      ];
    }
    case 'heart':
      return [
        body([
          ['M', ...P(0.5, 0.28)],
          ['C', ...P(0.5, 0.1), ...P(0.1, 0.0), ...P(0.07, 0.35)],
          ['C', ...P(0.05, 0.6), ...P(0.4, 0.78), ...P(0.5, 0.96)],
          ['C', ...P(0.6, 0.78), ...P(0.95, 0.6), ...P(0.93, 0.35)],
          ['C', ...P(0.9, 0.0), ...P(0.5, 0.1), ...P(0.5, 0.28)],
          ['Z'],
        ]),
      ];
    case 'cell': {
      const r = rng(5);
      const parts: Part[] = [body(blob(x + w / 2, y + h / 2, w * 0.47, h * 0.45, 0.2, 0.06, r, 12))];
      parts.push({ kind: 'ellipse', cx: x + w * 0.45, cy: y + h * 0.48, rx: w * 0.17, ry: h * 0.15, fill: fill === 'none' ? 'none' : shade(fill, -0.25), sw: sw * 0.9 });
      parts.push(dot(x + w * 0.48, y + h * 0.45, Math.min(w, h) * 0.04, ink));
      const mito: [number, number, number][] = [[0.72, 0.35, 0.5], [0.7, 0.68, -0.4], [0.25, 0.7, 0.2]];
      for (const [u, v, a] of mito) {
        parts.push({ kind: 'path', cmds: blob(x + w * u, y + h * v, w * 0.08, h * 0.04, a, 0.05, r, 8), fill: '#F8CECC', stroke: '#B85450', sw: sw * 0.7, solid: true });
      }
      parts.push({ kind: 'path', fill: 'none', sw: sw * 0.7, solid: true, cmds: smooth(unitPts(n, [[0.22, 0.3], [0.3, 0.22], [0.38, 0.27], [0.32, 0.33]]), false) });
      return parts;
    }
    default:
      return [{ kind: 'rect', x, y, w, h, r: 0, fill }];
  }
}

/** Immagine importata dall'utente; senza immagine mostra un segnaposto. */
function photo(n: NodeModel): Part[] {
  return framed(n, (b) => {
    if (n.src) return [{ kind: 'image', ...b, href: n.src, ratio: n.srcRatio, fill: 'none' }];
    const m = Math.min(b.w, b.h);
    const ink = '#9AA3AF';
    return [
      { kind: 'rect', ...b, r: 0, fill: '#F1F3F6' },
      { kind: 'ellipse', cx: b.x + b.w * 0.68, cy: b.y + b.h * 0.3, rx: m * 0.08, ry: m * 0.08, fill: ink },
      { kind: 'path', fill: '#C5CBD3', cmds: poly([[b.x + b.w * 0.12, b.y + b.h * 0.78], [b.x + b.w * 0.38, b.y + b.h * 0.4], [b.x + b.w * 0.56, b.y + b.h * 0.62], [b.x + b.w * 0.68, b.y + b.h * 0.5], [b.x + b.w * 0.88, b.y + b.h * 0.78]]) },
    ];
  });
}

export function medicalParts(n: NodeModel): Part[] {
  switch (n.shape) {
    case 'photo': return photo(n);
    case 'he': return framed(n, (b, r) => hne(b, r, /\bunstained\b/.test(n.spec) ? UNSTAINED : HE));
    case 'autofluo': return framed(n, (b, r) => autofluo(b, r, /\bgray\b/.test(n.spec) ? AF_GRAY : AF));
    case 'mpm': return framed(n, mpm);
    case 'ihc': return framed(n, ihc);
    case 'fluor': return framed(n, fluor);
    case 'wsi': return framed(n, (b, r) => wsi(b, r, n.spec));
    case 'ct': return framed(n, (b, r) => ct(b, r, /\bseg\b/.test(n.spec)));
    case 'mri': return framed(n, (b, r) => mri(b, r, /\bseg\b/.test(n.spec)));
    case 'xray': return framed(n, xray);
    case 'us': return framed(n, ultrasound);
    case 'fundus': return framed(n, fundus);
    case 'oct': return framed(n, oct);
    case 'derm': return framed(n, derm);
    case 'ecg': return framed(n, ecg);
    default: return icon(n);
  }
}

export const MEDICAL_IMAGES = ['he', 'autofluo', 'mpm', 'ihc', 'fluor', 'wsi', 'ct', 'mri', 'xray', 'us', 'fundus', 'oct', 'derm', 'ecg'] as const;
