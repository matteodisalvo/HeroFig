// Modelli del modulo "Chimica e molecole": figure ricostruite dai paper di ML per molecole e
// materiali (MPNN, SchNet, EGNN, NequIP, JT-VAE, EDM, DiffDock, Segler, Molecular Transformer,
// CDVAE, CGCNN) e flussi di lavoro tipici (potenziali ML con active learning, screening
// virtuale, laboratorio autonomo). I blocchi sono posizionati per centro.
import { Builder, type Color } from '../builder';
import { COLORS, ICON, type NodeModel } from '../model';
import type { TemplateDef } from '../registry';

const { BLUE, GREEN, ORANGE, YELLOW, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const SEC = 'Chimica e molecole';
const INK = '#333333';
const SOFT = '#9AA0A6';
const MUTED = '#555555';
const NOARROW = { arrowEnd: false };
const PAPER = { fill: '#FAFAFB', stroke: '#B8BEC8' };
const BLUE_LINE = '#2F6FB2';

type N = NodeModel;
type P = [number, number];

/** Rettangolo dato il centro. */
const C = (cx: number, cy: number, w: number, h: number) => ({ x: cx - w / 2, y: cy - h / 2, w, h });

/** Forma del modulo senza riquadro (molecole, cristalli, grafici), etichetta sotto. */
const art = (t: Builder, shape: string, spec: string, label: string, cx: number, cy: number, w: number, h: number, extra: Partial<N> = {}) =>
  t.add({ shape, spec, label, ...C(cx, cy, w, h), fill: 'none', stroke: '#4E545C', strokeWidth: 1.2, ...ICON, fontSize: 11, ...extra });
const block = (t: Builder, label: string, cx: number, cy: number, w: number, h: number, c: Color, extra: Partial<N> = {}) =>
  t.box(label, cx - w / 2, cy - h / 2, w, h, c, { radius: 4, ...extra });
const note = (t: Builder, label: string, cx: number, cy: number, w: number, h: number, extra: Partial<N> = {}) => t.text(label, cx - w / 2, cy - h / 2, w, h, { fontSize: 11, ...extra });
const pin = (t: Builder, x: number, y: number) => t.anchor(x - 0.5, y - 0.5);
/** Segmento libero fra due punti (archi di grafi disegnati sotto i nodi, frecce di vettori). */
const segment = (t: Builder, a: P, b: P, extra: Record<string, unknown> = {}) => t.link(pin(t, ...a), pin(t, ...b), 'right', 'left', { routing: 'straight', ...NOARROW, ...extra });
const feat = (t: Builder, spec: string, cx: number, cy: number, w: number, h: number, ink: string, fill = 'none', extra: Partial<N> = {}) =>
  t.add({ shape: 'chem-feat', spec, ...C(cx, cy, w, h), fill, stroke: ink, strokeWidth: 1, ...ICON, fontSize: 11, ...extra });
const thin = { color: SOFT, width: 1, dashed: true, ...NOARROW };

// ======================================================================
// Predizione di proprietà e reti per molecole
// ======================================================================

/** Gilmer et al. 2017, "Neural Message Passing for Quantum Chemistry" (arXiv 1704.01212), Fig. 1. */
function mpnn() {
  const t = new Builder();
  const mol = t.add({ shape: 'ellipse', ...C(64, 150, 108, 108), fill: '#C9CDD3', stroke: INK, strokeWidth: 1.2 });
  t.add({ shape: 'chem-skeletal', spec: 'ethylnaphthalene', ...C(64, 150, 80, 62), fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.6 });
  const dft = block(t, 'DFT', 255, 60, 110, 42, YELLOW, { bold: true, fontSize: 13 });
  note(t, '$\\sim 10^{3}$ seconds', 255, 98, 120, 18);
  const targets = block(t, 'Targets', 665, 60, 130, 58, GREEN, { fontSize: 10, sublabel: '$E,\\ \\omega_0,\\ \\ldots$', subSize: 16 });
  const g = t.group('Message Passing Neural Net', 190, 140, 420, 140, { dashed: false, fill: '#F2F7FD', stroke: '#6C8EBF', textColor: '#2F4F7F', bold: true });
  const mg = (spec: string, label: string, cx: number, extra: Partial<N> = {}) => art(t, 'chem-molgraph', spec, label, cx, 212, 112, 74, { ...extra });
  const g0 = mg('ethylnaphthalene', '$t = 0$', 265);
  const g1 = mg('ethylnaphthalene messages', '$t = 1$', 400, { count: 3 });
  const g2 = mg('ethylnaphthalene mono', '$t = T$', 535, { fill: '#E1D5E7', stroke: '#9673A6' });
  t.chain([g0, g1, g2]);
  note(t, '$\\sim 10^{-2}$ seconds', 400, 296, 130, 18);
  t.link(mol, dft, 'right', 'left');
  t.link(mol, g, 'right', 'left');
  t.link(dft, targets);
  t.link(g, targets, 'right', 'bottom', { label: 'readout', labelPos: 'below', fontSize: 10 });
  // le tre funzioni del framework MPNN
  const eq = (title: string, formula: string, cx: number) => block(t, title, cx, 360, 236, 66, PAPER, { radius: 10, bold: true, fontSize: 11, sublabel: formula, subSize: 13 });
  eq('Message function', '$m_v^{t+1} = \\sum_{w \\in N(v)} M_t(h_v^t, h_w^t, e_{vw})$', 120);
  eq('Vertex update', '$h_v^{t+1} = U_t(h_v^t, m_v^{t+1})$', 372);
  eq('Readout', '$\\hat{y} = R(\\{h_v^T \\mid v \\in G\\})$', 624);
  return t.done();
}

/** Schütt et al. 2017, "SchNet: a continuous-filter convolutional neural network" (arXiv 1706.08566), Fig. 2. */
function schnet() {
  const t = new Builder();
  const W = { fill: '#FFFFFF', stroke: INK };
  const io = (label: string, cx: number, cy: number, w = 120) => note(t, label, cx, cy, w, 24, { fontSize: 14 });
  // architettura
  const z = io('$(Z_1, \\ldots, Z_n)$', 75, 20);
  const r = io('$(\\mathbf{r}_1, \\ldots, \\mathbf{r}_n)$', 205, 20);
  const col: [string, Color][] = [
    ['embedding, 64', GREEN], ['interaction, 64', YELLOW], ['interaction, 64', YELLOW], ['interaction, 64', YELLOW],
    ['atom-wise, 32', BLUE], ['shifted softplus', BLUE], ['atom-wise, 1', BLUE], ['sum pooling', BLUE],
  ];
  const boxes = col.map(([s, c], i) => block(t, s, 75, 62 + i * 40, 130, 26, c, { fontSize: 11, radius: 2 }));
  const e = io('$\\hat{E}$', 75, 400, 30);
  t.chain([z, ...boxes], 'down', NOARROW);
  t.link(boxes[7], e, 'bottom', 'top');
  let prev: N = r;
  for (let i = 1; i <= 3; i++) {
    const a = pin(t, 205, 62 + i * 40);
    t.link(prev, a, 'bottom', 'top', { routing: 'straight', ...NOARROW });
    t.link(a, boxes[i], 'left', 'right');
    prev = a;
  }
  const sep = (x: number) => segment(t, [x, 0], [x, 410], { dashed: true, color: '#555555', width: 2 });
  sep(262);
  sep(560);
  // blocco di interazione
  t.group('', 285, 52, 250, 300, { dashed: false, fill: '#FFF2CC', stroke: INK, radius: 2 });
  const xin = io('$(\\mathbf{x}^l_1, \\ldots, \\mathbf{x}^l_n)$', 330, 20, 130);
  const rin = io('$(\\mathbf{r}_1, \\ldots, \\mathbf{r}_n)$', 512, 20);
  const ib: [string, Color][] = [['atom-wise, 64', W], ['cfconv, 64', { fill: '#F8CBAD', stroke: INK }], ['atom-wise, 64', W], ['shifted softplus', W], ['atom-wise, 64', W]];
  const ibox = ib.map(([s, c], i) => block(t, s, 432, 102 + i * 44, 122, 28, c, { fontSize: 12, radius: 1 }));
  const plus = t.op('+', 316, 307, { w: 28, h: 28, fontSize: 18 });
  const xout = io('$(\\mathbf{x}^{l+1}_1, \\ldots, \\mathbf{x}^{l+1}_n)$', 330, 392, 150);
  const split = pin(t, 330, 66);
  t.link(xin, split, 'bottom', 'top', { routing: 'straight', ...NOARROW });
  t.link(split, plus, 'bottom', 'top', { routing: 'straight', ...NOARROW });
  t.link(split, ibox[0], 'right', 'top', NOARROW);
  t.chain(ibox, 'down', NOARROW);
  t.link(ibox[4], plus, 'bottom', 'right');
  t.link(rin, ibox[1], 'bottom', 'right');
  t.link(plus, xout, 'bottom', 'top');
  note(t, '$(\\mathbf{v}^l_1, \\ldots, \\mathbf{v}^l_n)$', 470, 312, 110, 20, { fontSize: 13 });
  note(t, 'interaction', 478, 338, 100, 24, { fontSize: 17 });
  // convoluzione a filtro continuo
  t.group('', 585, 52, 260, 300, { dashed: false, fill: '#FBD3B5', stroke: INK, radius: 2 });
  const cx0 = 630;
  const cin = io('$(\\mathbf{x}^l_1, \\ldots, \\mathbf{x}^l_n)$', cx0, 20, 130);
  const crin = io('$(\\mathbf{r}_1, \\ldots, \\mathbf{r}_n)$', 768, 20);
  const fb: string[] = ['$\\|\\mathbf{r}_i - \\mathbf{r}_j\\|$', 'rbf, 300', 'dense, 64', 'shifted softplus', 'dense, 64', 'shifted softplus'];
  const fbox = fb.map((s, i) => block(t, s, 768, 84 + i * 38, 118, 26, W, { fontSize: i === 0 ? 13 : 12, radius: 1 }));
  const conv = t.op('$*$', cx0 - 14, 307, { w: 28, h: 28, fontSize: 16 });
  const cout = io('$(\\mathbf{x}^{l+1}_1, \\ldots, \\mathbf{x}^{l+1}_n)$', cx0, 392, 150);
  t.link(cin, conv, 'bottom', 'top', NOARROW);
  t.link(crin, fbox[0], 'bottom', 'top', NOARROW);
  t.chain(fbox, 'down', NOARROW);
  t.link(fbox[5], conv, 'bottom', 'right');
  t.link(conv, cout, 'bottom', 'top');
  note(t, '$W^l$', 668, 336, 30, 20, { fontSize: 15 });
  note(t, 'cfconv', 800, 338, 70, 24, { fontSize: 17 });
  return t.done();
}

/** Satorras et al. 2021, "E(n) Equivariant Graph Neural Networks" (arXiv 2102.09844), Fig. 1 + EGCL. */
function egnn() {
  const t = new Builder();
  const base: P[] = [[118, 140], [168, 92], [96, 66], [24, 58]];
  const vel: P[] = [[-30, -2], [28, 16], [-8, -36], [22, -26]];
  const out: P[] = [[124, 146], [172, 86], [92, 62], [20, 70]];
  const velOut: P[] = [[-30, 14], [4, 30], [-26, -24], [-14, -30]];
  const hIn = ['0.25 0.5 0.6', '0.6 0.35 0.2', '0.35 0.3 0.7', '0.7 0.25 0.45'];
  const hOut = ['0.6 0.3 0.2', '0.5 -0.2 0.8', '0.7 0.35 0.2', '-0.25 0.6 0.5'];
  const E: [number, number][] = [[3, 2], [2, 1], [2, 0], [0, 1]];
  const rot = (p: P, th: number, c: P): P => {
    const dx = p[0] - c[0], dy = p[1] - c[1];
    return [c[0] + dx * Math.cos(th) - dy * Math.sin(th), c[1] + dx * Math.sin(th) + dy * Math.cos(th)];
  };
  const TH = 2.75;
  const distSeg = (p: P, a: P, b: P) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dy);
  };
  const graph = (ox: number, oy: number, pts: P[], v: P[], h: string[], th: number, vcol: string, hcol: [string, string]) => {
    const c: P = [96, 100];
    const q = pts.map((p) => rot(p, th, c)).map((p): P => [ox + p[0], oy + p[1]]);
    const vv = v.map((p) => rot(p, th, [0, 0]));
    const obstacles: [P, P][] = E.map(([a, b]): [P, P] => [q[a], q[b]]);
    for (const [a, b] of E) segment(t, q[a], q[b], { color: '#222222', width: 1.8 });
    const arrows = q.map((p, i): [P, P, P] => {
      const u = Math.hypot(vv[i][0], vv[i][1]);
      const d: P = [vv[i][0] / u, vv[i][1] / u];
      const s0: P = [p[0] + d[0] * 17, p[1] + d[1] * 17];
      return [s0, [s0[0] + vv[i][0], s0[1] + vv[i][1]], d];
    });
    arrows.forEach(([s0, e]) => obstacles.push([s0, e]));
    const taken: P[] = [];
    q.forEach((p, i) => {
      t.add({ shape: 'ellipse', label: `$\\mathbf{x}_${i + 1}$`, ...C(p[0], p[1], 32, 32), fill: '#B4CCAA', stroke: '#2F3B2F', strokeWidth: 1.8, fontSize: 13 });
      const [s0, e, d] = arrows[i];
      segment(t, s0, e, { arrowEnd: true, dashed: true, color: vcol, width: 1.8 });
      note(t, `$\\mathbf{v}_${i + 1}$`, (s0[0] + e[0]) / 2 - d[1] * 11, (s0[1] + e[1]) / 2 + d[0] * 11, 18, 14, { fontSize: 10, textColor: vcol });
      // istogramma delle feature nella direzione più libera attorno al nodo
      const score = (hc: P) => {
        const probes: P[] = [hc, [hc[0] - 14, hc[1]], [hc[0] + 14, hc[1]], [hc[0] + 26, hc[1] + 3]];
        return Math.min(
          ...probes.flatMap((pr) => [
            ...q.map((o) => Math.hypot(pr[0] - o[0], pr[1] - o[1]) - 17),
            ...obstacles.map(([a, b]) => distSeg(pr, a, b) - 4),
            ...taken.map((o) => Math.hypot(pr[0] - o[0], pr[1] - o[1]) - 30),
            ...arrows.map(([a, b]) => Math.hypot(pr[0] - (a[0] + b[0]) / 2, pr[1] - (a[1] + b[1]) / 2) - 12),
          ]),
        );
      };
      const cands = Array.from({ length: 16 }, (_, k): P => [p[0] + Math.cos((k * Math.PI) / 8) * 38, p[1] + Math.sin((k * Math.PI) / 8) * 30]);
      const hc = cands.reduce((a, b2) => (score(b2) > score(a) ? b2 : a));
      taken.push(hc);
      feat(t, h[i], hc[0], hc[1], 28, 15, hcol[1], hcol[0]);
      note(t, `$\\mathbf{h}_${i + 1}$`, hc[0] + 22, hc[1] + 3, 16, 14, { fontSize: 10 });
    });
  };
  const top: [string, string] = ['#6EC1D6', '#2B7A8C'], bot: [string, string] = ['#F2907F', '#B5483A'];
  graph(0, 0, base, vel, hIn, 0, '#F07A5F', top);
  graph(330, 0, base, vel, hIn, TH, '#F07A5F', top);
  graph(0, 250, out, velOut, hOut, 0, '#2E7D8A', bot);
  graph(330, 250, out, velOut, hOut, TH, '#2E7D8A', bot);
  // trasformazioni e mappa equivariante
  t.link(pin(t, 232, 105), pin(t, 312, 105), 'right', 'left', { routing: 'straight', label: '$S_g$', labelPos: 'below', fontSize: 13, width: 1.6, color: INK });
  t.link(pin(t, 232, 355), pin(t, 312, 355), 'right', 'left', { routing: 'straight', label: '$T_g$', labelPos: 'below', fontSize: 13, width: 1.6, color: INK });
  t.add({ shape: 'cycle', ...C(272, 82, 20, 20), fill: 'none', stroke: INK, dashed: true, strokeWidth: 1 });
  t.add({ shape: 'cycle', ...C(272, 332, 20, 20), fill: 'none', stroke: INK, dashed: true, strokeWidth: 1 });
  t.link(pin(t, 96, 200), pin(t, 96, 262), 'bottom', 'top', { routing: 'straight', label: '$\\phi$', labelPos: 'below', fontSize: 18, width: 1.6, color: INK });
  t.link(pin(t, 426, 200), pin(t, 426, 262), 'bottom', 'top', { routing: 'straight', label: '$\\phi$', labelPos: 'below', fontSize: 18, width: 1.6, color: INK });
  // strato EGCL
  t.group('Equivariant Graph Convolutional Layer (EGCL)', 560, 40, 300, 330, { dashed: false, ...PAPER, textColor: '#444444', bold: true });
  const eqs = [
    '$\\mathbf{m}_{ij} = \\phi_e(\\mathbf{h}_i^l, \\mathbf{h}_j^l, \\|\\mathbf{x}_i^l - \\mathbf{x}_j^l\\|^2, a_{ij})$',
    '$\\mathbf{x}_i^{l+1} = \\mathbf{x}_i^l + C \\sum_{j \\neq i} (\\mathbf{x}_i^l - \\mathbf{x}_j^l)\\, \\phi_x(\\mathbf{m}_{ij})$',
    '$\\mathbf{m}_i = \\sum_{j \\neq i} \\mathbf{m}_{ij}$',
    '$\\mathbf{h}_i^{l+1} = \\phi_h(\\mathbf{h}_i^l, \\mathbf{m}_i)$',
  ];
  const tags = ['edge message', 'equivariant coordinate update', 'aggregation', 'node update'];
  eqs.forEach((s, i) => {
    note(t, tags[i], 710, 82 + i * 74, 280, 16, { fontSize: 10, textColor: '#7A808A' });
    note(t, s, 710, 108 + i * 74, 290, 40, { fontSize: 13 });
  });
  return t.done();
}

/** Batzner et al. 2022, "E(3)-equivariant graph neural networks for data-efficient interatomic potentials" — NequIP (arXiv 2101.03164), Fig. 1. */
function nequip() {
  const t = new Builder();
  const W = { fill: '#F3F6FA', stroke: '#9AA0A6' };
  const io = (label: string, cx: number, cy: number, w = 120, extra: Partial<N> = {}) => note(t, label, cx, cy, w, 22, { fontSize: 13, bold: true, ...extra });
  // architettura
  const z = io('$(Z_1, \\ldots, Z_n)$', 80, 20);
  const r = io('$(\\mathbf{r}_1, \\ldots, \\mathbf{r}_n)$', 200, 20);
  const col: [string, Color][] = [
    ['Embedding', { fill: '#BDEFF7', stroke: '#2BB5C8' }], ['Interaction Block', BLUE], ['Interaction Block', BLUE], ['Interaction Block', BLUE],
    ['Self-Interaction', W], ['Self-Interaction', W], ['Global Pooling', { fill: '#F9C9E6', stroke: '#C2408F' }],
  ];
  const ys = [62, 106, 150, 194, 244, 286, 336];
  const boxes = col.map(([s, c], i) => block(t, s, 80, ys[i], 140, 24, c, { fontSize: 11, bold: true, radius: 5 }));
  const e = io('$E$', 80, 396, 30, { fontSize: 15 });
  t.chain([z, ...boxes], 'down', NOARROW);
  t.link(boxes[6], e, 'bottom', 'top');
  let prev: N = r;
  for (let i = 1; i <= 3; i++) {
    const a = pin(t, 200, ys[i]);
    t.link(prev, a, 'bottom', 'top', { routing: 'straight', ...NOARROW });
    t.link(a, boxes[i], 'left', 'right');
    prev = a;
  }
  t.add({ shape: 'brace', direction: 'right', ...C(166, 265, 14, 64), fill: 'none', stroke: MUTED, strokeWidth: 1.2 });
  note(t, 'Output Block', 222, 265, 90, 18, { fontSize: 11, bold: true });
  // blocco di interazione
  t.group('', 372, 50, 270, 314, { dashed: false, fill: '#CFE0F7', stroke: '#9DB8DE', radius: 8 });
  const mx = 420;
  const lin = io('$l = 0, 1, 2$', mx, 20, 80);
  const rin = io('$(\\mathbf{r}_1, \\ldots, \\mathbf{r}_n)$', 630, 20);
  const ib: [string, Color][] = [['Self-Interaction', W], ['Convolution', { fill: '#BFF5D7', stroke: '#2FB673' }], ['Concatenation', W], ['Self-Interaction', W]];
  const ibox = ib.map(([s, c], i) => block(t, s, 548, 104 + i * 48, 140, 24, c, { fontSize: 11, bold: true, radius: 5 }));
  const split = pin(t, mx, 72);
  const mul = t.op('$\\times$', mx - 13, 252, { fontSize: 15 });
  const add = t.op('+', mx - 13, 292, { fontSize: 16 });
  block(t, 'Non-Linearity', mx + 30, 342, 130, 24, W, { fontSize: 11, bold: true, radius: 5 });
  const zin = io('$(Z_1, \\ldots, Z_n)$', 322, 265, 92);
  t.link(lin, split, 'bottom', 'top', { routing: 'straight', ...NOARROW });
  t.link(split, mul, 'bottom', 'top', NOARROW);
  t.link(split, ibox[0], 'right', 'top', NOARROW);
  t.chain(ibox, 'down', NOARROW);
  t.link(rin, ibox[1], 'bottom', 'right');
  t.link(zin, mul, 'right', 'left');
  t.link(mul, add, 'bottom', 'top', NOARROW);
  t.link(ibox[3], add, 'bottom', 'right');
  t.link(add, pin(t, mx, 330), 'bottom', 'top', { routing: 'straight', ...NOARROW });
  t.link(pin(t, mx, 354), pin(t, mx, 400), 'bottom', 'top', { routing: 'straight' });
  // convoluzione: armoniche sferiche, base radiale e prodotto tensoriale
  t.group('', 690, 50, 300, 314, { dashed: false, fill: '#C9F2DD', stroke: '#7FCFA5', radius: 8 });
  const cx = 770;
  const lin2 = io('$l = 0, 1, 2$', cx, 20, 80);
  const rin2 = io('$(\\mathbf{r}_1, \\ldots, \\mathbf{r}_n)$', 935, 20);
  const yx = 830;
  const ybox = block(t, '', yx, 182, 74, 158, W, { radius: 6 });
  note(t, '$Y^{(l)}_m$', yx, 145, 70, 34, { fontSize: 22 });
  t.add({ shape: 'chem-orbital', spec: 'table', count: 1, ...C(yx, 218, 62, 50), strokeWidth: 0.8 });
  const nbox = ['Norm', 'Basis', 'MLP'].map((s, i) => block(t, s, 935, 96 + i * 76, 92, 24, W, { fontSize: 11, bold: true, radius: 5 }));
  const tp = block(t, 'Tensor Product', cx, 300, 160, 26, W, { fontSize: 11, bold: true, radius: 5 });
  t.link(lin2, tp, 'bottom', 'top', NOARROW);
  t.link(rin2, nbox[0], 'bottom', 'top');
  t.link(pin(t, 935, 62), ybox, 'left', 'top');
  t.link(nbox[0], nbox[1], 'bottom', 'top', NOARROW);
  t.link(nbox[1], nbox[2], 'bottom', 'top', NOARROW);
  t.link(ybox, pin(t, yx, 287), 'bottom', 'top');
  t.link(nbox[2], tp, 'bottom', 'right');
  t.link(tp, pin(t, cx, 400), 'bottom', 'top', { routing: 'straight' });
  return t.done();
}

/** Rappresentazioni di una molecola (SMILES, fingerprint, grafo 2D, conformero 3D) e famiglie di modelli. */
function molrep() {
  const t = new Builder();
  const mol = art(t, 'chem-skeletal', 'aspirin color', 'Aspirin', 80, 205, 140, 110, { stroke: INK, fontSize: 12 });
  const R = 360;
  const reps = [
    t.add({ shape: 'chem-smiles', spec: 'CC(=O)Oc1ccccc1C(=O)O', label: 'SMILES (1D string)', ...C(R, 50, 260, 22), radius: 3, ...ICON, fontSize: 11, ...GRAY }),
    t.add({ shape: 'chem-smiles', spec: 'CC(=O)Oc1ccccc1C(=O)O bits', count: 32, label: 'ECFP fingerprint', ...C(R, 140, 230, 14), ...ICON, fontSize: 11, fill: 'none', stroke: '#3A3F47' }),
    art(t, 'chem-molgraph', 'aspirin labels', '2D molecular graph $G = (V, E)$', R, 240, 150, 92),
    art(t, 'chem-molecule', 'aspirin', '3D conformer $\\{(Z_i, \\mathbf{r}_i)\\}$', R, 370, 130, 106, { count: 1 }),
  ];
  const models: [string, string, Color][] = [
    ['Transformer / RNN', 'language models', BLUE],
    ['MLP / random forest', 'descriptor models', GREEN],
    ['GNN (MPNN)', 'message passing', ORANGE],
    ['Equivariant GNN', 'SchNet, EGNN, NequIP', PURPLE],
  ];
  const ys = [50, 140, 240, 370];
  const mods = models.map(([s, sub, c], i) => block(t, s, 620, ys[i], 150, 48, c, { fontSize: 12, sublabel: sub, subSize: 10 }));
  const y = block(t, 'Property $\\hat{y}$', 820, 210, 130, 64, TEAL, { fontSize: 13, sublabel: 'solubility, toxicity,\nbinding affinity, $E_{\\mathrm{HOMO}}$', subSize: 10 });
  // una dorsale verticale distribuisce la molecola alle quattro rappresentazioni
  const BX = 185;
  t.link(mol, pin(t, BX, 205), 'right', 'left', { routing: 'straight', ...NOARROW });
  segment(t, [BX, ys[0]], [BX, ys[3]], { color: '#4B5563', width: 1.2 });
  reps.forEach((r, i) => {
    t.link(pin(t, BX, ys[i]), r, 'right', 'left', { routing: 'straight' });
    t.link(r, mods[i]);
    t.link(mods[i], y, 'right', 'left');
  });
  return t.done();
}

// ======================================================================
// Potenziali interatomici e materiali
// ======================================================================

/** Potenziale interatomico ML con active learning (DFT → MLIP → MD → incertezza → DFT), come in DP-GEN e simili. */
function mlip() {
  const t = new Builder();
  t.group('Active learning loop', 0, 0, 690, 336, { textColor: MUTED, bold: true });
  const data = t.add({ shape: 'cylinder', label: 'Reference data', sublabel: '$\\mathcal{D} = \\{(\\mathbf{R}, E, \\mathbf{F})\\}$', ...C(95, 105, 130, 78), fontSize: 12, subSize: 11, strokeWidth: 1.2, ...GRAY });
  const model = t.add({ shape: 'stack', count: 3, label: 'MLIP committee', sublabel: '$\\hat{E}^{(k)}_\\theta(\\mathbf{R}),\\ k = 1..K$', ...C(345, 105, 170, 70), fontSize: 12, subSize: 11, strokeWidth: 1.2, ...PURPLE });
  note(t, '$\\mathcal{L} = \\lambda_E (E - \\hat{E})^2 + \\lambda_F \\sum_i \\|\\mathbf{F}_i - \\hat{\\mathbf{F}}_i\\|^2$', 345, 40, 290, 34, { fontSize: 12 });
  const md = art(t, 'chem-crystal', 'liquid', 'MD with $\\hat{\\mathbf{F}}_i = -\\nabla_{\\mathbf{r}_i} \\hat{E}$', 600, 105, 96, 96, { count: 16, labelPos: 'above' });
  const unc = t.add({ shape: 'diamond', label: '$\\sigma_F > \\tau$ ?', ...C(600, 262, 120, 70), fontSize: 13, strokeWidth: 1.2, ...YELLOW });
  note(t, '$\\sigma_F = \\max_i \\mathrm{std}_k(\\mathbf{F}^{(k)}_i)$', 600, 315, 200, 22, { fontSize: 11 });
  const dft = block(t, 'DFT single points', 345, 262, 160, 52, ORANGE, { fontSize: 12, sublabel: 'label new $(E, \\mathbf{F})$', subSize: 11 });
  const lab = { labelPos: 'above' as const, fontSize: 11 };
  t.link(data, model, 'right', 'left', { label: 'train', ...lab });
  t.link(model, md, 'right', 'left', { label: 'forces', ...lab });
  t.link(md, unc, 'bottom', 'top', { label: 'sampled configurations', labelPos: 'center', fontSize: 10 });
  t.link(unc, dft, 'left', 'right', { label: 'yes', ...lab });
  t.link(dft, data, 'left', 'bottom', { label: 'augment $\\mathcal{D}$', labelPos: 'below', fontSize: 11 });
  // produzione: dinamica lunga e proprietà
  const prod = block(t, 'Production MD', 860, 262, 130, 48, GREEN, { fontSize: 12, sublabel: 'ns–μs, $10^{3}$–$10^{6}$ atoms', subSize: 10 });
  t.link(unc, prod, 'right', 'left', { label: 'no', ...lab });
  const rdf = t.add({ shape: 'chem-spectrum', spec: 'rdf labels', label: 'Structure and dynamics', ...C(860, 120, 140, 80), fill: 'none', stroke: BLUE_LINE, strokeWidth: 1.2, ...ICON, fontSize: 11, labelPos: 'above' });
  t.link(prod, rdf, 'top', 'bottom');
  return t.done();
}

/** Xie & Grossman 2018, "Crystal Graph Convolutional Neural Networks" — CGCNN (arXiv 1710.10324), Fig. 1. */
function cgcnn() {
  const t = new Builder();
  const OR = '#E67E22', PU = '#7B4FA0';
  note(t, '(a)', 12, 8, 24, 18, { bold: true, fontSize: 13 });
  const crystal = art(t, 'chem-crystal', 'nacl bonds', '', 110, 110, 170, 170);
  const env = (cy: number, col: string, fill: string, ink: string, spec: string, label: string) => {
    const a = t.add({ shape: 'ellipse', ...C(330, cy, 26, 26), fill, stroke: ink, strokeWidth: 1.2 });
    feat(t, spec, 370, cy, 12, 46, col);
    note(t, label, 410, cy, 40, 20, { fontSize: 13 });
    return a;
  };
  const e1 = env(40, OR, '#93D48D', '#4E9A48', 'cells 0.3 0.9 0.5 0.3 0.6', '$\\mathbf{v}_i$');
  const e2 = env(110, OR, '#B9A3E3', '#7360AE', 'cells 0.5 0.3 0.8 0.3 0.4', '$\\mathbf{v}_j$');
  const bond = t.add({ shape: 'rect', ...C(330, 180, 44, 6), radius: 3, fill: '#C9CDD3', stroke: '#80868E', strokeWidth: 0.8 });
  feat(t, 'cells 0.9 0.4 0.7', 370, 180, 12, 30, PU);
  note(t, '$\\mathbf{u}_{(i,j)_k}$', 416, 180, 50, 20, { fontSize: 13 });
  const curve = { routing: 'curve' as const, color: INK, width: 1.2 };
  t.link(crystal, e1, 'right', 'left', curve);
  t.link(crystal, e2, 'right', 'left', curve);
  t.link(crystal, bond, 'right', 'left', curve);
  const graph = art(t, 'chem-crystal', 'graph', 'Crystal graph', 590, 110, 160, 150, { stroke: '#5B78B0' });
  t.link(pin(t, 440, 40), graph, 'right', 'left', curve);
  t.link(pin(t, 440, 110), graph, 'right', 'left', curve);
  t.link(pin(t, 445, 180), graph, 'right', 'left', curve);
  // (b) convoluzioni sul grafo, pooling e strati densi
  note(t, '(b)', 12, 252, 24, 18, { bold: true, fontSize: 13 });
  const Y = 345;
  const g1 = art(t, 'chem-crystal', 'graph', '', 80, Y, 130, 122, { stroke: '#5B78B0' });
  t.group('', 168, Y - 62, 92, 124, { stroke: INK, radius: 6 });
  feat(t, 'cells 0.3 0.9 0.5 0.3 0.6', 214, Y - 38, 10, 40, OR);
  [190, 214, 238].forEach((x, i) => feat(t, ['cells 0.6 0.3 0.8 0.5 0.9 0.4 0.7', 'cells 0.4 0.8 0.3 0.6 0.9 0.5 0.8', 'cells 0.7 0.5 0.9 0.4 0.6 0.3 0.9'][i], x, Y + 22, 10, 64, i === 1 ? OR : PU));
  t.link(g1, pin(t, 168, Y), 'right', 'left', { routing: 'straight' });
  const nn = (cx: number, label: string) => art(t, 'mlp', '1,4,1', label, cx, Y, 70, 96, { fill: '#9AA0A6', stroke: '#6B7179', fontSize: 12 });
  const h1 = nn(300, '$L_1$ hidden');
  note(t, 'R Conv', 214, Y + 78, 70, 18, { fontSize: 12 });
  t.link(pin(t, 260, Y), h1, 'right', 'left', { routing: 'straight' });
  const g2 = art(t, 'chem-crystal', 'graph', '', 425, Y, 130, 122, { stroke: '#5B78B0' });
  t.link(h1, g2, 'right', 'left');
  t.add({ shape: 'brace', direction: 'right', ...C(500, Y, 16, 110), fill: 'none', stroke: MUTED, strokeWidth: 1.4 });
  note(t, 'Pooling', 470, Y + 78, 70, 18, { fontSize: 12 });
  const pooled = feat(t, 'cells 0.8 0.3 0.6 0.9 0.2 0.5 0.7 0.4 0.9', 530, Y, 12, 92, '#3A3F47');
  const h2 = nn(605, '$L_2$ hidden');
  t.link(pooled, h2, 'right', 'left');
  const o = t.add({ shape: 'ellipse', label: 'Output', labelPos: 'below', ...C(690, Y, 26, 26), fontSize: 12, fill: '#D5D7DB', stroke: '#6B7179', strokeWidth: 1.2 });
  t.link(h2, o, 'right', 'left');
  note(t, '$\\mathbf{v}_i^{(t+1)} = \\mathbf{v}_i^{(t)} + \\sum_{j,k} \\sigma(\\mathbf{z}^{(t)}_{(i,j)_k} \\mathbf{W}_f + \\mathbf{b}_f) \\odot g(\\mathbf{z}^{(t)}_{(i,j)_k} \\mathbf{W}_s + \\mathbf{b}_s)$', 360, 452, 560, 44, { fontSize: 13 });
  return t.done();
}

/** Xie et al. 2022, "Crystal Diffusion Variational Autoencoder" — CDVAE (arXiv 2110.06197), Fig. 2. */
function cdvae() {
  const t = new Builder();
  const GEN = { color: BLUE_LINE, width: 1.3 };
  const cell = (spec: string, cx: number, cy: number, s = 70, extra: Partial<N> = {}) =>
    t.add({ shape: 'chem-crystal', spec: `cell2d ${spec}`, count: 4, ...C(cx, cy, s, s), radius: 2, fill: '#FFFFFF', stroke: '#555555', strokeWidth: 1.2, dashed: true, ...ICON, fontSize: 12, ...extra });
  const M = cell('', 60, 150, 72, { label: '$M = (\\mathbf{A}, \\mathbf{X}, \\mathbf{L})$' });
  const z = feat(t, 'cells 0.95 0.5 0.15 0.8 0.35 0.9 0.6 0.2 0.75', 245, 150, 14, 92, '#222222');
  note(t, '$\\mathbf{z}$', 227, 207, 20, 18, { fontSize: 14 });
  t.link(M, z, 'right', 'left', { label: 'Encode', labelPos: 'above', fontSize: 11, color: INK });
  note(t, '$\\mathrm{PGNN_{Enc}}(M)$', 165, 168, 100, 18, { fontSize: 12 });
  // ramo di addestramento del decoder: rumore e denoising
  const noisy = cell('noisy', 440, 40);
  t.link(M, pin(t, 404, 26), 'top', 'left', { dashed: true, color: INK, label: 'Add noises $\\mathbf{A}, \\mathbf{X} \\to \\tilde{\\mathbf{A}}, \\tilde{\\mathbf{X}}$', labelPos: 'above', fontSize: 11 });
  t.link(z, pin(t, 404, 56), 'top', 'left', { color: INK, label: 'Conditional', labelPos: 'above', fontSize: 10 });
  const clean = cell('', 760, 40);
  t.link(noisy, clean, 'right', 'left', { color: INK, label: 'Denoise $\\tilde{\\mathbf{A}}, \\tilde{\\mathbf{X}}$', labelPos: 'above', fontSize: 11 });
  note(t, '$\\mathrm{PGNN_{Dec}}(\\tilde{M} \\mid \\mathbf{z})$', 600, 58, 150, 20, { fontSize: 12 });
  const ldec = note(t, '$\\mathcal{L}_{\\mathrm{Dec}}$', 855, 40, 40, 22, { fontSize: 14 });
  t.link(clean, ldec, 'right', 'left', { color: INK });
  // proprietà aggregate predette da z
  const agg = t.group('', 370, 116, 460, 74, { stroke: '#9AA0A6', radius: 4 });
  t.link(z, agg, 'right', 'left', { color: INK, label: 'Predict', labelPos: 'above', fontSize: 11 });
  note(t, '$\\mathrm{MLP_{Agg}}(\\mathbf{z})$', 305, 168, 100, 18, { fontSize: 12 });
  t.add({ shape: 'ellipse', ...C(410, 138, 13, 13), fill: '#EF6A4C', stroke: '#B84A33', strokeWidth: 0.8 });
  t.add({ shape: 'ellipse', ...C(410, 160, 13, 13), fill: '#6FC8B5', stroke: '#3E9483', strokeWidth: 0.8 });
  note(t, '0.5', 436, 138, 26, 16, { fontSize: 12 });
  note(t, '0.5', 436, 160, 26, 16, { fontSize: 12 });
  note(t, 'Composition $\\mathbf{c}$', 425, 180, 110, 16, { fontSize: 10 });
  note(t, '+', 496, 150, 16, 16, { fontSize: 14 });
  t.add({ ...C(590, 147, 36, 36), radius: 1, fill: 'none', stroke: INK, strokeWidth: 1.2, dashed: true });
  note(t, 'Lattice $\\mathbf{L}$', 590, 180, 80, 16, { fontSize: 10 });
  note(t, '+', 670, 150, 16, 16, { fontSize: 14 });
  note(t, '4', 760, 147, 20, 20, { fontSize: 15 });
  note(t, '# of atoms $N$', 760, 180, 90, 16, { fontSize: 10 });
  const lagg = note(t, '$\\mathcal{L}_{\\mathrm{Agg}}$', 875, 153, 40, 22, { fontSize: 14 });
  t.link(agg, lagg, 'right', 'left', { color: INK });
  // generazione: inizializzazione casuale e dinamica di Langevin
  const rnd = cell('random', 440, 270);
  t.link(pin(t, 405, 190), pin(t, 405, 234), 'bottom', 'top', { routing: 'straight', ...GEN, label: 'Rand. init.', labelPos: 'center', fontSize: 10 });
  t.link(z, rnd, 'bottom', 'left', { ...GEN, label: 'Conditional', labelPos: 'below', fontSize: 10 });
  const s1 = cell('noisy', 555, 270, 38);
  const s2 = cell('', 630, 270, 38);
  const fin = cell('', 760, 270);
  t.chain([rnd, s1, s2, fin], 'right', GEN);
  note(t, 'Langevin dynamics', 592, 238, 120, 16, { fontSize: 11 });
  note(t, '$\\mathrm{PGNN_{Dec}}(\\tilde{M} \\mid \\mathbf{z})$', 592, 302, 150, 20, { fontSize: 12 });
  // legenda
  t.link(pin(t, 10, 250), pin(t, 70, 250), 'right', 'left', { routing: 'straight', color: INK, width: 1.3 });
  note(t, 'Training', 110, 250, 70, 16, { fontSize: 11 });
  t.link(pin(t, 10, 276), pin(t, 70, 276), 'right', 'left', { routing: 'straight', ...GEN });
  note(t, 'Generation', 114, 276, 80, 16, { fontSize: 11 });
  return t.done();
}

// ======================================================================
// Modelli generativi e docking
// ======================================================================

/** Jin, Barzilay & Jaakkola 2018, "Junction Tree Variational Autoencoder" — JT-VAE (arXiv 1802.04364), Fig. 3. */
function jtvae() {
  const t = new Builder();
  const top = { labelPos: 'above' as const, fontSize: 13 };
  const mol = art(t, 'chem-skeletal', 'jtmol', 'Molecule', 110, 90, 190, 120, { stroke: INK, ...top });
  const dec = art(t, 'chem-skeletal', 'jtmol', '', 110, 600, 190, 120, { stroke: INK });
  const tree = art(t, 'chem-skeletal', 'jtmol clusters', 'Tree decomposition', 450, 90, 200, 128, { stroke: INK, ...top });
  const g = art(t, 'chem-molgraph', 'jtmol mono', '', 110, 300, 180, 120, { fill: '#50555C', stroke: '#3A3F46' });
  const jt = art(t, 'chem-molgraph', 'jtmol jtree', '', 450, 300, 200, 128);
  t.text('Molecular\nGraph $G$', 0, 196, 90, 36, { fontSize: 13, align: 'left' });
  t.text('Junction\nTree $\\mathcal{T}$', 340, 196, 90, 36, { fontSize: 13, align: 'left' });
  const jt2 = art(t, 'chem-molgraph', 'jtmol jtree', '', 450, 600, 200, 128);
  const zg = feat(t, 'cells 1 0.4 0 1 0.15 0.75 0.4 0 1', 110, 445, 130, 15, '#111111');
  const zt = feat(t, 'cells 1 0.4 0 1 0.15 0.75 0.4 0 1', 450, 445, 130, 15, '#111111');
  note(t, '$\\mathbf{z}_G$', 196, 445, 30, 20, { fontSize: 15 });
  note(t, '$\\mathbf{z}_{\\mathcal{T}}$', 364, 445, 30, 20, { fontSize: 15 });
  t.link(mol, tree);
  t.link(mol, g, 'bottom', 'top');
  t.link(tree, jt, 'bottom', 'top');
  t.link(g, zg, 'bottom', 'top');
  t.link(jt, zt, 'bottom', 'top');
  t.link(zg, dec, 'bottom', 'top');
  t.link(zt, jt2, 'bottom', 'top');
  t.link(jt2, dec, 'left', 'right', { label: 'Decode (Sec 2.5)', labelPos: 'above', fontSize: 12 });
  note(t, 'Encode (Sec 2.2)', 172, 398, 120, 18, { fontSize: 12, align: 'left' });
  note(t, 'Encode (Sec 2.3)', 512, 398, 120, 18, { fontSize: 12, align: 'left' });
  note(t, 'Decode (Sec 2.4)', 512, 492, 120, 18, { fontSize: 12, align: 'left' });
  return t.done();
}

/** Hoogeboom et al. 2022, "Equivariant Diffusion for Molecule Generation in 3D" — EDM (arXiv 2203.17003), Fig. 1. */
function edm() {
  const t = new Builder();
  const Y = 70;
  const state = (label: string, cx: number) => t.add({ shape: 'ellipse', label, ...C(cx, Y, 74, 74), fontSize: 19, strokeWidth: 2, fill: '#FFFFFF', stroke: '#222222' });
  state('$\\mathbf{z}_T$', 70);
  const zt = state('$\\mathbf{z}_t$', 300);
  const zs = state('$\\mathbf{z}_{t-1}$', 480);
  const z0 = state('$\\mathbf{z}_0$', 710);
  const xh = state('$\\mathbf{x}, \\mathbf{h}$', 890);
  note(t, '$\\cdots$', 185, Y, 40, 20, { fontSize: 22 });
  note(t, '$\\cdots$', 595, Y, 40, 20, { fontSize: 22 });
  note(t, '$\\mathcal{N}(\\mathbf{0}, \\mathbf{I})$', 70, 14, 70, 22, { fontSize: 14 });
  t.link(zt, zs, 'right', 'left', { label: '$p(\\mathbf{z}_{t-1} \\mid \\mathbf{z}_t)$', labelPos: 'below', fontSize: 13, color: '#222222', width: 1.6 });
  t.link(z0, xh, 'right', 'left', { label: '$p(\\mathbf{x}, \\mathbf{h} \\mid \\mathbf{z}_0)$', labelPos: 'below', fontSize: 13, color: '#222222', width: 1.6 });
  t.link(xh, zt, 'top', 'top', { dashed: true, color: '#222222', width: 1.6, offset: -14, label: '$q(\\mathbf{z}_t \\mid \\mathbf{x}, \\mathbf{h})$', labelPos: 'above', fontSize: 13 });
  const panel = (spec: string, cx: number) =>
    t.add({ shape: 'chem-mol3d', spec: `dockligand dark bonds ${spec}`, ...C(cx, 210, 128, 112), radius: 12, fill: '#15181D', stroke: 'none', strokeWidth: 1 });
  panel('noise-high', 70);
  panel('noise-mid', 300);
  panel('noise-low', 480);
  panel('', 710);
  panel('', 890);
  // rete di denoising
  const net = block(t, 'EGNN denoiser $\\phi(\\mathbf{z}_t, t)$', 390, 312, 230, 48, PURPLE, { fontSize: 12, sublabel: 'predicts $\\hat{\\boldsymbol{\\epsilon}} = [\\hat{\\boldsymbol{\\epsilon}}^{(x)}, \\hat{\\boldsymbol{\\epsilon}}^{(h)}]$', subSize: 11 });
  t.link(net, pin(t, 390, Y + 30), 'top', 'bottom', { dashed: true, color: SOFT, width: 1, ...NOARROW });
  return t.done();
}

/** Corso et al. 2023, "DiffDock: Diffusion Steps, Twists, and Turns for Molecular Docking" (arXiv 2210.01776), Fig. 1. */
function diffdock() {
  const t = new Builder();
  const title = (s: string, cx: number, cy: number, w: number, extra: Partial<N> = {}) => note(t, s, cx, cy, w, 40, { fontSize: 15, ...extra });
  const lp = title('ligand &\nprotein', 80, 26, 120);
  const dd = title('DiffDock', 450, 26, 140, { fontSize: 20, bold: true });
  const rp = title('ranked poses &\nconfidence score', 830, 26, 150);
  t.link(lp, dd, 'right', 'left', { color: INK });
  t.link(dd, rp, 'right', 'left', { color: INK });
  art(t, 'chem-skeletal', 'dockligand color', '', 80, 130, 130, 92, { stroke: INK });
  t.add({ shape: 'chem-docking', spec: 'protein', ...C(80, 275, 150, 130), fill: '#ECEDF0', stroke: '#A3A8AF', strokeWidth: 1.2 });
  segment(t, [170, 78], [170, 350], { color: INK, width: 1.2 });
  segment(t, [740, 78], [740, 350], { color: INK, width: 1.2 });
  note(t, '$t = T$', 245, 82, 50, 20, { fontSize: 14 });
  note(t, '$t = 0$', 660, 82, 50, 20, { fontSize: 14 });
  note(t, 'reverse diffusion over\ntranslations, rotations and torsions', 455, 80, 280, 36, { fontSize: 13 });
  t.link(pin(t, 290, 112), pin(t, 650, 112), 'right', 'left', { routing: 'straight', dashed: true, color: INK, width: 1.2 });
  const pose = (spec: string, cx: number) => t.add({ shape: 'chem-docking', spec, count: 7, ...C(cx, 235, 172, 150), fill: '#ECEDF0', stroke: '#A3A8AF', strokeWidth: 1.2 });
  pose('random', 270);
  pose('mid', 455);
  pose('final', 640);
  note(t, 'score model $s_\\theta$ on $\\mathbb{R}^3 \\times SO(3) \\times SO(2)^m$', 455, 335, 340, 20, { fontSize: 12, textColor: MUTED });
  const rank = (k: number, cy: number) => {
    t.add({ shape: 'chem-docking', spec: 'zoom', count: k === 1 ? 0 : 6, ...C(815, cy, 110, 92), radius: 6, fill: '#ECEDF0', stroke: '#A3A8AF', strokeWidth: 1.2 });
    t.add({ label: String(k), ...C(895, cy - 26, 26, 26), radius: 9, fontSize: 14, strokeWidth: 1.2, ...WHITE });
  };
  rank(1, 140);
  rank(2, 262);
  note(t, 'confidence model $d_\\phi$', 830, 335, 160, 20, { fontSize: 12, textColor: MUTED });
  return t.done();
}

// ======================================================================
// Sintesi e reazioni
// ======================================================================

/** Segler, Preuss & Waller 2018, "Planning chemical syntheses with deep neural networks and symbolic AI" (arXiv 1708.04202), Fig. 2. */
function retrosynthesis() {
  const t = new Builder();
  const BL = '#2C7FC0', RD = '#E5484D';
  note(t, 'a) Synthesis Planning with Monte Carlo Tree Search', 230, 8, 460, 22, { fontSize: 15, align: 'left' });
  const node = (x: number, y: number, c = INK, label = '', side: 'left' | 'right' = 'left') => {
    const n = t.add({ shape: 'ellipse', ...C(x, y, 22, 22), fill: '#FFFFFF', stroke: c, strokeWidth: 2.4 });
    if (label) note(t, label, x + (side === 'left' ? -22 : 22), y, 20, 20, { fontSize: 16 });
    return n;
  };
  const edge = (a: N, b: N, c = INK, arrow = false) => t.link(a, b, 'bottom', 'top', { routing: 'straight', color: c, width: 2.2, arrowEnd: arrow });
  const up = (a: N, b: N) => t.link(a, b, 'top', 'bottom', { routing: 'straight', color: BL, width: 2.2 });
  const steps: [string, string][] = [
    ['1) Selection', 'pick most\npromising position'],
    ['2) Expansion', 'retroanalyze, add new nodes to\ntree by expansion procedure (b)'],
    ['3) Rollout', 'pick and evaluate\nnew position'],
    ['4) Update', 'incorporate evaluation\nin the search tree'],
  ];
  const X = [20, 250, 520, 740];
  const heads = steps.map(([h, d], i) => {
    const hn = t.text(h, X[i], 52, 150, 22, { fontSize: 15, align: 'left' });
    t.text(d, X[i], 76, 210, 34, { fontSize: 11, align: 'left', textColor: MUTED });
    return hn;
  });
  for (let i = 0; i < 3; i++) t.link(pin(t, X[i] + (i === 1 ? 140 : 120), 63), pin(t, X[i + 1] - 8, 63), 'right', 'left', { routing: 'straight', color: '#111111', width: 2.4 });
  t.link(heads[3], heads[0], 'top', 'top', { color: '#111111', width: 2.4, offset: -10 });
  // alberi di ricerca
  const tree = (ox: number, step: number) => {
    const root = node(ox + 60, 140, step >= 1 ? BL : INK);
    const l1 = node(ox + 25, 195);
    const r1 = node(ox + 95, 195, BL);
    const a = node(ox + 60, 250, step === 1 ? RD : BL, step <= 2 ? 'A' : '');
    const r2 = node(ox + 130, 250);
    edge(root, l1);
    if (step === 4) up(r1, root);
    else edge(root, r1, BL, step === 1);
    edge(r1, r2);
    if (step === 4) up(a, r1);
    else edge(r1, a, BL, step === 1);
    if (step >= 2) {
      const b = node(ox + 25, 305, INK, step === 2 ? 'B' : '');
      const c = node(ox + 95, 305, step === 2 ? RD : BL, step === 2 ? 'C' : '', 'right');
      edge(a, b);
      if (step === 4) up(c, a);
      else edge(a, c, BL, step === 2);
      if (step === 3) {
        const d = node(ox + 95, 385, RD, 'δ', 'right');
        t.link(c, d, 'bottom', 'top', { routing: 'straight', color: INK, width: 1.8, dashed: true, ...NOARROW });
        note(t, 'rollout', ox + 130, 345, 50, 16, { fontSize: 10, textColor: MUTED });
      }
      if (step === 4) {
        note(t, 'δQ', ox + 112, 165, 30, 18, { fontSize: 13 });
        note(t, 'δQ', ox + 58, 220, 30, 18, { fontSize: 13 });
        note(t, 'δQ', ox + 100, 278, 30, 18, { fontSize: 13 });
      }
    }
  };
  X.forEach((x, i) => tree(x, i + 1));
  // b) procedura di espansione
  const YB = 450;
  note(t, 'b) Expansion procedure', 120, YB - 20, 240, 22, { fontSize: 15, align: 'left' });
  const SG = '#2EAE6A';
  const lane: [string, string, number, number][] = [['Symbolic', SG, 40, 100], ['Neural', BL, 230, 300], ['Symbolic', SG, 455, 80], ['Neural', BL, 640, 300], ['Symbolic', SG, 870, 80]];
  lane.forEach(([s, c, x, w]) => note(t, s, x, YB + 14, w, 18, { fontSize: 13, textColor: c }));
  const Y = YB + 110;
  const target = art(t, 'chem-skeletal', 'paracetamol', 'Target molecule A', 70, Y, 110, 62, { stroke: INK, fontSize: 12 });
  const pol = art(t, 'mlp', '3,3,3', 'Expansion policy:\nprioritizes transformations', 270, Y, 90, 74, { fill: '#FFFFFF', stroke: '#222222', fontSize: 11 });
  t.link(target, pol, 'right', 'left', { label: 'ECFP4', labelPos: 'above', fontSize: 10, width: 2 });
  const tf = feat(t, 'cells 0.9 0.6 0.2 0.25 0.7 0.95 0.2 0.85 0.15', 380, Y, 14, 100, BL);
  note(t, 'TF 1', 405, Y - 44, 30, 14, { fontSize: 9 });
  note(t, 'TF n', 405, Y + 44, 30, 14, { fontSize: 9 });
  t.link(pol, tf, 'right', 'left', { width: 2 });
  const keep = t.add({ shape: 'chem-funnel', count: 3, label: 'keep k best,\napply transforms', ...C(470, Y, 52, 70), ...ICON, fontSize: 11, fill: '#FFFFFF', stroke: '#222222', strokeWidth: 1.6 });
  t.link(pin(t, 412, Y), keep, 'right', 'left', { routing: 'straight', width: 2 });
  const rx = feat(t, 'cells 0.9 0.6 0.85 0.95 0.75', 555, Y, 14, 64, BL);
  t.link(keep, rx, 'right', 'left', { width: 2 });
  note(t, 'Rxn 1', 582, Y - 26, 32, 14, { fontSize: 9 });
  note(t, 'Rxn k', 582, Y + 26, 32, 14, { fontSize: 9 });
  const filt = art(t, 'mlp', '3,2,1', 'for each Rxn:\nin-scope filter', 670, Y, 80, 74, { fill: '#FFFFFF', stroke: '#222222', fontSize: 11 });
  t.link(pin(t, 600, Y), filt, 'right', 'left', { routing: 'straight', width: 2 });
  const ok = feat(t, 'cells 0.1 0.6 0.85 0.15 0.1', 760, Y, 14, 64, BL);
  t.link(filt, ok, 'right', 'left', { width: 2 });
  const likely = t.add({ shape: 'chem-funnel', count: 3, label: 'keep likely\nreactions', ...C(830, Y, 52, 70), ...ICON, fontSize: 11, fill: '#FFFFFF', stroke: '#222222', strokeWidth: 1.6 });
  t.link(ok, likely, 'right', 'left', { width: 2 });
  const rk = t.group('Ranked precursors', 890, Y - 84, 150, 168, { dashed: false, ...PAPER, textColor: MUTED });
  art(t, 'chem-skeletal', 'aminophenol', 'B', 965, Y - 30, 100, 40, { stroke: INK, fontSize: 12 });
  art(t, 'chem-skeletal', 'aceticanhydride', 'C', 965, Y + 42, 100, 34, { stroke: INK, fontSize: 12 });
  t.link(likely, rk, 'right', 'left', { width: 2 });
  return t.done();
}

/** Schwaller et al. 2019, "Molecular Transformer: a model for uncertainty-calibrated chemical reaction prediction" (arXiv 1811.02633). */
function molTransformer() {
  const t = new Builder();
  note(t, 'Reaction prediction as machine translation', 470, 10, 420, 22, { fontSize: 14, bold: true });
  const Y1 = 75, Y2 = 200;
  const r1 = art(t, 'chem-skeletal', 'acetylchloride color', '', 70, Y1, 70, 60, { stroke: INK });
  note(t, '+', 125, Y1, 20, 20, { fontSize: 18 });
  const r2 = art(t, 'chem-skeletal', 'benzylamine color', '', 200, Y1, 120, 60, { stroke: INK });
  note(t, 'reactants + reagents', 135, Y1 - 48, 180, 16, { fontSize: 11, textColor: MUTED });
  const prod = art(t, 'chem-skeletal', 'benzylacetamide color', '', 800, Y1, 160, 66, { stroke: INK });
  note(t, 'predicted product', 800, Y1 - 48, 160, 16, { fontSize: 11, textColor: MUTED });
  const src = t.add({ shape: 'chem-smiles', spec: 'CC(=O)Cl.NCc1ccccc1', label: 'Source tokens', ...C(150, Y2, 280, 24), radius: 3, ...ICON, fontSize: 11, ...GRAY });
  const tgt = t.add({ shape: 'chem-smiles', spec: 'CC(=O)NCc1ccccc1', ...C(800, Y2, 240, 24), radius: 3, ...ICON, fontSize: 11, ...GRAY });
  note(t, 'Target tokens', 875, Y2 + 24, 90, 16, { fontSize: 11 });
  t.link(r1, src, 'bottom', 'top', thin);
  t.link(r2, src, 'bottom', 'top', thin);
  t.link(tgt, prod, 'top', 'bottom', thin);
  const enc = t.enc('$\\mathcal{E}$', 'Encoder  $\\times 6$', 370, Y2 - 60, 110, 120);
  const dec = t.dec('$\\mathcal{D}$', 'Decoder  $\\times 6$', 540, Y2 - 60, 110, 120);
  t.link(src, enc);
  t.link(enc, dec, 'right', 'left', { label: 'memory', labelPos: 'above', fontSize: 10 });
  t.link(dec, tgt);
  t.link(pin(t, 730, Y2 + 12), dec, 'bottom', 'bottom', { dashed: true, color: SOFT, offset: 18, label: 'autoregressive, beam search', labelPos: 'below', fontSize: 10 });
  // le k migliori predizioni con la loro confidenza
  const px = 300, py = 330;
  t.group('Top-k predictions', px, py, 360, 106, { dashed: false, ...PAPER, textColor: '#444444' });
  const rows: [string, number][] = [['CC(=O)NCc1ccccc1', 0.97], ['CC(=O)N(C)Cc1ccccc1', 0.02], ['CC(=O)c1ccc(CN)cc1', 0.01]];
  rows.forEach(([s, p], i) => {
    const yy = py + 28 + i * 24;
    t.text(`${i + 1}.  ${s}`, px + 10, yy, 170, 16, { fontSize: 10, align: 'left', textColor: '#333333' });
    t.add({ x: px + 190, y: yy + 2, w: Math.max(2, 110 * p), h: 12, radius: 1.5, strokeWidth: 1, ...(i ? GRAY : GREEN) });
    t.text(p.toFixed(2), px + 196 + 110 * p, yy, 30, 16, { fontSize: 9, align: 'left', textColor: MUTED });
  });
  t.add({ shape: 'check', ...C(px + 340, py + 36, 16, 14), fill: 'none', stroke: '#2F9E44', strokeWidth: 2 });
  note(t, 'confidence $= \\prod_{i} p(t_i \\mid t_{<i}, \\mathbf{x})$', 840, 380, 270, 24, { fontSize: 12 });
  return t.done();
}

// ======================================================================
// Scoperta di farmaci e materiali
// ======================================================================

/** Screening virtuale: imbuto dalla libreria di composti ai candidati validati. */
function vscreen() {
  const t = new Builder();
  const lib = t.add({ shape: 'cylinder', label: 'Compound library', sublabel: '$\\sim 10^{9}$ molecules (ZINC, Enamine REAL)', ...C(330, 40, 250, 64), fontSize: 12, subSize: 10, strokeWidth: 1.2, ...GRAY });
  art(t, 'chem-skeletal', 'caffeine', '', 120, 40, 70, 56, { stroke: '#6B7179', strokeWidth: 1 });
  art(t, 'chem-skeletal', 'ibuprofen', '', 545, 40, 90, 50, { stroke: '#6B7179', strokeWidth: 1 });
  const H = 300, Y0 = 110, K = 5;
  const fun = t.add({ shape: 'chem-funnel', count: K, ...C(330, Y0 + H / 2, 300, H), strokeWidth: 1.2, ...BLUE });
  t.link(lib, fun, 'bottom', 'top');
  const band = (H * 0.9) / K;
  const stages: [string, string, string][] = [
    ['Physicochemical filters', 'Lipinski Ro5, PAINS, ADMET', '$10^{9}$'],
    ['ML scoring', 'QSAR / GNN property models', '$10^{7}$'],
    ['Molecular docking', 'pose and score (Vina, DiffDock)', '$10^{5}$'],
    ['MD / FEP rescoring', 'binding free energy $\\Delta G$', '$10^{3}$'],
    ['Experimental assay', '$\\mathrm{IC}_{50}$, selectivity', '$10^{2}$'],
  ];
  stages.forEach(([s, sub, n], i) => {
    const cy = Y0 + band * (i + 0.5) - 1;
    note(t, n, 330, cy, 60, 20, { fontSize: 13, bold: true, textColor: '#2F4F7F' });
    t.add({ shape: 'text', label: s, sublabel: sub, ...C(600, cy, 190, 40), align: 'left', fill: 'none', stroke: 'none', fontSize: 12, bold: true, subSize: 10 });
  });
  const icon = (shape: string, spec: string, cy: number, extra: Partial<N> = {}) => t.add({ shape, spec, ...C(740, cy, 50, 40), fill: 'none', stroke: '#4E545C', strokeWidth: 1.2, ...extra });
  feat(t, '0.55 0.8 0.35 0.65 0.45', 740, Y0 + band * 0.5, 50, 34, '#6C8EBF', '#DAE8FC');
  icon('chem-molgraph', 'paracetamol', Y0 + band * 1.5);
  icon('chem-docking', 'zoom', Y0 + band * 2.5, { fill: '#ECEDF0', stroke: '#A3A8AF', radius: 4 });
  icon('chem-energy', 'exo', Y0 + band * 3.5, { stroke: BLUE_LINE });
  icon('chem-lab', 'plate', Y0 + band * 4.5, { ...TEAL, w: 54, h: 36, x: 713, y: Y0 + band * 4.5 - 18, radius: 3 });
  const hits = block(t, 'Validated hits', 330, Y0 + H + 60, 150, 44, GREEN, { fontSize: 12, bold: true, sublabel: '$\\sim 10$ lead candidates', subSize: 10 });
  t.link(fun, hits, 'bottom', 'top');
  t.add({ shape: 'check', ...C(420, Y0 + H + 50, 18, 16), fill: 'none', stroke: '#2F9E44', strokeWidth: 2 });
  art(t, 'chem-skeletal', 'paracetamol color', '', 520, Y0 + H + 60, 110, 50, { stroke: INK });
  return t.done();
}

/** Laboratorio autonomo (self-driving lab): ciclo chiuso pianificazione → sintesi → caratterizzazione → apprendimento. */
function sdl() {
  const t = new Builder();
  const grp = (label: string, x: number, y: number) => t.group(label, x, y, 270, 150, { dashed: false, ...PAPER, textColor: '#333333', bold: true });
  const A = grp('AI planner (Bayesian optimization)', 0, 0);
  const B = grp('Robotic synthesis', 380, 0);
  const Cc = grp('Automated characterization', 380, 230);
  const D = grp('Data & learning', 0, 230);
  // pianificatore: surrogato e acquisizione
  t.add({ shape: 'chem-bo', label: 'surrogate and acquisition', ...C(82, 76, 116, 68), count: 5, fill: 'none', stroke: '#7E57C2', strokeWidth: 1.2, ...ICON, fontSize: 10 });
  t.add({ shape: 'robot', ...C(212, 56, 40, 42), strokeWidth: 1.2, ...TEAL });
  note(t, '$\\mathbf{x}^{*} = \\arg\\max_{\\mathbf{x}} \\alpha(\\mathbf{x})$', 212, 100, 110, 22, { fontSize: 11 });
  // sintesi
  t.add({ shape: 'chem-lab', spec: 'robotarm', ...C(430, 78, 56, 64), strokeWidth: 1.2, ...GRAY });
  t.add({ shape: 'chem-lab', spec: 'flask', ...C(495, 85, 40, 50), strokeWidth: 1.2, ...BLUE });
  t.add({ shape: 'chem-lab', spec: 'roundflask', ...C(545, 85, 40, 52), strokeWidth: 1.2, ...ORANGE });
  note(t, 'dispensing, mixing, heating', 495, 135, 200, 16, { fontSize: 10, textColor: MUTED });
  // caratterizzazione
  t.add({ shape: 'chem-spectrum', spec: 'xrd labels', label: 'XRD', ...C(450, 310, 110, 64), fill: 'none', stroke: BLUE_LINE, strokeWidth: 1.2, ...ICON, fontSize: 10 });
  t.add({ shape: 'chem-spectrum', spec: 'uvvis labels', label: 'UV-vis', ...C(580, 310, 100, 64), fill: 'none', stroke: '#C0392B', strokeWidth: 1.2, ...ICON, fontSize: 10 });
  // dati e apprendimento
  t.add({ shape: 'cylinder', label: 'Database', ...C(70, 305, 80, 60), fontSize: 11, strokeWidth: 1.2, ...GRAY });
  block(t, 'Property\nextraction', 195, 290, 100, 40, YELLOW, { fontSize: 11 });
  note(t, '$\\mathcal{D} \\leftarrow \\mathcal{D} \\cup \\{(\\mathbf{x}, y)\\}$', 195, 342, 150, 20, { fontSize: 11 });
  const lab = { fontSize: 11, labelPos: 'above' as const };
  t.link(A, B, 'right', 'left', { label: 'recipe $\\mathbf{x}$', ...lab });
  t.link(B, Cc, 'bottom', 'top', { label: 'samples', labelPos: 'center', fontSize: 11 });
  t.link(Cc, D, 'left', 'right', { label: 'measurements', ...lab });
  t.link(D, A, 'top', 'bottom', { label: 'update model', labelPos: 'center', fontSize: 11 });
  t.add({ shape: 'cycle', label: 'closed loop', ...C(325, 190, 46, 46), fill: 'none', stroke: MUTED, strokeWidth: 1.4, ...ICON, fontSize: 11 });
  const user = t.icon('user', 'Scientist', -95, 50, 40, 44, BLUE, { fontSize: 11 });
  t.link(user, A, 'right', 'left', { label: 'objective', ...lab, fontSize: 10 });
  const best = block(t, 'Optimal material', 760, 305, 120, 44, GREEN, { fontSize: 12, bold: true, sublabel: 'after $n$ iterations', subSize: 10 });
  t.link(Cc, best, 'right', 'left');
  return t.done();
}

export const CHEM_TEMPLATES: TemplateDef[] = [
  { id: 'chem-molrep', name: 'Rappresentazioni molecolari', section: SEC, build: molrep },
  { id: 'chem-mpnn', name: 'MPNN (Gilmer 2017)', section: SEC, build: mpnn },
  { id: 'chem-schnet', name: 'SchNet (Schütt 2017)', section: SEC, build: schnet },
  { id: 'chem-egnn', name: 'EGNN (Satorras 2021)', section: SEC, build: egnn },
  { id: 'chem-nequip', name: 'NequIP (Batzner 2022)', section: SEC, build: nequip },
  { id: 'chem-mlip', name: 'Potenziale ML + active learning', section: SEC, build: mlip },
  { id: 'chem-cgcnn', name: 'CGCNN (Xie 2018)', section: SEC, build: cgcnn },
  { id: 'chem-cdvae', name: 'CDVAE (Xie 2022)', section: SEC, build: cdvae },
  { id: 'chem-jtvae', name: 'JT-VAE (Jin 2018)', section: SEC, build: jtvae },
  { id: 'chem-edm', name: 'EDM, diffusione 3D (Hoogeboom 2022)', section: SEC, build: edm },
  { id: 'chem-diffdock', name: 'DiffDock (Corso 2023)', section: SEC, build: diffdock },
  { id: 'chem-retro', name: 'Retrosintesi MCTS (Segler 2018)', section: SEC, build: retrosynthesis },
  { id: 'chem-moltransformer', name: 'Molecular Transformer (Schwaller 2019)', section: SEC, build: molTransformer },
  { id: 'chem-vscreen', name: 'Screening virtuale', section: SEC, build: vscreen },
  { id: 'chem-sdl', name: 'Laboratorio autonomo', section: SEC, build: sdl },
];
