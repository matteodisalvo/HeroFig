// Forme del modulo Reinforcement learning / NLP & LLM: grid world (ambiente, funzione
// valore, policy), icone di ambiente, replay buffer, albero MCTS, curve di return, token,
// vector database, chunk, chat, tool, LLM a strati, KV cache, punteggio.
// Tutto con primitive `Part` deterministiche: identiche in SVG, PDF, PNG e TikZ.
import { arc, mix, poly, rng, shade, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';

type P2 = [number, number];
type N = NodeModel;

const K = 0.5523;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const inkOf = (n: N) => (n.stroke === 'none' ? '#555555' : n.stroke);
const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];
const line = (cmds: Cmd[], color?: string, sw?: number): Part => ({ kind: 'path', fill: 'none', cmds, stroke: color, sw, solid: true });
const box = (x: number, y: number, w: number, h: number, fill: string, stroke?: string, sw?: number, r = 0): Part => ({
  kind: 'rect', x, y, w, h, r, fill, stroke, sw, solid: true,
});
const disc = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw?: number): Part => ({
  kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true,
});
const area = (cmds: Cmd[], fill: string, stroke = 'none', sw?: number): Part => ({ kind: 'path', cmds, fill, stroke, sw, solid: true });
type TextOpts = { anchor?: 'middle' | 'start' | 'end'; bold?: boolean; italic?: boolean };
/** Testo dentro la forma (y = centro verticale). */
const txt = (x: number, y: number, text: string, size: number, fill = '#1A1A1A', o: TextOpts = {}): Part => ({ kind: 'text', x, y, text, size, fill, ...o });
const TEXT_INK = '#1A1A1A';
/** Parole di `spec` (minuscole), per i flag e le varianti. */
const words = (n: N) => n.spec.toLowerCase().split(/\s+/).filter(Boolean);
const has = (n: N, w: string) => words(n).includes(w);
/** Ultimo numero in `spec` (i pulsanti si aggiungono in coda). */
const specNumber = (n: N, fallback: number) => {
  const nums = words(n).map(Number.parseFloat).filter((v) => !Number.isNaN(v));
  return nums.length ? nums[nums.length - 1] : fallback;
};

function head(tip: P2, dx: number, dy: number, size: number, color: string): Part {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const bx = tip[0] - ux * size, by = tip[1] - uy * size;
  const hw = size * 0.45;
  return area(poly([tip, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]), color);
}

/** Freccia da `a` a `b` (punta piena in `b`). */
function arrow(a: P2, b: P2, color: string, sw: number, size: number): Part[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const cut = Math.min(size * 0.8, l * 0.5);
  const end: P2 = [b[0] - ((b[0] - a[0]) / l) * cut, b[1] - ((b[1] - a[1]) / l) * cut];
  return [line(seg(a, end), color, sw), head(b, b[0] - a[0], b[1] - a[1], size, color)];
}

/** Segmento tratteggiato disegnato come trattini pieni (indipendente dallo stile del blocco). */
function dashes(a: P2, b: P2, on: number, off: number): Cmd[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / (l || 1), uy = (b[1] - a[1]) / (l || 1);
  const cmds: Cmd[] = [];
  for (let s = 0; s < l; s += on + off) {
    const e = Math.min(l, s + on);
    cmds.push(['M', a[0] + ux * s, a[1] + uy * s], ['L', a[0] + ux * e, a[1] + uy * e]);
  }
  return cmds;
}

/** Rettangolo con raggi diversi agli angoli: alto-sinistra, alto-destra, basso-destra, basso-sinistra. */
function rr4(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: number[]): Cmd[] {
  const c = (r: number) => Math.min(r, w / 2, h / 2);
  const [a, b, d, e] = [c(tl), c(tr), c(br), c(bl)];
  return [
    ['M', x + a, y], ['L', x + w - b, y],
    ['C', x + w - b + K * b, y, x + w, y + b - K * b, x + w, y + b],
    ['L', x + w, y + h - d],
    ['C', x + w, y + h - d + K * d, x + w - d + K * d, y + h, x + w - d, y + h],
    ['L', x + e, y + h],
    ['C', x + e - K * e, y + h, x, y + h - e + K * e, x, y + h - e],
    ['L', x, y + a],
    ['C', x, y + a - K * a, x + a - K * a, y, x + a, y],
    ['Z'],
  ];
}

/** Rettangolo con raggio diverso a sinistra (rl) e a destra (rr). */
const rrect = (x: number, y: number, w: number, h: number, rl: number, rr: number) => rr4(x, y, w, h, [rl, rr, rr, rl]);

/** Stellina a 4 punte (scintilla), centrata in (cx, cy). */
function sparkle(cx: number, cy: number, r: number): Cmd[] {
  const q = r * 0.28;
  return [
    ['M', cx, cy - r], ['C', cx + q * 0.3, cy - q, cx + q, cy - q * 0.3, cx + r, cy],
    ['C', cx + q, cy + q * 0.3, cx + q * 0.3, cy + q, cx, cy + r],
    ['C', cx - q * 0.3, cy + q, cx - q, cy + q * 0.3, cx - r, cy],
    ['C', cx - q, cy - q * 0.3, cx - q * 0.3, cy - q, cx, cy - r], ['Z'],
  ];
}

// ======================================================================
// Grid world: lo stesso mondo (muri, obiettivo, trappola) per ambiente,
// funzione valore e policy. Modello di Russell & Norvig: mossa voluta con
// probabilità 0.8, 0.1 per ciascuna perpendicolare, r = -0.04, γ = 1.
// ======================================================================

export interface GridWorld {
  R: number;
  C: number;
  walls: boolean[];
  goal: number;
  pit: number;
  start: number;
  V: number[];
  /** azione greedy per cella: 0 su, 1 destra, 2 giù, 3 sinistra; -1 se terminale o muro */
  pi: number[];
}

const MOVES: P2[] = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const gridCache = new Map<string, GridWorld>();

export function gridWorld(spec: string, count: number): GridWorld {
  // vale l'ultima dimensione scritta (i pulsanti del pannello si aggiungono in coda)
  const sizes = [...spec.matchAll(/(\d+)\s*[x×]\s*(\d+)/gi)];
  const last = sizes[sizes.length - 1];
  const [R, C] = last ? [clamp(+last[1], 2, 16), clamp(+last[2], 2, 16)] : [3, 4];
  const nWalls = clamp(Math.round(count), 0, Math.floor((R * C) / 4));
  const key = `${R}x${C}:${nWalls}`;
  const hit = gridCache.get(key);
  if (hit) return hit;
  const idx = (r: number, c: number) => r * C + c;
  const goal = idx(0, C - 1);
  const pit = R >= 3 ? idx(1, C - 1) : -1;
  const start = idx(R - 1, 0);
  const walls: boolean[] = new Array(R * C).fill(false);
  const nb = (k: number, a: number) => {
    const r = Math.floor(k / C) + MOVES[a][0], c = (k % C) + MOVES[a][1];
    return r < 0 || r >= R || c < 0 || c >= C ? -1 : idx(r, c);
  };
  const connected = () => {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const k = queue.shift()!;
      for (let a = 0; a < 4; a++) {
        const j = nb(k, a);
        if (j >= 0 && !walls[j] && !seen.has(j)) {
          seen.add(j);
          queue.push(j);
        }
      }
    }
    return seen.size === walls.filter((w) => !w).length;
  };
  // ordine dei candidati deterministico; il 4×3 classico ha il muro in (riga 1, colonna 1)
  const rand = rng(R * 97 + C * 13 + 7);
  const order = Array.from({ length: R * C }, (_, k) => k).sort(() => rand() - 0.5);
  if (R === 3 && C === 4) order.unshift(idx(1, 1));
  let placed = 0;
  for (const k of order) {
    if (placed >= nWalls) break;
    if (k === goal || k === pit || k === start || walls[k]) continue;
    walls[k] = true;
    if (connected()) placed++;
    else walls[k] = false;
  }
  // value iteration
  const V: number[] = new Array(R * C).fill(0);
  V[goal] = 1;
  if (pit >= 0) V[pit] = -1;
  const terminal = (k: number) => k === goal || k === pit;
  const move = (k: number, a: number) => {
    const j = nb(k, a);
    return j < 0 || walls[j] ? k : j;
  };
  const q = (k: number, a: number) => 0.8 * V[move(k, a)] + 0.1 * V[move(k, (a + 1) % 4)] + 0.1 * V[move(k, (a + 3) % 4)];
  for (let it = 0; it < 1000; it++) {
    let delta = 0;
    for (let k = 0; k < R * C; k++) {
      if (walls[k] || terminal(k)) continue;
      let best = -Infinity;
      for (let a = 0; a < 4; a++) best = Math.max(best, q(k, a));
      const v = -0.04 + best;
      delta = Math.max(delta, Math.abs(v - V[k]));
      V[k] = v;
    }
    if (delta < 1e-9) break;
  }
  const pi = V.map((_, k) => {
    if (walls[k] || terminal(k)) return -1;
    let best = 0;
    for (let a = 1; a < 4; a++) if (q(k, a) > q(k, best) + 1e-12) best = a;
    return best;
  });
  const g = { R, C, walls, goal, pit, start, V, pi };
  gridCache.set(key, g);
  return g;
}

const WALL = '#8A929C';
const GOAL = { fill: '#CDEBC5', ink: '#2F9E44' };
const PIT = { fill: '#F6C9C6', ink: '#B23A30' };

function gridLines(n: N, g: GridWorld): Part[] {
  const { x, y, w, h } = n;
  const lines: Cmd[] = [];
  for (let i = 1; i < g.C; i++) lines.push(...seg([x + (w * i) / g.C, y], [x + (w * i) / g.C, y + h]));
  for (let j = 1; j < g.R; j++) lines.push(...seg([x, y + (h * j) / g.R], [x + w, y + (h * j) / g.R]));
  return [line(lines, shade(inkOf(n), 0.25), n.strokeWidth * 0.7), { kind: 'rect', x, y, w, h, r: 0, fill: 'none' }];
}

function cellRect(n: N, g: GridWorld, k: number) {
  const cw = n.w / g.C, ch = n.h / g.R;
  return { x: n.x + (k % g.C) * cw, y: n.y + Math.floor(k / g.C) * ch, w: cw, h: ch };
}

function gridParts(n: N, mode: 'world' | 'value' | 'policy'): Part[] {
  const g = gridWorld(n.spec, n.count);
  const ink = inkOf(n);
  const parts: Part[] = [{ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: 0, fill: n.fill, stroke: 'none' }];
  const free = g.V.map((_, k) => k).filter((k) => !g.walls[k] && k !== g.goal && k !== g.pit);
  const lo = Math.min(...free.map((k) => g.V[k]));
  const hi = Math.max(...free.map((k) => g.V[k]));
  for (let k = 0; k < g.R * g.C; k++) {
    const c = cellRect(n, g, k);
    let fill: string | null = null;
    if (g.walls[k]) fill = WALL;
    else if (k === g.goal) fill = mode === 'value' ? shade(ink, 0.05) : GOAL.fill;
    else if (k === g.pit) fill = PIT.fill;
    else if (mode === 'value') fill = mix(shade(ink, 0.93), shade(ink, 0.3), hi > lo ? (g.V[k] - lo) / (hi - lo) : 1);
    if (fill) parts.push(box(c.x, c.y, c.w, c.h, fill, 'none'));
  }
  parts.push(...gridLines(n, g));
  const sw = n.strokeWidth;
  if (mode === 'world') {
    const gc = cellRect(n, g, g.goal);
    const m = Math.min(gc.w, gc.h);
    const px = gc.x + gc.w / 2 - m * 0.16, top = gc.y + gc.h / 2 - m * 0.3, bot = gc.y + gc.h / 2 + m * 0.3;
    parts.push(line(seg([px, top], [px, bot]), '#3D4752', Math.max(1, sw)));
    parts.push(area(poly([[px, top], [px + m * 0.4, top + m * 0.13], [px, top + m * 0.26]]), GOAL.ink, shade(GOAL.ink, -0.25), 0.8));
    if (g.pit >= 0) {
      const pc = cellRect(n, g, g.pit);
      const pm = Math.min(pc.w, pc.h);
      parts.push({ kind: 'ellipse', cx: pc.x + pc.w / 2, cy: pc.y + pc.h / 2, rx: pm * 0.32, ry: pm * 0.18, fill: '#4B5563', stroke: PIT.ink, sw: 0.8, solid: true });
    }
    const sc = cellRect(n, g, g.start);
    const sm = Math.min(sc.w, sc.h);
    const ax = sc.x + sc.w / 2, ay = sc.y + sc.h / 2;
    parts.push(disc(ax, ay, sm * 0.28, '#FFB547', '#B26B00', 1));
    parts.push(disc(ax - sm * 0.1, ay - sm * 0.04, sm * 0.045, '#3D2A00'), disc(ax + sm * 0.1, ay - sm * 0.04, sm * 0.045, '#3D2A00'));
  }
  if (mode === 'policy') {
    for (let k = 0; k < g.R * g.C; k++) {
      if (g.pi[k] < 0) continue;
      const c = cellRect(n, g, k);
      const m = Math.min(c.w, c.h);
      const [dr, dc] = MOVES[g.pi[k]];
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2, L = m * 0.3;
      parts.push(...arrow([cx - dc * L, cy - dr * L], [cx + dc * L, cy + dr * L], shade(ink, -0.35), Math.max(1.1, sw * 1.2), clamp(m * 0.22, 4, 9)));
    }
  }
  if (mode !== 'world' && !has(n, 'novalues')) {
    // valori nelle celle (funzione valore) e ricompense terminali ±1: solo se leggibili
    const cw = n.w / g.C, ch = n.h / g.R;
    const digits = has(n, 'num3') ? 3 : 2;
    const size = Math.min(12, ch * 0.32, cw / (digits * 0.62 + 1.6));
    for (let k = 0; size >= 6 && k < g.R * g.C; k++) {
      if (g.walls[k]) continue;
      const c = cellRect(n, g, k);
      const term = k === g.goal ? '$+1$' : k === g.pit ? '$-1$' : '';
      if (term) parts.push(txt(c.x + c.w / 2, c.y + c.h / 2, term, size * 1.15, TEXT_INK, { bold: true }));
      else if (mode === 'value') parts.push(txt(c.x + c.w / 2, c.y + c.h / 2, `$${g.V[k].toFixed(digits)}$`, size * 1.05));
    }
  }
  return parts;
}

// ======================================================================
// Icone di ambiente
// ======================================================================

function envParts(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = inkOf(n);
  const sw = n.strokeWidth;
  const kind = ['atari', 'cartpole', 'go'].find((k) => has(n, k)) ?? 'globe';
  const cx = x + w / 2, cy = y + h / 2;
  if (kind === 'atari') {
    const r = Math.min(n.radius, Math.min(w, h) * 0.12);
    const p = Math.min(w, h) * 0.08;
    const s = { x: x + p, y: y + p, w: w - 2 * p, h: h - 2 * p };
    const parts: Part[] = [box(x, y, w, h, fill, undefined, undefined, r), box(s.x, s.y, s.w, s.h, '#1F2430', 'none', undefined, 2)];
    const BR = ['#E5484D', '#F76B15', '#FFC53D', '#46A758', '#3E8EDE'];
    const cols = 8, gap = Math.max(0.6, s.w * 0.012);
    const bw = (s.w - gap * (cols + 1)) / cols, bh = s.h * 0.07;
    const rand = rng(23);
    BR.forEach((c, j) => {
      for (let i = 0; i < cols; i++) {
        if (j >= 3 && rand() < 0.3) continue;
        parts.push(box(s.x + gap + i * (bw + gap), s.y + s.h * 0.12 + j * (bh + gap), bw, bh, c, 'none'));
      }
    });
    parts.push(box(s.x + s.w * 0.52, s.y + s.h * 0.86, s.w * 0.2, s.h * 0.05, '#D1D5DB', 'none'));
    const b = Math.max(1.5, s.w * 0.035);
    parts.push(box(s.x + s.w * 0.36, s.y + s.h * 0.62, b, b, '#F3F4F6', 'none'));
    return parts;
  }
  if (kind === 'cartpole') {
    const gy = y + h * 0.9;
    const cw = w * 0.46, ch = h * 0.2;
    const cx0 = cx - cw / 2, cy0 = gy - ch - h * 0.08;
    const wr = h * 0.065;
    const hinge: P2 = [cx, cy0];
    const ang = (16 * Math.PI) / 180;
    const L = (cy0 - y) / Math.cos(ang), t = Math.max(2.5, w * 0.04);
    const ux = Math.sin(ang), uy = -Math.cos(ang);
    const top: P2 = [hinge[0] + ux * L, hinge[1] + uy * L];
    const px = -uy * (t / 2), py = ux * (t / 2);
    return [
      line(seg([x, gy], [x + w, gy]), ink, sw),
      area(poly([[hinge[0] + px, hinge[1] + py], [top[0] + px, top[1] + py], [top[0] - px, top[1] - py], [hinge[0] - px, hinge[1] - py]]), '#E8B36B', '#9A6420', 1),
      box(cx0, cy0, cw, ch, fill, undefined, undefined, 2),
      disc(cx0 + cw * 0.22, gy - wr, wr, '#4B5563', '#2D333B', 0.8),
      disc(cx0 + cw * 0.78, gy - wr, wr, '#4B5563', '#2D333B', 0.8),
      disc(hinge[0], hinge[1], Math.max(1.6, t * 0.55), '#FFFFFF', '#2D333B', 0.9),
    ];
  }
  if (kind === 'go') {
    const r = Math.min(n.radius, 4);
    const N0 = 7;
    const p = Math.min(w, h) * 0.09;
    const gx = x + p, gyy = y + p, gw = w - 2 * p, gh = h - 2 * p;
    const lines: Cmd[] = [];
    for (let i = 0; i < N0; i++) {
      lines.push(...seg([gx + (gw * i) / (N0 - 1), gyy], [gx + (gw * i) / (N0 - 1), gyy + gh]));
      lines.push(...seg([gx, gyy + (gh * i) / (N0 - 1)], [gx + gw, gyy + (gh * i) / (N0 - 1)]));
    }
    const parts: Part[] = [box(x, y, w, h, fill === 'none' ? 'none' : '#E9C27D', '#9A6B2F', sw, r), line(lines, '#6B4A1E', Math.max(0.5, sw * 0.6))];
    const sr = Math.min(gw, gh) / (N0 - 1) * 0.42;
    const STONES: [number, number, boolean][] = [[2, 2, true], [3, 2, false], [2, 3, false], [4, 4, true], [3, 4, true], [4, 3, false], [1, 4, true], [5, 2, false], [2, 5, true], [4, 1, false]];
    for (const [i, j, black] of STONES) {
      parts.push(disc(gx + (gw * i) / (N0 - 1), gyy + (gh * j) / (N0 - 1), sr, black ? '#22252B' : '#FAFAFA', '#22252B', 0.8));
    }
    return parts;
  }
  // globo
  const R = Math.min(w, h) / 2;
  const grid: Cmd[] = [
    ...seg([cx - R, cy], [cx + R, cy]),
    ...seg([cx, cy - R], [cx, cy + R]),
    ...seg([cx - R * 0.87, cy - R * 0.5], [cx + R * 0.87, cy - R * 0.5]),
    ...seg([cx - R * 0.87, cy + R * 0.5], [cx + R * 0.87, cy + R * 0.5]),
  ];
  return [
    { kind: 'ellipse', cx, cy, rx: R, ry: R, fill },
    line(grid, shade(ink, 0.15), sw * 0.8),
    { kind: 'ellipse', cx, cy, rx: R * 0.45, ry: R, fill: 'none', stroke: shade(ink, 0.15), sw: sw * 0.8, solid: true },
    { kind: 'ellipse', cx, cy, rx: R, ry: R, fill: 'none' },
  ];
}

function rewardParts(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const X = (u: number) => x + u * w;
  const Y = (v: number) => y + v * h;
  if (has(n, 'trophy')) {
    const ink = inkOf(n);
    return [
      line([['M', X(0.24), Y(0.14)], ['C', X(0.02), Y(0.12), X(0.02), Y(0.46), X(0.32), Y(0.46)]], ink, n.strokeWidth * 1.4),
      line([['M', X(0.76), Y(0.14)], ['C', X(0.98), Y(0.12), X(0.98), Y(0.46), X(0.68), Y(0.46)]], ink, n.strokeWidth * 1.4),
      { kind: 'path', fill, cmds: [['M', X(0.2), Y(0.06)], ['L', X(0.8), Y(0.06)], ['C', X(0.8), Y(0.42), X(0.66), Y(0.6), X(0.5), Y(0.6)], ['C', X(0.34), Y(0.6), X(0.2), Y(0.42), X(0.2), Y(0.06)], ['Z']] },
      { kind: 'rect', x: X(0.44), y: Y(0.6), w: w * 0.12, h: h * 0.18, r: 0, fill },
      { kind: 'rect', x: X(0.28), y: Y(0.78), w: w * 0.44, h: h * 0.16, r: 2, fill },
      area(sparkle(X(0.5), Y(0.3), Math.min(w, h) * 0.1), '#FFFFFF'),
    ];
  }
  const cx = x + w / 2, cy = y + h * 0.53;
  const R = Math.min(w / 2, h / 1.9);
  const pts: P2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? R : R * 0.42;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return [{ kind: 'path', fill, cmds: poly(pts) }];
}

// ======================================================================
// Replay buffer, MCTS, curve di return
// ======================================================================

const TUPLE = [
  { fill: '#DAE8FC', stroke: '#6C8EBF', wt: 1 },
  { fill: '#FFE6CC', stroke: '#D79B00', wt: 0.7 },
  { fill: '#D5E8D4', stroke: '#82B366', wt: 0.7 },
  { fill: '#E1D5E7', stroke: '#9673A6', wt: 1 },
];

const TUPLE_HEAD = ['$s$', '$a$', '$r$', "$s'$"];

function replayParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const rows = clamp(Math.round(n.count), 2, 12);
  const p = Math.min(w, h) * 0.08;
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, Math.min(w, h) / 4), fill: n.fill }];
  const tri = w * 0.07;
  const iw = w - 2 * p - tri;
  // intestazione (s, a, r, s') solo se c'è spazio per leggerla
  const hs = clamp(h * 0.09, 7, 11);
  const header = !has(n, 'noheader') && w >= 60 && (h - 2 * p - hs * 1.5) / rows >= 7;
  const top = y + p + (header ? hs * 1.5 : 0);
  const ih = y + h - p - top;
  const gapY = Math.min(4, ih / rows / 4);
  const rh = (ih - gapY * (rows - 1)) / rows;
  const gapX = Math.min(3, iw * 0.025);
  const tot = TUPLE.reduce((s, c) => s + c.wt, 0);
  const colW = TUPLE.map((c) => ((iw - gapX * (TUPLE.length - 1)) * c.wt) / tot);
  const rand = rng(rows * 11 + 3);
  const picked = new Set<number>();
  while (picked.size < Math.max(1, Math.round(rows / 3))) picked.add(Math.floor(rand() * rows));
  if (header) {
    let cx = x + p;
    TUPLE.forEach((c, i) => {
      parts.push(txt(cx + colW[i] / 2, y + p + hs * 0.6, TUPLE_HEAD[i], hs, shade(c.stroke, -0.35)));
      cx += colW[i] + gapX;
    });
  }
  for (let j = 0; j < rows; j++) {
    const ry = top + j * (rh + gapY);
    const on = picked.has(j);
    let cx = x + p;
    TUPLE.forEach((c, i) => {
      parts.push(box(cx, ry, colW[i], rh, on ? c.fill : mix(c.fill, '#FFFFFF', 0.55), on ? c.stroke : mix(c.stroke, '#FFFFFF', 0.5), on ? 1 : 0.7, Math.min(2, rh / 3)));
      cx += colW[i] + gapX;
    });
    if (on) parts.push(head([x + w - p * 0.5, ry + rh / 2], 1, 0, Math.min(tri * 0.8, rh * 0.9), inkOf(n)));
  }
  return parts;
}

interface TNode { level: number; parent: number; x: number; path: boolean; fresh: boolean }

function mctsTree(depth: number): TNode[] {
  const nodes: TNode[] = [{ level: 0, parent: -1, x: 0, path: true, fresh: false }];
  const kids: number[][] = [[]];
  const add = (parent: number, path: boolean) => {
    nodes.push({ level: nodes[parent].level + 1, parent, x: 0, path, fresh: false });
    kids.push([]);
    kids[parent].push(nodes.length - 1);
    return nodes.length - 1;
  };
  const l1 = [add(0, false), add(0, true), add(0, false)];
  let tip = l1[1];
  for (const c of l1) {
    const a = add(c, false);
    const b = add(c, c === l1[1]);
    if (c === l1[1]) tip = b;
    void a;
  }
  for (let l = 3; l <= depth; l++) {
    const a = add(tip, true);
    add(tip, false);
    tip = a;
  }
  // gli ultimi figli del cammino sono quelli espansi
  for (const k of kids[nodes[tip].parent]) nodes[k].fresh = true;
  // disposizione: foglie in ordine, genitori al centro dei figli
  let leaf = 0;
  const place = (k: number): number => {
    if (!kids[k].length) return (nodes[k].x = leaf++);
    const xs = kids[k].map(place);
    return (nodes[k].x = (xs[0] + xs[xs.length - 1]) / 2);
  };
  place(0);
  const maxX = Math.max(1, leaf - 1);
  for (const t of nodes) t.x /= maxX;
  return nodes;
}

const ACTIVE = '#D9480F';

function mctsParts(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const depth = clamp(Math.round(n.count), 2, 4);
  const phase = ['select', 'expand', 'backup', 'play'].find((k) => has(n, k)) ?? '';
  const tree = mctsTree(depth);
  const ink = inkOf(n);
  const sw = n.strokeWidth;
  const leaves = tree.filter((t) => !tree.some((c) => c.parent === tree.indexOf(t))).length;
  const r = clamp(Math.min(h / (depth + 1) * 0.2, w / leaves * 0.3), 3, 14);
  const P = (t: TNode): P2 => [x + r + (w - 2 * r) * t.x, y + r + ((h - 2 * r) * t.level) / depth];
  const fade = phase === 'play';
  const parts: Part[] = [];
  const edges: Cmd[] = [];
  const hot: [P2, P2][] = [];
  tree.forEach((t) => {
    if (t.parent < 0) return;
    const a = P(tree[t.parent]), b = P(t);
    const isHot = t.path && (phase !== 'play' || t.level === 1) && (phase !== 'expand' || !t.fresh);
    if (isHot && phase) hot.push([a, b]);
    else edges.push(...seg(a, b));
  });
  parts.push(line(edges, fade ? shade(ink, 0.55) : ink, sw * 0.8));
  for (const [a, b] of hot) {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u: P2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    const s: P2 = [a[0] + u[0] * r, a[1] + u[1] * r];
    const e: P2 = [b[0] - u[0] * r, b[1] - u[1] * r];
    const size = clamp(r * 0.9, 4, 8);
    if (phase === 'backup') parts.push(line(seg(a, b), ACTIVE, sw * 1.6), head(s, -u[0], -u[1], size, ACTIVE));
    else parts.push(line(seg(a, b), ACTIVE, sw * 1.6), head(e, u[0], u[1], size, ACTIVE));
  }
  tree.forEach((t) => {
    const [cx, cy] = P(t);
    const lit = phase && t.path && (phase !== 'play' || t.level <= 1);
    let f = fill;
    let s: string | undefined;
    if (t.fresh && phase === 'expand') {
      f = '#FFE6CC';
      s = ACTIVE;
    } else if (lit) {
      f = fill === 'none' ? 'none' : shade(ACTIVE, 0.72);
      s = ACTIVE;
    } else if (fade) {
      f = fill === 'none' ? 'none' : mix(fill, '#FFFFFF', 0.5);
      s = shade(ink, 0.5);
    }
    parts.push({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill: f, stroke: s, sw: lit || t.fresh ? sw * 1.2 : sw, solid: true });
  });
  if (has(n, 'counts') && r >= 7.5) {
    // conteggi di visita N(s): ogni nodo somma quelli dei figli (i nodi appena espansi valgono 0)
    const N0 = tree.map(() => 0);
    for (let k = tree.length - 1; k >= 0; k--) {
      const t = tree[k];
      N0[k] += t.fresh && phase === 'expand' ? 0 : 1 + (t.path && !tree.some((c) => c.parent === k) ? 1 : 0);
      if (t.parent >= 0) N0[t.parent] += N0[k];
    }
    tree.forEach((t, k) => {
      const [cx, cy] = P(t);
      parts.push(txt(cx, cy, String(N0[k]), Math.min(11, r * (N0[k] > 9 ? 0.85 : 1)), fade && !(t.path && t.level <= 1) ? shade(ink, 0.4) : TEXT_INK));
    });
  }
  return parts;
}

const CURVE_INK = ['#D9480F', '#2F9E44'];

function curveParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const ink = inkOf(n);
  const k = clamp(Math.round(n.count), 1, 3);
  const x0 = x + w * 0.1, x1 = x + w * 0.95, y0 = y + h * 0.88, y1 = y + h * 0.1;
  const parts: Part[] = [
    { kind: 'rect', x, y, w, h, r: Math.min(n.radius, Math.min(w, h) / 2), fill: n.fill },
    line([['M', x0, y1 - h * 0.03], ['L', x0, y0], ['L', x1 + w * 0.02, y0]], '#9AA0A6', 0.8),
  ];
  const N0 = 48;
  const levels = [0.86, 0.62, 0.4], rates = [4.2, 3.2, 2.6];
  const lines: Part[] = [];
  for (let c = 0; c < k; c++) {
    const rand = rng(91 + c * 17);
    const color = c === 0 ? shade(ink, -0.2) : CURVE_INK[c - 1];
    const mid: P2[] = [], upper: P2[] = [], lower: P2[] = [];
    let noise = 0;
    for (let i = 0; i <= N0; i++) {
      const u = i / N0;
      noise = noise * 0.6 + (rand() - 0.5) * 0.09;
      const m = 0.04 + levels[c] * (1 - Math.exp(-rates[c] * u)) + noise * Math.min(1, u * 4);
      const band = 0.025 + 0.06 * Math.sin(Math.PI * Math.min(1, u * 1.4)) ** 2;
      const X = x0 + (x1 - x0) * u;
      const Y = (v: number) => y0 - (y0 - y1) * clamp(v, 0, 1);
      mid.push([X, Y(m)]);
      upper.push([X, Y(m + band)]);
      lower.push([X, Y(m - band)]);
    }
    parts.push(area(poly([...upper, ...lower.reverse()]), mix(color, '#FFFFFF', 0.8)));
    lines.push(line(poly(mid, false), color, n.strokeWidth * 1.2));
  }
  return [...parts, ...lines];
}

// ======================================================================
// NLP & LLM
// ======================================================================

export const TOKEN_COLORS = [
  { fill: '#FAD7DD', stroke: '#C2577A' },
  { fill: '#D7E6FA', stroke: '#4F7CB8' },
  { fill: '#DDF0D5', stroke: '#5E9A4B' },
  { fill: '#FFEFC2', stroke: '#C49A1E' },
  { fill: '#E6DAF5', stroke: '#8462AE' },
  { fill: '#FFDCC2', stroke: '#C8762B' },
];
const SPECIAL = { fill: '#E5E7EB', stroke: '#6B7280' };

export interface Chip {
  x: number;
  w: number;
  text: string;
  special: boolean;
  joinL: boolean;
  joinR: boolean;
  color: { fill: string; stroke: string };
}

/** Posizione dei chip di una sequenza di token "a|b|##c": i pezzi "##" si attaccano al precedente. */
export function tokenLayout(spec: string, x: number, w: number, h: number): Chip[] {
  let toks = spec.split('|').map((s) => s.trim()).filter(Boolean);
  const blank = !toks.length;
  if (blank) toks = ['', '', '', '', ''];
  const gap = clamp(h * 0.2, 2, 6);
  const wt = toks.map((t) => (blank ? 1 : Math.max(2.4, t.length * 0.9 + 1.6)));
  const joinL = toks.map((t, i) => i > 0 && t.startsWith('##'));
  const gaps = joinL.filter((j, i) => i > 0 && !j).length;
  const free = w - gaps * gap;
  const sum = wt.reduce((a, b) => a + b, 0);
  let cx = x;
  let color = 0;
  return toks.map((t, i) => {
    const special = /^\[.*\]$|^<.*>$/.test(t);
    const cw = (free * wt[i]) / sum;
    const chip: Chip = {
      x: cx,
      w: cw,
      text: t,
      special,
      joinL: joinL[i],
      joinR: !!joinL[i + 1],
      color: special ? SPECIAL : TOKEN_COLORS[color++ % TOKEN_COLORS.length],
    };
    cx += cw + (joinL[i + 1] ? 0 : gap);
    return chip;
  });
}

/** Testo di un token: < e > vanno in formula (nel testo normale di LaTeX diventano ¡ e ¿). */
const tokenText = (t: string) => t.replace(/[<>]/g, (c) => `$${c}$`);

function tokenParts(n: N): Part[] {
  const r = Math.min(n.radius, n.h / 3);
  const chips = tokenLayout(n.spec, n.x, n.w, n.h);
  const parts: Part[] = chips.map((c) =>
    area(rrect(c.x, n.y, c.w, n.h, c.joinL ? 0 : r, c.joinR ? 0 : r), n.fill === 'none' ? 'none' : c.color.fill, c.color.stroke, n.strokeWidth),
  );
  // una sola dimensione per la riga: la più grande che entra in tutti i chip
  let size = Math.min(12, n.h * 0.44);
  for (const c of chips) if (c.text) size = Math.min(size, (c.w - 4) / (c.text.length * 0.56));
  if (size >= 5.5) for (const c of chips) if (c.text) parts.push(txt(c.x + c.w / 2, n.y + n.h / 2, tokenText(c.text), size, c.special ? '#4B5563' : TEXT_INK));
  return parts;
}

/** Spazio di embedding con l'analogia king - man + woman ≈ queen (Mikolov et al. 2013). */
export const ANALOGY: Record<string, P2> = { man: [0.16, 0.8], woman: [0.3, 0.36], king: [0.62, 0.68], queen: [0.78, 0.22] };

function embspaceParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const ink = inkOf(n);
  const P = (k: string): P2 => [x + ANALOGY[k][0] * w, y + ANALOGY[k][1] * h];
  const m = Math.min(w, h);
  const r = clamp(m * 0.03, 2, 5);
  const sw = n.strokeWidth;
  const gender = shade(ink, -0.3);
  const shrink = (a: P2, b: P2): [P2, P2] => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u: P2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    return [[a[0] + u[0] * r * 1.8, a[1] + u[1] * r * 1.8], [b[0] - u[0] * r * 1.8, b[1] - u[1] * r * 1.8]];
  };
  const parts: Part[] = [
    { kind: 'rect', x, y, w, h, r: Math.min(n.radius, m / 2), fill: n.fill },
    line([['M', x + w * 0.06, y + h * 0.06], ['L', x + w * 0.06, y + h * 0.94], ['L', x + w * 0.94, y + h * 0.94]], '#B8BEC6', 0.8),
  ];
  for (const [a, b] of [['man', 'king'], ['woman', 'queen']] as const) {
    const [s, e] = shrink(P(a), P(b));
    parts.push(line(dashes(s, e, 4, 3), '#8A929C', sw));
  }
  for (const [a, b] of [['man', 'woman'], ['king', 'queen']] as const) {
    const [s, e] = shrink(P(a), P(b));
    parts.push(...arrow(s, e, gender, sw * 1.3, clamp(m * 0.06, 4, 8)));
  }
  for (const k of Object.keys(ANALOGY)) parts.push(disc(...P(k), r, '#374151'));
  const fs = clamp(m * 0.085, 7, 11);
  if (!has(n, 'nowords') && m >= 50) {
    const at = (k: string, dx: number, dy: number, anchor: 'start' | 'end' | 'middle') => {
      const [px, py] = P(k);
      parts.push(txt(px + dx, py + dy, k, fs, '#333333', { italic: true, anchor }));
    };
    at('man', 0, fs * 1.05, 'middle');
    at('woman', -r * 2, 0, 'end');
    at('king', r * 2, 0, 'start');
    at('queen', r * 2, 0, 'start');
  }
  return parts;
}

function vectordbParts(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = inkOf(n);
  const ry = Math.min(h * 0.15, 14);
  const rx = w / 2, cx = x + rx, top = y + ry, bot = y + h - ry;
  const body: Cmd[] = [
    ['M', x, top], ['L', x, bot],
    ['C', x, bot + K * ry, cx - K * rx, bot + ry, cx, bot + ry],
    ['C', cx + K * rx, bot + ry, x + w, bot + K * ry, x + w, bot],
    ['L', x + w, top],
    ['C', x + w, top - K * ry, cx + K * rx, top - ry, cx, top - ry],
    ['C', cx - K * rx, top - ry, x, top - K * ry, x, top], ['Z'],
  ];
  const rim: Cmd[] = [['M', x, top], ['C', x, top + K * ry, cx - K * rx, top + ry, cx, top + ry], ['C', cx + K * rx, top + ry, x + w, top + K * ry, x + w, top]];
  const parts: Part[] = [{ kind: 'path', fill, cmds: body }, { kind: 'path', fill: 'none', cmds: rim }];
  const rows = clamp(Math.round(n.count), 1, 8);
  const y0 = top + ry * 1.5, y1 = bot + ry * 0.2;
  const slot = (y1 - y0) / rows;
  const rh = Math.min(slot * 0.62, 12);
  const cols = 6;
  const vw = w * 0.66, vx = cx - vw / 2;
  const rand = rng(rows * 5 + 1);
  for (let j = 0; j < rows; j++) {
    const vy = y0 + slot * j + (slot - rh) / 2;
    for (let i = 0; i < cols; i++) parts.push(box(vx + (vw * i) / cols, vy, vw / cols, rh, shade(ink, 0.88 - 0.62 * rand()), 'none'));
    parts.push(box(vx, vy, vw, rh, 'none', shade(ink, -0.1), 0.7));
  }
  return parts;
}

const CHUNK_TABS = ['#6C8EBF', '#D79B00', '#82B366', '#9673A6', '#B85450', '#45A29E'];

function chunkParts(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const k = clamp(Math.round(n.count), 2, 8);
  const horizontal = has(n, 'row') || (!has(n, 'col') && w > h * 1.5);
  const gap = Math.min(6, (horizontal ? w : h) * 0.05);
  const parts: Part[] = [];
  for (let i = 0; i < k; i++) {
    const cw = horizontal ? (w - gap * (k - 1)) / k : w;
    const ch = horizontal ? h : (h - gap * (k - 1)) / k;
    const cx = horizontal ? x + i * (cw + gap) : x;
    const cy = horizontal ? y : y + i * (ch + gap);
    const r = Math.min(n.radius, 3, cw / 4, ch / 4);
    const tab = Math.max(2.5, Math.min(cw, ch) * (horizontal ? 0.12 : 0.1));
    parts.push({ kind: 'rect', x: cx, y: cy, w: cw, h: ch, r, fill });
    parts.push(box(cx + 0.6, cy + 0.6, horizontal ? cw - 1.2 : tab, horizontal ? tab : ch - 1.2, CHUNK_TABS[i % CHUNK_TABS.length], 'none', undefined, Math.max(0, r - 0.6)));
    const lx0 = horizontal ? cx + cw * 0.14 : cx + tab + cw * 0.08;
    const lx1 = cx + cw * 0.88;
    const ly0 = horizontal ? cy + tab + ch * 0.14 : cy + ch * 0.32;
    const ly1 = horizontal ? cy + ch * 0.86 : cy + ch * 0.7;
    const nl = clamp(Math.floor((ly1 - ly0) / 6) + 1, 1, horizontal ? 6 : 2);
    const lines: Cmd[] = [];
    for (let j = 0; j < nl; j++) {
      const ly = nl === 1 ? (ly0 + ly1) / 2 : ly0 + ((ly1 - ly0) * j) / (nl - 1);
      lines.push(...seg([lx0, ly], [j === nl - 1 && nl > 1 ? lx0 + (lx1 - lx0) * 0.6 : lx1, ly]));
    }
    parts.push(line(lines, '#A3AAB3', clamp(ch * 0.07, 1, 1.6)));
  }
  return parts;
}

/** Fumetto con la coda in basso a destra (right) o a sinistra, contorno unico. */
function bubblePath(x: number, y: number, w: number, h: number, r: number, right: boolean, tail: number): Cmd[] {
  const a = Math.min(r, w / 2, h / 2);
  const k = a - K * a;
  const X = (u: number) => (right ? x + u : x + w - u);
  const cmds: Cmd[] = [
    ['M', X(a), y], ['L', X(w - a), y],
    ['C', X(w - k), y, X(w), y + k, X(w), y + a],
    ['L', X(w), y + h - a * 1.2],
    ['L', X(w + tail), y + h],
    ['L', X(a), y + h],
    ['C', X(k), y + h, X(0), y + h - k, X(0), y + h - a],
    ['L', X(0), y + a],
    ['C', X(0), y + k, X(k), y, X(a), y],
    ['Z'],
  ];
  return cmds;
}

function chatParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const M = clamp(Math.round(n.count), 2, 8);
  const pad = Math.min(w, h) * 0.06;
  const ar = clamp(Math.min(w, h) * 0.055, 3.5, 9);
  const gap = ar * 0.6;
  const sh = (h - 2 * pad) / M;
  const parts: Part[] = [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, 8), fill: n.fill }];
  for (let i = 0; i < M; i++) {
    const user = i % 2 === 0;
    const bh = sh * 0.74;
    const by = y + pad + i * sh + (sh - bh) / 2;
    const avail = w - 2 * pad - 2 * ar - gap;
    const bw = avail * (user ? 0.66 : 0.86);
    const acx = user ? x + w - pad - ar : x + pad + ar;
    const acy = by + bh - ar;
    const bx = user ? acx - ar - gap - bw : acx + ar + gap;
    const c = user ? { fill: '#DAE8FC', stroke: '#6C8EBF' } : { fill: '#F1F3F5', stroke: '#9AA3AD' };
    const rr = Math.min(bh / 2, 7);
    parts.push(area(bubblePath(bx, by, bw, bh, rr, user, gap * 0.9), c.fill, c.stroke, 0.9));
    const nl = bh > 18 ? 2 : 1;
    const lines: Cmd[] = [];
    for (let j = 0; j < nl; j++) {
      const ly = nl === 1 ? by + bh / 2 : by + bh * (0.36 + 0.3 * j);
      lines.push(...seg([bx + Math.min(rr, bw * 0.1) + 2, ly], [bx + bw * (j === nl - 1 && nl > 1 ? 0.55 : 0.86), ly]));
    }
    parts.push(line(lines, '#9AA0A6', clamp(bh * 0.08, 1, 1.8)));
    parts.push(disc(acx, acy, ar, user ? '#6C8EBF' : '#45A29E'));
    if (user) parts.push(disc(acx, acy - ar * 0.22, ar * 0.32, '#FFFFFF'), area([['M', acx - ar * 0.55, acy + ar * 0.62], ['C', acx - ar * 0.5, acy + ar * 0.1, acx + ar * 0.5, acy + ar * 0.1, acx + ar * 0.55, acy + ar * 0.62], ['Z']], '#FFFFFF'));
    else parts.push(area(sparkle(acx, acy, ar * 0.62), '#FFFFFF'));
  }
  return parts;
}

function wrench(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const m = Math.min(w, h);
  const cx = x + w / 2, cy = y + h / 2;
  // chiave a forchetta lungo l'asse x locale, poi ruotata di -45°
  const L = 1.0, R = 0.24, t = 0.085, nw = 0.1, depth = 0.16;
  const hc = L * 0.5 - R * 0.55;
  const pts: P2[] = [];
  const arcPts = (a0: number, a1: number, cxl: number, r: number, k = 10) => {
    for (let i = 0; i <= k; i++) {
      const a = a0 + ((a1 - a0) * i) / k;
      pts.push([cxl + r * Math.cos(a), r * Math.sin(a)]);
    }
  };
  const left = -L * 0.5 + t;
  arcPts(Math.PI / 2, (Math.PI * 3) / 2, left, t, 6);
  const aTop = -(Math.PI - Math.asin(t / R));
  const aNotch = -Math.asin(nw / R);
  arcPts(aTop, aNotch, hc, R);
  const xn = hc + Math.sqrt(R * R - nw * nw);
  pts.push([xn - depth, -nw], [xn - depth, nw]);
  arcPts(-aNotch, -aTop, hc, R);
  const rot = -Math.PI / 4;
  const c = Math.cos(rot), s = Math.sin(rot);
  const sc = m * 0.98;
  const T = ([u, v]: P2): P2 => [cx + (c * u - s * v) * sc, cy + (s * u + c * v) * sc];
  const hole = T([left, 0]);
  return [
    { kind: 'path', fill, cmds: poly(pts.map(T)) },
    { kind: 'ellipse', cx: hole[0], cy: hole[1], rx: t * sc * 0.45, ry: t * sc * 0.45, fill: '#FFFFFF' },
  ];
}

function toolParts(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = inkOf(n);
  const sw = n.strokeWidth;
  const kind = ['code', 'calc', 'web'].find((k) => has(n, k)) ?? 'wrench';
  const X = (u: number) => x + u * w;
  const Y = (v: number) => y + v * h;
  const r = Math.min(n.radius, Math.min(w, h) * 0.18);
  if (kind === 'code') {
    return [
      { kind: 'rect', x, y, w, h, r, fill },
      line([['M', X(0.36), Y(0.32)], ['L', X(0.18), Y(0.5)], ['L', X(0.36), Y(0.68)]], shade(ink, -0.2), sw * 1.8),
      line([['M', X(0.64), Y(0.32)], ['L', X(0.82), Y(0.5)], ['L', X(0.64), Y(0.68)]], shade(ink, -0.2), sw * 1.8),
      line(seg([X(0.56), Y(0.24)], [X(0.44), Y(0.76)]), shade(ink, -0.2), sw * 1.8),
    ];
  }
  if (kind === 'calc') {
    const parts: Part[] = [{ kind: 'rect', x: X(0.12), y, w: w * 0.76, h, r, fill }, box(X(0.22), Y(0.09), w * 0.56, h * 0.2, '#E8F3E8', ink, sw * 0.7, 1.5)];
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 3; i++) {
        const accent = i === 2 && j >= 2;
        parts.push(box(X(0.22 + i * 0.2), Y(0.38 + j * 0.15), w * 0.15, h * 0.11, accent ? '#FFD8A8' : '#FFFFFF', shade(ink, 0.1), sw * 0.6, 1.2));
      }
    return parts;
  }
  if (kind === 'web') {
    const bar = h * 0.2;
    const mr = Math.min(w, h) * 0.14;
    const mc: P2 = [X(0.44), Y(0.58)];
    return [
      { kind: 'rect', x, y, w, h, r, fill },
      area(rr4(x, y, w, bar, [r, r, 0, 0]), shade(fill === 'none' ? '#DDDDDD' : fill, -0.1), 'none'),
      line(seg([x, y + bar], [x + w, y + bar]), ink, sw * 0.8),
      disc(x + bar * 0.6, y + bar / 2, bar * 0.17, '#E5484D'),
      disc(x + bar * 1.1, y + bar / 2, bar * 0.17, '#FFC53D'),
      disc(x + bar * 1.6, y + bar / 2, bar * 0.17, '#46A758'),
      line(seg([mc[0] + mr * 0.7, mc[1] + mr * 0.7], [mc[0] + mr * 1.6, mc[1] + mr * 1.6]), shade(ink, -0.2), sw * 2),
      { kind: 'ellipse', cx: mc[0], cy: mc[1], rx: mr, ry: mr, fill: '#FFFFFF', stroke: shade(ink, -0.2), sw: sw * 1.4, solid: true },
    ];
  }
  return wrench(n);
}

function llmParts(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const S = clamp(Math.round(n.count), 2, 10);
  const d = Math.min(w, h) * 0.16;
  const gap = clamp(h * 0.035, 1.5, 4);
  const sh = (h - d - gap * (S - 1)) / S;
  const fw = w - d;
  const light = fill === 'none' ? 'none' : shade(fill, 0.45);
  const dark = fill === 'none' ? 'none' : shade(fill, -0.12);
  const parts: Part[] = [];
  for (let i = S - 1; i >= 0; i--) {
    const fy = y + d + i * (sh + gap);
    const front = i === 0 && fill !== 'none' ? shade(fill, -0.05) : fill;
    parts.push({ kind: 'path', fill: light, cmds: poly([[x, fy], [x + d, fy - d], [x + fw + d, fy - d], [x + fw, fy]]) });
    parts.push({ kind: 'path', fill: dark, cmds: poly([[x + fw, fy], [x + fw + d, fy - d], [x + fw + d, fy - d + sh], [x + fw, fy + sh]]) });
    parts.push({ kind: 'rect', x, y: fy, w: fw, h: sh, r: 0, fill: front });
  }
  return parts;
}

function kvParts(n: N): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = inkOf(n);
  const cached = clamp(Math.round(n.count), 1, 12);
  const rows = cached + 2;
  const cols = 4;
  const gap = w * 0.12;
  const bw = (w - gap) / 2;
  // intestazioni K e V sopra i due blocchi, se c'è spazio
  const hs = clamp(h * 0.13, 8, 13);
  const header = !has(n, 'nolabels') && h >= 40 && bw >= 14;
  const top = header ? y + hs * 1.35 : y;
  const rh = (y + h - top) / rows;
  const parts: Part[] = [];
  [0, 1].forEach((b) => {
    const bx = x + b * (bw + gap);
    if (header) parts.push(txt(bx + bw / 2, y + hs * 0.6, b === 0 ? '$K$' : '$V$', hs, shade(ink, -0.4)));
    const base = b === 0 || fill === 'none' ? fill : shade(fill, -0.08);
    for (let j = 0; j < rows; j++) {
      const ry = top + j * rh;
      const kind = j < cached ? 'old' : j === cached ? 'new' : 'free';
      const f = kind === 'old' ? base : kind === 'new' ? '#FFE6CC' : 'none';
      const s = kind === 'old' ? ink : kind === 'new' ? '#D79B00' : '#C6CBD2';
      if (kind === 'free') {
        const dl: Cmd[] = [];
        for (const [a, c] of [[[bx, ry], [bx + bw, ry]], [[bx, ry + rh], [bx + bw, ry + rh]], [[bx, ry], [bx, ry + rh]], [[bx + bw, ry], [bx + bw, ry + rh]]] as [P2, P2][])
          dl.push(...dashes(a, c, 3, 2.5));
        parts.push(line(dl, s, n.strokeWidth * 0.8));
        continue;
      }
      parts.push(box(bx, ry, bw, rh, f, s, n.strokeWidth));
      const vl: Cmd[] = [];
      for (let i = 1; i < cols; i++) vl.push(...seg([bx + (bw * i) / cols, ry], [bx + (bw * i) / cols, ry + rh]));
      parts.push(line(vl, s, n.strokeWidth * 0.5));
    }
  });
  return parts;
}

const GAUGE = ['#E5484D', '#F76B15', '#FFC53D', '#94C354', '#2F9E44'];

function gaugeParts(n: N): Part[] {
  const { x, y, w, h } = n;
  const ink = inkOf(n);
  // con il punteggio scritto sotto il perno il quadrante si alza per fargli posto
  const Rs = Math.min(w / 2, h / 1.46);
  const score = !has(n, 'noscore') && Rs * 0.28 >= 6;
  const R = score ? Rs : Math.min(w / 2, h * 0.9);
  const cx = x + w / 2, cy = score ? y + (h - R * 1.46) / 2 + R : y + h * 0.5 + R * 0.45;
  const ri = R * 0.62;
  const parts: Part[] = [];
  GAUGE.forEach((c, i) => {
    const a0 = Math.PI + (Math.PI * i) / GAUGE.length;
    const a1 = Math.PI + (Math.PI * (i + 1)) / GAUGE.length;
    const outer = arc(cx, cy, R, a0, a1);
    const inner = arc(cx, cy, ri, a1, a0);
    const cmds: Cmd[] = [...outer, ['L', inner[0][1] as number, inner[0][2] as number], ...inner.slice(1), ['Z']];
    parts.push(area(cmds, n.fill === 'none' ? 'none' : c, '#FFFFFF', 0.8));
  });
  parts.push({ kind: 'path', fill: 'none', cmds: [...arc(cx, cy, R, Math.PI, Math.PI * 2), ['L', cx + ri, cy], ...arc(cx, cy, ri, Math.PI * 2, Math.PI).slice(1), ['Z']] });
  const v = clamp(specNumber(n, 0.78), 0, 1);
  const a = Math.PI + v * Math.PI;
  const L = R * 0.86, b = R * 0.07;
  const tip: P2 = [cx + L * Math.cos(a), cy + L * Math.sin(a)];
  const nx = -Math.sin(a) * b, ny = Math.cos(a) * b;
  parts.push(area(poly([tip, [cx + nx, cy + ny], [cx - nx, cy - ny]]), shade(ink, -0.35)));
  parts.push(disc(cx, cy, R * 0.11, shade(ink, -0.35)));
  if (score) parts.push(txt(cx, cy + R * 0.12 + R * 0.28 * 0.62, v.toFixed(2), R * 0.28, shade(ink, -0.4), { bold: true }));
  return parts;
}

const GRID_SIZES: SpecGroup = {
  title: 'Griglia',
  choices: [
    { value: '3x4', label: '3×4 (R&N)' },
    { value: '4x4', label: '4×4' },
    { value: '5x5', label: '5×5' },
    { value: '5x6', label: '5×6' },
    { value: '6x8', label: '6×8' },
    { value: '8x8', label: '8×8' },
  ],
};
const GRID = { specLabel: 'Righe x colonne', countLabel: 'Muri', countMax: 16 };

export const RLNLP_SHAPES: ShapeDef[] = [
  { kind: 'rl-gridworld', name: 'Grid world', parts: (n) => gridParts(n, 'world'), ...GRID, specOptions: [GRID_SIZES] },
  {
    kind: 'rl-valuegrid',
    name: 'Funzione valore (griglia)',
    parts: (n) => gridParts(n, 'value'),
    ...GRID,
    specOptions: [GRID_SIZES, { title: 'Valori', mode: 'many', choices: [{ value: 'num3', label: '3 decimali' }, { value: 'novalues', label: 'Senza numeri' }] }],
  },
  {
    kind: 'rl-policygrid',
    name: 'Policy (frecce su griglia)',
    parts: (n) => gridParts(n, 'policy'),
    ...GRID,
    specOptions: [GRID_SIZES, { mode: 'many', choices: [{ value: 'novalues', label: 'Senza ±1' }] }],
  },
  {
    kind: 'rl-env',
    name: 'Ambiente RL',
    parts: envParts,
    specLabel: 'Variante',
    specOptions: [{ choices: [{ value: 'globe', label: 'Globo' }, { value: 'atari', label: 'Atari' }, { value: 'cartpole', label: 'CartPole' }, { value: 'go', label: 'Go' }] }],
  },
  {
    kind: 'rl-reward',
    name: 'Ricompensa',
    parts: rewardParts,
    specLabel: 'Variante',
    specOptions: [{ choices: [{ value: 'star', label: 'Stella' }, { value: 'trophy', label: 'Trofeo' }] }],
  },
  {
    kind: 'rl-replay',
    name: 'Replay buffer',
    parts: replayParts,
    countLabel: 'Transizioni',
    countMax: 12,
    specLabel: 'Opzioni',
    specOptions: [{ mode: 'many', choices: [{ value: 'noheader', label: "Senza (s, a, r, s')" }] }],
  },
  {
    kind: 'rl-mcts',
    name: 'Albero MCTS',
    parts: mctsParts,
    countLabel: 'Profondità',
    countMax: 4,
    specLabel: 'Fase',
    specOptions: [
      { title: 'Fase', choices: [{ value: 'select', label: 'Selezione' }, { value: 'expand', label: 'Espansione' }, { value: 'backup', label: 'Backup' }, { value: 'play', label: 'Mossa' }] },
      { mode: 'many', choices: [{ value: 'counts', label: 'Visite N' }] },
    ],
  },
  { kind: 'rl-curve', name: 'Curva di return', parts: curveParts, countLabel: 'Curve', countMax: 3 },
  {
    kind: 'nlp-tokens',
    name: 'Token (chip)',
    parts: tokenParts,
    specLabel: 'Token separati da | (##: subword)',
    specOptions: [
      {
        title: 'Esempi',
        mode: 'value',
        choices: [
          { value: 'The|cat|sat|on|the|mat', label: 'Frase' },
          { value: '[CLS]|token|##ization|is|fun|[SEP]', label: 'WordPiece' },
          { value: '<s>|Hello|,|world|!|</s>', label: 'BPE' },
          { value: '[CLS]|the|[MASK]|sat|[SEP]', label: 'Masked LM' },
          { value: '', label: 'Vuoti' },
        ],
      },
    ],
  },
  {
    kind: 'nlp-embspace',
    name: 'Spazio di embedding (analogie)',
    parts: embspaceParts,
    specLabel: 'Opzioni',
    specOptions: [{ mode: 'many', choices: [{ value: 'nowords', label: 'Senza parole' }] }],
  },
  { kind: 'nlp-vectordb', name: 'Vector database', parts: vectordbParts, countLabel: 'Righe', countMax: 8 },
  {
    kind: 'nlp-chunks',
    name: 'Chunk di documento',
    parts: chunkParts,
    countLabel: 'Chunk',
    countMax: 8,
    specLabel: 'Disposizione',
    specOptions: [{ choices: [{ value: 'col', label: 'Colonna' }, { value: 'row', label: 'Riga' }] }],
  },
  { kind: 'nlp-chat', name: 'Chat (trascrizione)', parts: chatParts, countLabel: 'Messaggi', countMax: 8 },
  {
    kind: 'nlp-tool',
    name: 'Tool / function call',
    parts: toolParts,
    specLabel: 'Variante',
    specOptions: [{ choices: [{ value: 'wrench', label: 'Chiave' }, { value: 'code', label: 'Codice' }, { value: 'calc', label: 'Calcolatrice' }, { value: 'web', label: 'Ricerca web' }] }],
  },
  { kind: 'nlp-llm', name: 'LLM (strati)', parts: llmParts, countLabel: 'Strati', countMax: 10 },
  {
    kind: 'nlp-kvcache',
    name: 'KV cache',
    parts: kvParts,
    countLabel: 'Token in cache',
    countMax: 12,
    specLabel: 'Opzioni',
    specOptions: [{ mode: 'many', choices: [{ value: 'nolabels', label: 'Senza K/V' }] }],
  },
  {
    kind: 'nlp-gauge',
    name: 'Punteggio (gauge)',
    parts: gaugeParts,
    specLabel: 'Valore (0-1)',
    specOptions: [
      { title: 'Valore', choices: ['0.1', '0.35', '0.5', '0.8', '0.95'] },
      { mode: 'many', choices: [{ value: 'noscore', label: 'Senza numero' }] },
    ],
  },
];
