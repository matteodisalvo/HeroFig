import { t as tr } from '../i18n';
import { memo, useMemo, useState } from 'react';
import { run } from '../App';
import { addLatentBeside, align, distribute, reorder, replaceImage, updateEdges, updateNodes, updateSettings, type AlignMode } from '../actions';
import { latentLook, pickImageFile, readImage } from '../images';
import { docBounds } from '../geometry';
import {
  DEFAULT_SETTINGS,
  PLOT_NAMES,
  SHAPE_NAMES,
  SWATCHES,
  isContainer,
  makeNode,
  type BuiltinShape,
  type Doc,
  type EdgeLabelPos,
  type EdgeModel,
  type FontFamily,
  type LabelPos,
  type NodeModel,
  type Routing,
  type ShapeKind,
  type Side,
} from '../model';
import { MEDICAL_IMAGES } from '../medical';
import { getShape, registeredShapes, type SpecChoice, type SpecGroup } from '../registry';
import { DiagramContent } from '../render/DiagramContent';
import { plainText } from '../richtext';
import { useStore } from '../store';
import { setUi, toast, useUi, type GridStyle, type Theme } from '../ui';
import { Icon, type IconName } from './Icon';
import { Check, ColorField, MIXED, Num, NumInput, Panel, Row, SegRow, Segmented, Select, Toggle, type SegOption } from './controls';
import { RoleSelect, ThemeSelect } from './ThemeControls';
import { keys } from '../os';
import { PaperPanel } from './PaperPage';

const COUNT_LABEL: Partial<Record<ShapeKind, string>> = {
  stack: 'Fogli',
  cells: 'Celle',
  neurons: 'Neuroni',
  barchart: 'Barre',
  unet: 'Livelli',
  cnn: 'Stadi',
  pyramid: 'Livelli',
  rnn: 'Celle',
  bipartite: 'Token',
  tree: 'Profondità',
  kernel: 'Lato kernel',
  diffchain: 'Passi',
  ...Object.fromEntries(MEDICAL_IMAGES.map((k) => [k, 'Variante'])),
};

const DIRECTION_LABEL: Partial<Record<ShapeKind, string>> = {
  trapezoid: 'Lato stretto',
  triangle: 'Punta verso',
  blockarrow: 'Punta verso',
  brace: 'Punta verso',
  bottleneck: 'Orientamento',
};

const GRID_SHAPES: ShapeKind[] = ['grid', 'heatmap', 'patches', 'kernel', 'confmat', 'wsi'];
const RADIUS_SHAPES: ShapeKind[] = [
  'rect',
  'group',
  'cells',
  'grid',
  'image',
  'plot',
  'scatter',
  'bubble',
  'mask',
  'detection',
  'trapezoid',
  'diamond',
  'hexagon',
  'parallelogram',
  'triangle',
  ...MEDICAL_IMAGES,
];

const SIDE_OPTIONS: [Side | 'auto', string][] = [
  ['auto', 'Automatico'],
  ['top', 'Alto'],
  ['right', 'Destra'],
  ['bottom', 'Basso'],
  ['left', 'Sinistra'],
];

const ALIGN: [AlignMode, IconName, string][] = [
  ['left', 'alignLeft', 'Allinea a sinistra'],
  ['hcenter', 'alignHCenter', 'Allinea al centro (orizzontale)'],
  ['right', 'alignRight', 'Allinea a destra'],
  ['top', 'alignTop', 'Allinea in alto'],
  ['vcenter', 'alignVCenter', 'Allinea al centro (verticale)'],
  ['bottom', 'alignBottom', 'Allinea in basso'],
];

/** Colori dei bordi delle coppie pastello: buoni anche per frecce e testo. */
const LINE_COLORS = ['#333333', ...SWATCHES.slice(0, 7).map((s) => s.stroke)] as const;

/** Valore comune a tutti gli elementi, oppure undefined se diverso ("misto"). */
function common<T, K extends keyof T>(items: T[], key: K): T[K] | undefined {
  const v = items[0][key];
  return items.every((x) => x[key] === v) ? v : undefined;
}

const shapeName = (shape: ShapeKind) => tr(SHAPE_NAMES[shape as BuiltinShape] ?? getShape(shape)?.name ?? shape);
const firstLine = (s: string) => plainText(s.split('\n').join(' ')).trim();

// ---------- intestazione: cosa è selezionato ----------

const NodeThumb = memo(function NodeThumb({ node }: { node: NodeModel }) {
  const data = useMemo(() => {
    const n = makeNode({ ...node, id: 'thumb', label: '', sublabel: '', x: 0, y: 0 });
    const d: Doc = { version: 1, nodes: [n], edges: [], settings: DEFAULT_SETTINGS };
    const b = docBounds(d);
    const pad = Math.max(b.w, b.h) * 0.08 + 1;
    return { d, viewBox: `${b.x - pad} ${b.y - pad} ${b.w + 2 * pad} ${b.h + 2 * pad}` };
  }, [node]);
  if (node.shape === 'text') return <Icon name="text" size={18} />;
  return (
    <svg viewBox={data.viewBox} className="thumb-svg">
      <DiagramContent doc={data.d} />
    </svg>
  );
});

function SelectionHeader({ nodes, edges }: { nodes: NodeModel[]; edges: EdgeModel[] }) {
  const doc = useStore((s) => s.doc);
  let thumb: React.ReactNode;
  let title: string;
  let sub: string;
  if (nodes.length === 1 && !edges.length) {
    const n = nodes[0];
    thumb = <NodeThumb node={n} />;
    title = firstLine(n.label) || shapeName(n.shape);
    sub = shapeName(n.shape) + (isContainer(n) && n.shape !== 'group' ? ` · ${tr('contenitore')}` : '');
  } else if (edges.length === 1 && !nodes.length) {
    const e = edges[0];
    const name = (id: string) => {
      const n = doc.nodes.find((x) => x.id === id);
      return n ? firstLine(n.label) || shapeName(n.shape) : '?';
    };
    thumb = <Icon name="edge" size={18} />;
    title = firstLine(e.label) || tr('Connessione');
    sub = `${name(e.from.node)} → ${name(e.to.node)}`;
  } else {
    thumb = <Icon name="blocks" size={18} />;
    const parts = [];
    if (nodes.length) parts.push(tr(nodes.length === 1 ? '{count} blocco' : '{count} blocchi', { count: nodes.length }));
    if (edges.length) parts.push(tr(edges.length === 1 ? '{count} connessione' : '{count} connessioni', { count: edges.length }));
    title = parts.join(tr(' e '));
    sub = tr('Si modificano tutti insieme');
  }
  return (
    <div className="sel-header">
      <div className="sel-thumb">{thumb}</div>
      <div className="sel-text">
        <strong title={title}>{title}</strong>
        <span title={sub}>{sub}</span>
      </div>
      <div className="sel-actions">
        {nodes.length > 0 && (
          <button className="tool icon-only small" data-tip={tr("Duplica")} data-keys="⌘D" aria-label={tr("Duplica")} onClick={() => run('duplicate')}>
            <Icon name="duplicate" size={14} />
          </button>
        )}
        <button className="tool icon-only small danger" data-tip={tr("Elimina")} data-keys="⌫" aria-label={tr("Elimina")} onClick={() => run('delete')}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------- blocchi ----------

const LABEL_POS: SegOption<LabelPos>[] = [
  { value: 'center', label: 'Dentro', tip: 'Etichetta dentro il blocco' },
  { value: 'above', label: 'Sopra', tip: 'Etichetta sopra il blocco' },
  { value: 'below', label: 'Sotto', tip: 'Etichetta sotto il blocco' },
];

const TEXT_ALIGN: SegOption<NodeModel['align']>[] = [
  { value: 'left', icon: 'textLeft', tip: 'A sinistra' },
  { value: 'center', icon: 'textCenter', tip: 'Centrato' },
  { value: 'right', icon: 'textRight', tip: 'A destra' },
];

function NodePanel({ nodes }: { nodes: NodeModel[] }) {
  const ids = nodes.map((x) => x.id);
  const set = (patch: Partial<NodeModel>, key?: string) => updateNodes(ids, patch, key && `${key}:${ids.join()}`);
  const v = <K extends keyof NodeModel>(k: K) => common(nodes, k);
  const multi = nodes.length > 1;
  const shape = v('shape');
  const n = nodes[0];
  const def = shape ? getShape(shape) : undefined;
  const hasShape = shape !== 'text';
  const countLabel = shape && (COUNT_LABEL[shape] ?? def?.countLabel);
  const directionLabel = shape && (DIRECTION_LABEL[shape] ?? def?.directionLabel);
  const label = v('label');
  const sublabel = v('sublabel');
  const fill = v('fill');
  const stroke = v('stroke');
  const swatchOn = (s: (typeof SWATCHES)[number]) => fill === s.fill && stroke === s.stroke;

  return (
    <>
      <Panel id="node-content" title={tr("Contenuto")}>
        <textarea
          className="label-input"
          value={label ?? ''}
          rows={2}
          placeholder={tr(label === undefined ? 'Etichette diverse: scrivi per sostituirle tutte' : 'Etichetta')}
          onChange={(e) => set({ label: e.target.value }, 'label')}
        />
        <textarea
          className="label-input"
          value={sublabel ?? ''}
          rows={1}
          placeholder={tr(sublabel === undefined ? MIXED : 'Sottotitolo (opzionale)')}
          onChange={(e) => set({ sublabel: e.target.value }, 'sublabel')}
        />
        <p className="hint" data-tip={tr("Esempi: $x_i$  ·  $\\mathcal{E}$  ·  $H \\times W$  ·  $\\mathcal{L}_{\\mathrm{MAE}}$")}>
          <Icon name="info" size={12} /> {tr("Formule LaTeX fra dollari:")} <code>$x_i$</code>
        </p>
        <Select
          label={tr("Forma")}
          value={shape}
          options={[
            ...(Object.entries(SHAPE_NAMES) as [ShapeKind, string][]),
            ...registeredShapes().map((d): [ShapeKind, string] => [d.kind, d.name]),
          ]}
          onChange={(shape) => set({ shape })}
        />
        {def?.specLabel && (
          <Row label={def.specLabel}>
            <input
              type="text"
              value={v('spec') ?? ''}
              placeholder={v('spec') === undefined ? tr(MIXED) : undefined}
              onChange={(e) => set({ spec: e.target.value }, 'spec')}
            />
          </Row>
        )}
        {def?.specOptions && <SpecChips groups={def.specOptions} spec={v('spec')} onChange={(spec) => set({ spec })} />}
        {nodes.length === 1 && nodes[0].shape === 'photo' && <PhotoControls node={nodes[0]} />}
        {countLabel && (
          <Num label={countLabel} value={v('count')} min={1} max={def ? (def.countMax ?? 32) : 12} onChange={(count) => set({ count }, 'count')} />
        )}
        {shape && GRID_SHAPES.includes(shape) && (
          <Row label={tr("Righe × colonne")}>
            <input
              type="text"
              value={v('spec') ?? ''}
              placeholder={v('spec') === undefined ? tr(MIXED) : '4x4'}
              onChange={(e) => set({ spec: e.target.value }, 'spec')}
            />
          </Row>
        )}
        {shape === 'mlp' && (
          <Row label={tr("Neuroni per strato")}>
            <input type="text" value={v('spec') ?? ''} placeholder="3,5,5,2" onChange={(e) => set({ spec: e.target.value }, 'spec')} />
          </Row>
        )}
        {shape && (MEDICAL_IMAGES as readonly string[]).includes(shape) && !multi && (
          <div className="checks">
            <Check
              label={tr("Bounding box")}
              checked={/\bbox\b/.test(n.spec)}
              onChange={(on) => set({ spec: on ? `${n.spec} box`.trim() : n.spec.replace(/\s*\bbox\b/, '').trim() })}
            />
            {(shape === 'ct' || shape === 'mri') && (
              <Check
                label={tr("Segmentazione")}
                checked={/\bseg\b/.test(n.spec)}
                onChange={(on) => set({ spec: on ? `${n.spec} seg`.trim() : n.spec.replace(/\s*\bseg\b/, '').trim() })}
              />
            )}
          </div>
        )}
        {shape === 'plot' && (
          <Select
            label={tr("Funzione")}
            value={v('spec') === undefined ? undefined : PLOT_NAMES[n.spec] ? n.spec : 'relu'}
            options={Object.entries(PLOT_NAMES)}
            onChange={(spec) => set({ spec })}
          />
        )}
        {shape === 'cuboid' && (
          <Num label={tr("Profondità")} value={v('depth')} min={0.05} max={0.9} step={0.05} onChange={(depth) => set({ depth }, 'depth')} />
        )}
        {directionLabel && (
          <Select
            label={directionLabel}
            value={v('direction')}
            options={SIDE_OPTIONS.slice(1) as [Side, string][]}
            onChange={(direction) => set({ direction })}
          />
        )}
        {shape !== 'group' && shape !== 'text' && (
          <Check
            label={tr("Contenitore")}
            tip={tr("Il blocco racchiude altri blocchi: sta sullo sfondo e li trascina con sé")}
            checked={v('container')}
            onChange={(container) => set({ container })}
          />
        )}
      </Panel>

      {nodes.length === 1 && nodes[0].shape === 'photo' && nodes[0].src && <LatentPanel node={nodes[0]} />}

      {hasShape && (
        <Panel id="node-style" title={tr("Aspetto")}>
          <RoleSelect nodes={nodes} />
          <div className="swatches" role="group" aria-label={tr("Coppie di colori")}>
            {SWATCHES.map((s) => (
              <button
                key={s.name}
                data-tip={tr(s.name)}
                aria-label={tr(s.name)}
                className={swatchOn(s) ? 'on' : ''}
                style={{ background: s.fill, borderColor: s.stroke }}
                onClick={() => set({ fill: s.fill, stroke: s.stroke })}
              />
            ))}
          </div>
          <ColorField label={tr("Riempimento")} value={fill} allowNone onChange={(fill) => set({ fill }, 'fill')} />
          <ColorField label={tr("Bordo")} value={stroke} allowNone onChange={(stroke) => set({ stroke }, 'stroke')} />
          <div className="row">
            <span className="row-label">{tr("Spessore")}</span>
            <span className="row-control inline-controls">
              <NumInput label="Spessore" value={v('strokeWidth')} min={0.25} max={8} step={0.25} onChange={(strokeWidth) => set({ strokeWidth }, 'sw')} />
              <Toggle on={v('dashed')} onChange={(dashed) => set({ dashed })} icon="dashed" tip={tr("Bordo tratteggiato")} />
            </span>
          </div>
          {shape && RADIUS_SHAPES.includes(shape) && (
            <Num label={tr("Raggio angoli")} value={v('radius')} min={0} max={60} unit="px" onChange={(radius) => set({ radius }, 'radius')} />
          )}
        </Panel>
      )}

      <Panel id="node-text" title={tr("Testo")}>
        <div className="row">
          <span className="row-label">{tr("Dimensione")}</span>
          <span className="row-control inline-controls">
            <NumInput label="Dimensione" value={v('fontSize')} min={6} max={72} onChange={(fontSize) => set({ fontSize }, 'fs')} />
            <Toggle on={v('bold')} onChange={(bold) => set({ bold })} label={<b>{tr("G")}</b>} tip={tr("Grassetto")} />
            <Toggle on={v('italic')} onChange={(italic) => set({ italic })} label={<i>{tr("C")}</i>} tip={tr("Corsivo")} />
          </span>
        </div>
        {(sublabel === undefined || !!sublabel) && (
          <Num label={tr("Sottotitolo")} value={v('subSize')} min={6} max={48} onChange={(subSize) => set({ subSize }, 'ss')} />
        )}
        <ColorField
          label={tr("Colore")}
          value={v('textColor')}
          onChange={(textColor) => set({ textColor }, 'tc')}
          quick={['#1A1A1A', '#FFFFFF', ...LINE_COLORS.slice(1)]}
        />
        {shape !== 'group' && shape !== 'text' && !v('container') && (
          <SegRow<LabelPos> label={tr("Posizione")} value={v('labelPos')} options={LABEL_POS} onChange={(labelPos) => set({ labelPos })} />
        )}
        {v('labelPos') === 'center' && shape !== 'group' && (
          <SegRow<NodeModel['align']> label={tr("Allineamento")} value={v('align')} options={TEXT_ALIGN} onChange={(align) => set({ align })} />
        )}
      </Panel>

      {!multi && (
        <Panel id="node-geom" title={tr("Posizione e dimensioni")}>
          <div className="grid2">
            <Num label={tr("X")} value={n.x} unit="px" onChange={(x) => set({ x }, 'x')} />
            <Num label={tr("Y")} value={n.y} unit="px" onChange={(y) => set({ y }, 'y')} />
            <Num label={tr("L")} tip={tr("Larghezza")} value={n.w} min={10} unit="px" onChange={(w) => set({ w }, 'w')} />
            <Num label={tr("A")} tip={tr("Altezza")} value={n.h} min={10} unit="px" onChange={(h) => set({ h }, 'h')} />
          </div>
        </Panel>
      )}

      <Panel id="node-arrange" title={tr("Disponi")}>
        {multi && (
          <>
            <div className="icon-row" role="group" aria-label={tr("Allinea")}>
              {ALIGN.map(([mode, icon, tip]) => (
                <button key={mode} className="tool icon-only" data-tip={tr(tip)} aria-label={tr(tip)} onClick={() => align(mode)}>
                  <Icon name={icon} />
                </button>
              ))}
              <span className="icon-sep" />
              <button
                className="tool icon-only"
                data-tip={tr(nodes.length > 2 ? 'Distribuisci in orizzontale' : 'Distribuisci: servono almeno 3 blocchi')}
                aria-label={tr("Distribuisci in orizzontale")}
                disabled={nodes.length < 3}
                onClick={() => distribute('x')}
              >
                <Icon name="distH" />
              </button>
              <button
                className="tool icon-only"
                data-tip={tr(nodes.length > 2 ? 'Distribuisci in verticale' : 'Distribuisci: servono almeno 3 blocchi')}
                aria-label={tr("Distribuisci in verticale")}
                disabled={nodes.length < 3}
                onClick={() => distribute('y')}
              >
                <Icon name="distV" />
              </button>
            </div>
          </>
        )}
        <div className="buttons two">
          <button className="btn" onClick={() => reorder('front')} data-tip={tr("Porta davanti")} data-keys="⌘]">
            <Icon name="front" size={14} /> {tr("Davanti")}
          </button>
          <button className="btn" onClick={() => reorder('back')} data-tip={tr("Porta dietro")} data-keys="⌘[">
            <Icon name="back" size={14} /> {tr("Dietro")}
          </button>
        </div>
        {multi && (
          <button className="btn full" onClick={() => run('groupSelection')} data-keys="⌘G" data-tip={tr("Racchiudi in un gruppo tratteggiato con titolo")}>
            <Icon name="group" size={14} /> {tr("Raggruppa in un contenitore")}
          </button>
        )}
      </Panel>
    </>
  );
}

// ---------- connessioni ----------

const ROUTING: SegOption<Routing>[] = [
  { value: 'ortho', icon: 'ortho', label: 'Ortogonale', tip: 'Percorso a gomito' },
  { value: 'straight', icon: 'straight', label: 'Dritto', tip: 'Percorso dritto' },
  { value: 'curve', icon: 'curve', label: 'Curvo', tip: 'Percorso curvo' },
];

const EDGE_LABEL_POS: SegOption<EdgeLabelPos>[] = [
  { value: 'center', label: 'Sulla linea' },
  { value: 'above', label: 'Sopra', tip: 'Sopra o a sinistra della linea' },
  { value: 'below', label: 'Sotto', tip: 'Sotto o a destra della linea' },
];

function EdgePanel({ edges }: { edges: EdgeModel[] }) {
  const e = edges[0];
  const ids = edges.map((x) => x.id);
  const set = (patch: Partial<EdgeModel>, key?: string) => updateEdges(ids, patch, key && `${key}:${ids.join()}`);
  const v = <K extends keyof EdgeModel>(k: K) => common(edges, k);
  const single = edges.length === 1;
  const label = v('label');
  return (
    <>
      <Panel id="edge-label" title={single ? 'Etichetta della connessione' : 'Etichette delle connessioni'}>
        <textarea
          className="label-input"
          value={label ?? ''}
          rows={1}
          placeholder={tr(label === undefined ? 'Etichette diverse: scrivi per sostituirle tutte' : 'Etichetta (es. skip, $z$)')}
          onChange={(ev) => set({ label: ev.target.value }, 'label')}
        />
        <SegRow<EdgeLabelPos> label={tr("Posizione")} value={v('labelPos')} options={EDGE_LABEL_POS} onChange={(labelPos) => set({ labelPos })} />
        <Num label={tr("Dimensione")} value={v('fontSize')} min={6} max={48} onChange={(fontSize) => set({ fontSize }, 'fs')} />
      </Panel>

      <Panel id="edge-route" title={tr("Percorso")}>
        <Segmented<Routing> value={v('routing')} options={ROUTING} onChange={(routing) => set({ routing })} label={tr("Percorso")} />
        {single && (
          <>
            <Select label={tr("Esce da")} value={e.from.side} options={SIDE_OPTIONS} onChange={(side) => set({ from: { ...e.from, side } })} />
            <Select label={tr("Entra da")} value={e.to.side} options={SIDE_OPTIONS} onChange={(side) => set({ to: { ...e.to, side } })} />
          </>
        )}
        {v('routing') === 'ortho' && (
          <div className="row">
            <span className="row-label" data-tip={tr("Sposta il tratto centrale (trascina anche il pallino sulla freccia)")}>
              {tr("Scostamento")}
            </span>
            <span className="row-control inline-controls">
              <NumInput label="Scostamento" value={v('offset')} step={5} unit="px" onChange={(offset) => set({ offset }, 'offset')} />
              <button
                className="toggle"
                data-tip={tr("Azzera lo scostamento")}
                aria-label={tr("Azzera lo scostamento")}
                onClick={() => set({ offset: 0 })}
                disabled={v('offset') === 0}
              >
                <Icon name="reset" size={14} />
              </button>
            </span>
          </div>
        )}
        {single && (
          <button className="btn full" onClick={() => set({ from: e.to, to: e.from })}>
            <Icon name="swap" size={14} /> {tr("Inverti verso")}
          </button>
        )}
      </Panel>

      <Panel id="edge-style" title={tr("Stile della linea")}>
        <ColorField label={tr("Colore")} value={v('color')} onChange={(color) => set({ color }, 'color')} quick={LINE_COLORS} />
        <Num label={tr("Spessore")} value={v('width')} min={0.25} max={8} step={0.25} onChange={(width) => set({ width }, 'width')} />
        <div className="row">
          <span className="row-label">{tr("Linea")}</span>
          <span className="row-control toggles">
            <Toggle on={v('arrowStart')} onChange={(arrowStart) => set({ arrowStart })} icon="arrowStart" tip={tr("Punta all'inizio")} />
            <Toggle on={v('dashed')} onChange={(dashed) => set({ dashed })} icon="dashed" tip={tr("Tratteggiata")} />
            <Toggle on={v('arrowEnd')} onChange={(arrowEnd) => set({ arrowEnd })} icon="arrowEnd" tip={tr("Punta alla fine")} />
          </span>
        </div>
      </Panel>
    </>
  );
}

// ---------- documento ----------

const THEMES: SegOption<Theme>[] = [
  { value: 'system', icon: 'monitor', label: 'Sistema', tip: 'Segue il tema del sistema' },
  { value: 'light', icon: 'sun', label: 'Chiaro' },
  { value: 'dark', icon: 'moon', label: 'Scuro' },
];

function FigureSize() {
  const doc = useStore((s) => s.doc);
  const scale = useUi((s) => s.pngScale);
  const size = useMemo(() => {
    if (!doc.nodes.length) return null;
    const b = docBounds(doc);
    return { w: Math.ceil(b.w + 16), h: Math.ceil(b.h + 16) };
  }, [doc]);
  if (!size) return <p className="hint">{tr("La figura è vuota.")}</p>;
  return (
    <div className="figure-size" data-tip={tr("Dimensioni dell'area esportata (margine compreso)")}>
      <div>
        <strong>
          {size.w} × {size.h}
        </strong>{' '}
        px
      </div>
      <span>
        PNG {scale}×: {size.w * scale} × {size.h * scale} px
      </span>
    </div>
  );
}

function FigurePanel() {
  const settings = useStore((s) => s.doc.settings);
  return (
    <Panel id="doc-figure" title={tr("Figura")}>
      <Select<FontFamily>
        label={tr("Carattere")}
        value={settings.fontFamily}
        options={[
          ['sans', 'Sans (Helvetica)'],
          ['serif', 'Serif (Times)'],
          ['mono', 'Monospace'],
        ]}
        onChange={(fontFamily) => updateSettings({ fontFamily })}
      />
      <ThemeSelect />
      <SegRow<'transparent' | 'white'>
        label={tr("Sfondo")}
        value={settings.background}
        options={[
          { value: 'transparent', label: 'Trasparente' },
          { value: 'white', label: 'Bianco' },
        ]}
        onChange={(background) => updateSettings({ background })}
      />
      <Row label={tr("Dimensioni")}>
        <FigureSize />
      </Row>
    </Panel>
  );
}

const GRID_STYLES: { value: GridStyle; label: string }[] = [
  { value: 'lines', label: 'Quadretti' },
  { value: 'cross', label: 'Crocette' },
  { value: 'dots', label: 'Puntini' },
];

function DocPanel() {
  const settings = useStore((s) => s.doc.settings);
  const theme = useUi((s) => s.theme);
  const gridStyle = useUi((s) => s.gridStyle);
  return (
    <>
      <FigurePanel />
      <Panel id="doc-sheet" title={tr("Foglio")}>
        <div className="checks column">
          <Check label={tr("Mostra griglia")} checked={settings.grid} onChange={(grid) => updateSettings({ grid })} />
          {settings.grid && <Segmented<GridStyle> value={gridStyle} options={GRID_STYLES} onChange={(g) => setUi({ gridStyle: g })} label={tr("Aspetto della griglia")} />}
          <Check
            label={tr("Aggancia a griglia e blocchi")}
            tip={tr("Tieni premuto ⌥ durante il trascinamento per disattivarlo")}
            checked={settings.snap}
            onChange={(snap) => updateSettings({ snap })}
          />
        </div>
      </Panel>
      <Panel id="doc-ui" title={tr("Interfaccia")}>
        <Segmented<Theme> value={theme} options={THEMES} onChange={(theme) => setUi({ theme })} label={tr("Tema")} />
        <p className="hint">{tr("Il foglio resta bianco: le figure sono pensate per la stampa.")}</p>
      </Panel>
      <Panel id="doc-help" title={tr("Come si usa")}>
        <ul className="help">
          <li>
            <b>{tr("Inserisci")}</b> {tr("trascinando dalla libreria, o con un clic (al centro della vista).")}
          </li>
          <li>
            <b>{tr("Collega")}</b>{tr(": passa sopra un blocco e trascina da un pallino blu verso un altro.")}
          </li>
          <li>
            <b>{tr("Scrivi")}</b>{tr(": doppio clic su blocco o freccia, oppure")} <kbd>{keys('↩')}</kbd> {tr("sulla selezione.")}
          </li>
          <li>
            <b>{tr("Naviga")}</b>{tr(": rotella per scorrere,")} <kbd>{keys('⌘')}</kbd>{tr("+rotella per lo zoom,")} <kbd>{tr("Spazio")}</kbd>{tr("+trascina per spostare la vista.")}
          </li>
          <li>
            <b>{tr("Allinea")}</b>{tr(": seleziona più blocchi, compare una barra con allinea e distribuisci.")}
          </li>
        </ul>
        <button className="btn full" onClick={() => run('shortcuts')} data-keys="⌘/" data-tip={tr("Elenco completo")}>
          <Icon name="help" size={14} /> {tr("Tutte le scorciatoie")}
        </button>
      </Panel>
    </>
  );
}

export function Inspector() {
  const doc = useStore((s) => s.doc);
  const sel = useStore((s) => s.sel);
  const nodes = doc.nodes.filter((n) => sel.nodes.includes(n.id));
  const edges = doc.edges.filter((e) => sel.edges.includes(e.id));
  const empty = !nodes.length && !edges.length;
  const hidden = useUi((s) => s.hideInspector);
  const pagina = useUi((s) => s.canvasView) === 'pagina';
  return (
    <aside className={hidden ? 'inspector hidden' : 'inspector'} aria-label={tr("Proprietà")}>
      {empty ? (
        <div className="sel-header">
          <div className="sel-thumb">
            <Icon name="doc" size={18} />
          </div>
          <div className="sel-text">
            <strong>{tr(pagina ? 'Pagina' : 'Documento')}</strong>
            <span>{tr(pagina ? 'Come uscirà la figura nel paper' : 'Impostazioni della figura')}</span>
          </div>
        </div>
      ) : (
        <SelectionHeader nodes={nodes} edges={edges} />
      )}
      <div className="inspector-body">
        {nodes.length > 0 && <NodePanel nodes={nodes} />}
        {edges.length > 0 && <EdgePanel edges={edges} />}
        {empty &&
          (pagina ? (
            <>
              <PaperPanel />
              <FigurePanel />
            </>
          ) : (
            <DocPanel />
          ))}
      </div>
    </aside>
  );
}

/** Pulsanti per le varianti di una forma dei moduli di dominio (vedi SpecGroup in registry.ts). */
function SpecChips({ groups, spec, onChange }: { groups: SpecGroup[]; spec: string | undefined; onChange: (spec: string) => void }) {
  const tokens = (spec ?? '').split(/\s+/).filter(Boolean);
  const norm = (c: string | SpecChoice): SpecChoice => (typeof c === 'string' ? { value: c } : c);
  // valori "liberi" come 5x4 o 70,15,15: si riconoscono anche quelli scritti a mano dalla forma
  const kind = (t: string) => t.replace(/\d+(\.\d+)?/g, '#');
  const click = (g: SpecGroup, value: string) => {
    const mode = g.mode ?? 'one';
    const values = g.choices.map((c) => norm(c).value);
    // un valore con spazi (es. una frase di token) occupa tutto il campo
    if (mode === 'value' && values.some((v) => /\s/.test(v))) return onChange(spec === value ? '' : value);
    const on = tokens.includes(value);
    const kinds = new Set(values.map(kind));
    let next =
      mode === 'one'
        ? tokens.filter((t) => !values.includes(t))
        : mode === 'value'
          ? tokens.filter((t) => !values.includes(t) && !kinds.has(kind(t)))
          : tokens.filter((t) => t !== value);
    if (!on) next = [...next, value];
    onChange(next.join(' '));
  };
  return (
    <div className="spec-chips">
      {groups.map((g, i) => (
        <div key={i} className="spec-group">
          {g.title && <span className="spec-title">{tr(g.title)}</span>}
          <div className="spec-row">
            {g.choices.map((c) => {
              const { value, label } = norm(c);
              const active = (g.mode ?? 'one') === 'value' && /\s/.test(value) ? spec === value : tokens.includes(value);
              return (
                <button key={value} type="button" className={active ? 'chip on' : 'chip'} onClick={() => click(g, value)} title={value}>
                  {label ? tr(label) : value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Immagine importata: sceglierne un'altra o riportare il blocco alle sue proporzioni. */
function PhotoControls({ node }: { node: NodeModel }) {
  const replace = async () => {
    try {
      const file = await pickImageFile();
      if (file) replaceImage(node.id, await readImage(file));
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'info');
    }
  };
  return (
    <div className="photo-controls">
      <button type="button" onClick={replace}>
        {tr(node.src ? 'Sostituisci immagine…' : 'Scegli immagine…')}
      </button>
      {node.src && node.srcRatio > 0 && (
        <button
          type="button"
          onClick={() => updateNodes([node.id], { h: Math.round(node.w / node.srcRatio) })}
          title={tr("Altezza in base alla larghezza, senza ritagli")}
        >
          {tr("Proporzioni originali")}
        </button>
      )}
    </div>
  );
}

const LATENT_SIZES = [
  { value: '16', label: '16 × 16' },
  { value: '32', label: '32 × 32' },
  { value: '64', label: '64 × 64' },
];

// parole che dicono che la figura parla di modelli generativi (diffusione, VAE, GAN…)
// (anche i simboli tipici: x_t, x_0, z_t, ε; e la colorazione virtuale, che è generazione da immagine a immagine)
const GENERATIVE =
  /diffusion|diffusione|denois|noise|rumore|latent|\bvae\b|autoencoder|\bgan\b|generat|ddpm|ddim|sampler|flow matching|score model|u-?net|\\epsilon|[xz]_\{?(t|T|0)\b|\\hat\{[xz]\}|stain|synthes|sintesi|(image|text)[- ]to[- ]image/i;

/** La figura è di IA generativa? Lo dicono i ruoli e le scritte di blocchi, frecce e didascalia. */
function isGenerative(doc: Doc): boolean {
  return (
    doc.nodes.some((n) => n.role === 'latent' || GENERATIVE.test(plainText(`${n.label} ${n.sublabel}`))) ||
    doc.edges.some((e) => GENERATIVE.test(plainText(e.label))) ||
    GENERATIVE.test(doc.settings.caption)
  );
}

/**
 * Sezione «Latente» di un'immagine: ne crea accanto la versione a griglia di pixel a falsi colori.
 * Compare solo per le immagini generate, e solo se la figura parla di modelli generativi.
 */
function LatentPanel({ node }: { node: NodeModel }) {
  const doc = useStore((s) => s.doc);
  const [cells, setCells] = useState('32');
  if (!node.ai || !isGenerative(doc)) return null;
  return (
    <Panel id="node-latent" title={tr("Latente")}>
      <p className="hint">{tr("Crea accanto a questa immagine la sua versione «latente», a quadretti colorati. L'immagine resta com'è.")}</p>
      <Segmented value={cells} options={LATENT_SIZES} onChange={setCells} label={tr("Quadretti del latente")} />
      <button
        type="button"
        className="btn full"
        onClick={() =>
          latentLook(node.src, Number(cells))
            .then((img) => addLatentBeside(node.id, img))
            .catch((err) => toast(err instanceof Error ? err.message : String(err), 'info'))
        }
      >
        {tr("Crea il latente")}
      </button>
    </Panel>
  );
}
