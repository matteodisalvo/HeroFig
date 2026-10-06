// Modulo di dominio con figure ML/DL moderne ricalcate dai paper: interni degli LLM (Llama, GQA,
// FlashAttention, RoPE, Perceiver, LLaVA), graph learning (GAT, GraphSAGE, message passing),
// paradigmi di apprendimento (MAML, DANN, FixMatch, FedAvg, EWC, NAS), scientific ML (PINN, FNO,
// Neural ODE) e ML bayesiano (processi gaussiani, Bayesian optimization, active learning).
// Forme in ml_dl_more-shapes.ts, modelli in ml_dl_more-templates.ts.
import './dl';
import './ml';
import { COLORS, ICON, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { MORE_SHAPES } from './ml_dl_more-shapes';
import { MORE_TEMPLATES } from './ml_dl_more-templates';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const DL = 'Deep learning';
const SCI = 'Scientific ML';
const GL = 'Graph learning';
const PLOTS = 'Grafici ML';
const ML = 'ML classico';
/** Grafico da paper: pannello bianco, bordo grigio chiaro, titolo sotto. */
const PANEL = { ...ICON, fill: '#FFFFFF', stroke: '#C9CED6', strokeWidth: 1, radius: 3 };

const PRESETS: Preset[] = [
  // ---------- LLM e attention ----------
  { id: 'dlm-mha', name: 'Multi-head (teste)', category: DL, node: { shape: 'dlm-qkv', label: 'Multi-head', spec: 'mha', count: 8, w: 150, h: 100, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dlm-gqa', name: 'Grouped-query (teste)', category: DL, node: { shape: 'dlm-qkv', label: 'Grouped-query', spec: 'gqa g4', count: 8, w: 150, h: 100, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dlm-mqa', name: 'Multi-query (teste)', category: DL, node: { shape: 'dlm-qkv', label: 'Multi-query', spec: 'mqa', count: 8, w: 150, h: 100, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dlm-tiles', name: 'Attention a blocchi', category: DL, node: { shape: 'dlm-tiles', label: 'Tiled attention', spec: '4x4', count: 6, w: 90, h: 90, strokeWidth: 1, ...ICON, ...GREEN } },
  { id: 'dlm-tiles-causal', name: 'Blocchi (causale)', category: DL, node: { shape: 'dlm-tiles', label: 'Causal tiles', spec: '4x4 causal', count: 7, w: 90, h: 90, strokeWidth: 1, ...ICON, ...GREEN } },
  { id: 'dlm-memhier', name: 'Gerarchia di memoria', category: DL, node: { shape: 'dlm-memhier', label: 'Memory hierarchy', spec: 'bw', w: 240, h: 110, strokeWidth: 1, ...ICON, ...GRAY } },
  { id: 'dlm-rotation', name: 'Rotazione RoPE', category: DL, node: { shape: 'dlm-rotation', w: 150, h: 110, fill: 'none', stroke: '#8FB09C', strokeWidth: 1, ...ICON } },
  { id: 'dlm-ropevec', name: 'Query/key (RoPE)', category: DL, node: { shape: 'dlm-ropevec', label: 'Query / Key', count: 0, w: 170, h: 20, strokeWidth: 1, ...ICON, ...WHITE } },
  { id: 'dlm-ropevec-enc', name: 'Query/key codificata', category: DL, node: { shape: 'dlm-ropevec', label: 'Position encoded', count: 1, w: 170, h: 20, strokeWidth: 1, ...ICON, ...WHITE } },
  { id: 'dlm-rmsnorm', name: 'RMSNorm', category: DL, node: { label: 'RMS Norm', w: 120, h: 28, fontSize: 12, strokeWidth: 1.2, ...YELLOW } },
  { id: 'dlm-rope', name: 'RoPE (blocco)', category: DL, node: { label: 'RoPE', w: 56, h: 26, fontSize: 11, strokeWidth: 1.2, ...PURPLE } },
  { id: 'dlm-swiglu', name: 'SwiGLU FFN', category: DL, node: { label: 'SwiGLU FFN', sublabel: '$W_2(\\mathrm{SiLU}(W_1 x) \\odot W_3 x)$', w: 200, h: 50, fontSize: 12, subSize: 12, strokeWidth: 1.2, ...BLUE } },
  { id: 'dlm-gqa-block', name: 'Grouped-query attention', category: DL, node: { label: 'Grouped-Query Attention', sublabel: 'with KV cache', w: 170, h: 44, fontSize: 12, subSize: 10, strokeWidth: 1.2, ...ORANGE } },
  { id: 'dlm-crossattn', name: 'Cross-attention', category: DL, node: { label: 'Cross\nAttention', w: 70, h: 100, fontSize: 12, strokeWidth: 1.2, ...ORANGE } },
  { id: 'dlm-latenttf', name: 'Latent transformer', category: DL, node: { label: 'Latent\nTransformer', w: 80, h: 100, fontSize: 12, strokeWidth: 1.2, ...BLUE } },
  { id: 'dlm-latent', name: 'Latent array', category: DL, node: { shape: 'dlm-array', label: 'Latent array', count: 3, w: 18, h: 54, fill: '#EDEDED', stroke: '#555555', strokeWidth: 1, ...ICON } },
  { id: 'dlm-bytes', name: 'Byte array', category: DL, node: { shape: 'dlm-array', label: 'Byte array', count: 5, w: 18, h: 90, fill: '#BBD9A8', stroke: '#1E4D12', strokeWidth: 1, ...ICON } },
  { id: 'dlm-tokrow', name: 'Token (LLaVA)', category: DL, node: { shape: 'dlm-tokrow', label: '$\\mathbf{H}_{\\mathrm{v}}$', count: 3, w: 100, h: 22, strokeWidth: 1, ...ICON, fill: '#F2F2F2', stroke: '#6C8EBF' } },
  { id: 'dlm-projw', name: 'Proiezione W', category: DL, node: { label: 'Projection $\\mathbf{W}$', w: 140, h: 28, fontSize: 12, strokeWidth: 1.2, ...ORANGE } },
  // ---------- sequenze, paradigmi di apprendimento ----------
  { id: 'dlm-dilated', name: 'Conv causali dilatate', category: DL, node: { shape: 'dlm-dilated', label: 'Dilated causal convolutions', count: 4, w: 300, h: 130, strokeWidth: 1, ...ICON, ...WHITE } },
  { id: 'dlm-dilated-labels', name: 'Conv dilatate (con nomi)', category: DL, node: { shape: 'dlm-dilated', spec: 'dilated labels', count: 4, w: 420, h: 170, strokeWidth: 1, ...ICON, ...WHITE } },
  { id: 'dlm-causal', name: 'Conv causali', category: DL, node: { shape: 'dlm-dilated', label: 'Causal convolutions', spec: 'standard', count: 4, w: 300, h: 130, strokeWidth: 1, ...ICON, ...WHITE } },
  { id: 'dlm-maml', name: 'MAML (θ e task)', category: DL, node: { shape: 'dlm-maml', spec: 'legend', w: 200, h: 120, fill: 'none', stroke: '#333333', ...ICON } },
  { id: 'dlm-ewc', name: 'EWC (parametri)', category: DL, node: { shape: 'dlm-ewc', w: 220, h: 100, fill: 'none', stroke: '#333333', ...ICON } },
  { id: 'dlm-grl', name: 'Gradient reversal', category: DL, node: { label: 'Gradient\nreversal layer', sublabel: '$\\times (-\\lambda)$ in backprop', w: 120, h: 56, fontSize: 11, subSize: 10, strokeWidth: 1.2, ...GRAY } },
  { id: 'dlm-pred', name: 'Predizione (soglia)', category: DL, node: { shape: 'dlm-probs', label: 'Prediction', spec: 'thresh', count: 6, w: 90, h: 54, radius: 8, strokeWidth: 1.2, ...ICON, labelPos: 'above', ...RED } },
  { id: 'dlm-pseudo', name: 'Pseudo-label', category: DL, node: { shape: 'dlm-probs', label: 'Pseudo-label', spec: 'onehot', count: 6, w: 90, h: 54, radius: 8, strokeWidth: 1.2, ...ICON, labelPos: 'above', ...YELLOW } },
  { id: 'dlm-pred2', name: 'Predizione', category: DL, node: { shape: 'dlm-probs', label: 'Prediction', spec: 'alt', count: 6, w: 90, h: 54, radius: 8, strokeWidth: 1.2, ...ICON, labelPos: 'above', ...BLUE } },
  // Icone di contesto usate anche in FedAvg: la categoria descrive l'oggetto,
  // non il modello che lo usa. ID e forme restano compatibili con le figure salvate.
  { id: 'dlm-phone', name: 'Client (telefono)', category: 'Icone', node: { shape: 'dlm-device', label: 'Client', spec: 'phone', w: 40, h: 64, strokeWidth: 1.2, ...ICON, ...GRAY } },
  { id: 'dlm-laptop', name: 'Client (portatile)', category: 'Icone', node: { shape: 'dlm-device', label: 'Client', spec: 'laptop', w: 76, h: 54, strokeWidth: 1.2, ...ICON, ...GRAY } },
  { id: 'dlm-server', name: 'Server', category: 'Icone', node: { shape: 'dlm-device', label: 'Server', spec: 'server', w: 54, h: 62, strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'dlm-hospital', name: 'Ospedale', category: 'Icone bio', node: { shape: 'dlm-device', label: 'Hospital', spec: 'hospital', w: 64, h: 60, strokeWidth: 1.2, ...ICON, ...WHITE } },
  { id: 'dlm-fedavg-agg', name: 'Media FedAvg', category: DL, node: { label: 'Aggregation', sublabel: '$w_{t+1} = \\sum_{k=1}^{K} \\frac{n_k}{n} w_{t+1}^k$', w: 200, h: 70, fontSize: 11, bold: true, subSize: 13, strokeWidth: 1.2, ...YELLOW } },
  // ---------- scientific ML ----------
  { id: 'dlm-odeflow-res', name: 'Traiettorie ResNet', category: SCI, node: { shape: 'dlm-odeflow', label: 'Residual Network', spec: 'resnet', w: 150, h: 170, ...PANEL, labelPos: 'above' } },
  { id: 'dlm-odeflow-ode', name: 'Traiettorie ODE', category: SCI, node: { shape: 'dlm-odeflow', label: 'ODE Network', spec: 'ode', w: 150, h: 170, ...PANEL, labelPos: 'above' } },
  { id: 'dlm-darcy', name: 'Campo (Darcy)', category: SCI, node: { shape: 'dlm-field', label: '$a(x)$', spec: 'darcy', count: 28, w: 80, h: 80, strokeWidth: 1, ...ICON, ...GRAY } },
  { id: 'dlm-vorticity', name: 'Campo (vorticità)', category: SCI, node: { shape: 'dlm-field', label: '$w(x, t)$', spec: 'vorticity', count: 28, w: 80, h: 80, strokeWidth: 1, ...ICON, ...GRAY } },
  { id: 'dlm-burgers', name: 'Campo (Burgers)', category: SCI, node: { shape: 'dlm-field', label: '$u(t, x)$', spec: 'burgers points', count: 36, w: 130, h: 80, strokeWidth: 1, ...ICON, ...GRAY } },
  { id: 'dlm-waves', name: 'Modi di Fourier', category: SCI, node: { shape: 'dlm-waves', count: 4, w: 90, h: 64, fill: 'none', stroke: '#333333', ...ICON } },
  { id: 'dlm-fourier', name: 'Fourier layer', category: SCI, node: { label: 'Fourier layer', w: 120, h: 40, fontSize: 13, strokeWidth: 1.2, fill: '#F5F5C0', stroke: '#8C8C3C' } },
  { id: 'dlm-pderes', name: 'Residuo della PDE', category: SCI, node: { label: 'PDE residual', sublabel: '$f = u_t + u u_x - \\nu u_{xx}$', w: 180, h: 56, fontSize: 11, bold: true, subSize: 13, strokeWidth: 1.2, ...ORANGE } },
  // ---------- graph learning ----------
  { id: 'dlm-gatmech', name: 'Attention GAT', category: GL, node: { shape: 'dlm-gatmech', w: 170, h: 200, strokeWidth: 1.2, ...ICON, ...WHITE } },
  { id: 'dlm-gatstar', name: 'GAT multi-testa', category: GL, node: { shape: 'dlm-gatstar', count: 3, w: 260, h: 180, strokeWidth: 1.2, ...ICON, ...WHITE } },
  { id: 'dlm-sage-sample', name: 'GraphSAGE: campiona', category: GL, node: { shape: 'dlm-sage', label: 'Sample neighborhood', spec: 'sample', w: 140, h: 140, ...ICON, fill: 'none', stroke: '#333333' } },
  { id: 'dlm-sage-agg', name: 'GraphSAGE: aggrega', category: GL, node: { shape: 'dlm-sage', label: 'Aggregate', spec: 'aggregate', w: 140, h: 140, ...ICON, fill: 'none', stroke: '#333333' } },
  { id: 'dlm-sage-pred', name: 'GraphSAGE: predici', category: GL, node: { shape: 'dlm-sage', label: 'Predict', spec: 'predict', w: 140, h: 140, ...ICON, fill: 'none', stroke: '#333333' } },
  { id: 'dlm-message', name: 'Messaggio', category: GL, node: { label: 'Message', sublabel: '$M_t(h_v^t, h_w^t, e_{vw})$', w: 170, h: 50, fontSize: 11, bold: true, subSize: 12, strokeWidth: 1.2, ...ORANGE } },
  { id: 'dlm-aggregate', name: 'Aggregazione', category: GL, node: { label: 'Aggregate', sublabel: '$m_v^{t+1} = \\sum_{w \\in N(v)} M_t(\\cdot)$', w: 190, h: 56, fontSize: 11, bold: true, subSize: 12, strokeWidth: 1.2, ...YELLOW } },
  { id: 'dlm-update', name: 'Aggiornamento', category: GL, node: { label: 'Update', sublabel: '$h_v^{t+1} = U_t(h_v^t, m_v^{t+1})$', w: 170, h: 50, fontSize: 11, bold: true, subSize: 12, strokeWidth: 1.2, ...BLUE } },
  { id: 'dlm-readout', name: 'Readout', category: GL, node: { label: 'Readout', sublabel: '$\\hat{y} = R(\\{h_v^T \\mid v \\in G\\})$', w: 170, h: 50, fontSize: 11, bold: true, subSize: 12, strokeWidth: 1.2, ...GREEN } },
  // ---------- ML bayesiano ----------
  { id: 'mlm-gp-prior', name: 'GP (prior)', category: PLOTS, node: { shape: 'mlm-gp', label: 'GP prior', spec: 'prior samples', w: 140, h: 100, ...PANEL } },
  { id: 'mlm-gp-post', name: 'GP (posterior)', category: PLOTS, node: { shape: 'mlm-gp', label: 'GP posterior', spec: 'posterior samples', count: 5, w: 140, h: 100, ...PANEL } },
  { id: 'mlm-gp-band', name: 'GP (media ± 2σ)', category: PLOTS, node: { shape: 'mlm-gp', label: 'GP regression', spec: 'posterior truth', count: 6, w: 140, h: 100, ...PANEL } },
  { id: 'mlm-bo', name: 'Bayesian optimization', category: PLOTS, node: { shape: 'mlm-gp', label: '$t = 3$', spec: 'bo', count: 3, w: 160, h: 110, ...PANEL } },
  { id: 'mlm-oracle', name: 'Oracolo (annotatore)', category: ML, node: { shape: 'user', label: 'Oracle', sublabel: '(human annotator)', w: 40, h: 44, strokeWidth: 1.2, ...ICON, ...TEAL } },
  { id: 'mlm-query', name: 'Strategia di query', category: ML, node: { label: 'Query strategy', sublabel: '$x^* = \\arg\\max_x H(y \\mid x)$', w: 180, h: 54, fontSize: 11, bold: true, subSize: 12, strokeWidth: 1.2, ...PURPLE } },
];

registerShapes(MORE_SHAPES);
registerPresets(PRESETS);
registerTemplates(MORE_TEMPLATES);
