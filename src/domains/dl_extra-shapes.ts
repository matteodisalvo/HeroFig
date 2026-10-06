// Forme schematiche DL/graph/operator learning. Coordinate normalizzate, nessun raster.
import { mix, poly, rng, type Cmd, type Part } from '../draw';
import { COLORS, type NodeModel } from '../model';
import type { ShapeDef, SpecGroup } from '../registry';

type P = [number, number];
const { BLUE, GREEN, ORANGE, PURPLE, RED, TEAL, GRAY, YELLOW } = COLORS;
const PAL = [BLUE, GREEN, ORANGE, PURPLE, TEAL, RED];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v)));
const has = (n: NodeModel, s: string) => n.spec.split(/\s+/).includes(s);
const options = (title: string, choices: [string, string][]): SpecGroup[] => [{ title, choices: choices.map(([value, label]) => ({ value, label })) }];

/** Piccolo pennello: le coordinate 0–1 si adattano al blocco; testo senza effetti. */
function pen(n: NodeModel) {
  const p: Part[] = [], ink = n.stroke === 'none' ? '#596575' : n.stroke;
  const xy = (u: number, v: number): P => [n.x + n.w * u, n.y + n.h * v];
  const path = (pts: P[], stroke = ink, width = n.strokeWidth) => {
    const cmds: Cmd[] = pts.map(([u, v], i) => [i ? 'L' : 'M', ...xy(u, v)] as Cmd);
    p.push({ kind: 'path', cmds, fill: 'none', stroke, sw: width, solid: true });
  };
  const rect = (x: number, y: number, w: number, h: number, fill = n.fill, stroke = ink, r = 3) =>
    p.push({ kind: 'rect', x: n.x + x * n.w, y: n.y + y * n.h, w: w * n.w, h: h * n.h, r, fill, stroke, sw: n.strokeWidth, solid: true });
  const dot = (x: number, y: number, r = .035, fill = n.fill, stroke = ink) =>
    p.push({ kind: 'ellipse', cx: n.x + x * n.w, cy: n.y + y * n.h, rx: r * Math.min(n.w, n.h), ry: r * Math.min(n.w, n.h), fill, stroke, sw: n.strokeWidth, solid: true });
  const text = (x: number, y: number, value: string, size = 10, fill = '#344054', bold = false) =>
    p.push({ kind: 'text', x: n.x + x * n.w, y: n.y + y * n.h, text: value, size: Math.min(size, n.h * .15), fill, bold, anchor: 'middle' });
  const arrow = (a: P, b: P, stroke = ink, width = n.strokeWidth) => {
    const A = xy(...a), B = xy(...b), l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    const dx = (B[0] - A[0]) / l, dy = (B[1] - A[1]) / l, z = Math.min(5, l * .22);
    p.push({ kind: 'path', cmds: [['M', ...A], ['L', B[0] - z * dx, B[1] - z * dy]], fill: 'none', stroke, sw: width, solid: true });
    p.push({ kind: 'path', cmds: poly([B, [B[0] - z * dx - z * .45 * dy, B[1] - z * dy + z * .45 * dx], [B[0] - z * dx + z * .45 * dy, B[1] - z * dy - z * .45 * dx]]), fill: stroke, stroke: 'none' });
  };
  return { p, xy, path, rect, dot, text, arrow, ink };
}

function optimizer(n: NodeModel): Part[] {
  const d = pen(n), c = clamp(n.count, 3, 10);
  const keys = has(n, 'first') ? ['g', 'm'] : has(n, 'second') ? ['$g^2$', 'v'] : has(n, 'adamw') ? ['$\\theta$', 'm', 'v'] : ['g'];
  const rand = rng(61);
  keys.forEach((key, row) => {
    const y = .08 + row * .83 / keys.length, h = .62 / keys.length;
    d.text(.08, y + h / 2, key, 13, '#344054', true);
    for (let i = 0; i < c; i++) {
      const color = PAL[row];
      d.rect(.18 + i * .75 / c, y, .75 / c - .007, h, mix('#FFFFFF', color.fill, .3 + rand() * .7), color.stroke, 1);
      if (has(n, 'second') && row === 1) d.dot(.18 + (i + .5) * .75 / c, y + h * .5, .009, color.stroke, 'none');
    }
  });
  if (keys.length === 1) {
    d.path([[.2, .76], [.9, .76]], '#C6CED8');
    for (let i = 0; i < c; i++) {
      const v = (rand() - .5) * .32;
      d.rect(.2 + i * .7 / c, v > 0 ? .76 - v : .76, .55 / c, Math.abs(v), v > 0 ? BLUE.fill : RED.fill, v > 0 ? BLUE.stroke : RED.stroke, 0);
    }
  }
  return d.p;
}

function gradients(n: NodeModel): Part[] {
  const d = pen(n), k = clamp(n.count, 2, 6);
  if (has(n, 'clip')) {
    d.path([[.1, .86], [.9, .86]], '#C1CBD6'); d.path([[.15, .95], [.15, .05]], '#C1CBD6');
    const cx = .36, cy = .61, r = .21;
    d.p.push({ kind: 'ellipse', cx: n.x + n.w * cx, cy: n.y + n.h * cy, rx: n.h * r, ry: n.h * r, fill: '#F3F7FC', stroke: BLUE.stroke, sw: 1 });
    for (let i = 0; i < k; i++) {
      const a = -.35 - i * .92 / (k - 1), end: P = [cx + Math.cos(a) * .54, cy + Math.sin(a) * .58];
      d.arrow([cx, cy], end, '#D9B4B3', .85);
      const px = (end[0] - cx) * n.w, py = (end[1] - cy) * n.h, l = Math.hypot(px, py);
      d.arrow([cx, cy], [cx + px / l * n.h * r / n.w, cy + py / l * r], RED.stroke, 1.4);
    }
    d.text(.73, .9, 'max norm', 9);
  } else if (has(n, 'allreduce')) {
    const positions: P[] = Array.from({ length: k }, (_, i) => [.5 + .34 * Math.cos(i * 2 * Math.PI / k - Math.PI / 2), .5 + .32 * Math.sin(i * 2 * Math.PI / k - Math.PI / 2)]);
    positions.forEach((a, i) => d.arrow(a, positions[(i + 1) % k], '#A8B7CA'));
    positions.forEach(([x, y], i) => { d.rect(x - .085, y - .075, .17, .15, PAL[i].fill, PAL[i].stroke); d.text(x, y, `g${i + 1}`, 10); });
    d.text(.5, .5, '$\\Sigma / N$', 13, '#526B88', true);
  } else {
    for (let i = 0; i < k; i++) {
      const y = .1 + i * .74 / (k - 1);
      d.rect(.04, y - .055, .19, .11, PAL[i].fill, PAL[i].stroke, 2); d.text(.135, y, `g${i + 1}`, 9);
      d.arrow([.25, y], [.54, .48], PAL[i].stroke, .8);
    }
    d.rect(.56, .31, .17, .34, GREEN.fill, GREEN.stroke, 4); d.text(.645, .48, '$\\Sigma$', 18, GREEN.stroke);
    d.arrow([.74, .48], [.87, .48]);
    d.rect(.88, .36, .1, .24, BLUE.fill, BLUE.stroke, 2);
    d.text(.67, .81, has(n, 'mean') ? 'divide by K' : 'accumulate', 9);
  }
  return d.p;
}

function checkpoints(n: NodeModel): Part[] {
  const d = pen(n), k = clamp(n.count, 4, 12), cw = .82 / k;
  for (let i = 0; i < k; i++) {
    const x = .05 + i * .9 / k, keep = has(n, 'all') || i === 0 || i === k - 1 || i % 3 === 0;
    if (i < k - 1) d.arrow([x + cw, .35], [x + .9 / k, .35], '#A2AEBB', .8);
    d.rect(x, .18, cw, .34, BLUE.fill, BLUE.stroke, 2); d.text(x + cw / 2, .35, String(i + 1), 10);
    d.path([[x + cw / 2, .54], [x + cw / 2, .7]], keep ? GREEN.stroke : '#D3DBE4', .8);
    if (keep) d.rect(x + .008, .72, cw - .016, .15, GREEN.fill, GREEN.stroke, 2);
    else d.dot(x + cw / 2, .795, .017, '#FFF', '#C8D0DB');
  }
  if (has(n, 'recompute')) {
    d.path([[.16, .09], [.16, .02], [.62, .02], [.62, .1]], ORANGE.stroke, 1.1);
    d.arrow([.62, .1], [.62, .17], ORANGE.stroke); d.text(.38, .94, 'recompute segment', 9, ORANGE.stroke);
  }
  return d.p;
}

function states(n: NodeModel): Part[] {
  const d = pen(n), k = clamp(n.count, 3, 7), step = .9 / k, bw = step * .62;
  if (has(n, 'scan')) {
    const stages = Math.ceil(Math.log2(k)), dy = .8 / stages;
    for (let row = 0; row <= stages; row++) {
      for (let i = 0; i < k; i++) {
        const cx = .05 + i * step + bw / 2, y = .08 + row * dy;
        if (row > 0) {
          d.arrow([cx, y - dy + .065], [cx, y - .065], '#B9C4D2', .65);
          const stride = 2 ** (row - 1);
          if (i >= stride) d.arrow([cx - stride * step, y - dy + .065], [cx, y - .065], ORANGE.stroke, .8);
        }
        d.rect(cx - bw / 2, y - .065, bw, .13, row === stages ? GREEN.fill : BLUE.fill, row === stages ? GREEN.stroke : BLUE.stroke, 2);
        d.text(cx, y, row === 0 ? `T${i + 1}` : i >= 2 ** (row - 1) ? '$\\circ$' : 'T', 9);
      }
    }
    return d.p;
  }
  if (has(n, 'convolution')) {
    const cell = Math.min(n.w * .6 / k, n.h * .66 / k);
    const ox = n.x + n.w * .12, oy = n.y + n.h * .13;
    for (let r = 0; r < k; r++) for (let c = 0; c < k; c++)
      d.p.push({ kind: 'rect', x: ox + c * cell, y: oy + r * cell, w: cell, h: cell, r: 0, fill: c <= r ? PAL[(r - c) % 5].fill : '#FAFBFC', stroke: '#AAB9CA', sw: .65 });
    d.text(.77, .38, '$K \\ast u$', 13); d.text(.77, .58, 'LTI only', 9, '#6C7888');
    return d.p;
  }
  for (let i = 0; i < k; i++) {
    const x = .05 + i * step, cx = x + bw / 2;
    if (i < k - 1) d.arrow([x + bw, .48], [x + step, .48], GREEN.stroke);
    d.rect(x, .33, bw, .28, GREEN.fill, GREEN.stroke, 3); d.text(cx, .47, `h${i + 1}`, 10);
    d.arrow([cx, .85], [cx, .64], BLUE.stroke); d.dot(cx, .91, .025, BLUE.fill, BLUE.stroke);
    d.arrow([cx, .3], [cx, .11], PURPLE.stroke); d.dot(cx, .06, .025, PURPLE.fill, PURPLE.stroke);
    if (has(n, 'selective')) { d.rect(cx - .025, .73, .05, .08, ORANGE.fill, ORANGE.stroke, 1); }
  }
  return d.p;
}

function adapters(n: NodeModel): Part[] {
  const d = pen(n), rank = clamp(n.count, 1, 8), narrow = .04 + .016 * rank;
  if (has(n, 'lowrank')) {
    d.rect(.03, .15, .28, .68, GRAY.fill, GRAY.stroke); d.text(.17, .49, '$W_0$', 16, '#657080');
    d.text(.37, .49, '+', 19);
    d.rect(.43, .15, narrow, .68, BLUE.fill, BLUE.stroke, 1); d.text(.43 + narrow / 2, .49, 'B', 13);
    d.rect(.66, .43, .3, narrow, ORANGE.fill, ORANGE.stroke, 1); d.text(.81, .43 + narrow / 2, 'A', 13);
    d.text(.18, .96, 'frozen', 9); d.text(.72, .91, 'rank r', 9);
    return d.p;
  }
  d.arrow([.04, .52], [.18, .52]);
  d.rect(.2, .32, .22, .4, GRAY.fill, GRAY.stroke); d.text(.31, .52, 'W', 16);
  d.arrow([.44, .52], [.57, .52]);
  if (has(n, 'gate')) {
    d.rect(.59, .25, .07, .54, ORANGE.fill, ORANGE.stroke, 1);
    for (let i = 0; i < 4; i++) d.path([[.6, .3 + i * .11], [.65, .3 + i * .11]], ORANGE.stroke, .7);
    d.text(.625, .13, 'l', 13); d.arrow([.69, .52], [.95, .52]);
  } else if (has(n, 'parallel')) {
    const x = .21, y = .04;
    d.rect(x, y, .12, .25, BLUE.fill, BLUE.stroke, 2); d.text(x + .06, y + .125, '$\\downarrow$', 13);
    d.rect(x + .17, y + (.25 - narrow) / 2, .07, narrow, ORANGE.fill, ORANGE.stroke, 2);
    d.rect(x + .29, y, .12, .25, GREEN.fill, GREEN.stroke, 2); d.text(x + .35, y + .125, '$\\uparrow$', 13);
    d.path([[x + .12, y + .125], [x + .17, y + .125]], BLUE.stroke); d.path([[x + .24, y + .125], [x + .29, y + .125]], GREEN.stroke);
    d.dot(.9, .53, .05, '#FFF', '#778592'); d.text(.9, .53, '+', 14);
    d.path([[.15, .52], [.15, .165], [.21, .165]], BLUE.stroke); d.path([[.62, .165], [.9, .165], [.9, .47]], GREEN.stroke);
    d.arrow([.56, .52], [.85, .52]);
  } else {
    d.rect(.54, .32, .1, .28, BLUE.fill, BLUE.stroke, 2); d.text(.59, .46, '$\\downarrow$', 12);
    d.rect(.69, .46 - narrow / 2, .055, narrow, ORANGE.fill, ORANGE.stroke, 2);
    d.rect(.79, .32, .1, .28, GREEN.fill, GREEN.stroke, 2); d.text(.84, .46, '$\\uparrow$', 12);
    d.path([[.64, .46], [.69, .46]], BLUE.stroke); d.path([[.745, .46], [.79, .46]], GREEN.stroke);
    d.dot(.96, .46, .04, '#FFF', '#778592'); d.text(.96, .46, '+', 12);
    d.path([[.89, .46], [.935, .46]], GREEN.stroke);
    d.path([[.48, .52], [.48, .86], [.96, .86], [.96, .51]], '#9AA8B5');
  }
  return d.p;
}

function dispatch(n: NodeModel): Part[] {
  const d = pen(n), k = clamp(n.count, 2, 5), nt = 6;
  if (has(n, 'load')) {
    d.path([[.08, .86], [.96, .86]], '#B5C0CC');
    for (let j = 0; j < k; j++) {
      const h = j === 0 ? .62 : .22 + (j % 2) * .17, x = .14 + j * .78 / k;
      d.rect(x, .86 - h, .52 / k, h, PAL[j].fill, PAL[j].stroke, 1); d.text(x + .26 / k, .96, `E${j + 1}`, 9);
    }
    d.path([[.08, .4], [.96, .4]], RED.stroke, 1.2); d.text(.8, .28, 'capacity', 9, RED.stroke);
    return d.p;
  }
  for (let i = 0; i < nt; i++) {
    const y = .06 + i * .17, target = has(n, 'capacity') ? (i < 4 ? 0 : i % k) : i % k;
    d.rect(.02, y, .11, .085, PAL[target].fill, PAL[target].stroke, 2);
    const overflow = has(n, 'capacity') && i >= 2 && i < 4;
    if (overflow) { d.path([[.15, y + .04], [.43, y + .04]], RED.stroke); d.text(.49, y + .04, '$\\times$', 14, RED.stroke); }
    else d.arrow([.15, y + .04], [.75, .14 + target * .72 / (k - 1)], PAL[target].stroke, .75);
    if (has(n, 'top2')) d.arrow([.15, y + .04], [.75, .14 + ((target + 1) % k) * .72 / (k - 1)], PAL[(target + 1) % k].stroke, .65);
  }
  for (let j = 0; j < k; j++) {
    const y = .14 + j * .72 / (k - 1);
    d.rect(.76, y - .075, .2, .15, PAL[j].fill, PAL[j].stroke, 3); d.text(.86, y, `E${j + 1}`, 10);
  }
  return d.p;
}

function precision(n: NodeModel): Part[] {
  const d = pen(n), cells = clamp(n.count, 3, 8);
  if (has(n, 'scale')) {
    d.rect(.02, .12, .32, .25, YELLOW.fill, YELLOW.stroke); d.text(.18, .245, '$L \\times S$', 13);
    d.arrow([.37, .245], [.62, .245], YELLOW.stroke);
    d.rect(.65, .12, .32, .25, ORANGE.fill, ORANGE.stroke); d.text(.81, .245, '$\\nabla(S L)$', 12);
    d.arrow([.81, .4], [.81, .64], '#8292A7');
    d.rect(.65, .67, .32, .23, BLUE.fill, BLUE.stroke); d.text(.81, .785, 'g / S', 12);
    d.text(.24, .77, 'unscale before clip', 9);
    return d.p;
  }
  const master = has(n, 'master');
  for (let row = 0; row < 2; row++) {
    const y = .14 + row * .54, bits = row === 0 || master ? 32 : 16;
    d.text(.13, y + .08, row === 0 ? 'FP32' : 'FP16', 10);
    for (let i = 0; i < cells; i++) d.rect(.27 + i * .66 / cells, y, .63 / cells, bits === 32 && row === 0 ? .2 : .11, row === 0 ? BLUE.fill : GREEN.fill, row === 0 ? BLUE.stroke : GREEN.stroke, 1);
  }
  d.arrow([.59, .38], [.59, .65]); d.text(.8, .49, 'cast', 9);
  if (master) { d.path([[.23, .79], [.19, .79], [.19, .46]], ORANGE.stroke); d.text(.34, .96, 'master weights', 9, BLUE.stroke); }
  return d.p;
}

function graphTypes(n: NodeModel): Part[] {
  const d = pen(n), k = clamp(n.count, 4, 10), rad = Math.min(.065, .35 / Math.sqrt(k));
  const nodes: P[] = Array.from({ length: k }, (_, i) => has(n, 'bipartite') ? [i % 2 ? .8 : .2, .12 + Math.floor(i / 2) * .76 / (Math.ceil(k / 2) - 1)] : [.5 + .37 * Math.cos(i * Math.PI * 2 / k), .5 + .36 * Math.sin(i * Math.PI * 2 / k)]);
  if (has(n, 'hyper')) {
    [[.18, .21, .66, .42], [.33, .1, .37, .79]].forEach(([x, y, w, h], i) => d.rect(x, y, w, h, PAL[i].fill, PAL[i].stroke, Math.min(n.w, n.h) * .16));
  } else {
    nodes.forEach((a, i) => {
      const oddTargets = nodes.map((_, j) => j).filter(j => j % 2 === 1);
      const j = has(n, 'bipartite') ? (i % 2 ? i - 1 : oddTargets[(Math.floor(i / 2) + 1) % oddTargets.length]) : (i + 1) % k;
      if (j >= 0 && j < k) d.path([a, nodes[j]], has(n, 'typed') ? PAL[i % 3].stroke : '#AAB7C6', 1);
      if (i % 2 === 0 && !has(n, 'bipartite')) d.path([a, nodes[(i + 3) % k]], '#CFD6DF', .8);
      if (has(n, 'edgefeat')) { const b = nodes[(i + 1) % k]; d.rect((a[0] + b[0]) / 2 - .027, (a[1] + b[1]) / 2 - .035, .054, .07, ORANGE.fill, ORANGE.stroke, 1); }
    });
  }
  nodes.forEach(([x, y], i) => {
    const c = PAL[has(n, 'typed') ? i % 3 : has(n, 'bipartite') ? i % 2 : 0];
    if (has(n, 'typed') && i % 3 === 1) d.rect(x - .04, y - .04, .08, .08, c.fill, c.stroke, 1);
    else d.dot(x, y, rad, c.fill, c.stroke);
  });
  return d.p;
}

function pooling(n: NodeModel): Part[] {
  const d = pen(n), k = clamp(n.count, 2, 4);
  if (has(n, 'assignment')) {
    const rows = k * 2;
    for (let i = 0; i < rows; i++) for (let j = 0; j < k; j++) {
      const v = j === Math.floor(i / 2) ? .85 : .08;
      d.rect(.17 + j * .64 / k, .07 + i * .86 / rows, .62 / k, .83 / rows, mix('#FFFFFF', PAL[j].stroke, v), '#C6CDD7', 1);
    }
    return d.p;
  }
  for (let j = 0; j < k; j++) {
    const y = .12 + j * .76 / (k - 1), c = PAL[j];
    d.path([[.12, y - .05], [.3, y + .05]], c.stroke);
    d.dot(.12, y - .05, .035, c.fill, c.stroke); d.dot(.3, y + .05, .035, c.fill, c.stroke);
    const a: P = [.38, y], b: P = [.71, y]; d.arrow(has(n, 'unpool') ? b : a, has(n, 'unpool') ? a : b, c.stroke);
    if (j < k - 1) d.path([[.81, y], [.81, .12 + (j + 1) * .76 / (k - 1)]], '#ADB9C7');
    d.dot(.81, y, .064, c.fill, c.stroke);
  }
  return d.p;
}

function collocation(n: NodeModel): Part[] {
  const d = pen(n), k = clamp(n.count, 8, 64), rand = rng(932), adaptive = has(n, 'adaptive');
  d.rect(.1, .08, .8, .78, '#FBFCFE', '#A9B8CC', 2);
  d.text(.5, .97, 'x', 11); d.text(.025, .48, 't', 11);
  for (let i = 0; i < k; i++) {
    let x = .14 + rand() * .72, y = .12 + rand() * .7, color = BLUE;
    if (has(n, 'boundary')) { x = i % 2 ? .9 : .1; y = .1 + (i + .5) / k * .74; color = RED; }
    else if (has(n, 'initial')) { x = .13 + (i + .5) / k * .74; y = .86; color = GREEN; }
    else if (adaptive && i < k * .7) { x = .22 + rand() * .25; y = .5 + rand() * .26; color = ORANGE; }
    d.dot(x, y, adaptive && i < k * .7 ? .015 : .012, color.stroke, 'none');
  }
  if (adaptive) d.path([[.18, .48], [.51, .48], [.51, .8], [.18, .8], [.18, .48]], ORANGE.stroke, .8);
  return d.p;
}

function operatorInput(n: NodeModel): Part[] {
  const d = pen(n), k = clamp(n.count, 3, 10);
  if (has(n, 'coordinates')) {
    d.path([[.15, .86], [.89, .86]], '#B2BFCE'); d.path([[.15, .86], [.15, .09]], '#B2BFCE');
    d.text(.93, .9, 'x', 10); d.text(.1, .06, 'y', 10);
    const rand = rng(32);
    for (let i = 0; i < k; i++) { const x = .23 + rand() * .58, y = .17 + rand() * .56; d.dot(x, y, .025, PURPLE.fill, PURPLE.stroke); }
  } else if (has(n, 'basis')) {
    for (let j = 0; j < k; j++) {
      const pts: P[] = Array.from({ length: 45 }, (_, i) => [.1 + i / 44 * .8, .5 - Math.sin(i / 44 * Math.PI * (j + 1)) * (.34 - j * .018)]);
      d.path(pts, PAL[j % PAL.length].stroke, .8);
    }
    d.path([[.09, .84], [.92, .84]], '#BBC7D5');
  } else {
    const f = (x: number) => .48 - .26 * Math.sin(x * Math.PI * 2) + .09 * Math.cos(x * Math.PI * 4);
    d.path(Array.from({ length: 60 }, (_, i): P => [.07 + i / 59 * .86, f(i / 59)]), BLUE.stroke, 1.4);
    d.path([[.06, .88], [.96, .88]], '#B7C2D0');
    for (let i = 0; i < k; i++) { const x = .08 + i / (k - 1) * .84, y = f(i / (k - 1)); d.path([[x, .88], [x, y]], '#CDD8E7', .75); d.dot(x, y, .026, ORANGE.fill, ORANGE.stroke); }
  }
  return d.p;
}

export const DL_EXTRA_SHAPES: ShapeDef[] = [
  { kind: 'dlex-optimizer', name: 'Stati dell’ottimizzatore', parts: optimizer, countLabel: 'Parametri illustrati', countMax: 10, specLabel: 'Stato', specOptions: options('Stato', [['gradient', 'Gradiente'], ['first', 'Primo momento'], ['second', 'Secondo momento'], ['adamw', 'Pesi e momenti']]) },
  { kind: 'dlex-gradients', name: 'Gestione dei gradienti', parts: gradients, countLabel: 'Contributi / worker', countMax: 6, specLabel: 'Operazione', specOptions: options('Operazione', [['sum', 'Accumulo'], ['mean', 'Media'], ['allreduce', 'All-reduce'], ['clip', 'Clipping della norma']]) },
  { kind: 'dlex-checkpoint', name: 'Memoria delle attivazioni', parts: checkpoints, countLabel: 'Layer', countMax: 12, specLabel: 'Memoria', specOptions: options('Memoria', [['all', 'Tutte salvate'], ['sparse', 'Checkpoint'], ['recompute', 'Ricalcolo']]) },
  { kind: 'dlex-state', name: 'Stati e scan SSM', parts: states, countLabel: 'Passi temporali', countMax: 7, specLabel: 'Rappresentazione', specOptions: options('Rappresentazione', [['recurrent', 'Ricorrenza'], ['selective', 'Selettivo'], ['scan', 'Scan associativo'], ['convolution', 'Convoluzione LTI']]) },
  { kind: 'dlex-adapter', name: 'Struttura di un adapter', parts: adapters, countLabel: 'Larghezza del rango', countMax: 8, specLabel: 'Adattamento', specOptions: options('Adattamento', [['serial', 'Bottleneck seriale'], ['parallel', 'Ramo parallelo'], ['gate', 'Riscalamento IA3'], ['lowrank', 'Matrici LoRA']]) },
  { kind: 'dlex-dispatch', name: 'Dispatch token-esperti', parts: dispatch, countLabel: 'Esperti', countMax: 5, specLabel: 'Routing', specOptions: options('Routing', [['top1', 'Top-1'], ['top2', 'Top-2'], ['capacity', 'Overflow'], ['load', 'Carico e capacità']]) },
  { kind: 'dlex-precision', name: 'Precisione in addestramento', parts: precision, countLabel: 'Elementi illustrati', countMax: 8, specLabel: 'Operazione', specOptions: options('Operazione', [['cast', 'Cast FP32 / FP16'], ['master', 'Master weights'], ['scale', 'Loss scaling']]) },
  { kind: 'dlex-graph', name: 'Strutture di grafo', parts: graphTypes, countLabel: 'Nodi', countMax: 10, specLabel: 'Struttura', specOptions: options('Struttura', [['bipartite', 'Bipartito'], ['typed', 'Eterogeneo'], ['hyper', 'Ipergrafo'], ['edgefeat', 'Feature sugli archi']]) },
  { kind: 'dlex-pooling', name: 'Coarsening di grafi', parts: pooling, countLabel: 'Cluster', countMax: 4, specLabel: 'Operazione', specOptions: options('Operazione', [['pool', 'Coarsening'], ['assignment', 'Assegnazione soft'], ['unpool', 'Unpooling']]) },
  { kind: 'dlex-collocation', name: 'Punti di collocazione', parts: collocation, countLabel: 'Punti', countMax: 64, specLabel: 'Campionamento', specOptions: options('Campionamento', [['interior', 'Interni'], ['boundary', 'Bordi spaziali'], ['initial', 'Condizione iniziale'], ['adaptive', 'Raffinamento locale']]) },
  { kind: 'dlex-operator', name: 'Input di un operatore neurale', parts: operatorInput, countLabel: 'Sensori / basi', countMax: 10, specLabel: 'Input', specOptions: options('Input', [['sensors', 'Campioni di funzione'], ['coordinates', 'Coordinate di query'], ['basis', 'Funzioni di base']]) },
];
