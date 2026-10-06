// Impaginazione delle formule "a due piani": frazioni impilate (\frac, \dfrac, \tfrac)
// e operatori con indici sopra e sotto (\sum, \prod, \lim, \max, \arg\max…).
// Le righe senza questi costrutti continuano a usare il percorso semplice di Label
// (tspan in linea); queste invece vengono scomposte in pezzi posizionati e linee.
// Nell'export TikZ le formule passano invariate con \displaystyle (vedi export/tikz.ts).
import { FONT_CSS, LINE_H, type FontFamily } from './model';
import { mathToRuns, splitMath, type Run } from './richtext';

/** Le formule si compongono in un serif, come in LaTeX. */
export const MATH_FONT = "'STIX Two Text', 'Times New Roman', Times, serif";

const FRAC_SCALE: Record<string, number> = { frac: 0.85, dfrac: 1, tfrac: 0.72 };
const BIG_OPS: Record<string, string> = {
  sum: '∑', prod: '∏', coprod: '∐', bigcup: '⋃', bigcap: '⋂', bigoplus: '⨁', bigotimes: '⨂', bigvee: '⋁', bigwedge: '⋀',
};
const TEXT_OPS: Record<string, string> = {
  lim: 'lim', max: 'max', min: 'min', argmax: 'arg max', argmin: 'arg min', sup: 'sup', inf: 'inf', limsup: 'lim sup', liminf: 'lim inf',
};

const LAYOUT_RE = new RegExp(
  // apice e pedice sulla stessa base (x^{a}_{b}) vanno impilati: anche questo passa di qui
  `[\\^](\\{[^{}]*\\}|\\\\[a-zA-Z]+|[^\\s{\\\\])\\s*_|_(\\{[^{}]*\\}|\\\\[a-zA-Z]+|[^\\s{\\\\])\\s*\\^|` +
    `\\\\[dt]?frac\\s*\\{|\\\\sqrt\\s*\\{|\\\\left\\s*[([|.]|\\\\left\\s*\\\\[{|]|\\\\(${[...Object.keys(BIG_OPS), ...Object.keys(TEXT_OPS)].join('|')})(?![a-zA-Z])\\s*(\\\\limits\\s*)?[_^]`,
);

/** Vero se la riga contiene una frazione o un operatore con limiti (in una formula). */
export function needsLayout(line: string): boolean {
  return line.includes('$') && splitMath(line).some((p) => p.math && LAYOUT_RE.test(p.text));
}

/** Stessa verifica sul solo sorgente di una formula (senza $). */
export const mathNeedsDisplay = (src: string) => LAYOUT_RE.test(src);

// ---------- analisi ----------

type Item =
  | { kind: 'runs'; runs: Run[] }
  | { kind: 'frac'; num: Item[]; den: Item[]; scale: number }
  | { kind: 'sqrt'; body: Item[] }
  | { kind: 'delim'; left: string; right: string; body: Item[] }
  | { kind: 'op'; text: string; big: boolean; lower: Item[] | null; upper: Item[] | null };

const skipSpaces = (s: string, i: number) => {
  while (i < s.length && s[i] === ' ') i++;
  return i;
};

/** Argomento a partire da i: gruppo {…} bilanciato, comando \nome o singolo carattere. */
function readArg(s: string, i: number): [string, number] {
  i = skipSpaces(s, i);
  if (s[i] === '{') {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '\\') {
        j++;
        continue;
      }
      if (s[j] === '{') depth++;
      else if (s[j] === '}' && --depth === 0) return [s.slice(i + 1, j), j + 1];
    }
    return [s.slice(i + 1), s.length];
  }
  const m = /^\\[a-zA-Z]+/.exec(s.slice(i));
  if (m) return [m[0], i + m[0].length];
  return [s[i] ?? '', i + 1];
}

/** Comando `\name` in posizione i, non l'inizio di uno più lungo (\left ma non \leftarrow). */
const isCmd = (s: string, i: number, name: string) => s.startsWith('\\' + name, i) && !/[a-zA-Z]/.test(s[i + name.length + 1] ?? '');

const DELIMS: Record<string, string> = { '(': '(', ')': ')', '[': '[', ']': ']', '|': '|', '.': '', '\\{': '{', '\\}': '}', '\\|': '‖', '\\langle': '⟨', '\\rangle': '⟩' };

/** Delimitatore dopo \left o \right: ( ) [ ] | . \{ \} \| \langle \rangle. */
function readDelim(s: string, i: number): [string, number] {
  i = skipSpaces(s, i);
  for (const [k, v] of Object.entries(DELIMS)) if (s.startsWith(k, i)) return [v, i + k.length];
  return ['', i];
}

function parseMath(src: string): Item[] {
  const items: Item[] = [];
  let buf = '';
  const flush = () => {
    if (buf) items.push({ kind: 'runs', runs: mathToRuns(buf) });
    buf = '';
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(src.slice(i));
      if (!m) {
        buf += src.slice(i, i + 2);
        i += 2;
        continue;
      }
      const name = m[1];
      const after = i + m[0].length;
      if (name in FRAC_SCALE && src[skipSpaces(src, after)] === '{') {
        flush();
        const [num, j] = readArg(src, after);
        const [den, k] = readArg(src, j);
        items.push({ kind: 'frac', num: parseMath(num), den: parseMath(den), scale: FRAC_SCALE[name] });
        i = k;
        continue;
      }
      if (name === 'left') {
        // \left( … \right): cerca il \right corrispondente (anche annidato)
        const [l, j] = readDelim(src, after);
        let depth = 1;
        let k = j;
        for (; k < src.length; k++) {
          if (isCmd(src, k, 'left')) depth++;
          else if (isCmd(src, k, 'right') && --depth === 0) break;
        }
        if (k < src.length) {
          const [r, end] = readDelim(src, k + 6);
          flush();
          items.push({ kind: 'delim', left: l, right: r, body: parseMath(src.slice(j, k)) });
          i = end;
          continue;
        }
      }
      if (name === 'sqrt' && src[skipSpaces(src, after)] === '{') {
        flush();
        const [body, j] = readArg(src, after);
        items.push({ kind: 'sqrt', body: parseMath(body) });
        i = j;
        continue;
      }
      if (name in BIG_OPS || name in TEXT_OPS) {
        let j = skipSpaces(src, after);
        if (src.startsWith('\\limits', j)) j = skipSpaces(src, j + 7);
        let lower: string | null = null;
        let upper: string | null = null;
        for (let pass = 0; pass < 2; pass++) {
          if (src[j] === '_' && lower === null) [lower, j] = readArg(src, j + 1);
          else if (src[j] === '^' && upper === null) [upper, j] = readArg(src, j + 1);
          j = skipSpaces(src, j);
        }
        if (lower !== null || upper !== null) {
          flush();
          items.push({
            kind: 'op',
            text: BIG_OPS[name] ?? TEXT_OPS[name],
            big: name in BIG_OPS,
            lower: lower === null ? null : parseMath(lower),
            upper: upper === null ? null : parseMath(upper),
          });
          i = j;
          continue;
        }
      }
      buf += m[0];
      i = after;
      continue;
    }
    if ((ch === '_' || ch === '^') && src[i + 1] === '{') {
      // i gruppi di pedici e apici restano interi: li compone mathToRuns
      const [content, j] = readArg(src, i + 1);
      buf += `${ch}{${content}}`;
      i = j;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return items;
}

// ---------- misura ----------

let ctx: CanvasRenderingContext2D | null | undefined;

/**
 * Larghezza stimata senza canvas (script in Node, anteprime): larghezze tipiche per
 * classe di carattere invece di una media unica, così la spaziatura resta credibile.
 */
export function approxWidth(text: string, size: number, math = false): number {
  let em = 0;
  for (const c of text) {
    if (c === ' ') em += 0.28;
    else if (/[.,:;'`!|ijlI1()[\]{}]/.test(c)) em += 0.3;
    else if (/[ftrJ\-/]/.test(c)) em += 0.4;
    else if (c === '−') em += 0.78;
    // lettere calligrafiche, a doppio filetto, grassetto matematico (ℰ, 𝒩, ℝ…)
    else if (/[\u2100-\u214f]|[\u{1d400}-\u{1d7ff}]/u.test(c)) em += 0.82;
    else if (/[mwMW∑∏⨁⨂]/.test(c)) em += 0.85;
    else if (/[A-Z]/.test(c)) em += 0.68;
    else if (/[0-9]/.test(c)) em += 0.55;
    else if (/[a-z]/.test(c)) em += 0.53;
    else if (/[=+×<>≤≥≈→←↦∈⊂⊆]/.test(c)) em += 0.75;
    else if (/[\u0300-\u036f\u20d0-\u20ff]/.test(c)) em += 0;
    else em += 0.6;
  }
  return em * size * (math ? 0.95 : 1);
}

function measure(text: string, size: number, italic: boolean, bold: boolean, math: boolean, family: FontFamily): number {
  if (ctx === undefined) ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!ctx) return approxWidth(text, size, math);
  ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${math ? MATH_FONT : FONT_CSS[family]}`;
  return ctx.measureText(text).width;
}

// ---------- impaginazione ----------

export interface Piece {
  x: number;
  dy: number; // linea di base rispetto a quella della riga
  text: string;
  size: number;
  italic: boolean;
  bold: boolean;
  math: boolean;
}
export interface Rule {
  x1: number;
  x2: number;
  dy: number;
  width: number;
}
export interface MathBox {
  width: number;
  ascent: number;
  descent: number;
  pieces: Piece[];
  rules: Rule[];
}

const empty = (): MathBox => ({ width: 0, ascent: 0, descent: 0, pieces: [], rules: [] });

function shift(box: MathBox, dx: number, dy: number, into: MathBox) {
  for (const p of box.pieces) into.pieces.push({ ...p, x: p.x + dx, dy: p.dy + dy });
  for (const r of box.rules) into.rules.push({ ...r, x1: r.x1 + dx, x2: r.x2 + dx, dy: r.dy + dy });
}

function layoutRuns(runs: Run[], size: number, family: FontFamily, bold: boolean, italic: boolean): MathBox {
  const box = empty();
  box.ascent = 0.75 * size;
  box.descent = 0.25 * size;
  // apice e pedice consecutivi partono dalla stessa x (impilati), come in LaTeX
  let scriptType: Run['script'] = null;
  let scriptStart = 0;
  let scriptEnd = 0;
  let stacked = false;
  for (const r of runs) {
    if (!r.script) {
      if (stacked) box.width = Math.max(box.width, scriptEnd);
      scriptType = null;
      stacked = false;
    } else if (scriptType === null) {
      scriptType = r.script;
      scriptStart = box.width;
    } else if (r.script !== scriptType && !stacked) {
      scriptEnd = box.width;
      box.width = scriptStart;
      scriptType = r.script;
      stacked = true;
    }
    const s = r.script ? size * 0.72 : r.math ? size * 1.08 : size;
    const dy = r.script === 'sub' ? 0.3 * size : r.script === 'sup' ? -0.4 * size : 0;
    const it = r.math ? r.italic : italic || r.italic;
    const bd = r.math ? !!r.bold : bold;
    const w = measure(r.text, s, it, bd, !!r.math, family);
    // correzione per il corsivo: l'apice non deve toccare la lettera inclinata
    const prev = runs[runs.indexOf(r) - 1];
    if (r.script === 'sup' && prev && prev.italic && !prev.script) box.width += 0.07 * size;
    box.pieces.push({ x: box.width, dy, text: r.text, size: s, italic: it, bold: bd, math: !!r.math });
    box.width += w;
    if (r.script === 'sup') box.ascent = Math.max(box.ascent, 0.4 * size + 0.72 * s);
    if (r.script === 'sub') box.descent = Math.max(box.descent, 0.3 * size + 0.25 * s);
  }
  if (stacked) box.width = Math.max(box.width, scriptEnd);
  return box;
}

function layoutItems(items: Item[], size: number, family: FontFamily): MathBox {
  const box = empty();
  box.ascent = 0.75 * size;
  box.descent = 0.25 * size;
  const add = (b: MathBox, padL = 0, padR = 0) => {
    shift(b, box.width + padL, 0, box);
    box.width += padL + b.width + padR;
    box.ascent = Math.max(box.ascent, b.ascent);
    box.descent = Math.max(box.descent, b.descent);
  };
  for (const it of items) {
    if (it.kind === 'runs') {
      add(layoutRuns(it.runs, size, family, false, false));
    } else if (it.kind === 'frac') {
      const s = size * it.scale;
      const num = layoutItems(it.num, s, family);
      const den = layoutItems(it.den, s, family);
      const axis = 0.28 * size;
      const gap = 0.14 * size;
      const w = Math.max(num.width, den.width) + 0.25 * size;
      const fb = empty();
      fb.width = w;
      shift(num, (w - num.width) / 2, -axis - gap - num.descent, fb);
      shift(den, (w - den.width) / 2, -axis + gap + den.ascent, fb);
      fb.rules.push({ x1: 0.06 * size, x2: w - 0.06 * size, dy: -axis, width: Math.max(0.6, 0.055 * size) });
      fb.ascent = axis + gap + num.ascent + num.descent;
      fb.descent = Math.max(0.2 * size, -axis + gap + den.ascent + den.descent);
      add(fb, 0.1 * size, 0.1 * size);
    } else if (it.kind === 'delim') {
      // parentesi alte quanto il contenuto, centrate su di esso
      const body = layoutItems(it.body, size, family);
      const h = body.ascent + body.descent;
      const ds = Math.max(size * 1.08, h * 1.02);
      const center = (body.descent - body.ascent) / 2;
      const base = center + 0.26 * ds;
      const db = empty();
      const lw = it.left ? measure(it.left, ds, false, false, true, family) * 0.82 : 0;
      const rw = it.right ? measure(it.right, ds, false, false, true, family) * 0.82 : 0;
      if (it.left) db.pieces.push({ x: 0, dy: base, text: it.left, size: ds, italic: false, bold: false, math: true });
      shift(body, lw + 0.04 * size, 0, db);
      if (it.right) db.pieces.push({ x: lw + body.width + 0.08 * size, dy: base, text: it.right, size: ds, italic: false, bold: false, math: true });
      db.width = lw + body.width + rw + 0.12 * size;
      db.ascent = Math.max(body.ascent, 0.74 * ds - base);
      db.descent = Math.max(body.descent, base + 0.26 * ds);
      add(db, 0.02 * size, 0.02 * size);
    } else if (it.kind === 'sqrt') {
      // radice: segno √ alto quanto il contenuto, con la barra sopra
      const body = layoutItems(it.body, size, family);
      const top = body.ascent + 0.1 * size;
      const signSize = Math.max(size * 1.08, (top + body.descent) * 1.05);
      const signW = measure('√', signSize, false, false, true, family) * 0.92;
      const sb = empty();
      sb.pieces.push({ x: 0, dy: body.descent - 0.02 * signSize, text: '√', size: signSize, italic: false, bold: false, math: true });
      shift(body, signW + 0.04 * size, 0, sb);
      sb.width = signW + body.width + 0.12 * size;
      sb.rules.push({ x1: signW * 0.96, x2: sb.width - 0.02 * size, dy: -top, width: Math.max(0.6, 0.05 * size) });
      sb.ascent = top + 0.08 * size;
      sb.descent = body.descent + 0.06 * size;
      add(sb, 0.04 * size, 0.04 * size);
    } else {
      const ls = size * 0.7;
      const lower = it.lower ? layoutItems(it.lower, ls, family) : null;
      const upper = it.upper ? layoutItems(it.upper, ls, family) : null;
      const symSize = it.big ? size * 1.45 : size * 1.08;
      const symW = measure(it.text, symSize, false, false, true, family);
      // il simbolo grande è centrato sull'asse matematico, come in LaTeX
      const symDy = it.big ? -0.28 * size + 0.3 * symSize : 0;
      const symTop = it.big ? symDy - 0.72 * symSize : -0.72 * size;
      const symBottom = it.big ? symDy + 0.2 * symSize : 0.22 * size;
      const w = Math.max(symW, lower?.width ?? 0, upper?.width ?? 0);
      const gap = 0.1 * size;
      const ob = empty();
      ob.width = w;
      ob.pieces.push({ x: (w - symW) / 2, dy: symDy, text: it.text, size: symSize, italic: false, bold: false, math: true });
      ob.ascent = -symTop;
      ob.descent = symBottom;
      if (upper) {
        const dy = symTop - gap - upper.descent;
        shift(upper, (w - upper.width) / 2, dy, ob);
        ob.ascent = -(dy - upper.ascent);
      }
      if (lower) {
        const dy = symBottom + gap + lower.ascent;
        shift(lower, (w - lower.width) / 2, dy, ob);
        ob.descent = dy + lower.descent;
      }
      // operatori testuali (lim, max…) staccati da ciò che precede, come \operatorname
      add(ob, it.big ? 0.08 * size : 0.2 * size, 0.16 * size);
    }
  }
  return box;
}

const cache = new Map<string, MathBox>();

/** Impaginazione di una riga di etichetta (testo e formule) a due piani. */
export function layoutLine(line: string, size: number, family: FontFamily, bold = false, italic = false): MathBox {
  const key = `${line}\u0000${size}\u0000${family}\u0000${bold}\u0000${italic}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const box = empty();
  box.ascent = 0.75 * size;
  box.descent = 0.25 * size;
  for (const part of splitMath(line)) {
    const b = part.math
      ? layoutItems(parseMath(part.text), size, family)
      : layoutRuns([{ text: part.text, italic: false, script: null }], size, family, bold, italic);
    shift(b, box.width, 0, box);
    box.width += b.width;
    box.ascent = Math.max(box.ascent, b.ascent);
    box.descent = Math.max(box.descent, b.descent);
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, box);
  return box;
}

/** Altezza di una riga: quella normale, o di più se la formula ha frazioni o limiti. */
export function lineHeight(line: string, size: number): number {
  if (!needsLayout(line)) return size * LINE_H;
  const b = layoutLine(line, size, 'sans');
  return Math.max(size * LINE_H, b.ascent + b.descent + 0.3 * size);
}
