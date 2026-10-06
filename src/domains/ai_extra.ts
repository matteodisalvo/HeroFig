// Useful workflow components beyond the existing core NLP/RL/CV/generative library.
import { COLORS, ICON, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { AI_EXTRA_SHAPES } from './ai_extra-shapes';
import { AI_EXTRA_TEMPLATES } from './ai_extra-templates';

const { BLUE, GREEN, ORANGE, YELLOW, PURPLE, TEAL } = COLORS;
type Color = { fill: string; stroke: string };
const preset = (id: string, name: string, category: string, shape: string, spec: string, label: string, color: Color, count = 4, w = 160, h = 100): Preset => ({
  id: `aix-${id}`, name, category,
  node: { shape: `aix-${shape}`, spec, label, count, w, h, ...ICON, fontSize: 11, strokeWidth: 1.2, ...color },
});
const NLP = 'NLP & LLM', RL = 'Reinforcement learning', CV = 'Computer vision', PR = 'Pattern recognition', GEN = 'Generative AI';

export const AI_EXTRA_PRESETS: Preset[] = [
  preset('doc-layout', 'Layout del documento', NLP, 'document', 'layout', 'Document layout', BLUE, 4, 100, 120),
  preset('reading-order', 'Ordine di lettura', NLP, 'document', 'order', 'Reading order', BLUE, 4, 100, 120),
  preset('table-extract', 'Tabella strutturata', NLP, 'document', 'table', 'Table extraction', TEAL, 5, 110, 120),
  preset('citations', 'Citazioni alle fonti', NLP, 'document', 'citations', 'Source citations', GREEN, 5, 110, 120),
  preset('sparse-rank', 'Ranking lessicale', NLP, 'ranking', 'sparse', 'Lexical retrieval', BLUE, 5),
  preset('dense-rank', 'Ranking semantico', NLP, 'ranking', 'dense', 'Dense retrieval', PURPLE, 5),
  preset('rerank', 'Reranking dei documenti', NLP, 'ranking', 'rerank', 'Cross-encoder reranking', ORANGE, 5, 180),
  preset('rank-fusion', 'Fusione dei ranking RRF', NLP, 'ranking', 'fusion', 'Reciprocal rank fusion', BLUE, 4, 180, 110),
  preset('chunk-overlap', 'Chunk sovrapposti', NLP, 'context', 'overlap', 'Overlapping chunks', BLUE, 5, 190, 95),
  preset('context-budget', 'Budget del contesto', NLP, 'context', 'packed', 'Context packing', PURPLE, 5),
  preset('evidence-spans', 'Passaggi rilevanti', NLP, 'context', 'evidence', 'Evidence selection', YELLOW, 6),

  preset('bandit-ucb', 'Bandit: upper confidence bound', RL, 'bandit', 'ucb', 'Upper confidence bound', BLUE, 4),
  preset('bandit-thompson', 'Bandit: Thompson sampling', RL, 'bandit', 'thompson', 'Thompson sampling', PURPLE, 4),
  preset('bandit-epsilon', 'Bandit: esplorazione epsilon', RL, 'bandit', 'epsilon', 'Epsilon-greedy exploration', BLUE, 4),
  preset('rollout', 'Rollout ordinato', RL, 'trajectory', 'rollout', 'On-policy rollout', TEAL, 5, 220, 95),
  preset('time-limit', 'Troncamento temporale', RL, 'trajectory', 'truncated', 'Time-limit truncation', BLUE, 5, 220, 95),
  preset('nstep-return', 'Ritorno n-step', RL, 'trajectory', 'nstep', 'n-step return', PURPLE, 5, 220, 100),
  preset('return-distribution', 'Distribuzione del return', RL, 'distribution', 'return', 'Categorical return distribution', BLUE, 11),
  preset('categorical-projection', 'Proiezione C51', RL, 'distribution', 'projection', 'Categorical Bellman projection', PURPLE, 11),
  preset('policy-entropy', 'Entropia della policy', RL, 'distribution', 'entropy', 'Policy entropy', BLUE, 6),

  preset('iou', 'Intersezione su unione', CV, 'detection', 'iou', 'Intersection over union', PURPLE, 3, 125, 105),
  preset('nms', 'Soppressione NMS', CV, 'detection', 'nms', 'Non-maximum suppression', GREEN, 4, 125, 105),
  preset('soft-nms', 'Riduzione score Soft-NMS', CV, 'detection', 'soft', 'Soft-NMS', GREEN, 4, 125, 105),
  preset('oriented-box', 'Bounding box orientato', CV, 'detection', 'rotated', 'Oriented bounding box', ORANGE, 3, 125, 105),
  preset('feature-matches', 'Corrispondenze tra immagini', CV, 'matching', 'matches', 'Local feature matching', BLUE, 5, 190, 105),
  preset('stereo-disparity', 'Disparità stereo', CV, 'matching', 'stereo', 'Rectified stereo disparity', BLUE, 5, 190, 105),
  preset('ransac-inliers', 'Inlier e outlier RANSAC', CV, 'matching', 'ransac', 'Geometric verification', BLUE, 6, 190, 105),
  preset('cutmix', 'Augmentazione CutMix', CV, 'augment', 'cutmix', 'CutMix', BLUE, 4, 200, 95),
  preset('mixup', 'Augmentazione MixUp', CV, 'augment', 'mixup', 'MixUp', BLUE, 4, 200, 95),
  preset('open-set', 'Rifiuto open-set', PR, 'retrieval', 'reject', 'Distance-based rejection', BLUE, 6),
  preset('gallery-search', 'Ricerca nella galleria', PR, 'retrieval', 'gallery', 'Visual similarity search', BLUE, 6, 175, 105),

  preset('inpaint-mask', 'Maschera di inpainting', GEN, 'mask', 'inpaint', 'Inpainting mask', BLUE, 8, 125, 110),
  preset('outpaint-mask', 'Maschera di outpainting', GEN, 'mask', 'outpaint', 'Outpainting canvas', BLUE, 8, 125, 110),
  preset('known-region', 'Regione nota da preservare', GEN, 'mask', 'known', 'Known image region', BLUE, 8, 125, 110),
  preset('guidance-vectors', 'Vettori classifier-free guidance', GEN, 'guidance', 'vectors', 'Conditional guidance geometry', PURPLE, 5),
  preset('noise-schedule', 'Schedule del rumore', GEN, 'guidance', 'schedule', 'Signal retention schedule', BLUE, 6),
  preset('sampling-grid', 'Passi del campionatore', GEN, 'guidance', 'timesteps', 'Reverse-time sampling grid', PURPLE, 9),
  preset('video-motion', 'Coerenza tra fotogrammi', GEN, 'video', 'clean', 'Temporal consistency', BLUE, 4, 210, 95),
  preset('noisy-video', 'Video nello spazio del rumore', GEN, 'video', 'noise', 'Noisy video sample', PURPLE, 4, 210, 95),
  preset('video-keyframe', 'Generazione da keyframe', GEN, 'video', 'keyframe', 'Keyframe-conditioned generation', BLUE, 4, 210, 95),
];

registerShapes(AI_EXTRA_SHAPES);
registerPresets(AI_EXTRA_PRESETS);
registerTemplates(AI_EXTRA_TEMPLATES);
