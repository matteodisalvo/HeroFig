// Trasporto desktop limitato al servizio di feedback dell'app. Non espone un
// proxy HTTP generico e non usa URL, destinatari o header scelti dal renderer.
const ENDPOINT = 'https://formsubmit.co/ajax/disalvo.matteo@outlook.com';
const SOURCE_URL = 'https://github.com/matteodisalvo/herofig';
const TIMEOUT_MS = 20_000;
const LIMITS = Object.freeze({
  _subject: 200,
  _template: 20,
  _url: 500,
  category: 100,
  reference_id: 100,
  message: 12_000,
  name: 100,
  email: 254,
  _replyto: 254,
});

function validateFeedbackPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError('Invalid feedback payload');
  }
  const payload = {};
  for (const [key, text] of Object.entries(value)) {
    if (!Object.hasOwn(LIMITS, key) || typeof text !== 'string' || text.length > LIMITS[key]) {
      throw new TypeError('Invalid feedback field');
    }
    if (key !== 'message' && /[\r\n\0]/.test(text)) throw new TypeError('Invalid feedback field');
    payload[key] = text;
  }
  if (!payload._subject?.trim() || !payload.message?.trim()) throw new TypeError('Incomplete feedback payload');
  if (payload._url !== undefined && payload._url !== SOURCE_URL) throw new TypeError('Invalid feedback source');
  if (payload._template !== undefined && payload._template !== 'table') throw new TypeError('Invalid feedback template');
  if (payload.email !== undefined && !/^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(payload.email)) {
    throw new TypeError('Invalid feedback email');
  }
  if (payload._replyto !== undefined && payload._replyto !== payload.email) throw new TypeError('Invalid feedback reply address');
  // Manteniamo un'identità pubblica costante: niente percorso file://, URL del
  // documento o token. Il Referer serve al controllo di origine di FormSubmit.
  payload._url = SOURCE_URL;
  payload._template = 'table';
  return payload;
}

function isFeedbackSender(event, mainWindow) {
  return !!mainWindow && !mainWindow.isDestroyed()
    && !mainWindow.webContents.isDestroyed()
    && event.sender === mainWindow.webContents
    && event.senderFrame === mainWindow.webContents.mainFrame;
}

async function submitFeedback(value, { fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const payload = validateFeedbackPayload(value);
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', Referer: SOURCE_URL },
          body: JSON.stringify(payload),
          signal: controller.signal,
          credentials: 'omit',
          redirect: 'error',
        });
        let result = null;
        try { result = await response.json(); }
        catch (error) {
          if (controller.signal.aborted || !(error instanceof SyntaxError)) throw error;
          // Una risposta HTML/non JSON resta distinguibile da una conferma.
        }
        return { ok: response.ok, result };
      })(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Feedback request timed out'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { submitFeedback, validateFeedbackPayload, isFeedbackSender };
