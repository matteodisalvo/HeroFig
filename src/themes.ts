// Temi dei colori per ruolo: ogni blocco dice cosa rappresenta (encoder, latente, loss…) e il tema
// decide i colori. Applicare un tema scrive fill/stroke nei blocchi, quindi gli export restano invariati
// e un colore cambiato a mano vale finché non si riapplica il tema.
import { isContainer, type Doc, type NodeModel, type Role, type ShapeKind } from './model';
import { plainText } from './richtext';

type RoleId = Exclude<Role, ''>;

export const ROLES: [RoleId, string][] = [
  ['data', 'Dati / input'],
  ['encoder', 'Encoder'],
  ['latent', 'Latente / token'],
  ['attention', 'Attention'],
  ['block', 'Blocco generico'],
  ['decoder', 'Decoder'],
  ['head', 'Testa / uscita'],
  ['loss', 'Loss'],
];

export interface Theme {
  id: string;
  name: string;
  colors: Record<RoleId, [fill: string, stroke: string]>;
}

export const THEMES: Theme[] = [
  {
    id: 'pastello',
    name: 'Pastello',
    colors: {
      data: ['#F5F5F5', '#666666'], encoder: ['#D5E8D4', '#82B366'], latent: ['#FFE6CC', '#D79B00'], attention: ['#E1D5E7', '#9673A6'],
      block: ['#DAE8FC', '#6C8EBF'], decoder: ['#D0ECE7', '#45A29E'], head: ['#FFF2CC', '#D6B656'], loss: ['#F8CECC', '#B85450'],
    },
  },
  {
    id: 'sobrio',
    name: 'Sobrio',
    colors: {
      data: ['#EEF0F3', '#5E6B7A'], encoder: ['#D9E6F2', '#2F5E8C'], latent: ['#F3E3C8', '#A8711C'], attention: ['#E9DDF0', '#6B4C86'],
      block: ['#E4E9F0', '#5B6B82'], decoder: ['#D7EDEA', '#2E7D72'], head: ['#DCEBE1', '#3F7A57'], loss: ['#F5D9D6', '#A23B32'],
    },
  },
  {
    // tinte chiare della palette Okabe-Ito, distinguibili con le discromatopsie più comuni
    id: 'daltonici',
    name: 'Per daltonici',
    colors: {
      data: ['#EEEEEE', '#666666'], encoder: ['#CCE3F0', '#0072B2'], latent: ['#FAECCC', '#B07A00'], attention: ['#F5E1EC', '#A8547F'],
      block: ['#E0F0FA', '#3A8FC2'], decoder: ['#CCEDE3', '#007A59'], head: ['#FBF8D6', '#9A8F00'], loss: ['#F7D9C7', '#B04A00'],
    },
  },
  {
    // grigi a luminosità ben separate: restano distinti stampati in bianco e nero
    id: 'bn',
    name: 'Bianco e nero',
    colors: {
      data: ['#FFFFFF', '#333333'], block: ['#F0F0F0', '#333333'], attention: ['#DCDCDC', '#333333'], encoder: ['#C8C8C8', '#333333'],
      head: ['#E6E6E6', '#333333'], decoder: ['#B4B4B4', '#333333'], latent: ['#A0A0A0', '#333333'], loss: ['#8C8C8C', '#222222'],
    },
  },
];

const themeById = (id: string) => THEMES.find((t) => t.id === id);

/** Forme che usano davvero fill/stroke del blocco; icone e immagini mediche hanno colori propri. */
const COLORABLE = new Set<ShapeKind>([
  'rect', 'pill', 'ellipse', 'diamond', 'hexagon', 'parallelogram', 'triangle', 'blockarrow', 'trapezoid', 'stack', 'cuboid',
  'cylinder', 'cells', 'grid', 'patches', 'image', 'document', 'barchart', 'bottleneck', 'neurons', 'mlp',
]);

const colorable = (n: NodeModel) => COLORABLE.has(n.shape) && !isContainer(n);

const RULES: [RegExp, RoleId][] = [
  [/\bloss\b|criterion|\bmse\b|cross.?entropy|contrastive|\bkl\b|ℒ|\\mathcal\{l\}/i, 'loss'],
  [/decoder|generator|upsampl|𝒟|\\mathcal\{d\}/i, 'decoder'],
  [/encoder|backbone|\bvit\b|resnet|\bcnn\b|ℰ|\\mathcal\{e\}/i, 'encoder'],
  [/attention|\battn\b|transformer/i, 'attention'],
  [/\bhead\b|classifier|\bmlp\b|softmax|predict|logit|\blinear\b|output/i, 'head'],
  [/latent|token|embedding|feature|\$z|\bz_|^z$/i, 'latent'],
  [/input|image|patch|dataset|\bdata\b|^x$|\$x/i, 'data'],
];

/** Ruolo probabile di un blocco, dall'etichetta e poi dalla forma; '' se non è un blocco colorabile. */
function guessRole(n: NodeModel): Role {
  if (!colorable(n)) return '';
  // cerchietti con un simbolo (⊕, ×, +) sono operazioni, non blocchi
  if (n.shape === 'ellipse' && plainText(n.label).trim().length <= 2) return '';
  const text = `${plainText(n.label)} ${plainText(n.sublabel)}`.trim();
  for (const [rx, role] of RULES) if (rx.test(text)) return role;
  switch (n.shape) {
    case 'image': case 'patches': case 'grid': case 'document': return 'data';
    case 'cuboid': case 'cells': case 'stack': return 'latent';
    case 'trapezoid': return n.direction === 'left' ? 'decoder' : 'encoder';
    case 'mlp': case 'neurons': case 'barchart': return 'head';
    default: return 'block';
  }
}

/** Colori del tema per un ruolo, o null se il tema o il ruolo mancano. */
export function roleColors(themeId: string, role: Role): { fill: string; stroke: string } | null {
  const t = themeById(themeId);
  if (!t || !role) return null;
  const [fill, stroke] = t.colors[role];
  return { fill, stroke };
}

/** Applica il tema: dà un ruolo ai blocchi che non ce l'hanno e ne riscrive i colori. */
export function applyTheme(doc: Doc, themeId: string): Doc {
  const nodes = doc.nodes.map((n) => {
    if (!colorable(n)) return n;
    const role = n.role || guessRole(n);
    const c = roleColors(themeId, role);
    return c ? { ...n, role, ...c } : n;
  });
  return { ...doc, nodes, settings: { ...doc.settings, theme: themeId } };
}
