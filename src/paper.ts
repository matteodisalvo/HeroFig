// Vista "Pagina": la figura come verrà stampata nel paper. Quando la si inserisce con
// \includegraphics[width=\columnwidth] (o \textwidth) LaTeX la riscala, quindi tutto ciò che sta
// intorno (pagina, testo, didascalia) qui si disegna nelle coordinate del foglio, alla scala inversa.
import { docBounds, type Rect } from './geometry';
import type { Doc, NodeModel } from './model';

export interface Venue {
  id: string;
  name: string;
  textCm: number; // \textwidth
  colCm?: number; // \columnwidth, solo per i template a due colonne
  span: 'col' | 'full'; // la figura occupa una colonna o tutta la larghezza
}

// misure dai file di stile ufficiali: cvpr.sty (kit CVPR/ICCV/3DV), icml2026.sty, IEEEtran.cls (conferenza),
// neurips_2025.sty, iclr2027_conference.sty, llncs.cls
export const VENUES: Venue[] = [
  { id: 'cvpr-full', name: 'CVPR / ICCV · tutta pagina', textCm: 17.46, colCm: 8.33, span: 'full' },
  { id: 'cvpr-col', name: 'CVPR / ICCV · una colonna', textCm: 17.46, colCm: 8.33, span: 'col' },
  { id: 'icml-full', name: 'ICML · tutta pagina', textCm: 17.15, colCm: 8.26, span: 'full' },
  { id: 'icml-col', name: 'ICML · una colonna', textCm: 17.15, colCm: 8.26, span: 'col' },
  { id: 'ieee-full', name: 'IEEE · tutta pagina', textCm: 18.14, colCm: 8.86, span: 'full' },
  { id: 'ieee-col', name: 'IEEE · una colonna', textCm: 18.14, colCm: 8.86, span: 'col' },
  { id: 'neurips', name: 'NeurIPS / ICLR', textCm: 13.97, span: 'full' },
  { id: 'miccai', name: 'MICCAI / Springer LNCS', textCm: 12.2, span: 'full' },
];

export const venueById = (id: string) => VENUES.find((v) => v.id === id) ?? VENUES[0];

/** Sotto questa dimensione (in punti, a stampa) il testo è considerato troppo piccolo. */
export const MIN_PT = 6;

/** Oltre questa altezza stampata la figura è "molto alta": metà dell'altezza utile di una pagina Letter. */
export const HALF_PAGE_CM = 11.5;

const PT_PER_CM = 72 / 2.54;
const PX_PT = 0.75; // 1 px dell'editor = 0.75 pt nell'export
const EXPORT_PAD = 8; // margine aggiunto da buildSvg
const BODY_PT = 12; // interlinea del testo del paper (10 pt su 12)
const CAPTION_PT = 9;

export const figureWidthCm = (v: Venue) => (v.span === 'col' && v.colCm ? v.colCm : v.textCm);

interface SmallText {
  pt: number; // dimensione stampata del testo più piccolo
  small: NodeModel[]; // blocchi con testo sotto MIN_PT (le frecce si segnalano solo nel conteggio)
  smallEdges: number;
}

interface PageLayout {
  scale: number; // fattore con cui LaTeX riscala la figura esportata
  k: number; // px dell'editor per ogni punto stampato
  page: Rect;
  focus: Rect; // parte di pagina da inquadrare: figura, didascalia e qualche riga
  fig: Rect;
  span: { x: number; w: number }; // colonna (o pagina) che ospita la figura
  widthCm: number; // larghezza stampata della figura
  heightCm: number;
  caption: { x: number; y: number; w: number; size: number };
  lines: Rect[];
  text: SmallText;
}

function smallText(doc: Doc, scale: number): SmallText {
  const toPt = (px: number) => px * PX_PT * scale;
  let pt = Infinity;
  const small: NodeModel[] = [];
  for (const n of doc.nodes) {
    const sizes = [n.label.trim() ? n.fontSize : Infinity, n.sublabel.trim() ? n.subSize : Infinity];
    const min = toPt(Math.min(...sizes));
    pt = Math.min(pt, min);
    if (min < MIN_PT) small.push(n);
  }
  let smallEdges = 0;
  for (const e of doc.edges) {
    if (!e.label.trim()) continue;
    const s = toPt(e.fontSize);
    pt = Math.min(pt, s);
    if (s < MIN_PT) smallEdges++;
  }
  return { pt, small, smallEdges };
}

/** Pagina, didascalia e righe di testo attorno alla figura; null se il foglio è vuoto. */
export function pageLayout(doc: Doc, venue: Venue, captionChars: number): PageLayout | null {
  if (!doc.nodes.length) return null;
  const b = docBounds(doc);
  const fig = { x: b.x - EXPORT_PAD, y: b.y - EXPORT_PAD, w: b.w + 2 * EXPORT_PAD, h: b.h + 2 * EXPORT_PAD };
  // LaTeX rimpicciolisce le figure troppo larghe, ma una figura piccola non va gonfiata fino a
  // riempire la colonna: resta alla grandezza naturale, centrata
  const scale = Math.min(1, (figureWidthCm(venue) * PT_PER_CM) / (fig.w * PX_PT));
  const k = 1 / (PX_PT * scale);
  const spanW = figureWidthCm(venue) * PT_PER_CM * k;
  const left = fig.x - (spanW - fig.w) / 2; // bordo sinistro della colonna che ospita la figura

  const textW = venue.textCm * PT_PER_CM * k;
  const colW = (venue.colCm ?? venue.textCm) * PT_PER_CM * k;
  const twoCols = !!venue.colCm;
  const gap = textW - 2 * colW;
  const side = 58 * k; // margini di una pagina Letter: ~0,8 in ai lati
  const top = 54 * k;
  const pageW = textW + 2 * side;
  const page = { x: left - side, y: fig.y - top, w: pageW, h: (pageW * 11) / 8.5 };

  // didascalia sotto la figura, larga quanto la figura
  const size = CAPTION_PT * k;
  const capY = fig.y + fig.h + 6 * k;
  const perLine = Math.max(10, spanW / (size * 0.47));
  const capH = Math.ceil(captionChars / perLine) * size * 1.25;

  // righe del testo del paper, nelle colonne libere
  const lines: Rect[] = [];
  const bottom = page.y + page.h - 72 * k;
  const pitch = BODY_PT * k;
  const column = (x: number, w: number, from: number) => {
    for (let i = 0, y = from; y + pitch <= bottom; i++, y += pitch) {
      const short = i % 9 === 8; // fine paragrafo
      lines.push({ x, y, w: short ? w * 0.55 : w, h: 4.4 * k });
    }
  };
  const below = capY + capH + 14 * k;
  if (venue.span === 'col' && twoCols) {
    column(left, colW, below);
    column(left + colW + gap, colW, fig.y);
  } else if (twoCols) {
    column(left, colW, below);
    column(left + colW + gap, colW, below);
  } else {
    column(left, textW, below);
  }

  const focus = { x: page.x, y: page.y, w: page.w, h: Math.min(page.h, below - page.y + 6 * pitch) };
  const widthCm = (fig.w * PX_PT * scale) / PT_PER_CM;
  return {
    scale,
    k,
    page,
    focus,
    fig,
    span: { x: left, w: spanW },
    widthCm,
    heightCm: (widthCm * fig.h) / fig.w,
    caption: { x: left, y: capY, w: spanW, size },
    lines,
    text: smallText(doc, scale),
  };
}

/**
 * Formato migliore per la figura nella stessa rivista: una colonna se il testo resta leggibile
 * anche a quella larghezza, altrimenti tutta la pagina. Le riviste a colonna unica non cambiano.
 */
export function bestVenue(doc: Doc, venue: Venue): Venue {
  const base = venue.id.replace(/-(full|col)$/, '');
  const col = VENUES.find((v) => v.id === `${base}-col`);
  const full = VENUES.find((v) => v.id === `${base}-full`);
  if (!col || !full) return venue;
  const pt = pageLayout(doc, col, 0)?.text.pt ?? Infinity;
  // senza scritte non c'è un criterio: resta la scelta dell'utente
  if (!Number.isFinite(pt)) return venue;
  return pt >= MIN_PT ? col : full;
}
