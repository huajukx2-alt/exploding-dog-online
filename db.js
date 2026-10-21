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
  try { if (fs.existsSync(FILE)) { const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8')); db.users = parsed.users || {}; } } catch (e) { console.error('users.json load failed', e); }
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

const VAULT_SECRET = process.env.APP_SECRET || 'ek_alpha_vault_salt_secure_2026';

function computeVaultSignature(data) {
  if (!data) return '';
  const content = [
    String(data.username || '').toLowerCase(),
    String(data.salt || ''),
    String(data.pw || ''),
    String(data.recoveryPin || ''),
    Number(data.coins || 0),
    Number(data.diamonds || 0),
    Number(data.rp || 0),
    JSON.stringify(data.inventory || []),
    JSON.stringify(data.equipped || {})
  ].join('::');
  return crypto.createHmac('sha256', VAULT_SECRET).update(content).digest('hex');
}

function generateVault(u) {
  if (!u) return null;
  const raw = {
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar || '🐶',
    salt: u.salt,
    pw: u.pw,
    recoveryPin: u.recoveryPin || '1234',
    coins: u.coins ?? 500,
    diamonds: u.diamonds ?? 30,
    rp: u.rp ?? 0,
    stats: u.stats || { games: 0, wins: 0, explosions: 0, defuses: 0 },
    inventory: u.inventory || [],
    equipped: u.equipped || { frame: null, skin: null, avatar: null },
    claimedMail: u.claimedMail || [],
    recoveryPin: u.recoveryPin || '1234',
    history: (u.history || []).slice(0, 10),
    createdAt: u.createdAt || Date.now(),
    updatedAt: u.updatedAt || Date.now()
  };
  return {
    ...raw,
    sig: computeVaultSignature(raw)
  };
}

function restoreFromVault(vault) {
  if (!vault || !vault.username || !vault.pw || !vault.salt || !vault.sig) {
    return { error: 'invalid_vault' };
  }
  const expectedSig = computeVaultSignature(vault);
  if (vault.sig !== expectedSig) {
    console.warn('[db] Tampered vault signature for user:', vault.username);
    return { error: 'bad_signature' };
  }

  const key = String(vault.username).trim().toLowerCase();
  if (FORBIDDEN_KEYS.has(key)) return { error: 'bad_username' };

  let u = db.users[key];
  if (!u) {
    // Completely restore user when server woke up or restarted
    u = {
      username: vault.username,
      displayName: vault.displayName || vault.username,
      avatar: vault.avatar || '🐶',
      salt: vault.salt,
      pw: vault.pw,
      recoveryPin: vault.recoveryPin || '1234',
      coins: vault.coins ?? 500,
      diamonds: vault.diamonds ?? 30,
      rp: vault.rp ?? 0,
      stats: vault.stats || { games: 0, wins: 0, explosions: 0, defuses: 0 },
      inventory: Array.from(new Set(vault.inventory || [])),
      equipped: vault.equipped || { frame: null, skin: null, avatar: null },
      claimedMail: vault.claimedMail || [],
      history: vault.history || [],
      createdAt: vault.createdAt || Date.now(),
      updatedAt: vault.updatedAt || Date.now()
    };
    db.users[key] = u;
    console.log(`[db] Resurrected user @${vault.username} from client vault into memory and disk!`);
  } else {
    // User exists; update if vault has higher or newer progress
    if ((vault.updatedAt || 0) >= (u.updatedAt || 0)) {
      u.coins = Math.max(u.coins ?? 0, vault.coins ?? 0);
      u.diamonds = Math.max(u.diamonds ?? 0, vault.diamonds ?? 0);
      u.rp = Math.max(u.rp ?? 0, vault.rp ?? 0);
      u.inventory = Array.from(new Set([...(u.inventory || []), ...(vault.inventory || [])]));
      if (vault.equipped) u.equipped = vault.equipped;
      if (vault.avatar) u.avatar = vault.avatar;
      if (vault.recoveryPin) u.recoveryPin = vault.recoveryPin;
      u.updatedAt = Date.now();
    }
  }

  const token = crypto.randomBytes(24).toString('hex');
  u.token = token;
  sessions.set(token, key);
  save();

  return { token, user: publicUser(u), vault: generateVault(u) };
}

function resetPassword(username, recoveryPin, newPassword) {
  username = String(username || '').trim();
  const key = username.toLowerCase();
  const u = db.users[key];
  if (!u) return { error: 'user_not_found' };

  if (String(newPassword || '').length < 4) return { error: 'bad_password' };

  const pin = String(recoveryPin || '').trim();
  const storedPin = String(u.recoveryPin || '').trim();
  const storedDisplay = String(u.displayName || '').trim();

  // Allow match if PIN matches, OR if PIN matches displayName (for legacy accounts), OR if no pin was set and pin is '1234'
  const isPinValid = (storedPin && pin === storedPin) ||
                     (!storedPin && (pin === '1234' || pin === storedDisplay)) ||
                     (pin === storedDisplay);

  if (!isPinValid) {
    return { error: 'bad_recovery_pin' };
  }

  // Update password
  const newSalt = crypto.randomBytes(16).toString('hex');
  u.salt = newSalt;
  u.pw = hash(newPassword, newSalt);
  if (!u.recoveryPin) u.recoveryPin = pin === '1234' ? '1234' : pin;
  u.updatedAt = Date.now();

  const token = crypto.randomBytes(24).toString('hex');
  u.token = token;
  sessions.set(token, key);
  save();

  return { token, user: publicUser(u), vault: generateVault(u) };
}

function updateRecoveryPin(token, newPin) {
  const u = byToken(token);
  if (!u) return { error: 'auth' };
  newPin = String(newPin || '').trim();
  if (newPin.length < 4 || newPin.length > 12) return { error: 'bad_pin_length' };
  u.recoveryPin = newPin;
  u.updatedAt = Date.now();
  save();
  return { user: publicUser(u), vault: generateVault(u) };
}

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
    recoveryPin: u.recoveryPin || '1234',
    history: (u.history || []).slice(0, 10)
  };
}

function register(username, password, displayName, recoveryPin) {
  username = String(username || '').trim();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) return { error: 'bad_username' };
  const key = username.toLowerCase();
  if (FORBIDDEN_KEYS.has(key)) return { error: 'bad_username' };
  if (String(password || '').length < 4) return { error: 'bad_password' };
  if (Object.prototype.hasOwnProperty.call(db.users, key)) return { error: 'username_taken' };
  const salt = crypto.randomBytes(16).toString('hex');
  const token = crypto.randomBytes(24).toString('hex');
  const cleanDisplay = String(displayName || username).replace(/[<>]/g, '').trim().slice(0, 16) || username;
  const pin = String(recoveryPin || '').trim() || String(Math.floor(1000 + Math.random() * 9000));
  const now = Date.now();
  db.users[key] = {
    username, displayName: cleanDisplay, avatar: '🐶',
    salt, pw: hash(password, salt), token, coins: 500, diamonds: 30, rp: 0,
    recoveryPin: pin,
    stats: { games: 0, wins: 0, explosions: 0, defuses: 0 },
    inventory: [], equipped: { frame: null, skin: null, avatar: null },
    claimedMail: [], history: [], createdAt: now, updatedAt: now
  };
  sessions.set(token, key);
  save();
  return { token, user: publicUser(db.users[key]), vault: generateVault(db.users[key]) };
}

function login(username, password) {
  const key = String(username || '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(db.users, key)) return { error: 'bad_login' };
  const u = db.users[key];
  if (!u || !u.salt || hash(String(password || ''), u.salt) !== u.pw) return { error: 'bad_login' };
  if (u.token) sessions.delete(u.token);
  u.token = crypto.randomBytes(24).toString('hex');
  sessions.set(u.token, u.username.toLowerCase());
  if (!u.recoveryPin) u.recoveryPin = '1234';
  u.updatedAt = Date.now();
  save();
  return { token: u.token, user: publicUser(u), vault: generateVault(u) };
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
  u.updatedAt = Date.now(); save(); return { user: publicUser(u), vault: generateVault(u) };
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

  u.updatedAt = Date.now(); save(); return { user: publicUser(u), vault: generateVault(u) };
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
  u.updatedAt = Date.now(); save(); return { user: publicUser(u), amount: 100, diamonds: 2, vault: generateVault(u) };
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
  u.updatedAt = Date.now(); save();
  return { user: publicUser(u), pulls, cost, vault: generateVault(u) };
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
  u.updatedAt = Date.now(); save();
  return { user: publicUser(u), coins: totalCoins, diamonds: totalDiamonds, vault: generateVault(u) };
}

// result: { place, total, won, exploded, defuses, vsBotsOnly, version }
function recordGame(username, r) {
  const u = db.users[String(username).toLowerCase()]; if (!u) return null;
  const mult = r.vsBotsOnly ? 0.6 : 1;
  const coins = Math.round(((r.won ? 180 : 35) + (r.total - r.place) * 18 + r.defuses * 12) * mult);
  const rpDelta = Math.round((r.won ? 35 : (r.place <= Math.ceil(r.total / 2) ? 10 : -10)) * mult);

  // Generous Diamond rewards:
  // Winner gets +5 diamonds (or +3 vs bots only)
  // Runner-up (2nd place) gets +1 diamond
  // Defuse bonus (2+ defuses in a match) gets +1 extra diamond
  let diamonds = 0;
  if (r.won) {
    diamonds = r.vsBotsOnly ? 3 : 5;
  } else if (r.place === 2 && r.total >= 3) {
    diamonds = 1;
  }
  if ((r.defuses || 0) >= 2 && r.won) {
    diamonds += 1;
  }

  u.coins = (u.coins || 0) + coins;
  u.diamonds = (u.diamonds || 0) + diamonds;
  u.rp = Math.max(0, (u.rp || 0) + rpDelta);
  u.stats = u.stats || { games: 0, wins: 0, explosions: 0, defuses: 0 };
  u.stats.games++; if (r.won) u.stats.wins++;
  if (r.exploded) u.stats.explosions++;
  u.stats.defuses += (r.defuses || 0);
  u.history = [{ t: Date.now(), place: r.place, total: r.total, coins, diamonds, rp: rpDelta, version: r.version }, ...(u.history || [])].slice(0, 20);
  u.updatedAt = Date.now(); save();
  return { coins, diamonds, rp: rpDelta, user: publicUser(u), vault: generateVault(u) };
}

function leaderboard() {
  return Object.values(db.users).sort((a, b) => (b.rp || 0) - (a.rp || 0) || (b.stats?.wins || 0) - (a.stats?.wins || 0)).slice(0, 50)
    .map(u => ({ displayName: u.displayName, avatar: u.avatar, rp: u.rp, wins: u.stats?.wins || 0, games: u.stats?.games || 0, frame: u.equipped?.frame }));
}

load();
module.exports = {
  load, save, register, login, logout, byToken, publicUser, updateProfile,
  buy, equip, dailyBonus, gacha, getMailbox, claimMail, recordGame, leaderboard,
  generateVault, restoreFromVault, resetPassword, updateRecoveryPin, db
};
