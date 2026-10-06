import { renderToStaticMarkup } from 'react-dom/server';
import { docBounds } from '../geometry';
import type { Doc } from '../model';
import { DiagramContent } from '../render/DiagramContent';
import { prepareGeneratedAssets, withGeneratedAssetExport } from '../generated-assets';

const PAD = 8;

interface SvgExport {
  svg: string;
  width: number;
  height: number;
}

export function buildSvg(doc: Doc): SvgExport {
  return withGeneratedAssetExport(doc, () => buildPreparedSvg(doc));
}

/** Id dei ritagli uguali a ogni export della stessa figura, diversi fra figure diverse messe nella stessa pagina HTML. */
function idPrefix(doc: Doc): string {
  const s = JSON.stringify(doc.nodes, (k, v) => (k === 'src' ? undefined : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return `hf${(h >>> 0).toString(36)}-`;
}

function buildPreparedSvg(doc: Doc): SvgExport {
  const b = docBounds(doc);
  const x = Math.floor(b.x - PAD);
  const y = Math.floor(b.y - PAD);
  const width = Math.ceil(b.x + b.w + PAD) - x;
  const height = Math.ceil(b.y + b.h + PAD) - y;
  const svg = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width={width} height={height} viewBox={`${x} ${y} ${width} ${height}`}>
      {doc.settings.background === 'white' && <rect x={x} y={y} width={width} height={height} fill="#FFFFFF" />}
      <DiagramContent doc={doc} idPrefix={idPrefix(doc)} />
    </svg>,
  );
  // xlink:href come in SVG 1.1: Illustrator, Inkscape 0.92 e le versioni di Office meno recenti ignorano href da solo
  return { svg: svg.replace(/(<image\b[^>]*?) href=/g, '$1 xlink:href='), width, height };
}

// limiti dei canvas di Chromium: oltre, toBlob non restituisce niente
const MAX_SIDE = 32767;
const MAX_AREA = 268435456;

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

/** Scrive nel PNG la sua risoluzione (chunk pHYs): in Word, PowerPoint o LaTeX esce grande quanto la figura, non 3 volte tanto. */
function withDpi(png: Uint8Array, dpi: number): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let i = 8; i + 8 <= png.length; i += 12 + view.getUint32(i)) {
    const type = String.fromCharCode(...png.subarray(i + 4, i + 8));
    if (type === 'pHYs') return png;
    if (type === 'IDAT') break;
  }
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const v = new DataView(chunk.buffer);
  v.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  v.setUint32(8, ppm);
  v.setUint32(12, ppm);
  chunk[16] = 1; // pixel per metro
  v.setUint32(17, crc32(chunk.subarray(4, 17)));
  // subito dopo l'intestazione: firma (8 byte) e chunk IHDR (25 byte)
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, 33));
  out.set(chunk, 33);
  out.set(png.subarray(33), 33 + chunk.length);
  return out;
}

export async function buildPng(doc: Doc, scale = 3): Promise<Uint8Array> {
  await prepareGeneratedAssets(doc);
  const { svg, width, height } = buildSvg(doc);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Rendering PNG non riuscito.'));
      img.src = url;
    });
    // una figura enorme esce alla risoluzione più alta che il canvas permette, invece di non uscire affatto
    const k = Math.min(scale, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_AREA / (width * height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * k));
    canvas.height = Math.max(1, Math.floor(height * k));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Rendering PNG non riuscito.');
    // 1 px della figura = 1/96 di pollice, come nell'export PDF
    return withDpi(new Uint8Array(await blob.arrayBuffer()), 96 * k);
  } finally {
    URL.revokeObjectURL(url);
  }
}
