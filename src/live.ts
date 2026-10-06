// Insieme: commenti e lavoro dal vivo passano dal server privato del gruppo (electron/main.cjs),
// ospitato da un computer del gruppo sulla rete locale. Ci si collega una volta con l'invito
// (indirizzo/chiave); da lì si vedono chi è in linea e le stanze del gruppo. Una stanza è una figura
// su cui si lavora insieme: resta aperta finché chi l'ha creata non la chiude, e il server ne tiene
// l'ultima copia per chi entra quando è vuota. Ogni modifica viaggia come elenco di elementi cambiati
// (blocchi, frecce, commenti, impostazioni), ognuno con un contatore: su ogni elemento vale
// l'ultima modifica, così tutti arrivano allo stesso disegno.
import { useSyncExternalStore } from 'react';
import { clientId, getAuthor } from './collab';
import { subscribeProfile } from './profile';
import { t } from './i18n';
import { makeEdge, makeNode, normalizeDoc, type Comment, type Doc, type EdgeEnd, type NodeModel } from './model';
import { groupCreate, groupStatus, groupStop, type GroupHost } from './platform';
import { getState, loadCount, loadDoc, setDoc, subscribe } from './store';
import { toast } from './ui';

export interface Member {
  id: string;
  name: string;
  room: string | null; // stanza in cui si trova
  since: number; // da quando è in quella stanza
}

export interface Room {
  id: string;
  name: string;
  owner: string; // chi l'ha creata: l'unico che può chiuderla, oltre a chi ospita il server
  ownerName: string;
  created: number;
}

type GroupStatus = 'none' | 'connecting' | 'online' | 'offline';

interface LiveState {
  status: GroupStatus;
  badKey: boolean; // il server risponde ma l'invito non vale più
  group: string; // nome del gruppo
  invite: string; // invito con cui ci si è collegati
  hosting: GroupHost | null; // questo computer ospita il server
  members: Member[]; // le altre persone in linea
  rooms: Room[]; // tutte le stanze del gruppo
  room: string | null; // la stanza in cui sono
  joining: boolean; // in attesa della figura della stanza
  cursors: Record<string, { x: number; y: number }>;
}

type Kind = 'node' | 'edge' | 'comment' | 'setting' | 'order';
interface Op {
  kind: Kind;
  id: string;
  value: unknown; // undefined = eliminato
  clock: number;
}
// `room` nei messaggi fra persone: uno rimasto indietro non finisce nella stanza in cui si è appena entrati
type Msg =
  | { type: 'people'; people: Member[]; rooms: Room[] }
  | { type: 'closed'; room: string; name: string; by: string; byId: string }
  | { type: 'hello'; from: string; ask: string; room?: string }
  | { type: 'doc'; from: string; to: string; doc: Doc; clock: number; room?: string }
  | { type: 'ops'; from: string; ops: Op[]; room?: string }
  | { type: 'cursor'; from: string; x: number; y: number; room?: string };

let state: LiveState = { status: 'none', badKey: false, group: '', invite: '', hosting: null, members: [], rooms: [], room: null, joining: false, cursors: {} };
const listeners = new Set<() => void>();
const set = (p: Partial<LiveState>) => {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
};
export const getLive = () => state;
export const useLive = <T,>(selector: (s: LiveState) => T): T =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
  );

/** Le altre persone nella mia stanza, dalla prima entrata. */
export const roomMates = (s: LiveState = state) =>
  s.room ? s.members.filter((m) => m.room === s.room).sort((a, b) => a.since - b.since || (a.id < b.id ? -1 : 1)) : [];

/** La stanza in cui sono, se c'è. */
export const currentRoom = (s: LiveState = state) => s.rooms.find((r) => r.id === s.room) ?? null;

/** Chi ha creato la stanza può chiuderla; chi ospita il server può chiuderle tutte. */
export const canClose = (r: Room, s: LiveState = state) => r.owner === clientId || !!s.hosting;

const roomName = (id: string | null) => state.rooms.find((r) => r.id === id)?.name ?? '';

// ---------- invito e configurazione salvata ----------

const CONFIG_KEY = 'mlsketch:group';
const DEFAULT_PORT = 47800;

/** Trova l'invito anche dentro un testo incollato: `indirizzo[:porta]/XXXX-XXXX-XXXX`. */
function parseInvite(text: string): { base: string; key: string } | null {
  const m = text.match(/([\w.-]+)(?::(\d{2,5}))?\/([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/i);
  return m ? { base: `${m[1]}:${m[2] ?? DEFAULT_PORT}`, key: m[3].toUpperCase() } : null;
}

function readConfig(): { invite: string; group: string } | null {
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null');
    return c && typeof c.invite === 'string' ? { invite: c.invite, group: String(c.group ?? '') } : null;
  } catch {
    return null;
  }
}
function writeConfig(c: { invite: string; group: string } | null) {
  try {
    if (c) localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    // senza storage il collegamento vale per questa sessione
  }
}

// ---------- collegamento al server ----------

let base = ''; // host:porta/chiave
let source: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let attempt = 0; // cambia a ogni nuovo collegamento: i tentativi rimasti indietro si fermano
let connected = false; // il server mi conosce: falso da quando si riapre il collegamento finché non risponde
const myName = () => getAuthor() || t('Ospite');

function post(msg: object, to = base): Promise<Response | null> {
  // text/plain evita la richiesta preliminare del browser
  return fetch(`http://${to}/msg?id=${clientId}`, { method: 'POST', body: JSON.stringify(msg) }).then(
    (res) => {
      // il server non mi conosce più: il collegamento è caduto senza che EventSource se ne accorgesse
      // (computer in pausa, rete cambiata). Ci si ricollega, e le modifiche ripartono dopo.
      if (res.status === 410 && to === base && connected) open();
      return res;
    },
    () => null,
  );
}

// Le modifiche partono una dopo l'altra: in parallelo una piccola (una freccia) potrebbe arrivare agli
// altri prima di una grande spedita prima (il blocco con l'immagine a cui la freccia si attacca).
let outbox: Promise<unknown> = Promise.resolve();
function queue(msg: object): Promise<Response | null> {
  const to = base;
  const sent = outbox.then(() => post(msg, to));
  outbox = sent;
  return sent;
}

class InviteError extends Error {
  constructor(public code: 'format' | 'unreachable' | 'key' | 'other', message: string) {
    super(message);
  }
}

async function probe(invite: string): Promise<string> {
  const p = parseInvite(invite);
  if (!p) throw new InviteError('format', t('Questo non sembra un invito. Deve somigliare a 192.168.1.20:47800/ABCD-EFGH-JKLM.'));
  let res: Response;
  try {
    res = await fetch(`http://${p.base}/${p.key}/info`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new InviteError('unreachable', t('Il server non risponde. Controlla che il computer che lo ospita sia acceso e che siate sulla stessa rete (o sulla VPN).'));
  }
  if (res.status === 403) throw new InviteError('key', t('La chiave dell’invito non è giusta: chiedi un invito nuovo a chi ha creato il server.'));
  if (!res.ok) throw new InviteError('other', t('Il server ha risposto in modo inatteso. Riprova fra poco.'));
  const info = (await res.json()) as { name?: string };
  return String(info.name ?? '');
}

function open() {
  const p = parseInvite(state.invite);
  if (!p) return;
  const mine = ++attempt;
  clearTimeout(retryTimer);
  source?.close();
  connected = false;
  // le modifiche ancora in viaggio potrebbero arrivare quando il server non sa più in che stanza sono: si rimandano
  for (const ops of flying) for (const op of ops) unsent.add(`${op.kind}:${op.id}`);
  base = `${p.base}/${p.key}`;
  set({ status: state.status === 'online' ? 'online' : 'connecting', badKey: false });
  const es = new EventSource(`http://${base}/events?id=${clientId}&name=${encodeURIComponent(myName())}`);
  source = es;
  es.onopen = () => {
    if (source !== es) return;
    connected = true;
    set({ status: 'online', badKey: false });
    // il server non ricorda più la stanza: ci si rientra
    if (state.room) void rejoin();
  };
  es.onmessage = (ev) => {
    if (source !== es) return;
    try {
      receive(JSON.parse(ev.data) as Msg);
    } catch {
      // messaggio rovinato: si ignora
    }
  };
  es.onerror = () => {
    if (source !== es) return;
    connected = false;
    if (state.status !== 'offline') set({ status: 'offline', members: [], cursors: {} });
    // EventSource riprova da solo se cade la rete; se il server risponde con un errore smette, e allora si riprova qui
    if (es.readyState === EventSource.CLOSED) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        probe(state.invite).then(
          () => mine === attempt && open(),
          (err: InviteError) => {
            if (mine !== attempt) return;
            if (err.code === 'key') set({ badKey: true });
            else retryTimer = setTimeout(open, 5000);
          },
        );
      }, 3000);
    }
  };
}

/** Riprova subito il collegamento (pulsante «Riprova»). */
export const reconnect = () => open();

function close() {
  attempt++;
  clearTimeout(retryTimer);
  source?.close();
  source = null;
  connected = false;
}

// ---------- differenze fra due documenti, come elenco di elementi ----------

let clock = 0;
let stamps = new Map<string, { clock: number; by: string }>();
let synced: Doc | null = null; // ultimo documento già condiviso: le differenze da qui sono modifiche mie
let unsent = new Set<string>(); // elementi mandati mentre il server non rispondeva: ripartono con le prossime modifiche
let flying = new Set<Op[]>(); // modifiche partite e non ancora arrivate al server
let loadsInRoom = 0;
let sendTimer: ReturnType<typeof setTimeout> | undefined;
let resync = false; // dopo una caduta della rete: si riprende la figura degli altri tenendo le mie modifiche
let asked = new Set<string>();
let fetched = false; // chiesta al server la copia che conserva
let askTimer: ReturnType<typeof setTimeout> | undefined;
let mySince = 0; // da quando sono nella stanza, secondo il server
let leader = false; // il primo entrato manda al server la copia aggiornata della figura
let snapTimer: ReturnType<typeof setTimeout> | undefined;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function items(doc: Doc): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const n of doc.nodes) m.set(`node:${n.id}`, n);
  for (const e of doc.edges) m.set(`edge:${e.id}`, e);
  for (const c of doc.comments ?? []) m.set(`comment:${c.id}`, c);
  for (const [k, v] of Object.entries(doc.settings)) m.set(`setting:${k}`, v);
  m.set('order:nodes', doc.nodes.map((n) => n.id));
  return m;
}

const opFor = (key: string, value: unknown): Op => {
  const i = key.indexOf(':');
  return { kind: key.slice(0, i) as Kind, id: key.slice(i + 1), value, clock: 0 };
};

/** Le mie modifiche da `prev` a `next`, più gli elementi che non erano arrivati al server. */
function diff(prev: Doc, next: Doc): Op[] {
  const a = items(prev), b = items(next);
  const ops: Op[] = [];
  for (const key of new Set([...a.keys(), ...b.keys(), ...unsent])) {
    if (unsent.has(key) || !same(a.get(key), b.get(key))) ops.push(opFor(key, b.get(key)));
  }
  return ops;
}

// le modifiche degli altri si controllano prima di applicarle: un messaggio rovinato non deve bloccare il foglio
const KINDS: Kind[] = ['node', 'edge', 'comment', 'setting', 'order'];
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isEnd = (v: unknown): v is EdgeEnd => isObject(v) && typeof v.node === 'string';
function valid(op: Op): boolean {
  if (!isObject(op) || !KINDS.includes(op.kind) || typeof op.id !== 'string' || !Number.isFinite(op.clock)) return false;
  const v = op.value;
  if (op.kind === 'order') return Array.isArray(v) && v.every((id) => typeof id === 'string');
  if (op.kind === 'setting' || v === undefined || v === null) return true;
  if (op.kind === 'node') return isObject(v);
  if (op.kind === 'edge') return isObject(v) && isEnd(v.from) && isEnd(v.to);
  return isObject(v) && Number.isFinite(v.x) && Number.isFinite(v.y) && typeof v.text === 'string';
}

function apply(doc: Doc, ops: Op[]): Doc {
  let nodes = doc.nodes, edges = doc.edges, comments = doc.comments ?? [];
  let settings = doc.settings;
  const put = <T extends { id: string }>(list: T[], id: string, value: T | null): T[] => {
    if (!value) return list.filter((x) => x.id !== id);
    const i = list.findIndex((x) => x.id === id);
    return i < 0 ? [...list, value] : list.map((x) => (x.id === id ? value : x));
  };
  for (const op of ops) {
    // i campi mancanti (da una versione diversa dell'app) prendono il valore predefinito
    const v = isObject(op.value) ? op.value : null;
    if (op.kind === 'node') nodes = put(nodes, op.id, v && makeNode({ ...(v as Partial<NodeModel>), id: op.id }));
    else if (op.kind === 'edge') edges = put(edges, op.id, v && makeEdge(v.from as EdgeEnd, v.to as EdgeEnd, { ...v, id: op.id }));
    else if (op.kind === 'comment') {
      const c = v as Partial<Comment> | null;
      comments = put(comments, op.id, c && { id: op.id, x: c.x!, y: c.y!, author: String(c.author ?? ''), text: c.text!, time: Number(c.time) || 0, done: !!c.done });
    } else if (op.kind === 'setting') settings = { ...settings, [op.id]: op.value };
  }
  const order = ops.find((o) => o.kind === 'order')?.value as string[] | undefined;
  if (order) {
    const pos = new Map(order.map((id, i) => [id, i]));
    nodes = [...nodes].sort((p, q) => (pos.get(p.id) ?? 1e9) - (pos.get(q.id) ?? 1e9));
  }
  // stesso ordine per tutti, così il «commento 3» è lo stesso su ogni computer
  if (ops.some((o) => o.kind === 'comment')) comments = [...comments].sort((p, q) => p.time - q.time || (p.id < q.id ? -1 : 1));
  const ids = new Set(nodes.map((n) => n.id));
  const out: Doc = { ...doc, nodes, edges: edges.filter((e) => ids.has(e.from.node) && ids.has(e.to.node)), settings };
  if (comments.length) out.comments = comments;
  else delete out.comments;
  return out;
}

// ---------- invio delle modifiche locali ----------

const sharing = () => connected && !!state.room && !state.joining && state.status === 'online' && !!synced;

function flush() {
  if (!sharing() || !synced) return;
  const doc = getState().doc;
  if (doc === synced && !unsent.size) return;
  const ops = diff(synced, doc);
  synced = doc;
  unsent = new Set();
  if (!ops.length) return;
  clock++;
  for (const op of ops) {
    op.clock = clock;
    stamps.set(`${op.kind}:${op.id}`, { clock, by: clientId });
  }
  const room = state.room;
  flying.add(ops);
  void queue({ type: 'ops', from: clientId, room, ops }).then((res) => {
    flying.delete(ops);
    if (res?.ok || state.room !== room) return;
    // non arrivate: ripartono fra poco, o con la figura degli altri dopo il ricollegamento
    for (const op of ops) unsent.add(`${op.kind}:${op.id}`);
    if (!sendTimer) sendTimer = setTimeout(() => {
      sendTimer = undefined;
      flush();
    }, 2000);
  });
  scheduleSnapshot();
}

// ---------- copia della figura sul server, per chi entra quando la stanza è vuota ----------

const isLeader = () => !!state.room && roomMates().every((m) => m.since > mySince || (m.since === mySince && m.id > clientId));

function scheduleSnapshot() {
  if (!sharing() || !leader || snapTimer) return;
  snapTimer = setTimeout(() => {
    snapTimer = undefined;
    if (sharing()) void post({ type: 'snapshot', room: state.room, doc: getState().doc, clock });
  }, 3000);
}

function onLocalChange() {
  if (!state.room) return;
  // un'altra figura aperta dal menu File (anche mentre si rientra dopo una caduta): non deve finire sopra quella condivisa
  if ((!state.joining || resync) && loadCount() !== loadsInRoom) {
    const name = roomName(state.room);
    void leaveRoom(true);
    toast(t('Hai aperto un’altra figura: sei uscito dalla stanza «{name}»', { name }), 'info');
    return;
  }
  if (!sharing() || getState().doc === synced || sendTimer) return;
  // cadenza fissa, non attesa della pausa: gli altri vedono anche i trascinamenti mentre avvengono
  sendTimer = setTimeout(() => {
    sendTimer = undefined;
    flush();
  }, 80);
}
const unsubscribeDoc = subscribe(onLocalChange);

// Durante un trascinamento il foglio riparte a ogni passo dal documento iniziale: le modifiche
// degli altri si mettono da parte e si applicano al rilascio, altrimenti andrebbero perse.
// Un trascinamento del sistema (un blocco dalla libreria, del testo) finisce con pointercancel e
// mai con pointerup: vale come rilascio, se no le modifiche degli altri restano ferme fino al clic dopo.
let dragging = false;
let held: { from: string; ops: Op[] }[] = [];
const onDown = () => {
  dragging = true;
};
const onUp = () => {
  dragging = false;
  if (!held.length || state.joining) return;
  // dopo che il foglio ha chiuso il suo gesto
  setTimeout(() => {
    if (dragging || state.joining) return;
    flush();
    releaseHeld();
  });
};
function releaseHeld() {
  const batch = held;
  held = [];
  for (const b of batch) applyRemote(b.from, b.ops);
}

function applyRemote(from: string, ops: Op[]) {
  if (!synced) return;
  const fresh = ops.filter((op) => {
    const key = `${op.kind}:${op.id}`;
    const s = stamps.get(key);
    // vale l'ultima modifica; a parità di contatore decide l'identificativo, uguale per tutti
    if (s && (s.clock > op.clock || (s.clock === op.clock && s.by >= from))) return false;
    stamps.set(key, { clock: op.clock, by: from });
    // ora vale la loro: la mia non arrivata non va più rimandata
    unsent.delete(key);
    return true;
  });
  if (!fresh.length) return;
  const doc = apply(getState().doc, fresh);
  synced = doc;
  setDoc(doc, { history: false });
  scheduleSnapshot();
}

// ---------- stanze: creare, entrare, uscire, chiudere ----------

/** Nome proposto per una stanza nuova: quello del file aperto. */
export function figureTitle() {
  const path = getState().filePath;
  if (!path) return t('Figura senza nome');
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1).replace(/\.(hfig|tfig|mlsketch)$/i, '');
}

/** Chiede la figura a chi è entrato per primo; se non risponde al successivo, poi al server. */
function askDoc() {
  clearTimeout(askTimer);
  if (!state.room || !state.joining) return;
  const target = roomMates().find((m) => !asked.has(m.id));
  if (target) {
    asked.add(target.id);
    void post({ type: 'hello', from: clientId, ask: target.id, room: state.room });
    askTimer = setTimeout(askDoc, 6000);
    return;
  }
  if (!fetched) {
    fetched = true;
    void post({ type: 'fetch', room: state.room });
    askTimer = setTimeout(askDoc, 8000);
    return;
  }
  if (resync) {
    // nessuna risposta: si tiene la propria figura e si continua
    resync = false;
    set({ joining: false });
    flush();
  } else {
    resetRoom();
    toast(t('Non riesco a ricevere la figura della stanza. Riprova fra poco.'), 'info');
  }
}

/** Esce dalla stanza solo qui, senza avvisare il server (stanza chiusa, gruppo dimenticato). */
function resetRoom() {
  clearTimeout(sendTimer);
  clearTimeout(askTimer);
  clearTimeout(snapTimer);
  sendTimer = snapTimer = askTimer = undefined;
  synced = null;
  unsent = new Set();
  flying = new Set();
  resync = false;
  leader = false;
  held = [];
  dragging = false;
  set({ room: null, joining: false, cursors: {} });
}

/** Crea una stanza con la figura aperta: gli altri del gruppo la vedono nell'elenco e possono entrare. */
export async function createRoom(name: string) {
  if (state.status !== 'online') return;
  if (state.room) await leaveRoom();
  const room = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  const doc = getState().doc;
  const loads = loadCount();
  const res = await post({ type: 'create', room, name, doc, clock });
  if (!res?.ok) throw new Error(t('Non riesco a creare la stanza. Riprova fra poco.'));
  synced = doc;
  stamps = new Map();
  loadsInRoom = loads;
  mySince = Date.now();
  leader = true;
  // subito nell'elenco, senza aspettare l'aggiornamento del server
  const mine: Room = { id: room, name, owner: clientId, ownerName: myName(), created: mySince };
  set({ room, joining: false, cursors: {}, rooms: [...state.rooms.filter((r) => r.id !== room), mine] });
  toast(t('Stanza «{name}» creata: il gruppo la vede nell’elenco', { name }));
  // le modifiche fatte mentre la richiesta viaggiava (o un'altra figura aperta nel frattempo)
  onLocalChange();
}

/** Dopo la richiesta di entrare: si chiede la figura, oppure si riprova. */
function entered(room: string, res: Response | null, wait: number) {
  if (state.room !== room || !state.joining) return;
  clearTimeout(askTimer);
  // l'elenco aggiornato delle persone arriva subito dopo
  if (res?.ok) askTimer = setTimeout(askDoc, wait);
  else if (res?.status === 404) receiveClosed({ type: 'closed', room, name: roomName(room), by: '', byId: '' });
  // 410: ci si sta ricollegando, e al ricollegamento si rientra
  else if (res?.status !== 410) askTimer = setTimeout(rejoin, 3000);
}

/** Entra in una stanza: la figura aperta viene sostituita da quella della stanza. */
export async function joinRoom(room: string) {
  if (!state.rooms.some((r) => r.id === room) || state.status !== 'online' || room === state.room) return;
  if (state.room) await leaveRoom();
  synced = null;
  resync = false;
  asked = new Set();
  fetched = false;
  held = [];
  set({ room, joining: true, cursors: {} });
  entered(room, await post({ type: 'join', room }), 0);
}

/** Ricollegato dopo una caduta: si rientra nella stessa stanza senza perdere le mie modifiche. */
async function rejoin() {
  const room = state.room;
  if (!room || !connected) return;
  clearTimeout(askTimer);
  asked = new Set();
  fetched = false;
  // se si stava già rientrando, le modifiche fatte senza rete sono ancora da rimettere sopra
  resync ||= !state.joining && !!synced;
  set({ joining: true });
  entered(room, await post({ type: 'join', room }), 400);
}

/**
 * Esce dalla stanza, che resta aperta per gli altri. Chi esce per ultimo lascia al server la copia
 * aggiornata. `opened`: è appena stata aperta un'altra figura, e quella sullo schermo non è più della stanza.
 */
export async function leaveRoom(opened = false) {
  const room = state.room;
  if (!room) return;
  if (!opened) flush();
  const last = !roomMates().length && sharing() ? { type: 'snapshot', room, doc: opened ? synced : getState().doc, clock } : null;
  const online = state.status === 'online';
  resetRoom();
  if (!online) return;
  if (last) await post(last);
  // dopo le ultime modifiche ancora in viaggio
  await queue({ type: 'leave', room });
}

/** Chiude la stanza per tutti: chi è dentro esce, ma la figura resta aperta sul suo computer. */
export async function closeRoom(room: string) {
  const res = await post({ type: 'close', room });
  if (!res?.ok) throw new Error(t('Non è stato possibile chiudere la stanza. Riprova fra poco.'));
}

function receiveDoc(msg: Extract<Msg, { type: 'doc' }>) {
  if (msg.to !== clientId || !state.joining || (msg.room && msg.room !== state.room)) return;
  const remote = normalizeDoc(msg.doc); // se è rovinata si aspetta la prossima risposta
  clearTimeout(askTimer);
  const theirs = Number.isFinite(msg.clock) ? msg.clock : 0;
  const newer = theirs > clock; // confrontato prima di aggiornare il mio contatore
  clock = Math.max(clock, theirs);
  stamps = new Map();
  if (resync && synced && msg.from === 'server' && !newer) {
    // la copia del server non ha niente di più recente della mia: si continua con la mia
    resync = false;
    set({ joining: false });
    flush();
  } else if (resync && synced) {
    // le mie modifiche fatte senza rete si rimettono sopra la figura degli altri, e poi partono
    const mine = diff(synced, getState().doc);
    synced = remote;
    unsent = new Set();
    resync = false;
    set({ joining: false });
    setDoc(apply(remote, mine), { history: false });
    flush();
  } else {
    synced = remote;
    unsent = new Set();
    loadsInRoom = loadCount() + 1;
    set({ joining: false });
    loadDoc(remote, null);
    toast(t('Sei nella stanza «{name}»: ogni modifica si vede subito da tutti', { name: roomName(state.room) }));
  }
  leader = isLeader();
  releaseHeld();
}

function receiveClosed(msg: Extract<Msg, { type: 'closed' }>) {
  if (msg.room !== state.room) return;
  // anche mentre si rientra dopo una caduta la figura sullo schermo è quella della stanza
  const wasIn = !state.joining || resync;
  resetRoom();
  // la figura resta sullo schermo: segnata da salvare, perché non appartiene più a nessuna stanza
  if (wasIn) setDoc(getState().doc, { history: false });
  if (msg.byId === clientId) toast(t('Stanza «{name}» chiusa', { name: msg.name }));
  else if (msg.by) toast(t('{name} ha chiuso la stanza «{room}». La figura resta aperta qui: salvala se vuoi tenerla.', { name: msg.by, room: msg.name }), 'info');
  else toast(t('Questa stanza è stata chiusa nel frattempo.'), 'info');
}

// ---------- ricezione ----------

function receive(msg: Msg) {
  if (msg.type === 'people') {
    const before = roomMates();
    const people = msg.people ?? [];
    mySince = people.find((p) => p.id === clientId)?.since ?? mySince;
    set({ members: people.filter((p) => p.id !== clientId), rooms: msg.rooms ?? [] });
    if (!state.room) return;
    const after = roomMates();
    const cursors = Object.fromEntries(Object.entries(state.cursors).filter(([id]) => after.some((m) => m.id === id)));
    set({ cursors });
    if (state.joining) return;
    // chi era primo è uscito: ora la copia sul server la mando io
    const was = leader;
    leader = isLeader();
    if (leader && !was) scheduleSnapshot();
    for (const m of after) if (!before.some((b) => b.id === m.id)) toast(t('{name} è entrato nella stanza', { name: m.name }));
    for (const m of before) if (!after.some((a) => a.id === m.id)) toast(t('{name} è uscito dalla stanza', { name: m.name }), 'info');
    return;
  }
  if (msg.type === 'closed') return receiveClosed(msg);
  if (msg.from === clientId || !state.room || (msg.room && msg.room !== state.room)) return;
  if (msg.type === 'hello') {
    // dopo una caduta della rete anche chi sta rientrando ha una figura valida da dare
    if (msg.ask !== clientId || !synced || (state.joining && !resync)) return;
    flush();
    void post({ type: 'doc', from: clientId, to: msg.from, room: state.room, doc: getState().doc, clock });
  } else if (msg.type === 'doc') {
    receiveDoc(msg);
  } else if (msg.type === 'ops') {
    const ops = (Array.isArray(msg.ops) ? msg.ops : []).filter(valid);
    if (!ops.length) return;
    flush(); // prima partono le mie modifiche in sospeso, con il loro contatore
    for (const op of ops) clock = Math.max(clock, op.clock);
    if (dragging || state.joining) held.push({ from: msg.from, ops });
    else applyRemote(msg.from, ops);
  } else if (msg.type === 'cursor') {
    // un cursore in ritardo da chi è già uscito resterebbe fermo sul foglio
    if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y) || !roomMates().some((m) => m.id === msg.from)) return;
    set({ cursors: { ...state.cursors, [msg.from]: { x: msg.x, y: msg.y } } });
  }
}

// ---------- cursore ----------

let lastCursor = 0;
function onPointerMove(e: PointerEvent) {
  const now = Date.now();
  if (!sharing() || now - lastCursor < 50 || !roomMates().length) return;
  const el = document.querySelector('.canvas');
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
  lastCursor = now;
  const { view } = getState();
  void post({ type: 'cursor', from: clientId, room: state.room, x: (e.clientX - r.left - view.x) / view.zoom, y: (e.clientY - r.top - view.y) / view.zoom });
}
// la rete torna (risveglio dal riposo, Wi-Fi cambiato): il vecchio collegamento è probabilmente morto
const onOnline = () => {
  if (state.status !== 'none') open();
};
const windowListeners: [string, EventListener, boolean][] = [
  ['pointermove', onPointerMove as EventListener, false],
  ['pointerdown', onDown, true],
  ['pointerup', onUp, true],
  ['pointercancel', onUp, true],
  ['online', onOnline, false],
];
if (typeof window !== 'undefined') for (const [type, fn, capture] of windowListeners) window.addEventListener(type, fn, capture);

// ---------- configurazione del gruppo ----------

/** Questo computer diventa il server del gruppo; ci si collega subito come tutti gli altri. */
export async function createGroup(name: string, openAtLogin: boolean) {
  const info = await groupCreate({ name, openAtLogin });
  writeConfig({ invite: info.local, group: info.name });
  set({ hosting: info, invite: info.local, group: info.name });
  open();
}

/** Si collega al server di un collega con l'invito ricevuto. */
export async function joinGroup(invite: string) {
  const group = await probe(invite);
  const p = parseInvite(invite)!;
  const clean = `${p.base}/${p.key}`;
  writeConfig({ invite: clean, group });
  set({ invite: clean, group });
  open();
}

/** Dimentica il server: il pulsante torna spento finché non se ne collega un altro. */
export function leaveGroup() {
  void leaveRoom();
  close();
  writeConfig(null);
  set({ status: 'none', badKey: false, group: '', invite: '', members: [], rooms: [], cursors: {} });
}

/** Spegne il server ospitato qui: l'invito smette di valere per tutti. */
export async function stopServer() {
  leaveGroup();
  await groupStop();
  set({ hosting: null });
}

export const setHosting = (hosting: GroupHost | null) => set({ hosting });

// Il nome scelto vale anche per gli altri: ci si ricollega per farlo vedere.
// Anche le modifiche da profilo, onboarding e progetti aggiornano il nome live.
let lastAuthor = getAuthor();
const unsubscribeProfile = subscribeProfile(() => {
  const name = getAuthor();
  if (name === lastAuthor) return;
  lastAuthor = name;
  if (state.status !== 'none') open();
});

async function init() {
  const hosting = await groupStatus().catch(() => null);
  const saved = readConfig();
  if (hosting) {
    // il server di questo computer è ripartito da solo: ci si ricollega all'indirizzo locale
    writeConfig({ invite: hosting.local, group: hosting.name });
    set({ hosting, invite: hosting.local, group: hosting.name });
    open();
  } else if (saved) {
    set({ invite: saved.invite, group: saved.group });
    open();
  }
}
void init();

// in sviluppo, quando Vite ricarica questo file: il vecchio collegamento (stesso identificativo) non deve
// contendersi il server con quello nuovo
import.meta.hot?.dispose(() => {
  close();
  resetRoom();
  unsubscribeDoc();
  unsubscribeProfile();
  if (typeof window !== 'undefined') for (const [type, fn, capture] of windowListeners) window.removeEventListener(type, fn, capture);
});
