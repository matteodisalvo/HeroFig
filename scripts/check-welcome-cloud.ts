// node --import tsx scripts/check-welcome-cloud.ts
import assert from 'node:assert/strict';
import { setupMessages } from '../src/locales/setup';

// The catalog imports i18n; avoid activating Node's browser-storage shim.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => null },
});
const { LANGUAGES } = await import('../src/i18n');
const { WELCOME_GREETINGS, WELCOME_SLOT_MS, welcomeFrame, welcomeSequence } = await import('../src/components/welcome-cloud');

const languages = LANGUAGES.map(({ id }) => id);
const count = languages.length;
const cycle = WELCOME_SLOT_MS * count;
assert.equal(count, 12);
assert.deepEqual(WELCOME_GREETINGS.map(({ language }) => language), languages);
for (const greeting of WELCOME_GREETINGS) {
  assert.ok(greeting.text.trim(), `Saluto mancante: ${greeting.language}`);
  assert.equal(greeting.text, greeting.language === 'it' ? 'BENVENUTO' : setupMessages[greeting.language]['BENVENUTO']);
}
console.log('✓ Tutte le 12 lingue usano il saluto completo del catalogo');

for (const first of languages) {
  const sequence = welcomeSequence(first);
  assert.equal(sequence[0].language, first);
  assert.equal(sequence.length, count);
  assert.equal(new Set(sequence.map(({ language }) => language)).size, count);
  assert.deepEqual(sequence.map(({ language }) => language).sort(), [...languages].sort());
  const seen = new Set<string>();
  for (let slot = 0; slot < count; slot++) {
    const frame = welcomeFrame(slot * WELCOME_SLOT_MS + 2_100, count);
    seen.add(sequence[frame.index].language);
    assert.equal(frame.opacity, 1);
    assert.equal(frame.diffusion, 0);
  }
  assert.equal(seen.size, count);
}
assert.deepEqual(WELCOME_GREETINGS.map(({ language }) => language), languages, 'La rotazione non modifica il catalogo');
console.log('✓ Ogni lingua può iniziare il ciclo; tutti i 12 saluti appaiono una volta');

assert.deepEqual(welcomeFrame(0, count), { index: 0, progress: 0, diffusion: 1, opacity: 0 });
for (const time of [1_200, 2_100, 3_000]) {
  const frame = welcomeFrame(time, count);
  assert.equal(frame.opacity, 1, 'Il saluto rimane leggibile per 1,8 secondi');
  assert.equal(frame.diffusion, 0);
}
const revealing = welcomeFrame(600, count);
const dissolving = welcomeFrame(3_600, count);
assert.equal(revealing.opacity, 0.5);
assert.equal(dissolving.opacity, 0.5);
assert.ok(welcomeFrame(300, count).opacity < welcomeFrame(900, count).opacity);
assert.ok(welcomeFrame(3_300, count).opacity > welcomeFrame(3_900, count).opacity);
console.log('✓ Diffusione morbida in entrata e uscita, con pausa centrale leggibile');

const last = welcomeFrame(cycle - 1, count);
assert.equal(last.index, count - 1);
assert.ok(last.opacity < 0.00001, 'Il saluto precedente scompare prima del cambio');
assert.deepEqual(welcomeFrame(cycle, count), welcomeFrame(0, count));
assert.deepEqual(welcomeFrame(cycle + 600, count), welcomeFrame(600, count));
for (const cycles of [1, 12, 10_000, 1_000_000]) {
  for (const offset of [0, 600, 2_100, 4_199, cycle - 1]) {
    assert.deepEqual(welcomeFrame(cycles * cycle + offset, count), welcomeFrame(offset, count));
  }
}
assert.deepEqual(welcomeFrame(-1, count), last);
console.log('✓ Ripetizione automatica senza salto visibile, stabile anche dopo molti cicli');

for (const elapsed of [-cycle - 17, -1, 0, 17, cycle - 1, cycle, 100_000 * cycle + 17, NaN, Infinity]) {
  for (const length of [count, 1, 0, -1, NaN, Infinity]) {
    const frame = welcomeFrame(elapsed, length);
    assert.ok(Number.isFinite(frame.index) && frame.index >= 0);
    for (const value of [frame.progress, frame.opacity, frame.diffusion]) {
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    }
  }
}
console.log('✓ Valori del fotogramma finiti e limitati anche con input non validi');
