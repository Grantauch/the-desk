const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM,VirtualConsole}=require('jsdom');
const ROOT=process.env.FOUNDER_TEST_ROOT||__dirname,KEY='checklings.first-trail.v1';
function camp(t,{bundle=false,reduced=false,hashed=false}={}){
 const vc=new VirtualConsole(),errors=[];vc.on('jsdomError',e=>errors.push(e.message));
 const d=new JSDOM(fs.readFileSync(bundle?process.env.PIXEL_STANDALONE:path.join(ROOT,'index.html'),'utf8'),{url:'https://sample.invalid/',runScripts:'outside-only',virtualConsole:vc}),w=d.window;
 let preference=reduced,change;w.structuredClone=structuredClone;w.matchMedia=()=>({get matches(){return preference;},addEventListener(n,f){change=f;}});w.Blob=Blob;w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 if(hashed){w.PIXEL_CAMP_ART={};for(const id of ['mochi','bolt','zee','ember'])for(const ext of ['png','gif'])w.PIXEL_CAMP_ART[id+'.'+ext]='/assets/'+id+'.abcdef123456.'+ext;}
 if(bundle){for(const s of w.document.querySelectorAll('script'))w.eval(s.textContent);}else for(const f of ['engine.js','camp-goals.js','game.js'])w.eval(fs.readFileSync(path.join(ROOT,f),'utf8'));
 const $=id=>w.document.getElementById(id),click=sel=>{const e=w.document.querySelector(sel);assert.ok(e,sel);assert.equal(e.disabled,false);e.click();},actor=id=>w.document.querySelector('.actor[data-pet="'+id+'"] img');
 function event(image,type,{complete=true,width=0}={}){Object.defineProperty(image,'complete',{configurable:true,get:()=>complete});Object.defineProperty(image,'naturalWidth',{configurable:true,get:()=>width});image.dispatchEvent(new w.Event(type));}
 t.after(()=>{assert.deepEqual(errors,[]);w.close();});return{w,$,click,actor,event,save:()=>JSON.parse(w.localStorage.getItem(KEY)),reduce(value){preference=value;change();}};
}
test('Failed founder animation falls back to its original still without changing focus, save or other founders',t=>{
 const c=camp(t),before=c.save(),image=c.actor('mochi');c.$('open-menu').focus();c.event(image,'error');assert.match(image.src,/mochi\.png$/);assert.match(c.actor('bolt').src,/bolt\.gif$/);assert.equal(c.w.document.activeElement.id,'open-menu');assert.deepEqual(c.save(),before);assert.equal(c.$('founder-picture-help').hidden,false);
});
test('Recovery persists across care and trail rendering without repeatedly requesting broken animations',t=>{
 const c=camp(t);c.event(c.actor('mochi'),'error');c.click('[data-care=feed]');assert.match(c.actor('mochi').src,/mochi\.png$/);c.click('[data-view=trail]');assert.match(c.actor('mochi').src,/mochi\.png$/);c.click('[data-view=home]');assert.match(c.actor('mochi').src,/mochi\.png$/);assert.match(c.actor('zee').src,/zee\.gif$/);
});
test('Still-picture errors, other images, unfinished requests and stale events cannot start fallback loops',t=>{
 const c=camp(t),image=c.actor('mochi');c.event(image,'error',{complete:false});assert.match(image.src,/\.gif$/);c.event(image,'error',{width:320});assert.match(image.src,/\.gif$/);c.event(c.$('speaker-art'),'error');assert.equal(c.$('founder-picture-help').hidden,true);c.event(image,'error');const png=image.src;c.event(image,'error');assert.equal(image.src,png);image.src='/assets/unrelated.gif';c.event(image,'error');assert.match(image.src,/unrelated\.gif$/);
});
test('Manual moving-picture retry uses the same hashed animation and preserves a live match and saved camp',t=>{
 const c=camp(t,{hashed:true});c.click('[data-view=practice]');c.click('#start-practice');c.click('[data-move=strike]');const image=c.$('battle-friend-art'),before=c.save(),hp=c.$('enemy-hp-text').textContent,friend=c.$('friend-hp-text').textContent;c.event(image,'error');assert.match(image.src,/mochi\.abcdef123456\.png$/);c.click('#open-menu');c.$('retry-founder-art').focus();c.click('#retry-founder-art');assert.equal(image.src,'https://sample.invalid/assets/mochi.abcdef123456.gif?art-retry=1');assert.equal(c.$('enemy-hp-text').textContent,hp);assert.equal(c.$('friend-hp-text').textContent,friend);assert.deepEqual(c.save(),before);assert.equal(c.w.document.activeElement.getAttribute('aria-label'),'Close menu');assert.match(c.w.document.querySelector('.party-button img').src,/\.png$/);assert.match(c.$('speaker-art').src,/\.png$/);
 c.event(image,'error');assert.equal(c.$('founder-picture-help').hidden,false);c.click('#retry-founder-art');assert.match(image.src,/art-retry=2$/);
});
test('Practice fallback follows the current fighter, including a switch after another founder failed',t=>{
 const c=camp(t);c.click('[data-view=practice]');c.click('#start-practice');let image=c.$('battle-friend-art');c.event(image,'error');c.click('.party-button[data-pet=bolt]');assert.equal(image.dataset.pet,'bolt');assert.match(image.src,/bolt\.gif$/);c.event(image,'error');assert.match(image.src,/bolt\.png$/);c.click('.party-button[data-pet=mochi]');assert.match(image.src,/mochi\.png$/);
});
test('Quiet and system reduced-motion keep approved stills and hide moving-picture retries',t=>{
 const c=camp(t);c.event(c.actor('mochi'),'error');c.click('#quiet-toggle');assert.equal(c.$('founder-picture-help').hidden,true);for(const id of ['mochi','bolt','zee','ember'])assert.match(c.actor(id).src,/\.png$/);const save=c.save();c.click('#retry-founder-art');assert.deepEqual(c.save(),save);c.click('#quiet-toggle');assert.equal(c.$('founder-picture-help').hidden,false);c.reduce(true);assert.equal(c.$('founder-picture-help').hidden,true);c.click('#retry-founder-art');assert.match(c.actor('mochi').src,/\.png$/);assert.equal(c.save().quiet,false);c.reduce(false);assert.match(c.actor('mochi').src,/\.png$/);assert.match(c.actor('bolt').src,/\.gif$/);
});
test('The complete offline file falls back and retries original embedded bytes without corrupting data URLs',t=>{
 assert.ok(process.env.PIXEL_STANDALONE);const c=camp(t,{bundle:true}),image=c.actor('mochi'),gif=image.src;assert.ok(gif.startsWith('data:image/gif;base64,'));c.event(image,'error');assert.ok(image.src.startsWith('data:image/png;base64,'));assert.equal(image.src,c.w.PIXEL_CAMP_ART['mochi.png']);c.click('#retry-founder-art');assert.equal(image.src,gif);assert.equal(c.$('speaker-art').src,c.w.PIXEL_CAMP_ART['mochi.png']);
});
