const test = require('node:test');
const assert = require('node:assert/strict');
const { SHOP, GACHA_POOL, AVATARS } = require('../public/shared/cards');
const { database, clone } = require('./support.cjs');
const register = db => db.register('account', 'password', 'Account', '7531', 'test@example.invalid');

test('registration validates names, duplicates, passwords and hides credentials in public profile', () => {
  const db = database();
  for (const name of ['ab', '<script>', '__proto__', 'constructor']) assert.equal(db.register(name, 'password').error, 'bad_username');
  assert.equal(db.register('valid', '123').error, 'bad_password');
  const account = register(db);
  assert.equal(db.register('ACCOUNT', 'password').error, 'username_taken');
  assert.equal(db.login('account', 'wrong').error, 'bad_login');
  const logged = db.login('ACCOUNT', 'password');
  assert.ok(logged.token);
  assert.equal(db.byToken(account.token), null);
  for (const key of ['pw', 'salt', 'token']) assert.equal(key in logged.user, false);
  db.logout(logged.token); assert.equal(db.byToken(logged.token), null);
});

test('all shop items can be purchased, equipped and unequipped; duplicates are rejected', () => {
  const db = database(); const account = register(db); const u = db.byToken(account.token);
  u.coins = 1e7; u.diamonds = 1e7;
  for (const item of SHOP.filter(i => !u.inventory.includes(i.id))) {
    const before = { coins: u.coins, diamonds: u.diamonds };
    assert.equal(db.buy(account.token, item.id).error, undefined, item.id);
    const currency = item.currency === 'diamond' ? 'diamonds' : 'coins';
    assert.equal(u[currency], before[currency] - item.price);
    assert.equal(db.buy(account.token, item.id).error, 'owned');
    if (item.type !== 'sticker') {
      assert.equal(db.equip(account.token, item.id, item.type).error, undefined);
      assert.equal(u.equipped[item.type], item.id);
      assert.equal(db.equip(account.token, null, item.type).error, undefined);
    }
  }
});

test('shop protects insufficient balances, ownership and item types', () => {
  const db = database(); const account = register(db); const u = db.byToken(account.token);
  u.coins = 0; u.diamonds = 0;
  assert.equal(db.buy(account.token, SHOP.find(x => x.price > 0 && x.currency !== 'diamond').id).error, 'no_coins');
  assert.equal(db.buy('invalid', SHOP[0].id).error, 'auth');
  assert.equal(db.equip(account.token, SHOP[0].id, 'avatar').error, 'not_owned');
  u.inventory.push(SHOP[0].id);
  assert.equal(db.equip(account.token, SHOP[0].id, 'frame').error, 'bad_type');
});

test('profile sanitizes names and does not grant unowned premium avatars', () => {
  const db = database(); const account = register(db);
  const profile = db.updateProfile(account.token, { displayName: '<b>New Name</b>', avatar: AVATARS[0].id });
  assert.ok(!profile.user.displayName.includes('<'));
  assert.equal(profile.user.avatar, '🐶');
  assert.equal(db.updateProfile(account.token, { avatar: '🐕' }).user.avatar, '🐕');
});

test('daily rewards progress through seven days, reject duplicate claims and reset after a gap', () => {
  let now = Date.UTC(2026, 0, 1, 12);
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const db = database({ Date: Clock }); const account = register(db);
  for (let day = 1; day <= 8; day++) {
    const reward = db.dailyBonus(account.token);
    assert.equal(reward.streak, (day - 1) % 7 + 1);
    assert.equal(db.dailyBonus(account.token).error, 'claimed');
    now += 86400000;
  }
  now += 86400000;
  assert.equal(db.dailyBonus(account.token).streak, 1);
});

test('mailbox single/all claims and tutorial rewards are granted only once', () => {
  const db = database(); const account = register(db);
  const mails = db.getMailbox(account.token).mails;
  assert.ok(mails.length > 0);
  assert.equal(db.claimMail(account.token, mails[0].id).coins, mails[0].coins);
  assert.equal(db.claimMail(account.token, mails[0].id).error, 'claimed');
  assert.equal(db.claimMail(account.token, 'all').coins, mails.slice(1).reduce((a, m) => a + m.coins, 0));
  assert.equal(db.claimMail(account.token, 'all').error, 'claimed');
  const first = clone(db.completeTutorial(account.token));
  const repeat = db.completeTutorial(account.token);
  assert.equal(repeat.user.coins, first.user.coins);
  assert.equal(repeat.user.diamonds, first.user.diamonds);
});

test('gacha single and ten pulls charge correctly; tenth pull guarantees SR or above', () => {
  const db = database({ random: () => 0.99 }); const account = register(db);
  const one = db.gacha(account.token, 1);
  assert.equal(one.cost, 10); assert.equal(one.pulls.length, 1);
  const ten = db.gacha(account.token, 10);
  assert.equal(ten.cost, 90); assert.equal(ten.pulls.length, 10);
  assert.notEqual(ten.pulls[9].tier, 'R');
  assert.equal(ten.user.diamonds, 0);
  assert.equal(db.gacha(account.token, 1).error, 'no_diamonds');
});

for (const [tier, roll] of [['UR', 0], ['SSR', 0.1], ['SR', 0.3], ['R', 0.8]]) {
  test(`gacha ${tier} selects valid prizes and handles duplicates`, () => {
    let i = 0; const db = database({ random: () => (++i % 2 ? roll : 0) }); const account = register(db);
    const first = db.gacha(account.token, 1).pulls[0];
    const second = db.gacha(account.token, 1).pulls[0];
    assert.ok(GACHA_POOL[tier].some(x => x.id === first.id));
    if (first.type !== 'coins') assert.equal(second.isDuplicate, true);
  });
}

test('recordGame updates currency, stats, bounded history and leaderboard ranking', () => {
  const db = database(); const account = register(db);
  db.register('second', 'password', 'Second', '7531');
  for (let i = 0; i < 25; i++) db.recordGame('account', { place: 1, total: 4, won: true, exploded: false, defuses: 2, vsBotsOnly: false, version: 'mega' });
  const u = db.byToken(account.token);
  assert.equal(u.stats.games, 25); assert.equal(u.stats.wins, 25); assert.equal(u.stats.defuses, 50);
  assert.equal(u.history.length, 20);
  assert.equal(db.leaderboard()[0].displayName, 'Account');
  assert.ok(u.coins > 1000 && u.diamonds > 100 && u.rp > 0);
});

test('changing PIN validates input and invalidates old backups', () => {
  const db = database(); const account = register(db);
  assert.equal(db.updateRecoveryPin('bad', '9999').error, 'auth');
  assert.equal(db.updateRecoveryPin(account.token, '12').error, 'bad_pin_length');
  assert.equal(db.updateRecoveryPin(account.token, '9999').user.recoveryPin, '9999');
  assert.equal(db.restoreFromVault(account.vault).error, 'invalid_vault');
  assert.equal(db.resetPassword('account', '7531', 'new-password').error, 'bad_recovery_pin');
  assert.ok(db.resetPassword('account', '9999', 'new-password').token);
});

test('cloud accounts finish loading before readiness resolves', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const db = database({ cloud: { isEnabled: true, fetchAllUsers: () => pending, saveAllUsers() {} } });
  assert.equal(Object.keys(db.db.users).length, 0);
  release({ clouduser: { username: 'clouduser', token: 'cloud-token' } });
  await db.ready;
  assert.equal(db.byToken('cloud-token').username, 'clouduser');
});
