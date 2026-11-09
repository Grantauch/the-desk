/* Over There: Europe in 1914, the Western Front, the Great Migration, and the empires that fell. */
(function () {
  'use strict';
  const OT = window.OT || {};
  const $ = s => document.querySelector(s);
  const reduce = !!OT.reduce;
  const tag = id => { if (OT.tag) OT.tag(id); };
  const esc = OT.esc || (s => s);
  if (!window.d3 || !window.topojson) return;

  const C = { central: '#B8473B', allied: '#3F6094', out: '#8E8B7A', land: '#EFE8D4', neutral: '#E4DCC4', sea: '#C9D3CF', line: '#6B6655', ink: '#1D1E19', gold: '#B8901F' };

  /* ---------- helpers ---------- */
  function svgEl(host, W, H, label) {
    const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
    const defs = svg.append('defs');
    return { svg, defs };
  }
  function hatch(defs, id, color, bg) {
    const p = defs.append('pattern').attr('id', id).attr('width', 7).attr('height', 7).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
    p.append('rect').attr('width', 7).attr('height', 7).attr('fill', bg);
    p.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 7).attr('stroke', color).attr('stroke-width', 2.4);
  }
  function arrowHead(defs, id, color) {
    defs.append('marker').attr('id', id).attr('viewBox', '0 0 10 10').attr('refX', 8).attr('refY', 5).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto-start-reverse')
      .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', color);
  }
  function grid(g, W, H, step) {
    // Trench-map squares, lettered along the top edge
    const gg = g.append('g').attr('pointer-events', 'none');
    for (let x = step; x < W; x += step) gg.append('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', H).attr('stroke', 'rgba(44,76,124,.16)').attr('stroke-width', 1);
    for (let y = step; y < H; y += step) gg.append('line').attr('x1', 0).attr('x2', W).attr('y1', y).attr('y2', y).attr('stroke', 'rgba(44,76,124,.16)').attr('stroke-width', 1);
    'ABCDEFGHIJKLMNOP'.split('').forEach((L, i) => { const x = i * step + step / 2; if (x < W) gg.append('text').attr('x', x).attr('y', 14).attr('text-anchor', 'middle').attr('font-family', 'Special Elite, monospace').attr('font-size', 11).attr('fill', 'rgba(44,76,124,.55)').text(L); });
  }
  const bboxPoly = (w, s, e, n) => ({ type: 'MultiPoint', coordinates: [[w, s], [e, s], [e, n], [w, n], [(w + e) / 2, s], [(w + e) / 2, n]] });

  /* ---------- Europe: modern countries grouped into 1914 states ---------- */
  const POLITY = {
    GER: ['276'], AH: ['040', '348', '203', '703', '705', '191', '070'],
    RUS: ['643', '246', '233', '428', '440', '112', '804', '616', '498'],
    OTT: ['792', '760', '368', '400', '422', '376', '275'],
    UK: ['826', '372'], FRA: ['250'], BEL: ['056'], SRB: ['688', '807', 'Kosovo'], MNE: ['499'], ITA: ['380'], BUL: ['100'],
    ROU: ['642'], GRE: ['300'], POR: ['620']
  };
  const polityOf = {};
  Object.keys(POLITY).forEach(k => POLITY[k].forEach(id => { polityOf[id] = k; }));
  const keyOf = f => (f.properties && f.properties.name === 'Kosovo') ? 'Kosovo' : String(f.id);
  const CITY = {
    sarajevo: [18.41, 43.86, 'Sarajevo'], vienna: [16.37, 48.21, 'Vienna'], belgrade: [20.45, 44.79, 'Belgrade'], berlin: [13.4, 52.52, 'Berlin'],
    paris: [2.35, 48.86, 'Paris'], brussels: [4.35, 50.85, 'Brussels'], london: [-0.13, 51.51, 'London'], stpete: [30.33, 59.93, 'St. Petersburg'],
    istanbul: [28.98, 41.01, 'Constantinople'], rome: [12.5, 41.9, 'Rome'], sofia: [23.32, 42.7, 'Sofia'], bucharest: [26.1, 44.43, 'Bucharest'],
    lisbon: [-9.14, 38.72, 'Lisbon'], athens: [23.73, 37.98, 'Athens'], atlantic: [-11, 46.5, '']
  };

  const DAYS = [
    { d: 'June 28', h: 'Shots in Sarajevo', side: {}, arrows: [], pins: ['sarajevo'],
      p: 'Archduke Franz Ferdinand and his wife Sophie are killed in Sarajevo, the capital of Bosnia. Austria-Hungary had taken over Bosnia in 1908, and many Bosnian Serbs wanted to join Serbia instead. Austria-Hungary blames Serbia’s government.' },
    { d: 'July 23', h: 'The ultimatum', side: { AH: 'c' }, arrows: [['vienna', 'belgrade', 'dash']], pins: ['vienna', 'belgrade'],
      p: 'Germany has promised Austria-Hungary its full support, a promise historians call the “blank check.” Austria-Hungary sends Serbia ten harsh demands and gives it 48 hours to answer. Serbia accepts almost all of them. Austria-Hungary says almost is not enough.' },
    { d: 'July 28', h: 'Austria-Hungary declares war on Serbia', side: { AH: 'c', SRB: 'a' }, arrows: [['vienna', 'belgrade']], pins: ['vienna', 'belgrade'],
      p: 'Austrian guns shell Belgrade the next day. So far this is a war between two countries. Everyone now watches Russia.' },
    { d: 'July 30', h: 'Russia mobilizes', side: { AH: 'c', SRB: 'a', RUS: 'a' }, arrows: [['stpete', 'belgrade', 'dash']], pins: ['stpete'],
      p: 'Tsar Nicholas II calls up Russia’s army to protect Serbia, a fellow Slavic and Orthodox Christian nation. Russia’s army is the largest in Europe, and it takes weeks to gather. Germany sees the clock start.' },
    { d: 'August 1', h: 'Germany declares war on Russia', side: { AH: 'c', SRB: 'a', RUS: 'a', GER: 'c' }, arrows: [['berlin', 'stpete']], pins: ['berlin'],
      p: 'Germany demands that Russia stop. Russia refuses. Germany declares war, and now the alliance with France matters.' },
    { d: 'August 3', h: 'Germany declares war on France', side: { AH: 'c', SRB: 'a', RUS: 'a', GER: 'c', FRA: 'a' }, arrows: [['berlin', 'paris']], pins: ['paris'],
      p: 'Germany’s war plan, the Schlieffen Plan, says to beat France in about six weeks, then turn east to fight Russia. The fastest road to Paris runs through Belgium.' },
    { d: 'August 4', h: 'Belgium invaded, Britain declares war', side: { AH: 'c', SRB: 'a', RUS: 'a', GER: 'c', FRA: 'a', BEL: 'a', UK: 'a' }, arrows: [['berlin', 'brussels'], ['london', 'brussels', 'dash']], pins: ['brussels', 'london'],
      p: 'German troops cross into neutral Belgium. Britain had promised in 1839 to protect Belgium’s neutrality, and it declares war that night. Thirty-seven days after Sarajevo, five great powers are at war.' },
    { d: 'Nov. 1914', h: 'The Ottoman Empire joins Germany', side: { AH: 'c', SRB: 'a', RUS: 'a', GER: 'c', FRA: 'a', BEL: 'a', UK: 'a', MNE: 'a', OTT: 'c' }, arrows: [['berlin', 'istanbul', 'dash']], pins: ['istanbul'],
      p: 'The Ottoman Empire controls the straits at Constantinople, the only sea route from Russia’s Black Sea ports to its allies. In 1915 British, French, Australian, and New Zealand troops try to force the straits at Gallipoli and fail.' },
    { d: 'May 1915', h: 'Italy switches sides', side: { AH: 'c', SRB: 'a', RUS: 'a', GER: 'c', FRA: 'a', BEL: 'a', UK: 'a', MNE: 'a', OTT: 'c', ITA: 'a' }, arrows: [['rome', 'vienna']], pins: ['rome'],
      p: 'Before the war Italy was allied with Germany and Austria-Hungary, but it stayed out in 1914. In a secret treaty, Britain and France promised Italy Austrian land if it fought on their side. It did.' },
    { d: 'Oct. 1915', h: 'Bulgaria joins the Central Powers', side: { AH: 'c', SRB: 'a', RUS: 'a', GER: 'c', FRA: 'a', BEL: 'a', UK: 'a', MNE: 'a', OTT: 'c', ITA: 'a', BUL: 'c' }, arrows: [['sofia', 'belgrade']], pins: ['sofia'],
      p: 'Bulgaria wanted land it had lost to Serbia in the Balkan Wars of 1912 and 1913. With Bulgaria attacking from the east, Serbia is overrun by the end of 1915.' },
    { d: '1916–1917', h: 'More countries join the Allies', side: { AH: 'c', SRB: 'a', RUS: 'a', GER: 'c', FRA: 'a', BEL: 'a', UK: 'a', MNE: 'a', OTT: 'c', ITA: 'a', BUL: 'c', POR: 'a', ROU: 'a', GRE: 'a' }, arrows: [['atlantic', 'paris']], pins: ['bucharest', 'lisbon', 'athens'],
      p: 'Portugal enters in March 1916 and Romania in August 1916. Greece joins in June 1917. And from across the Atlantic, the United States declares war on Germany on April 6, 1917.' },
    { d: 'March 1918', h: 'Russia quits the war', side: { AH: 'c', SRB: 'a', RUS: 'x', GER: 'c', FRA: 'a', BEL: 'a', UK: 'a', MNE: 'a', OTT: 'c', ITA: 'a', BUL: 'c', POR: 'a', ROU: 'a', GRE: 'a' }, arrows: [], pins: ['stpete'],
      p: 'Revolution topples the tsar in March 1917. In November the Bolsheviks, led by Vladimir Lenin, take power promising “peace, land, and bread.” In the Treaty of Brest-Litovsk, March 3, 1918, Russia hands Germany a huge strip of its western lands and leaves the war. Germany can now move its eastern armies to France.' }
  ];

  OT.whenNear($('#europe-map'), () => {
    OT.world.then(world => {
      const host = $('#europe-map'); if (!host) return;
      const W = 820, H = 620;
      const all = topojson.feature(world, world.objects.countries).features;
      const proj = d3.geoConicConformal().rotate([-15, 0]).parallels([40, 60]).fitExtent([[0, 0], [W, H]], bboxPoly(-10.5, 35, 40, 61.5)).clipExtent([[0, 0], [W, H]]);
      const path = d3.geoPath(proj);
      const { svg, defs } = svgEl(host, W, H, 'Map of Europe in 1914 showing which countries joined each side');
      hatch(defs, 'h-out', '#8E8B7A', '#E4DCC4');
      arrowHead(defs, 'ah-c', C.central); arrowHead(defs, 'ah-a', C.allied); arrowHead(defs, 'ah-k', C.ink);
      svg.append('rect').attr('width', W).attr('height', H).attr('fill', C.sea);
      grid(svg, W, H, 82);
      const feats = all.filter(f => path(f));
      const shapes = svg.append('g').selectAll('path').data(feats).join('path').attr('d', path).attr('stroke', '#8b846c').attr('stroke-width', .6).attr('fill', C.neutral);
      // polity outlines thicker
      const outline = svg.append('g').attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 1.4).attr('opacity', .55);
      Object.keys(POLITY).forEach(k => {
        const fs = feats.filter(f => polityOf[keyOf(f)] === k);
        if (!fs.length) return;
        const merged = topojson.merge(world, world.objects.countries.geometries.filter(g => polityOf[(g.properties && g.properties.name === 'Kosovo') ? 'Kosovo' : String(g.id)] === k));
        outline.append('path').attr('d', path(merged));
      });
      const arrowG = svg.append('g');
      const pinG = svg.append('g');
      const PLABEL = { GER: [11, 51.2, 'GERMANY'], AH: [17.5, 47.6, 'AUSTRIA-HUNGARY'], RUS: [31, 55.5, 'RUSSIA'], OTT: [33, 39.2, 'OTTOMAN EMP.'], FRA: [2.4, 46.6, 'FRANCE'], UK: [-2, 53, 'BRITAIN'], ITA: [12.6, 43, 'ITALY'], SRB: [20.8, 43.9, 'SERBIA'], BUL: [25.2, 42.8, 'BULG.'], ROU: [25, 45.9, 'ROMANIA'], BEL: [4.6, 50.6, 'BELG.'], GRE: [22, 39.6, 'GREECE'], POR: [-8.1, 39.9, 'PORT.'] };
      const labG = svg.append('g').attr('pointer-events', 'none');
      Object.keys(PLABEL).forEach(k => {
        const [lon, lat, t] = PLABEL[k], p = proj([lon, lat]);
        if (!p) return;
        labG.append('text').attr('x', p[0]).attr('y', p[1]).attr('text-anchor', 'middle').attr('font-family', 'Stardos Stencil, Impact, sans-serif').attr('font-weight', 700).attr('font-size', k === 'RUS' ? 22 : 13).attr('letter-spacing', '.06em').attr('fill', 'rgba(29,30,25,.72)').text(t);
      });

      const legend = $('#europe-legend');
      legend.innerHTML = `<span><i style="background:${C.central}"></i>Central Powers</span><span><i style="background:${C.allied}"></i>Allies</span><span><i style="background:${C.neutral}"></i>Not at war</span><span><i style="background:repeating-linear-gradient(45deg,#8E8B7A 0 2px,#E4DCC4 2px 5px)"></i>Out of the war</span>`;

      const bar = $('#daybar'), info = $('#days-info');
      const seen = new Set();
      bar.innerHTML = DAYS.map((d, i) => `<button type="button" data-i="${i}" aria-pressed="false">${esc(d.d)}</button>`).join('') + '';
      function show(i) {
        const D = DAYS[i];
        seen.add(i);
        bar.querySelectorAll('button').forEach((b, j) => { b.classList.toggle('on', j === i); b.classList.toggle('seen', seen.has(j)); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
        shapes.transition().duration(reduce ? 0 : 500).attr('fill', f => {
          const s = D.side[polityOf[keyOf(f)]];
          return s === 'c' ? C.central : s === 'a' ? C.allied : s === 'x' ? 'url(#h-out)' : C.neutral;
        });
        labG.selectAll('text').attr('fill', function () { return 'rgba(29,30,25,.72)'; });
        arrowG.selectAll('*').remove();
        D.arrows.forEach(([a, b, dash]) => {
          const p1 = proj(CITY[a].slice(0, 2)), p2 = proj(CITY[b].slice(0, 2));
          if (!p1 || !p2) return;
          const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2 - Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.22;
          const pth = arrowG.append('path').attr('d', `M${p1[0]},${p1[1]} Q${mx},${my} ${p2[0]},${p2[1]}`).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 3).attr('stroke-linecap', 'round').attr('marker-end', 'url(#ah-k)');
          if (dash) pth.attr('stroke-dasharray', '7 6');
          if (!reduce && !dash) { const L = pth.node().getTotalLength(); pth.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().duration(700).attr('stroke-dashoffset', 0); }
          if (a === 'atlantic') arrowG.append('text').attr('x', p1[0] + 4).attr('y', p1[1] - 10).attr('font-family', 'Stardos Stencil, Impact, sans-serif').attr('font-weight', 700).attr('font-size', 16).attr('fill', C.ink).text('U.S.A. →');
        });
        pinG.selectAll('*').remove();
        D.pins.forEach(k => {
          const p = proj(CITY[k].slice(0, 2)); if (!p) return;
          const g = pinG.append('g').attr('transform', `translate(${p[0]},${p[1]})`);
          g.append('circle').attr('r', 6).attr('fill', '#F5F0E3').attr('stroke', C.ink).attr('stroke-width', 2.5);
          g.append('text').attr('x', 9).attr('y', -8).attr('font-family', 'Special Elite, monospace').attr('font-size', 13).attr('fill', C.ink).attr('paint-order', 'stroke').attr('stroke', '#F5F0E3').attr('stroke-width', 4).text(CITY[k][2]);
        });
        info.innerHTML = `<p class="wire date">${esc(D.d)}${i < 7 ? ', 1914' : ''}</p><h4>${esc(D.h)}</h4><p>${esc(D.p)}</p>
          <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.25rem">${i > 0 ? '<button type="button" class="btn" data-step="-1">← Back</button>' : ''}${i < DAYS.length - 1 ? '<button type="button" class="btn btn-olive" data-step="1">Next date →</button>' : ''}</div>`;
        if (seen.size === DAYS.length) tag('days');
      }
      bar.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) show(Number(b.dataset.i)); });
      info.addEventListener('click', e => { const b = e.target.closest('button[data-step]'); if (!b) return; const cur = Number(bar.querySelector('.on').dataset.i); show(Math.max(0, Math.min(DAYS.length - 1, cur + Number(b.dataset.step)))); });
      show(0);
    }).catch(() => { $('#europe-map').insertAdjacentHTML('beforeend', '<p style="padding:2rem">The map could not load. Refresh the page to try again.</p>'); });
  });

  /* ---------- Empires before and after ---------- */
  const EMPIRE14 = { GER: ['276'], AH: ['040', '348', '203', '703', '705', '191', '070'], RUS: ['643', '246', '233', '428', '440', '112', '804', '616', '498'], OTT: ['792', '760', '368', '400', '422', '376', '275'] };
  const EMP_COLOR = { GER: '#6E6A5A', AH: '#B8901F', RUS: '#3F6094', OTT: '#B8473B' };
  const EMP_INFO = {
    GER: ['German Empire', 'Ruled by Kaiser Wilhelm II. He gave up his throne on November 9, 1918, two days before the armistice, and fled to the Netherlands. Germany became a republic.'],
    AH: ['Austria-Hungary', 'Ruled by the Habsburg family for centuries and home to more than a dozen nationalities. Emperor Franz Joseph had reigned since 1848 and died in 1916. His successor, Karl, gave up power in November 1918 and the empire broke apart.'],
    RUS: ['Russian Empire', 'Ruled by Tsar Nicholas II, who gave up his throne in March 1917. The Bolsheviks shot him and his family in July 1918. Russia fell into a civil war and became the Soviet Union in 1922.'],
    OTT: ['Ottoman Empire', 'Ruled from Constantinople for more than 600 years, across Turkey and the Arab Middle East. After the war its Arab lands were handed to Britain and France, and the last sultan was removed in 1922.']
  };
  const NEW20 = {
    POL: { ids: ['616'], color: '#C9574C', name: 'Poland', p: 'Poland had been carved up by Russia, Prussia, and Austria in 1795 and erased from the map for 123 years. Point 13 of Wilson’s plan brought it back in 1918, with a strip of land to the Baltic Sea that Germans called the “Polish Corridor.”' },
    CZS: { ids: ['203', '703'], color: '#6B8E4E', name: 'Czechoslovakia', p: 'Czechs and Slovaks broke away from Austria-Hungary in October 1918. Their leader, Tomáš Masaryk, spent the last months of the war in the United States and wrote their declaration of independence in Washington.' },
    YUG: { ids: ['688', '191', '705', '070', '499', '807', 'Kosovo'], color: '#B8901F', name: 'Yugoslavia', p: 'Founded December 1, 1918, as the Kingdom of Serbs, Croats and Slovenes. It joined Serbia and Montenegro with the South Slav lands of Austria-Hungary. It took the name Yugoslavia, “land of the South Slavs,” in 1929.' },
    AUT: { ids: ['040'], color: '#8C6BA8', name: 'Austria', p: 'All that was left of the Habsburg empire’s German-speaking core, about 6.5 million people. The treaties forbade it to join with Germany. Hitler, who was born in Austria, did exactly that in 1938.' },
    HUN: { ids: ['348'], color: '#4E8C8C', name: 'Hungary', p: 'In the Treaty of Trianon, 1920, Hungary lost nearly three quarters of its old kingdom’s land. Millions of Hungarians suddenly lived in Romania, Czechoslovakia, or Yugoslavia.' },
    FIN: { ids: ['246'], color: '#5E86B5', name: 'Finland', p: 'Ruled by the Russian tsar since 1809. Finland declared independence on December 6, 1917, a month after the Bolsheviks took power in Russia.' },
    BAL: { ids: ['233', '428', '440'], color: '#7D9B6A', name: 'Estonia, Latvia, and Lithuania', p: 'The three Baltic nations declared independence from Russia in 1918 and fought until 1920 to keep it. The Soviet Union took them back in 1940.' }
  };
  const MANDATE = { ids: ['760', '422', '368', '400', '376', '275'], p: ['Mandates', 'The Ottoman Empire’s Arab lands became “mandates.” France took Syria and Lebanon. Britain took Iraq, Palestine, and Transjordan. Arab leaders who had fought the Ottomans had been promised independence.'] };
  const OTHER20 = {
    '276': ['Germany', 'Lost Alsace-Lorraine to France, a corridor of land to Poland, and every one of its overseas colonies. Its army was capped at 100,000 men and it was forbidden to have an air force.'],
    '643': ['Soviet Russia', 'The Bolsheviks won a civil war that lasted until 1922. Russia lost Finland, the Baltic states, and Poland, and became the Soviet Union.'],
    '792': ['Turkey', 'Turkish nationalists led by Mustafa Kemal fought off Greek, French, and British forces and founded the Republic of Turkey in 1923.'],
    '250': ['France', 'Won back Alsace-Lorraine, which Germany had taken in 1871. France also lost about 1.4 million soldiers, more than any other Western Allied country.'],
    '642': ['Romania', 'Nearly doubled in size, gaining Transylvania from Hungary and Bessarabia from Russia.'],
    '380': ['Italy', 'Gained Trieste and the South Tyrol, but not all the land it was promised. Many Italians called it a “mutilated victory,” and that anger helped Mussolini come to power in 1922.']
  };
  OT.whenNear($('#empire-map'), () => {
    OT.world.then(world => {
      const host = $('#empire-map'); if (!host) return;
      const W = 820, H = 620;
      const all = topojson.feature(world, world.objects.countries).features;
      const proj = d3.geoConicConformal().rotate([-18, 0]).parallels([40, 60]).fitExtent([[0, 0], [W, H]], bboxPoly(-8, 30, 48, 64)).clipExtent([[0, 0], [W, H]]);
      const path = d3.geoPath(proj);
      const { svg, defs } = svgEl(host, W, H, 'Map of Europe comparing the empires of 1914 with the new countries of 1920');
      svg.append('rect').attr('width', W).attr('height', H).attr('fill', C.sea);
      grid(svg, W, H, 82);
      const feats = all.filter(f => path(f));
      const newOf = {}; Object.keys(NEW20).forEach(k => NEW20[k].ids.forEach(id => { newOf[id] = k; }));
      const empOf = {}; Object.keys(EMPIRE14).forEach(k => EMPIRE14[k].forEach(id => { empOf[id] = k; }));
      let year = '1920';
      const shapes = svg.append('g').selectAll('path').data(feats).join('path').attr('d', path).attr('stroke', '#7d775f').attr('stroke-width', .7)
        .attr('tabindex', 0).attr('role', 'button').style('cursor', 'pointer')
        .attr('aria-label', f => f.properties ? f.properties.name : 'country');
      const info = $('#empire-info');
      function color(f) {
        const k = keyOf(f);
        if (year === '1914') return empOf[k] ? EMP_COLOR[empOf[k]] : C.neutral;
        if (newOf[k]) return NEW20[newOf[k]].color;
        if (MANDATE.ids.indexOf(k) > -1) return 'url(#h-man)';
        return C.neutral;
      }
      hatch(defs, 'h-man', '#B8473B', '#E4DCC4');
      function paint() { shapes.transition().duration(reduce ? 0 : 450).attr('fill', color); legend(); }
      function legend() {
        const L = $('#empire-legend');
        L.innerHTML = year === '1914'
          ? Object.keys(EMP_COLOR).map(k => `<span><i style="background:${EMP_COLOR[k]}"></i>${EMP_INFO[k][0]}</span>`).join('')
          : Object.keys(NEW20).map(k => `<span><i style="background:${NEW20[k].color}"></i>${NEW20[k].name}</span>`).join('') + `<span><i style="background:repeating-linear-gradient(45deg,#B8473B 0 2px,#E4DCC4 2px 5px)"></i>British and French mandates</span>`;
      }
      function pick(f) {
        const k = keyOf(f);
        let t = null;
        if (year === '1914') { if (empOf[k]) t = EMP_INFO[empOf[k]]; }
        else if (newOf[k]) t = [NEW20[newOf[k]].name, NEW20[newOf[k]].p];
        else if (MANDATE.ids.indexOf(k) > -1) t = MANDATE.p;
        else if (OTHER20[k]) t = OTHER20[k];
        if (!t) t = [f.properties ? f.properties.name : 'This country', year === '1914' ? 'Not part of the four great empires that fell. Tap one of the colored empires.' : 'Its borders did not change much in the peace treaties. Tap a colored country.'];
        info.innerHTML = `<p class="wire label">${year === '1914' ? 'Before: 1914' : 'After: 1920'}</p><h4>${esc(t[0])}</h4><p>${esc(t[1])}</p>`;
        shapes.attr('stroke-width', d => d === f ? 2.5 : .7).attr('stroke', d => d === f ? C.ink : '#7d775f');
      }
      shapes.on('click', (e, f) => pick(f)).on('keydown', (e, f) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(f); } });
      $('#emp-toggle').addEventListener('click', e => {
        const b = e.target.closest('button[data-y]'); if (!b) return;
        year = b.dataset.y;
        $('#emp-toggle').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        paint();
        info.innerHTML = year === '1914' ? '<p class="wire label">Before: 1914</p><h4>Four empires</h4><p>Germany, Austria-Hungary, Russia, and the Ottoman Empire ruled most of central and eastern Europe and the Middle East. Tap one.</p>' : '<p class="wire label">After: 1920</p><h4>Nine new countries</h4><p>Nine new countries appeared on the map of Europe between 1917 and 1920. Tap one.</p>';
      });
      paint();
    }).catch(() => {});
  });

  /* ---------- The Western Front ---------- */
  const L1914 = [[2.73, 51.14], [2.86, 51.03], [2.93, 50.92], [2.97, 50.85], [2.9, 50.74], [2.88, 50.66], [2.8, 50.55], [2.78, 50.45], [2.78, 50.36], [2.8, 50.28], [2.68, 50.16], [2.7, 50.05], [2.75, 49.9], [2.8, 49.8], [2.8, 49.68], [2.92, 49.55], [3.05, 49.47], [3.3, 49.42], [3.55, 49.45], [3.8, 49.43], [4.0, 49.3], [4.35, 49.2], [4.7, 49.18], [4.95, 49.2], [5.25, 49.25], [5.5, 49.2], [5.6, 49.1], [5.55, 48.92], [5.8, 48.92], [6.05, 48.92], [6.3, 48.85], [6.65, 48.68], [6.9, 48.5], [7.05, 48.3], [7.1, 48.05], [7.1, 47.8], [7.15, 47.5]];
  const TAIL = L1914.slice(L1914.findIndex(p => p[0] === 4.7));
  const L1918 = [[2.73, 51.14], [2.86, 51.03], [2.85, 50.9], [2.78, 50.8], [2.62, 50.72], [2.55, 50.65], [2.68, 50.52], [2.78, 50.42], [2.78, 50.3], [2.62, 50.18], [2.5, 50.03], [2.45, 49.88], [2.45, 49.77], [2.55, 49.65], [2.85, 49.52], [3.05, 49.4], [3.15, 49.3], [3.25, 49.15], [3.35, 49.05], [3.6, 49.06], [3.85, 49.12], [4.0, 49.2], [4.1, 49.25], [4.35, 49.2]].concat(TAIL);
  const LNOV = [[3.8, 51.25], [3.75, 51.05], [3.7, 50.85], [3.78, 50.63], [3.95, 50.45], [4.05, 50.3], [4.2, 50.1], [4.45, 49.92], [4.7, 49.78], [4.95, 49.7], [5.2, 49.5], [5.4, 49.35], [5.55, 49.15], [5.85, 49.0], [6.05, 48.92]].concat(L1914.slice(L1914.findIndex(p => p[0] === 6.3)));
  const MOMENTS = [
    { k: '1914', label: 'Dec. 1914', line: L1914, pins: ['marne', 'ypres'], cap: 'By December 1914 the line ran about 440 miles from the North Sea to Switzerland. It would barely move for three years.' },
    { k: '1916', label: '1916', line: L1914, pins: ['verdun', 'somme'], cap: '1916 brought the two longest battles of the war. Millions of shells moved the line a few miles.' },
    { k: '1918a', label: 'July 1918', line: L1918, pins: ['cantigny', 'belleau', 'johnson'], cap: 'With Russia out of the war, Germany threw everything at the West in the spring of 1918 and pushed to within about 50 miles of Paris. Fresh American divisions helped stop them.' },
    { k: '1918b', label: 'Nov. 11, 1918', line: LNOV, pins: ['stmihiel', 'meuse', 'lostbn', 'york'], cap: 'From August the Allies attacked all along the line. When the guns stopped, German troops were still on French and Belgian soil, but their army was falling apart.' }
  ];
  const PINS = {
    marne: { at: [3.3, 48.95], kind: 'old', h: 'The Marne', when: 'Sept. 6–12, 1914', p: 'German armies got within about 30 miles of Paris. The French rushed reinforcements to the front, some of them in Paris taxicabs. The Germans fell back to the Aisne River and dug in. That was the beginning of the trenches.' },
    ypres: { at: [2.88, 50.85], kind: 'old', h: 'Ypres', when: 'April 22, 1915', p: 'German troops opened thousands of cylinders of chlorine gas and let the wind carry a green yellow cloud into the Allied trenches. It was the first big gas attack on the Western Front. By the end of the war both sides used gas, and soldiers carried masks everywhere.' },
    verdun: { at: [5.38, 49.16], kind: 'old', h: 'Verdun', when: 'Feb. 21 to Dec. 18, 1916', p: 'Germany attacked the French fortress city. Its commander later claimed the goal was to “bleed France white.” The French held. Ten months later the line was back almost where it started, and French and German losses together reached about 700,000 killed, wounded, or missing.' },
    somme: { at: [2.7, 50.0], kind: 'old', h: 'The Somme', when: 'July 1 to Nov. 18, 1916', p: 'On the first day the British Army suffered 57,470 casualties, including 19,240 dead, the worst day in its history. After four and a half months and more than a million casualties on both sides, the Allies had moved the line about seven miles.' },
    cantigny: { at: [2.49, 49.66], kind: 'aef', h: 'Cantigny', when: 'May 28, 1918', p: 'The first American attack of the war. The 1st Division took the village and held it through two days of German counterattacks. It was small, but it proved Americans could fight.' },
    belleau: { at: [3.29, 49.08], kind: 'aef', h: 'Belleau Wood', when: 'June 1918', p: 'U.S. Marines fought for almost a month to take a square mile of forest near Château-Thierry, on the road to Paris. They suffered nearly 10,000 casualties. France renamed it “Wood of the Marine Brigade.”' },
    johnson: { at: [4.78, 49.17], kind: 'aef', h: 'Henry Johnson', when: 'May 15, 1918', img: 'henry-johnson', p: 'A railroad porter from Albany, New York, serving with the 369th in a French sector of the line. With Needham Roberts he fought off a German raiding party in the dark, wounded 21 times. The first American to receive France’s Croix de Guerre.' },
    stmihiel: { at: [5.54, 48.89], kind: 'aef', h: 'St. Mihiel', when: 'Sept. 12–16, 1918', p: 'The first battle planned and led by Pershing’s own American army. About 550,000 Americans erased a German bulge in the line that had stood since 1914. Nearly 1,500 Allied planes flew overhead, the largest air operation of the war.' },
    meuse: { at: [5.13, 49.27], off: [12, -38], kind: 'aef', h: 'Meuse-Argonne', when: 'Sept. 26 to Nov. 11, 1918', p: '1.2 million Americans attacked north between the Argonne Forest and the Meuse River toward the railroad at Sedan. It was the largest and deadliest battle in American history: 26,277 Americans were killed. Most of them are buried at the Meuse-Argonne American Cemetery, the largest American military cemetery in Europe.' },
    lostbn: { at: [4.92, 49.31], off: [-38, -18], kind: 'aef', h: 'The Lost Battalion', when: 'Oct. 2–7, 1918', img: 'cher-ami', p: 'About 550 men under Major Charles Whittlesey pushed too far into the Argonne Forest and were surrounded. American guns began shelling them by mistake. Their last pigeon, Cher Ami, flew through German fire with a message: “Our artillery is dropping a barrage directly on us. For heaven’s sake stop it.” The shelling stopped. 194 men walked out.' },
    york: { at: [4.97, 49.27], off: [-30, 26], kind: 'aef', h: 'Alvin York', when: 'Oct. 8, 1918', img: 'york', p: 'A corporal from the mountains of Tennessee who had first asked to be excused from fighting because of his faith. In the Argonne he and seven other survivors of his patrol captured 132 German soldiers. He received the Medal of Honor and came home famous.' }
  };
  const IMG_OK = { york: true, 'cher-ami': true };
  OT.whenNear($('#front-map'), () => {
    OT.world.then(world => {
      const host = $('#front-map'); if (!host) return;
      const W = 760, H = 640;
      const all = topojson.feature(world, world.objects.countries).features;
      const proj = d3.geoMercator().fitExtent([[0, 0], [W, H]], bboxPoly(1.2, 47.35, 8.3, 51.5)).clipExtent([[0, 0], [W, H]]);
      const path = d3.geoPath(proj);
      const { svg, defs } = svgEl(host, W, H, 'Map of the Western Front in France and Belgium with the front line for the chosen year');
      svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#C3CFCB');
      const feats = all.filter(f => path(f));
      const landId = 'landclip';
      defs.append('clipPath').attr('id', landId).selectAll('path').data(feats).join('path').attr('d', path);
      svg.append('g').selectAll('path').data(feats).join('path').attr('d', path).attr('fill', C.land).attr('stroke', '#8b846c').attr('stroke-width', 1).attr('stroke-dasharray', '4 3');
      grid(svg, W, H, 76);
      const german = svg.append('path').attr('clip-path', `url(#${landId})`).attr('fill', C.central).attr('opacity', .3);
      const front = svg.append('path').attr('fill', 'none').attr('stroke', C.allied).attr('stroke-width', 4).attr('stroke-linejoin', 'round');
      const frontRed = svg.append('path').attr('fill', 'none').attr('stroke', C.central).attr('stroke-width', 2).attr('stroke-dasharray', '2 5').attr('transform', 'translate(4,0)');
      const TOWN = [['Paris', 2.35, 48.86], ['Amiens', 2.3, 49.89], ['Reims', 4.03, 49.26], ['Verdun', 5.38, 49.16], ['Calais', 1.86, 50.95], ['Brussels', 4.35, 50.85], ['Metz', 6.18, 49.12], ['Sedan', 4.94, 49.7], ['Nancy', 6.18, 48.69], ['Strasbourg', 7.75, 48.58]];
      const tg = svg.append('g').attr('pointer-events', 'none');
      TOWN.forEach(([n, lon, lat]) => {
        const p = proj([lon, lat]);
        tg.append('rect').attr('x', p[0] - 3).attr('y', p[1] - 3).attr('width', 6).attr('height', 6).attr('fill', C.ink);
        tg.append('text').attr('x', p[0] + 7).attr('y', p[1] + 4).attr('font-family', 'Special Elite, monospace').attr('font-size', 13).attr('fill', C.ink).attr('paint-order', 'stroke').attr('stroke', C.land).attr('stroke-width', 4).text(n);
      });
      [['NORTH SEA', 2.0, 51.35], ['BELGIUM', 4.9, 50.6], ['FRANCE', 2.3, 48.2], ['GERMANY', 7.6, 50.0], ['SWITZ.', 7.6, 47.55]].forEach(([n, lon, lat]) => {
        const p = proj([lon, lat]);
        tg.append('text').attr('x', p[0]).attr('y', p[1]).attr('text-anchor', 'middle').attr('font-family', 'Stardos Stencil, Impact, sans-serif').attr('font-weight', 700).attr('font-size', 17).attr('letter-spacing', '.12em').attr('fill', 'rgba(29,30,25,.45)').text(n);
      });
      const pinG = svg.append('g');
      const lineGen = d3.line().curve(d3.curveCatmullRom.alpha(.5));
      function pts(line) { return line.map(p => proj(p)); }
      function germanPoly(line) {
        const P = pts(line), last = line[line.length - 1], first = line[0];
        const extra = [[9.5, last[1] - .3], [9.5, 52], [first[0], 52]].map(p => proj(p));
        return lineGen(P) + ' L' + extra.map(p => p.join(',')).join(' L') + ' Z';
      }
      const dossier = $('#dossier'), bar = $('#yearbar');
      const opened = new Set();
      const AEF_KEYS = Object.keys(PINS).filter(k => PINS[k].kind === 'aef');
      function openPin(k) {
        const P = PINS[k];
        opened.add(k);
        pinG.selectAll('g.pin').classed('on', d => d === k).select('.ring').attr('stroke-width', d => d === k ? 3.5 : 2);
        const img = P.img && IMG_OK[P.img] ? `<img src="${OT.base}img/${P.img}.jpg" alt="${esc(P.h)}">` : '';
        dossier.innerHTML = `<p class="wire when">${esc(P.when)}</p><h4>${esc(P.h)}</h4>${img ? `<div class="face">${img}<p>${esc(P.p)}</p></div>` : `<p>${esc(P.p)}</p>`}`;
        if (AEF_KEYS.every(x => opened.has(x))) tag('pins');
      }
      const seenM = new Set();
      function setMoment(i) {
        const M = MOMENTS[i];
        seenM.add(i);
        bar.querySelectorAll('button').forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
        const d = lineGen(pts(M.line));
        if (reduce) { front.attr('d', d); frontRed.attr('d', d); german.attr('d', germanPoly(M.line)); }
        else {
          german.transition().duration(700).attr('d', germanPoly(M.line));
          front.attr('d', d); frontRed.attr('d', d);
          const L = front.node().getTotalLength();
          front.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().duration(900).attr('stroke-dashoffset', 0).on('end', () => front.attr('stroke-dasharray', null));
        }
        pinG.selectAll('*').remove();
        M.pins.forEach((k, n) => {
          const P = PINS[k], p0 = proj(P.at), off = P.off || [0, 0], p = [p0[0] + off[0], p0[1] + off[1]];
          if (P.off) {
            pinG.append('line').attr('x1', p0[0]).attr('y1', p0[1]).attr('x2', p[0]).attr('y2', p[1]).attr('stroke', C.ink).attr('stroke-width', 1.5);
            pinG.append('circle').attr('cx', p0[0]).attr('cy', p0[1]).attr('r', 3).attr('fill', C.ink);
          }
          const g = pinG.append('g').datum(k).attr('class', 'pin').attr('transform', `translate(${p[0]},${p[1]})`).attr('tabindex', 0).attr('role', 'button').attr('aria-label', `${P.h}, ${P.when}`);
          g.append('circle').attr('class', 'hit').attr('r', 15);
          g.append('circle').attr('class', 'ring').attr('r', 13).attr('fill', P.kind === 'aef' ? C.gold : C.ink).attr('stroke', '#F5F0E3').attr('stroke-width', 2);
          g.append('text').attr('text-anchor', 'middle').attr('y', 5).attr('font-family', 'Stardos Stencil, Impact, sans-serif').attr('font-weight', 700).attr('font-size', 14).attr('fill', '#F5F0E3').attr('pointer-events', 'none').text(n + 1);
          g.on('click', () => openPin(k)).on('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPin(k); } });
        });
        dossier.innerHTML = `<p class="wire label">${esc(M.label)}</p><p>${esc(M.cap)}</p><p class="wire" style="color:var(--ink-soft)">Tap a numbered pin.</p>`;
        if (seenM.size === MOMENTS.length) tag('front');
      }
      bar.innerHTML = MOMENTS.map((m, i) => `<button type="button" data-i="${i}" aria-pressed="false">${esc(m.label)}</button>`).join('');
      bar.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) setMoment(Number(b.dataset.i)); });
      setMoment(0);
    }).catch(() => {});
  });

  /* ---------- The Great Migration ---------- */
  const CITIES = [
    { n: 'New York', lab: [12, -14, 'start'], at: [-74.0, 40.71], a: 91709, b: 152467, from: [[-80.9, 33.8], [-78.6, 35.6]] },
    { n: 'Philadelphia', lab: [10, 24, 'start'], at: [-75.17, 39.95], a: 84459, b: 134229, from: [[-78.6, 37.5], [-83.4, 32.7]] },
    { n: 'Chicago', lab: [-10, -8, 'end'], at: [-87.63, 41.88], a: 44103, b: 109458, from: [[-89.7, 32.7], [-91.9, 31.0]] },
    { n: 'St. Louis', lab: [-12, 4, 'end'], at: [-90.2, 38.63], a: 43960, b: 69854, from: [[-89.7, 32.7], [-92.4, 34.8]] },
    { n: 'Detroit', lab: [0, -16, 'middle'], at: [-83.05, 42.33], a: 5741, b: 40838, mi: true, from: [[-86.8, 32.8], [-83.4, 32.7]] },
    { n: 'Pittsburgh', lab: [-6, 20, 'end'], at: [-80.0, 40.44], a: 25623, b: 37725, from: [[-86.8, 32.8], [-78.6, 37.5]] },
    { n: 'Cleveland', lab: [10, -4, 'start'], at: [-81.69, 41.5], a: 8448, b: 34451, from: [[-86.8, 32.8], [-83.4, 32.7]] }
  ];
  const SOUTH = new Set(['01', '13', '22', '28', '45', '37', '47', '05', '51', '48', '12']);
  OT.whenNear($('#mig-map'), () => {
    OT.us().then(us => {
      const host = $('#mig-map'); if (!host) return;
      const W = 900, H = 560;
      const states = topojson.feature(us, us.objects.states).features.filter(f => ['02', '15', '60', '66', '69', '72', '78'].indexOf(String(f.id)) < 0);
      const proj = d3.geoAlbersUsa().fitExtent([[10, 10], [W - 10, H - 10]], { type: 'FeatureCollection', features: states });
      const path = d3.geoPath(proj);
      const { svg, defs } = svgEl(host, W, H, 'Map of the United States showing Black population growth in northern cities between 1910 and 1920');
      arrowHead(defs, 'ah-m', '#3F6094');
      svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#DED6BF');
      svg.append('g').selectAll('path').data(states).join('path').attr('d', path)
        .attr('fill', f => String(f.id) === '26' ? '#E9D9A6' : SOUTH.has(String(f.id)) ? '#E6DCC2' : C.land)
        .attr('stroke', '#9b937a').attr('stroke-width', .8);
      const sp = proj([-87, 33.4]);
      svg.append('text').attr('x', sp[0]).attr('y', sp[1]).attr('text-anchor', 'middle').attr('font-family', 'Stardos Stencil, Impact, sans-serif').attr('font-weight', 700).attr('font-size', 20).attr('letter-spacing', '.14em').attr('fill', 'rgba(29,30,25,.35)').text('THE SOUTH');
      const flows = svg.append('g');
      const bubbles = svg.append('g');
      const r = d3.scaleSqrt().domain([0, 160000]).range([0, 46]);
      const g = bubbles.selectAll('g').data(CITIES).join('g').attr('transform', d => `translate(${proj(d.at).join(',')})`);
      g.append('circle').attr('class', 'b').attr('fill', d => d.mi ? 'rgba(184,71,59,.55)' : 'rgba(63,96,148,.45)').attr('stroke', d => d.mi ? '#8a2a20' : '#2C4C7C').attr('stroke-width', 1.5);
      g.append('circle').attr('r', 3).attr('fill', C.ink);
      g.append('text').attr('x', d => d.lab[0]).attr('y', d => d.lab[1]).attr('text-anchor', d => d.lab[2])
        .attr('font-family', 'Special Elite, monospace').attr('font-size', 13).attr('fill', C.ink).attr('paint-order', 'stroke').attr('stroke', C.land).attr('stroke-width', 4).text(d => d.n);
      const list = $('#citylist');
      function draw(y) {
        g.select('circle.b').transition().duration(reduce ? 0 : 700).attr('r', d => r(y === '1910' ? d.a : d.b));
        flows.selectAll('*').remove();
        if (y === '1920') CITIES.forEach(c => c.from.forEach(f => {
          const p1 = proj(f), p2 = proj(c.at); if (!p1 || !p2) return;
          const mx = (p1[0] + p2[0]) / 2 - (p2[1] - p1[1]) * 0.18, my = (p1[1] + p2[1]) / 2 + (p2[0] - p1[0]) * 0.1;
          const pth = flows.append('path').attr('d', `M${p1[0]},${p1[1]} Q${mx},${my} ${p2[0]},${p2[1]}`).attr('fill', 'none').attr('stroke', '#3F6094').attr('stroke-width', 1.6).attr('opacity', .7).attr('marker-end', 'url(#ah-m)');
          if (!reduce) { const L = pth.node().getTotalLength(); pth.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().duration(1100).attr('stroke-dashoffset', 0); }
        }));
        const max = 152467;
        list.innerHTML = CITIES.slice().sort((a, b) => (y === '1910' ? b.a - a.a : b.b - a.b)).map(c => {
          const v = y === '1910' ? c.a : c.b;
          const growth = Math.round((c.b - c.a) / c.a * 100);
          return `<li class="${c.mi ? 'mi' : ''}"><span>${c.n}</span><span class="mini"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span><b>${OT.commas(v)}</b>${y === '1920' ? `<span></span><span class="wire" style="grid-column:2/4;font-size:.72rem;color:var(--ink-soft)">up ${growth}% since 1910</span>` : ''}</li>`;
        }).join('');
      }
      $('#mig-toggle').addEventListener('click', e => {
        const b = e.target.closest('button[data-y]'); if (!b) return;
        $('#mig-toggle').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        draw(b.dataset.y);
      });
      draw('1920');
    }).catch(() => {});
  });
})();
