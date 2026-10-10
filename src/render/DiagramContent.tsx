import {
  arrowLen,
  arrowPoints,
  cmdsToD,
  edgeGeometry,
  edgeLabelBlock,
  edgePathD,
  labelBlocks,
  labelFrame,
  rotationOf,
  shapeParts,
  textBlockRect,
  type Anchor,
  type ClipRect,
  type EdgeGeom,
  type Part,
} from '../geometry';
import { FONT_CSS, isContainer, type Doc, type FontFamily, type EdgeModel, type NodeModel } from '../model';
import { MATH_FONT, layoutLine, lineHeight, needsLayout } from '../mathlayout';
import { parseLine } from '../richtext';
import { createContext, useContext, useId } from 'react';

const DASH = '6 4';

/** Famiglia di caratteri della figura, per misurare le formule impaginate. */
const FamilyContext = createContext<FontFamily>('sans');

interface LabelProps {
  text: string;
  x: number;
  y: number;
  anchor: Anchor;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  color: string;
  halo?: boolean;
}

function Label({ text, x, y, anchor, fontSize, bold, italic, color, halo }: LabelProps) {
  const family = useContext(FamilyContext);
  const lines = text.split('\n');
  const heights = lines.map((l) => lineHeight(l, fontSize));
  const top = y - heights.reduce((a, b) => a + b, 0) / 2;
  const centers = heights.map((h, i) => top + heights.slice(0, i).reduce((a, b) => a + b, 0) + h / 2);
  const haloProps = halo ? { stroke: '#FFFFFF', strokeWidth: 4, paintOrder: 'stroke', strokeLinejoin: 'round' as const } : {};
  return (
    <g
      fontSize={fontSize}
      fontWeight={bold ? 700 : 400}
      fontStyle={italic ? 'italic' : undefined}
      fill={color}
      textAnchor={anchor}
      {...haloProps}
    >
      {lines.map((line, i) => {
        if (needsLayout(line)) {
          // formula a due piani: pezzi posizionati uno per uno, più le linee di frazione
          const b = layoutLine(line, fontSize, family, bold, italic);
          const baseline = centers[i] + (b.ascent - b.descent) / 2;
          const x0 = anchor === 'middle' ? x - b.width / 2 : anchor === 'start' ? x : x - b.width;
          return (
            <g key={i} textAnchor="start">
              {b.pieces.map((p, j) => (
                <text
                  key={j}
                  x={x0 + p.x}
                  y={baseline + p.dy}
                  fontSize={p.size}
                  fontStyle={p.italic ? 'italic' : 'normal'}
                  fontWeight={p.bold ? 700 : 400}
                  fontFamily={p.math ? MATH_FONT : undefined}
                  xmlSpace="preserve"
                >
                  {p.text}
                </text>
              ))}
              {b.rules.map((r, j) => (
                <line key={'r' + j} x1={x0 + r.x1} x2={x0 + r.x2} y1={baseline + r.dy} y2={baseline + r.dy} stroke={color} strokeWidth={r.width} />
              ))}
            </g>
          );
        }
        // baseline calcolata a mano: dominant-baseline non è supportato ovunque
        const baseline = centers[i] + fontSize * 0.35;
        let cur = 0;
        return (
          <text key={i} x={x} y={baseline} xmlSpace="preserve">
            {parseLine(line).map((r, j) => {
              const target = r.script === 'sub' ? 0.3 * fontSize : r.script === 'sup' ? -0.4 * fontSize : 0;
              const dy = target - cur;
              cur = target;
              return (
                <tspan
                  key={j}
                  dy={dy || undefined}
                  fontSize={r.script ? fontSize * 0.72 : r.math ? fontSize * 1.08 : undefined}
                  fontStyle={r.italic ? 'italic' : r.math ? 'normal' : undefined}
                  fontWeight={r.bold ? 700 : undefined}
                  fontFamily={r.math ? MATH_FONT : undefined}
                >
                  {r.text}
                </tspan>
              );
            })}
          </text>
        );
      })}
    </g>
  );
}

function PartView({ part, n }: { part: Part; n: NodeModel }) {
  const stroke = part.stroke ?? n.stroke;
  const common = {
    stroke,
    strokeWidth: stroke === 'none' ? undefined : (part.sw ?? n.strokeWidth),
    strokeDasharray: n.dashed && !part.solid ? DASH : undefined,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    fill: part.fill,
  };
  switch (part.kind) {
    case 'rect':
      return <rect x={part.x} y={part.y} width={part.w} height={part.h} rx={part.r || undefined} {...common} />;
    case 'ellipse':
      return <ellipse cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} {...common} />;
    case 'path':
      return <path d={cmdsToD(part.cmds)} {...common} />;
    case 'text':
      return (
        <Label text={part.text} x={part.x} y={part.y} anchor={part.anchor ?? 'middle'} fontSize={part.size} bold={part.bold} italic={part.italic} color={part.fill} />
      );
    case 'image':
      return <image href={part.href} x={part.x} y={part.y} width={part.w} height={part.h} preserveAspectRatio={part.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'} />;
  }
}

/** Raggruppa le primitive consecutive con lo stesso ritaglio. */
function clipRuns(parts: Part[]): { clip?: ClipRect; parts: Part[] }[] {
  const runs: { clip?: ClipRect; parts: Part[] }[] = [];
  for (const p of parts) {
    const last = runs[runs.length - 1];
    if (last && last.clip === p.clip) last.parts.push(p);
    else runs.push({ clip: p.clip, parts: [p] });
  }
  return runs;
}

function NodeView({ n, interactive, ids }: { n: NodeModel; interactive: boolean; ids: string }) {
  const parts = shapeParts(n);
  // ruotato: la forma gira attorno al suo centro; le scritte restano dritte (labelFrame)
  const rotation = rotationOf(n);
  return (
    <g data-node-id={interactive ? n.id : undefined}>
      <g transform={rotation ? `rotate(${rotation} ${n.x + n.w / 2} ${n.y + n.h / 2})` : undefined}>
        {clipRuns(parts).map((run, i) => {
          const items = run.parts.map((p, j) => <PartView key={j} part={p} n={n} />);
          if (!run.clip) return <g key={i}>{items}</g>;
          const id = `${ids}clip-${n.id}-${i}`;
          const c = run.clip;
          return (
            <g key={i}>
              <clipPath id={id}>
                <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={c.r || undefined} />
              </clipPath>
              <g clipPath={`url(#${id})`}>{items}</g>
            </g>
          );
        })}
        {/* area di presa: i gruppi si afferrano solo dal bordo, per non coprire il contenuto */}
        {interactive &&
          (isContainer(n) ? (
            parts.map((p, i) => <PartView key={'hit' + i} part={{ ...p, fill: 'none', stroke: 'transparent', sw: 12, solid: true }} n={n} />)
          ) : (
            <rect x={n.x} y={n.y} width={n.w} height={n.h} fill="transparent" />
          ))}
      </g>
      {labelBlocks(labelFrame(n)).map((b, i) => (
        <Label key={i} {...b} />
      ))}
    </g>
  );
}

function EdgeLine({ e, g, interactive }: { e: EdgeModel; g: EdgeGeom; interactive: boolean }) {
  const len = arrowLen(e.width);
  const d = edgePathD(g, e.arrowStart ? len * 0.7 : 0, e.arrowEnd ? len * 0.7 : 0);
  const n = g.pts.length;
  return (
    <g data-edge-id={interactive ? e.id : undefined}>
      {interactive && <path d={d} fill="none" stroke="transparent" strokeWidth={14} />}
      <path
        d={d}
        fill="none"
        stroke={e.color}
        strokeWidth={e.width}
        strokeDasharray={e.dashed ? DASH : undefined}
        strokeLinejoin="round"
      />
      {e.arrowEnd && <polygon points={arrowPoints(g.pts[n - 1], g.endDir, len)} fill={e.color} />}
      {e.arrowStart && <polygon points={arrowPoints(g.pts[0], g.startDir, len)} fill={e.color} />}
    </g>
  );
}

/** Etichetta di una freccia: sulla linea ha un riquadro bianco pieno, così la linea non passa fra le parole. */
function EdgeLabel({ block, family }: { block: ReturnType<typeof edgeLabelBlock>; family: Doc['settings']['fontFamily'] }) {
  if (!block.halo) return <Label {...block} />;
  const r = textBlockRect(block, family);
  return (
    <>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} fill="#FFFFFF" />
      <Label {...block} halo={false} />
    </>
  );
}

/**
 * Il disegno vero e proprio: usato sia dall'editor sia dagli export SVG/PDF/PNG. `idPrefix` rende unici gli id
 * dei ritagli; senza, ne usa uno per ogni disegno nella pagina (la stessa figura compare anche nelle anteprime).
 */
export function DiagramContent({ doc, interactive = false, idPrefix }: { doc: Doc; interactive?: boolean; idPrefix?: string }) {
  const auto = useId();
  const ids = idPrefix ?? auto;
  const map = new Map(doc.nodes.map((n) => [n.id, n]));
  const geoms = doc.edges.map((e) => ({ e, g: edgeGeometry(e, map) })).filter((x): x is { e: EdgeModel; g: EdgeGeom } => !!x.g);
  return (
    <FamilyContext.Provider value={doc.settings.fontFamily}>
    <g fontFamily={FONT_CSS[doc.settings.fontFamily]}>
      {doc.nodes.filter(isContainer).map((n) => <NodeView key={n.id} n={n} interactive={interactive} ids={ids} />)}
      {geoms.map(({ e, g }) => <EdgeLine key={e.id} e={e} g={g} interactive={interactive} />)}
      {doc.nodes.filter((n) => !isContainer(n)).map((n) => <NodeView key={n.id} n={n} interactive={interactive} ids={ids} />)}
      {geoms.map(({ e, g }) =>
        e.label ? (
          <g key={e.id} data-edge-id={interactive ? e.id : undefined}>
            <EdgeLabel block={edgeLabelBlock(e, g)} family={doc.settings.fontFamily} />
          </g>
        ) : null,
      )}
    </g>
    </FamilyContext.Provider>
  );
}
