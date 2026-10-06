// Prepara la versione web per uno Space "static" di Hugging Face: copia la build di dist/ in space/
// con il README che descrive lo Space. La pubblicazione la fa l'utente col proprio account (vedi sotto).
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve('space');
if (!existsSync('dist/index.html')) {
  console.error('Manca la build: esegui prima «npm run build».');
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
cpSync('dist', out, { recursive: true });
writeFileSync(
  path.join(out, 'README.md'),
  `---
title: HeroFig
emoji: 🧊
colorFrom: indigo
colorTo: blue
sdk: static
app_file: index.html
pinned: false
short_description: Figures for scientific papers, with TikZ export
---

# HeroFig

Figures for scientific papers, drawn at the size they will be printed, with export to SVG, PDF, PNG and TikZ.
Everything runs in the browser: figures are saved on your own computer.
The desktop app for macOS and Windows: https://github.com/matteodisalvo/herofig
`,
);
console.log(`Versione web pronta in ${out}

Per pubblicarla su Hugging Face (serve un account):
  1. crea uno Space di tipo "Static" chiamato herofig: https://huggingface.co/new-space
  2. accedi dal terminale:        hf auth login
  3. carica i file:               hf upload <tuo-nome>/herofig space . --repo-type=space`);
