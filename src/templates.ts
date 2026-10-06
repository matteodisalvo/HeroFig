// Design noti pronti all'uso, ricalcati sulle figure dei paper originali. Ogni modello
// costruisce un diagramma fatto di normali blocchi e connessioni: dopo l'inserimento
// resta tutto modificabile.
import { Builder, FLAME, FROZEN, UNET_ARROW, type Color } from './builder';
import { COLORS, DEC_STYLE, ENC_STYLE, ICON, type NodeModel, type Side } from './model';
import { registeredTemplates, type TemplateDef } from './registry';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
type N = NodeModel;
type S = Side | 'auto';

// ======================================================================
// Architetture generali
// ======================================================================

/** Vaswani et al. 2017, Fig. 1: stack di encoder e decoder. */
function transformer() {
  const t = new Builder();
  const posEnc = (x: number, y: number) => t.add({ shape: 'posenc', x, y, w: 26, h: 26, strokeWidth: 1.2, ...WHITE });
  // encoder
  const inp = t.text('Inputs', 115, 600, 90, 22);
  const emb = t.box('Input\nEmbedding', 95, 540, 130, 40, RED);
  const add = t.op('+', 147, 492);
  const pe = posEnc(95, 492);
  t.text('Positional\nEncoding', 0, 490, 85, 30, { fontSize: 11 });
  t.group('', 80, 236, 160, 234, { fill: '#F2F2F2', stroke: '#C8C8C8', dashed: false });
  t.text('$N \\times$', 40, 340, 36, 24, { fontSize: 14 });
  const mha = t.box('Multi-Head\nAttention', 95, 402, 130, 44, ORANGE);
  const an1 = t.box('Add & Norm', 95, 365, 130, 24, YELLOW, { fontSize: 11 });
  const ffn = t.box('Feed\nForward', 95, 305, 130, 44, BLUE);
  const an2 = t.box('Add & Norm', 95, 268, 130, 24, YELLOW, { fontSize: 11 });
  t.chain([inp, emb, add, mha, an1, ffn, an2], 'up');
  t.link(pe, add);
  // i residui partono da un punto sulla linea, come nella figura originale
  t.link(t.anchor(159.5, 474), an1, 'left', 'left');
  t.link(t.anchor(159.5, 357), an2, 'left', 'left');
  // decoder
  const out = t.text('Outputs\n(shifted right)', 335, 596, 110, 30);
  const oemb = t.box('Output\nEmbedding', 325, 540, 130, 40, RED);
  const oadd = t.op('+', 377, 492);
  const ope = posEnc(430, 492);
  t.text('Positional\nEncoding', 465, 490, 85, 30, { fontSize: 11 });
  t.group('', 310, 120, 160, 350, { fill: '#F2F2F2', stroke: '#C8C8C8', dashed: false });
  t.text('$N \\times$', 476, 280, 36, 24, { fontSize: 14 });
  const mmha = t.box('Masked\nMulti-Head\nAttention', 325, 400, 130, 52, ORANGE, { fontSize: 11 });
  const dan1 = t.box('Add & Norm', 325, 364, 130, 24, YELLOW, { fontSize: 11 });
  const cmha = t.box('Multi-Head\nAttention', 325, 300, 130, 44, ORANGE);
  const dan2 = t.box('Add & Norm', 325, 263, 130, 24, YELLOW, { fontSize: 11 });
  const dffn = t.box('Feed\nForward', 325, 200, 130, 44, BLUE);
  const dan3 = t.box('Add & Norm', 325, 163, 130, 24, YELLOW, { fontSize: 11 });
  const lin = t.box('Linear', 325, 85, 130, 28, PURPLE);
  const soft = t.box('Softmax', 325, 40, 130, 28, GREEN);
  const prob = t.text('Output\nProbabilities', 340, -8, 100, 30);
  t.chain([out, oemb, oadd, mmha, dan1, cmha, dan2, dffn, dan3, lin, soft, prob], 'up');
  t.link(ope, oadd, 'left', 'right');
  t.link(t.anchor(389.5, 474), dan1, 'right', 'right');
  t.link(t.anchor(389.5, 354), dan2, 'right', 'right');
  t.link(t.anchor(389.5, 253), dan3, 'right', 'right');
  t.link(an2, cmha, 'top', 'left');
  return t.done();
}

/** Dosovitskiy et al. 2020, Fig. 1: patch, embedding, encoder e dettaglio del blocco (pre-norm). */
function vit() {
  const t = new Builder();
  t.text('Vision Transformer (ViT)', 0, -60, 200, 22, { bold: true, fontSize: 13 });
  const cls = t.box('Class\nBird\nBall\nCar\n...', 76, -34, 70, 74, WHITE, { fontSize: 9, radius: 12 });
  const head = t.box('MLP\nHead', 71, 62, 80, 40, ORANGE);
  const enc = t.box('Transformer Encoder', 105, 135, 320, 52, GRAY, { bold: true, fontSize: 13 });
  // token: embedding di posizione (viola, numerato) affiancato all'embedding della patch (rosa)
  for (let i = 0; i < 10; i++) {
    const px = 104 + i * 32;
    t.add({ x: px, y: 222, w: 13, h: 28, radius: 4, label: i === 0 ? '0*' : String(i), fontSize: 8, strokeWidth: 1, ...PURPLE });
    t.add({ x: px + 15, y: 222, w: 13, h: 28, radius: 4, strokeWidth: 1, ...RED });
  }
  t.text('Patch + Position\nEmbedding', 430, 220, 110, 32, { fontSize: 11 });
  t.text('* Extra learnable\n$\\mathrm{[class]}$ embedding', -20, 220, 115, 32, { fontSize: 10, textColor: '#555555' });
  const proj = t.box('Linear Projection of Flattened Patches', 130, 290, 270, 32, RED, { fontSize: 11 });
  const flat = t.add({ shape: 'cells', x: 141, y: 360, w: 248, h: 26, count: 9, radius: 3, strokeWidth: 1.2, ...BLUE });
  const img = t.icon('patches', '', -10, 335, 80, 80, BLUE, { spec: '3x3' });
  const tokTop = t.anchor(265, 221);
  const tokBottom = t.anchor(265, 251);
  t.link(img, flat);
  t.link(flat, proj, 'top', 'bottom');
  t.link(proj, tokBottom, 'top', 'bottom');
  t.link(tokTop, enc, 'top', 'bottom');
  // solo il token [class] prosegue verso la testa
  t.link(t.anchor(110.5, 134), head, 'top', 'bottom');
  t.link(head, cls, 'top', 'bottom');
  // divisore e dettaglio del blocco encoder
  t.link(t.anchor(548, -60), t.anchor(548, 450), 'bottom', 'top', { dashed: true, arrowEnd: false, color: '#9AA0A6', routing: 'straight' });
  t.text('Transformer Encoder', 595, -60, 150, 22, { bold: true, fontSize: 13 });
  t.group('', 595, 40, 140, 345, { fill: '#F2F2F2', stroke: '#BDBDBD', dashed: false });
  t.text('$L \\times$', 560, 200, 30, 24, { fontSize: 14 });
  const emb = t.box('Embedded\nPatches', 615, 410, 100, 36, RED);
  const n1 = t.box('Norm', 615, 330, 100, 24, YELLOW);
  const mha = t.box('Multi-Head\nAttention', 615, 270, 100, 40, GREEN);
  const a1 = t.op('+', 652, 225);
  const n2 = t.box('Norm', 615, 172, 100, 24, YELLOW);
  const mlp = t.box('MLP', 615, 120, 100, 30, BLUE);
  const a2 = t.op('+', 652, 72);
  t.chain([emb, n1, mha, a1, n2, mlp, a2, t.anchor(665, 15)], 'up');
  t.link(t.anchor(664.5, 380), a1, 'right', 'right');
  t.link(t.anchor(664.5, 212), a2, 'right', 'right');
  return t.done();
}

/** Gu & Dao 2023: blocco Mamba (Fig. 3, con legenda) e SSM selettivo (Fig. 1). */
function mamba() {
  const t = new Builder();
  const LIN = { fill: '#D5E8D4', stroke: '#82B366' };
  const SEQ = { fill: '#DAE8FC', stroke: '#6C8EBF' };
  t.group('', 20, 60, 300, 400, { stroke: '#555555', dashed: false, radius: 4 });
  t.text('Mamba', 120, 470, 100, 24, { bold: true, fontSize: 13 });
  const x = t.text('$x$', 160, 500, 20, 22, { fontSize: 15 });
  const split = t.add({ shape: 'ellipse', x: 166, y: 440, w: 8, h: 8, fill: '#333333', stroke: '#333333' });
  const p1 = t.add({ shape: 'trapezoid', direction: 'bottom', x: 40, y: 380, w: 110, h: 36, radius: 4, strokeWidth: 1.2, ...LIN });
  const p2 = t.add({ shape: 'trapezoid', direction: 'bottom', x: 190, y: 380, w: 110, h: 36, radius: 4, strokeWidth: 1.2, ...LIN });
  const conv = t.box('Conv', 55, 315, 80, 30, SEQ);
  const s1 = t.op('$\\sigma$', 82, 265);
  const ssm = t.box('SSM', 55, 200, 80, 36, SEQ, { bold: true, fontSize: 13 });
  const s2 = t.op('$\\sigma$', 232, 265);
  const mul = t.op('$\\otimes$', 157, 140);
  const p3 = t.add({ shape: 'trapezoid', direction: 'top', x: 100, y: 75, w: 140, h: 36, radius: 4, strokeWidth: 1.2, ...LIN });
  const y = t.text('$y$', 160, 15, 20, 22, { fontSize: 15 });
  t.link(x, split, 'top', 'bottom', { arrowEnd: false });
  t.link(split, p1, 'left', 'bottom');
  t.link(split, p2, 'right', 'bottom');
  t.chain([p1, conv, s1, ssm], 'up');
  t.link(ssm, mul, 'top', 'left');
  t.link(p2, s2, 'top', 'bottom');
  t.link(s2, mul, 'top', 'right');
  t.chain([mul, p3, y], 'up');
  // legenda
  const lg: [Color, string, 'rect' | 'ellipse'][] = [
    [LIN, 'Linear projection', 'rect'],
    [SEQ, 'Sequence transformation', 'rect'],
    [WHITE, 'Nonlinearity (activation\nor multiplication)', 'ellipse'],
  ];
  lg.forEach(([c, name, shape], i) => {
    const yy = 520 + i * 26;
    t.add({ shape, x: 20, y: yy, w: shape === 'ellipse' ? 16 : 26, h: 16, radius: 3, strokeWidth: 1.2, ...c, label: shape === 'ellipse' ? '$\\otimes$' : '', fontSize: 10 });
    t.text(name, 56, yy - 4, 150, 24, { fontSize: 10, align: 'left' });
  });
  // SSM selettivo
  t.text('Selective State Space Model', 400, -10, 330, 22, { bold: true, fontSize: 13, sublabel: 'with Hardware-aware State Expansion', subSize: 11 });
  const STATE = { fill: '#FFE6CC', stroke: '#D79B00' };
  const hprev = t.add({ shape: 'cells', label: '$h_{t-1}$', x: 420, y: 90, w: 26, h: 80, count: 4, radius: 2, ...ICON, labelPos: 'above', fontSize: 13, ...STATE });
  const A = t.add({ x: 545, y: 80, w: 16, h: 100, radius: 2, label: '$A$', labelPos: 'above', fontSize: 14, strokeWidth: 1.2, ...LIN });
  const h = t.add({ shape: 'cells', label: '$h_t$', x: 670, y: 90, w: 26, h: 80, count: 4, radius: 2, ...ICON, labelPos: 'above', fontSize: 13, ...STATE });
  const bt = t.box('$B_t$', 460, 250, 44, 30, SEQ, { fontSize: 14 });
  const dt = t.box('$\\Delta_t$', 575, 250, 44, 30, SEQ, { fontSize: 14 });
  const ct = t.box('$C_t$', 661, 250, 44, 30, SEQ, { fontSize: 14 });
  const yt = t.text('$y_t$', 730, 252, 36, 26, { fontSize: 14 });
  const xt = t.add({ shape: 'cells', label: '$x_t$', x: 405, y: 330, w: 26, h: 80, count: 5, radius: 2, ...ICON, fontSize: 13, ...LIN });
  const proj = t.box('Project', 490, 352, 120, 30, SEQ);
  t.text('Selection Mechanism', 485, 392, 130, 20, { fontSize: 11, textColor: '#2F6FB2' });
  const blue = { color: '#2F6FB2' };
  t.link(hprev, A, 'right', 'left', { dashed: true, color: '#D79B00' });
  t.link(A, h, 'right', 'left', { dashed: true, color: '#D79B00' });
  t.link(xt, proj, 'right', 'left', { dashed: true });
  t.link(xt, bt, 'top', 'left', { color: '#82B366' });
  t.link(proj, bt, 'top', 'bottom', blue);
  t.link(proj, dt, 'top', 'bottom', blue);
  t.link(proj, ct, 'top', 'bottom', blue);
  t.link(dt, bt, 'left', 'right', { dashed: true, label: 'Discretize', labelPos: 'above' });
  t.link(dt, A, 'top', 'bottom', { dashed: true });
  t.link(bt, t.anchor(481.5, 130), 'top', 'bottom', { color: '#D79B00' });
  t.link(h, ct, 'bottom', 'top', { color: '#D79B00' });
  t.link(ct, yt);
  t.text('$\\bar{A} = \\exp(\\Delta A)$,   $\\bar{B} = (\\Delta A)^{-1} (\\exp(\\Delta A) - I) \\cdot \\Delta B$', 400, 440, 380, 24, { fontSize: 12 });
  return t.done();
}

/** Kipf & Welling 2017, Fig. 1a: GCN dal grafo di input (C canali) al grafo di output (F canali). */
function gcn() {
  const t = new Builder();
  const NODE = ['#B0BEC5', '#FFCC80', '#A5D6A7', '#F8BBD0'];
  const P: [number, number][] = [[28, 40], [108, 30], [40, 112], [118, 108]];
  const E: [number, number][] = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3]];
  const graph = (ox: number, sym: string, title: string, top: string) => {
    // le carte sono contenitori: stanno sotto gli archi del grafo
    t.add({ x: ox + 8, y: -8, w: 170, h: 170, radius: 10, fill: '#F7F7F7', stroke: '#BDBDBD', strokeWidth: 1, container: true });
    t.add({ x: ox, y: 0, w: 170, h: 170, radius: 10, fill: '#FFFFFF', stroke: '#9E9E9E', strokeWidth: 1.2, container: true });
    t.text(title, ox + 35, 176, 100, 20, { fontSize: 11 });
    t.text(top, ox + 135, 4, 30, 22, { fontSize: 14 });
    const nodes = P.map(([x, y], i) =>
      t.add({ shape: 'ellipse', x: ox + x, y: y + 10, w: 30, h: 30, label: `$${sym}_${i + 1}$`, fontSize: 12, fill: NODE[i], stroke: '#555555', strokeWidth: 1 }),
    );
    for (const [a, b] of E) t.link(nodes[a], nodes[b], 'auto', 'auto', { arrowEnd: false, routing: 'straight', color: '#333333', width: 1.2 });
    return nodes;
  };
  graph(0, 'X', 'input layer', '$C$');
  const out = graph(420, 'Z', 'output layer', '$F$');
  const hid = t.box('hidden layers', 220, 50, 150, 70, WHITE, { dashed: true, stroke: '#9E9E9E', fontSize: 11, sublabel: 'ReLU', subSize: 10 });
  t.link(t.anchor(170, 85), hid, 'right', 'left', { routing: 'curve', color: '#7E57C2', width: 1.6 });
  t.link(hid, t.anchor(420, 85), 'right', 'left', { routing: 'curve', color: '#7E57C2', width: 1.6 });
  const y1 = t.text('$Y_1$', 640, 40, 30, 24, { fontSize: 14 });
  const y4 = t.text('$Y_4$', 640, 120, 30, 24, { fontSize: 14 });
  t.link(out[1], y1, 'right', 'left', { dashed: true, arrowStart: true });
  t.link(out[3], y4, 'right', 'left', { dashed: true, arrowStart: true });
  t.text('$H^{(l+1)} = \\sigma(\\tilde{D}^{-1/2} \\tilde{A} \\tilde{D}^{-1/2} H^{(l)} W^{(l)})$', 150, 205, 350, 26, { fontSize: 14 });
  return t.done();
}

/** Ho et al. 2020, Fig. 2 (modello grafico) + schema di addestramento del denoiser. */
function diffusion() {
  const t = new Builder();
  const v = (label: string, x: number, white = false) =>
    t.add({ shape: 'ellipse', label, x, y: 30, w: 46, h: 46, fontSize: 15, strokeWidth: 1.2, fill: white ? '#FFFFFF' : '#D9D9D9', stroke: '#444444' });
  const xT = v('$\\mathbf{x}_T$', 0);
  const d1 = t.text('$\\cdots$', 78, 41, 40, 24, { fontSize: 16 });
  const xt = v('$\\mathbf{x}_t$', 150);
  const xt1 = v('$\\mathbf{x}_{t-1}$', 300);
  const d2 = t.text('$\\cdots$', 380, 41, 40, 24, { fontSize: 16 });
  const x0 = v('$\\mathbf{x}_0$', 450, true);
  t.chain([xT, d1, xt]);
  t.link(xt, xt1, 'right', 'left', { label: '$p_\\theta(\\mathbf{x}_{t-1} | \\mathbf{x}_t)$', labelPos: 'above', fontSize: 11 });
  t.chain([xt1, d2, x0]);
  t.link(xt1, xt, 'bottom', 'bottom', { dashed: true, routing: 'curve', label: '$q(\\mathbf{x}_t | \\mathbf{x}_{t-1})$', labelPos: 'below', fontSize: 11 });
  t.icon('heatmap', '', -7, 150, 60, 60, GRAY, { spec: '10x10' });
  t.icon('heatmap', '', 293, 150, 60, 60, BLUE, { spec: '6x6' });
  t.icon('image', '', 443, 150, 60, 60, BLUE, { radius: 3 });
  // addestramento
  const noisy = t.icon('heatmap', '$x_t = \\sqrt{\\bar{\\alpha}_t} x_0 + \\sqrt{1 - \\bar{\\alpha}_t} \\epsilon$', 20, 300, 70, 70, GRAY, { spec: '8x8', fontSize: 13 });
  const unet = t.icon('unet', 'U-Net  $\\epsilon_\\theta(x_t, t)$', 170, 285, 170, 100, BLUE, { count: 3, labelPos: 'above' });
  const clock = t.icon('clock', '$t$', 240, 420, 30, 30, WHITE);
  const eps = t.icon('heatmap', '$\\epsilon_\\theta$', 390, 300, 70, 70, GRAY, { spec: '8x8' });
  const loss = t.box('Loss', 500, 305, 150, 60, RED, { sublabel: '$\\| \\epsilon - \\epsilon_\\theta(x_t, t) \\|^2$', subSize: 13, bold: true });
  t.chain([noisy, unet, eps, loss]);
  t.link(clock, unet, 'top', 'bottom');
  return t.done();
}

/** Rombach et al. 2022, Fig. 3: spazio dei pixel, spazio latente, condizionamento. */
function latentDiffusion() {
  const t = new Builder();
  t.group('Pixel Space', -20, 0, 225, 330, { stroke: '#C77B9B', fill: '#FDF3F6', dashed: false });
  t.group('Latent Space', 220, 0, 560, 330, { stroke: '#6AA06A', fill: '#F3FAF1', dashed: false });
  t.group('Conditioning', 800, 0, 160, 330, { stroke: '#9E9E9E', fill: '#F6F6F6', dashed: false });
  const BAR = { fill: '#6AA06A', stroke: '#3D7A3D' };
  const x = t.icon('image', '$x$', 0, 40, 70, 70, PURPLE, { radius: 3, fontSize: 14 });
  const E = t.add({ shape: 'trapezoid', direction: 'right', label: '$\\mathcal{E}$', x: 105, y: 30, w: 70, h: 90, radius: 8, fontSize: 22, strokeWidth: 1.2, ...BLUE });
  const z = t.add({ x: 248, y: 40, w: 14, h: 70, radius: 2, label: '$z$', labelPos: 'below', fontSize: 14, ...BAR });
  const proc = t.add({ x: 330, y: 55, w: 150, h: 40, label: 'Diffusion Process', fontSize: 12, radius: 6, strokeWidth: 1.2, ...WHITE });
  const zT = t.add({ x: 690, y: 40, w: 14, h: 70, radius: 2, label: '$z_T$', labelPos: 'below', fontSize: 14, ...BAR });
  const ug = t.group('Denoising U-Net $\\epsilon_\\theta$', 470, 160, 200, 150, { stroke: '#6AA06A', fill: '#E6F4E2', dashed: false });
  const ue = t.add({ shape: 'trapezoid', direction: 'right', x: 485, y: 200, w: 70, h: 96, radius: 6, strokeWidth: 1.2, ...BLUE });
  const ud = t.add({ shape: 'trapezoid', direction: 'left', x: 585, y: 200, w: 70, h: 96, radius: 6, strokeWidth: 1.2, ...BLUE });
  const qkv = (x: number, y: number) => t.add({ x, y, w: 36, h: 18, label: '$Q$ / $KV$', fontSize: 8, radius: 3, strokeWidth: 1, ...ORANGE });
  qkv(497, 220);
  qkv(497, 255);
  qkv(602, 220);
  qkv(602, 255);
  t.link(ue, ud, 'top', 'top', { dashed: true, color: '#9AA0A6', width: 1 });
  const zT1 = t.add({ x: 400, y: 200, w: 14, h: 70, radius: 2, label: '$z_{T-1}$', labelPos: 'below', fontSize: 13, ...BAR });
  const step = t.icon('cycle', '$\\times (T-1)$', 315, 213, 44, 44, { fill: 'none', stroke: '#555555' }, { fontSize: 12 });
  const z2 = t.add({ x: 248, y: 200, w: 14, h: 70, radius: 2, label: '$z$', labelPos: 'below', fontSize: 14, ...BAR });
  const D = t.add({ shape: 'trapezoid', direction: 'left', label: '$\\mathcal{D}$', x: 105, y: 190, w: 70, h: 90, radius: 8, fontSize: 22, strokeWidth: 1.2, ...BLUE });
  const x2 = t.icon('image', '$\\tilde{x}$', 0, 200, 70, 70, PURPLE, { radius: 3, fontSize: 14 });
  const tags: [string, Color][] = [['Semantic Map', RED], ['Text', YELLOW], ['Representations', GREEN], ['Images', PURPLE]];
  const tagNodes = tags.map(([s, c], i) => t.add({ x: 815, y: 35 + i * 44, w: 130, h: 32, label: s, fontSize: 11, radius: 5, strokeWidth: 1.2, ...c }));
  const tau = t.add({ shape: 'trapezoid', direction: 'right', label: '$\\tau_\\theta$', x: 845, y: 230, w: 70, h: 60, radius: 6, fontSize: 16, strokeWidth: 1.2, ...BLUE });
  t.chain([x, E, z, proc, zT]);
  t.link(zT, ug, 'bottom', 'right');
  t.link(ug, zT1, 'left', 'right');
  t.link(zT1, step, 'left', 'right');
  t.link(step, z2, 'left', 'right');
  t.link(z2, D, 'left', 'right');
  t.link(D, x2, 'left', 'right');
  t.link(tagNodes[3], tau, 'bottom', 'top');
  t.link(tau, ug, 'left', 'bottom', { label: 'crossattention', labelPos: 'below' });
  return t.done();
}

/** Peebles & Xie 2023, Fig. 3: Latent Diffusion Transformer e blocco DiT con adaLN-Zero. */
function dit() {
  const t = new Builder();
  t.text('Latent Diffusion Transformer', -40, -45, 220, 22, { bold: true, fontSize: 13 });
  const lat = t.icon('heatmap', 'Noised Latent\n$32 \\times 32 \\times 4$', 10, 430, 60, 60, GRAY, { spec: '6x6' });
  const patch = t.box('Patchify', -5, 370, 90, 30, BLUE);
  const blocks = t.box('DiT Block', -5, 290, 90, 50, ORANGE, { bold: true });
  t.text('$N \\times$', -45, 303, 36, 24, { fontSize: 13 });
  const ln = t.box('Layer Norm', -5, 230, 90, 28, BLUE);
  const lr = t.box('Linear and\nReshape', -5, 172, 90, 38, GREEN);
  const noise = t.icon('heatmap', 'Noise\n$32 \\times 32 \\times 4$', -40, 70, 56, 56, GRAY, { spec: '6x6', labelPos: 'above' });
  const sigma = t.icon('heatmap', '$\\Sigma$\n$32 \\times 32 \\times 4$', 70, 70, 56, 56, GRAY, { spec: '6x6', labelPos: 'above' });
  const embed = t.box('Embed', 125, 300, 70, 30, PURPLE);
  const tstep = t.text('Timestep $t$', 105, 370, 80, 22);
  const label = t.text('Label $y$', 175, 370, 70, 22);
  t.chain([lat, patch, blocks, ln, lr], 'up');
  t.link(lr, noise, 'top', 'bottom');
  t.link(lr, sigma, 'top', 'bottom');
  t.link(tstep, embed, 'top', 'bottom');
  t.link(label, embed, 'top', 'bottom');
  t.link(embed, blocks, 'left', 'right');
  // blocco con adaLN-Zero
  t.group('DiT Block with adaLN-Zero', 260, -10, 280, 500, { stroke: '#555555', dashed: false });
  const tokens = t.text('Input Tokens', 295, 460, 120, 22);
  const cond = t.text('Conditioning', 440, 460, 90, 22);
  const n1 = t.box('Layer Norm', 290, 410, 130, 26, BLUE);
  const ss1 = t.box('Scale, Shift', 290, 372, 130, 26, BLUE);
  const att = t.box('Multi-Head\nSelf-Attention', 290, 314, 130, 42, ORANGE);
  const sc1 = t.box('Scale', 290, 276, 130, 24, BLUE);
  const p1 = t.op('+', 342, 234);
  const n2 = t.box('Layer Norm', 290, 188, 130, 26, BLUE);
  const ss2 = t.box('Scale, Shift', 290, 150, 130, 26, BLUE);
  const ff = t.box('Pointwise\nFeedforward', 290, 92, 130, 42, GREEN);
  const sc2 = t.box('Scale', 290, 54, 130, 24, BLUE);
  const p2 = t.op('+', 342, 12);
  const mlp = t.box('MLP', 470, 230, 50, 34, PURPLE);
  t.chain([tokens, n1, ss1, att, sc1, p1, n2, ss2, ff, sc2, p2], 'up');
  t.link(t.anchor(354.5, 448), p1, 'right', 'right');
  t.link(t.anchor(354.5, 226), p2, 'right', 'right');
  t.link(cond, mlp, 'top', 'bottom');
  const params: [N, string][] = [[ss1, '$\\gamma_1, \\beta_1$'], [sc1, '$\\alpha_1$'], [ss2, '$\\gamma_2, \\beta_2$'], [sc2, '$\\alpha_2$']];
  for (const [target, sym] of params) {
    t.link(mlp, target, 'left', 'right', { color: '#8E7DB6', width: 1 });
    t.text(sym, 440, target.y - 15, 40, 18, { fontSize: 11, textColor: '#5A4A8A' });
  }
  return t.done();
}

/** Assran et al. 2023 (I-JEPA), Fig. 3: contesto, predittore per ogni blocco target, encoder target. */
function jepa() {
  const t = new Builder();
  const C: Color[] = [
    { fill: '#BBD3F2', stroke: '#3B6FB6' },
    { fill: '#F5B7B1', stroke: '#C0392B' },
    { fill: '#FCE8A6', stroke: '#C9A227' },
  ];
  const ctx = t.icon('patches', 'context', 0, 25, 80, 80, GRAY, { spec: '4x4' });
  const fx = t.box('', 120, 0, 28, 130, GRAY, { label: 'context\nencoder', sublabel: '$f_\\theta$', subSize: 14, labelPos: 'below', fontSize: 10 });
  t.add({ shape: 'flame', x: 150, y: -12, w: 14, h: 20, ...FLAME });
  const ctok = t.icon('grid', '', 185, 45, 40, 40, GRAY, { spec: '3x3' });
  const tgtImg = t.icon('image', 'target', 0, 245, 80, 72, GRAY, { radius: 3 });
  const boxes: [number, number, number, number][] = [[8, 252, 22, 20], [42, 262, 24, 20], [20, 290, 26, 18]];
  boxes.forEach(([bx, by, bw, bh], i) => t.add({ x: bx, y: by, w: bw, h: bh, radius: 0, fill: 'none', stroke: C[i].stroke, strokeWidth: 1.6 }));
  const fy = t.box('', 120, 220, 28, 130, GRAY, { label: 'target\nencoder', sublabel: '$f_{\\bar{\\theta}}$ (EMA)', subSize: 13, labelPos: 'below', fontSize: 10 });
  const ttok = t.icon('grid', '', 185, 265, 40, 40, GRAY, { spec: '3x3' });
  t.link(ctx, fx);
  t.link(fx, ctok);
  t.link(tgtImg, fy);
  t.link(fy, ttok);
  // rappresentazioni target: una colonna di blocchi colorati
  t.group('', 508, 238, 72, 84, { stroke: '#9E9E9E', dashed: false, radius: 6 });
  const targets = C.map((c, i) => t.add({ shape: 'cells', x: 520, y: 250 + i * 22, w: 48, h: 16, count: 3, radius: 2, strokeWidth: 1, ...c }));
  t.link(ttok, t.anchor(508, 285), 'right', 'left');
  C.forEach((c, i) => {
    const y = -5 + i * 58;
    const mask = t.add({ shape: 'cells', x: 265, y: y + 12, w: 48, h: 16, count: 3, radius: 2, strokeWidth: 1, ...c });
    const pred = t.box('', 345, y, 16, 40, GRAY, i === 2 ? { label: 'predictor', sublabel: '$g_\\phi$', subSize: 13, labelPos: 'below', fontSize: 10 } : {});
    const out = t.add({ shape: 'cells', x: 395, y: y + 12, w: 48, h: 16, count: 3, radius: 2, strokeWidth: 1, ...c });
    t.link(ctok, mask, 'right', 'left');
    t.chain([mask, pred, out]);
    t.link(out, targets[i], 'right', 'right', {
      dashed: true,
      arrowEnd: false,
      routing: 'curve',
      color: c.stroke,
      ...(i === 1 ? { label: '$L_2$', labelPos: 'above' as const, fontSize: 12 } : {}),
    });
  });
  t.text('mask tokens', 255, 168, 70, 18, { fontSize: 10, textColor: '#555555' });
  return t.done();
}

/** Radford et al. 2021, Fig. 1 (CLIP) e variante medica nello stile di CheXzero (Tiu et al. 2022). */
function clip(medical = false) {
  const t = new Builder();
  const txt = medical
    ? t.add({ shape: 'bubble', label: 'Opacity in the\nright lower lung\nzone…', x: 0, y: 4, w: 105, h: 62, radius: 8, fontSize: 10, ...YELLOW })
    : t.add({ shape: 'bubble', label: 'Pepper the\naussie pup', x: 0, y: 8, w: 110, h: 52, radius: 10, fontSize: 11, ...YELLOW });
  const tenc = medical
    ? t.add({ ...DEC_STYLE, direction: 'right', label: 'Text\ntransformer*', x: 145, y: 0, w: 110, h: 70, fontSize: 12, bold: true, radius: 10, fill: '#FFE6CC', stroke: '#D79B00', textColor: '#7A4A00' })
    : t.add({ ...DEC_STYLE, direction: 'right', label: 'Text\nEncoder', x: 145, y: 0, w: 100, h: 70, fontSize: 12, bold: true, radius: 10 });
  const trow = t.add({ shape: 'cells', x: 330, y: 22, w: 220, h: 30, count: 4, radius: 2, strokeWidth: 1.2, ...PURPLE });
  ['$T_1$', '$T_2$', '$T_3$', '$T_N$'].forEach((s, i) => t.text(s, 330 + i * 55, 22, 55, 30, { fontSize: 13 }));
  const im = medical ? t.img('xray', 'Chest X-ray', '', 0, 150, 80, 80) : t.icon('image', '', 5, 150, 80, 72, BLUE, { radius: 3 });
  const ienc = medical
    ? t.add({ ...DEC_STYLE, direction: 'right', label: 'Vision\ntransformer*', x: 145, y: 150, w: 110, h: 70, fontSize: 12, bold: true, radius: 10 })
    : t.add({ ...ENC_STYLE, label: 'Image\nEncoder', x: 145, y: 150, w: 100, h: 70, fontSize: 12, bold: true, radius: 10 });
  const icol = t.add({ shape: 'cells', x: 290, y: 70, w: 30, h: 220, count: 4, radius: 2, strokeWidth: 1.2, ...GREEN });
  ['$I_1$', '$I_2$', '$I_3$', '$I_N$'].forEach((s, i) => t.text(s, 290, 70 + i * 55, 30, 55, { fontSize: 13 }));
  t.icon('confmat', medical ? 'Contrastive learning' : '$I_i \\cdot T_j$', 330, 70, 220, 220, BLUE, { spec: '4x4', labelPos: 'below', fontSize: medical ? 12 : 13 });
  t.link(txt, tenc);
  t.link(tenc, trow, 'right', 'left');
  t.link(im, ienc);
  t.link(ienc, icol, 'right', 'left');
  if (medical) {
    t.text('* CLIP pre-trained', 140, 240, 120, 18, { fontSize: 10, textColor: '#555555' });
    // classificazione zero-shot con prompt positivo e negativo
    const pos = t.add({ shape: 'pill', label: 'Positive prompt: "{Pathology}"', x: 600, y: 60, w: 200, h: 32, fontSize: 10, ...GREEN });
    const neg = t.add({ shape: 'pill', label: 'Negative prompt: "No {Pathology}"', x: 600, y: 110, w: 200, h: 32, fontSize: 10, ...RED });
    const tt = t.add({ ...DEC_STYLE, direction: 'right', label: 'Text\ntransformer', x: 840, y: 66, w: 100, h: 70, fontSize: 11, bold: true, radius: 10, fill: '#FFE6CC', stroke: '#D79B00', textColor: '#7A4A00' });
    const sim = t.box('Normalized similarities', 980, 66, 120, 70, WHITE, { fontSize: 10, sublabel: '0.7   ·   0.3', subSize: 14 });
    t.link(pos, tt, 'right', 'left');
    t.link(neg, tt, 'right', 'left');
    t.link(tt, sim);
    t.text('Zero-shot classification', 600, 25, 200, 22, { bold: true, fontSize: 12 });
  }
  return t.done();
}

/** Ronneberger et al. 2015, Fig. 1: percorso di contrazione ed espansione (64 → 1024 canali). */
function unet() {
  const t = new Builder();
  const H = [150, 118, 90, 66, 46];
  const W = [8, 11, 14, 18, 24];
  const CH = ['64', '128', '256', '512', '1024'];
  const TOP: number[] = [20];
  for (let l = 1; l < 5; l++) TOP.push(TOP[l - 1] + H[l - 1] + 46);
  const C = TOP.map((y, l) => y + H[l] / 2);
  const GAP = 24;
  const L = H.length;
  const bar = (cx: number, l: number, label: string, w = W[l], fill = '#BFD7F0') =>
    t.add({ x: cx - w / 2, y: TOP[l], w, h: H[l], radius: 0, fill, stroke: '#2F5F8F', strokeWidth: 1, label, labelPos: 'above', fontSize: 9 });
  const arrow = (a: N, b: N, color: string, sa: S = 'right', sb: S = 'left') =>
    t.link(a, b, sa, sb, { color, width: 1.4, routing: 'straight' });
  const cx = (n: N) => n.x + n.w / 2;

  const left: N[] = [];
  const inp = t.add({ x: 0, y: TOP[0], w: 4, h: H[0], radius: 0, fill: '#FFFFFF', stroke: '#2F5F8F', strokeWidth: 1, label: 'input\nimage\ntile', labelPos: 'below', fontSize: 9 });
  let prev = inp;
  for (let l = 0; l < L; l++) {
    let first = prev;
    if (l > 0) {
      first = bar(cx(prev), l, '', W[l - 1]);
      arrow(prev, first, UNET_ARROW.pool, 'bottom', 'top');
    }
    const b1 = bar(cx(first) + first.w / 2 + GAP + W[l] / 2, l, CH[l]);
    arrow(first, b1, UNET_ARROW.conv);
    const b2 = bar(cx(b1) + W[l] + GAP, l, CH[l]);
    arrow(b1, b2, UNET_ARROW.conv);
    left.push(b2);
    prev = b2;
  }
  left[L - 1].labelPos = 'below';
  for (let l = L - 2; l >= 0; l--) {
    const ux = cx(prev);
    const up = bar(ux, l, CH[l]);
    const copy = t.add({ x: up.x - W[l], y: TOP[l], w: W[l], h: H[l], radius: 0, fill: '#FFFFFF', stroke: '#2F5F8F', strokeWidth: 1 });
    t.link(prev, up, 'top', 'bottom', { color: UNET_ARROW.up, width: 1.4 });
    arrow(left[l], copy, UNET_ARROW.copy);
    const b1 = bar(ux + W[l] + GAP, l, CH[l]);
    arrow(up, b1, UNET_ARROW.conv);
    const b2 = bar(cx(b1) + W[l] + GAP, l, CH[l]);
    arrow(b1, b2, UNET_ARROW.conv);
    if (l > 0) b2.labelPos = 'below';
    prev = b2;
  }
  const out = t.add({ x: prev.x + 44, y: TOP[0], w: 5, h: H[0], radius: 0, fill: '#D5E8D4', stroke: '#2F5F8F', strokeWidth: 1, label: '2', labelPos: 'above', fontSize: 9 });
  t.text('output\nsegmentation\nmap', out.x - 30, TOP[0] + H[0] + 6, 66, 40, { fontSize: 9 });
  arrow(prev, out, UNET_ARROW.out);
  const legend: [string, string][] = [
    ['conv 3×3, ReLU', UNET_ARROW.conv],
    ['copy and crop', UNET_ARROW.copy],
    ['max pool 2×2', UNET_ARROW.pool],
    ['up-conv 2×2', UNET_ARROW.up],
    ['conv 1×1', UNET_ARROW.out],
  ];
  const lx = out.x - 120;
  legend.forEach(([name, color], i) => {
    const y = C[L - 1] - 50 + i * 20;
    t.link(t.anchor(lx, y), t.anchor(lx + 30, y), 'right', 'left', { color, width: 1.6, routing: 'straight' });
    t.text(name, lx + 36, y - 9, 86, 18, { fontSize: 10, align: 'left' });
  });
  return t.done();
}


// ======================================================================
// Imaging medico
// ======================================================================

/** Virtual staining supervisionato (autofluorescenza/MPM → H&E), come in PICCOLO (Picon et al. 2022). */
function virtualStaining() {
  const t = new Builder();
  const x = t.img('autofluo', 'Autofluorescence', '$X$', 0, 75, 110, 110);
  const E = t.enc('$\\mathcal{E}$', 'Encoder', 160, 55, 120, 150);
  const f = t.box('$f$', 325, 99, 92, 62, { fill: '#F8F3E4', stroke: '#CDBD94' }, { fontSize: 20, sublabel: 'Image descriptor', subSize: 10, textColor: '#5A4A22', radius: 8 });
  const D = t.dec('$\\mathcal{D}$', 'Decoder', 460, 55, 120, 150);
  const y = t.img('he', 'Estimated H&E', '$Y$', 630, 75, 110, 110);
  const ref = t.img('he', 'Reference H&E', '$Y^*$', 0, 290, 110, 110, { count: 8 });
  const loss = t.box('Pixel-level loss', 595, 310, 180, 70, { fill: '#FAFAFB', stroke: '#B8BEC8' }, {
    bold: true,
    fontSize: 11,
    sublabel: '$\\mathcal{L}_{\\mathrm{MAE}} = \\mathrm{MAE}(Y, Y^*)$',
    subSize: 14,
    radius: 10,
  });
  t.chain([x, E, f, D, y]);
  t.link(E, D, 'top', 'top', { dashed: true, label: 'Skip connections', labelPos: 'above', color: '#7A808A' });
  t.link(y, loss, 'bottom', 'top');
  t.link(ref, loss, 'right', 'left', { label: 'Paired supervision', labelPos: 'below', color: '#7A808A' });
  return t.done();
}

/** Zhu et al. 2017, Fig. 3 (a, b) applicata al virtual staining non accoppiato. */
function cycleGan() {
  const t = new Builder();
  // (a) mappe e discriminatori
  t.text('(a)', -120, 0, 24, 20, { fontSize: 11 });
  const X = t.img('autofluo', '$X$', '', 0, 60, 90, 90, { bold: false, fontSize: 15, labelPos: 'below' });
  const Y = t.img('he', '$Y$', '', 300, 60, 90, 90, { bold: false, fontSize: 15, labelPos: 'below' });
  const DX = t.box('$D_X$', -120, 89, 70, 32, RED, { fontSize: 14 });
  const DY = t.box('$D_Y$', 440, 89, 70, 32, RED, { fontSize: 14 });
  t.link(X, Y, 'top', 'top', { routing: 'curve', label: '$G$', labelPos: 'above', fontSize: 14 });
  t.link(Y, X, 'bottom', 'bottom', { routing: 'curve', label: '$F$', labelPos: 'below', fontSize: 14 });
  t.link(X, DX, 'left', 'right', { dashed: true });
  t.link(Y, DY, 'right', 'left', { dashed: true });
  // (b) consistenza del ciclo x → G(x) → F(G(x))
  t.text('(b)', 575, 0, 24, 20, { fontSize: 11 });
  const x = t.img('autofluo', '$x$', '', 600, 50, 76, 76, { bold: false, fontSize: 14 });
  const G = t.box('$G$', 710, 70, 50, 36, BLUE, { fontSize: 15 });
  const yh = t.img('he', '$\\hat{Y}$', '', 790, 50, 76, 76, { bold: false, fontSize: 14, labelPos: 'below', count: 5 });
  const F = t.box('$F$', 900, 70, 50, 36, GREEN, { fontSize: 15 });
  const xh = t.img('autofluo', '$\\hat{x}$', '', 980, 50, 76, 76, { bold: false, fontSize: 14, count: 5 });
  const dy = t.box('$D_Y$', 800, -20, 56, 30, RED, { fontSize: 13 });
  t.chain([x, G, yh, F, xh]);
  t.link(yh, dy, 'top', 'bottom', { dashed: true });
  t.link(xh, x, 'bottom', 'bottom', {
    dashed: true,
    routing: 'curve',
    label: 'cycle-consistency loss  $\\| F(G(x)) - x \\|_1$',
    labelPos: 'below',
    fontSize: 11,
  });
  t.text('$G$: virtual stainer (autofluorescence → H&E)   ·   $D_Y$: real vs. virtual H&E', 600, 330, 460, 20, { fontSize: 10, textColor: '#555555' });
  return t.done();
}

/** Isensee et al. 2021 (Nature Methods), Fig. 2: configurazione automatica di nnU-Net. */
function nnunet() {
  const t = new Builder();
  const train = t.add({ shape: 'cylinder', label: 'Train data', x: 0, y: 130, w: 80, h: 64, fontSize: 11, strokeWidth: 1.2, ...GRAY });
  t.group('nnU-Net', 110, 0, 650, 340, { dashed: true, stroke: '#777777' });
  const list = (title: string, items: string, x: number, y: number, w: number, h: number, c: Color) =>
    t.box(title, x, y, w, h, c, { bold: true, fontSize: 11, sublabel: items, subSize: 9 });
  const fp = list('Data fingerprint', 'Distribution of spacings\nMedian shape\nIntensity distribution\nImage modality', 130, 35, 150, 100, { fill: '#F8D7E3', stroke: '#C2185B' });
  const rules = list(
    'Rule-based parameters',
    'Image resampling strategy\nImage target spacing\nIntensity normalization\nPatch size · Batch size\nNetwork topology\nCascade trigger\nLow-res configuration',
    310, 35, 175, 150,
    GREEN,
  );
  const fixed = list('Fixed parameters', 'Architecture template\nOptimizer · Learning rate\nTraining procedure\nData augmentation\nInference procedure\nLoss function', 130, 180, 150, 130, PURPLE);
  const train2 = t.group('Network training (cross-validation)', 515, 30, 225, 120, { dashed: false, stroke: '#6C8EBF', fill: '#F3F7FD' });
  t.icon('unet', '2D', 525, 62, 64, 50, BLUE, { count: 3 });
  t.icon('unet', '3D', 597, 62, 64, 50, BLUE, { count: 3 });
  t.icon('unet', '3DC', 669, 62, 64, 50, BLUE, { count: 3 });
  const post = t.box('Configuration of\npost-processing', 525, 215, 100, 46, YELLOW, { fontSize: 10 });
  const ens = t.box('Ensemble\nselection', 645, 215, 90, 46, YELLOW, { fontSize: 10 });
  const emp = t.group('Empirical parameters', 515, 180, 225, 100, { dashed: false, stroke: '#D6B656', fill: '#FFFBEA' });
  const test = t.add({ shape: 'cylinder', label: 'Test data', x: 800, y: 20, w: 80, h: 60, fontSize: 11, strokeWidth: 1.2, ...GRAY });
  const gear = t.icon('gear', '', 820, 140, 40, 40, GRAY);
  const pred = t.img('ct', 'Prediction', '', 795, 225, 90, 90, { spec: 'seg' });
  t.link(train, fp, 'right', 'left');
  t.link(fp, rules);
  t.link(rules, train2);
  t.link(fixed, train2, 'right', 'left');
  t.link(train2, emp, 'bottom', 'top', { dashed: true });
  t.link(post, ens);
  t.link(ens, gear, 'right', 'left');
  t.link(test, gear, 'bottom', 'top');
  t.link(gear, pred, 'bottom', 'top');
  return t.done();
}

/** Ma et al. 2024 (MedSAM), Fig. 2b: encoder d'immagine, prompt encoder con box, mask decoder. */
function medsam() {
  const t = new Builder();
  const img = t.img('ct', 'Input Image', '', 0, 50, 100, 100, { spec: 'box' });
  const enc = t.add({ ...ENC_STYLE, label: 'Image encoder', sublabel: 'ViT-B', x: 145, y: 30, w: 130, h: 140, fontSize: 12, bold: true, fill: '#FDE9C9', stroke: '#D79B00', textColor: '#7A4A00' });
  t.add({ shape: 'flame', x: 255, y: 26, w: 15, h: 20, ...FLAME });
  const emb = t.add({ shape: 'cells', label: 'Image\nembedding', x: 318, y: 50, w: 22, h: 100, count: 6, radius: 2, ...ICON, fill: '#FFD8A8', stroke: '#D79B00' });
  const mdec = t.box('Mask decoder', 390, 70, 120, 60, { fill: '#F9D3C9', stroke: '#C0634B' }, { bold: true, radius: 8 });
  t.add({ shape: 'flame', x: 500, y: 58, w: 15, h: 20, ...FLAME });
  const penc = t.box('Prompt encoder', 390, 190, 120, 30, GRAY);
  t.add({ shape: 'snowflake', x: 500, y: 180, w: 16, h: 16, ...FROZEN });
  const boxp = t.box('Bounding box prompts', 190, 186, 150, 38, { fill: '#FFFFFF', stroke: '#E5484D' }, { dashed: true, fontSize: 11 });
  const mask = t.img('ct', 'Segmentation', '', 560, 50, 100, 100, { spec: 'seg box' });
  t.chain([img, enc, emb, mdec, mask]);
  t.link(boxp, penc);
  t.link(penc, mdec, 'top', 'bottom');
  return t.done();
}

/** MIL con attenzione su whole-slide image (Ilse et al. 2018; CLAM, Lu et al. 2021). */
function wsiMil() {
  const t = new Builder();
  const slide = t.img('wsi', 'Whole-slide image', '', 0, 40, 140, 105);
  const tiles = t.icon('patches', 'Tiles  $\\{x_k\\}_{k=1}^{K}$', 185, 50, 84, 84, RED, { spec: '3x3' });
  const fext = t.enc('$f$', 'Feature extractor', 310, 25, 110, 135, { fontSize: 18 });
  t.add({ shape: 'snowflake', x: 398, y: 20, w: 16, h: 16, ...FROZEN });
  const hk = t.add({ shape: 'cells', label: '$h_k$', x: 460, y: 40, w: 26, h: 110, count: 6, radius: 2, ...ICON, ...BLUE });
  const att = t.box('Attention network', 530, 20, 130, 40, ORANGE, { sublabel: '$a_k$', subSize: 13, h: 48 });
  const pool = t.box('Attention pooling', 530, 100, 130, 54, YELLOW, { sublabel: '$z = \\sum_k a_k h_k$', subSize: 13 });
  const clf = t.box('Classifier', 700, 107, 90, 40, TEAL);
  const yhat = t.box('$\\hat{Y}$', 830, 107, 54, 40, GRAY, { fontSize: 16 });
  const heat = t.icon('heatmap', 'Attention heatmap', 553, 205, 84, 64, RED, { spec: '6x8' });
  t.chain([slide, tiles, fext, hk]);
  t.link(hk, att, 'right', 'left');
  t.link(hk, pool, 'right', 'left');
  t.link(att, pool, 'bottom', 'top');
  t.chain([pool, clf, yhat]);
  t.link(pool, heat, 'bottom', 'top', { dashed: true });
  return t.done();
}

/** Rivenson et al. 2019 (Nat. Biomed. Eng.), Fig. 1: virtual staining da autofluorescenza. */
function rivenson() {
  const t = new Builder();
  const TEALC = { fill: '#D0ECE7', stroke: '#45A29E' };
  const biopsy = t.add({ shape: 'pill', label: 'Biopsy', x: 0, y: 30, w: 90, h: 36, fontSize: 12, ...GRAY });
  const section = t.box('Unstained tissue\nsection', 130, 25, 140, 46, TEALC);
  const unst = t.img('he', 'Unstained', '', 300, 8, 80, 80, { spec: 'unstained', fontSize: 10 });
  const histo = t.box('Histological staining', 130, 135, 140, 40, GRAY, { fontSize: 11 });
  const bright = t.box('Microscope imaging\n(bright-field image)', 300, 130, 150, 50, GRAY, { fontSize: 11 });
  const he = t.img('he', 'Histologically stained', '', 480, 115, 80, 80, { fontSize: 10 });
  const af = t.box('Autofluorescence imaging\n(label-free image)', 115, 250, 170, 50, TEALC, { fontSize: 11 });
  const afimg = t.img('autofluo', 'Autofluorescence', '', 310, 235, 80, 80, { spec: 'gray', fontSize: 10 });
  const dnn = t.add({ shape: 'pill', label: 'Deep neural network', x: 410, y: 255, w: 140, h: 40, fontSize: 11, bold: true, ...ORANGE });
  const virt = t.img('he', 'Network output', '', 575, 235, 80, 80, { fontSize: 10, count: 6 });
  t.link(biopsy, section);
  t.link(section, unst, 'right', 'left');
  t.link(section, histo, 'bottom', 'top', { dashed: true, color: '#9AA0A6' });
  t.chain([histo, bright, he], 'right', { dashed: true, color: '#9AA0A6' });
  t.link(section, af, 'left', 'left', { color: '#45A29E', width: 1.6 });
  t.chain([af, afimg, dnn, virt], 'right', { color: '#45A29E', width: 1.6 });
  return t.done();
}

export type Template = TemplateDef;

export const TEMPLATES: Template[] = [
  { id: 'transformer', name: 'Transformer', section: 'Design noti', build: transformer },
  { id: 'vit', name: 'ViT', section: 'Design noti', build: vit },
  { id: 'mamba', name: 'Mamba', section: 'Design noti', build: mamba },
  { id: 'gnn', name: 'Graph Neural Network (GCN)', section: 'Design noti', build: gcn },
  { id: 'unet', name: 'U-Net', section: 'Design noti', build: unet },
  { id: 'diffusion', name: 'Diffusion Model (DDPM)', section: 'Design noti', build: diffusion },
  { id: 'ldm', name: 'Latent Diffusion Model', section: 'Design noti', build: latentDiffusion },
  { id: 'dit', name: 'Latent Diffusion Transformer (DiT)', section: 'Design noti', build: dit },
  { id: 'jepa', name: 'JEPA (I-JEPA)', section: 'Design noti', build: jepa },
  { id: 'clip', name: 'CLIP', section: 'Design noti', build: () => clip(false) },
  { id: 'vstain', name: 'Virtual staining (paired)', section: 'Design medicali', build: virtualStaining },
  { id: 'rivenson', name: 'Virtual staining (Rivenson 2019)', section: 'Design medicali', build: rivenson },
  { id: 'cyclegan', name: 'Virtual staining (CycleGAN)', section: 'Design medicali', build: cycleGan },
  { id: 'nnunet', name: 'Segmentazione (nnU-Net)', section: 'Design medicali', build: nnunet },
  { id: 'medsam', name: 'MedSAM', section: 'Design medicali', build: medsam },
  { id: 'mil', name: 'WSI + attention MIL', section: 'Design medicali', build: wsiMil },
  { id: 'medclip', name: 'Vision-language medico (CheXzero)', section: 'Design medicali', build: () => clip(true) },
];

/** Modelli della libreria: quelli di base più quelli dei moduli di dominio. */
export function allTemplates(): Template[] {
  return [...TEMPLATES, ...registeredTemplates()];
}
