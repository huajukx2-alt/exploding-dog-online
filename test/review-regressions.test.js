const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const Game = require('../game');
const root = path.resolve(__dirname, '..');
const localRequire = createRequire(path.join(root, 'db.js'));
const quiet = { log() {}, warn() {}, error() {} };
const clone = value => JSON.parse(JSON.stringify(value));

// Run the real database code with no disk writes, cloud access, or live timers.
function database() {
  const context = {
    __dirname: root, module: { exports: {} }, console: quiet,
    process: { env: { APP_SECRET: 'test-only-secret' } },
    setTimeout: () => 1, clearTimeout() {}, Buffer,
    require: id => id === 'fs' ? { existsSync: () => false }
      : id === './firebase-db' ? { isEnabled: false } : localRequire(id)
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'db.js'), 'utf8'), context);
  return context.module.exports;
}

function register(db, name = 'alice') {
  return db.register(name, 'old-password', name + ' public', '7531', '');
}

function room(onStart) {
  const g = new Game('TEST', { to: () => ({ emit() {} }) }, null, onStart);
  const host = g.addHuman('host', 'Alice').player;
  g.addBot();
  return { g, host };
}

test('spectators with the same guest name or account never eliminate a player', () => {
  const { g, host } = room();
  host.userId = 'alice';
  g.state = 'PLAYING'; g.phase = 'turn';
  g.addSpectator('visitor', 'Alice', null);
  g.addSpectator('other-device', 'Alice', { username: 'alice' });
  assert.equal(host.alive, true);
  assert.equal(g.state, 'PLAYING');
  assert.equal(g.spectators.length, 2);
  assert.equal(g.rejoin('new-socket', host.id, 'wrong-key').error, 'rejoin_failed');
  assert.equal(g.rejoin('new-socket', host.id, host.key).player, host);
  g.clearAll();
});

test('old signed backups cannot undo spending or server progress', () => {
  const db = database();
  const account = register(db);
  const old = clone(account.vault);
  const spent = db.gacha(account.token, 1);
  const inventory = clone(spent.user.inventory);
  const restored = db.restoreFromVault(old);
  assert.equal(restored.error, undefined);
  assert.equal(restored.user.diamonds, 90);
  assert.deepEqual(clone(restored.user.inventory), inventory);
  assert.equal(db.byToken(account.token), null);
});

test('backup signature covers timestamps, money, recovery PIN and reward claims', () => {
  const db = database();
  const account = register(db);
  for (const [key, value] of Object.entries({
    updatedAt: Date.now() + 60000, coins: 999999, recoveryPin: '9999',
    claimedMail: ['invented'], lastDailyStreak: '2099-01-01', tutorialCompleted: true
  })) {
    const altered = clone(account.vault);
    altered[key] = value;
    assert.equal(db.restoreFromVault(altered).error, 'bad_signature', key);
  }
  const legacy = clone(account.vault);
  delete legacy.version;
  assert.equal(db.restoreFromVault(legacy).error, 'invalid_vault');
});

test('valid backups restore missing accounts without resetting daily or tutorial claims', () => {
  const db = database();
  const account = register(db);
  db.dailyBonus(account.token);
  db.completeTutorial(account.token);
  db.claimMail(account.token, 'all');
  const backup = clone(db.generateVault(db.byToken(account.token)));
  delete db.db.users.alice;
  const restored = db.restoreFromVault(backup);
  assert.equal(restored.error, undefined);
  assert.equal(db.dailyBonus(restored.token).error, 'claimed');
  assert.equal(db.completeTutorial(restored.token).user.diamonds, restored.user.diamonds);
  assert.equal(db.db.users.alice.claimedMail.length, backup.claimedMail.length);
});

test('password reset requires the PIN, revokes sessions and rejects old backups', () => {
  const db = database();
  const account = register(db);
  assert.equal(db.resetPassword('alice', 'alice public', 'new-password').error, 'bad_recovery_pin');
  assert.equal(db.resetPassword('alice', 'wrong', 'new-password').error, 'bad_recovery_pin');
  const reset = db.resetPassword('alice', '7531', 'new-password');
  assert.equal(reset.error, undefined);
  assert.equal(db.byToken(account.token), null);
  assert.equal(db.restoreFromVault(account.vault).error, 'invalid_vault');
  assert.equal(db.login('alice', 'old-password').error, 'bad_login');
  assert.ok(db.login('alice', 'new-password').token);
});

test('stake charging validates the entire room before deducting from anyone', () => {
  const db = database();
  register(db); register(db, 'bobby');
  const players = [{ userId: 'alice' }, { userId: 'bobby' }, { isBot: true }];
  db.db.users.bobby.diamonds = 0;
  assert.equal(db.chargeStake(players, 'vip').error, 'no_diamonds');
  assert.equal(db.db.users.alice.coins, 1000);
  assert.equal(db.db.users.alice.diamonds, 100);
  db.db.users.bobby.diamonds = 100;
  assert.equal(db.chargeStake(players, 'vip').users.length, 2);
  for (const u of Object.values(db.db.users)) {
    assert.equal(u.coins, 0);
    assert.equal(u.diamonds, 90);
  }
  assert.equal(db.chargeStake(players, 'vip').error, 'no_coins');
});

test('paid stakes reject guests and duplicate account seats without partial charges', () => {
  const db = database(); register(db);
  assert.equal(db.chargeStake([{ userId: 'alice' }, {}], 'standard').error, 'auth');
  assert.equal(db.chargeStake([{ userId: 'alice' }, { userId: 'alice' }], 'standard').error, 'auth');
  assert.equal(db.db.users.alice.coins, 1000);
  assert.equal(db.chargeStake([{}], 'casual').users.length, 0);
});

test('game start charges exactly once and only after readiness validation', t => {
  const db = database(); register(db);
  const { g, host } = room(game => db.chargeStake(game.players, game.settings.stake));
  t.after(() => g.clearAll());
  host.userId = 'alice';
  g.updateSettings('host', { stake: 'standard' });
  const friend = g.addHuman('friend', 'Bob').player;
  assert.equal(g.start('host').error, 'not_ready');
  assert.equal(db.db.users.alice.coins, 1000);
  g.players.splice(g.players.indexOf(friend), 1);
  assert.equal(g.start('host').ok, true);
  assert.equal(db.db.users.alice.coins, 900);
  assert.equal(g.start('host').error, 'in_progress');
  assert.equal(db.db.users.alice.coins, 900);
  g.clearAll();
});

test('failed payment leaves the game in the lobby with no cards dealt', () => {
  const db = database(); register(db); db.db.users.alice.coins = 0;
  const { g, host } = room(game => db.chargeStake(game.players, game.settings.stake));
  host.userId = 'alice'; g.updateSettings('host', { stake: 'standard' });
  assert.equal(g.start('host').error, 'no_coins');
  assert.equal(g.state, 'LOBBY');
  assert.equal(host.hand.length, 0);
  assert.equal(g.deck.length, 0);
});

test('changing the stake requires other human players to ready again', () => {
  const { g } = room();
  const friend = g.addHuman('friend', 'Bob').player;
  g.setReady('friend', true);
  g.updateSettings('host', { stake: 'vip' });
  assert.equal(friend.ready, false);
  assert.equal(g.start('host').error, 'not_ready');
});

// Capture actual REST handlers and Socket.IO events while keeping the server
// offline. Database and game engine behavior remain real.
function serverHarness(db) {
  const routes = new Map();
  const app = { use() {}, post: (p, fn) => routes.set('POST ' + p, fn), get: (p, fn) => routes.set('GET ' + p, fn) };
  const express = Object.assign(() => app, { json() {}, static() {} });
  let connect;
  const events = [];
  class Server {
    on(name, fn) { if (name === 'connection') connect = fn; }
    to(id) { return { emit: (event, data) => events.push({ id, event, data }) }; }
  }
  vm.runInNewContext(fs.readFileSync(path.join(root, 'server.js'), 'utf8'), {
    __dirname: root, process: { env: {} }, console: quiet, setInterval() {}, setTimeout() {},
    require: id => id === 'express' ? express : id === 'http' ? { createServer: () => ({ listen() {} }) }
      : id === 'socket.io' ? { Server } : id === './db' ? db : localRequire(id)
  });
  return {
    events,
    request(method, url, body, token, ip = 'test-ip') {
      const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(data) { this.body = data; return this; } };
      const handler = routes.get(method + ' ' + url);
      assert.ok(handler, 'route exists: ' + url);
      handler({ body, headers: { 'x-token': token }, ip }, res);
      return res;
    },
    socket(id) {
      const handlers = new Map();
      const socket = { id, data: {}, handshake: { auth: {} },
        on: (event, fn) => handlers.set(event, fn), join() {}, leave() {},
        emit: (event, data) => events.push({ id, event, data }) };
      connect(socket);
      return { send: (event, data) => handlers.get(event)(data) };
    }
  };
}

test('reset REST route works and throttles repeated attempts', () => {
  const db = database(); register(db);
  const server = serverHarness(db);
  const reset = server.request('POST', '/api/reset-password', { username: 'alice', recoveryPin: '7531', newPassword: 'new-password' });
  assert.equal(reset.statusCode, 200);
  assert.ok(reset.body.token);
  for (let i = 0; i < 4; i++) {
    assert.equal(server.request('POST', '/api/reset-password', { username: 'alice', recoveryPin: 'wrong', newPassword: 'test' }).statusCode, 400);
  }
  assert.equal(server.request('POST', '/api/reset-password', {}).statusCode, 429);
});

test('/api/me refreshes existing sessions with a version 2 backup', () => {
  const db = database(); const account = register(db);
  const response = serverHarness(db).request('GET', '/api/me', null, account.token);
  assert.equal(response.body.vault.version, 2);
  assert.equal(db.restoreFromVault(clone(response.body.vault)).error, undefined);
});

test('quickSolo returns payment errors; ordinary room start charges and emits updated profile', () => {
  const db = database(); const account = register(db);
  const server = serverHarness(db);
  const guest = server.socket('guest');
  guest.send('quickSolo', { name: 'Guest', bots: 1, settings: { stake: 'vip' } });
  assert.ok(server.events.some(e => e.id === 'guest' && e.event === 'err' && e.data === 'auth'));
  const host = server.socket('host');
  host.send('createRoom', { token: account.token, bots: 1, settings: { stake: 'standard' } });
  host.send('start');
  assert.equal(db.db.users.alice.coins, 900);
  assert.ok(server.events.some(e => e.id === 'host' && e.event === 'profile' && e.data.coins === 900));
  host.send('start');
  assert.equal(db.db.users.alice.coins, 900);
  host.send('leaveRoom');
});
