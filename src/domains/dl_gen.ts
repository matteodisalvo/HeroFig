// Modulo di dominio Generative AI e visione: forme parametriche (dl_gen-shapes.ts), blocchi
// della libreria (qui sotto) e modelli ricalcati sulle figure dei paper (dl_gen-templates.ts).
// Vedi src/registry.ts per l'API e src/domains/README.md per le convenzioni.
import { COLORS, ICON, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { DLG_SHAPES } from './dl_gen-shapes';
import { DLG_TEMPLATES } from './dl_gen-templates';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
// La categoria segue la funzione del blocco, anche quando il modello di origine appartiene a un altro ambito.
const CAT = 'Generative AI';
const DL = 'Deep learning';
const CV = 'Visione';
const IMG = { radius: 2, strokeWidth: 1, fill: '#FFFFFF', stroke: '#C9CED6', ...ICON };
const FORMULA = { radius: 10, fill: '#FAFAFB', stroke: '#B8BEC8', fontSize: 11, bold: true, subSize: 13 };

const PRESETS: Preset[] = [
  // immagini sintetiche nelle rese tipiche dei paper
  { id: 'dlg-photo', name: 'Immagine (paesaggio)', category: CAT, node: { shape: 'dlg-scene', label: '$x$', count: 0, w: 80, h: 80, ...IMG } },
  { id: 'dlg-edges', name: 'Mappa dei bordi', category: CAT, node: { shape: 'dlg-scene', label: 'Edges', spec: 'edges', count: 0, w: 80, h: 80, ...IMG } },
  { id: 'dlg-canny', name: 'Canny (condizione)', category: CAT, node: { shape: 'dlg-scene', label: 'Canny edge', spec: 'canny', count: 0, w: 80, h: 80, ...IMG } },
  { id: 'dlg-segmap', name: 'Mappa semantica', category: CAT, node: { shape: 'dlg-scene', label: 'Semantic map', spec: 'seg', count: 0, w: 80, h: 80, ...IMG } },
  { id: 'dlg-depth', name: 'Mappa di profondità', category: CAT, node: { shape: 'dlg-scene', label: 'Depth', spec: 'depth', count: 0, w: 80, h: 80, ...IMG } },
  { id: 'dlg-noisy', name: 'Immagine rumorosa', category: CAT, node: { shape: 'dlg-scene', label: '$x_t$', count: 5, w: 80, h: 80, ...IMG } },
  { id: 'dlg-purenoise', name: 'Rumore puro', category: CAT, node: { shape: 'dlg-scene', label: '$x_T \\sim \\mathcal{N}(0, I)$', count: 10, w: 80, h: 80, ...IMG } },
  { id: 'dlg-crop', name: 'Vista ritagliata', category: CAT, node: { shape: 'dlg-scene', label: '$x_1$', spec: 'crop jitter', count: 0, w: 80, h: 80, ...IMG } },
  { id: 'dlg-samask', name: 'Maschera (SAM)', category: CV, node: { shape: 'dlg-scene', label: 'Mask', spec: 'mask point', count: 0, w: 80, h: 80, ...IMG } },
  { id: 'dlg-detect', name: 'Rilevamenti (DETR)', category: CV, node: { shape: 'dlg-scene', label: 'Detections', spec: 'boxes', count: 0, w: 110, h: 80, ...IMG } },
  { id: 'dlg-strip', name: 'Dati → rumore', category: CAT, node: { shape: 'dlg-noisestrip', label: 'Forward process', count: 6, w: 300, h: 50, ...IMG } },
  { id: 'dlg-strip-rev', name: 'Rumore → dati', category: CAT, node: { shape: 'dlg-noisestrip', label: 'Reverse process', spec: 'reverse arrows', count: 5, w: 300, h: 50, ...IMG } },
  // patch mascherate (MAE)
  { id: 'dlg-maskgrid', name: 'Patch mascherate', category: DL, node: { shape: 'dlg-masked', label: 'input', spec: 'masked', count: 5, w: 90, h: 90, ...ICON } },
  { id: 'dlg-recon', name: 'Ricostruzione (MAE)', category: DL, node: { shape: 'dlg-masked', label: 'reconstruction', spec: 'recon', count: 5, w: 90, h: 90, ...ICON } },
  { id: 'dlg-visible', name: 'Patch visibili', category: DL, node: { shape: 'dlg-masked', spec: 'visible', count: 5, w: 24, h: 180, ...ICON } },
  { id: 'dlg-tokcol', name: 'Token encoder', category: DL, node: { shape: 'dlg-masked', spec: 'tokens', count: 5, w: 24, h: 180, radius: 2, fill: '#A8DDE0', stroke: '#5FAFB4', ...ICON } },
  { id: 'dlg-mixcol', name: 'Token + mask token', category: DL, node: { shape: 'dlg-masked', spec: 'mixed', count: 5, w: 18, h: 220, radius: 2, fill: '#A8DDE0', stroke: '#5FAFB4', ...ICON } },
  // VQ-VAE
  { id: 'dlg-codebook', name: 'Codebook (VQ)', category: CAT, node: { shape: 'dlg-codebook', label: 'Embedding space', count: 8, w: 220, h: 80, radius: 12, strokeWidth: 1.5, ...ICON, labelPos: 'above', fill: '#DCD3EC', stroke: '#8E7DB6' } },
  { id: 'dlg-embspace', name: 'Spazio degli embedding', category: CAT, node: { shape: 'dlg-codebook', label: '$z_q(x) \\sim q(z|x)$', spec: 'space', w: 150, h: 120, ...ICON, fill: '#DCD3EC', stroke: '#8E7DB6' } },
  { id: 'dlg-ze', name: 'Latente (griglia)', category: CAT, node: { shape: 'dlg-gridcube', label: '$z_e(x)$', count: 6, depth: 0.35, w: 90, h: 90, strokeWidth: 1, ...ICON, fill: '#D5E8D4', stroke: '#82B366' } },
  { id: 'dlg-zq', name: 'Latente quantizzato', category: CAT, node: { shape: 'dlg-gridcube', label: '$z_q(x)$', spec: 'codes', count: 6, depth: 0.35, w: 90, h: 90, strokeWidth: 1, ...ICON, fill: '#E1D5E7', stroke: '#9673A6' } },
  { id: 'dlg-idxmap', name: 'Mappa di indici', category: CAT, node: { shape: 'dlg-gridcube', label: '$q(z|x)$', spec: 'flat idx', count: 6, w: 70, h: 70, strokeWidth: 1, ...ICON, fill: '#D6E4EE', stroke: '#6C8EBF' } },
  // flow, NeRF, Gaussian splatting
  { id: 'dlg-interp', name: 'Interpolazione lineare', category: CAT, node: { shape: 'dlg-flowpaths', label: '$X_t = t X_1 + (1-t) X_0$', spec: 'interp', count: 20, w: 150, h: 110, fill: 'none', stroke: 'none', ...ICON } },
  { id: 'dlg-rectflow', name: 'Rectified flow', category: CAT, node: { shape: 'dlg-flowpaths', label: 'Rectified flow $Z_t$', spec: 'rectified', count: 20, w: 150, h: 110, fill: 'none', stroke: 'none', ...ICON } },
  { id: 'dlg-straight', name: 'Flusso rettilineo (2-RF)', category: CAT, node: { shape: 'dlg-flowpaths', label: '2-Rectified flow', spec: 'straight', count: 20, w: 150, h: 110, fill: 'none', stroke: 'none', ...ICON } },
  { id: 'dlg-rays', name: 'Raggi NeRF', category: CAT, node: { shape: 'dlg-nerfrays', label: '5D input', spec: 'input', count: 8, w: 200, h: 150, fill: 'none', stroke: 'none', ...ICON } },
  { id: 'dlg-rays-out', name: 'Campioni (colore, σ)', category: CAT, node: { shape: 'dlg-nerfrays', label: 'Color + density', spec: 'output', count: 8, w: 200, h: 150, fill: 'none', stroke: 'none', ...ICON } },
  { id: 'dlg-density', name: 'Densità sul raggio', category: CAT, node: { shape: 'dlg-raydensity', label: 'Ray Distance', spec: 'ray1', w: 120, h: 60, fill: 'none', stroke: 'none', ...ICON, fontSize: 10 } },
  { id: 'dlg-splats', name: 'Gaussiane 3D', category: CAT, node: { shape: 'dlg-gaussians', label: '3D Gaussians', spec: 'splats', count: 14, w: 90, h: 70, fill: 'none', stroke: '#2E9E44', ...ICON, bold: true } },
  { id: 'dlg-sfm', name: 'Punti SfM', category: CAT, node: { shape: 'dlg-gaussians', label: 'SfM Points', spec: 'points', count: 12, w: 60, h: 60, fill: 'none', stroke: 'none', ...ICON } },
  { id: 'dlg-clone', name: 'Densificazione: clone', category: CAT, node: { shape: 'dlg-densify', label: 'Clone', spec: 'clone', w: 80, h: 80, fill: 'none', stroke: '#2E9E44', ...ICON } },
  { id: 'dlg-split', name: 'Densificazione: split', category: CAT, node: { shape: 'dlg-densify', label: 'Split', spec: 'split', w: 80, h: 80, fill: 'none', stroke: '#2E9E44', ...ICON } },
  // glifi e piccoli schemi
  { id: 'dlg-netbars', name: 'Rete (glifo)', category: CAT, node: { shape: 'dlg-netbars', label: '$G$', labelPos: 'above', count: 3, w: 56, h: 52, radius: 0, fill: '#FFFFFF', stroke: '#1A1A1A', strokeWidth: 1.4, fontSize: 18 } },
  { id: 'dlg-bracket', name: 'Coppia (parentesi)', category: CAT, node: { shape: 'dlg-bracket', direction: 'right', w: 14, h: 130, fill: 'none', stroke: '#1A1A1A', strokeWidth: 1.4 } },
  { id: 'dlg-checker', name: 'Maschera a scacchiera', category: CAT, node: { shape: 'dlg-checker', label: 'Checkerboard mask', spec: 'checker num', count: 4, w: 80, h: 80, strokeWidth: 1, ...ICON, ...GRAY, fill: '#BFBFBF' } },
  { id: 'dlg-squeeze', name: 'Squeeze (canali)', category: CAT, node: { shape: 'dlg-checker', label: 'Channel-wise mask', spec: 'squeeze num', w: 80, h: 80, strokeWidth: 1, ...ICON, ...GRAY, fill: '#BFBFBF' } },
  { id: 'dlg-posmaps', name: 'Positional encoding 2-D', category: DL, node: { shape: 'dlg-gradstack', label: 'positional encoding', count: 3, w: 80, h: 70, strokeWidth: 1, ...ICON, ...GRAY } },
  { id: 'dlg-denseicon', name: 'Blocco denso (icona)', category: DL, node: { shape: 'dlg-dense', count: 5, w: 130, h: 44, fill: '#8A8A8A', stroke: '#555555', ...ICON } },
  // blocchi testuali ricorrenti
  { id: 'dlg-zeroconv', name: 'Zero convolution', category: CAT, node: { shape: 'pill', label: 'zero convolution', w: 150, h: 28, fontSize: 12, strokeWidth: 1.2, fill: '#FFFFFF', stroke: '#BDBDBD' } },
  { id: 'dlg-trainable', name: 'Copia addestrabile', category: CAT, node: { label: 'trainable copy', w: 150, h: 46, fontSize: 12, strokeWidth: 1.2, radius: 8, fill: '#DCEDF2', stroke: '#2F8A9E' } },
  { id: 'dlg-locked', name: 'Blocco bloccato', category: CAT, node: { label: 'neural network\nblock (locked)', w: 150, h: 46, fontSize: 12, strokeWidth: 1.2, radius: 8, fill: '#F2F2F2', stroke: '#8A8A8A' } },
  { id: 'dlg-adain', name: 'AdaIN', category: CAT, node: { label: 'AdaIN', w: 90, h: 26, fontSize: 12, strokeWidth: 1.2, ...YELLOW } },
  { id: 'dlg-affine', name: 'Affine A (stile)', category: CAT, node: { label: 'A', w: 22, h: 22, fontSize: 12, radius: 3, strokeWidth: 1.2, ...PURPLE } },
  { id: 'dlg-noisescale', name: 'Scala del rumore B', category: CAT, node: { label: 'B', w: 22, h: 22, fontSize: 12, radius: 3, strokeWidth: 1.2, ...TEAL } },
  { id: 'dlg-mapping', name: 'Mapping network', category: CAT, node: { shape: 'stack', label: 'FC $\\times 8$', count: 3, w: 100, h: 40, fontSize: 12, strokeWidth: 1.2, ...GREEN } },
  { id: 'dlg-ffn', name: 'FFN (testa)', category: DL, node: { label: 'FFN', w: 56, h: 32, fontSize: 12, strokeWidth: 1.2, ...WHITE } },
  { id: 'dlg-momentum', name: 'Momentum encoder', category: DL, node: { label: 'momentum\nencoder', w: 120, h: 44, fontSize: 12, strokeWidth: 1.2, ...ORANGE } },
  { id: 'dlg-queue', name: 'Coda di chiavi', category: DL, node: { shape: 'cells', label: 'queue', count: 6, w: 150, h: 26, radius: 3, ...ICON, ...BLUE } },
  { id: 'dlg-coupling', name: 'Coupling layer', category: CAT, node: { label: 'Affine coupling', sublabel: '$y_2 = x_2 \\odot \\exp(s(x_1)) + t(x_1)$', w: 230, h: 56, fontSize: 11, bold: true, subSize: 13, strokeWidth: 1.2, ...BLUE } },
  // formule dei paper
  { id: 'dlg-cfg', name: 'Classifier-free guidance', category: CAT, node: { label: 'Classifier-free guidance', sublabel: '$\\tilde{\\epsilon}_\\theta(z_t, c) = (1 + w)\\, \\epsilon_\\theta(z_t, c) - w\\, \\epsilon_\\theta(z_t, \\emptyset)$', w: 320, h: 56, ...FORMULA } },
  { id: 'dlg-fmloss', name: 'Flow matching (loss)', category: CAT, node: { label: 'Flow matching', sublabel: '$\\mathcal{L} = \\mathbb{E}_{t, x_0, x_1} \\| v_\\theta(x_t, t) - (x_1 - x_0) \\|^2$', w: 300, h: 56, ...FORMULA } },
  { id: 'dlg-dsm', name: 'Score matching (loss)', category: CAT, node: { label: 'Denoising score matching', sublabel: '$\\mathbb{E}_{t, x_0, x_t} \\| s_\\theta(x_t, t) - \\nabla_{x_t} \\log p_{0t}(x_t | x_0) \\|^2$', w: 330, h: 56, ...FORMULA } },
  { id: 'dlg-vqloss', name: 'VQ-VAE (loss)', category: CAT, node: { label: 'VQ-VAE loss', sublabel: '$\\log p(x | z_q(x)) + \\| \\mathrm{sg}[z_e(x)] - e \\|_2^2 + \\beta \\| z_e(x) - \\mathrm{sg}[e] \\|_2^2$', w: 380, h: 56, ...FORMULA } },
  { id: 'dlg-volrender', name: 'Volume rendering', category: CAT, node: { label: 'Volume rendering', sublabel: '$\\hat{C}(\\mathbf{r}) = \\sum_{i=1}^{N} T_i (1 - e^{-\\sigma_i \\delta_i}) \\mathbf{c}_i$', w: 260, h: 64, ...FORMULA } },
  { id: 'dlg-infonce', name: 'InfoNCE (MoCo)', category: DL, node: { label: 'Contrastive loss', sublabel: '$\\mathcal{L}_q = -\\log \\frac{\\exp(q \\cdot k_+ / \\tau)}{\\sum_{i=0}^{K} \\exp(q \\cdot k_i / \\tau)}$', w: 260, h: 70, ...FORMULA } },
  { id: 'dlg-consist', name: 'Consistency (vincolo)', category: CAT, node: { label: 'Self-consistency', sublabel: '$f_\\theta(x_t, t) = f_\\theta(x_{t\'}, t\')$,  $f_\\theta(x_\\epsilon, \\epsilon) = x_\\epsilon$', w: 300, h: 56, ...FORMULA } },
  { id: 'dlg-pix2pixobj', name: 'Obiettivo pix2pix', category: CAT, node: { label: 'pix2pix objective', sublabel: '$G^* = \\arg\\min_G \\max_D \\mathcal{L}_{cGAN}(G, D) + \\lambda \\mathcal{L}_{L1}(G)$', w: 330, h: 60, ...FORMULA } },
  { id: 'dlg-noisebox', name: 'Rumore per-pixel', category: CAT, node: { label: 'Noise', w: 60, h: 26, fontSize: 11, strokeWidth: 1.2, ...GRAY } },
  { id: 'dlg-const', name: 'Input costante', category: CAT, node: { label: 'Const $4 \\times 4 \\times 512$', w: 130, h: 28, fontSize: 12, strokeWidth: 1.2, ...WHITE } },
  { id: 'dlg-maskdec', name: 'Mask decoder', category: CV, node: { label: 'mask decoder', w: 130, h: 30, fontSize: 12, strokeWidth: 1.2, ...ORANGE } },
  { id: 'dlg-prompenc', name: 'Prompt encoder', category: CV, node: { label: 'prompt encoder', w: 130, h: 30, fontSize: 12, strokeWidth: 1.2, ...PURPLE } },
  { id: 'dlg-sg', name: 'Stop-gradient (sg)', category: DL, node: { shape: 'pill', label: 'sg', w: 36, h: 22, fontSize: 11, strokeWidth: 1.2, ...RED } },
];

registerShapes(DLG_SHAPES);
registerPresets(PRESETS);
registerTemplates(DLG_TEMPLATES);
