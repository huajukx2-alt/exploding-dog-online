import { randomBytes, randomInt } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const ACTIONS = new Set(['left','right','jump','down','dodge','light','heavy','wind','skill','revive','swap','rage']);
const VERSION = 1;
const ID_RE = /^[a-z0-9_]{1,32}$/;
const SKIN_KINDS = new Set(['default','shop','reward']);
const U_KEYS = ['hp','dmg','wind','crit','rage','armor'];

function sanitizeBoolMap(obj, maxKeys) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
  const out = {};
  let count = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (count >= maxKeys) break;
    if (ID_RE.test(k) && typeof v === 'boolean') { out[k] = v; count++; }
  }
  return out;
}
function sanitizeIntMap(obj, maxKeys, min, max) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
  const out = {};
  let count = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (count >= maxKeys) break;
    if (ID_RE.test(k) && Number.isInteger(v) && v >= min && v <= max) { out[k] = v; count++; }
  }
  return out;
}
function sanitizeHeroMessage(msg) {
  const out = { type: 'hero', id: msg.id };
  if (typeof msg.weaponId === 'string' && ID_RE.test(msg.weaponId)) out.weaponId = msg.weaponId;
  if (typeof msg.skinKind === 'string' && SKIN_KINDS.has(msg.skinKind)) out.skinKind = msg.skinKind;
  const ownedWeapons = sanitizeBoolMap(msg.ownedWeapons, 24);
  if (ownedWeapons) out.ownedWeapons = ownedWeapons;
  const weaponLevels = sanitizeIntMap(msg.weaponLevels, 24, 1, 10);
  if (weaponLevels) out.weaponLevels = weaponLevels;
  const skills = sanitizeBoolMap(msg.skills, 64);
  if (skills) out.skills = skills;
  if (msg.U && typeof msg.U === 'object' && !Array.isArray(msg.U)) {
    const uOut = {};
    for (const k of U_KEYS) {
      const v = msg.U[k];
      if (Number.isInteger(v) && v >= 0 && v <= 10) uOut[k] = v;
    }
    out.U = uOut;
  }
  return out;
}

const send = (socket, message) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

export function attachRoomServer(server, { resumeWindow = 30000 } = {}) {
  const rooms = new Map();
  const allowedOrigins = new Set((process.env.HANUMAN_ROOM_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean));
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 128 * 1024,
    perMessageDeflate: {
      serverNoContextTakeover: true,
      clientNoContextTakeover: true,
      zlibDeflateOptions: { level: 1 },
    },
  });

  function sendPresence(room, slot) {
    const member = room.peers[slot];
    const message = { type: 'peer', connected: member?.socket?.readyState === WebSocket.OPEN };
    if (member?.expiry) message.reconnecting = true;
    send(room.peers[1 - slot]?.socket, message);
  }

  function removeMember(room, slot) {
    if (rooms.get(room.code) !== room) return;
    if (slot === 0) {
      rooms.delete(room.code);
      const guest = room.peers[1];
      clearTimeout(guest?.expiry);
      send(guest?.socket, { type: 'closed' });
      guest?.socket?.close(1000, 'host left');
    } else {
      room.peers[1] = null;
      sendPresence(room, 1);
    }
  }

  server.on('upgrade', (request, socket, head) => {
    let origin;
    try { origin = new URL(request.headers.origin); } catch {}
    const allowed = (origin && origin.host === request.headers.host) || allowedOrigins.has(request.headers.origin);
    if (request.url !== '/__rooms' || !allowed || wss.clients.size >= 256) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws));
  });

  wss.on('connection', ws => {
    let room, slot, member;
    let burstCount = 0, burstStart = Date.now();
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => ws.terminate());
    const handshake = setTimeout(() => { if (!room) ws.close(1008, 'missing room'); }, 12000);
    ws.on('message', (data, binary) => {
      const now = Date.now();
      if (now - burstStart >= 1000) { burstCount = 0; burstStart = now; }
      if (binary || ++burstCount > 180) { ws.close(1008, 'message policy'); return; }
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (!msg || typeof msg.type !== 'string') return;
      if (!room) {
        if (msg.v !== VERSION) { send(ws, {type:'error', reason:'version'}); return; }
        const found = typeof msg.code === 'string' && CODE.test(msg.code) ? rooms.get(msg.code) : null;
        if (msg.type === 'create') {
          if (rooms.size >= 128) { send(ws,{type:'error',reason:'capacity'}); return; }
          let code;
          do { code = Array.from({length:6}, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); } while (rooms.has(code));
          slot = 0;
          room = {code, peers:[null, null]};
          rooms.set(code, room);
        } else if (msg.type === 'join') {
          if (!found) { send(ws, {type:'error', reason:'missing'}); return; }
          if (found.peers[1]) { send(ws, {type:'error', reason:'full'}); return; }
          slot = 1;
          room = found;
        } else if (msg.type === 'resume') {
          slot = found?.peers.findIndex(peer => peer?.token && peer.token === msg.token);
          if (slot !== 0 && slot !== 1) { send(ws, {type:'error', reason:'expired'}); return; }
          room = found;
          member = room.peers[slot];
        } else return;

        member ??= { token: msg.resumable === true ? randomBytes(24).toString('hex') : null, socket: null, expiry: null };
        const previous = member.socket;
        clearTimeout(member.expiry);
        member.expiry = null;
        member.socket = ws;
        room.peers[slot] = member;
        previous?.close(4001, 'connection replaced');
        clearTimeout(handshake);
        const peer = room.peers[1 - slot];
        const response = { type: 'room', code: room.code, slot, peer: peer?.socket?.readyState === WebSocket.OPEN };
        if (member.token) response.token = member.token;
        if (peer?.expiry) response.reconnecting = true;
        send(ws, response);
        sendPresence(room, slot);
        return;
      }

      if (member.socket !== ws) return;
      if (msg.type === 'leave') { ws.close(1000, 'left'); return; }
      if (msg.type === 'ping') { send(ws, { type: 'pong' }); return; }
      const peer = room.peers[1 - slot]?.socket;
      if (!peer) return;
      if (slot === 0 && msg.type === 'state' && msg.state && peer.bufferedAmount < 256 * 1024) send(peer, msg);
      if (slot === 1 && msg.type === 'hero' && typeof msg.id === 'string' && /^[a-z]{3,12}$/.test(msg.id)) send(peer, sanitizeHeroMessage(msg));
      if (slot === 1 && msg.type === 'input' && ACTIONS.has(msg.key) && ['down','up','tap'].includes(msg.action)) send(peer, msg);
    });
    ws.on('close', code => {
      clearTimeout(handshake);
      if (!room || rooms.get(room.code) !== room || member.socket !== ws) return;
      member.socket = null;
      if (!member.token || code === 1000 || code === 1008 || code === 1009) {
        removeMember(room, slot);
        return;
      }
      member.expiry = setTimeout(() => removeMember(room, slot), resumeWindow);
      member.expiry.unref();
      sendPresence(room, slot);
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) ws.terminate();
      else { ws.alive = false; ws.ping(); }
    }
  }, 15000);
  heartbeat.unref();
  server.on('close', () => clearInterval(heartbeat));
  return wss;
}
