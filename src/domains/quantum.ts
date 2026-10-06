// Modulo di dominio "Quantum computing": circuiti quantistici in stile libro di testo
// (porte, controlli, misure, fili classici), sfera di Bloch, istogrammi delle misure,
// ampiezze di Grover, hardware (chip, codice di superficie, transmon, ioni) e BB84.
// Circuiti in quantum-circuit.ts (con l'API `circuit()`), altre forme in quantum-shapes.ts,
// modelli in quantum-templates.ts. Vedi src/registry.ts e src/domains/README.md.
import { COLORS, ICON, type NodeModel, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { QC_GATE, QC_INK, QC_PITCH } from './quantum-circuit';
import { QUANTUM_SHAPES } from './quantum-shapes';
import { QUANTUM_TEMPLATES } from './quantum-templates';

const { BLUE, GREEN, ORANGE, YELLOW, PURPLE, TEAL, WHITE } = COLORS;
const S = 'Circuiti quantistici';
const Q = 'Quantum computing';

const P = QC_PITCH, G = QC_GATE;
/** Altezza di un elemento che copre k fili. */
const span = (k: number) => (k - 1) * P + G;
const BASE = { strokeWidth: 1, fontSize: 14, radius: 2, depth: G / P };
const gate = (label: string, w = G, extra: Partial<NodeModel> = {}): Partial<NodeModel> => ({ shape: 'qc-gate', label, w, h: G, ...BASE, ...WHITE, ...extra });
const ctrl = (spec: string, k: number, extra: Partial<NodeModel> = {}): Partial<NodeModel> => ({ shape: 'qc-ctrl', spec, w: G, h: k * P, ...BASE, fill: '#FFFFFF', stroke: QC_INK, ...extra });
const block = (label: string, w: number, k: number, color = WHITE, extra: Partial<NodeModel> = {}): Partial<NodeModel> => ({ shape: 'qc-gate', label, w, h: span(k), count: k, ...BASE, ...color, ...extra });
const wire = (spec: string, label: string, extra: Partial<NodeModel> = {}): Partial<NodeModel> => ({ shape: 'qc-wire', spec, label, w: 100, h: 16, fill: 'none', stroke: QC_INK, strokeWidth: 1, fontSize: 14, ...extra });
const PLOT = { fill: 'none', strokeWidth: 1, ...ICON, fontSize: 11 };

const presets: Preset[] = [
  // ---------------- fili ed etichette ----------------
  { id: 'qc-wire', name: 'Filo qubit', category: S, node: wire('quantum', '$|0\\rangle$') },
  { id: 'qc-cwire', name: 'Filo classico', category: S, node: wire('classical', '$c$') },
  { id: 'qc-register', name: 'Registro n qubit', category: S, node: wire('bundle n', '$|0\\rangle^{\\otimes n}$', { h: 24 }) },
  { id: 'qc-ket', name: 'Stato iniziale |0⟩', category: S, node: { shape: 'text', label: '$|0\\rangle$', w: 40, h: 24, fill: 'none', stroke: 'none', fontSize: 14 } },
  { id: 'qc-ketpsi', name: 'Stato |ψ⟩', category: S, node: { shape: 'text', label: '$|\\psi\\rangle$', w: 40, h: 24, fill: 'none', stroke: 'none', fontSize: 14 } },
  // ---------------- porte a un qubit ----------------
  { id: 'qc-h', name: 'Hadamard H', category: S, node: gate('$H$') },
  { id: 'qc-x', name: 'Pauli X', category: S, node: gate('$X$') },
  { id: 'qc-y', name: 'Pauli Y', category: S, node: gate('$Y$') },
  { id: 'qc-z', name: 'Pauli Z', category: S, node: gate('$Z$') },
  { id: 'qc-s', name: 'Fase S', category: S, node: gate('$S$') },
  { id: 'qc-t', name: 'Porta T', category: S, node: gate('$T$') },
  { id: 'qc-rx', name: 'Rotazione Rx(θ)', category: S, node: gate('$R_x(\\theta)$', 54) },
  { id: 'qc-ry', name: 'Rotazione Ry(θ)', category: S, node: gate('$R_y(\\theta)$', 54) },
  { id: 'qc-rz', name: 'Rotazione Rz(θ)', category: S, node: gate('$R_z(\\theta)$', 54) },
  { id: 'qc-u', name: 'Porta U(θ,φ,λ)', category: S, node: gate('$U(\\theta,\\phi,\\lambda)$', 80) },
  { id: 'qc-hpastel', name: 'H (colorata)', category: S, node: gate('$H$', G, BLUE) },
  { id: 'qc-rypastel', name: 'Ry(θ) (colorata)', category: S, node: gate('$R_y(\\theta)$', 54, PURPLE) },
  // ---------------- blocchi su più fili ----------------
  { id: 'qc-featuremap', name: 'Feature map U_Φ(x)', category: S, node: block('$U_{\\Phi}(x)$', 64, 3, BLUE) },
  { id: 'qc-oracle', name: 'Oracolo U_f', category: S, node: block('$U_f$', 46, 3, YELLOW) },
  { id: 'qc-qft', name: 'QFT', category: S, node: block('$\\mathrm{QFT}$', 54, 3, ORANGE) },
  { id: 'qc-iqft', name: 'QFT inversa', category: S, node: block('$\\mathrm{QFT}^\\dagger$', 58, 3, ORANGE) },
  { id: 'qc-ansatz', name: 'Strato ansatz', category: S, node: block('$U(\\theta)$', 64, 3, PURPLE, { spec: 'stack' }) },
  { id: 'qc-block', name: 'Blocco con indici', category: S, node: block('$U$', 50, 3, WHITE, { spec: 'idx' }) },
  // ---------------- porte controllate ----------------
  { id: 'qc-ctrl', name: 'Punto di controllo', category: S, node: ctrl('c', 1) },
  { id: 'qc-octrl', name: 'Controllo aperto', category: S, node: ctrl('o', 1) },
  { id: 'qc-target', name: 'Bersaglio ⊕', category: S, node: ctrl('t', 1) },
  { id: 'qc-cnot', name: 'CNOT', category: S, node: ctrl('c t', 2) },
  { id: 'qc-cnotfar', name: 'CNOT a distanza', category: S, node: ctrl('c . t', 3) },
  { id: 'qc-cz', name: 'CZ', category: S, node: ctrl('c c', 2) },
  { id: 'qc-swap', name: 'SWAP', category: S, node: ctrl('x x', 2) },
  { id: 'qc-toffoli', name: 'Toffoli (CCX)', category: S, node: ctrl('c c t', 3) },
  { id: 'qc-fredkin', name: 'Fredkin (CSWAP)', category: S, node: ctrl('c x x', 3) },
  { id: 'qc-cu', name: 'U controllata', category: S, node: ctrl('c g', 2, { label: '$U$', w: 34 }) },
  { id: 'qc-crk', name: 'Rotazione R_k controllata', category: S, node: ctrl('g c', 2, { label: '$R_k$', w: 34 }) },
  { id: 'qc-cphase', name: 'Fase controllata', category: S, node: ctrl('c c', 2, { label: '$P(\\lambda)$', w: G }) },
  { id: 'qc-classctrl', name: 'Controllo classico', category: S, node: ctrl('k g', 2, { label: '$X$' }) },
  // ---------------- misura e barriere ----------------
  { id: 'qc-meter', name: 'Misura', category: S, node: { shape: 'qc-meter', w: G + 4, h: G, ...BASE, ...WHITE } },
  { id: 'qc-measbit', name: 'Misura su bit', category: S, node: ctrl('m . a', 3, { w: G + 4, ...WHITE }) },
  { id: 'qc-barrier', name: 'Barriera', category: S, node: { shape: 'qc-barrier', spec: 'band', w: 10, h: 3 * P - 8, fill: '#ECEDEF', stroke: '#8A8F98', strokeWidth: 1 } },
  { id: 'qc-slice', name: 'Linea di stato', category: S, node: { shape: 'qc-barrier', label: '$|\\psi_1\\rangle$', labelPos: 'below', w: 12, h: span(3) + 12, fill: 'none', stroke: '#8A8F98', strokeWidth: 1, fontSize: 13 } },
  // ---------------- circuiti compatti ----------------
  { id: 'qc-circbell', name: 'Circuito di Bell', category: S, node: { shape: 'qc-circuit', spec: 'H 0; CX 0 1; M 0 1', count: 2, w: 210, h: 90, fill: 'none', stroke: 'none' } },
  { id: 'qc-circghz', name: 'Circuito GHZ', category: S, node: { shape: 'qc-circuit', spec: 'H 0; CX 0 1; CX 1 2; M 0 1 2', count: 3, w: 240, h: 130, fill: 'none', stroke: 'none' } },
  { id: 'qc-circvqa', name: 'Circuito variazionale', category: S, node: { shape: 'qc-circuit', spec: 'RY[\\theta_1] 0 & RY[\\theta_2] 1 & RY[\\theta_3] 2; CX 0 1; CX 1 2; M 0 1 2', count: 3, w: 260, h: 130, fill: 'none', stroke: 'none' } },

  // ---------------- stati e misure ----------------
  { id: 'qc-bloch', name: 'Sfera di Bloch', category: Q, node: { shape: 'qc-bloch', count: 55, spec: 'labels angles psi phi=50', w: 130, h: 130, fill: '#EEF3FA', stroke: '#5B6B80', strokeWidth: 1, ...ICON } },
  { id: 'qc-blochplus', name: 'Bloch |+⟩', category: Q, node: { shape: 'qc-bloch', count: 90, spec: 'labels phi=0', label: '$|+\\rangle$', w: 110, h: 110, fill: '#EEF3FA', stroke: '#5B6B80', strokeWidth: 1, ...ICON, fontSize: 13 } },
  { id: 'qc-hist', name: 'Istogramma misure', category: Q, node: { shape: 'qc-hist', count: 2, spec: 'bell values', label: 'Measurement outcomes', w: 120, h: 80, stroke: '#5B8DD6', ...PLOT } },
  { id: 'qc-histnoisy', name: 'Misure con rumore', category: Q, node: { shape: 'qc-hist', count: 3, spec: 'bell noisy values axis', label: 'Counts (hardware)', w: 170, h: 90, stroke: '#5B8DD6', ...PLOT } },
  { id: 'qc-ampsuni', name: 'Ampiezze uniformi', category: Q, node: { shape: 'qc-amps', count: 8, spec: 'uniform mean', label: 'Superposition', w: 110, h: 70, stroke: '#5B8DD6', ...PLOT } },
  { id: 'qc-ampsoracle', name: 'Ampiezze (oracolo)', category: Q, node: { shape: 'qc-amps', count: 8, spec: 'oracle mean labels', label: 'Oracle', w: 110, h: 70, stroke: '#5B8DD6', ...PLOT } },
  { id: 'qc-ampsdiff', name: 'Ampiezze (diffusione)', category: Q, node: { shape: 'qc-amps', count: 8, spec: 'diffuse mean labels', label: 'Diffusion', w: 110, h: 70, stroke: '#5B8DD6', ...PLOT } },
  // ---------------- hardware ----------------
  { id: 'qc-chipgrid', name: 'Chip a reticolo', category: Q, node: { shape: 'qc-chip', spec: 'grid 3x4 numbers', w: 130, h: 100, fill: '#DAE8FC', stroke: '#6C8EBF', textColor: '#2F4F7F', strokeWidth: 1, ...ICON, label: 'Coupling map' } },
  { id: 'qc-heavyhex', name: 'Heavy-hex (IBM)', category: Q, node: { shape: 'qc-chip', spec: 'heavyhex 3x9', w: 200, h: 100, fill: '#DAE8FC', stroke: '#6C8EBF', strokeWidth: 1, ...ICON, label: 'Heavy-hex lattice' } },
  { id: 'qc-ring', name: 'Anello di qubit', category: Q, node: { shape: 'qc-chip', spec: 'ring numbers', count: 8, w: 100, h: 100, fill: '#D5E8D4', stroke: '#82B366', textColor: '#2E5A2B', strokeWidth: 1, ...ICON } },
  { id: 'qc-surface', name: 'Codice di superficie', category: Q, node: { shape: 'qc-surface', count: 5, spec: 'ancilla', w: 140, h: 140, fill: 'none', stroke: '#333333', strokeWidth: 1, ...ICON, label: 'Surface code ($d=5$)' } },
  { id: 'qc-surfaceerr', name: 'Sindrome di errore', category: Q, node: { shape: 'qc-surface', count: 3, spec: 'labels error', w: 110, h: 110, fill: 'none', stroke: '#333333', strokeWidth: 1, ...ICON, label: 'Syndrome' } },
  { id: 'qc-levels', name: 'Qubit a due livelli', category: Q, node: { shape: 'qc-levels', spec: 'qubit labels drive', count: 2, w: 90, h: 70, fill: 'none', stroke: '#2F6FB2', strokeWidth: 1, ...ICON } },
  { id: 'qc-transmonwell', name: 'Pozzo del transmon', category: Q, node: { shape: 'qc-levels', spec: 'transmon well labels drive', count: 4, w: 140, h: 110, fill: '#EEF3FA', stroke: '#5B6B80', strokeWidth: 1, ...ICON, label: 'Transmon' } },
  { id: 'qc-harmonic', name: 'Oscillatore armonico', category: Q, node: { shape: 'qc-levels', spec: 'harmonic well labels', count: 4, w: 130, h: 100, fill: '#F5F5F5', stroke: '#666666', strokeWidth: 1, ...ICON, label: 'Harmonic oscillator' } },
  { id: 'qc-transmon', name: 'Transmon', category: Q, node: { shape: 'qc-device', spec: 'transmon', label: 'Transmon', w: 96, h: 72, fill: '#E8EEF6', stroke: '#4B5B70', strokeWidth: 1, ...ICON } },
  { id: 'qc-iontrap', name: 'Trappola di ioni', category: Q, node: { shape: 'qc-device', spec: 'ion', label: 'Trapped ions', w: 130, h: 70, fill: 'none', stroke: '#4B5B70', strokeWidth: 1, ...ICON } },
  { id: 'qc-atoms', name: 'Atomi neutri', category: Q, node: { shape: 'qc-device', spec: 'atom 3x5', label: 'Neutral atoms', w: 120, h: 76, fill: 'none', stroke: '#4B5B70', strokeWidth: 1, ...ICON } },
  { id: 'qc-fridge', name: 'Criostato', category: Q, node: { shape: 'qc-device', spec: 'fridge', label: 'Dilution refrigerator', w: 90, h: 120, fill: '#E8EEF6', stroke: '#4B5B70', strokeWidth: 1, ...ICON } },
  { id: 'qc-qpu', name: 'Chip QPU', category: Q, node: { shape: 'qc-device', spec: 'chip', label: 'QPU', w: 80, h: 80, fill: '#E1D5E7', stroke: '#6B4F7E', strokeWidth: 1, ...ICON } },
  { id: 'qc-photon', name: 'Fotone', category: Q, node: { shape: 'qc-device', spec: 'photon', w: 90, h: 30, fill: 'none', stroke: '#C0392B', strokeWidth: 1.2, ...ICON } },
  // ---------------- crittografia quantistica (BB84) ----------------
  { id: 'qc-polh', name: 'Polarizzazione ↔', category: Q, node: { shape: 'qc-polar', spec: 'h circle', w: 30, h: 30, ...WHITE, strokeWidth: 1, ...ICON } },
  { id: 'qc-polv', name: 'Polarizzazione ↕', category: Q, node: { shape: 'qc-polar', spec: 'v circle', w: 30, h: 30, ...WHITE, strokeWidth: 1, ...ICON } },
  { id: 'qc-pold', name: 'Polarizzazione ⤢', category: Q, node: { shape: 'qc-polar', spec: 'd circle', w: 30, h: 30, ...WHITE, strokeWidth: 1, ...ICON } },
  { id: 'qc-pola', name: 'Polarizzazione ⤡', category: Q, node: { shape: 'qc-polar', spec: 'a circle', w: 30, h: 30, ...WHITE, strokeWidth: 1, ...ICON } },
  { id: 'qc-basisrect', name: 'Base +', category: Q, node: { shape: 'qc-polar', spec: 'rect', w: 28, h: 28, fill: 'none', stroke: '#2F6FB2', strokeWidth: 1.2, ...ICON } },
  { id: 'qc-basisdiag', name: 'Base ×', category: Q, node: { shape: 'qc-polar', spec: 'diag', w: 28, h: 28, fill: 'none', stroke: '#2E8B57', strokeWidth: 1.2, ...ICON } },
  { id: 'qc-qchannel', name: 'Canale quantistico', category: Q, node: { label: 'Quantum channel', w: 150, h: 34, radius: 17, fontSize: 12, strokeWidth: 1.2, ...TEAL } },
  { id: 'qc-optimizer', name: 'Ottimizzatore classico', category: Q, node: { label: 'Classical\noptimizer', w: 120, h: 56, radius: 6, fontSize: 12, strokeWidth: 1.2, ...GREEN } },
];

registerShapes(QUANTUM_SHAPES);
registerPresets(presets);
registerTemplates(QUANTUM_TEMPLATES);
