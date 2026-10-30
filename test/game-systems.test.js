const test = require('node:test');
const assert = require('node:assert/strict');
const { CARDS, VERSIONS } = require('../public/shared/cards');
const { card, virtualGame, playing, playEffect } = require('./support.cjs');

for (const version of Object.keys(VERSIONS)) {
  for (let n = 2; n <= 8; n++) {
    test(`deal ${version}, ${n} players: legal cards, defuses, bombs, private state`, () => {
      const g = virtualGame(n);
      g.updateSettings('s0', { version });
      for (const p of g.players) g.setReady(p.socketId, true);
      assert.equal(g.start('s0').ok, true);
      for (const p of g.players) {
        assert.equal(p.hand.length, 8);
        assert.equal(p.hand.filter(c => c.id === 'defuse').length, 1);
        assert.ok(!p.hand.some(c => ['exploding_kitten', 'imploding_kitten', 'zombie_kitten'].includes(c.id)));
      }
      const cards = [...g.deck, ...g.players.flatMap(p => p.hand)];
      assert.equal(new Set(cards.map(c => c.uid)).size, cards.length);
      assert.ok(cards.every(c => CARDS[c.id]));
      const me = g.getState(g.players[0]);
      assert.equal(me.me.hand.length, 8);
      assert.ok(me.players.every(p => !('hand' in p) && !('key' in p)));
      const spec = g.addSpectator('spectator', 'Viewer').player;
      assert.equal(g.getState(spec).me.hand.length, 0);
      g.step();
      assert.equal(g.phase, 'turn');
    });
  }
}

test('lobby validates host, capacity, readiness and bot operations', () => {
  const g = virtualGame(2);
  assert.equal(g.start('s1').error, 'host_only');
  assert.equal(g.start('s0').error, 'not_ready');
  assert.equal(g.addBot('s1').error, 'host_only');
  const bot = g.addBot('s0').player;
  assert.equal(g.removeBot('s1', bot.id).error, 'host_only');
  assert.equal(g.removeBot('s0', bot.id).ok, true);
  for (let i = 0; i < 6; i++) g.addBot('s0');
  assert.equal(g.addHuman('overflow', 'Extra').error, 'room_full');
  g.setReady('s1', true);
  assert.equal(g.start('s0').ok, true);
  assert.equal(g.addBot('s0').error, 'in_progress');
});

test('custom decks and settings reject invalid counts and use valid configuration', () => {
  const g = virtualGame(2);
  assert.equal(g.updateSettings('s1', {}).error, 'host_only');
  g.updateSettings('s0', { custom: true, counts: { skip: -1, attack: 500, invalid: 5 }, turnSeconds: 45, nopeSeconds: 8, botLevel: 'hard' });
  assert.equal(g.settings.counts.skip, undefined);
  assert.equal(g.settings.counts.attack, 10);
  assert.equal(g.settings.counts.invalid, undefined);
  assert.equal(g.settings.turnSeconds, 45);
  assert.equal(g.settings.nopeSeconds, 8);
  assert.equal(g.settings.botLevel, 'hard');
});

test('draw and timeout move exactly one card and advance the turn', () => {
  const g = playing(); const p = g.cur(); const top = g.deck[0];
  assert.equal(g.drawAction('s1').error, 'not_your_turn');
  assert.equal(g.drawAction('s0').ok, true);
  assert.ok(p.hand.includes(top));
  assert.equal(g.drawAction('s0').error, 'not_your_turn');
  g.step(); assert.equal(g.cur(), g.players[1]);
  g.step(); assert.equal(g.phase, 'drawing');
});

for (const [id, owed, target] of [['skip', 3, 0], ['super_skip', 3, 1], ['reverse', 1, 2]]) {
  test(id + ' respects remaining turns and direction', () => {
    const g = playing(); g.turnsLeft = owed;
    playEffect(g, id);
    assert.equal(g.turnIdx, target);
    if (id === 'skip') assert.equal(g.turnsLeft, 2);
    if (id === 'reverse') assert.equal(g.direction, -1);
  });
}

for (const id of ['attack', 'targeted_attack', 'personal_attack']) {
  test(id + ' stacks the owed turns correctly', () => {
    const g = playing(); g.turnsLeft = 3;
    playEffect(g, id, g.players[2].id); g.step();
    assert.equal(g.turnsLeft, 5);
    assert.equal(g.turnIdx, id === 'attack' ? 1 : id === 'targeted_attack' ? 2 : 0);
  });
}

test('draw_bottom draws the last card and consumes Defuse before asking for placement', () => {
  const g = playing(); const p = g.cur();
  playEffect(g, 'draw_bottom');
  g.step();
  assert.equal(p.defuses, 1);
  assert.equal(g.prompt.type, 'insert_bomb');
  assert.equal(g.respond('s1', { pos: 0 }).error, 'no_prompt');
  g.respond('s0', { pos: 0 });
  assert.equal(g.deck[0].id, 'exploding_kitten');
  assert.equal(g.turnIdx, 1);
});

test('bombs eliminate unprotected players; face-up imploding ignores Defuse', () => {
  for (const bomb of [card('exploding_kitten'), card('imploding_kitten', { faceUp: true })]) {
    const g = playing(); const p = g.cur();
    if (bomb.id === 'exploding_kitten') p.hand = [];
    g.resolveDrawn(p, bomb);
    if (g.timers.bomb_reveal) g.step();
    assert.equal(p.alive, false);
    assert.equal(g.turnIdx, 1);
  }
});

test('face-down imploding turns face-up, can be inserted, and ends one turn', () => {
  const g = playing(); const bomb = card('imploding_kitten', { faceUp: false });
  g.resolveDrawn(g.cur(), bomb);
  assert.equal(g.prompt.type, 'insert_bomb');
  g.respond('s0', { pos: g.deck.length });
  assert.equal(g.deck.at(-1), bomb);
  assert.equal(bomb.faceUp, true);
  assert.equal(g.turnIdx, 1);
});

test('Streaking holds a bomb and losing protection forces Defuse', () => {
  const g = playing(); const p = g.cur(); const streak = card('streaking_kitten');
  p.hand.push(streak);
  g.resolveDrawn(p, card('exploding_kitten'));
  assert.equal(g.prompt, null);
  assert.equal(p.hand.filter(c => c.id === 'exploding_kitten').length, 1);
  g.clearAll(); p.hand.splice(p.hand.indexOf(streak), 1);
  g.checkStreak(p, () => g.backToTurn());
  assert.equal(g.prompt.type, 'insert_bomb');
  assert.equal(p.defuses, 1);
});

test('Zombie revives an eliminated player and returns a bomb to the deck', () => {
  const g = playing(); const dead = g.players[2];
  g.eliminate(dead, 'exploded');
  g.discard.push(card('exploding_kitten'));
  g.resolveDrawn(g.cur(), card('zombie_kitten'));
  assert.equal(g.prompt.type, 'revive');
  g.respond('s0', { targetId: dead.id });
  assert.equal(dead.alive, true);
  assert.equal(dead.hand[0].id, 'defuse');
  assert.ok(!g.elimOrder.includes(dead.id));
});

test('Nope cancellation and counter-Nope preserve turn and prevent self-Nope', () => {
  const g = playing(); const p = g.cur(); const t = g.players[1];
  p.hand.push(card('nope')); t.hand.push(card('nope'));
  const skip = p.hand.find(c => c.id === 'skip');
  assert.equal(g.play('s0', [skip.uid]).ok, true);
  assert.equal(g.play('s0', [p.hand.find(c => c.id === 'nope').uid]).error, 'cannot_nope_self');
  assert.equal(g.play('s1', [t.hand.find(c => c.id === 'nope').uid]).ok, true);
  assert.equal(g.pending.nopes, 1);
  g.resolvePending(); g.step();
  assert.equal(g.turnIdx, 0);
  const next = card('skip'); p.hand.push(next); t.hand.push(card('nope'));
  g.play('s0', [next.uid]);
  g.play('s1', [t.hand.find(c => c.id === 'nope').uid]);
  g.play('s0', [p.hand.find(c => c.id === 'nope').uid]);
  assert.equal(g.pending.nopes, 2);
  g.resolvePending(); g.step();
  assert.equal(g.turnIdx, 1);
});

test('invalid, duplicate, foreign cards, wrong turns and targetless attacks are rejected', () => {
  const g = playing();
  assert.equal(g.play('s0', ['missing']).error, 'bad_cards');
  const c = g.cur().hand[1];
  assert.equal(g.play('s0', [c.uid, c.uid]).error, 'bad_cards');
  assert.equal(g.play('s1', [g.players[1].hand[1].uid]).error, 'not_your_turn');
  const attack = card('targeted_attack'); g.cur().hand.push(attack);
  assert.equal(g.play('s0', [attack.uid]).error, 'need_target');
  assert.equal(g.play('s0', [g.cur().hand[0].uid]).error, 'not_playable');
});

for (const id of ['see_the_future', 'see_future_5', 'alter_the_future', 'alter_future_5', 'share_the_future']) {
  test(id + ' exposes only private future data and resolves correctly', () => {
    const g = playing(); const original = [...g.deck];
    playEffect(g, id);
    assert.equal(g.getState(g.players[1]).prompt.data, null);
    assert.ok(g.getState(g.players[0]).prompt.data);
    if (id.startsWith('see_')) {
      assert.equal(g.prompt.data.cardIds.length, id === 'see_future_5' ? 5 : 3);
      g.respond('s0', {});
      assert.deepEqual(g.deck, original);
    } else {
      const n = id === 'alter_future_5' ? 5 : 3;
      g.respond('s0', { order: Array.from({ length: n }, (_, i) => n - i - 1) });
      assert.equal(g.deck[0], original[n - 1]);
      if (id === 'share_the_future') assert.ok(g.events.some(e => e.channel === 's1' && e.event === 'private' && e.data.type === 'future'));
    }
    assert.equal(g.phase, 'turn');
  });
}

test('swap, shuffle and Catomic Bomb preserve deck contents', () => {
  for (const id of ['swap_top_bottom', 'shuffle', 'catomic_bomb']) {
    const g = playing(); const before = g.deck.map(c => c.uid).sort(); const bottom = g.deck.at(-1);
    playEffect(g, id);
    assert.deepEqual(g.deck.map(c => c.uid).sort(), before);
    if (id === 'swap_top_bottom') assert.equal(g.deck[0], bottom);
    if (id === 'catomic_bomb') { assert.equal(g.deck[0].id, 'exploding_kitten'); assert.equal(g.turnIdx, 1); }
  }
});

test('dig deeper keeps the top or takes the second card', () => {
  for (const keep of [true, false]) {
    const g = playing(); const chosen = g.deck[keep ? 0 : 1]; const p = g.cur();
    playEffect(g, 'dig_deeper');
    g.respond('s0', { keep });
    assert.ok(p.hand.includes(chosen));
  }
});

test('bury reinserts the top card and clairvoyance privately reveals the first bomb', () => {
  const g = playing(); const first = g.deck[0];
  playEffect(g, 'bury'); g.respond('s0', { pos: 3 });
  assert.equal(g.deck[3], first);
  playEffect(g, 'clairvoyance');
  assert.ok(g.events.some(e => e.channel === 's1' && e.event === 'private' && e.data.type === 'clairvoyance' && e.data.pos === 7));
});

test('clone repeats the last action and cannot run without a previous action', () => {
  const g = playing(); const clone = card('clone'); g.cur().hand.push(clone);
  assert.equal(g.play('s0', [clone.uid]).error, 'nothing_to_clone');
  g.lastActionId = 'skip';
  assert.equal(g.play('s0', [clone.uid]).ok, true);
  g.resolvePending(); g.step();
  assert.equal(g.turnIdx, 1);
});

test('Favor lets the target choose a safe card and blocks another player from responding', () => {
  const g = playing(); const target = g.players[1]; const given = target.hand[2];
  playEffect(g, 'favor', target.id);
  assert.equal(g.prompt.playerId, target.id);
  assert.equal(g.respond('s2', { uid: given.uid }).error, 'no_prompt');
  g.respond('s1', { uid: given.uid });
  assert.ok(g.players[0].hand.includes(given));
  assert.ok(!target.hand.includes(given));
});

test('cat pair, wild pair, triple and five distinct cards execute their respective steals', () => {
  for (const ids of [['tacocat', 'tacocat'], ['tacocat', 'feral_cat'], ['tacocat', 'tacocat', 'tacocat'], ['skip', 'attack', 'favor', 'shuffle', 'nope']]) {
    const g = playing(); const p = g.cur(); const target = g.players[1];
    const combo = ids.map(id => card(id)); p.hand.push(...combo);
    const stolen = target.hand[0];
    assert.equal(g.play('s0', combo.map(c => c.uid), target.id, 'defuse').ok, true);
    g.resolvePending(); g.step();
    if (ids.length === 2) g.respond('s0', { index: target.hand.indexOf(stolen) });
    if (ids.length === 5) g.respond('s0', { uid: combo[0].uid });
    assert.ok(p.hand.includes(ids.length === 5 ? combo[0] : stolen));
  }
});

test('Barking pairs explode the other holder, consume Defuse or are blocked by Tower', () => {
  for (const defense of ['none', 'defuse', 'tower_of_power']) {
    const g = playing(); const target = g.players[1];
    target.hand = [card('barking_kitten'), ...(defense === 'none' ? [] : [card(defense)])];
    playEffect(g, 'barking_kitten');
    assert.equal(target.alive, defense !== 'none');
    assert.equal(target.hand.length, 0);
    assert.equal(g.phase, 'turn');
  }
  const g = playing(); playEffect(g, 'barking_kitten');
  assert.equal(g.deck.filter(c => c.id === 'barking_kitten').length, 1);
});

test('chat, stickers, elimination ranking, rematch and spectator promotion', () => {
  let ends = 0;
  const g = virtualGame(3, () => { ends++; return {}; });
  g.chat('s0', ' hello ');
  assert.ok(g.events.some(e => e.event === 'chat' && e.data.text === 'hello'));
  const before = g.events.length;
  g.sticker('s0', 'paid', []); assert.equal(g.events.length, before);
  g.sticker('s0', 'free', ['free']); assert.equal(g.events.at(-1).event, 'sticker');
  for (const p of g.players) g.setReady(p.socketId, true);
  g.start('s0');
  const spectator = g.addSpectator('spec', 'Spec').player;
  g.eliminate(g.players[2], 'exploded'); g.eliminate(g.players[1], 'exploded');
  assert.equal(g.state, 'ENDED'); assert.equal(ends, 1);
  assert.deepEqual(g.lastResults.map(r => r.id), [g.players[0].id, g.players[1].id, g.players[2].id]);
  assert.equal(g.backToLobby('s1').error, 'host_only');
  assert.equal(g.backToLobby('s0').ok, true);
  assert.ok(g.players.includes(spectator));
  assert.equal(spectator.isSpectator, false);
  assert.equal(g.state, 'LOBBY');
});

test('lobby host disconnect transfers hosting after grace period', () => {
  const g = virtualGame(2);
  g.removeSocket('s0'); g.step();
  assert.equal(g.players.length, 1);
  assert.equal(g.players[0].isHost, true);
});

test('leaving after game over does not grant duplicate rewards', () => {
  let ends = 0;
  const g = virtualGame(2, () => { ends++; return {}; });
  g.state = 'PLAYING'; g.eliminate(g.players[1], 'exploded');
  g.explicitLeave('s0');
  assert.equal(ends, 1);
});

test('fractional future reorder indexes cannot corrupt the deck', () => {
  const g = playing(); const before = [...g.deck];
  playEffect(g, 'alter_the_future');
  g.respond('s0', { order: [0.5, 1.5, 2.5] });
  assert.deepEqual(g.deck, before);
});

test('rejoining while a bot is acting keeps the bot scheduled', () => {
  const g = virtualGame(2);
  g.players[1].isBot = true; g.players[1].ready = true;
  g.start('s0'); g.clearAll(); g.turnIdx = 1; g.beginTurn(true);
  g.rejoin('replacement', g.players[0].id, g.players[0].key);
  assert.ok(g.timers.bot);
});

test('last human disconnect pauses the turn and rejoin restarts it', () => {
  const g = virtualGame(2);
  g.players[1].isBot = true; g.players[1].ready = true;
  const human = g.players[0];
  g.start('s0'); g.clearAll(); g.turnIdx = 1; g.beginTurn(true);
  g.removeSocket('s0');
  assert.equal(g.timers.turn, undefined);
  assert.equal(g.timers.bot, undefined);
  g.rejoin('replacement', human.id, human.key);
  assert.ok(g.timers.turn); assert.ok(g.timers.bot);
});

for (const version of Object.keys(VERSIONS)) {
  for (const level of ['easy', 'normal', 'hard']) {
    test(`complete automated match: ${version}/${level}`, () => {
      let ends = 0;
      const g = virtualGame(4, () => { ends++; return {}; });
      g.updateSettings('s0', { version, botLevel: level });
      for (const p of g.players) { g.setReady(p.socketId, true); p.auto = true; }
      g.start('s0');
      let steps = 0;
      while (g.state === 'PLAYING' && steps++ < 10000) {
        g.step();
        const cards = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand)];
        assert.equal(new Set(cards.map(c => c.uid)).size, cards.length, 'no duplicate card ownership');
        assert.ok(cards.every(c => c && CARDS[c.id]), 'valid cards throughout');
      }
      assert.equal(g.state, 'ENDED', `match stalled after ${steps} events`);
      assert.equal(ends, 1);
      assert.equal(g.lastResults.length, 4);
      assert.equal(new Set(g.lastResults.map(r => r.id)).size, 4);
      assert.equal(Object.keys(g.timers).length, 0);
    });
  }
}
