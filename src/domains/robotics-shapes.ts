// Forme del modulo "Robotica e controllo": manipolatori (catena cinematica, pinze), robot mobili,
// quadrupedi, umanoidi, droni, terne di riferimento, sensori (lidar, camera RGB-D), mappe a
// occupazione, traiettorie, alberi RRT, grafi delle pose, scene di manipolazione, piano immagine,
// simboli dei giunti e grafici di controllo (risposta al gradino, orizzonte MPC).
// Tutte procedurali e deterministiche (rng), disegnate con le primitive `Part`.
//
// Le varianti si scelgono con `spec` (parole chiave combinabili), elencate in `specOptions` in
// fondo al file; `count` regola il numero di elementi (link, raggi, waypoint, campioni...).
import { arc, framed, mix, orient, poly, rng, roundPoly, shade, type Box, type Cmd, type Part, type Rand } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';

type P2 = [number, number];
type N = NodeModel;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const AXIS = '#8A9099';
const GUIDE = '#B9BEC6';
const TEXT = '#4B5563';
const DARK = '#3A3F47';
const METAL = '#6B7480';
const AX_X = '#D64545';
const AX_Y = '#2E9E5B';
const AX_Z = '#2F6FB2';
const ACCENT = '#D9822B';
const GO = '#2E9E5B';
const STOP = '#D64545';
const OBST = '#C9CDD3';

const inkOf = (n: N, fb = DARK) => (n.stroke === 'none' ? fb : n.stroke);
const fillOf = (n: N, fb = '#FFFFFF') => (n.fill === 'none' ? fb : n.fill);
const has = (spec: string, word: string) => new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, 'i').test(spec);
const kindOf = <T extends string>(spec: string, kinds: readonly T[], fb: T): T => kinds.find((k) => has(spec, k)) ?? fb;
const tint = (c: string, t: number) => mix(c, '#FFFFFF', t);

const line = (cmds: Cmd[], stroke: string, sw: number): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true });
const area = (cmds: Cmd[], fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'path', cmds, fill, stroke, sw, solid: true });
/** Contorno principale: usa il bordo del blocco (anche tratteggiato, per pose "previste"). */
const outline = (cmds: Cmd[], fill: string): Part => ({ kind: 'path', cmds, fill });
const disc = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true });
const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];
const text = (x: number, y: number, t: string, size: number, anchor: 'start' | 'middle' | 'end' = 'middle', fill = TEXT): Part => ({ kind: 'text', x, y, text: t, size, fill, anchor });
const add = (a: P2, b: P2, k = 1): P2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const dir = (a: number): P2 => [Math.cos(a), Math.sin(a)];
const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dist = (a: P2, b: P2) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function head(tip: P2, dx: number, dy: number, size: number, color: string): Part {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const bx = tip[0] - ux * size, by = tip[1] - uy * size;
  const hw = size * 0.45;
  return area(poly([tip, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]), color);
}

function arrow(a: P2, b: P2, color: string, sw: number, size: number): Part[] {
  const l = dist(a, b) || 1;
  const cut = Math.min(size * 0.8, l * 0.5);
  const end: P2 = [b[0] - ((b[0] - a[0]) / l) * cut, b[1] - ((b[1] - a[1]) / l) * cut];
  return [line(seg(a, end), color, sw), head(b, b[0] - a[0], b[1] - a[1], size, color)];
}

/** Freccia con due punte (quote, orizzonti). */
function arrow2(a: P2, b: P2, color: string, sw: number, size: number): Part[] {
  const l = dist(a, b) || 1;
  const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
  const c = Math.min(size * 0.8, l * 0.3);
  return [line(seg([a[0] + ux * c, a[1] + uy * c], [b[0] - ux * c, b[1] - uy * c]), color, sw), head(b, ux, uy, size, color), head(a, -ux, -uy, size, color)];
}

/** Tratteggio lungo una polilinea (indipendente dallo stile del blocco). */
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

/** Asta con estremi arrotondati da a a b (link di un robot), semispessore r. */
function capsule(a: P2, b: P2, r: number): Cmd[] {
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const nx = Math.cos(th - Math.PI / 2), ny = Math.sin(th - Math.PI / 2);
  return [
    ['M', a[0] + nx * r, a[1] + ny * r],
    ['L', b[0] + nx * r, b[1] + ny * r],
    ...arc(b[0], b[1], r, th - Math.PI / 2, th + Math.PI / 2).slice(1),
    ['L', a[0] - nx * r, a[1] - ny * r],
    ...arc(a[0], a[1], r, th + Math.PI / 2, th + 1.5 * Math.PI).slice(1),
    ['Z'],
  ];
}

/** Disegno in coordinate proprie (x0..x1, y0..y1, y verso il basso) adattato al blocco senza deformarlo. */
function fit(n: N, x0: number, y0: number, x1: number, y1: number, mirror = false) {
  const s = Math.min(n.w / (x1 - x0), n.h / (y1 - y0));
  const ox = n.x + (n.w - (x1 - x0) * s) / 2, oy = n.y + (n.h - (y1 - y0) * s) / 2;
  const P = (u: number, v: number): P2 => [ox + (mirror ? x1 - u : u - x0) * s, oy + (v - y0) * s];
  return { s, P, all: (ps: P2[]) => ps.map(([u, v]) => P(u, v)) };
}

/** Riquadro di punti (per adattare disegni calcolati). */
function bounds(pts: P2[], pad = 0) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad] as const;
}

/** Punti di una curva Catmull-Rom aperta (per tracciati e tangenti). */
function catmull(pts: P2[], k = 16): P2[] {
  if (pts.length < 3) return pts;
  const out: P2[] = [];
  const at = (i: number) => pts[clamp(i, 0, pts.length - 1)];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ======================================================================
// Manipolatore: catena cinematica planare con base, giunti e utensile
// ======================================================================

const ARM_POSES: Record<string, [number, number, number]> = { reach: [60, -80, 1.6], up: [82, 12, 1], fold: [118, -90, 0.8], down: [40, -90, 0.7] };
const LINK_L = [1, 0.86, 0.72, 0.6, 0.52, 0.46];

/** Utensile all'estremo (coordinate del disegno, y verso l'alto): pinza parallela o ventosa. */
function toolPolys(kind: string, tip: P2, a: number, open: boolean): { pts: P2[]; tone: 'flange' | 'tool' | 'pad' }[] {
  const d = dir(a), m: P2 = [-d[1], d[0]];
  const Q = (u: number, v: number): P2 => [tip[0] + d[0] * u + m[0] * v, tip[1] + d[1] * u + m[1] * v];
  const rect = (u0: number, u1: number, v0: number, v1: number) => [Q(u0, v0), Q(u1, v0), Q(u1, v1), Q(u0, v1)];
  if (kind === 'suction') {
    return [
      { pts: rect(0, 0.17, -0.035, 0.035), tone: 'flange' },
      { pts: [Q(0.17, -0.045), Q(0.26, -0.11), Q(0.26, 0.11), Q(0.17, 0.045)], tone: 'pad' },
    ];
  }
  if (kind !== 'parallel') return [];
  const g = open ? 0.1 : 0.045;
  return [
    { pts: rect(0, 0.07, -0.07, 0.07), tone: 'flange' },
    { pts: rect(0.06, 0.13, -0.17, 0.17), tone: 'tool' },
    { pts: rect(0.13, 0.34, g, g + 0.055), tone: 'tool' },
    { pts: rect(0.13, 0.34, -g - 0.055, -g), tone: 'tool' },
  ];
}

function armShape(n: N): Part[] {
  const L = clamp(Math.round(n.count), 1, 6);
  const [a0, a1, ease] = ARM_POSES[kindOf(n.spec, ['reach', 'up', 'fold', 'down'] as const, 'reach')];
  const tool = kindOf(n.spec, ['parallel', 'suction', 'notool'] as const, 'parallel');
  const frames = has(n.spec, 'frames'), angles = has(n.spec, 'angles');
  const angs = Array.from({ length: L }, (_, i) => (L === 1 ? a0 : a0 + (a1 - a0) * (i / (L - 1)) ** ease) * DEG);
  const hb = 0.42, RL = 0.075, RJ = 0.1;
  const J: P2[] = [[0, hb]];
  angs.forEach((a, i) => J.push(add(J[i], dir(a), LINK_L[i] * (i === L - 1 && tool !== 'notool' ? 0.72 : 1))));
  const tp = toolPolys(tool, J[L], angs[L - 1], !has(n.spec, 'closed'));
  // ingombro: base, giunti, utensile, frecce dei frame ed etichette degli angoli
  const ext: P2[] = [[-0.42, -0.1], [0.42, 0], ...J.map((p) => add(p, [0, 0])), ...tp.flatMap((t) => t.pts)];
  J.forEach((p) => ext.push(add(p, [RJ * 1.3, RJ * 1.3]), add(p, [-RJ * 1.3, -RJ * 1.3])));
  if (frames) J.slice(0, L).forEach((p, i) => ext.push(add(p, dir(angs[i]), 0.36), add(p, dir(angs[i] + Math.PI / 2), 0.36)));
  if (angles) J.slice(0, L).forEach((p, i) => ext.push(add(p, dir(((i ? angs[i - 1] : 0) + angs[i]) / 2), 0.56)));
  const [bx0, by0, bx1, by1] = bounds(ext, 0.03);
  const F = fit(n, bx0, -by1, bx1, -by0, has(n.spec, 'mirror'));
  const T = (p: P2) => F.P(p[0], -p[1]);
  const s = F.s;
  const fill = fillOf(n, '#DAE8FC'), ink = inkOf(n);
  const baseC = mix(fill, ink, 0.45), toolC = mix(fill, ink, 0.25);
  const sw = n.strokeWidth;
  const parts: Part[] = [];
  // base: pavimento tratteggiato, piastra e colonna
  const hatch: Cmd[] = [];
  for (let k = 0; k < 8; k++) hatch.push(...seg(T([-0.36 + k * 0.1, 0]), T([-0.36 + k * 0.1 - 0.07, -0.08])));
  parts.push(line([...seg(T([-0.42, 0]), T([0.42, 0])), ...hatch], AXIS, Math.max(0.7, sw * 0.7)));
  parts.push(outline(roundPoly([T([-0.3, 0]), T([0.3, 0]), T([0.3, 0.08]), T([-0.3, 0.08])], s * 0.02), baseC));
  parts.push(outline(roundPoly([T([-0.16, 0.08]), T([0.16, 0.08]), T([0.11, hb]), T([-0.11, hb])], s * 0.02), baseC));
  for (let i = 0; i < L; i++) parts.push(outline(capsule(T(J[i]), T(J[i + 1]), RL * s), fill));
  for (const t of tp) parts.push(outline(roundPoly(t.pts.map(T), s * 0.012), t.tone === 'flange' ? METAL : t.tone === 'pad' ? DARK : toolC));
  // giunti: asse uscente dal foglio (cerchio con punto)
  J.slice(0, L).forEach((p, i) => {
    const [cx, cy] = T(p);
    parts.push({ kind: 'ellipse', cx, cy, rx: RJ * s * (i ? 1 : 1.15), ry: RJ * s * (i ? 1 : 1.15), fill: '#FFFFFF' }, disc(cx, cy, Math.max(1, RJ * s * 0.3), ink));
  });
  const [wx, wy] = T(J[L]);
  parts.push({ kind: 'ellipse', cx: wx, cy: wy, rx: RL * s * 0.85, ry: RL * s * 0.85, fill: toolC });
  const hs = clamp(s * 0.09, 3, 6.5);
  const fsz = clamp(s * 0.13, 8, 12);
  if (angles) {
    for (let i = 0; i < L; i++) {
      const ref = i ? angs[i - 1] : 0, a = angs[i];
      const p = J[i];
      parts.push(line(dashes([T(p), T(add(p, dir(ref), 0.42))], 2.4, 2), GUIDE, 0.8));
      if (Math.abs(a - ref) < 4 * DEG) continue;
      const pts = Array.from({ length: 17 }, (_, k) => T(add(p, dir(ref + ((a - ref) * k) / 16), 0.27)));
      parts.push(line(poly(pts, false), ACCENT, Math.max(0.8, sw * 0.8)));
      parts.push(head(pts[16], pts[16][0] - pts[14][0], pts[16][1] - pts[14][1], hs * 0.8, ACCENT));
      const [tx, ty] = T(add(p, dir((ref + a) / 2), 0.44));
      parts.push(text(tx, ty, `$\\theta_${i + 1}$`, fsz, 'middle', '#8A4B0F'));
    }
  }
  if (frames) {
    J.slice(0, L).forEach((p, i) => {
      parts.push(...arrow(T(p), T(add(p, dir(angs[i]), 0.32)), AX_X, Math.max(1, sw), hs));
      parts.push(...arrow(T(p), T(add(p, dir(angs[i] + Math.PI / 2), 0.32)), AX_Y, Math.max(1, sw), hs));
    });
  }
  return parts;
}

// ======================================================================
// Pinza (parallela / ventosa), orientabile
// ======================================================================

function gripperShape(n: N): Part[] {
  const o = orient(n);
  const Q = (u: number, v: number): P2 => o.at(u * o.W, v * o.H);
  const R = (u0: number, u1: number, v0: number, v1: number, r: number) => roundPoly([Q(u0, v0), Q(u1, v0), Q(u1, v1), Q(u0, v1)], r);
  const fill = fillOf(n, '#E5E7EB'), ink = inkOf(n);
  const r = Math.min(o.W, o.H) * 0.03;
  const dark = mix(fill, ink, 0.55);
  const obj = has(n.spec, 'object');
  const OBJ = { fill: '#F6C177', stroke: '#B7791F' };
  if (has(n.spec, 'suction')) {
    const parts: Part[] = [area(R(0, 0.1, 0.36, 0.64, r), METAL, ink, n.strokeWidth), outline(R(0.1, 0.42, 0.28, 0.72, r * 2), fill), area(R(0.42, 0.6, 0.44, 0.56, 0), METAL, ink, n.strokeWidth)];
    // soffietto a fisarmonica e coppa
    const zz: P2[] = [];
    const folds = 3;
    for (let k = 0; k <= folds * 2; k++) zz.push(Q(0.6 + (0.22 * k) / (folds * 2), k % 2 ? 0.34 : 0.4));
    const back = zz;
    const mirrorV = (p: P2): P2 => {
      // riflessione rispetto all'asse dell'utensile (v = 0.5)
      const c0 = Q(0, 0.5), c1 = Q(1, 0.5);
      const dx = c1[0] - c0[0], dy = c1[1] - c0[1], L2 = dx * dx + dy * dy;
      const t = ((p[0] - c0[0]) * dx + (p[1] - c0[1]) * dy) / L2;
      const fx = c0[0] + t * dx, fy = c0[1] + t * dy;
      return [2 * fx - p[0], 2 * fy - p[1]];
    };
    parts.push(area(poly([...back, ...[...back].reverse().map(mirrorV)]), dark, ink, n.strokeWidth));
    parts.push(area(roundPoly([Q(0.82, 0.38), Q(0.93, 0.2), Q(0.93, 0.8), Q(0.82, 0.62)], r), DARK, ink, n.strokeWidth));
    if (obj) parts.push(area(R(0.93, 1, 0.08, 0.92, r * 0.6), OBJ.fill, OBJ.stroke, n.strokeWidth));
    return parts;
  }
  // pinza parallela: corpo svasato, dita corte con cuscinetti sul lato interno
  const closed = has(n.spec, 'closed');
  const fv = closed ? [0.26, 0.4] : [0.07, 0.21];
  const parts: Part[] = [
    area(R(0, 0.1, 0.37, 0.63, r), METAL, ink, n.strokeWidth),
    outline(roundPoly([Q(0.1, 0.22), Q(0.1, 0.78), Q(0.56, 0.98), Q(0.56, 0.02)], r * 2), fill),
    line(seg(Q(0.47, 0.06), Q(0.47, 0.94)), shade(ink, 0.4), 0.7),
  ];
  if (obj) parts.push(area(R(0.62, 0.97, 0.4, 0.6, r * 0.6), OBJ.fill, OBJ.stroke, n.strokeWidth));
  for (const [vo, vi] of [[fv[0], fv[1]], [1 - fv[0], 1 - fv[1]]]) {
    parts.push(outline(roundPoly([Q(0.56, vo), Q(0.56, vi), Q(0.97, vi), Q(0.97, vo + (vi - vo) * 0.3)], r), mix(fill, ink, 0.18)));
    const pad = vi > vo ? [vi - 0.035, vi] : [vi, vi + 0.035];
    parts.push(area(R(0.74, 0.96, pad[0], pad[1], 0), dark));
  }
  return parts;
}

// ======================================================================
// Robot mobile a guida differenziale (vista dall'alto), orientabile
// ======================================================================

function mobileShape(n: N): Part[] {
  const o = orient(n);
  const fill = fillOf(n, '#DAE8FC'), ink = inkOf(n);
  const sw = n.strokeWidth;
  const withFrame = has(n.spec, 'frame');
  const R = withFrame ? Math.min(o.W, o.H) / 2 / 1.8 : Math.min(o.W / 2 / 1.02, o.H / 2 / 1.16);
  const c: P2 = [o.W / 2, o.H / 2];
  const A = (u: number, v: number): P2 => o.at(c[0] + u * R, c[1] + v * R);
  const P = (pts: [number, number][]) => pts.map(([u, v]) => A(u, v));
  const rectBody = has(n.spec, 'rect');
  const parts: Part[] = [];
  if (rectBody) parts.push(outline(roundPoly(P([[-0.98, -0.86], [0.98, -0.86], [0.98, 0.86], [-0.98, 0.86]]), R * 0.18), fill));
  else parts.push(outline(poly(Array.from({ length: 48 }, (_, k): P2 => A(Math.cos((TAU * k) / 48), Math.sin((TAU * k) / 48)))), fill));
  // ruotino folle, asse delle ruote, paraurti anteriore
  const [kx, ky] = A(-0.7, 0);
  parts.push(disc(kx, ky, R * 0.1, '#FFFFFF', ink, Math.max(0.7, sw * 0.7)));
  parts.push(line(dashes([A(0, -0.86), A(0, 0.86)], 2.5, 2), shade(ink, 0.35), 0.7));
  const bump = Array.from({ length: 13 }, (_, k) => {
    const t = (-50 + (100 * k) / 12) * DEG;
    return rectBody ? A(0.98, Math.sin(t) * 0.8) : A(Math.cos(t), Math.sin(t));
  });
  parts.push(line(poly(bump, false), mix(fill, ink, 0.7), Math.max(1.6, sw * 1.8)));
  // ruote motrici ai lati, sull'asse
  for (const sgn of [-1, 1]) parts.push(area(roundPoly(P([[-0.34, sgn * 0.84], [0.34, sgn * 0.84], [0.34, sgn * 1.1], [-0.34, sgn * 1.1]]), R * 0.06), '#4B5563', DARK, Math.max(0.8, sw * 0.8)));
  if (has(n.spec, 'sensor')) {
    const [sx, sy] = A(-0.16, 0);
    parts.push(disc(sx, sy, R * 0.24, '#4B5563', DARK, 0.8), disc(sx, sy, R * 0.1, '#9CA3AF'));
  }
  // freccia della direzione di marcia
  if (!withFrame) parts.push(area(poly(P([[0.74, 0], [0.42, -0.17], [0.49, 0], [0.42, 0.17]])), mix(fill, ink, 0.7)));
  if (withFrame) {
    const o0 = A(0, 0), ox = A(1, 0);
    const hd: P2 = [(ox[0] - o0[0]) / R, (ox[1] - o0[1]) / R];
    const left: P2 = [hd[1], -hd[0]];
    const hs = clamp(R * 0.2, 3.5, 6);
    const ex = add(o0, hd, R * 1.4), ey = add(o0, left, R * 1.4);
    parts.push(...arrow(o0, ex, AX_X, Math.max(1, sw), hs), ...arrow(o0, ey, AX_Y, Math.max(1, sw), hs), disc(o0[0], o0[1], Math.max(1.4, R * 0.06), DARK));
    const fs = clamp(R * 0.32, 8, 12);
    parts.push(text(ex[0] + hd[0] * fs * 0.6, ex[1] + hd[1] * fs * 0.6, '$x_R$', fs), text(ey[0] + left[0] * fs * 0.7, ey[1] + left[1] * fs * 0.7, '$y_R$', fs));
  }
  return parts;
}

// ======================================================================
// Quadrupede e umanoide
// ======================================================================

/** Ginocchio di una gamba a due segmenti (verso il retro): IK planare. */
function knee(hip: P2, foot: P2, a: number, b: number, back = true): P2 {
  const d = clamp(dist(hip, foot), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const phi = Math.atan2(foot[1] - hip[1], foot[0] - hip[0]);
  const al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  return add(hip, dir(phi + (back ? al : -al)), a);
}

function quadrupedShape(n: N): Part[] {
  const F = fit(n, 0.02, 0.06, 1.0, 0.76, has(n.spec, 'mirror'));
  const { s, P } = F;
  const fill = fillOf(n, '#E5E7EB'), ink = inkOf(n);
  const far = shade(fill, -0.14);
  const sw = n.strokeWidth;
  const trot = has(n.spec, 'trot');
  const G = 0.72;
  const legs: { hip: P2; foot: P2; far: boolean }[] = [
    { hip: [0.74, 0.34], foot: trot ? [0.7, G] : [0.79, G], far: true },
    { hip: [0.31, 0.34], foot: trot ? [0.38, G - 0.1] : [0.35, G], far: true },
    { hip: [0.71, 0.34], foot: trot ? [0.82, G - 0.1] : [0.75, G], far: false },
    { hip: [0.28, 0.34], foot: trot ? [0.24, G] : [0.31, G], far: false },
  ];
  const parts: Part[] = [];
  if (!has(n.spec, 'noground')) parts.push(line(seg(P(0.06, G + 0.028), P(0.98, G + 0.028)), AXIS, Math.max(0.7, sw * 0.7)));
  const leg = (l: (typeof legs)[number]) => {
    const k = knee(l.hip, l.foot, 0.2, 0.21);
    const c = l.far ? far : fill;
    const out: Part[] = [
      outline(capsule(P(...l.hip), P(...k), 0.034 * s), c),
      outline(capsule(P(...k), P(...l.foot), 0.024 * s), c),
    ];
    const [kx, ky] = P(...k), [fx, fy] = P(...l.foot);
    out.push(disc(kx, ky, 0.03 * s, '#FFFFFF', ink, Math.max(0.7, sw * 0.8)), disc(fx, fy, 0.028 * s, DARK));
    return out;
  };
  legs.filter((l) => l.far).forEach((l) => parts.push(...leg(l)));
  // corpo, testa con sensori
  parts.push(outline(roundPoly([P(0.15, 0.2), P(0.82, 0.2), P(0.82, 0.38), P(0.15, 0.38)], 0.05 * s), fill));
  parts.push(line(seg(P(0.2, 0.25), P(0.77, 0.25)), shade(ink, 0.45), 0.7));
  parts.push(outline(roundPoly([P(0.8, 0.22), P(0.95, 0.24), P(0.95, 0.36), P(0.8, 0.37)], 0.03 * s), mix(fill, ink, 0.3)));
  parts.push(area(roundPoly([P(0.905, 0.27), P(0.94, 0.275), P(0.94, 0.32), P(0.905, 0.32)], 0.008 * s), DARK));
  legs.filter((l) => !l.far).forEach((l) => parts.push(...leg(l)));
  for (const l of legs.filter((x) => !x.far)) {
    const [hx, hy] = P(...l.hip);
    parts.push(disc(hx, hy, 0.042 * s, mix(fill, ink, 0.3), ink, Math.max(0.7, sw * 0.8)));
  }
  return parts;
}

function humanoidShape(n: N): Part[] {
  const pose = kindOf(n.spec, ['stand', 'wave', 'tpose'] as const, 'stand');
  const fill = fillOf(n, '#E5E7EB'), ink = inkOf(n);
  const dark = mix(fill, ink, 0.32);
  const sw = n.strokeWidth;
  const arm = (side: number): [P2, P2, P2] => {
    const sh: P2 = [side * 0.2, 0.235];
    if (pose === 'tpose') return [sh, [side * 0.36, 0.24], [side * 0.5, 0.245]];
    if (pose === 'wave' && side < 0) return [sh, [side * 0.33, 0.17], [side * 0.31, 0.03]];
    return [sh, [side * 0.235, 0.38], [side * 0.245, 0.52]];
  };
  const arms = [arm(-1), arm(1)];
  const xs = arms.flat().map((p) => Math.abs(p[0]));
  const half = Math.max(0.3, ...xs) + 0.06;
  const F = fit(n, -half, -0.01, half, 1.0, has(n.spec, 'mirror'));
  const { s, P } = F;
  const parts: Part[] = [];
  // gambe
  for (const sd of [-1, 1]) {
    const hip: P2 = [sd * 0.075, 0.53], kn: P2 = [sd * 0.085, 0.73], an: P2 = [sd * 0.085, 0.92];
    parts.push(outline(capsule(P(...hip), P(...kn), 0.048 * s), fill), outline(capsule(P(...kn), P(...an), 0.042 * s), fill));
    parts.push(outline(roundPoly([P(sd * 0.03, 0.92), P(sd * 0.15, 0.92), P(sd * 0.15, 0.975), P(sd * 0.03, 0.975)].map((p) => p), 0.015 * s), dark));
    const [kx, ky] = P(...kn);
    parts.push(disc(kx, ky, 0.03 * s, '#FFFFFF', ink, Math.max(0.7, sw * 0.8)));
  }
  // bacino e torso
  parts.push(outline(roundPoly([P(-0.12, 0.46), P(0.12, 0.46), P(0.12, 0.55), P(-0.12, 0.55)], 0.02 * s), dark));
  parts.push(outline(roundPoly([P(-0.17, 0.2), P(0.17, 0.2), P(0.12, 0.47), P(-0.12, 0.47)], 0.04 * s), fill));
  parts.push(outline(roundPoly([P(-0.07, 0.26), P(0.07, 0.26), P(0.07, 0.36), P(-0.07, 0.36)], 0.015 * s), tint(ink, 0.82)));
  // braccia
  for (const [sh, el, wr] of arms) {
    parts.push(outline(capsule(P(...sh), P(...el), 0.036 * s), fill), outline(capsule(P(...el), P(...wr), 0.031 * s), fill));
    const [ex, ey] = P(...el), [hx, hy] = P(...wr), [sx, sy] = P(...sh);
    parts.push(disc(ex, ey, 0.026 * s, '#FFFFFF', ink, Math.max(0.7, sw * 0.8)), disc(hx, hy, 0.034 * s, dark, ink, Math.max(0.7, sw * 0.8)));
    parts.push(disc(sx, sy, 0.042 * s, dark, ink, Math.max(0.7, sw * 0.8)));
  }
  // collo e testa con visiera
  parts.push(outline(roundPoly([P(-0.03, 0.16), P(0.03, 0.16), P(0.03, 0.21), P(-0.03, 0.21)], 0.008 * s), dark));
  parts.push(outline(roundPoly([P(-0.075, 0.02), P(0.075, 0.02), P(0.075, 0.17), P(-0.075, 0.17)], 0.05 * s), fill));
  parts.push(area(roundPoly([P(-0.055, 0.065), P(0.055, 0.065), P(0.055, 0.11), P(-0.055, 0.11)], 0.02 * s), DARK));
  const [vx, vy] = P(0.025, 0.08);
  parts.push(disc(vx, vy, 0.008 * s, '#9CC3F0'));
  return parts;
}

// ======================================================================
// Drone quadrirotore (prospettiva o vista dall'alto)
// ======================================================================

function droneShape(n: N): Part[] {
  const fill = fillOf(n, '#E5E7EB'), ink = inkOf(n);
  const sw = n.strokeWidth;
  const thrust = has(n.spec, 'thrust');
  const rotorC = tint(fill, 0.45);
  const parts: Part[] = [];
  if (has(n.spec, 'top')) {
    const { s, P } = fit(n, 0, 0, 1, 1);
    const M: P2[] = [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]];
    M.forEach((m) => parts.push(outline(capsule(P(0.5, 0.5), P(...m), 0.035 * s), mix(fill, ink, 0.2))));
    M.forEach((m, i) => {
      const [cx, cy] = P(...m);
      parts.push({ kind: 'ellipse', cx, cy, rx: 0.19 * s, ry: 0.19 * s, fill: rotorC, sw: Math.max(0.7, sw * 0.8) });
      const a = (i % 3 ? 35 : -35) * DEG;
      const b = dir(a);
      parts.push(line(seg([cx - b[0] * 0.16 * s, cy - b[1] * 0.16 * s], [cx + b[0] * 0.16 * s, cy + b[1] * 0.16 * s]), METAL, Math.max(1.4, 0.035 * s)));
      parts.push(disc(cx, cy, 0.045 * s, DARK));
    });
    parts.push(outline(roundPoly([P(0.38, 0.36), P(0.62, 0.36), P(0.62, 0.64), P(0.38, 0.64)], 0.06 * s), fill));
    parts.push(area(poly([P(0.5, 0.39), P(0.56, 0.47), P(0.44, 0.47)]), STOP));
    return parts;
  }
  const top = thrust ? -0.16 : 0.12;
  const { s, P } = fit(n, 0, top, 1, 0.62);
  const rotors: { m: P2; front: boolean }[] = [
    { m: [0.3, 0.3], front: false },
    { m: [0.7, 0.3], front: false },
    { m: [0.15, 0.46], front: true },
    { m: [0.85, 0.46], front: true },
  ];
  const C: P2 = [0.5, 0.4];
  // bracci e motori sotto il corpo, poi i dischi dei rotori (prima i posteriori)
  for (const r of rotors) {
    const [mx, my] = P(...r.m);
    parts.push(outline(capsule(P(...C), P(...r.m), 0.026 * s), mix(fill, ink, 0.2)));
    parts.push(outline(roundPoly([[mx - 0.03 * s, my - 0.045 * s], [mx + 0.03 * s, my - 0.045 * s], [mx + 0.03 * s, my + 0.01 * s], [mx - 0.03 * s, my + 0.01 * s]], 0.01 * s), DARK));
  }
  const rotor = (r: (typeof rotors)[number], i: number) => {
    const [mx, my] = P(...r.m);
    const ry = my - 0.05 * s;
    const out: Part[] = [{ kind: 'ellipse', cx: mx, cy: ry, rx: 0.14 * s, ry: 0.045 * s, fill: rotorC, sw: Math.max(0.7, sw * 0.8) }];
    const b = (i % 3 ? 1 : -1) * 0.12 * s;
    out.push(line(seg([mx - b, ry + 0.012 * s * Math.sign(b)], [mx + b, ry - 0.012 * s * Math.sign(b)]), METAL, Math.max(1.3, 0.022 * s)));
    out.push(disc(mx, ry, 0.016 * s, DARK));
    if (thrust) {
      const hs = clamp(s * 0.05, 3.5, 6);
      const tip = ry - 0.2 * s;
      out.push(...arrow([mx, ry - 0.05 * s], [mx, tip], AX_Z, Math.max(1, sw), hs));
      out.push(text(mx + (r.m[0] < 0.5 ? -1 : 1) * 0.02 * s, tip - 0.05 * s, `$f_${i + 1}$`, clamp(s * 0.075, 8, 12), r.m[0] < 0.5 ? 'end' : 'start', AX_Z));
    }
    return out;
  };
  rotors.forEach((r, i) => !r.front && parts.push(...rotor(r, i)));
  // corpo: guscio con faccia superiore chiara, gimbal della camera e carrello
  parts.push(line([...seg(P(0.44, 0.44), P(0.4, 0.57)), ...seg(P(0.56, 0.44), P(0.6, 0.57)), ...seg(P(0.35, 0.57), P(0.45, 0.57)), ...seg(P(0.55, 0.57), P(0.65, 0.57))], DARK, Math.max(1, sw)));
  parts.push(outline(roundPoly([P(0.39, 0.34), P(0.61, 0.34), P(0.63, 0.45), P(0.37, 0.45)], 0.03 * s), fill));
  parts.push(area(roundPoly([P(0.41, 0.35), P(0.59, 0.35), P(0.6, 0.39), P(0.4, 0.39)], 0.015 * s), tint(fill, 0.6)));
  const [gx, gy] = P(0.5, 0.48);
  parts.push(disc(gx, gy, 0.035 * s, DARK), disc(gx + 0.008 * s, gy - 0.004 * s, 0.012 * s, '#7FA7D9'));
  rotors.forEach((r, i) => r.front && parts.push(...rotor(r, i)));
  return parts;
}

// ======================================================================
// Terna di riferimento (3D obliqua o 2D)
// ======================================================================

function frameShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const m = /sub([a-z0-9]+)/i.exec(n.spec);
  const sub = m ? `_{${m[1]}}` : '';
  const mono = has(n.spec, 'mono');
  const named = !has(n.spec, 'nolabels');
  const ink = inkOf(n);
  const col = (c: string) => (mono ? ink : c);
  const sw = Math.max(1.1, n.strokeWidth * 1.15);
  const fs = clamp(Math.min(w, h) * 0.2, 9, 14);
  const hs = clamp(Math.min(w, h) * 0.1, 4, 7);
  const pad = named ? fs * 0.9 : 2;
  const parts: Part[] = [];
  if (has(n.spec, '2d')) {
    const O: P2 = [x + pad * 0.6, y + h - pad * 0.7];
    const X: P2 = [x + w - pad, O[1]], Y: P2 = [O[0], y + pad];
    parts.push(...arrow(O, X, col(AX_X), sw, hs), ...arrow(O, Y, col(AX_Y), sw, hs), disc(O[0], O[1], sw * 1.3, DARK));
    if (named) parts.push(text(X[0] + fs * 0.55, X[1], `$x${sub}$`, fs, 'middle', col(AX_X)), text(Y[0], Y[1] - fs * 0.55, `$y${sub}$`, fs, 'middle', col(AX_Y)));
    return parts;
  }
  const O: P2 = [x + w * 0.42, y + h * 0.6];
  const Z: P2 = [O[0], y + pad];
  const Y: P2 = [x + w - pad, O[1]];
  const L = Math.min(O[0] - x - pad * 0.5, (y + h - pad * 0.8 - O[1]) / Math.sin(35 * DEG) * 0.95);
  const X: P2 = add(O, dir(145 * DEG), L);
  parts.push(...arrow(O, X, col(AX_X), sw, hs), ...arrow(O, Y, col(AX_Y), sw, hs), ...arrow(O, Z, col(AX_Z), sw, hs), disc(O[0], O[1], sw * 1.3, DARK));
  if (named) {
    parts.push(text(X[0] - fs * 0.35, X[1] + fs * 0.45, `$x${sub}$`, fs, 'middle', col(AX_X)));
    parts.push(text(Y[0] + fs * 0.55, Y[1], `$y${sub}$`, fs, 'middle', col(AX_Y)));
    parts.push(text(Z[0], Z[1] - fs * 0.55, `$z${sub}$`, fs, 'middle', col(AX_Z)));
  }
  return parts;
}

// ======================================================================
// Scansione lidar in una stanza
// ======================================================================

function raycast(o: P2, d: P2, segs: [P2, P2][], circles: [P2, number][]): number {
  let best = Infinity;
  for (const [a, b] of segs) {
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den;
    const u = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den;
    if (t > 1e-6 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  for (const [c, r] of circles) {
    const fx = o[0] - c[0], fy = o[1] - c[1];
    const b = fx * d[0] + fy * d[1], q = fx * fx + fy * fy - r * r;
    const disc2 = b * b - q;
    if (disc2 < 0) continue;
    const t = -b - Math.sqrt(disc2);
    if (t > 1e-6) best = Math.min(best, t);
  }
  return best;
}

function lidarShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const ink = inkOf(n, STOP);
  const U = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const room = [U(0.03, 0.05), U(0.64, 0.05), U(0.64, 0.2), U(0.97, 0.2), U(0.97, 0.95), U(0.3, 0.95), U(0.3, 0.8), U(0.03, 0.8)];
  const box = [U(0.68, 0.58), U(0.82, 0.58), U(0.82, 0.74), U(0.68, 0.74)];
  const segs: [P2, P2][] = [];
  [room, box].forEach((pg) => pg.forEach((p, i) => segs.push([p, pg[(i + 1) % pg.length]])));
  const pillar: [P2, number] = [U(0.2, 0.3), Math.min(w, h) * 0.07];
  const o = U(0.45, 0.52);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill: n.fill, stroke: '#C9CED6', sw: 1 });
  if (!has(n.spec, 'nowalls')) {
    parts.push(area(poly(room), 'none', OBST, 1.4), area(poly(box), tint(OBST, 0.4), OBST, 1));
    parts.push(disc(pillar[0][0], pillar[0][1], pillar[1], tint(OBST, 0.4), OBST, 1));
  }
  const K = clamp(Math.round(n.count), 6, 180);
  const rays: Cmd[] = [];
  const hits: P2[] = [];
  for (let k = 0; k < K; k++) {
    const d = dir((TAU * k) / K + 0.13);
    const t = raycast(o, d, segs, [pillar]);
    if (!Number.isFinite(t)) continue;
    const p = add(o, d, t);
    rays.push(...seg(o, p));
    hits.push(p);
  }
  if (!has(n.spec, 'norays')) parts.push(line(rays, tint(ink, 0.55), 0.6));
  const r = clamp(Math.min(w, h) * 0.014, 1.1, 2.2);
  hits.forEach(([hx, hy]) => parts.push(disc(hx, hy, r, ink)));
  // robot al centro della scansione
  const R = Math.min(w, h) * 0.06;
  parts.push(disc(o[0], o[1], R, '#DAE8FC', '#4A6FA5', 1), area(poly([[o[0] + R * 0.75, o[1]], [o[0] - R * 0.25, o[1] - R * 0.45], [o[0] - R * 0.25, o[1] + R * 0.45]]), '#4A6FA5'));
  return parts;
}

// ======================================================================
// Mappa a occupazione (con percorso pianificato)
// ======================================================================

interface OccMap {
  C: number;
  R: number;
  occ: boolean[][];
  unknown: boolean[][];
  start: P2;
  goal: P2;
}

function occMap(spec: string): OccMap {
  const m = /(\d+)\s*[x×]\s*(\d+)/i.exec(spec);
  const C = clamp(m ? +m[1] : 16, 8, 40), R = clamp(m ? +m[2] : 12, 6, 30);
  const occ = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => r === 0 || c === 0 || r === R - 1 || c === C - 1));
  const set = (r: number, c: number, v = true) => r > 0 && c > 0 && r < R - 1 && c < C - 1 && (occ[r][c] = v);
  const vc = Math.floor(C * 0.42), vEnd = Math.floor(R * 0.62), door = Math.floor(R * 0.22);
  for (let r = 1; r <= vEnd; r++) if (r < door || r > door + 1) set(r, vc);
  const hr = Math.floor(R * 0.58), hDoor = Math.floor(C * 0.8);
  for (let c = Math.floor(C * 0.62); c < C - 1; c++) if (c < hDoor || c > hDoor + 1) set(hr, c);
  const br = Math.floor(R * 0.74), bc = Math.floor(C * 0.16);
  set(br, bc), set(br, bc + 1), set(br + 1, bc), set(br + 1, bc + 1);
  const tr = Math.floor(R * 0.3), tc = Math.floor(C * 0.66);
  set(tr, tc), set(tr, tc + 1), set(tr + 1, tc);
  set(Math.floor(R * 0.25), Math.floor(C * 0.2));
  const start: P2 = [2, R - 3], goal: P2 = [C - 3, 2];
  set(start[1], start[0], false), set(goal[1], goal[0], false);
  const rand = rng(C * 31 + R);
  const unknown = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => c / C + (1 - r / R) * 0.55 + rand() * 0.08 > 1.18));
  return { C, R, occ, unknown, start, goal };
}

/** Ricerca in ampiezza su griglia a 8 vicini (senza tagliare gli angoli). */
function gridPath(M: OccMap): P2[] {
  const { C, R, occ } = M;
  const key = (c: number, r: number) => r * C + c;
  const prev = new Map<number, number>();
  const q: P2[] = [M.start];
  prev.set(key(...M.start), -1);
  const steps: P2[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (q.length) {
    const [c, r] = q.shift()!;
    if (c === M.goal[0] && r === M.goal[1]) break;
    for (const [dc, dr] of steps) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= C || nr >= R || occ[nr][nc] || prev.has(key(nc, nr))) continue;
      if (dc && dr && (occ[r][nc] || occ[nr][c])) continue;
      prev.set(key(nc, nr), key(c, r));
      q.push([nc, nr]);
    }
  }
  const path: P2[] = [];
  let k = prev.has(key(...M.goal)) ? key(...M.goal) : -1;
  while (k >= 0) {
    path.unshift([k % C, Math.floor(k / C)]);
    k = prev.get(k)!;
  }
  // tolti i punti allineati
  return path.filter((p, i) => i === 0 || i === path.length - 1 || (p[0] - path[i - 1][0]) !== (path[i + 1][0] - p[0]) || (p[1] - path[i - 1][1]) !== (path[i + 1][1] - p[1]));
}

function occgridShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const M = occMap(n.spec);
  const cw = w / M.C, ch = h / M.R;
  const prob = has(n.spec, 'prob'), unk = has(n.spec, 'unknown');
  const rand = rng(M.C * 7 + M.R * 13);
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: 0, fill: '#FFFFFF', stroke: 'none' }];
  for (let r = 0; r < M.R; r++)
    for (let c = 0; c < M.C; c++) {
      let col: string | null = null;
      if (unk && M.unknown[r][c] && !M.occ[r][c]) col = '#C9CDD3';
      else if (M.occ[r][c]) col = prob ? mix('#2E3238', '#FFFFFF', rand() * 0.35) : '#2E3238';
      else if (prob) {
        const near = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([a, b]) => M.occ[r + a]?.[c + b]);
        if (near) col = mix('#2E3238', '#FFFFFF', 0.72 + rand() * 0.18);
      }
      if (col) parts.push({ kind: 'rect', x: x + c * cw, y: y + r * ch, w: cw + 0.3, h: ch + 0.3, r: 0, fill: col, stroke: 'none' });
    }
  const gl: Cmd[] = [];
  for (let c = 1; c < M.C; c++) gl.push(...seg([x + c * cw, y], [x + c * cw, y + h]));
  for (let r = 1; r < M.R; r++) gl.push(...seg([x, y + r * ch], [x + w, y + r * ch]));
  parts.push(line(gl, '#D5D9DF', 0.4));
  const C = (p: P2): P2 => [x + (p[0] + 0.5) * cw, y + (p[1] + 0.5) * ch];
  const rr = Math.min(cw, ch) * 0.42;
  if (has(n.spec, 'path')) {
    const path = gridPath(M);
    if (path.length > 1) parts.push(line(poly(path.map(C), false), AX_Z, Math.max(1.4, Math.min(cw, ch) * 0.22)));
    const g = C(M.goal);
    parts.push(disc(g[0], g[1], rr, STOP, '#FFFFFF', 0.8));
  }
  if (has(n.spec, 'path') || has(n.spec, 'robot')) {
    const s0 = C(M.start);
    parts.push(disc(s0[0], s0[1], rr * 1.1, GO, '#FFFFFF', 0.8));
    if (has(n.spec, 'robot')) parts.push(area(poly([[s0[0] + rr * 0.8, s0[1]], [s0[0] - rr * 0.35, s0[1] - rr * 0.55], [s0[0] - rr * 0.35, s0[1] + rr * 0.55]]), '#FFFFFF'));
  }
  parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
  return parts;
}

// ======================================================================
// Traiettoria con waypoint
// ======================================================================

/** Colore lungo il tempo (viola → rosso → giallo), come le azioni nelle figure di Diffusion Policy. */
function timeColor(t: number): string {
  return t < 0.5 ? mix('#3B0F70', '#DD4A68', t * 2) : mix('#DD4A68', '#F9B233', (t - 0.5) * 2);
}

function pathShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const K = clamp(Math.round(n.count), 2, 24);
  const ink = inkOf(n, AX_Z);
  const sw = Math.max(1.2, n.strokeWidth * 1.25);
  const rand = rng(17 + K * 5);
  const m = Math.min(w, h) * 0.1;
  const noise = has(n.spec, 'noise');
  const amp = has(n.spec, 'half') ? 0.5 : 1.3;
  const wp: P2[] = Array.from({ length: K }, (_, i) => {
    const u = i / (K - 1);
    const v = 0.5 + 0.34 * Math.sin(u * Math.PI * 1.6 + 0.9) * (K > 2 ? 1 : 0.4) + (rand() - 0.5) * (noise ? amp : 0.12);
    return [x + m + clamp(u + (noise ? (rand() - 0.5) * amp * 0.25 : 0), 0, 1) * (w - 2 * m), y + m + clamp(v, 0, 1) * (h - 2 * m)];
  });
  if (noise || has(n.spec, 'dots')) {
    // sequenza di azioni come punti colorati nel tempo (rumorosa o già denoised)
    const r = clamp(Math.min(w, h) * 0.04, 1.6, 3.2);
    const pts = noise ? wp : catmull(wp, 6).filter((_, i) => i % 2 === 0);
    return pts.map(([px, py], i) => disc(px, py, r, timeColor(i / Math.max(1, pts.length - 1)), '#FFFFFF', 0.4));
  }
  const pts = has(n.spec, 'linear') ? wp : catmull(wp, 18);
  const parts: Part[] = [];
  if (has(n.spec, 'obstacles')) {
    const rand2 = rng(91 + K);
    for (let i = 0; i < K - 1; i += 2) {
      const a = wp[i], b = wp[i + 1];
      const mid = lerp(a, b, 0.5);
      const side = mid[1] > y + h / 2 ? -1 : 1;
      const r = Math.min(w, h) * (0.09 + rand2() * 0.04);
      const c: P2 = [mid[0], mid[1] + side * (r + Math.min(w, h) * 0.12)];
      if (c[1] - r < y || c[1] + r > y + h) continue;
      parts.push(area(roundPoly([[c[0] - r, c[1] - r * 0.8], [c[0] + r, c[1] - r * 0.8], [c[0] + r, c[1] + r * 0.8], [c[0] - r, c[1] + r * 0.8]], r * 0.3), OBST, '#9AA0A6', 0.8));
    }
  }
  parts.push({ kind: 'path', cmds: poly(pts, false), fill: 'none', stroke: ink, sw });
  if (has(n.spec, 'heading')) {
    for (let i = 0; i < K - 1; i++) {
      const j = clamp(Math.round(((i + 0.5) / (K - 1)) * (pts.length - 1)), 0, pts.length - 2);
      const p = pts[j], q = pts[j + 1];
      parts.push(head(lerp(p, q, 0.5), q[0] - p[0], q[1] - p[1], clamp(Math.min(w, h) * 0.07, 4, 7), ink));
    }
  }
  const r = clamp(Math.min(w, h) * 0.035, 2.2, 4);
  const fs = clamp(Math.min(w, h) * 0.12, 8, 11);
  wp.forEach(([px, py], i) => {
    if (i === 0) parts.push(disc(px, py, r * 1.25, GO, '#FFFFFF', 0.8));
    else if (i === K - 1) parts.push(disc(px, py, r * 1.9, 'none', STOP, 1.2), disc(px, py, r * 0.9, STOP));
    else parts.push(disc(px, py, r, '#FFFFFF', ink, 1.1));
    if (has(n.spec, 'labels') && i > 0 && i < K - 1) parts.push(text(px, py - r - fs * 0.7, `$\\mathbf{w}_${i}$`, fs, 'middle', TEXT));
  });
  return parts;
}

// ======================================================================
// RRT nello spazio delle configurazioni
// ======================================================================

function rrtShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const ink = inkOf(n, AX_Z);
  const U = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const obst: [number, number, number, number][] = [[0.3, 0, 0.41, 0.6], [0.6, 0.4, 0.71, 1], [0.8, 0.54, 0.92, 0.66], [0.1, 0.24, 0.2, 0.36]];
  const rects = obst.map(([a, b, c, d]) => [x + a * w, y + b * h, x + c * w, y + d * h] as const);
  const inObs = (p: P2) => rects.some(([a, b, c, d]) => p[0] >= a - 2 && p[0] <= c + 2 && p[1] >= b - 2 && p[1] <= d + 2);
  const free = (a: P2, b: P2) => {
    const k = Math.max(2, Math.ceil(dist(a, b) / 2));
    for (let i = 0; i <= k; i++) if (inObs(lerp(a, b, i / k))) return false;
    return true;
  };
  const start = U(0.08, 0.88), goal = U(0.9, 0.12);
  const iters = clamp(Math.round(n.count), 10, 2000);
  const step = Math.min(w, h) * 0.085;
  const goalR = Math.min(w, h) * 0.07;
  const rand = rng(7 + iters);
  const nodes: P2[] = [start];
  const parent: number[] = [-1];
  let reached = -1;
  for (let i = 0; i < iters && reached < 0; i++) {
    const q: P2 = rand() < 0.08 ? goal : [x + rand() * w, y + rand() * h];
    let best = 0;
    nodes.forEach((p, j) => dist(p, q) < dist(nodes[best], q) && (best = j));
    const d = dist(nodes[best], q);
    if (d < 1e-6) continue;
    const nw = d <= step ? q : lerp(nodes[best], q, step / d);
    if (!free(nodes[best], nw)) continue;
    nodes.push(nw);
    parent.push(best);
    if (dist(nw, goal) <= goalR && free(nw, goal)) reached = nodes.length - 1;
  }
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, 4), fill: fillOf(n) }];
  rects.forEach(([a, b, c, d]) => parts.push(area(poly([[a, b], [c, b], [c, d], [a, d]]), OBST, '#9AA0A6', 0.8)));
  parts.push(disc(goal[0], goal[1], goalR, tint(STOP, 0.82), STOP, 0.8));
  const edges: Cmd[] = [];
  for (let j = 1; j < nodes.length; j++) edges.push(...seg(nodes[parent[j]], nodes[j]));
  parts.push(line(edges, tint(ink, 0.25), 0.7));
  const r = clamp(Math.min(w, h) * 0.009, 0.9, 1.6);
  nodes.slice(1).forEach(([px, py]) => parts.push(disc(px, py, r, ink)));
  if (reached >= 0 && !has(n.spec, 'nopath')) {
    const path: P2[] = [goal];
    for (let k = reached; k >= 0; k = parent[k]) path.push(nodes[k]);
    parts.push(line(poly(path, false), ACCENT, Math.max(1.6, n.strokeWidth * 1.5)));
  }
  const rs = clamp(Math.min(w, h) * 0.03, 2.5, 4.5);
  parts.push(disc(start[0], start[1], rs, GO, '#FFFFFF', 0.8), disc(goal[0], goal[1], rs, STOP, '#FFFFFF', 0.8));
  if (has(n.spec, 'labels')) {
    const fs = clamp(Math.min(w, h) * 0.075, 8, 12);
    parts.push(text(start[0] + rs + 3, start[1] + fs * 0.1, '$q_{\\mathrm{start}}$', fs, 'start', '#1F6B3F'));
    parts.push(text(goal[0], goal[1] + goalR + fs * 0.75, '$q_{\\mathrm{goal}}$', fs, 'middle', '#9B2C2C'));
    const [a, b, c] = rects[0];
    parts.push(text((a + c) / 2, b + (rects[0][3] - b) * 0.45, '$\\mathcal{C}_{\\mathrm{obs}}$', fs, 'middle', '#5B6470'));
  }
  if (n.stroke !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, 4), fill: 'none', stroke: '#9AA0A6', sw: 1 });
  return parts;
}

// ======================================================================
// Camera RGB-D (vista frontale) e camera con campo visivo
// ======================================================================

function cameraShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const fill = fillOf(n, '#D1D5DB'), ink = inkOf(n);
  const sw = n.strokeWidth;
  const lens = (cx: number, cy: number, r: number, glass: string): Part[] => [disc(cx, cy, r, '#1F2329', '#555B63', 0.8), disc(cx, cy, r * 0.62, glass), disc(cx - r * 0.25, cy - r * 0.25, r * 0.2, '#FFFFFF')];
  if (has(n.spec, 'side')) {
    const fov = has(n.spec, 'fov');
    const bw = fov ? w * 0.34 : w * 0.72, bh = h * (fov ? 0.36 : 0.62);
    const bx = x + (fov ? 0 : w * 0.02), by = y + (h - bh) / 2;
    const parts: Part[] = [];
    if (fov) {
      const ax = bx + bw * 1.18, ay = y + h / 2;
      parts.push(area(poly([[ax, ay], [x + w, y + h * 0.04], [x + w, y + h * 0.96]]), tint(AX_Z, 0.88), 'none'));
      parts.push(line([...dashes([[ax, ay], [x + w, y + h * 0.04]], 3, 2.4), ...dashes([[ax, ay], [x + w, y + h * 0.96]], 3, 2.4)], tint(AX_Z, 0.3), 0.9));
    }
    parts.push(outline(roundPoly([[bx, by], [bx + bw, by], [bx + bw, by + bh], [bx, by + bh]], Math.min(bw, bh) * 0.14), fill));
    parts.push(outline(roundPoly([[bx + bw * 0.12, by - bh * 0.18], [bx + bw * 0.42, by - bh * 0.18], [bx + bw * 0.42, by], [bx + bw * 0.12, by]], bh * 0.04), mix(fill, ink, 0.25)));
    const lx = bx + bw, lh = bh * 0.7;
    parts.push(outline(poly([[lx, by + (bh - lh) / 2], [lx + bw * 0.18, by + (bh - lh * 1.2) / 2], [lx + bw * 0.18, by + (bh + lh * 1.2) / 2], [lx, by + (bh + lh) / 2]]), DARK));
    return parts;
  }
  // barra RGB-D: proiettore IR, due camere IR, camera RGB
  const bh = h * 0.58, by = y + h * 0.04;
  const parts: Part[] = [
    area(poly([[x + w * 0.45, by + bh], [x + w * 0.55, by + bh], [x + w * 0.56, y + h * 0.84], [x + w * 0.44, y + h * 0.84]]), METAL, ink, sw * 0.8),
    area(roundPoly([[x + w * 0.3, y + h * 0.84], [x + w * 0.7, y + h * 0.84], [x + w * 0.7, y + h * 0.97], [x + w * 0.3, y + h * 0.97]], h * 0.04), mix(fill, ink, 0.35), ink, sw * 0.8),
    outline(roundPoly([[x, by], [x + w, by], [x + w, by + bh], [x, by + bh]], bh * 0.48), fill),
    area(roundPoly([[x + w * 0.05, by + bh * 0.18], [x + w * 0.95, by + bh * 0.18], [x + w * 0.95, by + bh * 0.82], [x + w * 0.05, by + bh * 0.82]], bh * 0.32), '#2B2F36'),
  ];
  const cy = by + bh / 2, r = bh * 0.22;
  const stereo = has(n.spec, 'stereo');
  if (stereo) parts.push(...lens(x + w * 0.2, cy, r, '#3B4A5C'), ...lens(x + w * 0.8, cy, r, '#3B4A5C'));
  else {
    parts.push(...lens(x + w * 0.16, cy, r * 0.85, '#3B3046'), ...lens(x + w * 0.62, cy, r * 0.85, '#3B3046'), ...lens(x + w * 0.82, cy, r, '#2F5D8A'));
    parts.push(disc(x + w * 0.38, cy, r * 0.62, '#5A2E35', '#555B63', 0.8), disc(x + w * 0.38, cy, r * 0.25, '#B5474F'));
  }
  return parts;
}

// ======================================================================
// Simboli dei giunti (schemi cinematici)
// ======================================================================

function jointShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['revolute', 'prismatic', 'fixed', 'spherical'] as const, 'revolute');
  const { x, y, w, h } = n;
  const fill = fillOf(n, '#DAE8FC'), ink = inkOf(n);
  const sw = n.strokeWidth;
  const m = Math.min(w, h);
  const cx = x + w / 2, cy = y + h / 2;
  const hs = clamp(m * 0.12, 3.5, 6);
  switch (kind) {
    case 'prismatic': {
      const parts: Part[] = [outline(roundPoly([[x + w * 0.42, cy - h * 0.1], [x + w * 0.98, cy - h * 0.1], [x + w * 0.98, cy + h * 0.1], [x + w * 0.42, cy + h * 0.1]], 1.5), fill)];
      parts.push(outline(roundPoly([[x + w * 0.02, cy - h * 0.2], [x + w * 0.56, cy - h * 0.2], [x + w * 0.56, cy + h * 0.2], [x + w * 0.02, cy + h * 0.2]], 2), '#FFFFFF'));
      parts.push(...arrow2([x + w * 0.6, y + h * 0.12], [x + w * 0.96, y + h * 0.12], ACCENT, Math.max(0.9, sw * 0.8), hs * 0.8));
      return parts;
    }
    case 'fixed': {
      const gy = y + h * 0.66;
      const hatch: Cmd[] = [];
      for (let k = 0; k < 7; k++) hatch.push(...seg([x + w * (0.12 + k * 0.12), gy], [x + w * (0.12 + k * 0.12) - h * 0.2, gy + h * 0.24]));
      const apex: P2 = [cx, y + h * 0.18];
      return [
        line([...seg([x + w * 0.04, gy], [x + w * 0.96, gy]), ...hatch], ink, Math.max(0.8, sw * 0.8)),
        outline(poly([apex, [cx + m * 0.32, gy], [cx - m * 0.32, gy]]), fill),
        disc(apex[0], apex[1], m * 0.11, '#FFFFFF', ink, sw),
        disc(apex[0], apex[1], m * 0.035, ink),
      ];
    }
    case 'spherical': {
      const r = m * 0.2;
      const b: P2 = [cx, cy - h * 0.06];
      return [
        outline(capsule(b, [x + w * 0.9, y + h * 0.1], m * 0.07), fill),
        outline(capsule([cx, y + h * 0.95], [cx, b[1] + r * 1.2], m * 0.08), fill),
        line(arc(b[0], b[1], r * 1.35, 20 * DEG, 160 * DEG), ink, Math.max(2, m * 0.08)),
        { kind: 'ellipse', cx: b[0], cy: b[1], rx: r, ry: r, fill: '#FFFFFF' },
        disc(b[0] - r * 0.3, b[1] - r * 0.3, r * 0.22, '#E5E7EB'),
      ];
    }
    default: {
      const r = m * 0.17;
      const pts = Array.from({ length: 13 }, (_, k) => add([cx, cy], dir((-160 + (130 * k) / 12) * DEG), m * 0.36));
      return [
        outline(capsule([x + w * 0.06, y + h * 0.82], [cx, cy], m * 0.075), fill),
        outline(capsule([cx, cy], [x + w * 0.94, y + h * 0.42], m * 0.075), fill),
        { kind: 'ellipse', cx, cy, rx: r, ry: r, fill: '#FFFFFF' },
        disc(cx, cy, m * 0.05, ink),
        line(poly(pts, false), ACCENT, Math.max(0.9, sw * 0.8)),
        head(pts[12], pts[12][0] - pts[11][0], pts[12][1] - pts[11][1], hs * 0.8, ACCENT),
      ];
    }
  }
}

// ======================================================================
// Grafici di controllo: risposta al gradino e orizzonte MPC
// ======================================================================

function stepValue(kind: string, zeta: number, t: number): number {
  if (t <= 0) return 0;
  if (kind === 'first') return 1 - Math.exp(-t * 0.42);
  if (zeta >= 1) {
    if (Math.abs(zeta - 1) < 1e-3) return 1 - Math.exp(-t) * (1 + t);
    const s = Math.sqrt(zeta * zeta - 1), p1 = -zeta + s, p2 = -zeta - s;
    return 1 - (p2 * Math.exp(p1 * t) - p1 * Math.exp(p2 * t)) / (p2 - p1);
  }
  const wd = Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * t) * (Math.cos(wd * t) + (zeta / wd) * Math.sin(wd * t));
}

const STEP_ZETA: Record<string, number> = { under: 0.3, tuned: 0.65, critical: 1, over: 2.2, first: 1, unstable: -0.04 };

function stepShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const kind = kindOf(n.spec, ['under', 'tuned', 'critical', 'over', 'first', 'unstable'] as const, 'under');
  const K = clamp(Math.round(n.count), 1, 3);
  const labels = has(n.spec, 'labels');
  const ink = inkOf(n, AX_Z);
  const sw = Math.max(1, n.strokeWidth * 1.1);
  const fs = clamp(Math.min(w, h) * 0.14, 8, 11);
  const parts: Part[] = [];
  const boxed = n.fill !== 'none';
  if (boxed) parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill: n.fill });
  const p = boxed ? clamp(Math.min(w, h) * 0.08, 3, 7) : 1;
  const x0 = x + p, x1 = x + w - p - (labels ? fs * 0.9 : 0), y0 = y + p, y1 = y + h - p;
  const hs = clamp(Math.min(w, h) * 0.07, 3, 4.5);
  parts.push(...arrow([x0, y1], [x1, y1], AXIS, 0.8, hs), ...arrow([x0 + 1.5, y1], [x0 + 1.5, y0], AXIS, 0.8, hs));
  if (labels) parts.push(text(x1 + 3, y1, '$t$', fs, 'start'), text(x0 + 5, y0 + fs * 0.45, '$y(t)$', fs, 'start'));
  const cx0 = x0 + 4, cx1 = x1 - hs - 2;
  const top = y0 + hs + (labels ? fs * 0.6 : 2);
  const Y = (v: number) => y1 - (v / 1.5) * (y1 - top);
  const X = (u: number) => cx0 + u * (cx1 - cx0);
  const u0 = 0.06, k = 20;
  if (has(n.spec, 'band')) parts.push({ kind: 'rect', x: X(u0), y: Y(1.05), w: X(1) - X(u0), h: Y(0.95) - Y(1.05), r: 0, fill: tint(GO, 0.85), stroke: 'none' });
  parts.push(line(dashes([[X(0), Y(0)], [X(u0), Y(0)], [X(u0), Y(1)], [X(1), Y(1)]], 3, 2.2), AXIS, 0.9));
  const zetas = K === 1 ? [STEP_ZETA[kind]] : [0.3, 0.7, 1.6].slice(0, K);
  const cols = K === 1 ? [ink] : [ink, ACCENT, GO];
  zetas.forEach((z, i) => {
    const pts = Array.from({ length: 161 }, (_, j): P2 => {
      const u = j / 160;
      return [X(u), Y(clamp(stepValue(K === 1 ? kind : 'second', z, (u - u0) * k), -0.05, 1.45))];
    });
    parts.push(line(poly(pts, false), cols[i], sw));
  });
  if (has(n.spec, 'annot') && K === 1 && kind !== 'first' && STEP_ZETA[kind] < 1 && STEP_ZETA[kind] > 0) {
    const z = STEP_ZETA[kind];
    const tp = Math.PI / Math.sqrt(1 - z * z);
    const up = u0 + tp / k, peak = stepValue(kind, z, tp);
    parts.push(...arrow2([X(up), Y(1)], [X(up), Y(peak)], TEXT, 0.8, 3.2));
    parts.push(text(X(up) + 6, Y(peak) - fs * 0.2, '$M_p$', fs * 0.95, 'start'));
    let ts = 1;
    for (let j = 1600; j >= 0; j--) {
      const u = j / 1600;
      if (Math.abs(stepValue(kind, z, (u - u0) * k) - 1) > 0.05) {
        ts = u;
        break;
      }
    }
    parts.push(line(dashes([[X(ts), Y(1.0)], [X(ts), y1]], 2, 2), TEXT, 0.7));
    parts.push(text(X(ts) + 3, y1 - fs * 0.6, '$t_s$', fs * 0.95, 'start'));
  }
  return parts;
}

function horizonShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const labels = has(n.spec, 'labels');
  const ink = inkOf(n, DARK);
  const pred = AX_Z, inp = ACCENT;
  const fs = clamp(Math.min(w, h) * 0.075, 8, 11);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, 6), fill: n.fill });
  const xl = x + w * 0.03 + (labels ? fs * 0.9 : 0), xr = x + w * 0.97 - (labels ? fs * 0.9 : 0);
  const X = (u: number) => xl + u * (xr - xl);
  const uk = 0.42, Np = 0.5, Nc = 0.25, dt = 0.05;
  const yT = y + h * (labels ? 0.14 : 0.06), yB = y + h * 0.5;
  const yT2 = y + h * 0.56, yB2 = y + h * (labels ? 0.7 : 0.86);
  const Y1 = (v: number) => yB - v * (yB - yT), Y2 = (v: number) => yB2 - v * (yB2 - yT2);
  const sw = Math.max(1, n.strokeWidth);
  const yPast = (u: number) => (u < 0.12 ? 0.25 : 0.25 + 0.5 * (1 - Math.exp(-(u - 0.12) * 6)));
  const yk = yPast(uk);
  const yPred = (u: number) => 0.82 - (0.82 - yk) * Math.exp(-(u - uk) * 8);
  // riferimento, uscita passata (misurata), uscita predetta
  parts.push(line(dashes([[X(0), Y1(0.25)], [X(0.12), Y1(0.25)], [X(0.12), Y1(0.82)], [X(1), Y1(0.82)]], 4, 2.6), AXIS, 1));
  parts.push(line(poly(Array.from({ length: 61 }, (_, i): P2 => [X((uk * i) / 60), Y1(yPast((uk * i) / 60))]), false), ink, sw));
  const fut = Array.from({ length: 41 }, (_, i): P2 => [X(uk + (Np * i) / 40), Y1(yPred(uk + (Np * i) / 40))]);
  parts.push(line(dashes(fut, 3.5, 2.2), pred, sw));
  const r = clamp(Math.min(w, h) * 0.014, 1.3, 2.2);
  for (let u = uk - 6 * dt; u <= uk + 1e-6; u += dt) parts.push(disc(X(u), Y1(yPast(u)), r, ink));
  for (let u = uk + dt; u <= uk + Np + 1e-6; u += dt) parts.push(disc(X(u), Y1(yPred(u)), r, '#FFFFFF', pred, 0.9));
  // ingressi: passati (a gradini) e sequenza ottima sull'orizzonte di controllo
  const uPast = (u: number) => (u < 0.12 ? 0.15 : 0.2 + 0.75 * Math.exp(-(u - 0.12) * 3));
  const st: P2[] = [];
  for (let u = 0; u < uk - 1e-6; u += dt) st.push([X(u), Y2(uPast(u))], [X(u + dt), Y2(uPast(u))]);
  parts.push(line(poly(st, false), ink, sw));
  const uf = (i: number) => 0.3 + 0.19 * Math.exp(-i * 0.55);
  const sf: P2[] = [];
  for (let i = 0; i < Math.round(Nc / dt); i++) sf.push([X(uk + i * dt), Y2(uf(i))], [X(uk + (i + 1) * dt), Y2(uf(i))]);
  parts.push(line(poly(sf, false), inp, sw * 1.2));
  const last = uf(Math.round(Nc / dt) - 1);
  parts.push(line(dashes([[X(uk + Nc), Y2(last)], [X(uk + Np), Y2(last)]], 3, 2.2), inp, sw));
  // asse dei tempi, istante k, orizzonti
  const hs = clamp(Math.min(w, h) * 0.04, 3, 4.5);
  parts.push(...arrow([X(0), yB2 + 3], [X(1) + 6, yB2 + 3], AXIS, 0.8, hs));
  parts.push(line(seg([X(uk), y + h * (labels ? 0.06 : 0.02)], [X(uk), yB2 + 3]), ink, 0.9));
  const tick: Cmd[] = [];
  for (const u of [uk + Nc, uk + Np]) tick.push(...seg([X(u), yB2], [X(u), yB2 + 6]));
  parts.push(line(tick, AXIS, 0.8));
  if (labels) {
    const ty = y + h * 0.06;
    parts.push(text(X(uk) - 5, ty, 'Past', fs, 'end'), text(X(uk) + 5, ty, 'Future', fs, 'start'));
    const tky = yB2 + 3 + fs * 0.95;
    parts.push(text(X(uk), tky, '$k$', fs), text(X(uk + Nc), tky, '$k+N_c$', fs), text(X(uk + Np), tky, '$k+N_p$', fs));
    const hy = y + h * 0.95;
    parts.push(...arrow2([X(uk), hy], [X(uk + Np), hy], TEXT, 0.8, 3.4));
    parts.push(text(X(uk + Np / 2), hy - fs * 0.62, 'prediction horizon', fs * 0.92, 'middle'));
    const ex = X(1) + 3;
    parts.push(text(ex, Y1(0.82) - fs * 0.5, '$r$', fs, 'start', TEXT), text(ex, Y1(yPred(uk + Np)) + fs * 0.55, '$\\hat{y}$', fs, 'start', pred));
    parts.push(text(X(0.27), Y1(yPast(0.27)) + fs * 0.7, '$y$', fs, 'start', ink), text(ex, Y2(last), '$u$', fs, 'start', inp));
  }
  return parts;
}

// ======================================================================
// Scena di manipolazione (immagine della camera): reale, randomizzata, Push-T
// ======================================================================

const OBJ_COLORS = ['#D64545', '#2F6FB2', '#F2B134', '#3A9A4A', '#8E5BB5', '#E07B39'];

function hsl(h: number, s: number, l: number): string {
  const f = (k: number) => {
    const a = s * Math.min(l, 1 - l);
    const t = (k + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(t - 3, 9 - t, 1))));
  };
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function sceneObject(kind: number, cx: number, cy: number, s: number, col: string): Part[] {
  const dk = shade(col, -0.28), lt = shade(col, 0.25);
  const st = { stroke: shade(col, -0.45), sw: 0.5 };
  switch (kind % 4) {
    case 0: {
      // cubo: faccia frontale, superiore e laterale
      const a = s * 0.5, d = s * 0.22;
      return [
        { kind: 'path', cmds: poly([[cx - a, cy - a], [cx + a, cy - a], [cx + a, cy + a * 0.6], [cx - a, cy + a * 0.6]]), fill: col, ...st, solid: true },
        { kind: 'path', cmds: poly([[cx - a, cy - a], [cx - a + d, cy - a - d], [cx + a + d, cy - a - d], [cx + a, cy - a]]), fill: lt, ...st, solid: true },
        { kind: 'path', cmds: poly([[cx + a, cy - a], [cx + a + d, cy - a - d], [cx + a + d, cy + a * 0.6 - d], [cx + a, cy + a * 0.6]]), fill: dk, ...st, solid: true },
      ];
    }
    case 1: {
      const rx = s * 0.4, ry = s * 0.14, hh = s * 0.75;
      return [
        { kind: 'rect', x: cx - rx, y: cy - hh / 2, w: rx * 2, h: hh, r: 0, fill: col, stroke: 'none' },
        { kind: 'ellipse', cx, cy: cy + hh / 2, rx, ry, fill: col, ...st, solid: true },
        { kind: 'rect', x: cx - rx, y: cy - hh / 2, w: rx * 2, h: hh, r: 0, fill: col, stroke: 'none' },
        { kind: 'path', cmds: [...seg([cx - rx, cy - hh / 2], [cx - rx, cy + hh / 2]), ...seg([cx + rx, cy - hh / 2], [cx + rx, cy + hh / 2])], fill: 'none', ...st, solid: true },
        { kind: 'ellipse', cx, cy: cy - hh / 2, rx, ry, fill: lt, ...st, solid: true },
      ];
    }
    case 2:
      return [
        { kind: 'ellipse', cx, cy, rx: s * 0.42, ry: s * 0.42, fill: col, ...st, solid: true },
        { kind: 'ellipse', cx: cx - s * 0.14, cy: cy - s * 0.15, rx: s * 0.12, ry: s * 0.1, fill: lt, stroke: 'none' },
      ];
    default:
      return [
        { kind: 'path', cmds: poly([[cx, cy - s * 0.55], [cx - s * 0.48, cy + s * 0.4], [cx + s * 0.05, cy + s * 0.5]]), fill: col, ...st, solid: true },
        { kind: 'path', cmds: poly([[cx, cy - s * 0.55], [cx + s * 0.05, cy + s * 0.5], [cx + s * 0.45, cy + s * 0.32]]), fill: dk, ...st, solid: true },
      ];
  }
}

function scenePaint(n: N, b: Box, rand: Rand): Part[] {
  const kind = kindOf(n.spec, ['real', 'random', 'pusht'] as const, 'real');
  const P = (u: number, v: number): P2 => [b.x + u * b.w, b.y + v * b.h];
  const m = Math.min(b.w, b.h);
  if (kind === 'pusht') {
    // Push-T (Chi et al.): vista dall'alto, blocco a T da spingere sulla sagoma verde
    const T = (cx: number, cy: number, a: number, s: number): P2[] => {
      const pts: P2[] = [[-0.5, -0.5], [0.5, -0.5], [0.5, -0.25], [0.125, -0.25], [0.125, 0.5], [-0.125, 0.5], [-0.125, -0.25], [-0.5, -0.25]];
      return pts.map(([u, v]) => [cx + (u * Math.cos(a) - v * Math.sin(a)) * s, cy + (u * Math.sin(a) + v * Math.cos(a)) * s]);
    };
    const ang = (rand() - 0.5) * 1.6;
    const parts: Part[] = [
      { kind: 'rect', x: b.x, y: b.y, w: b.w, h: b.h, r: 0, fill: '#EEF0F3' },
      { kind: 'path', cmds: poly(T(b.x + b.w * 0.5, b.y + b.h * 0.42, 0, m * 0.42)), fill: '#BFE3C6', stroke: '#5FB474', sw: 0.8, solid: true },
      { kind: 'path', cmds: poly(T(b.x + b.w * (0.32 + rand() * 0.1), b.y + b.h * (0.6 + rand() * 0.08), ang, m * 0.4)), fill: '#9AA9BD', stroke: '#5E6E84', sw: 0.8, solid: true },
    ];
    const [ex, ey] = P(0.7 + rand() * 0.1, 0.72);
    parts.push(disc(ex, ey, m * 0.06, '#4A7BD0', '#2D5BA8', 0.8));
    return parts;
  }
  const random = kind === 'random';
  const wall = random ? hsl(rand() * 360, 0.45 + rand() * 0.4, 0.45 + rand() * 0.3) : '#E4E1DA';
  const top = random ? hsl(rand() * 360, 0.3 + rand() * 0.5, 0.45 + rand() * 0.35) : '#CDA97B';
  const side = shade(top, -0.25);
  const parts: Part[] = [{ kind: 'rect', x: b.x, y: b.y, w: b.w, h: b.h, r: 0, fill: wall }];
  if (random && rand() < 0.6) {
    // tessitura casuale sullo sfondo
    const c2 = shade(wall, rand() < 0.5 ? -0.15 : 0.2);
    for (let k = 0; k < 6; k++) parts.push({ kind: 'rect', x: b.x + (k / 6) * b.w, y: b.y, w: b.w / 12, h: b.h * 0.45, r: 0, fill: c2, stroke: 'none' });
  }
  parts.push({ kind: 'path', cmds: poly([P(0.1, 0.4), P(0.9, 0.4), P(1.02, 0.86), P(-0.02, 0.86)]), fill: top, stroke: shade(top, -0.35), sw: 0.6, solid: true });
  parts.push({ kind: 'path', cmds: poly([P(-0.02, 0.86), P(1.02, 0.86), P(1.02, 1.02), P(-0.02, 1.02)]), fill: side, stroke: 'none' });
  if (random && rand() < 0.5) {
    const c3 = shade(top, 0.22);
    for (let k = 0; k < 5; k++) parts.push({ kind: 'path', cmds: poly([P(0.1 + k * 0.16, 0.4), P(0.18 + k * 0.16, 0.4), P(0.2 + k * 0.205, 0.86), P(0.1 + k * 0.205, 0.86)]), fill: c3, stroke: 'none' });
  }
  const slots: [number, number][] = [[0.28, 0.6], [0.5, 0.52], [0.72, 0.62], [0.42, 0.74], [0.64, 0.78]];
  const nObj = random ? 3 + Math.floor(rand() * 3) : 4;
  for (let i = 0; i < nObj; i++) {
    const [u, v] = slots[i];
    const col = random ? hsl(rand() * 360, 0.55 + rand() * 0.35, 0.4 + rand() * 0.25) : OBJ_COLORS[i];
    const [cx, cy] = P(u + (random ? (rand() - 0.5) * 0.06 : 0), v);
    parts.push(...sceneObject(random ? Math.floor(rand() * 4) : i, cx, cy, m * (0.13 + v * 0.06), col));
  }
  if (has(n.spec, 'gripper')) {
    const [gx] = P(0.5, 0);
    const gw = m * 0.12;
    parts.push({ kind: 'rect', x: gx - gw * 0.6, y: b.y - 2, w: gw * 1.2, h: b.h * 0.2, r: 1, fill: random ? hsl(rand() * 360, 0.3, 0.5) : '#4B5563', stroke: 'none' });
    parts.push({ kind: 'rect', x: gx - gw * 1.1, y: b.y + b.h * 0.18, w: gw * 2.2, h: b.h * 0.05, r: 1, fill: '#2E3238', stroke: 'none' });
    parts.push({ kind: 'rect', x: gx - gw * 1.05, y: b.y + b.h * 0.22, w: gw * 0.32, h: b.h * 0.12, r: 1, fill: '#2E3238', stroke: 'none' });
    parts.push({ kind: 'rect', x: gx + gw * 0.73, y: b.y + b.h * 0.22, w: gw * 0.32, h: b.h * 0.12, r: 1, fill: '#2E3238', stroke: 'none' });
  }
  return parts;
}

const sceneShape = (n: N): Part[] => framed(n, (b, rand) => scenePaint(n, b, rand));

// ======================================================================
// Piano immagine con feature correnti e desiderate (visual servoing)
// ======================================================================

function imgplaneShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, 4), fill: fillOf(n) }];
  const m = Math.min(w, h);
  const cx = x + w / 2, cy = y + h / 2;
  const sq: P2[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const des = sq.map(([u, v]): P2 => [cx + u * m * 0.2, cy + v * m * 0.2]);
  const a = 28 * DEG, k = 0.55;
  const cur = sq.map(([u, v]): P2 => [cx - w * 0.25 + (u * Math.cos(a) - v * Math.sin(a)) * m * 0.2 * k * 1.15, cy + h * 0.17 + (u * Math.sin(a) + v * Math.cos(a)) * m * 0.2 * k]);
  parts.push(line(dashes([...des, des[0]], 3, 2.2), GO, 0.9));
  parts.push(area(poly(cur), tint(STOP, 0.88), tint(STOP, 0.3), 0.8));
  if (has(n.spec, 'traj')) {
    cur.forEach((p, i) => {
      const q = des[i];
      const mid = lerp(p, q, 0.5);
      const bend: P2 = [mid[0] + (q[1] - p[1]) * 0.18, mid[1] - (q[0] - p[0]) * 0.18];
      const pts = Array.from({ length: 17 }, (_, j): P2 => {
        const t = j / 16;
        return [(1 - t) ** 2 * p[0] + 2 * t * (1 - t) * bend[0] + t * t * q[0], (1 - t) ** 2 * p[1] + 2 * t * (1 - t) * bend[1] + t * t * q[1]];
      });
      parts.push(line(dashes(pts.slice(0, 15), 2.2, 1.8), TEXT, 0.7), head(pts[14], pts[14][0] - pts[12][0], pts[14][1] - pts[12][1], 3.6, TEXT));
    });
  }
  const r = clamp(m * 0.035, 2, 3.6);
  des.forEach(([px, py]) => parts.push(disc(px, py, r * 1.1, '#FFFFFF', GO, 1.3)));
  cur.forEach(([px, py]) => parts.push(disc(px, py, r, STOP)));
  const fs = clamp(m * 0.11, 8, 12);
  if (has(n.spec, 'labels')) {
    parts.push(...arrow([x + 5, y + 5], [x + 5 + m * 0.18, y + 5], AXIS, 0.8, 3.5), ...arrow([x + 5, y + 5], [x + 5, y + 5 + m * 0.18], AXIS, 0.8, 3.5));
    parts.push(text(x + 8 + m * 0.18, y + 6, '$u$', fs * 0.9, 'start'), text(x + 6, y + 7 + m * 0.18 + fs * 0.4, '$v$', fs * 0.9, 'middle'));
    parts.push(text(des[1][0] + r + 2, des[1][1] - fs * 0.3, '$\\mathbf{s}^*$', fs, 'start', '#1F6B3F'));
    const lo = cur.reduce((p, q) => (q[1] > p[1] ? q : p));
    parts.push(text(lo[0], lo[1] + fs * 0.95, '$\\mathbf{s}$', fs, 'middle', '#9B2C2C'));
  }
  return parts;
}

// ======================================================================
// Grafo delle pose (pose-graph SLAM) con chiusure d'anello
// ======================================================================

function posegraphShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const K = clamp(Math.round(n.count), 5, 30);
  const fill = fillOf(n, '#DAE8FC'), ink = inkOf(n);
  const drift = has(n.spec, 'drift');
  const rand = rng(23 + K);
  const cx = x + w / 2, cy = y + h / 2;
  const rx = w * 0.36, ry = h * 0.34;
  const poses: P2[] = [];
  const heading: number[] = [];
  for (let i = 0; i < K; i++) {
    const t = 0.65 * Math.PI + (i / (K - 1)) * 1.78 * Math.PI;
    let px = cx + rx * Math.cos(t) + (rand() - 0.5) * w * 0.03, py = cy + ry * Math.sin(t) + (rand() - 0.5) * h * 0.03;
    if (drift) {
      const f = i / (K - 1);
      const g = 1 + f * 0.22;
      const rot = f * 0.32;
      const dx = (px - cx) * g, dy = (py - cy) * g;
      px = cx + dx * Math.cos(rot) - dy * Math.sin(rot) + f * w * 0.04;
      py = cy + dx * Math.sin(rot) + dy * Math.cos(rot) - f * h * 0.08;
    }
    poses.push([px, py]);
    heading.push(t + Math.PI / 2);
  }
  const parts: Part[] = [];
  const r = clamp(Math.min(w, h) * 0.045, 2.8, 6);
  const lm = has(n.spec, 'landmarks');
  if (lm) {
    const L: P2[] = [[cx - rx * 0.4, cy - ry * 0.15], [cx + rx * 0.35, cy + ry * 0.3], [cx + rx * 1.12, cy - ry * 0.75], [cx - rx * 0.15, cy - ry * 1.3]];
    const obs: Cmd[] = [];
    L.forEach((l) => {
      const near = poses.map((p, i) => [dist(p, l), i] as const).sort((a, b) => a[0] - b[0]).slice(0, 2);
      near.forEach(([, i]) => obs.push(...dashes([poses[i], l], 1.6, 1.6)));
    });
    parts.push(line(obs, GO, 0.7));
    L.forEach(([lx, ly]) => parts.push(area(poly([[lx, ly - r * 1.2], [lx + r * 1.1, ly], [lx, ly + r * 1.2], [lx - r * 1.1, ly]]), tint(GO, 0.55), GO, 0.9)));
  }
  const odo: Cmd[] = [];
  for (let i = 1; i < K; i++) odo.push(...seg(poses[i - 1], poses[i]));
  parts.push(line(odo, ink, Math.max(1, n.strokeWidth)));
  const loops: [number, number][] = [[K - 1, 0], [K - 2, 1]];
  if (K > 9) loops.push([Math.floor(K * 0.7), Math.floor(K * 0.2)]);
  const lc: Cmd[] = [];
  loops.forEach(([a, b]) => lc.push(...dashes([poses[a], poses[b]], 3, 2.2)));
  parts.push(line(lc, STOP, 1.1));
  poses.forEach(([px, py], i) => {
    parts.push(disc(px, py, r, i === 0 ? tint(GO, 0.5) : fill, ink, Math.max(0.8, n.strokeWidth * 0.9)));
    const d = dir(heading[i]);
    parts.push(line(seg([px, py], [px + d[0] * r * 0.85, py + d[1] * r * 0.85]), ink, 0.8));
  });
  if (has(n.spec, 'labels')) {
    const fs = clamp(Math.min(w, h) * 0.08, 8, 11);
    const lab = (i: number, t: string) => {
      const p = poses[i];
      const d: P2 = [p[0] - cx, p[1] - cy];
      const l = Math.hypot(...d) || 1;
      parts.push(text(p[0] + (d[0] / l) * (r + fs * 0.8), p[1] + (d[1] / l) * (r + fs * 0.7), t, fs, 'middle'));
    };
    lab(0, '$x_1$');
    lab(1, '$x_2$');
    lab(K - 1, `$x_{${K}}$`);
  }
  return parts;
}

// ---------------- varianti mostrate come pulsanti nel pannello ----------------

const c = (value: string, label: string) => ({ value, label });

const OPTIONS: Record<string, SpecGroup[]> = {
  'rob-arm': [
    { title: 'Posa', choices: [c('reach', 'Presa'), c('up', 'In alto'), c('fold', 'Raccolto'), c('down', 'In basso')] },
    { title: 'Utensile', choices: [c('parallel', 'Pinza'), c('suction', 'Ventosa'), c('notool', 'Nessuno')] },
    { title: 'Opzioni', mode: 'many', choices: [c('closed', 'Pinza chiusa'), c('frames', 'Frame dei giunti'), c('angles', 'Angoli θ'), c('mirror', 'Specchiato')] },
  ],
  'rob-gripper': [
    { title: 'Tipo', choices: [c('parallel', 'Pinza parallela'), c('suction', 'Ventosa')] },
    { title: 'Opzioni', mode: 'many', choices: [c('closed', 'Chiusa'), c('object', 'Con oggetto')] },
  ],
  'rob-mobile': [
    { title: 'Telaio', choices: [c('round', 'Rotondo'), c('rect', 'Rettangolare')] },
    { title: 'Opzioni', mode: 'many', choices: [c('frame', 'Frame del robot'), c('sensor', 'Lidar')] },
  ],
  'rob-quadruped': [
    { title: 'Andatura', choices: [c('stand', 'In piedi'), c('trot', 'Trotto')] },
    { title: 'Opzioni', mode: 'many', choices: [c('mirror', 'Specchiato'), c('noground', 'Senza suolo')] },
  ],
  'rob-humanoid': [
    { title: 'Posa', choices: [c('stand', 'In piedi'), c('wave', 'Saluto'), c('tpose', 'Braccia aperte')] },
    { title: 'Opzioni', mode: 'many', choices: [c('mirror', 'Specchiato')] },
  ],
  'rob-drone': [
    { title: 'Vista', choices: [c('persp', 'Prospettiva'), c('top', 'Dall\'alto')] },
    { title: 'Opzioni', mode: 'many', choices: [c('thrust', 'Spinte dei rotori')] },
  ],
  'rob-frame': [
    { title: 'Tipo', choices: [c('3d', '3D (x, y, z)'), c('2d', '2D (x, y)')] },
    { title: 'Pedice', choices: [c('sub0', '0'), c('sub1', '1'), c('subW', 'W'), c('subB', 'B'), c('subC', 'C'), c('subE', 'E')] },
    { title: 'Opzioni', mode: 'many', choices: [c('mono', 'Un colore'), c('nolabels', 'Senza nomi')] },
  ],
  'rob-lidar': [{ title: 'Opzioni', mode: 'many', choices: [c('norays', 'Solo punti'), c('nowalls', 'Senza pareti')] }],
  'rob-occgrid': [
    { title: 'Griglia', mode: 'value', choices: [c('16x12', '16×12'), c('24x18', '24×18'), c('32x24', '32×24'), c('16x12 path', 'Con percorso')] },
    { title: 'Opzioni', mode: 'many', choices: [c('path', 'Percorso A*'), c('robot', 'Robot'), c('unknown', 'Zone ignote'), c('prob', 'Probabilistica')] },
  ],
  'rob-path': [
    { title: 'Opzioni', mode: 'many', choices: [c('linear', 'Spezzata'), c('heading', 'Direzione'), c('obstacles', 'Ostacoli'), c('labels', 'Nomi waypoint')] },
    { title: 'Sequenza di azioni', mode: 'many', choices: [c('dots', 'Punti nel tempo'), c('noise', 'Rumorosa'), c('half', 'Rumore ridotto')] },
  ],
  'rob-rrt': [{ title: 'Opzioni', mode: 'many', choices: [c('labels', 'Start / goal'), c('nopath', 'Senza percorso')] }],
  'rob-camera': [
    { title: 'Tipo', choices: [c('rgbd', 'RGB-D'), c('stereo', 'Stereo'), c('side', 'Laterale')] },
    { title: 'Opzioni', mode: 'many', choices: [c('fov', 'Campo visivo')] },
  ],
  'rob-joint': [{ title: 'Giunto', choices: [c('revolute', 'Rotoidale'), c('prismatic', 'Prismatico'), c('spherical', 'Sferico'), c('fixed', 'Base fissa')] }],
  'rob-step': [
    { title: 'Risposta', choices: [c('under', 'Sottosmorzata'), c('tuned', 'Ben tarata'), c('critical', 'Critica'), c('over', 'Sovrasmorzata'), c('first', 'Primo ordine'), c('unstable', 'Instabile')] },
    { title: 'Opzioni', mode: 'many', choices: [c('band', 'Banda ±5%'), c('annot', 'Mp e ts'), c('labels', 'Nomi assi')] },
  ],
  'rob-horizon': [{ title: 'Opzioni', mode: 'many', choices: [c('labels', 'Etichette')] }],
  'rob-scene': [
    { title: 'Scena', choices: [c('real', 'Reale'), c('random', 'Randomizzata'), c('pusht', 'Push-T')] },
    { title: 'Opzioni', mode: 'many', choices: [c('gripper', 'Pinza')] },
  ],
  'rob-imgplane': [{ title: 'Opzioni', mode: 'many', choices: [c('traj', 'Traiettorie'), c('labels', 'Etichette')] }],
  'rob-posegraph': [{ title: 'Opzioni', mode: 'many', choices: [c('landmarks', 'Landmark'), c('drift', 'Deriva (prima)'), c('labels', 'Nomi pose')] }],
};

const DEFS: Omit<ShapeDef, 'specOptions'>[] = [
  { kind: 'rob-arm', name: 'Braccio robotico (catena)', parts: armShape, countLabel: 'Link', countMax: 6, specLabel: 'Variante' },
  { kind: 'rob-gripper', name: 'Pinza / ventosa', parts: gripperShape, specLabel: 'Variante', directionLabel: 'Verso' },
  { kind: 'rob-mobile', name: 'Robot mobile (dall\'alto)', parts: mobileShape, specLabel: 'Variante', directionLabel: 'Direzione' },
  { kind: 'rob-quadruped', name: 'Robot quadrupede', parts: quadrupedShape, specLabel: 'Variante' },
  { kind: 'rob-humanoid', name: 'Robot umanoide', parts: humanoidShape, specLabel: 'Variante' },
  { kind: 'rob-drone', name: 'Drone quadrirotore', parts: droneShape, specLabel: 'Variante' },
  { kind: 'rob-frame', name: 'Terna di riferimento', parts: frameShape, specLabel: 'Variante' },
  { kind: 'rob-lidar', name: 'Scansione lidar', parts: lidarShape, countLabel: 'Raggi', countMax: 180, specLabel: 'Variante' },
  { kind: 'rob-occgrid', name: 'Mappa a occupazione', parts: occgridShape, specLabel: 'Griglia e opzioni' },
  { kind: 'rob-path', name: 'Traiettoria con waypoint', parts: pathShape, countLabel: 'Waypoint', countMax: 24, specLabel: 'Variante' },
  { kind: 'rob-rrt', name: 'Albero RRT', parts: rrtShape, countLabel: 'Campioni', countMax: 2000, specLabel: 'Variante' },
  { kind: 'rob-camera', name: 'Camera (RGB-D)', parts: cameraShape, specLabel: 'Variante' },
  { kind: 'rob-joint', name: 'Giunto (simbolo)', parts: jointShape, specLabel: 'Giunto' },
  { kind: 'rob-step', name: 'Risposta al gradino', parts: stepShape, countLabel: 'Curve', countMax: 3, specLabel: 'Variante' },
  { kind: 'rob-horizon', name: 'Orizzonte MPC', parts: horizonShape, specLabel: 'Variante' },
  { kind: 'rob-scene', name: 'Scena di manipolazione', parts: sceneShape, countLabel: 'Variante', countMax: 99, specLabel: 'Variante' },
  { kind: 'rob-imgplane', name: 'Piano immagine (feature)', parts: imgplaneShape, specLabel: 'Variante' },
  { kind: 'rob-posegraph', name: 'Grafo delle pose', parts: posegraphShape, countLabel: 'Pose', countMax: 30, specLabel: 'Variante' },
];

export const ROBOTICS_SHAPES: ShapeDef[] = DEFS.map((d) => ({ ...d, specOptions: OPTIONS[d.kind] }));
