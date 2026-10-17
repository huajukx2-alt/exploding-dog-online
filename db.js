// Simple JSON-file user store: accounts, coins, rank points, inventory
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SHOP } = require('./public/shared/cards');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'users.json');
let db = { users: {} };          // username(lowercase) -> user
const sessions = new Map();      // token -> username

function load() {
  try { if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { console.error('users.json load failed', e); }
  if (!db.users) db.users = {};
  for (const u of Object.values(db.users)) if (u.token) sessions.set(u.token, u.username.toLowerCase());
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tempFile = `${FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(db, null, 1), 'utf8');
      try {
        fs.renameSync(tempFile, FILE);
      } catch (renameErr) {
        fs.copyFileSync(tempFile, FILE);
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }
    } catch (err) {
      console.error('[db] save error:', err);
    }
  }, 300);
}

const hash = (pw, salt) => {
  if (!salt) return '';
  return crypto.scryptSync(pw, salt, 32).toString('hex');
};

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'tostring', 'valueof']);

function publicUser(u) {
  if (!u) return null;
  return { username: u.username, displayName: u.displayName, avatar: u.avatar, coins: u.coins, rp: u.rp,
    stats: u.stats, inventory: u.inventory, equipped: u.equipped, history: (u.history || []).slice(0, 10) };
}

function register(username, password, displayName) {
  username = String(username || '').trim();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) return { error: 'bad_username' };
  const key = username.toLowerCase();
  if (FORBIDDEN_KEYS.has(key)) return { error: 'bad_username' };
  if (String(password || '').length < 4) return { error: 'bad_password' };
  if (Object.prototype.hasOwnProperty.call(db.users, key)) return { error: 'username_taken' };
  const salt = crypto.randomBytes(16).toString('hex');
  const token = crypto.randomBytes(24).toString('hex');
  const cleanDisplay = String(displayName || username).replace(/[<>]/g, '').trim().slice(0, 16) || username;
  db.users[key] = {
    username, displayName: cleanDisplay, avatar: '🐶',
    salt, pw: hash(password, salt), token, coins: 500, rp: 0,
    stats: { games: 0, wins: 0, explosions: 0, defuses: 0 },
    inventory: [], equipped: { frame: null, skin: null }, history: [], createdAt: Date.now()
  };
  sessions.set(token, key);
  save();
  return { token, user: publicUser(db.users[key]) };
}

function login(username, password) {
  const key = String(username || '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(db.users, key)) return { error: 'bad_login' };
  const u = db.users[key];
  if (!u || !u.salt || hash(String(password || ''), u.salt) !== u.pw) return { error: 'bad_login' };
  if (u.token) sessions.delete(u.token);
  u.token = crypto.randomBytes(24).toString('hex');
  sessions.set(u.token, u.username.toLowerCase());
  save();
  return { token: u.token, user: publicUser(u) };
}

function byToken(token) { const k = sessions.get(token); return k ? db.users[k] : null; }

function logout(token) { const u = byToken(token); if (u) { sessions.delete(token); u.token = null; save(); } }

function updateProfile(token, body) {
  const { displayName, avatar } = body || {};
  const u = byToken(token); if (!u) return { error: 'auth' };
  if (displayName) {
    const clean = String(displayName).replace(/[<>]/g, '').trim().slice(0, 16);
    if (clean) u.displayName = clean;
  }
  if (avatar && [...String(avatar)].length <= 2) u.avatar = avatar;
  save(); return { user: publicUser(u) };
}

function buy(token, itemId) {
  const u = byToken(token); if (!u) return { error: 'auth' };
  const item = SHOP.find(i => i.id === itemId); if (!item) return { error: 'no_item' };
  if (u.inventory.includes(itemId)) return { error: 'owned' };
  if (u.coins < item.price) return { error: 'no_coins' };
  u.coins -= item.price; u.inventory.push(itemId);
  save(); return { user: publicUser(u) };
}

function equip(token, itemId, type) {
  const u = byToken(token); if (!u) return { error: 'auth' };
  if (!['frame', 'skin'].includes(type)) return { error: 'bad_type' };
  if (itemId && !u.inventory.includes(itemId)) return { error: 'not_owned' };
  u.equipped[type] = itemId || null;
  save(); return { user: publicUser(u) };
}

function dailyBonus(token) {
  const u = byToken(token); if (!u) return { error: 'auth' };
  const today = new Date().toISOString().slice(0, 10);
  if (u.lastDaily === today) return { error: 'claimed' };
  u.lastDaily = today; u.coins += 100;
  save(); return { user: publicUser(u), amount: 100 };
}

// result: { place, total, won, exploded, defuses, vsBotsOnly, version }
function recordGame(username, r) {
  const u = db.users[String(username).toLowerCase()]; if (!u) return null;
  const mult = r.vsBotsOnly ? 0.5 : 1;
  const coins = Math.round(((r.won ? 150 : 30) + (r.total - r.place) * 15 + r.defuses * 10) * mult);
  const rpDelta = Math.round((r.won ? 30 : (r.place <= Math.ceil(r.total / 2) ? 5 : -10)) * mult);
  u.coins += coins;
  u.rp = Math.max(0, u.rp + rpDelta);
  u.stats.games++; if (r.won) u.stats.wins++;
  if (r.exploded) u.stats.explosions++;
  u.stats.defuses += r.defuses;
  u.history = [{ t: Date.now(), place: r.place, total: r.total, coins, rp: rpDelta, version: r.version }, ...(u.history || [])].slice(0, 20);
  save();
  return { coins, rp: rpDelta, user: publicUser(u) };
}

function leaderboard() {
  return Object.values(db.users).sort((a, b) => b.rp - a.rp || b.stats.wins - a.stats.wins).slice(0, 50)
    .map(u => ({ displayName: u.displayName, avatar: u.avatar, rp: u.rp, wins: u.stats.wins, games: u.stats.games, frame: u.equipped.frame }));
}

load();
module.exports = { register, login, logout, byToken, publicUser, updateProfile, buy, equip, dailyBonus, recordGame, leaderboard };

