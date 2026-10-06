// Esempio minimo di modulo di dominio (non caricato dall'app): mostra l'API.
// Provalo con: npx tsx scripts/preview.ts _example /tmp/anteprima-esempio
import { Builder } from '../builder';
import { poly, type Part } from '../draw';
import { COLORS } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';

const { BLUE, ORANGE } = COLORS;

registerShapes([
  {
    kind: 'ex-chevron',
    name: 'Chevron (esempio)',
    parts: (n): Part[] => [
      {
        kind: 'path',
        fill: n.fill,
        cmds: poly([
          [n.x, n.y],
          [n.x + n.w * 0.75, n.y],
          [n.x + n.w, n.y + n.h / 2],
          [n.x + n.w * 0.75, n.y + n.h],
          [n.x, n.y + n.h],
          [n.x + n.w * 0.25, n.y + n.h / 2],
        ]),
      },
    ],
  },
]);

registerPresets([{ id: 'ex-chevron', name: 'Chevron', category: 'Esempio', node: { shape: 'ex-chevron', label: 'Step', w: 100, h: 44, ...ORANGE } }]);

registerTemplates([
  {
    id: 'ex-pipeline',
    name: 'Pipeline (esempio)',
    section: 'Esempio',
    build: () => {
      const t = new Builder();
      const a = t.box('Dati', 0, 0, 90, 40, BLUE);
      const b = t.add({ shape: 'ex-chevron', label: 'Modello', x: 140, y: 0, w: 110, h: 40, ...ORANGE });
      const c = t.icon('barchart', '$\\hat{y}$', 300, -10, 70, 50, BLUE);
      t.chain([a, b, c]);
      return t.done();
    },
  },
]);
