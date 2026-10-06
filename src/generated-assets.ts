// PNG/JPEG locali nell'editor; data URL caricati su richiesta per export autonomi.
// I preset conservano le forme originali, così varianti e colori personalizzati
// continuano a usare il disegno parametrico quando non esiste un'immagine adatta.
import { allPresets, makeNode, type Doc, type NodeModel, type Preset } from './model';
import { getShape } from './registry';
import { framed } from './medical';
import type { Part } from './geometry';

interface GeneratedAsset {
  preset: Preset;
  defaults: NodeModel;
  src: string;
  ratio: number;
  framed: boolean;
  axisLabels: boolean;
  embeddedSrc?: string;
  loadDataUrl?: () => Promise<string>;
  loading?: Promise<string>;
}

const assetsByShape = new Map<string, GeneratedAsset[]>();
let exporting = false;

const specKey = (spec: string, medical: boolean, axisLabels: boolean) =>
  spec.toLowerCase().split(/\s+/).filter((word) => word && (!medical || word !== 'box') && (!axisLabels || word !== 'labels')).sort().join(' ');

interface GeneratedAssetOptions {
  dimensions?: Record<string, { width: number; height: number }>;
  loaders?: Record<string, () => Promise<string>>;
}

/**
 * Dimensioni di un data URL PNG (IHDR) o JPEG (marcatore SOF), lette dall'header
 * senza decodificare i pixel. Le foto opache sono JPEG, le immagini con trasparenza PNG.
 */
export function rasterSize(src: string): { width: number; height: number } | null {
  const prefix = /^data:image\/(png|jpeg);base64,/.exec(src);
  if (!prefix) return null;
  try {
    // 64 KB di base64 (multiplo di 4) bastano a raggiungere il SOF anche dopo tabelle e profili colore.
    const bytes = atob(src.slice(prefix[0].length, prefix[0].length + 65536));
    const u = (offset: number, size: number) => Array.from(bytes.slice(offset, offset + size)).reduce((n, c) => n * 256 + c.charCodeAt(0), 0);
    let width = 0, height = 0;
    if (prefix[1] === 'png') {
      if (bytes.slice(1, 4) !== 'PNG' || bytes.slice(12, 16) !== 'IHDR') return null;
      width = u(16, 4);
      height = u(20, 4);
    } else {
      if (u(0, 2) !== 0xffd8) return null;
      for (let i = 2; i + 9 < bytes.length && u(i, 1) === 0xff;) {
        const marker = u(i + 1, 1);
        // SOF0–SOF15, esclusi DHT (C4), JPG (C8) e DAC (CC)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          height = u(i + 5, 2);
          width = u(i + 7, 2);
          break;
        }
        i += 2 + u(i + 2, 2);
      }
    }
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  }
}

function rasterRatio(src: string): number | null {
  const size = rasterSize(src);
  return size && size.width / size.height;
}

/** Chiamare dopo la registrazione dei domini. Le chiavi sono gli id dei preset. */
export function registerGeneratedAssets(sources: Record<string, string>, options: GeneratedAssetOptions = {}): void {
  assetsByShape.clear();
  for (const preset of allPresets()) {
    // L'inventario è esplicito per id: raster e vettori possono convivere in
    // qualsiasi categoria, senza spostare i blocchi dalla loro disciplina.
    const src = sources[preset.id];
    if (!src) continue;
    const embeddedRatio = rasterRatio(src);
    const dimensions = options.dimensions?.[preset.id];
    const ratio = embeddedRatio ?? (dimensions && dimensions.width > 0 && dimensions.height > 0 ? dimensions.width / dimensions.height : null);
    if (!ratio || !Number.isFinite(ratio)) {
      console.warn(`[assets] Dimensioni immagine non valide: ${preset.id}`);
      continue;
    }
    const defaults = makeNode(preset.node);
    const asset: GeneratedAsset = {
      preset, defaults, src, ratio,
      framed: preset.category === 'Imaging medico' || defaults.shape === 'sp-spectrogram',
      axisLabels: preset.category === 'Segnali' && /\blabels\b/i.test(defaults.spec),
      embeddedSrc: embeddedRatio ? src : undefined,
      loadDataUrl: options.loaders?.[preset.id],
    };
    const siblings = assetsByShape.get(defaults.shape) ?? [];
    siblings.push(asset);
    assetsByShape.set(defaults.shape, siblings);
  }
}

function matches(n: NodeModel, asset: GeneratedAsset): boolean {
  const { defaults: d, preset } = asset;
  const medical = preset.category === 'Imaging medico';
  // Il vecchio preset medico condivideva "mask" con la categoria Visione.
  const legacyMask = preset.id === 'scanseg' && !n.spec && n.label === 'Segmentation mask'
    && n.fill === '#F5F5F5' && n.stroke === '#666666';
  if (!legacyMask && specKey(n.spec, medical, asset.axisLabels) !== specKey(d.spec, medical, asset.axisLabels)) return false;
  if ((medical || getShape(n.shape)?.countLabel) && n.count !== d.count) return false;
  // Un PNG non segue i controlli direzionali: altre orientazioni usano la forma
  // parametrica, mantenendo corretti ingresso della camera e punta dell'obiettivo.
  if (getShape(n.shape)?.directionLabel && n.direction !== d.direction) return false;
  // I colori dentro un bitmap sono fissi; le personalizzazioni restano vettoriali.
  if (!asset.framed && (n.fill !== d.fill || n.stroke !== d.stroke || n.strokeWidth !== d.strokeWidth || n.dashed !== d.dashed)) return false;
  return true;
}

const assetForNode = (n: NodeModel) => assetsByShape.get(n.shape)?.find((candidate) => matches(n, candidate));
const assetsForDoc = (doc: Doc) => new Set(doc.nodes.map(assetForNode).filter((asset): asset is GeneratedAsset => !!asset));

/** Carica solo le immagini usate nel documento, una volta per asset; funziona anche offline in Electron. */
export async function prepareGeneratedAssets(doc: Doc): Promise<void> {
  await Promise.all([...assetsForDoc(doc)].map(async (asset) => {
    if (asset.embeddedSrc) return;
    if (!asset.loadDataUrl) throw new Error(`Immagine non disponibile per l'esportazione: ${asset.preset.name}.`);
    asset.loading ??= asset.loadDataUrl().then((src) => {
      if (!rasterRatio(src)) throw new Error(`Immagine non valida: ${asset.preset.name}.`);
      asset.embeddedSrc = src;
      return src;
    }).catch((error: unknown) => {
      asset.loading = undefined;
      throw error;
    });
    await asset.loading;
  }));
}

/** Il callback è sincrono: solo durante l'export il renderer usa i data URL preparati. */
export function withGeneratedAssetExport<T>(doc: Doc, render: () => T): T {
  for (const asset of assetsForDoc(doc)) {
    if (!asset.embeddedSrc) throw new Error(`Preparare le immagini prima dell'esportazione: ${asset.preset.name}.`);
  }
  const previous = exporting;
  exporting = true;
  try {
    return render();
  } finally {
    exporting = previous;
  }
}

/** null lascia procedere il renderer vettoriale preesistente. */
export function generatedAssetParts(n: NodeModel): Part[] | null {
  const asset = assetForNode(n);
  if (!asset) return null;
  const image = (x: number, y: number, w: number, h: number, fit: 'cover' | 'contain'): Part => ({
    kind: 'image', x, y, w, h, href: exporting ? asset.embeddedSrc! : asset.src, ratio: asset.ratio, fit, fill: 'none', stroke: 'none',
  });
  if (asset.framed) return framed(n, (b) => [image(b.x, b.y, b.w, b.h, 'cover')]);
  // I nomi degli assi restano testo modificabile e rispettano l'opzione "labels".
  // EEG e montaggi con "names" hanno già le proprie etichette nel PNG.
  const labels = asset.axisLabels && /\blabels\b/i.test(n.spec)
    ? getShape(n.shape)?.parts(n).filter((part) => part.kind === 'text') ?? []
    : [];
  return [image(n.x, n.y, n.w, n.h, 'contain'), ...labels];
}
