/* A Splendid Little War? — Santiago campaign map, empire map, Senate vote. */
(function () {
  'use strict';
  const SLW = window.SLW || {};
  const reduce = !!SLW.reduce;
  const $ = s => document.querySelector(s);
  const stamp = id => { if (SLW.stamp) SLW.stamp(id); };
  const NS = 'http://www.w3.org/2000/svg';

  /* ================= Santiago campaign (schematic, real coordinates) ================= */
  (function () {
    const host = $('#cmap-svg');
    if (!host) return;
    const W = 600, H = 340, LON0 = -75.97, LON1 = -75.58, LAT1 = 20.0977, LAT0 = 19.89;
    const X = lon => (lon - LON0) / (LON1 - LON0) * W;
    const Y = lat => (LAT1 - lat) / (LAT1 - LAT0) * H;
    const P = (lon, lat) => `${X(lon).toFixed(1)},${Y(lat).toFixed(1)}`;
    const line = pts => 'M' + pts.map(p => P(p[0], p[1])).join(' L');
    const smooth = pts => {
      const xy = pts.map(p => [X(p[0]), Y(p[1])]);
      let d = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
      for (let i = 1; i < xy.length; i++) {
        const [x0, y0] = xy[i - 1], [x1, y1] = xy[i];
        d += ` Q${x0.toFixed(1)},${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)},${((y0 + y1) / 2).toFixed(1)}`;
      }
      const last = xy[xy.length - 1];
      return d + ` L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
    };
    const coast = [[-75.97, 19.985], [-75.93, 19.982], [-75.9, 19.976], [-75.874, 19.968], [-75.862, 19.967], [-75.84, 19.966], [-75.8, 19.965], [-75.77, 19.962], [-75.74, 19.96], [-75.705, 19.957], [-75.68, 19.948], [-75.65, 19.934], [-75.63, 19.925], [-75.6, 19.92], [-75.58, 19.918]];
    const landD = line(coast) + ` L${W},0 L0,0 Z`;
    const channel = [[-75.875, 19.966], [-75.866, 19.966], [-75.864, 19.991], [-75.873, 19.991]];
    const bay = [[-75.886, 19.99], [-75.858, 19.99], [-75.843, 19.999], [-75.833, 20.012], [-75.836, 20.025], [-75.85, 20.033], [-75.872, 20.031], [-75.896, 20.021], [-75.906, 20.005], [-75.896, 19.993]];
    const PL = {
      daiquiri: [-75.63, 19.925, 'Daiquirí', 0, 16], siboney: [-75.705, 19.958, 'Siboney', 0, 16],
      guasimas: [-75.735, 19.985, 'Las Guásimas', 6, -8], elpozo: [-75.772, 20.028, 'El Pozo', 8, 4],
      elcaney: [-75.776, 20.054, 'El Caney', 8, -6], kettle: [-75.795, 20.037, 'Kettle Hill', -6, -12],
      sanjuan: [-75.806, 20.025, 'San Juan Hill', -8, 18], santiago: [-75.829, 20.02, 'SANTIAGO', -14, -12],
      morro: [-75.871, 19.969, 'El Morro', -10, 16]
    };
    const ROUTES = [
      null,
      { d: line([[-75.62, 19.896], [-75.63, 19.922]]), kind: 'us' },
      { d: smooth([[-75.63, 19.925], [-75.67, 19.944], [-75.705, 19.958], [-75.72, 19.972], [-75.735, 19.985]]), kind: 'us' },
      { d: smooth([[-75.735, 19.985], [-75.75, 20.0], [-75.762, 20.015], [-75.772, 20.028]]), kind: 'us' },
      { d: smooth([[-75.772, 20.028], [-75.783, 20.033], [-75.795, 20.037]]) + ' ' + smooth([[-75.772, 20.028], [-75.79, 20.025], [-75.806, 20.025]]) + ' ' + smooth([[-75.772, 20.028], [-75.774, 20.042], [-75.776, 20.054]]), kind: 'us' },
      { d: smooth([[-75.86, 19.996], [-75.869, 19.985], [-75.871, 19.962], [-75.89, 19.955], [-75.93, 19.958], [-75.975, 19.962]]), kind: 'es' },
      { d: smooth([[-75.776, 20.06], [-75.81, 20.055], [-75.84, 20.05], [-75.87, 20.045], [-75.9, 20.04]]) + ' ' + smooth([[-75.8, 20.008], [-75.806, 20.025], [-75.795, 20.04], [-75.776, 20.058]]), kind: 'us' }
    ];
    const CAP = [
      'Southeastern Cuba, June 1898. Spain’s Caribbean fleet is trapped in Santiago’s harbor by U.S. warships. The Army’s job: take the hills above the city.',
      'June 22: U.S. troops land at Daiquirí, east of Santiago. Horses swim ashore through the surf.',
      'June 23–24: The army moves west to Siboney. At Las Guásimas, the Rough Riders and the 1st and 10th Cavalry fight through an ambush.',
      'June 25–30: The army camps around El Pozo, in sight of the Spanish trenches on the San Juan Heights.',
      'July 1: One force attacks the village of El Caney. Another charges Kettle Hill and San Juan Hill. By night, Americans hold the heights above Santiago.',
      'July 3: Spain’s fleet dashes out of the harbor. U.S. warships chase it west along the coast and destroy every ship.',
      'July 17: Santiago surrenders. Cuban troops, who had fought Spain for three years, are kept out of the ceremony.'
    ];
    const LABELS_AT = [['santiago', 'morro'], ['daiquiri'], ['siboney', 'guasimas'], ['elpozo'], ['kettle', 'sanjuan', 'elcaney'], ['morro'], ['santiago']];
    let terrain = '';
    [[-75.805, 20.026, 0.009, 0.018], [-75.795, 20.037, 0.006, 0.006], [-75.776, 20.055, 0.008, 0.007], [-75.94, 20.04, 0.03, 0.025], [-75.7, 20.04, 0.04, 0.03], [-75.62, 20.0, 0.03, 0.035]].forEach(([lon, lat, rx, ry]) => {
      for (let k = 3; k >= 1; k--) {
        terrain += `<ellipse cx="${X(lon).toFixed(1)}" cy="${Y(lat).toFixed(1)}" rx="${(rx / (LON1 - LON0) * W * k / 3).toFixed(1)}" ry="${(ry / (LAT1 - LAT0) * H * k / 3).toFixed(1)}" fill="${k === 1 ? '#CDBF98' : 'none'}" stroke="#B9AA80" stroke-width="1" opacity="${k === 1 ? 0.7 : 0.6}"/>`;
      }
    });
    const blockade = [-75.92, -75.89, -75.86, -75.83, -75.8].map((lon, i) => `<path d="M${X(lon) - 6},${Y(19.94 - (i % 2) * 0.004)} l12,0 l-3,4 l-6,0 z" fill="#14161C"/>`).join('');
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of the Santiago campaign" font-family="Courier Prime, Courier New, monospace">
      <defs><pattern id="seaLines" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 6 Q2 4 4 6 T8 6" fill="none" stroke="#B9CBD3" stroke-width=".8"/></pattern>
      <marker id="arr-us" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#14161C"/></marker>
      <marker id="arr-es" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#B4231A"/></marker></defs>
      <rect width="${W}" height="${H}" fill="#CFDDE3"/><rect width="${W}" height="${H}" fill="url(#seaLines)"/>
      <path d="${landD}" fill="#EDE6D2" stroke="#14161C" stroke-width="1.6"/>
      <path d="${line(channel)} Z" fill="#CFDDE3"/><path d="${line(bay)} Z" fill="#CFDDE3" stroke="#14161C" stroke-width="1.2"/>
      ${terrain}
      <path d="${smooth([[-75.8, 20.006], [-75.807, 20.022], [-75.8, 20.036], [-75.788, 20.046]])}" fill="none" stroke="#B4231A" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/>
      <text x="${X(-75.818)}" y="${Y(20.003)}" font-size="9" fill="#B4231A" text-anchor="end">Spanish trenches</text>
      <g id="cm-blockade" opacity="0">${blockade}<text x="${X(-75.86)}" y="${Y(19.925)}" font-size="10" fill="#14161C" text-anchor="middle">U.S. blockade</text></g>
      <rect x="${X(-75.835) - 5}" y="${Y(20.02) - 5}" width="10" height="10" fill="#14161C"/>
      <g id="cm-routes"></g>
      <g id="cm-places"></g>
      <text x="16" y="${H - 14}" font-size="11" fill="#5d6b74" letter-spacing="2">CARIBBEAN SEA</text>
      <g transform="translate(${W - 92},${H - 26})"><line x1="0" y1="0" x2="${(0.077 / (LON1 - LON0) * W).toFixed(1)}" y2="0" stroke="#14161C" stroke-width="2"/><text x="0" y="-5" font-size="9" fill="#14161C">5 miles</text></g>
    </svg>`;
    const routes = host.querySelector('#cm-routes'), places = host.querySelector('#cm-places');
    const stepsBox = $('#cmap-steps'), cap = $('#cmap-caption');
    const NAMES = ['Overview', 'June 22', 'June 24', 'June 30', 'July 1', 'July 3', 'July 17'];
    stepsBox.innerHTML = NAMES.map((n, i) => `<button type="button" data-cm="${i}" aria-label="${n}" title="${n}">${i}</button>`).join('');
    let cur = -1;
    function go(n) {
      if (n === cur) return;
      cur = n;
      cap.textContent = CAP[n];
      stepsBox.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === n));
      host.querySelector('#cm-blockade').setAttribute('opacity', n >= 0 ? '1' : '0');
      routes.innerHTML = '';
      for (let i = 1; i <= n; i++) {
        const R = ROUTES[i]; if (!R) continue;
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', R.d); p.setAttribute('fill', 'none');
        p.setAttribute('stroke', R.kind === 'es' ? '#B4231A' : '#14161C');
        p.setAttribute('stroke-width', i === n ? '3' : '2');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('marker-end', `url(#arr-${R.kind})`);
        p.setAttribute('opacity', i === n ? '1' : '0.35');
        routes.appendChild(p);
        if (i === n && !reduce) {
          const len = p.getTotalLength();
          p.style.strokeDasharray = `${len} ${len}`; p.style.strokeDashoffset = len;
          p.getBoundingClientRect();
          p.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)';
          p.style.strokeDashoffset = '0';
          setTimeout(() => { p.style.strokeDasharray = R.kind === 'es' ? '6 4' : 'none'; }, 1450);
        } else if (R.kind === 'es') p.setAttribute('stroke-dasharray', '6 4');
      }
      places.innerHTML = Object.keys(PL).map(k => {
        const [lon, lat, name, dx, dy] = PL[k];
        const hot = LABELS_AT[n].indexOf(k) > -1;
        const x = X(lon), y = Y(lat);
        return `<g>${hot ? `<circle cx="${x}" cy="${y}" r="9" fill="#F2C230" opacity=".9"/>` : ''}<circle cx="${x}" cy="${y}" r="3.5" fill="${hot ? '#B4231A' : '#14161C'}"/>
          <text x="${x + dx}" y="${y + dy}" font-size="${hot ? 12 : 10}" font-weight="${hot ? 700 : 400}" fill="#14161C" text-anchor="${dx < 0 ? 'end' : 'start'}" paint-order="stroke" stroke="#EDE6D2" stroke-width="3">${name}</text></g>`;
      }).join('');
    }
    stepsBox.addEventListener('click', e => { const b = e.target.closest('[data-cm]'); if (b) go(Number(b.dataset.cm)); });
    SLW.campaignMap = { go: n => go(Math.max(0, Math.min(6, n))) };
    go(0);
  })();

  /* ================= Empire map ================= */
  (function () {
    const host = $('#emap');
    if (!host) return;
    const info = $('#emap-info'), legend = $('#emap-legend');
    const TERR = {
      cuba: { name: 'Cuba', at: [-79.5, 21.9], y1897: 'Spanish colony, at war for independence since 1895.', y1899: 'Occupied by U.S. troops until 1902. Then independent, but bound by the Platt Amendment.', now: 'Independent. The U.S. still runs the naval base at Guantánamo Bay.' },
      pr: { name: 'Puerto Rico', at: [-66.5, 18.2], y1897: 'Spanish colony. Spain had just granted it self-rule in 1897.', y1899: 'U.S. territory, taken in July 1898.', now: 'Still a U.S. territory. Puerto Ricans have been U.S. citizens since 1917 but can’t vote for president.' },
      hi: { name: 'Hawaii', at: [-157.5, 20.6], y1897: 'An independent republic, run by American businessmen after the 1893 overthrow of Queen Liliʻuokalani.', y1899: 'U.S. territory, annexed in July 1898.', now: 'The 50th state, since 1959.' },
      guam: { name: 'Guam', at: [144.8, 13.45], y1897: 'Spanish colony in the Pacific.', y1899: 'U.S. territory, run by the Navy.', now: 'Still a U.S. territory, with major military bases.' },
      ph: { name: 'Philippines', at: [121.8, 12.6], y1897: 'Spanish colony, in revolt since 1896.', y1899: 'Bought from Spain for $20 million. War with Filipino forces begins in February 1899.', now: 'Independent since July 4, 1946.' }
    };
    const COL = { spain: '#D2513F', us: '#F2C230', indep: '#8C9AB5', usland: '#E6DFCB', land: '#2E3A55' };
    let year = '1899', svg, polys = {}, marks, gc, gcLabel, picked = null;
    function fillFor(k) {
      if (year === '1897') return k === 'hi' ? COL.indep : COL.spain;
      return k === 'cuba' ? 'url(#hatch)' : COL.us;
    }
    function drawLegend() {
      legend.innerHTML = year === '1897'
        ? `<span><i style="background:${COL.spain}"></i>Spanish colony</span><span><i style="background:${COL.indep}"></i>Independent</span><span><i style="background:${COL.usland}"></i>United States</span>`
        : `<span><i style="background:${COL.us}"></i>U.S. territory</span><span><i style="background:repeating-linear-gradient(45deg,${COL.us} 0 3px,${COL.land} 3px 6px)"></i>U.S.-occupied (Cuba, until 1902)</span><span><i style="background:${COL.usland}"></i>United States</span>`;
    }
    function showInfo(k) {
      const T = TERR[k];
      info.innerHTML = `<p class="wire label">${T.name}</p><h4>${year === '1897' ? 'In 1897' : 'In 1899'}</h4><p>${year === '1897' ? T.y1897 : T.y1899}</p><p><strong>Today:</strong> ${T.now}</p>`;
    }
    function update() {
      Object.keys(polys).forEach(k => polys[k].forEach(p => p.setAttribute('fill', fillFor(k))));
      if (marks) marks.selectAll('circle.m').attr('fill', d => (year === '1897' ? (d === 'hi' ? COL.indep : COL.spain) : COL.us));
      if (gc) { gc.style('opacity', year === '1899' ? 1 : 0); gcLabel.style('opacity', year === '1899' ? 1 : 0); }
      drawLegend();
      if (picked) showInfo(picked);
    }
    document.querySelectorAll('.emap-toggle button').forEach(b => b.addEventListener('click', () => {
      year = b.dataset.year;
      document.querySelectorAll('.emap-toggle button').forEach(x => x.classList.toggle('on', x === b));
      update(); stamp('empire');
    }));
    drawLegend();
    if (!window.d3 || !window.topojson || !SLW.world) {
      host.innerHTML = `<img src="ush9-splendid-little-war/img/tip-to-tip.jpg" alt="Cartoon eagle stretching from Puerto Rico to the Philippines">`;
      return;
    }
    SLW.world.then(world => {
      const all = topojson.feature(world, world.objects.countries).features;
      const W = 960, H = 520;
      const proj = d3.geoNaturalEarth1().rotate([152, -5]);
      proj.fitExtent([[18, 18], [W - 18, H - 18]], { type: 'MultiPoint', coordinates: [[114, -4], [114, 47], [-64, 47], [-64, -4], [180, 50], [-150, 52], [160, -6]] });
      const path = d3.geoPath(proj);
      svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Map of the Pacific and Caribbean showing Spain’s colonies in 1897 and U.S. territories in 1899');
      const defs = svg.append('defs');
      defs.append('pattern').attr('id', 'hatch').attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)')
        .call(p => { p.append('rect').attr('width', 6).attr('height', 6).attr('fill', COL.land); p.append('rect').attr('width', 3).attr('height', 6).attr('fill', COL.us); });
      svg.append('path').datum(d3.geoGraticule10()).attr('d', path).attr('fill', 'none').attr('stroke', '#ffffff').attr('stroke-opacity', 0.06);
      const ID = { '192': 'cuba', '630': 'pr', '608': 'ph', '316': 'guam' };
      const us = all.find(f => String(f.id) === '840');
      svg.append('g').selectAll('path').data(all).join('path')
        .attr('d', path).attr('fill', d => String(d.id) === '840' ? COL.usland : COL.land).attr('stroke', '#0E1626').attr('stroke-width', 0.4);
      // Territories drawn on top so they can change color
      const tg = svg.append('g');
      all.filter(f => ID[String(f.id)]).forEach(f => {
        const k = ID[String(f.id)];
        const el = tg.append('path').datum(f).attr('d', path).attr('stroke', '#0E1626').attr('stroke-width', 0.4).style('transition', 'fill .6s');
        (polys[k] = polys[k] || []).push(el.node());
      });
      if (us && us.geometry && us.geometry.type === 'MultiPolygon') {
        const hiGeom = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: us.geometry.coordinates.filter(poly => poly[0][0][0] < -150 && poly[0][0][1] < 30) } };
        const el = tg.append('path').datum(hiGeom).attr('d', path).style('transition', 'fill .6s');
        polys.hi = [el.node()];
      }
      // 10,000 miles, tip to tip
      gc = svg.append('path').datum({ type: 'LineString', coordinates: [TERR.pr.at, TERR.ph.at] }).attr('d', path)
        .attr('fill', 'none').attr('stroke', COL.us).attr('stroke-width', 1.6).attr('stroke-dasharray', '5 5').style('transition', 'opacity .6s');
      const mid = proj(d3.geoInterpolate(TERR.pr.at, TERR.ph.at)(0.5));
      gcLabel = svg.append('text').attr('x', mid[0]).attr('y', mid[1] - 10).attr('text-anchor', 'middle').attr('fill', COL.us)
        .attr('font-family', 'Courier Prime, monospace').attr('font-size', 15).attr('letter-spacing', 1.5).text('≈ 10,000 MILES').style('transition', 'opacity .6s');
      const usLabel = proj([-100, 40]);
      if (usLabel) svg.append('text').attr('x', usLabel[0]).attr('y', usLabel[1]).attr('text-anchor', 'middle').attr('fill', '#3B4253').attr('font-family', 'Big Shoulders Display, sans-serif').attr('font-weight', 800).attr('font-size', 22).attr('letter-spacing', 2).text('UNITED STATES');
      const oc = proj([-160, 5]);
      if (oc) svg.append('text').attr('x', oc[0]).attr('y', oc[1]).attr('text-anchor', 'middle').attr('fill', '#5D6B88').attr('font-family', 'Courier Prime, monospace').attr('font-size', 14).attr('letter-spacing', 4).text('PACIFIC OCEAN');
      // Clickable markers (islands are tiny at this scale)
      marks = svg.append('g').selectAll('g').data(Object.keys(TERR)).join('g')
        .attr('transform', d => { const p = proj(TERR[d].at); return `translate(${p[0]},${p[1]})`; })
        .attr('tabindex', 0).attr('role', 'button').attr('aria-label', d => TERR[d].name).style('cursor', 'pointer');
      marks.append('circle').attr('r', 16).attr('fill', 'transparent');
      marks.append('circle').attr('class', 'm').attr('r', 6.5).attr('stroke', '#0E1626').attr('stroke-width', 2).style('transition', 'fill .6s');
      marks.append('circle').attr('class', 'pulse').attr('r', 6.5).attr('fill', 'none').attr('stroke', '#F2C230').attr('stroke-width', 1.5);
      marks.append('text').attr('x', 12).attr('y', 5).attr('fill', '#EDE9DD').attr('font-family', 'Courier Prime, monospace').attr('font-weight', 700).attr('font-size', 15)
        .attr('paint-order', 'stroke').attr('stroke', '#0E1626').attr('stroke-width', 4).text(d => TERR[d].name.toUpperCase());
      const pick = (e, d) => {
        picked = d; showInfo(d); stamp('empire');
        marks.select('circle.m').attr('r', x => x === d ? 9 : 6.5);
      };
      marks.on('click', pick).on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e, d); } });
      if (!reduce) {
        (function pulse() {
          marks.select('circle.pulse').attr('r', 6.5).attr('opacity', 0.9).transition().duration(1600).attr('r', 18).attr('opacity', 0).on('end', (d, i) => { if (i === 0) pulse(); });
        })();
      }
      update();
    }).catch(() => { host.innerHTML = `<img src="ush9-splendid-little-war/img/tip-to-tip.jpg" alt="Cartoon eagle stretching from Puerto Rico to the Philippines">`; });
  })();

  /* ================= Senate vote ================= */
  (function () {
    const host = $('#senate-svg');
    if (!host) return;
    const N = 84, NEED = 56, ROWS = 6, W = 420, H = 230, cx = W / 2, cy = 215;
    const radii = Array.from({ length: ROWS }, (_, i) => 95 + i * 22);
    const sum = radii.reduce((a, b) => a + b, 0);
    const counts = radii.map(r => Math.round(N * r / sum));
    counts[ROWS - 1] += N - counts.reduce((a, b) => a + b, 0);
    let seats = [];
    radii.forEach((r, i) => {
      for (let k = 0; k < counts[i]; k++) {
        const a = Math.PI - (k + 0.5) / counts[i] * Math.PI;
        seats.push({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a), a });
      }
    });
    seats.sort((p, q) => q.a - p.a);
    const REAL = seats.map((s, i) => i < 57);
    let votes = REAL.slice();
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Senate vote, one dot per senator">${seats.map((s, i) =>
      `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="7" data-s="${i}" tabindex="0" role="button" aria-label="Senator ${i + 1}"></circle>`).join('')}
      <text x="${cx}" y="${cy - 30}" text-anchor="middle" font-family="Big Shoulders Display, sans-serif" font-weight="900" font-size="30" fill="currentColor" id="sen-big">PASSED</text></svg>`;
    host.style.color = 'var(--ink)';
    const res = $('#senate-result');
    function draw() {
      const y = votes.filter(Boolean).length, n = N - y;
      host.querySelectorAll('circle').forEach((c, i) => {
        c.style.fill = votes[i] ? 'var(--ok)' : 'var(--red)';
        c.setAttribute('aria-label', `Senator ${i + 1}: ${votes[i] ? 'yes' : 'no'}`);
      });
      $('#yea').textContent = y; $('#nay').textContent = n;
      const pass = y >= NEED;
      host.querySelector('#sen-big').textContent = pass ? 'PASSED' : 'FAILED';
      res.className = 'senate-result ' + (pass ? 'pass' : 'fail');
      res.innerHTML = pass
        ? (y === 57 && votes.every((v, i) => v === REAL[i])
          ? `<p class="wire label">The real vote · Feb. 6, 1899</p><p>Passed 57 to 27 with one vote to spare. The U.S. took the Philippines, Guam, and Puerto Rico. Fighting in the Philippines had already started two days earlier.</p>`
          : `<p class="wire label">Still passes</p><p>${y} yes votes clears the bar of 56. Try flipping ${y - NEED + 1 === 1 ? 'one more' : (y - NEED + 1) + ' more'} senator${y - NEED + 1 === 1 ? '' : 's'}.</p>`)
        : `<p class="wire label">Counterfactual · the treaty fails</p><p>With only ${y} yes votes, the treaty is dead. Spain still owns the Philippines on paper, while Aguinaldo’s army controls most of Luzon and U.S. troops hold Manila. Does the U.S. renegotiate? Pull out? Do Germany or Japan step in? Nobody can know. One senator kept the U.S. on the road to empire.</p>`;
    }
    function flip(i) { votes[i] = !votes[i]; draw(); stamp('senate'); }
    host.addEventListener('click', e => { const c = e.target.closest('[data-s]'); if (c) flip(Number(c.dataset.s)); });
    host.addEventListener('keydown', e => { const c = e.target.closest('[data-s]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); flip(Number(c.dataset.s)); } });
    $('#senate-reset').addEventListener('click', () => { votes = REAL.slice(); draw(); });
    draw();
  })();
})();
