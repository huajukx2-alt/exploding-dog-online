const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { io } = require('socket.io-client');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function wait(socket, event, predicate = () => true, ms = 7000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off(event, handler); reject(new Error('Timed out: ' + event)); }, ms);
    function handler(data) { if (predicate(data)) { clearTimeout(timeout); socket.off(event, handler); resolve(data); } }
    socket.on(event, handler);
  });
}

test('real HTTP and Socket.IO integration with isolated persisted data', { timeout: 40000 }, async t => {
  fs.mkdirSync(path.join(root, '.test-output'), { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(root, '.test-output', 'integration-'));
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const base = 'http://127.0.0.1:' + port;
  let child, output = '';
  const sockets = [];
  function launch() {
    child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), APP_DATA_DIR: dataDir, FIREBASE_DISABLED: '1', APP_SECRET: 'integration-only-key' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
  }
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    if (child && child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
  });
  async function ready() {
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
      await delay(100);
    }
    throw new Error('Server did not start: ' + output);
  }
  async function request(url, body, token) {
    const res = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-token': token || '' }, body: body && JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  }
  async function connect() {
    const socket = io(base, { transports: ['websocket'], forceNew: true, reconnection: false });
    sockets.push(socket); await wait(socket, 'connect'); return socket;
  }
  launch(); await ready();
  let account;
  await t.test('health, static assets, card image map and cloud status', async () => {
    assert.equal((await request('/api/health')).data.ok, true);
    for (const asset of ['/', '/client.js', '/style.css', '/audio.js', '/i18n.js', '/shared/cards.js', '/socket.io/socket.io.js']) assert.equal((await fetch(base + asset)).status, 200, asset);
    const images = (await request('/api/card-images')).data;
    for (const url of Object.values(images)) assert.equal((await fetch(base + url)).status, 200, url);
    assert.equal((await request('/api/cloud-status')).data.isEnabled, false);
  });
  await t.test('all account REST endpoints enforce authentication and persist changes', async () => {
    assert.equal((await request('/api/me')).status, 401);
    for (const route of ['/api/profile', '/api/buy', '/api/equip', '/api/daily', '/api/gacha', '/api/mailbox/claim', '/api/tutorial/complete', '/api/update-pin']) assert.equal((await request(route, {})).data.error, 'auth', route);
    const reg = await request('/api/register', { username: 'http_test', password: 'test-password', recoveryPin: '7531' });
    assert.equal(reg.status, 200); account = reg.data;
    assert.equal((await request('/api/profile', { displayName: 'HTTP Player' }, account.token)).data.user.displayName, 'HTTP Player');
    assert.equal((await request('/api/buy', { itemId: 'frame_gold' }, account.token)).data.user.coins, 700);
    assert.equal((await request('/api/equip', { itemId: 'frame_gold', type: 'frame' }, account.token)).data.user.equipped.frame, 'frame_gold');
    assert.equal((await request('/api/daily', {}, account.token)).data.streak, 1);
    assert.equal((await request('/api/daily', {}, account.token)).data.error, 'claimed');
    assert.ok((await request('/api/mailbox', null, account.token)).data.mails.length);
    assert.ok((await request('/api/mailbox/claim', { mailId: 'all' }, account.token)).data.coins > 0);
    assert.equal((await request('/api/gacha', { times: 10 }, account.token)).data.pulls.length, 10);
    assert.equal((await request('/api/tutorial/complete', {}, account.token)).data.ok, true);
    assert.equal((await request('/api/update-pin', { recoveryPin: '9999' }, account.token)).data.user.recoveryPin, '9999');
    assert.equal((await request('/api/leaderboard')).status, 200);
  });
  await t.test('real clients create/join/list/chat/start/rejoin/watch/sort/shuffle/rematch/leave', async () => {
    const host = await connect(); const guest = await connect();
    let joined = wait(host, 'joined');
    host.emit('createRoom', { name: 'Host' });
    const h = await joined;
    assert.match(h.code, /^[A-Z2-9]{4}$/);
    const listed = wait(guest, 'roomsList'); guest.emit('listRooms');
    assert.ok((await listed).some(r => r.code === h.code));
    joined = wait(guest, 'joined'); guest.emit('joinRoom', { code: h.code, name: 'Guest' }); await joined;
    let state = wait(host, 'state', s => s.players.length === 3);
    host.emit('addBot'); const botState = await state;
    const bot = botState.players.find(p => p.isBot);
    state = wait(host, 'state', s => s.players.length === 2); host.emit('removeBot', { botId: bot.id }); await state;
    let err = wait(guest, 'err'); guest.emit('start'); assert.equal(await err, 'host_only');
    const chat = wait(guest, 'chat'); host.emit('chat', { text: 'Hello friends' }); assert.equal((await chat).text, 'Hello friends');
    state = wait(host, 'state', s => s.players.every(p => p.ready)); guest.emit('setReady', { ready: true }); await state;
    state = wait(host, 'state', s => s.state === 'PLAYING' && s.phase === 'intro'); host.emit('start');
    const initial = await state; assert.equal(initial.me.hand.length, 8);
    assert.ok(initial.players.every(p => !p.hand && !p.key));
    host.disconnect();
    const replacement = await connect();
    joined = wait(replacement, 'joined'); replacement.emit('rejoin', { code: h.code, playerId: h.playerId, key: h.key }); await joined;
    state = wait(replacement, 'state', s => s.me.hand.length === 8); replacement.emit('sortHand');
    const sorted = await state;
    state = wait(replacement, 'state'); replacement.emit('shuffleHand');
    assert.deepEqual((await state).me.hand.map(c => c.uid).sort(), sorted.me.hand.map(c => c.uid).sort());
    const viewer = await connect(); joined = wait(viewer, 'joined');
    viewer.emit('joinRoom', { code: h.code, name: 'Host' }); await joined;
    state = wait(viewer, 'state'); viewer.emit('sortHand');
    assert.equal((await state).me.isSpectator, true);
    state = wait(replacement, 'state', s => s.phase === 'turn');
    const current = await state;
    assert.ok(current.players.find(p => p.id === h.playerId).alive);
    const beforeUids = current.me.hand.map(c => c.uid).sort();
    state = wait(replacement, 'state'); replacement.emit('reorder', { from: 0, to: 7 });
    assert.deepEqual((await state).me.hand.map(c => c.uid).sort(), beforeUids);
    const over = wait(replacement, 'gameOver'); guest.emit('leaveRoom');
    assert.equal((await over).results[0].id, h.playerId);
    state = wait(replacement, 'state', s => s.state === 'LOBBY'); replacement.emit('backToLobby');
    assert.ok((await state).players.some(p => p.name === 'Host' && p.id !== h.playerId));
    const left = wait(replacement, 'left'); replacement.emit('leaveRoom'); await left;
  });
  await t.test('accounts and backup signing survive a server restart', async () => {
    await delay(600);
    const stopped = once(child, 'exit'); child.kill(); await stopped;
    launch(); await ready();
    assert.equal((await request('/api/me', null, account.token)).data.user.displayName, 'HTTP Player');
    const reset = await request('/api/reset-password', { username: 'http_test', recoveryPin: '9999', newPassword: 'new-password' });
    assert.equal(reset.status, 200);
    assert.equal((await request('/api/me', null, account.token)).status, 401);
    assert.equal((await request('/api/restore-account', { vault: account.vault })).data.error, 'invalid_vault');
    const logged = await request('/api/login', { username: 'http_test', password: 'new-password' });
    assert.ok(logged.data.token);
    assert.equal((await request('/api/logout', {}, logged.data.token)).data.ok, true);
    assert.equal((await request('/api/me', null, logged.data.token)).status, 401);
  });
  assert.ok(!/\[socket act error|\[game\]|TypeError|ReferenceError/.test(output), output);
});
