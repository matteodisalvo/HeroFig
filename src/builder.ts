// Costruttore dei diagrammi usato dai modelli (templates.ts) e dai moduli di dominio
// (src/domains): crea blocchi e connessioni con lo stile coerente delle figure da paper.
import {
  COLORS,
  DEC_STYLE,
  ENC_STYLE,
  GROUP_STYLE,
  ICON,
  MED_IMG,
  makeEdge,
  makeNode,
  type EdgeModel,
  type NodeModel,
  type Side,
} from './model';

const { WHITE } = COLORS;
export type Color = { fill: string; stroke: string };
export type N = NodeModel;
export type S = Side | 'auto';

// colori delle frecce del diagramma U-Net di Ronneberger et al.
export const UNET_ARROW = { conv: '#2F6FB2', copy: '#8A8F98', pool: '#C0392B', up: '#2E8B57', out: '#1B998B' };
const EDGE_INK = '#4B5563';
export const FROZEN = { fill: 'none', stroke: '#3B82C4' };
export const FLAME = { fill: '#FB923C', stroke: '#C2410C', strokeWidth: 1.2 };

export class Builder {
  nodes: N[] = [];
  edges: EdgeModel[] = [];

  add(p: Partial<N>): N {
    const n = makeNode(p);
    this.nodes.push(n);
    return n;
  }
  box(label: string, x: number, y: number, w: number, h: number, color: Color, extra: Partial<N> = {}): N {
    return this.add({ label, x, y, w, h, fontSize: 12, strokeWidth: 1.2, ...color, ...extra });
  }
  text(label: string, x: number, y: number, w: number, h: number, extra: Partial<N> = {}): N {
    return this.add({ shape: 'text', label, x, y, w, h, fill: 'none', stroke: 'none', fontSize: 12, ...extra });
  }
  /** Estremo invisibile per frecce "libere" (legende, ingressi). */
  anchor(x: number, y: number): N {
    return this.add({ shape: 'text', label: '', x, y, w: 1, h: 1, fill: 'none', stroke: 'none' });
  }
  op(label: string, x: number, y: number, extra: Partial<N> = {}): N {
    return this.add({ shape: 'ellipse', label, x, y, w: 26, h: 26, fontSize: 16, strokeWidth: 1.2, ...WHITE, ...extra });
  }
  icon(shape: N['shape'], label: string, x: number, y: number, w: number, h: number, color: Color, extra: Partial<N> = {}): N {
    return this.add({ shape, label, x, y, w, h, ...ICON, strokeWidth: 1.2, ...color, ...extra });
  }
  /** Immagine da paper: titolo in grassetto sopra e simbolo matematico. */
  img(shape: N['shape'], title: string, math: string, x: number, y: number, w = 100, h = 100, extra: Partial<N> = {}): N {
    return this.add({ ...MED_IMG, shape, label: title, sublabel: math, subSize: 14, x, y, w, h, ...extra });
  }
  enc(symbol: string, name: string, x: number, y: number, w = 110, h = 130, extra: Partial<N> = {}): N {
    return this.add({ ...ENC_STYLE, label: symbol, sublabel: name, x, y, w, h, ...extra });
  }
  dec(symbol: string, name: string, x: number, y: number, w = 110, h = 130, extra: Partial<N> = {}): N {
    return this.add({ ...DEC_STYLE, label: symbol, sublabel: name, x, y, w, h, ...extra });
  }
  group(label: string, x: number, y: number, w: number, h: number, extra: Partial<N> = {}): N {
    return this.add({ ...GROUP_STYLE, label, x, y, w, h, ...extra });
  }
  link(a: N, b: N, sa: S = 'right', sb: S = 'left', extra: Partial<EdgeModel> = {}) {
    this.edges.push(makeEdge({ node: a.id, side: sa }, { node: b.id, side: sb }, { color: EDGE_INK, width: 1.2, fontSize: 10, ...extra }));
  }
  /** Collega in sequenza: `right` da sinistra a destra, `up` dal basso verso l'alto. */
  chain(nodes: N[], dir: 'right' | 'up' | 'down' = 'right', extra: Partial<EdgeModel> = {}) {
    for (let i = 1; i < nodes.length; i++) {
      if (dir === 'right') this.link(nodes[i - 1], nodes[i], 'right', 'left', extra);
      else if (dir === 'up') this.link(nodes[i - 1], nodes[i], 'top', 'bottom', extra);
      else this.link(nodes[i - 1], nodes[i], 'bottom', 'top', extra);
    }
  }
  done() {
    return { nodes: this.nodes, edges: this.edges };
  }
}

