// Figura collegata al paper: a ogni salvataggio il PDF e il TikZ finiscono nella cartella del paper,
// così nel documento LaTeX c'è sempre l'ultima versione. Il collegamento sta nel .hfig (settings.paperDir).
import { buildSvg } from './export/svg';
import { buildTikz, type TikzImage } from './export/tikz';
import { prepareGeneratedAssets } from './generated-assets';
import { dataUrlBytes } from './images';
import type { Doc } from './model';
import { paperScan, paperWrite } from './platform';

const fileBase = (path: string | null) => (path ? path.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, '') : '');

/** Nome dei file scritti nel paper: quello scelto, altrimenti quello del .hfig, ridotto a caratteri sicuri. */
export function paperName(doc: Doc, filePath: string | null): string {
  const raw = doc.settings.paperName || fileBase(filePath) || 'figura';
  return raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'figura';
}

const listeners = new Set<() => void>();
let synced: Doc | null = null;
let push: { time?: number; error?: string } = {};
/** Esito dell'ultimo invio a Overleaf (solo per le cartelle collegate a un progetto Overleaf con Git). */
export const lastPush = () => push;
/** L'ultima versione della figura scritta nel paper (anche se non ancora salvata nel .hfig). */
export const lastSynced = () => synced;
/** Avvisa quando i file nel paper sono stati riscritti (per aggiornare lo stato mostrato). */
export function onPaperSynced(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Scrive PDF e TikZ (con le eventuali immagini) nella cartella delle figure del paper collegato. */
export async function syncPaper(
  doc: Doc,
  filePath: string | null,
): Promise<{ ok: boolean; files?: string; error?: string; pushed?: boolean; pushError?: string }> {
  const dir = doc.settings.paperDir;
  if (!dir) return { ok: true };
  const name = paperName(doc, filePath);
  const images: TikzImage[] = [];
  let sub: string;
  let res: Awaited<ReturnType<typeof paperWrite>>;
  try {
    const scan = await paperScan(dir, filePath, name);
    if (!scan.ok) return { ok: false, error: scan.error };
    sub = scan.sub ?? '';
    // le icone e i segnali dipinti si caricano solo quando servono: senza, l'export si rifiuta di partire
    await prepareGeneratedAssets(doc);
    let tex = buildTikz(doc, { imageBase: name, images });
    // le immagini stanno accanto al .tex, ma LaTeX le cerca a partire dalla cartella del documento principale
    if (sub) for (const im of images) tex = tex.split(`{${im.name}}`).join(`{${sub}/${im.name}}`);
    const { svg, width, height } = buildSvg(doc);
    res = await paperWrite({
      dir, base: filePath, name, svg, width, height, tex,
      side: images.map((im) => ({ name: im.name, data: dataUrlBytes(im.dataUrl) })),
    });
  } catch (err) {
    // un'immagine che non si carica, la cartella che sparisce: si dice perché il paper non si è aggiornato, senza fermare il salvataggio
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (res.ok) synced = doc;
  if ('pushed' in res && res.pushed) push = { time: res.pushed };
  if ('pushError' in res && res.pushError) push = { ...push, error: res.pushError };
  listeners.forEach((l) => l());
  const where = ('sub' in res ? res.sub : undefined) ?? sub;
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    files: `${where ? where + '/' : ''}${name}.pdf`,
    pushed: 'pushed' in res && !!res.pushed,
    pushError: 'pushError' in res ? res.pushError : undefined,
  };
}
