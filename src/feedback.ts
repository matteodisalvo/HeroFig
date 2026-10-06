// Richieste e segnalazioni: bozze locali e invio esplicito, senza dati del documento.
import { useSyncExternalStore } from 'react';

export const FEEDBACK_KINDS = ['package', 'addition', 'bug'] as const;
export type FeedbackKind = typeof FEEDBACK_KINDS[number];
const FEEDBACK_EMAIL = 'disalvo.matteo@outlook.com';

export interface FeedbackDraft {
  title: string;
  details: string;
  steps: string;
  expected: string;
  name: string;
  email: string;
  reference: string;
  includeDiagnostics: boolean;
}

export interface FeedbackContext {
  version: string;
  platform: string;
  language: string;
  runtime: 'desktop' | 'web';
}

export interface FeedbackState {
  open: boolean;
  kind: FeedbackKind;
  drafts: Record<FeedbackKind, FeedbackDraft>;
  status: 'idle' | 'sending' | 'success' | 'error';
  error: null | 'network' | 'rejected' | 'unconfirmed' | 'validation' | 'activation';
  lastReceipt: string | null;
}

const STORAGE_KEY = 'tensorfig:feedback';
const ENDPOINT = `https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`;
// Identificativo pubblico dell'app. Non includere mai URL del documento o percorsi locali.
const SOURCE_URL = 'https://github.com/matteodisalvo/herofig';
const TIMEOUT_MS = 20_000;
const LIMITS = { title: 120, details: 4000, steps: 2000, expected: 1000, name: 100, email: 254, reference: 500 } as const;
const LABELS: Record<FeedbackKind, string> = { package: 'Nuovo pacchetto', addition: 'Aggiunta', bug: 'Errore' };
const PREFIXES: Record<FeedbackKind, string> = { package: '[HeroFig][Pacchetto]', addition: '[HeroFig][Aggiunta]', bug: '[HeroFig][Errore]' };
type Receipts = Partial<Record<FeedbackKind, string>>;
const emptyDraft = (): FeedbackDraft => ({ title: '', details: '', steps: '', expected: '', name: '', email: '', reference: '', includeDiagnostics: false });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isKind = (value: unknown): value is FeedbackKind => FEEDBACK_KINDS.includes(value as FeedbackKind);

function readDraft(value: unknown): FeedbackDraft {
  const draft = emptyDraft();
  if (!isRecord(value)) return draft;
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (typeof value[key] === 'string') draft[key] = value[key].slice(0, LIMITS[key]);
  }
  draft.includeDiagnostics = value.includeDiagnostics === true;
  return draft;
}

function load(): { drafts: Record<FeedbackKind, FeedbackDraft>; receipts: Receipts } {
  const drafts = { package: emptyDraft(), addition: emptyDraft(), bug: emptyDraft() };
  const receipts: Receipts = {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.drafts)) return { drafts, receipts };
    for (const kind of FEEDBACK_KINDS) {
      drafts[kind] = readDraft(value.drafts[kind]);
      const receipt = isRecord(value.receipts) ? value.receipts[kind] : null;
      if (typeof receipt === 'string' && /^TF-[A-Za-z0-9-]{8,80}$/.test(receipt)) receipts[kind] = receipt;
    }
  } catch { /* Storage assente o corrotto: la bozza resta utilizzabile in memoria. */ }
  return { drafts, receipts };
}

const saved = load();
let receipts = saved.receipts;
let state: FeedbackState = { open: false, kind: 'package', drafts: saved.drafts, status: 'idle', error: null, lastReceipt: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<FeedbackState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, drafts: state.drafts, receipts })); }
  catch { /* In modalità privata o a disco pieno rimane la bozza della sessione. */ }
}

export const getFeedback = () => state;
export const useFeedback = <T,>(selector: (value: FeedbackState) => T): T => useSyncExternalStore(
  (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  () => selector(state),
);

export function openFeedback(kind: FeedbackKind = state.kind, prefill = '') {
  if (state.status === 'sending') { set({ open: true }); return; }
  setFeedbackKind(kind);
  set({ open: true });
  if (prefill && !state.drafts[state.kind].title.trim()) updateFeedbackDraft({ title: prefill });
}

export function closeFeedback() { set({ open: false }); }

export function setFeedbackKind(kind: FeedbackKind) {
  if (!isKind(kind) || state.status === 'sending' || kind === state.kind) return;
  set({ kind, status: 'idle', error: null, lastReceipt: receipts[kind] ?? null });
}

export function updateFeedbackDraft(patch: Partial<FeedbackDraft>) {
  if (state.status === 'sending') return;
  const previous = state.drafts[state.kind];
  const draft = readDraft({ ...previous, ...patch });
  if (JSON.stringify(previous) === JSON.stringify(draft)) return;
  // Una modifica crea una richiesta diversa; il semplice retry mantiene l'ID.
  delete receipts[state.kind];
  set({ drafts: { ...state.drafts, [state.kind]: draft }, status: 'idle', error: null, lastReceipt: null });
  persist();
}

export function newFeedback() {
  if (state.status === 'sending') return;
  delete receipts[state.kind];
  set({ drafts: { ...state.drafts, [state.kind]: emptyDraft() }, status: 'idle', error: null, lastReceipt: null });
  persist();
}

function valid(draft: FeedbackDraft): boolean {
  if (!draft.title.trim() || !draft.details.trim()) return false;
  if (Object.entries(LIMITS).some(([key, limit]) => draft[key as keyof typeof LIMITS].length > limit)) return false;
  if (draft.email.trim() && !/^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(draft.email.trim())) return false;
  if (draft.reference.trim()) {
    try {
      const url = new URL(draft.reference.trim());
      if (!['http:', 'https:'].includes(url.protocol)) return false;
    } catch { return false; }
  }
  return true;
}

const oneLine = (value: string) => value.replace(/[\r\n]/g, ' ').trim();

/** Anteprima/copia degli stessi dati inviati; nessun accesso a documento o browser. */
export function feedbackText(kind: FeedbackKind, draft: FeedbackDraft, context: FeedbackContext): string {
  const lines = [
    `HeroFig — ${LABELS[kind]}`,
    `Titolo: ${oneLine(draft.title)}`,
    '',
    draft.details.trim(),
  ];
  if (kind === 'bug' && draft.steps.trim()) lines.push('', `Passaggi per riprodurre:\n${draft.steps.trim()}`);
  if (kind === 'bug' && draft.expected.trim()) lines.push('', `Risultato atteso:\n${draft.expected.trim()}`);
  if (draft.reference.trim()) lines.push('', `Riferimento: ${draft.reference.trim()}`);
  if (draft.name.trim()) lines.push(`Nome: ${oneLine(draft.name)}`);
  if (draft.email.trim()) lines.push(`Email: ${draft.email.trim()}`);
  if (kind === 'bug' && draft.includeDiagnostics) {
    lines.push('', 'Informazioni tecniche:', `Versione: ${oneLine(context.version).slice(0, 80)}`, `Sistema: ${oneLine(context.platform).slice(0, 120)}`, `Lingua: ${oneLine(context.language).slice(0, 40)}`, `Applicazione: ${context.runtime === 'desktop' ? 'desktop' : 'web'}`);
  }
  return lines.join('\n');
}

function receiptId(): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `TF-${random}`;
}

function activationNeeded(result: Record<string, unknown>): boolean {
  const message = [result.message, result.error].filter((value): value is string => typeof value === 'string').join(' ');
  return /\b(?:activate|activation|unactivated)\b|not(?:\s+(?:yet|been|currently))*\s+(?:active|activated|verified)\b|verify\s+(?:your|the)\s+email/i.test(message);
}

/** Un solo tentativo; la risposta del servizio conferma la presa in carico, non la lettura dell'email. */
export async function sendFeedback(context: FeedbackContext): Promise<void> {
  if (state.status === 'sending' || state.status === 'success') return;
  const kind = state.kind;
  const draft = { ...state.drafts[kind] };
  if (!valid(draft)) { set({ status: 'error', error: 'validation' }); return; }
  // Offline non parte nulla: lo si dice subito, invece di un esito incerto dopo il timeout.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { set({ status: 'error', error: 'network' }); return; }
  const receipt = receipts[kind] ?? receiptId();
  receipts[kind] = receipt;
  const payload: Record<string, string> = {
    _subject: `${PREFIXES[kind]} ${oneLine(draft.title)}`,
    _template: 'table',
    _url: SOURCE_URL,
    category: LABELS[kind],
    reference_id: receipt,
    message: feedbackText(kind, draft, context),
  };
  if (draft.name.trim()) payload.name = oneLine(draft.name);
  if (draft.email.trim()) { payload.email = draft.email.trim(); payload._replyto = draft.email.trim(); }
  set({ status: 'sending', error: null, lastReceipt: receipt });
  persist();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Il timeout comprende lettura/parsing della risposta; race protegge anche
    // da un fetch che non completa l'abort. Nessun retry viene avviato da qui.
    const response = await Promise.race([
      (async () => {
        // In Electron il processo principale fornisce un Referer pubblico fisso:
        // file:// non ne produce uno e FormSubmit AJAX ignora _url in sua assenza.
        const desktopSubmit = typeof window !== 'undefined'
          ? (window as unknown as { api?: { feedbackSubmit?: (data: Record<string, string>) => Promise<{ ok: boolean; result: unknown }> } }).api?.feedbackSubmit
          : undefined;
        if (desktopSubmit) return desktopSubmit(payload);
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
          credentials: 'omit',
          // Solo l'origine del sito: mai percorso, query, frammento o documento.
          // Il servizio richiede Referer anche quando _url è presente nel JSON.
          referrerPolicy: 'origin',
        });
        let result: unknown = null;
        try { result = await res.json(); } catch { /* HTML o risposta non JSON: esito non confermato. */ }
        return { ok: res.ok, result };
      })(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Feedback timeout')); }, TIMEOUT_MS);
      }),
    ]);
    if (isRecord(response.result) && activationNeeded(response.result)) {
      set({ status: 'error', error: 'activation' });
    } else if (!response.ok || (isRecord(response.result) && (response.result.success === false || response.result.success === 'false' || (typeof response.result.error === 'string' && !!response.result.error.trim())))) {
      set({ status: 'error', error: 'rejected' });
    } else if (isRecord(response.result) && (response.result.success === true || response.result.success === 'true')) {
      delete receipts[kind];
      set({ drafts: { ...state.drafts, [kind]: emptyDraft() }, status: 'success', error: null });
      persist();
    } else {
      set({ status: 'error', error: 'unconfirmed' });
    }
  } catch {
    // Una perdita di connessione non dimostra che il server non abbia ricevuto:
    // conserviamo bozza e riferimento, così l'utente decide se riprovare.
    set({ status: 'error', error: 'unconfirmed' });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
