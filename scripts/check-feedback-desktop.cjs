// node scripts/check-feedback-desktop.cjs
// Solo fetch simulato: nessun invio reale, nessuna connessione al servizio.
const assert = require('node:assert/strict');
const { submitFeedback, validateFeedbackPayload, isFeedbackSender } = require('../electron/feedback.cjs');

const SOURCE = 'https://github.com/matteodisalvo/herofig';
const payload = {
  _subject: '[HeroFig][Errore] Prova locale',
  _template: 'table',
  _url: SOURCE,
  category: 'Errore',
  reference_id: 'TF-offline-test',
  message: 'Descrizione di prova\nPassaggi per riprodurre: 1. Esporta',
};
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

async function run() {
  let calls = 0;
  const fetchImpl = async (url, init) => {
    calls++;
    assert.equal(url, 'https://formsubmit.co/ajax/disalvo.matteo@outlook.com');
    assert.equal(init.method, 'POST');
    assert.deepEqual(init.headers, { Accept: 'application/json', 'Content-Type': 'application/json', Referer: SOURCE });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error', 'Un redirect non deve inoltrare i dati a un altro endpoint.');
    assert.equal(init.signal.aborted, false);
    assert.deepEqual(JSON.parse(init.body), payload);
    return json({ success: 'true', message: 'Received' });
  };
  assert.deepEqual(await submitFeedback(payload, { fetchImpl }), { ok: true, result: { success: 'true', message: 'Received' } });
  assert.equal(calls, 1);
  console.log('✓ Endpoint/destinatario, Referer e header fissi; niente cookie o redirect');

  const minimal = { _subject: 'Prova', message: 'Test' };
  assert.deepEqual(validateFeedbackPayload(minimal), { ...minimal, _url: SOURCE, _template: 'table' });
  assert.deepEqual(minimal, { _subject: 'Prova', message: 'Test' }, 'La validazione non muta il chiamante.');
  assert.equal(validateFeedbackPayload({ ...payload, email: 'ada@example.org', _replyto: 'ada@example.org' }).email, 'ada@example.org');
  assert.equal(validateFeedbackPayload({ ...payload, message: 'A'.repeat(12_000), _subject: 'B'.repeat(200) }).message.length, 12_000);
  const malicious = [
    null, [], 'payload', new Date(), Object.create({ _subject: 'Inherited' }),
    { ...payload, endpoint: 'https://evil.example' },
    { ...payload, recipient: 'someone@example.org' },
    { ...payload, _cc: 'someone@example.org' },
    { ...payload, _webhook: 'https://evil.example' },
    { ...payload, _url: 'https://evil.example' },
    { ...payload, _template: 'custom' },
    { ...payload, _subject: 'Injected\r\nBcc: someone@example.org' },
    { ...payload, message: 'A'.repeat(12_001) },
    { ...payload, _subject: 'A'.repeat(201) },
    { ...payload, email: 'invalid email' },
    { ...payload, email: 'ada@example.org', _replyto: 'someone@example.org' },
    { ...payload, _replyto: 'someone@example.org' },
    { ...payload, name: { value: 'Invalid' } },
    { ...payload, message: ' ' },
    JSON.parse('{"_subject":"Test","message":"Test","__proto__":{"bad":true}}'),
  ];
  for (const value of malicious) {
    await assert.rejects(submitFeedback(value, { fetchImpl }), TypeError);
  }
  assert.equal(calls, 1, 'I payload rifiutati non devono produrre richieste.');
  console.log('✓ Whitelist, limiti, email e rigetto di destinatari/URL/campi riservati arbitrari');

  for (const [response, expected] of [
    [json({ success: false }, 400), { ok: false, result: { success: false } }],
    [json({ success: 'false', message: 'Please activate the form' }), { ok: true, result: { success: 'false', message: 'Please activate the form' } }],
    [new Response('<html>Proxy error</html>', { status: 502 }), { ok: false, result: null }],
  ]) {
    assert.deepEqual(await submitFeedback(payload, { fetchImpl: async () => response }), expected);
  }
  await assert.rejects(submitFeedback(payload, { fetchImpl: async () => { throw new TypeError('Network failed'); } }), /Network failed/);
  await assert.rejects(submitFeedback(payload, { fetchImpl: async () => ({ ok: true, json: async () => { throw new TypeError('Body connection lost'); } }) }), /Body connection lost/);
  console.log('✓ Risposte JSON/HTML distinte; errori di rete propagati senza conferme inventate');

  let timeoutCalls = 0;
  let signal;
  await assert.rejects(submitFeedback(payload, { timeoutMs: 5, fetchImpl: async (_url, init) => {
    timeoutCalls++;
    signal = init.signal;
    return new Promise(() => {});
  } }), /timed out/);
  assert.equal(signal.aborted, true);
  assert.equal(timeoutCalls, 1);
  console.log('✓ Timeout interrompe la richiesta; nessun retry automatico');

  const mainFrame = {};
  const webContents = { isDestroyed: () => false, mainFrame };
  const mainWindow = { isDestroyed: () => false, webContents };
  const event = { sender: webContents, senderFrame: mainFrame };
  assert.equal(isFeedbackSender(event, mainWindow), true);
  assert.equal(isFeedbackSender({ ...event, sender: {} }, mainWindow), false);
  assert.equal(isFeedbackSender({ ...event, senderFrame: {} }, mainWindow), false);
  assert.equal(isFeedbackSender(event, null), false);
  assert.equal(isFeedbackSender(event, { ...mainWindow, isDestroyed: () => true }), false);
  assert.equal(isFeedbackSender(event, { ...mainWindow, webContents: { ...webContents, isDestroyed: () => true } }), false);
  console.log('✓ IPC consentito solo alla finestra principale viva e al suo frame principale');
  console.log('5 controlli trasporto desktop superati; nessuna richiesta reale inviata.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
