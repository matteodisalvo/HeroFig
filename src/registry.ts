// Registro dei moduli di dominio (src/domains/*): ogni modulo aggiunge forme, blocchi
// della libreria e modelli senza toccare il resto dell'app. Le forme registrate sono
// disegnate con le stesse primitive `Part`, quindi funzionano in SVG, PDF, PNG e TikZ.
import type { LabelLayout, Part } from './geometry';
import type { EdgeModel, NodeModel, Preset } from './model';

export interface ShapeDef {
  /** Identificativo univoco: usare un prefisso di dominio, es. 'sp-spectrogram'. */
  kind: string;
  /** Nome mostrato nel menu "Forma" del pannello. */
  name: string;
  /** Disegno della forma nel rettangolo (n.x, n.y, n.w, n.h). */
  parts: (n: NodeModel) => Part[];
  /** Posizione dell'etichetta quando labelPos è 'center' (facoltativa). */
  label?: (n: NodeModel) => LabelLayout | null;
  /** Se presente, il pannello mostra il campo numerico `count` con questo nome. */
  countLabel?: string;
  /** Valore massimo di `count` nel pannello (predefinito 32). */
  countMax?: number;
  /** Se presente, il pannello mostra il campo di testo `spec` con questo nome. */
  specLabel?: string;
  /**
   * Valori ammessi per `spec`, mostrati nel pannello come pulsanti cliccabili.
   * `spec` è una lista di parole separate da spazi; ogni gruppo indica come combinarle:
   * - 'one' (predefinito): una sola parola del gruppo alla volta (es. il tipo di segnale);
   * - 'many': parole indipendenti da accendere/spegnere (es. 'noise', 'grid');
   * - 'value': il pulsante sostituisce tutto il campo (valori liberi come '3x4' o '70,15,15').
   */
  specOptions?: SpecGroup[];
  /** Se presente, il pannello mostra il selettore `direction` con questo nome. */
  directionLabel?: string;
}

export interface SpecChoice {
  value: string;
  /** Testo del pulsante, se diverso dal valore (breve, in italiano). */
  label?: string;
}

export interface SpecGroup {
  title?: string;
  mode?: 'one' | 'many' | 'value';
  choices: (string | SpecChoice)[];
}

export interface TemplateDef {
  id: string;
  name: string;
  /** Sezione della libreria, es. 'Signal processing'. */
  section: string;
  build: () => { nodes: NodeModel[]; edges: EdgeModel[] };
}

const shapes = new Map<string, ShapeDef>();
const presets: Preset[] = [];
const templates: TemplateDef[] = [];

function warnDuplicate(what: string, id: string) {
  console.warn(`[registry] ${what} duplicato: ${id}`);
}

export function registerShapes(defs: ShapeDef[]) {
  for (const d of defs) {
    if (shapes.has(d.kind)) warnDuplicate('forma', d.kind);
    shapes.set(d.kind, d);
  }
}

export function registerPresets(list: Preset[]) {
  for (const p of list) {
    if (presets.some((x) => x.id === p.id)) warnDuplicate('blocco', p.id);
    presets.push(p);
  }
}

export function registerTemplates(list: TemplateDef[]) {
  for (const t of list) {
    if (templates.some((x) => x.id === t.id)) warnDuplicate('modello', t.id);
    templates.push(t);
  }
}

export const getShape = (kind: string) => shapes.get(kind);
export const registeredShapes = () => [...shapes.values()];
export const registeredPresets = (): readonly Preset[] => presets;
export const registeredTemplates = (): readonly TemplateDef[] => templates;
