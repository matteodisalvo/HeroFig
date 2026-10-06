// node --import tsx scripts/check-profile.ts
// Regressioni della persistenza e del confine fra profilo locale e figura condivisa.
import assert from 'node:assert/strict';

const PROFILE = 'herofig:profile';
const AUTHOR = 'mlsketch:author';
const storage = new Map<string, string>();
let readsBlocked = false;
let writesBlocked = false;
const blockedWrites = new Set<string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      if (readsBlocked) throw new Error('Storage unavailable');
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (writesBlocked || blockedWrites.has(key)) throw new Error('Storage unavailable');
      storage.set(key, value);
    },
  },
});

let instance = 0;
const freshProfile = () => import(new URL(`../src/profile.ts?check=${++instance}`, import.meta.url).href) as Promise<typeof import('../src/profile')>;
const defaults = { name: '', affiliation: '', role: '', color: 'violet' };
const persisted = () => JSON.parse(storage.get(PROFILE)!);
let scenarios = 0;
const check = async (name: string, test: () => Promise<void>) => {
  storage.clear();
  blockedWrites.clear();
  readsBlocked = false;
  writesBlocked = false;
  await test();
  scenarios += 1;
  console.log(`✓ ${name}`);
};

await check('Primo avvio e nome precedente: lettura senza scritture premature', async () => {
  assert.deepEqual((await freshProfile()).getProfile(), defaults);
  assert.equal(storage.size, 0);
  storage.set(AUTHOR, '  Ada Lovelace  ');
  const before = new Map(storage);
  assert.deepEqual((await freshProfile()).getProfile(), { ...defaults, name: 'Ada Lovelace' });
  assert.deepEqual(storage, before);
});

await check('Profilo completo e modifiche parziali conservati al riavvio', async () => {
  const profile = await freshProfile();
  const chosen = { name: '  Ada Lovelace ', affiliation: '  Università di Roma ', role: ' Ricercatrice ', color: 'teal' as const };
  const original = { ...chosen };
  assert.equal(profile.updateProfile(chosen), true);
  const expected = { name: 'Ada Lovelace', affiliation: 'Università di Roma', role: 'Ricercatrice', color: 'teal' };
  assert.deepEqual(profile.getProfile(), expected);
  assert.deepEqual(persisted(), { version: 1, ...expected });
  assert.equal(storage.get(AUTHOR), expected.name);
  assert.deepEqual(chosen, original, 'Non modificare la bozza del chiamante.');
  const relaunched = await freshProfile();
  assert.deepEqual(relaunched.getProfile(), expected);
  assert.equal(relaunched.updateProfile({ role: 'Docente' }), true);
  assert.deepEqual((await freshProfile()).getProfile(), { ...expected, role: 'Docente' });
});

await check('Nome svuotato esplicitamente prevale sul nome storico', async () => {
  storage.set(AUTHOR, 'Vecchio nome');
  storage.set(PROFILE, JSON.stringify({ version: 1, name: '', affiliation: 'Laboratorio', color: 'blue' }));
  const profile = await freshProfile();
  assert.equal(profile.getProfileName(), '');
  profile.updateProfile({ role: 'Studente' });
  assert.equal(storage.get(AUTHOR), '');
  storage.set(AUTHOR, 'Nome storico ripristinato');
  assert.equal((await freshProfile()).getProfileName(), '', 'Un profilo valido è la fonte autorevole anche con nome vuoto.');
});

await check('Profilo corrotto o versione sconosciuta: recupero del nome storico', async () => {
  storage.set(AUTHOR, 'Grace Hopper');
  for (const raw of ['{broken', 'null', '[]', '"Ada"', '42', '{}', '{"version":99,"name":"Da ignorare","color":"rose"}']) {
    storage.set(PROFILE, raw);
    const before = new Map(storage);
    assert.deepEqual((await freshProfile()).getProfile(), { ...defaults, name: 'Grace Hopper' }, raw);
    assert.deepEqual(storage, before, 'Il recupero non deve riscrivere dati durante il caricamento.');
  }
});

await check('Dati non validi normalizzati e campi privati sconosciuti esclusi', async () => {
  storage.set(AUTHOR, 'Nome precedente');
  storage.set(PROFILE, JSON.stringify({ version: 1, name: 42, affiliation: ['Lab'], role: null, color: 'invalid', password: 'must-not-survive' }));
  const profile = await freshProfile();
  assert.deepEqual(profile.getProfile(), { ...defaults, name: 'Nome precedente' });
  profile.updateProfile({ name: ` ${'N'.repeat(90)} `, affiliation: ` ${'A'.repeat(130)} `, role: ` ${'R'.repeat(90)} `, color: 'rose' });
  assert.deepEqual(profile.getProfile(), { name: 'N'.repeat(80), affiliation: 'A'.repeat(120), role: 'R'.repeat(80), color: 'rose' });
  assert.equal('password' in persisted(), false);
  assert.deepEqual((await freshProfile()).getProfile(), profile.getProfile());
});

await check('Storage indisponibile: dati usabili nella sessione e salvataggio fallito esplicito', async () => {
  storage.set(AUTHOR, 'Nome su disco');
  readsBlocked = true;
  writesBlocked = true;
  const before = new Map(storage);
  const profile = await freshProfile();
  assert.deepEqual(profile.getProfile(), defaults);
  assert.equal(profile.updateProfile({ name: 'Nome temporaneo', affiliation: 'Laboratorio', color: 'amber' }), false);
  assert.equal(profile.getProfileName(), 'Nome temporaneo');
  assert.equal(profile.getProfile().affiliation, 'Laboratorio');
  assert.deepEqual(storage, before);
  assert.deepEqual((await freshProfile()).getProfile(), defaults);
  readsBlocked = false;
  writesBlocked = false;
  assert.equal(profile.updateProfile({ role: 'Ricercatrice' }), true);
  assert.deepEqual((await freshProfile()).getProfile(), profile.getProfile(), 'Un successivo salvataggio deve recuperare tutta la bozza in memoria.');
});

await check('Errore sulla copia storica: il profilo già salvato resta autorevole', async () => {
  storage.set(AUTHOR, 'Nome precedente');
  const profile = await freshProfile();
  blockedWrites.add(AUTHOR);
  assert.equal(profile.updateProfile({ name: 'Nuovo nome' }), true);
  assert.equal(storage.get(AUTHOR), 'Nome precedente');
  assert.equal((await freshProfile()).getProfileName(), 'Nuovo nome');
  blockedWrites.delete(AUTHOR);
  blockedWrites.add(PROFILE);
  assert.equal(profile.updateProfile({ name: 'Solo in memoria' }), false);
  assert.equal(profile.getProfileName(), 'Solo in memoria');
  assert.equal(storage.get(AUTHOR), 'Nome precedente', 'Non migrare solo il vecchio autore quando il salvataggio principale fallisce.');
  assert.equal((await freshProfile()).getProfileName(), 'Nuovo nome');
});

await check('Aggiornamento del profilo lascia invariati documento, preferenze e connessioni', async () => {
  for (const [key, value] of [
    ['mlsketch:autosave', '{"nodes":[{"id":"keep"}],"comments":[{"author":"Autore originale"}]}'],
    ['mlsketch:prefs', '{"theme":"dark","favorites":["p:conv"]}'],
    ['mlsketch:packs', '["quantum"]'],
    ['tensorfig:language', 'en'],
    ['tensorfig:onboarding', '{"version":1,"status":"completed"}'],
    ['mlsketch:projects', '["/local/project"]'],
    ['mlsketch:group', '{"invite":"private-invite"}'],
    ['mlsketch:client', 'existing-client'],
  ]) storage.set(key, value);
  const before = new Map(storage);
  const profile = await freshProfile();
  profile.updateProfile({ name: 'Ada', affiliation: 'Private lab', role: 'Private role' });
  for (const [key, value] of before) assert.equal(storage.get(key), value, key);
  assert.deepEqual([...storage.keys()].filter((key) => !before.has(key)).sort(), [PROFILE, AUTHOR].sort());
});

await check('Nome del profilo e autore della collaborazione condividono la stessa fonte', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  storage.set(AUTHOR, 'Autore precedente');
  storage.set('mlsketch:client', 'existing-client');
  const profile = await import('../src/profile');
  const collab = await import('../src/collab');
  const store = await import('../src/store');
  const before = store.getState();
  const documentBefore = JSON.stringify(before.doc);
  assert.equal(collab.getAuthor(), 'Autore precedente');
  let notifications = 0;
  const unsubscribe = profile.subscribeProfile(() => { notifications++; });
  profile.updateProfile({ name: 'Ada', affiliation: 'Private lab', role: 'Private role' });
  assert.equal(collab.getAuthor(), 'Ada');
  collab.setAuthor('  Grace Hopper ');
  assert.deepEqual(profile.getProfile(), { name: 'Grace Hopper', affiliation: 'Private lab', role: 'Private role', color: 'violet' });
  assert.equal(notifications, 2);
  unsubscribe();
  collab.setAuthor('');
  assert.equal(profile.getProfileName(), '');
  assert.equal(notifications, 2, 'Un listener rimosso non riceve ulteriori aggiornamenti.');
  assert.equal(store.getState(), before, 'Aggiornare il profilo non deve alterare documento, dirty flag o cronologia.');
  assert.equal(JSON.stringify(store.getState().doc), documentBefore);
});

console.log(`${scenarios} controlli profilo superati.`);
