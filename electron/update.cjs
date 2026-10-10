// Aggiornamenti: all'avvio, e poi ogni tanto, l'app chiede a GitHub l'ultima versione pubblicata di HeroFig (una release
// con il tag v<versione>, che .github/workflows/release.yml costruisce e allega). Se è più nuova di questa, la pagina lo
// dice; «Aggiorna» scarica il file per questo computer nella cartella Download, lo verifica con lo sha256 che GitHub
// pubblica accanto a ogni file, e lo apre: su Windows parte l'installazione, sul Mac si apre il disco da cui trascinare
// l'app in Applicazioni (installarla da sola richiederebbe un'app firmata da Apple).
const path = require('node:path');
const { downloadFile } = require('./local-download.cjs');

const REPO = 'matteodisalvo/HeroFig';
const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;

/** I numeri di una versione come «v1.2.3» o «1.2.3»; null se non lo è. */
function parts(version) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? '').trim());
  return m ? m.slice(1).map(Number) : null;
}

/** `a` è una versione più nuova di `b`. */
function newer(a, b) {
  const x = parts(a);
  const y = parts(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

/** Il file della release per questo computer: il disco per Apple silicon o Intel, l'installer per Windows. */
function pickAsset(assets, platform, arch) {
  const ending = platform === 'darwin' ? `-macOS-${arch === 'arm64' ? 'arm64' : 'x64'}.dmg` : platform === 'win32' ? '-Windows-Setup.exe' : null;
  if (!ending || !Array.isArray(assets)) return null;
  const asset = assets.find((a) => typeof a?.name === 'string' && a.name.endsWith(ending));
  const sha256 = /^sha256:([0-9a-f]{64})$/.exec(asset?.digest ?? '')?.[1];
  const url = asset?.browser_download_url;
  // senza l'impronta pubblicata da GitHub il file non si apre: resta la pagina della release
  if (!asset || !sha256 || !Number.isSafeInteger(asset.size) || asset.size <= 0 || typeof url !== 'string' || !url.startsWith(`https://github.com/${REPO}/releases/download/`)) return null;
  return { name: path.basename(asset.name), size: asset.size, sha256, url };
}

/**
 * L'ultima versione pubblicata, se è più nuova di `current`: il numero, le novità, la pagina e il file per questo computer
 * (null se GitHub non ne ha uno adatto: allora resta la pagina). null se questa è già l'ultima.
 */
async function check({ fetch, current, platform, arch }) {
  const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const release = await res.json();
  if (!release || release.draft || release.prerelease || !newer(release.tag_name, current)) return null;
  const page = typeof release.html_url === 'string' && release.html_url.startsWith(`https://github.com/${REPO}/releases/`) ? release.html_url : `https://github.com/${REPO}/releases/latest`;
  return {
    version: String(release.tag_name).replace(/^v/, ''),
    notes: typeof release.body === 'string' ? release.body.slice(0, 4000) : '',
    page,
    asset: pickAsset(release.assets, platform, arch),
  };
}

/** Scarica (o riprende) il file in `dir` e lo verifica; restituisce il percorso. */
async function download({ asset, dir, fetch, signal, onProgress }) {
  const dest = path.join(dir, asset.name);
  await downloadFile({ url: asset.url, dest, size: asset.size, sha256: asset.sha256, fetch, signal, onProgress: (done) => onProgress(done, asset.size) });
  return dest;
}

module.exports = { LATEST, check, download, newer, pickAsset };
