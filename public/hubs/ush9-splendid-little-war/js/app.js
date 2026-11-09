/* A Splendid Little War? — shared state and the 2D interactives. */
(function () {
  'use strict';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(k, fallback) { try { const v = sessionStorage.getItem('slw2-' + k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { sessionStorage.setItem('slw2-' + k, JSON.stringify(v)); } catch (e) {} }
  };

  const SLW = window.SLW = window.SLW || {};
  SLW.reduce = reduce;
  SLW.store = store;
  SLW.world = fetch('ush9-splendid-little-war/data/countries-50m.json').then(r => { if (!r.ok) throw new Error('map data ' + r.status); return r.json(); });
  SLW.world.catch(() => {});

  /* Runs fn when el first comes near the viewport (keeps heavy scenes idle until needed). */
  SLW.whenNear = function (el, fn) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { rootMargin: '400px 0px' });
    io.observe(el);
  };

  /* Animates a number inside el. */
  function countTo(el, to, fmt) {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    if (reduce) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 600;
    function tick(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  const commas = n => n.toLocaleString('en-US');

  /* ================= Press pass (stamps) ================= */
  const STAMPS = [
    ['globe', 'Travel 1898 on the globe', '#top'],
    ['press', 'Print a front page', '#press'],
    ['letter', 'Open the stolen letter', '#letter'],
    ['maine', 'Witness 9:40 p.m.', '#ch2'],
    ['theories', 'Test both Maine theories', '#ch2'],
    ['jury', 'Vote on the Maine jury', '#jury'],
    ['decide', 'Make McKinley’s decisions', '#decide'],
    ['journey', 'Survive the Rough Rider campaign', '#journey'],
    ['myths', 'Flip every myth card', '#myths'],
    ['empire', 'Explore the empire map', '#empire'],
    ['senate', 'Flip a Senate vote', '#senate'],
    ['foh', 'Finish Fact or Hype', '#fact-or-hype'],
    ['verdict', 'Write your verdict', '#verdict']
  ];
  const savedStamps = store.get('stamps', []);
  const stamps = new Set(Array.isArray(savedStamps) ? savedStamps : []);
  function renderStamps() {
    $('#stamp-count').textContent = stamps.size;
    $('#stamp-total').textContent = STAMPS.length;
    $('#stamp-list').innerHTML = STAMPS.map(([id, label, href]) =>
      `<li class="${stamps.has(id) ? 'done' : ''}"><a href="${href}">${label}</a></li>`).join('');
  }
  SLW.stamp = function (id) {
    if (stamps.has(id)) return;
    stamps.add(id);
    store.set('stamps', Array.from(stamps));
    renderStamps();
    const sum = $('#pass summary');
    if (sum && !reduce) sum.animate([{ transform: 'scale(1.35)', background: '#F2C230', color: '#14161C' }, { transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  };
  renderStamps();
  $$('#stamp-list').forEach(ul => ul.addEventListener('click', e => { if (e.target.closest('a')) $('#pass').open = false; }));

  /* ================= Active chapter in nav ================= */
  (function () {
    const links = $$('.chapters a');
    const secs = links.map(a => document.getElementById(a.dataset.ch)).filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(a => a.classList.toggle('active', a.dataset.ch === e.target.id));
          const on = links.find(a => a.dataset.ch === e.target.id);
          if (on && on.scrollIntoView) { const box = on.parentElement; box.scrollTo({ left: on.offsetLeft - 40, behavior: reduce ? 'auto' : 'smooth' }); }
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => io.observe(s));
  })();

  /* ================= Headline machine ================= */
  (function () {
    const A = [
      { t: 'Explosion sinks {b}', hype: 0, acc: 1 },
      { t: 'Disaster in Havana: {b} lost', hype: 1, acc: 1 },
      { t: 'Spanish treachery! {b} destroyed', hype: 3, acc: 0 }
    ];
    const B = [
      { t: 'the USS Maine', hype: 0, acc: 1 },
      { t: 'our gallant battleship', hype: 1, acc: 1 },
      { t: 'the Maine and 266 murdered sailors', hype: 3, acc: 0 }
    ];
    const C = [
      { t: 'Cause unknown', hype: 0, acc: 1 },
      { t: 'Navy will investigate', hype: 0, acc: 1 },
      { t: 'The work of an enemy', hype: 3, acc: 0 },
      { t: 'Spain must pay!', hype: 3, acc: 0 }
    ];
    const val = n => Number(($(`input[name="${n}"]:checked`) || {}).value || 0);
    let printed = false;
    function update() {
      const a = A[val('h1')], b = B[val('h2')], c = C[val('h3')];
      const head = a.t.replace('{b}', b.t);
      $('#front-head').innerHTML = `${head}<span style="display:block;font-size:.5em;margin-top:.35em;letter-spacing:.06em">${c.t}</span>`;
      const hype = a.hype + b.hype + c.hype;            // 0–9
      const acc = Math.round((a.acc + b.acc + c.acc) / 3 * 100);
      const copies = 310000 + Math.round(hype / 9 * 940000 / 1000) * 1000;
      countTo($('#copies'), copies, commas);
      countTo($('#accuracy'), acc, n => n + '%');
      $('#copies-bar').style.width = (copies / 1250000 * 100) + '%';
      $('#acc-bar').style.width = acc + '%';
      if (printed) compare(copies, acc);
    }
    function compare(copies, acc) {
      $('#press-compare').textContent = `Your front page: ${commas(copies)} copies, ${acc}% accurate.`;
    }
    $('#slots').addEventListener('change', update);
    $('#to-press').addEventListener('click', () => {
      printed = true;
      const r = $('#press-reveal');
      r.hidden = false;
      update();
      if (!reduce) $('.front').animate([{ transform: 'rotate(.6deg) scale(1.04)' }, { transform: 'rotate(.6deg) scale(1)' }], { duration: 350 });
      SLW.stamp('press');
    });
    update();
  })();

  /* ================= De Lôme letter ================= */
  (function () {
    const NOTES = [
      `<strong>“A bidder for the admiration of the crowd”</strong> means a politician who does whatever is popular. De Lôme is calling the President a crowd-pleaser with no backbone.`,
      `<strong>“A common politician”</strong> was a real insult in 1898: a man with no principles who only cares about winning. Americans read it as Spain sneering at the whole country.`
    ];
    const env = $('#envelope'), btn = $('#open-letter'), notes = $('#letter-notes');
    btn.addEventListener('click', () => {
      const open = !env.classList.contains('open');
      env.classList.toggle('open', open);
      $('#envelope-wrap').classList.toggle('open', open);
      btn.textContent = open ? 'Fold it back up' : 'Open the stolen letter';
      notes.innerHTML = open
        ? `<p class="note">Tap the highlighted phrases to decode them. De Lôme resigned the day the letter was printed, and Spain apologized. Six days later, the <em>Maine</em> exploded.</p>`
        : '';
      if (open) SLW.stamp('letter');
    });
    function showNote(m) {
      const i = Number(m.dataset.note);
      const extra = notes.querySelector('[data-n]');
      const html = `<p class="note" data-n>${NOTES[i]}</p>`;
      if (extra) extra.outerHTML = html; else notes.insertAdjacentHTML('beforeend', html);
    }
    $('#letter-text').addEventListener('click', e => { const m = e.target.closest('mark'); if (m) showNote(m); });
    $('#letter-text').addEventListener('keydown', e => {
      const m = e.target.closest('mark');
      if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showNote(m); }
    });
  })();

  /* ================= Maine jury ================= */
  (function () {
    const NOTE = {
      mine: `You sided with the 1898 and 1911 Navy boards. Even they couldn’t say who planted a mine, and no one has ever proven Spain did.`,
      fire: `You sided with Rickover’s 1976 study. Coal-bunker fires were a known danger in the 1890s, and other U.S. warships had them in the same years.`,
      unknown: `That’s an honest historian’s answer. The key fact: in 1898, Americans went to war before the evidence was in.`
    };
    const box = $('#jury-opts'), out = $('#jury-result');
    function show(v) {
      $$('[data-jury]', box).forEach(b => b.classList.toggle('on', b.dataset.jury === v));
      out.hidden = false;
      $('#jury-note').innerHTML = `<strong>Your vote:</strong> ${NOTE[v]}`;
    }
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-jury]');
      if (!b) return;
      store.set('jury', b.dataset.jury);
      show(b.dataset.jury);
      SLW.stamp('jury');
    });
    const saved = store.get('jury', null);
    if (NOTE[saved]) show(saved);
  })();

  /* ================= McKinley decision sim ================= */
  (function () {
    const G = [
      { id: 'pub', label: 'Public anger' },
      { id: 'cong', label: 'Congress demanding war' },
      { id: 'press', label: 'Yellow press heat' },
      { id: 'biz', label: 'Business calls for calm' }
    ];
    const START = { pub: 70, cong: 60, press: 85, biz: 70 };
    const ROUNDS = [
      {
        date: 'March 28, 1898', title: 'The Navy’s verdict',
        tg: 'COURT OF INQUIRY FINDS MAINE DESTROYED BY SUBMARINE MINE STOP UNABLE TO FIX RESPONSIBILITY ON ANY PERSON OR PERSONS STOP',
        ask: 'The report is on your desk. Congress and the newspapers are waiting. What do you do?',
        opts: [
          { b: 'Send it to Congress and press Spain', d: 'Make it public, and demand that Spain stop the war in Cuba and close the camps.', fx: { pub: 10, cong: 10, press: 5, biz: -5 }, real: true },
          { b: 'Keep it quiet for now', d: 'Hold the report back while diplomats keep working.', fx: { pub: 15, cong: 20, press: 15, biz: 0 }, cf: 'The report would almost certainly leak. Congress and the papers would accuse you of a cover-up, and you could lose control of the decision entirely.' },
          { b: 'Ask for war today', d: 'Strike while the country is united.', fx: { pub: -10, cong: -10, press: -5, biz: -20 }, cf: 'War starts a month early. An Army of 28,000 regulars with no plan to feed or ship a force to Cuba would be even less ready, and the summer fever season would hit sooner.' }
        ],
        real: 'McKinley sent the report to Congress on March 28 and pushed Spain hard to stop fighting in Cuba and end the reconcentration camps.'
      },
      {
        date: 'April 9–10, 1898', title: 'Spain blinks',
        tg: 'SPANISH GOVERNMENT ORDERS SUSPENSION OF HOSTILITIES IN CUBA STOP NO INDEPENDENCE FOR THE ISLAND STOP INSURGENTS REFUSE ANY TRUCE WITHOUT FREEDOM STOP',
        ask: 'Spain offers a cease-fire, but not independence. Cuban rebels say that isn’t enough. What do you do?',
        opts: [
          { b: 'Accept the cease-fire and keep talking', d: 'Give diplomacy more time.', fx: { pub: 10, cong: 15, press: 10, biz: -10 }, cf: 'Spain might have offered more. But Cuban rebels wanted independence, not a pause, so the fighting likely goes on. Congress was close to acting without you, and your own party might split.' },
          { b: 'Ask Congress for power to use force', d: 'Send a message asking to end the war in Cuba, by force if needed.', fx: { pub: -15, cong: -20, press: -10, biz: 10 }, real: true },
          { b: 'Recognize Cuba’s rebel government', d: 'Treat the rebels as Cuba’s rightful leaders.', fx: { pub: -5, cong: -5, press: -5, biz: 10 }, cf: 'Cubans would lead their own country from day one, and the U.S. would have to work with them as equals. McKinley refused, partly because it would limit U.S. control over what came next.' }
        ],
        real: 'On April 11, McKinley asked Congress for power to intervene. He mentioned Spain’s cease-fire offer only in the last lines of his message.'
      },
      {
        date: 'April 19, 1898', title: 'The fine print',
        tg: 'SENATOR TELLER OF COLORADO OFFERS AMENDMENT STOP UNITED STATES TO DISCLAIM ANY INTENTION TO EXERCISE CONTROL OVER CUBA STOP',
        ask: 'Congress is writing the war resolution. Should it promise that the U.S. won’t take Cuba?',
        opts: [
          { b: 'Support the promise', d: 'Fight for Cuba’s freedom, not for new land.', fx: { pub: -5, cong: -10, press: 0, biz: 0 }, real: true },
          { b: 'Leave it out', d: 'Keep America’s options open.', fx: { pub: 0, cong: 5, press: 5, biz: 5 }, cf: 'Cuba might have become a U.S. territory like Puerto Rico. Cuban rebels, already suspicious, could have turned their guns on the Americans, as Filipinos later did.' }
        ],
        real: 'Congress passed the Teller Amendment, and McKinley signed the war resolution on April 20. Spain broke off relations, and on April 25 Congress declared war.'
      }
    ];
    const gaugeBox = $('#gauges'), scen = $('#scenario');
    let g, round, matches, picked;

    function drawGauges() {
      gaugeBox.innerHTML = `<p class="wire label">Pressure on you</p>` + G.map(x =>
        `<div class="gauge${g[x.id] > 75 ? ' hot' : ''}"><div class="gauge-top"><span>${x.label}</span><b>${g[x.id]}</b></div><div class="bar"><i style="width:${g[x.id]}%"></i></div></div>`).join('');
    }
    function dots() { return `<div class="progress-dots" aria-label="Decision ${Math.min(round + 1, 3)} of 3">${ROUNDS.map((_, i) => `<i class="${i <= round ? 'on' : ''}"></i>`).join('')}</div>`; }
    function draw() {
      if (round >= ROUNDS.length) {
        scen.innerHTML = `${dots()}
          <p class="wire label">Your record</p>
          <h4 style="font-family:var(--font-display);font-weight:900;font-size:2.4rem;line-height:.95;text-transform:uppercase">You matched McKinley ${matches} of 3 times</h4>
          <p>${matches === 3 ? 'You walked the same road to war he did. Did it feel like there was a real choice?' : 'Your path split from history. The counterfactuals you saw are educated guesses, not facts. Historians argue about them.'}</p>
          <p><em>Think:</em> which moment do you think was the real point of no return: the explosion, the Navy’s report, or Spain’s refusal to free Cuba?</p>
          <div><button type="button" class="btn" data-sim="restart">Play again</button></div>`;
        SLW.stamp('decide');
        return;
      }
      const R = ROUNDS[round];
      if (picked === null) {
        scen.innerHTML = `${dots()}
          <div class="telegram"><div class="tg-head"><span>Western Union · Executive Mansion</span><span>${R.date}</span></div>${R.tg}<p style="margin-top:.5rem;font-size:.7rem;opacity:.7">Dramatized telegram</p></div>
          <h4 style="font-family:var(--font-display);font-weight:900;font-size:2rem;line-height:.95;text-transform:uppercase">${R.title}</h4>
          <p>${R.ask}</p>
          <div class="choices">${R.opts.map((o, i) => `<button type="button" class="choice" data-sim="${i}"><b>${o.b}</b><span>${o.d}</span></button>`).join('')}</div>`;
      } else {
        const o = R.opts[picked];
        scen.innerHTML = `${dots()}
          <p class="wire label">${R.date} · You chose</p>
          <h4 style="font-family:var(--font-display);font-weight:900;font-size:2rem;line-height:.95;text-transform:uppercase">${o.b}</h4>
          <div class="outcome">
            ${o.real ? `<div class="real"><p class="wire">This is what McKinley did</p><p>${R.real}</p></div>`
              : `<div class="cf"><p class="wire label">Counterfactual · what might have happened</p><p>${o.cf}</p></div><div class="real"><p class="wire">What McKinley really did</p><p>${R.real}</p></div>`}
          </div>
          <div><button type="button" class="btn btn-yellow" data-sim="next">${round === ROUNDS.length - 1 ? 'See your record' : 'Next decision →'}</button></div>`;
      }
    }
    function start() { g = Object.assign({}, START); round = 0; matches = 0; picked = null; drawGauges(); draw(); }
    scen.addEventListener('click', e => {
      const b = e.target.closest('[data-sim]');
      if (!b) return;
      const v = b.dataset.sim;
      if (v === 'restart') { start(); return; }
      if (v === 'next') { round++; picked = null; draw(); const f = scen.querySelector('button'); if (f) f.focus({ preventScroll: true }); return; }
      picked = Number(v);
      const o = ROUNDS[round].opts[picked];
      if (o.real) matches++;
      Object.keys(o.fx).forEach(k => { g[k] = Math.max(0, Math.min(100, g[k] + o.fx[k])); });
      drawGauges(); draw();
      const f = scen.querySelector('[data-sim="next"]'); if (f) f.focus({ preventScroll: true });
    });
    start();
  })();

  /* ================= Flip cards ================= */
  function flipCards(el, cards, onAll) {
    if (!el) return;
    const seen = new Set();
    el.innerHTML = cards.map((c, i) => `
      <button type="button" class="flip ${c.kind || ''}" data-flip="${i}" aria-pressed="false">
        <span class="flip-inner">
          <span class="flip-face flip-front"><span class="ft">${c.front}</span><span class="wire flip-hint">Tap to ${c.kind === 'whatif' ? 'imagine' : 'check'} ↻</span></span>
          <span class="flip-face flip-back">${c.tag ? `<span class="verdict-tag ${c.tag}">${c.tag === 'mixed' ? 'Partly true' : c.tag}</span>` : `<span class="wire" style="color:var(--yellow)">One possibility</span>`}<span class="fb">${c.back}</span></span>
        </span>
      </button>`).join('');
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-flip]');
      if (!b) return;
      const on = !b.classList.contains('flipped');
      b.classList.toggle('flipped', on);
      b.setAttribute('aria-pressed', String(on));
      seen.add(b.dataset.flip);
      if (onAll && seen.size === cards.length) onAll();
    });
  }
  flipCards($('#whatifs'), [
    { kind: 'whatif', front: 'Guam had a telegraph?', back: 'The tiny Spanish garrison might have been ready to fight. But with a few dozen soldiers and no gunpowder for the fort, Guam probably still falls. Slow news shaped this whole war.' },
    { kind: 'whatif', front: 'Roosevelt hadn’t cabled Dewey?', back: 'The Navy already had a plan, written in 1896, to strike Manila if war came. The battle probably still happens, maybe later. One person mattered, but so did plans already on the shelf.' },
    { kind: 'whatif', front: 'The papers had waited for proof?', back: 'Anger would have built more slowly, giving diplomats more time. But Cuba’s war, the camps, and U.S. business interests would still be there. Would that have stopped the war? Historians disagree.' },
    { kind: 'whatif', front: 'Spain had let Cuba go?', back: 'Spain offered Cuba limited self-rule in late 1897, but not independence, and the rebels refused anything less. If Spain had let Cuba go, the U.S. would have had little reason to fight.' }
  ]);
  flipCards($('#whatifs-2'), [
    { kind: 'whatif', front: 'The U.S. had recognized the Philippine Republic?', back: 'The Philippine-American War, which killed far more people than the war with Spain, might never have happened. But German warships were already in Manila Bay, and a new republic might have struggled to stay free.' },
    { kind: 'whatif', front: 'The Platt Amendment had never passed?', back: 'Cuba starts out fully independent. The U.S. has no legal excuse to send troops back in 1906, 1912, and 1917, and there might be no Guantánamo base today.' }
  ]);
  flipCards($('#myths'), [
    { tag: 'mixed', front: 'Roosevelt charged up San Juan Hill on horseback.', back: 'Mostly myth. He led the charge up Kettle Hill, next door. He rode his horse, Little Texas, until a wire fence stopped him about 40 yards from the top, then finished on foot.' },
    { tag: 'myth', front: 'The Rough Riders were all cowboys.', back: 'Roosevelt chose a mix: cowboys and miners from the Southwest, Native Americans, and college athletes from Harvard, Yale, and Princeton, plus a few New York polo players.' },
    { tag: 'fact', front: 'The Rough Riders barely rode in Cuba.', back: 'There wasn’t room on the ships, so most horses stayed in Florida and the cavalry fought on foot. The men joked that they were “Wood’s Weary Walkers.”' },
    { tag: 'fact', front: 'Roosevelt won the Medal of Honor.', back: 'Eventually. He was nominated in 1898 and turned down. President Bill Clinton awarded it in 2001, 103 years later. He is the only president who has received it.' },
    { tag: 'mixed', front: 'The war made Roosevelt president.', back: 'It made him famous. He won the governorship of New York in 1898 and the vice presidency in 1900. He became president in 1901 only because McKinley was assassinated.' },
    { tag: 'myth', front: 'The Rough Riders took the heights by themselves.', back: 'Regular Army units, including the Black 9th and 10th Cavalry and 24th and 25th Infantry, fought in the same assault. Roosevelt’s fame made the Rough Riders the story.' }
  ], () => SLW.stamp('myths'));

  /* ================= TR timeline ================= */
  (function () {
    const T = [
      ['April 1897', 'Assistant Secretary of the Navy', 'McKinley appoints him. Roosevelt pushes hard for a bigger, stronger Navy.'],
      ['Feb. 25, 1898', 'The cable to Dewey', 'With his boss out for the afternoon, he orders the Pacific fleet to prepare to strike the Philippines.', 1],
      ['May 1898', 'He quits to fight', 'He becomes lieutenant colonel of the 1st U.S. Volunteer Cavalry, under Colonel Leonard Wood.'],
      ['May 1898', 'San Antonio, Texas', 'About 1,000 recruits train in the heat. Newspapers call them the Rough Riders, and “Teddy’s Terrors.”'],
      ['June 22–24, 1898', 'Into Cuba', 'A messy landing at Daiquirí, then the regiment’s first fight at Las Guásimas.'],
      ['July 1, 1898', 'Kettle Hill', 'He leads the charge up Kettle Hill, then on to the San Juan Heights. Santiago surrenders on July 17.', 1],
      ['Aug. 1898', 'The Round Robin', 'He and other officers sign a letter demanding that the fever-stricken army be sent home. It leaks to the press.'],
      ['Nov. 1898', 'Governor of New York', 'Riding his war fame, he wins the election.'],
      ['Nov. 1900', 'Vice President', 'He runs beside McKinley and wins.'],
      ['Sept. 14, 1901', 'President at 42', 'McKinley is assassinated. Roosevelt becomes the youngest president in U.S. history.', 1],
      ['Jan. 16, 2001', 'Medal of Honor', 'Awarded 103 years after the charge.', 1]
    ];
    const track = $('#tl-track');
    track.innerHTML = T.map(t => `<article class="tl-card${t[3] ? ' big' : ''}"><p class="wire date">${t[0]}</p><h4>${t[1]}</h4><p>${t[2]}</p></article>`).join('');
    const step = () => (track.querySelector('.tl-card') || {}).offsetWidth + 16 || 300;
    $('#tl-prev').addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
    $('#tl-next').addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
  })();

  /* ================= Ride with the Rough Riders ================= */
  (function () {
    const RECRUITS = [
      { id: 'will', name: 'Will', role: 'Cowboy, New Mexico Territory', blurb: '19. Can ride anything. Has never seen the ocean.', v: { spirits: 80, health: 85, water: 70 } },
      { id: 'harry', name: 'Harry', role: 'College athlete, Harvard', blurb: '21. Football star. Has never slept outdoors.', v: { spirits: 90, health: 80, water: 70 } },
      { id: 'sam', name: 'Sam', role: 'Rancher, Indian Territory', blurb: '24. Cherokee. Signed up with friends from home.', v: { spirits: 80, health: 85, water: 75 } }
    ];
    const STAGES = [
      { map: 0, when: 'May 1898', place: 'San Antonio, Texas', img: 'ush9-splendid-little-war/img/tr-1898.jpg', credit: 'Lt. Col. Roosevelt in uniform, 1898', title: 'Sign me up',
        text: 'Thousands of men want in. Roosevelt and Colonel Wood pick about 1,000. You drill in the Texas heat in a heavy wool uniform. Your rifle is a modern Krag carbine with smokeless powder, which Roosevelt pulled strings to get.',
        opts: [
          { b: 'Practice shooting until dark', fx: { water: -10, spirits: 5 }, r: 'Smart. In Cuba, smokeless powder will keep you hidden, while volunteer units with old black-powder rifles give away their positions with every shot.' },
          { b: 'Help break the wild horses', fx: { spirits: 10, health: -5 }, r: 'You’re bruised but proud. Too bad: most of these horses will never reach Cuba.' }
        ] },
      { map: 0, when: 'June 7–8, 1898', place: 'Port Tampa, Florida', img: 'ush9-splendid-little-war/img/rr-tampa.jpg', credit: 'Rough Riders riding to Port Tampa, 1898', title: 'Chaos at the port',
        text: 'One railroad line, thousands of soldiers, too few ships. The word is that whoever reaches a transport first keeps it. It’s midnight, and the train you were promised hasn’t come.',
        opts: [
          { b: 'Wait for the official train', fx: { spirits: -15 }, r: 'It never comes. In real life, Roosevelt and Wood flagged down a coal train, rode it to the docks, and ran to grab the transport <em>Yucatán</em> before another regiment could. You catch up, barely.' },
          { b: 'Jump on the coal train with Roosevelt', fx: { spirits: 10, health: -5 }, r: 'You roll into port black with coal dust. Roosevelt holds the gangplank of the <em>Yucatán</em> against another regiment. You’re aboard.' }
        ],
        fact: 'Only 8 of the regiment’s 12 troops fit on the ship, and almost no horses. Then the fleet sat in the hot harbor for six days before sailing.' },
      { map: 1, when: 'June 22, 1898', place: 'Daiquirí, Cuba', img: 'ush9-splendid-little-war/img/daiquiri.jpg', credit: 'Americans landing at the pier, Daiquirí, 1898', title: 'Landing',
        text: 'There’s no proper dock, just a rickety pier and rough surf. Men leap into rowboats. Horses and mules are shoved overboard to swim for shore.',
        opts: [
          { b: 'Help swim the horses in', fx: { health: -10, spirits: 5 }, r: 'Roosevelt’s horse Rain-in-the-Face drowns in the surf. His other horse, Little Texas, makes it. So do you, soaked and exhausted.' },
          { b: 'Get to the beach and dig in', fx: { water: -10 }, r: 'The Spanish have pulled back. The landing is a mess, but nobody is shooting at you. Yet.' }
        ],
        fact: 'About 16,000 U.S. troops came ashore at Daiquirí and Siboney over several days.' },
      { map: 2, when: 'June 24, 1898', place: 'Las Guásimas', img: 'ush9-splendid-little-war/img/guasimas-10th.jpg', credit: 'The 9th and 10th Cavalry supporting the Rough Riders at Las Guásimas, 1898', title: 'Ambush in the jungle',
        text: 'The trail is so overgrown you can’t see ten feet ahead. Then bullets snap through the leaves. You can’t spot a single puff of smoke. The Spanish use smokeless powder too.',
        opts: [
          { b: 'Push forward through the brush', fx: { health: -15, spirits: 10 }, r: 'Your line creeps forward while regular troopers of the 1st and 10th Cavalry press up the next trail. After about two hours, the Spanish fall back toward Santiago.' },
          { b: 'Hold your ground and fire back', fx: { water: -10, spirits: -5 }, r: 'You fire at sounds in the brush. Meanwhile the regulars of the 1st and 10th Cavalry push up the other trail, and the Spanish withdraw.' }
        ],
        fact: '16 Americans were killed at Las Guásimas, the first land battle of the war.' },
      { map: 3, when: 'June 25–30, 1898', place: 'Camp near El Pozo', img: 'ush9-splendid-little-war/img/las-guasimas.jpg', credit: 'Americans going to the front, 1898', title: 'Heat, rain, hardtack',
        text: 'It pours every afternoon and steams every morning. Dinner is hardtack, bacon, and canned beef that smells wrong. Your canteen is nearly empty, and the only stream is muddy.',
        opts: [
          { b: 'Drink straight from the stream', fx: { water: 30, health: -25 }, r: 'Your thirst is gone. A few days later, the cramps start. Typhoid and dysentery spread through the camps exactly this way.' },
          { b: 'Wait and boil your water', fx: { water: 15, spirits: -10 }, r: 'It takes forever, and the fire smokes in the rain. But soldiers who were careful about water got sick less often.' }
        ],
        fact: 'Disease killed far more U.S. soldiers in this war than Spanish bullets did.' },
      { map: 4, when: 'July 1, 1898', place: 'Kettle Hill', img: 'ush9-splendid-little-war/img/kurz-allison.jpg', credit: 'Kurz & Allison lithograph, 1899', title: 'The charge',
        text: 'For hours you lie in tall grass at the foot of the hills while bullets cut the air. Men around you are hit. No orders come. Then Roosevelt rides up on Little Texas, waving his hat.',
        opts: [
          { b: 'Charge with Roosevelt', fx: { health: -15, spirits: 25 }, r: 'You run uphill beside troopers of the 9th and 10th Cavalry. The regiments are so mixed together that nobody is in formation. Kettle Hill falls, and the line surges on to the San Juan Heights.' },
          { b: 'Stay in cover', fx: { spirits: -15 }, r: 'Nobody could blame you. But the line moves without you, and men from several regiments, Black and white, take the hill. You join them at the top.' }
        ],
        fact: 'About 200 Americans were killed and more than 1,000 wounded on July 1.' },
      { map: 6, when: 'July–Aug. 1898', place: 'Santiago, then home', img: 'ush9-splendid-little-war/img/rr-hilltop.jpg', credit: 'The Rough Riders on the captured hill, 1898', title: 'Victory, then fever',
        text: 'Santiago surrenders on July 17. Then yellow fever and malaria tear through the army. Roosevelt and other officers sign a “Round Robin” letter demanding that the troops be sent home. It leaks to the newspapers.',
        opts: [
          { b: 'Write home about what’s really happening', fx: { spirits: 10 }, r: 'Letters like yours help turn public opinion. In August the army ships out to Camp Wikoff, at Montauk, New York, to recover.' },
          { b: 'Keep quiet and tough it out', fx: { health: -10 }, r: 'Many sick men tried to tough it out. Some never made it home.' }
        ] }
    ];
    const body = $('#journey-body');
    let who, v, i, picked;
    const KEYS = [['spirits', 'Spirits'], ['health', 'Health'], ['water', 'Water']];
    function vitals() {
      return `<div class="vitals">${KEYS.map(([k, l]) => `<div class="vital${v[k] < 35 ? ' low' : ''}"><span>${l}<b>${v[k]}</b></span><div class="bar"><i style="width:${v[k]}%"></i></div></div>`).join('')}</div>`;
    }
    function goMap(n) { if (SLW.campaignMap) SLW.campaignMap.go(n, true); }
    function draw() {
      if (!who) {
        body.innerHTML = `<div class="stage">
          <p class="wire label">Choose your recruit</p>
          <div class="recruits">${RECRUITS.map(r => `<button type="button" class="recruit" data-rr="${r.id}"><b>${r.name}</b><span class="wire">${r.role}</span><span>${r.blurb}</span></button>`).join('')}</div>
          <p style="font-size:.9rem;color:var(--ink-soft)">These recruits are composite characters. Everything that happens around them really happened.</p>
        </div>`;
        return;
      }
      if (i >= STAGES.length) {
        const avg = Math.round((v.spirits + v.health + v.water) / 3);
        body.innerHTML = `<div class="stage journey-end">
          <p class="wire label">${who.name} · ${who.role}</p>
          <h4>${avg >= 55 ? 'You made it home' : 'You made it home, barely'}</h4>
          ${vitals()}
          <p>${who.name} sails north in August to Camp Wikoff, at Montauk, New York, where the whole army is quarantined while the sick recover. Some of ${who.name}’s friends are buried in Cuba.</p>
          <p>Roosevelt came home a hero. Four months later, he was elected governor of New York.</p>
          <p><em>Think:</em> Roosevelt wrote about “joy in battle.” After living the campaign, how would ${who.name} describe the war?</p>
          <div><button type="button" class="btn" data-rr="again">Ride again</button></div>
        </div>`;
        SLW.stamp('journey');
        goMap(6);
        return;
      }
      const S = STAGES[i];
      const top = `<div class="stage-photo"><img src="${S.img}" alt="${S.credit}"><span class="when wire">${S.when} · ${S.place}</span><span class="credit wire">${S.credit}</span></div>`;
      if (picked === null) {
        body.innerHTML = `<div class="stage">${top}
          ${vitals()}
          <p class="wire label">Stage ${i + 1} of ${STAGES.length} · ${who.name}</p>
          <h4>${S.title}</h4>
          <p>${S.text}</p>
          <div class="choices">${S.opts.map((o, k) => `<button type="button" class="choice" data-rr="${k}"><b>${o.b}</b></button>`).join('')}</div>
        </div>`;
      } else {
        const o = S.opts[picked];
        body.innerHTML = `<div class="stage">${top}
          ${vitals()}
          <p class="wire label">Stage ${i + 1} of ${STAGES.length} · You chose: ${o.b}</p>
          <h4>${S.title}</h4>
          <p>${o.r}</p>
          ${S.fact ? `<div class="real"><p class="wire">Real history</p><p>${S.fact}</p></div>` : ''}
          <div><button type="button" class="btn btn-yellow" data-rr="next">${i === STAGES.length - 1 ? 'Finish the campaign' : 'Keep going →'}</button></div>
        </div>`;
      }
    }
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-rr]');
      if (!b) return;
      const val = b.dataset.rr;
      if (val === 'again') { who = null; draw(); goMap(0); return; }
      if (!who) {
        who = RECRUITS.find(r => r.id === val); v = Object.assign({}, who.v); i = 0; picked = null;
        draw(); goMap(STAGES[0].map);
        return;
      }
      if (val === 'next') {
        i++; picked = null; draw();
        if (i < STAGES.length) goMap(STAGES[i].map);
        const top = $('#journey'); if (top && top.getBoundingClientRect().top < 0) body.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      picked = Number(val);
      const fx = STAGES[i].opts[picked].fx;
      Object.keys(fx).forEach(k => { v[k] = Math.max(5, Math.min(100, v[k] + fx[k])); });
      draw();
      const n = body.querySelector('[data-rr="next"]'); if (n) n.focus({ preventScroll: true });
    });
    who = null; draw();
  })();

  /* ================= Imperialist sorter ================= */
  (function () {
    const ARGS = [
      { q: 'Colonies will open huge new markets in Asia for American farmers and factories.', a: 'imp' },
      { q: 'The Declaration says governments get their power from the consent of the governed. Filipinos never consented.', a: 'anti' },
      { q: 'If we don’t take the Philippines, Germany or Japan will.', a: 'imp' },
      { q: 'Ruling other people by force will turn our republic into the kind of empire we once fought.', a: 'anti' },
      { q: 'Our Navy needs coaling stations and bases all the way across the Pacific.', a: 'imp' },
      { q: 'Filipinos have already declared their own republic. We should respect it.', a: 'anti' }
    ];
    const box = $('#sorter-body');
    let i = 0, score = 0, ans = null;
    const NAME = { imp: 'Imperialist', anti: 'Anti-imperialist' };
    function draw() {
      if (i >= ARGS.length) {
        box.innerHTML = `<div class="sort-card"><p class="wire label">Sorted</p><p style="font-family:var(--font-display);font-weight:900;font-size:3rem;line-height:1;color:var(--red)">${score} / ${ARGS.length}</p><p>Which argument do you find strongest? Which side would you have joined in 1899?</p><div><button type="button" class="btn" data-sort="again">Sort again</button></div></div>`;
        return;
      }
      const A = ARGS[i];
      box.innerHTML = `<div class="sort-card">
        <div class="sort-score wire"><span>Argument ${i + 1} of ${ARGS.length}</span><span>Score ${score}</span></div>
        <blockquote>“${A.q}”</blockquote>
        ${ans === null
          ? `<div class="sort-btns"><button type="button" class="btn btn-yellow" data-sort="imp">Imperialist</button><button type="button" class="btn" data-sort="anti">Anti-imperialist</button></div>`
          : `<p class="result-line ${ans === A.a ? 'ok' : 'no'}">${ans === A.a ? '✓ Right.' : '✗ Not quite.'} That’s an ${NAME[A.a].toLowerCase()} argument.</p><div><button type="button" class="btn btn-yellow" data-sort="next">${i === ARGS.length - 1 ? 'See score' : 'Next →'}</button></div>`}
      </div>`;
    }
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-sort]');
      if (!b) return;
      const val = b.dataset.sort;
      if (val === 'again') { i = 0; score = 0; ans = null; draw(); return; }
      if (val === 'next') { i++; ans = null; draw(); const f = box.querySelector('button'); if (f) f.focus({ preventScroll: true }); return; }
      ans = val; if (ans === ARGS[i].a) score++;
      draw(); const f = box.querySelector('[data-sort="next"]'); if (f) f.focus({ preventScroll: true });
    });
    draw();
  })();

  /* ================= Unit chart ================= */
  (function () {
    const ROWS = [
      { cls: 'us', label: 'U.S. soldiers who died in the war with Spain, 1898', n: 2446, shown: '2,446' },
      { cls: 'us', label: 'U.S. soldiers who died in the Philippine-American War', n: 4200, shown: 'about 4,200' },
      { cls: 'fil', label: 'Filipino soldiers killed', n: 20000, shown: 'over 20,000' },
      { cls: 'civ', label: 'Filipino civilians who died from violence, hunger, and disease', n: 200000, shown: 'as many as 200,000' }
    ];
    const box = $('#unit-rows');
    box.innerHTML = ROWS.map(r => {
      const full = Math.floor(r.n / 1000), frac = r.n / 1000 - full;
      let dots = '';
      for (let k = 0; k < full; k++) dots += `<i style="transition-delay:${(k * 6)}ms"></i>`;
      if (frac > 0.05) dots += `<i class="part" style="--p:${Math.round(frac * 100)}%;transition-delay:${full * 6}ms"></i>`;
      return `<div class="unit-row"><div class="unit-label"><span>${r.label}</span><b>${r.shown}</b></div><div class="dots ${r.cls}" role="img" aria-label="${r.shown}">${dots}</div></div>`;
    }).join('');
    $('#units-go').addEventListener('click', () => {
      $$('.dots', box).forEach((d, k) => setTimeout(() => d.classList.add('show'), reduce ? 0 : k * 500));
      $('#units-go').disabled = true;
    });
  })();

  /* ================= Fact or Hype ================= */
  (function () {
    const CLAIMS = [
      { claim: 'The USS Maine exploded in Havana Harbor, and 266 American sailors died.', answer: 'fact', explain: 'Well documented. What nobody has proven is what caused the explosion.' },
      { claim: 'Hearst told the artist Frederic Remington, “You furnish the pictures and I’ll furnish the war.”', answer: 'hype', explain: 'The only source is a memoir written years later. No telegram has ever been found, and Hearst denied saying it.' },
      { claim: 'Spain’s top diplomat in the U.S. privately called President McKinley weak.', answer: 'fact', explain: 'The de Lôme letter was real. De Lôme resigned the day it was printed.' },
      { claim: 'Spain blew up the Maine with an underwater mine.', answer: 'hype', explain: 'The Journal claimed it two days after the explosion with no proof. A 1976 Navy study pointed to an accidental coal fire. It has never been proven either way.' },
      { claim: 'The Rough Riders charged up San Juan Hill on horseback.', answer: 'hype', explain: 'Most of their horses never left Florida. They charged on foot, and mostly up Kettle Hill.' },
      { claim: 'Tens of thousands of Cubans died in Spain’s reconcentration camps.', answer: 'fact', explain: 'Newspapers sometimes exaggerated details, but the suffering was real. Historians estimate well over 100,000 deaths.' },
      { claim: 'The Rough Riders won the Battle of San Juan Heights on their own.', answer: 'hype', explain: 'Regular Army units, including four Black regiments, fought in the same assault.' },
      { claim: 'More U.S. soldiers died from disease than from Spanish bullets.', answer: 'fact', explain: 'Disease and other non-combat causes killed more than five times as many U.S. soldiers as combat did.' }
    ];
    const box = $('#foh');
    const st = { i: 0, score: 0, picked: null };
    function rank(s) {
      if (s === CLAIMS.length) return 'Editor-in-chief. Hearst would hate you.';
      if (s >= 6) return 'Fact-checker. Your editor trusts you.';
      if (s >= 4) return 'Cub reporter. Reread a chapter or two.';
      return 'Yellow journalist. Time to check your sources.';
    }
    function draw(focus) {
      if (st.i >= CLAIMS.length) {
        const best = Math.max(st.score, Number(store.get('foh-best', 0)) || 0);
        store.set('foh-best', best);
        box.innerHTML = `<div class="foh-result"><p class="wire label">Final score</p><p class="foh-score">${st.score} / ${CLAIMS.length}</p><p style="font-size:1.3rem;font-weight:700">${rank(st.score)}</p><p class="wire" style="color:var(--ink-soft)">Your best: ${best} / ${CLAIMS.length}</p><button type="button" class="btn btn-yellow" data-foh="again">Play again</button></div>`;
        SLW.stamp('foh');
      } else {
        const c = CLAIMS[st.i];
        const top = `<div class="foh-top wire"><span>Claim ${st.i + 1} of ${CLAIMS.length}</span><span>Score ${st.score}</span></div><p class="claim">${c.claim}</p>`;
        box.innerHTML = st.picked === null
          ? top + `<div class="foh-btns"><button type="button" class="btn btn-fact" data-foh="fact">Fact</button><button type="button" class="btn btn-hype" data-foh="hype">Hype</button></div>`
          : top + `<div class="foh-result"><span class="big-stamp ${c.answer}">${c.answer}</span><p class="result-line ${st.picked === c.answer ? 'ok' : 'no'}">${st.picked === c.answer ? '✓ You got it.' : '✗ Not quite.'}</p><p>${c.explain}</p><button type="button" class="btn btn-yellow" data-foh="next">${st.i === CLAIMS.length - 1 ? 'See my score' : 'Next claim →'}</button></div>`;
      }
      if (focus) { const f = box.querySelector(focus); if (f) f.focus({ preventScroll: true }); }
    }
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-foh]');
      if (!b) return;
      const a = b.dataset.foh;
      if (a === 'fact' || a === 'hype') { st.picked = a; if (a === CLAIMS[st.i].answer) st.score++; draw('[data-foh="next"]'); }
      else if (a === 'next') { st.i++; st.picked = null; draw(st.i >= CLAIMS.length ? '[data-foh="again"]' : '[data-foh="fact"]'); }
      else if (a === 'again') { st.i = 0; st.score = 0; st.picked = null; draw('[data-foh="fact"]'); }
    });
    draw();
  })();

  /* ================= Splendid for whom? ================= */
  (function () {
    const P = [
      { id: 'tr', name: 'Theodore Roosevelt', img: 'ush9-splendid-little-war/img/tr-field.jpg', s: 98, t: 'Totally splendid', x: 'The war made him a national hero. Within three years he was president of the United States.' },
      { id: 'hearst', name: 'William Randolph Hearst', img: 'ush9-splendid-little-war/img/hearst.jpg', s: 92, t: 'Splendid', x: 'War news sold papers, and the Journal passed a million copies a day. Hearst even sailed to Cuba to watch the fighting himself.' },
      { id: 'dewey', name: 'George Dewey', img: 'ush9-splendid-little-war/img/dewey.jpg', s: 95, t: 'Splendid', x: 'One morning’s battle made him the most famous man in America. He was promoted to Admiral of the Navy, a rank created just for him.' },
      { id: 'mckinley', name: 'William McKinley', img: 'ush9-splendid-little-war/img/mckinley.jpg', s: 75, t: 'Mostly splendid', x: 'A fast victory made him popular and helped him win re-election in 1900. It also handed him a long, bloody war in the Philippines.' },
      { id: 'rr', name: 'A Rough Rider', img: 'ush9-splendid-little-war/img/rr-hilltop.jpg', s: 58, t: 'Mixed', x: 'Glory, and a famous photo on the hill. Also heat, fever, rotten food, and friends buried in Cuba.' },
      { id: 'buffalo', name: 'A Buffalo Soldier', img: 'ush9-splendid-little-war/img/guasimas-10th.jpg', s: 35, t: 'Mostly not', x: 'He fought as bravely as anyone and got little credit. At home, segregation and violence against Black Americans were getting worse.' },
      { id: 'cuban', name: 'A Cuban rebel', img: 'ush9-splendid-little-war/img/cuba-insurgents.jpg', s: 40, t: 'Mixed', x: 'Spain was finally gone. But Cuban leaders were shut out of the surrender at Santiago and the peace talks, and the Platt Amendment limited their freedom for decades.' },
      { id: 'pr', name: 'A family in Puerto Rico', img: null, s: 30, t: 'Mostly not', x: 'Spain had just granted the island self-rule in 1897. A year later it belonged to the United States, and nobody asked Puerto Ricans.' },
      { id: 'fever', name: 'A soldier in a fever camp', img: 'ush9-splendid-little-war/img/las-guasimas.jpg', s: 10, t: 'Not splendid at all', x: 'He may never have fired a shot. More than 2,000 U.S. soldiers died of disease and other non-combat causes.' },
      { id: 'filipino', name: 'A Filipino revolutionary', img: 'ush9-splendid-little-war/img/aguinaldo.jpg', s: 4, t: 'Not splendid at all', x: 'Free of Spain, then conquered by the United States. The war that followed killed as many as 200,000 Filipino civilians.' }
    ];
    const people = $('#people'), dial = $('#dial'), text = $('#dial-text');
    people.innerHTML = P.map(p => `<button type="button" class="person" data-p="${p.id}"><span class="avatar">${p.img ? `<img src="${p.img}" alt="" loading="lazy">` : 'PR'}</span><span>${p.name}</span></button>`).join('');
    // Semicircle dial: score 0 (left, "disaster") to 100 (right, "splendid")
    const cx = 160, cy = 160, r = 120;
    const pt = (s, rr) => { const a = Math.PI * (1 - s / 100); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
    let ticks = '';
    for (let s = 0; s <= 100; s += 10) { const [x1, y1] = pt(s, r - 6), [x2, y2] = pt(s, r + 8); ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-width="${s % 50 ? 1.5 : 3}"/>`; }
    const arc = (s0, s1, col) => { const [x0, y0] = pt(s0, r), [x1, y1] = pt(s1, r); return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${col}" stroke-width="16"/>`; };
    dial.innerHTML = `<svg viewBox="0 0 320 200" role="img" aria-label="Splendid-o-meter" style="color:var(--ink)">
      ${arc(0, 33, '#B4231A')}${arc(33, 66, '#9A8F7A')}${arc(66, 100, '#F2C230')}
      ${ticks}
      <text x="22" y="190" font-family="Courier Prime, monospace" font-size="12" fill="currentColor">DISASTER</text>
      <text x="298" y="190" text-anchor="end" font-family="Courier Prime, monospace" font-size="12" fill="currentColor">SPLENDID</text>
      <g id="needle" style="transform-origin:160px 160px;transition:transform .9s cubic-bezier(.3,1.3,.5,1);transform:rotate(0deg)">
        <line x1="160" y1="160" x2="160" y2="52" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      </g>
      <circle cx="160" cy="160" r="10" fill="currentColor"/>
    </svg>`;
    text.innerHTML = `<p class="wire label">Pick a person</p><p>John Hay called it splendid. He was looking from the top. Choose someone above to see the war from their place.</p>`;
    people.addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      const p = P.find(x => x.id === b.dataset.p);
      $$('.person', people).forEach(x => x.classList.toggle('on', x === b));
      $('#needle').style.transform = `rotate(${(p.s - 50) * 1.8}deg)`;
      text.innerHTML = `<p class="wire label">${p.name}</p><h4>${p.t}</h4><p>${p.x}</p>`;
    });
  })();

  /* ================= Verdict writing ================= */
  (function () {
    const ta = $('#verdict-text');
    const radios = $$('input[name="verdict"]');
    const saved = store.get('verdict', null);
    if (saved && typeof saved === 'object') {
      if (typeof saved.text === 'string') ta.value = saved.text;
      const r = radios.find(x => x.value === saved.choice); if (r) r.checked = true;
    }
    function words() { const t = ta.value.trim(); return t ? t.split(/\s+/).length : 0; }
    function save() {
      const c = radios.find(x => x.checked);
      store.set('verdict', { choice: c ? c.value : '', text: ta.value });
      const n = words();
      $('#wc').textContent = `${n} word${n === 1 ? '' : 's'}`;
      if (n >= 40 && c) SLW.stamp('verdict');
    }
    ta.addEventListener('input', save);
    radios.forEach(r => r.addEventListener('change', save));
    save();
    $('#copy').addEventListener('click', () => {
      const c = radios.find(x => x.checked);
      const txt = `My verdict: ${c ? c.value : '(not chosen yet)'}\n\n${ta.value.trim()}`;
      const status = $('#copy-status');
      const fallback = () => { ta.focus(); ta.select(); status.textContent = 'Your writing is selected. Press Ctrl+C (or ⌘+C on a Mac) to copy it.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => { status.textContent = 'Copied. Paste it into your assignment.'; }, fallback);
      } else fallback();
    });
  })();
})();
