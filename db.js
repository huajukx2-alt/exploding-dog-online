// Simple JSON-file user store: accounts, coins, diamonds, rank points, inventory, gacha, mailbox
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SHOP, GACHA_POOL, AVATARS } = require('./public/shared/cards');

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
  return {
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar || '🐶',
    coins: u.coins ?? 500,
    diamonds: u.diamonds ?? 30,
    rp: u.rp ?? 0,
    stats: u.stats || { games: 0, wins: 0, explosions: 0, defuses: 0 },
    inventory: u.inventory || [],
    equipped: u.equipped || { frame: null, skin: null, avatar: null },
    claimedMail: u.claimedMail || [],
    history: (u.history || []).slice(0, 10)
  };
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
    salt, pw: hash(password, salt), token, coins: 500, diamonds: 30, rp: 0,
    stats: { games: 0, wins: 0, explosions: 0, defuses: 0 },
    inventory: [], equipped: { frame: null, skin: null, avatar: null },
    claimedMail: [], history: [], createdAt: Date.now()
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
  if (avatar) {
    // If it is an owned inventory avatar or default avatar list or emoji
    const isAvItem = (u.inventory || []).includes(avatar) || (AVATARS || []).some(a => a.id === avatar);
    if (isAvItem || [...String(avatar)].length <= 4) {
      u.avatar = avatar;
      u.equipped = u.equipped || {};
      u.equipped.avatar = avatar;
    }
  }
  save(); return { user: publicUser(u) };
}

function buy(token, itemId) {
  const u = byToken(token); if (!u) return { error: 'auth' };
  const item = SHOP.find(i => i.id === itemId); if (!item) return { error: 'no_item' };
  u.inventory = u.inventory || [];
  u.equipped = u.equipped || { frame: null, skin: null, avatar: null };
  if (u.inventory.includes(itemId)) return { error: 'owned' };

  if (item.currency === 'diamond') {
    if ((u.diamonds || 0) < item.price) return { error: 'no_diamonds' };
    u.diamonds -= item.price;
  } else {
    if ((u.coins || 0) < item.price) return { error: 'no_coins' };
    u.coins -= item.price;
  }

  u.inventory.push(itemId);
  // Auto-equip if slot is empty or if it's an avatar
  if (item.type === 'avatar') {
    u.avatar = itemId;
    u.equipped.avatar = itemId;
  } else if (item.type === 'frame' && !u.equipped.frame) {
    u.equipped.frame = itemId;
  } else if (item.type === 'skin' && !u.equipped.skin) {
    u.equipped.skin = itemId;
  }

  save(); return { user: publicUser(u) };
}

function equip(token, itemId, type) {
  const u = byToken(token); if (!u) return { error: 'auth' };
  if (!['frame', 'skin', 'avatar'].includes(type)) return { error: 'bad_type' };
  u.inventory = u.inventory || [];
  u.equipped = u.equipped || { frame: null, skin: null, avatar: null };

  if (itemId && !u.inventory.includes(itemId)) return { error: 'not_owned' };

  if (type === 'avatar') {
    u.avatar = itemId || '🐶';
    u.equipped.avatar = itemId || null;
  } else {
    u.equipped[type] = itemId || null;
  }
  save(); return { user: publicUser(u) };
}

function dailyBonus(token) {
  const u = byToken(token); if (!u) return { error: 'auth' };
  const today = new Date().toISOString().slice(0, 10);
  if (u.lastDaily === today) return { error: 'claimed' };
  u.lastDaily = today;
  u.coins = (u.coins || 0) + 100;
  u.diamonds = (u.diamonds || 0) + 2;
  save(); return { user: publicUser(u), amount: 100, diamonds: 2 };
}

// ---------------------------------------------------------------- GACHA
function gacha(token, times = 1) {
  const u = byToken(token); if (!u) return { error: 'auth' };
  times = times === 10 ? 10 : 1;
  const cost = times === 10 ? 90 : 10;
  if ((u.diamonds ?? 0) < cost) return { error: 'no_diamonds', needed: cost, current: u.diamonds ?? 0 };

  u.diamonds = (u.diamonds ?? 0) - cost;
  u.inventory = u.inventory || [];
  u.equipped = u.equipped || { frame: null, skin: null, avatar: null };

  const pulls = [];
  for (let i = 0; i < times; i++) {
    const roll = Math.random() * 100;
    let tier = 'R';
    if (roll < 5) tier = 'UR';
    else if (roll < 25) tier = 'SSR';
    else if (roll < 60) tier = 'SR';
    else tier = 'R';

    // 10th pull in 10x roll guarantees at least SR!
    if (times === 10 && i === 9 && tier === 'R') {
      tier = 'SR';
    }

    const pool = GACHA_POOL[tier] || GACHA_POOL.R;
    const won = pool[Math.floor(Math.random() * pool.length)];

    if (won.type === 'coins') {
      u.coins = (u.coins || 0) + won.amount;
      pulls.push({ ...won, isNew: false, amount: won.amount });
    } else {
      const isDuplicate = u.inventory.includes(won.id);
      if (isDuplicate) {
        const refundCoins = tier === 'UR' ? 600 : (tier === 'SSR' ? 350 : 180);
        u.coins = (u.coins || 0) + refundCoins;
        pulls.push({ ...won, isDuplicate: true, refundCoins });
      } else {
        u.inventory.push(won.id);
        pulls.push({ ...won, isNew: true });
      }
    }
  }
  save();
  return { user: publicUser(u), pulls, cost };
}

// ---------------------------------------------------------------- MAILBOX
const SYSTEM_MAILS = [
  { id: 'mail_welcome', icon: '🎁', title: { th: 'ของขวัญต้อนรับ & รางวัลประจำวัน', en: 'Welcome & Daily Bonus' },
    body: { th: 'ยินดีต้อนรับสู่หมาระเบิดออนไลน์! ล็อกอินทุกวันเพื่อรับเหรียญและเพชรฟรี', en: 'Welcome to Exploding Puppies Online! Log in daily to get free coins & gems.' },
    coins: 150, diamonds: 5 },
  { id: 'mail_gacha_fest', icon: '🌟', title: { th: 'ฉลองเปิดตู้สุ่มกาชาจ่าฝูงลิมิเต็ด!', en: 'Celestial Alpha Gacha Grand Launch!' },
    body: { th: 'รับเพชรฟรี 20 เม็ดสำหรับทดลองสุ่มตู้กาชาจ่าฝูงลุ้นรับของระดับ UR ลิมิเต็ด!', en: '20 free diamonds to summon from the limited Celestial Alpha Gacha!' },
    coins: 300, diamonds: 20 },
  { id: 'mail_patch_v2', icon: '📜', title: { th: 'จดหมายจากทีมพัฒนา: อัปเดตใหญ่จัดเต็ม', en: 'Developer Letter: Massive Update' },
    body: { th: 'อัปเดตระบบอวตาร 3D หน้าตรงกับในเกม, กรอบและหลังไพ่แสดงผลในเกมจริง, และแก้ไขกล่องจดหมาย!', en: '3D avatars matching in-game, real in-game frames and card backs, plus Gacha!' },
    coins: 100, diamonds: 2 }
];

function getMailbox(token) {
  const u = byToken(token);
  const claimed = u ? (u.claimedMail || []) : [];
  const today = new Date().toISOString().slice(0, 10);
  const dailyClaimed = u ? (u.lastDaily === today) : false;
  return {
    mails: SYSTEM_MAILS.map(m => ({
      ...m,
      claimed: m.id === 'mail_welcome' ? dailyClaimed : claimed.includes(m.id)
    })),
    dailyClaimed
  };
}

function claimMail(token, mailId) {
  const u = byToken(token); if (!u) return { error: 'auth' };
  u.claimedMail = u.claimedMail || [];
  const today = new Date().toISOString().slice(0, 10);
  let totalCoins = 0, totalDiamonds = 0;

  if (mailId === 'all') {
    for (const m of SYSTEM_MAILS) {
      if (m.id === 'mail_welcome') {
        if (u.lastDaily !== today) {
          u.lastDaily = today;
          totalCoins += m.coins || 0;
          totalDiamonds += m.diamonds || 0;
        }
      } else if (!u.claimedMail.includes(m.id)) {
        u.claimedMail.push(m.id);
        totalCoins += m.coins || 0;
        totalDiamonds += m.diamonds || 0;
      }
    }
  } else {
    const m = SYSTEM_MAILS.find(x => x.id === mailId);
    if (!m) return { error: 'no_mail' };
    if (m.id === 'mail_welcome') {
      if (u.lastDaily === today) return { error: 'claimed' };
      u.lastDaily = today;
    } else {
      if (u.claimedMail.includes(mailId)) return { error: 'claimed' };
      u.claimedMail.push(mailId);
    }
    totalCoins += m.coins || 0;
    totalDiamonds += m.diamonds || 0;
  }

  if (totalCoins === 0 && totalDiamonds === 0) return { error: 'claimed' };
  u.coins = (u.coins || 0) + totalCoins;
  u.diamonds = (u.diamonds || 0) + totalDiamonds;
  save();
  return { user: publicUser(u), coins: totalCoins, diamonds: totalDiamonds };
}

// result: { place, total, won, exploded, defuses, vsBotsOnly, version }
function recordGame(username, r) {
  const u = db.users[String(username).toLowerCase()]; if (!u) return null;
  const mult = r.vsBotsOnly ? 0.5 : 1;
  const coins = Math.round(((r.won ? 150 : 30) + (r.total - r.place) * 15 + r.defuses * 10) * mult);
  const rpDelta = Math.round((r.won ? 30 : (r.place <= Math.ceil(r.total / 2) ? 5 : -10)) * mult);
  u.coins = (u.coins || 0) + coins;
  if (r.won) u.diamonds = (u.diamonds || 0) + 1; // 1 diamond for victory!
  u.rp = Math.max(0, (u.rp || 0) + rpDelta);
  u.stats = u.stats || { games: 0, wins: 0, explosions: 0, defuses: 0 };
  u.stats.games++; if (r.won) u.stats.wins++;
  if (r.exploded) u.stats.explosions++;
  u.stats.defuses += r.defuses;
  u.history = [{ t: Date.now(), place: r.place, total: r.total, coins, rp: rpDelta, version: r.version }, ...(u.history || [])].slice(0, 20);
  save();
  return { coins, rp: rpDelta, user: publicUser(u) };
}

function leaderboard() {
  return Object.values(db.users).sort((a, b) => (b.rp || 0) - (a.rp || 0) || (b.stats?.wins || 0) - (a.stats?.wins || 0)).slice(0, 50)
    .map(u => ({ displayName: u.displayName, avatar: u.avatar, rp: u.rp, wins: u.stats?.wins || 0, games: u.stats?.games || 0, frame: u.equipped?.frame }));
}

load();
module.exports = {
  register, login, logout, byToken, publicUser, updateProfile,
  buy, equip, dailyBonus, gacha, getMailbox, claimMail, recordGame, leaderboard
};
