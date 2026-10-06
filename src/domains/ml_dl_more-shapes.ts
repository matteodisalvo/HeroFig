// Forme parametriche del modulo ml_dl_more, ricalcate sulle figure dei paper: teste MHA/GQA/MQA
// (Ainslie 2023), convoluzioni causali dilatate (WaveNet), attention a blocchi e gerarchia di
// memoria (FlashAttention), rotazione RoPE, grafi con attention (GAT, GraphSAGE), traiettorie
// ResNet/ODE, EWC, MAML, dispositivi federati, campi di PDE, processi gaussiani e Bayesian
// optimization. Tutto con primitive `Part` deterministiche: identiche in SVG, PDF, PNG e TikZ.
import { arc, mix, parseGrid, poly, rng, roundPoly, shade, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';
import { AXIS, CLS, area, arrow, clamp, clipHalf, dashes, disc, ellipsePts, gauss, line, marker, plotArea, seg, text, type P2 } from './ml-kit';

type N = NodeModel;

const words = (n: N) => n.spec.toLowerCase().split(/\s+/).filter(Boolean);
const has = (n: N, w: string) => words(n).includes(w);
const pick = <T extends string>(n: N, opts: T[], fallback: T): T => opts.find((o) => has(n, o)) ?? fallback;
const inkOf = (n: N) => (n.stroke === 'none' ? '#555555' : n.stroke);
const box = (x: number, y: number, w: number, h: number, fill: string, stroke?: string, sw?: number, r = 0): Part => ({ kind: 'rect', x, y, w, h, r, fill, stroke, sw, solid: true });
const one = (title: string, choices: SpecGroup['choices']): SpecGroup => ({ title, mode: 'one', choices });
const many = (title: string, choices: SpecGroup['choices']): SpecGroup => ({ title, mode: 'many', choices });
const INK = '#1A1A1A';

/** Punta di freccia piena con la punta in `at`, diretta come (dx, dy). */
function tip(at: P2, dx: number, dy: number, size: number, color: string): Part {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const bx = at[0] - ux * size, by = at[1] - uy * size;
  const hw = size * 0.42;
  return area(poly([at, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]), color);
}

/** Punto a distanza `d` da `a` verso `b`. */
function toward(a: P2, b: P2, d: number): P2 {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [a[0] + ((b[0] - a[0]) / l) * d, a[1] + ((b[1] - a[1]) / l) * d];
}

/** Linea ondulata da `a` a `b` (le teste "a zig-zag" delle figure di GAT). */
function wavy(a: P2, b: P2, amp: number, period: number): Cmd[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
  const k = Math.max(8, Math.round((l / period) * 8));
  const pts: P2[] = [];
  for (let i = 0; i <= k; i++) {
    const s = (l * i) / k;
    const o = Math.sin((s / period) * Math.PI * 2) * amp * Math.min(1, s / period, (l - s) / period);
    pts.push([a[0] + ux * s - uy * o, a[1] + uy * s + ux * o]);
  }
  return poly(pts, false);
}

/** Graffa orizzontale aperta verso l'alto (punta al centro, in basso). */
function braceDown(x0: number, x1: number, y: number, d: number): Cmd[] {
  const m = (x0 + x1) / 2, q = Math.min(d, (x1 - x0) / 4);
  return [
    ['M', x0, y], ['C', x0, y + d * 0.5, x0 + q * 0.4, y + d * 0.5, x0 + q, y + d * 0.5], ['L', m - q, y + d * 0.5],
    ['C', m - q * 0.4, y + d * 0.5, m, y + d * 0.5, m, y + d], ['C', m, y + d * 0.5, m + q * 0.4, y + d * 0.5, m + q, y + d * 0.5],
    ['L', x1 - q, y + d * 0.5], ['C', x1 - q * 0.4, y + d * 0.5, x1, y + d * 0.5, x1, y],
  ];
}

// ======================================================================
// Multi-head / grouped-query / multi-query attention (Ainslie et al. 2023, Fig. 2)
// ======================================================================

const KEY = { fill: '#F8CECC', stroke: '#B85450' };
const VAL = { fill: '#FFE6CC', stroke: '#D79B00' };
/** Frazioni d'altezza delle righe values, keys, queries (per allineare le etichette nei modelli). */
export const QKV_ROWS = { h: 0.27, v: 0, k: 0.355, q: 0.73 };

function qkvHeads(n: N): Part[] {
  const { x, y, w, h } = n;
  const H = clamp(Math.round(n.count), 1, 16);
  const mode = pick(n, ['mha', 'gqa', 'mqa'], 'gqa');
  const gm = /\bg(\d+)\b/.exec(n.spec.toLowerCase());
  const G = mode === 'mha' ? H : mode === 'mqa' ? 1 : clamp(gm ? +gm[1] : Math.max(1, Math.round(H / 2)), 1, H);
  const slot = w / H;
  const bw = slot * 0.68;
  const rh = h * QKV_ROWS.h;
  const yv = y, yk = y + h * QKV_ROWS.k, yq = y + h * QKV_ROWS.q;
  const r = Math.min(bw * 0.22, 4);
  const sw = n.strokeWidth;
  const qc = (i: number) => x + slot * (i + 0.5);
  const grp = (i: number) => Math.floor((i * G) / H);
  const kc = Array.from({ length: G }, (_, g) => {
    const idx = Array.from({ length: H }, (_, i) => i).filter((i) => grp(i) === g);
    return idx.reduce((s, i) => s + qc(i), 0) / Math.max(1, idx.length);
  });
  const links: Cmd[] = [];
  const heads: Part[] = [];
  const dash = clamp(h * 0.014, 2, 3.2);
  for (let i = 0; i < H; i++) {
    const a: P2 = [qc(i), yq];
    const b: P2 = [kc[grp(i)], yk + rh];
    links.push(...dashes([a, mode === 'mha' ? [b[0], b[1] + 4] : b], dash, dash * 0.8));
    if (mode === 'mha') heads.push(tip(b, 0, -1, 4, '#444444'));
  }
  const parts: Part[] = [line(links, '#444444', 0.8), ...heads];
  const cell = (cx: number, top: number, c: { fill: string; stroke: string }): Part => box(cx - bw / 2, top, bw, rh, c.fill, c.stroke, sw, r);
  for (const cx of kc) parts.push(cell(cx, yv, VAL), cell(cx, yk, KEY));
  const Q = { fill: n.fill, stroke: inkOf(n) };
  for (let i = 0; i < H; i++) parts.push(cell(qc(i), yq, Q));
  return parts;
}

// ======================================================================
// Pila di convoluzioni causali (dilatate) di WaveNet (van den Oord et al. 2016, Fig. 2 e 3)
// ======================================================================

function dilated(n: N): Part[] {
  const { x, y, w, h } = n;
  const L = clamp(Math.round(n.count), 1, 5);
  const std = has(n, 'standard');
  const M = std ? Math.max(8, 4 * L) : Math.max(4, 2 ** L);
  const labels = has(n, 'labels');
  const dy = h / (L + 1);
  const fs = clamp(dy * 0.24, 6.5, 10.5);
  const lw = labels ? w - fs * 7.4 : w;
  const dx = lw / M;
  const r = clamp(Math.min(dx, dy) * 0.3, 1.5, 8);
  const P = (l: number, i: number): P2 => [x + dx * (i + 0.5), y + h - dy * (l + 0.5)];
  const dil = (l: number) => (std ? 1 : 2 ** (l - 1));
  const grid: Cmd[] = [];
  for (let l = 1; l <= L; l++)
    for (let i = 0; i < M; i++)
      for (const j of [i, i - dil(l)]) if (j >= 0) grid.push(...dashes([P(l - 1, j), P(l, i)], 2.2, 2));
  // campo recettivo dell'ultima uscita
  const path = new Set<string>();
  const todo: [number, number][] = [[L, M - 1]];
  while (todo.length) {
    const [l, i] = todo.pop()!;
    if (l === 0) continue;
    for (const j of [i, i - dil(l)]) {
      const key = `${l}:${i}:${j}`;
      if (j < 0 || path.has(key)) continue;
      path.add(key);
      todo.push([l - 1, j]);
    }
  }
  const parts: Part[] = [line(grid, '#C9CED6', 0.6)];
  const asw = clamp(r * 0.26, 0.8, 1.3), as = clamp(r * 1.15, 3, 5.5);
  for (const key of path) {
    const [l, i, j] = key.split(':').map(Number);
    const a = P(l - 1, j), b = P(l, i);
    parts.push(...arrow(toward(a, b, r), toward(b, a, r + 0.4), '#2B2B2B', asw, as));
  }
  const HID = { fill: '#FFFFFF', stroke: '#555555' };
  for (let l = 0; l <= L; l++)
    for (let i = 0; i < M; i++) {
      const c = l === 0 ? CLS[0] : l === L ? CLS[1] : HID;
      parts.push(disc(...P(l, i), r, c.fill, c.stroke, 0.8));
    }
  if (labels)
    for (let l = 0; l <= L; l++) {
      const [, cy] = P(l, 0);
      const lx = x + lw + fs * 0.6;
      const name = l === 0 ? 'Input' : l === L ? 'Output' : 'Hidden Layer';
      if (l === 0) parts.push(text(lx, cy, name, fs, INK, 'start', true));
      else parts.push(text(lx, cy - fs * 0.62, name, fs, INK, 'start', true), text(lx, cy + fs * 0.62, `Dilation = ${dil(l)}`, fs * 0.92, '#333333', 'start'));
    }
  return parts;
}

// ======================================================================
// FlashAttention (Dao et al. 2022, Fig. 1): matrice di attention a blocchi e gerarchia di memoria
// ======================================================================

const SRAM = { fill: '#FFC48A', stroke: '#D97900' };

function tiles(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = inkOf(n);
  const B = clamp(parseGrid(n.spec, 4)[0], 2, 12);
  const causal = has(n, 'causal');
  const cur = Math.round(n.count);
  const cw = w / B, ch = h / B;
  const parts: Part[] = [box(x, y, w, h, fill, 'none')];
  // ciclo esterno sulle colonne (blocchi di K, V), interno sulle righe (blocchi di Q)
  for (let j = 0; j < B; j++)
    for (let i = 0; i < B; i++) {
      const k = j * B + i + 1;
      const masked = causal && j > i;
      const f = masked ? '#EDEDED' : k === cur ? SRAM.fill : cur > 0 && k < cur ? mix(fill === 'none' ? '#FFFFFF' : fill, ink, 0.22) : null;
      if (f) parts.push(box(x + j * cw, y + i * ch, cw, ch, f, 'none'));
    }
  const fine: Cmd[] = [];
  for (let i = 1; i < 2 * B; i++) if (i % 2) fine.push(...seg([x + (i * cw) / 2, y], [x + (i * cw) / 2, y + h]), ...seg([x, y + (i * ch) / 2], [x + w, y + (i * ch) / 2]));
  const coarse: Cmd[] = [];
  for (let i = 1; i < B; i++) coarse.push(...seg([x + i * cw, y], [x + i * cw, y + h]), ...seg([x, y + i * ch], [x + w, y + i * ch]));
  parts.push(line(fine, shade(ink, 0.6), 0.4), line(coarse, ink, n.strokeWidth * 0.7));
  if (cur > 0 && cur <= B * B) {
    const j = Math.floor((cur - 1) / B), i = (cur - 1) % B;
    if (!(causal && j > i)) parts.push(box(x + j * cw, y + i * ch, cw, ch, 'none', SRAM.stroke, n.strokeWidth * 1.3));
  }
  parts.push(box(x, y, w, h, 'none', ink, n.strokeWidth));
  return parts;
}

const MEM = [
  { name: ['GPU', 'SRAM'], spec: ['SRAM: 19 TB/s (20 MB)'], fill: '#FFC48A', stroke: '#D97900' },
  { name: ['GPU', 'HBM'], spec: ['HBM: 1.5 TB/s (40 GB)'], fill: '#B5DCA8', stroke: '#4E8F3A' },
  { name: ['Main Memory', '(CPU DRAM)'], spec: ['DRAM: 12.8 GB/s', '(>1 TB)'], fill: '#A9DAD3', stroke: '#2F8A80' },
];

function memHier(n: N): Part[] {
  const { x, y, w, h } = n;
  const bw = has(n, 'bw');
  const pw = bw ? w * 0.5 : w;
  const cx = x + pw / 2;
  const T = [0, 0.3, 0.58, 1];
  const half = (t: number) => (pw / 2) * t;
  const fs = clamp(Math.min(h * 0.085, pw * 0.075), 6, 12);
  const parts: Part[] = [];
  MEM.forEach((m, k) => {
    const t0 = T[k], t1 = T[k + 1];
    const y0 = y + h * t0, y1 = y + h * t1;
    const pts: P2[] = k === 0 ? [[cx, y0], [cx + half(t1), y1], [cx - half(t1), y1]] : [[cx - half(t0), y0], [cx + half(t0), y0], [cx + half(t1), y1], [cx - half(t1), y1]];
    parts.push({ kind: 'path', cmds: poly(pts), fill: m.fill, stroke: m.stroke, sw: n.strokeWidth, solid: true });
    const s = k === 0 ? fs * 0.7 : fs;
    const ym = k === 0 ? y0 + (y1 - y0) * 0.68 : (y0 + y1) / 2;
    m.name.forEach((t, i) => parts.push(text(cx, ym + (i - (m.name.length - 1) / 2) * s * 1.12, t, s, shade(m.stroke, -0.5), 'middle', true)));
    if (bw) {
      const tx = cx + half((t0 + t1) / 2) + fs * 0.6;
      m.spec.forEach((t, i) => parts.push(text(tx, (y0 + y1) / 2 + (i - (m.spec.length - 1) / 2) * fs * 1.1, t, fs * 0.92, shade(m.stroke, -0.35), 'start', i === 0)));
    }
  });
  return parts;
}

// ======================================================================
// RoPE (Su et al. 2021, Fig. 1): rotazione della coppia (x1, x2) di m·θ1 e vettori query/key
// ======================================================================

function rotation(n: N): Part[] {
  const { x, y, w, h } = n;
  const vec = inkOf(n);
  const O: P2 = [x + w * 0.4, y + h * 0.72];
  const R = Math.min(w * 0.52, h * 0.66);
  const a1 = 0.36, a2 = 1.08;
  const pt = (a: number, r = R): P2 => [O[0] + r * Math.cos(a), O[1] - r * Math.sin(a)];
  const T1 = pt(a1), T2 = pt(a2);
  const fs = clamp(Math.min(w, h) * 0.11, 7, 13);
  const dl = clamp(R * 0.05, 2, 3.5);
  const proj = (p: P2): Cmd[] => [...dashes([p, [p[0], O[1]]], dl, dl * 0.8), ...dashes([p, [O[0], p[1]]], dl, dl * 0.8)];
  const parts: Part[] = [
    line([...seg([x + w * 0.04, O[1]], [x + w * 0.98, O[1]]), ...seg([O[0], y + h * 0.02], [O[0], y + h])], INK, clamp(R * 0.025, 1.1, 2)),
    line([...proj(T1), ...proj(T2)], mix(vec, '#FFFFFF', 0.15), 0.9),
    ...arrow(O, T1, vec, clamp(R * 0.02, 1.1, 1.8), clamp(R * 0.07, 4, 7)),
    ...arrow(O, T2, vec, clamp(R * 0.02, 1.1, 1.8), clamp(R * 0.07, 4, 7)),
  ];
  // arco della rotazione m·θ1 (verso antiorario)
  const rr = R * 1.08, b0 = -(a1 + 0.3), b1 = -(a2 - 0.04);
  const end: P2 = [O[0] + rr * Math.cos(b1), O[1] + rr * Math.sin(b1)];
  parts.push(line(arc(O[0], O[1], rr, b0, b1 + 0.08), INK, 1.3), tip(end, Math.sin(b1), -Math.cos(b1), clamp(R * 0.08, 4, 7), INK));
  if (!has(n, 'nolabels')) {
    const below = O[1] + fs * 1.05;
    parts.push(
      text(T1[0], below, '$x_1$', fs, INK),
      text(T2[0], below, "$x'_1$", fs, INK),
      text(O[0] - fs * 0.4, T1[1], '$x_2$', fs, INK, 'end'),
      text(O[0] - fs * 0.4, T2[1], "$x'_2$", fs, INK, 'end'),
      text(end[0] + fs * 0.5, end[1] - fs * 0.15, '$m\\theta_1$', fs, '#D62828', 'start', true),
    );
  }
  return parts;
}

/** Colori delle coppie θ1, θ2, …, θd/2 e delle posizioni 1…6 della figura di RoPE. */
export const ROPE_PAIR = ['#C5D6CB', '#EDB9B9', '#F4D2B4', '#9DBCE6'];
export const ROPE_POS = ['#E5484D', '#A39A2E', '#2F9E44', '#1B998B', '#22B8D6', '#24307A'];
/** Centri x delle coppie di un vettore query/key largo w (8 celle + puntini). */
export const ropePairX = (x: number, w: number) => {
  const cw = w / 9.6;
  return [1, 3, 6.6, 8.6].map((u) => x + cw * u);
};

function ropeVec(n: N): Part[] {
  const { x, y, w, h } = n;
  const pair = has(n, 'pair');
  const m = Math.round(n.count);
  const cells = pair ? 2 : 8;
  const cw = pair ? w / 2 : w / 9.6;
  const sw = n.strokeWidth * 0.8;
  const parts: Part[] = [];
  for (let c = 0; c < cells; c++) {
    const f = ROPE_PAIR[Math.floor(c / 2)];
    const cx0 = x + cw * (c + (c >= 4 ? 1.6 : 0));
    parts.push(box(cx0, y, cw, h, f, 'none'));
    if (m > 0) {
      const pc = ROPE_POS[(m - 1) % ROPE_POS.length];
      for (let b = 0; b < 4; b++) parts.push(box(cx0, y + h * (0.5 + b * 0.125), cw, h * 0.125 + 0.3, mix(f, pc, 0.2 + 0.2 * b), 'none'));
    }
    parts.push(box(cx0, y, cw, h, 'none', INK, sw));
  }
  if (!pair) {
    const rd = Math.min(cw * 0.09, h * 0.09);
    for (const k of [-1, 0, 1]) parts.push(disc(x + cw * 4.8 + k * rd * 3.2, y + h / 2, rd, INK));
  }
  if (has(n, 'hl')) parts.push(box(x - 2.5, y - 2.5, cw * 2 + 5, h + 5, 'none', '#9E9E9E', 1.6, 2));
  return parts;
}

// ======================================================================
// GAT (Veličković et al. 2018, Fig. 1): meccanismo di attention e attention multi-testa sul vicinato
// ======================================================================

function gatMech(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = inkOf(n);
  const fs = clamp(Math.min(w * 0.065, h * 0.06), 7, 13);
  const r = clamp(w * 0.03, 2.5, 7);
  const R = clamp(Math.min(w, h) * 0.085, 6, 16);
  const by = y + h * 0.74;
  const gap = w * 0.07;
  const gw = (w - gap) / 2;
  const pts: P2[] = [];
  for (let g = 0; g < 2; g++) for (let k = 0; k < 4; k++) pts.push([x + g * (gw + gap) + (gw * (k + 0.5)) / 4, by]);
  const C: P2 = [x + w / 2, y + h * 0.43];
  const A: P2 = [x + w / 2, y + h * 0.085];
  const Ra = R * 0.92;
  const parts: Part[] = [];
  for (const p of pts) parts.push(...arrow(toward(p, C, r), toward(C, p, R + 0.6), ink, 0.9, clamp(R * 0.4, 3.5, 5.5)));
  parts.push(...arrow([C[0], C[1] - R], [A[0], A[1] + Ra + 0.5], ink, 1, clamp(R * 0.42, 4, 6)));
  parts.push(disc(C[0], C[1], R, fill, ink, n.strokeWidth), disc(A[0], A[1], Ra, fill, ink, n.strokeWidth));
  parts.push(line(poly([[C[0] - R * 0.55, C[1] + R * 0.24], [C[0] - R * 0.02, C[1] + R * 0.1], [C[0] + R * 0.5, C[1] - R * 0.45]], false), ink, 1.2));
  parts.push(text(A[0], A[1], '$\\alpha_{ij}$', fs, INK), text(C[0] + fs * 0.45, (C[1] - R + A[1] + Ra) / 2, '$\\mathrm{softmax}_j$', fs * 0.9, INK, 'start'));
  for (const p of pts) parts.push(disc(p[0], p[1], r, fill, ink, 0.9));
  const d = fs * 0.75;
  for (let g = 0; g < 2; g++) {
    const x0 = x + g * (gw + gap) + gw * 0.04, x1 = x + g * (gw + gap) + gw * 0.96;
    parts.push(line(braceDown(x0, x1, by + r + 3, d), INK, 1.1));
    parts.push(text((x0 + x1) / 2, by + r + 3 + d + fs * 0.85, g ? '$\\mathbf{W}\\vec{h}_j$' : '$\\mathbf{W}\\vec{h}_i$', fs, INK));
  }
  parts.push(text(x + w * 0.8, y + h * 0.55, '$\\mathbf{a}$', fs, INK, 'start', true));
  return parts;
}

const HEADS = ['#2F55D4', '#2E9E3E', '#9B30D9'];
const STAR: P2[] = [[-0.75, -0.75], [-1, 0], [-0.75, 0.75], [0, 1.05], [0.75, 0.75]];

function gatStar(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = inkOf(n);
  const K = clamp(Math.round(n.count), 1, 3);
  const out = !has(n, 'noout');
  const D = Math.min(h / 2.23, w / (out ? 3.25 : 2.2));
  const R = D * 0.19;
  const cx = x + R + D + 2, cy = y + R + 0.8 * D;
  const C: P2 = [cx, cy];
  const fs = clamp(R * 0.62, 7, 13);
  const gapK = R * 0.3;
  const parts: Part[] = [];
  const lines = (a: P2, b: P2, faded = 0) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
    for (let k = 0; k < K; k++) {
      const o = (k - (K - 1) / 2) * gapK;
      const s: P2 = [a[0] - uy * o, a[1] + ux * o], e: P2 = [b[0] - uy * o, b[1] + ux * o];
      const c = mix(HEADS[k], '#FFFFFF', faded);
      const end = toward(e, s, 4);
      parts.push(line(k === 0 ? seg(s, end) : wavy(s, end, R * 0.09, R * 0.42 + k * R * 0.08), c, 1.1));
      if (!faded) parts.push(tip(e, ux, uy, 5, c));
    }
  };
  STAR.forEach(([u, v], j) => {
    const P: P2 = [cx + u * D, cy + v * D];
    lines(toward(P, C, R + 1), toward(C, P, R + 1));
    const l = Math.hypot(C[0] - P[0], C[1] - P[1]);
    const nx = -(C[1] - P[1]) / l, ny = (C[0] - P[0]) / l;
        const off = gapK * (K - 1) * 0.5 + fs * 0.95;
    const mx = (P[0] + C[0]) / 2 + nx * off, my = (P[1] + C[1]) / 2 + ny * off;
    parts.push(text(mx, my, `$\\vec{\\alpha}_{1${j + 2}}$`, fs * 0.92, INK));
  });
  // auto-anello α11
  for (let k = 0; k < K; k++) {
    const hk = R * (1.05 + 0.32 * k), wk = R * (0.55 + 0.25 * k);
    const s: P2 = [cx - R * 0.42, cy - R * 0.9], e: P2 = [cx + R * 0.42, cy - R * 0.9];
    const c1: P2 = [s[0] - wk, s[1] - hk], c2: P2 = [e[0] + wk, e[1] - hk];
    parts.push(line([['M', ...s], ['C', ...c1, ...c2, ...toward(e, c2, 3)]], HEADS[k], 1.1), tip(e, e[0] - c2[0], e[1] - c2[1], 4.5, HEADS[k]));
  }
  parts.push(text(cx, cy - R * 0.9 - R * (1.05 + 0.32 * (K - 1)) * 0.75 - fs * 0.85, '$\\vec{\\alpha}_{11}$', fs * 0.92, INK));
  if (out) {
    const O: P2 = [cx + 1.85 * D, cy];
    lines([cx + R + 1, cy], [O[0] - R - 7, cy], 0.35);
    parts.push(...arrow([O[0] - R - 9, cy], [O[0] - R - 1, cy], '#2A3F9E', 1.6, 6));
    parts.push(text((cx + R + O[0] - R) / 2 + R * 0.4, cy - gapK * K * 0.5 - fs * 0.8, 'concat/avg', fs, INK));
    parts.push(disc(O[0], O[1], R, fill, ink, n.strokeWidth), text(O[0], O[1], "$\\vec{h}'_1$", fs, INK));
  }
  STAR.forEach(([u, v], j) => {
    parts.push(disc(cx + u * D, cy + v * D, R, fill, ink, n.strokeWidth), text(cx + u * D, cy + v * D, `$\\vec{h}_${j + 2}$`, fs, INK));
  });
  parts.push(disc(cx, cy, R, fill, ink, n.strokeWidth), text(cx, cy, '$\\vec{h}_1$', fs, INK));
  return parts;
}

// ======================================================================
// GraphSAGE (Hamilton et al. 2017, Fig. 1): campionamento, aggregazione, predizione
// ======================================================================

type SageKind = 't' | 'a' | 'b' | 'o';
const SAGE_NODES: [number, number, SageKind][] = [
  [0.5, 0.5, 't'], [0.39, 0.31, 'a'], [0.66, 0.6, 'a'], [0.43, 0.68, 'a'],
  [0.21, 0.17, 'b'], [0.13, 0.42, 'b'], [0.86, 0.5, 'b'], [0.63, 0.88, 'b'], [0.27, 0.88, 'b'],
  [0.35, 0.5, 'o'], [0.6, 0.38, 'o'], [0.6, 0.14, 'o'], [0.78, 0.25, 'o'], [0.1, 0.67, 'o'], [0.81, 0.74, 'o'],
];
const SAGE_EDGES: [number, number][] = [[0, 9], [0, 10], [9, 13], [10, 11], [10, 12], [10, 2], [7, 14], [6, 14], [4, 5]];
const SAGE_TREE: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 6], [2, 7], [3, 8]];
/** Il nodo target sta al centro del quadrato inscritto nella forma. */
export const SAGE_R = 0.032;

function sage(n: N): Part[] {
  const { x, y, w, h } = n;
  const mode = pick(n, ['sample', 'aggregate', 'predict'], 'sample');
  const s = Math.min(w, h);
  const ox = x + (w - s) / 2, oy = y + (h - s) / 2;
  const P = (i: number): P2 => [ox + SAGE_NODES[i][0] * s, oy + SAGE_NODES[i][1] * s];
  const r = s * SAGE_R;
  const fs = clamp(s * 0.05, 7, 12);
  const GREY = '#C4C4C4';
  const RED = { fill: '#B03A2E', stroke: '#5A1A14' };
  const look: Record<SageKind, { fill: string; stroke: string }> =
    mode === 'sample'
      ? { t: RED, a: { fill: '#CD6155', stroke: '#7B2D26' }, b: { fill: '#CD6155', stroke: '#7B2D26' }, o: { fill: '#FFFFFF', stroke: INK } }
      : mode === 'aggregate'
        ? { t: RED, a: { fill: '#3B6FD8', stroke: '#1F3F86' }, b: { fill: '#2F5A1F', stroke: '#173010' }, o: { fill: '#FFFFFF', stroke: GREY } }
        : { t: RED, a: { fill: '#FFFFFF', stroke: GREY }, b: { fill: '#FFFFFF', stroke: GREY }, o: { fill: '#FFFFFF', stroke: GREY } };
  const edgeInk = mode === 'sample' ? INK : GREY;
  const all = [...SAGE_EDGES, ...SAGE_TREE];
  const parts: Part[] = [line(all.flatMap(([a, b]) => seg(P(a), P(b))), edgeInk, mode === 'sample' ? 1.1 : 1)];
  if (mode === 'sample') {
    const c = P(0);
    const dl = Math.max(1.2, s * 0.008);
    parts.push(line([...dashes(ellipsePts(c[0], c[1], s * 0.27, s * 0.27, 0, 90), dl, dl, true), ...dashes(ellipsePts(c[0], c[1], s * 0.49, s * 0.49, 0, 140), dl, dl, true)], INK, 1));
    for (const [a, b] of SAGE_TREE) {
      const A = P(a), B = P(b);
      const l = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const o = 1.6, nx = -(B[1] - A[1]) / l * o, ny = (B[0] - A[0]) / l * o;
      parts.push(...arrow(toward([A[0] + nx, A[1] + ny], B, r), toward([B[0] + nx, B[1] + ny], A, r + 0.5), '#B9773B', clamp(s * 0.009, 1.4, 2.6), clamp(s * 0.03, 4.5, 8)));
    }
    parts.push(text(c[0] + s * 0.06, c[1] + s * 0.205, 'k=1', fs, INK, 'middle', true), text(c[0] - s * 0.04, c[1] + s * 0.445, 'k=2', fs, INK, 'middle', true));
  }
  if (mode === 'aggregate') {
    for (const [a, b] of SAGE_TREE) {
      const A = P(b), B = P(a);
      const c = a === 0 ? '#5B8DEF' : '#4E7F35';
      parts.push(...arrow(toward(A, B, r), toward(B, A, r + 0.5), c, clamp(s * 0.012, 1.6, 3.2), clamp(s * 0.032, 5, 9)));
    }
    // vettori di feature [x1 … xm] accanto ai vicini campionati
    for (let i = 1; i <= 8; i++) {
      const [px, py] = P(i);
      const vx = px + (SAGE_NODES[i][0] > 0.5 ? r * 1.4 : -r * 1.4 - s * 0.03), vy = py - s * 0.115;
      const vw = s * 0.036, vh = s * 0.12, b = vw * 0.3;
      const ticks: Cmd[] = [];
      for (let k = 0; k < 4; k++) ticks.push(...seg([vx + vw * 0.3, vy + vh * (0.17 + k * 0.22)], [vx + vw * 0.7, vy + vh * (0.17 + k * 0.22)]));
      parts.push(line([['M', vx + b, vy], ['L', vx, vy], ['L', vx, vy + vh], ['L', vx + b, vy + vh], ['M', vx + vw - b, vy], ['L', vx + vw, vy], ['L', vx + vw, vy + vh], ['L', vx + vw - b, vy + vh], ...ticks], '#666666', 0.7));
    }
  }
  SAGE_NODES.forEach(([, , k], i) => parts.push(disc(...P(i), r, look[k].fill, look[k].stroke, clamp(s * 0.005, 0.9, 1.6))));
  return parts;
}

// ======================================================================
// Neural ODE (Chen et al. 2018, Fig. 1): rete residua (passi discreti) vs rete ODE (flusso continuo)
// ======================================================================

const odeRate = (t: number) => -0.42 + 1.05 / (1 + Math.exp(-(t - 2.3) * 2.4));
const odeField = (hv: number, t: number) => hv * odeRate(t) + 0.35 * Math.sin(hv * 0.9) * Math.exp(-((t - 1) ** 2));

function odeFlow(n: N): Part[] {
  const ode = has(n, 'ode');
  const fs = clamp(Math.min(n.w, n.h) * 0.06, 6.5, 10);
  const p = plotArea(n, { l: (fs * 2.6) / n.w, r: 0.03, t: (fs * 1.8) / n.h, b: (fs * 3.4) / n.h });
  const X = (hv: number) => p.X((hv + 7) / 14);
  const Y = (t: number) => p.Y(t / 5);
  const parts: Part[] = [box(n.x, n.y, n.w, n.h, n.fill, n.stroke === 'none' ? 'none' : undefined, n.strokeWidth, n.radius)];
  // campo vettoriale (colori tenui: blu a sinistra, giallo al centro, rosso a destra)
  const rows = ode ? [0.25, 0.65, 1.05, 1.45, 1.85, 2.25, 2.65, 3.05, 3.45, 3.85, 4.25, 4.65] : [0.3, 1.3, 2.3, 3.3, 4.3];
  const cols = Array.from({ length: 11 }, (_, i) => -6.5 + i * 1.3);
  const len = Math.min((p.x1 - p.x0) / 13, (p.y1 - p.y0) / (ode ? 14 : 8));
  for (const t of rows)
    for (const hv of cols) {
      const a: P2 = [X(hv), Y(t)];
      const dx = X(hv + odeField(hv, t)) - a[0], dy = Y(t + 1) - a[1];
      const l = Math.hypot(dx, dy) || 1;
      const b: P2 = [a[0] + (dx / l) * len, a[1] + (dy / l) * len];
      const c = hv < -1 ? '#BDB0E3' : hv > 1 ? '#F3AFAF' : '#F5DDA0';
      parts.push(...arrow(a, b, c, 0.9, Math.min(4, len * 0.45)));
    }
  const starts = [-3.4, -2.5, -1.6, -0.75, 0.15, 1.0, 1.8, 2.7, 3.5];
  const clip = { ...p.clip, x: p.x0 - 3, w: p.x1 - p.x0 + 6, y: p.y0 - 3, h: p.y1 - p.y0 + 6 };
  starts.forEach((h0, k) => {
    const traj: P2[] = [];
    const dots: P2[] = [];
    let hv = h0;
    if (!ode) {
      for (let t = 0; t <= 5; t++) {
        traj.push([X(hv), Y(t)]);
        dots.push([X(hv), Y(t)]);
        hv += odeField(hv, t);
      }
    } else {
      const evals = new Set([0, 0.3, 0.75, 1.3, 1.85, 2.3, 2.65, 2.95, 3.3, 3.7, 4.15, 4.6].map((t) => Math.round((t + (t > 0 ? ((k * 37) % 7) * 0.025 : 0)) * 100)));
      const dt = 0.01;
      for (let i = 0; i <= 500; i++) {
        const t = i * dt;
        if (i % 4 === 0 || i === 500) traj.push([X(hv), Y(t)]);
        if (evals.has(i)) dots.push([X(hv), Y(t)]);
        const k1 = odeField(hv, t), k2 = odeField(hv + (dt / 2) * k1, t + dt / 2), k3 = odeField(hv + (dt / 2) * k2, t + dt / 2), k4 = odeField(hv + dt * k3, t + dt);
        hv += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      }
    }
    parts.push(line(poly(traj, false), INK, 1, { clip }));
    for (const d of dots) if (d[0] > p.x0 && d[0] < p.x1) parts.push(disc(d[0], d[1], clamp(p.s * 0.012, 1.4, 2.4), INK));
  });
  const ticks: Cmd[] = [];
  for (let t = 0; t <= 5; t++) ticks.push(...seg([p.x0 - 3, Y(t)], [p.x0, Y(t)]));
  for (const hv of [-5, 0, 5]) ticks.push(...seg([X(hv), p.y1], [X(hv), p.y1 + 3]));
  parts.push(box(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0, 'none', '#555555', 0.8), line(ticks, '#555555', 0.8));
  for (let t = 0; t <= 5; t++) parts.push(text(p.x0 - 5, Y(t), String(t), fs, INK, 'end'));
  for (const hv of [-5, 0, 5]) parts.push(text(X(hv), p.y1 + fs * 1.05, hv < 0 ? '$-5$' : String(hv), fs, INK));
  parts.push(text((p.x0 + p.x1) / 2, p.y1 + fs * 2.4, 'Input/Hidden/Output', fs, INK), text(p.x0 - fs * 1.9, p.y0 - fs * 0.95, 'Depth', fs, INK, 'start'));
  return parts;
}

// ======================================================================
// EWC (Kirkpatrick et al. 2017, Fig. 1): regioni di basso errore per i task A e B
// ======================================================================

export const EWC_COLORS = { A: '#B4B4B4', B: '#FCFCE4', ewc: '#A8322D', l2: '#2E7D32', none: '#1A237E' };

function ewc(n: N): Part[] {
  const { x, y, w, h } = n;
  const U = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const s = Math.min(w, h / 0.44);
  const [ax, ay] = U(0.355, 0.52), [bx, by] = U(0.665, 0.5);
  const A = ellipsePts(ax, ay, s * 0.385, s * 0.072, -0.54, 72);
  const B = ellipsePts(bx, by, s * 0.37, s * 0.08, 0.57, 72);
  let both = A;
  for (let i = 0; i < B.length; i++) {
    const p = B[i], q = B[(i + 1) % B.length];
    let a: P2 = [-(q[1] - p[1]), q[0] - p[0]];
    let c = a[0] * p[0] + a[1] * p[1];
    if (a[0] * bx + a[1] * by > c) {
      a = [-a[0], -a[1]];
      c = -c;
    }
    both = clipHalf(both, a, c);
  }
  const sw = 0.7;
  const parts: Part[] = [
    { kind: 'path', cmds: poly(A), fill: EWC_COLORS.A, stroke: 'none', solid: true },
    { kind: 'path', cmds: poly(B), fill: EWC_COLORS.B, stroke: 'none', solid: true },
  ];
  if (both.length > 2) parts.push({ kind: 'path', cmds: poly(both), fill: mix(EWC_COLORS.A, EWC_COLORS.B, 0.55), stroke: 'none', solid: true });
  parts.push(line(poly(A), '#333333', sw), line(poly(B), '#555555', sw));
  const th = U(0.341, 0.573);
  const asz = clamp(s * 0.03, 5, 9), asw = clamp(s * 0.007, 1.4, 2.4);
  parts.push(...arrow(th, U(0.52, 0.31), EWC_COLORS.ewc, asw, asz), ...arrow(th, U(0.535, 0.625), EWC_COLORS.l2, asw, asz));
  const end = U(0.675, 0.52), c1 = U(0.45, 0.52), c2 = U(0.55, 0.47);
  parts.push(line([['M', ...th], ['C', ...c1, ...c2, ...toward(end, c2, asz * 0.7)]], EWC_COLORS.none, asw), tip(end, end[0] - c2[0], end[1] - c2[1], asz, EWC_COLORS.none));
  const fs = clamp(s * 0.04, 7, 13);
  parts.push(disc(th[0], th[1], clamp(s * 0.009, 1.8, 3.2), INK), text(th[0] - fs * 0.4, th[1] + fs * 0.25, '$\\theta^*_A$', fs, INK, 'end'));
  return parts;
}

// ======================================================================
// MAML (Finn et al. 2017, Fig. 1): meta-apprendimento verso θ e adattamento ai task
// ======================================================================

function maml(n: N): Part[] {
  const { x, y, w, h } = n;
  const X = (px: number) => x + (px / 300) * w;
  const Y = (py: number) => y + ((py - 215) / 180) * h;
  const Q = (px: number, py: number): P2 => [X(px), Y(py)];
  const fs = clamp(Math.min(w / 300, h / 180) * 13, 7, 14);
  const k = Math.min(w / 300, h / 180);
  const parts: Part[] = [];
  const p0 = Q(14, 280), c1 = Q(45, 250), c2 = Q(118, 262), th = Q(170, 343);
  const bez = (t: number): P2 => {
    const m = 1 - t;
    return [0, 1].map((i) => m ** 3 * p0[i] + 3 * m * m * t * c1[i] + 3 * m * t * t * c2[i] + t ** 3 * th[i]) as P2;
  };
  const G = bez(0.6);
  const ends: [P2, string, P2][] = [
    [[G[0] + 30 * k, G[1] - 26 * k], '$\\nabla \\mathcal{L}_1$', [30, 6]],
    [[G[0] + 38 * k, G[1] + 10 * k], '$\\nabla \\mathcal{L}_2$', [24, 6]],
    [[G[0] - 13 * k, G[1] + 33 * k], '$\\nabla \\mathcal{L}_3$', [-24, 6]],
  ];
  const stars: [P2, string, 'start' | 'end'][] = [[Q(222, 316), '$\\theta^*_1$', 'start'], [Q(205, 384), '$\\theta^*_2$', 'start'], [Q(128, 384), '$\\theta^*_3$', 'end']];
  const dl = clamp(4 * k, 2.4, 4.5);
  for (const [p] of stars) parts.push(line(dashes([th, p], dl, dl * 0.75), '#444444', 1), disc(p[0], p[1], clamp(2.4 * k, 1.6, 3), '#444444'));
  for (const [p, label, d] of ends) parts.push(...arrow(G, p, '#555555', 1, clamp(7 * k, 4, 8)), text(p[0] + d[0] * k, p[1] + d[1] * k, label, fs, INK));
  const end = toward(th, bez(0.93), 3);
  parts.push(line([['M', ...p0], ['C', ...c1, ...c2, ...toward(end, c2, 6 * k)]], INK, clamp(2.4 * k, 1.6, 3)), tip(end, end[0] - c2[0], end[1] - c2[1], clamp(9 * k, 6, 11), INK));
  parts.push(disc(th[0], th[1], clamp(2.8 * k, 1.8, 3.4), INK), text(th[0] - 10 * k, th[1] + 3 * k, '$\\theta$', fs, INK, 'end'));
  for (const [p, label, anchor] of stars) parts.push(text(p[0] + (anchor === 'start' ? 6 : -6) * k, p[1] + 2 * k, label, fs, INK, anchor));
  if (has(n, 'legend')) {
    const lx = X(12), lx2 = X(40);
    parts.push(line(seg([lx, Y(222)], [lx2, Y(222)]), INK, clamp(2.4 * k, 1.6, 3)), line(dashes([[lx, Y(238)], [lx2, Y(238)]], dl, dl * 0.75), '#444444', 1));
    parts.push(text(lx2 + 6 * k, Y(222), 'meta-learning', fs * 0.95, INK, 'start'), text(lx2 + 6 * k, Y(238), 'learning/adaptation', fs * 0.95, INK, 'start'));
  }
  return parts;
}

// ======================================================================
// Dispositivi dei client (federated learning)
// ======================================================================

function device(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = inkOf(n);
  const sw = n.strokeWidth;
  const kind = pick(n, ['phone', 'laptop', 'server', 'hospital'], 'phone');
  const screen = '#FFFFFF';
  const bars = (bx: number, byy: number, bw: number, bh: number): Part => {
    const cmds: Cmd[] = [];
    for (let i = 0; i < 3; i++) cmds.push(...seg([bx + bw * 0.15, byy + bh * (0.3 + i * 0.2)], [bx + bw * (i === 2 ? 0.55 : 0.85), byy + bh * (0.3 + i * 0.2)]));
    return line(cmds, shade(ink, 0.35), Math.max(0.8, sw * 0.8));
  };
  if (kind === 'phone') {
    const pw = Math.min(w, h * 0.58), px = x + (w - pw) / 2;
    const r = pw * 0.16;
    return [
      box(px, y, pw, h, fill, ink, sw, r),
      box(px + pw * 0.1, y + h * 0.12, pw * 0.8, h * 0.72, screen, ink, sw * 0.7, 1.5),
      bars(px + pw * 0.1, y + h * 0.12, pw * 0.8, h * 0.72),
      line(seg([px + pw * 0.38, y + h * 0.06], [px + pw * 0.62, y + h * 0.06]), ink, sw),
      disc(px + pw / 2, y + h * 0.92, Math.min(pw, h) * 0.05, 'none', ink, sw * 0.8),
    ];
  }
  if (kind === 'laptop') {
    const sx = x + w * 0.1, sw2 = w * 0.8, sh = h * 0.74;
    return [
      box(sx, y, sw2, sh, fill, ink, sw, Math.min(w, h) * 0.06),
      box(sx + sw2 * 0.07, y + sh * 0.1, sw2 * 0.86, sh * 0.8, screen, ink, sw * 0.7, 1),
      bars(sx + sw2 * 0.07, y + sh * 0.1, sw2 * 0.86, sh * 0.8),
      { kind: 'path', cmds: roundPoly([[x + w * 0.04, y + h * 0.8], [x + w * 0.96, y + h * 0.8], [x + w, y + h], [x, y + h]], 2), fill, stroke: ink, sw, solid: true },
      line(seg([x + w * 0.42, y + h * 0.9], [x + w * 0.58, y + h * 0.9]), ink, sw * 0.8),
    ];
  }
  if (kind === 'server') {
    const parts: Part[] = [];
    const uh = h / 3;
    for (let i = 0; i < 3; i++) {
      const uy = y + i * uh;
      parts.push(box(x, uy + 1, w, uh - 2, fill, ink, sw, Math.min(uh * 0.2, 4)));
      parts.push(disc(x + w * 0.12, uy + uh / 2, Math.min(uh * 0.1, 3), i === 1 ? '#5CB85C' : '#9AD39A', 'none'));
      parts.push(line([...seg([x + w * 0.45, uy + uh * 0.38], [x + w * 0.86, uy + uh * 0.38]), ...seg([x + w * 0.45, uy + uh * 0.62], [x + w * 0.86, uy + uh * 0.62])], shade(ink, 0.3), sw * 0.8));
    }
    return parts;
  }
  // ospedale / istituzione: edificio con croce
  const roof = h * 0.22;
  const parts: Part[] = [
    { kind: 'path', cmds: poly([[x, y + roof], [x + w / 2, y], [x + w, y + roof]]), fill: shade(fill === 'none' ? '#FFFFFF' : fill, -0.08), stroke: ink, sw, solid: true },
    box(x + w * 0.06, y + roof, w * 0.88, h - roof, fill, ink, sw),
  ];
  const c = Math.min(w, h) * 0.09, ccx = x + w / 2, ccy = y + roof + (h - roof) * 0.3;
  parts.push(area(poly([[ccx - c / 2, ccy - 1.5 * c], [ccx + c / 2, ccy - 1.5 * c], [ccx + c / 2, ccy - c / 2], [ccx + 1.5 * c, ccy - c / 2], [ccx + 1.5 * c, ccy + c / 2], [ccx + c / 2, ccy + c / 2], [ccx + c / 2, ccy + 1.5 * c], [ccx - c / 2, ccy + 1.5 * c], [ccx - c / 2, ccy + c / 2], [ccx - 1.5 * c, ccy + c / 2], [ccx - 1.5 * c, ccy - c / 2], [ccx - c / 2, ccy - c / 2]]), '#E5484D'));
  for (const u of [0.2, 0.68]) parts.push(box(x + w * u, y + roof + (h - roof) * 0.62, w * 0.12, (h - roof) * 0.2, '#FFFFFF', ink, sw * 0.7));
  parts.push(box(x + w * 0.43, y + h - (h - roof) * 0.32, w * 0.14, (h - roof) * 0.32, '#FFFFFF', ink, sw * 0.7));
  return parts;
}

// ======================================================================
// Campi di PDE (FNO, PINN): Darcy, vorticità, Burgers, campo liscio
// ======================================================================

const VIRIDIS = ['#440154', '#3B528B', '#21918C', '#5EC962', '#FDE725'];
const RDBU = ['#2166AC', '#92C5DE', '#F7F7F7', '#F4A582', '#B2182B'];
const cmap = (stops: string[], t: number) => {
  const s = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(s));
  return mix(stops[i], stops[i + 1], s - i);
};
const TAU = Math.PI * 2;

function fieldValue(kind: string, u: number, v: number): number {
  switch (kind) {
    case 'darcy': {
      const s = Math.sin(TAU * (1.3 * u + 0.2)) * Math.cos(TAU * 0.9 * v) + 0.6 * Math.sin(TAU * (2.1 * u - 1.7 * v + 0.3)) + 0.4 * Math.cos(TAU * (0.5 * u + 2.4 * v));
      return s > 0.15 ? 0.84 : 0.22;
    }
    case 'vorticity': {
      const V: [number, number, number][] = [[0.3, 0.35, 1], [0.66, 0.28, -1], [0.5, 0.68, 1], [0.82, 0.76, -1], [0.18, 0.8, -1], [0.85, 0.45, 0.7]];
      let s = 0;
      for (const [a, b, g] of V) s += g * Math.exp(-((u - a) ** 2 + (v - b) ** 2) / 0.014);
      s += 0.35 * Math.sin(TAU * (u + 0.6 * v)) * Math.sin(TAU * 1.5 * v);
      return 0.5 + 0.48 * Math.tanh(1.6 * s);
    }
    case 'burgers': {
      const t = u, xx = 1 - 2 * v;
      const mixT = clamp(t * 1.6, 0, 1), d = 0.55 * (1 - t) + 0.03;
      const val = (1 - mixT) * -Math.sin(Math.PI * xx) + mixT * -Math.tanh(xx / d) * Math.pow(1 - Math.abs(xx), 0.7) * 1.05;
      return 0.5 + 0.5 * clamp(val, -1, 1);
    }
    default:
      return 0.5 + 0.22 * Math.sin(TAU * (0.8 * u + 0.3)) * Math.cos(TAU * 1.1 * v) + 0.18 * Math.sin(TAU * (1.7 * u - 1.2 * v)) + 0.1 * Math.cos(TAU * 2.6 * u * v);
  }
}

function field(n: N): Part[] {
  const { x, y, w, h } = n;
  const kind = pick(n, ['darcy', 'vorticity', 'burgers', 'smooth'], 'smooth');
  const res = clamp(Math.round(n.count), 8, 48);
  const cols = res, rows = Math.max(4, Math.round((res * h) / Math.max(1, w)));
  const stops = kind === 'vorticity' || kind === 'burgers' ? RDBU : VIRIDIS;
  const cw = w / cols, ch = h / rows;
  const parts: Part[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) parts.push(box(x + i * cw - 0.15, y + j * ch - 0.15, cw + 0.3, ch + 0.3, cmap(stops, fieldValue(kind, (i + 0.5) / cols, (j + 0.5) / rows)), 'none'));
  if (has(n, 'points')) {
    // dati su condizione iniziale e bordi (×) e punti di collocazione (·), come in Raissi et al. 2019
    const rand = rng(97);
    for (let k = 0; k < 26; k++) {
      const side = k % 3;
      const u = side === 0 ? 0.015 : 0.04 + rand() * 0.92, v = side === 0 ? 0.04 + rand() * 0.92 : side === 1 ? 0.02 : 0.98;
      parts.push(marker('x', x + u * w, y + v * h, clamp(Math.min(w, h) * 0.022, 1.6, 3), { fill: INK, stroke: INK }));
    }
    for (let k = 0; k < 40; k++) parts.push(disc(x + (0.08 + rand() * 0.88) * w, y + (0.08 + rand() * 0.84) * h, clamp(Math.min(w, h) * 0.008, 0.8, 1.4), '#FFFFFF', '#333333', 0.5));
  }
  parts.push(box(x, y, w, h, 'none', inkOf(n), n.strokeWidth));
  return parts;
}

/** Modi di Fourier: sinusoidi impilate con assi, come nel Fourier layer di FNO. */
function waves(n: N): Part[] {
  const { x, y, w, h } = n;
  const ink = inkOf(n);
  const K = clamp(Math.round(n.count), 1, 6);
  const rh = h / K;
  const parts: Part[] = [];
  for (let k = 0; k < K; k++) {
    const cy = y + rh * (k + 0.5);
    const amp = rh * 0.3;
    const pts: P2[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      pts.push([x + w * t, cy - amp * Math.cos(Math.PI * (k + 1) * (t - 0.5) * 1.6)]);
    }
    if (!has(n, 'noaxes')) {
      const a = clamp(rh * 0.12, 1.5, 3.5);
      parts.push(...arrow([x, cy], [x + w, cy], ink, 0.6, a), ...arrow([x + w / 2, cy + rh * 0.42], [x + w / 2, cy - rh * 0.45], ink, 0.6, a));
    }
    parts.push(line(poly(pts, false), ink, 0.9));
  }
  return parts;
}

// ======================================================================
// Distribuzione predetta (FixMatch): soglia di confidenza e pseudo-etichetta one-hot
// ======================================================================

function probs(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const C = clamp(Math.round(n.count), 2, 12);
  const onehot = has(n, 'onehot'), thr = has(n, 'thresh'), alt = has(n, 'alt');
  const peak = Math.min(C - 1, Math.floor(C * 0.55));
  const rand = rng(alt ? 77 : 31);
  const preset = alt ? [0.2, 0.55, 0.28, 0.72, 0.14, 0.44] : [0.08, 0.17, 0.1, 0.86, 0.15, 0.09];
  const vals = Array.from({ length: C }, (_, i) => (onehot ? (i === peak ? 1 : 0) : C === 6 ? preset[i] : i === peak ? 0.86 : 0.06 + rand() * (alt ? 0.6 : 0.18)));
  const parts: Part[] = [box(x, y, w, h, fill, inkOf(n), n.strokeWidth, Math.min(n.radius, w / 2, h / 2))];
  const px = w * 0.08, top = y + h * 0.1, bot = y + h * 0.9;
  const slot = (w - 2 * px) / C, bw = slot * 0.66;
  vals.forEach((v, i) => {
    const bx = x + px + slot * i + (slot - bw) / 2;
    const bh = Math.max(onehot ? 2.2 : 1.5, (bot - top) * v);
    parts.push(box(bx, bot - bh, bw, bh, '#3F3F3F', 'none'));
  });
  if (thr) {
    const ty = bot - (bot - top) * 0.7;
    parts.push(line(dashes([[x + px * 0.5, ty], [x + w - px * 0.5, ty]], 3, 2.2), '#333333', 0.9));
  }
  return parts;
}

/** Array di Perceiver: celle impilate sfumate dal colore del bordo al riempimento. */
function arrayCells(n: N): Part[] {
  const { x, y, w, h } = n;
  const rows = clamp(Math.round(n.count), 1, 12);
  const ink = inkOf(n);
  const ch = h / rows;
  const parts: Part[] = [];
  for (let r = 0; r < rows; r++) parts.push(box(x, y + r * ch, w, ch, mix(ink, n.fill === 'none' ? '#FFFFFF' : n.fill, rows === 1 ? 1 : 0.12 + (0.88 * r) / (rows - 1)), '#2D3A4A', n.strokeWidth * 0.8));
  return parts;
}

/** Centri x dei token di una forma dlm-tokrow (per allineare le connessioni nei modelli). */
export const tokCenters = (x: number, w: number, count: number) => Array.from({ length: count }, (_, i) => x + (w / count) * (i + 0.5));

function tokRow(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const c = clamp(Math.round(n.count), 1, 16);
  const tw = Math.min((w / c) * 0.78, h * 1.25);
  return tokCenters(x, w, c).map((cx): Part => ({
    kind: 'path',
    fill,
    stroke: inkOf(n),
    sw: n.strokeWidth,
    cmds: roundPoly([[cx - tw / 2, y + h], [cx - tw / 2, y + h * 0.38], [cx - tw * 0.2, y], [cx + tw * 0.2, y], [cx + tw / 2, y + h * 0.38], [cx + tw / 2, y + h]], 1.5),
  }));
}

// ======================================================================
// Processo gaussiano (Rasmussen & Williams 2006, Fig. 2.2) e Bayesian optimization (Brochu et al. 2010)
// ======================================================================

const GP_L = 0.11;
const kern = (a: number, b: number) => Math.exp(-((a - b) ** 2) / (2 * GP_L * GP_L));
const gpTrue = (u: number) => 0.6 * Math.sin(TAU * 1.6 * u + 1.2) + 1.1 * Math.exp(-(((u - 0.62) / 0.09) ** 2)) - 0.2;
const GP_OBS = [0.12, 0.88, 0.45, 0.3, 0.68, 0.56, 0.04, 0.96, 0.2, 0.78];

function cholesky(A: number[][]): number[][] {
  const m = A.length;
  const L = A.map(() => new Array<number>(m).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
  return L;
}

function forward(L: number[][], b: number[]): number[] {
  const z = new Array<number>(b.length).fill(0);
  for (let i = 0; i < b.length; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * z[k];
    z[i] = s / L[i][i];
  }
  return z;
}

function backward(L: number[][], z: number[]): number[] {
  const m = z.length;
  const out = new Array<number>(m).fill(0);
  for (let i = m - 1; i >= 0; i--) {
    let s = z[i];
    for (let k = i + 1; k < m; k++) s -= L[k][i] * out[k];
    out[i] = s / L[i][i];
  }
  return out;
}

/** Posteriore del GP (rumore piccolo) sui punti U: media, deviazione e fattori per i campioni. */
function gpPost(X: number[], Y: number[], U: number[]) {
  if (!X.length) return { mu: U.map(() => 0), sd: U.map(() => 1), V: U.map(() => [] as number[]) };
  const L = cholesky(X.map((a, i) => X.map((b, j) => kern(a, b) + (i === j ? 1e-4 : 0))));
  const alpha = backward(L, forward(L, Y));
  const V = U.map((u) => forward(L, X.map((a) => kern(u, a))));
  const mu = U.map((u) => X.reduce((s, a, i) => s + kern(u, a) * alpha[i], 0));
  const sd = V.map((v) => Math.sqrt(Math.max(1e-10, 1 - v.reduce((s, q) => s + q * q, 0))));
  return { mu, sd, V };
}

/** Campioni dal GP sulla griglia U (Cholesky della covarianza a posteriori). */
function gpSamples(U: number[], post: ReturnType<typeof gpPost>, count: number, seed: number): number[][] {
  const C = U.map((a, i) => U.map((b, j) => kern(a, b) - post.V[i].reduce((s, q, k) => s + q * (post.V[j][k] ?? 0), 0) + (i === j ? 2e-4 : 0)));
  const L = cholesky(C);
  const rand = rng(seed);
  return Array.from({ length: count }, () => {
    const z = U.map(() => gauss(rand));
    return U.map((_, i) => post.mu[i] + L[i].reduce((s, l, k) => s + l * z[k], 0));
  });
}

const erf = (v: number) => {
  const s = Math.sign(v), a = Math.abs(v), t = 1 / (1 + 0.3275911 * a);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
};
const expectedImprovement = (mu: number, sd: number, best: number) => {
  const d = mu - best - 0.01;
  if (sd < 1e-6) return Math.max(0, d);
  const z = d / sd;
  return d * 0.5 * (1 + erf(z / Math.SQRT2)) + (sd * Math.exp(-0.5 * z * z)) / Math.sqrt(TAU);
};

/** Punti valutati dalla Bayesian optimization: due iniziali, poi l'argmax dell'expected improvement. */
export function boPoints(count: number): number[] {
  const X = [0.05, 0.9];
  const U = Array.from({ length: 201 }, (_, i) => i / 200);
  while (X.length < count) {
    const post = gpPost(X, X.map(gpTrue), U);
    const best = Math.max(...X.map(gpTrue));
    let bi = 0, bv = -1;
    U.forEach((_, i) => {
      const e = expectedImprovement(post.mu[i], post.sd[i], best);
      if (e > bv) [bi, bv] = [i, e];
    });
    X.push(U[bi]);
  }
  return X.slice(0, Math.max(1, count));
}

export const GP_COLORS = { band: '#DCE6F2', mean: '#2F5D8A', acq: '#CDEAC0', acqLine: '#4E9A3A', max: '#D62828' };

function gp(n: N): Part[] {
  const { x, y, w, h } = n;
  const mode = pick(n, ['prior', 'posterior', 'bo'], 'posterior');
  const plain = has(n, 'plain');
  const fs = clamp(Math.min(w, h) * 0.06, 6.5, 10);
  const bo = mode === 'bo';
  const pad = plain || bo ? 0.04 : 0.1;
  const x0 = x + w * (plain || bo ? 0.03 : 0.1), x1 = x + w * 0.97;
  const top = y + h * 0.05, bottom = bo ? y + h * 0.68 : y + h - (plain ? h * pad : fs * 2.4);
  const U = Array.from({ length: 81 }, (_, i) => i / 80);
  const X = mode === 'prior' ? [] : bo ? boPoints(clamp(Math.round(n.count), 1, 8)) : GP_OBS.slice(0, clamp(Math.round(n.count), 1, GP_OBS.length));
  const Y = X.map(gpTrue);
  const post = gpPost(X, Y, U);
  const lo = -2.6, hi = 2.6;
  const PX = (u: number) => x0 + (x1 - x0) * u;
  const PY = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  const clip = { x: x0, y: top, w: x1 - x0, h: bottom - top, r: 0 };
  const parts: Part[] = [box(x, y, w, h, n.fill, n.stroke === 'none' ? 'none' : undefined, n.strokeWidth, n.radius)];
  const bandC = bo ? GP_COLORS.band : '#E4E4E4';
  const upper = U.map((u, i): P2 => [PX(u), PY(post.mu[i] + 2 * post.sd[i])]);
  const lower = U.map((u, i): P2 => [PX(u), PY(post.mu[i] - 2 * post.sd[i])]).reverse();
  parts.push({ kind: 'path', cmds: poly([...upper, ...lower]), fill: bandC, stroke: 'none', solid: true, clip });
  if (has(n, 'samples')) {
    const G = U.filter((_, i) => i % 2 === 0);
    const sp = gpSamples(G, gpPost(X, Y, G), 3, mode === 'prior' ? 5 : 11 + X.length);
    const SC = ['#3B6FB6', '#C0392B', '#2E8B57'];
    sp.forEach((f, k) => {
      const pts = G.map((u, i): P2 => [PX(u), PY(f[i])]);
      parts.push(line(k === 0 ? poly(pts, false) : dashes(pts, k === 1 ? 3.5 : 1.4, 2.2), SC[k], 1, { clip }));
    });
  }
  if (bo || has(n, 'truth')) parts.push(line(dashes(U.map((u): P2 => [PX(u), PY(gpTrue(u))]), 4, 3), '#333333', 1, { clip }));
  parts.push(line(poly(U.map((u, i): P2 => [PX(u), PY(post.mu[i])]), false), bo ? GP_COLORS.mean : INK, bo ? 1.4 : 1.6, { clip }));
  const mr = clamp(Math.min(w, h) * 0.025, 2, 3.6);
  X.forEach((u, i) => {
    if (bo) parts.push(disc(PX(u), PY(Y[i]), mr, i === X.length - 1 && X.length > 2 ? GP_COLORS.max : INK));
    else parts.push(marker('+', PX(u), PY(Y[i]), mr * 1.4, { fill: INK, stroke: INK }));
  });
  if (!bo && !plain) {
    parts.push(line([['M', x0, top], ['L', x0, bottom], ['L', x1, bottom]], AXIS, 0.9));
    const ticks: Cmd[] = [];
    for (const v of [-2, 0, 2]) {
      ticks.push(...seg([x0 - 3, PY(v)], [x0, PY(v)]));
      parts.push(text(x0 - 5, PY(v), v < 0 ? '$-2$' : String(v), fs, '#555555', 'end'));
    }
    parts.push(line(ticks, AXIS, 0.9), text((x0 + x1) / 2, bottom + fs * 1.1, 'input, $x$', fs, '#555555'), text(x0 + 4, top + fs * 0.2, '$f(x)$', fs, '#555555', 'start'));
  }
  if (bo) {
    // funzione di acquisizione (expected improvement) sotto, con il suo massimo
    const a0 = y + h * 0.74, a1 = y + h * 0.97;
    const best = Math.max(...Y);
    const ei = U.map((_, i) => expectedImprovement(post.mu[i], post.sd[i], best));
    const m = Math.max(...ei, 1e-9);
    const pts = U.map((u, i): P2 => [PX(u), a1 - (ei[i] / m) * (a1 - a0) * 0.92]);
    parts.push(area(poly([[x0, a1], ...pts, [x1, a1]]), GP_COLORS.acq), line(poly(pts, false), GP_COLORS.acqLine, 1.1), line(seg([x0, a1], [x1, a1]), AXIS, 0.8));
    const bi = ei.indexOf(Math.max(...ei));
    const [mx, my] = pts[bi];
    const t = clamp(h * 0.04, 3, 5);
    parts.push(area(poly([[mx, my - 1], [mx - t, my - 1 - t * 1.6], [mx + t, my - 1 - t * 1.6]]), GP_COLORS.max));
    parts.push(line(seg([x0, bottom], [x1, bottom]), AXIS, 0.8));
  }
  return parts;
}

// ======================================================================

export const MORE_SHAPES: ShapeDef[] = [
  {
    kind: 'dlm-qkv',
    name: 'Teste MHA / GQA / MQA',
    parts: qkvHeads,
    countLabel: 'Teste di query',
    countMax: 16,
    specLabel: 'Variante',
    specOptions: [
      one('Attention', [{ value: 'mha', label: 'Multi-head' }, { value: 'gqa', label: 'Grouped-query' }, { value: 'mqa', label: 'Multi-query' }]),
      one('Gruppi (GQA)', [{ value: 'g2', label: '2' }, { value: 'g4', label: '4' }]),
    ],
  },
  {
    kind: 'dlm-dilated',
    name: 'Convoluzioni causali (dilatate)',
    parts: dilated,
    countLabel: 'Strati',
    countMax: 5,
    specLabel: 'Variante',
    specOptions: [one('Dilatazione', [{ value: 'dilated', label: 'Dilatate' }, { value: 'standard', label: 'Standard' }]), many('Testo', [{ value: 'labels', label: 'Nomi degli strati' }])],
  },
  {
    kind: 'dlm-tiles',
    name: 'Attention a blocchi (tiling)',
    parts: tiles,
    countLabel: 'Blocco corrente',
    countMax: 64,
    specLabel: 'Blocchi',
    specOptions: [one('Blocchi', ['3x3', '4x4', '6x6']), many('Maschera', [{ value: 'causal', label: 'Causale' }])],
  },
  { kind: 'dlm-memhier', name: 'Gerarchia di memoria (GPU)', parts: memHier, specLabel: 'Varianti', specOptions: [many('Testo', [{ value: 'bw', label: 'Banda e capacità' }])] },
  { kind: 'dlm-rotation', name: 'Rotazione RoPE', parts: rotation, specLabel: 'Varianti', specOptions: [many('Testo', [{ value: 'nolabels', label: 'Senza etichette' }])] },
  {
    kind: 'dlm-ropevec',
    name: 'Query/key con coppie RoPE',
    parts: ropeVec,
    countLabel: 'Posizione m (0 = nessuna)',
    countMax: 6,
    specLabel: 'Varianti',
    specOptions: [many('Varianti', [{ value: 'pair', label: 'Solo una coppia' }, { value: 'hl', label: 'Evidenzia θ1' }])],
  },
  { kind: 'dlm-gatmech', name: 'Meccanismo di attention (GAT)', parts: gatMech },
  { kind: 'dlm-gatstar', name: 'Attention multi-testa sul vicinato (GAT)', parts: gatStar, countLabel: 'Teste K', countMax: 3, specLabel: 'Varianti', specOptions: [many('Uscita', [{ value: 'noout', label: 'Senza uscita' }])] },
  {
    kind: 'dlm-sage',
    name: 'Vicinato GraphSAGE',
    parts: sage,
    specLabel: 'Fase',
    specOptions: [one('Fase', [{ value: 'sample', label: 'Campiona' }, { value: 'aggregate', label: 'Aggrega' }, { value: 'predict', label: 'Predici' }])],
  },
  { kind: 'dlm-odeflow', name: 'Traiettorie ResNet / ODE', parts: odeFlow, specLabel: 'Rete', specOptions: [one('Rete', [{ value: 'resnet', label: 'Residua' }, { value: 'ode', label: 'ODE' }])] },
  { kind: 'dlm-ewc', name: 'Spazio dei parametri (EWC)', parts: ewc },
  { kind: 'dlm-maml', name: 'Meta-apprendimento (MAML)', parts: maml, specLabel: 'Varianti', specOptions: [many('Legenda', [{ value: 'legend', label: 'Legenda' }])] },
  {
    kind: 'dlm-device',
    name: 'Dispositivo client',
    parts: device,
    specLabel: 'Tipo',
    specOptions: [one('Tipo', [{ value: 'phone', label: 'Telefono' }, { value: 'laptop', label: 'Portatile' }, { value: 'server', label: 'Server' }, { value: 'hospital', label: 'Ospedale' }])],
  },
  {
    kind: 'dlm-field',
    name: 'Campo di una PDE',
    parts: field,
    countLabel: 'Risoluzione',
    countMax: 48,
    specLabel: 'Campo',
    specOptions: [
      one('Campo', [{ value: 'darcy', label: 'Darcy' }, { value: 'vorticity', label: 'Vorticità' }, { value: 'burgers', label: 'Burgers' }, { value: 'smooth', label: 'Liscio' }]),
      many('Punti', [{ value: 'points', label: 'Dati e collocazione' }]),
    ],
  },
  { kind: 'dlm-waves', name: 'Modi di Fourier', parts: waves, countLabel: 'Modi', countMax: 6, specLabel: 'Varianti', specOptions: [many('Assi', [{ value: 'noaxes', label: 'Senza assi' }])] },
  {
    kind: 'dlm-probs',
    name: 'Distribuzione predetta',
    parts: probs,
    countLabel: 'Classi',
    countMax: 12,
    specLabel: 'Varianti',
    specOptions: [many('Varianti', [{ value: 'thresh', label: 'Soglia' }, { value: 'onehot', label: 'One-hot' }, { value: 'alt', label: 'Altra predizione' }])],
  },
  { kind: 'dlm-array', name: 'Array (Perceiver)', parts: arrayCells, countLabel: 'Righe', countMax: 12 },
  { kind: 'dlm-tokrow', name: 'Token (pentagoni)', parts: tokRow, countLabel: 'Token', countMax: 16 },
  {
    kind: 'mlm-gp',
    name: 'Processo gaussiano',
    parts: gp,
    countLabel: 'Osservazioni',
    countMax: 10,
    specLabel: 'Variante',
    specOptions: [
      one('Grafico', [{ value: 'prior', label: 'Prior' }, { value: 'posterior', label: 'Posterior' }, { value: 'bo', label: 'Bayesian opt.' }]),
      many('Curve', [{ value: 'samples', label: 'Campioni' }, { value: 'truth', label: 'Funzione vera' }, { value: 'plain', label: 'Senza assi' }]),
    ],
  },
];
