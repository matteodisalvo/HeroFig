// Native HeroFig collaboration. No vendor API keys and no access to the desktop filesystem.
// Groups are temporary (24 hours), memory-only; users keep their .hfig files locally.
import http from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const secret = () => randomBytes(32).toString('base64url');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const docOK = (doc) => object(doc) && Array.isArray(doc.nodes) && Array.isArray(doc.edges) && object(doc.settings);
const text = (value, length) => typeof value === 'string' ? value.trim().slice(0, length) : '';
const clockOf = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const roomID = /^[a-z0-9]{8}$/;
const credential = /^[A-Za-z0-9_-]{43}$/;

export function createCollaborationServer(options = {}) {
  const {
    ttl = 24 * 60 * 60 * 1000, maxGroups = 100, maxMembers = 32, maxRooms = 20,
    maxBody = 16 * 1024 * 1024, maxMemory = 256 * 1024 * 1024,
    heartbeat = 15000, trustProxy = false, now = Date.now,
  } = options;
  const groups = new Map();
  const rates = new Map();
  let storedBytes = 0;

  function rate(key, limit, period) {
    let r = rates.get(key);
    if (!r || r.until <= now()) {
      if (!r && rates.size >= 10000) return false;
      r = { count: 0, until: now() + period };
      rates.set(key, r);
    }
    return ++r.count <= limit;
  }
  const send = (res, msg) => {
    if (!res || res.destroyed || res.writableEnded) return;
    // Disconnect a slow reader instead of retaining an unbounded queue.
    if (res.writableLength > maxBody * 2) return res.destroy();
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };
  function announce(g) {
    const people = [...g.members.values()].filter((m) => m.res).map(({ id, name, room, since }) => ({ id, name, room, since }));
    const rooms = [...g.rooms.values()].map(({ id, name, owner, ownerName, created }) => ({ id, name, owner, ownerName, created }));
    for (const m of g.members.values()) send(m.res, { type: 'people', people, rooms });
  }
  function removeGroup(id) {
    const g = groups.get(id);
    if (!g) return;
    groups.delete(id);
    for (const r of g.rooms.values()) storedBytes -= r.bytes;
    for (const m of g.members.values()) {
      send(m.res, { type: 'expired' });
      m.res?.end();
    }
  }
  function addMember(g, name, owner = false) {
    const token = secret();
    const m = { id: randomBytes(16).toString('hex'), name: text(name, 80) || 'Guest', owner, room: null, since: 0, res: null };
    g.members.set(hash(token), m);
    return { group: g.id, name: g.name, id: m.id, token, owner, expiresAt: g.expiresAt };
  }
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(value));
  };
  async function readBody(req) {
    let bytes = 0;
    const chunks = [];
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > maxBody) throw Object.assign(new Error('too_large'), { status: 413 });
      chunks.push(chunk);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw Object.assign(new Error('invalid_body'), { status: 400 }); }
    if (!object(body)) throw Object.assign(new Error('invalid_body'), { status: 400 });
    return body;
  }
  function setSnapshot(r, doc, clock) {
    if (!docOK(doc)) return 400;
    const raw = JSON.stringify(doc);
    const bytes = Buffer.byteLength(raw);
    if (storedBytes - r.bytes + bytes > maxMemory) return 507;
    storedBytes += bytes - r.bytes;
    Object.assign(r, { doc: raw, bytes, clock: clockOf(clock) });
    return 0;
  }

  async function handle(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // Bearer credentials, never cookies. Desktop file:// origins are supported.
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      });
      return res.end();
    }
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { service: 'herofig-collaboration', version: 1 });
    if (req.method === 'GET' && /^\/join\/[a-f0-9]{32}$/.test(url.pathname)) {
      // The invitation secret is in the fragment, which is not sent in this request.
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Security-Policy': "default-src 'none'" });
      return res.end('HeroFig — Copy the full invitation into Together → I received an invitation.\nCopia l’invito completo in Insieme → Ho ricevuto un invito.');
    }
    const ip = trustProxy ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress;
    if (req.method === 'POST' && url.pathname === '/v1/groups') {
      if (!rate(`create:${ip}`, 5, 60000)) return json(res, 429, { error: 'rate_limit' });
      if (groups.size >= maxGroups) return json(res, 503, { error: 'capacity' });
      const body = await readBody(req);
      if (groups.size >= maxGroups) return json(res, 503, { error: 'capacity' });
      const id = randomBytes(16).toString('hex'), invite = secret();
      const g = { id, name: text(body.name, 60) || 'HeroFig', inviteHash: hash(invite), expiresAt: now() + ttl, members: new Map(), rooms: new Map() };
      groups.set(id, g);
      return json(res, 201, { ...addMember(g, body.memberName, true), invite });
    }
    const match = url.pathname.match(/^\/v1\/groups\/([a-f0-9]{32})\/(join|info|events|msg|session|close)$/);
    if (!match) return json(res, 404, { error: 'not_found' });
    const [, id, action] = match;
    const g = groups.get(id);
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (!g || g.expiresAt <= now()) {
      if (g) removeGroup(id);
      return json(res, 403, { error: 'expired' });
    }
    if (!credential.test(token)) return json(res, 403, { error: 'invalid_credential' });
    if (action === 'join' && req.method === 'POST') {
      if (!rate(`join:${ip}`, 30, 60000)) return json(res, 429, { error: 'rate_limit' });
      if (hash(token) !== g.inviteHash) return json(res, 403, { error: 'invalid_invite' });
      if (g.members.size >= maxMembers) return json(res, 409, { error: 'capacity' });
      const body = await readBody(req);
      if (groups.get(id) !== g) return json(res, 403, { error: 'expired' });
      if (g.members.size >= maxMembers) return json(res, 409, { error: 'capacity' });
      return json(res, 201, addMember(g, body.name));
    }
    const m = g.members.get(hash(token));
    if (!m) return json(res, 403, { error: 'invalid_session' });
    if (!rate(`member:${m.id}`, 240, 1000)) return json(res, 429, { error: 'rate_limit' });
    if (action === 'info' && req.method === 'GET') return json(res, 200, { name: g.name, expiresAt: g.expiresAt });
    if (action === 'close' && req.method === 'DELETE') {
      if (!m.owner) return json(res, 403, { error: 'forbidden' });
      removeGroup(id);
      return json(res, 200, { ok: true });
    }
    if (action === 'session' && req.method === 'DELETE') {
      g.members.delete(hash(token));
      m.res?.end();
      announce(g);
      return json(res, 200, { ok: true });
    }
    if (action === 'events' && req.method === 'GET') {
      res.on('error', () => res.destroy());
      const previous = m.res;
      m.res = res;
      previous?.end();
      m.name = text(url.searchParams.get('name'), 80) || m.name;
      m.room = null;
      m.since = 0;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' });
      res.write(': connected\n\n');
      announce(g);
      res.on('close', () => {
        if (m.res !== res) return;
        m.res = null;
        m.room = null;
        m.since = 0;
        announce(g);
      });
      return;
    }
    if (action !== 'msg' || req.method !== 'POST') return json(res, 405, { error: 'method' });
    if (!m.res) return json(res, 410, { error: 'reconnect' });
    const connection = m.res;
    const msg = await readBody(req);
    if (groups.get(id) !== g || !g.members.has(hash(token))) return json(res, 403, { error: 'expired' });
    if (m.res !== connection) return json(res, 410, { error: 'reconnect' });
    const room = typeof msg.room === 'string' && roomID.test(msg.room) ? msg.room : null;
    if (msg.type === 'create') {
      if (!room || g.rooms.has(room) || g.rooms.size >= maxRooms) return json(res, 409, { error: 'room' });
      const r = { id: room, name: text(msg.name, 80) || 'Room', owner: m.id, ownerName: m.name, created: now(), clock: 0, doc: '', bytes: 0 };
      const error = setSnapshot(r, msg.doc, msg.clock);
      if (error) return json(res, error, { error: 'document' });
      g.rooms.set(room, r);
      Object.assign(m, { room, since: now() });
      announce(g);
    } else if (msg.type === 'join') {
      if (!room || !g.rooms.has(room)) return json(res, 404, { error: 'room' });
      Object.assign(m, { room, since: now() });
      announce(g);
    } else if (msg.type === 'leave') {
      if (!room || m.room === room) Object.assign(m, { room: null, since: 0 });
      announce(g);
    } else if (msg.type === 'fetch') {
      const r = g.rooms.get(m.room);
      if (r) send(m.res, { type: 'doc', from: 'server', to: m.id, room: r.id, doc: JSON.parse(r.doc), clock: r.clock });
    } else if (msg.type === 'snapshot') {
      const r = room && m.room === room && g.rooms.get(room);
      if (!r) return json(res, 403, { error: 'room' });
      if (clockOf(msg.clock) < r.clock) return json(res, 409, { error: 'stale_snapshot' });
      const error = setSnapshot(r, msg.doc, msg.clock);
      if (error) return json(res, error, { error: 'document' });
    } else if (msg.type === 'close') {
      const r = g.rooms.get(room);
      if (!r) return json(res, 404, { error: 'room' });
      if (r.owner !== m.id && !m.owner) return json(res, 403, { error: 'forbidden' });
      g.rooms.delete(room);
      storedBytes -= r.bytes;
      for (const other of g.members.values()) if (other.room === room) {
        send(other.res, { type: 'closed', room, name: r.name, by: m.name, byId: m.id });
        Object.assign(other, { room: null, since: 0 });
      }
      announce(g);
    } else {
      if (!room || room !== m.room) return json(res, 403, { error: 'room' });
      // Explicit fields only: clients cannot spoof server messages or another member's identity.
      let outgoing;
      if (msg.type === 'hello' && typeof msg.ask === 'string') outgoing = { type: 'hello', ask: msg.ask };
      else if (msg.type === 'doc' && typeof msg.to === 'string' && docOK(msg.doc)) outgoing = { type: 'doc', to: msg.to, doc: msg.doc, clock: clockOf(msg.clock) };
      else if (msg.type === 'ops' && Array.isArray(msg.ops) && msg.ops.length <= 10000) outgoing = { type: 'ops', ops: msg.ops };
      else if (msg.type === 'cursor' && Number.isFinite(msg.x) && Number.isFinite(msg.y)) outgoing = { type: 'cursor', x: msg.x, y: msg.y };
      else return json(res, 400, { error: 'message' });
      outgoing = { ...outgoing, from: m.id, room };
      for (const other of g.members.values()) if (other !== m && other.room === room && (!outgoing.to || outgoing.to === other.id)) send(other.res, outgoing);
    }
    res.writeHead(204);
    res.end();
  }
  const server = http.createServer({ requestTimeout: 30000, headersTimeout: 10000, maxHeaderSize: 16384 }, (req, res) => {
    // Do not log requests, Authorization headers, documents or errors containing user input.
    handle(req, res).catch((err) => {
      if (!res.headersSent && !res.destroyed) json(res, err.status || 500, { error: err.status === 413 ? 'too_large' : 'request_failed' });
      else res.destroy();
    });
  });
  const timer = setInterval(() => {
    for (const [id, g] of groups) {
      if (g.expiresAt <= now()) removeGroup(id);
      else for (const m of g.members.values()) if (m.res && !m.res.destroyed) m.res.write(': heartbeat\n\n');
    }
    for (const [key, r] of rates) if (r.until <= now()) rates.delete(key);
  }, heartbeat);
  timer.unref();
  server.on('close', () => { clearInterval(timer); groups.clear(); rates.clear(); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createCollaborationServer({ trustProxy: process.env.HEROFIG_TRUST_PROXY === '1' });
  const port = Number(process.env.PORT || 8787);
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`HeroFig collaboration listening on port ${port}`));
  const stop = () => { server.close(); server.closeAllConnections(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
