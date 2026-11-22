/* Manifest: 1848 — engine */
'use strict';
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
/* Seeded randomness. The state lives on the run (G.rs) so every save captures it exactly:
   reloading cannot reroll a fight, a reward or an event, and a seed can replay a whole run. */
function rf(){ if(!G||G.rs==null) return Math.random(); let t=(G.rs=(G.rs+0x6D2B79F5)|0); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
const rnd = n=>Math.floor(rf()*n);
const pick = a=>a[rnd(a.length)];
const shuffle = a=>{for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const sleep = ms=>new Promise(r=>setTimeout(r,window.FAST?0:ms));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let UID=1;
const fmtDate = t=>new Date(t).toLocaleDateString('en-US',{month:'long',day:'numeric',timeZone:'UTC'});
const fmtDateY = t=>new Date(t).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
const SAVE_KEY='md1848_save_v1', PREF_KEY='md1848_prefs';
const store={get(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}},del(k){try{localStorage.removeItem(k);}catch(e){}}};
const PREFS = Object.assign({narr:true,sound:true},store.get(PREF_KEY)||{});

/* ====================== SOUND ====================== */
const SFX = (()=>{
  let ctx=null;
  const ac=()=>{ if(!ctx){ try{ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } return ctx; };
  function tone(f,d,type='sine',v=.15,slide=0,delay=0){const c=ac(); if(!c||!PREFS.sound) return; const t=c.currentTime+delay; const o=c.createOscillator(),g=c.createGain(); o.type=type;o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+d); o.connect(g).connect(c.destination); o.start(t); o.stop(t+d);}
  function noise(d,v=.2,hp=800,delay=0){const c=ac(); if(!c||!PREFS.sound) return; const t=c.currentTime+delay; const b=c.createBuffer(1,c.sampleRate*d,c.sampleRate),a=b.getChannelData(0); for(let i=0;i<a.length;i++) a[i]=(Math.random()*2-1)*(1-i/a.length); const s=c.createBufferSource(); s.buffer=b; const f=c.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp; const g=c.createGain(); g.gain.value=v; s.connect(f).connect(g).connect(c.destination); s.start(t);}
  return {
    card(){noise(.12,.18,2500);}, hit(){tone(110,.25,'square',.18,-60);noise(.2,.25,200);},
    block(){tone(520,.08,'triangle',.12);tone(780,.1,'triangle',.08,0,.05);}, prog(){tone(330,.09,'triangle',.1,120);},
    gold(){tone(1320,.08,'sine',.1);tone(1760,.12,'sine',.08,0,.06);}, heal(){tone(523,.15,'sine',.1);tone(659,.2,'sine',.08,0,.1);},
    win(){[523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.12,0,i*.12));}, lose(){[392,330,262,196].forEach((f,i)=>tone(f,.45,'sawtooth',.06,0,i*.22));},
    curse(){tone(200,.4,'sawtooth',.07,-90);}, click(){tone(660,.05,'square',.05);}, turn(){tone(196,.15,'triangle',.1);tone(294,.2,'triangle',.08,0,.08);},
  };
})();

/* ====================== NARRATOR ====================== */
const Narr = (()=>{
  const el=$('#narr'), img=$('#narr img'), txt=$('#narr .txt');
  let q=[], busy=false, timer=null, typing=null, done=null;
  el.addEventListener('click',()=>next());
  function say(key,opt={}){
    if(!PREFS.narr) return Promise.resolve();
    let line = TR[key] ? TR[key][Math.floor(Math.random()*TR[key].length)] : key;
    return new Promise(res=>{ q.push({line,opt,res}); if(!busy) next(); });
  }
  function once(key,opt){ if(!G||!G.seen) return say(key,opt); if(G.seen[key]) return Promise.resolve(); G.seen[key]=1; return say(key,opt); }
  function next(){
    clearTimeout(timer); clearInterval(typing);
    if(done){ const d=done; done=null; d(); }
    const it=q.shift();
    if(!it){ el.classList.remove('on','talk'); busy=false; return; }
    busy=true; done=it.res;
    img.src='art/narrator.webp';
    el.classList.toggle('top',!!it.opt.top); el.classList.toggle('big',!!it.opt.big);
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on','talk');
    let i=0; txt.textContent='';
    typing=setInterval(()=>{ i+=2; txt.textContent=it.line.slice(0,i); if(i>=it.line.length){clearInterval(typing); el.classList.remove('talk');} },22);
    timer=setTimeout(next, 2600+it.line.length*48);
  }
  function clear(){ q.forEach(x=>x.res()); q=[]; next(); }
  return {say,once,clear};
})();

/* ====================== TOOLTIP ====================== */
const tip=$('#tip');
document.addEventListener('mouseover',e=>{const t=e.target.closest('[data-tip]'); if(!t){tip.style.display='none';return;} tip.innerHTML=t.dataset.tip; tip.style.display='block';});
document.addEventListener('mousemove',e=>{ if(tip.style.display==='block'){ const x=Math.min(e.clientX+16,innerWidth-320), y=Math.min(e.clientY+16,innerHeight-tip.offsetHeight-8); tip.style.left=x+'px'; tip.style.top=y+'px'; }});
/* Touch boards and Chromebooks have no hover. A tap on anything with a tooltip shows it,
   and pressing and holding any card shows it full size without playing it. */
let tipT=null;
document.addEventListener('pointerdown',e=>{
  tip.style.display='none'; clearTimeout(tipT);
  if(e.pointerType==='mouse') return;
  const t=e.target.closest('[data-tip]'); if(!t||t.closest('.card')) return;
  tip.innerHTML=t.dataset.tip; tip.style.display='block';
  const r=t.getBoundingClientRect(); tip.style.left=Math.max(8,Math.min(r.left,innerWidth-320))+'px';
  tip.style.top=(r.bottom+tip.offsetHeight+10<innerHeight? r.bottom+8 : Math.max(8,r.top-tip.offsetHeight-8))+'px';
  tipT=setTimeout(()=>tip.style.display='none',4000);
});
const zoomEl=$('#zoom'); let holdT=null, holdCard=null, holdXY=null, swallow=false;
function endHold(){ clearTimeout(holdT); holdCard=null; zoomEl.classList.remove('on'); }
document.addEventListener('pointerdown',e=>{
  const k=e.target.closest('.card'); if(!k||e.button>0) return;
  holdCard=k; holdXY=[e.clientX,e.clientY]; clearTimeout(holdT);
  holdT=setTimeout(()=>{ if(holdCard!==k) return; const c=k.cloneNode(true); c.className=c.className.replace(/\b(small|noplay|pick|flyout|focus|shake)\b/g,''); c.style.margin=''; zoomEl.innerHTML=''; zoomEl.appendChild(c); zoomEl.classList.add('on'); swallow=true; },380);
});
document.addEventListener('pointermove',e=>{ if(holdCard&&holdXY&&Math.hypot(e.clientX-holdXY[0],e.clientY-holdXY[1])>14) endHold(); });
document.addEventListener('pointerup',endHold); document.addEventListener('pointercancel',endHold);
document.addEventListener('click',e=>{ if(swallow){ swallow=false; e.stopPropagation(); e.preventDefault(); } },true);
document.addEventListener('contextmenu',e=>{ if(e.target.closest('.card')) e.preventDefault(); });

/* ====================== SCREENS ====================== */
function show(id){ $$('.screen').forEach(s=>s.classList.toggle('on',s.id===id)); tip.style.display='none'; }
function overlay(html,parent){ const o=document.createElement('div'); o.className='overlay'; o.innerHTML=html; (parent||$('#root')).appendChild(o); return o; }
function banner(text,sub,parent){ const b=document.createElement('div'); b.className='banner2'; b.innerHTML=text+(sub?`<small>${sub}</small>`:''); (parent||$('.screen.on')||$('#root')).appendChild(b); setTimeout(()=>b.remove(),1600); }

/* ====================== CARD VIEW ====================== */
function cardHTML(ci,opt={}){
  const d=CARDS[ci.id]; const u=!!ci.up;
  const base = (u && d.costUp!=null)? d.costUp : d.cost;
  const cost = opt.cost!=null? opt.cost : base;
  const cc = d.cost<0? '' : `<div class="cc ${cost<base?'cheap':cost>base?'dear':''}">${cost}</div>`;
  const tyl = d.type==='curse'?'Curse':d.type==='power'?'Power':d.type==='supply'?'Supply':'Action';
  return `<div class="card ${d.type} ${u?'up':''} ${opt.cls||''}" data-uid="${ci.uid||''}" ${opt.attr||''}>
    ${cc}<div class="cn">${d.name}${u?'+':''}</div>
    <div class="ca ${d.icon?'icon':''}" style="background-image:url(${A(d.art)})"></div>
    <div class="ct"><span>${d.desc(u)}</span></div><div class="ty">${tyl}${d.arch&&!['starter','neutral'].includes(d.arch)&&d.type!=='curse'?' · '+d.arch:''}</div></div>`;
}

/* ====================== RUN STATE ====================== */
let G=null;
class Run{
  constructor(wagonId,diff,seed){
    const w=WAGONS.find(x=>x.id===wagonId);
    this.seed=(seed!=null?seed:Math.floor(Math.random()*4294967296))>>>0; this.rs=this.seed|0; this.pending=null; this.lastNormal=null;
    this.wagon=wagonId; this.diff=diff; this.maxHp=w.hp+(diff==='easy'?10:0); this.hp=this.maxHp; this.gold=w.gold;
    let ids=[...STARTER]; w.remove.forEach(r=>{const i=ids.indexOf(r); if(i>=0) ids.splice(i,1);}); ids.push(...w.add);
    this.deck=ids.map(id=>({id,up:false,uid:UID++}));
    this.crew=[]; this.relics=[]; this.act=1; this.map=null; this.pos=null; this.day=START_DAY; this.flags={}; this.seen={};
    this.stats={fights:0,elites:0,purged:0,cursesPurged:0,cardsAdded:0,maxDeck:this.deck.length};
    this.removeCost=40; this.eventsSeen=[]; this.uidNext=UID;
  }
  get W(){return WAGONS.find(x=>x.id===this.wagon);}
  get cap(){return this.W.cap;}
  get over(){return Math.max(0,this.deck.length-this.cap);}
  addCard(id,up=false){ this.deck.push({id,up,uid:UID++}); this.stats.cardsAdded++; this.stats.maxDeck=Math.max(this.stats.maxDeck,this.deck.length); if(CARDS[id].type==='curse'){SFX.curse(); Narr.once('curse');} hud(); return id; }
  addGold(n){ this.gold=Math.max(0,this.gold+n); if(n>0) SFX.gold(); hud(); }
  hurt(n){ this.hp=Math.max(0,this.hp-n); hud(); if(n>0) moodFlash(n); }
  healHp(n){ this.hp=Math.min(this.maxHp,this.hp+n); hud(); }
  addDays(n){ this.day+=n*864e5; hud(); }
  hasCrew(id){ return this.crew.some(c=>c.id===id); }
  hasRelic(id){ return this.relics.includes(id); }
  addRelic(id){ if(!this.relics.includes(id)) this.relics.push(id); hud(); }
  randCard(rarity,arch){ let pool=REWARD_POOL.filter(id=>CARDS[id].rarity===rarity&&(!arch||CARDS[id].arch===arch)); if(!pool.length) pool=REWARD_POOL.filter(id=>CARDS[id].rarity===rarity); return pick(pool); }
  recruitRandom(){ if(this.crew.length>=4) return this.giveRandomRelic(); const opts=Object.keys(CREW).filter(k=>!this.hasCrew(k)); const id=pick(opts); this.crew.push({id,alt:rf()<.4}); Narr.once('crew'); hud(); return `${CREW[id].name} joins your company! ${CREW[id].desc}`; }
  giveRandomRelic(){ const o=Object.keys(RELICS).filter(k=>!this.hasRelic(k)); if(!o.length){this.addGold(40);return 'You find 40 Gold.';} const id=pick(o); this.addRelic(id); Narr.once('relic'); return `You gain the ${RELICS[id].name}: ${RELICS[id].desc}`; }
  loseRandomCrew(){ const i=rnd(this.crew.length); const c=this.crew.splice(i,1)[0]; hud(); return CREW[c.id].name; }
  removeCard(uid){ const i=this.deck.findIndex(c=>c.uid===uid); if(i<0) return; const c=this.deck.splice(i,1)[0]; this.stats.purged++; if(CARDS[c.id].type==='curse'){ this.stats.cursesPurged++; if(this.hasCrew('preacher')){ this.maxHp+=3; this.healHp(3);} } hud(); return c; }
  purgeAllCurses(){ const cs=this.deck.filter(c=>CARDS[c.id].type==='curse'); cs.forEach(c=>this.removeCard(c.uid)); return cs.length; }
  upgradeRandom(n){ const o=shuffle(this.deck.filter(c=>!c.up&&CARDS[c.id].type!=='curse')); o.slice(0,n).forEach(c=>c.up=true); }
  async pickPurge(filter,prompt,optional=false){ const list=this.deck.filter(filter); if(!list.length) return null; const c=await pickCard(list,prompt,optional); if(c){ this.removeCard(c.uid); Narr.once('purge'); } return c; }
  async pickUpgrade(){ const list=this.deck.filter(c=>!c.up&&CARDS[c.id].type!=='curse'); if(!list.length) return null; const c=await pickCard(list,'Upgrade which card?',false,true); if(c) c.up=true; return c; }
}
function save(){ if(!G) return; G.uidNext=UID; store.set(SAVE_KEY,G); }
/* Continue drops the player back exactly where the last checkpoint left them:
   mid fight at the start of their turn or after their last card, on the reward screen, on an event result, or in a fort. */
function resume(){
  const p=G.pending;
  if(!p||!p.n) return mapScreen();
  if(p.snap) return Combat.restore(p.snap);
  if(p.reward){ const enc=p.n.type==='boss'?ENC[ACT_BOSS[G.act]]:p.n.type==='elite'?ENC[ACT_ELITE[G.act]]:null; const hk=enc&&(enc.haz||ACT_BOSS[G.act]);
    $('#combat').innerHTML=`<div class="stage" style="background-image:url(${A(enc&&HAZ_READY.has(hk)?'haz_'+hk+'_c':ACTS[G.act].bg)})"></div><div class="hud"></div>`; show('combat'); hud(); return rewardScreen(p.reward.kind); }
  return runNode(p.n);
}
function checkpoint(n){ G.pending={n}; save(); }
function load(){ const d=store.get(SAVE_KEY); if(!d) return null; const r=Object.assign(Object.create(Run.prototype),d); UID=Math.max(UID,d.uidNext||1000); return r; }

/* card picker modal */
function pickCard(list,prompt,optional=false,showUp=false){
  return new Promise(res=>{
    const o=overlay(`<h2>${prompt}</h2><div class="sub">${showUp?'Upgraded preview shown. ':''}Your wagon holds ${G.deck.length} cards (limit ${G.cap}).</div>
      <div class="cardgrid">${list.map(c=>cardHTML(showUp?{...c,up:true}:c,{cls:'small'})).join('')}</div>
      ${optional?'<button class="btn dark" data-x>Keep everything</button>':''}`);
    o.addEventListener('click',e=>{
      const k=e.target.closest('.card'); if(k){ SFX.click(); const c=list.find(x=>String(x.uid)===k.dataset.uid); o.remove(); res(c); return; }
      if(e.target.closest('[data-x]')){ o.remove(); res(null); }
    });
  });
}
function deckView(){
  const sorted=[...G.deck].sort((a,b)=>(CARDS[a.id].type>CARDS[b.id].type?1:-1)||(a.id>b.id?1:-1));
  const o=overlay(`<h2>Your Wagon</h2><div class="sub">${G.deck.length} cards loaded · load limit ${G.cap}${G.over?` · <b style="color:#ff8a6a">Overloaded by ${G.over}: the oxen lose ${G.over} HP at the start of every fight${G.act===2&&ENC[ACT_BOSS[2]].weight?`, and ${G.over*ENC[ACT_BOSS[2]].weight} HP at ${ENC[ACT_BOSS[2]].name}`:''}</b>`:''}</div>
    <div class="cardgrid">${sorted.map(c=>cardHTML(c,{cls:'small'})).join('')}</div><button class="btn" data-x>Close</button>`);
  o.addEventListener('click',e=>{ if(e.target.closest('[data-x]')||e.target===o) o.remove(); });
}
function pileView(title,cards){
  const o=overlay(`<h2>${title}</h2><div class="cardgrid">${cards.length?cards.map(c=>cardHTML(c,{cls:'small'})).join(''):'<p class="sub">Empty.</p>'}</div><button class="btn" data-x>Close</button>`);
  o.addEventListener('click',e=>{ if(e.target.closest('[data-x]')||e.target===o) o.remove(); });
}

/* ====================== HUD ====================== */
function crewImg(c,mood){ if(c.alt) return A('alt_'+c.id); return A(`x_${c.id}_${mood||'joy'}`); }
function moodNow(){ const r=G.hp/G.maxHp; return r>.6?'joy':r>.3?'tense':'sick'; }
function hud(){
  if(!G) return;
  $$('.hud').forEach(h=>{
    const over=G.over;
    h.innerHTML=`
      <div class="it" data-tip="<b>Party Health</b><br>If it reaches 0, your journey ends."><img src="${A('badge_hp')}"><div class="hpbar"><i style="width:${100*G.hp/G.maxHp}%"></i><span>${G.hp} / ${G.maxHp}</span></div></div>
      <div class="it" data-tip="<b>Gold</b><br>Spend it at forts and on the trail."><img src="${A('badge_gold')}"><b>${G.gold}</b></div>
      <div class="it load ${over?'over':''}" data-tip="<b>Wagon Load</b><br>Every card is cargo. Your ${G.W.name} carries ${G.cap} cards. Each card over the limit costs 1 HP at the start of every encounter${Object.values(ENC).some(e=>e.weight)?`, and ${Object.values(ENC).filter(e=>e.weight).map(e=>e.weight+' HP at '+e.name).join(', ')}`:''}."><img src="${A('ic_satchel')}"><b>${G.deck.length}/${G.cap}</b></div>
      <div class="it" data-tip="<b>The Calendar</b><br>Every stop costs days. Reach Independence Rock by July 4. Reach the Columbia before October 5 or face early snow."><img src="${A('ic_scroll')}"><b>${fmtDate(G.day)}</b></div>
      <div class="it loc">Act ${G.act} · ${ACTS[G.act].name}</div>
      <div class="grow"></div>
      <div class="relics">${G.relics.map(r=>`<img src="${A(RELICS[r].art)}" data-tip="<b>${RELICS[r].name}</b><br>${RELICS[r].desc}">`).join('')}</div>
      <button class="iconbtn" data-deck>Wagon (${G.deck.length})</button>
      <button class="iconbtn" data-narr>${PREFS.narr?'Guide: On':'Guide: Off'}</button>
      <button class="iconbtn" data-snd>${PREFS.sound?'Sound: On':'Sound: Off'}</button>`;
  });
  $$('.crewstrip').forEach(s=>{
    const mood=moodNow();
    s.innerHTML=G.crew.map(c=>`<div class="crewp ${c.alt&&mood==='sick'?'sick':''} ${c.id==='gambler'&&C&&C.gamblerUsed?'used':''}" data-crew="${c.id}" data-tip="<b>${CREW[c.id].name}</b><br>${CREW[c.id].desc}"><img src="${crewImg(c,mood)}">${c.id==='gambler'&&C&&!C.gamblerUsed&&C.phase==='player'?'<div class="act">TAP: REDRAW</div>':''}</div>`).join('');
  });
}
function moodFlash(n){
  if(n<7) return;
  $$('.crewp').forEach(p=>{ const c=G.crew.find(x=>x.id===p.dataset.crew); if(!c) return; p.classList.add('alarm'); const im=p.querySelector('img'); if(!c.alt) im.src=crewImg(c,'alarm'); setTimeout(()=>{p.classList.remove('alarm'); if(!c.alt) im.src=crewImg(c,moodNow());},1300); });
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-deck]')){ SFX.click(); deckView(); }
  if(e.target.closest('[data-narr]')){ PREFS.narr=!PREFS.narr; store.set(PREF_KEY,PREFS); if(!PREFS.narr) Narr.clear(); hud(); }
  if(e.target.closest('[data-snd]')){ PREFS.sound=!PREFS.sound; store.set(PREF_KEY,PREFS); hud(); }
  const cp=e.target.closest('.crewp'); if(cp&&cp.dataset.crew==='gambler'&&C&&C.phase==='player'&&!C.gamblerUsed) C.gamblerRedraw();
});

/* ====================== TITLE & SELECT ====================== */
function titleScreen(){
  show('title'); G=null;
  $('#bCont').classList.toggle('hidden',!store.get(SAVE_KEY));
}
$('#bNew').onclick=()=>{ SFX.click(); selectScreen(); };
$('#bCont').onclick=()=>{ SFX.click(); G=load(); if(!G) return titleScreen(); resume(); };
$('#bHow').onclick=()=>{ SFX.click(); howTo(); };
function howTo(){
  const o=overlay(`<h2>How to Play</h2><div class="paper" style="max-width:900px;padding:2.5vh 2.5vw;font-size:clamp(14px,1.15vw,20px);line-height:1.5">
   <p><b>Your deck is your wagon.</b> Every card is cargo. Reach Oregon City across three acts, about 2,000 miles, before winter.</p><br>
   <p><b>On the trail map</b>, pick your next stop. Fights, river crossings, forts, campfires and mystery events all cost days. Your route runs east to west, from right to left.</p><br>
   <p><b>In a fight</b>, you get 3 Stamina and 5 cards each turn. <b>Progress</b> pushes the wagon past the obstacle: fill the bar to win. <b>Stability</b> blocks the damage the obstacle shows above its picture, and it drains away at the start of your next turn.</p><br>
   <p><b>Curses</b> like Dysentery and Broken Axle clog your hand. <b>Exhaust</b> removes a card for the rest of a fight. <b>Purge</b> removes it from your wagon for good.</p><br>
   <p><b>Load limit:</b> each wagon carries a set number of cards. Every card over the limit costs 1 HP at the start of every fight. Skipping a card reward is often the smart move.</p><br>
   <p><b>The calendar:</b> you leave Independence on May 5, 1848. Reach Independence Rock by July 4 for a reward. Reach the Columbia after October 5 and early snow follows you.</p></div>
   <button class="btn" data-x style="margin-top:2vh">Got It</button>`);
  o.addEventListener('click',e=>{ if(e.target.closest('[data-x]')) o.remove(); });
}
function selectScreen(){
  show('select');
  let wsel='schooner', diff='normal';
  const s=$('#select');
  s.innerHTML=`<div class="wrap"><h2>Outfit Your Wagon</h2><div class="sub">Independence, Missouri · May 5, 1848 · 2,000 miles to Oregon City</div>
   <div class="wagons">${WAGONS.map(w=>`<div class="wcard paper ${w.id===wsel?'sel':''}" data-w="${w.id}">
     <div class="wt">${w.tag}</div><img src="${A(w.art)}" style="${w.flip?'transform:scaleX(-1)':''}"><div class="wn">${w.name}</div>
     <div class="stats"><span data-tip="Party HP"><img src="${A('badge_hp')}">${w.hp}</span><span data-tip="Starting Gold"><img src="${A('badge_gold')}">${w.gold}</span><span data-tip="Load limit: cards you can carry without strain"><img src="${A('ic_satchel')}">${w.cap}</span></div>
     <div class="pas"><b>${w.passive}</b>${w.pdesc}</div><div class="blurb">${w.blurb}</div></div>`).join('')}</div>
   <div class="bottom"><div class="seg"><button data-d="easy">Greenhorn</button><button data-d="normal" class="on">Trail Boss</button></div>
   <button class="btn" id="bGo">Choose a Companion</button><button class="btn dark" id="bBack">Back</button></div></div>`;
  s.onclick=e=>{
    const w=e.target.closest('[data-w]'); if(w){ SFX.click(); wsel=w.dataset.w; $$('.wcard',s).forEach(x=>x.classList.toggle('sel',x.dataset.w===wsel)); }
    const d=e.target.closest('[data-d]'); if(d){ diff=d.dataset.d; $$('[data-d]',s).forEach(x=>x.classList.toggle('on',x===d)); }
    if(e.target.id==='bBack') titleScreen();
    if(e.target.id==='bGo'){ SFX.click(); G=new Run(wsel,diff); crewChoice(); }
  };
  Narr.say('pickWagon',{});
}
function crewChoice(){
  const opts=shuffle(Object.keys(CREW)).slice(0,3).map(id=>({id,alt:rf()<.4}));
  const o=overlay(`<h2>Who Rides With You?</h2><div class="sub">Choose one companion. You can recruit up to four on the trail.</div>
    <div class="crewpick">${opts.map((c,i)=>`<div class="crewopt paper" data-i="${i}"><img src="${crewImg(c)}"><b>${CREW[c.id].name}</b><span>${CREW[c.id].desc}</span></div>`).join('')}</div>`);
  o.addEventListener('click',e=>{ const k=e.target.closest('[data-i]'); if(!k) return; SFX.click(); G.crew.push(opts[+k.dataset.i]); o.remove(); startAct(1); });
}

/* ====================== MAP ====================== */
const COLS=7, LANES=5;
function genMap(act){
  const nodes={}; const key=(c,l)=>c+'_'+l;
  const add=(c,l)=>{ const k=key(c,l); if(!nodes[k]) nodes[k]={c,l,next:[],type:null,jy:(rf()-.5)*5,jx:(rf()-.5)*2.5}; return nodes[k]; };
  const starts=shuffle([0,1,2,3,4]).slice(0,2); starts.push(rnd(5),rnd(5));
  for(const s of starts){
    let l=s; add(0,l);
    for(let c=0;c<COLS-1;c++){
      let n=clamp(l+rnd(3)-1,0,LANES-1);
      for(const nd of Object.values(nodes)) if(nd.c===c) for(const t of nd.next){ if((nd.l<l&&t>n)||(nd.l>l&&t<n)) n=l; }
      const a=add(c,l); add(c+1,n); if(!a.next.includes(n)) a.next.push(n); l=n;
    }
  }
  const W={trail:45,mystery:28,river:18,fort:5,camp:4,elite:0};
  const W2={trail:32,mystery:22,river:14,elite:18,camp:8,fort:6};
  const wpick=w=>{ let t=Object.values(w).reduce((a,b)=>a+b,0),r=rf()*t; for(const[k,v]of Object.entries(w)){ if((r-=v)<0) return k; } return 'trail'; };
  const evPool=shuffle(EVENTS.filter(e=>e.acts.includes(act)).map(e=>e.id));
  let ei=0;
  for(const n of Object.values(nodes)){
    if(n.c===0) n.type='trail';
    else if(n.c===COLS-1) n.type='camp';
    else if(n.c===3) n.type=pick(['fort','fort','mystery','elite']);
    else n.type=wpick(n.c<=2?W:W2);
    if(n.type==='mystery') n.ev=evPool[ei++%evPool.length];
  }
  // at most 2 forts, never fort straight after fort
  const forts=shuffle(Object.values(nodes).filter(n=>n.type==='fort'));
  forts.slice(2).forEach(n=>{ n.type='mystery'; n.ev=evPool[ei++%evPool.length]; });
  for(const n of Object.values(nodes)) if(n.type==='fort') for(const l of n.next){ const t=nodes[(n.c+1)+'_'+l]; if(t&&t.type==='fort') t.type='trail'; }
  // guarantee at least one fort reachable
  if(!Object.values(nodes).some(n=>n.type==='fort')){ const m=Object.values(nodes).filter(n=>n.c===3); if(m.length) m[0].type='fort'; }
  return {nodes,done:[],bossDone:false};
}
function nodeXY(n){ return {x:88-n.c*(74/COLS)+n.jx, y:23+n.l*12.5+n.jy}; }
const NODE_ICON={trail:'node_trail',river:'node_river',fort:'node_fort',camp:'node_camp',mystery:'node_mystery',elite:'node_boss',boss:'node_boss'};
const NODE_NAME={trail:'The Trail',river:'River Crossing',fort:'Trading Fort',camp:'Campfire',mystery:'Unknown',elite:'Dangerous Obstacle',boss:'Act Boss'};
function availNodes(){
  const m=G.map; const all=Object.values(m.nodes);
  if(!G.pos) return all.filter(n=>n.c===0);
  if(G.pos.c===COLS-1) return ['boss'];
  const cur=m.nodes[G.pos.c+'_'+G.pos.l]; return cur.next.map(l=>m.nodes[(G.pos.c+1)+'_'+l]);
}
function mapScreen(){
  show('map'); save();
  const s=$('#map'); const m=G.map; const act=ACTS[G.act];
  const avail=availNodes();
  const miles = (G.act-1?ACTS[1].miles:0)+(G.act>2?ACTS[2].miles:0) + Math.round(act.miles*((G.pos?G.pos.c+1:0)/(COLS+1)));
  let lines='';
  for(const n of Object.values(m.nodes)){ const a=nodeXY(n); for(const l of n.next){ const b=nodeXY(m.nodes[(n.c+1)+'_'+l]); lines+=`<line x1="${a.x}%" y1="${a.y}%" x2="${b.x}%" y2="${b.y}%" stroke="#5a3a18" stroke-width="3" stroke-dasharray="7 7" opacity=".75"/>`; }
    if(n.c===COLS-1) lines+=`<line x1="${a.x}%" y1="${a.y}%" x2="9%" y2="52%" stroke="#5a3a18" stroke-width="3" stroke-dasharray="7 7" opacity=".75"/>`; }
  const daysTip=t=>`${NODE_DAYS[t]-(G.hasRelic('watch')?1:0)} days`;
  const nodesHtml=Object.values(m.nodes).map(n=>{
    const p=nodeXY(n); const k=n.c+'_'+n.l; const isAv=avail.includes(n); const done=m.done.includes(k); const cur=G.pos&&G.pos.c===n.c&&G.pos.l===n.l;
    let label=NODE_NAME[n.type]; let lbl='';
    if(n.type==='mystery'&&G.hasCrew('cartographer')){ const ev=EVENTS.find(e=>e.id===n.ev); label='Mapped: '+ev.title; lbl=`<div class="lbl">${ev.title.replace(/^The /,'')}</div>`; }
    if(n.type==='fort') lbl=`<div class="lbl">${act.fort}</div>`;
    return `<div class="node ${n.type} ${isAv?'avail':''} ${done?'done':''} ${cur?'cur':''}" data-k="${k}" style="left:${p.x}%;top:${p.y}%" data-tip="<b>${label}</b><br>${daysTip(n.type)}${n.type==='elite'?'<br>A hard fight. Wins recruit new crew.':''}"><img src="${A(NODE_ICON[n.type])}">${lbl}</div>`;
  }).join('');
  const bossAv=avail[0]==='boss';
  const bossEnc=ENC[ACT_BOSS[G.act]];
  s.innerHTML=`<div class="hud"></div><div class="board"><svg>${lines}</svg>${nodesHtml}
    <div class="node boss ${bossAv?'avail':''}" data-k="boss" style="left:9%;top:52%" data-tip="<b>${bossEnc.name}</b><br>The act boss. ${daysTip('boss')}.${bossEnc.weight?`<br><b>Weight Check:</b> every card over your load limit costs ${bossEnc.weight} HP here${G.over?`. You are ${G.over} over: <b>${G.over*bossEnc.weight} HP</b>`:''}.`:''}"><img src="${A(HAZ_READY.has(bossEnc.haz||ACT_BOSS[G.act])?'haz_'+(bossEnc.haz||ACT_BOSS[G.act])+'_a':bossEnc.art)}" style="border-radius:50%;border:5px solid #c9a25a;object-fit:cover;aspect-ratio:1"><div class="lbl">${act.to}</div></div>
    <div class="banner paper"><div class="h1">Act ${G.act}: ${act.name}</div><div class="route">${act.from} → ${act.to} · ${fmtDateY(G.day)}</div></div>
    <div class="trailbar paper"><b>${miles} of 2,000 miles</b><div class="bar"><i style="width:${miles/20}%"></i></div>${G.day>WINTER_DAY?'<b style="color:#8e2a1e">Early snow is falling.</b>':`Winter risk after ${fmtDate(WINTER_DAY)}`}</div>
    <div class="legend paper">${['trail','river','mystery','fort','camp','elite'].map(t=>`<span class="li"><img src="${A(NODE_ICON[t])}" style="${t==='elite'?'filter:hue-rotate(-30deg) saturate(1.6)':''}">${NODE_NAME[t]} <small>${daysTip(t)}</small></span>`).join('')}</div></div><div class="crewstrip"></div>`;
  hud();
  s.onclick=e=>{
    const nd=e.target.closest('.node.avail'); if(!nd) return; SFX.click(); Narr.clear();
    if(nd.dataset.k==='boss') return travel('boss');
    const n=m.nodes[nd.dataset.k]; travel(n);
  };
  mapNarration();
}
function mapNarration(){
  const c=G.pos?G.pos.c:-1;
  if(G.act===1&&!G.pos) return;
  const o={pose:'tr_three'};
  if(G.act===1&&c===3) return Narr.once('chimneyView',o);
  if(G.act===2&&c===2) return Narr.once('devilsGate',o);
  if(G.act===2&&c===5) return Narr.once('southPassNear',o);
  if(G.act===3&&c===2) return Narr.once('blueMtns',o);
  if(G.act===3&&c===5) return Narr.once('dalles',o);
  if(G.over>0) return Narr.once('overload',o);
  if(Math.random()<.25) Narr.say('map',o);
}
async function travel(n){
  if(n==='boss'){ G.addDays(NODE_DAYS.boss-(G.hasRelic('watch')?1:0)); checkpoint({type:'boss'}); return runNode({type:'boss'}); }
  G.pos={c:n.c,l:n.l}; G.map.done.push(n.c+'_'+n.l);
  G.addDays(NODE_DAYS[n.type]-(G.hasRelic('watch')?1:0));
  checkpoint({type:n.type,ev:n.ev});
  if(G.act===3&&G.day>WINTER_DAY) await Narr.once('winter');
  runNode(n);
}
async function runNode(n){
  switch(n.type){
    case 'trail': return fight(pickNormal());
    case 'river': if(G.flags.ferry){ G.flags.ferry=false; return ferryScreen(); } return fight('river');
    case 'elite': return fight(ACT_ELITE[G.act]);
    case 'boss': return fight(ACT_BOSS[G.act]);
    case 'fort': return fortScreen(ACTS[G.act].fort);
    case 'camp': return campScreen();
    case 'mystery': return eventScreen(n.ev);
    case 'ambush': return fight('bandit_ambush');
    case 'hub': return fortScreen(n.name,true);
  }
}
function pickNormal(){ const pool=ACT_NORMALS[G.act].filter(x=>x!==G.lastNormal); G.lastNormal=pick(pool); return G.lastNormal; }
async function afterNode(){
  if(G.hp<=0) return endScreen(false);
  G.pending=null;
  // Independence Rock: first stop of act 2
  if(G.act===2&&G.pos&&G.pos.c===0&&!G.flags.indepChecked){
    G.flags.indepChecked=true;
    if(G.day<=JULY4){ G.flags.indep=true; G.maxHp+=6; G.healHp(6); await showIndep(true); }
    else await showIndep(false);
  }
  mapScreen();
}
function showIndep(ok){
  return new Promise(res=>{
    const o=overlay(`<div class="evbox paper" style="position:relative;left:auto;top:auto;transform:none;margin:auto"><div class="pic" style="background-image:url(${A('bg_act2')})"></div><div><h2>Independence Rock</h2>
      <p>A great granite whaleback rises from the Sweetwater valley. Thousands of emigrants painted or carved their names on it. The rule of the road said to reach it by the Fourth of July.</p>
      <div class="result">${ok?`You arrived on ${fmtDate(G.day)}, ahead of schedule! Your company carves its name and celebrates. +6 Max HP.`:`You arrived on ${fmtDate(G.day)}. Behind schedule. The company is quiet.`}</div>
      <button class="btn" data-x>Onward</button></div></div>`);
    Narr.say(ok?'indepOnTime':'indepLate',{big:true,pose:'tr_closeup'});
    o.addEventListener('click',e=>{ if(e.target.closest('[data-x]')){ o.remove(); res(); } });
  });
}
function ferryScreen(){
  const s=$('#event'); show('event'); s.style.backgroundImage=`url(${A(ACTS[G.act].bg)})`;
  s.innerHTML=`<div class="hud"></div><div class="evbox paper"><div class="pic" style="background-image:url(${A('ev_ferry')})"></div><div><h2>${PLACE_NAMES[G.act].river}</h2><p>Your guide meets you at the bank and takes the company across without losing so much as a skillet.</p><div class="result">A free, safe crossing.</div><button class="btn" data-x>Continue</button></div></div>`;
  hud(); s.onclick=e=>{ if(e.target.closest('[data-x]')) afterNode(); };
}
async function startAct(a){
  G.act=a; G.map=genMap(a); G.pos=null;
  if(a>1){ const heal=Math.round((G.maxHp-G.hp)*.5); G.healHp(heal); G.pending={n:{type:'hub',name:a===2?'Fort Laramie':'Fort Hall'}}; }
  save();
  const act=ACTS[a];
  if(a===1) mapScreen(); else fortScreen(G.pending.n.name,true);
  const card=document.createElement('div'); card.className='actcard';
  card.innerHTML=`<div class="k">ACT ${['','I','II','III'][a]}</div><div class="n">${act.name}</div><div class="r">${act.from} to ${act.to}</div>`;
  $('.screen.on').appendChild(card); SFX.turn();
  setTimeout(()=>card.remove(),2600);
  if(a===1){ await Narr.say('intro',{big:true,pose:'tr_closeup'}); await Narr.say('act1',{pose:'tr_three'}); }
}

/* ====================== COMBAT ====================== */
let C=null;
class Combat{
  constructor(encId){
    this.encId=encId; this.e=ENC[encId]; this.scale=ACT_SCALE[G.act];
    this.need=Math.round(this.e.need*(this.e.boss||this.e.elite?1:this.scale.need)*(this.e.boss||this.e.elite?1:1));
    this.p=0; this.bar=0; this.st=0; this.stam=3; this.turn=0; this.enr=0; this.escN=0;
    this.draw_=shuffle(G.deck.map(c=>({...c,master:true}))); this.hand=[]; this.disc=[]; this.exh=[];
    this.powers={}; this.nextDraw=0; this.nextStam=0; this.retainStab=false; this.playedThisTurn=0; this.actionsPlayed=0;
    this.smithUsed=false; this.gamblerUsed=false; this.supplyPlayed=false; this.provisionHeals=0; this.shoeUsed=false; this.phase='start';
    this.intentIdx=this.e.boss||this.e.elite?0:rnd(this.e.intents.length); this.name=this.e.boss||this.e.elite?this.e.name:(PLACE_NAMES[G.act][encId]||this.e.name);
  }
  get intent(){ return this.e.intents[this.intentIdx%this.e.intents.length]; }
  dmgOf(it){ if(!it.d) return 0; const diff=G.diff==='easy'?.8:1; let d=Math.round(it.d*this.scale.dmg*diff)+this.enr+(it.esc?it.esc*this.escN:0); if(this.encId==='columbia1'&&G.day>WINTER_DAY) d+=3; return d; }
  hasTag(t){ return (this.e.tags||[]).includes(t); }
  crew(id){ return G.hasCrew(id); }
  costOf(ci){ const d=CARDS[ci.id]; let c=(ci.up&&d.costUp!=null)?d.costUp:d.cost; if(c<0) return c; if(SPEED.has(ci.id)&&this.hand.some(x=>x.id==='mudlocked')) c+=1; if(d.type==='supply'&&this.crew('blacksmith')&&!this.smithUsed) c=0; return c; }
  playable(ci){ const d=CARDS[ci.id]; if(d.needsOther&&!this.hand.some(x=>x!==ci)) return false; return !d.unplayable && this.costOf(ci)<=this.stam && this.phase==='player'; }
  /* effects */
  prog(n){ n=Math.max(0,Math.round(n)); if(!n) return; let left=n; if(this.bar>0){ const b=Math.min(this.bar,left); this.bar-=b; left-=b; floatAt('.foe .barrier','-'+b,'#9fd3ff'); }
    this.p+=left; if(this.p>=this.need&&!this.busy&&this.phase!=='over') setTimeout(()=>this.win(),0); floatAt('.foe .art','+'+n,'#ffe08a'); vfxAt('.foe .art','vfx_gold',.6); SFX.prog(); $('.foe')?.classList.add('hit'); setTimeout(()=>$('.foe')?.classList.remove('hit'),300); this.render(); }
  stab(n){ if(this.hand.some(x=>x.id==='frostbite')) n-=2*this.hand.filter(x=>x.id==='frostbite').length; n=Math.max(0,n); this.st+=n; if(n){ floatAt('.shieldb','+'+n,'#9fd3ff'); SFX.block(); } this.render(); }
  heal(n){ const b=G.hp; G.healHp(n); if(G.hp>b){ floatAt('.rig','+'+(G.hp-b)+' HP','#8ff08a'); SFX.heal(); } }
  selfHurt(n,src){ if(n<=0) return; G.hurt(n); floatAt('.rig','-'+n,'#ff7a5c'); SFX.hit(); flashRed(); }
  gold(n){ const m=n; G.addGold(m); floatAt('.rig','+'+m+' gold','#ffe08a'); if(this.powers.monopoly) this.prog(this.powers.monopoly); }
  spend(n){ G.addGold(-n); floatAt('.rig','-'+n+' gold','#ffe08a'); }
  gainStam(n){ this.stam+=n; this.render(); }
  power(id,v){ this.powers[id]=(this.powers[id]||0)+v; banner(CARDS[{hitch:'double_time_hitch',monopoly:'manifest_monopoly',campfire:'campfire_prep',grit:'plague_doctors_grit'}[id]].name,'Power active',$('#combat')); }
  barrier(n){ n=Math.round(n*(this.e.boss||this.e.elite?1:this.scale.need)); this.bar+=n; this.render(); }
  enrage(n){ this.enr+=Math.round(n*this.scale.dmg); }
  addTemp(id,dest){ const c={id,up:false,uid:UID++,temp:true}; if(dest==='hand'&&this.hand.length<10) this.hand.push(c); else if(dest==='draw'){ this.draw_.splice(rnd(this.draw_.length+1),0,c);} else this.disc.push(c); SFX.curse(); this.render(); }
  removeFromPiles(ci){ for(const p of [this.hand,this.draw_,this.disc]){ const i=p.indexOf(ci); if(i>=0){ p.splice(i,1); return true; } } return false; }
  exhaustCard(ci){ this.removeFromPiles(ci); this.exh.push(ci); this.onExhaust(); this.render(); }
  onExhaust(){ if(this.powers.campfire){ this.prog(this.powers.campfire); this.stab(this.powers.campfire);} if(G.wagon==='schooner'&&this.provisionHeals<3){ this.provisionHeals++; this.heal(1);} }
  purge(ci){ this.removeFromPiles(ci); if(ci.master) G.removeCard(ci.uid); floatAt('.rig','Purged '+CARDS[ci.id].name,'#f3d98f'); this.render(); }
  discardCard(ci){ const i=this.hand.indexOf(ci); if(i>=0){ this.hand.splice(i,1); this.disc.push(ci);} this.render(); }
  discardRandom(n){ for(let i=0;i<n&&this.hand.length;i++){ const c=this.hand.splice(rnd(this.hand.length),1)[0]; this.disc.push(c);} this.render(); }
  stealIfHit(n){ if(this._hitThrough){ const s=Math.min(G.gold,n); if(s){ G.addGold(-s); floatAt('.rig','-'+s+' gold stolen','#ffe08a'); } } }
  undertow(th){ if(this.st<th){ const s=this.hand.concat(this.draw_).find(x=>CARDS[x.id].type==='supply'); if(s){ this.removeFromPiles(s); this.exh.push(s); floatAt('.rig',CARDS[s.id].name+' washed away','#9fd3ff'); } } }
  async draw(n){
    const got=[];
    for(let i=0;i<n;i++){
      if(!this.draw_.length){ if(!this.disc.length) break; this.draw_=shuffle(this.disc); this.disc=[]; }
      const c=this.draw_.pop();
      if(this.hand.length>=10){ this.disc.push(c); continue; }
      this.hand.push(c); got.push(c);
      if(CARDS[c.id].type==='curse'){
        if(this.powers.grit){ this.prog(this.powers.grit); this.stab(this.powers.grit); }
        if(G.wagon==='apothecary'&&!this.tolerated){ this.tolerated=true; n++; }
      }
    }
    this.render(); return got;
  }
  chooseFromHand(prompt,filter,fn){
    const opts=this.hand.filter(filter); if(!opts.length) return Promise.resolve(null);
    return new Promise(res=>{ this.picking={prompt,opts,fn:(c)=>{fn(c);res(c);}}; this.render(); });
  }
  async gamblerRedraw(){ if(this.gamblerUsed||this.phase!=='player'||this.busy||this.picking) return; this.gamblerUsed=true; SFX.card(); this.disc.push(...this.hand); this.hand=[]; await this.draw(5); hud(); this.checkpoint(); }
  /* save points */
  snap(){ const o={}; ['encId','p','bar','st','stam','turn','enr','escN','draw_','hand','disc','exh','powers','nextDraw','nextStam','retainStab','playedThisTurn','actionsPlayed','smithUsed','gamblerUsed','supplyPlayed','provisionHeals','shoeUsed','intentIdx','tolerated','lowSaid'].forEach(k=>o[k]=this[k]); return JSON.parse(JSON.stringify(o)); }
  checkpoint(){ if(C!==this||this.winning||!G.pending||G.hp<=0) return; G.pending.snap=this.snap(); save(); }
  static restore(snap){
    C=new Combat(snap.encId); Object.assign(C,JSON.parse(JSON.stringify(snap)));
    C.phase='player'; C.busy=false; C.picking=null;
    show('combat'); C.build(); hud(); C.render();
    if(C.p>=C.need) C.win();
  }
  /* flow */
  async start(){
    this.phase='start'; show('combat'); this.build();
    G.stats.fights++;
    if(this.e.boss) Narr.say('boss_'+this.encId,{big:true,pose:'tr_closeup',top:true});
    else if(this.e.elite) Narr.say('elite',{top:true});
    else if(!G.seen.firstFight) Narr.once('firstFight',{top:true});
    else if(Math.random()<.15) Narr.say('fight',{top:true});
    banner(this.name, this.e.boss?'Boss':this.e.elite?'Elite':(this.e.tags||[]).join(' · '),$('#combat'));
    await sleep(700);
    // start-of-encounter effects
    if(G.wagon==='conestoga') this.stab(4);
    if(G.hasRelic('blanket')) this.stab(5);
    if(this.crew('gambler')) this.gold(5);
    const over=G.over; if(over>0){ const w=this.e.weight||1; await sleep(300); this.selfHurt(over*w); floatAt('.rig',`Overloaded! -${over*w} HP`,'#ff7a5c'); if(this.e.weight) banner('Weight Check',`${over} cards over the limit`,$('#combat')); }
    if(G.act===3&&G.day>WINTER_DAY) this.addTemp('frostbite','draw');
    if(G.hp<=0) return this.lose();
    await this.startTurn();
  }
  async startTurn(){
    if(this.winning||C!==this) return;
    this.turn++; this.phase='player'; this.tolerated=false; this.playedThisTurn=0;
    if(!this.retainStab) this.st=0; this.retainStab=false;
    let stam=3+this.nextStam; this.nextStam=0;
    if(this.turn===1&&G.wagon==='stagecoach') stam++;
    if(this.turn===1&&this.e.boss&&this.encId!=='columbia2'&&G.act===3&&G.flags.driveHard) stam++;
    this.stam=Math.max(1,stam);
    let n=5+this.nextDraw; this.nextDraw=0;
    if(this.turn===1){ if(G.hasRelic('compass')) n++; if(this.crew('scout')&&(this.hasTag('wildlife')||this.hasTag('mountain')||this.e.boss)) n+=2; }
    SFX.turn(); this.render();
    await this.draw(Math.max(1,n));
    hud(); this.render(); this.checkpoint();
    if(G.hp<this.maxLow()&&!this.lowSaid){ this.lowSaid=true; Narr.say('lowHp',{top:true}); }
  }
  maxLow(){ return G.maxHp*.3; }
  async play(ci){
    if(this.picking){ if(this.picking.opts.includes(ci)){ const p=this.picking; this.picking=null; p.fn(ci); this.render(); } return; }
    if(this.phase!=='player'||this.busy) return;
    if(!this.playable(ci)) { const el=$(`.hand .card[data-uid="${ci.uid}"]`); el&&el.classList.add('shake'); setTimeout(()=>el&&el.classList.remove('shake'),400); return; }
    this.busy=true;
    const d=CARDS[ci.id]; const cost=this.costOf(ci);
    if(d.type==='supply'&&this.crew('blacksmith')&&!this.smithUsed) this.smithUsed=true;
    this.stam-=cost; const i=this.hand.indexOf(ci); this.hand.splice(i,1);
    const el=$(`.hand .card[data-uid="${ci.uid}"]`); if(el){ el.classList.add('flyout'); }
    SFX.card(); this.playedThisTurn++;
    this.render(true);
    await sleep(120);
    if(d.play) await d.play(this,!!ci.up,ci);
    if(d.type==='supply'){ this.supplyPlayed=true; if(G.hasRelic('goldpan')) this.gold(2); }
    if(d.type==='action'){ this.actionsPlayed++; if(this.crew('oxdriver')&&this.actionsPlayed%4===0){ floatAt('.rig','Ox-Driver!','#f3d98f'); this.prog(5);} }
    if(this.powers.hitch&&this.playedThisTurn%3===0) this.prog(this.powers.hitch);
    if(ci._purgeSelf){ delete ci._purgeSelf; if(ci.master) G.removeCard(ci.uid); floatAt('.rig',d.name+' left behind','#f3d98f'); }
    else if(d.type==='power'){ /* powers vanish */ }
    else if(d.exhaust){ this.exh.push(ci); this.onExhaust(); }
    else this.disc.push(ci);
    this.busy=false; hud(); this.render();
    if(G.hp<=0) return this.lose();
    if(this.p>=this.need) return this.win();
    this.checkpoint();
  }
  async endTurn(){
    if(this.phase!=='player'||this.busy||this.picking) return;
    this.phase='enemy'; this.render();
    // curses in hand
    for(const k of [...this.hand]){ const d=CARDS[k.id]; if(d.type!=='curse'||!d.endTurn) continue;
      if(this.powers.grit){ if(['frostbite','exhaustion'].includes(k.id)) this.exhaustCard(k); continue; }
      d.endTurn(this,k); await sleep(250); if(this.winning) return; }
    if(G.hp<=0) return this.lose();
    this.disc.push(...this.hand); this.hand=[]; this.render();
    await sleep(350);
    // obstacle acts
    const it=this.intent; let dmg=this.dmgOf(it); const hits=it.h||1; this._hitThrough=false;
    if(it.d){
      for(let h=0;h<hits;h++){
        let dd=dmg; if(G.hasRelic('horseshoe')&&!this.shoeUsed){ this.shoeUsed=true; dd=Math.max(0,dd-5); floatAt('.rig','Lucky!','#f3d98f'); }
        const blocked=Math.min(this.st,dd); this.st-=blocked; const thru=dd-blocked; this.impact();
        vfxAt('.rig',this.hasTag('river')?'vfx_water':this.hasTag('weather')&&this.hasTag('mountain')?'vfx_snow':this.hasTag('storm')?'vfx_lightning':this.hasTag('wildlife')?'vfx_fire':'vfx_wind',1);
        if(blocked) { floatAt('.shieldb','Blocked '+blocked,'#9fd3ff'); SFX.block(); }
        if(thru>0){ this._hitThrough=true; this.selfHurt(thru); $('#combat .stage').classList.add('shake'); setTimeout(()=>$('#combat .stage')?.classList.remove('shake'),350); }
        this.render(); await sleep(420); if(this.winning) return;
        if(G.hp<=0) return this.lose();
      }
      this.enr=0;
    }
    if(this.winning) return;
    if(it.fx) it.fx(this);
    if(it.esc) this.escN++;
    this.render(); await sleep(300);
    if(G.hp<=0) return this.lose();
    this.intentIdx++;
    await this.startTurn();
  }
  async win(){
    if(this.winning||C!==this) return; this.winning=true;
    this.phase='over'; this.render();
    if(this.e.phase2){
      banner('The River!','Phase Two',$('#combat')); await sleep(900);
      const keep={hand:this.hand,draw_:this.draw_,disc:this.disc,exh:this.exh,powers:this.powers,turn:this.turn};
      const nc=new Combat(this.e.phase2); Object.assign(nc,keep,{nextDraw:0,nextStam:0,gamblerUsed:this.gamblerUsed,smithUsed:this.smithUsed,lowSaid:this.lowSaid,
        /* one encounter, two phases: once per encounter effects stay spent, running counts keep counting */
        shoeUsed:this.shoeUsed,supplyPlayed:this.supplyPlayed,provisionHeals:this.provisionHeals,actionsPlayed:this.actionsPlayed});
      nc.disc.push(...nc.hand); nc.hand=[]; C=nc; nc.build(); Narr.say('boss_columbia2',{big:true,pose:'tr_closeup',top:true}); await sleep(600); nc.turn=0; await nc.startTurn(); return;
    }
    G.stats.wins=(G.stats.wins||0)+1;
    SFX.win(); banner(this.e.boss?'Victory!':'Cleared!', this.e.boss?ACTS[G.act].to+' reached':'',$('#combat'));
    if(this.hz){ $('#combat').classList.add('won'); } else { const rg=$('.rig'); if(rg) rg.style.left='80%'; }
    if(this.crew('cook')&&this.supplyPlayed) G.healHp(3);
    if(G.hasRelic('skillet')) G.healHp(2);
    if(this.e.elite) G.stats.elites++;
    if(G.pending){ G.pending.snap=null; G.pending.reward={kind:this.e.boss?'boss':this.e.elite?'elite':'normal'}; save(); }
    await sleep(1300);
    Narr.say(this.e.boss?'winBoss':this.e.elite?'winElite':'winSmall',{top:!this.e.boss,big:!!this.e.boss,pose:this.e.boss?'tr_closeup':'tr_portrait'});
    const kind=this.e.boss?'boss':this.e.elite?'elite':'normal';
    C=null; rewardScreen(kind);
  }
  async lose(){ G.lastEnc=this.name; this.phase='over'; SFX.lose(); await sleep(900); C=null; endScreen(false); }
  /* view */
  /* Head-on hazard scenes: the hazard charges down the trail at the player, the wagon is seen from behind. */
  get hazKey(){ return this.e.haz||this.encId; }
  rigArt(){ const k=this.e.raft?'raft':G.wagon; const hurt=G.hp<G.maxHp*.5;
    if(RIG_READY.has(k)) return A(`rig_${k}_${hurt?'hurt':'ok'}`);
    return A(this.e.raft?'schooner_raft':'schooner_rear'); }
  impact(){ if(!this.hz) return; const s=$('#combat'); s.classList.remove('impact'); void s.offsetWidth; s.classList.add('impact'); clearTimeout(this.impT); this.impT=setTimeout(()=>s.classList.remove('impact'),520); }
  build(){
    const s=$('#combat'); const bg=this.e.bg||ACTS[G.act].bg;
    this.hz=HAZ_READY.has(this.hazKey)?this.hazKey:null;
    s.classList.toggle('hzmode',!!this.hz); s.classList.remove('won','impact');
    const w=G.W; const wagArt=this.e.raft?'schooner_raft':(G.wagon==='schooner'&&G.act===3&&G.day>WINTER_DAY?'schooner_snow':w.art);
    const wxHtml=this.e.wx?`<div class="wx ${this.e.wx}"></div>`:(G.act===3&&G.day>WINTER_DAY?'<div class="wx snow"></div>':'');
    const stage=this.hz?`<div class="stage hz" style="background-image:url(${A('haz_'+this.hz+'_a')})"><div class="hzl hzb" style="background-image:url(${A('haz_'+this.hz+'_b')})"></div><div class="hzl hzc" style="background-image:url(${A('haz_'+this.hz+'_c')})"></div></div>`
      :`<div class="stage" style="background-image:url(${A(bg)})"></div>`;
    const rig=this.hz?`<div class="rig3"><img class="wag3" src="${this.rigArt()}"><div class="shieldb"><img src="${A('st_shield')}"><span></span></div></div>`
      :`<div class="track"><div class="rig idle" style="left:0%"><img class="dust" src="${A('dust_b')}"><img class="wag ${w.flip&&!this.e.raft?'flip':''}" src="${A(wagArt)}">${this.e.raft?'':`<img class="ox" src="${A('oxen_a')}">`}
        <div class="shieldb"><img src="${A('st_shield')}"><span></span></div></div></div>`;
    s.innerHTML=`${stage}${wxHtml}
      <div class="hud"></div><div class="crewstrip"></div>${rig}
      <div class="foe ${this.e.boss?'boss':this.e.elite?'elite':''}"><div class="intent"></div><div class="art" style="background-image:url(${A(this.e.art)})"><div class="barrier"><img src="${A('int_freeze')}"><span></span></div></div>
        <div class="fhead"><div class="name">${this.name}</div><div class="tags">${(this.e.tags||[]).join(' · ')}</div><div class="pbar"><i></i><b></b><span></span></div></div></div>
      <div class="dock"><div class="hand"></div></div>
      <div class="stam" data-tip="<b>Stamina</b><br>Each card costs Stamina. You get 3 each turn."><img src="${A('badge_cost')}"><span></span><small>Stamina</small></div>
      <div class="piles"><button class="iconbtn" data-pile="draw">Draw <b></b></button><button class="iconbtn" data-pile="disc">Discard <b></b></button><button class="iconbtn" data-pile="exh">Exhausted <b></b></button></div>
      <div class="turnlbl"></div><button class="btn red endturn">End Turn</button>`;
    if(this.hz) $('.foe',s).classList.add('haz');
    s.onclick=e=>{
      const k=e.target.closest('.hand .card'); if(k&&C){ const ci=C.hand.find(x=>String(x.uid)===k.dataset.uid); if(ci) C.play(ci); return; }
      if(e.target.closest('.endturn')&&C){ SFX.click(); C.endTurn(); }
      const p=e.target.closest('[data-pile]'); if(p&&C){ const t=p.dataset.pile; if(t==='draw') pileView('Draw Pile (shuffled)',[...C.draw_].sort((a,b)=>a.id>b.id?1:-1)); if(t==='disc') pileView('Discard Pile',C.disc); if(t==='exh') pileView('Exhausted',C.exh); }
    };
    let oxt=0; clearInterval(this.oxTimer); this.oxTimer=setInterval(()=>{ const ox=$('#combat .ox'); if(!ox){clearInterval(this.oxTimer);return;} if($('.rig.moving')){ oxt^=1; ox.src=A(oxt?'oxen_b':'oxen_a'); } },260);
    hud(); this.render();
  }
  render(skipHand){
    if(C!==this) return;
    const s=$('#combat'); if(!s.classList.contains('on')) return;
    const pct=clamp(this.p/this.need,0,1);
    const pb=$('.pbar',s); if(pb){ $('i',pb).style.width=pct*100+'%'; const b=$('b',pb); b.style.left=pct*100+'%'; b.style.width=Math.min(100-pct*100,100*this.bar/this.need)+'%'; $('span',pb).textContent=`Progress ${Math.min(this.p,this.need)} / ${this.need}${this.bar?`  ·  blocked ${this.bar}`:''}`; }
    const r3=$('.rig3',s); if(r3){ const f=this.phase==='over'&&this.winning?1:pct; r3.style.transform=`translate(${(f*30).toFixed(2)}vw,${(-f*18).toFixed(2)}vh) scale(${(1-f*.42).toFixed(3)})`; const wi=$('.wag3',r3), src=this.rigArt(); if(wi&&!wi.src.endsWith(src.replace('art/',''))) wi.src=src; }
    const rig=$('.rig',s); if(rig){ const nl=(pct*62).toFixed(1)+'%'; if(rig.style.left!==nl){ rig.style.left=nl; rig.classList.add('moving'); rig.classList.remove('idle'); clearTimeout(this.mvT); this.mvT=setTimeout(()=>{rig.classList.remove('moving');rig.classList.add('idle');},700);} }
    const sb=$('.shieldb',s); if(sb){ sb.classList.toggle('on',this.st>0); $('span',sb).textContent=this.st; sb.dataset.tip='<b>Stability</b><br>Blocks incoming damage. Drains at the start of your turn.'; }
    const br=$('.foe .barrier',s); if(br){ br.classList.toggle('on',this.bar>0); $('span',br).textContent=this.bar; br.dataset.tip='<b>Blocked Progress</b><br>Your next Progress clears this before it moves the bar.'; }
    const it=this.intent; const dmg=this.dmgOf(it); const ie=$('.intent',s);
    if(ie){ ie.style.visibility=this.phase==='over'?'hidden':'visible';
      ie.innerHTML=`<img src="${A('int_'+(it.i==='buff'?'scatter':it.i))}" style="${it.i==='buff'?'filter:hue-rotate(180deg)':''}">${it.d?`<span class="dmg">${dmg}${it.h>1?'×'+it.h:''}</span>`:''}<div class="nm"><b>${it.n}</b>${it.t?`<small>${it.t}</small>`:''}</div>`;
      ie.dataset.tip=`<b>Next turn: ${it.n}</b><br>${it.d?`Deals ${dmg} damage${it.h>1?' '+it.h+' times':''}. `:''}${it.t||''}`; }
    $('.stam span',s).textContent=this.stam;
    const pl=$$('[data-pile] b',s); if(pl.length){ pl[0].textContent=this.draw_.length; pl[1].textContent=this.disc.length; pl[2].textContent=this.exh.length; }
    $('.turnlbl',s).innerHTML=this.picking?`<b style="color:#ffe9a0;font-size:1.3em">${this.picking.prompt}</b>`:`Turn ${this.turn}`;
    $('.endturn',s).disabled=this.phase!=='player'||!!this.picking;
    if(skipHand||(this.busy&&!this.picking)) return;
    const h=$('.hand',s); if(!h) return;
    const ov=Math.max(0,this.hand.length-6);
    h.innerHTML=this.hand.map(c=>cardHTML(c,{cost:this.costOf(c),cls:(this.picking?(this.picking.opts.includes(c)?'pick':'noplay'):(this.playable(c)?'':'noplay'))})).join('');
    h.style.setProperty('gap','0'); $$('.card',h).forEach(k=>k.style.marginLeft=k.style.marginRight=`calc(var(--cw)*${-.09-ov*.035})`);
  }
}
function fight(encId){ C=new Combat(encId); C.start(); }
function floatAt(sel,text,color){ const t=$(sel); const root=$('.screen.on'); if(!t||!root) return; const r=t.getBoundingClientRect(), rr=root.getBoundingClientRect(); const f=document.createElement('div'); f.className='float'; f.textContent=text; f.style.color=color; f.style.left=(r.left-rr.left+r.width/2+(Math.random()-.5)*40)+'px'; f.style.top=(r.top-rr.top+r.height*.3)+'px'; root.appendChild(f); setTimeout(()=>f.remove(),1150); }
function vfxAt(sel,art,scale=1){ const t=$(sel); const root=$('.screen.on'); if(!t||!root) return; const r=t.getBoundingClientRect(), rr=root.getBoundingClientRect(); const v=document.createElement('img'); v.className='vfx'; v.src=A(art); v.style.width=(r.width*.7*scale)+'px'; v.style.left=(r.left-rr.left+r.width/2)+'px'; v.style.top=(r.top-rr.top+r.height/2)+'px'; root.appendChild(v); setTimeout(()=>v.remove(),650); }
function flashRed(){ const s=$('.screen.on'); if(!s) return; s.classList.remove('flashred'); void s.offsetWidth; s.classList.add('flashred'); setTimeout(()=>s.classList.remove('flashred'),420); }

/* ====================== REWARDS ====================== */
function rollRarity(kind){ const r=rf(); if(kind==='boss') return 'rare'; if(kind==='elite') return r<.12?'rare':r<.5?'uncommon':'common'; return r<.07?'rare':r<.38?'uncommon':'common'; }
function cardChoices(kind,n){
  const out=[]; let guard=0;
  while(out.length<n&&guard++<100){ const rar=rollRarity(kind); const arch=rf()<.45?G.W.arch:null; const id=G.randCard(rar,arch); if(!out.includes(id)) out.push(id); }
  return out;
}
function rewardScreen(kind){
  /* Rolled once, stored in the checkpoint, so a reload shows the same offer and never pays twice. */
  const pr=(G.pending&&G.pending.reward)||{kind};
  if(!pr.rolled){
    let gold=kind==='boss'?50:kind==='elite'?28+rnd(9):12+rnd(7); if(G.hasRelic('dollar')) gold=Math.round(gold*1.25);
    G.addGold(gold);
    const n=3+(G.hasRelic('journal')?1:0);
    Object.assign(pr,{rolled:true,gold,step:0,
      choices:cardChoices(kind,n).map(id=>({id,up:false,uid:'r'+UID++})),
      crewOpts: kind==='elite'&&G.crew.length<4 ? shuffle(Object.keys(CREW).filter(k=>!G.hasCrew(k))).slice(0,2).map(id=>({id,alt:rf()<.4})) : [],
      relicOpts: kind==='boss'||(kind==='elite'&&G.crew.length>=4) ? shuffle(Object.keys(RELICS).filter(k=>!G.hasRelic(k))).slice(0,kind==='boss'?2:1) : []});
    if(G.pending){ G.pending.reward=pr; save(); }
  }
  const {gold,choices,crewOpts,relicOpts}=pr;
  let step=pr.step||0;
  const setStep=v=>{ step=v; pr.step=v; save(); };
  if(!$('#combat').classList.contains('on')){ show('combat'); }
  const o=overlay('', $('#combat'));
  const renderR=()=>{
    /* Skip any stage with nothing to offer, so bosses reach their keepsakes and full-crew elites reach theirs. */
    if(step===1&&!crewOpts.length) setStep(2);
    if(step===2&&!relicOpts.length) setStep(3);
    if(step===0){
      o.innerHTML=`<h2>${kind==='boss'?ACTS[G.act].to+'!':kind==='elite'?'A Hard-Won Victory':'Obstacle Cleared'}</h2>
       <div class="row"><div class="rewardgold"><img src="${A('badge_gold')}">+${gold} Gold</div></div>
       <div class="sub">Load a new card onto the wagon? You carry <b>${G.deck.length}</b> of <b>${G.cap}</b>.${G.deck.length>=G.cap?' <b style="color:#ff8a6a">Another card means overloading.</b>':''}</div>
       <div class="cardgrid">${choices.map(c=>cardHTML(c)).join('')}</div>
       <div class="row"><button class="btn dark" data-skip>Leave Them Behind (+5 Gold)</button></div>`;
    } else if(step===1&&crewOpts.length){
      o.innerHTML=`<h2>A Traveler Asks to Join</h2><div class="sub">Choose one new companion.</div><div class="crewpick">${crewOpts.map((c,i)=>`<div class="crewopt paper" data-cr="${i}"><img src="${crewImg(c)}"><b>${CREW[c.id].name}</b><span>${CREW[c.id].desc}</span></div>`).join('')}</div><div class="row"><button class="btn dark" data-next>Travel Alone</button></div>`;
    } else if(step===2&&relicOpts.length){
      o.innerHTML=`<h2>Choose a Keepsake</h2><div class="row">${relicOpts.map(r=>`<div class="relicopt paper" data-rl="${r}"><img src="${A(RELICS[r].art)}"><b>${RELICS[r].name}</b><span>${RELICS[r].desc}</span></div>`).join('')}</div>`;
    } else { o.remove(); return finish(); }
  };
  const finish=()=>{
    if(G.hp<=0) return endScreen(false);
    if(G.flags.ambush){ G.flags.ambush=false; checkpoint({type:'ambush'}); return fight('bandit_ambush'); }
    if(kind==='boss'){ if(G.act===3) return endScreen(true); return startAct(G.act+1); }
    afterNode();
  };
  o.addEventListener('click',e=>{
    const k=e.target.closest('.card'); if(k&&step===0){ const c=choices.find(x=>x.uid===k.dataset.uid); G.addCard(c.id); SFX.click(); setStep(1); return renderR(); }
    if(e.target.closest('[data-skip]')&&step===0){ G.addGold(5); Narr.once('cardSkip',{top:true}); setStep(1); return renderR(); }
    const cr=e.target.closest('[data-cr]'); if(cr&&step===1){ G.crew.push(crewOpts[+cr.dataset.cr]); Narr.once('crew',{top:true}); hud(); setStep(2); return renderR(); }
    if(e.target.closest('[data-next]')&&step===1){ setStep(2); return renderR(); }
    const rl=e.target.closest('[data-rl]'); if(rl&&step===2){ G.addRelic(rl.dataset.rl); SFX.gold(); setStep(3); return renderR(); }
  });
  renderR();
}

/* ====================== FORT ====================== */
function fortScreen(name,hub=false){
  show('fort'); const s=$('#fort');
  const cone=G.wagon==='conestoga'; const disc=cone?.8:1;
  const P=G.pending||{}; let F=P.fort;
  if(!F){
    if(G.hasCrew('cartographer')) G.addGold(10);
    if(G.hasRelic('flask')) G.healHp(6);
    const price=id=>Math.round(({common:34,uncommon:55,rare:85}[CARDS[id].rarity]||40)*disc*(0.9+rf()*.2));
    const ids=[G.randCard('common',G.W.arch),G.randCard('common'),G.randCard('uncommon',G.W.arch),G.randCard('uncommon'),G.randCard('rare')]; if(cone) ids.push(G.randCard(pick(['common','uncommon'])));
    const relic=shuffle(Object.keys(RELICS).filter(k=>!G.hasRelic(k)))[0]||null;
    F={wares:ids.map(id=>({id,up:false,uid:'s'+UID++,price:price(id),sold:false})),relic,relicSold:!relic,provisions:false};
    if(G.pending){ P.fort=F; save(); }
  }
  const wares=F.wares, relic=F.relic, relicPrice=Math.round(95*disc);
  let relicSold=F.relicSold, provisions=F.provisions;
  const keep=()=>{ F.relicSold=relicSold; F.provisions=provisions; if(G.pending) save(); };
  const render=()=>{
    s.innerHTML=`<div class="hud"></div><div class="shop">
      <div class="trader paper"><img src="${A('npc_trader')}"><div class="h1">${name}</div><p>${hub?'"Welcome! Rest your stock. Prices are what they are out here."':name==='Fort Kearny'?'"The Army only broke ground here in June. It is sod walls and tents for now, but my wagon came up from Missouri loaded."':'"Trade goods, wagon parts, and the last flour for a long way west."'}</p><button class="btn" data-leave>Back to the Trail</button></div>
      <div class="shelf">
        <div class="cardgrid">${wares.map(w=>`<div class="ware ${w.sold?'sold':''}">${cardHTML(w,{cls:'small',attr:`data-buy="${w.uid}"`})}<div class="price ${G.gold<w.price?'no':''}"><img src="${A('badge_gold')}">${w.price}</div></div>`).join('')}</div>
        <div class="services">
          ${relic?`<div class="svc paper ${relicSold||G.gold<relicPrice?'off':''}" data-relic><img src="${A(RELICS[relic].art)}"><div><b>${RELICS[relic].name} · ${relicPrice} gold</b><span>${RELICS[relic].desc}</span></div></div>`:''}
          <div class="svc paper ${G.gold<G.removeCost?'off':''}" data-remove><img src="${A('ic_satchel')}"><div><b>Sell Off Cargo · ${G.removeCost} gold</b><span>Purge a card from your wagon. Lightens your load. (${G.deck.length}/${G.cap})</span></div></div>
          <div class="svc paper ${provisions||G.gold<20?'off':''}" data-prov><img src="${A('ic_kettle')}"><div><b>Hot Meal · 20 gold</b><span>Heal 12 HP. Once per visit.</span></div></div>
        </div></div></div>`;
    hud();
  };
  render(); Narr.say(hub?'act'+G.act:'fort',{pose:'tr_three'}).catch(()=>{});
  s.onclick=async e=>{
    const b=e.target.closest('[data-buy]'); if(b){ const w=wares.find(x=>x.uid===b.dataset.buy); if(w&&!w.sold&&G.gold>=w.price){ G.addGold(-w.price); G.addCard(w.id); w.sold=true; keep(); render(); } return; }
    if(e.target.closest('[data-relic]')&&!relicSold&&G.gold>=relicPrice){ G.addGold(-relicPrice); G.addRelic(relic); relicSold=true; keep(); Narr.once('relic'); render(); return; }
    if(e.target.closest('[data-remove]')&&G.gold>=G.removeCost){ const c=await G.pickPurge(()=>true,'Sell off which card?',true); if(c){ G.addGold(-G.removeCost); G.removeCost+=20; keep(); } render(); return; }
    if(e.target.closest('[data-prov]')&&!provisions&&G.gold>=20){ G.addGold(-20); G.healHp(12); provisions=true; keep(); SFX.heal(); render(); return; }
    if(e.target.closest('[data-leave]')){ SFX.click(); Narr.clear(); if(hub){ G.pending=null; mapScreen(); } else afterNode(); }
  };
}

/* ====================== CAMP ====================== */
function campScreen(){
  show('camp'); const s=$('#camp');
  if(G.hasRelic('flask')&&!(G.pending&&G.pending.campIn)){ G.healHp(6); if(G.pending){ G.pending.campIn=true; save(); } }
  const heal=Math.round(G.maxHp*.3);
  s.innerHTML=`<div class="hud"></div><div class="crewstrip"></div><div class="campbox">
    <div class="campopt paper" data-rest><img src="${A('node_camp')}"><b>Rest</b><span>Heal ${heal} HP</span></div>
    <div class="campopt paper ${G.deck.some(c=>!c.up&&CARDS[c.id].type!=='curse')?'':'svc off'}" data-mend><img src="${A('st_anvil')}"><b>Mend Gear</b><span>Upgrade a card</span></div></div>`;
  hud(); Narr.say('camp',{pose:'tr_three'});
  s.onclick=async e=>{
    if(e.target.closest('[data-rest]')){ G.healHp(heal); SFX.heal(); Narr.clear(); afterNode(); }
    if(e.target.closest('[data-mend]')){ const c=await G.pickUpgrade(); if(c){ SFX.gold(); Narr.clear(); afterNode(); } }
  };
}

/* ====================== EVENTS ====================== */
function eventScreen(evId){
  const pe=G.pending||{};
  let ev=pe.evId&&EVENTS.find(e=>e.id===pe.evId);
  if(!ev){
    ev=EVENTS.find(e=>e.id===evId);
    const okEv=e=>e.acts.includes(G.act)&&(!e.minDate||G.day>=e.minDate);
    if(!ev||!okEv(ev)||G.eventsSeen.includes(ev.id)){ const pool=EVENTS.filter(e=>okEv(e)&&!G.eventsSeen.includes(e.id)); ev=pool.length?pick(pool):pick(EVENTS.filter(okEv)); }
    G.eventsSeen.push(ev.id); pe.evId=ev.id;
  }
  const s=$('#event'); show('event'); s.style.backgroundImage=`url(${A(ACTS[G.act].bg)})`;
  const text = ev.id==='traders' ? (G.act===3?'A party of Shoshone traders has set up beside the Snake River with dried salmon, roots and horses. Emigrant diaries are full of these trades, and of Native guides who led wagons across the worst fords.':'Lakota families camped near the trail offer buffalo meat, moccasins and robes in trade for cloth, tools and sugar. Trading like this was an everyday part of the road near Fort Laramie.') : ev.text;
  const render=(result)=>{
    s.innerHTML=`<div class="hud"></div><div class="evbox paper"><div class="pic ${ev.contain?'contain':''}" style="background-image:url(${A(ev.img)})"></div><div>
      <h2>${ev.title}</h2><p>${text}</p>
      ${result!=null?`<div class="result">${result}</div><button class="btn" data-x>Continue</button>`:
      `<div class="choices">${ev.choices.map((c,i)=>`<button class="choice" data-c="${i}" ${c.ok&&!c.ok(G)?'disabled':''}><b>${c.t}</b><span>${c.d}</span></button>`).join('')}</div>`}
    </div></div>`; hud();
  };
  render(pe.evResult!=null?pe.evResult:null);
  if(pe.evResult!=null) {} else if(ev.id==='goldfever') Narr.say('goldNews',{pose:'tr_three'});
  else if(ev.id==='territory') Narr.say('territory',{pose:'tr_three'});
  s.onclick=async e=>{
    const b=e.target.closest('[data-c]'); if(b&&!s.dataset.busy){ s.dataset.busy=1; SFX.click(); const r=await ev.choices[+b.dataset.c].go(G); delete s.dataset.busy; pe.evResult=r||''; if(G.pending) save(); render(r||''); return; }
    if(e.target.closest('[data-x]')){ if(G.hp<=0) return endScreen(false); if(G.flags.ambush){ G.flags.ambush=false; checkpoint({type:'ambush'}); return fight('bandit_ambush'); } afterNode(); }
  };
}

/* ====================== END ====================== */
function endScreen(won){
  Narr.clear(); store.del(SAVE_KEY);
  const s=$('#end'); show('end'); s.style.backgroundImage=`url(${A(won?'bg_oregon_city':'bg_gameover')})`;
  const days=Math.round((G.day-START_DAY)/864e5);
  const act=ACTS[G.act];
  const meds=[
    {img:'med_wheel',n:'Trailblazer',ok:won&&G.day<=Date.UTC(1848,8,25),d:'Reach Oregon City by Sept 25'},
    {img:'med_star',n:'Independence Day',ok:!!G.flags.indep,d:'Reach Independence Rock by July 4'},
    {img:'med_heart',n:'Whole Company',ok:won&&G.hp>=G.maxHp*.6,d:'Finish with 60% HP'},
    {img:'med_chest',n:'Prosperous',ok:G.gold>=150,d:'Hold 150 Gold'},
    {img:'med_doctor',n:'Iron Constitution',ok:G.stats.cursesPurged>=3,d:'Purge 3 Curses'},
    {img:'med_rifle',n:'Traveling Light',ok:won&&G.deck.length<=G.cap,d:'Finish within your load limit'},
  ];
  const place = won?'Oregon City':(G.lastEnc?`at ${G.lastEnc.replace(/^The /,'the ')}`:`on the road to ${act.to}`);
  s.innerHTML=`<div class="news"><div class="mast"><div class="t">The Oregon Spectator</div><div class="d"><span>Oregon City, Oregon Territory</span><span>${fmtDateY(G.day)}</span><span>Price 12½ cents</span></div></div>
    <div class="head">${won?'Wagon Company Arrives Safe!':'Company Lost on the Trail'}</div>
    <div class="deck2">${won?`${G.W.name} rolls into Oregon City after ${days} days and 2,000 miles`:`${G.W.name} met its end ${place}, ${days} days out of Independence`}</div>
    <div class="cols"><div><img class="eng" src="${A(won?'eng_victory':'eng_gameover')}"></div><div>
      <div class="stats"><b>Days on the trail:</b> ${days}<br><b>Act reached:</b> ${G.act} of 3<br><b>Obstacles beaten:</b> ${G.stats.wins||0}<br><b>Elites beaten:</b> ${G.stats.elites}<br><b>Party HP:</b> ${G.hp} / ${G.maxHp}<br><b>Gold:</b> ${G.gold}<br><b>Wagon load:</b> ${G.deck.length} / ${G.cap}<br><b>Crew:</b> ${G.crew.length}<br><b>Cards purged:</b> ${G.stats.purged}<br><b>Keepsakes:</b> ${G.relics.length}</div>
      <div class="meds">${meds.map(m=>`<div class="med ${m.ok?'':'off'}" data-tip="<b>${m.n}</b><br>${m.d}"><img src="${A(m.img)}">${m.n}</div>`).join('')}</div>
      <div class="quote">${won?pick(TR.win):pick(TR.death)}<br>— Eli Haskins, trail pilot</div>
      <div style="margin-top:1.5vh;display:flex;gap:1vw"><button class="btn" data-again>Ride Again</button><button class="btn dark" data-title>Title</button></div>
    </div></div></div>`;
  s.onclick=e=>{ if(e.target.closest('[data-again]')){ Narr.clear(); selectScreen(); } if(e.target.closest('[data-title]')){ Narr.clear(); titleScreen(); } };
}

/* keyboard: E ends turn, 1-9 play cards */
document.addEventListener('keydown',e=>{
  if(!C||C.phase!=='player') return;
  /* Shortcuts only reach the fight when nothing sits on top of it. */
  if(!$('#combat').classList.contains('on')||$('.overlay')||zoomEl.classList.contains('on')) return;
  if(e.target.closest&&e.target.closest('input,textarea,select')) return;
  if(e.key==='e'||e.key==='E') C.endTurn();
  const n=parseInt(e.key); if(n>=1&&n<=9&&C.hand[n-1]) C.play(C.hand[n-1]);
});

titleScreen();
