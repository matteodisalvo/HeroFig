// Schemi originali basati sulle API scikit-learn e sullo split conformal.
// Tutti i titoli, i simboli, i blocchi e i collegamenti restano modificabili.
import { Builder } from '../builder';
import { COLORS, ICON, type NodeModel } from '../model';
import type { TemplateDef } from '../registry';
const { BLUE, GREEN, ORANGE, PURPLE, YELLOW, WHITE, GRAY, RED } = COLORS;
type N = NodeModel;
const icon = (t: Builder, family: string, spec: string, label: string, x: number, y: number, w = 130, h = 90, extra: Partial<N> = {}) =>
  t.add({ shape: `mlx-${family}`, spec, label, x, y, w, h, count: 5, ...ICON, fill: '#FFFFFF', stroke: '#BAC5D3', strokeWidth: 1, radius: 3, ...extra });
const title = (t: Builder, label: string, x = 0, y = -48, w = 880) => t.text(label, x, y, w, 28, { bold: true, fontSize: 18, align: 'left' });
const note = (t: Builder, label: string, x: number, y: number, w = 800) => t.text(label, x, y, w, 32, { fontSize: 11, textColor: '#64748B', align: 'left' });

function columnTransformer() {
  const t = new Builder(); title(t, 'Mixed-type preprocessing without data leakage');
  const train = icon(t, 'preprocess', 'columns', 'Training rows', 0, 140, 130, 96);
  const preprocessingGroup = t.group('Fit on training data only', 195, 0, 535, 305, { fill: '#F7FAFE', stroke: '#B8CCE4', dashed: true });
  const num = icon(t, 'preprocess', 'missing', 'Numeric columns', 220, 56, 100, 70);
  const cat = icon(t, 'preprocess', 'categorical', 'Categorical columns', 220, 190, 100, 70);
  const impute = t.box('Median\nimputation', 355, 62, 120, 54, BLUE);
  const scale = icon(t, 'scale', 'standard', 'StandardScaler', 515, 50, 150, 74);
  const catimp = t.box('Most-frequent\nimputation', 355, 197, 120, 54, ORANGE);
  const onehot = icon(t, 'preprocess', 'onehot', 'OneHotEncoder', 535, 177, 110, 78);
  const joined = icon(t, 'preprocess', 'encoded', 'Concatenate features', 790, 128, 134, 96);
  const model = t.box('Fit classifier', 986, 148, 126, 56, GREEN);
  t.link(train, num); t.link(train, cat); t.chain([num, impute, scale]); t.chain([cat, catimp, onehot]);
  t.link(scale, joined); t.link(onehot, joined); t.link(joined, model);
  const test = icon(t, 'preprocess', 'columns', 'Held-out test rows', 0, 377, 130, 90);
  const apply = t.box('Transform only\nreuse fitted preprocessing', 394, 392, 230, 62, BLUE);
  const predict = t.box('Predict\nwith fitted classifier', 984, 392, 150, 62, GREEN);
  t.chain([test, apply, predict]);
  t.link(preprocessingGroup, apply, 'bottom', 'top', { dashed: true, label: 'fitted parameters' });
  t.link(model, predict, 'bottom', 'top', { dashed: true });
  note(t, 'Split rows before fitting any imputer, encoder or scaler. Unknown-category handling is fixed during training.', 0, 510, 1120);
  return t.done();
}

function nestedCv() {
  const t = new Builder(); title(t, 'Nested cross-validation: selection inside evaluation');
  const outer = icon(t, 'validation', 'nested', 'Outer folds', 0, 76, 160, 110, { count: 4 });
  t.group('Repeat for each outer split', 205, 0, 790, 350, { fill: '#F7FAFE', stroke: '#BDD0E5' });
  const train = t.box('Outer training rows', 235, 88, 148, 52, BLUE);
  const inner = icon(t, 'validation', 'stratified', 'Inner CV', 430, 65, 150, 98, { count: 3 });
  const search = t.box('Select hyperparameters\nby inner validation score', 633, 89, 185, 56, ORANGE, { fontSize: 11 });
  const refit = t.box('Refit selected pipeline\non outer training rows', 631, 222, 190, 58, GREEN, { fontSize: 11 });
  const held = t.box('Outer test rows', 235, 227, 148, 52, RED);
  const score = t.box('Outer test score', 864, 228, 112, 52, PURPLE, { fontSize: 11 });
  t.chain([outer, train, inner, search]); t.link(search, refit, 'bottom', 'top');
  t.link(outer, held, 'bottom', 'left');
  const trainTurn = t.anchor(309, 193), refitTurn = t.anchor(726, 193);
  t.link(train, trainTurn, 'bottom', 'top', { arrowEnd: false, routing: 'straight' });
  t.link(trainTurn, refitTurn, 'right', 'left', { arrowEnd: false, routing: 'straight' });
  t.link(refitTurn, refit, 'bottom', 'top', { routing: 'straight' }); t.link(refit, score);
  t.link(held, score, 'bottom', 'bottom');
  const aggregate = t.box('Aggregate outer scores\nmean and uncertainty', 612, 422, 224, 58, YELLOW);
  t.link(score, aggregate, 'bottom', 'right');
  note(t, 'The outer test folds never choose features or hyperparameters. Fit preprocessing inside every inner training fold.', 0, 510, 1000);
  return t.done();
}

function imbalance() {
  const t = new Builder(); title(t, 'Imbalanced classification with a validation-tuned threshold');
  const split = icon(t, 'validation', 'stratified', 'Stratified train / validation / test', 0, 146, 176, 120, { count: 3 });
  const train = t.box('Training rows', 236, 40, 130, 48, BLUE);
  const weighted = t.box('Class-weighted\nclassifier', 426, 32, 160, 64, ORANGE);
  const validation = t.box('Validation rows', 236, 165, 130, 48, YELLOW);
  const scores = t.box('Validation\nprobabilities', 434, 157, 146, 64, BLUE);
  const tune = t.box('Choose threshold $\\tau$\nfor the selected metric', 649, 159, 204, 60, PURPLE);
  const test = t.box('Untouched test rows', 236, 300, 150, 48, RED);
  const prob = t.box('Test probabilities', 434, 292, 146, 64, BLUE);
  const decision = t.box('$\\hat{y}=\\mathbf{1}[p\\geq\\tau]$', 659, 303, 176, 44, GREEN, { fontSize: 14 });
  const evaln = t.box('Test precision / recall\nand confusion matrix', 897, 291, 185, 64, WHITE);
  t.link(split, train); t.link(split, validation); t.link(split, test);
  t.link(train, weighted); t.link(validation, scores); t.link(weighted, scores, 'bottom', 'top', { dashed: true });
  t.link(scores, tune); t.link(test, prob); t.link(weighted, prob, 'right', 'top', { dashed: true, offset: 28 });
  t.link(prob, decision); t.link(tune, decision, 'bottom', 'top'); t.link(decision, evaln);
  note(t, 'Class weighting changes model fitting; threshold selection changes decisions. Do not select the threshold on the test set.', 0, 415, 1110);
  return t.done();
}

function gradientBoosting() {
  const t = new Builder(); title(t, 'Gradient boosting regression: fit the current residuals', 0, -108);
  const target = t.box('Targets $y_i$', 0, 28, 100, 42, WHITE);
  const start = t.box('$F_0(x)=\\bar{y}$', 0, 170, 130, 52, GRAY, { fontSize: 15 });
  t.link(target, start, 'bottom', 'top');
  let previous = start;
  for (let stage = 1; stage <= 3; stage++) {
    const x = 188 + (stage - 1) * 276;
    const residual = t.box(`$r_i^{(${stage})}=y_i-F_{${stage - 1}}(x_i)$`, x, 24, 222, 48, RED, { fontSize: 13 });
    const tree = t.icon('tree', '', x + 73, 112, 72, 60, GREEN);
    t.text(`$h_${stage}(x)$`, x + 152, 130, 65, 24, { fontSize: 14 });
    const update = t.box(`$F_${stage}=F_{${stage - 1}}+\\eta h_${stage}$`, x + 23, 234, 180, 46, BLUE, { fontSize: 15 });
    t.link(previous, residual, 'right', 'left');
    t.link(target, residual, 'top', 'top', { dashed: true, offset: -stage * 14 });
    t.link(residual, tree, 'bottom', 'top'); t.link(tree, update, 'bottom', 'top');
    t.link(previous, update, 'right', 'left'); previous = update;
  }
  const plot = icon(t, 'ensemble', 'gradient', 'Additive fitted function', 466, 371, 218, 126, { count: 3 });
  t.link(previous, plot, 'bottom', 'right');
  note(t, 'Squared-error loss: negative gradients equal residuals. Learning rate η controls each tree contribution.', 0, 553, 1030);
  return t.done();
}

function dbscan() {
  const t = new Builder(); title(t, 'DBSCAN: density-connected clusters and explicit noise');
  const input = t.icon('scatter', 'Feature vectors', 0, 124, 116, 94, BLUE);
  const scale = icon(t, 'scale', 'standard', 'Choose meaningful feature scales', 178, 117, 174, 98);
  const radius = t.box('ε-neighborhood\nNε(x)', 412, 132, 124, 62, BLUE);
  const core = t.add({ shape: 'diamond', label: '$|N_\\epsilon(x)|\\geq m$', x: 594, y: 115, w: 135, h: 92, ...WHITE, fontSize: 13 });
  const expand = t.box('Core point\nexpand density-connected set', 802, 52, 228, 66, GREEN);
  const border = t.box('Reachable from a core?\nBorder point or noise', 802, 220, 228, 66, ORANGE);
  const output = icon(t, 'density', 'dbscan', 'Clusters and noise', 439, 361, 196, 138, { count: 52 });
  t.chain([input, scale, radius, core]);
  t.link(core, expand, 'right', 'left', { label: 'yes', labelPos: 'above' });
  t.link(core, border, 'bottom', 'left', { label: 'no', labelPos: 'below' });
  t.link(expand, output, 'right', 'right', { offset: 35 }); t.link(border, output, 'bottom', 'right', { offset: 20 });
  note(t, 'ε is a distance radius; m includes the point itself. Border points do not expand a cluster; unreached points are noise.', 0, 550, 1100);
  return t.done();
}

function probabilityCalibration() {
  const t = new Builder(); title(t, 'Probability calibration with a separate calibration set');
  const train = t.box('Training data', 0, 48, 132, 48, BLUE);
  const estimator = t.box('Fit classifier', 198, 39, 154, 64, GREEN);
  const calibration = t.box('Calibration data\nnot used to fit classifier', 0, 186, 176, 66, ORANGE, { fontSize: 11 });
  const raw = t.box('Raw scores\non calibration rows', 235, 185, 158, 66, BLUE);
  const map = icon(t, 'calibration', 'isotonic', 'Fit monotone score → probability map', 481, 158, 194, 122, { count: 8, fontSize: 10, labelPos: 'above' });
  const test = t.box('Untouched test rows', 0, 385, 176, 54, RED);
  const predict = t.box('Apply classifier', 235, 379, 158, 64, GREEN);
  const apply = t.box('Apply fitted\ncalibration map', 490, 379, 177, 64, PURPLE);
  const reliability = icon(t, 'calibration', 'reliable', 'Test reliability diagram', 753, 345, 198, 136, { count: 8 });
  t.link(train, estimator); t.link(calibration, raw); t.link(estimator, raw, 'bottom', 'top', { dashed: true });
  t.link(raw, map); t.chain([test, predict, apply, reliability]);
  t.link(estimator, predict, 'right', 'top', { dashed: true, offset: 30 }); t.link(map, apply, 'bottom', 'top', { dashed: true });
  note(t, 'The calibration set fits the probability map; test labels are used only for final evaluation. Isotonic regression needs enough calibration data.', 0, 540, 1020);
  return t.done();
}

function conformal() {
  const t = new Builder(); title(t, 'Split conformal regression: finite-sample marginal coverage');
  const train = t.box('Training split', 0, 34, 140, 48, BLUE);
  const fit = t.box('Fit regressor $\\hat{f}$', 208, 26, 164, 64, GREEN, { fontSize: 14 });
  const calibration = t.box('Calibration split', 0, 183, 140, 48, ORANGE);
  const scores = icon(t, 'uncertainty', 'scores', '$s_i=|y_i-\\hat{f}(x_i)|$', 215, 145, 185, 115, { count: 10, fontSize: 13 });
  const quantile = t.box('$k=\\lceil(n_{cal}+1)(1-\\alpha)\\rceil$\n$q=s_{(k)}$', 480, 170, 281, 75, YELLOW, { fontSize: 14 });
  const test = t.box('New input $x$', 0, 370, 140, 52, RED, { fontSize: 14 });
  const point = t.box('Prediction $\\hat{f}(x)$', 226, 364, 173, 64, BLUE, { fontSize: 14 });
  const interval = t.box('$[\\hat{f}(x)-q,\\hat{f}(x)+q]$', 480, 364, 281, 64, PURPLE, { fontSize: 17 });
  const result = icon(t, 'uncertainty', 'intervals', 'Prediction intervals', 842, 326, 194, 132, { count: 8 });
  t.link(train, fit); t.link(calibration, scores); t.link(fit, scores, 'bottom', 'top', { dashed: true });
  t.link(scores, quantile); t.chain([test, point, interval, result]);
  t.link(fit, point, 'right', 'top', { dashed: true, offset: 24 }); t.link(quantile, interval, 'bottom', 'top');
  note(t, 'Exchangeable calibration/test samples give marginal coverage ≥ 1-α. If k exceeds n_cal, use q=∞. Conditional coverage is not guaranteed.', 0, 516, 1100);
  return t.done();
}

function rfecv() {
  const t = new Builder(); title(t, 'Recursive feature elimination with internal cross-validation');
  const train = icon(t, 'preprocess', 'encoded', 'Training features', 0, 82, 134, 90);
  t.group('Feature selection uses training rows only', 206, 0, 650, 311, { fill: '#F8FAFD', stroke: '#BDCCE0' });
  const cv = icon(t, 'validation', 'group', 'Training / validation folds', 232, 74, 164, 106, { count: 4 });
  const subset = icon(t, 'select', 'rfe', 'RFE inside training fold', 443, 75, 158, 115, { count: 8 });
  const score = t.box('Validation score\nfor each subset size', 655, 92, 166, 64, ORANGE);
  const select = t.box('Choose subset size\nfrom CV scores', 453, 243, 193, 49, PURPLE);
  const refit = t.box('Refit selection + model\non all training rows', 236, 386, 200, 64, GREEN);
  const test = t.box('Held-out test data', 0, 392, 156, 52, RED);
  const transform = t.box('Keep selected columns\nthen predict', 495, 386, 200, 64, BLUE);
  const evaluate = t.box('Final test score', 761, 397, 142, 42, YELLOW);
  t.chain([train, cv, subset, score]); t.link(score, select, 'bottom', 'right'); t.link(select, refit, 'bottom', 'top');
  t.link(train, refit, 'right', 'left', { dashed: true }); t.link(refit, transform); t.link(test, transform, 'bottom', 'bottom'); t.link(transform, evaluate);
  note(t, 'Fit ranking and elimination separately inside each training fold. Group CV is useful when rows share a subject or institution.', 0, 514, 1000);
  return t.done();
}

const T = (id: string, name: string, build: TemplateDef['build']): TemplateDef => ({ id: `mlx-${id}`, name, section: 'Machine learning', build });
export const MLX_TEMPLATES: TemplateDef[] = [
  T('column-transformer', 'Preprocessing numerico e categorico', columnTransformer),
  T('nested-evaluation', 'Valutazione con CV annidata', nestedCv),
  T('imbalanced-threshold', 'Classi sbilanciate e soglia validata', imbalance),
  T('gradient-boosting', 'Gradient boosting sui residui', gradientBoosting),
  T('dbscan-workflow', 'Clustering DBSCAN: core, bordo e rumore', dbscan),
  T('heldout-calibration', 'Calibrazione su dati separati', probabilityCalibration),
  T('split-conformal', 'Intervalli split conformal', conformal),
  T('rfecv-workflow', 'Selezione feature con RFECV', rfecv),
];
