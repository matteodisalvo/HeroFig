// Grafici del machine learning classico, ricalcati sulle figure dei manuali (Bishop, Hastie–
// Tibshirani–Friedman) e della documentazione di scikit-learn: SVM, frontiere di decisione,
// k-means, PCA, regressione, kNN, curve ROC/PR, curve di apprendimento, bias–varianza...
// I dati sono generati con `rng` (deterministici): la figura resta identica a ogni apertura.
import { poly, rng, type ClipRect, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef } from '../registry';
import {
  AXIS, CLS, GRAY_PT, INK, TAU, area, arrow, axesL, axisNames, axisSize, band, centroid, clamp, clipHalf, curve, dashes, disc, ellipseCmds,
  ellipsePts, faded, flag, gauss, labeledArea, PLAIN, lagrange, line, marker, panel, plotArea, polyfit, polyval, seg, text, TEXT,
  type Marker, type P2, type Plot, type Rand,
} from './ml-kit';

const MK: Marker[] = ['o', 's', '^', 'o', 's', '^'];

/** Campiona punti in [lo, hi]² accettati da `ok`, a distanza minima `gap` (coordinate di dati). */
function sample(rand: Rand, count: number, ok: (u: number, v: number) => boolean, gap = 0.05, taken: P2[] = [], lo = 0.05, hi = 0.95): P2[] {
  const out: P2[] = [];
  for (let tries = 0; out.length < count && tries < 4000; tries++) {
    const u = lo + (hi - lo) * rand(), v = lo + (hi - lo) * rand();
    if (!ok(u, v)) continue;
    if ([...taken, ...out].some(([a, b]) => Math.hypot(a - u, b - v) < gap)) continue;
    out.push([u, v]);
  }
  return out;
}

const inside = (p: Plot, q: P2, pad: number) => q[0] > p.x0 + pad && q[0] < p.x1 - pad && q[1] > p.y0 + pad && q[1] < p.y1 - pad;
const dashLen = (p: Plot) => clamp(p.s * 0.035, 2.2, 4.5);

// ---------------------------------------------------------------- SVM

function svm(n: NodeModel): Part[] {
  const p = plotArea(n);
  const parts = panel(n, p);
  const rand = rng(211);
  // geometria in pixel: margini davvero perpendicolari anche se il grafico non è quadrato
  const c = p.P(0.5, 0.5);
  const th = -0.85;
  const d: P2 = [Math.cos(th), Math.sin(th)];
  const nv: P2 = [-d[1], d[0]];
  const M = p.s * 0.13;
  const L = p.s * 3;
  const at = (s: number, t: number): P2 => [c[0] + nv[0] * s + d[0] * t, c[1] + nv[1] * s + d[1] * t];
  const clip = p.clip;
  const dl = dashLen(p);
  parts.push(
    area(poly([at(-M, -L), at(-M, L), at(M, L), at(M, -L)]), '#F0F2F5', { clip }),
    line(dashes([at(-M, -L), at(-M, L)], dl, dl * 0.7), '#555555', 0.9, { clip }),
    line(dashes([at(M, -L), at(M, L)], dl, dl * 0.7), '#555555', 0.9, { clip }),
    line(seg(at(0, -L), at(0, L)), INK, p.lw * 1.1, { clip }),
  );
  const sv: [P2, number][] = [[at(-M, -0.2 * p.s), 0], [at(-M, 0.1 * p.s), 0], [at(M, -0.05 * p.s), 1]];
  const pts: [P2, number][] = [...sv];
  for (const cls of [0, 1]) {
    let got = 0;
    for (let tries = 0; got < 9 && tries < 3000; tries++) {
      const s = (M + p.s * (0.05 + 0.32 * rand())) * (cls ? 1 : -1);
      const q = at(s, p.s * (-0.6 + 0.82 * rand()));
      if (!inside(p, q, p.r * 1.6)) continue;
      if (pts.some(([o]) => Math.hypot(o[0] - q[0], o[1] - q[1]) < p.r * 3)) continue;
      pts.push([q, cls]);
      got++;
    }
  }
  parts.push(...arrow(at(-M, 0.36 * p.s), at(M, 0.36 * p.s), '#555555', 0.9, clamp(p.r * 1.4, 3, 5), true));
  for (const [q, cls] of pts) parts.push(marker(MK[cls], q[0], q[1], p.r, CLS[cls]));
  for (const [q] of sv) parts.push(disc(q[0], q[1], p.r * 1.9, 'none', INK, 0.9));
  return parts;
}

// ---------------------------------------------------------------- frontiera di decisione

const gSmooth = (u: number) => 0.3 + 0.4 * u + 0.15 * Math.sin(TAU * u);
const gLinear = (u: number) => 0.2 + 0.6 * u;
/** Punti "rumorosi" vicino alla frontiera, dalla parte sbagliata: [u, scarto, classe]. */
const NOISY: [number, number, number][] = [[0.18, -0.08, 0], [0.43, 0.08, 1], [0.66, -0.08, 0], [0.86, 0.08, 1]];
const gOver = (u: number) =>
  gSmooth(u) + NOISY.reduce((s, [uk, dv]) => s + (dv + Math.sign(dv) * 0.05) * Math.exp(-(((u - uk) / 0.045) ** 2)), 0);

function boundaryData(): { pts: P2[]; cls: number[] } {
  const rand = rng(404);
  const noisy: P2[] = NOISY.map(([u, dv]) => [u, gSmooth(u) + dv]);
  const ok = (u: number, v: number) => {
    const s = v - gSmooth(u), o = v - gOver(u);
    return Math.abs(s) > 0.05 && Math.abs(o) > 0.035 && Math.sign(s) === Math.sign(o);
  };
  const reg = sample(rand, 44, ok, 0.06, noisy, 0.04, 0.96);
  return { pts: [...reg, ...noisy], cls: [...reg.map(([u, v]) => (v > gSmooth(u) ? 0 : 1)), ...NOISY.map((q) => q[2])] };
}

function boundary(n: NodeModel): Part[] {
  const p = plotArea(n);
  const parts = panel(n, p, false);
  const spec = n.spec.toLowerCase();
  const clip = p.clip;
  const mode = /lin/.test(spec) ? 'linear' : /over/.test(spec) ? 'over' : /circ/.test(spec) ? 'circle' : /ring/.test(spec) ? 'rings' : 'curved';
  if (mode === 'circle' || mode === 'rings') {
    const rand = rng(515);
    const R = 0.27;
    const rr = (u: number, v: number) => Math.hypot(u - 0.5, v - 0.5);
    const inner = sample(rand, 14, (u, v) => rr(u, v) < R - 0.08, 0.07);
    const outer = sample(rand, 26, (u, v) => rr(u, v) > R + 0.1 && rr(u, v) < 0.46, 0.07, inner);
    if (mode === 'circle') {
      const [cx, cy] = p.P(0.5, 0.5);
      const rx = R * (p.x1 - p.x0), ry = R * (p.y1 - p.y0);
      parts.push({ kind: 'rect', ...clip, fill: CLS[1].tint, stroke: 'none' });
      parts.push({ kind: 'ellipse', cx, cy, rx, ry, fill: CLS[0].tint, stroke: INK, sw: p.lw, solid: true });
    }
    parts.push(line([['M', p.x0, p.y0], ['L', p.x0, p.y1], ['L', p.x1, p.y1]], AXIS, 0.9));
    for (const q of inner) parts.push(marker('o', ...p.P(...q), p.r, CLS[0]));
    for (const q of outer) parts.push(marker('s', ...p.P(...q), p.r, CLS[1]));
    return parts;
  }
  const g = mode === 'linear' ? gLinear : mode === 'over' ? gOver : gSmooth;
  const edge = curve(p, g, 0, 1, mode === 'over' ? 160 : 60);
  parts.push(
    { kind: 'rect', ...clip, fill: CLS[1].tint, stroke: 'none' },
    area(poly([...edge, [p.x1 + 5, p.y0 - 50], [p.x0 - 5, p.y0 - 50]]), CLS[0].tint, { clip }),
    line(poly(edge, false), INK, p.lw, { clip }),
    line([['M', p.x0, p.y0], ['L', p.x0, p.y1], ['L', p.x1, p.y1]], AXIS, 0.9),
  );
  const { pts, cls } = boundaryData();
  pts.forEach((q, i) => parts.push(marker(MK[cls[i]], ...p.P(...q), p.r, CLS[cls[i]])));
  return parts;
}

// ---------------------------------------------------------------- k-means

const KC: Record<number, P2[]> = {
  2: [[0.3, 0.64], [0.7, 0.36]],
  3: [[0.26, 0.68], [0.72, 0.72], [0.52, 0.26]],
  4: [[0.26, 0.72], [0.74, 0.74], [0.28, 0.26], [0.72, 0.28]],
  5: [[0.2, 0.74], [0.6, 0.8], [0.84, 0.42], [0.44, 0.44], [0.2, 0.2]],
  6: [[0.18, 0.76], [0.5, 0.8], [0.82, 0.72], [0.2, 0.26], [0.52, 0.32], [0.82, 0.22]],
};

function voronoi(p: Plot, cs: P2[]): P2[][] {
  const box: P2[] = [[p.x0, p.y0], [p.x1, p.y0], [p.x1, p.y1], [p.x0, p.y1]];
  return cs.map((ci, i) =>
    cs.reduce((cell, cj, j) => {
      if (i === j) return cell;
      const a: P2 = [cj[0] - ci[0], cj[1] - ci[1]];
      return clipHalf(cell, a, a[0] * (ci[0] + cj[0]) / 2 + a[1] * (ci[1] + cj[1]) / 2);
    }, box),
  );
}

/** Lati interni delle celle di Voronoi (quelli sul bordo del grafico non si disegnano). */
function voronoiEdges(p: Plot, cells: P2[][]): Cmd[] {
  const onBorder = (a: P2, b: P2) =>
    (Math.abs(a[0] - b[0]) < 0.01 && (Math.abs(a[0] - p.x0) < 0.01 || Math.abs(a[0] - p.x1) < 0.01)) ||
    (Math.abs(a[1] - b[1]) < 0.01 && (Math.abs(a[1] - p.y0) < 0.01 || Math.abs(a[1] - p.y1) < 0.01));
  const cmds: Cmd[] = [];
  for (const cell of cells)
    cell.forEach((a, i) => {
      const b = cell[(i + 1) % cell.length];
      if (!onBorder(a, b) && Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.5) cmds.push(...seg(a, b));
    });
  return cmds;
}

function kmeans(n: NodeModel): Part[] {
  const p = plotArea(n);
  const parts = panel(n, p);
  const k = clamp(Math.round(n.count), 2, 6);
  const spec = n.spec.toLowerCase();
  const mode = ['raw', 'init', 'assign', 'update', 'voronoi'].find((m) => spec.includes(m)) ?? 'final';
  const rand = rng(300 + k);
  const sd = k <= 3 ? 0.085 : k === 4 ? 0.075 : 0.062;
  const per = Math.round(40 / k) + 2;
  const pts: P2[] = [];
  KC[k].forEach(([cu, cv]) => {
    for (let got = 0, tries = 0; got < per && tries < 400; tries++) {
      const u = cu + sd * gauss(rand), v = cv + sd * gauss(rand);
      if (u < 0.04 || u > 0.96 || v < 0.04 || v > 0.96) continue;
      pts.push(p.P(u, v));
      got++;
    }
  });
  const nearest = (q: P2, cs: P2[]) => cs.reduce((b, c, i) => (Math.hypot(q[0] - c[0], q[1] - c[1]) < Math.hypot(q[0] - cs[b][0], q[1] - cs[b][1]) ? i : b), 0);
  const means = (lab: number[], cs: P2[]) =>
    cs.map((c, i) => {
      const mine = pts.filter((_, j) => lab[j] === i);
      return mine.length ? ([mine.reduce((s, q) => s + q[0], 0) / mine.length, mine.reduce((s, q) => s + q[1], 0) / mine.length] as P2) : c;
    });
  // centroidi iniziali "sbagliati" (come nella Fig. 9.1 di Bishop): avvicinati al centro e ruotati
  const g = KC[k].reduce((s, c) => [s[0] + c[0] / k, s[1] + c[1] / k], [0, 0]);
  const init = KC[k].map(([cu, cv]) => {
    const du = (cu - g[0]) * 0.45, dv = (cv - g[1]) * 0.45;
    const a = 0.55;
    return p.P(g[0] + du * Math.cos(a) - dv * Math.sin(a), g[1] + du * Math.sin(a) + dv * Math.cos(a));
  });
  // risultato finale: algoritmo di Lloyd fino alla convergenza (partendo dai centri dei gruppi,
  // così non finisce in un minimo locale; per k = 3 coincide con quello che parte da `init`)
  let cs = KC[k].map((c) => p.P(...c));
  let lab = pts.map((q) => nearest(q, cs));
  for (let it = 0; it < 30; it++) {
    cs = means(lab, cs);
    const next = pts.map((q) => nearest(q, cs));
    if (next.every((v, j) => v === lab[j])) break;
    lab = next;
  }
  const r = p.r;
  if (mode === 'raw' || mode === 'init') {
    for (const q of pts) parts.push(marker('o', q[0], q[1], r, GRAY_PT));
    if (mode === 'init') init.forEach((c, i) => parts.push(...centroid(c[0], c[1], r * 1.5, CLS[i].stroke)));
    return parts;
  }
  if (mode === 'assign' || mode === 'update') {
    const a = pts.map((q) => nearest(q, init));
    if (mode === 'assign') parts.push(line(voronoiEdges(p, voronoi(p, init)), '#8E44AD', 1, { clip: p.clip }));
    pts.forEach((q, j) => parts.push(marker('o', q[0], q[1], r, CLS[a[j]])));
    if (mode === 'assign') init.forEach((c, i) => parts.push(...centroid(c[0], c[1], r * 1.5, CLS[i].stroke)));
    else {
      const next = means(a, init);
      init.forEach((c, i) => {
        parts.push(disc(c[0], c[1], r * 0.9, '#FFFFFF', CLS[i].stroke, 1));
        if (Math.hypot(next[i][0] - c[0], next[i][1] - c[1]) > r * 2) parts.push(...arrow(c, next[i], INK, 0.9, clamp(r * 1.5, 3, 5)));
        parts.push(...centroid(next[i][0], next[i][1], r * 1.5, CLS[i].stroke));
      });
    }
    return parts;
  }
  if (mode === 'voronoi') {
    const cells = voronoi(p, cs);
    cells.forEach((cell, i) => cell.length > 2 && parts.push(area(poly(cell), CLS[i].tint)));
    parts.push(line(voronoiEdges(p, cells), '#7A808A', 0.9, { clip: p.clip }), line([['M', p.x0, p.y0 - 2], ['L', p.x0, p.y1], ['L', p.x1 + 2, p.y1]], AXIS, 0.9));
  }
  pts.forEach((q, j) => parts.push(marker('o', q[0], q[1], r, CLS[lab[j]])));
  cs.forEach((c, i) => parts.push(...centroid(c[0], c[1], r * 1.5, CLS[i].stroke)));
  return parts;
}

// ---------------------------------------------------------------- PCA

function pca(n: NodeModel): Part[] {
  const p = plotArea(n);
  const parts = panel(n, p);
  const rand = rng(77);
  const c = p.P(0.5, 0.48);
  const rot = -0.55;
  const e1: P2 = [Math.cos(rot), Math.sin(rot)];
  const e2: P2 = [-e1[1], e1[0]];
  const s1 = p.s * 0.22, s2 = p.s * 0.08;
  const pts: P2[] = [];
  for (let tries = 0; pts.length < 36 && tries < 400; tries++) {
    const a = s1 * gauss(rand), b = s2 * gauss(rand);
    const q: P2 = [c[0] + e1[0] * a + e2[0] * b, c[1] + e1[1] * a + e2[1] * b];
    if (inside(p, q, p.r * 1.4)) pts.push(q);
  }
  if (/proj/.test(n.spec)) {
    const L = p.s * 3;
    const dl = dashLen(p);
    parts.push(line(dashes([[c[0] - e1[0] * L, c[1] - e1[1] * L], [c[0] + e1[0] * L, c[1] + e1[1] * L]], dl, dl * 0.7), '#C0392B', 0.9, { clip: p.clip }));
    for (const q of pts) {
      const t = (q[0] - c[0]) * e1[0] + (q[1] - c[1]) * e1[1];
      const f: P2 = [c[0] + e1[0] * t, c[1] + e1[1] * t];
      parts.push(line(seg(q, f), '#9AA0A6', 0.7), disc(f[0], f[1], p.r * 0.55, '#C0392B'));
    }
  }
  for (const q of pts) parts.push(marker('o', q[0], q[1], p.r, CLS[0]));
  const hs = clamp(p.r * 2.2, 5, 8);
  const pc1: P2 = [c[0] + e1[0] * s1 * 2.1, c[1] + e1[1] * s1 * 2.1];
  const pc2: P2 = [c[0] - e2[0] * s2 * 2.6, c[1] - e2[1] * s2 * 2.6];
  parts.push(...arrow(c, pc1, '#FFFFFF', p.lw * 1.3 + 2, hs + 1.5), ...arrow(c, pc1, '#C0392B', p.lw * 1.3, hs));
  parts.push(...arrow(c, pc2, '#FFFFFF', p.lw * 1.3 + 2, hs + 1.5), ...arrow(c, pc2, '#2E7D32', p.lw * 1.3, hs));
  parts.push(disc(c[0], c[1], p.r * 0.8, INK));
  return parts;
}

// ---------------------------------------------------------------- regressione

const truthSin = (u: number) => 0.5 + 0.3 * Math.sin(TAU * u);

function regression(n: NodeModel): Part[] {
  const p = plotArea(n);
  const parts = panel(n, p);
  const spec = n.spec.toLowerCase();
  const mode = ['under', 'good', 'over'].find((m) => spec.includes(m)) ?? 'linear';
  const clip = p.clip;
  const FIT = '#C0392B';
  if (mode === 'linear') {
    const N = clamp(Math.round(n.count), 4, 40);
    const rand = rng(500 + N);
    const us = Array.from({ length: N }, (_, i) => clamp(0.03 + (0.94 * (i + 0.5)) / N + ((rand() - 0.5) * 0.6) / N, 0.03, 0.97));
    const ys = us.map((u) => clamp(0.16 + 0.66 * u + 0.075 * gauss(rand), 0.04, 0.96));
    const coef = polyfit(us, ys, 1);
    us.forEach((u, i) => parts.push(line(seg(p.P(u, ys[i]), p.P(u, polyval(coef, u))), '#9AA0A6', 0.9)));
    parts.push(line(seg(p.P(0, polyval(coef, 0)), p.P(1, polyval(coef, 1))), FIT, p.lw * 1.1, { clip }));
    us.forEach((u, i) => parts.push(marker('o', ...p.P(u, ys[i]), p.r, CLS[0])));
    return parts;
  }
  // Bishop, Fig. 1.4: sin(2πx) con rumore, polinomi di grado 1, 3 e N−1
  const N = 10;
  const rand = rng(611);
  const us = Array.from({ length: N }, (_, i) => (i + 0.5) / N + (rand() - 0.5) * 0.04);
  const ys = us.map((u) => clamp(truthSin(u) + 0.11 * gauss(rand), 0.05, 0.95));
  const f = mode === 'under' ? ((c) => (u: number) => polyval(c, u))(polyfit(us, ys, 1)) : mode === 'good' ? ((c) => (u: number) => polyval(c, u))(polyfit(us, ys, 3)) : (u: number) => lagrange(us, ys, u);
  parts.push(line(poly(curve(p, truthSin, 0, 1, 60), false), '#7FBF7F', p.lw * 0.9, { clip }));
  parts.push(line(poly(curve(p, f, 0, 1, 160), false), FIT, p.lw * 1.1, { clip }));
  us.forEach((u, i) => parts.push(marker('o', ...p.P(u, ys[i]), p.r, { fill: '#FFFFFF', stroke: CLS[0].stroke }, 1.1)));
  return parts;
}

// ---------------------------------------------------------------- regressione logistica

function logistic(n: NodeModel): Part[] {
  const p = plotArea(n);
  const parts = panel(n, p);
  const rand = rng(733);
  const v0 = 0.08, v1 = 0.92;
  const dl = dashLen(p);
  const sig = (u: number) => v0 + (v1 - v0) / (1 + Math.exp(-14 * (u - 0.5)));
  parts.push(
    line([...dashes([p.P(0, v1), p.P(1, v1)], dl * 0.5, dl * 0.8), ...dashes([p.P(0, 0.5), p.P(1, 0.5)], dl, dl * 0.7)], '#B0B6BF', 0.8),
    line(dashes([p.P(0.5, 0), p.P(0.5, 1)], dl, dl * 0.7), '#7A808A', 0.9),
    line(poly(curve(p, sig, 0, 1, 60), false), '#C0392B', p.lw * 1.1),
  );
  for (const cls of [0, 1]) {
    const taken: number[] = [];
    for (let tries = 0; taken.length < 9 && tries < 500; tries++) {
      const u = clamp((cls ? 0.66 : 0.34) + 0.15 * gauss(rand), 0.03, 0.97);
      if (taken.some((t) => Math.abs(t - u) < 0.045)) continue;
      taken.push(u);
      parts.push(marker(MK[cls], ...p.P(u, cls ? v1 : v0), p.r, CLS[cls]));
    }
  }
  return parts;
}

// ---------------------------------------------------------------- kNN

function knn(n: NodeModel): Part[] {
  const p = plotArea(n);
  const parts = panel(n, p);
  const k = clamp(Math.round(n.count), 1, 15);
  const rand = rng(845);
  const q = p.P(0.5, 0.5);
  const pts: { q: P2; c: number }[] = [];
  for (const [c, cu, cv] of [[0, 0.32, 0.62], [1, 0.68, 0.38]] as const)
    for (let got = 0, tries = 0; got < 16 && tries < 800; tries++) {
      const s = p.P(clamp(cu + 0.17 * gauss(rand), 0.04, 0.96), clamp(cv + 0.17 * gauss(rand), 0.04, 0.96));
      if ([{ q, c: -1 }, ...pts].some((o) => Math.hypot(o.q[0] - s[0], o.q[1] - s[1]) < p.r * (o.c < 0 ? 4 : 2.8))) continue;
      pts.push({ q: s, c });
      got++;
    }
  const dist = (s: P2) => Math.hypot(s[0] - q[0], s[1] - q[1]);
  const order = [...pts].sort((a, b) => dist(a.q) - dist(b.q));
  const R = (dist(order[k - 1].q) + dist(order[Math.min(k, order.length - 1)].q)) / 2;
  const dl = dashLen(p);
  parts.push(
    { kind: 'ellipse', cx: q[0], cy: q[1], rx: R, ry: R, fill: '#F6F7F9', stroke: 'none', clip: p.clip },
    line(dashes(ellipsePts(q[0], q[1], R, R, 0, 72), dl, dl * 0.7, true), '#555555', 0.9, { clip: p.clip }),
  );
  for (const o of order.slice(0, k)) parts.push(line(seg(q, o.q), '#7A808A', 0.8));
  for (const o of pts) parts.push(marker(MK[o.c], o.q[0], o.q[1], p.r, CLS[o.c]));
  parts.push(marker('*', q[0], q[1], p.r * 1.9, { fill: CLS[2].fill, stroke: '#2B6A28' }, 1.1));
  return parts;
}

// ---------------------------------------------------------------- ROC e precision–recall

/** Curva ROC empirica a gradini da punteggi simulati. */
function rocSteps(sep: number, seed: number): [number, number][] {
  const rand = rng(seed);
  const N = 20;
  const s = [...Array.from({ length: N }, () => ({ y: 1, v: sep + gauss(rand) })), ...Array.from({ length: N }, () => ({ y: 0, v: gauss(rand) }))].sort((a, b) => b.v - a.v);
  let fp = 0, tp = 0;
  const out: [number, number][] = [[0, 0]];
  for (const o of s) {
    if (o.y) tp++;
    else fp++;
    out.push([fp / N, tp / N]);
  }
  return out;
}

/** Etichetta di una curva, nel suo colore. */
const tag = (n: NodeModel, p: Plot, u: number, v: number, t: string, color: string, anchor: 'start' | 'middle' | 'end' = 'middle'): Part[] =>
  flag(n, 'plain') ? [] : [text(...p.P(u, v), t, axisSize(n) * 0.95, color, anchor)];

function roc(n: NodeModel): Part[] {
  const p = labeledArea(n, 0.13, 0.06);
  const parts = panel(n, p, false);
  const k = clamp(Math.round(n.count), 1, 4);
  const step = flag(n, 'step');
  const dl = dashLen(p);
  const B = [5.5, 2.8, 1.7, 1.25];
  const SEP = [1.5, 1.0, 0.6, 0.3];
  const series = Array.from({ length: k }, (_, i): P2[] => {
    if (!step) return curve(p, (u) => 1 - (1 - u) ** B[i], 0, 1, 80);
    const st = rocSteps(SEP[i], 90 + i);
    const out: P2[] = [];
    st.forEach(([u, v], j) => {
      if (j) out.push(p.P(u, st[j - 1][1]));
      out.push(p.P(u, v));
    });
    return out;
  });
  if (k === 1) parts.push(area(poly([...series[0], p.P(1, 0), p.P(0, 0)]), CLS[0].tint));
  parts.push(line(dashes([p.P(0, 0), p.P(1, 1)], dl, dl * 0.7), '#9AA0A6', 0.9));
  series.forEach((s, i) => parts.push(line(poly(s, false), CLS[i].stroke, p.lw * 1.1)));
  parts.push(axesL(p), ...axisNames(n, p, 'FPR', 'TPR'));
  return parts;
}

function prCurve(n: NodeModel): Part[] {
  const p = labeledArea(n, 0.13, 0.06);
  const parts = panel(n, p, false);
  const k = clamp(Math.round(n.count), 1, 4);
  const base = 0.3;
  const C = [3.2, 2, 1.35, 1.1];
  const dl = dashLen(p);
  const series = Array.from({ length: k }, (_, i) => curve(p, (r) => base + (1 - base) * (1 - r ** C[i]) * 0.97, 0, 1, 80));
  if (k === 1) parts.push(area(poly([...series[0], p.P(1, 0), p.P(0, 0)]), CLS[0].tint));
  parts.push(line(dashes([p.P(0, base), p.P(1, base)], dl, dl * 0.7), '#9AA0A6', 0.9));
  series.forEach((s, i) => parts.push(line(poly(s, false), CLS[i].stroke, p.lw * 1.1)));
  parts.push(axesL(p), ...axisNames(n, p, 'Recall', 'Precision'));
  return parts;
}

// ---------------------------------------------------------------- curve di apprendimento

function learning(n: NodeModel): Part[] {
  const p = labeledArea(n);
  const parts = panel(n, p);
  const dl = dashLen(p);
  if (flag(n, 'epochs')) {
    const tr = (u: number) => 0.1 + 0.78 * Math.exp(-4.2 * u) + 0.012 * Math.sin(31 * u);
    const va = (u: number) => 0.24 + 0.66 * Math.exp(-5 * u) + 0.42 * u * u + 0.018 * Math.sin(23 * u + 1);
    let best = 0;
    for (let i = 0; i <= 200; i++) if (va(i / 200) < va(best)) best = i / 200;
    parts.push(line(dashes([p.P(best, 0), p.P(best, 1)], dl, dl * 0.7), '#7A808A', 0.9));
    parts.push(line(poly(curve(p, tr, 0.02, 1, 80), false), CLS[0].stroke, p.lw * 1.1));
    parts.push(line(poly(curve(p, va, 0.02, 1, 80), false), CLS[1].stroke, p.lw * 1.1));
    parts.push(disc(...p.P(best, va(best)), p.r * 1.1, '#FFFFFF', CLS[1].stroke, 1.2));
    parts.push(...tag(n, p, 0.97, tr(0.97) + 0.12, 'train', CLS[0].stroke, 'end'), ...tag(n, p, 0.97, va(0.97) + 0.13, 'val', CLS[1].stroke, 'end'));
    parts.push(...axisNames(n, p, 'epochs', 'loss'));
    return parts;
  }
  // scikit-learn, "Plotting Learning Curves": training score (rosso) e cross-validation score (verde)
  const tr = (u: number) => 0.92 - 0.1 * (1 - Math.exp(-2.5 * u));
  const va = (u: number) => 0.78 - 0.42 * Math.exp(-3.4 * u);
  const sdT = () => 0.03;
  const sdV = (u: number) => 0.03 + 0.08 * Math.exp(-2 * u);
  const U0 = 0.06, U1 = 0.96;
  parts.push(area(band(p, (u) => tr(u) - sdT(), (u) => tr(u) + sdT(), U0, U1), CLS[3].tint));
  parts.push(area(band(p, (u) => va(u) - sdV(u), (u) => va(u) + sdV(u), U0, U1), CLS[2].tint));
  for (const [f, c] of [[tr, CLS[3]], [va, CLS[2]]] as const) {
    parts.push(line(poly(curve(p, f, U0, U1, 60), false), c.stroke, p.lw * 1.1));
    for (let i = 0; i < 6; i++) {
      const u = U0 + ((U1 - U0) * i) / 5;
      parts.push(marker('o', ...p.P(u, f(u)), p.r * 0.95, { fill: c.stroke, stroke: c.stroke }));
    }
  }
  parts.push(...tag(n, p, U1, va(U1) - sdV(U1) - 0.14, 'validation', CLS[2].stroke, 'end'), ...tag(n, p, U1, tr(U1) + 0.11, 'train', CLS[3].stroke, 'end'));
  parts.push(...axisNames(n, p, 'training set size', 'score'));
  return parts;
}

// ---------------------------------------------------------------- bias–varianza

function biasVariance(n: NodeModel): Part[] {
  const p = labeledArea(n);
  const parts = panel(n, p);
  const dl = dashLen(p);
  const argmin = (f: (u: number) => number) => {
    let b = 0;
    for (let i = 0; i <= 200; i++) if (f(i / 200) < f(b)) b = i / 200;
    return b;
  };
  if (flag(n, 'error')) {
    // Hastie et al., Fig. 7.1: errore di training e di test al crescere della complessità
    const trE = (u: number) => 0.06 + 0.8 * Math.exp(-3.3 * u);
    const teE = (u: number) => 0.24 + 0.62 * Math.exp(-4.2 * u) + 0.5 * u * u;
    const b = argmin(teE);
    parts.push(line(dashes([p.P(b, 0), p.P(b, 1)], dl, dl * 0.7), '#7A808A', 0.9));
    parts.push(line(poly(curve(p, trE, 0.02, 0.98), false), CLS[0].stroke, p.lw * 1.1));
    parts.push(line(poly(curve(p, teE, 0.02, 0.98), false), CLS[3].stroke, p.lw * 1.1));
    parts.push(...tag(n, p, 0.98, trE(0.98) + 0.12, 'train', CLS[0].stroke, 'end'), ...tag(n, p, 0.98, teE(0.98) - 0.24, 'test', CLS[3].stroke, 'end'));
    parts.push(...axisNames(n, p, 'model complexity', 'error'));
    return parts;
  }
  const bias = (u: number) => 0.02 + 0.72 * Math.exp(-3.4 * u);
  const vari = (u: number) => 0.02 + 0.62 * u ** 2.4;
  const noise = 0.1;
  const tot = (u: number) => bias(u) + vari(u) + noise;
  const b = argmin(tot);
  parts.push(
    line(dashes([p.P(0, noise), p.P(1, noise)], dl * 0.6, dl * 0.8), '#B0B6BF', 0.8),
    line(dashes([p.P(b, 0), p.P(b, 1)], dl, dl * 0.7), '#7A808A', 0.9),
    line(poly(curve(p, bias, 0.02, 0.98), false), CLS[0].stroke, p.lw * 1.1),
    line(poly(curve(p, vari, 0.02, 0.98), false), CLS[1].stroke, p.lw * 1.1),
    line(poly(curve(p, tot, 0.02, 0.98), false), INK, p.lw * 1.3),
    ...tag(n, p, 0.04, 0.22, 'bias$^2$', CLS[0].stroke, 'start'),
    ...tag(n, p, 0.98, 0.18, 'variance', CLS[1].stroke, 'end'),
    ...tag(n, p, 0.98, 0.96, 'total', INK, 'end'),
    ...axisNames(n, p, 'model complexity', 'error'),
  );
  return parts;
}

// ---------------------------------------------------------------- metodo del gomito

const ELBOW = [1, 0.52, 0.2, 0.15, 0.122, 0.102, 0.088, 0.077, 0.068, 0.061, 0.055, 0.05];

function elbow(n: NodeModel): Part[] {
  const p = labeledArea(n);
  const parts = panel(n, p);
  const K = clamp(Math.round(n.count), 4, 12);
  const at = (k: number) => p.P(0.04 + (0.92 * (k - 1)) / (K - 1), 0.06 + 0.88 * ELBOW[k - 1]);
  const pts = Array.from({ length: K }, (_, i) => at(i + 1));
  const e = at(3);
  const dl = dashLen(p);
  parts.push(line(dashes([e, [e[0], p.y1]], dl, dl * 0.7), '#7A808A', 0.9));
  parts.push(line(poly(pts, false), CLS[0].stroke, p.lw));
  for (const q of pts) parts.push(marker('o', q[0], q[1], p.r * 0.95, { fill: CLS[0].stroke, stroke: CLS[0].stroke }));
  parts.push(disc(e[0], e[1], p.r * 2.4, 'none', '#C0392B', 1.3));
  parts.push(...axisNames(n, p, 'number of clusters $k$', 'SSE'));
  return parts;
}

// ---------------------------------------------------------------- miscela di gaussiane

const GMM = [
  { c: [0.3, 0.62] as P2, a: 0.17, b: 0.07, rot: -0.6 },
  { c: [0.7, 0.7] as P2, a: 0.11, b: 0.075, rot: 0.5 },
  { c: [0.6, 0.27] as P2, a: 0.17, b: 0.06, rot: -0.12 },
  { c: [0.17, 0.22] as P2, a: 0.07, b: 0.055, rot: 0 },
];

function gmm(n: NodeModel): Part[] {
  const p = plotArea(n);
  const parts = panel(n, p);
  const k = clamp(Math.round(n.count), 1, 4);
  const rand = rng(950 + k);
  const comps = GMM.slice(0, k).map((g) => ({ ...g, c: p.P(...g.c), a: g.a * p.s, b: g.b * p.s }));
  const fills: Part[] = [], rings: Part[] = [], dots: Part[] = [];
  comps.forEach((g, i) => {
    const col = CLS[i];
    fills.push(area(ellipseCmds(g.c[0], g.c[1], g.a * 2.4, g.b * 2.4, g.rot), col.tint, { clip: p.clip }));
    [2.4, 1.6, 0.8].forEach((s, j) => rings.push(line(ellipseCmds(g.c[0], g.c[1], g.a * s, g.b * s, g.rot), faded(col.stroke, 0.5 - j * 0.22), 0.9 + j * 0.25, { clip: p.clip })));
    const cos = Math.cos(g.rot), sin = Math.sin(g.rot);
    for (let got = 0, tries = 0; got < 12 && tries < 300; tries++) {
      const x = g.a * gauss(rand), y = g.b * gauss(rand);
      const q: P2 = [g.c[0] + cos * x - sin * y, g.c[1] + sin * x + cos * y];
      if (!inside(p, q, p.r * 1.3)) continue;
      dots.push(marker('o', q[0], q[1], p.r * 0.85, col));
      got++;
    }
  });
  const means = comps.flatMap((g, i) => [disc(g.c[0], g.c[1], p.r * 1.25, '#FFFFFF', 'none'), marker('+', g.c[0], g.c[1], p.r * 1.1, { fill: 'none', stroke: CLS[i].stroke })]);
  return [...parts, ...fills, ...rings, ...dots, ...means];
}

// ---------------------------------------------------------------- spazio delle feature (kernel trick)

function lift(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  // proiezione obliqua: x₁ a destra, x₂ in profondità, z = x₁² + x₂² verso l'alto
  const O: P2 = [x + 0.5 * w, y + 0.8 * h];
  const P3 = (a: number, b: number, z: number): P2 => [O[0] + a * 0.28 * w + b * 0.12 * w, O[1] - b * 0.09 * h - z * 0.52 * h];
  const m = Math.min(w, h);
  const r = clamp(m * 0.028, 1.5, 4);
  // cornice come gli altri grafici (invisibile con riempimento e bordo 'none')
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill: n.fill }];
  const corner = P3(-1, -1, 0);
  const hs = clamp(m * 0.04, 3, 5);
  parts.push(line(poly([P3(-1, -1, 0), P3(1, -1, 0), P3(1, 1, 0), P3(-1, 1, 0)]), '#C9CED6', 0.8));
  parts.push(...arrow(corner, P3(1.22, -1, 0), AXIS, 0.9, hs), ...arrow(corner, P3(-1, 1.3, 0), AXIS, 0.9, hs), ...arrow(corner, P3(-1, -1, 1.15), AXIS, 0.9, hs));

  const rand = rng(1212);
  const pts: { a: number; b: number; c: number }[] = [];
  for (const [c, r0, r1, cnt] of [[0, 0.05, 0.42, 14], [1, 0.72, 0.98, 20]] as const)
    for (let i = 0; i < cnt; i++) {
      const t = (TAU * (i + rand() * 0.6)) / cnt, rr = r0 + (r1 - r0) * rand();
      pts.push({ a: rr * Math.cos(t), b: rr * Math.sin(t), c });
    }
  pts.sort((p1, p2) => p2.b - p1.b);
  const z0 = 0.4;
  const PLANE = { fill: '#EEE9F6', stroke: '#9673A6' };
  const lower = pts.filter((q) => q.c === 0), upper = pts.filter((q) => q.c === 1);
  // paraboloide z = x₁² + x₂²: sezione e bordo, appena accennati
  const bowl = Array.from({ length: 41 }, (_, i) => -1 + i / 20);
  parts.push(line(poly(bowl.map((a) => P3(a, 0, a * a)), false), '#D5D9DF', 0.9));
  parts.push(line(poly(Array.from({ length: 48 }, (_, i) => P3(Math.cos((TAU * i) / 48), Math.sin((TAU * i) / 48), 1))), '#D5D9DF', 0.9));
  for (const q of lower) parts.push(marker('o', ...P3(q.a, q.b, q.a ** 2 + q.b ** 2), r, CLS[0]));
  parts.push({ kind: 'path', cmds: poly([P3(-1, -1, z0), P3(1, -1, z0), P3(1, 1, z0), P3(-1, 1, z0)]), fill: PLANE.fill, stroke: PLANE.stroke, sw: 1, solid: true });
  for (const q of upper) parts.push(marker('s', ...P3(q.a, q.b, q.a ** 2 + q.b ** 2), r, CLS[1]));
  // nomi degli assi in punta (x₂ resterebbe sotto il piano: si omette)
  if (!flag(n, 'plain')) {
    const sz = clamp(m * 0.085, 7, 11);
    const ax = P3(1.22, -1, 0), az = P3(-1, -1, 1.15);
    parts.push(text(ax[0] + 3, ax[1], '$x_1$', sz, TEXT, 'start'), text(az[0], az[1] - sz * 0.75, '$z$', sz, TEXT));
  }
  return parts;
}

// ---------------------------------------------------------------- grid vs random search

function search(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const sx0 = x + 0.26 * w, sy0 = y + 0.26 * h;
  const S = { x0: sx0, y0: sy0, x1: x + w, y1: y + h };
  const X = (u: number) => S.x0 + (S.x1 - S.x0) * u;
  const Y = (v: number) => S.y1 - (S.y1 - S.y0) * v;
  const m = Math.min(w, h);
  const r = clamp(m * 0.032, 1.6, 4.2);
  const lw = clamp(m * 0.016, 1.1, 2.2);
  const random = /rand/.test(n.spec);
  const pts: P2[] = random
    ? sample(rng(1717), 9, () => true, 0.2, [], 0.08, 0.92)
    : [1, 3, 5].flatMap((i) => [1, 3, 5].map((j) => [i / 6, j / 6] as P2));
  // parametro importante (sopra) e poco importante (a sinistra), come in Bergstra & Bengio 2012
  const imp = (u: number) => 0.1 + 0.8 * Math.exp(-(((u - 0.64) / 0.12) ** 2)) + 0.15 * Math.exp(-(((u - 0.24) / 0.09) ** 2));
  const unimp = (v: number) => 0.42 + 0.07 * Math.sin(9 * v) + 0.05 * Math.sin(17 * v + 1);
  const topB = y + 0.21 * h, topH = 0.19 * h;
  const leftB = x + 0.21 * w, leftW = 0.19 * w;
  const topCurve = Array.from({ length: 61 }, (_, i): P2 => [X(i / 60), topB - imp(i / 60) * topH]);
  const leftCurve = Array.from({ length: 61 }, (_, i): P2 => [leftB - unimp(i / 60) * leftW, Y(i / 60)]);
  const parts: Part[] = [
    { kind: 'rect', x: S.x0, y: S.y0, w: S.x1 - S.x0, h: S.y1 - S.y0, r: Math.min(n.radius, 4), fill: n.fill },
    line([...seg([X(0), topB], [X(1), topB]), ...seg([leftB, Y(0)], [leftB, Y(1)])], AXIS, 0.9),
    line(poly(topCurve, false), CLS[2].stroke, lw),
    line(poly(leftCurve, false), CLS[1].stroke, lw),
  ];
  for (const [u, v] of pts) {
    parts.push(disc(X(u), topB - imp(u) * topH, r * 0.8, CLS[2].stroke));
    parts.push(disc(leftB - unimp(v) * leftW, Y(v), r * 0.8, CLS[1].stroke));
    parts.push(marker('o', X(u), Y(v), r, CLS[2]));
  }
  return parts;
}

// ---------------------------------------------------------------- partizione di un albero di decisione

/** Regioni (u0, v0, u1, v1, classe) dell'albero del modello "Albero di decisione". */
export const TREE_REGIONS: [number, number, number, number, number][] = [
  [0, 0, 0.5, 0.6, 0],
  [0, 0.6, 0.5, 1, 1],
  [0.5, 0, 1, 0.35, 1],
  [0.5, 0.35, 0.75, 1, 0],
  [0.75, 0.35, 1, 1, 2],
];

function partition(n: NodeModel): Part[] {
  const p = plotArea(n);
  const parts = panel(n, p, false);
  for (const [a, b, c, d, k] of TREE_REGIONS) {
    const [px, py] = p.P(a, d), [qx, qy] = p.P(c, b);
    parts.push({ kind: 'rect', x: px, y: py, w: qx - px, h: qy - py, r: 0, fill: CLS[k].tint, stroke: 'none' });
  }
  const splits: [P2, P2][] = [[[0.5, 0], [0.5, 1]], [[0, 0.6], [0.5, 0.6]], [[0.5, 0.35], [1, 0.35]], [[0.75, 0.35], [0.75, 1]]];
  parts.push(line(splits.flatMap(([a, b]) => seg(p.P(...a), p.P(...b))), INK, p.lw));
  parts.push(line([['M', p.x0, p.y0], ['L', p.x0, p.y1], ['L', p.x1, p.y1]], AXIS, 0.9));
  for (const [u, v, k] of partitionPoints()) parts.push(marker(MK[k], ...p.P(u, v), p.r, CLS[k]));
  return parts;
}

/** Punti del grafico "Partizione (albero)": [u, v, classe]. Servono anche per i conteggi dell'albero. */
export function partitionPoints(): [number, number, number][] {
  const region = (u: number, v: number) => TREE_REGIONS.find(([a, b, c, d]) => u >= a && u <= c && v >= b && v <= d)![4];
  const near = (u: number, v: number) =>
    Math.abs(u - 0.5) < 0.035 || (u < 0.5 && Math.abs(v - 0.6) < 0.035) || (u > 0.5 && Math.abs(v - 0.35) < 0.035) || (u > 0.5 && v > 0.35 && Math.abs(u - 0.75) < 0.035);
  return sample(rng(1313), 34, (u, v) => !near(u, v), 0.075, [], 0.04, 0.96).map(([u, v]) => [u, v, region(u, v)]);
}

// ---------------------------------------------------------------- AdaBoost con decision stump

/** Esempio giocattolo: [u, v, etichetta ±1]. */
const BOOST: [number, number, number][] = [
  [0.55, 0.84, 1], [0.36, 0.26, 1], [0.93, 0.36, 1], [0.65, 0.74, 1], [0.84, 0.65, 1],
  [0.74, 0.17, -1], [0.07, 0.45, -1], [0.45, 0.07, -1], [0.17, 0.93, -1], [0.26, 0.55, -1],
];

interface Stump {
  axis: 0 | 1;
  thr: number;
  pol: number;
  alpha: number;
  D: number[];
}

const stumpPred = (s: Stump, q: [number, number, number]) => (q[s.axis] > s.thr ? s.pol : -s.pol);

/** AdaBoost vero (Freund & Schapire 1997) con stump assiali: pesi, errori e α calcolati. */
export function adaboost(rounds: number): Stump[] {
  let D = BOOST.map(() => 1 / BOOST.length);
  const out: Stump[] = [];
  for (let t = 0; t < rounds; t++) {
    let best: Omit<Stump, 'alpha' | 'D'> & { err: number } = { axis: 0, thr: 0.5, pol: 1, err: Infinity };
    for (const axis of [0, 1] as const) {
      const vals = [...new Set(BOOST.map((q) => q[axis]))].sort((a, b) => a - b);
      for (let i = 0; i < vals.length - 1; i++) {
        const thr = (vals[i] + vals[i + 1]) / 2;
        for (const pol of [1, -1]) {
          const err = BOOST.reduce((s, q, j) => s + (stumpPred({ axis, thr, pol, alpha: 0, D }, q) !== q[2] ? D[j] : 0), 0);
          if (err < best.err - 1e-9) best = { axis, thr, pol, err };
        }
      }
    }
    const e = clamp(best.err, 1e-6, 1 - 1e-6);
    const s: Stump = { axis: best.axis, thr: best.thr, pol: best.pol, alpha: 0.5 * Math.log((1 - e) / e), D };
    out.push(s);
    const nd = BOOST.map((q, j) => D[j] * Math.exp(-s.alpha * q[2] * stumpPred(s, q)));
    const z = nd.reduce((a, b) => a + b, 0);
    D = nd.map((v) => v / z);
  }
  return out;
}

function stump(n: NodeModel): Part[] {
  const p = plotArea(n);
  const parts = panel(n, p, false);
  const final = /final/.test(n.spec);
  const T = final ? 3 : clamp(Math.round(n.count), 1, 3);
  const hs = adaboost(T);
  const POS = { ...CLS[0] }, NEG = { ...CLS[3] };
  const rect = (u0: number, v0: number, u1: number, v1: number, fill: string, clip?: ClipRect): Part => {
    const [ax, ay] = p.P(u0, v1), [bx, by] = p.P(u1, v0);
    return { kind: 'rect', x: ax, y: ay, w: bx - ax, h: by - ay, r: 0, fill, stroke: 'none', clip };
  };
  let sizes = BOOST.map(() => 1);
  if (final) {
    const us = [0, ...hs.filter((s) => s.axis === 0).map((s) => s.thr).sort(), 1];
    const vs = [0, ...hs.filter((s) => s.axis === 1).map((s) => s.thr).sort(), 1];
    parts.push(rect(0, 0, 1, 1, NEG.tint));
    for (let i = 0; i < us.length - 1; i++)
      for (let j = 0; j < vs.length - 1; j++) {
        const q: [number, number, number] = [(us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2, 0];
        const F = hs.reduce((s, h) => s + h.alpha * stumpPred(h, q), 0);
        // celle leggermente sovrapposte: niente filo chiaro fra due celle dello stesso colore
        if (F > 0) parts.push(rect(us[i] - 0.004, vs[j] - 0.004, us[i + 1] + 0.004, vs[j + 1] + 0.004, POS.tint, p.clip));
      }
  } else {
    const s = hs[T - 1];
    const hi = s.pol > 0 ? POS.tint : NEG.tint, lo = s.pol > 0 ? NEG.tint : POS.tint;
    if (s.axis === 0) parts.push(rect(0, 0, s.thr, 1, lo), rect(s.thr, 0, 1, 1, hi));
    else parts.push(rect(0, 0, 1, s.thr, lo), rect(0, s.thr, 1, 1, hi));
    const a = s.axis === 0 ? p.P(s.thr, 0) : p.P(0, s.thr), b = s.axis === 0 ? p.P(s.thr, 1) : p.P(1, s.thr);
    parts.push(line(seg(a, b), INK, p.lw));
    // area del marcatore proporzionale al peso D_t(i) (pesi uniformi → dimensione 1)
    sizes = s.D.map((d) => clamp(Math.sqrt(d * BOOST.length), 0.55, 2.2));
  }
  parts.push(line([['M', p.x0, p.y0], ['L', p.x0, p.y1], ['L', p.x1, p.y1]], AXIS, 0.9));
  BOOST.forEach((q, i) => {
    const c = q[2] > 0 ? POS : NEG;
    parts.push(marker(q[2] > 0 ? '+' : '-', ...p.P(q[0], q[1]), p.r * 1.5 * sizes[i], c));
  });
  return parts;
}

// ---------------------------------------------------------------- distribuzioni e soglia

function threshold(n: NodeModel): Part[] {
  const p = plotArea(n, { l: 0.06, r: 0.04, t: 0.08, b: 0.12 });
  const parts = panel(n, p, false);
  const pdf = (mu: number) => (u: number) => 0.88 * Math.exp(-(((u - mu) / 0.13) ** 2) / 2);
  const neg = pdf(0.36), pos = pdf(0.64);
  const t = 0.5;
  const dl = dashLen(p);
  parts.push(
    area(poly([p.P(t, 0), ...curve(p, neg, t, 1, 40), p.P(1, 0)]), CLS[0].fill),
    area(poly([p.P(0, 0), ...curve(p, pos, 0, t, 40), p.P(t, 0)]), CLS[1].fill),
    line(poly(curve(p, neg, 0, 1, 80), false), CLS[0].stroke, p.lw * 1.1),
    line(poly(curve(p, pos, 0, 1, 80), false), CLS[1].stroke, p.lw * 1.1),
    line(dashes([p.P(t, 0), p.P(t, 1.04)], dl, dl * 0.7), INK, 1),
    line(seg([p.x0 - 2, p.y1], [p.x1 + 2, p.y1]), AXIS, 0.9),
  );
  // aree d'errore e soglia: FN a sinistra (positivi scartati), FP a destra (negativi accettati)
  if (!flag(n, 'plain')) {
    const sz = clamp(Math.min(n.w, n.h) * 0.11, 6.5, 10);
    const dx = sz + 2;
    parts.push(
      text(p.X(t) - dx, p.Y(0) - sz * 0.85, 'FN', sz, '#8A4A00', 'middle', true),
      text(p.X(t) + dx, p.Y(0) - sz * 0.85, 'FP', sz, '#1F4E8C', 'middle', true),
      text(p.X(t) + 3, p.Y(1.0), '$\\tau$', sz * 1.15, INK, 'start'),
    );
  }
  return parts;
}

export const PLOT_SHAPES: ShapeDef[] = [
  { kind: 'ml-svm', name: 'SVM (margine massimo)', parts: svm },
  {
    kind: 'ml-boundary', name: 'Frontiera di decisione', parts: boundary, specLabel: 'Tipo',
    specOptions: [{ title: 'Frontiera', choices: [{ value: 'curved', label: 'Curva' }, { value: 'linear', label: 'Lineare' }, { value: 'over', label: 'Overfit' }, { value: 'circle', label: 'Circolare' }, { value: 'rings', label: 'Solo dati' }] }],
  },
  {
    kind: 'ml-kmeans', name: 'k-means', parts: kmeans, countLabel: 'Cluster (k)', countMax: 6, specLabel: 'Fase',
    specOptions: [{ title: 'Fase', choices: [{ value: 'final', label: 'Finale' }, { value: 'voronoi', label: 'Voronoi' }, { value: 'raw', label: 'Solo dati' }, { value: 'init', label: 'Inizializza' }, { value: 'assign', label: 'Assegna' }, { value: 'update', label: 'Aggiorna' }] }],
  },
  { kind: 'ml-pca', name: 'PCA (assi principali)', parts: pca, specLabel: 'Varianti', specOptions: [{ mode: 'many', choices: [{ value: 'proj', label: 'Proiezioni su PC1' }] }] },
  {
    kind: 'ml-regression', name: 'Regressione', parts: regression, countLabel: 'Punti (lineare)', countMax: 40, specLabel: 'Modello',
    specOptions: [{ title: 'Modello', choices: [{ value: 'linear', label: 'Lineare' }, { value: 'under', label: 'Underfit (M=1)' }, { value: 'good', label: 'Buon fit (M=3)' }, { value: 'over', label: 'Overfit (M=9)' }] }],
  },
  { kind: 'ml-logistic', name: 'Regressione logistica', parts: logistic },
  { kind: 'ml-knn', name: 'k-nearest neighbors', parts: knn, countLabel: 'Vicini (k)', countMax: 15 },
  {
    kind: 'ml-roc', name: 'Curva ROC', parts: roc, countLabel: 'Curve', countMax: 4, specLabel: 'Varianti',
    specOptions: [{ mode: 'many', choices: [{ value: 'step', label: 'Empirica (gradini)' }] }, PLAIN],
  },
  { kind: 'ml-pr', name: 'Curva precision–recall', parts: prCurve, countLabel: 'Curve', countMax: 4, specLabel: 'Varianti', specOptions: [PLAIN] },
  {
    kind: 'ml-learning', name: 'Curve di apprendimento', parts: learning, specLabel: 'Asse x',
    specOptions: [{ title: 'Asse x', choices: [{ value: 'size', label: 'Dimensione del train' }, { value: 'epochs', label: 'Epoche' }] }, PLAIN],
  },
  {
    kind: 'ml-biasvar', name: 'Bias–varianza', parts: biasVariance, specLabel: 'Curve',
    specOptions: [{ title: 'Curve', choices: [{ value: 'decomp', label: 'Bias² + varianza' }, { value: 'error', label: 'Errore train/test' }] }, PLAIN],
  },
  { kind: 'ml-elbow', name: 'Metodo del gomito', parts: elbow, countLabel: 'Valori di k', countMax: 12, specLabel: 'Varianti', specOptions: [PLAIN] },
  { kind: 'ml-gmm', name: 'Miscela di gaussiane', parts: gmm, countLabel: 'Componenti', countMax: 4 },
  { kind: 'ml-lift', name: 'Spazio delle feature 3D', parts: lift, specLabel: 'Varianti', specOptions: [PLAIN] },
  {
    kind: 'ml-search', name: 'Grid / random search', parts: search, specLabel: 'Strategia',
    specOptions: [{ title: 'Strategia', choices: [{ value: 'grid', label: 'Griglia' }, { value: 'random', label: 'Casuale' }] }],
  },
  { kind: 'ml-partition', name: 'Partizione (albero)', parts: partition },
  {
    kind: 'ml-stump', name: 'AdaBoost (stump)', parts: stump, countLabel: 'Round', countMax: 3, specLabel: 'Varianti',
    specOptions: [{ mode: 'many', choices: [{ value: 'final', label: 'Classificatore finale' }] }],
  },
  { kind: 'ml-threshold', name: 'Distribuzioni e soglia', parts: threshold, specLabel: 'Varianti', specOptions: [PLAIN] },
];
