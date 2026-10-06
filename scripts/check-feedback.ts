// node --import tsx scripts/check-feedback.ts
// Fetch è sempre sostituito: questi controlli non inviano email né fanno rete.
import assert from 'node:assert/strict';
import type { FeedbackContext } from '../src/feedback';

const KEY = 'tensorfig:feedback';
const storage = new Map<string, string>();
let storageBlocked = false;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem(key: string) { if (storageBlocked) throw new Error('Storage unavailable'); return storage.get(key) ?? null; },
  setItem(key: string, value: string) { if (storageBlocked) throw new Error('Storage unavailable'); storage.set(key, value); },
} });
const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const CONTEXT: FeedbackContext = { version: '0.1.0', platform: 'Test OS', language: 'it', runtime: 'desktop' };
const fresh = (() => {
  let instance = 0;
  return () => import(new URL(`../src/feedback.ts?check=${++instance}`, import.meta.url).href) as Promise<typeof import('../src/feedback')>;
})();
type Call = { url: string; init: RequestInit; payload: Record<string, string> };
let calls: Call[] = [];
function stub(reply: (call: Call) => Promise<Response> | Response) {
  globalThis.fetch = async (input, init) => {
    const call = { url: String(input), init: init!, payload: JSON.parse(String(init?.body)) };
    calls.push(call);
    return reply(call);
  };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
let scenarios = 0;
async function check(name: string, run: () => Promise<void>) {
  storage.clear(); storageBlocked = false; calls = [];
  stub(() => { throw new Error('No network: no response configured for this test'); });
  try { await run(); scenarios++; console.log(`✓ ${name}`); }
  finally { globalThis.setTimeout = originalSetTimeout; }
}

try {
  await check('Bozze separate e persistenti; prefill non sovrascrive il lavoro', async () => {
    const feedback = await fresh();
    feedback.openFeedback('package', 'Neuroscienze');
    feedback.updateFeedbackDraft({ details: 'Forme per le sinapsi', name: 'Ada' });
    feedback.closeFeedback();
    feedback.openFeedback('package', 'Altro ambito');
    assert.equal(feedback.getFeedback().drafts.package.title, 'Neuroscienze');
    feedback.openFeedback('bug', 'Errore export');
    feedback.updateFeedbackDraft({ details: 'Descrizione del problema' });
    const relaunched = await fresh();
    assert.equal(relaunched.getFeedback().open, false);
    assert.equal(relaunched.getFeedback().drafts.package.details, 'Forme per le sinapsi');
    assert.equal(relaunched.getFeedback().drafts.bug.title, 'Errore export');
    assert.equal(relaunched.getFeedback().drafts.addition.title, '');
  });

  await check('Storage corrotto/assente e dati inattesi recuperabili; limiti applicati', async () => {
    for (const value of ['{broken', 'null', '[]', '{"version":99,"drafts":{}}', '{"version":1,"drafts":[]}']) {
      storage.set(KEY, value);
      const feedback = await fresh();
      assert.equal(feedback.getFeedback().drafts.package.title, '');
      feedback.updateFeedbackDraft({ title: 'A'.repeat(500), details: 'B'.repeat(5000), email: 'C'.repeat(300), reference: 'D'.repeat(700) });
      assert.equal(feedback.getFeedback().drafts.package.title.length, 120);
      assert.equal(feedback.getFeedback().drafts.package.details.length, 4000);
      assert.equal(feedback.getFeedback().drafts.package.email.length, 254);
      assert.equal(feedback.getFeedback().drafts.package.reference.length, 500);
    }
    storage.set(KEY, JSON.stringify({ version: 1, drafts: { package: { title: 4, includeDiagnostics: 'true' } }, receipts: { package: '<script>' } }));
    const malformed = await fresh();
    assert.equal(malformed.getFeedback().drafts.package.title, '');
    assert.equal(malformed.getFeedback().drafts.package.includeDiagnostics, false);
    storageBlocked = true;
    const feedback = await fresh();
    feedback.openFeedback('addition', 'Nuova freccia');
    feedback.updateFeedbackDraft({ details: 'Una freccia curva' });
    stub(() => json({ success: true }));
    await feedback.sendFeedback(CONTEXT);
    assert.equal(feedback.getFeedback().status, 'success');
  });

  await check('Titolo/descrizione obbligatori, email facoltativa valida, link solo HTTP(S)', async () => {
    const feedback = await fresh();
    await feedback.sendFeedback(CONTEXT);
    assert.equal(feedback.getFeedback().error, 'validation');
    feedback.updateFeedbackDraft({ title: 'Titolo' });
    await feedback.sendFeedback(CONTEXT);
    assert.equal(feedback.getFeedback().error, 'validation');
    feedback.updateFeedbackDraft({ details: 'Descrizione', email: 'invalid-email' });
    await feedback.sendFeedback(CONTEXT);
    assert.equal(feedback.getFeedback().error, 'validation');
    feedback.updateFeedbackDraft({ email: '' });
    for (const reference of ['file:///private/paper.pdf', 'javascript:alert(1)', 'data:text/plain,test', 'not a URL']) {
      feedback.updateFeedbackDraft({ reference });
      await feedback.sendFeedback(CONTEXT);
      assert.equal(feedback.getFeedback().error, 'validation', reference);
    }
    assert.equal(calls.length, 0, 'La validazione deve precedere qualsiasi richiesta.');
    feedback.updateFeedbackDraft({ email: 'ada@example.org', reference: 'https://example.org/paper?q=1&v=2' });
    stub(() => json({ success: true }));
    await feedback.sendFeedback(CONTEXT);
    assert.equal(feedback.getFeedback().status, 'success');
    assert.equal(calls[0].payload.email, 'ada@example.org');
    assert.equal(calls[0].payload._replyto, 'ada@example.org');
  });

  await check('Conferma boolean/string: invio JSON, oggetti stabili e cancellazione selettiva', async () => {
    for (const success of [true, 'true']) {
      storage.clear(); calls = [];
      const feedback = await fresh();
      feedback.openFeedback('package', 'Conserva questa bozza');
      feedback.updateFeedbackDraft({ details: 'Dettagli da conservare' });
      feedback.openFeedback('bug', 'PNG esportato male & simbolo α');
      feedback.updateFeedbackDraft({ details: 'Descrizione\nSeconda riga', steps: '1. Esporta', expected: 'Testo leggibile' });
      stub(() => json({ success }));
      await feedback.sendFeedback(CONTEXT);
      const state = feedback.getFeedback();
      assert.equal(state.status, 'success');
      assert.equal(state.drafts.bug.title, '');
      assert.equal(state.drafts.package.title, 'Conserva questa bozza');
      assert.match(state.lastReceipt!, /^TF-/);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, 'https://formsubmit.co/ajax/disalvo.matteo@outlook.com');
      assert.equal(calls[0].init.method, 'POST');
      assert.deepEqual(calls[0].init.headers, { Accept: 'application/json', 'Content-Type': 'application/json' });
      assert.equal(calls[0].payload._subject, '[HeroFig][Errore] PNG esportato male & simbolo α');
      assert.equal(calls[0].payload._template, 'table');
      assert.match(calls[0].payload.message, /Descrizione\nSeconda riga/);
      assert.equal(calls[0].payload.reference_id, state.lastReceipt);
      assert.equal((await fresh()).getFeedback().drafts.bug.title, '');
      await feedback.sendFeedback(CONTEXT);
      assert.equal(calls.length, 1, 'La schermata di successo non deve consentire un secondo invio.');
      feedback.newFeedback();
      assert.equal(feedback.getFeedback().status, 'idle');
      assert.equal(feedback.getFeedback().lastReceipt, null);
    }
  });

  await check('Errori HTTP/JSON, HTML inatteso, rete e attivazione conservano la bozza', async () => {
    const cases: [() => Response, string][] = [
      [() => json({ message: 'Unavailable' }, 503), 'rejected'],
      [() => json({ success: false, message: 'Rejected' }), 'rejected'],
      [() => json({ success: 'false' }), 'rejected'],
      [() => json({ error: 'Invalid request' }), 'rejected'],
      [() => new Response('<html>Unexpected proxy response</html>'), 'unconfirmed'],
      [() => json({ message: 'No explicit confirmation' }), 'unconfirmed'],
      [() => json({ success: 1 }), 'unconfirmed'],
      [() => { throw new TypeError('Network failed'); }, 'unconfirmed'],
      [() => json({ success: true, message: 'Please activate this form by clicking the activation link.' }), 'activation'],
      [() => json({ success: false, message: 'This form has not been activated yet.' }), 'activation'],
    ];
    for (const [reply, error] of cases) {
      storage.clear();
      const feedback = await fresh();
      feedback.openFeedback('addition', 'Aggiunta');
      feedback.updateFeedbackDraft({ details: 'Dettagli conservati' });
      stub(reply);
      await feedback.sendFeedback(CONTEXT);
      assert.equal(feedback.getFeedback().status, 'error');
      assert.equal(feedback.getFeedback().error, error);
      assert.equal(feedback.getFeedback().drafts.addition.details, 'Dettagli conservati');
      assert.equal((await fresh()).getFeedback().drafts.addition.details, 'Dettagli conservati');
    }
  });

  await check('Offline: nessuna richiesta, errore esplicito, bozza conservata', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    try {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
      const feedback = await fresh();
      feedback.openFeedback('bug', 'Errore offline');
      feedback.updateFeedbackDraft({ details: 'Dettagli offline' });
      await feedback.sendFeedback(CONTEXT);
      assert.equal(feedback.getFeedback().status, 'error');
      assert.equal(feedback.getFeedback().error, 'network');
      assert.equal(feedback.getFeedback().lastReceipt, null, 'Nessun riferimento per un invio mai partito.');
      assert.equal(calls.length, 0);
      assert.equal((await fresh()).getFeedback().drafts.bug.details, 'Dettagli offline');
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
      stub(() => json({ success: true }));
      await feedback.sendFeedback(CONTEXT);
      assert.equal(feedback.getFeedback().status, 'success');
      assert.equal(calls.length, 1);
    } finally {
      if (previous) Object.defineProperty(globalThis, 'navigator', previous);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  await check('Riferimento stabile al retry e riavvio, nuovo dopo una modifica', async () => {
    const feedback = await fresh();
    feedback.openFeedback('package', 'Titolo');
    feedback.updateFeedbackDraft({ details: 'Dettagli' });
    stub(() => { throw new TypeError('Connection dropped'); });
    await feedback.sendFeedback(CONTEXT);
    const first = feedback.getFeedback().lastReceipt;
    await feedback.sendFeedback(CONTEXT);
    assert.equal(feedback.getFeedback().lastReceipt, first);
    const relaunched = await fresh();
    await relaunched.sendFeedback(CONTEXT);
    assert.equal(relaunched.getFeedback().lastReceipt, first);
    relaunched.updateFeedbackDraft({ details: 'Nuovi dettagli' });
    await relaunched.sendFeedback(CONTEXT);
    assert.notEqual(relaunched.getFeedback().lastReceipt, first);
    assert.equal(calls.length, 4);
    assert.equal(calls[0].payload.reference_id, calls[2].payload.reference_id);
  });

  await check('Concorrenza: un solo invio; chiusura non perde o altera la richiesta', async () => {
    const feedback = await fresh();
    feedback.openFeedback('addition', 'Titolo iniziale');
    feedback.updateFeedbackDraft({ details: 'Dettagli iniziali' });
    let finish!: (value: Response) => void;
    stub(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const pending = feedback.sendFeedback(CONTEXT);
    assert.equal(feedback.getFeedback().status, 'sending');
    await feedback.sendFeedback(CONTEXT);
    feedback.updateFeedbackDraft({ title: 'Modifica mentre invia' });
    feedback.setFeedbackKind('bug');
    feedback.newFeedback();
    feedback.closeFeedback();
    assert.equal(feedback.getFeedback().open, false);
    feedback.openFeedback('bug', 'Altro problema');
    assert.equal(feedback.getFeedback().kind, 'addition');
    assert.equal(feedback.getFeedback().drafts.addition.title, 'Titolo iniziale');
    assert.equal(calls.length, 1);
    finish(json({ success: true }));
    await pending;
    assert.equal(feedback.getFeedback().status, 'success');
  });

  await check('Timeout a 20 secondi: abort, esito incerto, nessun retry automatico', async () => {
    const feedback = await fresh();
    feedback.openFeedback('bug', 'Errore');
    feedback.updateFeedbackDraft({ details: 'Dettagli' });
    let timeoutCallback!: () => void;
    let delay: number | undefined;
    globalThis.setTimeout = ((callback: () => void, milliseconds?: number) => {
      timeoutCallback = callback; delay = milliseconds; return 999999;
    }) as typeof globalThis.setTimeout;
    stub(() => new Promise<Response>(() => {}));
    const pending = feedback.sendFeedback(CONTEXT);
    assert.equal(delay, 20_000);
    timeoutCallback();
    await pending;
    assert.equal(calls[0].init.signal?.aborted, true);
    assert.equal(feedback.getFeedback().error, 'unconfirmed');
    assert.equal(feedback.getFeedback().drafts.bug.details, 'Dettagli');
    assert.equal(calls.length, 1);
  });

  await check('Privacy: solo origine del sito, niente cookie, email assente, diagnostica solo con consenso nei bug', async () => {
    for (const kind of ['package', 'addition', 'bug'] as const) {
      for (const includeDiagnostics of [false, true]) {
        const feedback = await fresh();
        feedback.openFeedback(kind, 'Richiesta');
        feedback.updateFeedbackDraft({ details: 'Dettagli', steps: 'Passaggio', expected: 'Atteso', includeDiagnostics });
        stub(() => json({ success: true }));
        await feedback.sendFeedback(CONTEXT);
        const call = calls.at(-1)!;
        assert.equal(call.payload._url, 'https://github.com/matteodisalvo/herofig');
        assert.equal(call.init.credentials, 'omit');
        assert.equal(call.init.referrerPolicy, 'origin');
        assert.equal('email' in call.payload, false);
        assert.equal('_replyto' in call.payload, false);
        assert.equal(call.payload.message.includes('Test OS'), kind === 'bug' && includeDiagnostics);
        assert.equal(call.payload.message.includes('Passaggio'), kind === 'bug');
        assert.equal(call.payload.message.includes('Atteso'), kind === 'bug');
        assert.equal(call.payload.message.includes('Informazioni tecniche:'), kind === 'bug' && includeDiagnostics);
      }
    }
  });

  await check('Desktop: invio tramite il canale nativo, senza fetch dal documento file://', async () => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    try {
      const nativePayloads: Record<string, string>[] = [];
      Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        api: { feedbackSubmit: async (payload: Record<string, string>) => {
          nativePayloads.push(payload);
          return { ok: true, result: { success: 'true' } };
        } },
      } });
      const feedback = await fresh();
      feedback.openFeedback('package', 'Prova desktop');
      feedback.updateFeedbackDraft({ details: 'Nessun percorso locale' });
      await feedback.sendFeedback(CONTEXT);
      assert.equal(feedback.getFeedback().status, 'success');
      assert.equal(calls.length, 0);
      assert.equal(nativePayloads.length, 1);
      assert.equal(nativePayloads[0].category, 'Nuovo pacchetto');
    } finally {
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });

  console.log(`${scenarios} controlli feedback superati; nessuna richiesta reale inviata.`);
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
}
