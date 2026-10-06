// Immagini illustrative per i blocchi: FLUX.1-schnell sui fornitori di Hugging Face (Inference Providers), con il
// client ufficiale @huggingface/inference. Qui solo funzioni senza Electron, collaudabili da Node: la chiave salvata
// nell'app (cifrata con safeStorage) e i canali IPC stanno in main.cjs. La chiave non finisce mai nei messaggi d'errore.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const MODEL = process.env.TENSORFIG_HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
const SIZE = 768;
const TIMEOUT_MS = 180_000; // FLUX.1-schnell risponde in pochi secondi, un fornitore bloccato non deve lasciare l'app in attesa
const MAX_PROMPT = 2000;

// lo stile scelto nell'app diventa una coda del prompt; il testo dentro le immagini riesce male, quindi si evita
const STYLES = {
  foto: 'realistic photograph, natural light, sharp focus',
  icona: 'flat vector icon, simple shapes, soft pastel colors, plain white background, centered',
  scientifica: 'clean scientific illustration, textbook style, plain white background',
  microscopia: 'microscopy image, high detail, even illumination',
};
const NO_TEXT = 'no text, no letters, no labels, no watermark';

// testi per il pannello, in italiano: sono chiavi dei cataloghi (src/locales/panels.ts), li traduce t()
const TEXT = {
  step: "Chiedo l'immagine a Hugging Face…",
  needKey: 'Per generare immagini serve una chiave gratuita di Hugging Face, una volta sola.',
  badKey: 'Hugging Face non accetta la chiave: creane una nuova con il permesso «Make calls to Inference Providers».',
  noCredit: 'Il credito gratuito di Hugging Face per questo mese è finito: aggiungi credito al tuo account o riprova il mese prossimo.',
  busy: 'Hugging Face è occupato: riprova fra un minuto.',
  stopped: 'Generazione fermata.',
  timeout: 'Hugging Face non ha risposto in tempo: riprova fra poco.',
  offline: 'Nessuna connessione con Hugging Face: controlla la rete.',
  failed: 'Generazione non riuscita: {detail}',
  badPrompt: "Descrivi l'immagine in 2000 caratteri al massimo.",
  badStyle: 'Stile non valido.',
};

// spazi (anche Unicode) tolti ai bordi della descrizione: lo stesso prompt delle versioni precedenti
const SPACES = '[\\t-\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]';
const EDGE_SPACES = new RegExp(`^${SPACES}+|${SPACES}+$`, 'g');
const strip = (s) => s.replace(EDGE_SPACES, '');

/** Descrizione, coda dello stile e niente testo, separati da virgole; le parti vuote si saltano. */
function fullPrompt(prompt, style) {
  const tail = typeof style === 'string' && Object.hasOwn(STYLES, style) ? STYLES[style] : '';
  return [strip(String(prompt ?? '')), tail, NO_TEXT].filter(Boolean).join(', ');
}

/** Richiesta arrivata dal renderer: null se va bene, altrimenti il testo dell'errore. */
function checkRequest({ prompt, style } = {}) {
  if (typeof prompt !== 'string' || prompt.length > MAX_PROMPT || !strip(prompt)) return TEXT.badPrompt;
  if (style !== undefined && style !== '' && !(typeof style === 'string' && Object.hasOwn(STYLES, style))) return TEXT.badStyle;
  return null;
}

/** Ha la forma di una chiave di Hugging Face: hf_ e poi caratteri stampabili, senza spazi, 20-300 in tutto. */
const isHfKey = (token) => typeof token === 'string' && /^hf_[\x21-\x7e]{17,297}$/.test(token);

// come gli strumenti di Hugging Face: niente a capo, niente spazi intorno
const cleanToken = (value) => (typeof value === 'string' ? strip(value.replace(/[\r\n]/g, '')) : '');

/** Il file scritto da «hf auth login»: $HF_TOKEN_PATH, poi $HF_HOME/token, $XDG_CACHE_HOME/huggingface/token, ~/.cache/huggingface/token (anche su Windows). */
function cliTokenPath(env = process.env, home = os.homedir()) {
  const expand = (p) => (/^~(?=$|[\\/])/.test(p) ? path.join(home, p.slice(1)) : p);
  if (env.HF_TOKEN_PATH) return expand(env.HF_TOKEN_PATH);
  const cache = env.XDG_CACHE_HOME ? expand(env.XDG_CACHE_HOME) : path.join(home, '.cache');
  return path.join(env.HF_HOME ? expand(env.HF_HOME) : path.join(cache, 'huggingface'), 'token');
}

/** La chiave trovata fuori dall'app: HF_TOKEN (poi HUGGING_FACE_HUB_TOKEN), altrimenti l'accesso fatto con «hf auth login». */
async function externalToken(env = process.env, home = os.homedir()) {
  for (const variable of ['HF_TOKEN', 'HUGGING_FACE_HUB_TOKEN']) {
    const fromEnv = cleanToken(env[variable]);
    if (fromEnv) return { token: fromEnv, source: 'env', variable };
  }
  try {
    const fromCli = cleanToken(await fs.readFile(cliTokenPath(env, home), 'utf8'));
    if (fromCli) return { token: fromCli, source: 'cli' };
  } catch {
    // nessun accesso fatto con la CLI
  }
  return null;
}

/** Tipo dell'immagine dai primi byte (i fornitori dichiarano spesso image/jpeg anche per un PNG); null se non è un'immagine. */
function imageMime(bytes, declared = '') {
  const head = bytes.subarray(0, 12).toString('latin1');
  if (head.startsWith('\x89PNG')) return 'image/png';
  if (head.startsWith('\xff\xd8\xff')) return 'image/jpeg';
  if (head.startsWith('GIF8')) return 'image/gif';
  if (head.startsWith('RIFF') && head.slice(8) === 'WEBP') return 'image/webp';
  const type = declared.split(';')[0].trim().toLowerCase();
  if (/^image\/[\w.+-]+$/.test(type)) return type;
  return type ? null : 'image/png';
}

// la scelta del fornitore (una richiesta interna del client) non ascolta il segnale: si smette comunque di aspettare
function untilAborted(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}

/** Toglie la chiave da un testo da mostrare, anche se il client l'avesse copiata in un messaggio. */
const redact = (text, token) => (token ? text.split(token).join('hf_…') : text).replace(/hf_[A-Za-z0-9]{6,}/g, 'hf_…');

// fetch di Node: «TypeError: fetch failed», con la causa (ENOTFOUND, ECONNREFUSED, ECONNRESET…) in err.cause;
// net.fetch di Electron: «net::ERR_CONNECTION_REFUSED», «net::ERR_PROXY_CONNECTION_FAILED»…
const NET_ERROR = /^(E[A-Z]+|UND_ERR_[A-Z_]+)$/;

/** Un errore della generazione diventa un testo per il pannello: { error, needsToken?, detail? }. */
function imageError(err, { stopped = false, timedOut = false, token = '' } = {}) {
  if (stopped) return { error: TEXT.stopped };
  if (timedOut || err?.name === 'TimeoutError') return { error: TEXT.timeout };
  const status = err?.httpResponse?.status;
  const detail = redact(String(err?.message || err), token);
  const body = redact(JSON.stringify(err?.httpResponse?.body ?? ''), token);
  if (status === 401 || status === 403) return { error: TEXT.badKey, needsToken: true };
  if (status === 402) return { error: TEXT.noCredit };
  if (status === 429 || status === 503) return { error: TEXT.busy };
  if (/credit|quota/i.test(detail + body)) return { error: TEXT.noCredit };
  if ((err instanceof TypeError && /fetch failed/i.test(err.message)) || NET_ERROR.test(err?.cause?.code ?? '') || /^net::ERR_/.test(err?.message ?? '')) return { error: TEXT.offline };
  return { error: TEXT.failed, detail: detail.slice(0, 200) };
}

/** Indirizzo di collaudo (TENSORFIG_HF_ENDPOINT) solo se è su questo computer: riceve la chiave dell'utente. */
function localEndpoint(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Il fornitore che fa girare il modello: il primo «live» nell'ordine scelto dall'utente su Hugging Face (per questo la
 * richiesta porta la chiave), e che il client sa chiamare. Con 'auto' il client prenderebbe il primo della lista pubblica,
 * anche se guasto, e lo terrebbe per tutta la sessione. Se la lista non arriva si torna ad 'auto'.
 */
async function pickProvider({ token, fetch: fetchFn = globalThis.fetch, signal }) {
  try {
    const headers = token?.startsWith('hf_') ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetchFn(`https://huggingface.co/api/models/${MODEL}?expand[]=inferenceProviderMapping`, { headers, signal });
    const mapping = res.ok ? (await res.json())?.inferenceProviderMapping : null;
    const entries = Array.isArray(mapping) ? mapping : Object.entries(mapping ?? {}).map(([provider, entry]) => ({ ...entry, provider }));
    const { getProviderHelper } = require('@huggingface/inference');
    const known = (provider) => {
      try {
        return !!getProviderHelper(provider, 'text-to-image');
      } catch {
        return false;
      }
    };
    return entries.find((m) => m?.status === 'live' && m.task === 'text-to-image' && typeof m.provider === 'string' && known(m.provider))?.provider ?? 'auto';
  } catch (err) {
    if (signal?.aborted) throw err;
    return 'auto';
  }
}

/**
 * Genera l'immagine: { src } (data URL) oppure { error, needsToken?, detail? }, senza mai lanciare eccezioni.
 * `signal` la ferma (pulsante «Ferma», una generazione nuova, l'uscita dall'app); dopo `timeoutMs` si rinuncia.
 * `fetch`: quello di Electron nell'app, che passa dai proxy del sistema; da Node quello globale.
 * `endpoint` (TENSORFIG_HF_ENDPOINT, solo per i collaudi e solo su 127.0.0.1, localhost o [::1]): la richiesta va a
 * quell'indirizzo, nel formato di hf-inference, invece che ai fornitori, così un server finto può rispondere con
 * un'immagine o con gli errori 401, 402, 429.
 */
async function generateImage({ prompt, style = '', token, signal, onStep = () => {}, fetch: fetchFn, endpoint = process.env.TENSORFIG_HF_ENDPOINT, timeoutMs = TIMEOUT_MS }) {
  const endpointUrl = endpoint ? localEndpoint(endpoint) : null;
  // un indirizzo di collaudo altrove riceverebbe la chiave; ignorarlo manderebbe invece richieste vere a pagamento
  if (endpoint && !endpointUrl) return { error: TEXT.failed, detail: 'TENSORFIG_HF_ENDPOINT must be a local address (127.0.0.1, localhost or [::1])' };
  const timeout = AbortSignal.timeout(timeoutMs);
  const stop = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    onStep(TEXT.step);
    const { textToImage } = require('@huggingface/inference');
    const args = { model: MODEL, inputs: fullPrompt(prompt, style), parameters: { width: SIZE, height: SIZE }, accessToken: token };
    const request = async () => {
      // con un indirizzo proprio il client non accetta un fornitore
      if (endpointUrl) args.endpointUrl = endpointUrl;
      else args.provider = await pickProvider({ token, fetch: fetchFn, signal: stop });
      // con un 503 il client riproverebbe subito e senza fine: meglio dire di riprovare fra un minuto
      return textToImage(args, { signal: stop, retry_on_error: false, fetch: fetchFn });
    };
    const blob = await untilAborted(request(), stop);
    const bytes = Buffer.from(await blob.arrayBuffer());
    const mime = imageMime(bytes, blob.type);
    if (!mime) return { error: TEXT.failed, detail: `unexpected response (${blob.type})` };
    return { src: `data:${mime};base64,${bytes.toString('base64')}` };
  } catch (err) {
    return imageError(err, { stopped: !!signal?.aborted, timedOut: timeout.aborted, token });
  }
}

module.exports = { MODEL, SIZE, TIMEOUT_MS, MAX_PROMPT, STYLES, NO_TEXT, TEXT, fullPrompt, checkRequest, isHfKey, cliTokenPath, externalToken, imageMime, imageError, localEndpoint, pickProvider, generateImage };
