// Modelli Generative AI e visione ricalcati sulle figure principali dei paper originali:
// ogni modello è fatto di normali blocchi e connessioni, quindi resta tutto modificabile.
import { Builder, type Color, type N } from '../builder';
import { textWidth } from '../geometry';
import { COLORS, ICON, type NodeModel } from '../model';
import type { TemplateDef } from '../registry';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const GEN = 'Generative AI';
const VISION = 'Deep learning';
const INK = '#1A1A1A';
const NOTE = '#555555';
const IMG = { radius: 2, strokeWidth: 1, fill: '#FFFFFF', stroke: '#C9CED6', ...ICON, fontSize: 13 };

/** Punto esatto (px, py): estremo invisibile per diramazioni, bus e frecce libere. */
const at = (t: Builder, px: number, py: number) => t.anchor(px - 0.5, py - 0.5);
const free = { arrowEnd: false };
const cx = (n: N) => n.x + n.w / 2;
const cy = (n: N) => n.y + n.h / 2;
const tw = (s: string, size: number) => textWidth(s, size, false, false, 'sans');

/** Immagine sintetica (forma dlg-scene) nella resa indicata da `spec`. */
const scene = (t: Builder, spec: string, label: string, x: number, y: number, w = 80, h = 80, extra: Partial<NodeModel> = {}) =>
  t.add({ shape: 'dlg-scene', label, spec, count: 0, x, y, w, h, ...IMG, ...extra });

// ======================================================================
// Modelli generativi
// ======================================================================

/** van den Oord et al. 2017 (VQ-VAE), arXiv 1711.00937, Fig. 1: encoder, codebook, decoder; a destra lo spazio degli embedding. */
function vqvae() {
  const t = new Builder();
  const FLOW = { color: '#4A86D9', width: 1.5 };
  t.add({ shape: 'dlg-codebook', count: 8, x: 300, y: 0, w: 250, h: 92, radius: 14, strokeWidth: 1.6, fill: '#DCD3EC', stroke: '#8E7DB6' });
  t.text('Embedding\nSpace', 565, 22, 90, 36, { fontSize: 13 });
  const x = scene(t, 'photo', '', 0, 150, 84, 84);
  t.text('CNN', 92, 222, 50, 22, { fontSize: 13 });
  const ze = t.add({ shape: 'dlg-gridcube', label: '$z_e(x)$', count: 6, depth: 0.36, x: 150, y: 140, w: 104, h: 104, strokeWidth: 1, ...ICON, fontSize: 14, fill: '#D5E8D4', stroke: '#82B366' });
  t.text('$D$', 140, 128, 24, 20, { fontSize: 13 });
  const jn = (px: number) => t.add({ shape: 'ellipse', x: px, y: 181, w: 22, h: 22, fill: '#4A86D9', stroke: '#4A86D9', strokeWidth: 1 });
  const d1 = jn(310);
  const q = t.add({ shape: 'dlg-gridcube', label: '$q(z|x)$', spec: 'flat idx', count: 6, x: 372, y: 236, w: 76, h: 76, strokeWidth: 1, ...ICON, labelPos: 'above', fontSize: 13, fill: '#D6E4EE', stroke: '#6C8EBF' });
  t.text('$z$', 346, 288, 20, 20, { fontSize: 13 });
  const d2 = jn(500);
  const zq = t.add({ shape: 'dlg-gridcube', label: '$z_q(x)$', spec: 'codes', count: 6, depth: 0.36, x: 560, y: 140, w: 104, h: 104, strokeWidth: 1, ...ICON, fontSize: 14, fill: '#E1D5E7', stroke: '#9673A6' });
  t.text('CNN', 668, 222, 50, 22, { fontSize: 13 });
  const out = scene(t, 'photo blur', '$p(x|z_q)$', 720, 128, 84, 84);
  t.link(x, ze, 'right', 'left', FLOW);
  t.link(ze, d1, 'right', 'left', FLOW);
  t.link(d1, q, 'bottom', 'left', { ...FLOW, routing: 'curve' });
  t.link(q, d2, 'right', 'bottom', { ...FLOW, routing: 'curve' });
  t.link(d2, zq, 'right', 'left', FLOW);
  t.link(zq, out, 'right', 'left', { ...FLOW, routing: 'curve' });
  t.link(at(t, 410, 92.5), d1, 'bottom', 'top', { ...FLOW, routing: 'curve' });
  t.link(at(t, 440, 92.5), d2, 'bottom', 'top', { ...FLOW, routing: 'curve' });
  // gradiente copiato dal decoder all'encoder (straight-through)
  t.link(at(t, 503, 184), at(t, 329, 184), 'top', 'top', { routing: 'curve', color: '#D9534F', width: 1.6, label: '$\\nabla_z L$', labelPos: 'below', fontSize: 13 });
  t.add({ shape: 'brace', direction: 'bottom', label: 'Encoder', x: 0, y: 330, w: 260, h: 16, fill: 'none', stroke: '#4A86D9', ...ICON, fontSize: 13 });
  t.add({ shape: 'brace', direction: 'bottom', label: 'Decoder', x: 555, y: 330, w: 250, h: 16, fill: 'none', stroke: '#4A86D9', ...ICON, fontSize: 13 });
  t.link(at(t, 840, 10), at(t, 840, 370), 'bottom', 'top', { ...free, dashed: true, routing: 'straight', color: INK, width: 1.6 });
  t.add({ shape: 'dlg-codebook', label: '$z_q(x) \\sim q(z|x)$', spec: 'space', x: 870, y: 110, w: 190, h: 150, ...ICON, fontSize: 13, fill: '#DCD3EC', stroke: '#8E7DB6' });
  t.text('$\\mathcal{L} = \\log p(x|z_q(x)) + \\| \\mathrm{sg}[z_e(x)] - e \\|_2^2 + \\beta \\| z_e(x) - \\mathrm{sg}[e] \\|_2^2$', 150, 392, 560, 30, { fontSize: 14 });
  return t.done();
}

/** Karras et al. 2019 (StyleGAN), arXiv 1812.04948, Fig. 1: generatore tradizionale (a) e generatore basato sullo stile (b). */
function styleGan() {
  const t = new Builder();
  const B = (label: string, x: number, y: number, c: Color = WHITE, extra: Partial<NodeModel> = {}) => t.box(label, x, y, 120, 24, c, { fontSize: 11, radius: 4, ...extra });
  const RES = { fill: '#EFEFEF', stroke: '#C4C4C4', dashed: false, radius: 6, textColor: '#444444' };
  const dots = (x: number, y: number) => t.text('$\\vdots$', x + 45, y, 30, 26, { fontSize: 16 });
  // (a) generatore tradizionale
  const ax = 10;
  const az = t.text('Latent $\\mathbf{z} \\in \\mathcal{Z}$', ax - 10, 0, 140, 22, { fontSize: 12 });
  t.group('4×4', ax - 8, 74, 136, 178, RES);
  t.group('8×8', ax - 8, 266, 136, 218, RES);
  const col = [
    B('Normalize', ax, 40), B('Fully-connected', ax, 100), B('PixelNorm', ax, 140, YELLOW), B('Conv $3 \\times 3$', ax, 180), B('PixelNorm', ax, 220, YELLOW),
    B('Upsample', ax, 292), B('Conv $3 \\times 3$', ax, 332), B('PixelNorm', ax, 372, YELLOW), B('Conv $3 \\times 3$', ax, 412), B('PixelNorm', ax, 452, YELLOW),
  ];
  t.chain([az, ...col], 'down');
  t.link(col[col.length - 1], dots(ax, 500), 'bottom', 'top', free);
  t.text('(a) Traditional', ax - 10, 640, 140, 22, { fontSize: 12 });
  // (b) mapping network: z → 8 FC → w
  const mx = 240;
  const mz = t.text('Latent $\\mathbf{z} \\in \\mathcal{Z}$', mx - 20, 0, 140, 22, { fontSize: 12 });
  const norm = B('Normalize', mx - 10, 40);
  t.group('', mx - 16, 78, 226, 262, { fill: '#F3F8F1', stroke: '#82B366', dashed: false, radius: 8 });
  t.text('Mapping\nnetwork $f$', mx + 112, 190, 90, 40, { fontSize: 13, align: 'left', textColor: '#2F5246' });
  const fcs = Array.from({ length: 8 }, (_, i) => t.box('FC', mx, 94 + i * 30, 100, 22, GREEN, { fontSize: 11, radius: 4 }));
  const w = t.text('$\\mathbf{w} \\in \\mathcal{W}$', mx, 368, 100, 24, { fontSize: 13 });
  t.chain([mz, norm, ...fcs, w], 'down');
  // (b) synthesis network: costante, rumore (B), stili (A) con AdaIN, risoluzioni crescenti
  const sx = 560, busX = 496, nx = 752;
  t.group('Synthesis network $g$', busX - 10, 16, nx - busX, 604, { fill: 'none', stroke: '#8E7DB6', dashed: false, radius: 8, textColor: '#4A3D6B' });
  t.group('4×4', sx - 14, 88, 178, 190, RES);
  t.group('8×8', sx - 14, 292, 178, 286, RES);
  const konst = B('Const $4 \\times 4 \\times 512$', sx, 56);
  const plus = (y: number) => t.op('+', sx + 49, y, { w: 22, h: 22, fontSize: 14 });
  const ada = (y: number) => B('AdaIN', sx, y, YELLOW);
  const p1 = plus(96), a1 = ada(128), c1 = B('Conv $3 \\times 3$', sx, 170), p2 = plus(210), a2 = ada(242);
  const up = B('Upsample', sx, 316), c2 = B('Conv $3 \\times 3$', sx, 356), p3 = plus(396), a3 = ada(428), c3 = B('Conv $3 \\times 3$', sx, 470), p4 = plus(510), a4 = ada(542);
  t.chain([konst, p1, a1, c1, p2, a2, up, c2, p3, a3, c3, p4, a4], 'down');
  t.link(a4, dots(sx, 584), 'bottom', 'top', free);
  t.link(at(t, busX, cy(a1)), at(t, busX, cy(a4)), 'bottom', 'top', { ...free, routing: 'straight' });
  t.link(w, at(t, busX, cy(w)), 'right', 'left', free);
  for (const a of [a1, a2, a3, a4]) {
    const A = t.box('A', sx - 44, cy(a) - 11, 22, 22, PURPLE, { fontSize: 11, radius: 3 });
    t.link(at(t, busX, cy(a)), A, 'right', 'left', { ...free, routing: 'straight' });
    t.link(A, a, 'right', 'left');
  }
  t.text('Noise', nx - 26, -22, 52, 22, { fontSize: 12, bold: true });
  t.link(at(t, nx, 0), at(t, nx, cy(p4)), 'bottom', 'top', { ...free, routing: 'straight' });
  for (const p of [p1, p2, p3, p4]) {
    const Bx = t.box('B', sx + 130, cy(p) - 11, 22, 22, TEAL, { fontSize: 11, radius: 3 });
    t.link(at(t, nx, cy(p)), Bx, 'left', 'right', { ...free, routing: 'straight' });
    t.link(Bx, p, 'left', 'right');
  }
  t.text('(b) Style-based generator', 400, 640, 240, 22, { fontSize: 12 });
  return t.done();
}

/** Isola et al. 2017 (pix2pix), arXiv 1611.07004, Fig. 2: cGAN che traduce bordi in foto; D giudica le coppie (x, G(x)) e (x, y). */
function pix2pix() {
  const t = new Builder();
  const big = { labelPos: 'above' as const, fontSize: 18 };
  const line = { color: INK, width: 1.4 };
  const net = (label: string, x: number, y: number) => t.add({ shape: 'dlg-netbars', label, count: 3, x, y, w: 54, h: 52, radius: 0, fill: '#FFFFFF', stroke: INK, strokeWidth: 1.4, ...big });
  const pair = (ox: number, top: N, verdict: string, color: string) => {
    const br = t.add({ shape: 'dlg-bracket', direction: 'right', x: ox + 108, y: 40, w: 14, h: 192, fill: 'none', stroke: INK, strokeWidth: 1.4 });
    const D = net('$D$', ox + 152, 110);
    const out = t.text(verdict, ox + 232, 124, 56, 24, { bold: true, fontSize: 16, textColor: color, align: 'left' });
    t.link(br, D, 'right', 'left', { ...line, ...free });
    t.link(D, out, 'right', 'left', line);
    return top;
  };
  const x = scene(t, 'edges', '$x$', 0, 30, 92, 92, big);
  const G = net('$G$', 130, 50);
  const gx = scene(t, 'photo jitter', '$G(x)$', 220, 30, 92, 92, big);
  const x2 = scene(t, 'edges', '$x$', 220, 150, 92, 92, { fontSize: 18 });
  t.link(x, G, 'right', 'left', { ...line, ...free });
  t.link(G, gx, 'right', 'left', line);
  t.link(x, x2, 'bottom', 'left', { ...line, dashed: true, routing: 'curve' });
  pair(220, gx, 'fake', '#C0392B');
  t.link(at(t, 545, 0), at(t, 545, 262), 'bottom', 'top', { ...free, dashed: true, routing: 'straight', color: NOTE, width: 1.2 });
  pair(580, scene(t, 'photo', '$y$', 580, 30, 92, 92, big), 'real', '#2E8B3E');
  scene(t, 'edges', '$x$', 580, 150, 92, 92, { fontSize: 18 });
  t.text('$G^* = \\arg\\min_G \\max_D \\mathcal{L}_{cGAN}(G, D) + \\lambda \\mathcal{L}_{L1}(G)$', 150, 292, 560, 40, { fontSize: 15 });
  t.text('$G$: U-Net generator,   $D$: PatchGAN discriminator on $70 \\times 70$ patches', 150, 336, 560, 22, { fontSize: 12, textColor: NOTE });
  return t.done();
}

/** Zhang et al. 2023 (ControlNet), arXiv 2302.05543, Fig. 3: Stable Diffusion bloccata (a) e copia addestrabile con zero convolution (b). */
function controlNet() {
  const t = new Builder();
  const LOCK = { fill: '#F2F2F2', stroke: '#8A8A8A' };
  const COPY = { fill: '#DCEDF2', stroke: '#2F8A9E' };
  const ZERO = { fill: '#FFFFFF', stroke: '#BDBDBD' };
  const TEALC = '#2F8A9E', GRAYL = '#A8A8A8';
  const tline = { color: TEALC, width: 1.4 };
  const gline = { ...free, routing: 'straight' as const, color: GRAYL };
  const lock = (n: N) => t.add({ shape: 'lock', x: n.x + n.w - 18, y: n.y + n.h - 21, w: 13, h: 16, strokeWidth: 1, fill: '#9E9E9E', stroke: '#8A8A8A' });
  const times3 = (x: number, y: number, align: 'left' | 'center' = 'left') => t.text('$\\times 3$', align === 'left' ? x : x - 15, y - 11, 30, 22, { fontSize: 12, align });
  const zero = (x: number, y: number, w: number) => t.add({ shape: 'pill', label: 'zero convolution', x, y, w, h: 24, fontSize: 12, strokeWidth: 1.2, ...ZERO });
  const X = 175, Y0 = 140, STEP = 70, H = 48;
  const names = ['Encoder Block A', 'Encoder Block B', 'Encoder Block C', 'Encoder Block D', 'Middle Block', 'Decoder Block D', 'Decoder Block C', 'Decoder Block B', 'Decoder Block A'];
  const res = ['64', '32', '16', '8', '8', '8', '16', '32', '64'].map((r) => `$${r} \\times ${r}$`);
  const W = [250, 230, 210, 190, 170, 190, 210, 230, 250];
  const ry = (i: number) => Y0 + i * STEP;
  // (a) Stable Diffusion, bloccata
  t.text('Prompt $c_t$', 0, -34, 95, 22, { fontSize: 13 });
  t.text('Time $t$', 110, -34, 95, 22, { fontSize: 13 });
  const te = t.box('Text\nEncoder', 0, 0, 95, 48, LOCK, { fontSize: 12 });
  const ti = t.box('Time\nEncoder', 110, 0, 95, 48, LOCK, { fontSize: 12 });
  const sd = names.map((s, i) => t.box(`SD ${s}\n${res[i]}`, X - W[i] / 2, ry(i), W[i], H, LOCK, { fontSize: 12 }));
  [te, ti, ...sd].forEach(lock);
  const inp = t.text('Input $z_t$', X - 45, 84, 90, 22, { fontSize: 13 });
  const out = t.text('Output $\\epsilon_\\theta(z_t, t, c_t, c_f)$', X - 110, ry(8) + H + 24, 220, 24, { fontSize: 13 });
  t.chain([inp, ...sd], 'down');
  t.link(sd[8], out, 'bottom', 'top');
  // prompt e tempo entrano in ogni blocco
  const busX = 24;
  const bus = at(t, busX, 66);
  t.link(te, bus, 'bottom', 'right', { ...free, color: GRAYL });
  t.link(ti, bus, 'bottom', 'right', { ...free, color: GRAYL });
  t.link(bus, at(t, busX, cy(sd[8])), 'bottom', 'top', gline);
  sd.forEach((b) => t.link(at(t, busX, cy(b)), b, 'right', 'left', gline));
  // skip connection dell'U-Net (encoder → decoder): linee grigie verticali
  sd.forEach((b, i) => i !== 4 && times3(b.x + b.w + 3, cy(b)));
  for (let k = 0; k < 4; k++) {
    const sx = X + 170 - k * 11;
    t.link(at(t, sx, cy(sd[k]) + 12), at(t, sx, cy(sd[8 - k]) - 12), 'bottom', 'top', { ...gline, color: '#D0D0D0' });
  }
  // (b) ControlNet: copia addestrabile dell'encoder e zero convolution
  const C = 600;
  const CW = [250, 232, 214, 196, 178];
  t.group('', 455, -26, 362, ry(8) + H + 8, { stroke: '#7FC4D3', dashed: true, radius: 10 });
  const cond = t.text('Condition $c_f$', C - 60, -18, 120, 24, { fontSize: 13 });
  const z0 = zero(C - 85, 22, 170);
  const plus = t.op('+', C - 12, 83, { w: 24, h: 24, fontSize: 14 });
  const copies = CW.map((cw, i) => t.box(`SD ${names[i]}\n${res[i]} (trainable copy)`, C - cw / 2, ry(i), cw, H, COPY, { fontSize: 12 }));
  t.chain([cond, z0, plus, ...copies], 'down', tline);
  t.link(inp, plus, 'right', 'left', tline);
  copies.forEach((b, i) => i < 4 && times3(b.x + b.w + 3, cy(b)));
  t.text('Prompt&Time', 468, ry(0) - 32, 100, 20, { fontSize: 12 });
  const cbus = 474;
  t.link(at(t, cbus, ry(0) - 10), at(t, cbus, cy(copies[4])), 'bottom', 'top', gline);
  copies.forEach((b) => t.link(at(t, cbus, cy(b)), b, 'right', 'left', gline));
  // uscite: zero convolution sotto il middle block e una per ogni blocco del decoder
  const zm = zero(C - 89, ry(4) + H + 4, 178);
  t.link(copies[4], zm, 'bottom', 'top', tline);
  t.link(zm, sd[4], 'left', 'right', tline);
  for (let k = 0; k < 4; k++) {
    const row = 8 - k;
    const z = zero(C - 95, cy(sd[row]) - 12, 190);
    // la colonna verticale parte a destra del "×3" della copia e scende fino al "×3" della zero convolution
    const vx = 744 + (3 - k) * 16;
    times3(vx, cy(z), 'center');
    t.link(at(t, vx, cy(copies[k])), at(t, vx, cy(z) - 12), 'bottom', 'top', { ...tline, routing: 'straight' });
    t.link(z, at(t, sd[row].x + sd[row].w + 34, cy(sd[row])), 'left', 'right', tline);
  }
  t.text('(a) Stable Diffusion', X - 90, ry(8) + H + 60, 180, 24, { fontSize: 14 });
  t.text('(b) ControlNet', C - 70, ry(8) + H + 60, 140, 24, { fontSize: 14, bold: true });
  return t.done();
}

/** Song et al. 2021 (score SDE), arXiv 2011.13456, Fig. 1: SDE in avanti (dati → rumore) e inversa guidata dallo score. */
function scoreSde() {
  const t = new Builder();
  const node = (label: string, x: number, y: number, gray: boolean) =>
    t.add({ shape: 'ellipse', label, x, y, w: 54, h: 54, fontSize: 15, strokeWidth: 1.4, fill: gray ? '#DCDCDC' : '#FFFFFF', stroke: '#333333' });
  t.text('Forward SDE (data → noise)', 220, 0, 260, 22, { fontSize: 13 });
  const a0 = node('$\\mathbf{x}(0)$', 0, 28, true);
  const aT = node('$\\mathbf{x}(T)$', 646, 28, false);
  t.link(a0, aT, 'right', 'left', { color: INK, width: 1.4, label: '$\\mathrm{d}\\mathbf{x} = \\mathbf{f}(\\mathbf{x}, t)\\mathrm{d}t + g(t)\\mathrm{d}\\mathbf{w}$', fontSize: 14 });
  t.add({ shape: 'dlg-noisestrip', count: 8, x: 70, y: 98, w: 560, h: 70, strokeWidth: 1, fill: 'none', stroke: 'none' });
  // SDE inversa: il termine dello score è evidenziato in un riquadro
  const yB = 190;
  const b0 = node('$\\mathbf{x}(0)$', 0, yB, false);
  const bT = node('$\\mathbf{x}(T)$', 646, yB, true);
  const L = '$\\mathrm{d}\\mathbf{x} = [\\mathbf{f}(\\mathbf{x}, t) - g^2(t)$';
  const M = '$\\nabla_{\\mathbf{x}} \\log p_t(\\mathbf{x})$';
  const R = '$]\\mathrm{d}t + g(t)\\mathrm{d}\\bar{\\mathbf{w}}$';
  const fs = 14;
  const wl = tw(L, fs), wm = tw(M, fs) + 14, wr = tw(R, fs);
  const x0 = 350 - (wl + wm + wr + 8) / 2;
  const my = yB + 27;
  t.text(L, x0, my - 12, wl, 24, { fontSize: fs, align: 'right' });
  const score = t.box(M, x0 + wl + 4, my - 15, wm, 30, { fill: 'none', stroke: '#5470A8' }, { fontSize: fs, strokeWidth: 1.6, radius: 6 });
  t.text('score function', score.x - 20, score.y - 22, score.w + 40, 18, { fontSize: 11, bold: true, textColor: '#5470A8' });
  t.text(R, score.x + score.w + 4, my - 12, wr, 24, { fontSize: fs, align: 'left' });
  t.link(bT, at(t, score.x + score.w + wr + 14, my), 'left', 'right', { ...free, color: INK, width: 1.4 });
  t.link(at(t, x0 - 10, my), b0, 'left', 'right', { color: INK, width: 1.4 });
  t.text('Reverse SDE (noise → data)', 220, 252, 260, 22, { fontSize: 13 });
  return t.done();
}

/** Liu et al. 2023 (rectified flow), arXiv 2209.03003, Fig. 2: interpolazione, flusso rettificato, reflow. */
function rectifiedFlow() {
  const t = new Builder();
  const panels: [string, string][] = [
    ['interp', '(a) Linear interpolation\n$X_t = t X_1 + (1-t) X_0$'],
    ['rectified', '(b) Rectified flow $Z_t$\ninduced by $(X_0, X_1)$'],
    ['reflow', '(c) Linear interpolation\nof $(Z_0, Z_1)$'],
    ['straight', '(d) 2-Rectified flow\ninduced by $(Z_0, Z_1)$'],
  ];
  const nodes = panels.map(([spec, cap], i) => {
    const n = t.add({ shape: 'dlg-flowpaths', spec, count: 22, x: i * 220, y: 30, w: 170, h: 130, fill: 'none', stroke: 'none' });
    t.text(cap, n.x - 15, 170, 200, 38, { fontSize: 12 });
    return n;
  });
  for (const i of [0, 2]) t.link(at(t, nodes[i].x + 174, 95), at(t, nodes[i + 1].x - 4, 95), 'right', 'left', { color: '#7A808A', width: 1.3, label: 'Rectify', labelPos: 'above', fontSize: 11 });
  t.link(at(t, nodes[1].x + 174, 95), at(t, nodes[2].x - 4, 95), 'right', 'left', { color: '#7A808A', width: 1.3, dashed: true, label: '$(Z_0, Z_1)$', labelPos: 'above', fontSize: 11 });
  // legenda delle distribuzioni
  const lg = (label: string, color: string, x: number) => {
    t.add({ shape: 'ellipse', x, y: 4, w: 9, h: 9, fill: color, stroke: color, strokeWidth: 1 });
    t.text(label, x + 14, -2, 70, 20, { fontSize: 12, align: 'left' });
  };
  lg('$\\pi_0$', '#9B59B6', 330);
  lg('$\\pi_1$', '#E3262A', 400);
  t.text('$\\mathrm{d}Z_t = v(Z_t, t)\\mathrm{d}t$,   $\\min_v \\mathbb{E}_{t \\sim U[0, 1]} \\| (X_1 - X_0) - v(X_t, t) \\|^2$', 100, 226, 660, 40, { fontSize: 15 });
  return t.done();
}

/** Dinh et al. 2017 (RealNVP), arXiv 1605.08803, Fig. 2 (coupling layer avanti e inverso) e Fig. 3 (maschere). */
function realNvp() {
  const t = new Builder();
  const sym = (s: string, x: number, y: number) => t.text(s, x, y, 34, 24, { fontSize: 16 });
  const graph = (ox: number, inverse: boolean) => {
    const a = inverse ? 'y' : 'x', b = inverse ? 'x' : 'y';
    const a1 = sym(`$${a}_1$`, ox, 0), b1 = sym(`$${b}_1$`, ox + 290, 0);
    const a2 = sym(`$${a}_2$`, ox, 150), b2 = sym(`$${b}_2$`, ox + 290, 150);
    t.link(a1, b1, 'right', 'left', { label: '$=$', fontSize: 14, color: INK });
    const s = t.box('$s$', ox + (inverse ? 180 : 90), 56, 40, 30, ORANGE, { fontSize: 15 });
    const tt = t.box('$t$', ox + (inverse ? 90 : 180), 56, 40, 30, GREEN, { fontSize: 15 });
    t.link(at(t, cx(s), 12), s, 'bottom', 'top', { color: INK });
    t.link(at(t, cx(tt), 12), tt, 'bottom', 'top', { color: INK });
    const op1 = t.op(inverse ? '$-$' : '$\\odot$', cx(inverse ? tt : s) - 13, 149);
    const op2 = t.op(inverse ? '$\\odot$' : '$+$', cx(inverse ? s : tt) - 13, 149);
    t.chain([a2, op1, op2, b2], 'right', { color: INK });
    t.link(s, inverse ? op2 : op1, 'bottom', 'top', { color: INK, label: inverse ? '$\\exp(-\\cdot)$' : '$\\exp$', labelPos: 'below', fontSize: 11 });
    t.link(tt, inverse ? op1 : op2, 'bottom', 'top', { color: INK });
    t.text(inverse ? '(b) Inverse propagation' : '(a) Forward propagation', ox + 30, 196, 260, 22, { fontSize: 12 });
  };
  graph(0, false);
  graph(400, true);
  t.text('$y_{1:d} = x_{1:d}$,   $y_{d+1:D} = x_{d+1:D} \\odot \\exp(s(x_{1:d})) + t(x_{1:d})$', 40, 236, 640, 26, { fontSize: 14 });
  t.text('$x_{d+1:D} = (y_{d+1:D} - t(y_{1:d})) \\odot \\exp(-s(y_{1:d}))$', 40, 266, 640, 26, { fontSize: 14 });
  // Fig. 3: maschera a scacchiera, squeeze e maschera per canali
  const ck = t.add({ shape: 'dlg-checker', label: 'Checkerboard mask\n$4 \\times 4 \\times 1$', spec: 'checker num', count: 4, x: 170, y: 320, w: 100, h: 100, strokeWidth: 1, ...ICON, fill: '#C9C9C9', stroke: '#555555' });
  const sq = t.add({ shape: 'dlg-checker', label: 'Channel-wise mask\n$2 \\times 2 \\times 4$', spec: 'squeeze num', x: 420, y: 320, w: 100, h: 100, strokeWidth: 1, ...ICON, fill: '#C9C9C9', stroke: '#555555' });
  t.link(ck, sq, 'right', 'left', { color: INK, width: 1.3, label: 'squeeze', labelPos: 'above', fontSize: 12 });
  return t.done();
}

/** Song et al. 2023 (consistency models), arXiv 2303.01469, Fig. 1: ogni punto della traiettoria PF-ODE torna all'origine. */
function consistency() {
  const t = new Builder();
  const GREENL = '#8DB255', REDL = '#C0504D';
  const N = 9, SZ = 66, GAP = 3;
  const keep: Record<number, string> = { 0: '$(\\mathbf{x}_0, 0)$', 3: '$(\\mathbf{x}_t, t)$', 6: "$(\\mathbf{x}_{t'}, t')$", 8: '$(\\mathbf{x}_T, T)$' };
  const data = t.text('Data', -6, 0, 70, 30, { fontSize: 20 });
  const noise = t.text('Noise', (N - 1) * (SZ + GAP) - 4, 0, 74, 30, { fontSize: 20 });
  t.link(data, noise, 'right', 'left', { color: GREENL, width: 2, label: 'Probability Flow ODE', fontSize: 15 });
  const dots: N[] = [];
  for (let i = 0; i < N; i++) {
    const x = i * (SZ + GAP);
    const ring = i === 0 ? GREENL : keep[i] ? REDL : 'none';
    t.add({ shape: 'dlg-scene', count: Math.round((10 * i) / (N - 1)), x, y: 40, w: SZ, h: SZ, radius: 0, fill: 'none', stroke: ring, strokeWidth: 2.4 });
    if (keep[i]) {
      t.text(keep[i], x - 20, 110, SZ + 40, 24, { fontSize: 14 });
      dots.push(t.add({ shape: 'ellipse', x: x + SZ / 2 - 5, y: 148, w: 10, h: 10, fill: i === 0 ? GREENL : REDL, stroke: i === 0 ? GREENL : REDL, strokeWidth: 1 }));
    }
  }
  t.link(dots[0], dots[1], 'right', 'left', { color: GREENL, width: 2, arrowEnd: false });
  t.link(dots[1], dots[2], 'right', 'left', { color: GREENL, width: 2, arrowEnd: false });
  t.link(dots[2], dots[3], 'right', 'left', { color: GREENL, width: 2 });
  const fl = ['$f_\\theta(\\mathbf{x}_t, t)$', "$f_\\theta(\\mathbf{x}_{t'}, t')$", '$f_\\theta(\\mathbf{x}_T, T)$'];
  dots.slice(1).forEach((d, i) => t.link(d, dots[0], 'bottom', 'bottom', { routing: 'curve', color: REDL, width: 1.8, label: fl[i], fontSize: 13 }));
  t.text('A consistency model $f_\\theta$ maps any point $(\\mathbf{x}_t, t)$ of a PF ODE trajectory to its origin $\\mathbf{x}_0$:\none-step generation from $\\mathbf{x}_T$, or multistep by alternating denoising and noise injection.', 20, 352, 580, 40, { fontSize: 12, textColor: NOTE });
  return t.done();
}

// ======================================================================
// Visione e apprendimento auto-supervisionato
// ======================================================================

/** Mildenhall et al. 2020 (NeRF), arXiv 2003.08934, Fig. 2: input 5D, MLP F_Θ, colore e densità, volume rendering, loss. */
function nerf() {
  const t = new Builder();
  const BLUEC = '#2E7BE6';
  const curve = { routing: 'curve' as const, color: BLUEC, width: 1.6 };
  const title = (s: string, x: number) => t.text(s, x, 0, 200, 36, { fontSize: 13 });
  const caption = (s: string, x: number, w: number) => t.text(s, x, 236, w, 22, { fontSize: 13 });
  title('5D Input\nPosition + Direction', 15);
  t.add({ shape: 'dlg-nerfrays', spec: 'input', count: 8, x: 0, y: 50, w: 230, h: 170, fill: 'none', stroke: 'none' });
  const xin = t.text('$(x, y, z, \\theta, \\phi)$', 228, 38, 104, 24, { fontSize: 13 });
  const F = t.add({ shape: 'dlg-netbars', label: '$F_\\Theta$', count: 3, x: 350, y: 28, w: 46, h: 44, radius: 0, fill: '#BFBFBF', stroke: BLUEC, strokeWidth: 1.6, ...ICON, fontSize: 20 });
  const xout = t.text('$(RGB\\sigma)$', 412, 38, 72, 24, { fontSize: 13 });
  t.link(xin, F, 'right', 'left', { color: BLUEC, width: 1.6 });
  t.link(F, xout, 'right', 'left', { color: BLUEC, width: 1.6 });
  t.link(at(t, 151, 118), xin, 'top', 'left', curve);
  title('Output\nColor + Density', 455);
  t.add({ shape: 'dlg-nerfrays', spec: 'output', count: 8, x: 440, y: 50, w: 230, h: 170, fill: 'none', stroke: 'none' });
  t.link(xout, at(t, 563.5, 128), 'right', 'top', curve);
  // volume rendering lungo i due raggi e loss rispetto al colore vero
  title('Volume\nRendering', 690);
  const r1 = t.add({ shape: 'dlg-raydensity', spec: 'ray1', x: 700, y: 58, w: 140, h: 70, fill: 'none', stroke: 'none' });
  const r2 = t.add({ shape: 'dlg-raydensity', spec: 'ray2', label: 'Ray Distance', x: 700, y: 148, w: 140, h: 70, fill: 'none', stroke: 'none', ...ICON, fontSize: 11 });
  title('Rendering\nLoss', 845);
  const fs = 17;
  const L = '$\\|$', R = '$- \\mathrm{g.t.} \\|_2^2$';
  const loss = (y: number, color: string) => {
    const x0 = 880;
    t.text(L, x0, y - 13, tw(L, fs), 26, { fontSize: fs, align: 'right' });
    const sw = t.add({ x: x0 + tw(L, fs) + 4, y: y - 9, w: 18, h: 18, radius: 0, fill: color, stroke: color, strokeWidth: 1 });
    t.text(R, sw.x + 22, y - 14, tw(R, fs) + 4, 28, { fontSize: fs, align: 'left' });
    return sw;
  };
  const s1 = loss(98, '#A0441A'), s2 = loss(188, '#F08A24');
  t.link(at(t, r1.x + r1.w - 30, r1.y + 6), s1, 'top', 'top', curve);
  t.link(at(t, r2.x + r2.w - 30, r2.y + 6), s2, 'top', 'top', curve);
  caption('(a)', 95, 40);
  caption('(b)', 535, 40);
  caption('(c)', 750, 40);
  caption('(d)', 915, 40);
  return t.done();
}

/** Kerbl et al. 2023 (3D Gaussian Splatting), arXiv 2308.04079, Fig. 2 (pipeline) e Fig. 4 (densificazione adattiva). */
function gaussianSplatting() {
  const t = new Builder();
  const BOX = { fill: '#E6E6E6', stroke: '#333333' };
  const PLAIN = { fill: '#FFFFFF', stroke: '#333333' };
  const OP = { color: INK, width: 1.5 };
  const GR = { color: '#3FB6E8', width: 1.5 };
  const C = { routing: 'curve' as const };
  const sfm = t.add({ shape: 'dlg-gaussians', label: 'SfM Points', spec: 'points', count: 12, x: 0, y: 58, w: 70, h: 64, fill: 'none', stroke: 'none', ...ICON, fontSize: 12 });
  const init = t.box('Initialization', 115, 70, 120, 40, BOX, { fontSize: 12 });
  const g3d = t.add({ shape: 'dlg-gaussians', label: '3D Gaussians', spec: 'splats', count: 16, x: 285, y: 50, w: 110, h: 80, fill: 'none', stroke: '#2E9E44', ...ICON, fontSize: 12, bold: true });
  const cam = t.box('Camera', 440, -62, 100, 32, PLAIN, { fontSize: 12 });
  t.box('Projection', 590, -62, 150, 64, BOX, { fontSize: 12 });
  const rast = t.box('Differentiable\nTile Rasterizer', 800, 68, 160, 50, BOX, { fontSize: 12 });
  t.box('Image', 1020, 68, 110, 50, PLAIN, { fontSize: 12 });
  const adc = t.box('Adaptive\nDensity Control', 590, 140, 150, 50, BOX, { fontSize: 12 });
  // flusso delle operazioni (nero) e dei gradienti (azzurro), come nella figura originale
  t.chain([sfm, init, g3d], 'right', OP);
  t.link(cam, at(t, 590, -46), 'right', 'left', OP);
  t.link(g3d, at(t, 590, -12), 'top', 'left', { ...OP, ...C });
  t.link(at(t, 632, 2), at(t, 396, 78), 'bottom', 'right', { ...GR, ...C });
  t.link(at(t, 740, -44), at(t, 880, 68), 'right', 'top', { ...OP, ...C });
  t.link(at(t, 838, 68), at(t, 740, -14), 'top', 'right', { ...GR, ...C });
  t.link(at(t, 960, 84), at(t, 1020, 84), 'right', 'left', OP);
  t.link(at(t, 1020, 102), at(t, 960, 102), 'left', 'right', GR);
  t.link(rast, adc, 'bottom', 'right', { ...GR, ...C });
  t.link(adc, at(t, 396, 108), 'left', 'right', { ...OP, ...C });
  // legenda (contenitore: sta sotto le sue frecce)
  t.add({ x: 820, y: 166, w: 310, h: 30, radius: 2, fill: '#FFFFFF', stroke: '#BDBDBD', strokeWidth: 1, container: true });
  t.link(at(t, 832, 181), at(t, 870, 181), 'right', 'left', OP);
  t.text('Operation Flow', 876, 171, 100, 20, { fontSize: 11, align: 'left' });
  t.link(at(t, 980, 181), at(t, 1018, 181), 'right', 'left', GR);
  t.text('Gradient Flow', 1024, 171, 100, 20, { fontSize: 11, align: 'left' });
  // densificazione: clone (sotto-ricostruzione) e split (sovra-ricostruzione)
  const rows: [string, string, string, number][] = [['Under-\nReconstruction', 'under', 'clone', 250], ['Over-\nReconstruction', 'over', 'split', 372]];
  for (const [name, a, b, y] of rows) {
    t.text(name, 250, y + 22, 110, 36, { fontSize: 12, bold: true, align: 'right' });
    const s0 = t.add({ shape: 'dlg-densify', spec: a, x: 410, y, w: 80, h: 80, fill: 'none', stroke: '#2E9E44' });
    const s1 = t.add({ shape: 'dlg-densify', spec: b, x: 580, y, w: 80, h: 80, fill: 'none', stroke: '#2E9E44' });
    t.text('$\\cdots$', 690, y + 22, 50, 20, { fontSize: 16 });
    t.text('Optimization\nContinues', 675, y + 44, 80, 32, { fontSize: 11 });
    t.add({ shape: 'dlg-densify', spec: 'fit', x: 780, y, w: 80, h: 80, fill: 'none', stroke: '#2E9E44' });
    t.link(s0, s1, 'right', 'left', { ...OP, label: b === 'clone' ? 'Clone' : 'Split', labelPos: 'below', fontSize: 12 });
  }
  return t.done();
}

/** He et al. 2022 (MAE), arXiv 2111.06377, Fig. 1: l'encoder vede solo le patch visibili, il decoder ricostruisce l'immagine. */
function mae() {
  const t = new Builder();
  const ARROW = { color: '#8A8A8A', width: 2.6 };
  const NET = { fill: '#D4D5D8', stroke: '#8A8B90' };
  const inp = t.add({ shape: 'dlg-masked', label: 'input', spec: 'masked', count: 5, x: 0, y: 130, w: 150, h: 150, ...ICON, fontSize: 14 });
  const vis = t.add({ shape: 'dlg-masked', spec: 'visible', count: 5, x: 190, y: 75, w: 40, h: 260 });
  const enc = t.box('encoder', 246, 115, 90, 180, NET, { fontSize: 15, radius: 14 });
  const tok = t.add({ shape: 'dlg-masked', spec: 'tokens', count: 5, x: 352, y: 75, w: 40, h: 260, radius: 2, fill: '#A8DDE0', stroke: 'none' });
  const mix = t.add({ shape: 'dlg-masked', spec: 'mixed', count: 5, x: 436, y: 0, w: 26, h: 410, radius: 2, fill: '#A8DDE0', stroke: 'none' });
  const dec = t.box('decoder', 480, 155, 90, 100, NET, { fontSize: 15, radius: 14 });
  const outc = t.add({ shape: 'dlg-masked', spec: 'tokens all', count: 5, x: 588, y: 0, w: 26, h: 410, radius: 2, fill: '#EE8277', stroke: 'none' });
  const tgt = t.add({ shape: 'dlg-masked', label: 'target', spec: 'image', count: 5, x: 656, y: 130, w: 150, h: 150, ...ICON, fontSize: 14 });
  t.link(inp, vis, 'right', 'left', ARROW);
  t.link(tok, mix, 'right', 'left', ARROW);
  t.link(outc, tgt, 'right', 'left', ARROW);
  void enc;
  void dec;
  t.text('visible patches only', 160, 345, 100, 32, { fontSize: 11, textColor: NOTE });
  t.text('+ mask tokens\n(full set)', 398, 420, 100, 32, { fontSize: 11, textColor: NOTE });
  t.text('Masking ratio 75%: the encoder processes only the visible subset; a lightweight decoder\nreconstructs the pixels of the masked patches from the latent representation and mask tokens.', 40, 470, 740, 36, { fontSize: 12, textColor: NOTE });
  return t.done();
}

/** Caron et al. 2021 (DINO), arXiv 2104.14294, Fig. 2: auto-distillazione senza etichette, studente e insegnante (EMA). */
function dino() {
  const t = new Builder();
  const PLAIN = { fill: '#FFFFFF', stroke: '#555555' };
  const x = scene(t, 'photo', '$x$', 150, 470, 80, 80, { fontSize: 15 });
  const x1 = scene(t, 'crop', '', 35, 360, 70, 70);
  const x2 = scene(t, 'crop2 jitter', '', 275, 360, 70, 70);
  t.text('$x_1$', 0, 383, 30, 24, { fontSize: 15 });
  t.text('$x_2$', 350, 383, 30, 24, { fontSize: 15 });
  const st = t.box('student $g_{\\theta_s}$', 10, 280, 120, 44, BLUE, { fontSize: 13 });
  const te = t.box('teacher $g_{\\theta_t}$', 250, 280, 120, 44, ORANGE, { fontSize: 13 });
  const cen = t.box('centering', 250, 222, 120, 28, PLAIN, { fontSize: 12 });
  const sm1 = t.box('softmax', 10, 166, 120, 28, PLAIN, { fontSize: 12 });
  const sm2 = t.box('softmax', 250, 166, 120, 28, PLAIN, { fontSize: 12 });
  const p1 = t.text('$p_1$', 55, 104, 30, 24, { fontSize: 15 });
  const p2 = t.text('$p_2$', 295, 104, 30, 24, { fontSize: 15 });
  const loss = t.box('loss:  $- p_2 \\log p_1$', 90, 20, 200, 38, RED, { fontSize: 14 });
  t.link(x, x1, 'top', 'bottom');
  t.link(x, x2, 'top', 'bottom');
  t.chain([x1, st, sm1, p1], 'up');
  t.chain([x2, te, cen, sm2, p2], 'up');
  t.link(st, te, 'right', 'left', { dashed: true, label: 'ema', labelPos: 'above', fontSize: 12 });
  t.add({ shape: 'stopgrad', x: 301, y: 138, w: 16, h: 16, fill: 'none', stroke: '#B85450', strokeWidth: 1.4 });
  t.text('sg', 322, 135, 24, 20, { fontSize: 12, align: 'left', textColor: '#B85450' });
  t.link(p1, loss, 'top', 'bottom');
  t.link(p2, loss, 'top', 'bottom');
  return t.done();
}

/** He et al. 2020 (MoCo), arXiv 1911.05722, Fig. 1: query e chiavi da una coda, encoder a momento, loss contrastiva. */
function moco() {
  const t = new Builder();
  t.box('contrastive loss', 150, 0, 230, 36, RED, { fontSize: 13 });
  const q = t.text('$q$', 60, 92, 30, 26, { fontSize: 17 });
  t.group('queue', 236, 68, 254, 76, { radius: 8 });
  const keys = ['$k_0$', '$k_1$', '$k_2$'].map((s, i) => t.box(s, 262 + i * 66, 102, 44, 30, PURPLE, { fontSize: 14 }));
  t.text('$\\cdots$', 456, 106, 26, 20, { fontSize: 15 });
  const enc = t.box('encoder', 15, 196, 120, 40, BLUE, { fontSize: 13 });
  const menc = t.box('momentum encoder', 250, 196, 210, 40, ORANGE, { fontSize: 13 });
  const xq = scene(t, 'crop', '$x^{query}$', 40, 290, 70, 70, { fontSize: 14 });
  const specs = ['crop2', 'local', 'crop flip jitter'];
  specs.forEach((sp, i) => {
    const k = scene(t, sp, `$x_${i}^{key}$`, 255 + i * 66, 296, 56, 56, { fontSize: 13 });
    t.link(k, at(t, cx(keys[i]), 236.5), 'top', 'bottom');
    t.link(at(t, cx(keys[i]), 195.5), keys[i], 'top', 'bottom');
  });
  t.text('$\\cdots$', 456, 314, 26, 20, { fontSize: 15 });
  t.chain([xq, enc, q], 'up');
  t.link(q, at(t, 230, 36.5), 'top', 'bottom');
  t.link(at(t, 310, 67.5), at(t, 310, 36.5), 'top', 'bottom');
  t.text('similarity', 222, 46, 80, 20, { fontSize: 12, textColor: NOTE });
  t.link(enc, menc, 'right', 'left', { dashed: true, color: '#7A808A', label: 'momentum\nupdate', labelPos: 'below', fontSize: 11 });
  t.text('$\\theta_k \\leftarrow m \\theta_k + (1 - m) \\theta_q$', 30, 390, 460, 26, { fontSize: 14 });
  return t.done();
}

/** Carion et al. 2020 (DETR), arXiv 2005.12872, Fig. 2: backbone, encoder-decoder transformer, object query e FFN. */
function detr() {
  const t = new Builder();
  const PLAIN = { fill: '#FFFFFF', stroke: '#333333' };
  const PANEL = { stroke: '#333333', fontSize: 15, textColor: INK, radius: 6 };
  const Q = ['#E8636F', '#7CC47F', '#E3B23C', '#4A86D9'];
  const small = { color: INK, width: 1 };
  t.group('backbone', 0, 0, 215, 170, PANEL);
  t.group('', 0, 180, 215, 132, PANEL);
  t.group('encoder', 225, 0, 220, 312, PANEL);
  t.group('decoder', 455, 0, 225, 312, PANEL);
  t.group('prediction heads', 690, 0, 250, 312, PANEL);
  t.text('set of image features', 62, 26, 150, 18, { fontSize: 11 });
  const cnn = t.add({ shape: 'trapezoid', direction: 'right', label: 'CNN', x: 14, y: 62, w: 64, h: 76, radius: 4, fontSize: 13, strokeWidth: 1.2, ...PLAIN });
  const feat = t.box('', 122, 52, 22, 96, PLAIN, { radius: 2 });
  const pe = t.add({ shape: 'dlg-gradstack', count: 3, x: 26, y: 192, w: 92, h: 82, strokeWidth: 1, fill: '#FFFFFF', stroke: '#333333' });
  t.text('positional encoding', 10, 284, 160, 20, { fontSize: 12, align: 'left' });
  const plus = t.op('+', 202, 158);
  t.link(cnn, feat, 'right', 'left', small);
  t.link(feat, plus, 'right', 'top', small);
  t.link(pe, plus, 'right', 'bottom', small);
  // righe di token (ingresso e uscita dell'encoder)
  const row = (x0: number, y: number) => {
    const box = t.add({ x: x0, y, w: 190, h: 26, radius: 7, fill: '#FFFFFF', stroke: '#333333', strokeWidth: 1 });
    const xs = [0, 1, 2, 3, 4, 5, 7].map((i) => x0 + 9 + i * 25);
    xs.forEach((x) => t.add({ x, y: y + 6, w: 14, h: 14, radius: 2, fill: '#D9D9D9', stroke: '#555555', strokeWidth: 1 }));
    t.text('$\\cdots$', x0 + 9 + 6 * 25 - 4, y + 3, 22, 18, { fontSize: 13 });
    return { box, xs: xs.map((x) => x + 7) };
  };
  const top = row(240, 40), bot = row(240, 262);
  t.box('transformer\nencoder', 250, 95, 180, 140, PLAIN, { fontSize: 16 });
  bot.xs.forEach((x) => t.link(at(t, x, 262), at(t, x, 235.5), 'top', 'bottom', small));
  top.xs.forEach((x) => t.link(at(t, x, 95.5), at(t, x, 66), 'top', 'bottom', small));
  t.link(plus, bot.box, 'bottom', 'left', small);
  // decoder con le object query
  const dec = t.box('transformer\ndecoder', 468, 95, 140, 140, PLAIN, { fontSize: 16 });
  t.link(top.box, dec, 'right', 'left', { ...small, routing: 'curve' });
  t.text('object queries', 463, 286, 150, 20, { fontSize: 12 });
  const outs = Q.map((c, i) => {
    const xq = 480 + i * 36;
    const qn = t.add({ x: xq, y: 254, w: 16, h: 16, radius: 2, fill: c, stroke: '#333333', strokeWidth: 1 });
    t.link(qn, at(t, xq + 8, 235.5), 'top', 'bottom', small);
    const o = t.add({ x: xq, y: 52, w: 16, h: 16, radius: 2, fill: c, stroke: '#333333', strokeWidth: 1 });
    t.link(at(t, xq + 8, 95.5), o, 'top', 'bottom', small);
    return o;
  });
  // teste: FFN condivisa → classe e box, oppure "nessun oggetto"
  outs.forEach((o, i) => {
    const y = 40 + i * 68;
    const ffn = t.box('FFN', 742, y + 4, 56, 34, PLAIN, { fontSize: 13 });
    const res = t.box(i % 2 ? 'no\nobject' : 'class,\nbox', 824, y, 100, 42, { fill: '#FFFFFF', stroke: Q[i] }, { fontSize: 12, strokeWidth: 2.4, radius: 6 });
    t.link(o, ffn, 'top', 'left', { ...small, routing: 'curve' });
    t.link(ffn, res, 'right', 'left', small);
  });
  scene(t, 'boxes', '', 956, 40, 180, 230, { fill: 'none' });
  return t.done();
}

/** Kirillov et al. 2023 (Segment Anything), arXiv 2304.02643, Fig. 4: image encoder pesante, prompt encoder e mask decoder leggeri. */
function sam() {
  const t = new Builder();
  const LINE = { color: INK, width: 1 };
  const img = scene(t, 'photo', 'image', 0, 18, 120, 90, { fontSize: 12 });
  const enc = t.box('image\nencoder', 160, 0, 200, 126, { fill: '#DDF5D0', stroke: '#86C96B' }, { fontSize: 13, strokeWidth: 1.5, radius: 2 });
  const cells = [0, 1, 2, 3, 4].map((i) => t.add({ x: 398, y: 8 + i * 20, w: 14, h: 14, radius: 1, fill: '#DADADA', stroke: '#9E9E9E', strokeWidth: 1 }));
  t.text('image\nembedding', 370, 112, 70, 32, { fontSize: 11 });
  const plus = t.op('+', 449, 23, { w: 22, h: 22, fontSize: 14 });
  const mdec = t.box('mask decoder', 506, 20, 170, 28, ORANGE, { fontSize: 12, radius: 2 });
  const penc = t.box('prompt encoder', 526, 88, 150, 28, PURPLE, { fontSize: 12, radius: 2 });
  const conv = t.add({ shape: 'trapezoid', direction: 'top', label: 'conv', x: 438, y: 86, w: 44, h: 30, radius: 3, fontSize: 11, strokeWidth: 1.2, ...PURPLE });
  t.link(img, enc, 'right', 'left', LINE);
  t.link(enc, at(t, 397.5, 63), 'right', 'left', LINE);
  t.link(at(t, 412.5, 34), plus, 'right', 'left', { ...LINE, arrowEnd: false });
  t.link(plus, mdec, 'right', 'left', LINE);
  t.link(conv, plus, 'top', 'bottom', LINE);
  t.link(at(t, 571, 87.5), at(t, 571, 48.5), 'top', 'bottom', LINE);
  t.link(at(t, 631, 87.5), at(t, 631, 48.5), 'top', 'bottom', LINE);
  const inputs: [string, number, N][] = [['mask', cx(conv), conv], ['points', 556, penc], ['box', 601, penc], ['text', 646, penc]];
  for (const [s, px, target] of inputs) {
    const lab = t.text(s, px - 25, 140, 50, 20, { fontSize: 11 });
    t.link(lab, target === conv ? conv : at(t, px, 116.5), 'top', 'bottom', LINE);
  }
  // tre maschere valide (oggetto intero, parte, sotto-parte), ciascuna con il suo punteggio
  ['mask', 'part', 'sub'].forEach((sp, i) => {
    const m = scene(t, sp, i === 2 ? 'valid masks' : '', 730, -26 + i * 64, 76, 56, { fontSize: 11 });
    t.link(mdec, m, 'right', 'left', LINE);
    t.text(', score', 808, m.y + 18, 50, 20, { fontSize: 11, align: 'left' });
  });
  void cells;
  return t.done();
}

/** Huang et al. 2017 (DenseNet), arXiv 1608.06993, Fig. 1 (dense block a 5 layer, k = 4) e Fig. 2 (rete con tre dense block). */
function denseNet() {
  const t = new Builder();
  const PAL: Color[] = [RED, GREEN, PURPLE, YELLOW, BLUE];
  const P = 160, Y = 120;
  const maps = PAL.map((c, i) => t.add({ shape: 'stack', label: `$x_${i}$`, count: 4, x: i * P, y: Y, w: 46, h: 64, strokeWidth: 1, ...ICON, fontSize: 14, ...c }));
  const H = [1, 2, 3, 4].map((j) => {
    const b = t.box('BN-ReLU-\nConv', (j - 1) * P + 74, Y + 12, 64, 40, WHITE, { fontSize: 10 });
    t.text(`$H_${j}$`, b.x, b.y + b.w * 0 + 44, 64, 20, { fontSize: 13 });
    return b;
  });
  const trans = t.box('Transition\nLayer', 4 * P + 74, Y + 7, 84, 50, GRAY, { fontSize: 11 });
  for (let i = 0; i < 4; i++) {
    t.link(maps[i], H[i], 'right', 'left');
    t.link(H[i], maps[i + 1], 'right', 'left');
  }
  t.link(maps[4], trans, 'right', 'left');
  // connessioni dense: ogni x_i entra in tutti i layer successivi (concatenazione)
  const targets = [...H, trans];
  maps.slice(0, 4).forEach((m, i) => {
    for (let j = i + 1; j < 5; j++) {
      const tg = targets[j];
      const tx = tg.x + 8 + i * ((tg.w - 16) / 3);
      t.link(at(t, m.x + 12 + i * 3, m.y), at(t, tx, tg.y - 0.5), 'top', 'top', { routing: 'curve', color: m.stroke, width: 1.2 });
    }
  });
  t.text('A 5-layer dense block with growth rate $k = 4$: each layer takes all preceding feature-maps as input.', 0, Y + 108, 800, 20, { fontSize: 12, textColor: NOTE });
  // la rete completa
  const y2 = 300;
  const TEALB = { fill: '#FFFFFF', stroke: '#2F8F83' };
  const thin = (s: string, x: number) => t.box(s, x, y2 + 14, 40, 70, WHITE, { fontSize: 10, radius: 3 });
  const block = (k: number, x: number) => {
    const g = t.box('', x, y2, 190, 98, TEALB, { strokeWidth: 1.5, radius: 2 });
    t.text(`Dense Block ${k}`, x, y2 + 8, 190, 22, { fontSize: 13 });
    t.add({ shape: 'dlg-dense', count: 5, x: x + 22, y: y2 + 40, w: 146, h: 46, fill: '#8A8A8A', stroke: '#555555' });
    return g;
  };
  const inp = scene(t, 'photo', 'Input', 0, y2 + 14, 70, 70, { labelPos: 'above', fontSize: 12 });
  const seq: N[] = [inp, thin('Conv', 92), block(1, 154), thin('Conv', 366), thin('Pool', 424), block(2, 486), thin('Conv', 698), thin('Pool', 756), block(3, 818), thin('Pool', 1030), thin('Linear', 1088)];
  const pred = t.box('"horse"', 1152, y2 + 27, 90, 44, TEALB, { fontSize: 14, italic: true, strokeWidth: 1.5, radius: 2 });
  t.text('Prediction', 1152, y2 + 2, 90, 20, { fontSize: 12 });
  t.chain([...seq, pred], 'right', { color: '#4A86D9', width: 1.5 });
  return t.done();
}

const G = (id: string, name: string, build: TemplateDef['build']): TemplateDef => ({ id, name, section: GEN, build });
const V = (id: string, name: string, build: TemplateDef['build']): TemplateDef => ({ id, name, section: VISION, build });

export const DLG_TEMPLATES: TemplateDef[] = [
  G('dlg-vqvae', 'VQ-VAE (van den Oord 2017)', vqvae),
  G('dlg-stylegan', 'StyleGAN (Karras 2019)', styleGan),
  G('dlg-pix2pix', 'pix2pix (Isola 2017)', pix2pix),
  G('dlg-controlnet', 'ControlNet (Zhang 2023)', controlNet),
  G('dlg-score-sde', 'Score SDE (Song 2021)', scoreSde),
  G('dlg-rectflow', 'Rectified flow (Liu 2023)', rectifiedFlow),
  G('dlg-realnvp', 'RealNVP (Dinh 2017)', realNvp),
  G('dlg-consistency', 'Consistency models (Song 2023)', consistency),
  V('dlg-nerf', 'NeRF (Mildenhall 2020)', nerf),
  V('dlg-3dgs', '3D Gaussian Splatting (Kerbl 2023)', gaussianSplatting),
  V('dlg-mae', 'Masked autoencoder (He 2022)', mae),
  V('dlg-dino', 'DINO (Caron 2021)', dino),
  V('dlg-moco', 'MoCo (He 2020)', moco),
  V('dlg-detr', 'DETR (Carion 2020)', detr),
  V('dlg-sam', 'Segment Anything (Kirillov 2023)', sam),
  V('dlg-densenet', 'DenseNet (Huang 2017)', denseNet),
];
