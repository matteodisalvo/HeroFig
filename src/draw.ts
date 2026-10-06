// Funzioni di disegno condivise per chi crea nuove forme (src/domains/*).
// Tutte producono primitive `Part` (rect, ellipse, path con M/L/C/Z): l'export
// SVG, PDF, PNG e TikZ funziona automaticamente.
export { orient, parseGrid, parseLayers, poly, rng, roundPoly, shade, type ClipRect, type Cmd, type LabelLayout, type Part } from './geometry';
export { arc, mix } from './icons';
export { blob, framed, smooth, type Box, type Rand } from './medical';
