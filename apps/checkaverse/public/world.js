// Presentation and authored encounters only. The server still owns every game stat.
export function trainerFrame(facing, stride, moving) {
  const col = moving ? [0, 1, 2, 1][Math.floor(stride * 2) % 4] : 1;
  // The source's side rows contain an opposite-facing third frame. Use the
  // verified left row, correcting that cell, then mirror the whole gait for right.
  const side = facing === 'l' || facing === 'r';
  return { col, row: side ? 2 : facing === 'u' ? 1 : 0, flip: side && ((col === 2) !== (facing === 'r')) };
}

const solid = new Set(['T', 'W', 'H', 'S', 'L', 'E', 'G', 'C', 'R', 'A']);
export function validateWorld(data, maps) {
  if (data.version !== 1 || !Array.isArray(data.residents) || data.residents.length > 24) throw new Error('world.json: invalid version or resident count');
  const ids = new Set();
  for (const n of data.residents) {
    const fail = (msg) => { throw new Error(`world.json: ${n.id}: ${msg}`); };
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(n.id) || ids.has(n.id)) fail('duplicate or invalid id');
    ids.add(n.id);
    if (!maps[n.map] || !Number.isInteger(n.look) || n.look < 0 || n.look > 3 || !n.name || !n.role) fail('map, outfit or name');
    if (!Array.isArray(n.route) || !n.route.length || n.route.length > 300) fail('route length');
    const rows = maps[n.map].rows;
    for (let i = 0; i < n.route.length; i++) {
      const [x, y] = n.route[i], prev = n.route[(i + n.route.length - 1) % n.route.length];
      if (!Number.isInteger(x) || !Number.isInteger(y) || !rows[y]?.[x] || solid.has(rows[y][x])) fail(`route tile ${x},${y} is unsafe`);
      if (Math.abs(x - prev[0]) + Math.abs(y - prev[1]) > 1) fail('route must join one tile at a time, including its loop');
      if ((maps[n.map].doors || []).some(d => d.x === x && d.y === y) || (maps[n.map].graves || []).some(g => g[0] === x && g[1] === y)) fail('route crosses a door or grave');
    }
    if (!Array.isArray(n.chatter) || !n.chatter.length || n.chatter.some(s => typeof s !== 'string' || s.length > 40)) fail('chatter');
    if (!n.dialogue?.start) fail('start conversation missing');
    for (const node of Object.values(n.dialogue)) {
      if (typeof node.text !== 'string' || node.text.length > 700 || !Array.isArray(node.choices) || node.choices.length > 4) fail('conversation size');
      for (const c of node.choices) if (!c.label || (c.next && !n.dialogue[c.next]) || (c.action && !['errand', 'journal'].includes(c.action))) fail('conversation choice');
    }
    if (n.errand) {
      const e = n.errand, [x, y] = e.target || [];
      if (!e.title || !e.request || !e.found || !e.complete || !['ribbon','label','marker'].includes(e.art) || !rows[y]?.[x] || solid.has(rows[y][x])) fail('errand target, art or writing');
    }
  }
  return data;
}

// Connected, rounded dirt lanes. Only cached paint changes; collision stays on
// the original grid. All 16 connection masks have the same full-width joins.
export function paintPaths(g, rows, T) {
  const base = (x,y) => 'PE'.includes(rows[y]?.[x] || '#');
  // Flower scatter in the old map sometimes replaced the middle of a lane.
  // Keep those flowers, but continue the dirt beneath a flower between paths.
  const path = (x,y) => base(x,y) || rows[y]?.[x] === 'F' && (base(x-1,y) && base(x+1,y) || base(x,y-1) && base(x,y+1));
  const lane = (x, y, inset, fill) => {
    const px = x * T, py = y * T, mid = T / 2, width = T - inset * 2;
    g.fillStyle = fill;
    g.beginPath(); g.roundRect(px + inset, py + inset, width, width, T * .22); g.fill();
    if (path(x, y - 1)) g.fillRect(px + inset, py, width, mid);
    if (path(x + 1, y)) g.fillRect(px + mid, py + inset, mid, width);
    if (path(x, y + 1)) g.fillRect(px + inset, py + mid, width, mid);
    if (path(x - 1, y)) g.fillRect(px, py + inset, mid, width);
    // Fill the inside of broad paths rather than leaving a grass pinhole.
    for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) if (path(x + dx, y) && path(x, y + dy) && path(x + dx, y + dy)) {
      g.fillRect(px + (dx < 0 ? 0 : mid), py + (dy < 0 ? 0 : mid), mid, mid);
    }
  };
  for (const [inset, fill] of [[1, '#718354'], [3, '#a3996c'], [5, '#c6b486'], [7, '#d8c69b']]) {
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (path(x,y)) lane(x, y, inset * T / 64, fill); }));
  }
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!path(x,y)) return;
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    for (let i = 0; i < 4; i++) {
      const px = x * T + T * (.25 + ((h >>> (i * 3)) % 32) / 64), py = y * T + T * (.25 + ((h >>> (i * 4)) % 32) / 64);
      g.fillStyle = i % 2 ? '#bfac80' : '#e5d5ae'; g.fillRect(px, py, T / 25, T / 40);
    }
  }));
}

export function paintMeadow(g, map, T) {
  const rows = map.rows, at = (x,y) => rows[y]?.[x] || 'T';
  rows.forEach((row,y) => [...row].forEach((ch,x) => {
    if (!'.F'.includes(ch)) return;
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0, px = x * T, py = y * T;
    const verge = [[-1,0],[1,0],[0,-1],[0,1]].some(([ax,ay]) => 'PW'.includes(at(x+ax,y+ay)));
    // Low meadow detail stays visibly walkable. Broad tonal patches break up the
    // repeating grass without adding per-frame image work or new collision.
    g.fillStyle = (h % 3) ? '#d9df9420' : '#45664715';
    g.beginPath(); g.ellipse(px + T/2, py + T*.65, T*.43, T*.23, 0, 0, Math.PI*2); g.fill();
    for (let i = 0; i < (verge ? 5 : 2); i++) {
      const k = ((h >>> (i * 3)) ^ (i * 733)) >>> 0, xx = px + (8 + k % 45) * T/64, yy = py + (12 + (k >>> 7) % 38) * T/64;
      g.fillStyle = '#6c8652'; g.fillRect(xx, yy, T/64, T/13); g.fillRect(xx - T/32, yy + T/64, T/64, T/18);
      g.fillStyle = '#aab979'; g.fillRect(xx + T/64, yy + T/32, T/64, T/22);
      if (verge && k % 3 === 0 || ch === 'F') {
        g.fillStyle = ['#eedca6','#e2b8af','#d8cfe0'][k%3]; g.fillRect(xx-T/40,yy-T/40,T/15,T/15);
        g.fillStyle = '#b29d58'; g.fillRect(xx,yy,T/48,T/48);
      }
    }
  }));
  for (const p of map.props || []) {
    if (p.flat) continue;
    const width = Math.min(p.w, 5) * T;
    g.fillStyle = '#233e2a22'; g.beginPath(); g.ellipse((p.x + p.w*.55)*T,p.b*T - T*.06,width*.48,T*.18,0,0,Math.PI*2); g.fill();
  }
}

export function createWorld(data) {
  const residents = data.residents.map((n, i) => ({ ...n, x: n.route[0][0], y: n.route[0][1], dx: n.route[0][0], dy: n.route[0][1], f: 'd', stride: 0, index: 0, wait: 800 + i * 377, q: [], seg: null, npc: true }));
  const errands = new Map(), particles = [], discoveries = [];
  const authoritative=Boolean(data.authoritative);let marks=[],stepMs=400;
  if(authoritative)for(const n of residents)n.visible=false;
  let kind = '', clock = 0, held = '', lastTile = '', gust = 0, wasQuiet = false;
  const inMap = () => residents.filter(n => authoritative ? n.visible && n.room===kind : n.map === kind);
  function reset(map,home='') { kind = home?`home:${home}`:map; held = ''; particles.length = 0; lastTile = ''; }
  function sync(snapshot,instant=false){
    if(!snapshot?.residents)return;marks=snapshot.marks||[];stepMs=snapshot.stepMs||400;
    const present=new Set(snapshot.residents.map(n=>n.id));for(const n of residents)n.visible=present.has(n.id);
    for(const update of snapshot.residents){const n=residents.find(n=>n.id===update.id);if(!n)continue;
      const jump=instant||n.room!==update.room||n.lastSeq===undefined||update.seq-n.lastSeq>5;
      if(jump){n.dx=update.x;n.dy=update.y;n.q=[];n.seg=null;}
      else for(const s of update.steps||[])if(s.s>n.lastSeq&&s.room===update.room)n.q.push([s.x,s.y,s.f]);
      Object.assign(n,update);n.lastSeq=update.seq;
    }
  }
  function active() { return inMap(); }
  function find(id) { return inMap().find(n => n.id === id); }
  function start(id) { const n = find(id); if (n?.errand && !errands.has(id)) errands.set(id, 'looking'); }
  function status(id) { return errands.get(id) || ''; }
  function syncStories(stories){for(const n of residents){const next=stories?.[n.id],old=status(n.id);if(['looking','found','done'].includes(next)){errands.set(n.id,next);if(next==='found'&&old==='looking'){discoveries.push({id:n.id,text:n.errand.found});emit(n.errand.target[0],n.errand.target[1],'spark',8);}}else if(authoritative)errands.delete(n.id);}}
  function finish(id) { if (errands.get(id) === 'found') { errands.set(id, 'done'); return true; } return false; }
  function journal() { return residents.filter(n => errands.has(n.id)).map(n => ({ id: n.id, name: n.name, ...n.errand, status: status(n.id) })); }
  function emit(x, y, type, count = 5) {
    for (let i = 0; i < count && particles.length < 48; i++) particles.push({ x: x * 32 + 16, y: y * 32 + 26, age: 0, life: type === 'leaf' ? 1700 : 500, type, vx: Math.cos(i * 2.4) * .015, vy: -.016 - i * .002 });
  }
  function tick(dt, map, player, quiet, blocked, stop) {
    if (stop || !player) {if(authoritative)for(const n of residents){n.dx=n.x;n.dy=n.y;n.q=[];}return;}
    // This clock pauses with teacher pause, hidden tabs, conversations and battles.
    clock += dt;
    if (quiet && !wasQuiet) particles.length = 0;
    wasQuiet = quiet;
    for (const n of inMap()) {
      if(authoritative){
        let remaining=dt;
        while(n.q.length){const [x,y,f]=n.q[0],dx=x-n.dx,dy=y-n.dy,d=Math.abs(dx)+Math.abs(dy),go=remaining/stepMs;
          n.f=f;if(d>4){n.dx=x;n.dy=y;n.q.shift();continue;}
          if(go>=d){n.dx=x;n.dy=y;n.stride+=d;n.q.shift();remaining-=d*stepMs;if(remaining<=0)break;}
          else{n.dx+=dx/d*go;n.dy+=dy/d*go;n.stride+=go;break;}
        }continue;
      }
      if (quiet || held === n.id) { n.dx = n.x; n.dy = n.y; n.seg = null; continue; }
      if (n.seg) {
        n.seg.age += dt;
        const t = Math.min(1, n.seg.age / 360);
        n.dx = n.seg.x + (n.x - n.seg.x) * t; n.dy = n.seg.y + (n.y - n.seg.y) * t;
        n.stride += dt / 360;
        if (t === 1) { n.seg = null; n.wait = n.index % 4 === 0 ? 2200 : 160; }
      } else if ((n.wait -= dt) <= 0) {
        const next = (n.index + 1) % n.route.length, [x, y] = n.route[next];
        if (blocked(x, y) || (Math.abs(x - player.dx) + Math.abs(y - player.dy) < 1.2)) { n.wait = 500; continue; }
        const ax = x - n.x, ay = y - n.y;
        n.f = ax ? (ax > 0 ? 'r' : 'l') : ay > 0 ? 'd' : 'u';
        n.seg = { x: n.dx, y: n.dy, age: 0 }; n.x = x; n.y = y; n.index = next;
      }
    }
    const tile = `${Math.round(player.dx)},${Math.round(player.dy)}`;
    if (lastTile !== tile) {
      lastTile = tile;
      const [x, y] = tile.split(',').map(Number), ch = map?.rows[y]?.[x];
      if (!quiet && player.seg && 'PGCF'.includes(ch || '#')) emit(x, y, ch === 'P' ? 'dust' : 'grass', 4);
      for (const n of residents.filter(n=>!authoritative&&n.map===kind)) if (status(n.id) === 'looking' && Math.hypot(x - n.errand.target[0], y - n.errand.target[1]) <= 1.3) {
        errands.set(n.id, 'found'); discoveries.push({ id: n.id, text: n.errand.found });
        if (!quiet) emit(x, y, 'spark', 8);
      }
    }
    if (!quiet) {
      if (clock - gust > 25000) { gust = clock; emit(player.dx - 4, player.dy - 3, 'leaf', 9); }
      for (const p of particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].age >= particles[i].life) particles.splice(i, 1);
    }
  }
  function draw(g, map, bounds, quiet) {
    const [x0, y0, x1, y1] = bounds, t = quiet ? 0 : clock;
    for (let y = Math.max(0, y0); y <= Math.min(map.rows.length - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(map.rows[0].length - 1, x1); x++) {
      const ch = map.rows[y][x], h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const px = x * 32, py = y * 32;
      if (ch === 'W' && h % 4 === 0) {
        const w = 2 + Math.sin(t / 950 + h) * 1.5;
        g.strokeStyle = '#c1e6cf88'; g.lineWidth = .7; g.beginPath(); g.ellipse(px + 16, py + 17, 4 + w, 1.5 + w * .3, 0, 0, Math.PI * 2); g.stroke();
        if (h % 3 === 0) { g.fillStyle = '#e5aa65'; g.fillRect(px + 14 + Math.sin(t / 2400 + h) * 5, py + 22, 3, 1); }
      }
      if ((ch === '.' || ch === 'F' || ch === 'C') && h % 23 === 0) {
        const bx = px + 16 + Math.sin(t / 1600 + h) * 8, by = py + 8 + Math.cos(t / 1900 + h) * 6;
        const wing = quiet ? 2 : 1 + Math.abs(Math.sin(t / 140 + h)) * 2;
        g.fillStyle = ['#f8d987', '#c3d9eb', '#eab2bd'][h % 3]; g.fillRect(bx - wing, by - 1, wing * 2 + 1, 2);
        g.fillStyle = '#645a44'; g.fillRect(bx, by - 1, 1, 3);
      }
    }
    // Small chimney puffs and warm lantern pools stay tied to existing landmarks.
    for (const p of map.props || []) {
      if (p.x < x0 - 5 || p.x > x1 + 3 || p.b < y0 - 1 || p.b > y1 + 6) continue;
      if (p.s === 'prop-lantern') {
        const x = (p.x + p.w / 2) * 32, y = (p.b - 1) * 32, r = 14 + Math.sin(t / 700 + p.x) * 2;
        const glow = g.createRadialGradient(x, y, 1, x, y, r); glow.addColorStop(0, '#ffd38866'); glow.addColorStop(1, '#ffd38800');
        g.fillStyle = glow; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (['house-cottage', 'kc-apothecary', 'kc-store', 'market-stall'].includes(p.s)) {
        for (let i = 0; i < 3; i++) { const phase = ((t / 2600 + i / 3) % 1); g.fillStyle = `rgba(246,237,215,${.18 * (1 - phase)})`; g.beginPath(); g.ellipse((p.x + p.w * .7) * 32 + Math.sin(phase * 4) * 3, (p.b - p.w * .7) * 32 - phase * 26, 2 + phase * 4, 2 + phase * 3, 0, 0, Math.PI * 2); g.fill(); }
      }
    }
    if (!quiet) for (const p of particles) { g.globalAlpha = 1 - p.age / p.life; g.fillStyle = { dust: '#e9d3a6', grass: '#9bbd65', leaf: '#cbbb65', spark: '#ffe8a1' }[p.type]; g.fillRect(p.x, p.y, p.type === 'leaf' ? 4 : 2, 2); }
    g.globalAlpha = 1;
    for(const m of marks.filter(m=>m.room===kind)){
      const x=m.x*32+5,y=m.y*32+24;
      if(m.kind==='water'){
        g.fillStyle='#79583f';g.fillRect(x-3,y-5,22,10);g.fillStyle=m.value>20?'#577340':'#a19957';
        for(let i=0;i<3;i++){g.fillRect(x+i*6,y-8,2,7);g.fillRect(x-2+i*6,y-6,6,2);}if(m.value>20){g.fillStyle='#8bbdc0';g.fillRect(x-2,y+2,18,1);}
      }else if(m.kind==='sweep'){
        if(m.value<60){g.fillStyle='#b2a16b';for(let i=0;i<5;i++)g.fillRect(x+(i*7)%20,y-(i*3)%7,3,2);}
        else{g.fillStyle='#e5d5b16b';g.fillRect(x,y,18,1);}
        if(m.artifact==='ribbon'){g.fillStyle='#85683f';g.fillRect(x+20,y-12,2,15);g.fillStyle='#f2cc68';g.fillRect(x+18,y-9,8,2);g.fillRect(x+21,y-7,2,5);}
      }else if(m.kind==='deliver'||m.kind==='stock'){
        for(let i=0;i<Math.min(4,m.value);i++){const xx=x+i*5;g.fillStyle='#705037';g.fillRect(xx,y-6,6,7);g.fillStyle='#c39b64';g.fillRect(xx,y-6,6,5);g.fillStyle='#f0dab0';g.fillRect(xx+2,y-6,1,5);}
        if(m.artifact==='label'&&m.value){g.fillStyle='#f9efd3';g.fillRect(x+1,y-5,4,3);}
        if(m.artifact==='marker'){g.fillStyle='#765335';g.fillRect(x+22,y-4,8,3);g.fillStyle='#e2c28a';for(let i=0;i<3;i++)g.fillRect(x+23+i*2,y-4,1,2);}
      }else if(m.kind==='visit'){if(m.value){g.fillStyle='#eadcb7';g.fillRect(x,y-5,10,7);g.strokeStyle='#ae9c77';g.lineWidth=.6;g.beginPath();g.moveTo(x,y-5);g.lineTo(x+5,y);g.lineTo(x+10,y-5);g.stroke();}}
      else if(m.count){g.fillStyle='#c6b281';g.fillRect(x,y-4,9,6);g.fillStyle='#65765e';for(let i=0;i<Math.min(3,m.value);i++)g.fillRect(x+1+i*2,y-2,1,3);}
    }
    if(kind.startsWith('home:')){
      const owner=residents.find(n=>n.id===kind.slice(5));
      const object=owner?.home?.object||'book',x=69,y=95;
      g.fillStyle='#3b2d2444';g.fillRect(x-1,y+2,13,2);
      if(object==='can'){g.fillStyle='#476b79';g.fillRect(x+2,y-4,6,6);g.fillRect(x+8,y-3,3,2);g.fillStyle='#c1dddd';g.fillRect(x+3,y-3,4,1);}
      else if(object==='parcel'){g.fillStyle='#755038';g.fillRect(x,y-4,10,6);g.fillStyle='#b68c59';g.fillRect(x+1,y-4,8,4);g.fillStyle='#efe1b9';g.fillRect(x+2,y-3,4,2);}
      else if(object==='flowers'||object==='plant'){g.fillStyle='#835e43';g.fillRect(x+3,y-2,5,5);g.fillStyle='#6b884e';g.fillRect(x+5,y-8,1,7);g.fillRect(x+2,y-5,7,2);g.fillStyle=object==='flowers'?'#d5a6bb':'#94a66b';g.fillRect(x+4,y-9,3,3);}
      else if(object==='cap'){g.fillStyle='#526c7d';g.fillRect(x+1,y-3,8,4);g.fillStyle='#334c59';g.fillRect(x+7,y,5,2);g.fillStyle='#d6bc70';g.fillRect(x+3,y-2,2,1);}
      else if(object==='tally'){g.fillStyle='#765337';g.fillRect(x,y-2,12,4);g.fillStyle='#dfbd7c';for(let i=0;i<4;i++)g.fillRect(x+2+i*2,y-2,1,3);}
      else if(object==='shoes'){g.fillStyle='#493a30';g.fillRect(x+1,y-2,4,4);g.fillRect(x+7,y-3,4,4);g.fillStyle='#ae976f';g.fillRect(x+2,y-1,2,1);g.fillRect(x+8,y-2,2,1);}
      else if(object==='tools'){g.fillStyle='#6d7166';g.fillRect(x,y-2,12,4);g.fillStyle='#b7b6a4';for(let i=0;i<3;i++)g.fillRect(x+2+i*3,y-4,1,6);}
      else{g.fillStyle=object==='map'?'#b59a6b':'#59664d';g.fillRect(x,y-4,11,7);g.fillStyle='#e8d5aa';g.fillRect(x+1,y-3,9,4);g.fillStyle='#7c7958';g.fillRect(x+4,y-3,1,4);g.fillRect(x+2,y-1,6,1);}
    }
    for (const n of residents.filter(n=>n.map===kind)) if (status(n.id) === 'looking') {
      const [x, y] = n.errand.target;
      const px = x*32+16, py = y*32+20;
      g.strokeStyle = '#fff0af88'; g.lineWidth = 1; g.beginPath(); g.ellipse(px, py+3, 7, 3, 0, 0, Math.PI*2); g.stroke();
      g.fillStyle = '#34483144'; g.fillRect(px-4,py+1,8,2);
      if(n.errand.art === 'ribbon') {
        g.fillStyle = '#906a28'; g.fillRect(px-5,py-4,10,3);g.fillRect(px-3,py-2,2,5);
        g.fillStyle = '#f2ce65';g.fillRect(px-5,py-5,10,2);g.fillRect(px-2,py-3,2,5);
      } else if(n.errand.art === 'label') {
        g.fillStyle='#b49a6c';g.fillRect(px-4,py-5,9,7);g.fillStyle='#fbf0cc';g.fillRect(px-4,py-5,8,6);
        g.fillStyle='#796847';g.fillRect(px-2,py-3,4,1);g.fillRect(px-2,py-1,3,1);
      } else {
        g.fillStyle='#6f4c2f';g.fillRect(px-5,py-4,10,5);g.fillStyle='#bc9362';g.fillRect(px-5,py-4,10,3);
        g.fillStyle='#ecce91';for(let i=0;i<3;i++)g.fillRect(px-3+i*2,py-4,1,3);
      }
      g.fillStyle='#fff2c3';g.fillRect(px+6,py-8+Math.sin(t/400)*1.5,2,2);
    }
  }
  function drawResident(g,n,quiet){
    if(!n.activity)return;const tool=n.carry||n.activity.tool;if(!tool||tool==='none')return;
    const x=n.dx*32+(n.f==='l'?4:24),y=n.dy*32+17,t=quiet?0:clock;
    if(tool==='parcel'||tool==='crate'){g.fillStyle='#735033';g.fillRect(x-5,y-6,11,10);g.fillStyle='#bf945b';g.fillRect(x-4,y-5,9,7);g.fillStyle='#eed6a0';g.fillRect(x,y-5,1,7);g.fillRect(x-4,y-2,9,1);}
    else if(tool==='can'){g.fillStyle='#476b79';g.fillRect(x-3,y-5,8,7);g.fillRect(x+4,y-4,4,2);g.fillStyle='#b7dde0';g.fillRect(x-1,y-4,4,1);if(n.activity.action==='water'&&!quiet){g.fillStyle='#b9e5ea';for(let i=0;i<3;i++)g.fillRect(x+7+i*2,y+((t/130+i*3)%7),1,2);}}
    else if(tool==='broom'||tool==='rake'){const swing=Math.sin(t/340)*2;g.strokeStyle='#795430';g.lineWidth=1.5;g.beginPath();g.moveTo(x,y-10);g.lineTo(x+3+swing,y+12);g.stroke();g.fillStyle=tool==='broom'?'#c6ae68':'#929d98';g.fillRect(x+swing,y+10,8,3);}
    else if(tool==='tools'){g.fillStyle='#777b71';g.fillRect(x-4,y-3,10,5);g.fillStyle='#d1ccb5';g.fillRect(x-2,y-5,2,6);g.fillRect(x+2,y-4,2,6);}
    else{g.fillStyle='#5b684e';g.fillRect(x-5,y-4,10,7);g.fillStyle='#f0e3b7';g.fillRect(x-4,y-3,8,4);g.fillStyle='#85704c';g.fillRect(x,y-3,1,4);}
  }
  return { active, all:()=>residents.filter(n=>n.visible!==false),find, start, status,syncStories, finish, journal, reset,sync,tick, draw,drawResident,work:()=>marks, hold: id => { held = id; }, discoveries, clock: () => clock };
}

if (typeof window !== 'undefined') window.CheckaverseWorld = { createWorld, trainerFrame, paintPaths, paintMeadow };
