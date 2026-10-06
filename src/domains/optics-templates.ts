// Modelli del modulo "Ottica e fotonica": banchi ottici classici (lente sottile, 4f,
// interferometri, microscopi confocale e a foglio di luce, olografia, OCT, LiDAR) e figure
// ricostruite da paper di imaging computazionale e calcolo ottico (D2NN, rete di MZI,
// fotocamera a pixel singolo, lensless con ADMM srotolato, Fourier ptychography, ottica end-to-end).
// I fasci sono blocchi `opt-beam` / `opt-fan` inseriti per primi, così i componenti stanno sopra;
// i blocchi sono posizionati per centro, così fasci e componenti restano allineati sull'asse.
import { Builder, type Color } from '../builder';
import { COLORS, ICON, MED_IMG, type EdgeModel, type NodeModel, type Side } from '../model';
import type { TemplateDef } from '../registry';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const SEC = 'Ottica e fotonica';
type N = NodeModel;
type P2 = [number, number];

const INK = '#4B5563';
const SOFT = '#9AA0A6';
const RAY = '#D9534F';
const FIB = '#D79B00';
const BR: Color = { fill: '#F9D3CF', stroke: '#D9665A' };
const BG: Color = { fill: '#D5EDD0', stroke: '#5FA15A' };
const GLASS: Color = BLUE;
const METAL: Color = GRAY;
const BODY: Color = { fill: '#EEF0F3', stroke: '#5B6270' };
const DARK: Color = { fill: '#4B5563', stroke: '#2F3338' };
const LW = { strokeWidth: 1.2 };

/** Rettangolo dato il centro. */
const C = (cx: number, cy: number, w: number, h: number) => ({ x: cx - w / 2, y: cy - h / 2, w, h });

/** Taglio a 45° di un'estremità del fascio, per incontrare uno specchio '/' o '\\' nel suo centro. */
type Cut = '' | '/' | '\\';
const SLASH: Record<Side, number> = { right: -1, left: 1, bottom: -1, top: 1 };

/** Fascio dritto da a a b (orizzontale o verticale), larghezza w0 → w1, estremità tagliate a 45° se serve. */
function beam(t: Builder, a: P2, b: P2, w0: number, w1 = w0, c: Color = BR, spec = '', ca: Cut = '', cb: Cut = ''): N {
  const horiz = Math.abs(a[1] - b[1]) < 0.01;
  const len = horiz ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1]);
  const W = Math.max(w0, w1, 1);
  const direction: Side = horiz ? (b[0] >= a[0] ? 'right' : 'left') : b[1] >= a[1] ? 'bottom' : 'top';
  const prof = w0 === w1 ? 'collimated' : w0 > w1 ? 'focus' : 'diverge';
  const cut = (k: Cut, end: string) => (k ? `${end}${(k === '/' ? SLASH[direction] : -SLASH[direction]) > 0 ? 1 : 2}` : '');
  const rect = horiz ? { x: Math.min(a[0], b[0]), y: a[1] - W / 2, w: len, h: W } : { x: a[0] - W / 2, y: Math.min(a[1], b[1]), w: W, h: len };
  const sp = [prof, spec, cut(ca, 'cs'), cut(cb, 'ce')].filter(Boolean).join(' ');
  return t.add({ shape: 'opt-beam', spec: sp, count: Math.round((Math.min(w0, w1) / W) * 100), direction, ...rect, ...c, ...LW });
}

/** Fascio di eccitazione con l'emissione (più stretta) sovrapposta: cammino condiviso. */
function duo(t: Builder, a: P2, b: P2, w0: number, w1 = w0, ca: Cut = '', cb: Cut = '') {
  beam(t, a, b, w0, w1, BG, '', ca, cb);
  beam(t, a, b, w0 * 0.6, w1 * 0.6, BR, '', ca, cb);
}

/** Cono di luce da un punto (vertice) a un lato intero, dentro il rettangolo dato. */
function cone(t: Builder, x: number, y: number, w: number, h: number, apex: number, direction: Side = 'right', spec = 'cone', c: Color = BR): N {
  return t.add({ shape: 'opt-fan', spec, count: Math.round(apex * 100), direction, x, y, w, h, ...c, ...LW });
}

/** Segmento libero fra due punti (raggi, quote, rimandi). */
function seg(t: Builder, a: P2, b: P2, extra: Partial<EdgeModel> = {}) {
  t.link(t.anchor(a[0] - 0.5, a[1] - 0.5), t.anchor(b[0] - 0.5, b[1] - 0.5), 'right', 'left', { routing: 'straight', arrowEnd: false, ...extra });
}
const arrowSeg = (t: Builder, a: P2, b: P2, extra: Partial<EdgeModel> = {}) => seg(t, a, b, { arrowEnd: true, ...extra });
/** Quota con doppia freccia e etichetta sopra. */
const dim = (t: Builder, a: P2, b: P2, label: string, extra: Partial<EdgeModel> = {}) =>
  seg(t, a, b, { arrowStart: true, arrowEnd: true, color: SOFT, width: 0.8, label, labelPos: 'above', fontSize: 12, ...extra });
/** Raggio a tratti con una freccia a metà di ogni tratto. */
function ray(t: Builder, pts: P2[], color = RAY, width = 1.2) {
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const m: P2 = [a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    seg(t, a, m, { color, width, arrowEnd: true });
    seg(t, [m[0] - ((b[0] - a[0]) / l) * 4, m[1] - ((b[1] - a[1]) / l) * 4], b, { color, width });
  }
}

const label = (t: Builder, text: string, cx: number, cy: number, extra: Partial<N> = {}, w = 120, h = 18) => t.text(text, cx - w / 2, cy - h / 2, w, h, { fontSize: 11, ...extra });
const leftLabel = (t: Builder, text: string, x: number, cy: number, extra: Partial<N> = {}, w = 160, h = 18) => t.text(text, x, cy - h / 2, w, h, { fontSize: 11, align: 'left', ...extra });
const rightLabel = (t: Builder, text: string, x: number, cy: number, extra: Partial<N> = {}, w = 160, h = 18) => t.text(text, x - w, cy - h / 2, w, h, { fontSize: 11, align: 'right', ...extra });
const title = (t: Builder, text: string, x: number, y: number, w = 220) => t.text(text, x, y, w, 20, { fontSize: 12, bold: true, align: 'left' });

// componenti (per centro)
const lens = (t: Builder, cx: number, cy: number, h: number, vertical = true, extra: Partial<N> = {}) =>
  t.add({ shape: 'opt-lens', spec: 'convex', count: 5, ...C(cx, cy, vertical ? 16 : h, vertical ? h : 16), direction: vertical ? 'right' : 'bottom', ...GLASS, ...LW, ...extra });
const mirror = (t: Builder, cx: number, cy: number, spec: string, direction: Side, s = 40, extra: Partial<N> = {}) =>
  t.add({ shape: 'opt-mirror', spec, direction, ...C(cx, cy, s, s), ...METAL, ...LW, ...extra });
const flat = (t: Builder, cx: number, cy: number, direction: Side, len = 64, extra: Partial<N> = {}) =>
  t.add({ shape: 'opt-mirror', spec: 'flat', direction, ...C(cx, cy, direction === 'left' || direction === 'right' ? 12 : len, direction === 'left' || direction === 'right' ? len : 12), ...METAL, ...LW, ...extra });
const bs = (t: Builder, cx: number, cy: number, spec = 'cube d45', s = 38, extra: Partial<N> = {}) => t.add({ shape: 'opt-bs', spec, ...C(cx, cy, s, s), ...GLASS, ...LW, ...extra });
const laser = (t: Builder, text: string, cx: number, cy: number, w = 110, h = 40, extra: Partial<N> = {}) =>
  t.add({ shape: 'opt-laser', spec: 'box sign', label: text, ...C(cx, cy, w, h), fontSize: 12, ...BODY, ...LW, ...extra });
const img = (t: Builder, spec: string, text: string, cx: number, cy: number, s = 84, extra: Partial<N> = {}) =>
  t.add({ shape: 'opt-pattern', spec, ...MED_IMG, label: text, ...C(cx, cy, s, s), ...extra });
const objective = (t: Builder, cx: number, cy: number, direction: Side = 'bottom', len = 80, dia = 44) =>
  t.add({ shape: 'opt-objective', direction, ...C(cx, cy, direction === 'left' || direction === 'right' ? len : dia, direction === 'left' || direction === 'right' ? dia : len), ...METAL, ...LW });
const box = (t: Builder, text: string, cx: number, cy: number, w: number, h: number, c: Color, extra: Partial<N> = {}) => t.box(text, cx - w / 2, cy - h / 2, w, h, c, { radius: 6, ...extra });
const zone = (t: Builder, text: string, x: number, y: number, w: number, h: number, extra: Partial<N> = {}) => t.group(text, x, y, w, h, { fontSize: 11, ...extra });

// ======================================================================
// Ottica geometrica e di Fourier
// ======================================================================

/** Lente sottile: oggetto, immagine reale e i tre raggi principali (ottica geometrica). */
function thinLens() {
  const t = new Builder();
  const Y = 200, XL = 320, f = 100, so = 180, ho = 70;
  const si = 1 / (1 / f - 1 / so), hi = (ho * si) / so;
  const XO = XL - so, XI = XL + si, XE = XI + 50;
  t.add({ shape: 'opt-axis', spec: 'arrow', ...C(340, Y, 660, 10), fill: 'none', stroke: SOFT, strokeWidth: 0.9 });
  const top: P2 = [XO, Y - ho];
  ray(t, [top, [XL, Y - ho], [XE, Y - ho + (ho / f) * (XE - XL)]], '#D9534F');
  ray(t, [top, [XE, Y - ho + (ho / so) * (XE - XO)]], '#2E8B57');
  ray(t, [top, [XL, Y + hi], [XE, Y + hi]], '#D9822B');
  t.add({ shape: 'opt-lens', spec: 'convex thin', ...C(XL, Y, 14, 250), fill: 'none', stroke: '#3A3F47', ...LW });
  t.add({ shape: 'opt-object', spec: 'arrow', direction: 'top', ...C(XO, Y - ho / 2, 12, ho), fill: 'none', stroke: '#2F6FB2', ...LW });
  t.add({ shape: 'opt-object', spec: 'arrow', direction: 'bottom', ...C(XI, Y + hi / 2, 12, hi), fill: 'none', stroke: '#7E57C2', ...LW });
  for (const x of [XL - f, XL + f]) t.add({ shape: 'ellipse', ...C(x, Y, 6, 6), fill: INK, stroke: INK, strokeWidth: 1 });
  label(t, '$F$', XL - f - 10, Y + 14, {}, 20);
  label(t, "$F'$", XL + f - 12, Y + 16, {}, 20);
  label(t, 'Object', XO, Y - ho - 14, { textColor: '#2F6FB2' });
  leftLabel(t, 'Real image', XI + 10, Y + hi / 2 + 6, { textColor: '#7E57C2' });
  leftLabel(t, 'Thin lens', XL + 12, Y - 112);
  rightLabel(t, 'Optical axis', 680, Y + 14, { textColor: '#6B7280' });
  dim(t, [XL - f, 62], [XL, 62], '$f$');
  dim(t, [XL, 62], [XL + f, 62], '$f$');
  dim(t, [XO, 350], [XL, 350], '$s_o$');
  dim(t, [XL, 350], [XI, 350], '$s_i$');
  t.text('$\\frac{1}{s_o} + \\frac{1}{s_i} = \\frac{1}{f}$', 470, 64, 150, 40, { fontSize: 15 });
  t.text('$M = -\\frac{s_i}{s_o}$', 470, 106, 150, 36, { fontSize: 14 });
  const legend: [string, string][] = [['#D9534F', 'Parallel ray → through $F\'$'], ['#2E8B57', 'Chief ray (lens center)'], ['#D9822B', 'Focal ray → parallel']];
  legend.forEach(([c, s], i) => {
    seg(t, [20, 392 + i * 20], [50, 392 + i * 20], { color: c, width: 1.4 });
    leftLabel(t, s, 58, 392 + i * 20, { fontSize: 11 }, 220);
  });
  return t.done();
}

/** Sistema 4f: trasformata di Fourier ottica e filtraggio nel piano di Fourier. */
function fourF() {
  const t = new Builder();
  const Y = 230, f = 160, X0 = 80;
  const X = [X0, X0 + f, X0 + 2 * f, X0 + 3 * f, X0 + 4 * f];
  const B = 90;
  beam(t, [0, Y], [X[1], Y], B);
  beam(t, [X[1], Y], [X[2], Y], B, 2);
  beam(t, [X[2], Y], [X[3], Y], 2, B);
  beam(t, [X[3], Y], [X[4] + 40, Y], B);
  t.add({ shape: 'opt-pixels', spec: 'binary front gray v3', count: 14, ...C(X[0], Y, 8, 116), stroke: '#555555', fill: 'none', strokeWidth: 0.9 });
  lens(t, X[1], Y, 128);
  t.add({ shape: 'opt-aperture', spec: 'pinhole', count: 16, ...C(X[2], Y, 7, 116), ...DARK, ...LW });
  lens(t, X[3], Y, 128);
  t.add({ shape: 'opt-detector', spec: 'linear', count: 18, ...C(X[4], Y, 9, 116), ...WHITE, ...LW });
  const names = ['Input plane', '$L_1$', 'Fourier plane', '$L_2$', 'Output plane'];
  names.forEach((s, i) => label(t, s, X[i], Y + 78));
  label(t, 'Plane wave', 30, Y - 60, { textColor: '#B85450' }, 80);
  const insets: [string, string][] = [['phantom', 'Input $U_0(x, y)$'], ['spectrum', 'Spectrum $\\tilde{U}_0(f_x, f_y)$'], ['phantom blur', 'Low-pass output']];
  [0, 2, 4].forEach((k, i) => {
    img(t, insets[i][0], insets[i][1], X[k], 62, 84);
    seg(t, [X[k], 106], [X[k], Y - 62], { color: SOFT, width: 0.9, dashed: true });
  });
  for (let i = 0; i < 4; i++) dim(t, [X[i], Y + 104], [X[i + 1], Y + 104], '$f$');
  t.text('$U_f(u, v) \\propto\\, \\tilde{U}_0\\left(\\frac{u}{\\lambda f}, \\frac{v}{\\lambda f}\\right)$', X[1] - 20, Y + 124, 360, 40, { fontSize: 14 });
  return t.done();
}

// ======================================================================
// Interferometria
// ======================================================================

/** Interferometro di Michelson: un braccio fisso, uno mobile, frange circolari al rivelatore. */
function michelson() {
  const t = new Builder();
  const Y = 200, XB = 300, B = 14;
  beam(t, [110, Y], [XB, Y], B);
  beam(t, [XB, Y], [490, Y], B);
  beam(t, [XB, Y], [XB, 46], B);
  beam(t, [XB, Y], [XB, 330], B);
  laser(t, 'Laser', 58, Y, 110, 40);
  bs(t, XB, Y, 'cube d45', 40);
  rightLabel(t, 'BS', XB - 24, Y + 28, { fontSize: 12 }, 30);
  flat(t, XB, 40, 'bottom', 70, { label: '$M_1$ (fixed)', ...ICON, labelPos: 'above' });
  flat(t, 496, Y, 'left', 70, { label: '$M_2$ (movable)', ...ICON });
  t.add({ shape: 'opt-detector', spec: 'camera', direction: 'top', label: 'Camera', ...ICON, labelPos: 'below', ...C(XB, 356, 54, 56), ...METAL, ...LW });
  arrowSeg(t, [470, 262], [522, 262], { arrowStart: true, color: INK, width: 1, label: '$\\Delta L$', labelPos: 'below', fontSize: 12 });
  rightLabel(t, '$L_1$', XB - 14, 120, { fontSize: 13 }, 30);
  label(t, '$L_2$', 400, Y + 22, { fontSize: 13 }, 30);
  img(t, 'rings', 'Interference fringes', 470, 356, 84, { count: 4 });
  seg(t, [XB + 30, 356], [428, 356], { color: SOFT, width: 0.9, dashed: true });
  t.text('$I = I_1 + I_2 + 2\\sqrt{I_1 I_2}\\,\\cos(2k\\,\\Delta L)$', 360, 70, 260, 30, { fontSize: 14 });
  return t.done();
}

/** Interferometro di Mach-Zehnder: due beam splitter, due specchi, campione in un braccio. */
function machZehnder() {
  const t = new Builder();
  const XL = 220, XR = 520, YT = 90, YB = 260, B = 14;
  beam(t, [110, YB], [XL, YB], B);
  beam(t, [XL, YB], [XR, YB], B, B, BR, '', '', '/');
  beam(t, [XL, YB], [XL, YT], B, B, BR, '', '', '/');
  beam(t, [XL, YT], [XR, YT], B, B, BR, '', '/');
  beam(t, [XR, YB], [XR, YT], B, B, BR, '', '/');
  beam(t, [XR, YT], [620, YT], B);
  beam(t, [XR, YT], [XR, 4], B);
  laser(t, 'Laser', 58, YB, 110, 40);
  bs(t, XL, YB, 'cube d45', 38, { label: '$BS_1$', ...ICON });
  bs(t, XR, YT, 'cube d45', 38, { label: '$BS_2$', ...ICON, labelPos: 'below' });
  mirror(t, XL, YT, 'flat d45', 'right', 40, { label: '$M_1$', ...ICON, labelPos: 'above' });
  mirror(t, XR, YB, 'flat d45', 'left', 40, { label: '$M_2$', ...ICON });
  t.add({ shape: 'opt-plate', spec: 'window', ...C(370, YT, 12, 54), fill: '#FFF2CC', stroke: '#D6B656', ...LW, label: 'Sample $\\Delta\\varphi$', ...ICON, labelPos: 'above' });
  t.add({ shape: 'opt-detector', spec: 'pd', direction: 'left', ...C(642, YT, 40, 34), ...PURPLE, ...LW, label: '$D_1$', ...ICON });
  t.add({ shape: 'opt-detector', spec: 'pd', direction: 'bottom', ...C(XR, -16, 34, 40), ...PURPLE, ...LW });
  leftLabel(t, '$D_2$', XR + 24, -16, { fontSize: 12 }, 30);
  label(t, 'Sample arm', 300, YT - 22, { textColor: '#6B7280' });
  label(t, 'Reference arm', 370, YB + 22, { textColor: '#6B7280' });
  t.add({ shape: 'opt-plot', spec: 'cos2 labels', label: 'Output vs. phase', ...C(720, YB - 20, 130, 64), ...ICON, fill: 'none', stroke: '#2F6FB2', strokeWidth: 1.2, fontSize: 11 });
  t.text('$I_{1,2} = \\frac{I_0}{2}\\left(1 \\pm \\cos\\,\\Delta\\varphi\\right)$', 640, YB + 36, 170, 40, { fontSize: 14 });
  return t.done();
}

// ======================================================================
// Microscopia
// ======================================================================

/** Microscopio confocale a scansione laser: eccitazione (verde) ed emissione (rossa) con pinhole. */
function confocal() {
  const t = new Builder();
  const XD = 300, YL = 80, YG = 200, XF = 680, BX = 16;
  const D = '\\' as Cut;
  beam(t, [110, YL], [XD, YL], BX, BX, BG, '', '', D);
  duo(t, [XD, YL], [XD, YG], BX, BX, D, D);
  duo(t, [XD, YG], [420, YG], BX, BX, D);
  duo(t, [420, YG], [470, YG], BX, 0);
  duo(t, [470, YG], [560, YG], 0, 36);
  duo(t, [560, YG], [XF, YG], 36, 36, '', D);
  duo(t, [XF, YG], [XF, 250], 36, 36, D);
  duo(t, [XF, 330], [XF, 383], 30, 0);
  beam(t, [XD, YL], [XD, -10], BX * 0.6, BX * 0.6, BR, '', D);
  beam(t, [XD, -10], [XD, -60], BX * 0.6, 0);
  beam(t, [XD, -60], [XD, -92], 0, 12);
  laser(t, 'Laser', 58, YL, 110, 40);
  t.add({ shape: 'opt-bs', spec: 'dichroic d135', direction: 'left', ...C(XD, YL, 44, 44), ...GREEN, ...LW });
  leftLabel(t, 'Dichroic mirror', XD + 26, YL + 2);
  mirror(t, XD, YG, 'flat d135 galvo', 'right', 44);
  rightLabel(t, 'Galvo scanner', XD - 30, YG + 2);
  lens(t, 420, YG, 76, true, { label: 'Scan lens', ...ICON });
  lens(t, 560, YG, 96, true, { label: 'Tube lens', ...ICON });
  mirror(t, XF, YG, 'flat d135', 'left', 50);
  objective(t, XF, 290, 'bottom', 80, 46);
  leftLabel(t, 'Objective', XF + 30, 290);
  t.add({ shape: 'opt-sample', spec: 'slide', ...C(XF, 386, 130, 40), ...GLASS, ...LW });
  leftLabel(t, 'Sample (focal plane)', XF + 70, 382);
  t.add({ shape: 'opt-plate', spec: 'filter', direction: 'bottom', ...C(XD, 30, 56, 8), fill: '#F8CECC', stroke: '#B85450', ...LW });
  leftLabel(t, 'Emission filter', XD + 34, 30);
  lens(t, XD, -10, 70, false);
  leftLabel(t, 'Lens', XD + 42, -10);
  t.add({ shape: 'opt-aperture', spec: 'pinhole', direction: 'bottom', count: 10, ...C(XD, -60, 72, 7), ...DARK, ...LW });
  leftLabel(t, 'Confocal pinhole', XD + 42, -60);
  const pmt = t.add({ shape: 'opt-detector', spec: 'pmt', direction: 'bottom', ...C(XD, -126, 30, 72), ...METAL, ...LW });
  rightLabel(t, 'PMT', XD - 22, -126, { fontSize: 12 });
  const im = img(t, 'cells green v2', 'Optical section', 480, -126, 84);
  t.link(pmt, im, 'right', 'left', { label: 'pixel by pixel', labelPos: 'above', fontSize: 10, color: INK, width: 1.1 });
  t.add({ shape: 'opt-beam', spec: 'collimated', ...C(40, 340, 40, 12), ...BG, ...LW });
  leftLabel(t, 'Excitation', 66, 340);
  t.add({ shape: 'opt-beam', spec: 'collimated', ...C(40, 364, 40, 12), ...BR, ...LW });
  leftLabel(t, 'Fluorescence emission', 66, 364);
  return t.done();
}

/** Microscopio a foglio di luce (SPIM, Huisken et al. 2004): illuminazione e rivelazione ortogonali. */
function lightSheet() {
  const t = new Builder();
  const Y = 320, XS = 570;
  beam(t, [105, Y], [190, Y], 10, 10, BG);
  beam(t, [190, Y], [230, Y], 10, 0, BG);
  beam(t, [230, Y], [290, Y], 0, 36, BG);
  beam(t, [290, Y], [360, Y], 36, 36, BG);
  beam(t, [360, Y], [420, Y], 36, 16, BG);
  t.add({ shape: 'opt-sample', spec: 'chamber', ...C(XS, Y - 7, 150, 120), ...GLASS, ...LW, label: 'Sample chamber', ...ICON });
  t.add({ shape: 'opt-beam', spec: 'waist gauss', count: 14, direction: 'right', ...C(XS, Y, 170, 28), ...BG, ...LW });
  beam(t, [XS, Y], [XS, 262], 0, 26);
  beam(t, [XS, 182], [XS, 110], 30);
  beam(t, [XS, 110], [XS, 44], 30, 0);
  laser(t, 'Laser', 55, Y, 100, 40);
  lens(t, 190, Y, 56);
  lens(t, 290, Y, 76);
  t.add({ shape: 'opt-lens', spec: 'plano', count: 6, ...C(360, Y, 14, 76), ...GLASS, ...LW });
  objective(t, 450, Y, 'right', 64, 36);
  objective(t, XS, 222, 'bottom', 80, 44);
  t.add({ shape: 'opt-plate', spec: 'filter', direction: 'bottom', ...C(XS, 146, 58, 8), fill: '#F8CECC', stroke: '#B85450', ...LW });
  lens(t, XS, 110, 70, false);
  t.add({ shape: 'opt-detector', spec: 'camera', direction: 'bottom', ...C(XS, 14, 58, 56), ...METAL, ...LW });
  label(t, 'Beam expander', 240, Y + 50);
  label(t, 'Cylindrical lens', 360, Y - 52);
  label(t, 'Illumination\nobjective', 450, Y + 48, {}, 100, 30);
  leftLabel(t, 'Detection objective', XS + 30, 222);
  leftLabel(t, 'Emission filter', XS + 36, 146);
  leftLabel(t, 'Tube lens', XS + 42, 110);
  rightLabel(t, 'sCMOS camera', XS - 36, 14);
  seg(t, [690, Y + 66], [XS + 70, Y + 8], { color: SOFT, width: 0.9, arrowEnd: true });
  leftLabel(t, 'Light sheet', 676, Y + 76, { textColor: '#2E7D32' });
  label(t, 'Illumination', 230, Y - 76, { bold: true, textColor: '#555555' });
  rightLabel(t, 'Detection', XS - 40, 64, { bold: true, textColor: '#555555' }, 90);
  img(t, 'cells green v4', 'Optical section', 740, 30, 84);
  seg(t, [XS + 32, 14], [696, 14], { color: SOFT, width: 0.9, dashed: true });
  return t.done();
}

// ======================================================================
// Olografia, OCT
// ======================================================================

/** Olografia di Gabor/Leith-Upatnieks: registrazione (a) e ricostruzione dell'immagine virtuale (b). */
function holography() {
  const t = new Builder();
  zone(t, '(a) Recording', -10, 20, 670, 290, { bold: true });
  zone(t, '(b) Reconstruction', 690, 20, 560, 290, { bold: true });
  const YB = 250, YT = 80, XP = 480;
  // registrazione
  beam(t, [105, YB], [190, YB], 12);
  beam(t, [190, YB], [190, YT], 12, 12, BR, '', '', '/');
  beam(t, [190, YT], [236, YT], 12, 12, BR, '', '/');
  beam(t, [190, YB], [246, YB], 12);
  cone(t, 246, YB - 30, 82, 60, 0.5);
  cone(t, 244, YT, XP - 244, YB - YT, 0);
  cone(t, 390, YT, XP - 390, YB - YT, 1);
  laser(t, 'Laser', 55, YB, 100, 40);
  bs(t, 190, YB, 'cube d45', 34, { label: 'BS', ...ICON });
  mirror(t, 190, YT, 'flat d45', 'right', 36, { label: 'M', ...ICON, labelPos: 'above' });
  t.add({ shape: 'opt-lens', spec: 'concave', count: 8, ...C(240, YT, 16, 34), ...GLASS, ...LW });
  t.add({ shape: 'opt-lens', spec: 'concave', count: 8, ...C(250, YB, 16, 34), ...GLASS, ...LW });
  t.add({ shape: 'opt-object', spec: 'cube', ...C(362, YB, 54, 54), ...BLUE, ...LW, label: 'Object', ...ICON });
  t.add({ shape: 'opt-plate', spec: 'window', ...C(XP + 4, (YT + YB) / 2, 9, YB - YT + 6), fill: '#E5E7EB', stroke: '#5B6270', ...LW });
  label(t, 'Reference beam', 330, YT + 6, { textColor: '#B85450' });
  label(t, 'Object wave', 432, YB - 8, { textColor: '#B85450' }, 80);
  label(t, 'Holographic\nplate', XP + 4, YB + 24, {}, 90, 30);
  img(t, 'hologram v2', 'Recorded hologram', 590, 165, 90);
  seg(t, [XP + 10, 165], [544, 165], { color: SOFT, width: 0.9, dashed: true });
  // ricostruzione
  const X0 = 700, XH = X0 + 280;
  beam(t, [X0 + 10, YT], [X0 + 46, YT], 12);
  cone(t, X0 + 54, YT, XH - X0 - 54, YB - YT, 0);
  cone(t, XH + 4, YT, 180, YB - YT, (190 - YT) / (YB - YT), 'right', 'focus');
  t.add({ shape: 'opt-lens', spec: 'concave', count: 8, ...C(X0 + 50, YT, 16, 34), ...GLASS, ...LW });
  t.add({ shape: 'opt-plate', spec: 'window', ...C(XH, (YT + YB) / 2, 9, YB - YT + 6), fill: '#E5E7EB', stroke: '#5B6270', ...LW });
  t.add({ shape: 'opt-object', spec: 'cube', ...C(X0 + 170, YB, 54, 54), fill: '#F1F6FD', stroke: '#9DB5D8', dashed: true, ...LW, label: 'Virtual image', ...ICON, textColor: '#6B7280' });
  t.add({ shape: 'opt-object', spec: 'eye', ...C(XH + 206, 190, 46, 28), ...BLUE, ...LW, label: 'Observer', ...ICON });
  seg(t, [X0 + 196, YB - 20], [XH + 182, 190], { color: SOFT, width: 0.9, dashed: true });
  seg(t, [X0 + 196, YB + 20], [XH + 182, 190], { color: SOFT, width: 0.9, dashed: true });
  label(t, 'Reconstruction beam', X0 + 160, YT - 14, { textColor: '#B85450' }, 140);
  label(t, 'Hologram', XH, YB + 20, {}, 80);
  return t.done();
}

/** OCT nel dominio spettrale: SLD, accoppiatore in fibra 50:50, bracci di riferimento e campione, spettrometro. */
function oct() {
  const t = new Builder();
  const fiber = { routing: 'curve' as const, color: FIB, width: 2, arrowEnd: false };
  const cpl = t.add({ shape: 'opt-coupler', spec: 'fused', ...C(290, 150, 130, 50), fill: '#FFF2CC', stroke: FIB, ...LW });
  const pL1 = t.anchor(224.5, 134.5), pL2 = t.anchor(224.5, 164.5), pR1 = t.anchor(354.5, 134.5), pR2 = t.anchor(354.5, 164.5);
  label(t, '50:50 fiber coupler', 290, 188, {}, 130);
  void cpl;
  // braccio di riferimento
  beam(t, [458, 60], [640, 60], 12);
  const colR = t.add({ shape: 'opt-fiber', spec: 'collimator', direction: 'right', ...C(430, 60, 56, 26), ...METAL, ...LW });
  lens(t, 560, 60, 40, true);
  flat(t, 646, 60, 'left', 56, { label: 'Reference mirror', ...ICON });
  label(t, 'Reference arm', 530, 30, { textColor: '#6B7280' });
  // braccio del campione
  beam(t, [458, 230], [580, 230], 12, 12, BR, '', '', '\\');
  beam(t, [580, 230], [580, 300], 12, 12, BR, '', '\\');
  beam(t, [580, 300], [580, 372], 12, 0);
  const colS = t.add({ shape: 'opt-fiber', spec: 'collimator', direction: 'right', ...C(430, 230, 56, 26), ...METAL, ...LW });
  mirror(t, 580, 230, 'flat d135 galvo', 'left', 40);
  leftLabel(t, 'Galvo', 608, 222);
  lens(t, 580, 300, 64, false);
  leftLabel(t, 'Scan lens', 618, 300);
  t.add({ shape: 'opt-sample', spec: 'tissue', ...C(580, 392, 150, 46), fill: '#F6D5D0', stroke: '#B5655A', ...LW });
  leftLabel(t, 'Tissue', 662, 392);
  label(t, 'Sample arm', 500, 254, { textColor: '#6B7280' }, 80);
  // sorgente
  const sld = t.add({ shape: 'opt-source', spec: 'broadband', label: 'SLD', ...C(70, 60, 90, 40), fontSize: 12, ...BODY, ...LW });
  t.link(sld, pL1, 'right', 'left', fiber);
  t.link(pR1, colR, 'right', 'left', fiber);
  t.link(pR2, colS, 'right', 'left', fiber);
  // spettrometro
  zone(t, '', 12, 200, 360, 134);
  leftLabel(t, 'Spectrometer', 20, 322, { textColor: '#555555' }, 100);
  beam(t, [104, 270], [160, 270], 12);
  const colD = t.add({ shape: 'opt-fiber', spec: 'collimator', direction: 'right', ...C(76, 270, 56, 26), ...METAL, ...LW });
  t.link(pL2, colD, 'left', 'left', { ...fiber, offset: 0 });
  t.add({ shape: 'opt-grating', spec: 'blazed spectral', count: 12, ...C(208, 270, 100, 86), ...METAL, ...LW });
  lens(t, 268, 270, 90);
  const rainbow = ['#E53935', '#FB8C00', '#F2C200', '#43A047', '#1E88E5', '#5E35B1'];
  rainbow.forEach((c, i) => seg(t, [276, 270 + (i - 2.5) * 13.6], [336, 270 + (i - 2.5) * 9], { color: c, width: 1.1 }));
  const cam = t.add({ shape: 'opt-detector', spec: 'linear', count: 16, ...C(342, 270, 9, 84), ...WHITE, ...LW });
  label(t, 'Grating', 196, 322, {}, 60);
  label(t, 'Line camera', 336, 216, {}, 80);
  // elaborazione
  const Yp = 480;
  const ig = t.add({ shape: 'opt-plot', spec: 'interferogram labels', label: 'Spectral interferogram', ...C(120, Yp, 130, 62), fill: 'none', stroke: '#2F6FB2', strokeWidth: 1.2, ...ICON, fontSize: 11 });
  const fft = box(t, 'FFT', 270, Yp, 64, 40, PURPLE, { fontSize: 12 });
  const as = t.add({ shape: 'opt-plot', spec: 'ascan labels', label: 'A-scan', ...C(410, Yp, 130, 62), fill: 'none', stroke: '#2F6FB2', strokeWidth: 1.2, ...ICON, fontSize: 11 });
  const bscan = t.add({ shape: 'oct', ...MED_IMG, label: 'B-scan', ...C(600, Yp, 130, 84) });
  t.link(cam, ig, 'bottom', 'top', { color: INK, width: 1.1 });
  t.chain([ig, fft, as], 'right', { color: INK, width: 1.1 });
  t.link(as, bscan, 'right', 'left', { color: INK, width: 1.1, label: 'lateral scan', labelPos: 'above', fontSize: 10 });
  return t.done();
}

// ======================================================================
// Calcolo ottico e imaging computazionale (figure da paper)
// ======================================================================

/** Lin et al., "All-optical machine learning using diffractive deep neural networks",
 *  Science 361:1004 (2018), doi:10.1126/science.aat8084 — Fig. 1A-B. */
function d2nn() {
  const t = new Builder();
  // (A) strati come file di neuroni con onde secondarie
  title(t, 'A', -60, -52, 30);
  const XA = 40, WA = 210, rows: [string, number, string][] = [['Input plane', 60, 'random front blue grid v1'], ['$L_1$', 140, 'phase front jet grid v1'], ['$L_2$', 220, 'phase front jet grid v2'], ['$L_3$', 300, 'phase front jet grid v3'], ['$L_n$', 410, 'phase front jet grid v4'], ['Output plane', 490, 'random front blue grid v5']];
  for (const x of [XA + 50, XA + 105, XA + 160]) arrowSeg(t, [x, 8], [x, 52], { color: INK, width: 1 });
  label(t, 'Coherent light', XA + 105, -6);
  rows.forEach(([name, y, spec], i) => {
    t.add({ shape: 'opt-pixels', spec, count: 18, ...C(XA + WA / 2, y, WA, 12), stroke: '#555555', fill: 'none', strokeWidth: 0.8 });
    rightLabel(t, name, XA - 8, y, { fontSize: i === 0 || i === 5 ? 11 : 13 }, 90);
    const next = rows[i + 1];
    if (next && !(i === 3)) t.add({ shape: 'opt-huygens', count: 3, direction: 'bottom', ...C(XA + WA / 2, (y + next[1]) / 2, 120, next[1] - y - 20), fill: INK, stroke: INK, strokeWidth: 1 });
  });
  t.text('$\\vdots$', XA + 85, 340, 40, 40, { fontSize: 18 });
  t.add({ shape: 'brace', direction: 'right', ...C(XA + WA + 16, 275, 14, 290), fill: 'none', stroke: '#555555', strokeWidth: 1.2 });
  leftLabel(t, 'Diffractive\nlayers', XA + WA + 30, 275, {}, 80, 32);
  for (const [a, b] of [[220, 140], [300, 220], [410, 300]]) t.link(t.anchor(XA - 52, a), t.anchor(XA - 52, b), 'left', 'left', { routing: 'curve', color: '#C0392B', width: 1.1, dashed: b === 300 });
  rightLabel(t, 'Error\nbackpropagation\nlearning', XA - 84, 275, { textColor: '#C0392B' }, 100, 46);
  t.add({ shape: 'opt-pixels', spec: 'ramp front jet', count: 32, ...C(XA + WA + 50, 445, 10, 60), stroke: '#555555', fill: 'none', strokeWidth: 0.8 });
  leftLabel(t, '$2\\pi$', XA + WA + 60, 418, { fontSize: 10 }, 30);
  leftLabel(t, '$0$', XA + WA + 60, 472, { fontSize: 10 }, 30);
  label(t, 'Phase', XA + WA + 50, 488, { fontSize: 10 }, 40);
  label(t, 'Secondary waves', XA + WA / 2 + 120, 96, { textColor: '#6B7280' });
  t.link(t.anchor(XA + WA / 2 + 60, 96), t.anchor(XA + WA / 2 + 52, 76), 'left', 'right', { color: SOFT, width: 0.8, routing: 'straight' });
  // (B) classificatore 3D stampato, vista in prospettiva
  const XB = 430, YB = 150, DX = 50, DY = 10, PW = 56, PH = 170;
  title(t, 'B', XB - 70, -52, 30);
  t.add({ shape: 'opt-pattern', spec: 'detectors persp labels', count: 5, ...C(XB + 6 * DX + 40, YB - 6 * DY, PW + 6, PH), fill: 'none', stroke: '#555555', ...LW });
  for (let i = 5; i >= 1; i--) t.add({ shape: 'opt-pixels', spec: `phase persp jet v${i}`, count: 22, ...C(XB + i * DX, YB - i * DY, PW, PH), stroke: '#555555', fill: 'none', ...LW });
  t.add({ shape: 'opt-pattern', spec: 'digit persp', count: 5, ...C(XB, YB, PW, PH), fill: 'none', stroke: '#555555', ...LW });
  for (const dy of [-40, 0, 40]) arrowSeg(t, [XB - 90, YB + dy + 8], [XB - 34, YB + dy + 8], { color: RAY, width: 1.3 });
  rightLabel(t, 'Plane wave', XB - 40, YB - 52, { textColor: '#B85450' }, 80);
  label(t, 'Input plane', XB, YB + PH / 2 + 14);
  label(t, '$L_1$', XB + DX, YB - DY + PH / 2 + 12, {}, 30);
  label(t, '$L_5$', XB + 5 * DX, YB - 5 * DY + PH / 2 + 12, {}, 30);
  label(t, 'Diffractive layers (phase modulation)', XB + 3 * DX, YB - 5 * DY - PH / 2 - 14, {}, 240);
  label(t, 'Output plane\n(detectors 0–9)', XB + 6 * DX + 40, YB - 6 * DY + PH / 2 + 22, {}, 120, 30);
  dim(t, [XB + DX - PW / 2, YB + PH / 2 + 34], [XB + 2 * DX - PW / 2, YB + PH / 2 + 34], '$d$', { labelPos: 'below' });
  arrowSeg(t, [XB - 40, YB + PH / 2 + 66], [XB + 6 * DX + 90, YB + PH / 2 + 66], { color: INK, width: 1, label: 'Light propagation $z$', labelPos: 'below', fontSize: 11 });
  title(t, 'Classifier D$^2$NN (3D-printed, THz)', XB + 30, -52, 260);
  return t.done();
}

/** Shen et al., "Deep learning with coherent nanophotonic circuits", Nature Photonics 11:441 (2017),
 *  doi:10.1038/nphoton.2017.93 — Fig. 1b-c (OIU + ONU) e Fig. 2b (rete di MZI, DMMC, rivelatori). */
function onnMzi() {
  const t = new Builder();
  const LAYER: Color = { fill: '#EEF8EE', stroke: '#3A3F47' };
  // (b) catena di strati ottici
  const Yb = 60;
  t.text('Input optical\nsignal', 0, Yb - 18, 90, 36, { fontSize: 12, align: 'left' });
  label(t, '$X$', 110, Yb, { fontSize: 16 }, 30);
  const layers: [string, number][] = [['Layer 1', 210], ['Layer $i$', 410], ['Layer $n$', 610]];
  for (const [name, cx] of layers) {
    for (const d of [-18, -6, 6, 18]) {
      seg(t, [cx - 56, Yb + d], [cx - 40, Yb + d], { color: '#3A3F47', width: 1.2 });
      seg(t, [cx + 40, Yb + d], [cx + 56, Yb + d], { color: '#3A3F47', width: 1.2 });
    }
    box(t, name, cx, Yb, 80, 62, LAYER, { fontSize: 13 });
  }
  for (const x of [310, 510]) t.text('$\\cdots$', x - 20, Yb - 12, 40, 24, { fontSize: 20 });
  label(t, '$Y$', 690, Yb, { fontSize: 16 }, 30);
  t.text('Output\nresult', 712, Yb - 18, 70, 36, { fontSize: 12, align: 'left' });
  // (c) unità di interferenza e di non linearità
  const Yc = 210, xL = 150, xM = 600, xR = 790;
  seg(t, [370, Yb + 31], [xL, Yc - 52], { color: '#3A3F47', width: 1, dashed: true });
  seg(t, [450, Yb + 31], [xR, Yc - 52], { color: '#3A3F47', width: 1, dashed: true });
  t.add({ shape: 'rect', container: true, x: xL, y: Yc - 52, w: xM - xL, h: 112, radius: 6, fill: '#D3DDE8', stroke: '#3A3F47', strokeWidth: 1, dashed: true });
  t.add({ shape: 'rect', container: true, x: xM, y: Yc - 52, w: xR - xM, h: 112, radius: 6, fill: '#F6C9CC', stroke: '#3A3F47', strokeWidth: 1, dashed: true });
  // guide d'onda fra i blocchi; i blocchi diagonali stanno sullo sfondo, così la diagonale resta sopra
  const lanes = [-21, -7, 7, 21];
  const gaps: P2[] = [[96, 203], [277, 338], [412, 473], [547, 658], [732, 850]];
  for (const d of lanes) for (const [a, b] of gaps) seg(t, [a, Yc + d], [b, Yc + d], { color: '#1F2328', width: 1.4 });
  for (const d of lanes) arrowSeg(t, [60, Yc + d], [94, Yc + d], { color: RAY, width: 1.2 });
  label(t, '$x_{in}$', 40, Yc, { fontSize: 15 }, 30);
  label(t, '$x_{out}$', 872, Yc, { fontSize: 15 }, 40);
  box(t, '$\\hat{V}$', 240, Yc, 74, 74, LAYER, { fontSize: 16 });
  const diag = (cx: number, sym: string, c: Color) => {
    box(t, '', cx, Yc, 74, 74, c, { container: true });
    seg(t, [cx - 33, Yc - 33], [cx + 33, Yc + 33], { color: '#1F2328', width: 1.6 });
    t.text(sym, cx - 14, Yc - 16, 22, 22, { fontSize: 15 });
    t.text('$0$', cx + 10, Yc - 30, 20, 18, { fontSize: 13 });
    t.text('$0$', cx - 30, Yc + 12, 20, 18, { fontSize: 13 });
  };
  diag(375, '$\\lambda$', { fill: '#FFF6E6', stroke: '#3A3F47' });
  box(t, '$\\hat{U}$', 510, Yc, 74, 74, LAYER, { fontSize: 16 });
  diag(695, '$h$', { fill: '#C9F1F8', stroke: '#3A3F47' });
  label(t, 'Optical Interference Unit', (xL + xM) / 2, Yc + 49, { fontSize: 12 }, 220);
  label(t, 'Optical Nonlinearity Unit', (xM + xR) / 2, Yc + 49, { fontSize: 12 }, 180);
  // Fig. 2b: rete di MZI programmabile (core SU(4)) e moltiplicazione diagonale (DMMC)
  const Yd = 340, H = 128, gap = H / 4;
  title(t, 'Optical interference unit (OIU) on chip', 120, Yd - 34, 320);
  t.add({ shape: 'rect', ...C(455, Yd + H / 2, 690, H + 20), radius: 6, fill: '#E3E7EE', stroke: '#B8C0CC', strokeWidth: 1 });
  t.add({ shape: 'opt-mzi', count: 4, spec: 'reck labels', x: 120, y: Yd, w: 470, h: H, fill: 'none', stroke: '#3A3F47', ...LW });
  for (let k = 0; k < 4; k++) {
    const y = Yd + (k + 0.5) * gap;
    t.add({ shape: 'opt-mzi', count: 2, x: 590, y: y - gap / 4, w: 180, h: gap, fill: 'none', stroke: '#3A3F47', ...LW });
    t.text('$\\times$', 772, y + gap / 2 - 9, 18, 18, { fontSize: 14, textColor: '#C0392B' });
    arrowSeg(t, [70, y], [118, y], { color: RAY, width: 1.3 });
    seg(t, [770, y], [828, y], { color: '#3A3F47', width: 1, dashed: true });
    t.add({ shape: 'opt-detector', spec: 'pd', direction: 'left', ...C(850, y, 36, 26), ...PURPLE, ...LW });
  }
  t.add({ shape: 'rect', x: 590, y: Yd - 10, w: 190, h: H + 20, radius: 0, fill: 'none', stroke: '#6E9E8B', strokeWidth: 1, dashed: true });
  label(t, 'SU(4) core', 355, Yd + H + 24, { fontSize: 12, textColor: '#555555' });
  label(t, 'DMMC (diagonal $\\Sigma$)', 685, Yd + H + 24, { fontSize: 12, textColor: '#555555' }, 160);
  t.text('Input\nmodes', 10, Yd + H / 2 - 18, 56, 36, { fontSize: 12, textColor: '#C0392B', align: 'left' });
  label(t, 'Detectors', 850, Yd + H + 24, { fontSize: 12, textColor: '#6A4C93' }, 90);
  t.text('$M = U \\Sigma V^\\dagger$', 640, Yb - 50, 150, 26, { fontSize: 14 });
  return t.done();
}

/** Duarte et al., "Single-pixel imaging via compressive sampling", IEEE Signal Processing Magazine
 *  25(2):83 (2008), doi:10.1109/MSP.2007.914730 — Fig. 1: lente, DMD con pattern casuali, fotodiodo. */
function singlePixel() {
  const t = new Builder();
  const Y = 160, XD = 360;
  beam(t, [104, Y], [200, Y], 60, 84);
  beam(t, [200, Y], [XD - 14, Y], 84, 56);
  beam(t, [XD, Y + 44], [XD, 280], 50);
  beam(t, [XD, 280], [XD, 346], 50, 0);
  img(t, 'phantom', 'Scene $x$', 60, Y, 84);
  lens(t, 200, Y, 100, true, { label: 'Lens 1', ...ICON });
  const dmd = t.add({ shape: 'opt-pixels', spec: 'binary persp grid v2', count: 12, ...C(XD, Y, 54, 100), stroke: '#555555', fill: 'none', ...LW });
  leftLabel(t, 'DMD', XD + 34, Y - 30, { fontSize: 12 });
  lens(t, XD, 280, 70, false);
  leftLabel(t, 'Lens 2', XD + 42, 280);
  const pd = t.add({ shape: 'opt-detector', spec: 'pd', direction: 'top', ...C(XD, 364, 36, 34), ...PURPLE, ...LW });
  rightLabel(t, 'Photodiode\n(single pixel)', XD - 26, 364, {}, 100, 30);
  const rng = box(t, 'Random pattern\ngenerator', XD, 36, 130, 40, YELLOW, { fontSize: 11 });
  t.link(rng, dmd, 'bottom', 'top', { color: INK, width: 1.1, label: '$\\phi_m$', labelPos: 'above', fontSize: 12 });
  for (let i = 0; i < 3; i++) t.add({ shape: 'opt-pixels', spec: `binary front gray grid v${i + 3}`, count: 8, ...C(500 + i * 18, 36 + i * 12, 44, 44), stroke: '#555555', fill: 'none', strokeWidth: 0.8 });
  label(t, 'Patterns $\\phi_1, \\dots, \\phi_M$', 535, 100, {}, 140);
  const adc = box(t, 'A/D', 480, 364, 56, 36, TEAL, { fontSize: 12 });
  const meas = t.text('$y_1, y_2, \\dots, y_M$', 560, 352, 110, 24, { fontSize: 13 });
  const rec = box(t, 'Reconstruction', 760, 364, 190, 58, ORANGE, { fontSize: 12, bold: true, sublabel: '$\\hat{x} = \\arg\\min_x \\|\\Psi^\\top x\\|_1$  s.t.  $y = \\Phi x$', subSize: 12 });
  const out = img(t, 'phantom blur', 'Image $\\hat{x}$', 760, 236, 84);
  t.link(pd, adc, 'right', 'left', { color: INK, width: 1.1 });
  t.link(adc, meas, 'right', 'left', { color: INK, width: 1.1 });
  t.link(meas, rec, 'right', 'left', { color: INK, width: 1.1 });
  t.link(rec, out, 'top', 'bottom', { color: INK, width: 1.1 });
  t.text('$y_m = \\phi_m^\\top x$,  $m = 1, \\dots, M \\ll N$', 540, 296, 220, 30, { fontSize: 14 });
  return t.done();
}

/** Monakhova et al., "Learned reconstructions for practical mask-based lensless imaging",
 *  Optics Express 27(20):28075 (2019), arXiv:1908.11502 — Fig. 3 (Le-ADMM srotolato + denoiser). */
function lensless() {
  const t = new Builder();
  const fwd = { color: '#1F2328', width: 1.2 };
  const bwd = { color: '#C0392B', width: 1.2 };
  // DiffuserCam
  zone(t, 'DiffuserCam', -10, 10, 214, 170);
  beam(t, [40, 100], [128, 100], 20, 74);
  beam(t, [134, 100], [168, 100], 74);
  t.add({ shape: 'opt-object', spec: 'tree', ...C(28, 100, 34, 50), ...GREEN, ...LW });
  t.add({ shape: 'opt-plate', spec: 'diffuser', ...C(132, 100, 12, 80), ...GLASS, ...LW });
  t.add({ shape: 'opt-detector', spec: 'linear', count: 14, ...C(172, 100, 8, 80), ...WHITE, ...LW });
  label(t, 'Diffuser', 132, 150, { fontSize: 10 }, 60);
  label(t, 'Sensor', 176, 150, { fontSize: 10 }, 50);
  // ingressi
  const psf = img(t, 'caustic hot', 'PSF $\\mathbf{h}$', 270, 50, 74);
  const meas = img(t, 'blurry hot v3', 'Measurement $\\mathbf{b}$', 270, 160, 74);
  seg(t, [184, 100], [230, 150], { color: SOFT, width: 0.9, dashed: true, arrowEnd: true });
  // Le-ADMM
  const YL = 110;
  t.add({ shape: 'rect', container: true, x: 340, y: YL - 40, w: 330, h: 80, radius: 10, fill: '#FFE7A3', stroke: '#E0B84A', strokeWidth: 1 });
  label(t, 'Le-ADMM ($N$ layers)', 505, YL - 54, { italic: true, fontSize: 12 }, 180);
  const S = (s: string, cx: number) => box(t, s, cx, YL, 40, 44, { fill: '#EEF0F3', stroke: '#3A3F47' }, { fontSize: 13, radius: 8 });
  const s1 = S('$\\mathbf{S}^1$', 390), sk = S('$\\mathbf{S}^k$', 505), sn = S('$\\mathbf{S}^N$', 620);
  for (const x of [447, 562]) t.text('$\\cdots$', x - 16, YL - 20, 32, 20, { fontSize: 16 });
  t.link(s1, sk, 'right', 'left', fwd);
  t.link(sk, sn, 'right', 'left', fwd);
  seg(t, [598, YL + 12], [528, YL + 12], { ...bwd, arrowEnd: true });
  seg(t, [483, YL + 12], [413, YL + 12], { ...bwd, arrowEnd: true });
  t.link(meas, s1, 'right', 'left', fwd);
  t.link(psf, t.anchor(390, YL - 40), 'right', 'top', fwd);
  // denoiser opzionale
  t.add({ shape: 'rect', container: true, x: 700, y: 0, w: 130, h: 82, radius: 10, fill: '#CFE8C4', stroke: '#82B366', strokeWidth: 1 });
  label(t, 'Optional denoiser network', 765, -12, { italic: true }, 170);
  const den = t.add({ shape: 'unet', ...C(765, 41, 100, 62), count: 3, ...BLUE, strokeWidth: 1 });
  // uscita e loss
  const rec = img(t, 'phantom', 'Reconstruction $\\mathbf{v}^N$', 880, YL, 80, { labelPos: 'below' });
  const loss = box(t, 'loss\nfunction', 1010, YL, 90, 50, { fill: '#E5E7EB', stroke: '#9AA0A6' }, { italic: true, fontSize: 12 });
  const gt = img(t, 'phantom', 'Ground truth $\\mathbf{v}_{gt}$ (lensed)', 1010, 250, 80, { labelPos: 'below' });
  t.link(sn, rec, 'right', 'left', fwd);
  t.link(sn, den, 'top', 'left', { ...fwd, dashed: true });
  t.link(den, rec, 'right', 'top', { ...fwd, dashed: true });
  t.link(rec, loss, 'right', 'left', fwd);
  t.link(gt, loss, 'top', 'bottom', fwd);
  seg(t, [964, YL + 14], [922, YL + 14], { ...bwd, arrowEnd: true });
  seg(t, [838, YL + 14], [672, YL + 14], { ...bwd, arrowEnd: true });
  // strato k-esimo
  const YK = 290;
  seg(t, [485, YL + 22], [340, YK - 46], { color: '#555555', width: 0.9, dashed: true });
  seg(t, [525, YL + 22], [670, YK - 46], { color: '#555555', width: 0.9, dashed: true });
  t.add({ shape: 'rect', container: true, x: 340, y: YK - 46, w: 330, h: 92, radius: 12, fill: '#9AA0A6', stroke: '#6B7280', strokeWidth: 1 });
  label(t, '$k^{th}$ layer', 505, YK - 32, { fontSize: 12 }, 80);
  const U = (s: string, cx: number) => box(t, s, cx, YK + 8, 84, 46, { fill: '#FFF2CC', stroke: '#D6B656' }, { fontSize: 11 });
  const u1 = U('Least squares\nupdates', 395), u2 = U('Prox\nupdates', 505), u3 = U('Dual\nupdates', 615);
  t.chain([u1, u2, u3], 'right', fwd);
  seg(t, [573, YK + 22], [547, YK + 22], { ...bwd, arrowEnd: true });
  seg(t, [463, YK + 22], [437, YK + 22], { ...bwd, arrowEnd: true });
  rightLabel(t, '$\\{\\mathbf{u}^{k-1}, \\mathbf{v}^{k-1}, \\mathbf{w}^{k-1},$\n$\\mathbf{x}^{k-1}, \\alpha_i^{k-1}\\}$', 330, YK + 8, { fontSize: 12 }, 170, 40);
  leftLabel(t, '$\\{\\mathbf{u}^{k}, \\mathbf{v}^{k}, \\mathbf{w}^{k}, \\mathbf{x}^{k}, \\alpha_i^{k}\\}$', 680, YK + 8, { fontSize: 12 }, 200);
  // legenda
  seg(t, [900, 0], [930, 0], { ...fwd, arrowEnd: true });
  leftLabel(t, 'forwards', 936, 0, { italic: true });
  seg(t, [900, 20], [930, 20], { ...bwd, arrowEnd: true });
  leftLabel(t, 'backwards', 936, 20, { italic: true });
  return t.done();
}

/** Zheng, Horstmeyer & Yang, "Wide-field, high-resolution Fourier ptychographic microscopy",
 *  Nature Photonics 7:739 (2013), doi:10.1038/nphoton.2013.187 — Fig. 1 e Fig. 2a. */
function fpm() {
  const t = new Builder();
  const X = 110;
  // apparato: matrice di LED sotto il campione, obiettivo 2× sopra
  const nLed = 9, LWd = 220, lit = Math.floor(nLed * 0.75);
  const ledX = X - LWd / 2 + (LWd * (lit + 0.5)) / nLed;
  beam(t, [X, 116], [X, 52], 30, 3);
  beam(t, [X, 166], [X, 122], 30);
  beam(t, [X, 274], [X, 246], 0, 24);
  cone(t, X - 40, 280, ledX - X + 40, 132, 1, 'top');
  t.add({ shape: 'opt-detector', spec: 'camera', direction: 'bottom', ...C(X, 24, 60, 56), ...METAL, ...LW });
  lens(t, X, 118, 74, false);
  objective(t, X, 206, 'bottom', 80, 46);
  t.add({ shape: 'opt-sample', spec: 'slide', ...C(X, 280, 130, 30), ...GLASS, ...LW });
  t.add({ shape: 'opt-source', spec: 'ledarray', direction: 'top', count: nLed, ...C(X, 426, LWd, 30), ...YELLOW, ...LW });
  arrowSeg(t, [ledX, 410], [X + 4, 300], { color: '#C0392B', width: 1.6 });
  leftLabel(t, '$k_x^i$', ledX + 4, 352, { fontSize: 13, textColor: '#C0392B' }, 30);
  leftLabel(t, 'Camera', X + 36, 24);
  leftLabel(t, 'Tube lens', X + 42, 118);
  leftLabel(t, '2× objective\n(NA = 0.08)', X + 30, 206, {}, 100, 30);
  rightLabel(t, 'Sample', X - 70, 280);
  label(t, 'Programmable LED matrix ($i^{th}$ LED on)', X, 458, {}, 240);
  // procedura iterativa di ricostruzione
  const Y1 = 120, Y2 = 268, S = 86, R = '#C0392B';
  zone(t, 'Initialization', 254, 10, 132, 352);
  img(t, 'cells blur v2', 'Interpolated', 320, Y1, S, { count: 4 });
  const init = img(t, 'spectrum', 'Initial spectrum', 320, Y2, S);
  zone(t, 'Iterative recovering process', 404, 10, 404, 352);
  const cols: [number, string, string][] = [[466, 'Low-res image 1', '#E5484D'], [606, 'Image $N-1$', '#43A047'], [746, 'Image $N$', '#1E88E5']];
  const ks: N[] = [];
  cols.forEach(([cx, name, c], i) => {
    img(t, `cells coarse v${i + 3}`, name, cx, Y1, S, { count: 4, textColor: c });
    ks.push(img(t, `kspace v${i + 1}`, '', cx, Y2, S));
    arrowSeg(t, [cx - 9, Y2 - 45], [cx - 9, Y1 + 45], { color: c, width: 1.2 });
    arrowSeg(t, [cx + 9, Y1 + 45], [cx + 9, Y2 - 45], { color: c, width: 1.2 });
  });
  for (const [s, x] of [['2', 444], ['3', 488]] as const) t.add({ shape: 'ellipse', label: s, ...C(x, (Y1 + Y2) / 2, 18, 18), fontSize: 11, ...WHITE, strokeWidth: 1 });
  t.link(init, ks[0], 'right', 'left', { color: R, width: 1.6 });
  t.link(ks[0], ks[1], 'right', 'left', { color: R, width: 1.6, label: '4', labelPos: 'above', fontSize: 11 });
  t.link(ks[1], ks[2], 'right', 'left', { color: R, width: 1.6 });
  t.link(ks[2], ks[0], 'bottom', 'bottom', { color: R, width: 1.4, label: '5  Repeat once', labelPos: 'below', fontSize: 11 });
  zone(t, 'Recovered images', 826, 10, 132, 352);
  const ri = img(t, 'cells v7', 'Intensity', 892, Y1, S);
  img(t, 'phase v3', 'Phase', 892, Y2, S);
  t.link(ks[2], ri, 'right', 'left', { color: R, width: 1.6 });
  const notes = [
    '1  Initialize the high-resolution estimate $\\sqrt{I_h}\\, e^{i\\varphi_h}$ from one interpolated low-resolution image',
    '2  Generate the low-resolution field $\\sqrt{I_l}\\, e^{i\\varphi_l}$ of the sub-aperture of the $i^{th}$ LED',
    '3  Replace its amplitude with the measurement $\\sqrt{I_{lm}}$ and update that region of Fourier space',
    '4  Repeat steps 2–3 for all $N$ plane-wave incidences;  5  repeat the whole loop once more',
  ];
  notes.forEach((s, i) => leftLabel(t, s, 262, 392 + i * 20, { fontSize: 11 }, 700));
  return t.done();
}

/** Sitzmann et al., "End-to-end optimization of optics and image processing for achromatic extended
 *  depth of field and super-resolution imaging", ACM TOG 37(4) (SIGGRAPH 2018), doi:10.1145/3197517.3201333 — Fig. 2. */
function endToEnd() {
  const t = new Builder();
  const Y = 110;
  const heads: [string, number, number][] = [['Scene image dataset', 60, 150], ['Convolve with PSF', 270, 160], ['Sensor model', 470, 120], ['Computational\nimage reconstruction', 660, 170], ['Domain-specific\nloss', 860, 110]];
  for (const [s, cx, w] of heads) label(t, s, cx, 20, { fontSize: 12, bold: true }, w, 32);
  const fills = [BLUE, GREEN, ORANGE, YELLOW, PURPLE, TEAL, RED, GRAY, BLUE];
  for (let i = 0; i < 9; i++) t.add({ shape: 'image', ...C(20 + (i % 3) * 40, Y - 40 + Math.floor(i / 3) * 40, 36, 34), radius: 2, ...fills[i], strokeWidth: 1 });
  t.text('$*$', 128, Y - 16, 30, 30, { fontSize: 24 });
  seg(t, [168, 50], [168, 170], { color: '#1F2328', width: 1.2 });
  seg(t, [380, 50], [380, 170], { color: '#1F2328', width: 1.2 });
  t.add({ shape: 'opt-lens', spec: 'fresnel', count: 3, ...C(194, Y, 18, 92), ...GLASS, ...LW });
  label(t, '$h$', 194, Y - 58, { fontSize: 14 }, 20);
  const fb = (a: number, b: number, f: string, g: string, gw = 60) => {
    arrowSeg(t, [a, Y - 8], [b, Y - 8], { color: '#1F2328', width: 1.4, label: f, labelPos: 'above', fontSize: 14 });
    arrowSeg(t, [b, Y + 8], [a, Y + 8], { color: '#1F2328', width: 1.4 });
    t.text(g, (a + b) / 2 - gw / 2, Y + 14, gw, 40, { fontSize: 13 });
  };
  fb(214, 266, '$p_\\lambda$', '$\\frac{\\partial S(I)}{\\partial p_\\lambda}$');
  img(t, 'psf', '', 318, Y, 90);
  fb(392, 448, '$S(I)$', '$\\frac{\\partial y}{\\partial S(I)}$');
  const plus = t.op('+', 458, Y - 13, { w: 28, h: 28, fill: '#E5E7EB', stroke: '#9AA0A6' });
  const noise = label(t, 'Noise $\\eta$', 472, 56, { fontSize: 13 }, 80);
  t.link(noise, plus, 'bottom', 'top', { color: '#8B1E1E', width: 1.2 });
  fb(494, 546, '$y$', '$\\frac{\\partial}{\\partial y}$', 30);
  t.text('$\\min_x \\|y - \\mathcal{G}(x)\\|_2^2 + \\gamma \\|x\\|_2^2$', 550, Y - 22, 230, 44, { fontSize: 15 });
  fb(784, 840, '$x$', '$\\frac{\\partial \\mathcal{L}}{\\partial x}$');
  t.text('$\\mathcal{L}$', 846, Y - 26, 40, 44, { fontSize: 32 });
  label(t, 'Loss', 866, Y + 32, { fontSize: 13 }, 50);
  // simulazione differenziabile della PSF
  const YS = 330;
  seg(t, [168, 170], [20, 214], { color: '#1F2328', width: 1.2 });
  seg(t, [380, 170], [600, 214], { color: '#1F2328', width: 1.2 });
  label(t, 'Differentiable PSF simulation', 310, 226, { fontSize: 13, bold: true }, 280);
  t.add({ shape: 'opt-beam', spec: 'diverge fronts', count: 80, direction: 'right', ...C(120, YS, 160, 120), ...BR, ...LW });
  t.add({ shape: 'opt-beam', spec: 'focus fronts', count: 0, direction: 'right', ...C(310, YS, 200, 120), ...BR, ...LW });
  t.add({ shape: 'opt-lens', spec: 'fresnel', count: 3, ...C(206, YS, 18, 124), ...GLASS, ...LW });
  t.add({ shape: 'opt-detector', spec: 'linear', count: 24, ...C(416, YS, 10, 124), ...WHITE, ...LW });
  t.add({ shape: 'opt-plot', spec: 'psf labels', ...C(510, YS, 140, 80), fill: 'none', stroke: '#2F6FB2', strokeWidth: 1.2 });
  label(t, 'incident wave $\\phi_{\\lambda, d}$', 120, YS - 76, { fontSize: 12 }, 160);
  label(t, 'optical\nelement', 206, YS - 84, { fontSize: 12 }, 70, 32);
  label(t, 'Fresnel propagation', 314, YS - 76, { fontSize: 12 }, 140);
  label(t, 'sensor', 416, YS - 76, { fontSize: 12 }, 60);
  label(t, 'PSF $p_{\\lambda, d}$', 510, YS - 56, { fontSize: 12 }, 100);
  dim(t, [216, YS + 76], [410, YS + 76], '$z$', { labelPos: 'below' });
  return t.done();
}

/** LiDAR a tempo di volo: laser impulsato, scanner, ritorno su APD, istogramma e nuvola di punti. */
function lidar() {
  const t = new Builder();
  const YL = 280, XS = 260;
  beam(t, [125, YL], [XS - 22, YL], 10);
  const tx = { color: '#E06C5A', width: 2.2, arrowEnd: true };
  const rx = { color: '#E8A39B', width: 1, dashed: true, arrowEnd: true };
  const targets: P2[] = [[572, 176], [664, 282], [560, 372]];
  for (const p of targets) seg(t, [XS + 6, YL - 4], [p[0] - 30, p[1]], tx);
  for (const p of targets.slice(0, 2)) seg(t, [p[0] - 30, p[1] - 12], [XS + 10, 158], rx);
  beam(t, [XS, 150], [214, 150], 40, 0);
  zone(t, 'Scene', 500, 100, 250, 318);
  t.add({ shape: 'opt-object', spec: 'tree', ...C(600, 170, 58, 84), ...GREEN, ...LW });
  t.add({ shape: 'opt-object', spec: 'person', ...C(690, 282, 30, 74), ...YELLOW, ...LW });
  t.add({ shape: 'opt-object', spec: 'car', ...C(610, 374, 112, 54), ...BLUE, ...LW });
  const las = laser(t, 'Pulsed laser', 70, YL, 110, 40);
  mirror(t, XS, YL, 'polygon', 'right', 56);
  label(t, 'Polygon scanner', XS, YL + 44);
  lens(t, XS, 150, 56, true);
  label(t, 'Receiver lens', XS + 4, 110);
  const apd = t.add({ shape: 'opt-detector', spec: 'pd', direction: 'right', ...C(196, 150, 40, 34), ...PURPLE, ...LW });
  label(t, 'APD / SPAD', 196, 182, { fontSize: 11 }, 80);
  // elettronica di temporizzazione
  const YE = 470;
  const tdc = box(t, 'Time-to-digital\nconverter', 110, YE, 120, 46, YELLOW, { fontSize: 11 });
  t.link(las, tdc, 'bottom', 'top', { color: INK, width: 1.1, label: 'start', labelPos: 'above', fontSize: 10 });
  t.link(apd, tdc, 'left', 'left', { color: INK, width: 1.1, label: 'stop', labelPos: 'above', fontSize: 10, offset: -30 });
  const tof = t.add({ shape: 'opt-plot', spec: 'tof labels', label: 'Emitted and returned pulse', ...C(300, YE, 150, 64), fill: 'none', stroke: '#2F6FB2', strokeWidth: 1.2, ...ICON, fontSize: 11 });
  const cloud = t.add({ shape: 'scatter', label: 'Point cloud', ...C(500, YE, 90, 70), radius: 4, ...ICON, ...GRAY, fontSize: 11 });
  t.link(tdc, tof, 'right', 'left', { color: INK, width: 1.1 });
  t.link(tof, cloud, 'right', 'left', { color: INK, width: 1.1, label: '$d = \\frac{c\\,\\Delta t}{2}$', labelPos: 'above', fontSize: 13 });
  label(t, 'Outgoing pulses', 400, 300, { textColor: '#B85450' }, 100);
  label(t, 'Returns', 404, 154, { textColor: '#B85450' }, 60);
  return t.done();
}

// ======================================================================
// Campo vicino e campo lontano
// ======================================================================

/** Diffrazione da un'apertura di larghezza D = 2a: dall'ombra geometrica (N_F = a²/λz ≫ 1) alle frange
 *  di Fresnel e alla figura di Fraunhofer (N_F ≪ 1, z > 2D²/λ). Goodman, "Introduction to Fourier Optics", cap. 4. */
function nearFarField() {
  const t = new Builder();
  const Y = 330, XA = 100, D = 44, XE = 860, ZB = 610;
  const Z = [190, 330, 480, 770];
  const regimes = ['shadow', 'fresnel', 'transition', 'far'];
  // intestazioni delle due regioni
  t.box('Near field  —  Fresnel region', XA, 14, ZB - XA, 26, { fill: '#FCE1D0', stroke: '#E0A27A' }, { radius: 4, fontSize: 12 });
  t.box('Far field  —  Fraunhofer region', ZB, 14, XE - ZB, 26, { fill: '#DCEBF7', stroke: '#8DB0D6' }, { radius: 4, fontSize: 12 });
  // fasci: onda piana incidente, fascio limitato dall'apertura che poi diverge (angolo ~ λ/D)
  beam(t, [0, Y], [XA, Y], 150, 150, BR, 'fronts');
  beam(t, [XA, Y], [Z[1], Y], D);
  beam(t, [Z[1], Y], [XE, Y], D, 176);
  t.add({ shape: 'opt-axis', spec: 'arrow', ...C((XA + XE + 30) / 2, Y, XE + 30 - XA, 10), fill: 'none', stroke: SOFT, strokeWidth: 0.9 });
  rightLabel(t, '$z$', XE + 44, Y + 12, { fontSize: 13 }, 20);
  t.add({ shape: 'opt-aperture', spec: 'slit', count: Math.round((D / 190) * 100), ...C(XA, Y, 8, 190), ...DARK, ...LW });
  t.add({ shape: 'brace', direction: 'right', ...C(XA + 14, Y, 10, D), fill: 'none', stroke: '#555555', strokeWidth: 1.1 });
  leftLabel(t, '$D = 2a$', XA + 22, Y - 11, { fontSize: 13 }, 60);
  label(t, 'Plane wave', 50, Y - 90, { textColor: '#B85450' }, 90);
  label(t, 'Aperture', XA, Y + 108, {}, 80);
  // piani di osservazione e profili d'intensità
  const nf = ['$N_F \\gg 1$', '$N_F \\approx 3$', '$N_F \\approx 1$', '$N_F \\ll 1$'];
  const what = ['Geometric shadow', 'Fresnel fringes', 'Transition', 'Fraunhofer pattern'];
  Z.forEach((z, i) => {
    seg(t, [z, Y - 96], [z, Y + 92], { color: SOFT, width: 0.9, dashed: true });
    t.add({ shape: 'opt-diffraction', spec: `${regimes[i]} profile screen${i < 3 ? ' edges' : ''}`, direction: 'right', x: z - 16, y: 76, w: 80, h: 120, ...BR, strokeWidth: 1.1 });
    seg(t, [z, 198], [z, Y - 98], { color: SOFT, width: 0.9, dashed: true });
    label(t, nf[i], z, Y + 108, { fontSize: 13 }, 90);
    label(t, what[i], z, Y + 128, { textColor: '#555555' }, 130);
  });
  // confine fra campo vicino e lontano
  seg(t, [ZB, 42], [ZB, Y + 100], { color: '#C0392B', width: 1.1, dashed: true });
  label(t, '$z_F \\approx 2D^2/\\lambda$', ZB, Y + 116, { fontSize: 13, textColor: '#C0392B' }, 110);
  // integrali di Fresnel e di Fraunhofer
  leftLabel(t, 'Fresnel (near field):', 10, 506, { bold: true }, 170);
  t.text('$U(x, y) = \\frac{e^{ikz}}{i\\lambda z} \\int\\int U_0(\\xi, \\eta)\\, \\exp\\left(\\frac{ik}{2z}\\left[(x - \\xi)^2 + (y - \\eta)^2\\right]\\right) d\\xi\\, d\\eta$', 180, 486, 520, 40, { fontSize: 14, align: 'left' });
  leftLabel(t, 'Fraunhofer (far field):', 10, 556, { bold: true }, 170);
  t.text('$U(x, y) \\propto \\int\\int U_0(\\xi, \\eta)\\, \\exp\\left(-\\frac{i 2\\pi}{\\lambda z}(x\\xi + y\\eta)\\right) d\\xi\\, d\\eta$', 180, 536, 460, 40, { fontSize: 14, align: 'left' });
  t.text('Fresnel number  $N_F = \\frac{a^2}{\\lambda z}$,  $a = D/2$', 660, 516, 220, 40, { fontSize: 13, align: 'left' });
  return t.done();
}

/** Regioni di campo di un'antenna o apertura: campo vicino reattivo, campo vicino radiativo (Fresnel)
 *  e campo lontano (Fraunhofer). Balanis, "Antenna Theory", Fig. 2.7 e 2.8. */
function antennaRegions() {
  const t = new Builder();
  const X0 = 0, Y0 = 30, W = 640, H = 300;
  t.add({ shape: 'opt-fieldregions', spec: 'labels', x: X0, y: Y0, w: W, h: H, radius: 8, fill: 'none', stroke: '#8A9099', strokeWidth: 1 });
  const ax = X0 + Math.min(Math.max(W * 0.07, 12), 30), cy = Y0 + H / 2, R1 = W * 0.2, R2 = W * 0.5;
  label(t, 'Antenna', ax + 2, cy + 52, { fontSize: 11 }, 56);
  label(t, 'Reactive\nnear field', ax + 66, cy - 44, { fontSize: 12, bold: true, textColor: '#9C5221' }, 90, 32);
  label(t, 'Radiating near field\n(Fresnel region)', ax + (R1 + R2) / 2 + 6, cy - 92, { fontSize: 12, bold: true, textColor: '#8A6D14' }, 160, 32);
  label(t, 'Far field\n(Fraunhofer region)', ax + R2 + (W - R2 - ax) / 2, cy - 92, { fontSize: 12, bold: true, textColor: '#2F5E92' }, 160, 32);
  label(t, 'Pattern depends on\ndistance $R$', ax + (R1 + R2) / 2 + 6, cy + 76, { fontSize: 10, textColor: '#6B7280' }, 140, 28);
  label(t, 'Pattern independent of $R$,\nfields $\\propto e^{-ikR}/R$', ax + R2 + (W - R2 - ax) / 2, cy + 76, { fontSize: 10, textColor: '#6B7280' }, 170, 28);
  for (const [r, f] of [[R1, '$R_1 = 0.62\\sqrt{D^3/\\lambda}$'], [R2, '$R_2 = 2D^2/\\lambda$']] as const) {
    seg(t, [ax + r, Y0 + H], [ax + r, Y0 + H + 12], { color: INK, width: 0.9 });
    label(t, f, ax + r, Y0 + H + 28, { fontSize: 13 }, 160, 26);
  }
  // evoluzione della forma del diagramma (ampiezza) dal campo reattivo al campo lontano
  const YP = 500;
  title(t, 'Typical amplitude-pattern shape in each region', 10, YP - 108, 360);
  const pats: [string, number, string][] = [['shadow', 60, 'Reactive near field'], ['fresnel', 280, 'Radiating near field (Fresnel)'], ['far', 500, 'Far field (Fraunhofer)']];
  for (const [regime, x, name] of pats) {
    t.add({ shape: 'opt-diffraction', spec: `${regime} polar`, x, y: YP - 70, w: 76, h: 140, ...BR, strokeWidth: 1.1 });
    t.add({ shape: 'rect', ...C(x - 2, YP, 5, 30), radius: 1, fill: '#4B5563', stroke: '#2F3338', strokeWidth: 0.8 });
    label(t, name, x + 40, YP + 84, { fontSize: 11 }, 150);
  }
  return t.done();
}

/** Microscopia ottica a campo vicino con sonda ad apertura (SNOM in trasmissione): il campo evanescente
 *  all'apice illumina il campione entro ~λ/10, la luce viene raccolta in campo lontano. Novotny & Hecht,
 *  "Principles of Nano-Optics", cap. 6; confronto con il limite di Abbe Δx = λ/(2 NA). */
function snom() {
  const t = new Builder();
  const X = 330, YA = 214;
  // fascio raccolto: cono dal campione all'obiettivo, collimato fino alla lente di tubo, focalizzato sul rivelatore
  cone(t, X - 22, YA + 24, 44, 24, 0.5, 'bottom');
  beam(t, [X, 338], [X, 410], 40);
  beam(t, [X, 410], [X, 472], 40, 0);
  const las = laser(t, 'Laser', 80, 50, 100, 38);
  const probe = t.add({ shape: 'opt-probe', spec: 'aperture', direction: 'bottom', ...C(X, YA - 66, 34, 132), fill: '#B8BEC6', stroke: '#5B6270', ...LW });
  t.link(las, probe, 'right', 'top', { routing: 'curve', color: FIB, width: 2, arrowEnd: false });
  leftLabel(t, 'Tapered fiber probe\n(Al coating, aperture $d \\approx 50$–$100$ nm)', X + 24, 104, {}, 236, 32);
  t.add({ shape: 'opt-sample', spec: 'slide', ...C(X, YA + 20, 200, 40), ...GLASS, ...LW });
  leftLabel(t, 'Sample', X + 106, YA + 26);
  rightLabel(t, 'gap ≈ 10 nm', X - 14, YA + 4, { fontSize: 10, textColor: '#555555' }, 80);
  arrowSeg(t, [X - 150, YA + 54], [X - 80, YA + 54], { arrowStart: true, color: INK, width: 1, label: '$x$–$y$ raster scan', labelPos: 'below', fontSize: 11 });
  const fb = box(t, 'Shear-force\ndistance control', 150, YA - 66, 120, 42, YELLOW, { fontSize: 11 });
  t.link(fb, probe, 'right', 'left', { color: INK, width: 1, dashed: true, arrowStart: true, label: 'feedback', labelPos: 'above', fontSize: 10 });
  objective(t, X, 300, 'top', 76, 44);
  leftLabel(t, 'Collection objective\n(far field)', X + 32, 300, {}, 140, 32);
  lens(t, X, 410, 64, false);
  leftLabel(t, 'Tube lens', X + 40, 410);
  const det = t.add({ shape: 'opt-detector', spec: 'pd', direction: 'top', ...C(X, 490, 36, 34), ...PURPLE, ...LW });
  rightLabel(t, 'APD / PMT', X - 26, 490, {}, 90);
  const im = img(t, 'cells green v5', 'Near-field image', 600, 490, 84);
  t.link(det, im, 'right', 'left', { color: INK, width: 1.1, label: 'pixel by pixel', labelPos: 'above', fontSize: 10 });
  // ingrandimento dell'apice: campo evanescente
  t.add({ shape: 'opt-evanescent', spec: 'aperture labels', x: 610, y: 96, w: 190, h: 140, fill: 'none', stroke: RAY, ...LW });
  title(t, 'Near field at the aperture', 610, 66, 200);
  seg(t, [X + 6, YA - 8], [610, 140], { color: SOFT, width: 0.9, dashed: true });
  seg(t, [X + 6, YA + 2], [610, 236], { color: SOFT, width: 0.9, dashed: true });
  label(t, 'Evanescent field, decay length ~$\\lambda/10$', 705, 252, { fontSize: 11, textColor: '#B85450' }, 240);
  // risoluzione: campo lontano (Abbe) contro campo vicino
  const YR = 350, XR = 640;
  title(t, 'Resolution', XR - 76, YR - 58, 120);
  t.add({ shape: 'opt-diffraction', spec: 'far profile circ', direction: 'top', ...C(XR, YR, 150, 64), fill: '#DCEBF7', stroke: '#2F6FB2', strokeWidth: 1.1 });
  t.add({ shape: 'opt-diffraction', spec: 'far profile circ', direction: 'top', ...C(XR, YR, 30, 64), fill: '#F9D3CF', stroke: '#C0392B', strokeWidth: 1.1 });
  leftLabel(t, 'Far field (Abbe): $\\Delta x \\approx \\frac{\\lambda}{2\\,\\mathrm{NA}}$', XR + 82, YR - 14, { fontSize: 11, textColor: '#2F6FB2' }, 200, 30);
  leftLabel(t, 'Near field: $\\Delta x \\approx d \\ll \\lambda$', XR + 82, YR + 18, { fontSize: 11, textColor: '#C0392B' }, 200);
  return t.done();
}

export const OPTICS_TEMPLATES: TemplateDef[] = [
  { id: 'opt-thinlens', name: 'Lente sottile: diagramma dei raggi', section: SEC, build: thinLens },
  { id: 'opt-4f', name: 'Sistema 4f (filtraggio di Fourier)', section: SEC, build: fourF },
  { id: 'opt-michelson', name: 'Interferometro di Michelson', section: SEC, build: michelson },
  { id: 'opt-machzehnder', name: 'Interferometro di Mach-Zehnder', section: SEC, build: machZehnder },
  { id: 'opt-confocal', name: 'Microscopio confocale', section: SEC, build: confocal },
  { id: 'opt-lightsheet', name: 'Microscopio a foglio di luce', section: SEC, build: lightSheet },
  { id: 'opt-holography', name: 'Olografia: registrazione e ricostruzione', section: SEC, build: holography },
  { id: 'opt-oct', name: 'Tomografia a coerenza ottica (OCT)', section: SEC, build: oct },
  { id: 'opt-d2nn', name: 'Rete diffrattiva D2NN (Lin 2018)', section: SEC, build: d2nn },
  { id: 'opt-onn', name: 'Rete neurale ottica con MZI (Shen 2017)', section: SEC, build: onnMzi },
  { id: 'opt-singlepixel', name: 'Fotocamera a pixel singolo (Duarte 2008)', section: SEC, build: singlePixel },
  { id: 'opt-lensless', name: 'Imaging lensless con ADMM srotolato (Monakhova 2019)', section: SEC, build: lensless },
  { id: 'opt-fpm', name: 'Fourier ptychography (Zheng 2013)', section: SEC, build: fpm },
  { id: 'opt-e2e', name: 'Ottica + rete end-to-end (Sitzmann 2018)', section: SEC, build: endToEnd },
  { id: 'opt-lidar', name: 'LiDAR a tempo di volo', section: SEC, build: lidar },
  { id: 'opt-nearfar', name: 'Campo vicino e campo lontano (Fresnel / Fraunhofer)', section: SEC, build: nearFarField },
  { id: 'opt-antennaregions', name: 'Regioni di campo di un\'antenna', section: SEC, build: antennaRegions },
  { id: 'opt-snom', name: 'Microscopia a campo vicino (SNOM)', section: SEC, build: snom },
];
