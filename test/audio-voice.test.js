const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function setup(t) {
  const players = [], listeners = {};
  const storage = new Map();
  class Audio {
    constructor(src) { this.src = src; this.paused = true; players.push(this); }
    play() { this.paused = false; return Audio.fail ? Promise.reject(new Error('blocked')) : Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const document = { hidden: false, addEventListener: (k, f) => { listeners[k] = f; } };
  const window = { addEventListener: (k, f) => { listeners[k] = f; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/audio.js'), 'utf8'), {
    window, document, Audio, localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) },
    setTimeout, clearTimeout, setInterval, clearInterval, Date
  });
  const a = window.Audio2;
  t.after(() => a.stopVoice());
  return { a, players, Audio, document, listeners, storage };
}
test('announcer maps real game events to hosted files without speech synthesis', t => {
  const { a, players } = setup(t);
  const cases = [
    [{type:'turn'}, true, 'yourTurn'], [{type:'turn'}, false, 'turn'],
    [{type:'nope',nopes:2},false,'nopeNope'],
    [{type:'bomb_drawn',cardId:'imploding_kitten'},false,'imp_drawn'],
    [{type:'eliminated',reason:'imploded'},false,'imploded'],
    [{type:'eliminated',reason:'exploded'},false,'exploded'],
    [{type:'triple',hit:true},false,'triple_hit'], [{type:'triple',hit:false},false,'triple_miss']
  ];
  for (const [ev,me,key] of cases) {
    a.announce(ev,me,true);
    assert.equal(players.at(-1).src, '/voice/th/'+key+'.mp3');
    assert.ok(fs.existsSync(path.join(root, 'public', players.at(-1).src)));
  }
});
test('priority interrupts current audio and ignores late completion from cancelled clip', t => {
  const { a, players } = setup(t);
  a.say('turn'); const oldEnd = players[0].onended;
  a.say('play'); a.announce({type:'bomb_drawn'});
  assert.equal(players.length,2); assert.equal(players[0].paused,true);
  oldEnd(); assert.equal(players[1].paused,false);
  players[1].onended(); assert.equal(players.length,2);
});
test('voice queue is bounded, deduplicated, and plays clips sequentially', t => {
  const { a, players } = setup(t);
  a.say('play'); a.say('play'); a.say('joined'); a.say('ready'); a.say('shuffled');
  assert.equal(players.length,1);
  players[0].onended(); assert.match(players[1].src,/ready.mp3$/);
  players[1].onended(); assert.match(players[2].src,/shuffled.mp3$/);
});
test('mute and page hiding cancel playback and pending commentary', t => {
  const { a, players, document, listeners, storage } = setup(t);
  a.say('enabled'); a.say('turn'); a.set('voice',false);
  assert.equal(players[0].paused,true); assert.equal(storage.get('ek_voice'),'0');
  a.say('win'); assert.equal(players.length,1);
  a.set('voice',true); a.say('enabled');
  document.hidden=true; listeners.visibilitychange();
  a.say('win'); assert.equal(players.length,2); assert.equal(players[1].paused,true);
});
test('blocked playback and missing audio do not jam future announcements', async t => {
  const { a, players, Audio } = setup(t);
  Audio.fail=true; a.say('turn');
  await new Promise(resolve => setImmediate(resolve));
  Audio.fail=false; a.say('win');
  assert.equal(players.length,2);
  players[1].onerror(); a.say('enabled');
  assert.equal(players.length,3);
});
test('unknown or user-supplied text never becomes an audio URL', t => {
  const { a, players } = setup(t);
  a.say('../secret'); a.say('arbitrary player name');
  assert.equal(players.length,0);
});
test('all 35 voice clips are nonempty and have measured durations and provenance', () => {
  const manifest = require('../public/voice/manifest.json');
  assert.equal(Object.keys(manifest).length,35);
  for (const clip of Object.values(manifest)) {
    assert.ok(clip.duration > 0.5 && clip.duration < 12);
    assert.ok(clip.sourceEnd > clip.sourceStart);
    assert.ok(fs.statSync(path.join(root,'public',clip.file)).size > 5000);
  }
});
