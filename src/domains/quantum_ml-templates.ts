// Modelli del modulo "Quantum ML e generative AI": figure principali degli articoli di riferimento,
// ridisegnate con i circuiti di `circuit()` (quantum-circuit.ts) e le forme qml-. Ogni filo, porta,
// grafico e riquadro resta un blocco modificabile.
import { Builder, FROZEN, type Color } from '../builder';
import { COLORS, ICON, type EdgeModel, type NodeModel, type Side } from '../model';
import type { TemplateDef } from '../registry';
import { circuit, QC_GATE, QC_INK, QC_PITCH, type Circuit } from './quantum-circuit';

const { BLUE, GREEN, ORANGE, YELLOW, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const ML = 'Quantum ML';
const GEN = 'Quantum generative AI';
const K0 = '$|0\\rangle$';
const SOFT = '#555555';
const MUTED = '#8A8F98';
const PANEL = { fill: '#FFFFFF', stroke: '#C9CED6', strokeWidth: 1, radius: 3, ...ICON, fontSize: 11 };
const BASE = { strokeWidth: 1, fontSize: 14, radius: 2, depth: QC_GATE / QC_PITCH };
type R = { x: number; y: number; w: number; h: number };

/** Porta i nodi indicati sul fondo (pannelli e fasce che contengono altri blocchi). */
const toBack = (t: Builder, ...ns: NodeModel[]) => (t.nodes = [...ns, ...t.nodes.filter((n) => !ns.includes(n))]);
/** Estremo invisibile centrato in (x, y). */
const pt = (t: Builder, x: number, y: number) => t.anchor(x - 0.5, y - 0.5);
/** Testo centrato in (cx, cy), allineato a sinistra da x o a destra fino a xr. */
const txt = (t: Builder, s: string, cx: number, cy: number, w: number, extra: Partial<NodeModel> = {}) => t.text(s, cx - w / 2, cy - 11, w, 22, { fontSize: 13, ...extra });
const ltxt = (t: Builder, s: string, x: number, cy: number, w: number, extra: Partial<NodeModel> = {}) => t.text(s, x, cy - 11, w, 22, { fontSize: 13, align: 'left', ...extra });
const rtxt = (t: Builder, s: string, xr: number, cy: number, w: number, extra: Partial<NodeModel> = {}) => t.text(s, xr - w, cy - 11, w, 22, { fontSize: 13, align: 'right', ...extra });
const brace = (t: Builder, direction: Side, x: number, y: number, w: number, h: number) => t.add({ shape: 'brace', direction, x, y, w, h, fill: 'none', stroke: SOFT, strokeWidth: 1.1 });
/** Riquadro tratteggiato con il titolo sopra le porte. */
const region = (t: Builder, label: string, r: R, extra: Partial<NodeModel> = {}) => t.group(label, r.x, r.y - 20, r.w, r.h + 20, { fontSize: 11, ...extra });
const block = (t: Builder, label: string, cx: number, cy: number, w: number, h: number, c: Color, extra: Partial<NodeModel> = {}) =>
  t.box(label, cx - w / 2, cy - h / 2, w, h, c, { radius: 6, fontSize: 12, ...extra });
/** Pannello a tinta unita con titolo in grassetto (processore quantistico, computer classico…). */
const panel = (t: Builder, label: string, x: number, y: number, w: number, h: number, extra: Partial<NodeModel> = {}) =>
  t.group(label, x, y, w, h, { fontSize: 12, bold: true, dashed: false, stroke: '#B8BEC8', fill: '#FAFBFC', ...extra });
/** Segmento senza freccia fra due punti (fili piegati, linee di guida). */
const seg = (t: Builder, x0: number, y0: number, x1: number, y1: number, extra: Partial<EdgeModel> = {}) =>
  t.link(pt(t, x0, y0), pt(t, x1, y1), 'right', 'left', { arrowEnd: false, routing: 'straight', color: QC_INK, width: 1, ...extra });
/** Filo quantistico orizzontale. */
const wire = (t: Builder, x0: number, x1: number, y: number, label = '') =>
  t.add({ shape: 'qc-wire', spec: 'quantum', label, x: x0, y: y - 8, w: x1 - x0, h: 16, fill: 'none', stroke: QC_INK, ...BASE });
const plot = (t: Builder, shape: string, spec: string, count: number, label: string, x: number, y: number, w: number, h: number, extra: Partial<NodeModel> = {}) =>
  t.add({ shape, spec, count, label, x, y, w, h, ...PANEL, ...extra });
/** Graffa a destra dei fili q0..q1 del circuito, con etichetta. */
function outBrace(t: Builder, c: Circuit, q0: number, q1: number, label: string, x = c.x1 + 6) {
  brace(t, 'right', x, c.ys[q0] - 10, 10, c.ys[q1] - c.ys[q0] + 20);
  ltxt(t, label, x + 15, (c.ys[q0] + c.ys[q1]) / 2, 90, { fontSize: 14 });
}
/** Graffa a sinistra dei fili q0..q1, con etichetta. */
function inBrace(t: Builder, c: Circuit, q0: number, q1: number, label: string, x: number, w = 90) {
  brace(t, 'left', x, c.ys[q0] - 10, 10, c.ys[q1] - c.ys[q0] + 20);
  rtxt(t, label, x - 5, (c.ys[q0] + c.ys[q1]) / 2, w, { fontSize: 14 });
}
/** Spezzata fra punti (segmenti dritti), freccia sull'ultimo tratto. */
function path(t: Builder, pts: [number, number][], extra: Partial<EdgeModel> = {}) {
  const ns = pts.map(([x, y]) => pt(t, x, y));
  for (let i = 1; i < ns.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const horiz = Math.abs(y1 - y0) < Math.abs(x1 - x0);
    const sa: Side = horiz ? (x1 > x0 ? 'right' : 'left') : y1 > y0 ? 'bottom' : 'top';
    const sb: Side = horiz ? (x1 > x0 ? 'left' : 'right') : y1 > y0 ? 'top' : 'bottom';
    t.link(ns[i - 1], ns[i], sa, sb, { routing: 'straight', width: 1.1, ...extra, arrowEnd: i === ns.length - 1 && extra.arrowEnd !== false });
  }
}
/** Linea orizzontale sottile (tabelle). */
const rule = (t: Builder, x0: number, x1: number, y: number, width = 0.8) => seg(t, x0, y, x1, y, { color: SOFT, width });
const cx = (r: R) => r.x + r.w / 2;

// ======================================================================
// Quantum ML
// ======================================================================

/**
 * Havlíček et al., "Supervised learning with quantum-enhanced feature spaces", Nature 567 (2019), arXiv:1804.11326,
 * Fig. 1–2: feature map U_Φ(x) = U_Φ H U_Φ H, classificatore variazionale W(θ), parità delle misure e decisione.
 */
function vqc() {
  const t = new Builder();
  const H4 = 'H 0 1 2 3';
  const c = circuit(t, 70, 170, [H4, 'G[U_{\\Phi(\\vec{x})}] 0-3 @blue', H4, 'G[U_{\\Phi(\\vec{x})}] 0-3 @blue', 'G[W(\\vec{\\theta})] 0-3 @purple w=66', 'M 0 1 2 3']);
  const fm = c.around(0, 3, 0, 3, 5), va = c.around(4, 4, 0, 3, 5);
  region(t, 'Feature map $\\mathcal{U}_{\\Phi(\\vec{x})}$', fm, { stroke: '#6C8EBF', textColor: '#2F5E9E' });
  const vg = region(t, 'Variational', va, { stroke: '#9673A6', textColor: '#6B4F7E' });
  // dati in ingresso
  const data = plot(t, 'qml-data2d', 'circle', 26, '', fm.x + fm.w - 150, 14, 64, 64);
  ltxt(t, 'training data\n$\\vec{x} \\in \\mathbb{R}^n$, labels $y$', fm.x + fm.w - 78, 46, 140, { h: 40, y: 26, fontSize: 12 });
  t.link(data, pt(t, data.x + 32, fm.y - 20), 'bottom', 'top', { label: '$\\vec{x}$', labelPos: 'above', fontSize: 13 });
  // elaborazione classica delle misure
  const bx = c.x1 + 140;
  const b1 = block(t, 'Boolean function (parity)\n$f(z) = z_1 \\oplus \\cdots \\oplus z_n$', bx, c.ys[0] + 2, 210, 48, YELLOW);
  const mid = (c.ys[1] + c.ys[2]) / 2;
  const b2 = block(t, 'Estimate $\\hat{p}_y(\\vec{x})$ from $R$ shots', bx, mid + 6, 210, 38, ORANGE);
  const b3 = block(t, 'Label $\\tilde{m}(\\vec{x}) = \\arg\\max_y \\hat{p}_y(\\vec{x})$', bx, c.ys[3] + 10, 210, 44, GREEN, { fontSize: 13 });
  t.chain([b1, b2, b3], 'down');
  t.link(pt(t, c.x1 + 4, b1.y + b1.h / 2), b1, 'right', 'left', { label: '$z$', labelPos: 'above', fontSize: 13 });
  const opt = block(t, 'Optimizer (SPSA)\nmin $R_{\\mathrm{emp}}(\\vec{\\theta})$', bx + 210, mid + 6, 140, 50, GRAY);
  t.link(b2, opt, 'right', 'left', { label: 'cost', labelPos: 'above', fontSize: 10 });
  t.link(opt, vg, 'top', 'top', { label: '$\\vec{\\theta}$', labelPos: 'above', fontSize: 13, color: '#6B4F7E' });
  txt(t, '$U_{\\Phi(\\vec{x})} = \\exp(i \\sum_{S \\subseteq [n]} \\phi_S(\\vec{x}) \\prod_{i \\in S} Z_i)$', cx(fm) + 10, c.bottom + 34, 330, { fontSize: 14, h: 44, y: c.bottom + 12 });
  // decomposizioni (Fig. 1C e 2B)
  const y2 = c.bottom + 110;
  rtxt(t, '$W(\\vec{\\theta}) =$', 96, y2 + 63, 70, { fontSize: 14 });
  const th = (o: number) => [0, 1, 2, 3].map((q) => `G[\\theta_{${q + o}}] ${q}`).join(' & ');
  const w = circuit(t, 110, y2, [th(1), 'CZ 0 1', 'CZ 1 2', 'CZ 2 3', th(5), '...', th(9)], { inputs: ['', '', '', ''], lead: 10, tail: 10 });
  const ent = w.around(1, 3, 0, 3, 5);
  region(t, '$U_{\\mathrm{ent}}$', ent, { stroke: '#B8BEC8' });
  brace(t, 'bottom', w.left[1] - 4, w.bottom + 10, w.right[4] - w.left[1] + 8, 12);
  txt(t, 'repeat $l$ times', (w.left[1] + w.right[4]) / 2, w.bottom + 36, 120, { fontSize: 12, textColor: SOFT });
  const zx = w.x1 + 180;
  rtxt(t, '$\\exp(i\\,\\phi_{l,m}(\\vec{x})\\, Z_l Z_m) =$', zx - 14, y2 + 21 + 42, 210, { fontSize: 14 });
  const z = circuit(t, zx + 26, y2 + 42, ['CX 0 1', 'G[Z_{\\phi}] 1', 'CX 0 1'], { inputs: ['$q_l$', '$q_m$'], lead: 10, tail: 10 });
  txt(t, '$\\phi_i(\\vec{x}) = x_i$,   $\\phi_{l,m}(\\vec{x}) = (\\pi{} - x_l)(\\pi{} - x_m)$', (zx - 160 + z.x1) / 2, z.bottom + 30, 330, { fontSize: 13, textColor: SOFT });
  return t.done();
}

/**
 * Codifica dei dati nei circuiti (Schuld & Petruccione 2018; LaRose & Coyle 2020, arXiv:2003.01695;
 * feature map ZZ di Havlíček et al. 2019): base, angolo, ampiezza e IQP a confronto.
 */
function encodings() {
  const t = new Builder();
  const W = 330, H = 250, gap = 24;
  const cell = (i: number, title: string) => {
    const x = 20 + (i % 2) * (W + gap), y = 20 + Math.floor(i / 2) * (H + gap);
    panel(t, title, x, y, W, H);
    return { x, y };
  };
  // (a) base
  let p = cell(0, '(a) Basis encoding');
  const a = circuit(t, p.x + 70, p.y + 58, ['X 0 & X 2 & X 3', 'M 0 1 2 3'], { pitch: 30, gate: 24, tail: 12 });
  outBrace(t, a, 0, 3, '$|1011\\rangle$', a.x1 + 4);
  txt(t, '$\\vec{x} = (1, 0, 1, 1) \\;\\mapsto\\; |x_1 x_2 \\dots x_n\\rangle$', p.x + W / 2, p.y + H - 42, W - 20, { fontSize: 13 });
  txt(t, '$n$ bits $\\to$ $n$ qubits', p.x + W / 2, p.y + H - 18, W - 20, { fontSize: 12, textColor: SOFT });
  // (b) angolo
  p = cell(1, '(b) Angle encoding');
  const b = circuit(t, p.x + 60, p.y + 58, ['RY[x_1] 0 & RY[x_2] 1 & RY[x_3] 2 & RY[x_4] 3'], { pitch: 30, gate: 24, tail: 12 });
  t.add({ shape: 'qc-bloch', count: 60, spec: 'labels phi=35', x: b.x1 + 34, y: p.y + 40, w: 104, h: 104, fill: '#EEF3FA', stroke: '#5B6B80', strokeWidth: 1, ...ICON, label: '' });
  txt(t, '$|\\psi(\\vec{x})\\rangle = \\bigotimes_i\\, (\\cos\\frac{x_i}{2}|0\\rangle + \\sin\\frac{x_i}{2}|1\\rangle)$', p.x + W / 2, p.y + H - 46, W - 16, { fontSize: 13, h: 32, y: p.y + H - 62 });
  txt(t, '$n$ features $\\to$ $n$ qubits, one rotation each', p.x + W / 2, p.y + H - 18, W - 20, { fontSize: 12, textColor: SOFT });
  // (c) ampiezza
  p = cell(2, '(c) Amplitude encoding');
  const c = circuit(t, p.x + 56, p.y + 70, ['G[S_{\\vec{x}}] 0-1 @orange w=56'], { pitch: 40, gate: 28, tail: 14 });
  outBrace(t, c, 0, 1, '$\\frac{1}{\\|\\vec{x}\\|}\\sum_{i=0}^{N-1} x_i |i\\rangle$', c.x1 + 4);
  plot(t, 'qml-dist', 'gauss data', 4, '', p.x + W - 92, p.y + 56, 74, 66, { fill: 'none' });
  txt(t, 'amplitudes $x_i$', p.x + W - 55, p.y + 136, 90, { fontSize: 11, textColor: SOFT });
  txt(t, 'state preparation  $S_{\\vec{x}}: |0\\rangle^{\\otimes m} \\mapsto |\\psi(\\vec{x})\\rangle$', p.x + W / 2, p.y + H - 46, W - 16, { fontSize: 13 });
  txt(t, '$N$ features $\\to$ $m = \\lceil\\log_2 N\\rceil$ qubits, deep circuit', p.x + W / 2, p.y + H - 18, W - 20, { fontSize: 12, textColor: SOFT });
  // (d) IQP / ZZ
  p = cell(3, '(d) ZZ feature map (IQP)');
  const d = circuit(t, p.x + 44, p.y + 70, ['H 0 1', 'P[2x_1] 0 & P[2x_2] 1', 'CX 0 1', 'P[2\\phi_{12}] 1', 'CX 0 1'], { pitch: 40, gate: 26, tail: 10, lead: 10, fontSize: 13 });
  const rr = d.around(0, 4, 0, 1, 5);
  t.group('', rr.x, rr.y, rr.w, rr.h, { stroke: '#B8BEC8' });
  rtxt(t, 'repeated $r$ times', rr.x + rr.w, rr.y - 11, 140, { fontSize: 11, textColor: SOFT });
  txt(t, '$\\phi_{12} = (\\pi{} - x_1)(\\pi{} - x_2)$', p.x + W / 2, p.y + H - 70, W - 20, { fontSize: 13 });
  txt(t, '$U_{\\Phi}(\\vec{x}) = \\exp(i \\sum_{S} \\phi_S(\\vec{x}) \\prod_{i \\in S} Z_i)\\, H^{\\otimes n}$', p.x + W / 2, p.y + H - 36, W - 16, { fontSize: 13, h: 40, y: p.y + H - 58 });
  txt(t, 'hard to simulate classically for $r \\ge 2$', p.x + W / 2, p.y + H - 12, W - 20, { fontSize: 12, textColor: SOFT });
  return t.done();
}

/**
 * Schuld, Bergholm, Gogolin, Izaac & Killoran, "Evaluating analytic gradients on quantum hardware", PRA 99 (2019),
 * arXiv:1811.11184, Fig. 1: nodo quantistico in un calcolo ibrido e regola del parameter shift.
 */
function parameterShift() {
  const t = new Builder();
  // grafo del calcolo ibrido
  panel(t, '', 20, 20, 1200, 200, { fill: '#F6F7F9', stroke: '#DADDE2' });
  const tl = (x: number, y: number, l = '') => t.box(l, x, y, 42, 30, TEAL, { radius: 9, fontSize: 10 });
  const sq = (x: number, y: number, l = '') => t.box(l, x, y, 40, 34, ORANGE, { radius: 2, fontSize: 10 });
  const n1 = tl(110, 44), cn = sq(70, 104, 'classical\nnode');
  cn.w = 66;
  cn.h = 44;
  const n2 = tl(240, 74), n3 = tl(150, 168), n4 = sq(290, 166), n5 = sq(370, 70), n6 = tl(470, 52);
  const qn = t.box('quantum\nnode', 455, 140, 84, 46, TEAL, { radius: 10, fontSize: 11 });
  const n7 = sq(720, 92), n8 = sq(940, 120);
  const cost = ltxt(t, 'Cost$(\\theta)$', 1030, 137, 90, { fontSize: 14 });
  const S = { routing: 'straight' as const, width: 1 };
  t.link(n1, n2, 'right', 'left', S);
  t.link(cn, n2, 'right', 'left', S);
  t.link(cn, n3, 'bottom', 'top', S);
  t.link(n3, n4, 'right', 'left', S);
  t.link(n2, n5, 'right', 'left', S);
  t.link(n4, n6, 'right', 'left', S);
  t.link(n5, n6, 'right', 'left', S);
  t.link(n4, qn, 'right', 'left', S);
  t.link(n6, n7, 'right', 'left', S);
  t.link(qn, n8, 'right', 'left', S);
  t.link(n7, n8, 'right', 'left', S);
  t.link(n8, cost, 'right', 'left', S);
  brace(t, 'top', 300, 30, 880, 10);
  txt(t, 'hybrid computation', 740, 54, 160, { fontSize: 12, textColor: SOFT });
  // dispositivi quantistici: circuito originale e circuiti traslati
  const y0 = 330;
  const dev = (x: number, mu: string) => {
    const cols = [`G[\\mathcal{G}(${mu})] 1 @red & G[\\mathcal{G}(\\theta_1)] 3`, 'CZ 0 1', 'G[\\mathcal{G}(\\theta_2)] 0 & G[\\mathcal{G}(\\theta_3)] 2', 'CX 1 2', 'G[\\mathcal{G}(\\theta_4)] 2-3', 'M 0 1 2 3'];
    const c = circuit(t, x + 34, y0 + 46, cols, { pitch: 30, gate: 22, gap: 10, fontSize: 11, lead: 8, tail: 8 });
    const r = c.around(0, 5, 0, 3, 8);
    return t.group('$U(\\theta)$', r.x - 32, r.y - 18, r.w + 32, r.h + 18, { fontSize: 11, fill: '#EEF0FB', stroke: '#6B6FA8' });
  };
  const d1 = dev(40, '\\mu');
  const d2 = dev(500, '\\mu{} + s');
  const d3 = dev(d2.x + d2.w + 46, '\\mu{} - s');
  const frame = (x0: number, x1: number) => t.group('', x0, d1.y - 12, x1 - x0, d1.h + 24, { dashed: false, fill: '#D9DCE1', stroke: '#C4C8CE', radius: 18 });
  const f1 = frame(d1.x - 12, d1.x + d1.w + 12);
  const f2 = frame(d2.x - 12, d3.x + d3.w + 12);
  toBack(t, f1, f2);
  txt(t, '$-$', (d2.x + d2.w + d3.x) / 2, d2.y + d2.h / 2, 20, { fontSize: 22 });
  rtxt(t, 'quantum\ndevice', f1.x - 8, f1.y + f1.h / 2, 70, { fontSize: 12, textColor: '#5B5FA8', h: 34, y: f1.y + f1.h / 2 - 17 });
  // collegamenti con il nodo quantistico: quattro spezzate annidate che non si incrociano
  const qx = qn.x + qn.w / 2, qb = qn.y + qn.h, ft = f1.y;
  const yA = 258, yB = 284;
  const L = { color: '#3A3F47', dashed: true };
  const x1 = d1.x + d1.w * 0.42, x2 = d1.x + d1.w * 0.78, x3 = d2.x + d2.w * 0.5, x4 = d3.x + d3.w * 0.5;
  path(t, [[qx - 24, qb], [qx - 24, yA], [x1, yA], [x1, ft]], L);
  path(t, [[x2, ft], [x2, yB], [qx - 8, yB], [qx - 8, qb]], L);
  path(t, [[qx + 8, qb], [qx + 8, yB], [x3, yB], [x3, ft]], L);
  path(t, [[x4, ft], [x4, yA], [qx + 24, yA], [qx + 24, qb]], { ...L, color: '#B03A2E' });
  txt(t, '$\\theta$', (qx - 24 + x1) / 2, yA - 11, 20, { fontSize: 14 });
  txt(t, '$\\langle{}\\hat{B}\\rangle$', (x2 + qx - 8) / 2, yB + 13, 40, { fontSize: 13 });
  txt(t, '$\\theta$', (qx + 8 + x3) / 2, yB + 13, 20, { fontSize: 14 });
  txt(t, '$\\partial_\\mu \\langle{}\\hat{B}\\rangle$', (x4 + qx + 24) / 2, yA - 12, 60, { fontSize: 13, textColor: '#B03A2E' });
  txt(t, '$\\partial_\\mu \\langle{}\\hat{B}\\rangle = r\\,(\\langle{}\\hat{B}\\rangle_{\\mu{} + s} - \\langle{}\\hat{B}\\rangle_{\\mu{} - s})$,   $s = \\frac{\\pi}{4r}$   (Pauli generators: $r = \\frac{1}{2}$, $s = \\frac{\\pi}{2}$)', (f1.x + f2.x + f2.w) / 2, f1.y + f1.h + 40, 760, { fontSize: 14, h: 44, y: f1.y + f1.h + 18 });
  return t.done();
}

/**
 * Havlíček et al. (2019), arXiv:1804.11326, Fig. 2C e metodo del quantum kernel estimator: il circuito stima
 * K(x_i, x_j) = |⟨Φ(x_j)|Φ(x_i)⟩|² come frequenza di 0ⁿ, poi una SVM classica usa la matrice di kernel.
 */
function quantumKernel() {
  const t = new Builder();
  const H2 = 'H 0 1';
  const u = 'G[U_{\\Phi}(\\vec{x}_i)] 0-1 @blue', ud = 'G[U^\\dagger_{\\Phi}(\\vec{x}_j)] 0-1 @orange';
  const c = circuit(t, 60, 80, [H2, u, H2, u, ud, H2, ud, H2, 'M 0 1']);
  region(t, '$\\mathcal{U}_{\\Phi}(\\vec{x}_i)$', c.around(0, 3, 0, 1, 5), { stroke: '#6C8EBF', textColor: '#2F5E9E', fontSize: 13 });
  region(t, '$\\mathcal{U}^\\dagger_{\\Phi}(\\vec{x}_j)$', c.around(4, 7, 0, 1, 5), { stroke: '#D79B00', textColor: '#9A5B12', fontSize: 13 });
  const mid = (c.ys[0] + c.ys[1]) / 2;
  const hx = c.x1 + 60;
  const hist = t.add({ shape: 'qc-hist', count: 2, spec: '0.58 0.17 0.16 0.09 values axis', label: 'Counts', x: hx, y: mid - 46, w: 130, h: 92, fill: 'none', stroke: '#5B8DD6', strokeWidth: 1, ...ICON, fontSize: 11 });
  t.link(pt(t, c.x1 + 4, mid), hist, 'right', 'left', { label: 'shots', labelPos: 'above', fontSize: 10, color: MUTED });
  ltxt(t, '$K(\\vec{x}_i, \\vec{x}_j) = |\\langle{}\\Phi(\\vec{x}_j)|\\Phi(\\vec{x}_i)\\rangle|^2$\n$\\approx$ frequency of the outcome $0^n$', hx + 150, mid, 260, { fontSize: 14, h: 48, y: mid - 24 });
  // pipeline classica
  const y2 = c.bottom + 150;
  const data = plot(t, 'qml-data2d', 'xor', 22, 'Training set $\\{(\\vec{x}_i, y_i)\\}$', 60, y2 - 50, 100, 100);
  const km = t.add({ shape: 'qml-kernel', count: 16, spec: 'blocks classes', label: 'Kernel matrix $K_{ij}$', x: 250, y: y2 - 50, w: 100, h: 100, strokeWidth: 1, ...ICON, fill: '#FFFFFF', stroke: '#2F6FB2', fontSize: 11 });
  const svm = block(t, 'Classical SVM (QP)\n$\\max_{\\alpha}\\; \\sum_i \\alpha_i - \\frac{1}{2}\\sum_{ij} y_i y_j \\alpha_i \\alpha_j K_{ij}$', 560, y2, 250, 74, GREEN, { fontSize: 12 });
  const dec = block(t, 'Classifier\n$\\tilde{m}(\\vec{s}) = \\mathrm{sign}(\\sum_i y_i \\alpha_i^* K(\\vec{x}_i, \\vec{s}) + b)$', 900, y2, 250, 74, YELLOW, { fontSize: 12 });
  const test = plot(t, 'qml-data2d', 'xor boundary', 16, 'Test predictions', 1080, y2 - 50, 100, 100);
  t.link(data, km, 'right', 'left', { label: 'all pairs $(i, j)$', labelPos: 'above', fontSize: 11 });
  t.link(km, svm, 'right', 'left');
  t.link(svm, dec, 'right', 'left', { label: '$\\alpha^*, b$', labelPos: 'above', fontSize: 12 });
  t.link(dec, test, 'right', 'left');
  t.link(pt(t, hx + 65, mid + 66), km, 'bottom', 'top', { label: 'repeat for each pair: estimate $K_{ij}$', labelPos: 'above', fontSize: 11, color: MUTED, dashed: true });
  return t.done();
}

/**
 * Cong, Choi & Lukin, "Quantum convolutional neural networks", Nature Physics 15 (2019), arXiv:1810.03787, Fig. 1:
 * CNN classica e QCNN con convoluzioni U_i, pooling (misura + V_j controllata) e strato fully connected F.
 */
function qcnn() {
  const t = new Builder();
  const P = 38, Y0 = 196, X0 = 120, GW = 34, GH = P + QC_GATE;
  const row = (i: number) => Y0 + i * P;
  const xa = X0 + 42, xb = xa + 46, xp = xb + 52, xc = xp + 104, xd = xc + 46, xq = xd + 52, xf = xq + 104, xm = xf + 66;
  const bands: [string, number, number, string, string][] = [
    ['C', xa - 30, xb + 26, '#E3EEF8', '#2F6FB2'],
    ['P', xb + 26, xp + 34, '#FBE7D7', '#D9822B'],
    ['C', xp + 34, xd + 26, '#E3EEF8', '#2F6FB2'],
    ['P', xd + 26, xq + 34, '#FBE7D7', '#D9822B'],
    ['FC', xq + 34, xf + 30, '#ECE3F2', '#7E57C2'],
  ];
  const yTop = 18, yBot = row(7) + 34;
  for (const [l, a, b, f, s] of bands) {
    t.add({ shape: 'rect', x: a, y: yTop, w: b - a, h: yBot - yTop, radius: 0, fill: f, stroke: 'none', container: true });
    txt(t, l, (a + b) / 2, yTop + 16, 40, { fontSize: 16, bold: true, textColor: s });
  }
  // (a) CNN
  txt(t, '(a)', 20, 60, 30, { fontSize: 14 });
  txt(t, '(b)', 20, Y0 - 24, 30, { fontSize: 14 });
  t.add({ shape: 'image', label: 'Input image', x: xa - 120, y: 52, w: 74, h: 66, radius: 3, ...ICON, ...BLUE, fontSize: 11 });
  const slab = (b: number, h: number, n: number) => {
    const [, a, z] = bands[b];
    t.add({ shape: 'stack', x: (a + z) / 2 - h * 0.31 - 3, y: 96 - h / 2, w: h * 0.62, h, count: n, ...BLUE, strokeWidth: 1.2 });
  };
  slab(0, 84, 3);
  slab(1, 50, 2);
  slab(2, 58, 3);
  slab(3, 34, 2);
  t.add({ shape: 'stack', x: (bands[4][1] + bands[4][2]) / 2 - 10, y: 84, w: 18, h: 26, count: 1, ...PURPLE, strokeWidth: 1.2 });
  t.add({ shape: 'barchart', label: 'Cat  Dog', x: xm - 14, y: 62, w: 46, h: 56, count: 2, ...ICON, fill: '#D9C9E6', stroke: '#7E57C2', fontSize: 10 });
  // (b) QCNN: fili, convoluzioni, pooling, fully connected
  const keep1 = [0, 2, 4, 6];
  const r2 = [2, 3, 4, 5].map(row), r3 = [3, 4].map(row);
  const bend = 40;
  for (let i = 0; i < 8; i++) {
    if (i % 2) wire(t, X0, xp - 12, row(i));
    else wire(t, X0, xp + 24, row(i));
  }
  keep1.forEach((q, k) => seg(t, xp + 24, row(q), xp + 24 + bend, r2[k]));
  r2.forEach((y, k) => wire(t, xp + 24 + bend, k % 2 ? xq - 12 : xq + 24, y));
  [0, 2].forEach((k, j) => seg(t, xq + 24, r2[k], xq + 24 + bend, r3[j]));
  r3.forEach((y, j) => wire(t, xq + 24 + bend, j === 0 ? xm + 40 : xf + 34, y));
  const conv = (x: number, y: number, label: string) => t.add({ shape: 'qc-gate', label, x: x - GW / 2, y: y - QC_GATE / 2, w: GW, h: GH, count: 2, ...BASE, radius: 6, ...WHITE });
  const pool = (x: number, y: number, label: string) => t.add({ shape: 'qc-ctrl', spec: 'g m', label, x: x - GW / 2, y: y - P / 2, w: GW, h: 2 * P, ...BASE, depth: QC_GATE / P, radius: 6, ...WHITE });
  for (const q of [0, 2, 4, 6]) conv(xa, row(q), '$U_1$');
  for (const q of [1, 3, 5]) conv(xb, row(q), '$U_1$');
  for (const q of [0, 2, 4, 6]) pool(xp, row(q), '$V_1$');
  for (const k of [0, 2]) conv(xc, r2[k], '$U_2$');
  conv(xd, r2[1], '$U_2$');
  for (const k of [0, 2]) pool(xq, r2[k], '$V_2$');
  t.add({ shape: 'qc-gate', label: '$F$', x: xf - 20, y: r3[0] - QC_GATE / 2 - 4, w: 40, h: P + QC_GATE + 8, count: 2, ...BASE, radius: 6, ...WHITE });
  t.add({ shape: 'qc-meter', x: xm - 16, y: r3[0] - QC_GATE / 2, w: 32, h: QC_GATE, ...BASE, radius: 6, ...WHITE });
  txt(t, '$\\rho_{\\mathrm{in}}$', X0 - 40, (row(0) + row(7)) / 2, 50, { fontSize: 24 });
  ltxt(t, 'output', xm + 44, r3[0], 60, { fontSize: 12, textColor: SOFT });
  txt(t, 'convolution $U_i$: quasi-local unitaries, translation invariant;  pooling: measure a qubit, apply $V_j$ to its neighbour;  repeat until few qubits remain', (X0 + xm) / 2 + 20, yBot + 24, 820, { fontSize: 12, textColor: SOFT });
  return t.done();
}

/**
 * Pérez-Salinas, Cervera-Lierta, Gil-Fuster & Latorre, "Data re-uploading for a universal quantum classifier",
 * Quantum 4, 226 (2020), arXiv:1907.02085, Fig. 1: rete neurale e classificatore a un qubit con re-uploading.
 */
function reuploading() {
  const t = new Builder();
  const procArrow = (x: number, y: number, w: number) => t.add({ shape: 'blockarrow', label: 'Processing', x, y, w, h: 32, direction: 'right', fill: '#E6E7EA', stroke: '#8A8F98', strokeWidth: 1, fontSize: 12 });
  // (a) rete neurale
  txt(t, '(a) Neural network', 120, 22, 200, { fontSize: 13, bold: true });
  procArrow(36, 44, 190);
  const hs = [0, 1, 2, 3, 4].map((i) => t.box('', 110, 92 + i * 44, 34, 34, WHITE, { radius: 0, strokeWidth: 1 }));
  const ins = [0, 1].map((i) => t.add({ shape: 'ellipse', x: 34, y: 162 + i * 50, w: 24, h: 24, ...WHITE, strokeWidth: 1 }));
  const out = t.add({ shape: 'ellipse', x: 210, y: 187, w: 24, h: 24, ...WHITE, strokeWidth: 1 });
  const S = { routing: 'straight' as const, arrowEnd: false, color: '#333333', width: 0.9 };
  for (const a of ins) for (const h of hs) t.link(a, h, 'right', 'left', S);
  for (const h of hs) t.link(h, out, 'right', 'left', S);
  // (b) classificatore quantistico: un qubit, dati caricati a ogni passo
  const bx = 330;
  txt(t, '(b) Quantum classifier', bx + 180, 22, 220, { fontSize: 13, bold: true });
  const n = 5, dx = 78, dy = 40;
  const boxes: NodeModel[] = [];
  for (let i = 0; i < n; i++) {
    const x = bx + 50 + i * dx, y = 104 + i * dy;
    boxes.push(t.box(`$L(${i + 1})$`, x, y, 40, 34, i % 2 ? PURPLE : BLUE, { radius: 2, fontSize: 12 }));
    const c1 = t.add({ shape: 'ellipse', x: x - 4, y: 40, w: 22, h: 22, ...WHITE, strokeWidth: 1 });
    const c2 = t.add({ shape: 'ellipse', x: x + 20, y: 40, w: 22, h: 22, ...WHITE, strokeWidth: 1 });
    t.link(c1, pt(t, x + 20, y), 'bottom', 'top', S);
    t.link(c2, pt(t, x + 20, y), 'bottom', 'top', S);
  }
  rtxt(t, '$|0\\rangle$', bx + 20, 121, 30, { fontSize: 14 });
  seg(t, bx + 22, 121, bx + 50, 121);
  for (let i = 1; i < n; i++) {
    const a = boxes[i - 1], b = boxes[i];
    t.link(a, b, 'right', 'left', { arrowEnd: false, color: QC_INK, width: 1 });
  }
  const last = boxes[n - 1];
  seg(t, last.x + 40, last.y + 17, last.x + 66, last.y + 17);
  ltxt(t, '$|\\psi\\rangle$', last.x + 70, last.y + 17, 40, { fontSize: 14 });
  ltxt(t, 'the data $\\vec{x}$ (circles) is\nre-uploaded in every layer $L(i)$', bx + 6, 262, 220, { fontSize: 12, textColor: SOFT, h: 36, y: 244 });
  // circuito equivalente e classificazione
  const y2 = 390;
  const c = circuit(t, 70, y2, ['G[U(\\vec{x})] 0 @blue', 'G[U(\\vec{\\phi}_1)] 0 @purple', 'G[U(\\vec{x})] 0 @blue', 'G[U(\\vec{\\phi}_2)] 0 @purple', '...', 'G[U(\\vec{x})] 0 @blue', 'G[U(\\vec{\\phi}_N)] 0 @purple', 'M 0']);
  for (const [a, k] of [[0, '1'], [2, '2'], [5, 'N']] as const) region(t, `$L(${k})$`, c.around(a, a + 1, 0, 0, 6), { fontSize: 12 });
  txt(t, '$L(i) = U(\\vec{\\phi}_i)\\,U(\\vec{x})$,   or compactly   $U(\\vec{\\theta}_i + \\vec{w}_i \\circ \\vec{x})$', (c.x0 + c.x1) / 2, c.bottom + 34, 460, { fontSize: 14 });
  txt(t, 'fidelity cost  $\\chi^2_f = \\sum_{\\mu} (1 - |\\langle{}\\tilde{\\psi}_{s} | \\psi(\\vec{x}_\\mu)\\rangle|^2)$  over the training points', (c.x0 + c.x1) / 2, c.bottom + 70, 520, { fontSize: 13, textColor: SOFT, h: 36, y: c.bottom + 52 });
  const bloch = t.add({ shape: 'qc-bloch', count: 28, spec: 'labels phi=40', label: 'class states on the sphere', x: c.x1 + 50, y: y2 - 70, w: 130, h: 130, fill: '#EEF3FA', stroke: '#5B6B80', strokeWidth: 1, ...ICON, fontSize: 11 });
  plot(t, 'qml-data2d', 'circle boundary', 60, 'Circle problem', bloch.x + 170, y2 - 64, 118, 118);
  return t.done();
}

/**
 * Mari, Bromley, Izaac, Schuld & Killoran, "Transfer learning in hybrid classical-quantum neural networks",
 * Quantum 4, 340 (2020), arXiv:1912.08278, Fig. 1–3: ResNet18 pre-addestrata e "dressed quantum circuit".
 */
function transfer() {
  const t = new Builder();
  // schema generale
  const s1 = block(t, 'Network $A$\npre-trained on $D_A$, task $T_A$', 120, 52, 200, 50, ORANGE);
  const s2 = block(t, "$A'$ (feature extractor)", 430, 52, 170, 40, ORANGE);
  const s3 = block(t, 'new trainable network $B$\ndataset $D_B$, task $T_B$', 690, 52, 190, 50, GREEN);
  t.link(s1, s2, 'right', 'left', { label: 'remove last layers', labelPos: 'above', fontSize: 10 });
  t.link(s2, s3, 'right', 'left', { label: 'frozen', labelPos: 'above', fontSize: 10, color: '#3B82C4' });
  // tabella degli schemi ibridi
  const tx = 830;
  const rows = [['$A$', '$B$', 'scheme'], ['Classical', 'Classical', 'CC'], ['Classical', 'Quantum', 'CQ'], ['Quantum', 'Classical', 'QC'], ['Quantum', 'Quantum', 'QQ']];
  const widths = [70, 70, 54];
  rule(t, tx, tx + 194, 18, 1);
  rows.forEach((r, i) => {
    let x = tx;
    r.forEach((s, j) => {
      txt(t, s, x + widths[j] / 2, 30 + i * 20, widths[j] - 2, { fontSize: 11, bold: i === 0 || (i === 2 && j === 2), textColor: i === 2 ? '#1B6E3A' : '#1A1A1A' });
      x += widths[j];
    });
  });
  rule(t, tx, tx + 194, 41, 0.7);
  rule(t, tx, tx + 194, 120, 1);
  // pipeline CQ
  const y = 270;
  const img = t.add({ shape: 'image', label: '"bee"  /  "ant"', x: 20, y: y - 40, w: 84, h: 80, radius: 3, ...ICON, ...BLUE, fontSize: 11 });
  const res = block(t, 'ResNet18\n(pre-trained on ImageNet)', 250, y, 170, 120, { fill: '#F3D36B', stroke: '#B38F12' }, { fontSize: 13 });
  t.add({ shape: 'snowflake', x: res.x + res.w - 26, y: res.y + 6, w: 20, h: 20, ...FROZEN, strokeWidth: 1.2 });
  const l1 = block(t, '$L_{512 \\to 4}$', 410, y, 60, 120, { fill: '#9EF0B4', stroke: '#2E8B57' }, { fontSize: 14 });
  t.link(img, res, 'right', 'left');
  t.link(res, l1, 'right', 'left', { label: '512', labelPos: 'above', fontSize: 10 });
  const c = circuit(t, 500, y - 63, ['H 0 1 2 3', 'RY[x_1] 0 & RY[x_2] 1 & RY[x_3] 2 & RY[x_4] 3', 'CX 0 1', 'CX 1 2', 'CX 2 3', 'RY[w_1] 0 & RY[w_2] 1 & RY[w_3] 2 & RY[w_4] 3', 'M 0 1 2 3'], { inputs: ['', '', '', ''], lead: 10, tail: 12 });
  region(t, 'embedding $\\mathcal{E}(\\vec{x})$', c.around(0, 1, 0, 3, 5), { stroke: '#6C8EBF', textColor: '#2F5E9E' });
  region(t, 'variational layer $\\mathcal{L}(\\vec{w})$, $\\times 5$', c.around(2, 5, 0, 3, 5), { stroke: '#9673A6', textColor: '#6B4F7E' });
  t.link(l1, pt(t, c.x0 - 6, y), 'right', 'left', { label: '$\\vec{x}$', labelPos: 'above', fontSize: 12 });
  const l2 = block(t, '$L_{4 \\to 2}$', c.x1 + 84, y, 56, 120, { fill: '#9EF0B4', stroke: '#2E8B57' }, { fontSize: 14 });
  t.link(pt(t, c.x1 + 8, y), l2, 'right', 'left', { label: '$\\langle{}Z_k\\rangle$', labelPos: 'above', fontSize: 12 });
  const outp = ltxt(t, '"bee"', l2.x + l2.w + 46, y, 60, { fontSize: 16, italic: true });
  t.link(l2, outp, 'right', 'left');
  const gx = l1.x - 14, gw = l2.x + l2.w + 14 - gx;
  t.group('Dressed quantum circuit  $\\tilde{Q} = L_{4 \\to 2}\\circ\\mathcal{M}\\circ\\mathcal{Q}\\circ\\mathcal{E}\\circ{}L_{512 \\to 4}$', gx, y - 128, gw, 236, { fontSize: 12, stroke: '#2E8B57', textColor: '#1B6E3A' });
  txt(t, 'trained: $L_{512 \\to 4}$, $\\vec{w}$, $L_{4 \\to 2}$ (cross-entropy, Adam);  ResNet18 frozen;  run on ibmqx4 and Rigetti Aspen-4-4Q-A', 560, y + 134, 760, { fontSize: 12, textColor: SOFT });
  return t.done();
}

/**
 * McClean, Boixo, Smelyanskiy, Babbush & Neven, "Barren plateaus in quantum neural network training landscapes",
 * Nature Communications 9, 4812 (2018), arXiv:1803.11173, Fig. 2–4.
 */
function barren() {
  const t = new Builder();
  // circuito generico e circuito casuale 1D
  const g = circuit(t, 30, 50, ['G[U_l(\\theta_l)] 0-4 @blue w=64', 'G[W_l] 0-4 @red w=44'], { inputs: ['', '', '', '', ''], pitch: 34, lead: 14, tail: 14 });
  txt(t, '$U(\\vec{\\theta}) = \\prod_{l=1}^{L} U_l(\\theta_l)\\, W_l$', (g.x0 + g.x1) / 2, g.bottom + 34, 200, { fontSize: 14, h: 46, y: g.bottom + 12 });
  const rp = (q: number) => `G[R_{P_{1,${q + 1}}}(\\theta_{1,${q + 1}})] ${q}`;
  const r = circuit(t, 300, 50, ['G[\\sqrt{H}] 0 1 2 3 4', [0, 1, 2, 3, 4].map(rp).join(' & '), 'CZ 0 1 & CZ 2 3', 'CZ 1 2 & CZ 3 4'], { pitch: 34, tail: 14 });
  const lay = r.around(1, 3, 0, 4, 6);
  region(t, 'layer $l$, repeated $L$ times', lay, { stroke: '#B8BEC8' });
  txt(t, '$P_{l,j} \\in \\{X, Y, Z\\}$, $\\theta_{l,j} \\in [0, 2\\pi)$ sampled uniformly;  $H = Z_1 Z_2$', (r.x0 + r.x1) / 2 + 10, r.bottom + 30, 420, { fontSize: 12, textColor: SOFT });
  // grafici
  const y2 = r.bottom + 70;
  plot(t, 'qml-curve', 'variance axis legend', 1, 'Gradient variance vs qubits (Fig. 3)', 30, y2, 250, 180);
  plot(t, 'qml-curve', 'layers axis', 7, 'Variance vs layers, $n = 2 \\ldots 24$ (Fig. 4)', 310, y2, 250, 180);
  plot(t, 'qml-curve', 'landscape legend', 1, 'Barren plateau landscape', 590, y2, 230, 180);
  txt(t, 'once $U(\\vec{\\theta})$ forms a 2-design:  $\\langle{}\\partial_k E\\rangle = 0$,  $\\mathrm{Var}[\\partial_k E] \\sim 2^{-n}$  (exponentially flat)', 425, y2 + 232, 640, { fontSize: 13 });
  return t.done();
}

/**
 * Fujii & Nakajima, "Harnessing disordered-ensemble quantum dynamics for machine learning", Phys. Rev. Applied 8
 * (2017), arXiv:1602.08159, Fig. 1 e 3: reservoir quantistico, nodi virtuali e lettura lineare.
 */
function reservoir() {
  const t = new Builder();
  const y = 120;
  const inp = plot(t, 'qml-curve', 'input plain', 12, 'input $s_k$', 20, y - 36, 150, 72);
  const sys = t.add({ shape: 'qml-spins', count: 6, spec: 'network', label: 'quantum reservoir (fixed $H$)', x: 240, y: y - 70, w: 190, h: 140, strokeWidth: 1, ...ICON, fill: '#2F4F7F', stroke: '#2B2B2B', fontSize: 11 });
  const sig = plot(t, 'qml-curve', 'signal', 4, 'signals $x^{\\prime}_i(t)$', 510, y - 50, 160, 100);
  const lr = block(t, 'LR', 800, y, 70, 100, WHITE, { fontSize: 14, radius: 2 });
  const out = ltxt(t, '$y_k = \\sum_{i} w_i^{\\mathrm{LR}} x_{ik}$', 910, y, 150, { fontSize: 14, h: 44, y: y - 22 });
  t.link(inp, sys, 'right', 'left', { label: 'inject', labelPos: 'above', fontSize: 10 });
  t.link(sys, sig, 'right', 'left', { label: 'ensemble\nreadout', labelPos: 'above', fontSize: 10 });
  for (let i = 0; i < 4; i++) t.link(pt(t, 680, y - 36 + i * 24), pt(t, 797, y - 36 + i * 24), 'right', 'left', { width: 1, color: SOFT });
  txt(t, '$NV$ virtual nodes', 740, y + 70, 110, { fontSize: 11, textColor: SOFT });
  txt(t, 'only $w^{\\mathrm{LR}}$ is trained', 835, y + 70, 130, { fontSize: 11, textColor: SOFT });
  t.link(lr, out, 'right', 'left');
  // dinamica per un passo k
  const y2 = 250;
  const tau = 'G[e^{-iH\\tau/V}] 0-3 @blue w=70';
  const c = circuit(t, 120, y2, ['G[|\\psi_k\\rangle] 0 @orange', tau, 'SLICE[v = 1]', tau, 'SLICE[v = 2]', '...', tau, 'SLICE[v = V]', 'G[|\\psi_{k+1}\\rangle] 0 @orange'], { inputs: ['qubit 1', '', '', ''], fontSize: 13 });
  inBrace(t, c, 0, 3, '$\\rho_k$', c.x0 - 60, 40);
  ltxt(t, 'signals $\\langle{}Z_i\\rangle$ sampled at each $v$', c.x1 + 10, c.ys[1], 170, { fontSize: 12, textColor: SOFT });
  txt(t, 'input injection: qubit 1 is reset to  $|\\psi_k\\rangle = \\sqrt{1 - s_k}\\,|0\\rangle + \\sqrt{s_k}\\,|1\\rangle$,  the other qubits keep their state', (c.x0 + c.x1) / 2, c.bottom + 64, 720, { fontSize: 13 });
  txt(t, '$H = \\sum_{ij} J_{ij} X_i X_j + h \\sum_i Z_i$  (random couplings, transverse-field Ising)', (c.x0 + c.x1) / 2, c.bottom + 100, 640, { fontSize: 13, h: 40, y: c.bottom + 80 });
  return t.done();
}

// ======================================================================
// Quantum generative AI
// ======================================================================

/**
 * Zoufal, Lucchi & Woerner, "Quantum generative adversarial networks for learning and loading random
 * distributions", npj Quantum Information 5, 103 (2019), arXiv:1904.00043, Fig. 1–3.
 */
function qgan() {
  const t = new Builder();
  const ry = (k: string) => [1, 2, 3].map((q) => `RY[\\theta^{${q},${k}}] ${q - 1}`).join(' & ');
  const c = circuit(t, 90, 100, [ry('0'), 'G[U_{\\mathrm{ent}}] 0-2 @gray', ry('1'), '... 0 1 2', 'G[U_{\\mathrm{ent}}] 0-2 @gray', ry('k'), 'M 0 1 2'], { inputs: ['', '', ''], tail: 14 });
  inBrace(t, c, 0, 2, '$|\\psi_{\\mathrm{in}}\\rangle$', c.x0 - 6, 60);
  const gr = c.around(0, 6, 0, 2, 10);
  t.group('Quantum generator $G_\\theta$', gr.x, gr.y - 26, gr.w, gr.h + 26, { fontSize: 12, bold: true, dashed: false, stroke: '#B04A9C', fill: '#FBF1F8', textColor: '#8E2F7E' });
  brace(t, 'bottom', c.left[1] - 2, c.bottom + 16, c.right[5] - c.left[1] + 4, 12);
  txt(t, '$k$ times', (c.left[1] + c.right[5]) / 2, c.bottom + 42, 80, { fontSize: 12, textColor: SOFT });
  // campioni e discriminatore
  const mid = c.ys[1];
  const gs = t.add({ shape: 'stack', label: 'generated $g^l$', x: gr.x + gr.w + 50, y: mid - 26, w: 40, h: 50, count: 3, ...ICON, fill: '#3F5FA8', stroke: '#24407E', fontSize: 11 });
  t.link(pt(t, c.x1 + 2, mid), gs, 'right', 'left');
  const dx = gs.x + 120;
  const disc = t.add({ shape: 'mlp', label: 'Discriminator $D_\\phi$', spec: '3,5,5,1', x: dx, y: mid - 46, w: 120, h: 92, strokeWidth: 1.1, ...ICON, fill: '#E7DDF3', stroke: '#6A3FA0', fontSize: 12 });
  const xs = t.add({ shape: 'stack', label: '', x: dx + 40, y: mid - 150, w: 40, h: 50, count: 3, fill: '#4FC3F7', stroke: '#1E88C9', strokeWidth: 1 });
  ltxt(t, 'training data $x^l$', xs.x + 52, xs.y + 25, 120, { fontSize: 11 });
  t.link(gs, disc, 'right', 'left');
  t.link(xs, disc, 'bottom', 'top');
  ltxt(t, 'real / fake', disc.x + disc.w + 28, mid, 80, { fontSize: 12, bold: true });
  t.link(disc, pt(t, disc.x + disc.w + 24, mid), 'right', 'left');
  // grafici e decomposizione
  const y2 = c.bottom + 80;
  plot(t, 'qml-dist', 'lognormal target axis index legend', 8, 'PDF: trained vs target (log-normal, 3 qubits)', 30, y2, 230, 150);
  plot(t, 'qml-curve', 'ganloss axis legend', 1, 'Loss functions', 290, y2, 250, 150);
  const ue = t.add({ shape: 'qc-gate', label: '$U_{\\mathrm{ent}}$', x: 600, y: y2 + 20, w: 46, h: 2 * 36 + QC_GATE, count: 3, ...BASE, radius: 12, fill: '#E6E6E6', stroke: '#666666' });
  txt(t, '$=$', 670, ue.y + ue.h / 2, 20, { fontSize: 16 });
  circuit(t, 690, y2 + 34, ['CZ 0 1', 'CZ 1 2', 'CZ 0 2'], { inputs: ['', '', ''], pitch: 36, lead: 10, tail: 10 });
  txt(t, '$L_G = -\\frac{1}{m}\\sum_l \\log D_\\phi(g^l)$', 760, y2 + 150, 300, { fontSize: 13, h: 40, y: y2 + 136 });
  txt(t, '$L_D = \\frac{1}{m}\\sum_l [\\log D_\\phi(x^l) + \\log(1 - D_\\phi(g^l))]$', 760, y2 + 188, 360, { fontSize: 13, h: 40, y: y2 + 172 });
  return t.done();
}

/**
 * Benedetti, Garcia-Pintos, Perdomo, Leyton-Ortega, Nam & Perdomo-Ortiz, "A generative modeling approach for
 * benchmarking and training shallow quantum circuits", npj Quantum Information 5, 45 (2019), arXiv:1801.07686, Fig. 1–2.
 */
function qcbm() {
  const t = new Builder();
  // circuito: rotazioni (strati dispari) e XX di Mølmer–Sørensen (strati pari)
  const u = (o: number) => [0, 1, 2, 3].map((q) => `G[U_{${q + 1}}^{(${o})}] ${q}`).join(' & ');
  const c = circuit(t, 70, 110, [u(1), 'G[XX] 0-1 & G[XX] 2-3', 'G[XX] 1-2', u(3), 'M 0 1 2 3'], { tail: 14 });
  region(t, 'odd', c.around(0, 0, 0, 3, 5), { stroke: '#6C8EBF', textColor: '#2F5E9E' });
  region(t, 'even', c.around(1, 2, 0, 3, 5), { stroke: '#9673A6', textColor: '#6B4F7E' });
  region(t, 'odd', c.around(3, 3, 0, 3, 5), { stroke: '#6C8EBF', textColor: '#2F5E9E' });
  const qr = c.around(0, 4, 0, 3, 14);
  const qg = t.group('Quantum circuit  $|\\psi(\\theta)\\rangle = U(\\theta)|0\\rangle$', qr.x - 36, qr.y - 52, qr.w + 36, qr.h + 100, { fontSize: 12, bold: true, dashed: false, stroke: '#B8BEC8', fill: '#FAFBFC' });
  toBack(t, qg);
  txt(t, 'odd layers: single-qubit rotations\neven layers: Mølmer–Sørensen $XX$ gates', qr.x + qr.w / 2 - 18, c.bottom + 42, 300, { fontSize: 11, textColor: SOFT, h: 32, y: c.bottom + 26 });
  // campioni del modello, costo, ottimizzatore
  const mid = (c.ys[1] + c.ys[2]) / 2;
  const model = plot(t, 'qml-dist', 'bas target bits legend', 16, 'samples $P_\\theta(x) = |\\langle{}x|\\psi(\\theta)\\rangle|^2$', c.x1 + 80, mid - 58, 240, 116);
  t.link(pt(t, c.x1 + 6, mid), model, 'right', 'left', { label: 'shots', labelPos: 'above', fontSize: 10 });
  const yc = qg.y + qg.h + 64;
  const cost = block(t, 'Cost (clipped NLL / KL)\n$\\mathcal{C}(\\theta) = -\\frac{1}{D}\\sum_{d} \\ln \\max(\\epsilon, P_\\theta(x^{(d)}))$', model.x + model.w / 2, yc, 280, 64, ORANGE);
  t.link(pt(t, model.x + model.w / 2, model.y + model.h + 26), cost, 'bottom', 'top');
  const opt = block(t, 'Optimizer (PSO)', qg.x + qg.w / 2, yc, 150, 40, GREEN);
  t.link(cost, opt, 'left', 'right', { label: 'update $\\theta$', labelPos: 'above', fontSize: 11 });
  t.link(opt, qg, 'top', 'bottom', { color: '#3F7F3A' });
  // dati: pattern bars-and-stripes 2×2 e distribuzione empirica
  const dx = model.x + model.w + 70;
  txt(t, 'Data $\\mathcal{D}$: BAS(2,2)', dx + 62, 26, 160, { fontSize: 12, bold: true });
  [1, 0, 2, 3, 4, 5].forEach((k, i) => t.add({ shape: 'qml-pixels', spec: 'bas grid', count: k, x: dx + (i % 3) * 44, y: 46 + Math.floor(i / 3) * 44, w: 34, h: 34, strokeWidth: 1, fill: '#FFFFFF', stroke: '#3F6FC4' }));
  const pd = plot(t, 'qml-dist', 'bas data bits', 16, 'data $P_{\\mathcal{D}}(x)$', dx - 30, 160, 190, 90);
  t.link(pt(t, pd.x + pd.w / 2, pd.y + pd.h + 26), cost, 'bottom', 'right');
  ltxt(t, 'compare', pd.x + pd.w / 2 + 6, yc - 40, 60, { fontSize: 10, textColor: SOFT });
  // KL e connettività dell'hardware a ioni
  const y3 = yc + 70;
  plot(t, 'qml-curve', 'kl axis legend', 3, 'KL divergence vs iteration (BAS, ion-trap model)', 380, y3, 280, 160);
  txt(t, 'pixels $\\to$ qubits', 110, y3 + 6, 160, { fontSize: 11, textColor: SOFT });
  [0, 1, 3, 2].forEach((q, i) => t.box(String(q + 1), 82 + (i % 2) * 28, y3 + 22 + Math.floor(i / 2) * 28, 28, 28, WHITE, { radius: 0, fontSize: 11, strokeWidth: 1 }));
  const topo = (x: number, y: number, edges: [number, number][], label: string) => {
    const P: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const v = P.map(([a, b], i) => t.add({ shape: 'ellipse', label: String(i + 1), x: x + a * 36, y: y + b * 36, w: 20, h: 20, fontSize: 9, strokeWidth: 1, ...BLUE }));
    for (const [a, b] of edges) t.link(v[a], v[b], 'auto', 'auto', { routing: 'straight', arrowEnd: false, color: '#333333', width: 1.2 });
    txt(t, label, x + 28, y + 70, 60, { fontSize: 10, textColor: SOFT });
  };
  topo(30, y3 + 90, [[0, 1], [1, 2], [2, 3]], 'chain');
  topo(120, y3 + 90, [[0, 1], [0, 2], [0, 3]], 'star');
  topo(210, y3 + 90, [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]], 'all');
  return t.done();
}

/**
 * Amin, Andriyash, Rolfe, Kulchytskyy & Melko, "Quantum Boltzmann machine", Phys. Rev. X 8, 021050 (2018),
 * arXiv:1601.02036, Fig. 1: QBM, QBM ristretta e apprendimento discriminativo; Hamiltoniana con campo trasverso.
 */
function qbm() {
  const t = new Builder();
  const W = 300, H = 120, x0 = 120;
  const row = (y: number, spec: string, tag: string) => {
    txt(t, tag, 30, y + 10, 40, { fontSize: 15 });
    t.add({ shape: 'qml-qbm', count: 8, spec, x: x0, y, w: W, h: H, strokeWidth: 1, fill: 'none', stroke: '#333333' });
    rtxt(t, 'hidden $\\sigma^z_i$', x0 - 6, y + H * 0.27, 90, { fontSize: 12, textColor: '#C0392B' });
    rtxt(t, spec === 'disc' ? 'input $\\mathbf{x}$' : 'visible $\\sigma^z_v$', x0 - 6, y + H * (spec === 'disc' ? 0.93 : 0.73), 90, { fontSize: 12, textColor: spec === 'disc' ? '#3E8E3A' : '#2F6FB2' });
  };
  row(20, 'full', '(a)');
  row(170, 'restricted', '(b)');
  row(320, 'disc', '(c)');
  ltxt(t, 'output $\\mathbf{y}$', x0 + W + 8, 320 + H * 0.7, 80, { fontSize: 12, textColor: '#2F6FB2' });
  // formule
  const fx = 540;
  const F = (s: string, y: number, extra: Partial<NodeModel> = {}) => ltxt(t, s, fx, y, 480, { fontSize: 14, h: 44, y: y - 22, ...extra });
  F('Hamiltonian with transverse field $\\Gamma_a$:', 40, { fontSize: 12, textColor: SOFT });
  F('$H = -\\sum_a \\Gamma_a \\sigma^x_a - \\sum_a b_a \\sigma^z_a - \\sum_{a,b} w_{ab}\\, \\sigma^z_a \\sigma^z_b$', 80);
  F('$\\rho\\,= Z^{-1} e^{-H}$,   $Z = \\mathrm{Tr}[e^{-H}]$', 136);
  F('$P_{\\mathbf{v}} = \\mathrm{Tr}[\\Lambda_{\\mathbf{v}}\\, \\rho]$,   $\\Lambda_{\\mathbf{v}} = |\\mathbf{v}\\rangle\\langle{}\\mathbf{v}| \\otimes I_h$', 186);
  F('bound-based training (bQBM), Golden–Thompson upper bound:', 250, { fontSize: 12, textColor: SOFT });
  F('$\\delta b_a = \\eta\\,(\\langle{}\\sigma^z_a\\rangle_{\\mathbf{v}} - \\langle{}\\sigma^z_a\\rangle)$', 290);
  F('$\\delta w_{ab} = \\eta\\,(\\langle{}\\sigma^z_a \\sigma^z_b\\rangle_{\\mathbf{v}} - \\langle{}\\sigma^z_a \\sigma^z_b\\rangle)$', 336);
  F('$\\langle{}\\cdot\\rangle_{\\mathbf{v}}$: clamped to the data,  $\\langle{}\\cdot\\rangle$: free (sampled from $\\rho$)', 378, { fontSize: 12, textColor: SOFT });
  F('(c) supervised: classical inputs $\\mathbf{x}$ bias hidden and output qubits', 430, { fontSize: 12, textColor: SOFT });
  return t.done();
}

/**
 * Zhang, Liu, Hsieh & Tao / Zhang, Xu, Zhuang et al., "Generative quantum machine learning via denoising diffusion
 * probabilistic models" (QuDDPM), Phys. Rev. Lett. 132, 100602 (2024), arXiv:2310.05866, Fig. 1.
 */
function quddpm() {
  const t = new Builder();
  const X0 = 40, step = 220, W = 5 * step + 44;
  t.group('Forward noisy diffusion process via scrambling', 20, 12, W, 330, { fontSize: 13, bold: true, stroke: '#2B3A55', textColor: '#1A1A1A' });
  t.group('', 20, 356, W, 380, { stroke: '#2B3A55' });
  txt(t, 'Backward denoising process via measurement', 20 + W / 2, 716, 420, { fontSize: 13, bold: true });
  // (a) catena in avanti
  const ket = (s: string, x: number, y: number, c: Color) => t.add({ shape: 'ellipse', label: s, x: x - 23, y: y - 23, w: 46, h: 46, fontSize: 13, strokeWidth: 1, ...c });
  const YEL = { fill: '#FFC93C', stroke: '#E0A800' }, PINK = { fill: '#F6CCF2', stroke: '#D48ACD' };
  const ya = 80;
  const fk = [ket('$\\psi_i^{(0)}$', X0 + 30, ya, YEL), ket('$\\psi_i^{(1)}$', X0 + 210, ya, YEL), ket('$\\psi_i^{(k)}$', X0 + 470, ya, YEL), ket('$\\psi_i^{(k+1)}$', X0 + 650, ya, YEL), ket('$\\psi_i^{(T-1)}$', X0 + 900, ya, YEL), ket('$\\psi_i^{(T)}$', X0 + 1080, ya, YEL)];
  const qsc = (s: string, x: number) => block(t, `QSC\n${s}`, x, ya, 58, 76, BLUE, { fontSize: 13, radius: 8 });
  const q1 = qsc('$U_1^{(i)}$', X0 + 120), q2 = qsc('$U_{k+1}^{(i)}$', X0 + 560), q3 = qsc('$U_T^{(i)}$', X0 + 990);
  const L = { color: '#1A1A1A', width: 1.6 };
  t.link(fk[0], q1, 'right', 'left', { ...L, arrowEnd: false });
  t.link(q1, fk[1], 'right', 'left', L);
  t.link(fk[2], q2, 'right', 'left', { ...L, arrowEnd: false });
  t.link(q2, fk[3], 'right', 'left', L);
  t.link(fk[4], q3, 'right', 'left', { ...L, arrowEnd: false });
  t.link(q3, fk[5], 'right', 'left', L);
  txt(t, '$\\cdots$', X0 + 340, ya, 60, { fontSize: 18 });
  txt(t, '$\\cdots$', X0 + 775, ya, 60, { fontSize: 18 });
  // (b)–(c) ensemble sulla sfera di Bloch
  const spreads = [4, 30, 55, 80, 100], back = [5, 26, 52, 78, 100];
  const sphere = (x: number, y: number, s: number, ink: Color, label: string, seed = 0) => t.add({ shape: 'qml-ensemble', count: s, spec: `labels points=80 seed=${seed}`, label, x, y, w: 150, h: 150, strokeWidth: 1, ...ICON, ...ink, fontSize: 13 });
  const RED_ENS = { fill: '#F7EEEE', stroke: '#D62728' }, GREEN_ENS = { fill: '#EEF5EE', stroke: '#2E8B57' };
  const yb = 160, yc = 400;
  const arrowShape = (x: number, y: number, dir: Side) => t.add({ shape: 'blockarrow', x, y, w: 40, h: 22, direction: dir, fill: '#B9BDC4', stroke: 'none' });
  spreads.forEach((s, i) => {
    const x = X0 + 15 + i * step;
    sphere(x, yb, s, RED_ENS, `$t = ${i * 5}$${i === 0 ? '  (data)' : i === 4 ? '  (noise)' : ''}`);
    sphere(x, yc, back[i], GREEN_ENS, `$t = ${i * 5}$${i === 0 ? '  (generated)' : i === 4 ? '  (noise)' : ''}`, 2);
    if (i < 4) {
      arrowShape(x + 162, yb + 64, 'right');
      arrowShape(x + 162, yc + 64, 'left');
    }
  });
  // (d) catena all'indietro con ancille misurate
  const yd = 620, ya2 = 670;
  const bk = [ket('$\\tilde{\\psi}_i^{(0)}$', X0 + 30, yd, PINK), ket('$\\tilde{\\psi}_i^{(1)}$', X0 + 210, yd, PINK), ket('$\\tilde{\\psi}_i^{(k)}$', X0 + 470, yd, PINK), ket('$\\tilde{\\psi}_i^{(k+1)}$', X0 + 650, yd, PINK), ket('$\\tilde{\\psi}_i^{(T-1)}$', X0 + 900, yd, PINK), ket('$\\tilde{\\psi}_i^{(T)}$', X0 + 1080, yd, PINK)];
  const pqc = (s: string, x: number) => t.box(`PQC\n${s}`, x - 29, yd - 30, 58, ya2 - yd + 50, GREEN, { radius: 8, fontSize: 13 });
  const anc = (x: number) => ltxt(t, '$|0\\rangle_A^{\\otimes N_A}$', x, ya2, 70, { fontSize: 13 });
  const meas = (x: number) => t.add({ shape: 'qc-meter', x: x - 16, y: ya2 - 13, w: 32, h: 26, ...BASE, fill: '#F8B4B4', stroke: '#C0392B' });
  const pairs: [NodeModel, NodeModel, number, string][] = [[bk[0], bk[1], X0 + 120, '$\\tilde{U}_1$'], [bk[2], bk[3], X0 + 560, '$\\tilde{U}_{k+1}$'], [bk[4], bk[5], X0 + 990, '$\\tilde{U}_T$']];
  for (const [a, b, x, s] of pairs) {
    pqc(s, x);
    t.link(b, pt(t, x + 29, yd), 'left', 'right', { ...L, arrowEnd: false });
    t.link(pt(t, x - 29, yd), a, 'left', 'right', L);
    const an = anc(x + 50);
    t.link(an, pt(t, x + 29, ya2), 'left', 'right', { ...L, arrowEnd: false });
    const m = meas(x - 64);
    t.link(pt(t, x - 29, ya2), m, 'left', 'right', L);
  }
  txt(t, '$\\cdots$', X0 + 340, yd, 60, { fontSize: 18 });
  txt(t, '$\\cdots$', X0 + 775, yd, 60, { fontSize: 18 });
  return t.done();
}

/**
 * Cherrat, Kerenidis, Mathur, Landman, Strahm & Li, "Quantum vision transformers", Quantum 8, 1265 (2024),
 * arXiv:2209.08167, Fig. 4, 7, 10–12: attention classica e circuiti con caricamento dei dati e strati ortogonali.
 */
function qvit() {
  const t = new Builder();
  t.group('Attention', 20, 14, 400, 520, { fontSize: 14, bold: true, dashed: false, fill: '#E9E1F0', stroke: '#9673A6', textColor: '#7E3FD0', radius: 24 });
  const vec = (x: number, y: number, label: string, right = true) => {
    const n = t.box('', x, y, 14, 74, WHITE, { radius: 0, strokeWidth: 1.2, stroke: '#1A1A1A' });
    (right ? ltxt : rtxt)(t, label, right ? x + 17 : x - 3, y + 66, 44, { fontSize: 13, bold: true });
    return n;
  };
  const ys = [64, 156, 248, 430];
  const names = ['0', '1', '2', 'n'];
  const vxs: NodeModel[] = [], yv: NodeModel[] = [];
  ys.forEach((y, i) => {
    t.link(pt(t, 30, y + 37), pt(t, 64, y + 37), 'right', 'left', { color: '#666666', width: 1 });
    vec(66, y, '', false);
    rtxt(t, `$\\mathbf{x}_{${names[i]}}$`, 64, y + 84, 30, { fontSize: 14 });
    const vx = vec(150, y, '');
    ltxt(t, `$V\\mathbf{x}_{${names[i]}}$`, 166, y + 84, 50, { fontSize: 14 });
    // V: tutte le connessioni fra i due vettori
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) seg(t, 84, y + 14 + a * 23, 146, y + 14 + b * 23, { color: '#E53935', width: 0.8 });
    txt(t, '$V$', 115, y - 8, 20, { fontSize: 15, bold: true, textColor: '#E53935' });
    vxs.push(vx);
    const yy = t.box('', 340, y, 14, 74, WHITE, { radius: 0, strokeWidth: 1.2, stroke: '#1A1A1A' });
    ltxt(t, `$\\mathbf{y}_{${names[i]}}$`, 357, y + 66, 30, { fontSize: 14 });
    t.link(pt(t, 358, y + 37), pt(t, 412, y + 37), 'right', 'left', { color: '#666666', width: 1 });
    yv.push(yy);
  });
  for (const r of [0, 1]) for (const v of vxs) t.link(v, yv[r === 0 ? 0 : 3], 'right', 'left', { routing: 'straight', color: '#3949E8', width: 0.9 });
  for (const xx of [73, 157, 347]) txt(t, '$\\vdots$', xx, 376, 20, { fontSize: 16 });
  txt(t, '$A$', 250, 60, 30, { fontSize: 22, bold: true, textColor: '#3949E8' });
  t.add({ shape: 'rect', label: '$A_{ij} = \\mathbf{x}_i^{\\top} W \\mathbf{x}_j$\n$A^{\\prime}_{ij} = \\mathrm{softmax}_j(A_{ij})$\n$\\mathbf{y}_i = \\sum_j A^{\\prime}_{ij}\\, V \\mathbf{x}_j$', x: 180, y: 340, w: 154, h: 84, fill: '#FFFFFF', stroke: '#1A1A1A', dashed: true, radius: 12, fontSize: 13, strokeWidth: 1 });
  // circuiti quantistici
  const qx = 520;
  const lbl = (s: string, y: number) => ltxt(t, s, qx - 20, y, 360, { fontSize: 12, bold: true, textColor: '#374151' });
  lbl('(i)  $V\\mathbf{x}_i$ with an orthogonal layer $V$', 30);
  circuit(t, qx + 20, 70, ['G[Load $|x_i\\rangle$] 0', 'G[V] 0', 'M 0'], { inputs: [''], bundles: { 0: 'd' }, lead: 34 });
  lbl('(ii)  attention coefficients $\\mathbf{x}_i^{\\top} W \\mathbf{x}_j$', 118);
  circuit(t, qx + 20, 158, ['G[Load $|x_j\\rangle$] 0', 'G[W] 0', 'G[Load $\\langle{}x_i|$] 0', 'M 0'], { inputs: [''], bundles: { 0: 'd' }, lead: 34 });
  lbl('(iii)  quantum attention on the whole patch matrix $X$', 206);
  circuit(t, qx + 20, 250, ['G[Load $|A_i\\rangle$] 0', 'CU[Load $|X\\rangle$] 0 1', 'G[V] 1', 'M 1'], { inputs: ['', ''], bundles: { 0: 'n', 1: 'd' }, pitch: 50, lead: 34 });
  lbl('(iv)  orthogonal layer: pyramid of RBS($\\theta$) gates', 344);
  const n = 6, cols: string[] = [];
  for (let col = 0; col <= 2 * (n - 2); col++) {
    const ops: string[] = [];
    for (let p = 0; p < n - 1; p++) if (col >= p && col <= 2 * (n - 2) - p && (col - p) % 2 === 0) ops.push(`CZ ${p} ${p + 1}`);
    cols.push(ops.join(' & '));
  }
  const py = circuit(t, qx + 10, 384, cols, { inputs: ['', '', '', '', '', ''], pitch: 28, gap: 14, minCol: 26, lead: 10, tail: 10 });
  for (const ops of py.ops) for (const o of ops) {
    o.label = '$\\theta$';
    o.fontSize = 11;
  }
  txt(t, '$\\mathrm{RBS}(\\theta)$: rotation in the $\\{|01\\rangle, |10\\rangle\\}$ subspace, preserves the Hamming weight', qx + 190, py.bottom + 22, 420, { fontSize: 11, textColor: SOFT });
  return t.done();
}

/**
 * Rudolph, Toussaint, Katabarwa, Johri, Peropadre & Perdomo-Ortiz, "Generation of high-resolution handwritten digits
 * with an ion-trap quantum computer", Phys. Rev. X 12, 031010 (2022), arXiv:2012.03924, Fig. 1 (QC-AAN).
 */
function qcaan() {
  const t = new Builder();
  const pnl = panel(t, '', 20, 20, 470, 330, { fill: '#FDF1E4', stroke: '#C9B79C', radius: 2 });
  txt(t, 'Multi-basis QCBM', 255, 368, 200, { fontSize: 13, bold: true });
  const c = circuit(t, 90, 60, ['G[U(\\theta)] 0-3 @blue w=72', '_', '_', 'M 0 1 2 3'], { inputs: [K0, K0, K0, K0], pitch: 34, tail: 10 });
  outBrace(t, c, 0, 3, '$\\mathbf{s}$', c.x1 + 2);
  const y2 = c.ys[3] + 70;
  const r = circuit(t, c.left[1] + 30, y2, ['G[\\pi/2] 0 1 2 3 @orange', 'G[\\varphi_1] 0 @orange & G[\\varphi_2] 1 @orange & G[\\varphi_7] 2 @orange & G[\\varphi_8] 3 @orange', 'M 0 1 2 3'], { inputs: ['', '', '', ''], pitch: 30, gate: 24, lead: 14, tail: 10, fontSize: 12 });
  outBrace(t, r, 0, 3, '$\\mathbf{s}_{o/t}$', r.x1 + 2);
  for (let q = 0; q < 4; q++) seg(t, c.right[0] + 14, c.ys[q], r.x0, r.ys[q], { dashed: true, color: '#777777', width: 0.8 });
  const lg = (s: string, y: number, label: string) => {
    t.add({ shape: 'qc-gate', label: s, x: 40, y: y - 13, w: 40, h: 26, ...BASE, fontSize: 12, ...ORANGE });
    ltxt(t, label, 88, y, 140, { fontSize: 14 });
  };
  lg('$\\pi/2$', y2 + 24, ':=  $e^{-i\\frac{\\pi}{2}\\,\\hat{X}}$');
  lg('$\\varphi$', y2 + 74, ':=  $e^{-i\\varphi\\,\\hat{X}}$');
  // GAN con prior quantistico
  const py = 230;
  const prior = t.add({ shape: 'cuboid', x: 560, y: py - 18, w: 22, h: 40, depth: 0.9, fill: '#FDF1E4', stroke: '#8C7B66', strokeWidth: 1 });
  txt(t, 'Prior\n$q(z)$', 575, py - 92, 60, { fontSize: 13, bold: true, h: 44, y: py - 116 });
  seg(t, 575, py - 68, 575, py - 24, { color: '#333333' });
  seg(t, pnl.x + pnl.w, pnl.y, prior.x, prior.y, { color: '#333333', dashed: true, width: 1 });
  seg(t, pnl.x + pnl.w, pnl.y + pnl.h, prior.x, prior.y + prior.h, { color: '#333333', dashed: true, width: 1 });
  const GY = { fill: '#F9D96B', stroke: '#B38F12' }, GG = { fill: '#37B87A', stroke: '#1E7A4E' };
  // strati come lastre in prospettiva: faccia frontale sottile, lato profondo
  const slab = (x: number, h: number, col: Color) => t.add({ shape: 'cuboid', x, y: py + 20 - h, w: Math.round((0.4 * h) / 0.9), h, depth: 0.9, ...col, strokeWidth: 1 });
  slab(606, 64, GY);
  slab(644, 112, GY);
  slab(702, 176, GY);
  t.add({ shape: 'qml-pixels', spec: 'digit dark res=20', count: 8, x: 792, y: py - 150, w: 64, h: 150, fill: '#111111', stroke: '#FFFFFF' });
  slab(876, 176, GG);
  slab(968, 112, GG);
  slab(1030, 64, GG);
  t.add({ shape: 'cuboid', x: 1074, y: py - 18, w: 22, h: 40, depth: 0.9, fill: '#C9E3D6', stroke: '#5A8F75', strokeWidth: 1 });
  txt(t, 'Latent space\n$p_l(z)$', 1085, py - 92, 100, { fontSize: 13, bold: true, h: 44, y: py - 116 });
  seg(t, 1085, py - 68, 1085, py - 24, { color: '#333333' });
  txt(t, 'Generator', 700, py + 50, 120, { fontSize: 14, bold: true });
  txt(t, 'Discriminator', 960, py + 50, 140, { fontSize: 14, bold: true });
  const tr = t.box('Training  $q \\sim p_l$', 745, 20, 170, 32, WHITE, { radius: 0, fontSize: 13, strokeWidth: 1.2, stroke: '#1A1A1A' });
  t.link(pt(t, 1085, py - 120), tr, 'top', 'right', { dashed: true, color: '#1A1A1A', arrowEnd: false });
  t.link(tr, pt(t, 575, py - 120), 'left', 'top', { dashed: true, color: '#1A1A1A' });
  return t.done();
}

/**
 * Bravo-Prieto, Baglio, Cè, Francis, Grabowska & Carrazza, "Style-based quantum generative adversarial networks
 * for Monte Carlo events", Quantum 6, 777 (2022), arXiv:2110.06933, Fig. 1–2.
 */
function styleQgan() {
  const t = new Builder();
  const B = (l: string, x: number, y: number, w: number, h: number, c: Color, extra: Partial<NodeModel> = {}) => t.box(l, x, y, w, h, c, { radius: 2, fontSize: 12, ...extra });
  const BL = { fill: '#3D9BF2', stroke: '#2F7FD0' }, YL = { fill: '#FFD21F', stroke: '#E0B400' }, RD = { fill: '#F98586', stroke: '#E06060' }, GR = { fill: '#D0D0D0', stroke: '#B0B0B0' }, OR = { fill: '#FF6A00', stroke: '#E05A00' };
  const inp = B('Input\ndistribution', 20, 50, 110, 80, BL, { textColor: '#FFFFFF', fontSize: 13 });
  const qg = B('Quantum\nGenerator', 190, 50, 110, 80, RD, { fontSize: 13 });
  B('Latent\nvariables', 316, 34, 64, 30, WHITE, { fontSize: 9, strokeWidth: 1 });
  const ref = B('Reference\nsamples', 30, 166, 90, 44, YL);
  const gs = B('Generated\nsamples', 200, 166, 90, 44, YL);
  t.group('Quantum neural network model', 176, 14, 214, 210, { fontSize: 10, italic: true, stroke: '#B8BEC8' });
  const dis = B('Classical\nDiscriminator', 110, 250, 110, 50, GR);
  t.link(inp, ref, 'bottom', 'top');
  t.link(qg, gs, 'bottom', 'top');
  for (let i = 0; i < 3; i++) t.link(pt(t, 348, 64), pt(t, 300, 82 + i * 18), 'bottom', 'right', { color: '#1A1A1A', width: 1 });
  t.link(ref, dis, 'bottom', 'left');
  t.link(gs, dis, 'bottom', 'right');
  const real = t.add({ shape: 'ellipse', x: 116, y: 338, w: 22, h: 22, fill: '#3D9BF2', stroke: '#2F7FD0', strokeWidth: 1 });
  const fake = t.add({ shape: 'ellipse', x: 192, y: 338, w: 22, h: 22, fill: '#F98586', stroke: '#E06060', strokeWidth: 1 });
  rtxt(t, 'Real', 112, 349, 40, { fontSize: 12 });
  ltxt(t, 'Fake', 218, 349, 40, { fontSize: 12 });
  t.link(dis, real, 'bottom', 'top', { routing: 'straight' });
  t.link(dis, fake, 'bottom', 'top', { routing: 'straight' });
  const loss = B('Loss', 125, 400, 80, 30, OR, { textColor: '#FFFFFF', fontSize: 13 });
  t.link(pt(t, 165, 366), loss, 'bottom', 'top', { width: 3, color: '#1A1A1A' });
  const D = { dashed: true, color: '#1A1A1A', width: 1 };
  path(t, [[205, 415], [412, 415], [412, 275], [220, 275]], D);
  path(t, [[412, 275], [412, 150], [285, 150], [285, 130]], D);
  ltxt(t, 'Classical optimization', 222, 404, 160, { fontSize: 10 });
  // circuito con le variabili latenti in ogni porta
  const g = (s: string) => `G[${s}] 0 1 2`;
  const c = circuit(t, 500, 90, [g('R_y'), g('R_z'), g('R_y'), g('R_z'), 'G[U_{\\mathrm{ent}}] 0-2 @gray w=46', '... 0 1 2', g('R_y'), 'M 0 1 2'], { inputs: [K0, K0, K0], tail: 12 });
  const one = c.around(0, 4, 0, 2, 8);
  t.group('', one.x, one.y, one.w, one.h, { stroke: '#555555' });
  txt(t, '1 layer', one.x + one.w / 2, one.y + one.h + 14, 80, { fontSize: 12 });
  ltxt(t, 'latent $\\mathbf{z}$', c.left[0] - 6, c.top - 54, 80, { fontSize: 13, textColor: '#B03A2E' });
  for (let k = 0; k < 4; k++) t.link(pt(t, c.xs[k], c.top - 38), pt(t, c.xs[k], c.top - 2), 'bottom', 'top', { color: '#B03A2E', width: 1, dashed: true });
  t.link(pt(t, c.xs[6], c.top - 38), pt(t, c.xs[6], c.top - 2), 'bottom', 'top', { color: '#B03A2E', width: 1, dashed: true });
  rule(t, c.xs[0], c.xs[6], c.top - 38, 0.9);
  txt(t, '$R^{l,m}_{y,z}(\\phi_g, \\mathbf{z}) = R_{y,z}(\\phi_g^{(l)} z^{(m)} + \\phi_g^{(l-1)})$', (c.x0 + c.x1) / 2, c.bottom + 62, 420, { fontSize: 14 });
  txt(t, 'sample  $\\mathbf{x} = (-\\langle{}\\sigma^1_z\\rangle, \\dots, -\\langle{}\\sigma^n_z\\rangle)$', (c.x0 + c.x1) / 2, c.bottom + 96, 420, { fontSize: 13, textColor: SOFT });
  const y3 = c.bottom + 130;
  plot(t, 'qml-dist', 'gamma target legend axis', 24, 'Gamma distribution: reference vs style-qGAN', 480, y3, 230, 140);
  plot(t, 'qml-curve', 'ganloss axis legend', 1, 'Loss convergence', 740, y3, 230, 140);
  return t.done();
}

export const QML_TEMPLATES: TemplateDef[] = [
  { id: 'qml-t-vqc', name: 'Classificatore variazionale (Havlíček 2019)', section: ML, build: vqc },
  { id: 'qml-t-encoding', name: 'Codifica dei dati (base, angolo, ampiezza, ZZ)', section: ML, build: encodings },
  { id: 'qml-t-pshift', name: 'Parameter shift (Schuld 2019)', section: ML, build: parameterShift },
  { id: 'qml-t-kernel', name: 'Kernel quantistico + SVM (Havlíček 2019)', section: ML, build: quantumKernel },
  { id: 'qml-t-qcnn', name: 'QCNN (Cong 2019)', section: ML, build: qcnn },
  { id: 'qml-t-reupload', name: 'Data re-uploading (Pérez-Salinas 2020)', section: ML, build: reuploading },
  { id: 'qml-t-transfer', name: 'Transfer learning ibrido (Mari 2020)', section: ML, build: transfer },
  { id: 'qml-t-barren', name: 'Barren plateau (McClean 2018)', section: ML, build: barren },
  { id: 'qml-t-reservoir', name: 'Reservoir computing quantistico (Fujii 2017)', section: ML, build: reservoir },
  { id: 'qml-t-qgan', name: 'qGAN (Zoufal 2019)', section: GEN, build: qgan },
  { id: 'qml-t-qcbm', name: 'Born machine QCBM (Benedetti 2019)', section: GEN, build: qcbm },
  { id: 'qml-t-qbm', name: 'Boltzmann machine quantistica (Amin 2018)', section: GEN, build: qbm },
  { id: 'qml-t-quddpm', name: 'Diffusione quantistica QuDDPM (Zhang 2024)', section: GEN, build: quddpm },
  { id: 'qml-t-qvit', name: 'Transformer quantistico (Cherrat 2022)', section: GEN, build: qvit },
  { id: 'qml-t-qcaan', name: 'QCBM come prior di GAN (Rudolph 2022)', section: GEN, build: qcaan },
  { id: 'qml-t-styleqgan', name: 'Style-qGAN (Bravo-Prieto 2022)', section: GEN, build: styleQgan },
];
