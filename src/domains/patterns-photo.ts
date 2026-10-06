// "Fotografie" procedurali del modulo pattern recognition & CV: scena stradale in
// prospettiva (stile dashcam/Cityscapes), pedone e ritratto. Ogni oggetto è un `Item`
// con la sua classe (e l'istanza per persone e auto), così la stessa geometria produce
// la foto, i grigi, la segmentazione semantica e per istanze, i box di detection, la
// mappa dei bordi. Gli elementi `soft` (ombre, luci, foschia, grana) esistono solo nella
// foto. Deterministico; i dettagli troppo piccoli per il riquadro vengono omessi.
import { arc, blob, mix, poly, rng, roundPoly, smooth, type Box, type Cmd, type Part } from '../draw';
import { VIVID, area, clamp, gray, has, hsv, line, rect, rectCmds, rotEllipse, type P2 } from './patterns-art';

const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const add2 = (a: P2, dx: number, dy: number): P2 => [a[0] + dx, a[1] + dy];
const dark = (c: string, k = 0.22) => mix(c, '#000000', k);
const light = (c: string, k = 0.25) => mix(c, '#FFFFFF', k);

export interface Item {
  cmds: Cmd[];
  cls: string;
  color: string;
  /** Istanza (oggetti numerabili: persone, auto). */
  inst?: number;
  /** Dettaglio con classe propria (finestre, strisce): non entra nelle mappe di segmentazione. */
  detail?: boolean;
  /** Solo fotografico (ombre, luci, foschia, grana): niente segmentazione, bordi, box. */
  soft?: boolean;
  /** Disegnato come linea di questo spessore invece che come area. */
  line?: number;
  /** Sfondo: escluso dalla mappa dei bordi. */
  bg?: boolean;
}

/** Capsula rastremata da a (raggio ra) a b (raggio rb). */
export function taper(a: P2, b: P2, ra: number, rb: number): Cmd[] {
  const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const c1 = arc(b[0], b[1], rb, th - Math.PI / 2, th + Math.PI / 2);
  const c2 = arc(a[0], a[1], ra, th + Math.PI / 2, th + (3 * Math.PI) / 2);
  return [...c1, ['L', c2[0][1] as number, c2[0][2] as number], ...c2.slice(1), ['Z']];
}

// ======================================================================
// Persone: posa a 17 punti (COCO), altezza normalizzata a 1
// ======================================================================

/** Punti chiave COCO: naso, occhi, orecchie, spalle, gomiti, polsi, anche, ginocchia, caviglie (sx/dx della persona). */
export type Pose = P2[];

export const POSES: Pose[] = [
  // in cammino
  [[0, 0.1], [0.022, 0.082], [-0.022, 0.082], [0.05, 0.09], [-0.05, 0.09], [0.1, 0.2], [-0.1, 0.2], [0.13, 0.35], [-0.135, 0.345], [0.14, 0.49], [-0.155, 0.48],
    [0.065, 0.52], [-0.065, 0.52], [0.08, 0.74], [-0.09, 0.735], [0.085, 0.95], [-0.12, 0.945]],
  // saluta con il braccio alzato
  [[0, 0.1], [0.022, 0.082], [-0.022, 0.082], [0.05, 0.09], [-0.05, 0.09], [0.1, 0.2], [-0.1, 0.2], [0.14, 0.34], [-0.19, 0.17], [0.16, 0.48], [-0.22, 0.04],
    [0.065, 0.52], [-0.065, 0.52], [0.075, 0.74], [-0.08, 0.74], [0.095, 0.95], [-0.095, 0.95]],
  // corre
  [[0.012, 0.1], [0.032, 0.082], [-0.01, 0.082], [0.055, 0.09], [-0.035, 0.09], [0.1, 0.2], [-0.09, 0.2], [0.16, 0.31], [-0.15, 0.33], [0.22, 0.23], [-0.2, 0.43],
    [0.065, 0.52], [-0.06, 0.52], [0.15, 0.7], [-0.04, 0.74], [0.08, 0.91], [-0.18, 0.9]],
];

/** Arti per lo scheletro, nello stile multicolore di OpenPose. */
export const LIMBS: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];
export const limbColor = (i: number) => hsv((i / LIMBS.length) * 300, 0.85, 0.95);

export interface PersonStyle {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
}

export const PEOPLE: PersonStyle[] = [
  { skin: '#E3B391', hair: '#3B2A20', shirt: '#3E6F9E', pants: '#2F3746', shoes: '#2A2522' },
  { skin: '#C08865', hair: '#1E1B19', shirt: '#C9772E', pants: '#4A4A52', shoes: '#ECECEC' },
  { skin: '#EFC6A2', hair: '#8A5A2B', shirt: '#5D8C63', pants: '#38405A', shoes: '#5B3A25' },
  { skin: '#8A5838', hair: '#151515', shirt: '#A6463A', pants: '#28282F', shoes: '#1C1C1C' },
];

/** Posizione dei punti chiave: origine = centro della testa in alto, s = altezza in pixel. */
export const joints = (pose: Pose, ox: number, oy: number, s: number): P2[] => pose.map(([u, v]) => [ox + u * s, oy + v * s]);

/** Persona vestita costruita sulla posa: proporzioni (testa ≈ 1/7.5), ombreggiature e pieghe se abbastanza grande. */
export function personItems(pose: Pose, ox: number, oy: number, s: number, st: PersonStyle, inst?: number): Item[] {
  const J = joints(pose, ox, oy, s);
  const items: Item[] = [];
  const it = (cmds: Cmd[], color: string, o: Partial<Item> = {}) => items.push({ cmds, color, cls: 'person', inst, ...o });
  const rich = s > 38; // ombre e pieghe solo se si vedono
  const face = s > 150;
  const softP = (cmds: Cmd[], color: string) => rich && it(cmds, color, { soft: true });
  const softL = (cmds: Cmd[], color: string, w: number) => rich && it(cmds, color, { soft: true, line: w });
  const H: P2 = [J[0][0], oy + 0.072 * s];
  const rh = 0.062 * s;
  // gambe (prima quella più lontana), scarpe
  for (const [hip, knee, ank] of [[12, 14, 16], [11, 13, 15]]) {
    const shift = hip === 12 ? -1 : 1;
    it(taper(add2(J[hip], shift * 0.006 * s, 0), J[knee], 0.05 * s, 0.038 * s), st.pants);
    it(taper(J[knee], J[ank], 0.038 * s, 0.03 * s), st.pants);
    softP(taper(add2(J[hip], -0.02 * s, 0.01 * s), add2(J[knee], -0.016 * s, 0), 0.018 * s, 0.014 * s), dark(st.pants, 0.25));
    softP(taper(add2(J[knee], -0.014 * s, 0), add2(J[ank], -0.011 * s, 0), 0.014 * s, 0.011 * s), dark(st.pants, 0.25));
    softL(smooth([add2(J[knee], -0.025 * s, -0.01 * s), add2(J[knee], 0, 0.006 * s), add2(J[knee], 0.022 * s, -0.004 * s)], false), dark(st.pants, 0.35), 0.006 * s);
    const dir = J[ank][0] >= J[knee][0] ? 1 : -1;
    it(rotEllipse(J[ank][0] + dir * 0.02 * s, J[ank][1] + 0.02 * s, 0.045 * s, 0.022 * s, 0), st.shoes);
    softP(rotEllipse(J[ank][0] + dir * 0.03 * s, J[ank][1] + 0.012 * s, 0.022 * s, 0.008 * s, 0), light(st.shoes, 0.3));
  }
  // busto
  const nb = lerp2(J[5], J[6], 0.5);
  const torso: P2[] = [add2(J[6], -0.028 * s, -0.004 * s), add2(J[5], 0.028 * s, -0.004 * s), add2(J[11], 0.018 * s, 0.035 * s), add2(J[12], -0.018 * s, 0.035 * s)];
  it(roundPoly(torso, 0.035 * s), st.shirt);
  softP(roundPoly([torso[0], lerp2(torso[0], torso[1], 0.33), lerp2(torso[3], torso[2], 0.3), torso[3]], 0.03 * s), dark(st.shirt, 0.16));
  softP(rotEllipse(lerp2(J[5], J[11], 0.3)[0] - 0.01 * s, lerp2(J[5], J[11], 0.3)[1], 0.03 * s, 0.07 * s, 0.1), light(st.shirt, 0.12));
  softL([['M', ...add2(nb, 0, 0.03 * s)], ['L', ...lerp2(J[11], J[12], 0.5)]] as Cmd[], dark(st.shirt, 0.28), 0.007 * s);
  softL(smooth([add2(lerp2(J[12], J[11], 0.2), 0, -0.07 * s), add2(lerp2(J[12], J[11], 0.38), 0, -0.035 * s), add2(lerp2(J[12], J[11], 0.42), 0, -0.01 * s)], false), dark(st.shirt, 0.3), 0.006 * s);
  softL(smooth([add2(lerp2(J[12], J[11], 0.62), 0, -0.05 * s), add2(lerp2(J[12], J[11], 0.75), 0, -0.02 * s)], false), dark(st.shirt, 0.3), 0.006 * s);
  softL([['M', ...add2(J[12], -0.012 * s, 0.03 * s)], ['L', ...add2(J[11], 0.012 * s, 0.03 * s)]] as Cmd[], dark(st.pants, 0.45), 0.012 * s);
  // collo e braccia
  it(taper(add2(H, 0, rh * 0.75), add2(nb, 0, 0.004 * s), 0.024 * s, 0.028 * s), dark(st.skin, 0.12));
  softP(rotEllipse(H[0], H[1] + rh * 1.05, 0.025 * s, 0.01 * s, 0), dark(st.skin, 0.3));
  for (const [sho, elb, wri] of [[6, 8, 10], [5, 7, 9]]) {
    it(taper(J[sho], J[elb], 0.034 * s, 0.027 * s), st.shirt);
    it(taper(J[elb], J[wri], 0.027 * s, 0.021 * s), dark(st.shirt, 0.08));
    softP(taper(add2(J[sho], -0.012 * s, 0.01 * s), add2(J[elb], -0.01 * s, 0), 0.012 * s, 0.01 * s), dark(st.shirt, 0.22));
    softL(smooth([add2(J[elb], -0.02 * s, -0.008 * s), add2(J[elb], 0.002 * s, 0.006 * s), add2(J[elb], 0.018 * s, -0.004 * s)], false), dark(st.shirt, 0.32), 0.005 * s);
    it(rotEllipse(J[wri][0], J[wri][1] + 0.012 * s, 0.021 * s, 0.027 * s, 0), st.skin);
  }
  // testa: orecchie, viso, capelli
  it(rotEllipse(H[0] - rh * 0.92, H[1] + rh * 0.1, rh * 0.18, rh * 0.28, 0), dark(st.skin, 0.06));
  it(rotEllipse(H[0] + rh * 0.92, H[1] + rh * 0.1, rh * 0.18, rh * 0.28, 0), dark(st.skin, 0.06));
  it(smooth([add2(H, 0, -rh), add2(H, rh * 0.9, -rh * 0.45), add2(H, rh * 0.86, rh * 0.45), add2(H, rh * 0.4, rh * 0.95), add2(H, 0, rh * 1.08), add2(H, -rh * 0.4, rh * 0.95), add2(H, -rh * 0.86, rh * 0.45), add2(H, -rh * 0.9, -rh * 0.45)]), st.skin);
  softP(smooth([add2(H, -rh * 0.9, -rh * 0.3), add2(H, -rh * 0.55, rh * 0.2), add2(H, -rh * 0.38, rh * 0.92), add2(H, -rh * 0.86, rh * 0.5)]), dark(st.skin, 0.12));
  it(smooth([add2(H, -rh * 0.97, rh * 0.15), add2(H, -rh * 1.02, -rh * 0.55), add2(H, -rh * 0.45, -rh * 1.12), add2(H, rh * 0.4, -rh * 1.14), add2(H, rh * 1.02, -rh * 0.55), add2(H, rh * 0.96, rh * 0.12), add2(H, rh * 0.75, -rh * 0.35), add2(H, 0, -rh * 0.55), add2(H, -rh * 0.75, -rh * 0.35)]), st.hair);
  softL(smooth([add2(H, -rh * 0.5, -rh * 0.85), add2(H, rh * 0.1, -rh * 0.98), add2(H, rh * 0.6, -rh * 0.75)], false), light(st.hair, 0.3), 0.012 * s);
  if (face) {
    for (const sx of [-1, 1]) {
      it(rotEllipse(H[0] + sx * rh * 0.35, H[1] + rh * 0.12, rh * 0.11, rh * 0.06, 0), '#2A2320', { detail: true });
      it(smooth([add2(H, sx * rh * 0.18, -rh * 0.1), add2(H, sx * rh * 0.36, -rh * 0.16), add2(H, sx * rh * 0.55, -rh * 0.1)], false), dark(st.hair, 0.1), { detail: true, line: 0.012 * s });
    }
    it([['M', ...add2(H, -rh * 0.22, rh * 0.62)], ['L', ...add2(H, rh * 0.22, rh * 0.62)]] as Cmd[], dark(st.skin, 0.4), { detail: true, line: 0.007 * s });
    softP(smooth([add2(H, rh * 0.02, rh * 0.1), add2(H, rh * 0.1, rh * 0.42), add2(H, -rh * 0.06, rh * 0.45)]), dark(st.skin, 0.15));
  }
  return items;
}

// ======================================================================
// Scena stradale in prospettiva
// ======================================================================

const HAZE = '#C7D4DF';
const CAR_COLORS = ['#C0392B', '#2E5C8A', '#D9A21B', '#3E7D5A', '#6B7078'];

function streetItems(b: Box, variant: number): Item[] {
  const VX = 0.5, VY = 0.47, G = 1 - VY;
  const U = (u: number, v: number): P2 => [b.x + u * b.w, b.y + v * b.h];
  /** Punto del mondo: laterale X (larghezze immagine al piano vicino), profondità z ≥ 1, altezza H. */
  const P = (X: number, z: number, H = 0): P2 => U(VX + (X - VX) / z, VY + (G - H) / z);
  const px = (h: number, z: number) => (h / z) * b.h; // altezza in pixel di h alla profondità z
  const haze = (c: string, z: number) => mix(c, HAZE, clamp((z - 1.6) / 9, 0, 0.72));
  const vr = Math.abs(Math.round(variant)) % CAR_COLORS.length;
  const rand = rng(97 + vr * 31);
  const items: Item[] = [];
  const add = (cmds: Cmd[], cls: string, color: string, o: Partial<Item> = {}) => items.push({ cmds, cls, color, ...o });
  const soft = (cmds: Cmd[], cls: string, color: string, o: Partial<Item> = {}) => add(cmds, cls, color, { soft: true, ...o });
  const q = (pts: P2[]) => poly(pts);

  // ---- cielo: gradiente a bande, nuvole
  add(rectCmds(b.x - 1, b.y - 1, b.w + 2, (VY + 0.03) * b.h + 1), 'sky', '#6FA4D8', { bg: true });
  for (let i = 1; i < 9; i++) soft(rectCmds(b.x - 1, b.y + (i / 9) * (VY + 0.03) * b.h, b.w + 2, (1 - i / 9) * (VY + 0.03) * b.h + 1), 'sky', mix('#6FA4D8', '#E2ECF4', (i / 8) ** 1.3));
  for (const [cu, cv, sc] of [[0.27, 0.1, 1], [0.7, 0.19, 0.75]]) {
    const R = 0.05 * sc * b.h;
    const cx = b.x + cu * b.w, cy = b.y + cv * b.h;
    soft(rotEllipse(cx, cy + R * 0.35, R * 2.6, R * 0.6, 0), 'sky', '#D9E4EE');
    for (const [dx, dy, r] of [[-1.5, 0.1, 0.8], [-0.5, -0.35, 1.05], [0.6, -0.2, 0.9], [1.5, 0.15, 0.7]]) soft(rotEllipse(cx + dx * R, cy + dy * R, r * R, r * R * 0.8, 0), 'sky', '#F6F9FC');
  }
  // ---- skyline lontano (foschia) e strada
  const sky: [number, number, number][] = [[0.36, 0.42, 0.33], [0.41, 0.47, 0.37], [0.46, 0.52, 0.3], [0.51, 0.56, 0.35], [0.55, 0.61, 0.39], [0.6, 0.65, 0.34]];
  sky.forEach(([u0, u1, top], i) => add(q([U(u0, top), U(u1, top), U(u1, VY + 0.01), U(u0, VY + 0.01)]), 'building', i % 2 ? '#AEBFCD' : '#B8C7D3'));
  const XL = -0.32, XR = 1.32, KL = 0.07, KR = 0.93;
  const far = 60;
  add(q([P(KL, far), P(KR, far), U(KR + 0.2, 1.02), U(KL - 0.2, 1.02)]), 'road', '#6C6F76');
  for (const [z0, k] of [[2.4, 0.18], [4, 0.36], [8, 0.55]]) soft(q([P(KL, far), P(KR, far), P(KR, z0), P(KL, z0)]), 'road', mix('#6C6F76', HAZE, k));
  // marciapiedi e cordoli
  add(q([P(XL, far), P(KL, far), U(KL - 0.2, 1.02), U(XL - 0.2, 1.02)]), 'sidewalk', '#BDB5A8');
  add(q([P(KR, far), P(XR, far), U(XR + 0.2, 1.02), U(KR + 0.2, 1.02)]), 'sidewalk', '#C3BCB0');
  for (const z of [1.25, 1.6, 2.05, 2.7, 3.6, 5]) {
    soft(q([P(XL, z), P(KL, z), P(KL, z + 0.012 * z), P(XL, z + 0.012 * z)]), 'sidewalk', '#A9A194');
    soft(q([P(KR, z), P(XR, z), P(XR, z + 0.012 * z), P(KR, z + 0.012 * z)]), 'sidewalk', '#ADA699');
  }
  add(q([P(KL, far, 0.02), P(KL - 0.015, far, 0.02), U(KL - 0.2 - 0.015, 1.02 - 0.02), U(KL - 0.2, 1.02)]), 'sidewalk', '#DAD5CC');
  add(q([P(KR, far, 0.02), P(KR + 0.015, far, 0.02), U(KR + 0.2 + 0.015, 1.02 - 0.02), U(KR + 0.2, 1.02)]), 'sidewalk', '#9E978B');
  // segnaletica: linee di bordo, mezzeria tratteggiata, strisce pedonali
  for (const X of [0.115, 0.875]) add(q([P(X, far), P(X + 0.012, far), P(X + 0.012, 1), P(X, 1)]), 'road', '#E9E9E4', { detail: true });
  for (let z = 1; z < 14; z += 0.9 * (1 + (z - 1) * 0.15)) {
    const z1 = z + 0.42 * (1 + (z - 1) * 0.15);
    if (px(0.01, z) < 0.25) break;
    add(q([P(0.492, z), P(0.508, z), P(0.508, z1), P(0.492, z1)]), 'road', '#EDEDE8', { detail: true });
  }
  for (let X = 0.16; X < 0.86; X += 0.1) add(q([P(X, 3.1), P(X + 0.05, 3.1), P(X + 0.05, 3.55), P(X, 3.55)]), 'road', '#E4E4DF', { detail: true });
  // grana dell'asfalto
  if (b.w > 60) {
    for (let i = 0; i < 70; i++) {
      const z = 1 + rand() ** 1.5 * 3, X = KL + rand() * (KR - KL);
      const [cx, cy] = P(X, z);
      soft(rotEllipse(cx, cy, (0.5 + rand()) / z * b.w * 0.006, (0.4 + rand() * 0.5) / z * b.h * 0.004, 0), 'road', rand() < 0.5 ? '#62656C' : '#7A7D84');
    }
  }

  // ---- facciate in prospettiva (sole da destra: lato sinistro illuminato)
  type Bld = [number, number, number, string];
  const LEFT: Bld[] = [[1, 2.3, 1.75, '#C8B596'], [2.3, 3.3, 1.2, '#B79F9B'], [3.3, 4.8, 1.55, '#D3C4A6'], [4.8, 7.5, 1.05, '#A8AEB8'], [7.5, 16, 1.3, '#BCB1A0']];
  const RIGHT: Bld[] = [[1, 2.1, 1.45, '#B3A08A'], [2.1, 3.7, 2.05, '#C5C9D0'], [3.7, 5.4, 1.15, '#C8AC92'], [5.4, 8.5, 1.5, '#ABB4B8'], [8.5, 16, 1.1, '#C0B6A6']];
  const AWNING = ['#A8473A', '#3E7656', '#2F5C8A'];
  const facade = (X: number, dir: number, list: Bld[]) => {
    const lit = dir < 0;
    for (let k = list.length - 1; k >= 0; k--) {
      const [z0, z1, H, base] = list[k];
      const zm = (z0 + z1) / 2;
      const c = haze(lit ? base : mix(base, '#4B505A', 0.24), zm);
      const prevH = k > 0 ? list[k - 1][2] : 0;
      if (k > 0 && H > prevH) add(q([P(X, z0, prevH), P(X + dir * 0.7, z0, prevH), P(X + dir * 0.7, z0, H), P(X, z0, H)]), 'building', haze(mix(base, '#5A606B', lit ? 0.32 : 0.1), z0));
      add(q([P(X, z0, 0), P(X, z1, 0), P(X, z1, H), P(X, z0, H)]), 'building', c);
      // luce che cala verso il basso, cornicione, zoccolo
      soft(q([P(X, z0, 0), P(X, z1, 0), P(X, z1, 0.45), P(X, z0, 0.45)]), 'building', dark(c, 0.07));
      add(q([P(X, z0, H - 0.05), P(X, z1, H - 0.05), P(X, z1, H), P(X, z0, H)]), 'building', dark(c, 0.2), { detail: true });
      add(q([P(X, z0, 0.42), P(X, z1, 0.42), P(X, z1, 0.45), P(X, z0, 0.45)]), 'building', dark(c, 0.12), { detail: true });
      // vetrine al piano terra con riflessi e montanti, tenda
      if (px(0.3, zm) > 1.5) {
        const za = z0 + 0.12 * (z1 - z0), zb = z1 - 0.12 * (z1 - z0);
        const g = haze('#3E4E5E', zm);
        add(q([P(X, za, 0.06), P(X, zb, 0.06), P(X, zb, 0.36), P(X, za, 0.36)]), 'building', g, { detail: true });
        soft(q([P(X, za, 0.24), P(X, zb, 0.3), P(X, zb, 0.36), P(X, za, 0.36)]), 'building', light(g, 0.22));
        const mull: Cmd[] = [];
        for (let z = za + 0.45; z < zb - 0.1; z += 0.45) mull.push(['M', ...P(X, z, 0.06)], ['L', ...P(X, z, 0.36)]);
        if (mull.length) soft(mull, 'building', dark(c, 0.15), { line: Math.max(0.4, px(0.012, zm)) });
        if (k % 2 === 0) add(q([P(X, za, 0.42), P(X, zb, 0.42), P(X - dir * 0.07, zb, 0.36), P(X - dir * 0.07, za, 0.36)]), 'building', haze(AWNING[k % 3], zm), { detail: true });
      }
      // finestre ai piani
      for (let f = 1; f * 0.5 + 0.38 < H - 0.05; f++) {
        const h0 = f * 0.5 + 0.12, h1 = h0 + 0.26;
        for (let zc = z0 + 0.32; zc + 0.13 < z1 - 0.06; zc += 0.6) {
          if (px(0.26, zc) < 1.4) continue;
          const pts = [P(X, zc - 0.13, h0), P(X, zc + 0.13, h0), P(X, zc + 0.13, h1), P(X, zc - 0.13, h1)];
          if (pts.every((p) => p[0] < b.x - 1 || p[0] > b.x + b.w + 1)) continue;
          const glass = haze(rand() < 0.28 ? '#8DA7BD' : '#4A5F73', zc);
          add(q(pts), 'building', glass, { detail: true });
          if (px(0.26, zc) > 4) {
            soft(q([pts[3], pts[2], lerp2(pts[1], pts[2], 0.45)]), 'building', light(glass, 0.18));
            soft(q([pts[0], pts[1], P(X, zc + 0.13, h0 - 0.03), P(X, zc - 0.13, h0 - 0.03)]), 'building', light(c, 0.25));
          }
        }
      }
    }
  };
  facade(XR, 1, RIGHT);
  facade(XL, -1, LEFT);

  // ---- arredo: alberi, lampione, cartello
  const tree = (X: number, z: number, scale: number, seed: number) => {
    const tr = rng(seed);
    const [bx, by] = P(X, z);
    const s = px(1, z) * scale;
    soft(rotEllipse(bx - s * 0.08, by + s * 0.01, s * 0.16, s * 0.025, 0), 'sidewalk', '#8F887C');
    add(roundPoly([[bx - s * 0.018, by], [bx + s * 0.018, by], [bx + s * 0.012, by - s * 0.5], [bx - s * 0.012, by - s * 0.5]], s * 0.004), 'vegetation', haze('#6B4B2E', z));
    if (s > 30) soft([['M', bx, by - s * 0.42], ['L', bx + s * 0.08, by - s * 0.56], ['M', bx, by - s * 0.38], ['L', bx - s * 0.07, by - s * 0.5]], 'vegetation', haze('#5B3F27', z), { line: s * 0.01 });
    const cy = by - s * 0.68, R = s * 0.2;
    add(blob(bx, cy, R * 1.1, R, 0.2, 0.18, tr, 12), 'vegetation', haze('#3F6A2C', z));
    if (s > 12) {
      soft(blob(bx + R * 0.15, cy - R * 0.12, R * 0.8, R * 0.7, 0.4, 0.22, tr, 10), 'vegetation', haze('#55863A', z));
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * (0.15 + 0.6 * tr()), d = R * (0.25 + 0.5 * tr());
        soft(blob(bx + Math.cos(a) * d, cy + Math.sin(a) * d, R * 0.3, R * 0.24, tr() * 3, 0.25, tr, 8), 'vegetation', haze(i % 2 ? '#79AE4E' : '#6A9C45', z));
      }
      soft(blob(bx - R * 0.45, cy + R * 0.35, R * 0.4, R * 0.25, 0.3, 0.25, tr, 8), 'vegetation', haze('#2F5222', z));
    }
  };
  tree(XL + 0.12, 4.6, 1.05, 11);
  tree(XR - 0.13, 3.0, 1.0, 23);
  tree(XR - 0.12, 1.35, 1.0, 37);
  const [lx, ly] = P(KL - 0.05, 2.0);
  const lh = px(0.95, 2);
  add(roundPoly([[lx - lh * 0.012, ly], [lx + lh * 0.012, ly], [lx + lh * 0.008, ly - lh], [lx - lh * 0.008, ly - lh]], 0.5), 'pole', '#5E6266');
  add([['M', lx, ly - lh * 0.98], ['C', lx, ly - lh * 1.06, lx + lh * 0.1, ly - lh * 1.06, lx + lh * 0.16, ly - lh * 1.02]], 'pole', '#5E6266', { line: Math.max(0.6, lh * 0.012) });
  add(rotEllipse(lx + lh * 0.17, ly - lh * 1.0, lh * 0.04, lh * 0.016, 0), 'pole', '#3E4246');
  const [sx, sy] = P(KR + 0.04, 2.25);
  const sh = px(0.5, 2.25), sr = px(0.06, 2.25);
  add(rectCmds(sx - sh * 0.012, sy - sh, sh * 0.024, sh), 'pole', '#8A8E92');
  add(rotEllipse(sx, sy - sh - sr * 0.6, sr, sr, 0), 'sign', '#D23B2E');
  add(rotEllipse(sx, sy - sh - sr * 0.6, sr * 0.72, sr * 0.72, 0), 'sign', '#F4F4F2', { detail: true });
  add(rectCmds(sx - sr * 0.5, sy - sh - sr * 0.6 - sr * 0.12, sr, sr * 0.24), 'sign', '#D23B2E', { detail: true });

  // ---- automobili (vista posteriore in prospettiva)
  const wheelSide = (X: number, zc: number, inst: number, z: number) => {
    const ring = (rz: number, rh: number): Cmd[] => smooth(Array.from({ length: 12 }, (_, i): P2 => {
      const a = (i / 12) * Math.PI * 2;
      return P(X, zc + Math.cos(a) * rz, 0.055 + Math.sin(a) * rh);
    }));
    add(ring(0.075, 0.064), 'car', '#26272A', { inst });
    add(ring(0.066, 0.056), 'car', '#1A1B1D', { inst });
    if (px(0.05, z) > 2.5) {
      add(ring(0.04, 0.034), 'car', '#B9BEC4', { inst, detail: true });
      soft(ring(0.025, 0.021), 'car', '#8C9196', { inst });
      soft(ring(0.01, 0.009), 'car', '#4A4D52', { inst });
    }
  };
  const car = (X0: number, X1: number, z0: number, L: number, color: string, inst: number) => {
    const W = X1 - X0;
    const z = z0;
    const c = haze(color, z);
    const big = px(0.24, z) > 14;
    // ombra a terra (sole da destra: verso sinistra)
    soft(q([P(X0 - 0.03, z0 - 0.02), P(X1 - 0.01, z0 - 0.02), P(X1 - 0.01, z0 + 0.92 * L), P(X0 - 0.03, z0 + 0.92 * L)]), 'road', mix('#6C6F76', '#1E1F22', 0.45));
    // fianco visibile (se l'auto è di lato rispetto all'asse)
    const sideX = X1 < VX ? X1 : X0 > VX ? X0 : NaN;
    if (!Number.isNaN(sideX)) {
      add(q([P(sideX, z0, 0.03), P(sideX, z0 + L, 0.03), P(sideX, z0 + L, 0.14), P(sideX, z0 + 0.82 * L, 0.15), P(sideX, z0 + 0.66 * L, 0.235), P(sideX, z0 + 0.2 * L, 0.235), P(sideX, z0 + 0.06 * L, 0.15), P(sideX, z0, 0.14)]), 'car', dark(c, 0.12), { inst });
      if (px(0.1, z) > 3) {
        add(q([P(sideX, z0 + 0.22 * L, 0.155), P(sideX, z0 + 0.43 * L, 0.155), P(sideX, z0 + 0.43 * L, 0.222), P(sideX, z0 + 0.24 * L, 0.222)]), 'car', haze('#56687A', z), { inst, detail: true });
        add(q([P(sideX, z0 + 0.46 * L, 0.155), P(sideX, z0 + 0.74 * L, 0.155), P(sideX, z0 + 0.64 * L, 0.222), P(sideX, z0 + 0.46 * L, 0.222)]), 'car', haze('#647789', z), { inst, detail: true });
        soft(q([P(sideX, z0 + 0.28 * L, 0.222), P(sideX, z0 + 0.36 * L, 0.222), P(sideX, z0 + 0.3 * L, 0.155), P(sideX, z0 + 0.24 * L, 0.155)]), 'car', '#8FA2B3', { inst });
        soft(q([P(sideX, z0, 0.11), P(sideX, z0 + L, 0.11), P(sideX, z0 + L, 0.125), P(sideX, z0, 0.125)]), 'car', light(c, 0.2), { inst });
        soft([['M', ...P(sideX, z0 + 0.45 * L, 0.04)], ['L', ...P(sideX, z0 + 0.45 * L, 0.15)]], 'car', dark(c, 0.35), { inst, line: Math.max(0.4, px(0.006, z)) });
      }
      wheelSide(sideX, z0 + 0.82 * L, inst, z);
      wheelSide(sideX, z0 + 0.2 * L, inst, z);
    }
    // gomme posteriori
    add(roundPoly([P(X0 + 0.004, z0 + 0.12, 0), P(X0 + 0.044, z0 + 0.12, 0), P(X0 + 0.044, z0 + 0.12, 0.07), P(X0 + 0.004, z0 + 0.12, 0.07)], 1), 'car', '#1C1D1F', { inst });
    add(roundPoly([P(X1 - 0.044, z0 + 0.12, 0), P(X1 - 0.004, z0 + 0.12, 0), P(X1 - 0.004, z0 + 0.12, 0.07), P(X1 - 0.044, z0 + 0.12, 0.07)], 1), 'car', '#1C1D1F', { inst });
    // tetto e lunotto (si vedono dall'alto), cofano posteriore
    const iw = 0.06 * W / 0.22;
    add(q([P(X0 + iw, z0 + 0.3 * L, 0.235), P(X1 - iw, z0 + 0.3 * L, 0.235), P(X1 - iw, z0 + 0.66 * L, 0.235), P(X0 + iw, z0 + 0.66 * L, 0.235)]), 'car', light(c, 0.18), { inst });
    add(q([P(X0 + 0.02, z0 + 0.1, 0.145), P(X1 - 0.02, z0 + 0.1, 0.145), P(X1 - iw, z0 + 0.3 * L, 0.235), P(X0 + iw, z0 + 0.3 * L, 0.235)]), 'car', haze('#2B3743', z), { inst, detail: true });
    if (big) soft(q([lerp2(P(X0 + 0.02, z0 + 0.1, 0.145), P(X1 - 0.02, z0 + 0.1, 0.145), 0.55), lerp2(P(X0 + 0.02, z0 + 0.1, 0.145), P(X1 - 0.02, z0 + 0.1, 0.145), 0.75), lerp2(P(X0 + iw, z0 + 0.3 * L, 0.235), P(X1 - iw, z0 + 0.3 * L, 0.235), 0.6), lerp2(P(X0 + iw, z0 + 0.3 * L, 0.235), P(X1 - iw, z0 + 0.3 * L, 0.235), 0.42)]), 'car', '#5D6C7A', { inst });
    add(q([P(X0, z0, 0.14), P(X1, z0, 0.14), P(X1 - 0.02, z0 + 0.1, 0.145), P(X0 + 0.02, z0 + 0.1, 0.145)]), 'car', light(c, 0.1), { inst });
    // retro della carrozzeria, paraurti, fari, targa
    add(roundPoly([P(X0, z0, 0.035), P(X1, z0, 0.035), P(X1, z0, 0.14), P(X0, z0, 0.14)], px(0.02, z)), 'car', c, { inst });
    soft(q([P(X0, z0, 0.12), P(X1, z0, 0.12), P(X1, z0, 0.14), P(X0, z0, 0.14)]), 'car', light(c, 0.22), { inst });
    add(roundPoly([P(X0 - 0.003, z0, 0.03), P(X1 + 0.003, z0, 0.03), P(X1 + 0.003, z0, 0.065), P(X0 - 0.003, z0, 0.065)], px(0.01, z)), 'car', '#2A2B2E', { inst });
    add(q([P(X0 + 0.008, z0, 0.095), P(X0 + 0.05 * W / 0.22, z0, 0.095), P(X0 + 0.05 * W / 0.22, z0, 0.125), P(X0 + 0.008, z0, 0.125)]), 'car', haze('#E0332B', z), { inst, detail: true });
    add(q([P(X1 - 0.05 * W / 0.22, z0, 0.095), P(X1 - 0.008, z0, 0.095), P(X1 - 0.008, z0, 0.125), P(X1 - 0.05 * W / 0.22, z0, 0.125)]), 'car', haze('#E0332B', z), { inst, detail: true });
    if (px(0.03, z) > 2) add(rectCmds(...P(VX + (X0 + X1) / 2 - VX - 0.026, z0, 0.085), (0.052 / z) * b.w, px(0.022, z)), 'car', '#EEF0EE', { inst, detail: true });
    if (big) soft(q([P(X0 + 0.01, z0, 0.04), P(X1 - 0.01, z0, 0.04), P(X1 - 0.01, z0, 0.05), P(X0 + 0.01, z0, 0.05)]), 'car', '#45474B', { inst });
  };
  car(0.6, 0.79, 4.3, 0.95, CAR_COLORS[(vr + 2) % 5], 2);
  car(0.55, 0.79, 1.75, 0.95, CAR_COLORS[vr], 0);
  car(0.11, 0.33, 1.3, 0.95, CAR_COLORS[(vr + 1) % 5], 1);

  // ---- pedoni con ombra
  const walker = (pose: Pose, X: number, z: number, st: PersonStyle, inst: number) => {
    const [fx, fy] = P(X, z);
    const s = px(0.3, z);
    soft(rotEllipse(fx - s * 0.12, fy + s * 0.005, s * 0.2, s * 0.03, -0.05), 'sidewalk', mix('#BDB5A8', '#2A2622', 0.45));
    items.push(...personItems(pose, fx, fy - 0.975 * s, s, st, inst));
  };
  walker(POSES[2], XR - 0.2, 2.9, PEOPLE[(vr + 1) % PEOPLE.length], 4);
  walker(POSES[0], XL + 0.17, 1.62, PEOPLE[vr % PEOPLE.length], 3);
  return items;
}

// ======================================================================
// Pedone (ritaglio verticale)
// ======================================================================

function pedItems(b: Box, variant: number): Item[] {
  const U = (u: number, v: number): P2 => [b.x + u * b.w, b.y + v * b.h];
  const R = (u0: number, v0: number, u1: number, v1: number): Cmd[] => poly([U(u0, v0), U(u1, v0), U(u1, v1), U(u0, v1)]);
  const vr = Math.abs(Math.round(variant)) % PEOPLE.length;
  const items: Item[] = [];
  const add = (cmds: Cmd[], cls: string, color: string, o: Partial<Item> = {}) => items.push({ cmds, cls, color, ...o });
  const GR = 0.8;
  add(R(-0.01, -0.01, 1.01, GR + 0.01), 'building', '#D6CEC1', { bg: true });
  for (let i = 0; i < 5; i++) add(R(i / 5, -0.01, i / 5 + 0.2, GR + 0.01), 'building', mix('#D6CEC1', '#9C9488', 0.05 + 0.05 * Math.abs(i - 1.5)), { soft: true });
  // vetrina con riflessi e telaio
  add(R(-0.01, 0.2, 0.3, 0.7), 'building', '#5B6874', { detail: true });
  add(poly([U(0.02, 0.2), U(0.14, 0.2), U(0.02, 0.45)]), 'building', '#8496A6', { soft: true });
  add(R(-0.01, 0.17, 0.33, 0.2), 'building', '#8C8478', { detail: true });
  add(R(0.3, 0.17, 0.33, 0.73), 'building', '#8C8478', { detail: true });
  for (let j = 1; j < 8; j++) add([['M', ...U(0.33, j * 0.1)], ['L', ...U(1.01, j * 0.1 + 0.005)]], 'building', '#C6BDB0', { soft: true, line: 0.6 });
  // marciapiede in prospettiva
  add(R(-0.01, GR, 1.01, 1.01), 'sidewalk', '#B3AB9E');
  add(R(-0.01, GR, 1.01, GR + 0.02), 'sidewalk', '#8F887C', { soft: true });
  for (const v of [0.86, 0.94]) add([['M', ...U(-0.01, v)], ['L', ...U(1.01, v)]], 'sidewalk', '#9E968A', { soft: true, line: 0.6 });
  for (const u of [0.15, 0.5, 0.85]) add([['M', ...U(u, GR)], ['L', ...U(u + (u - 0.5) * 0.6, 1.01)]], 'sidewalk', '#9E968A', { soft: true, line: 0.6 });
  const s = Math.min(b.h * 0.86, b.w * 2.2);
  const fy = b.y + b.h * 0.95;
  add(rotEllipse(b.x + b.w * 0.5 - s * 0.14, fy - s * 0.005, s * 0.22, s * 0.035, 0), 'sidewalk', '#6F685E', { soft: true });
  items.push(...personItems(POSES[0], b.x + b.w * 0.5, fy - 0.975 * s, s, PEOPLE[vr], 0));
  return items;
}

// ======================================================================
// Ritratto
// ======================================================================

const HAIR = ['#3B2A20', '#7A4E26', '#1E1B19', '#B8904E', '#5E3622'];
const SKIN = ['#E6B596', '#C28A66', '#F0C8A6', '#8C5A3C', '#DDA884'];
const IRIS = ['#4F6B8A', '#6B4A2E', '#3E2A1E', '#5C7A4A', '#3B2A1E'];
const SHIRT = ['#3E6F9E', '#5D8C63', '#A6463A', '#6A5A9E', '#C9902A'];
const BACK = ['#C9D7DE', '#DCD3C4', '#D1DCCB', '#DAD0DC', '#D4D4D4'];

function faceItems(b: Box, variant: number): Item[] {
  const v = Math.abs(Math.round(variant)) % 5;
  const S = Math.min(b.w, b.h);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const F = (u: number, w: number): P2 => [cx + (u - 0.5) * S, cy + (w - 0.5) * S];
  const E = (u: number, w: number, ru: number, rw: number, rot = 0): Cmd[] => rotEllipse(cx + (u - 0.5) * S, cy + (w - 0.5) * S, ru * S, rw * S, rot);
  const fw = [1, 0.94, 1.05, 0.97, 1.02][v];
  const hair = HAIR[v], skin = SKIN[v];
  const longHair = v === 1 || v === 3;
  const items: Item[] = [];
  const add = (cmds: Cmd[], cls: string, color: string, o: Partial<Item> = {}) => items.push({ cmds, cls, color, ...o });
  const soft = (cmds: Cmd[], cls: string, color: string, o: Partial<Item> = {}) => add(cmds, cls, color, { soft: true, ...o });
  const W = (u: number) => 0.5 + (u - 0.5) * fw;
  // sfondo da studio con vignettatura
  add(rectCmds(b.x - 1, b.y - 1, b.w + 2, b.h + 2), 'background', dark(BACK[v], 0.12), { bg: true });
  for (const [k, c] of [[0.75, 0.06], [0.58, 0]] as const) soft(rotEllipse(cx - S * 0.08, cy - S * 0.1, b.w * k, b.h * k, 0), 'background', dark(BACK[v], c));
  // capelli dietro, spalle, collo
  add(smooth([F(W(0.2), longHair ? 0.86 : 0.58), F(W(0.18), 0.32), F(0.34, 0.12), F(0.5, 0.08), F(0.66, 0.12), F(W(0.82), 0.32), F(W(0.8), longHair ? 0.86 : 0.58), F(0.5, longHair ? 0.8 : 0.55)]), 'hair', dark(hair, 0.18));
  const bottom = b.y + b.h + 2;
  add(smooth([[cx - 0.55 * S, bottom], F(0.06, 0.9), F(0.28, 0.8), F(0.5, 0.79), F(0.72, 0.8), F(0.94, 0.9), [cx + 0.55 * S, bottom]]), 'clothes', SHIRT[v]);
  soft(smooth([F(0.6, 0.8), F(0.86, 0.85), F(0.98, 1.0), F(0.68, 1.0)]), 'clothes', dark(SHIRT[v], 0.18));
  add(roundPoly([F(0.415, 0.6), F(0.585, 0.6), F(0.6, 0.83), F(0.4, 0.83)], 0.03 * S), 'neck', dark(skin, 0.1));
  add(poly([F(0.4, 0.8), F(0.5, 0.9), F(0.6, 0.8), F(0.6, 0.83), F(0.5, 0.94), F(0.4, 0.83)]), 'clothes', dark(SHIRT[v], 0.25), { detail: true });
  soft(rotEllipse(cx, cy + 0.14 * S, 0.085 * S, 0.035 * S, 0), 'neck', dark(skin, 0.28));
  // orecchie
  for (const sx of [-1, 1]) {
    add(E(0.5 + sx * 0.205 * fw, 0.5, 0.033, 0.055), 'skin', dark(skin, 0.04));
    soft(E(0.5 + sx * 0.21 * fw, 0.5, 0.014, 0.03), 'skin', dark(skin, 0.2));
  }
  // viso: ovale con mento e zigomi
  add(smooth([F(0.5, 0.22), F(W(0.68), 0.27), F(W(0.705), 0.42), F(W(0.68), 0.57), F(W(0.6), 0.69), F(0.5, 0.735), F(W(0.4), 0.69), F(W(0.32), 0.57), F(W(0.295), 0.42), F(W(0.32), 0.27)]), 'skin', skin);
  // ombreggiatura (luce da sinistra), guance, fronte
  soft(smooth([F(W(0.64), 0.3), F(W(0.705), 0.42), F(W(0.68), 0.57), F(W(0.6), 0.69), F(0.53, 0.73), F(W(0.61), 0.62), F(W(0.66), 0.46)]), 'skin', dark(skin, 0.07));
  soft(E(0.39, 0.55, 0.045, 0.026), 'skin', mix(skin, '#D9706A', 0.1));
  soft(E(0.61, 0.55, 0.04, 0.024), 'skin', mix(dark(skin, 0.05), '#D9706A', 0.09));
  soft(E(0.46, 0.355, 0.07, 0.022, -0.05), 'skin', light(skin, 0.1));
  // naso: regione (per la segmentazione), ombra, narici, luce
  add(smooth([F(0.5, 0.42), F(0.535, 0.55), F(0.55, 0.585), F(0.5, 0.6), F(0.45, 0.585), F(0.465, 0.55)]), 'nose', skin);
  soft(smooth([F(0.515, 0.44), F(0.548, 0.56), F(0.555, 0.59), F(0.52, 0.6), F(0.535, 0.55)]), 'nose', dark(skin, 0.14));
  soft(smooth([F(0.495, 0.44), F(0.503, 0.55), F(0.49, 0.56)], false), 'nose', light(skin, 0.25), { line: S * 0.007 });
  add(E(0.478, 0.588, 0.011, 0.006, 0.3), 'nose', dark(skin, 0.45), { detail: true });
  add(E(0.522, 0.588, 0.011, 0.006, -0.3), 'nose', dark(skin, 0.45), { detail: true });
  // occhi: sclera, iride, pupilla, riflesso, palpebra
  for (const sx of [-1, 1]) {
    const ex = 0.5 + sx * 0.09 * fw, ey = 0.455;
    const eye: P2[] = [F(ex - 0.045, ey), F(ex - 0.012, ey - 0.02), F(ex + 0.025, ey - 0.017), F(ex + 0.045, ey + 0.002), F(ex + 0.01, ey + 0.015), F(ex - 0.025, ey + 0.012)];
    soft(smooth([F(ex - 0.05, ey - 0.005), F(ex, ey - 0.035), F(ex + 0.05, ey - 0.005), F(ex, ey - 0.012)]), 'skin', dark(skin, 0.1));
    add(smooth(eye), 'eye', '#F3F1EE');
    add(E(ex, ey - 0.002, 0.016, 0.016), 'eye', IRIS[v], { detail: true });
    add(E(ex, ey - 0.002, 0.007, 0.007), 'eye', '#111111', { detail: true });
    soft(E(ex - 0.006, ey - 0.009, 0.0045, 0.0045), 'eye', '#FFFFFF');
    add(smooth([F(ex - 0.047, ey + 0.002), F(ex - 0.012, ey - 0.022), F(ex + 0.025, ey - 0.019), F(ex + 0.048, ey + 0.003)], false), 'eye', '#2A201B', { detail: true, line: S * 0.008 });
    soft(smooth([F(ex - 0.03, ey + 0.016), F(ex + 0.02, ey + 0.017)], false), 'skin', dark(skin, 0.2), { line: S * 0.004 });
    // sopracciglio rastremato
    add(smooth([F(ex - sx * 0.055, ey - 0.048), F(ex, ey - 0.072), F(ex + sx * 0.06, ey - 0.06), F(ex + sx * 0.058, ey - 0.052), F(ex, ey - 0.06), F(ex - sx * 0.052, ey - 0.04)]), 'brow', dark(hair, 0.15));
  }
  // bocca: labbro superiore, inferiore, rima, riflesso
  add(smooth([F(0.445, 0.645), F(0.48, 0.633), F(0.5, 0.638), F(0.52, 0.633), F(0.555, 0.645), F(0.5, 0.65)]), 'mouth', '#A84E55');
  add(smooth([F(0.448, 0.646), F(0.552, 0.646), F(0.53, 0.67), F(0.47, 0.67)]), 'mouth', '#C4646A');
  add(smooth([F(0.445, 0.645), F(0.5, 0.65), F(0.555, 0.645)], false), 'mouth', '#6E2C33', { detail: true, line: S * 0.005 });
  soft(E(0.49, 0.658, 0.016, 0.004), 'mouth', '#DE8F92');
  // capelli: frangia con volume e riflessi
  add(smooth([F(W(0.29), 0.44), F(W(0.29), 0.3), F(0.38, 0.17), F(0.52, 0.145), F(0.65, 0.18), F(W(0.71), 0.29), F(W(0.712), 0.42), F(W(0.68), 0.31), F(0.6, 0.26), F(0.48, 0.275), F(0.38, 0.29), F(W(0.32), 0.34)]), 'hair', hair);
  for (const [a, c2, d] of [[[0.37, 0.23], [0.45, 0.18], [0.56, 0.165]], [[0.45, 0.25], [0.54, 0.205], [0.64, 0.21]], [[0.31, 0.3], [0.34, 0.24], [0.4, 0.2]]] as [number, number][][]) {
    soft(smooth([F(a[0], a[1]), F(c2[0], c2[1]), F(d[0], d[1])], false), 'hair', light(hair, 0.22), { line: S * 0.007 });
  }
  soft(smooth([F(0.58, 0.255), F(0.65, 0.235), F(W(0.69), 0.3)], false), 'hair', dark(hair, 0.25), { line: S * 0.006 });
  return items;
}

export type Subject = 'street' | 'ped' | 'face';
export const subjectOf = (spec: string): Subject => (has(spec, 'face') ? 'face' : has(spec, 'ped') ? 'ped' : 'street');

export function sceneItems(b: Box, subject: Subject, variant: number): Item[] {
  if (subject === 'face') return faceItems(b, variant);
  if (subject === 'ped') return pedItems(b, variant);
  return streetItems(b, variant);
}

// ======================================================================
// Resa: foto, grigi, segmentazione, istanze, detection, bordi
// ======================================================================

/** Colori di segmentazione: Cityscapes per le scene, face parsing (CelebAMask-HQ) per i volti. */
const SEG: Record<string, string> = {
  sky: '#4682B4', building: '#464646', road: '#804080', sidewalk: '#F423E8', vegetation: '#6B8E23', pole: '#999999', sign: '#DCDC00', car: '#00008E', person: '#DC143C',
  background: '#1F1F1F', hair: '#3A6FD8', clothes: '#7A5BC8', skin: '#D96A4C', neck: '#E3A04A', brow: '#58B85C', eye: '#F2E15C', mouth: '#E07BD0', nose: '#F29B3A',
};
/** Colori dei box di detection per classe. */
export const DET: Record<string, string> = { car: '#E5484D', person: '#2F9E44', sign: '#F5A524' };
const CONF = [0.92, 0.88, 0.81, 0.95, 0.77, 0.9];

export interface Thing {
  cls: string;
  inst: number;
  bbox: Box;
}

function boundsOf(cmds: Cmd[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cmds)
    for (let i = 1; i + 1 < c.length; i += 2) {
      const px = c[i] as number, py = c[i + 1] as number;
      x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Oggetti numerabili (in ordine di disegno) con il riquadro che li contiene. */
export function things(items: Item[]): Thing[] {
  const map = new Map<number, { cls: string; inst: number; cmds: Cmd[] }>();
  for (const it of items) {
    if (it.inst === undefined || it.soft) continue;
    const t = map.get(it.inst);
    if (t) t.cmds.push(...it.cmds);
    else map.set(it.inst, { cls: it.cls, inst: it.inst, cmds: [...it.cmds] });
  }
  return [...map.values()].map((t) => ({ cls: t.cls, inst: t.inst, bbox: boundsOf(t.cmds) }));
}

/** Elementi "strutturali" (niente sfondo né effetti fotografici): bordi, keypoint. */
export const solidItems = (items: Item[]) => items.filter((it) => !it.bg && !it.soft);

/**
 * Dipinge la "foto" nel riquadro. Modi (parole in `mode`): gray, faded, seg, inst, det,
 * edges, lap; senza parole è la foto a colori. inst e det si combinano con la foto, det
 * anche con seg.
 */
export function paintScene(b: Box, subject: Subject, variant: number, mode: string): Part[] {
  const items = sceneItems(b, subject, variant);
  const out: Part[] = [];
  const ts = () => things(items);
  if (has(mode, 'edges') || has(mode, 'lap')) {
    // riempimento uniforme + contorno nell'ordine di disegno: i bordi nascosti restano coperti
    const lap = has(mode, 'lap');
    const bg = lap ? '#808080' : '#0D0D0D';
    out.push(rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, bg));
    for (const it of items) {
      if (it.bg || it.soft) continue;
      if (it.line) out.push(line(it.cmds, lap ? '#B4B4B4' : '#9A9A9A', Math.min(it.line, 0.6)));
      else {
        if (lap) out.push(area(it.cmds, bg, '#555555', 1.6));
        out.push(area(it.cmds, bg, lap ? '#D2D2D2' : '#F2F2F2', lap ? 0.6 : 0.7));
      }
    }
    return out;
  }
  if (has(mode, 'seg')) {
    for (const it of items) if (!it.detail && !it.soft && !it.line) out.push(area(it.cmds, SEG[it.cls] ?? '#000000'));
    if (has(mode, 'det')) out.push(...detBoxes(b, ts()));
    return out;
  }
  const tone = (c: string) => (has(mode, 'gray') ? gray(c) : has(mode, 'faded') ? mix(c, '#FFFFFF', 0.55) : c);
  const paint = (it: Item, c: string) => (it.line ? line(it.cmds, c, it.line) : area(it.cmds, c));
  const inst = has(mode, 'inst');
  for (const it of items) if (!(inst && it.inst !== undefined)) out.push(paint(it, tone(it.color)));
  if (inst) {
    // contorno dell'unione: prima le parti strutturali con un tratto spesso, poi i riempimenti tinti
    for (const t of ts()) {
      const c = VIVID[t.inst % VIVID.length];
      const own = items.filter((it) => it.inst === t.inst);
      for (const it of own) if (!it.soft && !it.line) out.push(area(it.cmds, c, c, 2.2));
      for (const it of own) out.push(paint(it, mix(tone(it.color), c, 0.55)));
    }
  }
  if (has(mode, 'det')) out.push(...detBoxes(b, ts()));
  return out;
}

/** Box di detection con l'etichetta "classe punteggio" su una linguetta colorata (senza sovrapposizioni). */
function detBoxes(b: Box, ts: Thing[]): Part[] {
  const out: Part[] = [];
  const tabs: Box[] = [];
  const m = Math.min(b.w, b.h);
  const sw = clamp(m * 0.016, 1, 2);
  const th = clamp(m * 0.07, 3.5, 10);
  const fs = th * 0.82;
  const hit = (r: Box) => tabs.some((t) => r.x < t.x + t.w && r.x + r.w > t.x && r.y < t.y + t.h && r.y + r.h > t.y);
  // i box più grandi scelgono per primi la posizione della linguetta
  const order = [...ts].sort((p, q) => q.bbox.w * q.bbox.h - p.bbox.w * p.bbox.h);
  for (const t of order) {
    const { x, y, w, h } = t.bbox;
    out.push(rect(x - 1, y - 1, w + 2, h + 2, 'none', DET[t.cls] ?? VIVID[0], sw));
  }
  for (const t of order) {
    const c = DET[t.cls] ?? VIVID[0];
    const { x, y, w, h } = t.bbox;
    const label = `${t.cls} ${CONF[t.inst % CONF.length].toFixed(2)}`;
    const textOk = fs >= 5;
    const tw = textOk ? label.length * fs * 0.56 + 3 : Math.max(th * 2.2, (w + 2) * 0.5);
    const tx = clamp(x - 1 - sw / 2, b.x, b.x + b.w - tw);
    const cands: Box[] = [
      { x: tx, y: y - 1 - th, w: tw, h: th },
      { x: tx, y: y - 1, w: tw, h: th },
      { x: tx, y: y + h + 1, w: tw, h: th },
    ].filter((r) => r.y >= b.y - 0.5 && r.y + r.h <= b.y + b.h + 0.5);
    const at = cands.find((r) => !hit(r));
    if (!at) continue;
    tabs.push(at);
    out.push(rect(at.x, at.y, at.w, at.h, c));
    if (textOk) out.push({ kind: 'text', x: at.x + 1.5, y: at.y + th / 2, text: label, size: fs, fill: '#FFFFFF', anchor: 'start', bold: true });
  }
  return out;
}
