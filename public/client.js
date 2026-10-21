/* Exploding Kittens Online — client */
(() => {
  const { CARDS, VERSIONS, CONFIGURABLE, SHOP, FREE_STICKERS, CARD_KINDS, rankOf, TITLES, STAKES } = window.EK;
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
  let lastSettingsStructKey = '';
  let openPromptKey = null;
  let lastTick = -1;
  let homeVersion = localStorage.getItem('ek_ver') || 'original';
  if (!VERSIONS[homeVersion]) homeVersion = 'original';
  let isGuestSessionActive = false;

  const t = (k) => (I18N[lang][k] ?? I18N.en[k] ?? k);
  const terr = (e) => I18N[lang].err[e] || e;
  const cname = (id) => CARDS[id] ? CARDS[id].name[lang] : id;
  const cdesc = (id) => CARDS[id] ? CARDS[id].desc[lang] : '';
  const me = () => {
    if (!S || !S.me) return null;
    const pl = S.players.find(p => p.id === S.me.id);
    if (pl) return pl;
    if (S.me.isSpectator) {
      return {
        id: S.me.id,
        name: S.me.name || myName(),
        avatar: S.me.avatar || myAvatar(),
        frame: S.me.frame || myFrame(),
        skin: S.me.skin || mySkin(),
        title: S.me.title || myTitle(),
        hand: S.me.hand || [],
        alive: false,
        isSpectator: true,
        isHost: !!S.me.isHost,
        rp: user ? user.rp : 0
      };
    }
    return S.me;
  };
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
  function renderAvatarSVG(av, fallbackTheme = 'gold') {
    if (!av) av = fallbackTheme;
    if (av === 'av_shiba_vip' || av === 'av_golden_shiba' || av === 'gold' || av === 'emerald' || av === 'original') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gVipShiba" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="60%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#78350f"/>
          </radialGradient>
          <linearGradient id="gVipChain" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="50%" stop-color="#fde047"/>
            <stop offset="100%" stop-color="#b45309"/>
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gVipShiba)"/>
        <polygon points="22,46 32,10 52,34" fill="#d97706" stroke="#1c1208" stroke-width="4" stroke-linejoin="round"/>
        <polygon points="28,42 34,18 48,34" fill="#fef3c7"/>
        <polygon points="98,46 88,10 68,34" fill="#d97706" stroke="#1c1208" stroke-width="4" stroke-linejoin="round"/>
        <polygon points="92,42 86,18 72,34" fill="#fef3c7"/>
        <path d="M26,95 Q60,78 94,95 L98,118 L22,118 Z" fill="#b45309" stroke="#1c1208" stroke-width="4"/>
        <ellipse cx="60" cy="62" rx="36" ry="32" fill="#fbbf24" stroke="#1c1208" stroke-width="4"/>
        <ellipse cx="60" cy="70" rx="22" ry="16" fill="#fef3c7"/>
        <path d="M48,74 Q60,82 72,74" fill="none" stroke="#1c1208" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M58,77 C56,88 68,88 65,76 Z" fill="#fb7185" stroke="#1c1208" stroke-width="2.5"/>
        <ellipse cx="60" cy="65" rx="8" ry="5.5" fill="#1c1208"/>
        <rect x="25" y="44" width="31" height="17" rx="5" fill="#111827" stroke="#fde047" stroke-width="3.5"/>
        <rect x="64" y="44" width="31" height="17" rx="5" fill="#111827" stroke="#fde047" stroke-width="3.5"/>
        <line x1="56" y1="51" x2="64" y2="51" stroke="#fde047" stroke-width="3.5"/>
        <line x1="31" y1="48" x2="43" y2="57" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="70" y1="48" x2="82" y2="57" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M32,94 Q60,110 88,94" fill="none" stroke="url(#gVipChain)" stroke-width="7" stroke-dasharray="8 4" stroke-linecap="round"/>
        <circle cx="60" cy="106" r="6.5" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
        <text x="60" y="109" font-size="7" font-weight="900" fill="#78350f" text-anchor="middle">$</text>
      </svg>`;
    }
    if (av === 'av_cyber_husky' || av === 'neon' || av === 'cyber' || av === 'streaking') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gHusky" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="60%" stop-color="#1e1b4b"/>
            <stop offset="100%" stop-color="#090d16"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gHusky)"/>
        <polygon points="24,46 30,10 52,34" fill="#334155" stroke="#0f172a" stroke-width="4"/>
        <polygon points="30,42 33,18 47,34" fill="#ec4899"/>
        <polygon points="96,46 90,10 68,34" fill="#334155" stroke="#0f172a" stroke-width="4"/>
        <polygon points="90,42 87,18 73,34" fill="#ec4899"/>
        <path d="M26,95 Q60,80 94,95 L98,118 L22,118 Z" fill="#1e293b" stroke="#0f172a" stroke-width="4"/>
        <line x1="60" y1="92" x2="60" y2="118" stroke="#06b6d4" stroke-width="3"/>
        <ellipse cx="60" cy="62" rx="35" ry="32" fill="#64748b" stroke="#0f172a" stroke-width="4"/>
        <ellipse cx="60" cy="68" rx="24" ry="18" fill="#f1f5f9"/>
        <path d="M50,74 Q60,83 70,74" fill="none" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M56,76 C56,88 66,88 65,76 Z" fill="#fb7185" stroke="#0f172a" stroke-width="2.5"/>
        <ellipse cx="60" cy="65" rx="7.5" ry="5" fill="#0f172a"/>
        <rect x="20" y="40" width="80" height="22" rx="8" fill="#090d16" stroke="#22d3ee" stroke-width="3.5"/>
        <rect x="25" y="44" width="70" height="14" rx="5" fill="#f43f5e" opacity="0.9"/>
        <circle cx="42" cy="51" r="4.5" fill="#a5f3fc"/><circle cx="78" cy="51" r="4.5" fill="#a5f3fc"/>
        <line x1="52" y1="51" x2="68" y2="51" stroke="#a5f3fc" stroke-width="2.5"/>
        <line x1="20" y1="46" x2="12" y2="38" stroke="#22d3ee" stroke-width="3" stroke-linecap="round"/>
        <line x1="100" y1="46" x2="108" y2="38" stroke="#22d3ee" stroke-width="3" stroke-linecap="round"/>
      </svg>`;
    }
    if (av === 'av_corgi_galaxy' || av === 'av_corgi_astro' || av === 'galaxy' || av === 'cosmic' || av === 'party') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gCorgiGal" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#c084fc"/>
            <stop offset="50%" stop-color="#4f46e5"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gCorgiGal)"/>
        <circle cx="30" cy="28" r="1.5" fill="#fff" opacity="0.8"/>
        <circle cx="92" cy="24" r="1.5" fill="#fff" opacity="0.8"/>
        <circle cx="86" cy="78" r="1.2" fill="#fff" opacity="0.6"/>
        <path d="M26,92 Q60,78 94,92 L98,118 L22,118 Z" fill="#f8fafc" stroke="#1e293b" stroke-width="4"/>
        <rect x="46" y="96" width="28" height="14" rx="4" fill="#38bdf8" stroke="#1e293b" stroke-width="2.5"/>
        <polygon points="24,50 28,14 50,36" fill="#fb923c" stroke="#1c1208" stroke-width="3.5"/>
        <polygon points="96,50 92,14 70,36" fill="#fb923c" stroke="#1c1208" stroke-width="3.5"/>
        <ellipse cx="60" cy="62" rx="33" ry="29" fill="#fb923c" stroke="#1c1208" stroke-width="3.5"/>
        <ellipse cx="60" cy="68" rx="20" ry="16" fill="#fff"/>
        <circle cx="46" cy="55" r="6" fill="#1c1208"/><circle cx="74" cy="55" r="6" fill="#1c1208"/>
        <circle cx="44" cy="53" r="2.2" fill="#fff"/><circle cx="72" cy="53" r="2.2" fill="#fff"/>
        <ellipse cx="60" cy="63" rx="7" ry="5" fill="#1c1208"/>
        <path d="M55,72 C55,83 66,83 65,72 Z" fill="#fb7185" stroke="#1c1208" stroke-width="2"/>
        <circle cx="60" cy="58" r="46" fill="rgba(186,230,253,0.2)" stroke="#bae6fd" stroke-width="3.5"/>
        <path d="M28,36 A38,38 0 0,1 58,18" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>
      </svg>`;
    }
    if (av === 'custom_bulldog' || av === 'sandbox' || av === 'custom') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gBulldogSand" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#fdba74"/>
            <stop offset="60%" stop-color="#c2410c"/>
            <stop offset="100%" stop-color="#431407"/>
          </radialGradient>
          <linearGradient id="gCrownGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="40%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#b45309"/>
          </linearGradient>
          <linearGradient id="gWrenchSilver" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="50%" stop-color="#94a3b8"/>
            <stop offset="100%" stop-color="#475569"/>
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gBulldogSand)"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(251,191,36,0.2)" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="18" y="34" font-size="12" fill="#fbbf24" opacity="0.7">⚡</text>
        <text x="96" y="38" font-size="11" fill="#fbbf24" opacity="0.8">✨</text>
        <ellipse cx="28" cy="46" rx="12" ry="16" fill="#7c2d12" stroke="#1c1208" stroke-width="3" transform="rotate(-20 28 46)"/>
        <ellipse cx="92" cy="46" rx="12" ry="16" fill="#7c2d12" stroke="#1c1208" stroke-width="3" transform="rotate(20 92 46)"/>
        <path d="M26,96 Q60,82 94,96 L98,118 L22,118 Z" fill="#9a3412" stroke="#1c1208" stroke-width="3.5"/>
        <path d="M30,94 Q60,104 90,94" fill="none" stroke="#dc2626" stroke-width="9" stroke-linecap="round"/>
        <circle cx="60" cy="102" r="5" fill="#fde047" stroke="#b45309" stroke-width="2"/>
        <ellipse cx="60" cy="64" rx="34" ry="28" fill="#ea580c" stroke="#1c1208" stroke-width="3.5"/>
        <ellipse cx="44" cy="74" rx="14" ry="12" fill="#fed7aa" stroke="#1c1208" stroke-width="3"/>
        <ellipse cx="76" cy="74" rx="14" ry="12" fill="#fed7aa" stroke="#1c1208" stroke-width="3"/>
        <ellipse cx="60" cy="66" rx="10" ry="7" fill="#0f172a"/>
        <path d="M54,80 C54,92 66,92 66,80 Z" fill="#f43f5e" stroke="#1c1208" stroke-width="2"/>
        <ellipse cx="45" cy="54" rx="5" ry="6" fill="#0f172a"/>
        <circle cx="43" cy="52" r="2" fill="#fff"/>
        <ellipse cx="75" cy="54" rx="5" ry="6" fill="#0f172a"/>
        <circle cx="73" cy="52" r="2" fill="#fff"/>
        <path d="M50,44 Q60,40 70,44" fill="none" stroke="#7c2d12" stroke-width="2.5" stroke-linecap="round"/>
        <polygon points="40,32 46,16 54,26 60,12 66,26 74,16 80,32" fill="url(#gCrownGold)" stroke="#78350f" stroke-width="2.5"/>
        <circle cx="60" cy="12" r="2" fill="#ef4444"/>
        <circle cx="46" cy="16" r="1.5" fill="#38bdf8"/>
        <circle cx="74" cy="16" r="1.5" fill="#10b981"/>
        <g transform="translate(76, 52) rotate(35)">
          <path d="M0,0 L24,0 L24,6 L0,6 Z" fill="url(#gWrenchSilver)" stroke="#0f172a" stroke-width="1.5"/>
          <path d="M22,-4 C26,-4 28,-1 28,3 C28,7 26,10 22,10 L18,8 L20,3 L18,-2 Z" fill="url(#gWrenchSilver)" stroke="#0f172a" stroke-width="1.5"/>
        </g>
      </svg>`;
    }
    if (av === 'av_blaze_bulldog' || av === 'fire' || av === 'crimson' || av === 'barking') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gBulldog" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#f97316"/>
            <stop offset="60%" stop-color="#b91c1c"/>
            <stop offset="100%" stop-color="#450a0a"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gBulldog)"/>
        <path d="M24,92 L60,112 L96,92 L98,118 L22,118 Z" fill="#991b1b" stroke="#1c1208" stroke-width="4"/>
        <polygon points="60,94 52,114 68,114" fill="#f59e0b"/>
        <ellipse cx="60" cy="64" rx="38" ry="33" fill="#d97706" stroke="#1c1208" stroke-width="4"/>
        <path d="M24,52 Q60,22 96,52 Q60,42 24,52 Z" fill="#18181b" stroke="#1c1208" stroke-width="3.5"/>
        <circle cx="50" cy="40" r="2.5" fill="#ef4444"/><circle cx="70" cy="40" r="2.5" fill="#ef4444"/>
        <ellipse cx="60" cy="74" rx="26" ry="16" fill="#fef3c7" stroke="#1c1208" stroke-width="3.5"/>
        <path d="M40,78 Q60,70 80,78" fill="none" stroke="#1c1208" stroke-width="4" stroke-linecap="round"/>
        <polygon points="44,76 48,67 52,76" fill="#fff" stroke="#1c1208" stroke-width="2"/>
        <polygon points="68,76 72,67 76,76" fill="#fff" stroke="#1c1208" stroke-width="2"/>
        <ellipse cx="60" cy="64" rx="8.5" ry="5.5" fill="#1c1208"/>
        <circle cx="44" cy="55" r="6.5" fill="#7f1d1d"/><circle cx="76" cy="55" r="6.5" fill="#7f1d1d"/>
        <circle cx="44" cy="55" r="3.5" fill="#fbbf24"/><circle cx="76" cy="55" r="3.5" fill="#fbbf24"/>
        <line x1="33" y1="47" x2="53" y2="53" stroke="#1c1208" stroke-width="4.5" stroke-linecap="round"/>
        <line x1="87" y1="47" x2="67" y2="53" stroke="#1c1208" stroke-width="4.5" stroke-linecap="round"/>
      </svg>`;
    }
    if (av === 'av_god_shiba' || av === 'av_sun_god' || av === 'rainbow' || av === 'mega') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gSunGod" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#fffbeb"/>
            <stop offset="35%" stop-color="#fbbf24"/>
            <stop offset="75%" stop-color="#b45309"/>
            <stop offset="100%" stop-color="#451a03"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gSunGod)"/>
        <g stroke="#fef08a" stroke-width="3" stroke-linecap="round" opacity="0.9">
          <line x1="60" y1="4" x2="60" y2="16"/>
          <line x1="60" y1="104" x2="60" y2="116"/>
          <line x1="4" y1="60" x2="16" y2="60"/>
          <line x1="104" y1="60" x2="116" y2="60"/>
          <line x1="20" y1="20" x2="28" y2="28"/>
          <line x1="100" y1="20" x2="92" y2="28"/>
          <line x1="20" y1="100" x2="28" y2="92"/>
          <line x1="100" y1="100" x2="92" y2="92"/>
        </g>
        <circle cx="60" cy="60" r="46" fill="none" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="8 4"/>
        <polygon points="22,48 30,12 52,36" fill="#f59e0b" stroke="#78350f" stroke-width="3.5"/>
        <polygon points="28,30 30,12 38,24" fill="#fef08a"/>
        <polygon points="98,48 90,12 68,36" fill="#f59e0b" stroke="#78350f" stroke-width="3.5"/>
        <polygon points="92,30 90,12 82,24" fill="#fef08a"/>
        <path d="M24,96 Q60,82 96,96 L100,118 L20,118 Z" fill="#991b1b" stroke="#78350f" stroke-width="3.5"/>
        <circle cx="60" cy="104" r="8" fill="#34d399" stroke="#065f46" stroke-width="2"/>
        <ellipse cx="60" cy="62" rx="35" ry="32" fill="#fbbf24" stroke="#78350f" stroke-width="3.5"/>
        <ellipse cx="60" cy="70" rx="22" ry="16" fill="#fffbeb"/>
        <path d="M60,40 L57,48 L63,48 Z" fill="#dc2626"/>
        <circle cx="60" cy="38" r="3.5" fill="#ef4444" stroke="#fef08a" stroke-width="1.5"/>
        <path d="M38,62 Q32,56 36,50" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M82,62 Q88,56 84,50" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse cx="46" cy="56" rx="6.5" ry="5.5" fill="#78350f"/>
        <ellipse cx="46" cy="56" rx="4" ry="3.5" fill="#fef08a"/>
        <ellipse cx="74" cy="56" rx="6.5" ry="5.5" fill="#78350f"/>
        <ellipse cx="74" cy="56" rx="4" ry="3.5" fill="#fef08a"/>
        <ellipse cx="60" cy="65" rx="7" ry="5" fill="#78350f"/>
        <path d="M50,74 Q60,82 70,74" fill="none" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
      </svg>`;
    }
    if (av === 'av_mecha_alpha') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gTitan" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#475569"/>
            <stop offset="60%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#020617"/>
          </radialGradient>
          <linearGradient id="gLaser" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ef4444"/>
            <stop offset="50%" stop-color="#f87171"/>
            <stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gTitan)"/>
        <polygon points="20,44 26,8 52,32" fill="#64748b" stroke="#0f172a" stroke-width="4"/>
        <polygon points="26,38 30,16 46,32" fill="#06b6d4"/>
        <polygon points="100,44 94,8 68,32" fill="#64748b" stroke="#0f172a" stroke-width="4"/>
        <polygon points="94,38 90,16 74,32" fill="#06b6d4"/>
        <path d="M22,96 L60,82 L98,96 L102,118 L18,118 Z" fill="#334155" stroke="#0f172a" stroke-width="4"/>
        <polygon points="60,88 50,108 70,108" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/>
        <polygon points="28,52 60,34 92,52 86,84 60,94 34,84" fill="#94a3b8" stroke="#0f172a" stroke-width="4"/>
        <polygon points="38,58 60,44 82,58 76,80 60,88 44,80" fill="#cbd5e1"/>
        <polygon points="30,56 90,56 86,66 34,66" fill="#18181b" stroke="#ef4444" stroke-width="2.5"/>
        <line x1="34" y1="61" x2="86" y2="61" stroke="url(#gLaser)" stroke-width="5" stroke-linecap="round"/>
        <polygon points="60,70 54,76 66,76" fill="#0f172a"/>
        <line x1="52" y1="81" x2="68" y2="81" stroke="#0f172a" stroke-width="2.5"/>
        <line x1="54" y1="85" x2="66" y2="85" stroke="#0f172a" stroke-width="2.5"/>
      </svg>`;
    }
    if (av === 'av_diamond_poodle') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gDiaPoodle" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#e0e7ff"/>
            <stop offset="60%" stop-color="#a5b4fc"/>
            <stop offset="100%" stop-color="#3730a3"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gDiaPoodle)"/>
        <circle cx="26" cy="56" r="18" fill="#e0e7ff" stroke="#4338ca" stroke-width="3.5"/>
        <circle cx="94" cy="56" r="18" fill="#e0e7ff" stroke="#4338ca" stroke-width="3.5"/>
        <polygon points="40,32 50,14 60,26 70,14 80,32" fill="#38bdf8" stroke="#1e1b4b" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="50" cy="14" r="3" fill="#fff"/><circle cx="70" cy="14" r="3" fill="#fff"/>
        <polygon points="60,22 57,28 63,28" fill="#fff"/>
        <ellipse cx="60" cy="38" rx="24" ry="16" fill="#f5f3ff" stroke="#4338ca" stroke-width="3.5"/>
        <path d="M26,96 Q60,82 94,96 L98,118 L22,118 Z" fill="#6366f1" stroke="#312e81" stroke-width="4"/>
        <circle cx="44" cy="94" r="5" fill="#fff" stroke="#c7d2fe" stroke-width="1.5"/>
        <circle cx="54" cy="97" r="5.5" fill="#fff" stroke="#c7d2fe" stroke-width="1.5"/>
        <circle cx="66" cy="97" r="5.5" fill="#fff" stroke="#c7d2fe" stroke-width="1.5"/>
        <circle cx="76" cy="94" r="5" fill="#fff" stroke="#c7d2fe" stroke-width="1.5"/>
        <ellipse cx="60" cy="66" rx="26" ry="24" fill="#faf5ff" stroke="#4338ca" stroke-width="3.5"/>
        <circle cx="50" cy="62" r="5" fill="#1e1b4b"/><circle cx="48" cy="60" r="1.8" fill="#fff"/>
        <circle cx="70" cy="62" r="5" fill="#1e1b4b"/><circle cx="68" cy="60" r="1.8" fill="#fff"/>
        <line x1="46" y1="56" x2="42" y2="52" stroke="#1e1b4b" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="74" y1="56" x2="78" y2="52" stroke="#1e1b4b" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse cx="60" cy="71" rx="5.5" ry="4" fill="#ec4899"/>
        <path d="M54,78 Q60,84 66,78" fill="none" stroke="#4338ca" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;
    }
    if (av === 'av_samurai_akita') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gSamurai" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#fecaca"/>
            <stop offset="60%" stop-color="#dc2626"/>
            <stop offset="100%" stop-color="#450a0a"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gSamurai)"/>
        <path d="M38,20 Q60,6 82,20 Q60,14 38,20 Z" fill="#fbbf24" stroke="#78350f" stroke-width="3"/>
        <circle cx="60" cy="18" r="5" fill="#dc2626" stroke="#fbbf24" stroke-width="2"/>
        <path d="M22,46 Q60,22 98,46 L102,66 L90,62 L94,48 Q60,34 26,48 L30,62 L18,66 Z" fill="#1c1917" stroke="#78350f" stroke-width="3.5"/>
        <ellipse cx="60" cy="66" rx="34" ry="28" fill="#f59e0b" stroke="#1c1917" stroke-width="3.5"/>
        <ellipse cx="60" cy="72" rx="20" ry="16" fill="#fef3c7"/>
        <path d="M20,96 L60,86 L100,96 L104,118 L16,118 Z" fill="#991b1b" stroke="#1c1917" stroke-width="3.5"/>
        <line x1="30" y1="102" x2="90" y2="102" stroke="#fbbf24" stroke-width="3"/>
        <ellipse cx="46" cy="60" rx="5.5" ry="4.5" fill="#1c1917"/>
        <ellipse cx="74" cy="60" rx="5.5" ry="4.5" fill="#1c1917"/>
        <line x1="42" y1="52" x2="52" y2="56" stroke="#1c1917" stroke-width="3" stroke-linecap="round"/>
        <line x1="78" y1="52" x2="68" y2="56" stroke="#1c1917" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="60" cy="68" rx="6.5" ry="4.5" fill="#1c1917"/>
        <path d="M52,76 Q60,82 68,76" fill="none" stroke="#1c1917" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`;
    }
    if (av === 'av_ninja_dog') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gNinja" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#334155"/>
            <stop offset="60%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#020617"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gNinja)"/>
        <polygon points="24,46 32,10 52,34" fill="#1e293b" stroke="#020617" stroke-width="4"/>
        <polygon points="96,46 88,10 68,34" fill="#1e293b" stroke="#020617" stroke-width="4"/>
        <ellipse cx="60" cy="62" rx="36" ry="32" fill="#1e293b" stroke="#020617" stroke-width="4"/>
        <rect x="34" y="32" width="52" height="15" rx="4" fill="#94a3b8" stroke="#020617" stroke-width="2.5"/>
        <polygon points="60,34 62,39 67,39 63,42 65,47 60,44 55,47 57,42 53,39 58,39" fill="#0f172a"/>
        <path d="M26,62 Q60,54 94,62 L90,88 Q60,102 30,88 Z" fill="#090d16" stroke="#020617" stroke-width="3"/>
        <ellipse cx="46" cy="54" rx="6" ry="4" fill="#fbbf24" stroke="#020617" stroke-width="2"/>
        <ellipse cx="74" cy="54" rx="6" ry="4" fill="#fbbf24" stroke="#020617" stroke-width="2"/>
        <circle cx="47" cy="54" r="2" fill="#020617"/>
        <circle cx="73" cy="54" r="2" fill="#020617"/>
        <path d="M88,78 Q108,82 114,96 L104,98 Q96,86 86,84 Z" fill="#dc2626"/>
        <path d="M26,96 Q60,82 94,96 L98,118 L22,118 Z" fill="#090d16" stroke="#020617" stroke-width="4"/>
        <line x1="38" y1="98" x2="82" y2="98" stroke="#dc2626" stroke-width="4"/>
      </svg>`;
    }
    if (av === 'av_gentleman_pug') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gPug" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#fed7aa"/>
            <stop offset="60%" stop-color="#b45309"/>
            <stop offset="100%" stop-color="#451a03"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gPug)"/>
        <rect x="42" y="10" width="36" height="30" rx="4" fill="#18181b" stroke="#09090b" stroke-width="3"/>
        <rect x="42" y="32" width="36" height="7" fill="#dc2626"/>
        <ellipse cx="60" cy="40" rx="34" ry="7" fill="#27272a" stroke="#09090b" stroke-width="3"/>
        <polygon points="24,44 14,64 34,58" fill="#18181b" stroke="#09090b" stroke-width="3"/>
        <polygon points="96,44 106,64 86,58" fill="#18181b" stroke="#09090b" stroke-width="3"/>
        <ellipse cx="60" cy="68" rx="32" ry="26" fill="#fcd34d" stroke="#18181b" stroke-width="3.5"/>
        <ellipse cx="60" cy="76" rx="20" ry="14" fill="#18181b"/>
        <circle cx="44" cy="62" r="7" fill="#18181b"/><circle cx="42" cy="60" r="2.5" fill="#fff"/>
        <circle cx="76" cy="62" r="8" fill="rgba(186,230,253,0.3)" stroke="#fbbf24" stroke-width="2.5"/>
        <circle cx="76" cy="62" r="5" fill="#18181b"/><circle cx="74" cy="60" r="2" fill="#fff"/>
        <path d="M84,66 Q92,78 88,96" fill="none" stroke="#fbbf24" stroke-width="1.8" stroke-dasharray="3 2"/>
        <path d="M26,98 Q60,84 94,98 L98,118 L22,118 Z" fill="#09090b" stroke="#18181b" stroke-width="4"/>
        <polygon points="60,94 52,118 68,118" fill="#fff"/>
        <polygon points="50,96 60,100 50,104" fill="#dc2626"/>
        <polygon points="70,96 60,100 70,104" fill="#dc2626"/>
        <circle cx="60" cy="100" r="3" fill="#b91c1c"/>
      </svg>`;
    }
    if (av === 'av_zombie_pup' || av === 'undead' || av === 'zombie') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gZombie" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#2dd4bf"/>
            <stop offset="45%" stop-color="#0f766e"/>
            <stop offset="100%" stop-color="#042f2e"/>
          </radialGradient>
          <radialGradient id="gEyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#a7f3d0"/>
            <stop offset="60%" stop-color="#34d399"/>
            <stop offset="100%" stop-color="#059669"/>
          </radialGradient>
          <linearGradient id="gBone" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="100%" stop-color="#cbd5e1"/>
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gZombie)"/>
        <circle cx="60" cy="60" r="48" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-dasharray="4 6" opacity="0.4"/>
        <circle cx="22" cy="28" r="2.5" fill="#5eead4" opacity="0.8"/>
        <circle cx="98" cy="32" r="3" fill="#5eead4" opacity="0.7"/>
        <circle cx="90" cy="88" r="2" fill="#5eead4" opacity="0.6"/>
        <path d="M18,36 Q22,22 16,14 Q26,20 22,34" fill="#2dd4bf" opacity="0.5"/>
        <path d="M102,40 Q106,26 100,18 Q110,24 106,38" fill="#2dd4bf" opacity="0.5"/>
        <polygon points="22,48 30,12 50,34" fill="#115e59" stroke="#042f2e" stroke-width="4"/>
        <polygon points="28,42 32,20 44,34" fill="#2dd4bf"/>
        <line x1="26" y1="26" x2="36" y2="28" stroke="#042f2e" stroke-width="2.5"/>
        <line x1="30" y1="23" x2="32" y2="31" stroke="#042f2e" stroke-width="2"/>
        <polygon points="98,48 92,20 86,14 80,24 68,34" fill="#115e59" stroke="#042f2e" stroke-width="4"/>
        <polygon points="92,42 88,24 74,34" fill="#2dd4bf"/>
        <path d="M24,95 Q60,82 96,95 L100,118 L20,118 Z" fill="#134e4a" stroke="#042f2e" stroke-width="4"/>
        <path d="M28,94 Q60,105 92,94" fill="none" stroke="#042f2e" stroke-width="8" stroke-linecap="round"/>
        <circle cx="60" cy="103" r="6" fill="#f8fafc" stroke="#042f2e" stroke-width="2"/>
        <circle cx="58" cy="102" r="1.5" fill="#042f2e"/><circle cx="62" cy="102" r="1.5" fill="#042f2e"/>
        <ellipse cx="60" cy="62" rx="36" ry="31" fill="#14b8a6" stroke="#042f2e" stroke-width="4"/>
        <path d="M48,34 Q56,40 64,36" fill="none" stroke="#042f2e" stroke-width="3" stroke-linecap="round"/>
        <line x1="51" y1="33" x2="53" y2="40" stroke="#042f2e" stroke-width="2.2"/>
        <line x1="57" y1="34" x2="59" y2="41" stroke="#042f2e" stroke-width="2.2"/>
        <line x1="62" y1="33" x2="63" y2="39" stroke="#042f2e" stroke-width="2.2"/>
        <ellipse cx="60" cy="72" rx="22" ry="16" fill="#99f6e4" stroke="#042f2e" stroke-width="3"/>
        <ellipse cx="60" cy="65" rx="8" ry="5.5" fill="#042f2e"/>
        <circle cx="44" cy="54" r="8.5" fill="#042f2e"/>
        <circle cx="44" cy="54" r="7" fill="url(#gEyeGlow)"/>
        <circle cx="44" cy="54" r="3.5" fill="#fff"/>
        <circle cx="76" cy="54" r="7" fill="#0f766e" stroke="#042f2e" stroke-width="2"/>
        <line x1="71" y1="49" x2="81" y2="59" stroke="#042f2e" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="81" y1="49" x2="71" y2="59" stroke="#042f2e" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M50,75 Q60,82 70,75" fill="none" stroke="#042f2e" stroke-width="3" stroke-linecap="round"/>
        <g transform="translate(60, 80) rotate(-12)">
          <rect x="-18" y="-3.5" width="36" height="7" rx="3.5" fill="url(#gBone)" stroke="#042f2e" stroke-width="2"/>
          <circle cx="-18" cy="-5" r="4" fill="url(#gBone)" stroke="#042f2e" stroke-width="1.8"/>
          <circle cx="-18" cy="5" r="4" fill="url(#gBone)" stroke="#042f2e" stroke-width="1.8"/>
          <circle cx="18" cy="-5" r="4" fill="url(#gBone)" stroke="#042f2e" stroke-width="1.8"/>
          <circle cx="18" cy="5" r="4" fill="url(#gBone)" stroke="#042f2e" stroke-width="1.8"/>
        </g>
      </svg>`;
    }
    if (av === 'av_shiba_sensei' || av === 'coach_bobby' || av === 'sensei') {
      return `<svg viewBox="0 0 120 120" class="dog-hero-svg">
        <defs>
          <radialGradient id="gSenseiBg" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="50%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#78350f"/>
          </radialGradient>
          <linearGradient id="gMortar" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#334155"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="url(#gSenseiBg)"/>
        <polygon points="22,46 32,14 52,36" fill="#d97706" stroke="#1c1208" stroke-width="4" stroke-linejoin="round"/>
        <polygon points="28,42 34,22 46,36" fill="#fef3c7"/>
        <polygon points="98,46 88,14 68,36" fill="#d97706" stroke="#1c1208" stroke-width="4" stroke-linejoin="round"/>
        <polygon points="92,42 86,22 74,36" fill="#fef3c7"/>
        <path d="M24,96 Q60,82 96,96 L100,118 L20,118 Z" fill="#1e293b" stroke="#0f172a" stroke-width="4"/>
        <polygon points="60,94 50,118 70,118" fill="#fef08a"/>
        <polygon points="56,96 60,104 64,96" fill="#dc2626"/>
        <ellipse cx="60" cy="66" rx="35" ry="30" fill="#fbbf24" stroke="#1c1208" stroke-width="4"/>
        <ellipse cx="60" cy="74" rx="22" ry="16" fill="#fef3c7"/>
        <circle cx="36" cy="70" r="6" fill="#f43f5e" opacity="0.35"/>
        <circle cx="84" cy="70" r="6" fill="#f43f5e" opacity="0.35"/>
        <circle cx="44" cy="58" r="9.5" fill="rgba(255,255,255,0.4)" stroke="#78350f" stroke-width="3"/>
        <circle cx="76" cy="58" r="9.5" fill="rgba(255,255,255,0.4)" stroke="#78350f" stroke-width="3"/>
        <line x1="53.5" y1="58" x2="66.5" y2="58" stroke="#78350f" stroke-width="3"/>
        <circle cx="44" cy="58" r="4.5" fill="#1c1208"/><circle cx="42.5" cy="56.5" r="1.5" fill="#fff"/>
        <circle cx="76" cy="58" r="4.5" fill="#1c1208"/><circle cx="74.5" cy="56.5" r="1.5" fill="#fff"/>
        <ellipse cx="60" cy="68" rx="6.5" ry="4.5" fill="#1c1208"/>
        <path d="M52,76 Q60,83 68,76" fill="none" stroke="#1c1208" stroke-width="3" stroke-linecap="round"/>
        <polygon points="60,8 100,24 60,36 20,24" fill="url(#gMortar)" stroke="#020617" stroke-width="3.5" stroke-linejoin="round"/>
        <rect x="42" y="27" width="36" height="12" rx="4" fill="#0f172a" stroke="#020617" stroke-width="2"/>
        <circle cx="60" cy="22" r="3" fill="#fbbf24"/>
        <path d="M60,22 Q38,26 34,42" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>
        <polygon points="32,42 36,42 35,49 33,49" fill="#d97706"/>
      </svg>`;
    }
    const isEmoji = typeof av === 'string' && (/\p{Emoji}/u.test(av) && !/^[a-zA-Z0-9_]+$/.test(av));
    const displayChar = isEmoji ? av : '🐶';
    const charCode = displayChar.codePointAt(0) || 128054;
    return `<svg viewBox="0 0 120 120" class="dog-hero-svg emoji-avatar-svg">
      <defs>
        <radialGradient id="gE_${charCode}" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.9"/>
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill="url(#gE_${charCode})" stroke="#6366f1" stroke-width="3"/>
      <text x="60" y="74" font-size="52" text-anchor="middle" dominant-baseline="central">${displayChar}</text>
    </svg>`;
  }
  function dogHeroSVG(themeOrAv) { return renderAvatarSVG(themeOrAv); }
  function rankBadge(rp) {
    if (typeof rankOf !== 'function') return '';
    const r = rankOf(rp || 0);
    return r ? `<span class="rank-tag" title="${esc(r.name?.[lang] || r.name?.th || '')}">${r.icon}</span>` : '';
  }

  function titleInfo(id) {
    if (!id) id = 'title_rookie';
    if (window.EK?.TITLES) {
      const f = window.EK.TITLES.find(t => t.id === id);
      if (f) return f;
    }
    if (window.EK?.GACHA_POOL) {
      for (const tier of Object.keys(window.EK.GACHA_POOL)) {
        const f = window.EK.GACHA_POOL[tier].find(t => t.id === id);
        if (f) return f;
      }
    }
    return { id, icon: '🐾', name: { th: 'ลูกหมาฝึกหัด', en: 'Rookie Pup' } };
  }

  function titleBadgeHTML(titleId, l) {
    const t = titleInfo(titleId);
    if (!t) return '';
    const lg = l || lang || 'th';
    const nameStr = (t.name && (t.name[lg] || t.name.th || t.name.en)) || t.name || '';
    return `<span class="title-badge tb-${t.id}" title="${esc(t.desc?.[lg] || nameStr)}">${t.icon || '🎖️'} ${esc(nameStr)}</span>`;
  }

  function avatarHTML(p, size = '') {
    if (!p) p = {};
    const av = p.avatar || '🐶';
    const isSvg = typeof av === 'string' && (av.startsWith('av_') || ['gold', 'neon', 'fire', 'galaxy'].includes(av));
    if (isSvg) {
      return `<div class="avatar ${p.frame || ''} ${size} has-svg">${renderAvatarSVG(av)}</div>`;
    }
    return `<div class="avatar ${p.frame || ''} ${size}"><span>${esc(av)}</span></div>`;
  }

  // Rich SVG cartoon dog characters matching the 4 arcade archetypes
  const DOG_THEMES = ['gold', 'neon', 'fire', 'galaxy'];
  function themeForPlayer(p, idx = 0) {
    if (p.frame === 'frame_gold') return 'gold';
    if (p.frame === 'frame_neon') return 'neon';
    if (p.frame === 'frame_fire') return 'fire';
    if (p.frame === 'frame_rainbow') return 'galaxy';
    return DOG_THEMES[idx % DOG_THEMES.length];
  }

  // ------------------------------------------------------------ i18n apply
  function applyI18n() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $('#btnLang').textContent = lang === 'th' ? 'TH' : 'EN';
    renderHome(); if (S) render();
  }

  // ------------------------------------------------------------ Haptics (Vibration Engine for Mobile)
  const Haptics = {
    vibrate(pattern) {
      if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(pattern); } catch (_) {}
      }
    },
    tap() { this.vibrate(15); },
    draw() { this.vibrate([25, 40, 30]); },
    nopeSlam() { this.vibrate([60, 40, 120]); },
    bombPanic() { this.vibrate([100, 50, 100, 50, 200]); },
    defused() { this.vibrate([40, 60, 40, 60, 80]); },
    explosion() { this.vibrate([200, 80, 400]); },
    heartbeat() { this.vibrate([35, 70, 35]); }
  };

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
    const count = window.innerWidth <= 860 ? 24 : 60;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span'); s.textContent = items[i % items.length];
      s.style.left = Math.random() * 100 + 'vw'; s.style.animationDelay = Math.random() * 1.2 + 's'; s.style.fontSize = (16 + Math.random() * 20) + 'px';
      s.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      box.appendChild(s);
    }
    setTimeout(() => { box.innerHTML = ''; }, 4500);
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
    if (!S || S.state !== 'PLAYING') {
      A.stopHeartbeat();
      A.stopFuse();
      document.body.classList.remove('emergency-alarm');
    }
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
  function setUser(u, vault) {
    user = u;
    if (vault) {
      try { localStorage.setItem('ek_account_vault', JSON.stringify(vault)); } catch (_) {}
    }
    renderUserChip();
    renderHome();
  }
  async function loadMe() {
    if (token) {
      const r = await api('/api/me');
      if (r.user) {
        if (r.vault) {
          try { localStorage.setItem('ek_account_vault', JSON.stringify(r.vault)); } catch (_) {}
        }
        return setUser(r.user, r.vault);
      }
    }
    // If token invalid, expired, or server was redeployed/restarted:
    const savedVault = localStorage.getItem('ek_account_vault');
    if (savedVault) {
      try {
        const vaultObj = JSON.parse(savedVault);
        const res = await api('/api/restore-account', { vault: vaultObj });
        if (res.user && res.token) {
          token = res.token;
          localStorage.setItem('ek_token', token);
          socket.emit('auth', token);
          if (res.vault) {
            try { localStorage.setItem('ek_account_vault', JSON.stringify(res.vault)); } catch (_) {}
          }
          setUser(res.user, res.vault);
          toast(lang === 'th' ? `✨ ยินดีต้อนรับกลับ ${esc(res.user.displayName)}! ระบบกู้คืนข้อมูลบัญชีของคุณให้อัตโนมัติแล้ว` : `Welcome back ${esc(res.user.displayName)}! Account restored automatically.`, 'good');
          return;
        }
      } catch (e) {
        console.error('Vault auto-restore error:', e);
      }
    }
    token = '';
    localStorage.removeItem('ek_token');
    setUser(null);
  }

  // ------------------------------------------------------------ socket
  const socket = io({ auth: { token } });
  socket.on('connect', () => {
    if (token) socket.emit('auth', token);
    const saved = JSON.parse(sessionStorage.getItem('ek_room') || 'null');
    if (saved) socket.emit('rejoin', saved);
  });
  socket.on('err', (e) => { toast('⚠️ ' + esc(terr(e)), 'err'); A.sfx('nope'); });
  socket.on('vault', (v) => { try { localStorage.setItem('ek_account_vault', JSON.stringify(v)); } catch (_) {} });
  socket.on('joined', ({ code, playerId, key }) => { sessionStorage.setItem('ek_room', JSON.stringify({ code, playerId, key })); history.replaceState(null, '', '?room=' + code); });
  socket.on('rejoinFailed', () => { sessionStorage.removeItem('ek_room'); });
  socket.on('left', () => {
    sessionStorage.removeItem('ek_room');
    S = null;
    lastSeatsKey = '';
    lastHeroKey = '';
    lastDiscardKey = '';
    sel = [];
    draggingUid = null;
    const box = $('#hand'); if (box) box.innerHTML = '';
    const hero = $('#myHeroSeat'); if (hero) hero.innerHTML = '';
    const seats = $('#seats'); if (seats) seats.innerHTML = '';
    A.stopHeartbeat();
    A.stopFuse();
    document.body.classList.remove('emergency-alarm');
    history.replaceState(null, '', location.pathname);
    show('home');
  });
  socket.on('state', (st) => {
    const prev = S; S = st; timeOffset = st.serverNow - Date.now();
    if (st.phase === 'turn' || st.state !== 'PLAYING' || st.turnId !== prev?.turnId) {
      drawActionLock = false;
    }
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
    if (name !== 'auth' && !user && !isGuestSessionActive) {
      name = 'auth';
    }
    screen = name;
    $$('.screen').forEach(s => {
      const isActive = s.id === 'screen-' + name;
      s.classList.toggle('active', isActive);
      if (!isActive) {
        s.style.display = 'none';
      } else {
        s.style.display = '';
      }
    });
    document.body.dataset.screen = name;
    if (name === 'lobby') { initLobbyTabs(); }
  }

  function render() {
    if (!S) {
      if (!user && !isGuestSessionActive) {
        show('auth');
        return;
      }
      if (screen !== 'browser') show('home');
      return;
    }
    if (S.state === 'LOBBY') { show('lobby'); renderLobby(); }
    else { show('game'); renderGame(); }
  }

  socket.on('roomsList', (rooms) => {
    if (screen === 'browser') renderRoomBrowser(rooms);
  });

  
  // ------------------------------------------------------------ AUTH SCREEN (หมาระเบิด Online)
    window.onNewAccountCreated = window.onNewAccountCreated || null;

  function initAuthScreen() {
    const tabRegister = $('#tabRegister');
    const tabLogin = $('#tabLogin');
    const authRegForm = $('#authFormRegister') || $('#authRegisterForm');
    const authLoginForm = $('#authFormLogin') || $('#authLoginForm');

    function switchAuthTab(mode) {
      A.sfx('click');
      const regForm = $('#authFormRegister') || $('#authRegisterForm');
      const loginForm = $('#authFormLogin') || $('#authLoginForm');

      // Sync typed credentials between tabs so player never loses their input
      const regUser = $('#authRegUsername')?.value?.trim();
      const regPass = $('#authRegPassword')?.value;
      const logUser = $('#authLoginUsername')?.value?.trim();
      const logPass = $('#authLoginPassword')?.value;

      if (mode === 'login') {
        tabLogin?.classList.add('active');
        tabRegister?.classList.remove('active');
        loginForm?.classList.remove('hidden');
        loginForm?.classList.add('active');
        regForm?.classList.add('hidden');
        regForm?.classList.remove('active');
        if (regUser && !logUser && $('#authLoginUsername')) $('#authLoginUsername').value = regUser;
        if (regPass && !logPass && $('#authLoginPassword')) $('#authLoginPassword').value = regPass;
      } else {
        tabRegister?.classList.add('active');
        tabLogin?.classList.remove('active');
        regForm?.classList.remove('hidden');
        regForm?.classList.add('active');
        loginForm?.classList.add('hidden');
        loginForm?.classList.remove('active');
        if (logUser && !regUser && $('#authRegUsername')) $('#authRegUsername').value = logUser;
        if (logPass && !regPass && $('#authRegPassword')) {
          $('#authRegPassword').value = logPass;
          if ($('#authRegConfirm')) $('#authRegConfirm').value = logPass;
        }
      }
    }
    window.switchAuthTab = switchAuthTab;

    if (tabRegister) tabRegister.onclick = () => switchAuthTab('register');
    if (tabLogin) tabLogin.onclick = () => switchAuthTab('login');
    const linkToLogin = $('#linkSwitchToLogin');
    if (linkToLogin) linkToLogin.onclick = () => switchAuthTab('login');
    const linkToReg = $('#linkSwitchToRegister');
    if (linkToReg) linkToReg.onclick = () => switchAuthTab('register');

    const linkForgot = $('#linkAuthForgot');
    if (linkForgot) {
      linkForgot.onclick = (e) => {
        e.preventDefault();
        openAuth('forgot');
      };
    }

    function doGuestLogin() {
      A.sfx('coin');
      isGuestSessionActive = true;
      let gName = localStorage.getItem('ek_name');
      if (!gName || gName === 'Guest' || gName.startsWith('ผู้เล่นทั่วไป')) {
        gName = 'Doggy_' + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem('ek_name', gName);
      }
      const curCoins = parseInt(localStorage.getItem('ek_guest_coins') || '0');
      const curDia = parseInt(localStorage.getItem('ek_guest_diamonds') || '0');
      if (curCoins < 500) localStorage.setItem('ek_guest_coins', '1000');
      if (curDia < 30) localStorage.setItem('ek_guest_diamonds', '100');
      if (!localStorage.getItem('ek_guest_avatar')) localStorage.setItem('ek_guest_avatar', '🐶');
      renderUserChip();
      show('home');
      renderHome();
      setTimeout(() => checkDailyLoginStatus(true), 800);
      checkMailboxStatus();
      toast(lang === 'th' ? `⚡ เข้าเล่นด่วนในฐานะ ${gName}` : `Quick playing as ${gName}`, 'good');
    }

    const bGuest = $('#btnAuthGuest');
    if (bGuest) bGuest.onclick = doGuestLogin;
    const bGuestLogin = $('#btnAuthGuestLogin');
    if (bGuestLogin) bGuestLogin.onclick = doGuestLogin;

    const socialMsg = () => toast(lang === 'th' ? '🐶 เข้าสู่ระบบโซเชียลจำลอง: กรุณาสมัครสมาชิกหรือเข้าเล่นด่วน' : 'Demo social login: please register or quick play!', 'info');
    $('#btnAuthFb')?.addEventListener('click', socialMsg);
    $('#btnAuthFbLogin')?.addEventListener('click', socialMsg);
    $('#btnAuthGoogle')?.addEventListener('click', socialMsg);
    $('#btnAuthGoogleLogin')?.addEventListener('click', socialMsg);

    // Easter egg: Click on mascots to bark!
    $('.peeking-corgi-headset')?.addEventListener('click', () => {
      A.sfx('bark');
      toast(lang === 'th' ? '🐶 โฮ่งๆ! คอร์กี้เกมเมอร์พร้อมลุย!' : 'Woof! Gamer Corgi is ready!', 'good');
    });
    $('.peeking-golden-party')?.addEventListener('click', () => {
      A.sfx('squeakToy');
      toast(lang === 'th' ? '🐾 แฮ่กๆ! น้องโกลเด้นโบกมือทักทาย!' : 'Wag wag! Golden party pup says hi!', 'good');
    });

    // Register Handler
    const doRegisterSubmit = async (e) => {
      if (e) e.preventDefault();
      const username = $('#authRegUsername')?.value.trim();
      const email = $('#authRegEmail')?.value.trim();
      const password = $('#authRegPassword')?.value;
      const confirm = $('#authRegConfirm')?.value;
      const terms = $('#authTermsCheck')?.checked;

      if (!terms) {
        return toast(lang === 'th' ? '⚠️ กรุณายอมรับข้อตกลงและกติกาการเล่น 🦴' : 'Please accept terms and rules', 'err');
      }
      if (!username || username.length < 3) {
        return toast(lang === 'th' ? '⚠️ ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร' : 'Username min 3 chars', 'err');
      }
      if (!password || password.length < 4) {
        return toast(lang === 'th' ? '⚠️ รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' : 'Password min 4 chars', 'err');
      }
      if (password !== confirm) {
        return toast(lang === 'th' ? '⚠️ รหัสผ่านและการยืนยันไม่ตรงกัน' : 'Passwords do not match', 'err');
      }

      const btnSubmit = $('#btnAuthSubmitRegister');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span class="btn-star">⏳</span><span class="btn-text">${lang === 'th' ? 'กำลังสร้างบัญชี...' : 'Creating...'}</span><span class="btn-star">⏳</span>`;
      }

      try {
        const r = await api('/api/register', { username, password, displayName: username, email });
        if (r.error) {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span class="btn-star">✦</span><span class="btn-text">${lang === 'th' ? 'สร้างบัญชี & เข้าสู่ระบบ (CREATE & PLAY!)' : 'CREATE & PLAY!'}</span><span class="btn-star">✦</span>`;
          }
          return toast('⚠️ ' + terr(r.error), 'err');
        }

        token = r.token;
        localStorage.setItem('ek_token', token);
        socket.emit('auth', token);
        isGuestSessionActive = false;
        setUser(r.user, r.vault);
        A.sfx('win');
        confetti(true);
        toast(lang === 'th' ? `🎉 ยินดีต้อนรับ ${esc(r.user.displayName)}! สมัครสมาชิกสำเร็จ` : `Welcome ${esc(r.user.displayName)}!`, 'good');

        // Hook for tutorial onboarding
        if (typeof window.onNewAccountCreated === 'function') {
          try {
            window.onNewAccountCreated(r.user);
          } catch (err) {
            console.error('onNewAccountCreated error:', err);
          }
        }

        show('home');
        renderHome();
        checkMailboxStatus();
      } catch (err) {
        console.error('Register submit error:', err);
        toast(lang === 'th' ? '⚠️ การเชื่อมต่อขัดข้อง กรุณาลองใหม่' : 'Connection error', 'err');
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<span class="btn-star">✦</span><span class="btn-text">${lang === 'th' ? 'สร้างบัญชี & เข้าสู่ระบบ (CREATE & PLAY!)' : 'CREATE & PLAY!'}</span><span class="btn-star">✦</span>`;
        }
      }
    };

    if (authRegForm) authRegForm.onsubmit = doRegisterSubmit;
    const btnSubmitReg = $('#btnAuthSubmitRegister');
    if (btnSubmitReg) btnSubmitReg.onclick = doRegisterSubmit;

    // Login Handler
    const doLoginSubmit = async (e) => {
      if (e) e.preventDefault();
      const usernameInp = $('#authLoginUsername') || $('#authRegUsername');
      const passwordInp = $('#authLoginPassword') || $('#authRegPassword');
      const username = usernameInp?.value.trim();
      const password = passwordInp?.value;

      if (!username || !password) {
        return toast(lang === 'th' ? '⚠️ กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' : 'Please enter username and password', 'err');
      }

      const btnSubmit = $('#btnAuthSubmitLogin');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span class="btn-star">⏳</span><span class="btn-text">${lang === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Logging in...'}</span><span class="btn-star">⏳</span>`;
      }

      try {
        const r = await api('/api/login', { username, password });
        if (r.error) {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span class="btn-star">✦</span><span class="btn-text">${lang === 'th' ? 'เข้าสู่ระบบ (LOGIN)' : 'LOGIN'}</span><span class="btn-star">✦</span>`;
          }
          return toast('⚠️ ' + terr(r.error), 'err');
        }

        token = r.token;
        localStorage.setItem('ek_token', token);
        socket.emit('auth', token);
        isGuestSessionActive = false;
        setUser(r.user, r.vault);
        A.sfx('coin');

        if (r.autoRegistered) {
          confetti(true);
          toast('🎉 ' + (lang === 'th' ? `ยินดีต้อนรับ ${esc(r.user.displayName)}! ระบบสร้างบัญชีให้คุณแล้ว` : `Welcome ${esc(r.user.displayName)}! Account created.`), 'good');
          if (typeof window.onNewAccountCreated === 'function') {
            try { window.onNewAccountCreated(r.user); } catch (_) {}
          }
        } else {
          toast('👋 ' + (lang === 'th' ? `ยินดีต้อนรับกลับ ${esc(r.user.displayName)}!` : `Welcome back ${esc(r.user.displayName)}!`), 'good');
        }

        show('home');
        renderHome();
        checkMailboxStatus();
      } catch (err) {
        console.error('Login submit error:', err);
        toast(lang === 'th' ? '⚠️ การเชื่อมต่อขัดข้อง กรุณาลองใหม่' : 'Connection error', 'err');
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<span class="btn-star">✦</span><span class="btn-text">${lang === 'th' ? 'เข้าสู่ระบบ (LOGIN)' : 'LOGIN'}</span><span class="btn-star">✦</span>`;
        }
      }
    };

    if (authLoginForm) authLoginForm.onsubmit = doLoginSubmit;
    const btnSubmitLogin = $('#btnAuthSubmitLogin');
    if (btnSubmitLogin) btnSubmitLogin.onclick = doLoginSubmit;

    // BGM footer button
    const btnBgm = $('#btnFooterBgm');
    function updateBgmBtn() {
      if (!btnBgm) return;
      const on = !!A.opt.sound;
      btnBgm.innerHTML = on
        ? `<span class="bgm-icon">🔊</span><span class="bgm-text">${lang === 'th' ? 'เพลงประกอบ: เปิด' : 'BGM: ON'}</span>`
        : `<span class="bgm-icon">🔇</span><span class="bgm-text">${lang === 'th' ? 'เพลงประกอบ: ปิด' : 'BGM: OFF'}</span>`;
    }
    updateBgmBtn();

    if (btnBgm) {
      btnBgm.onclick = () => {
        const nextState = !A.opt.sound;
        A.set('sound', nextState);
        A.set('music', nextState);
        updateBgmBtn();
      };
    }
  }

  // ------------------------------------------------------------ HOME / CASINO LOBBY
  function renderUserChip() {
    const av = $('#pAvatar'), lvl = $('#pLevel'), nm = $('#pName'), xp = $('#pXpFill');
    const coins = $('#topCoins'), dia = $('#topDiamonds'), flags = $('#langFlags');
    const sCoins = $('#stageTopCoins'), sDia = $('#stageTopDiamonds'), sFlags = $('#stageLangFlags');
    if (sFlags) sFlags.textContent = lang === 'th' ? '🇹🇭 TH / 🇬🇧 EN' : '🇬🇧 EN / 🇹🇭 TH';
    if (flags) flags.textContent = lang === 'th' ? '🇹🇭 TH / 🇬🇧 EN' : '🇬🇧 EN / 🇹🇭 TH';
    const tBadge = $('#pTitle');
    if (tBadge) tBadge.innerHTML = titleBadgeHTML(myTitle(), lang);
    if (user) {
      if (av) av.textContent = user.avatar || '🐶';
      if (lvl) lvl.textContent = 'LV.' + (user.level || Math.min(99, Math.floor((user.rp || 0) / 40) + 1));
      if (nm) nm.textContent = user.displayName;
      if (xp) xp.style.width = Math.min(100, Math.max(15, (user.rp || 0) % 100)) + '%';
      if (coins) coins.textContent = user.coins;
      if (dia) dia.textContent = user.diamonds || Math.floor((user.rp || 0) / 25) + 15;
      if (sCoins) sCoins.textContent = user.coins;
      if (sDia) sDia.textContent = user.diamonds || Math.floor((user.rp || 0) / 25) + 15;
    } else {
      if (av) av.textContent = '🐶';
      const curXp = parseInt(localStorage.getItem('ek_guest_xp') || '0', 10);
      const curLvl = Math.min(99, Math.floor(curXp / 100) + 1);
      if (lvl) lvl.textContent = 'LV.' + curLvl;
      const saved = localStorage.getItem('ek_name');
      if (nm) nm.textContent = saved || (lang === 'th' ? 'ผู้เล่นทั่วไป (เข้าสู่ระบบ)' : 'Guest (Log in)');
      if (xp) xp.style.width = Math.min(100, Math.max(12, curXp % 100)) + '%';
      const gC = localStorage.getItem('ek_guest_coins') || '100';
      const gD = localStorage.getItem('ek_guest_diamonds') || '20';
      if (coins) coins.textContent = gC;
      if (dia) dia.textContent = gD;
      if (sCoins) sCoins.textContent = gC;
      if (sDia) sDia.textContent = gD;
    }
  }

  
  // ------------------------------------------------------------ BOSS SHIBA MASCOT (UNMISTAKABLY A DOG)
  function bossShibaMascotSVG() {
    return `<svg class="boss-mascot-svg" viewBox="0 0 280 340" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Shiba Golden Fur -->
        <radialGradient id="shibaFur" cx="45%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#fdba74"/>
          <stop offset="45%" stop-color="#fb923c"/>
          <stop offset="80%" stop-color="#ea580c"/>
          <stop offset="100%" stop-color="#c2410c"/>
        </radialGradient>
        <!-- Cream Muzzle & Chest -->
        <linearGradient id="shibaCream" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="70%" stop-color="#fff7ed"/>
          <stop offset="100%" stop-color="#fed7aa"/>
        </linearGradient>
        <!-- Soft Ear Pink -->
        <radialGradient id="earPink" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fdf2f8"/>
          <stop offset="60%" stop-color="#fbcfe8"/>
          <stop offset="100%" stop-color="#f472b6"/>
        </radialGradient>
        <!-- Gold Crown & Medal -->
        <linearGradient id="goldCrown" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="40%" stop-color="#facc15"/>
          <stop offset="75%" stop-color="#eab308"/>
          <stop offset="100%" stop-color="#b45309"/>
        </linearGradient>
        <!-- Royal Cape -->
        <linearGradient id="royalCape" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="60%" stop-color="#dc2626"/>
          <stop offset="100%" stop-color="#7f1d1d"/>
        </linearGradient>
        <!-- Cape White Ermine Trim -->
        <linearGradient id="ermineTrim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="50%" stop-color="#f1f5f9"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
        <filter id="bossShadow" x="-20%" y="-15%" width="140%" height="135%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#180628" flood-opacity="0.55"/>
        </filter>
      </defs>

      <g filter="url(#bossShadow)">
        <!-- 1. Shiba Curled Tail (Wagging on right) -->
        <path d="M205 235 C240 220 262 175 242 145 C226 122 195 138 202 170 C206 188 220 195 210 215 Z" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="4" stroke-linejoin="round"/>
        <!-- Fluffy White Tail Tip -->
        <path d="M242 145 C248 155 238 170 225 160 C216 150 226 135 238 132 C244 134 246 140 242 145 Z" fill="#ffffff" stroke="#7c2d12" stroke-width="3"/>

        <!-- 2. Royal Velvet Cape (Behind body) -->
        <path d="M60 180 C40 230 32 290 22 328 C85 342 195 342 258 328 C248 290 240 230 220 180 Z" fill="url(#royalCape)" stroke="#7f1d1d" stroke-width="4"/>
        <path d="M42 324 Q140 342 238 324" stroke="#facc15" stroke-width="5" fill="none" stroke-linecap="round"/>

        <!-- 3. Natural Fluffy Shiba Dog Ears -->
        <!-- Left Ear -->
        <path d="M55 125 C32 82 48 38 78 44 C96 48 108 82 98 120 Z" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M62 112 C44 80 56 52 76 56 C88 60 94 85 86 108 Z" fill="url(#earPink)"/>
        <!-- Fluffy ear fur tufts -->
        <path d="M85 75 C80 82 85 92 78 98" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>

        <!-- Right Ear -->
        <path d="M225 125 C248 82 232 38 202 44 C184 48 172 82 182 120 Z" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M218 112 C236 80 224 52 204 56 C192 60 186 85 194 108 Z" fill="url(#earPink)"/>
        <!-- Fluffy ear fur tufts -->
        <path d="M195 75 C200 82 195 92 202 98" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>

        <!-- 4. Dog Body & Fluffy Chest -->
        <path d="M72 175 C58 220 62 285 70 318 C115 328 165 328 210 318 C218 285 222 220 208 175 Z" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="4"/>
        <!-- White Chest Fur -->
        <path d="M95 185 C95 240 115 285 140 285 C165 285 185 240 185 185 C170 198 155 204 140 204 C125 204 110 198 95 185 Z" fill="url(#shibaCream)"/>

        <!-- 5. Royal Gold Cape Collar with Ermine Trim & Bone Medal -->
        <path d="M68 180 C90 204 190 204 212 180 L204 208 C175 224 105 224 76 208 Z" fill="url(#ermineTrim)" stroke="#7c2d12" stroke-width="3"/>
        <circle cx="95" cy="198" r="2.5" fill="#0f172a"/><circle cx="140" cy="208" r="2.5" fill="#0f172a"/><circle cx="185" cy="198" r="2.5" fill="#0f172a"/>
        <!-- Golden Dog Bone Medallion -->
        <g transform="translate(140, 230)">
          <circle cx="0" cy="0" r="16" fill="url(#goldCrown)" stroke="#78350f" stroke-width="2.5"/>
          <rect x="-8" y="-2.5" width="16" height="5" rx="2.5" fill="#ffffff"/>
          <circle cx="-8" cy="-3.5" r="3" fill="#ffffff"/><circle cx="-8" cy="3.5" r="3" fill="#ffffff"/>
          <circle cx="8" cy="-3.5" r="3" fill="#ffffff"/><circle cx="8" cy="3.5" r="3" fill="#ffffff"/>
        </g>

        <!-- 6. Cute Chubby Shiba Head -->
        <ellipse cx="140" cy="148" rx="78" ry="68" fill="url(#shibaFur)" stroke="#7c2d12" stroke-width="4.5"/>
        <!-- White Shiba Cheek Fur -->
        <path d="M72 152 C72 195 102 214 140 214 C178 214 208 195 208 152 C208 132 192 122 174 122 C155 122 145 130 140 130 C135 130 125 122 106 122 C88 122 72 132 72 152 Z" fill="url(#shibaCream)"/>

        <!-- 7. Iconic White Doge Eyebrow Dots -->
        <ellipse cx="108" cy="108" rx="10" ry="12" fill="#ffffff"/>
        <ellipse cx="172" cy="108" rx="10" ry="12" fill="#ffffff"/>

        <!-- 8. Blushing Cheeks -->
        <circle cx="85" cy="162" r="11" fill="#fb7185" opacity="0.55"/>
        <circle cx="195" cy="162" r="11" fill="#fb7185" opacity="0.55"/>

        <!-- 9. Big Bright Happy Dog Eyes -->
        <ellipse cx="106" cy="136" rx="10" ry="13" fill="#1e1b4b"/>
        <circle cx="102" cy="131" r="4.5" fill="#ffffff"/>
        <circle cx="109" cy="142" r="2" fill="#ffffff"/>
        <ellipse cx="174" cy="136" rx="10" ry="13" fill="#1e1b4b"/>
        <circle cx="170" cy="131" r="4.5" fill="#ffffff"/>
        <circle cx="177" cy="142" r="2" fill="#ffffff"/>

        <!-- 10. Distinct Dog Snout / Muzzle (3D Doggy Muzzle) -->
        <ellipse cx="140" cy="168" rx="34" ry="24" fill="url(#shibaCream)" stroke="#7c2d12" stroke-width="3"/>
        <!-- Black Puppy Button Nose with Gloss -->
        <path d="M128 158 C128 151 152 151 152 158 C152 168 140 174 140 174 C140 174 128 168 128 158 Z" fill="#0f172a"/>
        <ellipse cx="135" cy="155" rx="3" ry="1.5" fill="#ffffff" opacity="0.8"/>
        <!-- Dog Whisker Dots -->
        <circle cx="118" cy="168" r="1.8" fill="#a16207"/><circle cx="123" cy="172" r="1.8" fill="#a16207"/>
        <circle cx="162" cy="168" r="1.8" fill="#a16207"/><circle cx="157" cy="172" r="1.8" fill="#a16207"/>
        <!-- Dog Smile & Panting Tongue -->
        <path d="M126 172 Q140 180 154 172" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round" fill="none"/>
        <path d="M132 176 C132 198 148 198 148 176 Z" fill="#e11d48" stroke="#0f172a" stroke-width="2.5"/>
        <path d="M135 184 C135 194 145 194 145 184 Z" fill="#fb7185"/>

        <!-- 11. Front Puppy Paws resting on podium -->
        <g transform="translate(86, 255)">
          <ellipse cx="20" cy="16" rx="22" ry="17" fill="url(#shibaCream)" stroke="#7c2d12" stroke-width="3.5"/>
          <ellipse cx="9" cy="9" rx="5" ry="4" fill="#fb7185"/>
          <ellipse cx="20" cy="6" rx="5" ry="4" fill="#fb7185"/>
          <ellipse cx="31" cy="9" rx="5" ry="4" fill="#fb7185"/>
          <ellipse cx="20" cy="18" rx="9" ry="7" fill="#fb7185"/>
        </g>
        <g transform="translate(154, 255)">
          <ellipse cx="20" cy="16" rx="22" ry="17" fill="url(#shibaCream)" stroke="#7c2d12" stroke-width="3.5"/>
          <ellipse cx="9" cy="9" rx="5" ry="4" fill="#fb7185"/>
          <ellipse cx="20" cy="6" rx="5" ry="4" fill="#fb7185"/>
          <ellipse cx="31" cy="9" rx="5" ry="4" fill="#fb7185"/>
          <ellipse cx="20" cy="18" rx="9" ry="7" fill="#fb7185"/>
        </g>

        <!-- 12. Majestic King Crown -->
        <g transform="translate(92, 16)">
          <path d="M8 48 L0 12 L26 28 L48 0 L70 28 L96 12 L88 48 Z" fill="url(#goldCrown)" stroke="#78350f" stroke-width="3.5" stroke-linejoin="round"/>
          <ellipse cx="48" cy="48" rx="44" ry="8" fill="#b45309"/>
          <ellipse cx="48" cy="46" rx="44" ry="8" fill="url(#goldCrown)"/>
          <circle cx="0" cy="12" r="5.5" fill="#ef4444" stroke="#78350f" stroke-width="2"/>
          <circle cx="48" cy="0" r="7" fill="#38bdf8" stroke="#78350f" stroke-width="2.5"/>
          <polygon points="48,-6 50,-1 55,-1 51,2 53,7 48,4 43,7 45,2 41,-1 46,-1" fill="#fef08a"/>
          <circle cx="96" cy="12" r="5.5" fill="#ef4444" stroke="#78350f" stroke-width="2"/>
          <circle cx="26" cy="46" r="4.5" fill="#22c55e" stroke="#14532d" stroke-width="1.5"/>
          <circle cx="48" cy="46" r="5.5" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.5"/>
          <circle cx="70" cy="46" r="4.5" fill="#3b82f6" stroke="#1e3a8a" stroke-width="1.5"/>
        </g>
      </g>
    </svg>`;
  }

  function renderHome() {
    const stageMascot = $('#stageMascot');
    if (stageMascot && !stageMascot.innerHTML) {
      stageMascot.innerHTML = typeof bossShibaMascotSVG === 'function' ? bossShibaMascotSVG() : '👑🐶';
    }
    renderUserChip();
    checkDailyLoginStatus(false);
  }

    const myAvatar = () => (user && (user.equipped?.avatar || user.avatar)) || localStorage.getItem('ek_guest_avatar') || '🐶';
  const myFrame = () => (user && user.equipped?.frame) || localStorage.getItem('ek_guest_frame') || '';
  const mySkin = () => (user && user.equipped?.skin) || localStorage.getItem('ek_guest_skin') || '';
  const myTitle = () => (user && (user.equipped?.title || user.title)) || localStorage.getItem('ek_guest_title') || 'title_rookie';
  const myName = () => {
    if (user && user.displayName) return user.displayName;
    const saved = localStorage.getItem('ek_name');
    if (saved) return saved;
    const gen = (lang === 'th' ? 'หมาน้อย' : 'Puppy') + Math.floor(Math.random() * 90 + 10);
    localStorage.setItem('ek_name', gen);
    return gen;
  };

  let selectedStake = localStorage.getItem('ek_stake') || 'casual';
  let cachedRooms = [];

  const STAGES_LIST = [
    {
      id: 'original',
      name: { th: 'ตรอกหมาวัด', en: 'Classic Alley' },
      tag: { th: 'ด่านคลาสสิก', en: 'CLASSIC' },
      theme: 'emerald',
      avatar: 'av_shiba_vip',
      desc: { th: 'การ์ดดั้งเดิม 55 ใบ ระเบิด 4 ใบ ปลดชนวน 6 ใบ เล่นง่าย ไหวพริบล้วนๆ', en: 'Original 55 cards, 4 Bombs, 6 Defuses. Pure wits and fun!' },
      accent: '#10b981',
      glow: 'rgba(16, 185, 129, 0.45)',
      badgeBg: 'rgba(16, 185, 129, 0.18)'
    },
    {
      id: 'party',
      name: { th: 'ดาราจักรหลุมดำ', en: 'Imploding Cosmos' },
      tag: { th: 'มหาปาร์ตี้หลุมดำ', en: 'IMPLODING CHAOS' },
      theme: 'cosmic',
      avatar: 'av_corgi_galaxy',
      desc: { th: 'การ์ดระเบิดหลุมดำหงายหน้าในกองจั่ว! ขโมยเจาะจง สลับทิศทาง ลุ้นสุดขีด', en: 'Face-up Imploding Doge, targeted attacks, reverse, wild chaos!' },
      accent: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.45)',
      badgeBg: 'rgba(168, 85, 247, 0.18)'
    },
    {
      id: 'streaking',
      name: { th: 'สปายผ้าคลุม', en: 'Streaking Heist' },
      tag: { th: 'ซ่อนระเบิดมือ', en: 'STREAKING HEIST' },
      theme: 'cyber',
      avatar: 'av_cyber_husky',
      desc: { th: 'หมาซ่อนระเบิดไว้ในมือได้! กองขยะ ตาบอด และคำสาปสลับขั้วชวนระแวง', en: 'Hold bombs secretly in hand! Garbage dump, blind pup & swap-top.' },
      accent: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.45)',
      badgeBg: 'rgba(6, 182, 212, 0.18)'
    },
    {
      id: 'barking',
      name: { th: 'อารีน่าหมาเห่า', en: 'Barking Arena' },
      tag: { th: 'ประจันหน้าดุเดือด', en: 'BARKING DUEL' },
      theme: 'crimson',
      avatar: 'av_blaze_bulldog',
      desc: { th: 'หมาเห่าผสานพลัง บังคับศัตรูต้องหมอบหรือสละปลดชนวน! ดุเดือดขั้นสุด', en: 'Pair barking dogs to force opponents to yield defuse or explode!' },
      accent: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.45)',
      badgeBg: 'rgba(239, 68, 68, 0.18)'
    },
    {
      id: 'zombie',
      name: { th: 'สุสานหมาซอมบี้', en: 'Zombie Crypt' },
      tag: { th: 'คืนชีพสยองขวัญ', en: 'UNDEAD RETURN' },
      theme: 'undead',
      avatar: 'av_zombie_pup',
      desc: { th: 'ตายแล้วไม่ตายจริง! กลายเป็นผีและคืนชีพกลับมาเล่นต่อ ล้างแค้นทั้งโต๊ะ', en: 'Dead dogs become ghosts and resurrect to enact sweet vengeance!' },
      accent: '#14b8a6',
      glow: 'rgba(20, 184, 166, 0.45)',
      badgeBg: 'rgba(20, 184, 166, 0.18)'
    },
    {
      id: 'mega',
      name: { th: 'เมก้าโกลาหล', en: 'Mega Mix (All)' },
      tag: { th: 'รวมมิตรทุกจักรวาล', en: 'ALL-STAR CHAOS' },
      theme: 'rainbow',
      avatar: 'av_god_shiba',
      desc: { th: 'รวมการ์ดทุกภาค ทั้งหลุมดำ ซ่อนระเบิด หมาเห่า ซอมบี้ กว่า 120 ใบ มันส์ทะลุพิกัด', en: 'All expansions merged together: 120+ cards of ultimate explosive frenzy!' },
      accent: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.5)',
      badgeBg: 'rgba(245, 158, 11, 0.18)'
    },
    {
      id: 'custom',
      name: { th: 'สนามเด็กเล่น', en: 'Custom Sandbox' },
      tag: { th: 'ปรับแต่งอิสระ', en: 'CUSTOM RULES' },
      theme: 'sandbox',
      avatar: 'custom_bulldog',
      desc: { th: 'กำหนดจำนวนการ์ด เวลาต่อเทิร์น และกติกาตามใจชอบ เพื่อศึกแห่งศักดิ์ศรี', en: 'Customize exact card counts, turn timer, and rules to your exact style!' },
      accent: '#eab308',
      glow: 'rgba(234, 179, 8, 0.45)',
      badgeBg: 'rgba(234, 179, 8, 0.18)'
    }
  ];

  function openMatchBrowser() {
    show('browser');
    setupStageSelectScreen();
    socket.emit('listRooms');
    A.sfx('click');
  }

  function setupStageSelectScreen() {
    renderUserChip();

    // 1. Topbar actions
    const btnBack = $('#btnBrowserBack');
    if (btnBack) btnBack.onclick = () => { A.sfx('click'); show('home'); };

    const btnMail = $('#btnStageMail');
    if (btnMail) btnMail.onclick = () => { A.sfx('click'); openMailboxModal(); };

    const badgeCoins = $('#stageBadgeCoins');
    if (badgeCoins) badgeCoins.onclick = () => { A.sfx('click'); openShop(); };

    const badgeDia = $('#stageBadgeDiamonds');
    if (badgeDia) badgeDia.onclick = () => { A.sfx('click'); openGachaModal(); };

    const btnLang = $('#btnStageLang');
    if (btnLang) {
      btnLang.onclick = () => {
        A.sfx('select');
        lang = lang === 'th' ? 'en' : 'th';
        localStorage.setItem('ek_lang', lang);
        renderI18n();
        renderUserChip();
        renderStakesPills();
        renderStageCards();
      };
    }

    // 2. High Stakes Selector
    renderStakesPills();

    // 3. Stage Cards Carousel
    renderStageCards();

    // 4. Carousel Arrows
    const btnPrev = $('#btnStagePrev');
    if (btnPrev) btnPrev.onclick = () => {
      A.sfx('select');
      const el = $('#stagesCarousel');
      if (el) el.scrollBy({ left: -300, behavior: 'smooth' });
    };

    const btnNext = $('#btnStageNext');
    if (btnNext) btnNext.onclick = () => {
      A.sfx('select');
      const el = $('#stagesCarousel');
      if (el) el.scrollBy({ left: 300, behavior: 'smooth' });
    };

    // 5. 4-Box PIN Entry
    setupPinInputs();

    // 6. Bottom action buttons
    const btnRooms = $('#btnOpenRoomsModal');
    if (btnRooms) btnRooms.onclick = () => openAllRoomsModal();

    const btnRandom = $('#btnStageRandom');
    if (btnRandom) {
      btnRandom.onclick = () => {
        A.sfx('click');
        toast(lang === 'th' ? '🔍 กำลังค้นหาห้องที่เปิดอยู่...' : '🔍 Searching for open rooms...');
        socket.emit('joinRandom', {
          name: myName(),
          avatar: myAvatar(),
          frame: myFrame(),
          skin: mySkin(),
          title: myTitle(),
          version: homeVersion,
          stake: selectedStake
        });
      };
    }

    const btnQuick = $('#btnStageQuick');
    if (btnQuick) {
      btnQuick.onclick = () => {
        A.sfx('click');
        toast(lang === 'th' ? '⚡ กำลังเริ่มเกมด่วนกับบอท...' : '⚡ Starting quick play...');
        socket.emit('quickSolo', {
          name: myName(),
          avatar: myAvatar(),
          frame: myFrame(),
          skin: mySkin(),
          title: myTitle(),
          settings: {
            version: homeVersion,
            stake: selectedStake
          }
        });
      };
    }
  }

  function renderStakesPills() {
    const wrap = $('#stageStakesList');
    if (!wrap || !window.EK.STAKES) return;
    const stakes = window.EK.STAKES;

    wrap.innerHTML = Object.entries(stakes).map(([id, s]) => {
      const active = id === selectedStake;
      let costText = lang === 'th' ? 'ฟรี' : 'Free';
      if (s.coins > 0 || s.diamonds > 0) {
        const parts = [];
        if (s.coins > 0) parts.push(`🪙 ${s.coins.toLocaleString()}`);
        if (s.diamonds > 0) parts.push(`💎 ${s.diamonds}`);
        costText = parts.join(' + ');
      }
      return `
        <div class="stake-pill ${active ? 'active' : ''} tier-${id}" data-stk="${id}">
          <span class="sp-icon">${s.icon}</span>
          <div class="sp-body">
            <b class="sp-name">${esc(s.name[lang] || s.name.th)}</b>
            <span class="sp-cost">${costText}</span>
          </div>
          <span class="sp-mult-tag">x${s.mult}</span>
        </div>
      `;
    }).join('');

    $$('#stageStakesList .stake-pill').forEach(pill => {
      pill.onclick = () => {
        const stkId = pill.dataset.stk;
        selectedStake = stkId;
        localStorage.setItem('ek_stake', stkId);
        A.sfx('select');
        $$('#stageStakesList .stake-pill').forEach(p => p.classList.toggle('active', p === pill));
        renderStageCards(); // Update payout previews
      };
    });
  }

  function renderStageCards() {
    const wrap = $('#stagesCarousel');
    if (!wrap) return;
    const currentStk = (window.EK.STAKES && window.EK.STAKES[selectedStake]) || { mult: 1, coins: 0, diamonds: 0 };

    wrap.innerHTML = STAGES_LIST.map(st => {
      const active = st.id === homeVersion;
      const coinWin = Math.round(120 * currentStk.mult);
      const diaWin = 3 + (currentStk.bonusDiamonds || currentStk.diamonds * 2 || 0);

      return `
        <div class="stage-card ${active ? 'active' : ''} theme-${st.theme}" data-stage-id="${st.id}" style="--st-accent:${st.accent}; --st-glow:${st.glow};">
          <div class="stage-card-glow-bg"></div>
          <div class="stage-card-body">
            <!-- Stage Tag -->
            <div class="stage-header-tag" style="background:${st.badgeBg}; color:${st.accent}; border-color:${st.accent};">
              <span class="sht-dot" style="background:${st.accent};"></span>
              <span>${esc(st.tag[lang] || st.tag.th)}</span>
            </div>

            <!-- Mascot Hero -->
            <div class="stage-mascot-box">
              <div class="mascot-halo" style="background:radial-gradient(circle, ${st.glow} 0%, transparent 70%);"></div>
              <div class="mascot-svg-wrap">
                ${renderAvatarSVG(st.avatar)}
              </div>
            </div>

            <!-- Titles & Description -->
            <div class="stage-card-meta">
              <h3 class="stage-card-title">${esc(st.name[lang] || st.name.th)}</h3>
              <p class="stage-card-desc">${esc(st.desc[lang] || st.desc.th)}</p>
            </div>

            <!-- High Stakes Prize Pool Preview -->
            <div class="stage-prize-preview">
              <div class="spp-head">
                <span>🏆 ${lang === 'th' ? 'รางวัลผู้ชนะ' : 'Winner Pool'}</span>
                <b class="spp-mult">x${currentStk.mult}</b>
              </div>
              <div class="spp-values">
                <span class="spp-coin">🪙 +${coinWin.toLocaleString()}</span>
                <span class="spp-dia">💎 +${diaWin}</span>
              </div>
            </div>

            <!-- Action Button -->
            <button class="stage-start-btn" data-stage-btn="${st.id}">
              <span class="ssb-icon">${st.id === 'custom' ? '⚙️' : '🚀'}</span>
              <span class="ssb-text">${st.id === 'custom' ? (lang === 'th' ? 'ปรับแต่งกติกา' : 'Custom Rules') : (lang === 'th' ? 'ลุยเลย! (START)' : 'PLAY NOW')}</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Stage card click selection
    $$('#stagesCarousel .stage-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.stage-start-btn')) return; // Handled by button
        const sid = card.dataset.stageId;
        homeVersion = sid;
        localStorage.setItem('ek_ver', homeVersion);
        A.sfx('select');
        $$('#stagesCarousel .stage-card').forEach(c => c.classList.toggle('active', c === card));
      };
    });

    // Stage start button click
    $$('#stagesCarousel .stage-start-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const sid = btn.dataset.stageBtn;
        homeVersion = sid;
        localStorage.setItem('ek_ver', homeVersion);
        A.sfx('click');

        if (sid === 'custom') {
          openPlayFriendsModal();
          return;
        }

        // Check if user has sufficient stake balance
        const stk = (window.EK.STAKES && window.EK.STAKES[selectedStake]) || { coins: 0, diamonds: 0 };
        const myC = user ? user.coins : parseInt(localStorage.getItem('ek_guest_coins') || '100');
        const myD = user ? (user.diamonds || 0) : parseInt(localStorage.getItem('ek_guest_diamonds') || '20');
        if (stk.coins > myC || stk.diamonds > myD) {
          toast(lang === 'th' ? 'เหรียญหรือเพชรไม่พอสำหรับระดับเดิมพันนี้!' : 'Insufficient coins or diamonds for this stake!', 'err');
          return;
        }

        socket.emit('createRoom', {
          name: myName(),
          avatar: myAvatar(),
          frame: myFrame(),
          skin: mySkin(),
          title: myTitle(),
          settings: {
            version: sid,
            stake: selectedStake
          }
        });
      };
    });
  }

  
  function openPinEntryModal() {
    A.sfx('click');
    openModal(`
      <div class="pin-modal-wrap">
        <div class="pin-modal-header">
          <div class="pin-modal-badge">ROOM PIN</div>
          <h2 class="pin-modal-title">🔑 ${lang === 'th' ? 'ใส่รหัสห้อง 4 หลัก' : 'Enter 4-Letter Room PIN'}</h2>
          <p class="pin-modal-desc">${lang === 'th' ? 'กรอกรหัสห้อง 4 ตัวอักษรที่เพื่อนแชร์มาเพื่อเข้าร่วมเกมทันที' : 'Enter the 4-character code shared by your friend to join the room.'}</p>
        </div>
        <div class="pin-modal-inputs">
          <input class="stage-pin-box pin-modal-box" id="mpin0" maxlength="1" autocomplete="off" autocapitalize="characters" placeholder="·">
          <input class="stage-pin-box pin-modal-box" id="mpin1" maxlength="1" autocomplete="off" autocapitalize="characters" placeholder="·">
          <input class="stage-pin-box pin-modal-box" id="mpin2" maxlength="1" autocomplete="off" autocapitalize="characters" placeholder="·">
          <input class="stage-pin-box pin-modal-box" id="mpin3" maxlength="1" autocomplete="off" autocapitalize="characters" placeholder="·">
        </div>
        <div class="pin-modal-actions">
          <button class="btn gold big pin-modal-submit" id="btnModalPinJoin">
            🚀 ${lang === 'th' ? 'เข้าร่วมห้องเลย (JOIN ROOM)' : 'JOIN ROOM'}
          </button>
        </div>
      </div>
    `);

    const mpins = [$('#mpin0'), $('#mpin1'), $('#mpin2'), $('#mpin3')].filter(Boolean);
    mpins.forEach((inp, idx) => {
      inp.oninput = () => {
        inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (inp.value && idx < mpins.length - 1) {
          mpins[idx + 1].focus();
          mpins[idx + 1].select();
        }
      };
      inp.onkeydown = (e) => {
        if (e.key === 'Backspace' && !inp.value && idx > 0) {
          mpins[idx - 1].focus();
        }
        if (e.key === 'Enter') {
          $('#btnModalPinJoin')?.click();
        }
      };
      inp.onpaste = (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
        for (let i = 0; i < 4; i++) {
          if (mpins[i]) mpins[i].value = paste[i] || '';
        }
        if (paste.length >= 4) {
          $('#btnModalPinJoin')?.click();
        } else if (mpins[Math.min(3, paste.length)]) {
          mpins[Math.min(3, paste.length)].focus();
        }
      };
    });

    const btnJoinModal = $('#btnModalPinJoin');
    if (btnJoinModal) {
      btnJoinModal.onclick = () => {
        const code = mpins.map(p => p.value.trim()).join('').toUpperCase();
        if (code.length < 4) {
          return toast(lang === 'th' ? 'กรุณาระบุรหัสห้องให้ครบ 4 หลัก' : 'Enter 4-letter room code', 'err');
        }
        A.sfx('click');
        closeModal();
        socket.emit('joinRoom', {
          code,
          name: myName(),
          avatar: myAvatar(),
          frame: myFrame(),
          skin: mySkin(),
          title: myTitle()
        });
      };
    }

    setTimeout(() => {
      if (mpins[0]) mpins[0].focus();
    }, 120);
  }

  function setupPinInputs() {
    const btnOpenPin = $('#btnOpenPinModal');
    if (btnOpenPin) btnOpenPin.onclick = () => openPinEntryModal();
    const pins = [$('#pin0'), $('#pin1'), $('#pin2'), $('#pin3')].filter(Boolean);
    if (!pins.length) return;

    pins.forEach((inp, idx) => {
      inp.oninput = () => {
        inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (inp.value && idx < pins.length - 1) {
          pins[idx + 1].focus();
          pins[idx + 1].select();
        }
      };
      inp.onkeydown = (e) => {
        if (e.key === 'Backspace' && !inp.value && idx > 0) {
          pins[idx - 1].focus();
        }
        if (e.key === 'Enter') {
          $('#btnPinJoin')?.click();
        }
      };
      inp.onpaste = (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
        for (let i = 0; i < 4; i++) {
          if (pins[i]) pins[i].value = paste[i] || '';
        }
        if (paste.length >= 4) {
          $('#btnPinJoin')?.click();
        } else if (pins[Math.min(3, paste.length)]) {
          pins[Math.min(3, paste.length)].focus();
        }
      };
    });

    const btnJoin = $('#btnPinJoin');
    if (btnJoin) {
      btnJoin.onclick = () => {
        const code = pins.map(p => p.value.trim()).join('').toUpperCase();
        if (code.length < 4) {
          return toast(lang === 'th' ? 'กรุณาระบุรหัสห้องให้ครบ 4 หลัก' : 'Enter 4-letter room code', 'err');
        }
        A.sfx('click');
        socket.emit('joinRoom', {
          code,
          name: myName(),
          avatar: myAvatar(),
          frame: myFrame(),
          skin: mySkin(),
          title: myTitle()
        });
      };
    }
  }

  function openAllRoomsModal() {
    socket.emit('listRooms');
    A.sfx('click');
    renderRoomsModalContent(cachedRooms);
  }

  function renderRoomsModalContent(rooms = []) {
    const stkConfig = window.EK.STAKES || {};
    const contentHtml = `
      <div class="rooms-modal-head">
        <h2>📋 ${lang === 'th' ? 'ห้องที่กำลังเปิดอยู่' : 'Active Game Rooms'} (${rooms.length})</h2>
        <button class="btn small gold" id="btnRefreshRoomsModal">🔄 ${lang === 'th' ? 'รีเฟรช' : 'Refresh'}</button>
      </div>
      <div class="rooms-modal-list">
        ${!rooms.length ? `
          <div class="rc-empty" style="padding:30px 20px;text-align:center;">
            <div style="font-size:3rem;margin-bottom:10px;">🎪</div>
            <h3 style="color:#fff;margin:0 0 6px 0;">${lang === 'th' ? 'ยังไม่มีห้องเปิดอยู่ขณะนี้' : 'No active rooms'}</h3>
            <p style="color:var(--muted);margin:0 0 16px 0;font-size:0.9rem;">${lang === 'th' ? 'สร้างห้องใหม่ในด่านที่คุณเลือก แล้วชวนเพื่อนหรือบอทมาลุยเลย!' : 'Create a room in your favorite stage and invite friends!'}</p>
            <button class="btn gold pulse" id="btnRoomsModalCreate">${lang === 'th' ? '✨ สร้างห้องในด่านนี้' : '✨ Create Room'}</button>
          </div>
        ` : rooms.map(r => {
          const v = VERSIONS[r.version] || VERSIONS.original;
          const stk = stkConfig[r.stake] || stkConfig.casual || { icon: '🟢', mult: 1 };
          const isLobby = r.state === 'LOBBY';
          return `
            <div class="room-modal-card">
              <div class="rmc-left">
                <span class="rmc-code">${esc(r.code)}</span>
                <span class="rmc-state ${isLobby ? 'lobby' : 'playing'}">
                  ${isLobby ? (lang === 'th' ? '🟢 รอในล็อบบี้' : '🟢 Lobby') : (lang === 'th' ? '🟠 กำลังเล่น' : '🟠 Playing')}
                </span>
                <span class="rmc-stake-tag">${stk.icon} x${stk.mult}</span>
              </div>
              <div class="rmc-center">
                <div class="rmc-host">👑 <b>${esc(r.hostName)}</b></div>
                <div class="rmc-info">${v.icon} ${esc(v.name[lang] || v.name.th)} • 👥 ${r.playerCount}/${r.maxPlayers}</div>
              </div>
              <div class="rmc-action">
                <button class="btn ${isLobby ? 'gold' : 'blue'}" data-modal-join="${esc(r.code)}">
                  ${isLobby ? '🚀 ' + (lang === 'th' ? 'เข้าห้อง' : 'Join') : '👀 ' + (lang === 'th' ? 'รับชม' : 'Spectate')}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    openModal(contentHtml, { cls: 'wide' });

    const btnRef = $('#btnRefreshRoomsModal');
    if (btnRef) {
      btnRef.onclick = () => {
        A.sfx('select');
        socket.emit('listRooms');
      };
    }

    const btnCreate = $('#btnRoomsModalCreate');
    if (btnCreate) {
      btnCreate.onclick = () => {
        closeModal();
        socket.emit('createRoom', {
          name: myName(),
          avatar: myAvatar(),
          frame: myFrame(),
          skin: mySkin(),
          title: myTitle(),
          settings: { version: homeVersion, stake: selectedStake }
        });
      };
    }

    $$('[data-modal-join]').forEach(b => {
      b.onclick = () => {
        closeModal();
        A.sfx('click');
        socket.emit('joinRoom', {
          code: b.dataset.modalJoin,
          name: myName(),
          avatar: myAvatar(),
          frame: myFrame(),
          skin: mySkin(),
          title: myTitle()
        });
      };
    });
  }

  function setupBrowserScreen() {
    setupStageSelectScreen();
  }

  function renderRoomBrowser(rooms = []) {
    cachedRooms = rooms;
    const cnt = $('#browserRoomCount');
    if (cnt) cnt.textContent = String(rooms.length);

    // If modal is currently showing rooms, refresh its view
    if ($('#btnRefreshRoomsModal')) {
      renderRoomsModalContent(rooms);
    }
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
      socket.emit('createRoom', { name: myName(), avatar: myAvatar(), frame: myFrame(), skin: mySkin(), title: myTitle(), settings: { version: homeVersion } });
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
      socket.emit('quickSolo', { name: myName(), avatar: myAvatar(), frame: myFrame(), skin: mySkin(), title: myTitle(), bots, settings: { version: homeVersion } });
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
    $('#stLang').onclick = () => { lang = lang === 'th' ? 'en' : 'th'; localStorage.setItem('ek_lang', lang); lastSettingsKey = ''; lastSettingsStructKey = ''; applyI18n(); openSettingsModal(); };
    $('#stRules').onclick = openRules;
    if ($('#stLogout')) $('#stLogout').onclick = async () => { await api('/api/logout', {}); token = ''; localStorage.removeItem('ek_token'); socket.emit('auth', ''); setUser(null); isGuestSessionActive = false; closeModal(); show('auth'); };
    if ($('#stLogin')) $('#stLogin').onclick = () => { closeModal(); openAuth('login'); };
  }


  // ------------------------------------------------------------ 7-DAY DAILY LOGIN STREAK SYSTEM
  const DAILY_STREAK_AWARDS = [
    { day: 1, coins: 200, diamonds: 10, icon: '🪙', label: { th: 'เหรียญเริ่มต้น', en: 'Starter Pack' } },
    { day: 2, coins: 350, diamonds: 15, icon: '🦴', label: { th: 'กระดูกนำโชค', en: 'Lucky Bone' } },
    { day: 3, coins: 500, diamonds: 25, icon: '🐕', label: { th: 'หมานักสู้', en: 'Fighter Pup' } },
    { day: 4, coins: 700, diamonds: 30, icon: '🥩', label: { th: 'สเต๊กเนื้อทอง', en: 'Golden Steak' } },
    { day: 5, coins: 900, diamonds: 40, icon: '✨', label: { th: 'ผงเวทมนตร์', en: 'Magic Dust' } },
    { day: 6, coins: 1200, diamonds: 50, icon: '💎', label: { th: 'ถุงเพชรใหญ่', en: 'Gem Pouch' } },
    { day: 7, coins: 2500, diamonds: 100, icon: '👑', label: { th: 'ราชาหมาระเบิด', en: 'Golden Doge Jackpot' }, isJackpot: true }
  ];

  function getDailyStreakData() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (user) {
      const last = user.lastDaily || '';
      let streak = user.dailyStreak || 0;
      const claimedToday = last === today;
      if (last && last !== yesterday && last !== today) {
        streak = 0;
      }
      return { streak, claimedToday, today };
    } else {
      const last = localStorage.getItem('ek_daily_last_date') || '';
      let streak = parseInt(localStorage.getItem('ek_daily_streak_count') || '0', 10);
      const claimedToday = last === today;
      if (last && last !== yesterday && last !== today) {
        streak = 0;
      }
      return { streak, claimedToday, today };
    }
  }

  function checkDailyLoginStatus(autoOpen = false) {
    const { streak, claimedToday } = getDailyStreakData();
    const dot = $('#dailyDot');
    if (dot) dot.style.display = claimedToday ? 'none' : 'block';

    if (autoOpen && !claimedToday) {
      if (screen === 'home') {
        setTimeout(() => openDailyStreakModal(), 600);
      }
    }
  }

  function openDailyStreakModal() {
    A.sfx('click');
    const { streak, claimedToday, today } = getDailyStreakData();
    const isTh = lang === 'th';
    const nextDay = claimedToday ? Math.min(7, streak) : Math.min(7, (streak % 7) + 1);

    const cardsHtml = DAILY_STREAK_AWARDS.map(item => {
      let statusClass = 'locked';
      let badgeText = isTh ? `วันที่ ${item.day}` : `Day ${item.day}`;
      let checkMark = '';

      if (claimedToday) {
        if (item.day <= streak) {
          statusClass = 'claimed';
          checkMark = '<span class="d-check">✅</span>';
        }
      } else {
        if (item.day < nextDay) {
          statusClass = 'claimed';
          checkMark = '<span class="d-check">✅</span>';
        } else if (item.day === nextDay) {
          statusClass = 'active';
          checkMark = '<span class="d-claim-tag">' + (isTh ? 'กดรับ!' : 'CLAIM') + '</span>';
        }
      }

      return `
        <div class="daily-card ${statusClass} ${item.isJackpot ? 'jackpot' : ''}">
          <div class="dc-day">${badgeText} ${checkMark}</div>
          <div class="dc-icon">${item.icon}</div>
          <div class="dc-rewards">
            <span class="dc-coins">🪙 ${item.coins.toLocaleString()}</span>
            <span class="dc-dia">💎 ${item.diamonds}</span>
          </div>
          <div class="dc-lbl">${item.label[lang] || item.label.th}</div>
        </div>
      `;
    }).join('');

    const claimBtnHtml = claimedToday
      ? `<div class="daily-claimed-msg">✅ ${isTh ? `คุณรับรางวัลของวันที่ ${streak} เรียบร้อยแล้ว! พรุ่งนี้กลับมารับวันที่ ${Math.min(7, (streak % 7) + 1)} ต่อนะ` : `You have already claimed Day ${streak}! Come back tomorrow for Day ${Math.min(7, (streak % 7) + 1)}!`}</div>`
      : `<button class="btn big gold daily-claim-action" id="btnClaimDailyStreak">✦ ${isTh ? `รับรางวัลวันที่ ${nextDay} ฟรี! (CLAIM DAY ${nextDay})` : `CLAIM DAY ${nextDay} REWARD!`} ✦</button>`;

    openModal(`
      <div class="daily-calendar-wrap">
        <div class="daily-header">
          <div class="daily-mascot">🐕🎁</div>
          <div class="daily-title-box">
            <h2>📅 ${isTh ? 'เช็คอินรายวัน 7 วัน (7-Day Daily Streak)' : '7-Day Daily Login Streak'}</h2>
            <p>${isTh ? 'เข้าเล่นทุกวันเพื่อสะสมของรางวัล ยิ่งล็อกอินติดกันรางวัลยิ่งใหญ่!' : 'Log in every day to collect rewards! Greater streak, bigger jackpot!'}</p>
          </div>
        </div>
        <div class="daily-grid">${cardsHtml}</div>
        <div class="daily-footer-row">${claimBtnHtml}</div>
      </div>
    `, { cls: 'wide' });

    const btnClaim = $('#btnClaimDailyStreak');
    if (btnClaim) {
      btnClaim.onclick = async () => {
        btnClaim.disabled = true;
        btnClaim.textContent = isTh ? '⏳ กำลังรับรางวัล...' : '⏳ Claiming...';

        if (user) {
          try {
            const r = await api('/api/daily', 'POST');
            if (r.error) {
              toast('⚠️ ' + (r.error === 'claimed' ? (isTh ? 'คุณรับรางวัลของวันนี้ไปแล้ว' : 'Already claimed today') : r.error), 'err');
              closeModal(true);
              return;
            }
            setUser(r.user, r.vault);
            renderUserChip();
            A.sfx('win');
            confetti(true);
            toast(isTh ? `🎉 เช็คอินสำเร็จ! วันที่ ${r.streak}: +🪙${r.amount} +💎${r.diamonds}` : `🎉 Claimed Day ${r.streak}! +🪙${r.amount} +💎${r.diamonds}`, 'good');
            checkDailyLoginStatus(false);
            openDailyStreakModal();
          } catch (e) {
            toast(isTh ? '⚠️ การเชื่อมต่อขัดข้อง' : 'Connection error', 'err');
          }
        } else {
          // Guest
          const nextStreak = (streak % 7) + 1;
          const rew = DAILY_STREAK_AWARDS[nextStreak - 1] || DAILY_STREAK_AWARDS[0];
          const curC = parseInt(localStorage.getItem('ek_guest_coins') || '100');
          const curD = parseInt(localStorage.getItem('ek_guest_diamonds') || '20');
          localStorage.setItem('ek_guest_coins', curC + rew.coins);
          localStorage.setItem('ek_guest_diamonds', curD + rew.diamonds);
          localStorage.setItem('ek_daily_last_date', today);
          localStorage.setItem('ek_daily_streak_count', nextStreak);
          renderUserChip();
          A.sfx('win');
          confetti(true);
          toast(isTh ? `🎉 เช็คอินสำเร็จ! วันที่ ${nextStreak}: +🪙${rew.coins} +💎${rew.diamonds}` : `🎉 Claimed Day ${nextStreak}! +🪙${rew.coins} +💎${rew.diamonds}`, 'good');
          checkDailyLoginStatus(false);
          openDailyStreakModal();
        }
      };
    }
  }

  // ------------------------------------------------------------ MAILBOX SYSTEM
  async function checkMailboxStatus() {
    const dots = [$('#btnMail .ti-dot'), $('#btnStageMail .ti-dot')];
    const today = new Date().toISOString().slice(0, 10);
    let hasUnclaimed = false;
    if (user) {
      try {
        const r = await api('/api/mailbox');
        hasUnclaimed = !!(r.mails && r.mails.some(m => !m.claimed));
      } catch (_) {}
    } else {
      const c1 = localStorage.getItem('ek_guest_last_daily') === today;
      const c2 = !!localStorage.getItem('ek_guest_mail_gacha_fest_v2');
      const c3 = !!localStorage.getItem('ek_guest_mail_patch_v3');
      hasUnclaimed = (!c1 || !c2 || !c3);
    }
    dots.forEach(dot => { if (dot) dot.style.display = hasUnclaimed ? 'block' : 'none'; });
  }

  async function openMailboxModal() {
    A.sfx('click');
    let mails = [];
    const today = new Date().toISOString().slice(0, 10);
    if (user) {
      const r = await api('/api/mailbox');
      mails = r.mails || [];
    } else {
      const guestDailyClaimed = localStorage.getItem('ek_guest_last_daily') === today;
      mails = [
        {
          id: 'mail_welcome',
          icon: '🎁',
          title: { th: 'ของขวัญต้อนรับ & รางวัลประจำวัน', en: 'Welcome & Daily Bonus' },
          body: { th: 'ยินดีต้อนรับสู่หมาระเบิดออนไลน์! ล็อกอินทุกวันเพื่อรับเหรียญและเพชรฟรี', en: 'Welcome to Exploding Puppies Online! Log in daily to get free coins & gems.' },
          coins: 500,
          diamonds: 20,
          claimed: guestDailyClaimed
        },
        {
          id: 'mail_gacha_fest_v2',
          icon: '🌟',
          title: { th: 'ฉลองเปิดตู้สุ่มกาชาจ่าฝูงลิมิเต็ด (แจกเพชรฟรี 100 เม็ด!)', en: 'Celestial Alpha Gacha Launch (Free 100 💎!)' },
          body: { th: 'รับเพชรฟรี 100 เม็ดสำหรับทดลองสุ่มตู้กาชาจ่าฝูง 10 ครั้งทันที! ลุ้นรับของระดับ UR ลิมิเต็ด!', en: '100 free diamonds to summon 10x immediately from the limited Celestial Alpha Gacha!' },
          coins: 1500,
          diamonds: 100,
          claimed: !!localStorage.getItem('ek_guest_mail_gacha_fest_v2')
        },
        {
          id: 'mail_patch_v3',
          icon: '📜',
          title: { th: 'จดหมายขอบคุณจากทีมพัฒนา: อัปเดตใหญ่แจกหนัก', en: 'Developer Appreciation Gift: Massive Update' },
          body: { th: 'ขอบคุณผู้เล่นทุกท่านที่ร่วมสนุก! แจกเหรียญและเพชรพิเศษเพื่อความมันส์แบบจัดเต็ม', en: 'Thank you for playing! Special coin & diamond bonus for the massive update.' },
          coins: 1000,
          diamonds: 50,
          claimed: !!localStorage.getItem('ek_guest_mail_patch_v3')
        }
      ];
    }

    const unclaimedCount = mails.filter(m => !m.claimed).length;
    const hasUnclaimed = unclaimedCount > 0;

    openModal(`<div class="mailbox-wrap">
      <div class="mailbox-header">
        <div class="mh-title-box">
          <h2>📬 ${lang === 'th' ? 'กล่องจดหมาย & ของรางวัล' : 'Mailbox & Rewards'}</h2>
          <span class="mailbox-count-pill">${hasUnclaimed ? (lang === 'th' ? `มีรางวัลรอรับ ${unclaimedCount} กล่อง` : `${unclaimedCount} unclaimed`) : (lang === 'th' ? '✓ รับครบแล้ว' : 'All claimed')}</span>
        </div>
        <p class="note" style="margin:4px 0 10px">${lang === 'th' ? 'รับเหรียญทองและเพชรฟรีเพื่อนำไปสุ่มตู้กาชาหรือซื้อไอเทมในร้านค้า' : 'Claim free coins & diamonds to summon from Gacha or purchase items!'}</p>
      </div>
      <div class="mailbox-list">
        ${mails.map(m => {
          const isClaimed = m.claimed;
          const tText = m.title[lang] || m.title.en || m.title;
          const bText = m.body[lang] || m.body.en || m.body;
          const rewards = [];
          if (m.coins) rewards.push(`🪙 +${m.coins.toLocaleString()}`);
          if (m.diamonds) rewards.push(`<b style="color:#7dd3fc">💎 +${m.diamonds}</b>`);
          return `
            <div class="mail-item ${isClaimed ? 'claimed' : 'unread'}">
              <div class="mail-icon-box">${m.icon || '✉️'}</div>
              <div class="mail-info">
                <div class="mail-title-row">
                  <b class="mail-title">${esc(tText)}</b>
                  ${rewards.length ? `<div class="mail-reward-tags">${rewards.map(r => `<span class="reward-tag">${r}</span>`).join('')}</div>` : ''}
                </div>
                <div class="mail-desc">${esc(bText)}</div>
              </div>
              <div class="mail-act">
                ${isClaimed
                  ? `<span class="claimed-badge">✓ ${lang === 'th' ? 'รับแล้ว' : 'Claimed'}</span>`
                  : `<button class="btn small gold btn-claim-single" data-mail="${m.id}">🎁 ${lang === 'th' ? 'กดรับ' : 'Claim'}</button>`}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="mailbox-footer">
        <div class="mf-left">
          ${!user ? `<small class="note">${lang === 'th' ? '💡 ล็อกอินบัญชีเพื่อบันทึกข้อมูลถาวร' : '💡 Log in to save permanently'}</small>` : `<button class="btn small" id="btnMailboxToGacha">🎲 ${lang === 'th' ? 'ไปที่ตู้สุ่มกาชา ➔' : 'Go to Gacha ➔'}</button>`}
        </div>
        <div class="mf-right">
          <button class="btn gold pulse-gold" id="btnClaimAllMail" ${hasUnclaimed ? '' : 'disabled'}>
            ${hasUnclaimed ? `✨ ${lang === 'th' ? `รับทั้งหมด (${unclaimedCount})` : `Claim All (${unclaimedCount})`}` : `✓ ${lang === 'th' ? 'รับครบทุกกล่องแล้ว' : 'All Claimed'}`}
          </button>
        </div>
      </div>
    </div>`, { cls: 'wide' });

    const btnGoGacha = $('#btnMailboxToGacha');
    if (btnGoGacha) btnGoGacha.onclick = () => { closeModal(); openGachaModal(); };

    const handleClaim = async (mailId) => {
      A.sfx('coin');
      confetti(true);

      // Disable buttons during claim to prevent spam
      $$('.btn-claim-single, #btnClaimAllMail').forEach(b => {
        b.disabled = true;
        if (b.id === 'btnClaimAllMail') b.textContent = lang === 'th' ? '⏳ กำลังรับรางวัล...' : 'Claiming...';
      });

      if (user) {
        try {
          const r = await api('/api/mailbox/claim', { mailId });
          if (r.error) {
            if (r.error === 'claimed') {
              toast(lang === 'th' ? '📬 คุณได้รับของรางวัลนี้ไปแล้ว' : 'Already claimed!', 'info');
            } else {
              toast('⚠️ ' + terr(r.error), 'err');
            }
            return openMailboxModal();
          }
          setUser(r.user, r.vault);
          renderUserChip();
          toast(lang === 'th' ? `🎉 รับรางวัลสำเร็จ! +🪙${(r.coins || 0).toLocaleString()} +💎${r.diamonds || 0}` : `Claimed +🪙${(r.coins || 0).toLocaleString()} +💎${r.diamonds || 0}!`, 'good');
        } catch (err) {
          toast(lang === 'th' ? '⚠️ การเชื่อมต่อขัดข้อง กรุณาลองใหม่' : 'Connection error, please retry', 'err');
        }
      } else {
        let addCoins = 0, addDia = 0;
        const targets = mailId === 'all' ? mails.filter(m => !m.claimed) : mails.filter(m => m.id === mailId && !m.claimed);
        if (targets.length === 0) {
          toast(lang === 'th' ? '📬 คุณได้รับของรางวัลนี้ไปแล้ว' : 'Already claimed!', 'info');
          return openMailboxModal();
        }
        targets.forEach(m => {
          if (m.id === 'mail_welcome') {
            localStorage.setItem('ek_guest_last_daily', today);
          } else {
            localStorage.setItem('ek_guest_' + m.id, '1');
          }
          addCoins += m.coins || 0;
          addDia += m.diamonds || 0;
        });
        const curC = parseInt(localStorage.getItem('ek_guest_coins') || '1000');
        const curD = parseInt(localStorage.getItem('ek_guest_diamonds') || '100');
        localStorage.setItem('ek_guest_coins', curC + addCoins);
        localStorage.setItem('ek_guest_diamonds', curD + addDia);
        renderUserChip();
        toast(lang === 'th' ? `🎉 รับรางวัลสำเร็จ! +🪙${addCoins.toLocaleString()} +💎${addDia}` : `Claimed +🪙${addCoins.toLocaleString()} +💎${addDia}!`, 'good');
      }
      checkMailboxStatus();
      openMailboxModal();
    };

    $$('.btn-claim-single').forEach(b => b.onclick = () => handleClaim(b.dataset.mail));
    const btnAll = $('#btnClaimAllMail');
    if (btnAll && hasUnclaimed) btnAll.onclick = () => handleClaim('all');
  }

  // ------------------------------------------------------------ GACHA SYSTEM
  function openGachaModal() {
    A.sfx('click');
    const myDia = user ? (user.diamonds ?? 0) : parseInt(localStorage.getItem('ek_guest_diamonds') || '100');
    openModal(`<div class="gacha-wrap">
      <div class="gacha-banner">
        <div class="gacha-badge-ur">LIMITED UR</div>
        <h2 class="gacha-title">🎲 ${lang === 'th' ? 'ตู้สุ่มราชาจ่าฝูงสุริยันเทวะ' : 'Celestial Alpha Limited Gacha'}</h2>
        <p class="gacha-sub">${lang === 'th' ? 'ลุ้นรับอวตาร 3D ระดับ UR, กรอบมังกรสวรรค์, และหลังไพ่หลุมดำเอกภพ!' : 'Summon UR Celestial God Doge, Celestial Dragon Frame, and Cosmic Void Skin!'}</p>
        <div class="gacha-showcase-row">
          <div class="showcase-card showcase-ur">
            <div class="sc-preview">${renderAvatarSVG('av_god_shiba')}</div>
            <div class="sc-tag ur">UR 5%</div>
            <b>${lang === 'th' ? 'จ่าฝูงสุริยันเทวะ' : 'Celestial Sun God'}</b>
          </div>
          <div class="showcase-card showcase-ssr">
            <div class="sc-preview">${renderAvatarSVG('av_mecha_alpha')}</div>
            <div class="sc-tag ssr">SSR 20%</div>
            <b>${lang === 'th' ? 'ไททันเมคาอัลฟ่า' : 'Titan Mecha Alpha'}</b>
          </div>
          <div class="showcase-card showcase-ssr">
            <div class="sc-preview">${avatarHTML({ avatar: 'av_shiba_vip', frame: 'frame_celestial_dragon' }, 'lg')}</div>
            <div class="sc-tag ur">UR 5%</div>
            <b>${lang === 'th' ? 'กรอบมังกรสวรรค์' : 'Celestial Dragon'}</b>
          </div>
        </div>
      </div>
      <div class="gacha-dia-bar">
        <div class="gdb-left">
          <span>${lang === 'th' ? 'เพชรของคุณ:' : 'Your Diamonds:'}</span>
          <b class="dia-val">💎 ${myDia}</b>
        </div>
        <button class="btn small gold" id="btnGachaGetDia">📬 ${lang === 'th' ? 'รับเพชรฟรีในกล่องจดหมาย' : 'Get Free Diamonds in Mailbox'}</button>
      </div>
      <div class="gacha-rates-note">
        <span>👑 UR: 5%</span> · <span>🌟 SSR: 20%</span> · <span>⭐ SR: 35%</span> · <span>🪙 R: 40%</span>
        <small style="display:block;margin-top:2px;opacity:0.85">${lang === 'th' ? '✨ สุ่ม 10 ครั้ง การันตี SR ขึ้นไปอย่างน้อย 1 ชิ้น! หากได้ไอเทมซ้ำจะเปลี่ยนเป็นเหรียญทองชดเชยทันที' : '✨ 10x roll guarantees at least 1 SR+! Duplicate items convert to coins automatically.'}</small>
      </div>
      <div class="gacha-actions-row">
        <button class="btn gold gacha-pull-btn" data-times="1">
          <span class="btn-sub">🎲 ${lang === 'th' ? 'สุ่ม 1 ครั้ง' : 'Summon 1x'}</span>
          <b class="btn-cost">💎 10</b>
        </button>
        <button class="btn gold gacha-pull-btn pulse-gold" data-times="10">
          <span class="btn-sub">🌟 ${lang === 'th' ? 'สุ่ม 10 ครั้ง (การันตี SR+)' : 'Summon 10x (Guaranteed SR+)'}</span>
          <b class="btn-cost">💎 90 <small class="save-tag">${lang === 'th' ? 'ลด 10%' : '10% OFF'}</small></b>
        </button>
      </div>
    </div>`, { cls: 'wide' });

    const bDia = $('#btnGachaGetDia');
    if (bDia) bDia.onclick = () => { closeModal(); openMailboxModal(); };

    $$('.gacha-pull-btn').forEach(b => b.onclick = () => {
      const times = parseInt(b.dataset.times) || 1;
      executeGachaPull(times);
    });
  }

  async function executeGachaPull(times) {
    const cost = times === 10 ? 90 : 10;
    const curDia = user ? (user.diamonds ?? 0) : parseInt(localStorage.getItem('ek_guest_diamonds') || '100');
    if (curDia < cost) {
      toast(lang === 'th' ? `💎 เพชรไม่พอ (ต้องการ 💎 ${cost} แต่มี 💎 ${curDia})! รับเพชรฟรีได้จากกล่องจดหมาย หรือเล่นชนะเกม` : `Not enough diamonds (need 💎 ${cost}, have 💎 ${curDia})! Claim free diamonds from Mailbox or win matches.`, 'err');
      A.sfx('nope');
      setTimeout(() => openMailboxModal(), 700);
      return;
    }

    // Play Summoning Portal VFX
    A.sfx('magic');
    openModal(`<div class="summon-portal-wrap">
      <div class="portal-core pulse"></div>
      <div class="portal-rings"></div>
      <h2 class="portal-text glow-gold">${lang === 'th' ? 'กำลังอัญเชิญจ่าฝูง...' : 'Summoning Pack Leaders...'}</h2>
    </div>`, { locked: true });

    let result = null;
    if (user) {
      result = await api('/api/gacha', { times });
      if (result.error) {
        closeModal();
        return toast('⚠️ ' + terr(result.error), 'err');
      }
      setUser(result.user, result.vault);
      renderUserChip();
    } else {
      localStorage.setItem('ek_guest_diamonds', curDia - cost);
      const pulls = [];
      const poolR = window.EK.GACHA_POOL.R;
      const inv = JSON.parse(localStorage.getItem('ek_guest_inventory') || '[]');
      let addCoins = 0;

      for (let i = 0; i < times; i++) {
        const roll = Math.random() * 100;
        let tier = 'R';
        if (roll < 5) tier = 'UR';
        else if (roll < 25) tier = 'SSR';
        else if (roll < 60) tier = 'SR';
        else tier = 'R';

        if (times === 10 && i === 9 && tier === 'R') tier = 'SR';
        const pool = window.EK.GACHA_POOL[tier] || poolR;
        const won = pool[Math.floor(Math.random() * pool.length)];

        if (won.type === 'coins') {
          addCoins += won.amount;
          pulls.push({ ...won, isNew: false, amount: won.amount, rarity: tier, tier });
        } else {
          const isDup = inv.includes(won.id);
          if (isDup) {
            const refund = tier === 'UR' ? 600 : (tier === 'SSR' ? 350 : 180);
            addCoins += refund;
            pulls.push({ ...won, isDuplicate: true, refundCoins: refund, rarity: won.tier || tier, tier });
          } else {
            inv.push(won.id);
            pulls.push({ ...won, isNew: true, rarity: won.tier || tier, tier });
          }
        }
      }
      localStorage.setItem('ek_guest_inventory', JSON.stringify(inv));
      const curCoins = parseInt(localStorage.getItem('ek_guest_coins') || '1000');
      localStorage.setItem('ek_guest_coins', curCoins + addCoins);
      renderUserChip();
      result = { pulls };
    }

    setTimeout(() => {
      showGachaResults(result.pulls, times);
    }, 1200);
  }

  function showGachaResults(pulls, times) {
    const tierOf = (p) => p.rarity || p.tier || 'R';
    const hasUR = pulls.some(p => tierOf(p) === 'UR');
    const hasSSR = pulls.some(p => tierOf(p) === 'SSR');
    if (hasUR) { A.sfx('win'); confetti(true); }
    else if (hasSSR) { A.sfx('coin'); confetti(true); }
    else { A.sfx('coin'); }

    openModal(`<div class="gacha-results-wrap">
      <h2 class="results-heading">${lang === 'th' ? '🎉 ผลการสุ่มกาชา' : '🎉 Summon Results'}</h2>
      <div class="gacha-pulls-grid ${pulls.length > 1 ? 'grid-10' : 'grid-1'}">
        ${pulls.map((p, idx) => {
          let preview = '';
          if (p.type === 'avatar') {
            preview = `<div class="pull-av-preview">${renderAvatarSVG(p.id)}</div>`;
          } else if (p.type === 'title') {
            preview = `<div class="pull-title-preview" style="padding:16px 0;">${titleBadgeHTML(p.id, lang)}</div>`;
          } else if (p.type === 'frame') {
            preview = avatarHTML({ avatar: myAvatar(), frame: p.id }, 'lg');
          } else if (p.type === 'skin') {
            preview = backHTML(p.id, 'style="width:68px;height:95px"');
          } else {
            preview = `<div class="coin-bag-art">🪙 <b style="font-size:1.1rem;color:#fde047">+${(p.amount || 0).toLocaleString()}</b></div>`;
          }

          const tier = tierOf(p);
          const rarityCls = tier.toLowerCase();
          const pName = p.name ? (p.name[lang] || p.name.en || p.name) : `เหรียญทอง ${p.amount}`;

          let statusTag = '';
          if (p.isNew) statusTag = `<span class="badge-new">NEW!</span>`;
          else if (p.isDuplicate) statusTag = `<span class="badge-dup">+🪙${p.refundCoins}</span>`;

          return `
            <div class="pull-card tier-${rarityCls} animate-reveal" style="animation-delay:${idx * 0.08}s">
              <div class="pull-rarity-pill ${rarityCls}">${tier}</div>
              ${statusTag}
              ${preview}
              <div class="pull-name">${esc(pName)}</div>
              ${(p.type !== 'coins' && p.isNew) ? `<button class="btn small green btn-pull-equip" data-id="${p.id}" data-type="${p.type}">${lang === 'th' ? 'ใช้งานทันที' : 'Equip'}</button>` : ''}
            </div>
          `;
        }).join('')}
      </div>
      <div class="gacha-results-footer">
        <button class="btn gold pulse-gold" id="btnGachaAgain">🔄 ${lang === 'th' ? `สุ่มอีกครั้ง (${times === 10 ? '💎 90' : '💎 10'})` : `Summon Again (${times === 10 ? '💎 90' : '💎 10'})`}</button>
        <button class="btn" id="btnGachaDone">${lang === 'th' ? 'ตกลง' : 'OK'}</button>
      </div>
    </div>`, { cls: 'wide' });

    $$('.btn-pull-equip').forEach(b => b.onclick = async () => {
      const id = b.dataset.id;
      const type = b.dataset.type;
      if (user) {
        const r = await api('/api/equip', { itemId: id, type });
        if (r.user) setUser(r.user, r.vault);
      } else {
        localStorage.setItem('ek_guest_' + type, id);
        renderUserChip();
      }
      A.sfx('select');
      toast(lang === 'th' ? '✨ สวมใส่สำเร็จ!' : 'Equipped successfully!', 'good');
      b.textContent = lang === 'th' ? '✓ สวมใส่แล้ว' : '✓ Equipped';
      b.classList.remove('green');
      b.disabled = true;
    });

    const bAgain = $('#btnGachaAgain');
    if (bAgain) bAgain.onclick = () => executeGachaPull(times);
    const bDone = $('#btnGachaDone');
    if (bDone) bDone.onclick = () => { closeModal(); renderUserChip(); };
  }

  // Bindings for top bar and main navigation
  const pCard = $('#playerProfileCard'); if (pCard) pCard.onclick = () => openProfile();
  const bDaily = $('#btnDaily'); if (bDaily) bDaily.onclick = openDailyStreakModal;
  const bMail = $('#btnMail'); if (bMail) bMail.onclick = openMailboxModal;
  const bSettings = $('#btnSettings'); if (bSettings) bSettings.onclick = openSettingsModal;

  function toggleFullscreen() {
    A.sfx('click');
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }
  const bFull = $('#btnFullscreen'); if (bFull) bFull.onclick = toggleFullscreen;
  const bFullGame = $('#btnFullscreenGame'); if (bFullGame) bFullGame.onclick = toggleFullscreen;

  const bMatch = $('#btnMatchBrowser'); if (bMatch) bMatch.onclick = openMatchBrowser;
  const bTutorial = $('#btnTutorial'); if (bTutorial) bTutorial.onclick = () => startTutorialGame();
  const bFriends = $('#btnPlayFriends'); if (bFriends) bFriends.onclick = openPlayFriendsModal;
  const bBot = $('#btnCustomBot'); if (bBot) bBot.onclick = openCustomBotModal;

  const dDeck = $('#dockBtnDeck'); if (dDeck) dDeck.onclick = openRules;
  const dShop = $('#dockBtnShop'); if (dShop) dShop.onclick = () => { shopTab = 'frame'; openShop(); };
  const dRanking = $('#dockBtnRanking'); if (dRanking) dRanking.onclick = openLeaderboard;
  const dGacha = $('#dockBtnGacha'); if (dGacha) dGacha.onclick = openGachaModal;
  const bDiamonds = $('#topDiamonds'); if (bDiamonds && bDiamonds.parentElement) bDiamonds.parentElement.onclick = openGachaModal;

  // top toggles
  const syncToggles = () => {
    const s = $('#btnSound'), v = $('#btnVoice');
    if (s) s.textContent = A.opt.sound ? '🔊' : '🔇';
    if (v) v.textContent = A.opt.voice ? '🗣️' : '🤐';
  };
  const btnS = $('#btnSound'); if (btnS) btnS.onclick = () => { A.set('sound', !A.opt.sound); syncToggles(); A.sfx('click'); };
  const btnV = $('#btnVoice'); if (btnV) btnV.onclick = () => { A.set('voice', !A.opt.voice); syncToggles(); if (A.opt.voice) A.say(lang === 'th' ? 'เปิดเสียงพากย์แล้วโฮ่ง' : 'Announcer on, woof', lang); };
  const btnL = $('#btnLang'); if (btnL) btnL.onclick = () => { lang = lang === 'th' ? 'en' : 'th'; localStorage.setItem('ek_lang', lang); lastSettingsKey = ''; lastSettingsStructKey = ''; applyI18n(); renderUserChip(); };

  // ------------------------------------------------------------ AUTH / PROFILE / SHOP / LEADERBOARD / RULES
  function openAuth(mode = 'login') {
    A.sfx('click');
    if (mode === 'login' || mode === 'register') {
      closeModal();
      show('auth');
      if (typeof window.switchAuthTab === 'function') {
        window.switchAuthTab(mode);
      }
      return;
    }
    const savedVaultRaw = localStorage.getItem('ek_account_vault');
    let localVault = null;
    try { if (savedVaultRaw) localVault = JSON.parse(savedVaultRaw); } catch (_) {}

    if (mode === 'forgot') {
      openModal(`<h2>🔑 ${lang === 'th' ? 'รีเซ็ตรหัสผ่าน' : 'Reset Password'}</h2>
        <form id="forgotForm" class="form">
          <input name="username" id="fgUsername" placeholder="${t('username')}" value="${esc(localVault?.username || '')}" autocomplete="username" required>
          <div style="position:relative;">
            <input name="recoveryPin" id="fgPin" placeholder="${lang === 'th' ? 'PIN กู้คืน (หรือชื่อที่แสดงในเกม)' : 'Recovery PIN (or Display Name)'}" value="${esc(localVault?.recoveryPin || '')}" required>
            ${localVault ? `<button type="button" class="btn small" id="btnAutoPin" style="position:absolute;right:4px;top:4px;padding:3px 8px;font-size:0.75rem;">📲 ${lang === 'th' ? 'เติมจากเครื่องนี้' : 'Auto Fill'}</button>` : ''}
          </div>
          <input name="newPassword" type="password" placeholder="${lang === 'th' ? 'รหัสผ่านใหม่ (อย่างน้อย 4 ตัว)' : 'New Password (min 4 chars)'}" autocomplete="new-password" required>
          <input name="confirmPassword" type="password" placeholder="${lang === 'th' ? 'ยืนยันรหัสผ่านใหม่อีกครั้ง' : 'Confirm New Password'}" autocomplete="new-password" required>
          <button class="btn big gold">${lang === 'th' ? '🔄 ตั้งรหัสผ่านใหม่และเข้าสู่ระบบ' : 'Reset Password & Log In'}</button>
        </form>
        <div style="margin-top:14px;text-align:center;">
          <a href="#" id="authBackLogin">${lang === 'th' ? '← กลับไปหน้าเข้าสู่ระบบ' : '← Back to Login'}</a>
        </div>`);

      const bAuto = $('#btnAutoPin');
      if (bAuto && localVault) {
        bAuto.onclick = () => {
          $('#fgUsername').value = localVault.username || '';
          $('#fgPin').value = localVault.recoveryPin || '';
          toast(lang === 'th' ? '📲 ดึงข้อมูลกู้คืนจากเครื่องนี้เรียบร้อย!' : 'Autofilled from device backup!', 'good');
        };
      }

      $('#authBackLogin').onclick = (e) => { e.preventDefault(); openAuth('login'); };

      $('#forgotForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        if (f.newPassword !== f.confirmPassword) {
          return toast('⚠️ ' + (lang === 'th' ? 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' : 'Passwords do not match'), 'err');
        }
        const r = await api('/api/reset-password', f);
        if (r.error) return toast('⚠️ ' + terr(r.error), 'err');
        token = r.token;
        localStorage.setItem('ek_token', token);
        socket.emit('auth', token);
        setUser(r.user, r.vault);
        closeModal();
        A.sfx('coin');
        toast(lang === 'th' ? '✨ รีเซ็ตรหัสผ่านและเข้าสู่ระบบสำเร็จ!' : 'Password reset successfully!', 'good');
      };
      return;
    }

    if (mode === 'import') {
      openModal(`<h2>📥 ${lang === 'th' ? 'กู้คืนบัญชีด้วยรหัสสำรอง (Passkey)' : 'Restore from Account Passkey'}</h2>
        <p class="note" style="margin-bottom:10px;">${lang === 'th' ? 'วางรหัสสำรองบัญชี (Passkey) ที่เคยคัดลอกไว้ เพื่อดึงข้อมูลบัญชี ไอเทม เหรียญ และเพชรกลับมาทันที' : 'Paste your exported account passkey to restore your account and items.'}</p>
        <textarea id="passkeyInput" class="form-input" style="width:100%;height:85px;font-family:monospace;font-size:0.8rem;border-radius:8px;padding:8px;box-sizing:border-box;background:#0f172a;color:#f8fafc;border:1px solid #334155;" placeholder="${lang === 'th' ? 'วางรหัส Passkey ที่นี่...' : 'Paste Passkey here...'}"></textarea>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button class="btn gold" id="btnDoImport" style="flex:1;">✨ ${lang === 'th' ? 'กู้คืนบัญชี' : 'Restore Account'}</button>
          <button class="btn" id="btnCancelImport">${lang === 'th' ? 'ยกเลิก' : 'Cancel'}</button>
        </div>`);

      $('#btnCancelImport').onclick = () => openAuth('login');
      $('#btnDoImport').onclick = async () => {
        const raw = $('#passkeyInput').value.trim();
        if (!raw) return toast(lang === 'th' ? 'กรุณาวางรหัส Passkey' : 'Please paste a passkey', 'err');
        try {
          const jsonStr = decodeURIComponent(escape(atob(raw)));
          const vaultObj = JSON.parse(jsonStr);
          const r = await api('/api/restore-account', { vault: vaultObj });
          if (r.error) return toast('⚠️ ' + terr(r.error), 'err');
          token = r.token;
          localStorage.setItem('ek_token', token);
          socket.emit('auth', token);
          setUser(r.user, r.vault);
          closeModal();
          A.sfx('win');
          confetti(true);
          toast(lang === 'th' ? `🎉 กู้คืนบัญชี @${r.user.username} สำเร็จ!` : 'Account restored successfully!', 'good');
        } catch (err) {
          toast(lang === 'th' ? '⚠️ รหัส Passkey ไม่ถูกต้อง' : 'Invalid passkey', 'err');
        }
      };
      return;
    }

    const reg = mode === 'register';
    openModal(`<h2>${reg ? '📝 ' + t('register') : '🔑 ' + t('login')}</h2>
      <form id="authForm" class="form">
        <input name="username" placeholder="${t('username')}" autocomplete="username" required>
        ${reg ? `<input name="displayName" placeholder="${t('displayName')}" maxlength="16">` : ''}
        <input name="password" type="password" placeholder="${t('password')}" autocomplete="${reg ? 'new-password' : 'current-password'}" required>
        ${reg ? `<input name="recoveryPin" placeholder="${lang === 'th' ? 'PIN กู้คืน 4-6 หลัก (สำหรับรีเซ็ตหากลืมรหัส)' : 'Recovery PIN (4-6 digits for reset)'}" maxlength="8" required>` : ''}
        <button class="btn big gold">${reg ? t('register') : t('login')}</button>
      </form>
      <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;font-size:0.9rem;">
        ${!reg ? `<a href="#" id="authForgot" style="color:#f59e0b;text-decoration:underline;">❓ ${lang === 'th' ? 'ลืมรหัสผ่าน?' : 'Forgot Password?'}</a>` : '<span></span>'}
        <a href="#" id="authSwitch">${reg ? t('haveAccount') : t('noAccount')}</a>
      </div>
      <div style="margin-top:12px;text-align:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;">
        <a href="#" id="authImport" style="font-size:0.82rem;color:var(--muted);text-decoration:none;">📥 ${lang === 'th' ? 'นำเข้าบัญชีเดิมด้วยรหัสสำรอง (Passkey)' : 'Restore from Account Passkey'}</a>
      </div>`);

    const bForgot = $('#authForgot');
    if (bForgot) bForgot.onclick = (e) => { e.preventDefault(); openAuth('forgot'); };
    const bImport = $('#authImport');
    if (bImport) bImport.onclick = (e) => { e.preventDefault(); openAuth('import'); };
    $('#authSwitch').onclick = (e) => { e.preventDefault(); openAuth(reg ? 'login' : 'register'); };

    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const r = await api(reg ? '/api/register' : '/api/login', f);
      if (r.error) return toast('⚠️ ' + terr(r.error), 'err');
      token = r.token;
      localStorage.setItem('ek_token', token);
      socket.emit('auth', token);
      setUser(r.user, r.vault);
      closeModal();
      A.sfx('coin');
      toast('👋 ' + esc(r.user.displayName));
      if (reg) {
        setTimeout(() => {
          if (window.onNewAccountCreated) window.onNewAccountCreated(r.user);
          else showNewAccountTutorialPrompt(r.user);
        }, 500);
      }
    };
  }

  const EMOJI_AVATARS = ['🐶', '🐕', '🦮', '🐩', '🐕‍🦺', '🐺', '🦊', '🐾', '🦴', '🌭', '🦝', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🦄', '🐲'];
  function openProfile() {
    if (!user) return openAuth('login');
    const r = rankOf(user.rp), st = user.stats;
    const nextRank = window.EK.RANKS.find(x => x.min > user.rp);
    const inv = user.inventory || [];
    const ownedAvatars = window.EK.AVATARS.filter(a => inv.includes(a.id));
    const curAvatar = user.equipped?.avatar || user.avatar || '🐶';
    const curTitle = user.equipped?.title || user.title || 'title_rookie';
    const allTitles = [...(window.EK?.TITLES || [])];
    if (window.EK?.GACHA_POOL) {
      for (const tier of Object.keys(window.EK.GACHA_POOL)) {
        for (const it of window.EK.GACHA_POOL[tier]) {
          if (it.type === 'title' && !allTitles.some(x => x.id === it.id)) allTitles.push(it);
        }
      }
    }
    const ownedTitles = allTitles.filter(t => t.id === 'title_rookie' || inv.includes(t.id));

    openModal(`<h2>👤 ${t('profile')}</h2>
      <div class="profile-head">${avatarHTML({ avatar: curAvatar, frame: user.equipped?.frame }, 'lg')}
        <div><h3>${esc(user.displayName)} <small>@${esc(user.username)}</small> ${titleBadgeHTML(curTitle, lang)}</h3>
        <div class="rank-line">${r.icon} <b>${r.name[lang]}</b> · ${user.rp} RP ${nextRank ? `<div class="bar"><i style="width:${Math.round((user.rp - r.min) / (nextRank.min - r.min) * 100)}%"></i></div><small>→ ${nextRank.icon} ${nextRank.min} RP</small>` : ''}</div>
        <div class="coins big">🪙 ${user.coins} · 💎 ${user.diamonds ?? 0}</div></div></div>
      <div class="stat-grid"><div><b>${st.games}</b>${t('games')}</div><div><b>${st.wins}</b>${t('wins')}</div><div><b>${st.games ? Math.round(st.wins / st.games * 100) : 0}%</b>${t('winRate')}</div><div><b>${st.explosions}</b>${t('explosions')}</div><div><b>${st.defuses}</b>${t('defusesStat')}</div></div>
      <h4>${t('displayName')}</h4><div class="row"><input id="pfName" value="${esc(user.displayName)}" maxlength="16"><button class="btn small" id="pfSave">${t('save')}</button></div>

      <h4>🔐 ${lang === 'th' ? 'ความปลอดภัย & สำรองบัญชี (กันข้อมูลหาย)' : 'Security & Account Backup'}</h4>
      <div class="security-card" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span>${lang === 'th' ? 'PIN กู้คืนรหัสผ่านของคุณ:' : 'Your Recovery PIN:'} <b style="color:#fbbf24;letter-spacing:1px;font-size:1.05rem;">${user.recoveryPin || '1234'}</b></span>
          <button class="btn small" id="btnChangePin">✏️ ${lang === 'th' ? 'เปลี่ยน PIN' : 'Change PIN'}</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn small gold" id="btnExportPasskey" style="flex:1;">📋 ${lang === 'th' ? 'คัดลอกรหัสสำรองบัญชี (Passkey)' : 'Copy Account Passkey'}</button>
        </div>
        <small class="note" style="display:block;margin-top:6px;font-size:0.75rem;">${lang === 'th' ? '💡 หากเซิร์ฟเวอร์รีสตาร์ท ระบบจะกู้คืนข้อมูลให้อัตโนมัติ หรือคัดลอก Passkey ไปกู้คืนในเครื่องอื่นได้' : '💡 Accounts auto-restore after server restarts. You can also paste this passkey on another device.'}</small>
      </div>

      <h4>🎖️ ${lang === 'th' ? 'ยศและฉายาของคุณ (สวมใส่ไปโชว์ในเกม)' : 'Your Titles & Ranks (Equip to show in game)'}</h4>
      <div class="owned-titles-grid">
        ${ownedTitles.map(t => `
          <button class="btn-owned-title ${curTitle === t.id ? 'on' : ''}" data-title="${t.id}" title="${esc(t.desc?.[lang] || t.desc?.th || '')}">
            ${titleBadgeHTML(t.id, lang)}
            <small class="otitle-desc">${esc(t.desc?.[lang] || t.desc?.th || '')}</small>
          </button>
        `).join('')}
      </div>

      <h4>🎭 ${lang === 'th' ? 'อวตาร 3D & ลิมิเต็ดของคุณ' : 'Your 3D & Limited Avatars'}</h4>
      <div class="owned-avatars-row">
        ${ownedAvatars.length ? ownedAvatars.map(a => `
          <button class="btn-owned-av ${curAvatar === a.id ? 'on' : ''}" data-av="${a.id}" title="${esc(a.name[lang] || a.name.en)}">
            <div class="oav-preview">${renderAvatarSVG(a.id)}</div>
            <span class="oav-name">${esc(a.name[lang] || a.name.en)}</span>
          </button>
        `).join('') : `<p class="note" style="margin:4px 0">${lang === 'th' ? 'ยังไม่มีอวตาร 3D ซื้อได้ที่ร้านค้าหรือสุ่มได้จากตู้กาชา!' : 'No 3D avatars owned. Visit the Shop or Gacha!'}</p>`}
      </div>

      <h4>🐶 ${lang === 'th' ? 'อวตารอิโมจิคลาสสิก' : 'Classic Dog Emojis'}</h4>
      <div class="avatar-pick">${EMOJI_AVATARS.map(a => `<button class="${a === curAvatar ? 'on' : ''}" data-av="${a}">${a}</button>`).join('')}</div>

      <h4>${t('history')}</h4><div class="history">${(user.history || []).map(h => `<div>#${h.place}/${h.total} · ${VERSIONS[h.version]?.icon || ''} · 🪙+${h.coins}${h.diamonds ? ` · <b style="color:#38bdf8">💎+${h.diamonds}</b>` : ''} · ${h.rp >= 0 ? '+' : ''}${h.rp} RP</div>`).join('') || '-'}</div>
      <div class="row" style="margin-top:12px;gap:8px;"><button class="btn small" id="pfShop">🛒 ${t('shop')}</button><button class="btn small gold" id="pfGacha">🎲 ${t('gacha') || 'กาชา'}</button><button class="btn small red" id="pfLogout">${t('logout')}</button></div>`);

    const save = async (body) => {
      const r2 = await api('/api/profile', body);
      if (r2.user) {
        setUser(r2.user, r2.vault);
        openProfile();
      }
    };

    $('#pfSave').onclick = () => save({ displayName: $('#pfName').value });
    $$('[data-av]').forEach(b => b.onclick = () => save({ avatar: b.dataset.av }));
    $$('[data-title]').forEach(b => b.onclick = async () => {
      const r = await api('/api/equip', { itemId: b.dataset.title, type: 'title' });
      if (r.user) {
        setUser(r.user, r.vault);
        A.sfx('select');
        openProfile();
      }
    });

    $('#btnChangePin').onclick = async () => {
      const newPin = prompt(lang === 'th' ? 'กรอก PIN กู้คืนรหัสผ่านใหม่ (4-12 ตัวอักษร):' : 'Enter new Recovery PIN (4-12 chars):', user.recoveryPin || '');
      if (newPin && newPin.trim().length >= 4) {
        const r = await api('/api/update-pin', { recoveryPin: newPin.trim() });
        if (r.error) return toast('⚠️ ' + terr(r.error), 'err');
        setUser(r.user, r.vault);
        A.sfx('coin');
        toast(lang === 'th' ? '✨ เปลี่ยน PIN กู้คืนสำเร็จ!' : 'Recovery PIN updated!', 'good');
        openProfile();
      }
    };

    $('#btnExportPasskey').onclick = () => {
      const v = localStorage.getItem('ek_account_vault');
      if (v) {
        const code = btoa(unescape(encodeURIComponent(v)));
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(() => {
            toast(lang === 'th' ? '📋 คัดลอกรหัสสำรองบัญชี (Passkey) สำเร็จ!' : 'Passkey copied to clipboard!', 'good');
            A.sfx('coin');
          }).catch(() => prompt(lang === 'th' ? 'คัดลอกรหัสสำรองบัญชีของคุณ:' : 'Copy your passkey:', code));
        } else {
          prompt(lang === 'th' ? 'คัดลอกรหัสสำรองบัญชีของคุณ:' : 'Copy your passkey:', code);
        }
      } else {
        toast(lang === 'th' ? 'ไม่พบข้อมูลบัญชี' : 'No account vault found', 'err');
      }
    };

    $('#pfShop').onclick = () => { closeModal(); openShop(); };
    $('#pfGacha').onclick = () => { closeModal(); openGachaModal(); };
    $('#pfLogout').onclick = async () => {
      await api('/api/logout', {});
      token = '';
      localStorage.removeItem('ek_token');
      socket.emit('auth', '');
      setUser(null);
      closeModal();
    };
  }

  let shopTab = 'avatar';
  function openShop() {
    const inv = user ? (user.inventory || []) : JSON.parse(localStorage.getItem('ek_guest_inventory') || '[]');
    const eqAv = myAvatar();
    const eqFrame = myFrame();
    const eqSkin = mySkin();
    const eqTitle = myTitle();

    const tabs = [
      ['avatar', '🎭 ' + (t('avatars') || 'อวตาร')],
      ['title', '🎖️ ' + (lang === 'th' ? 'ยศ/ฉายา' : 'Titles')],
      ['frame', '🖼️ ' + t('frames')],
      ['skin', '🎴 ' + t('skins')],
      ['sticker', '🐶 ' + t('stickers')]
    ];

    const items = window.EK.SHOP.filter(i => i.type === shopTab).map(i => {
      const owned = inv.includes(i.id) || (i.id === 'title_rookie');
      const eq = i.type === 'avatar' ? (eqAv === i.id)
        : i.type === 'frame' ? (eqFrame === i.id)
        : i.type === 'skin' ? (eqSkin === i.id)
        : i.type === 'title' ? (eqTitle === i.id)
        : false;

      let preview = '';
      if (i.type === 'avatar') {
        preview = `<div class="shop-avatar-box">${renderAvatarSVG(i.id)}</div>`;
      } else if (i.type === 'title') {
        preview = `<div class="shop-title-preview">${titleBadgeHTML(i.id, lang)}<div class="shop-title-desc">${esc(i.desc?.[lang] || i.desc?.th || '')}</div></div>`;
      } else if (i.type === 'frame') {
        preview = avatarHTML({ avatar: eqAv || '🐶', frame: i.id }, 'lg');
      } else if (i.type === 'skin') {
        preview = backHTML(i.id, 'style="width:70px;height:98px"');
      } else {
        preview = `<div class="sticker-big">${i.icon}</div>`;
      }

      let btn = '';
      if (!owned) {
        btn = `<button class="btn small gold" data-buy="${i.id}">🪙 ${i.price}</button>`;
      } else if (i.type === 'sticker') {
        btn = `<span class="tag">${t('owned')}</span>`;
      } else {
        const unequipVal = i.type === 'title' ? 'title_rookie' : '';
        btn = `<button class="btn small ${eq ? '' : 'green'}" data-equip="${eq ? unequipVal : i.id}" data-type="${i.type}">${eq ? t('unequip') : t('equip')}</button>`;
      }
      return `<div class="shop-item ${owned ? 'owned' : ''}">
        ${preview}
        <div class="shop-item-name">${i.icon} ${esc(i.name[lang] || i.name.en || i.id)}</div>
        ${btn}
      </div>`;
    }).join('');

    const coinVal = user ? user.coins : (localStorage.getItem('ek_guest_coins') || 100);
    const diaVal = user ? (user.diamonds ?? 0) : (localStorage.getItem('ek_guest_diamonds') || 20);

    openModal(`<h2>🛒 ${t('shop')} <span class="coins">🪙 ${coinVal} · 💎 ${diaVal}</span></h2>
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <button class="btn small gold" id="btnShopMail">📬 ${lang === 'th' ? 'กล่องจดหมาย & โบนัส' : 'Mailbox & Bonus'}</button>
        <button class="btn small gold pulse-gold" id="btnShopGacha">🎲 ${t('gacha') || 'ตู้สุ่มกาชา'}</button>
      </div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${k === shopTab ? 'active' : ''}" data-st="${k}">${l}</button>`).join('')}</div>
      <div class="shop-grid">${items}</div>`, { cls: 'wide' });

    $$('[data-st]').forEach(b => b.onclick = () => { shopTab = b.dataset.st; openShop(); });
    const bMail = $('#btnShopMail'); if (bMail) bMail.onclick = () => { closeModal(); openMailboxModal(); };
    const bGacha = $('#btnShopGacha'); if (bGacha) bGacha.onclick = () => { closeModal(); openGachaModal(); };

    $$('[data-buy]').forEach(b => b.onclick = async () => {
      const itemId = b.dataset.buy;
      if (user) {
        const r = await api('/api/buy', { itemId });
        if (r.error) return toast('⚠️ ' + terr(r.error), 'err');
        setUser(r.user, r.vault);
        A.sfx('coin');
        confetti(true);
        openShop();
      } else {
        const item = window.EK.SHOP.find(x => x.id === itemId);
        const curCoins = parseInt(localStorage.getItem('ek_guest_coins') || '100');
        if (curCoins < item.price) return toast(lang === 'th' ? 'เหรียญไม่พอ!' : 'Not enough coins!', 'err');
        localStorage.setItem('ek_guest_coins', curCoins - item.price);
        const gInv = JSON.parse(localStorage.getItem('ek_guest_inventory') || '[]');
        gInv.push(itemId);
        localStorage.setItem('ek_guest_inventory', JSON.stringify(gInv));
        if (item.type === 'avatar') localStorage.setItem('ek_guest_avatar', itemId);
        else if (item.type === 'title') localStorage.setItem('ek_guest_title', itemId);
        else if (item.type === 'frame') localStorage.setItem('ek_guest_frame', itemId);
        else if (item.type === 'skin') localStorage.setItem('ek_guest_skin', itemId);
        renderUserChip();
        A.sfx('coin');
        confetti(true);
        openShop();
      }
    });

    $$('[data-equip]').forEach(b => b.onclick = async () => {
      const itemId = b.dataset.equip;
      const type = b.dataset.type;
      if (user) {
        const r = await api('/api/equip', { itemId, type });
        if (r.user) { setUser(r.user, r.vault); A.sfx('select'); openShop(); }
      } else {
        if (itemId) localStorage.setItem('ek_guest_' + type, itemId);
        else if (type === 'title') localStorage.setItem('ek_guest_title', 'title_rookie');
        else localStorage.removeItem('ek_guest_' + type);
        renderUserChip();
        A.sfx('select');
        openShop();
      }
    });
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
          socket.emit('quickSolo', { name: myName(), avatar: myAvatar(), frame: myFrame(), skin: mySkin(), title: myTitle(), bots: 1, settings: { version: homeVersion || 'original' } });
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

  
  // ------------------------------------------------------------ 1v1 INTERACTIVE TUTORIAL ENGINE & ONBOARDING
  let tutorialActive = false;
  let tutTimers = [];
  function addTutTimer(fn, delay) {
    const t = setTimeout(fn, delay);
    tutTimers.push(t);
    return t;
  }
  function clearTutTimers() {
    tutTimers.forEach(t => clearTimeout(t));
    tutTimers = [];
  }

  const tutorialEngine = {
    step: 1,
    substep: '',
    collapsed: false,

    toggleCollapse() {
      this.collapsed = !this.collapsed;
      this.renderCoach();
    },

    promptExit() {
      const isTh = lang === 'th';
      openModal(`
        <div style="text-align:center;padding:12px;">
          <h3>🚪 ${isTh ? 'ต้องการออกจากการฝึกสอนหรือไม่?' : 'Exit Training Mode?'}</h3>
          <p style="color:#cbd5e1;margin:10px 0 20px;">
            ${isTh ? 'คุณสามารถกลับมาฝึกสอนใหม่ได้ตลอดเวลาจากปุ่มบนหน้าหลัก' : 'You can restart the tutorial anytime from the home screen.'}
          </p>
          <div style="display:flex;gap:12px;justify-content:center;">
            <button class="btn red" id="btnConfirmExitTut">${isTh ? 'ออกจากการฝึก' : 'Exit to Lobby'}</button>
            <button class="btn gold" id="btnResumeTut">${isTh ? 'ฝึกต่อ' : 'Continue'}</button>
          </div>
        </div>
      `);
      $('#btnConfirmExitTut').onclick = () => {
        closeModal(true);
        exitTutorialGame();
      };
      $('#btnResumeTut').onclick = () => closeModal(true);
    },

    clearHighlights() {
      $$('.tutorial-highlight-target').forEach(el => el.classList.remove('tutorial-highlight-target'));
      $$('.pulse-card-guide').forEach(el => el.classList.remove('pulse-card-guide'));
    },

    setStep(step, substep = '') {
      this.step = step;
      this.substep = substep;
      this.renderCoach();
    },

    canDraw() {
      return (this.step === 1) || (this.step === 3 && this.substep === 'draw');
    },

    canNope() {
      return this.step === 4;
    },

    onCardSelect(uid, el) {
      const card = S?.me?.hand?.find(c => c.uid === uid);
      if (!card) return true;

      // Input guard per step
      if (this.step === 1 || (this.step === 3 && this.substep === 'draw')) {
        this.wobbleCoach(lang === 'th' ? 'โฮ่ง! ในบทนี้ให้ลองฝึกจั่วการ์ดจบเทิร์นก่อนนะ แตะที่กองการ์ดด้านบนเลย!' : 'Woof! In this step, tap the draw pile above to end your turn!');
        A.sfx('nope');
        this.wobbleEl(el);
        return false;
      }
      if (this.step === 2 && card.id !== 'see_the_future') {
        this.wobbleCoach(lang === 'th' ? 'ในบทนี้ลองใช้การ์ด 🔮 "ดมกลิ่นอนาคต" ดูก่อนนะ!' : 'Try playing 🔮 "See the Future" first!');
        A.sfx('nope');
        this.wobbleEl(el);
        return false;
      }
      if (this.step === 3 && this.substep !== 'draw' && card.id !== 'shuffle') {
        this.wobbleCoach(lang === 'th' ? 'รีบใช้การ์ด 🔀 "สับกอง" เพื่อเปลี่ยนตำแหน่งระเบิดเร็วเข้า!' : 'Play 🔀 "Shuffle" to move the bomb away!');
        A.sfx('nope');
        this.wobbleEl(el);
        return false;
      }
      if (this.step === 4) {
        if (card.id === 'nope') {
          this.onNope();
          return false;
        }
        this.wobbleCoach(lang === 'th' ? 'บ็อบบี้กำลังใช้ Favor! แตะการ์ด 🛑 NOPE หรือปุ่มตรงกลางจอเพื่อสั่งห้าม!' : 'Tap NOPE card or the center button to cancel Bobby\'s favor!');
        A.sfx('nope');
        this.wobbleEl(el);
        return false;
      }
      if (this.step === 5 && card.id !== 'skip') {
        this.wobbleCoach(lang === 'th' ? 'ในบทนี้ลองใช้การ์ด ⏩ "ข้ามเทิร์น (Skip)" เพื่อหนีการจั่วดูนะ!' : 'Try playing ⏩ "Skip" to end your turn without drawing!');
        A.sfx('nope');
        this.wobbleEl(el);
        return false;
      }
      if (this.step === 6 && card.id !== 'tacocat') {
        this.wobbleCoach(lang === 'th' ? 'เลือกการ์ด 🌭 "หมาไส้กรอก" ทั้ง 2 ใบเพื่อเล่นคอมโบไพ่คู่ขโมยการ์ดนะ!' : 'Select both 🌭 "Hotdog Pup" cards to perform a pair steal combo!');
        A.sfx('nope');
        this.wobbleEl(el);
        return false;
      }
      if (this.step === 7 && card.id !== 'favor') {
        this.wobbleCoach(lang === 'th' ? 'ใช้การ์ด 🙏 "ขอร้อง (Favor)" เพื่อบีบให้บ็อบบี้มอบการ์ดให้นะ!' : 'Play 🙏 "Favor" to force Bobby to surrender a card!');
        A.sfx('nope');
        this.wobbleEl(el);
        return false;
      }
      if (this.step === 8 && card.id !== 'attack') {
        this.wobbleCoach(lang === 'th' ? 'ใช้การ์ด ⚡ "โจมตี (Attack)" เพื่อโยนระเบิดให้บ็อบบี้เล่น 2 เทิร์นรวด!' : 'Play ⚡ "Attack" to force Bobby to take 2 consecutive turns!');
        A.sfx('nope');
        this.wobbleEl(el);
        return false;
      }
      return true;
    },

    wobbleEl(el) {
      if (!el) return;
      el.style.animation = 'shake 0.4s ease';
      setTimeout(() => { if (el) el.style.animation = ''; }, 450);
    },

    wobbleCoach(alertMsg) {
      const sp = $('#tutSpeechText') || $('.ccb-guide');
      if (sp && alertMsg) {
        const orig = sp.innerHTML;
        sp.innerHTML = '<span style="color:#f87171;font-weight:bold;">' + esc(alertMsg) + '</span>';
        setTimeout(() => {
          if (sp && tutorialActive) sp.innerHTML = orig;
        }, 2800);
      }
      if (alertMsg) toast(alertMsg, 'warn');
      const coach = $('#tutorialCoachOverlay') || $('#tutCollapsedContainer');
      if (coach) {
        coach.style.animation = 'shake 0.4s ease';
        setTimeout(() => { if (coach) coach.style.animation = ''; }, 450);
      }
    },

    onDraw() {
      if (this.step === 1) {
        this.clearHighlights();
        A.sfx('draw');
        sel = [];
        const drawn = { uid: 'tut_stf_' + Date.now(), id: 'see_the_future' };
        S.me.hand.push(drawn);
        S.deckCount--;
        toast(lang === 'th' ? '🔮 คุณจั่วได้การ์ด "ดมกลิ่นอนาคต" (See the Future)!' : '🔮 Drew "See the Future"!', 'good');
        renderGame();
        this.setStep(2);
        return;
      }

      if (this.step === 3 && this.substep === 'draw') {
        this.clearHighlights();
        A.sfx('draw');
        sel = [];
        const drawn = { uid: 'tut_skip_' + Date.now(), id: 'skip' };
        S.me.hand.push(drawn);
        S.deckCount--;
        toast(lang === 'th' ? '⏩ คุณจั่วได้การ์ด "ข้ามเทิร์น" (Skip) อย่างปลอดภัย!' : '⏩ Drew "Skip" safely!', 'good');
        renderGame();
        this.setStep(4);
        this.runStep4BotTurn();
        return;
      }

      this.wobbleCoach(lang === 'th' ? '⚠️ เดี๋ยวก่อน! ในขั้นตอนนี้ยังไม่ต้องจั่วการ์ดนะ ลองทำตามคำแนะนำของครูฝึกก่อน!' : 'Hold on! Follow Coach Bobby\'s instructions for this step!');
      A.sfx('nope');
    },

    onPlay() {
      const uids = [...sel];
      const cards = (S?.me?.hand || []).filter(c => uids.includes(c.uid));
      if (!cards.length) return;

      // STEP 2: Play see_the_future
      if (this.step === 2) {
        if (cards.length !== 1 || cards[0].id !== 'see_the_future') {
          return this.wobbleCoach(lang === 'th' ? 'ในบทนี้ต้องลงการ์ด 🔮 "ดมกลิ่นอนาคต" นะ!' : 'Please play 🔮 "See the Future"!');
        }
        this.clearHighlights();
        sel = [];
        S.me.hand = S.me.hand.filter(c => c.uid !== cards[0].uid);
        S.discardTop = 'see_the_future';
        A.sfx('play');
        showCardSpotlight('see_the_future', 'see_the_future', myName());
        renderGame();
        this.showPeekModal();
        return;
      }

      // STEP 3: Play shuffle
      if (this.step === 3 && this.substep !== 'draw') {
        if (cards.length !== 1 || cards[0].id !== 'shuffle') {
          return this.wobbleCoach(lang === 'th' ? 'ในบทนี้ต้องลงการ์ด 🔀 "สับกอง" นะ!' : 'Please play 🔀 "Shuffle"!');
        }
        this.clearHighlights();
        sel = [];
        S.me.hand = S.me.hand.filter(c => c.uid !== cards[0].uid);
        S.discardTop = 'shuffle';
        A.sfx('shuffle');
        shakeDeck();
        showCardSpotlight('shuffle', 'shuffle', myName());
        renderGame();
        addTutTimer(() => {
          this.setStep(3, 'draw');
        }, 1000);
        return;
      }

      // STEP 5: Play skip
      if (this.step === 5) {
        if (cards.length !== 1 || cards[0].id !== 'skip') {
          return this.wobbleCoach(lang === 'th' ? 'ในบทนี้ต้องลงการ์ด ⏩ "ข้ามเทิร์น (Skip)" นะ!' : 'Please play ⏩ "Skip"!');
        }
        this.clearHighlights();
        sel = [];
        S.me.hand = S.me.hand.filter(c => c.uid !== cards[0].uid);
        S.discardTop = 'skip';
        A.sfx('play');
        showCardSpotlight('skip', 'skip', myName());
        toast(lang === 'th' ? '⏩ คุณข้ามเทิร์นสำเร็จ! รอดปลอดภัยโดยไม่ต้องจั่วการ์ด!' : '⏩ Turn skipped! Safely ended without drawing!', 'good');
        renderGame();
        addTutTimer(() => {
          this.runStep5BotTurn();
        }, 1200);
        return;
      }

      // STEP 6: Play 2x tacocat (Pair combo)
      if (this.step === 6) {
        if (cards.length !== 2 || !cards.every(c => c.id === 'tacocat')) {
          return this.wobbleCoach(lang === 'th' ? 'ในบทนี้ต้องเลือกการ์ด 🌭 "หมาไส้กรอก" ทั้ง 2 ใบนะ!' : 'Please select both 🌭 "Hotdog Pup" cards!');
        }
        this.clearHighlights();
        sel = [];
        const uidsToRemove = cards.map(c => c.uid);
        S.me.hand = S.me.hand.filter(c => !uidsToRemove.includes(c.uid));
        S.discardTop = 'tacocat';
        A.sfx('play');
        showCardSpotlight('tacocat', 'pair', myName(), lang === 'th' ? 'ครูฝึกบ็อบบี้' : 'Coach Bobby');
        renderGame();
        addTutTimer(() => {
          const stolen = { uid: 'tut_atk_' + Date.now(), id: 'attack' };
          S.me.hand.push(stolen);
          A.sfx('coin');
          toast(lang === 'th' ? '⚡ คอมโบไพ่คู่สำเร็จ! ขโมยการ์ด ⚡ Attack จากครูฝึกบ็อบบี้มาได้!' : '⚡ Pair Combo! Stole ⚡ Attack from Coach Bobby!', 'good');
          renderGame();
          addTutTimer(() => {
            // FIX: Give player the Favor card for Step 7!
            const fav = { uid: 'tut_fav_' + Date.now(), id: 'favor' };
            S.me.hand.push(fav);
            toast(lang === 'th' ? '🙏 ได้รับการ์ด "ขอร้อง (Favor)" จากครูฝึกบ็อบบี้!' : '🙏 Received "Favor" card from Coach Bobby!', 'good');
            renderGame();
            this.setStep(7);
          }, 1400);
        }, 1000);
        return;
      }

      // STEP 7: Play favor
      if (this.step === 7) {
        if (cards.length !== 1 || cards[0].id !== 'favor') {
          return this.wobbleCoach(lang === 'th' ? 'ในบทนี้ต้องลงการ์ด 🙏 "ขอร้อง (Favor)" นะ!' : 'Please play 🙏 "Favor"!');
        }
        this.clearHighlights();
        sel = [];
        S.me.hand = S.me.hand.filter(c => c.uid !== cards[0].uid);
        S.discardTop = 'favor';
        A.sfx('play');
        showCardSpotlight('favor', 'favor', myName(), lang === 'th' ? 'ครูฝึกบ็อบบี้' : 'Coach Bobby');
        renderGame();
        addTutTimer(() => {
          const defuseStolen = { uid: 'tut_def2_' + Date.now(), id: 'defuse' };
          S.me.hand.push(defuseStolen);
          A.sfx('coin');
          toast(lang === 'th' ? '🛠️ บ็อบบี้ถูกบังคับส่งการ์ด 🛠️ Defuse ให้คุณ!' : '🛠️ Bobby surrendered his Defuse card to you!', 'good');
          renderGame();
          addTutTimer(() => {
            this.setStep(8);
          }, 1400);
        }, 1000);
        return;
      }

      // STEP 8: Play attack
      if (this.step === 8) {
        if (cards.length !== 1 || cards[0].id !== 'attack') {
          return this.wobbleCoach(lang === 'th' ? 'ในบทนี้ต้องลงการ์ด ⚡ "โจมตี (Attack)" นะ!' : 'Please play ⚡ "Attack"!');
        }
        this.clearHighlights();
        sel = [];
        S.me.hand = S.me.hand.filter(c => c.uid !== cards[0].uid);
        S.discardTop = 'attack';
        A.sfx('attack');
        showCardSpotlight('attack', 'attack', myName(), lang === 'th' ? 'ครูฝึกบ็อบบี้' : 'Coach Bobby');
        toast(lang === 'th' ? '⚡ โจมตีสำเร็จ! บ็อบบี้โดนบังคับเล่น 2 เทิร์นรวด!' : '⚡ Attack successful! Bobby must take 2 turns!', 'good');
        renderGame();
        addTutTimer(() => {
          this.runStep8FinalShowdown();
        }, 1400);
        return;
      }
    },

    onNope() {
      if (this.step !== 4) return;
      this.clearHighlights();
      sel = [];
      const nopeCard = S.me.hand.find(c => c.id === 'nope');
      if (nopeCard) {
        S.me.hand = S.me.hand.filter(c => c.uid !== nopeCard.uid);
      }
      S.discardTop = 'nope';
      S.pending = null;
      A.sfx('nope');
      showNopeStamp('me_tut');
      toast(lang === 'th' ? '🛑 NOPE สำเร็จ! ปฏิเสธ Favor ของบ็อบบี้เรียบร้อย!' : '🛑 NOPE! Bobby\'s Favor cancelled!', 'good');
      renderGame();

      // Bot is now forced to draw to end its turn
      addTutTimer(() => {
        S.deckCount--;
        A.sfx('draw');
        toast(lang === 'th' ? 'ครูฝึกบ็อบบี้จั่วการ์ดจบเทิร์นอย่างปลอดภัย' : 'Coach Bobby drew safely to end his turn.');
        addTutTimer(() => {
          S.turnId = 'me_tut';
          renderGame();
          this.setStep(5);
        }, 1200);
      }, 1400);
    },

    showPeekModal() {
      const peekOverlay = document.createElement('div');
      peekOverlay.className = 'tut-peek-overlay';
      peekOverlay.id = 'tutPeekOverlay';
      peekOverlay.innerHTML = `
        <div class="tut-peek-box">
          <h3 style="color:#c084fc;font-size:1.4rem;margin:0 0 8px;">🔮 ${lang === 'th' ? 'ดมกลิ่นอนาคต: การ์ด 3 ใบบนสุด' : 'See the Future: Top 3 Cards'}</h3>
          <p style="color:#cbd5e1;font-size:0.95rem;margin:4px 0 16px;">
            ${lang === 'th' ? 'แอบส่องการ์ดที่จะถูกจั่วในลำดับถัดไปจากซ้ายไปขวา:' : 'Intel from the top of the draw deck:'}
          </p>
          <div class="tut-peek-cards">
            <div style="text-align:center;">
              <small style="color:#ef4444;font-weight:900;display:block;margin-bottom:4px;">1. ${lang === 'th' ? 'บนสุด (Danger!)' : 'Top (Danger!)'}</small>
              ${cardHTML('exploding_kitten', { cls: 'mini' })}
            </div>
            <div style="text-align:center;">
              <small style="color:#38bdf8;font-weight:800;display:block;margin-bottom:4px;">2. ${lang === 'th' ? 'ใบที่ 2' : '#2'}</small>
              ${cardHTML('shuffle', { cls: 'mini' })}
            </div>
            <div style="text-align:center;">
              <small style="color:#38bdf8;font-weight:800;display:block;margin-bottom:4px;">3. ${lang === 'th' ? 'ใบที่ 3' : '#3'}</small>
              ${cardHTML('skip', { cls: 'mini' })}
            </div>
          </div>
          <div style="background:rgba(239,68,68,0.2);border:1px dashed #ef4444;color:#fca5a5;padding:8px 14px;border-radius:10px;font-size:0.9rem;font-weight:bold;margin-bottom:16px;">
            🚨 ${lang === 'th' ? 'คำเตือนฉุกเฉิน! การ์ดใบถัดไปคือ หมาระเบิด 100%!' : 'EMERGENCY: The next card is an Exploding Dog!'}
          </div>
          <button class="btn gold big" id="btnTutPeekClose" style="padding:10px 28px;">
            ${lang === 'th' ? 'เข้าใจแล้ว / วางแผนรับมือ ➔' : 'Got it! / Prepare Countermeasure ➔'}
          </button>
        </div>
      `;
      document.body.appendChild(peekOverlay);

      const closePeek = () => {
        if (!peekOverlay.parentElement) return;
        peekOverlay.remove();
        // Give player shuffle card
        const shuf = { uid: 'tut_shuf_' + Date.now(), id: 'shuffle' };
        S.me.hand.push(shuf);
        toast(lang === 'th' ? '🔀 ได้รับการ์ด "สับกอง" (Shuffle) จากครูฝึกบ็อบบี้!' : '🔀 Received "Shuffle" from Coach Bobby!', 'good');
        renderGame();
        this.setStep(3);
      };

      $('#btnTutPeekClose').onclick = closePeek;
      addTutTimer(closePeek, 5000);
    },

    runStep4BotTurn() {
      S.turnId = 'bot_bobby';
      renderGame();

      addTutTimer(() => {
        if (!tutorialActive) return;
        // Bot plays favor
        S.discardTop = 'favor';
        A.sfx('play');
        showCardSpotlight('favor', 'favor', lang === 'th' ? 'ครูฝึกบ็อบบี้' : 'Coach Bobby', myName());
        S.pending = {
          playerId: 'bot_bobby',
          targetId: 'me_tut',
          effect: 'favor',
          cardIds: ['favor'],
          nopes: 0
        };

        // Give player Nope card
        const nope = { uid: 'tut_nope_' + Date.now(), id: 'nope' };
        S.me.hand.push(nope);
        renderGame();
        this.renderCoach();
      }, 1200);
    },

    runStep5BotTurn() {
      S.turnId = 'bot_bobby';
      renderGame();
      addTutTimer(() => {
        if (!tutorialActive) return;
        S.deckCount--;
        A.sfx('draw');
        toast(lang === 'th' ? 'ครูฝึกบ็อบบี้จั่วการ์ดจบเทิร์นอย่างปลอดภัย' : 'Coach Bobby drew safely to end his turn.');
        addTutTimer(() => {
          S.turnId = 'me_tut';
          // Give player second tacocat for pair combo
          const taco2 = { uid: 'tut_taco2_' + Date.now(), id: 'tacocat' };
          S.me.hand.push(taco2);
          renderGame();
          this.setStep(6);
        }, 1200);
      }, 1200);
    },

    runStep8FinalShowdown() {
      S.turnId = 'bot_bobby';
      S.turnsLeft = 2;
      renderGame();

      // Bot Turn 1:
      addTutTimer(() => {
        if (!tutorialActive) return;
        S.deckCount--;
        A.sfx('alarm');
        flash('rgba(239,68,68,0.7)', true);
        toast('🚨 BOMB DRAWN! ครูฝึกบ็อบบี้จั่วโดนหมาระเบิด!', 'err');
        renderGame();

        addTutTimer(() => {
          if (!tutorialActive) return;
          // Bot uses its last defuse
          A.sfx('defuse');
          showDefuseStamp('bot_bobby');
          toast('🛠️ ครูฝึกบ็อบบี้ใช้การ์ดกู้ระเบิดใบสุดท้าย และยัดระเบิดไว้บนสุดตามเดิม!', 'warn');
          S.deckCount++;
          renderGame();

          // Bot Turn 2:
          addTutTimer(() => {
            if (!tutorialActive) return;
            S.turnsLeft = 1;
            renderGame();
            toast('⚡ บ็อบบี้ยังไม่รอด! โดน Attack บังคับต้องจั่วอีก 1 ใบ!', 'warn');

            addTutTimer(() => {
              if (!tutorialActive) return;
              // Bot draws bomb again!
              S.deckCount--;
              flash('rgba(239,68,68,0.85)', true);
              A.sfx('alarm');
              toast('🚨 หมาระเบิดอีกรอบ! บ็อบบี้ไม่มี Defuse เหลือแล้ว!', 'err');
              renderGame();

              addTutTimer(() => {
                if (!tutorialActive) return;
                // BOOM!
                A.stopHeartbeat();
                A.sfx('boom');
                flash('rgba(255,80,0,0.95)', true);
                const bot = S.players.find(p => p.id === 'bot_bobby');
                if (bot) { bot.alive = false; bot.elimReason = 'exploded'; }
                S.state = 'ENDED';
                renderGame();

                addTutTimer(() => {
                  this.showVictoryModal();
                }, 1600);
              }, 1800);
            }, 1800);
          }, 2400);
        }, 2200);
      }, 1500);
    },

    showVictoryModal() {
      confetti();
      A.sfx('win');
      localStorage.setItem('ek_tutorial_completed', 'true');

      // Award rewards
      if (token) {
        api('/api/tutorial/complete', {}).then(res => {
          if (res.user) setUser(res.user, res.vault);
        }).catch(console.error);
      } else {
        const c = parseInt(localStorage.getItem('ek_guest_coins') || '100') + 200;
        const d = parseInt(localStorage.getItem('ek_guest_diamonds') || '20') + 15;
        localStorage.setItem('ek_guest_coins', c.toString());
        localStorage.setItem('ek_guest_diamonds', d.toString());
        const inv = JSON.parse(localStorage.getItem('ek_guest_inventory') || '[]');
        if (!inv.includes('title_trained_pup')) inv.push('title_trained_pup');
        localStorage.setItem('ek_guest_inventory', JSON.stringify(inv));
        localStorage.setItem('ek_guest_title', 'title_trained_pup');
        renderUserChip();
      }

      const isTh = lang === 'th';
      const modalHTML = `
        <div class="tutorial-victory-modal">
          <div class="tut-victory-crown">🎓🏆✨</div>
          <h2 style="color:#34d399;font-size:1.8rem;margin:0 0 6px;">
            ${isTh ? '🎓 บัณฑิตจบการฝึกสอนหมาป่วน!' : '🎓 Puppy Academy Graduate!'}
          </h2>
          <p class="tut-victory-sub" style="color:#cbd5e1;font-size:1.05rem;max-width:540px;margin:8px auto 18px;line-height:1.5;">
            ${isTh
              ? 'ยินดีด้วย! คุณผ่านหลักสูตรฝึกสอน 1v1 ครบทุกกระบวนท่า ได้เรียนรู้วิธีการจั่วการ์ด, ดูอนาคต, สับกอง, Nope, ข้ามเทิร์น, คอมโบไพ่คู่ และการใช้ Attack พิชิตคู่แข่งแล้ว!'
              : 'Congratulations! You mastered all cards and tactics: peeking future, shuffles, Nope counter, skip, pair steal combos, and the deadly attack finisher!'}
          </p>
          <div class="tut-rewards-box">
            <div class="tut-reward-item">
              <span class="rw-icon">🪙</span>
              <b class="rw-val">+200</b>
              <small class="rw-lbl">${isTh ? 'เหรียญทอง' : 'Coins'}</small>
            </div>
            <div class="tut-reward-item">
              <span class="rw-icon">💎</span>
              <b class="rw-val">+15</b>
              <small class="rw-lbl">${isTh ? 'เพชรล้ำค่า' : 'Diamonds'}</small>
            </div>
            <div class="tut-reward-item highlight-title">
              <span class="rw-icon">🎓</span>
              <b class="rw-val" style="font-size:1rem;color:#c084fc;">เด็กเนิร์ดตำราหมา</b>
              <small class="rw-lbl">${isTh ? 'ฉายาพิเศษ (RARE)' : 'Special Title'}</small>
            </div>
          </div>
          <div class="tut-victory-btns" style="display:flex;flex-direction:column;gap:10px;margin-top:20px;">
            <button class="btn big gold pulse" id="btnTutVictoryLobby" style="font-size:1.15rem;padding:14px;border-radius:16px;">
              🏠 ${isTh ? 'กลับสู่ล็อบบี้หลัก (GO TO LOBBY)' : 'GO TO LOBBY'}
            </button>
            <button class="btn" id="btnTutVictoryQuickPlay" style="background:rgba(255,255,255,0.08);color:#cbd5e1;padding:10px;border-radius:14px;">
              ⚔️ ${isTh ? 'เริ่มแมตช์จริง 1v1 กับบอท (1v1 BOT DUEL)' : 'PRACTICE 1v1 BOT DUEL'}
            </button>
          </div>
        </div>
      `;

      openModal(modalHTML, { locked: true, cls: 'medium' });

      $('#btnTutVictoryLobby').onclick = () => {
        closeModal(true);
        exitTutorialGame();
      };

      $('#btnTutVictoryQuickPlay').onclick = () => {
        closeModal(true);
        exitTutorialGame();
        setTimeout(() => {
          toast(lang === 'th' ? '🎮 กำลังเข้าสู่แมตช์ 1v1...' : 'Entering 1v1 match...', 'good');
          socket.emit('quickSolo', { name: myName(), avatar: myAvatar(), frame: myFrame(), skin: mySkin(), title: myTitle(), bots: 1, settings: { version: homeVersion || 'original' } });
        }, 300);
      };
    },

    renderCoach() {
      let overlay = $('#tutorialCoachOverlay');
      if (!overlay) return;
      overlay.classList.remove('hidden');

      const isTh = lang === 'th';
      let title = '';
      let text = '';
      let guide = '';

      this.clearHighlights();

      switch (this.step) {
        case 1:
          title = isTh ? 'บทที่ 1/8: การจั่วการ์ดจบเทิร์น' : 'Lesson 1/8: Draw to End Turn';
          text = isTh
            ? 'ยินดีต้อนรับสู่สนามฝึกหมาระเบิด! 🎓 <b>กฎเหล็กข้อสำคัญที่สุด:</b> ในแต่ละเทิร์น คุณต้อง <b>"จั่วการ์ด 1 ใบจากกอง"</b> เพื่อจบเทิร์น แต่ถ้าเผลอจั่วได้หมาระเบิด คุณจะแพ้ทันที!'
            : 'Welcome to Exploding Dog 1v1 Training! 🎓 <b>The Golden Rule:</b> On each turn, you must <b>"Draw a Card"</b> to end your turn. But if you draw a bomb without Defuse, you lose immediately!';
          guide = isTh ? '👉 แตะที่ <b>กองการ์ด (DRAW PILE)</b> ด้านบนเพื่อจั่วการ์ดใบแรก...' : '👉 Tap the <b>DRAW PILE</b> above to draw your first card...';
          $('#deckPile')?.classList.add('tutorial-highlight-target');
          break;

        case 2:
          title = isTh ? 'บทที่ 2/8: ดมกลิ่นอนาคต' : 'Lesson 2/8: See the Future';
          text = isTh
            ? 'ยอดเยี่ยม! คุณได้การ์ด <b>🔮 ดมกลิ่นอนาคต (See the Future)</b> การ์ดนี้จะแอบส่องการ์ด 3 ใบบนสุดของกอง ทำให้คุณรู้ล่วงหน้าว่ามีระเบิดซุ่มรออยู่หรือไม่!'
            : 'Awesome! You drew <b>🔮 See the Future</b>! This lets you peek at the top 3 cards so you can see if a bomb is waiting!';
          guide = isTh ? '👉 แตะเลือกการ์ด <b>See the Future</b> ในมือ แล้วกดปุ่ม <b>🚀 ลงไพ่</b>' : '👉 Select <b>See the Future</b> in your hand, then tap <b>🚀 Play Card</b>';
          this.highlightCardInHand('see_the_future');
          break;

        case 3:
          if (this.substep === 'draw') {
            title = isTh ? 'บทที่ 3/8: จั่วการ์ดหลังสับกอง' : 'Lesson 3/8: Safe Draw After Shuffle';
            text = isTh
              ? 'การ์ดทั้งกองถูกสับเปลี่ยนตำแหน่งเรียบร้อยแล้ว! ตอนนี้ระเบิดย้ายตำแหน่งไปแล้ว จั่วการ์ดจบเทิร์นได้อย่างปลอดภัย!'
              : 'Deck reshuffled successfully! The bomb moved away from the top. Tap the deck to draw safely!';
            guide = isTh ? '👉 แตะที่ <b>กองการ์ด (DRAW PILE)</b> เพื่อจั่วการ์ดจบเทิร์น...' : '👉 Tap the <b>DRAW PILE</b> to end your turn safely...';
            $('#deckPile')?.classList.add('tutorial-highlight-target');
          } else {
            title = isTh ? 'บทที่ 3/8: สับกองหนีระเบิด' : 'Lesson 3/8: Shuffle Away Danger';
            text = isTh
              ? '🚨 อันตรายมาก! ใบถัดไปคือหมาระเบิดตูมตามแน่ๆ! ครูฝึกมอบการ์ด <b>🔀 สับกอง (Shuffle)</b> ให้คุณ 1 ใบ รีบใช้สับกองเพื่อเปลี่ยนชะตากรรมด่วน!'
              : '🚨 Danger! An Exploding Dog was on top! Coach Bobby gave you a <b>🔀 Shuffle</b> card. Play it to scramble the deck immediately!';
            guide = isTh ? '👉 เลือกการ์ด <b>Shuffle</b> ในมือ แล้วกดปุ่ม <b>🚀 ลงไพ่</b>' : '👉 Select <b>Shuffle</b> in your hand and tap <b>🚀 Play Card</b>';
            this.highlightCardInHand('shuffle');
          }
          break;

        case 4:
          title = isTh ? 'บทที่ 4/8: ขัดจังหวะด้วย NOPE' : 'Lesson 4/8: Counter with NOPE';
          text = isTh
            ? '🚨 ระวัง! บ็อบบี้กำลังใช้การ์ด <b>🙏 Favor (ขอร้อง)</b> เพื่อบังคับขโมยการ์ดในมือคุณ! อย่ายอมแพ้! นี่คือการ์ด <b>🛑 NOPE</b> ใช้สกัดกั้นทันที!'
            : '🚨 Warning! Bobby played <b>🙏 Favor</b> to take a card from your hand! Don\'t let him! Here is a <b>🛑 NOPE</b> card to block him!';
          guide = isTh ? '👉 แตะการ์ด <b>🛑 NOPE</b> ในมือ หรือปุ่มสีแดงตรงกลางจอเพื่อสั่งห้าม!' : '👉 Tap <b>🛑 NOPE</b> card in your hand or the center button to counter!';
          this.highlightCardInHand('nope');
          $('#btnNope')?.classList.add('tutorial-highlight-target', 'pulse-card-guide');
          break;

        case 5:
          title = isTh ? 'บทที่ 5/8: ข้ามเทิร์นชิ่งหนี' : 'Lesson 5/8: Skip Turn Escape';
          text = isTh
            ? 'ตาคุณแล้ว! ในสถานการณ์ที่คุณไม่ต้องการเสี่ยงจั่วการ์ด คุณสามารถใช้การ์ด <b>⏩ ข้ามเทิร์น (Skip)</b> เพื่อจบเทิร์นทันทีโดย <b>ไม่ต้องจั่วการ์ดจากกอง</b>!'
            : 'Your turn! When you don\'t want to risk drawing, play <b>⏩ Skip</b> to end your turn immediately <b>without drawing any card</b>!';
          guide = isTh ? '👉 เลือกการ์ด <b>Skip</b> ในมือ แล้วกดปุ่ม <b>🚀 ลงไพ่</b>' : '👉 Select <b>Skip</b> in hand and tap <b>🚀 Play Card</b>';
          this.highlightCardInHand('skip');
          break;

        case 6:
          title = isTh ? 'บทที่ 6/8: คอมโบการ์ดแก๊งหมาคู่' : 'Lesson 6/8: Pair Dog Squad Combo';
          text = isTh
            ? 'รู้หรือไม่? การ์ดแก๊งหมาสามารถจับคู่ 2 ใบเหมือนกัน (Pair) เพื่อ <b>ขโมยการ์ด 1 ใบจากมือคู่แข่ง</b> ได้! ครูฝึกมอบการ์ด หมาไส้กรอก ให้คุณอีก 1 ใบ ลองจับคู่ขโมยการ์ดบ็อบบี้เลย!'
            : 'Did you know? Matching 2 identical dog cards (Pair Combo) lets you <b>steal a card from your opponent</b>! Coach Bobby gave you a 2nd Hotdog Pup. Select both to steal from Bobby!';
          guide = isTh ? '👉 เลือกการ์ด <b>หมาไส้กรอก ทั้ง 2 ใบ</b> ในมือ แล้วกด <b>🚀 ลงไพ่คู่</b>' : '👉 Select <b>both Hotdog Pups</b> in hand and tap <b>🚀 Play Pair Combo</b>';
          this.highlightCardInHand('tacocat', true);
          break;

        case 7:
          title = isTh ? 'บทที่ 7/8: บังคับส่งการ์ดด้วย Favor' : 'Lesson 7/8: Force Card with Favor';
          text = isTh
            ? 'คราวนี้ถึงตาคุณใช้การ์ด <b>🙏 ขอร้อง (Favor)</b> บ้าง! การ์ดนี้จะบังคับให้คู่ต่อสู้ต้องส่งการ์ดในมือมาให้คุณ 1 ใบ! ครูฝึกเตรียมการ์ด Favor ให้คุณแล้ว ลองใช้เลย!'
            : 'Now it\'s your turn to play <b>🙏 Favor</b>! This forces your rival to hand over a card to you! Play Favor on Bobby now!';
          guide = isTh ? '👉 เลือกการ์ด <b>Favor</b> ในมือ แล้วกดปุ่ม <b>🚀 ลงไพ่</b>' : '👉 Select <b>Favor</b> in hand and tap <b>🚀 Play Card</b>';
          this.highlightCardInHand('favor');
          break;

        case 8:
          title = isTh ? 'บทที่ 8/8: เผด็จศึกด้วย Attack' : 'Lesson 8/8: Strike with Attack';
          text = isTh
            ? '💣 หมาระเบิดอยู่ที่บนสุดของกองจั่วแล้ว! โอกาสเผด็จศึกมาถึงแล้ว! ใช้การ์ด <b>⚡ โจมตี (Attack)</b> เพื่อจบเทิร์นคุณทันที และ <b>โยนเคราะห์ให้บ็อบบี้ต้องเล่น 2 เทิร์นรวด</b>!'
            : '💣 The Exploding Dog is right on top! Play <b>⚡ Attack</b> to immediately end your turn and <b>force Bobby to take 2 consecutive turns</b>! Close the game!';
          guide = isTh ? '👉 เลือกการ์ด <b>Attack</b> ในมือ แล้วกดปุ่ม <b>🚀 ลงไพ่</b>' : '👉 Select <b>Attack</b> in hand and tap <b>🚀 Play Card</b>';
          this.highlightCardInHand('attack');
          break;
      }

      overlay.classList.toggle('collapsed', !!this.collapsed);

      if (this.collapsed) {
        overlay.innerHTML = `
          <div class="coach-container collapsed" id="tutCollapsedContainer" title="${isTh ? 'คลิกเพื่อขยายคำแนะนำ' : 'Click to expand guide'}">
            <div class="coach-collapsed-bar">
              <div class="ccb-left">
                <span class="ccb-avatar">🎓🐶</span>
                <span class="ccb-step">${title}</span>
                <span class="ccb-sep">•</span>
                <span class="ccb-guide">${guide.replace(/👉\s*/, '')}</span>
              </div>
              <div class="ccb-right">
                <button type="button" class="tut-toggle-btn" id="btnTutExpand" title="${isTh ? 'ขยายคำแนะนำ' : 'Expand Guide'}">
                  🔽 ${isTh ? 'ขยายคำแนะนำ' : 'Expand'}
                </button>
                <button type="button" class="tut-exit-icon-btn" id="btnTutExitCompact" title="${isTh ? 'ออกจากการฝึก' : 'Exit Training'}">🚪</button>
              </div>
            </div>
          </div>
        `;

        const expandBtn = $('#btnTutExpand');
        if (expandBtn) expandBtn.onclick = (e) => { e.stopPropagation(); this.toggleCollapse(); };
        const bar = $('#tutCollapsedContainer');
        if (bar) bar.onclick = () => this.toggleCollapse();
        const exitCompact = $('#btnTutExitCompact');
        if (exitCompact) exitCompact.onclick = (e) => { e.stopPropagation(); this.promptExit(); };
        return;
      }

      overlay.innerHTML = `
        <div class="coach-container">
          <div class="coach-avatar-wrap">
            <div class="coach-avatar">🎓🐶</div>
            <div class="coach-badge">COACH BOBBY</div>
          </div>
          <div class="coach-bubble">
            <div class="coach-bubble-header">
              <span class="coach-step-indicator" id="tutStepIndicator">${title}</span>
              <div class="coach-header-btns">
                <button type="button" class="tut-toggle-btn" id="btnTutCollapse" title="${isTh ? 'พับหน้าต่างคำแนะนำเพื่อมองเห็นกระดาน' : 'Collapse guide'}">
                  🔼 ${isTh ? 'พับหน้าต่าง' : 'Collapse'}
                </button>
                <button class="tutorial-exit-btn" id="btnTutExit" title="${isTh ? 'ออกจากการฝึก' : 'Exit Training'}">
                  🚪 ${isTh ? 'ออก' : 'Exit'}
                </button>
              </div>
            </div>
            <div class="coach-speech-text" id="tutSpeechText">${text}</div>
            <div class="coach-action-guide" id="tutActionGuide">${guide}</div>
          </div>
        </div>
      `;

      const collapseBtn = $('#btnTutCollapse');
      if (collapseBtn) collapseBtn.onclick = () => this.toggleCollapse();
      const exitBtn = $('#btnTutExit');
      if (exitBtn) exitBtn.onclick = () => this.promptExit();
    },

    highlightCardInHand(cardId, allMatches = false) {
      const cards = $$('#hand .card');
      if (!cards || !cards.length) return;
      let found = false;
      cards.forEach(c => {
        if (c.dataset.id === cardId && (!found || allMatches)) {
          c.classList.add('tutorial-highlight-target', 'pulse-card-guide');
          try {
            c.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          } catch (e) {}
          found = true;
        }
      });
      $('#btnPlayAction')?.classList.add('pulse-card-guide');
    }
  };

  function startTutorialGame() {
    clearTutTimers();
    tutorialActive = true;

    const myId = 'me_tut';
    const botId = 'bot_bobby';
    const pName = myName();
    const pAvatar = myAvatar();
    const pFrame = myFrame();
    const pSkin = mySkin();
    const pTitle = myTitle();

    S = {
      code: 'TUTORIAL',
      state: 'PLAYING',
      phase: 'turn',
      direction: 1,
      deckCount: 16,
      bombsLeft: 1,
      discardTop: null,
      faceUp: [],
      turnsLeft: 1,
      turnId: myId,
      turnDeadline: Date.now() + 99999999,
      log: [
        { t: 'game_start' },
        { t: 'turn', pid: myId, name: pName }
      ],
      players: [
        {
          id: myId,
          name: pName,
          avatar: pAvatar,
          frame: pFrame,
          skin: pSkin,
          title: pTitle,
          alive: true,
          handCount: 3,
          isBot: false,
          rp: 100
        },
        {
          id: botId,
          name: lang === 'th' ? 'ครูฝึกบ็อบบี้' : 'Coach Bobby',
          avatar: 'av_shiba_sensei',
          frame: 'frame_gold',
          skin: '',
          title: 'title_trained_pup',
          alive: true,
          handCount: 3,
          isBot: true,
          rp: 999
        }
      ],
      me: {
        id: myId,
        name: pName,
        avatar: pAvatar,
        frame: pFrame,
        skin: pSkin,
        title: pTitle,
        alive: true,
        isHost: true,
        rp: 100,
        hand: [
          { uid: 'tut_defuse_1', id: 'defuse' },
          { uid: 'tut_taco_1', id: 'tacocat' },
          { uid: 'tut_rain_1', id: 'rainbow_cat' }
        ]
      },
      pending: null,
      prompt: null
    };

    sel = [];
    show('game');
    renderGame();
    tutorialEngine.setStep(1);
  }

  function exitTutorialGame() {
    clearTutTimers();
    tutorialActive = false;
    tutorialEngine.collapsed = false;
    const overlay = $('#tutorialCoachOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.classList.remove('collapsed');
    }
    const peek = $('#tutPeekOverlay');
    if (peek) peek.remove();
    tutorialEngine.clearHighlights();
    A.stopHeartbeat();
    A.stopFuse();
    document.body.classList.remove('emergency-alarm');
    S = null;
    show('home');
    renderHome();
    renderUserChip();
  }

  function showNewAccountTutorialPrompt(u) {
    const isTh = lang === 'th';
    const modalHTML = `
      <div class="tutorial-onboarding-modal">
        <div class="tut-onboarding-icon">🎓🐶</div>
        <h2 style="color:#fbbf24;font-size:1.6rem;margin:0 0 8px;">
          ${isTh ? 'ยินดีต้อนรับสู่หมาระเบิด!' : 'Welcome to Exploding Dog!'}
        </h2>
        <p class="tut-onboarding-text" style="color:#f1f5f9;font-size:1.05rem;line-height:1.5;max-width:520px;margin:10px auto 16px;">
          ${isTh
            ? '🎓 ยินดีต้อนรับสู่หมาระเบิด! คุณเป็นผู้เล่นใหม่ ต้องการเข้าสู่โหมดฝึกสอนเล่น 1v1 กับบอทเพื่อเรียนรู้วิธีเล่นและการ์ดทั้งหมดหรือไม่?'
            : '🎓 Welcome to Exploding Dog! You are a new player. Would you like to enter the 1v1 interactive tutorial with Coach Bobby to learn how to play and master all cards?'}
        </p>
        <div class="tut-reward-preview">
          <div class="tut-reward-title" style="color:#fbbf24;font-weight:800;font-size:0.95rem;">
            🎁 ${isTh ? 'ของรางวัลเมื่อสำเร็จหลักสูตร:' : 'Graduation Rewards:'}
          </div>
          <div class="tut-reward-chips">
            <span class="tut-reward-chip">🪙 +200 ${isTh ? 'เหรียญ' : 'Coins'}</span>
            <span class="tut-reward-chip">💎 +15 ${isTh ? 'เพชร' : 'Diamonds'}</span>
            <span class="tut-reward-chip">🎓 ${isTh ? 'ฉายา: เด็กเนิร์ดตำราหมา' : 'Title: Trained Pup'}</span>
          </div>
        </div>
        <div class="tut-onboarding-actions" style="display:flex;flex-direction:column;gap:10px;margin-top:20px;">
          <button class="btn big gold pulse" id="btnStartTutorialAction" style="font-size:1.15rem;padding:14px;border-radius:16px;">
            🎓 ${isTh ? 'เข้าสู่โหมดฝึกสอน (START TUTORIAL)' : 'START TUTORIAL (RECOMMENDED)'}
          </button>
          <button class="btn" id="btnSkipTutorialAction" style="background:rgba(255,255,255,0.08);color:#94a3b8;border-radius:14px;padding:10px;">
            🏠 ${isTh ? 'ข้ามไปยังล็อบบี้หลัก (SKIP TO LOBBY)' : 'SKIP TO LOBBY'}
          </button>
        </div>
      </div>
    `;

    openModal(modalHTML, { cls: 'medium' });

    $('#btnStartTutorialAction').onclick = () => {
      closeModal(true);
      startTutorialGame();
    };

    $('#btnSkipTutorialAction').onclick = () => {
      closeModal(true);
      show('home');
    };
  }

  window.onNewAccountCreated = (u) => showNewAccountTutorialPrompt(u);

  function openRules() {
    const vers = Object.entries(VERSIONS).map(([id, v]) => `<div class="ver-card"><h4>${v.icon} ${esc(v.name[lang])}</h4><p>${esc(v.desc[lang])}</p></div>`).join('');
    const all = Object.keys(CARDS).map(id => `<div class="gallery-item">${cardHTML(id)}<p><b>${esc(cname(id))}</b><br>${esc(cdesc(id))}</p></div>`).join('');
    openModal(`<h2>📖 ${t('howTo')}</h2><p>${t('howToText')}</p><h3>${t('versions')}</h3><div class="ver-grid">${vers}</div><h3>${t('allCards')}</h3><div class="gallery">${all}</div>`, { cls: 'wide' });
  }

  function openCardDetail(id) {
    openModal(`<div class="card-detail">${cardHTML(id, { cls: 'xl' })}<div><h2>${CARDS[id].icon} ${esc(cname(id))}</h2><p>${esc(cdesc(id))}</p></div></div>`);
  }

  // ------------------------------------------------------------ LOBBY
  
  function initLobbyTabs() {
    const tabBtns = $('.lobby-tab-btn');
    if (!tabBtns || !tabBtns.length) return;
    tabBtns.forEach(btn => {
      btn.onclick = () => {
        A.sfx('click');
        const target = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        $$('.lobby-grid .panel').forEach(p => {
          p.classList.toggle('active-mobile-panel', p.dataset.panel === target);
        });
      };
    });
  }

  function renderLobby() {
    const m = me(); const isHost = m && m.isHost;
    $('#lobbyCode').textContent = S.code;
    $('#lobbyCount').textContent = `(${S.players.length}/${S.settings.maxPlayers})`;
    if ($('#lobbyTabCount')) $('#lobbyTabCount').textContent = S.players.length;
    $('#lobbyPlayers').innerHTML = S.players.map(p => `
      <div class="lp ${p.ready ? 'ready' : ''} ${p.id === S.me.id ? 'me' : ''}">
        ${avatarHTML(p)}<div class="lp-name">${esc(p.name)} ${p.registered ? rankBadge(p.rp) : ''} ${titleBadgeHTML(p.title, lang)}
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
    const st = S.settings;
    const fullKey = JSON.stringify([st, isHost, lang]);
    if (fullKey === lastSettingsKey) return;

    const dis = isHost ? '' : 'disabled';
    const counts = st.custom ? st.counts : VERSIONS[st.version].counts;
    const opt = (vals, cur, fmt) => vals.map(v => `<option value="${v}" ${v == cur ? 'selected' : ''}>${fmt(v)}</option>`).join('');
    const cardList = st.custom ? CONFIGURABLE : Object.keys(counts);
    const totalCards = cardList.reduce((sum, id) => sum + (parseInt(counts[id], 10) || 0), 0);

    const structKey = JSON.stringify([st.version, !!st.custom, !!st.imploding, st.turnSeconds, st.nopeSeconds, st.botLevel, isHost, lang]);
    const gridEl = $('#lobbySettings .count-grid');

    // 1. IN-PLACE UPDATE: If already rendered with matching structure, only update card counts in-place!
    // This completely prevents DOM destruction, eliminates scroll-jumping, and keeps inputs active!
    if (gridEl && structKey === lastSettingsStructKey) {
      lastSettingsKey = fullKey;
      cardList.forEach(id => {
        const n = counts[id] || 0;
        const item = $(`[data-card-item="${id}"]`);
        if (item) {
          item.classList.toggle('off', n === 0);
          const inp = $(`[data-card-input="${id}"]`, item);
          if (inp && document.activeElement !== inp) inp.value = n;
          const txt = $('b.count-txt', item);
          if (txt) txt.textContent = `x${n}`;
        }
      });
      const badge = $('#deckTotalCards');
      if (badge) badge.textContent = `${totalCards} ${t('cardsUnit') || 'ใบ'}`;
      return;
    }

    // 2. STRUCTURAL RENDER: Save scroll positions before replacing HTML
    const lobbyEl = $('#screen-lobby');
    const savedLobbyScroll = lobbyEl ? lobbyEl.scrollTop : 0;
    const savedGridScroll = gridEl ? gridEl.scrollTop : 0;
    const savedWinScroll = window.scrollY;

    const curH = $('#lobbySettings')?.offsetHeight;
    if (curH > 0) $('#lobbySettings').style.minHeight = curH + 'px';

    const customToolbar = (st.custom && isHost) ? `
      <div class="deck-toolbar">
        <div class="deck-toolbar-actions">
          <button type="button" class="dt-btn" id="btnDeckReset" title="คืนค่าเป็นค่าตั้งต้นของเวอร์ชันนี้">🔄 ${t('resetPreset') || 'รีเซ็ต'}</button>
          <button type="button" class="dt-btn" id="btnDeckZero" title="ปรับการ์ดทั้งหมดเป็น 0 เพื่อเริ่มจัดเด็คใหม่">0️⃣ ${t('allZero') || 'เคลียร์ 0'}</button>
          <button type="button" class="dt-btn" id="btnDeckPlus1" title="เพิ่มการ์ดทุกใบอย่างละ 1">+1 ทุกใบ</button>
          <button type="button" class="dt-btn" id="btnDeckMinus1" title="ลดการ์ดทุกใบอย่างละ 1">-1 ทุกใบ</button>
        </div>
        <div class="deck-toolbar-info">
          <span class="deck-count-badge">🃏 ${t('totalDeckCards') || 'รวม'}: <b id="deckTotalCards">${totalCards} ${t('cardsUnit') || 'ใบ'}</b></span>
        </div>
      </div>` : (st.custom ? `
      <div class="deck-toolbar" style="justify-content:flex-end;">
        <span class="deck-count-badge">🃏 ${t('totalDeckCards') || 'รวม'}: <b id="deckTotalCards">${totalCards} ${t('cardsUnit') || 'ใบ'}</b></span>
      </div>` : '');

    $('#lobbySettings').innerHTML = `
      <div class="ver-grid small">${Object.entries(VERSIONS).map(([id, v]) => `<button class="ver-card ${id === st.version ? 'on' : ''}" data-v="${id}" ${dis}><h4>${v.icon} ${esc(v.name[lang])}</h4><p>${esc(v.desc[lang])}</p></button>`).join('')}</div>
      <div class="set-row"><label>⏱️ ${t('turnTimer')}</label><select data-s="turnSeconds" ${dis}>${opt([15, 20, 25, 30, 45, 60], st.turnSeconds || 25, v => v + ' ' + t('sec'))}</select></div>
      <div class="set-row"><label>🛑 ${t('nopeTime')}</label><select data-s="nopeSeconds" ${dis}>${opt([2, 3, 4, 5, 6, 8], st.nopeSeconds, v => v + ' ' + t('sec'))}</select></div>
      <div class="set-row"><label>🤖 ${t('botLevel')}</label><select data-s="botLevel" ${dis}>${opt(['easy', 'normal', 'hard'], st.botLevel, v => t(v))}</select></div>
      <div class="set-row"><label>🧩 ${t('customMode')}</label><input type="checkbox" data-s="custom" ${st.custom ? 'checked' : ''} ${dis}></div>
      ${st.custom ? `<div class="set-row"><label>🌀 ${t('imploding')}</label><input type="checkbox" data-s="imploding" ${(st.imploding ?? VERSIONS[st.version].imploding) ? 'checked' : ''} ${dis}></div>` : ''}
      <h4>🃏 ${t('cardsInGame')}</h4>
      ${customToolbar}
      <div class="count-grid">${cardList.map(id => {
        const n = counts[id] || 0;
        return `<div class="count-item ${n ? '' : 'off'}" data-card-item="${id}">${cardHTML(id, { cls: 'mini', attr: 'data-detail' })}
          ${st.custom && isHost ? `
            <div class="stepper">
              <button type="button" class="stepper-btn" data-dec="${id}" title="-1 (Shift: -5, กดค้างเพื่อลดเร็ว)">−</button>
              <input type="number" class="stepper-input" data-card-input="${id}" min="0" max="10" value="${n}" inputmode="numeric" />
              <button type="button" class="stepper-btn" data-inc="${id}" title="+1 (Shift: +5, กดค้างเพื่อเพิ่มเร็ว)">+</button>
            </div>` : `<b class="count-txt">x${n}</b>`}</div>`;
      }).join('')}</div>`;

    lastSettingsKey = fullKey;
    lastSettingsStructKey = structKey;

    // Restore scroll positions immediately
    const newGrid = $('#lobbySettings .count-grid');
    if (newGrid && savedGridScroll) newGrid.scrollTop = savedGridScroll;
    if (lobbyEl && savedLobbyScroll) lobbyEl.scrollTop = savedLobbyScroll;
    if (savedWinScroll) window.scrollTo(0, savedWinScroll);
    requestAnimationFrame(() => {
      if ($('#lobbySettings')) $('#lobbySettings').style.minHeight = '';
    });

    if (!isHost) { bindDetail($('#lobbySettings')); return; }

    $$('[data-v]').forEach(b => b.onclick = () => { A.sfx('select'); socket.emit('settings', { version: b.dataset.v }); });
    $$('[data-s]').forEach(el => el.onchange = () => socket.emit('settings', { [el.dataset.s]: el.type === 'checkbox' ? el.checked : (isNaN(el.value) ? el.value : +el.value) }));

    const updateAllInPlace = (newCounts) => {
      let tot = 0;
      cardList.forEach(id => {
        const n = newCounts[id] || 0;
        tot += n;
        const item = $(`[data-card-item="${id}"]`);
        if (item) {
          item.classList.toggle('off', n === 0);
          const inp = $(`[data-card-input="${id}"]`, item);
          if (inp) inp.value = n;
        }
      });
      const badge = $('#deckTotalCards');
      if (badge) badge.textContent = `${tot} ${t('cardsUnit') || 'ใบ'}`;
    };

    const step = (id, delta) => {
      const cur = parseInt(st.counts[id] || 0, 10);
      const next = Math.max(0, Math.min(10, cur + delta));
      if (cur === next) return;
      st.counts[id] = next;
      const item = $(`[data-card-item="${id}"]`);
      if (item) {
        item.classList.toggle('off', next === 0);
        const inp = $(`[data-card-input="${id}"]`, item);
        if (inp && document.activeElement !== inp) inp.value = next;
      }
      const badge = $('#deckTotalCards');
      if (badge) {
        const tot = Object.values(st.counts).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
        badge.textContent = `${tot} ${t('cardsUnit') || 'ใบ'}`;
      }
      socket.emit('settings', { counts: { [id]: next } });
    };

    const bindHold = (btn, isInc, id) => {
      let holdTimer = null;
      let holdInterval = null;
      let pid = null;
      const doStep = (e) => {
        const delta = (e && e.shiftKey ? 5 : 1) * (isInc ? 1 : -1);
        A.sfx('click');
        step(id, delta);
      };
      const stop = (e) => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
        if (pid !== null && btn.releasePointerCapture) {
          try { btn.releasePointerCapture(pid); } catch (_) {}
          pid = null;
        }
      };
      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        pid = e.pointerId;
        if (btn.setPointerCapture) {
          try { btn.setPointerCapture(pid); } catch (_) {}
        }
        doStep(e);
        holdTimer = setTimeout(() => {
          holdInterval = setInterval(() => doStep(e), 100);
        }, 260);
      });
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('pointercancel', stop);
    };

    $$('[data-inc]').forEach(b => bindHold(b, true, b.dataset.inc));
    $$('[data-dec]').forEach(b => bindHold(b, false, b.dataset.dec));

    $$('[data-card-input]').forEach(inp => {
      const id = inp.dataset.cardInput;
      const commit = () => {
        let val = parseInt(inp.value, 10);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(10, val));
        inp.value = val;
        if ((st.counts[id] || 0) !== val) {
          st.counts[id] = val;
          const item = inp.closest('.count-item');
          if (item) item.classList.toggle('off', val === 0);
          const badge = $('#deckTotalCards');
          if (badge) {
            const tot = Object.values(st.counts).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
            badge.textContent = `${tot} ${t('cardsUnit') || 'ใบ'}`;
          }
          socket.emit('settings', { counts: { [id]: val } });
        }
      };
      inp.onfocus = () => { try { inp.select(); } catch (_) {} };
      inp.onchange = commit;
      inp.onblur = commit;
      inp.onkeydown = (e) => {
        if (e.key === 'Enter') { inp.blur(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); step(id, 1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); step(id, -1); }
      };
      inp.onwheel = (e) => {
        e.preventDefault();
        step(id, e.deltaY < 0 ? 1 : -1);
      };
    });

    const bReset = $('#btnDeckReset');
    if (bReset) bReset.onclick = () => {
      A.sfx('select');
      const resetCounts = {};
      for (const cid of CONFIGURABLE) resetCounts[cid] = VERSIONS[st.version]?.counts[cid] || 0;
      st.counts = { ...resetCounts };
      updateAllInPlace(st.counts);
      socket.emit('settings', { counts: resetCounts });
      toast('🔄 ' + (t('resetPreset') || 'รีเซ็ตค่าเริ่มต้น'));
    };

    const bZero = $('#btnDeckZero');
    if (bZero) bZero.onclick = () => {
      A.sfx('click');
      const zeroCounts = {};
      for (const cid of CONFIGURABLE) zeroCounts[cid] = 0;
      st.counts = { ...zeroCounts };
      updateAllInPlace(st.counts);
      socket.emit('settings', { counts: zeroCounts });
      toast('0️⃣ ' + (t('allZero') || 'เคลียร์เป็น 0 ทุกใบ'));
    };

    const bPlus = $('#btnDeckPlus1');
    if (bPlus) bPlus.onclick = () => {
      A.sfx('click');
      const updated = {};
      for (const cid of CONFIGURABLE) updated[cid] = Math.min(10, (st.counts[cid] || 0) + 1);
      st.counts = { ...updated };
      updateAllInPlace(st.counts);
      socket.emit('settings', { counts: updated });
    };

    const bMinus = $('#btnDeckMinus1');
    if (bMinus) bMinus.onclick = () => {
      A.sfx('click');
      const updated = {};
      for (const cid of CONFIGURABLE) updated[cid] = Math.max(0, (st.counts[cid] || 0) - 1);
      st.counts = { ...updated };
      updateAllInPlace(st.counts);
      socket.emit('settings', { counts: updated });
    };

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
    const isSpectator = !!m.isSpectator;
    const others = isSpectator ? S.players : S.players.filter(p => p.id !== m.id);
    // seats around the table (only rebuild when seat state changes)
    const seatsKey = JSON.stringify([others, S.turnId, S.turnsLeft, S.pending?.targetId, S.prompt?.playerId, isSpectator, lang]);
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
          return `<i class="fan-card ${p.skin || ('skin_' + theme)}" ${p.skin ? `data-skin="${p.skin}"` : ''} style="--ang:${ang}deg;--ty:${ty}px"></i>`;
        }).join('');
        return `<div class="seat ${posCls} theme-${theme} ${isTurn ? 'turn' : ''} ${p.alive ? '' : 'dead'} ${targeted ? 'targeted' : ''}" data-id="${p.id}">
          <div class="seat-portrait ${p.frame || ''}">
            <span class="seat-tag">${THEME_TAG[theme]}</span>
            <div class="seat-dog ${p.frame || ''}">${renderAvatarSVG(p.avatar || '🐶', theme)}</div>
            <div class="seat-stars">⭐⭐⭐⭐⭐</div>
            <div class="seat-title-row">${titleBadgeHTML(p.title, lang)}</div>
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
    const myTurn = S.state === 'PLAYING' && S.turnId === m.id && m.alive && !isSpectator;
    const myTheme = themeForPlayer(m, 3);
    const curMyTitle = m.title || myTitle();
    const heroKey = JSON.stringify([m.id, m.name, m.avatar || myAvatar(), m.frame || myFrame(), m.skin || mySkin(), curMyTitle, m.rp, m.alive, isSpectator, myTurn, S.turnsLeft, user?.coins, lang]);
    if (heroKey !== lastHeroKey) {
      lastHeroKey = heroKey;
      const heroEl = $('#myHeroSeat');
      if (heroEl) {
        if (isSpectator) {
          heroEl.innerHTML = `<div class="my-hero spectator-hero">
            <div class="my-hero-ring">
              <div class="my-hero-dog" style="display:flex;align-items:center;justify-content:center;font-size:2.2rem;background:rgba(56,189,248,0.18);">👀</div>
            </div>
            <div class="my-hero-plate">
              <div class="mh-name">${lang === 'th' ? 'โหมดผู้ชม' : 'Spectator'}</div>
              <div class="mh-sub" style="color:#38bdf8;font-weight:bold;">${lang === 'th' ? 'กำลังรับชมการแข่งขัน' : 'Watching Match'}</div>
            </div>
          </div>`;
        } else if (!m.alive) {
          heroEl.innerHTML = `<div class="my-hero theme-${myTheme} dead">
            <div class="my-hero-ring ${m.frame || myFrame() || ''}">
              <div class="my-hero-dog">${renderAvatarSVG(m.avatar || myAvatar(), myTheme)}</div>
              <div class="dead-mark">${m.elimReason === 'imploded' ? '🌀' : '💥'}</div>
            </div>
            <div class="my-hero-stars">⭐⭐⭐⭐⭐</div>
            <div class="my-hero-plate">
              <div class="mh-title-row">${titleBadgeHTML(curMyTitle, lang)}</div>
              <div class="mh-name">${esc(m.name)}</div>
              <div class="my-dead-tag">💀 ${lang === 'th' ? 'คุณระเบิดแล้ว' : 'ELIMINATED'}</div>
            </div>
          </div>`;
        } else {
          heroEl.innerHTML = `<div class="my-hero theme-${myTheme} ${myTurn ? 'turn' : ''}">
            <div class="my-hero-ring ${m.frame || myFrame() || ''}">
              <div class="my-hero-dog">${renderAvatarSVG(m.avatar || myAvatar(), myTheme)}</div>
            </div>
            <div class="my-hero-stars">⭐⭐⭐⭐⭐</div>
            <div class="my-hero-plate">
              <div class="mh-title-row">${titleBadgeHTML(curMyTitle, lang)}</div>
              <div class="mh-name">${esc(m.name)}</div>
              <div class="mh-sub">🪙 ${user ? user.coins : 0} · ${rankBadge(m.rp)} ${m.rp || 0} RP</div>
            </div>
            ${myTurn ? `<div class="my-turn-ribbon ${S.turnsLeft > 1 ? 'combo-multi' : ''}">⟳ ${t('yourTurn')} ${S.turnsLeft > 1 ? `<b class="turn-multi-tag">🔥 x${S.turnsLeft} ${t('turnsLeft')}</b>` : ''} <span id="myTurnSec"></span></div>` : ''}
          </div>`;
        }
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
      c.className = 'card back ' + (m.skin || mySkin() || '');
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
    if (myTurn && S.phase === 'turn' && risk >= 25) {
      A.playHeartbeat(Math.round(60 + (risk - 25) * 1.2));
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
      const hasNope = canNopeNow();
      $('#btnNope').style.display = hasNope ? '' : 'none';
    } else pb.className = 'hidden';

    // keyed hand update (preserves DOM nodes, scroll position, and active drag)
    try {
      if (!draggingUid) syncHand(S.me?.hand || []);
    } catch (e) { console.error('syncHand error', e); }

    try {
      updateActionBar();
    } catch (e) { console.error('updateActionBar error', e); }

    // log
    const logBox = $('#logBox');
    if (logBox) logBox.innerHTML = S.log.slice().reverse().map(ev => `<div class="log-item">${esc(annText(ev) || '')}</div>`).join('');

    // prompt
    try {
      handlePrompt();
    } catch (e) { console.error('handlePrompt error', e); }

    if (S.state === 'ENDED' && S.results) {
      if ($('#modal').classList.contains('hidden')) {
        showResults(S.results, false);
      } else if (me()?.isHost && !$('#resLobby')) {
        showResults(S.results, false);
      }
    }
  }

  function updateActionBar() {
    if (!S || !S.me) return;
    const m = me(); if (!m) return;
    const tp = pl(S.turnId);
    const isSpectator = !!m.isSpectator;
    const myTurn = S.state === 'PLAYING' && S.phase === 'turn' && S.turnId === m.id && m.alive && !isSpectator;

    const badge = $('#turnBadge');
    if (badge) {
      if (S.state !== 'PLAYING') {
        badge.innerHTML = '';
        badge.className = '';
      } else if (S.phase === 'intro') {
        badge.innerHTML = `🎲 ${lang === 'th' ? 'กำลังสุ่มผู้เล่นคนแรก...' : 'Choosing first player...'}`;
        badge.className = '';
      } else if (myTurn) {
        badge.innerHTML = `⭐ ${t('yourTurn')} ${S.turnsLeft > 1 ? `<span class="badge-turns-alert">🔥 x${S.turnsLeft} ${t('turnsLeft')}</span>` : ''}`;
        badge.className = 'mine';
      } else if (tp) {
        badge.innerHTML = `${esc(tp.avatar)} ${t('turnOf')} <b>${esc(tp.name)}</b> ${S.turnsLeft > 1 ? `<span class="badge-turns-alert">🔥 x${S.turnsLeft}</span>` : ''}`;
        badge.className = '';
      } else {
        badge.innerHTML = `⏳ ${lang === 'th' ? 'รอตาผู้เล่นคนอื่น...' : 'Waiting for turn...'}`;
        badge.className = '';
      }
    }

    const handArea = $('#handArea');
    if (handArea) {
      handArea.classList.toggle('my-turn', myTurn);
      handArea.classList.toggle('is-spectator', isSpectator);
      handArea.classList.toggle('is-eliminated', !m.alive && !isSpectator);
    }
    const canAct = myTurn && S.phase === 'turn';
    const pv = playValidity();
    const canPlay = pv.ok && (canAct || pv.nope) && !isSpectator;

    const specEl = $('#spectate');
    if (specEl) {
      if (isSpectator) {
        specEl.className = '';
        specEl.innerHTML = `👀 <b>${lang === 'th' ? 'โหมดผู้ชม (กำลังดูเพื่อนเล่น)' : 'Spectator Mode (Watching Match)'}</b>`;
      } else {
        specEl.className = m.alive || S.state !== 'PLAYING' ? 'hidden' : '';
        specEl.textContent = t('spectating');
      }
    }

    const btnPlayAction = $('#btnPlayAction');
    if (btnPlayAction) {
      btnPlayAction.classList.toggle('hidden', !canPlay);
      if (tutorialActive && canPlay) btnPlayAction.classList.add('pulse-card-guide');
      btnPlayAction.onclick = () => doPlay();
    }

    const hh = $('#handHint');
    if (hh) {
      if (isSpectator) {
        hh.textContent = lang === 'th' ? '👀 คุณกำลังรับชมการแข่งขัน' : '👀 You are spectating this match';
      } else if (!m.alive) {
        hh.textContent = lang === 'th' ? '👻 คุณระเบิดแล้ว กำลังรับชมเพื่อนๆ เล่นอยู่' : '👻 You are eliminated. Spectating...';
      } else if (canPlay) {
        hh.textContent = lang === 'th' ? '🚀 กด "ลงไพ่" หรือปุ่มบัซเซอร์เพื่อเล่น' : '🚀 Tap "Play" or Buzzer to play';
      } else if (canAct) {
        hh.textContent = lang === 'th' ? '🐾 ตาคุณแล้ว! เลือกการ์ดหรือแตะกองเพื่อจั่ว' : '🐾 Your turn! Pick a card or tap deck to draw';
      } else {
        hh.textContent = lang === 'th' ? '⏳ รอตาผู้เล่นคนอื่น...' : '⏳ Waiting for other players...';
      }
    }

    const btnDetail = $('#btnCardDetail');
    if (btnDetail) {
      btnDetail.classList.toggle('hidden', sel.length !== 1);
    }

    // Draw pile glow indicator & dynamic label
    const dp = $('#deckPile');
    if (dp) {
      dp.classList.toggle('can-draw', canAct);
      const drawLbl = dp.querySelector('.draw-label');
      if (drawLbl) {
        drawLbl.textContent = canAct
          ? (lang === 'th' ? '🐾 แตะเพื่อจั่ว' : 'Tap to Draw')
          : (lang === 'th' ? '🎴 กองจั่ว' : 'DRAW PILE');
      }
    }

    // 3D Arcade Buzzer state
    const buz = $('#arcadeBuzzer'), bIcon = $('#buzzerIcon');
    if (buz && bIcon) {
      const hasNope = canNopeNow() && !isSpectator;
      if (hasNope) { buz.className = 'mode-nope'; bIcon.textContent = '🛑'; buz.title = 'Quick Nope (🛑)'; }
      else if (canPlay) { buz.className = 'mode-play'; bIcon.textContent = '⚡'; buz.title = `${t('play')} (${sel.length || 1})`; }
      else if (canAct) { buz.className = 'mode-draw'; bIcon.textContent = '🐾'; buz.title = t('draw'); }
      else { buz.className = 'mode-idle'; bIcon.textContent = '⚡'; buz.title = ''; }
    }
  }

  function syncHand(hand = []) {
    hand = hand || [];
    const box = $('#hand');
    if (!box) return;
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
        info.type = 'button';
        info.className = 'card-info'; info.textContent = 'ⓘ'; info.title = cname(c.id);
        info.onpointerdown = (e) => e.stopPropagation();
        info.onclick = (e) => { e.stopPropagation(); openCardDetail(c.id); };
        el.appendChild(info);
        // Note: card-type is purely informative label/badge, does not intercept clicks
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
      if (cs[0].id === 'nope') return { ok: canNopeNow(), nope: true };
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
    let startX = 0, startY = 0, mode = null;
    // Disable native contextmenu completely so long-press on mobile does NOT trigger card detail or browser menu
    el.oncontextmenu = (e) => { e.preventDefault(); };

    // 3D Perspective Light Sheen on mouse move (desktop mouse only)
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      el.addEventListener('mousemove', (e) => {
        if (el.classList.contains('dragging')) return;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--mx', `${((x / rect.width) * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${((y / rect.height) * 100).toFixed(1)}%`);
      });
      el.addEventListener('mouseleave', () => {
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
      });
    }

    el.onpointerdown = (e) => {
      if (e.button && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      mode = null;
    };

    el.onpointermove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Only enter drag mode if dragged deliberately UPWARDS toward the game table arena
      if (!mode) {
        if (dy < -25 && Math.abs(dy) > Math.abs(dx) * 1.25) {
          mode = 'lift';
          draggingUid = el.dataset.uid;
          el.classList.add('dragging');
          try { el.setPointerCapture(e.pointerId); } catch (_) {}
        } else {
          return;
        }
      }

      if (mode === 'lift') {
        const swipeThreshold = window.innerHeight < 540 ? -42 : -60;
        // Dampen horizontal movement so card lifts smoothly upward without wandering
        el.style.transform = `translate3d(${dx * 0.3}px, ${Math.min(10, dy)}px, 0) scale(1.08)`;
        el.classList.toggle('drop-ready', dy < swipeThreshold);
      }
    };

    const finish = (e) => {
      try { if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); } catch (_) {}
      const dy = e.clientY - startY;
      el.classList.remove('dragging', 'drop-ready');
      el.style.transform = '';
      const wasMode = mode;
      mode = null;
      draggingUid = null;
      const swipeThreshold = window.innerHeight < 540 ? -42 : -60;

      if (!wasMode) {
        // Clean tap / click: toggle selection instantly without erratic sliding
        const u = el.dataset.uid;
        if (tutorialActive && typeof tutorialEngine !== 'undefined' && !tutorialEngine.onCardSelect(u, el)) {
          return;
        }
        sel = sel.includes(u) ? sel.filter(x => x !== u) : [...sel, u];
        el.classList.toggle('sel', sel.includes(u));
        A.sfx('select');
        Haptics.tap();
        updateActionBar();
      } else if (wasMode === 'lift' && dy < swipeThreshold) {
        // Dragged up into play area: play card
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
      } else {
        // Cancelled drag, reset hand state cleanly
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
  const KIND_SORT_ORDER = { defense: 1, reaction: 2, action: 3, cat: 4, special: 5, bomb: 6 };
  function sortCardsInHand(hand) {
    return hand.sort((a, b) => {
      const ka = KIND_SORT_ORDER[CARDS[a.id]?.kind] ?? 99;
      const kb = KIND_SORT_ORDER[CARDS[b.id]?.kind] ?? 99;
      if (ka !== kb) return ka - kb;
      return (CARDS[a.id]?.name?.[lang] || a.id).localeCompare(CARDS[b.id]?.name?.[lang] || b.id);
    });
  }

  $('#btnSort').onclick = () => {
    A.sfx('shuffle');
    Haptics.tap();
    const h = $('#hand');
    if (h) {
      h.classList.add('shuffling');
      setTimeout(() => h.classList.remove('shuffling'), 300);
      h.scrollTo({ left: 0, behavior: 'smooth' });
    }
    if (S?.me?.hand && S.me.hand.length > 1) {
      sortCardsInHand(S.me.hand);
      syncHand(S.me.hand);
    }
    socket.emit('sortHand');
  };

  const btnShuffleHand = $('#btnShuffleHand');
  if (btnShuffleHand) {
    btnShuffleHand.onclick = () => {
      A.sfx('shuffle');
      Haptics.tap();
      const h = $('#hand');
      if (h) {
        h.classList.add('shuffling');
        setTimeout(() => h.classList.remove('shuffling'), 300);
      }
      if (S?.me?.hand && S.me.hand.length > 1) {
        // Fisher-Yates shuffle locally for instant zero-latency feedback
        for (let i = S.me.hand.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [S.me.hand[i], S.me.hand[j]] = [S.me.hand[j], S.me.hand[i]];
        }
        syncHand(S.me.hand);
      }
      socket.emit('shuffleHand');
    };
  }
  const btnCardDetail = $('#btnCardDetail');
  if (btnCardDetail) {
    btnCardDetail.onclick = () => {
      if (sel.length === 1 && S?.me?.hand) {
        const c = S.me.hand.find(x => x.uid === sel[0]);
        if (c) {
          A.sfx('click');
          openCardDetail(c.id);
        }
      }
    };
  }
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      window.scrollTo(0, 0);
      updateHandNav();
      if (S && S.me) syncHand(S.me.hand);
    }, 200);
  });
  window.addEventListener('resize', () => {
    updateHandNav();
  });

  function canNopeNow() {
    if (tutorialActive && typeof tutorialEngine !== 'undefined') return tutorialEngine.canNope();
    if (!S || !S.pending || S.phase !== 'nope') return false;
    const m = me();
    if (!m || !m.alive) return false;
    const hasNopeCard = S.me?.hand?.some(c => c.id === 'nope');
    if (!hasNopeCard) return false;
    const isCaster = S.pending.playerId === m.id;
    const nopes = S.pending.nopes || 0;
    if (isCaster && nopes % 2 === 0) return false;
    return true;
  }

  let drawActionLock = false;
  function canDrawNow() {
    if (tutorialActive && typeof tutorialEngine !== 'undefined') return tutorialEngine.canDraw();
    if (!S || !S.me || drawActionLock) return false;
    const m = me();
    return S.state === 'PLAYING' && S.turnId === m?.id && m?.alive && S.phase === 'turn';
  }

  function doDraw() {
    if (tutorialActive && typeof tutorialEngine !== 'undefined') return tutorialEngine.onDraw();
    if (!canDrawNow() || drawActionLock) return;
    drawActionLock = true;
    setTimeout(() => { drawActionLock = false; }, 2500);
    A.sfx('draw');
    sel = [];
    socket.emit('draw');
  }

  function doQuickNope() {
    if (tutorialActive && typeof tutorialEngine !== 'undefined') return tutorialEngine.onNope();
    if (!canNopeNow()) return;
    const c = S?.me?.hand?.find(x => x.id === 'nope');
    if (c) {
      socket.emit('play', { uids: [c.uid] });
      sel = sel.filter(u => u !== c.uid);
      A.sfx('play');
    }
  }

  function doPlay() {
    if (tutorialActive && typeof tutorialEngine !== 'undefined') return tutorialEngine.onPlay();
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
        toast(lang === 'th' ? `หมดเวลาเลือก! ระบบสุ่มเลือก ${esc(pickT.name)}` : `Time out! Auto-selected ${esc(pickT.name)}`, 'warn');
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

    // Clear any full-screen banner or action spotlight to let the prompt modal take center stage
    const b = $('#banner'); if (b) b.className = '';
    const sp = $('#actionSpotlight'); if (sp) { sp.className = ''; sp.innerHTML = ''; }
    spotlightActive = false;

    const d = pr.data; const respond = (payload) => { clearModalAuto(); socket.emit('respond', payload); closeModal(true); };
    const timer = modalTimerHTML(pr.deadline, lang === 'th' ? 'หมดเวลาจะดำเนินการให้อัตโนมัติ' : 'Auto-resolves on timeout');
    const slider = (title, size, cls) => {
      openModal(`<h2>${title}</h2>${timer}<div class="pos-pick"><div class="pos-labels"><span>⬆️ ${t('top')}</span><b id="posVal">1</b><span>${t('bottom')} ⬇️</span></div>
        <input type="range" id="posRange" min="0" max="${size}" value="0"><div class="deck-preview" id="deckPrev"></div>
        <div class="row"><button class="btn small" data-q="top">${t('top')}</button><button class="btn small" data-q="rand">🎲 ${t('random')}</button><button class="btn small" data-q="bottom">${t('bottom')}</button></div>
        <button class="btn big gold" id="posOk">${t('confirm')}</button></div>`, { locked: true, cls });
      const r = $('#posRange');
      const upd = (interactive) => {
        $('#posVal').textContent = `${t('position')} ${+r.value + 1} / ${size + 1}`;
        $('#deckPrev').innerHTML = Array.from({ length: Math.min(size + 1, 24) }, (_, i) => `<i class="${i === Math.min(+r.value, 23) ? 'here' : ''}"></i>`).join('');
        if (interactive) {
          A.sfx('tick');
          Haptics.tap();
        }
      };
      r.oninput = () => upd(true);
      upd(false);
      $$('[data-q]').forEach(b => b.onclick = () => {
        r.value = b.dataset.q === 'top' ? 0 : b.dataset.q === 'bottom' ? size : Math.floor(Math.random() * (size + 1));
        upd(true);
      });
      $('#posOk').onclick = () => {
        A.sfx('slam');
        respond({ pos: +r.value });
      };
    };
    switch (pr.type) {
      case 'insert_bomb': slider(d.faceUp ? '🌀 ' + t('insertImploding') : '💣 ' + t('insertBomb'), d.deckSize, 'bomb-modal'); break;
      case 'bury': slider('⛏️ ' + t('buryTitle'), d.deckSize); break;
      case 'favor_give': {
        const to = pl(d.toId);
        const hand = S.me?.hand || [];
        const hasOther = hand.some(c => c.id !== 'exploding_kitten');
        const toName = to ? to.name : (lang === 'th' ? 'เพื่อน' : 'Player');
        openModal(`<h2>🎁 ${t('giveCard')} ${esc(toName)}</h2>${timer}<div class="pick-grid">${hand.map(c => {
          const isBombCard = c.id === 'exploding_kitten' && hasOther;
          return cardHTML(c.id, {
            uid: c.uid,
            cls: isBombCard ? 'disabled-card' : '',
            attr: isBombCard ? 'data-disabled="true"' : 'data-g="true"'
          });
        }).join('')}</div>`, { locked: true, cls: 'wide' });
        $$('[data-g]').forEach(el => {
          const pickCard = (e) => {
            if (e) e.preventDefault();
            A.sfx('play');
            respond({ uid: el.dataset.uid });
          };
          el.onclick = pickCard;
          el.onpointerup = pickCard;
        });
        $$('[data-disabled]').forEach(el => {
          const warnBomb = (e) => {
            if (e) e.preventDefault();
            toast(lang === 'th' ? 'ห้ามส่งหมาระเบิดให้เพื่อนตามกฎ!' : 'Cannot give Exploding Puppy by rules!', 'err');
          };
          el.onclick = warnBomb;
          el.onpointerup = warnBomb;
        });
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
        $('#btnSeeFutureDone').onclick = () => { A.sfx('click'); respond({ done: true }); };
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
      case 'draw':
        A.sfx('draw');
        if (isMe) Haptics.draw();
        animateDraw(ev.playerId);
        break;
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
          Haptics.vibrate([200, 100, 200]);
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
        A.sfx('heavyNope');
        flash('rgba(239,68,68,.45)', true); prio = true;
        showNopeStamp(ev.pn);
        Haptics.nopeSlam();
        pushCombatTicker(`<span>🛑</span> <b>${esc(ev.pn)}</b> NOPE!`, 'nope');
        break;
      case 'cancelled': A.sfx('nope'); banner(`<h2>🛑 NOPE!</h2><p>${esc(text)}</p>`, 'nope', 1400); break;
      case 'bomb_drawn':
        A.sfx('alarm');
        A.startFuse();
        A.playHeartbeat(150);
        Haptics.bombPanic();
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
        A.stopFuse();
        A.stopHeartbeat();
        A.sfx('wireCut');
        setTimeout(() => A.sfx('squeakToy'), 250);
        Haptics.defused();
        document.body.classList.remove('emergency-alarm');
        showCardSpotlight('defuse', 'defuse', ev.pn);
        flyCards(['defuse'], esc(ev.pn)); flash('rgba(34,197,94,.35)');
        showDefuseStamp(ev.pn);
        pushCombatTicker(`<span>🔧</span> <b>${esc(ev.pn)}</b> DEFUSED!`, 'good');
        break;
      case 'eliminated':
        A.stopFuse();
        A.stopHeartbeat();
        document.body.classList.remove('emergency-alarm');
        Haptics.explosion();
        document.body.classList.add('shake-heavy');
        setTimeout(() => document.body.classList.remove('shake-heavy'), 600);
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
      case 'drawn':
        // Card is placed directly at the end of the hand, no center popup needed
        break;
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

    // If guest, award guest coins & diamonds locally with stake multiplier
    const stakeKey = S?.settings?.stake || 'casual';
    const stkConfig = (window.EK.STAKES && window.EK.STAKES[stakeKey]) || { mult: 1, bonusDiamonds: 0 };
    if (!user && mine) {
      const gWon = mine.place === 1;
      const baseCoins = (gWon ? 120 : 30) + (results.length - mine.place) * 15;
      const gCoins = Math.round(baseCoins * stkConfig.mult);
      const gDia = (gWon ? 3 : (mine.place === 2 ? 1 : 0)) + (gWon ? (stkConfig.bonusDiamonds || (stkConfig.diamonds ? stkConfig.diamonds * 2 : 0)) : 0);
      const gXp = gWon ? 50 : 20;
      const curC = parseInt(localStorage.getItem('ek_guest_coins') || '100');
      const curD = parseInt(localStorage.getItem('ek_guest_diamonds') || '20');
      const curXp = parseInt(localStorage.getItem('ek_guest_xp') || '0');
      localStorage.setItem('ek_guest_coins', curC + gCoins);
      localStorage.setItem('ek_guest_diamonds', curD + gDia);
      localStorage.setItem('ek_guest_xp', curXp + gXp);
      renderUserChip();
      mine.reward = { coins: gCoins, diamonds: gDia, xp: gXp, rp: gWon ? 25 : 5, stake: stakeKey };
    }

    const stakeBadgeHtml = stkConfig && stkConfig.mult > 1 ? `<div class="result-stake-ribbon">${stkConfig.icon} <b>${stkConfig.name[lang] || stkConfig.name.th}</b> <span class="rsr-mult">x${stkConfig.mult} REWARDS</span></div>` : '';
    openModal(`<h2>🏁 ${t('gameOver')}</h2>${stakeBadgeHtml}<div class="results">${results.map(r => {
      let rewText = '<span></span>';
      if (r.reward) {
        const parts = [`🪙 +${r.reward.coins}`];
        if (r.reward.diamonds) parts.push(`<b style="color:#38bdf8">💎 +${r.reward.diamonds}</b>`);
        if (r.reward.xp) parts.push(`<b style="color:#a855f7">⭐ +${r.reward.xp} XP</b>`);
        else if (r.reward.rp !== undefined) parts.push(`<b style="color:#a855f7">⭐ +${Math.max(15, r.reward.rp * 2)} XP</b>`);
        if (r.reward.rp !== undefined) parts.push(`${r.reward.rp >= 0 ? '+' : ''}${r.reward.rp} RP`);
        rewText = `<span class="reward">${parts.join(' · ')}</span>`;
      }
      return `
        <div class="res-row place${r.place} ${r.id === S?.me?.id ? 'me' : ''}">
          <b>${['🥇', '🥈', '🥉'][r.place - 1] || '#' + r.place}</b>
          ${avatarHTML(r, 'sm')}
          <span class="res-name-wrap">${esc(r.name)} ${titleBadgeHTML(r.title, lang)}</span>
          ${rewText}
        </div>`;
    }).join('')}</div>
      ${!user ? `<p class="note">${t('guestNote')}</p>` : ''}
      <div class="row">
        ${isHost 
          ? `<button class="btn big gold" id="resLobby">⚔️ ${lang === 'th' ? 'เริ่มตาใหม่ (REMATCH)' : 'PLAY AGAIN'}</button>` 
          : `<button class="btn big gold" id="resQuickPlay">⚡ ${lang === 'th' ? 'หาห้องใหม่ทันที' : 'QUICK MATCH'}</button>`
        }
        <button class="btn big" id="resHome">🏠 ${t('home')}</button>
      </div>`, { cls: 'results-modal' });
    if (fresh && mine && mine.reward) {
      A.sfx(mine.place === 1 ? 'win' : 'coin');
      if (mine.place === 1) confetti(true);
    }
    const l = $('#resLobby'); if (l) l.onclick = () => { closeModal(true); socket.emit('backToLobby'); };
    const qp = $('#resQuickPlay');
    if (qp) {
      qp.onclick = () => {
        closeModal(true);
        socket.emit('leaveRoom');
        setTimeout(() => {
          show('browser');
          renderStageBrowser();
        }, 150);
      };
    }
    const rh = $('#resHome');
    if (rh) {
      rh.onclick = () => {
        closeModal(true);
        socket.emit('leaveRoom');
        show('home');
        renderHome();
      };
    }
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
    const c = document.createElement('div'); c.className = 'card back flying-arc ' + (pl(pid)?.skin || '');
    c.style.left = a.left + 'px'; c.style.top = a.top + 'px';
    document.body.appendChild(c);
    const tx = b.left + b.width / 2 - a.left - 30;
    const ty = b.top + 20 - a.top;
    const rot = Math.min(25, Math.max(-25, tx * 0.08));
    requestAnimationFrame(() => {
      c.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(.65)`;
      c.style.opacity = '.25';
    });
    setTimeout(() => {
      c.remove();
      target.classList.add('seat-recoil');
      setTimeout(() => target.classList.remove('seat-recoil'), 450);
    }, 650);
  }
  function shakeDeck() { const d = $('#deckPile'); d.classList.remove('shuffling'); void d.offsetWidth; d.classList.add('shuffling'); }

  // ------------------------------------------------------------ timers loop (cached DOM & dirty-check)
  let _elArc = null, _elTxt = null, _elMySec = null, _elRing = null, _elBtnNope = null, _elNopeFill = null;
  let _lastDash = -99, _lastLabel = '', _lastMySecText = '', _lastNopePct = -99, _lastNopeSec = -99;
  let _lastPromptSec = -99, _lastSnoutSec = -99;

  function initTimerDom() {
    _elArc = $('#timerArc');
    _elTxt = $('#timerText');
    _elMySec = $('#myTurnSec');
    _elRing = $('#timerRing');
    _elBtnNope = $('#btnNope');
    _elNopeFill = $('#nopeFill');
  }

  function tickLoop() {
    if (S && S.state === 'PLAYING' && screen === 'game') {
      if (!_elArc) initTimerDom();
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
      const dash = dl ? Math.round(100 - (left / total) * 100) : (isPausedBySpotlight ? 0 : 100);
      if (_elArc && dash !== _lastDash) {
        _lastDash = dash;
        _elArc.style.strokeDashoffset = dash;
      }
      const secs = Math.ceil(left / 1000);
      const isActionPaused = (!isTurnPhase && (S.pending || S.prompt || S.phase !== 'turn')) || isPausedBySpotlight;
      const label = dl ? String(secs) : (isActionPaused ? '⏸️' : '∞');
      if (_elTxt && label !== _lastLabel) {
        _lastLabel = label;
        _elTxt.textContent = label;
      }
      if (_elMySec) {
        const mySecText = (isTurnPhase && dl && !isPausedBySpotlight)
          ? `(00:${String(secs).padStart(2, '0')})`
          : (isActionPaused ? `(⏸️)` : '');
        if (mySecText !== _lastMySecText) {
          _lastMySecText = mySecText;
          _elMySec.textContent = mySecText;
        }
      }
      if (_elRing) {
        _elRing.classList.toggle('urgent', isTurnPhase && !isPausedBySpotlight && !!dl && left < 5000);
      }
      const myTurn = S.turnId === S.me?.id && isTurnPhase && !isPausedBySpotlight;
      if (myTurn && dl && secs <= 5 && secs !== lastTick && secs > 0) {
        lastTick = secs;
        A.sfx('tick');
      }

      if (S.pending) {
        if (_elBtnNope) _elBtnNope.style.display = canNopeNow() ? '' : 'none';
        const showUntil = S.pending.showUntil || 0;
        const nowMs = now();
        if (nowMs < showUntil) {
          if (_elNopeFill && _lastNopePct !== 100) {
            _lastNopePct = 100;
            _elNopeFill.style.width = '100%';
          }
          if (_elBtnNope && _lastNopeSec !== -1) {
            _lastNopeSec = -1;
            _elBtnNope.textContent = `🛑 ${t('nope') || 'NOPE'}`;
            _elBtnNope.classList.remove('pulse-fast');
          }
        } else {
          const duration = Math.max(1000, (S.pending.deadline - showUntil) || (S.settings.nopeSeconds * 1000));
          const pLeft = Math.max(0, S.pending.deadline - nowMs);
          const pct = Math.round(Math.min(100, Math.max(0, (pLeft / duration) * 100)));
          if (_elNopeFill && pct !== _lastNopePct) {
            _lastNopePct = pct;
            _elNopeFill.style.width = pct + '%';
          }
          const pSec = Math.ceil(pLeft / 1000);
          if (_elBtnNope && pSec !== _lastNopeSec) {
            _lastNopeSec = pSec;
            _elBtnNope.textContent = `🛑 ${t('nope') || 'NOPE'} (${pSec}s)`;
            _elBtnNope.classList.toggle('pulse-fast', pSec <= 2);
          }
        }
      }

      // Check modal countdown only when a modal is open
      const modalEl = $('#modal');
      if (modalEl && !modalEl.classList.contains('hidden')) {
        const pWrap = $('#promptTimerWrap');
        if (pWrap && pWrap.dataset.deadline) {
          const pLeft = Math.max(0, +pWrap.dataset.deadline - now());
          const pSec = Math.ceil(pLeft / 1000);
          if (pSec !== _lastPromptSec) {
            _lastPromptSec = pSec;
            const pSecEl = $('#promptTimerSec');
            if (pSecEl) {
              pSecEl.textContent = pSec + 's';
              pSecEl.classList.toggle('urgent', pSec <= 5);
            }
          }
        }
        const sTimerEl = $('#snoutTimer');
        if (sTimerEl && sTimerEl.dataset.dl) {
          const sLeft = Math.max(0, +sTimerEl.dataset.dl - now());
          const sSec = Math.ceil(sLeft / 1000);
          if (sSec !== _lastSnoutSec) {
            _lastSnoutSec = sSec;
            sTimerEl.textContent = sSec + 's';
          }
        }
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
      if (canNopeNow()) return doQuickNope();
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
  // Initialize Auth Screen IMMEDIATELY so buttons and tabs are clickable from the first millisecond
  try { initAuthScreen(); } catch (err) { console.error('Early initAuthScreen error:', err); }

  (async () => {
    try {
      imgMap = await fetch('/api/card-images').then(r => r.json()).catch(() => ({}));
      if (imgMap.card_back) document.documentElement.style.setProperty('--back-img', `url(${imgMap.card_back})`);
    } catch (_) {}
    syncToggles();
    try { await loadMe(); } catch (err) { console.error('loadMe error:', err); }
    try { applyI18n(); } catch (err) { console.error('applyI18n error:', err); }
    try { initAuthScreen(); } catch (err) { console.error('initAuthScreen error:', err); }

    if (!user && !isGuestSessionActive) {
      show('auth');
    } else {
      show('home');
      renderHome();
    }

    const room = new URLSearchParams(location.search).get('room');
    if (room) {
      const code = room.trim().toUpperCase();
      const inp = $('#browserCodeInp') || $('#mbCode');
      if (inp) inp.value = code;
      const saved = sessionStorage.getItem('ek_room');
      if (!saved) {
        setTimeout(() => {
          socket.emit('joinRoom', { code, name: myName(), avatar: myAvatar(), frame: myFrame(), skin: mySkin(), title: myTitle() });
        }, 350);
      }
    }
  })();
})();
