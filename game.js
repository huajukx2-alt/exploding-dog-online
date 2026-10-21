// Exploding Kittens game engine (multi-version, bots, nope windows, prompts)
const crypto = require('crypto');
const { CARDS, VERSIONS, CONFIGURABLE } = require('./public/shared/cards');

let uidSeq = 1;
const mk = (id, extra = {}) => ({ uid: 'c' + (uidSeq++), id, ...extra });
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const isBomb = (id) => id === 'exploding_kitten' || id === 'imploding_kitten';
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const count = (hand, id) => hand.filter(c => c.id === id).length;

const BOT_NAMES = ['บอทโกลเด้น', 'บอทไซบีเรียน', 'บอทคอร์กี้', 'บอทชิบะ', 'บอทปั๊กกี้', 'บอทชิวาวา', 'บอทบีเกิ้ล', 'บอทพุดเดิ้ล'];
const BOT_AVATARS = ['🐶', '🐕', '🦮', '🐩', '🐺', '🦊', '🐾', '🦴'];
const SAFE_ESCAPES = ['super_skip', 'skip', 'attack', 'targeted_attack', 'reverse', 'draw_bottom', 'bury'];
const CARD_VALUE = { defuse: 100, nope: 60, streaking_kitten: 90, tower_of_power: 50, super_skip: 45, attack: 40, targeted_attack: 40, skip: 35,
  see_the_future: 30, see_future_5: 32, alter_the_future: 33, alter_future_5: 35, shuffle: 25, favor: 20, reverse: 25, draw_bottom: 25 };
const valueOf = (c) => CARD_VALUE[c.id] ?? (CARDS[c.id]?.kind === 'cat' ? 5 : 15);

class Game {
  constructor(code, io, onEnd) {
    this.code = code; this.io = io; this.onEnd = onEnd;
    this.players = []; this.spectators = []; this.state = 'LOBBY'; this.phase = 'idle';
    this.settings = { version: 'original', stake: 'casual', custom: false, counts: { ...VERSIONS.original.counts }, turnSeconds: 28, nopeSeconds: 6, botLevel: 'normal', maxPlayers: 8 };
    this.deck = []; this.discard = []; this.log = [];
    this.timers = {}; this.seq = 1; this.deckRev = 0;
    this.lastResults = null;
    this.resetRound();
  }

  resetRound() {
    this.turnIdx = 0; this.turnsLeft = 1; this.direction = 1;
    this.pending = null; this.prompt = null; this.lastActionId = null;
    this.elimOrder = []; this.winnerId = null; this.turnDeadline = 0; this.turnRemainingMs = 0;
  }

  // ---------------------------------------------------------------- helpers
  byId(id) { return this.players.find(p => p.id === id) || this.spectators.find(s => s.id === id); }
  bySocket(sid) { return this.players.find(p => p.socketId === sid && !p.isBot) || this.spectators.find(s => s.socketId === sid); }
  cur() { return this.players[this.turnIdx]; }
  alive() { return this.players.filter(p => p.alive); }
  humans() { return this.players.filter(p => !p.isBot); }
  isAuto(p) { return p.isBot || p.auto; }
  nextAliveIdx(from, dir = this.direction) {
    const n = this.players.length;
    for (let s = 1; s <= n; s++) { const i = ((from + dir * s) % n + n) % n; if (this.players[i].alive) return i; }
    return from;
  }
  clear(name) { if (this.timers[name]) { clearTimeout(this.timers[name]); this.timers[name] = null; } }
  clearAll() { for (const k in this.timers) this.clear(k); }
  later(name, ms, fn) { this.clear(name); this.timers[name] = setTimeout(() => { this.timers[name] = null; try { fn(); } catch (e) { console.error('[game]', e); } }, ms); }

  fx(type, data = {}) {
    const ev = { type, t: Date.now(), ...data };
    if (data.playerId) ev.pn = this.byId(data.playerId)?.name;
    if (data.targetId) ev.tn = this.byId(data.targetId)?.name;
    this.log.push(ev); if (this.log.length > 60) this.log.shift();
    this.io.to(this.code).emit('fx', ev);
  }
  priv(p, type, data = {}) { if (p && !p.isBot && p.socketId) this.io.to(p.socketId).emit('private', { type, ...data }); }

  deckChanged(kind) {
    if (kind === 'top') for (const p of this.players) if (p.mem && p.mem.rev === this.deckRev) { p.mem.ids.shift(); p.mem.rev = this.deckRev + 1; }
    this.deckRev++;
  }
  remember(p, ids) { if (this.isAuto(p)) p.mem = { rev: this.deckRev, ids: [...ids] }; }

  // ---------------------------------------------------------------- lobby
  makePlayer(extra) {
    return { id: 'p' + (this.seq++), key: crypto.randomBytes(8).toString('hex'), hand: [], alive: true, ready: false, isHost: false,
      connected: true, auto: false, defuses: 0, mem: null, botPlays: 0, avatar: '🐶', frame: null, skin: null, title: 'title_rookie', rp: 0, userId: null, ...extra };
  }

  addHuman(socketId, name, user, guestData = {}) {
    if (this.state !== 'LOBBY') return { error: 'in_progress' };
    if (this.players.length >= this.settings.maxPlayers) return { error: 'room_full' };
    if (user && this.players.some(p => p.userId === user.username)) return { error: 'already_in' };
    const p = this.makePlayer({
      socketId, isBot: false, name: String((user && user.displayName) || name || 'Player').trim().slice(0, 16) || 'Player',
      userId: user ? user.username : null,
      avatar: user ? (user.avatar || '🐶') : (guestData?.avatar || '🐶'),
      frame: user ? (user.equipped?.frame || null) : (guestData?.frame || null),
      skin: user ? (user.equipped?.skin || null) : (guestData?.skin || null),
      title: user ? (user.equipped?.title || user.title || 'title_rookie') : (guestData?.title || 'title_rookie'),
      rp: user ? user.rp : 0,
      inventory: user ? user.inventory : []
    });
    if (!this.players.some(x => !x.isBot)) { p.isHost = true; p.ready = true; }
    this.players.push(p);
    this.fx('joined', { playerId: p.id });
    return { player: p };
  }

  addSpectator(socketId, name, user, guestData = {}) {
    // If this player was already an active human player in this game and left/disconnected, eliminate them cleanly
    const existingPlayer = this.players.find(p => !p.isBot && p.alive && ((user && p.userId === user.username) || p.name === name));
    if (existingPlayer) {
      this.eliminate(existingPlayer, 'exploded');
      this.afterElim(existingPlayer, null);
    }
    const p = {
      id: 'spec_' + (this.seq++),
      key: crypto.randomBytes(8).toString('hex'),
      hand: [],
      alive: false,
      isSpectator: true,
      ready: true,
      isHost: false,
      connected: true,
      auto: false,
      socketId,
      isBot: false,
      name: String((user && user.displayName) || name || 'Spectator').trim().slice(0, 16) || 'Spectator',
      userId: user ? user.username : null,
      avatar: user ? (user.avatar || '🐶') : (guestData?.avatar || '🐶'),
      frame: user ? (user.equipped?.frame || null) : (guestData?.frame || null),
      skin: user ? (user.equipped?.skin || null) : (guestData?.skin || null),
      title: user ? (user.equipped?.title || user.title || 'title_rookie') : (guestData?.title || 'title_rookie'),
      rp: user ? user.rp : 0,
      inventory: user ? user.inventory : []
    };
    this.spectators.push(p);
    this.fx('joined', { playerId: p.id, name: p.name, spectator: true });
    return { player: p };
  }

  addBot(socketId) {
    const host = this.bySocket(socketId);
    if (socketId && (!host || !host.isHost)) return { error: 'host_only' };
    if (this.state !== 'LOBBY') return { error: 'in_progress' };
    if (this.players.length >= this.settings.maxPlayers) return { error: 'room_full' };
    const used = new Set(this.players.map(p => p.name));
    const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot' + this.seq;
    const idx = Math.max(0, BOT_NAMES.indexOf(name));
    const botAvatars = ['av_shiba_vip', 'av_cyber_husky', 'av_blaze_bulldog', 'av_corgi_galaxy', 'av_diamond_poodle', 'av_samurai_akita', 'av_gentleman_pug', 'av_ninja_dog'];
    const botFrames = ['frame_gold', 'frame_neon', 'frame_fire', 'frame_rainbow', 'frame_diamond', 'frame_cyber', 'frame_sakura', 'frame_abyss'];
    const botSkins = ['skin_gold', 'skin_galaxy', 'skin_sakura', 'skin_matrix', 'skin_diamond', 'skin_dragon', 'skin_cyber', 'skin_cosmic_void'];
    const botTitles = ['title_bomb_master', 'title_nope_king', 'title_rich_doge', 'title_undefeated', 'title_grim_reaper', 'title_lucky_star', 'title_fried_chicken', 'title_cyber_overlord'];
    const p = this.makePlayer({
      isBot: true,
      name,
      ready: true,
      avatar: botAvatars[idx % botAvatars.length] || '🐶',
      frame: botFrames[idx % botFrames.length],
      skin: botSkins[idx % botSkins.length],
      title: botTitles[idx % botTitles.length],
      socketId: null
    });
    this.players.push(p);
    this.fx('joined', { playerId: p.id });
    return { player: p };
  }

  removeBot(socketId, botId) {
    const host = this.bySocket(socketId);
    if (!host || !host.isHost || this.state !== 'LOBBY') return { error: 'host_only' };
    const i = this.players.findIndex(p => p.id === botId && p.isBot);
    if (i >= 0) this.players.splice(i, 1);
    return { ok: true };
  }

  removeSocket(socketId) {
    const specIdx = this.spectators.findIndex(s => s.socketId === socketId);
    if (specIdx >= 0) {
      this.spectators.splice(specIdx, 1);
      return;
    }
    const p = this.bySocket(socketId); if (!p) return;
    p.connected = false; p.socketId = null;
    if (this.state === 'LOBBY') {
      this.fx('disconnected', { playerId: p.id, name: p.name });
      this.later('dc_' + p.id, 15000, () => {
        if (!p.connected && this.state === 'LOBBY') {
          const idx = this.players.indexOf(p);
          if (idx >= 0) {
            this.players.splice(idx, 1);
            this.fx('left', { name: p.name });
            if (p.isHost) { const h = this.players.find(x => !x.isBot && x.connected); if (h) { h.isHost = true; h.ready = true; } }
            this.sync();
          }
        }
      });
    } else {
      p.auto = true;
      this.fx('disconnected', { playerId: p.id });
    const hasHuman = this.players.some(x => !x.isBot && x.connected);
    if (!hasHuman) { this.clear('bot'); this.clear('turn'); }
      if (p.isHost) { const h = this.players.find(x => !x.isBot && x.connected); if (h) { p.isHost = false; h.isHost = true; } }
      // if the disconnected player is acting, let autopilot take over
      if (this.prompt && this.prompt.playerId === p.id) this.later('prompt', 1200, () => this.finishPrompt(null));
      else if (this.phase === 'turn' && this.cur() === p) this.scheduleBot();
    }
  }

  explicitLeave(socketId) {
    const specIdx = this.spectators.findIndex(s => s.socketId === socketId);
    if (specIdx >= 0) {
      const s = this.spectators.splice(specIdx, 1)[0];
      this.fx('left', { name: s.name });
      return;
    }
    const p = this.bySocket(socketId); if (!p) return;
    this.clear('dc_' + p.id);
    const idx = this.players.indexOf(p);
    const wasHost = p.isHost;

    if (this.state === 'LOBBY') {
      if (idx >= 0) this.players.splice(idx, 1);
      this.fx('left', { name: p.name });
      if (wasHost) {
        const h = this.players.find(x => !x.isBot && x.connected);
        if (h) { h.isHost = true; h.ready = true; }
      }
      this.sync();
    } else {
      p.connected = false;
      p.socketId = null;
      if (wasHost) {
        const h = this.players.find(x => !x.isBot && x.connected);
        if (h) { p.isHost = false; h.isHost = true; }
      }
      if (p.alive) {
        this.eliminate(p, 'exploded');
        this.afterElim(p, null);
      }
      this.sync();
    }
  }

  rejoin(socketId, playerId, key) {
    const p = this.byId(playerId);
    if (!p || p.isBot || p.key !== key) return { error: 'rejoin_failed' };
    this.clear('dc_' + p.id);
    this.clear('bot');
    p.socketId = socketId; p.connected = true; p.auto = false;
    if (!this.players.some(x => x.isHost && x.connected)) { this.players.forEach(x => x.isHost = false); p.isHost = true; }
    this.fx('reconnected', { playerId: p.id });
    return { player: p };
  }

  setReady(socketId, ready) {
    const p = this.bySocket(socketId); if (!p || this.state !== 'LOBBY') return;
    p.ready = p.isHost ? true : !!ready;
    this.fx('ready', { playerId: p.id, ready: p.ready });
  }

  updateSettings(socketId, s) {
    const p = this.bySocket(socketId);
    if (!p || !p.isHost || this.state !== 'LOBBY') return { error: 'host_only' };
    const st = this.settings;
    if (s.version && VERSIONS[s.version] && s.version !== st.version) { st.version = s.version; st.counts = { ...VERSIONS[s.version].counts }; }
    if (typeof s.custom === 'boolean') st.custom = s.custom;
    if (s.counts && typeof s.counts === 'object') {
      for (const id of CONFIGURABLE) if (s.counts[id] !== undefined) {
        const v = Math.max(0, Math.min(10, parseInt(s.counts[id], 10) || 0));
        if (v) st.counts[id] = v; else delete st.counts[id];
      }
    }
    if ([15, 20, 25, 30, 45, 60].includes(+s.turnSeconds)) st.turnSeconds = +s.turnSeconds;
    if (+s.nopeSeconds >= 2 && +s.nopeSeconds <= 8) st.nopeSeconds = +s.nopeSeconds;
    if (['easy', 'normal', 'hard'].includes(s.botLevel)) st.botLevel = s.botLevel;
    if (s.imploding !== undefined) st.imploding = !!s.imploding;
    if (s.stake && ['casual', 'standard', 'high', 'vip'].includes(s.stake)) st.stake = s.stake;
    return { ok: true };
  }

  // ---------------------------------------------------------------- start
  start(socketId) {
    const host = this.bySocket(socketId);
    if (!host || !host.isHost) return { error: 'host_only' };
    if (this.state === 'PLAYING') return { error: 'in_progress' };
    if (this.players.length < 2) return { error: 'need_players' };
    if (this.players.some(p => !p.isBot && !p.ready)) return { error: 'not_ready' };

    this.resetRound();
    this.state = 'PLAYING'; this.log = []; this.discard = []; this.lastResults = null;
    const n = this.players.length;
    const ver = VERSIONS[this.settings.version];
    const counts = this.settings.custom ? this.settings.counts : ver.counts;
    const imploding = this.settings.custom ? (this.settings.imploding ?? ver.imploding) : ver.imploding;
    const scale = n > 5 ? 2 : 1;

    const dealable = []; const deferred = [];
    for (const [id, c] of Object.entries(counts)) {
      if (!CARDS[id] || isBomb(id) || id === 'defuse') continue;
      const total = ['streaking_kitten', 'barking_kitten', 'catomic_bomb', 'zombie_kitten', 'tower_of_power'].includes(id) ? c : c * scale;
      for (let i = 0; i < total; i++) (id === 'zombie_kitten' ? deferred : dealable).push(mk(id));
    }
    shuffle(dealable);
    for (const p of this.players) {
      p.hand = [mk('defuse')]; p.alive = true; p.defuses = 0; p.mem = null; p.botPlays = 0; p.elimReason = null;
      for (let i = 0; i < 7 && dealable.length; i++) p.hand.push(dealable.pop());
    }
    const deck = [...dealable, ...deferred];
    const extraDefuse = n <= 2 ? 2 : Math.max(1, 6 - n);
    for (let i = 0; i < extraDefuse; i++) deck.push(mk('defuse'));
    const hasStreaking = this.settings.custom ? ((counts['streaking_kitten'] || 0) > 0) : !!ver.extraBombs;
    let ek = Math.max(1, n - 1 + (hasStreaking ? 1 : 0) - (imploding ? 1 : 0));
    if (imploding && n === 2) ek = Math.max(ek, 1);
    for (let i = 0; i < ek; i++) deck.push(mk('exploding_kitten'));
    if (imploding) deck.push(mk('imploding_kitten', { faceUp: false }));
    this.deck = shuffle(deck); this.deckRev++;

    this.turnIdx = rand(n);
    this.fx('game_start', { version: this.settings.version, custom: this.settings.custom });
    this.fx('roulette', { order: this.players.map(p => p.id), playerId: this.cur().id });
    this.phase = 'intro';
    this.sync();
    this.later('intro', 4200, () => this.beginTurn(true));
    return { ok: true };
  }

  // ---------------------------------------------------------------- turn flow
  pauseTurnTimer() {
    if (this.turnDeadline && this.turnDeadline > Date.now()) {
      this.turnRemainingMs = Math.max(3000, this.turnDeadline - Date.now());
    }
    this.clear('turn');
    this.turnDeadline = 0;
  }

  resumeTurnTimer() {
    if (this.state !== 'PLAYING') return;
    if (this.alive().length <= 1) return this.endGame(this.alive()[0]);
    let p = this.cur();
    if (!p || !p.alive) {
      return this.passTurnTo(this.nextAliveIdx(this.turnIdx), 1);
    }
    this.phase = 'turn';
    const defaultSecs = Math.max(15, this.settings.turnSeconds || 25);
    const remaining = Math.max(5000, this.turnRemainingMs || (defaultSecs * 1000));
    this.turnRemainingMs = remaining;
    this.turnDeadline = Date.now() + remaining;
    this.clear('turn');
    this.later('turn', remaining, () => {
      if (this.phase === 'turn' && this.cur() === p) {
        this.fx('timeout', { playerId: p.id });
        this.drawCard(p, false);
      }
    });
    this.sync();
    this.scheduleBot();
  }

  beginTurn(announce) {
    if (this.state !== 'PLAYING') return;
    if (this.alive().length <= 1) return this.endGame(this.alive()[0]);
    let p = this.cur();
    if (!p || !p.alive) {
      this.turnIdx = this.nextAliveIdx(this.turnIdx);
      p = this.cur();
      if (!p || !p.alive) return;
    }
    this.phase = 'turn';
    const secs = Math.max(15, this.settings.turnSeconds || 25);
    const durationMs = secs * 1000;
    if (announce) {
      p.botPlays = 0;
      this.fx('turn', { playerId: p.id, turnsLeft: this.turnsLeft });
    }
    this.turnRemainingMs = durationMs;
    this.turnDeadline = Date.now() + durationMs;
    this.clear('turn');
    this.later('turn', durationMs, () => {
      if (this.phase === 'turn' && this.cur() === p) {
        this.fx('timeout', { playerId: p.id });
        this.drawCard(p, false);
      }
    });
    this.sync();
    this.scheduleBot();
  }

  backToTurn() {
    if (this.state === 'PLAYING') this.resumeTurnTimer();
  }

  endTurnOnce() {
    if (this.state !== 'PLAYING') return;
    this.turnsLeft--;
    if (this.turnsLeft > 0 && this.cur().alive) this.beginTurn(true);
    else this.passTurnTo(this.nextAliveIdx(this.turnIdx), 1);
  }

  passTurnTo(idx, turns) { this.turnIdx = idx; this.turnsLeft = turns; this.beginTurn(true); }

  // ---------------------------------------------------------------- draw
  drawAction(socketId) {
    const p = this.bySocket(socketId);
    if (!p || this.state !== 'PLAYING' || this.phase !== 'turn' || this.cur() !== p) return { error: 'not_your_turn' };
    this.drawCard(p, false);
    return { ok: true };
  }

  drawCard(p, fromBottom, index) {
    this.phase = 'drawing';
    this.pauseTurnTimer();
    if (!this.deck.length) {
      const bombsInPlay = this.discard.some(c => isBomb(c.id)) || this.deck.some(c => isBomb(c.id));
      const safe = this.discard.filter(c => !isBomb(c.id) && c.id !== 'defuse');
      if (safe.length && bombsInPlay) {
        this.deck = shuffle(safe);
        this.discard = this.discard.filter(c => isBomb(c.id) || c.id === 'defuse');
        this.deckChanged('mut');
        this.fx('shuffled', { playerId: p.id });
      } else {
        const alive = this.alive().sort((a, b) => b.hand.length - a.hand.length);
        return this.endGame(alive[0]);
      }
    }
    let card;
    if (fromBottom) { card = this.deck.pop(); this.deckChanged('mut'); }
    else if (typeof index === 'number' && index >= 0) { card = this.deck.splice(index, 1)[0]; this.deckChanged('mut'); }
    else { card = this.deck.shift(); this.deckChanged('top'); }
    this.fx('draw', { playerId: p.id, bottom: !!fromBottom });
    this.resolveDrawn(p, card);
  }

  resolveDrawn(p, card) {
    if (card.id === 'exploding_kitten') {
      if (count(p.hand, 'streaking_kitten') > count(p.hand, 'exploding_kitten')) {
        p.hand.push(card);
        this.priv(p, 'drawn', { cardId: card.id });
        this.priv(p, 'streak_hold', {});
        this.sync();
        this.later('streak_delay', 900, () => this.endTurnOnce());
        return;
      }
      this.fx('bomb_drawn', { playerId: p.id, cardId: card.id });
      return this.later('bomb_reveal', 1400, () => {
        this.explodeOrDefuse(p, card, () => this.endTurnOnce());
      });
    }
    if (card.id === 'imploding_kitten') {
      this.fx('bomb_drawn', { playerId: p.id, cardId: card.id, faceUp: !!card.faceUp });
      if (card.faceUp) { this.discard.push(card); this.eliminate(p, 'imploded'); return this.afterElim(p, null); }
      return this.setPrompt(p, 'insert_bomb', { deckSize: this.deck.length, faceUp: true },
        (pl) => { card.faceUp = true; const pos = this.clampPos(pl && pl.pos); this.deck.splice(pos, 0, card); this.deckChanged('mut');
          this.fx('imploding_back', { playerId: p.id, pos }); this.endTurnOnce(); },
        () => ({ pos: rand(this.deck.length + 1) }));
    }
    if (card.id === 'zombie_kitten') {
      this.discard.push(card);
      const dead = this.players.filter(x => !x.alive).map(x => x.id);
      this.fx('zombie_drawn', { playerId: p.id, any: dead.length > 0 });
      if (!dead.length) return this.endTurnOnce();
      return this.setPrompt(p, 'revive', { dead },
        (pl) => {
          const t = this.byId(pl && dead.includes(pl.targetId) ? pl.targetId : pick(dead));
          t.alive = true; t.hand = [mk('defuse')]; this.elimOrder = this.elimOrder.filter(id => id !== t.id);
          const bi = this.discard.findIndex(c => isBomb(c.id));
          if (bi >= 0) {
            const b = this.discard.splice(bi, 1)[0];
            if (b.id === 'imploding_kitten') b.faceUp = false;
            this.deck.splice(rand(this.deck.length + 1), 0, b);
            this.deckChanged('mut');
          }
          this.fx('revived', { playerId: p.id, targetId: t.id }); this.endTurnOnce();
        },
        () => ({ targetId: pick(dead) }));
    }
    p.hand.push(card);
    this.priv(p, 'drawn', { cardId: card.id });
    this.sync();
    this.later('draw_delay', 900, () => this.endTurnOnce());
  }

  clampPos(pos) { pos = parseInt(pos, 10); if (isNaN(pos)) pos = rand(this.deck.length + 1); return Math.max(0, Math.min(this.deck.length, pos)); }

  // bombCard may be null (Barking Kitten explosion)
  explodeOrDefuse(p, bombCard, after) {
    const di = p.hand.findIndex(c => c.id === 'defuse');
    if (di >= 0) {
      this.discard.push(p.hand.splice(di, 1)[0]); p.defuses++;
      this.fx('defused', { playerId: p.id });
      if (!bombCard) return after();
      return this.setPrompt(p, 'insert_bomb', { deckSize: this.deck.length, faceUp: false },
        (pl) => { const pos = this.clampPos(pl && pl.pos); this.deck.splice(pos, 0, bombCard); this.deckChanged('mut');
          this.fx('bomb_back', { playerId: p.id }); after(); },
        () => ({ pos: this.botInsertPos(p) }));
    }
    if (bombCard) this.discard.push(bombCard);
    this.eliminate(p, 'exploded');
    this.afterElim(p, after);
  }

  afterElim(p, after) {
    if (this.state !== 'PLAYING') return;
    if (this.cur() === p) this.passTurnTo(this.nextAliveIdx(this.turnIdx), 1);
    else if (after) after();
  }

  eliminate(p, reason) {
    p.alive = false; p.elimReason = reason;
    const heldBombs = p.hand.filter(c => c.id === 'exploding_kitten');
    const regularCards = p.hand.filter(c => c.id !== 'exploding_kitten');
    this.discard.push(...regularCards); p.hand = [];
    this.elimOrder.push(p.id);
    this.fx('eliminated', { playerId: p.id, reason });
    if (heldBombs.length) {
      this.deck.push(...heldBombs);
      shuffle(this.deck);
      this.deckChanged('mut');
    }
    const alive = this.alive();
    if (alive.length <= 1) this.endGame(alive[0]);
  }

  checkStreak(p, after) {
    if (p.alive && count(p.hand, 'exploding_kitten') > count(p.hand, 'streaking_kitten')) {
      const i = p.hand.findIndex(c => c.id === 'exploding_kitten');
      const bomb = p.hand.splice(i, 1)[0];
      this.fx('streak_exposed', { playerId: p.id });
      return this.explodeOrDefuse(p, bomb, after);
    }
    after();
  }

  // ---------------------------------------------------------------- play
  play(socketId, uids, targetId, namedId) {
    const p = this.bySocket(socketId);
    if (!p || this.state !== 'PLAYING' || !p.alive) return { error: 'cannot_play' };
    return this.playAs(p, uids, targetId, namedId);
  }

  playAs(p, uids, targetId, namedId) {
    if (!Array.isArray(uids) || !uids.length || new Set(uids).size !== uids.length) return { error: 'bad_cards' };
    const cards = uids.map(u => p.hand.find(c => c.uid === u));
    if (cards.some(c => !c)) return { error: 'bad_cards' };

    if (cards.length === 1 && cards[0].id === 'nope') return this.playNope(p, cards[0]);
    if (this.cur() !== p || this.phase !== 'turn') return { error: 'not_your_turn' };

    let effect;
    const kinds = cards.map(c => CARDS[c.id].kind);
    if (cards.length >= 2) {
      if (cards.length === 5) {
        const distinct = new Set(cards.map(c => c.id));
        if (distinct.size !== 5 || cards.some(c => isBomb(c.id) || c.id === 'streaking_kitten')) return { error: 'bad_combo' };
        effect = '5_cards';
      } else {
        if (cards.length > 3 || kinds.some(k => k !== 'cat')) return { error: 'bad_combo' };
        const ids = new Set(cards.filter(c => !CARDS[c.id].wild).map(c => c.id));
        if (ids.size > 1) return { error: 'bad_combo' };
        effect = cards.length === 2 ? 'pair' : 'triple';
        if (effect === 'triple' && (!Object.prototype.hasOwnProperty.call(CARDS, namedId) || namedId === 'imploding_kitten')) return { error: 'need_name' };
      }
    } else {
      const c = cards[0];
      if (CARDS[c.id].kind !== 'action') return { error: 'not_playable' };
      effect = c.id;
      if (effect === 'clone') { if (!this.lastActionId) return { error: 'nothing_to_clone' }; effect = this.lastActionId; }
    }
    const needsTarget = effect === 'pair' || effect === 'triple' || CARDS[effect]?.target;
    const t = this.byId(targetId);
    if (needsTarget) {
      if (!t || t === p || !t.alive) return { error: 'need_target' };
      if (effect !== 'targeted_attack' && (!t.hand || !t.hand.length)) return { error: 'target_empty' };
    }

    for (const c of cards) p.hand.splice(p.hand.indexOf(c), 1);
    this.discard.push(...cards);
    if (effect !== 'pair' && effect !== 'triple') this.lastActionId = effect;
    this.pending = { playerId: p.id, effect, cardIds: cards.map(c => c.id), targetId: needsTarget ? t.id : null, namedId: effect === 'triple' ? namedId : null, nopes: 0 };
    this.fx('play', { playerId: p.id, targetId: this.pending.targetId, cardIds: this.pending.cardIds, effect, namedId: this.pending.namedId });
    this.openNopeWindow(2200);
    return { ok: true };
  }

  openNopeWindow(delay = 0) {
    this.pauseTurnTimer();
    this.phase = 'nope';
    const anyNope = this.alive().some(x => x.hand.some(c => c.id === 'nope'));
    const duration = anyNope ? Math.max(5500, this.settings.nopeSeconds * 1000) : 2200;
    this.clear('nope');
    this.clear('botnope');
    this.clear('botnope_start');
    if (delay > 0) {
      this.pending.showUntil = Date.now() + delay;
      this.pending.deadline = Date.now() + delay + duration;
      this.later('nope', delay + duration, () => this.resolvePending());
      this.sync();
      if (anyNope) {
        this.later('botnope_start', delay, () => this.botConsiderNope());
      }
    } else {
      this.pending.showUntil = 0;
      this.pending.deadline = Date.now() + duration;
      this.later('nope', duration, () => this.resolvePending());
      this.sync();
      if (anyNope) this.botConsiderNope();
    }
  }

  playNope(p, card) {
    if (this.phase !== 'nope' || !this.pending) return { error: 'nothing_to_nope' };
    if (this.pending.playerId === p.id && this.pending.nopes % 2 === 0) {
      return { error: 'cannot_nope_self' };
    }
    p.hand.splice(p.hand.indexOf(card), 1); this.discard.push(card);
    this.pending.nopes++;
    this.fx('nope', { playerId: p.id, nopes: this.pending.nopes, targetId: this.pending.playerId });
    this.openNopeWindow(0);
    return { ok: true };
  }

  resolvePending() {
    this.clear('nope'); this.clear('botnope'); this.clear('botnope_start');
    const pa = this.pending; this.pending = null;
    if (!pa) return;
    if (pa.nopes % 2 === 1) {
      this.fx('cancelled', { playerId: pa.playerId, effect: pa.effect });
      return this.later('cancel_delay', 800, () => this.backToTurn());
    }
    this.later('effect_delay', 500, () => this.applyEffect(pa));
  }

  applyEffect(pa) {
    const p = this.byId(pa.playerId); const t = this.byId(pa.targetId);
    if (pa.targetId && (!t || !t.alive)) return this.backToTurn();
    if (['favor', 'pair', 'triple'].includes(pa.effect) && (!t || !t.hand || !t.hand.length)) {
      this.fx('cancelled', { playerId: p.id, effect: pa.effect, reason: 'target_empty' });
      return this.backToTurn();
    }
    switch (pa.effect) {
      case 'attack': case 'targeted_attack': {
        const owed = Math.min(8, this.turnsLeft > 1 ? this.turnsLeft + 2 : 2);
        const idx = pa.effect === 'attack' ? this.nextAliveIdx(this.turnIdx) : this.players.indexOf(t);
        const targetPlayer = this.players[idx];
        this.fx('attack_pass', { playerId: p.id, targetId: targetPlayer.id, turns: owed, effect: pa.effect });
        return this.later('attack_pass_delay', 2200, () => this.passTurnTo(idx, owed));
      }
      case 'personal_attack': {
        const turns = Math.min(8, this.turnsLeft > 1 ? this.turnsLeft + 2 : 3);
        this.turnsLeft = turns;
        this.fx('personal', { playerId: p.id, turns });
        return this.later('personal_delay', 2200, () => this.beginTurn(true));
      }
      case 'skip': return this.endTurnOnce();
      case 'super_skip': this.turnsLeft = 1; return this.endTurnOnce();
      case 'reverse': this.direction *= -1; this.fx('reverse', { playerId: p.id, direction: this.direction }); return this.endTurnOnce();
      case 'draw_bottom': return this.drawCard(p, true);
      case 'shuffle': shuffle(this.deck); this.deckChanged('mut'); this.fx('shuffled', { playerId: p.id }); return this.backToTurn();
      case 'swap_top_bottom':
        if (this.deck.length > 1) { const l = this.deck.length - 1; [this.deck[0], this.deck[l]] = [this.deck[l], this.deck[0]]; this.deckChanged('mut'); }
        this.fx('swapped', { playerId: p.id }); return this.backToTurn();
      case 'catomic_bomb': {
        const bombs = this.deck.filter(c => c.id === 'exploding_kitten');
        const others = this.deck.filter(c => c.id !== 'exploding_kitten');
        this.deck = [...bombs, ...shuffle(others)]; this.deckChanged('mut');
        this.fx('catomic', { playerId: p.id, count: bombs.length }); return this.endTurnOnce();
      }
      case 'see_the_future': case 'see_future_5': {
        const count = pa.effect === 'see_future_5' ? 5 : 3;
        const ids = this.deck.slice(0, count).map(c => c.id);
        const timeoutMs = count === 5 ? 14000 : 9000;
        this.remember(p, ids);
        this.fx('peek', { playerId: p.id, n: ids.length });
        return this.setPrompt(p, 'see_future', { cardIds: ids, count: ids.length },
          () => this.backToTurn(),
          () => ({}),
          timeoutMs
        );
      }
      case 'alter_the_future': case 'alter_future_5': case 'share_the_future': {
        const n = pa.effect === 'alter_future_5' ? 5 : 3;
        const top = this.deck.slice(0, n); const share = pa.effect === 'share_the_future';
        if (!top.length) return this.backToTurn();
        const alterTimeout = n === 5 ? 30000 : 22000;
        return this.setPrompt(p, 'alter', { cardIds: top.map(c => c.id), share },
          (pl) => {
            let order = Array.isArray(pl && pl.order) ? pl.order.map(Number) : null;
            if (!order || order.length !== top.length || new Set(order).size !== top.length || order.some(i => !(i >= 0 && i < top.length))) order = top.map((_, i) => i);
            const re = order.map(i => top[i]); this.deck.splice(0, top.length, ...re); this.deckChanged('mut');
            const ids = re.map(c => c.id); this.remember(p, ids);
            this.fx('altered', { playerId: p.id, share });
            if (share) { const nx = this.players[this.nextAliveIdx(this.turnIdx)]; this.priv(nx, 'future', { cardIds: ids, fromId: p.id }); this.remember(nx, ids); }
            this.backToTurn();
          },
          () => { const idx = top.map((_, i) => i); return { order: [...idx.filter(i => !isBomb(top[i].id)), ...idx.filter(i => isBomb(top[i].id))] }; },
          alterTimeout
        );
      }
      case 'dig_deeper': {
        if (this.deck.length < 2) return this.drawCard(p, false);
        return this.setPrompt(p, 'dig', { cardId: this.deck[0].id },
          (pl) => this.drawCard(p, false, pl && pl.keep === false ? 1 : 0),
          () => ({ keep: !isBomb(this.deck[0].id) }),
          22000);
      }
      case 'bury': {
        if (!this.deck.length) return this.endTurnOnce();
        const card = this.deck.shift(); this.deckChanged('mut');
        return this.setPrompt(p, 'bury', { deckSize: this.deck.length },
          (pl) => { this.deck.splice(this.clampPos(pl && pl.pos), 0, card); this.fx('buried', { playerId: p.id }); this.endTurnOnce(); },
          () => ({ pos: rand(this.deck.length + 1) }),
          22000);
      }
      case 'clairvoyance': {
        const pos = this.deck.findIndex(c => isBomb(c.id));
        this.priv(p, 'clairvoyance', { pos, deckSize: this.deck.length }); this.fx('clairvoyance', { playerId: p.id }); return this.backToTurn();
      }
      case '5_cards': {
        const pickable = this.discard.filter(c => !isBomb(c.id));
        if (!pickable.length) return this.checkStreak(p, () => this.backToTurn());
        return this.setPrompt(p, 'discard_pick', { cards: pickable.map(c => ({ uid: c.uid, id: c.id })) },
          (pl) => {
            const idx = this.discard.findIndex(c => c.uid === (pl && pl.uid) && !isBomb(c.id));
            if (idx >= 0) {
              const card = this.discard.splice(idx, 1)[0];
              p.hand.push(card);
              this.fx('discard_picked', { playerId: p.id, cardId: card.id });
              this.priv(p, 'received', { cardId: card.id, fromId: null });
            }
            this.checkStreak(p, () => this.backToTurn());
          },
          () => ({ uid: pickable[pickable.length - 1]?.uid }),
          30000
        );
      }
      case 'barking_kitten': {
        const other = this.players.find(x => x !== p && x.alive && x.hand.some(c => c.id === 'barking_kitten'));
        if (!other) {
          const i = this.discard.map(c => c.id).lastIndexOf('barking_kitten');
          if (i >= 0) { this.deck.splice(rand(this.deck.length + 1), 0, this.discard.splice(i, 1)[0]); this.deckChanged('mut'); }
          this.fx('barking', { playerId: p.id, result: 'none' }); return this.backToTurn();
        }
        this.discard.push(other.hand.splice(other.hand.findIndex(c => c.id === 'barking_kitten'), 1)[0]);
        const ti = other.hand.findIndex(c => c.id === 'tower_of_power');
        if (ti >= 0) { this.discard.push(other.hand.splice(ti, 1)[0]); this.fx('barking', { playerId: p.id, targetId: other.id, result: 'blocked' }); return this.backToTurn(); }
        this.fx('barking', { playerId: p.id, targetId: other.id, result: 'boom' });
        return this.explodeOrDefuse(other, null, () => this.backToTurn());
      }
      case 'favor':
        if (!t.hand.length) return this.backToTurn();
        return this.setPrompt(t, 'favor_give', { toId: p.id },
          (pl) => {
            if (!t.hand.length) return this.backToTurn();
            // Official rule: cannot give Exploding Kitten via Favor
            let i = -1;
            if (pl && pl.uid) {
              i = t.hand.findIndex(c => c.uid === pl.uid && c.id !== 'exploding_kitten');
            }
            if (i < 0) {
              const bestToGive = this.botFavorCard(t);
              i = t.hand.indexOf(bestToGive);
            }
            if (i < 0) i = 0;
            const card = this.transfer(t, p, i);
            if (!card) return this.backToTurn();
            this.fx('favor_done', { playerId: t.id, targetId: p.id });
            this.priv(t, 'lost', { cardId: card.id, toId: p.id }); this.priv(p, 'received', { cardId: card.id, fromId: t.id });
            this.checkStreak(t, () => this.checkStreak(p, () => this.backToTurn()));
          },
          () => ({ uid: this.botFavorCard(t)?.uid }),
          24000
        );
      case 'pair':
        if (!t.hand.length) return this.backToTurn();
        shuffle(t.hand);
        return this.setPrompt(p, 'steal_pick', { targetId: t.id, count: t.hand.length },
          (pl) => {
            if (!t.hand.length) return this.backToTurn();
            let i = parseInt(pl && pl.index, 10); if (!(i >= 0 && i < t.hand.length)) i = rand(t.hand.length);
            const card = this.transfer(t, p, i);
            if (!card) return this.backToTurn();
            this.fx('stolen', { playerId: p.id, targetId: t.id });
            this.priv(t, 'lost', { cardId: card.id, toId: p.id }); this.priv(p, 'received', { cardId: card.id, fromId: t.id });
            this.checkStreak(t, () => this.checkStreak(p, () => this.backToTurn()));
          },
          () => ({ index: rand(Math.max(1, t.hand.length)) }),
          22000
        );
      case 'triple': {
        if (!t.hand.length) return this.backToTurn();
        const i = t.hand.findIndex(c => c.id === pa.namedId);
        if (i < 0) { this.fx('triple', { playerId: p.id, targetId: t.id, namedId: pa.namedId, hit: false }); return this.backToTurn(); }
        const card = this.transfer(t, p, i);
        if (!card) return this.backToTurn();
        this.fx('triple', { playerId: p.id, targetId: t.id, namedId: pa.namedId, hit: true });
        this.priv(t, 'lost', { cardId: card.id, toId: p.id }); this.priv(p, 'received', { cardId: card.id, fromId: t.id });
        return this.checkStreak(t, () => this.checkStreak(p, () => this.backToTurn()));
      }
      default: return this.backToTurn();
    }
  }

  transfer(from, to, i) {
    if (!from || !from.hand || !from.hand.length || i < 0 || i >= from.hand.length) return null;
    const card = from.hand.splice(i, 1)[0];
    if (card && to && to.hand) to.hand.push(card);
    return card;
  }

  // ---------------------------------------------------------------- prompts
  setPrompt(p, type, data, onResolve, autoFn, timeoutMs = 22000) {
    this.pauseTurnTimer();
    this.phase = 'prompt';
    this.prompt = { playerId: p.id, type, data, onResolve, autoFn, deadline: Date.now() + timeoutMs };
    const ms = this.isAuto(p) ? 2200 + rand(1200) : timeoutMs;
    this.later('prompt', ms, () => this.finishPrompt(null));
    this.sync();
  }

  respond(socketId, payload) {
    const p = this.bySocket(socketId);
    if (!p || !this.prompt || this.prompt.playerId !== p.id) return { error: 'no_prompt' };
    this.finishPrompt(payload || {});
    return { ok: true };
  }

  finishPrompt(payload) {
    const pr = this.prompt; if (!pr) return;
    this.clear('prompt'); this.prompt = null;
    const isAuto = !payload || !Object.keys(payload).length;
    const resolvedPayload = isAuto ? pr.autoFn() : payload;
    if (isAuto) this.fx('prompt_auto', { playerId: pr.playerId, promptType: pr.type });
    pr.onResolve(resolvedPayload);
  }

  // ---------------------------------------------------------------- bots
  scheduleBot() {
    this.clear('bot');
    const p = this.cur();
    if (this.state === 'PLAYING' && this.phase === 'turn' && p && p.alive && this.isAuto(p)) {
      // Natural deliberate delay so humans can watch the game unfold
      this.later('bot', 2200 + rand(1200), () => this.botTurn(p));
    }
  }

  knownTop(p) {
    if (this.deck[0]?.faceUp) return this.deck[0].id;
    if (p.mem && p.mem.rev === this.deckRev && p.mem.ids.length) return p.mem.ids[0];
    return null;
  }

  botTurn(p) {
    if (this.state !== 'PLAYING' || this.phase !== 'turn' || this.cur() !== p || !this.isAuto(p)) return;
    const lvl = this.settings.botLevel;
    const has = (id) => p.hand.find(c => c.id === id);
    const tryPlay = (id, target, named) => {
      const c = has(id);
      if (!c) return false;
      return !this.playAs(p, [c.uid], target, named).error;
    };
    const opponents = this.alive().filter(x => x !== p);
    if (!opponents.length) return this.drawCard(p, false);

    // Target analysis: find opponent with most cards (richest) and opponent with defuses
    const richest = opponents.filter(x => x.hand && x.hand.length).sort((a, b) => b.hand.length - a.hand.length)[0] || opponents[0];
    const top = this.knownTop(p);
    const bombs = this.deck.filter(c => isBomb(c.id)).length;
    const risk = bombs / Math.max(1, this.deck.length);
    const hasDefuse = !!has('defuse');
    const canAct = p.botPlays < (lvl === 'hard' ? 4 : 3);
    const go = (fn) => { p.botPlays++; return fn(); };

    // --- 1. COMBO OFFENSE: 3-of-a-kind (Triple) to steal Defuse ---
    if (canAct && lvl !== 'easy' && richest && richest.hand.length) {
      const cats = p.hand.filter(c => CARDS[c.id].kind === 'cat');
      const groups = {};
      for (const c of cats) if (!CARDS[c.id].wild) (groups[c.id] = groups[c.id] || []).push(c);
      const wild = cats.filter(c => CARDS[c.id].wild);

      // Check for 3 matching cards
      let tripleCards = null;
      for (const [cid, arr] of Object.entries(groups)) {
        if (arr.length + wild.length >= 3) {
          tripleCards = [...arr, ...wild].slice(0, 3);
          break;
        }
      }
      if (tripleCards) {
        p.botPlays++;
        // Smart bot names 'defuse' against players holding cards!
        const namedTarget = !hasDefuse ? 'defuse' : (risk > 0.25 ? 'defuse' : 'attack');
        if (!this.playAs(p, tripleCards.map(c => c.uid), richest.id, namedTarget).error) return;
        p.botPlays--;
      }

      // Check for 2 matching cards (Pair to steal random card)
      let pairCards = null;
      for (const [cid, arr] of Object.entries(groups)) {
        if (arr.length + wild.length >= 2) {
          pairCards = [...arr, ...wild].slice(0, 2);
          break;
        }
      }
      if (pairCards && Math.random() < (lvl === 'hard' ? 0.8 : 0.5)) {
        p.botPlays++;
        if (!this.playAs(p, pairCards.map(c => c.uid), richest.id).error) return;
        p.botPlays--;
      }
    }

    // --- 2. DEFENSE / ESCAPE: If top card is known to be a BOMB ---
    if (top && isBomb(top)) {
      // Emergency: The top card IS an exploding kitten!
      const escapes = ['targeted_attack', 'attack', 'super_skip', 'skip', 'reverse', 'draw_bottom', 'alter_the_future', 'alter_future_5', 'bury', 'shuffle'];
      for (const id of escapes) {
        if (!has(id)) continue;
        const targetId = id === 'targeted_attack' ? richest.id : undefined;
        if (go(() => tryPlay(id, targetId))) return;
        p.botPlays--;
      }
      // If clone is available and last action was an escape:
      if (has('clone') && this.lastActionId && SAFE_ESCAPES.includes(this.lastActionId)) {
        if (go(() => tryPlay('clone', richest.id))) return;
        p.botPlays--;
      }
      // If bot has Defuse and nothing else, it will have to draw and defuse.
    }

    // --- 3. DANGER EVALUATION: When top card is unknown ---
    if (canAct && !top) {
      // If deck risk is significant (> 18%), gather info!
      if (risk > 0.18 && Math.random() < (lvl === 'hard' ? 0.9 : 0.65)) {
        for (const id of ['clairvoyance', 'see_future_5', 'see_the_future', 'alter_future_5', 'alter_the_future']) {
          if (has(id) && go(() => tryPlay(id))) return;
        }
      }
      // If risk is high (> 28%) and bot has NO defuse, don't risk dying!
      if (risk > 0.28 && !hasDefuse) {
        for (const id of ['attack', 'targeted_attack', 'skip', 'reverse', 'shuffle']) {
          if (has(id) && go(() => tryPlay(id, id === 'targeted_attack' ? richest.id : undefined))) return;
        }
      }
    }

    // --- 4. OPPORTUNISTIC PLAY: Favor / Barking Kitten / Attack ---
    if (canAct && richest && Math.random() < (lvl === 'easy' ? 0.25 : 0.45)) {
      if (has('favor') && go(() => tryPlay('favor', richest.id))) return;
      p.botPlays--;
      if (has('barking_kitten') && (has('tower_of_power') || Math.random() < 0.4) && go(() => tryPlay('barking_kitten'))) return;
      p.botPlays--;
    }

    // --- 5. SAFE DRAW: If top card is known to be SAFE or no other moves ---
    // If top card is NOT a bomb, bot intelligently saves its cards and draws!
    this.drawCard(p, false);
  }

  botFavorCard(p) {
    if (!p || !p.hand || !p.hand.length) return null;
    const nonBombs = p.hand.filter(c => c.id !== 'exploding_kitten');
    if (!nonBombs.length) return p.hand[0];
    // Rule: Strictly protect Defuse & Streaking Kitten!
    const withoutDefuse = nonBombs.filter(c => c.id !== 'defuse' && c.id !== 'streaking_kitten');
    const pool = withoutDefuse.length ? withoutDefuse : nonBombs;

    const catCounts = {};
    for (const c of p.hand) {
      if (CARDS[c.id]?.kind === 'cat') catCounts[c.id] = (catCounts[c.id] || 0) + 1;
    }

    let worst = pool[0];
    let minScore = Infinity;
    for (const c of pool) {
      let score = valueOf(c);
      if (CARDS[c.id]?.kind === 'cat') {
        score = catCounts[c.id] >= 2 ? 35 : 2; // single un-paired cats are given first
      }
      if (c.id === 'defuse') score = 999999;
      if (c.id === 'streaking_kitten') score = 888888;
      if (score < minScore) {
        minScore = score;
        worst = c;
      }
    }
    return worst;
  }

  botInsertPos(p) {
    const n = this.deck.length;
    if (this.settings.botLevel === 'easy') return Math.random() < 0.5 ? 0 : rand(n + 1);
    // Normal / Hard bot: Smart placement!
    // Next player will draw from top, so placing at index 0 or 1 attacks the next player
    const roll = Math.random();
    if (roll < 0.55) return 0; // Top card: hits next player immediately!
    if (roll < 0.85) return Math.min(n, 1); // Second card: hits player after 1 draw
    return rand(n + 1); // Random depth
  }

  botConsiderNope() {
    const pa = this.pending; if (!pa) return;
    const snapshot = pa.nopes;
    const actor = this.byId(pa.playerId);
    const victimId = pa.targetId || (pa.effect === 'attack' ? this.players[this.nextAliveIdx(this.turnIdx)].id : null);
    const lvl = this.settings.botLevel;
    const candidates = this.alive().filter(b => this.isAuto(b) && b.hand.some(c => c.id === 'nope')).filter(b => {
      if (pa.nopes % 2 === 0) {
        // If an attack, favor, or steal is targeted at this bot, high urge to Nope!
        if (b.id === victimId) return true;
        if (['catomic_bomb', 'super_skip'].includes(pa.effect) && Math.random() < 0.4) return true;
        return Math.random() < 0.08;
      }
      return b === actor;
    });
    if (!candidates.length) return;
    const b = pick(candidates);
    const isVictim = b.id === victimId;
    const prob = isVictim ? (lvl === 'easy' ? 0.65 : lvl === 'normal' ? 0.85 : 0.95) : { easy: 0.2, normal: 0.5, hard: 0.8 }[lvl];
    if (Math.random() > prob) return;
    this.later('botnope', 1800 + rand(Math.max(400, this.settings.nopeSeconds * 1000 - 2400)), () => {
      if (this.pending === pa && pa.nopes === snapshot && b.alive) {
        const c = b.hand.find(x => x.id === 'nope'); if (c) this.playNope(b, c);
      }
    });
  }

  // ---------------------------------------------------------------- end
  endGame(winner) {
    this.clearAll();
    this.state = 'ENDED'; this.phase = 'idle'; this.pending = null; this.prompt = null;
    this.winnerId = winner ? winner.id : null;
    const order = [winner, ...[...this.elimOrder].reverse().map(id => this.byId(id))].filter(Boolean);
    const results = order.map((p, i) => ({ player: p, place: i + 1 }));
    const rewards = this.onEnd ? this.onEnd(this, results) : {};
    this.lastResults = results.map(r => ({ id: r.player.id, name: r.player.name, avatar: r.player.avatar, frame: r.player.frame, title: r.player.title || 'title_rookie', place: r.place, isBot: r.player.isBot, reward: rewards[r.player.id] || null }));
    if (winner) this.fx('win', { playerId: winner.id });
    this.sync();
    this.io.to(this.code).emit('gameOver', { results: this.lastResults });
  }

  backToLobby(socketId) {
    const p = this.bySocket(socketId);
    if (!p || !p.isHost || this.state !== 'ENDED') return { error: 'host_only' };
    this.players = this.players.filter(x => x.isBot || x.connected);
    // Promote connected spectators into players if lobby has open slots
    for (const s of this.spectators) {
      if (s.connected && this.players.length < this.settings.maxPlayers) {
        s.isSpectator = false;
        s.alive = true;
        s.ready = true;
        this.players.push(s);
      }
    }
    this.spectators = [];
    for (const x of this.players) { x.hand = []; x.alive = true; x.ready = x.isBot || x.isHost; x.auto = false; }
    this.state = 'LOBBY'; this.phase = 'idle'; this.deck = []; this.discard = []; this.resetRound();
    this.fx('lobby', {});
    return { ok: true };
  }

  chat(socketId, text) {
    const p = this.bySocket(socketId); text = String(text || '').trim().slice(0, 120);
    if (p && text) this.io.to(this.code).emit('chat', { playerId: p.id, name: p.name, avatar: p.avatar, text, t: Date.now() });
  }

  sticker(socketId, id, freeIds) {
    const p = this.bySocket(socketId); if (!p) return;
    if (!freeIds.includes(id) && !(p.inventory || []).includes(id)) return;
    this.io.to(this.code).emit('sticker', { playerId: p.id, id });
  }

  // ---------------------------------------------------------------- state
  getState(me) {
    const pa = this.pending, pr = this.prompt;
    return {
      code: this.code, state: this.state, phase: this.phase, settings: this.settings,
      players: this.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, frame: p.frame, skin: p.skin, title: p.title || 'title_rookie', rp: p.rp,
        isBot: p.isBot, isHost: p.isHost, ready: p.ready, alive: p.alive, connected: p.connected, auto: p.auto,
        handCount: p.hand.length, registered: !!p.userId, elimReason: p.elimReason })),
      turnId: this.state === 'PLAYING' ? this.cur()?.id : null, turnsLeft: this.turnsLeft, direction: this.direction,
      turnDeadline: this.turnDeadline, deckCount: this.deck.length,
      bombsLeft: this.deck.filter(c => isBomb(c.id)).length,
      faceUp: this.deck.map((c, i) => c.faceUp ? i : -1).filter(i => i >= 0),
      discardTop: this.discard.length ? this.discard[this.discard.length - 1].id : null, discardCount: this.discard.length,
      lastActionId: this.lastActionId,
      pending: pa ? { playerId: pa.playerId, effect: pa.effect, cardIds: pa.cardIds, targetId: pa.targetId, namedId: pa.namedId, nopes: pa.nopes, deadline: pa.deadline } : null,
      prompt: pr ? { playerId: pr.playerId, type: pr.type, deadline: pr.deadline, data: pr.playerId === me?.id ? pr.data : null } : null,
      winnerId: this.winnerId, results: this.lastResults, log: this.log.slice(-30),
      me: me ? {
        id: me.id,
        key: me.key,
        name: me.name,
        avatar: me.avatar,
        frame: me.frame,
        skin: me.skin,
        title: me.title || 'title_rookie',
        alive: !!me.alive,
        elimReason: me.elimReason,
        hand: me.hand || [],
        isHost: !!me.isHost,
        isSpectator: !!me.isSpectator
      } : null,
      spectatorCount: this.spectators.length,
      serverNow: Date.now()
    };
  }

  sync() {
    for (const p of this.players) if (!p.isBot && p.socketId) this.io.to(p.socketId).emit('state', this.getState(p));
    for (const s of this.spectators) if (s.socketId) this.io.to(s.socketId).emit('state', this.getState(s));
  }
}

module.exports = Game;
