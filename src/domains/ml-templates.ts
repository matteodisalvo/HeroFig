// Modelli (diagrammi completi) del machine learning classico, nello stile delle figure dei
// manuali e della documentazione di scikit-learn. Tutto resta modificabile dopo l'inserimento.
import { Builder, type Color } from '../builder';
import { COLORS, ICON, type NodeModel } from '../model';
import type { TemplateDef } from '../registry';
import { kfoldLayout } from './ml-blocks';
import { adaboost, partitionPoints } from './ml-plots';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
type N = NodeModel;

const PLOT = { ...ICON, fill: '#FFFFFF', stroke: '#C9CED6', strokeWidth: 1, radius: 3 };
const NOTE = { fontSize: 10, textColor: '#555555' };
const CARD = { fill: '#FAFBFC', stroke: '#C9CED6', strokeWidth: 1.2, radius: 10, container: true };
const LOOP = { dashed: true, color: '#7A808A' };
const CLASS: Color[] = [BLUE, ORANGE, GREEN];
const CLASS_NAME = ['Class A', 'Class B', 'Class C'];

const plot = (t: Builder, shape: string, label: string, x: number, y: number, w: number, h: number, extra: Partial<N> = {}) =>
  t.add({ ...PLOT, shape, label, x, y, w, h, ...extra });

const fmt = (v: number) => v.toFixed(2);

// ======================================================================
// Pipeline end-to-end
// ======================================================================

function pipeline() {
  const t = new Builder();
  const W = 150, H = 178, G = 44;
  const X = (i: number) => i * (W + G);
  const stages: [string, string][] = [
    ['Raw data', 'databases · logs\nsensors · images'],
    ['Data cleaning', 'missing values\noutliers · duplicates'],
    ['Feature engineering', 'scaling · encoding\nfeature selection'],
    ['Train / test split', 'stratified, no leakage\n(+ validation / CV)'],
    ['Model training', 'fit $f_\\theta$ on train set\nhyperparameter tuning'],
    ['Evaluation', 'accuracy · F1 · AUC\non held-out test set'],
    ['Deployment', 'serving (REST API)\nmonitoring'],
  ];
  const cards = stages.map(([title, note], i) => {
    const card = t.add({ ...CARD, x: X(i), y: 0, w: W, h: H });
    t.text(title, X(i), 8, W, 20, { bold: true, fontSize: 12 });
    t.text(note, X(i) + 4, H - 44, W - 8, 34, NOTE);
    return card;
  });
  t.add({ shape: 'cylinder', x: X(0) + 38, y: 42, w: 74, h: 72, strokeWidth: 1.2, ...GRAY });
  // tabella con due valori mancanti
  t.add({ shape: 'ml-table', x: X(1) + 25, y: 42, w: 100, h: 72, spec: '5x4', strokeWidth: 1, fill: '#FFFFFF', stroke: '#666666' });
  for (const [r, c] of [[2, 1], [4, 3]]) t.add({ shape: 'xmark', x: X(1) + 25 + c * 25 + 8.5, y: 42 + r * 12 + 2, w: 8, h: 8, fill: 'none', stroke: '#E5484D', strokeWidth: 0.9 });
  t.add({ shape: 'ml-importance', x: X(2) + 30, y: 44, w: 96, h: 68, count: 5, strokeWidth: 1.2, ...BLUE });
  t.add({ shape: 'ml-split', x: X(3) + 10, y: 64, w: 130, h: 26, spec: '75,25', radius: 3, strokeWidth: 1.2, ...BLUE });
  plot(t, 'ml-boundary', '', X(4) + 30, 40, 90, 76);
  t.add({ shape: 'confmat', x: X(5) + 12, y: 48, w: 58, h: 58, spec: '3x3', strokeWidth: 1.2, ...BLUE });
  plot(t, 'ml-roc', '', X(5) + 80, 48, 58, 58, { count: 1, spec: 'plain' });
  t.add({ shape: 'cloud', label: 'API', x: X(6) + 28, y: 46, w: 94, h: 60, fontSize: 12, strokeWidth: 1.2, ...BLUE });
  t.chain(cards);
  t.link(cards[5], cards[2], 'bottom', 'bottom', { ...LOOP, label: 'iterate (error analysis)', labelPos: 'below' });
  t.link(cards[6], cards[0], 'top', 'top', { ...LOOP, label: 'monitoring → retraining on new data (drift)', labelPos: 'above' });
  return t.done();
}

// ======================================================================
// K-fold cross-validation (come nella documentazione di scikit-learn)
// ======================================================================

function kfoldCv() {
  const t = new Builder();
  const k = 5;
  const x0 = 80, BW = 520, TW = 416;
  t.text('All data', x0, 4, BW, 18, { bold: true, fontSize: 12 });
  const bar = t.add({ shape: 'ml-split', x: x0, y: 26, w: BW, h: 28, spec: '80,20 plain', radius: 3, strokeWidth: 1.2, ...BLUE });
  t.text('Training data', x0, 26, TW, 28, { fontSize: 11 });
  t.text('Test data', x0 + TW, 26, BW - TW, 28, { fontSize: 11 });
  const FY = 96, FH = 160;
  // le etichette "Fold i" / "Split i" sono della forma: si allarga il blocco perché le colonne
  // restino allineate alla parte di training della barra sopra
  const kf = t.add({ shape: 'ml-kfold', x: x0, y: FY, w: TW, h: FH, count: k, strokeWidth: 1.2, ...BLUE });
  let L = kfoldLayout(kf);
  const [dx, dy] = [L.x0 - kf.x, L.y0 - kf.y];
  Object.assign(kf, { x: kf.x - dx, w: kf.w + dx, y: kf.y - dy, h: kf.h + dy });
  L = kfoldLayout(kf);
  const rowC = (r: number) => L.rowY[r] + L.rowH / 2;
  for (let i = 0; i < k; i++) {
    const s = t.text(`$s_${i + 1}$`, x0 + TW + 34, rowC(i) - 10, 24, 20, { fontSize: 13 });
    t.link(t.anchor(x0 + TW + 3, rowC(i) - 0.5), s, 'right', 'left', { routing: 'straight', width: 1 });
  }
  const bx = x0 + TW + 64;
  t.add({ shape: 'brace', direction: 'right', x: bx, y: FY, w: 14, h: FH, fill: 'none', stroke: '#555555', strokeWidth: 1.2 });
  const sel = t.box('Model selection', 640, FY + FH / 2 - 36, 170, 72, BLUE, { sublabel: '$\\bar{s} = \\frac{1}{k} \\sum_{i=1}^{k} s_i$', subSize: 13 });
  t.link(t.anchor(bx + 16, FY + FH / 2 - 0.5), sel, 'right', 'left');
  const fin = t.box('Final evaluation', 650, 22, 150, 36, GREEN);
  t.link(bar, fin);
  t.link(sel, fin, 'top', 'bottom', { label: 'best $\\theta^*$ → refit on\nall training data', labelPos: 'below', fontSize: 10 });
  // legenda
  const ly = FY + FH + 22;
  t.add({ x: x0, y: ly, w: 26, h: 14, radius: 0, strokeWidth: 1.2, ...BLUE });
  t.text('training folds', x0 + 32, ly - 2, 90, 18, { fontSize: 10, align: 'left' });
  t.add({ x: x0 + 140, y: ly, w: 26, h: 14, radius: 0, strokeWidth: 1.2, fill: '#FFD8A8', stroke: '#D79B00' });
  t.text('validation fold', x0 + 172, ly - 2, 90, 18, { fontSize: 10, align: 'left' });
  t.add({ x: x0 + 290, y: ly, w: 26, h: 14, radius: 0, strokeWidth: 1.2, ...GREEN });
  t.text('test set (never used for tuning)', x0 + 322, ly - 2, 180, 18, { fontSize: 10, align: 'left' });
  return t.done();
}

// ======================================================================
// Bagging / random forest
// ======================================================================

function randomForest() {
  const t = new Builder();
  const data = t.add({ shape: 'ml-table', label: 'Training set $\\mathcal{D}$', x: 0, y: 118, w: 92, h: 70, spec: '5x4 y', strokeWidth: 1.2, ...ICON, ...BLUE });
  const ys = [0, 112, 262];
  const names = ['1', '2', 'B'];
  const votes = [1, 1, 0];
  t.group('Random forest', 262, -34, 140, 380);
  const preds = ys.map((y, i) => {
    const s = t.add({ shape: 'ml-table', label: `$\\mathcal{D}_${names[i]}$`, x: 160, y, w: 74, h: 54, spec: '4x4 y', strokeWidth: 1, ...ICON, ...BLUE });
    const tree = t.add({ shape: 'ml-forest', label: `$h_${names[i]}(x)$`, x: 282, y: y - 4, w: 100, h: 62, count: 1, spec: String(i + 1), strokeWidth: 1.2, ...ICON, ...GREEN });
    const p = t.add({ shape: 'pill', label: CLASS_NAME[votes[i]], x: 440, y: y + 14, w: 76, h: 26, fontSize: 11, strokeWidth: 1.2, ...CLASS[votes[i]] });
    t.link(data, s, 'right', 'left');
    t.chain([s, tree, p]);
    return p;
  });
  t.text('·\n·\n·', 180, 196, 34, 50, { fontSize: 14 });
  t.text('·\n·\n·', 450, 196, 56, 50, { fontSize: 14 });
  const vote = t.box('Majority vote', 560, 113, 112, 44, YELLOW);
  const out = t.add({ shape: 'pill', label: '$\\hat{y}$ = Class B', x: 712, y: 120, w: 100, h: 30, fontSize: 12, strokeWidth: 1.2, ...ORANGE });
  for (const p of preds) t.link(p, vote, 'right', 'left');
  t.link(vote, out);
  t.text('bootstrap samples\n(with replacement,\n$|\\mathcal{D}_b| = |\\mathcal{D}|$)', -6, 46, 110, 44, NOTE);
  t.text('random subset of $m \\approx \\sqrt{p}$\nfeatures at each split', 250, 352, 165, 30, NOTE);
  t.text('$\\hat{y} = \\mathrm{mode} \\{h_1(x), \\ldots, h_B(x)\\}$', 520, 170, 200, 20, { fontSize: 12 });
  t.text('regression: $\\hat{f}(x) = \\frac{1}{B} \\sum_{b=1}^{B} f_b(x)$', 520, 196, 200, 40, NOTE);
  return t.done();
}

// ======================================================================
// Boosting (AdaBoost con decision stump)
// ======================================================================

function boosting() {
  const t = new Builder();
  const hs = adaboost(3);
  const W = 130, H = 110, G = 74;
  const panels = hs.map((h, i) => {
    const eps = 1 / (1 + Math.exp(2 * h.alpha));
    return plot(t, 'ml-stump', `Round ${i + 1}: weak learner $h_${i + 1}$`, i * (W + G), 50, W, H, {
      count: i + 1,
      labelPos: 'above',
      sublabel: `$\\varepsilon_${i + 1} = ${fmt(eps)}$,  $\\alpha_${i + 1} = ${fmt(h.alpha)}$`,
      subSize: 11,
    });
  });
  for (let i = 1; i < panels.length; i++) t.link(panels[i - 1], panels[i], 'right', 'left', { label: 're-weight', labelPos: 'above', fontSize: 10 });
  const sumW = 3 * W + 2 * G;
  const sum = t.box('Weighted vote:  $H(x) = \\mathrm{sign}(\\sum_{t=1}^{3} \\alpha_t h_t(x))$', 0, 230, sumW, 76, YELLOW, {
    sublabel: `$= \\mathrm{sign}(${fmt(hs[0].alpha)} h_1(x) + ${fmt(hs[1].alpha)} h_2(x) + ${fmt(hs[2].alpha)} h_3(x))$`,
    subSize: 12,
  });
  panels.forEach((p, i) => t.link(p, t.anchor(p.x + W / 2, 230), 'bottom', 'top', { label: `$\\alpha_${i + 1}$`, labelPos: 'below', fontSize: 12 }));
  const fin = plot(t, 'ml-stump', 'Final classifier $H(x)$', sumW + 70, 213, W, H, { spec: 'final', labelPos: 'above' });
  t.link(sum, fin);
  t.text(
    'marker size $\\propto$ sample weight:   $D_{t+1}(i) = \\frac{D_t(i) \\exp(-\\alpha_t y_i h_t(x_i))}{Z_t}$,      $\\alpha_t = \\frac{1}{2} \\ln \\frac{1 - \\varepsilon_t}{\\varepsilon_t}$',
    0, 340, sumW + 200, 40,
    { ...NOTE, align: 'left' },
  );
  return t.done();
}

// ======================================================================
// Stacking
// ======================================================================

function stacking() {
  const t = new Builder();
  const data = t.add({ shape: 'ml-table', label: 'Training data $X$', x: 0, y: 128, w: 92, h: 70, spec: '5x4', strokeWidth: 1.2, ...ICON, ...GRAY });
  t.group('Level 0: base learners', 140, -6, 310, 312);
  const learners: [string, Color][] = [['SVM', BLUE], ['Random forest', GREEN], ['$k$-NN', ORANGE], ['Gradient boosting', PURPLE]];
  const rows = learners.map(([name, c], i) => {
    const y = 34 + i * 66;
    const m = t.box(name, 160, y, 130, 40, c);
    const p = t.add({ shape: 'cells', label: `$\\hat{y}^{(${i + 1})}$`, x: 330, y: y + 10, w: 96, h: 20, count: 6, radius: 2, strokeWidth: 1.2, ...ICON, labelPos: 'above', fontSize: 11, ...c });
    t.link(data, m, 'right', 'left');
    t.link(m, p);
    return { p, c };
  });
  // le predizioni impilate formano le meta-feature
  const zx = 500, zy = 128;
  const zrows = rows.map(({ c }, i) => t.add({ shape: 'cells', x: zx, y: zy + i * 18, w: 96, h: 18, count: 6, radius: 0, strokeWidth: 1.2, ...c }));
  // gomiti sfalsati: le quattro frecce convergono senza sovrapporsi
  rows.forEach(({ p }, i) => t.link(p, zrows[i], 'right', 'left', { offset: i === 0 || i === 3 ? 10 : -10 }));
  t.text('Meta-features $Z$', zx - 10, zy + 76, 116, 18, { fontSize: 12 });
  t.text('out-of-fold predictions\n($k$-fold CV, no leakage)', zx - 20, zy + 96, 136, 30, NOTE);
  t.group('Level 1', 640, 98, 170, 130);
  const meta = t.box('Meta-learner', 655, 140, 140, 50, TEAL, { sublabel: 'logistic regression', subSize: 10 });
  const out = t.box('$\\hat{y}$', 850, 147, 56, 36, GRAY, { fontSize: 16 });
  t.link(t.anchor(zx + 96, zy + 35.5), meta, 'right', 'left');
  t.link(meta, out);
  return t.done();
}

// ======================================================================
// Kernel trick (SVM)
// ======================================================================

function kernelTrick() {
  const t = new Builder();
  const inp = plot(t, 'ml-boundary', 'Input space $\\mathcal{X} = \\mathbb{R}^2$', 0, 50, 150, 130, {
    spec: 'rings',
    labelPos: 'above',
    sublabel: 'not linearly separable',
    subSize: 10,
  });
  const feat = plot(t, 'ml-lift', 'Feature space $\\mathcal{H} = \\mathbb{R}^3$', 370, 30, 200, 170, {
    labelPos: 'above',
    sublabel: 'separable by a hyperplane $w^\\top \\phi(x) + b = 0$',
    subSize: 10,
    stroke: 'none',
    fill: 'none',
  });
  const out = plot(t, 'ml-boundary', 'Decision boundary in $\\mathcal{X}$', 770, 50, 150, 130, {
    spec: 'circle',
    labelPos: 'above',
    sublabel: 'nonlinear (circle)',
    subSize: 10,
  });
  t.link(inp, feat, 'right', 'left', { label: '$\\phi(x) = (x_1, x_2, x_1^2 + x_2^2)$', labelPos: 'above', fontSize: 11 });
  t.link(feat, out, 'right', 'left', { label: 'back to $\\mathcal{X}$', labelPos: 'above', fontSize: 11 });
  t.box('', 150, 236, 620, 84, { fill: '#FAFAFB', stroke: '#B8BEC8' }, {
    label: 'Kernel trick: $K(x, x\') = \\langle \\phi(x), \\phi(x\') \\rangle$, never computing $\\phi$ explicitly',
    sublabel: 'RBF: $K(x, x\') = \\exp(-\\gamma \\|x - x\'\\|^2)$      $f(x) = \\mathrm{sign}(\\sum_{i=1}^{n} \\alpha_i y_i K(x_i, x) + b)$',
    fontSize: 12,
    subSize: 12,
    radius: 10,
  });
  return t.done();
}

// ======================================================================
// Ricerca degli iperparametri
// ======================================================================

function hyperSearch() {
  const t = new Builder();
  const grid = plot(t, 'ml-search', 'Grid search', 0, 0, 104, 104, { labelPos: 'above' });
  const rand = plot(t, 'ml-search', 'Random search', 0, 170, 104, 104, { spec: 'random', labelPos: 'above' });
  t.text('or', 30, 124, 50, 18, { fontSize: 11, italic: true, textColor: '#555555' });
  t.text('Search space $\\Theta$ (e.g. $C$, $\\gamma$)', -10, 292, 140, 34, NOTE);
  const smp = t.box('Sample $\\theta \\in \\Theta$', 170, 110, 120, 50, BLUE);
  const cv = t.add({ shape: 'ml-kfold', label: '$k$-fold CV on train set', x: 340, y: 106, w: 120, h: 58, count: 5, strokeWidth: 1, ...ICON, ...BLUE });
  const score = t.box('Validation score', 505, 101, 140, 68, YELLOW, { sublabel: '$\\bar{s}(\\theta) = \\frac{1}{k} \\sum_{i=1}^{k} s_i(\\theta)$', subSize: 12 });
  const more = t.add({ shape: 'diamond', label: 'budget\nleft?', x: 690, y: 95, w: 90, h: 80, fontSize: 11, strokeWidth: 1.2, ...WHITE });
  const refit = t.box('Refit on full train set', 660, 246, 150, 68, GREEN, { sublabel: '$\\theta^* = \\arg\\max_{\\theta \\in \\Theta} \\bar{s}(\\theta)$', subSize: 12 });
  const test = t.box('Evaluate once\non the test set', 870, 252, 130, 56, TEAL);
  t.link(grid, smp, 'right', 'left');
  t.link(rand, smp, 'right', 'left');
  t.chain([smp, cv, score, more]);
  t.link(more, smp, 'top', 'top', { ...LOOP, label: 'yes: next $\\theta$', labelPos: 'above' });
  t.link(more, refit, 'bottom', 'top', { label: 'no', labelPos: 'below' });
  t.link(refit, test);
  return t.done();
}

// ======================================================================
// Albero di decisione (con la partizione dello spazio delle feature)
// ======================================================================

function decisionTree() {
  const t = new Builder();
  const pts = partitionPoints();
  const info = (pred: (u: number, v: number) => boolean) => {
    const sel = pts.filter(([u, v]) => pred(u, v));
    const val = [0, 1, 2].map((k) => sel.filter((q) => q[2] === k).length);
    const n = sel.length || 1;
    const gini = 1 - val.reduce((s, c) => s + (c / n) ** 2, 0);
    return { n: sel.length, val, gini };
  };
  const split = (cond: string, pred: (u: number, v: number) => boolean, x: number, y: number) => {
    const s = info(pred);
    return t.box(cond, x, y, 132, 66, WHITE, {
      fontSize: 13,
      sublabel: `gini = ${fmt(s.gini)}\nsamples = ${s.n}\nvalue = [${s.val.join(', ')}]`,
      subSize: 10,
    });
  };
  const leaf = (k: number, pred: (u: number, v: number) => boolean, x: number, y: number) =>
    t.box(CLASS_NAME[k], x, y, 104, 44, CLASS[k], { fontSize: 12, bold: true, sublabel: `samples = ${info(pred).n}`, subSize: 10 });
  const root = split('$x_1 \\leq 0.5$', () => true, 236, 0);
  const l = split('$x_2 \\leq 0.6$', (u) => u <= 0.5, 96, 110);
  const r = split('$x_2 \\leq 0.35$', (u) => u > 0.5, 376, 110);
  const ll = leaf(0, (u, v) => u <= 0.5 && v <= 0.6, 20, 228);
  const lr = leaf(1, (u, v) => u <= 0.5 && v > 0.6, 160, 228);
  const rl = leaf(1, (u, v) => u > 0.5 && v <= 0.35, 300, 228);
  const rr = split('$x_1 \\leq 0.75$', (u, v) => u > 0.5 && v > 0.35, 440, 220);
  const rrl = leaf(0, (u, v) => u > 0.5 && u <= 0.75 && v > 0.35, 380, 336);
  const rrr = leaf(2, (u, v) => u > 0.75 && v > 0.35, 520, 336);
  const edge = (a: N, b: N, yes: boolean) =>
    t.link(a, b, 'bottom', 'top', { routing: 'straight', label: yes ? 'yes' : 'no', fontSize: 10, color: '#555555' });
  edge(root, l, true);
  edge(root, r, false);
  edge(l, ll, true);
  edge(l, lr, false);
  edge(r, rl, true);
  edge(r, rr, false);
  edge(rr, rrl, true);
  edge(rr, rrr, false);
  t.text('Gini impurity of a node:  $G = 1 - \\sum_{k=1}^{K} p_k^2$', 0, 318, 330, 40, { fontSize: 12, align: 'left' });
  t.text('value = samples per class [A, B, C]; $p_k$ = fraction of class $k$', 0, 360, 330, 18, { ...NOTE, align: 'left' });
  // partizione corrispondente
  const part = plot(t, 'ml-partition', 'Feature space partition', 720, 60, 230, 200, { labelPos: 'above', fontSize: 12 });
  t.text('$x_1$', part.x + part.w / 2 - 10, part.y + part.h + 2, 20, 18, { fontSize: 13 });
  t.text('$x_2$', part.x - 26, part.y + part.h / 2 - 9, 22, 18, { fontSize: 13 });
  // soglie degli split sugli assi (stessa area dati della forma: margini 12% / 5% / 7% / 12%)
  const PX = (u: number) => part.x + part.w * (0.12 + 0.83 * u);
  const PY = (v: number) => part.y + part.h * (0.88 - 0.81 * v);
  for (const u of [0.5, 0.75]) t.text(String(u), PX(u) - 14, PY(0) + 3, 28, 12, { fontSize: 9, textColor: '#555555' });
  for (const v of [0.35, 0.6]) t.text(String(v), part.x + 2, PY(v) - 6, part.w * 0.12 - 7, 12, { fontSize: 9, textColor: '#555555', align: 'right' });
  return t.done();
}

// ======================================================================
// PCA + classificatore
// ======================================================================

function pcaPipeline() {
  const t = new Builder();
  const X = t.add({ shape: 'ml-table', label: '$X \\in \\mathbb{R}^{n \\times d}$', x: 0, y: 40, w: 100, h: 80, spec: '6x6', strokeWidth: 1.2, ...ICON, ...BLUE });
  const std = t.box('Standardize', 150, 48, 120, 64, YELLOW, { sublabel: '$z = \\frac{x - \\mu}{\\sigma}$', subSize: 13 });
  const pca = plot(t, 'ml-pca', 'PCA', 320, 25, 120, 110, { labelPos: 'above', sublabel: '$X = U \\Sigma V^\\top$', subSize: 12 });
  const Z = t.add({ shape: 'ml-table', label: '$Z = X V_k \\in \\mathbb{R}^{n \\times k}$', x: 494, y: 40, w: 46, h: 80, spec: '6x2', strokeWidth: 1.2, ...ICON, ...PURPLE });
  const clf = plot(t, 'ml-svm', 'Classifier (SVM)', 600, 25, 120, 110, { labelPos: 'above' });
  const out = t.box('$\\hat{y}$', 770, 62, 56, 36, GRAY, { fontSize: 16 });
  t.chain([X, std, pca, Z, clf, out]);
  const scree = t.add({
    shape: 'ml-scree', label: 'Explained variance ratio', sublabel: '$\\frac{\\lambda_j}{\\sum_{i=1}^{d} \\lambda_i}$', subSize: 13,
    x: 320, y: 200, w: 120, h: 72, count: 6, strokeWidth: 1.2, ...ICON, ...PURPLE,
  });
  t.link(pca, scree, 'bottom', 'top', { dashed: true, color: '#7A808A', label: 'choose $k$ (e.g. 95% variance)', labelPos: 'below', fontSize: 10 });
  t.text('fit $\\mu$, $\\sigma$ and $V_k$ on the training set only,\nthen apply the same transform to the test set', 0, 216, 280, 34, NOTE);
  return t.done();
}

// ======================================================================
// k-means: le iterazioni dell'algoritmo di Lloyd (Bishop, Fig. 9.1)
// ======================================================================

function kmeansSteps() {
  const t = new Builder();
  const W = 132, H = 112, G = 48;
  const steps: [string, string, string][] = [
    ['raw', '(a) data', ''],
    ['init', '(b) initialize $\\mu_k$', 'random centroids'],
    ['assign', '(c) assignment step', '$r_{nk} = 1$ iff $k = \\arg\\min_j \\|x_n - \\mu_j\\|^2$'],
    ['update', '(d) update step', '$\\mu_k = \\frac{\\sum_n r_{nk} x_n}{\\sum_n r_{nk}}$'],
    ['voronoi', '(e) converged', 'Voronoi cells'],
  ];
  const panels = steps.map(([spec, label, sub], i) =>
    plot(t, 'ml-kmeans', label, i * (W + G), 30, W, H, { spec, count: 3, sublabel: sub, subSize: 10 }),
  );
  t.chain(panels);
  t.link(panels[3], panels[2], 'top', 'top', { ...LOOP, label: 'repeat until assignments stop changing', labelPos: 'above', fontSize: 10 });
  t.text('objective (distortion):  $J = \\sum_{n=1}^{N} \\sum_{k=1}^{K} r_{nk} \\|x_n - \\mu_k\\|^2$', 0, 222, 5 * W + 4 * G, 44, { fontSize: 12 });
  return t.done();
}

// ======================================================================
// Valutazione di un classificatore binario
// ======================================================================

function evaluation() {
  const t = new Builder();
  // matrice di confusione 2×2
  const cx = 90, cy = 50, S = 86;
  t.text('Predicted', cx, 0, 2 * S, 18, { bold: true, fontSize: 12 });
  t.text('Positive', cx, 22, S, 18, { fontSize: 11 });
  t.text('Negative', cx + S, 22, S, 18, { fontSize: 11 });
  t.text('Actual', 0, cy + S - 9, 40, 18, { bold: true, fontSize: 12 });
  t.text('Positive', 38, cy + S / 2 - 9, 50, 18, { fontSize: 11 });
  t.text('Negative', 38, cy + S + S / 2 - 9, 50, 18, { fontSize: 11 });
  const cell = (label: string, sub: string, i: number, j: number, c: Color) =>
    t.box(label, cx + j * S, cy + i * S, S, S, c, { radius: 0, fontSize: 16, bold: true, sublabel: sub, subSize: 10 });
  cell('TP', 'true positive', 0, 0, GREEN);
  cell('FN', 'false negative\n(type II)', 0, 1, RED);
  cell('FP', 'false positive\n(type I)', 1, 0, RED);
  cell('TN', 'true negative', 1, 1, GREEN);
  const metrics = [
    '$\\mathrm{Precision} = \\frac{\\mathrm{TP}}{\\mathrm{TP} + \\mathrm{FP}}$',
    '$\\mathrm{Recall} = \\mathrm{TPR} = \\frac{\\mathrm{TP}}{\\mathrm{TP} + \\mathrm{FN}}$',
    '$\\mathrm{FPR} = \\frac{\\mathrm{FP}}{\\mathrm{FP} + \\mathrm{TN}}$',
    '$F_1 = \\frac{2 \\cdot P \\cdot R}{P + R}$',
    '$\\mathrm{Accuracy} = \\frac{\\mathrm{TP} + \\mathrm{TN}}{N}$',
  ];
  metrics.forEach((m, i) => t.text(m, 30, 236 + i * 38, 280, 34, { fontSize: 12, align: 'left' }));
  // soglia → curve (nomi degli assi, FN/FP e τ sono disegnati dalle forme)
  const thr = plot(t, 'ml-threshold', 'Classifier score $s(x)$', 380, 40, 180, 110, { labelPos: 'below' });
  t.text('negatives', 392, 44, 60, 16, { fontSize: 10, textColor: '#3B6FB6' });
  t.text('positives', 490, 44, 60, 16, { fontSize: 10, textColor: '#C96F12' });
  // le frecce partono sotto il titolo del grafico, non lo attraversano
  const below = t.anchor(thr.x + thr.w / 2 - 0.5, thr.y + thr.h + 26);
  const roc = plot(t, 'ml-roc', 'ROC curve (AUC)', 350, 236, 120, 120, { count: 1 });
  const pr = plot(t, 'ml-pr', 'Precision–recall', 500, 236, 120, 120, { count: 1 });
  t.link(below, roc, 'bottom', 'top', { label: 'sweep $\\tau$', labelPos: 'above', fontSize: 10 });
  t.link(below, pr, 'bottom', 'top');
  return t.done();
}

const S = 'Machine learning';

export const ML_TEMPLATES: TemplateDef[] = [
  { id: 'ml-pipeline', name: 'Pipeline di ML (end-to-end)', section: S, build: pipeline },
  { id: 'ml-kfold-cv', name: 'Cross-validation k-fold', section: S, build: kfoldCv },
  { id: 'ml-random-forest', name: 'Bagging / random forest', section: S, build: randomForest },
  { id: 'ml-boosting', name: 'Boosting (AdaBoost)', section: S, build: boosting },
  { id: 'ml-stacking', name: 'Stacking', section: S, build: stacking },
  { id: 'ml-kernel-trick', name: 'Kernel trick (SVM)', section: S, build: kernelTrick },
  { id: 'ml-hpsearch', name: 'Ricerca iperparametri', section: S, build: hyperSearch },
  { id: 'ml-decision-tree', name: 'Albero di decisione', section: S, build: decisionTree },
  { id: 'ml-pca-pipeline', name: 'PCA + classificatore', section: S, build: pcaPipeline },
  { id: 'ml-kmeans-steps', name: 'k-means (iterazioni)', section: S, build: kmeansSteps },
  { id: 'ml-evaluation', name: 'Valutazione (confusione, ROC, PR)', section: S, build: evaluation },
];
