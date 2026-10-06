// Revisore della figura: difetti che un revisore nota subito, ognuno con la sua correzione.
// Il testo troppo piccolo è in paper.ts (dipende dalla rivista); qui ci sono allineamento e
// spaziatura. I colori non si correggono in automatico: in uno schema a blocchi le etichette
// distinguono già i blocchi, e la vista Pagina offre l'anteprima in bianco e nero e per daltonici.
import { t } from './i18n';
import { fixOverflow, overflowingNodes } from './fit';
import { rectContains } from './geometry';
import { isContainer, type Doc, type NodeModel } from './model';
import { plainText } from './richtext';

export interface Issue {
  id: 'align' | 'spacing' | 'overflow';
  text: string;
  fix: (doc: Doc) => Doc;
}

const MAX_SKEW = 8; // oltre questo scarto lo spostamento è voluto
const SPREAD = 12; // differenza minima, in px, fra la freccia più corta e la più lunga
const SPREAD_RATIO = 0.3; // …e in proporzione alla lunghezza tipica

const cx = (n: NodeModel) => n.x + n.w / 2;
const cy = (n: NodeModel) => n.y + n.h / 2;
const nameOf = (n: NodeModel) => plainText(n.label).split('\n')[0].trim() || plainText(n.sublabel).trim() || t('un blocco');
const isBlock = (n: NodeModel | undefined): n is NodeModel => !!n && !isContainer(n) && n.shape !== 'text';
const move = (doc: Doc, shifts: Map<string, { dx: number; dy: number }>): Doc => ({
  ...doc,
  nodes: doc.nodes.map((n) => {
    const s = shifts.get(n.id);
    return s ? { ...n, x: n.x + s.dx, y: n.y + s.dy } : n;
  }),
});

// ---------- allineamento: blocchi collegati quasi in linea ----------

interface Skew {
  target: NodeModel;
  source: NodeModel;
  dx: number;
  dy: number;
}

function skews(doc: Doc): Skew[] {
  const map = new Map(doc.nodes.map((n) => [n.id, n]));
  const out: Skew[] = [];
  const seen = new Set<string>();
  for (const e of doc.edges) {
    const a = map.get(e.from.node), b = map.get(e.to.node);
    if (!isBlock(a) || !isBlock(b) || seen.has(b.id)) continue;
    const horizontal = Math.abs(cx(b) - cx(a)) >= Math.abs(cy(b) - cy(a));
    const d = horizontal ? cy(a) - cy(b) : cx(a) - cx(b);
    if (Math.abs(d) >= 0.5 && Math.abs(d) <= MAX_SKEW) {
      seen.add(b.id);
      out.push({ target: b, source: a, dx: horizontal ? 0 : d, dy: horizontal ? d : 0 });
    }
  }
  return out;
}

/**
 * Pezzi già in linea lungo l'asse (stesso centro) e collegati da una freccia, a gruppi: si spostano insieme,
 * se no la freccia dritta fra loro prende un gradino. Vale anche per i punticini invisibili a cui si appoggiano
 * le frecce, che non sono blocchi: larghi 1 px, hanno il centro a mezzo pixel.
 */
function inLine(doc: Doc, axis: 'x' | 'y'): Map<string, string[]> {
  const map = new Map(doc.nodes.map((n) => [n.id, n]));
  const c = axis === 'x' ? cx : cy;
  const group = new Map(doc.nodes.map((n) => [n.id, [n.id]]));
  for (const e of doc.edges) {
    const a = map.get(e.from.node), b = map.get(e.to.node);
    if (!a || !b || isContainer(a) || isContainer(b)) continue;
    if (Math.abs(c(a) - c(b)) >= (isBlock(a) && isBlock(b) ? 0.5 : 0.75)) continue;
    const ga = group.get(a.id)!, gb = group.get(b.id)!;
    if (ga === gb) continue;
    ga.push(...gb);
    for (const id of gb) group.set(id, ga);
  }
  return group;
}

function fixAlign(doc: Doc): Doc {
  // a ogni passata si allineano i blocchi a quelli da cui partono le frecce; tre passate bastano per le catene
  for (let pass = 0; pass < 3; pass++) {
    const list = skews(doc);
    if (!list.length) break;
    const lines = { x: inLine(doc, 'x'), y: inLine(doc, 'y') };
    const shift = { x: new Map<string, number>(), y: new Map<string, number>() };
    for (const s of list) {
      const axis = s.dx ? 'x' : 'y';
      // il blocco si porta dietro ciò che è già in linea con lui, e va dove arriva il blocco da cui parte la
      // freccia, se anche quello si sposta; un gruppo si sposta una volta per passata
      let ids = lines[axis].get(s.target.id)!;
      if (ids.includes(s.source.id)) ids = [s.target.id];
      if (ids.some((id) => shift[axis].has(id))) continue;
      const d = (s.dx || s.dy) + (shift[axis].get(s.source.id) ?? 0);
      for (const id of ids) shift[axis].set(id, d);
    }
    const ids = new Set([...shift.x.keys(), ...shift.y.keys()]);
    doc = move(doc, new Map([...ids].map((id) => [id, { dx: shift.x.get(id) ?? 0, dy: shift.y.get(id) ?? 0 }])));
  }
  return doc;
}

// ---------- spaziatura: frecce orizzontali di lunghezze diverse ----------

interface Gap {
  a: NodeModel;
  b: NodeModel;
  gap: number;
}

function gaps(doc: Doc): Gap[] {
  const containers = doc.nodes.filter(isContainer);
  const inside = (n: NodeModel) => containers.some((c) => c.id !== n.id && rectContains(c, n));
  const map = new Map(doc.nodes.map((n) => [n.id, n]));
  const out: Gap[] = [];
  for (const e of doc.edges) {
    const a = map.get(e.from.node), b = map.get(e.to.node);
    if (!isBlock(a) || !isBlock(b) || inside(a) || inside(b)) continue;
    if (Math.abs(cy(a) - cy(b)) > 2 || b.x <= a.x) continue;
    const gap = b.x - (a.x + a.w);
    if (gap > 4 && gap < 300) out.push({ a, b, gap });
  }
  return out;
}

const median = (v: number[]) => {
  const s = [...v].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
};

/**
 * La riga con le frecce più disuguali, se si può pareggiare senza rompere il disegno: correggere
 * sposta tutto ciò che sta a destra di ogni freccia, quindi nessun blocco o contenitore deve
 * stare a cavallo di quei punti.
 */
function unevenRow(doc: Doc): Gap[] | null {
  const rows = new Map<number, Gap[]>();
  for (const g of gaps(doc)) {
    const key = Math.round(cy(g.a) / 4);
    rows.set(key, [...(rows.get(key) ?? []), g]);
  }
  let best: Gap[] | null = null;
  let bestSpread = 0;
  for (const row of rows.values()) {
    if (row.length < 3) continue;
    const v = row.map((g) => g.gap);
    const spread = Math.max(...v) - Math.min(...v);
    if (spread <= Math.max(SPREAD, SPREAD_RATIO * median(v)) || spread <= bestSpread) continue;
    const straddles = row.some((g) => doc.nodes.some((n) => n.x < g.b.x - 0.5 && n.x + n.w > g.b.x + 0.5));
    if (straddles) continue;
    best = row;
    bestSpread = spread;
  }
  return best;
}

function fixSpacing(doc: Doc): Doc {
  const row = unevenRow(doc);
  if (!row) return doc;
  const target = Math.round(median(row.map((g) => g.gap)));
  // da sinistra a destra: ogni correzione sposta tutto ciò che sta più a destra, come inserire spazio
  const order = [...row].sort((p, q) => p.b.x - q.b.x).map((g) => [g.a.id, g.b.id] as const);
  for (const [aId, bId] of order) {
    const a = doc.nodes.find((n) => n.id === aId)!, b = doc.nodes.find((n) => n.id === bId)!;
    const delta = target - (b.x - (a.x + a.w));
    if (Math.abs(delta) < 1) continue;
    const from = b.x;
    doc = { ...doc, nodes: doc.nodes.map((n) => (n.x >= from - 0.5 ? { ...n, x: n.x + delta } : n)) };
  }
  return doc;
}

export function reviewDoc(doc: Doc): Issue[] {
  const issues: Issue[] = [];
  const over = overflowingNodes(doc);
  if (over.length) {
    const names = over.slice(0, 3).map((n) => `«${nameOf(n)}»`).join(', ');
    issues.push({
      id: 'overflow',
      text: t('Testo fuori dai blocchi ({count}): {names}.', { count: over.length, names: names + (over.length > 3 ? '…' : '') }),
      fix: fixOverflow,
    });
  }
  const sk = skews(doc);
  if (sk.length) {
    const s = sk[0];
    const px = Math.round(Math.abs(s.dx || s.dy));
    issues.push({
      id: 'align',
      text:
        sk.length === 1
          ? t('«{target}» è {px} px fuori linea rispetto a «{source}».', { target: nameOf(s.target), px, source: nameOf(s.source) })
          : t('{count} blocchi sono fuori linea di pochi pixel.', { count: sk.length }),
      fix: fixAlign,
    });
  }
  const row = unevenRow(doc);
  if (row) {
    const v = row.map((x) => x.gap);
    const lo = Math.round(Math.min(...v)), hi = Math.round(Math.max(...v));
    issues.push({ id: 'spacing', text: t('Nella riga di «{name}» le frecce hanno lunghezze diverse: da {min} a {max} px.', { name: nameOf(row[0].a), min: lo, max: hi }), fix: fixSpacing });
  }
  return issues;
}
