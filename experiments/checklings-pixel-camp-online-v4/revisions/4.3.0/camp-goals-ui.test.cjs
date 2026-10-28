const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM,VirtualConsole}=require('jsdom'),E=require('./engine.js'),fixture=require('./camp-goals-fixture.json');
const KEY='checklings.first-trail.v1';
function camp(t,seed=E.initial(),bundle=false){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const html=fs.readFileSync(bundle?process.env.PIXEL_STANDALONE:path.join(__dirname,'index.html'),'utf8'),dom=new JSDOM(html,{url:'https://sample.invalid/',runScripts:'outside-only',virtualConsole:vc}),w=dom.window;
 w.structuredClone=structuredClone;w.matchMedia=()=>({matches:true,addEventListener(){}});w.Blob=Blob;w.URL.createObjectURL=()=> 'blob:sample';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.localStorage.setItem(KEY,JSON.stringify(seed));
 if(bundle){for(const s of w.document.querySelectorAll('script'))w.eval(s.textContent);}else for(const f of ['engine.js','camp-goals.js','game.js'])w.eval(fs.readFileSync(path.join(__dirname,f),'utf8'));
 t.after(()=>{assert.deepEqual(errors,[]);w.close();});
 const $=id=>w.document.getElementById(id),click=sel=>{const e=w.document.querySelector(sel);assert.ok(e,'Missing '+sel);assert.equal(e.disabled,false,'Disabled '+sel);e.click();};
 return{w,$,click,saved:()=>JSON.parse(w.localStorage.getItem(KEY)),goals:()=>{click('[data-view=journal]');click('[data-journal-page=goals]');}};
}
test('Camp goals render real legacy milestones without changing saved progress',t=>{
 const c=camp(t,fixture),before=c.saved();c.goals();assert.match(c.$('camp-goals-summary').textContent,/3 \/ 4/);assert.equal(c.$('journal-notes').hidden,true);assert.equal(c.$('camp-goals').hidden,false);assert.equal(c.w.document.querySelectorAll('.camp-goal-row').length,4);assert.equal(c.w.document.querySelector('[data-camp-goal=keeper]').disabled,true);assert.equal(c.w.document.querySelector('[data-camp-goal=practice]').disabled,false);assert.deepEqual(c.saved(),before);c.click('[data-journal-page=notes]');assert.equal(c.$('journal-notes').hidden,false);assert.equal(c.$('camp-goals').hidden,true);
});
test('Next keeper task focuses the missing action but does not perform care for the player',t=>{
 const seed=E.initial();seed.selected='zee';seed.pets.zee.care=['feed','play'];const c=camp(t,seed);c.goals();c.click('[data-camp-goal=keeper]');assert.equal(c.$('pet-name').textContent,'Zee');assert.equal(c.$('care-actions').hidden,false);assert.equal(c.w.document.activeElement.dataset.care,'clean');assert.deepEqual(c.saved().pets.zee.care,['feed','play']);c.click('#care-actions [data-care=clean]');assert.ok(c.saved().pets.zee.care.includes('clean'));c.goals();assert.match(c.w.document.querySelector('[data-goal-row=keeper]').textContent,/3 \/ 20/);
});
test('Practice shortcut preserves an unfinished match instead of silently restarting it',t=>{
 const c=camp(t);c.click('[data-view=practice]');c.click('#start-practice');c.click('[data-move=guard]');const hp=c.$('friend-hp-text').textContent,intent=c.$('enemy-intent').textContent;c.goals();c.click('[data-camp-goal=practice]');assert.equal(c.$('practice-welcome').hidden,true);assert.equal(c.$('friend-hp-text').textContent,hp);assert.equal(c.$('enemy-intent').textContent,intent);assert.match(c.$('message').textContent,/Finish this spar/);assert.equal(c.w.document.activeElement.dataset.move,'guard');
});
test('Completed camp goals show four finished tracks without minting or rewriting anything',t=>{
 const seed=structuredClone(fixture);for(const id of E.IDS)seed.pets[id].battles=1;const c=camp(t,seed),before=c.saved();c.goals();assert.match(c.$('camp-goals-summary').textContent,/Camp goals complete/);assert.ok([...c.w.document.querySelectorAll('[data-camp-goal]')].every(b=>b.disabled));assert.deepEqual(c.saved(),before);
});
test('Complete offline artifact includes the working goal module and journal page',t=>{
 assert.ok(process.env.PIXEL_STANDALONE,'Build an offline artifact first.');const c=camp(t,E.initial(),true);c.goals();assert.equal(c.w.document.querySelectorAll('.camp-goal-row').length,4);assert.match(c.$('camp-goals-summary').textContent,/0 \/ 4/);assert.ok(c.w.document.querySelector('.actor img').src.startsWith('data:image/png;base64,'));
});

test('A tired friend goal points to free Rest without performing it automatically',t=>{
 const seed=E.initial();seed.pets.mochi.energy=0;seed.pets.mochi.care=['feed'];const c=camp(t,seed);c.goals();assert.match(c.w.document.querySelector('[data-goal-row=keeper]').textContent,/Rest with Mochi before playing/);c.click('[data-camp-goal=keeper]');assert.equal(c.w.document.activeElement.dataset.care,'rest');assert.equal(c.saved().pets.mochi.energy,0);c.click('#care-actions [data-care=rest]');c.goals();assert.match(c.w.document.querySelector('[data-goal-row=keeper]').textContent,/Play with Mochi/);c.click('[data-camp-goal=keeper]');assert.equal(c.w.document.activeElement.dataset.care,'play');c.click('#care-actions [data-care=play]');assert.ok(c.saved().pets.mochi.care.includes('play'));
});
test('A tired explorer goal focuses trail Rest, then offers the real discovery',t=>{
 const seed=E.initial();seed.pets.mochi.energy=17;const c=camp(t,seed);c.goals();assert.match(c.w.document.querySelector('[data-goal-row=explorer]').textContent,/Rest with Mochi before exploring/);c.click('[data-camp-goal=explorer]');assert.equal(c.w.document.activeElement.closest('#trail-actions')?.id,'trail-actions');assert.equal(c.w.document.activeElement.dataset.care,'rest');assert.equal(c.saved().pets.mochi.energy,17);assert.deepEqual(c.saved().pets.mochi.discoveries,[]);c.click('#trail-actions [data-care=rest]');c.goals();c.click('[data-camp-goal=explorer]');assert.equal(c.w.document.activeElement.id,'discover');c.click('#discover');assert.deepEqual(c.saved().pets.mochi.discoveries,[0]);
});
test('The displayed18energy exploration cost is sufficient, while17 is refused without changes',t=>{
 const seed=E.initial();seed.pets.mochi.energy=18;const c=camp(t,seed);c.click('[data-view=trail]');assert.match(c.$('discover').textContent,/18 energy/);c.click('#discover');assert.equal(c.saved().pets.mochi.energy,0);assert.deepEqual(c.saved().pets.mochi.discoveries,[0]);const low=E.initial();low.pets.mochi.energy=17;const r=E.dispatch(low,{type:'discover'});assert.equal(r.changed,false);assert.deepEqual(r.state,low);
});
