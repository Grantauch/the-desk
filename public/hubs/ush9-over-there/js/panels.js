/* Over There: the Lusitania, the telegram, the House vote, the trench, the film, the case files, the flu, the Fourteen Points. */
(function () {
  'use strict';
  const OT = window.OT || {};
  const $ = s => document.querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const reduce = !!OT.reduce;
  const tag = id => { if (OT.tag) OT.tag(id); };
  const esc = OT.esc;
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- Lusitania: each dot is about ten people ---------- */
  (function () {
    const field = $('#dotfield'); if (!field) return;
    const DEAD = 120, US = 13, LIVED = 76;
    const people = [];
    for (let i = 0; i < DEAD; i++) people.push({ d: true, us: i < US });
    for (let i = 0; i < LIVED; i++) people.push({ d: false });
    const shuffled = people.map((p, i) => ({ p, k: (i * 7919) % 197 })).sort((a, b) => a.k - b.k).map(x => x.p);
    function draw(list) { field.innerHTML = list.map(p => `<i class="${p.d ? 'd' : 's'}${p.us ? ' us' : ''}"></i>`).join(''); }
    draw(shuffled);
    let sorted = false;
    $('#sort-dots').addEventListener('click', () => {
      sorted = !sorted;
      if (sorted) {
        const order = people.filter(p => p.us).concat(people.filter(p => p.d && !p.us), people.filter(p => !p.d));
        draw(order);
        requestAnimationFrame(() => field.classList.add('sorted'));
        $('#dot-key').hidden = false; $('#lusi-after').hidden = false;
        $('#sort-dots').textContent = 'Mix them back up';
        tag('lusitania');
      } else {
        field.classList.remove('sorted'); draw(shuffled);
        $('#sort-dots').textContent = 'Sort the passengers';
      }
    });
  })();

  /* ---------- The Zimmermann Telegram ---------- */
  (function () {
    const host = $('#clines'); if (!host) return;
    const LINES = [
      { n: '130 13042 13401 8501 115 3528 416 17214 6491 11310 18147 18222 21560 10247 11518 23677 13605 3494 14936 98092 5905 11311 10392 10371 0302 21290 5161 39695',
        e: 'We intend to begin on the first of February <mark>unrestricted submarine warfare</mark>. We shall endeavor in spite of this to keep the United States of America neutral.' },
      { n: '23571 17504 11269 18276 18101 0317 0228 17694 4473 22284 22200 19452 21589 67893 5569 13918 8958 12137 1333 4725 4458 5905 17166 13851 4458 17149 14471 6706',
        e: 'In the event of this not succeeding, we make <mark>Mexico a proposal of alliance</mark> on the following basis: make war together, make peace together, generous financial support,' },
      { n: '13850 12224 6929 14991 7382 15857 67893 14218 36477 5870 17553 67893 5870 5454 16102 15217 22801 17138 21001 17388 7446 23638 18222 6719 14331 15021 23845',
        e: 'and an understanding on our part that Mexico is to reconquer the lost territory in <mark>Texas, New Mexico, and Arizona</mark>. The settlement in detail is left to you.' },
      { n: '3156 23552 22096 21604 4797 9497 22464 20855 4377 23610 18140 22260 5905 13347 20420 39689 13732 20667 6929 5275 18507 52262 1340 22049 13339 11265 22295 10439 14814 4178 6992 8784 7632 7357 6926 52262 11267',
        e: 'You will inform the President of the above most secretly as soon as the outbreak of war with the United States of America is certain, and add the suggestion that he should, on his own initiative, <mark>invite Japan</mark> to immediate adherence and at the same time mediate between Japan and ourselves.' },
      { n: '21100 21272 9346 9559 22464 15874 18502 18500 15857 2188 5376 7381 98092 16127 13486 9350 9220 76036 14219 5144 2831 17920 11347 17142 11264 7667 7762 15099 9110',
        e: 'Please call the President’s attention to the fact that the ruthless employment of our submarines now offers the prospect of <mark>compelling England in a few months to make peace</mark>.' },
      { n: '10482 97556 3569 3670', e: 'Signed, ZIMMERMANN.' }
    ];
    host.innerHTML = LINES.map((l, i) => `<button type="button" class="cline key" data-i="${i}" aria-expanded="false"><span class="nums">${l.n}</span><span class="eng">${l.e}</span></button>`).join('');
    const open = new Set();
    $('#dec-total').textContent = LINES.length;
    host.addEventListener('click', e => {
      const b = e.target.closest('.cline'); if (!b || b.classList.contains('open')) return;
      const i = Number(b.dataset.i), nums = b.querySelector('.nums');
      const finish = () => {
        b.classList.add('open'); b.setAttribute('aria-expanded', 'true'); open.add(i);
        $('#dec-count').textContent = open.size;
        if (open.size === LINES.length) {
          $('#dec-after').hidden = false;
          $('#dec-after').insertAdjacentHTML('afterbegin', '<p><span class="stamped">Decoded</span></p><p>“The President” in the message means Mexico’s president, Venustiano Carranza. He studied the offer and turned it down in April 1917.</p>');
          tag('decoder');
        }
      };
      if (reduce) { finish(); return; }
      // Scramble the numbers for a moment, the way a codebreaker's worksheet fills in
      const orig = nums.textContent; let t = 0;
      const iv = setInterval(() => {
        nums.textContent = orig.replace(/\d/g, () => String(Math.floor(Math.random() * 10)));
        if (++t > 7) { clearInterval(iv); nums.textContent = orig; finish(); }
      }, 55);
    });
  })();

  /* ---------- The House vote ---------- */
  (function () {
    const house = $('#house'); if (!house) return;
    const cells = [];
    for (let i = 0; i < 373; i++) cells.push('y');
    for (let i = 0; i < 50; i++) cells.push('n');
    for (let i = 0; i < 9; i++) cells.push('x');
    house.innerHTML = cells.map(c => `<i class="${c}"></i>`).join('');
    $('#vote-btns').addEventListener('click', e => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      $$('#vote-btns button').forEach(x => { x.disabled = true; x.classList.toggle('on', x === b); });
      house.classList.add('show'); $('#tally').hidden = false; $('#rankin').hidden = false;
      const you = $('#vote-you');
      if (b.dataset.v === 'y') { you.className = 'verdict-line ok'; you.textContent = 'You voted with the majority. The war resolution passed 373 to 50, and Wilson signed it that afternoon.'; }
      else { you.className = 'verdict-line no'; you.textContent = 'You voted with Jeannette Rankin and 49 others. The resolution passed anyway, 373 to 50.'; }
      tag('vote');
    });
  })();

  /* ---------- Trench cross-section ---------- */
  (function () {
    const host = $('#trench-svg'); if (!host) return;
    const W = 900, H = 420, GROUND = 170;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Cross-section drawing of a front line trench, no man’s land, and the enemy wire');
    svg.innerHTML = `
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2016"/><stop offset="1" stop-color="#2c3222"/></linearGradient>
        <linearGradient id="mud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3f2c"/><stop offset="1" stop-color="#2a2318"/></linearGradient>
        <radialGradient id="flareg"><stop offset="0" stop-color="#E9F7C5" stop-opacity=".95"/><stop offset=".35" stop-color="#E9F7C5" stop-opacity=".25"/><stop offset="1" stop-color="#E9F7C5" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="${W}" height="${GROUND + 10}" fill="url(#sky)"/>
      <circle id="flare" cx="560" cy="60" r="90" fill="url(#flareg)"/>
      <circle cx="560" cy="60" r="4" fill="#F4FFE0"/>
      <path d="M0 ${GROUND} L${W} ${GROUND} L${W} ${H} L0 ${H} Z" fill="url(#mud)"/>
      <!-- craters -->
      <g fill="#231d14" opacity=".9"><ellipse cx="420" cy="${GROUND + 6}" rx="46" ry="14"/><ellipse cx="610" cy="${GROUND + 5}" rx="30" ry="10"/><ellipse cx="520" cy="${GROUND + 7}" rx="22" ry="8"/></g>
      <!-- our trench -->
      <path d="M70 ${GROUND} L70 ${GROUND + 175} L250 ${GROUND + 175} L250 ${GROUND + 95} L285 ${GROUND + 95} L285 ${GROUND} Z" fill="#14120d"/>
      <rect x="70" y="${GROUND + 168}" width="180" height="7" fill="#6b5a3a"/>
      ${Array.from({ length: 9 }, (_, i) => `<rect x="${74 + i * 20}" y="${GROUND + 165}" width="14" height="4" fill="#8a7550"/>`).join('')}
      <path d="M70 ${GROUND + 176} L250 ${GROUND + 176} L250 ${GROUND + 186} L70 ${GROUND + 186}Z" fill="#3a4a4a" opacity=".85"/>
      <rect x="250" y="${GROUND + 95}" width="35" height="8" fill="#8a7550"/>
      <!-- sandbag parapet -->
      ${Array.from({ length: 4 }, (_, r) => Array.from({ length: 3 - (r > 1 ? 1 : 0) }, (_, c) => `<rect x="${262 + c * 22 + (r % 2) * 9}" y="${GROUND - 12 - r * 11}" width="20" height="11" rx="4" fill="#9a8a62" stroke="#5d5238"/>`).join('')).join('')}
      ${Array.from({ length: 3 }, (_, c) => `<rect x="${30 + c * 22}" y="${GROUND - 12}" width="20" height="11" rx="4" fill="#8f805a" stroke="#5d5238"/>`).join('')}
      <!-- periscope and soldier -->
      <rect x="268" y="${GROUND - 80}" width="4" height="150" fill="#5c5c50"/><rect x="262" y="${GROUND - 86}" width="14" height="8" fill="#5c5c50"/>
      <g fill="#3c3a2c"><circle cx="262" cy="${GROUND + 28}" r="10"/><path d="M247 ${GROUND + 26} q15 -12 30 0z" fill="#56563f"/><rect x="252" y="${GROUND + 38}" width="20" height="45" rx="5"/><rect x="254" y="${GROUND + 83}" width="7" height="14"/><rect x="264" y="${GROUND + 83}" width="7" height="14"/></g>
      <!-- dugout -->
      <path d="M70 ${GROUND + 110} L20 ${GROUND + 110} L20 ${GROUND + 175} L70 ${GROUND + 175}" fill="#0c0b08" stroke="#4d3f28" stroke-width="3"/>
      <rect x="22" y="${GROUND + 108}" width="50" height="5" fill="#6b5a3a"/>
      <circle cx="40" cy="${GROUND + 140}" r="3" fill="#E0703A"/><circle cx="40" cy="${GROUND + 140}" r="12" fill="#E0703A" opacity=".18"/>
      <!-- rat -->
      <g fill="#6a5f4d"><ellipse cx="175" cy="${GROUND + 160}" rx="11" ry="5"/><circle cx="186" cy="${GROUND + 158}" r="4"/><path d="M164 ${GROUND + 161} q-14 2 -20 -6" stroke="#6a5f4d" stroke-width="1.6" fill="none"/></g>
      <!-- wire belts: ours and theirs -->
      <g id="wire-ours" stroke="#b9ad8e" stroke-width="1.3" fill="none">${Array.from({ length: 5 }, (_, i) => `<path d="M${310 + i * 14} ${GROUND} l7 -26 l7 26 M${306 + i * 14} ${GROUND - 14} c6 -8 12 8 18 0"/>`).join('')}</g>
      <g id="enemy">
        <g stroke="#b9ad8e" stroke-width="1.3" fill="none">${Array.from({ length: 7 }, (_, i) => `<path d="M${i * 14} ${GROUND} l7 -26 l7 26 M${i * 14 - 4} ${GROUND - 14} c6 -8 12 8 18 0"/>`).join('')}</g>
        <path d="M120 ${GROUND} L120 ${GROUND + 120} L220 ${GROUND + 120} L220 ${GROUND}Z" fill="#14120d"/>
        ${Array.from({ length: 3 }, (_, c) => `<rect x="${106 + c * 22}" y="${GROUND - 12}" width="20" height="11" rx="4" fill="#8f805a" stroke="#5d5238"/>`).join('')}
        <text x="170" y="${GROUND + 150}" text-anchor="middle" font-family="Special Elite, monospace" font-size="15" fill="#E06C5A">ENEMY TRENCH</text>
      </g>
      <text x="160" y="${H - 14}" text-anchor="middle" font-family="Special Elite, monospace" font-size="15" fill="#C8B88A">YOUR TRENCH</text>
      <text id="nml-label" x="520" y="${GROUND + 70}" text-anchor="middle" font-family="Stardos Stencil, Impact, sans-serif" font-weight="700" font-size="22" letter-spacing="3" fill="#C8B88A" opacity=".75">NO MAN’S LAND</text>
      <path id="nml-span" d="" stroke="#C8B88A" stroke-width="2" fill="none" marker-start="" marker-end=""/>
      <g id="hots"></g>`;
    host.appendChild(svg);
    const SPOTS = [
      { x: 258, y: GROUND + 90, h: 'The fire step', p: 'A ledge built into the front wall so a soldier could see and shoot over the top. Sentries stood here in shifts through the night. At dawn and dusk, the likeliest times for an attack, every man climbed onto the fire step and “stood to” with his rifle ready.' },
      { x: 285, y: GROUND - 40, h: 'Parapet and periscope', p: 'The front wall was piled with sandbags thick enough to stop bullets. Lifting your head above it, even for a second, could draw a sniper’s shot. To watch the enemy, soldiers used periscopes, mirrors on a stick.' },
      { x: 120, y: GROUND + 178, h: 'Duckboards and mud', p: 'Wooden slats laid over a floor of mud and standing water. Days in cold water caused trench foot: feet swelled, went numb, and in bad cases had to be cut off. Officers inspected feet every day, and British soldiers rubbed them with whale oil.' },
      { x: 45, y: GROUND + 128, h: 'The dugout', p: 'Rooms dug into the trench wall for sleeping and shelter during bombardments. British dugouts were often shallow. German dugouts on the Somme were 30 feet deep or more, which is why a week of British shelling before July 1, 1916 left so many German machine gunners alive.' },
      { x: 175, y: GROUND + 150, h: 'Rats and lice', p: 'Rats grew huge feeding on food scraps and on the dead, and a single pair could produce hundreds of young in a year. Lice lived in the seams of every uniform and spread trench fever, which put tens of thousands of men in the hospital.' },
      { x: 335, y: GROUND - 32, h: 'Barbed wire', p: 'Wiring parties crawled out at night to string belts of barbed wire in front of the trench. Attackers had to find gaps or cut through, and the gaps were exactly where the enemy aimed its machine guns. A single machine gun could fire 450 to 600 rounds a minute.' },
      { x: 500, y: GROUND + 30, h: 'No man’s land', p: 'The torn ground between the lines: shell craters, mud, wire, and the bodies of men killed in earlier attacks. Going “over the top” meant climbing out of your trench on a whistle and walking or running across it, carrying about 60 pounds of gear.' }
    ];
    const hots = svg.querySelector('#hots');
    const seen = new Set();
    SPOTS.forEach((s, i) => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'hot'); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', s.h);
      g.innerHTML = `<circle cx="${s.x}" cy="${s.y}" r="22" fill="transparent"/><circle class="dotm" cx="${s.x}" cy="${s.y}" r="11"/><text x="${s.x}" y="${s.y + 5}" text-anchor="middle" font-family="Stardos Stencil, Impact, sans-serif" font-weight="700" font-size="14" fill="#0F110D" pointer-events="none">${i + 1}</text>`;
      const go = () => {
        $$('.hot', hots).forEach(x => x.classList.remove('on')); g.classList.add('on', 'seen'); seen.add(i);
        $('#trench-info').innerHTML = `<p class="wire" style="color:var(--night-soft)">${i + 1} of ${SPOTS.length}</p><h4>${esc(s.h)}</h4><p>${esc(s.p)}</p>`;
        if (seen.size === SPOTS.length) tag('trench');
      };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      hots.appendChild(g);
    });
    // No man's land width slider: the enemy trench slides right or left
    const enemy = svg.querySelector('#enemy'), span = svg.querySelector('#nml-span'), lab = svg.querySelector('#nml-label');
    const slider = $('#nml');
    function setW(yd) {
      const x0 = 380, px = 60 + (yd - 30) / (400 - 30) * 360;
      enemy.setAttribute('transform', `translate(${x0 + px},0)`);
      span.setAttribute('d', `M384 ${GROUND + 98} L${x0 + px - 4} ${GROUND + 98}`);
      lab.setAttribute('x', (x0 + (x0 + px)) / 2); lab.setAttribute('font-size', px < 130 ? 14 : 22);
      $('#nml-yd').textContent = yd;
      const fields = (yd / 100).toFixed(1).replace(/\.0$/, '');
      let note;
      if (yd <= 60) note = `About ${fields} of a football field. In places like this, soldiers could hear the enemy talking and toss grenades from trench to trench.`;
      else if (yd <= 150) note = `About ${fields} football fields. A runner covers it in well under a minute on a dry field. Now add mud, craters, wire, and 60 pounds on your back.`;
      else if (yd <= 300) note = `About ${fields} football fields. Most of the Western Front looked like this. At 500 rounds a minute, one machine gun could sweep this ground many times before an attacker got halfway.`;
      else note = `About ${fields} football fields. Some stretches were this wide or wider. The farther the walk, the longer attackers were out in the open.`;
      $('#nml-note').textContent = note;
    }
    slider.addEventListener('input', () => setW(Number(slider.value)));
    setW(Number(slider.value));
  })();

  /* ---------- The film ---------- */
  (function () {
    const btn = $('#film-play'); if (!btn) return;
    btn.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/1pjY9W-S3cI?autoplay=1&rel=0';
      f.title = 'The moment the guns fell silent, November 11, 1918';
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.allowFullscreen = true;
      $('#film-box').replaceChildren(f);
    });
    // A sound ranging trace: six lines of gunfire spikes that fall flat at eleven o'clock
    const wave = $('#wave'); if (!wave) return;
    let d = '';
    for (let row = 0; row < 3; row++) {
      const y0 = 14 + row * 21;
      let s = `M0 ${y0}`;
      for (let x = 0; x <= 600; x += 3) {
        const live = x < 430;
        const spike = live && ((x * 13 + row * 37) % 97 < 6) ? (((x + row) % 2) ? -9 : 9) : 0;
        const jitter = live ? Math.sin(x * 0.9 + row) * 1.4 : 0;
        s += ` L${x} ${(y0 + spike + jitter).toFixed(1)}`;
      }
      d += s + ' ';
    }
    wave.innerHTML = `<path d="${d}" stroke="#C8B88A" stroke-width="1.2" fill="none"/><line x1="430" y1="0" x2="430" y2="70" stroke="#E9F7C5" stroke-dasharray="3 3"/><text x="436" y="66" font-family="Special Elite, monospace" font-size="11" fill="#E9F7C5">11:00</text>`;
  })();

  /* ---------- Arrested for words ---------- */
  (function () {
    const host = $('#words-body'); if (!host) return;
    const OPTS = [['none', 'Nothing'], ['months', 'Months in prison'], ['years', 'A few years'], ['ten', 'Ten years']];
    const CASES = [
      { who: 'Charles Schenck', role: 'Socialist Party official, Philadelphia, 1917', img: '', did: 'Mailed about 15,000 leaflets to men who had been drafted. The leaflets said the draft was a kind of slavery and told them:', q: 'Do not submit to intimidation. Assert your rights.', a: 'months',
        r: 'Six months in prison. In Schenck v. United States, 1919, the Supreme Court ruled 9 to 0 against him. Justice Oliver Wendell Holmes wrote that free speech would not protect “a man in falsely shouting fire in a theatre and causing a panic.”' },
      { who: 'Jeannette Rankin', role: 'Member of Congress from Montana, 1917', img: 'rankin', did: 'Stood up in the House of Representatives during the vote on war with Germany and said:', q: 'I want to stand by my country, but I cannot vote for war.', a: 'none',
        r: 'Nothing. The Constitution protects what members of Congress say in debate and how they vote. Voters were another story: she lost her race for the Senate in 1918.' },
      { who: 'Kate Richards O’Hare', role: 'Socialist speaker, North Dakota, 1917', img: '', did: 'Gave an antiwar speech saying that the government saw mothers as nothing more than', q: '…brood sows, to raise children to get into the army and be made into fertilizer.', a: 'years',
        r: 'Sentenced to five years. She served about 14 months before President Wilson shortened her sentence in 1920. In prison she wrote about the terrible conditions and pushed for reform.' },
      { who: 'Rose Pastor Stokes', role: 'Activist and writer, 1918', img: '', did: 'Wrote a short letter to the editor of the Kansas City Star that said:', q: 'No government which is for the profiteers can also be for the people, and I am for the people, while the government is for the profiteers.', a: 'ten',
        r: 'Sentenced to ten years. An appeals court threw out her conviction in 1920, and she never served the time.' },
      { who: 'Robert Goldstein', role: 'Movie producer, Los Angeles, 1917', img: '', did: 'Made a movie about the American Revolution called The Spirit of ’76. One scene showed British soldiers attacking colonists. Britain was now America’s ally.', q: '', a: 'ten',
        r: 'Sentenced to ten years for a film about 1776. His sentence was later cut to three years.' },
      { who: 'Eugene V. Debs', role: 'Socialist leader, Canton, Ohio, June 16, 1918', img: 'debs', did: 'Gave a two hour speech to a crowd in a park, with government agents taking notes. He said:', q: 'The master class has always declared the wars; the subject class has always fought the battles.', a: 'ten',
        r: 'Sentenced to ten years, and the Supreme Court upheld it. In 1920 he ran for president from his cell in the Atlanta federal prison and won 913,693 votes. President Harding let him go home on Christmas Day, 1921.' }
    ];
    let i = 0, right = 0;
    function render() {
      if (i >= CASES.length) {
        host.innerHTML = `<div class="wcard"><p class="wire label">All case files closed</p><p style="font-family:var(--font-display);font-size:2.6rem;line-height:1">${right} of ${CASES.length}</p><p>About 2,000 people were prosecuted under the Espionage and Sedition Acts, and more than 1,000 were convicted. Congress repealed the Sedition Act in 1920, but most of the Espionage Act is still law today.</p><div><button type="button" class="text-btn" id="words-again">Read the case files again</button></div></div>`;
        $('#words-again').addEventListener('click', () => { i = 0; right = 0; render(); });
        tag('words');
        return;
      }
      const c = CASES[i];
      const face = c.img ? `<img src="${OT.base}img/${c.img}.jpg" alt="${esc(c.who)}">` : `<span class="ini" aria-hidden="true">${esc(c.who.split(' ').map(w => w[0]).join('').slice(0, 2))}</span>`;
      host.innerHTML = `<div class="wprog wire"><span>Case ${i + 1} of ${CASES.length}</span><span>Matched ${right}</span></div>
        <div class="wcard"><div class="who">${face}<div><p style="font-family:var(--font-display);font-size:1.45rem;line-height:1;text-transform:uppercase">${esc(c.who)}</p><p class="wire" style="color:var(--ink-soft)">${esc(c.role)}</p></div></div>
        <p>${esc(c.did)}</p>${c.q ? `<blockquote>“${esc(c.q)}”</blockquote>` : ''}
        <p class="wire label">What happened to them?</p>
        <div class="sentence">${OPTS.map(o => `<button type="button" data-a="${o[0]}">${o[1]}</button>`).join('')}</div>
        <div id="w-res" hidden></div></div>`;
      host.querySelector('.sentence').addEventListener('click', e => {
        const b = e.target.closest('button[data-a]'); if (!b) return;
        const ok = b.dataset.a === c.a;
        if (ok) right++;
        host.querySelectorAll('.sentence button').forEach(x => { x.disabled = true; if (x.dataset.a === c.a) x.classList.add('right'); else if (x === b) x.classList.add('pick'); });
        const res = $('#w-res');
        res.hidden = false;
        res.innerHTML = `<p class="verdict-line ${ok ? 'ok' : 'no'}">${ok ? 'You called it.' : 'Not this time.'}</p><p>${esc(c.r)}</p><div style="margin-top:.6rem"><button type="button" class="btn btn-olive" id="w-next">${i < CASES.length - 1 ? 'Next case →' : 'Close the files'}</button></div>`;
        $('#w-next').addEventListener('click', () => { i++; render(); });
        $('#w-next').focus({ preventScroll: true });
      });
    }
    render();
  })();

  /* ---------- Flu vs. bullets ---------- */
  (function () {
    const g = $('#flu-guess'); if (!g) return;
    g.addEventListener('click', e => {
      const b = e.target.closest('button[data-g]'); if (!b) return;
      $$('#flu-guess button').forEach(x => { x.disabled = true; x.classList.toggle('on', x === b); });
      $('#flu-bars').hidden = false;
      const bars = $$('#flu-bars .track i');
      requestAnimationFrame(() => { bars[0].style.width = (53402 / 63114 * 100) + '%'; bars[1].style.width = '100%'; });
      const r = $('#flu-result');
      if (b.dataset.g === 'disease') { r.className = 'verdict-line ok'; r.textContent = 'Right. More American servicemen died of disease and accidents than in combat.'; }
      else { r.className = 'verdict-line no'; r.textContent = 'Most people guess that. More American servicemen actually died of disease and accidents than in combat.'; }
      $('#flu-after').hidden = false;
      tag('flu');
    });
  })();

  /* ---------- The Fourteen Points ---------- */
  (function () {
    const host = $('#pointlist'); if (!host) return;
    const P = [
      ['Open diplomacy, no secret treaties', 'broke', 'The treaty was written mostly behind closed doors by the leaders of the four biggest winners. Secret wartime deals, like the one that brought Italy into the war, shaped who got what.'],
      ['Freedom of the seas', 'broke', 'Britain refused. Its navy had starved Germany with a blockade, and it would not give up that weapon. The point was dropped before the conference started.'],
      ['Free trade between nations', 'broke', 'Left out of the treaty entirely.'],
      ['Every nation cuts its weapons', 'part', 'Only Germany had to disarm. Its army was capped at 100,000 men, with no tanks, no air force, and no submarines. The winners kept their armies.'],
      ['Fair decisions about colonies', 'broke', 'Germany’s colonies in Africa and the Pacific were handed to Britain, France, Japan, and others to run as mandates. Nobody asked the people who lived there.'],
      ['Russia chooses its own future', 'broke', 'While the treaty was being written, Allied soldiers, including the Polar Bears from Michigan, were fighting inside Russia. Russia was not invited to Paris.'],
      ['Belgium freed and restored', 'kept', 'German troops left, Belgium got its independence back, and it gained two small border districts from Germany.'],
      ['Alsace-Lorraine back to France', 'kept', 'France got back the two provinces Germany had taken in 1871.'],
      ['Italy’s borders drawn by nationality', 'part', 'Italy got the South Tyrol, home to about 250,000 German speakers, because Britain and France had promised it that land in 1915.'],
      ['Self-rule for the peoples of Austria-Hungary', 'kept', 'The empire broke into Austria, Hungary, Czechoslovakia, and pieces of Poland, Romania, Italy, and Yugoslavia. Millions of people still ended up on the wrong side of the new borders.'],
      ['Serbia restored, with a way to the sea', 'kept', 'Serbia became the center of the new Kingdom of Serbs, Croats and Slovenes, with a long coast on the Adriatic Sea.'],
      ['A Turkish homeland, freedom for other Ottoman peoples', 'part', 'The Turks kept their homeland, after fighting a war to defend it. The Arab lands went to Britain and France as mandates instead of becoming independent.'],
      ['An independent Poland, with access to the sea', 'kept', 'Poland returned to the map with a corridor of land to the Baltic Sea and use of the port of Danzig.'],
      ['A League of Nations', 'part', 'Created in the very first part of the treaty. The United States, whose president dreamed it up, never joined.']
    ];
    const LABEL = { kept: 'Kept', part: 'Partly', broke: 'Broken' };
    host.innerHTML = P.map((p, i) => `<button type="button" class="pt" data-i="${i}" aria-expanded="false"><span class="n">${i + 1}</span><span>${esc(p[0])}</span><span class="res">${esc(p[2])}</span></button>`).join('');
    const done = new Set(), count = { kept: 0, part: 0, broke: 0 };
    host.addEventListener('click', e => {
      const b = e.target.closest('.pt'); if (!b) return;
      const i = Number(b.dataset.i);
      if (!done.has(i)) {
        done.add(i); const s = P[i][1]; count[s]++;
        b.classList.add(s);
        b.insertAdjacentHTML('beforeend', `<span class="tag">${LABEL[s]}</span>`);
        OT.countTo($('#sc-' + s), count[s], n => String(n));
        $('#sc-n').textContent = done.size;
        if (done.size === P.length) { $('#pts-after').hidden = false; tag('points'); }
      }
      const open = !b.classList.contains('open');
      b.classList.toggle('open', open); b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  })();

  /* ---------- Verdict word count ---------- */
  (function () {
    const ta = $('#verdict-text'); if (!ta) return;
    const radios = $$('input[name="verdict"]');
    function count() {
      const t = ta.value.trim(), n = t ? t.split(/\s+/).length : 0;
      $('#wc').textContent = `${n} word${n === 1 ? '' : 's'}`;
      if (n >= 60 && radios.some(r => r.checked)) tag('verdict');
    }
    ta.addEventListener('input', count);
    radios.forEach(r => r.addEventListener('change', count));
    count();
  })();
})();
