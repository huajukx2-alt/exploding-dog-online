const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { database, playing, clone } = require('./support.cjs');
const root = path.resolve(__dirname, '..');
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };

async function client(t, signedIn = false) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  vc.on('error', (...args) => errors.push(args.join(' ')));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'), { url: 'http://game.test', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  t.after(() => { w.close(); assert.deepEqual(errors, [], 'no client runtime errors'); });
  const db = database();
  const account = db.register('ui_tester', 'test-password', 'UI Tester', '7531');
  if (signedIn) { w.localStorage.setItem('ek_token', account.token); w.localStorage.setItem('ek_account_vault', JSON.stringify(account.vault)); }
  for (const key of ['ek_sound', 'ek_voice', 'ek_bgm']) w.localStorage.setItem(key, '0');
  w.requestAnimationFrame = () => 0;
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.prompt = () => '9999'; w.confirm = () => true;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.scrollTo = function () {};
  const handlers = new Map(); const sent = [];
  w.io = () => ({ on: (event, fn) => handlers.set(event, fn), emit: (event, data) => sent.push({ event, data }) });
  const requests = [];
  w.fetch = async (url, options = {}) => {
    const b = options.body ? JSON.parse(options.body) : {};
    const token = options.headers?.['x-token'];
    requests.push({ url, b });
    let data;
    switch (url) {
      case '/api/card-images': data = {}; break;
      case '/api/me': { const u = db.byToken(token); data = u ? { user: db.publicUser(u), vault: db.generateVault(u) } : { error: 'auth' }; break; }
      case '/api/register': data = db.register(b.username, b.password, b.displayName, b.recoveryPin, b.email); break;
      case '/api/login': data = db.login(b.username, b.password); break;
      case '/api/restore-account': data = db.restoreFromVault(b.vault); break;
      case '/api/profile': data = db.updateProfile(token, b); break;
      case '/api/daily': data = db.dailyBonus(token); break;
      case '/api/mailbox': data = db.getMailbox(token); break;
      case '/api/mailbox/claim': data = db.claimMail(token, b.mailId || 'all'); break;
      case '/api/gacha': data = db.gacha(token, b.times); break;
      case '/api/buy': data = db.buy(token, b.itemId); break;
      case '/api/equip': data = db.equip(token, b.itemId, b.type); break;
      case '/api/leaderboard': data = { list: db.leaderboard() }; break;
      case '/api/update-pin': data = db.updateRecoveryPin(token, b.recoveryPin); break;
      case '/api/tutorial/complete': data = db.completeTutorial(token); break;
      case '/api/logout': db.logout(token); data = { ok: true }; break;
      default: throw new Error('Unexpected UI API: ' + url);
    }
    return { json: async () => clone(data), ok: !data.error };
  };
  for (const file of ['shared/cards.js', 'i18n.js', 'audio.js', 'client.js']) w.eval(fs.readFileSync(path.join(root, 'public', file), 'utf8'));
  await flush();
  const $ = selector => w.document.querySelector(selector);
  function click(selector) { const el = $(selector); assert.ok(el, selector + ' exists'); el.click(); }
  return { w, $, click, sent, requests, db, account, emit: (event, data) => handlers.get(event)(data === undefined ? undefined : clone(data)) };
}

test('guest login, main menus, language and stage selection initialize without errors', async t => {
  const c = await client(t);
  c.click('#btnAuthGuest');
  assert.ok(c.$('#screen-home').classList.contains('active'));
  c.click('#dockBtnDeck'); assert.ok(c.$('#modalBody').textContent.length > 100);
  c.click('.modal-x');
  c.click('#dockBtnRanking'); await flush(); assert.ok(c.$('#modalBody').textContent.includes('UI Tester'));
  c.click('.modal-x');
  c.click('#btnLang'); assert.equal(c.w.localStorage.getItem('ek_lang'), 'en');
  c.click('#btnMatchBrowser');
  assert.ok(c.$('#screen-browser').classList.contains('active'));
  assert.ok(c.w.document.querySelectorAll('.stage-card').length >= 6);
});

test('registration form creates an account and switches to home', async t => {
  const c = await client(t);
  for (const [selector, value] of Object.entries({ '#authRegUsername': 'new_player', '#authRegPassword': 'test-password', '#authRegConfirm': 'test-password' })) c.$(selector).value = value;
  c.$('#authRegisterForm').dispatchEvent(new c.w.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  assert.ok(c.w.localStorage.getItem('ek_token'));
  assert.ok(c.requests.some(r => r.url === '/api/register'));
  assert.ok(c.$('#screen-home').classList.contains('active'));
});

test('signed-in profile saves name and PIN, and shop/gacha/mail/daily menus work', async t => {
  const c = await client(t, true);
  c.click('#playerProfileCard');
  c.$('#pfName').value = 'Renamed'; c.click('#pfSave'); await flush();
  assert.equal(c.db.db.users.ui_tester.displayName, 'Renamed');
  c.click('#btnChangePin'); await flush(); assert.equal(c.db.db.users.ui_tester.recoveryPin, '9999');
  c.click('#pfShop');
  assert.ok(c.$('#modalBody').textContent.includes('ร้านค้า'));
  c.click('#btnShopGacha'); assert.ok(c.$('#modalBody').textContent.includes('UR'));
  c.click('.modal-x'); c.click('#btnMail'); await flush();
  assert.ok(c.$('#modalBody').textContent.includes('ของขวัญ'));
  c.click('.modal-x'); c.click('#btnDaily'); await flush();
  c.click('#btnClaimDailyStreak'); await flush(); assert.equal(c.db.db.users.ui_tester.dailyStreak, 1);
});

test('tutorial starts, renders guidance and can exit cleanly to matchmaking', async t => {
  const c = await client(t); c.click('#btnAuthGuest'); c.click('#btnTutorial');
  assert.ok(c.$('#screen-game').classList.contains('active'));
  await new Promise(resolve => setTimeout(resolve, 600));
  assert.ok(c.$('#tutorialCoachOverlay').textContent.length > 100);
  c.click('#btnTutExit');
  c.click('#btnConfirmExitTut');
  assert.ok(c.$('#screen-home').classList.contains('active'));
});

test('live lobby/game updates render hand, menus, chat, stickers and private prompts', async t => {
  const c = await client(t);
  c.click('#btnAuthGuest');
  const g = playing();
  c.emit('joined', { code: g.code, playerId: g.players[0].id, key: g.players[0].key });
  g.state = 'LOBBY'; c.emit('state', g.getState(g.players[0]));
  assert.ok(c.$('#screen-lobby').classList.contains('active'));
  c.click('#btnAddBot'); assert.equal(c.sent.at(-1).event, 'addBot');
  g.state = 'PLAYING'; c.emit('state', g.getState(g.players[0]));
  assert.ok(c.$('#screen-game').classList.contains('active'));
  assert.equal(c.$('#hand').querySelectorAll('[data-uid]').length, g.players[0].hand.length);
  c.click('#btnSort'); assert.equal(c.sent.at(-1).event, 'sortHand');
  c.click('#btnShuffleHand'); assert.equal(c.sent.at(-1).event, 'shuffleHand');
  c.click('#btnSticker'); assert.ok(c.$('#stickerPicker').textContent.length);
  c.click('#btnLog');
  c.click('#btnGameMenu'); c.click('#gmPerf'); assert.equal(c.w.localStorage.getItem('ek_perf_mode'), '1');
  c.click('#gmSound'); assert.equal(c.w.localStorage.getItem('ek_sound'), '1');
  c.click('#gmVoice'); assert.equal(c.w.localStorage.getItem('ek_voice'), '1');
  c.click('#gmLeave'); assert.equal(c.sent.at(-1).event, 'leaveRoom');
  c.emit('left'); assert.ok(c.$('#screen-home').classList.contains('active'));
});

test('guest game rewards are credited once across repeated results renders', async t => {
  const c = await client(t); c.click('#btnAuthGuest');
  const g = playing(); g.state = 'ENDED';
  g.lastResults = g.players.map((p, i) => ({ id: p.id, name: p.name, place: i + 1, reward: { coins: 100, diamonds: 5, rp: 10 } }));
  const initial = +c.w.localStorage.getItem('ek_guest_coins');
  c.emit('state', g.getState(g.players[0]));
  c.emit('state', g.getState(g.players[0]));
  assert.equal(+c.w.localStorage.getItem('ek_guest_coins'), initial + 100);
});
