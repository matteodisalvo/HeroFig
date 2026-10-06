// Modelli del modulo "Genomica e proteine": pipeline di bioinformatica (NGS, scRNA-seq, GWAS,
// CRISPR, trascrittomica spaziale, multi-omica) e architetture ricalcate sulle figure dei paper
// (AlphaFold2, ESM-2/ESMFold, Enformer, DeepSEA, DNABERT, RFdiffusion + ProteinMPNN, scGPT).
// I blocchi sono posizionati per centro, così porte e linee restano allineate.
import { Builder, type Color } from '../builder';
import { COLORS, ICON, type NodeModel } from '../model';
import type { TemplateDef } from '../registry';

const { BLUE, GREEN, ORANGE, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;
const SEC = 'Genomica e proteine';
const SOFT = '#9AA0A6';
const MUTED = '#555555';
type X = Partial<NodeModel>;

/** Rettangolo dato il centro. */
const C = (cx: number, cy: number, w: number, h: number) => ({ x: cx - w / 2, y: cy - h / 2, w, h });
/** Illustrazione del modulo (forma parametrica) con etichetta sotto. */
const ill = (t: Builder, shape: string, spec: string, label: string, cx: number, cy: number, w: number, h: number, extra: X = {}) =>
  t.add({ shape, spec, label, ...C(cx, cy, w, h), fill: 'none', stroke: MUTED, strokeWidth: 1.2, ...ICON, fontSize: 11, ...extra });
const block = (t: Builder, label: string, cx: number, cy: number, w: number, h: number, c: Color, extra: X = {}) =>
  t.box(label, cx - w / 2, cy - h / 2, w, h, c, { radius: 6, fontSize: 12, ...extra });
/** Passo di una pipeline: titolo in grassetto e dettagli (strumenti, formule) sotto. */
const step = (t: Builder, title: string, sub: string, cx: number, cy: number, w: number, h: number, c: Color, extra: X = {}) =>
  block(t, title, cx, cy, w, h, c, { bold: true, fontSize: 11, sublabel: sub, subSize: 10, ...extra });
const note = (t: Builder, s: string, cx: number, cy: number, w: number, h: number, extra: X = {}) =>
  t.text(s, cx - w / 2, cy - h / 2, w, h, { fontSize: 10, textColor: MUTED, ...extra });
const heading = (t: Builder, s: string, x: number, y: number, w = 320) => t.text(s, x, y, w, 20, { bold: true, fontSize: 13, align: 'left' });
const panel = (t: Builder, label: string, x: number, y: number, w: number, h: number, fill: string, stroke: string, extra: X = {}) =>
  t.group(label, x, y, w, h, { dashed: false, fill, stroke, textColor: '#444444', ...extra });
const above = (label: string, extra = {}) => ({ label, labelPos: 'above' as const, fontSize: 10, ...extra });
const below = (label: string, extra = {}) => ({ label, labelPos: 'below' as const, fontSize: 10, ...extra });
const thin = { dashed: true, arrowEnd: false, color: SOFT, width: 1 };

// ======================================================================
// Fondamenti
// ======================================================================

/** Dogma centrale della biologia molecolare (Crick 1958/1970): replicazione, trascrizione, traduzione. */
function dogma() {
  const t = new Builder();
  const Y = 90;
  panel(t, 'Nucleus', 0, 0, 560, 230, '#F7F4FB', '#B7A8D6', { textColor: '#5B4A86' });
  panel(t, 'Cytoplasm', 580, 0, 680, 230, '#F4FAF2', '#A9CC9C', { textColor: '#3F6B34' });
  t.add({ shape: 'cycle', label: 'Replication', ...C(40, Y, 34, 34), fill: 'none', stroke: MUTED, strokeWidth: 1.2, labelPos: 'below', fontSize: 10 });
  const dna = ill(t, 'gen-helix', 'ends', 'DNA', 170, Y, 170, 48, { count: 3, stroke: '#2F6FB2' });
  const gene = ill(t, 'gen-gene', 'utr splice labels', 'pre-mRNA $\\to$ mRNA (splicing)', 440, Y + 4, 200, 90, { count: 4, ...BLUE });
  const mrna = ill(t, 'gen-seq', 'AUGGCCCUGUGGAUGCGC codons ends', 'mRNA', 730, Y, 210, 24);
  const pep = ill(t, 'gen-chain', 'MALWMR ends', 'Polypeptide', 990, Y, 150, 28);
  const prot = ill(t, 'gen-ribbon', 'fold rainbow', 'Folded protein', 1180, Y, 110, 104, { count: 1 });
  t.link(dna, gene, 'right', 'left', above('Transcription'));
  t.link(gene, mrna, 'right', 'left', above('Export'));
  t.link(mrna, pep, 'right', 'left', above('Translation'));
  t.link(pep, prot, 'right', 'left', above('Folding'));
  // retrotrascrizione (retrovirus): parte sotto le etichette, per non attraversarle
  t.link(t.anchor(730, 124), t.anchor(170, 138), 'bottom', 'bottom', { ...below('Reverse transcription'), dashed: true, color: '#7A808A', offset: 36 });
  note(t, 'codons: AUG GCC CUG UGG AUG CGC  $\\to$  Met Ala Leu Trp Met Arg', 940, 150, 340, 18, { fontSize: 9 });
  return t.done();
}

/** Pipeline NGS per la chiamata di varianti (best practice GATK): FASTQ → BAM → VCF. */
function ngs() {
  const t = new Builder();
  const Y1 = 110, Y2 = 290;
  const tube = ill(t, 'gen-lab', 'tube', 'Sample', 24, Y1, 30, 52, GRAY);
  const lib = step(t, 'Library prep', 'fragmentation +\nadapter ligation', 150, Y1, 130, 58, PURPLE);
  const seq = ill(t, 'gen-lab', 'sequencer', 'Sequencing', 300, Y1, 74, 60, GRAY);
  const fq = t.add({ shape: 'document', label: 'FASTQ', ...C(425, Y1, 54, 68), ...ICON, fontSize: 11, strokeWidth: 1.2, ...WHITE });
  const qc = step(t, 'QC + trimming', 'FastQC · Trimmomatic', 570, Y1, 140, 58, YELLOW);
  t.chain([tube, lib, seq, fq, qc]);
  const rec = note(t, '@read_001/1\nGATTTGGGGTTCAAAGCAGT\n+\nIIIIIHHHHGGGFFFEEEDD', 425, 22, 170, 50, { fontSize: 9, textColor: '#444444' });
  t.link(fq, rec, 'top', 'bottom', thin);
  const al = step(t, 'Read alignment', 'BWA-MEM', 80, Y2, 130, 58, BLUE);
  const ref = t.add({ shape: 'cylinder', label: 'Reference genome\n(GRCh38)', ...C(80, Y2 + 115, 120, 64), fontSize: 10, strokeWidth: 1.2, ...GRAY });
  const bam = ill(t, 'gen-reads', 'ref coverage variant', 'Aligned reads (BAM)', 275, Y2, 170, 108, { count: 7, fill: '#E6E8EB', stroke: SOFT });
  const post = step(t, 'Post-processing', 'sort · mark duplicates\nbase recalibration', 470, Y2, 140, 64, GREEN);
  const vc = step(t, 'Variant calling', 'GATK HaplotypeCaller', 645, Y2, 150, 58, ORANGE);
  const vcf = t.add({ shape: 'document', label: 'VCF', ...C(785, Y2, 54, 68), ...ICON, fontSize: 11, strokeWidth: 1.2, ...WHITE });
  const ann = step(t, 'Annotation', 'VEP · ANNOVAR', 915, Y2, 130, 58, TEAL);
  t.link(qc, al, 'bottom', 'top');
  t.link(ref, al, 'top', 'bottom');
  t.chain([al, bam, post, vc, vcf, ann]);
  // un record VCF, a colonne allineate
  const cols: [string, string, number][] = [['#CHROM', 'chr17', 730], ['POS', '7675088', 784], ['REF', 'C', 828], ['ALT', 'T', 858], ['QUAL', '912', 890]];
  cols.forEach(([h, v, x]) => {
    t.text(h, x - 25, Y2 + 78, 50, 14, { fontSize: 9, bold: true, textColor: '#444444' });
    t.text(v, x - 25, Y2 + 94, 50, 14, { fontSize: 9, textColor: '#444444' });
  });
  t.link(t.anchor(785, Y2 + 56), t.anchor(785, Y2 + 76), 'bottom', 'top', { ...thin, routing: 'straight' });
  return t.done();
}

/** Analisi single-cell RNA-seq (10x Genomics; workflow Seurat/Scanpy, Luecken & Theis 2019, doi:10.15252/msb.20188746). */
function scrna() {
  const t = new Builder();
  const Y1 = 85, Y2 = 315;
  panel(t, 'Experiment', -10, 0, 900, 165, '#FAFAFB', '#C9CED6');
  panel(t, '', -10, 210, 1150, 205, '#FAFAFB', '#C9CED6');
  t.text('Computational analysis', 940, 217, 190, 18, { fontSize: 12, textColor: '#444444', align: 'right' });
  const tis = ill(t, 'gen-cell', 'tissue', 'Tissue', 60, Y1, 100, 74, { count: 12, ...GREEN });
  const drop = ill(t, 'gen-cell', 'droplet', 'Droplet (cell + bead)', 230, Y1, 70, 70, GREEN);
  t.link(tis, drop, 'right', 'left', above('Dissociation'));
  // struttura del cDNA con codice a barre
  const parts: [string, number, Color][] = [['Cell BC', 54, BLUE], ['UMI', 40, ORANGE], ['poly(dT)', 54, GRAY], ['cDNA', 70, GREEN]];
  let x = 345;
  const segs = parts.map(([s, w, c]) => {
    const b = t.box(s, x, Y1 - 13, w, 26, c, { radius: 2, fontSize: 9 });
    x += w;
    return b;
  });
  note(t, 'Barcoded cDNA', 345 + 109, Y1 - 30, 160, 16, { fontSize: 10, textColor: '#333333' });
  t.link(drop, segs[0], 'right', 'left', above('Lysis + RT'));
  const seq = ill(t, 'gen-lab', 'sequencer', 'Sequencing', 640, Y1, 74, 60, GRAY);
  const cnt = step(t, 'Alignment + UMI counting', 'Cell Ranger · STARsolo', 790, Y1, 150, 58, TEAL);
  t.link(segs[3], seq);
  t.link(seq, cnt);
  const mat = t.add({ shape: 'heatmap', spec: '10x8', label: 'Count matrix\n$X \\in \\mathbb{N}^{G \\times N}$', ...C(55, Y2, 80, 80), ...ICON, fontSize: 10, strokeWidth: 1.2, fill: '#DAE8FC', stroke: '#3B6FB6' });
  const qcn = step(t, 'QC + normalization', 'log1p · HVG selection', 200, Y2, 130, 58, YELLOW);
  const pca = step(t, 'PCA', '50 PCs', 335, Y2, 80, 50, PURPLE);
  const knn = t.add({ shape: 'graph', label: 'kNN graph', ...C(450, Y2, 70, 62), ...ICON, fontSize: 10, strokeWidth: 1.2, ...GREEN });
  const leid = step(t, 'Leiden clustering', '', 570, Y2, 110, 46, ORANGE);
  const umap = ill(t, 'gen-umap', 'clusters labels axes', 'UMAP', 720, Y2, 120, 110, { count: 7 });
  const mk = ill(t, 'gen-heatmap', '18x7 coltree annot', 'Marker genes', 880, Y2, 104, 120, { count: 4 });
  const ann = step(t, 'Cell-type annotation', 'T · B · NK cells\nmonocytes · DCs', 1040, Y2, 140, 64, TEAL);
  t.link(cnt, mat, 'bottom', 'top');
  t.chain([mat, qcn, pca, knn, leid, umap, mk, ann]);
  return t.done();
}

/** Analisi di associazione genome-wide (GWAS): coorte, genotipizzazione, test per SNP, fine-mapping. */
function gwas() {
  const t = new Builder();
  const Y = 90, Y2 = 320;
  const coh = panel(t, 'Cohort', 0, Y - 50, 112, 100, '#FAFAFB', '#C9CED6');
  t.icon('user', 'Cases', 30, Y - 22, 28, 32, RED, { fontSize: 10 });
  t.icon('user', 'Controls', 72, Y - 22, 28, 32, BLUE, { fontSize: 10 });
  const geno = ill(t, 'gen-lab', 'plate', 'Genotyping\n(SNP array / WGS)', 205, Y, 92, 62, { ...GRAY, fontSize: 10 });
  const qc = step(t, 'QC + imputation', 'call rate · HWE · MAF\nreference panel', 375, Y, 150, 64, YELLOW);
  const test = step(t, 'Association test (per SNP)', '$\\mathrm{logit}\\, P(y = 1) = \\beta_0 + \\beta_j g_j + \\gamma^\\top c$', 610, Y, 250, 64, ORANGE, { subSize: 11 });
  const man = ill(t, 'gen-manhattan', 'labels threshold', 'Manhattan plot  ($p < 5 \\times 10^{-8}$)', 900, Y, 250, 130, { count: 3, stroke: '#3B6FB6' });
  t.chain([coh, geno, qc, test, man]);
  const loc = panel(t, 'Associated locus', 300, Y2 - 70, 330, 150, '#FAFAFB', '#C9CED6');
  ill(t, 'gen-chrom', 'locus labels', '', 465, Y2 - 22, 300, 34, { count: 1 });
  ill(t, 'gen-gene', 'utr tss labels', 'Candidate gene', 465, Y2 + 35, 260, 34, { count: 6, ...BLUE });
  const fm = step(t, 'Fine-mapping', 'SuSiE · FINEMAP\n95% credible sets', 780, Y2, 150, 64, PURPLE);
  const fu = step(t, 'Functional follow-up', 'eQTL colocalization\nCRISPR screens', 990, Y2, 160, 64, TEAL);
  t.link(t.anchor(900, Y + 92), loc, 'bottom', 'top', above('lead SNPs'));
  t.chain([loc, fm, fu]);
  return t.done();
}

/** Progettazione di guide CRISPR-Cas9: ricerca delle PAM, punteggi on/off-target, editing. */
function crisprDesign() {
  const t = new Builder();
  const Y = 90, Y2 = 300;
  const gene = ill(t, 'gen-gene', 'utr tss', 'Target gene', 100, Y, 190, 40, { count: 5, ...BLUE });
  const scan = step(t, 'Scan for PAM', "5'-N$_{20}$-NGG-3'", 290, Y, 120, 54, YELLOW);
  const cand = panel(t, 'Candidate sgRNAs', 380, Y - 62, 270, 124, '#FAFAFB', '#C9CED6');
  const guides = ['GACGCTAGCTAGCATGCAGTcgg', 'TTGCAGGACCTGAAGCTCAAtgg', 'CCATGGAGCTTAACGTACGAagg'];
  guides.forEach((g, i) => {
    const yy = Y - 22 + i * 28;
    t.text(`sg${i + 1}`, 386, yy - 8, 26, 16, { fontSize: 10, align: 'left' });
    ill(t, 'gen-seq', g, '', 528, yy, 220, 16);
  });
  const on = step(t, 'On-target efficiency', 'CNN on 30-mer context', 790, Y - 38, 170, 50, ORANGE);
  const off = step(t, 'Off-target search', '≤ 4 mismatches · CFD score', 790, Y + 38, 170, 50, RED);
  t.link(gene, scan);
  t.link(scan, cand);
  t.link(cand, on, 'right', 'left');
  t.link(cand, off, 'right', 'left');
  // classifica delle guide
  const rank = panel(t, 'Ranked guides', 920, Y - 62, 180, 124, '#FAFAFB', '#B8BEC8');
  const rows: [string, number][] = [['sg2', 0.91], ['sg1', 0.74], ['sg3', 0.38]];
  rows.forEach(([name, p], i) => {
    const yy = Y - 28 + i * 30;
    t.text(name, 930, yy - 8, 30, 16, { fontSize: 10, align: 'left' });
    t.add({ x: 962, y: yy - 7, w: Math.max(2, 92 * p), h: 14, radius: 1.5, strokeWidth: 1, ...(i ? GRAY : GREEN) });
    t.text(p.toFixed(2), 966 + 92 * p, yy - 8, 30, 16, { fontSize: 9, align: 'left', textColor: MUTED });
  });
  t.link(on, rank, 'right', 'left');
  t.link(off, rank, 'right', 'left');
  const cas = ill(t, 'gen-crispr', 'labels cut', 'Cas9–sgRNA at the target: double-strand break', 450, Y2, 240, 136, PURPLE);
  t.link(rank, cas, 'bottom', 'top', above('top guide'));
  const nhej = step(t, 'NHEJ', 'indels $\\to$ knock-out', 720, Y2 - 40, 160, 48, GRAY);
  const hdr = step(t, 'HDR', 'donor template $\\to$ precise edit', 720, Y2 + 40, 160, 48, GREEN);
  t.link(cas, nhej, 'right', 'left');
  t.link(cas, hdr, 'right', 'left');
  return t.done();
}

// ======================================================================
// Struttura delle proteine
// ======================================================================

/** Jumper et al. 2021 (Nature 596:583, doi:10.1038/s41586-021-03819-2), Fig. 1e: architettura di AlphaFold2. */
function alphafold() {
  const t = new Builder();
  const INKB = '#2C4A8A';
  const RECY = '#6E9AAE';
  const flow = { color: INKB, width: 1.4 };
  const YM = 200, YP = 470;
  const inp = ill(t, 'gen-seq', 'MKTAYIAKQR', 'Input sequence', 50, 335, 100, 16, { textColor: INKB });
  const gdb = t.add({ shape: 'cylinder', label: 'Genetic\ndatabase\nsearch', ...C(225, YM, 104, 72), fontSize: 10, strokeWidth: 1.2, ...GRAY });
  const pair = t.add({ shape: 'pill', label: 'Pairing', ...C(225, YP, 80, 28), fontSize: 11, strokeWidth: 1.2, ...WHITE });
  const sdb = t.add({ shape: 'cylinder', label: 'Structure\ndatabase\nsearch', ...C(225, 590, 104, 72), fontSize: 10, strokeWidth: 1.2, ...GRAY });
  t.group('', 300, 70, 140, 590, { dashed: false, fill: '#F0F1F3', stroke: 'none' });
  const msa = ill(t, 'gen-msa', 'clustal letters', 'MSA', 370, YM, 110, 120, { count: 8, textColor: INKB });
  const tpair = ill(t, 'gen-contact', 'contact oranges', '', 370, YP, 78, 78, { count: 24 });
  ill(t, 'gen-contact', 'distance viridis', 'Templates', 377, 597, 70, 70, { count: 24, textColor: INKB });
  const tmpl = ill(t, 'gen-contact', 'distance viridis', '', 369, 589, 70, 70, { count: 30 });
  // la sequenza stessa è la prima riga dell'MSA
  const q = t.anchor(314, 148);
  t.link(inp, q, 'right', 'left', { ...flow, offset: -70 });
  t.link(inp, gdb, 'right', 'left', flow);
  t.link(inp, pair, 'right', 'left', { ...flow, offset: -6 });
  t.link(inp, sdb, 'right', 'left', flow);
  t.link(gdb, msa, 'right', 'left', flow);
  t.link(pair, tpair, 'right', 'left', flow);
  t.link(sdb, tmpl, 'right', 'left', flow);
  const op1 = t.op('+', 457, YM - 13);
  const op2 = t.op('+', 483, YP - 13);
  t.link(msa, op1, 'right', 'left', flow);
  t.link(tpair, op2, 'right', 'left', flow);
  t.link(tmpl, op2, 'right', 'left', flow);
  const msaRep = ill(t, 'gen-msa', 'heat', 'MSA representation $(s, r, c)$', 600, YM, 120, 84, { count: 6, fill: '#FFE6CC', stroke: '#E07B39' });
  const pairRep = ill(t, 'gen-contact', 'distance blues', 'Pair representation $(r, r, c)$', 600, YP, 96, 96, { count: 28, stroke: '#6C8EBF' });
  t.link(op1, msaRep, 'right', 'left', flow);
  t.link(op2, pairRep, 'right', 'left', flow);
  const tall = { fill: '#F0F1F3', stroke: '#4A6FA5' };
  block(t, 'Evoformer\n(48 blocks)', 790, 335, 120, 440, tall, { radius: 16, fontSize: 13 });
  t.link(msaRep, t.anchor(730, YM), 'right', 'left', flow);
  t.link(pairRep, t.anchor(730, YP), 'right', 'left', flow);
  const single = ill(t, 'gen-msa', 'heat', 'Single repr. $(r, c)$', 975, YM, 120, 22, { count: 1, fill: '#FFE6CC', stroke: '#E07B39' });
  const pair2 = ill(t, 'gen-contact', 'distance blues', 'Pair representation $(r, r, c)$', 975, YP, 96, 96, { count: 28, stroke: '#6C8EBF' });
  t.link(t.anchor(850, YM), single, 'right', 'left', flow);
  t.link(t.anchor(850, YP), pair2, 'right', 'left', flow);
  const sm = block(t, 'Structure\nmodule\n(8 blocks)', 1160, 335, 120, 440, tall, { radius: 16, fontSize: 13 });
  t.link(single, t.anchor(1100, YM), 'right', 'left', flow);
  t.link(pair2, t.anchor(1100, YP), 'right', 'left', flow);
  const out = ill(t, 'gen-ribbon', 'fold plddt', '3D structure', 1340, 335, 140, 130, { count: 1, textColor: INKB });
  t.link(sm, out, 'right', 'left', flow);
  const hi = t.text('High\nconfidence', 1255, 196, 80, 30, { fontSize: 11, textColor: '#1D5FC0' });
  const lo = t.text('Low\nconfidence', 1385, 196, 80, 30, { fontSize: 11, textColor: '#E8633A' });
  t.link(hi, t.anchor(1307, 318), 'bottom', 'top', { color: '#1D5FC0', width: 1.2, routing: 'straight' });
  t.link(lo, t.anchor(1373, 289), 'bottom', 'top', { color: '#E8633A', width: 1.2, routing: 'straight' });
  // riciclo: rappresentazioni e struttura tornano all'ingresso (tre volte)
  const rec = block(t, '$\\leftarrow$ Recycling (three times)', 985, 720, 870, 36, { fill: '#DCE8EE', stroke: '#7FA3B5' }, { fontSize: 12 });
  const rflow = { color: RECY, width: 1.4 };
  t.link(t.anchor(975, 548), t.anchor(975, 702), 'bottom', 'top', { ...rflow, routing: 'straight' });
  t.link(t.anchor(1068, YM), t.anchor(1068, 702), 'bottom', 'top', { ...rflow, routing: 'straight' });
  t.link(t.anchor(1340, 428), t.anchor(1340, 702), 'bottom', 'top', { ...rflow, routing: 'straight' });
  t.link(rec, op1, 'left', 'bottom', rflow);
  t.link(rec, op2, 'left', 'bottom', rflow);
  return t.done();
}

/** Lin et al. 2023 (Science 379:1123, doi:10.1126/science.ade2574): ESM-2 (pre-training MLM) e ESMFold (Fig. 2A). */
function esm() {
  const t = new Builder();
  const YA = 80, YB = 360;
  heading(t, 'a   ESM-2: masked language modeling', 0, 0);
  const ms = ill(t, 'gen-seq', 'MKT?YIA?QRQIS', 'Masked sequence', 100, YA, 200, 22);
  const lm = t.add({ shape: 'stack', count: 4, label: 'ESM-2', sublabel: 'Transformer\n(8M–15B params)', ...C(330, YA, 120, 84), fontSize: 13, bold: true, subSize: 10, strokeWidth: 1.2, ...PURPLE });
  const pr = ill(t, 'gen-seq', 'MKTaYIAkQRQIS', 'Predicted residues', 560, YA, 200, 22);
  const loss = block(t, 'Masked LM loss', 810, YA, 200, 56, { fill: '#FAFAFB', stroke: '#B8BEC8' }, {
    bold: true,
    fontSize: 11,
    sublabel: '$\\mathcal{L}_{\\mathrm{MLM}} = -\\sum_{i \\in M} \\log p(x_i | x_{/M})$',
    subSize: 12,
  });
  t.chain([ms, lm, pr, loss]);
  const att = t.add({ shape: 'heatmap', spec: '8x8', label: 'Attention maps', ...C(330, YA + 130, 64, 64), ...ICON, fontSize: 10, strokeWidth: 1.2, ...PURPLE });
  const lr = step(t, 'Logistic regression', '', 480, YA + 130, 130, 40, YELLOW);
  const ct = ill(t, 'gen-contact', 'contact blues', 'Predicted contacts', 630, YA + 130, 72, 72, { count: 36, stroke: SOFT });
  t.link(lm, att, 'bottom', 'top');
  t.chain([att, lr, ct]);
  heading(t, 'b   ESMFold: structure from a single sequence', 0, YB - 80);
  const sq = ill(t, 'gen-seq', 'MKTAYIAKQRQIS', 'Sequence', 100, YB, 200, 22);
  const lm2 = block(t, 'ESM-2', 280, YB, 100, 64, PURPLE, { bold: true, fontSize: 13, sublabel: 'language model', subSize: 10 });
  t.add({ shape: 'snowflake', ...C(326, YB - 33, 16, 16), fill: 'none', stroke: '#3B82C4' });
  const s = ill(t, 'gen-msa', 'heat', 'Sequence repr. (embeddings)', 420, YB - 46, 84, 16, { count: 1, fill: '#FFE6CC', stroke: '#E07B39', fontSize: 10 });
  const z = ill(t, 'gen-contact', 'distance blues', 'Pair repr. (attention)', 420, YB + 42, 52, 52, { count: 20, stroke: '#6C8EBF', fontSize: 10 });
  const trunk = block(t, 'Folding trunk', 580, YB, 140, 70, BLUE, { bold: true, fontSize: 12, sublabel: '48 blocks', subSize: 10 });
  const sm = block(t, 'Structure module', 770, YB, 140, 70, GREEN, { bold: true, fontSize: 12, sublabel: '8 blocks', subSize: 10 });
  const out = ill(t, 'gen-ribbon', 'fold plddt', 'Predicted structure (pLDDT)', 950, YB, 120, 112, { count: 1 });
  t.link(sq, lm2);
  t.link(lm2, s, 'right', 'left');
  t.link(lm2, z, 'right', 'left');
  t.link(s, trunk, 'right', 'left');
  t.link(z, trunk, 'right', 'left');
  t.chain([trunk, sm, out]);
  t.link(sm, trunk, 'bottom', 'bottom', { ...below('Recycling ($\\times 3$)'), dashed: true, color: '#7A808A', offset: 10 });
  return t.done();
}

/** Watson et al. 2023 (Nature 620:1089, doi:10.1038/s41586-023-06415-8, Fig. 1a) e Dauparas et al. 2022 (Science 378:49, doi:10.1126/science.add2187, Fig. 1A). */
function proteinDesign() {
  const t = new Builder();
  const Y = 110, Y2 = 400;
  const PINK = { fill: '#F3C5D3', stroke: '#B05C7A' };
  heading(t, 'a   RFdiffusion: backbone generation by denoising', 0, -50, 420);
  const xT = ill(t, 'gen-ribbon', 'cloud', '$X_T \\sim \\mathcal{N}(0, I)$', 60, Y, 100, 100, { count: 1, fontSize: 12 });
  const xt = ill(t, 'gen-ribbon', 'noisy', '$X_t$', 215, Y, 100, 100, { count: 1, fontSize: 12 });
  t.link(xT, xt, 'right', 'left', { ...above('$\\cdots$'), fontSize: 14 });
  t.group('Single RFdiffusion step', 285, Y - 85, 470, 205, { textColor: MUTED });
  const rf = block(t, 'RF', 350, Y + 5, 70, 90, PINK, { fontSize: 14, bold: true, sublabel: 'RoseTTAFold', subSize: 9 });
  const x0h = ill(t, 'gen-ribbon', 'fold mono', '$\\hat{X}_0$', 480, Y + 5, 96, 96, { count: 1, fontSize: 12, ...PINK });
  const interp = block(t, 'interp$(X_t, \\hat{X}_0) + \\varepsilon$', 655, Y + 5, 160, 40, PINK, { fontSize: 12 });
  const xt1 = ill(t, 'gen-ribbon', 'partial', '$X_{t-1}$', 840, Y, 96, 96, { count: 1, fontSize: 12 });
  const x0 = ill(t, 'gen-ribbon', 'fold rainbow', 'Designed backbone $X_0$', 1010, Y, 110, 110, { count: 1, fontSize: 11 });
  t.chain([xt, rf, x0h, interp, xt1]);
  t.link(xt1, x0, 'right', 'left', { ...above('$\\cdots$'), fontSize: 14 });
  t.link(t.anchor(480, Y + 78), rf, 'bottom', 'bottom', { ...below('Self-conditioning'), dashed: true, color: '#7A80B0' });
  const cond = t.add({ shape: 'pill', label: 'Conditioning: motif · target · symmetry', ...C(350, Y - 125, 240, 26), fontSize: 10, strokeWidth: 1.2, ...WHITE, dashed: true });
  t.link(cond, rf, 'bottom', 'top', { dashed: true, color: '#7A808A' });
  heading(t, 'b   ProteinMPNN: sequence design for the backbone', 0, Y2 - 115, 420);
  const bb = ill(t, 'gen-ribbon', 'fold mono', 'Backbone (N, C$\\alpha$, C, O)', 75, Y2, 110, 110, { count: 1, fill: '#E5E7EB', stroke: '#6B7280' });
  const knn = t.add({ shape: 'graph', label: 'k-NN residue graph', ...C(230, Y2, 74, 64), ...ICON, fontSize: 10, strokeWidth: 1.2, ...GRAY });
  panel(t, 'ProteinMPNN', 300, Y2 - 82, 420, 148, '#EAF2FB', '#6C8EBF', { textColor: '#2C4A8A', bold: true });
  const enc = step(t, 'Backbone encoder', '3 MPNN layers\n(nodes + edges)', 410, Y2, 160, 64, WHITE);
  const dec = step(t, 'Sequence decoder', 'random-order\nautoregressive', 610, Y2, 160, 64, WHITE);
  const sq = ill(t, 'gen-seq', 'MSEELLKKAEELAKR', 'Designed sequence', 850, Y2, 180, 20);
  const fold = step(t, 'Fold check', 'AlphaFold2: pLDDT, RMSD', 1035, Y2, 130, 56, GREEN);
  const fin = ill(t, 'gen-ribbon', 'fold plddt', 'Validated design', 1180, Y2, 100, 100, { count: 1 });
  t.link(t.anchor(1010, Y + 80), bb, 'bottom', 'top', above('backbone'));
  t.chain([bb, knn, enc, dec, sq, fold, fin]);
  return t.done();
}

// ======================================================================
// Genomica regolatoria e modelli di linguaggio del DNA
// ======================================================================

/** Avsec et al. 2021 (Nature Methods 18:1196, doi:10.1038/s41592-021-01252-x), Fig. 1a: Enformer. */
function enformer() {
  const t = new Builder();
  const CX = 220;
  t.text('Input: DNA sequence', CX - 100, 0, 200, 20, { fontSize: 12 });
  // campo recettivo: Enformer (100 kb) e Basenji2 (20 kb)
  const blue = { fill: '#A9D3EF', stroke: '#3B8BC8' }, orange = { fill: '#F9C089', stroke: '#E08A2E' };
  const tri = t.add({ shape: 'triangle', direction: 'bottom', ...C(CX, 112, 420, 74), radius: 2, strokeWidth: 1.2, ...blue });
  t.add({ shape: 'triangle', direction: 'bottom', ...C(CX, 112, 84, 74), radius: 2, strokeWidth: 1.2, ...orange });
  t.link(t.anchor(CX - 212, 75), t.anchor(CX + 212, 75), 'right', 'left', { routing: 'straight', arrowEnd: false, color: '#333333', width: 1.6 });
  [-180, -128, -76, -30, 30, 76, 132, 184].forEach((dx) => t.add({ ...C(CX + dx, 75, 12, 8), radius: 1, strokeWidth: 0.8, fill: '#DDDDDD', stroke: '#777777' }));
  // sito di inizio della trascrizione al centro della finestra
  t.link(t.anchor(CX, 71), t.anchor(CX + 18, 60), 'top', 'left', { color: '#333333', width: 1.2 });
  const bar = (x1: number, y: number) => t.link(t.anchor(CX, y), t.anchor(x1, y), 'right', 'left', { routing: 'straight', arrowEnd: false, color: MUTED, width: 1 });
  bar(CX + 42, 52);
  bar(CX + 210, 34);
  note(t, '20 kb', CX + 21, 42, 40, 14, { fontSize: 9 });
  note(t, '100 kb', CX + 126, 24, 50, 14, { fontSize: 9 });
  t.text('Enformer', 0, 140, 70, 16, { fontSize: 11, textColor: '#2A6FA8', align: 'left' });
  t.text('Basenji2', 360, 140, 70, 16, { fontSize: 11, textColor: '#C46F12', align: 'left' });
  const conv = panel(t, 'Conv. layers (7×)', CX - 150, 168, 300, 78, '#FFFFFF', '#555555');
  t.add({ shape: 'stack', count: 3, ...C(CX, 214, 40, 34), strokeWidth: 1, ...BLUE });
  const tr = panel(t, 'Transformer layers (11×)', CX - 150, 270, 300, 136, '#FFFFFF', '#555555');
  t.add({ shape: 'bipartite', count: 7, ...C(CX - 14, 345, 220, 80), strokeWidth: 1.2, fill: '#BFE0F4', stroke: '#2E86C1' });
  t.text('Key', CX + 100, 312, 40, 16, { fontSize: 10, align: 'left' });
  t.text('Query', CX + 100, 370, 40, 16, { fontSize: 10, align: 'left' });
  const heads = panel(t, 'Organism specific heads', CX - 150, 430, 300, 92, '#FFFFFF', '#555555');
  block(t, 'Human\n5,313 tracks', CX - 70, 486, 110, 40, { fill: '#FFFFFF', stroke: '#2E86C1' }, { fontSize: 11, strokeWidth: 1.6 });
  block(t, 'Mouse\n1,643 tracks', CX + 70, 486, 110, 40, { fill: '#FFFFFF', stroke: '#3E9E5A' }, { fontSize: 11, strokeWidth: 1.6 });
  t.text('Output: genomic tracks', 0, 540, 160, 18, { fontSize: 12, align: 'left' });
  ill(t, 'gen-tracks', 'highlight mono', '', CX, 620, 420, 110, { count: 4, stroke: '#2F6FB2' });
  t.link(tri, conv, 'bottom', 'top');
  t.link(conv, tr, 'bottom', 'top');
  t.link(tr, heads, 'bottom', 'top');
  t.link(heads, t.anchor(CX + 2, 563), 'bottom', 'top');
  return t.done();
}

/** Zhou & Troyanskaya 2015 (Nature Methods 12:931, doi:10.1038/nmeth.3547), Fig. 1: DeepSEA. */
function deepsea() {
  const t = new Builder();
  const X0 = 230, DX = 33;
  const colX = (i: number) => X0 + i * DX;
  const left = (s: string, y: number, h = 40) => t.text(s, 0, y - h / 2, 160, h, { fontSize: 10, align: 'left', textColor: '#333333' });
  const fv = step(t, 'Functional-variant prediction', 'boosted classifier', 378, 30, 240, 46, TEAL);
  left('Output:\nvariant functionality\nprediction', 30, 44);
  // effetto previsto: log-rapporto fra i due alleli
  note(t, 'log(allele T / allele A)', 330, 82, 160, 16, { fontSize: 10, textColor: '#333333' });
  t.link(t.anchor(X0 - 14, 170), t.anchor(X0 + 9 * DX + 14, 170), 'right', 'left', { routing: 'straight', arrowEnd: false, color: '#333333', width: 1 });
  t.link(t.anchor(X0 - 14, 170), t.anchor(X0 - 14, 92), 'top', 'bottom', { routing: 'straight', arrowEnd: false, color: '#333333', width: 1 });
  [0, 1, 2, 3].forEach((v) => t.text(v.toFixed(1), X0 - 46, 170 - v * 22 - 7, 28, 14, { fontSize: 9, align: 'right' }));
  ([[1, 26], [2, 17], [5, 74]] as [number, number][]).forEach(([i, hgt]) => t.add({ ...C(colX(i), 170 - hgt / 2, 12, hgt), radius: 0, strokeWidth: 0.8, fill: '#333333', stroke: '#333333' }));
  left('Output:\npredicted chromatin\neffect', 135, 44);
  // profilo di cromatina previsto per i due alleli
  const groups: [string, number, number, string][] = [['DHS', 0, 3, '#E5484D'], ['TF binding', 3, 4, '#3B82C4'], ['Histone marks', 7, 3, '#E8913A']];
  groups.forEach(([name, i0, k]) => note(t, name, colX(i0) + ((k - 1) * DX) / 2, 222, 90, 16, { fontSize: 10, textColor: '#333333' }));
  const pT = [0.6, 0.45, 0.2, 0.1, 0.5, 0.75, 0.15, 0.3, 0.55, 0.35];
  const pA = [0.15, 0.3, 0.2, 0.1, 0.45, 0.25, 0.15, 0.25, 0.5, 0.3];
  [pT, pA].forEach((ps, r) => {
    ps.forEach((p, i) => {
      const col = groups.find(([, a, k]) => i >= a && i < a + k)![3];
      t.add({ shape: 'ellipse', ...C(colX(i), 250 + r * 32, 22, 22), strokeWidth: 2, stroke: col, fill: `#${Math.round(255 - 110 * p).toString(16).padStart(2, '0').repeat(3)}` });
    });
  });
  t.text('Allele T', 160, 242, 50, 16, { fontSize: 10, textColor: '#D7263D', align: 'right' });
  t.text('Allele A', 160, 274, 50, 16, { fontSize: 10, textColor: '#2F6FB2', align: 'right' });
  left('Output:\npredicted allele-\nspecific chromatin\nprofile', 266, 56);
  t.link(t.anchor(378, 212), t.anchor(378, 178), 'top', 'bottom', { ...above('Compare'), routing: 'straight' });
  t.link(t.anchor(378, 72), fv, 'top', 'bottom', above('Input'));
  // rete convoluzionale e dati di addestramento
  const net = block(t, 'Deep convolutional network\n(DeepSEA)', 378, 390, 300, 74, { fill: '#FFFFFF', stroke: '#333333' }, { align: 'left', radius: 12, fontSize: 12 });
  t.icon('cnn', '', 428, 368, 92, 44, ORANGE, { count: 3 });
  const train = block(t, 'Training data:\n\nENCODE,\nRoadmap Epigenomics\nchromatin profiles', 70, 390, 140, 92, { fill: '#FFFFFF', stroke: '#333333' }, { align: 'left', fontSize: 10, radius: 2 });
  t.link(train, net, 'right', 'left', { ...above('Train'), color: SOFT, width: 3 });
  t.link(net, t.anchor(378, 302), 'top', 'bottom', above('Predict'));
  ill(t, 'gen-seq', 'GCGTGGGTACGCTTAtTCGTCAAGCTT', '', 378, 500, 330, 16);
  ill(t, 'gen-seq', 'GCGTGGGTACGCTTAaTCGTCAAGCTT', '', 378, 520, 330, 16);
  note(t, 'Variant position', 378 - 165 + (15.5 * 330) / 27, 542, 100, 16, { fontSize: 10, textColor: '#333333' });
  left('Input:\ngenomic sequences\n(1,000 bp)', 510, 44);
  t.link(t.anchor(378, 491), net, 'top', 'bottom', above('Input'));
  return t.done();
}

/** Ji et al. 2021 (Bioinformatics 37:2112, doi:10.1093/bioinformatics/btab083), Fig. 1b: DNABERT. */
function dnabert() {
  const t = new Builder();
  const X0 = 130, P = 44, TW = 40, T = 12;
  const cx = (i: number) => X0 + i * P + TW / 2;
  const mid = X0 + (T * P - 4) / 2;
  const left = (s: string, y: number) => t.text(s, 0, y - 15, 118, 30, { fontSize: 10, align: 'right', textColor: '#333333' });
  const kmers = ['CLS', 'AGC', 'GCA', 'CAC', 'M', 'M', 'M', 'TTG', 'TGC', 'GCA', 'CAG', 'SEP'];
  const orig = ill(t, 'gen-seq', 'AGCACTTTGCAG', '', mid, 800, 240, 20);
  left('Original\nsequence', 800);
  const tok = ill(t, 'gen-kmer', 'AGCACTTTGCAG tokens cls', '', mid, 730, T * P - 4, 22, { count: 3, ...YELLOW });
  left('Input\nsequence', 730);
  const msk = ill(t, 'gen-kmer', 'AGCACTTTGCAG tokens cls mask', '', mid, 660, T * P - 4, 22, { count: 3, ...YELLOW });
  t.link(orig, tok, 'top', 'bottom', above('Tokenize'));
  t.link(tok, msk, 'top', 'bottom', { ...above('Mask (only in pre-training)'), dashed: true });
  const row = (y: number, lab: (i: number) => string, c: Color) => Array.from({ length: T }, (_, i) => t.box(lab(i), cx(i) - TW / 2, y - 11, TW, 22, c, { radius: 3, fontSize: 10 }));
  row(590, (i) => `$E_{\\mathrm{${kmers[i]}}}$`, GRAY);
  left('Token\nembedding', 590);
  t.text('$+$', mid - 10, 558, 20, 20, { fontSize: 14 });
  row(530, (i) => `$E_{${i}}$`, YELLOW);
  left('Positional\nembedding', 530);
  t.text('$=$', mid - 10, 498, 20, 20, { fontSize: 14 });
  row(470, (i) => `$I_{${i}}$`, GREEN);
  left('Input\nembedding', 470);
  t.link(msk, t.anchor(mid, 601), 'top', 'bottom', above('Feed to the embedding layer'));
  // blocco encoder del Transformer
  const bx = mid;
  t.group('', bx - 130, 174, 260, 256, { dashed: false, fill: '#F1EEF6', stroke: '#9C8FB8', radius: 14 });
  t.text('$\\times 12$', bx + 140, 304, 40, 22, { fontSize: 15 });
  const mhsa = t.box('Multi-Head\nSelf-Attention', bx - 80, 368, 160, 40, ORANGE, { fontSize: 11 });
  const a1 = t.op('+', bx - 13, 328);
  const n1 = t.box('LayerNorm', bx - 80, 296, 160, 22, YELLOW, { fontSize: 10 });
  const ff = t.box('Feed Forward', bx - 80, 252, 160, 30, BLUE, { fontSize: 11 });
  const a2 = t.op('+', bx - 13, 218);
  const n2 = t.box('LayerNorm', bx - 80, 186, 160, 22, YELLOW, { fontSize: 10 });
  t.link(t.anchor(mid, 459), mhsa, 'top', 'bottom', { routing: 'straight' });
  t.chain([mhsa, a1, n1, ff, a2, n2], 'up');
  // connessioni residue attorno ai sottoblocchi
  t.link(t.anchor(bx - 0.5, 420), a1, 'left', 'left', { offset: -67 });
  t.link(t.anchor(bx - 0.5, 290), a2, 'left', 'left', { offset: -67 });
  // ultimo stato nascosto e classificatori
  const outs = row(130, (i) => `$O_{${i === 0 ? '\\mathrm{CLS}' : i === T - 1 ? '\\mathrm{SEP}' : i}}$`, RED);
  left('Last hidden\nstate', 130);
  t.link(n2, t.anchor(mid, 141), 'top', 'bottom', { routing: 'straight' });
  const sc = t.box('Classification\nlayer', cx(0) - 46, 34, 92, 40, PURPLE, { fontSize: 10 });
  const tc = t.box('Classification\nlayer', cx(5) - 46, 34, 92, 40, PURPLE, { fontSize: 10 });
  t.link(outs[0], sc, 'top', 'bottom');
  [4, 5, 6].forEach((i) => t.link(outs[i], tc, 'top', 'bottom'));
  note(t, 'Sentence-level classifier:\nresult for the original sequence', cx(0) - 6, 0, 210, 30, { fontSize: 10, textColor: '#333333' });
  note(t, 'Token-level classifier:\nprediction of each masked k-mer', cx(5) + 40, 0, 210, 30, { fontSize: 10, textColor: '#333333' });
  return t.done();
}

// ======================================================================
// Omica spaziale, multi-omica, modelli fondazionali single-cell
// ======================================================================

/** Trascrittomica spaziale con array a codici a barre (Ståhl et al. 2016, Science 353:78, doi:10.1126/science.aaf2403; 10x Visium). */
function spatial() {
  const t = new Builder();
  const Y = 120, Y2 = 375;
  const slide = ill(t, 'gen-spatial', 'tissue', 'Tissue section on\nbarcoded array', 70, Y, 130, 120, { count: 14 });
  // sonda di cattura di uno spot, ancorata al vetrino
  const pr = panel(t, 'Capture probe (one spot)', 180, Y - 98, 230, 196, '#FAFAFB', '#C9CED6');
  const layers: [string, Color][] = [['mRNA  (poly-A tail)', RED], ['poly(dT)VN', GREEN], ['UMI', YELLOW], ['Spatial barcode', ORANGE], ['Sequencing handle', BLUE], ['Cleavage site', GRAY]];
  layers.forEach(([s, c], i) => t.box(s, 230, Y - 62 + i * 21, 130, 18, c, { radius: 2, fontSize: 9 }));
  t.box('', 215, Y + 66, 160, 9, { fill: '#C9D6E3', stroke: '#8EA4BA' }, { radius: 1 });
  note(t, 'Glass slide', 295, Y + 85, 80, 14, { fontSize: 9 });
  t.link(slide, pr, 'right', 'left', { ...thin, label: 'zoom', labelPos: 'above', fontSize: 9 });
  const rt = step(t, 'Permeabilization', 'in situ reverse\ntranscription', 520, Y, 130, 60, PURPLE);
  const lib = ill(t, 'gen-lab', 'tube', 'cDNA library', 640, Y, 30, 52, GRAY);
  const seq = ill(t, 'gen-lab', 'sequencer', 'Sequencing', 750, Y, 74, 60, GRAY);
  const map = step(t, 'Barcode $\\to$ $(x, y)$', 'reads assigned to spots', 910, Y, 160, 56, TEAL);
  t.chain([pr, rt, lib, seq, map]);
  const ex = ill(t, 'gen-spatial', 'gene', 'Gene expression map', 340, Y2, 120, 110, { count: 14 });
  const dom = ill(t, 'gen-spatial', 'clusters', 'Spatial domains', 520, Y2, 120, 110, { count: 14 });
  const mat = t.add({ shape: 'heatmap', spec: '9x9', label: 'Spot × gene matrix', ...C(700, Y2 - 10, 90, 90), ...ICON, fontSize: 11, strokeWidth: 1.2, fill: '#E1D5E7', stroke: '#7B52A6' });
  t.link(map, ex, 'bottom', 'top');
  t.link(map, dom, 'bottom', 'top');
  t.link(map, mat, 'bottom', 'top');
  return t.done();
}

/** Argelaguet et al. 2018 (Mol. Syst. Biol. 14:e8124, doi:10.15252/msb.20178124), Fig. 1: MOFA. */
function mofa() {
  const t = new Builder();
  heading(t, 'a   Multi-Omics Factor Analysis', 0, 0);
  [RED, GREEN, BLUE].forEach((c, i) => t.icon('user', '', 6 + i * 16, 222 - (i % 2) * 6, 26, 32, c));
  const ppl = t.anchor(66, 238);
  const rows: [number, string, string, string][] = [[100, 'gen-helix', '#B2182B', '1'], [238, 'gen-hairpin', '#2E8B57', '2'], [400, 'gen-ribbon', '#3B4A9C', 'm']];
  const assays = ['Assay 1 (DNA)', 'Assay 2 (RNA)', 'Assay $m$ (protein)'];
  rows.forEach(([y, shape, col, k], r) => {
    const icon =
      shape === 'gen-helix' ? ill(t, shape, '', assays[r], 170, y, 64, 26, { count: 2, stroke: '#2F6FB2', fontSize: 10 })
        : shape === 'gen-hairpin' ? ill(t, shape, '', assays[r], 170, y, 64, 30, { count: 5, fontSize: 10 })
          : ill(t, shape, 'fold rainbow', assays[r], 170, y, 50, 50, { count: 2, fontSize: 10 });
    t.link(ppl, icon, 'right', 'left');
    t.text(`$\\mathbf{Y}^{${k}}$`, 214, y - 14, 46, 28, { fontSize: 18 });
    t.add({ shape: 'heatmap', spec: `${10 + r}x12`, ...C(320, y, 120, 100), strokeWidth: 1.2, fill: '#FFFFFF', stroke: col });
    t.text('$\\approx$', 386, y - 12, 24, 24, { fontSize: 18 });
    t.add({ shape: 'heatmap', spec: `${10 + r}x4`, ...C(440, y, 44, 100), strokeWidth: 1.2, fill: '#FFFFFF', stroke: '#E07B39' });
    t.text(`$\\mathbf{W}^{${k}}$`, 466, y - 62, 46, 22, { fontSize: 14 });
  });
  t.text('·\n·\n·', 310, 300, 20, 40, { fontSize: 14 });
  t.text('Samples $\\to$', 260, 28, 100, 16, { fontSize: 10, align: 'left', textColor: MUTED });
  t.text('Features\n$\\downarrow$', 212, 140, 50, 30, { fontSize: 10, textColor: MUTED });
  t.text('$\\times$', 474, 226, 24, 24, { fontSize: 16 });
  t.add({ shape: 'heatmap', spec: '4x12', ...C(560, 238, 110, 44), strokeWidth: 1.2, fill: '#FFFFFF', stroke: '#555555' });
  t.text('$\\mathbf{Z}$', 545, 196, 30, 22, { fontSize: 16 });
  t.text('Factors $\\times$ samples', 505, 266, 110, 16, { fontSize: 10, textColor: MUTED });
  // b: analisi a valle
  heading(t, 'b   Downstream analyses', 660, 0);
  const B = 660;
  t.text('Variance decomposition by factor', B, 34, 260, 16, { fontSize: 11, bold: true, align: 'left' });
  t.add({ shape: 'heatmap', spec: '3x7', ...C(B + 140, 92, 200, 74), strokeWidth: 1, fill: '#FFFFFF', stroke: '#4B2E83', label: 'Factor', ...ICON, fontSize: 10 });
  ['1', '2', 'm'].forEach((k, i) => t.text(`$\\mathbf{Y}^{${k}}$`, B + 4, 58 + i * 24, 30, 20, { fontSize: 11 }));
  t.text('Annotation of factors', B, 160, 260, 16, { fontSize: 11, bold: true, align: 'left' });
  const sets: [string, number][] = [['Gene expression', 0.9], ['Cell cycle', 0.75], ['Ribosome assembly', 0.6], ['Splicing regulation', 0.45]];
  sets.forEach(([s, v], i) => {
    t.text(s, B, 180 + i * 20, 110, 16, { fontSize: 9, align: 'right' });
    t.add({ x: B + 118, y: 183 + i * 20, w: 120 * v, h: 10, radius: 1, strokeWidth: 1, ...PURPLE });
  });
  note(t, 'feature set enrichment ($-\\log_{10} p$)', B + 178, 266, 170, 14, { fontSize: 9 });
  t.text('Imputation of missing values', B, 292, 260, 16, { fontSize: 11, bold: true, align: 'left' });
  const g1 = t.add({ shape: 'grid', spec: '5x6', ...C(B + 50, 350, 72, 60), radius: 0, strokeWidth: 1, fill: '#FFF6C2', stroke: '#8E8A3A' });
  const g2 = t.add({ shape: 'heatmap', spec: '5x6', ...C(B + 190, 350, 72, 60), strokeWidth: 1, fill: '#FFFFFF', stroke: '#3B4A9C' });
  t.link(g1, g2);
  t.text('Inspection of factors', B, 400, 260, 16, { fontSize: 11, bold: true, align: 'left' });
  t.add({ shape: 'scatter', label: 'Factor 1 vs. factor 2', ...C(B + 120, 460, 110, 76), ...ICON, fontSize: 10, strokeWidth: 1, ...WHITE });
  return t.done();
}

/** Cui et al. 2024 (Nature Methods 21:1470, doi:10.1038/s41592-024-02201-0), Fig. 1a: scGPT. */
function scgpt() {
  const t = new Builder();
  const Y1 = 120, Y2 = 380;
  const EMB = { fill: '#F9B4A8', stroke: '#D9786A' };
  const TRF = { fill: '#3B7CC4', stroke: '#285A92' };
  const brand = (label: string, x: number, y: number, w: number, h: number, stroke: string) => panel(t, label, x, y, w, h, '#FFFFFF', stroke, { strokeWidth: 2, radius: 14, bold: true, fontSize: 12 });
  t.text('Pretrain', 0, Y1 - 10, 60, 20, { fontSize: 13, textColor: '#1F4E79', align: 'left' });
  t.text('Fine-tune', 0, Y2 - 10, 70, 20, { fontSize: 13, textColor: '#2E7D32', align: 'left' });
  const atlas = brand('Cell atlas', 80, 30, 200, 180, '#1F4E79');
  [[130, 90], [225, 90], [130, 160], [225, 160]].forEach(([x, y], i) => ill(t, 'gen-umap', 'clusters', '', x, y, 82, 58, { count: 5 + i }));
  const pre = brand('scGPT', 330, 30, 330, 180, '#1F4E79');
  const e1 = block(t, 'Input\nembedding', 405, Y1 + 4, 76, 108, EMB, { fontSize: 11 });
  const m1 = block(t, 'Masked-\nattention\ntransformer', 515, Y1 + 4, 92, 108, TRF, { fontSize: 11, textColor: '#FFFFFF' });
  t.text('$\\times N$', 495, Y1 + 62, 40, 18, { fontSize: 12, textColor: MUTED });
  const g1 = t.add({ shape: 'cycle', label: 'Generative\ntraining', ...C(620, Y1 + 4, 32, 32), fill: 'none', stroke: '#1F4E79', strokeWidth: 1.2, labelPos: 'above', fontSize: 10, textColor: '#1F4E79' });
  t.chain([e1, m1, g1]);
  t.link(atlas, pre);
  const nd = brand('New data', 80, 290, 200, 180, '#2E7D32');
  ill(t, 'gen-umap', 'clusters', '', 180, Y2 + 10, 150, 120, { count: 9 });
  const ft = brand('scGPT fine-tune', 330, 290, 330, 180, '#2E7D32');
  const e2 = block(t, 'Input\nembedding', 405, Y2 + 4, 76, 108, EMB, { fontSize: 11 });
  const m2 = block(t, 'Masked-\nattention\ntransformer', 515, Y2 + 4, 92, 108, TRF, { fontSize: 11, textColor: '#FFFFFF' });
  t.text('$\\times N$', 495, Y2 + 62, 40, 18, { fontSize: 12, textColor: MUTED });
  const g2 = t.add({ shape: 'cycle', label: 'Task-specific\nsupervision', ...C(620, Y2 + 4, 32, 32), fill: 'none', stroke: '#2E7D32', strokeWidth: 1.2, labelPos: 'above', fontSize: 10, textColor: '#2E7D32' });
  t.chain([e2, m2, g2]);
  t.link(nd, ft);
  t.link(pre, ft, 'bottom', 'top', above('pretrained weights'));
  // compiti a valle
  const ds = brand('Downstream tasks', 710, 30, 330, 440, '#2E7D32');
  t.link(ft, ds, 'right', 'left');
  const tile = (name: string, cx: number, cy: number) => t.add({ shape: 'pill', label: name, ...C(cx, cy, 140, 22), fontSize: 10, strokeWidth: 1.2, fill: '#1FA187', stroke: '#178A73', textColor: '#FFFFFF' });
  const cols = [795, 955], rowsY = [70, 210, 350];
  tile('Clustering', cols[0], rowsY[0]);
  ill(t, 'gen-umap', 'clusters', '', cols[0], rowsY[0] + 62, 110, 84, { count: 6 });
  tile('Batch correction', cols[1], rowsY[0]);
  ill(t, 'gen-umap', 'batch', '', cols[1], rowsY[0] + 62, 110, 84, { count: 6 });
  tile('Cell type annotation', cols[0], rowsY[1]);
  ill(t, 'gen-umap', 'clusters labels', '', cols[0], rowsY[1] + 62, 110, 84, { count: 5 });
  tile('Gene network inference', cols[1], rowsY[1]);
  t.add({ shape: 'graph', ...C(cols[1], rowsY[1] + 62, 90, 76), strokeWidth: 1.2, fill: '#E8D98C', stroke: '#8C7A1E' });
  tile('Multi-omic integration', cols[0], rowsY[2]);
  ill(t, 'gen-helix', '', 'DNA', cols[0] - 42, rowsY[2] + 56, 30, 62, { count: 2, stroke: '#2F6FB2', fontSize: 9 });
  ill(t, 'gen-hairpin', '', 'RNA', cols[0], rowsY[2] + 56, 28, 62, { count: 4, fontSize: 9 });
  ill(t, 'gen-ribbon', 'fold rainbow', 'Protein', cols[0] + 44, rowsY[2] + 56, 48, 62, { count: 2, fontSize: 9 });
  tile('Perturbation prediction', cols[1], rowsY[2]);
  t.add({ shape: 'barchart', count: 4, label: 'G1    G2    G3    G4', ...C(cols[1], rowsY[2] + 56, 100, 58), ...ICON, fontSize: 9, strokeWidth: 1, ...BLUE });
  return t.done();
}

export const GENOMICS_TEMPLATES: TemplateDef[] = [
  { id: 'gen-dogma', name: 'Dogma centrale', section: SEC, build: dogma },
  { id: 'gen-ngs', name: 'Pipeline NGS (varianti)', section: SEC, build: ngs },
  { id: 'gen-scrna', name: 'Analisi scRNA-seq', section: SEC, build: scrna },
  { id: 'gen-gwas', name: 'GWAS', section: SEC, build: gwas },
  { id: 'gen-crisprdesign', name: 'Progettazione guide CRISPR', section: SEC, build: crisprDesign },
  { id: 'gen-alphafold2', name: 'AlphaFold2 (Jumper 2021)', section: SEC, build: alphafold },
  { id: 'gen-esm', name: 'ESM-2 / ESMFold (Lin 2023)', section: SEC, build: esm },
  { id: 'gen-rfdiffusion', name: 'RFdiffusion + ProteinMPNN', section: SEC, build: proteinDesign },
  { id: 'gen-enformer', name: 'Enformer (Avsec 2021)', section: SEC, build: enformer },
  { id: 'gen-deepsea', name: 'DeepSEA (Zhou 2015)', section: SEC, build: deepsea },
  { id: 'gen-dnabert', name: 'DNABERT (Ji 2021)', section: SEC, build: dnabert },
  { id: 'gen-spatialtx', name: 'Trascrittomica spaziale', section: SEC, build: spatial },
  { id: 'gen-mofa', name: 'Multi-omica (MOFA, Argelaguet 2018)', section: SEC, build: mofa },
  { id: 'gen-scgpt', name: 'scGPT (Cui 2024)', section: SEC, build: scgpt },
];
