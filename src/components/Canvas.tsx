import { t } from '../i18n';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { run } from '../App';
import { pickImageFile, readImage } from '../images';
import { addImage, addPreset, addTemplate, replaceImage, selectAll, updateEdges, updateNodes, zoomBy } from '../actions';
import {
  edgeGeometry,
  edgeLabelBlock,
  edgePathD,
  labelLayout,
  portPoint,
  rectContains,
  rectsIntersect,
  unionRect,
  type Anchor,
  type Pt,
  type Rect,
} from '../geometry';
import { FONT_CSS, GRID, isContainer, makeEdge, type NodeModel, type Side } from '../model';
import { DiagramContent } from '../render/DiagramContent';
import { getState, pushHistory, setDoc, setEditing, setSel, setView, useStore, type Editing } from '../store';
import { getUi, noteRecent, setUi, toast, useUi } from '../ui';
import { EmptyState } from './EmptyState';
import { PaperBar, PaperPage } from './PaperPage';
import { CommentsLayer } from './Comments';
import { LiveCursors } from './Live';
import { SelectionBar } from './SelectionBar';
import { keys } from '../os';

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
const MIN_SIZE = 10;
const ACCENT = '#2F6FEB';

interface Overlay {
  marquee?: Rect;
  guides?: { x: number[]; y: number[] };
  connect?: { from: Pt; to: Pt };
}

const snapGrid = (v: number) => Math.round(v / GRID) * GRID;

/** Cerca l'allineamento più vicino fra i bordi/centri in movimento e quelli fermi. */
function snapAxis(moving: number[], fixed: number[], tol: number): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null;
  for (const m of moving) {
    for (const f of fixed) {
      const d = f - m;
      if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, at: f };
    }
  }
  return best;
}

function trackPointer(onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void) {
  // anche un gesto interrotto dal sistema (pointercancel) chiude il trascinamento: senza, il blocco
  // continuerebbe a seguire il mouse a tasto rilasciato
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    onUp(e);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

export function Canvas() {
  const gridStyle = useUi((s) => s.gridStyle);
  const doc = useStore((s) => s.doc);
  const sel = useStore((s) => s.sel);
  const view = useStore((s) => s.view);
  const editing = useStore((s) => s.editing);
  const svgRef = useRef<SVGSVGElement>(null);
  const spaceDown = useRef(false);
  const [hover, setHover] = useState<string | null>(null);
  const [ov, setOv] = useState<Overlay>({});
  const [busy, setBusy] = useState(false); // gesto in corso: nasconde porte e maniglie
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const nodeMap = useMemo(() => new Map(doc.nodes.map((n) => [n.id, n])), [doc.nodes]);

  const toDoc = (clientX: number, clientY: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = getState().view;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  };

  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = svg.getBoundingClientRect();
        zoomBy(Math.exp(-e.deltaY * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top });
      } else {
        const v = getState().view;
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    const setSpace = (on: boolean) => {
      spaceDown.current = on;
      svg.style.cursor = on ? 'grab' : '';
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.type === 'keyup') {
        if (!spaceDown.current) return;
        setSpace(false);
        e.preventDefault();
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      // un pulsante raggiunto con Tab si preme con Spazio; dopo un clic col mouse Spazio sposta la vista
      if (target.closest('button, a, [role="button"]') && target.matches(':focus-visible')) return;
      setSpace(true);
      e.preventDefault();
    };
    // Spazio rilasciato in un'altra finestra: il keyup non arriva e ogni clic sposterebbe la vista
    const onBlur = () => setSpace(false);
    svg.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    const ro = new ResizeObserver(() => setSize({ w: svg.clientWidth, h: svg.clientHeight }));
    ro.observe(svg);
    return () => {
      ro.disconnect();
      svg.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const startPan = (e: React.PointerEvent) => {
    const start = getState().view;
    trackPointer(
      (ev) => setView({ ...start, x: start.x + ev.clientX - e.clientX, y: start.y + ev.clientY - e.clientY }),
      () => {},
    );
  };

  const startResize = (id: string, handle: string) => {
    const startDoc = getState().doc;
    const n = startDoc.nodes.find((x) => x.id === id);
    if (!n) return;
    setBusy(true);
    trackPointer(
      (ev) => {
        let q = toDoc(ev.clientX, ev.clientY);
        if (startDoc.settings.snap && !ev.altKey) q = { x: snapGrid(q.x), y: snapGrid(q.y) };
        let x1 = n.x, y1 = n.y, x2 = n.x + n.w, y2 = n.y + n.h;
        if (handle.includes('w')) x1 = Math.min(q.x, x2 - MIN_SIZE);
        if (handle.includes('e')) x2 = Math.max(q.x, x1 + MIN_SIZE);
        if (handle.includes('n')) y1 = Math.min(q.y, y2 - MIN_SIZE);
        if (handle.includes('s')) y2 = Math.max(q.y, y1 + MIN_SIZE);
        const next = { ...n, x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        setDoc({ ...startDoc, nodes: startDoc.nodes.map((m) => (m.id === id ? next : m)) }, { history: false });
      },
      () => {
        setBusy(false);
        pushHistory(startDoc);
      },
    );
  };

  /** Trascina il tratto centrale di una freccia ortogonale (campo `offset`). */
  const startEdgeOffset = (e: React.PointerEvent, edgeId: string) => {
    const startDoc = getState().doc;
    const edge = startDoc.edges.find((x) => x.id === edgeId);
    const map = new Map(startDoc.nodes.map((n) => [n.id, n]));
    const g0 = edge && edgeGeometry(edge, map);
    const g1 = edge && edgeGeometry({ ...edge, offset: edge.offset + 10 }, map);
    if (!edge || !g0 || !g1) return;
    // di quanto si sposta il tratto centrale per 10 unità di offset: serve a proiettare il mouse
    const dp = { x: g1.label.x - g0.label.x, y: g1.label.y - g0.label.y };
    const len2 = dp.x * dp.x + dp.y * dp.y;
    if (len2 < 1) return;
    const p = toDoc(e.clientX, e.clientY);
    setBusy(true);
    trackPointer(
      (ev) => {
        const q = toDoc(ev.clientX, ev.clientY);
        const offset = Math.round(edge.offset + (10 * ((q.x - p.x) * dp.x + (q.y - p.y) * dp.y)) / len2);
        setDoc({ ...startDoc, edges: startDoc.edges.map((x) => (x.id === edgeId ? { ...x, offset } : x)) }, { history: false });
      },
      () => {
        setBusy(false);
        pushHistory(startDoc);
      },
    );
  };

  const startConnect = (e: React.PointerEvent, nodeId: string, side: Side) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const from = portPoint(node, side);
    setOv({ connect: { from, to: toDoc(e.clientX, e.clientY) } });
    trackPointer(
      (ev) => setOv({ connect: { from, to: toDoc(ev.clientX, ev.clientY) } }),
      (ev) => {
        setOv({});
        if (ev.type === 'pointercancel') return;
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const port = el?.closest('[data-port]');
        const target = port?.getAttribute('data-port-node') ?? el?.closest('[data-node-id]')?.getAttribute('data-node-id');
        if (!target || target === nodeId) return;
        const toSide = (port?.getAttribute('data-port') as Side | null) ?? 'auto';
        const edge = makeEdge({ node: nodeId, side }, { node: target, side: toSide });
        const d = getState().doc;
        setDoc({ ...d, edges: [...d.edges, edge] });
        setSel({ nodes: [], edges: [edge.id] });
      },
    );
  };

  const startMove = (e: React.PointerEvent, id: string) => {
    const wasSelected = getState().sel.nodes.includes(id);
    if (e.shiftKey) {
      const s = getState().sel;
      setSel({ ...s, nodes: wasSelected ? s.nodes.filter((x) => x !== id) : [...s.nodes, id] });
      if (wasSelected) return;
    } else if (!wasSelected) {
      setSel({ nodes: [id], edges: [] });
    }
    const st = getState();
    const startDoc = st.doc;
    const byId = new Map(startDoc.nodes.map((n) => [n.id, n]));
    const ids = new Set(st.sel.nodes);
    // un gruppo trascina con sé i blocchi che contiene
    for (const gid of st.sel.nodes) {
      const g = byId.get(gid);
      if (!g || !isContainer(g)) continue;
      for (const n of startDoc.nodes) if (n.id !== gid && rectContains(g, n)) ids.add(n.id);
    }
    const bb = unionRect(startDoc.nodes.filter((n) => ids.has(n.id)));
    const others = startDoc.nodes.filter((n) => !ids.has(n.id));
    const fixedX = others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w]);
    const fixedY = others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h]);
    const primary = byId.get(id)!;
    const p = toDoc(e.clientX, e.clientY);
    let moved = false;
    trackPointer(
      (ev) => {
        if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return;
        if (!moved) setBusy(true);
        moved = true;
        const q = toDoc(ev.clientX, ev.clientY);
        let dx = q.x - p.x;
        let dy = q.y - p.y;
        const guides = { x: [] as number[], y: [] as number[] };
        if (startDoc.settings.snap && !ev.altKey) {
          const tol = 5 / getState().view.zoom;
          const sx = snapAxis([bb.x + dx, bb.x + bb.w / 2 + dx, bb.x + bb.w + dx], fixedX, tol);
          const sy = snapAxis([bb.y + dy, bb.y + bb.h / 2 + dy, bb.y + bb.h + dy], fixedY, tol);
          if (sx) {
            dx += sx.delta;
            guides.x.push(sx.at);
          } else dx = snapGrid(primary.x + dx) - primary.x;
          if (sy) {
            dy += sy.delta;
            guides.y.push(sy.at);
          } else dy = snapGrid(primary.y + dy) - primary.y;
        }
        setDoc(
          { ...startDoc, nodes: startDoc.nodes.map((n) => (ids.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) },
          { history: false },
        );
        setOv({ guides });
      },
      () => {
        setOv({});
        setBusy(false);
        if (moved) pushHistory(startDoc);
        else if (!e.shiftKey && wasSelected) setSel({ nodes: [id], edges: [] });
      },
    );
  };

  const startMarquee = (e: React.PointerEvent) => {
    const base = e.shiftKey ? getState().sel : { nodes: [], edges: [] };
    const p = toDoc(e.clientX, e.clientY);
    let r: Rect | null = null;
    trackPointer(
      (ev) => {
        const q = toDoc(ev.clientX, ev.clientY);
        r = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.abs(q.x - p.x), h: Math.abs(q.y - p.y) };
        setOv({ marquee: r });
      },
      () => {
        setOv({});
        const box = r;
        if (!box) {
          setSel(base);
          return;
        }
        const d = getState().doc;
        const map = new Map(d.nodes.map((n) => [n.id, n]));
        const nodes = d.nodes.filter((n) => (isContainer(n) ? rectContains(box, n) : rectsIntersect(box, n))).map((n) => n.id);
        const edges = d.edges
          .filter((ed) => {
            const g = edgeGeometry(ed, map);
            return !!g && g.pts.every((pt) => rectContains(box, { x: pt.x, y: pt.y, w: 0, h: 0 }));
          })
          .map((ed) => ed.id);
        setSel({ nodes: [...new Set([...base.nodes, ...nodes])], edges: [...new Set([...base.edges, ...edges])] });
      },
    );
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    setMenu(null);
    (document.activeElement as HTMLElement | null)?.blur?.();
    const t = e.target as Element;
    const edgeHandle = t.closest('[data-edge-handle]');
    if (edgeHandle) return startEdgeOffset(e, edgeHandle.getAttribute('data-edge-handle')!);
    const handle = t.closest('[data-handle]');
    if (handle) return startResize(handle.getAttribute('data-node')!, handle.getAttribute('data-handle')!);
    const port = t.closest('[data-port]');
    if (port) return startConnect(e, port.getAttribute('data-port-node')!, port.getAttribute('data-port') as Side);
    const nodeEl = t.closest('[data-node-id]');
    if (nodeEl) return startMove(e, nodeEl.getAttribute('data-node-id')!);
    const edgeEl = t.closest('[data-edge-id]');
    if (edgeEl) {
      const id = edgeEl.getAttribute('data-edge-id')!;
      const s = getState().sel;
      if (e.shiftKey) setSel({ ...s, edges: s.edges.includes(id) ? s.edges.filter((x) => x !== id) : [...s.edges, id] });
      else setSel({ nodes: [], edges: [id] });
      return;
    }
    startMarquee(e);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const t = e.target as Element;
    const id =
      t.closest('[data-port]')?.getAttribute('data-port-node') ?? t.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
    if (id !== hover) setHover(id);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const t = e.target as Element;
    const nodeId = t.closest('[data-node-id]')?.getAttribute('data-node-id');
    const node = nodeId ? getState().doc.nodes.find((n) => n.id === nodeId) : undefined;
    // segnaposto di un'immagine: il doppio clic sceglie il file
    if (node?.shape === 'photo' && !node.src) {
      void pickImageFile()
        .then(async (file) => file && replaceImage(node.id, await readImage(file)))
        .catch((err) => toast(err instanceof Error ? err.message : String(err), 'info'));
      return;
    }
    if (nodeId) return setEditing({ kind: 'node', id: nodeId });
    const edgeId = t.closest('[data-edge-id]')?.getAttribute('data-edge-id');
    if (edgeId) setEditing({ kind: 'edge', id: edgeId });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const t = e.target as Element;
    const s = getState().sel;
    const nodeId = t.closest('[data-node-id]')?.getAttribute('data-node-id');
    const edgeId = t.closest('[data-edge-id]')?.getAttribute('data-edge-id');
    let kind: MenuState['kind'] = 'canvas';
    if (nodeId) {
      if (!s.nodes.includes(nodeId)) setSel({ nodes: [nodeId], edges: [] });
      kind = 'node';
    } else if (edgeId) {
      if (!s.edges.includes(edgeId)) setSel({ nodes: [], edges: [edgeId] });
      kind = 'edge';
    }
    const r = (e.currentTarget as Element).getBoundingClientRect();
    setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, kind });
  };

  const onDrop = (e: React.DragEvent) => {
    // file immagine trascinati dal Finder: uno accanto all'altro dove li si lascia
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      const at = toDoc(e.clientX, e.clientY);
      files.forEach((file, i) =>
        readImage(file)
          .then((img) => addImage(img, { x: at.x + i * 180, y: at.y }))
          .catch((err) => toast(err instanceof Error ? err.message : String(err), 'info')),
      );
      return;
    }
    const preset = e.dataTransfer.getData('application/x-mlsketch-preset');
    const template = e.dataTransfer.getData('application/x-mlsketch-template');
    if (!preset && !template) return;
    e.preventDefault();
    if (preset) addPreset(preset, toDoc(e.clientX, e.clientY));
    else addTemplate(template, toDoc(e.clientX, e.clientY));
    noteRecent(preset ? `p:${preset}` : `t:${template}`);
  };

  const z = view.zoom;
  const single = sel.nodes.length === 1 && !sel.edges.length ? nodeMap.get(sel.nodes[0]) : undefined;
  const singleEdge = sel.edges.length === 1 && !sel.nodes.length ? doc.edges.find((x) => x.id === sel.edges[0]) : undefined;
  const edgeHandle = singleEdge?.routing === 'ortho' && !busy ? edgeGeometry(singleEdge, nodeMap) : null;
  const portNodes = busy ? [] : [...new Set([hover, single?.id])].map((id) => (id ? nodeMap.get(id) : undefined)).filter((n): n is NodeModel => !!n);
  const hoverNode = !busy && hover && !sel.nodes.includes(hover) ? nodeMap.get(hover) : undefined;
  const selNodes = sel.nodes.map((id) => nodeMap.get(id)).filter((n): n is NodeModel => !!n);
  const selBox = selNodes.length > 1 ? unionRect(selNodes) : null;
  const barBox =
    selBox && !busy && !editing && !menu
      ? { x: view.x + selBox.x * z - 6, y: view.y + selBox.y * z - 6, w: selBox.w * z + 12, h: selBox.h * z + 12 }
      : null;

  return (
    <div className="canvas" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <svg
        ref={svgRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        <defs>
          {gridStyle === 'dots' ? (
            <pattern id="grid" width={GRID * 2} height={GRID * 2} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={0.9} fill="#C9CED6" />
            </pattern>
          ) : gridStyle === 'cross' ? (
            <pattern id="grid" width={GRID * 4} height={GRID * 4} patternUnits="userSpaceOnUse">
              <path d="M-3 0H3M0 -3V3M37 0h6M40 -3v6M-3 40h6M0 37v6M37 40h6M40 37v6" stroke="#C3C9D2" strokeWidth={0.8} fill="none" />
            </pattern>
          ) : (
            // quadretti: riga sottile ogni 20 px, più marcata ogni 100
            <pattern id="grid" width={GRID * 10} height={GRID * 10} patternUnits="userSpaceOnUse">
              <path d="M20 0V100M40 0V100M60 0V100M80 0V100M0 20H100M0 40H100M0 60H100M0 80H100" stroke="#E9ECF0" strokeWidth={0.6} fill="none" />
              <path d="M0 0V100M0 0H100" stroke="#D5DAE1" strokeWidth={1.2} fill="none" />
            </pattern>
          )}
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${z})`}>
          {doc.settings.grid && z >= 0.45 && (
            <rect x={-50000} y={-50000} width={100000} height={100000} fill="url(#grid)" pointerEvents="none" />
          )}
          <PaperPage doc={doc} zoom={z} />
          <DiagramContent doc={doc} interactive />

          <g pointerEvents="none" fill="none" stroke={ACCENT}>
            {sel.edges.map((id) => {
              const edge = doc.edges.find((x) => x.id === id);
              const g = edge && edgeGeometry(edge, nodeMap);
              return g ? <path key={id} d={edgePathD(g, 0, 0)} strokeWidth={edge!.width + 4} opacity={0.35} /> : null;
            })}
            {hoverNode && (
              <rect
                x={hoverNode.x - 3}
                y={hoverNode.y - 3}
                width={hoverNode.w + 6}
                height={hoverNode.h + 6}
                rx={3 / z}
                strokeWidth={1 / z}
                opacity={0.45}
              />
            )}
            {selNodes.map((n) => (
              <rect key={n.id} x={n.x - 3} y={n.y - 3} width={n.w + 6} height={n.h + 6} rx={2 / z} strokeWidth={1.25 / z} />
            ))}
            {selBox && !busy && (
              <rect
                x={selBox.x - 6 / z - 3}
                y={selBox.y - 6 / z - 3}
                width={selBox.w + 12 / z + 6}
                height={selBox.h + 12 / z + 6}
                strokeWidth={1 / z}
                strokeDasharray={`${4 / z} ${3 / z}`}
                opacity={0.55}
              />
            )}
            {ov.guides?.x.map((x) => <line key={'x' + x} x1={x} x2={x} y1={-50000} y2={50000} stroke="#E5484D" strokeWidth={1 / z} />)}
            {ov.guides?.y.map((y) => <line key={'y' + y} y1={y} y2={y} x1={-50000} x2={50000} stroke="#E5484D" strokeWidth={1 / z} />)}
            {ov.marquee && (
              <rect x={ov.marquee.x} y={ov.marquee.y} width={ov.marquee.w} height={ov.marquee.h} fill={ACCENT} fillOpacity={0.08} strokeWidth={1 / z} />
            )}
            {ov.connect && (
              <line x1={ov.connect.from.x} y1={ov.connect.from.y} x2={ov.connect.to.x} y2={ov.connect.to.y} strokeWidth={1.5 / z} strokeDasharray={`${5 / z} ${4 / z}`} />
            )}
          </g>

          {portNodes.map((n) =>
            SIDES.map((side) => {
              const p = portPoint(n, side);
              return (
                <circle
                  key={n.id + side}
                  className="port"
                  data-port={side}
                  data-port-node={n.id}
                  cx={p.x}
                  cy={p.y}
                  r={5 / z}
                  strokeWidth={1.5 / z}
                />
              );
            }),
          )}
          {single &&
            !busy &&
            (['nw', 'ne', 'se', 'sw'] as const).map((h) => {
              const s = 8 / z;
              const hx = h.includes('w') ? single.x - 3 : single.x + single.w + 3;
              const hy = h.includes('n') ? single.y - 3 : single.y + single.h + 3;
              return (
                <rect
                  key={h}
                  className={`handle handle-${h}`}
                  data-handle={h}
                  data-node={single.id}
                  x={hx - s / 2}
                  y={hy - s / 2}
                  width={s}
                  height={s}
                  strokeWidth={1.2 / z}
                />
              );
            })}
          {edgeHandle && singleEdge && (
            <circle
              className="edge-handle"
              data-edge-handle={singleEdge.id}
              cx={edgeHandle.label.x}
              cy={edgeHandle.label.y}
              r={5 / z}
              strokeWidth={1.5 / z}
            >
              <title>{t('Trascina per spostare il tratto centrale')}</title>
            </circle>
          )}
        </g>
      </svg>
      {barBox && <SelectionBar box={barBox} count={selNodes.length} bounds={size} />}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {editing && <LabelEditor key={editing.kind + editing.id} editing={editing} />}
      {!doc.nodes.length && <EmptyState />}
      <PaperBar />
      <CommentsLayer />
      <LiveCursors />
    </div>
  );
}

function LabelEditor({ editing }: { editing: Editing }) {
  const { doc, view } = getState();
  const node = editing.kind === 'node' ? doc.nodes.find((n) => n.id === editing.id) : undefined;
  const edge = editing.kind === 'edge' ? doc.edges.find((e) => e.id === editing.id) : undefined;
  const initial = node?.label ?? edge?.label ?? '';
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  let pos: Pt | null = null;
  let anchor: Anchor = 'middle';
  let fontSize = 14;
  let width = 140;
  if (node) {
    const l = labelLayout(node);
    pos = l;
    anchor = l.anchor;
    fontSize = node.fontSize;
    width = Math.max(140, node.w * view.zoom);
  } else if (edge) {
    const g = edgeGeometry(edge, new Map(doc.nodes.map((n) => [n.id, n])));
    const b = g && edgeLabelBlock(edge, g);
    pos = b;
    if (b) anchor = b.anchor;
    fontSize = edge.fontSize;
  }
  if (!pos) return null;

  // chiude una volta sola: con Invio/Esc subito, altrimenti quando il campo perde il focus
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save && value !== initial) {
      if (node) updateNodes([node.id], { label: value });
      else if (edge) updateEdges([edge.id], { label: value });
    }
    setEditing(null);
  };

  return (
    <textarea
      className="label-editor"
      ref={ref}
      aria-label={t('Etichetta')}
      value={value}
      rows={Math.max(1, value.split('\n').length)}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        // Invio che conferma una parola composta (cinese, giapponese, coreano) non chiude l'etichetta
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        } else if (e.key === 'Escape') {
          finish(false);
        }
      }}
      style={{
        left: view.x + pos.x * view.zoom,
        top: view.y + pos.y * view.zoom,
        width,
        fontSize: Math.max(11, fontSize * view.zoom),
        fontFamily: FONT_CSS[doc.settings.fontFamily],
        textAlign: anchor === 'middle' ? 'center' : anchor === 'start' ? 'left' : 'right',
        transform: anchor === 'middle' ? 'translate(-50%, -50%)' : anchor === 'start' ? 'translate(0, -50%)' : 'translate(-100%, -50%)',
      }}
    />
  );
}

interface MenuState {
  x: number;
  y: number;
  kind: 'node' | 'edge' | 'canvas';
}

type MenuItem = { label: string; keys?: string; action: () => void; danger?: boolean } | 'sep';

function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // ascoltatori stabili: se si registrassero di nuovo a ogni render, un Esc che cambia
  // la selezione li rimuoverebbe a metà evento e il menu resterebbe aperto
  useEffect(() => {
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) closeRef.current();
    };
    // in cattura: Esc chiude prima il menu, senza deselezionare
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeRef.current();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key, true);
    window.addEventListener('wheel', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('wheel', close);
    };
  }, []);

  // il menu resta dentro il foglio anche vicino ai bordi (prima di disegnarlo, senza un salto visibile)
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    setPos({
      x: Math.min(menu.x, parent.clientWidth - el.offsetWidth - 6),
      y: Math.min(menu.y, parent.clientHeight - el.offsetHeight - 6),
    });
  }, [menu]);

  const copySelectionImage = async () => {
    const prev = getUi().selectionOnly;
    setUi({ selectionOnly: true });
    await run('copyPng');
    setUi({ selectionOnly: prev });
  };
  const edges = () => getState().sel.edges;
  const setEdge = (patch: Parameters<typeof updateEdges>[1]) => updateEdges(edges(), patch);

  let items: MenuItem[];
  const editLabel = () => run('editLabel');
  if (menu.kind === 'node') {
    const many = getState().sel.nodes.length > 1;
    items = [
      ...(many ? [] : [{ label: "Modifica l'etichetta", keys: '↩', action: editLabel }, 'sep' as const]),
      { label: 'Duplica', keys: '⌘D', action: () => run('duplicate') },
      { label: 'Raggruppa in un contenitore', keys: '⌘G', action: () => run('groupSelection') },
      'sep',
      { label: 'Copia stile', keys: '⌥⌘C', action: () => run('copyStyle') },
      { label: 'Incolla stile', keys: '⌥⌘V', action: () => run('pasteStyle') },
      'sep',
      { label: 'Porta davanti', keys: '⌘]', action: () => run('bringFront') },
      { label: 'Porta dietro', keys: '⌘[', action: () => run('sendBack') },
      'sep',
      { label: 'Zoom sulla selezione', keys: '⌘2', action: () => run('zoomSelection') },
      { label: 'Copia la selezione come immagine', action: copySelectionImage },
      'sep',
      { label: 'Elimina', keys: '⌫', action: () => run('delete'), danger: true },
    ];
  } else if (menu.kind === 'edge') {
    const e = getState().doc.edges.find((x) => x.id === edges()[0]);
    items = [
      { label: "Modifica l'etichetta", keys: '↩', action: editLabel },
      'sep',
      { label: 'Inverti verso', action: () => e && setEdge({ from: e.to, to: e.from }) },
      { label: 'Percorso ortogonale', action: () => setEdge({ routing: 'ortho' }) },
      { label: 'Percorso dritto', action: () => setEdge({ routing: 'straight' }) },
      { label: 'Percorso curvo', action: () => setEdge({ routing: 'curve' }) },
      { label: e?.dashed ? 'Linea continua' : 'Linea tratteggiata', action: () => setEdge({ dashed: !e?.dashed }) },
      { label: 'Azzera lo scostamento', action: () => setEdge({ offset: 0 }) },
      'sep',
      { label: 'Copia stile', keys: '⌥⌘C', action: () => run('copyStyle') },
      { label: 'Incolla stile', keys: '⌥⌘V', action: () => run('pasteStyle') },
      'sep',
      { label: 'Elimina', keys: '⌫', action: () => run('delete'), danger: true },
    ];
  } else {
    items = [
      { label: 'Seleziona tutto', keys: '⌘A', action: () => selectAll() },
      { label: 'Adatta alla finestra', keys: '⌘0', action: () => run('zoomFit') },
      { label: getState().doc.settings.grid ? 'Nascondi la griglia' : 'Mostra la griglia', action: () => run('toggleGrid') },
      'sep',
      { label: 'Copia la figura come immagine', keys: '⇧⌘C', action: () => run('copyPng') },
      { label: 'Cerca nella libreria', keys: '⌘F', action: () => run('focusSearch') },
      { label: 'Scorciatoie da tastiera', keys: '⌘/', action: () => run('shortcuts') },
    ];
  }

  return (
    <div className="context-menu" ref={ref} style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} className="menu-sep" />
        ) : (
          <button
            key={i}
            className={it.danger ? 'danger' : undefined}
            onClick={() => {
              onClose();
              void it.action();
            }}
          >
            <span>{t(it.label)}</span>
            {it.keys && <kbd>{keys(it.keys)}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
