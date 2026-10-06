// Impacchetta l'app in release/.
//   npm run dist        → HeroFig.app per questo Mac (veloce, per provarla)
//   npm run dist:mac    → HeroFig-<versione>-macOS-arm64.dmg e -x64.dmg (Apple silicon e Intel)
//   npm run dist:win    → HeroFig-<versione>-Windows-Setup.exe (si può costruire anche da Mac)
// electron-builder rifiuta cartelle di output con caratteri speciali della shell (come la "&" nel nome di
// questa cartella), quindi si costruisce in una cartella temporanea e poi si copia il risultato in release/.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const cli = path.join(path.dirname(require.resolve('electron-builder/package.json')), 'cli.js');
const electronDist = path.join(path.dirname(require.resolve('electron/package.json')), 'dist');
const out = mkdtempSync(path.join(tmpdir(), 'herofig-'));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const win = process.argv.includes('--win') || (process.platform === 'win32' && !process.argv.includes('--mac'));
const dmg = process.argv.includes('--dmg');

const build = (args) => execFileSync(process.execPath, [cli, ...args, `-c.directories.output=${out}`, '--publish', 'never'], { stdio: 'inherit', env });
const copyOut = (ext) => {
  const files = readdirSync(out).filter((f) => f.endsWith(ext));
  if (!files.length) throw new Error(`electron-builder non ha prodotto file ${ext}`);
  for (const f of files) cpSync(path.join(out, f), path.resolve('release', f));
  return files.map((f) => path.resolve('release', f));
};

try {
  mkdirSync('release', { recursive: true });
  if (win) {
    // il runtime di Electron per Windows si scarica la prima volta
    build(['--win']);
    console.log(`\nInstaller pronto: ${copyOut('.exe').join(', ')}`);
  } else if (dmg) {
    build(['--mac', 'dmg', '--arm64', '--x64']);
    console.log(`\nImmagini disco pronte:\n  ${copyOut('.dmg').join('\n  ')}`);
  } else {
    const args = ['--mac', '--dir', `--${process.arch}`];
    // Riusa il runtime installato: evita un nuovo download durante il packaging offline.
    if (existsSync(path.join(electronDist, 'Electron.app'))) args.push(`-c.electronDist=${electronDist}`);
    build(args);
    const archDir = readdirSync(out).find((d) => d.startsWith('mac'));
    const appName = readdirSync(path.join(out, archDir)).find((f) => f.endsWith('.app'));
    const target = path.resolve('release', appName);
    rmSync(target, { recursive: true, force: true });
    // ditto conserva symlink e firma del bundle
    execFileSync('ditto', [path.join(out, archDir, appName), target]);
    console.log(`\nApp pronta: ${target}`);
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}
