// Modelli del modulo ml_dl_more, ricalcati sulle figure principali dei paper (autori, anno e
// arXiv nel commento di ogni modello): blocchi e connessioni normali, tutto resta modificabile.
import { Builder, type Color } from '../builder';
import { COLORS, ICON } from '../model';
import type { TemplateDef } from '../registry';
import { EWC_COLORS, GP_COLORS, QKV_ROWS, ROPE_POS, ropePairX, tokCenters } from './ml_dl_more-shapes';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
/** Punto esatto (px, py) su una linea o un bordo: estremo invisibile per diramazioni e residui. */
const at = (t: Builder, px: number, py: number) => t.anchor(px - 0.5, py - 0.5);
const free = { arrowEnd: false, routing: 'straight' as const };
const NOTE = { fontSize: 11, textColor: '#555555', align: 'left' as const };

// ======================================================================
// Interni degli LLM
// ======================================================================

/** Touvron et al. 2023, LLaMA (arXiv 2302.13971) e Llama 2 (arXiv 2307.09288): decoder pre-norm con RMSNorm, RoPE, GQA e SwiGLU. */
function llama() {
  const t = new Builder();
  const CX = 300, W = 150, X = CX - W / 2;
  const inp = t.text('Input tokens', CX - 60, 812, 120, 20);
  const emb = t.box('Embeddings', X, 752, W, 30, RED);
  t.group('', 170, 168, 260, 562, { fill: '#F2F2F2', stroke: '#C8C8C8', dashed: false });
  t.text('$N \\times$', 128, 436, 36, 24, { fontSize: 14 });
  const n1 = t.box('RMS Norm', X, 684, W, 26, YELLOW, { fontSize: 11 });
  const cols = [CX - 60, CX, CX + 60];
  const proj = ['$W_Q$', '$W_K$', '$W_V$'].map((s, i) => t.box(s, cols[i] - 24, 626, 48, 26, GREEN, { fontSize: 13 }));
  const rope = [0, 1].map((i) => t.box('RoPE', cols[i] - 24, 580, 48, 24, PURPLE, { fontSize: 10 }));
  const att = t.box('Grouped-Query Attention', X - 10, 514, W + 20, 44, ORANGE, { sublabel: 'with KV cache', subSize: 10, fontSize: 12 });
  const add1 = t.op('+', CX - 13, 468);
  const n2 = t.box('RMS Norm', X, 420, W, 26, YELLOW, { fontSize: 11 });
  const w1 = t.box('$W_1$', CX - 66, 366, 48, 26, BLUE, { fontSize: 13 });
  const w3 = t.box('$W_3$', CX + 18, 366, 48, 26, BLUE, { fontSize: 13 });
  const silu = t.box('SiLU', CX - 66, 322, 48, 24, TEAL, { fontSize: 11 });
  const mul = t.op('$\\odot$', CX - 13, 278);
  const w2 = t.box('$W_2$', CX - 24, 232, 48, 26, BLUE, { fontSize: 13 });
  const add2 = t.op('+', CX - 13, 186);
  const n3 = t.box('RMS Norm', X, 128, W, 26, YELLOW, { fontSize: 11 });
  const lin = t.box('Linear', X, 84, W, 26, PURPLE);
  const sm = t.box('Softmax', X, 40, W, 26, GREEN);
  const out = t.text('Output probabilities', CX - 75, 0, 150, 20);
  t.chain([inp, emb, n1], 'up');
  proj.forEach((p, i) => t.link(at(t, cols[i], 684), p, 'top', 'bottom'));
  rope.forEach((r, i) => t.chain([proj[i], r, at(t, cols[i], 558)], 'up'));
  t.link(proj[2], at(t, cols[2], 558), 'top', 'bottom');
  t.chain([att, add1, n2], 'up');
  t.link(at(t, CX - 42, 420), w1, 'top', 'bottom');
  t.link(at(t, CX + 42, 420), w3, 'top', 'bottom');
  t.link(w1, silu, 'top', 'bottom');
  t.link(silu, mul, 'top', 'left');
  t.link(w3, mul, 'top', 'right');
  t.chain([mul, w2, add2, n3, lin, sm, out], 'up');
  // residui pre-norm
  t.link(at(t, CX, 738), add1, 'left', 'left', { offset: -76 });
  t.link(at(t, CX, 457), add2, 'left', 'left', { offset: -76 });
  t.text('$\\bar{a}_i = \\frac{a_i}{\\mathrm{RMS}(\\mathbf{a})} g_i$', 446, 676, 200, 42, { ...NOTE, fontSize: 13 });
  t.text('rotary position embedding\non queries and keys', 446, 574, 200, 36, NOTE);
  t.text('$n_{kv} < n_h$ key/value heads\nshared by groups of queries', 446, 516, 200, 36, NOTE);
  t.text('SwiGLU feed-forward', 446, 300, 200, 18, { ...NOTE, bold: true });
  t.text('$W_2(\\mathrm{SiLU}(W_1 x) \\odot W_3 x)$', 446, 320, 220, 24, { ...NOTE, fontSize: 13 });
  return t.done();
}

/** Ainslie et al. 2023 (GQA, arXiv 2305.13245), Fig. 2: multi-head, grouped-query e multi-query attention. */
function gqa() {
  const t = new Builder();
  const W = 230, H = 220, GAP = 60, X0 = 90;
  const kinds: [string, string, boolean][] = [['mha', 'Multi-head', false], ['gqa g4', 'Grouped-query', true], ['mqa', 'Multi-query', false]];
  kinds.forEach(([spec, title, bold], i) =>
    t.add({ shape: 'dlm-qkv', spec, count: 8, label: title, labelPos: 'above', fontSize: 16, bold, x: X0 + i * (W + GAP), y: 0, w: W, h: H, strokeWidth: 1.2, ...BLUE }),
  );
  const rows: [string, number][] = [['Values', QKV_ROWS.v], ['Keys', QKV_ROWS.k], ['Queries', QKV_ROWS.q]];
  rows.forEach(([s, f]) => t.text(s, 0, (f + QKV_ROWS.h / 2) * H - 10, 76, 20, { fontSize: 14 }));
  return t.done();
}

/** Dao et al. 2022 (FlashAttention, arXiv 2205.14135), Fig. 1: gerarchia di memoria, tiling e tempi su GPT-2. */
function flashAttention() {
  const t = new Builder();
  const OUTER = '#E05A5A', INNER = '#4F7CC0', COPY = '#A0629F';
  const HBM = { fill: '#9BCB8F', stroke: '#3E7B34' };
  const SR = { fill: '#FFB570', stroke: '#D97900' };
  t.add({ shape: 'dlm-memhier', spec: 'bw', label: 'Memory Hierarchy with\nBandwidth & Memory Size', bold: true, fontSize: 11, labelPos: 'below', x: 0, y: 100, w: 300, h: 130, strokeWidth: 1 });
  // tiling: K^T e V nel ciclo esterno, Q e l'uscita nel ciclo interno
  const cellsH = (x: number, y: number) => t.add({ shape: 'cells', count: 8, x, y, w: 176, h: 22, radius: 0, strokeWidth: 1, ...HBM });
  const cellsV = (x: number, y: number) => t.add({ shape: 'cells', count: 8, x, y, w: 22, h: 160, radius: 0, strokeWidth: 1, ...HBM });
  const blk = (x: number, y: number) => t.box('', x, y, 20, 20, SR, { radius: 0 });
  const loop = (a: [number, number], b: [number, number], color: string, label: string, pos: 'above' | 'below') =>
    t.link(at(t, ...a), at(t, ...b), 'right', 'left', { color, label, labelPos: pos, fontSize: 10, routing: 'straight', width: 1.4 });
  cellsH(420, 40);
  t.text('$\\mathbf{K}^\\top$: $d \\times N$', 340, 41, 76, 20, { fontSize: 11, align: 'right' });
  loop([420, 24], [596, 24], OUTER, 'Outer Loop', 'above');
  const kb = blk(443, 82);
  t.link(at(t, 453, 62), kb, 'bottom', 'top', { color: '#333333' });
  t.text('Copy Block to SRAM', 460, 63, 120, 18, { fontSize: 10, align: 'left' });
  t.group('', 430, 128, 162, 160, { stroke: '#555555', radius: 0 });
  t.text('$\\mathbf{QK}^\\top$: $N \\times N$', 516, 132, 72, 18, { fontSize: 10, align: 'right' });
  loop([490, 116], [592, 116], OUTER, 'Outer Loop', 'above');
  cellsV(376, 128);
  t.text('Q: $N \\times d$', 346, 106, 80, 18, { fontSize: 11 });
  t.link(at(t, 360, 128), at(t, 360, 288), 'bottom', 'top', { color: INNER, label: 'Inner\nLoop', labelPos: 'above', fontSize: 10, routing: 'straight', width: 1.4 });
  const qb = blk(406, 208);
  t.link(at(t, 398, 218), qb, 'right', 'left', { color: '#333333' });
  t.text('Copy', 398, 230, 36, 14, { fontSize: 9, textColor: SR.stroke, bold: true });
  const cb = blk(443, 208);
  t.text('Compute Block\non SRAM', 468, 202, 90, 32, { fontSize: 10, align: 'left', textColor: '#7A4A7A' });
  cellsV(640, 128);
  t.text('V: $N \\times d$', 612, 106, 80, 18, { fontSize: 11 });
  t.link(at(t, 678, 128), at(t, 678, 288), 'bottom', 'top', { color: OUTER, label: 'Outer\nLoop', labelPos: 'below', fontSize: 10, routing: 'straight', width: 1.4 });
  const vb = blk(606, 150);
  t.link(at(t, 640, 160), vb, 'left', 'right', { color: '#333333' });
  t.text('Copy', 598, 172, 36, 14, { fontSize: 9, textColor: SR.stroke, bold: true });
  const dash = { dashed: true, color: COPY, width: 1.2 };
  t.link(qb, cb, 'right', 'left', dash);
  t.link(kb, at(t, 449, 208), 'bottom', 'top', dash);
  t.link(vb, at(t, 458, 208), 'left', 'top', dash);
  cellsH(420, 318);
  t.text('$\\mathrm{sm}(\\mathbf{QK}^\\top)\\mathbf{V}$: $N \\times d$', 280, 318, 136, 20, { fontSize: 11, align: 'right' });
  t.link(cb, at(t, 453, 318), 'bottom', 'top', { color: '#333333', label: 'Output to HBM', labelPos: 'below', fontSize: 10 });
  loop([420, 354], [596, 354], INNER, 'Inner Loop', 'below');
  t.text('FlashAttention', 448, 384, 120, 20, { bold: true, fontSize: 13 });
  // tempi dell'attention su GPT-2: PyTorch vs kernel fuso
  t.link(at(t, 712, 10), at(t, 712, 400), 'bottom', 'top', { ...free, color: '#9AA0A6' });
  t.text('Attention on GPT-2', 760, 34, 170, 20, { bold: true, fontSize: 12 });
  const y0 = 316, sc = 10.5;
  const Y = (v: number) => y0 - v * sc;
  const ax = 784;
  t.link(at(t, ax, y0), at(t, ax, Y(17.6)), 'top', 'bottom', { ...free, color: '#333333', width: 1 });
  t.link(at(t, ax, y0), at(t, 952, y0), 'right', 'left', { ...free, color: '#333333', width: 1 });
  for (const v of [0, 5, 10, 15]) {
    t.link(at(t, ax - 5, Y(v)), at(t, ax, Y(v)), 'right', 'left', { ...free, color: '#333333', width: 1 });
    t.text(String(v), ax - 30, Y(v) - 8, 22, 16, { fontSize: 10, align: 'right' });
  }
  t.text('Time (ms)', ax - 44, Y(17.6) - 26, 70, 18, { fontSize: 10 });
  const segs: [number, number, string][] = [[0, 2.2, 'Matmul'], [2.2, 6.6, 'Mask'], [6.6, 10.3, 'Softmax'], [10.3, 15, 'Dropout'], [15, 16.8, 'Matmul']];
  for (const [a, b, name] of segs) {
    t.box('', 800, Y(b), 44, (b - a) * sc, BLUE, { radius: 0, strokeWidth: 1 });
    t.text(name, 850, (Y(a) + Y(b)) / 2 - 8, 56, 16, { fontSize: 9, align: 'left' });
  }
  t.box('', 900, Y(2.2), 44, 2.2 * sc, BLUE, { radius: 0, strokeWidth: 1 });
  t.text('Fused\nKernel', 892, Y(2.2) - 34, 60, 30, { fontSize: 9 });
  t.text('PyTorch', 792, y0 + 4, 60, 16, { fontSize: 10 });
  t.text('FlashAttention', 882, y0 + 4, 80, 16, { fontSize: 10 });
  return t.done();
}

/** Su et al. 2021 (RoFormer, arXiv 2104.09864), Fig. 1: implementazione di RoPE (rotazione delle coppie di m·θi). */
function rope() {
  const t = new Builder();
  const grey = '#8A929C';
  // dettaglio per d = 2
  t.group('', 0, 0, 690, 150, { stroke: '#9E9E9E', strokeWidth: 1.6, radius: 2 });
  t.text('$d = 2$', 6, 128, 40, 18, { fontSize: 11, textColor: '#6B6B6B', align: 'left' });
  const th = t.text('$\\theta_1$', 92, 4, 40, 20, { fontSize: 15, bold: true, textColor: '#6E957F' });
  t.text('Constant', 82, 22, 60, 14, { fontSize: 9, textColor: grey });
  t.add({ shape: 'dlm-ropevec', spec: 'pair', count: 0, x: 90, y: 44, w: 44, h: 20, strokeWidth: 1 });
  t.text('$(x_1, x_2)$', 77, 66, 70, 16, { fontSize: 10 });
  t.text('Query / Key', 72, 82, 80, 14, { fontSize: 9, textColor: grey });
  const m = t.text('$m$', 97, 100, 30, 20, { fontSize: 15, bold: true, textColor: ROPE_POS[0] });
  t.text('Position', 82, 118, 60, 14, { fontSize: 9, textColor: grey });
  t.link(at(t, 168, 62), at(t, 220, 62), 'right', 'left', { color: '#9E9E9E', width: 2.6, routing: 'straight' });
  t.add({ shape: 'dlm-rotation', x: 236, y: 8, w: 210, h: 136, fill: 'none', stroke: '#8FB09C', strokeWidth: 1 });
  t.link(at(t, 462, 62), at(t, 514, 62), 'right', 'left', { color: '#9E9E9E', width: 2.6, routing: 'straight' });
  t.add({ shape: 'dlm-ropevec', spec: 'pair', count: 1, x: 556, y: 44, w: 44, h: 20, strokeWidth: 1 });
  t.text("$(x'_1, x'_2)$", 543, 66, 70, 16, { fontSize: 10 });
  const encLabel = t.text('Position Encoded Query / Key', 503, 82, 150, 14, { fontSize: 9, textColor: grey });
  // tutte le coppie della sequenza
  t.group('', 0, 170, 690, 236, { stroke: '#333333', strokeWidth: 1.6, dashed: false, radius: 2 });
  const words = ['Enhanced', 'Transformer', 'with', 'Rotary', 'Position', 'Embedding'];
  let pos1 = th;
  let enc1 = th;
  words.forEach((w, i) => {
    const y = 204 + i * 28;
    t.text(w, 4, y + 2, 84, 16, { fontSize: 10, align: 'right' });
    t.add({ shape: 'dlm-ropevec', spec: i === 0 ? 'hl' : '', count: 0, x: 96, y, w: 176, h: 20, strokeWidth: 1 });
    const p = i === 0
      ? t.box('1', 318, y, 22, 20, { fill: '#FFFFFF', stroke: '#9E9E9E' }, { textColor: ROPE_POS[0], bold: true, fontSize: 11, radius: 2, strokeWidth: 1.4 })
      : t.text(String(i + 1), 318, y + 2, 22, 16, { fontSize: 11, bold: true, textColor: ROPE_POS[i] });
    const e = t.add({ shape: 'dlm-ropevec', spec: i === 0 ? 'hl' : '', count: i + 1, x: 470, y, w: 176, h: 20, strokeWidth: 1 });
    if (i === 0) [pos1, enc1] = [p, e];
  });
  const TH = ['$\\theta_1$', '$\\theta_2$', '$\\theta_{d/2-1}$', '$\\theta_{d/2}$'];
  const THC = ['#6E957F', '#C0605F', '#C98A4F', '#4F7BBE'];
  ropePairX(96, 176).forEach((cx, i) => t.text(TH[i], cx - 22, 180, 44, 16, { fontSize: 9, bold: true, textColor: THC[i] }));
  t.link(at(t, 384, 274), at(t, 436, 274), 'right', 'left', { color: '#1A1A1A', width: 2.6, routing: 'straight' });
  t.text('Query / Key', 124, 380, 120, 18, { fontSize: 11, textColor: grey });
  t.text('Position', 299, 380, 60, 18, { fontSize: 11, textColor: grey });
  t.text('Position Encoded Query / Key', 478, 380, 160, 18, { fontSize: 11, textColor: grey });
  const curve = { routing: 'curve' as const, color: '#9E9E9E', width: 1.4 };
  t.link(at(t, 114, 200), th, 'top', 'left', curve);
  t.link(pos1, m, 'top', 'right', curve);
  t.link(encLabel, enc1, 'bottom', 'top', curve);
  return t.done();
}

/** Jaegle et al. 2021 (Perceiver, arXiv 2103.03206), Fig. 1: cross-attention dal byte array al latent array, ripetuta. */
function perceiver() {
  const t = new Builder();
  const BL = '#2F55D4';
  const LAT = { fill: '#EDEDED', stroke: '#555555' }, BYTE = { fill: '#BBD9A8', stroke: '#1E4D12' };
  const SMALL = { fill: '#FFFFFF', stroke: BL };
  const latent = (x: number) => t.add({ shape: 'dlm-array', count: 3, x, y: 60, w: 18, h: 54, strokeWidth: 1, ...LAT });
  const small = (s: string, x: number, y: number) => t.box(s, x, y, 24, 22, SMALL, { fontSize: 12, textColor: BL, radius: 4 });
  t.text('Latent array\n$(N \\times D)$', -14, 66, 84, 40, { fontSize: 12, textColor: BL });
  t.text('Byte array\n$(M \\times C)$', -14, 222, 84, 40, { fontSize: 12, textColor: BL });
  const repeat = (x0: number) => {
    const l0 = latent(x0);
    const q = small('Q', x0 + 46, 122);
    const ca = t.box('Cross\nAttention', x0 + 96, 30, 66, 114, ORANGE, { fontSize: 12 });
    const b = t.add({ shape: 'dlm-array', count: 5, x: x0, y: 196, w: 18, h: 90, strokeWidth: 1, ...BYTE });
    const k = small('K', x0 + 96, 166), v = small('V', x0 + 136, 166);
    const l1 = latent(x0 + 196);
    const lt = t.box('Latent\nTransformer', x0 + 246, 30, 80, 114, BLUE, { fontSize: 12 });
    t.link(l0, at(t, x0 + 96, 87), 'right', 'left');
    t.link(at(t, x0 + 30, 87), q, 'bottom', 'left');
    t.link(q, at(t, x0 + 96, 133), 'right', 'left');
    t.link(b, k, 'right', 'bottom');
    t.link(b, v, 'right', 'bottom');
    t.link(k, at(t, x0 + 108, 144), 'top', 'bottom');
    t.link(v, at(t, x0 + 148, 144), 'top', 'bottom');
    t.chain([ca, l1, lt]);
    return { l0, ca, lt };
  };
  const r1 = repeat(80), r2 = repeat(446);
  t.link(r1.lt, r2.l0);
  const dots = t.text('$\\cdots$', 800, 76, 30, 22, { fontSize: 14 });
  const lf = latent(850);
  const avg = t.box('Average', 896, 72, 66, 30, SMALL, { fontSize: 11, textColor: BL });
  const logits = t.text('Logits', 980, 76, 50, 22, { fontSize: 13, textColor: BL });
  t.chain([r2.lt, dots, lf, avg, logits]);
  const shared = { dashed: true, arrowEnd: false, color: BL, width: 1.1 };
  t.link(r1.ca, r2.ca, 'top', 'top', { ...shared, offset: -12 });
  t.link(r1.lt, r2.lt, 'top', 'top', shared);
  t.text('Weights optionally shared between repeats', 300, -34, 320, 20, { fontSize: 12, textColor: BL });
  return t.done();
}

/** Liu et al. 2023 (LLaVA, arXiv 2304.08485), Fig. 1: encoder visivo, proiezione W e modello linguistico. */
function llava() {
  const t = new Builder();
  const TOK = { strokeWidth: 1, stroke: '#4F6FA8' };
  t.box('Language Model $f_\\phi$', 150, 64, 440, 38, { fill: '#E6F1DF', stroke: '#A9C99A' }, { align: 'left', fontSize: 13, radius: 8 });
  const hv = t.add({ shape: 'dlm-tokrow', count: 3, x: 220, y: 118, w: 108, h: 24, fill: '#F4F4F4', ...TOK });
  const hq = t.add({ shape: 'dlm-tokrow', count: 3, x: 352, y: 118, w: 108, h: 24, fill: '#CFCFCF', ...TOK });
  t.add({ shape: 'dlm-tokrow', count: 3, x: 470, y: 0, w: 108, h: 24, fill: '#73B05A', ...TOK });
  t.text('Language Response $\\mathbf{X}_{\\mathrm{a}}$', 270, 2, 190, 20, { fontSize: 12, align: 'right' });
  // ogni token d'ingresso contribuisce a ogni token della risposta
  const ins = [...tokCenters(220, 108, 3), ...tokCenters(352, 108, 3)].map((x) => at(t, x, 118));
  const outs = tokCenters(470, 108, 3).map((x) => at(t, x, 24));
  for (const a of ins) for (const b of outs) t.link(a, b, 'top', 'bottom', { ...free, color: '#C4C4C4', width: 0.6 });
  const proj = t.box('Projection $\\mathbf{W}$', 20, 116, 150, 28, ORANGE, { fontSize: 12 });
  const ve = t.box('Vision Encoder', 20, 180, 150, 30, BLUE, { fontSize: 12 });
  t.link(ve, proj, 'top', 'bottom', { label: '$\\mathbf{Z}_{\\mathrm{v}}$', labelPos: 'below', fontSize: 13 });
  t.link(proj, hv, 'right', 'left');
  t.text('$\\mathbf{H}_{\\mathrm{v}}$', 259, 148, 30, 20, { fontSize: 13 });
  const img = t.icon('image', '$\\mathbf{X}_{\\mathrm{v}}$  Image', 60, 240, 70, 54, BLUE, { radius: 3, fontSize: 12 });
  t.link(img, ve, 'top', 'bottom');
  const xq = t.text('$\\mathbf{X}_{\\mathrm{q}}$  Language Instruction', 321, 206, 170, 20, { fontSize: 12 });
  t.link(xq, hq, 'top', 'bottom');
  t.text('$\\mathbf{H}_{\\mathrm{q}}$', 412, 152, 30, 20, { fontSize: 13, align: 'left' });
  return t.done();
}

// ======================================================================
// Sequenze e paradigmi di apprendimento
// ======================================================================

/** van den Oord et al. 2016 (WaveNet, arXiv 1609.03499), Fig. 3 (convoluzioni causali dilatate) e Fig. 4 (blocco residuo gated). */
function wavenet() {
  const t = new Builder();
  t.add({ shape: 'dlm-dilated', spec: 'dilated labels', count: 4, x: 0, y: 0, w: 660, h: 240, strokeWidth: 1, label: 'Stack of dilated causal convolutional layers', labelPos: 'below', fontSize: 12, ...WHITE });
  const Y = 400;
  const inp = t.text('Input', 0, Y - 10, 50, 20);
  const cc = t.box('Causal\nConv', 60, Y - 20, 70, 40, BLUE, { fontSize: 11 });
  t.group('Residual block  ($\\times k$ layers)', 160, Y - 92, 370, 162, { stroke: '#777777' });
  const dc = t.box('Dilated\nConv', 180, Y - 20, 70, 40, ORANGE, { fontSize: 11 });
  const th = t.box('tanh', 284, Y - 58, 48, 26, RED, { fontSize: 11 });
  const sg = t.box('$\\sigma$', 284, Y + 32, 48, 26, GREEN, { fontSize: 13 });
  const mul = t.op('$\\times$', 356, Y - 13);
  const c1 = t.box('$1 \\times 1$', 404, Y - 15, 46, 30, BLUE, { fontSize: 11 });
  const add = t.op('+', 478, Y - 13);
  t.chain([inp, cc, dc]);
  t.link(dc, th, 'right', 'left');
  t.link(dc, sg, 'right', 'left');
  t.link(th, mul, 'right', 'top');
  t.link(sg, mul, 'right', 'bottom');
  t.chain([mul, c1, add]);
  t.link(at(t, 165, Y), add, 'top', 'top', { offset: -36 });
  const nxt = t.text('to next\nlayer', 560, Y - 16, 50, 32, { fontSize: 10, textColor: '#555555' });
  t.link(add, nxt);
  // connessioni skip, poi ReLU → 1×1 → ReLU → 1×1 → Softmax
  const SY = Y + 112;
  const sum = t.op('+', 580, SY - 13);
  t.link(c1, sum, 'bottom', 'left', { label: 'Skip-connections', labelPos: 'below' });
  const r1 = t.box('ReLU', 628, SY - 14, 48, 28, TEAL, { fontSize: 11 });
  const k1 = t.box('$1 \\times 1$', 696, SY - 14, 46, 28, BLUE, { fontSize: 11 });
  const r2 = t.box('ReLU', 762, SY - 14, 48, 28, TEAL, { fontSize: 11 });
  const k2 = t.box('$1 \\times 1$', 830, SY - 14, 46, 28, BLUE, { fontSize: 11 });
  const so = t.box('Softmax', 896, SY - 14, 64, 28, PURPLE, { fontSize: 11 });
  const out = t.text('Output', 980, SY - 10, 50, 20);
  t.chain([sum, r1, k1, r2, k2, so, out]);
  t.text('$\\mathbf{z} = \\tanh(W_{f,k} * \\mathbf{x}) \\odot \\sigma(W_{g,k} * \\mathbf{x})$', 160, SY + 30, 370, 24, { fontSize: 13 });
  return t.done();
}

/** Finn et al. 2017 (MAML, arXiv 1703.03400), Fig. 1: meta-apprendimento di θ, adattamento rapido θ*_i. */
function maml() {
  const t = new Builder();
  t.add({ shape: 'dlm-maml', spec: 'legend', x: 0, y: 0, w: 330, h: 198, fill: 'none', stroke: '#333333' });
  t.text('Inner loop: adaptation to task $\\mathcal{T}_i$', 370, 24, 320, 18, { ...NOTE, bold: true, textColor: '#333333' });
  t.text("$\\theta'_i = \\theta - \\alpha \\nabla_\\theta \\mathcal{L}_{\\mathcal{T}_i}(f_\\theta)$", 370, 48, 320, 26, { fontSize: 14, align: 'left' });
  t.text('Outer loop: meta-update over tasks', 370, 100, 320, 18, { ...NOTE, bold: true, textColor: '#333333' });
  t.text("$\\theta \\leftarrow \\theta - \\beta \\nabla_\\theta \\sum_{\\mathcal{T}_i \\sim p(\\mathcal{T})} \\mathcal{L}_{\\mathcal{T}_i}(f_{\\theta'_i})$", 370, 122, 340, 44, { fontSize: 14, align: 'left' });
  return t.done();
}

/** Ganin et al. 2016 (DANN, arXiv 1505.07818), Fig. 1: feature extractor, label predictor e domain classifier con gradient reversal. */
function dann() {
  const t = new Builder();
  const FE = { fill: '#B7DE94', stroke: '#5B8C2A' }, LP = { fill: '#B3C3E8', stroke: '#5B6FB5' }, DC = { fill: '#F7B3D2', stroke: '#D0367F' };
  const cub = (x: number, y: number, w: number, h: number, c: Color, depth = 0.55, extra = {}) => t.add({ shape: 'cuboid', x, y, w, h, depth, strokeWidth: 1, ...c, ...extra });
  const go = (x: number, y: number, c: Color) => t.add({ shape: 'blockarrow', x, y, w: 26, h: 22, strokeWidth: 1, ...c });
  const input = cub(0, 66, 34, 112, { fill: '#8A8A8A', stroke: '#4A4A4A' }, 0.5, { label: 'input $x$', labelPos: 'below', fontSize: 12 });
  go(44, 111, FE);
  cub(80, 70, 56, 104, FE, 0.6);
  go(146, 111, FE);
  cub(182, 76, 50, 92, FE, 0.55);
  go(242, 111, FE);
  cub(278, 92, 46, 60, FE, 0.5);
  go(334, 111, FE);
  const f = cub(370, 72, 22, 100, FE, 0.45, { label: 'features $\\mathbf{f}$', labelPos: 'above', fontSize: 12, textColor: '#3E6B1A' });
  go(402, 111, LP);
  cub(438, 86, 22, 80, LP, 0.5);
  go(470, 111, LP);
  cub(506, 86, 22, 80, LP, 0.5);
  go(538, 111, LP);
  t.add({ shape: 'cells', x: 576, y: 100, w: 14, h: 46, count: 5, radius: 1, strokeWidth: 1, ...LP });
  t.text('class label $y$', 598, 113, 100, 20, { fontSize: 12, align: 'left', textColor: LP.stroke });
  const brace = (x: number, y: number, w: number, dir: 'top' | 'bottom', c: string) => t.add({ shape: 'brace', direction: dir, x, y, w, h: 12, fill: 'none', stroke: c, strokeWidth: 1.2 });
  brace(44, 186, 300, 'bottom', FE.stroke);
  t.text('feature extractor $G_f(\\cdot; \\theta_f)$', 44, 202, 300, 20, { fontSize: 12, textColor: '#3E6B1A' });
  brace(402, 174, 190, 'bottom', LP.stroke);
  t.text('label predictor $G_y(\\cdot; \\theta_y)$', 402, 190, 190, 20, { fontSize: 12, textColor: LP.stroke });
  // ramo del dominio
  const grl = t.box('gradient\nreversal layer', 396, 265, 104, 42, WHITE, { fontSize: 11 });
  const d1 = cub(532, 246, 22, 80, DC, 0.5);
  go(564, 274, DC);
  cub(600, 246, 22, 80, DC, 0.5);
  go(632, 274, DC);
  cub(670, 278, 16, 16, DC, 0.4);
  t.text('domain label $d$', 692, 276, 110, 20, { fontSize: 12, align: 'left', textColor: DC.stroke });
  brace(532, 232, 160, 'top', DC.stroke);
  t.text('domain classifier $G_d(\\cdot; \\theta_d)$', 512, 210, 200, 20, { fontSize: 12, textColor: DC.stroke });
  t.link(f, grl, 'bottom', 'top');
  t.link(grl, d1, 'right', 'left');
  // perdite e gradienti (backprop)
  const ly = t.add({ shape: 'ellipse', label: 'loss $L_y$', x: 640, y: 18, w: 90, h: 32, fontSize: 12, strokeWidth: 1.2, fill: '#FFFFFF', stroke: LP.stroke, textColor: LP.stroke });
  const ld = t.add({ shape: 'ellipse', label: 'loss $L_d$', x: 720, y: 334, w: 90, h: 32, fontSize: 12, strokeWidth: 1.2, fill: '#FFFFFF', stroke: DC.stroke, textColor: DC.stroke });
  const back = (c: string, label: string) => ({ routing: 'curve' as const, color: c, width: 2.2, label, labelPos: 'center' as const, fontSize: 13 });
  t.link(ly, at(t, 404, 40), 'left', 'right', back(LP.stroke, '$\\frac{\\partial L_y}{\\partial \\theta_y}$'));
  t.link(at(t, 372, 40), input, 'left', 'top', back(FE.stroke, '$\\frac{\\partial L_y}{\\partial \\theta_f}$'));
  t.link(grl, at(t, 70, 252), 'left', 'right', back(FE.stroke, '$-\\lambda \\frac{\\partial L_d}{\\partial \\theta_f}$'));
  t.link(ld, grl, 'left', 'bottom', back(DC.stroke, '$\\lambda \\frac{\\partial L_d}{\\partial \\theta_d}$'));
  return t.done();
}

/** Sohn et al. 2020 (FixMatch, arXiv 2001.07685), Fig. 1: pseudo-etichetta dalla vista debole, consistenza sulla vista forte. */
function fixmatch() {
  const t = new Builder();
  const IMG = { radius: 2, strokeWidth: 1, fill: '#FFFFFF', stroke: '#C9CED6', labelPos: 'above' as const, fontSize: 11 };
  const src = t.add({ shape: 'dl-augimg', label: 'Unlabeled\nexample', x: 0, y: 112, w: 76, h: 76, ...IMG });
  const weak = t.add({ shape: 'dl-augimg', label: 'Weakly-\naugmented', spec: 'flip', x: 140, y: 30, w: 76, h: 76, ...IMG });
  const strong = t.add({ shape: 'dl-augimg', label: 'Strongly-\naugmented', spec: 'crop color noise cutout', count: 3, x: 140, y: 196, w: 76, h: 76, ...IMG });
  const model = (y: number) => t.box('Model', 256, y, 90, 38, GREEN, { fontSize: 13, radius: 10 });
  const probs = (label: string, spec: string, x: number, y: number, c: Color) =>
    t.add({ shape: 'dlm-probs', label, spec, count: 6, x, y, w: 92, h: 54, radius: 8, strokeWidth: 1.2, labelPos: 'above', fontSize: 11, ...c });
  const m1 = model(49), m2 = model(215);
  const p1 = probs('Prediction', 'thresh', 386, 41, RED);
  const pl = probs('Pseudo-label', 'onehot', 518, 41, YELLOW);
  const p2 = probs('Prediction', 'alt', 386, 207, BLUE);
  const H = t.box('$\\mathrm{H}(p, q)$', 518, 210, 92, 48, GRAY, { fontSize: 16, radius: 8 });
  t.link(src, weak, 'right', 'left', { routing: 'curve' });
  t.link(src, strong, 'right', 'left', { routing: 'curve' });
  t.chain([weak, m1, p1, pl]);
  t.chain([strong, m2, p2, H]);
  t.link(pl, H, 'bottom', 'top');
  t.text('$\\mathcal{L}_u = \\frac{1}{\\mu B} \\sum_{b=1}^{\\mu B} \\mathrm{1}\\{\\max(q_b) \\geq \\tau\\} \\; \\mathrm{H}(\\hat{q}_b, p_m(y \\mid \\mathcal{A}(u_b)))$', 0, 300, 620, 44, { fontSize: 13 });
  return t.done();
}

/** McMahan et al. 2017 (FedAvg, arXiv 1602.05629): round di federated averaging fra server e client. */
function fedavg() {
  const t = new Builder();
  const DOWN = '#2F6FB2', UP = '#D97900';
  t.group('Server', 214, -24, 340, 116, { dashed: false, stroke: '#6C8EBF', fill: '#F3F7FD', bold: true });
  t.add({ shape: 'dlm-device', spec: 'server', label: 'global model $w_t$', x: 236, y: 6, w: 50, h: 56, strokeWidth: 1.2, ...ICON, fontSize: 10, ...BLUE });
  t.box('Aggregation', 316, 6, 220, 70, YELLOW, { bold: true, fontSize: 11, sublabel: '$w_{t+1} = \\sum_{k=1}^{K} \\frac{n_k}{n} w_{t+1}^k$', subSize: 13 });
  const clients: [number, string, number, number, string][] = [
    [80, 'phone', 40, 64, 'Client 1'],
    [250, 'laptop', 80, 56, 'Client 2'],
    [420, 'hospital', 64, 60, 'Client 3'],
    [660, 'phone', 40, 64, 'Client $K$'],
  ];
  const bottom = 324;
  clients.forEach(([cx, spec, w, h, name], i) => {
    const k = i === 3 ? 'K' : String(i + 1);
    const dev = t.add({ shape: 'dlm-device', spec, label: name, sublabel: `local data $\\mathcal{D}_${k}$`, subSize: 10, x: cx - w / 2, y: bottom - h, w, h, strokeWidth: 1.2, ...ICON, ...GRAY });
    const sx = 384 + (cx - 370) * 0.32;
    const first = i === 0;
    t.link(at(t, sx - 7, 92), at(t, cx - 8, dev.y - 4), 'bottom', 'top', { routing: 'straight', color: DOWN, width: 1.4, ...(first ? { label: '$w_t$', labelPos: 'center' as const, fontSize: 12 } : {}) });
    t.link(at(t, cx + 8, dev.y - 4), at(t, sx + 7, 92), 'top', 'bottom', { routing: 'straight', color: UP, width: 1.4, dashed: true, ...(i === 3 ? { label: '$w_{t+1}^K$', labelPos: 'center' as const, fontSize: 12 } : {}) });
  });
  t.text('$\\cdots$', 530, 290, 40, 24, { fontSize: 18 });
  const steps = [
    '1. The server sends the global model $w_t$ to a subset of $K$ clients',
    '2. Each client runs $E$ epochs of SGD on its private data: $w \\leftarrow w - \\eta \\nabla \\ell(w; b)$',
    '3. Clients send back their updated weights (the data never leave the device): $w_{t+1}^k$',
    '4. The server averages them, weighted by the local dataset sizes $n_k$',
  ];
  steps.forEach((s, i) => t.text(s, 0, 392 + i * 22, 700, 18, { ...NOTE, textColor: i === 0 ? DOWN : i === 2 ? UP : '#444444' }));
  return t.done();
}

/** Kirkpatrick et al. 2017 (EWC, arXiv 1612.00796), Fig. 1: traiettorie nello spazio dei parametri per il task B. */
function ewc() {
  const t = new Builder();
  t.add({ shape: 'dlm-ewc', x: 0, y: 56, w: 360, h: 158, fill: 'none', stroke: '#333333' });
  const swatch = (y: number, fill: string, label: string) => {
    t.add({ x: 40, y: y - 6, w: 22, h: 12, radius: 0, fill, stroke: '#555555', strokeWidth: 0.8 });
    t.text(label, 68, y - 9, 150, 18, { fontSize: 11, align: 'left' });
  };
  swatch(6, EWC_COLORS.B, 'Low error for task B');
  swatch(28, EWC_COLORS.A, 'Low error for task A');
  const leg: [string, string][] = [[EWC_COLORS.ewc, 'EWC'], [EWC_COLORS.l2, '$L_2$'], [EWC_COLORS.none, 'no penalty']];
  leg.forEach(([c, label], i) => {
    const y = 6 + i * 20;
    t.link(at(t, 226, y), at(t, 248, y), 'right', 'left', { ...free, color: c, width: 2.6 });
    t.text(label, 254, y - 9, 90, 18, { fontSize: 11, align: 'left' });
  });
  t.text('$\\mathcal{L}(\\theta) = \\mathcal{L}_B(\\theta) + \\sum_i \\frac{\\lambda}{2} F_i (\\theta_i - \\theta^*_{A,i})^2$', 0, 226, 360, 40, { fontSize: 14 });
  return t.done();
}

/** Zoph & Le 2017 (NAS, arXiv 1611.01578), Fig. 1 (ciclo controller–rete figlia) e Fig. 2 (controller RNN che campiona gli iperparametri). */
function nas() {
  const t = new Builder();
  const CTRL = { fill: '#F8CDD8', stroke: '#B85470' }, CHILD = { fill: '#C9E4F0', stroke: '#3F7FA0' };
  const ctrl = t.box('The controller (RNN)', 60, 50, 170, 70, CTRL, { fontSize: 12 });
  const child = t.box('Trains a child network\nwith architecture $A$ to\nget accuracy $R$', 400, 50, 200, 70, CHILD, { fontSize: 11 });
  t.link(ctrl, child, 'top', 'top', { label: 'Sample architecture $A$\nwith probability $p$', labelPos: 'above', fontSize: 11 });
  t.link(child, ctrl, 'bottom', 'bottom', { label: 'Compute gradient of $p$ and\nscale it by $R$ to update\nthe controller', labelPos: 'below', fontSize: 11 });
  // controller srotolato: ogni passo sceglie un iperparametro e lo passa al successivo
  const outs = ['Stride\nWidth', 'Number\nof Filters', 'Filter\nHeight', 'Filter\nWidth', 'Stride\nHeight', 'Stride\nWidth', 'Number\nof Filters'];
  const X0 = 20, STEP = 96, CY = 380;
  const cells = outs.map((_, i) => t.box('', X0 + i * STEP, CY, 56, 30, i === 0 || i === 6 ? { fill: '#F5F5F5', stroke: '#B0B0B0' } : CTRL));
  const preds = outs.map((s, i) => t.box(s, X0 + i * STEP - 12, CY - 92, 80, 38, i === 0 || i === 6 ? { fill: '#FFFFFF', stroke: '#B0B0B0' } : WHITE, { fontSize: 10, radius: 4, textColor: i === 0 || i === 6 ? '#8A8A8A' : '#1A1A1A' }));
  cells.forEach((c, i) => {
    t.link(c, preds[i], 'top', 'bottom');
    if (i > 0) t.link(cells[i - 1], c);
    if (i < cells.length - 1) t.link(at(t, preds[i].x + 72, CY - 54), at(t, cells[i + 1].x + 8, CY), 'bottom', 'top', { routing: 'straight', dashed: true, color: '#9AA0A6', width: 1 });
  });
  t.text('each step samples one hyperparameter from a softmax and feeds it to the next step', X0 - 12, CY - 126, 600, 18, { ...NOTE, textColor: '#555555' });
  const brace = (i0: number, i1: number, label: string) => {
    const x = X0 + i0 * STEP - 6, w = (i1 - i0) * STEP + 68;
    t.add({ shape: 'brace', direction: 'bottom', x, y: CY + 40, w, h: 12, fill: 'none', stroke: '#555555', strokeWidth: 1.2 });
    t.text(label, x, CY + 56, w, 18, { fontSize: 11 });
  };
  brace(0, 0, 'Layer $N-1$');
  brace(1, 5, 'Layer $N$');
  brace(6, 6, 'Layer $N+1$');
  return t.done();
}

// ======================================================================
// Graph learning
// ======================================================================

/** Veličković et al. 2018 (GAT, arXiv 1710.10903), Fig. 1: meccanismo a(Wh_i, Wh_j) e attention multi-testa (K = 3) sul vicinato. */
function gat() {
  const t = new Builder();
  t.add({ shape: 'dlm-gatmech', x: 0, y: 0, w: 210, h: 250, strokeWidth: 1.2, ...WHITE });
  t.add({ shape: 'dlm-gatstar', count: 3, x: 270, y: 10, w: 400, h: 240, strokeWidth: 1.2, ...WHITE });
  t.text('$\\alpha_{ij} = \\mathrm{softmax}_j(\\mathrm{LeakyReLU}(\\mathbf{a}^\\top [\\mathbf{W}\\vec{h}_i \\| \\mathbf{W}\\vec{h}_j]))$', 0, 284, 670, 24, { fontSize: 13 });
  t.text("$\\vec{h}'_i = \\|_{k=1}^{K} \\sigma(\\sum_{j \\in N_i} \\alpha_{ij}^k \\mathbf{W}^k \\vec{h}_j)$", 0, 318, 670, 44, { fontSize: 13 });
  return t.done();
}

/** Hamilton et al. 2017 (GraphSAGE, arXiv 1706.02216), Fig. 1: campionamento, aggregazione e predizione. */
function graphsage() {
  const t = new Builder();
  const S = 250, GAP = 50;
  const caps = ['1. Sample neighborhood', '2. Aggregate feature information\nfrom neighbors', '3. Predict graph context and label\nusing aggregated information'];
  ['sample', 'aggregate', 'predict'].forEach((spec, i) =>
    t.add({ shape: 'dlm-sage', spec, x: i * (S + GAP), y: 0, w: S, h: S, fill: 'none', stroke: '#333333', label: caps[i], labelPos: 'below', fontSize: 13 }),
  );
  const agg = (label: string, y: number, c: Color) => t.add({ shape: 'blockarrow', label, x: S + GAP + 172, y, w: 124, h: 30, fontSize: 12, bold: true, strokeWidth: 1, ...c });
  agg('aggregator$_1$', -30, { fill: '#A9C4F5', stroke: '#3B6FD8' });
  agg('aggregator$_2$', 6, { fill: '#B5D3A0', stroke: '#4E7F35' });
  const ox = 2 * (S + GAP), cx = ox + S / 2, cy = S / 2;
  const ctxBox = t.box('', 880, 0, 84, 74, WHITE, { radius: 0, strokeWidth: 2 });
  t.add({ shape: 'graph', x: 890, y: 8, w: 64, h: 58, strokeWidth: 1, fill: '#FFFFFF', stroke: '#1A1A1A' });
  const label = t.box('label', 880, 150, 84, 38, WHITE, { bold: true, fontSize: 15, radius: 0, strokeWidth: 2 });
  const r = S * 0.032;
  t.link(at(t, cx + r + 1, cy - 4), ctxBox, 'right', 'left', { routing: 'straight', color: '#1A1A1A', width: 1.6 });
  t.link(at(t, cx + r + 1, cy + 4), label, 'right', 'left', { routing: 'straight', color: '#1A1A1A', width: 1.6 });
  return t.done();
}

/** Gilmer et al. 2017 (MPNN, arXiv 1704.01212): fasi di messaggio, aggregazione, aggiornamento e readout. */
function messagePassing() {
  const t = new Builder();
  const MSG = '#D97900';
  const node = (label: string, x: number, y: number, c: Color, d = 42) => t.add({ shape: 'ellipse', label, x, y, w: d, h: d, fontSize: 12, strokeWidth: 1.2, ...c });
  const v = node('$h_v^t$', 120, 120, { fill: '#F8CECC', stroke: '#B85450' }, 46);
  const ws = [node('$h_{w_1}^t$', 20, 30, BLUE), node('$h_{w_2}^t$', 0, 180, BLUE), node('$h_{w_3}^t$', 130, 250, BLUE), node('$h_{w_4}^t$', 240, 60, BLUE)];
  const others = [node('', -50, 100, WHITE, 28), node('', 250, 200, WHITE, 28), node('', 70, 330, WHITE, 28)];
  const grey = { arrowEnd: false, routing: 'straight' as const, color: '#9AA0A6', width: 1.2 };
  t.link(ws[0], others[0], 'auto', 'auto', grey);
  t.link(ws[1], others[0], 'auto', 'auto', grey);
  t.link(ws[3], others[1], 'auto', 'auto', grey);
  t.link(ws[2], others[1], 'auto', 'auto', grey);
  t.link(ws[2], others[2], 'auto', 'auto', grey);
  ws.forEach((w, i) => t.link(w, v, 'auto', 'auto', { routing: 'straight', color: MSG, width: 1.8, ...(i === 3 ? { label: '$e_{vw}$', labelPos: 'center' as const, fontSize: 12 } : {}) }));
  t.text('messages $m_{vw}^{t+1}$ flow from the\nneighbors $w \\in N(v)$ into node $v$', -40, 372, 330, 34, { fontSize: 11, textColor: '#555555' });
  const X = 340, W = 250;
  const msg = t.box('Message function', X, 0, W, 54, ORANGE, { bold: true, fontSize: 11, sublabel: '$m_{vw}^{t+1} = M_t(h_v^t, h_w^t, e_{vw})$', subSize: 13 });
  const agg = t.box('Aggregation', X, 90, W, 62, YELLOW, { bold: true, fontSize: 11, sublabel: '$m_v^{t+1} = \\sum_{w \\in N(v)} m_{vw}^{t+1}$', subSize: 13 });
  const upd = t.box('Update function', X, 188, W, 54, BLUE, { bold: true, fontSize: 11, sublabel: '$h_v^{t+1} = U_t(h_v^t, m_v^{t+1})$', subSize: 13 });
  const ro = t.box('Readout', X, 320, W, 54, GREEN, { bold: true, fontSize: 11, sublabel: '$\\hat{y} = R(\\{h_v^T \\mid v \\in G\\})$', subSize: 13 });
  t.chain([msg, agg, upd], 'down');
  t.link(upd, msg, 'right', 'right', { label: '$t = 0, \\ldots, T-1$', labelPos: 'below', fontSize: 12 });
  t.link(upd, ro, 'bottom', 'top', { label: 'after $T$ steps', labelPos: 'below', fontSize: 11 });
  return t.done();
}

// ======================================================================
// Scientific ML
// ======================================================================

/** Raissi et al. 2019 (PINN, arXiv 1711.10561): rete u_θ(t, x), residuo della PDE via autodiff e perdita su dati e fisica. */
function pinn() {
  const t = new Builder();
  const fld = t.add({ shape: 'dlm-field', spec: 'burgers points', count: 36, x: 0, y: 56, w: 150, h: 100, strokeWidth: 1, ...ICON, ...GRAY, label: "Burgers' equation: $u(t, x)$", labelPos: 'above', fontSize: 11 });
  t.text('$\\times$ data (IC / BC)    $\\circ$ collocation points', -10, 162, 170, 18, { fontSize: 10, textColor: '#555555' });
  const xin = t.op('$t$', 196, 66, { w: 32, h: 32, fontSize: 15 });
  const tin = t.op('$x$', 196, 124, { w: 32, h: 32, fontSize: 15 });
  t.link(fld, xin, 'right', 'left');
  t.link(fld, tin, 'right', 'left');
  const nn = t.add({ shape: 'mlp', spec: '4,6,6,4', x: 270, y: 36, w: 160, h: 150, strokeWidth: 1.2, ...ICON, ...GREEN, label: 'neural network $u_\\theta(t, x)$', labelPos: 'above' });
  t.link(xin, at(t, 270, 82), 'right', 'left');
  t.link(tin, at(t, 270, 140), 'right', 'left');
  const uh = t.op('$\\hat{u}$', 468, 93, { w: 36, h: 36, fontSize: 15 });
  t.link(nn, uh);
  const ad = t.box('Automatic\ndifferentiation', 544, 84, 120, 54, PURPLE, { fontSize: 11 });
  const res = t.box('PDE residual', 772, 81, 200, 60, ORANGE, { bold: true, fontSize: 11, sublabel: '$f = \\hat{u}_t + \\hat{u} \\hat{u}_x - \\nu \\hat{u}_{xx}$', subSize: 13 });
  t.link(uh, ad);
  t.link(ad, res, 'right', 'left', { label: '$\\hat{u}_t, \\hat{u}_x, \\hat{u}_{xx}$', labelPos: 'above', fontSize: 12 });
  const dl = t.box('Data loss (IC / BC)', 430, 228, 262, 64, BLUE, { bold: true, fontSize: 11, sublabel: '$\\mathrm{MSE}_u = \\frac{1}{N_u} \\sum_{i} |\\hat{u}(t_u^i, x_u^i) - u^i|^2$', subSize: 13 });
  const pl = t.box('Physics loss', 742, 228, 260, 64, YELLOW, { bold: true, fontSize: 11, sublabel: '$\\mathrm{MSE}_f = \\frac{1}{N_f} \\sum_{j} |f(t_f^j, x_f^j)|^2$', subSize: 13 });
  const loss = t.box('Loss', 606, 346, 220, 56, RED, { bold: true, fontSize: 11, sublabel: '$\\mathcal{L}(\\theta) = \\mathrm{MSE}_u + \\mathrm{MSE}_f$', subSize: 13 });
  t.link(uh, at(t, 486, 228), 'bottom', 'top');
  t.link(res, at(t, 872, 228), 'bottom', 'top');
  t.link(dl, at(t, 650, 346), 'bottom', 'top');
  t.link(pl, at(t, 782, 346), 'bottom', 'top');
  t.link(loss, nn, 'left', 'bottom', { dashed: true, color: '#7A808A', label: 'gradient descent on $\\theta$', labelPos: 'below', fontSize: 11 });
  return t.done();
}

/** Li et al. 2021 (Fourier Neural Operator, arXiv 2010.08895), Fig. 2: (a) architettura, (b) Fourier layer. */
function fno() {
  const t = new Builder();
  const IO = { fill: '#9CC9DF', stroke: '#3F7FA0' }, LIN = { fill: '#F5B36B', stroke: '#B5651D' }, FT = { fill: '#F7D98B', stroke: '#B8932F' }, ACT = { fill: '#EE7A4E', stroke: '#A8431D' };
  const FL = { fill: '#F5F5C0', stroke: '#333333' };
  const circ = (label: string, x: number, y: number, c: Color, fs = 16) => t.add({ shape: 'ellipse', label, x, y, w: 54, h: 54, fontSize: fs, strokeWidth: 1.2, ...c });
  t.text('(a)', -40, -24, 30, 20, { fontSize: 13 });
  const a = circ('$a(x)$', 0, 0, IO);
  const P = circ('$P$', 90, 0, LIN);
  const f1 = t.box('Fourier layer 1', 175, 4, 130, 46, FL, { fontSize: 13, radius: 0 });
  const f2 = t.box('Fourier layer 2', 335, 4, 130, 46, FL, { fontSize: 13, radius: 0 });
  const dots = t.text('$\\cdots$', 490, 15, 50, 24, { fontSize: 18 });
  const fT = t.box('Fourier layer $T$', 565, 4, 130, 46, FL, { fontSize: 13, radius: 0 });
  const Q = circ('$Q$', 725, 0, LIN);
  const u = circ('$u(x)$', 810, 0, IO);
  t.chain([a, P, f1, f2, dots, fT, Q, u]);
  t.text('(b)', -40, 150, 30, 20, { fontSize: 13 });
  t.group('', 40, 146, 830, 200, { dashed: false, stroke: '#333333', fill: '#FFFFFF', radius: 0 });
  t.text('Fourier layer', 700, 158, 150, 22, { fontSize: 15 });
  t.group('', 168, 160, 486, 90, { dashed: false, stroke: '#B8B060', fill: '#F7F7C6', radius: 0 });
  const F = circ('$\\mathcal{F}$', 180, 178, FT);
  t.add({ shape: 'dlm-waves', count: 4, x: 252, y: 170, w: 100, h: 72, fill: 'none', stroke: '#333333', strokeWidth: 1 });
  circ('$R$', 384, 178, LIN);
  t.add({ shape: 'dlm-waves', count: 2, x: 456, y: 182, w: 100, h: 46, fill: 'none', stroke: '#333333', strokeWidth: 1 });
  const Fi = circ('$\\mathcal{F}^{-1}$', 588, 178, FT, 15);
  const v = circ('$v(x)$', 70, 254, IO);
  const W = circ('$W$', 384, 280, LIN);
  const plus = circ('+', 690, 254, ACT, 22);
  const sig = circ('$\\sigma$', 780, 254, ACT, 18);
  t.link(v, F, 'top', 'left');
  t.link(v, W, 'right', 'left', { routing: 'curve' });
  t.link(Fi, plus, 'right', 'top');
  t.link(W, plus, 'right', 'left', { routing: 'curve' });
  t.link(plus, sig);
  const zoom = { ...free, dashed: true, color: '#333333', width: 1 };
  t.link(at(t, 335, 50), at(t, 40, 146), 'bottom', 'top', zoom);
  t.link(at(t, 465, 50), at(t, 870, 146), 'bottom', 'top', zoom);
  t.text('$v_{t+1}(x) = \\sigma(W v_t(x) + \\mathcal{F}^{-1}(R \\cdot \\mathcal{F}(v_t))(x))$', 40, 360, 830, 24, { fontSize: 14 });
  return t.done();
}

/** Chen et al. 2018 (Neural ODE, arXiv 1806.07366), Fig. 1: trasformazioni discrete (ResNet) e campo vettoriale continuo (ODE). */
function neuralOde() {
  const t = new Builder();
  const P = { fill: 'none', stroke: 'none', strokeWidth: 1, radius: 0 };
  t.add({ shape: 'dlm-odeflow', spec: 'resnet', label: 'Residual Network', labelPos: 'above', fontSize: 14, x: 0, y: 0, w: 230, h: 260, ...P });
  t.add({ shape: 'dlm-odeflow', spec: 'ode', label: 'ODE Network', labelPos: 'above', fontSize: 14, x: 260, y: 0, w: 230, h: 260, ...P });
  t.text('$\\mathbf{h}_{t+1} = \\mathbf{h}_t + f(\\mathbf{h}_t, \\theta_t)$', 0, 272, 230, 36, { fontSize: 13 });
  t.text('$\\frac{d\\mathbf{h}(t)}{dt} = f(\\mathbf{h}(t), t, \\theta)$', 260, 272, 230, 36, { fontSize: 13 });
  return t.done();
}

// ======================================================================
// Machine learning bayesiano
// ======================================================================

/** Rasmussen & Williams 2006 (Gaussian Processes for ML), Fig. 2.2: campioni dal prior e dal posterior del GP. */
function gpRegression() {
  const t = new Builder();
  const P = { fill: '#FFFFFF', stroke: 'none', strokeWidth: 1, radius: 0 };
  t.add({ shape: 'mlm-gp', spec: 'prior samples', label: '(a) prior', labelPos: 'below', fontSize: 12, x: 0, y: 0, w: 300, h: 190, ...P });
  t.add({ shape: 'mlm-gp', spec: 'posterior samples', count: 5, label: '(b) posterior', labelPos: 'below', fontSize: 12, x: 330, y: 0, w: 300, h: 190, ...P });
  t.text("$f \\sim \\mathcal{GP}(0, k(x, x'))$,    $k(x, x') = \\sigma_f^2 \\exp(-\\frac{(x - x')^2}{2\\ell^2})$", 0, 238, 630, 36, { fontSize: 13 });
  t.text('$\\bar{f}_* = \\mathbf{k}_*^\\top (K + \\sigma_n^2 I)^{-1} \\mathbf{y}$,    $\\mathbb{V}[f_*] = k(x_*, x_*) - \\mathbf{k}_*^\\top (K + \\sigma_n^2 I)^{-1} \\mathbf{k}_*$', 0, 280, 630, 24, { fontSize: 13 });
  return t.done();
}

/** Brochu, Cora & de Freitas 2010 (arXiv 1012.2599), Fig. 1: tre iterazioni di Bayesian optimization con GP ed expected improvement. */
function bayesOpt() {
  const t = new Builder();
  const P = { fill: '#FFFFFF', stroke: '#C9CED6', strokeWidth: 1, radius: 3 };
  [2, 3, 4].forEach((c, i) => {
    t.add({ shape: 'mlm-gp', spec: 'bo', count: c, x: 60, y: i * 176, w: 380, h: 160, ...P });
    t.text(`$t = ${c}$`, 0, i * 176 + 46, 50, 22, { fontSize: 14 });
  });
  const LX = 476;
  const rows: [string, string][] = [
    ['dot', 'observation ($x$)'],
    ['new', 'new observation'],
    ['dash', 'objective function ($f(\\cdot)$)'],
    ['line', 'posterior mean ($\\mu(\\cdot)$)'],
    ['band', 'posterior uncertainty ($\\mu(\\cdot) \\pm 2\\sigma(\\cdot)$)'],
    ['acq', 'acquisition function ($u(\\cdot)$)'],
    ['tri', 'acquisition max'],
  ];
  rows.forEach(([kind, label], i) => {
    const y = 20 + i * 26;
    if (kind === 'dot' || kind === 'new') t.add({ shape: 'ellipse', x: LX + 11, y: y - 4, w: 8, h: 8, fill: kind === 'dot' ? '#1A1A1A' : GP_COLORS.max, stroke: 'none' });
    if (kind === 'dash' || kind === 'line') t.link(at(t, LX, y), at(t, LX + 30, y), 'right', 'left', { ...free, dashed: kind === 'dash', color: kind === 'dash' ? '#333333' : GP_COLORS.mean, width: kind === 'dash' ? 1 : 1.6 });
    if (kind === 'band') t.add({ x: LX, y: y - 6, w: 30, h: 12, radius: 0, fill: GP_COLORS.band, stroke: 'none' });
    if (kind === 'acq') t.add({ x: LX, y: y - 6, w: 30, h: 12, radius: 0, fill: GP_COLORS.acq, stroke: GP_COLORS.acqLine, strokeWidth: 1 });
    if (kind === 'tri') t.add({ shape: 'triangle', direction: 'bottom', x: LX + 9, y: y - 5, w: 12, h: 10, radius: 0, fill: GP_COLORS.max, stroke: GP_COLORS.max, strokeWidth: 0.5 });
    t.text(label, LX + 40, y - 10, 260, 20, { fontSize: 11, align: 'left' });
  });
  const alg = [
    'for $t = 1, 2, \\ldots$ do',
    '    $x_t = \\arg\\max_x u(x \\mid \\mathcal{D}_{1:t-1})$',
    '    $y_t = f(x_t) + \\epsilon_t$',
    '    $\\mathcal{D}_{1:t} = \\{\\mathcal{D}_{1:t-1}, (x_t, y_t)\\}$, update the GP',
  ];
  t.text('Bayesian optimization loop', LX, 230, 260, 18, { ...NOTE, bold: true, textColor: '#333333' });
  alg.forEach((s, i) => t.text(s, LX + (i ? 16 : 0), 256 + i * 28, 300, 24, { fontSize: 12, align: 'left' }));
  return t.done();
}

/** Settles 2009 (Active Learning Literature Survey), Fig. 1: ciclo di active learning su pool. */
function activeLearning() {
  const t = new Builder();
  const model = t.box('machine learning\nmodel', 230, 0, 150, 56, TEAL, { fontSize: 12, radius: 10 });
  const L = t.add({ shape: 'ml-table', spec: '5x4 y', label: 'labeled training set $\\mathcal{L}$', x: 30, y: 150, w: 100, h: 76, strokeWidth: 1.2, ...ICON, ...BLUE });
  const U = t.add({ shape: 'scatter', label: 'unlabeled pool $\\mathcal{U}$', x: 480, y: 150, w: 100, h: 76, radius: 4, strokeWidth: 1.2, ...ICON, ...GRAY });
  const oracle = t.add({ shape: 'user', label: 'oracle (e.g., human annotator)', x: 285, y: 300, w: 40, h: 46, strokeWidth: 1.2, ...ICON, ...ORANGE });
  const c = { routing: 'curve' as const, width: 1.4, labelPos: 'center' as const, fontSize: 11 };
  t.link(L, model, 'top', 'left', { ...c, label: 'learn a model' });
  t.link(model, U, 'right', 'top', { ...c, label: 'select queries' });
  t.link(U, oracle, 'bottom', 'right', { ...c, label: 'query $x^*$' });
  t.link(oracle, L, 'left', 'bottom', { ...c, label: 'label $y^*$' });
  t.text('uncertainty sampling:   $x^*_{LC} = \\arg\\max_x \\, 1 - P_\\theta(\\hat{y} \\mid x)$', 60, 392, 500, 24, { fontSize: 13 });
  return t.done();
}

const DL = 'Deep learning', GL = 'Graph learning', SCI = 'Scientific ML', ML = 'Machine learning';
const T = (id: string, name: string, section: string, build: TemplateDef['build']): TemplateDef => ({ id, name, section, build });

export const MORE_TEMPLATES: TemplateDef[] = [
  T('dlm-llama', 'Blocco Llama (Touvron 2023)', DL, llama),
  T('dlm-gqa', 'MHA / GQA / MQA (Ainslie 2023)', DL, gqa),
  T('dlm-flashattn', 'FlashAttention (Dao 2022)', DL, flashAttention),
  T('dlm-rope', 'RoPE (Su 2021)', DL, rope),
  T('dlm-perceiver', 'Perceiver (Jaegle 2021)', DL, perceiver),
  T('dlm-llava', 'LLaVA (Liu 2023)', DL, llava),
  T('dlm-wavenet', 'WaveNet (van den Oord 2016)', DL, wavenet),
  T('dlm-maml', 'MAML (Finn 2017)', DL, maml),
  T('dlm-dann', 'DANN (Ganin 2016)', DL, dann),
  T('dlm-fixmatch', 'FixMatch (Sohn 2020)', DL, fixmatch),
  T('dlm-fedavg', 'FedAvg (McMahan 2017)', DL, fedavg),
  T('dlm-ewc', 'EWC (Kirkpatrick 2017)', DL, ewc),
  T('dlm-nas', 'NAS (Zoph & Le 2017)', DL, nas),
  T('dlm-gat', 'GAT (Veličković 2018)', GL, gat),
  T('dlm-graphsage', 'GraphSAGE (Hamilton 2017)', GL, graphsage),
  T('dlm-mpnn', 'Message passing (Gilmer 2017)', GL, messagePassing),
  T('dlm-pinn', 'PINN (Raissi 2019)', SCI, pinn),
  T('dlm-fno', 'Fourier Neural Operator (Li 2021)', SCI, fno),
  T('dlm-neuralode', 'Neural ODE (Chen 2018)', SCI, neuralOde),
  T('mlm-gp', 'Regressione GP (Rasmussen 2006)', ML, gpRegression),
  T('mlm-bayesopt', 'Bayesian optimization (Brochu 2010)', ML, bayesOpt),
  T('mlm-active', 'Active learning (Settles 2009)', ML, activeLearning),
];
