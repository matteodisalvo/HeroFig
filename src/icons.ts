// Oggetti compositi ricorrenti nelle figure dei paper: architetture in miniatura
// (U-Net, CNN, RNN, FPN...), grafici, icone. Come le forme base, sono descritti con
// primitive `Part`, quindi escono identici in SVG, PDF, PNG e TikZ.
import { orient, parseGrid, poly, rng, shade, type Cmd, type Part } from './geometry';
import { medicalParts } from './medical';
import type { NodeModel } from './model';

type P2 = [number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];

/** Arco di circonferenza (angoli in radianti, y verso il basso) come curve di Bézier. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number): Cmd[] {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2)));
  const da = (a1 - a0) / n;
  const k = (4 / 3) * Math.tan(da / 4);
  const cmds: Cmd[] = [['M', cx + r * Math.cos(a0), cy + r * Math.sin(a0)]];
  for (let i = 0; i < n; i++) {
    const a = a0 + da * i;
    const b = a + da;
    cmds.push([
      'C',
      cx + r * (Math.cos(a) - k * Math.sin(a)), cy + r * (Math.sin(a) + k * Math.cos(a)),
      cx + r * (Math.cos(b) + k * Math.sin(b)), cy + r * (Math.sin(b) - k * Math.cos(b)),
      cx + r * Math.cos(b), cy + r * Math.sin(b),
    ]);
  }
  return cmds;
}

function head(tip: P2, dx: number, dy: number, size: number, color: string): Part {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const bx = tip[0] - ux * size, by = tip[1] - uy * size;
  const hw = size * 0.42;
  return { kind: 'path', fill: color, stroke: 'none', cmds: poly([tip, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]) };
}

function arrow(a: P2, b: P2, color: string, sw: number, size = 5): Part[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const cut = Math.min(size * 0.8, l * 0.5);
  const end: P2 = [b[0] - ((b[0] - a[0]) / l) * cut, b[1] - ((b[1] - a[1]) / l) * cut];
  return [
    { kind: 'path', fill: 'none', cmds: seg(a, end), stroke: color, sw, solid: true },
    head(b, b[0] - a[0], b[1] - a[1], size, color),
  ];
}

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  if (Number.isNaN(pa) || Number.isNaN(pb)) return a;
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1).toUpperCase();
}

/** Percorso in coordinate unitarie [0,1]² del riquadro: prima riga M, le altre curve C. */
function unit(x: number, y: number, w: number, h: number, rows: number[][], close = true): Cmd[] {
  const X = (u: number) => x + u * w;
  const Y = (v: number) => y + v * h;
  const cmds: Cmd[] = rows.map((r) =>
    r.length === 2 ? ['M', X(r[0]), Y(r[1])] : ['C', X(r[0]), Y(r[1]), X(r[2]), Y(r[3]), X(r[4]), Y(r[5])],
  );
  if (close) cmds.push(['Z']);
  return cmds;
}

function imageIcon(x: number, y: number, w: number, h: number, ink: string): Part[] {
  const sun = Math.min(w, h) * 0.09;
  return [
    { kind: 'ellipse', cx: x + w * 0.72, cy: y + h * 0.28, rx: sun, ry: sun, fill: ink, stroke: 'none' },
    {
      kind: 'path', fill: ink, stroke: 'none',
      cmds: poly([[x + w * 0.1, y + h * 0.86], [x + w * 0.37, y + h * 0.42], [x + w * 0.54, y + h * 0.68], [x + w * 0.67, y + h * 0.52], [x + w * 0.9, y + h * 0.86]]),
    },
  ];
}

const CLUSTERS: { c: P2; fill: string; stroke: string }[] = [
  { c: [0.3, 0.36], fill: '#DAE8FC', stroke: '#6C8EBF' },
  { c: [0.7, 0.3], fill: '#FFE6CC', stroke: '#D79B00' },
  { c: [0.55, 0.74], fill: '#D5E8D4', stroke: '#82B366' },
];

const RGB = [
  { fill: '#F8CECC', stroke: '#B85450' },
  { fill: '#D5E8D4', stroke: '#82B366' },
  { fill: '#DAE8FC', stroke: '#6C8EBF' },
];

export function iconParts(n: NodeModel): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = n.stroke === 'none' ? '#555555' : n.stroke;
  const sw = n.strokeWidth;
  const m = Math.min(w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const X = (u: number) => x + u * w;
  const Y = (v: number) => y + v * h;
  const dot = (u: number, v: number, r: number, f: string, outlined = false): Part => ({
    kind: 'ellipse', cx: X(u), cy: Y(v), rx: r, ry: r, fill: f, stroke: outlined ? undefined : 'none',
  });
  const strokePath = (cmds: Cmd[], width = sw, color: string | undefined = undefined): Part => ({
    kind: 'path', fill: 'none', cmds, sw: width, stroke: color, solid: true,
  });

  switch (n.shape) {
    // ---------- architetture ----------
    case 'unet': {
      const L = clamp(n.count, 2, 5);
      const cols = 2 * L - 1;
      const bw = (w / cols) * 0.5;
      const hl = (l: number) => h * 0.55 * 0.72 ** l;
      const top = (l: number) => y + ((h - hl(L - 1)) * l) / (L - 1);
      const bars = Array.from({ length: cols }, (_, j) => {
        const l = j < L ? j : cols - 1 - j;
        return { l, bx: x + ((w - bw) * j) / (cols - 1), by: top(l), bh: hl(l) };
      });
      const parts: Part[] = [];
      for (let j = 1; j < cols; j++) {
        const a = bars[j - 1], b = bars[j];
        parts.push(strokePath(seg([a.bx + bw, a.by + a.bh / 2], [b.bx, b.by + b.bh / 2]), sw * 0.6));
      }
      for (let l = 0; l < L - 1; l++) {
        const a = bars[l], b = bars[cols - 1 - l];
        parts.push(...arrow([a.bx + bw, a.by + a.bh * 0.25], [b.bx, b.by + b.bh * 0.25], shade(ink, 0.25), sw * 0.6, 4));
      }
      for (const b of bars) parts.push({ kind: 'rect', x: b.bx, y: b.by, w: bw, h: b.bh, r: 1.5, fill: b.l === L - 1 && fill !== 'none' ? shade(fill, -0.12) : fill });
      return parts;
    }
    case 'cnn': {
      const S = clamp(n.count, 2, 5);
      const d = 4;
      const stages = Array.from({ length: S }, (_, s) => ({ size: h * 0.82 * (1 - 0.2 * s), sheets: 2 + s }));
      const widths = stages.map((s) => s.size * 0.6 + (s.sheets - 1) * d);
      const gap = (w - widths.reduce((a, b) => a + b, 0)) / (S - 1);
      const parts: Part[] = [];
      let px = x;
      stages.forEach((st, s) => {
        const sh = st.size - (st.sheets - 1) * d;
        const top = cy - st.size / 2;
        for (let i = st.sheets - 1; i >= 0; i--) {
          parts.push({ kind: 'rect', x: px + i * d, y: top + (st.sheets - 1 - i) * d, w: st.size * 0.6, h: sh, r: 0, fill, sw: sw * 0.8 });
        }
        if (s < S - 1) parts.push(...arrow([px + widths[s] + gap * 0.2, cy], [px + widths[s] + gap * 0.8, cy], ink, sw * 0.7, 4));
        px += widths[s] + gap;
      });
      return parts;
    }
    case 'pyramid': {
      const L = clamp(n.count, 2, 5);
      const slot = h / L;
      const ph = slot * 0.72;
      return Array.from({ length: L }, (_, i): Part => {
        const wi = w * (1 - 0.2 * i);
        const sk = wi * 0.16;
        const ty = y + h - (i + 1) * slot + (slot - ph) / 2;
        return {
          kind: 'path',
          fill: fill === 'none' ? 'none' : shade(fill, -0.06 * i),
          cmds: poly([[cx - wi / 2 + sk, ty], [cx + wi / 2, ty], [cx + wi / 2 - sk, ty + ph], [cx - wi / 2, ty + ph]]),
        };
      });
    }
    case 'rnn': {
      const C = clamp(n.count, 2, 6);
      const cw = (w / C) * 0.58;
      const chh = h * 0.36;
      const parts: Part[] = [];
      for (let i = 0; i < C; i++) {
        const ccx = x + (w * (i + 0.5)) / C;
        parts.push(...arrow([ccx, y + h], [ccx, cy + chh / 2], ink, sw * 0.7, 4));
        parts.push(...arrow([ccx, cy - chh / 2], [ccx, y], ink, sw * 0.7, 4));
        if (i < C - 1) parts.push(...arrow([ccx + cw / 2, cy], [ccx + w / C - cw / 2, cy], ink, sw * 0.7, 4));
        parts.push({ kind: 'rect', x: ccx - cw / 2, y: cy - chh / 2, w: cw, h: chh, r: 3, fill });
      }
      return parts;
    }
    case 'bipartite': {
      const C = clamp(n.count, 2, 8);
      const ch = h * 0.2;
      const cw = (w / C) * 0.8;
      const rand = rng(C * 13 + 5);
      const parts: Part[] = [];
      const ccx = (i: number) => x + (w * (i + 0.5)) / C;
      for (let i = 0; i < C; i++)
        for (let j = 0; j < C; j++) {
          const t = rand() ** 3 + (i === j ? 0.35 : 0);
          parts.push(strokePath(seg([ccx(i), y + ch], [ccx(j), y + h - ch]), 0.25 + 2.2 * Math.min(1, t), shade(ink, 0.75 - 0.75 * Math.min(1, t))));
        }
      for (let i = 0; i < C; i++) {
        parts.push({ kind: 'rect', x: ccx(i) - cw / 2, y, w: cw, h: ch, r: 2, fill });
        parts.push({ kind: 'rect', x: ccx(i) - cw / 2, y: y + h - ch, w: cw, h: ch, r: 2, fill });
      }
      return parts;
    }
    case 'bottleneck': {
      const o = orient(n);
      const g = o.W * 0.07;
      const a = o.H * 0.32;
      const mid = fill === 'none' ? 'none' : shade(fill, -0.15);
      return [
        { kind: 'path', fill, cmds: poly([o.at(0, 0), o.at(o.W / 2 - g, a), o.at(o.W / 2 - g, o.H - a), o.at(0, o.H)]) },
        { kind: 'path', fill, cmds: poly([o.at(o.W, 0), o.at(o.W / 2 + g, a), o.at(o.W / 2 + g, o.H - a), o.at(o.W, o.H)]) },
        { kind: 'path', fill: mid, cmds: poly([o.at(o.W / 2 - g, a), o.at(o.W / 2 + g, a), o.at(o.W / 2 + g, o.H - a), o.at(o.W / 2 - g, o.H - a)]) },
      ];
    }
    case 'tree': {
      const D = clamp(n.count, 2, 4);
      const r = Math.min(w / 2 ** (D - 1), h / D) * 0.3;
      const pos = (l: number, i: number): P2 => [x + (w * (i + 0.5)) / 2 ** l, y + r + ((h - 2 * r) * l) / (D - 1)];
      const lines: Cmd[] = [];
      const nodes: Part[] = [];
      for (let l = 0; l < D; l++)
        for (let i = 0; i < 2 ** l; i++) {
          const p = pos(l, i);
          if (l < D - 1) lines.push(...seg(p, pos(l + 1, 2 * i)), ...seg(p, pos(l + 1, 2 * i + 1)));
          nodes.push({ kind: 'ellipse', cx: p[0], cy: p[1], rx: r, ry: r, fill: l === D - 1 && fill !== 'none' ? shade(fill, 0.5) : fill });
        }
      return [strokePath(lines, sw * 0.8), ...nodes];
    }
    // ---------- visione ----------
    case 'kernel': {
      const [rows, cols] = parseGrid(n.spec, 5);
      const k = clamp(n.count, 1, Math.min(rows, cols));
      const off = rows > k && cols > k ? 1 : 0;
      const cw = w / cols, ch = h / rows;
      const lines: Cmd[] = [];
      for (let i = 1; i < cols; i++) lines.push(...seg([x + cw * i, y], [x + cw * i, y + h]));
      for (let j = 1; j < rows; j++) lines.push(...seg([x, y + ch * j], [x + w, y + ch * j]));
      return [
        { kind: 'rect', x, y, w, h, r: 0, fill },
        { kind: 'rect', x: x + off * cw, y: y + off * ch, w: k * cw, h: k * ch, r: 0, fill: shade(ink, 0.5), stroke: 'none' },
        strokePath(lines, sw * 0.6),
        { kind: 'rect', x, y, w, h, r: 0, fill: 'none' },
        { kind: 'rect', x: x + off * cw, y: y + off * ch, w: k * cw, h: k * ch, r: 0, fill: 'none', sw: sw * 1.7, solid: true },
      ];
    }
    case 'rgb': {
      const d = 8;
      return [2, 1, 0].map((i): Part => ({
        kind: 'rect', x: x + i * d, y: y + (2 - i) * d, w: w - 2 * d, h: h - 2 * d, r: 0, fill: RGB[i].fill, stroke: RGB[i].stroke,
      }));
    }
    case 'frames': {
      const d = 6;
      const fw = w - 2 * d, fh = h - 2 * d;
      const parts: Part[] = [2, 1, 0].map((i): Part => ({ kind: 'rect', x: x + i * d, y: y + (2 - i) * d, w: fw, h: fh, r: 0, fill }));
      return [...parts, ...imageIcon(x, y + 2 * d, fw, fh, shade(ink, 0.25))];
    }
    case 'mask':
      return [
        { kind: 'rect', x, y, w, h, r: Math.min(n.radius, m / 2), fill },
        {
          kind: 'path', fill: shade(ink, 0.15), stroke: 'none',
          cmds: unit(x, y, w, h, [[0.3, 0.25], [0.5, 0.1, 0.8, 0.25, 0.75, 0.5], [0.72, 0.7, 0.85, 0.85, 0.6, 0.85], [0.4, 0.85, 0.2, 0.8, 0.22, 0.55], [0.23, 0.4, 0.2, 0.32, 0.3, 0.25]]),
        },
      ];
    case 'detection':
      return [
        { kind: 'rect', x, y, w, h, r: Math.min(n.radius, m / 2), fill },
        ...imageIcon(x, y, w, h, shade(ink, 0.35)),
        { kind: 'rect', x: X(0.08), y: Y(0.36), w: w * 0.5, h: h * 0.54, r: 0, fill: 'none', stroke: '#E5484D', sw: 1.6, solid: true },
        { kind: 'rect', x: X(0.58), y: Y(0.12), w: w * 0.3, h: h * 0.32, r: 0, fill: 'none', stroke: '#2F9E44', sw: 1.6, solid: true },
      ];
    // ---------- generativi ----------
    case 'diffchain': {
      const S = clamp(n.count, 2, 6);
      const s = Math.min(h, w / (S * 1.45));
      const gap = (w - S * s) / (S - 1);
      const G = 6;
      const base = fill === 'none' ? '#DAE8FC' : fill;
      const rand = rng(41);
      const parts: Part[] = [];
      for (let k = 0; k < S; k++) {
        const t = k / (S - 1);
        const sx = x + k * (s + gap), sy = cy - s / 2;
        for (let j = 0; j < G; j++)
          for (let i = 0; i < G; i++) {
            // un "soggetto" sfumato al centro, che il rumore copre man mano
            const blob = Math.exp(-(((i + 0.5) / G - 0.5) ** 2 + ((j + 0.5) / G - 0.55) ** 2) * 9);
            const clean = mix(base, ink, blob * 0.85);
            const noise = mix('#FFFFFF', '#3A3A3A', rand());
            parts.push({ kind: 'rect', x: sx + (s * i) / G, y: sy + (s * j) / G, w: s / G, h: s / G, r: 0, fill: mix(clean, noise, t), stroke: 'none' });
          }
        parts.push({ kind: 'rect', x: sx, y: sy, w: s, h: s, r: 0, fill: 'none' });
        if (k < S - 1) parts.push(...arrow([sx + s + gap * 0.15, cy], [sx + s + gap * 0.85, cy], ink, sw * 0.7, 4));
      }
      return parts;
    }
    case 'dice': {
      const r = m * 0.075;
      return [
        { kind: 'rect', x, y, w, h, r: m * 0.16, fill },
        ...([[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]] as P2[]).map(([u, v]) => dot(u, v, r, ink)),
      ];
    }
    case 'clock': {
      const R = m / 2;
      const ticks: Cmd[] = [0, 1, 2, 3].flatMap((k) => {
        const a = (Math.PI / 2) * k;
        return seg([cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78], [cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9]);
      });
      return [
        { kind: 'ellipse', cx, cy, rx: R, ry: R, fill },
        strokePath(ticks, sw * 0.7),
        strokePath([['M', cx, cy - R * 0.58], ['L', cx, cy], ['L', cx + R * 0.38, cy + R * 0.22]], sw * 1.2),
      ];
    }
    // ---------- grafici ----------
    case 'scatter': {
      const rand = rng(17);
      const r = m * 0.035;
      const parts: Part[] = [
        { kind: 'rect', x, y, w, h, r: Math.min(n.radius, m / 2), fill },
        strokePath([['M', X(0.1), Y(0.08)], ['L', X(0.1), Y(0.9)], ['L', X(0.94), Y(0.9)]], 0.8, '#9AA0A6'),
      ];
      for (const c of CLUSTERS)
        for (let i = 0; i < 8; i++) {
          const a = rand() * Math.PI * 2;
          const d = Math.sqrt(rand()) * 0.13;
          parts.push({ kind: 'ellipse', cx: X(c.c[0] + Math.cos(a) * d), cy: Y(c.c[1] + Math.sin(a) * d), rx: r, ry: r, fill: c.fill, stroke: c.stroke, sw: 0.8, solid: true });
        }
      return parts;
    }
    case 'confmat': {
      const [rows, cols] = parseGrid(n.spec, 5);
      const rand = rng(rows * 17 + cols);
      const parts: Part[] = [];
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const v = i === j ? 0.75 + 0.25 * rand() : rand() * 0.28;
          parts.push({ kind: 'rect', x: x + (w * i) / cols, y: y + (h * j) / rows, w: w / cols, h: h / rows, r: 0, fill: shade(ink, 0.95 - 0.9 * v), stroke: 'none' });
        }
      parts.push({ kind: 'rect', x, y, w, h, r: 0, fill: 'none' });
      return parts;
    }
    // ---------- icone ----------
    case 'posenc': {
      const R = m / 2;
      const pts: P2[] = Array.from({ length: 25 }, (_, i) => {
        const t = -1 + i / 12;
        return [cx + R * 0.6 * t, cy - R * 0.36 * Math.sin(Math.PI * t)];
      });
      return [{ kind: 'ellipse', cx, cy, rx: R, ry: R, fill }, strokePath(poly(pts, false), sw)];
    }
    case 'cycle': {
      const R = m * 0.42;
      const a0 = -Math.PI / 3;
      const a1 = a0 + (Math.PI * 5) / 3 - 0.25;
      const tip: P2 = [cx + R * Math.cos(a1 + 0.25), cy + R * Math.sin(a1 + 0.25)];
      return [strokePath(arc(cx, cy, R, a0, a1), sw * 1.2), head(tip, -Math.sin(a1 + 0.1), Math.cos(a1 + 0.1), Math.max(6, m * 0.22), ink)];
    }
    case 'stopgrad':
      return [strokePath([...seg([X(0.2), Y(1)], [X(0.55), Y(0)]), ...seg([X(0.45), Y(1)], [X(0.8), Y(0)])], sw * 1.3)];
    case 'check':
      return [strokePath([['M', X(0.08), Y(0.55)], ['L', X(0.38), Y(0.88)], ['L', X(0.92), Y(0.12)]], sw * 2)];
    case 'xmark':
      return [strokePath([...seg([X(0.12), Y(0.12)], [X(0.88), Y(0.88)]), ...seg([X(0.88), Y(0.12)], [X(0.12), Y(0.88)])], sw * 2)];
    case 'lock': {
      const r = w * 0.2;
      return [
        strokePath([['M', cx - r, Y(0.46)], ['L', cx - r, Y(0.3)], ...arc(cx, Y(0.3), r, Math.PI, Math.PI * 2).slice(1), ['L', cx + r, Y(0.46)]], sw * 1.5),
        { kind: 'rect', x: X(0.12), y: Y(0.44), w: w * 0.76, h: h * 0.56, r: m * 0.1, fill },
        dot(0.5, 0.7, m * 0.075, ink),
      ];
    }
    case 'gear': {
      const R = m / 2;
      const deg = Math.PI / 180;
      const pts: P2[] = [];
      for (let k = 0; k < 8; k++) {
        const a = k * 45 * deg;
        for (const [rr, da] of [[0.72, -15], [1, -9], [1, 9], [0.72, 15]] as P2[])
          pts.push([cx + R * rr * Math.cos(a + da * deg), cy + R * rr * Math.sin(a + da * deg)]);
      }
      return [
        { kind: 'path', fill, cmds: poly(pts) },
        { kind: 'ellipse', cx, cy, rx: R * 0.3, ry: R * 0.3, fill: '#FFFFFF' },
      ];
    }
    case 'cloud':
      return [
        {
          kind: 'path', fill,
          cmds: unit(x, y, w, h, [[0.24, 0.92], [0.02, 0.92, -0.02, 0.56, 0.18, 0.5], [0.13, 0.2, 0.42, 0.1, 0.5, 0.3], [0.6, 0.02, 0.94, 0.12, 0.84, 0.46], [1.04, 0.52, 1.0, 0.92, 0.78, 0.92]]),
        },
      ];
    case 'user':
      return [
        dot(0.5, 0.26, m * 0.21, fill, true),
        { kind: 'path', fill, cmds: unit(x, y, w, h, [[0.08, 1], [0.08, 0.62, 0.3, 0.54, 0.5, 0.54], [0.7, 0.54, 0.92, 0.62, 0.92, 1]]) },
      ];
    case 'robot': {
      const er = m * 0.07;
      return [
        strokePath(seg([cx, Y(0.3)], [cx, Y(0.14)]), sw),
        dot(0.5, 0.09, m * 0.06, fill, true),
        { kind: 'rect', x: X(0.02), y: Y(0.5), w: w * 0.1, h: h * 0.22, r: 2, fill },
        { kind: 'rect', x: X(0.88), y: Y(0.5), w: w * 0.1, h: h * 0.22, r: 2, fill },
        { kind: 'rect', x: X(0.12), y: Y(0.3), w: w * 0.76, h: h * 0.66, r: m * 0.12, fill },
        dot(0.35, 0.56, er, ink),
        dot(0.65, 0.56, er, ink),
        strokePath(seg([X(0.38), Y(0.78)], [X(0.62), Y(0.78)]), sw),
      ];
    }
    case 'bubble': {
      const bh = h * 0.78;
      const r = Math.min(n.radius, w / 2, bh / 2);
      const k = r * (1 - 0.5523);
      return [
        {
          kind: 'path', fill,
          cmds: [
            ['M', x + r, y], ['L', x + w - r, y], ['C', x + w - k, y, x + w, y + k, x + w, y + r],
            ['L', x + w, y + bh - r], ['C', x + w, y + bh - k, x + w - k, y + bh, x + w - r, y + bh],
            ['L', X(0.34), y + bh], ['L', X(0.14), y + h], ['L', X(0.18), y + bh], ['L', x + r, y + bh],
            ['C', x + k, y + bh, x, y + bh - k, x, y + bh - r], ['L', x, y + r], ['C', x, y + k, x + k, y, x + r, y], ['Z'],
          ],
        },
      ];
    }
    case 'magnifier': {
      const R = m * 0.3;
      const c: P2 = [X(0.4), Y(0.4)];
      const s = Math.SQRT1_2;
      return [
        strokePath(seg([c[0] + R * s, c[1] + R * s], [X(0.4) + m * 0.52, Y(0.4) + m * 0.52]), sw * 2.2),
        { kind: 'ellipse', cx: c[0], cy: c[1], rx: R, ry: R, fill, sw: sw * 1.3 },
      ];
    }
    case 'scan': {
      const sheets = clamp(n.count, 1, 4);
      const d = 6;
      const off = (sheets - 1) * d;
      const fw = w - off, fh = h - off, fy = y + off;
      const parts: Part[] = [];
      for (let i = sheets - 1; i >= 1; i--) parts.push({ kind: 'rect', x: x + i * d, y: fy - i * d, w: fw, h: fh, r: 0, fill });
      const e = (u: number, v: number, ru: number, rv: number, f: string): Part => ({
        kind: 'ellipse', cx: x + fw * u, cy: fy + fh * v, rx: fw * ru, ry: fh * rv, fill: f, stroke: 'none',
      });
      parts.push(
        { kind: 'rect', x, y: fy, w: fw, h: fh, r: 0, fill },
        e(0.5, 0.52, 0.41, 0.36, '#C9CED6'),
        e(0.32, 0.5, 0.12, 0.19, '#4B5563'),
        e(0.68, 0.5, 0.12, 0.19, '#4B5563'),
        e(0.5, 0.74, 0.06, 0.06, '#F5F5F5'),
      );
      if (n.spec === 'seg') parts.push(e(0.7, 0.44, 0.07, 0.09, '#E5484D'), e(0.3, 0.56, 0.05, 0.06, '#FFC53D'));
      return parts;
    }
    default:
      return medicalParts(n);
  }
}
