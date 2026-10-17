/* Exploding Kittens Online — client */
(() => {
  const { CARDS, VERSIONS, CONFIGURABLE, SHOP, FREE_STICKERS, CARD_KINDS, rankOf } = window.EK;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const A = window.Audio2;

  // ------------------------------------------------------------ app state
  let lang = localStorage.getItem('ek_lang') || 'th';
  let token = localStorage.getItem('ek_token') || '';
  let user = null;
  let S = null;              // latest game state
  let timeOffset = 0;
  let sel = [];              // selected card uids (ordered)
  let imgMap = {};
  let screen = 'home';
  let lastSettingsKey = '';
  let openPromptKey = null;
  let lastTick = -1;
  let homeVersion = localStorage.getItem('ek_ver') || 'original';
  if (!VERSIONS[homeVersion]) homeVersion = 'original';

  const t = (k) => (I18N[lang][k] ?? I18N.en[k] ?? k);
  const terr = (e) => I18N[lang].err[e] || e;
  const cname = (id) => CARDS[id] ? CARDS[id].name[lang] : id;
  const cdesc = (id) => CARDS[id] ? CARDS[id].desc[lang] : '';
  const me = () => S && S.me && S.players.find(p => p.id === S.me.id);
  const pl = (id) => S && S.players.find(p => p.id === id);
  const now = () => Date.now() + timeOffset;
  const FALLBACK = { favor: '/img/favor.jpg', see_the_future: '/img/future.jpg', nope: '/img/nope.jpg' };
  const imgFor = (id) => imgMap[id] || FALLBACK[id] || null;

  // ------------------------------------------------------------ helpers: cards / avatars
  function cardHTML(id, o = {}) {
    const c = CARDS[id]; if (!c) return '';
    const img = imgFor(id);
    const k = CARD_KINDS?.[c.kind] || { icon: '🃏', name: { th: 'การ์ด', en: 'Card' } };
    const kname = k.name[lang] || k.name.en || c.kind;
    return `<div class="card face k-${c.kind} ${o.cls || ''} ${o.selected ? 'sel' : ''}" style="--c:${c.color}" ${o.uid ? `data-uid="${o.uid}"` : ''} data-id="${id}" ${o.attr || ''}>
      <div class="card-type type-${c.kind}" title="${esc(kname)}" data-card-id="${id}">
        <span class="type-icon">${k.icon}</span><span class="type-text">${esc(kname)}</span>
      </div>
      <div class="art">${img ? `<img src="${img}" loading="lazy" alt="">` : `<span class="emoji">${c.icon}</span>`}</div>
      <div class="cname"><span>${c.icon}</span> ${esc(c.name[lang])}</div>
      ${o.count !== undefined ? `<div class="ccount">x${o.count}</div>` : ''}
    </div>`;
  }
  const backHTML = (skin, extra = '') => `<div class="card back ${skin || ''}" ${extra}></div>`;
  function avatarHTML(p, size = '') {
    return `<div class="avatar ${p.frame || ''} ${size}"><span>${esc(p.avatar || '🐶')}</span></div>`;
  }
  function rankBadge(rp) { const r = rankOf(rp || 0); return `<span class="rank r-${r.id}" title="${r.name[lang]}">${r.icon}</span>`; }

  // Rich SVG cartoon dog characters matching the 4 arcade archetypes (VIP Shiba, Cyber Husky, Galaxy Corgi, Blaze Bulldog)
  const DOG_THEMES = ['gold', 'neon', 'fire', 'galaxy'];
  function themeForPlayer(p, idx = 0) {
    if (p.frame === 'frame_gold') return 'gold';
    if (p.frame === 'frame_neon') return 'neon';
    if (p.frame === 'frame_fire') return 'fire';
    if (p.frame === 'frame_rainbow') return 'galaxy';
    return DOG_THEMES[idx % DOG_THEMES.length];
  }
  function dogHeroSVG(theme) {
    if (theme === 'gold') {
      // Cool Gold VIP Shiba with sunglasses & gold chain
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs><radialGradient id="gGold" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#fef08a"/><stop offset="100%" stop-color="#b45309"/></radialGradient></defs>
        <circle cx="60" cy="60" r="56" fill="url(#gGold)"/>
        <polygon points="24,46 32,12 52,34" fill="#f59e0b" stroke="#1c1208" stroke-width="4" stroke-linejoin="round"/>
        <polygon points="96,46 88,12 68,34" fill="#f59e0b" stroke="#1c1208" stroke-width="4" stroke-linejoin="round"/>
        <path d="M28,95 Q60,78 92,95 L98,118 L22,118 Z" fill="#d97706" stroke="#1c1208" stroke-width="4"/>
        <ellipse cx="60" cy="62" rx="36" ry="32" fill="#fbbf24" stroke="#1c1208" stroke-width="4"/>
        <ellipse cx="60" cy="70" rx="22" ry="16" fill="#fef3c7"/>
        <path d="M48,74 Q60,82 72,74" fill="none" stroke="#1c1208" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M58,77 C56,88 68,88 65,76 Z" fill="#fb7185" stroke="#1c1208" stroke-width="2.5"/>
        <ellipse cx="60" cy="65" rx="8" ry="5.5" fill="#1c1208"/>
        <!-- Cool Gold Sunglasses -->
        <rect x="26" y="44" width="30" height="16" rx="4" fill="#1e1b4b" stroke="#fde047" stroke-width="3.5"/>
        <rect x="64" y="44" width="30" height="16" rx="4" fill="#1e1b4b" stroke="#fde047" stroke-width="3.5"/>
        <line x1="56" y1="50" x2="64" y2="50" stroke="#fde047" stroke-width="3.5"/>
        <line x1="32" y1="48" x2="42" y2="56" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="70" y1="48" x2="80" y2="56" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Gold Chain -->
        <path d="M34,94 Q60,108 86,94" fill="none" stroke="#fde047" stroke-width="6" stroke-dasharray="7 4" stroke-linecap="round"/>
      </svg>`;
    }
    if (theme === 'neon') {
      // Cyber Neon Husky with glowing VR visor
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs><radialGradient id="gNeon" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#1e1b4b"/></radialGradient></defs>
        <circle cx="60" cy="60" r="56" fill="url(#gNeon)"/>
        <polygon points="24,46 30,10 52,34" fill="#475569" stroke="#0f172a" stroke-width="4"/>
        <polygon points="30,42 33,18 47,34" fill="#f472b6"/>
        <polygon points="96,46 90,10 68,34" fill="#475569" stroke="#0f172a" stroke-width="4"/>
        <polygon points="90,42 87,18 73,34" fill="#f472b6"/>
        <path d="M26,95 Q60,80 94,95 L98,118 L22,118 Z" fill="#334155" stroke="#0f172a" stroke-width="4"/>
        <ellipse cx="60" cy="62" rx="35" ry="32" fill="#64748b" stroke="#0f172a" stroke-width="4"/>
        <ellipse cx="60" cy="68" rx="24" ry="18" fill="#f1f5f9"/>
        <path d="M50,74 Q60,83 70,74" fill="none" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M56,76 C56,88 66,88 65,76 Z" fill="#fb7185" stroke="#0f172a" stroke-width="2.5"/>
        <ellipse cx="60" cy="65" rx="7.5" ry="5" fill="#0f172a"/>
        <!-- Cyber VR Visor -->
        <rect x="22" y="41" width="76" height="20" rx="8" fill="#090d16" stroke="#22d3ee" stroke-width="3.5"/>
        <rect x="27" y="45" width="66" height="12" rx="5" fill="#ec4899" opacity="0.85"/>
        <circle cx="43" cy="51" r="4" fill="#67e8f9"/><circle cx="77" cy="51" r="4" fill="#67e8f9"/>
        <line x1="53" y1="51" x2="67" y2="51" stroke="#67e8f9" stroke-width="2.5"/>
      </svg>`;
    }
    if (theme === 'fire') {
      // Blaze Bulldog with pirate/biker bandana & flame scarf
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs><radialGradient id="gFire" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#fb923c"/><stop offset="100%" stop-color="#7f1d1d"/></radialGradient></defs>
        <circle cx="60" cy="60" r="56" fill="url(#gFire)"/>
        <path d="M24,92 L60,112 L96,92 L98,118 L22,118 Z" fill="#dc2626" stroke="#1c1208" stroke-width="4"/>
        <ellipse cx="60" cy="64" rx="38" ry="33" fill="#d97706" stroke="#1c1208" stroke-width="4"/>
        <!-- Head Bandana -->
        <path d="M24,52 Q60,22 96,52 Q60,44 24,52 Z" fill="#1e293b" stroke="#1c1208" stroke-width="3.5"/>
        <!-- Bulldog Jowls & Fangs -->
        <ellipse cx="60" cy="74" rx="26" ry="16" fill="#fef3c7" stroke="#1c1208" stroke-width="3.5"/>
        <path d="M40,78 Q60,70 80,78" fill="none" stroke="#1c1208" stroke-width="4" stroke-linecap="round"/>
        <polygon points="44,76 48,67 52,76" fill="#fff" stroke="#1c1208" stroke-width="2"/>
        <polygon points="68,76 72,67 76,76" fill="#fff" stroke="#1c1208" stroke-width="2"/>
        <ellipse cx="60" cy="64" rx="8.5" ry="5.5" fill="#1c1208"/>
        <!-- Fierce Eyes -->
        <circle cx="44" cy="55" r="6.5" fill="#1c1208"/><circle cx="76" cy="55" r="6.5" fill="#1c1208"/>
        <line x1="33" y1="47" x2="53" y2="53" stroke="#1c1208" stroke-width="4.5" stroke-linecap="round"/>
        <line x1="87" y1="47" x2="67" y2="53" stroke="#1c1208" stroke-width="4.5" stroke-linecap="round"/>
      </svg>`;
    }
    // Galaxy Space Corgi (default / galaxy)
    return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
      <defs><radialGradient id="gGal" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#1e1b4b"/></radialGradient></defs>
      <circle cx="60" cy="60" r="56" fill="url(#gGal)"/>
      <!-- Space Suit -->
      <path d="M26,92 Q60,78 94,92 L98,118 L22,118 Z" fill="#f8fafc" stroke="#1e293b" stroke-width="4"/>
      <rect x="46" y="96" width="28" height="14" rx="4" fill="#38bdf8" stroke="#1e293b" stroke-width="2.5"/>
      <!-- Corgi Ears & Head -->
      <polygon points="24,50 28,14 50,36" fill="#fb923c" stroke="#1c1208" stroke-width="3.5"/>
      <polygon points="96,50 92,14 70,36" fill="#fb923c" stroke="#1c1208" stroke-width="3.5"/>
      <ellipse cx="60" cy="62" rx="33" ry="29" fill="#fb923c" stroke="#1c1208" stroke-width="3.5"/>
      <ellipse cx="60" cy="68" rx="20" ry="16" fill="#fff"/>
      <circle cx="46" cy="55" r="6" fill="#1c1208"/><circle cx="74" cy="55" r="6" fill="#1c1208"/>
      <circle cx="44" cy="53" r="2.2" fill="#fff"/><circle cx="72" cy="53" r="2.2" fill="#fff"/>
      <ellipse cx="60" cy="63" rx="7" ry="5" fill="#1c1208"/>
      <path d="M55,72 C55,83 66,83 65,72 Z" fill="#fb7185" stroke="#1c1208" stroke-width="2"/>
      <!-- Glass Space Bubble Helmet -->
      <circle cx="60" cy="58" r="46" fill="rgba(186,230,253,0.16)" stroke="#bae6fd" stroke-width="3.5"/>
      <path d="M28,36 A38,38 0 0,1 58,18" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity="0.75"/>
    </svg>`;
  }

  // ------------------------------------------------------------ i18n apply
  function applyI18n() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $('#btnLang').textContent = lang === 'th' ? 'TH' : 'EN';
    renderHome(); if (S) render();
  }

  // ------------------------------------------------------------ toasts / overlays / FX
  function toast(msg, type = '') {
    const el = document.createElement('div'); el.className = 'toast ' + type; el.innerHTML = msg;
    $('#toasts').appendChild(el); setTimeout(() => el.classList.add('out'), 2800); setTimeout(() => el.remove(), 3300);
  }
  let bannerTimer;
  function banner(html, cls = '', ms = 1900) {
    const b = $('#banner'); b.className = 'show ' + cls; b.innerHTML = `<div class="banner-inner">${html}</div>`;
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.className = ''; }, ms);
  }
  function flyCards(ids, label) {
    const box = $('#cardFly');
    box.innerHTML = `<div class="fly-cards">${ids.map(id => cardHTML(id)).join('')}</div>${label ? `<div class="fly-label">${label}</div>` : ''}`;
    box.className = ''; void box.offsetWidth; box.className = 'show';
    clearTimeout(box._t); box._t = setTimeout(() => { box.className = ''; }, 1700);
  }
  let spotlightActive = false;
  let spotlightTimer = null;
  function showCardSpotlight(cardId, effect, actorName, targetName, namedId, duration = 1800) {
    const box = $('#actionSpotlight');
    if (!box) return;
    clearTimeout(spotlightTimer);
    spotlightActive = true;

    const eff = effect || cardId;
    const cardMeta = CARDS[cardId] || CARDS[eff] || {};
    const cardColor = cardMeta.color || '#eab308';
    const cardTitle = cname(cardId);

    const DESC = {
      attack: { th: '⚡ จบเทิร์นทันที! สั่งให้คนถัดไปเล่น 2 เทิร์นรวดโดยไม่ต้องจั่ว', en: 'End turn! Next player takes 2 turns without drawing' },
      targeted_attack: { th: `🎯 สั่งกัดเจาะจง! บังคับให้ ${targetName || 'เป้าหมาย'} เล่น 2 เทิร์นรวด`, en: `Targeted Attack! Forces ${targetName || 'target'} to take 2 turns` },
      personal_attack: { th: '🥊 ไล่งับหางตัวเอง! คุณต้องเล่นเพิ่มอีก 2 เทิร์น', en: 'Personal Attack! You must take 2 extra turns' },
      skip: { th: '⏭️ ชิ่งหนี! จบเทิร์นทันทีโดยไม่ต้องจั่วการ์ด', en: 'Skip! Ends turn without drawing a card' },
      super_skip: { th: '🦸 ซูเปอร์ชิ่ง! จบทุกเทิร์นที่ติดค้างอยู่ทั้งหมดทันที', en: 'Super Skip! Ends ALL remaining turns immediately' },
      reverse: { th: '🔁 วิ่งย้อนศร! สลับทิศทางการเล่นวนกลับ', en: 'Reverse! Play order is now reversed' },
      shuffle: { th: '🔀 ตะกุยสับกอง! สับการ์ดในกองจั่วใหม่ทั้งหมด', en: 'Shuffle! Shuffled the entire draw pile' },
      see_the_future: { th: '🔮 ดมกลิ่นอนาคต! แอบดูการ์ด 3 ใบบนสุดของกอง', en: 'Sniff the Future! Peeked at the top 3 cards' },
      see_future_5: { th: '👁️ ดมกลิ่นอนาคต x5! แอบดูการ์ด 5 ใบบนสุดของกอง', en: 'Sniff the Future x5! Peeked at the top 5 cards' },
      alter_the_future: { th: '🪄 เปลี่ยนอนาคต! ดูและจัดเรียง 3 ใบบนสุดใหม่', en: 'Alter the Future! Rearranged the top 3 cards' },
      alter_future_5: { th: '✨ เปลี่ยนอนาคต x5! ดูและจัดเรียง 5 ใบบนสุดใหม่', en: 'Alter the Future x5! Rearranged the top 5 cards' },
      draw_bottom: { th: '⬇️ คุ้ยก้นกอง! จบเทิร์นโดยจั่วการ์ดใบล่างสุดของกอง', en: 'Draw from Bottom! Draws the bottom card of the deck' },
      swap_top_bottom: { th: '🔃 สลับบน-ล่าง! สลับการ์ดใบบนสุดกับใบล่างสุดของกอง', en: 'Swap Top & Bottom! Swapped the top and bottom cards' },
      catomic_bomb: { th: '☢️ ด็อกอะตอมิกบอมบ์! หมาระเบิดทุกลูกถูกย้ายมาวางบนสุด!', en: 'Dogomic Bomb! All exploding puppies moved to the top!' },
      bury: { th: '⛏️ ขุดหลุมฝัง! เอาการ์ดใบบนสุดไปฝังซ่อนไว้ในกอง', en: 'Bury! Buried the top card into the deck' },
      dig_deeper: { th: '🪨 ขุดลึกหาสมบัติ! ดูการ์ดบนสุด เลือกเก็บหรือจั่วใบถัดไป', en: 'Dig Deeper! Peek top card: keep or draw next' },
      clairvoyance: { th: '🧿 จมูกทิพย์! ดมกลิ่นรู้ตำแหน่งของหมาระเบิดในกอง', en: 'Super Snout! Sniffed out the bomb location in deck' },
      favor: { th: `🎁 ทำตาแป๋วขอไพ่! บังคับให้ ${targetName || 'เพื่อน'} เลือกการ์ดส่งให้ 1 ใบ`, en: `Favor! Forces ${targetName || 'player'} to give 1 card` },
      pair: { th: `🌭🌭 เล่นคู่หมา 2 ใบ! สุ่มขโมยการ์ด 1 ใบจาก ${targetName || 'เพื่อน'}`, en: `2-Card Combo! Stole a random card from ${targetName || 'player'}` },
      triple: { th: `🌭🌭🌭 เล่นหมาตอง 3 ใบ! ขอขโมย ${namedId ? cname(namedId) : 'การ์ด'} จาก ${targetName || 'เพื่อน'}`, en: `3-Card Combo! Demanded ${namedId ? cname(namedId) : 'card'} from ${targetName || 'player'}` },
      '5_cards': { th: '♻️ เล่นคอมโบ 5 ใบต่างชนิด! เลือกหยิบการ์ด 1 ใบจากกองทิ้ง', en: '5-Card Combo! Picked 1 card from the discard pile' },
      barking_kitten: { th: '🐕 หมาเห่าบ๊อกๆ! ใครถืออีกใบต้องเผชิญหน้ากับระเบิด!', en: 'Barking Puppy! Whoever holds the other faces an explosion!' },
      clone: { th: '🧬 โคลนนิ่ง! คัดลอกพลังของการ์ดใบก่อนหน้า', en: 'Clone! Copied the power of the previous card' },
      nope: { th: '🛑 ไม่! (Nope) ยกเลิกและสกัดกั้นแอคชั่นทันที!', en: 'Nope! Stopped and cancelled the action!' },
      defuse: { th: '🛠️ กู้ระเบิด! โยนกระดูกหลอกล่อแล้วซ่อนระเบิดคืนกอง', en: 'Defuse! Safely hid the bomb back in the deck' }
    };
    const descText = (DESC[eff] && DESC[eff][lang]) || (cardMeta.desc && cardMeta.desc[lang]) || '';

    box.style.setProperty('--spot-color', cardColor);
    box.innerHTML = `
      <div class="spotlight-card-wrap">
        <div class="spotlight-actor-tag">
          <span>${esc(actorName)}</span>
          ${targetName ? `<span>➔ 🎯 <b>${esc(targetName)}</b></span>` : ''}
        </div>
        <div class="card xl" style="border-color:${cardColor};box-shadow:0 0 25px ${cardColor};">
          <div class="c-top"><span>${cardMeta.icon || '🃏'}</span><small>${esc(cardTitle)}</small></div>
          <div class="c-art"><span style="font-size:3.2rem;">${cardMeta.icon || '🃏'}</span></div>
          <div class="c-bot"><b>${esc(cardTitle)}</b></div>
        </div>
        <div class="spotlight-title-row">
          <span style="font-size:1.8rem;">${cardMeta.icon || '🃏'}</span>
          <h3 class="spotlight-title">${esc(cardTitle)}</h3>
        </div>
        ${descText ? `<div class="spotlight-desc-badge">${esc(descText)}</div>` : ''}
      </div>
    `;
    box.className = 'show';
    spotlightTimer = setTimeout(() => {
      box.className = '';
      setTimeout(() => { box.innerHTML = ''; spotlightActive = false; }, 280);
    }, duration);
  }
  function flash(color, shake) {
    const f = $('#flash'); f.style.background = color; f.className = ''; void f.offsetWidth; f.className = 'show';
    if (shake) { document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); }
  }
  function confetti(coins) {
    const box = $('#confetti'); box.innerHTML = '';
    const items = coins ? ['🪙', '💰', '🦴', '✨'] : ['🎉', '🎊', '🦴', '🐶', '🐾'];
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('span'); s.textContent = items[i % items.length];
      s.style.left = Math.random() * 100 + 'vw'; s.style.animationDelay = Math.random() * 1.5 + 's'; s.style.fontSize = (16 + Math.random() * 22) + 'px';
      s.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      box.appendChild(s);
    }
    setTimeout(() => { box.innerHTML = ''; }, 5000);
  }
  function seatEl(id) {
    if (id === S?.me?.id) {
      const hero = $('#myHeroSeat');
      if (hero && hero.offsetParent !== null) return hero;
      return $('#hand') || $('#handArea');
    }
    return $(`.seat[data-id="${id}"]`);
  }
  function floatAt(id, html, cls = '') {
    const anchor = seatEl(id); if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div'); el.className = 'floater ' + cls; el.innerHTML = html;
    el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.top + Math.min(r.height / 2, 50)) + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 2800);
  }

  // ------------------------------------------------------------ modal
  let modalOnClose = null, modalLocked = false;
  let modalAutoTimer = null;
  function clearModalAuto() {
    if (modalAutoTimer) { clearTimeout(modalAutoTimer); modalAutoTimer = null; }
  }
  function openModal(html, { onClose, locked = false, cls = '' } = {}) {
    clearModalAuto();
    $('#modalBody').innerHTML = html;
    $('#modal').className = cls; modalOnClose = onClose || null; modalLocked = locked;
    $('.modal-x').style.display = locked ? 'none' : '';
  }
  function closeModal(force) {
    if (modalLocked && !force) return;
    clearModalAuto();
    $('#modal').className = 'hidden'; $('#modalBody').innerHTML = '';
    openPromptKey = null; const f = modalOnClose; modalOnClose = null; modalLocked = false; if (f) f();
  }
  $('.modal-x').onclick = () => closeModal();
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

  function modalTimerHTML(deadlineMs, labelText) {
    const remaining = Math.max(0, deadlineMs - now());
    const secs = Math.ceil(remaining / 1000);
    return `
      <div class="prompt-timer-wrap" id="promptTimerWrap" data-deadline="${deadlineMs}">
        <div class="prompt-timer-header">
          <span>⏳ ${labelText || (lang === 'th' ? 'เวลาตัดสินใจ' : 'Action Timer')}</span>
          <span class="prompt-timer-sec ${secs <= 5 ? 'urgent' : ''}" id="promptTimerSec">${secs}s</span>
        </div>
        <div class="prompt-timer-bar">
          <i style="animation-duration:${Math.max(1, remaining)}ms"></i>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------ API
  async function api(path, body) {
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-token': token }, body: body ? JSON.stringify(body) : undefined });
    return r.json().catch(() => ({ error: 'network' }));
  }
  function setUser(u) { user = u; renderUserChip(); renderHome(); }
  async function loadMe() {
    if (!token) return setUser(null);
    const r = await api('/api/me');
    if (r.user) setUser(r.user); else { token = ''; localStorage.removeItem('ek_token'); setUser(null); }
  }

  // ------------------------------------------------------------ socket
  const socket = io({ auth: { token } });
  socket.on('connect', () => {
    if (token) socket.emit('auth', token);
    const saved = JSON.parse(sessionStorage.getItem('ek_room') || 'null');
    if (saved) socket.emit('rejoin', saved);
  });
  socket.on('err', (e) => { toast('⚠️ ' + esc(terr(e)), 'err'); A.sfx('nope'); });
  socket.on('joined', ({ code, playerId, key }) => { sessionStorage.setItem('ek_room', JSON.stringify({ code, playerId, key })); history.replaceState(null, '', '?room=' + code); });
  socket.on('rejoinFailed', () => { sessionStorage.removeItem('ek_room'); });
  socket.on('left', () => { sessionStorage.removeItem('ek_room'); S = null; history.replaceState(null, '', location.pathname); show('home'); });
  socket.on('state', (st) => {
    const prev = S; S = st; timeOffset = st.serverNow - Date.now();
    if (st.me) { const hand = st.me.hand.map(c => c.uid); sel = sel.filter(u => hand.includes(u)); }
    if (prev && ((prev.state === 'LOBBY' && st.state === 'PLAYING') || (prev.state === 'ENDED' && st.state === 'LOBBY'))) {
      closeModal(true);
      if (st.state === 'LOBBY') toast('🔄 ' + (lang === 'th' ? 'กลับสู่ห้องล็อบบี้แล้ว' : 'Returned to Lobby'), 'good');
    }
    render();
  });
  socket.on('fx', onFx);
  socket.on('private', onPrivate);
  socket.on('gameOver', onGameOver);
  socket.on('profile', (u) => setUser(u));
  socket.on('chat', (m) => {
    const html = `<div class="msg"><b>${esc(m.avatar)} ${esc(m.name)}:</b> ${esc(m.text)}</div>`;
    $$('.chat-box').forEach(b => { b.insertAdjacentHTML('beforeend', html); b.scrollTop = b.scrollHeight; });
    if (screen === 'game') floatAt(m.playerId, `<div class="bubble">${esc(m.text)}</div>`, 'chat');
    A.sfx('click');
  });
  socket.on('sticker', ({ playerId, id }) => {
    const st = SHOP.find(s => s.id === id) || FREE_STICKERS.find(s => s.id === id); if (!st) return;
    const lbl = st.label || 'WOOF!';
    floatAt(playerId, `<div class="comic-emote"><b class="ce-tag">${esc(lbl)}</b><span class="ce-ico">${st.icon}</span></div>`, 'sticker');
    A.sfx('sticker');
  });

  // ------------------------------------------------------------ screens
  function show(name) {
    screen = name;
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    document.body.dataset.screen = name;
  }

  function render() {
    if (!S) {
      if (screen !== 'browser') show('home');
      return;
    }
    if (S.state === 'LOBBY') { show('lobby'); renderLobby(); }
    else { show('game'); renderGame(); }
  }

  socket.on('roomsList', (rooms) => {
    if (screen === 'browser') renderRoomBrowser(rooms);
  });

  // ------------------------------------------------------------ BOSS SHIBA MASCOT
  function bossShibaMascotSVG() {
    return `<svg class="boss-mascot-svg" viewBox="0 0 280 340" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="shibaFur" cx="45%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#fb923c"/>
          <stop offset="60%" stop-color="#ea580c"/>
          <stop offset="100%" stop-color="#c2410c"/>
        </radialGradient>
        <linearGradient id="shibaWhite" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#fed7aa"/>
        </linearGradient>
        <linearGradient id="goldChainGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="45%" stop-color="#eab308"/>
          <stop offset="85%" stop-color="#ca8a04"/>
          <stop offset="100%" stop-color="#78350f"/>
        </linearGradient>
        <linearGradient id="shadesGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="50%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
        <filter id="chainGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <path d="M195 230 C235 220, 255 175, 230 155 C212 140, 192 165, 195 185 C197 195, 210 185, 218 175 C225 185, 215 210, 185 225 Z" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="3.5"/>
      <path d="M228 158 C238 168, 232 182, 222 178 Z" fill="#ffffff"/>
      <ellipse cx="112" cy="308" rx="20" ry="14" fill="#fed7aa" stroke="#7c2d12" stroke-width="3"/>
      <ellipse cx="168" cy="308" rx="20" ry="14" fill="#fed7aa" stroke="#7c2d12" stroke-width="3"/>
      <path d="M100 170 C75 190, 75 280, 105 300 C125 306, 155 306, 175 300 C205 280, 205 190, 180 170 Z" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="4"/>
      <path d="M112 178 C95 200, 95 270, 120 292 C132 296, 148 296, 160 292 C185 270, 185 200, 168 178 C155 192, 125 192, 112 178 Z" fill="url(#shibaWhite)"/>
      <path d="M96 185 C68 200, 62 230, 80 252 C88 260, 102 248, 98 238 C90 226, 92 205, 106 195 Z" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="3.5"/>
      <ellipse cx="88" cy="248" rx="10" ry="9" fill="#ffffff" stroke="#7c2d12" stroke-width="2.5"/>
      <path d="M184 185 C212 200, 218 230, 200 252 C192 260, 178 248, 182 238 C190 226, 188 205, 174 195 Z" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="3.5"/>
      <ellipse cx="192" cy="248" rx="10" ry="9" fill="#ffffff" stroke="#7c2d12" stroke-width="2.5"/>
      <path d="M82 92 C72 45, 102 32, 118 64 Z" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="4"/>
      <path d="M90 85 C84 56, 102 48, 112 68 Z" fill="#f472b6"/>
      <path d="M198 92 C208 45, 178 32, 162 64 Z" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="4"/>
      <path d="M190 85 C196 56, 178 48, 168 68 Z" fill="#f472b6"/>
      <ellipse cx="140" cy="115" rx="58" ry="50" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="4"/>
      <path d="M102 118 C90 135, 105 160, 140 160 C175 160, 190 135, 178 118 C166 142, 114 142, 102 118 Z" fill="url(#shibaWhite)"/>
      <ellipse cx="140" cy="132" rx="14" ry="11" fill="#ffffff"/>
      <ellipse cx="140" cy="126" rx="8" ry="6" fill="#0f172a"/>
      <path d="M134 133 C137 137, 140 137, 140 137 C140 137, 143 137, 146 133" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
      <circle cx="118" cy="84" r="5" fill="#ffffff"/>
      <circle cx="162" cy="84" r="5" fill="#ffffff"/>
      <g filter="url(#chainGlow)">
        <path d="M96 95 C94 90, 134 88, 136 96 C137 114, 134 126, 116 126 C98 126, 95 114, 96 95 Z" fill="url(#shadesGrad)" stroke="#fde047" stroke-width="3"/>
        <path d="M144 96 C146 88, 186 90, 184 95 C185 114, 182 126, 164 126 C146 126, 143 114, 144 96 Z" fill="url(#shadesGrad)" stroke="#fde047" stroke-width="3"/>
        <path d="M134 98 C137 95, 143 95, 146 98" stroke="#fde047" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M104 98 L122 96 C124 104, 118 112, 110 114 Z" fill="rgba(255,255,255,0.45)"/>
        <path d="M152 98 L170 96 C172 104, 166 112, 158 114 Z" fill="rgba(255,255,255,0.45)"/>
      </g>
      <g filter="url(#chainGlow)">
        <path d="M106 162 C116 178, 164 178, 174 162" stroke="url(#goldChainGrad)" stroke-width="12" stroke-linecap="round"/>
        <path d="M106 162 C116 178, 164 178, 174 162" stroke="#78350f" stroke-width="2" stroke-linecap="round" stroke-dasharray="6 4"/>
        <ellipse cx="140" cy="172" rx="9" ry="6" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
        <ellipse cx="124" cy="169" rx="8" ry="5.5" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
        <ellipse cx="156" cy="169" rx="8" ry="5.5" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
        <ellipse cx="112" cy="164" rx="7" ry="5" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
        <ellipse cx="168" cy="164" rx="7" ry="5" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
      </g>
    </svg>`;
  }

  // ------------------------------------------------------------ HOME / CASINO LOBBY
  function renderUserChip() {
    const av = $('#pAvatar'), lvl = $('#pLevel'), nm = $('#pName'), xp = $('#pXpFill');
    const coins = $('#topCoins'), dia = $('#topDiamonds'), flags = $('#langFlags');
    if (flags) flags.textContent = lang === 'th' ? '🇹🇭 TH / 🇬🇧 EN' : '🇬🇧 EN / 🇹🇭 TH';
    if (user) {
      if (av) av.textContent = user.avatar || '🐶';
      if (lvl) lvl.textContent = 'LV.' + (user.level || Math.min(99, Math.floor((user.rp || 0) / 40) + 1));
      if (nm) nm.textContent = user.displayName;
      if (xp) xp.style.width = Math.min(100, Math.max(15, (user.rp || 0) % 100)) + '%';
      if (coins) coins.textContent = user.coins;
      if (dia) dia.textContent = user.diamonds || Math.floor((user.rp || 0) / 25) + 15;
    } else {
      if (av) av.textContent = '🐶';
      if (lvl) lvl.textContent = 'LV.1';
      const saved = localStorage.getItem('ek_name');
      if (nm) nm.textContent = saved || (lang === 'th' ? 'ผู้เล่นทั่วไป (เข้าสู่ระบบ)' : 'Guest (Log in)');
      if (xp) xp.style.width = '25%';
      if (coins) coins.textContent = '100';
      if (dia) dia.textContent = '20';
    }
  }

  function renderHome() {
    const stageMascot = $('#stageMascot');
    if (stageMascot && !stageMascot.innerHTML) {
      stageMascot.innerHTML = bossShibaMascotSVG();
    }
  }

  const myName = () => {
    if (user && user.displayName) return user.displayName;
    const saved = localStorage.getItem('ek_name');
    if (saved) return saved;
    const gen = (lang === 'th' ? 'หมาน้อย' : 'Puppy') + Math.floor(Math.random() * 90 + 10);
    localStorage.setItem('ek_name', gen);
    return gen;
  };

  function openMatchBrowser() {
    show('browser');
    setupBrowserScreen();
    socket.emit('listRooms');
    A.sfx('click');
  }

  function setupBrowserScreen() {
    // 1. Populate version selector in sidebar
    const vlist = $('#browserVersionList');
    if (vlist) {
      vlist.innerHTML = Object.entries(VERSIONS).map(([id, v]) => `
        <div class="bver-pill ${id === homeVersion ? 'active' : ''}" data-bv="${id}">
          <span style="font-size:1.3rem;">${v.icon}</span>
          <div style="flex:1;">
            <div>${esc(v.name[lang])}</div>
            <small style="font-size:0.75rem;color:var(--muted);font-weight:normal;">${esc(v.desc[lang])}</small>
          </div>
        </div>
      `).join('');
      $$('#browserVersionList .bver-pill').forEach(b => b.onclick = () => {
        homeVersion = b.dataset.bv;
        localStorage.setItem('ek_ver', homeVersion);
        $$('#browserVersionList .bver-pill').forEach(x => x.classList.toggle('active', x === b));
        A.sfx('select');
      });
    }

    // 2. Direct code join input
    const codeInp = $('#browserCodeInp');
    if (codeInp) {
      codeInp.oninput = (e) => e.target.value = e.target.value.toUpperCase();
      codeInp.onkeydown = (e) => { if (e.key === 'Enter') $('#btnBrowserJoinCode').click(); };
    }
    const btnJoinCode = $('#btnBrowserJoinCode');
    if (btnJoinCode) {
      btnJoinCode.onclick = () => {
        const c = $('#browserCodeInp')?.value.trim();
        if (!c) return toast(lang === 'th' ? 'กรุณาระบุรหัสห้อง 4 หลัก' : 'Enter 4-letter room code', 'err');
        A.sfx('click');
        socket.emit('joinRoom', { code: c, name: myName() });
      };
    }

    // 3. Fast Create submit
    const btnCreate = $('#btnBrowserCreateSubmit');
    if (btnCreate) {
      btnCreate.onclick = () => {
        A.sfx('click');
        socket.emit('createRoom', { name: myName(), settings: { version: homeVersion } });
      };
    }

    // 4. Back button
    const btnBack = $('#btnBrowserBack');
    if (btnBack) {
      btnBack.onclick = () => {
        A.sfx('click');
        show('home');
      };
    }

    // 5. Refresh button
    const btnRef = $('#btnBrowserRefresh');
    if (btnRef) {
      btnRef.onclick = () => {
        A.sfx('select');
        socket.emit('listRooms');
        toast(lang === 'th' ? '🔄 อัปเดตรายการห้องแล้ว' : '🔄 Refreshed rooms list');
      };
    }
  }

  function renderRoomBrowser(rooms = []) {
    const grid = $('#browserRoomGrid');
    const cnt = $('#browserRoomCount');
    if (!grid) return;
    if (cnt) cnt.textContent = `${rooms.length} ${lang === 'th' ? 'ห้อง' : 'rooms'}`;

    if (!rooms.length) {
      grid.innerHTML = `
        <div class="rc-empty">
          <div class="rc-empty-icon">🎪</div>
          <h3 style="color:#fff;margin:0 0 8px 0;font-size:1.3rem;">${lang === 'th' ? 'ยังไม่มีห้องเปิดอยู่ขณะนี้' : 'No active rooms currently'}</h3>
          <p style="margin:0 0 20px 0;font-size:0.95rem;">${lang === 'th' ? 'สร้างห้องคนแรก แล้วชวนเพื่อนหรือบอทมาลุยกันเลย!' : 'Be the first to create a match and invite friends!'}</p>
          <button class="btn big gold pulse" onclick="document.getElementById('btnBrowserCreateSubmit').click()">✨ ${t('createRoom')}</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = rooms.map(r => {
      const v = VERSIONS[r.version] || VERSIONS.original;
      const isLobby = r.state === 'LOBBY';
      return `
        <div class="room-card">
          <div class="rc-top">
            <span class="rc-code">${esc(r.code)}</span>
            <span class="rc-state-pill ${isLobby ? 'lobby' : 'playing'}">
              ${isLobby ? (lang === 'th' ? '🟢 รอในล็อบบี้' : '🟢 In Lobby') : (lang === 'th' ? '🟠 กำลังเล่น' : '🟠 In Game')}
            </span>
          </div>
          <div class="rc-info">
            <div class="rc-host">👑 <b>${esc(r.hostName)}</b></div>
            <div>${v.icon} ${esc(v.name[lang])}</div>
            <div>👥 <b>${r.playerCount} / ${r.maxPlayers}</b> ${lang === 'th' ? 'คน' : 'players'}</div>
          </div>
          <button class="btn big ${isLobby ? 'gold' : 'blue'}" data-rc="${esc(r.code)}" style="margin-top:auto;">
            ${isLobby ? '🚀 ' + t('join') : '👁️ ' + (lang === 'th' ? 'เข้าชม' : 'Spectate')}
          </button>
        </div>
      `;
    }).join('');

    $$('[data-rc]', grid).forEach(b => b.onclick = () => {
      A.sfx('click');
      socket.emit('joinRoom', { code: b.dataset.rc, name: myName() });
    });
  }

  function openPlayFriendsModal() {
    openModal(`<h2>🏠 ${t('playWithFriends')}</h2>
      <div class="panel">
        <label>${t('version')}</label>
        <div class="version-pills" id="modalVersions">
          ${Object.entries(VERSIONS).map(([id, v]) =>
            `<button class="vpill ${id === homeVersion ? 'on' : ''}" data-mv="${id}">${v.icon} ${esc(v.name[lang])}</button>`).join('')}
        </div>
        <button class="btn big gold pulse" id="modalCreateRoom">🚀 ${t('createRoom')}</button>
      </div>`, { cls: 'wide' });
    $$('#modalVersions .vpill').forEach(b => b.onclick = () => {
      homeVersion = b.dataset.mv; localStorage.setItem('ek_ver', homeVersion);
      $$('#modalVersions .vpill').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#modalCreateRoom').onclick = () => {
      closeModal();
      socket.emit('createRoom', { name: myName(), settings: { version: homeVersion } });
    };
  }

  function openCustomBotModal() {
    openModal(`<h2>🤖 ${t('customVsBot')}</h2>
      <div class="panel">
        <label>${t('version')}</label>
        <div class="version-pills" id="botModalVersions">
          ${Object.entries(VERSIONS).map(([id, v]) =>
            `<button class="vpill ${id === homeVersion ? 'on' : ''}" data-bv="${id}">${v.icon} ${esc(v.name[lang])}</button>`).join('')}
        </div>
        <div class="row" style="margin-top:10px;">
          <label style="margin:0;">🐶 ${t('bots')}:</label>
          <select id="modalSelBots" style="width:auto;flex:1;">
            <option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option><option>6</option><option>7</option>
          </select>
        </div>
        <button class="btn big gold pulse" id="modalStartSolo" style="margin-top:14px;">⚔️ ${t('playBots')}</button>
      </div>`, { cls: 'wide' });
    $$('#botModalVersions .vpill').forEach(b => b.onclick = () => {
      homeVersion = b.dataset.bv; localStorage.setItem('ek_ver', homeVersion);
      $$('#botModalVersions .vpill').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#modalStartSolo').onclick = () => {
      const bots = +$('#modalSelBots').value;
      closeModal();
      socket.emit('quickSolo', { name: myName(), bots, settings: { version: homeVersion } });
    };
  }

  function openSettingsModal() {
    openModal(`<h2>⚙️ ${t('settings') || 'การตั้งค่า / Settings'}</h2>
      <div class="menu-list">
        <button class="btn" id="stSound">${A.opt.sound ? '🔊' : '🔇'} ${t('sound')}</button>
        <button class="btn" id="stVoice">${A.opt.voice ? '🗣️' : '🤐'} ${t('voice')}</button>
        <button class="btn" id="stLang">🌐 ${t('lang')}: ${lang.toUpperCase()}</button>
        <button class="btn" id="stRules">📖 ${t('rules')}</button>
        ${user ? `<button class="btn red" id="stLogout">🚪 ${t('logout')}</button>` : `<button class="btn gold" id="stLogin">🔑 ${t('login')}</button>`}
      </div>`);
    $('#stSound').onclick = () => { A.set('sound', !A.opt.sound); syncToggles(); openSettingsModal(); };
    $('#stVoice').onclick = () => { A.set('voice', !A.opt.voice); syncToggles(); openSettingsModal(); };
    $('#stLang').onclick = () => { lang = lang === 'th' ? 'en' : 'th'; localStorage.setItem('ek_lang', lang); lastSettingsKey = ''; applyI18n(); openSettingsModal(); };
    $('#stRules').onclick = openRules;
    if ($('#stLogout')) $('#stLogout').onclick = async () => { await api('/api/logout', {}); token = ''; localStorage.removeItem('ek_token'); socket.emit('auth', ''); setUser(null); closeModal(); };
    if ($('#stLogin')) $('#stLogin').onclick = () => { closeModal(); openAuth('login'); };
  }

  async function handleMailClick() {
    if (!user) return openAuth('login');
    const r = await api('/api/daily', {});
    if (r.error) {
      if (r.error === 'claimed') toast(lang === 'th' ? '🎁 วันนี้คุณรับโบนัสแล้ว พรุ่งนี้มารับใหม่นะโฮ่ง!' : 'Daily bonus already claimed!', 'info');
      else toast('⚠️ ' + terr(r.error), 'err');
      return;
    }
    setUser(r.user); A.sfx('coin'); confetti(true);
    toast(lang === 'th' ? '🎉 รับรางวัลประจำวันสำเร็จ! +100 เหรียญ 🪙' : 'Claimed +100 Coins! 🪙', 'good');
  }

  // Bindings for top bar and main navigation
  const pCard = $('#playerProfileCard'); if (pCard) pCard.onclick = () => openProfile();
  const bMail = $('#btnMail'); if (bMail) bMail.onclick = handleMailClick;
  const bSettings = $('#btnSettings'); if (bSettings) bSettings.onclick = openSettingsModal;

  const bMatch = $('#btnMatchBrowser'); if (bMatch) bMatch.onclick = openMatchBrowser;
  const bTutorial = $('#btnTutorial'); if (bTutorial) bTutorial.onclick = () => openTutorialModal(0);
  const bFriends = $('#btnPlayFriends'); if (bFriends) bFriends.onclick = openPlayFriendsModal;
  const bBot = $('#btnCustomBot'); if (bBot) bBot.onclick = openCustomBotModal;

  const dDeck = $('#dockBtnDeck'); if (dDeck) dDeck.onclick = openRules;
  const dShop = $('#dockBtnShop'); if (dShop) dShop.onclick = () => { shopTab = 'frame'; openShop(); };
  const dRanking = $('#dockBtnRanking'); if (dRanking) dRanking.onclick = openLeaderboard;

  // top toggles
  const syncToggles = () => {
    const s = $('#btnSound'), v = $('#btnVoice');
    if (s) s.textContent = A.opt.sound ? '🔊' : '🔇';
    if (v) v.textContent = A.opt.voice ? '🗣️' : '🤐';
  };
  const btnS = $('#btnSound'); if (btnS) btnS.onclick = () => { A.set('sound', !A.opt.sound); syncToggles(); A.sfx('click'); };
  const btnV = $('#btnVoice'); if (btnV) btnV.onclick = () => { A.set('voice', !A.opt.voice); syncToggles(); if (A.opt.voice) A.say(lang === 'th' ? 'เปิดเสียงพากย์แล้วโฮ่ง' : 'Announcer on, woof', lang); };
  const btnL = $('#btnLang'); if (btnL) btnL.onclick = () => { lang = lang === 'th' ? 'en' : 'th'; localStorage.setItem('ek_lang', lang); lastSettingsKey = ''; applyI18n(); renderUserChip(); };

  // ------------------------------------------------------------ AUTH / PROFILE / SHOP / LEADERBOARD / RULES
  function openAuth(mode) {
    const reg = mode === 'register';
    openModal(`<h2>${reg ? '📝 ' + t('register') : '🔑 ' + t('login')}</h2>
      <form id="authForm" class="form">
        <input name="username" placeholder="${t('username')}" autocomplete="username" required>
        ${reg ? `<input name="displayName" placeholder="${t('displayName')}" maxlength="16">` : ''}
        <input name="password" type="password" placeholder="${t('password')}" autocomplete="${reg ? 'new-password' : 'current-password'}" required>
        <button class="btn big gold">${reg ? t('register') : t('login')}</button>
      </form>
      <a href="#" id="authSwitch">${reg ? t('haveAccount') : t('noAccount')}</a>`);
    $('#authSwitch').onclick = (e) => { e.preventDefault(); openAuth(reg ? 'login' : 'register'); };
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      const r = await api(reg ? '/api/register' : '/api/login', f);
      if (r.error) return toast('⚠️ ' + terr(r.error), 'err');
      token = r.token; localStorage.setItem('ek_token', token); socket.emit('auth', token);
      setUser(r.user); closeModal(); A.sfx('coin'); toast('👋 ' + esc(r.user.displayName));
    };
  }

  const AVATARS = ['🐶', '🐕', '🦮', '🐩', '🐕‍🦺', '🐺', '🦊', '🐾', '🦴', '🌭', '🦝', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🦄', '🐲'];
  function openProfile() {
    if (!user) return openAuth('login');
    const r = rankOf(user.rp), st = user.stats;
    const nextRank = window.EK.RANKS.find(x => x.min > user.rp);
    openModal(`<h2>👤 ${t('profile')}</h2>
      <div class="profile-head">${avatarHTML({ avatar: user.avatar, frame: user.equipped.frame }, 'lg')}
        <div><h3>${esc(user.displayName)} <small>@${esc(user.username)}</small></h3>
        <div class="rank-line">${r.icon} <b>${r.name[lang]}</b> · ${user.rp} RP ${nextRank ? `<div class="bar"><i style="width:${Math.round((user.rp - r.min) / (nextRank.min - r.min) * 100)}%"></i></div><small>→ ${nextRank.icon} ${nextRank.min} RP</small>` : ''}</div>
        <div class="coins big">🪙 ${user.coins}</div></div></div>
      <div class="stat-grid"><div><b>${st.games}</b>${t('games')}</div><div><b>${st.wins}</b>${t('wins')}</div><div><b>${st.games ? Math.round(st.wins / st.games * 100) : 0}%</b>${t('winRate')}</div><div><b>${st.explosions}</b>${t('explosions')}</div><div><b>${st.defuses}</b>${t('defusesStat')}</div></div>
      <h4>${t('displayName')}</h4><div class="row"><input id="pfName" value="${esc(user.displayName)}" maxlength="16"><button class="btn small" id="pfSave">${t('save')}</button></div>
      <h4>${t('avatar')}</h4><div class="avatar-pick">${AVATARS.map(a => `<button class="${a === user.avatar ? 'on' : ''}" data-av="${a}">${a}</button>`).join('')}</div>
      <h4>${t('history')}</h4><div class="history">${(user.history || []).map(h => `<div>#${h.place}/${h.total} · ${VERSIONS[h.version]?.icon || ''} · 🪙+${h.coins} · ${h.rp >= 0 ? '+' : ''}${h.rp} RP</div>`).join('') || '-'}</div>
      <div class="row"><button class="btn small" id="pfShop">🛒 ${t('shop')}</button><button class="btn small red" id="pfLogout">${t('logout')}</button></div>`);
    const save = async (body) => { const r2 = await api('/api/profile', body); if (r2.user) { setUser(r2.user); openProfile(); } };
    $('#pfSave').onclick = () => save({ displayName: $('#pfName').value });
    $$('.avatar-pick button').forEach(b => b.onclick = () => save({ avatar: b.dataset.av }));
    $('#pfShop').onclick = openShop;
    $('#pfLogout').onclick = async () => { await api('/api/logout', {}); token = ''; localStorage.removeItem('ek_token'); socket.emit('auth', ''); setUser(null); closeModal(); };
  }

  let shopTab = 'frame';
  function openShop() {
    const inv = user ? user.inventory : [];
    const tabs = [['frame', '🖼️ ' + t('frames')], ['skin', '🎴 ' + t('skins')], ['sticker', '🐶 ' + t('stickers')]];
    const items = SHOP.filter(i => i.type === shopTab).map(i => {
      const owned = inv.includes(i.id); const eq = user && user.equipped[i.type] === i.id;
      const preview = i.type === 'frame' ? avatarHTML({ avatar: user?.avatar || '🐶', frame: i.id }, 'lg') : i.type === 'skin' ? backHTML(i.id, 'style="width:70px;height:98px"') : `<div class="sticker-big">${i.icon}</div>`;
      let btn;
      if (!owned) btn = `<button class="btn small gold" data-buy="${i.id}">🪙 ${i.price}</button>`;
      else if (i.type === 'sticker') btn = `<span class="tag">${t('owned')}</span>`;
      else btn = `<button class="btn small ${eq ? '' : 'green'}" data-equip="${eq ? '' : i.id}" data-type="${i.type}">${eq ? t('unequip') : t('equip')}</button>`;
      return `<div class="shop-item ${owned ? 'owned' : ''}">${preview}<div>${i.icon} ${esc(i.name[lang])}</div>${btn}</div>`;
    }).join('');
    openModal(`<h2>🛒 ${t('shop')} ${user ? `<span class="coins">🪙 ${user.coins}</span>` : ''}</h2>
      ${user ? `<button class="btn small gold" id="btnDaily">🎁 ${t('daily')}</button>` : `<p class="note">${t('loginFirst')}</p>`}
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${k === shopTab ? 'active' : ''}" data-st="${k}">${l}</button>`).join('')}</div>
      <div class="shop-grid">${items}</div>`, { cls: 'wide' });
    $$('[data-st]').forEach(b => b.onclick = () => { shopTab = b.dataset.st; openShop(); });
    const d = $('#btnDaily'); if (d) d.onclick = async () => { const r = await api('/api/daily', {}); if (r.error) return toast(terr(r.error), 'err'); setUser(r.user); A.sfx('coin'); confetti(true); openShop(); };
    $$('[data-buy]').forEach(b => b.onclick = async () => {
      if (!user) return openAuth('login');
      const r = await api('/api/buy', { itemId: b.dataset.buy }); if (r.error) return toast('⚠️ ' + terr(r.error), 'err');
      setUser(r.user); A.sfx('coin'); confetti(true); openShop();
    });
    $$('[data-equip]').forEach(b => b.onclick = async () => { const r = await api('/api/equip', { itemId: b.dataset.equip, type: b.dataset.type }); if (r.user) { setUser(r.user); A.sfx('select'); openShop(); } });
  }

  async function openLeaderboard() {
    const r = await api('/api/leaderboard');
    openModal(`<h2>🏆 ${t('leaderboard')}</h2><div class="lb">${(r.list || []).map((u, i) => {
      const rk = rankOf(u.rp);
      return `<div class="lb-row ${i < 3 ? 'top' + (i + 1) : ''}"><b>${i < 3 ? ['🥇', '🥈', '🥉'][i] : '#' + (i + 1)}</b>${avatarHTML({ avatar: u.avatar, frame: u.frame }, 'xs')}<span>${esc(u.displayName)}</span><span>${rk.icon} ${u.rp} RP</span><small>${u.wins}/${u.games}</small></div>`;
    }).join('') || '-'}</div>`);
  }

  // ------------------------------------------------------------ TUTORIAL / PUPPY ACADEMY (โหมดสอนเล่นแบบ Interactive)
  function openTutorialModal(startChapter = 0) {
    let curChapter = startChapter;
    let trialState = {};

    function renderChapter(ch) {
      curChapter = ch;
      trialState = {};
      const modalBody = $('#academyModalBody');
      if (!modalBody) return;

      $$('.academy-tab-btn').forEach((b, i) => b.classList.toggle('active', i === ch));

      if (ch === 0) {
        // บทที่ 1: การเอาชีวิตรอด & กู้ระเบิด (Defuse & Survival)
        trialState = { phase: 'ready' };
        modalBody.innerHTML = `
          <p class="academy-desc">
            ${lang === 'th'
              ? '<b>กฎเหล็กข้อสำคัญที่สุด:</b> ในแต่ละเทิร์น ผู้เล่นจะต้อง <b>"จั่วการ์ด"</b> เพื่อจบเทิร์น แต่ถ้าดวงซวยเปิดได้ <span style="color:#ef4444;font-weight:900;">💣 หมาระเบิด (Exploding Puppy)</span> คุณจะระเบิดตกรอบทันที! ทางรอดเดียวคือคุณต้องมี <span style="color:#22c55e;font-weight:900;">🛠️ การ์ดกู้ระเบิด (Defuse)</span> โยนกระดูกหลอกล่อเพื่อช่วยชีวิต'
              : '<b>The Golden Rule:</b> On each turn, you must <b>"Draw a Card"</b> to end your turn. But if you draw an <span style="color:#ef4444;font-weight:900;">💣 Exploding Puppy</span>, you explode and lose immediately! The only savior is a <span style="color:#22c55e;font-weight:900;">🛠️ Defuse</span> card to disarm the bomb!'}
          </p>
          <div class="academy-trial-box">
            <div class="academy-trial-title">🧪 ${lang === 'th' ? 'บททดสอบจำลอง: ลองจั่วการ์ดและกู้ระเบิด' : 'Interactive Trial: Draw & Defuse'}</div>
            <div id="trialArena1" class="academy-trial-arena">
              <div id="trialDeckWrap" style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div class="card back" style="width:100px;height:140px;cursor:pointer;animation:pulse 2s infinite;" id="trialDrawDeck"></div>
                <button class="btn gold" id="trialBtnDraw">👆 ${lang === 'th' ? 'แตะจั่วการ์ดจากกอง' : 'Tap to Draw Card'}</button>
              </div>
              <div style="font-size:1.8rem;color:var(--gold);">➔</div>
              <div id="trialHandWrap" style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div id="trialDefuseCard" style="transform:scale(0.95);">${cardHTML('defuse')}</div>
                <small style="color:#cbd5e1;font-weight:700;">${lang === 'th' ? 'การ์ดในมือคุณ (Defuse)' : 'Your Hand (Defuse)'}</small>
              </div>
            </div>
            <div id="trialFeedback1" style="min-height:36px;font-weight:700;color:#94a3b8;font-size:1rem;">
              ${lang === 'th' ? '👉 แตะที่กองการ์ดเพื่อลองจั่วการ์ดใบแรกของคุณ...' : '👉 Tap the draw deck to draw your first card...'}
            </div>
            <div id="trialNextWrap1" class="hidden" style="margin-top:8px;">
              <button class="btn big green pulse" id="trialNext1">
                ${lang === 'th' ? 'ผ่านบทเรียนแล้ว! ไปบทที่ 2 ➔' : 'Lesson Completed! Go to Lesson 2 ➔'}
              </button>
            </div>
          </div>
        `;

        const doDrawTrial = () => {
          if (trialState.phase !== 'ready') return;
          trialState.phase = 'drawn';
          A.sfx('alarm');
          A.playHeartbeat(140);
          flash('rgba(239,68,68,.55)', true);
          $('#trialDrawDeck').parentElement.innerHTML = `
            <div style="transform:scale(1.05);animation:shake .4s infinite alternate;">${cardHTML('exploding_kitten')}</div>
            <span style="color:#ef4444;font-weight:900;">🚨 BOMB DRAWN!</span>
          `;
          $('#trialFeedback1').innerHTML = `
            <span style="color:#ef4444;font-size:1.1rem;animation:bounce .4s infinite alternate;display:inline-block;">💣</span>
            <span style="color:#ef4444;font-size:1.05rem;">${lang === 'th' ? 'ระวัง! คุณจั่วได้หมาระเบิด! รีบคลิกที่การ์ด 🛠️ Defuse ด้านขวาเพื่อกู้ระเบิด!' : 'Warning! You drew a Bomb! Quickly tap the 🛠️ Defuse card to save yourself!'}</span>
          `;
          const defEl = $('#trialDefuseCard');
          defEl.style.cursor = 'pointer';
          defEl.style.boxShadow = '0 0 25px #22c55e';
          defEl.style.animation = 'pulse .7s infinite alternate';
          defEl.onclick = doDefuseTrial;
        };

        const doDefuseTrial = () => {
          if (trialState.phase !== 'drawn') return;
          trialState.phase = 'defused';
          A.stopHeartbeat();
          A.sfx('defuse');
          flash('rgba(34,197,94,.4)');
          showDefuseStamp(myName());
          showCardSpotlight('defuse', 'defuse', myName());
          confetti();

          $('#trialFeedback1').innerHTML = `
            <span style="color:#34d399;font-size:1.1rem;">🎉 ${lang === 'th' ? 'กู้ระเบิดสำเร็จ! ตอนนี้เลือกตำแหน่งซ่อนระเบิดคืนเข้ากอง:' : 'Defused! Now pick where to bury the bomb back:'}</span>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap;">
              <button class="btn gold" id="buryTop">🔝 ${lang === 'th' ? 'วางบนสุด (ดักคนถัดไป!)' : 'Top (Trap next player!)'}</button>
              <button class="btn" id="buryMid">🔢 ${lang === 'th' ? 'วางลำดับที่ 2' : 'Position #2'}</button>
              <button class="btn blue" id="buryBot">⬇️ ${lang === 'th' ? 'วางล่างสุด' : 'Bottom'}</button>
            </div>
          `;

          const onPickBury = (posName) => {
            A.sfx('click');
            $('#trialFeedback1').innerHTML = `
              <span style="color:#fde047;font-size:1.1rem;">✨ ${lang === 'th' ? `คุณซ่อนระเบิดไว้ที่ "${posName}" เรียบร้อยแล้ว! ใครจั่วโดนเตรียมตกรอบ!` : `Bomb safely hidden at "${posName}"! Next victim is doomed!`}</span>
            `;
            $('#trialNextWrap1').classList.remove('hidden');
            $('#trialNext1').onclick = () => renderChapter(1);
          };

          $('#buryTop').onclick = () => onPickBury(lang === 'th' ? 'บนสุด' : 'Top');
          $('#buryMid').onclick = () => onPickBury(lang === 'th' ? 'ลำดับที่ 2' : '#2');
          $('#buryBot').onclick = () => onPickBury(lang === 'th' ? 'ล่างสุด' : 'Bottom');
        };

        $('#trialBtnDraw').onclick = doDrawTrial;
        $('#trialDrawDeck').onclick = doDrawTrial;
      }
      else if (ch === 1) {
        // บทที่ 2: การหลบหลีก & โจมตี (Skip & Attack)
        trialState = { phase: 'ready' };
        modalBody.innerHTML = `
          <p class="academy-desc">
            ${lang === 'th'
              ? '<b>เมื่อรู้ว่ามีระเบิดบนกอง อย่าเพิ่งจั่ว!</b> ใช้การ์ด <span style="color:#3b82f6;font-weight:900;">⏭️ Skip (ชิ่งหนี)</span> เพื่อจบเทิร์นทันทีโดยไม่ต้องเสี่ยงจั่วการ์ด หรือใช้การ์ด <span style="color:#ef4444;font-weight:900;">⚡ Attack (โจมตี)</span> เพื่อโยนบาปให้เพื่อนรับเคราะห์ ต้องเล่น 2 เทิร์นรวด!'
              : '<b>When you know a bomb is waiting, don’t draw!</b> Play <span style="color:#3b82f6;font-weight:900;">⏭️ Skip</span> to end your turn without drawing, or play <span style="color:#ef4444;font-weight:900;">⚡ Attack</span> to pass the bomb threat and force your rival to take 2 consecutive turns!'}
          </p>
          <div class="academy-trial-box">
            <div class="academy-trial-title">🧪 ${lang === 'th' ? 'สถานการณ์จำลอง: บนกองมีระเบิด 100%!' : 'Interactive Trial: Dangerous Deck Ahead!'}</div>
            <div class="academy-trial-arena" style="flex-direction:column;">
              <div style="display:flex;align-items:center;gap:20px;justify-content:center;">
                <div style="background:rgba(239,68,68,0.2);border:2px dashed #ef4444;padding:10px 16px;border-radius:12px;text-align:center;">
                  <div style="font-size:2rem;">💣</div>
                  <small style="color:#ef4444;font-weight:800;">${lang === 'th' ? 'การ์ดบนสุดคือระเบิด!' : 'Top card is BOMB!'}</small>
                </div>
                <div style="font-size:2rem;color:var(--gold);">⚔️</div>
                <div id="trialBotBox" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);padding:10px 16px;border-radius:12px;text-align:center;">
                  <div style="font-size:2rem;">🤖</div>
                  <b style="color:#fff;">บ็อบ (บอทคู่แข่ง)</b>
                  <div style="font-size:0.8rem;color:#94a3b8;">${lang === 'th' ? 'ไม่มี Defuse!' : 'No Defuse!'}</div>
                </div>
              </div>
              <div style="margin-top:12px;display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
                <div id="trialSkipCard" style="cursor:pointer;transform:scale(0.95);transition:transform .2s;" title="Skip">${cardHTML('skip')}</div>
                <div id="trialAttackCard" style="cursor:pointer;transform:scale(0.95);transition:transform .2s;" title="Attack">${cardHTML('attack')}</div>
              </div>
            </div>
            <div id="trialFeedback2" style="min-height:36px;font-weight:700;color:#94a3b8;font-size:1rem;">
              ${lang === 'th' ? '👉 เลือกลองเล่นการ์ด Skip หรือ Attack ด้านบนเพื่อดูผลลัพธ์...' : '👉 Click Skip or Attack above to test their effect...'}
            </div>
            <div id="trialNextWrap2" class="hidden" style="margin-top:8px;">
              <button class="btn big green pulse" id="trialNext2">
                ${lang === 'th' ? 'ผ่านบทเรียนแล้ว! ไปบทที่ 3 ➔' : 'Lesson Completed! Go to Lesson 3 ➔'}
              </button>
            </div>
          </div>
        `;

        $('#trialSkipCard').onclick = () => {
          A.sfx('play');
          showCardSpotlight('skip', 'skip', myName());
          $('#trialFeedback2').innerHTML = `<span style="color:#38bdf8;font-size:1.1rem;">⏭️ ${lang === 'th' ? 'คุณชิ่งหนีสำเร็จ! รอดตายหวุดหวิดโดยไม่ต้องจั่วการ์ด!' : 'You skipped safely! Avoided drawing the bomb!'}</span>`;
          $('#trialNextWrap2').classList.remove('hidden');
          $('#trialNext2').onclick = () => renderChapter(2);
        };

        $('#trialAttackCard').onclick = () => {
          A.sfx('attack');
          showCardSpotlight('attack', 'attack', myName(), 'บ็อบ');
          setTimeout(() => {
            A.sfx('boom');
            flash('rgba(255,100,0,.6)', true);
            $('#trialBotBox').innerHTML = `<div style="font-size:2rem;">💥</div><b style="color:#ef4444;">บ็อบ ระเบิดตกรอบ!</b>`;
            confetti();
            $('#trialFeedback2').innerHTML = `<span style="color:#fde047;font-size:1.1rem;">⚡ ${lang === 'th' ? 'บ็อบโดนบังคับเล่น 2 เทิร์น จั่วโดนระเบิดตูม! คุณกำจัดคู่แข่งสำเร็จ!' : 'Bob was forced to take 2 turns and exploded! Enemy eliminated!'}</span>`;
            $('#trialNextWrap2').classList.remove('hidden');
            $('#trialNext2').onclick = () => renderChapter(2);
          }, 800);
        };
      }
      else if (ch === 2) {
        // บทที่ 3: จมูกทิพย์ & ล่วงรู้อนาคต (Super Snout & Future Sight)
        modalBody.innerHTML = `
          <p class="academy-desc">
            ${lang === 'th'
              ? '<b>ชัยชนะมาจากข้อมูลข่าวกรอง!</b> การ์ด <span style="color:#a855f7;font-weight:900;">🔮 See the Future (ดมกลิ่นอนาคต)</span> ใช้แอบดูการ์ด 3 ใบบนสุด, <span style="color:#ec4899;font-weight:900;">🪄 Alter the Future</span> ดูแล้วสลับเรียงใหม่ตามใจชอบ และ <span style="color:#06b6d4;font-weight:900;">🧿 Clairvoyance (จมูกทิพย์)</span> สแกนเรดาร์บอกตำแหน่งหมาระเบิดในกองทันที!'
              : '<b>Intel wins the game!</b> <span style="color:#a855f7;font-weight:900;">🔮 See the Future</span> peeks at the top 3 cards, <span style="color:#ec4899;font-weight:900;">🪄 Alter the Future</span> lets you rearrange them, and <span style="color:#06b6d4;font-weight:900;">🧿 Super Snout (Clairvoyance)</span> sniffs out the exact bomb position!'}
          </p>
          <div class="academy-trial-box">
            <div class="academy-trial-title">🧪 ${lang === 'th' ? 'ทดสอบพลังแห่งการหยั่งรู้' : 'Interactive Trial: Espionage Powers'}</div>
            <div class="academy-trial-arena" style="flex-direction:column;gap:12px;">
              <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
                <div id="trialSeeFuture" style="cursor:pointer;transform:scale(0.95);" title="See Future">${cardHTML('see_the_future')}</div>
                <div id="trialClairvoyance" style="cursor:pointer;transform:scale(0.95);" title="Clairvoyance">${cardHTML('clairvoyance')}</div>
              </div>
              <div id="trialFutureDisplay" style="min-height:90px;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;">
                <small style="color:#64748b;">${lang === 'th' ? 'คลิกการ์ดด้านบนเพื่อเริ่มการสแกนกองจั่ว...' : 'Click a card above to inspect the deck...'}</small>
              </div>
            </div>
            <div id="trialFeedback3" style="min-height:36px;font-weight:700;color:#94a3b8;font-size:1rem;">
              ${lang === 'th' ? '👉 แตะเลือกการ์ดหยั่งรู้ที่คุณสนใจ...' : '👉 Tap a future sight card to test...'}
            </div>
            <div id="trialNextWrap3" class="hidden" style="margin-top:8px;">
              <button class="btn big green pulse" id="trialNext3">
                ${lang === 'th' ? 'ผ่านบทเรียนแล้ว! ไปบทที่ 4 ➔' : 'Lesson Completed! Go to Lesson 4 ➔'}
              </button>
            </div>
          </div>
        `;

        $('#trialSeeFuture').onclick = () => {
          A.sfx('play');
          showCardSpotlight('see_the_future', 'see_the_future', myName());
          $('#trialFutureDisplay').innerHTML = `
            <div style="display:flex;gap:10px;animation:popBounce .3s ease-out;">
              <div style="text-align:center;"><small style="color:#ef4444;font-weight:800;">1. ${lang === 'th' ? 'บนสุด' : 'Top'}</small><br>${cardHTML('exploding_kitten', { cls: 'mini' })}</div>
              <div style="text-align:center;"><small style="color:#cbd5e1;font-weight:700;">2. ${lang === 'th' ? 'ใบที่ 2' : '#2'}</small><br>${cardHTML('shuffle', { cls: 'mini' })}</div>
              <div style="text-align:center;"><small style="color:#cbd5e1;font-weight:700;">3. ${lang === 'th' ? 'ใบที่ 3' : '#3'}</small><br>${cardHTML('skip', { cls: 'mini' })}</div>
            </div>
          `;
          $('#trialFeedback3').innerHTML = `<span style="color:#c084fc;font-size:1.05rem;">🔮 ${lang === 'th' ? 'คุณรู้แล้วว่าใบที่ 1 คือระเบิด! ดังนั้นเทิร์นนี้ห้ามกดจั่วเด็ดขาด!' : 'You discovered card #1 is a bomb! Never draw now!'}</span>`;
          $('#trialNextWrap3').classList.remove('hidden');
          $('#trialNext3').onclick = () => renderChapter(3);
        };

        $('#trialClairvoyance').onclick = () => {
          A.sfx('play');
          showCardSpotlight('clairvoyance', 'clairvoyance', myName());
          $('#trialFutureDisplay').innerHTML = `
            <div style="background:rgba(6,182,212,0.2);border:2px solid #06b6d4;padding:12px 24px;border-radius:16px;text-align:center;animation:popBounce .3s;">
              <div style="font-size:2.2rem;animation:pulse .5s infinite alternate;">🧿</div>
              <b style="color:#38bdf8;font-size:1.2rem;">${lang === 'th' ? 'จมูกทิพย์ตรวจพบ: หมาระเบิดอยู่ที่ตำแหน่ง #1 (บนสุดของกอง)!' : 'Super Snout Radar: Exploding Puppy located at position #1 (Top)!'}</b>
            </div>
          `;
          $('#trialFeedback3').innerHTML = `<span style="color:#38bdf8;font-size:1.05rem;">🧿 ${lang === 'th' ? 'เรดาร์สแกนจับกลิ่นระเบิดได้ 100%! เตรียมใช้การ์ดหลบหนี!' : 'Radar sniffed the bomb with 100% accuracy!'}</span>`;
          $('#trialNextWrap3').classList.remove('hidden');
          $('#trialNext3').onclick = () => renderChapter(3);
        };
      }
      else if (ch === 3) {
        // บทที่ 4: ขโมยการ์ด & การ์ดหยุดโลก NOPE! (Combos & Nope)
        modalBody.innerHTML = `
          <p class="academy-desc">
            ${lang === 'th'
              ? '<b>เล่นการ์ดหมาคู่ 2 ใบ</b> เพื่อสุ่มขโมยการ์ดเพื่อน, <b>หมาตอง 3 ใบ</b> เพื่อระบุชื่อการ์ดที่จะขโมย (เช่น ขโมย Defuse ของเพื่อน!) และเมื่อเพื่อนจะทำร้ายคุณ หรือเล่นการ์ดที่คุณไม่ชอบ จงใช้ <span style="color:#ef4444;font-weight:900;">🛑 NOPE! (ไม่!)</span> เพื่อยกเลิกแอคชันนั้นทันที!'
              : '<b>Play a Pair of 2 cats</b> to steal a random card, <b>3-of-a-Kind</b> to demand a specific card (steal their Defuse!), and whenever an enemy attacks or plays an action you hate, slam down <span style="color:#ef4444;font-weight:900;">🛑 NOPE!</span> to deny it immediately!'}
          </p>
          <div class="academy-trial-box">
            <div class="academy-trial-title">🧪 ${lang === 'th' ? 'สถานการณ์จำลอง: บ็อบกำลังจะขโมยการ์ดของคุณ!' : 'Interactive Trial: Bob is trying to rob you!'}</div>
            <div class="academy-trial-arena" style="flex-direction:column;gap:12px;">
              <div style="background:rgba(239,68,68,0.18);border:1.5px solid #ef4444;border-radius:14px;padding:12px 18px;display:flex;align-items:center;gap:14px;width:100%;max-width:440px;">
                <div style="font-size:2rem;">🤖</div>
                <div style="flex:1;text-align:left;">
                  <b style="color:#fff;">บ็อบ กำลังเล่น: 🎁 ทำตาแป๋วขอไพ่ (Favor)</b>
                  <div style="font-size:0.85rem;color:#fca5a5;">${lang === 'th' ? 'บ็อบกำลังบังคับให้คุณมอบการ์ดให้!' : 'Bob is forcing you to give him a card!'}</div>
                  <div style="height:6px;background:rgba(255,255,255,0.2);border-radius:3px;margin-top:6px;overflow:hidden;">
                    <div style="height:100%;width:70%;background:#ef4444;animation:pulse .5s infinite alternate;"></div>
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:6px;">
                <button class="btn big red pulse" id="trialBtnNope" style="font-size:1.15rem;">
                  🛑 ${lang === 'th' ? 'กด NOPE! สกัดกั้นทันที!' : 'Slam NOPE! Cancel Action'}
                </button>
                <button class="btn big gold" id="trialBtnCombo" style="font-size:1.15rem;">
                  🌭🌭🌭 ${lang === 'th' ? 'เล่นตอง 3 ใบ ขโมย Defuse คืน!' : 'Triple Combo: Steal His Defuse!'}
                </button>
              </div>
            </div>
            <div id="trialFeedback4" style="min-height:36px;font-weight:700;color:#94a3b8;font-size:1rem;">
              ${lang === 'th' ? '👉 ตัดสินใจรับมือกับบ็อบโดยเลือกปุ่มด้านบน...' : '👉 Choose how to counter Bob above...'}
            </div>
            <div id="trialNextWrap4" class="hidden" style="margin-top:8px;">
              <button class="btn big green pulse" id="trialNext4">
                ${lang === 'th' ? 'ผ่านบทเรียนแล้ว! ไปบทสุดท้าย ➔' : 'Lesson Completed! Go to Final Lesson ➔'}
              </button>
            </div>
          </div>
        `;

        $('#trialBtnNope').onclick = () => {
          A.sfx('slam');
          showNopeStamp(myName());
          showCardSpotlight('nope', 'nope', myName());
          $('#trialFeedback4').innerHTML = `<span style="color:#f87171;font-size:1.1rem;">🛑 ${lang === 'th' ? 'NOPE! ปฏิเสธสำเร็จ! แอคชันของบ็อบถูกยกเลิกเป็นโมฆะทันที!' : 'NOPE! Bob’s action has been denied and cancelled!'}</span>`;
          $('#trialNextWrap4').classList.remove('hidden');
          $('#trialNext4').onclick = () => renderChapter(4);
        };

        $('#trialBtnCombo').onclick = () => {
          A.sfx('play');
          showCardSpotlight('triple', 'triple', myName(), 'บ็อบ', 'defuse');
          setTimeout(() => {
            A.sfx('win');
            confetti();
            $('#trialFeedback4').innerHTML = `<span style="color:#fde047;font-size:1.1rem;">🌭🌭🌭 ${lang === 'th' ? 'คอมโบตอง 3 ใบสำเร็จ! คุณระบุชื่อขอ "Defuse" และคาบการ์ดกู้ระเบิดมาจากบ็อบได้สำเร็จ!' : '3-of-a-kind success! You demanded and stole Bob’s Defuse!'}</span>`;
            $('#trialNextWrap4').classList.remove('hidden');
            $('#trialNext4').onclick = () => renderChapter(4);
          }, 600);
        };
      }
      else if (ch === 4) {
        // บทที่ 5: สนามประลองจริง 1v1 (Duel Practice Match)
        modalBody.innerHTML = `
          <div style="text-align:center;padding:10px 0;">
            <div style="font-size:4rem;animation:bounce .6s infinite alternate;">🎓🏆</div>
            <h3 style="color:#34d399;font-size:1.7rem;margin:8px 0;">
              ${lang === 'th' ? 'ยินดีด้วย! คุณสำเร็จการศึกษาจากโรงเรียนหมาระเบิดแล้ว!' : 'Congratulations! You Graduated from Puppy Academy!'}
            </h3>
            <p style="color:#cbd5e1;font-size:1.1rem;max-width:520px;margin:10px auto;line-height:1.5;">
              ${lang === 'th'
                ? 'คุณได้เรียนรู้เทคนิคการกู้ระเบิด การโจมตี การส่องดูอนาคต และคอมโบหยุดโลกเรียบร้อยแล้ว พร้อมที่จะทดสอบฝีมือในสนามแข่งขันจริงหรือยัง?'
                : 'You have mastered defusing, attacks, future intel, combos, and Nope! Are you ready to prove your skills in a real match?'}
            </p>
            <div style="margin-top:24px;display:flex;flex-direction:column;gap:12px;align-items:center;">
              <button class="btn big gold pulse" id="btnStartDuelPractice" style="font-size:1.25rem;padding:16px 36px;border-radius:18px;">
                ⚔️ ${lang === 'th' ? 'เริ่มแมตช์ซ้อมเดี่ยว 1v1 กับบอททันที' : 'Start 1v1 Bot Practice Match Now'}
              </button>
              <button class="btn" id="btnCloseAcademy" style="background:rgba(255,255,255,0.1);color:#cbd5e1;">
                ${lang === 'th' ? 'ไว้คราวหน้า / กลับหน้าหลัก' : 'Maybe Later / Back to Home'}
              </button>
            </div>
          </div>
        `;

        $('#btnStartDuelPractice').onclick = () => {
          closeModal();
          A.sfx('win');
          toast(lang === 'th' ? '🎮 กำลังเข้าสู่แมตช์ซ้อม 1v1...' : 'Entering 1v1 practice match...', 'good');
          socket.emit('quickSolo', { name: myName(), bots: 1, settings: { version: homeVersion || 'original' } });
        };

        $('#btnCloseAcademy').onclick = () => closeModal();
      }
    }

    const modalHTML = `
      <div class="academy-modal">
        <div class="academy-header">
          <h2>🎓 ${lang === 'th' ? 'โรงเรียนหมาระเบิด (Puppy Academy)' : 'Puppy Academy (Tutorial)'}</h2>
          <button class="btn" id="btnAcademyClose" style="padding:4px 12px;font-size:0.9rem;">✕ ${t('close')}</button>
        </div>
        <div class="academy-tabs">
          <button class="academy-tab-btn" data-ch="0">1. 🛠️ ${lang === 'th' ? 'กู้ระเบิด' : 'Defuse'}</button>
          <button class="academy-tab-btn" data-ch="1">2. ⚡ ${lang === 'th' ? 'ชิ่ง & โจมตี' : 'Escapes'}</button>
          <button class="academy-tab-btn" data-ch="2">3. 🔮 ${lang === 'th' ? 'จมูกทิพย์' : 'Future Sight'}</button>
          <button class="academy-tab-btn" data-ch="3">4. 🛑 ${lang === 'th' ? 'คอมโบ & NOPE' : 'Combos & Nope'}</button>
          <button class="academy-tab-btn" data-ch="4">5. ⚔️ ${lang === 'th' ? 'ประลองจริง' : 'Duel Practice'}</button>
        </div>
        <div class="academy-content" id="academyModalBody">
          <!-- Dynamic chapter content renders here -->
        </div>
      </div>
    `;

    openModal(modalHTML, { cls: 'wide' });
    $('#btnAcademyClose').onclick = () => closeModal();
    $$('.academy-tab-btn').forEach(b => b.onclick = () => {
      A.sfx('click');
      renderChapter(+b.dataset.ch);
    });
    renderChapter(startChapter);
  }

  function openRules() {
    const vers = Object.entries(VERSIONS).map(([id, v]) => `<div class="ver-card"><h4>${v.icon} ${esc(v.name[lang])}</h4><p>${esc(v.desc[lang])}</p></div>`).join('');
    const all = Object.keys(CARDS).map(id => `<div class="gallery-item">${cardHTML(id)}<p><b>${esc(cname(id))}</b><br>${esc(cdesc(id))}</p></div>`).join('');
    openModal(`<h2>📖 ${t('howTo')}</h2><p>${t('howToText')}</p><h3>${t('versions')}</h3><div class="ver-grid">${vers}</div><h3>${t('allCards')}</h3><div class="gallery">${all}</div>`, { cls: 'wide' });
  }

  function openCardDetail(id) {
    openModal(`<div class="card-detail">${cardHTML(id, { cls: 'xl' })}<div><h2>${CARDS[id].icon} ${esc(cname(id))}</h2><p>${esc(cdesc(id))}</p></div></div>`);
  }

  // ------------------------------------------------------------ LOBBY
  function renderLobby() {
    const m = me(); const isHost = m && m.isHost;
    $('#lobbyCode').textContent = S.code;
    $('#lobbyCount').textContent = `(${S.players.length}/${S.settings.maxPlayers})`;
    $('#lobbyPlayers').innerHTML = S.players.map(p => `
      <div class="lp ${p.ready ? 'ready' : ''} ${p.id === S.me.id ? 'me' : ''}">
        ${avatarHTML(p)}<div class="lp-name">${esc(p.name)} ${p.registered ? rankBadge(p.rp) : ''}
        <small>${p.isHost ? '👑 ' + t('host') : p.isBot ? '🤖 ' + t('bot') : ''}</small></div>
        <span class="lp-status">${p.ready ? '✅ ' + t('ready') : '⏳ ' + t('notReady')}</span>
        ${isHost && p.isBot ? `<button class="x" data-rm="${p.id}">✕</button>` : ''}
      </div>`).join('');
    $$('[data-rm]').forEach(b => b.onclick = () => socket.emit('removeBot', { botId: b.dataset.rm }));
    $('#btnAddBot').style.display = isHost ? '' : 'none';
    const allReady = S.players.every(p => p.ready) && S.players.length >= 2;
    $('#btnStart').style.display = isHost ? '' : 'none';
    $('#btnStart').disabled = !allReady;
    $('#btnReady').style.display = isHost ? 'none' : '';
    $('#btnReady').textContent = m && m.ready ? '↩️ ' + t('cancelReady') : '✅ ' + t('imReady');
    $('#btnReady').classList.toggle('pulse', !(m && m.ready));
    $('#lobbyHint').textContent = isHost ? (allReady ? '' : (S.players.length < 2 ? terr('need_players') : t('needReady'))) : t('waitingHost');
    renderSettings(isHost);
  }

  function renderSettings(isHost) {
    const st = S.settings; const key = JSON.stringify([st, isHost, lang]);
    if (key === lastSettingsKey) return; lastSettingsKey = key;
    const dis = isHost ? '' : 'disabled';
    const counts = st.custom ? st.counts : VERSIONS[st.version].counts;
    const opt = (vals, cur, fmt) => vals.map(v => `<option value="${v}" ${v == cur ? 'selected' : ''}>${fmt(v)}</option>`).join('');
    $('#lobbySettings').innerHTML = `
      <div class="ver-grid small">${Object.entries(VERSIONS).map(([id, v]) => `<button class="ver-card ${id === st.version ? 'on' : ''}" data-v="${id}" ${dis}><h4>${v.icon} ${esc(v.name[lang])}</h4><p>${esc(v.desc[lang])}</p></button>`).join('')}</div>
      <div class="set-row"><label>⏱️ ${t('turnTimer')}</label><select data-s="turnSeconds" ${dis}>${opt([15, 20, 25, 30, 45, 60], st.turnSeconds || 25, v => v + ' ' + t('sec'))}</select></div>
      <div class="set-row"><label>🛑 ${t('nopeTime')}</label><select data-s="nopeSeconds" ${dis}>${opt([2, 3, 4, 5, 6, 8], st.nopeSeconds, v => v + ' ' + t('sec'))}</select></div>
      <div class="set-row"><label>🤖 ${t('botLevel')}</label><select data-s="botLevel" ${dis}>${opt(['easy', 'normal', 'hard'], st.botLevel, v => t(v))}</select></div>
      <div class="set-row"><label>🧩 ${t('customMode')}</label><input type="checkbox" data-s="custom" ${st.custom ? 'checked' : ''} ${dis}></div>
      ${st.custom ? `<div class="set-row"><label>🌀 ${t('imploding')}</label><input type="checkbox" data-s="imploding" ${(st.imploding ?? VERSIONS[st.version].imploding) ? 'checked' : ''} ${dis}></div>` : ''}
      <h4>🃏 ${t('cardsInGame')}</h4>
      <div class="count-grid">${(st.custom ? CONFIGURABLE : Object.keys(counts)).map(id => {
        const n = counts[id] || 0;
        return `<div class="count-item ${n ? '' : 'off'}">${cardHTML(id, { cls: 'mini', attr: 'data-detail' })}
          ${st.custom && isHost ? `<div class="stepper"><button data-dec="${id}">−</button><b>${n}</b><button data-inc="${id}">+</button></div>` : `<b>x${n}</b>`}</div>`;
      }).join('')}</div>`;
    if (!isHost) { bindDetail($('#lobbySettings')); return; }
    $$('[data-v]').forEach(b => b.onclick = () => { A.sfx('select'); socket.emit('settings', { version: b.dataset.v }); });
    $$('[data-s]').forEach(el => el.onchange = () => socket.emit('settings', { [el.dataset.s]: el.type === 'checkbox' ? el.checked : (isNaN(el.value) ? el.value : +el.value) }));
    const step = (id, d) => socket.emit('settings', { counts: { [id]: Math.max(0, Math.min(10, (st.counts[id] || 0) + d)) } });
    $$('[data-inc]').forEach(b => b.onclick = () => { A.sfx('click'); step(b.dataset.inc, 1); });
    $$('[data-dec]').forEach(b => b.onclick = () => { A.sfx('click'); step(b.dataset.dec, -1); });
    bindDetail($('#lobbySettings'));
  }
  function bindDetail(root) { $$('[data-detail]', root).forEach(c => c.onclick = () => openCardDetail(c.dataset.id)); }

  $('#btnReady').onclick = () => { A.sfx('select'); socket.emit('setReady', { ready: !me()?.ready }); };
  $('#btnStart').onclick = () => { A.sfx('click'); socket.emit('start'); };
  $('#btnAddBot').onclick = () => { A.sfx('click'); socket.emit('addBot'); };
  $('#btnLeave').onclick = () => { socket.emit('leaveRoom'); };
  $('#btnCopy').onclick = () => { navigator.clipboard?.writeText(location.origin + '/?room=' + S.code); toast('📋 ' + t('copied')); };
  $$('[data-chat]').forEach(f => f.onsubmit = (e) => { e.preventDefault(); const i = $('input', f); if (i.value.trim()) socket.emit('chat', { text: i.value }); i.value = ''; });

  // ------------------------------------------------------------ GAME render
  let lastDiscardKey = '';
  let lastSeatsKey = '';
  let lastHeroKey = '';
  let draggingUid = null;
  const THEME_TAG = { gold: 'VIP', neon: 'CYBER', fire: 'BLAZE', galaxy: 'STAR' };
  function getSeatPosClass(idx, total) {
    if (total === 1) return 'seat-top-center';
    if (total === 2) return idx === 0 ? 'seat-mid-left' : 'seat-mid-right';
    if (total === 3) return ['seat-mid-left', 'seat-top-center', 'seat-mid-right'][idx];
    if (total === 4) return ['seat-mid-left', 'seat-top-left', 'seat-top-right', 'seat-mid-right'][idx];
    if (total === 5) return ['seat-mid-left', 'seat-top-left', 'seat-top-center', 'seat-top-right', 'seat-mid-right'][idx];
    return ['seat-mid-left', 'seat-top-left', 'seat-top-center', 'seat-top-right', 'seat-mid-right', 'seat-top-center'][idx % 6];
  }

  function renderGame() {
    const m = me(); if (!m) return;
    const others = S.players.filter(p => p.id !== m.id);
    // seats around the table (only rebuild when seat state changes)
    const seatsKey = JSON.stringify([others, S.turnId, S.turnsLeft, S.pending?.targetId, S.prompt?.playerId, lang]);
    if (seatsKey !== lastSeatsKey) {
      lastSeatsKey = seatsKey;
      $('#seats').innerHTML = others.map((p, idx) => {
        const isTurn = S.turnId === p.id;
        const targeted = S.pending && S.pending.targetId === p.id;
        const prompting = S.prompt && S.prompt.playerId === p.id;
        const theme = themeForPlayer(p, idx);
        const posCls = getSeatPosClass(idx, others.length);
        const nCards = Math.min(p.handCount, 6);
        const mid = (nCards - 1) / 2;
        const fan = Array.from({ length: nCards }, (_, i) => {
          const ang = (i - mid) * 9;
          const ty = Math.abs(i - mid) * 2.5;
          return `<i class="fan-card skin-${theme} ${p.skin || ''}" style="--ang:${ang}deg;--ty:${ty}px"></i>`;
        }).join('');
        return `<div class="seat ${posCls} theme-${theme} ${isTurn ? 'turn' : ''} ${p.alive ? '' : 'dead'} ${targeted ? 'targeted' : ''}" data-id="${p.id}">
          <div class="seat-portrait">
            <span class="seat-tag">${THEME_TAG[theme]}</span>
            <div class="seat-dog">${dogHeroSVG(theme)}</div>
            <div class="seat-stars">⭐⭐⭐⭐⭐</div>
            <div class="seat-plate">${esc(p.name)} ${p.registered ? rankBadge(p.rp) : ''}</div>
            ${isTurn && S.turnsLeft > 1 ? `<span class="turns-badge">x${S.turnsLeft}</span>` : ''}
            ${p.alive ? '' : `<div class="dead-mark">${p.elimReason === 'imploded' ? '🌀' : '💥'}</div>`}
            ${p.auto && !p.isBot ? `<span class="auto-badge">${t('autopilot')}</span>` : ''}
            ${prompting ? '<span class="think">💭</span>' : ''}
          </div>
          <div class="seat-fan" title="${p.handCount} cards">
            <div class="fan-cards">${fan}</div>
            <b class="fan-count">${p.handCount}</b>
          </div>
        </div>`;
      }).join('');
    }

    // my own bottom-left hero seat
    const myTurn = S.state === 'PLAYING' && S.turnId === m.id && m.alive;
    const myTheme = themeForPlayer(m, 3);
    const heroKey = JSON.stringify([m.id, m.name, m.avatar, m.frame, m.rp, m.alive, myTurn, S.turnsLeft, user?.coins, lang]);
    if (heroKey !== lastHeroKey) {
      lastHeroKey = heroKey;
      const heroEl = $('#myHeroSeat');
      if (heroEl) {
        heroEl.innerHTML = `<div class="my-hero theme-${myTheme} ${myTurn ? 'turn' : ''} ${m.alive ? '' : 'dead'}">
          <div class="my-hero-ring">
            <div class="my-hero-dog">${dogHeroSVG(myTheme)}</div>
          </div>
          <div class="my-hero-stars">⭐⭐⭐⭐⭐</div>
          <div class="my-hero-plate">
            <div class="mh-name">${esc(m.name)}</div>
            <div class="mh-sub">🪙 ${user ? user.coins : 0} · ${rankBadge(m.rp)} ${m.rp || 0} RP</div>
          </div>
          ${myTurn ? `<div class="my-turn-ribbon ${S.turnsLeft > 1 ? 'combo-multi' : ''}">⟳ ${t('yourTurn')} ${S.turnsLeft > 1 ? `<b class="turn-multi-tag">🔥 x${S.turnsLeft} ${t('turnsLeft')}</b>` : ''} <span id="myTurnSec"></span></div>` : ''}
        </div>`;
      }
    }

    const comboAlert = $('#comboTurnAlert');
    if (comboAlert) {
      if (S.state === 'PLAYING' && S.turnsLeft > 1) {
        comboAlert.classList.remove('hidden');
        const curP = pl(S.turnId);
        const isMeCur = S.turnId === S.me?.id;
        const mainEl = $('#ctaMainText');
        const subEl = $('#ctaSubText');
        const badgeEl = $('#ctaBadgeCount');
        if (mainEl) {
          mainEl.innerHTML = isMeCur
            ? (lang === 'th' ? `⚡ คุณต้องเล่นทั้งหมดอีก <b>x${S.turnsLeft}</b> เทิร์น!` : `⚡ You must take <b>x${S.turnsLeft}</b> more turns!`)
            : (lang === 'th' ? `⚡ <b>${esc(curP?.name || '')}</b> ต้องเล่นอีก <b>x${S.turnsLeft}</b> เทิร์น!` : `⚡ <b>${esc(curP?.name || '')}</b> has <b>x${S.turnsLeft}</b> turns!`);
        }
        if (subEl) {
          subEl.textContent = lang === 'th' ? `(โดนคอมโบโจมตีซ้อนทับ เหลือ ${S.turnsLeft} เทิร์น)` : `(Under attack combo: ${S.turnsLeft} turns left)`;
        }
        if (badgeEl) badgeEl.textContent = `x${S.turnsLeft}`;
      } else {
        comboAlert.classList.add('hidden');
      }
    }

    // center: draw pile + explosion risk gauge + discard pile
    $('#deckCount').textContent = S.deckCount;
    $$('#deckPile .card.back').forEach(c => {
      c.className = 'card back ' + (m.skin || '');
      if (!c.querySelector('.draw-label')) c.innerHTML = `<span class="draw-label">${esc(t('drawPileLabel'))}</span>`;
    });
    const dKey = (S.discardTop || '') + ':' + lang;
    if (dKey !== lastDiscardKey) {
      lastDiscardKey = dKey;
      $('#discardPile').innerHTML = S.discardTop ? cardHTML(S.discardTop, { attr: 'data-detail' }) : '';
      $('.discard-zone')?.classList.toggle('has-card', !!S.discardTop);
      bindDetail($('#discardPile'));
    }
    $('#dirIcon').className = S.direction === 1 ? 'cw' : 'ccw';
    $('#dirIcon').textContent = S.direction === 1 ? '🔃' : '🔄';

    // Explosion Risk % calculation
    const risk = S.deckCount > 0 ? Math.min(100, Math.round((S.bombsLeft / S.deckCount) * 100)) : 0;
    const riskPctEl = $('#riskPct');
    if (riskPctEl) riskPctEl.textContent = risk + '%';
    const riskArc = $('#riskArc');
    if (riskArc) riskArc.style.strokeDashoffset = (314 * (1 - risk / 100)).toFixed(1);
    const riskMeter = $('#riskMeter');
    if (riskMeter) {
      riskMeter.className = risk >= 60 ? 'risk-crit' : risk >= 35 ? 'risk-high' : risk >= 18 ? 'risk-med' : 'risk-low';
    }
    if (myTurn && S.phase === 'turn' && risk >= 40) {
      A.playHeartbeat(Math.round(65 + (risk - 40) * 1.3));
    } else if (!document.body.classList.contains('emergency-alarm')) {
      A.stopHeartbeat();
    }

    $('#bombInfo').innerHTML = `💣 ${S.bombsLeft}` + (S.faceUp.length ? ` <span class="faceup">🌀 #${S.faceUp.map(i => i + 1).join(', #')}</span>` : '');
    $('#deckPile').classList.toggle('can-draw', myTurn && S.phase === 'turn');

    // pending / nope
    const pb = $('#pendingBar');
    if (S.pending) {
      const pa = S.pending; const actor = pl(pa.playerId); const tgt = pl(pa.targetId);
      const label = pa.effect === 'pair' || pa.effect === 'triple' ? pa.cardIds.map(cname).join(' + ') : cname(pa.cardIds[0]) + (pa.cardIds[0] === 'clone' ? ' → ' + cname(pa.effect) : '');
      pb.className = pa.nopes % 2 ? 'noped' : '';
      $('#pendingText').innerHTML = `<b>${esc(actor?.name)}</b> ▶ ${esc(label)} ${tgt ? '🎯 <b>' + esc(tgt.name) + '</b>' : ''} ${pa.nopes ? `<span class="nope-count">🛑 x${pa.nopes}</span>` : ''}`;
      const hasNope = m.alive && S.me.hand.some(c => c.id === 'nope');
      $('#btnNope').style.display = hasNope ? '' : 'none';
    } else pb.className = 'hidden';

    // keyed hand update (preserves DOM nodes, scroll position, and active drag)
    if (!draggingUid) syncHand(S.me.hand);
    updateActionBar();

    // log
    $('#logBox').innerHTML = S.log.slice().reverse().map(ev => `<div class="log-item">${esc(annText(ev) || '')}</div>`).join('');

    // prompt
    handlePrompt();
    if (S.state === 'ENDED' && S.results && $('#modal').classList.contains('hidden')) showResults(S.results, false);
  }

  function updateActionBar() {
    if (!S || !S.me) return;
    const m = me(); if (!m) return;
    const myTurn = S.state === 'PLAYING' && S.turnId === m.id && m.alive;
    $('#turnBadge').innerHTML = S.state !== 'PLAYING' ? '' : myTurn
      ? `⭐ ${t('yourTurn')} ${S.turnsLeft > 1 ? `<span class="badge-turns-alert">🔥 x${S.turnsLeft} ${t('turnsLeft')}</span>` : ''}`
      : tp ? `${esc(tp.avatar)} ${t('turnOf')} <b>${esc(tp.name)}</b> ${S.turnsLeft > 1 ? `<span class="badge-turns-alert">🔥 x${S.turnsLeft}</span>` : ''}` : '';
    $('#turnBadge').className = myTurn ? 'mine' : '';
    $('#handArea').classList.toggle('my-turn', myTurn);
    const canAct = myTurn && S.phase === 'turn';
    const pv = playValidity();
    const canPlay = pv.ok && (canAct || pv.nope);
    $('#spectate').className = m.alive || S.state !== 'PLAYING' ? 'hidden' : '';

    // Draw pile glow indicator
    const dp = $('#deckPile');
    if (dp) dp.classList.toggle('can-draw', canAct);

    // 3D Arcade Buzzer state
    const buz = $('#arcadeBuzzer'), bIcon = $('#buzzerIcon');
    if (buz && bIcon) {
      const hasNope = S.pending && m.alive && S.me.hand.some(c => c.id === 'nope');
      if (hasNope) { buz.className = 'mode-nope'; bIcon.textContent = '🛑'; buz.title = 'Quick Nope (🛑)'; }
      else if (canPlay) { buz.className = 'mode-play'; bIcon.textContent = '⚡'; buz.title = `${t('play')} (${sel.length || 1})`; }
      else if (canAct) { buz.className = 'mode-draw'; bIcon.textContent = '🐾'; buz.title = t('draw'); }
      else { buz.className = 'mode-idle'; bIcon.textContent = '⚡'; buz.title = ''; }
    }
  }

  function syncHand(hand) {
    const box = $('#hand');
    const existing = new Map($$('.card', box).map(el => [el.dataset.uid, el]));
    const wanted = new Set(hand.map(c => c.uid));
    // remove cards no longer in hand
    for (const [uid, el] of existing) {
      if (!wanted.has(uid)) { el.remove(); existing.delete(uid); }
    }
    // insert or reorder in-place
    hand.forEach((c, idx) => {
      let el = existing.get(c.uid);
      if (!el) {
        const wrap = document.createElement('div');
        wrap.innerHTML = cardHTML(c.id, { uid: c.uid, selected: sel.includes(c.uid), cls: 'hand-card card-enter' });
        el = wrap.firstElementChild;
        const info = document.createElement('button');
        info.className = 'card-info'; info.textContent = 'ⓘ'; info.title = cname(c.id);
        info.onpointerdown = (e) => e.stopPropagation();
        info.onclick = (e) => { e.stopPropagation(); openCardDetail(c.id); };
        el.appendChild(info);
        const typeEl = $('.card-type', el);
        if (typeEl) {
          typeEl.onpointerdown = (e) => e.stopPropagation();
          typeEl.onclick = (e) => { e.stopPropagation(); openCardDetail(c.id); };
        }
        bindCardGesture(el);
        setTimeout(() => el.classList.remove('card-enter'), 320);
      } else {
        const nameEl = $('.cname', el);
        if (nameEl) nameEl.innerHTML = `<span>${CARDS[c.id].icon}</span> ${esc(CARDS[c.id].name[lang])}`;
        const typeText = $('.card-type .type-text', el);
        const k = CARD_KINDS?.[CARDS[c.id].kind];
        if (typeText && k) typeText.textContent = k.name[lang] || k.name.en;
      }
      el.classList.toggle('sel', sel.includes(c.uid));
      const curAtIdx = box.children[idx];
      if (curAtIdx !== el) box.insertBefore(el, curAtIdx || null);
    });
    box.classList.toggle('many-cards', hand.length > 7);
    requestAnimationFrame(() => {
      const isOverflowing = box.scrollWidth > box.clientWidth + 6;
      box.classList.toggle('is-overflowing', isOverflowing);
      box.classList.toggle('is-centered', !isOverflowing);
      updateHandNav();
    });
  }

  function updateHandNav() {
    const box = $('#hand'); if (!box) return;
    const canLeft = box.scrollLeft > 6;
    const canRight = box.scrollLeft + box.clientWidth < box.scrollWidth - 6;
    const l = $('#handLeft'), r = $('#handRight');
    if (l) {
      l.classList.toggle('dim', !canLeft);
      l.title = canLeft ? (lang === 'th' ? 'เลื่อนดูไพ่ทางซ้าย' : 'Scroll left') : '';
    }
    if (r) {
      r.classList.toggle('dim', !canRight);
      r.title = canRight ? (lang === 'th' ? 'เลื่อนดูไพ่ทางขวา' : 'Scroll right') : '';
    }
  }

  function selectedCards() { return sel.map(u => S.me.hand.find(c => c.uid === u)).filter(Boolean); }
  function playValidity() {
    const cs = selectedCards(); if (!cs.length) return { ok: false };
    if (cs.length === 1) {
      const c = CARDS[cs[0].id];
      if (cs[0].id === 'nope') return { ok: !!S.pending, nope: true };
      if (c.kind !== 'action') return { ok: false };
      if (cs[0].id === 'clone' && !S.lastActionId) return { ok: false };
      return { ok: true, effect: cs[0].id === 'clone' ? S.lastActionId : cs[0].id };
    }
    if (cs.length === 5) {
      const distinct = new Set(cs.map(c => c.id));
      if (distinct.size === 5 && !cs.some(c => CARDS[c.id].kind === 'bomb')) {
        return { ok: true, effect: '5_cards' };
      }
      return { ok: false };
    }
    if (cs.length > 3 || cs.some(c => CARDS[c.id].kind !== 'cat')) return { ok: false };
    const ids = new Set(cs.filter(c => !CARDS[c.id].wild).map(c => c.id));
    if (ids.size > 1) return { ok: false };
    return { ok: true, effect: cs.length === 2 ? 'pair' : 'triple' };
  }

  function bindCardGesture(el) {
    let startX = 0, startY = 0, startIdx = -1, mode = null;
    el.oncontextmenu = (e) => { e.preventDefault(); openCardDetail(el.dataset.id); };

    // 3D Perspective Tilt on mouse move
    el.addEventListener('mousemove', (e) => {
      if (el.classList.contains('dragging') || el.classList.contains('sel')) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotX = ((y - cy) / cy) * -14;
      const rotY = ((x - cx) / cx) * 14;
      el.style.setProperty('--mx', `${((x / rect.width) * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${((y / rect.height) * 100).toFixed(1)}%`);
      el.style.transform = `perspective(600px) rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg) translateY(-12px) scale(1.06)`;
    });
    el.addEventListener('mouseleave', () => {
      if (!el.classList.contains('sel') && !el.classList.contains('dragging')) {
        el.style.transform = '';
      }
    });

    el.onpointerdown = (e) => {
      if (e.button && e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY; mode = null;
      const cards = $$('#hand .card');
      startIdx = cards.indexOf(el);
    };
    el.onpointermove = (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!mode) {
        if (Math.abs(dx) > 12 && Math.abs(dx) >= Math.abs(dy)) {
          mode = 'reorder'; draggingUid = el.dataset.uid; el.classList.add('dragging');
        } else if (dy < -16 && Math.abs(dy) > Math.abs(dx)) {
          mode = 'lift'; draggingUid = el.dataset.uid; el.classList.add('dragging');
        } else return;
      }
      if (mode === 'lift') {
        el.style.transform = `translate(${dx * 0.35}px, ${Math.min(20, dy)}px) scale(1.08)`;
        el.classList.toggle('drop-ready', dy < -65);
      } else if (mode === 'reorder') {
        el.style.transform = `translate(${dx}px, -14px) scale(1.06) rotate(${Math.max(-8, Math.min(8, dx * 0.08))}deg)`;
        const box = $('#hand');
        const siblings = $$('#hand .card');
        const curIdx = siblings.indexOf(el);
        for (let i = 0; i < siblings.length; i++) {
          if (i === curIdx) continue;
          const r = siblings[i].getBoundingClientRect();
          const mid = r.left + r.width / 2;
          if ((i < curIdx && e.clientX < mid) || (i > curIdx && e.clientX > mid)) {
            box.insertBefore(el, i < curIdx ? siblings[i] : siblings[i].nextSibling);
            startX = e.clientX;
            el.style.transform = `translate(0px, -14px) scale(1.06)`;
            A.sfx('click');
            break;
          }
        }
      }
    };
    const finish = (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      el.releasePointerCapture(e.pointerId);
      const dy = e.clientY - startY;
      el.classList.remove('dragging', 'drop-ready');
      el.style.transform = '';
      const wasMode = mode; mode = null; draggingUid = null;
      if (!wasMode) {
        const u = el.dataset.uid;
        const nowTs = Date.now();
        const lastTap = el._lastTap || 0;
        el._lastTap = nowTs;
        if (nowTs - lastTap < 350 && sel.includes(u)) {
          doPlay();
          return;
        }
        sel = sel.includes(u) ? sel.filter(x => x !== u) : [...sel, u];
        el.classList.toggle('sel', sel.includes(u));
        A.sfx('select');
        updateActionBar();
      } else if (wasMode === 'lift' && dy < -65) {
        const u = el.dataset.uid;
        if (!sel.includes(u)) {
          const curCards = selectedCards();
          const draggedCard = S.me.hand.find(c => c.uid === u);
          if (curCards.length && draggedCard && CARDS[draggedCard.id]?.kind === 'cat' && curCards.every(c => CARDS[c.id]?.kind === 'cat')) {
            sel = [...sel, u];
          } else {
            sel = [u];
          }
          $$('#hand .card').forEach(c => c.classList.toggle('sel', sel.includes(c.dataset.uid)));
          updateActionBar();
        }
        doPlay();
      } else if (wasMode === 'reorder') {
        const toIdx = $$('#hand .card').indexOf(el);
        if (startIdx >= 0 && toIdx >= 0 && startIdx !== toIdx) {
          const item = S.me.hand.splice(startIdx, 1)[0];
          if (item) S.me.hand.splice(toIdx, 0, item);
          socket.emit('reorder', { from: startIdx, to: toIdx });
        }
      } else {
        if (S && S.me) syncHand(S.me.hand);
      }
    };
    el.onpointerup = finish;
    el.onpointercancel = finish;
  }

  // Hand horizontal scroll helpers
  $('#hand').addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      $('#hand').scrollBy({ left: e.deltaY * 1.3, behavior: 'auto' });
    }
  }, { passive: false });
  $('#hand').addEventListener('scroll', updateHandNav, { passive: true });
  $('#handLeft').onclick = () => { A.sfx('click'); $('#hand').scrollBy({ left: -260, behavior: 'smooth' }); };
  $('#handRight').onclick = () => { A.sfx('click'); $('#hand').scrollBy({ left: 260, behavior: 'smooth' }); };
  $('#btnSort').onclick = () => {
    A.sfx('shuffle');
    socket.emit('sortHand');
    setTimeout(() => {
      const h = $('#hand');
      if (h) h.scrollTo({ left: 0, behavior: 'smooth' });
    }, 120);
  };

  function canDrawNow() {
    if (!S || !S.me) return false;
    const m = me();
    return S.state === 'PLAYING' && S.turnId === m?.id && m?.alive && S.phase === 'turn';
  }

  let drawActionLock = false;
  function doDraw() {
    if (!canDrawNow() || drawActionLock) return;
    drawActionLock = true;
    setTimeout(() => { drawActionLock = false; }, 400);
    A.sfx('draw');
    sel = [];
    socket.emit('draw');
  }

  function doQuickNope() {
    const c = S?.me?.hand?.find(x => x.id === 'nope');
    if (c) {
      socket.emit('play', { uids: [c.uid] });
      sel = sel.filter(u => u !== c.uid);
      A.sfx('play');
    }
  }

  function doPlay() {
    if (!S || !S.me) return;
    const m = me();
    const canAct = S.state === 'PLAYING' && S.turnId === m?.id && m?.alive && S.phase === 'turn';
    const pv = playValidity();
    if (!pv.ok || (!canAct && !pv.nope)) return toast(t('noPlay'), 'err');
    const uids = [...sel];
    const send = (targetId, namedId) => {
      socket.emit('play', { uids, targetId, namedId });
      sel = [];
      $$('#hand .card.sel').forEach(c => c.classList.remove('sel'));
      updateActionBar();
      A.sfx('play');
    };
    if (pv.nope) return send();
    const needT = pv.effect === 'pair' || pv.effect === 'triple' || CARDS[pv.effect]?.target;
    if (!needT) return send();
    chooseTarget(pv.effect === 'targeted_attack', (tid) => {
      if (pv.effect === 'triple') chooseCardName((nid) => send(tid, nid)); else send(tid);
    });
  }

  $('#deckPile').onclick = () => { if (canDrawNow()) doDraw(); };
  $('#btnNope').onclick = () => doQuickNope();

  function chooseTarget(allowEmpty, cb) {
    const opts = S.players.filter(p => p.id !== S.me.id && p.alive && (allowEmpty || p.handCount > 0));
    if (!opts.length) return toast(lang === 'th' ? 'ไม่มีเป้าหมายให้เลือก' : 'No valid targets', 'err');
    clearModalAuto();
    const dl = S.turnDeadline ? Math.min(S.turnDeadline, now() + 15000) : now() + 15000;
    const timerHtml = modalTimerHTML(dl, lang === 'th' ? 'เลือกเป้าหมายก่อนหมดเวลา' : 'Select target before time runs out');
    openModal(`<h2>🎯 ${t('selectTarget')}</h2>${timerHtml}<div class="target-grid">${opts.map(p => `<button class="target" data-t="${p.id}">${avatarHTML(p, 'lg')}<b>${esc(p.name)}</b><small>🃏 ${p.handCount}</small></button>`).join('')}</div>`);
    let done = false;
    const select = (tid) => {
      if (done) return;
      done = true;
      clearModalAuto();
      closeModal(true);
      cb(tid);
    };
    $$('[data-t]').forEach(b => b.onclick = () => select(b.dataset.t));
    modalAutoTimer = setTimeout(() => {
      if (!done && opts.length) {
        const pickT = opts[Math.floor(Math.random() * opts.length)];
        toast(lang === 'th' ? `หมดเวลาเลือก! ระบบสุ่มเลือก ${pickT.name}` : `Time out! Auto-selected ${pickT.name}`, 'warn');
        select(pickT.id);
      }
    }, Math.max(500, dl - now()));
  }
  function chooseCardName(cb) {
    const ids = Object.keys(CARDS).filter(id => id !== 'imploding_kitten');
    clearModalAuto();
    const dl = S.turnDeadline ? Math.min(S.turnDeadline, now() + 15000) : now() + 15000;
    const timerHtml = modalTimerHTML(dl, lang === 'th' ? 'ระบุชื่อการ์ดที่ต้องการขโมย' : 'Name a card to steal');
    openModal(`<h2>📣 ${t('nameCard')}</h2>${timerHtml}<div class="pick-grid">${ids.map(id => cardHTML(id, { cls: 'mini', attr: 'data-n' })).join('')}</div>`, { cls: 'wide' });
    let done = false;
    const pickName = (nid) => {
      if (done) return;
      done = true;
      clearModalAuto();
      closeModal(true);
      cb(nid);
    };
    $$('[data-n]').forEach(b => b.onclick = () => pickName(b.dataset.id));
    modalAutoTimer = setTimeout(() => {
      if (!done) {
        toast(lang === 'th' ? 'หมดเวลาเลือก! ระบบสุ่มระบุการ์ดกู้ระเบิด' : 'Time out! Auto-named Defuse', 'warn');
        pickName('defuse');
      }
    }, Math.max(500, dl - now()));
  }

  // ------------------------------------------------------------ prompts
  function handlePrompt() {
    const pr = S.prompt;
    const mine = pr && pr.playerId === S.me.id && pr.data;
    const key = mine ? pr.type + pr.deadline : null;
    if (!mine) { if (openPromptKey) closeModal(true); return; }
    if (openPromptKey === key) return;
    openPromptKey = null;
    clearModalAuto();
    const d = pr.data; const respond = (payload) => { clearModalAuto(); socket.emit('respond', payload); closeModal(true); };
    const timer = modalTimerHTML(pr.deadline, lang === 'th' ? 'หมดเวลาจะดำเนินการให้อัตโนมัติ' : 'Auto-resolves on timeout');
    const slider = (title, size, cls) => {
      openModal(`<h2>${title}</h2>${timer}<div class="pos-pick"><div class="pos-labels"><span>⬆️ ${t('top')}</span><b id="posVal">1</b><span>${t('bottom')} ⬇️</span></div>
        <input type="range" id="posRange" min="0" max="${size}" value="0"><div class="deck-preview" id="deckPrev"></div>
        <div class="row"><button class="btn small" data-q="top">${t('top')}</button><button class="btn small" data-q="rand">🎲 ${t('random')}</button><button class="btn small" data-q="bottom">${t('bottom')}</button></div>
        <button class="btn big gold" id="posOk">${t('confirm')}</button></div>`, { locked: true, cls });
      const r = $('#posRange');
      const upd = () => { $('#posVal').textContent = `${t('position')} ${+r.value + 1} / ${size + 1}`;
        $('#deckPrev').innerHTML = Array.from({ length: Math.min(size + 1, 24) }, (_, i) => `<i class="${i === Math.min(+r.value, 23) ? 'here' : ''}"></i>`).join(''); };
      r.oninput = upd; upd();
      $$('[data-q]').forEach(b => b.onclick = () => { r.value = b.dataset.q === 'top' ? 0 : b.dataset.q === 'bottom' ? size : Math.floor(Math.random() * (size + 1)); upd(); });
      $('#posOk').onclick = () => respond({ pos: +r.value });
    };
    switch (pr.type) {
      case 'insert_bomb': slider(d.faceUp ? '🌀 ' + t('insertImploding') : '💣 ' + t('insertBomb'), d.deckSize, 'bomb-modal'); break;
      case 'bury': slider('⛏️ ' + t('buryTitle'), d.deckSize); break;
      case 'favor_give': {
        const to = pl(d.toId);
        const hasOther = S.me.hand.some(c => c.id !== 'exploding_kitten');
        openModal(`<h2>🎁 ${t('giveCard')} ${esc(to?.name)}</h2>${timer}<div class="pick-grid">${S.me.hand.map(c => {
          const isBombCard = c.id === 'exploding_kitten' && hasOther;
          return cardHTML(c.id, {
            uid: c.uid,
            cls: isBombCard ? 'disabled-card' : '',
            attr: isBombCard ? 'data-disabled="true"' : 'data-g="true"'
          });
        }).join('')}</div>`, { locked: true, cls: 'wide' });
        $$('[data-g]').forEach(b => b.onclick = () => respond({ uid: b.dataset.uid }));
        $$('[data-disabled]').forEach(b => b.onclick = () => toast(lang === 'th' ? 'ห้ามส่งหมาระเบิดให้เพื่อนตามกฎ!' : 'Cannot give Exploding Puppy by rules!', 'err'));
        break;
      }
      case 'discard_pick': {
        openModal(`<h2>♻️ ${t('pickFromDiscard')}</h2>${timer}
          <div class="pick-grid">${d.cards.map(c => cardHTML(c.id, { uid: c.uid, attr: 'data-dp' })).join('')}</div>`,
          { locked: true, cls: 'wide' });
        $$('[data-dp]').forEach(b => b.onclick = () => {
          A.sfx('draw');
          respond({ uid: b.dataset.uid });
        });
        break;
      }
      case 'steal_pick': {
        const tg = pl(d.targetId);
        openModal(`<h2>🐾 ${t('stealPick')} ${esc(tg?.name)}</h2>${timer}<div class="pick-grid">${Array.from({ length: d.count }, (_, i) => backHTML(tg?.skin, `data-i="${i}"`)).join('')}</div>`, { locked: true, cls: 'wide' });
        $$('[data-i]').forEach(b => b.onclick = () => { A.sfx('steal'); respond({ index: +b.dataset.i }); });
        break;
      }
      case 'alter': {
        let order = d.cardIds.map((_, i) => i);
        const draw = () => {
          openModal(`<h2>🪄 ${t('alterTitle')}</h2>${timer}<div class="alter-row">${order.map((oi, pos) => `<div class="alter-slot"><small>#${pos + 1}</small>${cardHTML(d.cardIds[oi])}
            <div class="row"><button class="btn small" data-mv="${pos}" data-d="-1" ${pos === 0 ? 'disabled' : ''}>◀</button><button class="btn small" data-mv="${pos}" data-d="1" ${pos === order.length - 1 ? 'disabled' : ''}>▶</button></div></div>`).join('')}</div>
            <button class="btn big gold" id="altOk">${t('confirm')}</button>`, { locked: true, cls: 'wide' });
          openPromptKey = key;
          $$('[data-mv]').forEach(b => b.onclick = () => { const p = +b.dataset.mv, q = p + +b.dataset.d; [order[p], order[q]] = [order[q], order[p]]; A.sfx('select'); draw(); });
          $('#altOk').onclick = () => { A.sfx('magic'); respond({ order }); };
        };
        draw(); break;
      }
      case 'dig':
        openModal(`<h2>🪨 ${t('digTitle')}</h2>${timer}<div class="card-detail">${cardHTML(d.cardId, { cls: 'xl' })}</div>
          <div class="row"><button class="btn big green" id="digKeep">${t('keep')}</button><button class="btn big blue" id="digBack">${t('putBack')}</button></div>`, { locked: true });
        $('#digKeep').onclick = () => respond({ keep: true }); $('#digBack').onclick = () => respond({ keep: false });
        break;
      case 'see_future': {
        openModal(`<h2>🔮 ${t('futureTitle')}</h2>${timer}
          <div class="alter-row">${d.cardIds.map((id, i) => `<div class="alter-slot"><small>#${i + 1}</small>${cardHTML(id)}</div>`).join('')}</div>
          <div style="margin-top:16px;display:flex;justify-content:center;">
            <button class="btn big gold" id="btnSeeFutureDone">👁️ ${lang === 'th' ? 'เข้าใจแล้ว (ปิดเลย)' : 'Got it (Close)'}</button>
          </div>`, { locked: true, cls: 'wide' });
        $('#btnSeeFutureDone').onclick = () => { A.sfx('click'); respond({}); };
        break;
      }
      case 'revive':
        openModal(`<h2>🧟 ${t('reviveTitle')}</h2>${timer}<div class="target-grid">${d.dead.map(id => { const p = pl(id); return `<button class="target" data-r="${id}">${avatarHTML(p, 'lg')}<b>${esc(p?.name)}</b></button>`; }).join('')}</div>`, { locked: true });
        $$('[data-r]').forEach(b => b.onclick = () => respond({ targetId: b.dataset.r }));
        break;
    }
    openPromptKey = key;
    modalAutoTimer = setTimeout(() => closeModal(true), Math.max(300, pr.deadline - now()));
  }

  // ------------------------------------------------------------ FX + announcer
  function fill(tpl, ev, extra = {}) {
    return tpl.replace('{p}', ev.pn || '').replace('{t}', ev.tn || '').replace('{c}', extra.c || '').replace('{n}', extra.n ?? '');
  }
  function annKey(ev) {
    switch (ev.type) {
      case 'turn': return [ev.turnsLeft > 1 ? 'turnMulti' : 'turn', { n: ev.turnsLeft }];
      case 'draw': return [ev.bottom ? 'drawBottom' : 'draw'];
      case 'play':
        if (ev.effect === 'pair') return ['pair'];
        if (ev.effect === 'triple') return ['triple', { c: cname(ev.namedId) }];
        return [ev.targetId ? 'playT' : 'play', { c: cname(ev.cardIds[0]) + (ev.cardIds[0] === 'clone' ? ' (' + cname(ev.effect) + ')' : '') }];
      case 'nope': return [ev.nopes > 1 ? 'nopeNope' : 'nope'];
      case 'bomb_drawn': return [ev.cardId === 'imploding_kitten' ? 'imp_drawn' : 'bomb_drawn'];
      case 'eliminated': return [ev.reason === 'imploded' ? 'imploded' : 'exploded'];
      case 'imploding_back': return ['imploding_back', { n: ev.pos + 1 }];
      case 'attack_pass': return ['attack_pass', { n: ev.turns }];
      case 'personal': return ['personal', { n: ev.turns }];
      case 'catomic': return ['catomic', { n: ev.count }];
      case 'barking': return ['barking_' + ev.result];
      case 'triple': return [ev.hit ? 'triple_hit' : 'triple_miss', { c: cname(ev.namedId) }];
      case 'discard_picked': return ['discard_picked', { c: cname(ev.cardId) }];
      case 'roulette': return ['roulette'];
      case 'left': return ['left'];
      default: return [ev.type];
    }
  }
  function annText(ev) {
    const [k, extra = {}] = annKey(ev); const tpl = ANN[lang][k]; if (!tpl) return '';
    const e2 = ev.type === 'left' ? { ...ev, pn: ev.name } : ev;
    return fill(tpl, e2, extra);
  }
  const SPEAK = new Set(['turn', 'play', 'nope', 'cancelled', 'bomb_drawn', 'defused', 'eliminated', 'attack_pass', 'stolen', 'favor_done', 'win', 'revived', 'barking', 'catomic', 'reverse', 'timeout', 'prompt_auto', 'triple', 'imploding_back', 'streak_exposed', 'game_start', 'joined', 'ready', 'personal', 'zombie_drawn', 'shuffled', 'discard_picked']);

  function pushCombatTicker(html, type = '') {
    const box = $('#combatTicker');
    if (!box) return;
    const msg = document.createElement('div');
    msg.className = `ticker-msg ${type}`.trim();
    msg.innerHTML = html;
    box.appendChild(msg);
    while (box.children.length > 5) {
      box.removeChild(box.firstChild);
    }
    setTimeout(() => {
      msg.classList.add('fade-out');
      setTimeout(() => msg.remove(), 450);
    }, 4500);
  }

  function showNopeStamp(pn) {
    const table = $('#table') || document.body;
    const overlay = document.createElement('div');
    overlay.className = 'nope-slam-overlay';
    overlay.innerHTML = `<div class="nope-stamp"><div class="nope-stamp-text">NOPE!</div><div class="nope-stamp-sub">${esc(pn)}</div></div>`;
    table.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1200);
  }

  function showDefuseStamp(pn) {
    const table = $('#table') || document.body;
    const overlay = document.createElement('div');
    overlay.className = 'nope-slam-overlay';
    overlay.innerHTML = `<div class="defuse-stamp"><div class="stamp-text">DEFUSED!</div><div class="stamp-sub">${esc(pn)} SAFE!</div></div>`;
    table.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1200);
  }

  function onFx(ev) {
    const text = annText(ev);
    const isMe = S && S.me && ev.playerId === S.me.id;
    const isTargetMe = S && S.me && ev.targetId === S.me.id;
    const actor = pl(ev.playerId);
    const ava = actor ? avatarHTML(actor, 'lg') : '';
    let speak = SPEAK.has(ev.type) ? text : '';
    let prio = false;
    switch (ev.type) {
      case 'game_start':
        A.sfx('win');
        pushCombatTicker('<span>🚀</span> ' + (lang === 'th' ? 'เริ่มการแข่งขันแล้ว!' : 'Game Started!'), 'good');
        break;
      case 'roulette': setTimeout(() => roulette(ev.order, ev.playerId), 350); speak = text; break;
      case 'turn':
        if (isMe) { A.sfx('myturn'); banner(`${ava}<div><h2>⭐ ${t('yourTurn')}</h2>${ev.turnsLeft > 1 ? `<p>x${ev.turnsLeft} ${t('turnsLeft')}</p>` : ''}</div>`, 'mine'); speak = fill(ANN[lang].yourTurn, ev); if (navigator.vibrate) navigator.vibrate(120); }
        else { A.sfx('turn'); banner(`${ava}<div><h3>${esc(text)}</h3></div>`, 'turn', 1300); }
        break;
      case 'draw': A.sfx('draw'); animateDraw(ev.playerId); break;
      case 'play':
        A.sfx(['attack', 'targeted_attack', 'personal_attack'].includes(ev.effect) ? (isTargetMe ? 'attacked' : 'attack') : ev.effect === 'shuffle' ? 'shuffle' : ev.effect === 'barking_kitten' ? 'bark' : 'play');
        showCardSpotlight(ev.cardIds ? ev.cardIds[0] : null, ev.effect, ev.pn, ev.tn, ev.namedId);
        flyCards(ev.cardIds, `${esc(ev.pn)}${ev.tn ? ' 🎯 ' + esc(ev.tn) : ''}`);
        if (isTargetMe) {
          const eff = ev.effect || (ev.cardIds ? ev.cardIds[0] : '');
          let targetTitle = '';
          let targetMsg = '';
          let targetIco = '🎯';
          let bannerType = 'danger';

          if (eff === 'pair') {
            targetIco = '🐾🤏';
            targetTitle = lang === 'th' ? 'กำลังจะโดนขโมยไพ่!' : 'CARD BEING ROBBED!';
            targetMsg = lang === 'th'
              ? `คุณกำลังจะถูก <b>${esc(ev.pn)}</b> สุ่มขโมยการ์ดในมือ 1 ใบ!`
              : `<b>${esc(ev.pn)}</b> is about to steal a random card from your hand!`;
            bannerType = 'warn';
          } else if (eff === 'triple') {
            targetIco = '🌭🔍';
            const reqCardName = ev.namedId ? cname(ev.namedId) : (lang === 'th' ? 'การ์ดสำคัญ' : 'a card');
            targetTitle = lang === 'th' ? 'กำลังจะโดนแย่งการ์ด!' : 'TARGETED DEMAND!';
            targetMsg = lang === 'th'
              ? `คุณกำลังจะถูก <b>${esc(ev.pn)}</b> ระบุขอการ์ด <b>"${esc(reqCardName)}"</b> จากมือคุณ!`
              : `<b>${esc(ev.pn)}</b> demands <b>"${esc(reqCardName)}"</b> from your hand!`;
            bannerType = 'warn';
          } else if (eff === 'favor') {
            targetIco = '🎁🥺';
            targetTitle = lang === 'th' ? 'กำลังจะโดนขอไพ่!' : 'FAVOR DEMANDED!';
            targetMsg = lang === 'th'
              ? `<b>${esc(ev.pn)}</b> ทำตาแป๋วใส่คุณ! บังคับให้คุณเลือกส่งการ์ดให้ 1 ใบ!`
              : `<b>${esc(ev.pn)}</b> is forcing you to give them 1 card!`;
            bannerType = 'turn';
          } else if (eff === 'targeted_attack') {
            targetIco = '🎯⚡';
            targetTitle = lang === 'th' ? 'กำลังจะโดนสั่งเล่น 2 เทิร์น!' : 'TARGETED ATTACK!';
            targetMsg = lang === 'th'
              ? `คุณถูก <b>${esc(ev.pn)}</b> ล็อคเป้าโจมตี! ต้องเล่น 2 เทิร์นรวด!`
              : `You are targeted by <b>${esc(ev.pn)}</b> to take 2 turns!`;
            bannerType = 'danger';
          } else if (eff === 'barking_kitten') {
            targetIco = '🐕⚡';
            targetTitle = lang === 'th' ? 'เผชิญหน้าหมาเห่า!' : 'BARKING PUPPY!';
            targetMsg = lang === 'th'
              ? `<b>${esc(ev.pn)}</b> เล่นหมาเห่าใส่คุณ! ถ้าถืออีกใบต้องกู้ระเบิด!`
              : `<b>${esc(ev.pn)}</b> barked at you! Face explosion if you hold the other!`;
            bannerType = 'danger';
          } else {
            targetIco = '🎯';
            targetTitle = lang === 'th' ? 'ตกเป็นเป้าหมาย!' : 'TARGET ACQUIRED!';
            targetMsg = lang === 'th'
              ? `คุณถูก <b>${esc(ev.pn)}</b> เลือกเป็นเป้าหมายการ์ด ${cname(ev.cardIds?.[0])}!`
              : `You are targeted by <b>${esc(ev.pn)}</b> with ${cname(ev.cardIds?.[0])}!`;
            bannerType = 'danger';
          }

          flash(bannerType === 'danger' ? 'rgba(239,68,68,.75)' : 'rgba(234,179,8,.75)', true);
          A.sfx(bannerType === 'danger' ? 'attacked' : 'alarm');
          const tbl = $('#table');
          if (tbl) {
            tbl.classList.add('under-attack-active');
            setTimeout(() => tbl.classList.remove('under-attack-active'), 2800);
          }
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          banner(`<div>
            <div style="font-size:3rem;animation:bounce .4s infinite alternate;">${targetIco}</div>
            <h2 style="color:${bannerType === 'danger' ? '#ef4444' : '#fde047'};font-size:1.8rem;text-shadow:0 0 20px rgba(0,0,0,0.8);">${esc(targetTitle)}</h2>
            <p style="font-size:1.15rem;font-weight:700;">${targetMsg}</p>
            ${S.pending ? `<small style="color:#fde047;font-weight:800;">🛑 ${lang === 'th' ? 'คุณสามารถกด NOPE เพื่อสกัดกั้นได้!' : 'You can NOPE this action!'}</small>` : ''}
          </div>`, bannerType, 3000);
          toast(`${targetIco} ${esc(targetTitle)} - ${esc(text)}`, bannerType === 'danger' ? 'err' : 'warn');
        }
        pushCombatTicker(`<span>🃏</span> <b>${esc(ev.pn)}</b>: ${cname(ev.cardIds[0])}${ev.tn ? ' 🎯 ' + esc(ev.tn) : ''}`);
        break;
      case 'nope':
        A.sfx('slam');
        showCardSpotlight('nope', 'nope', ev.pn);
        flyCards(['nope'], esc(ev.pn)); flash('rgba(239,68,68,.3)'); prio = true;
        showNopeStamp(ev.pn);
        pushCombatTicker(`<span>🛑</span> <b>${esc(ev.pn)}</b> NOPE!`, 'nope');
        break;
      case 'cancelled': A.sfx('nope'); banner(`<h2>🛑 NOPE!</h2><p>${esc(text)}</p>`, 'nope', 1400); break;
      case 'bomb_drawn':
        A.sfx('alarm');
        A.playHeartbeat(140);
        document.body.classList.add('emergency-alarm');
        flyCards([ev.cardId], esc(ev.pn)); flash('rgba(255,0,60,.45)', true); prio = true;
        banner(`<div class="dramatic-bomb-box"><div class="bomb-badge">⚠️ BOMB DRAWN!</div><div class="bomb-anim">${ev.cardId === 'imploding_kitten' ? '🌀' : '💣'}</div><h2>${esc(text)}</h2></div>`, 'danger', 2500);
        floatAt(ev.playerId, `<div class="comic-emote"><b class="ce-tag">NOOO!</b><span class="ce-ico">😭</span></div>`, 'sticker');
        if (S?.players) {
          const otherBot = S.players.find(p => p.isBot && p.alive && p.id !== ev.playerId);
          if (otherBot) setTimeout(() => floatAt(otherBot.id, `<div class="comic-emote"><b class="ce-tag">UH OH!</b><span class="ce-ico">😂</span></div>`, 'sticker'), 450);
        }
        pushCombatTicker(`<span>💣</span> <b>${esc(ev.pn)}</b> ${ev.cardId === 'imploding_kitten' ? 'IMPLODING KITTEN!' : 'EXPLODING KITTEN!'}`, 'danger');
        break;
      case 'defused':
        A.sfx('defuse');
        A.stopHeartbeat();
        document.body.classList.remove('emergency-alarm');
        showCardSpotlight('defuse', 'defuse', ev.pn);
        flyCards(['defuse'], esc(ev.pn)); flash('rgba(34,197,94,.35)');
        showDefuseStamp(ev.pn);
        pushCombatTicker(`<span>🔧</span> <b>${esc(ev.pn)}</b> DEFUSED!`, 'good');
        break;
      case 'eliminated':
        A.stopHeartbeat();
        document.body.classList.remove('emergency-alarm');
        A.sfx(ev.reason === 'imploded' ? 'implode' : 'boom'); flash(ev.reason === 'imploded' ? 'rgba(67,56,202,.6)' : 'rgba(255,120,0,.7)', true); prio = true;
        const tbl = $('#table');
        if (tbl) { tbl.classList.add('exploding-active'); setTimeout(() => tbl.classList.remove('exploding-active'), 1200); }
        banner(`<div class="boom-anim">💥</div>${ava}<h2>${esc(text)}</h2>`, 'danger', 2400);
        if (isMe) setTimeout(() => A.sfx('lose'), 1200);
        pushCombatTicker(`<span>💥</span> <b>${esc(ev.pn)}</b> ${ev.reason === 'imploded' ? 'Imploded' : 'Exploded'}!`, 'danger');
        break;
      case 'attack_pass':
        if (ev.targetId) floatAt(ev.targetId, `<div class="comic-emote"><b class="ce-tag">NOOO!</b><span class="ce-ico">😭</span></div>`, 'sticker');
        showCardSpotlight(ev.effect || 'attack', ev.effect || 'attack', ev.pn, ev.tn || (isTargetMe ? myName() : ''), null, 2000);
        if (isTargetMe) {
          A.sfx('attacked');
          flash('rgba(239,68,68,.75)', true);
          const tEl = $('#table');
          if (tEl) {
            tEl.classList.add('under-attack-active');
            setTimeout(() => tEl.classList.remove('under-attack-active'), 2200);
          }
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
          banner(`<div><div style="font-size:3rem;animation:bounce .4s infinite alternate;">🚨🔥</div><h2 style="color:#ef4444;font-size:1.9rem;text-shadow:0 0 25px rgba(239,68,68,0.9);">${lang === 'th' ? 'โดนคอมโบโจมตี!' : 'ATTACK COMBO!'}</h2><p style="font-size:1.25rem;font-weight:900;color:#fde047;line-height:1.4;">${lang === 'th' ? `คุณถูก <b>${esc(ev.pn)}</b> สั่งให้ต้องเล่นทั้งหมด <b>x${ev.turns || 2} เทิร์นรวด!</b>` : `You are targeted by <b>${esc(ev.pn)}</b>! You must take <b>x${ev.turns || 2} TOTAL TURNS!</b>`}</p></div>`, 'danger', 2000);
        } else {
          A.sfx('attack');
        }
        pushCombatTicker(`<span>⚡</span> <b>${esc(ev.pn)}</b> ATTACK ➔ <b>${esc(ev.tn || '')}</b> (x${ev.turns})`, 'danger');
        break;
      case 'personal':
        showCardSpotlight('personal_attack', 'personal_attack', ev.pn, null, null, 2000);
        if (isMe) {
          banner(`<div><div style="font-size:3rem;animation:bounce .4s infinite alternate;">🥊🔥</div><h2 style="color:#f97316;font-size:1.8rem;">${lang === 'th' ? 'โดนโจมตีตัวเอง!' : 'PERSONAL ATTACK!'}</h2><p style="font-size:1.2rem;font-weight:900;color:#fde047;">${lang === 'th' ? `คุณต้องเล่นเพิ่มทั้งหมด <b>x${ev.turns || 3} เทิร์นรวด!</b>` : `You must take <b>x${ev.turns || 3} TOTAL TURNS!</b>`}</p></div>`, 'danger', 2000);
        }
        pushCombatTicker(`<span>🥊</span> <b>${esc(ev.pn)}</b> PERSONAL ATTACK (x${ev.turns || 3})`, 'warn');
        break;
      case 'stolen': case 'favor_done': A.sfx('steal'); break;
      case 'shuffled':
        A.sfx('shuffle'); shakeDeck();
        banner(`<div><div style="font-size:2.8rem;animation:spin 1s ease;">🔀</div><h2 style="color:#eab308;font-size:1.6rem;">${lang === 'th' ? 'สับกองไพ่ใหม่แล้ว!' : 'DECK SHUFFLED!'}</h2><p style="font-size:1.05rem;font-weight:700;">${lang === 'th' ? `<b>${esc(ev.pn)}</b> ตะกุยสับกองจั่วใหม่เรียบร้อย!` : `<b>${esc(ev.pn)}</b> shuffled the draw pile!`}</p></div>`, 'turn', 2400);
        break;
      case 'catomic':
        A.sfx('shuffle'); shakeDeck(); flash('rgba(234,88,12,.5)', true);
        banner(`<div><div style="font-size:2.8rem;animation:bounce .4s infinite alternate;">☢️</div><h2 style="color:#ea580c;font-size:1.6rem;">${lang === 'th' ? 'ด็อกอะตอมิกบอมบ์!' : 'DOGOMIC BOMB!'}</h2><p style="font-size:1.05rem;font-weight:700;">${lang === 'th' ? 'หมาระเบิดทุกลูกถูกย้ายมาวางบนสุดของกองแล้ว! ระวัง!' : 'All puppy bombs moved to top of deck!'}</p></div>`, 'danger', 3200);
        break;
      case 'swapped':
        A.sfx('shuffle'); shakeDeck();
        banner(`<div><div style="font-size:2.8rem;">🔃</div><h2 style="color:#84cc16;font-size:1.6rem;">${lang === 'th' ? 'สลับบน-ล่าง!' : 'SWAP TOP & BOTTOM!'}</h2><p style="font-size:1.05rem;font-weight:700;">${lang === 'th' ? `<b>${esc(ev.pn)}</b> สลับการ์ดใบบนสุดกับใบล่างสุดของกอง!` : `<b>${esc(ev.pn)}</b> swapped top and bottom cards!`}</p></div>`, 'turn', 2200);
        break;
      case 'reverse':
        A.sfx('magic');
        banner(`<div><div style="font-size:2.8rem;">🔁</div><h2 style="color:#f59e0b;font-size:1.6rem;">${lang === 'th' ? 'วิ่งย้อนศร (Reverse)!' : 'ORDER REVERSED!'}</h2><p style="font-size:1.05rem;font-weight:700;">${lang === 'th' ? `<b>${esc(ev.pn)}</b> สลับทิศทางการเล่นวนกลับ!` : `<b>${esc(ev.pn)}</b> reversed the play direction!`}</p></div>`, 'turn', 2200);
        break;
      case 'clairvoyance':
        A.sfx('magic');
        if (!isMe) banner(`${ava}<div><div style="font-size:2.8rem;">🧿</div><h2 style="color:#c084fc;font-size:1.6rem;">${lang === 'th' ? 'จมูกทิพย์!' : 'SUPER SNOUT!'}</h2><p style="font-size:1.05rem;font-weight:700;">${lang === 'th' ? `<b>${esc(ev.pn)}</b> ดมกลิ่นรู้ตำแหน่งของหมาระเบิดในกองแล้ว!` : `<b>${esc(ev.pn)}</b> sniffed out the bomb location!`}</p></div>`, 'turn', 2600);
        break;
      case 'peek':
        A.sfx('magic');
        if (!isMe) banner(`${ava}<div><div style="font-size:2.6rem;">🔮</div><h2 style="color:#06b6d4;font-size:1.5rem;">${lang === 'th' ? 'ดมกลิ่นอนาคต' : 'SNIFF THE FUTURE'}</h2><p style="font-size:1.05rem;font-weight:700;">${lang === 'th' ? `<b>${esc(ev.pn)}</b> แอบดูการ์ด <b>${ev.n || 3} ใบบนสุด</b> ของกอง!` : `<b>${esc(ev.pn)}</b> peeked at the top <b>${ev.n || 3} cards</b>!`}</p></div>`, 'turn', 2200);
        break;
      case 'altered':
        A.sfx('magic');
        if (!isMe) banner(`${ava}<div><div style="font-size:2.6rem;">🪄</div><h2 style="color:#c026d3;font-size:1.5rem;">${lang === 'th' ? 'เปลี่ยนอนาคต' : 'ALTER THE FUTURE'}</h2><p style="font-size:1.05rem;font-weight:700;">${lang === 'th' ? `<b>${esc(ev.pn)}</b> จัดเรียงการ์ดบนสุดของกองใหม่แล้ว!` : `<b>${esc(ev.pn)}</b> rearranged the top cards!`}</p></div>`, 'turn', 2200);
        break;
      case 'revived': A.sfx('magic'); banner(`<h2>🧟 ${esc(text)}</h2>`, 'turn'); break;
      case 'barking': A.sfx('bark'); break;
      case 'win':
        A.stopHeartbeat();
        document.body.classList.remove('emergency-alarm');
        A.sfx('win'); confetti(false); banner(`${ava}<h2>🏆 ${esc(text)}</h2>`, 'win', 3500); prio = true;
        pushCombatTicker(`<span>🏆</span> <b>${esc(ev.pn)}</b> ${t('won')}!`, 'good');
        break;
      case 'prompt_auto':
        A.sfx('tick');
        banner(`${ava}<div><div style="font-size:2.5rem;">⏰</div><h2 style="color:#eab308;font-size:1.4rem;">${lang === 'th' ? 'หมดเวลาตัดสินใจ!' : 'TIME EXPIRED!'}</h2><p style="font-size:1.05rem;font-weight:700;">${esc(text)}</p></div>`, 'turn', 2500);
        break;
      case 'timeout':
        A.sfx('tick');
        banner(`${ava}<div><div style="font-size:2.5rem;">⏰</div><h2 style="color:#ef4444;font-size:1.4rem;">${lang === 'th' ? 'หมดเวลาเทิร์น!' : 'TURN TIMEOUT!'}</h2><p style="font-size:1.05rem;font-weight:700;">${esc(text)}</p></div>`, 'danger', 2500);
        break;
      case 'joined': case 'ready': if (isMe) speak = ''; A.sfx('click'); break;
    }
    if (speak) A.say(speak, lang, { priority: prio });
  }

  function renderSnoutDeckVisual(pos, deckSize) {
    deckSize = Math.max(1, Math.min(24, deckSize || 10));
    const maxSlots = Math.min(deckSize, 10);
    let slots = [];
    for (let i = 0; i < maxSlots; i++) {
      const isBombSlot = (i === pos);
      slots.push(`
        <div class="snout-slot ${isBombSlot ? 'is-bomb' : ''}">
          <div class="snout-card-pill">${isBombSlot ? '💣' : '#' + (i + 1)}</div>
          <span>#${i + 1}</span>
        </div>
      `);
    }
    if (deckSize > maxSlots) {
      slots.push(`<div class="snout-slot"><div class="snout-card-pill" style="opacity:0.5;">...</div><span>+${deckSize - maxSlots}</span></div>`);
    }
    return slots.join('');
  }

  function onPrivate(ev) {
    switch (ev.type) {
      case 'drawn': flyCards([ev.cardId], `${t('youDrew')} ${esc(cname(ev.cardId))}`); break;
      case 'future': {
        const from = ev.fromId ? pl(ev.fromId) : null;
        clearModalAuto();
        const duration = (ev.cardIds?.length || 3) > 3 ? 7000 : 5000;
        const dl = now() + duration;
        const timer = modalTimerHTML(dl, lang === 'th' ? 'ปิดอัตโนมัติเมื่อหมดเวลา' : 'Auto-closes on timeout');
        openModal(`<h2>🔮 ${t('futureTitle')}</h2>${timer}${from ? `<p>${t('sharedBy')} ${esc(from.name)}</p>` : ''}<div class="alter-row">${ev.cardIds.map((id, i) => `<div class="alter-slot"><small>#${i + 1}</small>${cardHTML(id)}</div>`).join('')}</div>
          <div style="margin-top:16px;display:flex;justify-content:center;">
            <button class="btn big gold" id="btnFutureDone">👁️ ${lang === 'th' ? 'เข้าใจแล้ว (ปิดเลย)' : 'Got it (Close)'}</button>
          </div>`, { cls: 'wide' });
        $('#btnFutureDone').onclick = () => { A.sfx('click'); closeModal(true); };
        modalAutoTimer = setTimeout(() => closeModal(true), duration);
        A.sfx('magic'); break;
      }
      case 'received': {
        const fromName = pl(ev.fromId)?.name || (lang === 'th' ? 'เพื่อน' : 'Friend');
        A.sfx('cardGain');
        flash('rgba(34,197,94,.45)');
        banner(`<div class="steal-popup-card gain"><span class="steal-pop-ico">🎁</span><div><h3 style="color:#4ade80;margin:0 0 4px 0;font-size:1.25rem;">${lang === 'th' ? 'ได้รับไพ่ใหม่!' : 'CARD RECEIVED!'}</h3><p style="margin:0;font-size:0.95rem;color:#f8fafc;">${lang === 'th' ? `คุณได้รับ <b>${esc(cname(ev.cardId))}</b> จาก <b>${esc(fromName)}</b>!` : `You received <b>${esc(cname(ev.cardId))}</b> from <b>${esc(fromName)}</b>!`}</p></div>${cardHTML(ev.cardId, { cls: 'sm' })}</div>`, 'win', 3800);
        toast(`🎁 ${t('received')} <b>${esc(cname(ev.cardId))}</b> ${t('from')} ${esc(fromName)}`, 'good');
        break;
      }
      case 'lost': {
        const toName = pl(ev.toId)?.name || (lang === 'th' ? 'เพื่อน' : 'Friend');
        A.sfx('cardLost');
        flash('rgba(239,68,68,.55)', true);
        banner(`<div class="steal-popup-card loss"><span class="steal-pop-ico">😿</span><div><h3 style="color:#f87171;margin:0 0 4px 0;font-size:1.25rem;">${lang === 'th' ? 'ถูกขโมยการ์ด!' : 'CARD STOLEN!'}</h3><p style="margin:0;font-size:0.95rem;color:#f8fafc;">${lang === 'th' ? `คุณถูก <b>${esc(toName)}</b> ขโมย <b>${esc(cname(ev.cardId))}</b> ไป!` : `<b>${esc(toName)}</b> stole your <b>${esc(cname(ev.cardId))}</b>!`}</p></div>${cardHTML(ev.cardId, { cls: 'sm' })}</div>`, 'danger', 3800);
        toast(`😿 ${t('lost')} <b>${esc(cname(ev.cardId))}</b> ${t('to')} ${esc(toName)}`, 'warn');
        break;
      }
      case 'clairvoyance': {
        A.sfx('magic');
        clearModalAuto();
        const dl = now() + 6500;
        const deckSize = ev.deckSize || 10;
        const modalHtml = `
          <div class="snout-modal">
            <div class="snout-icon">🧿</div>
            <h2 class="snout-title">${lang === 'th' ? 'จมูกทิพย์ (Super Snout)' : 'Super Snout'}</h2>
            <div class="snout-card-display">
              ${ev.pos >= 0 ? `
                <div class="snout-badge danger">
                  <span class="snout-num">#${ev.pos + 1}</span>
                </div>
                <p class="snout-desc">
                  ${lang === 'th' ? `หมาระเบิดลูกที่ใกล้ที่สุด อยู่ลำดับที่ <b>#${ev.pos + 1}</b> จากบนสุดของกองจั่ว!` : `The nearest puppy bomb is at position <b>#${ev.pos + 1}</b> from top of deck!`}</p>
                <div class="snout-deck-visual">
                  ${renderSnoutDeckVisual(ev.pos, deckSize)}
                </div>
                <div class="snout-warning ${ev.pos === 0 ? 'critical' : 'safe'}">
                  ${ev.pos === 0 
                    ? (lang === 'th' ? '⚠️ อันตรายสูงสุด! การ์ดใบถัดไปคือหมาระเบิดทันที!' : '⚠️ CRITICAL DANGER! The next card is a puppy bomb!') 
                    : (lang === 'th' ? `✅ ปลอดภัยสำหรับการจั่วอีก ${ev.pos} ใบถัดไป` : `✅ Safe to draw the next ${ev.pos} cards`)}
                </div>
              ` : `
                <div class="snout-badge safe">
                  <span class="snout-num">🎉</span>
                </div>
                <p class="snout-desc">
                  ${lang === 'th' ? '<b>ปลอดภัย 100%!</b> ไม่มีหมาระเบิดหลงเหลืออยู่ในกองจั่วแล้ว!' : '<b>100% Safe!</b> No puppy bombs left in the deck!'}
                </p>
              `}
            </div>
            <div class="prompt-timer-wrap" style="margin-top:10px;">
              <div class="prompt-timer-header">
                <span>⏱️ ${lang === 'th' ? 'ปิดอัตโนมัติใน' : 'Auto closing in'}</span>
                <span class="prompt-timer-sec" id="snoutTimer" data-dl="${dl}">6s</span>
              </div>
              <div class="prompt-timer-bar"><i style="animation-duration:6500ms;"></i></div>
            </div>
            <button class="btn big gold" id="snoutCloseBtn" style="width:100%;margin-top:8px;">${lang === 'th' ? 'รับทราบ (จำได้แล้ว!)' : 'Got it!'}</button>
          </div>
        `;
        openModal(modalHtml, { locked: false });
        const closeBtn = $('#snoutCloseBtn');
        if (closeBtn) closeBtn.onclick = () => closeModal(true);
        modalAutoTimer = setTimeout(() => closeModal(true), 6500);

        banner(`<div class="snout-banner-popup"><span style="font-size:2.2rem;">🧿</span> <div><h3 style="margin:0;color:#c084fc;font-size:1.25rem;">${lang === 'th' ? 'ผลตรวจจมูกทิพย์!' : 'SUPER SNOUT RESULT!'}</h3><p style="margin:2px 0 0 0;font-size:1rem;color:#fff;">${ev.pos >= 0 ? (lang === 'th' ? `หมาระเบิดอยู่ลำดับที่ <b>#${ev.pos + 1}</b>` : `Bomb is at <b>#${ev.pos + 1}</b>`) : (lang === 'th' ? 'ไม่มีระเบิดในกองแล้ว!' : 'No bombs in deck!')}</p></div></div>`, 'win', 4500);
        break;
      }
      case 'streak_hold': toast('🍑 ' + t('streakHold'), 'good'); A.sfx('defuse'); break;
    }
  }

  function onGameOver({ results }) {
    A.stopHeartbeat();
    document.body.classList.remove('emergency-alarm');
    setTimeout(() => showResults(results, true), 2600);
  }
  function showResults(results, fresh) {
    const isHost = me()?.isHost;
    const mine = results.find(r => r.id === S?.me?.id);
    openModal(`<h2>🏁 ${t('gameOver')}</h2><div class="results">${results.map(r => `
      <div class="res-row place${r.place} ${r.id === S?.me?.id ? 'me' : ''}"><b>${['🥇', '🥈', '🥉'][r.place - 1] || '#' + r.place}</b><span>${esc(r.avatar)} ${esc(r.name)}</span>
      ${r.reward ? `<span class="reward">🪙 +${r.reward.coins} · ${r.reward.rp >= 0 ? '+' : ''}${r.reward.rp} RP</span>` : '<span></span>'}</div>`).join('')}</div>
      ${!user ? `<p class="note">${t('guestNote')}</p>` : ''}
      <div class="row">${isHost ? `<button class="btn big gold" id="resLobby">🔄 ${t('playAgain')}</button>` : `<span class="note" style="align-self:center;">⏳ ${lang === 'th' ? 'รอหัวหน้าห้องเริ่มตาใหม่...' : 'Waiting for host to restart...'}</span>`}<button class="btn big" id="resHome">🏠 ${t('home')}</button></div>`, { cls: 'results-modal' });
    if (fresh && mine && mine.reward) { A.sfx('coin'); if (mine.place === 1) confetti(true); }
    const l = $('#resLobby'); if (l) l.onclick = () => { closeModal(true); socket.emit('backToLobby'); };
    $('#resHome').onclick = () => { closeModal(true); socket.emit('leaveRoom'); };
  }

  function roulette(order, firstId) {
    const els = order.map(id => seatEl(id)).filter(Boolean); if (!els.length) return;
    const target = order.indexOf(firstId);
    const total = els.length * 3 + target; let i = 0;
    const step = () => {
      els.forEach(e => e.classList.remove('roulette')); els[i % els.length].classList.add('roulette'); A.sfx('roulette');
      if (i >= total) { setTimeout(() => els.forEach(e => e.classList.remove('roulette')), 900); const p = pl(firstId); A.say(fill(ANN[lang].first, { pn: p?.name }), lang); banner(`${p ? avatarHTML(p, 'lg') : ''}<h2>🎲 ${esc(fill(ANN[lang].first, { pn: p?.name }))}</h2>`, 'win', 1600); return; }
      i++; setTimeout(step, 60 + Math.pow(i / total, 3) * 380);
    };
    step();
  }
  function animateDraw(pid) {
    const deck = $('#deckPile'), target = seatEl(pid); if (!deck || !target || screen !== 'game') return;
    const a = deck.getBoundingClientRect(), b = target.getBoundingClientRect();
    const c = document.createElement('div'); c.className = 'card back flying ' + (pl(pid)?.skin || '');
    c.style.left = a.left + 'px'; c.style.top = a.top + 'px';
    document.body.appendChild(c);
    requestAnimationFrame(() => { c.style.transform = `translate(${b.left + b.width / 2 - a.left - 30}px, ${b.top + 20 - a.top}px) rotate(20deg) scale(.6)`; c.style.opacity = '.2'; });
    setTimeout(() => c.remove(), 700);
  }
  function shakeDeck() { const d = $('#deckPile'); d.classList.remove('shuffling'); void d.offsetWidth; d.classList.add('shuffling'); }

  // ------------------------------------------------------------ timers loop (60fps rAF)
  function tickLoop() {
    if (S && S.state === 'PLAYING' && screen === 'game') {
      const arc = $('#timerArc'); const txt = $('#timerText');
      let dl = 0, total = 1;
      const isTurnPhase = S.phase === 'turn' && !S.pending && !S.prompt && !!S.turnDeadline;
      const isPausedBySpotlight = isTurnPhase && spotlightActive;
      if (isTurnPhase && !isPausedBySpotlight) {
        dl = S.turnDeadline;
        total = Math.max(1, (S.settings.turnSeconds || 25) * 1000);
      } else if (S.prompt) {
        dl = S.prompt.deadline;
        total = Math.max(1, (S.prompt.data?.timeoutMs || 15000));
      }
      const left = dl ? Math.max(0, dl - now()) : 0;
      if (arc) arc.style.strokeDashoffset = dl ? 100 - (left / total) * 100 : (isPausedBySpotlight ? 0 : 100);
      const secs = Math.ceil(left / 1000);
      const isActionPaused = (!isTurnPhase && (S.pending || S.prompt || S.phase !== 'turn')) || isPausedBySpotlight;
      const label = dl ? String(secs) : (isActionPaused ? '⏸️' : '∞');
      if (txt && txt.textContent !== label) txt.textContent = label;
      const mySec = $('#myTurnSec');
      if (mySec) {
        if (isTurnPhase && dl && !isPausedBySpotlight) {
          mySec.textContent = `(00:${String(secs).padStart(2, '0')})`;
        } else if (isActionPaused) {
          mySec.textContent = `(⏸️)`;
        } else {
          mySec.textContent = '';
        }
      }
      $('#timerRing')?.classList.toggle('urgent', isTurnPhase && !isPausedBySpotlight && !!dl && left < 5000);
      const myTurn = S.turnId === S.me?.id && isTurnPhase && !isPausedBySpotlight;
      if (myTurn && dl && secs <= 5 && secs !== lastTick && secs > 0) { lastTick = secs; A.sfx('tick'); }
      if (S.pending) {
        const showUntil = S.pending.showUntil || 0;
        const nowMs = now();
        const btnN = $('#btnNope');
        if (nowMs < showUntil) {
          $('#nopeFill').style.width = '100%';
          if (btnN) {
            btnN.textContent = `🛑 ${t('nope') || 'NOPE'}`;
            btnN.classList.remove('pulse-fast');
          }
        } else {
          const duration = Math.max(1000, (S.pending.deadline - showUntil) || (S.settings.nopeSeconds * 1000));
          const pLeft = Math.max(0, S.pending.deadline - nowMs);
          const pct = Math.min(100, Math.max(0, (pLeft / duration) * 100));
          $('#nopeFill').style.width = pct + '%';
          const pSec = Math.ceil(pLeft / 1000);
          if (btnN) {
            btnN.textContent = `🛑 ${t('nope') || 'NOPE'} (${pSec}s)`;
            btnN.classList.toggle('pulse-fast', pSec <= 2);
          }
        }
      }

      // Update any active modal/prompt countdown text
      const pWrap = $('#promptTimerWrap');
      if (pWrap) {
        const pdl = +pWrap.dataset.deadline;
        if (pdl) {
          const pLeft = Math.max(0, pdl - now());
          const pSec = Math.ceil(pLeft / 1000);
          const pSecEl = $('#promptTimerSec');
          if (pSecEl) {
            pSecEl.textContent = pSec + 's';
            pSecEl.classList.toggle('urgent', pSec <= 5);
          }
        }
      }
      // Update Super Snout auto-close countdown
      const sTimerEl = $('#snoutTimer');
      if (sTimerEl && sTimerEl.dataset.dl) {
        const sLeft = Math.max(0, +sTimerEl.dataset.dl - now());
        sTimerEl.textContent = Math.ceil(sLeft / 1000) + 's';
      }
    }
    requestAnimationFrame(tickLoop);
  }
  requestAnimationFrame(tickLoop);

  // ------------------------------------------------------------ 3D Buzzer / side panel / stickers / menu
  const buzBtn = $('#arcadeBuzzer');
  if (buzBtn) {
    buzBtn.onclick = () => {
      if (!S || !S.me) return;
      const hasNope = S.pending && me()?.alive && S.me.hand.some(c => c.id === 'nope');
      if (hasNope) return doQuickNope();
      const pv = playValidity();
      const m = me();
      const canAct = S.state === 'PLAYING' && S.turnId === m?.id && m?.alive && S.phase === 'turn';
      if (pv.ok && (canAct || pv.nope)) return doPlay();
      if (canDrawNow()) return doDraw();
      A.sfx('click');
    };
  }
  $('#btnLog').onclick = () => $('#sidePanel').classList.toggle('hidden');
  $$('#sidePanel [data-tab]').forEach(b => b.onclick = () => {
    $$('#sidePanel [data-tab]').forEach(x => x.classList.toggle('active', x === b));
    $('#logBox').classList.toggle('hidden', b.dataset.tab !== 'log'); $('#gameChat').classList.toggle('hidden', b.dataset.tab !== 'chat');
  });
  $('#btnSticker').onclick = () => {
    const owned = user ? SHOP.filter(s => s.type === 'sticker' && user.inventory.includes(s.id)) : [];
    const list = [...FREE_STICKERS, ...owned];
    const p = $('#stickerPicker');
    p.innerHTML = list.map(s => `<button data-sk="${s.id}" title="${esc(s.label || '')}"><b>${esc(s.label || '')}</b><span>${s.icon}</span></button>`).join('') + `<button data-sk="shop" class="more">🛒</button>`;
    p.classList.toggle('hidden');
    $$('[data-sk]', p).forEach(b => b.onclick = () => { p.classList.add('hidden'); if (b.dataset.sk === 'shop') { shopTab = 'sticker'; return openShop(); } socket.emit('sticker', { id: b.dataset.sk }); });
  };
  $('#btnGameMenu').onclick = () => {
    openModal(`<h2>☰</h2><div class="menu-list">
      <button class="btn" id="gmRules">📖 ${t('rules')}</button>
      <button class="btn" id="gmSound">${A.opt.sound ? '🔊' : '🔇'} ${t('sound')}</button>
      <button class="btn" id="gmVoice">${A.opt.voice ? '🗣️' : '🤐'} ${t('voice')}</button>
      <button class="btn" id="gmLang">🌐 ${t('lang')}: ${lang.toUpperCase()}</button>
      <button class="btn red" id="gmLeave">🚪 ${t('leave')}</button></div>`);
    $('#gmRules').onclick = openRules;
    $('#gmSound').onclick = () => { $('#btnSound').click(); $('#btnGameMenu').click(); };
    $('#gmVoice').onclick = () => { $('#btnVoice').click(); $('#btnGameMenu').click(); };
    $('#gmLang').onclick = () => { $('#btnLang').click(); $('#btnGameMenu').click(); };
    $('#gmLeave').onclick = () => { closeModal(true); socket.emit('leaveRoom'); };
  };

  // ------------------------------------------------------------ boot
  (async () => {
    imgMap = await fetch('/api/card-images').then(r => r.json()).catch(() => ({}));
    if (imgMap.card_back) document.documentElement.style.setProperty('--back-img', `url(${imgMap.card_back})`);
    syncToggles(); await loadMe(); applyI18n();
    const room = new URLSearchParams(location.search).get('room');
    if (room) {
      const code = room.trim().toUpperCase();
      const inp = $('#browserCodeInp') || $('#mbCode');
      if (inp) inp.value = code;
      setTimeout(() => {
        socket.emit('joinRoom', { code, name: myName() });
      }, 350);
    }
  })();
})();
