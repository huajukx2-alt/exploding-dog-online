// Synth sound effects (WebAudio, no files) + speech announcer
window.Audio2 = (() => {
  let ctx = null;
  const opt = { sound: localStorage.getItem('ek_sound') !== '0', voice: localStorage.getItem('ek_voice') !== '0' };
  const ac = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; };

  function tone(freq, dur, type = 'sine', vol = 0.2, delay = 0, slideTo) {
    const c = ac(), t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.4, delay = 0, lp = 1200) {
    const c = ac(), t = c.currentTime + delay;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol;
    s.buffer = buf; s.connect(f).connect(g).connect(c.destination); s.start(t);
  }
  // Procedural Heartbeat Engine for high risk tension
  let heartbeatTimer = null;
  let currentHeartbeatBpm = 0;
  function playHeartbeat(bpm = 75) {
    if (!opt.sound) return;
    if (heartbeatTimer && Math.abs(currentHeartbeatBpm - bpm) < 4) return;
    stopHeartbeat();
    currentHeartbeatBpm = bpm;
    const interval = Math.max(300, (60 / Math.max(40, bpm)) * 1000);
    heartbeatTimer = setInterval(() => {
      try {
        const c = ac(), t = c.currentTime;
        // Thump 1 (Lub)
        const o1 = c.createOscillator(), g1 = c.createGain();
        o1.type = 'sine';
        o1.frequency.setValueAtTime(85, t);
        o1.frequency.exponentialRampToValueAtTime(32, t + 0.12);
        g1.gain.setValueAtTime(0.35, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o1.connect(g1).connect(c.destination);
        o1.start(t); o1.stop(t + 0.13);

        // Thump 2 (Dub)
        const t2 = t + 0.14;
        const o2 = c.createOscillator(), g2 = c.createGain();
        o2.type = 'sine';
        o2.frequency.setValueAtTime(75, t2);
        o2.frequency.exponentialRampToValueAtTime(28, t2 + 0.15);
        g2.gain.setValueAtTime(0.45, t2);
        g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.15);
        o2.connect(g2).connect(c.destination);
        o2.start(t2); o2.stop(t2 + 0.16);
      } catch (e) {}
    }, interval);
  }
  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    currentHeartbeatBpm = 0;
  }

  const SFX = {
    click: () => tone(660, 0.06, 'square', 0.06),
    select: () => tone(880, 0.07, 'triangle', 0.1),
    draw: () => { noise(0.18, 0.15, 0, 3000); tone(300, 0.15, 'sine', 0.08, 0, 600); },
    play: () => { tone(520, 0.08, 'triangle', 0.15); tone(780, 0.12, 'triangle', 0.15, 0.07); },
    nope: () => {
      const c = ac(), t = c.currentTime;
      noise(0.08, 0.45, 0, 4000); // Slap transient
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(340, t);
      o.frequency.exponentialRampToValueAtTime(75, t + 0.28);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + 0.3);
    },
    slam: () => {
      tone(140, 0.14, 'triangle', 0.45, 0, 45);
      noise(0.12, 0.35, 0, 1800);
    },
    boom: () => {
      const c = ac(), t = c.currentTime;
      tone(120, 0.1, 'triangle', 0.6, 0, 40); // Crack
      const sub = c.createOscillator(), subG = c.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(110, t);
      sub.frequency.exponentialRampToValueAtTime(24, t + 1.2);
      subG.gain.setValueAtTime(0.85, t);
      subG.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      sub.connect(subG).connect(c.destination);
      sub.start(t); sub.stop(t + 1.25);
      noise(1.5, 0.8, 0.02, 800); // Rumble
    },
    implode: () => { tone(900, 1.0, 'sine', 0.25, 0, 40); noise(0.8, 0.3, 0.3, 400); },
    alarm: () => { for (let i = 0; i < 4; i++) { tone(880, 0.12, 'square', 0.12, i * 0.25); tone(660, 0.12, 'square', 0.12, i * 0.25 + 0.12); } },
    defuse: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, i * 0.08)),
    turn: () => { tone(988, 0.12, 'sine', 0.18); tone(1319, 0.3, 'sine', 0.18, 0.12); },
    myturn: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'triangle', 0.18, i * 0.09)),
    tick: () => tone(1200, 0.04, 'square', 0.06),
    coin: () => { tone(988, 0.08, 'square', 0.1); tone(1319, 0.25, 'square', 0.1, 0.08); },
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, i * 0.15)),
    lose: () => [392, 370, 349, 330].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.1, i * 0.25)),
    shuffle: () => { for (let i = 0; i < 6; i++) noise(0.06, 0.15, i * 0.06, 4000); },
    attack: () => { noise(0.25, 0.3, 0, 2500); tone(200, 0.3, 'sawtooth', 0.15, 0, 800); },
    steal: () => { tone(700, 0.1, 'triangle', 0.12); tone(500, 0.15, 'triangle', 0.12, 0.1); },
    magic: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.2, 'sine', 0.08, i * 0.06)),
    roulette: () => tone(1400, 0.03, 'square', 0.05),
    sticker: () => tone(1500, 0.08, 'sine', 0.12, 0, 2200),
    bark: () => {
      tone(480, 0.12, 'sawtooth', 0.24, 0, 220);
      tone(520, 0.14, 'square', 0.18, 0.02, 200);
      noise(0.08, 0.2, 0, 2500);
    },
    attacked: () => {
      for (let i = 0; i < 3; i++) {
        tone(920, 0.14, 'sawtooth', 0.22, i * 0.18, 540);
        tone(1150, 0.14, 'square', 0.16, i * 0.18 + 0.08, 620);
      }
      noise(0.35, 0.35, 0, 1800);
    },
    cardLost: () => {
      tone(440, 0.15, 'sawtooth', 0.22, 0, 220);
      tone(330, 0.25, 'sawtooth', 0.25, 0.12, 160);
      noise(0.15, 0.18, 0, 800);
    },
    cardGain: () => {
      [659, 880, 1046, 1318].forEach((f, i) => tone(f, 0.18, 'triangle', 0.16, i * 0.07));
    },
    wireCut: () => {
      tone(2200, 0.04, 'highpass', 0.25);
      noise(0.06, 0.35, 0, 5000);
      setTimeout(() => tone(1760, 0.08, 'sine', 0.12), 40);
    },
    squeakToy: () => {
      const c = ac(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(800, t);
      o.frequency.exponentialRampToValueAtTime(1900, t + 0.09);
      o.frequency.exponentialRampToValueAtTime(1200, t + 0.18);
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + 0.21);
    },
    heavyNope: () => {
      tone(120, 0.22, 'triangle', 0.55, 0, 40);
      noise(0.18, 0.45, 0, 3200);
      tone(80, 0.35, 'sawtooth', 0.3, 0.02, 30);
    },
    tensionRiser: () => {
      const c = ac(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(720, t + 0.35);
      g.gain.setValueAtTime(0.02, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.32);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + 0.37);
    }
  };
  function sfx(name) { if (!opt.sound || !SFX[name]) return; try { SFX[name](); } catch (e) { /* audio blocked */ } }

  // ---- procedural burning fuse sizzle
  let fuseSource = null, fuseGain = null;
  function startFuse() {
    if (!opt.sound || fuseSource) return;
    try {
      const c = ac();
      const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.15;
      fuseSource = c.createBufferSource();
      fuseSource.buffer = buf;
      fuseSource.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 4200;
      filter.Q.value = 3.0;
      fuseGain = c.createGain();
      fuseGain.gain.setValueAtTime(0.01, c.currentTime);
      fuseGain.gain.linearRampToValueAtTime(0.28, c.currentTime + 0.3);
      fuseSource.connect(filter).connect(fuseGain).connect(c.destination);
      fuseSource.start();
    } catch (e) {}
  }
  function stopFuse() {
    if (fuseGain) {
      try {
        const c = ac();
        fuseGain.gain.linearRampToValueAtTime(0.001, c.currentTime + 0.15);
        setTimeout(() => { if (fuseSource) { fuseSource.stop(); fuseSource = null; } fuseGain = null; }, 160);
      } catch (e) { fuseSource = null; fuseGain = null; }
    }
  }

  // ---- procedural ambient suspense bgm
  let bgmTimer = null, bgmStep = 0;
  function startBGM() {
    if (!opt.sound || bgmTimer) return;
    const notes = [55, 55, 65.4, 55, 73.4, 65.4, 55, 49];
    bgmTimer = setInterval(() => {
      try {
        const c = ac(), t = c.currentTime;
        const freq = notes[bgmStep % notes.length];
        const osc = c.createOscillator(), g = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.035, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(g).connect(c.destination);
        osc.start(t); osc.stop(t + 0.38);
        bgmStep++;
      } catch (e) {}
    }, 480);
  }
  function stopBGM() {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  // ---- announcer (speech synthesis) with Chrome GC protection
  let queue = [], speaking = false, voices = [], activeUtterance = null;
  const loadVoices = () => { voices = speechSynthesis.getVoices(); };
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  function pickVoice(lang) {
    const pre = lang === 'th' ? 'th' : 'en';
    return voices.find(v => v.lang.toLowerCase().startsWith(pre) && /female|premwadee|google|natural/i.test(v.name)) || voices.find(v => v.lang.toLowerCase().startsWith(pre));
  }
  function say(text, lang, { priority = false, rate } = {}) {
    if (!opt.voice || !('speechSynthesis' in window) || !text) return;
    if (priority) { queue = []; activeUtterance = null; speechSynthesis.cancel(); speaking = false; }
    if (queue.length > 2) queue.shift();
    queue.push({ text, lang, rate }); next();
  }
  function next() {
    if (speaking || !queue.length) return;
    const { text, lang, rate } = queue.shift();
    const u = new SpeechSynthesisUtterance(text);
    activeUtterance = u; // prevent Chrome GC bug
    u.lang = lang === 'th' ? 'th-TH' : 'en-US';
    const v = pickVoice(lang); if (v) u.voice = v;
    u.rate = rate || (lang === 'th' ? 1.05 : 1.1); u.pitch = 1.15;
    speaking = true;
    u.onend = u.onerror = () => {
      activeUtterance = null;
      speaking = false;
      setTimeout(next, 80);
    };
    speechSynthesis.speak(u);
  }
  function set(key, val) {
    opt[key] = val;
    localStorage.setItem('ek_' + key, val ? '1' : '0');
    if (key === 'voice' && !val && window.speechSynthesis) { queue = []; activeUtterance = null; speechSynthesis.cancel(); }
    if (key === 'sound' && !val) { stopHeartbeat(); stopFuse(); stopBGM(); }
  }
  // unlock audio on first interaction (mobile)
  window.addEventListener('pointerdown', () => { try { ac(); } catch (e) { /* ignore */ } }, { once: true });
  return { sfx, say, set, opt, playHeartbeat, stopHeartbeat, startFuse, stopFuse, startBGM, stopBGM };
})();

