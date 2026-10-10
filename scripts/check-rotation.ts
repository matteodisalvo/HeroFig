// node --import tsx scripts/check-rotation.ts
// Blocchi ruotati e forma «Linea»: la rotazione si conserva nel file, le frecce restano attaccate ai lati girati,
// le scritte restano dritte, l'ingombro e l'export TikZ seguono la rotazione.
import assert from 'node:assert/strict';
import { docBounds, edgeGeometry, labelBlocks, labelFrame, nodeBox, nodePort, rotatePoint, shapeParts, sidePort } from '../src/geometry';
import { makeEdge, makeNode, normalRotation, normalizeDoc, emptyDoc } from '../src/model';

assert.equal(normalRotation(370), 10);
assert.equal(normalRotation(-190), 170);
assert.equal(normalRotation(180), 180);
assert.equal(normalRotation(-180), 180);
assert.equal(normalRotation(Number.NaN), 0);
const saved = normalizeDoc({ nodes: [{ id: 'a', rotation: 450 }, { id: 'b', rotation: 'x' }, { id: 'c' }], edges: [] });
assert.equal(saved.nodes[0].rotation, 90);
assert.equal('rotation' in saved.nodes[1], false);
assert.equal('rotation' in saved.nodes[2], false);
console.log('✓ Rotazione fra -180° e 180°, conservata nel file; valori non validi tolti');

const n = makeNode({ id: 'r', x: 0, y: 0, w: 100, h: 40, rotation: 90 });
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);
// girato di 90° in senso orario, il lato destro guarda in basso
const right = nodePort(n, 'right');
close(right.x, 50);
close(right.y, 70);
const back = rotatePoint(right, n, -1);
close(back.x, 100);
close(back.y, 20);
const box = nodeBox(n);
close(box.w, 40);
close(box.h, 100);
console.log('✓ Porte e ingombro di un blocco ruotato');

// le scritte restano dritte: dentro, al centro del blocco; sopra, sopra il riquadro che lo contiene sul foglio
const inside = labelBlocks(labelFrame({ ...n, label: 'E' }))[0];
close(inside.x, 50);
close(inside.y, 20);
const above = labelBlocks(labelFrame({ ...n, label: 'E', labelPos: 'above' }))[0];
assert.ok(above.y < box.y, 'la scritta sopra sta sopra il blocco girato');
console.log('✓ Le scritte di un blocco ruotato restano dritte e leggibili');

// i lati delle frecce sono quelli del foglio: «destra» è la porta che sul foglio guarda a destra
const right2 = sidePort(n, 'right');
close(right2.x, 70);
close(right2.y, 20);
const below = makeNode({ id: 'b', x: 30, y: 200, w: 40, h: 40 });
const geom = edgeGeometry(makeEdge({ node: 'r', side: 'bottom' }, { node: 'b', side: 'top' }), new Map([[n.id, n], [below.id, below]]))!;
close(geom.pts[0].x, 50);
close(geom.pts[0].y, 70);
close(geom.pts.at(-1)!.y, 200);
assert.ok(geom.pts.every((p, i) => !i || p.x === geom.pts[i - 1].x || p.y === geom.pts[i - 1].y), 'il percorso resta a gomito');
console.log('✓ La freccia resta sul lato del foglio scelto e il percorso ortogonale resta a gomito');

const line = makeNode({ id: 'l', shape: 'line', x: 0, y: 0, w: 120, h: 20, fill: 'none' });
const parts = shapeParts(line);
assert.equal(parts.length, 1);
assert.equal(parts[0].kind, 'path');
close(nodePort(line, 'top').y, 10);
const doc = { ...emptyDoc(), nodes: [{ ...line, rotation: 90 }] };
close(docBounds(doc).w, 20 + 2 * line.strokeWidth / 2);
console.log('✓ Forma «Linea»: un tratto a metà altezza, porte sulla linea, ingombro ruotato');

const { buildTikz } = await import('../src/export/tikz');
const tex = buildTikz({ ...emptyDoc(), nodes: [makeNode({ id: 'q', x: 0, y: 0, w: 80, h: 40, rotation: 30, label: 'A' })] });
assert.match(tex, /\\begin\{scope\}\[rotate around=\{-30:\(\S+\)\}, transform shape\]/);
assert.equal((tex.match(/\\begin\{scope\}/g) ?? []).length, (tex.match(/\\end\{scope\}/g) ?? []).length);
assert.ok(tex.indexOf('{A}') > tex.lastIndexOf('\\end{scope}'), 'la scritta sta fuori dalla scope girata');
console.log('✓ TikZ: la forma ruotata in una scope girata, la scritta dritta fuori');
