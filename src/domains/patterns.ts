// Modulo di dominio: pattern recognition (teoria classica della decisione, Duda–Hart–Stork,
// Bishop) e computer vision (feature classiche, detection, segmentazione, posa, flusso).
// Vedi src/registry.ts per l'API e src/domains/README.md per le convenzioni.
import { COLORS, ICON, MED_IMG, type NodeModel } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { PATTERN_SHAPES } from './patterns-shapes';
import { PATTERN_TEMPLATES } from './patterns-templates';

const { WHITE } = COLORS;
const PR = 'Pattern recognition';
const CV = 'Computer vision';

/** Grafico da paper: fondo bianco, cornice grigia leggera, etichetta sotto. */
const PLOT = { ...ICON, fill: '#FFFFFF', stroke: '#B8BEC8', strokeWidth: 1, radius: 3 };
/** Schema su griglia (feature map, kernel). */
const GRIDDED = { ...ICON, fill: '#FFFFFF', strokeWidth: 1.2, radius: 0 };
const IMG = { ...MED_IMG, w: 110, h: 82, count: 0 };

const p = (id: string, name: string, category: string, node: Partial<NodeModel>) => ({ id, name, category, node });

registerShapes(PATTERN_SHAPES);

registerPresets([
  // ---------- teoria della decisione ----------
  p('pr-bayes', 'Decisione di Bayes', PR, { ...PLOT, shape: 'pr-bayes', label: '$p(x|\\omega_i) P(\\omega_i)$', w: 120, h: 72, count: 2 }),
  p('pr-bayes3', 'Bayes (3 classi)', PR, { ...PLOT, shape: 'pr-bayes', label: 'Decision regions $\\mathcal{R}_i$', w: 120, h: 72, count: 3 }),
  p('pr-posterior', 'A posteriori', PR, { ...PLOT, shape: 'pr-bayes', label: '$P(\\omega_i | x) = \\frac{p(x | \\omega_i) P(\\omega_i)}{p(x)}$', spec: 'post', w: 120, h: 72, count: 2 }),
  p('pr-regions', 'Regioni di decisione', PR, { ...PLOT, shape: 'pr-regions', label: 'Decision regions', w: 96, h: 84, count: 3, stroke: '#888888' }),
  p('pr-linmachine', 'Macchina lineare', PR, { ...PLOT, shape: 'pr-regions', label: 'Linear machine', spec: 'linear', w: 96, h: 84, count: 4, stroke: '#888888' }),
  p('pr-voronoi', 'Voronoi (1-NN)', PR, { ...PLOT, shape: 'pr-voronoi', label: '1-NN (Voronoi)', w: 96, h: 84, count: 12, stroke: '#888888' }),
  p('pr-knn', 'k-NN', PR, { ...PLOT, shape: 'pr-voronoi', label: '$k$-NN ($k = 5$)', spec: 'knn k=5', w: 96, h: 84, count: 22 }),
  p('pr-gauss2d', 'Gaussiane 2D', PR, { ...PLOT, shape: 'pr-gauss2d', label: '$p(\\mathbf{x} | \\omega_i)$', spec: 'points', w: 100, h: 84, count: 2 }),
  p('pr-gmm', 'Mistura di gaussiane', PR, { ...PLOT, shape: 'pr-gauss2d', label: '$p(\\mathbf{x}) = \\sum_{k=1}^{K} \\pi_k \\mathcal{N}(\\mathbf{x} | \\mu_k, \\Sigma_k)$', w: 100, h: 84, count: 3 }),
  p('pr-dendro', 'Dendrogramma', PR, { ...ICON, shape: 'pr-dendro', label: 'Dendrogram', w: 120, h: 80, count: 10, fill: 'none', stroke: '#555555', strokeWidth: 1.2 }),
  p('pr-trellis', 'Traliccio HMM', PR, { ...ICON, ...WHITE, shape: 'pr-trellis', label: 'Trellis (Viterbi path)', w: 150, h: 80, count: 3, spec: '5', strokeWidth: 1 }),
  p('pr-hmmstate', 'Stato nascosto', PR, { ...WHITE, shape: 'ellipse', label: '$q_t$', w: 44, h: 44, fontSize: 15, strokeWidth: 1.2 }),
  p('pr-hmmobs', 'Osservazione', PR, { shape: 'ellipse', label: '$o_t$', w: 44, h: 44, fontSize: 15, strokeWidth: 1.2, fill: '#D9D9D9', stroke: '#444444' }),
  // ---------- immagini ----------
  p('pr-scene', 'Foto (scena)', CV, { ...IMG, shape: 'pr-scene', label: 'Input image' }),
  p('pr-semseg', 'Segment. semantica', CV, { ...IMG, shape: 'pr-scene', label: 'Semantic segmentation', spec: 'seg' }),
  p('pr-instseg', 'Segment. istanze', CV, { ...IMG, shape: 'pr-scene', label: 'Instance segmentation', spec: 'inst det' }),
  p('pr-detscene', 'Detection (foto)', CV, { ...IMG, shape: 'pr-scene', label: 'Detections', spec: 'det' }),
  p('pr-edges', 'Mappa dei bordi', CV, { ...IMG, shape: 'pr-scene', label: 'Edge map', spec: 'edges' }),
  p('pr-ped', 'Pedone', CV, { ...MED_IMG, shape: 'pr-scene', label: 'Pedestrian', spec: 'ped', w: 52, h: 104, count: 0 }),
  p('pr-ped-schematic', 'Pedone schematico', CV, { ...ICON, shape: 'pr-ped-schematic', label: 'Pedestrian', w: 70, h: 104, fill: '#7D9FC5', stroke: '#35465C', strokeWidth: 1.2 }),
  p('pr-face', 'Volto', CV, { ...MED_IMG, shape: 'pr-scene', label: 'Face', spec: 'face', w: 80, h: 80, count: 0 }),
  // ---------- feature classiche ----------
  p('pr-hog', 'HOG', CV, { ...MED_IMG, shape: 'pr-hog', label: 'HOG descriptor', spec: '12x6', fill: '#111111', w: 56, h: 108 }),
  p('pr-hogblock', 'HOG + blocchi', CV, { ...MED_IMG, shape: 'pr-hog', label: 'Cells & blocks', spec: '12x6 block', fill: '#111111', w: 56, h: 108 }),
  p('pr-sift', 'Keypoint SIFT', CV, { ...IMG, shape: 'pr-sift', label: 'SIFT keypoints', count: 14 }),
  p('pr-window', 'Finestra mobile', CV, { ...IMG, shape: 'pr-window', label: 'Sliding window', count: 3 }),
  p('pr-haar', 'Feature di Haar', CV, { ...GRIDDED, shape: 'pr-haar', label: 'Haar feature', count: 1, w: 60, h: 60, stroke: '#666666' }),
  p('pr-haarface', 'Haar sul volto', CV, { ...MED_IMG, shape: 'pr-haar', label: 'Haar feature on face', spec: 'face', count: 1, w: 80, h: 80 }),
  p('pr-flow', 'Flusso ottico', CV, { ...PLOT, shape: 'pr-flow', label: 'Optical flow', w: 96, h: 80, stroke: '#3B6FB6' }),
  p('pr-flowcolor', 'Flusso (colori)', CV, { ...IMG, shape: 'pr-flow', label: 'Optical flow', spec: 'color' }),
  p('pr-imgpyr', 'Piramide di immagini', CV, { ...ICON, shape: 'pr-imgpyr', label: 'Gaussian pyramid', count: 4, w: 150, h: 76, fill: 'none', stroke: '#9AA0A6', strokeWidth: 1 }),
  p('pr-lappyr', 'Piramide laplaciana', CV, { ...ICON, shape: 'pr-imgpyr', label: 'Laplacian pyramid', spec: 'lap', count: 4, w: 150, h: 76, fill: 'none', stroke: '#9AA0A6', strokeWidth: 1 }),
  // ---------- detection, segmentazione, posa ----------
  p('pr-anchors', 'Anchor box', CV, { ...GRIDDED, shape: 'pr-anchors', label: '$k$ anchor boxes', count: 9, spec: '5x5', w: 84, h: 84, stroke: '#6C8EBF' }),
  p('pr-yolo', 'Griglia S×S', CV, { ...IMG, shape: 'pr-yolo', label: '$S \\times S$ grid on input', spec: '7x7', w: 100, h: 82 }),
  p('pr-yoloboxes', 'Box + confidenza', CV, { ...IMG, shape: 'pr-yolo', label: 'Bounding boxes + confidence', spec: '7x7 boxes', w: 100, h: 82 }),
  p('pr-yoloprob', 'Mappa prob. classi', CV, { ...IMG, shape: 'pr-yolo', label: 'Class probability map', spec: '7x7 prob', w: 100, h: 82 }),
  p('pr-roipool', 'RoI pooling', CV, { ...GRIDDED, shape: 'pr-roipool', label: 'RoI pooling', count: 2, spec: '8x8', w: 84, h: 84, stroke: '#9673A6' }),
  p('pr-roialign', 'RoIAlign', CV, { ...GRIDDED, shape: 'pr-roipool', label: 'RoIAlign', count: 2, spec: '8x8 align', w: 84, h: 84, stroke: '#9673A6' }),
  p('pr-atrous', 'Conv. dilatata', CV, { ...GRIDDED, shape: 'pr-atrous', label: '$3 \\times 3$ conv, rate 2', count: 2, spec: '7x7', w: 70, h: 70, stroke: '#6C8EBF' }),
  p('pr-pose', 'Scheletro (posa)', CV, { ...MED_IMG, shape: 'pr-pose', label: 'Pose estimation', spec: 'photo', count: 1, w: 64, h: 104 }),
  p('pr-skeleton', 'Scheletro', CV, { ...MED_IMG, shape: 'pr-pose', label: 'Keypoints', count: 1, w: 64, h: 104 }),
  p('pr-heat', 'Heatmap keypoint', CV, { ...MED_IMG, shape: 'pr-pose', label: 'Part confidence maps', spec: 'heat', count: 1, w: 64, h: 104 }),
  p('pr-paf', 'Part affinity fields', CV, { ...MED_IMG, shape: 'pr-pose', label: 'Part affinity fields', spec: 'paf', count: 1, w: 64, h: 104 }),
]);

registerTemplates(PATTERN_TEMPLATES);
