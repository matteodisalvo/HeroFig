import {
  CORNER_R,
  arrowLen,
  docBounds,
  edgeGeometry,
  edgeLabelBlock,
  labelBlocks,
  rotationOf,
  shapeParts,
  type ClipRect,
  type Cmd,
  type Part,
  type TextBlock,
} from '../geometry';
import { LINE_H, isContainer, type Doc, type EdgeModel, type FontFamily, type NodeModel } from '../model';
import { mathNeedsDisplay } from '../mathlayout';
import { SYMBOLS, mathbb, mathcal, splitMath } from '../richtext';
import { withGeneratedAssetExport } from '../generated-assets';
import { pageLayout, venueById } from '../paper';

// Il tikzpicture usa x=0.75pt, y=-0.75pt: le coordinate sono i pixel dell'editor
// (asse y verso il basso) e 1px = 0.75pt, come nell'export PDF.
const PT = 0.75;

const TEX_FONT: Record<FontFamily, string> = { sans: '\\sffamily', serif: '\\rmfamily', mono: '\\ttfamily' };

// caratteri non ASCII → codice LaTeX in modo matematico (solo questi: `|` o `-` digitati nelle formule restano tali)
const MATH_CHARS: Record<string, string> = {};
for (const [name, ch] of Object.entries(SYMBOLS)) if (ch.charCodeAt(0) > 127) MATH_CHARS[ch] ??= `\\${name} `;
// lettere calligrafiche / a doppio filetto digitate direttamente
for (const L of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  MATH_CHARS[mathcal(L)] = `\\mathcal{${L}}`;
  MATH_CHARS[mathbb(L)] = `\\mathbb{${L}}`;
}
Object.assign(MATH_CHARS, {
  // √ digitato a mano: \surd è il simbolo, \sqrt vorrebbe un argomento
  '√': '\\surd ',
  // ε e φ digitati sono le forme di \varepsilon e \varphi; \omicron in LaTeX non esiste
  'ε': '\\varepsilon ', 'φ': '\\varphi ', 'ο': 'o',
  // caratteri frequenti nelle etichette che pdflatex non conosce ("Unicode character not set up")
  '−': '-', '⋅': '\\cdot ', '∙': '\\cdot ', '‖': '\\| ', '✓': '\\checkmark ', '✔': '\\checkmark ', '✗': '\\times ', '✘': '\\times ',
  '★': '\\bigstar ', '↗': '\\nearrow ', '↘': '\\searrow ', '↙': '\\swarrow ', '↖': '\\nwarrow ',
});

// pedici e apici Unicode (x₁₂, Wᵀ, m²): un gruppo solo per ogni sequenza, altrimenti "Double subscript"
const SUB = ['₀₁₂₃₄₅₆₇₈₉₊₋ᵢⱼₖₙₜₓ', '0123456789+-ijkntx'];
const SUP = ['⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁱⁿᵀ', '0123456789+-inT'];
const SCRIPT_RUN = new RegExp(`([${SUB[0]}]+|[${SUP[0]}]+)`, 'g');
const scripts = (s: string) =>
  s.replace(SCRIPT_RUN, (run) => {
    const [from, to] = SUB[0].includes(run[0]) ? SUB : SUP;
    return `${from === SUB[0] ? '_' : '^'}{${[...run].map((c) => to[from.indexOf(c)]).join('')}}`;
  });

// comandi che l'editor compone ma che LaTeX (con amsmath e amssymb) non definisce: si aggiungono solo se usati,
// con \providecommand, così una definizione già presente nel paper resta quella
const EXTRA_MACROS: Record<string, string> = {
  argmax: '\\operatorname*{arg\\,max}', argmin: '\\operatorname*{arg\\,min}', softmax: '\\operatorname{softmax}', KL: '\\operatorname{KL}',
  tr: '\\operatorname{tr}', diag: '\\operatorname{diag}', sign: '\\operatorname{sign}', var: '\\operatorname{var}', Var: '\\operatorname{Var}',
  Cov: '\\operatorname{Cov}', bm: '\\boldsymbol', omicron: 'o',
};

const TEXT_ESC: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  '#': '\\#',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
  // con la codifica OT1 (IEEEtran, llncs) <eos> uscirebbe come ¡eos¿ e | come una lineetta
  '<': '\\textless{}',
  '>': '\\textgreater{}',
  '|': '\\textbar{}',
};

/** Graffe chiuse e niente `\` finale: una formula scritta a metà non deve bloccare la compilazione del paper. */
function balance(src: string): string {
  let depth = 0;
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      if (i + 1 < src.length) out += c + src[++i];
      continue;
    }
    if (c === '}' && !depth) continue;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    out += c;
  }
  return out + '}'.repeat(depth);
}

const mathTex = (src: string) =>
  [...scripts(balance(src))].map((c, i, all) => MATH_CHARS[c] ?? (/[#%&]/.test(c) && all[i - 1] !== '\\' ? `\\${c}` : c)).join('');

const textTex = (text: string) =>
  text
    .split(SCRIPT_RUN)
    .map((s, i) => (i % 2 ? `$${scripts(s)}$` : [...s].map((c) => TEXT_ESC[c] ?? (MATH_CHARS[c] ? `$${MATH_CHARS[c]}$` : c)).join('')))
    .join('');

function texLine(line: string): string {
  return splitMath(line)
    .map((p) =>
      p.math
        ? // frazioni e limiti sopra/sotto come nell'editor: stile "display"
          '$' + (mathNeedsDisplay(p.text) ? '\\displaystyle ' : '') + mathTex(p.text) + '$'
        : textTex(p.text),
    )
    .join('');
}

const f = (v: number) => String(Math.round(v * 100) / 100);

/** Immagine raster da salvare accanto al file .tex (il TikZ la richiama con \includegraphics). */
export interface TikzImage {
  name: string;
  dataUrl: string;
}

/**
 * Codice TikZ della figura. Le immagini importate vengono elencate in `images`
 * (nome del file + contenuto) con il prefisso `imageBase`: chi esporta le salva
 * nella stessa cartella del .tex.
 */
export function buildTikz(doc: Doc, opts: { imageBase?: string; images?: TikzImage[] } = {}): string {
  return withGeneratedAssetExport(doc, () => buildTikzPrepared(doc, opts));
}

function buildTikzPrepared(doc: Doc, opts: { imageBase?: string; images?: TikzImage[] }): string {
  const b = docBounds(doc);
  const images = opts.images ?? [];
  // il nome del .hfig può contenere spazi, accenti o % e #: i file accanto al .tex si salvano solo con nomi semplici
  const base = (opts.imageBase ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').replace(/^[-.]+|-+$/g, '') || 'figura';
  const imageName = (href: string) => {
    const known = images.find((im) => im.dataUrl === href);
    if (known) return known.name;
    const ext = /^data:image\/(png|jpe?g)/.exec(href)?.[1]?.replace('jpeg', 'jpg') ?? 'png';
    const name = `${base}-img${images.length + 1}.${ext}`;
    images.push({ name, dataUrl: href });
    return name;
  };
  const xy = (x: number, y: number) => `(${f(x - b.x)},${f(y - b.y)})`;
  const family = TEX_FONT[doc.settings.fontFamily];

  const colors = new Map<string, string>();
  const color = (hex: string): string => {
    let k = hex.replace('#', '').toUpperCase();
    if (/^[0-9A-F]{3}$/.test(k)) k = [...k].map((c) => c + c).join('');
    if (!/^[0-9A-F]{6}$/.test(k)) k = '000000';
    if (!colors.has(k)) colors.set(k, `mlc${colors.size + 1}`);
    return colors.get(k)!;
  };

  const font = (px: number, bold: boolean, italic: boolean) =>
    `font=\\fontsize{${f(px * PT)}}{${f(px * PT * LINE_H)}}\\selectfont${family}${bold ? '\\bfseries' : ''}${italic ? '\\itshape' : ''}`;

  // `{}` dopo `\\\\` evita che una riga che inizia con `[` venga letta come spaziatura opzionale
  const textBody = (text: string) => text.split('\n').map(texLine).join(' \\\\{}');

  const partPath = (cmds: Cmd[]): string =>
    cmds
      .map((c, i) => {
        switch (c[0]) {
          case 'M': return (i ? ' ' : '') + xy(c[1], c[2]);
          case 'L': return ' -- ' + xy(c[1], c[2]);
          case 'C': return ` .. controls ${xy(c[1], c[2])} and ${xy(c[3], c[4])} .. ${xy(c[5], c[6])}`;
          case 'Z': return ' -- cycle';
        }
      })
      .join('');

  const out: string[] = [];

  // senza `align` TikZ ignora gli a capo `\\` e mette tutte le righe su una sola
  const ANCHOR = { middle: 'anchor=center, align=center', start: 'anchor=west, align=left', end: 'anchor=east, align=right' };

  const drawPart = (part: Part, n: NodeModel) => {
    if (part.kind === 'text') {
      out.push(
        `  \\node[${ANCHOR[part.anchor ?? 'middle']}, inner sep=0pt, text=${color(part.fill)}, ${font(part.size, !!part.bold, !!part.italic)}] at ${xy(part.x, part.y)} {${textBody(part.text)}};`,
      );
      return;
    }
    if (part.kind === 'image') {
      if (!(part.w > 0 && part.h > 0)) return; // come nell'SVG: un riquadro vuoto non mostra niente
      // Stessa modalità cover/contain dell'SVG, senza deformare icone e grafici.
      const r = part.ratio > 0 ? part.ratio : part.w / part.h;
      const fitWidth = part.fit === 'contain' ? part.w / part.h <= r : part.w / part.h > r;
      const [w, h] = fitWidth ? [part.w, part.w / r] : [part.h * r, part.h];
      out.push(
        '  \\begin{scope}',
        `  \\clip ${xy(part.x, part.y)} rectangle ${xy(part.x + part.w, part.y + part.h)};`,
        `  \\node[inner sep=0pt] at ${xy(part.x + part.w / 2, part.y + part.h / 2)} {\\includegraphics[width=${f(w * PT)}pt,height=${f(h * PT)}pt]{${imageName(part.href)}}};`,
        '  \\end{scope}',
      );
      return;
    }
    const opts: string[] = [];
    const stroke = part.stroke ?? n.stroke;
    if (stroke !== 'none') {
      opts.push(`draw=${color(stroke)}`, `line width=${f((part.sw ?? n.strokeWidth) * PT)}pt`);
      if (n.dashed && !part.solid) opts.push('dash pattern=on 4.5pt off 3pt');
    }
    if (part.fill !== 'none') opts.push(`fill=${color(part.fill)}`);
    if (!opts.length) return;
    let path: string;
    if (part.kind === 'rect') {
      if (part.r > 0) opts.push(`rounded corners=${f(part.r * PT)}pt`);
      path = `${xy(part.x, part.y)} rectangle ${xy(part.x + part.w, part.y + part.h)}`;
    } else if (part.kind === 'ellipse') {
      path = `${xy(part.cx, part.cy)} ellipse [x radius=${f(part.rx * PT)}pt, y radius=${f(part.ry * PT)}pt]`;
    } else {
      path = partPath(part.cmds);
    }
    out.push(`  \\path[${opts.join(', ')}] ${path};`);
  };

  const textNode = (t: TextBlock) =>
    `  \\node[${ANCHOR[t.anchor]}, inner sep=${t.halo ? '1.5pt, fill=white' : '0pt'}, text=${color(t.color)}, ${font(t.fontSize, t.bold, t.italic)}] at ${xy(t.x, t.y)} {${textBody(t.text)}};`;

  const drawNode = (n: NodeModel) => {
    // ruotato: tutto il blocco (scritte comprese) in una scope girata attorno al centro; l'asse y di TikZ va in su, quindi
    // il senso orario del foglio è un angolo negativo
    const rotation = rotationOf(n);
    if (rotation) out.push(`  \\begin{scope}[rotate around={${f(-rotation)}:${xy(n.x + n.w / 2, n.y + n.h / 2)}}, transform shape]`);
    let clip: ClipRect | undefined;
    for (const part of shapeParts(n)) {
      if (part.clip !== clip) {
        if (clip) out.push('  \\end{scope}');
        clip = part.clip;
        if (clip) {
          const rc = clip.r > 0 ? `[rounded corners=${f(clip.r * PT)}pt]` : '';
          out.push(`  \\begin{scope}`, `  \\clip${rc} ${xy(clip.x, clip.y)} rectangle ${xy(clip.x + clip.w, clip.y + clip.h)};`);
        }
      }
      drawPart(part, n);
    }
    if (clip) out.push('  \\end{scope}');
    for (const t of labelBlocks(n)) out.push(textNode(t));
    if (rotation) out.push('  \\end{scope}');
  };

  const map = new Map(doc.nodes.map((n) => [n.id, n]));
  const edgeLabels: string[] = [];

  const drawEdge = (e: EdgeModel) => {
    const g = edgeGeometry(e, map);
    if (!g) return;
    const len = arrowLen(e.width) * PT;
    const tip = `{Stealth[length=${f(len)}pt, width=${f(len * 0.8)}pt]}`;
    const opts = [
      `${e.arrowStart ? tip : ''}-${e.arrowEnd ? tip : ''}`,
      `draw=${color(e.color)}`,
      `line width=${f(e.width * PT)}pt`,
    ];
    if (e.dashed) opts.push('dash pattern=on 4.5pt off 3pt');
    if (g.rounded && g.pts.length > 2) opts.push(`rounded corners=${f(CORNER_R * PT)}pt`);
    const p = g.pts;
    const path = g.curve
      ? `${xy(p[0].x, p[0].y)} .. controls ${xy(p[1].x, p[1].y)} and ${xy(p[2].x, p[2].y)} .. ${xy(p[3].x, p[3].y)}`
      : p.map((q) => xy(q.x, q.y)).join(' -- ');
    out.push(`  \\draw[${opts.join(', ')}] ${path};`);
    if (e.label) edgeLabels.push(textNode(edgeLabelBlock(e, g)));
  };

  // stesso ordine di disegno dell'editor: gruppi, connessioni, blocchi, etichette delle connessioni
  out.push('  % groups');
  doc.nodes.filter(isContainer).forEach(drawNode);
  out.push('  % connections');
  doc.edges.forEach(drawEdge);
  out.push('  % blocks');
  doc.nodes.filter((n) => !isContainer(n)).forEach(drawNode);
  if (edgeLabels.length) out.push('  % connection labels', ...edgeLabels);

  // con una didascalia (vista Pagina) il file contiene già l'ambiente figure, largo come la colonna scelta
  const caption = texLine(doc.settings.caption.trim().replace(/\s*\n\s*/g, ' '));
  // `%` a fine riga: altrimenti ogni a capo diventa uno spazio e la figura si sposta fuori pagina
  const used = [...out, caption].join('\n');
  const defs = [
    ...[...colors].map(([hex, name]) => `\\definecolor{${name}}{HTML}{${hex}}%`),
    ...Object.entries(EXTRA_MACROS)
      .filter(([name]) => new RegExp(`\\\\${name}(?![a-zA-Z])`).test(used))
      .map(([name, def]) => `\\providecommand{\\${name}}{${def}}%`),
  ];
  const venue = venueById(doc.settings.venue);
  const env = venue.colCm && venue.span === 'full' ? 'figure*' : 'figure';
  const width = venue.colCm && venue.span === 'col' ? '\\columnwidth' : '\\textwidth';
  // una figura più stretta della colonna resta alla grandezza naturale, centrata (come nella vista Pagina)
  const shrink = (pageLayout(doc, venue, 0)?.scale ?? 1) < 1;
  const label = `fig:${base.replace(/[^\w-]/g, '') || 'figura'}`;
  return [
    '% Generated with HeroFig',
    '% In the preamble: \\usepackage{tikz,amsmath,amssymb,graphicx} \\usetikzlibrary{arrows.meta}',
    caption ? '% Already contains the figure environment with its caption: paste it into the paper as is.' : null,
    ...defs,
    caption ? `\\begin{${env}}[t]%\n\\centering%${shrink ? `\n\\resizebox{${width}}{!}{%` : ''}` : null,
    `\\begin{tikzpicture}[x=${PT}pt, y=-${PT}pt, line join=round, line cap=round]`,
    doc.settings.background === 'white'
      ? `  \\fill[white] ${xy(b.x - 8, b.y - 8)} rectangle ${xy(b.x + b.w + 8, b.y + b.h + 8)};`
      : null,
    ...out,
    caption ? `\\end{tikzpicture}%${shrink ? '\n}%' : ''}` : '\\end{tikzpicture}',
    caption ? `\\caption{${caption}}%\n\\label{${label}}%\n\\end{${env}}` : null,
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
}
