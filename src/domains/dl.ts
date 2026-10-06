// Modulo di dominio Deep learning: forme parametriche (dl-shapes.ts), blocchi della
// libreria (qui sotto) e modelli ricalcati sulle figure dei paper (dl-templates.ts).
// Vedi src/registry.ts per l'API e src/domains/README.md per le convenzioni.
import { COLORS, ICON, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { DL_SHAPES } from './dl-shapes';
import { DL_TEMPLATES } from './dl-templates';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const CAT = 'Deep learning';

const PRESETS: Preset[] = [
  // illustrazioni parametriche
  { id: 'dl-dropout', name: 'Dropout (rete)', category: CAT, node: { shape: 'dl-dropout', label: 'Dropout', spec: '4,5,5,2', count: 40, w: 150, h: 110, strokeWidth: 1.2, ...ICON, ...GREEN } },
  { id: 'dl-maxpool', name: 'Max pooling', category: CAT, node: { shape: 'dl-pool', label: 'max pool $2 \\times 2$', spec: '4x4 max', count: 2, w: 176, h: 80, strokeWidth: 1.2, ...ICON, ...GRAY } },
  { id: 'dl-avgpool', name: 'Average pooling', category: CAT, node: { shape: 'dl-pool', label: 'avg pool $2 \\times 2$', spec: '4x4 avg', count: 2, w: 176, h: 80, strokeWidth: 1.2, ...ICON, ...GRAY } },
  { id: 'dl-convvol', name: 'Conv su volume', category: CAT, node: { shape: 'dl-convvol', label: '$3 \\times 3$ conv', spec: '6x6', count: 3, w: 170, h: 100, strokeWidth: 1.2, ...ICON, ...ORANGE } },
  { id: 'dl-heads', name: 'Teste di attention', category: CAT, node: { shape: 'dl-heads', label: '$h$ attention heads', spec: '6x6 idx', count: 4, w: 100, h: 100, strokeWidth: 1.2, ...ICON, ...RED } },
  { id: 'dl-embtable', name: 'Lookup embedding', category: CAT, node: { shape: 'dl-embtable', label: 'Embedding lookup', spec: '6x4', count: 3, w: 170, h: 84, strokeWidth: 1.2, ...ICON, ...PURPLE } },
  { id: 'dl-landscape', name: 'Discesa del gradiente', category: CAT, node: { shape: 'dl-landscape', label: 'Gradient descent', spec: 'gd', count: 12, w: 130, h: 96, radius: 4, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dl-sgd', name: 'SGD (rumoroso)', category: CAT, node: { shape: 'dl-landscape', label: 'SGD', spec: 'sgd', count: 16, w: 130, h: 96, radius: 4, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dl-momentum', name: 'SGD + momentum', category: CAT, node: { shape: 'dl-landscape', label: 'SGD + momentum', spec: 'momentum', count: 18, w: 130, h: 96, radius: 4, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dl-softmax', name: 'Softmax', category: CAT, node: { shape: 'dl-softmax', label: '$p_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}$', spec: '1', count: 6, w: 90, h: 56, strokeWidth: 1.2, ...ICON, ...TEAL } },
  { id: 'dl-softmax-t', name: 'Softmax (T alta)', category: CAT, node: { shape: 'dl-softmax', label: '$p_i = \\frac{e^{z_i / T}}{\\sum_j e^{z_j / T}}$', spec: '4', count: 6, w: 90, h: 56, strokeWidth: 1.2, ...ICON, ...TEAL } },
  { id: 'dl-batchnorm', name: 'Batch norm (cubo)', category: CAT, node: { shape: 'dl-normcube', label: 'Batch Norm', spec: 'batch axes', count: 6, w: 110, h: 112, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dl-layernorm', name: 'Layer norm (cubo)', category: CAT, node: { shape: 'dl-normcube', label: 'Layer Norm', spec: 'layer axes', count: 6, w: 110, h: 112, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dl-instnorm', name: 'Instance norm (cubo)', category: CAT, node: { shape: 'dl-normcube', label: 'Instance Norm', spec: 'instance axes', count: 6, w: 110, h: 112, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dl-groupnorm', name: 'Group norm (cubo)', category: CAT, node: { shape: 'dl-normcube', label: 'Group Norm', spec: 'group axes', count: 6, w: 110, h: 112, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dl-windows', name: 'Finestre (Swin)', category: CAT, node: { shape: 'dl-windows', label: 'Layer $l$', spec: 'p4', count: 2, w: 84, h: 84, strokeWidth: 1, ...ICON, fill: '#F5F5F5', stroke: '#9E9E9E' } },
  { id: 'dl-windows-shift', name: 'Finestre shiftate', category: CAT, node: { shape: 'dl-windows', label: 'Layer $l+1$', spec: 'shift p4', count: 2, w: 84, h: 84, strokeWidth: 1, ...ICON, fill: '#F5F5F5', stroke: '#9E9E9E' } },
  { id: 'dl-resblock', name: 'Blocco residuo', category: CAT, node: { shape: 'dl-resblock', label: 'Residual block', count: 2, w: 120, h: 70, strokeWidth: 1.2, ...ICON, ...BLUE } },
  { id: 'dl-augimg', name: 'Vista aumentata', category: CAT, node: { shape: 'dl-augimg', label: '$\\tilde{x}_i$', spec: 'crop color', w: 76, h: 76, radius: 2, strokeWidth: 1, ...ICON, fill: '#FFFFFF', stroke: '#C9CED6' } },
  { id: 'dl-augorig', name: 'Immagine (scena)', category: CAT, node: { shape: 'dl-augimg', label: '$x$', w: 76, h: 76, radius: 2, strokeWidth: 1, ...ICON, fill: '#FFFFFF', stroke: '#C9CED6' } },
  { id: 'dl-augblur', name: 'Vista (blur+flip)', category: CAT, node: { shape: 'dl-augimg', label: '$\\tilde{x}_j$', spec: 'flip blur gray', w: 76, h: 76, radius: 2, strokeWidth: 1, ...ICON, fill: '#FFFFFF', stroke: '#C9CED6' } },
  { id: 'dl-triplet', name: 'Triplet (embedding)', category: CAT, node: { shape: 'dl-triplet', label: 'Triplet embedding', spec: 'after', w: 110, h: 84, radius: 6, strokeWidth: 1, ...ICON, fill: '#FAFAFA', stroke: '#BDBDBD' } },
  { id: 'dl-chcuboid', name: 'Tensore (canali SE)', category: CAT, node: { shape: 'dl-chcuboid', label: '$\\tilde{X}$', count: 8, depth: 0.35, w: 110, h: 80, strokeWidth: 1, ...ICON, ...GRAY } },
  { id: 'dl-tokens', name: 'Token (BERT)', category: CAT, node: { shape: 'dl-tokens', spec: '[CLS]|my|dog|is|cute|[SEP]', w: 260, h: 28, radius: 5, strokeWidth: 1, fill: '#F7F7F7', stroke: '#8A929C' } },
  { id: 'dl-tokens-mask', name: 'Token (masked LM)', category: CAT, node: { shape: 'dl-tokens', spec: '[CLS]|my|[MASK]|is|cute|[SEP]', w: 260, h: 28, radius: 5, strokeWidth: 1, fill: '#F7F7F7', stroke: '#8A929C' } },
  { id: 'dl-tokens-gpt', name: 'Token (GPT, prossimo)', category: CAT, node: { shape: 'dl-tokens', spec: 'The|cat|sat|on|*the', w: 220, h: 28, radius: 5, strokeWidth: 1, ...BLUE } },
  { id: 'dl-emb-row', name: 'Riga di embedding', category: CAT, node: { shape: 'dl-tokens', spec: '$E_{\\mathrm{[CLS]}}$|$E_1$|$E_2$|$E_3$|$E_{\\mathrm{[SEP]}}$', w: 260, h: 30, radius: 4, strokeWidth: 1, ...YELLOW } },
  { id: 'dl-mask-causal', name: 'Maschera causale', category: CAT, node: { shape: 'dl-mask', label: 'Causal mask', spec: 'causal', count: 6, w: 80, h: 80, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dl-mask-full', name: 'Maschera completa', category: CAT, node: { shape: 'dl-mask', label: 'Bidirectional', spec: 'full', count: 6, w: 80, h: 80, strokeWidth: 1, ...ICON, ...BLUE } },
  { id: 'dl-mask-window', name: 'Maschera a finestra', category: CAT, node: { shape: 'dl-mask', label: 'Sliding window', spec: 'window', count: 6, w: 80, h: 80, strokeWidth: 1, ...ICON, ...BLUE } },
  // blocchi testuali ricorrenti
  { id: 'dl-weight', name: 'Weight layer', category: CAT, node: { label: 'weight layer', w: 120, h: 34, fontSize: 12, strokeWidth: 1.2, ...BLUE } },
  { id: 'dl-sdpa', name: 'Scaled dot-product', category: CAT, node: { shape: 'stack', label: 'Scaled Dot-Product\nAttention', count: 3, w: 150, h: 58, fontSize: 11, strokeWidth: 1.2, ...PURPLE } },
  { id: 'dl-gate', name: 'Gate sigma', category: CAT, node: { label: '$\\sigma$', w: 36, h: 26, fontSize: 15, radius: 3, strokeWidth: 1.2, ...YELLOW } },
  { id: 'dl-hadamard', name: 'Hadamard (⊙)', category: CAT, node: { shape: 'ellipse', label: '$\\odot$', w: 26, h: 26, fontSize: 16, strokeWidth: 1.2, ...WHITE } },
  { id: 'dl-tanhop', name: 'tanh (puntuale)', category: CAT, node: { shape: 'pill', label: 'tanh', w: 40, h: 22, fontSize: 11, strokeWidth: 1.2, ...RED } },
  { id: 'dl-router', name: 'Router (MoE)', category: CAT, node: { label: 'Router', w: 100, h: 32, fontSize: 12, strokeWidth: 1.2, ...YELLOW } },
  { id: 'dl-expert', name: 'Esperto (FFN)', category: CAT, node: { label: 'FFN', sublabel: 'Expert', w: 64, h: 46, fontSize: 12, subSize: 9, strokeWidth: 1.2, ...BLUE } },
  { id: 'dl-merge', name: 'Patch merging', category: CAT, node: { label: 'Patch\nMerging', w: 80, h: 44, fontSize: 11, strokeWidth: 1.2, ...GREEN } },
  { id: 'dl-wmsa', name: 'W-MSA / SW-MSA', category: CAT, node: { label: 'W-MSA', w: 90, h: 30, fontSize: 12, strokeWidth: 1.2, ...ORANGE } },
  { id: 'dl-reparam', name: 'Reparametrizzazione', category: CAT, node: { label: '$z = \\mu + \\sigma \\odot \\epsilon$', w: 140, h: 36, fontSize: 13, strokeWidth: 1.2, ...YELLOW } },
  {
    id: 'dl-normformula',
    name: 'Normalizzazione (formula)',
    category: CAT,
    node: { label: 'Norm', sublabel: '$y = \\gamma \\frac{x - \\mu}{\\sqrt{\\sigma^2 + \\epsilon}} + \\beta$', w: 170, h: 64, fontSize: 11, bold: true, subSize: 14, strokeWidth: 1.2, ...YELLOW },
  },
  { id: 'dl-concat', name: 'Filter concat', category: CAT, node: { label: 'Filter concatenation', w: 200, h: 30, fontSize: 12, strokeWidth: 1.2, ...GREEN } },
  {
    id: 'dl-elbo',
    name: 'ELBO (loss)',
    category: CAT,
    node: {
      label: 'ELBO',
      sublabel: '$\\mathbb{E}_{q_\\phi}[\\log p_\\theta(x|z)] - D_{\\mathrm{KL}}(q_\\phi(z|x) \\| p(z))$',
      w: 320,
      h: 56,
      radius: 10,
      fill: '#FAFAFB',
      stroke: '#B8BEC8',
      fontSize: 11,
      bold: true,
      subSize: 13,
    },
  },
];

registerShapes(DL_SHAPES);
registerPresets(PRESETS);
registerTemplates(DL_TEMPLATES);
