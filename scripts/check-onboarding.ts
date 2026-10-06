// node --import tsx scripts/check-onboarding.ts
// Regressioni dello stato persistente, senza montare o simulare l'interfaccia.
import assert from 'node:assert/strict';

const ONBOARDING = 'tensorfig:onboarding';
const PACKS = 'mlsketch:packs';
const storage = new Map<string, string>();
let readsBlocked = false;
let writesBlocked = false;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      if (readsBlocked) throw new Error('Storage unavailable');
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (writesBlocked) throw new Error('Storage unavailable');
      storage.set(key, value);
    },
  },
});

let instance = 0;
const freshOnboarding = () => import(new URL(`../src/onboarding.ts?check=${++instance}`, import.meta.url).href) as Promise<typeof import('../src/onboarding')>;
const freshPacks = () => import(new URL(`../src/packs.ts?check=${++instance}`, import.meta.url).href) as Promise<typeof import('../src/packs')>;
const reset = () => { storage.clear(); readsBlocked = false; writesBlocked = false; };
const persisted = (key: string) => JSON.parse(storage.get(key)!);
let scenarios = 0;
const check = async (name: string, test: () => Promise<void>) => {
  reset();
  await test();
  scenarios += 1;
  console.log(`✓ ${name}`);
};

await check('Primo avvio: configurazione aperta senza scritture premature', async () => {
  const onboarding = await freshOnboarding();
  assert.deepEqual(onboarding.getOnboarding(), { open: true, status: 'pending' });
  assert.equal(storage.has(ONBOARDING), false);
});

await check('Completamento ricordato anche chiudendo sulla schermata finale', async () => {
  const onboarding = await freshOnboarding();
  onboarding.completeOnboarding();
  assert.deepEqual(onboarding.getOnboarding(), { open: true, status: 'completed' });
  assert.equal(persisted(ONBOARDING).status, 'completed');
  const relaunched = await freshOnboarding();
  assert.deepEqual(relaunched.getOnboarding(), { open: false, status: 'completed' });
  onboarding.closeOnboarding();
  assert.deepEqual(onboarding.getOnboarding(), { open: false, status: 'completed' });
});

await check('Salta per ora: non riappare al riavvio, resta completabile dal menu', async () => {
  const onboarding = await freshOnboarding();
  onboarding.closeOnboarding();
  assert.deepEqual(onboarding.getOnboarding(), { open: false, status: 'skipped' });
  const relaunched = await freshOnboarding();
  assert.deepEqual(relaunched.getOnboarding(), { open: false, status: 'skipped' });
  relaunched.openOnboarding();
  assert.deepEqual(relaunched.getOnboarding(), { open: true, status: 'skipped' });
  relaunched.completeOnboarding();
  assert.deepEqual((await freshOnboarding()).getOnboarding(), { open: false, status: 'completed' });
});

await check('Riapertura e annullamento conservano stato, profilo, pacchetti e documento', async () => {
  for (const status of ['completed', 'skipped']) {
    storage.set(ONBOARDING, JSON.stringify({ version: 1, status }));
    storage.set('mlsketch:author', 'Ada');
    storage.set(PACKS, JSON.stringify(['quantum']));
    storage.set('mlsketch:prefs', JSON.stringify({ theme: 'dark', favorites: ['p:conv'] }));
    storage.set('mlsketch:autosave', JSON.stringify({ nodes: [{ id: 'figure-in-progress' }], comments: [{ text: 'Keep me' }] }));
    const before = new Map(storage);
    const onboarding = await freshOnboarding();
    onboarding.openOnboarding();
    assert.deepEqual(onboarding.getOnboarding(), { open: true, status });
    onboarding.closeOnboarding();
    assert.deepEqual(onboarding.getOnboarding(), { open: false, status });
    assert.deepEqual(storage, before);
  }
});

await check('Preferenza corrotta o versione sconosciuta: ripartenza recuperabile', async () => {
  for (const raw of ['{broken', 'null', '[]', '"completed"', '{"version":1,"status":"unknown"}', '{"version":99,"status":"completed"}']) {
    storage.set(ONBOARDING, raw);
    const onboarding = await freshOnboarding();
    assert.deepEqual(onboarding.getOnboarding(), { open: true, status: 'pending' }, raw);
    onboarding.closeOnboarding();
    assert.deepEqual((await freshOnboarding()).getOnboarding(), { open: false, status: 'skipped' });
  }
});

await check('Storage indisponibile: chiusura e completamento funzionano nella sessione', async () => {
  readsBlocked = true;
  writesBlocked = true;
  const onboarding = await freshOnboarding();
  assert.deepEqual(onboarding.getOnboarding(), { open: true, status: 'pending' });
  onboarding.closeOnboarding();
  assert.deepEqual(onboarding.getOnboarding(), { open: false, status: 'skipped' });
  onboarding.openOnboarding();
  onboarding.completeOnboarding();
  onboarding.closeOnboarding();
  assert.deepEqual(onboarding.getOnboarding(), { open: false, status: 'completed' });
  assert.equal(storage.size, 0);
  assert.deepEqual((await freshOnboarding()).getOnboarding(), { open: true, status: 'pending' });
});

await check('Pacchetti: scelta valida in blocco, senza modificare documento o preferenze', async () => {
  storage.set('mlsketch:autosave', '{"nodes":[{"id":"keep"}]}');
  storage.set('mlsketch:prefs', '{"theme":"dark"}');
  const before = new Map(storage);
  const packs = await freshPacks();
  const chosen = new Set(['quantum', 'chimica', 'unknown-pack']);
  packs.setInstalledPacks(chosen);
  assert.deepEqual(persisted(PACKS), ['quantum', 'chimica']);
  assert.deepEqual([...chosen], ['quantum', 'chimica', 'unknown-pack'], 'Non mutare la selezione del chiamante.');
  for (const [key, value] of before) assert.equal(storage.get(key), value);
  const relaunched = await freshPacks();
  relaunched.setInstalled('quantum', false);
  assert.deepEqual(persisted(PACKS), ['chimica'], 'Il riavvio deve caricare la scelta appena salvata.');
});

await check('Solo libreria di base: selezione vuota persistente, senza ripristinare i predefiniti', async () => {
  const packs = await freshPacks();
  packs.setInstalledPacks([]);
  assert.deepEqual(persisted(PACKS), []);
  const relaunched = await freshPacks();
  relaunched.setInstalled('quantum', true);
  assert.deepEqual(persisted(PACKS), ['quantum']);
});

console.log(`${scenarios} controlli onboarding superati.`);
