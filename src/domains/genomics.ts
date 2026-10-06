// Modulo di dominio "Genomica e proteine": DNA e sequenze, NGS, geni e cromosomi, tracce
// genomiche, single-cell e trascrittomica spaziale, GWAS, CRISPR, strutture proteiche (MSA,
// cartoon, mappe di contatti) e i modelli dei paper più noti (AlphaFold2, ESM, Enformer…).
// Forme in genomics-shapes.ts, modelli in genomics-templates.ts.
// Vedi src/registry.ts per l'API e src/domains/README.md per le convenzioni.
import { COLORS, ICON, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { GENOMICS_SHAPES } from './genomics-shapes';
import { GENOMICS_TEMPLATES } from './genomics-templates';

const { BLUE, GREEN, YELLOW, PURPLE, GRAY } = COLORS;

/** Illustrazione senza riquadro, etichetta sotto. */
const ILL = { strokeWidth: 1.2, ...ICON };
const DNA_BLUE = '#2F6FB2';
const G = 'Genomica';
const P = 'Proteine';

const presets: Preset[] = [
  // ---------------- DNA, RNA e sequenze ----------------
  { id: 'gen-helix', name: 'Doppia elica', category: G, node: { shape: 'gen-helix', count: 2, spec: 'ends', label: 'DNA', w: 150, h: 46, fill: 'none', stroke: DNA_BLUE, ...ILL } },
  { id: 'gen-bubble', name: 'Bolla di trascrizione', category: G, node: { shape: 'gen-helix', count: 3, spec: 'open ends', label: 'Transcription bubble', w: 190, h: 54, fill: 'none', stroke: DNA_BLUE, ...ILL } },
  { id: 'gen-dnaseq', name: 'Sequenza DNA', category: G, node: { shape: 'gen-seq', spec: 'ATGCGTACGTTAGC ends', label: 'DNA sequence', w: 200, h: 22, ...ILL } },
  { id: 'gen-rnaseq', name: 'mRNA (codoni)', category: G, node: { shape: 'gen-seq', spec: 'AUGGCUCUGUAA codons ends', label: 'mRNA', w: 180, h: 22, ...ILL } },
  { id: 'gen-snv', name: 'Variante (SNV)', category: G, node: { shape: 'gen-seq', spec: 'GACGCTAGCTAgGCAT index', label: 'Single-nucleotide variant', w: 200, h: 32, ...ILL } },
  { id: 'gen-kmer', name: 'Tokenizzazione k-mer', category: G, node: { shape: 'gen-kmer', count: 3, spec: 'ATGGCTACG', label: '3-mer tokenization', w: 170, h: 74, ...ILL, ...YELLOW } },
  { id: 'gen-kmertok', name: 'Token k-mer', category: G, node: { shape: 'gen-kmer', count: 3, spec: 'ATGGCTACG tokens cls', label: 'k-mer tokens', w: 240, h: 24, ...ILL, ...YELLOW } },
  { id: 'gen-logo', name: 'Motivo (logo)', category: G, node: { shape: 'gen-logo', spec: 'TGACTCA axis', label: 'Sequence motif', w: 130, h: 58, fill: 'none', stroke: 'none', ...ILL } },
  { id: 'gen-hairpin', name: 'Forcina di RNA', category: G, node: { shape: 'gen-hairpin', count: 6, spec: 'letters tail ends', label: 'RNA hairpin', w: 74, h: 130, fill: 'none', stroke: '#555555', ...ILL } },
  // ---------------- sequenziamento e genoma ----------------
  { id: 'gen-reads', name: 'Allineamento reads', category: G, node: { shape: 'gen-reads', count: 7, spec: 'ref coverage variant', label: 'Read alignment', w: 180, h: 110, fill: '#E6E8EB', stroke: '#9AA0A6', ...ILL } },
  { id: 'gen-gene', name: 'Modello di gene', category: G, node: { shape: 'gen-gene', count: 5, spec: 'utr tss', label: 'Gene model', w: 200, h: 42, ...ILL, ...BLUE } },
  { id: 'gen-splice', name: 'Splicing', category: G, node: { shape: 'gen-gene', count: 4, spec: 'utr splice labels', label: 'pre-mRNA $\\to$ mRNA', w: 200, h: 90, ...ILL, ...BLUE } },
  { id: 'gen-chrom', name: 'Cromosoma', category: G, node: { shape: 'gen-chrom', count: 1, spec: 'locus labels', label: 'Chromosome', w: 180, h: 36, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-karyo', name: 'Cariotipo', category: G, node: { shape: 'gen-chrom', count: 24, spec: 'labels', label: 'Human karyotype', w: 260, h: 120, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-tracks', name: 'Tracce genomiche', category: G, node: { shape: 'gen-tracks', count: 4, spec: 'names gene highlight ruler', label: 'Genomic tracks', w: 210, h: 120, fill: 'none', stroke: DNA_BLUE, ...ILL } },
  // ---------------- grafici ----------------
  { id: 'gen-manhattan', name: 'Manhattan plot', category: G, node: { shape: 'gen-manhattan', count: 3, spec: 'labels threshold', label: 'GWAS', w: 220, h: 110, fill: 'none', stroke: '#3B6FB6', ...ILL } },
  { id: 'gen-volcano', name: 'Volcano plot', category: G, node: { shape: 'gen-volcano', spec: 'labels thresholds genes', label: 'Differential expression', w: 130, h: 120, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-heatmap', name: 'Heatmap espressione', category: G, node: { shape: 'gen-heatmap', count: 3, spec: '16x10 rowtree coltree annot', label: 'Expression heatmap', w: 130, h: 140, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-umap', name: 'UMAP (cluster)', category: G, node: { shape: 'gen-umap', count: 7, spec: 'clusters labels axes', label: 'Cell clusters', w: 130, h: 120, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-umapexpr', name: 'UMAP (espressione)', category: G, node: { shape: 'gen-umap', count: 7, spec: 'expr axes', label: 'Marker gene', w: 120, h: 110, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-phylo', name: 'Albero filogenetico', category: G, node: { shape: 'gen-phylo', count: 7, spec: 'rect names scale', label: 'Phylogeny', w: 170, h: 120, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-radial', name: 'Albero radiale', category: G, node: { shape: 'gen-phylo', count: 12, spec: 'radial names', label: 'Radial phylogeny', w: 250, h: 190, fill: 'none', stroke: '#555555', ...ILL } },
  // ---------------- cellule, editing, laboratorio ----------------
  { id: 'gen-crispr', name: 'CRISPR-Cas9', category: G, node: { shape: 'gen-crispr', spec: 'labels cut', label: 'Cas9–sgRNA complex', w: 230, h: 130, ...ILL, ...PURPLE } },
  { id: 'gen-cellnuc', name: 'Cellula e nucleo', category: G, node: { shape: 'gen-cell', spec: 'nucleus', label: 'Cell', w: 96, h: 76, ...ILL, ...GREEN } },
  { id: 'gen-celldogma', name: 'Cellula (dogma)', category: G, node: { shape: 'gen-cell', spec: 'dogma', label: 'Gene expression', w: 140, h: 96, ...ILL, ...GREEN } },
  { id: 'gen-droplet', name: 'Goccia + bead', category: G, node: { shape: 'gen-cell', spec: 'droplet', label: 'Droplet', w: 72, h: 72, ...ILL, ...GREEN } },
  { id: 'gen-tissue', name: 'Tessuto', category: G, node: { shape: 'gen-cell', count: 14, spec: 'tissue', label: 'Tissue', w: 120, h: 84, ...ILL, ...GREEN } },
  { id: 'gen-spatial', name: 'Spot spaziali', category: G, node: { shape: 'gen-spatial', count: 14, spec: 'clusters', label: 'Spatial domains', w: 120, h: 110, fill: 'none', stroke: '#C9CED6', ...ILL } },
  { id: 'gen-spatialhe', name: 'Tessuto su array', category: G, node: { shape: 'gen-spatial', count: 14, spec: 'tissue', label: 'Tissue on array', w: 120, h: 110, fill: 'none', stroke: '#C9CED6', ...ILL } },
  { id: 'gen-sequencer', name: 'Sequenziatore', category: G, node: { shape: 'gen-lab', spec: 'sequencer', label: 'Sequencer', w: 76, h: 60, ...ILL, ...GRAY } },
  { id: 'gen-flowcell', name: 'Flow cell', category: G, node: { shape: 'gen-lab', spec: 'flowcell', label: 'Flow cell', w: 90, h: 50, ...ILL, ...GRAY } },
  { id: 'gen-tube', name: 'Provetta', category: G, node: { shape: 'gen-lab', spec: 'tube', label: 'Sample', w: 34, h: 60, ...ILL, ...GRAY } },
  { id: 'gen-plate', name: 'Piastra 96', category: G, node: { shape: 'gen-lab', spec: 'plate', label: '96-well plate', w: 110, h: 74, ...ILL, ...GRAY } },

  // ---------------- proteine ----------------
  { id: 'gen-protein', name: 'Proteina (cartoon)', category: P, node: { shape: 'gen-ribbon', count: 1, spec: 'fold rainbow', label: 'Protein structure', w: 130, h: 120, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-protein2', name: 'Fascio di eliche', category: P, node: { shape: 'gen-ribbon', count: 2, spec: 'fold rainbow', label: 'Protein structure', w: 130, h: 120, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-plddt', name: 'Struttura predetta', category: P, node: { shape: 'gen-ribbon', count: 1, spec: 'fold plddt', label: 'Predicted structure (pLDDT)', w: 130, h: 120, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-ss', name: 'Struttura secondaria', category: P, node: { shape: 'gen-ribbon', count: 3, spec: 'linear ss', label: 'Secondary structure', w: 220, h: 48, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-alpha', name: 'α-elica', category: P, node: { shape: 'gen-ribbon', spec: 'helix ss', label: '$\\alpha$-helix', w: 120, h: 40, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-sheet', name: 'Foglietto β', category: P, node: { shape: 'gen-ribbon', count: 4, spec: 'sheet ss', label: '$\\beta$-sheet', w: 100, h: 96, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-cloud', name: 'Residui rumorosi', category: P, node: { shape: 'gen-ribbon', count: 1, spec: 'cloud rainbow', label: '$X_T$', w: 100, h: 100, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-chain', name: 'Catena amminoacidi', category: P, node: { shape: 'gen-chain', spec: 'MKTAYIAKQR ends', label: 'Polypeptide', w: 210, h: 30, fill: 'none', stroke: '#555555', ...ILL } },
  { id: 'gen-protseq', name: 'Sequenza proteica', category: P, node: { shape: 'gen-seq', spec: 'MKTAYIAKQRQISFVKSHFSRQ ends', label: 'Protein sequence', w: 230, h: 20, ...ILL } },
  { id: 'gen-msa', name: 'MSA', category: P, node: { shape: 'gen-msa', count: 7, spec: 'clustal letters conservation gaps', label: 'Multiple sequence alignment', w: 160, h: 110, fill: 'none', stroke: 'none', ...ILL } },
  { id: 'gen-msarep', name: 'Rappresentazione MSA', category: P, node: { shape: 'gen-msa', count: 6, spec: 'heat', label: 'MSA representation', w: 100, h: 70, fill: '#FFE6CC', stroke: '#E07B39', ...ILL } },
  { id: 'gen-pair', name: 'Rappresentazione pair', category: P, node: { shape: 'gen-contact', count: 28, spec: 'distance blues', label: 'Pair representation', w: 80, h: 80, fill: 'none', stroke: '#6C8EBF', ...ILL } },
  { id: 'gen-contact', name: 'Mappa di contatti', category: P, node: { shape: 'gen-contact', count: 40, spec: 'contact blues split', label: 'Contact map', w: 96, h: 96, fill: 'none', stroke: '#9AA0A6', ...ILL } },
  { id: 'gen-distogram', name: 'Distogramma', category: P, node: { shape: 'gen-contact', count: 48, spec: 'distance viridis', label: 'Distogram', w: 96, h: 96, fill: 'none', stroke: '#9AA0A6', ...ILL } },
];

registerShapes(GENOMICS_SHAPES);
registerPresets(presets);
registerTemplates(GENOMICS_TEMPLATES);
