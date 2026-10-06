// Approfondimenti ML: primitive vettoriali deterministiche, senza immagini o dati remoti.
// Le figure sono schemi didattici; non rappresentano risultati di un esperimento.
import { poly, rng, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';
import {
  AXIS, CLS, PLAIN, area, arrow, axisNames, band, clamp, curve, dashes,
  disc, flag, labeledArea, line, marker, panel, seg, text, type P2,
} from './ml-kit';

type N = NodeModel;
const C = ['#DAE8FC', '#FFE6CC', '#D5E8D4', '#E1D5E7', '#F8CECC'];
const S = ['#6C8EBF', '#D79B00', '#82B366', '#9673A6', '#B85450'];
const count = (n: N, lo: number, hi: number) => clamp(Math.round(n.count), lo, hi);
const mode = (n: N, choices: string[]) => choices.find((s) => flag(n, s)) ?? choices[0];
const box = (x: number, y: number, w: number, h: number, fill = '#FFFFFF', stroke = '#AEB8C5', r = 2): Part =>
  ({ kind: 'rect', x, y, w, h, r, fill, stroke, sw: 0.8, solid: true });
const one = (title: string, choices: [string, string][]): SpecGroup =>
  ({ title, mode: 'one', choices: choices.map(([value, label]) => ({ value, label })) });
const opt = (n: N, x: number, y: number, value: string, size = 8): Part[] =>
  flag(n, 'plain') ? [] : [text(x, y, value, size)];

// Tabelle di trasformazione: la semantica è nel contenuto, non soltanto nel titolo.
function preprocessing(n: N): Part[] {
  const m = mode(n, ['missing', 'imputed', 'onehot', 'ordinal', 'indicator', 'columns', 'encoded', 'categorical']);
  const rows = count(n, 3, 8), cols = m === 'ordinal' ? 2 : m === 'categorical' ? 3 : m === 'encoded' ? 6 : m === 'columns' ? 5 : 4;
  const p: Part[] = [];
  const cw = n.w / cols, ch = n.h / (rows + 1);
  for (let c = 0; c < cols; c++) {
    const tint = m === 'columns' ? C[c < 2 ? 0 : c < 4 ? 1 : 2] : C[0];
    p.push(box(n.x + c * cw, n.y, cw, ch, tint));
    const head = m === 'onehot' ? ['cat', 'A', 'B', 'C'][c] : m === 'encoded' ? ['$x_1$', '$x_2$', 'A', 'B', 'C', '$x_3$'][c] : m === 'categorical' ? `$c_${c + 1}$` : m === 'ordinal' ? ['size', 'rank'][c] : m === 'indicator' && c >= 2 ? `$m_${c - 1}$` : m === 'columns' && c >= 2 ? ['$c_1$', '$c_2$', '$x_3$'][c - 2] : `$x_{${c + 1}}$`;
    p.push(...opt(n, n.x + (c + 0.5) * cw, n.y + ch / 2, head, clamp(ch * 0.55, 6, 10)));
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const missing = (r * 5 + c * 3) % 7 === 1;
    let value = String((r + c * 2) % 9 + 1), fill = '#FFFFFF';
    if (m === 'onehot') { value = c === 0 ? ['A', 'B', 'C'][r % 3] : c - 1 === r % 3 ? '1' : '0'; fill = c > 0 && c - 1 === r % 3 ? C[2] : '#FFFFFF'; }
    else if (m === 'encoded') { value = c >= 2 && c <= 4 ? c - 2 === r % 3 ? '1' : '0' : ((r - 2) * 0.5).toFixed(1); fill = c >= 2 && c <= 4 ? C[2] : C[0]; }
    else if (m === 'categorical') { value = missing ? '?' : ['A', 'B', 'C'][(r + c) % 3]; fill = missing ? C[4] : C[1]; }
    else if (m === 'ordinal') { value = c === 0 ? ['S', 'M', 'L'][r % 3] : String(r % 3); fill = c === 0 ? C[1] : C[0]; }
    else if (m === 'indicator' && c >= 2) { const absent = (r * 5 + (c - 2) * 3) % 7 === 1; value = absent ? '1' : '0'; fill = absent ? C[1] : '#FFFFFF'; }
    else if (m === 'indicator' && missing) { value = '?'; fill = C[4]; }
    else if (m === 'missing' && missing) { value = '?'; fill = C[4]; }
    else if (m === 'imputed' && missing) {
      const observed = Array.from({ length: rows }, (_, row) => row).filter(row => (row * 5 + c * 3) % 7 !== 1).map(row => (row + c * 2) % 9 + 1).sort((a, b) => a - b);
      const mid = Math.floor(observed.length / 2);
      value = String(observed.length % 2 ? observed[mid] : (observed[mid - 1] + observed[mid]) / 2); fill = C[2];
    }
    else if (m === 'columns') { fill = C[c < 2 ? 0 : c < 4 ? 1 : 2]; if (c === 2 || c === 3) value = ['A', 'B', 'C'][(r + c) % 3]; }
    p.push(box(n.x + c * cw, n.y + (r + 1) * ch, cw, ch, fill));
    p.push(...opt(n, n.x + (c + 0.5) * cw, n.y + (r + 1.5) * ch, value, clamp(ch * 0.55, 6, 10)));
  }
  return p;
}

// Prima/dopo: centrare e riscalare cambia le unità, non la forma della distribuzione.
function scaling(n: N): Part[] {
  const m = mode(n, ['standard', 'robust', 'quantile', 'power']);
  const p: Part[] = [];
  const W = n.w * 0.4, H = n.h * 0.67, top = n.y + n.h * 0.08;
  const raw = [0.13, 0.72, 1, 0.76, 0.44, 0.26, 0.17, 0.1];
  const output = m === 'quantile' ? raw.map(() => 0.66) : m === 'power' ? [0.1, 0.32, 0.68, 1, 0.93, 0.63, 0.3, 0.09] : raw;
  [raw, output].forEach((heights, side) => {
    const x = n.x + n.w * (side ? 0.59 : 0.01), y = top + H;
    p.push(line([['M', x, top], ['L', x, y], ['L', x + W, y]], AXIS, 0.8));
    heights.forEach((v, i) => p.push(box(x + (i + 0.15) * W / 8, y - v * H * 0.88, W / 8 * 0.72, v * H * 0.88, C[side ? 2 : 0], S[side ? 2 : 0], 0)));
    if (side && (m === 'standard' || m === 'robust')) {
      const center = x + W * (m === 'standard' ? 0.39 : 0.33), span = W * (m === 'standard' ? 0.25 : 0.14), yy = top + H * 0.03;
      p.push(line(seg([center, yy], [center, y]), m === 'standard' ? S[0] : S[3], 1));
      p.push(...arrow([center - span, yy], [center + span, yy], m === 'standard' ? S[0] : S[3], 0.8, 3, true));
    }
    p.push(...opt(n, x + W / 2, y + n.h * 0.12, side ? m === 'standard' ? '$\\mu=0,\\sigma=1$' : m === 'robust' ? 'median / IQR' : m === 'quantile' ? 'uniform' : 'power transform' : 'original scale', clamp(n.h * 0.09, 7, 10)));
  });
  p.push(...arrow([n.x + n.w * 0.44, top + H * 0.48], [n.x + n.w * 0.55, top + H * 0.48], '#5B6B80', 1, 4));
  return p;
}

function selection(n: N): Part[] {
  const m = mode(n, ['variance', 'correlation', 'rfe', 'permutation']);
  const k = count(n, 3, 9), p: Part[] = [];
  if (m === 'correlation') {
    const cell = Math.min(n.w, n.h) / k, x = n.x + (n.w - k * cell) / 2;
    for (let r = 0; r < k; r++) for (let c = 0; c < k; c++) {
      const hot = r === c || (r < 2 && c < 2), v = hot ? 0 : (r + c) % 4;
      p.push(box(x + c * cell, n.y + r * cell, cell, cell, hot ? '#8FB4E3' : ['#F1F5FA', '#E6EFF8', '#FFF1DF', '#FAF7F2'][v], '#FFFFFF', 0));
    }
    p.push(box(x, n.y, cell * 2, cell * 2, 'none', '#C0392B', 0));
  } else if (m === 'rfe') {
    for (let r = 0; r < 4; r++) {
      const left = Math.max(1, k - r * 2), cw = n.w * 0.72 / k, yy = n.y + r * n.h * 0.25;
      for (let c = 0; c < k; c++) p.push(box(n.x + c * cw, yy, cw * 0.82, n.h * 0.15, c < left ? C[0] : '#F4F5F7', c < left ? S[0] : '#E0E3E8'));
      p.push(...opt(n, n.x + n.w * 0.86, yy + n.h * 0.075, `${left} / ${k}`, 9));
      if (r < 3) p.push(...arrow([n.x + n.w * 0.32, yy + n.h * 0.17], [n.x + n.w * 0.32, yy + n.h * 0.235], '#8290A1', 0.7, 3));
    }
  } else {
    const h = n.h * 0.72, slot = n.w / k;
    p.push(line(seg([n.x, n.y + h], [n.x + n.w, n.y + h]), AXIS, 0.8));
    for (let c = 0; c < k; c++) {
      const v = m === 'variance' ? [0.08, 0.72, 0.88, 0.12, 0.56, 0.34, 0.79, 0.06, 0.53][c] : 0.85 * Math.exp(-c * 0.43);
      p.push(box(n.x + slot * (c + 0.18), n.y + h * (1 - v), slot * 0.64, h * v, v < 0.2 ? C[4] : C[0], v < 0.2 ? S[4] : S[0], 0));
    }
    if (m === 'variance') p.push(line(dashes([[n.x, n.y + h * 0.8], [n.x + n.w, n.y + h * 0.8]], 3, 2), '#C0392B', 1));
    p.push(...opt(n, n.x + n.w / 2, n.y + n.h * 0.9, m === 'variance' ? 'variance threshold' : 'score drop after shuffle', 8));
  }
  return p;
}

function validation(n: N): Part[] {
  const m = mode(n, ['group', 'stratified', 'nested', 'bootstrap', 'oob']);
  const k = count(n, 3, 6), p: Part[] = [];
  if (m === 'bootstrap' || m === 'oob') {
    const seq = m === 'bootstrap' ? [1, 2, 2, 4, 1, 6] : [3, 5];
    for (let r = 0; r < 2; r++) {
      const nums = r ? seq : [1, 2, 3, 4, 5, 6];
      const cw = n.w / 6;
      nums.forEach((v, i) => { const hot = m === 'oob' && r === 0 && seq.includes(v); p.push(box(n.x + i * cw, n.y + r * n.h * 0.65, cw * 0.85, n.h * 0.25, r ? C[m === 'oob' ? 2 : 0] : hot ? C[2] : '#F3F5F8')); p.push(...opt(n, n.x + (i + 0.425) * cw, n.y + (r * 0.65 + 0.125) * n.h, String(v), 9)); });
    }
    p.push(...arrow([n.x + n.w * 0.48, n.y + n.h * 0.3], [n.x + n.w * 0.48, n.y + n.h * 0.58], '#778599', 1, 4));
    return p;
  }
  const row = n.h / k, cw = n.w / k;
  for (let r = 0; r < k; r++) for (let c = 0; c < k; c++) {
    const x = n.x + c * cw, y = n.y + r * row;
    p.push(box(x, y, cw * 0.9, row * 0.73, C[c === r ? 1 : 0], S[c === r ? 1 : 0], 1));
    if (m === 'stratified') { p.push(box(x + cw * 0.08, y + row * 0.42, cw * 0.74, row * 0.19, C[3], S[3], 0)); }
    else if (m === 'nested' && c !== r) {
      for (let z = 0; z < 3; z++) p.push(box(x + cw * (0.07 + z * 0.26), y + row * 0.2, cw * 0.2, row * 0.34, C[z === (r + c) % 3 ? 2 : 0], S[0], 0));
    } else if (m === 'group') p.push(...opt(n, x + cw * 0.45, y + row * 0.36, `G${c + 1}`, clamp(row * 0.3, 6, 9)));
  }
  return p;
}

function diagnostics(n: N): Part[] {
  const m = mode(n, ['residual', 'hetero', 'qq', 'quantile']);
  const a = labeledArea(n), p = panel(n, a), k = count(n, 8, 28), rand = rng(1981);
  if (m === 'qq') {
    p.push(line(seg(a.P(0.06, 0.06), a.P(0.94, 0.94)), '#E0A352', 1));
    for (let i = 0; i < k; i++) { const u = (i + 1) / (k + 1); p.push(disc(...a.P(u, clamp(u + 0.045 * Math.sin(i * 1.7), 0.02, 0.98)), 1.5, CLS[0].fill, CLS[0].stroke)); }
    p.push(...axisNames(n, a, 'normal quantile', 'sample quantile'));
  } else if (m === 'quantile') {
    for (const [j, q] of [0.1, 0.5, 0.9].entries()) {
      p.push(line(poly(curve(a, u => 0.18 + 0.4 * u + (q - 0.5) * (0.3 + u * 0.25)), false), S[j], 1.2));
      p.push(...opt(n, a.X(0.83), a.Y(0.18 + 0.4 * 0.83 + (q - 0.5) * (0.3 + 0.83 * 0.25)) - 5, `$q=${q}$`, 6.5));
    }
    for (let i = 0; i < k; i++) { const u = rand(), v = 0.18 + 0.4 * u + (rand() - 0.5) * (0.3 + u * 0.25); p.push(disc(...a.P(u, v), 1.2, '#A2ACB9')); }
    p.push(...axisNames(n, a, '$x$', '$y$'));
  } else {
    p.push(line(dashes([a.P(0, 0.5), a.P(1, 0.5)], 3, 2), '#A6AFBB', 0.8));
    for (let i = 0; i < k; i++) {
      const u = (i + 0.5) / k, e = (rand() - 0.5) * (m === 'hetero' ? 0.13 + u * 0.75 : 0.45);
      p.push(disc(...a.P(u, 0.5 + e), 1.7, CLS[0].fill, CLS[0].stroke));
    }
    p.push(...axisNames(n, a, '$\\hat{y}$', '$y-\\hat{y}$'));
  }
  return p;
}

function discriminant(n: N): Part[] {
  const m = mode(n, ['lda', 'qda', 'naive', 'svr']);
  const a = labeledArea(n), p = panel(n, a), k = count(n, 12, 36), rand = rng(914);
  if (m === 'naive') {
    const top: P2 = [n.x + n.w / 2, n.y + n.h * 0.18];
    const out: Part[] = [];
    for (let i = 0; i < 3; i++) {
      const q: P2 = [n.x + n.w * (0.18 + i * 0.32), n.y + n.h * 0.75];
      out.push(...arrow([top[0], top[1] + n.h * 0.1], [q[0], q[1] - n.h * 0.1], '#75859A', 1, 4));
      out.push(disc(...q, n.h * 0.1, C[0], S[0]), ...opt(n, ...q, `$x_${i + 1}$`, 9));
    }
    out.push(disc(...top, n.h * 0.12, C[1], S[1]), ...opt(n, ...top, '$y$', 10));
    return out;
  }
  if (m === 'svr') {
    const f = (u: number) => 0.25 + u * 0.52;
    p.push(area(band(a, u => f(u) - 0.12, u => f(u) + 0.12), '#E8F0FA'));
    p.push(line(poly(curve(a, f), false), S[0], 1.3));
    for (const d of [-0.12, 0.12]) p.push(line(dashes(curve(a, u => f(u) + d), 3, 2), S[0], 0.8));
    for (let i = 0; i < k; i++) { const u = (i + 0.5) / k, e = (rand() - 0.5) * 0.44; p.push(disc(...a.P(u, f(u) + e), 1.5, Math.abs(e) > 0.12 ? C[1] : C[0], Math.abs(e) > 0.12 ? S[1] : S[0])); }
    p.push(...axisNames(n, a, '$x$', '$y$'));
    return p;
  }
  const boundary = (u: number) => m === 'lda' ? 0.82 - 0.64 * u : 0.25 + 1.3 * (u - 0.28) ** 2;
  const points = curve(a, boundary);
  p.push(area(poly([a.P(0, 0), a.P(1, 0), ...points.slice().reverse()]), CLS[0].tint));
  p.push(area(poly([a.P(0, 1), a.P(1, 1), ...points.slice().reverse()]), CLS[1].tint));
  p.push(line(poly(points, false), '#596B80', 1.1));
  for (let i = 0; i < k; i++) { const u = 0.07 + rand() * 0.86, v = 0.07 + rand() * 0.86, c = v > boundary(u) ? 1 : 0; p.push(marker(c ? 's' : 'o', ...a.P(u, v), 1.9, CLS[c])); }
  p.push(...axisNames(n, a, '$x_1$', '$x_2$'));
  return p;
}

/** Due lune non convesse; rumore separato e geometria deterministica. */
function density(n: N): Part[] {
  const m = mode(n, ['dbscan', 'reachability', 'spectral', 'meanshift']);
  const a = labeledArea(n), p = panel(n, a), k = count(n, 20, 72);
  if (m === 'reachability') {
    for (let i = 0; i < k; i++) {
      const cluster = i < k * 0.44 || i > k * 0.56, v = cluster ? 0.13 + Math.abs(Math.sin(i * 0.83)) * 0.18 : 0.72 + 0.17 * Math.sin(i * 1.1) ** 2;
      p.push(box(a.X(i / k), a.Y(v), (a.x1 - a.x0) / k * 0.82, a.Y(0) - a.Y(v), cluster ? C[i < k / 2 ? 0 : 1] : '#D7DDE5', 'none', 0));
    }
    p.push(...axisNames(n, a, 'ordering', 'reachability'));
    return p;
  }
  const points: { q: P2; c: number }[] = [], rand = rng(412);
  for (let i = 0; i < k; i++) {
    const c = i % 2, t = (Math.floor(i / 2) + 0.4) / Math.ceil(k / 2) * Math.PI;
    const u = m === 'meanshift' ? (c ? 0.69 : 0.3) + (rand() - 0.5) * 0.25 : c ? 0.58 + 0.31 * Math.cos(t) : 0.4 + 0.31 * Math.cos(t);
    const v = m === 'meanshift' ? (c ? 0.32 : 0.71) + (rand() - 0.5) * 0.26 : c ? 0.52 - 0.29 * Math.sin(t) : 0.5 + 0.29 * Math.sin(t);
    points.push({ q: a.P(u, v), c });
  }
  if (m === 'spectral') points.forEach((v, i) => points.slice(i + 1).forEach(w => {
    if (v.c === w.c && Math.hypot(v.q[0] - w.q[0], v.q[1] - w.q[1]) < a.s * 0.2) p.push(line(seg(v.q, w.q), '#B1BECE', 0.7));
  }));
  if (m === 'meanshift') {
    const centers: P2[] = [a.P(0.3, 0.71), a.P(0.69, 0.32)];
    points.filter((_, i) => i % 6 === 0).forEach(v => p.push(...arrow(v.q, centers[v.c], S[v.c], 0.7, 3)));
    centers.forEach((q, c) => p.push(marker('+', ...q, 4, CLS[c])));
  }
  points.forEach((v, i) => p.push(disc(...v.q, i % 9 === 0 && m === 'dbscan' ? 2.5 : 1.6, CLS[v.c].fill, CLS[v.c].stroke, 0.6)));
  if (m === 'dbscan') {
    const q = points[8].q; p.push({ kind: 'ellipse', cx: q[0], cy: q[1], rx: a.s * 0.15, ry: a.s * 0.15, fill: 'none', stroke: S[0], sw: 0.8 });
    [[0.12, 0.13], [0.83, 0.89], [0.18, 0.92]].forEach(q => p.push(marker('x', ...a.P(q[0], q[1]), 2, { fill: 'none', stroke: '#8A929E' })));
  }
  p.push(...axisNames(n, a, '$x_1$', '$x_2$'));
  return p;
}

function calibration(n: N): Part[] {
  const m = mode(n, ['reliable', 'over', 'under', 'isotonic']);
  const a = labeledArea(n), p = panel(n, a), k = count(n, 4, 12);
  p.push(line(dashes([a.P(0, 0), a.P(1, 1)], 3, 2), '#A0AAB7', 0.8));
  const pts: P2[] = [];
  for (let i = 0; i <= k; i++) {
    const u = i / k, v = m === 'over' ? 0.15 + 0.7 * u : m === 'under' ? clamp(1.4 * u - 0.2, 0, 1) : clamp(u + 0.035 * Math.sin(i * 1.6), 0, 1);
    if (m === 'isotonic' && i > 0) pts.push(a.P(u, Math.floor((i - 1) / 2) * 2 / k));
    pts.push(a.P(u, m === 'isotonic' ? Math.floor(i / 2) * 2 / k : v));
    if (m !== 'isotonic') p.push(disc(...a.P(u, v), 1.8, C[0], S[0]));
  }
  p.push(line(poly(pts, false), S[0], 1.3));
  p.push(...axisNames(n, a, m === 'isotonic' ? 'raw score' : 'mean predicted p', m === 'isotonic' ? 'calibrated p' : 'fraction positive'));
  return p;
}

function uncertainty(n: N): Part[] {
  const m = mode(n, ['intervals', 'set', 'coverage', 'scores']);
  const a = labeledArea(n), p = panel(n, a), k = count(n, 5, 12);
  if (m === 'set') {
    const out: Part[] = [], cols = 4, cw = n.w / cols, rh = n.h / 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
      const include = c === r || (r === 1 && c === 2);
      out.push(box(n.x + c * cw, n.y + r * rh, cw * 0.86, rh * 0.77, include ? C[0] : '#F4F6F9', include ? S[0] : '#D9DFE8'));
      out.push(...opt(n, n.x + (c + 0.43) * cw, n.y + (r + 0.38) * rh, ['A', 'B', 'C', 'D'][c], 9));
    }
    return out;
  }
  if (m === 'coverage') {
    p.push(line(dashes([a.P(0, 0.9), a.P(1, 0.9)], 3, 2), S[1], 1));
    for (let i = 0; i < k; i++) { const v = 0.88 + 0.07 * Math.sin(i * 1.9) ** 2; p.push(disc(...a.P((i + 0.5) / k, v), 2, C[0], S[0])); }
    p.push(...axisNames(n, a, 'repetitions', 'test coverage'));
  } else if (m === 'scores') {
    for (let i = 0; i < k; i++) { const v = 0.15 + 0.7 * (i / k) ** 1.5; p.push(box(a.X(i / k), a.Y(v), (a.x1 - a.x0) / k * 0.7, a.Y(0) - a.Y(v), i >= k - 2 ? C[1] : C[0], 'none', 0)); }
    p.push(line(dashes([a.P(0, 0.67), a.P(1, 0.67)], 3, 2), S[1], 1));
    p.push(...axisNames(n, a, 'sorted calibration i', '$|y_i-\\hat{y}_i|$'));
  } else {
    for (let i = 0; i < k; i++) {
      const u = (i + 0.5) / k, v = 0.27 + 0.44 * u + 0.08 * Math.sin(i), half = 0.16;
      p.push(line(seg(a.P(u, v - half), a.P(u, v + half)), S[0], 1.5));
      for (const d of [-half, half]) p.push(line(seg(a.P(u - 0.02, v + d), a.P(u + 0.02, v + d)), S[0], 1));
      p.push(disc(...a.P(u, v + (i === 2 ? 0.23 : 0.06 * Math.cos(i * 2))), 2, i === 2 ? C[4] : C[0], i === 2 ? S[4] : S[0]));
    }
    p.push(...axisNames(n, a, 'test sample', 'prediction interval'));
  }
  return p;
}

function ensemble(n: N): Part[] {
  const m = mode(n, ['gradient', 'softvote', 'weights', 'diversity']);
  const k = count(n, 3, 6), p: Part[] = [];
  if (m === 'diversity') {
    const cw = n.w / k, rh = n.h / (k + 1);
    for (let c = 0; c < k; c++) for (let r = 0; r <= k; r++) {
      const wrong = (r * 3 + c * 2) % 7 < 2;
      p.push(box(n.x + c * cw, n.y + r * rh, cw * 0.87, rh * 0.78, wrong ? C[4] : C[2], wrong ? S[4] : S[2], 0));
    }
    return p;
  }
  if (m === 'weights') {
    for (let r = 0; r < k; r++) {
      const yy = n.y + (r + 0.5) * n.h / k;
      p.push(...opt(n, n.x + n.w * 0.1, yy, `$h_${r + 1}$`, 9));
      p.push(box(n.x + n.w * 0.23, yy - n.h / k * 0.23, n.w * (0.6 / (1 + r * 0.6)), n.h / k * 0.46, C[r % C.length], S[r % S.length]));
    }
    return p;
  }
  if (m === 'softvote') {
    for (let r = 0; r < k; r++) {
      const yy = n.y + r * n.h / (k + 1), probs = [0.6 - r * 0.055, 0.25 + r * 0.025, 0.15 + r * 0.03];
      let x = n.x;
      probs.forEach((v, j) => { p.push(box(x, yy, n.w * 0.6 * v, n.h / (k + 1) * 0.68, C[j], S[j], 0)); x += n.w * 0.6 * v; });
    }
    p.push(...arrow([n.x + n.w * 0.65, n.y + n.h * 0.35], [n.x + n.w * 0.82, n.y + n.h * 0.35], '#7E8A9B', 1, 4));
    p.push(disc(n.x + n.w * 0.92, n.y + n.h * 0.35, n.w * 0.07, C[0], S[0]));
    p.push(...opt(n, n.x + n.w * 0.5, n.y + n.h * 0.93, 'average probabilities', 8));
    return p;
  }
  const a = labeledArea(n); p.push(...panel(n, a));
  const truth = (u: number) => 0.4 + 0.25 * Math.sin(u * Math.PI * 1.7);
  p.push(line(poly(curve(a, truth), false), '#92A0B2', 0.9));
  for (let stage = 0; stage < k; stage++) {
    const fit = (u: number) => 0.4 + (truth(Math.floor(u * (stage + 2)) / (stage + 2)) - 0.4) * (stage + 1) / k;
    p.push(line(poly(curve(a, fit, 0, 1, 120), false), S[stage % S.length], 0.9 + stage * 0.12));
  }
  p.push(...axisNames(n, a, '$x$', 'additive tree fits'));
  return p;
}

export const MLX_SHAPES: ShapeDef[] = [
  { kind: 'mlx-preprocess', name: 'Preparazione dati ML', parts: preprocessing, countLabel: 'Righe', countMax: 8, specLabel: 'Operazione', specOptions: [one('Operazione', [['missing','Dati mancanti'],['imputed','Imputazione'],['onehot','One-hot'],['ordinal','Ordinale'],['indicator','Indicatore NA'],['columns','Colonne miste'],['encoded','Matrice trasformata'],['categorical','Colonne categoriche']]), PLAIN] },
  { kind: 'mlx-scale', name: 'Trasformazione distribuzione', parts: scaling, specLabel: 'Trasformazione', specOptions: [one('Trasformazione', [['standard','Standard'],['robust','Robusta'],['quantile','Quantili'],['power','Potenza']]), PLAIN] },
  { kind: 'mlx-select', name: 'Selezione feature ML', parts: selection, countLabel: 'Feature', countMax: 9, specLabel: 'Metodo', specOptions: [one('Metodo', [['variance','Varianza'],['correlation','Correlazione'],['rfe','RFE'],['permutation','Permutazione']]), PLAIN] },
  { kind: 'mlx-validation', name: 'Validazione avanzata', parts: validation, countLabel: 'Fold', countMax: 6, specLabel: 'Strategia', specOptions: [one('Strategia', [['group','Gruppi'],['stratified','Stratificata'],['nested','Annidata'],['bootstrap','Bootstrap'],['oob','Out-of-bag']]), PLAIN] },
  { kind: 'mlx-diagnostics', name: 'Diagnostica regressione', parts: diagnostics, countLabel: 'Campioni', countMax: 28, specLabel: 'Grafico', specOptions: [one('Grafico', [['residual','Residui'],['hetero','Eteroschedasticità'],['qq','Q-Q'],['quantile','Regressione quantile']]), PLAIN] },
  { kind: 'mlx-discriminant', name: 'Modelli classici ML', parts: discriminant, countLabel: 'Campioni', countMax: 36, specLabel: 'Modello', specOptions: [one('Modello', [['lda','LDA'],['qda','QDA'],['naive','Naive Bayes'],['svr','SVR epsilon']]), PLAIN] },
  { kind: 'mlx-density', name: 'Clustering per densità', parts: density, countLabel: 'Campioni', countMax: 72, specLabel: 'Metodo', specOptions: [one('Metodo', [['dbscan','DBSCAN'],['reachability','OPTICS'],['spectral','Grafo spettrale'],['meanshift','Mean shift']]), PLAIN] },
  { kind: 'mlx-calibration', name: 'Calibrazione probabilità', parts: calibration, countLabel: 'Bin', countMax: 12, specLabel: 'Curva', specOptions: [one('Curva', [['reliable','Calibrato'],['over','Sovraconfidente'],['under','Sottoconfidente'],['isotonic','Isotonica']]), PLAIN] },
  { kind: 'mlx-uncertainty', name: 'Incertezza predittiva', parts: uncertainty, countLabel: 'Campioni', countMax: 12, specLabel: 'Vista', specOptions: [one('Vista', [['intervals','Intervalli'],['set','Set di classi'],['coverage','Copertura'],['scores','Score calibrazione']]), PLAIN] },
  { kind: 'mlx-ensemble', name: 'Diagnostica ensemble', parts: ensemble, countLabel: 'Modelli / stadi', countMax: 6, specLabel: 'Vista', specOptions: [one('Vista', [['gradient','Gradient boosting'],['softvote','Soft voting'],['weights','Pesi'],['diversity','Diversità errori']]), PLAIN] },
];
