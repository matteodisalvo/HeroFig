// Forme del modulo "signal processing": grafici di segnali (tempo, frequenza, tempo-frequenza,
// piano z, costellazioni...) e simboli dei diagrammi a blocchi DSP. Tutte procedurali e
// deterministiche (rng), disegnate con le primitive `Part`: identiche in SVG, PDF, PNG e TikZ.
//
// Le varianti si scelgono con il campo `spec` (parole chiave combinabili): i valori ammessi
// sono elencati in `specOptions` di ogni forma, in fondo al file, e compaiono come pulsanti.
import { arc, framed, mix, poly, rng, shade, type Box, type Cmd, type LabelLayout, type Part, type Rand } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';

type P2 = [number, number];
type N = NodeModel;

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const AXIS = '#8A9099';
const GUIDE = '#B9BEC6';
const TEXT = '#4B5563';
const ALT = '#D9822B';

const inkOf = (n: N, fb = '#444444') => (n.stroke === 'none' ? fb : n.stroke);
const has = (spec: string, word: string) => new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, 'i').test(spec);
const kindOf = <T extends string>(spec: string, kinds: readonly T[], fb: T): T => kinds.find((k) => has(spec, k)) ?? fb;
const tint = (c: string, t: number) => mix(c, '#FFFFFF', t);

const line = (cmds: Cmd[], stroke: string, sw: number): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true });
const area = (cmds: Cmd[], fill: string): Part => ({ kind: 'path', cmds, fill, stroke: 'none' });
const disc = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true });
const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];
const sinc = (x: number) => (Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x);
const gauss = (x: number, c: number, s: number) => Math.exp(-(((x - c) / s) ** 2));
const text = (x: number, y: number, t: string, size: number, anchor: 'start' | 'middle' | 'end' = 'middle', fill = TEXT): Part => ({ kind: 'text', x, y, text: t, size, fill, anchor });
/** Larghezza approssimata di un'etichetta breve (le formule hanno lettere più strette). */
const textW = (t: string, size: number) => t.replace(/\$|\\[a-zA-Z]+|[_^{}]/g, (m) => (m.startsWith('\\') ? 'x' : '')).length * size * 0.55;
/** Dimensione del testo degli assi: leggibile ma proporzionata al grafico. */
const axisSize = (n: N) => clamp(Math.min(n.w, n.h) * 0.16, 8, 11);

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

const circlePts = (cx: number, cy: number, r: number, k = 72): P2[] =>
  Array.from({ length: k + 1 }, (_, i): P2 => [cx + r * Math.cos((TAU * i) / k), cy + r * Math.sin((TAU * i) / k)]);

/** Riquadro (se il blocco ha un riempimento) e assi con frecce. */
interface Plot {
  parts: Part[];
  X: (u: number) => number;
  base: number;
  up: number;
  down: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  hs: number;
  /** Dimensione del testo degli assi, se i nomi degli assi sono attivi (`labels`), altrimenti 0. */
  ls: number;
}

function plotFrame(n: N, baseFrac: number, opt: { axes?: boolean; vAxis?: 'left' | 'center' | 'none'; xName?: string } = {}): Plot {
  const { x, y, w, h } = n;
  const axes = opt.axes ?? true;
  const vAxis = opt.vAxis ?? 'left';
  const parts: Part[] = [];
  const boxed = n.fill !== 'none';
  if (boxed) parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill: n.fill });
  const p = boxed ? clamp(Math.min(w, h) * 0.1, 3, 7) : 1;
  const x0 = x + p, x1 = x + w - p, y0 = y + p, y1 = y + h - p;
  const hs = clamp(Math.min(w, h) * 0.07, 2.8, 4.5);
  const base = y0 + (y1 - y0) * baseFrac;
  if (!axes) return { parts, X: (u) => x0 + u * (x1 - x0), base, up: base - y0, down: y1 - base, x0, x1, y0, y1, hs, ls: 0 };
  // nome dell'asse orizzontale in fondo alla freccia: "──→ t"
  const ls = opt.xName && has(n.spec, 'labels') ? axisSize(n) : 0;
  const xe = ls ? x1 - textW(opt.xName!, ls) - 3 : x1;
  if (ls) parts.push(text(x1, base, opt.xName!, ls, 'end'));
  parts.push(...arrow([x0, base], [xe, base], AXIS, 0.8, hs));
  const cx0 = vAxis === 'left' ? x0 + 4 : x0 + 1, cx1 = xe - hs - 2;
  if (vAxis === 'left') parts.push(...arrow([x0 + 1.5, y1], [x0 + 1.5, y0], AXIS, 0.8, hs));
  if (vAxis === 'center') parts.push(...arrow([(cx0 + cx1) / 2, y1], [(cx0 + cx1) / 2, y0], AXIS, 0.8, hs));
  return { parts, X: (u) => cx0 + u * (cx1 - cx0), base, up: base - (y0 + hs + 1.5), down: y1 - base, x0, x1: xe, y0, y1, hs, ls };
}

const traceW = (n: N) => Math.max(0.8, n.strokeWidth * 1.1);

// ======================================================================
// Segnali nel tempo
// ======================================================================

const SIGNALS = ['sine', 'cosine', 'chirp', 'square', 'triangle', 'sawtooth', 'noisy', 'noise', 'impulses', 'am', 'fm', 'burst', 'pulse', 'step', 'sinc', 'damped', 'audio'] as const;

function signalShape(n: N): Part[] {
  const kind = kindOf(n.spec, SIGNALS, 'sine');
  const c = clamp(Math.round(n.count), 1, 24);
  const positive = kind === 'impulses' || kind === 'pulse' || kind === 'step';
  const P = plotFrame(n, positive ? 0.86 : 0.5, { axes: !has(n.spec, 'noaxes'), xName: '$t$' });
  const col = inkOf(n);
  const sw = traceW(n);
  const amp = positive ? P.up : Math.min(P.up, P.down);
  const Y = (v: number) => P.base - v * amp;
  const parts = P.parts;
  const rand = rng(97 + c * 13);
  const sample = (f: (u: number) => number, N: number): P2[] => Array.from({ length: N + 1 }, (_, i): P2 => [P.X(i / N), Y(f(i / N))]);
  let pts: P2[] = [];
  switch (kind) {
    case 'square': {
      const halfs = 2 * c;
      for (let k = 0; k < halfs; k++) {
        const v = k % 2 ? -0.8 : 0.8;
        pts.push([P.X(k / halfs), Y(v)], [P.X((k + 1) / halfs), Y(v)]);
      }
      break;
    }
    case 'triangle':
      for (let k = 0; k <= 4 * c; k++) pts.push([P.X(k / (4 * c)), Y([0, 0.8, 0, -0.8][k % 4])]);
      break;
    case 'sawtooth':
      for (let k = 0; k < c; k++) pts.push([P.X(k / c), Y(-0.8)], [P.X((k + 1) / c), Y(0.8)]);
      pts.push([P.X(1), Y(-0.8)]);
      break;
    case 'impulses': {
      for (let k = 0; k < c; k++) {
        const u = (k + 0.5) / c;
        parts.push(...arrow([P.X(u), P.base], [P.X(u), Y(0.92)], col, sw, P.hs + 0.5));
      }
      return parts;
    }
    case 'pulse':
      pts = [[P.X(0), Y(0)], [P.X(0.3), Y(0)], [P.X(0.3), Y(0.85)], [P.X(0.7), Y(0.85)], [P.X(0.7), Y(0)], [P.X(1), Y(0)]];
      break;
    case 'step':
      pts = [[P.X(0), Y(0)], [P.X(0.25), Y(0)], [P.X(0.25), Y(0.8)], [P.X(1), Y(0.8)]];
      break;
    case 'am': {
      const fc = Math.max(10, 7 * c);
      const env = (u: number) => 0.55 + 0.33 * Math.sin(TAU * c * 0.5 * u + 0.4);
      const envPts = (s: number) => Array.from({ length: 81 }, (_, i): P2 => [P.X(i / 80), Y(s * env(i / 80))]);
      parts.push(line(dashes(envPts(1), 2.6, 2), shade(col, 0.45), 0.8), line(dashes(envPts(-1), 2.6, 2), shade(col, 0.45), 0.8));
      pts = sample((u) => env(u) * Math.sin(TAU * fc * u), 24 * fc);
      break;
    }
    case 'fm':
      pts = sample((u) => 0.8 * Math.sin(TAU * 4.5 * c * u - 7 * Math.cos(TAU * c * 0.5 * u)), 500);
      break;
    case 'chirp':
      pts = sample((u) => 0.8 * Math.sin(TAU * (0.6 * u + ((3.6 * c - 0.6) * u * u) / 2)), 500);
      break;
    case 'noisy': {
      let prev = 0;
      pts = sample((u) => {
        const r = rand() * 2 - 1;
        prev = 0.5 * prev + 0.5 * r;
        return 0.6 * Math.sin(TAU * c * u) + 0.32 * prev;
      }, 150);
      break;
    }
    case 'noise':
      pts = sample(() => 0.85 * (rand() * 2 - 1) * (0.5 + 0.5 * rand()), 110);
      break;
    case 'burst':
      pts = sample((u) => 0.88 * gauss(u, 0.5, 0.17) * Math.cos(TAU * 3 * c * (u - 0.5)), 300);
      break;
    case 'sinc':
      pts = sample((u) => 0.88 * sinc((u - 0.5) * Math.PI * 4 * c), 300);
      break;
    case 'damped':
      pts = sample((u) => 0.88 * Math.exp(-3.5 * u) * Math.sin(TAU * c * u), 300);
      break;
    case 'audio': {
      // sillabe: inviluppi separati da pause, portante densa con piccole irregolarità
      const bumps = [[0.12, 0.045, 0.55], [0.27, 0.05, 0.95], [0.43, 0.035, 0.7], [0.58, 0.06, 0.88], [0.78, 0.045, 0.62], [0.9, 0.03, 0.35]];
      const env = (u: number) => 0.025 + bumps.reduce((s, [m, sd, a]) => s + a * gauss(u, m, sd), 0);
      const M = clamp(Math.round(n.w * 2.2), 160, 800);
      pts = sample((u) => clamp(env(u), 0, 1) * (0.6 * Math.sin(TAU * u * M * 0.23) + 0.4 * (rand() * 2 - 1)), M);
      break;
    }
    case 'cosine':
      pts = sample((u) => 0.8 * Math.cos(TAU * c * u), 60 * c);
      break;
    default:
      pts = sample((u) => 0.8 * Math.sin(TAU * c * u), 60 * c);
  }
  parts.push(line(poly(pts, false), col, kind === 'audio' || kind === 'noise' ? Math.max(0.6, sw * 0.6) : sw));
  return parts;
}

// ======================================================================
// Segnali a tempo discreto: stem, campionamento, tenuta, quantizzazione
// ======================================================================

const DISCRETE = ['sine', 'sinc', 'decay', 'damped', 'random', 'impulse', 'step', 'rect'] as const;

function discreteShape(n: N): Part[] {
  const kind = kindOf(n.spec, DISCRETE, 'sine');
  const N = clamp(Math.round(n.count), 3, 48);
  const quant = has(n.spec, 'quant');
  const hold = has(n.spec, 'hold') || quant;
  const analog = has(n.spec, 'analog') || quant;
  const positive = ['decay', 'impulse', 'step', 'rect'].includes(kind);
  const P = plotFrame(n, positive ? 0.86 : kind === 'sinc' ? 0.72 : 0.5, { xName: '$n$' });
  const col = inkOf(n);
  const sw = traceW(n);
  const amp = positive || kind === 'sinc' ? P.up : Math.min(P.up, P.down);
  const Y = (v: number) => P.base - v * amp;
  const n0 = Math.max(1, Math.round(N * 0.18));
  const rand = rng(31 + N * 7);
  const rnd = Array.from({ length: N + 3 }, () => (rand() * 2 - 1) * 0.85);
  const f = (t: number): number => {
    switch (kind) {
      case 'sinc': return 0.95 * sinc((t - (N - 1) / 2) * (Math.PI / 2.6));
      case 'decay': return t < n0 - 1e-9 ? 0 : 0.92 * Math.exp((-4 * (t - n0)) / (N * 0.85));
      case 'damped': return t < n0 - 1e-9 ? 0 : 0.9 * Math.exp((-3.2 * (t - n0)) / N) * Math.cos((TAU * (t - n0)) / Math.max(3, N / 2.6));
      case 'impulse': return Math.abs(t - n0) < 0.5 ? 0.9 : 0;
      case 'step': return t >= n0 - 1e-9 ? 0.75 : 0;
      case 'rect': return t >= n0 - 1e-9 && t <= N - 1 - n0 + 1e-9 ? 0.75 : 0;
      case 'random': {
        // interpolazione morbida fra valori casuali (curva "analogica" passante per i campioni)
        const i = clamp(Math.floor(t), 0, N - 1), fr = t - i;
        const p0 = rnd[Math.max(0, i - 1)], p1 = rnd[i], p2 = rnd[i + 1], p3 = rnd[i + 2];
        return 0.5 * (2 * p1 + (-p0 + p2) * fr + (2 * p0 - 5 * p1 + 4 * p2 - p3) * fr * fr + (-p0 + 3 * p1 - 3 * p2 + p3) * fr * fr * fr);
      }
      default: return 0.82 * Math.sin((TAU * t) / (N / 1.5) + 0.35);
    }
  };
  const X = (t: number) => P.X((t + 0.5) / N);
  const parts = P.parts;
  const q = 0.25;
  const Q = (v: number) => Math.round(v / q) * q;
  const smoothKind = kind !== 'impulse' && kind !== 'step' && kind !== 'rect';
  if (quant) {
    // livelli di quantizzazione
    const lv: Cmd[] = [];
    for (let k = -4; k <= 4; k++) {
      if (k === 0) continue;
      const yy = Y(k * q);
      if (yy < P.y0 + P.hs || yy > P.y1) continue;
      lv.push(...dashes([[P.X(0), yy], [P.X(1), yy]], 1.6, 2.2));
    }
    parts.push(line(lv, GUIDE, 0.6));
  }
  if (analog && smoothKind) {
    const pts = Array.from({ length: 161 }, (_, i): P2 => {
      const t = -0.5 + (N * i) / 160;
      return [X(t), Y(f(clamp(t, 0, N - 1)))];
    });
    parts.push(line(quant ? poly(pts, false) : dashes(pts, 3, 2.2), quant ? GUIDE : shade(col, 0.4), quant ? 1 : 0.9));
  }
  const val = (i: number) => (quant ? Q(f(i)) : f(i));
  const r = clamp(Math.min((n.w / N) * 0.2, n.h * 0.05), 1.2, 2.6);
  if (hold) {
    const pts: P2[] = [];
    for (let i = 0; i < N; i++) pts.push([X(i), Y(val(i))], [Math.min(X(i + 1), P.X(1)), Y(val(i))]);
    parts.push(line(poly(pts, false), col, sw));
    for (let i = 0; i < N; i++) parts.push(disc(X(i), Y(val(i)), r * 0.9, col));
    return parts;
  }
  const stems: Cmd[] = [];
  for (let i = 0; i < N; i++) stems.push(...seg([X(i), P.base], [X(i), Y(val(i))]));
  parts.push(line(stems, col, Math.max(0.8, sw * 0.85)));
  for (let i = 0; i < N; i++) parts.push(disc(X(i), Y(val(i)), r, col));
  return parts;
}

// ======================================================================
// Spettri
// ======================================================================

const SPECTRA = ['peaks', 'harmonic', 'lines', 'sym', 'baseband', 'replica', 'aliasing', 'psd', 'bars', 'white'] as const;

function spectrumShape(n: N): Part[] {
  const kind = kindOf(n.spec, SPECTRA, 'peaks');
  const c = clamp(Math.round(n.count), 1, 32);
  const twoSided = kind === 'sym' || kind === 'baseband' || kind === 'replica' || kind === 'aliasing';
  const ticks = has(n.spec, 'labels') && (kind === 'replica' || kind === 'aliasing' || kind === 'baseband');
  const P = plotFrame(n, ticks ? 0.74 : 0.88, { vAxis: twoSided ? 'center' : 'left', xName: '$f$' });
  const col = inkOf(n);
  const sw = traceW(n);
  const Y = (v: number) => P.base - v * P.up;
  const parts = P.parts;
  const rand = rng(53 + c * 11);
  const fillCurve = (f: (u: number) => number, color: string, N = 220, light = 0.82) => {
    const pts = Array.from({ length: N + 1 }, (_, i): P2 => [P.X(i / N), Y(f(i / N))]);
    parts.push(area(poly([[P.X(0), P.base], ...pts, [P.X(1), P.base]]), tint(color, light)));
    parts.push(line(poly(pts, false), color, sw));
  };
  // banda base "a campana" su [-B, B], centrata in u0 (dominio u ∈ [0, 1])
  const lobe = (u: number, u0: number, B: number) => {
    const t = Math.abs(u - u0) / B;
    return t >= 1 ? 0 : 0.85 * (1 - t * t) * (0.75 + 0.25 * Math.cos(Math.PI * t * 1.6));
  };
  switch (kind) {
    case 'harmonic': {
      const f0 = 0.92 / (c + 0.4);
      fillCurve((u) => 0.03 + Array.from({ length: c }, (_, k) => 0.95 * 0.74 ** k * gauss(u, (k + 1) * f0, 0.011)).reduce((a, b) => a + b, 0), col, 400);
      break;
    }
    case 'lines': {
      const f0 = 0.94 / (c + 0.3);
      const r = clamp(n.h * 0.04, 1.3, 2.4);
      for (let k = 0; k < c; k++) {
        const u = (k + 0.5) * f0, v = 0.92 * 0.72 ** k;
        parts.push(line(seg([P.X(u), P.base], [P.X(u), Y(v)]), col, sw * 0.9), disc(P.X(u), Y(v), r, col));
      }
      break;
    }
    case 'sym':
      fillCurve((u) => 0.02 + 0.9 * gauss(u, 0.22, 0.05) + 0.9 * gauss(u, 0.78, 0.05), col, 300);
      break;
    case 'baseband':
      fillCurve((u) => lobe(u, 0.5, 0.3), col);
      break;
    case 'replica':
    case 'aliasing': {
      const fs = kind === 'replica' ? 0.32 : 0.2;
      const B = 0.13;
      const copies = [-2, -1, 1, 2];
      for (const k of copies) {
        const u0 = 0.5 + k * fs;
        if (u0 + B < -0.05 || u0 - B > 1.05) continue;
        const pts: P2[] = [];
        for (let i = 0; i <= 60; i++) {
          const u = u0 - B + (2 * B * i) / 60;
          if (u < 0 || u > 1) continue;
          pts.push([P.X(u), Y(lobe(u, u0, B))]);
        }
        if (pts.length > 1) parts.push(line(dashes(pts, 2.6, 1.8), shade(col, 0.35), sw * 0.85));
      }
      if (kind === 'aliasing') {
        // somma delle copie sovrapposte: la parte che si somma è evidenziata
        const total = (u: number) => [-2, -1, 0, 1, 2].reduce((s, k) => s + lobe(u, 0.5 + k * fs, B), 0);
        const pts = Array.from({ length: 301 }, (_, i): P2 => [P.X(i / 300), Y(Math.min(1, total(i / 300)))]);
        parts.push(line(poly(pts, false), '#C0392B', sw * 0.9));
      }
      fillCurve((u) => lobe(u, 0.5, B), col, 120);
      break;
    }
    case 'psd': {
      const peaks = Array.from({ length: c }, () => [0.12 + rand() * 0.8, 0.35 + rand() * 0.45] as const);
      let prev = 0;
      const pts = Array.from({ length: 181 }, (_, i): P2 => {
        const u = i / 180;
        prev = 0.55 * prev + 0.45 * (rand() - 0.5);
        const v = 0.42 - 0.18 * u + 0.12 * prev + peaks.reduce((s, [m, a]) => s + a * gauss(u, m, 0.012), 0);
        return [P.X(u), Y(clamp(v, 0.02, 1))];
      });
      parts.push(line(poly(pts, false), col, Math.max(0.7, sw * 0.8)));
      break;
    }
    case 'bars': {
      const K = clamp(c, 4, 64);
      const bw = (P.X(1) - P.X(0)) / K;
      const pk = [Math.floor(K * 0.2), Math.floor(K * 0.55)];
      for (let i = 0; i < K; i++) {
        const v = 0.08 + 0.12 * rand() + pk.reduce((s, p, j) => s + (j ? 0.6 : 0.85) * Math.exp(-((i - p) ** 2) / 1.2), 0);
        parts.push({ kind: 'rect', x: P.X(0) + i * bw + bw * 0.12, y: Y(Math.min(1, v)), w: bw * 0.76, h: P.base - Y(Math.min(1, v)), r: 0, fill: tint(col, 0.55), stroke: col, sw: 0.7, solid: true });
      }
      break;
    }
    case 'white': {
      let prev = 0;
      const pts = Array.from({ length: 121 }, (_, i): P2 => {
        prev = 0.5 * prev + 0.5 * (rand() - 0.5);
        return [P.X(i / 120), Y(0.5 + 0.06 * prev)];
      });
      parts.push(area(poly([[P.X(0), P.base], ...pts, [P.X(1), P.base]]), tint(col, 0.82)), line(poly(pts, false), col, sw));
      break;
    }
    default: {
      const peaks = Array.from({ length: c }, (_, k) => [0.12 + (0.78 * (k + 0.3 + 0.4 * rand())) / c, 0.5 + 0.45 * rand()] as const);
      fillCurve((u) => 0.04 + 0.16 * Math.exp(-3 * u) + peaks.reduce((s, [m, a]) => s + a * gauss(u, m, 0.022), 0), col, 300);
    }
  }
  if (ticks) {
    const T = (u: number, t: string) => parts.push(text(P.X(u), P.base + P.ls * 0.95, t, P.ls * 0.9));
    if (kind === 'baseband') {
      T(0.2, '$-B$');
      T(0.8, '$B$');
    } else {
      const fs = kind === 'replica' ? 0.32 : 0.2;
      T(0.5 - fs, '$-f_s$');
      T(0.5 + fs, '$f_s$');
    }
  }
  return parts;
}

// ======================================================================
// Spettrogramma, log-mel e scalogramma (immagini in cornice)
// ======================================================================

const CMAPS: Record<string, string[]> = {
  magma: ['#000004', '#1C1044', '#4F127B', '#812581', '#B5367A', '#E55064', '#FB8761', '#FEC287', '#FCFDBF'],
  viridis: ['#440154', '#482878', '#3E4A89', '#31688E', '#26828E', '#1F9E89', '#35B779', '#6DCD59', '#FDE725'],
  inferno: ['#000004', '#1F0C48', '#550F6D', '#88226A', '#BA3655', '#E35933', '#F98C0A', '#F9C932', '#FCFFA4'],
  gray: ['#000000', '#FFFFFF'],
  coolwarm: ['#3B4CC0', '#6F92F3', '#AAC7FD', '#DDDDDD', '#F7B89C', '#E7745B', '#B40426'],
};
/** Colormap quantizzata a 40 livelli: sfumature morbide, pochi colori distinti nel TikZ. */
const LEVELS = 39;
const cmap = (stops: string[], v: number) => {
  const s = (Math.round(clamp(v, 0, 1) * LEVELS) / LEVELS) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(s));
  return mix(stops[i], stops[i + 1], s - i);
};

/** Riga di celle colorate: le celle consecutive dello stesso colore diventano un solo rettangolo. */
function cellRow(parts: Part[], x0: number, y: number, cw: number, ch: number, colors: (string | null)[]) {
  let i = 0;
  while (i < colors.length) {
    const c = colors[i];
    let j = i + 1;
    while (j < colors.length && colors[j] === c) j++;
    if (c) parts.push({ kind: 'rect', x: x0 + i * cw, y, w: (j - i) * cw + 0.35, h: ch + 0.35, r: 0, fill: c, stroke: 'none' });
    i = j;
  }
}

interface Voice {
  t0: number;
  t1: number;
  f0: (t: number) => number;
  amp: (t: number, f: number) => number; // energia della componente a frequenza f
  harmonics: number;
  width: number; // spessore relativo della riga
}

/** Coefficienti MFCC (13 × frame): c0 molto negativo, i successivi oscillano attorno a 0. */
function mfccContent(b: Box, rand: Rand, cm: string[]): Part[] {
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: cmap(cm, 0.5), stroke: 'none' }];
  const rows = 13, cols = clamp(Math.round(b.w / 3.2), 10, 60);
  const cw = b.w / cols, ch = b.h / rows;
  const speech = (t: number) => 0.5 + 0.5 * Math.sin(TAU * 2.2 * t + 0.7) ** 2;
  for (let k = 0; k < rows; k++) {
    const row: string[] = [];
    const base = k === 0 ? -0.75 : k === 1 ? 0.55 : (rand() - 0.5) * 0.9 * Math.exp(-k / 10);
    const a1 = 0.55 * Math.exp(-k / 12), f1 = 1 + rand() * 4, p1 = rand() * TAU, f2 = 3 + rand() * 6, p2 = rand() * TAU;
    for (let i = 0; i < cols; i++) {
      const t = (i + 0.5) / cols;
      let v = base + a1 * (0.7 * Math.sin(TAU * f1 * t + p1) + 0.3 * Math.sin(TAU * f2 * t + p2)) + (rand() - 0.5) * 0.18;
      if (k === 0) v = -0.95 + 0.55 * speech(t) + (rand() - 0.5) * 0.1;
      row.push(cmap(cm, (clamp(v, -1, 1) + 1) / 2));
    }
    cellRow(parts, b.x, b.y + b.h - (k + 1) * ch, cw, ch, row);
  }
  return parts;
}

function spectroContent(b: Box, rand: Rand, kind: string, cm: string[]): Part[] {
  if (kind === 'mfcc') return mfccContent(b, rand, cm);
  const parts: Part[] = [{ kind: 'rect', ...b, r: 0, fill: cmap(cm, 0.04), stroke: 'none' }];
  const mel = kind === 'mel';
  const warp = (f: number) => (mel ? Math.log(1 + f * 9) / Math.log(10) : f); // asse delle frequenze
  const voices: Voice[] = [];
  const bursts: { t0: number; t1: number; lo: number; a: number }[] = []; // fricative / attacchi
  if (kind === 'speech' || kind === 'mel') {
    let t = 0.03 + rand() * 0.03;
    while (t < 0.9) {
      const d = 0.14 + rand() * 0.12;
      const t0 = t, t1 = Math.min(0.97, t + d);
      const base = 0.04 + rand() * 0.016, ph = rand() * TAU, slope = (rand() - 0.5) * 0.4;
      const F1 = 0.08 + rand() * 0.08, F2 = 0.22 + rand() * 0.16, F2b = 0.22 + rand() * 0.16, F3 = 0.45 + rand() * 0.1;
      voices.push({
        t0, t1, harmonics: 26, width: 0.85,
        f0: (tt) => base * (1 + 0.16 * Math.sin(Math.PI * ((tt - t0) / d) + ph) * 0.6 + slope * ((tt - t0) / d - 0.5)),
        amp: (tt, f) => {
          const u = (tt - t0) / d;
          const F2t = F2 + (F2b - F2) * u;
          const env = Math.sin(Math.PI * clamp(u, 0, 1)) ** 0.35;
          return env * (0.08 + 0.92 * Math.max(gauss(f, F1, 0.05), 0.85 * gauss(f, F2t, 0.06), 0.55 * gauss(f, F3, 0.06))) * Math.exp(-1.1 * f);
        },
      });
      t = t1 + 0.02 + rand() * 0.04;
      if (rand() < 0.55 && t < 0.88) {
        const fd = 0.05 + rand() * 0.05;
        bursts.push({ t0: t, t1: t + fd, lo: 0.4 + rand() * 0.2, a: 0.22 + rand() * 0.12 });
        t += fd + 0.015;
      }
    }
  } else if (kind === 'music') {
    let t = 0.02;
    while (t < 0.92) {
      const d = 0.16 + rand() * 0.14;
      const t0 = t, f0 = 0.05 + rand() * 0.07;
      voices.push({ t0, t1: Math.min(0.99, t0 + d), harmonics: 10, width: 1.1, f0: () => f0, amp: (tt, f) => Math.exp((-1.6 * (tt - t0)) / d) * Math.exp(-2.2 * f) * 1.15 });
      bursts.push({ t0, t1: t0 + 0.012, lo: 0, a: 0.5 });
      t += d + 0.01;
    }
  } else if (kind === 'chirp') {
    voices.push({ t0: 0.04, t1: 0.96, harmonics: 3, width: 1.4, f0: (tt) => 0.06 + 0.26 * ((tt - 0.04) / 0.92) ** 1.6, amp: (_tt, f) => 1.1 * Math.exp(-1.1 * f) });
  }
  // fondo: energia diffusa a celle (rumore, formanti sfumate, fricative)
  const cell = Math.max(2.6, Math.sqrt((b.w * b.h) / 1000));
  const cols = Math.max(8, Math.round(b.w / cell)), rows = Math.max(6, Math.round(b.h / cell));
  const cw = b.w / cols, ch = b.h / rows;
  const inv = (fd: number) => (mel ? (10 ** fd - 1) / 9 : fd); // da asse a frequenza
  const field = (t: number, fd: number) => {
    const f = inv(fd);
    if (kind === 'cwt') {
      const band = t < 0.62 ? 0.62 * gauss(fd, 0.28, 0.06) * Math.min(1, (0.62 - t) * 12) : 0;
      const trans = 0.85 * gauss(t, 0.76, 0.008 + 0.07 * (1 - fd) ** 2) * (0.45 + 0.55 * fd);
      const fc = 0.18 + 0.62 * clamp((t - 0.08) / 0.84, 0, 1) ** 2;
      const chirp = t > 0.08 && t < 0.92 ? 0.75 * gauss(fd, fc, 0.035 + 0.05 * fd) : 0;
      return 0.07 + 0.05 * rand() + Math.max(band, trans, chirp);
    }
    if (kind === 'noise') return 0.15 + 0.55 * rand() * rand();
    let v = 0.06 + 0.05 * rand() * (1 - 0.5 * f);
    for (const vc of voices) if (t > vc.t0 && t < vc.t1) v += 0.42 * vc.amp(t, f) * (0.6 + 0.4 * rand());
    for (const bu of bursts) if (t > bu.t0 && t < bu.t1 && f > bu.lo) v += bu.a * (0.2 + 0.8 * rand() * rand()) * Math.min(1, (f - bu.lo) * 3) * Math.sin((Math.PI * (t - bu.t0)) / (bu.t1 - bu.t0)) ** 0.5;
    return v;
  };
  const coi = (fd: number) => 0.3 * (1 - fd) ** 1.7; // cono d'influenza dello scalogramma
  for (let j = 0; j < rows; j++) {
    const row: (string | null)[] = [];
    for (let i = 0; i < cols; i++) {
      const t = (i + 0.5) / cols, fd = 1 - (j + 0.5) / rows;
      let v = field(t, fd);
      if (kind === 'cwt' && (t < coi(fd) || t > 1 - coi(fd))) v *= 0.55;
      row.push(v < 0.07 ? null : cmap(cm, v));
    }
    cellRow(parts, b.x, b.y + j * ch, cw, ch, row);
  }
  // righe armoniche come tratti continui, colorate secondo l'energia
  const Yf = (f: number) => b.y + b.h * (1 - warp(f));
  const Xt = (t: number) => b.x + b.w * t;
  const baseW = clamp(b.h / 70, 0.7, 1.6);
  const strokes: { pts: P2[]; a: number; w: number }[] = [];
  for (const vc of voices) {
    const pieces = Math.max(4, Math.round(((vc.t1 - vc.t0) * b.w) / 6));
    for (let k = 1; k <= vc.harmonics; k++) {
      // i tratti consecutivi con lo stesso livello di colore diventano una sola polilinea
      let cur: { pts: P2[]; a: number; w: number; q: number } | null = null;
      for (let p = 0; p < pieces; p++) {
        const ta = vc.t0 + ((vc.t1 - vc.t0) * p) / pieces, tb = vc.t0 + ((vc.t1 - vc.t0) * (p + 1)) / pieces, tm = (ta + tb) / 2;
        const fm = k * vc.f0(tm);
        const a = fm > 0.98 ? 0 : Math.min(1, vc.amp(tm, fm));
        const q = Math.round(a * LEVELS);
        if (a < 0.05) {
          cur = null;
          continue;
        }
        const pts: P2[] = [tm, tb].map((tt): P2 => [Xt(tt), Yf(k * vc.f0(tt))]);
        if (cur && cur.q === q) cur.pts.push(...pts);
        else {
          cur = { pts: [[Xt(ta), Yf(k * vc.f0(ta))], ...pts], a, w: baseW * vc.width * (k === 1 ? 1.25 : 1), q };
          strokes.push(cur);
        }
      }
    }
  }
  // alone morbido sotto le righe, poi la riga brillante
  for (const s of strokes) parts.push(line(poly(s.pts, false), cmap(cm, 0.1 + 0.3 * s.a), s.w * 2.8));
  for (const s of strokes) parts.push(line(poly(s.pts, false), cmap(cm, 0.22 + 0.76 * s.a ** 1.15), s.w));
  if (kind === 'cwt') {
    const L: P2[] = [], R: P2[] = [];
    for (let i = 0; i <= 30; i++) {
      const fd = i / 30;
      L.push([Xt(coi(fd)), Yf(fd)]);
      R.push([Xt(1 - coi(fd)), Yf(fd)]);
    }
    parts.push(line([...dashes(L, 2.5, 2), ...dashes(R, 2.5, 2)], '#FFFFFF', 0.9));
  }
  return parts;
}

function spectrogramShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['speech', 'music', 'chirp', 'mel', 'cwt', 'mfcc', 'noise'] as const, 'speech');
  const cm = CMAPS[kindOf(n.spec, ['magma', 'viridis', 'inferno', 'gray', 'coolwarm'] as const, kind === 'mfcc' ? 'coolwarm' : 'magma')];
  return framed(n, (b, rand) => spectroContent(b, rand, kind, cm));
}

// ======================================================================
// Banco di filtri mel e finestre della STFT
// ======================================================================

function melbankShape(n: N): Part[] {
  const K = clamp(Math.round(n.count), 3, 40);
  const linear = has(n.spec, 'linear');
  const slaney = has(n.spec, 'slaney');
  const P = plotFrame(n, 0.9, { xName: '$f$' });
  const col = inkOf(n);
  const second = has(n.spec, 'mono') ? col : ALT;
  const Y = (v: number) => P.base - v * P.up;
  const melF = (m: number) => 700 * (10 ** (m / 2595) - 1);
  const mel = (f: number) => 2595 * Math.log10(1 + f / 700);
  const fmax = 8000;
  const edges = Array.from({ length: K + 2 }, (_, i) => (linear ? i / (K + 1) : melF((mel(fmax) * i) / (K + 1)) / fmax));
  const tri = (i: number) => {
    const hgt = slaney ? Math.min(1, (2 * (edges[2] - edges[0])) / (edges[i + 2] - edges[i]) / 2) : 0.92;
    return [[P.X(edges[i]), P.base], [P.X(edges[i + 1]), Y(hgt)], [P.X(edges[i + 2]), P.base]] as P2[];
  };
  const parts = P.parts;
  for (let i = 0; i < K; i++) parts.push(area(poly(tri(i)), tint(i % 2 ? second : col, 0.86)));
  for (let i = 0; i < K; i++) parts.push(line(poly(tri(i), false), i % 2 ? second : col, Math.max(0.7, n.strokeWidth * 0.85)));
  return parts;
}

function stftShape(n: N): Part[] {
  const F = clamp(Math.round(n.count), 2, 14);
  const P = plotFrame(n, 0.94, { vAxis: 'none', xName: '$t$' });
  const col = inkOf(n);
  const parts = P.parts;
  const top = P.y0 + 1;
  const H = P.base - top;
  // F finestre di Hann con sovrapposizione del 50%: larghezza 2 / (F + 1)
  const wlen = 2 / (F + 1);
  const win = kindOf(n.spec, ['hann', 'hamming', 'rect'] as const, 'hann');
  const wf = (s: number) => (win === 'rect' ? 0.8 : win === 'hamming' ? 0.54 - 0.46 * Math.cos(TAU * s) : 0.5 * (1 - Math.cos(TAU * s)));
  const hann = (k: number): P2[] => {
    const pts = Array.from({ length: 41 }, (_, i): P2 => [P.X((k * wlen) / 2 + (i / 40) * wlen), P.base - H * 0.96 * wf(i / 40)]);
    // finestre che non arrivano a zero: lati verticali fino all'asse
    return win === 'hann' ? pts : [[pts[0][0], P.base], ...pts, [pts[40][0], P.base]];
  };
  for (let k = 0; k < F; k++) parts.push(area(poly(hann(k)), tint(k % 2 ? ALT : col, 0.84)));
  // segnale: ampiezza contenuta sotto le finestre
  const rand = rng(17);
  let prev = 0;
  const mid = P.base - H * 0.42;
  const sig = Array.from({ length: 241 }, (_, i): P2 => {
    const u = i / 240;
    prev = 0.6 * prev + 0.4 * (rand() - 0.5);
    const env = 0.5 + 0.35 * Math.sin(TAU * 1.3 * u + 1) ** 2;
    return [P.X(u), mid - H * 0.3 * env * (0.75 * Math.sin(TAU * 11 * u) + 0.25 * Math.sin(TAU * 27 * u + 1) + prev * 0.8)];
  });
  parts.push(line(poly(sig, false), '#3A3F47', Math.max(0.6, n.strokeWidth * 0.6)));
  for (let k = 0; k < F; k++) parts.push(line(poly(hann(k), false), k % 2 ? ALT : col, Math.max(0.8, n.strokeWidth)));
  return parts;
}

// ======================================================================
// Risposta in frequenza dei filtri
// ======================================================================

const RESPONSES = ['lowpass', 'highpass', 'bandpass', 'bandstop', 'notch', 'allpass'] as const;

function responseShape(n: N): Part[] {
  const kind = kindOf(n.spec, RESPONSES, 'lowpass');
  const ideal = has(n.spec, 'ideal');
  const ripple = has(n.spec, 'ripple');
  const ord = clamp(Math.round(n.count), 1, 12);
  const named = has(n.spec, 'labels');
  const P = plotFrame(n, named ? 0.76 : 0.9, { xName: '$\\omega$' });
  const col = inkOf(n);
  const sw = traceW(n);
  const Y = (v: number) => P.base - v * P.up * 0.94;
  const parts = P.parts;
  const uc = 0.4, u0 = 0.5, B = 0.24;
  const cheb = (x: number) => (Math.abs(x) <= 1 ? Math.cos(ord * Math.acos(x)) : Math.cosh(ord * Math.acosh(Math.abs(x))));
  const lpMag = (x: number) => (ideal ? (x <= 1 ? 1 : 0) : ripple ? 1 / Math.sqrt(1 + 0.3 * cheb(x) ** 2) : 1 / Math.sqrt(1 + x ** (2 * ord)));
  const f = (u: number): number => {
    switch (kind) {
      case 'highpass': return lpMag(uc / Math.max(u, 1e-4));
      case 'bandpass': return lpMag(Math.abs(u - u0) / (B / 2));
      case 'bandstop': return ideal ? (Math.abs(u - u0) < B / 2 ? 0 : 1) : 1 - lpMag(Math.abs(u - u0) / (B / 2)) * 0.98;
      case 'notch': return ideal ? (Math.abs(u - u0) < 0.015 ? 0 : 1) : Math.abs(u - u0) / Math.sqrt((u - u0) ** 2 + 0.03 ** 2);
      case 'allpass': return 0.8;
      default: return lpMag(u / uc);
    }
  };
  const N = 300;
  const raw = Array.from({ length: N + 1 }, (_, i): P2 => [P.X(i / N), Y(f(i / N))]);
  const pts: P2[] = [];
  for (const p of raw) {
    // filtro ideale: bordi verticali netti
    const last = pts[pts.length - 1];
    if (ideal && last && Math.abs(p[1] - last[1]) > 2) pts.push([p[0], last[1]]);
    pts.push(p);
  }
  parts.push(area(poly([[P.X(0), P.base], ...pts, [P.X(1), P.base]]), tint(col, 0.84)));
  // frequenze di taglio
  const cuts = kind === 'lowpass' || kind === 'highpass' ? [uc] : kind === 'notch' ? [u0] : kind === 'allpass' ? [] : [u0 - B / 2, u0 + B / 2];
  const guides: Cmd[] = [];
  for (const u of cuts) guides.push(...dashes([[P.X(u), P.base], [P.X(u), Y(1.06)]], 2.2, 1.8));
  if (cuts.length) parts.push(line(guides, '#C0392B', 0.8));
  parts.push(line(poly(pts, false), col, sw));
  for (const u of cuts) parts.push(head([P.X(u), P.base - 0.5], 0, 1, P.hs, '#C0392B'));
  if (P.ls) {
    // nomi delle frequenze di taglio sotto l'asse
    const names = cuts.length === 2 ? ['$\\omega_1$', '$\\omega_2$'] : [kind === 'notch' ? '$\\omega_0$' : '$\\omega_c$'];
    cuts.forEach((u, i) => parts.push(text(P.X(u), P.base + P.ls * 0.95, names[i], P.ls * 0.95, 'middle', '#9B2C2C')));
  }
  return parts;
}

// ======================================================================
// Piano z, costellazioni, diagramma a occhio
// ======================================================================

/** Assi incrociati con frecce e, se richiesto (`labels`), i nomi in fondo alle frecce. */
function crossAxes(n: N, cx: number, cy: number, R: number, hs: number, names: [string, string]): Part[] {
  const parts = [...arrow([cx - R, cy], [cx + R, cy], AXIS, 0.8, hs), ...arrow([cx, cy + R], [cx, cy - R], AXIS, 0.8, hs)];
  if (has(n.spec, 'labels')) {
    const ls = clamp(Math.min(n.w, n.h) * 0.12, 7.5, 10);
    parts.push(text(cx + R, cy + ls * 0.95, names[0], ls, 'end'), text(cx + hs + 1, cy - R + ls * 0.45, names[1], ls, 'start'));
  }
  return parts;
}

function polezeroShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['iir', 'butter', 'notch', 'fir', 'unstable', 'resonator'] as const, 'iir');
  const ord = clamp(Math.round(n.count), 1, 8);
  const { x, y, w, h } = n;
  const cx = x + w / 2, cy = y + h / 2, m = Math.min(w, h);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, m / 2), fill: n.fill });
  const R = m * (has(n.spec, 'labels') ? 0.3 : 0.33);
  const hs = clamp(m * 0.05, 2.8, 4.5);
  parts.push(...crossAxes(n, cx, cy, m * 0.47, hs, ['$\\mathrm{Re}$', '$\\mathrm{Im}$']));
  parts.push(line(poly(circlePts(cx, cy, R), false), '#6B7280', 0.9));
  const col = inkOf(n);
  const poles: P2[] = [], zeros: P2[] = [];
  const pol = (r: number, a: number, list: P2[], conj = true) => {
    list.push([r * Math.cos(a), r * Math.sin(a)]);
    if (conj && Math.abs(Math.sin(a)) > 1e-3) list.push([r * Math.cos(a), -r * Math.sin(a)]);
  };
  switch (kind) {
    case 'butter':
      for (let k = 0; k < ord; k++) pol(0.55 + 0.1 * Math.cos((Math.PI * (k + 0.5)) / ord), (0.95 * (k + 0.5)) / ord, poles);
      for (let k = 0; k < Math.min(3, 2 * ord); k++) zeros.push([-1, 0]);
      break;
    case 'notch':
      for (let k = 0; k < ord; k++) {
        const a = (Math.PI * (k + 1)) / (ord + 1.5);
        pol(1, a, zeros);
        pol(0.86, a, poles);
      }
      break;
    case 'fir':
      for (let k = 0; k < ord; k++) pol(k % 2 ? 1 : 0.62 + 0.12 * k, (Math.PI * (k + 0.7)) / (ord + 0.6), zeros);
      poles.push([0, 0]);
      break;
    case 'unstable':
      pol(1.18, 0.7, poles);
      for (let k = 1; k < ord; k++) pol(0.6, 0.7 + k * 0.7, poles);
      pol(1, 2.2, zeros);
      break;
    case 'resonator':
      for (let k = 0; k < ord; k++) pol(0.93, 0.5 + (k * 1.9) / ord, poles);
      zeros.push([1, 0], [-1, 0]);
      break;
    default:
      for (let k = 0; k < ord; k++) {
        pol(0.74 - 0.08 * k, 0.5 + k * 0.6, poles);
        pol(1, 1.75 + k * 0.75, zeros);
      }
  }
  const zr = clamp(m * 0.045, 2, 4);
  const seen = new Map<string, number>();
  for (const [u, v] of zeros) {
    const key = `${u.toFixed(2)},${v.toFixed(2)}`;
    const k = seen.get(key) ?? 0;
    seen.set(key, k + 1);
    parts.push(disc(cx + u * R, cy - v * R, zr + k * 2, k ? 'none' : '#FFFFFF', col, Math.max(1, n.strokeWidth)));
  }
  const ps = zr * 0.95;
  const xs: Cmd[] = [];
  for (const [u, v] of poles) {
    const px = cx + u * R, py = cy - v * R;
    xs.push(...seg([px - ps, py - ps], [px + ps, py + ps]), ...seg([px - ps, py + ps], [px + ps, py - ps]));
  }
  parts.push(line(xs, col, Math.max(1.2, n.strokeWidth * 1.2)));
  return parts;
}

function constellationShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['qam16', 'qam64', 'qpsk', 'psk8', 'bpsk', 'qam4'] as const, 'qam16');
  const noisy = has(n.spec, 'noisy');
  const grid = has(n.spec, 'grid');
  const { x, y, w, h } = n;
  const cx = x + w / 2, cy = y + h / 2, m = Math.min(w, h);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, m / 2), fill: n.fill });
  const hs = clamp(m * 0.05, 2.8, 4.5);
  parts.push(...crossAxes(n, cx, cy, m * 0.47, hs, ['$I$', '$Q$']));
  const col = inkOf(n);
  const S = m * 0.37;
  const pts: P2[] = [];
  let step = 0;
  const square = (L: number) => {
    step = (2 * S) / L;
    for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) pts.push([-S + step * (i + 0.5), -S + step * (j + 0.5)]);
  };
  switch (kind) {
    case 'qam64': square(8); break;
    case 'qpsk':
    case 'qam4': square(2); break;
    case 'psk8':
      parts.push(line(dashes(circlePts(cx, cy, S * 0.88), 2.2, 2), GUIDE, 0.8));
      for (let k = 0; k < 8; k++) pts.push([S * 0.88 * Math.cos((TAU * k) / 8 + Math.PI / 8), S * 0.88 * Math.sin((TAU * k) / 8 + Math.PI / 8)]);
      break;
    case 'bpsk': pts.push([-S * 0.7, 0], [S * 0.7, 0]); break;
    default: square(4);
  }
  if (grid && step) {
    const L = Math.round((2 * S) / step);
    const g: Cmd[] = [];
    for (let i = 1; i < L; i++) {
      if (2 * i === L) continue;
      const o = -S + step * i;
      g.push(...dashes([[cx + o, cy - S], [cx + o, cy + S]], 2, 2), ...dashes([[cx - S, cy + o], [cx + S, cy + o]], 2, 2));
    }
    parts.push(line(g, GUIDE, 0.7));
  }
  const r = clamp(m * (kind === 'qam64' ? 0.022 : 0.04), 1.2, 3.4);
  const rand = rng(71 + pts.length);
  const g = () => (rand() + rand() + rand() - 1.5) * 0.9;
  for (const [u, v] of pts) {
    if (noisy) {
      const sd = (step || S * 0.5) * (pts.length > 16 ? 0.12 : 0.17);
      const k = pts.length > 16 ? 6 : 14;
      for (let i = 0; i < k; i++) parts.push(disc(cx + u + g() * sd, cy - v + g() * sd, Math.max(0.75, r * 0.4), tint(col, 0.2)));
      parts.push(disc(cx + u, cy - v, Math.max(1, r * 0.5), '#C0392B'));
    } else parts.push(disc(cx + u, cy - v, r, col));
  }
  return parts;
}

function eyeShape(n: N): Part[] {
  const scope = has(n.spec, 'scope');
  const noisy = has(n.spec, 'noisy');
  const { x, y, w, h } = n;
  const parts: Part[] = [];
  const bg = scope ? '#0E1A14' : n.fill;
  if (bg !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill: bg, stroke: scope ? '#3A4A40' : '#C9CED6', sw: 1 });
  const pad = Math.min(w, h) * 0.08;
  const X = (t: number) => x + pad + ((t + 1) / 2) * (w - 2 * pad);
  const cy = y + h / 2, A = (h / 2 - pad) * 0.78;
  // reticolo: istante di campionamento e soglia
  const gcol = scope ? '#2C4436' : GUIDE;
  parts.push(line([...dashes([[X(0), y + pad * 0.5], [X(0), y + h - pad * 0.5]], 2, 2), ...dashes([[x + pad * 0.5, cy], [x + w - pad * 0.5, cy]], 2, 2)], gcol, 0.7));
  const beta = 0.5;
  const rc = (t: number) => {
    const d = 1 - (2 * beta * t) ** 2;
    if (Math.abs(d) < 1e-4) return (Math.PI / 4) * sinc(Math.PI / (2 * beta));
    return (sinc(Math.PI * t) * Math.cos(Math.PI * beta * t)) / d;
  };
  const K = 30;
  const rand = rng(59);
  const cmds: Cmd[] = [];
  for (let k = 0; k < K; k++) {
    const bits = Array.from({ length: 9 }, () => (rand() < 0.5 ? -1 : 1));
    const jitter = noisy ? 0.06 : 0.015;
    const off = (rand() - 0.5) * jitter;
    for (let i = 0; i <= 60; i++) {
      const t = -1 + i / 30;
      let s = 0;
      for (let j = -4; j <= 4; j++) s += bits[j + 4] * rc(t - j + off);
      if (noisy) s += (rand() - 0.5) * 0.12;
      cmds.push([i ? 'L' : 'M', X(t), cy - A * s]);
    }
  }
  parts.push(line(cmds, scope ? '#5CF29B' : inkOf(n), Math.max(0.5, n.strokeWidth * 0.55)));
  return parts;
}

// ======================================================================
// Biosegnali: EEG multicanale e montaggio 10-20
// ======================================================================

function eegShape(n: N): Part[] {
  const C = clamp(Math.round(n.count), 1, 32);
  const spikes = has(n.spec, 'spikes');
  const erp = has(n.spec, 'erp') || has(n.spec, 'marker');
  const emg = has(n.spec, 'emg');
  const { x, y, w, h } = n;
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill: n.fill });
  const pad = n.fill !== 'none' ? clamp(Math.min(w, h) * 0.06, 3, 6) : 1;
  const dh = (h - 2 * pad) / C;
  // nomi dei canali (sistema 10-20) a sinistra delle tracce, se c'è spazio
  const ns = has(n.spec, 'names') && dh >= 7 ? clamp(dh * 0.6, 5.5, 10) : 0;
  const names = ns ? channelNames(C) : [];
  const x0 = x + pad + (ns ? textW('Fp1', ns) + 4 : 5), x1 = x + w - pad;
  const col = inkOf(n);
  const Np = clamp(Math.round((x1 - x0) * 1.3), 80, 500);
  const ticks: Cmd[] = [];
  const traces: Cmd[] = [];
  const tm = 0.32;
  for (let ch = 0; ch < C; ch++) {
    const base = y + pad + dh * (ch + 0.5);
    if (ns) parts.push(text(x + pad, base, names[ch], ns, 'start'));
    else ticks.push(...seg([x + pad, base], [x + pad + 3, base]));
    const r = rng(211 + ch * 17);
    const comp = [[2, 0.5], [6, 0.45], [12, 0.6], [23, 0.25], [37, 0.15]].map(([f, a]) => [f * (0.85 + 0.3 * r()), a * (0.5 + r()), r() * TAU]);
    const vals: number[] = [];
    let prev = 0;
    for (let i = 0; i <= Np; i++) {
      const u = i / Np;
      prev = 0.6 * prev + 0.4 * (r() - 0.5);
      let v = comp.reduce((s, [f, a, ph]) => s + a * Math.sin(TAU * f * u + ph), 0) + prev * 0.9;
      if (emg) v = v * 0.3 + (r() - 0.5) * 2.4 * (gauss(u, 0.3, 0.07) + gauss(u, 0.72, 0.09) + 0.08);
      if (spikes && ch % 3 !== 2) v += (2.6 - 0.25 * (ch % 4)) * (gauss(u, 0.58, 0.006) - 0.45 * gauss(u, 0.6, 0.018));
      if (erp) v += 1.6 * (gauss(u, tm + 0.1, 0.025) - 0.9 * gauss(u, tm + 0.2, 0.04)) * (ch % 2 ? 0.6 : 1);
      vals.push(v);
    }
    const peak = Math.max(...vals.map(Math.abs)) || 1;
    const A = (dh * 0.46) / peak;
    vals.forEach((v, i) => traces.push([i ? 'L' : 'M', x0 + ((x1 - x0) * i) / Np, base - v * A]));
  }
  if (ticks.length) parts.push(line(ticks, AXIS, 0.7));
  if (erp) parts.push(line(dashes([[x0 + (x1 - x0) * tm, y + pad], [x0 + (x1 - x0) * tm, y + h - pad]], 2.2, 1.8), '#C0392B', 0.9));
  parts.push(line(traces, col, Math.max(0.5, n.strokeWidth * 0.6)));
  return parts;
}

const ELECTRODES: [string, number, number][] = [
  ['Fp1', -0.25, -0.77], ['Fp2', 0.25, -0.77], ['F7', -0.63, -0.47], ['F3', -0.32, -0.41], ['Fz', 0, -0.4], ['F4', 0.32, -0.41], ['F8', 0.63, -0.47],
  ['T3', -0.79, 0], ['C3', -0.4, 0], ['Cz', 0, 0], ['C4', 0.4, 0], ['T4', 0.79, 0],
  ['T5', -0.63, 0.47], ['P3', -0.32, 0.41], ['Pz', 0, 0.4], ['P4', 0.32, 0.41], ['T6', 0.63, 0.47], ['O1', -0.25, 0.77], ['O2', 0.25, 0.77],
];

const EEG_SETS: Record<number, string[]> = {
  1: ['Cz'], 2: ['C3', 'C4'], 3: ['C3', 'Cz', 'C4'], 4: ['Fz', 'C3', 'C4', 'Pz'], 5: ['Fz', 'C3', 'Cz', 'C4', 'Pz'],
  6: ['Fz', 'C3', 'Cz', 'C4', 'Pz', 'Oz'], 7: ['F3', 'F4', 'C3', 'Cz', 'C4', 'P3', 'P4'], 8: ['F3', 'Fz', 'F4', 'C3', 'C4', 'P3', 'Pz', 'P4'],
};
/** Nomi dei canali: piccoli montaggi tipici, altrimenti il 10-20 completo e qualche canale extra. */
const channelNames = (C: number) => EEG_SETS[C] ?? [...ELECTRODES.map((e) => e[0]), 'Oz', 'FCz', 'CPz', 'A1', 'A2'].slice(0, C);

function headShape(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const cx = x + w / 2, R = Math.min(w * 0.43, h * 0.43), cy = y + h - R - h * 0.03;
  const col = inkOf(n);
  const sw = n.strokeWidth;
  const motor = has(n.spec, 'motor');
  const parts: Part[] = [
    { kind: 'ellipse', cx: cx - R * 1.02, cy, rx: R * 0.09, ry: R * 0.2, fill },
    { kind: 'ellipse', cx: cx + R * 1.02, cy, rx: R * 0.09, ry: R * 0.2, fill },
    { kind: 'path', fill, cmds: poly([[cx - R * 0.14, cy - R * 0.97], [cx, cy - R * 1.16], [cx + R * 0.14, cy - R * 0.97]]) },
    { kind: 'ellipse', cx, cy, rx: R, ry: R, fill },
  ];
  const g = shade(col, 0.55);
  parts.push(line([...poly(circlePts(cx, cy, R * 0.8), false), ...seg([cx, cy - R], [cx, cy + R]), ...seg([cx - R, cy], [cx + R, cy])], g, 0.5));
  // con i nomi gli elettrodi si allargano per contenere il testo (solo se resta leggibile)
  const named = has(n.spec, 'names') && R * 0.12 * 0.78 >= 5;
  const er = named ? R * 0.12 : clamp(R * 0.085, 1.6, 5);
  for (const [name, u, v] of ELECTRODES) {
    const hot = motor && (name === 'C3' || name === 'Cz' || name === 'C4');
    parts.push(disc(cx + u * R, cy + v * R, er, hot ? '#E5484D' : '#FFFFFF', hot ? '#9B2C2C' : col, Math.max(0.7, sw * 0.7)));
    if (named) parts.push(text(cx + u * R, cy + v * R, name, er * 0.78, 'middle', hot ? '#FFFFFF' : '#3A3F47'));
  }
  return parts;
}

// ======================================================================
// Simboli dei diagrammi a blocchi
// ======================================================================

function junctionShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['sum', 'mult', 'sigma', 'quad', 'osc', 'minus'] as const, 'sum');
  const { x, y, w, h, fill } = n;
  const cx = x + w / 2, cy = y + h / 2, m = Math.min(w, h) / 2;
  const col = inkOf(n);
  const sw = Math.max(1, n.strokeWidth * 1.05);
  const parts: Part[] = [{ kind: 'ellipse', cx, cy, rx: w / 2, ry: h / 2, fill }];
  const g = m * 0.5;
  switch (kind) {
    case 'mult': {
      const d = m * 0.36;
      parts.push(line([...seg([cx - d, cy - d], [cx + d, cy + d]), ...seg([cx - d, cy + d], [cx + d, cy - d])], col, sw));
      break;
    }
    case 'quad': {
      const d = (w / 2) * Math.SQRT1_2, e = (h / 2) * Math.SQRT1_2;
      parts.push(line([...seg([cx - d, cy - e], [cx + d, cy + e]), ...seg([cx - d, cy + e], [cx + d, cy - e])], n.stroke === 'none' ? col : n.stroke, n.strokeWidth));
      break;
    }
    case 'sigma':
      parts.push(line(poly([[cx + m * 0.34, cy - m * 0.38], [cx + m * 0.34, cy - m * 0.48], [cx - m * 0.36, cy - m * 0.48], [cx + m * 0.06, cy], [cx - m * 0.36, cy + m * 0.48], [cx + m * 0.34, cy + m * 0.48], [cx + m * 0.34, cy + m * 0.38]], false), col, sw));
      break;
    case 'osc': {
      const pts = Array.from({ length: 33 }, (_, i): P2 => [cx - m * 0.56 + (m * 1.12 * i) / 32, cy - m * 0.3 * Math.sin((TAU * i) / 32)]);
      parts.push(line(poly(pts, false), col, sw));
      break;
    }
    case 'minus':
      parts.push(line(seg([cx - g, cy], [cx + g, cy]), col, sw));
      break;
    default:
      parts.push(line([...seg([cx - g, cy], [cx + g, cy]), ...seg([cx, cy - g], [cx, cy + g])], col, sw));
  }
  return parts;
}

/** Piccolo grafico (assi + curva) nel riquadro g: risposta di un filtro, spettro, finestra. */
function glyph(kind: string, g: Box, col: string, sw: number): Part[] {
  const X = (u: number) => g.x + u * g.w;
  const Y = (v: number) => g.y + g.h - v * g.h;
  const parts: Part[] = [line([['M', g.x, g.y], ['L', g.x, g.y + g.h], ['L', g.x + g.w, g.y + g.h]], AXIS, 0.7)];
  const curve = (f: (u: number) => number) => parts.push(line(poly(Array.from({ length: 41 }, (_, i): P2 => [X(0.04 + (0.92 * i) / 40), Y(0.86 * f(i / 40))]), false), col, sw));
  const lp = (t: number) => 1 / Math.sqrt(1 + t ** 8);
  switch (kind) {
    case 'hp': curve((u) => lp(0.45 / Math.max(u, 1e-3))); break;
    case 'bp': curve((u) => lp(Math.abs(u - 0.5) / 0.17)); break;
    case 'bs': curve((u) => 1 - 0.97 * lp(Math.abs(u - 0.5) / 0.15)); break;
    case 'notch': curve((u) => Math.abs(u - 0.5) / Math.sqrt((u - 0.5) ** 2 + 0.04 ** 2)); break;
    case 'win': curve((u) => 0.5 * (1 - Math.cos(TAU * u))); break;
    case 'fft': {
      const hs = [0.25, 0.9, 0.45, 0.3, 0.65, 0.2, 0.12];
      const bw = (g.w * 0.92) / hs.length;
      hs.forEach((v, i) => parts.push({ kind: 'rect', x: g.x + g.w * 0.06 + i * bw + bw * 0.18, y: Y(v * 0.9), w: bw * 0.64, h: v * 0.9 * g.h, r: 0, fill: tint(col, 0.5), stroke: col, sw: 0.6, solid: true }));
      break;
    }
    default: curve((u) => lp(u / 0.45));
  }
  return parts;
}

function filterLayout(n: N): { g: Box | null; label: LabelLayout } {
  const { x, y, w, h } = n;
  const cx = x + w / 2, cy = y + h / 2;
  const glyphKind = kindOf(n.spec, ['lp', 'hp', 'bp', 'bs', 'notch', 'fft', 'win', 'adaptive', 'none'] as const, 'lp');
  if (glyphKind === 'adaptive' || glyphKind === 'none') return { g: null, label: { x: cx, y: cy, anchor: 'middle' } };
  const hasText = !!(n.label || n.sublabel) && n.labelPos === 'center';
  if (!hasText) {
    const gw = Math.min(w * 0.6, h * 1.1), gh = Math.min(h * 0.56, gw * 0.75);
    return { g: { x: cx - gw / 2, y: cy - gh / 2, w: gw, h: gh }, label: { x: cx, y: cy, anchor: 'middle' } };
  }
  if (w >= 1.9 * h) {
    const gh = h * 0.46, gw = Math.min(gh * 1.4, w * 0.32), m = h * 0.2;
    const g = { x: x + w - m - gw, y: cy - gh / 2, w: gw, h: gh };
    return { g, label: { x: x + (w - gw - m) / 2 + m * 0.2, y: cy, anchor: 'middle' } };
  }
  const gh = clamp(h * 0.26, 7, 18), gw = Math.min(w * 0.46, gh * 2);
  const g = { x: cx - gw / 2, y: y + h - gh - h * 0.13, w: gw, h: gh };
  return { g, label: { x: cx, y: y + (h - gh - h * 0.13) / 2 + 1, anchor: 'middle' } };
}

function filterShape(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill }];
  const col = inkOf(n);
  if (has(n.spec, 'adaptive')) {
    // simbolo del filtro adattivo: freccia obliqua che attraversa il blocco
    const a: P2 = [x + w * 0.16, y + h + Math.min(7, h * 0.18)];
    const b: P2 = [x + w * 0.84, y - Math.min(7, h * 0.18)];
    parts.push(...arrow(a, b, col, Math.max(1, n.strokeWidth), 6));
    return parts;
  }
  const { g } = filterLayout(n);
  const kind = kindOf(n.spec, ['lp', 'hp', 'bp', 'bs', 'notch', 'fft', 'win'] as const, 'lp');
  if (g) parts.push(...glyph(kind, g, col, Math.max(0.9, n.strokeWidth)));
  return parts;
}

const OPS = ['int', 'quant', 'hold', 'abs', 'square', 'log', 'sat', 'sign', 'relu', 'down', 'up', 'deriv'] as const;

function opLabel(n: N): LabelLayout {
  const kind = kindOf(n.spec, OPS, 'int');
  if (kind === 'down' || kind === 'up') return { x: n.x + n.w * 0.68, y: n.y + n.h / 2, anchor: 'middle' };
  return { x: n.x + n.w / 2, y: n.y + n.h / 2, anchor: 'middle' };
}

function opboxShape(n: N): Part[] {
  const kind = kindOf(n.spec, OPS, 'int');
  const { x, y, w, h, fill } = n;
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill }];
  const col = inkOf(n);
  const sw = Math.max(1, n.strokeWidth * 1.05);
  const s = Math.min(w, h) * 0.62;
  const cx = x + w / 2, cy = y + h / 2;
  const U = (u: number, v: number): P2 => [cx + u * s, cy - v * s];
  const axes = () => parts.push(line([...seg(U(-0.5, 0), U(0.5, 0)), ...seg(U(0, -0.5), U(0, 0.5))], AXIS, 0.7));
  const curve = (f: (t: number) => number, a = -0.46, b = 0.46) =>
    parts.push(line(poly(Array.from({ length: 41 }, (_, i): P2 => {
      const t = a + ((b - a) * i) / 40;
      return U(t, clamp(f(t), -0.48, 0.48));
    }), false), col, sw));
  switch (kind) {
    case 'int': {
      const k = s * 0.55;
      parts.push(line([['M', cx + k * 0.42, cy - k * 0.78], ['C', cx + k * 0.3, cy - k * 1.0, cx + k * 0.08, cy - k * 0.92, cx + k * 0.04, cy - k * 0.6], ['L', cx - k * 0.04, cy + k * 0.6], ['C', cx - k * 0.08, cy + k * 0.92, cx - k * 0.3, cy + k * 1.0, cx - k * 0.42, cy + k * 0.78]], col, sw * 1.15));
      break;
    }
    case 'deriv':
      parts.push(text(cx, cy, '$\\dfrac{d}{dt}$', clamp(Math.min(w, h) * 0.34, 9, 22), 'middle', col));
      break;
    case 'quant': {
      axes();
      const st: P2[] = [];
      const q = 0.18;
      for (let k = -2; k <= 2; k++) st.push(U((k - 0.5) * q, k * q), U((k + 0.5) * q, k * q));
      parts.push(line(poly([U(-0.46, -2 * q), ...st, U(0.46, 2 * q)], false), col, sw));
      break;
    }
    case 'hold': {
      parts.push(line(poly(Array.from({ length: 41 }, (_, i): P2 => U(-0.46 + (0.92 * i) / 40, 0.32 * Math.sin(TAU * (i / 40) * 0.9))), false), GUIDE, 0.8));
      const st: P2[] = [];
      for (let k = 0; k < 6; k++) {
        const v = 0.32 * Math.sin(TAU * (k / 6) * 0.9 + 0.3);
        st.push(U(-0.46 + (0.92 * k) / 6, v), U(-0.46 + (0.92 * (k + 1)) / 6, v));
      }
      parts.push(line(poly(st, false), col, sw));
      break;
    }
    case 'abs': axes(); curve((t) => Math.abs(t) * 0.9); break;
    case 'square': axes(); curve((t) => 2 * t * t - 0.05); break;
    case 'log': axes(); curve((t) => 0.16 * Math.log((t + 0.47) * 12), -0.45, 0.46); break;
    case 'sat': axes(); curve((t) => clamp(t * 1.6, -0.28, 0.28)); break;
    case 'sign': {
      axes();
      parts.push(line([...seg(U(-0.46, -0.28), U(0, -0.28)), ...seg(U(0, 0.28), U(0.46, 0.28))], col, sw));
      break;
    }
    case 'relu': axes(); curve((t) => Math.max(0, t) * 0.9); break;
    case 'down':
    case 'up': {
      const ax = x + w * 0.36, top = y + h * 0.2, bot = y + h * 0.8;
      parts.push(...(kind === 'down' ? arrow([ax, top], [ax, bot], col, sw, Math.max(5, h * 0.17)) : arrow([ax, bot], [ax, top], col, sw, Math.max(5, h * 0.17))));
      break;
    }
  }
  return parts;
}

function converterShape(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const dac = has(n.spec, 'dac');
  const col = inkOf(n);
  const sw = Math.max(1, n.strokeWidth);
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, w / 2, h / 2), fill }];
  parts.push(line(seg([x, y + h], [x + w, y]), n.stroke === 'none' ? col : n.stroke, n.strokeWidth));
  const wave = (cx: number, cy: number, s: number) =>
    line(poly(Array.from({ length: 25 }, (_, i): P2 => [cx - s / 2 + (s * i) / 24, cy - s * 0.22 * Math.sin((TAU * i) / 24)]), false), col, sw);
  const stairs = (cx: number, cy: number, s: number) => {
    const pts: P2[] = [];
    const k = 3;
    for (let i = 0; i < k; i++) pts.push([cx - s / 2 + (s * i) / k, cy + s * 0.3 - (s * 0.6 * i) / (k - 1)], [cx - s / 2 + (s * (i + 1)) / k, cy + s * 0.3 - (s * 0.6 * i) / (k - 1)]);
    return line(poly(pts, false), col, sw);
  };
  const s = Math.min(w, h) * 0.34;
  const a: P2 = [x + w * 0.3, y + h * 0.3], b: P2 = [x + w * 0.7, y + h * 0.7];
  if (has(n.spec, 'letters')) {
    // variante con le lettere A / D nei due triangoli
    const fs = clamp(Math.min(w, h) * 0.3, 8, 22);
    parts.push(text(a[0] - w * 0.04, a[1] - h * 0.02, dac ? 'D' : 'A', fs, 'middle', col), text(b[0] + w * 0.04, b[1] + h * 0.02, dac ? 'A' : 'D', fs, 'middle', col));
    return parts;
  }
  parts.push(dac ? stairs(a[0], a[1], s) : wave(a[0], a[1], s), dac ? wave(b[0], b[1], s) : stairs(b[0], b[1], s));
  return parts;
}

function switchShape(n: N): Part[] {
  const { x, y, w, h } = n;
  const col = inkOf(n, '#333333');
  const sw = Math.max(1, n.strokeWidth);
  const cy = y + h / 2;
  const hold = has(n.spec, 'hold');
  const closed = has(n.spec, 'closed');
  const aX = x + w * (hold ? 0.18 : 0.24), bX = x + w * (hold ? 0.56 : 0.76);
  const r = clamp(h * 0.06, 1.8, 3);
  const parts: Part[] = [line([...seg([x, cy], [aX - r, cy]), ...seg([bX + r, cy], [x + w, cy])], col, sw)];
  const L = bX - aX;
  const ang = closed ? 0.04 : 0.48;
  const tip: P2 = [aX + Math.cos(ang) * L * 0.98, cy - Math.sin(ang) * L * 0.98];
  parts.push(line(seg([aX, cy], tip), col, sw * 1.1));
  if (!closed) {
    // arco con freccia: il campionatore si chiude ogni T
    const R = L * 0.84;
    const e = -0.16;
    parts.push(line(arc(aX, cy, R, -ang - 0.12, e - 0.08), col, 0.9));
    parts.push(head([aX + R * Math.cos(e), cy + R * Math.sin(e)], -Math.sin(e), Math.cos(e), 4.2, col));
  }
  parts.push(disc(aX, cy, r, '#FFFFFF', col, sw), disc(bX, cy, r, '#FFFFFF', col, sw));
  if (hold) {
    // condensatore di tenuta verso massa
    const cX = x + w * 0.8, p1 = cy + h * 0.18, p2 = cy + h * 0.27, pw = w * 0.1, gY = y + h - 1;
    parts.push(
      disc(cX, cy, Math.max(1.4, r * 0.7), col),
      line([...seg([cX, cy], [cX, p1]), ...seg([cX - pw, p1], [cX + pw, p1]), ...seg([cX - pw, p2], [cX + pw, p2]), ...seg([cX, p2], [cX, gY - h * 0.08])], col, sw),
      line([...seg([cX - pw * 0.8, gY - h * 0.08], [cX + pw * 0.8, gY - h * 0.08]), ...seg([cX - pw * 0.5, gY - h * 0.04], [cX + pw * 0.5, gY - h * 0.04]), ...seg([cX - pw * 0.2, gY], [cX + pw * 0.2, gY])], col, sw * 0.9),
    );
  }
  return parts;
}

function transducerShape(n: N): Part[] {
  const kind = kindOf(n.spec, ['mic', 'speaker', 'antenna'] as const, 'mic');
  const { x, y, w, h, fill } = n;
  const col = inkOf(n);
  const sw = n.strokeWidth;
  const cx = x + w / 2, cy = y + h / 2;
  const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
  switch (kind) {
    case 'speaker': {
      const waves: Cmd[] = [];
      for (const r of [0.16, 0.28, 0.4]) waves.push(...arc(x + w * 0.56, cy, w * r, -0.7, 0.7));
      return [
        { kind: 'rect', x: x + w * 0.06, y: y + h * 0.33, w: w * 0.22, h: h * 0.34, r: 1, fill },
        { kind: 'path', fill, cmds: poly([P(0.28, 0.33), P(0.56, 0.08), P(0.56, 0.92), P(0.28, 0.67)]) },
        line(waves, col, sw),
      ];
    }
    case 'antenna': {
      const waves: Cmd[] = [];
      for (const r of [0.3, 0.44]) waves.push(...arc(cx, y + h * 0.26, w * r, -0.6, 0.6), ...arc(cx, y + h * 0.26, w * r, Math.PI - 0.6, Math.PI + 0.6));
      return [
        line(waves, col, sw * 0.9),
        line(seg(P(0.5, 0.42), P(0.5, 1)), col, sw * 1.4),
        { kind: 'path', fill, cmds: poly([P(0.5, 0.5), P(0.28, 0.06), P(0.72, 0.06)]) },
      ];
    }
    default: {
      const k = 0.5523;
      const rx = w * 0.17, top = y + h * 0.04, bot = y + h * 0.56;
      const capsule: Part = { kind: 'rect', x: cx - rx, y: top, w: rx * 2, h: bot - top, r: rx, fill };
      const grille: Cmd[] = [];
      for (const v of [0.16, 0.26, 0.36]) grille.push(...seg([cx - rx * 0.7, y + h * v], [cx + rx * 0.7, y + h * v]));
      const R = w * 0.28, hy = y + h * 0.4;
      return [
        line([['M', cx - R, hy], ['C', cx - R, hy + R * k * 1.3, cx - R * k, hy + R * 1.05, cx, hy + R * 1.05], ['C', cx + R * k, hy + R * 1.05, cx + R, hy + R * k * 1.3, cx + R, hy]], col, sw * 1.2),
        line([...seg([cx, hy + R * 1.05], [cx, y + h * 0.94]), ...seg([cx - w * 0.2, y + h * 0.96], [cx + w * 0.2, y + h * 0.96])], col, sw * 1.3),
        capsule,
        line(grille, shade(col, 0.3), sw * 0.6),
      ];
    }
  }
}

// ---------------- varianti mostrate come pulsanti nel pannello ----------------

const c = (value: string, label: string) => ({ value, label });
const LABELS: SpecGroup = { title: 'Testo', mode: 'many', choices: [c('labels', 'Nomi assi')] };

const OPTIONS: Record<string, SpecGroup[]> = {
  'sp-signal': [
    {
      title: 'Segnale',
      choices: [
        c('sine', 'Seno'), c('cosine', 'Coseno'), c('square', 'Quadra'), c('triangle', 'Triangolare'), c('sawtooth', 'Dente di sega'),
        c('chirp', 'Chirp'), c('am', 'AM'), c('fm', 'FM'), c('burst', 'Burst'), c('damped', 'Smorzato'), c('sinc', 'Sinc'),
        c('pulse', 'Impulso rett.'), c('step', 'Gradino'), c('impulses', 'Treno di δ'), c('noisy', 'Con rumore'), c('noise', 'Rumore'), c('audio', 'Parlato'),
      ],
    },
    { title: 'Opzioni', mode: 'many', choices: [c('labels', 'Nomi assi'), c('noaxes', 'Senza assi')] },
  ],
  'sp-discrete': [
    {
      title: 'Segnale',
      choices: [c('sine', 'Seno'), c('sinc', 'Sinc'), c('decay', 'Esponenziale'), c('damped', 'Smorzato'), c('random', 'Casuale'), c('impulse', 'Delta'), c('step', 'Gradino'), c('rect', 'Finestra')],
    },
    { title: 'Rappresentazione', mode: 'many', choices: [c('analog', 'Curva continua'), c('hold', 'Tenuta (ZOH)'), c('quant', 'Quantizzato')] },
    LABELS,
  ],
  'sp-spectrum': [
    {
      title: 'Spettro',
      choices: [
        c('peaks', 'Picchi'), c('harmonic', 'Armoniche'), c('lines', 'A righe'), c('bars', 'Bin FFT'), c('psd', 'PSD (dB)'), c('white', 'Bianco'),
        c('sym', 'Bilatero'), c('baseband', 'Banda base'), c('replica', 'Repliche'), c('aliasing', 'Aliasing'),
      ],
    },
    LABELS,
  ],
  'sp-spectrogram': [
    { title: 'Contenuto', choices: [c('speech', 'Parlato'), c('music', 'Musica'), c('chirp', 'Chirp'), c('mel', 'Log-mel'), c('cwt', 'Scalogramma'), c('mfcc', 'MFCC'), c('noise', 'Rumore')] },
    { title: 'Colori', choices: [c('magma', 'Magma'), c('viridis', 'Viridis'), c('inferno', 'Inferno'), c('gray', 'Grigi'), c('coolwarm', 'Blu-rosso')] },
  ],
  'sp-melbank': [
    { title: 'Scala', choices: [c('mel', 'Mel'), c('linear', 'Lineare')] },
    { title: 'Opzioni', mode: 'many', choices: [c('slaney', 'Area unitaria'), c('mono', 'Un colore'), c('labels', 'Nomi assi')] },
  ],
  'sp-stft': [{ title: 'Finestra', choices: [c('hann', 'Hann'), c('hamming', 'Hamming'), c('rect', 'Rettangolare')] }, LABELS],
  'sp-response': [
    { title: 'Filtro', choices: [c('lowpass', 'Passa-basso'), c('highpass', 'Passa-alto'), c('bandpass', 'Passa-banda'), c('bandstop', 'Elimina-banda'), c('notch', 'Notch'), c('allpass', 'Passa-tutto')] },
    { title: 'Risposta', choices: [c('butter', 'Butterworth'), c('ripple', 'Chebyshev'), c('ideal', 'Ideale')] },
    { title: 'Testo', mode: 'many', choices: [c('labels', 'Nomi assi e tagli')] },
  ],
  'sp-polezero': [
    { title: 'Sistema', choices: [c('iir', 'IIR'), c('butter', 'Butterworth'), c('notch', 'Notch'), c('fir', 'FIR'), c('resonator', 'Risonatore'), c('unstable', 'Instabile')] },
    { title: 'Testo', mode: 'many', choices: [c('labels', 'Re / Im')] },
  ],
  'sp-constellation': [
    { title: 'Modulazione', choices: [c('bpsk', 'BPSK'), c('qpsk', 'QPSK'), c('psk8', '8-PSK'), c('qam16', '16-QAM'), c('qam64', '64-QAM')] },
    { title: 'Opzioni', mode: 'many', choices: [c('noisy', 'Ricevuta (rumore)'), c('grid', 'Regioni di decisione'), c('labels', 'Assi I / Q')] },
  ],
  'sp-eye': [{ title: 'Opzioni', mode: 'many', choices: [c('noisy', 'Rumore'), c('scope', 'Oscilloscopio')] }],
  'sp-eeg': [
    { title: 'Segnale', choices: [c('eeg', 'EEG'), c('emg', 'EMG')] },
    { title: 'Opzioni', mode: 'many', choices: [c('names', 'Nomi canali'), c('spikes', 'Spike'), c('erp', 'Stimolo (ERP)')] },
  ],
  'sp-headcap': [{ title: 'Opzioni', mode: 'many', choices: [c('names', 'Nomi elettrodi'), c('motor', 'Area motoria')] }],
  'sp-junction': [{ title: 'Simbolo', choices: [c('sum', '+'), c('minus', '−'), c('mult', '×'), c('sigma', 'Σ'), c('quad', 'Nodo a X'), c('osc', 'Oscillatore')] }],
  'sp-filter': [
    {
      title: 'Simbolo',
      choices: [c('lp', 'Passa-basso'), c('hp', 'Passa-alto'), c('bp', 'Passa-banda'), c('bs', 'Elimina-banda'), c('notch', 'Notch'), c('fft', 'Spettro'), c('win', 'Finestra'), c('adaptive', 'Adattivo'), c('none', 'Nessuno')],
    },
  ],
  'sp-opbox': [
    {
      title: 'Operatore',
      choices: [
        c('int', '∫ Integratore'), c('deriv', 'd/dt'), c('down', '↓ Decimatore'), c('up', '↑ Espansore'), c('quant', 'Quantizzatore'), c('hold', 'Tenuta'),
        c('sat', 'Saturazione'), c('sign', 'Segno'), c('abs', '|x|'), c('square', 'x²'), c('log', 'log'), c('relu', 'ReLU'),
      ],
    },
  ],
  'sp-converter': [
    { title: 'Tipo', choices: [c('adc', 'ADC'), c('dac', 'DAC')] },
    { title: 'Simboli', mode: 'many', choices: [c('letters', 'Lettere A / D')] },
  ],
  'sp-switch': [{ title: 'Opzioni', mode: 'many', choices: [c('hold', 'Condensatore (S&H)'), c('closed', 'Chiuso')] }],
  'sp-transducer': [{ title: 'Tipo', choices: [c('mic', 'Microfono'), c('speaker', 'Altoparlante'), c('antenna', 'Antenna')] }],
};

const DEFS: Omit<ShapeDef, 'specOptions'>[] = [
  { kind: 'sp-signal', name: 'Segnale nel tempo', parts: signalShape, countLabel: 'Periodi', countMax: 24, specLabel: 'Variante' },
  { kind: 'sp-discrete', name: 'Segnale discreto x[n]', parts: discreteShape, countLabel: 'Campioni', countMax: 48, specLabel: 'Variante' },
  { kind: 'sp-spectrum', name: 'Spettro |X(f)|', parts: spectrumShape, countLabel: 'Picchi', countMax: 24, specLabel: 'Variante' },
  { kind: 'sp-spectrogram', name: 'Spettrogramma / scalogramma', parts: spectrogramShape, countLabel: 'Variante', countMax: 99, specLabel: 'Variante' },
  { kind: 'sp-melbank', name: 'Banco di filtri mel', parts: melbankShape, countLabel: 'Filtri', countMax: 40, specLabel: 'Variante' },
  { kind: 'sp-stft', name: 'Finestre STFT', parts: stftShape, countLabel: 'Frame', countMax: 14, specLabel: 'Variante' },
  { kind: 'sp-response', name: 'Risposta in frequenza', parts: responseShape, countLabel: 'Ordine', countMax: 12, specLabel: 'Variante' },
  { kind: 'sp-polezero', name: 'Poli e zeri (piano z)', parts: polezeroShape, countLabel: 'Ordine', countMax: 8, specLabel: 'Variante' },
  { kind: 'sp-constellation', name: 'Costellazione QAM/PSK', parts: constellationShape, specLabel: 'Variante' },
  { kind: 'sp-eye', name: 'Diagramma a occhio', parts: eyeShape, specLabel: 'Variante' },
  { kind: 'sp-eeg', name: 'EEG multicanale', parts: eegShape, countLabel: 'Canali', countMax: 24, specLabel: 'Variante' },
  { kind: 'sp-headcap', name: 'Montaggio EEG 10-20', parts: headShape, specLabel: 'Variante' },
  { kind: 'sp-junction', name: 'Nodo (somma, prodotto, oscillatore)', parts: junctionShape, specLabel: 'Simbolo' },
  { kind: 'sp-filter', name: 'Filtro con risposta', parts: filterShape, label: (n) => filterLayout(n).label, specLabel: 'Simbolo' },
  { kind: 'sp-opbox', name: 'Operatore (∫, quantizzatore, ↓M…)', parts: opboxShape, label: opLabel, specLabel: 'Operatore' },
  { kind: 'sp-converter', name: 'Convertitore ADC/DAC', parts: converterShape, specLabel: 'Variante' },
  { kind: 'sp-switch', name: 'Campionatore (interruttore)', parts: switchShape, specLabel: 'Variante' },
  { kind: 'sp-transducer', name: 'Microfono / altoparlante / antenna', parts: transducerShape, specLabel: 'Tipo' },
];

export const SIGNAL_SHAPES: ShapeDef[] = DEFS.map((d) => ({ ...d, specOptions: OPTIONS[d.kind] }));
