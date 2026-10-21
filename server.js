const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const Game = require('./game');
const db = require('./db');
const { CARDS, FREE_STICKERS } = require('./public/shared/cards');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------------ REST: auth / profile / shop
const auth = (req) => db.byToken(req.headers['x-token'] || '');
const reply = (res, r) => res.status(r.error ? 400 : 200).json(r);

app.post('/api/register', (req, res) => { const b = req.body || {}; reply(res, db.register(b.username, b.password, b.displayName)); });
app.post('/api/login', (req, res) => { const b = req.body || {}; reply(res, db.login(b.username, b.password)); });
app.post('/api/logout', (req, res) => { db.logout(req.headers['x-token']); res.json({ ok: true }); });
app.get('/api/me', (req, res) => { const u = auth(req); u ? res.json({ user: db.publicUser(u) }) : res.status(401).json({ error: 'auth' }); });
app.post('/api/profile', (req, res) => reply(res, db.updateProfile(req.headers['x-token'], req.body || {})));
app.post('/api/buy', (req, res) => {
  const b = req.body || {};
  const r = db.buy(req.headers['x-token'], b.itemId);
  if (r.user) {
    for (const g of games.values()) {
      const p = g.players.find(x => x.userId === r.user.username);
      if (p) {
        p.frame = r.user.equipped.frame;
        p.skin = r.user.equipped.skin;
        p.avatar = r.user.avatar;
        p.title = r.user.equipped.title || r.user.title;
        g.sync();
      }
    }
  }
  reply(res, r);
});
app.post('/api/equip', (req, res) => {
  const b = req.body || {};
  const r = db.equip(req.headers['x-token'], b.itemId, b.type);
  if (r.user) {
    for (const g of games.values()) {
      const p = g.players.find(x => x.userId === r.user.username);
      if (p) {
        if (b.type === 'frame') p.frame = r.user.equipped.frame;
        if (b.type === 'skin') p.skin = r.user.equipped.skin;
        if (b.type === 'avatar') p.avatar = r.user.avatar;
        if (b.type === 'title') p.title = r.user.equipped.title;
        g.sync();
      }
    }
  }
  reply(res, r);
});
app.post('/api/daily', (req, res) => reply(res, db.dailyBonus(req.headers['x-token'])));
app.get('/api/mailbox', (req, res) => res.json(db.getMailbox(req.headers['x-token'])));
app.post('/api/mailbox/claim', (req, res) => { const b = req.body || {}; reply(res, db.claimMail(req.headers['x-token'], b.mailId || 'all')); });
app.post('/api/gacha', (req, res) => { const b = req.body || {}; reply(res, db.gacha(req.headers['x-token'], b.times || 1)); });
app.get('/api/leaderboard', (req, res) => res.json({ list: db.leaderboard() }));
app.get('/api/card-images', (req, res) => {
  const dir = path.join(__dirname, 'public', 'img', 'cards');
  const map = {};
  try {
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(.+)\.(svg|png|jpe?g|webp)$/i);
      if (m) {
        const id = m[1];
        const isSvg = /\.svg$/i.test(f);
        // Prioritize SVG: only replace if we don't have this card yet, or if current file is SVG
        if (!map[id] || isSvg) {
          const v = Math.floor(fs.statSync(path.join(dir, f)).mtimeMs / 1000);
          map[id] = `/img/cards/${f}?v=${v}`;
        }
      }
    }
  } catch (e) { /* no folder yet */ }
  res.json(map);
});

// ------------------------------------------------------------------ rooms
const games = new Map();        // code -> Game
const socketRoom = new Map();   // socketId -> code

function newCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c; do { c = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); } while (games.has(c));
  return c;
}

function onGameEnd(game, results) {
  const humans = game.players.filter(p => !p.isBot).length;
  const rewards = {};
  const stakeKey = game.settings.stake || 'casual';
  const STAKES_CONFIG = {
    casual: { mult: 1, bonusDiamonds: 0 },
    standard: { mult: 2, bonusDiamonds: 1 },
    high: { mult: 5, bonusDiamonds: 8 },
    vip: { mult: 10, bonusDiamonds: 25 }
  };
  const stk = STAKES_CONFIG[stakeKey] || STAKES_CONFIG.casual;

  for (const r of results) {
    const p = r.player;
    if (p.isBot || !p.userId) continue;
    const rec = db.recordGame(p.userId, {
      place: r.place, total: results.length, won: r.place === 1, exploded: !!p.elimReason, defuses: p.defuses,
      vsBotsOnly: humans === 1, version: game.settings.version,
      stake: stakeKey,
      stakeMultiplier: stk.mult,
      stakeDiamonds: r.place === 1 ? stk.bonusDiamonds : 0
    });
    if (rec) {
      rewards[p.id] = { coins: rec.coins, diamonds: rec.diamonds, rp: rec.rp, stake: stakeKey };
      p.rp = rec.user.rp; p.inventory = rec.user.inventory;
      if (p.socketId) {
        io.to(p.socketId).emit('profile', rec.user);
        if (rec.vault) io.to(p.socketId).emit('vault', rec.vault);
      }
    }
  }
  return rewards;
}

const ctx = (socket) => { const code = socketRoom.get(socket.id); return code ? games.get(code) : null; };

function leave(socket) {
  const code = socketRoom.get(socket.id); if (!code) return;
  const g = games.get(code); socketRoom.delete(socket.id); socket.leave(code);
  if (!g) return;
  g.removeSocket(socket.id);
  const empty = () => !g.players.some(p => !p.isBot && p.connected) && !(g.spectators && g.spectators.some(s => s.connected));
  if (empty()) {
    const delay = g.state === 'LOBBY' ? 15000 : 60000;
    setTimeout(() => { if (empty() && games.get(code) === g) { g.clearAll(); games.delete(code); } }, delay);
  } else g.sync();
}

function enter(socket, g, player) {
  socketRoom.set(socket.id, g.code); socket.join(g.code);
  socket.emit('joined', { code: g.code, playerId: player.id, key: player.key });
  g.sync();
}

io.on('connection', (socket) => {
  const err = (e) => socket.emit('err', e);
  const user = () => db.byToken(socket.handshake.auth?.token || socket.data.token || '');
  const safeObj = (d) => (d && typeof d === 'object') ? d : {};

  socket.on('auth', (token) => {
    socket.data.token = token;
    const u = db.byToken(token);
    if (u) {
      const g = ctx(socket);
      const p = g && g.bySocket(socket.id);
      if (p && !p.userId) {
        p.userId = u.username;
        p.rp = u.rp;
        p.inventory = u.inventory;
        g.sync();
      }
    }
  });

  socket.on('createRoom', (data) => {
    try {
      const d = safeObj(data);
      leave(socket);
      const g = new Game(newCode(), io, onGameEnd);
      const r = g.addHuman(socket.id, d.name, user(), d); if (r.error) return err(r.error);
      games.set(g.code, g);
      if (d.settings) g.updateSettings(socket.id, d.settings);
      for (let i = 0; i < Math.min(7, d.bots || 0); i++) g.addBot();
      enter(socket, g, r.player);
    } catch (e) {
      console.error('[createRoom error]', e);
    }
  });

  socket.on('quickSolo', (data) => {
    try {
      const d = safeObj(data);
      leave(socket);
      const g = new Game(newCode(), io, onGameEnd);
      const r = g.addHuman(socket.id, d.name, user(), d); if (r.error) return err(r.error);
      games.set(g.code, g);
      if (d.settings) g.updateSettings(socket.id, d.settings);
      for (let i = 0; i < Math.max(1, Math.min(7, d.bots ?? 3)); i++) g.addBot();
      enter(socket, g, r.player);
      g.start(socket.id);
    } catch (e) {
      console.error('[quickSolo error]', e);
    }
  });

  socket.on('listRooms', () => {
    try {
      const list = [];
      for (const [code, g] of games.entries()) {
        const host = g.players.find(p => p.isHost);
        const humans = g.players.filter(p => !p.isBot).length;
        list.push({
          code,
          state: g.state,
          version: g.settings.version,
          stake: g.settings.stake || 'casual',
          playerCount: g.players.length,
          maxPlayers: g.settings.maxPlayers || 5,
          hostName: host ? host.name : 'Doggo',
          hostAvatar: host ? host.avatar : '🐶',
          humans
        });
      }
      socket.emit('roomsList', list);
    } catch (e) {
      console.error('[listRooms error]', e);
    }
  });

  socket.on('joinRandom', (data) => {
    try {
      const d = safeObj(data);
      leave(socket);
      // Try to find open lobby with space
      let target = null;
      for (const [, g] of games.entries()) {
        if (g.state === 'LOBBY' && g.players.length < (g.settings.maxPlayers || 5)) {
          if (d.version && g.settings.version === d.version) {
            target = g;
            break;
          }
          if (!target) target = g;
        }
      }
      if (target) {
        const r = target.addHuman(socket.id, d.name, user(), d);
        if (!r.error) {
          enter(socket, target, r.player);
          return;
        }
      }
      // If none found, create a new room and add 1 bot so it's lively
      const g = new Game(newCode(), io, onGameEnd);
      const r = g.addHuman(socket.id, d.name, user(), d);
      if (r.error) return err(r.error);
      games.set(g.code, g);
      const st = {};
      if (d.version) st.version = d.version;
      if (d.stake) st.stake = d.stake;
      g.updateSettings(socket.id, st);
      g.addBot();
      enter(socket, g, r.player);
    } catch (e) {
      console.error('[joinRandom error]', e);
    }
  });

  socket.on('joinRoom', (data) => {
    try {
      const d = safeObj(data);
      const g = games.get(String(d.code || '').toUpperCase().trim());
      if (!g) return err('room_not_found');
      leave(socket);
      let r;
      if (g.state === 'LOBBY') {
        r = g.addHuman(socket.id, d.name, user(), d);
      } else {
        // Room is currently playing/ended: join as spectator
        r = g.addSpectator(socket.id, d.name, user(), d);
      }
      if (r.error) return err(r.error);
      enter(socket, g, r.player);
    } catch (e) {
      console.error('[joinRoom error]', e);
    }
  });

  socket.on('rejoin', (data) => {
    try {
      const d = safeObj(data);
      const g = games.get(d.code); if (!g) return socket.emit('rejoinFailed');
      leave(socket);
      const r = g.rejoin(socket.id, d.playerId, d.key); if (r.error) return socket.emit('rejoinFailed');
      enter(socket, g, r.player);
    } catch (e) {
      console.error('[rejoin error]', e);
      socket.emit('rejoinFailed');
    }
  });

  const chatCooldown = new Map();
  socket.on('leaveRoom', () => {
    const code = socketRoom.get(socket.id);
    if (code) {
      const g = games.get(code);
      socketRoom.delete(socket.id);
      socket.leave(code);
      if (g) {
        g.explicitLeave(socket.id);
        const empty = () => !g.players.some(p => !p.isBot && p.connected) && !(g.spectators && g.spectators.some(s => s.connected));
        if (empty()) {
          const delay = g.state === 'LOBBY' ? 15000 : 60000;
          setTimeout(() => { if (empty() && games.get(code) === g) { g.clearAll(); games.delete(code); } }, delay);
        }
      }
    }
    socket.emit('left');
  });

  const act = (event, fn) => socket.on(event, (data) => {
    try {
      const g = ctx(socket); if (!g) return;
      const d = safeObj(data);
      const r = fn(g, d) || {};
      if (r.error) err(r.error);
      g.sync();
    } catch (e) {
      console.error(`[socket act error: ${event}]`, e);
    }
  });
  act('addBot', (g) => g.addBot(socket.id));
  act('removeBot', (g, d) => g.removeBot(socket.id, d.botId));
  act('setReady', (g, d) => g.setReady(socket.id, d.ready));
  act('settings', (g, d) => g.updateSettings(socket.id, d));
  act('start', (g) => g.start(socket.id));
  act('draw', (g) => g.drawAction(socket.id));
  act('play', (g, d) => g.play(socket.id, d.uids, d.targetId, d.namedId));
  act('respond', (g, d) => g.respond(socket.id, d));
  act('backToLobby', (g) => g.backToLobby(socket.id));
  socket.on('reorder', (data) => {
    try {
      const { from, to } = safeObj(data);
      const g = ctx(socket); const p = g && g.bySocket(socket.id); if (!p) return;
      if (from >= 0 && to >= 0 && from < p.hand.length && to < p.hand.length) { p.hand.splice(to, 0, p.hand.splice(from, 1)[0]); }
      socket.emit('state', g.getState(p));
    } catch (e) { console.error('[reorder error]', e); }
  });
  const KIND_ORDER = { defense: 1, reaction: 2, action: 3, cat: 4, special: 5, bomb: 6 };
  socket.on('sortHand', () => {
    try {
      const g = ctx(socket); const p = g && g.bySocket(socket.id); if (!p || !p.hand) return;
      p.hand.sort((a, b) => {
        const ka = KIND_ORDER[CARDS[a.id]?.kind] ?? 99;
        const kb = KIND_ORDER[CARDS[b.id]?.kind] ?? 99;
        if (ka !== kb) return ka - kb;
        return a.id.localeCompare(b.id);
      });
      socket.emit('state', g.getState(p));
    } catch (e) { console.error('[sortHand error]', e); }
  });
  socket.on('shuffleHand', () => {
    try {
      const g = ctx(socket); const p = g && g.bySocket(socket.id); if (!p || !p.hand || p.hand.length <= 1) return;
      for (let i = p.hand.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [p.hand[i], p.hand[j]] = [p.hand[j], p.hand[i]];
      }
      socket.emit('state', g.getState(p));
    } catch (e) { console.error('[shuffleHand error]', e); }
  });
  socket.on('chat', (data) => {
    try {
      const now = Date.now();
      const last = chatCooldown.get(socket.id) || 0;
      if (now - last < 500) return;
      chatCooldown.set(socket.id, now);
      const { text } = safeObj(data);
      const g = ctx(socket); if (g) g.chat(socket.id, text);
    } catch (e) { console.error('[chat error]', e); }
  });
  socket.on('sticker', (data) => {
    try {
      const now = Date.now();
      const last = chatCooldown.get(socket.id + '_stk') || 0;
      if (now - last < 700) return;
      chatCooldown.set(socket.id + '_stk', now);
      const { id } = safeObj(data);
      const g = ctx(socket); if (g) g.sticker(socket.id, id, FREE_STICKERS.map(s => s.id));
    } catch (e) { console.error('[sticker error]', e); }
  });

  socket.on('disconnect', () => leave(socket));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('===============================================');
  console.log('🐱💣 Exploding Kittens Online is RUNNING');
  console.log(`🔗 http://localhost:${PORT}`);
  console.log('===============================================');
});
