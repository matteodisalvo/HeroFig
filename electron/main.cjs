const { app, BrowserWindow, ClipboardItem, Menu, clipboard, dialog, ipcMain, nativeImage, net, session, shell, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { svgToPdf } = require('./pdf.cjs');
const { execFile, spawn } = require('node:child_process');
const fsSync = require('node:fs');
const os = require('node:os');
const { setNativeLanguage, nativeText, localizeMenu } = require('./language.cjs');
const { submitFeedback, isFeedbackSender } = require('./feedback.cjs');
const { TEXT: IMAGE_TEXT, checkRequest, externalToken, generateImage, isHfKey } = require('./images.cjs');
const updates = require('./update.cjs');

// .tfig e .mlsketch sono i formati con i vecchi nomi dell'app (TensorFig, ML Pipeline Sketch): si aprono ancora, si salva come .hfig
const DOC_FILTER = { name: 'HeroFig', extensions: ['hfig', 'tfig', 'mlsketch', 'json'] };
const isDocPath = (p) => typeof p === 'string' && path.isAbsolute(p) && /\.(hfig|tfig|mlsketch|json)$/i.test(p);
const EXPORT_NAMES = { svg: 'Immagine SVG', pdf: 'Documento PDF', png: 'Immagine PNG', tex: 'Codice TikZ' };

// Windows e Linux: il file su cui si fa doppio clic arriva come argomento del programma, e un secondo doppio clic
// avvierebbe un'altra copia dell'app: si tiene una sola finestra e il file si apre lì. Anche sul Mac, se impacchettata:
// due copie dell'app (es. una in Download e una in Applicazioni) si contenderebbero i dati e il server del gruppo.
const primaryInstance = (process.platform === 'darwin' && !app.isPackaged) || app.requestSingleInstanceLock();

// HeroFig si chiamava TensorFig: al primo avvio col nuovo nome riprende preferenze, gruppo e sale dalla vecchia
// cartella dei dati (le cache no), una volta sola e senza sovrascrivere nulla. Va fatto prima che Chromium apra il profilo.
function adoptOldUserData() {
  const now = app.getPath('userData');
  const old = path.join(app.getPath('appData'), 'TensorFig');
  const done = path.join(now, '.from-tensorfig');
  if (fsSync.existsSync(done) || fsSync.existsSync(path.join(now, 'Local Storage')) || !fsSync.existsSync(old)) return;
  const skip = /^(Singleton|lockfile$|Cache$|Code Cache$|GPUCache$|GPUPersistentCache$|DawnGraphiteCache$|DawnWebGPUCache$|GraphiteDawnCache$)/;
  try {
    fsSync.cpSync(old, now, { recursive: true, force: false, filter: (src) => !skip.test(path.basename(src)) });
  } catch {
    // senza la copia l'app parte con le impostazioni iniziali
  }
  try {
    fsSync.mkdirSync(now, { recursive: true });
    fsSync.writeFileSync(done, '');
  } catch {
    // al prossimo avvio «Local Storage» c'è già
  }
}
if (primaryInstance) adoptOldUserData();

let win = null;
let dirty = false; // il renderer comunica se ci sono modifiche non salvate
let forceClose = false;
let quitting = false;
let pendingOpen = null; // file aperto dal Finder prima che la finestra fosse pronta

async function sendOpenedFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (!win) return;
    app.addRecentDocument(filePath);
    win.webContents.send('file:opened', { path: filePath, content });
  } catch (err) {
    dialog.showErrorBox(nativeText('Impossibile aprire il file'), String(err.message || err));
  }
}

// ---------- la finestra mostra solo l'app: i link esterni vanno nel browser, nient'altro si apre o si carica ----------
const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const APP_FILE = path.join(__dirname, '..', 'dist', 'index.html');
const samePath = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

function isAppUrl(url) {
  try {
    const to = new URL(url);
    if (DEV_URL) return to.origin === new URL(DEV_URL).origin;
    return to.protocol === 'file:' && samePath(fileURLToPath(to), APP_FILE);
  } catch {
    return false;
  }
}

function openOutside(url) {
  try {
    if (['http:', 'https:', 'mailto:'].includes(new URL(url).protocol)) shell.openExternal(url).catch(() => {});
  } catch {
    // indirizzo non valido
  }
}

app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (e, url) => {
    if (isAppUrl(url)) return;
    e.preventDefault();
    // una figura trascinata sulla finestra si apre (altrimenti Chromium la mostrerebbe al posto dell'app)
    if (!url.startsWith('file:')) return void openOutside(url);
    let file = '';
    try {
      file = fileURLToPath(url);
    } catch {
      // file:// di un altro computer
    }
    // la pagina dell'app è già carica: openFromSystem aspetterebbe un caricamento (isLoading() è vero durante la navigazione)
    if (contents === win?.webContents && /\.(hfig|tfig|mlsketch)$/i.test(file)) sendOpenedFile(file);
  });
  contents.on('will-attach-webview', (e) => e.preventDefault());
});

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    title: 'HeroFig',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  forceClose = false;
  dirty = false; // una finestra nuova non eredita le modifiche non salvate di quella chiusa
  let asking = false; // una sola domanda alla volta (es. ⌘Q mentre è già aperta)
  win.on('close', async (e) => {
    if (!dirty || forceClose) return;
    e.preventDefault();
    if (asking) return;
    asking = true;
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Salva', 'Non salvare', 'Annulla'].map(nativeText),
      defaultId: 0,
      cancelId: 2,
      message: nativeText('Salvare le modifiche prima di chiudere?'),
      detail: nativeText('Se non salvi, le modifiche andranno perse.'),
    });
    asking = false;
    if (response === 0) win?.webContents.send('menu', 'saveAndClose');
    else if (response === 1) closeNow();
    else {
      quitting = false;
      // l'aggiornamento chiesto non parte più alla prossima chiusura: si richiede dall'avviso
      pendingInstaller = null;
    }
  });
  win.webContents.on('did-finish-load', () => {
    if (pendingOpen) {
      sendOpenedFile(pendingOpen);
      pendingOpen = null;
    }
  });
  (DEV_URL ? win.loadURL(DEV_URL) : win.loadFile(APP_FILE)).catch((err) => console.error('Caricamento della finestra non riuscito', err));
  win.on('closed', () => {
    win = null;
    unwatch();
  });
}

function closeNow() {
  forceClose = true;
  win?.close();
  if (quitting) app.quit();
}

const send = (action) => () => win?.webContents.send('menu', action);

// solo la pagina dell'app, nel frame principale della sua finestra, parla col processo principale
const fromApp = (event) => isFeedbackSender(event, win);
const handle = (channel, fn) =>
  ipcMain.handle(channel, (event, args) => {
    if (!fromApp(event)) throw new Error(`Richiesta non consentita: ${channel}`);
    return fn(event, args ?? {});
  });
const receive = (channel, fn) =>
  ipcMain.on(channel, (event, args) => {
    if (fromApp(event)) fn(event, args);
  });

receive('app:language', (_e, payload) => {
  if (setNativeLanguage(payload)) buildMenu();
});

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(localizeMenu([
      ...(isMac ? [{ role: 'appMenu' }] : []),
      {
        label: 'File',
        submenu: [
          { label: 'Nuovo', accelerator: 'CmdOrCtrl+N', click: send('new') },
          { label: 'Apri…', accelerator: 'CmdOrCtrl+O', click: send('open') },
          { type: 'separator' },
          { label: 'Salva', accelerator: 'CmdOrCtrl+S', click: send('save') },
          { label: 'Salva con nome…', accelerator: 'Shift+CmdOrCtrl+S', click: send('saveAs') },
          { type: 'separator' },
          { label: 'Inserisci immagine…', accelerator: 'Shift+CmdOrCtrl+I', click: send('insertImage') },
          { type: 'separator' },
          {
            label: 'Esporta',
            submenu: [
              { label: 'SVG…', click: send('exportSvg') },
              { label: 'PDF…', click: send('exportPdf') },
              { label: 'PNG…', click: send('exportPng') },
              { label: 'TikZ…', click: send('exportTikz') },
            ],
          },
          // su Mac «Esci» sta nel menu dell'app
          { type: 'separator' },
          { label: 'Il tuo spazio', click: send('profile') },
          { label: 'Configura HeroFig…', click: send('onboarding') },
          ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit', label: 'Esci' }]),
        ],
      },
      {
        label: 'Modifica',
        submenu: [
          // annulla/ripeti/seleziona tutto passano dal renderer, che decide fra foglio e campo di testo
          { label: 'Annulla modifica', accelerator: 'CmdOrCtrl+Z', click: send('undo') },
          { label: 'Ripeti', accelerator: 'Shift+CmdOrCtrl+Z', click: send('redo') },
          { type: 'separator' },
          { role: 'cut', label: 'Taglia' },
          { role: 'copy', label: 'Copia' },
          { role: 'paste', label: 'Incolla' },
          { label: 'Copia come immagine', accelerator: 'Shift+CmdOrCtrl+C', click: send('copyPng') },
          { label: 'Copia come SVG', click: send('copySvg') },
          { type: 'separator' },
          { label: 'Copia stile', accelerator: 'Alt+CmdOrCtrl+C', click: send('copyStyle') },
          { label: 'Incolla stile', accelerator: 'Alt+CmdOrCtrl+V', click: send('pasteStyle') },
          { label: 'Raggruppa in un contenitore', accelerator: 'CmdOrCtrl+G', click: send('groupSelection') },
          { type: 'separator' },
          { label: 'Duplica', accelerator: 'CmdOrCtrl+D', click: send('duplicate') },
          { label: 'Seleziona tutto', accelerator: 'CmdOrCtrl+A', click: send('selectAll') },
        ],
      },
      {
        label: 'Vista',
        submenu: [
          { label: 'Ingrandisci', accelerator: 'CmdOrCtrl+=', click: send('zoomIn') },
          { label: 'Riduci', accelerator: 'CmdOrCtrl+-', click: send('zoomOut') },
          { label: 'Adatta alla finestra', accelerator: 'CmdOrCtrl+0', click: send('zoomFit') },
          { label: 'Dimensioni reali', accelerator: 'CmdOrCtrl+1', click: send('zoomReset') },
          { label: 'Zoom sulla selezione', accelerator: 'CmdOrCtrl+2', click: send('zoomSelection') },
          { type: 'separator' },
          { label: 'Cerca nella libreria', accelerator: 'CmdOrCtrl+F', click: send('focusSearch') },
          { label: 'Mostra/nascondi libreria e pannello', accelerator: 'Shift+CmdOrCtrl+F', click: send('togglePanels') },
          { type: 'separator' },
          { label: 'Mostra/nascondi griglia', click: send('toggleGrid') },
          { type: 'separator' },
          { role: 'togglefullscreen', label: 'Schermo intero' },
          // solo in sviluppo; su Windows il predefinito Ctrl+Shift+I servirebbe già per «Inserisci immagine»
          ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Strumenti di sviluppo', accelerator: isMac ? 'Alt+Cmd+I' : 'F12' }]),
        ],
      },
      { role: 'windowMenu' },
      {
        role: 'help',
        label: 'Aiuto',
        submenu: [
          { label: 'Scorciatoie da tastiera', accelerator: 'CmdOrCtrl+/', click: send('shortcuts') },
          { label: 'Richieste e segnalazioni', click: send('feedback') },
          { type: 'separator' },
          { label: 'Informazioni su HeroFig', click: send('about') },
        ],
      },
    ])),
  );
}

async function askSavePath(defaultName, ext) {
  const res = await dialog.showSaveDialog(win, {
    defaultPath: `${defaultName}.${ext}`,
    filters: [ext === 'hfig' ? DOC_FILTER : { name: nativeText(EXPORT_NAMES[ext] ?? ext), extensions: [ext] }],
  });
  return res.canceled ? null : res.filePath;
}

handle('file:open', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [DOC_FILTER] });
  if (res.canceled || !res.filePaths[0]) return null;
  app.addRecentDocument(res.filePaths[0]);
  return { path: res.filePaths[0], content: await fs.readFile(res.filePaths[0], 'utf8') };
});

// si sovrascrive solo un file di figura; un percorso qualsiasi passa dalla finestra «Salva con nome»
handle('file:save', async (_e, { path: current, content, defaultName }) => {
  const target = isDocPath(current) ? current : await askSavePath(String(defaultName ?? 'pipeline'), 'hfig');
  if (!target) return null;
  await fs.writeFile(target, String(content), 'utf8');
  lastWritten.set(target, String(content));
  app.addRecentDocument(target);
  return target;
});

// immagini accanto a un export (TikZ) o nella cartella del paper: nomi semplici, niente cartelle né file nascosti
const isSideName = (name) => typeof name === 'string' && name.length <= 200 && /^[^\\/:*?"<>|\x00-\x1f.][^\\/:*?"<>|\x00-\x1f]*\.(png|jpe?g)$/i.test(name);
const exportedTex = new Set(); // i .tex appena scelti nella finestra «Salva»: solo accanto a questi

handle('export:side', async (_e, { nextTo, files }) => {
  if (!exportedTex.has(nextTo)) throw new Error('Export non trovato.');
  const dir = path.dirname(nextTo);
  for (const f of files ?? []) {
    if (!isSideName(f?.name)) continue;
    await fs.writeFile(path.join(dir, f.name), Buffer.from(f.data));
  }
});

receive('state:dirty', (_e, value) => {
  dirty = !!value;
  win?.setDocumentEdited(dirty);
});

receive('window:close', () => closeNow());

handle('clipboard:png', async (_e, { png }) => {
  await clipboard.write([new ClipboardItem({ 'image/png': new Blob([Buffer.from(png)], { type: 'image/png' }) })]);
});

handle('clipboard:text', async (_e, { text }) => {
  await clipboard.writeText(String(text));
});

handle('export:save', async (_e, { defaultName, ext, data }) => {
  if (!Object.hasOwn(EXPORT_NAMES, ext)) throw new Error('Formato non valido.');
  const target = await askSavePath(String(defaultName ?? 'pipeline'), ext);
  if (!target) return null;
  await fs.writeFile(target, data);
  if (ext === 'tex') exportedTex.add(target);
  return target;
});

handle('export:pdf', async (_e, { defaultName, svg, width, height }) => {
  const target = await askSavePath(defaultName, 'pdf');
  if (!target) return null;
  await fs.writeFile(target, await svgToPdf(svg, width, height));
  return target;
});

// ---------- figura collegata al paper: a ogni salvataggio PDF e TikZ finiscono nella cartella del paper ----------
const FIG_DIRS = ['figures', 'figs', 'fig', 'images', 'img', 'imgs', 'Figures'];
const SKIP_TEX_DIRS = new Set(['.git', 'node_modules', '.tensorfig', '__pycache__']);

/** Cartella del paper: il percorso salvato è relativo al .hfig (base) quando possibile. */
// i percorsi relativi si salvano con "/": lo stesso .hfig funziona su Mac e su Windows
const paperRoot = (dir, base) =>
  path.isAbsolute(dir) ? dir : path.resolve(base ? path.dirname(base) : app.getPath('home'), ...dir.split(/[\\/]/));

async function figuresSub(root) {
  for (const d of FIG_DIRS) {
    try {
      if ((await fs.stat(path.join(root, d))).isDirectory()) return d;
    } catch {
      // non c'è: si prova la successiva
    }
  }
  // una cartella senza .tex non è un paper (es. Google Drive per Overleaf): i file vanno direttamente lì
  return (await paperTexFiles(root)).length ? 'figures' : '';
}

/** I .tex che sono davvero un paper (con \\documentclass): non i TikZ esportati, né quelli scritti da HeroFig. */
async function paperTexFiles(root) {
  const out = [];
  for (const f of await texFiles(root)) {
    if ((await fs.readFile(f, 'utf8').catch(() => '')).includes('\\documentclass')) out.push(f);
  }
  return out;
}

const MY_DRIVE = /^(My Drive|Il mio Drive|Mi unidad|Mon Drive|Meine Ablage|Meu Drive)$/;

/**
 * Google Drive per computer: `base` è ciò che sincronizza, `mine` la cartella «Il mio Drive».
 * Mac: ~/Library/CloudStorage/GoogleDrive-<account>. Windows: un'unità (di solito G:) con «Il mio Drive» alla radice.
 * In modalità «copia speculare» e col vecchio Backup e sincronizzazione è una cartella nella home.
 */
async function googleDrives() {
  const home = app.getPath('home');
  const withMine = async (base) => {
    const mine = (await fs.readdir(base).catch(() => [])).find((d) => MY_DRIVE.test(d));
    return mine ? { base, mine: path.join(base, mine) } : null;
  };
  const found = [];
  if (process.platform === 'darwin') {
    const cs = path.join(home, 'Library', 'CloudStorage');
    const accounts = (await fs.readdir(cs).catch(() => [])).filter((d) => d.startsWith('GoogleDrive-') && !d.includes('('));
    found.push(...(await Promise.all(accounts.map((d) => withMine(path.join(cs, d))))));
  }
  if (process.platform === 'win32') found.push(...(await Promise.all([...'DEFGHIJKLMNOPQRSTUVWXYZ'].map((l) => withMine(`${l}:\\`)))));
  for (const d of await fs.readdir(home).catch(() => [])) if (MY_DRIVE.test(d)) found.push({ base: path.join(home, d), mine: path.join(home, d) });
  const legacy = path.join(home, 'Google Drive');
  if (fsSync.existsSync(legacy)) found.push((await withMine(legacy)) ?? { base: legacy, mine: legacy });
  return found.filter(Boolean);
}

const isInside = (base, p) => {
  const r = path.relative(base, p);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};

/** Cartella sincronizzata da un servizio cloud: per Overleaf gratuito si passa da Google Drive. */
async function cloudOf(root) {
  if ((await googleDrives()).some((g) => isInside(g.base, root))) return 'gdrive';
  const parts = root.split(/[\\/]/);
  if (parts.some((p) => /^Dropbox\b/.test(p))) return 'dropbox';
  if (parts.some((p) => /^OneDrive\b/.test(p))) return 'onedrive';
  return null;
}

// Il mio Drive/HeroFig: cartella pronta per caricare le figure in Overleaf «da Google Drive»
handle('paper:drive', async () => {
  const drive = (await googleDrives())[0];
  if (!drive) return null;
  const dir = path.join(drive.mine, 'HeroFig');
  await fs.mkdir(dir, { recursive: true });
  return { dir, abs: dir };
});

// link dell'app (autore, repo): si aprono nel browser, e solo se portano a GitHub
receive('shell:open', (_e, url) => {
  if (typeof url === 'string' && url.startsWith('https://github.com/')) openOutside(url);
});

handle('feedback:submit', (_e, payload) => submitFeedback(payload));

// ---------- aggiornamenti (electron/update.cjs) ----------

let update = null; // l'ultima versione trovata, più nuova di questa
let updateRun = null; // lo scaricamento in corso
let pendingInstaller = null; // Windows: l'installer da avviare quando l'app si è chiusa (dopo aver salvato)
const UPDATE_EVERY = 3 * 60 * 60 * 1000; // ogni tre ore, oltre che all'avvio
const updateFetch = (url, init) => net.fetch(url, { ...init, credentials: 'omit', cache: 'no-store' });
const updateInfo = (u) => ({ version: u.version, notes: u.notes, page: u.page, canInstall: !!u.asset, platform: process.platform });

async function checkUpdate() {
  // solo l'app installata: in sviluppo la versione del package.json non è quella di nessuna release
  if (!app.isPackaged && !process.env.HEROFIG_UPDATE_TEST) return;
  try {
    const found = await updates.check({ fetch: updateFetch, current: process.env.HEROFIG_UPDATE_TEST || app.getVersion(), platform: process.platform, arch: process.arch });
    if (!found || found.version === update?.version) return;
    update = found;
    win?.webContents.send('update:state', { kind: 'available', ...updateInfo(found) });
  } catch {
    // senza rete o con GitHub che non risponde si riprova la prossima volta, in silenzio
  }
}

// la pagina può arrivare dopo il controllo: chiede lei se c'è qualcosa
handle('update:status', () => (update ? updateInfo(update) : null));

handle('update:install', async () => {
  if (!update?.asset) return { error: 'Nessun file da scaricare per questo computer.' };
  if (updateRun) return { error: 'Lo scaricamento è già in corso.' };
  updateRun = new AbortController();
  try {
    const file = await updates.download({
      asset: update.asset,
      dir: app.getPath('downloads'),
      fetch: updateFetch,
      signal: updateRun.signal,
      onProgress: (done, total) => win?.webContents.send('update:state', { kind: 'progress', done, total }),
    });
    // Windows: l'app si chiude (chiedendo di salvare le modifiche, se ce ne sono) e solo allora l'installer parte, senza
    // finestre (/S) e riaprendo HeroFig alla fine (--force-run); con «Annulla» sulla domanda di salvataggio non parte
    if (process.platform === 'win32') {
      pendingInstaller = file;
      setTimeout(() => app.quit(), 300);
      return { ok: true, file };
    }
    const failed = await shell.openPath(file);
    if (failed) return { error: failed, file };
    return { ok: true, file };
  } catch (err) {
    return { error: updateRun.signal.aborted ? 'stopped' : err instanceof Error ? err.message : String(err) };
  } finally {
    updateRun = null;
  }
});

receive('update:stop', () => updateRun?.abort());
// sul Mac, aperto il disco: si chiude l'app per poterla sostituire in Applicazioni
receive('update:quit', () => app.quit());

handle('paper:reveal', async (_e, { dir, base, name }) => {
  const root = paperRoot(dir, base);
  const sub = await figuresSub(root);
  shell.showItemInFolder(path.join(root, sub, `${name}.pdf`));
});

async function texFiles(root, depth = 3, out = []) {
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (out.length >= 200) break;
    const p = path.join(root, e.name);
    if (e.isDirectory() && depth > 0 && !SKIP_TEX_DIRS.has(e.name)) await texFiles(p, depth - 1, out);
    else if (e.isFile() && e.name.endsWith('.tex')) out.push(p);
  }
  return out;
}

const mtime = async (p) => {
  try {
    return (await fs.stat(p)).mtimeMs;
  } catch {
    return 0;
  }
};

handle('paper:choose', async (_e, { base }) => {
  const res = await dialog.showOpenDialog(win, {
    title: nativeText('Cartella del paper'),
    message: nativeText('Scegli la cartella del paper: quella con il file .tex principale'),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const abs = res.filePaths[0];
  // relativo al .hfig: funziona anche aprendo la stessa cartella condivisa da un altro computer
  const rel = base && path.relative(path.dirname(base), abs);
  // su un'altra unità (Windows) il percorso relativo non esiste: si tiene quello completo
  return { dir: !base ? abs : !rel ? '.' : path.isAbsolute(rel) ? abs : rel.split(path.sep).join('/'), abs };
});

handle('paper:scan', async (_e, { dir, base, name }) => {
  const root = paperRoot(dir, base);
  try {
    if (!(await fs.stat(root)).isDirectory()) throw new Error();
  } catch {
    return { ok: false, error: `Cartella del paper non trovata: ${root}` };
  }
  const sub = await figuresSub(root);
  // dove il paper usa la figura: \includegraphics{…/nome}, \input{…/nome} (con o senza estensione)
  const refs = [];
  const rx = /\\(includegraphics|input|include)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
  for (const f of await texFiles(root)) {
    const lines = (await fs.readFile(f, 'utf8').catch(() => '')).split('\n');
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('%')) return;
      for (const m of line.matchAll(rx)) {
        if (path.basename(m[2].trim()).replace(/\.(pdf|tex|png|jpe?g)$/i, '') === name && refs.length < 20) {
          refs.push({ file: path.relative(root, f), line: i + 1, command: m[1], target: m[2].trim() });
        }
      }
    });
  }
  // template del paper (dal preambolo) e formato della figura (figure o figure* intorno al primo uso)
  let family = null;
  let span = null;
  const TEMPLATES = [
    [/\\documentclass(\[[^\]]*\])?\{llncs\}/, 'miccai'],
    [/\\documentclass(\[[^\]]*\])?\{IEEEtran\}/, 'ieee'],
    [/\\usepackage(\[[^\]]*\])?\{(cvpr|iccv)\}/, 'cvpr'],
    [/\\usepackage(\[[^\]]*\])?\{icml\d{4}\}/, 'icml'],
    [/\\usepackage(\[[^\]]*\])?\{(neurips_\d{4}|iclr\d{4}_conference)\}/, 'neurips'],
  ];
  for (const f of await texFiles(root)) {
    const head = (await fs.readFile(f, 'utf8').catch(() => '')).split('\\begin{document}')[0];
    const hit = TEMPLATES.find(([rx]) => rx.test(head));
    if (hit) {
      family = hit[1];
      break;
    }
  }
  if (refs[0]) {
    const lines = (await fs.readFile(path.join(root, refs[0].file), 'utf8').catch(() => '')).split('\n');
    for (let i = refs[0].line - 1; i >= Math.max(0, refs[0].line - 20); i--) {
      if (/\\begin\{figure\*\}/.test(lines[i])) {
        span = 'full';
        break;
      }
      if (/\\begin\{figure\}/.test(lines[i])) {
        span = 'col';
        break;
      }
    }
  }
  return {
    ok: true,
    root,
    sub,
    refs,
    family,
    span,
    cloud: await cloudOf(root),
    overleaf: await isOverleafClone(root),
    texCount: (await paperTexFiles(root)).length,
    pdfTime: await mtime(path.join(root, sub, `${name}.pdf`)),
    tfigTime: base ? await mtime(base) : 0,
  };
});

handle('paper:write', async (_e, { dir, base, name, svg, width, height, tex, side }) => {
  if (typeof name !== 'string' || !/^[\w.-]+$/.test(name)) return { ok: false, error: 'Nome della figura non valido: usa lettere, numeri, - e _.' };
  const root = paperRoot(dir, base);
  const sub = await figuresSub(root);
  const out = path.join(root, sub);
  const written = [];
  try {
    await fs.mkdir(out, { recursive: true });
    await fs.writeFile(path.join(out, `${name}.pdf`), await svgToPdf(svg, width, height));
    await fs.writeFile(path.join(out, `${name}.tex`), String(tex), 'utf8');
    written.push(`${name}.pdf`, `${name}.tex`);
    for (const f of side ?? []) {
      if (!isSideName(f?.name)) continue;
      await fs.writeFile(path.join(out, f.name), Buffer.from(f.data));
      written.push(f.name);
    }
  } catch (err) {
    return { ok: false, error: `Non riesco a scrivere nella cartella del paper: ${err.message}` };
  }
  if (!(await isOverleafClone(root))) return { ok: true, sub };
  const pushed = await pushToOverleaf(root, written.map((f) => path.join(sub, f)));
  return pushed.ok ? { ok: true, sub, pushed: Date.now() } : { ok: true, sub, pushError: pushed.error };
});

// ---------- chiavi salvate (token Git di Overleaf, chiave di Hugging Face): cifrate con safeStorage, un file ciascuna ----------
const TOKEN_FILES = { overleaf: 'overleaf-git-token.bin', huggingface: 'huggingface-token.bin' };
const tokenFile = (kind) => path.join(app.getPath('userData'), TOKEN_FILES[kind]);

async function loadToken(kind) {
  try {
    return safeStorage.decryptString(await fs.readFile(tokenFile(kind)));
  } catch {
    return null;
  }
}

/** Salva una chiave, solo cifrata: false se questo computer non permette di cifrarla. */
async function saveToken(kind, token) {
  // su Linux senza portachiavi safeStorage userebbe una chiave fissa: come scriverla in chiaro
  if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) return false;
  await fs.writeFile(tokenFile(kind), safeStorage.encryptString(token), { mode: 0o600 });
  return true;
}

// ---------- Overleaf con Git (piani che lo includono): copia del progetto sul Mac, invio a ogni salvataggio ----------
const OVERLEAF_HOME = () => path.join(app.getPath('home'), '.tensorfig', 'overleaf');

/** Il token va a git solo come intestazione HTTP, via ambiente: non finisce né negli argomenti né in .git/config. */
function gitEnv(token) {
  // nessuna richiesta di credenziali: né nel terminale né nelle finestre di Git Credential Manager (Windows)
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
  if (token) {
    env.GIT_CONFIG_COUNT = '1';
    env.GIT_CONFIG_KEY_0 = 'http.extraHeader';
    env.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${Buffer.from(`git:${token}`).toString('base64')}`;
  }
  return env;
}

const GIT_MISSING =
  process.platform === 'win32'
    ? 'Git non è installato: scaricalo da git-scm.com (Git per Windows), poi riapri HeroFig.'
    : process.platform === 'darwin'
      ? 'Git non è installato: nel Terminale esegui «xcode-select --install», poi riapri HeroFig.'
      : 'Git non è installato: installalo dal gestore pacchetti, poi riapri HeroFig.';

const git = (args, cwd, env = process.env) =>
  new Promise((resolve, reject) =>
    execFile('git', args, { cwd, env, timeout: 90_000, windowsHide: true }, (err, stdout, stderr) =>
      err ? reject(new Error(err.code === 'ENOENT' ? GIT_MISSING : (stderr || err.message).trim())) : resolve(stdout),
    ),
  );

async function isOverleafClone(root) {
  // solo le copie fatte da HeroFig: in una cartella qualsiasi (es. arrivata insieme a una figura condivisa) git seguirebbe
  // la sua .git/config, che può far eseguire comandi o mandare il token a un altro server
  const home = OVERLEAF_HOME();
  if (!isInside(home, path.resolve(root)) || samePath(path.resolve(root), home)) return false;
  try {
    // l'indirizzo così com'è scritto in .git/config (get-url applicherebbe le riscritture insteadOf)
    return /git\.overleaf\.com/.test(await git(['config', '--get', 'remote.origin.url'], root));
  } catch {
    return false;
  }
}

/** Messaggi di git e di Overleaf tradotti in qualcosa di comprensibile. */
function overleafError(msg) {
  if (msg === GIT_MISSING) return msg;
  if (/403|401|authentication|denied|forbidden/i.test(msg)) {
    return "Overleaf non accetta l'accesso: controlla il token, e che il tuo piano Overleaf includa l'integrazione Git.";
  }
  if (/not found|404|does not exist/i.test(msg)) return 'Progetto Overleaf non trovato: controlla il link.';
  if (/could not resolve|timed out|network/i.test(msg)) return 'Overleaf non risponde: controlla la connessione.';
  return `Invio a Overleaf non riuscito: ${msg.split('\n').slice(-1)[0]}`;
}

async function pushToOverleaf(root, files) {
  const token = await loadToken('overleaf');
  if (!token) return { ok: false, error: 'Manca il token Git di Overleaf: ricollega il progetto.' };
  const env = gitEnv(token);
  try {
    await git(['add', '--', ...files], root);
    if ((await git(['status', '--porcelain', '--', ...files], root)).trim()) {
      const who = (await git(['config', 'user.email'], root).catch(() => '')).trim() ? [] : ['-c', 'user.name=HeroFig', '-c', 'user.email=herofig@localhost'];
      await git([...who, 'commit', '-m', `HeroFig: aggiorna ${files[0]}`, '--', ...files], root);
    }
    // prima si prendono le modifiche dei coautori, poi si invia
    await pull(root, env);
    await git(['push'], root, env);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: overleafError(err.message) };
  }
}

// un conflitto lascerebbe la copia a metà di un rebase, e da lì ogni invio fallirebbe: si torna indietro
async function pull(root, env) {
  try {
    await git(['pull', '--rebase', '--autostash'], root, env);
  } catch (err) {
    await git(['rebase', '--abort'], root).catch(() => {});
    throw err;
  }
}

handle('overleaf:hasToken', async () => !!(await loadToken('overleaf')));

handle('overleaf:link', async (_e, { url, token }) => {
  url = String(url ?? '');
  token = typeof token === 'string' ? token.trim() : '';
  const m =
    /overleaf\.com\/(?:project|read)\/([0-9a-f]{24})/i.exec(url) || /git\.overleaf\.com\/([0-9a-f]{24})/i.exec(url) || /^\s*([0-9a-f]{24})\s*$/i.exec(url);
  if (!m) return { ok: false, error: "Link non valido: copia l'indirizzo del progetto, del tipo https://www.overleaf.com/project/…" };
  if (token && !(await saveToken('overleaf', token))) return { ok: false, error: 'Questo computer non permette di salvare il token in modo cifrato.' };
  const tk = await loadToken('overleaf');
  if (!tk) return { ok: false, error: 'Serve il token Git di Overleaf: lo generi in Overleaf, Impostazioni account › Integrazione Git.' };
  const id = m[1].toLowerCase();
  const dir = path.join(OVERLEAF_HOME(), id);
  try {
    await fs.mkdir(OVERLEAF_HOME(), { recursive: true });
    if (await fs.stat(path.join(dir, '.git')).then(() => true, () => false)) await pull(dir, gitEnv(tk));
    else await git(['clone', `https://git.overleaf.com/${id}`, dir], OVERLEAF_HOME(), gitEnv(tk));
  } catch (err) {
    return { ok: false, error: overleafError(err.message) };
  }
  return { ok: true, dir, id };
});

// ---------- progetti: una cartella con le figure .hfig e il file progetto.tfproj ----------
const PROJECT_FILE = 'progetto.tfproj';
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024; // oltre, la figura si elenca senza anteprima
const isFigureName = (name) => /^[^/\\:]+\.(hfig|tfig|mlsketch)$/i.test(name) && !name.startsWith('.');

handle('project:pick', async () => {
  const res = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: nativeText('Usa questa cartella'),
    message: nativeText('Scegli (o crea) la cartella del progetto: le figure .hfig al suo interno ne faranno parte.'),
  });
  return res.canceled || !res.filePaths[0] ? null : res.filePaths[0];
});

// null se la cartella non c'è più (spostata, disco scollegato)
handle('project:read', async (_e, { dir }) => {
  let names;
  try {
    names = await fs.readdir(dir);
  } catch {
    return null;
  }
  let meta = null;
  try {
    meta = JSON.parse(await fs.readFile(path.join(dir, PROJECT_FILE), 'utf8'));
  } catch {
    // cartella senza file di progetto: valori predefiniti nel renderer
  }
  const figures = [];
  for (const name of names.filter(isFigureName).sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))) {
    const file = path.join(dir, name);
    try {
      const stat = await fs.stat(file);
      const content = stat.size <= MAX_PREVIEW_BYTES ? await fs.readFile(file, 'utf8') : null;
      figures.push({ name, path: file, mtime: stat.mtimeMs, content });
    } catch {
      // file sparito fra l'elenco e la lettura
    }
  }
  return { meta, figures };
});

handle('project:writeMeta', async (_e, { dir, meta }) => {
  await fs.writeFile(path.join(dir, PROJECT_FILE), JSON.stringify(meta, null, 2), 'utf8');
});

// crea una figura nuova nella cartella; non sovrascrive mai un file esistente
handle('project:writeFigure', async (_e, { dir, name, content }) => {
  if (typeof name !== 'string' || !isFigureName(name)) return { error: 'Nome non valido.' };
  const target = path.join(dir, name);
  try {
    await fs.writeFile(target, String(content), { encoding: 'utf8', flag: 'wx' });
    lastWritten.set(target, String(content));
  } catch (err) {
    return { error: err.code === 'EEXIST' ? 'Esiste già una figura con questo nome.' : String(err.message || err) };
  }
  return { path: target };
});

// solo figure: il renderer non legge file qualsiasi
handle('file:read', async (_e, { path: file }) => {
  if (!isDocPath(file)) throw new Error('Non è una figura di HeroFig.');
  return fs.readFile(file, 'utf8');
});

// ---------- cartelle condivise: la figura aperta si aggiorna se cambia sul disco ----------
const lastWritten = new Map(); // ultimo contenuto scritto o letto da questa app, per file
let watcher = null;
let watchTimer;

function unwatch() {
  clearTimeout(watchTimer);
  watcher?.close();
  watcher = null;
}

receive('file:watch', (_e, { path: file } = {}) => {
  unwatch();
  if (!isDocPath(file)) return;
  try {
    // si osserva la cartella: Dropbox e simili sostituiscono il file, e un watcher sul file si perderebbe
    const w = fsSync.watch(path.dirname(file), (_event, name) => {
      if (name && name !== path.basename(file)) return;
      clearTimeout(watchTimer);
      watchTimer = setTimeout(async () => {
        try {
          const content = await fs.readFile(file, 'utf8');
          if (watcher !== w || content === lastWritten.get(file)) return;
          lastWritten.set(file, content);
          win?.webContents.send('file:changed', { path: file, content });
        } catch {
          // file a metà sincronizzazione o rimosso: arriverà un altro evento
        }
      }, 400);
    });
    // cartella rimossa o disco scollegato: si smette di osservare invece di far cadere l'app
    w.on('error', () => {
      if (watcher === w) unwatch();
    });
    watcher = w;
  } catch {
    // cartella non osservabile (disco di rete): niente aggiornamento automatico
  }
});

// ---------- presenza: chi ha aperto quale figura del progetto ----------
const PRESENCE_DIR = '.tensorfig';
const PRESENCE_MS = 3 * 60 * 1000; // margine per i ritardi di sincronizzazione e gli orologi diversi
const presenceFile = (dir, id) => path.join(dir, PRESENCE_DIR, `presenza-${id}.json`);
let myPresence = null;

// la presenza è un'indicazione per gli altri: una cartella in sola lettura o scollegata non è un errore
handle('presence:set', async (_e, { dir, id, name, figure }) => {
  if (typeof id !== 'string' || !/^[\w-]+$/.test(id) || typeof dir !== 'string') return;
  try {
    if (myPresence && (myPresence.dir !== dir || !figure)) await fs.rm(presenceFile(myPresence.dir, myPresence.id), { force: true });
    myPresence = figure ? { dir, id } : null;
    if (!figure) return;
    await fs.mkdir(path.join(dir, PRESENCE_DIR), { recursive: true });
    await fs.writeFile(presenceFile(dir, id), JSON.stringify({ name, figure, time: Date.now() }), 'utf8');
  } catch {
    // riprova al prossimo aggiornamento
  }
});

handle('presence:list', async (_e, { dir, id }) => {
  const out = [];
  let names = [];
  try {
    names = await fs.readdir(path.join(dir, PRESENCE_DIR));
  } catch {
    return out;
  }
  for (const name of names) {
    if (!/^presenza-[\w-]+\.json$/.test(name) || name === `presenza-${id}.json`) continue;
    try {
      const p = JSON.parse(await fs.readFile(path.join(dir, PRESENCE_DIR, name), 'utf8'));
      if (Date.now() - p.time < PRESENCE_MS) out.push({ name: String(p.name || 'Qualcuno'), figure: String(p.figure) });
    } catch {
      // file a metà sincronizzazione
    }
  }
  return out;
});

// ---------- server del gruppo: un piccolo server privato sulla rete locale, senza servizi esterni ----------
// Un computer del gruppo lo ospita; gli altri si collegano con l'invito (indirizzo/chiave). Il lavoro
// insieme avviene in stanze: ognuna ha un nome, una figura e chi l'ha creata, l'unico che può chiuderla
// (oltre a chi ospita il server). Le modifiche il server le inoltra a chi è nella stessa stanza senza
// guardarle; tiene però l'ultima copia della figura di ogni stanza, così una stanza vuota si riapre
// con i suoi commenti anche il giorno dopo. Stanze e server ripartono da soli all'avvio dell'app.
// GET /<chiave>/events in ascolto, POST /<chiave>/msg per tutto il resto.
const http = require('node:http');
const crypto = require('node:crypto');
const GROUP_PORT = 47800;
const GROUP_MAX_BYTES = 64 * 1024 * 1024;
const GROUP_MAX_ROOMS = 100;
const groupFile = () => path.join(app.getPath('userData'), 'group-server.json');
const roomsDir = () => path.join(app.getPath('userData'), 'group-rooms');
let group = null; // { server, config, clients, rooms, ping }
let groupReady = Promise.resolve();
// avvio, stato e chiusura del server uno alla volta: due clic su «Crea» non avviano due server
const groupStep = (fn) => {
  const step = groupReady.then(fn);
  groupReady = step.catch(() => {});
  return step;
};

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return '127.0.0.1';
}

// lettere e cifre senza quelle che si confondono (0/O, 1/I/L)
function newKey() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return [0, 1, 2].map(() => Array.from(crypto.randomBytes(4), (b) => abc[b % abc.length]).join('')).join('-');
}

const sameKey = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function groupInfo() {
  if (!group) return null;
  const { name, key } = group.config;
  const port = group.server.address().port;
  return { name, invite: `${lanAddress()}:${port}/${key}`, local: `127.0.0.1:${port}/${key}`, openAtLogin: app.getLoginItemSettings().openAtLogin };
}

// ---------- stanze salvate su disco: una per file, scritte poco dopo l'ultima modifica ----------

const ROOM_ID = /^[a-z0-9]{4,16}$/;
const roomFile = (id) => path.join(roomsDir(), `${id}.json`);
const clockOf = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0); // Infinity o NaN renderebbero il JSON illeggibile
const roomJson = (r) => `{"id":${JSON.stringify(r.id)},"name":${JSON.stringify(r.name)},"owner":${JSON.stringify(r.owner)},"ownerName":${JSON.stringify(r.ownerName)},"created":${r.created},"clock":${r.clock},"doc":${r.doc}}`;

function saveRoomNow(r) {
  clearTimeout(r.saveTimer);
  r.saveTimer = undefined;
  try {
    fsSync.mkdirSync(roomsDir(), { recursive: true });
    fsSync.writeFileSync(roomFile(r.id), roomJson(r));
  } catch (err) {
    console.error('Stanza non salvata', r.id, err);
  }
}
const saveRoom = (r) => {
  clearTimeout(r.saveTimer);
  r.saveTimer = setTimeout(() => saveRoomNow(r), 2000);
};

function loadRooms() {
  const rooms = new Map();
  let files = [];
  try {
    files = fsSync.readdirSync(roomsDir()).filter((f) => f.endsWith('.json'));
  } catch {
    return rooms;
  }
  for (const f of files) {
    try {
      const r = JSON.parse(fsSync.readFileSync(path.join(roomsDir(), f), 'utf8'));
      if (typeof r?.id !== 'string' || !ROOM_ID.test(r.id) || !r.doc) continue;
      rooms.set(r.id, {
        id: r.id,
        name: String(r.name ?? 'Stanza'),
        owner: String(r.owner ?? ''),
        ownerName: String(r.ownerName ?? ''),
        created: clockOf(r.created),
        clock: clockOf(r.clock),
        doc: JSON.stringify(r.doc),
      });
    } catch {
      // file rovinato: la stanza si perde, le altre restano
    }
  }
  return rooms;
}

function stopGroup() {
  if (!group) return;
  clearInterval(group.ping);
  for (const r of group.rooms.values()) if (r.saveTimer) saveRoomNow(r);
  for (const c of group.clients.values()) c.res.end();
  group.server.close();
  group.server.closeAllConnections(); // anche le richieste a metà: niente stanze riscritte dopo la chiusura
  group = null;
}

async function startGroup(config) {
  const clients = new Map(); // id → { res, name, room, since }
  const rooms = loadRooms(); // id → { id, name, owner, ownerName, created, clock, doc (JSON), saveTimer }
  // in un evento SSE anche un \r da solo va a capo: fuori dalle stringhe JSON sono solo spazi
  const sendRaw = (res, data) => res.write(`data: ${data.replace(/[\r\n]/g, '')}\n\n`);
  const send = (res, msg) => sendRaw(res, JSON.stringify(msg));
  const announce = () => {
    const people = [...clients].map(([id, c]) => ({ id, name: c.name, room: c.room, since: c.since }));
    const list = [...rooms.values()].map((r) => ({ id: r.id, name: r.name, owner: r.owner, ownerName: r.ownerName, created: r.created }));
    const data = JSON.stringify({ type: 'people', people, rooms: list });
    for (const c of clients.values()) sendRaw(c.res, data);
  };
  // la figura conservata, a chi entra in una stanza vuota o si ricollega
  const sendSnapshot = (id, r) => sendRaw(clients.get(id).res, `{"type":"doc","from":"server","to":${JSON.stringify(id)},"room":${JSON.stringify(r.id)},"clock":${r.clock},"doc":${r.doc}}`);
  const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

  const server = http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return void res.writeHead(400).end();
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    const [, key, what] = url.pathname.split('/');
    if (!sameKey(key, config.key)) return void res.writeHead(403).end();
    if (what === 'info' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return void res.end(JSON.stringify({ name: config.name }));
    }
    const id = (url.searchParams.get('id') ?? '').slice(0, 40);
    if (!id) return void res.writeHead(400).end();
    if (what === 'events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.on('error', () => {}); // scrittura su una connessione già chiusa: se ne occupa `close`
      res.write('retry: 2000\n\n');
      clients.get(id)?.res.end(); // la stessa persona che si ricollega
      clients.set(id, { res, name: (url.searchParams.get('name') || 'Ospite').slice(0, 60), room: null, since: 0 });
      announce();
      req.on('close', () => {
        if (clients.get(id)?.res !== res) return;
        clients.delete(id);
        announce();
      });
      return;
    }
    if (what === 'msg' && req.method === 'POST') {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > GROUP_MAX_BYTES) req.destroy();
        else chunks.push(c);
      });
      req.on('end', () => {
        const me = clients.get(id);
        if (!me) return void res.writeHead(410).end();
        const text = Buffer.concat(chunks).toString('utf8');
        let msg;
        try {
          msg = JSON.parse(text);
        } catch {
          return void res.writeHead(400).end();
        }
        if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return void res.writeHead(400).end();
        const room = typeof msg.room === 'string' && ROOM_ID.test(msg.room) ? msg.room : null;
        if (msg.type === 'create') {
          if (!room || rooms.has(room) || rooms.size >= GROUP_MAX_ROOMS || !msg.doc) return void res.writeHead(409).end();
          const name = String(msg.name ?? '').trim().slice(0, 80) || 'Stanza';
          const r = { id: room, name, owner: id, ownerName: me.name, created: Date.now(), clock: clockOf(msg.clock), doc: JSON.stringify(msg.doc) };
          rooms.set(room, r);
          saveRoomNow(r);
          Object.assign(me, { room, since: Date.now() });
          announce();
        } else if (msg.type === 'join') {
          if (!room || !rooms.has(room)) {
            // chiusa mentre si entrava o mentre si era senza rete
            send(me.res, { type: 'closed', room: String(msg.room ?? '').slice(0, 16), name: '', by: '', byId: '' });
            return void res.writeHead(404).end();
          }
          Object.assign(me, { room, since: Date.now() });
          announce();
        } else if (msg.type === 'leave') {
          // un `leave` in ritardo non deve far uscire dalla stanza in cui si è appena entrati
          if (!room || me.room === room) Object.assign(me, { room: null, since: 0 });
          announce();
        } else if (msg.type === 'fetch') {
          const r = me.room && rooms.get(me.room);
          if (r) sendSnapshot(id, r);
        } else if (msg.type === 'snapshot') {
          const r = room && me.room === room && rooms.get(room);
          if (r && msg.doc) {
            r.doc = JSON.stringify(msg.doc);
            r.clock = Math.max(r.clock, clockOf(msg.clock));
            saveRoom(r);
          }
        } else if (msg.type === 'close') {
          const r = room && rooms.get(room);
          if (!r) return void res.writeHead(404).end();
          // solo chi l'ha creata, oppure chi ospita il server
          if (r.owner !== id && !isLocal(req)) return void res.writeHead(403).end();
          clearTimeout(r.saveTimer);
          rooms.delete(room);
          fs.rm(roomFile(room), { force: true }).catch(() => {});
          for (const c of clients.values()) {
            if (c.room !== room) continue;
            send(c.res, { type: 'closed', room, name: r.name, by: me.name, byId: id });
            Object.assign(c, { room: null, since: 0 });
          }
          announce();
        } else if (me.room && msg.type !== 'people' && msg.type !== 'closed') {
          // solo a chi è nella stessa stanza; con `to` a una persona sola (la figura intera per chi entra).
          // `people` e `closed` li manda solo il server: inoltrati, chiunque potrebbe falsare elenco e stanze
          for (const [other, c] of clients) if (other !== id && c.room === me.room && (!msg.to || msg.to === other)) sendRaw(c.res, text);
        }
        res.writeHead(204).end();
      });
      return;
    }
    res.writeHead(404).end();
  });
  const listen = (port) =>
    new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, () => {
        server.off('error', reject);
        resolve(server.address().port);
      });
    });
  let port;
  try {
    port = await listen(config.port || GROUP_PORT);
  } catch {
    port = await listen(0); // porta abituale occupata: una qualsiasi libera (l'invito cambia)
  }
  server.on('error', (err) => console.error('Server del gruppo', err));
  // qualche commento ogni tanto tiene aperte le connessioni attraverso router e firewall
  const ping = setInterval(() => {
    for (const c of clients.values()) c.res.write(': ping\n\n');
  }, 25000);
  group = { server, clients, rooms, ping, config: { ...config, port } };
  await fs.writeFile(groupFile(), JSON.stringify(group.config));
}

async function resumeGroup() {
  try {
    const config = JSON.parse(await fs.readFile(groupFile(), 'utf8'));
    if (config?.key) await startGroup(config);
  } catch {
    // nessun server da far ripartire
  }
}

const setOpenAtLogin = (on) => {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!on });
};

handle('group:status', () => groupStep(groupInfo));
handle('group:create', (_event, args) =>
  groupStep(async () => {
    if (!group) await startGroup({ name: String(args.name ?? '').trim().slice(0, 60) || 'Gruppo', key: newKey(), port: GROUP_PORT });
    setOpenAtLogin(args.openAtLogin);
    return groupInfo();
  }),
);
handle('group:login', (_event, on) => setOpenAtLogin(on === true));
handle('group:stop', () =>
  groupStep(async () => {
    stopGroup();
    setOpenAtLogin(false);
    // il gruppo non esiste più: con lui le sue stanze
    await fs.rm(groupFile(), { force: true });
    await fs.rm(roomsDir(), { recursive: true, force: true });
  }),
);

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
}

function openFromSystem(filePath) {
  if (win && !win.webContents.isLoading()) {
    showWindow();
    sendOpenedFile(filePath);
    return;
  }
  pendingOpen = filePath;
  // Mac: l'app resta aperta senza finestre; il file se ne apre una nuova
  if (!win && primaryInstance && app.isReady()) createWindow();
}

// doppio clic su un file .hfig (o .tfig, .mlsketch) nel Finder
app.on('open-file', (e, filePath) => {
  e.preventDefault();
  openFromSystem(filePath);
});

const fileArg = (argv) => argv.slice(1).find((a) => /\.(hfig|tfig|mlsketch)$/i.test(a) && fsSync.existsSync(a));
if (!primaryInstance) app.quit();
else {
  if (process.platform !== 'darwin') pendingOpen = fileArg(process.argv) ?? null;
  app.on('second-instance', (_e, argv) => {
    const f = process.platform === 'darwin' ? null : fileArg(argv);
    if (f) openFromSystem(f);
    else if (win) showWindow();
    else if (app.isReady()) createWindow();
  });
}

// ---------- immagini illustrative: FLUX su Hugging Face (electron/images.cjs), con la chiave dell'utente ----------
let imageRun = null; // AbortController della generazione in corso

/** La chiave di Hugging Face e da dove viene: quella salvata nell'app vince su HF_TOKEN e su «hf auth login». */
async function imageKey() {
  const saved = await loadToken('huggingface');
  return saved ? { token: saved, source: 'app' } : externalToken();
}

// al pannello solo la provenienza (e il nome della variabile d'ambiente), mai la chiave
handle('image:token', async () => {
  const key = await imageKey();
  return key?.variable ? { source: key.source, variable: key.variable } : { source: key?.source ?? null };
});

handle('image:setToken', async (_e, { token }) => {
  token = typeof token === 'string' && token.length <= 1000 ? token.trim() : '';
  if (!isHfKey(token)) return { error: 'Non sembra una chiave di Hugging Face: copiala per intero, a partire da hf_.' };
  try {
    if (!(await saveToken('huggingface', token))) return { error: 'Questo computer non permette di salvare la chiave in modo cifrato.' };
  } catch {
    return { error: 'Non riesco a salvare la chiave.' };
  }
  return { ok: true };
});

handle('image:clearToken', async () => {
  await fs.rm(tokenFile('huggingface'), { force: true });
  return { ok: true };
});

// TENSORFIG_IMAGE_FAKE=1 (solo per i collaudi): niente rete e la chiave non si usa; il pannello ne chiede comunque una, così anche
// il riquadro della chiave si prova senza rete (per andare subito alla descrizione basta una finta, per esempio HF_TOKEN=hf_prova).
// Dopo un attimo arriva un'immagine di prova 256×256
async function fakeImage(signal, step) {
  step(IMAGE_TEXT.step);
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 800);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
  if (signal.aborted) return { error: IMAGE_TEXT.stopped };
  const size = 256;
  const bgra = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) bgra.set([160, Math.floor((y * 255) / size), Math.floor((x * 255) / size), 255], (y * size + x) * 4);
  }
  const png = nativeImage.createFromBitmap(bgra, { width: size, height: size }).toPNG();
  return { src: `data:image/png;base64,${png.toString('base64')}` };
}

// le richieste a Hugging Face passano dalla rete di Chromium, che segue i proxy del sistema (anche PAC) e i suoi certificati,
// come nelle reti di ospedali e università; i data: URL (immagini in base64) non sono suoi e restano al fetch di Node.
// Niente cookie: come prima, nessuna traccia di Hugging Face nel profilo dell'app
const hfFetch = (input, init) => (/^https?:/i.test(String(input?.url ?? input)) ? net.fetch(input, { ...init, credentials: 'omit' }) : fetch(input, init));

handle('image:generate', async (_e, { prompt, style }) => {
  const invalid = checkRequest({ prompt, style });
  if (invalid) return { error: invalid };
  imageRun?.abort(); // una generazione nuova sostituisce quella in corso
  const run = new AbortController();
  imageRun = run;
  const step = (text) => {
    if (imageRun === run) win?.webContents.send('image:step', text);
  };
  try {
    if (process.env.TENSORFIG_IMAGE_FAKE) return await fakeImage(run.signal, step);
    const key = await imageKey();
    if (!key) return { error: IMAGE_TEXT.needKey, needsToken: true };
    return await generateImage({ prompt, style, token: key.token, signal: run.signal, onStep: step, fetch: hfFetch });
  } finally {
    if (imageRun === run) imageRun = null;
  }
});

receive('image:stop', () => imageRun?.abort());

app.on('before-quit', () => {
  quitting = true;
});

// solo quando l'uscita è certa: con «Annulla» sulla domanda di salvataggio l'app resta aperta, e così il server del gruppo
app.on('will-quit', () => {
  updateRun?.abort();
  if (pendingInstaller) {
    try {
      spawn(pendingInstaller, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
    } catch {
      // l'installer resta nella cartella Download, da aprire a mano
    }
    pendingInstaller = null;
  }
  imageRun?.abort();
  stopGroup();
  try {
    if (myPresence) fsSync.rmSync(presenceFile(myPresence.dir, myPresence.id), { force: true });
  } catch {
    // cartella scollegata: la presenza scade da sola
  }
});

app.whenReady().then(() => {
  if (!primaryInstance) return;
  // nell'app impacchettata l'icona viene da icon.icns; in sviluppo il Dock mostrerebbe quella di Electron
  if (!app.isPackaged) app.dock?.setIcon(path.join(__dirname, '..', 'build', 'icon.png'));
  // nessun permesso del browser (fotocamera, posizione, notifiche…): restano gli appunti e la rete locale del server del gruppo
  const allowed = new Set(['clipboard-sanitized-write', 'fullscreen', 'local-network', 'local-network-access', 'loopback-network']);
  session.defaultSession.setPermissionRequestHandler((_contents, permission, done) => done(allowed.has(permission)));
  groupReady = resumeGroup();
  buildMenu();
  createWindow();
  // dopo l'avvio, senza rallentarlo; poi ogni tanto, per chi tiene l'app aperta a lungo
  setTimeout(checkUpdate, 8000);
  setInterval(checkUpdate, UPDATE_EVERY).unref?.();
  // la finestra nascosta che stampa i PDF non conta
  app.on('activate', () => {
    if (!win) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
