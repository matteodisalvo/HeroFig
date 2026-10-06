import { t as tr } from '../i18n';
import { useLayoutEffect, useRef, useState } from 'react';
import { run } from '../App';
import { align, distribute, type AlignMode } from '../actions';
import type { Rect } from '../geometry';
import { getState, setDoc } from '../store';
import { toast } from '../ui';
import { Icon, type IconName } from './Icon';

const ALIGN: [AlignMode, IconName, string][] = [
  ['left', 'alignLeft', 'Allinea a sinistra'],
  ['hcenter', 'alignHCenter', 'Centra in orizzontale'],
  ['right', 'alignRight', 'Allinea a destra'],
  ['top', 'alignTop', 'Allinea in alto'],
  ['vcenter', 'alignVCenter', 'Centra in verticale'],
  ['bottom', 'alignBottom', 'Allinea in basso'],
];

/** Dà a tutti i blocchi selezionati la larghezza (o l'altezza) del primo, mantenendone il centro. */
function matchSize(dim: 'w' | 'h') {
  const { doc, sel } = getState();
  const ref = doc.nodes.find((n) => n.id === sel.nodes[0]);
  if (!ref) return;
  const ids = new Set(sel.nodes);
  const pos = dim === 'w' ? 'x' : 'y';
  setDoc({
    ...doc,
    nodes: doc.nodes.map((n) => (ids.has(n.id) && n !== ref ? { ...n, [dim]: ref[dim], [pos]: n[pos] + (n[dim] - ref[dim]) / 2 } : n)),
  });
  toast(tr(dim === 'w' ? 'Stessa larghezza del primo blocco selezionato' : 'Stessa altezza del primo blocco selezionato'));
}

const GAP = 10;

/**
 * Barra flottante sopra una selezione di più blocchi: allinea, distribuisci,
 * uguaglia le dimensioni, raggruppa. `box` è in coordinate del foglio sullo schermo.
 */
const TOP = 74;

export function SelectionBar({ box, count, bounds }: { box: Rect; count: number; bounds: { w: number; h: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 36 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && (el.offsetWidth !== size.w || el.offsetHeight !== size.h)) setSize({ w: el.offsetWidth, h: el.offsetHeight });
  }, [count, size.w, size.h]);

  // la barra degli strumenti galleggia sopra il foglio: sotto di lei non si vedrebbe
  let top = box.y - size.h - GAP;
  if (top < TOP) top = box.y + box.h + GAP;
  top = Math.max(TOP, Math.min(top, bounds.h - size.h - 8));
  const left = Math.max(8, Math.min(box.x + box.w / 2 - size.w / 2, bounds.w - size.w - 8));
  const few = count < 3;

  return (
    <div className="selection-bar" ref={ref} style={{ left, top }} onPointerDown={(e) => e.stopPropagation()} role="toolbar" aria-label={tr("Disponi la selezione")}>
      <span className="selection-count" data-tip={tr("{count} blocchi selezionati", { count })}>
        {count}
      </span>
      {ALIGN.map(([mode, icon, tip]) => (
        <button key={mode} className="tool icon-only" data-tip={tr(tip)} aria-label={tr(tip)} onClick={() => align(mode)}>
          <Icon name={icon} />
        </button>
      ))}
      <span className="bar-sep" />
      <button className="tool icon-only" disabled={few} data-tip={tr(few ? 'Distribuisci: servono almeno 3 blocchi' : 'Spazia in modo uniforme in orizzontale')} aria-label={tr("Distribuisci in orizzontale")} onClick={() => distribute('x')}>
        <Icon name="distH" />
      </button>
      <button className="tool icon-only" disabled={few} data-tip={tr(few ? 'Distribuisci: servono almeno 3 blocchi' : 'Spazia in modo uniforme in verticale')} aria-label={tr("Distribuisci in verticale")} onClick={() => distribute('y')}>
        <Icon name="distV" />
      </button>
      <span className="bar-sep" />
      <button className="tool icon-only" data-tip={tr("Stessa larghezza del primo selezionato")} aria-label={tr("Stessa larghezza")} onClick={() => matchSize('w')}>
        <Icon name="matchW" />
      </button>
      <button className="tool icon-only" data-tip={tr("Stessa altezza del primo selezionato")} aria-label={tr("Stessa altezza")} onClick={() => matchSize('h')}>
        <Icon name="matchH" />
      </button>
      <span className="bar-sep" />
      <button className="tool icon-only" data-tip={tr("Raggruppa in un contenitore")} data-keys="⌘G" aria-label={tr("Raggruppa")} onClick={() => run('groupSelection')}>
        <Icon name="group" />
      </button>
      <button className="tool icon-only" data-tip={tr("Duplica")} data-keys="⌘D" aria-label={tr("Duplica")} onClick={() => run('duplicate')}>
        <Icon name="duplicate" />
      </button>
    </div>
  );
}
