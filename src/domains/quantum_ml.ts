// Modulo di dominio "Quantum ML e generative AI": classificatori variazionali, codifica dei dati,
// kernel quantistici, QCNN, re-uploading, transfer learning ibrido, barren plateau e reservoir;
// modelli generativi quantistici (qGAN, QCBM, Boltzmann machine quantistica, QuDDPM, transformer
// quantistico, QCBM come prior, style-qGAN). Costruito sopra i circuiti del modulo quantum
// (`circuit()` in quantum-circuit.ts); forme in quantum_ml-shapes.ts, modelli in quantum_ml-templates.ts.
import './quantum';
import { COLORS, ICON, type NodeModel, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { QC_GATE, QC_INK, QC_PITCH } from './quantum-circuit';
import { QML_SHAPES } from './quantum_ml-shapes';
import { QML_TEMPLATES } from './quantum_ml-templates';

const { BLUE, GREEN, ORANGE, YELLOW, PURPLE, TEAL, WHITE } = COLORS;
const Q = 'Quantum ML';

const P = QC_PITCH, G = QC_GATE;
const BASE = { strokeWidth: 1, fontSize: 14, radius: 2, depth: G / P };
/** Grafico da paper: pannello bianco, bordo grigio chiaro, titolo sotto. */
const PANEL = { ...ICON, fill: '#FFFFFF', stroke: '#C9CED6', strokeWidth: 1, radius: 3 };
const circ = (spec: string, count: number, w: number, h: number): Partial<NodeModel> => ({ shape: 'qc-circuit', spec, count, w, h, fill: 'none', stroke: 'none' });
const box = (label: string, w: number, h: number, color: { fill: string; stroke: string }, extra: Partial<NodeModel> = {}): Partial<NodeModel> => ({ label, w, h, radius: 6, fontSize: 12, strokeWidth: 1.2, ...color, ...extra });
const ry = (k: number, o = 1) => Array.from({ length: k }, (_, q) => `RY[\\theta_${q + o}] ${q}`).join(' & ');

const presets: Preset[] = [
  // ---------------- circuiti ricorrenti (compatti, modificabili come testo) ----------------
  { id: 'qml-angle', name: 'Codifica ad angolo', category: Q, node: circ('RY[x_1] 0 & RY[x_2] 1 & RY[x_3] 2', 3, 130, 140) },
  { id: 'qml-zzmap', name: 'Feature map ZZ (IQP)', category: Q, node: circ('H 0 1; P[2x_1] 0 & P[2x_2] 1; CX 0 1; P[2\\phi_{12}] 1; CX 0 1', 2, 330, 90) },
  { id: 'qml-hea', name: 'Ansatz hardware-efficient', category: Q, node: circ(`${ry(3)}; CZ 0 1; CZ 1 2; ${ry(3, 4)}`, 3, 300, 140) },
  { id: 'qml-reup', name: 'Re-uploading (1 qubit)', category: Q, node: circ('G[U(\\vec{x})] 0; G[U(\\vec{\\phi}_1)] 0; G[U(\\vec{x})] 0; G[U(\\vec{\\phi}_2)] 0; M 0', 1, 340, 56) },
  { id: 'qml-kernelcirc', name: 'Circuito del kernel', category: Q, node: circ("G[U_{\\Phi}(x)] 0-1; G[U^\\dagger_{\\Phi}(x')] 0-1; M 0 1", 2, 230, 100) },
  { id: 'qml-swaptest', name: 'Swap test', category: Q, node: circ('H 0; CSWAP 0 1 2; H 0; M 0', 3, 200, 140) },
  { id: 'qml-qcbmcirc', name: 'QCBM (circuito)', category: Q, node: circ('RX[\\theta] 0 1 2 3; CZ 0 1 & CZ 2 3; CZ 1 2; RY[\\theta] 0 1 2 3; M 0 1 2 3', 4, 320, 180) },
  { id: 'qml-hadtest', name: 'Hadamard test', category: Q, node: circ('H 0; CU[U] 0 1; H 0; M 0', 2, 200, 100) },
  // ---------------- porte e blocchi dei modelli ----------------
  { id: 'qml-qconv', name: 'Convoluzione QCNN', category: Q, node: { shape: 'qc-gate', label: '$U_1$', w: 34, h: P + G, count: 2, ...BASE, radius: 6, ...WHITE } },
  { id: 'qml-qpool', name: 'Pooling QCNN', category: Q, node: { shape: 'qc-ctrl', spec: 'g m', label: '$V_1$', w: 34, h: 2 * P, ...BASE, radius: 6, ...WHITE } },
  { id: 'qml-qfc', name: 'Fully connected QCNN', category: Q, node: { shape: 'qc-gate', label: '$F$', w: 40, h: 2 * P + G, count: 3, ...BASE, radius: 6, ...PURPLE } },
  { id: 'qml-rbs', name: 'Porta RBS(θ)', category: Q, node: { shape: 'qc-ctrl', spec: 'c c', label: '$\\theta$', w: G, h: 2 * P, ...BASE, fill: '#FFFFFF', stroke: QC_INK } },
  { id: 'qml-load', name: 'Caricamento |x⟩', category: Q, node: { shape: 'qc-gate', label: 'Load $|x_i\\rangle$', w: 92, h: G + 6, ...BASE, fontSize: 13, ...WHITE } },
  { id: 'qml-uent', name: 'Entangler U_ent', category: Q, node: { shape: 'qc-gate', label: '$U_{\\mathrm{ent}}$', w: 46, h: 2 * P + G, count: 3, ...BASE, radius: 12, fill: '#E6E6E6', stroke: '#666666' } },
  { id: 'qml-qnode', name: 'Nodo quantistico', category: Q, node: box('quantum\nnode', 84, 46, TEAL, { radius: 10, fontSize: 11 }) },
  { id: 'qml-pshift', name: 'Regola parameter-shift', category: Q, node: box('$\\partial_\\mu f = \\tfrac{1}{2}\\,[\\, f(\\mu{} + \\tfrac{\\pi}{2}) - f(\\mu{} - \\tfrac{\\pi}{2}) \\,]$', 270, 46, YELLOW, { fontSize: 13 }) },
  { id: 'qml-linear', name: 'Strato lineare L', category: Q, node: box('$L_{512 \\to 4}$', 56, 90, GREEN, { fontSize: 14 }) },
  { id: 'qml-qgen', name: 'Generatore quantistico', category: Q, node: box('Quantum generator\n$G_\\theta$', 140, 56, PURPLE, { fontSize: 12 }) },
  { id: 'qml-disc', name: 'Discriminatore classico', category: Q, node: { shape: 'mlp', label: 'Discriminator $D_\\phi$', spec: '4,6,6,1', w: 130, h: 100, strokeWidth: 1.2, ...ICON, ...ORANGE } },
  { id: 'qml-qsc', name: 'Scrambling (QSC)', category: Q, node: box('QSC\n$U_k$', 50, 64, BLUE, { radius: 8, fontSize: 13 }) },
  { id: 'qml-pqcden', name: 'PQC di denoising', category: Q, node: box('PQC\n$\\tilde{U}_k$', 50, 90, GREEN, { radius: 8, fontSize: 13 }) },
  { id: 'qml-ket', name: 'Stato (cerchio)', category: Q, node: { shape: 'ellipse', label: '$\\psi_i^{(k)}$', w: 46, h: 46, fontSize: 14, strokeWidth: 1, fill: '#FFC93C', stroke: '#E0A800' } },
  // ---------------- grafici e dati ----------------
  { id: 'qml-distln', name: 'Distribuzione log-normale', category: Q, node: { shape: 'qml-dist', label: 'PDF', count: 8, spec: 'lognormal target axis index legend', w: 170, h: 120, ...PANEL } },
  { id: 'qml-distbas', name: 'Distribuzione BAS', category: Q, node: { shape: 'qml-dist', label: 'Samples vs data', count: 16, spec: 'bas target bits', w: 220, h: 100, ...PANEL } },
  { id: 'qml-distbi', name: 'Distribuzione bimodale', category: Q, node: { shape: 'qml-dist', label: 'Learned distribution', count: 16, spec: 'bimodal target', w: 170, h: 100, ...PANEL } },
  { id: 'qml-bpvar', name: 'Barren plateau (qubit)', category: Q, node: { shape: 'qml-curve', label: 'Gradient variance', spec: 'variance axis legend', w: 190, h: 140, ...PANEL } },
  { id: 'qml-bplayers', name: 'Barren plateau (strati)', category: Q, node: { shape: 'qml-curve', label: 'Variance vs depth', spec: 'layers axis', count: 6, w: 190, h: 140, ...PANEL } },
  { id: 'qml-landscape', name: 'Paesaggio con plateau', category: Q, node: { shape: 'qml-curve', label: 'Cost landscape', spec: 'landscape legend', w: 180, h: 110, ...PANEL } },
  { id: 'qml-ganloss', name: 'Loss della qGAN', category: Q, node: { shape: 'qml-curve', label: 'Loss functions', spec: 'ganloss axis legend', w: 200, h: 130, ...PANEL } },
  { id: 'qml-kl', name: 'KL durante il training', category: Q, node: { shape: 'qml-curve', label: 'Training', spec: 'kl axis legend', count: 3, w: 190, h: 130, ...PANEL } },
  { id: 'qml-signals', name: 'Segnali misurati', category: Q, node: { shape: 'qml-curve', label: 'Signals', spec: 'signal', count: 4, w: 150, h: 100, ...PANEL } },
  { id: 'qml-input', name: 'Sequenza d\'ingresso', category: Q, node: { shape: 'qml-curve', label: 'Input', spec: 'input', count: 12, w: 150, h: 70, ...PANEL } },
  { id: 'qml-kernelmat', name: 'Matrice di kernel', category: Q, node: { shape: 'qml-kernel', label: 'Kernel matrix $K$', count: 16, spec: 'blocks classes', w: 110, h: 110, strokeWidth: 1, ...ICON, fill: '#FFFFFF', stroke: '#2F6FB2' } },
  { id: 'qml-ensdata', name: 'Ensemble: dati', category: Q, node: { shape: 'qml-ensemble', label: 'Data', count: 4, spec: 'labels', w: 110, h: 110, strokeWidth: 1, ...ICON, fill: '#F7EEEE', stroke: '#D62728' } },
  { id: 'qml-ensnoise', name: 'Ensemble: rumore', category: Q, node: { shape: 'qml-ensemble', label: 'Noise', count: 100, spec: 'labels', w: 110, h: 110, strokeWidth: 1, ...ICON, fill: '#F7EEEE', stroke: '#D62728' } },
  { id: 'qml-ensring', name: 'Ensemble su cerchio', category: Q, node: { shape: 'qml-ensemble', label: 'Generated', count: 6, spec: 'ring labels', w: 110, h: 110, strokeWidth: 1, ...ICON, fill: '#EEF5EE', stroke: '#2E8B57' } },
  { id: 'qml-bas', name: 'Pattern bars & stripes', category: Q, node: { shape: 'qml-pixels', count: 4, spec: 'bas grid', w: 44, h: 44, strokeWidth: 1, ...ICON, fill: '#FFFFFF', stroke: '#3F6FC4' } },
  { id: 'qml-digit', name: 'Cifra (pixel)', category: Q, node: { shape: 'qml-pixels', count: 8, spec: 'digit dark res=16', w: 64, h: 64, strokeWidth: 1, ...ICON, fill: '#111111', stroke: '#FFFFFF' } },
  { id: 'qml-qbm', name: 'Boltzmann machine quantistica', category: Q, node: { shape: 'qml-qbm', count: 8, spec: 'full', w: 200, h: 110, strokeWidth: 1, ...ICON, fill: 'none', stroke: '#333333' } },
  { id: 'qml-qrbm', name: 'QBM ristretta', category: Q, node: { shape: 'qml-qbm', count: 8, spec: 'restricted', w: 200, h: 110, strokeWidth: 1, ...ICON, fill: 'none', stroke: '#333333' } },
  { id: 'qml-spins', name: 'Rete di spin', category: Q, node: { shape: 'qml-spins', label: 'Quantum system', count: 5, spec: 'network', w: 150, h: 110, strokeWidth: 1, ...ICON, fill: '#2F4F7F', stroke: '#2B2B2B' } },
  { id: 'qml-circle', name: 'Dataset cerchio', category: Q, node: { shape: 'qml-data2d', count: 60, spec: 'circle boundary', w: 110, h: 110, ...PANEL } },
  { id: 'qml-spiral', name: 'Dataset spirali', category: Q, node: { shape: 'qml-data2d', count: 50, spec: 'spiral boundary', w: 110, h: 110, ...PANEL } },
];

registerShapes(QML_SHAPES);
registerPresets(presets);
registerTemplates(QML_TEMPLATES);
