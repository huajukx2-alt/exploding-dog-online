// Firebase Cloud Database Sync Module for 'หมาระเบิด' (Exploding Dog Online)
// Supports Firebase Firestore (via Firebase Admin SDK) and Realtime Database (via Admin SDK or REST API)
const fs = require('fs');
const path = require('path');

let isEnabled = false;
let provider = 'none'; // 'firestore' | 'rtdb-admin' | 'rtdb-rest' | 'none'
let firestoreDb = null;
let rtdbRef = null;

// Configs from environment or local key file
const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_CONFIG || '';
const localKeyPath = path.join(__dirname, 'firebase-key.json');
const rtdbUrl = process.env.FIREBASE_DB_URL || process.env.FIREBASE_DATABASE_URL || '';
const rtdbSecret = process.env.FIREBASE_DB_SECRET || process.env.FIREBASE_SECRET || '';

function parseServiceAccount() {
  if (serviceAccountRaw) {
    try {
      // Try direct JSON parse
      return JSON.parse(serviceAccountRaw);
    } catch (_) {
      try {
        // Try base64 decoded JSON parse
        const decoded = Buffer.from(serviceAccountRaw, 'base64').toString('utf8');
        return JSON.parse(decoded);
      } catch (err) {
        console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', err.message);
      }
    }
  }

  // Check if local file exists
  if (fs.existsSync(localKeyPath)) {
    try {
      return JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
    } catch (e) {
      console.error('[Firebase] Failed to read firebase-key.json:', e.message);
    }
  }

  return null;
}

try {
  const serviceAccount = parseServiceAccount();

  if (serviceAccount) {
    // 1. Initialize via Firebase Admin SDK
    const admin = require('firebase-admin');
    const { getFirestore } = require('firebase-admin/firestore');
    
    // Check if app already initialized
    const app = admin.apps.length > 0 ? admin.app() : admin.initializeApp({
      credential: admin.cert(serviceAccount),
      databaseURL: rtdbUrl || undefined
    });

    try {
      firestoreDb = getFirestore(app);
      provider = 'firestore';
      isEnabled = true;
      console.log(`[Firebase] 🔥 Connected to Google Cloud Firestore (Project: ${serviceAccount.project_id || 'unknown'})`);
    } catch (fsErr) {
      console.warn('[Firebase] Firestore init failed, trying Realtime Database:', fsErr.message);
      if (rtdbUrl) {
        const { getDatabase } = require('firebase-admin/database');
        rtdbRef = getDatabase(app).ref('users');
        provider = 'rtdb-admin';
        isEnabled = true;
        console.log('[Firebase] 🌐 Connected to Firebase Realtime Database (Admin)');
      }
    }
  } else if (rtdbUrl) {
    // 2. Initialize via Firebase Realtime Database REST API (Zero credentials file needed)
    provider = 'rtdb-rest';
    isEnabled = true;
    console.log(`[Firebase] 🌐 Connected to Firebase Realtime Database REST API (${rtdbUrl})`);
  } else {
    console.log('[Storage] ℹ️ Running in Local JSON mode (data/users.json).');
    console.log('[Storage] 💡 To enable permanent cloud accounts with Firebase: set FIREBASE_SERVICE_ACCOUNT or FIREBASE_DB_URL in environment variables.');
  }
} catch (e) {
  console.error('[Firebase] Initialization error (falling back to local JSON):', e.message);
  isEnabled = false;
  provider = 'none';
}

/**
 * Fetch all user accounts from Firebase on server boot
 */
async function fetchAllUsers() {
  if (!isEnabled) return null;

  try {
    if (provider === 'firestore' && firestoreDb) {
      const snap = await firestoreDb.collection('users').get();
      const users = {};
      snap.forEach(doc => {
        users[doc.id.toLowerCase()] = doc.data();
      });
      console.log(`[Firebase] 📥 Pulled ${Object.keys(users).length} user accounts from Firestore cloud!`);
      return users;
    }

    if (provider === 'rtdb-admin' && rtdbRef) {
      const snap = await rtdbRef.once('value');
      const val = snap.val() || {};
      console.log(`[Firebase] 📥 Pulled ${Object.keys(val).length} user accounts from Realtime Database!`);
      return val;
    }

    if (provider === 'rtdb-rest' && rtdbUrl) {
      const url = `${rtdbUrl.replace(/\/$/, '')}/users.json${rtdbSecret ? `?auth=${encodeURIComponent(rtdbSecret)}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const val = (await res.json()) || {};
        console.log(`[Firebase] 📥 Pulled ${Object.keys(val).length} user accounts from Realtime DB REST!`);
        return val;
      }
    }
  } catch (err) {
    console.error('[Firebase] Failed to fetch users from cloud:', err.message);
  }

  return null;
}

/**
 * Save / Update a single user in Firebase (non-blocking async)
 */
function saveUser(usernameKey, userData) {
  if (!isEnabled || !usernameKey || !userData) return;

  const key = String(usernameKey).toLowerCase().trim();

  // Async non-blocking save
  (async () => {
    try {
      if (provider === 'firestore' && firestoreDb) {
        // Strip undefined values for Firestore
        const cleanData = JSON.parse(JSON.stringify(userData));
        await firestoreDb.collection('users').doc(key).set(cleanData, { merge: true });
        return;
      }

      if (provider === 'rtdb-admin' && rtdbRef) {
        await rtdbRef.child(key).set(userData);
        return;
      }

      if (provider === 'rtdb-rest' && rtdbUrl) {
        const url = `${rtdbUrl.replace(/\/$/, '')}/users/${encodeURIComponent(key)}.json${rtdbSecret ? `?auth=${encodeURIComponent(rtdbSecret)}` : ''}`;
        await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
      }
    } catch (err) {
      console.error(`[Firebase] Failed to save user @${key} to cloud:`, err.message);
    }
  })();
}

/**
 * Save all users to Firebase (useful for initial migration or full sync)
 */
async function saveAllUsers(usersObj) {
  if (!isEnabled || !usersObj) return false;

  try {
    const keys = Object.keys(usersObj);
    console.log(`[Firebase] 📤 Syncing all ${keys.length} users to Firebase...`);

    if (provider === 'firestore' && firestoreDb) {
      const batch = firestoreDb.batch();
      for (const k of keys) {
        const ref = firestoreDb.collection('users').doc(k.toLowerCase());
        batch.set(ref, JSON.parse(JSON.stringify(usersObj[k])), { merge: true });
      }
      await batch.commit();
      console.log('[Firebase] ✅ All users synced to Firestore successfully!');
      return true;
    }

    if (provider === 'rtdb-admin' && rtdbRef) {
      await rtdbRef.set(usersObj);
      console.log('[Firebase] ✅ All users synced to Realtime Database successfully!');
      return true;
    }

    if (provider === 'rtdb-rest' && rtdbUrl) {
      const url = `${rtdbUrl.replace(/\/$/, '')}/users.json${rtdbSecret ? `?auth=${encodeURIComponent(rtdbSecret)}` : ''}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usersObj)
      });
      if (res.ok) {
        console.log('[Firebase] ✅ All users synced to Realtime DB REST successfully!');
        return true;
      }
    }
  } catch (err) {
    console.error('[Firebase] Failed to save all users to cloud:', err.message);
  }

  return false;
}

module.exports = {
  isEnabled,
  provider,
  fetchAllUsers,
  saveUser,
  saveAllUsers
};
