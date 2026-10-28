const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom'),E=require('./engine.js');
function camp(t,denied=false){
 const errors=[],blobs=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),{url:'https://sample.invalid/',runScripts:'outside-only',virtualConsole:vc}),w=dom.window;
 w.structuredClone=structuredClone;w.matchMedia=()=>({matches:true,addEventListener(){}});w.Blob=Blob;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.URL.createObjectURL=b=>{blobs.push(b);return 'blob:test/'+blobs.length;};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
 if(denied)Object.defineProperty(w,'localStorage',{get(){throw Error('storage denied');}});
 w.eval(fs.readFileSync(path.join(__dirname,'engine.js'),'utf8'));w.eval(fs.readFileSync(path.join(__dirname,'game.js'),'utf8'));
 t.after(()=>{assert.deepEqual(errors,[]);w.close();});
 const $=id=>w.document.getElementById(id),click=sel=>{const el=w.document.querySelector(sel);assert.ok(el);assert.equal(el.disabled,false);el.click();};
 function choose(textOrPromise){const file={size:2000,text:()=>Promise.resolve(textOrPromise)};Object.defineProperty($('import-file'),'files',{value:[file],configurable:true});$('import-file').dispatchEvent(new w.Event('change'));}
 return{w,$,click,choose,blobs};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('Journal skip destination is visible and keyboard focusable; camp restores action destination',t=>{
 const c=camp(t);c.click('[data-view=journal]');assert.equal(c.w.document.querySelector('.skip').getAttribute('href'),'#journal-view');assert.equal(c.$('journal-view').hidden,false);assert.equal(c.$('journal-view').getAttribute('tabindex'),'-1');c.click('[data-view=home]');assert.equal(c.w.document.querySelector('.skip').getAttribute('href'),'#actions');
});
test('Keyboard focus follows practice start, result and retry controls',t=>{
 const c=camp(t);c.click('[data-view=practice]');c.click('#start-practice');assert.equal(c.w.document.activeElement.dataset.move,'strike');
 for(let n=0;n<120&&c.$('practice-result').hidden;n++){
  if(c.w.document.querySelector('[data-move=guard]').disabled){c.click('.party-button:not(:disabled)[aria-pressed=false]');continue;}
  const intent=c.$('enemy-intent').textContent,move=/^(STRIKE|BIG HIT)/.test(intent)?'guard':c.w.document.querySelector('[data-move=signature]').disabled?'recover':'signature';c.click('[data-move='+move+']');
 }
 assert.equal(c.$('result-title').textContent,'PRACTICE CLEAR!');assert.equal(c.w.document.activeElement.id,'retry-practice');c.click('#retry-practice');assert.equal(c.w.document.activeElement.dataset.move,'strike');
});
test('Blocked browser storage still supports reversible file import and export of restored progress',async t=>{
 const c=camp(t,true);c.click('[data-care=play]');c.click('#open-menu');c.click('#export-save');const before=JSON.parse(await c.blobs.at(-1).text());
 const incoming=E.initial();incoming.selected='bolt';incoming.pets.bolt.nickname='Portable Bolt';c.choose(JSON.stringify(incoming));await flush();c.click('#confirm-import');
 assert.equal(c.$('pet-name').textContent,'Portable Bolt');assert.equal(c.$('save-status').textContent,'Save to file');assert.match(c.$('import-message').textContent,/this tab/);
 c.$('menu-dialog').close();c.click('#open-menu');assert.equal(c.$('undo-import').hidden,false);c.click('#undo-import');assert.equal(c.$('pet-name').textContent,'Mochi');
 c.click('#export-save');const restored=JSON.parse(await c.blobs.at(-1).text());assert.deepEqual(restored,before);c.click('#undo-import');assert.equal(c.$('pet-name').textContent,'Portable Bolt');
});
test('Undo cancels an in-flight file preview and cannot resurrect its stale result',async t=>{
 const c=camp(t);const first=E.initial();first.selected='bolt';c.choose(JSON.stringify(first));await flush();c.click('#confirm-import');let finish;const delayed=new Promise(r=>finish=r);c.choose(delayed);c.click('#undo-import');const second=E.initial();second.selected='zee';finish(JSON.stringify(second));await flush();assert.equal(c.$('pet-name').textContent,'Mochi');assert.equal(c.$('import-preview').hidden,true);c.click('#confirm-import');assert.equal(c.$('pet-name').textContent,'Mochi');
});

test('Legacy practice journal uses the stump label without rewriting saved memories',async t=>{
 const c=camp(t),incoming=E.initial();incoming.pets.mochi.memories=[{id:'practice',text:'Completed a friendly practice against the training dummy. No injuries.'}];c.choose(JSON.stringify(incoming));await flush();c.click('#confirm-import');c.click('[data-view=journal]');assert.match(c.$('journal-entries').textContent,/Practice with the stump/);assert.doesNotMatch(c.$('journal-entries').textContent,/dummy/);c.click('#export-save');const saved=JSON.parse(await c.blobs.at(-1).text());assert.deepEqual(saved.pets.mochi.memories,incoming.pets.mochi.memories);
});
