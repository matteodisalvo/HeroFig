// node --import tsx scripts/check-update.ts
// L'avviso di aggiornamento (electron/update.cjs): confronto delle versioni, scelta del file per ogni computer e rifiuto dei
// file senza impronta o fuori dalla release di HeroFig. Nessuna richiesta di rete: GitHub è finto.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { check, newer, pickAsset } = require('../electron/update.cjs');

assert.equal(newer('v1.10.0', '1.9.9'), true);
assert.equal(newer('1.0.1', '1.0.0'), true);
assert.equal(newer('1.0.0', '1.0.0'), false);
assert.equal(newer('0.9.9', '1.0.0'), false);
assert.equal(newer('v2.0.0-beta', '1.0.0'), false);
console.log('✓ Versioni confrontate per numero (1.10 dopo 1.9), anteprime ignorate');

const base = 'https://github.com/matteodisalvo/HeroFig/releases/download/v1.1.0/';
const digest = `sha256:${'a'.repeat(64)}`;
const assets = ['macOS-arm64.dmg', 'macOS-x64.dmg', 'Windows-Setup.exe'].map((end) => ({ name: `HeroFig-1.1.0-${end}`, size: 1000, digest, browser_download_url: base + `HeroFig-1.1.0-${end}` }));
assert.equal(pickAsset(assets, 'darwin', 'arm64')?.name, 'HeroFig-1.1.0-macOS-arm64.dmg');
assert.equal(pickAsset(assets, 'darwin', 'x64')?.name, 'HeroFig-1.1.0-macOS-x64.dmg');
assert.equal(pickAsset(assets, 'win32', 'x64')?.name, 'HeroFig-1.1.0-Windows-Setup.exe');
assert.equal(pickAsset(assets, 'linux', 'x64'), null);
assert.equal(pickAsset([{ ...assets[0], digest: undefined }], 'darwin', 'arm64'), null);
assert.equal(pickAsset([{ ...assets[0], browser_download_url: 'https://example.com/HeroFig-1.1.0-macOS-arm64.dmg' }], 'darwin', 'arm64'), null);
console.log('✓ Il file giusto per Mac Apple, Mac Intel e Windows; niente file senza impronta o da altri indirizzi');

const github = (release: unknown, ok = true) => async () => ({ ok, status: ok ? 200 : 503, json: async () => release });
const release = { tag_name: 'v1.1.0', html_url: 'https://github.com/matteodisalvo/HeroFig/releases/tag/v1.1.0', body: 'Novità', assets };
const found = await check({ fetch: github(release), current: '1.0.0', platform: 'darwin', arch: 'arm64' });
assert.equal(found?.version, '1.1.0');
assert.equal(found?.asset?.sha256, 'a'.repeat(64));
assert.equal(await check({ fetch: github(release), current: '1.1.0', platform: 'darwin', arch: 'arm64' }), null);
assert.equal(await check({ fetch: github({ ...release, prerelease: true }), current: '1.0.0', platform: 'darwin', arch: 'arm64' }), null);
await assert.rejects(check({ fetch: github(null, false), current: '1.0.0', platform: 'darwin', arch: 'arm64' }));
console.log('✓ Avviso solo per una release più nuova e pubblicata; GitHub che non risponde non avvisa');
