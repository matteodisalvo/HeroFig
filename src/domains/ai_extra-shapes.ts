// Editable native schematics for retrieval, reinforcement learning, vision and generation.
// Values shown in plots are deterministic illustrative examples, not benchmark measurements.
import { mix, poly, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';

type XY = [number, number];
const C = { blue: '#DAE8FC', bs: '#6C8EBF', green: '#D5E8D4', gs: '#82B366', orange: '#FFE6CC', os: '#D79B00', purple: '#E1D5E7', ps: '#9673A6', red: '#F8CECC', rs: '#B85450', teal: '#D0ECE7', ts: '#469990', gray: '#F1F3F5', line: '#BEC6D0', ink: '#344054' };
const count = (n: NodeModel, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n.count || min)));
const mode = (n: NodeModel) => n.spec.split(/\s+/)[0];

/** A small local normalized canvas; primitives stay native in every export backend. */
function canvas(n: NodeModel) {
  const p: Part[] = [];
  const X = (u: number) => n.x + n.w * u / 100;
  const Y = (v: number) => n.y + n.h * v / 100;
  const scale = Math.min(n.w / 160, n.h / 100);
  const ink = n.stroke === 'none' ? C.ink : n.stroke;
  const R = (x: number, y: number, w: number, h: number, f = n.fill, s = ink, r = 2, sw = 1) => p.push({ kind: 'rect', x: X(x), y: Y(y), w: n.w * w / 100, h: n.h * h / 100, r: r * scale, fill: f, stroke: s, sw: sw * n.strokeWidth, solid: true });
  const E = (x: number, y: number, rx: number, ry = rx * n.w / n.h, f = n.fill, s = ink, sw = 1) => p.push({ kind: 'ellipse', cx: X(x), cy: Y(y), rx: n.w * rx / 100, ry: n.h * ry / 100, fill: f, stroke: s, sw: sw * n.strokeWidth, solid: true });
  const L = (pts: XY[], s = ink, sw = 1, f = 'none', close = false) => p.push({ kind: 'path', cmds: poly(pts.map(([x, y]) => [X(x), Y(y)]), close), fill: f, stroke: s, sw: sw * n.strokeWidth, solid: true });
  const T = (x: number, y: number, text: string, size = 10, color = C.ink, bold = false, anchor: 'middle' | 'start' | 'end' = 'middle') => p.push({ kind: 'text', x: X(x), y: Y(y), text, size: Math.max(6, size * scale), fill: color, bold, anchor });
  const A = (a: XY, b: XY, s = ink, sw = 1) => {
    L([a, b], s, sw);
    const dx = X(b[0]) - X(a[0]), dy = Y(b[1]) - Y(a[1]), len = Math.hypot(dx, dy) || 1;
    const z = Math.min(5.5, 4 * scale), ux = dx / len, uy = dy / len;
    p.push({ kind: 'path', cmds: poly([[X(b[0]), Y(b[1])], [X(b[0]) - z * ux + z * .45 * uy, Y(b[1]) - z * uy - z * .45 * ux], [X(b[0]) - z * ux - z * .45 * uy, Y(b[1]) - z * uy + z * .45 * ux]]), fill: s, stroke: 'none', solid: true });
  };
  const axis = (xlabel: string, ylabel = '') => { A([12, 84], [95, 84], C.line); A([12, 84], [12, 8], C.line); T(91, 96, xlabel, 9); if (ylabel) T(13, 3, ylabel, 9, C.ink, false, 'start'); };
  return { p, R, E, L, T, A, axis };
}

function documentParts(n: NodeModel): Part[] {
  const { p, R, L, T, A } = canvas(n), m = mode(n), rows = count(n, 3, 7);
  R(19, 3, 62, 94, '#FFFFFF', C.line, 3);
  R(26, 10, 48, 10, n.fill, n.stroke, 2);
  if (m === 'table') {
    for (let r = 0; r < rows; r++) for (let c = 0; c < 3; c++) {
      R(26 + 16 * c, 29 + r * 57 / rows, 16, 57 / rows, r === 0 ? n.fill : '#FFFFFF', C.line, 0, .65);
      if (r > 0) T(34 + 16 * c, 29 + (r + .5) * 57 / rows, c === 0 ? String(r) : (c === 1 ? ['A', 'B', 'C'][r % 3] : String(r * 12)), 8);
    }
    A([5, 57], [17, 57], C.gs); A([83, 57], [97, 57], C.gs);
  } else if (m === 'citations') {
    for (let i = 0; i < rows; i++) {
      const yy = 29 + i * 48 / rows;
      L([[27, yy], [61, yy]], C.line, 1.5);
      if (i % 2 === 0) { R(65, yy - 4, 9, 8, C.green, C.gs, 1); T(69.5, yy, `[${i / 2 + 1}]`, 7, C.gs); }
    }
    L([[26, 82], [74, 82]], C.line);
    T(49, 89, '[1]  [2]  [3]', 8, C.gs);
  } else {
    const blocks: [number, number, number, number][] = [[26, 29, 21, 25], [53, 29, 21, 25], [26, 64, 48, 22]];
    blocks.forEach(([x, y, w, h], i) => {
      R(x, y, w, h, i === 2 ? C.green : C.gray, i === 2 ? C.gs : C.line, 1);
      for (let r = 0; r < Math.min(rows, 4); r++) L([[x + 3, y + 5 + r * (h - 8) / 4], [x + w - (r % 2 ? 6 : 3), y + 5 + r * (h - 8) / 4]], C.line, .8);
      if (m === 'order') { R(x - 4, y - 5, 10, 10, C.orange, C.os, 2); T(x + 1, y, String(i + 1), 8, C.ink, true); }
    });
    if (m === 'order') { A([47, 42], [52, 42], C.os); A([77, 53], [77, 73], C.os); }
  }
  return p;
}

/** Ranking permutation is visible; RRF combines ranks, not incomparable raw scores. */
function rankingParts(n: NodeModel): Part[] {
  const { p, R, L, T, A } = canvas(n), m = mode(n), N = count(n, 3, 6);
  if (m === 'fusion') {
    const orders = [[1, 3, 2, 4, 5, 6], [2, 1, 4, 3, 6, 5]].map(order => order.filter(i => i <= N));
    const fused = Array.from({ length: N }, (_, i) => i + 1).sort((a, b) => orders.reduce((s, o) => s + 1 / (61 + o.indexOf(b)), 0) - orders.reduce((s, o) => s + 1 / (61 + o.indexOf(a)), 0));
    [0, 1, 2].forEach(col => {
      T(15 + col * 35, 5, col < 2 ? ['Lexical', 'Dense'][col] : 'RRF', 9, C.ink, true);
      for (let i = 0; i < N; i++) { R(3 + col * 35, 17 + i * 73 / N, 24, 60 / N, col === 2 ? C.green : n.fill, col === 2 ? C.gs : n.stroke, 2); T(15 + col * 35, 17 + (i + .42) * 73 / N, `d${col < 2 ? orders[col][i] : fused[i]}`, 9); }
    });
    A([28, 49], [37, 49], C.line); A([63, 49], [72, 49], C.gs);
  } else if (m === 'rerank') {
    const order = [2, 0, 3, 1, 5, 4].filter(i => i < N);
    T(20, 5, 'Candidates', 9, C.ink, true); T(81, 5, 'Re-ranked', 9, C.ink, true);
    for (let i = 0; i < N; i++) {
      const yy = 20 + i * 72 / N, dest = order.indexOf(i);
      R(2, yy, 30, 59 / N, n.fill, n.stroke, 2); T(17, yy + 29.5 / N, `d${i + 1}`, 9);
      R(68, 20 + dest * 72 / N, 30, 59 / N, dest === 0 ? C.green : C.gray, dest === 0 ? C.gs : C.line, 2); T(83, 20 + dest * 72 / N + 29.5 / N, `d${i + 1}`, 9);
      L([[34, yy + 29.5 / N], [66, 20 + dest * 72 / N + 29.5 / N]], i === 2 ? C.gs : C.line, i === 2 ? 1.6 : .7);
    }
  } else {
    T(53, 7, m === 'sparse' ? 'Term relevance' : 'Cosine similarity', 9, C.ink, true);
    for (let i = 0; i < N; i++) {
      const yy = 22 + i * 72 / N, value = m === 'sparse' ? [1, .74, .55, .33, .2, .09][i] : [.95, .86, .78, .62, .55, .42][i];
      T(8, yy + 25 / N, `d${i + 1}`, 9); R(20, yy, 72 * value, 50 / N, i === 0 ? C.green : n.fill, i === 0 ? C.gs : n.stroke, 1);
      if (m === 'sparse') for (let k = 1; k <= 3; k++) L([[20 + 72 * value * k / 4, yy], [20 + 72 * value * k / 4, yy + 50 / N]], '#FFFFFF', 1);
    }
  }
  return p;
}

function contextParts(n: NodeModel): Part[] {
  const { p, R, L, T, A } = canvas(n), m = mode(n), N = count(n, 3, 7);
  if (m === 'overlap') {
    T(50, 6, 'Shared boundary tokens', 9, C.ink, true);
    for (let row = 0; row < 3; row++) {
      const start = row * 22;
      for (let j = 0; j < N; j++) R(3 + start + j * 47 / N, 20 + row * 26, 43 / N, 16, j < 2 && row > 0 ? C.orange : n.fill, j < 2 && row > 0 ? C.os : n.stroke, 1);
      if (row < 2) A([start + 41, 39 + row * 26], [start + 26, 45 + row * 26], C.os);
    }
  } else if (m === 'packed') {
    const names = ['System', 'Query', 'd1', 'd2', 'Answer'];
    const colors = [C.purple, C.orange, C.blue, C.green, '#FFFFFF'];
    R(3, 10, 94, 78, '#FFFFFF', C.line, 3);
    for (let i = 0; i < 5; i++) { R(8, 16 + i * 13, 84 - (i === 4 ? 15 : 0), 10, colors[i], i === 4 ? C.line : n.stroke, 1); T(12, 21 + i * 13, names[i], 8, C.ink, false, 'start'); }
    T(50, 96, 'Token budget', 9);
  } else {
    R(3, 8, 94, 79, '#FFFFFF', C.line, 3);
    for (let i = 0; i < N; i++) {
      const yy = 19 + i * 58 / N;
      if (i === 1 || i === N - 2) R(i === 1 ? 30 : 9, yy - 4, 48, 8, n.fill, 'none', 1);
      L([[9, yy], [i % 2 ? 83 : 91, yy]], C.line, 1.1);
    }
    T(50, 96, 'Relevant spans', 9);
  }
  return p;
}

function banditParts(n: NodeModel): Part[] {
  const { p, R, L, T, E, axis } = canvas(n), m = mode(n), N = count(n, 3, 6);
  axis('arm', m === 'thompson' ? 'reward posterior' : 'value');
  const means = [.38, .61, .49, .28, .55, .43], uncertainty = [.14, .06, .3, .13, .09, .16];
  for (let i = 0; i < N; i++) {
    const xx = 21 + i * 65 / Math.max(1, N - 1), yy = 81 - 59 * means[i], chosen = m === 'epsilon' ? i === N - 1 : i === 2;
    T(xx, 93, String(i + 1), 8);
    if (m === 'thompson') {
      const width = 4 + uncertainty[i] * 10, curve: XY[] = [];
      for (let j = 0; j <= 24; j++) { const y = 15 + j * 64 / 24; curve.push([xx + width * Math.exp(-.5 * ((y - yy) / (uncertainty[i] * 45)) ** 2), y]); }
      L([[xx, 15], ...curve, [xx, 79]], i === 2 ? C.os : n.stroke, .8, i === 2 ? C.orange : n.fill, true);
      E(xx + 2, yy - (i === 2 ? 10 : -4), 1.8, undefined, chosen ? C.os : C.bs, 'none');
    } else {
      R(xx - 4, yy, 8, 82 - yy, chosen ? C.orange : n.fill, chosen ? C.os : n.stroke, 1);
      if (m === 'ucb') { const hi = yy - uncertainty[i] * 58; L([[xx, hi], [xx, yy]], C.ink); L([[xx - 3, hi], [xx + 3, hi]], C.ink); }
    }
    if (chosen) T(xx, 9, '*', 16, C.os, true);
  }
  return p;
}

function trajectoryParts(n: NodeModel): Part[] {
  const { p, R, L, E, T, A } = canvas(n), N = count(n, 3, 6), m = mode(n);
  const step = 79 / (N - 1);
  for (let i = 0; i < N; i++) {
    const xx = 10 + i * step;
    if (i < N - 1) { A([xx + 4, 45], [xx + step - 5, 45], C.line); T(xx + step / 2, 30, `$a_${i}$`, 8); R(xx + step / 2 - 5, 60, 10, 15, C.orange, C.os, 2); T(xx + step / 2, 67.5, `$r_${i + 1}$`, 8); }
    E(xx, 45, 3.9, undefined, i === N - 1 ? C.green : n.fill, i === N - 1 ? C.gs : n.stroke);
    T(xx, 15, `$s_${i}$`, 8);
  }
  if (m === 'truncated') {
    L([[89, 77], [89, 28]], C.rs, 1.5); T(65, 91, 'Time limit: bootstrap V', 8, C.rs);
  } else if (m === 'nstep') {
    L([[10, 80], [10, 87], [89, 87], [89, 80]], C.ps); T(50, 97, 'Rewards + discounted bootstrap', 8, C.ps);
  } else T(52, 92, 'Ordered on-policy transitions', 8);
  return p;
}

function distributionParts(n: NodeModel): Part[] {
  const { p, R, L, T, A, axis } = canvas(n), m = mode(n), N = count(n, 5, 15);
  axis(m === 'entropy' ? 'action' : 'return');
  const bars = (offset: number, color: string, stroke: string) => {
    for (let i = 0; i < N; i++) {
      const xx = 17 + i * 73 / N + offset, z = i / (N - 1), h = m === 'entropy' ? 70 * (i === Math.floor(N / 2) ? .72 : .28 / (N - 1)) : 45 * (Math.exp(-(((z - .35) / .19) ** 2)) + .6 * Math.exp(-(((z - .8) / .12) ** 2)));
      R(xx, 82 - h, Math.max(2, 54 / N), h, color, stroke, .5);
    }
  };
  if (m === 'entropy') {
    for (let i = 0; i < N; i++) R(17 + i * 73 / N, 82 - 70 / N, Math.max(2, 54 / N), 70 / N, C.green, C.gs, .5);
    bars(1.5, n.fill, n.stroke); T(53, 13, 'Diffuse / concentrated policy', 8);
  } else if (m === 'projection') {
    bars(3.5, C.orange, C.os);
    for (let i = 0; i < N; i++) { const xx = 17 + i * 73 / N; L([[xx, 88], [xx, 77]], n.stroke, 1.3); }
    A([61, 21], [51, 53], C.ps); A([61, 21], [69, 47], C.ps); T(55, 10, 'Project onto fixed atoms', 8);
  } else bars(0, n.fill, n.stroke);
  return p;
}

function detectionParts(n: NodeModel): Part[] {
  const { p, R, L, T, E } = canvas(n), m = mode(n), N = count(n, 2, 5);
  R(2, 3, 96, 93, '#FAFBFC', C.line, 3);
  E(51, 42, 9, 16, C.gray, C.line, .6); R(39, 57, 26, 25, C.gray, C.line, 2, .6);
  if (m === 'iou') {
    R(22, 19, 44, 53, 'none', C.bs, 0, 1.8); R(38, 35, 43, 50, 'none', C.rs, 0, 1.8);
    R(38, 35, 28, 37, mix(n.fill, '#FFFFFF', .15), C.ps, 0, .7); T(52, 52, '∩', 15, C.ps); T(53, 91, 'intersection / union', 8);
  } else if (m === 'rotated') {
    L([[25, 39], [57, 14], [78, 61], [46, 86]], n.stroke, 1.7, 'none', true);
    L([[25, 39], [57, 39]], C.line, .8); T(42, 34, '$\\theta$', 10, n.stroke); E(51.5, 50, 1.7, undefined, n.stroke, 'none');
  } else {
    for (let i = N - 1; i >= 0; i--) {
      const x = 26 + i * 3.5, y = 18 + i * 4;
      const color = m === 'proposals' ? n.stroke : i === 0 ? C.gs : m === 'soft' ? mix(C.rs, '#FFFFFF', .5 + .07 * i) : C.line;
      R(x, y, 38, 59, 'none', color, 0, i === 0 ? 2 : .8);
      if (i > 0 && m === 'nms') { L([[x + 31, y + 4], [x + 36, y + 9]], C.rs, .8); L([[x + 36, y + 4], [x + 31, y + 9]], C.rs, .8); }
    }
    T(47, 10, '0.95', 8, m === 'proposals' ? n.stroke : C.gs, true); T(52, 91, m === 'proposals' ? 'candidate boxes' : m === 'soft' ? 'decay overlapping scores' : 'keep highest score', 8);
  }
  return p;
}

function matchingParts(n: NodeModel): Part[] {
  const { p, R, E, L, T, A } = canvas(n), N = count(n, 3, 7), m = mode(n);
  R(2, 10, 36, 77, n.fill, n.stroke, 2); R(62, 10, 36, 77, C.green, C.gs, 2);
  T(20, 4, m === 'stereo' ? 'Left' : 'View A', 9); T(80, 4, m === 'stereo' ? 'Right' : 'View B', 9);
  for (let i = 0; i < N; i++) {
    const yy = 23 + i * 51 / (N - 1), ax = 12 + (i * 7 % 19), bx = m === 'stereo' ? ax + 57 : 70 + (i * 11 % 19), by = m === 'stereo' ? yy : yy + (i % 2 ? -4 : 3), rejected = i === N - 2 && m === 'ransac';
    E(ax, yy, 1.4, undefined, C.bs, 'none'); E(bx, by, 1.4, undefined, C.gs, 'none');
    L([[ax, yy], [bx, rejected ? 23 : by]], rejected ? C.rs : (m === 'ransac' ? C.gs : C.line), rejected ? .65 : .85);
    if (m === 'stereo') L([[4, yy], [96, yy]], '#DDE2EA', .45);
    if (rejected) { L([[47, 48], [53, 55]], C.rs, 1.6); L([[53, 48], [47, 55]], C.rs, 1.6); }
  }
  if (m === 'stereo') { A([20, 94], [77, 94], C.os); T(50, 88, 'disparity d', 8, C.os); }
  else T(50, 96, m === 'ransac' ? 'inliers / rejected match' : 'descriptor correspondences', 8);
  return p;
}

function augmentParts(n: NodeModel): Part[] {
  const { p, R, E, L, T, A } = canvas(n), m = mode(n);
  const scene = (x: number, col: string, st: string, object: boolean) => {
    R(x, 23, 26, 48, col, st, 2); L([[x + 1, 60], [x + 25, 60]], st, .6);
    if (object) E(x + 13, 45, 5, 10, '#FFFFFF', st); else L([[x + 5, 57], [x + 13, 31], [x + 22, 57]], st, 1, '#FFFFFF', true);
  };
  scene(1, C.blue, C.bs, true); scene(36, C.orange, C.os, false); scene(72, m === 'mixup' ? mix(C.blue, C.orange, .5) : C.blue, C.bs, true);
  if (m === 'cutmix') { R(84, 29, 12, 23, C.orange, C.os, 0); L([[85, 48], [90, 31], [95, 48]], C.os, .8, '#FFFFFF', true); }
  else L([[76, 58], [85, 29], [95, 58]], C.os, 1, 'none', true);
  T(14, 10, 'A', 9); T(49, 10, 'B', 9); T(85, 10, 'Mixed', 9); T(32, 47, '+', 11); A([64, 47], [70, 47], C.line);
  T(50, 89, m === 'cutmix' ? 'Labels weighted by patch area' : 'Images and labels interpolated', 8);
  return p;
}

function retrievalParts(n: NodeModel): Part[] {
  const { p, R, E, L, T, A, axis } = canvas(n), N = count(n, 3, 6), m = mode(n);
  if (m === 'reject') {
    axis('distance');
    L([[68, 14], [68, 84]], C.rs, 1.4); T(68, 8, '$\\tau$', 11, C.rs);
    for (let i = 0; i < N; i++) { const d = 20 + i * 66 / (N - 1), yy = 72 - 38 * Math.exp(-(((d - 38) / 19) ** 2)); E(d, yy, 2.4, undefined, d > 68 ? C.red : n.fill, d > 68 ? C.rs : n.stroke); }
    T(37, 26, 'known', 8, C.bs); T(83, 26, 'reject', 8, C.rs);
  } else {
    R(2, 33, 21, 36, C.blue, C.bs, 2); E(12.5, 51, 4, 9, '#FFFFFF', C.bs); T(12.5, 22, 'Query', 9);
    A([25, 51], [36, 51], C.line);
    for (let i = 0; i < N; i++) {
      const col = i % 3, row = Math.floor(i / 3), xx = 40 + col * 20, yy = 10 + row * 43;
      R(xx, yy, 17, 33, i < 2 ? C.green : C.gray, i < 2 ? C.gs : C.line, 2);
      if (i < 2) E(xx + 8.5, yy + 16, 3.1, 8, '#FFFFFF', C.gs); else L([[xx + 3, yy + 24], [xx + 9, yy + 8], [xx + 14, yy + 24]], C.line, .8, '#FFFFFF', true);
      T(xx + 8.5, yy + 39, `#${i + 1}`, 7, i < 2 ? C.gs : C.ink);
    }
  }
  return p;
}

function maskParts(n: NodeModel): Part[] {
  const { p, R, E, L, T } = canvas(n), m = mode(n), N = count(n, 4, 10);
  R(5, 4, 90, 87, '#FFFFFF', C.line, 2);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const inner = c >= N * .3 && c < N * .7 && r >= N * .3 && r < N * .7;
    const masked = m === 'outpaint' ? !inner : inner;
    R(7 + c * 86 / N, 6 + r * 83 / N, 86 / N, 83 / N, masked ? ((r + c) % 2 ? C.gray : '#FFFFFF') : n.fill, 'none', 0);
  }
  if (m === 'known') { E(50, 28, 8, 10, C.orange, C.os, .8); L([[17, 76], [34, 46], [47, 66], [71, 47], [88, 76]], C.gs, 1.2); }
  else if (m === 'outpaint') { R(33, 32, 34, 30, C.green, C.gs, 0); E(50, 45, 5, 7, '#FFFFFF', C.gs); }
  else R(33, 31, 34, 32, 'none', C.rs, 0, 1.2);
  T(50, 98, m === 'outpaint' ? 'Extend beyond known region' : m === 'known' ? 'Preserve unmasked content' : 'Mask: editable region', 8);
  return p;
}

function guidanceParts(n: NodeModel): Part[] {
  const { p, R, E, L, T, A, axis } = canvas(n), m = mode(n), N = count(n, 4, 12);
  if (m === 'vectors') {
    axis('$x_1$', '$x_2$');
    const a: XY = [25, 73], u: XY = [61, 62], c: XY = [57, 41], guided: XY = [53, 20];
    A(a, u, C.line, 1.3); A(a, c, C.bs, 1.4); A(a, guided, C.ps, 2);
    L([u, guided], C.line, .6); T(73, 65, 'uncond.', 8, C.ink); T(73, 43, 'cond.', 8, C.bs); T(69, 18, 'guided', 8, C.ps); E(...a, 1.5, undefined, C.ink, 'none');
  } else if (m === 'schedule') {
    axis('$t$', '$\\bar{\\alpha}_t$');
    const line: XY[] = [], cosine: XY[] = [];
    for (let i = 0; i <= 40; i++) { const z = i / 40; line.push([14 + 76 * z, 13 + 68 * z]); cosine.push([14 + 76 * z, 13 + 68 * (1 - Math.cos(z * Math.PI / 2) ** 2)]); }
    L(line, C.line, 1.1); L(cosine, n.stroke, 1.6); T(48, 72, 'cosine', 8, n.stroke); T(67, 46, 'linear', 8, C.ink);
  } else {
    T(50, 11, 'Reverse-time solver grid', 9, C.ink, true);
    A([94, 56], [6, 56], C.ink);
    for (let i = 0; i < N; i++) { const xx = 9 + 79 * (i / (N - 1)) ** 1.5; R(xx - .7, 43, 1.4, 26, n.fill, n.stroke, 0); }
    T(9, 82, 'data  0', 8); T(88, 82, 'T  noise', 8);
  }
  return p;
}

function videoParts(n: NodeModel): Part[] {
  const { p, R, E, L, T, A } = canvas(n), N = count(n, 3, 6), m = mode(n);
  const fw = 87 / N, gap = 2;
  for (let i = 0; i < N; i++) {
    const xx = 3 + i * (fw + gap), noisy = m === 'noise' || (m === 'keyframe' && i > 0);
    R(xx, 21, fw, 56, noisy ? C.gray : n.fill, m === 'keyframe' && i === 0 ? C.gs : n.stroke, 2, m === 'keyframe' && i === 0 ? 2 : .8);
    if (noisy) for (let j = 0; j < 18; j++) { const px = xx + 2 + ((j * 7 + i * 3) % 17) / 17 * (fw - 4), py = 26 + ((j * 11 + i * 5) % 19) / 19 * 45; E(px, py, .6, undefined, j % 2 ? C.line : '#FFFFFF', 'none'); }
    if (!noisy || m === 'keyframe') { L([[xx + 2, 66], [xx + fw - 2, 66]], C.gs, .5); E(xx + fw * (.3 + .4 * i / (N - 1)), 50, fw * .13, 9, noisy ? '#E1E7EE' : C.orange, noisy ? C.line : C.os, .8); }
    T(xx + fw / 2, 11, `$f_${i + 1}$`, 8);
  }
  A([5, 91], [95, 91], C.line); T(50, 99, m === 'keyframe' ? 'Known frame conditions future frames' : m === 'noise' ? 'Joint noise across a video sample' : 'Temporally coherent motion', 8);
  return p;
}

const variants = (values: [string, string][]): SpecGroup[] => [{ title: 'Variante', choices: values.map(([value, label]) => ({ value, label })) }];
const definition = (kind: string, name: string, parts: ShapeDef['parts'], values: [string, string][], countLabel?: string, countMax?: number): ShapeDef => ({ kind: `aix-${kind}`, name, parts, specLabel: 'Variante', specOptions: variants(values), ...(countLabel ? { countLabel, countMax } : {}) });

export const AI_EXTRA_SHAPES: ShapeDef[] = [
  definition('document', 'Documento strutturato', documentParts, [['layout', 'Layout'], ['order', 'Ordine di lettura'], ['table', 'Tabella'], ['citations', 'Citazioni']], 'Righe', 7),
  definition('ranking', 'Ranking e fusione', rankingParts, [['sparse', 'Lessicale'], ['dense', 'Denso'], ['rerank', 'Reranking'], ['fusion', 'Reciprocal rank fusion']], 'Documenti', 6),
  definition('context', 'Contesto e finestre', contextParts, [['overlap', 'Finestre sovrapposte'], ['packed', 'Contesto composto'], ['evidence', 'Evidenze']], 'Token / righe', 7),
  definition('bandit', 'Bandit: esplorazione', banditParts, [['ucb', 'UCB'], ['thompson', 'Thompson sampling'], ['epsilon', 'Epsilon greedy']], 'Bracci', 6),
  definition('trajectory', 'Traiettoria RL', trajectoryParts, [['rollout', 'Rollout'], ['truncated', 'Time limit'], ['nstep', 'Ritorno n-step']], 'Stati', 6),
  definition('distribution', 'Distribuzioni RL', distributionParts, [['return', 'Distribuzione del return'], ['projection', 'Proiezione categorica'], ['entropy', 'Entropia della policy']], 'Atomi / azioni', 15),
  definition('detection', 'Postprocessing detection', detectionParts, [['proposals', 'Proposte'], ['iou', 'IoU'], ['nms', 'NMS'], ['soft', 'Soft-NMS'], ['rotated', 'Box orientato']], 'Proposte', 5),
  definition('matching', 'Corrispondenze visive', matchingParts, [['matches', 'Feature matching'], ['stereo', 'Disparità stereo'], ['ransac', 'Inlier RANSAC']], 'Corrispondenze', 7),
  definition('augment', 'MixUp e CutMix', augmentParts, [['cutmix', 'CutMix'], ['mixup', 'MixUp']]),
  definition('retrieval', 'Ricerca e rifiuto', retrievalParts, [['gallery', 'Ricerca in galleria'], ['reject', 'Rifiuto open-set']], 'Candidati', 6),
  definition('mask', 'Maschera condizionale', maskParts, [['inpaint', 'Inpainting'], ['outpaint', 'Outpainting'], ['known', 'Regione nota']], 'Griglia', 10),
  definition('guidance', 'Guidance e campionamento', guidanceParts, [['vectors', 'Vettori CFG'], ['schedule', 'Schedule del rumore'], ['timesteps', 'Passi del solver']], 'Passi', 12),
  definition('video', 'Video condizionale', videoParts, [['clean', 'Moto coerente'], ['noise', 'Video rumoroso'], ['keyframe', 'Condizione da keyframe']], 'Fotogrammi', 6),
];
