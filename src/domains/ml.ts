// Modulo di dominio: machine learning classico. Forme parametriche (ml-plots.ts, ml-blocks.ts),
// blocchi della libreria (qui sotto) e modelli completi (ml-templates.ts).
// Vedi src/registry.ts per l'API e src/domains/README.md per le convenzioni.
import { COLORS, ICON, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { BLOCK_SHAPES } from './ml-blocks';
import { PLOT_SHAPES } from './ml-plots';
import { ML_TEMPLATES } from './ml-templates';

const { BLUE, GREEN, PURPLE, YELLOW, WHITE } = COLORS;

/** Grafico da paper: pannello bianco con bordo grigio chiaro, titolo sotto. */
const PLOT = { ...ICON, fill: '#FFFFFF', stroke: '#C9CED6', strokeWidth: 1, radius: 3 };
const G = 'Grafici ML';
const C = 'ML classico';

const plot = (id: string, name: string, shape: string, label: string, extra: Preset['node'] = {}): Preset => ({
  id,
  name,
  category: G,
  node: { shape, label, w: 100, h: 86, ...PLOT, ...extra },
});

registerShapes([...PLOT_SHAPES, ...BLOCK_SHAPES]);

registerPresets([
  // ---------- blocchi dei diagrammi ----------
  { id: 'ml-table', name: 'Dataset tabellare', category: C, node: { shape: 'ml-table', label: 'Dataset', w: 110, h: 76, spec: '5x5 y', strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'ml-table-plain', name: 'Tabella', category: C, node: { shape: 'ml-table', label: 'Features', w: 96, h: 76, spec: '5x4', strokeWidth: 1.2, ...ICON, ...WHITE, stroke: '#666666' } },
  { id: 'ml-split', name: 'Train/val/test', category: C, node: { shape: 'ml-split', label: 'Train / Val / Test', w: 180, h: 22, spec: '70,15,15', radius: 3, strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'ml-kfold', name: 'K-fold CV', category: C, node: { shape: 'ml-kfold', label: '5-fold cross-validation', w: 150, h: 90, count: 5, strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'ml-kfold-test', name: 'K-fold + test', category: C, node: { shape: 'ml-kfold', label: 'CV + hold-out test', w: 170, h: 90, count: 5, spec: 'test', strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'ml-kfold-time', name: 'Time series split', category: C, node: { shape: 'ml-kfold', label: 'Time series split', w: 150, h: 76, count: 4, spec: 'time', strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'ml-forest', name: 'Random forest', category: C, node: { shape: 'ml-forest', label: 'Random forest', w: 150, h: 70, count: 3, strokeWidth: 1.2, ...ICON, ...GREEN } },
  { id: 'ml-dendrogram', name: 'Dendrogramma', category: C, node: { shape: 'ml-dendrogram', label: 'Hierarchical clustering', w: 130, h: 80, count: 10, ...ICON, ...WHITE } },
  { id: 'ml-split-node', name: 'Nodo di split', category: C, node: { label: '$x_1 \\leq 0.5$', w: 90, h: 34, radius: 6, fontSize: 13, strokeWidth: 1.2, ...WHITE } },
  { id: 'ml-leaf', name: 'Foglia', category: C, node: { shape: 'pill', label: 'Class A', w: 80, h: 30, fontSize: 12, strokeWidth: 1.2, ...BLUE } },
  { id: 'ml-vote', name: 'Voto di maggioranza', category: C, node: { label: 'Majority vote', w: 110, h: 40, fontSize: 12, strokeWidth: 1.2, ...YELLOW } },
  // ---------- grafici ----------
  plot('ml-svm', 'SVM', 'ml-svm', 'SVM (max margin)'),
  plot('ml-boundary', 'Frontiera decisione', 'ml-boundary', 'Decision boundary'),
  plot('ml-boundary-linear', 'Frontiera lineare', 'ml-boundary', 'Linear (underfit)', { spec: 'linear' }),
  plot('ml-boundary-over', 'Frontiera overfit', 'ml-boundary', 'Overfit', { spec: 'over' }),
  plot('ml-boundary-circle', 'Frontiera circolare', 'ml-boundary', 'RBF kernel', { spec: 'circle' }),
  plot('ml-rings', 'Classi concentriche', 'ml-boundary', 'Input space', { spec: 'rings' }),
  plot('ml-kmeans', 'k-means', 'ml-kmeans', 'k-means ($k = 3$)', { count: 3 }),
  plot('ml-kmeans-voronoi', 'k-means + Voronoi', 'ml-kmeans', 'k-means ($k = 4$)', { count: 4, spec: 'voronoi' }),
  plot('ml-pca', 'PCA', 'ml-pca', 'PCA'),
  plot('ml-pca-proj', 'PCA (proiezione)', 'ml-pca', 'Projection on PC1', { spec: 'proj' }),
  plot('ml-gmm', 'GMM', 'ml-gmm', 'Gaussian mixture', { count: 3 }),
  plot('ml-knn', 'kNN', 'ml-knn', '$k$-NN ($k = 5$)', { count: 5 }),
  plot('ml-linreg', 'Regressione lineare', 'ml-regression', 'Linear regression', { count: 14 }),
  plot('ml-underfit', 'Underfitting', 'ml-regression', 'Underfitting ($M = 1$)', { spec: 'under' }),
  plot('ml-goodfit', 'Buon fit', 'ml-regression', 'Good fit ($M = 3$)', { spec: 'good' }),
  plot('ml-overfit', 'Overfitting', 'ml-regression', 'Overfitting ($M = 9$)', { spec: 'over' }),
  plot('ml-logistic', 'Logistica', 'ml-logistic', 'Logistic regression'),
  plot('ml-partition', 'Partizione albero', 'ml-partition', 'Tree partition'),
  plot('ml-stump', 'AdaBoost (round)', 'ml-stump', 'Weak learner $h_1$', { count: 1 }),
  plot('ml-lift', 'Kernel trick 3D', 'ml-lift', 'Feature space $\\phi(x)$', { w: 120, h: 100 }),
  plot('ml-roc', 'ROC', 'ml-roc', 'ROC curve', { count: 1, w: 90, h: 90 }),
  plot('ml-roc-multi', 'ROC (confronto)', 'ml-roc', 'ROC curves', { count: 3, w: 90, h: 90 }),
  plot('ml-roc-step', 'ROC empirica', 'ml-roc', 'Empirical ROC', { count: 1, spec: 'step', w: 90, h: 90 }),
  plot('ml-pr', 'Precision–recall', 'ml-pr', 'Precision–recall', { count: 1, w: 90, h: 90 }),
  plot('ml-threshold', 'Soglia di decisione', 'ml-threshold', 'Decision threshold', { w: 120, h: 70 }),
  plot('ml-learning', 'Learning curve', 'ml-learning', 'Learning curve'),
  plot('ml-loss-epochs', 'Train vs val loss', 'ml-learning', 'Early stopping', { spec: 'epochs' }),
  plot('ml-biasvar', 'Bias–varianza', 'ml-biasvar', 'Bias–variance trade-off', { w: 110 }),
  plot('ml-traintest', 'Errore train/test', 'ml-biasvar', 'Model complexity', { spec: 'error', w: 110 }),
  plot('ml-elbow', 'Metodo del gomito', 'ml-elbow', 'Elbow method', { count: 9 }),
  plot('ml-gridsearch', 'Grid search', 'ml-search', 'Grid search', { w: 100, h: 100 }),
  plot('ml-randsearch', 'Random search', 'ml-search', 'Random search', { spec: 'random', w: 100, h: 100 }),
  { id: 'ml-importance', name: 'Importanza feature', category: G, node: { shape: 'ml-importance', label: 'Feature importance', w: 110, h: 80, count: 6, strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'ml-scree', name: 'Scree plot', category: G, node: { shape: 'ml-scree', label: 'Explained variance', w: 110, h: 76, count: 6, strokeWidth: 1.2, ...ICON, ...PURPLE } },
]);

registerTemplates(ML_TEMPLATES);
