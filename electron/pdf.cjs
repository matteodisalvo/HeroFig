const { BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

/**
 * Converte un SVG in un PDF vettoriale a pagina singola grande quanto il disegno,
 * stampandolo da una finestra nascosta.
 */
async function svgToPdf(svg, width, height) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: ${width}px ${height}px; margin: 0; }
html, body { margin: 0; padding: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
svg { display: block; }
</style></head><body>${svg}</body></html>`;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlsketch-'));
  const file = path.join(dir, 'export.html');
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  try {
    await fs.writeFile(file, html, 'utf8');
    await win.loadFile(file);
    return await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      pageSize: { width: width / 96, height: height / 96 },
    });
  } finally {
    win.destroy();
    await fs.rm(dir, { recursive: true, force: true });
  }
}

module.exports = { svgToPdf };
