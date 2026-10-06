// Forme parametriche del modulo Deep learning: illustrazioni ricorrenti nelle figure
// dei paper (dropout, pooling, convoluzione 3D, teste di attention, normalizzazioni...).
// Tutte disegnate con le primitive `Part`, quindi identiche in SVG, PDF, PNG e TikZ.
import { mix, orient, parseGrid, parseLayers, poly, rng, roundPoly, shade, smooth, framed, type Box, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import { textWidth } from '../geometry';
import type { ShapeDef, SpecChoice, SpecGroup } from '../registry';

type P2 = [number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const inkOf = (n: NodeModel) => (n.stroke === 'none' ? '#555555' : n.stroke);
const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];
const line = (cmds: Cmd[], stroke?: string, sw?: number): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true });
const tint = (fill: string, t: number) => (fill === 'none' ? 'none' : shade(fill, t));

/** Colori pastello (riempimento, bordo) dell'app, per regioni distinte. */
const PASTEL: [string, string][] = [
  ['#DAE8FC', '#6C8EBF'],
  ['#D5E8D4', '#82B366'],
  ['#FFE6CC', '#D79B00'],
  ['#F8CECC', '#B85450'],
  ['#E1D5E7', '#9673A6'],
  ['#FFF2CC', '#D6B656'],
];
/** Colori vivaci per i canali ripesati (come nella figura dello SE block). */
const CHANNEL = ['#E57373', '#FFB74D', '#FFF176', '#81C784', '#4FC3F7', '#9575CD', '#F06292', '#4DB6AC'];

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
  return [line(seg(a, end), color, sw), head(b, b[0] - a[0], b[1] - a[1], size, color)];
}

// ---------------------------------------------------------------------------
// Dropout (Srivastava et al. 2014, Fig. 1b): rete con neuroni spenti e barrati
// ---------------------------------------------------------------------------
function dropout(n: NodeModel): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = inkOf(n);
  const layers = parseLayers(n.spec);
  const L = layers.length;
  const p = clamp(n.count, 0, 90) / 100;
  const maxN = Math.max(...layers);
  const r = Math.min(h / maxN, w / L) * 0.32;
  const rand = rng(layers.reduce((a, b) => a * 7 + b, 11));
  const pos = layers.map((cnt, j) =>
    Array.from({ length: cnt }, (_, i): P2 => [x + r + ((w - 2 * r) * j) / (L - 1), y + h / 2 + (i - (cnt - 1) / 2) * (h / maxN)]),
  );
  // un valore casuale per neurone, indipendente da p: alzando p si spengono sempre più neuroni
  const alive = pos.map((col, j) => {
    const keep = col.map(() => rand());
    const pj = j === L - 1 ? 0 : j === 0 ? p * 0.5 : p;
    const a = keep.map((v) => v >= pj);
    if (!a.some(Boolean)) a[keep.indexOf(Math.max(...keep))] = true;
    return a;
  });
  const lines: Cmd[] = [];
  for (let j = 1; j < L; j++)
    pos[j - 1].forEach((a, ia) => {
      if (alive[j - 1][ia]) pos[j].forEach((b, ib) => alive[j][ib] && lines.push(...seg(a, b)));
    });
  const parts: Part[] = [line(lines, shade(ink, 0.3), Math.max(0.4, n.strokeWidth * 0.4))];
  pos.forEach((col, j) =>
    col.forEach(([cx, cy], i) => {
      if (alive[j][i]) {
        parts.push({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill });
      } else {
        const k = r * 0.78;
        parts.push(
          { kind: 'ellipse', cx, cy, rx: r, ry: r, fill: '#FFFFFF', stroke: shade(ink, 0.55) },
          line([...seg([cx - k, cy - k], [cx + k, cy + k]), ...seg([cx + k, cy - k], [cx - k, cy + k])], '#333333', n.strokeWidth * 1.1),
        );
      }
    }),
  );
  return parts;
}

// ---------------------------------------------------------------------------
// Pooling: griglia di ingresso divisa in regioni k×k, uscita ridotta
// ---------------------------------------------------------------------------
function pooling(n: NodeModel): Part[] {
  const ink = inkOf(n);
  const [rows, cols] = parseGrid(n.spec, 4);
  const k = clamp(n.count, 1, Math.min(rows, cols));
  const avg = /avg|mean/i.test(n.spec);
  const orow = Math.ceil(rows / k), ocol = Math.ceil(cols / k);
  const gapU = 1.9;
  const c = Math.min(n.h / rows, n.w / (cols + ocol + gapU));
  const x0 = n.x + (n.w - (cols + ocol + gapU) * c) / 2;
  const y0 = n.y + (n.h - rows * c) / 2;
  const ox = x0 + (cols + gapU) * c;
  const oy = n.y + (n.h - orow * c) / 2;
  // valori interi deterministici; i numeri si scrivono solo se le celle sono leggibili
  const rand = rng(rows * 13 + cols * 7 + k);
  const val = Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.floor(rand() * 10)));
  const numbers = c >= 13 && !/nonum/i.test(n.spec);
  const fs = c * 0.5;
  const num = (v: number, cx: number, cy: number, bold = false, size = fs): Part => ({ kind: 'text', x: cx, y: cy, text: String(v), size, fill: '#1A1A1A', bold });
  const parts: Part[] = [];
  const texts: Part[] = [];
  const outCells: Part[] = [];
  for (let bj = 0; bj < orow; bj++)
    for (let bi = 0; bi < ocol; bi++) {
      const [pf, ps] = PASTEL[(bj * ocol + bi + bj) % PASTEL.length];
      const strong = mix(pf, ps, 0.55);
      const h0 = bj * k, w0 = bi * k;
      const rh = Math.min(k, rows - h0), rw = Math.min(k, cols - w0);
      const cells: [number, number][] = [];
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) cells.push([h0 + j, w0 + i]);
      const vs = cells.map(([r, q]) => val[r][q]);
      const best = vs.indexOf(Math.max(...vs));
      const out = avg ? Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 10) / 10 : vs[best];
      cells.forEach(([r, q], idx) => {
        const isMax = !avg && idx === best;
        parts.push({ kind: 'rect', x: x0 + q * c, y: y0 + r * c, w: c, h: c, r: 0, fill: isMax ? strong : pf, stroke: 'none' });
        if (numbers) texts.push(num(val[r][q], x0 + (q + 0.5) * c, y0 + (r + 0.5) * c, isMax));
      });
      outCells.push({ kind: 'rect', x: ox + bi * c, y: oy + bj * c, w: c, h: c, r: 0, fill: avg ? mix(pf, ps, 0.3) : strong, stroke: 'none' });
      if (numbers) texts.push(num(out, ox + (bi + 0.5) * c, oy + (bj + 0.5) * c, true, String(out).length > 2 ? fs * 0.8 : fs));
    }
  const grid = (gx: number, gy: number, nr: number, nc: number): Cmd[] => {
    const cmds: Cmd[] = [];
    for (let i = 1; i < nc; i++) cmds.push(...seg([gx + i * c, gy], [gx + i * c, gy + nr * c]));
    for (let j = 1; j < nr; j++) cmds.push(...seg([gx, gy + j * c], [gx + nc * c, gy + j * c]));
    return cmds;
  };
  // regioni di pooling: bordi più marcati
  const regions: Cmd[] = [];
  for (let i = k; i < cols; i += k) regions.push(...seg([x0 + i * c, y0], [x0 + i * c, y0 + rows * c]));
  for (let j = k; j < rows; j += k) regions.push(...seg([x0, y0 + j * c], [x0 + cols * c, y0 + j * c]));
  parts.push(
    line(grid(x0, y0, rows, cols), shade(ink, 0.45), n.strokeWidth * 0.5),
    line(regions, ink, n.strokeWidth * 1.2),
    { kind: 'rect', x: x0, y: y0, w: cols * c, h: rows * c, r: 0, fill: 'none' },
    ...outCells,
    line(grid(ox, oy, orow, ocol), ink, n.strokeWidth * 0.8),
    { kind: 'rect', x: ox, y: oy, w: ocol * c, h: orow * c, r: 0, fill: 'none' },
    ...arrow([x0 + cols * c + c * 0.35, n.y + n.h / 2], [ox - c * 0.35, n.y + n.h / 2], ink, n.strokeWidth, 5),
    ...texts,
  );
  return parts;
}

// ---------------------------------------------------------------------------
// Convoluzione su un volume: kernel k×k×C che scorre e produce un punto della mappa
// ---------------------------------------------------------------------------
function cuboidFaces(fx: number, fy: number, fw: number, fh: number, dx: number, dy: number, fill: string): Part[] {
  return [
    { kind: 'path', fill: tint(fill, 0.45), cmds: poly([[fx, fy], [fx + dx, fy - dy], [fx + fw + dx, fy - dy], [fx + fw, fy]]) },
    { kind: 'path', fill: tint(fill, -0.1), cmds: poly([[fx + fw, fy], [fx + fw + dx, fy - dy], [fx + fw + dx, fy + fh - dy], [fx + fw, fy + fh]]) },
    { kind: 'rect', x: fx, y: fy, w: fw, h: fh, r: 0, fill },
  ];
}

function convVolume(n: NodeModel): Part[] {
  const { x, y, w, h, fill } = n;
  const ink = inkOf(n);
  const N = clamp(parseGrid(n.spec, 6)[0], 3, 12);
  const k = clamp(n.count, 1, N - 1);
  const S = Math.min(h / 1.35, w * 0.46);
  const d = S * 0.35;
  const fx = x, fy = y + d + (h - S - d) / 2;
  const c = S / N;
  const parts: Part[] = cuboidFaces(fx, fy, S, S, d, d, fill);
  const g: Cmd[] = [];
  for (let i = 1; i < N; i++) g.push(...seg([fx + i * c, fy], [fx + i * c, fy + S]), ...seg([fx, fy + i * c], [fx + S, fy + i * c]));
  parts.push(line(g, shade(ink, 0.55), n.strokeWidth * 0.45));
  // kernel: blocco in rilievo sulla faccia frontale
  const kx = fx + c, ky = fy + c, ks = k * c, kd = d * 0.45;
  const kfill = shade(ink, 0.45);
  parts.push(...cuboidFaces(kx, ky, ks, ks, kd, kd, kfill));
  // mappa di uscita (N-k+1)², più sottile
  const M = N - k + 1;
  const S2 = Math.min(S * 0.62, w - S - d - 30);
  const d2 = d * 0.3;
  const ox = x + w - S2 - d2, oy = y + d2 + (h - S2 - d2) / 2;
  const c2 = S2 / M;
  parts.push(...cuboidFaces(ox, oy, S2, S2, d2, d2, tint(fill, -0.04)));
  const g2: Cmd[] = [];
  for (let i = 1; i < M; i++) g2.push(...seg([ox + i * c2, oy], [ox + i * c2, oy + S2]), ...seg([ox, oy + i * c2], [ox + S2, oy + i * c2]));
  parts.push(line(g2, shade(ink, 0.55), n.strokeWidth * 0.45));
  const cx0 = ox + c2, cy0 = oy + c2;
  parts.push({ kind: 'rect', x: cx0, y: cy0, w: c2, h: c2, r: 0, fill: kfill });
  // proiezione: dagli spigoli del kernel alla cella di uscita
  const proj: Cmd[] = [
    ...seg([kx + ks + kd, ky - kd], [cx0 + c2, cy0]),
    ...seg([kx + ks, ky + ks], [cx0 + c2, cy0 + c2]),
    ...seg([kx + kd, ky - kd], [cx0, cy0]),
    ...seg([kx, ky + ks], [cx0, cy0 + c2]),
  ];
  parts.push(line(proj, shade(ink, 0.15), n.strokeWidth * 0.6));
  return parts;
}

// ---------------------------------------------------------------------------
// Teste di attention: h mappe di attenzione sovrapposte, ognuna con il suo schema
// ---------------------------------------------------------------------------
function heads(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const base = inkOf(n);
  const H = clamp(n.count, 1, 8);
  const [rows, cols] = parseGrid(n.spec, 6);
  const d = H > 1 ? Math.min(w, h) * Math.min(0.13, 0.45 / (H - 1)) : 0;
  const sw = w - (H - 1) * d, sh = h - (H - 1) * d;
  // indice della testa nell'angolo in alto a destra, che resta scoperto (solo se c'è spazio)
  const b = Math.min(14, H > 1 ? d * 0.9 : Math.min(w, h) * 0.16);
  const idx = /idx|num/i.test(n.spec) && b >= 8;
  const parts: Part[] = [];
  for (let k = H - 1; k >= 0; k--) {
    const sx = x + k * d, sy = y + (H - 1 - k) * d;
    const rand = rng(97 + k * 31 + rows * 7 + cols);
    const kind = k % 4;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const u = (i + 0.5) / cols, v = (j + 0.5) / rows;
        let a: number;
        if (kind === 0) a = Math.exp(-(((u - v) * 4) ** 2)); // locale (diagonale)
        else if (kind === 1) a = Math.exp(-(((u - v + 1 / cols) * 5) ** 2)); // token precedente
        else if (kind === 2) a = i === 0 ? 0.95 : 0.12; // primo token
        else a = rand() ** 2;
        a = clamp(a * 0.85 + rand() * 0.15, 0, 1);
        parts.push({ kind: 'rect', x: sx + (sw * i) / cols, y: sy + (sh * j) / rows, w: sw / cols, h: sh / rows, r: 0, fill: shade(base, 0.94 - 0.84 * a), stroke: 'none' });
      }
    parts.push({ kind: 'rect', x: sx, y: sy, w: sw, h: sh, r: 0, fill: 'none' });
    if (idx) {
      const bx = sx + sw - b - 0.5, by = sy + 0.5;
      parts.push(
        { kind: 'rect', x: bx, y: by, w: b, h: b, r: 2, fill: '#FFFFFF', sw: 0.8 },
        { kind: 'text', x: bx + b / 2, y: by + b / 2, text: String(k + 1), size: b * 0.72, fill: shade(base, -0.4), bold: true },
      );
    }
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Embedding: vettore one-hot → tabella V×d → riga selezionata
// ---------------------------------------------------------------------------
function embedding(n: NodeModel): Part[] {
  const ink = inkOf(n);
  const [V, D] = parseGrid(n.spec, 6);
  const sel = clamp(n.count, 1, V) - 1;
  const gap = 1.5;
  const units = 1 + gap + D + gap + D;
  const c = Math.min(n.h / V, n.w / units);
  const x0 = n.x + (n.w - units * c) / 2;
  const y0 = n.y + (n.h - V * c) / 2;
  const tx = x0 + (1 + gap) * c;
  const ox = tx + (D + gap) * c;
  const sy = y0 + sel * c;
  const hi = shade(ink, 0.4);
  const parts: Part[] = [];
  // one-hot
  parts.push({ kind: 'rect', x: x0, y: y0, w: c, h: V * c, r: 0, fill: '#FFFFFF' });
  const digits = c >= 11;
  parts.push({ kind: 'rect', x: x0, y: sy, w: c, h: c, r: 0, fill: digits ? hi : shade(ink, 0.05), stroke: 'none' });
  const oh: Cmd[] = [];
  for (let j = 1; j < V; j++) oh.push(...seg([x0, y0 + j * c], [x0 + c, y0 + j * c]));
  parts.push(line(oh, undefined, n.strokeWidth * 0.6), { kind: 'rect', x: x0, y: y0, w: c, h: V * c, r: 0, fill: 'none' });
  if (digits)
    for (let j = 0; j < V; j++)
      parts.push({ kind: 'text', x: x0 + c / 2, y: y0 + (j + 0.5) * c, text: j === sel ? '1' : '0', size: c * 0.55, fill: j === sel ? '#1A1A1A' : '#9AA0A6', bold: j === sel });
  // tabella
  parts.push({ kind: 'rect', x: tx, y: y0, w: D * c, h: V * c, r: 0, fill: n.fill });
  parts.push({ kind: 'rect', x: tx, y: sy, w: D * c, h: c, r: 0, fill: hi, stroke: 'none' });
  const tg: Cmd[] = [];
  for (let i = 1; i < D; i++) tg.push(...seg([tx + i * c, y0], [tx + i * c, y0 + V * c]));
  for (let j = 1; j < V; j++) tg.push(...seg([tx, y0 + j * c], [tx + D * c, y0 + j * c]));
  parts.push(line(tg, undefined, n.strokeWidth * 0.5), { kind: 'rect', x: tx, y: y0, w: D * c, h: V * c, r: 0, fill: 'none' });
  parts.push({ kind: 'rect', x: tx, y: sy, w: D * c, h: c, r: 0, fill: 'none', sw: n.strokeWidth * 1.6, stroke: shade(ink, -0.25), solid: true });
  // riga estratta
  const og: Cmd[] = [];
  for (let i = 1; i < D; i++) og.push(...seg([ox + i * c, sy], [ox + i * c, sy + c]));
  parts.push({ kind: 'rect', x: ox, y: sy, w: D * c, h: c, r: 0, fill: hi }, line(og, undefined, n.strokeWidth * 0.6));
  const ay = sy + c / 2;
  parts.push(...arrow([x0 + c + c * 0.25, ay], [tx - c * 0.25, ay], ink, n.strokeWidth, 5));
  parts.push(...arrow([tx + D * c + c * 0.25, ay], [ox - c * 0.25, ay], ink, n.strokeWidth, 5));
  return parts;
}

// ---------------------------------------------------------------------------
// Loss landscape: curve di livello e traiettoria della discesa del gradiente
// ---------------------------------------------------------------------------
function landscape(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const ink = inkOf(n);
  const steps = clamp(n.count, 2, 40);
  const mode = /mom/i.test(n.spec) ? 'momentum' : /sgd|noisy|stoch/i.test(n.spec) ? 'sgd' : 'gd';
  const R = Math.min(n.radius, w / 2, h / 2);
  const clip = { x, y, w, h, r: R };
  const cx = x + w * 0.6, cy = y + h * 0.54;
  const rot = -0.42;
  const A = Math.min(w * 0.5, h * 1.1), B = A * 0.38;
  const at = (u: number, v: number): P2 => [cx + u * Math.cos(rot) - v * Math.sin(rot), cy + u * Math.sin(rot) + v * Math.cos(rot)];
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: R, fill: n.fill, stroke: 'none' });
  const levels = [1.25, 1, 0.78, 0.58, 0.4, 0.24, 0.1];
  levels.forEach((L, i) => {
    const pts = Array.from({ length: 20 }, (_, k): P2 => {
      const t = (Math.PI * 2 * k) / 20;
      // leggera asimmetria: le curve non sono ellissi perfette
      const s = 1 + 0.06 * Math.sin(2 * t + 0.7) * (1 - L * 0.3);
      return at(A * L * s * Math.cos(t), B * L * s * Math.sin(t));
    });
    parts.push({ kind: 'path', cmds: smooth(pts), fill: shade(ink, 0.93 - i * 0.09), stroke: shade(ink, 0.35), sw: 0.6, solid: true, clip });
  });
  // traiettoria: discesa del gradiente su f(u, v) = u²/A² + v²/B²
  const rand = rng(7 + steps);
  let u = -0.8 * A, v = 0.55 * B, vu = 0, vv = 0;
  const path: P2[] = [at(u, v)];
  for (let s = 1; s < steps; s++) {
    const gu = (2 * u) / (A * A), gv = (2 * v) / (B * B);
    if (mode === 'momentum') {
      const lr = 0.18 * B * B;
      vu = 0.72 * vu - lr * gu;
      vv = 0.72 * vv - lr * gv;
      u += vu;
      v += vv;
    } else {
      const lr = (mode === 'sgd' ? 0.6 : 0.8) * B * B;
      u -= lr * gu;
      v -= lr * gv;
      if (mode === 'sgd') {
        const decay = Math.max(0.15, 1 - s / steps);
        u += (rand() - 0.5) * A * 0.22 * decay;
        v += (rand() - 0.5) * B * 0.5 * decay;
      }
    }
    path.push(at(u, v));
  }
  const red = '#C0392B';
  parts.push(line(poly(path, false), red, n.strokeWidth * 1.1));
  const last = path[path.length - 1], prev = path[path.length - 2];
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > 4) parts.push(head(last, last[0] - prev[0], last[1] - prev[1], 6, red));
  path.slice(0, -1).forEach(([px, py]) => parts.push({ kind: 'ellipse', cx: px, cy: py, rx: 1.8, ry: 1.8, fill: red, stroke: 'none' }));
  // minimo
  const [mx, my] = at(0, 0);
  const st = 3.5;
  parts.push(line([...seg([mx - st, my - st], [mx + st, my + st]), ...seg([mx + st, my - st], [mx - st, my + st])], '#1A1A1A', 1.4));
  if (n.stroke !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: R, fill: 'none' });
  return parts;
}

// ---------------------------------------------------------------------------
// Softmax con temperatura: barre p_i = exp(z_i / T) / Σ_j exp(z_j / T)
// ---------------------------------------------------------------------------
const LOGITS = [0.9, 2.6, 1.6, 0.3, 1.1, -0.2, 0.6, 1.0, -0.5, 0.2, 0.8, 0.0];
const softmaxOf = (z: number[], T: number) => {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp((v - m) / T));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
};

function softmaxBars(n: NodeModel): Part[] {
  const { x, y, w, h, fill } = n;
  const C = clamp(n.count, 2, LOGITS.length);
  const T = clamp(parseFloat(/[\d.]+/.exec(n.spec)?.[0] ?? '1') || 1, 0.05, 100);
  const z = LOGITS.slice(0, C);
  const p = softmaxOf(z, T);
  // la scala è quella di T = 1: a temperatura alta le barre si appiattiscono e si abbassano
  const ref = Math.max(...softmaxOf(z, 1));
  const top = p.indexOf(Math.max(...p));
  const bw = w / C;
  const parts: Part[] = p.map((v, i): Part => {
    const bh = Math.max(1.5, Math.min(h, (h * v) / ref));
    return { kind: 'rect', x: x + bw * (i + 0.15), y: y + h - bh, w: bw * 0.7, h: bh, r: 0, fill: i === top ? tint(fill, -0.18) : fill, sw: n.strokeWidth * 0.8 };
  });
  parts.push(line(seg([x, y + h], [x + w, y + h])));
  return parts;
}

// ---------------------------------------------------------------------------
// Normalizzazioni (Wu & He 2018, Fig. 2): cubo N × C × (H, W) con la regione normalizzata
// ---------------------------------------------------------------------------
/** Riquadro del cubo: con 'axes' lascia spazio a sinistra e sotto per le lettere degli assi. */
function cubeBox(n: NodeModel) {
  const axes = /axes/i.test(n.spec);
  const mL = axes ? clamp(n.w * 0.22, 18, 32) : 0;
  const mB = axes ? clamp(n.h * 0.13, 12, 18) : 0;
  return { axes, x: n.x + mL, y: n.y, w: n.w - mL, h: n.h - mB, mL, mB };
}

function normCube(n: NodeModel): Part[] {
  const { fill } = n;
  const box = cubeBox(n);
  const { x, y, w, h } = box;
  const ink = inkOf(n);
  const nN = 4;
  const nC = clamp(n.count, 2, 12);
  const s = n.spec.toLowerCase();
  const dx = w * 0.36, dy = h * 0.28;
  const Wf = w - dx, Hf = h - dy;
  const fy = y + dy;
  const P = (u: number, c: number, t = 0): P2 => [x + u * Wf + c * dx, fy - c * dy + t * Hf];
  let [n0, n1, c0, c1] = [0, 1 / nN, 0, 1 / nC]; // instance
  if (/batch|bn/.test(s)) [n0, n1, c0, c1] = [0, 1, 0, 1 / nC];
  else if (/layer|ln/.test(s)) [n0, n1, c0, c1] = [0, 1 / nN, 0, 1];
  else if (/group|gn/.test(s)) [n0, n1, c0, c1] = [0, 1 / nN, 0, Math.max(1, Math.round(nC / 3)) / nC];
  const parts: Part[] = [
    { kind: 'path', fill: tint(fill, 0.5), cmds: poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)]) },
    { kind: 'path', fill: tint(fill, -0.06), cmds: poly([P(1, 0), P(1, 1), P(1, 1, 1), P(1, 0, 1)]) },
    { kind: 'rect', x, y: fy, w: Wf, h: Hf, r: 0, fill },
  ];
  // regione normalizzata (stesse statistiche)
  const blue = (t: number) => shade(ink, t);
  if (c0 === 0) parts.push({ kind: 'rect', x: x + n0 * Wf, y: fy, w: (n1 - n0) * Wf, h: Hf, r: 0, fill: blue(0.35), stroke: 'none' });
  parts.push({ kind: 'path', fill: blue(0.55), stroke: 'none', cmds: poly([P(n0, c0), P(n1, c0), P(n1, c1), P(n0, c1)]) });
  if (n1 === 1) parts.push({ kind: 'path', fill: blue(0.15), stroke: 'none', cmds: poly([P(1, c0), P(1, c1), P(1, c1, 1), P(1, c0, 1)]) });
  // suddivisioni lungo N e C
  const g: Cmd[] = [];
  for (let i = 1; i < nN; i++) g.push(...seg(P(i / nN, 0), P(i / nN, 0, 1)), ...seg(P(i / nN, 0), P(i / nN, 1)));
  for (let j = 1; j < nC; j++) g.push(...seg(P(0, j / nC), P(1, j / nC)), ...seg(P(1, j / nC), P(1, j / nC, 1)));
  parts.push(line(g, shade(ink, 0.5), n.strokeWidth * 0.5));
  // contorno della regione e del cubo
  const edge: Cmd[] = [];
  if (c0 === 0) edge.push(...poly([P(n0, 0), P(n1, 0), P(n1, 0, 1), P(n0, 0, 1)]));
  edge.push(...poly([P(n0, c0), P(n1, c0), P(n1, c1), P(n0, c1)]));
  if (n1 === 1) edge.push(...poly([P(1, c0), P(1, c1), P(1, c1, 1), P(1, c0, 1)]));
  parts.push(line(edge, shade(ink, -0.3), n.strokeWidth));
  parts.push(
    { kind: 'path', fill: 'none', cmds: poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)]) },
    { kind: 'path', fill: 'none', cmds: poly([P(1, 0), P(1, 1), P(1, 1, 1), P(1, 0, 1)]) },
    { kind: 'rect', x, y: fy, w: Wf, h: Hf, r: 0, fill: 'none' },
  );
  if (box.axes) {
    // assi come nella figura di Wu & He: H, W in verticale, N in orizzontale, C in profondità
    const fs = clamp(Math.min(n.w, n.h) * 0.12, 8, 13);
    const col = '#1A1A1A';
    parts.push(
      { kind: 'text', x: x - 4, y: fy + Hf / 2, text: '$H, W$', size: fs, fill: col, anchor: 'end' },
      { kind: 'text', x: x + Wf / 2, y: y + h + box.mB / 2 + 1, text: '$N$', size: fs, fill: col },
      { kind: 'text', x: x + dx / 2 - 4, y: y + dy / 2 - 4, text: '$C$', size: fs, fill: col, anchor: 'end' },
    );
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Finestre di Swin (Liu et al. 2021, Fig. 2): partizione regolare o spostata
// ---------------------------------------------------------------------------
function windows(n: NodeModel): Part[] {
  const ink = inkOf(n);
  const M = clamp(n.count, 1, 6);
  const P = clamp(parseInt(/p\s*(\d+)/i.exec(n.spec)?.[1] ?? '4', 10), 2, 8);
  const shifted = /shift/i.test(n.spec);
  const G = M * P;
  const S = Math.min(n.w, n.h);
  const c = S / G;
  const x0 = n.x + (n.w - S) / 2, y0 = n.y + (n.h - S) / 2;
  const parts: Part[] = [{ kind: 'rect', x: x0, y: y0, w: S, h: S, r: 0, fill: n.fill, stroke: 'none' }];
  const g: Cmd[] = [];
  for (let i = 1; i < G; i++) g.push(...seg([x0 + i * c, y0], [x0 + i * c, y0 + S]), ...seg([x0, y0 + i * c], [x0 + S, y0 + i * c]));
  parts.push(line(g, shade(ink, 0.45), n.strokeWidth * 0.45), { kind: 'rect', x: x0, y: y0, w: S, h: S, r: 0, fill: 'none', sw: n.strokeWidth * 0.8 });
  const b: number[] = [0];
  if (shifted) for (let k = Math.floor(P / 2); k < G; k += P) b.push(k);
  else for (let k = P; k < G; k += P) b.push(k);
  b.push(G);
  const red = '#D14343';
  const win: Cmd[] = [];
  for (let j = 0; j + 1 < b.length; j++)
    for (let i = 0; i + 1 < b.length; i++)
      win.push(...poly([[x0 + b[i] * c, y0 + b[j] * c], [x0 + b[i + 1] * c, y0 + b[j] * c], [x0 + b[i + 1] * c, y0 + b[j + 1] * c], [x0 + b[i] * c, y0 + b[j + 1] * c]]));
  // bordi delle finestre (in rosso, come nella figura originale)
  parts.push(line(win, red, Math.max(1.6, n.strokeWidth * 1.5)));
  return parts;
}

// ---------------------------------------------------------------------------
// Blocco residuo in miniatura: layer in serie, scorciatoia identità e somma
// ---------------------------------------------------------------------------
function resBlock(n: NodeModel): Part[] {
  const o = orient(n);
  const { W, H } = o;
  const ink = inkOf(n);
  const sw = n.strokeWidth;
  const L = clamp(n.count, 1, 4);
  const vc = H * 0.62;
  const bh = H * 0.56, bw = Math.min(W * 0.14, (W * 0.58) / L - 8);
  const rr = Math.min(W * 0.065, H * 0.15);
  const ux = W * 0.84;
  const at = (u: number, v: number) => o.at(u, v);
  const parts: Part[] = [];
  const u0 = W * 0.17, u1 = W * 0.7;
  const centers = Array.from({ length: L }, (_, i) => (L === 1 ? (u0 + u1) / 2 : u0 + ((u1 - u0) * i) / (L - 1)));
  // scorciatoia
  const top = H * 0.1;
  const skip: Cmd[] = [['M', ...at(W * 0.07, vc)], ['L', ...at(W * 0.07, top)], ['L', ...at(ux, top)], ['L', ...at(ux, vc - rr - 4)]];
  parts.push(line(skip, ink, sw));
  const tip = at(ux, vc - rr), from = at(ux, vc - rr - 6);
  parts.push(head(tip, tip[0] - from[0], tip[1] - from[1], 5, ink));
  // flusso principale
  parts.push(line(seg(at(0, vc), at(centers[0] - bw / 2, vc)), ink, sw));
  for (let i = 0; i < L; i++) {
    const nextU = i < L - 1 ? centers[i + 1] - bw / 2 : ux - rr;
    parts.push(...arrow(at(centers[i] + bw / 2, vc), at(nextU, vc), ink, sw, 5));
  }
  parts.push(line(seg(at(ux + rr, vc), at(W, vc)), ink, sw));
  for (const c of centers) {
    parts.push({ kind: 'path', fill: n.fill, cmds: roundPoly([at(c - bw / 2, vc - bh / 2), at(c + bw / 2, vc - bh / 2), at(c + bw / 2, vc + bh / 2), at(c - bw / 2, vc + bh / 2)], 2) });
  }
  const [px, py] = at(ux, vc);
  parts.push(
    { kind: 'ellipse', cx: px, cy: py, rx: rr, ry: rr, fill: '#FFFFFF' },
    line([...seg([px - rr * 0.6, py], [px + rr * 0.6, py]), ...seg([px, py - rr * 0.6], [px, py + rr * 0.6])], ink, sw),
  );
  return parts;
}

// ---------------------------------------------------------------------------
// Immagine aumentata (SimCLR, Fig. 4): crop, flip, rotazione, colore, blur, rumore...
// ---------------------------------------------------------------------------
type Prim = { kind: 'rect'; u: number; v: number; w: number; h: number; color: string } | { kind: 'circle'; u: number; v: number; r: number; color: string } | { kind: 'poly'; pts: P2[]; color: string; curve?: boolean };

const SCENE: Prim[] = [
  { kind: 'rect', u: 0, v: 0, w: 1, h: 1, color: '#BFDDF5' },
  { kind: 'circle', u: 0.76, v: 0.24, r: 0.1, color: '#F6C344' },
  { kind: 'poly', pts: [[-0.05, 0.78], [0.22, 0.4], [0.42, 0.62], [0.6, 0.36], [0.86, 0.66], [1.05, 0.5], [1.05, 1.05], [-0.05, 1.05]], color: '#8EA6C8' },
  { kind: 'poly', pts: [[-0.05, 0.86], [0.3, 0.7], [0.65, 0.86], [1.05, 0.72], [1.05, 1.05], [-0.05, 1.05]], color: '#79B465', curve: true },
  { kind: 'rect', u: 0.235, v: 0.62, w: 0.035, h: 0.16, color: '#8B5A2B' },
  { kind: 'circle', u: 0.252, v: 0.57, r: 0.085, color: '#3E8E41' },
];

function hslRotate(hex: string, deg: number): string {
  const v = parseInt(hex.slice(1), 16);
  let r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let hh = 0;
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (mx === r) hh = ((g - b) / d) % 6;
    else if (mx === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
  }
  hh = (((hh * 60 + deg) % 360) + 360) % 360;
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const X = C * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - C / 2;
  [r, g, b] = hh < 60 ? [C, X, 0] : hh < 120 ? [X, C, 0] : hh < 180 ? [0, C, X] : hh < 240 ? [0, X, C] : hh < 300 ? [X, 0, C] : [C, 0, X];
  const ch = (t: number) => Math.round((t + m) * 255);
  return '#' + ((1 << 24) | (ch(r) << 16) | (ch(g) << 8) | ch(b)).toString(16).slice(1).toUpperCase();
}

const gray = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  const l = Math.round(0.3 * ((v >> 16) & 255) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255));
  return '#' + ((1 << 24) | (l << 16) | (l << 8) | l).toString(16).slice(1).toUpperCase();
};

function augImage(n: NodeModel): Part[] {
  const s = n.spec.toLowerCase();
  const has = (k: string) => s.includes(k);
  return framed(n, (b: Box, rand) => {
    // trasformazioni geometriche in coordinate unitarie
    const geo = (u: number, v: number): P2 => {
      if (has('crop')) [u, v] = [(u - 0.12) / 0.55, (v - 0.32) / 0.55];
      if (has('flip')) u = 1 - u;
      if (has('rot')) [u, v] = [1 - v, u];
      return [b.x + u * b.w, b.y + v * b.h];
    };
    const color = (c: string) => {
      let out = c;
      if (has('color') || has('jitter')) out = hslRotate(out, 150);
      if (has('gray') || has('drop')) out = gray(out);
      if (has('blur')) out = mix(out, '#A8B8A8', 0.35);
      return out;
    };
    const sobel = has('sobel');
    const parts: Part[] = [];
    if (sobel) parts.push({ kind: 'rect', x: b.x, y: b.y, w: b.w, h: b.h, r: 0, fill: '#111111' });
    const style = (c: string): { fill: string; stroke?: string; sw?: number; solid?: boolean } =>
      sobel ? { fill: 'none', stroke: '#F2F2F2', sw: 1, solid: true } : { fill: color(c) };
    for (const p of SCENE) {
      if (p.kind === 'rect') {
        if (sobel && p.w === 1) continue;
        parts.push({ kind: 'path', cmds: poly([geo(p.u, p.v), geo(p.u + p.w, p.v), geo(p.u + p.w, p.v + p.h), geo(p.u, p.v + p.h)]), ...style(p.color) });
      } else if (p.kind === 'circle') {
        const pts = Array.from({ length: 12 }, (_, k): P2 => geo(p.u + p.r * Math.cos((k * Math.PI) / 6), p.v + p.r * Math.sin((k * Math.PI) / 6)));
        parts.push({ kind: 'path', cmds: smooth(pts), ...style(p.color) });
      } else {
        const pts = p.pts.map(([u, v]) => geo(u, v));
        parts.push({ kind: 'path', cmds: p.curve ? smooth(pts) : poly(pts), ...style(p.color) });
      }
    }
    if (has('cutout')) parts.push({ kind: 'rect', x: b.x + b.w * 0.42, y: b.y + b.h * 0.3, w: b.w * 0.3, h: b.h * 0.3, r: 0, fill: '#7A7A7A' });
    if (has('noise')) {
      for (let i = 0; i < 160; i++) {
        const r = Math.min(b.w, b.h) * 0.012;
        parts.push({ kind: 'ellipse', cx: b.x + rand() * b.w, cy: b.y + rand() * b.h, rx: r, ry: r, fill: rand() < 0.5 ? '#FFFFFF' : '#333333' });
      }
    }
    return parts;
  });
}

// ---------------------------------------------------------------------------
// Spazio degli embedding per la triplet loss (FaceNet, Fig. 3): prima / dopo
// ---------------------------------------------------------------------------
function tripletSpace(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const after = /after|dopo/i.test(n.spec);
  const m = Math.min(w, h);
  const r = m * 0.075;
  const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const a = P(0.34, 0.52);
  const pos = after ? P(0.5, 0.3) : P(0.86, 0.22);
  const neg = after ? P(0.88, 0.8) : P(0.56, 0.82);
  const R0 = Math.min(n.radius, m / 2);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: R0, fill: n.fill });
  if (after) {
    // margine attorno all'anchor: il positivo dentro, il negativo fuori
    const R = Math.hypot(pos[0] - a[0], pos[1] - a[1]) + r * 1.6;
    parts.push({ kind: 'ellipse', cx: a[0], cy: a[1], rx: R, ry: R, fill: 'none', stroke: '#9AA0A6', sw: 0.9, clip: { x, y, w, h, r: R0 } });
  }
  const gl = (p: P2, color: string): Part => {
    const l = Math.hypot(p[0] - a[0], p[1] - a[1]);
    const ux = (p[0] - a[0]) / l, uy = (p[1] - a[1]) / l;
    return line(seg([a[0] + ux * r, a[1] + uy * r], [p[0] - ux * r, p[1] - uy * r]), color, 1.4);
  };
  parts.push(gl(pos, '#82B366'), gl(neg, '#B85450'));
  const dot = (p: P2, f: string, s: string): Part => ({ kind: 'ellipse', cx: p[0], cy: p[1], rx: r, ry: r, fill: f, stroke: s, sw: 1.2, solid: true });
  parts.push(dot(a, '#DAE8FC', '#3B6FB6'), dot(pos, '#D5E8D4', '#3D7A3D'), dot(neg, '#F8CECC', '#A33A35'));
  if (!/nolab/i.test(n.spec) && m >= 50) {
    // lettere a (anchor), p (positive), n (negative) accanto ai punti
    const fs = clamp(m * 0.13, 8, 13);
    const t = (text: string, px: number, py: number, color: string, anchor: 'start' | 'middle' | 'end'): Part => ({ kind: 'text', x: px, y: py, text, size: fs, fill: color, anchor, italic: true, bold: true });
    parts.push(
      t('a', a[0] - r - 3, a[1], '#3B6FB6', 'end'),
      t('p', pos[0], pos[1] - r - fs * 0.6, '#3D7A3D', 'middle'),
      t('n', neg[0] - r - 3, neg[1], '#A33A35', 'end'),
    );
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Tensore con canali colorati (Hu et al. 2018, SE block): fette lungo la larghezza
// ---------------------------------------------------------------------------
function channelCuboid(n: NodeModel): Part[] {
  const { x, y, w, h, fill } = n;
  const C = clamp(n.count, 1, 24);
  const mono = /mono|gray|plain/i.test(n.spec) || fill === 'none';
  const d = Math.round(Math.min(w, h) * clamp(n.depth, 0.05, 0.9));
  const Wf = w - d, fy = y + d;
  const sw = Wf / C;
  const col = (i: number) => (mono ? shade(fill === 'none' ? '#F5F5F5' : fill, i % 2 ? 0.25 : 0) : CHANNEL[i % CHANNEL.length]);
  const parts: Part[] = [];
  for (let i = 0; i < C; i++) {
    const c = col(i);
    parts.push(
      { kind: 'path', fill: shade(c, 0.35), cmds: poly([[x + i * sw, fy], [x + (i + 1) * sw, fy], [x + (i + 1) * sw + d, y], [x + i * sw + d, y]]) },
      { kind: 'rect', x: x + i * sw, y: fy, w: sw, h: h - d, r: 0, fill: c },
    );
  }
  parts.push({ kind: 'path', fill: shade(col(C - 1), -0.12), cmds: poly([[x + Wf, fy], [x + w, y], [x + w, y + h - d], [x + Wf, y + h]]) });
  return parts;
}

// ---------------------------------------------------------------------------
// Sequenza di token (BERT, GPT): caselle con il testo, token speciali colorati
// ---------------------------------------------------------------------------
/** Token speciali: [riempimento, bordo, testo]. */
const SPECIAL: Record<string, [string, string, string]> = {
  '[CLS]': ['#FFE6CC', '#D79B00', '#7A4A00'],
  '[SEP]': ['#E1D5E7', '#9673A6', '#4A3D6B'],
  '[MASK]': ['#5F6B7A', '#3E4651', '#FFFFFF'],
  '[PAD]': ['#F5F5F5', '#B0B0B0', '#8A8A8A'],
  '<s>': ['#FFE6CC', '#D79B00', '#7A4A00'],
  '</s>': ['#E1D5E7', '#9673A6', '#4A3D6B'],
};
const isDots = (t: string) => /^(\.\.\.|…|\$\\[lc]?dots\$)$/.test(t);

/** Colonne di una riga di N token larga w: i modelli le usano per allineare frecce e righe. */
export function tokenColumns(x: number, w: number, N: number) {
  const gap = Math.min(8, (w / N) * 0.12);
  const cw = (w - gap * (N - 1)) / N;
  return { gap, cw, center: (i: number) => x + i * (cw + gap) + cw / 2 };
}

function tokens(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const toks = n.spec.split('|').map((t) => t.trim()).filter((t) => t.length);
  if (!toks.length) return [{ kind: 'rect', x, y, w, h, r: Math.min(n.radius, h / 3), fill: n.fill }];
  const N = toks.length;
  const { gap, cw } = tokenColumns(x, w, N);
  const r = Math.min(n.radius, h / 3, cw / 3);
  const shown = toks.map((t) => (t.startsWith('*') ? t.slice(1) : t));
  // una sola dimensione del testo per tutta la riga, ridotta finché ogni token entra nella sua casella
  const base = Math.min(h * 0.48, 13);
  let size = base;
  for (const t of shown) if (!isDots(t)) size = Math.min(size, (base * (cw - 6)) / Math.max(1, textWidth(t, base, false, false, 'sans')));
  size = Math.max(6, size);
  const parts: Part[] = [];
  shown.forEach((t, i) => {
    const cx = x + i * (cw + gap);
    if (isDots(t)) {
      parts.push({ kind: 'text', x: cx + cw / 2, y: y + h / 2, text: '$\\cdots$', size: Math.max(size, 11), fill: n.textColor });
      return;
    }
    const hl = toks[i].startsWith('*');
    const sp = SPECIAL[t];
    const fill = sp ? sp[0] : hl ? tint(n.fill, -0.18) : n.fill;
    parts.push({ kind: 'rect', x: cx, y, w: cw, h, r, fill, ...(sp ? { stroke: sp[1] } : {}), ...(hl ? { sw: n.strokeWidth * 1.6 } : {}) });
    parts.push({ kind: 'text', x: cx + cw / 2, y: y + h / 2, text: t, size, fill: sp ? sp[2] : n.textColor, bold: hl });
  });
  return parts;
}

// ---------------------------------------------------------------------------
// Maschera di attenzione (query in riga, key in colonna): causale, completa, prefisso, finestra
// ---------------------------------------------------------------------------
function attnMask(n: NodeModel): Part[] {
  const ink = inkOf(n);
  const N = clamp(n.count, 2, 16);
  const s = n.spec.toLowerCase();
  const mode = /full|bidir/.test(s) ? 'full' : /prefix/.test(s) ? 'prefix' : /window|local/.test(s) ? 'window' : 'causal';
  const P = Math.ceil(N / 3), W = Math.max(2, Math.ceil(N / 3));
  const ok = (i: number, j: number) =>
    mode === 'full' || (mode === 'prefix' ? j <= i || j < P : mode === 'window' ? j <= i && i - j < W : j <= i);
  const S = Math.min(n.w, n.h);
  const c = S / N;
  const x0 = n.x + (n.w - S) / 2, y0 = n.y + (n.h - S) / 2;
  const inf = /inf/.test(s) && c >= 14;
  const parts: Part[] = [{ kind: 'rect', x: x0, y: y0, w: S, h: S, r: 0, fill: '#FFFFFF', stroke: 'none' }];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      if (ok(i, j)) parts.push({ kind: 'rect', x: x0 + j * c, y: y0 + i * c, w: c, h: c, r: 0, fill: n.fill === 'none' ? shade(ink, 0.45) : mix(n.fill, ink, 0.4), stroke: 'none' });
      else if (inf) parts.push({ kind: 'text', x: x0 + (j + 0.5) * c, y: y0 + (i + 0.5) * c, text: '$-\\infty$', size: c * 0.36, fill: '#9AA0A6' });
    }
  const g: Cmd[] = [];
  for (let k = 1; k < N; k++) g.push(...seg([x0 + k * c, y0], [x0 + k * c, y0 + S]), ...seg([x0, y0 + k * c], [x0 + S, y0 + k * c]));
  parts.push(line(g, shade(ink, 0.35), n.strokeWidth * 0.5), { kind: 'rect', x: x0, y: y0, w: S, h: S, r: 0, fill: 'none' });
  return parts;
}

// ---------------------------------------------------------------------------
// Registro delle forme, con le varianti cliccabili nel pannello
// ---------------------------------------------------------------------------
const one = (title: string, choices: (string | SpecChoice)[]): SpecGroup => ({ title, mode: 'one', choices });
const many = (title: string, choices: (string | SpecChoice)[]): SpecGroup => ({ title, mode: 'many', choices });
const value = (title: string, choices: (string | SpecChoice)[]): SpecGroup => ({ title, mode: 'value', choices });

export const DL_SHAPES: ShapeDef[] = [
  {
    kind: 'dl-dropout',
    name: 'Dropout (neuroni spenti)',
    parts: dropout,
    countLabel: 'Dropout (%)',
    countMax: 90,
    specLabel: 'Neuroni per strato',
    specOptions: [value('Strati', [{ value: '3,4,2', label: '3-4-2' }, { value: '4,5,5,2', label: '4-5-5-2' }, { value: '4,6,6,6,3', label: '4-6-6-6-3' }])],
  },
  {
    kind: 'dl-pool',
    name: 'Pooling (griglia)',
    parts: pooling,
    countLabel: 'Finestra k',
    countMax: 4,
    specLabel: 'Ingresso e tipo',
    specOptions: [
      one('Ingresso', ['4x4', '6x6', '8x8']),
      one('Tipo', [{ value: 'max', label: 'Max' }, { value: 'avg', label: 'Media' }]),
      many('Valori', [{ value: 'nonum', label: 'Senza numeri' }]),
    ],
  },
  { kind: 'dl-convvol', name: 'Convoluzione su volume', parts: convVolume, countLabel: 'Kernel k', countMax: 7, specLabel: 'Griglia', specOptions: [one('Griglia', ['5x5', '6x6', '8x8'])] },
  {
    kind: 'dl-heads',
    name: 'Teste di attention',
    parts: heads,
    countLabel: 'Teste h',
    countMax: 8,
    specLabel: 'Griglia',
    specOptions: [one('Griglia', ['4x4', '6x6', '8x8']), many('Indici', [{ value: 'idx', label: 'Numero testa' }])],
  },
  { kind: 'dl-embtable', name: 'Lookup di embedding', parts: embedding, countLabel: 'Riga selezionata', countMax: 24, specLabel: 'Tabella V x d', specOptions: [one('Tabella', ['6x4', '8x4', '10x6'])] },
  {
    kind: 'dl-landscape',
    name: 'Loss landscape',
    parts: landscape,
    countLabel: 'Passi',
    countMax: 40,
    specLabel: 'Ottimizzatore',
    specOptions: [one('Ottimizzatore', [{ value: 'gd', label: 'GD' }, { value: 'sgd', label: 'SGD' }, { value: 'momentum', label: 'Momentum' }])],
  },
  {
    kind: 'dl-softmax',
    name: 'Softmax con temperatura',
    parts: softmaxBars,
    countLabel: 'Classi',
    countMax: 12,
    specLabel: 'Temperatura T',
    specOptions: [one('Temperatura', ['0.5', '1', '2', '4', '10'].map((v) => ({ value: v, label: `T = ${v}` })))],
  },
  {
    kind: 'dl-normcube',
    name: 'Normalizzazione (cubo N, C, H·W)',
    parts: normCube,
    countLabel: 'Canali C',
    countMax: 12,
    specLabel: 'Tipo e assi',
    specOptions: [
      one('Normalizzazione', [{ value: 'batch', label: 'Batch' }, { value: 'layer', label: 'Layer' }, { value: 'instance', label: 'Instance' }, { value: 'group', label: 'Group' }]),
      many('Assi', [{ value: 'axes', label: 'Lettere degli assi' }]),
    ],
    label: (n) => {
      const b = cubeBox(n);
      return { x: b.x + (b.w * 0.64) / 2, y: b.y + b.h * 0.28 + (b.h * 0.72) / 2, anchor: 'middle' };
    },
  },
  {
    kind: 'dl-windows',
    name: 'Finestre (Swin)',
    parts: windows,
    countLabel: 'Finestre per lato',
    countMax: 6,
    specLabel: 'Variante',
    specOptions: [many('Partizione', [{ value: 'shift', label: 'Spostata' }]), one('Patch per finestra', [{ value: 'p2', label: '2' }, { value: 'p4', label: '4' }, { value: 'p6', label: '6' }])],
  },
  { kind: 'dl-resblock', name: 'Blocco residuo (icona)', parts: resBlock, countLabel: 'Layer', countMax: 4, directionLabel: 'Direzione del flusso' },
  {
    kind: 'dl-augimg',
    name: 'Immagine aumentata',
    parts: augImage,
    countLabel: 'Variante (rumore)',
    countMax: 9,
    specLabel: 'Aumentazioni',
    specOptions: [
      many('Geometriche', [{ value: 'crop', label: 'Ritaglio' }, { value: 'flip', label: 'Specchio' }, { value: 'rot', label: 'Rotazione' }, { value: 'cutout', label: 'Cutout' }]),
      many('Fotometriche', [{ value: 'color', label: 'Colore' }, { value: 'gray', label: 'Grigi' }, { value: 'blur', label: 'Sfocatura' }, { value: 'noise', label: 'Rumore' }, { value: 'sobel', label: 'Sobel' }]),
    ],
  },
  {
    kind: 'dl-triplet',
    name: 'Spazio triplet (anchor/pos/neg)',
    parts: tripletSpace,
    specLabel: 'Stato',
    specOptions: [one('Stato', [{ value: 'before', label: 'Prima' }, { value: 'after', label: 'Dopo' }]), many('Lettere', [{ value: 'nolabels', label: 'Senza lettere' }])],
  },
  {
    kind: 'dl-chcuboid',
    name: 'Tensore a canali colorati',
    parts: channelCuboid,
    countLabel: 'Canali',
    countMax: 24,
    specLabel: 'Colori',
    specOptions: [many('Colori', [{ value: 'mono', label: 'Monocromo' }])],
    label: (n) => {
      const d = Math.round(Math.min(n.w, n.h) * clamp(n.depth, 0.05, 0.9));
      return { x: n.x + (n.w - d) / 2, y: n.y + d + (n.h - d) / 2, anchor: 'middle' };
    },
  },
  {
    kind: 'dl-tokens',
    name: 'Sequenza di token',
    parts: tokens,
    specLabel: 'Token separati da | (*tok = evidenziato, ... = puntini)',
    specOptions: [
      value('Esempi', [
        { value: '[CLS]|my|dog|is|cute|[SEP]', label: 'BERT' },
        { value: '[CLS]|my|[MASK]|is|cute|[SEP]', label: 'Masked LM' },
        { value: 'The|cat|sat|on|*the', label: 'GPT' },
        { value: '[CLS]|Tok 1|...|Tok N|[SEP]', label: 'Tok 1...N' },
      ]),
    ],
  },
  {
    kind: 'dl-mask',
    name: 'Maschera di attention',
    parts: attnMask,
    countLabel: 'Token',
    countMax: 16,
    specLabel: 'Tipo di maschera',
    specOptions: [
      one('Maschera', [{ value: 'causal', label: 'Causale' }, { value: 'full', label: 'Completa' }, { value: 'prefix', label: 'Prefisso' }, { value: 'window', label: 'Finestra' }]),
      many('Valori', [{ value: 'inf', label: 'Mostra -inf' }]),
    ],
  },
];
