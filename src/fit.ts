// Adatta la figura alla larghezza della rivista senza rovinarla. Ingrandire soltanto le scritte non basta:
// in una colonna stretta servirebbero scritte 2–3 volte più grandi, che escono dai blocchi. Si fa come
// farebbe una persona: se la figura è troppo larga la si dispone su più righe ("va a capo"), si ingrandisce
// il testo solo un poco allargando i blocchi perché le scritte ci stiano, e si rispazia. Se nemmeno così il
// testo arriva a MIN_PT, cresce solo quanto può su una riga, oppure la figura resta com'è.
// Una figura troppo alta (fitHeight) si abbassa con lo stesso criterio: spazi vuoti più stretti, una colonna
// sola o una stampa un po' più piccola, mai a spese del testo.
// Nessun passo lascia la figura peggio di come l'ha trovata (vedi added): niente difetti nuovi, niente figura
// molto alta che prima non lo era, niente righe che strappano i collegamenti o aggrovigliano le frecce.
import { docBounds, edgeGeometry, edgeLabelBlock, labelBlocks, rectContains, textBlockRect, unionRect, type EdgeGeom, type Pt, type Rect } from './geometry';
import { isContainer, type Doc, type NodeModel } from './model';
import { reviewDoc } from './review';
import { HALF_PAGE_CM, MIN_PT, VENUES, bestVenue, figureWidthCm, pageLayout, venueById, type Venue } from './paper';

const MAX_GROWTH = 1.35; // oltre, le scritte diventano sproporzionate rispetto ai disegni
const MAX_ROWS = 3;
const ROW_GAP = 34; // spazio fra una riga e la successiva: basta per la freccia che scende
const ATTACHED = 12; // pezzi più vicini di così sono attaccati: andando a capo non si separano
const PX_PT = 0.75;

// ---------- testo dentro i blocchi ----------

/** Ingombro delle scritte interne di un blocco; null se il blocco non ha scritte al suo interno. */
function innerText(n: NodeModel, doc: Doc): Rect | null {
  if (isContainer(n) || n.shape === 'text' || n.labelPos !== 'center' || (!n.label.trim() && !n.sublabel.trim())) return null;
  const rects = labelBlocks(n).map((b) => textBlockRect(b, doc.settings.fontFamily));
  return rects.length ? unionRect(rects) : null;
}

// trapezi, ellissi e rombi hanno meno spazio utile del loro riquadro
const slack = (n: NodeModel) =>
  n.shape === 'trapezoid' ? 1.3 : ['ellipse', 'diamond', 'hexagon', 'parallelogram', 'triangle'].includes(n.shape) ? 1.15 : 1;

/** Blocchi le cui scritte interne escono dal bordo (con un po' di tolleranza: un "+" in un cerchietto va bene). */
export function overflowingNodes(doc: Doc): NodeModel[] {
  return doc.nodes.filter((n) => {
    const r = innerText(n, doc);
    return !!r && (r.w > n.w / slack(n) + 2 || r.h > n.h + 2);
  });
}

/** Allarga (dal centro) i blocchi in cui le scritte non stanno, lasciando un margine comodo. */
function fitBoxes(doc: Doc): Doc {
  const over = new Set(overflowingNodes(doc).map((n) => n.id));
  return {
    ...doc,
    nodes: doc.nodes.map((n) => {
      if (!over.has(n.id)) return n;
      const r = innerText(n, doc)!;
      const w = Math.ceil(Math.max(n.w, r.w * slack(n) + 14)), h = Math.ceil(Math.max(n.h, r.h + 10));
      return { ...n, x: n.x - (w - n.w) / 2, y: n.y - (h - n.h) / 2, w, h };
    }),
  };
}

// ---------- colonne della figura e righe ----------

interface Cluster {
  ids: string[]; // blocchi che si spostano insieme (contenitori col loro contenuto, icone accanto ai blocchi)
  box: Rect; // ingombro, scritte comprese
}

const nodeBox = (n: NodeModel, doc: Doc): Rect =>
  unionRect([{ x: n.x, y: n.y, w: n.w, h: n.h }, ...labelBlocks(n).map((b) => textBlockRect(b, doc.settings.fontFamily))]);

/**
 * Gruppi di blocchi che stanno uno sopra l'altro (stessa "colonna" della figura): un contenitore porta con sé
 * il suo contenuto, un ramo sotto un blocco resta sotto quel blocco. Ordinati da sinistra a destra.
 * Con axis 'y' sono invece le "fasce" orizzontali (blocchi uno accanto all'altro), ordinate dall'alto.
 */
function clusters(doc: Doc, axis: 'x' | 'y' = 'x'): Cluster[] {
  const [pos, size] = axis === 'x' ? (['x', 'w'] as const) : (['y', 'h'] as const);
  const containers = doc.nodes.filter(isContainer);
  const inside = (n: NodeModel) => containers.find((c) => c.id !== n.id && rectContains(c, n));
  const items: Cluster[] = [];
  for (const n of doc.nodes) {
    if (inside(n)) continue;
    const members = isContainer(n) ? doc.nodes.filter((m) => m.id === n.id || (m.id !== n.id && rectContains(n, m))) : [n];
    items.push({ ids: members.map((m) => m.id), box: unionRect(members.map((m) => nodeBox(m, doc))) });
  }
  items.sort((a, b) => a.box[pos] - b.box[pos]);
  const out: Cluster[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    // un punticino largo 1 px (la punta di una freccia, l'estremo di un tratto) non si sovrappone a niente: va col
    // gruppo a cui arriva entro 2 px, altrimenti andando a capo o rispaziando se ne staccherebbe
    const dot = !!last && (it.box[size] <= 2 || last.box[size] <= 2);
    if (last && it.box[pos] < last.box[pos] + last.box[size] - (dot ? -2 : 2)) {
      last.ids.push(...it.ids);
      last.box = unionRect([last.box, it.box]);
    } else out.push({ ids: [...it.ids], box: { ...it.box } });
  }
  // una linea dritta lungo l'asse (un divisore fra due punticini larghi 1 px) non si sovrappone a niente: le sue
  // estremità, in gruppi diversi, si sposterebbero ognuna per conto suo e la linea verrebbe storta
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const mid = (n: NodeModel) => n[pos] + n[size] / 2;
  for (const e of doc.edges) {
    const a = byId.get(e.from.node), b = byId.get(e.to.node);
    if (!a || !b || Math.abs(mid(a) - mid(b)) > 0.75) continue;
    let i = out.findIndex((c) => c.ids.includes(a.id)), j = out.findIndex((c) => c.ids.includes(b.id));
    if (i < 0 || j < 0 || i === j) continue;
    if (i > j) [i, j] = [j, i];
    // i gruppi stanno in ordine: unire i due vuol dire unire anche quelli in mezzo
    const run = out.splice(i, j - i + 1);
    out.splice(i, 0, { ids: run.flatMap((c) => c.ids), box: unionRect(run.map((c) => c.box)) });
  }
  return out;
}

/**
 * Dispone le colonne della figura su `rows` righe, con spazi uguali; le frecce fra righe si instradano da sole.
 * `torn` conta i collegamenti che andando a capo si strappano: va bene solo la freccia che scende dalla fine
 * di una riga all'inizio della successiva (al più scavalcando una colonna, come una connessione residua).
 * Una freccia fra parti lontane (le skip connection di una U-Net, un ritorno all'inizio) attraverserebbe tutta
 * la figura: quella figura non è una catena da sinistra a destra e non va divisa. `rows` nel risultato sono le
 * righe ottenute davvero: una figura tutta di pezzi attaccati non si divide.
 */
function pack(doc: Doc, rows: number): { doc: Doc; torn: number; rows: number } {
  let cs = clusters(doc);
  // andando a capo resta insieme ciò che quasi si tocca: una graffa e i fili che indica, una scritta e il suo disegno
  if (rows > 1)
    cs = cs.reduce<Cluster[]>((out, c) => {
      const last = out[out.length - 1];
      if (last && c.box.x - (last.box.x + last.box.w) < ATTACHED) out[out.length - 1] = { ids: [...last.ids, ...c.ids], box: unionRect([last.box, c.box]) };
      else out.push(c);
      return out;
    }, []);
  if (cs.length < 2) return { doc, torn: 0, rows: 1 };
  const gaps = cs.slice(1).map((c, i) => c.box.x - (cs[i].box.x + cs[i].box.w)).filter((g) => g > 0).sort((a, b) => a - b);
  // andando a capo gli spazi si stringono: la figura deve restare piccola nella colonna
  const typical = gaps[Math.floor(gaps.length / 2)] ?? 40;
  const gap = rows > 1 ? Math.min(32, Math.max(20, typical * 0.6)) : Math.min(80, Math.max(28, typical));
  // righe il più possibile uguali: fra tutti i punti in cui andare a capo, quelli con la riga più lunga più corta
  const widthOf = (a: number, b: number) => cs.slice(a, b).reduce((s, c) => s + c.box.w, 0) + gap * (b - a - 1);
  const k = Math.min(rows, cs.length);
  let best: number[] = [];
  let bestW = Infinity;
  const search = (from: number, left: number, cuts: number[]) => {
    if (left === 1) {
      const ws = [...cuts, cs.length].map((end, r) => widthOf(r ? cuts[r - 1] : 0, end));
      const w = Math.max(...ws);
      // righe equilibrate: un pezzetto da solo su una riga non è andare a capo, è spostarlo dove non c'entra
      if (w < bestW && Math.min(...ws) >= w / 3) [bestW, best] = [w, cuts];
      return;
    }
    for (let c = from + 1; c <= cs.length - left + 1; c++) search(c, left - 1, [...cuts, c]);
  };
  search(0, k, []);
  const lines = [...best, cs.length].map((end, r) => cs.slice(r ? best[r - 1] : 0, end));
  const x0 = cs[0].box.x;
  const shift = new Map<string, { dx: number; dy: number }>();
  const rowOf = new Map<string, number>();
  let top = Math.min(...lines[0].map((c) => c.box.y));
  lines.forEach((line, r) => {
    const minY = Math.min(...line.map((c) => c.box.y));
    const maxY = Math.max(...line.map((c) => c.box.y + c.box.h));
    let x = x0;
    for (const c of line) {
      for (const id of c.ids) {
        shift.set(id, { dx: x - c.box.x, dy: top - minY });
        rowOf.set(id, r);
      }
      x += c.box.w + gap;
    }
    top += maxY - minY + ROW_GAP;
  });
  const colOf = new Map<string, number>();
  cs.forEach((c, i) => c.ids.forEach((id) => colOf.set(id, i)));
  const starts = [0, ...best], ends = [...best, cs.length];
  let torn = 0;
  for (const e of doc.edges) {
    const i = colOf.get(e.from.node), j = colOf.get(e.to.node);
    if (i === undefined || j === undefined) continue;
    const a = rowOf.get(e.from.node)!, b = rowOf.get(e.to.node)!;
    if (a === b) continue;
    // all'indietro, o oltre la riga successiva, o lontano dal punto in cui si va a capo
    if (b !== a + 1 || ends[a] - 1 - i + (j - starts[b]) > 1) torn++;
  }
  const packed: Doc = {
    ...doc,
    nodes: doc.nodes.map((n) => {
      const s = shift.get(n.id);
      return s ? { ...n, x: n.x + s.dx, y: n.y + s.dy } : n;
    }),
    // una freccia che passa a una riga successiva esce dal fondo ed entra dall'alto: scende e torna a sinistra
    edges: doc.edges.map((e) => {
      const a = rowOf.get(e.from.node) ?? 0, b = rowOf.get(e.to.node) ?? 0;
      if (a === b) return e;
      return a < b
        ? { ...e, from: { ...e.from, side: 'bottom' }, to: { ...e.to, side: 'top' } }
        : { ...e, from: { ...e.from, side: 'top' }, to: { ...e.to, side: 'bottom' } };
    }),
  };
  return { doc: packed, torn, rows: lines.length };
}

// ---------- frecce aggrovigliate ----------

/** Percorso di una freccia come spezzata (una curva con 12 tratti). */
function strokes(g: EdgeGeom): Pt[] {
  if (!g.curve) return g.pts;
  const [a, b, c, d] = g.pts;
  return Array.from({ length: 13 }, (_, i) => {
    const t = i / 12, u = 1 - t;
    const f = (k: 'x' | 'y') => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k];
    return { x: f('x'), y: f('y') };
  });
}

/** I due tratti si attraversano (toccarsi agli estremi non conta). */
function crosses(p: Pt, q: Pt, r: Pt, s: Pt): boolean {
  const d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d;
  const u = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

/** Il tratto passa dentro il rettangolo (a 3 px dal bordo: sfiorarlo non conta). */
function through(p: Pt, q: Pt, r: Rect): boolean {
  const x0 = r.x + 3, y0 = r.y + 3, x1 = r.x + r.w - 3, y1 = r.y + r.h - 3;
  if (x1 <= x0 || y1 <= y0) return false;
  // Liang–Barsky: la parte del tratto che resta dentro il rettangolo
  let lo = 0, hi = 1;
  const dx = q.x - p.x, dy = q.y - p.y;
  for (const [a, b] of [[-dx, p.x - x0], [dx, x1 - p.x], [-dy, p.y - y0], [dy, y1 - p.y]]) {
    if (Math.abs(a) < 1e-9) {
      if (b < 0) return false;
    } else if (a < 0) lo = Math.max(lo, b / a);
    else hi = Math.min(hi, b / a);
  }
  return lo < hi;
}

/**
 * Quanto è aggrovigliata la figura: coppie di frecce che si incrociano (senza un blocco in comune) più frecce che
 * passano sopra un blocco che non collegano. Andare a capo non deve aumentarlo: le frecce fra righe devono
 * trovare la strada libera, come in una catena che scende e riparte da sinistra.
 */
function tangles(doc: Doc): number {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  // blocchi e scritte, non i contenitori né i punticini invisibili a cui si appoggiano le frecce; le didascalie sopra
  // o sotto un blocco non si attraversano, nemmeno con la freccia di quel blocco
  const blocks = doc.nodes.filter((n) => !isContainer(n) && n.w * n.h > 16);
  const captions = blocks
    .filter((n) => n.labelPos !== 'center')
    .flatMap((n) => labelBlocks(n).map((b) => textBlockRect(b, doc.settings.fontFamily)));
  const lines = doc.edges.flatMap((e) => {
    const g = edgeGeometry(e, byId);
    if (!g) return [];
    const pts = strokes(g);
    return [{ e, segs: pts.slice(1).map((q, i) => [pts[i], q] as const), box: unionRect(pts.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 }))) }];
  });
  // prima un confronto fra ingombri: nelle figure grandi quasi tutte le coppie sono lontane
  const near = (a: Rect, b: Rect) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
  let n = 0;
  lines.forEach((A, i) => {
    const ends = [A.e.from.node, A.e.to.node];
    for (const B of lines.slice(i + 1)) {
      if (ends.includes(B.e.from.node) || ends.includes(B.e.to.node) || !near(A.box, B.box)) continue;
      if (A.segs.some(([p, q]) => B.segs.some(([r, s]) => crosses(p, q, r, s)))) n++;
    }
    for (const b of blocks) if (!ends.includes(b.id) && near(A.box, b) && A.segs.some(([p, q]) => through(p, q, b))) n++;
    for (const r of captions) if (near(A.box, r) && A.segs.some(([p, q]) => through(p, q, r))) n++;
  });
  return n;
}

// ---------- testo un po' più grande ----------

/** Porta a `needPx` le scritte più piccole, ma mai oltre MAX_GROWTH volte la loro misura originale. */
function enlarge(doc: Doc, original: Doc, needPx: number): Doc {
  const orig = new Map(original.nodes.map((n) => [n.id, n]));
  const origE = new Map(original.edges.map((e) => [e.id, e]));
  const up = (size: number, base: number, text: string) => (text.trim() ? Math.max(size, Math.min(needPx, Math.round(base * MAX_GROWTH))) : size);
  return {
    ...doc,
    nodes: doc.nodes.map((n) => {
      const o = orig.get(n.id) ?? n;
      return { ...n, fontSize: up(n.fontSize, o.fontSize, n.label), subSize: up(n.subSize, o.subSize, n.sublabel) };
    }),
    edges: doc.edges.map((e) => ({ ...e, fontSize: up(e.fontSize, (origE.get(e.id) ?? e).fontSize, e.label) })),
  };
}

// ---------- mai peggio di prima ----------

interface Problems {
  issues: Set<string>; // difetti del revisore (review.ts)
  pt: number; // testo stampato più piccolo
  heightCm: number;
}

/** Ciò che la vista Pagina chiede di sistemare (vedi PaperPage), con le stesse soglie: MIN_PT e HALF_PAGE_CM. */
function problems(doc: Doc): Problems {
  const L = pageLayout(doc, venueById(doc.settings.venue), 0);
  return { issues: new Set(reviewDoc(doc).map((i) => i.id)), pt: L?.text.pt ?? Infinity, heightCm: L?.heightCm ?? 0 };
}

/**
 * Cosa c'è di nuovo da sistemare rispetto a prima: un difetto del revisore che non c'era, testo che diventa troppo
 * piccolo (o più piccolo, se lo era già), 'tall' se la figura supera mezza pagina e prima no, o si allunga se la
 * superava già. La larghezza consigliata non conta: cambia solo se il testo diventa leggibile anche più stretto.
 */
function added(before: Problems, after: Problems): string[] {
  const out = [...after.issues].filter((id) => !before.issues.has(id));
  if (after.pt < MIN_PT && after.pt < Math.min(MIN_PT, before.pt) - 0.01) out.push('small');
  if (after.heightCm > Math.max(before.heightCm, HALF_PAGE_CM)) out.push('tall');
  return out;
}

export interface FitResult {
  ok: boolean; // il testo arriva a MIN_PT senza peggiorare la figura
  doc: Doc; // con ok false è la figura di prima, o quella col testo ingrandito quanto si poteva (partial)
  rows: number;
  pt: number;
  partial?: boolean; // ok false, ma il testo è cresciuto quanto poteva senza peggiorare la figura
  // perché non arriva a MIN_PT: servirebbe più di MAX_GROWTH; la figura diventerebbe molto alta (o più alta);
  // le frecce si strapperebbero o aggroviglierebbero; il revisore troverebbe difetti nuovi
  why?: 'small' | 'tall' | 'torn' | 'issue';
}

/**
 * Rende leggibile il testo alla larghezza della rivista scelta: prima con una riga sola, poi andando a capo
 * su 2 o 3 righe. Ogni tentativo ingrandisce il testo al massimo di MAX_GROWTH, allarga i blocchi e rispazia.
 * Un tentativo vale solo se non lascia la figura peggio di com'era: nessun collegamento strappato (vedi pack),
 * nessun difetto nuovo per il revisore, e non più alta di mezza pagina (HALF_PAGE_CM, la soglia della vista
 * Pagina) se non lo era, né più alta di prima se lo era già. Se nessuno arriva a MIN_PT, il testo cresce almeno
 * quanto può restando su una riga; se nemmeno questo aiuta, la figura resta com'è.
 */
export function fitToVenue(doc: Doc): FitResult {
  const venue = venueById(doc.settings.venue);
  const start = pageLayout(doc, venue, 0);
  if (!start || start.text.pt >= MIN_PT) return { ok: true, doc, rows: 1, pt: start?.text.pt ?? Infinity };
  const before = problems(doc);
  const knots = tangles(doc);
  /** In cosa il tentativo peggiorerebbe la figura; null se in niente. */
  const harm = (cand: Doc, torn: number): FitResult['why'] | null => {
    const bad = added(before, problems(cand));
    return bad.includes('tall') ? 'tall' : torn || tangles(cand) > knots ? 'torn' : bad.length ? 'issue' : null;
  };
  // fra le disposizioni che rendono leggibile il testo si sceglie quella che occupa meno pagina
  let best: (FitResult & { height: number }) | null = null;
  let grown: { doc: Doc; pt: number } | null = null; // una riga, testo cresciuto quanto possibile
  let why: FitResult['why'];
  for (let rows = 1; rows <= MAX_ROWS; rows++) {
    // ogni tentativo riparte dalla figura originale: impaginare una figura già divisa in righe ne mescolerebbe l'ordine
    let needPx = 0;
    for (let i = 0; i < 6; i++) {
      const { doc: cand, torn, rows: got } = pack(fitBoxes(needPx ? enlarge(doc, doc, needPx) : doc), rows);
      if (got < rows) break; // non si divide in tante righe: il tentativo con meno righe c'è già stato
      const L = pageLayout(cand, venue, 0)!;
      if (rows === 1) grown = { doc: cand, pt: L.text.pt };
      if (L.text.pt >= MIN_PT) {
        const bad = harm(cand, torn);
        if (!bad && (!best || L.heightCm < best.height - 0.2)) best = { ok: true, doc: cand, rows, pt: L.text.pt, height: L.heightCm };
        if (bad) why ??= bad; // si spiega il motivo del tentativo con meno righe
        break;
      }
      const next = Math.ceil(MIN_PT / (PX_PT * L.scale));
      if (next <= needPx) break; // il testo non può crescere oltre MAX_GROWTH: serve un'altra riga
      needPx = next;
    }
  }
  if (best) return { ok: true, doc: best.doc, rows: best.rows, pt: best.pt };
  why ??= 'small';
  // ingrandire un poco serve solo se si vede: almeno un quarto di punto in più
  if (grown && grown.pt >= start.text.pt + 0.25 && !harm(grown.doc, 0)) return { ok: false, partial: true, doc: grown.doc, rows: 1, pt: grown.pt, why };
  return { ok: false, doc, rows: 1, pt: start.text.pt, why };
}

/** Correzione per il revisore: blocchi allargati quanto le loro scritte, poi spazi di nuovo uguali. */
export const fixOverflow = (doc: Doc): Doc => pack(fitBoxes(doc), 1).doc;

// ---------- figura troppo alta ----------

const COMPACT_GAP = 24; // spazio fra due fasce quando si stringe la figura: basta per una freccia corta

/**
 * Stringe gli spazi vuoti fra una fascia e l'altra, fino a COMPACT_GAP: resta lo spazio per la freccia (e per la
 * sua scritta, se ne ha una). La disposizione non cambia, e uno spazio attraversato da frecce oblique o curve
 * (un ventaglio, un server che parla coi client) resta com'è: lì l'altezza serve al disegno.
 */
function compact(doc: Doc): Doc {
  const bands = bandsWithEdges(doc);
  if (bands.length < 2) return doc;
  const bandOf = new Map<string, number>();
  bands.forEach((b, i) => b.ids.forEach((id) => bandOf.set(id, i)));
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const cx = (id: string) => byId.get(id)!.x + byId.get(id)!.w / 2;
  // spazio minimo sotto ogni fascia
  const need = bands.map(() => COMPACT_GAP);
  for (const e of doc.edges) {
    const a = bandOf.get(e.from.node), b = bandOf.get(e.to.node);
    if (a === undefined || b === undefined || a === b) continue;
    // una freccia obliqua o curva ha bisogno di tutta l'altezza che ha; una a gomito, di posto per la piega
    const slanted = Math.abs(cx(e.from.node) - cx(e.to.node)) > 12;
    const label = e.label.trim() ? e.fontSize * 1.4 * e.label.split('\n').length : 0;
    const min = slanted && e.routing !== 'ortho' ? Infinity : COMPACT_GAP + (slanted ? 10 : 0) + label;
    for (let i = Math.min(a, b); i < Math.max(a, b); i++) need[i] = Math.max(need[i], min);
  }
  const dy = new Map<string, number>();
  let lift = 0;
  bands.forEach((b, i) => {
    if (i) {
      const prev = bands[i - 1];
      lift += Math.max(0, b.box.y - (prev.box.y + prev.box.h) - need[i - 1]);
    }
    for (const id of b.ids) dy.set(id, lift);
  });
  if (lift < 1) return doc;
  return { ...doc, nodes: doc.nodes.map((n) => (dy.get(n.id) ? { ...n, y: n.y - dy.get(n.id)! } : n)) };
}

/**
 * Fasce orizzontali della figura (vedi clusters), ciascuna allargata al percorso e alla scritta delle frecce che
 * restano al suo interno: un anello che scende sotto i blocchi fa parte della fascia. Fasce che così si
 * sovrappongono diventano una sola.
 */
function bandsWithEdges(doc: Doc): Cluster[] {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const routes: { from: string; to: string; box: Rect }[] = [];
  for (const e of doc.edges) {
    const g = edgeGeometry(e, byId);
    if (!g) continue;
    const rects = g.pts.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 }));
    if (e.label.trim()) rects.push(textBlockRect(edgeLabelBlock(e, g), doc.settings.fontFamily));
    routes.push({ from: e.from.node, to: e.to.node, box: unionRect(rects) });
  }
  let bands = clusters(doc, 'y');
  for (;;) {
    const bandOf = new Map<string, number>();
    bands.forEach((b, i) => b.ids.forEach((id) => bandOf.set(id, i)));
    const grown = bands.map((b) => ({ ids: b.ids, box: b.box }));
    for (const r of routes) {
      const a = bandOf.get(r.from);
      if (a !== undefined && a === bandOf.get(r.to)) grown[a].box = unionRect([grown[a].box, r.box]);
    }
    const merged: Cluster[] = [];
    for (const b of grown) {
      const last = merged[merged.length - 1];
      if (last && b.box.y < last.box.y + last.box.h - 2) merged[merged.length - 1] = { ids: [...last.ids, ...b.ids], box: unionRect([last.box, b.box]) };
      else merged.push(b);
    }
    if (merged.length === bands.length) return merged;
    bands = merged;
  }
}

/** Rimpicciolisce tutto il disegno (blocchi, spazi e scritte) attorno al suo angolo in alto a sinistra. */
function shrink(doc: Doc, s: number): Doc {
  const b = docBounds(doc);
  const r = (v: number) => Math.round(v * 10) / 10;
  const font = (v: number) => Math.floor(v * s * 2) / 2; // per difetto: le scritte non escono dai blocchi
  return {
    ...doc,
    nodes: doc.nodes.map((n) => ({
      ...n,
      x: r(b.x + (n.x - b.x) * s),
      y: r(b.y + (n.y - b.y) * s),
      w: r(n.w * s),
      h: r(n.h * s),
      radius: r(n.radius * s),
      fontSize: font(n.fontSize),
      subSize: font(n.subSize),
    })),
    edges: doc.edges.map((e) => ({ ...e, offset: r(e.offset * s), fontSize: font(e.fontSize) })),
  };
}

export interface HeightResult {
  doc: Doc;
  tighter: boolean; // spazi fra le fasce ristretti
  column: boolean; // passata a una colonna sola (col testo un po' più grande, se serviva)
  shrink: number; // disegno rimpicciolito di questo fattore (1 = com'era)
  heightCm: number;
}

/**
 * Abbassa una figura più alta di mezza pagina provando quello che farebbe una persona: stringere gli spazi vuoti
 * fra le fasce, metterla in una colonna sola col testo appena più grande (se la rivista ha due colonne), stamparla
 * più piccola (se esce alla sua grandezza e il testo lo permette). Il testo non scende mai sotto MIN_PT. Vince la
 * figura che non supera mezza pagina e ne occupa meno; a parità, quella cambiata meno. null se niente la abbassa
 * di almeno un centimetro.
 */
export function fitHeight(doc: Doc): HeightResult | null {
  const venue = venueById(doc.settings.venue);
  const start = pageLayout(doc, venue, 0);
  if (!start || start.heightCm <= HALF_PAGE_CM) return null;
  const floor = Math.min(MIN_PT, start.text.pt); // un testo già troppo piccolo almeno non peggiora
  const col = VENUES.find((v) => v.id === venue.id.replace(/-full$/, '-col'));
  const found: (HeightResult & { score: number })[] = [];
  const consider = (d: Doc, how: Omit<HeightResult, 'doc' | 'heightCm'>) => {
    const v = venueById(d.settings.venue);
    const L = pageLayout(d, v, 0)!;
    if (L.text.pt < floor - 0.01) return;
    const cost = (how.tighter ? 1.1 : 1) * (how.shrink < 1 ? 1.05 : 1);
    found.push({ ...how, doc: d, heightCm: L.heightCm, score: (L.heightCm > HALF_PAGE_CM ? 1000 : 0) + figureWidthCm(v) * L.heightCm * cost });
    // esce alla sua grandezza (LaTeX non la riscala): basta stamparla un po' più piccola?
    const s = (HALF_PAGE_CM - 0.3) / L.heightCm; // un po' di margine: gli arrotondamenti la allungano appena
    if (how.shrink === 1 && s < 1 && L.scale >= 1 && L.text.pt * s >= MIN_PT) consider(shrink(d, s), { ...how, shrink: s });
  };
  const tight = compact(doc);
  for (const base of tight === doc ? [doc] : [doc, tight]) {
    const tighter = base !== doc;
    consider(base, { tighter, column: false, shrink: 1 });
    if (col && col.id !== venue.id) {
      const res = fitToVenue({ ...base, settings: { ...base.settings, venue: col.id } });
      if (res.ok) consider(res.doc, { tighter, column: true, shrink: 1 });
    }
  }
  const best = found.filter((f) => f.doc !== doc).sort((a, b) => a.score - b.score)[0];
  if (!best || best.heightCm > start.heightCm - 1) return null;
  return { doc: best.doc, tighter: best.tighter, column: best.column, shrink: best.shrink, heightCm: best.heightCm };
}

// ---------- tutto in un passo ----------

export interface PageFit {
  doc: Doc;
  fixes: number; // correzioni del revisore applicate
  text: FitResult; // il testo, alla larghezza scelta (prima di abbassare la figura)
  retext: boolean; // il testo è stato cambiato (reso leggibile o almeno ingrandito)
  low: HeightResult | null; // figura abbassata
  declined?: { span: Venue['span']; heightCm: number }; // larghezza consigliata non usata: la figura diventerebbe troppo alta
}

/**
 * «Adatta alla pagina» in un passo solo: correzioni del revisore, larghezza consigliata, testo leggibile, altezza.
 * Come ogni passo, non lascia la figura peggio di com'era (vedi added): se alla larghezza consigliata diventerebbe
 * troppo alta resta alla larghezza scelta, e lo si dice.
 */
export function fitPage(before: Doc): PageFit {
  let doc = before;
  let fixes = 0;
  for (let i = 0; i < 4; i++) {
    const issues = reviewDoc(doc);
    if (!issues.length) break;
    for (const issue of issues) doc = issue.fix(doc);
    fixes = Math.max(fixes, issues.length);
  }
  const start = problems(before);
  const attempt = (d: Doc): PageFit => {
    const text = fitToVenue(d);
    const low = fitHeight(text.doc);
    return { doc: low?.doc ?? text.doc, fixes, text, retext: text.doc !== d, low };
  };
  const venue = venueById(doc.settings.venue);
  const best = bestVenue(doc, venue);
  let declined: PageFit['declined'];
  if (best.id !== venue.id) {
    const wide = attempt({ ...doc, settings: { ...doc.settings, venue: best.id } });
    const after = problems(wide.doc);
    const bad = added(start, after);
    if (!bad.length) return wide;
    if (bad.includes('tall')) declined = { span: best.span, heightCm: after.heightCm };
  }
  const here = attempt(doc);
  // ogni passo controlla già il suo risultato: questa è solo l'ultima garanzia
  if (added(start, problems(here.doc)).length) return { ...here, doc: before, fixes: 0, text: { ...here.text, doc: before }, retext: false, low: null, declined };
  return { ...here, declined };
}
