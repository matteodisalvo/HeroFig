// Modelli del modulo "Quantum computing": circuiti classici dei libri di testo (Nielsen & Chuang,
// Qiskit textbook) e degli articoli originali. I circuiti sono disposti con `circuit()`:
// ogni filo, porta e misura resta un blocco modificabile.
import { Builder, type Color } from '../builder';
import { COLORS, ICON, type NodeModel, type Side } from '../model';
import type { TemplateDef } from '../registry';
import { circuit, type Circuit } from './quantum-circuit';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const SEC = 'Quantum computing';
const K0 = '$|0\\rangle$';
const SOFT = '#555555';
const MUTED = '#8A8F98';
const SURF_X = { fill: '#F9DCC4', stroke: '#D9822B' };
const SURF_Z = { fill: '#D4E4F5', stroke: '#5B8DD6' };
type R = { x: number; y: number; w: number; h: number };

/** Porta i nodi indicati sul fondo (pannelli che contengono altri gruppi). */
const toBack = (t: Builder, ...ns: NodeModel[]) => (t.nodes = [...ns, ...t.nodes.filter((n) => !ns.includes(n))]);
/** Estremo invisibile centrato in (x, y). */
const pt = (t: Builder, x: number, y: number) => t.anchor(x - 0.5, y - 0.5);
/** Testo centrato in (cx, cy), allineato a sinistra da x o a destra fino a xr. */
const txt = (t: Builder, s: string, cx: number, cy: number, w: number, extra: Partial<NodeModel> = {}) => t.text(s, cx - w / 2, cy - 11, w, 22, { fontSize: 13, ...extra });
const ltxt = (t: Builder, s: string, x: number, cy: number, w: number, extra: Partial<NodeModel> = {}) => t.text(s, x, cy - 11, w, 22, { fontSize: 13, align: 'left', ...extra });
const rtxt = (t: Builder, s: string, xr: number, cy: number, w: number, extra: Partial<NodeModel> = {}) => t.text(s, xr - w, cy - 11, w, 22, { fontSize: 13, align: 'right', ...extra });
const brace = (t: Builder, direction: Side, x: number, y: number, w: number, h: number) => t.add({ shape: 'brace', direction, x, y, w, h, fill: 'none', stroke: SOFT, strokeWidth: 1.1 });
/** Linea orizzontale sottile (tabelle). */
const rule = (t: Builder, x0: number, x1: number, y: number, color = SOFT, width = 0.8) =>
  t.link(pt(t, x0, y), pt(t, x1, y), 'right', 'left', { arrowEnd: false, routing: 'straight', color, width });
/** Riquadro tratteggiato con il titolo sopra le porte. */
const region = (t: Builder, label: string, r: R, extra: Partial<NodeModel> = {}) => t.group(label, r.x, r.y - 20, r.w, r.h + 20, { fontSize: 11, ...extra });
const block = (t: Builder, label: string, cx: number, cy: number, w: number, h: number, c: Color, extra: Partial<NodeModel> = {}) =>
  t.box(label, cx - w / 2, cy - h / 2, w, h, c, { radius: 6, fontSize: 12, ...extra });
/** Graffa a destra dei fili q0..q1 del circuito, con etichetta. */
function outBrace(t: Builder, c: Circuit, q0: number, q1: number, label: string, x = c.x1 + 6) {
  brace(t, 'right', x, c.ys[q0] - 10, 10, c.ys[q1] - c.ys[q0] + 20);
  ltxt(t, label, x + 15, (c.ys[q0] + c.ys[q1]) / 2, 80, { fontSize: 14 });
}
/** Graffa a sinistra dei fili q0..q1 (prima delle etichette d'ingresso), con etichetta. */
function inBrace(t: Builder, c: Circuit, q0: number, q1: number, label: string, x: number, w = 90) {
  brace(t, 'left', x, c.ys[q0] - 10, 10, c.ys[q1] - c.ys[q0] + 20);
  rtxt(t, label, x - 5, (c.ys[q0] + c.ys[q1]) / 2, w, { fontSize: 12 });
}
/** Tabella semplice: intestazione e righe di celle, regole orizzontali come in booktabs. */
function table(t: Builder, x: number, y: number, widths: number[], rows: string[][], rh = 26) {
  const W = widths.reduce((a, b) => a + b, 0);
  rule(t, x, x + W, y, SOFT, 1);
  rows.forEach((row, i) => {
    let cx = x;
    row.forEach((s, j) => {
      txt(t, s, cx + widths[j] / 2, y + rh * (i + 0.5), widths[j] - 4, { bold: i === 0, fontSize: i === 0 ? 12 : 13 });
      cx += widths[j];
    });
  });
  rule(t, x, x + W, y + rh, SOFT, 0.7);
  rule(t, x, x + W, y + rh * rows.length, SOFT, 1);
}

// ======================================================================
// Entanglement e protocolli
// ======================================================================

/** Nielsen & Chuang, Fig. 1.12: H e CNOT trasformano |xy⟩ negli stati di Bell |β_xy⟩ (con la tabella). */
function bell() {
  const t = new Builder();
  const c = circuit(t, 50, 92, ['H 0', 'CX 0 1'], { inputs: ['$|x\\rangle$', '$|y\\rangle$'], tail: 22 });
  outBrace(t, c, 0, 1, '$|\\beta_{xy}\\rangle$', c.x1 + 4);
  const out = (a: string, s: string, b: string, k: string) => `$\\tfrac{1}{\\sqrt{2}}\\,(|${a}\\rangle ${s} |${b}\\rangle) \\equiv |\\beta_{${k}}\\rangle$`;
  table(t, 250, 20, [70, 250], [
    ['In', 'Out'],
    ['$|00\\rangle$', out('00', '+', '11', '00')],
    ['$|01\\rangle$', out('01', '+', '10', '01')],
    ['$|10\\rangle$', out('00', '-', '11', '10')],
    ['$|11\\rangle$', out('01', '-', '10', '11')],
  ], 34);
  return t.done();
}

/** Greenberger, Horne & Zeilinger (1989); Qiskit textbook: stato GHZ a 3 qubit, misura e conteggi. */
function ghz() {
  const t = new Builder();
  const c = circuit(t, 50, 50, ['H 0', 'CX 0 1', 'CX 1 2', 'SLICE[|\\mathrm{GHZ}\\rangle]', 'M 0 1 2'], { tail: 20 });
  t.text('$|\\mathrm{GHZ}\\rangle = \\frac{|000\\rangle + |111\\rangle}{\\sqrt{2}}$', c.x0 - 20, c.bottom + 40, 260, 44, { fontSize: 15 });
  const hx = c.x1 + 80;
  t.add({ shape: 'qc-hist', count: 3, spec: 'ghz values axis', label: 'Measurement outcomes', x: hx, y: c.ys[1] - 50, w: 200, h: 100, fill: 'none', stroke: '#5B8DD6', strokeWidth: 1, ...ICON, fontSize: 11 });
  t.link(pt(t, c.x1 + 8, c.ys[1]), pt(t, hx - 10, c.ys[1]), 'right', 'left', { label: 'shots', labelPos: 'above', fontSize: 10, color: MUTED, width: 1 });
  return t.done();
}

/** Nielsen & Chuang, Fig. 1.13: teletrasporto di |ψ⟩ con la coppia |β00⟩, misure e correzioni X^M2 Z^M1. */
function teleport() {
  const t = new Builder();
  const c = circuit(
    t, 90, 50,
    ['SLICE[|\\psi_0\\rangle]', 'CX 0 1', 'SLICE[|\\psi_1\\rangle]', 'H 0', 'SLICE[|\\psi_2\\rangle]', 'M 0 1', 'SLICE[|\\psi_3\\rangle]', 'CU[X^{M_2}] !1 2', 'CU[Z^{M_1}] !0 2', 'SLICE[|\\psi_4\\rangle]'],
    { inputs: ['$|\\psi\\rangle$', '', ''], outputs: ['', '', '$|\\psi\\rangle$'], trim: true },
  );
  brace(t, 'left', c.x0 - 16, c.ys[1] - 10, 10, c.ys[2] - c.ys[1] + 20);
  rtxt(t, '$|\\beta_{00}\\rangle$', c.x0 - 20, (c.ys[1] + c.ys[2]) / 2, 50, { fontSize: 14 });
  txt(t, '$M_1$', c.right[6] + 12, c.ys[0] - 14, 24, { fontSize: 11, textColor: SOFT });
  txt(t, '$M_2$', c.right[6] + 12, c.ys[1] - 14, 24, { fontSize: 11, textColor: SOFT });
  return t.done();
}

/** Bennett & Wiesner (1992); Qiskit textbook: codifica superdensa di due bit in un qubit condiviso. */
function superdense() {
  const t = new Builder();
  const c = circuit(t, 60, 80, ['H 0', 'CX 0 1', '_', 'G[X^{b_2}] 0', 'G[Z^{b_1}] 0', '_', 'CX 0 1', 'H 0', 'M 0 1'], { inputs: [K0, K0], outputs: ['$b_1$', '$b_2$'] });
  region(t, 'Bell pair', c.around(0, 1));
  region(t, 'Alice', c.around(3, 4, 0, 0), { stroke: '#D9822B', textColor: '#9A5B12' });
  region(t, 'Bob', c.around(6, 8), { stroke: '#5B8DD6', textColor: '#2F5E9E' });
  table(t, 70, c.bottom + 36, [70, 50, 50, 50, 50], [
    ['$b_1 b_2$', '00', '01', '10', '11'],
    ['Alice', '$I$', '$X$', '$Z$', '$ZX$'],
  ], 24);
  return t.done();
}

/**
 * Bennett & Brassard (1984): distribuzione di chiavi BB84. Alice invia fotoni polarizzati in basi casuali,
 * Bob misura in basi casuali, il confronto pubblico delle basi lascia la chiave condivisa (sifting).
 */
function bb84() {
  const t = new Builder();
  const person = (label: string, x: number, y: number, c: Color) => t.add({ shape: 'user', label, x, y, w: 40, h: 44, ...ICON, ...c, strokeWidth: 1.2 });
  const alice = person('Alice', 40, 60, BLUE);
  const bob = person('Bob', 600, 60, BLUE);
  const eve = person('Eve', 320, -10, RED);
  eve.labelPos = 'above';
  const yq = 82;
  t.link(alice, bob, 'right', 'left', { color: '#45A29E', width: 1.6 });
  ltxt(t, 'quantum channel (single photons)', 110, yq + 22, 200, { fontSize: 11, textColor: '#2F7F7A' });
  for (const [s, x] of [['h', 140], ['a', 190], ['v', 240], ['d', 450], ['a', 500], ['h', 550]] as const) {
    t.add({ shape: 'qc-polar', spec: `${s} circle`, x: x - 12, y: yq - 12, w: 24, h: 24, ...WHITE, strokeWidth: 1 });
  }
  t.link(eve, pt(t, 340, yq - 6), 'bottom', 'top', { dashed: true, arrowStart: true, color: '#B85450', width: 1.1 });
  ltxt(t, 'intercept–resend', 350, 52, 110, { fontSize: 10, textColor: '#B85450' });
  const yc = 150;
  t.link(pt(t, 60, yc), pt(t, 620, yc), 'right', 'left', { dashed: true, arrowStart: true, color: SOFT, width: 1.1, routing: 'straight', label: 'public classical channel: compare bases', labelPos: 'above', fontSize: 11 });
  t.link(pt(t, 60, 128), pt(t, 60, yc), 'bottom', 'top', { arrowEnd: false, color: SOFT, width: 1.1, dashed: true, routing: 'straight' });
  t.link(pt(t, 620, 128), pt(t, 620, yc), 'bottom', 'top', { arrowEnd: false, color: SOFT, width: 1.1, dashed: true, routing: 'straight' });

  // tabella del protocollo
  const bits = [0, 1, 1, 0, 1, 0, 0, 1];
  const aB = '+x++xx+x', bB = '++x+x++x';
  const res = [0, 0, 1, 0, 1, 1, 0, 1];
  const X0 = 190, CW = 50, Y0 = 200, RH = 32;
  const rows = ["Alice's bits", "Alice's bases", 'Photon sent', "Bob's bases", "Bob's results", 'Sifted key'];
  const cy = (r: number) => Y0 + RH * (r + 0.5);
  bits.forEach((_, j) => {
    if (aB[j] !== bB[j]) t.add({ shape: 'rect', x: X0 + j * CW + 3, y: Y0 + RH * 3 + 2, w: CW - 6, h: RH * 3 - 4, radius: 3, fill: '#F1F1F1', stroke: 'none' });
  });
  rows.forEach((s, r) => rtxt(t, s, X0 - 12, cy(r), 130, { fontSize: 12, textColor: '#374151' }));
  const basis = (b: string, j: number, r: number) =>
    t.add({ shape: 'qc-polar', spec: b === '+' ? 'rect' : 'diag', x: X0 + j * CW + CW / 2 - 10, y: cy(r) - 10, w: 20, h: 20, fill: 'none', stroke: b === '+' ? '#2F6FB2' : '#2E8B57', strokeWidth: 1.2 });
  bits.forEach((b, j) => {
    const cx = X0 + j * CW + CW / 2;
    const match = aB[j] === bB[j];
    txt(t, String(b), cx, cy(0), 20, { fontSize: 14 });
    basis(aB[j], j, 1);
    const p = aB[j] === '+' ? (b ? 'v' : 'h') : b ? 'a' : 'd';
    t.add({ shape: 'qc-polar', spec: `${p} circle`, x: cx - 12, y: cy(2) - 12, w: 24, h: 24, ...WHITE, strokeWidth: 1 });
    basis(bB[j], j, 3);
    txt(t, String(res[j]), cx, cy(4), 20, { fontSize: 14, textColor: match ? '#1A1A1A' : '#A0A4AB' });
    txt(t, match ? String(b) : '–', cx, cy(5), 20, { fontSize: 14, bold: match, textColor: match ? '#2E7D32' : '#A0A4AB' });
  });
  for (let r = 0; r <= 6; r++) rule(t, X0 - 140, X0 + CW * bits.length, Y0 + RH * r, r === 0 || r === 6 ? SOFT : '#D5D8DD', r === 0 || r === 6 ? 1 : 0.6);
  t.text('Bases differ: discarded (gray). Eve\'s intercept–resend introduces ≈25% errors in the sifted key.', X0 - 140, Y0 + RH * 6 + 8, 560, 20, { fontSize: 11, textColor: SOFT, align: 'left' });
  return t.done();
}

// ======================================================================
// Algoritmi
// ======================================================================

/** Nielsen & Chuang, Fig. 1.20: algoritmo di Deutsch–Jozsa con l'oracolo U_f: |x, y⟩ → |x, y ⊕ f(x)⟩. */
function deutschJozsa() {
  const t = new Builder();
  const c = circuit(
    t, 90, 60,
    ['SLICE[|\\psi_0\\rangle]', 'G[H^{\\otimes n}] 0 & H 1', 'SLICE[|\\psi_1\\rangle]', 'G[U_f] 0-1 w=130 @yellow', 'SLICE[|\\psi_2\\rangle]', 'G[H^{\\otimes n}] 0', 'SLICE[|\\psi_3\\rangle]', 'M 0'],
    { inputs: ['$|0\\rangle^{\\otimes n}$', '$|1\\rangle$'], bundles: { 0: 'n' }, pitch: 52, lead: 34 },
  );
  const l = c.left[3], r = c.right[3];
  ltxt(t, '$x$', l + 6, c.ys[0], 20, { fontSize: 12 });
  ltxt(t, '$y$', l + 6, c.ys[1], 20, { fontSize: 12 });
  rtxt(t, '$x$', r - 6, c.ys[0], 20, { fontSize: 12 });
  rtxt(t, '$y \\oplus f(x)$', r - 6, c.ys[1], 60, { fontSize: 12 });
  txt(t, 'Outcome $0^n$ with certainty $\\Leftrightarrow$ $f$ constant; any other outcome $\\Rightarrow$ $f$ balanced', (c.x0 + c.x1) / 2 - 20, c.bottom + 58, 520, { fontSize: 12, textColor: SOFT });
  return t.done();
}

/** Nielsen & Chuang, Fig. 5.1 (n = 3) e Qiskit textbook: QFT con H, rotazioni R_k controllate e SWAP finale. */
function qft() {
  const t = new Builder();
  const out = ['$|0\\rangle + e^{2\\pi i\\,0.j_3}|1\\rangle$', '$|0\\rangle + e^{2\\pi i\\,0.j_2 j_3}|1\\rangle$', '$|0\\rangle + e^{2\\pi i\\,0.j_1 j_2 j_3}|1\\rangle$'];
  const c = circuit(t, 50, 40, ['H 0', 'CU[R_2] 1 0', 'CU[R_3] 2 0', 'H 1', 'CU[R_2] 2 1', 'H 2', 'SWAP 0 2'], {
    inputs: ['$|j_1\\rangle$', '$|j_2\\rangle$', '$|j_3\\rangle$'],
    outputs: out,
    fontSize: 14,
  });
  const r = c.around(0, 5);
  region(t, 'QFT on 3 qubits (before bit reversal)', r, { stroke: '#B8BEC8', textColor: SOFT });
  txt(t, '$R_k = \\mathrm{diag}(1,\\, \\omega_k)$,  $\\omega_k = \\exp(2\\pi i / 2^k)$;  normalization factors omitted', (c.x0 + c.x1) / 2 + 30, c.bottom + 34, 480, { fontSize: 12, textColor: SOFT });
  return t.done();
}

/** Grover (1996); Nielsen & Chuang, Fig. 6.1–6.3: oracolo di fase, diffusione e amplificazione d'ampiezza (N = 8, w = 101). */
function grover() {
  const t = new Builder();
  const c = circuit(t, 50, 70, ['H 0 1 2', 'G[U_\\omega] 0-2 @orange w=46', 'G[U_s] 0-2 @blue w=46', 'M 0 1 2'], { tail: 18 });
  const g = c.around(1, 2, 0, 2, 8);
  t.group('Grover iteration $G$', g.x, g.y - 22, g.w, g.h + 22, { fontSize: 11 });
  txt(t, 'oracle', c.xs[1], g.y + g.h + 12, 50, { fontSize: 10, textColor: SOFT });
  txt(t, 'diffuser', c.xs[2], g.y + g.h + 12, 50, { fontSize: 10, textColor: SOFT });
  t.text('repeat $\\approx \\frac{\\pi}{4}\\sqrt{N}$ times', g.x + g.w / 2 - 80, g.y + g.h + 24, 160, 36, { fontSize: 12 });
  // ampiezze: sovrapposizione → oracolo → diffusione
  const amp = (spec: string, label: string, x: number) =>
    t.add({ shape: 'qc-amps', count: 8, spec, label, x, y: 66, w: 120, h: 76, fill: 'none', stroke: '#5B8DD6', strokeWidth: 1, ...ICON, fontSize: 11 });
  const a1 = amp('uniform mean', 'Superposition', 330);
  const a2 = amp('oracle mean labels', 'Phase flip of $|w\\rangle$', 500);
  const a3 = amp('diffuse mean labels', 'Inversion about the mean', 670);
  t.link(a1, a2, 'right', 'left', { label: '$U_\\omega$', labelPos: 'above', fontSize: 12, color: MUTED });
  t.link(a2, a3, 'right', 'left', { label: '$U_s$', labelPos: 'above', fontSize: 12, color: MUTED });
  // decomposizione di oracolo e diffusore
  const y2 = 266;
  rtxt(t, '$U_\\omega =$', 110, y2 + 42, 60, { fontSize: 14 });
  circuit(t, 130, y2, ['X 1', 'CCZ 0 1 2', 'X 1'], { inputs: ['', '', ''], lead: 10, tail: 10 });
  txt(t, 'phase oracle for $w = 101$', 200, y2 + 120, 170, { fontSize: 11, textColor: SOFT });
  rtxt(t, '$U_s =$', 430, y2 + 42, 60, { fontSize: 14 });
  circuit(t, 450, y2, ['H 0 1 2', 'X 0 1 2', 'CCZ 0 1 2', 'X 0 1 2', 'H 0 1 2'], { inputs: ['', '', ''], lead: 10, tail: 10 });
  txt(t, '$2|s\\rangle\\langle s| - I$ (up to a global phase)', 570, y2 + 120, 240, { fontSize: 11, textColor: SOFT });
  return t.done();
}

/** Nielsen & Chuang, Fig. 5.2–5.3 (t = 3): stima di fase con U^{2^j} controllate e QFT inversa. */
function qpe() {
  const t = new Builder();
  const c = circuit(t, 120, 50, ['H 0 1 2', 'CU[U] 2 3', 'CU[U^2] 1 3', 'CU[U^4] 0 3', 'IQFT 0-2 @orange', 'M 0 1 2'], {
    inputs: [K0, K0, K0, '$|u\\rangle$'],
    outputs: ['', '', '', '$|u\\rangle$'],
    bundles: { 3: 'm' },
  });
  inBrace(t, c, 0, 2, 'First register\n$t$ qubits', c.x0 - 40);
  ltxt(t, 'Second register', c.x0 - 150, c.ys[3], 100, { fontSize: 12, align: 'right', x: c.x0 - 150 });
  outBrace(t, c, 0, 2, '$\\tilde{\\varphi}$');
  txt(t, '$U|u\\rangle = e^{2\\pi i \\varphi}|u\\rangle$;  the measurement gives the $t$-bit estimate $\\tilde{\\varphi} \\approx \\varphi$', (c.x0 + c.x1) / 2, c.bottom + 30, 460, { fontSize: 12, textColor: SOFT });
  return t.done();
}

/** Shor (1994); Nielsen & Chuang, Fig. 5.4: ricerca dell'ordine r di x mod N ed elaborazione classica. */
function shor() {
  const t = new Builder();
  const c = circuit(t, 130, 60, ['G[H^{\\otimes t}] 0', 'G[x^j\\,\\mathrm{mod}\\,N] 0-1 @yellow w=150', 'IQFT 0 @orange', 'M 0'], {
    inputs: ['$|0\\rangle$', '$|1\\rangle$'],
    bundles: { 0: 't', 1: 'L' },
    pitch: 56,
    lead: 34,
    tail: 24,
  });
  ltxt(t, 'Register 1\n$t$ qubits', c.x0 - 120, c.ys[0], 80, { fontSize: 11, h: 34, y: c.ys[0] - 17, textColor: SOFT });
  ltxt(t, 'Register 2\n$L$ qubits', c.x0 - 120, c.ys[1], 80, { fontSize: 11, h: 34, y: c.ys[1] - 17, textColor: SOFT });
  const l = c.left[1], r = c.right[1];
  ltxt(t, '$|j\\rangle$', l + 6, c.ys[0], 30, { fontSize: 12 });
  ltxt(t, '$|k\\rangle$', l + 6, c.ys[1], 30, { fontSize: 12 });
  rtxt(t, '$|j\\rangle$', r - 6, c.ys[0], 30, { fontSize: 12 });
  rtxt(t, '$|x^j k\\,\\mathrm{mod}\\,N\\rangle$', r - 6, c.ys[1], 100, { fontSize: 12 });
  txt(t, 'Order finding: smallest $r > 0$ with $x^r \\equiv 1\\ (\\mathrm{mod}\\ N)$', (c.x0 + c.x1) / 2 - 40, c.bottom + 34, 420, { fontSize: 12, textColor: SOFT });
  // elaborazione classica, in colonna a destra del registro misurato
  const bx = c.x1 + 150, dy = 66;
  t.group('Classical post-processing', bx - 100, c.ys[0] - 52, 200, 3 * dy + 80, { fontSize: 11 });
  const b1 = block(t, '$\\tilde{\\varphi} = y/2^t \\approx s/r$', bx, c.ys[0], 170, 40, WHITE, { fontSize: 13 });
  const b2 = block(t, 'Continued fractions\n$\\Rightarrow$ order $r$', bx, c.ys[0] + dy, 170, 44, BLUE);
  const b3 = block(t, '$\\mathrm{gcd}(x^{r/2} \\pm 1,\\, N)$', bx, c.ys[0] + 2 * dy, 170, 40, GREEN, { fontSize: 13 });
  const b4 = block(t, 'Factors $p,\\, q$ of $N$', bx, c.ys[0] + 3 * dy, 170, 40, YELLOW);
  t.chain([b1, b2, b3, b4], 'down');
  t.link(pt(t, c.x1 + 4, c.ys[0]), b1, 'right', 'left', { label: '$y$', labelPos: 'above', fontSize: 12, color: MUTED });
  return t.done();
}

/** Peruzzo et al. (2014), Fig. 1; McClean et al. (2016): ciclo VQE fra processore quantistico e ottimizzatore classico. */
function vqe() {
  const t = new Builder();
  const ry = (k: number) => [0, 1, 2, 3].map((q) => `RY[\\theta_${q + k}] ${q}`).join(' & ');
  const c = circuit(t, 70, 140, [ry(1), 'CX 0 1', 'CX 1 2', 'CX 2 3', ry(5), 'M 0 1 2 3'], {});
  const a = c.around(0, 4, 0, 3, 8);
  const ans = t.group('Ansatz $U(\\theta)$', a.x, a.y - 20, a.w, a.h + 20, { fontSize: 11, stroke: '#9673A6', textColor: '#6B4F7E' });
  // l'ottimizzatore sta più in alto del riquadro dell'ansatz: la freccia di ritorno è una L pulita
  const yo = a.y - 42, top = yo - 58, bottom = c.bottom + 58;
  const panel = { fontSize: 12, bold: true, dashed: false, stroke: '#B8BEC8', fill: '#FAFBFC' };
  const qpu = t.group('Quantum processor', 14, top, c.x1 + 12, bottom - top, panel);
  const gx = c.x1 + 70;
  const cls = t.group('Classical computer', gx, top, 250, bottom - top, panel);
  toBack(t, qpu, cls);
  const opt = block(t, 'Optimizer\n(COBYLA, SPSA, Adam)', gx + 125, yo, 190, 48, GREEN);
  const mid = (c.ys[1] + c.ys[2]) / 2;
  const en = block(t, 'Energy estimate\n$E(\\theta) = \\sum_i c_i \\langle P_i \\rangle$', gx + 125, mid, 190, 62, ORANGE);
  const ham = block(t, '$\\hat{H} = \\sum_i c_i P_i$', gx + 125, c.bottom + 20, 150, 40, YELLOW, { fontSize: 13 });
  t.link(pt(t, c.x1 + 4, mid), en, 'right', 'left', { label: 'shots', labelPos: 'above', fontSize: 10 });
  t.link(ham, en, 'top', 'bottom');
  t.link(en, opt, 'top', 'bottom');
  t.link(opt, ans, 'left', 'top', { label: '$\\theta_{k+1}$', labelPos: 'above', fontSize: 13, color: '#6B4F7E' });
  const res = t.text('$E_0 \\approx \\min_{\\theta} E(\\theta)$', gx + 290, yo - 20, 120, 40, { fontSize: 14 });
  t.link(opt, res, 'right', 'left', { label: 'converged', labelPos: 'below', fontSize: 10 });
  return t.done();
}

/** Farhi, Goldstone & Gutmann (2014): QAOA per MaxCut, p strati alternati di costo e mixer, ciclo classico. */
function qaoa() {
  const t = new Builder();
  // istanza MaxCut: 4 nodi
  const P = [[40, 70], [120, 70], [120, 150], [40, 150]];
  const v = P.map(([x, y], i) => t.add({ shape: 'ellipse', label: String(i), x: x - 13, y: y - 13, w: 26, h: 26, fontSize: 11, strokeWidth: 1.2, ...BLUE }));
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]]) t.link(v[a], v[b], 'auto', 'auto', { routing: 'straight', arrowEnd: false, color: '#6C8EBF', width: 1.4 });
  txt(t, 'MaxCut instance', 80, 186, 120, { fontSize: 11, textColor: SOFT });
  const c = circuit(t, 230, 50, ['H 0 1 2 3', 'G[U_C(\\gamma_1)] 0-3 @orange', 'G[U_B(\\beta_1)] 0-3 @blue', '... 0 1 2 3', 'G[U_C(\\gamma_p)] 0-3 @orange', 'G[U_B(\\beta_p)] 0-3 @blue', 'M 0 1 2 3'], {});
  const l1 = c.around(1, 2, 0, 3, 7), lp = c.around(4, 5, 0, 3, 7);
  const g1 = t.group('Layer 1', l1.x, l1.y - 18, l1.w, l1.h + 18, { fontSize: 11 });
  const gp = t.group('Layer $p$', lp.x, lp.y - 18, lp.w, lp.h + 18, { fontSize: 11 });
  const mid = (c.ys[1] + c.ys[2]) / 2;
  const opt = block(t, 'Classical optimizer\n$\\max_{\\gamma, \\beta} \\langle H_C \\rangle$', c.x1 + 150, mid, 150, 64, GREEN);
  t.link(pt(t, c.x1 + 4, mid), opt, 'right', 'left', { label: '$\\langle H_C \\rangle$', labelPos: 'above', fontSize: 12 });
  t.link(opt, g1, 'top', 'top', { label: '$(\\gamma, \\beta)$', labelPos: 'above', fontSize: 13, color: '#3F7F3A' });
  t.link(pt(t, gp.x + gp.w / 2, g1.y - 18), gp, 'bottom', 'top', { color: '#3F7F3A' });
  txt(t, '$U_C(\\gamma) = \\exp(-i\\gamma H_C)$,  $U_B(\\beta) = \\exp(-i\\beta H_B)$,  $H_C = \\sum_{(i,j) \\in E} Z_i Z_j$,  $H_B = \\sum_i X_i$', (c.x0 + c.x1) / 2 - 20, c.bottom + 40, 620, { fontSize: 13, h: 40, y: c.bottom + 20 });
  // decomposizioni
  const y2 = c.bottom + 92;
  rtxt(t, '$U_C(\\gamma)$ on edge $(i,j)$:', 330, y2 + 21, 170, { fontSize: 13 });
  circuit(t, 370, y2, ['CX 0 1', 'RZ[2\\gamma] 1', 'CX 0 1'], { inputs: ['$q_i$', '$q_j$'], lead: 10, tail: 10 });
  rtxt(t, '$U_B(\\beta)$ on qubit $i$:', 700, y2 + 21, 160, { fontSize: 13 });
  circuit(t, 740, y2 + 21, ['RX[2\\beta] 0'], { inputs: ['$q_i$'], lead: 10, tail: 10 });
  return t.done();
}

// ======================================================================
// Correzione degli errori
// ======================================================================

/** Nielsen & Chuang, Fig. 10.2–10.3: codice a ripetizione (bit flip) con misura della sindrome e correzione. */
function repetition() {
  const t = new Builder();
  const c = circuit(t, 120, 60, ['CX 0 1', 'CX 0 2', '_', 'G[\\mathcal{E}] 0-2 @red w=40', '_', 'CX 0 3', 'CX 1 3', 'CX 1 4', 'CX 2 4', 'M 3 4', 'CU[\\mathcal{R}] !3 !4 0-2 w=58'], {
    inputs: ['$|\\psi\\rangle$', K0, K0, K0, K0],
    trim: true,
  });
  region(t, 'Encoding', c.around(0, 1, 0, 2));
  region(t, 'Noise', c.around(3, 3, 0, 2), { stroke: '#B85450', textColor: '#9C3D38' });
  region(t, 'Syndrome measurement', c.around(5, 9, 0, 4, 3));
  region(t, 'Recovery', c.around(10, 10, 0, 4, 3));
  inBrace(t, c, 0, 2, 'data', c.x0 - 42, 50);
  inBrace(t, c, 3, 4, 'ancillas', c.x0 - 42, 60);
  outBrace(t, c, 0, 2, '$|\\psi_L\\rangle$');
  table(t, c.x1 + 90, c.ys[0] + 20, [76, 92, 72], [
    ['Syndrome', 'Error', 'Recovery'],
    ['00', 'none', '$I$'],
    ['10', 'qubit 1', '$X_1$'],
    ['11', 'qubit 2', '$X_2$'],
    ['01', 'qubit 3', '$X_3$'],
  ]);
  txt(t, '$|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle \\;\\to\\; \\alpha|000\\rangle + \\beta|111\\rangle$', (c.x0 + c.x1) / 2, c.bottom + 30, 360, { fontSize: 13, textColor: SOFT });
  return t.done();
}

/** Fowler et al. (2012), Fig. 1: codice di superficie ruotato e circuiti di misura degli stabilizzatori Z e X. */
function surfaceCode() {
  const t = new Builder();
  t.add({ shape: 'qc-surface', count: 5, spec: 'ancilla', label: 'Rotated surface code, $d = 5$', x: 20, y: 130, w: 240, h: 240, fill: 'none', stroke: '#333333', strokeWidth: 1, ...ICON, fontSize: 12 });
  // legenda
  const ly = 420;
  t.add({ shape: 'ellipse', x: 30, y: ly - 6, w: 12, h: 12, ...WHITE, strokeWidth: 1 });
  ltxt(t, 'data qubit', 48, ly, 80, { fontSize: 11 });
  t.add({ shape: 'rect', x: 130, y: ly - 6, w: 12, h: 12, radius: 2, fill: SURF_X.stroke, stroke: '#9A5B12', strokeWidth: 0.8 });
  ltxt(t, 'measure-X', 148, ly, 70, { fontSize: 11 });
  t.add({ shape: 'rect', x: 220, y: ly - 6, w: 12, h: 12, radius: 2, fill: SURF_Z.stroke, stroke: '#2F5E9E', strokeWidth: 0.8 });
  ltxt(t, 'measure-Z', 238, ly, 70, { fontSize: 11 });
  // plaquette e circuito di misura
  const plaquette = (cx: number, cy: number, c: { fill: string; stroke: string }, op: string) => {
    const s = 56;
    t.add({ shape: 'rect', x: cx - s / 2, y: cy - s / 2, w: s, h: s, radius: 0, fill: c.fill, stroke: c.stroke, strokeWidth: 1 });
    ['a', 'b', 'c', 'd'].forEach((q, i) => {
      const qx = cx + (i % 2 ? s / 2 : -s / 2), qy = cy + (i < 2 ? -s / 2 : s / 2);
      t.add({ shape: 'ellipse', label: `$${q}$`, x: qx - 8, y: qy - 8, w: 16, h: 16, fontSize: 10, ...WHITE, strokeWidth: 1 });
    });
    t.add({ shape: 'rect', x: cx - 6, y: cy - 6, w: 12, h: 12, radius: 2, fill: c.stroke, stroke: c.stroke, strokeWidth: 0.8 });
    txt(t, op, cx, cy + s / 2 + 22, 130, { fontSize: 12 });
  };
  const ins = ['$a$', '$b$', '$c$', '$d$', K0];
  plaquette(370, 112, SURF_Z, '$Z_a Z_b Z_c Z_d$');
  const cz = circuit(t, 490, 30, ['CX 0 4', 'CX 1 4', 'CX 2 4', 'CX 3 4', 'M 4'], { inputs: ins, pitch: 38 });
  plaquette(370, 340, SURF_X, '$X_a X_b X_c X_d$');
  const cx = circuit(t, 490, 258, ['H 4', 'CX 4 0', 'CX 4 1', 'CX 4 2', 'CX 4 3', 'H 4', 'M 4'], { inputs: ins, pitch: 38 });
  ltxt(t, 'measure-Z qubit', cz.x1 + 8, cz.ys[4], 100, { fontSize: 11, textColor: '#2F5E9E' });
  ltxt(t, 'measure-X qubit', cx.x1 + 8, cx.ys[4], 100, { fontSize: 11, textColor: '#9A5B12' });
  return t.done();
}

export const QUANTUM_TEMPLATES: TemplateDef[] = [
  { id: 'qc-t-bell', name: 'Stati di Bell', section: SEC, build: bell },
  { id: 'qc-t-ghz', name: 'Stato GHZ', section: SEC, build: ghz },
  { id: 'qc-t-teleport', name: 'Teletrasporto quantistico', section: SEC, build: teleport },
  { id: 'qc-t-superdense', name: 'Codifica superdensa', section: SEC, build: superdense },
  { id: 'qc-t-bb84', name: 'Crittografia BB84', section: SEC, build: bb84 },
  { id: 'qc-t-dj', name: 'Deutsch–Jozsa', section: SEC, build: deutschJozsa },
  { id: 'qc-t-qft', name: 'Trasformata di Fourier quantistica', section: SEC, build: qft },
  { id: 'qc-t-grover', name: 'Algoritmo di Grover', section: SEC, build: grover },
  { id: 'qc-t-qpe', name: 'Stima di fase (QPE)', section: SEC, build: qpe },
  { id: 'qc-t-shor', name: 'Shor: ricerca dell\'ordine', section: SEC, build: shor },
  { id: 'qc-t-vqe', name: 'VQE', section: SEC, build: vqe },
  { id: 'qc-t-qaoa', name: 'QAOA', section: SEC, build: qaoa },
  { id: 'qc-t-repcode', name: 'Codice a ripetizione', section: SEC, build: repetition },
  { id: 'qc-t-surface', name: 'Codice di superficie', section: SEC, build: surfaceCode },
];
void [PURPLE, TEAL, GRAY];
