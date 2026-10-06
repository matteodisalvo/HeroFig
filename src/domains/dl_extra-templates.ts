// Diagrammi didattici originali basati sui metodi citati, non benchmark né repliche esatte.
import { Builder, type Color } from '../builder';
import { COLORS, ICON, type NodeModel } from '../model';
import type { TemplateDef } from '../registry';

const { BLUE, GREEN, ORANGE, PURPLE, TEAL, RED, GRAY, YELLOW, WHITE } = COLORS;
const NOTE = { fontSize: 11, textColor: '#627083', align: 'left' as const };
function icon(t: Builder, shape: string, spec: string, label: string, x: number, y: number, w: number, h: number, count = 4, color: Color = BLUE, extra: Partial<NodeModel> = {}) {
  return t.add({ shape, spec, label, x, y, w, h, count, ...ICON, strokeWidth: 1.2, ...color, ...extra });
}
function heading(t: Builder, title: string, subtitle: string, width = 1040) {
  t.text(title, 0, 0, width, 30, { fontSize: 22, bold: true, align: 'left' });
  t.text(subtitle, 0, 40, width, 34, NOTE);
}

// AdamW: https://arxiv.org/abs/1711.05101 ; AMP: https://arxiv.org/abs/1710.03740
function training() {
  const t = new Builder();
  heading(t, 'One optimizer step', 'Equal-sized microbatches · accumulate scaled gradients · unscale once before clipping');
  const input = t.box('Microbatch $1\\ldots K$', 0, 115, 146, 48, BLUE);
  const forward = t.box('Forward pass', 195, 115, 138, 48, GREEN, { sublabel: 'FP16 compute copy', subSize: 10 });
  const loss = t.box('Loss / K', 382, 115, 106, 48, RED);
  const scale = t.box('$S\\,\\mathcal{L}/K$', 537, 115, 130, 48, YELLOW, { sublabel: 'scale loss', subSize: 10 });
  const backward = t.box('Backward', 716, 115, 136, 48, ORANGE);
  t.chain([input, forward, loss, scale, backward]);
  const accum = icon(t, 'dlex-gradients', 'sum', 'Repeat over K microbatches', 698, 225, 170, 108, 4, GREEN);
  t.link(backward, accum, 'bottom', 'top');
  const unscale = t.box('Unscale $g/S$', 460, 258, 144, 46, BLUE);
  const clip = icon(t, 'dlex-gradients', 'clip', 'Optional norm clipping', 220, 234, 156, 106, 3, RED);
  const update = t.box('AdamW step', 0, 258, 155, 46, PURPLE);
  t.link(accum, unscale, 'left', 'right'); t.link(unscale, clip, 'left', 'right'); t.link(clip, update, 'left', 'right');
  const master = icon(t, 'dlex-precision', 'master', 'FP32 master weights', 0, 427, 180, 107, 5, BLUE);
  const state = icon(t, 'dlex-optimizer', 'adamw', 'First / second moments', 256, 420, 165, 108, 6, PURPLE);
  t.link(update, master, 'bottom', 'top'); t.link(state, update, 'top', 'bottom', { label: 'm, v', labelPos: 'above' });
  const bend1 = t.anchor(-54, 480), bend2 = t.anchor(-54, 86), bend3 = t.anchor(264, 86);
  t.link(master, bend1, 'left', 'right', { routing: 'straight', arrowEnd: false });
  t.link(bend1, bend2, 'top', 'bottom', { routing: 'straight', arrowEnd: false });
  t.link(bend2, bend3, 'right', 'left', { routing: 'straight', arrowEnd: false, label: 'cast for next step', labelPos: 'above' });
  t.link(bend3, forward, 'bottom', 'top', { routing: 'straight' });
  t.text('Check finite gradients before stepping; an overflow skips the update.', 460, 430, 410, 48, NOTE);
  t.text('$\\theta \\leftarrow (1-\\eta\\lambda)\\theta - \\eta\\frac{\\hat{m}}{\\sqrt{\\hat{v}}+\\epsilon}$', 460, 495, 430, 52, { fontSize: 14, ...GRAY, shape: 'rect', radius: 8 });
  return t.done();
}

// Activation rematerialization: https://arxiv.org/abs/1604.06174
function checkpointing() {
  const t = new Builder();
  heading(t, 'Activation checkpointing', 'Keep selected activations; reconstruct the others when backward needs them.', 930);
  t.text('Standard forward', 0, 116, 190, 24, { ...NOTE, bold: true });
  icon(t, 'dlex-checkpoint', 'all', 'All intermediate activations retained', 215, 98, 670, 120, 10, BLUE);
  t.text('Checkpointed forward', 0, 296, 190, 24, { ...NOTE, bold: true });
  icon(t, 'dlex-checkpoint', 'sparse', 'Only selected activations retained', 215, 278, 670, 120, 10, GREEN);
  const saved = t.box('Saved checkpoint', 100, 493, 155, 48, GREEN);
  const remat = t.box('Recompute segment', 320, 493, 182, 48, ORANGE);
  const backward = t.box('Backward for segment', 567, 493, 190, 48, RED);
  t.chain([saved, remat, backward]);
  t.text('Memory / compute trade-off', 100, 585, 330, 24, { ...NOTE, bold: true });
  t.text('More retained checkpoints use more memory; fewer checkpoints require more recomputation.', 100, 615, 700, 36, NOTE);
  return t.done();
}

// Generic selective state-space recurrence; not the entire Mamba block. https://arxiv.org/abs/2312.00752
function selectiveSSM() {
  const t = new Builder();
  heading(t, 'Selective state-space update', 'Input-conditioned parameters in a recurrent state-space layer; schematic core.', 940);
  const h0 = t.box('$h_{t-1}$', 0, 125, 110, 44, GREEN, { fontSize: 16 });
  const A = t.box('$\\bar{A}_t$', 170, 125, 100, 44, YELLOW, { fontSize: 16 });
  const sum = t.op('+', 346, 134);
  const h1 = t.box('$h_t$', 430, 125, 110, 44, GREEN, { fontSize: 16 });
  const C = t.box('$C_t$', 600, 125, 100, 44, PURPLE, { fontSize: 16 });
  const out = t.box('$y_t$', 760, 125, 100, 44, TEAL, { fontSize: 16 });
  t.chain([h0, A, sum, h1, C, out]);
  const x = t.box('$x_t$', 0, 284, 110, 44, BLUE, { fontSize: 16 });
  const B = t.box('$\\bar{B}_t$', 190, 284, 100, 44, ORANGE, { fontSize: 16 });
  t.link(x, B); t.link(B, sum, 'right', 'bottom');
  const parameters = t.box('Select + discretize', 460, 284, 190, 50, YELLOW, { sublabel: '$\\Delta_t, B_t, C_t$', subSize: 12 });
  t.link(x, parameters, 'bottom', 'bottom', { offset: 46, label: 'condition on input', labelPos: 'below' });
  t.link(parameters, A, 'top', 'bottom', { dashed: true, color: YELLOW.stroke });
  t.link(parameters, B, 'left', 'right', { dashed: true, color: YELLOW.stroke });
  t.link(parameters, C, 'top', 'bottom', { dashed: true, color: YELLOW.stroke });
  icon(t, 'dlex-state', 'selective', 'Unrolled recurrence', 50, 447, 510, 154, 5, GREEN);
  t.text('$h_t = \\bar{A}_t h_{t-1} + \\bar{B}_t x_t$', 600, 451, 310, 34, { fontSize: 15 });
  t.text('$y_t = C_t h_t$', 600, 500, 310, 32, { fontSize: 15 });
  t.text('A fixed convolution kernel applies only to\nthe time-invariant case, not to general\ninput-dependent selection.', 600, 548, 310, 62, NOTE);
  return t.done();
}

// Adapter families: Houlsby 2019, Hu 2021, Liu 2022. URLs in module notes.
function adapters() {
  const t = new Builder();
  heading(t, 'Parameter-efficient adaptation', 'Frozen base computation and compact trainable updates; four different parameterizations.', 1000);
  const rows = [
    ['serial', 'Bottleneck adapter', '$h + W_{up}\\,\\sigma(W_{down}h)$'],
    ['parallel', 'Parallel adapter', '$W x + W_{up}\\,\\sigma(W_{down}x)$'],
    ['gate', 'Feature scaling (IA3)', '$l \\odot h$'],
    ['lowrank', 'Low-rank update (LoRA)', '$(W_0 + BA)x$'],
  ];
  rows.forEach(([spec, name, formula], i) => {
    const y = 115 + i * 156;
    t.text(name, 0, y + 32, 238, 28, { ...NOTE, bold: true, fontSize: 13 });
    icon(t, 'dlex-adapter', spec, '', 258, y, 325, 123, 3, BLUE);
    t.box(formula, 650, y + 24, 330, 68, WHITE, { fontSize: 15 });
  });
  t.text('Gray: frozen base · Pastel: trainable adaptation · Rank / bottleneck size is editable', 0, 782, 990, 28, NOTE);
  return t.done();
}

// Token dispatch / capacity, Switch: https://arxiv.org/abs/2101.03961
function expertDispatch() {
  const t = new Builder();
  heading(t, 'Sparse token dispatch', 'Route selected tokens to experts, combine weighted outputs, and inspect per-expert capacity.', 1040);
  const tokens = t.icon('cells', 'Input tokens', 0, 139, 32, 154, BLUE, { count: 6 });
  const gate = t.box('Router scores', 105, 185, 140, 52, YELLOW, { sublabel: 'softmax probabilities', subSize: 10 });
  const topk = t.box('Top-k selection', 316, 185, 145, 52, ORANGE);
  const dispatch = icon(t, 'dlex-dispatch', 'top2', 'Token-to-expert dispatch', 535, 125, 245, 168, 3, PURPLE);
  const combine = t.box('Weighted combine', 850, 185, 158, 52, GREEN);
  t.chain([tokens, gate, topk, dispatch, combine]);
  icon(t, 'dlex-dispatch', 'top1', 'k = 1: one expert per token', 40, 435, 235, 166, 3, BLUE);
  icon(t, 'dlex-dispatch', 'capacity', 'Overflow beyond expert capacity', 376, 435, 235, 166, 3, RED);
  icon(t, 'dlex-dispatch', 'load', 'Monitor load and balance', 719, 435, 235, 166, 3, GREEN);
  t.text('Illustrative routing assignments; dropped/overflow tokens depend on the implementation.', 40, 662, 900, 32, NOTE);
  return t.done();
}

// Differentiable pooling: https://arxiv.org/abs/1806.08804
function diffpool() {
  const t = new Builder();
  heading(t, 'Differentiable graph pooling', 'Two GNN branches learn node embeddings and a soft assignment to clusters.', 1040);
  const graph = t.icon('graph', 'Input graph $(A, X)$', 0, 176, 134, 130, PURPLE, { count: 7 });
  const embed = t.box('Embedding GNN', 228, 109, 158, 54, BLUE, { sublabel: '$Z = \\mathrm{GNN}_{emb}(A,X)$', subSize: 11 });
  const assign = t.box('Assignment GNN', 228, 345, 158, 58, ORANGE, { sublabel: 'row-wise softmax', subSize: 10 });
  const z = t.icon('grid', 'Node embeddings $Z$', 481, 95, 100, 95, BLUE, { spec: '6x4' });
  const s = icon(t, 'dlex-pooling', 'assignment', 'Soft assignments $S$', 470, 311, 123, 131, 3, PURPLE);
  const pool = t.box('Coarsen', 670, 213, 166, 88, GREEN, { sublabel: "$X' = S^T Z$\n$A' = S^T A S$", subSize: 13 });
  const coarse = icon(t, 'dlex-pooling', 'pool', 'Coarse graph', 895, 173, 180, 127, 3, GREEN);
  t.link(graph, embed, 'right', 'left'); t.link(graph, assign, 'right', 'left'); t.link(embed, z); t.link(assign, s); t.link(z, pool, 'right', 'top'); t.link(s, pool, 'right', 'left'); t.link(pool, coarse);
  const adjacency = t.box('Original adjacency $A$', 670, 378, 166, 46, GRAY, { fontSize: 11 });
  t.link(adjacency, pool, 'top', 'bottom');
  t.text('S has one row per original node and one column per learned cluster.', 218, 505, 730, 32, NOTE);
  t.text('The assignment is learned continuously; the colors illustrate cluster membership.', 218, 545, 730, 32, NOTE);
  return t.done();
}

// Branch and trunk: https://arxiv.org/abs/1910.03193
function deeponet() {
  const t = new Builder();
  heading(t, 'DeepONet: functions to functions', 'Encode sampled input functions with the branch; encode query coordinates with the trunk.', 1060);
  const sensors = icon(t, 'dlex-operator', 'sensors', 'Samples $u(x_1),\\ldots,u(x_m)$', 0, 124, 205, 118, 7, BLUE);
  const query = icon(t, 'dlex-operator', 'coordinates', 'Query location $y$', 25, 380, 155, 132, 5, PURPLE);
  const branch = t.enc('$B$', 'Branch net', 290, 112, 116, 138);
  const trunk = t.enc('$T$', 'Trunk net', 290, 377, 116, 138, PURPLE);
  const bvec = t.icon('cells', '$b_1,\\ldots,b_p$', 495, 166, 150, 28, GREEN, { count: 5 });
  const tvec = t.icon('cells', '$t_1(y),\\ldots,t_p(y)$', 495, 430, 150, 28, PURPLE, { count: 5 });
  const dot = t.op('$\\cdot$', 748, 299, { w: 46, h: 46, fontSize: 26 });
  const out = t.box('$G_\\theta(u)(y)$', 867, 298, 150, 50, TEAL, { fontSize: 17 });
  t.link(sensors, branch); t.link(query, trunk); t.link(branch, bvec); t.link(trunk, tvec);
  t.link(bvec, dot, 'right', 'top'); t.link(tvec, dot, 'right', 'bottom'); t.link(dot, out);
  t.box('$G_\\theta(u)(y) = \\sum_{k=1}^{p} b_k(u(x_1),\\ldots,u(x_m))t_k(y)$', 250, 595, 765, 72, WHITE, { fontSize: 17 });
  t.text('Evaluate the same branch representation at many output query locations.', 250, 702, 765, 30, NOTE);
  return t.done();
}

export const DL_EXTRA_TEMPLATES: TemplateDef[] = [
  { id: 'dlex-training-step', name: 'Training: accumulo, AMP e AdamW', section: 'Deep learning', build: training },
  { id: 'dlex-checkpointing', name: 'Activation checkpointing: memoria e ricalcolo', section: 'Deep learning', build: checkpointing },
  { id: 'dlex-selective-ssm', name: 'State-space: aggiornamento selettivo', section: 'Deep learning', build: selectiveSSM },
  { id: 'dlex-adapters', name: 'Adapter: bottleneck, parallelo, IA3 e LoRA', section: 'Deep learning', build: adapters },
  { id: 'dlex-token-dispatch', name: 'MoE: dispatch, capacità e carico', section: 'Deep learning', build: expertDispatch },
  { id: 'glex-diffpool', name: 'Pooling differenziabile di grafi (DiffPool)', section: 'Graph learning', build: diffpool },
  { id: 'sciex-deeponet', name: 'DeepONet: branch, trunk e operatore', section: 'Scientific ML', build: deeponet },
];
