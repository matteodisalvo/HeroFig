// Anteprima di un modulo di dominio, per controllarne forme, blocchi e modelli.
//
//   npx tsx scripts/preview.ts <modulo> <cartella-output>
//   es.: npx tsx scripts/preview.ts signal /tmp/anteprima-signal
//
// Scrive nella cartella:
//   presets.svg / presets.png   tutti i blocchi del modulo in una griglia (PNG interi con rsvg-convert)
//   <id-modello>.svg / .png     un file per ogni modello
//   check.tex / check.pdf       tutto in TikZ, compilato con pdflatex (se presente)
// e stampa gli errori trovati (forme sconosciute, id duplicati, errori LaTeX).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readGeneratedAssetSources } from './read-generated-assets';

const [domain, outArg] = process.argv.slice(2);
if (!domain || !outArg) {
  console.error('Uso: npx tsx scripts/preview.ts <modulo> <cartella-output>');
  process.exit(1);
}
const out = path.resolve(outArg);
mkdirSync(out, { recursive: true });

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { SHAPE_NAMES, emptyDoc, isContainer, makeNode } = await import(pathToFileURL(path.join(root, 'src/model.ts')).href);
const registry = await import(pathToFileURL(path.join(root, 'src/registry.ts')).href);
const { buildSvg } = await import(pathToFileURL(path.join(root, 'src/export/svg.tsx')).href);
const { buildTikz } = await import(pathToFileURL(path.join(root, 'src/export/tikz.ts')).href);
const { unionRect } = await import(pathToFileURL(path.join(root, 'src/geometry.ts')).href);
await import(pathToFileURL(path.join(root, 'src/domains', `${domain}.ts`)).href);
const { registerGeneratedAssets } = await import(pathToFileURL(path.join(root, 'src/generated-assets.ts')).href);
registerGeneratedAssets(await readGeneratedAssetSources());

const problems: string[] = [];
const shapes = registry.registeredShapes();
const presets = registry.registeredPresets();
const templates = registry.registeredTemplates();
const known = (k: string) => k in SHAPE_NAMES || !!registry.getShape(k);

for (const p of presets) if (p.node.shape && !known(p.node.shape)) problems.push(`blocco ${p.id}: forma sconosciuta "${p.node.shape}"`);

type AnyNode = { shape: string; x: number; y: number; w: number; h: number; id: string };
const order = (nodes: AnyNode[]) => [...nodes.filter(isContainer), ...nodes.filter((n) => !isContainer(n))];

/** PNG dell'SVG intero: rsvg-convert se c'è, altrimenti l'anteprima di macOS (ritaglia a quadrato). */
function rasterize(svgFile: string) {
  const png = svgFile.replace(/\.svg$/, '.png');
  try {
    execFileSync('rsvg-convert', ['-z', '2', '-b', 'white', '-o', png, svgFile], { stdio: 'ignore' });
    return;
  } catch {
    // rsvg-convert non installato
  }
  try {
    execFileSync('qlmanage', ['-t', '-s', '1400', '-o', out, svgFile], { stdio: 'ignore' });
  } catch {
    // qlmanage esiste solo su macOS: senza, restano gli SVG
  }
}

const texParts: string[] = [];
const tikzImages: { name: string; dataUrl: string }[] = [];

// griglia dei blocchi
if (presets.length) {
  const doc = emptyDoc();
  doc.settings.background = 'white';
  let x = 0;
  let y = 30;
  let rowH = 0;
  for (const p of presets) {
    const n = makeNode({ ...p.node, x, y });
    if (x > 0 && x + n.w > 900) {
      x = 0;
      y += rowH + 80;
      rowH = 0;
      n.x = x;
      n.y = y;
    }
    doc.nodes.push(n);
    x += n.w + 50;
    rowH = Math.max(rowH, n.h);
  }
  doc.nodes = order(doc.nodes);
  writeFileSync(path.join(out, 'presets.svg'), buildSvg(doc).svg);
  rasterize(path.join(out, 'presets.svg'));
  texParts.push(buildTikz(doc, { imageBase: 'preview', images: tikzImages }));
}

// modelli
for (const t of templates) {
  for (const n of t.build().nodes as AnyNode[]) if (!known(n.shape)) problems.push(`modello ${t.id}: forma sconosciuta "${n.shape}"`);
  const b = t.build();
  const doc = emptyDoc();
  doc.settings.background = 'white';
  doc.nodes = order(b.nodes);
  doc.edges = b.edges;
  const ids = new Set(b.nodes.map((n: AnyNode) => n.id));
  for (const e of b.edges) if (!ids.has(e.from.node) || !ids.has(e.to.node)) problems.push(`modello ${t.id}: connessione verso un blocco inesistente`);
  const r = unionRect(b.nodes);
  if (r.w > 1600 || r.h > 1200) problems.push(`modello ${t.id}: molto grande (${Math.round(r.w)}×${Math.round(r.h)}), valuta di compattarlo`);
  writeFileSync(path.join(out, `${t.id}.svg`), buildSvg(doc).svg);
  rasterize(path.join(out, `${t.id}.svg`));
  texParts.push(buildTikz(doc, { imageBase: 'preview', images: tikzImages }));
}

// TikZ: un documento con tutto, una figura per pagina
const tex = [
  '\\documentclass{article}',
  '\\usepackage[paperwidth=60cm,paperheight=60cm,margin=1cm]{geometry}',
  '\\usepackage{tikz,amsmath,amssymb,graphicx}',
  '\\usetikzlibrary{arrows.meta}',
  '\\pagestyle{empty}',
  '\\begin{document}',
  ...texParts.map((t) => `\\noindent\n${t}\n\\clearpage`),
  '\\end{document}',
].join('\n');
writeFileSync(path.join(out, 'check.tex'), tex);
for (const image of tikzImages) {
  writeFileSync(path.join(out, image.name), Buffer.from(image.dataUrl.split(',')[1], 'base64'));
}
try {
  execFileSync('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', 'check.tex'], { cwd: out, stdio: 'pipe' });
} catch (err) {
  const log = String((err as { stdout?: Buffer }).stdout ?? '');
  const lines = log.split('\n').filter((l) => l.startsWith('!') || /^l\.\d+/.test(l));
  problems.push(`TikZ non compila: ${lines.slice(0, 4).join(' | ') || 'vedi check.log'}`);
}

console.log(`Modulo "${domain}": ${shapes.length} forme, ${presets.length} blocchi, ${templates.length} modelli`);
console.log(`Anteprime in ${out}`);
if (problems.length) {
  console.log('\nPROBLEMI:');
  for (const p of problems) console.log(' - ' + p);
  process.exitCode = 1;
} else {
  console.log('Nessun problema trovato.');
}
