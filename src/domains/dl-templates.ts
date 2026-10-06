// Modelli Deep learning ricalcati sulle figure dei paper originali: ogni modello è fatto
// di normali blocchi e connessioni, quindi dopo l'inserimento resta tutto modificabile.
import { Builder, FLAME, FROZEN, type Color, type N } from '../builder';
import { COLORS, DEC_STYLE, ENC_STYLE, ICON } from '../model';
import type { TemplateDef } from '../registry';
import { tokenColumns } from './dl-shapes';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, GRAY } = COLORS;
const SECTION = 'Deep learning';
/** Celle delle reti ricorrenti (stile Olah 2015): sfondo verde chiaro, layer gialli, operazioni rosa. */
const CELL_BG = { fill: '#F1F8EE', stroke: '#82B366', dashed: false, radius: 14 };
const INACTIVE = { fill: '#F5F5F5', stroke: '#B0B0B0', dashed: true, textColor: '#8A8A8A' };
const IMG = { radius: 2, strokeWidth: 1, fill: '#FFFFFF', stroke: '#C9CED6', ...ICON, fontSize: 13 };

/** Punto esatto (px, py) su una linea: estremo invisibile per diramazioni e residui. */
const at = (t: Builder, px: number, py: number) => t.anchor(px - 0.5, py - 0.5);
const free = { arrowEnd: false };

// ======================================================================
// Reti convoluzionali
// ======================================================================

/** He et al. 2016, Fig. 2: blocco di apprendimento residuo. */
function resnetBlock() {
  const t = new Builder();
  const cx = 200;
  const x = t.text('$\\mathbf{x}$', cx - 15, 0, 30, 22, { fontSize: 15 });
  const w1 = t.box('weight layer', cx - 65, 50, 130, 34, BLUE);
  const w2 = t.box('weight layer', cx - 65, 124, 130, 34, BLUE);
  const add = t.op('+', cx - 13, 192);
  const out = at(t, cx, 262);
  t.chain([x, w1, w2, add], 'down');
  t.link(add, out, 'bottom', 'top');
  t.text('relu', cx + 7, 93, 40, 22, { align: 'left', fontSize: 12 });
  t.text('relu', cx + 7, 225, 40, 22, { align: 'left', fontSize: 12 });
  t.text('$\\mathcal{F}(\\mathbf{x})$', cx - 75, 164, 68, 24, { align: 'right', fontSize: 13 });
  t.text('$\\mathcal{F}(\\mathbf{x}) + \\mathbf{x}$', cx - 125, 225, 118, 24, { align: 'right', fontSize: 13 });
  // scorciatoia identità
  t.link(at(t, cx, 34), add, 'right', 'right', { offset: 70 });
  t.text('$\\mathbf{x}$\nidentity', cx + 108, 100, 70, 40, { align: 'left', fontSize: 12 });
  return t.done();
}

/** He et al. 2016, Fig. 5: blocco base (ResNet-34) e blocco "bottleneck" (ResNet-50/101/152). */
function resnetBottleneck() {
  const t = new Builder();
  const column = (cx: number, dim: string, layers: string[], caption: string) => {
    const top = t.text(dim, cx - 30, 0, 60, 20, { fontSize: 12 });
    const boxes = layers.map((s, i) => t.box(s, cx - 60, 46 + i * 64, 120, 32, BLUE, { fontSize: 12 }));
    const yAdd = 46 + layers.length * 64 + 6;
    const add = t.op('+', cx - 13, yAdd);
    t.chain([top, ...boxes, add], 'down');
    t.link(add, at(t, cx, yAdd + 64), 'bottom', 'top');
    for (let i = 1; i < layers.length; i++) t.text('relu', cx + 7, 46 + i * 64 - 26, 40, 20, { align: 'left', fontSize: 11 });
    t.text('relu', cx + 7, yAdd + 32, 40, 20, { align: 'left', fontSize: 11 });
    t.link(at(t, cx, 30), add, 'right', 'right', { offset: 55 });
    t.text(caption, cx - 90, yAdd + 76, 180, 32, { fontSize: 11, textColor: '#555555' });
  };
  column(100, '64-d', ['$3 \\times 3$, 64', '$3 \\times 3$, 64'], 'basic block\n(ResNet-34)');
  column(360, '256-d', ['$1 \\times 1$, 64', '$3 \\times 3$, 64', '$1 \\times 1$, 256'], 'bottleneck block\n(ResNet-50/101/152)');
  return t.done();
}

/** Szegedy et al. 2015 (GoogLeNet), Fig. 2: modulo Inception (a) naive, (b) con riduzione 1×1. */
function inception() {
  const t = new Builder();
  const C1 = YELLOW, C3 = ORANGE, C5 = RED, POOL = BLUE;
  const W = 100, H = 40;
  const box = (label: string, cx: number, y: number, c: Color) => t.box(label, cx - W / 2, y, W, H, c, { fontSize: 11 });
  /** Linee a ventaglio dal lato superiore di `from` (punti distribuiti) verso il basso dei rami. */
  const fanUp = (from: N, targets: N[]) => {
    const fc = from.x + from.w / 2;
    for (const b of targets) {
      const bc = b.x + b.w / 2;
      t.link(at(t, fc + (bc - fc) * 0.55, from.y + 0.5), b, 'top', 'bottom', { routing: 'straight' });
    }
  };
  const fanIn = (sources: N[], to: N) => {
    const tc = to.x + to.w / 2;
    for (const a of sources) {
      const ac = a.x + a.w / 2;
      t.link(a, at(t, tc + (ac - tc) * 0.55, to.y + to.h - 0.5), 'top', 'bottom', { routing: 'straight' });
    }
  };
  const module = (ox: number, naive: boolean) => {
    const cols = [0, 1, 2, 3].map((i) => ox + 55 + i * 112);
    const mid = (cols[0] + cols[3]) / 2;
    const concat = t.box('Filter concatenation', mid - 150, 0, 300, 30, GREEN);
    const prev = t.box('Previous layer', mid - 130, 250, 260, 30, GRAY);
    if (naive) {
      const row = [
        box('$1 \\times 1$\nconvolutions', cols[0], 110, C1),
        box('$3 \\times 3$\nconvolutions', cols[1], 110, C3),
        box('$5 \\times 5$\nconvolutions', cols[2], 110, C5),
        box('$3 \\times 3$\nmax pooling', cols[3], 110, POOL),
      ];
      fanUp(prev, row);
      fanIn(row, concat);
      t.text('(a) Inception module, naive version', mid - 150, 300, 300, 20, { fontSize: 12 });
    } else {
      const top = [
        box('$1 \\times 1$\nconvolutions', cols[0], 80, C1),
        box('$3 \\times 3$\nconvolutions', cols[1], 80, C3),
        box('$5 \\times 5$\nconvolutions', cols[2], 80, C5),
        box('$1 \\times 1$\nconvolutions', cols[3], 80, C1),
      ];
      const low = [box('$1 \\times 1$\nconvolutions', cols[1], 166, C1), box('$1 \\times 1$\nconvolutions', cols[2], 166, C1), box('$3 \\times 3$\nmax pooling', cols[3], 166, POOL)];
      fanUp(prev, [top[0], ...low]);
      low.forEach((b, i) => t.link(b, top[i + 1], 'top', 'bottom'));
      fanIn(top, concat);
      t.text('(b) Inception module with dimension reductions', mid - 170, 300, 340, 20, { fontSize: 12 });
    }
  };
  module(0, true);
  module(500, false);
  return t.done();
}

/** Hu et al. 2018, Fig. 1: Squeeze-and-Excitation block. */
function seBlock() {
  const t = new Builder();
  const X = t.add({ shape: 'cuboid', label: '$\\mathbf{X}$', sublabel: "$H' \\times W' \\times C'$", subSize: 11, x: 0, y: 150, w: 80, h: 96, depth: 0.3, strokeWidth: 1, ...ICON, fontSize: 14, ...BLUE });
  const U = t.add({ shape: 'dl-chcuboid', label: '$\\mathbf{U}$', sublabel: '$H \\times W \\times C$', subSize: 11, spec: 'mono', count: 8, depth: 0.32, x: 170, y: 140, w: 130, h: 110, strokeWidth: 1, ...ICON, fontSize: 14, ...GRAY });
  const sq = t.add({ shape: 'dl-chcuboid', label: '$1 \\times 1 \\times C$', spec: 'mono', count: 8, depth: 0.6, x: 330, y: 20, w: 100, h: 26, strokeWidth: 1, ...ICON, fontSize: 11, ...GRAY });
  const ex = t.add({ shape: 'dl-chcuboid', label: '$1 \\times 1 \\times C$', count: 8, depth: 0.6, x: 500, y: 20, w: 100, h: 26, strokeWidth: 1, ...ICON, fontSize: 11, ...GRAY });
  const Xt = t.add({ shape: 'dl-chcuboid', label: '$\\tilde{\\mathbf{X}}$', sublabel: '$H \\times W \\times C$', subSize: 11, count: 8, depth: 0.32, x: 640, y: 140, w: 130, h: 110, strokeWidth: 1, ...ICON, fontSize: 14, ...GRAY });
  const lab = { labelPos: 'above' as const, fontSize: 13 };
  t.link(X, U, 'right', 'left', { label: '$\\mathbf{F}_{tr}$', ...lab });
  t.link(U, sq, 'top', 'left', { label: '$\\mathbf{F}_{sq}(\\cdot)$', ...lab });
  t.link(sq, ex, 'right', 'left', { label: '$\\mathbf{F}_{ex}(\\cdot, \\mathbf{W})$', ...lab });
  t.link(ex, Xt, 'right', 'top');
  t.text('$\\mathbf{F}_{scale}(·, ·)$', 590, 76, 110, 22, { fontSize: 13, align: 'right' });
  t.link(U, Xt, 'right', 'left');
  return t.done();
}

/** Wu & He 2018 (Group Norm), Fig. 2: quali pixel condividono media e varianza. */
function normalizations() {
  const t = new Builder();
  const kinds: [string, string][] = [['batch', 'Batch Norm'], ['layer', 'Layer Norm'], ['instance', 'Instance Norm'], ['group', 'Group Norm']];
  kinds.forEach(([spec, title], i) =>
    t.add({ shape: 'dl-normcube', label: title, labelPos: 'above', spec: `${spec} axes`, count: 6, x: i * 175, y: 30, w: 140, h: 140, strokeWidth: 1, fontSize: 13, bold: true, ...BLUE }),
  );
  t.text('$\\hat{x}_i = \\frac{x_i - \\mu_i}{\\sqrt{\\sigma_i^2 + \\epsilon}}$,   $y_i = \\gamma \\hat{x}_i + \\beta$', 0, 186, 665, 50, { fontSize: 15 });
  t.text(
    'Each cube is a feature map tensor: $N$ batch axis, $C$ channel axis, $(H, W)$ spatial axes.\nThe pixels in blue are normalized by the same mean $\\mu_i$ and variance $\\sigma_i^2$.',
    0, 242, 665, 36,
    { fontSize: 11, textColor: '#555555' },
  );
  return t.done();
}

/** Srivastava et al. 2014, Fig. 1: rete standard e la stessa rete dopo il dropout. */
function dropoutNet() {
  const t = new Builder();
  const net = (x: number, p: number, caption: string) =>
    t.add({ shape: 'dl-dropout', label: caption, spec: '4,5,5,2', count: p, x, y: 0, w: 200, h: 150, strokeWidth: 1.2, ...ICON, ...GREEN });
  net(0, 0, '(a) Standard Neural Net');
  net(280, 45, '(b) After applying dropout');
  return t.done();
}

// ======================================================================
// Attention e Transformer
// ======================================================================

/** Vaswani et al. 2017, Fig. 2: Scaled Dot-Product Attention e Multi-Head Attention. */
function attention() {
  const t = new Builder();
  // --- Scaled Dot-Product Attention ---
  t.text('Scaled Dot-Product Attention', -10, -50, 230, 22, { bold: true, fontSize: 13 });
  const cx = 95;
  const mm2 = t.box('MatMul', cx - 55, 0, 150, 28, PURPLE);
  const sm = t.box('SoftMax', cx - 55, 62, 110, 28, GREEN);
  const mask = t.box('Mask (opt.)', cx - 55, 124, 110, 28, RED);
  const sc = t.box('Scale', cx - 55, 186, 110, 28, YELLOW);
  const mm1 = t.box('MatMul', cx - 55, 248, 110, 28, PURPLE);
  t.chain([mm1, sc, mask, sm], 'up');
  t.link(sm, at(t, cx, 28.5), 'top', 'bottom');
  t.link(mm2, at(t, mm2.x + mm2.w / 2, -40), 'top', 'bottom');
  const Q = t.text('$Q$', cx - 40, 310, 30, 22, { fontSize: 14 });
  const K = t.text('$K$', cx + 10, 310, 30, 22, { fontSize: 14 });
  const V = t.text('$V$', cx + 60, 310, 30, 22, { fontSize: 14 });
  t.link(Q, at(t, cx - 25, 276.5), 'top', 'bottom');
  t.link(K, at(t, cx + 25, 276.5), 'top', 'bottom');
  t.link(V, at(t, cx + 75, 28.5), 'top', 'bottom');
  // --- Multi-Head Attention ---
  t.text('Multi-Head Attention', 330, -50, 180, 22, { bold: true, fontSize: 13 });
  const D = 12; // profondità dei fogli impilati (3 fogli)
  const stack = (label: string, cx0: number, y: number, w: number, h: number, c: Color, fs = 12) =>
    t.add({ shape: 'stack', label, count: 3, x: cx0 - w / 2, y, w: w + D, h: h + D, fontSize: fs, strokeWidth: 1.2, ...c });
  const mx = 420;
  const lin2 = t.box('Linear', mx - 55, 0, 110, 28, PURPLE);
  const cat = t.box('Concat', mx - 55, 62, 110, 28, YELLOW);
  stack('Scaled Dot-Product\nAttention', mx, 124, 250, 46, PURPLE, 12);
  t.text('$h$', mx + 140, 150, 24, 22, { fontSize: 15 });
  const cols = [mx - 90, mx, mx + 90];
  const names = ['$V$', '$K$', '$Q$'];
  t.chain([cat, lin2], 'up');
  t.link(at(t, mx, 124.5), cat, 'top', 'bottom');
  t.link(lin2, at(t, mx, -40), 'top', 'bottom');
  cols.forEach((c, i) => {
    const lin = stack('Linear', c, 228, 66, 30, GRAY);
    t.link(at(t, c, 228.5), at(t, c, 182.5), 'top', 'bottom');
    t.link(t.text(names[i], c - 15, 310, 30, 22, { fontSize: 14 }), at(t, c, lin.y + lin.h - 0.5), 'top', 'bottom');
  });
  t.text('$\\mathrm{Attention}(Q, K, V) = \\mathrm{softmax}\\left(\\frac{QK^{\\top}}{\\sqrt{d_k}}\\right) V$', -10, 356, 600, 44, { fontSize: 14 });
  return t.done();
}

/** Liu et al. 2021 (Swin Transformer), Fig. 3 e Fig. 2: architettura, due blocchi successivi, finestre. */
function swin() {
  const t = new Builder();
  // (a) architettura
  const img = t.icon('image', 'Images\n$H \\times W \\times 3$', 0, 65, 70, 70, BLUE, { radius: 3, fontSize: 11 });
  const part = t.box('Patch\nPartition', 96, 50, 64, 100, GRAY, { fontSize: 10 });
  const stages: [string, string, string][] = [
    ['Linear\nEmbedding', '$H/4 \\times W/4 \\times C$', '$\\times 2$'],
    ['Patch\nMerging', '$H/8 \\times W/8 \\times 2C$', '$\\times 2$'],
    ['Patch\nMerging', '$H/16 \\times W/16 \\times 4C$', '$\\times 6$'],
    ['Patch\nMerging', '$H/32 \\times W/32 \\times 8C$', '$\\times 2$'],
  ];
  let prev: N = part;
  t.link(img, part);
  stages.forEach(([first, dims, rep], i) => {
    const gx = 186 + i * 206;
    t.group(`Stage ${i + 1}`, gx, 20, 182, 160, { dashed: false, stroke: '#9E9E9E', fill: '#F7F7F7', textColor: '#333333' });
    t.text(dims, gx - 10, -6, 202, 20, { fontSize: 11 });
    const a = t.box(first, gx + 12, 50, 66, 100, i === 0 ? RED : GREEN, { fontSize: 10 });
    const b = t.box('Swin\nTransformer\nBlock', gx + 104, 50, 66, 100, ORANGE, { fontSize: 10 });
    t.text(rep, gx + 117, 154, 40, 22, { fontSize: 12 });
    t.link(prev, a);
    t.link(a, b);
    prev = b;
  });
  t.text('(a) Architecture (Swin-T)', 300, 196, 400, 20, { fontSize: 12 });
  // (b) due blocchi Swin successivi (pre-norm, flusso dal basso verso l'alto)
  const block = (cx: number, msa: string, zin: string, zhat: string, zout: string) => {
    const y0 = 600;
    const inp = t.text(zin, cx - 30, y0 + 10, 60, 22, { fontSize: 13 });
    const ln1 = t.box('LN', cx - 50, y0 - 40, 100, 24, YELLOW);
    const att = t.box(msa, cx - 50, y0 - 96, 100, 30, ORANGE);
    const a1 = t.op('+', cx - 13, y0 - 150);
    const ln2 = t.box('LN', cx - 50, y0 - 204, 100, 24, YELLOW);
    const mlp = t.box('MLP', cx - 50, y0 - 260, 100, 30, BLUE);
    const a2 = t.op('+', cx - 13, y0 - 314);
    const out = t.text(zout, cx - 30, y0 - 372, 60, 22, { fontSize: 13 });
    t.chain([inp, ln1, att, a1, ln2, mlp, a2, out], 'up');
    t.link(at(t, cx, y0 - 6), a1, 'right', 'right', { offset: 32 });
    t.link(at(t, cx, y0 - 170), a2, 'right', 'right', { offset: 32 });
    t.text(zhat, cx - 66, y0 - 148, 48, 22, { fontSize: 13, align: 'right' });
    return { inp, out };
  };
  const b1 = block(520, 'W-MSA', '$\\mathbf{z}^{l-1}$', '$\\hat{\\mathbf{z}}^{l}$', '$\\mathbf{z}^{l}$');
  const b2 = block(720, 'SW-MSA', '$\\mathbf{z}^{l}$', '$\\hat{\\mathbf{z}}^{l+1}$', '$\\mathbf{z}^{l+1}$');
  t.link(b1.out, b2.inp, 'right', 'left', { dashed: true, color: '#9AA0A6' });
  t.text('(b) Two successive Swin Transformer Blocks', 470, 640, 320, 20, { fontSize: 12 });
  // finestre regolari e spostate (Fig. 2)
  const win = { strokeWidth: 1, ...ICON, fontSize: 12, fill: '#F5F5F5', stroke: '#9E9E9E' };
  t.add({ shape: 'dl-windows', label: 'Layer $l$', count: 2, x: 30, y: 330, w: 130, h: 130, ...win });
  t.add({ shape: 'dl-windows', label: 'Layer $l+1$', spec: 'shift', count: 2, x: 220, y: 330, w: 130, h: 130, ...win });
  t.text('Shifted window partitioning (W-MSA, then SW-MSA)', 0, 500, 380, 20, { fontSize: 11, textColor: '#555555' });
  return t.done();
}

// ======================================================================
// Reti ricorrenti
// ======================================================================

/** Cella LSTM (Hochreiter & Schmidhuber 1997) nello stile della figura di Olah (2015). */
function lstm() {
  const t = new Builder();
  t.group('LSTM cell', 50, 40, 410, 230, CELL_BG);
  const gate = (label: string, cx: number) => t.box(label, cx - (label === 'tanh' ? 22 : 20), 160, label === 'tanh' ? 44 : 40, 26, YELLOW, { fontSize: label === 'tanh' ? 11 : 15, radius: 3 });
  const op = (label: string, cx: number, cy: number) => t.op(label, cx - 13, cy - 13, { ...RED, fontSize: 15 });
  const cIn = t.text('$c_{t-1}$', 0, 69, 44, 22, { fontSize: 14 });
  const cOut = t.text('$c_t$', 470, 69, 36, 22, { fontSize: 14 });
  const hIn = t.text('$h_{t-1}$', 0, 229, 44, 22, { fontSize: 14 });
  const hOut = t.text('$h_t$', 470, 229, 36, 22, { fontSize: 14 });
  const hTop = t.text('$h_t$', 425, 0, 30, 22, { fontSize: 14 });
  const xIn = t.text('$x_t$', 85, 290, 30, 22, { fontSize: 14 });
  const mulF = op('$\\times$', 130, 80);
  const addC = op('+', 250, 80);
  const mulI = op('$\\times$', 250, 120);
  const mulO = op('$\\times$', 400, 173);
  const tanhC = t.add({ shape: 'pill', label: 'tanh', x: 380, y: 109, w: 40, h: 22, fontSize: 11, strokeWidth: 1.2, ...RED });
  const sf = gate('$\\sigma$', 130), si = gate('$\\sigma$', 200), tg = gate('tanh', 250), so = gate('$\\sigma$', 330);
  // stato della cella
  t.chain([cIn, mulF, addC, cOut]);
  // ingresso concatenato [h_{t-1}, x_t]
  const busEnd = at(t, 330, 240);
  t.link(hIn, busEnd, 'right', 'left', free);
  t.link(xIn, at(t, 100, 240), 'top', 'bottom', free);
  for (const g of [sf, si, tg]) t.link(at(t, g.x + g.w / 2, 240), g, 'top', 'bottom');
  t.link(busEnd, so, 'top', 'bottom');
  t.link(sf, mulF, 'top', 'bottom');
  t.link(si, mulI, 'top', 'left');
  t.link(tg, mulI, 'top', 'bottom');
  t.link(mulI, addC, 'top', 'bottom');
  t.link(at(t, 400, 80), tanhC, 'bottom', 'top');
  t.link(tanhC, mulO, 'bottom', 'top');
  t.link(so, mulO, 'right', 'left');
  t.link(mulO, hOut, 'bottom', 'left');
  t.link(at(t, 440, 240), hTop, 'top', 'bottom');
  const lab = (s: string, x: number, y: number, align: 'left' | 'right' | 'center' = 'center') => t.text(s, x, y, 30, 18, { fontSize: 12, align });
  lab('$f_t$', 98, 113, 'right');
  lab('$i_t$', 168, 128, 'right');
  lab('$\\tilde{c}_t$', 255, 135, 'left');
  lab('$o_t$', 354, 151);
  const eq = { fontSize: 12, align: 'left' as const };
  t.text('$f_t = \\sigma(W_f [h_{t-1}, x_t] + b_f)$\n$i_t = \\sigma(W_i [h_{t-1}, x_t] + b_i)$\n$o_t = \\sigma(W_o [h_{t-1}, x_t] + b_o)$', 30, 325, 230, 60, eq);
  t.text('$\\tilde{c}_t = \\tanh(W_c [h_{t-1}, x_t] + b_c)$\n$c_t = f_t \\odot c_{t-1} + i_t \\odot \\tilde{c}_t$\n$h_t = o_t \\odot \\tanh(c_t)$', 270, 325, 240, 60, eq);
  return t.done();
}

/** Cella GRU (Cho et al. 2014) nello stile della figura di Olah (2015). */
function gru() {
  const t = new Builder();
  t.group('GRU cell', 50, 40, 440, 245, CELL_BG);
  const gate = (label: string, cx: number) => t.box(label, cx - (label === 'tanh' ? 22 : 18), 187, label === 'tanh' ? 44 : 36, 26, YELLOW, { fontSize: label === 'tanh' ? 11 : 15, radius: 3 });
  const op = (label: string, cx: number, cy: number, extra = {}) => t.op(label, cx - 13, cy - 13, { ...RED, fontSize: 15, ...extra });
  const hIn = t.text('$h_{t-1}$', 0, 59, 44, 22, { fontSize: 14 });
  const hOut = t.text('$h_t$', 500, 59, 36, 22, { fontSize: 14 });
  const hTop = t.text('$h_t$', 455, 0, 30, 22, { fontSize: 14 });
  const xIn = t.text('$x_t$', 95, 300, 30, 22, { fontSize: 14 });
  const mulA = op('$\\times$', 200, 70);
  const addC = op('+', 440, 70);
  const mulR = op('$\\times$', 140, 130);
  const mulB = op('$\\times$', 380, 200);
  const oneMinus = op('$1-$', 380, 112, { fontSize: 12, w: 30, x: 365 });
  const sr = gate('$\\sigma$', 140), sz = gate('$\\sigma$', 200), th = gate('tanh', 300);
  t.chain([hIn, mulA, addC, hOut]);
  // ingresso concatenato [h_{t-1}, x_t] per i due gate
  const busEnd = at(t, 200, 250);
  t.link(at(t, 80, 70), busEnd, 'bottom', 'left', free);
  t.link(xIn, at(t, 110, 250), 'top', 'bottom', free);
  t.link(at(t, 140, 250), sr, 'top', 'bottom');
  t.link(busEnd, sz, 'top', 'bottom');
  // reset: r_t * h_{t-1}, poi tanh insieme a x_t
  t.link(sr, mulR, 'top', 'bottom');
  t.link(at(t, 140, 70), mulR, 'bottom', 'top');
  t.link(mulR, th, 'right', 'top');
  t.link(xIn, th, 'top', 'bottom', { offset: 16 });
  // update: z_t * h_{t-1} + (1 - z_t) * h~_t
  t.link(sz, mulA, 'top', 'bottom');
  t.link(at(t, 200, 112), oneMinus, 'right', 'left');
  t.link(oneMinus, mulB, 'bottom', 'top');
  t.link(th, mulB, 'right', 'left');
  t.link(mulB, addC, 'right', 'bottom');
  t.link(at(t, 470, 70), hTop, 'top', 'bottom');
  const lab = (s: string, x: number, y: number, align: 'left' | 'right' | 'center' = 'center') => t.text(s, x, y, 30, 18, { fontSize: 12, align });
  lab('$r_t$', 108, 156, 'right');
  lab('$z_t$', 205, 150, 'left');
  lab('$\\tilde{h}_t$', 328, 178);
  const eq = { fontSize: 12, align: 'left' as const };
  t.text('$r_t = \\sigma(W_r [h_{t-1}, x_t])$\n$z_t = \\sigma(W_z [h_{t-1}, x_t])$', 40, 340, 220, 40, eq);
  t.text('$\\tilde{h}_t = \\tanh(W [r_t \\odot h_{t-1}, x_t])$\n$h_t = z_t \\odot h_{t-1} + (1 - z_t) \\odot \\tilde{h}_t$', 270, 340, 270, 40, eq);
  return t.done();
}

/** Bahdanau et al. 2015, Fig. 1: encoder bidirezionale, pesi di attenzione, decoder. */
function seq2seqAttention() {
  const t = new Builder();
  const xs = [60, 160, 260, 440];
  const names = ['1', '2', '3', 'T'];
  const top = 230, ch = 28;
  const ENC = { fill: '#DAE8FC', stroke: '#6C8EBF' };
  // annotazioni h_j = [h_j(avanti); h_j(indietro)]: una colonna di due celle per ogni parola
  xs.forEach((cx, i) => {
    t.add({ shape: 'cells', count: 2, x: cx - 17, y: top, w: 34, h: 2 * ch, radius: 2, strokeWidth: 1.2, ...ENC });
    const x = t.text(`$x_${names[i]}$`, cx - 15, 330, 30, 22, { fontSize: 14 });
    t.link(x, at(t, cx, top + 2 * ch - 0.5), 'top', 'bottom');
    t.text(`$h_${names[i]}$`, cx + 5, top + 2 * ch + 4, 26, 18, { fontSize: 12, align: 'left' });
  });
  t.text('$\\cdots$', 330, top + 16, 40, 24, { fontSize: 16 });
  // RNN in avanti (cella alta) e all'indietro (cella bassa)
  const fy = top + ch / 2, by = top + ch * 1.5;
  const ends = [...xs.slice(0, 3).map((x) => [x - 17, x + 17]), [330, 370], [xs[3] - 17, xs[3] + 17]];
  for (let i = 0; i + 1 < ends.length; i++) {
    t.link(at(t, ends[i][1], fy), at(t, ends[i + 1][0], fy), 'right', 'left', { routing: 'straight' });
    t.link(at(t, ends[i + 1][0], by), at(t, ends[i][1], by), 'left', 'right', { routing: 'straight' });
  }
  t.text('forward RNN', -64, fy - 9, 100, 18, { fontSize: 10, align: 'right', textColor: '#555555' });
  t.text('backward RNN', -64, by - 9, 100, 18, { fontSize: 10, align: 'right', textColor: '#555555' });
  // contesto c_t = somma pesata delle annotazioni
  const sum = t.op('+', 237, 125);
  xs.forEach((cx, i) => {
    t.link(at(t, cx, top + 0.5), sum, 'top', 'bottom', { routing: 'straight', color: '#7E57C2' });
    const left = cx < 200;
    t.text(`$\\alpha_{t,${names[i]}}$`, left ? cx - 45 : cx + 5, top - 22, 40, 20, { fontSize: 12, align: left ? 'right' : 'left', textColor: '#5E35B1' });
  });
  const DEC = { fill: '#D5E8D4', stroke: '#82B366' };
  const sPrev = t.box('$s_{t-1}$', 100, 40, 60, 34, DEC, { fontSize: 14 });
  const s = t.box('$s_t$', 220, 40, 60, 34, DEC, { fontSize: 14 });
  const yPrev = t.text('$y_{t-1}$', 110, -20, 40, 22, { fontSize: 14 });
  const y = t.text('$y_t$', 235, -20, 30, 22, { fontSize: 14 });
  t.link(sPrev, s);
  t.link(sum, s, 'top', 'bottom', { label: '$c_t$', labelPos: 'below', fontSize: 13 });
  t.link(sPrev, yPrev, 'top', 'bottom');
  t.link(s, y, 'top', 'bottom');
  t.link(yPrev, at(t, 230, 40.5), 'right', 'top', { routing: 'straight' });
  t.text('$c_t = \\sum_{j=1}^{T} \\alpha_{t,j} h_j$\n$\\alpha_{t,j} = \\frac{\\exp(e_{t,j})}{\\sum_{k=1}^{T} \\exp(e_{t,k})}$\n$e_{t,j} = a(s_{t-1}, h_j)$', 330, 0, 200, 120, { fontSize: 12, align: 'left' });
  return t.done();
}

// ======================================================================
// Modelli generativi
// ======================================================================

/** Kingma & Welling 2014: autoencoder variazionale con trucco della riparametrizzazione. */
function vae() {
  const t = new Builder();
  const x = t.add({ shape: 'dl-augimg', label: '$x$', x: 0, y: 62, w: 76, h: 76, ...IMG, fontSize: 15 });
  const enc = t.add({ ...ENC_STYLE, label: '$q_\\phi(z|x)$', sublabel: 'Encoder', x: 112, y: 30, w: 116, h: 140, fontSize: 15 });
  const mu = t.add({ shape: 'cells', label: '$\\mu$', labelPos: 'above', count: 4, x: 272, y: 22, w: 22, h: 64, radius: 2, fontSize: 15, strokeWidth: 1.2, ...ORANGE });
  const sg = t.add({ shape: 'cells', label: '$\\sigma$', labelPos: 'below', count: 4, x: 272, y: 114, w: 22, h: 64, radius: 2, fontSize: 15, strokeWidth: 1.2, ...ORANGE });
  const mul = t.op('$\\odot$', 340, 133);
  const eps = t.add({ shape: 'heatmap', label: '$\\epsilon \\sim \\mathcal{N}(0, I)$', spec: '8x8', x: 326, y: 200, w: 54, h: 54, strokeWidth: 1, ...ICON, fontSize: 13, ...GRAY });
  const add = t.op('+', 420, 87);
  const z = t.add({ shape: 'cells', label: '$z$', labelPos: 'above', count: 4, x: 470, y: 68, w: 22, h: 64, radius: 2, fontSize: 15, strokeWidth: 1.2, ...PURPLE });
  const dec = t.add({ ...DEC_STYLE, label: '$p_\\theta(x|z)$', sublabel: 'Decoder', x: 536, y: 30, w: 116, h: 140, fontSize: 15 });
  const xh = t.add({ shape: 'dl-augimg', label: '$\\hat{x}$', spec: 'blur', x: 690, y: 62, w: 76, h: 76, ...IMG, fontSize: 15 });
  t.link(x, enc);
  t.link(enc, mu, 'right', 'left');
  t.link(enc, sg, 'right', 'left');
  t.link(sg, mul, 'right', 'left');
  t.link(eps, mul, 'top', 'bottom');
  t.link(mu, add, 'right', 'top');
  t.link(mul, add, 'right', 'bottom');
  t.link(add, z);
  t.link(z, dec);
  t.link(dec, xh);
  t.text('$z = \\mu + \\sigma \\odot \\epsilon$', 400, 160, 140, 22, { fontSize: 13, align: 'left' });
  t.text('reparameterization trick', 400, 182, 140, 18, { fontSize: 10, align: 'left', textColor: '#555555' });
  const loss = t.box('', 150, 310, 470, 62, { fill: '#FAFAFB', stroke: '#B8BEC8' }, {
    label: 'ELBO (maximized)',
    bold: true,
    fontSize: 11,
    sublabel: '$\\mathcal{L}(\\theta, \\phi; x) = \\mathbb{E}_{q_\\phi}\\left[\\log p_\\theta(x|z)\\right] - D_{\\mathrm{KL}}\\left(q_\\phi(z|x) \\| p(z)\\right)$',
    subSize: 15,
    radius: 10,
  });
  t.link(x, loss, 'bottom', 'left', { dashed: true, color: '#7A808A' });
  t.link(xh, loss, 'bottom', 'right', { dashed: true, color: '#7A808A' });
  t.text('reconstruction', 245, 378, 120, 18, { fontSize: 10, textColor: '#555555' });
  t.text('KL to the prior $p(z) = \\mathcal{N}(0, I)$', 410, 378, 190, 18, { fontSize: 10, textColor: '#555555' });
  return t.done();
}

/** Goodfellow et al. 2014: generatore e discriminatore, gioco minimax. */
function gan() {
  const t = new Builder();
  const z = t.add({ shape: 'heatmap', label: 'Random noise\n$z \\sim p_z(z)$', spec: '8x8', x: 0, y: 40, w: 60, h: 60, strokeWidth: 1, ...ICON, fontSize: 12, ...GRAY });
  const G = t.add({ ...DEC_STYLE, label: '$G$', sublabel: 'Generator', x: 100, y: 0, w: 110, h: 140, fontSize: 26 });
  t.add({ shape: 'flame', x: 196, y: -6, w: 15, h: 20, ...FLAME });
  const fake = t.add({ shape: 'dl-augimg', label: 'Fake sample\n$G(z)$', spec: 'blur color', x: 250, y: 32, w: 76, h: 76, ...IMG, fontSize: 12 });
  const data = t.add({ shape: 'cylinder', label: 'Training\ndata', x: 0, y: 200, w: 76, h: 70, fontSize: 11, strokeWidth: 1.2, ...GRAY });
  const real = t.add({ shape: 'dl-augimg', label: 'Real sample\n$x \\sim p_{\\mathrm{data}}(x)$', x: 250, y: 197, w: 76, h: 76, ...IMG, fontSize: 12 });
  const D = t.add({ ...ENC_STYLE, label: '$D$', sublabel: 'Discriminator', x: 390, y: 85, w: 110, h: 140, fontSize: 26 });
  t.add({ shape: 'flame', x: 486, y: 79, w: 15, h: 20, ...FLAME });
  const out = t.add({ shape: 'pill', label: 'real / fake', sublabel: '$D(\\cdot) \\in [0, 1]$', subSize: 11, x: 540, y: 128, w: 110, h: 54, fontSize: 12, ...YELLOW });
  t.link(z, G);
  t.link(G, fake);
  t.link(data, real);
  t.link(fake, D, 'right', 'left');
  t.link(real, D, 'right', 'left');
  t.link(D, out);
  t.link(out, G, 'top', 'top', { offset: -10, dashed: true, color: '#C0392B', label: 'gradients (backprop through $D$)', labelPos: 'above', fontSize: 10 });
  t.text('$\\min_G \\max_D V(D, G) = \\mathbb{E}_{x \\sim p_{\\mathrm{data}}}[\\log D(x)] + \\mathbb{E}_{z \\sim p_z}[\\log(1 - D(G(z)))]$', 40, 316, 600, 40, { fontSize: 14 });
  return t.done();
}

// ======================================================================
// Apprendimento di rappresentazioni e addestramento
// ======================================================================

/** Chen et al. 2020 (SimCLR), Fig. 2: due viste aumentate, encoder f, proiezione g, accordo massimo. */
function simclr() {
  const t = new Builder();
  const L = 90, R = 330, CX = 210;
  const x = t.add({ shape: 'dl-augimg', label: '$\\mathbf{x}$', x: CX - 32, y: 430, w: 64, h: 64, ...IMG, labelPos: 'below', fontSize: 15 });
  const xi = t.add({ shape: 'dl-augimg', spec: 'crop color', x: L - 32, y: 330, w: 64, h: 64, ...IMG });
  const xj = t.add({ shape: 'dl-augimg', spec: 'crop flip gray', count: 2, x: R - 32, y: 330, w: 64, h: 64, ...IMG });
  t.text('$\\tilde{\\mathbf{x}}_i$', L - 66, 350, 28, 24, { fontSize: 15 });
  t.text('$\\tilde{\\mathbf{x}}_j$', R + 38, 350, 28, 24, { fontSize: 15 });
  const box = (label: string, cx: number, y: number, c: Color) => t.box(label, cx - 40, y, 80, 34, c, { fontSize: 14 });
  const fi = box('$f(\\cdot)$', L, 250, BLUE), fj = box('$f(\\cdot)$', R, 250, BLUE);
  const hi = t.text('$\\mathbf{h}_i$', L - 20, 190, 40, 24, { fontSize: 15 });
  const hj = t.text('$\\mathbf{h}_j$', R - 20, 190, 40, 24, { fontSize: 15 });
  const gi = box('$g(\\cdot)$', L, 120, GREEN), gj = box('$g(\\cdot)$', R, 120, GREEN);
  const zi = t.text('$\\mathbf{z}_i$', L - 20, 50, 40, 24, { fontSize: 15 });
  const zj = t.text('$\\mathbf{z}_j$', R - 20, 50, 40, 24, { fontSize: 15 });
  t.link(x, xi, 'left', 'bottom', { label: '$t \\sim \\mathcal{T}$', labelPos: 'below', fontSize: 13 });
  t.link(x, xj, 'right', 'bottom', { label: "$t' \\sim \\mathcal{T}$", labelPos: 'below', fontSize: 13 });
  t.chain([xi, fi, hi, gi, zi], 'up');
  t.chain([xj, fj, hj, gj, zj], 'up');
  t.link(zi, zj, 'right', 'left', { arrowStart: true, label: 'Maximize agreement', labelPos: 'above', fontSize: 12 });
  const r = t.text('Representation', CX - 50, 192, 100, 20, { fontSize: 11, textColor: '#555555' });
  t.link(r, hi, 'left', 'right', { color: '#9AA0A6', width: 1 });
  t.link(r, hj, 'right', 'left', { color: '#9AA0A6', width: 1 });
  t.text('$\\ell_{i,j} = -\\log \\frac{\\exp(\\mathrm{sim}(\\mathbf{z}_i, \\mathbf{z}_j) / \\tau)}{\\sum_{k=1}^{2N} [k \\neq i] \\exp(\\mathrm{sim}(\\mathbf{z}_i, \\mathbf{z}_k) / \\tau)}$', -10, 536, 440, 50, { fontSize: 13 });
  t.text('NT-Xent loss over the $2N$ augmented views of a batch', -10, 594, 440, 18, { fontSize: 10, textColor: '#555555' });
  return t.done();
}

/** Hinton et al. 2015: distillazione della conoscenza con softmax a temperatura T. */
function distillation() {
  const t = new Builder();
  const x = t.add({ shape: 'dl-augimg', label: '$x$', x: 0, y: 132, w: 70, h: 70, ...IMG, fontSize: 15 });
  const teacher = t.add({ ...ENC_STYLE, label: 'Teacher', sublabel: 'large, pre-trained', x: 120, y: 10, w: 120, h: 130, fontSize: 14, bold: true, fill: '#FDE9C9', stroke: '#D79B00', textColor: '#7A4A00' });
  t.add({ shape: 'snowflake', x: 226, y: 4, w: 18, h: 18, ...FROZEN });
  const student = t.add({ ...ENC_STYLE, label: 'Student', sublabel: 'small', x: 130, y: 215, w: 100, h: 90, fontSize: 13, bold: true });
  t.add({ shape: 'flame', x: 218, y: 207, w: 15, h: 20, ...FLAME });
  const sm = (label: string, y: number) => t.box(label, 290, y, 110, 34, GRAY, { fontSize: 12 });
  const dist = (label: string, spec: string, y: number, c: Color) =>
    t.add({ shape: 'dl-softmax', label, spec, count: 6, x: 445, y, w: 80, h: 46, strokeWidth: 1.2, ...ICON, fontSize: 11, ...c });
  const smT = sm('softmax($T$)', 58);
  const smS = sm('softmax($T$)', 210);
  const smH = sm('softmax($T = 1$)', 300);
  const soft = dist('soft labels', '4', 52, ORANGE);
  const softS = dist('soft predictions', '4', 204, BLUE);
  const hard = dist('hard predictions', '1', 294, BLUE);
  const gt = dist('ground truth $y$', '0.05', 391, GREEN);
  t.link(x, teacher, 'right', 'left');
  t.link(x, student, 'right', 'left');
  t.link(teacher, smT, 'right', 'left', { label: '$z_t$', labelPos: 'above', fontSize: 12 });
  t.link(student, smS, 'right', 'left', { label: '$z_s$', labelPos: 'above', fontSize: 12 });
  t.link(student, smH, 'right', 'left');
  t.chain([smT, soft]);
  t.chain([smS, softS]);
  t.chain([smH, hard]);
  const kd = t.box('Distillation loss', 590, 110, 200, 60, RED, { bold: true, fontSize: 11, sublabel: '$T^2 \\mathrm{KL}(p_t^T \\| p_s^T)$', subSize: 13 });
  const ce = t.box('Student loss', 590, 384, 200, 60, RED, { bold: true, fontSize: 11, sublabel: '$\\mathrm{CE}(y, p_s)$', subSize: 13 });
  t.link(soft, kd, 'right', 'top');
  t.link(softS, kd, 'right', 'bottom');
  t.link(hard, ce, 'right', 'top');
  t.link(gt, ce, 'right', 'left');
  t.text('$\\mathcal{L} = \\alpha \\mathcal{L}_{\\mathrm{KD}} + (1 - \\alpha) \\mathcal{L}_{\\mathrm{CE}}$', 10, 352, 380, 24, { fontSize: 13, align: 'left' });
  t.text('$p_i^T = \\frac{\\exp(\\frac{z_i}{T})}{\\sum_j \\exp(\\frac{z_j}{T})}$', 10, 386, 380, 60, { fontSize: 13, align: 'left', textColor: '#444444' });
  return t.done();
}

/** Schroff et al. 2015 (FaceNet), Fig. 2–3: rete a pesi condivisi e triplet loss. */
function tripletNet() {
  const t = new Builder();
  const rows: [string, string, string][] = [
    ['Anchor', '$x^a$', ''],
    ['Positive', '$x^p$', 'crop flip'],
    ['Negative', '$x^n$', 'color'],
  ];
  const cnns: N[] = [];
  const embs: N[] = [];
  rows.forEach(([name, sym, spec], i) => {
    const cy = 40 + i * 110;
    t.text(`${name}\n${sym}`, 0, cy - 18, 64, 36, { fontSize: 12, align: 'right' });
    const img = t.add({ shape: 'dl-augimg', spec, count: i, x: 76, y: cy - 30, w: 60, h: 60, ...IMG });
    const cnn = t.icon('cnn', '', 176, cy - 26, 110, 52, ORANGE, { count: 3 });
    const l2 = t.box('L2', 316, cy - 14, 40, 28, GRAY, { fontSize: 12 });
    const emb = t.add({ shape: 'cells', count: 5, x: 390, y: cy - 30, w: 16, h: 60, radius: 2, strokeWidth: 1.2, ...PURPLE });
    t.text(`$f(${sym.slice(1, -1)})$`, 410, cy - 30, 46, 20, { fontSize: 11, align: 'left' });
    t.chain([img, cnn, l2, emb]);
    cnns.push(cnn);
    embs.push(emb);
  });
  t.text('$f_\\theta$', 216, -16, 30, 22, { fontSize: 14 });
  for (let i = 0; i < 2; i++) t.link(cnns[i], cnns[i + 1], 'bottom', 'top', { dashed: true, arrowEnd: false, color: '#9AA0A6' });
  t.text('shared\nweights', 236, 85, 60, 30, { fontSize: 10, textColor: '#555555', align: 'left' });
  const loss = t.box('Triplet\nLoss', 480, 105, 90, 90, RED, { bold: true, fontSize: 12 });
  embs.forEach((e) => t.link(e, loss, 'right', 'left'));
  t.text('$\\mathcal{L} = \\sum_{i}^{N} \\left[ \\| f(x_i^a) - f(x_i^p) \\|_2^2 - \\| f(x_i^a) - f(x_i^n) \\|_2^2 + \\alpha \\right]_+$', 0, 306, 580, 40, { fontSize: 13 });
  // apprendimento nello spazio degli embedding (Fig. 3)
  const sp = { shape: 'dl-triplet', w: 120, h: 90, radius: 6, strokeWidth: 1, fill: '#FAFAFA', stroke: '#BDBDBD' };
  const before = t.add({ ...sp, x: 70, y: 366 });
  const after = t.add({ ...sp, spec: 'after', x: 330, y: 366 });
  t.link(before, after, 'right', 'left', { label: 'Learning', labelPos: 'above', fontSize: 11 });
  const legend: [string, string][] = [['Anchor', '#3B6FB6'], ['Positive', '#3D7A3D'], ['Negative', '#A33A35']];
  legend.forEach(([s, c], i) => t.text(s, 470, 378 + i * 22, 70, 18, { fontSize: 11, align: 'left', textColor: c, bold: true }));
  return t.done();
}

/** Shazeer et al. 2017, Fig. 1: strato Mixture-of-Experts con gating sparso top-k. */
function moe() {
  const t = new Builder();
  t.group('MoE layer', 0, 0, 600, 300, { dashed: false, stroke: '#9E9E9E', fill: '#FAFAFA' });
  const centers = [62, 166, 270, 414, 518];
  const names = ['Expert 1', 'Expert 2', 'Expert 3', 'Expert $n-1$', 'Expert $n$'];
  const active = [false, true, false, true, false];
  const experts = centers.map((c, i) => t.box(names[i], c - 44, 150, 88, 46, active[i] ? BLUE : GRAY, { fontSize: 11, ...(active[i] ? {} : INACTIVE) }));
  t.text('$\\cdots$', 322, 162, 40, 22, { fontSize: 16 });
  const gating = t.box('Gating Network', 215, 240, 150, 36, YELLOW, { fontSize: 12 });
  const x = t.text('$x$', 275, 320, 30, 22, { fontSize: 15 });
  t.link(x, gating, 'top', 'bottom');
  t.text('top-$k$ routing ($k = 2$)', 372, 248, 140, 20, { fontSize: 10, align: 'left', textColor: '#555555' });
  const mulA = t.op('$\\times$', 153, 82);
  const mulB = t.op('$\\times$', 401, 82);
  const sum = t.op('+', 277, 27);
  const y = t.text('$y$', 275, -40, 30, 22, { fontSize: 15 });
  t.link(gating, experts[1], 'top', 'bottom');
  t.link(gating, experts[3], 'top', 'bottom');
  t.link(experts[1], mulA, 'top', 'bottom');
  t.link(experts[3], mulB, 'top', 'bottom');
  t.link(mulA, sum, 'top', 'left');
  t.link(mulB, sum, 'top', 'right');
  t.link(sum, y, 'top', 'bottom');
  const ga = t.text('$G(x)_2$', 70, 85, 56, 20, { fontSize: 12, align: 'right', textColor: '#7A4A00' });
  const gb = t.text('$G(x)_{n-1}$', 452, 85, 70, 20, { fontSize: 12, align: 'left', textColor: '#7A4A00' });
  t.link(ga, mulA, 'right', 'left', { color: '#D79B00' });
  t.link(gb, mulB, 'left', 'right', { color: '#D79B00' });
  t.text('$y = \\sum_{i=1}^{n} G(x)_i E_i(x)$', 20, 352, 260, 40, { fontSize: 13, align: 'left' });
  t.text('$G(x) = \\mathrm{Softmax}(\\mathrm{KeepTopK}(H(x), k))$', 290, 360, 320, 24, { fontSize: 13, align: 'left' });
  return t.done();
}

// ======================================================================
// Modelli linguistici pre-addestrati
// ======================================================================

type Row = { toks: string[]; cx: (i: number) => number; top: number; bottom: number; node: N };
const DOTS = '...';

/** Riga di token (forma dl-tokens); restituisce i centri delle colonne per allineare le frecce. */
function tokenRow(t: Builder, toks: string[], x: number, y: number, w: number, h: number, c: Color, extra: Partial<N> = {}): Row {
  const node = t.add({ shape: 'dl-tokens', spec: toks.join('|'), x, y, w, h, radius: 5, strokeWidth: 1, ...c, ...extra });
  const cols = tokenColumns(x, w, toks.length);
  return { toks, cx: cols.center, top: y, bottom: y + h, node };
}

/** Frecce verticali colonna per colonna, dal lato alto di `from` al lato basso di un riquadro (salta i puntini). */
function columnArrows(t: Builder, from: Row, toBottom: number, cols?: number[]) {
  from.toks.forEach((s, i) => {
    if (s === DOTS || (cols && !cols.includes(i))) return;
    t.link(at(t, from.cx(i), from.top + 0.5), at(t, from.cx(i), toBottom - 0.5), 'top', 'bottom');
  });
}

/** Devlin et al. 2019 (BERT), Fig. 1 a sinistra: pre-addestramento con NSP e Masked LM. */
function bertPretraining() {
  const t = new Builder();
  const X = 0, W = 560;
  const tok = ['[CLS]', 'Tok 1', DOTS, 'Tok N', '[SEP]', 'Tok 1', DOTS, 'Tok M'];
  const emb = ['$E_{\\mathrm{[CLS]}}$', '$E_1$', DOTS, '$E_N$', '$E_{\\mathrm{[SEP]}}$', "$E'_1$", DOTS, "$E'_M$"];
  const out = ['$C$', '$T_1$', DOTS, '$T_N$', '$T_{\\mathrm{[SEP]}}$', "$T'_1$", DOTS, "$T'_M$"];
  const T = tokenRow(t, out, X, 64, W, 32, { fill: '#DCE9F7', stroke: '#6C8EBF' });
  const bert = t.box('BERT', X, 128, W, 84, { fill: '#F3F0F8', stroke: '#9673A6' }, { bold: true, fontSize: 18, radius: 12 });
  const E = tokenRow(t, emb, X, 244, W, 32, YELLOW);
  const I = tokenRow(t, tok, X, 308, W, 30, { fill: '#F7F7F7', stroke: '#8A929C' });
  columnArrows(t, I, E.bottom);
  columnArrows(t, E, bert.y + bert.h);
  out.forEach((s, i) => s !== DOTS && t.link(at(t, T.cx(i), bert.y + 0.5), at(t, T.cx(i), T.bottom - 0.5), 'top', 'bottom'));
  // teste di pre-addestramento
  const { cw } = tokenColumns(X, W, out.length);
  const head = (label: string, i0: number, i1: number, c: Color) => t.box(label, T.cx(i0) - cw / 2, 0, T.cx(i1) - T.cx(i0) + cw, 30, c, { fontSize: 12, bold: true });
  const nsp = head('NSP', 0, 0, GREEN);
  const mlmA = head('Mask LM', 1, 3, ORANGE);
  const mlmB = head('Mask LM', 5, 7, ORANGE);
  const up = (i: number, to: N) => t.link(at(t, T.cx(i), T.top + 0.5), at(t, T.cx(i), to.y + to.h - 0.5), 'top', 'bottom');
  up(0, nsp);
  [1, 3].forEach((i) => up(i, mlmA));
  [5, 7].forEach((i) => up(i, mlmB));
  const mid = (a: number, b: number) => (T.cx(a) + T.cx(b)) / 2;
  t.text('Masked Sentence A', mid(0, 3) - 80, 346, 160, 18, { fontSize: 11 });
  t.text('Masked Sentence B', mid(5, 7) - 80, 346, 160, 18, { fontSize: 11 });
  t.text('Unlabeled Sentence A and B Pair', W / 2 - 120, 368, 240, 18, { fontSize: 11, textColor: '#555555' });
  t.text('Pre-training', W / 2 - 60, 394, 120, 22, { fontSize: 13, bold: true });
  return t.done();
}

/** Devlin et al. 2019 (BERT), Fig. 2: embedding di token, segmento e posizione sommati. */
function bertInput() {
  const t = new Builder();
  const X = 0, W = 700;
  const tok = ['[CLS]', 'my', 'dog', 'is', 'cute', '[SEP]', 'he', 'likes', 'play', '##ing', '[SEP]'];
  // '#' non è ammesso nelle formule: l'embedding di "##ing" si scrive E_ing
  const tokEmb = tok.map((s) => `$E_{\\mathrm{${s.replace('##', '')}}}$`);
  const seg = tok.map((_, i) => (i < 6 ? '$E_A$' : '$E_B$'));
  const pos = tok.map((_, i) => `$E_{${i}}$`);
  const rows: [string, string[], Color][] = [
    ['Input', tok, { fill: '#FFFFFF', stroke: '#8A929C' }],
    ['Token\nEmbeddings', tokEmb, YELLOW],
    ['Segment\nEmbeddings', seg, GREEN],
    ['Position\nEmbeddings', pos, { fill: '#F5F5F5', stroke: '#8A929C' }],
  ];
  const ys = [0, 64, 124, 184];
  let last: Row | null = null;
  rows.forEach(([name, toks, c], k) => {
    const r = tokenRow(t, toks, X, ys[k], W, 32, c);
    t.text(name, X - 112, ys[k] + 16 - (name.includes('\n') ? 14 : 8), 100, name.includes('\n') ? 28 : 16, { fontSize: 11, align: 'right', bold: k === 0 });
    if (k >= 2 && last) toks.forEach((_, i) => t.text('+', r.cx(i) - 8, (last!.bottom + r.top) / 2 - 9, 16, 18, { fontSize: 15 }));
    last = r;
  });
  return t.done();
}

/** Radford et al. 2018 (GPT), Fig. 1 a sinistra: decoder-only con self-attention mascherata e previsione del token successivo. */
function gpt() {
  const t = new Builder();
  const X = 170, W = 260, CX = 300;
  const inp = tokenRow(t, ['The', 'cat', 'sat', 'on'], X, 620, W, 28, { fill: '#F7F7F7', stroke: '#8A929C' });
  const emb = t.box('Text & Position Embed', X, 560, W, 32, RED, { fontSize: 12 });
  columnArrows(t, inp, emb.y + emb.h);
  t.group('', 150, 200, 300, 340, { fill: '#F2F2F2', stroke: '#C8C8C8', dashed: false });
  t.text('$12 \\times$', 100, 356, 44, 24, { fontSize: 14 });
  const attn = t.box('Masked Multi\nSelf Attention', CX - 65, 470, 130, 44, ORANGE);
  const add1 = t.op('+', CX - 13, 428);
  const ln1 = t.box('Layer Norm', CX - 65, 384, 130, 26, YELLOW, { fontSize: 11 });
  const ff = t.box('Feed Forward', CX - 65, 326, 130, 36, BLUE);
  const add2 = t.op('+', CX - 13, 282);
  const ln2 = t.box('Layer Norm', CX - 65, 236, 130, 26, YELLOW, { fontSize: 11 });
  t.link(emb, attn, 'top', 'bottom');
  t.chain([attn, add1, ln1, ff, add2, ln2], 'up');
  // residui (GPT-1 usa la post-norm: somma, poi Layer Norm)
  t.link(at(t, CX, 545), add1, 'left', 'left', { offset: -54 });
  t.link(at(t, CX, 373), add2, 'left', 'left', { offset: -54 });
  // teste: previsione del testo (LM) e classificatore del task
  const lm = t.box('Text Prediction', X, 150, W, 32, PURPLE, { fontSize: 12 });
  const task = t.box('Task Classifier', 470, 150, 116, 32, GREEN, { fontSize: 12 });
  t.link(ln2, lm, 'top', 'bottom');
  t.link(ln2, task, 'right', 'bottom');
  const out = tokenRow(t, ['cat', 'sat', 'on', '*the'], X, 88, W, 28, BLUE);
  out.toks.forEach((_, i) => t.link(at(t, out.cx(i), lm.y + 0.5), at(t, out.cx(i), out.bottom - 0.5), 'top', 'bottom'));
  t.text('next token (targets shifted by one)', 440, 92, 220, 20, { fontSize: 11, align: 'left', textColor: '#555555' });
  t.text('input tokens', 440, 624, 120, 20, { fontSize: 11, align: 'left', textColor: '#555555' });
  // maschera causale: ogni posizione vede solo i token precedenti
  const mask = t.add({ shape: 'dl-mask', label: 'causal mask', spec: 'causal', count: 5, x: 490, y: 452, w: 80, h: 80, strokeWidth: 1, ...ICON, fontSize: 11, ...BLUE });
  t.link(mask, attn, 'left', 'right', { dashed: true, color: '#7A808A' });
  t.text('$L_1(\\mathcal{U}) = \\sum_i \\log P(u_i \\mid u_{i-k}, \\ldots, u_{i-1}; \\Theta)$', 60, 666, 480, 44, { fontSize: 14 });
  t.text('$P(u) = \\mathrm{softmax}(h_n W_e^{\\top})$', 60, 712, 480, 24, { fontSize: 13 });
  return t.done();
}

const T = (id: string, name: string, build: TemplateDef['build']): TemplateDef => ({ id, name, section: SECTION, build });

export const DL_TEMPLATES: TemplateDef[] = [
  T('dl-resnet-block', 'Blocco residuo (ResNet)', resnetBlock),
  T('dl-resnet-bottleneck', 'ResNet: base vs bottleneck', resnetBottleneck),
  T('dl-inception', 'Modulo Inception (GoogLeNet)', inception),
  T('dl-se-block', 'Squeeze-and-Excitation', seBlock),
  T('dl-attention', 'Attention (scaled dot-product, multi-head)', attention),
  T('dl-swin', 'Swin Transformer', swin),
  T('dl-lstm', 'Cella LSTM', lstm),
  T('dl-gru', 'Cella GRU', gru),
  T('dl-seq2seq-attn', 'Seq2seq con attention (Bahdanau)', seq2seqAttention),
  T('dl-vae', 'VAE', vae),
  T('dl-gan', 'GAN', gan),
  T('dl-simclr', 'SimCLR (contrastive)', simclr),
  T('dl-distillation', 'Knowledge distillation', distillation),
  T('dl-triplet', 'Rete siamese / triplet loss', tripletNet),
  T('dl-moe', 'Mixture of Experts', moe),
  T('dl-norms', 'Normalizzazioni (BN, LN, IN, GN)', normalizations),
  T('dl-dropout', 'Dropout', dropoutNet),
  T('dl-bert', 'BERT: pre-addestramento', bertPretraining),
  T('dl-bert-input', 'BERT: embedding di ingresso', bertInput),
  T('dl-gpt', 'GPT (decoder-only)', gpt),
];
