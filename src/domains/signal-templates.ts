// Modelli del modulo "Signal processing": strutture di filtri (FIR, biquad, banco wavelet,
// LMS), catene di elaborazione (MFCC, ADC, comunicazione digitale, BCI) e stimatori (Kalman).
// I blocchi sono posizionati per centro, così le porte restano allineate e le linee dritte.
import { Builder, type Color } from '../builder';
import { COLORS, ICON, type NodeModel, type Side } from '../model';
import type { TemplateDef } from '../registry';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const SEC = 'Signal processing';
const INK = '#333333';
const SOFT = '#9AA0A6';
const SP_BLUE = '#2F6FB2';
const NOARROW = { arrowEnd: false };

/** Rettangolo dato il centro. */
const C = (cx: number, cy: number, w: number, h: number) => ({ x: cx - w / 2, y: cy - h / 2, w, h });

const dot = (t: Builder, cx: number, cy: number) => t.add({ shape: 'ellipse', ...C(cx, cy, 6, 6), fill: INK, stroke: INK, strokeWidth: 1 });
const junction = (t: Builder, cx: number, cy: number, spec = 'sum', r = 13) =>
  t.add({ shape: 'sp-junction', spec, ...C(cx, cy, 2 * r, 2 * r), strokeWidth: 1.2, ...WHITE });
const delay = (t: Builder, cx: number, cy: number, label = '$z^{-1}$') =>
  t.add({ label, ...C(cx, cy, 42, 30), radius: 2, fontSize: 13, strokeWidth: 1.2, ...WHITE });
const gain = (t: Builder, label: string, cx: number, cy: number, direction: Side, w = 36, h = 30, extra: Partial<NodeModel> = {}) =>
  t.add({ shape: 'triangle', direction, label, ...C(cx, cy, w, h), radius: 2, fontSize: 12, strokeWidth: 1.2, ...WHITE, ...extra });
const sig = (t: Builder, label: string, cx: number, cy: number, w = 44, h = 20, extra: Partial<NodeModel> = {}) =>
  t.text(label, cx - w / 2, cy - h / 2, w, h, { fontSize: 13, ...extra });
const sign = (t: Builder, s: '+' | '-', cx: number, cy: number) => t.text(s === '+' ? '$+$' : '$-$', cx - 6, cy - 7, 12, 14, { fontSize: 11 });
const block = (t: Builder, label: string, cx: number, cy: number, w: number, h: number, c: Color, extra: Partial<NodeModel> = {}) =>
  t.box(label, cx - w / 2, cy - h / 2, w, h, c, { radius: 4, ...extra });
const filt = (t: Builder, spec: string, label: string, cx: number, cy: number, w: number, h: number, c: Color = BLUE, extra: Partial<NodeModel> = {}) =>
  t.add({ shape: 'sp-filter', spec, label, ...C(cx, cy, w, h), radius: 4, fontSize: 13, strokeWidth: 1.2, ...c, ...extra });
const down2 = (t: Builder, cx: number, cy: number, label = '$\\downarrow 2$') =>
  t.add({ label, ...C(cx, cy, 42, 32), radius: 3, fontSize: 14, strokeWidth: 1.2, ...WHITE });
const trace = (t: Builder, shape: string, spec: string, label: string, cx: number, cy: number, w: number, h: number, stroke = SP_BLUE, extra: Partial<NodeModel> = {}) =>
  t.add({ shape, spec, label, ...C(cx, cy, w, h), fill: 'none', stroke, strokeWidth: 1.2, ...ICON, fontSize: 11, ...extra });

// ======================================================================
// Strutture di filtri
// ======================================================================

/** FIR in forma diretta (trasversale): linea di ritardo, prese b_k e catena di sommatori. */
function fir() {
  const t = new Builder();
  const YT = 40, YG = 105, YA = 170;
  const X = [90, 210, 330, 520];
  const xin = sig(t, '$x[n]$', 24, YT, 36);
  const dots = X.slice(0, 3).map((x) => dot(t, x, YT));
  const d1 = delay(t, 150, YT), d2 = delay(t, 270, YT), dN = delay(t, 460, YT);
  const g = X.map((x, i) => gain(t, `$b_{${i < 3 ? i : 'N'}}$`, x, YG, 'bottom', 36, 30));
  const A1 = junction(t, X[1], YA), A2 = junction(t, X[2], YA), AN = junction(t, X[3], YA);
  const yout = sig(t, '$y[n]$', 580, YA, 40);
  t.link(xin, dots[0], 'right', 'left', NOARROW);
  t.link(dots[0], d1);
  t.link(d1, dots[1], 'right', 'left', NOARROW);
  t.link(dots[1], d2);
  t.link(d2, dots[2], 'right', 'left', NOARROW);
  t.link(dots[2], dN, 'right', 'left', { dashed: true });
  t.link(dN, g[3], 'right', 'top');
  dots.forEach((d, i) => t.link(d, g[i], 'bottom', 'top'));
  t.link(g[0], A1, 'bottom', 'left');
  t.link(g[1], A1, 'bottom', 'top');
  t.link(g[2], A2, 'bottom', 'top');
  t.link(g[3], AN, 'bottom', 'top');
  t.link(A1, A2);
  t.link(A2, AN, 'right', 'left', { dashed: true });
  t.link(AN, yout);
  sig(t, '$x[n-1]$', X[1], YT - 19, 46, 16, { fontSize: 11 });
  sig(t, '$x[n-2]$', X[2], YT - 19, 46, 16, { fontSize: 11 });
  sig(t, '$x[n-N]$', X[3], YT - 19, 46, 16, { fontSize: 11 });
  sig(t, '$\\cdots$', 425, YG, 40, 20, { fontSize: 16 });
  t.text('$y[n] = \\sum_{k=0}^{N} b_k\\,x[n-k]$', 160, 200, 280, 44, { fontSize: 15 });
  return t.done();
}

/** Biquad IIR in forma diretta II (canonica): sommatori a sinistra (poli) e a destra (zeri). */
function biquad() {
  const t = new Builder();
  const XL = 100, XA = 170, XC = 240, XB = 310, XR = 380;
  const Y0 = 50, Y1 = 150, Y2 = 250;
  const xin = sig(t, '$x[n]$', 32, Y0, 40);
  const L0 = junction(t, XL, Y0), L1 = junction(t, XL, Y1);
  const R0 = junction(t, XR, Y0), R1 = junction(t, XR, Y1);
  const w0 = dot(t, XC, Y0), w1 = dot(t, XC, Y1), w2 = dot(t, XC, Y2);
  const z1 = delay(t, XC, (Y0 + Y1) / 2), z2 = delay(t, XC, (Y1 + Y2) / 2);
  const above = { labelPos: 'above' as const };
  const b0 = gain(t, '$b_0$', XB, Y0, 'right', 36, 28, above);
  const b1 = gain(t, '$b_1$', XB, Y1, 'right', 36, 28, above);
  const b2 = gain(t, '$b_2$', XB, Y2, 'right', 36, 28, above);
  const a1 = gain(t, '$-a_1$', XA, Y1, 'left', 36, 28, above);
  const a2 = gain(t, '$-a_2$', XA, Y2, 'left', 36, 28, above);
  const yout = sig(t, '$y[n]$', 444, Y0, 40);
  t.link(xin, L0);
  t.link(L0, w0, 'right', 'left', NOARROW);
  t.chain([w0, b0, R0, yout]);
  t.link(w0, z1, 'bottom', 'top');
  t.link(z1, w1, 'bottom', 'top', NOARROW);
  t.link(w1, z2, 'bottom', 'top');
  t.link(z2, w2, 'bottom', 'top', NOARROW);
  t.link(w1, a1, 'left', 'right');
  t.link(a1, L1, 'left', 'right');
  t.link(w1, b1);
  t.link(b1, R1);
  t.link(w2, a2, 'left', 'right');
  t.link(a2, L1, 'left', 'bottom');
  t.link(w2, b2);
  t.link(b2, R1, 'right', 'bottom');
  t.link(L1, L0, 'top', 'bottom');
  t.link(R1, R0, 'top', 'bottom');
  sig(t, '$w[n]$', XC + 22, Y0 - 13, 32, 16, { fontSize: 11 });
  sig(t, '$w[n-1]$', XC + 26, Y1 - 13, 42, 16, { fontSize: 11 });
  sig(t, '$w[n-2]$', XC + 26, Y2 - 13, 42, 16, { fontSize: 11 });
  t.text('$H(z) = \\frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{1 + a_1 z^{-1} + a_2 z^{-2}}$', 40, 282, 400, 46, { fontSize: 15 });
  return t.done();
}

/** Banco di analisi wavelet a due livelli (Mallat): h_0 passa-basso, h_1 passa-alto, decimazione ↓2. */
function waveletBank() {
  const t = new Builder();
  const Y1H = 70, Y1L = 210, Y2H = 170, Y2L = 250;
  const xin = sig(t, '$x[n]$', 20, Y1L - 70, 40);
  const s0 = dot(t, 70, Y1L - 70);
  const h1 = filt(t, 'hp', '$h_1[n]$', 140, Y1H, 76, 46, RED);
  const h0 = filt(t, 'lp', '$h_0[n]$', 140, Y1L, 76, 46, BLUE);
  const dh1 = down2(t, 235, Y1H), dl1 = down2(t, 235, Y1L);
  const d1 = sig(t, '$d_1[k]$', 330, Y1H, 48);
  const s1 = dot(t, 300, Y1L);
  const h1b = filt(t, 'hp', '$h_1[n]$', 370, Y2H, 76, 46, RED);
  const h0b = filt(t, 'lp', '$h_0[n]$', 370, Y2L, 76, 46, BLUE);
  const dh2 = down2(t, 465, Y2H), dl2 = down2(t, 465, Y2L);
  const d2 = sig(t, '$d_2[k]$', 560, Y2H, 48);
  const a2 = sig(t, '$a_2[k]$', 560, Y2L, 48);
  t.link(xin, s0, 'right', 'left', NOARROW);
  t.link(s0, h1, 'top', 'left');
  t.link(s0, h0, 'bottom', 'left');
  t.chain([h1, dh1, d1]);
  t.link(h0, dl1);
  t.link(dl1, s1, 'right', 'left', NOARROW);
  t.link(s1, h1b, 'top', 'left');
  t.link(s1, h0b, 'bottom', 'left');
  t.chain([h1b, dh2, d2]);
  t.chain([h0b, dl2, a2]);
  sig(t, '$a_1[k]$', 274, Y1L - 13, 36, 16, { fontSize: 11 });
  t.text('Level 1', 100, 8, 170, 18, { fontSize: 11, bold: true, textColor: '#555555' });
  t.text('Level 2', 330, 120, 170, 18, { fontSize: 11, bold: true, textColor: '#555555' });
  // ripartizione diadica delle frequenze: a_2 | d_2 | d_1
  const fx = 640, fw = 240, fy = 90;
  const band = (u0: number, u1: number, label: string, c: Color) =>
    t.box(label, fx + fw * u0, fy, fw * (u1 - u0), 40, c, { radius: 0, fontSize: 13, strokeWidth: 1 });
  band(0, 0.25, '$a_2$', BLUE);
  band(0.25, 0.5, '$d_2$', ORANGE);
  band(0.5, 1, '$d_1$', RED);
  t.link(t.anchor(fx - 6, fy + 52), t.anchor(fx + fw + 22, fy + 52), 'right', 'left', { routing: 'straight', color: SOFT, width: 1 });
  [['$0$', 0], ['$\\pi/4$', 0.25], ['$\\pi/2$', 0.5], ['$\\pi$', 1]].forEach(([s, u]) => sig(t, s as string, fx + fw * (u as number), fy + 66, 36, 16, { fontSize: 11 }));
  sig(t, '$\\omega$', fx + fw + 32, fy + 52, 16, 16, { fontSize: 12 });
  t.text('Dyadic frequency partition', fx, fy - 26, fw, 18, { fontSize: 11, textColor: '#555555' });
  return t.done();
}

/** Identificazione di sistema con filtro adattivo LMS (Widrow & Hoff). */
function lms() {
  const t = new Builder();
  const Y = 180, YU = 80, YL = 275;
  const xin = sig(t, '$x[n]$', 22, Y, 40);
  const s0 = dot(t, 80, Y);
  const plant = block(t, 'Unknown system', 220, YU, 130, 46, GRAY, { sublabel: '$h[n]$', subSize: 12, fontSize: 12 });
  const adf = filt(t, 'adaptive', '$\\mathbf{w}[n]$', 220, Y, 120, 50, ORANGE, { fontSize: 14 });
  const sum = junction(t, 440, Y, 'sum', 14);
  const s1 = dot(t, 505, Y);
  const eout = sig(t, '$e[n]$', 560, Y, 40);
  const upd = block(t, 'LMS update', 360, YL, 180, 48, YELLOW, { sublabel: '$\\mathbf{w}[n+1] = \\mathbf{w}[n] + \\mu\\,e[n]\\,\\mathbf{x}[n]$', subSize: 11, fontSize: 12, bold: true });
  t.link(xin, s0, 'right', 'left', NOARROW);
  t.link(s0, plant, 'top', 'left');
  t.link(s0, adf);
  t.link(plant, sum, 'right', 'top', { label: '$d[n]$', labelPos: 'above', fontSize: 12 });
  t.link(adf, sum, 'right', 'left', { label: '$y[n]$', labelPos: 'above', fontSize: 12 });
  t.link(sum, s1, 'right', 'left', NOARROW);
  t.link(s1, eout);
  t.link(s1, upd, 'bottom', 'right');
  t.link(upd, adf, 'left', 'bottom');
  sign(t, '+', 452, Y - 26);
  sign(t, '-', 418, Y + 14);
  return t.done();
}

// ======================================================================
// Catene di elaborazione
// ======================================================================

/** Estrazione di log-mel e MFCC: pre-enfasi, finestre, FFT, potenza, banco mel, log, DCT. */
function mfcc() {
  const t = new Builder();
  const Y1 = 50, Y2 = 200;
  const audio = trace(t, 'sp-signal', 'audio', 'Audio signal $x[n]$', 60, Y1, 120, 50);
  const pre = block(t, 'Pre-emphasis', 232, Y1, 150, 50, BLUE, { sublabel: '$y[n] = x[n] - \\alpha\\,x[n-1]$', subSize: 11, fontSize: 12 });
  const frm = trace(t, 'sp-stft', 'hamming', 'Framing + Hamming window', 400, Y1, 130, 56, SP_BLUE, { count: 5 });
  const fft = filt(t, 'fft', 'FFT', 550, Y1, 76, 50, PURPLE);
  const pow = block(t, '$|\\cdot|^2$', 660, Y1, 64, 50, PURPLE, { fontSize: 15, sublabel: 'power', subSize: 10 });
  const mel = trace(t, 'sp-melbank', 'mel labels', 'Mel filterbank', 232, Y2, 136, 56, SP_BLUE, { count: 10, sublabel: '$m = 2595 \\log_{10}(1 + \\frac{f}{700})$', subSize: 11 });
  const log = block(t, '$\\log(\\cdot)$', 375, Y2, 70, 46, ORANGE, { fontSize: 14 });
  const br = dot(t, 450, Y2);
  const dct = block(t, 'DCT', 520, Y2, 70, 46, ORANGE, { fontSize: 13 });
  const coeffs = t.img('sp-spectrogram', 'MFCCs', '', 600, Y2 - 32, 104, 64, { spec: 'mfcc', labelPos: 'below' });
  const lm = t.img('sp-spectrogram', 'Log-mel spectrogram', '', 400, Y2 + 60, 100, 70, { spec: 'mel', labelPos: 'below' });
  t.chain([audio, pre, frm, fft, pow]);
  t.link(pow, mel, 'bottom', 'top');
  t.link(mel, log);
  t.link(log, br, 'right', 'left', NOARROW);
  t.link(br, dct);
  t.link(dct, coeffs);
  t.link(br, lm, 'bottom', 'top');
  return t.done();
}

/** Classificazione audio: forma d'onda → log-mel → CNN → punteggi delle classi. */
function audioClassification() {
  const t = new Builder();
  const Y = 60;
  const mic = t.add({ shape: 'sp-transducer', spec: 'mic', ...C(18, Y, 30, 46), strokeWidth: 1.2, ...ICON, ...GREEN });
  const wave = trace(t, 'sp-signal', 'audio', 'Raw waveform', 125, Y, 120, 50);
  const feat = block(t, 'STFT + mel\n+ log', 270, Y, 92, 50, BLUE, { fontSize: 11 });
  const spec = t.img('sp-spectrogram', 'Log-mel spectrogram', '', 360, Y - 43, 120, 86, { spec: 'mel', count: 3 });
  const cnn = t.icon('cnn', 'CNN encoder', 520, Y - 45, 170, 90, ORANGE, { count: 3, fontSize: 11 });
  const head = block(t, 'Global pool\n+ FC + softmax', 790, Y, 104, 50, TEAL, { fontSize: 11 });
  t.chain([mic, wave, feat, spec, cnn, head]);
  // punteggi delle classi
  const px = 870, rows: [string, number][] = [['Speech', 0.82], ['Music', 0.09], ['Dog bark', 0.05], ['Siren', 0.03], ['Engine', 0.01]];
  const panel = t.group('Class scores', px, Y - 62, 190, 124, { dashed: false, stroke: '#B8BEC8', fill: '#FAFAFB', textColor: '#444444' });
  rows.forEach(([name, p], i) => {
    const yy = Y - 34 + i * 19;
    t.text(name, px + 8, yy, 62, 14, { fontSize: 10, align: 'right' });
    t.add({ x: px + 76, y: yy + 1, w: Math.max(2, 84 * p), h: 12, radius: 1.5, strokeWidth: 1, ...(i ? GRAY : ORANGE) });
    t.text(p.toFixed(2), px + 80 + 84 * p, yy, 30, 14, { fontSize: 9, align: 'left', textColor: '#555555' });
  });
  t.link(head, panel);
  return t.done();
}

/** Catena di conversione A/D con il segnale in ogni punto. */
function adcChain() {
  const t = new Builder();
  const Y = 50, YS = 160;
  const xin = sig(t, '$x(t)$', 20, Y, 40);
  const lpf = filt(t, 'lp', 'Anti-aliasing\nLPF', 240, Y, 104, 56, BLUE, { fontSize: 11 });
  const sh = t.add({ shape: 'sp-switch', spec: 'hold', label: 'Sample & hold', ...C(480, Y, 84, 56), fill: 'none', stroke: INK, strokeWidth: 1.2, ...ICON, fontSize: 11 });
  const q = t.add({ shape: 'sp-opbox', spec: 'quant', label: 'Quantizer', ...C(695, Y, 50, 50), radius: 3, strokeWidth: 1.2, ...ICON, fontSize: 11, ...YELLOW });
  const enc = block(t, 'Encoder', 895, Y, 84, 50, TEAL, { fontSize: 12 });
  const bits = sig(t, '$b[n]$', 1000, Y, 40);
  const clk = sig(t, '$f_s = \\frac{1}{T_s}$', 480, Y - 80, 80, 34, { fontSize: 13 });
  t.chain([xin, lpf, sh, q, enc, bits]);
  t.link(clk, sh, 'bottom', 'top');
  t.group('ADC', 420, Y - 45, 540, 112, { textColor: '#555555' });
  // il segnale lungo la catena
  const mids = [115, 365, 595, 795];
  const illus = [
    trace(t, 'sp-signal', 'noisy labels', '$x(t)$', mids[0], YS, 120, 50, '#3A3F47', { count: 2 }),
    trace(t, 'sp-signal', 'sine labels', '$x_a(t)$  band-limited', mids[1], YS, 120, 50, SP_BLUE, { count: 2 }),
    trace(t, 'sp-discrete', 'sine hold labels', '$x(nT_s)$', mids[2], YS, 120, 50, SP_BLUE, { count: 12 }),
    trace(t, 'sp-discrete', 'sine quant labels', '$x_q[n]$', mids[3], YS, 120, 54, '#C0392B', { count: 12 }),
  ];
  mids.forEach((m, i) => t.link(t.anchor(m, Y), illus[i], 'bottom', 'top', { dashed: true, arrowEnd: false, color: SOFT, width: 1 }));
  const code = t.text('011 100 110 111 …', 940, YS - 12, 120, 24, { fontSize: 11, textColor: '#2F5246' });
  t.link(t.anchor(1000, Y + 12), code, 'bottom', 'top', { dashed: true, arrowEnd: false, color: SOFT, width: 1 });
  return t.done();
}

/** Sistema di comunicazione digitale (schema di Shannon/Proakis): trasmettitore, canale, ricevitore. */
function commChain() {
  const t = new Builder();
  const YT = 40, YR = 250, W = 108, H = 48;
  const X = [54, 204, 354, 504];
  const tx: [string, Color][] = [['Information\nsource', GRAY], ['Source\nencoder', BLUE], ['Channel\nencoder', GREEN], ['Digital\nmodulator', ORANGE]];
  const rx: [string, Color][] = [['Output\n(sink)', GRAY], ['Source\ndecoder', BLUE], ['Channel\ndecoder', GREEN], ['Digital\ndemodulator', ORANGE]];
  t.group('Transmitter', 0, YT - 46, 562, 82, { textColor: '#555555' });
  t.group('Receiver', 0, YR - 46, 562, 92, { textColor: '#555555' });
  const T = tx.map(([s, c], i) => block(t, s, X[i], YT + 6, W, H, c, { fontSize: 11 }));
  const R = rx.map(([s, c], i) => block(t, s, X[i], YR + 6, W, H, c, { fontSize: 11 }));
  const ch = block(t, 'Channel', 660, 146, 96, 46, RED, { fontSize: 12, sublabel: '$h(t)$', subSize: 12 });
  const add = junction(t, 660, 205, 'sum', 13);
  const noise = sig(t, '$n(t)$', 740, 205, 40);
  const lab = { labelPos: 'above' as const, fontSize: 11 };
  t.link(T[0], T[1]);
  t.link(T[1], T[2], 'right', 'left', { label: 'bits', ...lab });
  t.link(T[2], T[3], 'right', 'left', { label: '$\\{c_k\\}$', ...lab });
  t.link(T[3], ch, 'right', 'top');
  sig(t, '$s(t)$', 682, 92, 30, 18, { fontSize: 12 });
  t.link(ch, add, 'bottom', 'top');
  t.link(noise, add, 'left', 'right');
  t.link(add, R[3], 'bottom', 'right');
  sig(t, '$r(t)$', 682, 240, 30, 18, { fontSize: 12 });
  t.link(R[3], R[2], 'left', 'right', { label: '$\\{\\hat{c}_k\\}$', ...lab });
  t.link(R[2], R[1], 'left', 'right', { label: '$\\{\\hat{b}_k\\}$', ...lab });
  t.link(R[1], R[0], 'left', 'right');
  // costellazioni trasmessa e ricevuta
  const ctx = t.add({ shape: 'sp-constellation', spec: 'qpsk', label: 'QPSK symbols', ...C(X[3], YT - 80, 64, 64), fill: 'none', stroke: SP_BLUE, strokeWidth: 1.2, ...ICON, labelPos: 'above', fontSize: 10 });
  const crx = t.add({ shape: 'sp-constellation', spec: 'qpsk noisy', label: 'Received symbols', ...C(X[3], YR + 96, 64, 64), fill: 'none', stroke: SP_BLUE, strokeWidth: 1.2, ...ICON, fontSize: 10 });
  const thin = { dashed: true, arrowEnd: false, color: SOFT, width: 1 };
  t.link(T[3], ctx, 'top', 'bottom', thin);
  t.link(R[3], crx, 'bottom', 'top', thin);
  sig(t, 'AWGN', 740, 222, 40, 14, { fontSize: 9, textColor: '#666666' });
  return t.done();
}

/** Interfaccia cervello-computer a immaginazione motoria: EEG → filtro → CSP → LDA → comando. */
function bci() {
  const t = new Builder();
  const Y = 60;
  const cap = t.add({ shape: 'sp-headcap', spec: 'motor', label: 'EEG cap', ...C(35, Y, 66, 74), strokeWidth: 1.2, ...ICON, labelPos: 'above', fontSize: 11, fill: '#FBEFE6', stroke: '#8C6A55' });
  const eeg = t.add({ shape: 'sp-eeg', spec: 'names', label: 'Raw EEG  $X \\in \\mathbb{R}^{C \\times T}$', ...C(170, Y, 130, 84), count: 6, fill: 'none', stroke: '#3A3F47', strokeWidth: 1, ...ICON, fontSize: 11 });
  const bpf = filt(t, 'bp', 'Band-pass\n8-30 Hz', 340, Y, 116, 50, BLUE, { fontSize: 11 });
  const csp = block(t, 'CSP', 490, Y, 104, 54, PURPLE, { bold: true, fontSize: 12, sublabel: '$Z = W^\\top X$', subSize: 12 });
  const feat = block(t, 'Log-variance', 640, Y, 124, 54, GREEN, { fontSize: 12, sublabel: '$f_i = \\log \\mathrm{var}(z_i)$', subSize: 11 });
  const lda = block(t, 'LDA', 790, Y, 104, 54, ORANGE, { bold: true, fontSize: 12, sublabel: '$\\mathrm{sign}(\\mathbf{w}^\\top \\mathbf{f} + b)$', subSize: 11 });
  const cmd = block(t, 'Command', 930, Y, 96, 54, TEAL, { fontSize: 12, sublabel: 'left / right hand', subSize: 10 });
  const dev = t.icon('robot', 'Device', 1050, Y - 23, 44, 46, TEAL, { fontSize: 11, labelPos: 'above' });
  t.chain([cap, eeg, bpf, csp, feat, lda, cmd, dev]);
  t.link(dev, cap, 'bottom', 'bottom', { dashed: true, color: '#7A808A', label: 'Visual feedback', labelPos: 'below', fontSize: 11, offset: 24 });
  return t.done();
}

/** Filtro di Kalman: ciclo predizione – aggiornamento. */
function kalman() {
  const t = new Builder();
  const Y = 110;
  const pred = block(t, 'Predict (time update)', 150, Y, 270, 84, BLUE, {
    bold: true,
    fontSize: 12,
    sublabel: '$\\hat{x}_{k|k-1} = F \\hat{x}_{k-1|k-1} + B u_k$\n$P_{k|k-1} = F P_{k-1|k-1} F^\\top + Q$',
    subSize: 12,
    radius: 8,
  });
  const upd = block(t, 'Update (measurement update)', 560, Y, 320, 104, GREEN, {
    bold: true,
    fontSize: 12,
    sublabel: '$K_k = P_{k|k-1} H^\\top (H P_{k|k-1} H^\\top + R)^{-1}$\n$\\hat{x}_{k|k} = \\hat{x}_{k|k-1} + K_k (z_k - H \\hat{x}_{k|k-1})$\n$P_{k|k} = (I - K_k H) P_{k|k-1}$',
    subSize: 12,
    radius: 8,
  });
  const z = delay(t, 355, 225);
  const init = t.text('Initial estimate\n$\\hat{x}_{0|0}, P_{0|0}$', -120, Y - 18, 100, 36, { fontSize: 11 });
  const u = sig(t, 'Control $u_k$', 150, 22, 80, 20, { fontSize: 12 });
  const meas = trace(t, 'sp-signal', 'noisy', 'Measurements $z_k$', 560, 12, 110, 40, '#3A3F47', { count: 1, labelPos: 'above' });
  const est = trace(t, 'sp-signal', 'sine', 'Estimate $\\hat{x}_{k|k}$', 820, Y, 100, 44, SP_BLUE, { count: 1 });
  t.link(init, pred);
  t.link(u, pred, 'bottom', 'top');
  t.link(meas, upd, 'bottom', 'top');
  t.link(pred, upd, 'right', 'left', { label: '$\\hat{x}_{k|k-1}, P_{k|k-1}$', labelPos: 'above', fontSize: 11 });
  t.link(upd, est);
  t.link(upd, z, 'bottom', 'right', { label: '$\\hat{x}_{k|k}, P_{k|k}$', labelPos: 'below', fontSize: 11 });
  t.link(z, pred, 'left', 'bottom');
  sig(t, '$k \\leftarrow k+1$', 355, 254, 70, 16, { fontSize: 11, textColor: '#555555' });
  return t.done();
}

export const SIGNAL_TEMPLATES: TemplateDef[] = [
  { id: 'sp-fir', name: 'Filtro FIR (forma diretta)', section: SEC, build: fir },
  { id: 'sp-biquad', name: 'Biquad IIR (forma diretta II)', section: SEC, build: biquad },
  { id: 'sp-mfcc', name: 'Feature log-mel / MFCC', section: SEC, build: mfcc },
  { id: 'sp-audiocls', name: 'Classificazione audio (CNN)', section: SEC, build: audioClassification },
  { id: 'sp-kalman', name: 'Filtro di Kalman', section: SEC, build: kalman },
  { id: 'sp-comm', name: 'Catena di comunicazione digitale', section: SEC, build: commChain },
  { id: 'sp-adc', name: 'Conversione A/D', section: SEC, build: adcChain },
  { id: 'sp-dwt', name: 'Banco wavelet a due livelli', section: SEC, build: waveletBank },
  { id: 'sp-lms', name: 'Filtro adattivo LMS', section: SEC, build: lms },
  { id: 'sp-bci', name: 'Pipeline EEG / BCI', section: SEC, build: bci },
];

