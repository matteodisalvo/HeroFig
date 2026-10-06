// ML classico: preparazione, validazione, diagnostica e incertezza.
// Modulo autonomo: importarlo una volta in domains/index.ts.
import { ICON, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { MLX_SHAPES } from './ml_extra-shapes';
import { MLX_TEMPLATES } from './ml_extra-templates';

const B = 'ML classico', G = 'Grafici ML';
const entry = (id: string, name: string, family: string, spec: string, label: string, category = B, extra: Preset['node'] = {}): Preset => ({
  id: `mlx-${id}`, name, category,
  node: { shape: `mlx-${family}`, spec, label, w: 124, h: 92, count: 5, ...ICON, fill: '#FFFFFF', stroke: '#BAC5D3', strokeWidth: 1, radius: 3, ...extra },
});

export const MLX_PRESETS: Preset[] = [
  entry('missing', 'Valori mancanti', 'preprocess', 'missing', 'Missing values'),
  entry('imputed', 'Imputazione mediana', 'preprocess', 'imputed', 'Median imputation'),
  entry('onehot', 'Codifica one-hot', 'preprocess', 'onehot', 'One-hot encoding'),
  entry('ordinal', 'Codifica ordinale', 'preprocess', 'ordinal', 'Ordinal encoding', B, { w: 86 }),
  entry('indicator', 'Indicatori dati mancanti', 'preprocess', 'indicator', 'Missing indicators'),
  entry('columns', 'Colonne numeriche e categoriche', 'preprocess', 'columns', 'ColumnTransformer', B, { w: 148 }),
  entry('standard', 'Standardizzazione feature', 'scale', 'standard', 'Standard scaling', B, { w: 160, h: 86 }),
  entry('robust', 'Scala robusta mediana/IQR', 'scale', 'robust', 'Robust scaling', B, { w: 160, h: 86 }),
  entry('quantile-transform', 'Trasformazione a quantili', 'scale', 'quantile', 'Quantile transform', B, { w: 160, h: 86 }),
  entry('power-transform', 'Trasformazione di potenza', 'scale', 'power', 'Power transform', B, { w: 160, h: 86 }),
  entry('variance-select', 'Filtro per varianza', 'select', 'variance', 'Variance selection'),
  entry('correlation-select', 'Feature correlate', 'select', 'correlation', 'Correlated features', G, { w: 100, h: 100 }),
  entry('rfe', 'Eliminazione ricorsiva feature', 'select', 'rfe', 'Recursive feature elimination', B, { w: 164, count: 8 }),
  entry('permutation', 'Importanza per permutazione', 'select', 'permutation', 'Permutation importance', G, { count: 7 }),
  entry('group-cv', 'Cross-validation per gruppi', 'validation', 'group', 'Group cross-validation', B, { w: 164, h: 88, count: 4 }),
  entry('stratified-cv', 'Cross-validation stratificata', 'validation', 'stratified', 'Stratified cross-validation', B, { w: 164, h: 88, count: 4 }),
  entry('nested-cv', 'Cross-validation annidata', 'validation', 'nested', 'Nested cross-validation', B, { w: 164, h: 88, count: 4 }),
  entry('bootstrap', 'Campionamento bootstrap', 'validation', 'bootstrap', 'Bootstrap sample', B, { w: 146, h: 72 }),
  entry('oob', 'Campioni out-of-bag', 'validation', 'oob', 'Out-of-bag samples', B, { w: 146, h: 72 }),
  entry('residuals', 'Residui contro predizioni', 'diagnostics', 'residual', 'Residual diagnostics', G, { count: 24 }),
  entry('heteroscedastic', 'Residui eteroschedastici', 'diagnostics', 'hetero', 'Heteroscedasticity', G, { count: 24 }),
  entry('qq', 'Grafico Q-Q dei residui', 'diagnostics', 'qq', 'Normal Q-Q plot', G, { count: 16 }),
  entry('quantile-regression', 'Regressione quantile', 'diagnostics', 'quantile', 'Quantile regression', G, { count: 22 }),
  entry('lda', 'Analisi discriminante lineare', 'discriminant', 'lda', 'Linear discriminant analysis', G, { count: 26, w: 144, h: 100 }),
  entry('qda', 'Analisi discriminante quadratica', 'discriminant', 'qda', 'Quadratic discriminant analysis', G, { count: 26, w: 144, h: 100 }),
  entry('naive-bayes', 'Indipendenza in Naive Bayes', 'discriminant', 'naive', 'Naive Bayes', B, { w: 122, h: 80 }),
  entry('svr', 'Tubo epsilon SVR', 'discriminant', 'svr', '$\\epsilon$-insensitive regression', G, { count: 22, w: 144, h: 100 }),
  entry('dbscan', 'DBSCAN e punti rumore', 'density', 'dbscan', 'DBSCAN', G, { count: 48, w: 134, h: 100 }),
  entry('optics-reachability', 'Reachability OPTICS', 'density', 'reachability', 'OPTICS reachability', G, { count: 48, w: 154, h: 100 }),
  entry('spectral-graph', 'Grafo di affinità spettrale', 'density', 'spectral', 'Spectral affinity graph', G, { count: 38, w: 134, h: 100 }),
  entry('mean-shift', 'Spostamento verso i modi', 'density', 'meanshift', 'Mean shift', G, { count: 34, w: 134, h: 100 }),
  entry('reliability', 'Diagramma di affidabilità', 'calibration', 'reliable', 'Reliability diagram', G, { count: 8, w: 144, h: 110 }),
  entry('overconfident', 'Probabilità sovraconfidenti', 'calibration', 'over', 'Overconfident probabilities', G, { count: 8, w: 144, h: 110 }),
  entry('underconfident', 'Probabilità sottoconfidenti', 'calibration', 'under', 'Underconfident probabilities', G, { count: 8, w: 144, h: 110 }),
  entry('isotonic', 'Mappa di calibrazione isotonica', 'calibration', 'isotonic', 'Isotonic calibration', G, { count: 8, w: 144, h: 110 }),
  entry('prediction-intervals', 'Intervalli di predizione', 'uncertainty', 'intervals', 'Prediction intervals', G, { count: 8, w: 150, h: 110 }),
  entry('prediction-sets', 'Set di classi predetti', 'uncertainty', 'set', 'Conformal prediction sets', B, { w: 126, h: 86 }),
  entry('coverage', 'Copertura degli intervalli', 'uncertainty', 'coverage', 'Empirical interval coverage', G, { count: 8, w: 150, h: 110 }),
  entry('conformal-scores', 'Score di calibrazione conformale', 'uncertainty', 'scores', 'Conformal calibration scores', G, { count: 10, w: 154, h: 110 }),
  entry('gradient-stages', 'Stadi del gradient boosting', 'ensemble', 'gradient', 'Gradient boosting stages', G, { count: 4, w: 150, h: 100 }),
  entry('soft-vote', 'Media delle probabilità', 'ensemble', 'softvote', 'Soft voting', B, { count: 3, w: 150, h: 88 }),
  entry('ensemble-weights', 'Pesi dei modelli ensemble', 'ensemble', 'weights', 'Ensemble weights', B, { count: 4, w: 138, h: 86 }),
  entry('ensemble-diversity', 'Diversità degli errori ensemble', 'ensemble', 'diversity', 'Model error diversity', G, { count: 5, w: 112, h: 96 }),
];

registerShapes(MLX_SHAPES);
registerPresets(MLX_PRESETS);
registerTemplates(MLX_TEMPLATES);
