// Shared card + version definitions (Dog / Exploding Puppies theme, used by server and browser)
(function (root, factory) {
  const exp = factory();
  if (typeof module === 'object' && module.exports) module.exports = exp;
  if (root) root.EK = exp;
  if (typeof window !== 'undefined') window.EK = exp;
})(typeof self !== 'undefined' ? self : this, function () {
  // kind: bomb | defense | action | reaction | cat | special
  // target: requires choosing another player
  const CARDS = {
    exploding_kitten: { kind: 'bomb', color: '#ff2a5f', icon: '💣',
      name: { th: 'หมาระเบิด', en: 'Exploding Puppy' },
      desc: { th: 'จั่วได้แล้วไม่มีการ์ดกู้ระเบิด = ระเบิดตกรอบทันที!', en: 'Draw it without a Defuse and you explode!' } },
    imploding_kitten: { kind: 'bomb', color: '#4338ca', icon: '🌀',
      name: { th: 'หมายุบตัว', en: 'Imploding Puppy' },
      desc: { th: 'ครั้งแรกให้ใส่คืนกองแบบหงายหน้า ครั้งที่สองที่จั่วโดน = ตกรอบ กู้ไม่ได้!', en: 'First draw: put back face-up. Drawn face-up = you are out, no Defuse!' } },
    streaking_kitten: { kind: 'special', color: '#f9a8d4', icon: '🦴',
      name: { th: 'หมาชีเปลือย', en: 'Streaking Puppy' },
      desc: { th: 'เก็บไว้ในมือ ทำให้ถือหมาระเบิดไว้ในมือได้ 1 ใบโดยไม่ระเบิด', en: 'Keep in hand: lets you secretly hold 1 Exploding Puppy safely.' } },
    barking_kitten: { kind: 'action', color: '#38bdf8', icon: '🐕',
      name: { th: 'หมาเห่าบ๊อกๆ', en: 'Barking Puppy' },
      desc: { th: 'เล่นเมื่อมีคนอื่นถือหมาเห่าอีกใบ คนนั้นต้องเจอระเบิด! (ปลอกคอแห่งพลังป้องกันได้) ถ้าไม่มีใครถือ ใส่คืนกองแบบสุ่ม', en: 'If someone else holds the other Barking Puppy, they face an explosion! (Collar of Power blocks). Otherwise shuffled back.' } },
    zombie_kitten: { kind: 'special', color: '#65a30d', icon: '🧟',
      name: { th: 'หมาซอมบี้', en: 'Zombie Puppy' },
      desc: { th: 'เมื่อจั่วได้ ชุบชีวิตผู้เล่นที่ตกรอบ 1 คน (ถ้ามี) แล้วจบเทิร์น', en: 'When drawn, revive one eliminated player (if any), then end your turn.' } },
    defuse: { kind: 'defense', color: '#22c55e', icon: '🛠️',
      name: { th: 'กู้ระเบิด', en: 'Defuse' },
      desc: { th: 'ใช้อัตโนมัติเมื่อจั่วได้หมาระเบิด โยนกระดูกหลอกล่อแล้วซ่อนระเบิดคืนกอง', en: 'Auto-used on Exploding Puppy. Distract with a bone and hide it back anywhere.' } },
    attack: { kind: 'action', color: '#f97316', icon: '⚡',
      name: { th: 'กระโจนใส่ (Attack)', en: 'Attack' },
      desc: { th: 'จบเทิร์นไม่ต้องจั่ว คนถัดไปต้องเล่น 2 เทิร์น (ซ้อนได้)', en: 'End turn without drawing. Next player takes 2 turns (stacks).' } },
    targeted_attack: { kind: 'action', color: '#be123c', icon: '🎯', target: true,
      name: { th: 'สั่งกัดเจาะจง', en: 'Targeted Attack' },
      desc: { th: 'เลือกเหยื่อ 1 คน ให้เล่น 2 เทิร์นรวด', en: 'Choose a player to take 2 turns.' } },
    personal_attack: { kind: 'action', color: '#991b1b', icon: '🥊',
      name: { th: 'ไล่งับหางตัวเอง', en: 'Personal Attack' },
      desc: { th: 'คุณต้องเล่นเพิ่มอีก 2 เทิร์น (รวม 3)', en: 'You take 2 extra turns (3 in total).' } },
    skip: { kind: 'action', color: '#3b82f6', icon: '⏭️',
      name: { th: 'ชิ่งหนี (Skip)', en: 'Skip' },
      desc: { th: 'จบ 1 เทิร์นโดยไม่ต้องจั่ว', en: 'End 1 turn without drawing.' } },
    super_skip: { kind: 'action', color: '#1d4ed8', icon: '🦸',
      name: { th: 'ซูเปอร์ชิ่ง', en: 'Super Skip' },
      desc: { th: 'จบทุกเทิร์นที่ค้างอยู่ทั้งหมดโดยไม่ต้องจั่ว', en: 'End ALL your remaining turns without drawing.' } },
    reverse: { kind: 'action', color: '#f59e0b', icon: '🔁',
      name: { th: 'วิ่งย้อนศร (Reverse)', en: 'Reverse' },
      desc: { th: 'สลับทิศทางการเล่น และจบเทิร์นโดยไม่ต้องจั่ว', en: 'Reverse play order and end turn without drawing.' } },
    draw_bottom: { kind: 'action', color: '#14b8a6', icon: '⬇️',
      name: { th: 'คุ้ยก้นกอง', en: 'Draw from the Bottom' },
      desc: { th: 'จบเทิร์นโดยจั่วใบล่างสุดของกอง', en: 'End your turn by drawing the bottom card.' } },
    favor: { kind: 'action', color: '#a855f7', icon: '🎁', target: true,
      name: { th: 'ทำตาแป๋วขอไพ่', en: 'Favor' },
      desc: { th: 'เลือกเพื่อน 1 คน เขาต้องเลือกการ์ด 1 ใบส่งให้คุณ', en: 'A player of your choice must give you a card of their choice.' } },
    shuffle: { kind: 'action', color: '#eab308', icon: '🔀',
      name: { th: 'ตะกุยกองไพ่ (Shuffle)', en: 'Shuffle' },
      desc: { th: 'สับกองจั่วใหม่ทั้งหมด', en: 'Shuffle the draw pile.' } },
    see_the_future: { kind: 'action', color: '#06b6d4', icon: '🔮',
      name: { th: 'ดมกลิ่นอนาคต', en: 'Sniff the Future' },
      desc: { th: 'แอบดูการ์ด 3 ใบบนสุด', en: 'Peek at the top 3 cards.' } },
    see_future_5: { kind: 'action', color: '#0e7490', icon: '👁️',
      name: { th: 'ดมกลิ่นอนาคต x5', en: 'Sniff the Future x5' },
      desc: { th: 'แอบดูการ์ด 5 ใบบนสุด', en: 'Peek at the top 5 cards.' } },
    alter_the_future: { kind: 'action', color: '#c026d3', icon: '🪄',
      name: { th: 'เปลี่ยนอนาคต', en: 'Alter the Future' },
      desc: { th: 'ดูและจัดเรียงการ์ด 3 ใบบนสุดใหม่', en: 'View and rearrange the top 3 cards.' } },
    alter_future_5: { kind: 'action', color: '#86198f', icon: '✨',
      name: { th: 'เปลี่ยนอนาคต x5', en: 'Alter the Future x5' },
      desc: { th: 'ดูและจัดเรียงการ์ด 5 ใบบนสุดใหม่', en: 'View and rearrange the top 5 cards.' } },
    share_the_future: { kind: 'action', color: '#2dd4bf', icon: '🤝',
      name: { th: 'แบ่งปันอนาคต', en: 'Share the Future' },
      desc: { th: 'จัดเรียง 3 ใบบนสุด แล้วคนถัดไปได้เห็นด้วย', en: 'Rearrange the top 3, then the next player sees them too.' } },
    swap_top_bottom: { kind: 'action', color: '#84cc16', icon: '🔃',
      name: { th: 'สลับบน-ล่าง', en: 'Swap Top & Bottom' },
      desc: { th: 'สลับการ์ดใบบนสุดกับใบล่างสุดของกอง', en: 'Swap the top and bottom cards of the deck.' } },
    catomic_bomb: { kind: 'action', color: '#ea580c', icon: '☢️',
      name: { th: 'ด็อกอะตอมิกบอมบ์', en: 'Dogomic Bomb' },
      desc: { th: 'ย้ายหมาระเบิดทั้งหมดไปไว้บนสุดของกอง แล้วจบเทิร์นไม่ต้องจั่ว', en: 'Move all exploding puppies to the top of the deck, end turn without drawing.' } },
    bury: { kind: 'action', color: '#92400e', icon: '⛏️',
      name: { th: 'ขุดหลุมฝัง', en: 'Bury' },
      desc: { th: 'จบเทิร์นโดยเอาใบบนสุดไปฝังไว้ตำแหน่งที่เลือก (ไม่ได้ดู)', en: 'End turn by burying the top card anywhere (unseen).' } },
    dig_deeper: { kind: 'action', color: '#d6b26e', icon: '🪨',
      name: { th: 'ขุดลึกหาสมบัติ', en: 'Dig Deeper' },
      desc: { th: 'ดูใบบนสุด เลือกเก็บ หรือวางคืนแล้วจั่วใบถัดไปแทน', en: 'Look at the top card: keep it, or put it back and draw the next one.' } },
    clairvoyance: { kind: 'action', color: '#7c3aed', icon: '🧿',
      name: { th: 'จมูกทิพย์', en: 'Super Snout' },
      desc: { th: 'ดมกลิ่นรู้ตำแหน่งของหมาระเบิดลูกที่ใกล้ที่สุดในกอง', en: 'Sniff out the position of the nearest puppy bomb in the deck.' } },
    clone: { kind: 'action', color: '#64748b', icon: '🧬',
      name: { th: 'โคลนนิ่ง', en: 'Clone' },
      desc: { th: 'คัดลอกพลังของการ์ดแอคชันใบล่าสุดที่ถูกเล่น', en: 'Copy the power of the last action card played.' } },
    tower_of_power: { kind: 'defense', color: '#ca8a04', icon: '🗼',
      name: { th: 'ปลอกคอแห่งพลัง', en: 'Collar of Power' },
      desc: { th: 'เก็บไว้ในมือ ป้องกันหมาเห่าบ๊อกๆ 1 ครั้ง', en: 'Keep in hand: blocks a Barking Puppy once.' } },
    nope: { kind: 'reaction', color: '#ef4444', icon: '🛑',
      name: { th: 'ไม่! (Nope)', en: 'Nope' },
      desc: { th: 'ยกเลิกแอคชันใดๆ ได้ทุกเมื่อ (Nope ซ้อน Nope ได้)', en: 'Stop any action at any time (Nope a Nope!).' } },
    tacocat: { kind: 'cat', color: '#ec4899', icon: '🌭',
      name: { th: 'หมาไส้กรอก', en: 'Hotdog Pup' }, desc: null },
    cattermelon: { kind: 'cat', color: '#10b981', icon: '🍉',
      name: { th: 'หมาแตงโม', en: 'Dogmelon' }, desc: null },
    hairy_potato: { kind: 'cat', color: '#b45309', icon: '🥔',
      name: { th: 'หมามันฝรั่ง', en: 'Potato Pup' }, desc: null },
    beard_cat: { kind: 'cat', color: '#64748b', icon: '🧔',
      name: { th: 'หมาเคราดก', en: 'Beard Dog' }, desc: null },
    rainbow_cat: { kind: 'cat', color: '#8b5cf6', icon: '🌈',
      name: { th: 'หมาสายรุ้ง', en: 'Rainbow Pup' }, desc: null },
    feral_cat: { kind: 'cat', color: '#166534', icon: '🐾', wild: true,
      name: { th: 'หมาป่า (ไวลด์)', en: 'Wild Dog (Wild)' }, desc: null }
  };
  const CAT_DESC = { th: 'การ์ดแก๊งหมา: คู่ = สุ่มคาบไพ่ 1 ใบ, 3 ใบ = ขอการ์ดที่ระบุชื่อ, 5 ใบต่างชนิด = หยิบการ์ดจากกองทิ้ง', en: 'Dog card: pair = steal random, 3 = name a card, 5 different = take 1 card from discard pile.' };
  const WILD_DESC = { th: 'หมาไวลด์: ใช้แทนการ์ดแก๊งหมาชนิดใดก็ได้ในการจับคู่', en: 'Wild: counts as any dog card in combos.' };
  for (const id in CARDS) {
    CARDS[id].id = id;
    if (!CARDS[id].desc) CARDS[id].desc = CARDS[id].wild ? WILD_DESC : CAT_DESC;
  }

  const base = { attack: 4, skip: 4, favor: 4, shuffle: 4, see_the_future: 5, nope: 5,
    tacocat: 4, cattermelon: 4, hairy_potato: 4, beard_cat: 4, rainbow_cat: 4 };

  const VERSIONS = {
    original: { icon: '🐶', name: { th: 'ออริจินัล (หมาระเบิด)', en: 'Original Puppies' },
      desc: { th: 'กติกาหมาระเบิดคลาสสิก เหมาะกับมือใหม่', en: 'Classic Exploding Puppies rules, great for beginners.' },
      counts: { ...base }, imploding: false },
    party: { icon: '🌀', name: { th: 'ปาร์ตี้ / หมายุบตัว', en: 'Party / Imploding' },
      desc: { th: 'เพิ่มหมายุบตัว วิ่งย้อนศร เปลี่ยนอนาคต สั่งกัดเจาะจง หมาป่าไวลด์', en: 'Adds Imploding Puppy, Reverse, Alter the Future, Targeted Attack, Wild Dog.' },
      counts: { ...base, reverse: 4, draw_bottom: 4, alter_the_future: 4, targeted_attack: 3, feral_cat: 4 }, imploding: true },
    streaking: { icon: '🦴', name: { th: 'หมาชีเปลือย (Streaking)', en: 'Streaking Puppies' },
      desc: { th: 'หมาชีเปลือย ซูเปอร์ชิ่ง สลับบน-ล่าง ด็อกอะตอมิกบอมบ์ ดมอนาคต x5', en: 'Streaking Puppy, Super Skip, Swap, Dogomic Bomb, Sniff the Future x5.' },
      counts: { ...base, streaking_kitten: 1, super_skip: 2, swap_top_bottom: 3, catomic_bomb: 1, see_future_5: 2, alter_future_5: 2, draw_bottom: 3 }, extraBombs: 1, imploding: false },
    barking: { icon: '🐕', name: { th: 'หมาเห่าบ๊อกๆ (Barking)', en: 'Barking Puppies' },
      desc: { th: 'หมาเห่า ปลอกคอแห่งพลัง ขุดหลุมฝัง ไล่งับหางตัวเอง แบ่งปันอนาคต', en: 'Barking Puppy, Collar of Power, Bury, Personal Attack, Share the Future.' },
      counts: { ...base, barking_kitten: 2, tower_of_power: 1, bury: 3, personal_attack: 3, share_the_future: 3, super_skip: 1 }, imploding: false },
    zombie: { icon: '🧟', name: { th: 'หมาซอมบี้ (Zombie)', en: 'Zombie Puppies' },
      desc: { th: 'หมาซอมบี้ชุบชีวิต ขุดลึกหาสมบัติ จมูกทิพย์ โคลนนิ่ง', en: 'Zombie Puppy revives, Dig Deeper, Super Snout, Clone.' },
      counts: { ...base, zombie_kitten: 2, dig_deeper: 4, clairvoyance: 3, clone: 3 }, imploding: false },
    mega: { icon: '🎆', name: { th: 'เมก้ามิกซ์ (รวมฝูงหมา)', en: 'Mega Mix (All)' },
      desc: { th: 'รวมทุกภาคในเกมเดียว วุ่นวายสุดๆ', en: 'Every expansion in one chaotic puppy party.' },
      counts: { ...base, reverse: 3, draw_bottom: 3, alter_the_future: 3, targeted_attack: 3, feral_cat: 3, streaking_kitten: 1, super_skip: 2, swap_top_bottom: 2, catomic_bomb: 1, see_future_5: 1, alter_future_5: 1, barking_kitten: 2, tower_of_power: 1, bury: 2, personal_attack: 2, share_the_future: 2, zombie_kitten: 1, dig_deeper: 2, clairvoyance: 2, clone: 2 }, extraBombs: 1, imploding: true }
  };

  // Cards host can configure in custom mode (bombs/defuse handled automatically)
  const CONFIGURABLE = Object.keys(CARDS).filter(id => !['exploding_kitten', 'imploding_kitten', 'defuse'].includes(id));

  // 3D & Luxury Avatars
  const AVATARS = [
    { id: 'av_shiba_vip', type: 'avatar', icon: '🐕', price: 500, name: { th: 'เสี่ยชิบะ 24K', en: 'VIP 24K Shiba' }, desc: { th: 'แว่นตาทองคำ สร้อยเพชรสุดหรูระยิบระยับ', en: 'Gold sunglasses & diamond chain' } },
    { id: 'av_cyber_husky', type: 'avatar', icon: '🐺', price: 650, name: { th: 'ไซเบอร์ฮัสกี้ ไฮเทค', en: 'Cyber Mecha Husky' }, desc: { th: 'หมวกเหล็กนีออนไซเบอร์โลกอนาคต', en: 'Futuristic VR cyber visor' } },
    { id: 'av_corgi_galaxy', type: 'avatar', icon: '🐶', price: 600, name: { th: 'คอร์กี้ ท่องดวงดาว', en: 'Cosmic Corgi' }, desc: { th: 'ชุดนักบินอวกาศสำรวจดวงดาวจักรวาล', en: 'Space astronaut glass helmet' } },
    { id: 'av_blaze_bulldog', type: 'avatar', icon: '🦮', price: 700, name: { th: 'บูลด็อก เพลิงนรก', en: 'Blaze Inferno Bulldog' }, desc: { th: 'เพลิงบรรลัยกัลป์สุดดุดันแชมเปี้ยน', en: 'Hellfire spiked collar champion' } },
    { id: 'av_diamond_poodle', type: 'avatar', icon: '🐩', price: 850, name: { th: 'พุดเดิ้ล ไดมอนด์ควีน', en: 'Diamond Queen Poodle' }, desc: { th: 'มงกุฎเพชรระยิบระยับระดับราชวงศ์', en: 'Sparkling diamond royal tiara' } },
    { id: 'av_samurai_akita', type: 'avatar', icon: '🐕‍🦺', price: 750, name: { th: 'อาคิตะ ซามูไรทองคำ', en: 'Samurai Doge Legend' }, desc: { th: 'เกราะซามูไรญี่ปุ่นโบราณสีแดงชาด', en: 'Traditional crimson samurai armor' } },
    { id: 'av_gentleman_pug', type: 'avatar', icon: '🐶', price: 450, name: { th: 'ปั๊ก สุภาพบุรุษคลาสสิก', en: 'Gentleman Classic Pug' }, desc: { th: 'หมวกทรงสูง แว่นตาเลนส์เดี่ยวทองคำ', en: 'Top hat & golden monocle' } },
    { id: 'av_ninja_dog', type: 'avatar', icon: '🥷', price: 550, name: { th: 'ตูบนินจา เงาจันทร์', en: 'Shadow Moon Ninja Dog' }, desc: { th: 'หน้ากากนินจา ดาบคาตานะคู่สุดเท่', en: 'Stealth shinobi mask & twin blades' } }
  ];

  // Purchasable and Limited Titles / Ranks (ยศ & ฉายา)
  const TITLES = [
    { id: 'title_rookie', type: 'title', icon: '🐾', price: 0, tag: 'rookie', name: { th: 'ลูกหมาฝึกหัด', en: 'Rookie Pup' }, desc: { th: 'ยศเริ่มต้นของตูบน้อยไร้เดียงสา', en: 'Starting rank of innocent pups' } },
    { id: 'title_bomb_master', type: 'title', icon: '💣', price: 350, tag: 'bomb', name: { th: 'มือวางระเบิดตัวพ่อ', en: 'Bomb Master' }, desc: { th: 'ผู้เชี่ยวชาญการวางระเบิดยัดไส้กองจั่ว', en: 'Expert at planting bombs in draw pile' } },
    { id: 'title_nope_king', type: 'title', icon: '🛑', price: 500, tag: 'nope', name: { th: 'ราชาแห่งการ Nope', en: 'Nope King' }, desc: { th: 'มือขัดจังหวะตัวท็อป ปฏิเสธทุกการกระทำ', en: 'Denies everything with lightning nopes' } },
    { id: 'title_rich_doge', type: 'title', icon: '🪙', price: 600, tag: 'rich', name: { th: 'มหาเศรษฐีตูบ', en: 'Rich Doge' }, desc: { th: 'รวยล้นฟ้า กระดูกทองคำกองพะเนิน', en: 'Wealthy canine swimming in gold coins' } },
    { id: 'title_diamond_hunter', type: 'title', icon: '💎', price: 800, tag: 'diamond', name: { th: 'นักล่าเพชรแดนเถื่อน', en: 'Diamond Hunter' }, desc: { th: 'ผู้เสพติดการกวาดเพชรเข้าคลัง', en: 'Craving diamonds from every victory' } },
    { id: 'title_grim_reaper', type: 'title', icon: '☠️', price: 1000, tag: 'reaper', name: { th: 'ยมทูต 4 ขา', en: 'Grim Reaper Dog' }, desc: { th: 'ผู้มากับความตาย ใครเจอเป็นต้องระเบิด', en: 'Bringer of explosions and doom' } },
    { id: 'title_undefeated', type: 'title', icon: '🏆', price: 1500, tag: 'champion', name: { th: 'จ่าฝูงไร้พ่าย', en: 'Undefeated Alpha' }, desc: { th: 'แชมเปี้ยนผู้ไม่เคยรู้จักคำว่าแพ้', en: 'Undisputed champion of the pack' } },
    { id: 'title_lucky_star', type: 'title', icon: '🌟', price: 400, tag: 'lucky', name: { th: 'ดวงดีจนหมางง', en: 'Lucky Star' }, desc: { th: 'จั่วการ์ดอะไรก็รอด พกดวงมาเต็มกระเป๋า', en: 'Draws whatever card is needed to survive' } },
    { id: 'title_fried_chicken', type: 'title', icon: '🍗', price: 300, tag: 'chicken', name: { th: 'คลั่งไก่ทอด', en: 'Fried Chicken Fanatic' }, desc: { th: 'พร้อมสู้ตายเพื่อชิงน่องไก่ทอดกรอบ', en: 'Will risk explosions for crispy drumsticks' } },
    { id: 'title_cyber_overlord', type: 'title', icon: '🤖', price: 1200, tag: 'cyber', name: { th: 'จอมทัพไซเบอร์', en: 'Cyber Overlord' }, desc: { th: 'คำนวณความน่าจะเป็นระเบิดด้วย AI ขั้นสูง', en: 'Calculates bomb probabilities with AI' } }
  ];

  // Shop catalog (Avatars, Frames, Titles, Card Backs, Stickers)
  const SHOP = [
    // Avatars
    ...AVATARS,

    // Titles / Ranks (ยศ & ฉายา)
    ...TITLES.filter(t => t.price > 0),

    // Frames (รวมกรอบสุดหรู)
    { id: 'frame_gold', type: 'frame', price: 300, icon: '🥇', name: { th: 'กรอบทองคำ 24K', en: 'Gold VIP Frame' }, desc: { th: 'ประกายทองคำแท้ 24K หรูหรา', en: 'Shining 24K metallic gold border' } },
    { id: 'frame_neon', type: 'frame', price: 500, icon: '💡', name: { th: 'กรอบนีออนไซเบอร์', en: 'Neon Cyber Frame' }, desc: { th: 'แสงไฟนีออนฟ้า-ชมพูสะท้อนมืด', en: 'Glowing cyan & magenta neon lights' } },
    { id: 'frame_fire', type: 'frame', price: 800, icon: '🔥', name: { th: 'กรอบเพลิงบรรลัยกัลป์', en: 'Inferno Fire Frame' }, desc: { th: 'เปลวเพลิงลุกโชนสะกดทุกสายตา', en: 'Blazing animated fire aura' } },
    { id: 'frame_rainbow', type: 'frame', price: 1200, icon: '🌈', name: { th: 'กรอบสายรุ้งออโรร่า', en: 'Aurora Rainbow Frame' }, desc: { th: 'สายรุ้งเรืองแสงเปลี่ยนสี 360 องศา', en: 'Shifting dynamic rainbow spectrum' } },
    { id: 'frame_diamond', type: 'frame', price: 1500, icon: '💎', name: { th: 'กรอบไดมอนด์ราชันย์', en: 'Imperial Diamond Frame' }, desc: { th: 'เพชรคริสตัลเหลี่ยมสะท้อนแสงวิบวับ', en: 'Prismatic crystal diamond facets' } },
    { id: 'frame_cyber', type: 'frame', price: 950, icon: '⚡', name: { th: 'กรอบไซเบอร์เนติก', en: 'Cybernetic Pulse Frame' }, desc: { th: 'วงจรอิเล็กทรอนิกส์พัลส์สีเขียวมรกต', en: 'Futuristic pulsing matrix circuits' } },
    { id: 'frame_sakura', type: 'frame', price: 650, icon: '🌸', name: { th: 'กรอบกลีบซากุระพริ้ว', en: 'Sakura Petal Frame' }, desc: { th: 'กลีบดอกซากุระชมพูทองหวานละมุน', en: 'Falling cherry blossom petals' } },
    { id: 'frame_abyss', type: 'frame', price: 1100, icon: '🔮', name: { th: 'กรอบมนตรามิติหลุมดำ', en: 'Dark Nebula Void Frame' }, desc: { th: 'มิติมนตราสีม่วงลึกลับแห่งความมืด', en: 'Swirling purple cosmic nebula' } },

    // Card Back Skins (รวมหลังไพ่สุดอลังการ)
    { id: 'skin_galaxy', type: 'skin', price: 400, icon: '🌌', name: { th: 'หลังไพ่กาแล็กซี่จักรวาล', en: 'Galaxy Cosmic Card Back' }, desc: { th: 'หมู่ดาวและเนบิวลาสีม่วงเข้ม', en: 'Deep nebula space with starry dust' } },
    { id: 'skin_sakura', type: 'skin', price: 400, icon: '🌸', name: { th: 'หลังไพ่ซากุระญี่ปุ่น', en: 'Sakura Blossom Card Back' }, desc: { th: 'ซากุระผลิบานสไตล์ญี่ปุ่นโบราณ', en: 'Gentle cherry blossom gradient' } },
    { id: 'skin_gold', type: 'skin', price: 900, icon: '👑', name: { th: 'หลังไพ่ราชาหมาทองคำ', en: 'Royal Pup Gold Back' }, desc: { th: 'แผ่นทองคำบริสุทธิ์พร้อมตรามงกุฎ', en: '24K gold foil & royal crown emblem' } },
    { id: 'skin_matrix', type: 'skin', price: 700, icon: '🟩', name: { th: 'หลังไพ่แมทริกซ์ดิจิทัล', en: 'Matrix Digital Code Back' }, desc: { th: 'สายธารโค้ดดิจิทัลสีเขียวนีออน', en: 'Terminal digital phosphor code' } },
    { id: 'skin_diamond', type: 'skin', price: 1000, icon: '💎', name: { th: 'หลังไพ่คริสตัลไดมอนด์', en: 'Crystal Diamond Back' }, desc: { th: 'ลวดลายเพชรสะท้อนแสงทรงปริซึม', en: 'Geometric faceted diamond crystal' } },
    { id: 'skin_dragon', type: 'skin', price: 1200, icon: '🐉', name: { th: 'หลังไพ่มังกรเพลิงโบราณ', en: 'Ancient Fire Dragon' }, desc: { th: 'เกล็ดมังกรสีชาดพร้อมตรามังกรทอง', en: 'Crimson dragon scales & gold dragon' } },
    { id: 'skin_cyber', type: 'skin', price: 800, icon: '⚡', name: { th: 'หลังไพ่ไซเบอร์ไฮเปอร์', en: 'Hyper Cyberpunk Grid' }, desc: { th: 'ตารางเลเซอร์ไซเบอร์พังก์ยุค 2077', en: 'Synthwave cyber neon laser grid' } },

    // Stickers
    { id: 'st_laugh', type: 'sticker', price: 100, icon: '😂', label: 'UH OH!', name: { th: 'ขำกลิ้ง (UH OH!)', en: 'UH OH! Laugh' } },
    { id: 'st_cry', type: 'sticker', price: 100, icon: '😭', label: 'NOOO!', name: { th: 'ม่ายยย (NOOO!)', en: 'NOOO! Cry' } },
    { id: 'st_angry', type: 'sticker', price: 150, icon: '🐺', label: 'GRRR!', name: { th: 'หมาแยกเขี้ยว', en: 'Growl Dog' } },
    { id: 'st_love', type: 'sticker', price: 150, icon: '🦴', label: 'YUMMY!', name: { th: 'แทะกระดูก', en: 'Yummy Bone' } },
    { id: 'st_boom', type: 'sticker', price: 200, icon: '💥', label: 'BOOM!', name: { th: 'ตูม!', en: 'BOOM!' } },
    { id: 'st_money', type: 'sticker', price: 250, icon: '🤑', label: 'VIP!', name: { th: 'รวยแล้วโฮ่ง', en: 'Rich Pup!' } },
    { id: 'st_crown', type: 'sticker', price: 300, icon: '👑', label: 'ALPHA!', name: { th: 'จ่าฝูง', en: 'Alpha Dog' } },
    { id: 'st_ghost', type: 'sticker', price: 200, icon: '👻', label: 'RIP!', name: { th: 'วิญญาณตูบ', en: 'Ghost Pup' } }
  ];

  // Gacha Pool (สุ่มของลิมิเต็ดด้วยเพชร 💎)
  const GACHA_POOL = {
    UR: [
      { id: 'title_god_doge', type: 'title', icon: '👑', name: { th: 'ยศ: เทพสุริยันจ่าฝูง', en: 'Title: Celestial God Doge' }, tier: 'UR', desc: { th: 'ยศเกียรติยศสูงสุดระดับเทพเจ้า ส่องแสงรัศมีรุ้ง', en: 'Supreme celestial rainbow title badge' } },
      { id: 'av_god_shiba', type: 'avatar', icon: '👑', name: { th: 'เทพชิบะ สุริยันเทวะ 24K', en: 'Sun God Doge 24K' }, tier: 'UR', desc: { th: 'รัศมีสุริยันสีทองเจิดจ้า ระดับลิมิเต็ดสูงสุด', en: 'Celestial glowing golden solar aura' } },
      { id: 'frame_celestial_dragon', type: 'frame', icon: '🐉', name: { th: 'กรอบมังกรดาราจักร', en: 'Celestial Dragon Frame' }, tier: 'UR', desc: { th: 'มังกรทองล้อมกรอบพร้อมละอองดาวเรืองแสง', en: 'Golden dragon swirling starry halo' } },
      { id: 'skin_cosmic_void', type: 'skin', icon: '🌌', name: { th: 'หลังไพ่มิติหลุมดำคอสมิก', en: 'Cosmic Void 3D Back' }, tier: 'UR', desc: { th: 'มิติหลุมดำสะท้อนแสงโฮโลแกรมลึกไร้ก้นบึ้ง', en: 'Deep void 3D holographic stars' } }
    ],
    SSR: [
      { id: 'title_alpha_titan', type: 'title', icon: '⚡', name: { th: 'ยศ: ไททันอัลฟ่า', en: 'Title: Titan Alpha' }, tier: 'SSR', desc: { th: 'ยศสายฟ้าคำรามแห่งกองทัพหุ่นรบ', en: 'Crackling lightning mecha title' } },
      { id: 'av_mecha_alpha', type: 'avatar', icon: '🤖', name: { th: 'เมคาอัลฟ่าไททัน', en: 'Mecha Alpha Titan' }, tier: 'SSR', desc: { th: 'หุ่นรบไซเบอร์สุดแกร่งเกราะไททาเนียม', en: 'Titan mecha robotic combat armor' } },
      { id: 'frame_lightning_god', type: 'frame', icon: '⚡', name: { th: 'กรอบอัสนีบาตราชา', en: 'Thunder God Frame' }, tier: 'SSR', desc: { th: 'ประกายสายฟ้าฟาดต่อเนื่องสีฟ้าคราม', en: 'Crackling electric blue lightning' } },
      { id: 'av_diamond_poodle', type: 'avatar', icon: '🐩', name: { th: 'พุดเดิ้ล ไดมอนด์ควีน', en: 'Diamond Queen Poodle' }, tier: 'SSR' },
      { id: 'frame_diamond', type: 'frame', icon: '💎', name: { th: 'กรอบไดมอนด์ราชันย์', en: 'Imperial Diamond Frame' }, tier: 'SSR' },
      { id: 'skin_dragon', type: 'skin', icon: '🐉', name: { th: 'หลังไพ่มังกรเพลิงโบราณ', en: 'Ancient Fire Dragon' }, tier: 'SSR' },
      { id: 'frame_rainbow', type: 'frame', icon: '🌈', name: { th: 'กรอบสายรุ้งออโรร่า', en: 'Rainbow Frame' }, tier: 'SSR' }
    ],
    SR: [
      { id: 'av_blaze_bulldog', type: 'avatar', icon: '🦮', name: { th: 'บูลด็อก เพลิงนรก', en: 'Blaze Bulldog' }, tier: 'SR' },
      { id: 'av_samurai_akita', type: 'avatar', icon: '🐕‍🦺', name: { th: 'อาคิตะ ซามูไรทองคำ', en: 'Samurai Doge' }, tier: 'SR' },
      { id: 'av_cyber_husky', type: 'avatar', icon: '🐺', name: { th: 'ไซเบอร์ฮัสกี้ ไฮเทค', en: 'Cyber Mecha Husky' }, tier: 'SR' },
      { id: 'frame_fire', type: 'frame', icon: '🔥', name: { th: 'กรอบเพลิงบรรลัยกัลป์', en: 'Fire Frame' }, tier: 'SR' },
      { id: 'skin_gold', type: 'skin', icon: '👑', name: { th: 'หลังไพ่ราชาหมาทองคำ', en: 'Royal Pup Gold' }, tier: 'SR' },
      { id: 'skin_matrix', type: 'skin', icon: '🟩', name: { th: 'หลังไพ่แมทริกซ์ดิจิทัล', en: 'Matrix Card Back' }, tier: 'SR' },
      { id: 'skin_galaxy', type: 'skin', icon: '🌌', name: { th: 'หลังไพ่กาแล็กซี่จักรวาล', en: 'Galaxy Card Back' }, tier: 'SR' }
    ],
    R: [
      { id: 'coins_1000', type: 'coins', amount: 1000, icon: '💰', name: { th: 'หีบเหรียญทองยักษ์ (+1,000)', en: 'Huge Coin Chest (+1,000)' }, tier: 'R' },
      { id: 'coins_500', type: 'coins', amount: 500, icon: '🪙', name: { th: 'ถุงเหรียญทองโต (+500)', en: 'Big Coin Pouch (+500)' }, tier: 'R' },
      { id: 'coins_300', type: 'coins', amount: 300, icon: '🪙', name: { th: 'เหรียญทองนำโชค (+300)', en: 'Lucky Coins (+300)' }, tier: 'R' }
    ]
  };
  const FREE_STICKERS = [
    { id: 'st_nooo', icon: '😭', label: 'NOOO!' },
    { id: 'st_uhoh', icon: '😂', label: 'UH OH!' },
    { id: 'st_wave', icon: '🐾', label: 'WOOF!' },
    { id: 'st_ok', icon: '🦴', label: 'NICE!' },
    { id: 'st_cat', icon: '🐶', label: 'HEHE!' }
  ];

  const RANKS = [
    { min: 0, id: 'bronze', icon: '🥉', name: { th: 'บรอนซ์', en: 'Bronze' } },
    { min: 100, id: 'silver', icon: '🥈', name: { th: 'ซิลเวอร์', en: 'Silver' } },
    { min: 300, id: 'gold', icon: '🥇', name: { th: 'โกลด์', en: 'Gold' } },
    { min: 600, id: 'platinum', icon: '💠', name: { th: 'แพลทินัม', en: 'Platinum' } },
    { min: 1000, id: 'diamond', icon: '💎', name: { th: 'ไดมอนด์', en: 'Diamond' } },
    { min: 1600, id: 'master', icon: '🏆', name: { th: 'จ่าฝูงมาสเตอร์', en: 'Alpha Master' } }
  ];
  const STAKES = {
    casual:   { id: 'casual',   icon: '🟢', name: { th: 'ฝึกหัด (ชิลล์)', en: 'Casual (Free)' }, coins: 0, diamonds: 0, mult: 1, desc: { th: 'ไม่มีค่าเดิมพัน เล่นชิลล์รับรางวัลปกติ', en: 'No entry fee, standard rewards' } },
    standard: { id: 'standard', icon: '🟡', name: { th: 'มาตรฐาน (Standard)', en: 'Standard' }, coins: 100, diamonds: 0, mult: 2, desc: { th: 'เดิมพัน 100 🪙 • ผู้ชนะรับรางวัล x2', en: 'Bet 100 coins, winner takes x2' } },
    high:     { id: 'high',     icon: '🔴', name: { th: 'เซียนไฮโรลเลอร์ (High Stakes)', en: 'High Stakes' }, coins: 300, diamonds: 2, mult: 5, desc: { th: 'เดิมพัน 300 🪙 + 2 💎 • กวาดรางวัลใหญ่ x5!', en: 'Bet 300 coins + 2 gems, win x5 reward!' } },
    vip:      { id: 'vip',      icon: '👑', name: { th: 'VIP มหาเศรษฐี (High Roller)', en: 'VIP High Roller' }, coins: 1000, diamonds: 10, mult: 10, desc: { th: 'เดิมพัน 1,000 🪙 + 10 💎 • รางวัลมหาศาล x10!', en: 'Bet 1,000 coins + 10 gems, massive x10 pool!' } }
  };

  const CARD_KINDS = {
    bomb:     { id: 'bomb',     icon: '💣', name: { th: 'หมาระเบิด', en: 'Bomb' } },
    defense:  { id: 'defense',  icon: '🛠️', name: { th: 'กู้ระเบิด', en: 'Defuse' } },
    action:   { id: 'action',   icon: '⚡', name: { th: 'แอคชัน',   en: 'Action' } },
    reaction: { id: 'reaction', icon: '🛑', name: { th: 'ตอบโต้',   en: 'Reaction' } },
    cat:      { id: 'cat',      icon: '🐾', name: { th: 'แก๊งหมา',   en: 'Combo' } },
    special:  { id: 'special',  icon: '✨', name: { th: 'พิเศษ',    en: 'Special' } }
  };
  function rankOf(rp) { let r = RANKS[0]; for (const x of RANKS) if (rp >= x.min) r = x; return r; }

  return { CARDS, VERSIONS, CONFIGURABLE, SHOP, FREE_STICKERS, RANKS, CARD_KINDS, AVATARS, GACHA_POOL, TITLES, STAKES, rankOf };
});
