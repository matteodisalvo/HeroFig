// Forme del modulo "Quantum ML e generative AI": distribuzione campionata contro il target
// (QCBM, qGAN), curve di training e barren plateau, matrice di kernel, ensemble di stati sulla
// sfera di Bloch (QuDDPM), immagini a pixel (bars-and-stripes, cifre), macchina di Boltzmann
// quantistica, rete di spin (reservoir) e dataset 2D. Primitive `Part`, dati deterministici (`rng`).
import { mix, poly, rng, shade, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';
import { AXIS, CLS, TAU, TEXT, area, arrow, axisSize, clamp, dashes, disc, faded, flag, line, marker, panel, plotArea, seg, text, type Marker, type P2, type Plot } from './ml-kit';

type N = NodeModel;

const DEG = Math.PI / 180;
const GRID = '#E4E7EB';
const TARGET = '#E07B39';
const BAR = '#4A72C4';
/** Colori delle serie nei grafici (blu, rosso, verde, viola, arancio, turchese, marrone, magenta). */
export const SERIES = ['#2F6FB2', '#C0392B', '#2E8B57', '#7E57C2', '#D9822B', '#1B9AAA', '#8C564B', '#C2185B'];

const kindOf = <T extends string>(n: N, kinds: readonly T[], fb: T): T => kinds.find((k) => flag(n, k)) ?? fb;
const numOf = (n: N, key: string, fb: number) => {
  const m = new RegExp(`${key}=(-?\\d+(?:\\.\\d+)?)`, 'i').exec(n.spec);
  return m ? +m[1] : fb;
};
const pl = (pts: P2[]): Cmd[] => pts.map((p, i): Cmd => (i ? ['L', p[0], p[1]] : ['M', p[0], p[1]]));
const box = (x: number, y: number, w: number, h: number, fill: string, stroke = 'none', sw = 0.8, r = 0): Part => ({ kind: 'rect', x, y, w, h, r, fill, stroke, sw, solid: true });
const norm = (v: number[]) => {
  const s = Math.hypot(...v) || 1;
  return v.map((c) => c / s);
};
const gauss = (rand: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(TAU * rand());

function erf(x: number) {
  const s = Math.sign(x), a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
}
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/** Valore "tondo" per il massimo dell'asse y. */
function niceTop(v: number) {
  for (const c of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1]) if (c >= v * 1.06) return c;
  return Math.ceil(v * 1.06);
}
const fmt = (v: number) => String(+v.toFixed(2)).replace(/^0\./, '0.');

// ======================================================================
// Distribuzione campionata contro il target (QCBM, qGAN)
// ======================================================================

const DISTS = ['lognormal', 'bimodal', 'gamma', 'gauss', 'bas', 'uniform', 'triangular'] as const;
type Dist = (typeof DISTS)[number];

/** Target su N classi: log-normale discretizzata come in Zoufal et al. (μ = 1, σ = 1), BAS(2,2) per 4 qubit… */
export function targetDist(kind: Dist, N: number): number[] {
  let p: number[];
  if (kind === 'lognormal') {
    const s = 8 / N;
    const cdf = (x: number) => (x <= 0 ? 0 : Phi(Math.log(x) - 1));
    p = Array.from({ length: N }, (_, i) => cdf((i + 0.5) * s) - cdf((i - 0.5) * s));
  } else if (kind === 'bas') {
    const valid = N === 16 ? [0, 3, 5, 10, 12, 15] : Array.from({ length: N }, (_, i) => i).filter((i) => i % Math.max(2, Math.round(N / 5)) === 0);
    p = Array.from({ length: N }, (_, i) => (valid.includes(i) ? 1 : 0));
  } else {
    const f = (u: number) => {
      switch (kind) {
        case 'bimodal': return Math.exp(-(((u - 0.3) / 0.11) ** 2) / 2) + 0.7 * Math.exp(-(((u - 0.72) / 0.1) ** 2) / 2);
        case 'gamma': return (u * 10) ** 1.6 * Math.exp((-u * 10) / 1.5);
        case 'uniform': return 1;
        case 'triangular': return Math.max(0.02, 1 - Math.abs(u - 0.4) / 0.6);
        default: return Math.exp(-(((u - 0.5) / 0.17) ** 2) / 2);
      }
    };
    p = Array.from({ length: N }, (_, i) => f((i + 0.5) / N));
  }
  const s = p.reduce((a, b) => a + b, 0) || 1;
  return p.map((v) => v / s);
}

function modelDist(kind: Dist, p: number[]): number[] {
  const rand = rng(17 + p.length * 3);
  const m = p.map((v) => Math.max(0, v * (1 + 0.36 * (rand() - 0.5)) + (kind === 'bas' ? 0.002 + 0.016 * rand() : 0.002 * rand())));
  const s = m.reduce((a, b) => a + b, 0) || 1;
  return m.map((v) => v / s);
}

/** Istogramma del modello (barre) e target (linea con punti): `count` = classi (2^n per n qubit). */
function distParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const N = clamp(Math.round(n.count), 2, 64);
  const kind = kindOf(n, DISTS, 'lognormal');
  const axis = flag(n, 'axis'), bits = flag(n, 'bits'), index = flag(n, 'index'), legend = flag(n, 'legend'), showT = flag(n, 'target'), data = flag(n, 'data');
  const p = targetDist(kind, N);
  const m = data ? p : modelDist(kind, p);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push(box(x, y, w, h, n.fill, n.stroke === 'none' ? '#C9CED6' : n.stroke, 0.8, Math.min(n.radius, 4)));
  const pad = n.fill !== 'none' ? 6 : 1;
  const fs = clamp(Math.min(w, h) * 0.075, 6.5, 9.5);
  const nb = Math.max(1, Math.round(Math.log2(N)));
  const lab = bits || index;
  const x0 = x + pad + (axis ? fs * 2.7 : 0), x1 = x + w - pad;
  const y0 = y + pad + (legend ? fs * 1.8 : 3), y1 = y + h - pad - (lab ? fs * 1.35 : 0);
  const top = niceTop(Math.max(...p, ...m));
  const Y = (v: number) => y1 - (v / top) * (y1 - y0);
  const slot = (x1 - x0) / N;
  const bar = BAR;
  if (axis) {
    for (const v of [0, top / 2, top]) {
      parts.push(line(seg([x0 - 2, Y(v)], [x1, Y(v)]), v ? GRID : AXIS, v ? 0.6 : 0.8));
      parts.push(text(x0 - 4, Y(v), fmt(v), fs * 0.9, TEXT, 'end'));
    }
  }
  const bw = slot * 0.72;
  m.forEach((v, i) => {
    const bx = x0 + slot * i + (slot - bw) / 2;
    if (v > 0.0005) parts.push(box(bx, Y(v), bw, y1 - Y(v), faded(bar, data ? 0.55 : 0.3), bar, 0.7));
  });
  parts.push(line(seg([x0, y1], [x1, y1]), AXIS, 0.9));
  if (showT) {
    const pts = p.map((v, i): P2 => [x0 + slot * (i + 0.5), Y(v)]);
    if (kind !== 'bas') parts.push(line(pl(pts), TARGET, clamp(fs * 0.17, 1, 1.6)));
    const r = clamp(slot * (kind === 'bas' ? 0.17 : 0.13), 1.4, 3);
    for (const q of pts) parts.push(disc(q[0], q[1], r, TARGET, 'none'));
  }
  if (lab) {
    const lw = bits ? nb * fs * 0.62 : fs * 1.4;
    const step = Math.max(1, Math.ceil(lw / slot));
    for (let i = 0; i < N; i += step) parts.push(text(x0 + slot * (i + 0.5), y1 + fs * 0.75, bits ? i.toString(2).padStart(nb, '0') : String(i), fs * (bits ? 0.85 : 0.95), TEXT));
  }
  if (legend) {
    const ly = y + pad + fs * 0.75, lx = x1 - fs * (showT ? 10.2 : 4.6);
    parts.push(box(lx, ly - fs * 0.32, fs * 1.3, fs * 0.64, faded(bar, 0.3), bar, 0.7), text(lx + fs * 1.6, ly, data ? 'data' : 'model', fs * 0.9, TEXT, 'start'));
    if (showT) parts.push(line(seg([lx + fs * 5.1, ly], [lx + fs * 6.4, ly]), TARGET, 1.2), disc(lx + fs * 5.75, ly, 1.8, TARGET), text(lx + fs * 6.7, ly, 'target', fs * 0.9, TEXT, 'start'));
  }
  return parts;
}

// ======================================================================
// Curve: barren plateau, loss della qGAN, KL del QCBM, paesaggio, segnali del reservoir
// ======================================================================

const CURVES = ['variance', 'layers', 'ganloss', 'kl', 'landscape', 'signal', 'input'] as const;
type CurveKind = (typeof CURVES)[number];

interface Series {
  pts: [number, number][];
  color: string;
  dashed?: boolean;
  marks?: Marker;
  label?: string;
  every?: number;
  noline?: boolean;
}
interface Spec {
  xr: [number, number];
  yr: [number, number];
  log?: boolean;
  xt: number[];
  yt: number[];
  xn: string;
  yn: string;
  series: Series[];
  ref?: number;
}

function curveData(kind: CurveKind, k: number): Spec {
  const rand = rng(41 + k);
  const range = (a: number, b: number, m: number) => Array.from({ length: m + 1 }, (_, i) => a + ((b - a) * i) / m);
  switch (kind) {
    case 'layers': {
      const ns = Array.from({ length: k }, (_, i) => 2 + Math.round((i * 20) / Math.max(1, k - 1) / 2) * 2);
      const Ls = [0, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500];
      return {
        xr: [-10, 520], yr: [-8.6, -0.3], log: true, xt: [0, 100, 200, 300, 400, 500], yt: [-1, -3, -5, -7], xn: 'layers $L$', yn: '$\\mathrm{Var}[\\partial_\\theta E]$',
        series: ns.map((nq, i) => {
          const plateau = -1.05 - 0.29 * (nq - 2);
          return { pts: Ls.map((L): [number, number] => [L, Math.log10(10 ** (-0.95 - L / 34) + 10 ** plateau) + 0.04 * (rand() - 0.5)]), color: SERIES[i % SERIES.length], marks: 'o' as Marker, dashed: true, label: `$n = ${nq}$` };
        }),
      };
    }
    case 'ganloss': {
      const ts = range(0, 2000, 240);
      const jit = () => 0.004 * (rand() - 0.5);
      const gen = ts.map((t): [number, number] => [t, 0.693 + 0.085 * Math.exp(-t / 300) * (1 - Math.exp(-t / 8)) + 0.012 * Math.exp(-(((t - 1250) / 130) ** 2)) - 0.06 * Math.exp(-t / 5) + jit()]);
      const dis = ts.map((t): [number, number] => [t, 0.693 - 0.03 * Math.exp(-t / 330) * (1 - Math.exp(-t / 6)) - 0.008 * Math.exp(-(((t - 1250) / 150) ** 2)) + jit()]);
      return {
        xr: [-40, 2040], yr: [0.5, 1.0], xt: [0, 500, 1000, 1500, 2000], yt: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0], xn: 'training steps', yn: 'loss', ref: Math.LN2,
        series: [{ pts: gen, color: '#C2185B', label: 'generator' }, { pts: dis, color: '#5E35B1', label: 'discriminator' }],
      };
    }
    case 'kl': {
      const plateaus = [1.02, 0.66, 0.4, 0.24, 0.14, 0.08];
      const mk: Marker[] = ['+', '*', 's', 'o', '^', 'x'];
      return {
        xr: [0, 100], yr: [0, 2.1], xt: [0, 20, 40, 60, 80, 100], yt: [0, 0.5, 1, 1.5, 2], xn: 'iteration', yn: 'KL divergence',
        series: Array.from({ length: k }, (_, i) => ({
          pts: range(0, 100, 50).map((t): [number, number] => [t, plateaus[i % 6] + (1.55 - plateaus[i % 6]) * Math.exp(-t / (3 + 5 * i)) + 0.012 * (rand() - 0.5)]),
          color: SERIES[[2, 1, 3, 4, 0, 5][i % 6]], marks: mk[i % 6], every: 3, label: `$L = ${i + 1}$`,
        })),
      };
    }
    case 'landscape': {
      const us = range(0, 1, 200);
      return {
        xr: [0, 1], yr: [0, 1], xt: [], yt: [], xn: '$\\theta$', yn: '$C(\\theta)$',
        series: [
          { pts: us.map((u): [number, number] => [u, 0.45 - 0.32 * Math.cos(TAU * (u - 0.62))]), color: '#9AA0A6', dashed: true, label: 'trainable' },
          { pts: us.map((u): [number, number] => [u, 0.62 - 0.5 * Math.exp(-(((u - 0.62) / 0.022) ** 2)) + 0.006 * Math.sin(u * 47)]), color: '#C0392B', label: 'barren plateau' },
        ],
      };
    }
    case 'signal': {
      const us = range(0, 1, 120);
      return {
        xr: [0, 1], yr: [0, 1], xt: [], yt: [], xn: '$t$', yn: '$\\langle{}Z_i\\rangle$',
        series: Array.from({ length: k }, (_, i) => {
          const f = [2 + rand() * 2, 4 + rand() * 3, 7 + rand() * 4], ph = [rand(), rand(), rand()];
          const base = (k - i - 0.5) / k, amp = 0.32 / k;
          return { pts: us.map((u): [number, number] => [u, base + amp * (Math.sin(TAU * (f[0] * u + ph[0])) + 0.6 * Math.sin(TAU * (f[1] * u + ph[1])) + 0.3 * Math.sin(TAU * (f[2] * u + ph[2])))]), color: SERIES[i % SERIES.length] };
        }),
      };
    }
    case 'input': {
      const vals = Array.from({ length: k }, () => rand());
      const pts: [number, number][] = [];
      vals.forEach((v, i) => pts.push([i / k, 0.08 + 0.84 * v], [(i + 1) / k, 0.08 + 0.84 * v]));
      return { xr: [0, 1], yr: [0, 1], xt: [], yt: [], xn: '$k$', yn: '$s_k$', series: [{ pts, color: '#2B2B2B' }] };
    }
    default: {
      const ns = Array.from({ length: 13 }, (_, i) => 2 + 2 * i);
      return {
        xr: [0, 28], yr: [-8.6, -0.3], log: true, xt: [5, 10, 15, 20, 25], yt: [-1, -3, -5, -7], xn: 'qubits $n$', yn: '$\\mathrm{Var}[\\partial_\\theta E]$',
        series: [
          { pts: [[1, -0.75], [27, -0.75 - 0.301 * 26]], color: TARGET, dashed: true, label: 'slope $-0.69$' },
          { pts: ns.map((q): [number, number] => [q, -1.05 - 0.301 * (q - 2) + 0.1 * (rand() - 0.5)]), color: '#2F6FB2', marks: 'o', label: '', noline: true },
        ],
      };
    }
  }
}

/** Curve da paper: `count` = numero di serie (strati del QCBM, qubit, tracce del reservoir, passi d'ingresso). */
function curveParts(n: N): Part[] {
  const kind = kindOf(n, CURVES, 'variance');
  const k = clamp(Math.round(n.count), 1, kind === 'input' ? 40 : 8);
  const d = curveData(kind, k);
  const fs = axisSize(n);
  const ticks = flag(n, 'axis') && (d.xt.length > 0 || d.yt.length > 0);
  const names = !flag(n, 'plain');
  const legend = flag(n, 'legend') && d.series.some((s) => s.label);
  const L = (ticks ? fs * (d.log ? 3.1 : 2.4) : 5) + 2, B = (ticks ? fs * 1.3 : 3) + (names ? fs * 1.35 : 0), T = names ? fs * 1.5 : 5;
  const p: Plot = plotArea(n, { l: L / n.w, r: 6 / n.w, t: T / n.h, b: B / n.h });
  const parts = panel(n, p);
  const U = (v: number) => (v - d.xr[0]) / (d.xr[1] - d.xr[0]);
  const V = (v: number) => (v - d.yr[0]) / (d.yr[1] - d.yr[0]);
  const at = (q: [number, number]): P2 => p.P(U(q[0]), V(q[1]));
  if (ticks) {
    for (const v of d.yt) {
      parts.push(line(seg([p.x0, p.Y(V(v))], [p.x1, p.Y(V(v))]), GRID, 0.6));
      parts.push(text(p.x0 - 3, p.Y(V(v)), d.log ? `$10^{${v}}$` : fmt(v), fs * 0.85, TEXT, 'end'));
    }
    for (const v of d.xt) parts.push(text(p.X(U(v)), p.y1 + fs * 0.8, String(v), fs * 0.85, TEXT));
    parts.push(line([['M', p.x0, p.y0 - 2], ['L', p.x0, p.y1], ['L', p.x1 + 2, p.y1]], AXIS, 0.9));
  }
  if (d.ref !== undefined) parts.push(line(dashes([p.P(0, V(d.ref)), p.P(1, V(d.ref))], 3, 2.5), '#9AA0A6', 0.8));
  const lw = clamp(Math.min(n.w, n.h) * 0.011, 0.9, 1.6);
  const mr = clamp(Math.min(n.w, n.h) * 0.018, 1.4, 3);
  for (const s of d.series) {
    const pts = s.pts.map(at);
    if (!s.noline) parts.push(line(s.dashed ? dashes(pts, 3.5, 2.5) : pl(pts), s.color, lw, { clip: p.clip }));
    if (s.marks) pts.forEach((q, i) => i % (s.every ?? 1) === 0 && parts.push(marker(s.marks!, q[0], q[1], mr, { fill: s.marks === 'o' ? faded(s.color, 0.15) : 'none', stroke: s.color }, 0.8)));
  }
  if (names) {
    parts.push(text((p.x0 + p.x1) / 2, p.y1 + (ticks ? fs * 2.05 : fs * 0.95), d.xn, fs));
    parts.push(text(p.x0 - (ticks ? fs * 2 : 3), p.y0 - fs * 0.85, d.yn, fs, TEXT, 'start'));
  }
  if (legend) {
    const items = d.series.filter((s) => s.label);
    const tw = Math.max(...items.map((s) => s.label!.replace(/\\[a-zA-Z]+|[${}_^\\]/g, '').length)) * fs * 0.47;
    const lx = p.x1 - fs * 2.2 - tw;
    items.forEach((s, i) => {
      const ly = p.y0 + fs * (0.8 + i * 1.15);
      const a: P2 = [lx, ly], b: P2 = [lx + fs * 1.5, ly];
      parts.push(line(s.dashed ? dashes([a, b], 2.5, 1.8) : seg(a, b), s.color, lw));
      if (s.marks) parts.push(marker(s.marks, lx + fs * 0.75, ly, mr * 0.9, { fill: 'none', stroke: s.color }, 0.8));
      parts.push(text(lx + fs * 1.8, ly, s.label!, fs * 0.85, TEXT, 'start'));
    });
  }
  return parts;
}

// ======================================================================
// Matrice di kernel (Gram) a blocchi
// ======================================================================

/** Matrice di kernel K(x_i, x_j): `count` = campioni; 'blocks' = ordinati per classe, 'classes' = barre di classe. */
function kernelParts(n: N): Part[] {
  const Nn = clamp(Math.round(n.count), 4, 40);
  const shuffled = flag(n, 'shuffled'), classes = flag(n, 'classes'), grid = flag(n, 'grid');
  const rand = rng(29 + Nn);
  const pts = Array.from({ length: Nn }, (_, i) => {
    const c = i < Nn / 2 ? 0 : 1;
    return { c, u: (c ? 0.7 : 0.3) + 0.085 * gauss(rand), v: (c ? 0.62 : 0.38) + 0.085 * gauss(rand) };
  });
  if (shuffled) for (let i = Nn - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  const strip = classes ? Math.max(4, Math.min(n.w, n.h) * 0.06) : 0;
  const off = strip ? strip + 2 : 0;
  const x0 = n.x + off, y0 = n.y + off;
  const cw = (n.w - off) / Nn, ch = (n.h - off) / Nn;
  const hi = n.stroke === 'none' ? '#2F5E9E' : shade(n.stroke, -0.3);
  const lo = n.fill === 'none' ? '#FFFFFF' : n.fill;
  const parts: Part[] = [];
  for (let i = 0; i < Nn; i++) for (let j = 0; j < Nn; j++) {
    const d2 = (pts[i].u - pts[j].u) ** 2 + (pts[i].v - pts[j].v) ** 2;
    const k = i === j ? 1 : Math.exp(-d2 / 0.07);
    parts.push(box(x0 + j * cw, y0 + i * ch, cw + 0.15, ch + 0.15, mix(lo, hi, k ** 0.85), 'none'));
  }
  if (grid) {
    const cmds: Cmd[] = [];
    for (let i = 1; i < Nn; i++) cmds.push(['M', x0 + i * cw, y0], ['L', x0 + i * cw, y0 + Nn * ch], ['M', x0, y0 + i * ch], ['L', x0 + Nn * cw, y0 + i * ch]);
    parts.push(line(cmds, '#FFFFFF', 0.5));
  }
  parts.push(box(x0, y0, Nn * cw, Nn * ch, 'none', n.stroke === 'none' ? '#666666' : n.stroke, 0.9));
  if (classes) pts.forEach((q, i) => {
    const c = CLS[q.c ? 3 : 0];
    parts.push(box(x0 + i * cw, n.y, cw + 0.15, strip, c.fill, 'none'), box(n.x, y0 + i * ch, strip, ch + 0.15, c.fill, 'none'));
  });
  return parts;
}

// ======================================================================
// Ensemble di stati sulla sfera di Bloch (QuDDPM)
// ======================================================================

/** Sfera di Bloch con un insieme di stati: `count` = diffusione 0 (dati raccolti) … 100 (rumore di Haar). */
function ensembleParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const labels = flag(n, 'labels'), grid = !flag(n, 'nogrid'), ring = flag(n, 'ring');
  const fs = clamp(Math.min(w, h) * 0.09, 7, 12);
  const R = Math.min(w, h) / 2 - (labels ? fs * 1.15 : 2);
  const cx = x + w / 2, cy = y + h / 2;
  const az = 24 * DEG, el = 17 * DEG;
  const rv = [-Math.sin(az), Math.cos(az), 0];
  const uv = [-Math.sin(el) * Math.cos(az), -Math.sin(el) * Math.sin(az), Math.cos(el)];
  const vd = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  const P = (v: number[]): P2 => [cx + R * (v[0] * rv[0] + v[1] * rv[1] + v[2] * rv[2]), cy - R * (v[0] * uv[0] + v[1] * uv[1] + v[2] * uv[2])];
  const depth = (v: number[]) => v[0] * vd[0] + v[1] * vd[1] + v[2] * vd[2];
  const ink = n.stroke === 'none' ? '#D62728' : n.stroke;
  const rim = '#9AA3AE';
  const parts: Part[] = [disc(cx, cy, R, n.fill === 'none' ? '#FFFFFF' : n.fill, rim, 0.9)];
  // punti
  const rand = rng(53 + (ring ? 7 : 0) + 17 * Math.round(numOf(n, 'seed', 0)));
  const k = clamp(Math.round(numOf(n, 'points', 70)), 5, 300);
  const s = (clamp(n.count, 0, 100) / 100) ** 1.3 * 5;
  const pts = Array.from({ length: k }, (_, i) => {
    const base = ring ? [0.5 * Math.cos((TAU * i) / k), 0.866 * Math.cos((TAU * i) / k), Math.sin((TAU * i) / k)] : [0.16 * gauss(rand), 0.16 * gauss(rand), 1];
    const b = norm(base);
    return norm([b[0] + s * gauss(rand) + 0.04 * gauss(rand), b[1] + s * gauss(rand) + 0.04 * gauss(rand), b[2] + s * gauss(rand) + 0.04 * gauss(rand)]);
  });
  const pr = clamp(R * 0.03, 1.1, 2.8);
  for (const v of pts) if (depth(v) < 0) parts.push(disc(...P(v), pr * 0.85, faded(ink, 0.55)));
  // griglia: equatore e due meridiani, dietro tratteggiati
  if (grid) {
    const circle = (f: (t: number) => number[]) => {
      const sm = Array.from({ length: 97 }, (_, i) => f((TAU * i) / 96));
      let cur: P2[] = [];
      let front = depth(sm[0]) >= 0;
      const flush = () => cur.length > 1 && parts.push(line(front ? pl(cur) : dashes(cur, 2.2, 2), front ? '#7C8591' : '#BCC2CA', front ? 0.75 : 0.6));
      for (const v of sm) {
        const fr = depth(v) >= 0;
        if (fr !== front) {
          cur.push(P(v));
          flush();
          cur = [];
          front = fr;
        }
        cur.push(P(v));
      }
      flush();
    };
    circle((t) => [Math.cos(t), Math.sin(t), 0]);
    circle((t) => [Math.sin(t), 0, Math.cos(t)]);
    circle((t) => [0, Math.sin(t), Math.cos(t)]);
  }
  for (const v of pts) if (depth(v) >= 0) parts.push(disc(...P(v), pr, ink));
  if (labels) {
    const N0 = P([0, 0, 1]), S0 = P([0, 0, -1]), X1 = P([1.06, 0, 0]), Y1 = P([0, 1.08, 0]);
    parts.push(text(N0[0], N0[1] - fs * 0.75, '$|0\\rangle$', fs * 0.9), text(S0[0], S0[1] + fs * 0.7, '$|1\\rangle$', fs * 0.9));
    parts.push(text(X1[0] - 2, X1[1] + fs * 0.5, '$x$', fs * 0.85, '#7C8591', 'end'), text(Y1[0] + 3, Y1[1], '$y$', fs * 0.85, '#7C8591', 'start'));
  }
  return parts;
}

// ======================================================================
// Immagini a pixel: bars-and-stripes, cifre scritte a mano, pattern binari
// ======================================================================

// cifre come tratti in coordinate unitarie (y verso il basso)
const DIGITS: P2[][][] = [
  [Array.from({ length: 33 }, (_, i): P2 => [0.5 + 0.24 * Math.sin((TAU * i) / 32), 0.5 - 0.34 * Math.cos((TAU * i) / 32)])],
  [[[0.38, 0.3], [0.56, 0.14], [0.52, 0.86]]],
  [[[0.28, 0.3], [0.38, 0.17], [0.55, 0.14], [0.7, 0.25], [0.67, 0.43], [0.48, 0.62], [0.27, 0.84], [0.75, 0.84]]],
  [[[0.29, 0.2], [0.5, 0.13], [0.68, 0.23], [0.66, 0.39], [0.47, 0.48], [0.68, 0.58], [0.7, 0.76], [0.5, 0.87], [0.27, 0.8]]],
  [[[0.6, 0.86], [0.6, 0.14], [0.25, 0.62], [0.77, 0.62]]],
  [[[0.71, 0.15], [0.37, 0.15], [0.32, 0.46], [0.52, 0.41], [0.69, 0.52], [0.7, 0.73], [0.54, 0.87], [0.29, 0.81]]],
  [[[0.65, 0.14], [0.43, 0.3], [0.32, 0.55], [0.35, 0.78], [0.52, 0.87], [0.68, 0.76], [0.66, 0.58], [0.5, 0.5], [0.34, 0.6]]],
  [[[0.27, 0.16], [0.73, 0.16], [0.47, 0.87]], [[0.38, 0.5], [0.66, 0.5]]],
  [Array.from({ length: 41 }, (_, i): P2 => [0.5 + 0.21 * Math.sin((2 * TAU * i) / 40), 0.5 + 0.36 * Math.cos((TAU * i) / 40)])],
  [[[0.67, 0.36], [0.56, 0.17], [0.38, 0.19], [0.31, 0.35], [0.42, 0.5], [0.6, 0.47], [0.67, 0.36], [0.63, 0.62], [0.52, 0.87]]],
];
// pattern bars-and-stripes 2×2 (righe dall'alto)
const BAS22 = ['00/00', '11/11', '11/00', '00/11', '10/10', '01/01', '10/01', '01/10', '11/01', '10/11'];

function segDist(px: number, py: number, a: P2, b: P2) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

/** Immagine a pixel: 'digit' (`count` = cifra, 'res=14'), 'bas' (`count` = pattern 2×2) o righe esplicite '10/01'. */
function pixelParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const dark = flag(n, 'dark'), grid = flag(n, 'grid');
  const on = dark ? '#FFFFFF' : n.stroke === 'none' ? '#2F5E9E' : n.stroke;
  const off = dark ? '#111111' : n.fill === 'none' ? '#FFFFFF' : n.fill;
  const explicit = n.spec.split(/\s+/).find((s) => /^[01]+(\/[01]+)+$/.test(s));
  let rows: number[][];
  if (flag(n, 'digit')) {
    const res = clamp(Math.round(numOf(n, 'res', 14)), 4, 28);
    const strokes = DIGITS[((Math.round(n.count) % 10) + 10) % 10];
    rows = Array.from({ length: res }, (_, j) => Array.from({ length: res }, (_, i) => {
      const px = (i + 0.5) / res, py = (j + 0.5) / res;
      let d = 9;
      for (const st of strokes) for (let s = 1; s < st.length; s++) d = Math.min(d, segDist(px, py, st[s - 1], st[s]));
      return clamp(1 - (d - 0.045) / 0.075, 0, 1);
    }));
  } else {
    const src = explicit ?? BAS22[((Math.round(n.count) % BAS22.length) + BAS22.length) % BAS22.length];
    rows = src.split('/').map((r) => [...r].map((c) => +c));
  }
  const R = rows.length, C = Math.max(...rows.map((r) => r.length));
  const cw = w / C, ch = h / R;
  const parts: Part[] = [box(x, y, w, h, off, 'none')];
  rows.forEach((r, j) => r.forEach((v, i) => v > 0.03 && parts.push(box(x + i * cw, y + j * ch, cw + 0.15, ch + 0.15, mix(off, on, v), 'none'))));
  if (grid) {
    const cmds: Cmd[] = [];
    for (let i = 1; i < C; i++) cmds.push(['M', x + i * cw, y], ['L', x + i * cw, y + h]);
    for (let j = 1; j < R; j++) cmds.push(['M', x, y + j * ch], ['L', x + w, y + j * ch]);
    parts.push(line(cmds, dark ? '#444444' : '#6C8EBF', 0.7));
  }
  parts.push(box(x, y, w, h, 'none', dark ? '#111111' : n.stroke === 'none' ? '#6C8EBF' : n.stroke, 0.9));
  return parts;
}

// ======================================================================
// Macchina di Boltzmann quantistica (Amin et al. 2018)
// ======================================================================

const QBM_HID = '#C0392B', QBM_VIS = '#2F6FB2', QBM_IN = '#3E8E3A';

/** QBM: qubit nascosti (rossi) e visibili (blu); 'full', 'restricted' (niente archi fra nascosti), 'disc' (ingressi classici). */
function qbmParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const kind = kindOf(n, ['full', 'restricted', 'disc'] as const, 'full');
  const k = clamp(Math.round(n.count), 2, 10);
  const r = clamp(Math.min(w / (k * 2.9), h * 0.075), 2.5, 9);
  const X = (m: number, i: number, a = 0, b = 1) => x + r + (w - 2 * r) * (a + ((b - a) * (m > 1 ? i / (m - 1) : 0.5)));
  const yH = y + h * 0.27, yV = y + h * (kind === 'disc' ? 0.7 : 0.73), yI = y + h * 0.93;
  const hid = Array.from({ length: k }, (_, i): P2 => [X(k, i), yH]);
  const kout = kind === 'disc' ? Math.max(1, Math.round(k * 0.4)) : k;
  const kin = kind === 'disc' ? k - kout + 1 : 0;
  const vis = Array.from({ length: kout }, (_, i): P2 => [kind === 'disc' ? X(kout, i, 0.62, 1) : X(k, i), yV]);
  const inp = Array.from({ length: kin }, (_, i): P2 => [X(kin, i, 0, 0.5), yI]);
  const sw = clamp(r * 0.13, 0.5, 0.9);
  const parts: Part[] = [];
  const cmds: Cmd[] = [];
  for (const a of hid) for (const b of vis) cmds.push(['M', a[0], a[1]], ['L', b[0], b[1]]);
  parts.push(line(cmds, '#3A3F47', sw));
  if (kind === 'disc') {
    const g: Cmd[] = [];
    for (const a of inp) for (const b of [...hid, ...vis]) g.push(['M', a[0], a[1]], ['L', b[0], b[1]]);
    parts.push(line(g, faded(QBM_IN, 0.25), sw * 0.9));
  }
  const arcs = (row: P2[], up: boolean, color: string) => {
    const c: Cmd[] = [];
    row.forEach((a, i) => row.forEach((b, j) => {
      const s = j - i;
      if (s < 1 || s > 3 || (s === 2 && i % 2) || (s === 3 && i % 3)) return;
      const hg = Math.min(h * 0.2, (b[0] - a[0]) * 0.42) * (up ? -1 : 1);
      c.push(['M', a[0], a[1]], ['C', a[0] + (b[0] - a[0]) * 0.2, a[1] + hg, a[0] + (b[0] - a[0]) * 0.8, b[1] + hg, b[0], b[1]]);
    }));
    if (c.length) parts.push(line(c, color, sw * 1.15));
  };
  if (kind !== 'restricted') arcs(hid, true, QBM_HID);
  if (kind !== 'disc') arcs(vis, false, QBM_VIS);
  for (const [px, py] of hid) parts.push(disc(px, py, r, QBM_HID, shade(QBM_HID, -0.3), 0.8));
  for (const [px, py] of vis) parts.push(disc(px, py, r, QBM_VIS, shade(QBM_VIS, -0.3), 0.8));
  for (const [px, py] of inp) parts.push(box(px - r * 0.85, py - r * 0.85, r * 1.7, r * 1.7, QBM_IN, shade(QBM_IN, -0.3), 0.8));
  return parts;
}

// ======================================================================
// Rete di spin interagenti (reservoir quantistico, modello di Ising)
// ======================================================================

/** Spin come sfere con freccia; 'network' (tutti accoppiati), 'chain' (primi vicini), 'lattice' (reticolo). */
function spinsParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const kind = kindOf(n, ['network', 'chain', 'lattice'] as const, 'network');
  const k = clamp(Math.round(n.count), 2, 16);
  const rand = rng(61 + k);
  let pos: P2[] = [];
  let edges: [number, number][] = [];
  let R: number;
  if (kind === 'chain') {
    R = clamp(Math.min(w / (k * 2.6), h * 0.2), 3, 14);
    pos = Array.from({ length: k }, (_, i): P2 => [x + R * 1.3 + ((w - R * 2.6) * i) / Math.max(1, k - 1), y + h / 2]);
    edges = Array.from({ length: k - 1 }, (_, i): [number, number] => [i, i + 1]);
  } else if (kind === 'lattice') {
    const C = Math.ceil(Math.sqrt(k)), Rw = Math.ceil(k / C);
    R = clamp(Math.min(w / (C * 2.8), h / (Rw * 2.8)), 3, 14);
    for (let i = 0; i < k; i++) pos.push([x + R * 1.4 + ((w - R * 2.8) * (i % C)) / Math.max(1, C - 1), y + R * 1.4 + ((h - R * 2.8) * Math.floor(i / C)) / Math.max(1, Rw - 1)]);
    for (let i = 0; i < k; i++) {
      if ((i % C) + 1 < C && i + 1 < k) edges.push([i, i + 1]);
      if (i + C < k) edges.push([i, i + C]);
    }
  } else {
    R = clamp(Math.min(w, h) * 0.085, 3, 15);
    pos = Array.from({ length: k }, (_, i): P2 => {
      const a = -Math.PI / 2 + (TAU * i) / k + (rand() - 0.5) * 0.5;
      const f = 0.82 + 0.18 * rand();
      return [x + w / 2 + (w / 2 - R * 1.7) * f * Math.cos(a), y + h / 2 + (h / 2 - R * 1.7) * f * Math.sin(a)];
    });
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) edges.push([i, j]);
  }
  const parts: Part[] = [];
  const cmds: Cmd[] = [];
  for (const [a, b] of edges) cmds.push(['M', pos[a][0], pos[a][1]], ['L', pos[b][0], pos[b][1]]);
  parts.push(line(cmds, '#B4BCC6', clamp(R * 0.28, 0.8, 3)));
  const fill = n.fill === 'none' ? '#2F4F7F' : n.fill;
  const ink = n.stroke === 'none' ? '#2B2B2B' : n.stroke;
  pos.forEach(([px, py]) => {
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.2 + (rand() < 0.2 ? Math.PI : 0);
    const u: P2 = [Math.cos(a), Math.sin(a)];
    parts.push(line(seg([px - u[0] * R * 1.55, py - u[1] * R * 1.55], [px, py]), ink, clamp(R * 0.17, 0.9, 2)));
    parts.push(disc(px, py, R, fill, shade(fill, -0.35), 0.8), disc(px - R * 0.3, py - R * 0.32, R * 0.38, mix(fill, '#FFFFFF', 0.55)));
    parts.push(...arrow([px, py], [px + u[0] * R * 1.95, py + u[1] * R * 1.95], ink, clamp(R * 0.17, 0.9, 2), clamp(R * 0.55, 3, 7)));
  });
  return parts;
}

// ======================================================================
// Dataset 2D a due classi (cerchio, spirali, lune, XOR)
// ======================================================================

const DATA2D = ['circle', 'spiral', 'moons', 'xor'] as const;

/** Dataset 2D: `count` = punti per classe; 'boundary' colora le regioni della classificazione ideale. */
function data2dParts(n: N): Part[] {
  const kind = kindOf(n, DATA2D, 'circle');
  const k = clamp(Math.round(n.count), 5, 120);
  const axes = flag(n, 'axis'), regions = flag(n, 'boundary');
  const p = plotArea(n, axes ? { l: 0.06, r: 0.03, t: 0.03, b: 0.06 } : { l: 0.03, r: 0.03, t: 0.03, b: 0.03 });
  const parts = panel(n, p, axes);
  const rand = rng(71 + k);
  const A = CLS[0], Bc = CLS[3];
  const pts: { u: number; v: number; c: number }[] = [];
  const rho = Math.sqrt(2 / Math.PI) * 0.5;
  const turns = 3.4 * Math.PI, rmax = 0.46;
  if (kind === 'circle') {
    while (pts.length < 2 * k) {
      const u = 0.04 + 0.92 * rand(), v = 0.04 + 0.92 * rand();
      pts.push({ u, v, c: Math.hypot(u - 0.5, v - 0.5) < rho ? 1 : 0 });
    }
  } else if (kind === 'spiral') {
    for (let c = 0; c < 2; c++) for (let i = 0; i < k; i++) {
      const t = 0.12 + (0.88 * i) / k, a = turns * t + c * Math.PI;
      pts.push({ u: 0.5 + rmax * t * Math.cos(a) + 0.012 * gauss(rand), v: 0.5 + rmax * t * Math.sin(a) + 0.012 * gauss(rand), c });
    }
  } else if (kind === 'moons') {
    for (let c = 0; c < 2; c++) for (let i = 0; i < k; i++) {
      const t = (Math.PI * i) / (k - 1);
      const X = c ? 1 - Math.cos(t) : Math.cos(t), Y = c ? 0.5 - Math.sin(t) : Math.sin(t);
      pts.push({ u: 0.08 + ((X + 1) / 3) * 0.84 + 0.015 * gauss(rand), v: 0.22 + ((Y + 0.5) / 1.5) * 0.56 + 0.015 * gauss(rand), c });
    }
  } else {
    while (pts.length < 2 * k) {
      const u = 0.05 + 0.9 * rand(), v = 0.05 + 0.9 * rand();
      if (Math.abs(u - 0.5) < 0.04 || Math.abs(v - 0.5) < 0.04) continue;
      pts.push({ u, v, c: (u > 0.5) !== (v > 0.5) ? 1 : 0 });
    }
  }
  if (regions) {
    const clip = p.clip;
    parts.push(area(poly([p.P(0, 0), p.P(1, 0), p.P(1, 1), p.P(0, 1)]), A.tint, { clip }));
    if (kind === 'circle') {
      const ring = Array.from({ length: 64 }, (_, i): P2 => p.P(0.5 + rho * Math.cos((TAU * i) / 64), 0.5 + rho * Math.sin((TAU * i) / 64)));
      parts.push(area(poly(ring), Bc.tint, { clip }), line(poly(ring), shade(Bc.stroke, 0.2), 0.9, { clip }));
    } else if (kind === 'spiral') {
      const R2 = 1.0, steps = 160, kk = turns / rmax;
      const edge = (s: number) => Array.from({ length: steps + 1 }, (_, i): P2 => {
        const r = (R2 * i) / steps;
        return p.P(0.5 + r * Math.cos(kk * r + Math.PI + s), 0.5 + r * Math.sin(kk * r + Math.PI + s));
      });
      const a = edge(Math.PI / 2), b = edge(-Math.PI / 2).reverse();
      const outer = Array.from({ length: 21 }, (_, i): P2 => {
        const ang = kk * R2 + Math.PI + Math.PI / 2 - (Math.PI * i) / 20;
        return p.P(0.5 + R2 * Math.cos(ang), 0.5 + R2 * Math.sin(ang));
      });
      parts.push(area(poly([...a, ...outer, ...b]), Bc.tint, { clip }));
    } else if (kind === 'xor') {
      parts.push(area(poly([p.P(0.5, 0), p.P(1, 0), p.P(1, 0.5), p.P(0.5, 0.5)]), Bc.tint, { clip }), area(poly([p.P(0, 0.5), p.P(0.5, 0.5), p.P(0.5, 1), p.P(0, 1)]), Bc.tint, { clip }));
    }
  }
  const r = clamp(p.s * 0.022, 1.3, 3.2);
  for (const q of pts) {
    const c = q.c ? Bc : A;
    parts.push(marker('o', ...p.P(q.u, q.v), r, { fill: c.fill, stroke: c.stroke }, 0.7));
  }
  return parts;
}

// ---------------- varianti nel pannello ----------------

const c = (value: string, label: string) => ({ value, label });

const OPTIONS: Record<string, SpecGroup[]> = {
  'qml-dist': [
    { title: 'Target', choices: [c('lognormal', 'Log-normale'), c('bimodal', 'Bimodale'), c('gamma', 'Gamma'), c('gauss', 'Gaussiana'), c('bas', 'Bars & stripes'), c('triangular', 'Triangolare'), c('uniform', 'Uniforme')] },
    { title: 'Opzioni', mode: 'many', choices: [c('target', 'Linea del target'), c('data', 'Barre = dati'), c('axis', 'Asse y'), c('bits', 'Stringhe di bit'), c('index', 'Indici'), c('legend', 'Legenda')] },
  ],
  'qml-curve': [
    { title: 'Grafico', choices: [c('variance', 'Var. del gradiente vs qubit'), c('layers', 'Var. vs strati'), c('ganloss', 'Loss qGAN'), c('kl', 'KL del QCBM'), c('landscape', 'Paesaggio (plateau)'), c('signal', 'Segnali misurati'), c('input', 'Ingresso s_k')] },
    { title: 'Opzioni', mode: 'many', choices: [c('axis', 'Tacche'), c('legend', 'Legenda'), c('plain', 'Senza nomi degli assi')] },
  ],
  'qml-kernel': [
    { title: 'Ordine', choices: [c('blocks', 'Per classe (blocchi)'), c('shuffled', 'Mescolato')] },
    { title: 'Opzioni', mode: 'many', choices: [c('classes', 'Barre di classe'), c('grid', 'Griglia')] },
  ],
  'qml-ensemble': [
    { title: 'Dati', choices: [c('cluster', 'Raccolti attorno a |0⟩'), c('ring', 'Su un cerchio')] },
    { title: 'Opzioni', mode: 'many', choices: [c('labels', '|0⟩ |1⟩ e assi'), c('nogrid', 'Senza griglia')] },
  ],
  'qml-pixels': [
    { title: 'Immagine', choices: [c('bas', 'Bars & stripes 2×2'), c('digit', 'Cifra (count)')] },
    { title: 'Opzioni', mode: 'many', choices: [c('grid', 'Griglia'), c('dark', 'Su fondo nero')] },
  ],
  'qml-qbm': [{ title: 'Modello', choices: [c('full', 'Completa'), c('restricted', 'Ristretta'), c('disc', 'Discriminativa')] }],
  'qml-spins': [{ title: 'Topologia', choices: [c('network', 'Tutti accoppiati'), c('chain', 'Catena'), c('lattice', 'Reticolo')] }],
  'qml-data2d': [
    { title: 'Dataset', choices: [c('circle', 'Cerchio'), c('spiral', 'Spirali'), c('moons', 'Lune'), c('xor', 'XOR')] },
    { title: 'Opzioni', mode: 'many', choices: [c('boundary', 'Regioni delle classi'), c('axis', 'Assi')] },
  ],
};

const DEFS: Omit<ShapeDef, 'specOptions'>[] = [
  { kind: 'qml-dist', name: 'Distribuzione (modello vs target)', parts: distParts, countLabel: 'Classi (2^n)', countMax: 64, specLabel: 'Target e opzioni' },
  { kind: 'qml-curve', name: 'Curve di training (QML)', parts: curveParts, countLabel: 'Serie', countMax: 40, specLabel: 'Grafico' },
  { kind: 'qml-kernel', name: 'Matrice di kernel', parts: kernelParts, countLabel: 'Campioni', countMax: 40, specLabel: 'Opzioni' },
  { kind: 'qml-ensemble', name: 'Ensemble di stati (Bloch)', parts: ensembleParts, countLabel: 'Diffusione (0–100)', countMax: 100, specLabel: 'Opzioni (points=70, seed=1)' },
  { kind: 'qml-pixels', name: 'Immagine a pixel', parts: pixelParts, countLabel: 'Pattern o cifra', countMax: 9, specLabel: 'Pattern (es. 10/01) o variante' },
  { kind: 'qml-qbm', name: 'Boltzmann machine quantistica', parts: qbmParts, countLabel: 'Unità per strato', countMax: 10, specLabel: 'Modello' },
  { kind: 'qml-spins', name: 'Rete di spin', parts: spinsParts, countLabel: 'Spin', countMax: 16, specLabel: 'Topologia' },
  { kind: 'qml-data2d', name: 'Dataset 2D (due classi)', parts: data2dParts, countLabel: 'Punti per classe', countMax: 120, specLabel: 'Dataset' },
];

export const QML_SHAPES: ShapeDef[] = DEFS.map((d) => ({ ...d, specOptions: OPTIONS[d.kind] }));
