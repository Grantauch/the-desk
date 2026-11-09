/* Blacktop Kings — data: ratings, the legends, crews, courts, the circuit, and the locker.
   Plain data only. Every player, crew, court, and logo here is made up. No real players, leagues,
   teams, or marks. Some legends play a little like somebody you might have seen on TV. That's it. */
(function (BK) {
  'use strict';
  const D = BK.data = {};

  D.SAVE_VERSION = 1;
  D.MAX_STAT = 10;
  D.MAX_LEVEL = 30;

  D.STATS = [
    { key: 'spd', name: 'Speed', short: 'SPD', blurb: 'Foot speed, and how long the turbo lasts.' },
    { key: 'hnd', name: 'Handles', short: 'HND', blurb: 'Tricks land cleaner, defenders fall harder, steals bounce off.' },
    { key: 'ins', name: 'Inside', short: 'INS', blurb: 'Layups, floaters, and anything inside the arc.' },
    { key: 'out', name: 'Deep', short: 'DEP', blurb: 'Two-pointers from outside the arc.' },
    { key: 'dnk', name: 'Dunking', short: 'DNK', blurb: 'How far out you can take off, and how loud it gets.' },
    { key: 'pas', name: 'Passing', short: 'PAS', blurb: 'Faster passes and alley-oops that find hands.' },
    { key: 'reb', name: 'Rebounding', short: 'REB', blurb: 'Who comes down with the miss.' },
    { key: 'blk', name: 'Blocking', short: 'BLK', blurb: 'Timing, reach, and how far the ball travels after.' },
    { key: 'stl', name: 'Stealing', short: 'STL', blurb: 'Quick hands on the dribble and in the passing lane.' },
  ];
  D.STAT_KEYS = D.STATS.map((s) => s.key);

  D.ARCHETYPES = {
    slasher: { name: 'Slasher', blurb: 'Gets to the rim and stays there.', base: { spd: 6, hnd: 4, ins: 5, out: 2, dnk: 6, pas: 3, reb: 3, blk: 3, stl: 4 } },
    sniper: { name: 'Sniper', blurb: 'Lives behind the arc. Twos all day.', base: { spd: 5, hnd: 4, ins: 4, out: 7, dnk: 2, pas: 4, reb: 3, blk: 2, stl: 5 } },
    general: { name: 'Floor General', blurb: 'Sees the oop before it exists.', base: { spd: 5, hnd: 6, ins: 4, out: 5, dnk: 2, pas: 7, reb: 2, blk: 2, stl: 3 } },
    trickster: { name: 'Trickster', blurb: 'Ankles are a suggestion.', base: { spd: 6, hnd: 7, ins: 6, out: 6, dnk: 3, pas: 3, reb: 2, blk: 1, stl: 2 } },
    big: { name: 'Big', blurb: 'The paint is rented. You own it.', base: { spd: 3, hnd: 2, ins: 5, out: 4, dnk: 5, pas: 5, reb: 5, blk: 5, stl: 2 } },
  };

  // Upgrade cost to go from `v` to `v + 1`.
  D.upgradeCost = (v) => (v < 6 ? 1 : v < 8 ? 2 : v < 9 ? 3 : 4);
  // REP needed to go from `lvl` to `lvl + 1`.
  D.repForLevel = (lvl) => 220 + lvl * 90;
  D.POINTS_PER_LEVEL = 3;

  // ---------- the locker: everything you can wear ----------
  D.SKIN = ['#fde3cf', '#f3c9a5', '#e5b088', '#d39a6a', '#bf8456', '#a86b3c', '#8d5524', '#6f4220', '#573218', '#3d2412', '#2a190d'];
  D.COLORS = [
    '#ffffff', '#f2f2f2', '#b9bec7', '#5d6470', '#1e2128', '#0b0b0d',
    '#e8352b', '#b5121b', '#ff6a13', '#ffb300', '#ffe14d', '#c9b26b',
    '#3fd13f', '#0f8a4b', '#14b8a6', '#2ec5ff', '#1f6feb', '#1a2f8f',
    '#7b2ff7', '#4b1d8f', '#ff3ea5', '#b0124f', '#7a4a2a', '#f5deb3',
  ];
  // Colors that cost cred. Gold and chrome glow a little in the game.
  D.PREMIUM_COLORS = [
    { id: '#ffd23f', name: 'Crown gold', cost: 600 },
    { id: '#d8e2ec', name: 'Chrome', cost: 600 },
    { id: '#39ff14', name: 'Radioactive', cost: 400 },
    { id: '#ff00e6', name: 'Arcade magenta', cost: 400 },
  ];
  D.HAIR_COLORS = ['#141010', '#2b1d14', '#4a2f1d', '#7a4a2a', '#a8642f', '#c98a3b', '#e8c46e', '#f3e5b5', '#d8d8d8', '#8f2a1a', '#2ec5ff', '#ff3ea5', '#3fd13f', '#7b2ff7', '#ff6a13'];

  const opt = (id, name, extra) => Object.assign({ id, name }, extra || {});
  D.LOOK = {
    hair: [
      opt('bald', 'Bald'), opt('buzz', 'Buzz'), opt('fade', 'Fade'), opt('waves', 'Waves'), opt('curly', 'Curly top'),
      opt('flattop', 'Flat top', { lvl: 2 }), opt('afro', 'Afro'), opt('bigfro', 'Big afro', { lvl: 6 }), opt('cornrows', 'Cornrows'),
      opt('locs', 'Locs'), opt('twists', 'Twists'), opt('mohawk', 'Mohawk', { cost: 250 }), opt('spiky', 'Spikes', { cost: 250 }),
      opt('ponytail', 'Ponytail'), opt('bun', 'Top bun'), opt('long', 'Long'), opt('shaggy', 'Shaggy'), opt('mullet', 'Mullet', { cost: 300 }),
    ],
    facial: [
      opt('none', 'Clean'), opt('stubble', 'Stubble'), opt('mustache', 'Mustache'), opt('goatee', 'Goatee'),
      opt('chinstrap', 'Chinstrap'), opt('beard', 'Full beard'), opt('bigbeard', 'Big beard', { lvl: 4 }),
    ],
    brows: [opt('normal', 'Normal'), opt('thick', 'Thick'), opt('angry', 'Locked in'), opt('raised', 'Unbothered')],
    eyes: [opt('normal', 'Normal'), opt('focused', 'Focused'), opt('sleepy', 'Sleepy'), opt('wide', 'Wide')],
    mouth: [opt('flat', 'Flat'), opt('smile', 'Smile'), opt('grin', 'Big grin'), opt('tongue', 'Tongue out', { lvl: 5 }), opt('guard', 'Mouthguard', { lvl: 3 }), opt('snarl', 'Snarl')],
    headband: [opt('none', 'None'), opt('band', 'Headband'), opt('wide', 'Wide band', { lvl: 2 }), opt('bandana', 'Bandana', { cost: 150 }), opt('ninja', 'Tied band', { cost: 300 })],
    eyewear: [opt('none', 'None'), opt('goggles', 'Goggles', { lvl: 4 }), opt('shades', 'Shades', { cost: 350 }), opt('visor', 'Glow visor', { lvl: 12 })],
    armSleeve: [opt('none', 'None'), opt('right', 'Right arm'), opt('left', 'Left arm'), opt('both', 'Both arms', { cost: 150 })],
    kneeSleeve: [opt('none', 'None'), opt('right', 'Right knee'), opt('left', 'Left knee'), opt('both', 'Both knees')],
    wristbands: [opt('none', 'None'), opt('one', 'One wrist'), opt('both', 'Both wrists')],
    socks: [opt('low', 'Ankle'), opt('crew', 'Crew'), opt('tall', 'Tall'), opt('stripes', 'Tall stripes', { lvl: 3 })],
    shoes: [opt('high', 'High tops'), opt('low', 'Low tops'), opt('mid', 'Mids'), opt('glow', 'Light-ups', { cost: 500 })],
    chain: [opt('none', 'None'), opt('silver', 'Silver chain', { cost: 200 }), opt('gold', 'Gold chain', { cost: 450 }), opt('crown', 'Crown pendant', { lvl: 15 })],
    tattoo: [opt('none', 'None'), opt('band', 'Arm band'), opt('forearm', 'Forearm'), opt('sleeve', 'Full sleeve', { lvl: 7 })],
    jersey: [opt('tank', 'Tank'), opt('tee', 'Tee'), opt('throwback', 'Throwback trim', { lvl: 3 }), opt('hoodie', 'Sleeveless hoodie', { cost: 400 }), opt('mesh', 'Practice mesh')],
    shorts: [opt('short', 'Short shorts', { cost: 200 }), opt('mid', 'Regular'), opt('long', 'Long'), opt('baggy', 'Baggy', { lvl: 2 })],
    aura: [opt('none', 'None'), opt('embers', 'Embers', { lvl: 8 }), opt('static', 'Static', { lvl: 11 }), opt('frost', 'Frost', { cost: 900 }), opt('royal', 'Royal', { lvl: 20 })],
    trail: [opt('none', 'None'), opt('fire', 'Fire trail', { lvl: 6 }), opt('comet', 'Comet trail', { cost: 700 }), opt('rainbow', 'Rainbow trail', { lvl: 16 }), opt('lightning', 'Lightning trail', { cost: 1200 })],
  };
  D.LOOK_LABELS = {
    hair: 'Hair', facial: 'Facial hair', brows: 'Brows', eyes: 'Eyes', mouth: 'Mouth', headband: 'Headwear', eyewear: 'Eyewear',
    armSleeve: 'Arm sleeve', kneeSleeve: 'Knee sleeve', wristbands: 'Wristbands', socks: 'Socks', shoes: 'Shoes', chain: 'Chain',
    tattoo: 'Ink', jersey: 'Jersey cut', shorts: 'Shorts', aura: 'Aura', trail: 'Ball trail',
  };

  D.CELEBRATIONS = [
    opt('flex', 'The Flex'), opt('chest', 'Chest Pound'), opt('shush', 'Shush the Crowd'), opt('roof', 'Raise the Roof'),
    opt('point', 'Point to the Sky', { lvl: 2 }), opt('shoulders', 'Brush the Shoulders', { lvl: 4 }), opt('dance', 'Two-Step', { cost: 300 }),
    opt('crown', 'Crown Yourself', { lvl: 10 }), opt('lock', 'Lock-In', { cost: 500 }),
  ];

  // Signature dunks. Big dunkers pick from these in the air; the signature shows up most.
  D.DUNKS = {
    twohand: { name: 'Two-Hand Hammer', style: 120, hang: 0.62 },
    tomahawk: { name: 'Tomahawk', style: 160, hang: 0.66 },
    reverse: { name: 'Reverse Jam', style: 200, hang: 0.7, lvl: 3 },
    windmill: { name: 'Windmill', style: 260, hang: 0.78, lvl: 5 },
    cradle: { name: 'Cradle Rock', style: 300, hang: 0.82, lvl: 8 },
    spin360: { name: '360 Slam', style: 360, hang: 0.86, lvl: 10 },
    legs: { name: 'Through the Legs', style: 420, hang: 0.9, lvl: 14 },
    eclipse: { name: 'Total Eclipse', style: 520, hang: 1.0, lvl: 22 },
  };
  D.DUNK_ORDER = ['twohand', 'tomahawk', 'reverse', 'windmill', 'cradle', 'spin360', 'legs', 'eclipse'];

  // Tricks. Direction is relative to the basket: fwd toward it, back away, side across the court.
  // Hold turbo for the flashy version. pts: style points. beat: chance to shake the defender.
  D.TRICKS = {
    hesi: { name: 'Hesitation', dur: 0.42, pts: 60, beat: 0.25, path: 'hesi' },
    cross: { name: 'Crossover', dur: 0.46, pts: 90, beat: 0.35, path: 'cross' },
    legs: { name: 'Between the Legs', dur: 0.5, pts: 110, beat: 0.35, path: 'legs' },
    behind: { name: 'Behind the Back', dur: 0.5, pts: 120, beat: 0.4, path: 'behind' },
    spin: { name: 'Spin Move', dur: 0.55, pts: 140, beat: 0.45, path: 'spin', move: 7 },
    world: { name: 'Around the World', dur: 0.8, pts: 260, beat: 0.5, path: 'world', flashy: true },
    head: { name: 'Head Bounce', dur: 0.75, pts: 280, beat: 0.45, path: 'head', flashy: true },
    tornado: { name: 'Tornado Spin', dur: 0.75, pts: 300, beat: 0.6, path: 'tornado', move: 9, flashy: true },
    dome: { name: 'Off the Dome', dur: 0.85, pts: 420, beat: 0.75, path: 'dome', flashy: true, needsDefender: true },
    juggle: { name: 'Showtime Juggle', dur: 0.8, pts: 240, beat: 0.3, path: 'juggle', flashy: true },
  };
  D.TRICK_BY_DIR = {
    none: ['hesi', 'dome'], side: ['cross', 'world'], fwd: ['spin', 'tornado'], back: ['behind', 'head'],
  };

  // ---------- the legends ----------
  // r: ratings 1-10. hgt: inches. Looks are drawn from these fields; nothing here is a photo.
  const L = (id, first, last, nick, num, arch, hgt, build, r, look, extra) =>
    Object.assign({ id, first, last, nick, num, arch, hgt, build, r, look, legend: true }, extra || {});
  const R = (spd, hnd, ins, out, dnk, pas, reb, blk, stl) => ({ spd, hnd, ins, out, dnk, pas, reb, blk, stl });

  D.LEGENDS = [
    L('pogo', 'Tater', 'Rollins', 'Pogo', 4, 'slasher', 67, 'lean', R(9, 7, 8, 4, 8, 6, 5, 2, 7),
      { skin: '#6f4220', hair: 'fade', mouth: 'grin', socks: 'crew', wristbands: 'both' }, { dunk: 'windmill', bio: 'Five-seven. Dunks on everybody. Asks about it later.' }),
    L('farmboy', 'Clay', 'Lindqvist', 'Farm Boy', 33, 'sniper', 81, 'athletic', R(5, 6, 8, 9, 4, 8, 7, 4, 6),
      { skin: '#f3c9a5', hair: 'shaggy', hairColor: '#c98a3b', facial: 'mustache', mouth: 'flat', socks: 'tall' }, { dunk: 'twohand', bio: 'Tells you where the shot is going. Hits it anyway.' }),
    L('tiedye', 'Sky', 'Waldron', 'Tie-Dye', 32, 'big', 83, 'athletic', R(6, 5, 8, 3, 6, 8, 9, 8, 4),
      { skin: '#fde3cf', hair: 'long', hairColor: '#a8642f', facial: 'beard', headband: 'band', headbandColor: '#ff3ea5' }, { dunk: 'twohand', bio: 'Outlet passes like postcards. Never wears the same shirt twice.' }),
    L('flamingo', 'Dieter', 'Nowak', 'Flamingo', 41, 'sniper', 84, 'lean', R(4, 5, 8, 9, 4, 5, 7, 5, 3),
      { skin: '#f3c9a5', hair: 'shaggy', hairColor: '#e8c46e', facial: 'goatee' }, { dunk: 'twohand', bio: 'One leg up, falling away, all net. Do not bother contesting.' }),
    L('chokesign', 'Rex', 'Mueller', 'Choke Sign', 31, 'sniper', 79, 'lean', R(6, 5, 5, 9, 3, 5, 3, 3, 5),
      { skin: '#e5b088', hair: 'buzz', hairColor: '#2b1d14', mouth: 'smile', brows: 'raised' }, { dunk: 'twohand', bio: 'Talks to the crowd. Mostly while it boos him.' }),
    L('question', 'Q', 'Avery', 'The Question', 3, 'trickster', 72, 'lean', R(10, 10, 7, 7, 6, 6, 3, 2, 9),
      { skin: '#573218', hair: 'cornrows', armSleeve: 'right', sleeveColor: '#ffffff', tattoo: 'sleeve', headband: 'band', headbandColor: '#ffffff', wristbands: 'one' }, { dunk: 'tomahawk', bio: 'The crossover has a reputation. The reputation is accurate.' }),
    L('sixshooter', 'Rocco', 'Marchetti', 'Six-Shooter', 7, 'trickster', 77, 'lean', R(7, 10, 6, 8, 3, 9, 3, 2, 6),
      { skin: '#f3c9a5', hair: 'shaggy', hairColor: '#4a2f1d', socks: 'stripes', sockColor: '#ffffff' }, { dunk: 'twohand', bio: 'Floppy socks, floppy hair, passes you will see on the replay only.' }),
    L('liftoff', 'Corey', 'Banks', 'Lift Off', 15, 'slasher', 78, 'athletic', R(8, 7, 7, 7, 10, 5, 5, 5, 5),
      { skin: '#6f4220', hair: 'buzz', facial: 'goatee', armSleeve: 'left', sleeveColor: '#1e2128' }, { dunk: 'spin360', bio: 'Hung his elbow on the rim once. People still talk about it.' }),
    L('downtown', 'Sonny', 'Ruiz', 'From Downtown', 30, 'sniper', 74, 'lean', R(8, 9, 7, 10, 3, 7, 4, 2, 6),
      { skin: '#d39a6a', hair: 'curly', hairColor: '#2b1d14', mouth: 'guard' }, { dunk: 'twohand', bio: 'Shoots from the parking lot. Turns around before it goes in.' }),
    L('longstrides', 'Stelios', 'Papadakis', 'Long Strides', 34, 'slasher', 83, 'athletic', R(8, 6, 9, 3, 10, 6, 8, 7, 5),
      { skin: '#6f4220', hair: 'buzz', facial: 'beard' }, { dunk: 'tomahawk', bio: 'Three dribbles from half court. Two of them were extra.' }),
    L('static', 'Flip', 'Delgado', 'Static', 91, 'big', 79, 'strong', R(6, 3, 4, 2, 5, 4, 10, 7, 7),
      { skin: '#6f4220', hair: 'buzz', hairColor: '#3fd13f', tattoo: 'sleeve', eyes: 'wide', chain: 'silver' }, { dunk: 'twohand', bio: 'New hair color every game. Every rebound is his.' }),
    L('mound', 'Moose', 'Baxter', 'The Mound', 34, 'big', 78, 'heavy', R(6, 5, 9, 4, 8, 6, 9, 5, 5),
      { skin: '#573218', hair: 'bald', facial: 'goatee', mouth: 'grin' }, { dunk: 'tomahawk', bio: 'Built like a mailbox. Jumps like it is personal.' }),
    L('upunder', 'Tunde', 'Adewale', 'Up-and-Under', 34, 'big', 84, 'athletic', R(6, 7, 10, 3, 7, 5, 9, 10, 7),
      { skin: '#3d2412', hair: 'flattop', facial: 'beard' }, { dunk: 'reverse', bio: 'Shows you the ball, shows you the other shoulder, shows you the scoreboard.' }),
    L('stableboy', 'Milo', 'Petrovic', 'Stable Boy', 15, 'general', 83, 'heavy', R(4, 7, 9, 7, 4, 10, 9, 5, 5),
      { skin: '#f3c9a5', hair: 'buzz', hairColor: '#4a2f1d', eyes: 'sleepy' }, { dunk: 'twohand', bio: 'Looks half asleep. Throws a no-look pass over three people.' }),
    L('bigcargo', 'Otis', 'Mabry', 'Big Cargo', 34, 'big', 85, 'heavy', R(4, 3, 10, 1, 10, 4, 10, 9, 3),
      { skin: '#3d2412', hair: 'bald', facial: 'goatee', mouth: 'grin' }, { dunk: 'eclipse', bio: 'Has torn down two backboards. Plans on a third.' }),
    L('coldfront', 'Glen', 'Garvey', 'Cold Front', 44, 'sniper', 79, 'lean', R(6, 7, 9, 8, 6, 5, 5, 4, 5),
      { skin: '#573218', hair: 'afro', facial: 'mustache', eyes: 'sleepy' }, { dunk: 'cradle', bio: 'Finger roll from the free throw line. Never breaks a sweat.' }),
    L('copperhead', 'Kai', 'Morrow', 'Copperhead', 24, 'slasher', 78, 'athletic', R(8, 9, 9, 8, 9, 5, 5, 5, 7),
      { skin: '#6f4220', hair: 'buzz', armSleeve: 'right', sleeveColor: '#0b0b0d', brows: 'angry', mouth: 'snarl' }, { dunk: 'reverse', bio: 'Fadeaway over two people. Then a look. Then another fadeaway.' }),
    L('martian', 'Lucien', 'Duval', 'The Martian', 1, 'big', 88, 'lean', R(6, 6, 8, 7, 9, 5, 9, 10, 6),
      { skin: '#e5b088', hair: 'twists', hairColor: '#2b1d14' }, { dunk: 'windmill', bio: 'Eight feet of elbows. Blocks shots that have not been taken yet.' }),
    L('textbook', 'Theo', 'Quinn', 'The Textbook', 21, 'big', 83, 'strong', R(5, 4, 10, 5, 6, 6, 10, 9, 4),
      { skin: '#573218', hair: 'buzz', eyes: 'sleepy' }, { dunk: 'twohand', bio: 'Bank shot. Bank shot. Bank shot. Championship.' }),
    L('boxoffice', 'Grady', 'Kent', 'Box Office', 5, 'big', 83, 'lean', R(7, 5, 9, 6, 8, 6, 9, 9, 6),
      { skin: '#6f4220', hair: 'buzz', facial: 'goatee', brows: 'angry', mouth: 'snarl' }, { dunk: 'tomahawk', bio: 'Yells at the rim before he dunks on it.' }),
    L('throwdown', 'Lena', 'Lyle', 'Throwdown', 9, 'big', 77, 'athletic', R(7, 5, 9, 5, 7, 6, 8, 9, 5),
      { skin: '#573218', hair: 'ponytail', hairColor: '#141010', mouth: 'smile', wristbands: 'both' }, { dunk: 'tomahawk', bio: 'First one in her league to dunk. Will not let you forget it.' }),
    L('logo', 'Rae', 'Clarke', 'Logo', 22, 'sniper', 72, 'lean', R(8, 9, 7, 10, 2, 9, 4, 2, 6),
      { skin: '#fde3cf', hair: 'ponytail', hairColor: '#e8c46e', headband: 'band', headbandColor: '#141010' }, { dunk: 'twohand', bio: 'Pulls up from the center of the court. It is not a heat check. It is a habit.' }),
    L('nolook', 'Earl', 'Mason', 'No-Look', 32, 'general', 81, 'athletic', R(7, 9, 8, 6, 6, 10, 7, 4, 7),
      { skin: '#573218', hair: 'curly', mouth: 'grin' }, { dunk: 'twohand', bio: 'Smiles the whole game. Passes while looking at you.' }),
    L('surgeon', 'Elvin', 'Ward', 'The Surgeon', 6, 'slasher', 79, 'athletic', R(8, 7, 9, 5, 10, 6, 7, 6, 6),
      { skin: '#573218', hair: 'bigfro', facial: 'goatee', socks: 'tall' }, { dunk: 'cradle', bio: 'Takes off at the free throw line. Lands sometime later.' }),
    L('hookshot', 'Jabari', 'Wells', 'Hookshot', 33, 'big', 86, 'lean', R(5, 5, 10, 3, 7, 6, 9, 9, 4),
      { skin: '#3d2412', hair: 'bald', eyewear: 'goggles' }, { dunk: 'twohand', bio: 'One shot. Unblockable. Has been for twenty years.' }),
    L('twostories', 'Wendell', 'Chambers', 'Two Stories', 13, 'big', 85, 'strong', R(6, 4, 10, 3, 10, 5, 10, 10, 4),
      { skin: '#3d2412', hair: 'buzz', headband: 'band', headbandColor: '#ffffff', facial: 'goatee' }, { dunk: 'tomahawk', bio: 'Scored a hundred once, they say. Nobody has the tape.' }),
    L('chosenone', 'Lamont', 'Rivers', 'Chosen One', 23, 'slasher', 81, 'strong', R(9, 8, 10, 7, 10, 9, 8, 8, 7),
      { skin: '#573218', hair: 'buzz', facial: 'beard', headband: 'band', headbandColor: '#ffffff', armSleeve: 'left', sleeveColor: '#ffffff' }, { dunk: 'tomahawk', bio: 'A freight train that also reads the defense. Not fair.' }),
    L('hangtime', 'Darnell', 'Hollis', 'Hang Time', 32, 'slasher', 78, 'athletic', R(10, 9, 10, 8, 10, 7, 6, 7, 9),
      { skin: '#3d2412', hair: 'bald', mouth: 'tongue', wristbands: 'one', socks: 'crew' }, { dunk: 'legs', bio: 'Took off, and as far as anyone can tell, never came down.' }),
  ];
  D.LEGEND_BY_ID = Object.fromEntries(D.LEGENDS.map((p) => [p.id, p]));

  // ---------- generated locals ----------
  const FIRST = ['Andre', 'Bo', 'Cal', 'Dante', 'Eli', 'Flo', 'Gus', 'Hector', 'Ike', 'Jojo', 'Kev', 'Lou', 'Marco', 'Nico', 'Omar', 'Pete', 'Quan', 'Ray', 'Sal', 'Tre', 'Ulises', 'Vic', 'Wes', 'Xavi', 'Yusuf', 'Zeke', 'Benny', 'Darius', 'Mateo', 'Tavi', 'Jamal', 'Ricky', 'Dom', 'Tariq', 'Malik', 'Ozzie', 'Bryce', 'Kenji', 'Luis', 'Amari', 'Imani', 'Keisha', 'Rosa', 'Tasha', 'Jada', 'Mia', 'Nia', 'Gabi'];
  const LAST = ['Banks', 'Cole', 'Diaz', 'Ellis', 'Fuller', 'Grant', 'Hayes', 'Irving', 'Jett', 'Knox', 'Lowe', 'Mack', 'Nash', 'Ortiz', 'Pryor', 'Quarles', 'Reyes', 'Sims', 'Tate', 'Vance', 'Webb', 'Young', 'Price', 'Moss', 'Ford', 'Rios', 'Shaw', 'Burke', 'Cruz', 'Dunn', 'Pike', 'Hale', 'Bishop', 'Rollins', 'Okoro', 'Tanaka', 'Novak', 'Kowalski', 'Mendez', 'Harper'];
  const NICK = ['Slim', 'Boogie', 'Hammer', 'Smooth', 'Bones', 'Juice', 'Deuce', 'Sticks', 'Flash', 'Tank', 'Spider', 'Ice', 'Hops', 'Biscuit', 'Peanut', 'Hollywood', 'Scoop', 'Pockets', 'Lefty', 'Noodle', 'Turbo', 'Cash', 'Snacks', 'Dimes', 'Rocket', 'Glue', 'Pretzel', 'Moonwalk', 'Thunder', 'Static', 'Bucket', 'Sauce', 'Wheels', 'Chef', 'Stretch', 'Mayor', 'Grits', 'Sweets', 'Crutch', 'Boomer'];
  const FEMALE = new Set(['Imani', 'Keisha', 'Rosa', 'Tasha', 'Jada', 'Mia', 'Nia', 'Gabi', 'Flo']);
  const HAIRS_M = ['bald', 'buzz', 'fade', 'waves', 'curly', 'afro', 'cornrows', 'locs', 'twists', 'flattop', 'shaggy', 'long'];
  const HAIRS_F = ['ponytail', 'bun', 'locs', 'cornrows', 'twists', 'long', 'afro', 'curly'];

  // Small seeded generator so a court's crews are the same every visit.
  D.rng = function (seed) {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (Math.imul(s ^ seed.charCodeAt(i), 2654435761) + 0x9e3779b9) | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  D.genLocal = function (seed, tier, arch) {
    const rnd = D.rng(seed);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const first = pick(FIRST);
    const female = FEMALE.has(first);
    arch = arch || pick(Object.keys(D.ARCHETYPES));
    const base = D.ARCHETYPES[arch].base;
    const r = {};
    // Tier 1 locals sit a bit under a brand-new created player; tier 8 sit near legend level.
    const lift = -1.2 + tier * 0.72;
    D.STAT_KEYS.forEach((k) => { r[k] = Math.max(1, Math.min(10, Math.round(base[k] + lift + (rnd() * 2 - 1)))); });
    const hgt = arch === 'big' ? 79 + Math.floor(rnd() * 8) : arch === 'slasher' ? 74 + Math.floor(rnd() * 6) : 70 + Math.floor(rnd() * 8);
    const hair = female ? pick(HAIRS_F) : pick(HAIRS_M);
    const look = {
      skin: pick(D.SKIN), hair, hairColor: rnd() < 0.12 ? pick(D.HAIR_COLORS.slice(9)) : pick(D.HAIR_COLORS.slice(0, 9)),
      facial: female ? 'none' : pick(['none', 'none', 'stubble', 'goatee', 'mustache', 'beard', 'chinstrap']),
      brows: pick(['normal', 'thick', 'angry', 'raised']), eyes: pick(['normal', 'focused', 'sleepy', 'wide']),
      mouth: pick(['flat', 'smile', 'grin', 'flat', 'snarl']),
      headband: rnd() < 0.3 ? pick(['band', 'wide', 'bandana']) : 'none', headbandColor: pick(D.COLORS),
      armSleeve: rnd() < 0.25 ? pick(['left', 'right']) : 'none', sleeveColor: pick(['#ffffff', '#0b0b0d', '#1e2128']),
      kneeSleeve: rnd() < 0.2 ? pick(['left', 'right', 'both']) : 'none',
      wristbands: rnd() < 0.3 ? pick(['one', 'both']) : 'none',
      socks: pick(['low', 'crew', 'crew', 'tall']), shoes: pick(['high', 'low', 'mid']), shoeColor: pick(D.COLORS), shoeAccent: pick(D.COLORS),
      tattoo: rnd() < 0.2 ? pick(['band', 'forearm']) : 'none',
      jersey: pick(['tank', 'tank', 'tee', 'mesh']), shorts: pick(['mid', 'long', 'baggy']),
    };
    return {
      id: 'loc-' + seed, first, last: pick(LAST), nick: pick(NICK), num: 1 + Math.floor(rnd() * 55), arch, hgt: female ? hgt - 4 : hgt,
      build: arch === 'big' ? pick(['strong', 'heavy', 'athletic']) : pick(['lean', 'athletic', 'athletic', 'strong']),
      r, look, dunk: pick(D.DUNK_ORDER.slice(0, Math.min(7, 1 + tier))), local: true,
    };
  };

  // Starting crew for a new career: two friends from the block.
  D.STARTERS = [
    Object.assign(D.genLocal('starter-a', 1, 'general'), { id: 'starter-a', first: 'Dee', last: 'Marshall', nick: 'Dimes', num: 2, hgt: 73, local: false, starter: true }),
    Object.assign(D.genLocal('starter-b', 1, 'big'), { id: 'starter-b', first: 'Ray', last: 'Okoro', nick: 'Big Ray', num: 50, hgt: 81, local: false, starter: true }),
  ];
  D.STARTERS[0].look = Object.assign(D.STARTERS[0].look, { hair: 'waves', skin: '#8d5524', facial: 'none', headband: 'none', eyewear: 'none' });
  D.STARTERS[1].look = Object.assign(D.STARTERS[1].look, { hair: 'buzz', skin: '#573218', facial: 'beard', headband: 'none' });

  // ---------- courts and the circuit ----------
  // palette: sky gradient stops, ground around the court, court base, key paint, lines, crowd tint, accent lights.
  D.COURTS = [
    { id: 'lot', name: 'Lincoln Lot', where: 'Around the corner from your place', tier: 1, scene: 'lot',
      sky: ['#5fb3f0', '#a6d8f7', '#f7e7c4'], ground: '#5b5f63', court: '#3b3f45', key: '#9c3b2e', line: '#f2efe6', accent: '#ffb300', time: 'day' },
    { id: 'boardwalk', name: 'The Boardwalk', where: 'Sand in your shoes by the second quarter', tier: 2, scene: 'beach',
      sky: ['#3a2a6b', '#e2557a', '#ffb347'], ground: '#e8c98c', court: '#2f6fa8', key: '#1fa37a', line: '#ffffff', accent: '#ff6a13', time: 'sunset' },
    { id: 'cage', name: 'The Cage', where: 'Fenced in, downtown, no out of bounds', tier: 3, scene: 'cage',
      sky: ['#8fa3b8', '#c3ced8', '#e6e2d8'], ground: '#4a4744', court: '#2f4d3b', key: '#c4531f', line: '#f4f1e8', accent: '#e8352b', time: 'overcast' },
    { id: 'rooftop', name: 'Skyline Roof', where: 'Thirty floors up. Do not chase loose balls.', tier: 4, scene: 'rooftop',
      sky: ['#060818', '#1b1446', '#4a2a7a'], ground: '#2a2a33', court: '#3b1f6b', key: '#14b8a6', line: '#f5f5ff', accent: '#ff3ea5', time: 'night' },
    { id: 'underpass', name: 'The Underpass', where: 'Under the freeway. The traffic is the crowd.', tier: 5, scene: 'underpass',
      sky: ['#0c0f17', '#1a2130', '#2d3446'], ground: '#3c3d40', court: '#55585e', key: '#ff6a13', line: '#fffbe8', accent: '#ffb300', time: 'night' },
    { id: 'harbor', name: 'Harbor Yard', where: 'Between the containers at the docks', tier: 6, scene: 'harbor',
      sky: ['#1f2a4f', '#c75b39', '#f6b25b'], ground: '#59524a', court: '#8a2f24', key: '#1d3b6e', line: '#fbeedd', accent: '#2ec5ff', time: 'dusk' },
    { id: 'pit', name: 'The Pit', where: 'The rec center with the dead spot by the bleachers', tier: 7, scene: 'gym',
      sky: ['#2a1d14', '#3d2a1c', '#4f3825'], ground: '#3a2a1e', court: '#c8904f', key: '#1a2f8f', line: '#ffffff', accent: '#ffe14d', time: 'indoor' },
    { id: 'crown', name: 'Crown Court', where: 'Where the kings play. Everybody shows up.', tier: 8, scene: 'crown',
      sky: ['#05040a', '#160c26', '#2b1640'], ground: '#121018', court: '#141217', key: '#b8860b', line: '#ffd23f', accent: '#ffd23f', time: 'night' },
  ];
  D.COURT_BY_ID = Object.fromEntries(D.COURTS.map((c) => [c.id, c]));

  // rules: 'standard' (inside 1, outside 2), 'deep' (only 2s and dunks count), 'dunks' (only dunks and
  // layups, worth 2), 'crowns' (double Crown scoring bonuses, standard opponent loss). target: points to win.
  const CREW_COLORS = [
    ['#e8352b', '#ffffff'], ['#1f6feb', '#ffe14d'], ['#0f8a4b', '#f5deb3'], ['#7b2ff7', '#2ec5ff'], ['#ff6a13', '#1e2128'],
    ['#14b8a6', '#1a2f8f'], ['#b0124f', '#ffb300'], ['#1e2128', '#3fd13f'], ['#ffe14d', '#1e2128'], ['#ff3ea5', '#0b0b0d'],
    ['#b5121b', '#f2f2f2'], ['#1a2f8f', '#ff6a13'],
  ];
  const LOGOS = ['crown', 'flame', 'bolt', 'star', 'wing', 'diamond', 'fist', 'moon', 'wave', 'eye', 'gear', 'paw'];

  const crew = (id, name, members, colorIdx, logo) => ({ id, name, members, colors: CREW_COLORS[colorIdx % CREW_COLORS.length], logo: logo || LOGOS[colorIdx % LOGOS.length] });

  D.CIRCUIT = [
    { court: 'lot', events: [
      { id: 'lot-1', name: 'First Run', target: 7, rule: 'standard', crew: crew('lot-a', 'Corner Store Crew', [['g', 'lot-a1', 'general'], ['g', 'lot-a2', 'slasher'], ['g', 'lot-a3', 'big']], 0, 'star') },
      { id: 'lot-2', name: 'Winners Stay On', target: 11, rule: 'standard', crew: crew('lot-b', 'The Porch Boys', [['g', 'lot-b1', 'sniper'], ['g', 'lot-b2', 'trickster'], ['g', 'lot-b3', 'big']], 1, 'moon') },
      { id: 'lot-3', name: 'Twos Only', target: 11, rule: 'deep', crew: crew('lot-c', 'Recess', [['g', 'lot-c1', 'sniper'], ['g', 'lot-c2', 'sniper'], ['g', 'lot-c3', 'slasher']], 2, 'paw') },
      { id: 'lot-k', name: 'King of the Lot', target: 15, rule: 'standard', king: true, crew: crew('lot-k', 'Lot Lizards', [['l', 'pogo'], ['g', 'lot-k2', 'big'], ['g', 'lot-k3', 'trickster']], 7, 'crown') },
    ] },
    { court: 'boardwalk', events: [
      { id: 'bw-1', name: 'Sunset Run', target: 11, rule: 'standard', crew: crew('bw-a', 'Salt Water', [['g', 'bw-a1', 'slasher'], ['g', 'bw-a2', 'general'], ['g', 'bw-a3', 'big']], 5, 'wave') },
      { id: 'bw-2', name: 'Dunk Contest Rules', target: 11, rule: 'dunks', crew: crew('bw-b', 'Pier Pressure', [['g', 'bw-b1', 'slasher'], ['g', 'bw-b2', 'slasher'], ['g', 'bw-b3', 'big']], 4, 'flame') },
      { id: 'bw-3', name: 'Beach Bums', target: 15, rule: 'standard', crew: crew('bw-c', 'Board Shorts', [['l', 'tiedye'], ['g', 'bw-c2', 'sniper'], ['g', 'bw-c3', 'trickster']], 9, 'eye') },
      { id: 'bw-k', name: 'King of the Boardwalk', target: 15, rule: 'standard', king: true, crew: crew('bw-k', 'Low Tide', [['l', 'farmboy'], ['l', 'flamingo'], ['g', 'bw-k3', 'general']], 1, 'crown') },
    ] },
    { court: 'cage', events: [
      { id: 'cage-1', name: 'Locked In', target: 11, rule: 'standard', crew: crew('cage-a', 'Chain Link', [['g', 'cage-a1', 'trickster'], ['g', 'cage-a2', 'slasher'], ['g', 'cage-a3', 'big']], 10, 'gear') },
      { id: 'cage-2', name: 'Trash Talk', target: 15, rule: 'deep', crew: crew('cage-b', 'Booing Section', [['l', 'chokesign'], ['g', 'cage-b2', 'sniper'], ['g', 'cage-b3', 'big']], 8, 'fist') },
      { id: 'cage-3', name: 'Crown Rules', target: 15, rule: 'crowns', crew: crew('cage-c', 'Third Rail', [['g', 'cage-c1', 'trickster'], ['g', 'cage-c2', 'general'], ['g', 'cage-c3', 'slasher']], 3, 'bolt') },
      { id: 'cage-k', name: 'King of the Cage', target: 21, rule: 'standard', king: true, crew: crew('cage-k', 'Ankle Collectors', [['l', 'question'], ['l', 'sixshooter'], ['g', 'cage-k3', 'big']], 0, 'crown') },
    ] },
    { court: 'rooftop', events: [
      { id: 'roof-1', name: 'Altitude', target: 15, rule: 'standard', crew: crew('roof-a', 'Penthouse', [['g', 'roof-a1', 'sniper'], ['g', 'roof-a2', 'slasher'], ['g', 'roof-a3', 'big']], 6, 'diamond') },
      { id: 'roof-2', name: 'Air Traffic', target: 11, rule: 'dunks', crew: crew('roof-b', 'Helipad', [['g', 'roof-b1', 'slasher'], ['g', 'roof-b2', 'slasher'], ['g', 'roof-b3', 'big']], 11, 'wing') },
      { id: 'roof-3', name: 'Long Way Down', target: 15, rule: 'standard', crew: crew('roof-c', 'Elevator Music', [['l', 'longstrides'], ['g', 'roof-c2', 'general'], ['g', 'roof-c3', 'sniper']], 2, 'star') },
      { id: 'roof-k', name: 'King of the Roof', target: 21, rule: 'standard', king: true, crew: crew('roof-k', 'Sky Lords', [['l', 'liftoff'], ['l', 'downtown'], ['g', 'roof-k3', 'big']], 3, 'crown') },
    ] },
    { court: 'underpass', events: [
      { id: 'up-1', name: 'Rush Hour', target: 15, rule: 'standard', crew: crew('up-a', 'Overpass', [['g', 'up-a1', 'trickster'], ['g', 'up-a2', 'sniper'], ['g', 'up-a3', 'big']], 4, 'gear') },
      { id: 'up-2', name: 'Glass Cleaners', target: 15, rule: 'standard', crew: crew('up-b', 'Board Room', [['l', 'static'], ['g', 'up-b2', 'big'], ['g', 'up-b3', 'general']], 9, 'bolt') },
      { id: 'up-3', name: 'Crown Rules', target: 15, rule: 'crowns', crew: crew('up-c', 'Headlights', [['g', 'up-c1', 'slasher'], ['g', 'up-c2', 'trickster'], ['g', 'up-c3', 'sniper']], 8, 'eye') },
      { id: 'up-k', name: 'King of the Underpass', target: 21, rule: 'standard', king: true, crew: crew('up-k', 'Heavy Traffic', [['l', 'mound'], ['l', 'upunder'], ['l', 'stableboy']], 7, 'crown') },
    ] },
    { court: 'harbor', events: [
      { id: 'hb-1', name: 'Dock Work', target: 15, rule: 'standard', crew: crew('hb-a', 'Longshore', [['g', 'hb-a1', 'big'], ['g', 'hb-a2', 'slasher'], ['g', 'hb-a3', 'general']], 11, 'wave') },
      { id: 'hb-2', name: 'Twos Only', target: 15, rule: 'deep', crew: crew('hb-b', 'Fog Horns', [['g', 'hb-b1', 'sniper'], ['g', 'hb-b2', 'sniper'], ['g', 'hb-b3', 'trickster']], 1, 'moon') },
      { id: 'hb-3', name: 'Cold Snap', target: 21, rule: 'standard', crew: crew('hb-c', 'Deep Freeze', [['l', 'coldfront'], ['g', 'hb-c2', 'big'], ['g', 'hb-c3', 'slasher']], 5, 'diamond') },
      { id: 'hb-k', name: 'King of the Harbor', target: 21, rule: 'standard', king: true, crew: crew('hb-k', 'Heavy Freight', [['l', 'bigcargo'], ['l', 'copperhead'], ['l', 'martian']], 10, 'crown') },
    ] },
    { court: 'pit', events: [
      { id: 'pit-1', name: 'Open Gym', target: 15, rule: 'standard', crew: crew('pit-a', 'Gym Rats', [['g', 'pit-a1', 'general'], ['g', 'pit-a2', 'big'], ['g', 'pit-a3', 'sniper']], 2, 'paw') },
      { id: 'pit-2', name: 'Throw It Down', target: 15, rule: 'dunks', crew: crew('pit-b', 'Rim Wreckers', [['l', 'throwdown'], ['g', 'pit-b2', 'slasher'], ['g', 'pit-b3', 'big']], 0, 'fist') },
      { id: 'pit-3', name: 'Logo Range', target: 15, rule: 'deep', crew: crew('pit-c', 'Half Court', [['l', 'logo'], ['g', 'pit-c2', 'sniper'], ['g', 'pit-c3', 'trickster']], 6, 'star') },
      { id: 'pit-k', name: 'King of the Pit', target: 21, rule: 'standard', king: true, crew: crew('pit-k', 'Fundamentals', [['l', 'textbook'], ['l', 'boxoffice'], ['l', 'twostories']], 3, 'crown') },
    ] },
    { court: 'crown', events: [
      { id: 'cr-1', name: 'Showtime', target: 21, rule: 'standard', crew: crew('cr-a', 'Showtime', [['l', 'nolook'], ['l', 'hookshot'], ['l', 'surgeon']], 9, 'star') },
      { id: 'cr-2', name: 'Crown Rules', target: 15, rule: 'crowns', crew: crew('cr-b', 'Night Shift', [['l', 'question'], ['l', 'downtown'], ['l', 'martian']], 3, 'moon') },
      { id: 'cr-k', name: 'The Crown', target: 21, rule: 'standard', king: true, crew: crew('cr-k', 'The Kings', [['l', 'hangtime'], ['l', 'chosenone'], ['l', 'upunder']], 8, 'crown') },
    ] },
  ];
  D.RULES = {
    standard: { name: 'Standard', blurb: 'Inside the arc is 1. Outside is 2.' },
    deep: { name: 'Twos Only', blurb: 'Only shots from outside the arc and dunks count.' },
    dunks: { name: 'Dunk Contest Rules', blurb: 'Only dunks and layups count, and they are worth 2.' },
    crowns: { name: 'Crown Rules', blurb: 'Double scoring bonuses. A deep Double Crown scores 6 and takes up to 2.' },
  };

  // Resolve a crew member spec to a player object.
  D.memberFor = function (spec, tier) {
    if (spec[0] === 'l') return D.LEGEND_BY_ID[spec[1]];
    return D.genLocal(spec[1], tier, spec[2]);
  };
  D.allEvents = function () {
    const out = [];
    D.CIRCUIT.forEach((stop, ci) => stop.events.forEach((ev, ei) => out.push({ stop, ci, ei, ev, court: D.COURT_BY_ID[stop.court] })));
    return out;
  };

  // Crews you can pick from in Quick Game (in addition to your own).
  D.QUICK_CREWS = [
    { id: 'q-kings', name: 'The Kings', colors: ['#ffe14d', '#1e2128'], logo: 'crown', members: ['hangtime', 'chosenone', 'upunder'] },
    { id: 'q-show', name: 'Showtime', colors: ['#ff3ea5', '#0b0b0d'], logo: 'star', members: ['nolook', 'hookshot', 'surgeon'] },
    { id: 'q-sky', name: 'Sky Lords', colors: ['#7b2ff7', '#2ec5ff'], logo: 'wing', members: ['liftoff', 'downtown', 'longstrides'] },
    { id: 'q-ankle', name: 'Ankle Collectors', colors: ['#e8352b', '#ffffff'], logo: 'bolt', members: ['question', 'sixshooter', 'static'] },
    { id: 'q-freight', name: 'Heavy Freight', colors: ['#b5121b', '#f2f2f2'], logo: 'gear', members: ['bigcargo', 'copperhead', 'martian'] },
    { id: 'q-fund', name: 'Fundamentals', colors: ['#7b2ff7', '#2ec5ff'], logo: 'diamond', members: ['textbook', 'boxoffice', 'twostories'] },
    { id: 'q-range', name: 'Long Range', colors: ['#14b8a6', '#1a2f8f'], logo: 'eye', members: ['logo', 'farmboy', 'flamingo'] },
    { id: 'q-traffic', name: 'Heavy Traffic', colors: ['#1e2128', '#3fd13f'], logo: 'fist', members: ['mound', 'stableboy', 'throwdown'] },
    { id: 'q-lot', name: 'Lot Lizards', colors: ['#1e2128', '#3fd13f'], logo: 'paw', members: ['pogo', 'coldfront', 'tiedye'] },
  ];

  D.LOGOS = LOGOS;
  D.CREW_COLORS = CREW_COLORS;

  // Callouts for big moments. Picked at random.
  D.CALLS = {
    dunk: ['SLAM!', 'BOOM!', 'POSTERIZED!', 'HAMMER TIME!', 'GET UP!', 'RIM WRECKED!', 'THUNDER!'],
    bigdunk: ['OH MY!', 'CALL A DOCTOR!', 'SKY WALKER!', 'FROM ORBIT!', 'NO GRAVITY!'],
    block: ['REJECTED!', 'NOT IN HERE!', 'GET THAT OUTTA HERE!', 'DENIED!', 'SWATTED!', 'RETURN TO SENDER!'],
    deep: ['FROM DOWNTOWN!', 'SPLASH!', 'WAY DOWNTOWN!', 'CASH!', 'WET!'],
    swish: ['SWISH!', 'BUCKETS!', 'MONEY!', 'COOKIES!', 'BANG!'],
    layup: ['SCOOP!', 'KISS OFF THE GLASS!', 'EASY!', 'FINGER ROLL!'],
    steal: ['PICKED!', 'POCKET WATCH!', 'SNATCHED!', 'THANK YOU!', 'CHECK YOUR POCKETS!'],
    ankles: ['ANKLES BROKEN!', 'HE FELL!', 'CALL HIS MOM!', 'TIMBER!', 'SIT DOWN!'],
    oop: ['ALLEY-OOP!', 'OOP!', 'SPECIAL DELIVERY!', 'AIRMAIL!'],
    selfoop: ['OFF THE GLASS!', 'SELF SERVICE!', 'PASS TO NOBODY!'],
    crown: ['CROWN SHOT!', 'LONG LIVE THE KING!', 'ALL HAIL!', 'CORONATION!'],
    fire: ['ON FIRE!', 'HEATING UP!', 'CAN\'T MISS!'],
    rebound: ['BOARD MAN!', 'MINE!', 'CLEANED UP!'],
  };
})(window.BK = window.BK || {});
