// npx tsx scripts/check-generated-assets.ts [cartella-anteprima]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import '../src/domains';
import { allPresets, emptyDoc, makeNode } from '../src/model';
import { shapeParts } from '../src/geometry';
import { getShape } from '../src/registry';
import { prepareGeneratedAssets, rasterSize, registerGeneratedAssets, withGeneratedAssetExport } from '../src/generated-assets';
import { buildSvg } from '../src/export/svg';
import { buildTikz, type TikzImage } from '../src/export/tikz';
import { readGeneratedAssetSources } from './read-generated-assets';
import approvedIcons from '../src/assets/generated/icons/prompts.json';
import assetDimensions from '../src/assets/generated/dimensions.json';

const sources = await readGeneratedAssetSources();
// Una categoria può contenere sia immagini sia forme vettoriali.
// L'inventario dei raster è definito dagli asset, non dalla categoria della palette.
const library = allPresets();
const presets = Object.keys(sources).map((id) => {
  const preset = library.find((p) => p.id === id);
  assert.ok(preset, `Immagine senza blocco corrispondente: ${id}`);
  return preset;
});
assert.equal(presets.length, 70, 'Inventario atteso: 60 asset precedenti e 10 icone schematiche approvate.');
const iconCategories: Record<string, string> = {
  'opt-camera': 'Ottica', 'opt-laser': 'Ottica', 'opt-objective': 'Ottica',
  'dlm-hospital': 'Icone bio', 'chem-pipette': 'Chimica', 'gen-sequencer': 'Genomica',
  'rob-humanoid': 'Robotica', 'rob-quadruped': 'Robotica', 'qc-fridge': 'Quantum computing',
  'pr-ped-schematic': 'Computer vision',
};
assert.deepEqual(approvedIcons.prompts.map((entry) => entry.id).sort(), Object.keys(iconCategories).sort());
for (const entry of approvedIcons.prompts) {
  const bytes = Buffer.from(sources[entry.id].split(',')[1], 'base64');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `${entry.id}: il PNG distribuito non è quello registrato in prompts.json.`);
  assert.ok(sources[entry.id].startsWith('data:image/png;'), `${entry.id}: le icone approvate restano PNG con trasparenza.`);
  assert.equal(library.find((preset) => preset.id === entry.id)?.category, iconCategories[entry.id], `${entry.id}: categoria semantica errata.`);
}
// Le immagini sono disegnate al più a ~200 px nei preset: 1024 px sul lato lungo bastano
// per la stampa a 300 dpi anche ingrandendo il blocco, senza appesantire l'app.
const MAX_SIDE = 1024;
assert.deepEqual(Object.keys(assetDimensions).sort(), Object.keys(sources).sort(), 'dimensions.json deve elencare esattamente gli asset presenti.');
for (const [id, source] of Object.entries(sources)) {
  const size = rasterSize(source);
  assert.ok(size, `${id}: header PNG/JPEG non leggibile.`);
  assert.deepEqual((assetDimensions as Record<string, { width: number; height: number }>)[id], size, `${id}: dimensioni usate dal caricamento locale non aggiornate.`);
  assert.ok(Math.max(size.width, size.height) <= MAX_SIDE, `${id}: ${size.width}×${size.height}, ridurre a ${MAX_SIDE} px sul lato lungo.`);
  // PNG solo se serve la trasparenza (tipo colore 4 o 6): le immagini opache pesano molto meno in JPEG.
  if (source.startsWith('data:image/png;')) assert.ok([4, 6].includes(Buffer.from(source.split(',')[1].slice(0, 36), 'base64')[25]), `${id}: PNG senza alpha, salvarlo in JPEG.`);
}
registerGeneratedAssets(sources);

const doc = emptyDoc();
doc.settings.background = 'white';
const hasImage = (n: ReturnType<typeof makeNode>) => shapeParts(n).some((p) => p.kind === 'image');
for (const [i, preset] of presets.entries()) {
  const node = makeNode({ ...preset.node, x: (i % 6) * 210, y: Math.floor(i / 6) * 230 + 25 });
  const images = shapeParts(node).filter((part) => part.kind === 'image');
  assert.equal(images.length, 1, `${preset.id}: il preset non usa l'immagine generata.`);
  assert.equal(images[0].href, sources[preset.id], `${preset.id}: immagine sbagliata.`);
  assert.ok(images[0].ratio > 0, `${preset.id}: proporzioni non valide.`);
  if (preset.category === 'Imaging medico' || getShape(node.shape)?.countLabel) {
    assert.equal(hasImage({ ...node, count: node.count + 1 }), false, `${preset.id}: la variante numerica deve restare parametrica.`);
  }
  if (preset.category !== 'Imaging medico' && node.shape !== 'sp-spectrogram') {
    assert.equal(hasImage({ ...node, stroke: '#123456' }), false, `${preset.id}: il colore personalizzato deve restare modificabile.`);
    assert.equal(images[0].fit, 'contain', `${preset.id}: icone/grafici non vanno ritagliati.`);
  }
  if (getShape(node.shape)?.directionLabel) {
    assert.equal(hasImage({ ...node, direction: node.direction === 'left' ? 'right' : 'left' }), false, `${preset.id}: altre direzioni devono restare parametriche.`);
  }
  assert.equal(hasImage({ ...node, spec: 'unsupported-variant' }), false, `${preset.id}: variante non supportata.`);
  doc.nodes.push(node);
}

const byId = (id: string) => makeNode(allPresets().find((p) => p.id === id)!.node);
for (const id of Object.keys(iconCategories)) {
  const node = { ...byId(id), label: `Native label ${id}`, sublabel: 'Editable subtitle' };
  assert.equal(hasImage(node), true, `${id}: cambiare l'etichetta deve conservare l'icona.`);
  const labeledSvg = buildSvg({ ...emptyDoc(), nodes: [node] }).svg;
  assert.ok(labeledSvg.includes(node.label) && labeledSvg.includes(node.sublabel), `${id}: etichetta e sottotitolo devono restare testo SVG.`);
}
for (const id of ['pr-ped', 'rob-quadruped-trot', 'rob-humanoid-wave', 'opt-diode', 'opt-hene']) {
  assert.equal(hasImage(byId(id)), false, `${id}: la variante originale deve restare parametrica.`);
}
assert.equal(hasImage(byId('mask')), false, 'La maschera della categoria Visione deve restare vettoriale.');
assert.equal(hasImage({ ...byId('scanseg'), spec: '' }), true, 'Compatibilità con le vecchie maschere mediche.');
const boxed = shapeParts({ ...byId('ctseg'), spec: 'box seg' });
assert.ok(boxed.some((p) => p.kind === 'image' && p.href === sources.ctseg), 'Segmentazione e ordine delle parole chiave.');
assert.ok(boxed.some((p) => p.kind === 'rect' && p.stroke === '#E5484D'), 'Bounding box modificabile sopra la TC.');

// Un SVG autonomo e gli allegati TikZ devono contenere tutti i raster.
const { svg } = buildSvg(doc);
assert.equal((svg.match(/<image\b/g) ?? []).length, presets.length);
assert.equal((svg.match(/href="data:image\/(png|jpeg);base64,/g) ?? []).length, presets.length);
assert.ok(svg.includes('preserveAspectRatio="xMidYMid meet"'));
const images: TikzImage[] = [];
const tikz = buildTikz(doc, { imageBase: 'generated-assets', images });
assert.equal(images.length, presets.length);
assert.equal((tikz.match(/\\includegraphics\[/g) ?? []).length, presets.length);
for (const image of images) {
  const ext = image.dataUrl.startsWith('data:image/png;base64,') ? 'png' : image.dataUrl.startsWith('data:image/jpeg;base64,') ? 'jpg' : null;
  assert.ok(ext && image.name.endsWith(`.${ext}`), `${image.name}: estensione dell'allegato TikZ diversa dal formato.`);
}
buildTikz(doc, { imageBase: 'generated-assets', images });
assert.equal(images.length, presets.length, 'I raster ripetuti devono condividere lo stesso allegato TikZ.');

const outArg = process.argv[2];
if (outArg) {
  const out = path.resolve(outArg);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'generated-assets.svg'), svg);
  await writeFile(path.join(out, 'generated-assets.tex'), [
    '\\documentclass{standalone}',
    '\\usepackage{tikz,amsmath,amssymb,graphicx}',
    '\\usetikzlibrary{arrows.meta}',
    '\\begin{document}', tikz, '\\end{document}',
  ].join('\n'));
  await Promise.all(images.map((image) => writeFile(path.join(out, image.name), Buffer.from(image.dataUrl.split(',')[1], 'base64'))));
  console.log(`Anteprime SVG/TikZ e allegati PNG/JPEG: ${out}`);
}
// L'app usa URL locali e carica il base64 solo per gli asset effettivamente esportati.
const lazyIds = ['sp-lowpass', 'dna', 'opt-camera', 'he'];
const urls = Object.fromEntries(lazyIds.map((id) => [id, `/generated/${id}.${sources[id].startsWith('data:image/png;') ? 'png' : 'jpg'}`]));
const dimensions = Object.fromEntries(lazyIds.map((id) => [id, rasterSize(sources[id])!]));
const loads = new Map<string, number>();
let releaseLoad!: () => void;
const loadingGate = new Promise<void>((resolve) => { releaseLoad = resolve; });
registerGeneratedAssets(urls, {
  dimensions,
  loaders: Object.fromEntries(lazyIds.map((id) => [id, async () => {
    loads.set(id, (loads.get(id) ?? 0) + 1);
    await loadingGate;
    return sources[id];
  }])),
});
const labeled = byId('sp-lowpass');
const unlabeled = { ...labeled, id: `${labeled.id}-no-labels`, spec: labeled.spec.replace(/\blabels\b/, '').trim() };
const lazyDoc = { ...emptyDoc(), nodes: [labeled, unlabeled, byId('opt-camera'), byId('he')] };
const runtimeImage = () => shapeParts(labeled).find((part) => part.kind === 'image')!;
assert.equal(runtimeImage().href, urls['sp-lowpass'], 'L\'editor deve usare l\'URL locale.');
assert.ok(shapeParts(labeled).some((part) => part.kind === 'text'), 'I nomi degli assi devono essere testo nativo.');
assert.ok(hasImage(unlabeled), 'Togliere i nomi degli assi deve conservare il PNG.');
assert.equal(shapeParts(unlabeled).some((part) => part.kind === 'text'), false, 'Il pulsante nomi assi deve nascondere il testo.');
assert.throws(() => buildSvg(lazyDoc), /Preparare le immagini/, 'Nessun URL esterno in un SVG esportato senza preparazione.');
assert.throws(() => buildTikz(lazyDoc), /Preparare le immagini/, 'Nessun allegato TikZ non preparato.');

const preparing = Promise.all([prepareGeneratedAssets(lazyDoc), prepareGeneratedAssets(lazyDoc)]);
assert.equal(loads.get('sp-lowpass'), 1, 'Export concorrenti e nodi duplicati devono condividere un caricamento.');
assert.equal(loads.get('opt-camera'), 1, 'Le icone approvate devono usare lo stesso caricamento su richiesta.');
assert.equal(loads.get('he'), 1, 'Le foto JPEG devono usare lo stesso caricamento su richiesta.');
assert.equal(loads.get('dna') ?? 0, 0, 'Gli asset non usati non devono essere caricati.');
releaseLoad();
await preparing;
await prepareGeneratedAssets(lazyDoc);
assert.equal(loads.get('sp-lowpass'), 1, 'La preparazione successiva deve riusare il PNG incorporato.');
const lazySvg = buildSvg(lazyDoc).svg;
assert.equal((lazySvg.match(/href="data:image\/png;base64,/g) ?? []).length, 3);
assert.equal((lazySvg.match(/href="data:image\/jpeg;base64,/g) ?? []).length, 1);
assert.equal(lazySvg.includes('href="/generated/'), false);
const lazyImages: TikzImage[] = [];
buildTikz(lazyDoc, { images: lazyImages });
assert.equal(lazyImages.length, 3);
assert.equal(lazyImages[0].dataUrl, sources['sp-lowpass']);
assert.equal(lazyImages[1].dataUrl, sources['opt-camera']);
assert.equal(lazyImages[2].dataUrl, sources.he);
assert.ok(lazyImages[2].name.endsWith('.jpg'), 'Le foto JPEG diventano allegati .jpg in TikZ.');
assert.equal(runtimeImage().href, urls['sp-lowpass'], 'L\'export non deve appesantire il renderer interattivo.');
assert.throws(() => withGeneratedAssetExport(lazyDoc, () => { throw new Error('render interrotto'); }), /render interrotto/);
assert.equal(runtimeImage().href, urls['sp-lowpass'], 'Ripristinare la modalità editor anche dopo un errore di export.');

console.log(`Verificate ${presets.length} immagini (PNG con trasparenza, JPEG opachi, al più ${MAX_SIDE} px): mapping, proporzioni, varianti, colori, direzioni, etichette, SVG autonomo e allegati TikZ.`);
console.log('Le 10 icone approvate corrispondono agli hash registrati e alle categorie; il pedone precedente resta disponibile.');
console.log('Verificati caricamento su richiesta, deduplicazione concorrente, isolamento editor/export e nomi assi modificabili.');
