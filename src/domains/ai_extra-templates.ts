import { Builder, type Color } from '../builder';
import { COLORS, type NodeModel } from '../model';
import type { TemplateDef } from '../registry';

const { BLUE, GREEN, ORANGE, PURPLE, TEAL, GRAY, YELLOW } = COLORS;
const NOTE = { fontSize: 10, textColor: '#667085' };
const GRAD = { dashed: true, color: '#B85450' };
const fig = (t: Builder, kind: string, spec: string, label: string, x: number, y: number, w = 150, h = 96, count = 4, color: Color = BLUE): NodeModel =>
  t.icon(`aix-${kind}`, label, x, y, w, h, color, { spec, count, fontSize: 11 });
const caption = (t: Builder, title: string, subtitle: string, width: number) => {
  t.text(title, 0, -66, width, 25, { bold: true, fontSize: 17, align: 'left' });
  t.text(subtitle, 0, -35, width, 18, { ...NOTE, align: 'left' });
};

/** RRF fuses reciprocal ranks; the subsequent cross-encoder scores query-document pairs. */
function hybridRetrieval() {
  const t = new Builder();
  caption(t, 'Hybrid retrieval with evidence and citations', 'Parallel lexical + semantic retrieval → rank fusion → rerank → bounded context → grounded generation', 1350);
  const query = t.box('Query', 0, 137, 110, 46, YELLOW, { bold: true });
  const sparse = fig(t, 'ranking', 'sparse', 'Lexical index', 170, 15, 135, 93, 4);
  const dense = fig(t, 'ranking', 'dense', 'Embedding index', 170, 205, 135, 93, 4, PURPLE);
  const fuse = fig(t, 'ranking', 'fusion', 'RRF', 366, 110, 165, 104, 4);
  // The internal RRF column header identifies this node; leave both vertical ports clear.
  fuse.label = '';
  const rerank = fig(t, 'ranking', 'rerank', 'Cross-encoder', 590, 110, 165, 104, 4, ORANGE);
  const context = fig(t, 'context', 'packed', 'Context budget', 815, 110, 145, 104, 5, PURPLE);
  const llm = t.box('LLM', 1020, 138, 100, 48, ORANGE, { bold: true });
  const answer = fig(t, 'document', 'citations', 'Answer + source IDs', 1190, 111, 110, 118, 5, GREEN);
  t.link(query, sparse, 'right', 'left'); t.link(query, dense, 'right', 'left');
  t.link(sparse, fuse, 'right', 'top'); t.link(dense, fuse, 'right', 'bottom');
  t.chain([fuse, rerank, context, llm, answer]);
  t.text('$\\mathrm{RRF}(d)=\\sum_r \\frac{1}{k+\\mathrm{rank}_r(d)}$', 335, 280, 230, 54, { fontSize: 13 });
  t.text('Keep source IDs attached to every selected passage.', 593, 278, 350, 24, NOTE);
  t.text('Ranking values and documents are schematic examples.', 0, 348, 550, 22, { ...NOTE, align: 'left' });
  return t.done();
}

function documentExtraction() {
  const t = new Builder();
  caption(t, 'From document layout to structured evidence', 'Preserve reading order, separate tables from prose, and retain source references.', 1080);
  const source = t.box('PDF / scanned\ndocument', 0, 103, 130, 58, GRAY);
  const layout = fig(t, 'document', 'layout', 'OCR + layout regions', 200, 60, 110, 145, 4);
  const order = fig(t, 'document', 'order', 'Reading order', 370, 60, 110, 145, 4);
  order.labelPos = 'above';
  const table = fig(t, 'document', 'table', 'Cells + headers', 560, 0, 105, 112, 5, TEAL);
  const spans = fig(t, 'context', 'evidence', 'Relevant text spans', 530, 235, 165, 104, 6, YELLOW);
  const fields = t.box('Schema mapping\n+ field validation', 780, 96, 160, 68, GREEN, { sublabel: 'name · value · page · region', subSize: 9 });
  const citations = fig(t, 'document', 'citations', 'Traceable structured output', 1020, 72, 105, 126, 5, GREEN);
  t.chain([source, layout, order]);
  t.link(order, table, 'right', 'left'); t.link(order, spans, 'bottom', 'left');
  t.link(table, fields, 'right', 'top'); t.link(spans, fields, 'right', 'bottom');
  t.link(fields, citations);
  t.text('Text order is explicit; table cells retain row and column relationships.', 0, 387, 720, 24, { ...NOTE, align: 'left' });
  return t.done();
}

/** Modern SAC: twin critics, entropy-regularized policy, target critics; no value network. */
function sac() {
  const t = new Builder();
  caption(t, 'Soft Actor-Critic: data, policy and twin value estimates', 'Off-policy samples train two critics; the stochastic actor trades return against entropy.', 1300);
  const data = t.box('Replay minibatch', 0, 180, 200, 80, TEAL, { sublabel: "$(s,a_D,r,s',d)$", subSize: 16, bold: true });
  const actor = t.box('$a_\\pi \\sim \\pi_\\theta(\\cdot|s)$', 270, 0, 180, 64, ORANGE, { sublabel: 'Stochastic actor', subSize: 11, fontSize: 16 });
  const entropy = fig(t, 'distribution', 'entropy', 'Entropy regularization', 279, 98, 162, 84, 6);
  const q1 = t.box('$Q_{\\phi_1}(s,a_\\pi)$', 540, 0, 155, 54, BLUE, { sublabel: 'Critic 1', subSize: 10, fontSize: 16 });
  const q2 = t.box('$Q_{\\phi_2}(s,a_\\pi)$', 540, 110, 155, 54, PURPLE, { sublabel: 'Critic 2', subSize: 10, fontSize: 16 });
  const min = t.box('$\\min(Q_1,Q_2)$', 785, 58, 145, 54, GREEN, { fontSize: 15 });
  const ploss = t.box('Actor objective', 1010, 40, 280, 88, ORANGE, { sublabel: '$\\mathbb{E}[\\alpha \\log \\pi_\\theta(a_\\pi|s)-\\min_i Q_{\\phi_i}(s,a_\\pi)]$', subSize: 11, bold: true });
  const replayQ = t.box('Critics at replay actions', 520, 245, 220, 74, BLUE, { sublabel: '$Q_{\\phi_1}(s,a_D), Q_{\\phi_2}(s,a_D)$', subSize: 15, bold: true });
  const loss = t.box('Critic regression', 1020, 245, 240, 74, BLUE, { sublabel: '$\\sum_i(Q_{\\phi_i}(s,a_D)-y)^2$', subSize: 15, bold: true });
  const target = t.box('Target critics + next action', 280, 405, 230, 75, GRAY, { sublabel: "$a' \\sim \\pi_\\theta(\\cdot|s')$\n$\\bar{Q}_{\\phi_1},\\bar{Q}_{\\phi_2}$", subSize: 12 });
  const targetValue = t.box('Soft Bellman target', 620, 405, 330, 75, YELLOW, { sublabel: "$y=r+\\gamma(1-d)[\\min_i \\bar{Q}_i(s',a')-\\alpha\\log\\pi_\\theta(a'|s')]$", subSize: 11, bold: true });
  t.link(data, actor, 'top', 'left', { label: '$s$', labelPos: 'above' });
  t.link(data, replayQ, 'right', 'left', { label: 'replay state + action', labelPos: 'above' });
  t.link(data, target, 'bottom', 'left');
  t.text("$(r,s',d)$", 135, 417, 110, 20, { fontSize: 12 });
  t.link(actor, q1); t.link(actor, q2, 'right', 'left');
  t.link(q1, min, 'right', 'top'); t.link(q2, min, 'right', 'bottom'); t.link(min, ploss);
  t.link(actor, entropy, 'bottom', 'top');
  t.link(replayQ, loss, 'right', 'left', { label: 'both online critics', labelPos: 'above' });
  t.link(replayQ, target, 'bottom', 'top', { dashed: true, label: 'Polyak update of both critics', labelPos: 'above' });
  t.link(target, targetValue); t.link(targetValue, loss, 'right', 'bottom', { label: '$y$', labelPos: 'above' });
  t.text('Policy actions and replay actions are evaluated separately by the same two critics. d = terminal flag; time-limit truncations may still bootstrap.', 0, 541, 1280, 27, { ...NOTE, align: 'left' });
  return t.done();
}

/** Bellemare et al.: Bellman-shift target atoms, then project to the fixed support. */
function c51() {
  const t = new Builder();
  caption(t, 'Categorical distributional Q-learning', 'Predict a distribution over returns, shift the target support, and project its mass onto fixed atoms.', 1250);
  const batch = t.box('Sampled transitions', 0, 129, 205, 80, TEAL, { sublabel: "$(s,a,r,s',d)$", subSize: 16, bold: true });
  const current = fig(t, 'distribution', 'return', '$Z_\\theta(s,a)$', 286, 38, 165, 105, 11);
  const next = fig(t, 'distribution', 'return', "Target $Z_{\\bar{\\theta}}(s',a^*)$", 284, 222, 165, 105, 11, PURPLE);
  const shift = t.box('Bellman support shift', 530, 238, 170, 66, YELLOW, { sublabel: '$z_j \\mapsto r+\\gamma(1-d)z_j$', subSize: 12, bold: true });
  const project = fig(t, 'distribution', 'projection', 'Projection onto fixed support', 776, 219, 184, 115, 11, PURPLE);
  const loss = t.box('Cross-entropy', 1035, 110, 205, 88, BLUE, { sublabel: '$-\\sum_j m_j \\log p_{\\theta,j}(s,a)$', subSize: 14, bold: true });
  t.link(batch, current, 'right', 'left'); t.link(batch, next, 'right', 'left');
  t.chain([next, shift, project]); t.link(project, loss, 'right', 'bottom'); t.link(current, loss, 'right', 'top');
  t.link(loss, current, 'top', 'top', { ...GRAD, label: 'update online parameters', labelPos: 'above', offset: 0 });
  t.text("$a^*=\\arg\\max_a \\mathbb{E}[Z_{\\bar{\\theta}}(s',a)]$", 220, 389, 410, 48, { fontSize: 13 });
  t.text('Only a few atoms are drawn for readability; C51 uses 51 fixed support atoms.', 690, 397, 540, 34, NOTE);
  return t.done();
}

function detectionPostprocessing() {
  const t = new Builder();
  caption(t, 'Detection postprocessing: hard and soft suppression', 'After score filtering, compare same-class proposals by overlap. Hard NMS and Soft-NMS are alternative branches.', 1170);
  const proposals = fig(t, 'detection', 'proposals', 'Scored box proposals', 0, 111, 135, 125, 5, BLUE);
  const threshold = t.box('Class scores\n+ confidence filter', 213, 138, 150, 58, ORANGE);
  const iou = fig(t, 'detection', 'iou', 'Pairwise IoU', 445, 110, 137, 125, 3, PURPLE);
  const hard = fig(t, 'detection', 'nms', 'Hard NMS', 690, 0, 137, 125, 4, GREEN);
  const soft = fig(t, 'detection', 'soft', 'Soft-NMS', 690, 240, 137, 125, 4, GREEN);
  const hardOut = t.box('Retain selected boxes', 917, 34, 210, 58, GREEN, { sublabel: 'Suppress high-overlap neighbors', subSize: 10 });
  const softOut = t.box('Retain updated scores', 917, 274, 210, 58, GREEN, { sublabel: 'Decay scores by overlap; re-sort', subSize: 10 });
  t.chain([proposals, threshold, iou]);
  t.link(iou, hard, 'right', 'left'); t.link(iou, soft, 'right', 'left'); t.link(hard, hardOut); t.link(soft, softOut);
  t.text('$\\mathrm{IoU}(A,B)=\\frac{|A\\cap B|}{|A\\cup B|}$', 381, 343, 260, 60, { fontSize: 15 });
  t.text('Boxes are schematic; score thresholds, class grouping and overlap thresholds are editable diagram labels.', 0, 438, 1130, 24, { ...NOTE, align: 'left' });
  return t.done();
}

function geometricMatching() {
  const t = new Builder();
  caption(t, 'Local correspondences with geometric verification', 'Detect local features, match descriptors, reject inconsistent pairs, and estimate a planar homography.', 1170);
  const features = fig(t, 'matching', 'matches', 'Detected features in two views', 0, 76, 210, 118, 6);
  const descriptors = t.box('Descriptor matching', 285, 103, 160, 60, PURPLE, { sublabel: 'Nearest neighbor + ratio test', subSize: 10 });
  const verify = fig(t, 'matching', 'ransac', 'RANSAC inlier selection', 519, 76, 210, 118, 6);
  verify.labelPos = 'above';
  const model = t.box('Estimate homography', 804, 98, 175, 70, GREEN, { sublabel: "$\\mathbf{x}' \\sim H\\mathbf{x}$", subSize: 17 });
  const aligned = t.box('Warp / stitch\nplanar views', 1050, 103, 130, 60, BLUE);
  t.chain([features, descriptors, verify, model, aligned]);
  const rejection = t.box('Reject inconsistent correspondences', 518, 297, 225, 44, GRAY, { fontSize: 11 });
  t.link(verify, rejection, 'bottom', 'top', { color: '#B85450' });
  t.text('outlier mask', 655, 236, 110, 20, { fontSize: 10, textColor: '#B85450' });
  t.text('A homography models a plane or pure camera rotation; it is not a general 3D motion model.', 0, 379, 1080, 25, { ...NOTE, align: 'left' });
  return t.done();
}

function maskedDiffusion() {
  const t = new Builder();
  caption(t, 'Mask-conditioned generation with a preserved region', 'Schematic inference workflow: condition a denoiser on the mask and known content, then composite only the editable region.', 1310);
  const known = fig(t, 'mask', 'known', 'Known image', 0, 0, 130, 112, 8);
  const mask = fig(t, 'mask', 'inpaint', 'Editable mask M', 0, 210, 130, 112, 8);
  const noise = fig(t, 'guidance', 'timesteps', 'Reverse-time schedule', 224, 105, 168, 106, 9, PURPLE);
  const denoiser = t.box('Conditional denoiser', 471, 124, 185, 70, ORANGE, { sublabel: '$\\epsilon_\\theta(x_t,t,c,M)$', subSize: 16, bold: true });
  const update = t.box('Sampler update', 738, 128, 155, 62, PURPLE, { sublabel: '$x_t \\to x_{t-1}$', subSize: 16 });
  const composite = t.box('Preserve known region', 977, 126, 255, 66, GREEN, { sublabel: '$x=M\\odot x_{\\mathrm{gen}}+(1-M)\\odot x_{\\mathrm{known}}$', subSize: 12, bold: true });
  t.link(known, denoiser, 'right', 'top', { label: 'known content / conditioning', labelPos: 'above' });
  t.link(mask, denoiser, 'right', 'bottom', { label: 'mask condition', labelPos: 'below' });
  t.chain([noise, denoiser, update, composite]);
  t.link(update, denoiser, 'bottom', 'bottom', { label: 'repeat for earlier t', labelPos: 'below', offset: 68 });
  t.text('M = 1 in the region being generated; M = 0 in the region to preserve. Outpainting uses a mask outside the original canvas.', 0, 398, 1240, 28, { ...NOTE, align: 'left' });
  return t.done();
}

/** Generic factorized space-time video diffusion workflow, not a product-specific architecture. */
function videoDiffusion() {
  const t = new Builder();
  caption(t, 'Video diffusion with temporal conditioning', 'Schematic space-time denoiser: spatial processing within frames and temporal processing across frames.', 1320);
  const noise = fig(t, 'video', 'noise', 'Noisy video tensor', 0, 112, 212, 108, 4, PURPLE);
  const spatial = t.box('Spatial processing', 298, 131, 168, 64, BLUE, { sublabel: 'Shared across frames', subSize: 11, bold: true });
  const temporal = t.box('Temporal processing', 548, 131, 172, 64, PURPLE, { sublabel: 'Exchange across time', subSize: 11, bold: true });
  const predict = t.box('Joint noise prediction', 805, 131, 175, 64, ORANGE, { sublabel: '$\\epsilon_\\theta(x_t,t,c)$', subSize: 16, bold: true });
  const sample = fig(t, 'video', 'clean', 'Coherent generated sequence', 1080, 112, 218, 108, 4);
  const key = fig(t, 'video', 'keyframe', 'Optional known-frame condition', 460, 320, 250, 108, 5, TEAL);
  const time = t.box('Time embedding\n+ text condition', 518, 0, 230, 52, YELLOW);
  t.chain([noise, spatial, temporal, predict]);
  t.link(predict, sample, 'right', 'left', { label: 'solver', labelPos: 'above' });
  t.link(time, temporal, 'bottom', 'top'); t.link(key, temporal, 'top', 'bottom');
  t.link(predict, spatial, 'top', 'top', { offset: -18 });
  t.text('Repeat reverse-time steps', 305, 67, 200, 18, NOTE);
  t.text('Frames share one video sample; temporal processing coordinates motion rather than generating each frame independently.', 0, 480, 1290, 28, { ...NOTE, align: 'left' });
  return t.done();
}

export const AI_EXTRA_TEMPLATES: TemplateDef[] = [
  { id: 'aix-hybrid-retrieval', name: 'Retrieval ibrido: RRF, reranking e citazioni', section: 'NLP & LLM', build: hybridRetrieval },
  { id: 'aix-document-extraction', name: 'Documenti: layout, tabelle e fonti', section: 'NLP & LLM', build: documentExtraction },
  { id: 'aix-sac', name: 'Soft Actor-Critic: due critic ed entropia', section: 'Reinforcement learning', build: sac },
  { id: 'aix-c51', name: 'C51: Q-learning distribuzionale', section: 'Reinforcement learning', build: c51 },
  { id: 'aix-detection-post', name: 'Detection: IoU, NMS e Soft-NMS', section: 'Pattern recognition & CV', build: detectionPostprocessing },
  { id: 'aix-geometric-matching', name: 'Feature matching e verifica RANSAC', section: 'Pattern recognition & CV', build: geometricMatching },
  { id: 'aix-masked-diffusion', name: 'Diffusione condizionata da maschera', section: 'Generative AI', build: maskedDiffusion },
  { id: 'aix-video-diffusion', name: 'Video diffusion: spazio, tempo e keyframe', section: 'Generative AI', build: videoDiffusion },
];
