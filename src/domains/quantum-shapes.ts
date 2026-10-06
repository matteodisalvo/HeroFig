// Forme del modulo "Quantum computing" oltre ai circuiti (quelli stanno in quantum-circuit.ts):
// sfera di Bloch, istogramma delle misure, ampiezze di Grover, mappa dei qubit sul chip,
// codice di superficie, livelli energetici, icone dei dispositivi e polarizzazioni (BB84).
// Tutto procedurale e deterministico, con le primitive `Part`: identico in SVG, PDF, PNG e TikZ.
import { arc, mix, poly, rng, shade, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';

type N = NodeModel;
type P2 = [number, number];

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const AXIS = '#8A9099';
const TEXT = '#374151';
const ACCENT = '#C0392B';
const INK = '#2B2B2B';

const has = (spec: string, word: string) => new RegExp(`(^|[^a-z0-9=])${word}([^a-z0-9=]|$)`, 'i').test(spec);
const kindOf = <T extends string>(spec: string, kinds: readonly T[], fb: T): T => kinds.find((k) => has(spec, k)) ?? fb;
const numOf = (spec: string, key: string, fb: number) => {
  const m = new RegExp(`${key}=(-?\\d+(?:\\.\\d+)?)`, 'i').exec(spec);
  return m ? +m[1] : fb;
};
const inkOf = (n: N, fb = INK) => (n.stroke === 'none' ? fb : n.stroke);
const tint = (c: string, t: number) => mix(c, '#FFFFFF', t);

const line = (cmds: Cmd[], stroke: string, sw: number): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true });
const area = (cmds: Cmd[], fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'path', cmds, fill, stroke, sw, solid: true });
const disc = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true });
const box = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'rect', x, y, w, h, r, fill, stroke, sw, solid: true });
const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];
const pl = (pts: P2[]): Cmd[] => pts.map((p, i): Cmd => (i ? ['L', p[0], p[1]] : ['M', p[0], p[1]]));
const text = (x: number, y: number, t: string, size: number, anchor: 'start' | 'middle' | 'end' = 'middle', fill = TEXT): Part => ({ kind: 'text', x, y, text: t, size, fill, anchor });

function head(tip: P2, dx: number, dy: number, size: number, color: string): Part {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const bx = tip[0] - ux * size, by = tip[1] - uy * size;
  const hw = size * 0.42;
  return { kind: 'path', fill: color, stroke: 'none', cmds: poly([tip, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]) };
}

function arrow(a: P2, b: P2, color: string, sw: number, size: number, both = false): Part[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
  const cut = Math.min(size * 0.8, l * 0.45);
  const s: P2 = both ? [a[0] + ux * cut, a[1] + uy * cut] : a;
  const e: P2 = [b[0] - ux * cut, b[1] - uy * cut];
  const parts = [line(seg(s, e), color, sw), head(b, ux, uy, size, color)];
  if (both) parts.push(head(a, -ux, -uy, size, color));
  return parts;
}

/** Tratteggio lungo una polilinea (le primitive non hanno un tratteggio proprio). */
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

// ======================================================================
// Sfera di Bloch
// ======================================================================

/** Sfera di Bloch: `count` = θ in gradi, 'phi=…' = φ; opzioni 'labels', 'angles', 'psi'. */
function blochParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const labels = has(n.spec, 'labels'), angles = has(n.spec, 'angles'), psi = has(n.spec, 'psi');
  const fs = clamp(Math.min(w, h) * 0.095, 8.5, 13);
  const R = labels ? Math.min(w * 0.33, (h / 2 - fs * 1.25) / 1.2) : Math.min(w, h) * 0.4;
  const cx = x + w / 2 - (labels ? R * 0.04 : 0), cy = y + h / 2 + (labels ? fs * 0.3 : 0);
  const az = 24 * DEG, el = 17 * DEG;
  const rv = [-Math.sin(az), Math.cos(az), 0];
  const uv = [-Math.sin(el) * Math.cos(az), -Math.sin(el) * Math.sin(az), Math.cos(el)];
  const P = (a: number, b: number, c: number): P2 => [cx + R * (a * rv[0] + b * rv[1] + c * rv[2]), cy - R * (a * uv[0] + b * uv[1] + c * uv[2])];
  const ink = inkOf(n, '#5B6B80');
  const sw = n.strokeWidth;
  const guide = '#9AA3AE';
  const parts: Part[] = [];
  parts.push(disc(cx, cy, R, n.fill === 'none' ? 'none' : n.fill, ink, sw));
  if (n.fill !== 'none') parts.push({ kind: 'ellipse', cx: cx - R * 0.36, cy: cy - R * 0.4, rx: R * 0.32, ry: R * 0.22, fill: tint(n.fill, 0.55), stroke: 'none', solid: true });
  // equatore: metà anteriore piena, posteriore tratteggiata
  const eq = (a0: number, a1: number) => Array.from({ length: 49 }, (_, i): P2 => P(Math.cos(a0 + ((a1 - a0) * i) / 48), Math.sin(a0 + ((a1 - a0) * i) / 48), 0));
  parts.push(line(dashes(eq(az + Math.PI / 2, az + (3 * Math.PI) / 2), 2.6, 2.2), guide, sw * 0.8));
  parts.push(line(pl(eq(az - Math.PI / 2, az + Math.PI / 2)), ink, sw * 0.85));
  // assi
  const hs = clamp(R * 0.09, 3, 5.5);
  parts.push(line(dashes([P(-1, 0, 0), P(0, 0, 0)], 2.4, 2), guide, 0.8), line(dashes([P(0, -1, 0), P(0, 0, 0)], 2.4, 2), guide, 0.8));
  parts.push(line(dashes([P(0, 0, -1), P(0, 0, 0)], 2.4, 2), guide, 0.8));
  parts.push(...arrow(P(0, 0, 0), P(1.28, 0, 0), AXIS, 0.85, hs), ...arrow(P(0, 0, 0), P(0, 1.3, 0), AXIS, 0.85, hs), ...arrow(P(0, 0, 0), P(0, 0, 1.22), AXIS, 0.85, hs));
  parts.push(disc(...P(0, 0, 1), 1.8, ink), disc(...P(0, 0, -1), 1.8, ink));
  // stato
  const th = clamp(n.count, 0, 180) * DEG, ph = numOf(n.spec, 'phi', 45) * DEG;
  const v = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
  if (Math.sin(th) > 0.08) {
    parts.push(line(dashes([P(v[0], v[1], v[2]), P(v[0], v[1], 0)], 2.4, 2), guide, 0.8));
    parts.push(line(dashes([P(0, 0, 0), P(v[0], v[1], 0)], 2.4, 2), guide, 0.8));
  }
  if (angles && th > 6 * DEG) {
    const rt = 0.3;
    const thArc = Array.from({ length: 25 }, (_, i): P2 => {
      const t = (th * i) / 24;
      return P(rt * Math.sin(t) * Math.cos(ph), rt * Math.sin(t) * Math.sin(ph), rt * Math.cos(t));
    });
    parts.push(line(pl(thArc), ACCENT, 0.9));
    const tl = P(0.46 * Math.sin(th / 2) * Math.cos(ph), 0.46 * Math.sin(th / 2) * Math.sin(ph), 0.46 * Math.cos(th / 2));
    parts.push(text(tl[0] + 1, tl[1] - 1, '$\\theta$', fs * 0.95, 'middle', ACCENT));
    if (Math.sin(th) > 0.08 && Math.abs(ph) > 6 * DEG) {
      const rp = 0.38;
      const phArc = Array.from({ length: 25 }, (_, i): P2 => P(rp * Math.cos((ph * i) / 24), rp * Math.sin((ph * i) / 24), 0));
      parts.push(line(pl(phArc), ACCENT, 0.9));
      const pp = P(0.56 * Math.cos(ph / 2), 0.56 * Math.sin(ph / 2), 0);
      parts.push(text(pp[0], pp[1] + fs * 0.45, '$\\phi$', fs * 0.95, 'middle', ACCENT));
    }
  }
  const tip = P(v[0], v[1], v[2]);
  parts.push(...arrow([cx, cy], tip, ACCENT, Math.max(1.3, sw * 1.3), clamp(R * 0.13, 4, 7)));
  parts.push(disc(cx, cy, 1.6, ACCENT));
  if (labels) {
    const N0 = P(0, 0, 1), S0 = P(0, 0, -1), X1 = P(1.28, 0, 0), Y1 = P(0, 1.3, 0), Z1 = P(0, 0, 1.22);
    parts.push(text(N0[0] + 5, N0[1] - fs * 0.55, '$|0\\rangle$', fs, 'start'), text(S0[0] + 5, S0[1] + fs * 0.6, '$|1\\rangle$', fs, 'start'));
    parts.push(text(Z1[0] - 6, Z1[1] + 2, '$z$', fs * 0.9, 'end', AXIS), text(X1[0] - 3, X1[1] + fs * 0.55, '$x$', fs * 0.9, 'end', AXIS), text(Y1[0], Y1[1] - fs * 0.6, '$y$', fs * 0.9, 'middle', AXIS));
  }
  if (psi) {
    const right = tip[0] >= cx;
    parts.push(text(tip[0] + (right ? 4 : -4), tip[1] - fs * 0.45, '$|\\psi\\rangle$', fs, right ? 'start' : 'end', ACCENT));
  }
  return parts;
}

// ======================================================================
// Istogramma delle misure e ampiezze
// ======================================================================

const HIST = ['bell', 'ghz', 'uniform', 'grover', 'zero', 'random'] as const;

function histProbs(n: N, bits: number): number[] {
  const N = 2 ** bits;
  const nums = (n.spec.match(/(?:^|\s)(\d*\.?\d+)(?=\s|$)/g) ?? []).map((s) => +s).filter((v) => Number.isFinite(v));
  let p: number[];
  if (nums.length >= 2) p = Array.from({ length: N }, (_, i) => Math.max(0, nums[i] ?? 0));
  else {
    const kind = kindOf(n.spec, HIST, 'bell');
    const rand = rng(31 + bits);
    if (kind === 'uniform') p = Array.from({ length: N }, () => 1 / N);
    else if (kind === 'zero') p = Array.from({ length: N }, (_, i) => (i === 0 ? 1 : 0));
    else if (kind === 'grover') {
      const m = Math.max(0, N - 3), pm = N <= 4 ? 1 : N <= 8 ? 0.945 : 0.96;
      p = Array.from({ length: N }, (_, i) => (i === m ? pm : (1 - pm) / (N - 1)));
    } else if (kind === 'random') p = Array.from({ length: N }, () => 0.2 + rand());
    else p = Array.from({ length: N }, (_, i) => (i === 0 || i === N - 1 ? 0.5 : 0));
  }
  if (has(n.spec, 'noisy')) {
    const rand = rng(7 + bits * 3);
    p = p.map((v) => v + 0.012 + rand() * 0.03 * (v > 0.1 ? -1 : 1));
  }
  const s = p.reduce((a, b) => a + b, 0) || 1;
  return p.map((v) => Math.max(0, v / s));
}

/** Istogramma delle misure: `count` = qubit (2^count barre), probabilità da 'bell', 'ghz'… o numeri. */
function histParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const bits = clamp(Math.round(n.count), 1, 5);
  const N = 2 ** bits;
  const p = histProbs(n, bits);
  const values = has(n.spec, 'values'), axis = has(n.spec, 'axis');
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push(box(x, y, w, h, Math.min(n.radius, 4), n.fill, inkOf(n, '#C9CED6'), 0.8));
  const pad = n.fill !== 'none' ? 6 : 1;
  const x0 = x + pad + (axis ? 20 : 0), x1 = x + w - pad;
  const slot = (x1 - x0) / N;
  const ls = clamp(Math.min(slot / (bits * 0.6 + 0.4), h * 0.13), 6, 10);
  const y1 = y + h - pad - ls - 3, y0 = y + pad + (values ? 11 : 3);
  const pmax = Math.max(...p);
  const top = pmax > 0.5 ? 1 : pmax > 0.25 ? 0.5 : 0.25;
  const Y = (v: number) => y1 - (v / top) * (y1 - y0);
  const bar = n.stroke === 'none' ? '#5B8DD6' : n.stroke;
  if (axis) {
    for (const v of [0, top / 2, top]) {
      parts.push(line(seg([x0 - 2, Y(v)], [x1, Y(v)]), v ? '#E2E5EA' : AXIS, v ? 0.6 : 0.8));
      parts.push(text(x0 - 4, Y(v), String(+v.toFixed(2)), clamp(ls * 0.85, 6, 8.5), 'end', AXIS));
    }
  }
  const bw = slot * 0.64;
  p.forEach((v, i) => {
    const bx = x0 + slot * i + (slot - bw) / 2;
    if (v > 0.001) parts.push(box(bx, Y(v), bw, y1 - Y(v), 0, tint(bar, 0.3), bar, 0.8));
    parts.push(text(bx + bw / 2, y1 + ls * 0.75 + 2, i.toString(2).padStart(bits, '0'), ls, 'middle', TEXT));
    if (values && v > 0.004) parts.push(text(bx + bw / 2, Y(v) - 5.5, v >= 0.995 ? '1' : v.toFixed(2).replace(/^0/, ''), clamp(ls * 0.9, 6, 8.5), 'middle', TEXT));
  });
  parts.push(line(seg([x0, y1], [x1, y1]), AXIS, 0.9));
  return parts;
}

const AMP_STAGES = ['uniform', 'oracle', 'diffuse', 'final'] as const;

/** Ampiezze di Grover: `count` = stati; fasi 'uniform', 'oracle' (segno invertito), 'diffuse' (inversione sulla media). */
function ampsParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const N = clamp(Math.round(n.count), 2, 32);
  const stage = kindOf(n.spec, AMP_STAGES, 'uniform');
  const m = clamp(Math.round(numOf(n.spec, 'w', Math.round(N * 0.62))), 0, N - 1);
  const s0 = 1 / Math.sqrt(N);
  let a = Array.from({ length: N }, () => s0);
  if (stage === 'oracle') a[m] = -s0;
  if (stage === 'diffuse' || stage === 'final') {
    const iters = stage === 'final' ? Math.max(1, Math.round((Math.PI / 4) * Math.sqrt(N) - 0.5)) : 1;
    for (let k = 0; k < iters; k++) {
      a[m] = -a[m];
      const mu = a.reduce((s, v) => s + v, 0) / N;
      a = a.map((v) => 2 * mu - v);
    }
  }
  const mean = has(n.spec, 'mean'), labels = has(n.spec, 'labels');
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push(box(x, y, w, h, Math.min(n.radius, 4), n.fill, inkOf(n, '#C9CED6'), 0.8));
  const pad = n.fill !== 'none' ? 5 : 1;
  const x0 = x + pad + 2, x1 = x + w - pad - (mean ? 12 : 2);
  const fsL = clamp(h * 0.12, 7, 10);
  const yb = y + pad + (h - 2 * pad - (labels ? fsL + 2 : 0)) * 0.7;
  const up = yb - y - pad - 2;
  const Y = (v: number) => yb - v * up;
  const slot = (x1 - x0) / N, bw = slot * 0.62;
  const col = n.stroke === 'none' ? '#5B8DD6' : n.stroke;
  a.forEach((v, i) => {
    const bx = x0 + slot * i + (slot - bw) / 2;
    const c = i === m && stage !== 'uniform' ? ACCENT : col;
    const top = Math.min(Y(v), yb), bh = Math.abs(Y(v) - yb);
    if (bh > 0.3) parts.push(box(bx, top, bw, bh, 0, tint(c, 0.32), c, 0.8));
  });
  parts.push(line(seg([x0 - 2, yb], [x1 + 2, yb]), AXIS, 0.9));
  if (mean) {
    const mu = a.reduce((s, v) => s + v, 0) / N;
    parts.push(line(dashes([[x0 - 2, Y(mu)], [x1 + 2, Y(mu)]], 3, 2.2), '#555B66', 0.9));
    parts.push(text(x1 + 4, Y(mu), '$\\mu$', clamp(h * 0.13, 8, 11), 'start', '#555B66'));
  }
  if (labels && stage !== 'uniform') {
    const bx = x0 + slot * m + slot / 2;
    parts.push(text(bx, Math.max(yb, Y(a[m])) + fsL * 0.7 + 2, '$w$', fsL, 'middle', ACCENT));
  }
  return parts;
}

// ======================================================================
// Hardware: mappa dei qubit, codice di superficie, livelli, icone
// ======================================================================

function gridDims(spec: string, fr: number, fc: number): [number, number] {
  const m = /(\d+)\s*[x×]\s*(\d+)/i.exec(spec);
  return m ? [clamp(+m[1], 1, 12), clamp(+m[2], 1, 16)] : [fr, fc];
}

const CHIPS = ['grid', 'heavyhex', 'line', 'ring'] as const;

/** Mappa di accoppiamento dei qubit: reticolo, heavy-hex (IBM), catena o anello. */
function chipParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const kind = kindOf(n.spec, CHIPS, 'grid');
  const pts: P2[] = [];
  const edges: [number, number][] = [];
  if (kind === 'grid') {
    const [R, C] = gridDims(n.spec, 3, 4);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) pts.push([c, r]);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (c + 1 < C) edges.push([r * C + c, r * C + c + 1]);
      if (r + 1 < R) edges.push([r * C + c, (r + 1) * C + c]);
    }
  } else if (kind === 'heavyhex') {
    const [R, C] = gridDims(n.spec, 3, 9);
    const row: number[][] = [];
    for (let r = 0; r < R; r++) {
      row.push([]);
      for (let c = 0; c < C; c++) {
        row[r].push(pts.length);
        pts.push([c, r * 2]);
        if (c) edges.push([pts.length - 2, pts.length - 1]);
      }
    }
    for (let r = 0; r + 1 < R; r++) {
      for (let c = r % 2 ? 2 : 0; c < C; c += 4) {
        pts.push([c, r * 2 + 1]);
        edges.push([row[r][c], pts.length - 1], [pts.length - 1, row[r + 1][c]]);
      }
    }
  } else {
    const k = clamp(Math.round(n.count), 2, 24);
    for (let i = 0; i < k; i++) pts.push(kind === 'ring' ? [Math.cos(TAU * (i / k) - Math.PI / 2), Math.sin(TAU * (i / k) - Math.PI / 2)] : [i, 0]);
    for (let i = 0; i + 1 < k; i++) edges.push([i, i + 1]);
    if (kind === 'ring' && k > 2) edges.push([k - 1, 0]);
  }
  const us = pts.map((p) => p[0]), vs = pts.map((p) => p[1]);
  const u0 = Math.min(...us), v0 = Math.min(...vs), du = Math.max(...us) - u0 || 1, dv = Math.max(...vs) - v0 || 1;
  const chip = has(n.spec, 'chip');
  const frame = chip ? Math.min(w, h) * 0.1 : 0;
  let m = 8;
  let s = Math.min((w - 2 * m - 2 * frame) / du, (h - 2 * m - 2 * frame) / dv);
  const step = kind === 'ring' ? s * (TAU / Math.max(3, pts.length)) : s;
  const r = clamp(step * 0.3, 2.5, 13);
  m = r + 1.5;
  s = Math.min((w - 2 * m - 2 * frame) / du, (h - 2 * m - 2 * frame) / dv);
  const ox = x + (w - du * s) / 2, oy = y + (h - dv * s) / 2;
  const at = (i: number): P2 => [ox + (pts[i][0] - u0) * s, oy + (pts[i][1] - v0) * s];
  const parts: Part[] = [];
  if (chip) {
    parts.push(box(x + 1, y + 1, w - 2, h - 2, 4, '#F3F1EC', '#8C8577', 1));
    const k = 6, pw = Math.min(w, h) * 0.05;
    for (let i = 0; i < k; i++) {
      const t = (i + 0.5) / k;
      parts.push(box(x + w * t - pw / 2, y + 2.5, pw, pw * 0.8, 0.6, '#D9C27A', 'none'), box(x + w * t - pw / 2, y + h - 2.5 - pw * 0.8, pw, pw * 0.8, 0.6, '#D9C27A', 'none'));
    }
  }
  const ink = inkOf(n, '#6C8EBF');
  const ew = clamp(r * 0.38, 1.2, 4);
  for (const [a, b] of edges) parts.push(line(seg(at(a), at(b)), mix(ink, '#FFFFFF', 0.35), ew));
  const nums = has(n.spec, 'numbers');
  pts.forEach((_, i) => {
    const [px, py] = at(i);
    parts.push(disc(px, py, r, n.fill === 'none' ? '#FFFFFF' : n.fill, ink, n.strokeWidth));
    if (nums && r >= 5) parts.push(text(px, py, String(i), clamp(r * (i > 9 ? 0.8 : 0.95), 5, 11), 'middle', n.textColor));
  });
  return parts;
}

const SURF_X = { fill: '#F9DCC4', stroke: '#D9822B' };
const SURF_Z = { fill: '#D4E4F5', stroke: '#5B8DD6' };

/** Codice di superficie ruotato di distanza `count`: qubit dati, stabilizzatori X/Z, ancille, errore. */
function surfaceParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const d = clamp(Math.round(n.count), 2, 9);
  const s = Math.min(w, h) / (d - 1 + 1.25);
  const ox = x + (w - (d - 1) * s) / 2, oy = y + (h - (d - 1) * s) / 2;
  const at = (i: number, j: number): P2 => [ox + i * s, oy + j * s];
  const type = (i: number, j: number) => ((((i + j) % 2) + 2) % 2 === 0 ? 'X' : 'Z');
  const sw = Math.max(0.8, n.strokeWidth * 0.8);
  const parts: Part[] = [];
  const faces: { i: number; j: number; t: 'X' | 'Z'; edge: '' | 'top' | 'bottom' | 'left' | 'right' }[] = [];
  for (let i = 0; i < d - 1; i++) for (let j = 0; j < d - 1; j++) faces.push({ i, j, t: type(i, j), edge: '' });
  for (let i = 0; i < d - 1; i++) {
    if (type(i, -1) === 'X') faces.push({ i, j: -1, t: 'X', edge: 'top' });
    if (type(i, d - 1) === 'X') faces.push({ i, j: d - 1, t: 'X', edge: 'bottom' });
  }
  for (let j = 0; j < d - 1; j++) {
    if (type(-1, j) === 'Z') faces.push({ i: -1, j, t: 'Z', edge: 'left' });
    if (type(d - 1, j) === 'Z') faces.push({ i: d - 1, j, t: 'Z', edge: 'right' });
  }
  const err = has(n.spec, 'error');
  const ei = Math.floor((d - 1) / 2), ej = Math.floor(d / 2);
  const flagged = (f: { i: number; j: number; t: string }) => err && f.t === 'Z' && ei >= f.i && ei <= f.i + 1 && ej >= f.j && ej <= f.j + 1;
  for (const f of faces) {
    const c = f.t === 'X' ? SURF_X : SURF_Z;
    const stroke = flagged(f) ? ACCENT : c.stroke;
    const fsw = flagged(f) ? sw * 2 : sw;
    if (!f.edge) {
      const [px, py] = at(f.i, f.j);
      parts.push(box(px, py, s, s, 0, flagged(f) ? '#F7C6C0' : c.fill, stroke, fsw));
    } else {
      const hor = f.edge === 'top' || f.edge === 'bottom';
      const [ax, ay] = hor ? at(f.i, f.edge === 'top' ? 0 : d - 1) : at(f.edge === 'left' ? 0 : d - 1, f.j);
      const cx = hor ? ax + s / 2 : ax, cy = hor ? ay : ay + s / 2;
      const a0 = { top: Math.PI, bottom: 0, left: Math.PI / 2, right: -Math.PI / 2 }[f.edge];
      parts.push(area([...arc(cx, cy, s / 2, a0, a0 + Math.PI), ['Z']], flagged(f) ? '#F7C6C0' : c.fill, stroke, fsw));
    }
  }
  const lab = has(n.spec, 'labels'), anc = has(n.spec, 'ancilla');
  for (const f of faces) {
    let [cx, cy] = at(f.i + 0.5, f.j + 0.5);
    if (f.edge === 'top') cy = oy - s * 0.2;
    if (f.edge === 'bottom') cy = oy + (d - 1) * s + s * 0.2;
    if (f.edge === 'left') cx = ox - s * 0.2;
    if (f.edge === 'right') cx = ox + (d - 1) * s + s * 0.2;
    const c = f.t === 'X' ? SURF_X : SURF_Z;
    if (anc) parts.push(box(cx - s * 0.09, cy - s * 0.09, s * 0.18, s * 0.18, s * 0.03, c.stroke, shade(c.stroke, -0.25), 0.8));
    else if (lab) parts.push(text(cx, cy, `$${f.t}$`, clamp(s * (f.edge ? 0.24 : 0.3), 6, 14), 'middle', shade(c.stroke, -0.35)));
  }
  const rq = clamp(s * 0.12, 2.2, 7);
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
    const [px, py] = at(i, j);
    parts.push(disc(px, py, rq, '#FFFFFF', inkOf(n), Math.max(0.9, n.strokeWidth)));
  }
  if (err) {
    const [px, py] = at(ei, ej);
    const k = rq * 0.75;
    parts.push(disc(px, py, rq, '#FDE2DE', ACCENT, 1.2), line([...seg([px - k, py - k], [px + k, py + k]), ...seg([px - k, py + k], [px + k, py - k])], ACCENT, 1.3));
  }
  if (has(n.spec, 'logical')) {
    const ys = oy + (d - 1) * s + rq + 4;
    parts.push(line(seg([ox, ys], [ox + (d - 1) * s, ys]), '#7E57C2', 1.6), text(ox + (d - 1) * s + rq + 2, ys + 1, '$X_L$', clamp(s * 0.28, 7, 12), 'start', '#7E57C2'));
  }
  return parts;
}

const LEVELS = ['transmon', 'harmonic', 'qubit'] as const;

/** Livelli energetici: qubit a due livelli, oscillatore armonico o transmon (anarmonico), con pozzo e transizioni. */
function levelsParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const kind = kindOf(n.spec, LEVELS, 'transmon');
  const L = kind === 'qubit' ? 2 : clamp(Math.round(n.count), 2, 6);
  const E = (k: number) => (kind === 'transmon' ? k + 0.5 - 0.06 * k * k : k + 0.5);
  const well = has(n.spec, 'well'), labels = has(n.spec, 'labels'), drive = has(n.spec, 'drive');
  const fs = clamp(Math.min(h / (L + 1.5), 13), 8, 13);
  const x0 = x + 3, x1 = x + w - (labels ? fs * 2.6 : 3);
  const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
  const yb = y + h - 3, yt = y + 4;
  const Emax = E(L - 1) + (well ? 0.55 : 0.35);
  const Y = (e: number) => yb - (e / Emax) * (yb - yt);
  const ink = inkOf(n);
  const parts: Part[] = [];
  const width = (e: number) => {
    if (!well) return 0.78;
    const r = e / Emax;
    return kind === 'transmon' ? Math.acos(clamp(1 - 2 * r, -1, 1)) / Math.PI : Math.sqrt(r);
  };
  if (well) {
    const pts = Array.from({ length: 81 }, (_, i): P2 => {
      const u = -1 + (2 * i) / 80;
      const v = kind === 'transmon' ? (1 - Math.cos(Math.PI * u)) / 2 : u * u;
      return [cx + u * hw, Y(v * Emax)];
    });
    if (n.fill !== 'none') parts.push(area([...pl(pts), ['L', cx + hw, yt], ['L', cx - hw, yt], ['Z']], tint(n.fill, 0.2)));
    parts.push(line(pl(pts), ink, n.strokeWidth * 1.1));
  }
  const lc = n.stroke === 'none' ? '#2F6FB2' : shade(n.stroke, -0.15);
  for (let k = 0; k < L; k++) {
    const e = E(k), hwk = hw * width(e) * (well ? 0.94 : 1);
    parts.push(line(seg([cx - hwk, Y(e)], [cx + hwk, Y(e)]), k < 2 ? lc : mix(lc, '#FFFFFF', 0.35), 1.6));
    if (labels) parts.push(text(x1 + 4, Y(e), `$|${k}\\rangle$`, fs, 'start', TEXT));
  }
  if (drive) {
    const hs = clamp(fs * 0.42, 3, 5);
    parts.push(...arrow([cx - hw * 0.12, Y(E(0)) - 1], [cx - hw * 0.12, Y(E(1)) + 1], ACCENT, 1.1, hs, true));
    parts.push(text(cx - hw * 0.12 - 4, (Y(E(0)) + Y(E(1))) / 2, '$\\omega_{01}$', fs * 0.9, 'end', ACCENT));
    if (L > 2) {
      parts.push(...arrow([cx + hw * 0.12, Y(E(1)) - 1], [cx + hw * 0.12, Y(E(2)) + 1], '#7E57C2', 1.1, hs, true));
      parts.push(text(cx + hw * 0.12 + 4, (Y(E(1)) + Y(E(2))) / 2, '$\\omega_{12}$', fs * 0.9, 'start', '#7E57C2'));
    }
  }
  return parts;
}

const DEVICES = ['transmon', 'ion', 'atom', 'fridge', 'chip', 'photon'] as const;
const GOLD = { fill: '#F1D592', stroke: '#B08A2E' };

/** Icone di piattaforme: transmon, trappola di ioni, atomi neutri, criostato, chip QPU, fotone. */
function deviceParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const kind = kindOf(n.spec, DEVICES, 'transmon');
  const ink = inkOf(n);
  const fill = n.fill === 'none' ? '#FFFFFF' : n.fill;
  const sw = n.strokeWidth;
  const X = (u: number) => x + u * w, Y = (v: number) => y + v * h;
  const parts: Part[] = [];
  switch (kind) {
    case 'transmon': {
      // substrato, due piazzole capacitive unite dalla giunzione Josephson (⊠), risonatore di lettura a meandro
      parts.push(box(X(0.02), Y(0.02), w * 0.96, h * 0.96, Math.min(w, h) * 0.06, tint(fill, 0.45), mix(ink, '#FFFFFF', 0.45), sw * 0.8));
      const py = Y(0.5), ph = h * 0.36;
      parts.push(box(X(0.1), py, w * 0.3, ph, 2.5, GOLD.fill, GOLD.stroke, sw), box(X(0.6), py, w * 0.3, ph, 2.5, GOLD.fill, GOLD.stroke, sw));
      const jy = py + ph / 2;
      parts.push(line(seg([X(0.4), jy], [X(0.6), jy]), GOLD.stroke, sw * 1.3));
      const k = Math.min(w * 0.06, h * 0.08);
      parts.push(box(X(0.5) - k, jy - k, 2 * k, 2 * k, 0, '#FFFFFF', ink, sw), line([...seg([X(0.5) - k, jy - k], [X(0.5) + k, jy + k]), ...seg([X(0.5) - k, jy + k], [X(0.5) + k, jy - k])], ink, sw));
      // meandro: dalla piazzola sinistra verso l'alto
      const mx: P2[] = [[X(0.25), py]];
      const levels = [0.4, 0.32, 0.24, 0.16];
      levels.forEach((v, i) => {
        const [a, b] = i % 2 ? [0.75, 0.25] : [0.25, 0.75];
        mx.push([X(a), Y(v)], [X(b), Y(v)]);
      });
      mx.push([X(0.25), Y(0.08)]);
      parts.push(line(pl(mx), shade(GOLD.stroke, -0.15), sw * 1.2));
      break;
    }
    case 'ion': {
      // trappola lineare: elettrodi a lama, catena di ioni, fascio laser su uno ione
      const cy = Y(0.5);
      const k = 5, r = Math.min(w / (k * 4.2), h * 0.08);
      // fascio laser che indirizza lo ione centrale passando fra gli elettrodi segmentati
      const bw = r * 1.3;
      parts.push(area(poly([[X(0.5) - bw * 1.6, Y(1)], [X(0.5) + bw * 1.6, Y(1)], [X(0.5) + bw * 0.5, cy], [X(0.5) - bw * 0.5, cy]]), tint('#E0525A', 0.6)));
      parts.push(line(seg([X(0.5), Y(1)], [X(0.5), cy + r]), '#D0414A', 1));
      parts.push(box(X(0.04), Y(0.08), w * 0.92, h * 0.2, 3, GOLD.fill, GOLD.stroke, sw));
      parts.push(box(X(0.04), Y(0.72), w * 0.44, h * 0.2, 3, GOLD.fill, GOLD.stroke, sw), box(X(0.52), Y(0.72), w * 0.44, h * 0.2, 3, GOLD.fill, GOLD.stroke, sw));
      for (const u of [0.27, 0.73]) parts.push(line(seg([X(u), Y(0.08)], [X(u), Y(0.28)]), GOLD.stroke, 0.8));
      for (let i = 0; i < k; i++) {
        const px = X(0.5) + (i - (k - 1) / 2) * r * 3.6;
        parts.push(disc(px, cy, r * 1.9, tint('#6FA8DC', 0.75)), disc(px, cy, r, '#2F6FB2', shade('#2F6FB2', -0.3), 0.8));
      }
      break;
    }
    case 'atom': {
      // schiera di pinzette ottiche: atomi intrappolati, siti vuoti, coppia di Rydberg
      const [R, C] = gridDims(n.spec, 3, 4);
      const s = Math.min(w / C, h / R);
      const ox = x + (w - s * (C - 1)) / 2, oy = y + (h - s * (R - 1)) / 2;
      const rand = rng(11 + R * C);
      const ry = [Math.floor(R / 2), Math.floor(C / 2) - 1];
      parts.push(box(ox + ry[1] * s - s * 0.42, oy + ry[0] * s - s * 0.38, s * 1.84, s * 0.76, s * 0.38, tint('#7E57C2', 0.82), '#7E57C2', 0.8));
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const px = ox + c * s, py = oy + r * s;
        const empty = rand() < 0.15 && !(r === ry[0] && (c === ry[1] || c === ry[1] + 1));
        parts.push(disc(px, py, s * 0.3, 'none', mix(ink, '#FFFFFF', 0.55), 0.7));
        if (!empty) parts.push(disc(px, py, s * 0.17, tint('#2F6FB2', 0.7)), disc(px, py, s * 0.1, '#2F6FB2'));
      }
      break;
    }
    case 'fridge': {
      // criostato a diluizione: piatti sempre più freddi, colonne e cavi coassiali, chip in fondo
      const plates = [0.06, 0.26, 0.44, 0.6, 0.74];
      const ws = [0.92, 0.78, 0.64, 0.52, 0.42];
      plates.forEach((v, i) => {
        if (i) {
          const pw = w * ws[i - 1];
          for (const u of [-0.36, 0.36]) parts.push(line(seg([X(0.5) + pw * u, Y(plates[i - 1] + 0.05)], [X(0.5) + w * ws[i] * u, Y(v)]), GOLD.stroke, sw));
          for (const u of [-0.12, 0, 0.12]) parts.push(line(seg([X(0.5) + w * u, Y(plates[i - 1] + 0.05)], [X(0.5) + w * u * 0.9, Y(v)]), '#8A9099', 0.8));
        }
        parts.push(box(X(0.5) - (w * ws[i]) / 2, Y(v), w * ws[i], h * 0.05, 1.5, GOLD.fill, GOLD.stroke, sw));
      });
      parts.push(line(seg([X(0.5), Y(0.79)], [X(0.5), Y(0.86)]), GOLD.stroke, sw * 1.4));
      parts.push(box(X(0.5) - w * 0.11, Y(0.86), w * 0.22, h * 0.11, 1.5, fill, ink, sw));
      for (const u of [-0.06, 0, 0.06]) parts.push(disc(X(0.5) + w * u, Y(0.915), Math.min(w, h) * 0.018, ink));
      break;
    }
    case 'chip': {
      // QPU in contenitore: piedini sui quattro lati e qubit al centro
      const k = 5, m = Math.min(w, h) * 0.16;
      const pin = Math.min(w, h) * 0.05;
      for (let i = 0; i < k; i++) {
        const u = (i + 0.5) / k;
        const px = x + m + (w - 2 * m) * u, py = y + m + (h - 2 * m) * u;
        parts.push(line([...seg([px, y + 1], [px, y + m]), ...seg([px, y + h - m], [px, y + h - 1]), ...seg([x + 1, py], [x + m, py]), ...seg([x + w - m, py], [x + w - 1, py])], mix(ink, '#FFFFFF', 0.2), pin));
      }
      parts.push(box(x + m, y + m, w - 2 * m, h - 2 * m, 4, fill, ink, sw));
      const iw = w - 2 * m, ih = h - 2 * m, g = 3;
      const q = (i: number, j: number): P2 => [x + m + iw * (0.25 + i * 0.25), y + m + ih * (0.25 + j * 0.25)];
      for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
        if (i + 1 < g) parts.push(line(seg(q(i, j), q(i + 1, j)), mix(ink, '#FFFFFF', 0.35), 1.2));
        if (j + 1 < g) parts.push(line(seg(q(i, j), q(i, j + 1)), mix(ink, '#FFFFFF', 0.35), 1.2));
      }
      for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) parts.push(disc(...q(i, j), Math.min(iw, ih) * 0.075, '#FFFFFF', ink, 1));
      break;
    }
    case 'photon': {
      // fotone: pacchetto d'onda con freccia
      const cy = Y(0.5), x0 = X(0.04), x1 = X(0.84);
      const pts = Array.from({ length: 121 }, (_, i): P2 => {
        const u = i / 120;
        const env = Math.exp(-(((u - 0.5) / 0.26) ** 2));
        return [x0 + (x1 - x0) * u, cy - h * 0.38 * env * Math.sin(TAU * 4 * u)];
      });
      parts.push(line(pl(pts), ink, Math.max(1.2, sw)));
      parts.push(...arrow([x1 - 2, cy], [X(0.98), cy], ink, Math.max(1.2, sw), clamp(h * 0.22, 4, 8)));
      break;
    }
  }
  return parts;
}

const POL = ['h', 'v', 'd', 'a', 'rect', 'diag'] as const;

/** Polarizzazione di un fotone (BB84): ↔ ↕ ⤢ ⤡ e basi + / ×. */
function polarParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const kind = kindOf(n.spec, POL, 'h');
  const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) / 2;
  const ink = inkOf(n);
  const parts: Part[] = [];
  if (has(n.spec, 'circle')) parts.push(disc(cx, cy, R - 0.5, n.fill === 'none' ? '#FFFFFF' : n.fill, ink, Math.max(0.8, n.strokeWidth * 0.8)));
  const L = has(n.spec, 'circle') ? R * 0.62 : R * 0.92;
  const angs = { h: [0], v: [90], d: [45], a: [135], rect: [0, 90], diag: [45, 135] }[kind];
  const col = n.textColor && n.textColor !== '#1A1A1A' ? n.textColor : ink;
  for (const a of angs) {
    const ux = Math.cos(a * DEG), uy = -Math.sin(a * DEG);
    parts.push(...arrow([cx - ux * L, cy - uy * L], [cx + ux * L, cy + uy * L], col, Math.max(1.2, n.strokeWidth), clamp(L * 0.42, 3, 8), true));
  }
  return parts;
}

// ---------------- varianti mostrate come pulsanti nel pannello ----------------

const c = (value: string, label: string) => ({ value, label });

const OPTIONS: Record<string, SpecGroup[]> = {
  'qc-bloch': [
    { title: 'φ (azimut)', choices: [c('phi=0', '0°'), c('phi=45', '45°'), c('phi=90', '90°'), c('phi=135', '135°'), c('phi=180', '180°'), c('phi=270', '270°')] },
    { title: 'Testo', mode: 'many', choices: [c('labels', '|0⟩ |1⟩ e assi'), c('angles', 'Angoli θ φ'), c('psi', 'Etichetta |ψ⟩')] },
  ],
  'qc-hist': [
    { title: 'Distribuzione', choices: [c('bell', 'Bell / GHZ'), c('uniform', 'Uniforme'), c('grover', 'Grover'), c('zero', 'Solo |0…0⟩'), c('random', 'Casuale')] },
    { title: 'Opzioni', mode: 'many', choices: [c('noisy', 'Rumore hardware'), c('values', 'Valori'), c('axis', 'Asse y')] },
  ],
  'qc-amps': [
    { title: 'Fase', choices: [c('uniform', 'Sovrapposizione'), c('oracle', 'Dopo l\'oracolo'), c('diffuse', 'Dopo la diffusione'), c('final', 'Dopo ~√N iterazioni')] },
    { title: 'Opzioni', mode: 'many', choices: [c('mean', 'Media μ'), c('labels', 'Stato marcato w')] },
  ],
  'qc-chip': [
    { title: 'Topologia', choices: [c('grid', 'Reticolo'), c('heavyhex', 'Heavy-hex (IBM)'), c('line', 'Catena'), c('ring', 'Anello')] },
    { title: 'Opzioni', mode: 'many', choices: [c('numbers', 'Numeri'), c('chip', 'Contenitore del chip')] },
  ],
  'qc-surface': [{ title: 'Opzioni', mode: 'many', choices: [c('ancilla', 'Qubit ancilla'), c('labels', 'Lettere X / Z'), c('error', 'Errore e sindrome'), c('logical', 'Operatore logico')] }],
  'qc-levels': [
    { title: 'Sistema', choices: [c('transmon', 'Transmon'), c('harmonic', 'Oscillatore armonico'), c('qubit', 'Due livelli')] },
    { title: 'Opzioni', mode: 'many', choices: [c('well', 'Potenziale'), c('labels', 'Etichette |n⟩'), c('drive', 'Transizioni')] },
  ],
  'qc-device': [
    { title: 'Piattaforma', choices: [c('transmon', 'Transmon'), c('ion', 'Ioni intrappolati'), c('atom', 'Atomi neutri'), c('fridge', 'Criostato'), c('chip', 'Chip QPU'), c('photon', 'Fotone')] },
  ],
  'qc-polar': [
    { title: 'Polarizzazione', choices: [c('h', '↔ 0°'), c('v', '↕ 90°'), c('d', '⤢ 45°'), c('a', '⤡ 135°'), c('rect', 'Base +'), c('diag', 'Base ×')] },
    { title: 'Opzioni', mode: 'many', choices: [c('circle', 'Cerchio')] },
  ],
};

const DEFS: Omit<ShapeDef, 'specOptions'>[] = [
  { kind: 'qc-bloch', name: 'Sfera di Bloch', parts: blochParts, countLabel: 'θ (gradi)', countMax: 180, specLabel: 'Opzioni' },
  { kind: 'qc-hist', name: 'Istogramma delle misure', parts: histParts, countLabel: 'Qubit', countMax: 5, specLabel: 'Probabilità o variante' },
  { kind: 'qc-amps', name: 'Ampiezze (Grover)', parts: ampsParts, countLabel: 'Stati', countMax: 32, specLabel: 'Fase' },
  { kind: 'qc-chip', name: 'Mappa dei qubit (chip)', parts: chipParts, countLabel: 'Qubit (catena, anello)', countMax: 24, specLabel: 'Topologia (es. grid 3x4)' },
  { kind: 'qc-surface', name: 'Codice di superficie', parts: surfaceParts, countLabel: 'Distanza d', countMax: 9, specLabel: 'Opzioni' },
  { kind: 'qc-levels', name: 'Livelli energetici', parts: levelsParts, countLabel: 'Livelli', countMax: 6, specLabel: 'Variante' },
  { kind: 'qc-device', name: 'Piattaforma (transmon, ioni…)', parts: deviceParts, specLabel: 'Piattaforma' },
  { kind: 'qc-polar', name: 'Polarizzazione (BB84)', parts: polarParts, specLabel: 'Polarizzazione' },
];

export const QUANTUM_SHAPES: ShapeDef[] = DEFS.map((d) => ({ ...d, specOptions: OPTIONS[d.kind] }));
