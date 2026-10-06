// node --import tsx scripts/check-library.ts
// Controlla l'intera libreria senza avviare l'app o scrivere file: registrazione,
// geometria vettoriale, collegamenti ed export SVG/TikZ. I PNG generati hanno
// un controllo dedicato in check-generated-assets.ts.
import assert from 'node:assert/strict';
import { allPresets, emptyDoc, makeNode, SHAPE_NAMES, type Doc, type NodeModel } from '../src/model';
import { allTemplates } from '../src/templates';
import { registeredShapes } from '../src/registry';
import { docBounds, edgeGeometry, labelBlocks, shapeParts, type Part } from '../src/geometry';
import { buildSvg } from '../src/export/svg';
import { buildTikz } from '../src/export/tikz';

const problems: string[] = [];
const originalWarn = console.warn;
// Il registro conserva solo l'ultima forma con lo stesso nome: intercettare
// l'avviso durante il caricamento evita che una collisione resti invisibile.
console.warn = (...args: unknown[]) => {
  const message = args.map(String).join(' ');
  if (message.startsWith('[registry]')) problems.push(message);
  else originalWarn(...args);
};
try {
  await import('../src/domains/index');
} finally {
  console.warn = originalWarn;
}

const shapes = registeredShapes();
const presets = allPresets();
const templates = allTemplates();
const knownShapes = new Set([...Object.keys(SHAPE_NAMES), ...shapes.map((s) => s.kind)]);
let nodes = 0;
let edges = 0;
let parts = 0;

function check(name: string, run: () => void): void {
  try {
    run();
  } catch (error) {
    problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function unique(values: string[], what: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    assert.ok(value.trim(), `${what}: identificativo vuoto`);
    assert.ok(!seen.has(value), `${what}: identificativo duplicato "${value}"`);
    seen.add(value);
  }
}

function finite(value: unknown, path: string): void {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path}: numero non finito`);
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) finite(item, `${path}.${key}`);
  }
}

function validatePart(part: Part): void {
  finite(part, `primitiva ${part.kind}`);
  if (part.kind === 'rect' || part.kind === 'image') {
    assert.ok(part.w >= 0 && part.h >= 0, 'Primitiva con dimensioni negative');
  } else if (part.kind === 'ellipse') {
    assert.ok(part.rx >= 0 && part.ry >= 0, 'Ellisse con raggi negativi');
  }
  if (part.clip) assert.ok(part.clip.w >= 0 && part.clip.h >= 0, 'Ritaglio con dimensioni negative');
}

function validateNode(node: NodeModel): void {
  assert.ok(knownShapes.has(node.shape), `Forma sconosciuta "${node.shape}"`);
  finite(node, `blocco ${node.shape}`);
  assert.ok(node.w > 0 && node.h > 0, `Dimensioni non positive: ${node.shape}`);
  const geometry = shapeParts(node);
  assert.ok(geometry.length || node.shape === 'text', `Forma senza geometria: ${node.shape}`);
  for (const part of geometry) validatePart(part);
  finite(labelBlocks(node), `etichette ${node.shape}`);
  parts += geometry.length;
}

function validateDoc(doc: Doc): void {
  unique(doc.nodes.map((node) => node.id), 'Blocchi');
  unique(doc.edges.map((edge) => edge.id), 'Connessioni');
  for (const node of doc.nodes) validateNode(node);
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  for (const edge of doc.edges) {
    assert.ok(byId.has(edge.from.node) && byId.has(edge.to.node), `Connessione ${edge.id} verso un blocco inesistente`);
    finite(edge, `connessione ${edge.id}`);
    const geometry = edgeGeometry(edge, byId);
    assert.ok(geometry, `Connessione ${edge.id} senza geometria`);
    finite(geometry, `geometria connessione ${edge.id}`);
  }
  finite(docBounds(doc), 'Ingombro documento');
  const svg = buildSvg(doc);
  assert.ok(svg.width > 0 && svg.height > 0, 'SVG con dimensioni non positive');
  finite(svg.width, 'Larghezza SVG');
  finite(svg.height, 'Altezza SVG');
  assert.ok(svg.svg.startsWith('<svg'), 'Export SVG vuoto o non valido');
  assert.ok(buildTikz(doc).includes('\\begin{tikzpicture}'), 'Export TikZ vuoto o non valido');
  nodes += doc.nodes.length;
  edges += doc.edges.length;
}

check('Registro forme', () => unique(shapes.map((shape) => shape.kind), 'Forme'));
check('Registro blocchi', () => unique(presets.map((preset) => preset.id), 'Blocchi'));
check('Registro modelli', () => unique(templates.map((template) => template.id), 'Modelli'));

for (const preset of presets) {
  check(`Blocco ${preset.id}`, () => {
    assert.ok(preset.name.trim() && preset.category.trim(), 'Nome o categoria mancante');
    validateDoc({ ...emptyDoc(), nodes: [makeNode(preset.node)] });
  });
}
for (const template of templates) {
  check(`Modello ${template.id}`, () => {
    assert.ok(template.name.trim() && template.section.trim(), 'Nome o sezione mancante');
    const built = template.build();
    assert.ok(built.nodes.length, 'Modello senza blocchi');
    validateDoc({ ...emptyDoc(), ...built });
  });
}
// Anche le forme selezionabili dal pannello devono funzionare con i valori base,
// senza dipendere da proprietà presenti soltanto in un preset.
for (const shape of shapes) {
  check(`Forma ${shape.kind}`, () => validateNode(makeNode({ shape: shape.kind })));
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`${problems.length} problemi nella libreria.`);
  process.exitCode = 1;
} else {
  console.log(`Libreria verificata: ${presets.length} blocchi, ${templates.length} modelli, ${shapes.length} forme registrate.`);
  console.log(`${nodes} nodi, ${edges} connessioni e ${parts} primitive validi; export SVG e TikZ riusciti.`);
}
