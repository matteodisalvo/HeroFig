// Unione di due versioni della stessa figura, elemento per elemento (blocchi, frecce, commenti,
// impostazioni). Serve nelle cartelle condivise: se un'altra persona ha salvato mentre lavoravi,
// si tengono le modifiche di entrambi invece di sovrascrivere.
import type { Doc } from './model';

interface Item {
  id: string;
}

// i campi si confrontano in ordine alfabetico: lo stesso blocco scritto con le chiavi in un altro ordine
// (file letto dal disco, blocco creato da un'altra parte dell'app) non deve sembrare modificato
const sorted = (_: string, v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v;
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a, sorted) === JSON.stringify(b, sorted);

/** `conflicts` conta gli elementi cambiati da entrambi: lì vince `mine` se `mineWins`. */
function mergeList<T extends Item>(base: T[], mine: T[], theirs: T[], mineWins: boolean, count: { conflicts: number }): T[] {
  const b = new Map(base.map((x) => [x.id, x]));
  const t = new Map(theirs.map((x) => [x.id, x]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const m of mine) {
    seen.add(m.id);
    const bi = b.get(m.id), ti = t.get(m.id);
    const iChanged = !same(m, bi);
    const theyChanged = !same(ti, bi);
    if (!theyChanged) out.push(m);
    else if (!iChanged) {
      if (ti) out.push(ti); // se manca l'hanno eliminato
    } else {
      if (!same(m, ti)) count.conflicts++;
      if (mineWins || !ti) out.push(m);
      else out.push(ti);
    }
  }
  for (const ti of theirs) {
    if (seen.has(ti.id)) continue;
    const bi = b.get(ti.id);
    // nuovo per loro, oppure eliminato da me ma modificato da loro: si tiene
    if (!bi || !same(ti, bi)) out.push(ti);
  }
  return out;
}

export function merge3(base: Doc, mine: Doc, theirs: Doc, mineWins = true): { doc: Doc; conflicts: number } {
  const count = { conflicts: 0 };
  const settings = { ...mine.settings } as Record<string, unknown>;
  const bs = base.settings as unknown as Record<string, unknown>, ts = theirs.settings as unknown as Record<string, unknown>;
  for (const k of Object.keys(ts)) {
    const iChanged = !same(settings[k], bs[k]);
    if (!same(ts[k], bs[k]) && (!iChanged || !mineWins)) settings[k] = ts[k];
  }
  const comments = mergeList(base.comments ?? [], mine.comments ?? [], theirs.comments ?? [], mineWins, count);
  const nodes = mergeList(base.nodes, mine.nodes, theirs.nodes, mineWins, count);
  const ids = new Set(nodes.map((n) => n.id));
  // una freccia senza uno dei suoi blocchi (eliminato dall'altra persona) non può restare
  const edges = mergeList(base.edges, mine.edges, theirs.edges, mineWins, count).filter((e) => ids.has(e.from.node) && ids.has(e.to.node));
  const doc: Doc = { ...mine, nodes, edges, settings: settings as unknown as Doc['settings'] };
  if (comments.length) doc.comments = comments;
  else delete doc.comments;
  return { doc, conflicts: count.conflicts };
}
