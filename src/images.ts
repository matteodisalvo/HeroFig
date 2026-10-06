// Immagini importate dall'utente (foto, microscopia, TC…): lettura, ridimensionamento
// e conversione in data URL, così restano dentro il documento e negli export.

const MAX_SIDE = 1600;

interface ImportedImage {
  src: string;
  ratio: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Formato immagine non supportato.'));
    img.src = url;
  });
}

/** Vero se l'immagine ha pixel trasparenti (allora resta PNG, altrimenti JPEG più leggero). */
function hasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000)));
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] < 250) return true;
  return false;
}

/** Legge un file immagine e lo riduce a al più 1600 px sul lato lungo. */
export async function readImage(file: Blob): Promise<ImportedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Il file scelto non è un\'immagine.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const nw = img.naturalWidth || 800;
    const nh = img.naturalHeight || 600;
    // le immagini vettoriali si rasterizzano a risoluzione doppia
    const k = file.type === 'image/svg+xml' ? Math.min(2, MAX_SIDE / Math.max(nw, nh)) : Math.min(1, MAX_SIDE / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * k));
    const h = Math.max(1, Math.round(nh * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const src = file.type !== 'image/jpeg' && hasAlpha(ctx, w, h) ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
    return { src, ratio: w / h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Finestra di scelta di un file immagine (funziona sia nell'app sia nel browser). */
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff,image/svg+xml';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Contenuto binario di un data URL (per salvare le immagini accanto al .tex). */
export function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// scala di colori del latente, ciclica: prevalgono nero, viola e blu, poi azzurro e verde, con poco giallo e rosso
const LATENT_COLORS: [number, number, number][] = [
  [8, 6, 20],
  [58, 0, 170],
  [122, 0, 255],
  [20, 30, 255],
  [0, 40, 235],
  [0, 170, 255],
  [0, 225, 90],
  [40, 255, 60],
  [235, 235, 0],
  [255, 40, 20],
  [150, 0, 220],
  [0, 20, 130],
];
const LATENT_TURNS = 3.4; // quante volte la scala si ripete fra lo sfondo e il punto più diverso

/**
 * Aspetto «latente»: l'immagine ridotta a una griglia di pochi pixel a falsi colori, come si
 * disegna di solito la rappresentazione interna di un autoencoder o di un modello di diffusione.
 * È un effetto grafico sull'immagine di partenza, non il latente di un modello vero.
 */
export async function latentLook(src: string, cells = 32): Promise<ImportedImage> {
  const img = await loadImage(src);
  const small = document.createElement('canvas');
  small.width = cells;
  small.height = cells;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  // ritaglio quadrato al centro, poi riduzione: ogni cella è la media di una zona dell'immagine
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  sctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, cells, cells);
  const px = sctx.getImageData(0, 0, cells, cells);
  const d = px.data;
  // luminosità di ogni cella e valore più frequente (lo sfondo dell'immagine)
  const lum = new Float32Array(cells * cells);
  const hist = new Array<number>(32).fill(0);
  for (let i = 0; i < lum.length; i++) {
    lum[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
    hist[Math.min(31, lum[i] >> 3)]++;
  }
  const back = hist.indexOf(Math.max(...hist)) * 8 + 4;
  for (let i = 0; i < lum.length; i++) {
    // la distanza dallo sfondo «si riavvolge» lungo la scala di colori: le sfumature diventano anelli;
    // la differenza fra rosso e blu sposta un po' il punto di partenza, così lo sfondo non è piatto
    const shift = (d[i * 4] - d[i * 4 + 2]) / 255;
    const t = (((Math.abs(lum[i] - back) / 255) * LATENT_TURNS + shift * 0.35 + 0.08) % 1 + 1) % 1;
    const [r, g, b] = LATENT_COLORS[Math.min(LATENT_COLORS.length - 1, Math.floor(t * LATENT_COLORS.length))];
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  sctx.putImageData(px, 0, 0);
  // ingrandita senza sfumare, così i quadretti restano netti anche a stampa
  const out = document.createElement('canvas');
  out.width = cells * 16;
  out.height = cells * 16;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(small, 0, 0, out.width, out.height);
  return { src: out.toDataURL('image/png'), ratio: 1 };
}
