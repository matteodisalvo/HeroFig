// Modulo di dominio "Chimica e molecole": molecole (sfere e bastoncini, formula di struttura,
// grafo molecolare, SMILES, coordinate 3D), reazioni, profili e superfici di energia, docking,
// cristalli, tavola periodica, spettri e strumenti per il laboratorio automatico.
// Forme in chemistry-shapes.ts, modelli in chemistry-templates.ts.
// Vedi src/registry.ts per l'API e src/domains/README.md per le convenzioni.
import { COLORS, ICON, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { CHEM_SHAPES } from './chemistry-shapes';
import { CHEM_TEMPLATES } from './chemistry-templates';

const { BLUE, GREEN, ORANGE, YELLOW, PURPLE, TEAL, GRAY } = COLORS;

/** Illustrazione senza riquadro, etichetta sotto. */
const BARE = { fill: 'none', stroke: '#4E545C', strokeWidth: 1.2, ...ICON };
/** Grafico con assi: curva nel colore del bordo. */
const TRACE = { fill: 'none', strokeWidth: 1.2, ...ICON };
const INK = '#333333';
const CH_BLUE = '#2F6FB2';

const C = 'Chimica';
const M = 'Materiali';

const presets: Preset[] = [
  // ---------------- molecole 3D ----------------
  { id: 'chem-caffeine3d', name: 'Caffeina 3D', category: C, node: { shape: 'chem-molecule', spec: 'caffeine', count: 0, label: 'Caffeine', w: 120, h: 90, ...BARE } },
  { id: 'chem-aspirin3d', name: 'Aspirina 3D', category: C, node: { shape: 'chem-molecule', spec: 'aspirin', count: 1, label: 'Aspirin', w: 110, h: 100, ...BARE } },
  { id: 'chem-water3d', name: 'Acqua 3D', category: C, node: { shape: 'chem-molecule', spec: 'water', count: 0, label: '$\\mathrm{H_2O}$', w: 60, h: 46, ...BARE } },
  { id: 'chem-methane3d', name: 'Metano 3D', category: C, node: { shape: 'chem-molecule', spec: 'methane', count: 1, label: '$\\mathrm{CH_4}$', w: 60, h: 60, ...BARE } },
  { id: 'chem-benzene3d', name: 'Benzene 3D', category: C, node: { shape: 'chem-molecule', spec: 'benzene', count: 0, label: 'Benzene', w: 80, h: 80, ...BARE } },
  { id: 'chem-cpk', name: 'Spazio pieno (CPK)', category: C, node: { shape: 'chem-molecule', spec: 'caffeine spacefill', count: 0, label: 'Caffeine (space-filling)', w: 110, h: 90, ...BARE } },
  // ---------------- formule e grafi ----------------
  { id: 'chem-skel-aspirin', name: 'Formula di struttura', category: C, node: { shape: 'chem-skeletal', spec: 'aspirin color', label: 'Aspirin', w: 110, h: 90, ...BARE, stroke: INK } },
  { id: 'chem-skel-caffeine', name: 'Caffeina (formula)', category: C, node: { shape: 'chem-skeletal', spec: 'caffeine color', label: 'Caffeine', w: 110, h: 90, ...BARE, stroke: INK } },
  { id: 'chem-skel-benzene', name: 'Anello aromatico', category: C, node: { shape: 'chem-skeletal', spec: 'benzene circle', w: 56, h: 60, ...BARE, stroke: INK } },
  { id: 'chem-chain', name: 'Catena alchilica', category: C, node: { shape: 'chem-skeletal', spec: 'chain', count: 6, w: 110, h: 30, ...BARE, stroke: INK } },
  { id: 'chem-molgraph', name: 'Grafo molecolare', category: C, node: { shape: 'chem-molgraph', spec: 'paracetamol labels', label: 'Molecular graph $G$', w: 130, h: 90, ...BARE } },
  { id: 'chem-msgpass', name: 'Message passing', category: C, node: { shape: 'chem-molgraph', spec: 'paracetamol messages', count: 5, label: '$m_v = \\sum_{w \\in N(v)} M(h_v, h_w, e_{vw})$', w: 150, h: 100, ...BARE } },
  { id: 'chem-jtclusters', name: 'Cluster (JT-VAE)', category: C, node: { shape: 'chem-skeletal', spec: 'jtmol clusters', label: 'Tree decomposition', w: 130, h: 90, ...BARE, stroke: INK } },
  { id: 'chem-jtree', name: 'Albero di giunzione', category: C, node: { shape: 'chem-molgraph', spec: 'jtmol jtree', label: 'Junction tree $\\mathcal{T}$', w: 130, h: 90, ...BARE } },
  { id: 'chem-smiles', name: 'Stringa SMILES', category: C, node: { shape: 'chem-smiles', spec: 'CC(=O)Oc1ccccc1C(=O)O', label: 'SMILES', w: 300, h: 24, radius: 3, ...ICON, ...GRAY } },
  { id: 'chem-ecfp', name: 'Fingerprint ECFP', category: C, node: { shape: 'chem-smiles', spec: 'CC(=O)Oc1ccccc1C(=O)O bits', count: 32, label: 'ECFP4 fingerprint', w: 200, h: 14, ...ICON, fill: 'none', stroke: '#3A3F47' } },
  // ---------------- geometria 3D per modelli equivarianti e generativi ----------------
  { id: 'chem-cutoff', name: 'Molecola 3D + cutoff', category: C, node: { shape: 'chem-mol3d', spec: 'aspirin cutoff labels noh', count: 5, label: 'Radius graph, cutoff $r_c$', w: 120, h: 110, ...BARE, stroke: '#C0392B' } },
  { id: 'chem-vectors', name: 'Coordinate e vettori', category: C, node: { shape: 'chem-mol3d', spec: 'caffeine vectors axes noh bonds', label: '$(\\mathbf{x}_i, \\mathbf{h}_i, \\mathbf{v}_i)$', w: 120, h: 100, ...BARE } },
  { id: 'chem-noisy', name: 'Molecola rumorosa', category: C, node: { shape: 'chem-mol3d', spec: 'aspirin noise-mid bonds', label: '$\\mathbf{z}_t$', w: 100, h: 90, ...BARE } },
  // ---------------- reazioni ed energia ----------------
  { id: 'chem-rxn', name: 'Schema di reazione', category: C, node: { shape: 'chem-reaction', spec: 'esterification', w: 340, h: 70, ...BARE, stroke: INK } },
  { id: 'chem-suzuki', name: 'Accoppiamento di Suzuki', category: C, node: { shape: 'chem-reaction', spec: 'suzuki color', w: 320, h: 70, ...BARE, stroke: INK } },
  { id: 'chem-retro', name: 'Retrosintesi', category: C, node: { shape: 'chem-reaction', spec: 'acetylation retro', w: 300, h: 60, ...BARE, stroke: INK } },
  { id: 'chem-energy', name: 'Profilo energetico', category: C, node: { shape: 'chem-energy', spec: 'exo annot labels', w: 170, h: 120, stroke: CH_BLUE, ...TRACE } },
  { id: 'chem-catalysis', name: 'Catalisi (profilo)', category: C, node: { shape: 'chem-energy', spec: 'catalyzed annot labels', w: 170, h: 120, stroke: '#2E8B57', ...TRACE } },
  // ---------------- docking ----------------
  { id: 'chem-docked', name: 'Tasca + ligando', category: C, node: { shape: 'chem-docking', spec: 'docked pocket', label: 'Protein-ligand complex', w: 130, h: 110, ...BARE, fill: '#ECEDF0', stroke: '#A3A8AF' } },
  { id: 'chem-poses', name: 'Pose di docking', category: C, node: { shape: 'chem-docking', spec: 'random', count: 7, label: 'Random poses', w: 130, h: 110, ...BARE, fill: '#ECEDF0', stroke: '#A3A8AF' } },
  { id: 'chem-posezoom', name: 'Posa (dettaglio)', category: C, node: { shape: 'chem-docking', spec: 'zoom', count: 0, w: 90, h: 80, radius: 6, ...BARE, fill: '#ECEDF0', stroke: '#A3A8AF' } },
  // ---------------- funzioni per reti neurali molecolari ----------------
  { id: 'chem-rbf', name: 'Basi radiali (RBF)', category: C, node: { shape: 'chem-basis', spec: 'gauss cutoff labels', count: 6, label: 'Radial basis $e_k(r)$', w: 130, h: 80, stroke: CH_BLUE, ...TRACE } },
  { id: 'chem-ylm', name: 'Armoniche sferiche', category: C, node: { shape: 'chem-orbital', spec: 'table', count: 2, label: '$Y_l^m(\\hat{\\mathbf{r}})$', w: 150, h: 92, strokeWidth: 1, ...ICON } },
  { id: 'chem-funnel', name: 'Imbuto di screening', category: C, node: { shape: 'chem-funnel', count: 5, w: 150, h: 150, ...ICON, ...BLUE } },
  // ---------------- laboratorio e spettri ----------------
  { id: 'chem-flask', name: 'Beuta', category: C, node: { shape: 'chem-lab', spec: 'flask', w: 44, h: 54, ...ICON, ...BLUE } },
  { id: 'chem-roundflask', name: 'Pallone', category: C, node: { shape: 'chem-lab', spec: 'roundflask', w: 44, h: 56, ...ICON, ...ORANGE } },
  { id: 'chem-tubes', name: 'Provette', category: C, node: { shape: 'chem-lab', spec: 'tubes', count: 4, w: 60, h: 56, ...ICON, ...PURPLE } },
  { id: 'chem-plate', name: 'Piastra 96 pozzetti', category: C, node: { shape: 'chem-lab', spec: 'plate', label: '96-well plate', w: 96, h: 64, radius: 4, ...ICON, ...TEAL } },
  { id: 'chem-robotarm', name: 'Braccio robotico', category: C, node: { shape: 'chem-lab', spec: 'robotarm', w: 56, h: 60, ...ICON, ...GRAY } },
  { id: 'chem-pipette', name: 'Pipetta', category: C, node: { shape: 'chem-lab', spec: 'pipette', w: 26, h: 60, ...ICON, ...GREEN } },
  { id: 'chem-nmr', name: 'Spettro NMR', category: C, node: { shape: 'chem-spectrum', spec: 'nmr labels', label: '$^1$H NMR', w: 140, h: 70, stroke: CH_BLUE, ...TRACE } },
  { id: 'chem-ir', name: 'Spettro IR', category: C, node: { shape: 'chem-spectrum', spec: 'ir labels', label: 'IR spectrum', w: 140, h: 70, stroke: '#C0392B', ...TRACE } },
  { id: 'chem-ms', name: 'Spettro di massa', category: C, node: { shape: 'chem-spectrum', spec: 'ms labels', label: 'Mass spectrum', w: 140, h: 70, stroke: '#3A3F47', ...TRACE } },

  // ---------------- cristalli e celle ----------------
  { id: 'chem-nacl', name: 'Salgemma (NaCl)', category: M, node: { shape: 'chem-crystal', spec: 'nacl bonds', label: 'NaCl (rock salt)', w: 110, h: 110, ...BARE } },
  { id: 'chem-perovskite', name: 'Perovskite', category: M, node: { shape: 'chem-crystal', spec: 'perovskite bonds', label: 'Perovskite $\\mathrm{ABX_3}$', w: 110, h: 110, ...BARE } },
  { id: 'chem-bcc', name: 'Cella bcc', category: M, node: { shape: 'chem-crystal', spec: 'bcc vectors', label: 'bcc unit cell', w: 110, h: 110, ...BARE } },
  { id: 'chem-fcc', name: 'Cella fcc', category: M, node: { shape: 'chem-crystal', spec: 'fcc', label: 'fcc unit cell', w: 100, h: 100, ...BARE } },
  { id: 'chem-cscl', name: 'Cloruro di cesio', category: M, node: { shape: 'chem-crystal', spec: 'cscl', label: 'CsCl', w: 100, h: 100, ...BARE } },
  { id: 'chem-diamond', name: 'Diamante', category: M, node: { shape: 'chem-crystal', spec: 'diamond', label: 'Diamond', w: 100, h: 100, ...BARE } },
  { id: 'chem-supercell', name: 'Supercella', category: M, node: { shape: 'chem-crystal', spec: 'nacl supercell', label: '$2 \\times 2 \\times 2$ supercell', w: 130, h: 130, ...BARE } },
  { id: 'chem-graphene', name: 'Grafene', category: M, node: { shape: 'chem-crystal', spec: 'graphene', count: 4, label: 'Graphene', w: 130, h: 80, ...BARE } },
  { id: 'chem-mdbox', name: 'Box MD (acqua)', category: M, node: { shape: 'chem-crystal', spec: 'liquid', count: 16, label: 'MD simulation box', w: 110, h: 110, ...BARE } },
  { id: 'chem-cgraph', name: 'Grafo cristallino', category: M, node: { shape: 'chem-crystal', spec: 'graph', label: 'Crystal graph', w: 110, h: 100, ...BARE, stroke: '#5B78B0' } },
  { id: 'chem-cell2d', name: 'Cella periodica 2D', category: M, node: { shape: 'chem-crystal', spec: 'cell2d', count: 4, w: 64, h: 64, radius: 2, ...ICON, fill: '#FFFFFF', stroke: '#555555', dashed: true } },
  // ---------------- energia potenziale ----------------
  { id: 'chem-pes', name: 'Superficie PES', category: M, node: { shape: 'chem-pes', spec: 'surface path', label: 'Potential energy surface', w: 150, h: 110, ...BARE } },
  { id: 'chem-pescontour', name: 'PES (curve di livello)', category: M, node: { shape: 'chem-pes', spec: 'contour path', label: 'Minimum energy path', w: 130, h: 100, radius: 2, ...BARE } },
  { id: 'chem-morse', name: 'Potenziale di Morse', category: M, node: { shape: 'chem-pes', spec: 'morse labels', label: 'Morse potential', w: 140, h: 100, stroke: CH_BLUE, ...TRACE } },
  { id: 'chem-lj', name: 'Lennard-Jones', category: M, node: { shape: 'chem-pes', spec: 'lj labels', label: 'Lennard-Jones', w: 140, h: 100, stroke: '#C0392B', ...TRACE } },
  { id: 'chem-xrd', name: 'Pattern XRD', category: M, node: { shape: 'chem-spectrum', spec: 'xrd labels', label: 'XRD pattern', w: 150, h: 76, stroke: CH_BLUE, ...TRACE } },
  // ---------------- tavola periodica ----------------
  { id: 'chem-el-c', name: 'Elemento (C)', category: M, node: { shape: 'chem-element', spec: 'C cat', w: 56, h: 56, radius: 4, strokeWidth: 1.2, ...BLUE } },
  { id: 'chem-el-fe', name: 'Elemento (Fe)', category: M, node: { shape: 'chem-element', spec: 'Fe cat', w: 56, h: 56, radius: 4, strokeWidth: 1.2, ...YELLOW } },
  { id: 'chem-el-li', name: 'Elemento (Li)', category: M, node: { shape: 'chem-element', spec: 'Li cat', w: 56, h: 56, radius: 4, strokeWidth: 1.2, ...ORANGE } },
  { id: 'chem-el-si', name: 'Elemento (Si)', category: M, node: { shape: 'chem-element', spec: 'Si cat', w: 56, h: 56, radius: 4, strokeWidth: 1.2, ...TEAL } },
  { id: 'chem-ptable', name: 'Tavola periodica', category: M, node: { shape: 'chem-ptable', spec: 'cats', label: 'Periodic table', w: 270, h: 110, ...ICON, ...GRAY } },
  { id: 'chem-ptable-hl', name: 'Tavola (evidenziata)', category: M, node: { shape: 'chem-ptable', spec: 'Li Co Ni Mn O', label: 'Elements in the dataset', w: 270, h: 110, ...ICON, ...ORANGE } },
];

registerShapes(CHEM_SHAPES);
registerPresets(presets);
registerTemplates(CHEM_TEMPLATES);
