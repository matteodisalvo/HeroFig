// Scaricamento dei file grandi (gigabyte) dei modelli e dei motori, con ripresa. I dati vanno in <nome>.part (con accanto
// <nome>.part.json: indirizzo, byte e sha256 attesi); a ogni ripresa si torna a un multiplo di 16 MiB, si ricalcola lo
// sha256 della parte tenuta e si chiede il resto con Range, sempre dall'indirizzo originale (i link firmati dei CDN
// scadono in un'ora). Lo sha256 si calcola mentre i dati arrivano; alla fine fsync, confronto con il manifest (mai con
// le intestazioni della risposta) e il nome giusto. Senza Electron: `fetch` è net.fetch nell'app (proxy e certificati del
// sistema), quello di Node nei collaudi.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const ALIGN = 16 * 1024 * 1024; // la ripresa riparte da un multiplo di 16 MiB: la coda scritta male prima di un arresto si butta
const STALL_MS = 30_000; // nessun byte per 30 s: si interrompe e si riprova
const MAX_FAILS = 8; // tentativi falliti di fila senza nessun byte nuovo, poi si rinuncia
const BACKOFF_S = [2, 4, 8, 15, 30, 60];
const SPACE_MARGIN = 256 * 1024 * 1024; // oltre al resto del file, quanto deve restare libero

/** Un errore con un codice per il pannello: network, no-space, corrupt, gone, http, stopped. */
class DownloadError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'DownloadError';
    this.code = code;
    Object.assign(this, extra);
  }
}

const sizeOf = async (file) => {
  try {
    return (await fsp.stat(file)).size;
  } catch {
    return -1;
  }
};

/** Aspetta `ms`, oppure si interrompe con il segnale. */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/** Lo sha256 dei primi `length` byte di un file, letto a pezzi. */
async function hashPrefix(file, length, signal) {
  const hash = crypto.createHash('sha256');
  if (length <= 0) return hash;
  const stream = fs.createReadStream(file, { start: 0, end: length - 1, highWaterMark: 4 * 1024 * 1024 });
  for await (const chunk of stream) {
    if (signal?.aborted) {
      stream.destroy();
      throw signal.reason;
    }
    hash.update(chunk);
  }
  return hash;
}

/** Su Windows un antivirus o l'indicizzazione tengono a volte un file appena scritto: si riprova. */
async function retryFs(fn, tries = 10) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries - 1 || !['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY'].includes(err?.code)) throw err;
      await sleep(150 * (i + 1));
    }
  }
}

const readJson = async (file) => {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return null;
  }
};

/** Il byte di partenza e il totale da Content-Range («bytes 100-199/200»). */
function contentRange(value) {
  const m = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(String(value ?? '').trim());
  return m ? { start: Number(m[1]), end: Number(m[2]), total: m[3] === '*' ? null : Number(m[3]) } : null;
}

/**
 * Scarica `url` in `dest` (nella cartella `dir` i file .part). Risolve quando `dest` c'è, completo e con lo sha256 atteso;
 * altrimenti lancia un DownloadError. `onProgress(byte del file)` (anche all'inizio, con la parte già scaricata),
 * `onPhase('check' | 'download')` mentre ricalcola lo sha256 della parte tenuta o scarica. `freeBytes()`: lo spazio
 * libero (statfs), controllato prima di ogni richiesta. `isOnline()`: senza rete si aspetta senza contare i tentativi.
 * `verified`: `dest` è già stato verificato con questo sha256 (lo ricorda chi chiama); se no un file già lì della misura
 * giusta si controlla prima di tenerlo, e se è un altro (un'altra revisione con lo stesso nome) si riscarica.
 */
async function downloadFile({ url, dest, dir = path.dirname(dest), size, sha256, verified = false, fetch: fetchFn, signal, onProgress = () => {}, onPhase = () => {}, freeBytes, isOnline = () => true, stallMs = STALL_MS, maxFails = MAX_FAILS, backoff = BACKOFF_S, wait = sleep }) {
  if (!Number.isSafeInteger(size) || size <= 0 || !/^[0-9a-f]{64}$/.test(sha256)) throw new DownloadError('http', 'bad manifest entry');
  if ((await sizeOf(dest)) === size) {
    let same = verified;
    if (!same) {
      onPhase('check');
      try {
        same = (await hashPrefix(dest, size, signal)).digest('hex') === sha256;
      } catch (err) {
        if (signal?.aborted) throw new DownloadError('stopped', 'stopped');
        throw err;
      }
    }
    if (same) {
      onProgress(size);
      return { skipped: true };
    }
    await retryFs(() => fsp.rm(dest, { force: true }));
  }
  await fsp.mkdir(dir, { recursive: true });
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const part = path.join(dir, `${path.basename(dest)}.part`);
  const meta = `${part}.json`;
  // una parte di un altro file (un altro manifest, un'altra versione) non si riprende
  const known = await readJson(meta);
  if (!known || known.sha256 !== sha256 || known.size !== size) {
    await fsp.rm(part, { force: true });
    await fsp.writeFile(meta, JSON.stringify({ url, size, sha256 }));
  }
  let corrupt = 0;
  for (;;) {
    const digest = await fetchToPart({ url, part, size, fetchFn, signal, onProgress, onPhase, freeBytes, isOnline, stallMs, maxFails, backoff, wait });
    if (digest === sha256) break;
    await fsp.rm(part, { force: true });
    onProgress(0);
    // una volta si riscarica da capo; la seconda è il file a essere diverso: «danneggiato»
    if (++corrupt > 1) throw new DownloadError('corrupt', `sha256 mismatch for ${path.basename(dest)}`);
  }
  await retryFs(() => fsp.rename(part, dest));
  await fsp.rm(meta, { force: true });
  onProgress(size);
  return { skipped: false };
}

/** Porta il .part a `size` byte (con le riprese) e ne restituisce lo sha256. */
async function fetchToPart({ url, part, size, fetchFn, signal, onProgress, onPhase, freeBytes, isOnline, stallMs, maxFails, backoff, wait }) {
  let fails = 0;
  for (;;) {
    if (signal?.aborted) throw new DownloadError('stopped', 'stopped');
    // la parte tenuta: fino all'ultimo multiplo di 16 MiB (intera se il file c'è già tutto), e il suo sha256
    let offset = Math.max(0, await sizeOf(part));
    if (offset > size) offset = 0;
    if (offset !== size) offset = Math.floor(offset / ALIGN) * ALIGN;
    await fsp.writeFile(part, '', { flag: 'a' });
    await fsp.truncate(part, offset);
    if (offset) onPhase('check');
    let hash;
    try {
      hash = await hashPrefix(part, offset, signal);
    } catch (err) {
      if (signal?.aborted) throw new DownloadError('stopped', 'stopped');
      throw err;
    }
    onProgress(offset);
    if (offset === size) return hash.digest('hex');
    onPhase('download');
    const before = offset;
    try {
      if (freeBytes) {
        const free = await freeBytes();
        if (Number.isFinite(free) && free < size - offset + SPACE_MARGIN) throw new DownloadError('no-space', 'not enough space', { needBytes: size - offset + SPACE_MARGIN - free });
      }
      while (!isOnline()) await wait(2000, signal);
      offset = await transfer({ url, part, offset, size, hash, fetchFn, signal, onProgress, stallMs });
      if (offset === size) {
        const fh = await fsp.open(part, 'r+');
        try {
          await fh.sync();
        } finally {
          await fh.close();
        }
        return hash.digest('hex');
      }
      // la connessione si è chiusa prima della fine: si riprende
      throw new DownloadError('network', 'connection closed early');
    } catch (err) {
      if (signal?.aborted) throw new DownloadError('stopped', 'stopped');
      if (err?.code === 'ENOSPC') throw new DownloadError('no-space', 'disk full', { needBytes: size - before });
      if (err instanceof DownloadError && !['network', 'retry'].includes(err.code)) throw err;
      // qualche byte è arrivato: i tentativi ricominciano da capo
      if ((await sizeOf(part)) > before) fails = 0;
      if (++fails > maxFails) throw new DownloadError('network', err?.message || 'network error');
      await wait(backoff[Math.min(fails - 1, backoff.length - 1)] * 1000, signal).catch(() => {});
    }
  }
}

/** Una richiesta: dal byte `offset` alla fine, in coda al .part. Restituisce fin dove si è arrivati. */
async function transfer({ url, part, offset, size, hash, fetchFn, signal, onProgress, stallMs }) {
  const attempt = new AbortController();
  let timer;
  // nessun byte per `stallMs` (anche prima della risposta): la richiesta si chiude e si riprova
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => attempt.abort(new DownloadError('retry', 'stalled')), stallMs);
  };
  const stop = signal ? AbortSignal.any([signal, attempt.signal]) : attempt.signal;
  arm();
  try {
    const headers = { 'Accept-Encoding': 'identity', ...(offset ? { Range: `bytes=${offset}-` } : {}) };
    const res = await fetchFn(url, { headers, signal: stop, cache: 'no-store', credentials: 'omit', redirect: 'follow' });
    if ([401, 404, 410].includes(res.status)) throw new DownloadError('gone', `HTTP ${res.status}`, { status: res.status });
    // la parte chiesta non c'è (file più corto, o cambiato): si ricomincia da zero
    if (res.status === 416) {
      await fsp.truncate(part, 0);
      throw new DownloadError('retry', 'HTTP 416', { status: 416 });
    }
    if (res.status === 403 || res.status === 408 || res.status === 429 || res.status >= 500) throw new DownloadError('retry', `HTTP ${res.status}`, { status: res.status });
    if (res.status === 206) {
      const range = contentRange(res.headers.get('content-range'));
      // un file d'altra misura non è quello del manifest
      if (range?.total != null && range.total !== size) throw new DownloadError('gone', `unexpected size ${range.total}`);
      // un'altra parte del file: si ricomincia da zero
      if (!range || range.start !== offset) {
        await fsp.truncate(part, 0);
        throw new DownloadError('retry', 'unexpected content-range');
      }
    } else if (res.status === 200) {
      const length = Number(res.headers.get('content-length'));
      if (length && length !== size) throw new DownloadError('gone', `unexpected size ${length}`);
      // il server ignora Range: si riparte da zero (la prossima richiesta è senza Range)
      if (offset) {
        await fsp.truncate(part, 0);
        throw new DownloadError('retry', 'range ignored');
      }
    } else throw new DownloadError('http', `HTTP ${res.status}`, { status: res.status });
    if (!res.body) throw new DownloadError('retry', 'empty body');
    let reached = offset;
    const tap = new Transform({
      transform(chunk, _enc, cb) {
        arm();
        if (reached + chunk.length > size) return cb(new DownloadError('retry', 'longer than expected'));
        hash.update(chunk);
        reached += chunk.length;
        onProgress(reached);
        cb(null, chunk);
      },
    });
    const body = typeof res.body.getReader === 'function' ? Readable.fromWeb(res.body) : res.body;
    await pipeline(body, tap, fs.createWriteStream(part, { flags: 'a', highWaterMark: 1 << 20 }), { signal: stop });
    return reached;
  } catch (err) {
    if (attempt.signal.aborted && !signal?.aborted) throw new DownloadError('retry', 'stalled');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** I byte già scaricati di un file: completo in `dest` (se `whole` lo lascia contare), oppure la parte in `dir`. */
async function downloadedBytes(dest, dir = path.dirname(dest), size = Infinity, { whole = true } = {}) {
  if (whole && (await sizeOf(dest)) === size) return size;
  return Math.max(0, Math.min(size, await sizeOf(path.join(dir, `${path.basename(dest)}.part`))));
}

/** Toglie la parte scaricata di un file (con il suo .json). */
async function removePart(dest, dir = path.dirname(dest)) {
  const part = path.join(dir, `${path.basename(dest)}.part`);
  await retryFs(() => fsp.rm(part, { force: true }));
  await fsp.rm(`${part}.json`, { force: true });
}

module.exports = { ALIGN, STALL_MS, MAX_FAILS, SPACE_MARGIN, DownloadError, downloadFile, downloadedBytes, removePart, contentRange, hashPrefix, retryFs, sleep, sizeOf };
