// Forme parametriche del modulo Generative AI: un'immagine sintetica (paesaggio) in più rese
// (foto, bordi, segmentazione, profondità, rumore di diffusione, maschere e box), patch
// mascherate, codebook VQ, traiettorie di flow, raggi NeRF, gaussiane 3D e piccoli glifi dei paper.
// Tutto è fatto di primitive `Part`, quindi identico in SVG, PDF, PNG e TikZ.
import { mix, poly, rng, shade, smooth, type Box, type ClipRect, type Cmd, type Part } from '../draw';
import type { NodeModel } from '../model';
import type { ShapeDef, SpecChoice, SpecGroup } from '../registry';

type P2 = [number, number];
type Rand = () => number;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const words = (n: NodeModel) => n.spec.toLowerCase().split(/[\s,]+/).filter(Boolean);
const inkOf = (n: NodeModel) => (n.stroke === 'none' ? '#555555' : n.stroke);
const seg = (a: P2, b: P2): Cmd[] => [['M', a[0], a[1]], ['L', b[0], b[1]]];
const line = (cmds: Cmd[], stroke: string, sw: number): Part => ({ kind: 'path', cmds, fill: 'none', stroke, sw, solid: true });
const disc = (cx: number, cy: number, r: number, fill: string, stroke = 'none', sw = 1): Part => ({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill, stroke, sw, solid: true });
const txt = (x: number, y: number, text: string, size: number, fill = '#1A1A1A', anchor: 'start' | 'middle' | 'end' = 'middle'): Part => ({ kind: 'text', x, y, text, size, fill, anchor });
const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = 'none', sw = 1, r = 0): Part => ({ kind: 'rect', x, y, w, h, r, fill, stroke, sw, solid: true });

function head(tip: P2, dx: number, dy: number, size: number, color: string): Part {
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  const bx = tip[0] - ux * size, by = tip[1] - uy * size;
  const hw = size * 0.42;
  return { kind: 'path', fill: color, stroke: 'none', cmds: poly([tip, [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]) };
}

function arrow(a: P2, b: P2, color: string, sw: number, size = 5): Part[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const cut = Math.min(size * 0.8, l * 0.5);
  const end: P2 = [b[0] - ((b[0] - a[0]) / l) * cut, b[1] - ((b[1] - a[1]) / l) * cut];
  return [line(seg(a, end), color, sw), head(b, b[0] - a[0], b[1] - a[1], size, color)];
}

/** Linea tratteggiata come segmenti separati (resta tratteggiata anche se il blocco non lo è). */
function dashes(a: P2, b: P2, on: number, off: number): Cmd[] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!L) return [];
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
  const out: Cmd[] = [];
  for (let s = 0; s < L; s += on + off) {
    const e = Math.min(L, s + on);
    out.push(['M', a[0] + ux * s, a[1] + uy * s], ['L', a[0] + ux * e, a[1] + uy * e]);
  }
  return out;
}

/** Ellisse ruotata come curva chiusa (le primitive `ellipse` sono solo allineate agli assi). */
function rotEllipse(cx: number, cy: number, rx: number, ry: number, rot: number): Cmd[] {
  const c = Math.cos(rot), s = Math.sin(rot);
  const pts = Array.from({ length: 12 }, (_, k): P2 => {
    const a = (k * Math.PI) / 6;
    const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
    return [cx + c * ex - s * ey, cy + s * ex + c * ey];
  });
  return smooth(pts);
}

/** Gaussiana "morbida": anelli concentrici dal chiaro (bordo) al colore pieno (centro). */
function softGauss(cx: number, cy: number, rx: number, ry: number, rot: number, color: string, rings = 5): Part[] {
  return Array.from({ length: rings }, (_, i): Part => {
    const t = i / (rings - 1);
    const k = 1 - t * 0.62;
    return { kind: 'path', cmds: rotEllipse(cx, cy, rx * k, ry * k, rot), fill: mix('#FFFFFF', color, 0.18 + 0.82 * t), stroke: 'none' };
  });
}

// ---------------------------------------------------------------------------
// Colori: canali, scala di grigi, rotazione di tinta (color jitter)
// ---------------------------------------------------------------------------
const rgbOf = (c: string): [number, number, number] => {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const hexOf = (r: number, g: number, b: number) => {
  const ch = (v: number) => Math.round(clamp(v, 0, 255));
  return '#' + ((1 << 24) | (ch(r) << 16) | (ch(g) << 8) | ch(b)).toString(16).slice(1).toUpperCase();
};
const grayOf = (c: string) => {
  const [r, g, b] = rgbOf(c);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return hexOf(l, l, l);
};

function hueShift(c: string, deg: number): string {
  const [r, g, b] = rgbOf(c).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return c;
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + deg + 360) % 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return hexOf(f(h / 360 + 1 / 3) * 255, f(h / 360) * 255, f(h / 360 - 1 / 3) * 255);
}

// ---------------------------------------------------------------------------
// Scena sintetica (paesaggio) in coordinate unitarie: u verso destra, v verso il basso
// ---------------------------------------------------------------------------
type Region = 'sky' | 'sun' | 'mount' | 'snow' | 'hill' | 'meadow' | 'trunk1' | 'crown1' | 'trunk2' | 'crown2';
type Mode = 'photo' | 'edges' | 'canny' | 'seg' | 'depth' | 'gray';

const MOUNT: P2[] = [[0, 0.6], [0.14, 0.4], [0.27, 0.5], [0.44, 0.25], [0.57, 0.43], [0.7, 0.32], [0.84, 0.46], [1, 0.38]];
const SNOW: P2[] = [[0.44, 0.25], [0.479, 0.304], [0.462, 0.322], [0.445, 0.306], [0.425, 0.33], [0.408, 0.31], [0.392, 0.32]];
const SUN = { u: 0.8, v: 0.19, r: 0.075 };
const TREES = [
  { u: 0.25, v: 0.53, rx: 0.095, ry: 0.11, trunk: [0.235, 0.6, 0.03, 0.26] },
  { u: 0.69, v: 0.545, rx: 0.055, ry: 0.065, trunk: [0.681, 0.58, 0.018, 0.12] },
];
const hillV = (u: number) => 0.665 + 0.03 * Math.sin(2 * Math.PI * 1.1 * u + 0.6);
const meadowV = (u: number) => 0.8 + 0.035 * Math.sin(2 * Math.PI * 0.8 * u + 2.2);

function ridgeV(u: number): number {
  for (let i = 1; i < MOUNT.length; i++) {
    const [u0, v0] = MOUNT[i - 1], [u1, v1] = MOUNT[i];
    if (u <= u1) return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
  }
  return MOUNT[MOUNT.length - 1][1];
}

function inPoly(u: number, v: number, pts: P2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ui, vi] = pts[i], [uj, vj] = pts[j];
    if (vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
}

function regionAt(u: number, v: number): Region {
  const inEll = (t: (typeof TREES)[number]) => ((u - t.u) / t.rx) ** 2 + ((v - t.v) / t.ry) ** 2 <= 1;
  const inTrunk = (t: (typeof TREES)[number]) => u >= t.trunk[0] && u <= t.trunk[0] + t.trunk[2] && v >= t.trunk[1] && v <= t.trunk[1] + t.trunk[3];
  if (inEll(TREES[0])) return 'crown1';
  if (inTrunk(TREES[0])) return 'trunk1';
  if (v >= meadowV(u)) return 'meadow';
  if (inEll(TREES[1])) return 'crown2';
  if (inTrunk(TREES[1])) return 'trunk2';
  if (v >= hillV(u)) return 'hill';
  if (inPoly(u, v, SNOW)) return 'snow';
  if (v >= ridgeV(u)) return 'mount';
  if ((u - SUN.u) ** 2 + (v - SUN.v) ** 2 <= SUN.r ** 2) return 'sun';
  return 'sky';
}

const PALETTE: Record<'photo' | 'seg' | 'depth', Record<Region, string>> = {
  photo: { sky: '#BCDCF3', sun: '#F7C948', mount: '#8FA3C9', snow: '#F2F5FA', hill: '#93C47D', meadow: '#6AAF5C', trunk1: '#8B5E3C', crown1: '#3F8F46', trunk2: '#8B5E3C', crown2: '#58A453' },
  seg: { sky: '#79C2E8', sun: '#F4D03F', mount: '#9C82C4', snow: '#9C82C4', hill: '#7DC36B', meadow: '#7DC36B', trunk1: '#E07B39', crown1: '#E07B39', trunk2: '#E07B39', crown2: '#E07B39' },
  depth: { sky: '#111111', sun: '#111111', mount: '#3E3E3E', snow: '#3E3E3E', hill: '#7C7C7C', meadow: '#C4C4C4', trunk1: '#D6D6D6', crown1: '#D6D6D6', trunk2: '#8E8E8E', crown2: '#8E8E8E' },
};
const SKY_TOP = '#8EC1EA', SKY_LOW = '#D8EAF7';

/** Colore del punto (u, v) nella resa scelta: serve alla versione a pixel (immagini rumorose). */
function colorAt(u: number, v: number, mode: Mode): string {
  const r = regionAt(u, v);
  if (mode === 'seg') return PALETTE.seg[r];
  if (mode === 'depth') {
    if (r === 'meadow') return mix('#A8A8A8', '#F0F0F0', clamp((v - 0.78) / 0.22, 0, 1));
    if (r === 'hill') return mix('#707070', '#929292', clamp((v - 0.62) / 0.18, 0, 1));
    return PALETTE.depth[r];
  }
  const c = r === 'sky' ? mix(SKY_TOP, SKY_LOW, clamp(v / 0.6, 0, 1)) : PALETTE.photo[r];
  return mode === 'gray' ? grayOf(c) : c;
}

interface SceneOpt {
  mode: Mode;
  noise: number; // 0 = pulita, 1 = solo rumore
  view: [number, number, number]; // finestra (u0, v0, lato) per i ritagli
  flip: boolean;
  jitter: boolean;
  blur: boolean;
  over: string[]; // sovrapposizioni: mask, part, sub, point, bbox, boxes
}

const VIEWS: Record<string, [number, number, number]> = { crop: [0.04, 0.28, 0.62], crop2: [0.42, 0.1, 0.58], local: [0.1, 0.38, 0.32] };
const MODES: Mode[] = ['photo', 'edges', 'canny', 'seg', 'depth', 'gray'];

function sceneOpt(n: NodeModel, noise: number): SceneOpt {
  const w = words(n);
  const view = w.map((k) => VIEWS[k]).find(Boolean) ?? [0, 0, 1];
  return {
    mode: MODES.find((m) => w.includes(m)) ?? 'photo',
    noise: clamp(noise, 0, 1),
    view,
    flip: w.includes('flip'),
    jitter: w.includes('jitter'),
    blur: w.includes('blur'),
    over: w.filter((k) => ['mask', 'part', 'sub', 'point', 'bbox', 'boxes'].includes(k)),
  };
}

/**
 * Disegna la scena nel riquadro `box` (l'immagine intera), ritagliata a `clip`.
 * Con `noise` > 0 l'immagine diventa una griglia di pixel mescolati a rumore gaussiano
 * (x_t = cos·x_0 + sin·ε), come nelle figure dei modelli di diffusione.
 */
function paintScene(box: Box, clip: ClipRect, o: SceneOpt, rand: Rand): Part[] {
  const [u0, v0, s] = o.view;
  const X = (u: number) => {
    const d = (u - u0) / s;
    return box.x + (o.flip ? 1 - d : d) * box.w;
  };
  const Y = (v: number) => box.y + ((v - v0) / s) * box.h;
  const P = (u: number, v: number): P2 => [X(u), Y(v)];
  const sx = box.w / s, sy = box.h / s;
  const m = Math.min(clip.w, clip.h);
  const recolor = (c: string) => {
    let out = c;
    if (o.jitter) out = hueShift(out, 140);
    if (o.blur) out = mix(out, '#A9B4A9', 0.35);
    return out;
  };
  const parts: Part[] = [];
  const curve = (f: (u: number) => number): P2[] => Array.from({ length: 25 }, (_, i) => P(i / 24, f(i / 24)));
  const below = (pts: P2[]): Cmd[] => poly([...pts, P(1, 1.02), P(0, 1.02)]);
  const crown = (t: (typeof TREES)[number]): Part => ({ kind: 'ellipse', cx: X(t.u), cy: Y(t.v), rx: t.rx * sx, ry: t.ry * sy, fill: 'none' });
  const trunk = (t: (typeof TREES)[number]): Cmd[] => {
    const [tu, tv, tw, th] = t.trunk;
    return poly([P(tu, tv), P(tu + tw, tv), P(tu + tw, tv + th), P(tu, tv + th)]);
  };
  if (o.noise > 0.001) {
    // versione a pixel: ogni cella prende il colore della scena e lo mescola al rumore
    const G = clamp(Math.round(Math.min(box.w, box.h) / 2.6), 12, 40);
    const cw = box.w / G, ch = box.h / G;
    // livello "percettivo": i primi passi lasciano l'immagine ben riconoscibile, come nei paper
    const t = o.noise ** 1.6;
    const a = Math.cos((t * Math.PI) / 2), b = Math.sin((t * Math.PI) / 2);
    const gauss = () => (rand() + rand() + rand() - 1.5) * 1.3;
    for (let j = 0; j < G; j++)
      for (let i = 0; i < G; i++) {
        const px = box.x + i * cw, py = box.y + j * ch;
        if (px + cw < clip.x || px > clip.x + clip.w || py + ch < clip.y || py > clip.y + clip.h) continue;
        let du = (i + 0.5) / G;
        if (o.flip) du = 1 - du;
        const base = o.mode === 'edges' || o.mode === 'canny' ? (o.mode === 'edges' ? '#FFFFFF' : '#111111') : recolor(colorAt(u0 + du * s, v0 + ((j + 0.5) / G) * s, o.mode));
        const rgb = rgbOf(base).map((c) => clamp(((a * (c / 127.5 - 1) + b * gauss()) + 1) * 127.5, 0, 255));
        parts.push(rect(px, py, cw + 0.35, ch + 0.35, hexOf(rgb[0], rgb[1], rgb[2])));
      }
  } else if (o.mode === 'edges' || o.mode === 'canny') {
    const ink = o.mode === 'edges' ? '#262626' : '#F4F4F4';
    parts.push(rect(clip.x, clip.y, clip.w, clip.h, o.mode === 'edges' ? '#FFFFFF' : '#111111'));
    const sw = clamp(m * 0.012, 0.6, 1.6);
    const ridge = MOUNT.map(([u, v]) => P(u, v));
    const snow = SNOW.slice(1).map(([u, v]) => P(u, v));
    parts.push(
      line(poly(ridge, false), ink, sw),
      line(poly(snow, false), ink, sw * 0.8),
      line(smooth(curve(hillV), false), ink, sw),
      line(smooth(curve(meadowV), false), ink, sw),
      { kind: 'ellipse', cx: X(SUN.u), cy: Y(SUN.v), rx: SUN.r * sx, ry: SUN.r * sy, fill: 'none', stroke: ink, sw, solid: true },
    );
    for (const t of TREES) {
      const [tu, tv, tw, th] = t.trunk;
      const top = t.v + t.ry * 0.9;
      parts.push(line([...seg(P(tu, top), P(tu, tv + th)), ...seg(P(tu + tw, top), P(tu + tw, tv + th))], ink, sw), { ...crown(t), stroke: ink, sw, solid: true });
    }
  } else {
    const col = (r: Region) => recolor(o.mode === 'seg' ? PALETTE.seg[r] : o.mode === 'depth' ? PALETTE.depth[r] : o.mode === 'gray' ? grayOf(PALETTE.photo[r]) : PALETTE.photo[r]);
    const fillOf = (c: string) => ({ fill: c, stroke: 'none' });
    // cielo a bande (sfumatura) nelle rese fotografiche
    if (o.mode === 'photo' || o.mode === 'gray') {
      for (let k = 0; k < 7; k++) {
        const c = mix(SKY_TOP, SKY_LOW, k / 6);
        parts.push(rect(clip.x, Math.max(clip.y, Y((k * 0.6) / 7) - 0.5), clip.w, clip.h, recolor(o.mode === 'gray' ? grayOf(c) : c)));
      }
    } else parts.push(rect(clip.x, clip.y, clip.w, clip.h, col('sky')));
    parts.push({ kind: 'ellipse', cx: X(SUN.u), cy: Y(SUN.v), rx: SUN.r * sx, ry: SUN.r * sy, ...fillOf(col('sun')) });
    parts.push({ kind: 'path', cmds: poly([...MOUNT.map(([u, v]) => P(u, v)), P(1, 1.02), P(0, 1.02)]), ...fillOf(col('mount')) });
    if (o.mode !== 'seg' && o.mode !== 'depth') parts.push({ kind: 'path', cmds: poly(SNOW.map(([u, v]) => P(u, v))), ...fillOf(col('snow')) });
    const hill = curve(hillV);
    parts.push({ kind: 'path', cmds: below(hill), ...fillOf(col('hill')) });
    parts.push({ kind: 'path', cmds: trunk(TREES[1]), ...fillOf(col('trunk2')) }, { ...crown(TREES[1]), ...fillOf(col('crown2')) });
    // prato: in profondità a bande sempre più chiare (più vicine)
    const bands = o.mode === 'depth' ? 4 : 1;
    for (let k = 0; k < bands; k++) {
      const c = o.mode === 'depth' ? mix('#A8A8A8', '#F0F0F0', k / 3) : col('meadow');
      parts.push({ kind: 'path', cmds: below(curve((u) => meadowV(u) + k * 0.055)), ...fillOf(c) });
    }
    parts.push({ kind: 'path', cmds: trunk(TREES[0]), ...fillOf(col('trunk1')) }, { ...crown(TREES[0]), ...fillOf(col('crown1')) });
  }
  // sovrapposizioni: maschere (SAM), prompt, box (DETR)
  const t1 = TREES[0];
  const blue = '#2F6FE4';
  const maskFill = (r: Region) => mix(recolor(o.mode === 'seg' ? PALETTE.seg[r] : PALETTE.photo[r]), blue, 0.6);
  const sw = clamp(m * 0.016, 0.8, 1.8);
  if (o.over.includes('mask') || o.over.includes('sub')) parts.push({ kind: 'path', cmds: trunk(t1), fill: maskFill('trunk1'), stroke: '#1D4ED8', sw, solid: true });
  if (o.over.includes('mask') || o.over.includes('part')) parts.push({ ...crown(t1), fill: maskFill('crown1'), stroke: '#1D4ED8', sw, solid: true });
  const bboxOf = (t: (typeof TREES)[number]): [number, number, number, number] => {
    const xa = X(t.u - t.rx * 1.08), xb = X(t.u + t.rx * 1.08);
    return [Math.min(xa, xb), Y(t.v - t.ry * 1.1), Math.abs(xb - xa), Y(t.trunk[1] + t.trunk[3] + 0.01) - Y(t.v - t.ry * 1.1)];
  };
  if (o.over.includes('bbox')) {
    const [bx, by, bw, bh] = bboxOf(t1);
    parts.push(rect(bx, by, bw, bh, 'none', '#E5484D', sw));
  }
  if (o.over.includes('boxes')) {
    TREES.forEach((t, i) => {
      const [bx, by, bw, bh] = bboxOf(t);
      parts.push(rect(bx, by, bw, bh, 'none', i === 0 ? '#E8636F' : '#E3B23C', sw * 1.1));
    });
  }
  if (o.over.includes('point')) parts.push(disc(X(t1.u), Y(t1.v - t1.ry * 0.15), clamp(m * 0.035, 2, 4.5), '#2FBF4F', '#FFFFFF', clamp(m * 0.012, 0.6, 1.2)));
  return parts.map((p) => ({ ...p, stroke: p.stroke ?? 'none', clip }));
}

/** Cornice come le immagini da paper (passe-partout del blocco) e contenuto ritagliato. */
function frame(n: NodeModel, paint: (inner: ClipRect) => Part[]): Part[] {
  const mat = n.fill === 'none' ? 0 : clamp(Math.min(n.w, n.h) * 0.035, 2, 5);
  const inner: ClipRect = { x: n.x + mat, y: n.y + mat, w: Math.max(1, n.w - 2 * mat), h: Math.max(1, n.h - 2 * mat), r: Math.max(0, Math.min(n.radius, n.w / 2, n.h / 2) - mat) };
  const parts: Part[] = [];
  if (mat) parts.push({ kind: 'rect', x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(n.radius, n.w / 2, n.h / 2), fill: n.fill });
  parts.push(...paint(inner));
  if (!mat && n.stroke !== 'none') parts.push({ kind: 'rect', ...inner, fill: 'none' });
  return parts;
}

function scene(n: NodeModel): Part[] {
  const o = sceneOpt(n, clamp(n.count, 0, 10) / 10);
  return frame(n, (inner) => paintScene(inner, inner, o, rng(17 + n.count * 131)));
}

// ---------------------------------------------------------------------------
// Striscia dati → rumore (Song et al. 2021, Fig. 1; Song et al. 2023, Fig. 1)
// ---------------------------------------------------------------------------
function noiseStrip(n: NodeModel): Part[] {
  const w = words(n);
  const N = clamp(Math.round(n.count), 2, 10);
  const arrows = w.includes('arrows');
  const k = arrows ? 0.32 : w.includes('gap') ? 0.12 : 0.035;
  const side = Math.min(n.h, n.w / (N + (N - 1) * k));
  const gap = side * k;
  const x0 = n.x + (n.w - (N * side + (N - 1) * gap)) / 2;
  const y0 = n.y + (n.h - side) / 2;
  const parts: Part[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const o = sceneOpt(n, w.includes('reverse') ? 1 - t : t);
    const box: ClipRect = { x: x0 + i * (side + gap), y: y0, w: side, h: side, r: 0 };
    parts.push(...paintScene(box, box, o, rng(97 + i * 7919)));
    if (n.stroke !== 'none') parts.push(rect(box.x, box.y, side, side, 'none', n.stroke, Math.min(1, n.strokeWidth)));
    if (arrows && i < N - 1) parts.push(...arrow([box.x + side + gap * 0.18, y0 + side / 2], [box.x + side + gap * 0.82, y0 + side / 2], inkOf(n), 1, Math.min(6, gap * 0.35)));
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Patch mascherate (He et al. 2022, MAE, Fig. 1)
// ---------------------------------------------------------------------------
const MASK_GRAY = '#7B7563';
const TOKEN_GRAY = '#A9AAB0';

/** Patch mascherate (75%) di una griglia G×G: scelta deterministica che dipende solo da G. */
function maskPattern(G: number): boolean[] {
  const rand = rng(G * 31 + 7);
  const idx = Array.from({ length: G * G }, (_, i) => i).sort(() => rand() - 0.5);
  const masked = new Set(idx.slice(0, Math.round(G * G * 0.75)));
  return Array.from({ length: G * G }, (_, i) => masked.has(i));
}

function maskedPatches(n: NodeModel): Part[] {
  const w = words(n);
  const G = clamp(Math.round(n.count), 2, 8);
  const mode = ['masked', 'image', 'recon', 'visible', 'tokens', 'mixed'].find((m) => w.includes(m)) ?? 'masked';
  const masked = maskPattern(G);
  const o = sceneOpt(n, 0);
  const rand = rng(5);
  const parts: Part[] = [];
  if (mode === 'masked' || mode === 'image' || mode === 'recon') {
    const S = Math.min(n.w, n.h);
    const gap = S * 0.018;
    const c = (S - gap * (G - 1)) / G;
    const x0 = n.x + (n.w - S) / 2, y0 = n.y + (n.h - S) / 2;
    const full: Box = { x: x0, y: y0, w: S, h: S };
    for (let j = 0; j < G; j++)
      for (let i = 0; i < G; i++) {
        const cl: ClipRect = { x: x0 + i * (c + gap), y: y0 + j * (c + gap), w: c, h: c, r: 0 };
        const hidden = masked[j * G + i];
        if (mode === 'masked' && hidden) parts.push(rect(cl.x, cl.y, c, c, MASK_GRAY));
        else parts.push(...paintScene(full, cl, mode === 'recon' && hidden ? { ...o, blur: true } : o, rand));
      }
    return parts;
  }
  // sequenze: colonna (se il blocco è alto) o riga di patch / token separati da uno spazio
  const vertical = n.h >= n.w;
  const L = vertical ? n.h : n.w, T = vertical ? n.w : n.h;
  const ids = mode === 'mixed' || w.includes('all') ? masked.map((_, i) => i) : masked.map((m, i) => (m ? -1 : i)).filter((i) => i >= 0);
  const pitch = T * 1.08;
  const fit = Math.max(3, Math.floor((L + T * 0.08) / pitch));
  const dots = ids.length > fit || w.includes('dots');
  const shown: (number | null)[] = dots ? [...ids.slice(0, Math.max(1, fit - 3)), null, ...ids.slice(ids.length - 2)] : ids;
  const cell = Math.min(T, (L - (shown.length - 1) * T * 0.08) / shown.length);
  const gap = cell * 0.08;
  const total = shown.length * cell + (shown.length - 1) * gap;
  const start = (vertical ? n.y + (n.h - total) / 2 : n.x + (n.w - total) / 2);
  const cross = vertical ? n.x + (n.w - cell) / 2 : n.y + (n.h - cell) / 2;
  shown.forEach((id, k) => {
    const a = start + k * (cell + gap);
    const [cx, cy] = vertical ? [cross, a] : [a, cross];
    if (id === null) {
      for (let d = -1; d <= 1; d++) parts.push(disc(cx + cell / 2 + (vertical ? 0 : d * cell * 0.22), cy + cell / 2 + (vertical ? d * cell * 0.22 : 0), cell * 0.05, '#555555'));
      return;
    }
    if (mode === 'visible') {
      const gi = id % G, gj = Math.floor(id / G);
      const cl: ClipRect = { x: cx, y: cy, w: cell, h: cell, r: 0 };
      parts.push(...paintScene({ x: cx - gi * cell, y: cy - gj * cell, w: G * cell, h: G * cell }, cl, o, rand));
    } else {
      const fill = mode === 'mixed' && masked[id] ? TOKEN_GRAY : n.fill === 'none' ? '#A8DDE0' : n.fill;
      parts.push(rect(cx, cy, cell, cell, fill, 'none', 1, Math.min(n.radius, cell * 0.15)));
    }
  });
  return parts;
}

// ---------------------------------------------------------------------------
// VQ-VAE (van den Oord et al. 2017, Fig. 1): codebook e spazio degli embedding
// ---------------------------------------------------------------------------
function codebook(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const ink = inkOf(n);
  const fill = n.fill === 'none' ? '#DCD3EC' : n.fill;
  const parts: Part[] = [];
  if (words(n).includes('space')) {
    // spazio degli embedding: vettori del codebook, z_e(x) e il più vicino e_2
    const m = Math.min(w, h);
    const r = m * 0.075;
    const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
    const pts: P2[] = [[0.1, 0.18], [0.45, 0.08], [0.78, 0.22], [0.12, 0.6], [0.36, 0.42], [0.92, 0.55], [0.18, 0.88], [0.45, 0.8], [0.62, 0.95], [0.86, 0.86]];
    const dotC = mix(fill, ink, 0.45);
    pts.forEach(([u, v]) => parts.push(disc(...P(u, v), r, dotC)));
    const fs = clamp(m * 0.09, 7, 12);
    const [ex, ey] = P(0.36, 0.42);
    const ze: P2 = [ex + r * 1.9, ey + r * 0.55];
    parts.push(txt(ex, ey, '$e_2$', fs * 0.95), txt(ex - r * 1.3, ey, '$z_q(x)$', fs, '#1A1A1A', 'end'));
    parts.push(...arrow([ze[0] + r * 0.5, ze[1]], [ze[0] + r * 3.2, ze[1]], '#D9534F', 1.3, 5), disc(ze[0], ze[1], r * 0.55, '#9ED39A'));
    parts.push(txt(ze[0] + r * 2, ze[1] - r * 1.25, '$\\nabla_z L$', fs * 0.95), txt(ze[0] + r * 0.3, ze[1] + r * 1.7, '$z_e(x)$', fs));
    return parts;
  }
  const R = Math.min(n.radius, h * 0.2);
  parts.push({ kind: 'rect', x, y, w, h, r: R, fill: '#FFFFFF', stroke: ink, sw: n.strokeWidth });
  const K1 = clamp(Math.round(n.count), 3, 16);
  const K2 = Math.max(2, Math.round(K1 * 0.6));
  const padX = w * 0.06;
  const top = y + h * 0.26, bot = y + h * 0.88;
  const dotsW = w * 0.16;
  const sw = (w - 2 * padX - dotsW) / (K1 + K2);
  const fs = clamp(Math.min(sw * 1.3, h * 0.14), 7, 12);
  const colX = (i: number) => (i < K1 ? x + padX + i * sw : x + padX + dotsW + i * sw);
  for (let i = 0; i < K1 + K2; i++) parts.push(rect(colX(i), top, sw, bot - top, fill, ink, 0.6));
  const ly = y + h * 0.15;
  ['$e_1$', '$e_2$', '$e_3$'].forEach((s, i) => parts.push(txt(colX(i) + sw / 2, ly, s, fs)));
  parts.push(txt(colX(K1 + K2 - 1) + sw / 2, ly, '$e_K$', fs));
  const dc = x + padX + K1 * sw + dotsW / 2;
  for (let d = -1; d <= 1; d++) parts.push(disc(dc + d * dotsW * 0.24, (top + bot) / 2, dotsW * 0.09, mix(fill, '#FFFFFF', 0.2)));
  return parts;
}

/** Tensore a griglia (z_e(x), z_q(x)) o mappa piatta di indici q(z|x), come in VQ-VAE. */
function gridCube(n: NodeModel): Part[] {
  const w = words(n);
  const N = clamp(Math.round(n.count), 2, 12);
  const ink = inkOf(n);
  const fill = n.fill === 'none' ? '#FFFFFF' : n.fill;
  const flat = w.includes('flat');
  const d = flat ? 0 : Math.round(Math.min(n.w, n.h) * clamp(n.depth, 0.05, 0.9));
  const fx = n.x, fy = n.y + d, fw = n.w - d, fh = n.h - d;
  const cw = fw / N, ch = fh / N;
  const thin = Math.max(0.4, n.strokeWidth * 0.45);
  const parts: Part[] = [];
  if (d) {
    const M = Math.max(2, Math.round((N * d) / fw) + 1);
    parts.push({ kind: 'path', cmds: poly([[fx, fy], [fx + d, n.y], [fx + fw + d, n.y], [fx + fw, fy]]), fill: shade(fill, 0.35) });
    parts.push({ kind: 'path', cmds: poly([[fx + fw, fy], [fx + fw + d, n.y], [fx + fw + d, n.y + fh], [fx + fw, fy + fh]]), fill: shade(fill, -0.08) });
    const g: Cmd[] = [];
    for (let i = 1; i < N; i++) g.push(...seg([fx + i * cw, fy], [fx + i * cw + d, n.y]), ...seg([fx + fw, fy + i * ch], [fx + fw + d, n.y + i * ch]));
    for (let j = 1; j < M; j++) {
      const o = (j / M) * d;
      g.push(...seg([fx + o, fy - o], [fx + fw + o, fy - o]), ...seg([fx + fw + o, fy - o], [fx + fw + o, fy + fh - o]));
    }
    parts.push(line(g, ink, thin));
  }
  parts.push(rect(fx, fy, fw, fh, fill, ink, n.strokeWidth));
  const g: Cmd[] = [];
  for (let i = 1; i < N; i++) g.push(...seg([fx + i * cw, fy], [fx + i * cw, fy + fh]), ...seg([fx, fy + i * ch], [fx + fw, fy + i * ch]));
  parts.push(line(g, ink, thin));
  if (d) parts.push({ kind: 'path', cmds: poly([[fx, fy], [fx + d, n.y], [fx + fw + d, n.y], [fx + fw + d, n.y + fh], [fx + fw, fy + fh], [fx, fy + fh]]), fill: 'none' });
  // indici del codebook (q(z|x)) o vettori e_k scelti (z_q(x)), nelle stesse celle
  const cells: [number, number, string][] = [[0.78, 0.2, '1'], [0.3, 0.4, '3'], [0.55, 0.58, '2'], [0.22, 0.78, '53']];
  const codes = w.includes('codes'), idx = w.includes('idx');
  if (codes || idx)
    for (const [u, v, k] of cells) {
      const i = Math.min(N - 1, Math.floor(u * N)), j = Math.min(N - 1, Math.floor(v * N));
      const size = clamp(Math.min(cw, ch) * (codes ? 0.78 : 0.72), 7, 13);
      parts.push(txt(fx + (i + 0.5) * cw, fy + (j + 0.5) * ch, codes ? `$e_{${k}}$` : k, size));
    }
  return parts;
}

// ---------------------------------------------------------------------------
// Rectified flow (Liu et al. 2023, Fig. 2): traiettorie da π0 a π1
// ---------------------------------------------------------------------------
function flowPaths(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const w0 = words(n);
  const mode = ['interp', 'rectified', 'reflow', 'straight'].find((m) => w0.includes(m)) ?? 'rectified';
  const K = clamp(Math.round(n.count), 4, 60);
  const rand = rng(11 + K);
  const m = Math.min(w, h);
  const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const gauss = () => (rand() + rand() + rand() - 1.5) * 0.9;
  const spread = 0.075;
  const cluster = (u: number, v: number): P2 => [u + gauss() * spread * (h / w), v + gauss() * spread];
  const SRC: P2[] = [[0.1, 0.22], [0.1, 0.78]];
  const DST: P2[] = [[0.9, 0.22], [0.9, 0.78]];
  const BLUE = '#3A7DC0', GREEN = '#4DAA4D', PURPLE = '#9B59B6', RED = '#E3262A';
  const dashed = mode === 'interp' || mode === 'reflow';
  const lw = clamp(m * 0.006, 0.4, 0.9);
  const parts: Part[] = [];
  if (n.fill !== 'none') parts.push({ kind: 'rect', x, y, w, h, r: Math.min(n.radius, m / 2), fill: n.fill });
  const lines: Cmd[][] = [[], []];
  const starts: P2[] = [], ends: P2[] = [];
  for (let s = 0; s < 2; s++)
    for (let k = 0; k < K; k++) {
      const a = cluster(...SRC[s]);
      // accoppiamento indipendente (a): metà delle coppie attraversa; dopo il reflow ognuno resta dal suo lato
      const cross = (mode === 'interp' || mode === 'rectified') && k % 2 === 1;
      const b = cluster(...DST[cross && mode === 'interp' ? 1 - s : s]);
      starts.push(a);
      ends.push(b);
      const A = P(...a), B = P(...b);
      if (mode === 'rectified' && cross) {
        // traiettoria "ricablata" all'incrocio: scende verso il centro e torna dal proprio lato
        const sgn = s === 0 ? 1 : -1;
        const mid = P(0.5 + gauss() * 0.03, 0.5 - sgn * (0.02 + rand() * 0.04));
        const c1 = P(0.32, a[1] + sgn * 0.3), c2 = P(0.68, b[1] + sgn * 0.3);
        lines[s].push(['M', A[0], A[1]], ['C', c1[0], c1[1], mid[0] - w * 0.08, mid[1], mid[0], mid[1]], ['C', mid[0] + w * 0.08, mid[1], c2[0], c2[1], B[0], B[1]]);
      } else if (dashed) {
        lines[s].push(...dashes(A, B, m * 0.03, m * 0.015));
      } else {
        lines[s].push(...seg(A, B));
      }
    }
  parts.push(line(lines[0], BLUE, lw), line(lines[1], GREEN, lw));
  const r = clamp(m * 0.012, 0.8, 2.2);
  starts.forEach(([u, v]) => parts.push(disc(...P(u, v), r, PURPLE)));
  ends.forEach(([u, v]) => parts.push(disc(...P(u, v), r, RED)));
  return parts;
}

// ---------------------------------------------------------------------------
// NeRF (Mildenhall et al. 2020, Fig. 2): volume, due viste, raggi con campioni
// ---------------------------------------------------------------------------
function toyObject(P: (u: number, v: number) => P2, ox: number, oy: number, ow: number, oh: number, flat = false): Part[] {
  const Q = (u: number, v: number) => P(ox + u * ow, oy + v * oh);
  const Y = '#F2C12E', Yd = '#C99712';
  const body = (pts: [number, number][], fill: string, edge = Yd): Part => ({ kind: 'path', cmds: poly(pts.map(([u, v]) => Q(u, v))), fill, stroke: flat ? 'none' : edge, sw: 0.6, solid: true });
  return [
    body([[0.04, 0.8], [0.74, 0.8], [0.74, 1], [0.04, 1]], '#565656', '#333333'),
    body([[0.08, 0.8], [0.08, 0.5], [0.62, 0.5], [0.72, 0.62], [0.72, 0.8]], Y),
    body([[0.14, 0.5], [0.14, 0.22], [0.42, 0.22], [0.42, 0.5]], '#F5CD3D'),
    body([[0.19, 0.28], [0.37, 0.28], [0.37, 0.43], [0.19, 0.43]], '#5A6B7A', '#3D4A55'),
    body([[0.58, 0.54], [0.78, 0.22], [0.85, 0.27], [0.66, 0.6]], Y),
    body([[0.78, 0.22], [0.99, 0.52], [0.93, 0.56], [0.76, 0.31]], Y),
    body([[0.86, 0.55], [1.02, 0.5], [1.04, 0.74], [0.86, 0.74]], '#D9A420'),
  ];
}

function nerfRays(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const out = words(n).includes('output');
  const S = clamp(Math.round(n.count), 3, 14);
  const m = Math.min(w, h);
  const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const parts: Part[] = [];
  // volume di lavoro: parallelepipedo a puntini
  const front: P2[] = [[0.2, 0.34], [0.66, 0.34], [0.66, 0.86], [0.2, 0.86]];
  const back = front.map(([u, v]): P2 => [u + 0.13, v - 0.17]);
  const dot: Cmd[] = [];
  const on = m * 0.012, off = m * 0.016;
  for (let i = 0; i < 4; i++) {
    dot.push(...dashes(P(...back[i]), P(...back[(i + 1) % 4]), on, off), ...dashes(P(...front[i]), P(...back[i]), on, off));
    dot.push(...dashes(P(...front[i]), P(...front[(i + 1) % 4]), on, off));
  }
  parts.push(line(dot, '#9AA5B1', 0.8));
  parts.push(...toyObject(P, 0.3, 0.42, 0.3, 0.3));
  // piani immagine (due viste) con una piccola resa dell'oggetto
  const plane = (pts: P2[], ox: number, oy: number, ow: number, oh: number): Part[] => [
    { kind: 'path', cmds: poly(pts.map(([u, v]) => P(u, v))), fill: '#FFFFFF', stroke: '#222222', sw: 1, solid: true },
    ...toyObject(P, ox, oy, ow, oh, true).map((p): Part => ({ ...p, clip: { x: x + pts[0][0] * w, y: y + Math.min(pts[0][1], pts[1][1]) * h, w: (pts[1][0] - pts[0][0]) * w, h: (Math.max(pts[2][1], pts[3][1]) - Math.min(pts[0][1], pts[1][1])) * h, r: 0 } })),
  ];
  parts.push(...plane([[0.03, 0.36], [0.16, 0.44], [0.16, 1], [0.03, 0.92]], 0.05, 0.55, 0.11, 0.16));
  // raggi: origine (camera, chevron blu), campioni dentro il volume, freccia in uscita
  const RAYS: [P2, P2][] = [[[0.0, 0.97], [0.8, 0.27]], [[1.0, 0.72], [0.16, 0.33]]];
  const RED = '#E8432E', CAM = '#2E7BE6';
  RAYS.forEach(([a, b], ri) => {
    const A = P(...a), B = P(...b);
    parts.push(...arrow(A, B, RED, 1, 5));
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const c = m * 0.05;
    parts.push(line([['M', A[0] + ux * c - uy * c * 0.7, A[1] + uy * c + ux * c * 0.7], ['L', A[0], A[1]], ['L', A[0] + ux * c + uy * c * 0.7, A[1] + uy * c - ux * c * 0.7]], CAM, 1.6));
    const r = clamp(m * 0.02, 1.4, 3.4);
    for (let k = 0; k < S; k++) {
      const t = ri === 0 ? 0.3 + (0.52 * k) / (S - 1) : 0.42 + (0.48 * k) / (S - 1);
      const px = A[0] + dx * t, py = A[1] + dy * t;
      const u = (px - x) / w, v = (py - y) / h;
      const hit = u > 0.31 && u < 0.6 && v > 0.43 && v < 0.72;
      if (!out) parts.push(disc(px, py, r, '#111111'));
      else parts.push(disc(px, py, r * 1.15, hit ? (ri === 0 ? '#F0A13A' : '#E9E33F') : '#FFFFFF', '#9C3D10', 0.7));
    }
    if (out) parts.push(txt(B[0] + (ri === 0 ? m * 0.03 : -m * 0.02), B[1] - m * 0.055, `Ray ${ri + 1}`, clamp(m * 0.06, 7, 11), '#1A1A1A', ri === 0 ? 'start' : 'end'));
  });
  parts.push(...plane([[0.68, 0.38], [0.86, 0.3], [0.86, 0.84], [0.68, 0.92]], 0.7, 0.5, 0.14, 0.2));
  return parts;
}

/** Densità σ lungo un raggio (NeRF, Fig. 2c): curva colorata dal colore accumulato. */
function rayDensity(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const two = words(n).includes('ray2');
  const m = Math.min(w, h);
  const fs = clamp(m * 0.16, 7, 11);
  const ax = x + fs * 1.1, ay = y + h - fs * 0.4, top = y + fs * 0.4, right = x + w;
  const ink = '#1A1A1A';
  const parts: Part[] = [];
  parts.push(...arrow([ax, ay], [ax, top], ink, 1, 4), ...arrow([ax, ay], [right, ay], ink, 1, 4));
  parts.push(txt(x + fs * 0.35, top + fs * 0.6, '$\\sigma$', fs, ink));
  const bump = (u: number, c: number, s: number, a: number) => a * Math.exp(-(((u - c) / s) ** 2));
  const f = (u: number) => (two ? 0.08 + bump(u, 0.3, 0.09, 0.62) + bump(u, 0.78, 0.09, 0.64) : 0.12 + 0.04 * u + bump(u, 0.74, 0.1, 0.7));
  const stops: [number, string][] = two
    ? [[0, '#F08A24'], [0.3, '#E8742A'], [0.5, '#E9C13A'], [0.78, '#E9E33F'], [1, '#E9E33F']]
    : [[0, '#E9E33F'], [0.5, '#E9C13A'], [0.7, '#C9661E'], [0.82, '#9C3D10'], [1, '#E9E33F']];
  const colorAtU = (u: number) => {
    for (let i = 1; i < stops.length; i++) if (u <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (u - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    return stops[stops.length - 1][1];
  };
  const x0 = ax + 3, x1 = right - 8, hh = ay - top - fs * 0.3;
  const K = 28;
  for (let k = 0; k < K; k++) {
    const u0 = k / K, u1 = (k + 1) / K;
    parts.push(line(seg([x0 + (x1 - x0) * u0, ay - 2 - f(u0) * hh], [x0 + (x1 - x0) * u1, ay - 2 - f(u1) * hh]), colorAtU((u0 + u1) / 2), clamp(m * 0.03, 1.4, 2.6)));
  }
  parts.push(txt((x0 + x1) / 2 - (two ? 0 : w * 0.1), top + fs * 0.7, two ? 'Ray 2' : 'Ray 1', fs * 0.95, ink));
  return parts;
}

// ---------------------------------------------------------------------------
// 3D Gaussian Splatting (Kerbl et al. 2023): nuvola di gaussiane, punti SfM, densificazione
// ---------------------------------------------------------------------------
function gaussians(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const w0 = words(n);
  const K = clamp(Math.round(n.count), 3, 60);
  const rand = rng(23 + K);
  const m = Math.min(w, h);
  const parts: Part[] = [];
  if (w0.includes('points')) {
    for (let k = 0; k < K; k++) parts.push(disc(x + (0.1 + 0.8 * rand()) * w, y + (0.1 + 0.8 * rand()) * h, clamp(m * 0.03, 1, 2.6), '#1A1A1A'));
    return parts;
  }
  const base = n.stroke === 'none' ? '#1E8C2E' : shade(n.stroke, -0.15);
  const multi = w0.includes('multi');
  const HUES = ['#2E7BE6', '#E8432E', '#F0A13A', '#2E9E44', '#9B59B6', '#17A2B8'];
  for (let k = 0; k < K; k++) {
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * 0.3;
    const cx = x + (0.5 + Math.cos(a) * rr) * w, cy = y + (0.5 + Math.sin(a) * rr * 0.8) * h;
    const s = m * (0.1 + rand() * 0.13);
    const color = multi ? HUES[k % HUES.length] : shade(base, (rand() - 0.5) * 0.3);
    parts.push(...softGauss(cx, cy, s, s * (0.35 + rand() * 0.5), rand() * Math.PI, color, 4));
  }
  return parts;
}

const KIDNEY: P2[] = [[0.3, 0.08], [0.56, 0.05], [0.86, 0.1], [0.93, 0.26], [0.76, 0.34], [0.6, 0.46], [0.63, 0.7], [0.56, 0.93], [0.38, 0.96], [0.24, 0.8], [0.21, 0.5], [0.18, 0.24]];

/** Controllo adattivo della densità (Kerbl et al. 2023, Fig. 4): clone e split. */
function densify(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const mode = ['under', 'clone', 'over', 'split', 'fit'].find((k) => words(n).includes(k)) ?? 'under';
  const m = Math.min(w, h);
  const P = (u: number, v: number): P2 => [x + u * w, y + v * h];
  const base = n.stroke === 'none' ? '#1E8C2E' : shade(n.stroke, -0.15);
  const G = (u: number, v: number, rx: number, ry: number, rot = 0) => softGauss(...P(u, v), rx * m, ry * m, rot, base, 6);
  const parts: Part[] = [];
  if (mode === 'under') parts.push(...G(0.36, 0.62, 0.15, 0.15));
  if (mode === 'clone') parts.push(...G(0.36, 0.62, 0.15, 0.15), ...G(0.46, 0.44, 0.15, 0.15));
  if (mode === 'over') parts.push(...G(0.4, 0.55, 0.52, 0.52));
  if (mode === 'split') parts.push(...G(0.32, 0.3, 0.24, 0.24), ...G(0.42, 0.7, 0.24, 0.24));
  if (mode === 'fit') parts.push(...G(0.38, 0.62, 0.22, 0.42, 0.15), ...G(0.62, 0.2, 0.34, 0.15, 0.1), ...G(0.3, 0.28, 0.17, 0.2, -0.3));
  parts.push({ kind: 'path', cmds: smooth(KIDNEY.map(([u, v]) => P(u, v))), fill: 'none', stroke: '#111111', sw: clamp(m * 0.012, 0.9, 1.6), solid: true });
  return parts;
}

// ---------------------------------------------------------------------------
// Glifi e piccoli schemi dei paper
// ---------------------------------------------------------------------------

/** Rete come in pix2pix (Isola et al. 2017, Fig. 2): barre verticali attraversate dal flusso. */
function netBars(n: NodeModel): Part[] {
  const K = clamp(Math.round(n.count), 1, 8);
  const ink = inkOf(n);
  const bw = n.w / (K + (K - 1) * 0.35);
  const parts: Part[] = [line(seg([n.x, n.y + n.h / 2], [n.x + n.w, n.y + n.h / 2]), ink, n.strokeWidth)];
  for (let i = 0; i < K; i++) parts.push({ kind: 'rect', x: n.x + i * bw * 1.35, y: n.y, w: bw, h: n.h, r: Math.min(n.radius, bw / 3), fill: n.fill });
  return parts;
}

/** Parentesi quadra che raccoglie una coppia di immagini (pix2pix): `direction` è il lato chiuso. */
function bracket(n: NodeModel): Part[] {
  const { x, y, w, h } = n;
  const ink = inkOf(n);
  const pts: Record<string, P2[]> = {
    right: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
    left: [[x + w, y], [x, y], [x, y + h], [x + w, y + h]],
    bottom: [[x, y], [x, y + h], [x + w, y + h], [x + w, y]],
    top: [[x, y + h], [x, y], [x + w, y], [x + w, y + h]],
  };
  return [line(poly(pts[n.direction], false), ink, n.strokeWidth)];
}

/** Maschere di RealNVP (Dinh et al. 2017, Fig. 3): scacchiera spaziale e squeeze in canali. */
function checker(n: NodeModel): Part[] {
  const ink = inkOf(n);
  const fill = n.fill === 'none' ? '#B8B8B8' : n.fill;
  const nums = words(n).includes('num');
  const parts: Part[] = [];
  if (words(n).includes('squeeze')) {
    // 4×4×1 → 2×2×4: quattro fogli 2×2, i primi due "attivi" (maschera per canali)
    const d = Math.min(n.w, n.h) * 0.1;
    const S = Math.min(n.w, n.h) - 3 * d;
    for (let k = 3; k >= 0; k--) {
      const sx = n.x + k * d, sy = n.y + (3 - k) * d;
      const c = S / 2;
      const f = k < 2 ? fill : '#FFFFFF';
      parts.push(rect(sx, sy, S, S, f, ink, n.strokeWidth));
      parts.push(line([...seg([sx + c, sy], [sx + c, sy + S]), ...seg([sx, sy + c], [sx + S, sy + c])], ink, n.strokeWidth * 0.6));
      if (nums && k === 0) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) parts.push(txt(sx + (i + 0.5) * c, sy + (j + 0.5) * c, '1', clamp(c * 0.42, 6, 13)));
    }
    return parts;
  }
  const N = clamp(Math.round(n.count), 2, 12);
  const S = Math.min(n.w, n.h);
  const c = S / N;
  const x0 = n.x + (n.w - S) / 2, y0 = n.y + (n.h - S) / 2;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      parts.push(rect(x0 + i * c, y0 + j * c, c, c, (i + j) % 2 ? '#FFFFFF' : fill, ink, n.strokeWidth * 0.6));
      if (nums) parts.push(txt(x0 + (i + 0.5) * c, y0 + (j + 0.5) * c, String((j % 2) * 2 + (i % 2) + 1), clamp(c * 0.42, 6, 13)));
    }
  parts.push(rect(x0, y0, S, S, 'none', ink, n.strokeWidth));
  return parts;
}

/** Mappe sfumate impilate: positional encoding 2-D di DETR (Carion et al. 2020, Fig. 2). */
function gradStack(n: NodeModel): Part[] {
  const K = clamp(Math.round(n.count), 1, 6);
  const ink = inkOf(n);
  const d = Math.min(n.w, n.h) * 0.08;
  const S = { w: n.w - (K - 1) * d, h: n.h - (K - 1) * d };
  const parts: Part[] = [];
  for (let k = K - 1; k >= 0; k--) {
    const sx = n.x + k * d, sy = n.y + (K - 1 - k) * d;
    const clip: ClipRect = { x: sx, y: sy, w: S.w, h: S.h, r: 0 };
    parts.push(rect(sx, sy, S.w, S.h, '#2E2E2E'));
    const cx = sx + S.w * (0.32 + 0.06 * k), cy = sy + S.h * (0.3 + 0.04 * k);
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const r = Math.max(S.w, S.h) * 1.15 * (1 - t * 0.9);
      parts.push({ kind: 'ellipse', cx, cy, rx: r, ry: r, fill: mix('#2E2E2E', '#F4F4F4', t), stroke: 'none', clip });
    }
    parts.push(rect(sx, sy, S.w, S.h, 'none', ink, n.strokeWidth));
  }
  return parts;
}

/** Blocco denso in miniatura (Huang et al. 2017, Fig. 2): ogni layer riceve tutti i precedenti. */
function denseIcon(n: NodeModel): Part[] {
  const K = clamp(Math.round(n.count), 2, 8);
  const ink = inkOf(n);
  const { x, w } = n;
  const r = Math.min(n.h * 0.12, w / (K * 4));
  const cy = n.y + r + n.h * 0.04;
  const X = (i: number) => x + r + ((w - 2 * r) * i) / (K - 1);
  const parts: Part[] = [];
  const arcs: Cmd[] = [];
  for (let i = 0; i < K; i++)
    for (let j = i + 2; j < K; j++) {
      const sag = (n.h - 2 * r) * (0.3 + (0.7 * (j - i - 1)) / Math.max(1, K - 2));
      arcs.push(['M', X(i), cy + r * 0.8], ['C', X(i), cy + sag, X(j) - r * 2, cy + sag, X(j) - r * 0.6, cy + r * 0.8]);
    }
  parts.push(line(arcs, shade(ink, 0.45), 0.7));
  for (let i = 1; i < K; i++) parts.push(...arrow([X(i - 1) + r, cy], [X(i) - r, cy], '#1A1A1A', 0.8, Math.min(5, r * 1.2)));
  for (let i = 0; i < K; i++) parts.push(disc(X(i), cy, r, i === 0 ? '#FFFFFF' : n.fill === 'none' ? '#8A8A8A' : n.fill, i === 0 ? shade(ink, 0.4) : ink, 0.8));
  return parts;
}

// ---------------------------------------------------------------------------
const one = (title: string, choices: (string | SpecChoice)[]): SpecGroup => ({ title, mode: 'one', choices });
const many = (title: string, choices: (string | SpecChoice)[]): SpecGroup => ({ title, mode: 'many', choices });

const RESA = one('Resa', [
  { value: 'photo', label: 'Foto' },
  { value: 'edges', label: 'Bordi' },
  { value: 'canny', label: 'Canny' },
  { value: 'seg', label: 'Segmentazione' },
  { value: 'depth', label: 'Profondità' },
  { value: 'gray', label: 'Grigi' },
]);
const VISTA = many('Vista', [
  { value: 'crop', label: 'Ritaglio' },
  { value: 'crop2', label: 'Ritaglio 2' },
  { value: 'local', label: 'Locale' },
  { value: 'flip', label: 'Specchio' },
  { value: 'jitter', label: 'Colore' },
  { value: 'blur', label: 'Sfocata' },
]);

export const DLG_SHAPES: ShapeDef[] = [
  {
    kind: 'dlg-scene',
    name: 'Immagine sintetica (paesaggio)',
    parts: scene,
    countLabel: 'Rumore (0–10)',
    countMax: 10,
    specLabel: 'Resa, vista e sovrapposizioni',
    specOptions: [
      RESA,
      VISTA,
      many('Sovrapposizioni', [
        { value: 'mask', label: 'Maschera' },
        { value: 'part', label: 'Parte' },
        { value: 'sub', label: 'Sotto-parte' },
        { value: 'point', label: 'Punto' },
        { value: 'bbox', label: 'Box prompt' },
        { value: 'boxes', label: 'Detection' },
      ]),
    ],
  },
  {
    kind: 'dlg-noisestrip',
    name: 'Striscia dati → rumore',
    parts: noiseStrip,
    countLabel: 'Fotogrammi',
    countMax: 10,
    specLabel: 'Verso e resa',
    specOptions: [many('Verso', [{ value: 'reverse', label: 'Rumore → dati' }, { value: 'gap', label: 'Spaziati' }, { value: 'arrows', label: 'Frecce' }]), RESA, VISTA],
  },
  {
    kind: 'dlg-masked',
    name: 'Patch mascherate (MAE)',
    parts: maskedPatches,
    countLabel: 'Patch per lato',
    countMax: 8,
    specLabel: 'Vista',
    specOptions: [
      one('Vista', [
        { value: 'masked', label: 'Griglia mascherata' },
        { value: 'image', label: 'Griglia intera' },
        { value: 'recon', label: 'Ricostruzione' },
        { value: 'visible', label: 'Patch visibili' },
        { value: 'tokens', label: 'Token' },
        { value: 'mixed', label: 'Token + mask' },
      ]),
      many('Sequenza', [{ value: 'all', label: 'Tutte le patch' }, { value: 'dots', label: 'Puntini' }]),
    ],
  },
  {
    kind: 'dlg-codebook',
    name: 'Codebook VQ / spazio degli embedding',
    parts: codebook,
    countLabel: 'Vettori mostrati',
    countMax: 16,
    specLabel: 'Vista',
    specOptions: [one('Vista', [{ value: 'table', label: 'Codebook' }, { value: 'space', label: 'Spazio 2-D' }])],
  },
  {
    kind: 'dlg-gridcube',
    name: 'Tensore a griglia (latente)',
    parts: gridCube,
    countLabel: 'Celle per lato',
    countMax: 12,
    specLabel: 'Forma e contenuto',
    specOptions: [many('Forma', [{ value: 'flat', label: 'Piatto (2-D)' }]), many('Contenuto', [{ value: 'codes', label: 'Codici e_k' }, { value: 'idx', label: 'Indici' }])],
  },
  {
    kind: 'dlg-flowpaths',
    name: 'Traiettorie π0 → π1 (flow)',
    parts: flowPaths,
    countLabel: 'Traiettorie per gruppo',
    countMax: 60,
    specLabel: 'Accoppiamento',
    specOptions: [
      one('Accoppiamento', [
        { value: 'interp', label: 'Interpolazione' },
        { value: 'rectified', label: 'Rectified flow' },
        { value: 'reflow', label: 'Reflow (interp.)' },
        { value: 'straight', label: '2-rectified' },
      ]),
    ],
  },
  {
    kind: 'dlg-nerfrays',
    name: 'Raggi NeRF nel volume',
    parts: nerfRays,
    countLabel: 'Campioni per raggio',
    countMax: 14,
    specLabel: 'Campioni',
    specOptions: [one('Campioni', [{ value: 'input', label: 'Posizioni (5D)' }, { value: 'output', label: 'Colore + densità' }])],
  },
  {
    kind: 'dlg-raydensity',
    name: 'Densità lungo il raggio',
    parts: rayDensity,
    specLabel: 'Raggio',
    specOptions: [one('Raggio', [{ value: 'ray1', label: 'Ray 1' }, { value: 'ray2', label: 'Ray 2' }])],
  },
  {
    kind: 'dlg-gaussians',
    name: 'Gaussiane 3D / punti SfM',
    parts: gaussians,
    countLabel: 'Elementi',
    countMax: 60,
    specLabel: 'Tipo',
    specOptions: [one('Tipo', [{ value: 'splats', label: 'Gaussiane' }, { value: 'points', label: 'Punti SfM' }]), many('Colori', [{ value: 'multi', label: 'Multicolore' }])],
  },
  {
    kind: 'dlg-densify',
    name: 'Densificazione (clone / split)',
    parts: densify,
    specLabel: 'Stato',
    specOptions: [
      one('Stato', [
        { value: 'under', label: 'Sotto-ricostruita' },
        { value: 'clone', label: 'Clone' },
        { value: 'over', label: 'Sovra-ricostruita' },
        { value: 'split', label: 'Split' },
        { value: 'fit', label: 'Ottimizzata' },
      ]),
    ],
  },
  { kind: 'dlg-netbars', name: 'Rete (barre, pix2pix)', parts: netBars, countLabel: 'Barre', countMax: 8 },
  { kind: 'dlg-bracket', name: 'Parentesi quadra', parts: bracket, directionLabel: 'Lato chiuso' },
  {
    kind: 'dlg-checker',
    name: 'Maschera RealNVP',
    parts: checker,
    countLabel: 'Celle per lato',
    countMax: 12,
    specLabel: 'Maschera',
    specOptions: [one('Maschera', [{ value: 'checker', label: 'Scacchiera' }, { value: 'squeeze', label: 'Squeeze (canali)' }]), many('Numeri', [{ value: 'num', label: 'Indici' }])],
  },
  { kind: 'dlg-gradstack', name: 'Mappe sfumate (pos. enc. 2-D)', parts: gradStack, countLabel: 'Fogli', countMax: 6 },
  { kind: 'dlg-dense', name: 'Blocco denso (icona)', parts: denseIcon, countLabel: 'Layer', countMax: 8 },
];
