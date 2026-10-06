// Forme del modulo "Ottica e fotonica": componenti ottici in vista laterale (lenti, specchi,
// beam splitter, sorgenti, fasci, rivelatori...), dispositivi fotonici integrati (MZI, anelli,
// chip) e immagini di intensità/fase (speckle, Airy, frange). Tutte procedurali e
// deterministiche (rng), disegnate con le primitive `Part`: identiche in SVG, PDF, PNG e TikZ.
//
// Le forme orientabili usano `direction`: verso della luce in uscita (sorgenti, fasci, lenti)
// o lato attivo (specchi, rivelatori, obiettivi). Le varianti si scelgono con `spec`; i valori
// ammessi sono in `specOptions`, in fondo al file.
import { arc, framed, mix, orient, poly, rng, shade, type Box, type Cmd, type Part, type Rand } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';

type P2 = [number, number];
type N = NodeModel;
type O = ReturnType<typeof orient>;

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const has = (spec: string, word: string) => new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, 'i').test(spec);
const kindOf = <T extends string>(spec: string, kinds: readonly T[], fb: T): T => kinds.find((k) => has(spec, k)) ?? fb;
const inkOf = (n: N, fb = '#444444') => (n.stroke === 'none' ? fb : n.stroke);
const fillOf = (n: N, fb = '#FFFFFF') => (n.fill === 'none' ? fb : n.fill);
const variantOf = (spec: string) => +(/(^|\s)v([1-6])(\s|$)/.exec(spec)?.[2] ?? 0);

// colori fissi dei dettagli (i colori principali vengono dal blocco)
const BEAM = '#D9534F';
const BEAM_FILL = '#F8CECC';
const GLASS = '#DCEBF7';
const GLASS_INK = '#6C8EBF';
const DARK = '#4B5563';
const AXIS = '#8A9099';
const TEXT = '#4B5563';
const FIBER = '#D79B00';
const HEAT = '#C0392B';
const RAINBOW = ['#E53935', '#FB8C00', '#F2C200', '#43A047', '#1E88E5', '#5E35B1'];

const line = (cmds: Cmd[], stroke: string, sw: number): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true });
const area = (cmds: Cmd[], fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'path', cmds, fill, stroke, sw, solid: true });
const disc = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true });
const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];
const text = (x: number, y: number, t: string, size: number, anchor: 'start' | 'middle' | 'end' = 'middle', fill = TEXT): Part => ({ kind: 'text', x, y, text: t, size, fill, anchor });
const textW = (t: string, size: number) => t.replace(/\$|\\[a-zA-Z]+|[_^{}]/g, (m) => (m.startsWith('\\') ? 'x' : '')).length * size * 0.55;

function head(tip: P2, dx: number, dy: number, size: number, color: string): Part {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const bx = tip[0] - ux * size, by = tip[1] - uy * size;
  const hw = size * 0.45;
  return { kind: 'path', fill: color, stroke: 'none', cmds: poly([tip, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]) };
}

function arrow(a: P2, b: P2, color: string, sw: number, size: number): Part[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const cut = Math.min(size * 0.8, l * 0.5);
  const end: P2 = [b[0] - ((b[0] - a[0]) / l) * cut, b[1] - ((b[1] - a[1]) / l) * cut];
  return [line(seg(a, end), color, sw), head(b, b[0] - a[0], b[1] - a[1], size, color)];
}

/** Tratteggio lungo una polilinea secondo uno schema [pieno, vuoto, pieno, vuoto...]. */
function dashes(pts: P2[], pattern: number[]): Cmd[] {
  const out: Cmd[] = [];
  let k = 0, left = pattern[0], pen = false;
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    let L = Math.hypot(bx - ax, by - ay);
    if (L === 0) continue;
    const ux = (bx - ax) / L, uy = (by - ay) / L;
    while (L > 1e-6) {
      const step = Math.min(left, L);
      const nx = ax + ux * step, ny = ay + uy * step;
      if (k % 2 === 0) {
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
        k = (k + 1) % pattern.length;
        left = pattern[k];
        pen = false;
      }
    }
  }
  return out;
}

// ---------- coordinate locali (u lungo l'asse ottico, v trasversale) ----------

const lr = (o: O, u0: number, v0: number, u1: number, v1: number) => {
  const [ax, ay] = o.at(u0, v0), [bx, by] = o.at(u1, v1);
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
};
const lrect = (o: O, u0: number, v0: number, u1: number, v1: number, fill: string, r = 0, extra: { stroke?: string; sw?: number } = {}): Part => ({ kind: 'rect', ...lr(o, u0, v0, u1, v1), r, fill, ...extra });
const lpoly = (o: O, pts: P2[], close = true) => poly(pts.map(([u, v]) => o.at(u, v)), close);
/** Quadratica (in coordinate locali) scritta come cubica equivalente. */
function lq(o: O, p0: P2, c: P2, p2: P2): Cmd {
  const c1: P2 = [p0[0] + ((c[0] - p0[0]) * 2) / 3, p0[1] + ((c[1] - p0[1]) * 2) / 3];
  const c2: P2 = [p2[0] + ((c[0] - p2[0]) * 2) / 3, p2[1] + ((c[1] - p2[1]) * 2) / 3];
  return ['C', ...o.at(c1[0], c1[1]), ...o.at(c2[0], c2[1]), ...o.at(p2[0], p2[1])];
}
const lpt = (o: O, u: number, v: number): P2 => o.at(u, v);

// ---------- colormap ----------

const CMAPS: Record<string, string[]> = {
  gray: ['#000000', '#FFFFFF'],
  hot: ['#000000', '#5C0000', '#B80000', '#FF1A00', '#FF7A00', '#FFD000', '#FFFF70', '#FFFFFF'],
  viridis: ['#440154', '#482878', '#3E4A89', '#31688E', '#26828E', '#1F9E89', '#35B779', '#6DCD59', '#FDE725'],
  magma: ['#000004', '#1C1044', '#4F127B', '#812581', '#B5367A', '#E55064', '#FB8761', '#FEC287', '#FCFDBF'],
  jet: ['#00007F', '#0000FF', '#007FFF', '#00FFFF', '#7FFF7F', '#FFFF00', '#FF7F00', '#FF0000', '#7F0000'],
  twilight: ['#E2D9E2', '#9EBBC9', '#6A8FC0', '#5C4EA8', '#2F1436', '#6C2154', '#B5554D', '#D6A28C', '#E2D9E2'],
  green: ['#000000', '#0B3D0B', '#1F7A1F', '#4CD34C', '#D2FFD2'],
  blue: ['#2C5A9A', '#B8D4EE'],
};
const CMAP_NAMES = ['gray', 'hot', 'viridis', 'magma', 'jet', 'twilight', 'green', 'blue'] as const;
const LEVELS = 32;
const cmap = (stops: string[], v: number) => {
  const s = (Math.round(clamp(v, 0, 1) * LEVELS) / LEVELS) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(s));
  return mix(stops[i], stops[i + 1], s - i);
};

/** Campo liscio casuale: somma di gaussiane con segno casuale. */
function smoothField(rand: Rand, k: number, s0: number, s1: number) {
  const bumps = Array.from({ length: k }, () => ({ x: rand() * 1.2 - 0.1, y: rand() * 1.2 - 0.1, s: s0 + (s1 - s0) * rand(), a: rand() * 2 - 1 }));
  return (u: number, v: number) => {
    let t = 0;
    for (const b of bumps) t += b.a * Math.exp(-((u - b.x) ** 2 + (v - b.y) ** 2) / (b.s * b.s));
    return t;
  };
}

type Map2 = (u: number, v: number) => P2;

/** Celle di un campo su griglia, unite in strisce orizzontali dello stesso colore. */
function fieldCells(cols: number, rows: number, color: (i: number, j: number) => string | null, map: Map2, rect: boolean): Part[] {
  const parts: Part[] = [];
  const [x0, y0] = map(0, 0), [x1] = map(1, 0), [, y1] = map(0, 1);
  const bw = Math.abs(x1 - x0) || 1, bh = Math.abs(y1 - y0) || 1;
  const eu = 0.4 / bw, ev = 0.4 / bh;
  for (let j = 0; j < rows; j++) {
    let i = 0;
    while (i < cols) {
      const c = color(i, j);
      let k = i + 1;
      while (k < cols && color(k, j) === c) k++;
      if (c) {
        if (rect) parts.push({ kind: 'rect', x: x0 + (bw * i) / cols, y: y0 + (bh * j) / rows, w: (bw * (k - i)) / cols + 0.4, h: bh / rows + 0.4, r: 0, fill: c, stroke: 'none' });
        else {
          const u0 = i / cols, u1 = Math.min(1, k / cols + eu), v0 = j / rows, v1 = Math.min(1, (j + 1) / rows + ev);
          parts.push(area(poly([map(u0, v0), map(u1, v0), map(u1, v1), map(u0, v1)]), c));
        }
      }
      i = k;
    }
  }
  return parts;
}

/** Piano visto di sbieco (strati diffrattivi, piani di ingresso/uscita): bordo destro più alto. */
const perspMap = (n: N): Map2 => {
  const sk = n.h * 0.2;
  return (u, v) => [n.x + u * n.w, n.y + sk * (1 - u) + v * (n.h - sk)];
};

// ======================================================================
// Lenti, specchi, beam splitter
// ======================================================================

function lensShape(n: N): Part[] {
  const o = orient(n);
  const { W, H } = o;
  const kind = kindOf(n.spec, ['convex', 'concave', 'plano', 'planoconcave', 'fresnel'] as const, 'convex');
  const col = inkOf(n);
  if (kind === 'fresnel') {
    // lato piano e zone di Fresnel: spessore che cala con r² e riparte a ogni zona
    const zones = clamp(Math.round(n.count), 1, 10), base = W * 0.3;
    const pts: P2[] = [[0, 0]];
    for (let i = 0; i <= 240; i++) {
      const v = (H * i) / 240;
      pts.push([base + (W - base) * (1 - ((((v - H / 2) / (H / 2)) ** 2 * zones * 0.999) % 1)), v]);
    }
    pts.push([0, H]);
    return [area(lpoly(o, pts), n.fill, col, n.strokeWidth)];
  }
  if (has(n.spec, 'thin')) {
    const m = W / 2, hl = clamp(H * 0.12, 4, 9), hw = clamp(W * 0.45, 3, 6.5);
    const out = kind === 'convex' || kind === 'plano';
    const tri = (tip: number, base: number): Part => area(lpoly(o, [[m, tip], [m - hw, base], [m + hw, base]]), col);
    return [
      line(lpoly(o, [[m, out ? 2 : hl], [m, out ? H - 2 : H - hl]], false), col, n.strokeWidth * 1.2),
      out ? tri(0, hl) : tri(hl, 0),
      out ? tri(H, H - hl) : tri(H - hl, H),
    ];
  }
  const c = 0.12 + 0.088 * clamp(n.count, 0, 10);
  const half = W / 2;
  const sag = kind === 'convex' || kind === 'plano' ? half * c : Math.max(0, half - 1.5) * c;
  const [L, R]: [P2, P2] =
    kind === 'convex' ? [[sag, 0], [W - sag, W]] : kind === 'concave' ? [[0, sag], [W, W - sag]] : kind === 'plano' ? [[0, 0], [W - 2 * sag, W]] : [[0, 0], [W, W - 2 * sag]];
  return [
    {
      kind: 'path',
      fill: n.fill,
      cmds: [['M', ...o.at(L[0], 0)], lq(o, [L[0], 0], [2 * L[1] - L[0], H / 2], [L[0], H]), ['L', ...o.at(R[0], H)], lq(o, [R[0], H], [2 * R[1] - R[0], H / 2], [R[0], 0]), ['Z']],
    },
  ];
}

/** Lastra lungo la diagonale del riquadro ('/' o '\'), con la faccia attiva verso `direction`. */
function diagGeom(n: N, slash: boolean, tFrac: number) {
  const { x, y, w, h } = n;
  const t = clamp(Math.min(w, h) * tFrac, 2.5, 10);
  let a: P2 = slash ? [x, y + h] : [x, y];
  let b: P2 = slash ? [x + w, y] : [x + w, y + h];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const d: P2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const cut = t * 0.55;
  a = [a[0] + d[0] * cut, a[1] + d[1] * cut];
  b = [b[0] - d[0] * cut, b[1] - d[1] * cut];
  let F: P2 = [-d[1], d[0]];
  const dir = n.direction;
  if ((dir === 'right' && F[0] < 0) || (dir === 'left' && F[0] > 0) || (dir === 'bottom' && F[1] < 0) || (dir === 'top' && F[1] > 0)) F = [-F[0], -F[1]];
  const off = (p: P2, s: number): P2 => [p[0] + F[0] * s, p[1] + F[1] * s];
  const body: P2[] = [off(a, t / 2), off(b, t / 2), off(b, -t / 2), off(a, -t / 2)];
  return { a, b, d, F, t, off, body };
}

function rotArrow(cx: number, cy: number, R: number, a0: number, a1: number, col: string, both: boolean): Part[] {
  const hs = clamp(R * 0.3, 3.5, 6);
  const parts: Part[] = [line(arc(cx, cy, R, a0, a1), col, 1)];
  parts.push(head([cx + R * Math.cos(a1), cy + R * Math.sin(a1)], -Math.sin(a1), Math.cos(a1), hs, col));
  if (both) parts.push(head([cx + R * Math.cos(a0), cy + R * Math.sin(a0)], Math.sin(a0), -Math.cos(a0), hs, col));
  return parts;
}

function mirrorShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['flat', 'concave', 'convex', 'polygon'] as const, 'flat');
  const col = inkOf(n), sw = n.strokeWidth;
  const face = shade(col, -0.3);
  const galvo = has(n.spec, 'galvo');
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  if (kind === 'polygon') {
    const R = Math.min(n.w, n.h) * 0.36;
    const pts = Array.from({ length: 8 }, (_, k): P2 => [cx + R * Math.cos((TAU * k) / 8 + TAU / 16), cy + R * Math.sin((TAU * k) / 8 + TAU / 16)]);
    return [
      area(poly(pts), n.fill, col, sw),
      line(poly(pts), face, sw * 1.6),
      disc(cx, cy, R * 0.14, col),
      ...rotArrow(cx, cy, R * 1.3, -Math.PI * 0.75, -Math.PI * 0.25, col, false),
    ];
  }
  const tilt = has(n.spec, 'd45') ? 'd45' : has(n.spec, 'd135') ? 'd135' : '';
  if (tilt) {
    const g = diagGeom(n, tilt === 'd45', 0.16);
    const K = Math.max(3, Math.round(Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) / 5));
    const ticks: Cmd[] = [];
    for (let k = 1; k < K; k++) {
      const p: P2 = [g.a[0] + ((g.b[0] - g.a[0]) * k) / K, g.a[1] + ((g.b[1] - g.a[1]) * k) / K];
      const q = g.off(p, -g.t / 2);
      ticks.push(...seg(p, [q[0] + (g.d[0] * g.t) / 2, q[1] + (g.d[1] * g.t) / 2]));
    }
    const parts: Part[] = [area(poly(g.body), n.fill, col, sw * 0.8), line(ticks, col, 0.6), line(seg(g.off(g.a, g.t / 2), g.off(g.b, g.t / 2)), face, sw * 1.7)];
    if (galvo) {
      const ang = Math.atan2(-g.F[1], -g.F[0]);
      parts.push(...rotArrow(cx, cy, Math.min(n.w, n.h) * 0.5, ang - 0.55, ang + 0.55, col, true));
    }
    return parts;
  }
  const o = orient(n);
  const { W, H } = o;
  const s = Math.min(W * 0.45, H * 0.14);
  const start: P2 = kind === 'convex' ? [W - s, 0] : [W, 0];
  const curve: Cmd = kind === 'flat' ? ['L', ...o.at(W, H)] : kind === 'concave' ? lq(o, [W, 0], [W - 2 * s, H / 2], [W, H]) : lq(o, [W - s, 0], [W + s, H / 2], [W - s, H]);
  const body: Cmd[] = [['M', ...o.at(0, 0)], ['L', ...o.at(start[0], start[1])], curve, ['L', ...o.at(0, H)], ['Z']];
  const Wb = W * 0.5;
  const step = clamp(Wb * 0.9, 3, 6);
  const ticks: Cmd[] = [];
  for (let v = 1; v + Wb <= H - 1; v += step) ticks.push(...seg(o.at(0, v + Wb), o.at(Wb, v)));
  const parts: Part[] = [area(body, n.fill, col, sw * 0.8), line(ticks, col, 0.6), line([['M', ...o.at(start[0], start[1])], curve], face, sw * 1.7)];
  if (galvo) {
    const [bx, by] = o.at(0, H / 2), [fx, fy] = o.at(W, H / 2);
    const ang = Math.atan2(by - fy, bx - fx);
    parts.push(disc(cx, cy, 1.6, col), ...rotArrow(cx, cy, H * 0.32, ang - 0.6, ang + 0.6, col, true));
  }
  return parts;
}

function bsShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['cube', 'plate', 'pbs', 'dichroic'] as const, 'cube');
  const slash = !has(n.spec, 'd135');
  const col = inkOf(n), sw = n.strokeWidth;
  if (kind === 'cube' || kind === 'pbs') {
    const s = Math.min(n.w, n.h), x = n.x + (n.w - s) / 2, y = n.y + (n.h - s) / 2;
    const a: P2 = slash ? [x, y + s] : [x, y], b: P2 = slash ? [x + s, y] : [x + s, y + s];
    const parts: Part[] = [{ kind: 'rect', x, y, w: s, h: s, r: 0, fill: n.fill }];
    if (kind === 'pbs') {
      const e = 1.6 / Math.SQRT2, sg = slash ? 1 : -1;
      parts.push(line([...seg([a[0] + e, a[1] + e * sg], [b[0] + e, b[1] + e * sg]), ...seg([a[0] - e, a[1] - e * sg], [b[0] - e, b[1] - e * sg])], shade(col, -0.15), sw * 0.9));
    } else parts.push(line(seg(a, b), shade(col, -0.15), sw * 1.3));
    return parts;
  }
  const g = diagGeom(n, slash, 0.12);
  const parts: Part[] = [area(poly(g.body), n.fill, col, sw)];
  if (kind === 'dichroic') parts.push(line(seg(g.off(g.a, g.t / 2), g.off(g.b, g.t / 2)), shade(col, -0.25), sw * 1.8));
  return parts;
}

// ======================================================================
// Sorgenti e fasci
// ======================================================================

function warningSign(x: number, y: number, s: number): Part[] {
  const cx = x + s / 2, cy = y + s * 0.58;
  const rays: Cmd[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (TAU * k) / 8;
    rays.push(...seg([cx + Math.cos(a) * s * 0.1, cy + Math.sin(a) * s * 0.1], [cx + Math.cos(a) * s * 0.2, cy + Math.sin(a) * s * 0.2]));
  }
  return [
    area(poly([[x, y + s * 0.87], [cx, y], [x + s, y + s * 0.87]]), '#FFD43B', '#333333', 0.7),
    disc(cx, cy, s * 0.06, '#333333'),
    line(rays, '#333333', 0.6),
  ];
}

function laserShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['box', 'tube', 'diode'] as const, 'box');
  const o = orient(n);
  const { W, H } = o;
  const col = inkOf(n);
  const nose = '#5B6270';
  if (kind === 'diode') {
    const leads: Cmd[] = [];
    for (const v of [0.3, 0.5, 0.7]) leads.push(...seg(o.at(0, H * v), o.at(W * 0.3, H * v)));
    return [
      line(leads, col, 0.9),
      lrect(o, W * 0.28, 0, W * 0.38, H, shade(n.fill, -0.08), 1),
      lrect(o, W * 0.38, H * 0.12, W * 0.9, H * 0.88, n.fill, 2),
      lrect(o, W * 0.9, H * 0.3, W, H * 0.7, GLASS, 1, { stroke: GLASS_INK }),
    ];
  }
  if (kind === 'tube') {
    return [lrect(o, 0, H * 0.14, W * 0.88, H * 0.86, n.fill, H * 0.3), lrect(o, W * 0.88, H * 0.36, W, H * 0.64, nose, 1)];
  }
  const ap = clamp(W * 0.06, 3, 7);
  const body = lrect(o, 0, 0, W - ap, H, n.fill, Math.min(n.radius, 6));
  const parts: Part[] = [body, lrect(o, W - ap, H * 0.32, W, H * 0.68, nose, 1)];
  if (has(n.spec, 'sign') && body.kind === 'rect') parts.push(...warningSign(body.x + 5, body.y + 4, clamp(H * 0.3, 8, 14)));
  return parts;
}

function sourceShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['lamp', 'led', 'ledarray', 'broadband', 'point'] as const, 'lamp');
  const { x, y, w, h } = n;
  const col = inkOf(n), sw = n.strokeWidth;
  const cx = x + w / 2, cy = y + h / 2;
  const rays = (rx: number, ry: number, r0: number, r1: number, angles: number[]): Part =>
    line(angles.flatMap((a) => seg([rx + Math.cos(a) * r0, ry + Math.sin(a) * r0], [rx + Math.cos(a) * r1, ry + Math.sin(a) * r1])), col, sw * 0.8);
  switch (kind) {
    case 'point': {
      const r = Math.min(w, h) / 2;
      return [rays(cx, cy, r * 0.32, r * 0.95, Array.from({ length: 8 }, (_, k) => (TAU * k) / 8)), disc(cx, cy, r * 0.2, n.fill, col, sw)];
    }
    case 'lamp': {
      const r = Math.min(w, h) * 0.3, by = y + h * 0.4;
      const fil: P2[] = Array.from({ length: 7 }, (_, k): P2 => [cx - r * 0.45 + (r * 0.9 * k) / 6, by + (k % 2 ? -r * 0.18 : r * 0.12)]);
      return [
        rays(cx, by, r * 1.3, r * 1.75, [-150, -115, -90, -65, -30, 0, 180].map((d) => (d * Math.PI) / 180)),
        disc(cx, by, r, n.fill, col, sw),
        { kind: 'rect', x: cx - r * 0.45, y: by + r * 0.82, w: r * 0.9, h: r * 0.7, r: 1.5, fill: shade(fillOf(n), -0.15) },
        line(poly(fil, false), shade(col, -0.2), 0.8),
      ];
    }
    case 'broadband': {
      const o = orient(n);
      const { W, H } = o;
      const bar = clamp(W * 0.1, 4, 10);
      const parts: Part[] = [lrect(o, 0, 0, W - bar, H, n.fill, Math.min(n.radius, 6))];
      RAINBOW.forEach((c, i) => parts.push(lrect(o, W - bar, H * (0.2 + (0.6 * i) / 6), W, H * (0.2 + (0.6 * (i + 1)) / 6), c, 0, { stroke: 'none' })));
      parts.push(lrect(o, W - bar, H * 0.2, W, H * 0.8, 'none', 0, { sw: 0.8 }));
      return parts;
    }
    case 'led': {
      const o = orient(n);
      const { W, H } = o;
      const r = H * 0.26, u1 = W * 0.82 - r;
      const legs: Cmd[] = [...seg(o.at(0, H * 0.4), o.at(W * 0.28, H * 0.4)), ...seg(o.at(0, H * 0.6), o.at(W * 0.28, H * 0.6))];
      const dome: Cmd[] = [['M', ...o.at(W * 0.32, H / 2 - r)], ['L', ...o.at(u1, H / 2 - r)], lq(o, [u1, H / 2 - r], [u1 + 2 * r, H / 2], [u1, H / 2 + r]), ['L', ...o.at(W * 0.32, H / 2 + r)], ['Z']];
      const tip = o.at(u1 + r * 1.2, H / 2);
      const ang = Math.atan2(tip[1] - o.at(0, H / 2)[1], tip[0] - o.at(0, H / 2)[0]);
      return [
        line(legs, col, sw),
        lrect(o, W * 0.26, H / 2 - r * 1.3, W * 0.33, H / 2 + r * 1.3, shade(fillOf(n), -0.1), 1),
        area(dome, n.fill, col, sw),
        rays(tip[0], tip[1], r * 0.5, r * 1.1, [ang - 0.6, ang, ang + 0.6]),
      ];
    }
    case 'ledarray': {
      const k = clamp(Math.round(n.count), 3, 24);
      const lit = Math.floor(k * 0.75);
      if (has(n.spec, 'grid')) {
        const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: 3, fill: n.fill }];
        const cw = w / k, ch = h / k, r = Math.min(cw, ch) * 0.28;
        for (let j = 0; j < k; j++)
          for (let i = 0; i < k; i++) {
            const on = i === lit && j === Math.floor(k / 2);
            if (on) parts.push(disc(x + (i + 0.5) * cw, y + (j + 0.5) * ch, r * 2, '#F8CECC'));
            parts.push(disc(x + (i + 0.5) * cw, y + (j + 0.5) * ch, r, on ? '#E5484D' : '#3A3F47'));
          }
        return parts;
      }
      const o = orient(n);
      const { W, H } = o;
      const s = Math.min((H / k) * 0.6, W * 0.22);
      const parts: Part[] = [lrect(o, 0, 0, W * 0.3, H, n.fill, 1.5)];
      for (let i = 0; i < k; i++) {
        const v = (H * (i + 0.5)) / k;
        parts.push(lrect(o, W * 0.3, v - s / 2, W * 0.3 + s, v + s / 2, i === lit ? '#E5484D' : '#3A3F47', 0.8, { stroke: 'none' }));
      }
      const v = (H * (lit + 0.5)) / k;
      const fan: Cmd[] = [-0.35, 0, 0.35].flatMap((a) => seg(o.at(W * 0.3 + s * 1.5, v), o.at(W * 0.95, v + Math.tan(a) * W * 0.6)));
      parts.push(line(fan, '#E5484D', 0.9));
      return parts;
    }
  }
}

function beamShape(n: N): Part[] {
  const o = orient(n);
  const { W, H } = o;
  const prof = kindOf(n.spec, ['collimated', 'focus', 'diverge', 'waist'] as const, 'collimated');
  const m = clamp(n.count, 0, 100) / 100;
  const col = inkOf(n, BEAM);
  const zr = m > 0.01 && m < 0.999 ? m / Math.sqrt(1 - m * m) : 1;
  const width = (t: number) => {
    if (prof === 'focus') return 1 - (1 - m) * t;
    if (prof === 'diverge') return m + (1 - m) * t;
    if (prof === 'waist') {
      const z = 2 * t - 1;
      return m < 0.01 ? Math.abs(z) : m >= 0.999 ? 1 : m * Math.sqrt(1 + (z / zr) ** 2);
    }
    return 1;
  };
  const K = prof === 'waist' ? 48 : 1;
  // cs1/cs2, ce1/ce2: inizio/fine tagliati a 45° (pendenza +1/-1 in coordinate locali)
  const cs = has(n.spec, 'cs1') ? 1 : has(n.spec, 'cs2') ? -1 : 0, ce = has(n.spec, 'ce1') ? 1 : has(n.spec, 'ce2') ? -1 : 0;
  const edge = (f: number, s: number): P2[] =>
    Array.from({ length: K + 1 }, (_, i): P2 => {
      const v = H / 2 + (s * f * width(i / K) * H) / 2;
      return [(W * i) / K + (i === 0 ? cs : i === K ? ce : 0) * (v - H / 2), v];
    });
  const band = (f: number) => lpoly(o, [...edge(f, -1), ...edge(f, 1).reverse()]);
  const parts: Part[] = [area(band(1), n.fill)];
  if (has(n.spec, 'gauss')) parts.push(area(band(0.64), mix(fillOf(n, BEAM_FILL), col, 0.16)), area(band(0.3), mix(fillOf(n, BEAM_FILL), col, 0.34)));
  if (has(n.spec, 'fronts')) {
    const kf = Math.max(2, Math.round(W / Math.max(12, H * 0.42)));
    const ta = prof === 'focus' ? 1 / Math.max(1e-3, 1 - m) : prof === 'diverge' ? -m / Math.max(1e-3, 1 - m) : 0;
    const fr: Cmd[] = [];
    for (let i = 0; i < kf; i++) {
      const t = (i + 0.5) / kf, uc = W * t, hw = (width(t) * H) / 2 - 0.5;
      let R = Infinity;
      if (prof === 'focus' || prof === 'diverge') R = W * (t - ta);
      if (prof === 'waist') {
        const z = 2 * t - 1;
        R = Math.abs(z) < 1e-3 ? Infinity : z * (1 + (zr / z) ** 2) * (W / 2);
      }
      const s = clamp(-(hw * hw) / (2 * R), -Math.min(hw * 0.9, W * 0.12), Math.min(hw * 0.9, W * 0.12));
      fr.push(['M', ...o.at(uc + s, H / 2 - hw)], lq(o, [uc + s, H / 2 - hw], [uc - s, H / 2], [uc + s, H / 2 + hw]));
    }
    parts.push(line(fr, col, 0.7));
  }
  if (n.stroke !== 'none') parts.push(line(lpoly(o, edge(1, -1), false), col, n.strokeWidth * 0.6), line(lpoly(o, edge(1, 1), false), col, n.strokeWidth * 0.6));
  if (has(n.spec, 'axis')) parts.push(line(dashes([lpt(o, 0, H / 2), lpt(o, W, H / 2)], [7, 2.5, 1.5, 2.5]), shade(col, -0.1), 0.7));
  return parts;
}

/** Cono di luce da un punto a tutto il lato opposto (o viceversa), oppure banda inclinata. */
function fanShape(n: N): Part[] {
  const o = orient(n);
  const { W, H } = o;
  const kind = kindOf(n.spec, ['cone', 'focus', 'band'] as const, 'cone');
  const a = (clamp(n.count, 0, 100) / 100) * H;
  const col = inkOf(n, BEAM);
  let pts: P2[];
  let edges: [P2, P2][];
  if (kind === 'band') {
    const bw = Math.max(1, a);
    pts = has(n.spec, 'up') ? [[0, H - bw], [W, 0], [W, bw], [0, H]] : [[0, 0], [W, H - bw], [W, H], [0, bw]];
    edges = [[pts[0], pts[1]], [pts[3], pts[2]]];
  } else if (kind === 'focus') {
    pts = [[0, 0], [W, a], [0, H]];
    edges = [[pts[0], pts[1]], [pts[2], pts[1]]];
  } else {
    pts = [[0, a], [W, 0], [W, H]];
    edges = [[pts[0], pts[1]], [pts[0], pts[2]]];
  }
  const parts: Part[] = [area(lpoly(o, pts), n.fill)];
  if (n.stroke !== 'none') parts.push(line(edges.flatMap(([p, q]) => seg(lpt(o, p[0], p[1]), lpt(o, q[0], q[1]))), col, n.strokeWidth * 0.6));
  return parts;
}

function raysShape(n: N): Part[] {
  const o = orient(n);
  const { W, H } = o;
  const k = clamp(Math.round(n.count), 1, 15);
  const kind = kindOf(n.spec, ['parallel', 'focus', 'diverge', 'cross'] as const, 'parallel');
  const col = inkOf(n, BEAM), sw = n.strokeWidth;
  const vs = k === 1 ? [H / 2] : Array.from({ length: k }, (_, i) => H * (0.03 + (0.94 * i) / (k - 1)));
  const parts: Part[] = [];
  const hs = clamp(sw * 3.6, 4, 7);
  for (const v of vs) {
    const [p0, p1]: [P2, P2] = kind === 'focus' ? [[0, v], [W, H / 2]] : kind === 'diverge' ? [[0, H / 2], [W, v]] : kind === 'cross' ? [[0, v], [W, H - v]] : [[0, v], [W, v]];
    const A = lpt(o, p0[0], p0[1]), B = lpt(o, p1[0], p1[1]);
    parts.push(line(seg(A, B), col, sw));
    if (has(n.spec, 'arrows')) {
      const t = kind === 'cross' ? 0.3 : 0.55;
      parts.push(head([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t], B[0] - A[0], B[1] - A[1], hs, col));
    }
  }
  return parts;
}

function axisShape(n: N): Part[] {
  const o = orient(n);
  const { W, H } = o;
  const col = inkOf(n, AXIS);
  const end = has(n.spec, 'arrow') ? W - 7 : W;
  const parts: Part[] = [line(dashes([lpt(o, 0, H / 2), lpt(o, end, H / 2)], [9, 3, 2, 3]), col, n.strokeWidth)];
  if (has(n.spec, 'arrow')) parts.push(...arrow(lpt(o, end - 1, H / 2), lpt(o, W, H / 2), col, n.strokeWidth, 6));
  return parts;
}

// ======================================================================
// Fibre, guide d'onda, accoppiatori
// ======================================================================

function fiberShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['coil', 'straight', 'collimator', 'cross'] as const, 'coil');
  const col = inkOf(n, FIBER), sw = Math.max(1.4, n.strokeWidth * 1.5);
  const { x, y, w, h } = n;
  const cx = x + w / 2, cy = y + h / 2;
  switch (kind) {
    case 'cross': {
      const R = Math.min(w, h) / 2;
      return [disc(cx, cy, R, shade(fillOf(n), -0.08), col, n.strokeWidth), disc(cx, cy, R * 0.64, fillOf(n), col, 0.8), disc(cx, cy, R * 0.18, BEAM_FILL, BEAM, 0.9)];
    }
    case 'straight': {
      const cw = clamp(w * 0.08, 5, 10), ch = clamp(h * 0.7, 5, 9);
      const fer = (fx: number): Part => ({ kind: 'rect', x: fx, y: cy - ch / 2, w: cw, h: ch, r: 1, fill: n.fill, stroke: shade(col, -0.25), sw: 0.8 });
      return [line(seg([x + cw, cy], [x + w - cw, cy]), col, sw), fer(x), fer(x + w - cw)];
    }
    case 'collimator': {
      const o = orient(n);
      const { W, H } = o;
      return [
        line(lpoly(o, [[0, H / 2], [W * 0.32, H / 2]], false), FIBER, sw),
        lrect(o, W * 0.3, H * 0.22, W * 0.88, H * 0.78, n.fill, 1.5),
        area([['M', ...o.at(W * 0.88, H * 0.16)], lq(o, [W * 0.88, H * 0.16], [W * 1.12, H / 2], [W * 0.88, H * 0.84]), ['Z']], GLASS, GLASS_INK, 0.9),
      ];
    }
    default: {
      const rx = w * 0.24, ry = h * 0.42, off = w * 0.07;
      const loops: Part[] = [-off, 0, off].map((dx) => ({ kind: 'ellipse', cx: cx + dx, cy, rx, ry, fill: 'none', stroke: col, sw, solid: true }));
      return [line([...seg([x, cy], [cx - off - rx, cy]), ...seg([cx + off + rx, cy], [x + w, cy])], col, sw), ...loops];
    }
  }
}

function waveguideShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['slab', 'mode', 'ridge', 'bend'] as const, 'slab');
  const { x, y, w, h } = n;
  const col = inkOf(n), sw = n.strokeWidth;
  const core = fillOf(n, '#DAE8FC'), clad = mix(core, '#FFFFFF', 0.65);
  const ls = clamp(h * 0.14, 8, 11);
  const labels = has(n.spec, 'labels');
  if (kind === 'ridge') {
    const parts: Part[] = [
      { kind: 'rect', x, y: y + h * 0.72, w, h: h * 0.28, r: 0, fill: '#E5E7EB', sw: sw * 0.7 },
      { kind: 'rect', x, y: y + h * 0.52, w, h: h * 0.2, r: 0, fill: clad, sw: sw * 0.7 },
      { kind: 'rect', x: x + w * 0.36, y: y + h * 0.26, w: w * 0.28, h: h * 0.26, r: 1, fill: core },
    ];
    [[0.12, 0.1, '#F7DEDB'], [0.08, 0.07, '#F2B8B0'], [0.04, 0.035, '#E57368']].forEach(([rx, ry, c]) =>
      parts.push({ kind: 'ellipse', cx: x + w / 2, cy: y + h * 0.39, rx: w * (rx as number), ry: h * (ry as number), fill: c as string, stroke: 'none' }),
    );
    if (labels) parts.push(text(x + w * 0.68, y + h * 0.3, 'Si', ls, 'start'), text(x + 4, y + h * 0.62, 'SiO$_2$', ls, 'start'), text(x + 4, y + h * 0.86, 'Si substrate', ls, 'start'));
    return parts;
  }
  if (kind === 'bend') {
    const c: Cmd[] = [['M', x, y + h * 0.78], ['L', x + w * 0.15, y + h * 0.78], ['C', x + w * 0.5, y + h * 0.78, x + w * 0.5, y + h * 0.22, x + w * 0.85, y + h * 0.22], ['L', x + w, y + h * 0.22]];
    return [line(c, mix(col, '#FFFFFF', 0.75), Math.max(4, sw * 4)), line(c, col, Math.max(1.6, sw * 1.6))];
  }
  const mode = kind === 'mode';
  const y1 = y + h * 0.3, y2 = y + h * 0.7;
  const parts: Part[] = [
    { kind: 'rect', x, y, w, h: h * 0.3, r: 0, fill: clad, stroke: 'none' },
    { kind: 'rect', x, y: y1, w, h: h * 0.4, r: 0, fill: core, stroke: 'none' },
    { kind: 'rect', x, y: y2, w, h: h * 0.3, r: 0, fill: clad, stroke: 'none' },
    line([...seg([x, y1], [x + w, y1]), ...seg([x, y2], [x + w, y2])], col, sw * 0.8),
  ];
  const zx = mode ? x + w * 0.68 : x + w;
  const nb = Math.max(2, Math.round((zx - x) / (h * 0.55)));
  const zig: P2[] = Array.from({ length: nb + 1 }, (_, i): P2 => [x + ((zx - x) * i) / nb, i % 2 ? y2 - 1 : y1 + 1]);
  zig[0] = [x + (labels ? Math.min(w * 0.1, 22) : 0), (y1 + y2) / 2 - h * 0.1];
  parts.push(line(poly(zig, false), BEAM, 1));
  for (let i = 1; i < nb; i += 2) {
    const [a, b] = [zig[i], zig[i + 1]];
    parts.push(head([(a[0] + b[0]) / 2 + (b[0] - a[0]) * 0.1, (a[1] + b[1]) / 2 + (b[1] - a[1]) * 0.1], b[0] - a[0], b[1] - a[1], 4.5, BEAM));
  }
  if (mode) {
    const bx = x + w * 0.8, A = w * 0.17;
    const prof: P2[] = Array.from({ length: 31 }, (_, i): P2 => {
      const v = 0.04 + (0.92 * i) / 30;
      return [bx + A * Math.exp(-(((v - 0.5) / 0.17) ** 2)), y + v * h];
    });
    parts.push(area(poly([[bx, y + h * 0.04], ...prof, [bx, y + h * 0.96]]), BEAM_FILL), line(poly(prof, false), BEAM, 1), line(seg([bx, y + h * 0.02], [bx, y + h * 0.98]), AXIS, 0.7));
  }
  if (labels) parts.push(text(x + 4, y + h * 0.15, '$n_2$', ls, 'start'), text(x + 4, y + h * 0.5, '$n_1$', ls, 'start'), text(x + 4, y + h * 0.85, '$n_2$', ls, 'start'));
  return parts;
}

function couplerShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['dc', 'fused', 'ybranch', 'circulator'] as const, 'dc');
  const { x, y, w, h } = n;
  const col = inkOf(n), wg = Math.max(1.4, n.strokeWidth * 1.6);
  const X = (u: number) => x + u * w, Y = (v: number) => y + v * h;
  const sb = (u0: number, v0: number, u1: number, v1: number): Cmd => ['C', X((u0 + u1) / 2), Y(v0), X((u0 + u1) / 2), Y(v1), X(u1), Y(v1)];
  const lane = (v: number, vc: number): Cmd[] => [['M', X(0), Y(v)], ['L', X(0.12), Y(v)], sb(0.12, v, 0.38, vc), ['L', X(0.62), Y(vc)], sb(0.62, vc, 0.88, v), ['L', X(1), Y(v)]];
  switch (kind) {
    case 'circulator': {
      const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) * 0.28;
      const parts: Part[] = [
        line([...seg([x, cy], [cx - R, cy]), ...seg([cx + R, cy], [x + w, cy]), ...seg([cx, cy + R], [cx, y + h])], col, wg),
        disc(cx, cy, R, n.fill, col, n.strokeWidth),
        ...rotArrow(cx, cy, R * 0.58, Math.PI + 0.35, Math.PI * 2.5 - 0.35, col, false),
      ];
      if (has(n.spec, 'labels')) {
        const s = clamp(R * 0.45, 8, 11);
        parts.push(text(x + 3, cy - s * 0.9, '1', s, 'start'), text(x + w - 3, cy - s * 0.9, '2', s, 'end'), text(cx + s * 0.8, y + h - s * 0.6, '3', s, 'start'));
      }
      return parts;
    }
    case 'ybranch':
      return [line([['M', X(0), Y(0.5)], ['L', X(0.36), Y(0.5)], sb(0.36, 0.5, 0.82, 0.2), ['L', X(1), Y(0.2)], ['M', X(0.36), Y(0.5)], sb(0.36, 0.5, 0.82, 0.8), ['L', X(1), Y(0.8)]], col, wg)];
    case 'fused':
      return [line([...lane(0.2, 0.5), ...lane(0.8, 0.5)], col, wg), { kind: 'ellipse', cx: X(0.5), cy: Y(0.5), rx: w * 0.15, ry: Math.max(wg * 1.6, h * 0.1), fill: n.fill, stroke: col, sw: 0.9 }];
    default:
      return [line([...lane(0.2, 0.43), ...lane(0.8, 0.57)], col, wg)];
  }
}

// ======================================================================
// Rivelatori
// ======================================================================

function detectorShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['camera', 'sensor', 'linear', 'pd', 'pmt'] as const, 'camera');
  const col = inkOf(n), sw = n.strokeWidth;
  const fill = fillOf(n, '#F5F5F5');
  const { x, y, w, h } = n;
  if (kind === 'sensor') {
    const k = clamp(Math.round(n.count), 2, 24);
    const ix = x + w * 0.14, iy = y + h * 0.14, iw = w * 0.72, ih = h * 0.72;
    const rows = Math.max(1, Math.round((k * ih) / iw));
    const grid: Cmd[] = [];
    for (let i = 1; i < k; i++) grid.push(...seg([ix + (iw * i) / k, iy], [ix + (iw * i) / k, iy + ih]));
    for (let j = 1; j < rows; j++) grid.push(...seg([ix, iy + (ih * j) / rows], [ix + iw, iy + (ih * j) / rows]));
    const pads: Part[] = [];
    const np = Math.max(3, Math.round(w / 16));
    for (let i = 0; i < np; i++) {
      const px = x + w * 0.14 + (w * 0.72 * (i + 0.5)) / np - 2;
      pads.push({ kind: 'rect', x: px, y: y + h * 0.035, w: 4, h: h * 0.06, r: 0.5, fill: '#E3C77A', stroke: 'none' }, { kind: 'rect', x: px, y: y + h * 0.905, w: 4, h: h * 0.06, r: 0.5, fill: '#E3C77A', stroke: 'none' });
    }
    return [{ kind: 'rect', x, y, w, h, r: 3, fill: shade(fill, -0.1) }, ...pads, { kind: 'rect', x: ix, y: iy, w: iw, h: ih, r: 0, fill: shade(fill, 0.4), sw: sw * 0.8 }, line(grid, mix(col, '#FFFFFF', 0.35), 0.5)];
  }
  if (kind === 'linear') {
    const k = clamp(Math.round(n.count), 2, 48);
    const vert = h >= w;
    const L = vert ? h : w, c = L / k, g = c * 0.16;
    const parts: Part[] = [];
    for (let i = 0; i < k; i++)
      parts.push(vert ? { kind: 'rect', x, y: y + i * c + g / 2, w, h: c - g, r: 0.8, fill, sw: sw * 0.7 } : { kind: 'rect', x: x + i * c + g / 2, y, w: c - g, h, r: 0.8, fill, sw: sw * 0.7 });
    return parts;
  }
  const o = orient(n);
  const { W, H } = o;
  switch (kind) {
    case 'pd': {
      const K = 0.5523;
      const u0 = W * 0.32, um = W * 0.66;
      const d: Cmd[] = [
        ['M', ...o.at(W, H * 0.08)],
        ['L', ...o.at(um, H * 0.08)],
        ['C', ...o.at(um - (um - u0) * K, H * 0.08), ...o.at(u0, H * 0.5 - H * 0.42 * K), ...o.at(u0, H * 0.5)],
        ['C', ...o.at(u0, H * 0.5 + H * 0.42 * K), ...o.at(um - (um - u0) * K, H * 0.92), ...o.at(um, H * 0.92)],
        ['L', ...o.at(W, H * 0.92)],
        ['Z'],
      ];
      const wire: Cmd[] = [['M', ...o.at(u0, H * 0.5)], ['C', ...o.at(u0 * 0.55, H * 0.5), ...o.at(u0 * 0.75, H * 0.12), ...o.at(u0 * 0.35, H * 0.2)], ['C', ...o.at(0, H * 0.26), ...o.at(u0 * 0.2, H * 0.5), ...o.at(0, H * 0.46)]];
      return [line(wire, col, sw * 0.8), area(d, n.fill, col, sw)];
    }
    case 'pmt': {
      const zig: P2[] = Array.from({ length: 7 }, (_, i): P2 => [W * (0.2 + (0.58 * i) / 6), H * (i % 2 ? 0.36 : 0.64)]);
      return [lrect(o, 0, H * 0.14, W * 0.9, H * 0.86, n.fill, H * 0.2), lrect(o, W * 0.9, H * 0.2, W, H * 0.8, GLASS, 1, { stroke: GLASS_INK }), line(lpoly(o, zig, false), mix(col, '#FFFFFF', 0.2), 0.8)];
    }
    default: {
      const fins: Cmd[] = [0.06, 0.11, 0.16].flatMap((u) => seg(o.at(W * u, H * 0.26), o.at(W * u, H * 0.74)));
      return [
        lrect(o, 0, H * 0.06, W * 0.72, H * 0.94, n.fill, Math.min(n.radius, 5)),
        line(fins, mix(col, '#FFFFFF', 0.3), 0.8),
        lrect(o, W * 0.6, H * 0.24, W * 0.645, H * 0.76, DARK, 0, { stroke: 'none' }),
        lrect(o, W * 0.72, H * 0.26, W * 0.86, H * 0.74, shade(fill, -0.12), 1),
        lrect(o, W * 0.86, H * 0.22, W, H * 0.78, shade(fill, -0.24), 1),
      ];
    }
  }
}

// ======================================================================
// Reticoli, prismi, lamine, aperture
// ======================================================================

function gratingShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['blazed', 'binary', 'sine'] as const, 'blazed');
  const fan = has(n.spec, 'orders') ? 'orders' : has(n.spec, 'spectral') ? 'spectral' : '';
  const o = orient(n);
  const { W, H } = o;
  const col = inkOf(n);
  const g = clamp(Math.round(n.count), 2, 40);
  const sw2 = fan ? clamp(W * 0.2, 6, 16) : W;
  const a = Math.min(sw2 * 0.4, 6), base = sw2 - a, p = H / g;
  const pts: P2[] = [[0, 0], [base, 0]];
  for (let i = 0; i < g; i++) {
    const v = i * p;
    if (kind === 'blazed') pts.push([sw2, v + p], [base, v + p]);
    else if (kind === 'binary') pts.push([base, v + p * 0.25], [sw2, v + p * 0.25], [sw2, v + p * 0.75], [base, v + p * 0.75], [base, v + p]);
    else for (let s = 1; s <= 8; s++) pts.push([base + a * (0.5 - 0.5 * Math.cos((TAU * s) / 8)), v + (p * s) / 8]);
  }
  pts.push([0, H]);
  const parts: Part[] = [area(lpoly(o, pts), n.fill, col, n.strokeWidth * 0.8)];
  if (fan) {
    const src = lpt(o, sw2 + 1, H / 2);
    if (fan === 'orders') {
      const ls = clamp(H * 0.09, 8, 10);
      ([[0, '0'], [-1, '+1'], [1, '-1']] as const).forEach(([m, lab]) => {
        const v = H / 2 + m * H * 0.4;
        parts.push(...arrow(src, lpt(o, W - (m === 0 ? 0 : 2), v), BEAM, m === 0 ? 1.4 : 1, 5));
        const ul = sw2 + (W - sw2) * 0.66, vl = H / 2 + m * H * 0.4 * 0.66;
        const lp = lpt(o, ul, vl + (m === 0 ? -1 : m) * (ls * 0.9 + 2));
        parts.push(text(lp[0], lp[1], `$m=${lab}$`, ls, 'middle', TEXT));
      });
    } else {
      RAINBOW.forEach((c, i) => parts.push(line(seg(src, lpt(o, W, H * (0.1 + (0.8 * i) / (RAINBOW.length - 1)))), c, 1.1)));
    }
  }
  return parts;
}

function prismShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['equi', 'right'] as const, 'equi');
  const { x, y, w, h } = n;
  if (kind === 'right') return [area(poly([[x, y + h], [x + w, y + h], [x, y]]), n.fill, inkOf(n), n.strokeWidth)];
  if (!has(n.spec, 'dispersion')) return [area(poly([[x + w / 2, y], [x + w, y + h], [x, y + h]]), n.fill, inkOf(n), n.strokeWidth)];
  const ph = h * 0.86, hb = Math.min(w * 0.24, ph / Math.sqrt(3));
  const A: P2 = [x + w / 2, y + h * 0.06], BL: P2 = [x + w / 2 - hb, A[1] + ph], BR: P2 = [x + w / 2 + hb, A[1] + ph];
  const onFace = (P: P2, Q: P2, yy: number): P2 => [P[0] + ((yy - P[1]) / (Q[1] - P[1])) * (Q[0] - P[0]), yy];
  const ein = onFace(A, BL, y + h * 0.55), eout = onFace(A, BR, y + h * 0.6);
  const parts: Part[] = [line(seg([x, y + h * 0.66], ein), '#555555', 1.4)];
  parts.push(area(poly([A, BR, BL]), n.fill, inkOf(n), n.strokeWidth));
  parts.push(line(seg(ein, eout), '#9A9A9A', 1.2));
  RAINBOW.forEach((c, i) => parts.push(line(seg(eout, [x + w, y + h * (0.5 + 0.075 * i)]), c, 1.2)));
  return parts;
}

function plateShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['polarizer', 'halfwave', 'quarterwave', 'filter', 'nd', 'window', 'diffuser'] as const, 'polarizer');
  const col = inkOf(n), sw = n.strokeWidth;
  const fine = mix(col, '#FFFFFF', 0.25);
  if (has(n.spec, 'front')) {
    const R = Math.min(n.w, n.h) / 2, cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const clip = { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R, r: R };
    const parts: Part[] = [disc(cx, cy, R, n.fill, col, sw)];
    if (kind === 'polarizer') {
      const ls: Cmd[] = [];
      for (let k = -4; k <= 4; k++) ls.push(...seg([cx + (k * R) / 5, cy - R], [cx + (k * R) / 5, cy + R]));
      parts.push({ ...line(ls, fine, 0.6), clip }, ...arrow([cx, cy + R * 0.55], [cx, cy - R * 0.72], col, 1.1, 5), head([cx, cy + R * 0.72], 0, 1, 5, col));
    } else if (kind === 'halfwave' || kind === 'quarterwave') {
      const e = R * 0.7 * Math.SQRT1_2;
      parts.push(...arrow([cx - e, cy + e], [cx + e, cy - e], col, 1.1, 5), text(cx + e * 0.25, cy - e * 0.9, '$f$', clamp(R * 0.3, 7, 10), 'end', col));
    } else if (kind === 'diffuser') {
      const rand = rng(31);
      for (let i = 0; i < 40; i++) {
        const a = rand() * TAU, r = Math.sqrt(rand()) * R * 0.88;
        parts.push(disc(cx + r * Math.cos(a), cy + r * Math.sin(a), 0.6 + rand() * 1.2, shade(fillOf(n), -0.25)));
      }
    } else parts.push(line(arc(cx, cy, R * 0.72, -Math.PI * 0.85, -Math.PI * 0.55), '#FFFFFF', 1.6));
    return parts;
  }
  const o = orient(n);
  const { W, H } = o;
  if (kind === 'diffuser') {
    const rand = rng(17);
    const K = Math.max(8, Math.round(H / 3));
    const pts: P2[] = [[0, 0], [W * 0.6, 0]];
    for (let i = 1; i < K; i++) pts.push([W * (0.62 + 0.38 * rand()), (H * i) / K]);
    pts.push([W * 0.6, H], [0, H]);
    return [area(lpoly(o, pts), n.fill, col, sw)];
  }
  const body = lrect(o, 0, 0, W, H, n.fill, Math.min(1.5, W / 3));
  const parts: Part[] = [body];
  if (kind === 'polarizer') {
    const hs = clamp(W * 0.42, 2.5, 4.5);
    const a = lpt(o, W / 2, H * 0.84), b = lpt(o, W / 2, H * 0.16);
    parts.push(...arrow(a, b, col, 0.9, hs), head(a, a[0] - b[0], a[1] - b[1], hs, col));
  } else if ((kind === 'halfwave' || kind === 'quarterwave') && body.kind === 'rect') {
    const step = kind === 'halfwave' ? 4 : 7;
    const ls: Cmd[] = [];
    for (let k = -body.w - body.h; k < body.w + body.h; k += step) ls.push(...seg([body.x + k, body.y + body.h], [body.x + k + body.h, body.y]));
    parts.push({ ...line(ls, fine, 0.6), clip: { x: body.x, y: body.y, w: body.w, h: body.h, r: 0 } }, { ...body, fill: 'none' });
  }
  return parts;
}

function apertureShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['pinhole', 'slit', 'double', 'iris'] as const, 'pinhole');
  const open = clamp(n.count, 2, 90) / 100;
  const col = inkOf(n), sw = n.strokeWidth;
  if (has(n.spec, 'front')) {
    const { x, y, w, h } = n;
    const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) / 2;
    const parts: Part[] = [kind === 'iris' ? disc(cx, cy, R, n.fill, col, sw) : { kind: 'rect', x, y, w, h, r: 3, fill: n.fill }];
    if (kind === 'pinhole') parts.push(disc(cx, cy, Math.max(1.2, R * open), '#FFFFFF', col, 0.8));
    else if (kind === 'slit') parts.push({ kind: 'rect', x: cx - (w * open) / 4, y: y + h * 0.15, w: (w * open) / 2, h: h * 0.7, r: 0, fill: '#FFFFFF', sw: 0.8 });
    else if (kind === 'double') {
      const sw2 = (w * open) / 5;
      for (const s of [-1, 1]) parts.push({ kind: 'rect', x: cx + s * sw2 * 1.5 - sw2 / 2, y: y + h * 0.15, w: sw2, h: h * 0.7, r: 0, fill: '#FFFFFF', sw: 0.8 });
    } else {
      const r = Math.max(2, R * open), k = 7;
      const hole = Array.from({ length: k }, (_, i): P2 => [cx + r * Math.cos((TAU * i) / k), cy + r * Math.sin((TAU * i) / k)]);
      const blades: Cmd[] = hole.flatMap((p, i): Cmd[] => {
        const a = (TAU * i) / k + 1.2;
        return seg(p, [p[0] + Math.cos(a) * (R - r) * 1.05, p[1] + Math.sin(a) * (R - r) * 1.05]);
      });
      parts.push({ ...line(blades, shade(fillOf(n), -0.35), 0.7), clip: { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R, r: R } }, area(poly(hole), '#FFFFFF', col, 0.8));
    }
    return parts;
  }
  const o = orient(n);
  const { W, H } = o;
  const g = H * open;
  const blocks: [number, number][] = kind === 'double' ? [[0, H / 2 - 1.5 * g], [H / 2 - 0.5 * g, H / 2 + 0.5 * g], [H / 2 + 1.5 * g, H]] : [[0, (H - g) / 2], [(H + g) / 2, H]];
  return blocks.filter(([a, b]) => b - a > 0.5).map(([a, b]) => lrect(o, 0, a, W, b, n.fill, 0.5));
}

// ======================================================================
// Maschere a pixel (SLM, DMD, strati diffrattivi) e immagini di intensità/fase
// ======================================================================

function pixelsShape(n: N): Part[] {
  const content = kindOf(n.spec, ['phase', 'binary', 'random', 'lens', 'grating', 'hadamard', 'ramp'] as const, 'phase');
  const view = kindOf(n.spec, ['front', 'persp', 'dmd'] as const, 'front');
  const cm = CMAPS[kindOf(n.spec, CMAP_NAMES, content === 'phase' || content === 'lens' || content === 'grating' ? 'jet' : 'gray')];
  const col = inkOf(n);
  const rand = rng(77 + variantOf(n.spec) * 131 + Math.round(n.count) * 7);
  const long = clamp(Math.round(n.count), 2, 64);
  if (view === 'dmd') {
    const o = orient(n);
    const { W, H } = o;
    const k = clamp(long, 3, 32), c = H / k;
    const parts: Part[] = [lrect(o, 0, 0, W * 0.35, H, n.fill, 1)];
    const posts: Cmd[] = [], on: Cmd[] = [], off: Cmd[] = [];
    for (let i = 0; i < k; i++) {
      const v = c * (i + 0.5), u = W * 0.72, t = c * 0.42 * Math.sin(0.21), l = c * 0.42 * Math.cos(0.21);
      posts.push(...seg(o.at(W * 0.35, v), o.at(u, v)));
      const s = rand() > 0.5 ? 1 : -1;
      (s > 0 ? on : off).push(...seg(o.at(u - s * t, v - l), o.at(u + s * t, v + l)));
    }
    parts.push(line(posts, mix(col, '#FFFFFF', 0.4), 0.6), line(on, col, 2), line(off, mix(col, '#FFFFFF', 0.45), 2));
    return parts;
  }
  const persp = view === 'persp';
  const [cols, rows] = persp ? [long, long] : n.w >= n.h ? [long, Math.max(1, Math.round((long * n.h) / n.w))] : [Math.max(1, Math.round((long * n.w) / n.h)), long];
  const S = smoothField(rand, 9, 0.12, 0.3);
  const ph = [rand(), rand()];
  const vals: number[][] = [];
  for (let j = 0; j < rows; j++) {
    const row: number[] = [];
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5) / cols, v = (j + 0.5) / rows, r2 = (u - 0.5) ** 2 + (v - 0.5) ** 2;
      let val: number;
      switch (content) {
        case 'binary': val = rand() > 0.5 ? 1 : 0; break;
        case 'ramp': val = rows >= cols ? 1 - v : u; break;
        case 'random': val = clamp(0.5 + 0.45 * Math.tanh(S(u, v)) + 0.12 * (rand() - 0.5), 0, 1); break;
        case 'lens': val = (r2 * 9 + 10) % 1; break;
        case 'grating': val = (u * 4 + ph[0]) % 1; break;
        case 'hadamard': val = ((Math.floor(u * 4 + ph[0] * 2) + Math.floor(v * 4 + ph[1] * 2)) % 2) ^ (rand() > 0.85 ? 1 : 0); break;
        default: val = (((0.9 * S(u, v) + 0.32 * rand()) % 1) + 1) % 1;
      }
      row.push(val);
    }
    vals.push(row);
  }
  const map: Map2 = persp ? perspMap(n) : (u, v) => [n.x + u * n.w, n.y + v * n.h];
  const parts = fieldCells(cols, rows, (i, j) => cmap(cm, vals[j][i]), map, !persp);
  if (has(n.spec, 'grid') && cols <= 40 && rows <= 40) {
    const g: Cmd[] = [];
    for (let i = 1; i < cols; i++) g.push(...seg(map(i / cols, 0), map(i / cols, 1)));
    for (let j = 1; j < rows; j++) g.push(...seg(map(0, j / rows), map(1, j / rows)));
    parts.push(line(g, mix(col, '#FFFFFF', 0.25), 0.4));
  }
  parts.push(area(poly([map(0, 0), map(1, 0), map(1, 1), map(0, 1)]), 'none', col, n.strokeWidth));
  return parts;
}

/** J1 di Bessel (approssimazione razionale di Numerical Recipes). */
function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const a1 = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const a2 = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return a1 / a2;
  }
  const z = 8 / ax, y = z * z, xx = ax - 2.356194491;
  const a1 = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const a2 = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * a1 - z * Math.sin(xx) * a2);
  return x < 0 ? -ans : ans;
}

// cifre scritte a mano (MNIST) come tratti in coordinate unitarie
const DIGITS: P2[][][] = [
  [Array.from({ length: 17 }, (_, i): P2 => [0.5 + 0.24 * Math.cos((TAU * i) / 16), 0.5 + 0.36 * Math.sin((TAU * i) / 16)])],
  [[[0.4, 0.24], [0.55, 0.12], [0.52, 0.88]]],
  [[[0.26, 0.3], [0.36, 0.16], [0.55, 0.12], [0.7, 0.22], [0.7, 0.38], [0.5, 0.6], [0.26, 0.86], [0.78, 0.84]]],
  [[[0.28, 0.18], [0.5, 0.12], [0.7, 0.22], [0.66, 0.4], [0.45, 0.48], [0.68, 0.56], [0.72, 0.74], [0.52, 0.88], [0.27, 0.82]]],
  [[[0.62, 0.88], [0.62, 0.12], [0.22, 0.64], [0.8, 0.64]]],
  [[[0.72, 0.13], [0.36, 0.15], [0.31, 0.46], [0.52, 0.4], [0.7, 0.5], [0.72, 0.72], [0.55, 0.87], [0.28, 0.8]]],
  [[[0.66, 0.14], [0.42, 0.28], [0.3, 0.55], [0.34, 0.8], [0.52, 0.88], [0.68, 0.76], [0.66, 0.58], [0.48, 0.52], [0.32, 0.62]]],
  [[[0.25, 0.15], [0.75, 0.15], [0.48, 0.88]]],
  [
    Array.from({ length: 17 }, (_, i): P2 => [0.5 + 0.18 * Math.cos((TAU * i) / 16), 0.31 + 0.17 * Math.sin((TAU * i) / 16)]),
    Array.from({ length: 17 }, (_, i): P2 => [0.5 + 0.22 * Math.cos((TAU * i) / 16), 0.67 + 0.2 * Math.sin((TAU * i) / 16)]),
  ],
  [Array.from({ length: 17 }, (_, i): P2 => [0.5 + 0.2 * Math.cos((TAU * i) / 16), 0.34 + 0.18 * Math.sin((TAU * i) / 16)]), [[0.69, 0.36], [0.62, 0.88]]],
];

function segDist(px: number, py: number, a: P2, b: P2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

// posizioni dei 10 rivelatori sul piano di uscita della D2NN (3 + 4 + 3)
const DETECTORS: P2[] = [[0.25, 0.2], [0.5, 0.2], [0.75, 0.2], [0.14, 0.5], [0.38, 0.5], [0.62, 0.5], [0.86, 0.5], [0.25, 0.8], [0.5, 0.8], [0.75, 0.8]];

const PATTERNS = ['speckle', 'airy', 'fringes', 'rings', 'gauss', 'hologram', 'phase', 'spectrum', 'psf', 'digit', 'detectors', 'usaf', 'caustic', 'cells', 'kspace', 'phantom', 'blurry'] as const;
type Pattern = (typeof PATTERNS)[number];
const PAT_CMAP: Record<Pattern, string> = {
  speckle: 'gray', airy: 'hot', fringes: 'gray', rings: 'gray', gauss: 'hot', hologram: 'gray', phase: 'twilight', spectrum: 'gray', psf: 'magma',
  digit: 'gray', detectors: 'hot', usaf: 'gray', caustic: 'gray', cells: 'gray', kspace: 'gray', phantom: 'gray', blurry: 'gray',
};

// Shepp-Logan modificato: [A, a, b, x0, y0, phi in gradi]
const SHEPP: number[][] = [
  [1, 0.69, 0.92, 0, 0, 0], [-0.8, 0.6624, 0.874, 0, -0.0184, 0], [-0.2, 0.11, 0.31, 0.22, 0, -18], [-0.2, 0.16, 0.41, -0.22, 0, 18], [0.1, 0.21, 0.25, 0, 0.35, 0],
  [0.1, 0.046, 0.046, 0, 0.1, 0], [0.1, 0.046, 0.046, 0, -0.1, 0], [0.1, 0.046, 0.023, -0.08, -0.605, 0], [0.1, 0.023, 0.023, 0, -0.606, 0], [0.1, 0.023, 0.046, 0.06, -0.605, 0],
];

function patternField(content: Pattern, n: N, rand: Rand): (u: number, v: number) => number {
  const c = Math.round(n.count);
  switch (content) {
    case 'speckle': {
      const K = 48;
      const waves = Array.from({ length: K }, () => {
        const a = rand() * TAU, k = (2 + rand() * 5.5) * TAU;
        return { kx: Math.cos(a) * k, ky: Math.sin(a) * k, p: rand() * TAU, amp: 0.5 + rand() };
      });
      return (u, v) => {
        let re = 0, im = 0;
        for (const w of waves) {
          const ph = w.kx * u + w.ky * v + w.p;
          re += w.amp * Math.cos(ph);
          im += w.amp * Math.sin(ph);
        }
        return (re * re + im * im) / (K * 2.4);
      };
    }
    case 'airy':
      return (u, v) => {
        const x = Math.hypot(u - 0.5, v - 0.5) * 30 + 1e-6;
        return (((2 * besselJ1(x)) / x) ** 2) ** 0.28;
      };
    case 'fringes': {
      const f = clamp(c, 1, 30);
      return (u, v) => clamp((1.02 - Math.hypot(u - 0.5, v - 0.5) / 0.5) / 0.14, 0, 1) * (0.5 + 0.5 * Math.cos(TAU * f * u));
    }
    case 'rings': {
      const f = clamp(c, 1, 30);
      return (u, v) => {
        const r = Math.hypot(u - 0.5, v - 0.5) / 0.5;
        return clamp((1.02 - r) / 0.14, 0, 1) * (0.5 + 0.5 * Math.cos(TAU * f * r * r));
      };
    }
    case 'gauss':
      return (u, v) => Math.exp(-((u - 0.5) ** 2 + (v - 0.5) ** 2) / (2 * 0.16 ** 2));
    case 'hologram': {
      // |R + O|²: frange portanti del riferimento inclinato, deformate e modulate dall'onda oggetto
      const O = smoothField(rand, 7, 0.12, 0.26);
      return (u, v) => {
        const s0 = Math.tanh(O(u, v)), o = 0.35 + 0.65 * Math.abs(s0);
        return clamp((1 + o * o + 2 * o * Math.cos(TAU * 7.5 * (u * 0.94 + v * 0.34) + 4 * s0)) / (1 + o) ** 2, 0, 1) * (0.55 + 0.45 * o);
      };
    }
    case 'phase': {
      const S = smoothField(rand, 8, 0.14, 0.3);
      return (u, v) => (((S(u, v) * 1.4 + 2 * ((u - 0.5) ** 2 + (v - 0.5) ** 2) * 3) % 1) + 1) % 1;
    }
    case 'spectrum': {
      const S = smoothField(rand, 30, 0.02, 0.05);
      return (u, v) => {
        const du = u - 0.5, dv = v - 0.5, r = Math.hypot(du, dv);
        const streak = 0.35 * (Math.exp(-Math.abs(du) * 90) + Math.exp(-Math.abs(dv) * 90)) * Math.exp(-r * 4);
        return clamp(Math.exp(-r * 22) + 0.32 * Math.exp(-r * 5) * (0.7 + 0.6 * Math.abs(S(u, v))) + streak, 0, 1) ** 0.75;
      };
    }
    case 'psf':
      return (u, v) => {
        const du = u - 0.5, dv = v - 0.5, r = Math.hypot(du, dv), th = Math.atan2(dv, du);
        return clamp(0.95 * Math.exp(-((r / 0.035) ** 2)) + 0.38 * Math.exp(-((r / 0.24) ** 2)) * (0.75 + 0.25 * Math.cos(6 * th)) + 0.1 * Math.exp(-((r / 0.45) ** 2)), 0, 1);
      };
    case 'digit': {
      const strokes = DIGITS[((c % 10) + 10) % 10];
      return (u, v) => {
        let d = Infinity;
        for (const s of strokes) for (let i = 1; i < s.length; i++) d = Math.min(d, segDist(u, v, s[i - 1], s[i]));
        return Math.exp(-((d / 0.065) ** 2));
      };
    }
    case 'detectors': {
      const lit = ((c % 10) + 10) % 10;
      const amp = DETECTORS.map((_, i) => (i === lit ? 1 : 0.1 + 0.18 * rand()));
      return (u, v) => {
        let t = 0.05 + 0.04 * rand();
        DETECTORS.forEach(([dx, dy], i) => (t += amp[i] * Math.exp(-((u - dx) ** 2 + (v - dy) ** 2) / 0.0028)));
        return clamp(t, 0, 1);
      };
    }
    case 'caustic': {
      const pts = Array.from({ length: 22 }, () => [rand() * 1.2 - 0.1, rand() * 1.2 - 0.1, 0.5 + rand() * 0.5]);
      return (u, v) => {
        let d1 = Infinity, d2 = Infinity, b = 1;
        for (const [px, py, pb] of pts) {
          const d = Math.hypot(u - px, v - py);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            b = pb;
          } else if (d < d2) d2 = d;
        }
        return clamp(b * Math.exp(-(((d2 - d1) / 0.018) ** 2)) + 0.06, 0, 1);
      };
    }
    case 'cells': {
      const cells = Array.from({ length: 26 }, () => ({ x: rand() * 1.1 - 0.05, y: rand() * 1.1 - 0.05, a: rand() * Math.PI, rx: 0.07 + rand() * 0.07, ry: 0.045 + rand() * 0.04 }));
      const S = smoothField(rand, 12, 0.1, 0.2);
      return (u, v) => {
        let t = 0.22 + 0.06 * S(u, v);
        for (const cl of cells) {
          const dx = u - cl.x, dy = v - cl.y, ca = Math.cos(cl.a), sa = Math.sin(cl.a);
          const p = (dx * ca + dy * sa) / cl.rx, q = (-dx * sa + dy * ca) / cl.ry, r = Math.sqrt(p * p + q * q);
          t += 0.32 * Math.exp(-(((r - 1) / 0.22) ** 2)) + 0.12 * Math.exp(-r * r * 1.2) + 0.3 * Math.exp(-r * r * 14);
        }
        return clamp(t, 0, 1);
      };
    }
    case 'kspace': {
      const S = smoothField(rand, 30, 0.02, 0.05);
      return (u, v) => {
        const r = Math.hypot(u - 0.5, v - 0.5);
        return clamp(Math.exp(-r * 24) + 0.22 * Math.exp(-r * 6) * (0.6 + 0.8 * Math.abs(S(u, v))), 0, 1) ** 0.8;
      };
    }
    case 'phantom':
      return (u, v) => {
        const X = (u - 0.5) * 2.1, Y = -(v - 0.5) * 2.1;
        let t = 0;
        for (const [A, a, b, x0, y0, phi] of SHEPP) {
          const p = (phi * Math.PI) / 180, dx = X - x0, dy = Y - y0;
          const xr = dx * Math.cos(p) + dy * Math.sin(p), yr = -dx * Math.sin(p) + dy * Math.cos(p);
          if ((xr / a) ** 2 + (yr / b) ** 2 <= 1) t += A;
        }
        return clamp(t * 1.6, 0, 1);
      };
    case 'blurry': {
      const S = smoothField(rand, 10, 0.14, 0.3);
      return (u, v) => clamp((0.5 + 0.42 * Math.tanh(1.8 * S(u, v))) * (1 - 0.7 * ((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2), 0, 1);
    }
    default:
      return () => 0;
  }
}

/** Disegni vettoriali sopra il campo (rivelatori, cerchi nel piano di Fourier, mira USAF). */
function patternOverlay(content: Pattern, n: N, map: Map2, cm: string[], size: number): Part[] {
  const parts: Part[] = [];
  const ring = (cx: number, cy: number, r: number): P2[] => Array.from({ length: 41 }, (_, i): P2 => map(cx + r * Math.cos((TAU * i) / 40), cy + r * Math.sin((TAU * i) / 40)));
  const box = (x0: number, y0: number, x1: number, y1: number): P2[] => [map(x0, y0), map(x1, y0), map(x1, y1), map(x0, y1)];
  if (content === 'detectors') {
    const s = 0.075;
    DETECTORS.forEach(([dx, dy]) => parts.push(area(poly(box(dx - s, dy - s, dx + s, dy + s)), 'none', '#FFFFFF', 0.8)));
    if (has(n.spec, 'labels')) {
      const ts = clamp(size * 0.07, 6, 9);
      DETECTORS.forEach(([dx, dy], i) => {
        const p = map(dx + s + 0.005, dy - s - 0.045);
        parts.push(text(p[0], p[1], String(i), ts, 'start', '#FFFFFF'));
      });
    }
  }
  if (content === 'kspace') {
    const lit = ['#E5484D', '#43A047', '#1E88E5'];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) parts.push(line(poly(ring(0.5 + i * 0.16, 0.5 + j * 0.16, 0.2), false), '#C9CED6', 0.5));
    [[0, 0], [-1, 1], [1, 1]].forEach(([i, j], k) => parts.push(line(poly(ring(0.5 + i * 0.16, 0.5 + j * 0.16, 0.2), false), lit[k], 1.1)));
  }
  if (content === 'usaf') {
    const fg = cmap(cm, 1);
    const el = (cx: number, cy: number, s: number) => {
      const t = s / 5;
      for (let k = 0; k < 3; k++) {
        parts.push(area(poly(box(cx - s * 1.15, cy - s / 2 + 2 * k * t, cx - s * 0.15, cy - s / 2 + (2 * k + 1) * t)), fg));
        parts.push(area(poly(box(cx + s * 0.15 + 2 * k * t, cy - s / 2, cx + s * 0.15 + (2 * k + 1) * t, cy + s / 2)), fg));
      }
    };
    [[0.3, 0.2, 0.17], [0.3, 0.5, 0.14], [0.3, 0.77, 0.115], [0.74, 0.2, 0.095], [0.74, 0.4, 0.078], [0.74, 0.57, 0.064], [0.74, 0.71, 0.052], [0.74, 0.83, 0.043]].forEach(([cx, cy, s]) => el(cx, cy, s));
    parts.push(area(poly(box(0.58, 0.88, 0.66, 0.95)), fg));
  }
  return parts;
}

/** Disegno vettoriale delle immagini a simmetria semplice: più nitido e leggero di una griglia di celle. */
function vectorPattern(content: Pattern, n: N, map: Map2, cm: string[], f: (u: number, v: number) => number, size: number): Part[] | null {
  const ring = (cx: number, cy: number, rx: number, ry: number, rot = 0, k = 48): P2[] =>
    Array.from({ length: k }, (_, i): P2 => {
      const a = (TAU * i) / k, ex = rx * Math.cos(a), ey = ry * Math.sin(a);
      return map(cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot));
    });
  const bg = (v: number): Part => area(poly([map(0, 0), map(1, 0), map(1, 1), map(0, 1)]), cmap(cm, v));
  if (content === 'airy' || content === 'rings' || content === 'gauss') {
    // dischi concentrici dall'esterno verso il centro, uno per livello di colore
    const K = 90, rmax = 0.72;
    const parts: Part[] = [];
    let last = '';
    for (let k = K; k >= 1; k--) {
      const r = (rmax * k) / K, c = cmap(cm, f(0.5 + r - rmax / K / 2, 0.5));
      if (c === last) continue;
      parts.push(area(poly(ring(0.5, 0.5, r, r, 0, Math.max(24, Math.round(64 * (r / rmax))))), c));
      last = c;
    }
    return parts;
  }
  if (content === 'fringes') {
    const K = 160, parts: Part[] = [bg(f(0.5, 0.5) * 0)];
    let i = 0;
    while (i < K) {
      const c = cmap(cm, f((i + 0.5) / K, 0.5));
      let j = i + 1;
      while (j < K && cmap(cm, f((j + 0.5) / K, 0.5)) === c) j++;
      parts.push(area(poly([map(i / K, 0), map(Math.min(1, j / K + 0.003), 0), map(Math.min(1, j / K + 0.003), 1), map(i / K, 1)]), c));
      i = j;
    }
    return parts;
  }
  if (content === 'phantom') {
    const parts: Part[] = [bg(0)];
    for (const [, a, b, x0, y0, phi] of SHEPP) {
      const p = (phi * Math.PI) / 180;
      const sx = x0 - 0.97 * b * Math.sin(p), sy = y0 + 0.97 * b * Math.cos(p);
      const c = cmap(cm, f(0.5 + sx / 2.1, 0.5 - sy / 2.1));
      parts.push(area(poly(ring(0.5 + x0 / 2.1, 0.5 - y0 / 2.1, a / 2.1, b / 2.1, -p, 64)), c));
    }
    return parts;
  }
  if (content === 'digit') {
    const strokes = DIGITS[((Math.round(n.count) % 10) + 10) % 10];
    const cmds = strokes.flatMap((st) => poly(st.map(([u, v]) => map(u, v)), false));
    return [bg(0), line(cmds, cmap(cm, 0.45), size * 0.15), line(cmds, cmap(cm, 0.8), size * 0.1), line(cmds, cmap(cm, 1), size * 0.055)];
  }
  return null;
}

function patternParts(n: N, map: Map2, pw: number, ph: number, rect: boolean): Part[] {
  const content = kindOf(n.spec, PATTERNS, 'speckle');
  const cm = CMAPS[kindOf(n.spec, CMAP_NAMES, PAT_CMAP[content] as (typeof CMAP_NAMES)[number])];
  const rand = rng(1000 + Math.round(n.count) * 7919 + variantOf(n.spec) * 31);
  const coarse = has(n.spec, 'coarse');
  // al massimo ~1100 celle per immagine: il TikZ resta compilabile anche con molte immagini
  const cell = Math.max(2, Math.sqrt((pw * ph) / 1100));
  const cols = coarse ? 14 : clamp(Math.round(pw / cell), 12, 56);
  const rows = coarse ? Math.max(4, Math.round((14 * ph) / pw)) : clamp(Math.round(ph / cell), 12, 56);
  const parts: Part[] = [];
  const vec = coarse || has(n.spec, 'blur') ? null : vectorPattern(content, n, map, cm, patternField(content, n, rng(1)), Math.min(pw, ph));
  if (vec) parts.push(...vec);
  else if (content === 'usaf') {
    parts.push(area(poly([map(0, 0), map(1, 0), map(1, 1), map(0, 1)]), cmap(cm, 0.02)));
  } else {
    const f0 = patternField(content, n, rand);
    const bl = 0.035;
    const f = has(n.spec, 'blur') ? (u: number, v: number) => {
      let acc = f0(u, v);
      for (let k = 0; k < 8; k++) acc += f0(u + bl * Math.cos((TAU * k) / 8), v + bl * Math.sin((TAU * k) / 8));
      return acc / 9;
    } : f0;
    const vals = Array.from({ length: rows }, (_, j) => Array.from({ length: cols }, (_, i) => cmap(cm, f((i + 0.5) / cols, (j + 0.5) / rows))));
    parts.push(...fieldCells(cols, rows, (i, j) => vals[j][i], map, rect));
  }
  parts.push(...patternOverlay(content, n, map, cm, Math.min(pw, ph)));
  return parts;
}

function patternShape(n: N): Part[] {
  if (has(n.spec, 'persp')) {
    const map = perspMap(n);
    return [...patternParts(n, map, n.w, n.h, false), area(poly([map(0, 0), map(1, 0), map(1, 1), map(0, 1)]), 'none', inkOf(n), n.strokeWidth)];
  }
  return framed(n, (b: Box) => patternParts(n, (u, v) => [b.x + u * b.w, b.y + v * b.h], b.w, b.h, true));
}

// ======================================================================
// Microscopia: obiettivo e campioni
// ======================================================================

function objectiveShape(n: N): Part[] {
  const o = orient(n);
  const { W, H } = o;
  const col = inkOf(n);
  const fill = fillOf(n, '#F5F5F5');
  const knurl: Cmd[] = [0.17, 0.22, 0.27, 0.32].flatMap((u) => seg(o.at(W * u, 0), o.at(W * u, H)));
  return [
    lrect(o, 0, H * 0.22, W * 0.1, H * 0.78, shade(fill, -0.12), 0.5),
    lrect(o, W * 0.1, 0, W * 0.6, H, fill, 2),
    line(knurl, mix(col, '#FFFFFF', 0.45), 0.6),
    lrect(o, W * 0.44, 0, W * 0.5, H, mix(col, '#FFFFFF', 0.25), 0, { stroke: 'none' }),
    area(lpoly(o, [[W * 0.6, H * 0.06], [W * 0.92, H * 0.28], [W * 0.92, H * 0.72], [W * 0.6, H * 0.94]]), shade(fill, 0.3), col, n.strokeWidth),
    area([['M', ...o.at(W * 0.92, H * 0.3)], lq(o, [W * 0.92, H * 0.3], [W * 1.08, H / 2], [W * 0.92, H * 0.7]), ['Z']], GLASS, GLASS_INK, 0.9),
  ];
}

function sampleShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['slide', 'dish', 'cuvette', 'tissue', 'chamber'] as const, 'slide');
  const { x, y, w, h } = n;
  const col = inkOf(n), sw = n.strokeWidth;
  const fill = fillOf(n, GLASS);
  const spec = { fill: '#F2B8C6', stroke: '#C76B8A' };
  switch (kind) {
    case 'tissue': {
      const rand = rng(5);
      const layers = 4;
      const wav = (v: number, a: number, ph: number) =>
        Array.from({ length: 33 }, (_, i): P2 => [x + (w * i) / 32, y + h * v + a * h * Math.sin((TAU * i) / 32 * 1.5 + ph)]);
      const parts: Part[] = [];
      const tops = [0.08, 0.3, 0.52, 0.74];
      for (let k = 0; k < layers; k++) {
        const top = wav(tops[k], k === 0 ? 0.035 : 0.025, rand() * TAU);
        parts.push(area(poly([...top, [x + w, y + h], [x, y + h]]), mix(fillOf(n, '#F6D5D0'), '#B5655A', k * 0.18), k === 0 ? col : 'none', sw * 0.8));
      }
      parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none', stroke: 'none' });
      return parts;
    }
    case 'dish': {
      const t = Math.max(2, h * 0.06);
      const cells: Part[] = Array.from({ length: 6 }, (_, i): Part => ({ kind: 'ellipse', cx: x + w * (0.18 + 0.13 * i), cy: y + h - t - h * 0.06, rx: w * 0.045, ry: h * 0.05, fill: spec.fill, stroke: spec.stroke, sw: 0.7 }));
      return [
        { kind: 'rect', x: x + t, y: y + h * 0.4, w: w - 2 * t, h: h * 0.6 - t, r: 0, fill: mix(fill, '#FFFFFF', 0.3), stroke: 'none' },
        ...cells,
        area(poly([[x, y + h * 0.2], [x, y + h], [x + w, y + h], [x + w, y + h * 0.2], [x + w - t, y + h * 0.2], [x + w - t, y + h - t], [x + t, y + h - t], [x + t, y + h * 0.2]]), fill, col, sw),
      ];
    }
    case 'cuvette': {
      const t = Math.max(2, w * 0.06);
      return [
        { kind: 'rect', x: x + t, y: y + h * 0.22, w: w - 2 * t, h: h * 0.78 - t, r: 0, fill: mix(fill, '#FFFFFF', 0.2), stroke: 'none' },
        area(poly([[x, y], [x, y + h], [x + w, y + h], [x + w, y], [x + w - t, y], [x + w - t, y + h - t], [x + t, y + h - t], [x + t, y]]), shade(fill, -0.05), col, sw),
      ];
    }
    case 'chamber': {
      const cx = x + w / 2, cy = y + h * 0.56;
      return [
        { kind: 'rect', x, y: y + h * 0.08, w, h: h * 0.92, r: 2, fill: mix(fill, '#FFFFFF', 0.35) },
        area(poly([[cx + w * 0.26, cy], [cx + w * 0.38, cy - h * 0.1], [cx + w * 0.38, cy + h * 0.1]]), '#F2C5A0', '#B07A50', 0.8),
        { kind: 'ellipse', cx: cx - w * 0.02, cy, rx: w * 0.3, ry: h * 0.1, fill: '#F2C5A0', stroke: '#B07A50', sw: 0.8 },
        disc(cx - w * 0.25, cy - h * 0.02, Math.max(1.2, h * 0.025), '#333333'),
      ];
    }
    default:
      return [
        { kind: 'rect', x, y: y + h * 0.58, w, h: h * 0.26, r: 1, fill },
        { kind: 'ellipse', cx: x + w / 2, cy: y + h * 0.53, rx: w * 0.18, ry: h * 0.06, fill: spec.fill, stroke: spec.stroke, sw: 0.8 },
        { kind: 'rect', x: x + w * 0.27, y: y + h * 0.44, w: w * 0.46, h: h * 0.08, r: 0.5, fill: mix(fill, '#FFFFFF', 0.4), sw: sw * 0.8 },
      ];
  }
}

// ======================================================================
// Fotonica integrata: interferometri MZI, anelli, chip
// ======================================================================

/** Guide d'onda di una rete di MZI (Clements o Reck) nel rettangolo dato. */
function mziMesh(x: number, y: number, w: number, h: number, modes: number, layout: 'clements' | 'reck' | 'single') {
  const gap = h / modes;
  const laneY = (k: number) => y + (k + 0.5) * gap;
  const cols: number[][] = [];
  if (layout === 'single') cols.push([0]);
  else if (layout === 'reck') {
    for (let c = 0; c <= 2 * modes - 4; c++) {
      const ks: number[] = [];
      for (let k = c % 2; k <= Math.min(c, 2 * modes - 4 - c); k += 2) if (k + 1 < modes) ks.push(k);
      cols.push(ks);
    }
  } else for (let c = 0; c < modes; c++) {
    const ks: number[] = [];
    for (let k = c % 2; k + 1 < modes; k += 2) ks.push(k);
    cols.push(ks);
  }
  const lead = clamp(w * 0.04, 4, 16);
  const colW = (w - 2 * lead) / cols.length;
  const d = gap * 0.42;
  const lanes: Cmd[] = [];
  const heaters: { cx: number; cy: number; kind: 'theta' | 'phi' }[] = [];
  for (let k = 0; k < modes; k++) {
    const v0 = laneY(k);
    lanes.push(['M', x, v0], ['L', x + lead, v0]);
    cols.forEach((ks, c) => {
      const xc = x + lead + c * colW;
      const X = (f: number) => xc + f * colW;
      const top = ks.includes(k), bot = ks.includes(k - 1);
      if (!top && !bot) {
        lanes.push(['L', X(1), v0]);
        return;
      }
      const vc = v0 + (top ? d : -d);
      const bend = (f0: number, f1: number, a: number, b: number): Cmd => ['C', X((f0 + f1) / 2), a, X((f0 + f1) / 2), b, X(f1), b];
      lanes.push(['L', X(0.1), v0], bend(0.1, 0.27, v0, vc), ['L', X(0.32), vc], bend(0.32, 0.49, vc, v0), ['L', X(0.59), v0], bend(0.59, 0.76, v0, vc), ['L', X(0.81), vc], bend(0.81, 0.98, vc, v0), ['L', X(1), v0]);
      if (top) heaters.push({ cx: X(0.05), cy: v0, kind: 'phi' }, { cx: X(0.54), cy: v0, kind: 'theta' });
    });
    lanes.push(['L', x + w, v0]);
  }
  return { lanes, heaters, colW, gap, laneY };
}

function heaterParts(cx: number, cy: number, hw: number, hh: number): Part[] {
  return [
    { kind: 'rect', x: cx - hw / 2 - 1.5, y: cy - hh / 2 - 1.5, w: hw + 3, h: hh + 3, r: 2, fill: '#F8C9C3', stroke: 'none' },
    { kind: 'rect', x: cx - hw / 2, y: cy - hh / 2, w: hw, h: hh, r: 1, fill: '#E5E7EB', stroke: '#8A9099', sw: 0.6, solid: true },
  ];
}

function mziShape(n: N): Part[] {
  const modes = clamp(Math.round(n.count), 2, 8);
  const layout = modes === 2 ? 'single' : kindOf(n.spec, ['clements', 'reck'] as const, 'clements');
  const chip = has(n.spec, 'chip');
  const { x, y, w, h } = n;
  const col = inkOf(n);
  const pad = chip ? Math.min(w, h) * 0.06 : 0;
  const labels = has(n.spec, 'labels');
  // spazio sopra la prima guida per le etichette θ e φ
  const top = labels ? clamp((h / modes) * 0.3, 9, 13) * 0.9 : 0;
  const parts: Part[] = [];
  if (chip) parts.push({ kind: 'rect', x, y, w, h, r: 4, fill: n.fill, stroke: shade(fillOf(n), -0.15), sw: 0.8 });
  const m = mziMesh(x + pad, y + pad + top, w - 2 * pad, h - 2 * pad - top, modes, layout);
  parts.push(line(m.lanes, col, Math.max(1.5, n.strokeWidth * 1.5)));
  const hw = clamp(m.colW * 0.08, 5, 14), hh = clamp(m.gap * 0.2, 3, 7);
  for (const hz of m.heaters) parts.push(...heaterParts(hz.cx, hz.cy, hw, hh));
  if (labels && m.heaters.length) {
    const ts = clamp(m.gap * 0.3, 9, 13);
    const [phi, theta] = m.heaters;
    parts.push(text(theta.cx, theta.cy - hh / 2 - ts * 0.75, '$\\theta$', ts), text(phi.cx, phi.cy - hh / 2 - ts * 0.75, '$\\phi$', ts));
  }
  return parts;
}

function ringShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['allpass', 'adddrop'] as const, 'allpass');
  const { x, y, w, h } = n;
  const col = inkOf(n), wg = Math.max(1.5, n.strokeWidth * 1.5);
  const parts: Part[] = [];
  if (has(n.spec, 'chip')) parts.push({ kind: 'rect', x, y, w, h, r: 4, fill: n.fill, stroke: shade(fillOf(n), -0.15), sw: 0.8 });
  const g = Math.max(1.5, h * 0.025) + wg;
  const cx = x + w / 2;
  const busB = y + h * (kind === 'allpass' ? 0.82 : 0.86), busT = y + h * 0.14;
  const R = kind === 'allpass' ? Math.min(h * 0.33, w * 0.3) : Math.min((busB - busT) / 2 - g, w * 0.3);
  const cy = kind === 'allpass' ? busB - g - R : (busT + busB) / 2;
  if (has(n.spec, 'resonant')) parts.push({ kind: 'ellipse', cx, cy, rx: R, ry: R, fill: 'none', stroke: BEAM_FILL, sw: wg * 3.2, solid: true });
  parts.push(line(seg([x, busB], [x + w, busB]), col, wg), { kind: 'ellipse', cx, cy, rx: R, ry: R, fill: 'none', stroke: col, sw: wg, solid: true });
  if (kind === 'adddrop') parts.push(line(seg([x, busT], [x + w, busT]), col, wg));
  if (has(n.spec, 'heater')) {
    const a0 = kind === 'allpass' ? -Math.PI * 0.85 : Math.PI * 0.68, a1 = kind === 'allpass' ? -Math.PI * 0.15 : Math.PI * 1.32;
    const Rh = R + wg * 1.8;
    parts.push(line(arc(cx, cy, Rh, a0, a1), HEAT, 2.4));
    for (const a of [a0, a1]) parts.push({ kind: 'rect', x: cx + Rh * Math.cos(a) - 3, y: cy + Rh * Math.sin(a) - 3, w: 6, h: 6, r: 1, fill: '#E3C77A', stroke: '#B08D2E', sw: 0.6 });
  }
  if (has(n.spec, 'labels')) {
    const ts = clamp(h * 0.09, 8, 10);
    parts.push(text(x + 2, busB + ts * 0.95, 'In', ts, 'start'), text(x + w - 2, busB + ts * 0.95, 'Through', ts, 'end'));
    if (kind === 'adddrop') parts.push(text(x + 2, busT - ts * 0.95, 'Drop', ts, 'start'), text(x + w - 2, busT - ts * 0.95, 'Add', ts, 'end'));
  }
  return parts;
}

function chipShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['top', 'iso'] as const, 'top');
  const { x, y, w, h } = n;
  const col = inkOf(n);
  const fill = fillOf(n, '#E5E7EB');
  const wgc = '#3A3F47';
  if (kind === 'iso') {
    const d = w * 0.18, th = h * 0.14, ht = h - th;
    const T = (u: number, v: number): P2 => [x + d * (1 - v) + u * (w - d), y + v * ht];
    const parts: Part[] = [
      area(poly([T(0, 1), T(1, 1), [T(1, 1)[0], T(1, 1)[1] + th], [T(0, 1)[0], T(0, 1)[1] + th]]), shade(fill, -0.15), col, n.strokeWidth),
      area(poly([T(1, 1), T(1, 0), [T(1, 0)[0], T(1, 0)[1] + th], [T(1, 1)[0], T(1, 1)[1] + th]]), shade(fill, -0.25), col, n.strokeWidth),
      area(poly([T(0, 0), T(1, 0), T(1, 1), T(0, 1)]), fill, col, n.strokeWidth),
    ];
    const lanes: Cmd[] = [];
    for (let k = 0; k < 4; k++) {
      const v = 0.25 + k * 0.17;
      const pts: P2[] = Array.from({ length: 41 }, (_, i): P2 => {
        const u = 0.05 + (0.9 * i) / 40;
        const bump = k % 2 === 0 ? Math.exp(-(((u - 0.4) / 0.06) ** 2)) : -Math.exp(-(((u - 0.4) / 0.06) ** 2));
        const bump2 = k === 1 ? Math.exp(-(((u - 0.68) / 0.06) ** 2)) : k === 2 ? -Math.exp(-(((u - 0.68) / 0.06) ** 2)) : 0;
        return T(u, v + 0.065 * bump + 0.065 * bump2);
      });
      lanes.push(...poly(pts, false));
    }
    parts.push(line(lanes, wgc, 1.3));
    for (let i = 0; i < 6; i++) {
      const u = 0.22 + i * 0.11;
      parts.push(area(poly([T(u, 0.06), T(u + 0.06, 0.06), T(u + 0.06, 0.14), T(u, 0.14)]), '#E3C77A', '#B08D2E', 0.5));
    }
    return parts;
  }
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: 3, fill }];
  const np = Math.max(4, Math.round(w / 18));
  for (let i = 0; i < np; i++) {
    const px = x + w * 0.12 + (w * 0.76 * (i + 0.5)) / np - 3;
    parts.push({ kind: 'rect', x: px, y: y + 3, w: 6, h: 6, r: 0.8, fill: '#E3C77A', stroke: '#B08D2E', sw: 0.5 }, { kind: 'rect', x: px, y: y + h - 9, w: 6, h: 6, r: 0.8, fill: '#E3C77A', stroke: '#B08D2E', sw: 0.5 });
  }
  const m = mziMesh(x + w * 0.1, y + h * 0.18, w * 0.84, h * 0.64, 4, 'clements');
  parts.push(line(m.lanes, wgc, 1.3));
  for (const hz of m.heaters) parts.push(...heaterParts(hz.cx, hz.cy, clamp(m.colW * 0.11, 4, 9), clamp(m.gap * 0.2, 2.5, 5)));
  for (let k = 0; k < 4; k++) {
    const cy = m.laneY(k), gx = x + w * 0.04;
    const gl: Cmd[] = [];
    for (let i = 0; i < 4; i++) gl.push(...seg([gx + i * 2, cy - m.gap * 0.22], [gx + i * 2, cy + m.gap * 0.22]));
    parts.push(area(poly([[gx - 1, cy - m.gap * 0.26], [x + w * 0.1, cy - 1], [x + w * 0.1, cy + 1], [gx - 1, cy + m.gap * 0.26]]), mix(wgc, '#FFFFFF', 0.7), 'none'), line(gl, wgc, 0.8));
  }
  return parts;
}

// ======================================================================
// Oggetti della scena e simboli
// ======================================================================

function objectShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['arrow', 'cube', 'sphere', 'car', 'tree', 'person', 'eye'] as const, 'arrow');
  const { x, y, w, h } = n;
  const col = inkOf(n), sw = n.strokeWidth;
  const fill = fillOf(n, '#DAE8FC');
  switch (kind) {
    case 'cube': {
      const s = Math.min(w, h) / 1.3, d = s * 0.3;
      const x0 = x + (w - s - d) / 2, y0 = y + (h - s - d) / 2 + d;
      return [
        area(poly([[x0, y0], [x0 + d, y0 - d], [x0 + s + d, y0 - d], [x0 + s, y0]]), shade(fill, 0.35), col, sw),
        area(poly([[x0 + s, y0], [x0 + s + d, y0 - d], [x0 + s + d, y0 + s - d], [x0 + s, y0 + s]]), shade(fill, -0.15), col, sw),
        { kind: 'rect', x: x0, y: y0, w: s, h: s, r: 0, fill },
      ];
    }
    case 'sphere': {
      const R = Math.min(w, h) / 2, cx = x + w / 2, cy = y + h / 2;
      return [
        disc(cx, cy, R, shade(fill, -0.12), col, sw),
        disc(cx - R * 0.12, cy - R * 0.12, R * 0.72, fill),
        disc(cx - R * 0.26, cy - R * 0.26, R * 0.36, shade(fill, 0.5)),
        disc(cx - R * 0.32, cy - R * 0.32, R * 0.12, '#FFFFFF'),
      ];
    }
    case 'car': {
      const wr = h * 0.15;
      return [
        area(poly([[x + w * 0.24, y + h * 0.48], [x + w * 0.34, y + h * 0.16], [x + w * 0.68, y + h * 0.16], [x + w * 0.82, y + h * 0.48]]), fill, col, sw),
        area(poly([[x + w * 0.33, y + h * 0.46], [x + w * 0.39, y + h * 0.24], [x + w * 0.5, y + h * 0.24], [x + w * 0.5, y + h * 0.46]]), '#FFFFFF', col, 0.7),
        area(poly([[x + w * 0.54, y + h * 0.46], [x + w * 0.54, y + h * 0.24], [x + w * 0.66, y + h * 0.24], [x + w * 0.74, y + h * 0.46]]), '#FFFFFF', col, 0.7),
        { kind: 'rect', x, y: y + h * 0.46, w, h: h * 0.32, r: h * 0.1, fill },
        disc(x + w * 0.24, y + h * 0.8, wr, DARK, col, sw),
        disc(x + w * 0.76, y + h * 0.8, wr, DARK, col, sw),
        disc(x + w * 0.24, y + h * 0.8, wr * 0.4, '#D1D5DB'),
        disc(x + w * 0.76, y + h * 0.8, wr * 0.4, '#D1D5DB'),
      ];
    }
    case 'tree':
      return [
        { kind: 'rect', x: x + w * 0.44, y: y + h * 0.58, w: w * 0.12, h: h * 0.42, r: 1, fill: '#C49A6C', stroke: '#8B6A45', sw },
        disc(x + w * 0.34, y + h * 0.44, Math.min(w, h) * 0.24, fill, col, sw),
        disc(x + w * 0.66, y + h * 0.44, Math.min(w, h) * 0.24, fill, col, sw),
        disc(x + w * 0.5, y + h * 0.27, Math.min(w, h) * 0.27, fill, col, sw),
      ];
    case 'person':
      return [
        { kind: 'rect', x: x + w * 0.3, y: y + h * 0.62, w: w * 0.17, h: h * 0.38, r: 2, fill: shade(fill, -0.12) },
        { kind: 'rect', x: x + w * 0.53, y: y + h * 0.62, w: w * 0.17, h: h * 0.38, r: 2, fill: shade(fill, -0.12) },
        { kind: 'rect', x: x + w * 0.22, y: y + h * 0.27, w: w * 0.56, h: h * 0.42, r: w * 0.18, fill },
        disc(x + w / 2, y + h * 0.13, Math.min(w * 0.22, h * 0.12), fill, col, sw),
      ];
    case 'eye': {
      const cx = x + w / 2, cy = y + h / 2, r = h * 0.3;
      return [
        area([['M', x, cy], ['C', x + w * 0.3, y - h * 0.1, x + w * 0.7, y - h * 0.1, x + w, cy], ['C', x + w * 0.7, y + h * 1.1, x + w * 0.3, y + h * 1.1, x, cy], ['Z']], '#FFFFFF', col, sw),
        disc(cx, cy, r, fill, col, sw * 0.8),
        disc(cx, cy, r * 0.45, '#222222'),
        disc(cx - r * 0.35, cy - r * 0.35, r * 0.18, '#FFFFFF'),
      ];
    }
    default: {
      const o = orient(n);
      const { W, H } = o;
      const hl = clamp(W * 0.25, 6, 14), hw = clamp(H * 0.5, 4, 7);
      return [
        { kind: 'path', fill: 'none', stroke: col, sw: sw * 1.6, cmds: lpoly(o, [[0, H / 2], [W - hl * 0.8, H / 2]], false) },
        area(lpoly(o, [[W, H / 2], [W - hl, H / 2 - hw], [W - hl, H / 2 + hw]]), col),
      ];
    }
  }
}

/** Neuroni diffrattivi: ogni punto emette onde secondarie che raggiungono tutti i punti successivi. */
function huygensShape(n: N): Part[] {
  const o = orient(n);
  const { W, H } = o;
  const k = clamp(Math.round(n.count), 1, 10);
  const col = inkOf(n), sw = n.strokeWidth * 0.8;
  const vs = Array.from({ length: k }, (_, i) => (H * (i + 0.5)) / k);
  const parts: Part[] = [];
  const r1 = Math.min(W * 0.16, (H / k) * 0.42);
  const waves: Cmd[] = [];
  for (const a of vs)
    for (const r of [r1, r1 * 1.8]) {
      const pts = Array.from({ length: 13 }, (_, i): P2 => {
        const t = -1.2 + (2.4 * i) / 12;
        return lpt(o, r * Math.cos(t), a + r * Math.sin(t));
      });
      waves.push(...dashes(pts, [2, 1.8]));
    }
  parts.push(line(waves, mix(col, '#FFFFFF', 0.45), 0.7));
  const hs = clamp(H / k / 5, 3.5, 5.5);
  for (const a of vs)
    for (const b of vs) {
      const A = lpt(o, 0, a), B = lpt(o, W, b);
      parts.push(...arrow(A, B, col, sw, hs));
    }
  for (const a of vs) {
    const p = lpt(o, 0, a);
    parts.push(disc(p[0], p[1], 1.8, col));
  }
  return parts;
}

// ======================================================================
// Piccoli grafici (interferogramma, A-scan, trasmissione, tempo di volo...)
// ======================================================================

const PLOTS = ['interferogram', 'ascan', 'transmission', 'tof', 'psf', 'gauss', 'cos2', 'spectrum', 'histogram'] as const;
const XNAME: Record<(typeof PLOTS)[number], string> = {
  interferogram: '$k$', ascan: '$z$', transmission: '$\\lambda$', tof: '$t$', psf: '$x$', gauss: '$x$', cos2: '$\\Delta\\varphi$', spectrum: '$\\lambda$', histogram: '$t$',
};

function plotShape(n: N): Part[] {
  const kind = kindOf(n.spec, PLOTS, 'gauss');
  const { x, y, w, h } = n;
  const col = inkOf(n, '#2F6FB2');
  const parts: Part[] = [];
  const boxed = n.fill !== 'none';
  if (boxed) parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, 4), fill: n.fill });
  const p = boxed ? clamp(Math.min(w, h) * 0.1, 3, 7) : 1;
  const x0 = x + p, x1 = x + w - p, y0 = y + p, y1 = y + h - p;
  const ls = has(n.spec, 'labels') ? clamp(Math.min(w, h) * 0.16, 8, 11) : 0;
  const xe = ls ? x1 - textW(XNAME[kind], ls) - 3 : x1;
  if (ls) parts.push(text(x1, y1, XNAME[kind], ls, 'end'));
  const hs = clamp(Math.min(w, h) * 0.07, 2.8, 4.5);
  parts.push(...arrow([x0, y1], [xe, y1], AXIS, 0.8, hs), ...arrow([x0 + 1.5, y1], [x0 + 1.5, y0], AXIS, 0.8, hs));
  const px0 = x0 + 4, px1 = xe - hs - 3, py0 = y0 + hs + 3, py1 = y1 - 1.2;
  const X = (t: number) => px0 + t * (px1 - px0), Y = (v: number) => py1 - v * (py1 - py0);
  const sw = Math.max(0.8, n.strokeWidth * 1.1);
  const curve = (f: (t: number) => number, N = 160): P2[] => Array.from({ length: N + 1 }, (_, i): P2 => [X(i / N), Y(clamp(f(i / N), 0, 1))]);
  const g = (t: number, c: number, s: number) => Math.exp(-(((t - c) / s) ** 2));
  const rand = rng(23);
  switch (kind) {
    case 'histogram': {
      const k = clamp(Math.round(n.count) || 16, 6, 40), bw = (px1 - px0) / k;
      for (let i = 0; i < k; i++) {
        const t = (i + 0.5) / k;
        const v = t < 0.28 ? 0.04 + 0.04 * rand() : 0.9 * Math.exp(-(t - 0.28) * 5.5) * (0.9 + 0.2 * rand()) + 0.04;
        parts.push({ kind: 'rect', x: px0 + i * bw + bw * 0.1, y: Y(v), w: bw * 0.8, h: py1 - Y(v), r: 0, fill: mix(col, '#FFFFFF', 0.55), stroke: col, sw: 0.6 });
      }
      return parts;
    }
    case 'tof': {
      parts.push(line(poly(curve((t) => 0.78 * g(t, 0.16, 0.035) + 0.4 * g(t, 0.72, 0.05) + 0.03 * rand()), false), col, sw));
      if (ls) {
        const ya = Y(0.97);
        parts.push(...arrow([X(0.4), ya], [X(0.16), ya], TEXT, 0.7, 3.5), ...arrow([X(0.48), ya], [X(0.72), ya], TEXT, 0.7, 3.5), text(X(0.44), ya, '$\\Delta t$', ls));
      }
      return parts;
    }
    default: {
      const f: Record<string, (t: number) => number> = {
        interferogram: (t) => g(t, 0.5, 0.26) * (0.5 + 0.42 * Math.cos(TAU * 11 * t)),
        ascan: (t) => 0.9 * g(t, 0.14, 0.012) + 0.55 * g(t, 0.32, 0.014) + 0.42 * g(t, 0.47, 0.016) + 0.25 * g(t, 0.7, 0.02) + 0.05 * Math.exp(-t * 2) * rand(),
        transmission: (t) => 0.92 - 0.82 * (1 / (1 + ((t - 0.2) / 0.018) ** 2) + 1 / (1 + ((t - 0.5) / 0.018) ** 2) + 1 / (1 + ((t - 0.8) / 0.018) ** 2)),
        psf: (t) => {
          const xx = (t - 0.5) * 26 + 1e-6;
          return ((2 * besselJ1(xx)) / xx) ** 2 * 0.95;
        },
        gauss: (t) => 0.92 * g(t, 0.5, 0.17),
        cos2: (t) => 0.06 + 0.86 * Math.cos(TAU * t) ** 2,
        spectrum: (t) => 0.9 * g(t, 0.5, 0.2) * (0.98 + 0.02 * Math.sin(t * 40)),
      };
      parts.push(line(poly(curve(f[kind]), false), col, sw));
      return parts;
    }
  }
}

// ======================================================================
// Campo vicino e campo lontano: diffrazione da apertura, onde evanescenti, regioni di campo
// ======================================================================

/** Integrali di Fresnel C(t), S(t) (approssimazione razionale di Abramowitz & Stegun 7.3.32-33). */
function fresnelCS(t: number): [number, number] {
  const a = Math.abs(t);
  const f = (1 + 0.926 * a) / (2 + 1.792 * a + 3.104 * a * a);
  const g = 1 / (2 + 4.142 * a + 3.492 * a * a + 6.67 * a * a * a);
  const ph = (Math.PI * a * a) / 2;
  const C = 0.5 + f * Math.sin(ph) - g * Math.cos(ph), S = 0.5 - f * Math.cos(ph) - g * Math.sin(ph);
  return t < 0 ? [-C, -S] : [C, S];
}

const REGIMES = ['shadow', 'fresnel', 'transition', 'far'] as const;
/** Numero di Fresnel N_F = a²/(λz) di ciascun regime e semiampiezza mostrata (in unità di a). */
const REGIME_NF: Record<(typeof REGIMES)[number], [number, number]> = { shadow: [18, 2], fresnel: [2.5, 2], transition: [0.75, 2.4], far: [0, 1] };
const SCREEN = ['#000000', '#4A0804', '#A3200F', '#E2432E', '#FF8B78', '#FFE3DC'];

/** Intensità della diffrazione da fenditura larga 2a (o foro circolare) in funzione di s ∈ [−1, 1]. */
function diffractionProfile(kind: (typeof REGIMES)[number], circ: boolean): (s: number) => number {
  if (kind === 'far') {
    if (circ) return (s) => airyI(s * 13);
    return (s) => {
      const x = s * 2.4 * Math.PI;
      return Math.abs(x) < 1e-6 ? 1 : (Math.sin(x) / x) ** 2;
    };
  }
  const [N, span] = REGIME_NF[kind];
  const k = Math.sqrt(2 * N);
  return (s) => {
    const xi = s * span;
    const [c1, s1] = fresnelCS(k * (-1 - xi)), [c2, s2] = fresnelCS(k * (1 - xi));
    return ((c2 - c1) ** 2 + (s2 - s1) ** 2) / 2;
  };
}

function airyI(x: number) {
  return Math.abs(x) < 1e-6 ? 1 : ((2 * besselJ1(x)) / x) ** 2;
}

function diffractionShape(n: N): Part[] {
  const kind = kindOf(n.spec, REGIMES, 'far');
  const f = diffractionProfile(kind, has(n.spec, 'circ'));
  const K = 240;
  const raw = Array.from({ length: K + 1 }, (_, i) => f(-1 + (2 * i) / K));
  const mx = Math.max(...raw) || 1;
  const polar = has(n.spec, 'polar');
  const amp = polar || has(n.spec, 'amplitude');
  const val = raw.map((v) => (amp ? Math.sqrt(v / mx) : v / mx));
  const col = inkOf(n, BEAM), sw = Math.max(0.9, n.strokeWidth);
  if (polar) {
    // diagramma di radiazione: ampiezza in funzione dell'angolo, lobo principale verso destra
    const { x, y, w, h } = n;
    const ox = x + 1, oy = y + h / 2, R = Math.min(w - 2, h / 2 - 1);
    const pts: P2[] = val.map((r, i): P2 => {
      const th = ((-1 + (2 * i) / K) * Math.PI) / 2;
      return [ox + R * r * Math.cos(th), oy + R * r * Math.sin(th)];
    });
    const grid: Cmd[] = [...arc(ox, oy, R, -Math.PI / 2, Math.PI / 2), ...arc(ox, oy, R / 2, -Math.PI / 2, Math.PI / 2)];
    for (const a of [-60, -30, 30, 60]) grid.push(...seg([ox, oy], [ox + R * Math.cos((a * Math.PI) / 180), oy + R * Math.sin((a * Math.PI) / 180)]));
    return [
      line(grid, '#D5D9DE', 0.6),
      line(seg([ox, y], [ox, y + h]), AXIS, 0.8),
      line(seg([ox, oy], [ox + R, oy]), '#C9CED6', 0.6),
      area(poly([[ox, oy], ...pts]), n.fill === 'none' ? 'none' : n.fill),
      line(poly(pts, false), col, sw),
    ];
  }
  // profilo cartesiano: u = intensità, v = coordinata trasversale (direction 'top' = intensità verso l'alto)
  const o = orient(n);
  const { W, H } = o;
  const screen = has(n.spec, 'screen');
  const u0 = screen ? W * 0.22 : 0, top = W - 1;
  const pts: P2[] = val.map((r, i): P2 => [u0 + (top - u0) * 0.94 * r, (H * i) / K]);
  const parts: Part[] = [];
  if (screen) {
    // aspetto della figura sullo schermo: strisce di intensità (rosso laser su nero)
    const B = 120;
    let j = 0;
    while (j < B) {
      const c = cmap(SCREEN, Math.sqrt(raw[Math.round(((j + 0.5) * K) / B)] / mx));
      let k = j + 1;
      while (k < B && cmap(SCREEN, Math.sqrt(raw[Math.round(((k + 0.5) * K) / B)] / mx)) === c) k++;
      parts.push(area(lpoly(o, [[0, (H * j) / B], [u0 - 3, (H * j) / B], [u0 - 3, Math.min(H, (H * k) / B + 0.4)], [0, Math.min(H, (H * k) / B + 0.4)]]), c));
      j = k;
    }
    parts.push(area(lpoly(o, [[0, 0], [u0 - 3, 0], [u0 - 3, H], [0, H]]), 'none', '#555555', 0.8));
  }
  parts.push(area(lpoly(o, [[u0, 0], ...pts, [u0, H]]), n.fill === 'none' ? 'none' : n.fill));
  if (has(n.spec, 'edges') && kind !== 'far') {
    const span = REGIME_NF[kind][1];
    const e: Cmd[] = [-1, 1].flatMap((sg) => dashes([lpt(o, u0, H * (0.5 + sg / (2 * span))), lpt(o, top, H * (0.5 + sg / (2 * span)))], [3, 2.5]));
    parts.push(line(e, AXIS, 0.8));
  }
  parts.push(line(lpoly(o, pts, false), col, sw), line(lpoly(o, [[u0, 0], [u0, H]], false), AXIS, 0.9));
  return parts;
}

/** Campo evanescente: riflessione totale interna, apertura sub-λ (SNOM) o curva di decadimento. */
function evanescentShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['tir', 'aperture', 'decay'] as const, 'tir');
  const { x, y, w, h } = n;
  const col = inkOf(n, BEAM);
  const labels = has(n.spec, 'labels');
  const ls = clamp(Math.min(w, h) * 0.09, 8, 11);
  const glow = (t: number) => mix('#FFFFFF', '#EE8A7E', clamp(t, 0, 1));
  const parts: Part[] = [];
  if (kind === 'decay') {
    const x0 = x + 4, y1 = y + h - 4, x1 = x + w - (labels ? 14 : 4), y0 = y + 4;
    parts.push(...arrow([x0, y1], [x1, y1], AXIS, 0.8, 4), ...arrow([x0, y1], [x0, y0], AXIS, 0.8, 4));
    const d = (x1 - x0) * 0.22;
    const pts: P2[] = Array.from({ length: 61 }, (_, i): P2 => {
      const z = ((x1 - x0 - 8) * i) / 60;
      return [x0 + z, y1 - (y1 - y0 - 8) * Math.exp(-z / d)];
    });
    parts.push(area(poly([[x0, y1], ...pts, [pts[60][0], y1]]), mix(col, '#FFFFFF', 0.82)), line(poly(pts, false), col, 1.3));
    parts.push(line(dashes([[x0 + d, y1], [x0 + d, y1 - (y1 - y0 - 8) / Math.E]], [3, 2.5]), AXIS, 0.8), line(dashes([[x0, y1 - (y1 - y0 - 8) / Math.E], [x0 + d, y1 - (y1 - y0 - 8) / Math.E]], [3, 2.5]), AXIS, 0.8));
    if (labels) parts.push(text(x0 + d + 3, y1 - ls * 0.7, '$d$', ls, 'start'), text(x + w, y1, '$z$', ls, 'end'), text(x0 - 2, y1 - (y1 - y0 - 8) / Math.E, '$1/e$', ls * 0.9, 'end'));
    return parts;
  }
  if (kind === 'aperture') {
    // schermo metallico con foro sub-λ: la luce incidente da sopra genera un campo vicino che decade sotto il foro
    const sy = y + h * 0.3, sh = h * 0.14, hx = x + w / 2, hw = Math.max(3, w * 0.07);
    parts.push({ kind: 'rect', x, y, w, h: sy - y, r: 0, fill: BEAM_FILL, stroke: 'none' });
    for (const ax of [0.18, 0.34, 0.66, 0.82]) parts.push(...arrow([x + w * ax, y + 3], [x + w * ax, sy - 4], col, 1.1, 4.5));
    const K = 9, R = Math.min(w * 0.42, h * 0.5);
    for (let k = K; k >= 1; k--) {
      const r = (R * k) / K;
      const half: P2[] = Array.from({ length: 25 }, (_, i): P2 => [hx - r * Math.cos((Math.PI * i) / 24), sy + sh + r * 0.8 * Math.sin((Math.PI * i) / 24)]);
      parts.push(area(poly(half), glow(Math.exp(-3.2 * (k / K)) * 1.1)));
    }
    parts.push({ kind: 'rect', x, y: sy, w: hx - hw / 2 - x, h: sh, r: 0, fill: '#9AA0A6', stroke: '#5B6270', sw: 0.8 }, { kind: 'rect', x: hx + hw / 2, y: sy, w: x + w - hx - hw / 2, h: sh, r: 0, fill: '#9AA0A6', stroke: '#5B6270', sw: 0.8 });
    if (labels) {
      parts.push(text(hx, sy - ls * 0.8, '$d \\ll \\lambda$', ls, 'middle'), text(x + 3, sy + sh / 2, 'metal', ls * 0.9, 'start', '#FFFFFF'));
      parts.push(...arrow([hx + R * 0.85, sy + sh + 2], [hx + R * 0.85, sy + sh + R * 0.5], TEXT, 0.8, 3.5), text(hx + R * 0.85 + 4, sy + sh + R * 0.28, '$\\sim\\lambda/10$', ls, 'start'));
    }
    return parts;
  }
  const yi = y + h * 0.56;
  const xa = x + w * 0.12, xb = x + w * 0.88, depth = h * 0.36, K = 14;
  for (let k = K; k >= 1; k--) parts.push({ kind: 'rect', x: xa, y: yi - (depth * k) / K, w: xb - xa, h: (depth * k) / K, r: 0, fill: glow(Math.exp(-3 * (k / K)) * 1.05), stroke: 'none' });
  parts.push({ kind: 'rect', x, y: yi, w, h: y + h - yi, r: 0, fill: fillOf(n, GLASS), stroke: 'none' }, line(seg([x, yi], [x + w, yi]), '#5B6270', 1));
  const cx = x + w * 0.5;
  parts.push(...arrow([x + w * 0.08, y + h], [cx - 1, yi + 1], col, 1.5, 6), ...arrow([cx + 1, yi + 1], [x + w * 0.92, y + h], col, 1.5, 6));
  const dx = x + w * 0.74;
  const prof: P2[] = Array.from({ length: 41 }, (_, i): P2 => {
    const z = ((depth + h * 0.08) * i) / 40;
    return [dx + w * 0.14 * Math.exp(-z / (depth * 0.3)), yi - z];
  });
  parts.push(line(seg([dx, yi], [dx, yi - depth - h * 0.08]), AXIS, 0.8), line(poly(prof, false), shade(col, -0.15), 1.2));
  if (labels) {
    parts.push(text(x + 4, y + h - ls * 0.9, '$n_1$', ls, 'start'), text(x + 4, y + ls, '$n_2 < n_1$', ls, 'start'), text(cx, y + h - ls * 0.6, '$\\theta > \\theta_c$', ls), text(dx + w * 0.15 + 2, yi - depth * 0.1, '$e^{-z/d}$', ls, 'start'));
  }
  return parts;
}

/** Regioni di campo attorno a un'apertura o antenna: reattiva, radiativa (Fresnel), lontana (Fraunhofer). */
function fieldRegionsShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const col = inkOf(n);
  const ax = x + clamp(w * 0.07, 12, 30), cy = y + h / 2, D = clamp(h * 0.24, 16, 60);
  const R1 = w * 0.2, R2 = w * 0.5;
  const clip = { x, y, w, h, r: Math.min(n.radius, 8) };
  const ring = (R: number): P2[] => Array.from({ length: 73 }, (_, i): P2 => [ax + R * Math.cos(-Math.PI / 2 + (Math.PI * i) / 72), cy + R * Math.sin(-Math.PI / 2 + (Math.PI * i) / 72)]);
  const parts: Part[] = [
    { kind: 'rect', x, y, w, h, r: clip.r, fill: '#EAF2FB', stroke: 'none' },
    { ...disc(ax, cy, R2, '#FFF4D6'), clip },
    { ...disc(ax, cy, R1, '#FCE1D0'), clip },
    { ...line([...dashes(ring(R1), [5, 3]), ...dashes(ring(R2), [5, 3])], shade(col, 0.1), 1), clip },
    { kind: 'rect', x, y, w, h, r: clip.r, fill: 'none', stroke: col, sw: n.strokeWidth },
    line(seg([x + 2, cy], [ax - 3, cy]), '#3A3F47', 1.6),
    { kind: 'rect', x: ax - 3, y: cy - D / 2, w: 6, h: D, r: 1, fill: '#4B5563', stroke: '#2F3338', sw: 0.8 },
  ];
  if (has(n.spec, 'labels')) {
    const ls = clamp(h * 0.06, 9, 12);
    const a1 = 0.5, a2 = 0.28;
    parts.push(...arrow([ax + 4, cy], [ax + R1 * Math.cos(a1), cy + R1 * Math.sin(a1)], '#3A3F47', 0.9, 5), text(ax + R1 * 0.6 * Math.cos(a1) + 2, cy + R1 * 0.6 * Math.sin(a1) + ls * 1.1, '$R_1$', ls, 'middle', '#1F2328'));
    parts.push(...arrow([ax + 4, cy], [ax + R2 * Math.cos(a2), cy + R2 * Math.sin(a2)], '#3A3F47', 0.9, 5), text(ax + R2 * 0.66 * Math.cos(a2), cy + R2 * 0.66 * Math.sin(a2) - ls * 0.9, '$R_2$', ls, 'middle', '#1F2328'));
    parts.push(text(ax - 7, cy - D / 2 - ls * 0.8, '$D$', ls, 'middle', '#1F2328'));
  }
  return parts;
}

/** Sonda per microscopia a campo vicino: fibra rastremata metallizzata con apertura, punta metallica o cantilever AFM. */
function probeShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['aperture', 'tip', 'cantilever'] as const, 'aperture');
  const o = orient(n);
  const { W, H } = o;
  const col = inkOf(n);
  const metal = fillOf(n, '#B8BEC6');
  if (kind === 'tip') return [area(lpoly(o, [[0, 0.28 * H], [W, 0.5 * H], [0, 0.72 * H]]), metal, col, n.strokeWidth)];
  if (kind === 'cantilever')
    return [
      area(lpoly(o, [[0, 0], [0.2 * W, 0], [0.2 * W, 0.85 * H], [0, 0.85 * H]]), metal, col, n.strokeWidth),
      area(lpoly(o, [[0.2 * W, 0.6 * H], [W, 0.72 * H], [0.2 * W, 0.84 * H]]), shade(metal, -0.1), col, n.strokeWidth),
    ];
  return [
    lrect(o, 0, 0.3 * H, 0.38 * W, 0.7 * H, GLASS, 0, { stroke: GLASS_INK }),
    area(lpoly(o, [[0.38 * W, 0.24 * H], [W, 0.44 * H], [W, 0.56 * H], [0.38 * W, 0.76 * H]]), metal, col, n.strokeWidth),
    area(lpoly(o, [[0.38 * W, 0.3 * H], [W, 0.475 * H], [W, 0.525 * H], [0.38 * W, 0.7 * H]]), GLASS, 'none'),
    line(lpoly(o, [[0.15 * W, 0.5 * H], [W, 0.5 * H]], false), mix(GLASS_INK, '#FFFFFF', 0.4), 0.6),
  ];
}

// ---------------- varianti mostrate come pulsanti nel pannello ----------------

const c = (value: string, label: string) => ({ value, label });
const DIAG: SpecGroup = { title: 'Inclinazione', choices: [c('d45', '/ 45°'), c('d135', '\\ 135°')] };
const CMAP_GROUP: SpecGroup = {
  title: 'Colori',
  choices: [c('gray', 'Grigi'), c('hot', 'Hot'), c('viridis', 'Viridis'), c('magma', 'Magma'), c('jet', 'Jet'), c('twilight', 'Fase ciclica'), c('green', 'Verde'), c('blue', 'Blu')],
};
const VARIANT: SpecGroup = { title: 'Variante', choices: [c('v1', '1'), c('v2', '2'), c('v3', '3'), c('v4', '4'), c('v5', '5'), c('v6', '6')] };

const OPTIONS: Record<string, SpecGroup[]> = {
  'opt-lens': [
    { title: 'Tipo', choices: [c('convex', 'Convergente'), c('concave', 'Divergente'), c('plano', 'Piano-convessa'), c('planoconcave', 'Piano-concava'), c('fresnel', 'Fresnel / DOE')] },
    { title: 'Stile', mode: 'many', choices: [c('thin', 'Simbolo sottile')] },
  ],
  'opt-mirror': [
    { title: 'Specchio', choices: [c('flat', 'Piano'), c('concave', 'Concavo'), c('convex', 'Convesso'), c('polygon', 'Poligonale rotante')] },
    { title: 'Inclinazione', choices: [c('none', 'Dritto'), c('d45', '/ 45°'), c('d135', '\\ 135°')] },
    { title: 'Opzioni', mode: 'many', choices: [c('galvo', 'Galvo (rotazione)')] },
  ],
  'opt-bs': [{ title: 'Tipo', choices: [c('cube', 'Cubo'), c('plate', 'Lamina'), c('pbs', 'Polarizzatore (PBS)'), c('dichroic', 'Dicroico')] }, DIAG],
  'opt-laser': [{ title: 'Tipo', choices: [c('box', 'Laser'), c('tube', 'Tubo (HeNe)'), c('diode', 'Diodo')] }, { title: 'Opzioni', mode: 'many', choices: [c('sign', 'Segnale di pericolo')] }],
  'opt-source': [
    { title: 'Sorgente', choices: [c('lamp', 'Lampada'), c('led', 'LED'), c('ledarray', 'Matrice di LED'), c('broadband', 'Banda larga (SLD)'), c('point', 'Puntiforme')] },
    { title: 'Opzioni', mode: 'many', choices: [c('grid', 'Matrice di fronte')] },
  ],
  'opt-beam': [
    { title: 'Profilo', choices: [c('collimated', 'Collimato'), c('focus', 'Convergente'), c('diverge', 'Divergente'), c('waist', 'Gaussiano con waist')] },
    { title: 'Opzioni', mode: 'many', choices: [c('gauss', 'Intensità gaussiana'), c('fronts', 'Fronti d\'onda'), c('axis', 'Asse ottico')] },
    { title: 'Inizio a 45°', choices: [c('cs0', 'Dritto'), c('cs1', '⟍'), c('cs2', '⟋')] },
    { title: 'Fine a 45°', choices: [c('ce0', 'Dritta'), c('ce1', '⟍'), c('ce2', '⟋')] },
  ],
  'opt-fan': [
    { title: 'Forma', choices: [c('cone', 'Cono divergente'), c('focus', 'Cono convergente'), c('band', 'Banda inclinata')] },
    { title: 'Banda', mode: 'many', choices: [c('up', 'Verso l\'alto')] },
  ],
  'opt-rays': [
    { title: 'Raggi', choices: [c('parallel', 'Paralleli'), c('focus', 'Convergenti'), c('diverge', 'Divergenti'), c('cross', 'Incrociati')] },
    { title: 'Opzioni', mode: 'many', choices: [c('arrows', 'Frecce')] },
  ],
  'opt-axis': [{ title: 'Opzioni', mode: 'many', choices: [c('arrow', 'Freccia')] }],
  'opt-fiber': [{ title: 'Fibra', choices: [c('coil', 'Bobina'), c('straight', 'Tratto con connettori'), c('collimator', 'Collimatore'), c('cross', 'Sezione')] }],
  'opt-waveguide': [
    { title: 'Guida', choices: [c('slab', 'Planare (TIR)'), c('mode', 'Con modo'), c('ridge', 'Sezione a costola'), c('bend', 'Curva a S')] },
    { title: 'Testo', mode: 'many', choices: [c('labels', 'Indici / materiali')] },
  ],
  'opt-coupler': [
    { title: 'Tipo', choices: [c('dc', 'Accoppiatore direzionale'), c('fused', 'Fibra fusa 2×2'), c('ybranch', 'Giunzione Y'), c('circulator', 'Circolatore')] },
    { title: 'Testo', mode: 'many', choices: [c('labels', 'Porte')] },
  ],
  'opt-detector': [{ title: 'Rivelatore', choices: [c('camera', 'Fotocamera'), c('sensor', 'Sensore (pixel)'), c('linear', 'Sensore lineare'), c('pd', 'Fotodiodo'), c('pmt', 'Fotomoltiplicatore')] }],
  'opt-grating': [
    { title: 'Profilo', choices: [c('blazed', 'Blazed'), c('binary', 'Binario'), c('sine', 'Sinusoidale')] },
    { title: 'Ventaglio', choices: [c('none', 'Nessuno'), c('orders', 'Ordini m'), c('spectral', 'Spettro')] },
  ],
  'opt-prism': [{ title: 'Prisma', choices: [c('equi', 'Equilatero'), c('right', 'Retto')] }, { title: 'Opzioni', mode: 'many', choices: [c('dispersion', 'Dispersione')] }],
  'opt-plate': [
    {
      title: 'Lamina',
      choices: [c('polarizer', 'Polarizzatore'), c('halfwave', 'λ/2'), c('quarterwave', 'λ/4'), c('filter', 'Filtro'), c('nd', 'Filtro ND'), c('window', 'Finestra'), c('diffuser', 'Diffusore')],
    },
    { title: 'Vista', choices: [c('side', 'Di lato'), c('front', 'Di fronte')] },
  ],
  'opt-aperture': [
    { title: 'Apertura', choices: [c('pinhole', 'Pinhole'), c('slit', 'Fenditura'), c('double', 'Doppia fenditura'), c('iris', 'Diaframma a iride')] },
    { title: 'Vista', choices: [c('side', 'Di lato'), c('front', 'Di fronte')] },
  ],
  'opt-pixels': [
    {
      title: 'Contenuto',
      choices: [c('phase', 'Fase casuale'), c('binary', 'Binario'), c('random', 'Livelli casuali'), c('lens', 'Lente di Fresnel'), c('grating', 'Rampa (reticolo)'), c('hadamard', 'Hadamard'), c('ramp', 'Barra dei colori')],
    },
    { title: 'Vista', choices: [c('front', 'Di fronte'), c('persp', 'Prospettiva'), c('dmd', 'Microspecchi DMD')] },
    CMAP_GROUP,
    { title: 'Opzioni', mode: 'many', choices: [c('grid', 'Griglia')] },
    VARIANT,
  ],
  'opt-pattern': [
    {
      title: 'Immagine',
      choices: [
        c('speckle', 'Speckle'), c('airy', 'Disco di Airy'), c('fringes', 'Frange'), c('rings', 'Anelli'), c('gauss', 'Spot gaussiano'), c('hologram', 'Ologramma'),
        c('phase', 'Mappa di fase'), c('spectrum', 'Spettro di Fourier'), c('psf', 'PSF'), c('digit', 'Cifra (MNIST)'), c('detectors', 'Piano rivelatori'),
        c('usaf', 'Mira USAF'), c('caustic', 'Caustica (diffusore)'), c('cells', 'Cellule'), c('kspace', 'Spazio k (FPM)'), c('phantom', 'Fantoccio'), c('blurry', 'Misura sfocata'),
      ],
    },
    CMAP_GROUP,
    { title: 'Opzioni', mode: 'many', choices: [c('persp', 'Prospettiva'), c('coarse', 'Bassa risoluzione'), c('blur', 'Sfocata'), c('labels', 'Numeri')] },
    VARIANT,
  ],
  'opt-objective': [],
  'opt-sample': [{ title: 'Campione', choices: [c('slide', 'Vetrino'), c('dish', 'Piastra'), c('cuvette', 'Cuvetta'), c('tissue', 'Tessuto a strati'), c('chamber', 'Camera (light-sheet)')] }],
  'opt-mzi': [
    { title: 'Rete', choices: [c('clements', 'Clements (rettangolare)'), c('reck', 'Reck (triangolare)')] },
    { title: 'Opzioni', mode: 'many', choices: [c('chip', 'Chip'), c('labels', 'θ, φ')] },
  ],
  'opt-ring': [
    { title: 'Anello', choices: [c('allpass', 'All-pass'), c('adddrop', 'Add-drop')] },
    { title: 'Opzioni', mode: 'many', choices: [c('heater', 'Riscaldatore'), c('resonant', 'In risonanza'), c('chip', 'Chip'), c('labels', 'Porte')] },
  ],
  'opt-chip': [{ title: 'Vista', choices: [c('top', 'Dall\'alto'), c('iso', 'Assonometria')] }],
  'opt-object': [{ title: 'Oggetto', choices: [c('arrow', 'Freccia (oggetto)'), c('cube', 'Cubo'), c('sphere', 'Sfera'), c('car', 'Auto'), c('tree', 'Albero'), c('person', 'Persona'), c('eye', 'Occhio')] }],
  'opt-huygens': [],
  'opt-diffraction': [
    { title: 'Regime', choices: [c('shadow', 'Ombra geometrica (N_F ≫ 1)'), c('fresnel', 'Fresnel (N_F ≈ 3)'), c('transition', 'Transizione (N_F ≈ 1)'), c('far', 'Fraunhofer (N_F ≪ 1)')] },
    { title: 'Vista', choices: [c('profile', 'Profilo'), c('polar', 'Diagramma polare')] },
    { title: 'Opzioni', mode: 'many', choices: [c('screen', 'Figura sullo schermo'), c('edges', 'Bordi geometrici'), c('amplitude', 'Ampiezza |U|'), c('circ', 'Foro circolare (Airy)')] },
  ],
  'opt-evanescent': [
    { title: 'Tipo', choices: [c('tir', 'Riflessione totale interna'), c('aperture', 'Apertura sub-λ'), c('decay', 'Curva di decadimento')] },
    { title: 'Testo', mode: 'many', choices: [c('labels', 'Etichette')] },
  ],
  'opt-fieldregions': [{ title: 'Testo', mode: 'many', choices: [c('labels', 'R₁, R₂, D')] }],
  'opt-probe': [{ title: 'Sonda', choices: [c('aperture', 'Fibra con apertura'), c('tip', 'Punta metallica'), c('cantilever', 'Cantilever AFM')] }],
  'opt-plot': [
    {
      title: 'Grafico',
      choices: [
        c('interferogram', 'Interferogramma'), c('ascan', 'A-scan'), c('transmission', 'Trasmissione anello'), c('tof', 'Tempo di volo'), c('psf', 'Profilo PSF'),
        c('gauss', 'Gaussiana'), c('cos2', 'cos² (interferenza)'), c('spectrum', 'Spettro sorgente'), c('histogram', 'Istogramma TCSPC'),
      ],
    },
    { title: 'Testo', mode: 'many', choices: [c('labels', 'Nome asse')] },
  ],
};

const DEFS: Omit<ShapeDef, 'specOptions'>[] = [
  { kind: 'opt-lens', name: 'Lente', parts: lensShape, countLabel: 'Curvatura', countMax: 10, specLabel: 'Tipo', directionLabel: 'Asse ottico' },
  { kind: 'opt-mirror', name: 'Specchio', parts: mirrorShape, specLabel: 'Tipo', directionLabel: 'Faccia riflettente' },
  { kind: 'opt-bs', name: 'Beam splitter', parts: bsShape, specLabel: 'Tipo' },
  { kind: 'opt-laser', name: 'Laser', parts: laserShape, specLabel: 'Tipo', directionLabel: 'Uscita' },
  { kind: 'opt-source', name: 'Sorgente (lampada, LED...)', parts: sourceShape, countLabel: 'LED', countMax: 24, specLabel: 'Tipo', directionLabel: 'Emissione' },
  { kind: 'opt-beam', name: 'Fascio laser', parts: beamShape, countLabel: 'Larghezza minima (%)', countMax: 100, specLabel: 'Profilo', directionLabel: 'Propagazione' },
  { kind: 'opt-fan', name: 'Cono di luce', parts: fanShape, countLabel: 'Vertice / banda (%)', countMax: 100, specLabel: 'Forma', directionLabel: 'Propagazione' },
  { kind: 'opt-rays', name: 'Raggi', parts: raysShape, countLabel: 'Raggi', countMax: 15, specLabel: 'Tipo', directionLabel: 'Propagazione' },
  { kind: 'opt-axis', name: 'Asse ottico', parts: axisShape, specLabel: 'Opzioni', directionLabel: 'Verso' },
  { kind: 'opt-fiber', name: 'Fibra ottica', parts: fiberShape, specLabel: 'Tipo', directionLabel: 'Uscita' },
  { kind: 'opt-waveguide', name: 'Guida d\'onda', parts: waveguideShape, specLabel: 'Tipo' },
  { kind: 'opt-coupler', name: 'Accoppiatore / circolatore', parts: couplerShape, specLabel: 'Tipo' },
  { kind: 'opt-detector', name: 'Rivelatore / fotocamera', parts: detectorShape, countLabel: 'Pixel', countMax: 48, specLabel: 'Tipo', directionLabel: 'Lato d\'ingresso' },
  { kind: 'opt-grating', name: 'Reticolo di diffrazione', parts: gratingShape, countLabel: 'Solchi', countMax: 40, specLabel: 'Profilo', directionLabel: 'Uscita' },
  { kind: 'opt-prism', name: 'Prisma', parts: prismShape, specLabel: 'Tipo' },
  { kind: 'opt-plate', name: 'Lamina (polarizzatore, λ/2, filtro...)', parts: plateShape, specLabel: 'Tipo', directionLabel: 'Asse ottico' },
  { kind: 'opt-aperture', name: 'Pinhole / fenditura', parts: apertureShape, countLabel: 'Apertura (%)', countMax: 90, specLabel: 'Tipo', directionLabel: 'Asse ottico' },
  { kind: 'opt-pixels', name: 'Maschera a pixel (SLM, DMD, strato)', parts: pixelsShape, countLabel: 'Pixel', countMax: 64, specLabel: 'Contenuto', directionLabel: 'Faccia (DMD)' },
  { kind: 'opt-pattern', name: 'Immagine ottica (speckle, Airy...)', parts: patternShape, countLabel: 'Parametro', countMax: 30, specLabel: 'Immagine' },
  { kind: 'opt-objective', name: 'Obiettivo da microscopio', parts: objectiveShape, directionLabel: 'Punta' },
  { kind: 'opt-sample', name: 'Campione', parts: sampleShape, specLabel: 'Tipo' },
  { kind: 'opt-mzi', name: 'Interferometro MZI / rete', parts: mziShape, countLabel: 'Modi', countMax: 8, specLabel: 'Rete' },
  { kind: 'opt-ring', name: 'Microanello risonante', parts: ringShape, specLabel: 'Tipo' },
  { kind: 'opt-chip', name: 'Chip fotonico', parts: chipShape, specLabel: 'Vista' },
  { kind: 'opt-object', name: 'Oggetto (scena)', parts: objectShape, specLabel: 'Oggetto', directionLabel: 'Punta (freccia)' },
  { kind: 'opt-huygens', name: 'Onde secondarie (neuroni)', parts: huygensShape, countLabel: 'Punti', countMax: 10, directionLabel: 'Propagazione' },
  { kind: 'opt-plot', name: 'Grafico ottico', parts: plotShape, countLabel: 'Barre', countMax: 40, specLabel: 'Grafico' },
  { kind: 'opt-diffraction', name: 'Diffrazione: campo vicino / lontano', parts: diffractionShape, specLabel: 'Regime', directionLabel: 'Asse dell\'intensità' },
  { kind: 'opt-evanescent', name: 'Onda evanescente', parts: evanescentShape, specLabel: 'Tipo' },
  { kind: 'opt-fieldregions', name: 'Regioni di campo (antenna)', parts: fieldRegionsShape, specLabel: 'Testo' },
  { kind: 'opt-probe', name: 'Sonda SNOM / AFM', parts: probeShape, specLabel: 'Sonda', directionLabel: 'Punta' },
];

export const OPTICS_SHAPES: ShapeDef[] = DEFS.map((d) => ({ ...d, specOptions: OPTIONS[d.kind]?.length ? OPTIONS[d.kind] : undefined }));
