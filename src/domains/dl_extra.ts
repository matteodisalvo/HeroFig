// Estensione DL: training, SSM, adapter e routing; graph pooling e operator learning.
// Fonti e controlli: output/library-expansion/dl-notes.md. Nessuna modifica a icone approvate/pending.
import { COLORS, ICON, type NodeModel, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { DL_EXTRA_SHAPES } from './dl_extra-shapes';
import { DL_EXTRA_TEMPLATES } from './dl_extra-templates';

const { BLUE, GREEN, ORANGE, PURPLE, TEAL, RED, YELLOW } = COLORS;
const DL = 'Deep learning', GL = 'Graph learning', SCI = 'Scientific ML';
const p = (id: string, name: string, category: string, shape: string, spec: string, label: string, w: number, h: number, count: number, color = BLUE): Preset => ({ id, name, category, node: { shape, spec, label, w, h, count, ...ICON, strokeWidth: 1.2, ...color } });
const formula = (id: string, name: string, category: string, label: string, sublabel: string, w: number, h = 64): Preset => ({ id, name, category, node: { label, sublabel, w, h, fill: '#FAFBFD', stroke: '#B8C4D2', radius: 9, fontSize: 11, bold: true, subSize: 13 } });

export const DL_EXTRA_PRESETS: Preset[] = [
  p('dlex-gradient-state', 'Tensore dei gradienti', DL, 'dlex-optimizer', 'gradient', '$g_t$', 142, 72, 6),
  p('dlex-first-moment', 'Primo momento (Adam)', DL, 'dlex-optimizer', 'first', 'Gradient + first moment', 142, 78, 6, GREEN),
  p('dlex-second-moment', 'Secondo momento (Adam)', DL, 'dlex-optimizer', 'second', 'Squared gradient + second moment', 142, 78, 6, ORANGE),
  p('dlex-optimizer-state', 'Pesi e stati AdamW', DL, 'dlex-optimizer', 'adamw', 'Optimizer state', 142, 100, 6, PURPLE),
  p('dlex-accumulate', 'Accumulo dei gradienti', DL, 'dlex-gradients', 'sum', 'Gradient accumulation', 152, 100, 4, GREEN),
  p('dlex-gradmean', 'Media dei microbatch', DL, 'dlex-gradients', 'mean', 'Mean gradient', 152, 100, 4, BLUE),
  p('dlex-allreduce', 'All-reduce dei gradienti', DL, 'dlex-gradients', 'allreduce', 'All-reduce', 126, 110, 4, TEAL),
  p('dlex-gradclip', 'Clipping della norma', DL, 'dlex-gradients', 'clip', 'Gradient clipping', 134, 100, 3, RED),
  p('dlex-activations-all', 'Attivazioni in memoria', DL, 'dlex-checkpoint', 'all', 'Stored activations', 220, 76, 8),
  p('dlex-activation-checkpoints', 'Checkpoint delle attivazioni', DL, 'dlex-checkpoint', 'sparse', 'Activation checkpoints', 220, 76, 8, GREEN),
  p('dlex-recompute', 'Ricalcolo delle attivazioni', DL, 'dlex-checkpoint', 'recompute', 'Recompute on backward', 220, 92, 8, ORANGE),
  p('dlex-ssm-recurrent', 'SSM: ricorrenza', DL, 'dlex-state', 'recurrent', 'State-space recurrence', 224, 94, 4, GREEN),
  p('dlex-ssm-selective', 'SSM: selezione dipendente dai dati', DL, 'dlex-state', 'selective', 'Input-dependent state update', 224, 104, 4, ORANGE),
  p('dlex-ssm-scan', 'SSM: scan associativo', DL, 'dlex-state', 'scan', 'Parallel scan', 224, 112, 4, TEAL),
  p('dlex-ssm-kernel', 'SSM lineare: kernel causale', DL, 'dlex-state', 'convolution', 'LTI convolution kernel', 155, 112, 6, BLUE),
  p('dlex-adapter-serial', 'Adapter: bottleneck seriale', DL, 'dlex-adapter', 'serial', 'Bottleneck adapter', 202, 94, 3, BLUE),
  p('dlex-adapter-parallel', 'Adapter: ramo parallelo', DL, 'dlex-adapter', 'parallel', 'Parallel adapter', 202, 106, 3, GREEN),
  p('dlex-ia3', 'IA3: riscalamento delle feature', DL, 'dlex-adapter', 'gate', 'Learned activation scaling', 184, 84, 3, ORANGE),
  p('dlex-lowrank-matrices', 'LoRA: matrici a rango ridotto', DL, 'dlex-adapter', 'lowrank', '$W = W_0 + BA$', 188, 106, 2, PURPLE),
  p('dlex-dispatch-top1', 'Dispatch MoE top-1', DL, 'dlex-dispatch', 'top1', 'Top-1 token dispatch', 176, 118, 3, BLUE),
  p('dlex-dispatch-top2', 'Dispatch MoE top-2', DL, 'dlex-dispatch', 'top2', 'Top-2 token dispatch', 176, 118, 3, PURPLE),
  p('dlex-expert-overflow', 'MoE: token oltre capacità', DL, 'dlex-dispatch', 'capacity', 'Expert capacity overflow', 176, 118, 3, RED),
  p('dlex-expert-load', 'MoE: carico degli esperti', DL, 'dlex-dispatch', 'load', 'Expert load / capacity', 160, 106, 4, GREEN),
  p('dlex-fp-cast', 'Cast per training misto', DL, 'dlex-precision', 'cast', 'FP32 / FP16 tensors', 166, 94, 5, BLUE),
  p('dlex-master-weights', 'Master weights FP32', DL, 'dlex-precision', 'master', 'Master weights + compute copy', 166, 108, 5, GREEN),
  p('dlex-loss-scaling', 'Loss scaling e unscale', DL, 'dlex-precision', 'scale', 'Loss scaling', 212, 110, 5, YELLOW),
  p('glex-bipartite', 'Grafo bipartito', GL, 'dlex-graph', 'bipartite', 'Bipartite graph', 138, 116, 8, BLUE),
  p('glex-heterogeneous', 'Grafo con tipi di nodi e archi', GL, 'dlex-graph', 'typed', 'Heterogeneous graph', 138, 116, 8, PURPLE),
  p('glex-hypergraph', 'Ipergrafo', GL, 'dlex-graph', 'hyper', 'Hyperedges', 138, 116, 7, GREEN),
  p('glex-edge-features', 'Feature sugli archi', GL, 'dlex-graph', 'edgefeat', 'Edge attributes', 138, 116, 6, ORANGE),
  p('glex-coarsening', 'Coarsening gerarchico', GL, 'dlex-pooling', 'pool', 'Graph coarsening', 180, 114, 3, BLUE),
  p('glex-soft-assignment', 'Matrice di assegnazione soft', GL, 'dlex-pooling', 'assignment', 'Soft assignment $S$', 112, 132, 3, PURPLE),
  p('glex-unpool', 'Unpooling sul grafo', GL, 'dlex-pooling', 'unpool', 'Graph unpooling', 180, 114, 3, TEAL),
  p('sciex-interior', 'Collocazione: punti interni', SCI, 'dlex-collocation', 'interior', 'Interior residual points', 140, 114, 28, BLUE),
  p('sciex-boundary', 'Collocazione: bordi spaziali', SCI, 'dlex-collocation', 'boundary', 'Boundary condition points', 140, 114, 18, RED),
  p('sciex-initial', 'Collocazione: tempo iniziale', SCI, 'dlex-collocation', 'initial', 'Initial condition points', 140, 114, 12, GREEN),
  p('sciex-adaptive', 'Collocazione: raffinamento locale', SCI, 'dlex-collocation', 'adaptive', 'Locally refined sampling', 140, 114, 38, ORANGE),
  p('sciex-function-sensors', 'Sensori della funzione di ingresso', SCI, 'dlex-operator', 'sensors', 'Function samples $u(x_i)$', 172, 100, 7, BLUE),
  p('sciex-query-coordinates', 'Coordinate di query dell’operatore', SCI, 'dlex-operator', 'coordinates', 'Output query locations', 124, 108, 7, PURPLE),
  p('sciex-operator-basis', 'Base del trunk network', SCI, 'dlex-operator', 'basis', 'Trunk basis functions', 172, 100, 4, TEAL),
  formula('dlex-adam-bias', 'Correzione del bias dei momenti', DL, 'Bias-corrected moments', '$\\hat{m}_t = m_t / (1-\\beta_1^t),\\hat{v}_t = v_t / (1-\\beta_2^t)$', 326),
  formula('dlex-adamw-update', 'Aggiornamento AdamW', DL, 'Decoupled weight decay', '$\\theta_{t+1} = (1-\\eta\\lambda)\\theta_t - \\eta\\frac{\\hat{m}_t}{\\sqrt{\\hat{v}_t}+\\epsilon}$', 336, 74),
  formula('dlex-clip-formula', 'Clipping globale del gradiente', DL, 'Global-norm clipping', '$g \\leftarrow g\\,\\min(1, c/\\|g\\|_2)$', 244),
  formula('sciex-deeponet-expansion', 'Espansione branch × trunk', SCI, 'DeepONet expansion', '$G_\\theta(u)(y) = \\sum_{k=1}^{p} b_k(u(x_1),\\ldots,u(x_m))\\,t_k(y)$', 372, 76),
];

// Accesso ai nodi dei preset per i modelli: conserva stile, dimensioni e label editabili.
export function dlExtraNode(id: string): Partial<NodeModel> {
  const preset = DL_EXTRA_PRESETS.find(preset => preset.id === id);
  if (!preset) throw new Error(`Blocco DL extra inesistente: ${id}`);
  return { ...preset.node };
}

registerShapes(DL_EXTRA_SHAPES);
registerPresets(DL_EXTRA_PRESETS);
registerTemplates(DL_EXTRA_TEMPLATES);
