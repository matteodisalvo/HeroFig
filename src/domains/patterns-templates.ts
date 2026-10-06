// Modelli del modulo pattern recognition & computer vision, ricalcati sulle figure originali.
// Sono fatti di normali blocchi e connessioni: dopo l'inserimento resta tutto modificabile.
import { Builder, type Color, type N } from '../builder';
import { COLORS, ENC_STYLE, MED_IMG } from '../model';
import type { TemplateDef } from '../registry';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const SECTION = 'Pattern recognition & CV';
const NOTE = { fontSize: 10, textColor: '#555555' };
const PLOT = { fill: '#FFFFFF', stroke: '#B8BEC8', strokeWidth: 1, radius: 3 };
const DASHED_GRAY = { dashed: true, color: '#9AA0A6' };

/** Duda, Hart & Stork, Pattern Classification (2001), Fig. 1.7: componenti di un sistema, dal basso. */
function prSystem() {
  const t = new Builder();
  const X = 200, W = 150, H = 36;
  const stage = (label: string, y: number, c: Color) => t.box(label, X, y, W, H, c);
  const decision = t.text('decision', X + 25, 0, 100, 22, { bold: true });
  const post = stage('post-processing', 40, PURPLE);
  const clf = stage('classification', 120, ORANGE);
  const feat = stage('feature extraction', 200, GREEN);
  const segm = stage('segmentation', 280, TEAL);
  const sens = stage('sensing', 360, BLUE);
  const input = t.text('input', X + 25, 440, 100, 22, { bold: true });
  t.chain([input, sens, segm, feat, clf, post, decision], 'up');
  // ingressi laterali (il post-processore tiene conto di contesto e costi)
  const side = (label: string, y: number) => t.box(label, 400, y, 150, 30, WHITE, { dashed: true, fontSize: 11, stroke: '#888888' });
  const ctx = side('adjustments for context', 12);
  const cost = side('costs', 74);
  const miss = side('adjustments for\nmissing features', 123);
  t.link(ctx, t.anchor(X + W - 1, 50), 'left', 'right');
  t.link(cost, t.anchor(X + W - 1, 66), 'left', 'right');
  t.link(miss, clf, 'left', 'right');
  // esempio a sinistra: una scena stradale lungo la catena
  const ex = (shape: string, spec: string, y: number, extra = {}) =>
    t.add({ ...MED_IMG, shape, spec, label: '', x: 96, y, w: 76, h: 56, count: 0, ...extra });
  ex('pr-scene', '', 350);
  ex('pr-scene', 'seg', 270);
  t.add({ shape: 'heatmap', spec: '1x7', x: 96, y: 210, w: 76, h: 14, strokeWidth: 1, ...PURPLE });
  t.text('$\\mathbf{x} = (x_1, \\ldots, x_d)^\\top$', 76, 228, 116, 20, { fontSize: 11 });
  ex('pr-regions', '', 110, { count: 3, ...PLOT, stroke: '#888888' });
  t.text('$\\hat{\\omega} = \\arg\\max_i P(\\omega_i | \\mathbf{x})$', 0, -8, 190, 36, { fontSize: 12 });
  t.text('$P(\\omega_i | \\mathbf{x}) = \\frac{p(\\mathbf{x} | \\omega_i) P(\\omega_i)}{p(\\mathbf{x})}$', -150, 116, 236, 44, { fontSize: 12, align: 'right' });
  t.text('Example', 96, 420, 76, 18, { ...NOTE, italic: true });
  return t.done();
}

/** Bag of visual words (Csurka et al. 2004; Sivic & Zisserman 2003): descrittori, codebook, istogramma, SVM. */
function bovw() {
  const t = new Builder();
  const img = t.img('pr-sift', 'Input image', '', 0, 39, 110, 82, { count: 14 });
  const desc = t.icon('heatmap', 'Local descriptors\n$\\mathbf{d}_i \\in \\mathbb{R}^{128}$', 160, 55, 70, 50, ORANGE, { spec: '5x8', fontSize: 11 });
  const vq = t.box('Vector quantization', 280, 46, 130, 68, YELLOW, { sublabel: '$q(\\mathbf{d}) = \\arg\\min_k \\| \\mathbf{d} - \\mathbf{c}_k \\|$', subSize: 11 });
  const hist = t.icon('barchart', 'Bag of visual words\n$h_k = \\sum_i [q(\\mathbf{d}_i) = k]$', 450, 52, 90, 56, BLUE, { count: 8, fontSize: 11 });
  const svm = t.box('SVM', 590, 58, 80, 44, TEAL, { bold: true });
  const out = t.text('$\\hat{y}$ = car', 710, 69, 70, 22, { fontSize: 13 });
  t.chain([img, desc, vq, hist, svm, out]);
  // ramo di addestramento del vocabolario
  const train = t.icon('frames', 'Training images', 10, 212, 86, 70, BLUE);
  const km = t.box('$k$-means\nclustering', 150, 225, 110, 44, PURPLE);
  const book = t.icon('pr-voronoi', 'Visual vocabulary\n($K$ visual words)', 300, 207, 90, 80, PLOT, { count: 12, stroke: '#888888', fontSize: 11 });
  t.chain([train, km, book]);
  t.link(book, vq, 'top', 'bottom', { label: 'codebook', labelPos: 'below', fontSize: 10 });
  t.link(t.anchor(0, 175), t.anchor(780, 175), 'right', 'left', { ...DASHED_GRAY, arrowEnd: false, routing: 'straight', width: 1 });
  t.text('recognition', 620, 152, 160, 18, { ...NOTE, italic: true, align: 'right' });
  t.text('training (offline)', 620, 180, 160, 18, { ...NOTE, italic: true, align: 'right' });
  return t.done();
}

/** Viola & Jones 2001: feature di Haar (Fig. 1) e cascata di classificatori (Fig. 4). */
function violaJones() {
  const t = new Builder();
  t.text('Haar-like features', 0, -26, 140, 20, { bold: true, fontSize: 12, align: 'left' });
  ['A', 'B', 'C', 'D'].forEach((s, i) => t.icon('pr-haar', s, i * 66, 0, 50, 50, WHITE, { count: i + 1, strokeWidth: 1, stroke: '#666666', radius: 0 }));
  t.text('Integral image', 300, -26, 140, 20, { bold: true, fontSize: 12, align: 'left' });
  t.text("$ii(x, y) = \\sum_{x' \\leq x, y' \\leq y} i(x', y')$", 300, -2, 260, 40, { fontSize: 13, align: 'left' });
  t.text('any rectangle sum = 4 array references', 300, 40, 260, 18, { ...NOTE, align: 'left' });
  // cascata
  const img = t.img('pr-window', 'All sub-windows', '', 0, 120, 100, 100, { spec: 'face gray', count: 2 });
  const st = (k: number, x: number) => t.add({ shape: 'ellipse', label: String(k), x, y: 148, w: 44, h: 44, fontSize: 15, strokeWidth: 1.2, ...WHITE });
  const s1 = st(1, 170), s2 = st(2, 280), s3 = st(3, 390);
  const fp = t.box('Further\nprocessing', 490, 148, 100, 44, GREEN);
  const T = { label: 'T', labelPos: 'above' as const, fontSize: 11 };
  t.link(img, s1, 'right', 'left');
  t.link(s1, s2, 'right', 'left', T);
  t.link(s2, s3, 'right', 'left', T);
  t.link(s3, fp, 'right', 'left', T);
  const rej = t.box('Reject sub-window', 150, 260, 304, 34, RED);
  for (const s of [s1, s2, s3]) t.link(s, t.anchor(s.x + 21.5, rej.y), 'bottom', 'top', { label: 'F', labelPos: 'below', fontSize: 11 });
  [['2 features', s1], ['10 features', s2], ['25 features', s3]].forEach(([txt, s]) => {
    const n = s as N;
    t.text(txt as string, n.x - 18, n.y - 24, 80, 16, NOTE);
  });
  t.text('Each stage: boosted classifier (AdaBoost); early stages reject most negatives.', 0, 310, 460, 18, { ...NOTE, align: 'left' });
  t.text('$h(x) = 1$  if  $\\sum_{t=1}^{T} \\alpha_t h_t(x) \\geq \\frac{1}{2} \\sum_{t=1}^{T} \\alpha_t$', 0, 334, 400, 44, { fontSize: 12, align: 'left' });
  return t.done();
}

/** Ren et al. 2015 (Faster R-CNN), Fig. 2 (rete unica, dal basso) e Fig. 3 (dettaglio della RPN). */
function fasterRcnn() {
  const t = new Builder();
  const img = t.add({ ...MED_IMG, shape: 'pr-scene', label: 'image', bold: false, fontSize: 12, labelPos: 'below', x: 0, y: 330, w: 120, h: 88, count: 0 });
  const conv = t.add({ shape: 'trapezoid', direction: 'top', label: 'conv layers', x: 0, y: 252, w: 120, h: 42, radius: 6, fontSize: 12, strokeWidth: 1.2, ...ORANGE });
  const fmap = t.add({ shape: 'stack', count: 3, x: 25, y: 160, w: 70, h: 60, strokeWidth: 1.2, ...ORANGE });
  t.text('feature maps', -95, 178, 90, 20, { fontSize: 11, align: 'right' });
  const roi = t.box('RoI pooling', 0, 90, 120, 34, YELLOW);
  const clf = t.box('classifier', 0, 10, 120, 40, TEAL, { sublabel: 'softmax · bbox regressor', subSize: 9, h: 44 });
  t.chain([img, conv, fmap, roi, clf], 'up');
  const rpn = t.box('Region Proposal\nNetwork', 190, 168, 140, 44, PURPLE);
  t.link(fmap, rpn, 'right', 'left');
  const props = t.add({ ...MED_IMG, shape: 'pr-yolo', spec: '5x5 boxes', label: 'proposals', count: 0, bold: false, fontSize: 12, x: 215, y: 73, w: 90, h: 68 });
  t.link(rpn, props, 'top', 'bottom');
  t.link(props, roi, 'left', 'right');
  // dettaglio della RPN
  t.group('Region Proposal Network', 400, 0, 290, 420, { dashed: true });
  const anc = t.icon('pr-anchors', 'conv feature map', 480, 270, 110, 110, { fill: '#FFFFFF', stroke: '#6C8EBF' }, { count: 9, spec: '7x7', strokeWidth: 1.2, radius: 0 });
  t.text('sliding\nwindow', 410, 290, 60, 30, NOTE);
  t.text('$k$ anchor\nboxes', 600, 300, 70, 30, NOTE);
  const mid = t.box('intermediate layer', 470, 190, 130, 32, BLUE, { sublabel: '256-d', subSize: 10, h: 40 });
  const cls = t.box('cls layer', 425, 90, 100, 32, GREEN);
  const reg = t.box('reg layer', 545, 90, 100, 32, GREEN);
  t.text('$2k$ scores', 425, 50, 100, 20, { fontSize: 12 });
  t.text('$4k$ coordinates', 535, 50, 120, 20, { fontSize: 12 });
  t.link(anc, mid, 'top', 'bottom');
  t.link(mid, cls, 'top', 'bottom');
  t.link(mid, reg, 'top', 'bottom');
  t.link(rpn, t.anchor(400, 190), 'right', 'left', { ...DASHED_GRAY, arrowEnd: false });
  t.text('RPN loss:  $L = \\frac{1}{N_{\\mathrm{cls}}} \\sum_i L_{\\mathrm{cls}}(p_i, p_i^*) + \\lambda \\frac{1}{N_{\\mathrm{reg}}} \\sum_i p_i^* L_{\\mathrm{reg}}(t_i, t_i^*)$', 330, 428, 430, 44, { fontSize: 12 });
  return t.done();
}

/** Redmon et al. 2016 (YOLO), Fig. 2: griglia S×S, box con confidenza, mappa di probabilità, detection finali. */
function yolo() {
  const t = new Builder();
  const grid = t.img('pr-yolo', '$S \\times S$ grid on input', '', 0, 98, 130, 104, { spec: '7x7', bold: false, fontSize: 12, count: 0 });
  const boxes = t.img('pr-yolo', 'Bounding boxes + confidence', '', 210, 0, 130, 104, { spec: '7x7 boxes', bold: false, fontSize: 12, count: 0 });
  const prob = t.img('pr-yolo', 'Class probability map', '', 210, 196, 130, 104, { spec: '7x7 prob', bold: false, fontSize: 12, count: 0 });
  const fin = t.img('pr-scene', 'Final detections', '', 420, 98, 130, 104, { spec: 'det', bold: false, fontSize: 12, count: 0 });
  t.link(grid, boxes, 'right', 'left');
  t.link(grid, prob, 'right', 'left');
  t.link(boxes, fin, 'right', 'left');
  t.link(prob, fin, 'right', 'left');
  t.text('$S \\times S \\times (B \\cdot 5 + C)$ tensor', 380, 236, 200, 20, { fontSize: 12 });
  t.text('each cell: $B$ boxes $(x, y, w, h)$ + confidence, $C$ class probabilities', 360, 256, 260, 32, NOTE);
  t.text('$\\mathrm{Pr}(\\mathrm{Class}_i | \\mathrm{Object}) \\cdot \\mathrm{Pr}(\\mathrm{Object}) \\cdot \\mathrm{IOU}^{\\mathrm{truth}}_{\\mathrm{pred}}$', 340, 294, 300, 24, { fontSize: 12 });
  // legenda delle classi della mappa
  const legend: [string, string][] = [['car', '#F4A6C6'], ['person', '#8EC1EE']];
  legend.forEach(([s, c], i) => {
    t.add({ x: 210 + i * 70, y: 314, w: 12, h: 12, radius: 0, fill: c, stroke: 'none' });
    t.text(s, 226 + i * 70, 311, 50, 18, { ...NOTE, align: 'left' });
  });
  return t.done();
}

/** He et al. 2017 (Mask R-CNN), Fig. 1 e Fig. 4 (testa con FPN): RoIAlign, ramo classe/box e ramo maschera. */
function maskRcnn() {
  const t = new Builder();
  const img = t.img('pr-scene', 'Input image', '', 0, 62, 110, 82, { count: 0 });
  const bb = t.add({ ...ENC_STYLE, label: 'ResNet-FPN', sublabel: 'backbone + RPN', x: 150, y: 48, w: 110, h: 110, fontSize: 12, bold: true });
  const ra = t.icon('pr-roipool', 'RoIAlign', 300, 68, 70, 70, { fill: '#FFFFFF', stroke: '#9673A6' }, { count: 2, spec: '8x8 align', strokeWidth: 1.2, radius: 0 });
  t.chain([img, bb, ra]);
  const C = { fill: '#DAE8FC', stroke: '#6C8EBF' };
  const cube = (label: string, x: number, y: number, w: number, h: number, c = C) =>
    t.add({ shape: 'cuboid', label, labelPos: 'below', fontSize: 10, x, y, w, h, depth: 0.3, strokeWidth: 1.1, ...c });
  // ramo classe + box
  const c1 = cube('$7 \\times 7 \\times 256$', 420, 0, 44, 48);
  const fc = (x: number) => t.add({ x, y: -3, w: 14, h: 54, radius: 1, label: '1024', labelPos: 'above', fontSize: 10, strokeWidth: 1.1, ...GREEN });
  const f1 = fc(510), f2 = fc(560);
  const ocls = t.box('class', 620, -12, 60, 26, ORANGE, { fontSize: 11 });
  const obox = t.box('box', 620, 26, 60, 26, ORANGE, { fontSize: 11 });
  t.link(ra, c1, 'right', 'left');
  t.chain([c1, f1, f2]);
  t.link(f2, ocls, 'right', 'left');
  t.link(f2, obox, 'right', 'left');
  // ramo maschera
  const m1 = cube('$14 \\times 14 \\times 256$', 420, 130, 54, 54);
  const m2 = cube('$14 \\times 14 \\times 256$', 520, 130, 54, 54);
  const m3 = cube('$28 \\times 28 \\times 256$', 620, 118, 76, 78);
  const m4 = cube('$28 \\times 28 \\times 80$\nmask', 740, 118, 76, 78, { fill: '#F8CECC', stroke: '#B85450' });
  t.link(ra, m1, 'right', 'left');
  t.link(m1, m2, 'right', 'left', { label: '$\\times 4$', labelPos: 'above', fontSize: 11 });
  t.link(m2, m3, 'right', 'left', { label: 'deconv', labelPos: 'above', fontSize: 10 });
  t.link(m3, m4, 'right', 'left');
  const res = t.img('pr-scene', 'Instance segmentation', '', 860, 116, 110, 82, { spec: 'inst det', count: 0 });
  t.link(m4, res, 'right', 'left');
  t.text('$L = L_{\\mathrm{cls}} + L_{\\mathrm{box}} + L_{\\mathrm{mask}}$', 520, 236, 220, 22, { fontSize: 13 });
  return t.done();
}

/** Chen et al. 2017 (DeepLabv3), Fig. 5: backbone, ASPP (convoluzioni atrous + image pooling), concat. */
function deeplab() {
  const t = new Builder();
  const img = t.img('pr-scene', 'Image', '', 0, 109, 100, 76, { count: 0 });
  const bb = t.icon('cnn', 'DCNN (output stride 16)', 140, 112, 150, 70, ORANGE, { count: 3 });
  const fmap = t.add({ shape: 'stack', count: 3, x: 330, y: 120, w: 52, h: 56, strokeWidth: 1.2, ...ORANGE });
  t.chain([img, bb, fmap]);
  t.group('ASPP', 450, 30, 190, 240, { dashed: true });
  const branch = (label: string, y: number, c: Color = BLUE) => t.box(label, 470, y, 150, 30, c, { fontSize: 11 });
  const bs = [
    branch('$1 \\times 1$ Conv', 55),
    branch('$3 \\times 3$ Conv, rate 6', 95),
    branch('$3 \\times 3$ Conv, rate 12', 135),
    branch('$3 \\times 3$ Conv, rate 18', 175),
    branch('Image Pooling', 225, PURPLE),
  ];
  const cat = t.box('Concat +\n$1 \\times 1$ Conv', 700, 115, 100, 70, YELLOW, { fontSize: 11 });
  for (const b of bs) {
    t.link(fmap, b, 'right', 'left');
    t.link(b, cat, 'right', 'left');
  }
  const c11 = t.box('$1 \\times 1$ Conv', 840, 132, 84, 36, BLUE, { fontSize: 11 });
  const pred = t.img('pr-scene', 'Prediction', '', 964, 109, 100, 76, { spec: 'seg', count: 0 });
  t.chain([cat, c11, pred]);
  t.text('Atrous Spatial Pyramid Pooling', 455, 274, 180, 18, NOTE);
  // convoluzione atrous: tre rate
  t.text('Atrous convolution:  $y[i] = \\sum_k x[i + r \\cdot k]\\, w[k]$', 60, 222, 300, 34, { fontSize: 12 });
  [1, 2, 3].forEach((r, i) =>
    t.icon('pr-atrous', `rate $r = ${r}$`, 90 + i * 90, 262, 56, 56, { fill: '#FFFFFF', stroke: '#6C8EBF' }, { count: r, spec: '7x7', strokeWidth: 1.1, radius: 0, fontSize: 11 }),
  );
  return t.done();
}

/** Modello di Markov nascosto (Rabiner 1989): catena di stati, emissioni, traliccio di Viterbi. */
function hmm() {
  const t = new Builder();
  const XS = [60, 170, 280, 460];
  const state = (label: string, x: number) => t.add({ shape: 'ellipse', label, x, y: 50, w: 46, h: 46, fontSize: 15, strokeWidth: 1.2, ...WHITE });
  const obs = (label: string, x: number) => t.add({ shape: 'ellipse', label, x, y: 170, w: 46, h: 46, fontSize: 15, strokeWidth: 1.2, fill: '#D9D9D9', stroke: '#444444' });
  const q = [state('$q_1$', XS[0]), state('$q_2$', XS[1]), state('$q_3$', XS[2]), state('$q_T$', XS[3])];
  const o = [obs('$o_1$', XS[0]), obs('$o_2$', XS[1]), obs('$o_3$', XS[2]), obs('$o_T$', XS[3])];
  const dots = t.text('$\\cdots$', 360, 61, 50, 24, { fontSize: 16 });
  t.text('$\\cdots$', 360, 181, 50, 24, { fontSize: 16 });
  const A = { label: '$a_{ij}$', labelPos: 'above' as const, fontSize: 12 };
  t.link(q[0], q[1], 'right', 'left', A);
  t.link(q[1], q[2], 'right', 'left', A);
  t.link(q[2], dots, 'right', 'left');
  t.link(dots, q[3], 'right', 'left');
  q.forEach((s, i) => t.link(s, o[i], 'bottom', 'top', i < 2 ? { label: '$b_j(o_t)$', labelPos: 'below', fontSize: 11 } : {}));
  const pi = t.text('$\\pi_i$', 63, -20, 40, 22, { fontSize: 14 });
  t.link(pi, q[0], 'bottom', 'top');
  t.text('hidden states', -120, 62, 110, 22, { ...NOTE, fontSize: 11, align: 'right' });
  t.text('observations', -120, 182, 110, 22, { ...NOTE, fontSize: 11, align: 'right' });
  // traliccio
  t.icon('pr-trellis', 'Viterbi decoding', 590, 40, 210, 120, WHITE, { count: 3, spec: '6', strokeWidth: 1, bold: true });
  t.text('$\\delta_t(j) = \\max_{i} [\\delta_{t-1}(i)\\, a_{ij}]\\, b_j(o_t)$', 570, 184, 250, 36, { fontSize: 12 });
  t.text('time $t$ →', 650, 12, 90, 18, NOTE);
  t.text('states', 540, 90, 46, 18, { ...NOTE, align: 'right' });
  t.text('$\\lambda = (A, B, \\pi)$:    $a_{ij} = P(q_{t+1} = S_j | q_t = S_i)$,    $b_j(o_t) = P(o_t | q_t = S_j)$,    $\\pi_i = P(q_1 = S_i)$', -40, 246, 760, 22, { fontSize: 12 });
  t.text('Forward:  $\\alpha_{t+1}(j) = [\\sum_{i=1}^{N} \\alpha_t(i)\\, a_{ij}]\\, b_j(o_{t+1})$,     $P(O | \\lambda) = \\sum_{i=1}^{N} \\alpha_T(i)$', -40, 276, 760, 46, { fontSize: 12 });
  return t.done();
}

/** Dalal & Triggs 2005, Fig. 1: catena di estrazione delle feature HOG e SVM lineare. */
function hogSvm() {
  const t = new Builder();
  const img = t.img('pr-scene', 'Input image', '', 0, 6, 52, 104, { spec: 'ped', count: 0 });
  const steps: [string, Color][] = [
    ['Normalize gamma\n& colour', GRAY],
    ['Compute\ngradients', BLUE],
    ['Weighted vote into\nspatial & orientation\ncells', GREEN],
    ['Contrast normalize\nover overlapping\nspatial blocks', YELLOW],
    ["Collect HOG's over\ndetection window", ORANGE],
    ['Linear SVM', PURPLE],
  ];
  const W = 118, G = 26, X0 = 90;
  const boxes = steps.map(([s, c], i) => t.box(s, X0 + i * (W + G), 28, W, 60, c, { fontSize: 11 }));
  const out = t.text('Person /\nnon-person\nclassification', X0 + 6 * (W + G) - 6, 33, 100, 50, { fontSize: 11, bold: true });
  t.chain([img, ...boxes, out]);
  // illustrazioni sotto i passi
  const cx = (i: number) => X0 + i * (W + G) + W / 2;
  const pic = (i: number, shape: string, spec: string, w: number, h: number, extra = {}) =>
    t.add({ ...MED_IMG, shape, spec, label: '', x: cx(i) - w / 2, y: 120, w, h, count: 0, ...extra });
  pic(0, 'pr-scene', 'ped gray', 44, 88);
  pic(1, 'pr-scene', 'ped edges', 44, 88);
  pic(2, 'pr-hog', '12x6', 44, 88, { fill: '#111111' });
  pic(3, 'pr-hog', '12x6 block', 44, 88, { fill: '#111111' });
  t.add({ shape: 'heatmap', spec: '1x12', x: cx(4) - 50, y: 156, w: 100, h: 14, strokeWidth: 1, ...ORANGE });
  t.text('feature vector', cx(4) - 50, 174, 100, 16, NOTE);
  pic(5, 'pr-regions', 'linear', 76, 64, { count: 2, ...PLOT, stroke: '#888888' });
  t.text('$9$ orientation bins, $8 \\times 8$ px cells, $2 \\times 2$ cell blocks', cx(2) - 40, 214, 320, 18, NOTE);
  t.text('$f(\\mathbf{x}) = \\mathrm{sign}(\\mathbf{w}^\\top \\mathbf{x} + b)$', cx(5) - 80, 190, 160, 22, { fontSize: 12 });
  return t.done();
}

/** Verifica facciale con rete siamese (Chopra, Hadsell & LeCun 2005; perdita contrastiva, Hadsell et al. 2006). */
function siamese() {
  const t = new Builder();
  const x1 = t.img('pr-scene', '$X_1$', '', 0, 20, 84, 84, { spec: 'face', count: 2, bold: false, fontSize: 14 });
  const x2 = t.img('pr-scene', '$X_2$', '', 0, 200, 84, 84, { spec: 'face', count: 4, bold: false, fontSize: 14 });
  const g1 = t.add({ ...ENC_STYLE, label: '$G_W$', sublabel: 'ConvNet', x: 130, y: 7, w: 100, h: 110, fontSize: 22 });
  const g2 = t.add({ ...ENC_STYLE, label: '$G_W$', sublabel: 'ConvNet', x: 130, y: 187, w: 100, h: 110, fontSize: 22 });
  const e1 = t.add({ shape: 'cells', label: '$G_W(X_1)$', labelPos: 'above', fontSize: 12, x: 280, y: 22, w: 22, h: 80, count: 5, radius: 2, strokeWidth: 1.2, ...PURPLE });
  const e2 = t.add({ shape: 'cells', label: '$G_W(X_2)$', labelPos: 'below', fontSize: 12, x: 280, y: 202, w: 22, h: 80, count: 5, radius: 2, strokeWidth: 1.2, ...PURPLE });
  t.chain([x1, g1, e1]);
  t.chain([x2, g2, e2]);
  t.link(g1, g2, 'bottom', 'top', { dashed: true, arrowStart: true, color: '#6E9E8B', label: 'shared weights $W$', labelPos: 'below', fontSize: 11 });
  const dist = t.box('Distance', 350, 127, 190, 50, YELLOW, { sublabel: '$D_W = \\| G_W(X_1) - G_W(X_2) \\|_2$', subSize: 12, bold: true, fontSize: 11 });
  t.link(e1, dist, 'right', 'top');
  t.link(e2, dist, 'right', 'bottom');
  const dec = t.box('same / different', 590, 132, 120, 40, GREEN, { fontSize: 11, sublabel: '$D_W < \\tau$ ?', subSize: 12, h: 44 });
  t.link(dist, dec, 'right', 'left');
  t.text('Contrastive loss:  $L = (1 - Y) \\frac{1}{2} D_W^2 + Y \\frac{1}{2} \\{\\max(0, m - D_W)\\}^2$', 320, 292, 420, 40, { fontSize: 12 });
  return t.done();
}

/** Cao et al. 2017 (OpenPose), Fig. 2: mappe di confidenza, part affinity fields, matching, risultato. */
function openPose() {
  const t = new Builder();
  const im = (spec: string, title: string, x: number, y: number) =>
    t.img('pr-pose', title, '', x, y, 112, 100, { spec, count: 2, bold: false, fontSize: 11 });
  const a = im('photo clean', '(a) Input Image', 0, 90);
  const s = im('photo heat', '(b) Part Confidence Maps', 190, 0);
  const l = im('photo paf', '(c) Part Affinity Fields', 190, 180);
  const d = im('photo match', '(d) Bipartite Matching', 375, 90);
  const e = im('photo', '(e) Parsing Results', 560, 90);
  t.link(a, s, 'right', 'left', { label: '$\\mathbf{S}$', labelPos: 'above', fontSize: 12 });
  t.link(a, l, 'right', 'left', { label: '$\\mathbf{L}$', labelPos: 'below', fontSize: 12 });
  t.link(s, d, 'right', 'left');
  t.link(l, d, 'right', 'left');
  t.link(d, e, 'right', 'left');
  return t.done();
}

export const PATTERN_TEMPLATES: TemplateDef[] = [
  { id: 'pr-system', name: 'Sistema di pattern recognition', section: SECTION, build: prSystem },
  { id: 'pr-bovw', name: 'Bag of visual words', section: SECTION, build: bovw },
  { id: 'pr-violajones', name: 'Viola–Jones (cascata)', section: SECTION, build: violaJones },
  { id: 'pr-hogsvm', name: 'HOG + SVM (Dalal–Triggs)', section: SECTION, build: hogSvm },
  { id: 'pr-fasterrcnn', name: 'Faster R-CNN', section: SECTION, build: fasterRcnn },
  { id: 'pr-yolo', name: 'YOLO', section: SECTION, build: yolo },
  { id: 'pr-maskrcnn', name: 'Mask R-CNN', section: SECTION, build: maskRcnn },
  { id: 'pr-deeplab', name: 'DeepLab (ASPP)', section: SECTION, build: deeplab },
  { id: 'pr-hmm', name: 'Hidden Markov Model', section: SECTION, build: hmm },
  { id: 'pr-siamese', name: 'Verifica facciale siamese', section: SECTION, build: siamese },
  { id: 'pr-openpose', name: 'Stima della posa (OpenPose)', section: SECTION, build: openPose },
];

