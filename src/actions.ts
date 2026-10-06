import { docBounds, unionRect, type Pt } from './geometry';
import { GRID, GROUP_STYLE, MED_IMG, allPresets, isContainer, makeNode, normalizeDoc, uid, type Doc, type EdgeModel, type NodeModel, type Settings } from './model';
import { pageLayout, venueById } from './paper';
import { getState, setDoc, setSel, setView } from './store';
import { allTemplates } from './templates';
import { getUi } from './ui';

const CLIP_MARK = 'mlsketch-clip';
const snap = (v: number) => Math.round(v / GRID) * GRID;

function canvasSize(): { w: number; h: number } {
  const el = document.querySelector('.canvas');
  return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 800, h: 600 };
}

export function addPreset(presetId: string, at?: Pt) {
  const preset = allPresets().find((p) => p.id === presetId);
  if (!preset) return;
  const { doc, view } = getState();
  const node = makeNode(preset.node);
  let c = at;
  if (!c) {
    const size = canvasSize();
    const off = (doc.nodes.length % 8) * 14;
    c = { x: (size.w / 2 - view.x) / view.zoom + off, y: (size.h / 2 - view.y) / view.zoom + off };
  }
  node.x = snap(c.x - node.w / 2);
  node.y = snap(c.y - node.h / 2);
  // i gruppi vanno in fondo, così non coprono i blocchi già presenti
  const nodes = isContainer(node) ? [node, ...doc.nodes] : [...doc.nodes, node];
  setDoc({ ...doc, nodes });
  setSel({ nodes: [node.id], edges: [] });
}

function viewCenter(): Pt {
  const { view } = getState();
  const size = canvasSize();
  return { x: (size.w / 2 - view.x) / view.zoom, y: (size.h / 2 - view.y) / view.zoom };
}

/** Inserisce un design noto, centrato nel punto dato (o al centro della vista). */
export function addTemplate(templateId: string, at: Pt = viewCenter()) {
  const template = allTemplates().find((t) => t.id === templateId);
  if (!template) return;
  const built = template.build();
  const b = unionRect(built.nodes);
  const dx = snap(at.x - (b.x + b.w / 2));
  const dy = snap(at.y - (b.y + b.h / 2));
  const nodes = built.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
  const { doc } = getState();
  setDoc({
    ...doc,
    nodes: [...nodes.filter(isContainer), ...doc.nodes, ...nodes.filter((n) => !isContainer(n))],
    edges: [...doc.edges, ...built.edges],
  });
  setSel({ nodes: nodes.map((n) => n.id), edges: [] });
}

export function deleteSelection() {
  const { doc, sel } = getState();
  if (!sel.nodes.length && !sel.edges.length) return;
  const dn = new Set(sel.nodes);
  const de = new Set(sel.edges);
  setDoc({
    ...doc,
    nodes: doc.nodes.filter((n) => !dn.has(n.id)),
    edges: doc.edges.filter((e) => !de.has(e.id) && !dn.has(e.from.node) && !dn.has(e.to.node)),
  });
  setSel({ nodes: [], edges: [] });
}

export function serializeSelection(): string | null {
  const { doc, sel } = getState();
  if (!sel.nodes.length) return null;
  const ids = new Set(sel.nodes);
  return JSON.stringify({
    type: CLIP_MARK,
    nodes: doc.nodes.filter((n) => ids.has(n.id)),
    edges: doc.edges.filter((e) => ids.has(e.from.node) && ids.has(e.to.node)),
  });
}

let pasteCount = 0;

export function pasteSerialized(text: string): boolean {
  let clip: Pick<Doc, 'nodes' | 'edges'>;
  try {
    const data = JSON.parse(text);
    if (data?.type !== CLIP_MARK) return false;
    // appunti di un'altra versione o di un'altra finestra: campi mancanti, frecce verso blocchi non copiati
    clip = normalizeDoc({ nodes: data.nodes, edges: Array.isArray(data.edges) ? data.edges : [] });
  } catch {
    return false;
  }
  pasteCount++;
  const off = 20 * pasteCount;
  const idMap = new Map<string, string>();
  const nodes = clip.nodes.map((n) => {
    const id = uid('n');
    idMap.set(n.id, id);
    return { ...n, id, x: n.x + off, y: n.y + off };
  });
  const edges = clip.edges.map((e) => ({
    ...e,
    id: uid('e'),
    from: { ...e.from, node: idMap.get(e.from.node)! },
    to: { ...e.to, node: idMap.get(e.to.node)! },
  }));
  const { doc } = getState();
  setDoc({ ...doc, nodes: [...doc.nodes, ...nodes], edges: [...doc.edges, ...edges] });
  setSel({ nodes: nodes.map((n) => n.id), edges: edges.map((e) => e.id) });
  return true;
}

export function resetPasteOffset() {
  pasteCount = 0;
}

export function duplicateSelection() {
  const text = serializeSelection();
  if (!text) return;
  pasteCount = 0;
  pasteSerialized(text);
  pasteCount = 0;
}

export function selectAll() {
  const { doc } = getState();
  setSel({ nodes: doc.nodes.map((n) => n.id), edges: doc.edges.map((e) => e.id) });
}

export function updateNodes(ids: string[], patch: Partial<NodeModel>, coalesce?: string) {
  const { doc } = getState();
  const set = new Set(ids);
  setDoc({ ...doc, nodes: doc.nodes.map((n) => (set.has(n.id) ? { ...n, ...patch } : n)) }, { coalesce });
}

export function updateEdges(ids: string[], patch: Partial<EdgeModel>, coalesce?: string) {
  const { doc } = getState();
  const set = new Set(ids);
  setDoc({ ...doc, edges: doc.edges.map((e) => (set.has(e.id) ? { ...e, ...patch } : e)) }, { coalesce });
}

export function updateSettings(patch: Partial<Settings>) {
  const { doc } = getState();
  setDoc({ ...doc, settings: { ...doc.settings, ...patch } });
}

export function nudge(dx: number, dy: number) {
  const { doc, sel } = getState();
  if (!sel.nodes.length) return;
  const set = new Set(sel.nodes);
  // i passi con le frecce sugli stessi blocchi si annullano in una volta sola
  setDoc({ ...doc, nodes: doc.nodes.map((n) => (set.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) }, { coalesce: `nudge:${sel.nodes.join()}` });
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export function align(mode: AlignMode) {
  const { doc, sel } = getState();
  const set = new Set(sel.nodes);
  const picked = doc.nodes.filter((n) => set.has(n.id));
  if (picked.length < 2) return;
  const b = unionRect(picked);
  const move = (n: NodeModel): Partial<NodeModel> => {
    switch (mode) {
      case 'left': return { x: b.x };
      case 'hcenter': return { x: b.x + b.w / 2 - n.w / 2 };
      case 'right': return { x: b.x + b.w - n.w };
      case 'top': return { y: b.y };
      case 'vcenter': return { y: b.y + b.h / 2 - n.h / 2 };
      case 'bottom': return { y: b.y + b.h - n.h };
    }
  };
  setDoc({ ...doc, nodes: doc.nodes.map((n) => (set.has(n.id) ? { ...n, ...move(n) } : n)) });
}

/** Rende uguali gli spazi fra i blocchi selezionati lungo un asse. */
export function distribute(axis: 'x' | 'y') {
  const { doc, sel } = getState();
  const set = new Set(sel.nodes);
  const size = axis === 'x' ? 'w' : 'h';
  const picked = doc.nodes.filter((n) => set.has(n.id)).sort((a, b) => a[axis] - b[axis]);
  if (picked.length < 3) return;
  const first = picked[0];
  const last = picked[picked.length - 1];
  const total = picked.reduce((s, n) => s + n[size], 0);
  const gap = (last[axis] + last[size] - first[axis] - total) / (picked.length - 1);
  const pos = new Map<string, number>();
  let cur = first[axis];
  for (const n of picked) {
    pos.set(n.id, cur);
    cur += n[size] + gap;
  }
  setDoc({ ...doc, nodes: doc.nodes.map((n) => (pos.has(n.id) ? { ...n, [axis]: pos.get(n.id)! } : n)) });
}

export function reorder(where: 'front' | 'back') {
  const { doc, sel } = getState();
  const set = new Set(sel.nodes);
  const picked = doc.nodes.filter((n) => set.has(n.id));
  const rest = doc.nodes.filter((n) => !set.has(n.id));
  if (!picked.length) return;
  setDoc({ ...doc, nodes: where === 'front' ? [...rest, ...picked] : [...picked, ...rest] });
}

export function zoomBy(factor: number, center?: Pt) {
  const { view } = getState();
  const size = canvasSize();
  const c = center ?? { x: size.w / 2, y: size.h / 2 };
  const zoom = Math.min(4, Math.max(0.2, view.zoom * factor));
  const k = zoom / view.zoom;
  setView({ zoom, x: c.x - (c.x - view.x) * k, y: c.y - (c.y - view.y) * k });
}

export function zoomFit(doc: Doc = getState().doc) {
  const size = canvasSize();
  // nella vista Pagina si inquadra la pagina attorno alla figura
  const page = getUi().canvasView === 'pagina' ? pageLayout(doc, venueById(doc.settings.venue), 0) : null;
  const b = page?.focus ?? docBounds(doc);
  // foglio vuoto: si parte dal 100%, non dallo zoom massimo
  const max = page || doc.nodes.length ? 2 : 1;
  // la barra degli strumenti (e nella vista Pagina anche quella della rivista) copre la parte
  // alta del foglio: si inquadra nello spazio che resta sotto
  const canvasTop = document.querySelector('.canvas')?.getBoundingClientRect().top ?? 0;
  const below = (sel: string, fallback: number) => (document.querySelector(sel)?.getBoundingClientRect().bottom ?? canvasTop + fallback) - canvasTop;
  const top = page ? below('.paper-bar', 120) + 12 : Math.max(0, below('.toolbar', 62) - 20);
  const zoom = Math.min(max, Math.max(0.2, Math.min((size.w - 80) / b.w, (size.h - top - 80) / b.h)));
  // la pagina parte subito sotto la barra, come un foglio aperto; il disegno libero resta al centro
  const y = page ? top + 8 - b.y * zoom : top + (size.h - top - b.h * zoom) / 2 - b.y * zoom;
  setView({ zoom, x: (size.w - b.w * zoom) / 2 - b.x * zoom, y });
}

// ---------- stile: copia e incolla ----------

const NODE_STYLE = ['fill', 'stroke', 'strokeWidth', 'dashed', 'radius', 'fontSize', 'bold', 'italic', 'textColor', 'subSize', 'align'] as const;
const EDGE_STYLE = ['color', 'width', 'dashed', 'arrowStart', 'arrowEnd', 'routing', 'fontSize', 'labelPos'] as const;

let copiedNodeStyle: Partial<NodeModel> | null = null;
let copiedEdgeStyle: Partial<EdgeModel> | null = null;

const pick = <T extends object, K extends keyof T>(obj: T, keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, obj[k]])) as Pick<T, K>;

export function copyStyle(): boolean {
  const { doc, sel } = getState();
  const n = doc.nodes.find((x) => x.id === sel.nodes[0]);
  const e = doc.edges.find((x) => x.id === sel.edges[0]);
  if (n) copiedNodeStyle = pick(n, NODE_STYLE);
  if (e) copiedEdgeStyle = pick(e, EDGE_STYLE);
  return !!(n || e);
}

export function pasteStyle() {
  const { doc, sel } = getState();
  const ns = new Set(sel.nodes);
  const es = new Set(sel.edges);
  if (!(copiedNodeStyle && ns.size) && !(copiedEdgeStyle && es.size)) return;
  setDoc({
    ...doc,
    nodes: copiedNodeStyle ? doc.nodes.map((n) => (ns.has(n.id) ? { ...n, ...copiedNodeStyle } : n)) : doc.nodes,
    edges: copiedEdgeStyle ? doc.edges.map((e) => (es.has(e.id) ? { ...e, ...copiedEdgeStyle } : e)) : doc.edges,
  });
}

/** Racchiude i blocchi selezionati in un gruppo tratteggiato con titolo. */
export function groupSelection() {
  const { doc, sel } = getState();
  const picked = doc.nodes.filter((n) => sel.nodes.includes(n.id));
  if (!picked.length) return;
  const b = unionRect(picked);
  const group = makeNode({ ...GROUP_STYLE, label: 'Modulo', x: snap(b.x - 20), y: snap(b.y - 34), w: snap(b.w + 40), h: snap(b.h + 54) });
  setDoc({ ...doc, nodes: [group, ...doc.nodes] });
  setSel({ nodes: [group.id], edges: [] });
}

/** Documento da esportare: tutto, oppure solo la selezione (con le connessioni interne). */
export function docForExport(selectionOnly: boolean): Doc {
  const { doc, sel } = getState();
  if (!selectionOnly || !sel.nodes.length) return doc;
  const ids = new Set(sel.nodes);
  return {
    ...doc,
    nodes: doc.nodes.filter((n) => ids.has(n.id)),
    edges: doc.edges.filter((e) => ids.has(e.from.node) && ids.has(e.to.node)),
  };
}

// ---------- immagini importate ----------

/** Inserisce un blocco con un'immagine dell'utente, con le sue proporzioni. */
export function addImage(img: { src: string; ratio: number; ai?: string }, at: Pt = viewCenter()) {
  let w = 160;
  let h = w / img.ratio;
  if (h > 200) {
    h = 200;
    w = h * img.ratio;
  }
  const node = makeNode({ ...MED_IMG, shape: 'photo', label: '', src: img.src, srcRatio: img.ratio, ai: img.ai ?? '', w: Math.round(w), h: Math.round(h) });
  node.x = snap(at.x - node.w / 2);
  node.y = snap(at.y - node.h / 2);
  const { doc } = getState();
  setDoc({ ...doc, nodes: [...doc.nodes, node] });
  setSel({ nodes: [node.id], edges: [] });
}

/** Aggiunge accanto a un'immagine la sua versione «latente» (vedi latentLook): l'originale resta com'è. */
export function addLatentBeside(nodeId: string, img: { src: string; ratio: number }) {
  const { doc } = getState();
  const n = doc.nodes.find((x) => x.id === nodeId);
  if (!n) return;
  const side = Math.min(n.w, n.h);
  const node = makeNode({ ...MED_IMG, shape: 'photo', label: '', src: img.src, srcRatio: img.ratio, ai: n.ai, w: side, h: side });
  node.x = snap(n.x + n.w + 80);
  node.y = snap(n.y + (n.h - side) / 2);
  setDoc({ ...doc, nodes: [...doc.nodes, node] });
  setSel({ nodes: [node.id], edges: [] });
}

/** Sostituisce l'immagine di un blocco, mantenendone la larghezza e adattando l'altezza. */
export function replaceImage(nodeId: string, img: { src: string; ratio: number }) {
  const n = getState().doc.nodes.find((x) => x.id === nodeId);
  if (!n) return;
  // un file dell'utente al posto di un'immagine generata non è più «immagine IA» (vedi la dichiarazione all'export)
  updateNodes([nodeId], { src: img.src, srcRatio: img.ratio, ai: '', h: Math.round(n.w / img.ratio) });
}
