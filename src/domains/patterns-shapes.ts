// Forme del modulo pattern recognition & computer vision: grafici della teoria classica
// (Duda–Hart–Stork, Bishop) e illustrazioni delle figure di detection/segmentazione.
import { framed, mix, parseGrid, poly, rng, shade, type Box, type ClipRect, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';
import {
  INK, TAU,
  area, arrow, axes, boundsOf, clamp, cls, dashed, dashedCircle, dashedRect, densify, disc, has, hsv, isDark,
  line, marker, powerCells, rect, rotEllipse, seg, withClip,
  type P2,
} from './patterns-art';
import { LIMBS, PEOPLE, POSES, joints, limbColor, paintScene, personItems, sceneItems, solidItems, subjectOf, things } from './patterns-photo';

const frame = (n: NodeModel): Part => ({ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(n.radius, n.w / 2, n.h / 2), fill: n.fill });
const inkOf = (n: NodeModel) => (n.stroke === 'none' ? '#555555' : n.stroke);
const gauss = (t: number, mu: number, s: number) => Math.exp(-0.5 * ((t - mu) / s) ** 2) / s;

/** Variante autonoma: i vecchi pedoni e i derivati HOG/posa conservano la loro geometria. */
function schematicPedestrian(n: NodeModel): Part[] {
  const point = (u: number, v: number): P2 => [n.x + u * n.w, n.y + v * n.h];
  const polygon = (points: P2[], fill: string): Part => ({
    kind: 'path', cmds: poly(points.map(([u, v]) => point(u, v))), fill,
  });
  return [
    polygon([[0.4, 0.55], [0.58, 0.55], [0.6, 0.76], [0.67, 0.88], [0.58, 0.92], [0.47, 0.78]], '#5B6B80'),
    polygon([[0.44, 0.55], [0.61, 0.55], [0.54, 0.75], [0.49, 0.94], [0.34, 0.94], [0.41, 0.74]], '#5B6B80'),
    polygon([[0.37, 0.27], [0.29, 0.3], [0.22, 0.53], [0.29, 0.55], [0.39, 0.35]], n.fill),
    polygon([[0.6, 0.27], [0.69, 0.3], [0.76, 0.53], [0.69, 0.55], [0.59, 0.35]], n.fill),
    { kind: 'ellipse', cx: n.x + n.w * 0.255, cy: n.y + n.h * 0.55, rx: n.w * 0.04, ry: n.h * 0.035, fill: '#E9C7A0' },
    { kind: 'ellipse', cx: n.x + n.w * 0.725, cy: n.y + n.h * 0.55, rx: n.w * 0.04, ry: n.h * 0.035, fill: '#E9C7A0' },
    polygon([[0.38, 0.27], [0.48, 0.24], [0.61, 0.27], [0.64, 0.57], [0.37, 0.57]], n.fill),
    { kind: 'rect', x: n.x + n.w * 0.45, y: n.y + n.h * 0.2, w: n.w * 0.09, h: n.h * 0.1, r: n.w * 0.025, fill: '#E9C7A0' },
    { kind: 'ellipse', cx: n.x + n.w * 0.5, cy: n.y + n.h * 0.16, rx: n.w * 0.105, ry: n.h * 0.09, fill: '#E9C7A0' },
    polygon([[0.395, 0.15], [0.405, 0.085], [0.49, 0.06], [0.585, 0.085], [0.605, 0.15], [0.56, 0.12], [0.49, 0.1], [0.425, 0.12]], '#5B6B80'),
  ];
}

// ======================================================================
// Teoria della decisione
// ======================================================================

/** Densità condizionate p(x|ω_i)P(ω_i), soglie di decisione e regioni d'errore (DHS Fig. 2.17). */
function bayes(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const K = clamp(Math.round(n.count), 2, 4);
  const post = has(n.spec, 'post');
  const MU = [[0.36, 0.64], [0.24, 0.5, 0.76], [0.18, 0.39, 0.61, 0.82]][K - 2];
  const SG = [[0.1, 0.13], [0.085, 0.1, 0.09], [0.07, 0.075, 0.08, 0.07]][K - 2];
  const PR = [[0.56, 0.44], [0.36, 0.3, 0.34], [0.26, 0.24, 0.27, 0.23]][K - 2];
  const f = (k: number, t: number) => PR[k] * gauss(t, MU[k], SG[k]);
  const g = (k: number, t: number) => (post ? f(k, t) / MU.reduce((s, _, j) => s + f(j, t), 0) : f(k, t));
  const x0 = x + w * 0.09, x1 = x + w * 0.94, y0 = y + h * 0.1, y1 = y + h * 0.86;
  const N = 120;
  const ts = Array.from({ length: N + 1 }, (_, i) => 0.02 + (0.96 * i) / N);
  let top = 0;
  for (const t of ts) for (let k = 0; k < K; k++) top = Math.max(top, g(k, t));
  const X = (t: number) => x0 + (x1 - x0) * ((t - 0.02) / 0.96);
  const labels = h >= 40 && !has(n.spec, 'nolabel');
  const fs = clamp(h * 0.14, 7, 12);
  const Y = (v: number) => y1 - (y1 - y0) * (labels ? 0.8 : 0.94) * (v / top);
  const best = (t: number) => {
    let b = 0;
    for (let k = 1; k < K; k++) if (f(k, t) > f(b, t)) b = k;
    return b;
  };
  // soglie: dove cambia la classe vincente (bisezione)
  const cuts: number[] = [];
  for (let i = 0; i < N; i++) {
    let a = ts[i], c = ts[i + 1];
    const ka = best(a), kc = best(c);
    if (ka === kc) continue;
    for (let it = 0; it < 30; it++) {
      const m = (a + c) / 2;
      if (best(m) === ka) a = m;
      else c = m;
    }
    cuts.push((a + c) / 2);
  }
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push(frame(n));
  // regioni d'errore: area sotto p_k dove decide un'altra classe
  if (!post) {
    const bounds = [0.02, ...cuts, 0.98];
    for (let k = 0; k < K; k++) {
      for (let r = 0; r + 1 < bounds.length; r++) {
        const a = bounds[r], c = bounds[r + 1];
        if (best((a + c) / 2) === k) continue;
        const pts: P2[] = [[X(a), y1]];
        for (let i = 0; i <= 40; i++) {
          const t = a + ((c - a) * i) / 40;
          pts.push([X(t), Y(g(k, t))]);
        }
        pts.push([X(c), y1]);
        parts.push(area(poly(pts), mix(cls(k).fill, cls(k).tint, 0.15)));
      }
    }
  }
  parts.push(...axes(x0, y0, x1, y1));
  for (let k = 0; k < K; k++) parts.push(line(poly(ts.map((t): P2 => [X(t), Y(g(k, t))]), false), cls(k).stroke, Math.max(1.2, n.strokeWidth * 1.15)));
  for (const t of cuts) parts.push(line(dashed([X(t), y1], [X(t), y0 + h * 0.02], 3, 2.5), INK, 0.9));
  if (labels) {
    for (let k = 0; k < K; k++) {
      let tb = ts[0];
      for (const t of ts) if (g(k, t) > g(k, tb)) tb = t;
      const lx = clamp(X(tb), x0 + fs * 0.9, x1 - fs * 0.9);
      parts.push({ kind: 'text', x: lx, y: Y(g(k, tb)) - fs * 0.75, text: `$\\omega_${k + 1}$`, size: fs, fill: cls(k).stroke });
    }
  }
  return parts;
}

/** Spazio delle feature 2-D diviso in regioni di decisione, con campioni per classe (DHS Fig. 2.6, 5.3). */
function regions(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const K = clamp(Math.round(n.count), 2, 6);
  const linear = has(n.spec, 'linear');
  const SITES: number[][][] = [
    [[0.3, 0.38], [0.7, 0.62]],
    [[0.28, 0.3], [0.73, 0.33], [0.5, 0.75]],
    [[0.26, 0.28], [0.74, 0.26], [0.28, 0.74], [0.73, 0.72]],
    [[0.22, 0.27], [0.62, 0.2], [0.84, 0.62], [0.5, 0.8], [0.18, 0.7]],
    [[0.2, 0.24], [0.56, 0.17], [0.86, 0.38], [0.78, 0.8], [0.42, 0.82], [0.14, 0.62]],
  ];
  const b: Box = { x, y, w, h };
  const m = Math.min(w, h);
  const sites: P2[] = SITES[K - 2].map(([u, v]) => [x + u * w, y + v * h]);
  const rand = rng(K * 97 + 11);
  const weights = sites.map(() => (rand() - 0.5) * m * m * 0.04);
  const cells = powerCells(sites, weights, b);
  const warp = ([px, py]: P2): P2 => {
    if (linear) return [px, py];
    const u = (px - x) / w, v = (py - y) / h;
    const env = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
    return [px + w * 0.09 * env * Math.sin(TAU * 1.1 * v + 0.7), py + h * 0.09 * env * Math.sin(TAU * 1.05 * u + 1.9)];
  };
  const parts: Part[] = [];
  const outline: Cmd[] = [];
  cells.forEach((cell, k) => {
    if (cell.length < 3) return;
    const pts = (linear ? cell : densify(cell, m / 30)).map(warp);
    parts.push(area(poly(pts), cls(k).tint));
    outline.push(...poly(pts));
  });
  parts.push(line(outline, INK, 1));
  // campioni: dentro la propria cella (prima della deformazione), poi deformati
  const r = clamp(m * 0.026, 1.6, 3.6);
  const inside = (p: P2, k: number) =>
    p[0] > x + r * 2 && p[0] < x + w - r * 2 && p[1] > y + r * 2 && p[1] < y + h - r * 2 &&
    sites.every((q, j) => j === k || (p[0] - sites[k][0]) ** 2 + (p[1] - sites[k][1]) ** 2 - weights[k] < (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 - weights[j] - m * m * 0.004);
  const per = K <= 3 ? 7 : K <= 4 ? 6 : 5;
  // etichetta ω_k al centro della regione (se c'è spazio); i campioni le girano attorno
  const fs = clamp(m * 0.13, 7, 14);
  const labels = m >= 50 && !has(n.spec, 'nolabel');
  const rl = labels ? fs * 0.85 : 0;
  sites.forEach((s, k) => {
    let got = 0;
    for (let tries = 0; tries < 120 && got < per; tries++) {
      const a = rand() * TAU, d = rl + Math.sqrt(rand()) * (m * 0.19 - rl * 0.6);
      const p: P2 = [s[0] + Math.cos(a) * d * (w / m) ** 0.5, s[1] + Math.sin(a) * d * (h / m) ** 0.5];
      if (!inside(p, k)) continue;
      const q = warp(p), qs = warp(s);
      if (Math.hypot(q[0] - qs[0], q[1] - qs[1]) < rl) continue;
      parts.push(marker(k, q[0], q[1], r));
      got++;
    }
    if (labels) {
      const q = warp(s);
      parts.push({ kind: 'text', x: q[0], y: q[1], text: `$\\omega_${k + 1}$`, size: fs, fill: cls(k).stroke });
    }
  });
  if (n.stroke !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
  return parts;
}

/** Tassellazione di Voronoi dei prototipi (regola 1-NN) oppure k-NN con il cerchio dei vicini. */
function voronoi(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const m = Math.min(w, h);
  const knn = has(n.spec, 'knn');
  const N = clamp(Math.round(n.count), 3, knn ? 40 : 24);
  const rand = rng(N * 31 + (knn ? 7 : 3));
  const C = knn ? 2 : Math.min(3, N);
  const pts: P2[] = [];
  const lab: number[] = [];
  const minD = m * (knn ? 0.07 : 0.55 / Math.sqrt(N));
  for (let tries = 0; tries < 2000 && pts.length < N; tries++) {
    let p: P2, c: number;
    if (knn) {
      c = pts.length % 2;
      const cx = c ? 0.64 : 0.36, cy = c ? 0.6 : 0.4;
      const g1 = rand() + rand() + rand() - 1.5, g2 = rand() + rand() + rand() - 1.5;
      p = [x + (cx + g1 * 0.32) * w, y + (cy + g2 * 0.32) * h];
    } else {
      c = pts.length % C;
      p = [x + (0.06 + rand() * 0.88) * w, y + (0.06 + rand() * 0.88) * h];
    }
    if (p[0] < x + m * 0.06 || p[0] > x + w - m * 0.06 || p[1] < y + m * 0.06 || p[1] > y + h - m * 0.06) continue;
    if (pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < minD)) continue;
    pts.push(p);
    lab.push(c);
  }
  const parts: Part[] = [];
  const r = clamp(m * 0.028, 1.6, 3.4);
  if (knn) {
    if (n.fill !== 'none') parts.push(rect(x, y, w, h, n.fill));
    const k = clamp(parseInt(/k\s*=\s*(\d+)/i.exec(n.spec)?.[1] ?? '3', 10), 1, pts.length);
    const qx = x + w * 0.5, qy = y + h * 0.5;
    const d = pts.map((p) => Math.hypot(p[0] - qx, p[1] - qy)).sort((a, b) => a - b);
    const R = (d[k - 1] + (d[k] ?? d[k - 1] + 4)) / 2;
    parts.push(line(dashedCircle(qx, qy, R, 28), INK, 0.9));
    pts.forEach((p, i) => parts.push(marker(lab[i], p[0], p[1], r)));
    const s = r * 1.5;
    const star: P2[] = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? s * 0.45 : s;
      return [qx + Math.cos(a) * rr, qy + Math.sin(a) * rr];
    });
    parts.push(area(poly(star), '#222222', '#222222', 0.6));
  } else {
    const cells = powerCells(pts, pts.map(() => 0), { x, y, w, h });
    const inner: Cmd[] = [], border: Cmd[] = [];
    cells.forEach((cell, i) => {
      if (cell.length < 3) return;
      parts.push(area(poly(cell), cls(lab[i]).tint));
      for (let e = 0; e < cell.length; e++) {
        const a = cell[e], b = cell[(e + 1) % cell.length];
        const mid: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const di = Math.hypot(mid[0] - pts[i][0], mid[1] - pts[i][1]);
        let j = -1, dj = Infinity;
        pts.forEach((q, t) => {
          const dd = Math.hypot(mid[0] - q[0], mid[1] - q[1]);
          if (t !== i && dd < dj) { dj = dd; j = t; }
        });
        if (Math.abs(dj - di) > 0.5) continue; // lato sul bordo del riquadro
        if (j < i) continue; // ogni lato una volta sola
        (lab[j] === lab[i] ? inner : border).push(...seg(a, b));
      }
    });
    if (inner.length) parts.push(line(inner, '#B8BEC8', 0.6));
    if (border.length) parts.push(line(border, INK, 1.2));
    pts.forEach((p, i) => parts.push(marker(lab[i], p[0], p[1], r)));
  }
  if (n.stroke !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
  return parts;
}

/** Curve di livello di gaussiane 2-D (classi o componenti di una mistura), con campioni. */
function gauss2d(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const K = clamp(Math.round(n.count), 1, 4);
  const COMP: number[][][] = [
    [[0.5, 0.5, 0.36, 0.2, -0.5]],
    [[0.36, 0.38, 0.26, 0.13, 0.6], [0.66, 0.64, 0.24, 0.12, -0.4]],
    [[0.3, 0.33, 0.2, 0.11, 0.5], [0.71, 0.32, 0.19, 0.11, -0.6], [0.5, 0.72, 0.23, 0.11, 0.1]],
    [[0.28, 0.3, 0.17, 0.09, 0.6], [0.72, 0.28, 0.17, 0.09, -0.5], [0.28, 0.72, 0.16, 0.09, -0.4], [0.72, 0.72, 0.18, 0.09, 0.5]],
  ];
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push(frame(n));
  const m = Math.min(w, h);
  const x0 = x + w * 0.08, y1 = y + h * 0.92;
  parts.push(...axes(x0, y + h * 0.06, x + w * 0.95, y1, false));
  const pointsOn = has(n.spec, 'points');
  const rand = rng(K * 53 + 5);
  COMP[K - 1].forEach(([u, v, ru, rv, rot], k) => {
    const cx = x + u * w, cy = y + v * h, rx = ru * m, ry = rv * m;
    const c = cls(k);
    [1, 0.66, 0.34].forEach((lv, i) => {
      parts.push(area(rotEllipse(cx, cy, rx * lv, ry * lv, rot), [mix('#FFFFFF', c.tint, 0.6), c.tint, mix(c.tint, c.fill, 0.6)][i], c.stroke, 0.9));
    });
    const s = clamp(m * 0.03, 2, 4);
    parts.push(line([...seg([cx - s, cy], [cx + s, cy]), ...seg([cx, cy - s], [cx, cy + s])], c.stroke, 1.3));
    if (pointsOn) {
      for (let i = 0; i < 12; i++) {
        const r1 = Math.sqrt(-2 * Math.log(1 - rand() * 0.999)), a = rand() * TAU;
        const gu = r1 * Math.cos(a) * 0.42, gv = r1 * Math.sin(a) * 0.42;
        const px = cx + Math.cos(rot) * gu * rx - Math.sin(rot) * gv * ry;
        const py = cy + Math.sin(rot) * gu * rx + Math.cos(rot) * gv * ry;
        if (px < x0 + 2 || px > x + w - 2 || py < y + 2 || py > y1 - 2) continue;
        parts.push(disc(px, py, clamp(m * 0.014, 1, 1.8), c.stroke));
      }
    }
  });
  return parts;
}

/** Dendrogramma (clustering gerarchico, legame medio) con taglio a tre cluster. */
function dendro(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const N = clamp(Math.round(n.count), 3, 16);
  const rand = rng(N * 13 + 7);
  const C = [[0.2, 0.3], [0.78, 0.25], [0.5, 0.82]];
  const P: P2[] = Array.from({ length: N }, (_, i) => {
    const c = C[i % 3];
    return [c[0] + (rand() - 0.5) * 0.28, c[1] + (rand() - 0.5) * 0.28];
  });
  type Node = { members: number[]; height: number; left?: Node; right?: Node; leaf?: number };
  let active: Node[] = P.map((_, i) => ({ members: [i], height: 0, leaf: i }));
  const dist = (a: Node, b: Node) => {
    let s = 0;
    for (const i of a.members) for (const j of b.members) s += Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
    return s / (a.members.length * b.members.length);
  };
  const merges: Node[] = [];
  while (active.length > 1) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const d = dist(active[i], active[j]);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
    const node: Node = { members: [...active[bi].members, ...active[bj].members], height: bd, left: active[bi], right: active[bj] };
    merges.push(node);
    active = active.filter((_, k) => k !== bi && k !== bj);
    active.push(node);
  }
  const root = active[0];
  const order: number[] = [];
  const walk = (nd: Node): void => {
    if (nd.leaf !== undefined) order.push(nd.leaf);
    else {
      walk(nd.left!);
      walk(nd.right!);
    }
  };
  walk(root);
  const hmax = root.height || 1;
  const cut = N > 3 ? (merges[N - 4].height + merges[N - 3].height) / 2 : hmax * 0.6;
  const yb = y + h * 0.93, yt = y + h * 0.05;
  const Y = (hh: number) => yb - (yb - yt) * (hh / hmax);
  const lx = (i: number) => x + w * 0.06 + ((w * 0.88) * order.indexOf(i)) / Math.max(1, N - 1);
  const ink = inkOf(n);
  const groups = new Map<string, Cmd[]>();
  const add = (color: string, cmds: Cmd[]) => groups.set(color, [...(groups.get(color) ?? []), ...cmds]);
  let clusterId = 0;
  const leafColor = new Map<number, string>();
  const draw = (nd: Node, color: string | null): number => {
    if (nd.leaf !== undefined) {
      leafColor.set(nd.leaf, color ?? ink);
      return lx(nd.leaf);
    }
    let col = color;
    if (!col && nd.height < cut) col = cls(clusterId++).stroke;
    const xl = draw(nd.left!, col), xr = draw(nd.right!, col);
    const yy = Y(nd.height);
    add(col ?? ink, [['M', xl, Y(nd.left!.height)], ['L', xl, yy], ['L', xr, yy], ['L', xr, Y(nd.right!.height)]]);
    return (xl + xr) / 2;
  };
  const rx = draw(root, null);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push(frame(n));
  add(ink, seg([rx, Y(hmax)], [rx, yt - h * 0.03]));
  for (const [c, cmds] of groups) parts.push(line(cmds, c, Math.max(1, n.strokeWidth)));
  parts.push(line(dashed([x + w * 0.02, Y(cut)], [x + w * 0.98, Y(cut)], 4, 3), '#E5484D', 1));
  const r = clamp(Math.min(w / N, h) * 0.12, 1.4, 3);
  for (const i of order) parts.push(disc(lx(i), yb, r, leafColor.get(i) ?? ink));
  return parts;
}

/** Traliccio di un HMM: stati × tempi, tutte le transizioni e il cammino di Viterbi. */
function trellis(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const S = clamp(Math.round(n.count), 2, 6);
  const T = clamp(parseInt(/\d+/.exec(n.spec)?.[0] ?? '5', 10), 2, 9);
  const r0 = Math.min(w / (T * 3.4), h / (S * 2.7));
  // nomi degli stati S_i a sinistra, se leggibili
  const labels = r0 >= 4 && !has(n.spec, 'nolabel');
  const fs = clamp(r0 * 1.15, 6.5, 12);
  const lm = labels ? fs * 1.8 : 0;
  const r = Math.min((w - lm) / (T * 3.4), h / (S * 2.7));
  const X = (t: number) => x + lm + r + ((w - lm - 2 * r) * t) / (T - 1);
  const Y = (s: number) => y + r + ((h - 2 * r) * s) / Math.max(1, S - 1);
  const rand = rng(S * 17 + T);
  const path = Array.from({ length: T }, () => Math.floor(rand() * S));
  const all: Cmd[] = [];
  for (let t = 0; t + 1 < T; t++) for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) all.push(...seg([X(t) + r, Y(i)], [X(t + 1) - r, Y(j)]));
  const best: Cmd[] = [];
  for (let t = 0; t + 1 < T; t++) best.push(...seg([X(t) + r, Y(path[t])], [X(t + 1) - r, Y(path[t + 1])]));
  const parts: Part[] = [line(all, '#B8BEC8', 0.6), line(best, '#E5484D', Math.max(1.6, r * 0.18))];
  for (let t = 0; t < T; t++)
    for (let s = 0; s < S; s++) {
      const on = path[t] === s;
      parts.push({ kind: 'ellipse', cx: X(t), cy: Y(s), rx: r, ry: r, fill: on ? '#F8CECC' : n.fill, stroke: on ? '#B85450' : undefined, sw: n.strokeWidth });
    }
  if (labels) for (let k = 0; k < S; k++) parts.push({ kind: 'text', x: x + lm * 0.42, y: Y(k), text: `$S_${k + 1}$`, size: fs, fill: '#333333' });
  return parts;
}

// ======================================================================
// Feature classiche
// ======================================================================

/** Distanza con segno dalla sagoma della persona (negativa dentro), coordinate in pixel. */
function personSdf(J: P2[], s: number) {
  const segDist = (p: P2, a: P2, b: P2) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const mid = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const caps: [P2, P2, number][] = [
    [J[11], J[13], 0.045], [J[13], J[15], 0.038], [J[12], J[14], 0.045], [J[14], J[16], 0.038],
    [J[5], J[7], 0.032], [J[7], J[9], 0.026], [J[6], J[8], 0.032], [J[8], J[10], 0.026],
    [mid(J[5], J[6]), mid(J[11], J[12]), 0.1],
  ];
  const headC: P2 = [J[0][0], J[0][1] - 0.01 * s];
  return (p: P2) => {
    let d = Math.hypot(p[0] - headC[0], p[1] - headC[1]) - 0.068 * s;
    for (const [a, b, rr] of caps) d = Math.min(d, segDist(p, a, b) - rr * s);
    return d;
  };
}

/** HOG: griglia di celle con gli istogrammi delle orientazioni (glifi alla Dalal–Triggs). */
function hog(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const [rows, cols] = /\d+\s*[x×,]\s*\d+/.test(n.spec) ? parseGrid(n.spec, 8) : [8, 4];
  const cw = w / cols, ch = h / rows;
  const dark = isDark(n.fill) || n.fill === 'none';
  const bg = n.fill === 'none' ? '#111111' : n.fill;
  const glyph = dark ? '#FFFFFF' : inkOf(n);
  const s = Math.min(h * 0.9, w * 2.4);
  const J = joints(POSES[0], x + w / 2, y + (h - s) / 2, s);
  const sdf = personSdf(J, s);
  const rand = rng(rows * 7 + cols);
  const BINS = 9;
  const hist: number[][] = [];
  let top = 0;
  const eps = Math.max(0.5, Math.min(cw, ch) * 0.1);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const hb = Array.from({ length: BINS }, () => rand() * 0.06);
      for (let sj = 0; sj < 4; sj++)
        for (let si = 0; si < 4; si++) {
          const p: P2 = [x + (i + (si + 0.5) / 4) * cw, y + (j + (sj + 0.5) / 4) * ch];
          const d = sdf(p);
          const gx = sdf([p[0] + eps, p[1]]) - sdf([p[0] - eps, p[1]]);
          const gy = sdf([p[0], p[1] + eps]) - sdf([p[0], p[1] - eps]);
          const wgt = Math.exp(-((d / (Math.min(cw, ch) * 0.55)) ** 2));
          let th = Math.atan2(gy, gx) + Math.PI / 2; // orientazione del bordo
          th = ((th % Math.PI) + Math.PI) % Math.PI;
          const bf = (th / Math.PI) * BINS - 0.5;
          const b0 = Math.floor(bf), fr = bf - b0;
          hb[(b0 + BINS) % BINS] += wgt * (1 - fr);
          hb[(b0 + 1) % BINS] += wgt * fr;
        }
      hist.push(hb);
      top = Math.max(top, ...hb);
    }
  const LEVELS = 6;
  const groups: Cmd[][] = Array.from({ length: LEVELS }, () => []);
  const L = Math.min(cw, ch) * 0.46;
  hist.forEach((hb, idx) => {
    const i = idx % cols, j = Math.floor(idx / cols);
    const cx = x + (i + 0.5) * cw, cy = y + (j + 0.5) * ch;
    hb.forEach((v, b) => {
      const t = v / (top || 1);
      if (t < 0.1) return;
      const lv = Math.min(LEVELS - 1, Math.floor(t ** 0.7 * LEVELS));
      const th = ((b + 0.5) / BINS) * Math.PI;
      groups[lv].push(...seg([cx - Math.cos(th) * L, cy - Math.sin(th) * L], [cx + Math.cos(th) * L, cy + Math.sin(th) * L]));
    });
  });
  const parts: Part[] = [rect(x, y, w, h, bg)];
  const gridC: Cmd[] = [];
  for (let i = 1; i < cols; i++) gridC.push(...seg([x + i * cw, y], [x + i * cw, y + h]));
  for (let j = 1; j < rows; j++) gridC.push(...seg([x, y + j * ch], [x + w, y + j * ch]));
  parts.push(line(gridC, mix(bg, glyph, 0.16), 0.4));
  const sw = clamp(Math.min(cw, ch) * 0.07, 0.6, 1.4);
  groups.forEach((cmds, lv) => cmds.length && parts.push(line(cmds, mix(bg, glyph, 0.25 + (0.75 * (lv + 1)) / LEVELS), sw)));
  if (has(n.spec, 'block') && rows >= 3 && cols >= 3) {
    parts.push(rect(x + cw, y + ch, 2 * cw, 2 * ch, 'none', '#E5484D', 1.4));
    parts.push(line(dashedRect(x + cw, y + 2 * ch, 2 * cw, 2 * ch, 3, 2), '#F5A524', 1.1));
  }
  parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
  return parts;
}

/** Feature di Haar (Viola–Jones Fig. 1 e 3): due, tre o quattro rettangoli, anche sul volto. */
function haar(n: NodeModel): Part[] {
  const type = clamp(Math.round(n.count), 1, 4);
  const DARK = '#4B4B4B';
  const pattern = (bx: number, by: number, bw: number, bh: number, t: number, sw: number): Part[] => {
    const cells: [number, number, number, number, boolean][] =
      t === 1 ? [[0, 0, 0.5, 1, false], [0.5, 0, 0.5, 1, true]]
        : t === 2 ? [[0, 0, 1, 0.5, true], [0, 0.5, 1, 0.5, false]]
          : t === 3 ? [[0, 0, 1 / 3, 1, false], [1 / 3, 0, 1 / 3, 1, true], [2 / 3, 0, 1 / 3, 1, false]]
            : [[0, 0, 0.5, 0.5, false], [0.5, 0, 0.5, 0.5, true], [0, 0.5, 0.5, 0.5, true], [0.5, 0.5, 0.5, 0.5, false]];
    return [
      ...cells.map(([u, v, cw, chh, d]) => rect(bx + u * bw, by + v * bh, cw * bw, chh * bh, d ? DARK : '#FFFFFF')),
      rect(bx, by, bw, bh, 'none', '#222222', sw),
    ];
  };
  if (has(n.spec, 'face')) {
    return framed(n, (b) => {
      const parts = paintScene(b, 'face', 1, 'gray');
      const S = Math.min(b.w, b.h);
      const F = (u: number, v: number): P2 => [b.x + b.w / 2 + (u - 0.5) * S, b.y + b.h / 2 + (v - 0.5) * S];
      const sw = clamp(S * 0.012, 0.8, 1.4);
      if (type === 1) {
        const [x0, y0] = F(0.3, 0.42);
        parts.push(...pattern(x0, y0, 0.4 * S, 0.18 * S, 2, sw));
      } else if (type === 2) {
        const [x0, y0] = F(0.33, 0.425);
        parts.push(...pattern(x0, y0, 0.36 * S, 0.06 * S, 3, sw).map((p, i) => (i === 1 ? { ...p, fill: '#FFFFFF' } : i === 0 || i === 2 ? { ...p, fill: DARK } : p)));
      } else {
        const [x0, y0] = F(0.38, 0.56);
        parts.push(...pattern(x0, y0, 0.24 * S, 0.12 * S, type, sw));
      }
      return parts;
    });
  }
  const { x, y, w, h } = n;
  return [
    frame(n),
    ...pattern(x + w * 0.2, y + h * (type === 2 ? 0.2 : 0.3), w * 0.6, h * (type === 2 ? 0.6 : 0.4), type, Math.max(0.8, n.strokeWidth * 0.8)),
  ];
}

/** Convoluzione dilatata (atrous) di rate r sulla griglia (DeepLab). */
function atrous(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const [rows, cols] = parseGrid(n.spec, 7);
  const rate = clamp(Math.round(n.count), 1, Math.max(1, Math.floor((Math.min(rows, cols) - 1) / 2)));
  const cw = w / cols, ch = h / rows;
  const ci = Math.floor(cols / 2), cj = Math.floor(rows / 2);
  const ink = inkOf(n);
  const parts: Part[] = [frame(n)];
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++) parts.push(rect(x + (ci + a * rate) * cw, y + (cj + b * rate) * ch, cw, ch, shade(ink, 0.45)));
  const gridC: Cmd[] = [];
  for (let i = 1; i < cols; i++) gridC.push(...seg([x + i * cw, y], [x + i * cw, y + h]));
  for (let j = 1; j < rows; j++) gridC.push(...seg([x, y + j * ch], [x + w, y + j * ch]));
  parts.push(line(gridC, ink, n.strokeWidth * 0.5));
  const k = 2 * rate + 1;
  if (rate > 1) parts.push(line(dashedRect(x + (ci - rate) * cw, y + (cj - rate) * ch, k * cw, k * ch, 3, 2), '#E5484D', 1.1));
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++) parts.push(disc(x + (ci + a * rate + 0.5) * cw, y + (cj + b * rate + 0.5) * ch, Math.min(cw, ch) * 0.16, shade(ink, -0.3)));
  parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
  return parts;
}

// ======================================================================
// Immagini e overlay
// ======================================================================

/** Keypoint SIFT: cerchi di scala e orientazione dominante sui punti salienti della foto. */
function sift(n: NodeModel): Part[] {
  return framed(n, (b, rand) => {
    const subject = subjectOf(n.spec);
    const parts = paintScene(b, subject, 0, has(n.spec, 'color') ? n.spec : n.spec + ' gray');
    const m = Math.min(b.w, b.h);
    const cands: [number, number, number][] = [];
    for (const it of solidItems(sceneItems(b, subject, 0))) {
      if (it.line) continue;
      const bb = boundsOf(it.cmds);
      const r = clamp(Math.min(bb.w, bb.h) * 0.55, m * 0.025, m * 0.13);
      cands.push([bb.x + bb.w / 2, bb.y + bb.h / 2, r], [bb.x, bb.y, m * 0.035], [bb.x + bb.w, bb.y, m * 0.03]);
    }
    const inside = cands.filter(([cx, cy]) => cx > b.x + 2 && cx < b.x + b.w - 2 && cy > b.y + 2 && cy < b.y + b.h - 2);
    for (let i = inside.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [inside[i], inside[j]] = [inside[j], inside[i]];
    }
    const pick: [number, number, number][] = [];
    for (const c of inside) {
      if (pick.length >= clamp(Math.round(n.count), 1, 40)) break;
      if (pick.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) < m * 0.07)) continue;
      pick.push(c);
    }
    const under: Cmd[] = [], over: Cmd[] = [];
    for (const [cx, cy, r] of pick) {
      const a = rand() * TAU;
      const c: Cmd[] = [...rotEllipse(cx, cy, r, r, 0), ...seg([cx, cy], [cx + Math.cos(a) * r, cy + Math.sin(a) * r])];
      under.push(...c);
      over.push(...c);
    }
    parts.push(line(under, '#111111', 2.2), line(over, '#FFD43B', 1));
    return parts;
  });
}

/** Finestra mobile (sliding window / template matching) che scorre sull'immagine. */
function slidingWindow(n: NodeModel): Part[] {
  return framed(n, (b) => {
    const subject = subjectOf(n.spec);
    const parts = paintScene(b, subject, 0, n.spec);
    const face = subject === 'face';
    const ww = b.w * (face ? 0.36 : 0.22), wh = face ? ww : Math.min(b.h * 0.46, ww * 2.2);
    const stride = ww * 0.42;
    const k = clamp(Math.round(n.count), 0, 8);
    const y0 = b.y + b.h * (face ? 0.12 : subject === 'ped' ? 0.1 : 0.4);
    const sw = clamp(Math.min(b.w, b.h) * 0.016, 1, 2);
    const trail: Cmd[] = [];
    for (let i = 0; i < k; i++) trail.push(...dashedRect(b.x + b.w * 0.04 + i * stride, y0, ww, wh, 3, 2));
    const cx = b.x + b.w * 0.04 + k * stride;
    if (trail.length) parts.push(line(trail, '#FFFFFF', sw * 1.8), line(trail, '#F5A524', sw * 0.8));
    parts.push(rect(cx, y0, ww, wh, 'none', '#FFFFFF', sw * 2.4), rect(cx, y0, ww, wh, 'none', '#E5484D', sw * 1.3));
    const ay = y0 + Math.min(wh * 0.12, 8);
    const tip = Math.min(cx + ww + stride * 1.1, b.x + b.w - 3);
    if (tip - (cx + ww) > 8) {
      parts.push(...arrow([cx + ww + 2, ay], [tip, ay], '#FFFFFF', sw * 3, 6));
      parts.push(...arrow([cx + ww + 3, ay], [tip - 1, ay], '#E5484D', sw * 1.3, 5));
    }
    return parts;
  });
}

/** Anchor box (Faster R-CNN): k box di scale e proporzioni diverse sulla cella centrale. */
function anchors(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const [rows, cols] = parseGrid(n.spec, 5);
  const ink = inkOf(n);
  const cw = w / cols, ch = h / rows;
  const ci = Math.floor(cols / 2), cj = Math.floor(rows / 2);
  const cx = x + (ci + 0.5) * cw, cy = y + (cj + 0.5) * ch;
  const K = clamp(Math.round(n.count), 1, 9);
  const nScales = Math.ceil(K / 3);
  const scales = [1, 1.6, 2.3].slice(0, nScales);
  const base = (Math.min(w, h) * 0.94) / (scales[scales.length - 1] * Math.SQRT2);
  const parts: Part[] = [frame(n)];
  if (rows >= 3 && cols >= 3) parts.push(rect(x + (ci - 1) * cw, y + (cj - 1) * ch, 3 * cw, 3 * ch, shade(ink, 0.72)));
  parts.push(rect(x + ci * cw, y + cj * ch, cw, ch, shade(ink, 0.45)));
  const gridC: Cmd[] = [];
  for (let i = 1; i < cols; i++) gridC.push(...seg([x + i * cw, y], [x + i * cw, y + h]));
  for (let j = 1; j < rows; j++) gridC.push(...seg([x, y + j * ch], [x + w, y + j * ch]));
  parts.push(line(gridC, shade(ink, 0.35), 0.5));
  if (rows >= 3 && cols >= 3) parts.push(rect(x + (ci - 1) * cw, y + (cj - 1) * ch, 3 * cw, 3 * ch, 'none', '#222222', 1.3));
  const SC = ['#E5484D', '#3B82C4', '#2F9E44'];
  for (let k = 0; k < K; k++) {
    const s = scales[Math.floor(k / 3)];
    const ratio = [0.5, 1, 2][k % 3];
    const aw = (base * s) / Math.sqrt(ratio), ah = base * s * Math.sqrt(ratio);
    parts.push(rect(cx - aw / 2, cy - ah / 2, aw, ah, 'none', SC[Math.floor(k / 3)], 1.2));
  }
  parts.push(disc(cx, cy, clamp(Math.min(cw, ch) * 0.14, 1.2, 2.6), '#222222'));
  parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
  return parts;
}

/** YOLO (Redmon et al. 2016, Fig. 2): griglia S×S, box con confidenza, mappa delle classi. */
function yolo(n: NodeModel): Part[] {
  const [S1, S2] = parseGrid(n.spec, 7);
  return framed(n, (b, rand) => {
    const subject = subjectOf(n.spec);
    const items = sceneItems(b, subject, n.count);
    const ts = things(items);
    const cw = b.w / S2, ch = b.h / S1;
    const gridC: Cmd[] = [];
    for (let i = 1; i < S2; i++) gridC.push(...seg([b.x + i * cw, b.y], [b.x + i * cw, b.y + b.h]));
    for (let j = 1; j < S1; j++) gridC.push(...seg([b.x, b.y + j * ch], [b.x + b.w, b.y + j * ch]));
    const center = (t: (typeof ts)[number]): P2 => [t.bbox.x + t.bbox.w / 2, t.bbox.y + t.bbox.h / 2];
    const cellOf = (p: P2) => [clamp(Math.floor((p[0] - b.x) / cw), 0, S2 - 1), clamp(Math.floor((p[1] - b.y) / ch), 0, S1 - 1)];
    if (has(n.spec, 'prob')) {
      const PROB: Record<string, string> = { car: '#F4A6C6', person: '#8EC1EE', sign: '#F7D774' };
      const parts: Part[] = [];
      for (let j = 0; j < S1; j++)
        for (let i = 0; i < S2; i++) {
          const p: P2 = [b.x + (i + 0.5) * cw, b.y + (j + 0.5) * ch];
          // la cella prende la classe del box che la contiene (il più piccolo), altrimenti del box più vicino
          let best = ts[0], bd = Infinity;
          for (const t of ts) {
            const { x: bx, y: by, w: bw, h: bh } = t.bbox;
            const dx = Math.max(bx - p[0], 0, p[0] - bx - bw), dy = Math.max(by - p[1], 0, p[1] - by - bh);
            const d = Math.hypot(dx, dy) + (dx === 0 && dy === 0 ? (bw * bh) / (b.w * b.h) : 1);
            if (d < bd) { bd = d; best = t; }
          }
          parts.push(rect(b.x + i * cw, b.y + j * ch, cw, ch, PROB[best?.cls] ?? '#DDDDDD'));
        }
      parts.push(line(gridC, '#FFFFFF', 0.8));
      return parts;
    }
    if (has(n.spec, 'boxes')) {
      const parts = paintScene(b, subject, n.count, 'faded');
      parts.push(line(gridC, '#BFC4CC', 0.5));
      const hit = new Map(ts.map((t) => [cellOf(center(t)).join(','), t]));
      for (let j = 0; j < S1; j++)
        for (let i = 0; i < S2; i++) {
          const t = hit.get(`${i},${j}`);
          if (t) {
            parts.push(rect(t.bbox.x, t.bbox.y, t.bbox.w, t.bbox.h, 'none', '#1A1A1A', 2.2));
            continue;
          }
          const bw = b.w * (0.06 + rand() * 0.26), bh = b.h * (0.08 + rand() * 0.3);
          const cx = b.x + (i + rand()) * cw, cy = b.y + (j + rand()) * ch;
          const conf = rand() ** 2.5;
          const q = Math.round(conf * 3) / 3;
          parts.push(rect(cx - bw / 2, cy - bh / 2, bw, bh, 'none', mix('#1A1A1A', '#FFFFFF', 0.6 - q * 0.55), 0.3 + q * 1.1));
        }
      return parts;
    }
    const parts = paintScene(b, subject, n.count, n.spec);
    parts.push(line(gridC, '#222222', 1.3), line(gridC, '#FFFFFF', 0.6));
    const main = [...ts].sort((a, c) => c.bbox.w * c.bbox.h - a.bbox.w * a.bbox.h)[0];
    if (main) {
      const [ci, cj] = cellOf(center(main));
      parts.push(rect(b.x + ci * cw, b.y + cj * ch, cw, ch, 'none', '#E5484D', 1.8));
      parts.push(disc(...center(main), clamp(Math.min(cw, ch) * 0.13, 1.2, 2.5), '#E5484D'));
    }
    return parts;
  });
}

/** RoI pooling (Fast R-CNN) o RoIAlign (Mask R-CNN) di una regione in k×k bin. */
function roiPool(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const [rows, cols] = parseGrid(n.spec, 8);
  const k = clamp(Math.round(n.count), 1, 7);
  const align = has(n.spec, 'align');
  const ink = inkOf(n);
  const cw = w / cols, ch = h / rows;
  const rand = rng(rows * 31 + cols);
  const act = Array.from({ length: rows * cols }, () => rand());
  const parts: Part[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) parts.push(rect(x + i * cw, y + j * ch, cw, ch, shade(ink, 0.93 - 0.1 * Math.round(5 * act[j * cols + i] ** 2))));
  const gridC: Cmd[] = [];
  for (let i = 1; i < cols; i++) gridC.push(...seg([x + i * cw, y], [x + i * cw, y + h]));
  for (let j = 1; j < rows; j++) gridC.push(...seg([x, y + j * ch], [x + w, y + j * ch]));
  parts.push(line(gridC, shade(ink, 0.45), 0.5));
  const RED = '#E5484D';
  const sw = Math.max(1, n.strokeWidth);
  if (!align) {
    const c0 = Math.round(cols * 0.15), r0 = Math.round(rows * 0.2);
    const cn = clamp(Math.round(cols * 0.62), k, cols - c0), rn = clamp(Math.round(rows * 0.58), k, rows - r0);
    const ce = Array.from({ length: k + 1 }, (_, i) => c0 + Math.floor((i * cn) / k));
    const re = Array.from({ length: k + 1 }, (_, i) => r0 + Math.floor((i * rn) / k));
    // cella massima di ogni bin
    for (let bj = 0; bj < k; bj++)
      for (let bi = 0; bi < k; bi++) {
        let mi = ce[bi], mj = re[bj];
        for (let j = re[bj]; j < re[bj + 1]; j++) for (let i = ce[bi]; i < ce[bi + 1]; i++) if (act[j * cols + i] > act[mj * cols + mi]) { mi = i; mj = j; }
        parts.push(rect(x + mi * cw, y + mj * ch, cw, ch, shade(ink, 0.1)));
      }
    const binC: Cmd[] = [];
    for (let i = 1; i < k; i++) binC.push(...seg([x + ce[i] * cw, y + r0 * ch], [x + ce[i] * cw, y + (r0 + rn) * ch]));
    for (let j = 1; j < k; j++) binC.push(...seg([x + c0 * cw, y + re[j] * ch], [x + (c0 + cn) * cw, y + re[j] * ch]));
    if (binC.length) parts.push(line(binC, RED, sw * 0.9));
    parts.push(rect(x + c0 * cw, y + r0 * ch, cn * cw, rn * ch, 'none', RED, sw * 1.6));
  } else {
    const rx = x + cw * 1.35, ry = y + ch * 1.6, rw = w * 0.6, rh = h * 0.52;
    const bw = rw / k, bh = rh / k;
    const binC: Cmd[] = [];
    for (let i = 1; i < k; i++) binC.push(...seg([rx + i * bw, ry], [rx + i * bw, ry + rh]));
    for (let j = 1; j < k; j++) binC.push(...seg([rx, ry + j * bh], [rx + rw, ry + j * bh]));
    if (binC.length) parts.push(line(binC, RED, sw * 0.9));
    parts.push(rect(rx, ry, rw, rh, 'none', RED, sw * 1.6));
    const r = clamp(Math.min(bw, bh) * 0.07, 1, 2.2);
    // interpolazione bilineare del primo punto: dai centri delle 4 celle vicine
    const p0: P2 = [rx + bw * 0.25, ry + bh * 0.25];
    const gi = Math.floor((p0[0] - x) / cw - 0.5), gj = Math.floor((p0[1] - y) / ch - 0.5);
    const nb: Cmd[] = [];
    for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]]) nb.push(...seg(p0, [x + (gi + a + 0.5) * cw, y + (gj + c + 0.5) * ch]));
    parts.push(line(nb, '#3B82C4', 0.6));
    for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]]) parts.push(disc(x + (gi + a + 0.5) * cw, y + (gj + c + 0.5) * ch, r * 0.8, '#FFFFFF', '#3B82C4', 0.6));
    for (let bj = 0; bj < k; bj++)
      for (let bi = 0; bi < k; bi++)
        for (const [u, v] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) parts.push(disc(rx + (bi + u) * bw, ry + (bj + v) * bh, r, '#3B82C4'));
  }
  parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
  return parts;
}

/** Posa umana: scheletro a 17 punti (stile OpenPose), heatmap dei punti o part affinity fields. */
function pose(n: NodeModel): Part[] {
  const P = clamp(Math.round(n.count), 1, 3);
  const photo = has(n.spec, 'photo');
  return framed(n, (b) => {
    const parts: Part[] = [];
    const s = Math.min(b.h * 0.86, (b.w / P) * 2.1);
    const people = Array.from({ length: P }, (_, i) => ({ pose: POSES[i % POSES.length], ox: b.x + (b.w * (i + 0.5)) / P, oy: b.y + b.h * 0.96 - s, style: PEOPLE[i % PEOPLE.length] }));
    const heat = has(n.spec, 'heat'), paf = has(n.spec, 'paf'), match = has(n.spec, 'match');
    if (photo) {
      const fade = heat || paf || match;
      parts.push(...paintScene(b, 'ped', 0, fade ? 'faded' : '').slice(0, 2));
      for (const p of people) for (const it of personItems(p.pose, p.ox, p.oy, s, p.style)) parts.push(area(it.cmds, fade ? mix(it.color, '#FFFFFF', match ? 0.8 : 0.55) : it.color));
    } else parts.push(rect(b.x, b.y, b.w, b.h, heat ? '#FFFFFF' : n.fill === 'none' ? '#FFFFFF' : n.fill));
    const sw = clamp(s * 0.022, 1.1, 3);
    if (match) {
      // candidati fra persone diverse (tenui) e accoppiamenti scelti (pieni), come in OpenPose Fig. 2d
      const Js = people.map((p) => joints(p.pose, p.ox, p.oy, s));
      const faint: Cmd[] = [];
      LIMBS.forEach(([a, c], li) => {
        if (li < 4) return;
        Js.forEach((Ja, pi) => Js.forEach((Jc, qi) => pi !== qi && faint.push(...seg(Ja[a], Jc[c]))));
      });
      if (faint.length) parts.push(line(faint, '#B8BEC8', Math.max(0.5, sw * 0.35)));
      for (const J of Js) {
        LIMBS.forEach(([a, c], li) => li >= 4 && parts.push(line(seg(J[a], J[c]), limbColor(li), sw * 0.9)));
        J.slice(5).forEach(([jx, jy], i) => parts.push(disc(jx, jy, sw * 0.95, limbColor(i + 4), '#FFFFFF', 0.5)));
        parts.push(disc(J[0][0], J[0][1], sw * 0.95, limbColor(0), '#FFFFFF', 0.5));
      }
      return parts;
    }
    for (const p of people) {
      const J = joints(p.pose, p.ox, p.oy, s);
      if (heat || paf) {
        const faint: Cmd[] = LIMBS.flatMap(([a, c]) => seg(J[a], J[c]));
        parts.push(line(faint, '#B0B4BA', Math.max(0.6, sw * 0.4)));
      }
      if (heat) {
        const R = s * 0.05;
        const RAMP = ['#FFE3B3', '#FFB74D', '#F57C00', '#C62828'];
        for (const [jx, jy] of [J[0], ...J.slice(5)]) RAMP.forEach((c, i) => parts.push(disc(jx, jy, R * [1, 0.72, 0.46, 0.22][i], c)));
      } else if (paf) {
        LIMBS.forEach(([a, c], li) => {
          if (li < 4) return;
          const dx = J[c][0] - J[a][0], dy = J[c][1] - J[a][1];
          const l = Math.hypot(dx, dy) || 1;
          const ux = dx / l, uy = dy / l;
          const al = Math.min(l * 0.3, s * 0.05);
          for (const t of [0.3, 0.72])
            for (const o of [-1, 1]) {
              const px = J[a][0] + dx * t - uy * o * s * 0.022, py = J[a][1] + dy * t + ux * o * s * 0.022;
              parts.push(...arrow([px - (ux * al) / 2, py - (uy * al) / 2], [px + (ux * al) / 2, py + (uy * al) / 2], limbColor(li), Math.max(0.7, sw * 0.45), Math.max(2.5, al * 0.45)));
            }
        });
      } else if (!has(n.spec, 'clean')) {
        LIMBS.forEach(([a, c], li) => parts.push(line(seg(J[a], J[c]), limbColor(li), sw)));
        J.forEach(([jx, jy], i) => parts.push(disc(jx, jy, sw * 0.85, limbColor(Math.min(LIMBS.length - 1, Math.max(0, i - 1))), '#FFFFFF', 0.5)));
      }
    }
    return parts;
  });
}

/** Flusso ottico: campo di vettori (frecce) o codifica a colori con la ruota dei colori. */
function flow(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const color = has(n.spec, 'color');
  const [rows, cols] = /\d+\s*[x×,]\s*\d+/.test(n.spec) ? parseGrid(n.spec, 8) : color ? [18, 18] : [7, 8];
  const ink = inkOf(n);
  // espansione dal fuoco (0.4, 0.42), come avanzando; un oggetto (ellisse) che si sposta a destra
  const OU = 0.66, OV = 0.62, RU = 0.2, RV = 0.17;
  const inObj = (d: number) => 1 / (1 + Math.exp((d - 1) * 7));
  const blend = (u: number, v: number, k: number): P2 => [0.9 * (u - 0.4) * (1 - k) + 0.75 * k, 0.9 * (v - 0.42) * (1 - k) - 0.2 * k];
  const field = (u: number, v: number): P2 => blend(u, v, inObj(((u - OU) / RU) ** 2 + ((v - OV) / RV) ** 2));
  // tinta e saturazione quantizzate: pochi colori distinti (l'export TikZ ne definisce uno per colore)
  const flowColor = ([fx, fy]: P2) =>
    hsv(Math.round((Math.atan2(fy, fx) * 180) / Math.PI / 12) * 12, 0.15 + 0.75 * Math.round(Math.min(1, Math.hypot(fx, fy) / 0.8) * 5) / 5, 1);
  const cw = w / cols, ch = h / rows;
  const parts: Part[] = [];
  if (color) {
    // sfondo a celle (campo regolare), oggetto a ellissi concentriche per un bordo morbido
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) parts.push(rect(x + i * cw, y + j * ch, cw + 0.3, ch + 0.3, flowColor(blend((i + 0.5) / cols, (j + 0.5) / rows, 0))));
    for (const [k, mixK] of [[1, 0.92], [0.8, 1]]) parts.push(area(rotEllipse(x + OU * w, y + OV * h, RU * w * Math.sqrt(k), RV * h * Math.sqrt(k), 0), flowColor(blend(OU, OV, mixK))));
    const R = Math.min(w, h) * 0.13;
    if (R > 5) {
      const wx = x + w - R - 3, wy = y + R + 3;
      parts.push(disc(wx, wy, R + 0.8, '#FFFFFF', 'none'));
      for (let k = 0; k < 12; k++) {
        const a0 = (TAU * k) / 12, a1 = (TAU * (k + 1)) / 12;
        parts.push(area(poly([[wx, wy], [wx + Math.cos(a0) * R, wy + Math.sin(a0) * R], [wx + Math.cos((a0 + a1) / 2) * R, wy + Math.sin((a0 + a1) / 2) * R], [wx + Math.cos(a1) * R, wy + Math.sin(a1) * R]]), hsv((((a0 + a1) / 2) * 180) / Math.PI, 0.9, 1)));
      }
      parts.push(disc(wx, wy, R * 0.25, '#FFFFFF'));
      parts.push(disc(wx, wy, R, 'none', '#555555', 0.5));
    }
    parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
    return parts;
  }
  parts.push(frame(n));
  const L = Math.min(cw, ch) * 0.9;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const [fx, fy] = field((i + 0.5) / cols, (j + 0.5) / rows);
      const cx = x + (i + 0.5) * cw, cy = y + (j + 0.5) * ch;
      const l = Math.max(L * 0.12, (L * Math.hypot(fx, fy)) / 0.8);
      const a = Math.atan2(fy, fx);
      const ax = Math.cos(a) * l / 2, ay = Math.sin(a) * l / 2;
      parts.push(...arrow([cx - ax, cy - ay], [cx + ax, cy + ay], ink, Math.max(0.7, n.strokeWidth * 0.75), clamp(l * 0.4, 2, 4.5)));
    }
  return parts;
}

/** Piramide di immagini (gaussiana o laplaciana): livelli dimezzati affiancati. */
function imagePyramid(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const L = clamp(Math.round(n.count), 2, 5);
  const lap = has(n.spec, 'lap');
  const subject = subjectOf(n.spec);
  const g = Math.min(8, w * 0.04);
  const S = Math.min(h, (w - g * (L - 1)) / (2 - 0.5 ** (L - 1)));
  const parts: Part[] = [];
  let px = x + (w - (S * (2 - 0.5 ** (L - 1)) + g * (L - 1))) / 2;
  for (let k = 0; k < L; k++) {
    const s = S * 0.5 ** k;
    const box: ClipRect = { x: px, y: y + h - s, w: s, h: s, r: 0 };
    const mode = lap && k < L - 1 ? 'lap' : has(n.spec, 'gray') ? 'gray' : '';
    parts.push(...withClip(paintScene(box, subject, 0, mode), box));
    parts.push(rect(box.x, box.y, s, s, 'none', inkOf(n), Math.max(0.6, n.strokeWidth * 0.8)));
    px += s + g;
  }
  return parts;
}

// ---------- varianti mostrate come pulsanti nel pannello ----------

const c = (value: string, label?: string) => (label ? { value, label } : value);
const SUBJECT: SpecGroup = { title: 'Soggetto', mode: 'one', choices: [c('street', 'strada'), c('ped', 'pedone'), c('face', 'volto')] };
const grid = (...sizes: string[]): SpecGroup => ({ title: 'Griglia', mode: 'one', choices: sizes });

export const PATTERN_SHAPES: ShapeDef[] = [
  { kind: 'pr-ped-schematic', name: 'Pedone schematico', parts: schematicPedestrian },
  {
    kind: 'pr-bayes', name: 'Decisione di Bayes (densità)', countLabel: 'Classi', countMax: 4, specLabel: 'Variante', parts: bayes,
    specOptions: [{ title: 'Curve', mode: 'many', choices: [c('post', 'a posteriori'), c('nolabel', 'senza ω')] }],
  },
  {
    kind: 'pr-regions', name: 'Regioni di decisione 2-D', countLabel: 'Classi', countMax: 6, specLabel: 'Variante', parts: regions,
    specOptions: [{ title: 'Confini', mode: 'many', choices: [c('linear', 'lineari'), c('nolabel', 'senza ω')] }],
  },
  {
    kind: 'pr-voronoi', name: 'Voronoi / vicini più prossimi', countLabel: 'Prototipi', countMax: 40, specLabel: 'Variante', parts: voronoi,
    specOptions: [{ title: 'Regola', mode: 'one', choices: [c('knn', 'k-NN')] }, { title: 'k', mode: 'one', choices: ['k=1', 'k=3', 'k=5', 'k=7'] }],
  },
  {
    kind: 'pr-gauss2d', name: 'Gaussiane 2-D (curve di livello)', countLabel: 'Componenti', countMax: 4, specLabel: 'Variante', parts: gauss2d,
    specOptions: [{ mode: 'many', choices: [c('points', 'campioni')] }],
  },
  { kind: 'pr-dendro', name: 'Dendrogramma', countLabel: 'Foglie', countMax: 16, parts: dendro },
  {
    kind: 'pr-trellis', name: 'Traliccio HMM (Viterbi)', countLabel: 'Stati', countMax: 6, specLabel: 'Passi temporali', parts: trellis,
    specOptions: [{ title: 'Passi', mode: 'one', choices: ['3', '4', '5', '6', '8'] }, { mode: 'many', choices: [c('nolabel', 'senza nomi')] }],
  },
  {
    kind: 'pr-hog', name: 'HOG (istogrammi di gradienti)', specLabel: 'Celle', parts: hog,
    specOptions: [grid('4x2', '8x4', '12x6', '16x8'), { mode: 'many', choices: [c('block', 'blocchi')] }],
  },
  {
    kind: 'pr-haar', name: 'Feature di Haar', countLabel: 'Tipo (1–4)', countMax: 4, specLabel: 'Variante', parts: haar,
    specOptions: [{ mode: 'many', choices: [c('face', 'sul volto')] }],
  },
  {
    kind: 'pr-atrous', name: 'Convoluzione dilatata (atrous)', countLabel: 'Rate', countMax: 4, specLabel: 'Griglia', parts: atrous,
    specOptions: [grid('5x5', '7x7', '9x9')],
  },
  {
    kind: 'pr-scene', name: 'Foto (scena, pedone, volto)', countLabel: 'Variante', countMax: 4, specLabel: 'Soggetto e resa',
    parts: (n) => framed(n, (b) => paintScene(b, subjectOf(n.spec), n.count, n.spec)),
    specOptions: [
      SUBJECT,
      { title: 'Resa', mode: 'one', choices: [c('gray', 'grigi'), c('faded', 'sbiadita'), c('seg', 'semantica'), c('edges', 'bordi'), c('lap', 'laplaciana')] },
      { title: 'Sovrapposizioni', mode: 'many', choices: [c('inst', 'istanze'), c('det', 'box')] },
    ],
  },
  {
    kind: 'pr-sift', name: 'Keypoint SIFT', countLabel: 'Keypoint', countMax: 40, specLabel: 'Soggetto', parts: sift,
    specOptions: [SUBJECT, { mode: 'many', choices: [c('color', 'a colori')] }],
  },
  {
    kind: 'pr-window', name: 'Finestra mobile', countLabel: 'Passi precedenti', countMax: 8, specLabel: 'Soggetto', parts: slidingWindow,
    specOptions: [SUBJECT, { mode: 'many', choices: [c('gray', 'grigi')] }],
  },
  {
    kind: 'pr-anchors', name: 'Anchor box', countLabel: 'Anchor (k)', countMax: 9, specLabel: 'Griglia', parts: anchors,
    specOptions: [grid('3x3', '5x5', '7x7', '9x9')],
  },
  {
    kind: 'pr-yolo', name: 'Griglia YOLO', countLabel: 'Variante', countMax: 4, specLabel: 'Griglia e modo', parts: yolo,
    specOptions: [grid('5x5', '7x7', '9x9', '13x13'), { title: 'Modo', mode: 'one', choices: [c('boxes', 'box + confidenza'), c('prob', 'classi')] }],
  },
  {
    kind: 'pr-roipool', name: 'RoI pooling / RoIAlign', countLabel: 'Bin per lato (k)', countMax: 7, specLabel: 'Griglia e modo', parts: roiPool,
    specOptions: [grid('6x6', '8x8', '10x10', '14x14'), { mode: 'many', choices: [c('align', 'RoIAlign')] }],
  },
  {
    kind: 'pr-pose', name: 'Posa umana (keypoint)', countLabel: 'Persone', countMax: 3, specLabel: 'Modo', parts: pose,
    specOptions: [
      { title: 'Sfondo', mode: 'many', choices: [c('photo', 'foto'), c('clean', 'senza scheletro')] },
      { title: 'Mappa', mode: 'one', choices: [c('heat', 'heatmap'), c('paf', 'PAF'), c('match', 'matching')] },
    ],
  },
  {
    kind: 'pr-flow', name: 'Flusso ottico', specLabel: 'Griglia e modo', parts: flow,
    specOptions: [{ title: 'Modo', mode: 'one', choices: [c('color', 'colori')] }, grid('5x6', '7x8', '10x10', '18x18')],
  },
  {
    kind: 'pr-imgpyr', name: 'Piramide di immagini', countLabel: 'Livelli', countMax: 5, specLabel: 'Modo', parts: imagePyramid,
    specOptions: [{ title: 'Piramide', mode: 'one', choices: [c('lap', 'laplaciana')] }, SUBJECT, { mode: 'many', choices: [c('gray', 'grigi')] }],
  },
];
