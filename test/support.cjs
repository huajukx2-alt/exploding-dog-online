const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const Game = require('../game');
const root = path.resolve(__dirname, '..');
const requireLocal = createRequire(path.join(root, 'db.js'));
const clone = value => JSON.parse(JSON.stringify(value));

function database(options = {}) {
  const context = {
    __dirname: root, module: { exports: {} }, Buffer,
    console: { log() {}, warn() {}, error() {} },
    process: { env: { APP_SECRET: 'test-only-secret' } },
    setTimeout: () => 1, clearTimeout() {},
    require: id => id === 'fs' ? { existsSync: () => false }
      : id === './firebase-db' ? (options.cloud || { isEnabled: false }) : requireLocal(id)
  };
  if (options.Date) context.Date = options.Date;
  if (options.random) context.Math = Object.assign(Object.create(Math), { random: options.random });
  vm.runInNewContext(fs.readFileSync(path.join(root, 'db.js'), 'utf8'), context);
  return context.module.exports;
}

let uid = 0;
const card = (id, extra = {}) => ({ id, uid: 'test-' + (++uid), ...extra });
function virtualGame(n = 3, onEnd) {
  const events = [];
  const g = new Game('TEST', { to: channel => ({ emit: (event, data) => events.push({ channel, event, data: clone(data) }) }) }, onEnd);
  let clock = 0;
  g.timers = {};
  g.clear = name => { delete g.timers[name]; };
  g.clearAll = () => { g.timers = {}; };
  g.later = (name, ms, fn) => { g.timers[name] = { time: clock + ms, fn }; };
  g.step = () => {
    const next = Object.entries(g.timers).sort((a, b) => a[1].time - b[1].time)[0];
    if (!next) throw new Error('No scheduled event in ' + g.state + '/' + g.phase);
    delete g.timers[next[0]];
    clock = next[1].time;
    next[1].fn();
    return next[0];
  };
  for (let i = 0; i < n; i++) g.addHuman('s' + i, 'Player' + i);
  g.events = events;
  return g;
}

function playing(n = 3) {
  const g = virtualGame(n);
  g.state = 'PLAYING'; g.phase = 'turn'; g.turnIdx = 0;
  g.deck = ['skip', 'attack', 'favor', 'shuffle', 'nope', 'reverse', 'defuse', 'exploding_kitten'].map(id => card(id));
  for (const p of g.players) p.hand = [card('defuse'), card('skip'), card('tacocat')];
  return g;
}

function playEffect(g, id, targetId, namedId) {
  const p = g.cur(); const c = card(id); p.hand.push(c);
  const result = g.play(p.socketId, [c.uid], targetId, namedId);
  if (result.error) throw new Error(id + ': ' + result.error);
  g.resolvePending();
  g.step(); // effect_delay
  return p;
}

module.exports = { database, clone, card, virtualGame, playing, playEffect };
