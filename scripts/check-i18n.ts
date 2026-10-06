// node --import tsx scripts/check-i18n.ts
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { setupMessages } from '../src/locales/setup';
import { editorMessages } from '../src/locales/editor';
import { panelsMessages } from '../src/locales/panels';
import { nativeMessages } from '../src/locales/native';
import { paperMessages } from '../src/locales/paper';
import { feedbackMessages } from '../src/locales/feedback';
import { profileMessages } from '../src/locales/profile';
import { libraryMessages } from '../src/locales/library';

const storage = new Map<string, string>();
let blocked = false;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => { if (blocked) throw Error('unavailable'); return storage.get(key) ?? null; },
  setItem: (key: string, value: string) => { if (blocked) throw Error('unavailable'); storage.set(key, value); },
} });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { languages: ['fr-CA', 'en-US'], language: 'fr-CA' } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
let instance = 0;
const fresh = () => import(new URL(`../src/i18n.ts?check=${++instance}`, import.meta.url).href) as Promise<typeof import('../src/i18n')>;
const { NATIVE_SOURCES } = await import('../src/native-language');
const { nativeText, setNativeLanguage, localizeMenu } = createRequire(import.meta.url)('../electron/language.cjs');
const module = await fresh();
const languages = module.LANGUAGES.map((item) => item.id);
const catalogs = { setupMessages, editorMessages, panelsMessages, nativeMessages, paperMessages, feedbackMessages, profileMessages, libraryMessages };
const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
let count = 0;
for (const [name, catalog] of Object.entries(catalogs)) {
  const keys = new Set(Object.values(catalog).flatMap((messages) => Object.keys(messages)));
  for (const language of languages.filter((id) => id !== 'it')) {
    for (const key of keys) {
      const value = catalog[language]?.[key];
      assert.ok(typeof value === 'string' && value.trim(), `${name}/${language}: ${key}`);
      assert.deepEqual(placeholders(value), placeholders(key), `${name}/${language}: placeholder ${key}`);
      count++;
    }
  }
}
console.log(`✓ ${count} traduzioni complete, con placeholder coerenti in tutte le 12 lingue`);

// t() legge il primo catalogo che ha la chiave: un doppione altrove non verrebbe mai mostrato.
const owners = new Map<string, string>();
for (const [name, catalog] of Object.entries(catalogs)) {
  for (const key of new Set(Object.values(catalog).flatMap((messages) => Object.keys(messages)))) {
    assert.ok(!owners.has(key), `${name}: «${key}» è già in ${owners.get(key)}`);
    owners.set(key, name);
  }
}
console.log('✓ Ogni testo sorgente compare in un solo catalogo');

// Nomi di blocchi, modelli e forme: un nome italiano senza traduzione resterebbe
// in italiano in ogni lingua. Le parole italiane note sono quelle che le traduzioni
// esistenti hanno cambiato; i nomi già in inglese non servono nel catalogo.
await import('../src/domains/index');
const { allPresets, SHAPE_NAMES } = await import('../src/model');
const { allTemplates } = await import('../src/templates');
const { registeredShapes } = await import('../src/registry');
const words = (text: string) => text.toLowerCase().match(/[a-zà-ÿ]{3,}/g) ?? [];
const englishWords = [...new Set(Object.values(libraryMessages.en).flatMap(words))];
const italianWords = new Set(Object.keys(libraryMessages.en).flatMap(words).filter((word) => !englishWords.some((english) => english.startsWith(word))));
const italianGrammar = /(?<=^|\s)(di|del|dei|della|delle|degli|dello|dal|dalla|dai|con|per|sul|sulla|sui|tra|fra|il|gli|una|nel|nella|nei|alla|ai|e|ed)(?=\s|$)|[àèéìòù]/i;
const libraryNames = [...new Set([
  ...allPresets().map((preset) => preset.name),
  ...allTemplates().map((template) => template.name),
  ...Object.values(SHAPE_NAMES),
  ...registeredShapes().map((shape) => shape.name),
])];
const untranslated = libraryNames.filter((name) => !Object.values(catalogs).some((catalog) => catalog.en?.[name] !== undefined)
  && (italianGrammar.test(name) || words(name).some((word) => italianWords.has(word))));
assert.deepEqual(untranslated, [], `Nomi della libreria in italiano senza traduzione (src/locales/library.ts): ${untranslated.join(' · ')}`);
console.log(`✓ ${libraryNames.length} nomi di blocchi, modelli e forme in inglese o tradotti in tutte le 12 lingue`);

for (const key of NATIVE_SOURCES) {
  for (const language of languages.filter((id) => id !== 'it')) {
    assert.ok(Object.values(catalogs).some((catalog) => catalog[language]?.[key]), `Menu nativo: ${language}/${key}`);
  }
}
console.log('✓ Menu e dialoghi nativi coperti in ogni lingua');

assert.equal(module.getLanguagePreference(), 'system');
assert.equal(module.getLanguage(), 'fr');
assert.equal(storage.size, 0);
console.log('✓ Primo avvio: rilevamento della lingua di sistema senza scritture');

module.setLanguage('ja', { persist: false });
assert.equal(module.getLanguage(), 'ja');
assert.equal(module.t('Continua'), '次へ');
assert.equal(storage.size, 0);
module.setLanguage('system', { persist: false });
assert.equal(module.getLanguage(), 'fr');
console.log('✓ Anteprima immediata e annullamento senza alterare la preferenza salvata');

module.setLanguage('de');
assert.equal(storage.get('tensorfig:language'), 'de');
assert.equal((await fresh()).getLanguage(), 'de');
module.setLanguage('system');
assert.equal((await fresh()).getLanguagePreference(), 'system');
console.log('✓ Scelta esplicita e scelta di sistema conservate al riavvio');

storage.set('tensorfig:language', 'not-a-language');
assert.equal((await fresh()).getLanguage(), 'fr');
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { languages: ['nl-NL', 'ja-JP'], language: 'nl-NL' } });
assert.equal((await fresh()).getLanguage(), 'ja');
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { languages: ['nl-NL'], language: 'nl-NL' } });
assert.equal((await fresh()).getLanguage(), 'en');
console.log('✓ Preferenza non valida e lingue di sistema non disponibili recuperate');

for (const language of languages) {
  module.setLanguage(language, { persist: false });
  const name = 'Ada {count} <test> $&';
  assert.ok(module.t('Buon lavoro, {name}.', { name }).includes(name));
  assert.equal(module.t('A user-authored figure title'), 'A user-authored figure title');
}
module.setLanguage('en', { persist: false });
assert.equal(module.t('Annulla'), 'Cancel');
assert.equal(module.t('Annulla modifica'), 'Undo');
assert.equal(module.t('Nodo di split'), 'Split node');
assert.equal(module.translateTo('ja', 'Tua immagine'), libraryMessages.ja['Tua immagine']);
console.log('✓ Input utente preservato; Annulla e Undo distinti');

blocked = true;
const unavailable = await fresh();
unavailable.setLanguage('ar');
assert.equal(unavailable.getLanguage(), 'ar');
assert.equal(unavailable.t('Continua'), 'متابعة');
blocked = false;
console.log('✓ Lingua utilizzabile anche senza accesso allo storage');

assert.equal(setNativeLanguage({ language: 'en', labels: { File: 'File', 'Annulla': 'Cancel', 'Annulla modifica': 'Undo' } }), true);
const click = () => {};
const menu = [{ label: 'File', submenu: [{ label: 'Annulla modifica', accelerator: 'CmdOrCtrl+Z', click }] }];
const localized = localizeMenu(menu);
assert.equal(localized[0].submenu[0].label, 'Undo');
assert.equal(localized[0].submenu[0].click, click);
assert.equal(menu[0].submenu[0].label, 'Annulla modifica');
assert.equal(nativeText('Annulla'), 'Cancel');
assert.equal(setNativeLanguage({ language: 'xx', labels: { File: 'Bad' } }), false);
assert.equal(setNativeLanguage({ language: 'en', labels: { File: 42 } }), false);
assert.equal(nativeText('File'), 'File');
console.log('✓ Traduzione dei menu nativi conserva comandi e scorciatoie e rifiuta payload invalidi');
