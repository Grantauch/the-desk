(function(){
 'use strict';
 const E=globalThis.FirstTrail,$=id=>document.getElementById(id),KEY='checklings.first-trail.v1',BACKUP=KEY+'.before-import';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let state=E.initial(),view='home',battle=null,pending=null,storageOK=true,loadIssue='',quietSystem=matchMedia('(prefers-reduced-motion: reduce)');
 try{const raw=localStorage.getItem(KEY);if(raw)state=E.hydrate(JSON.parse(raw));}catch(err){loadIssue='The saved journey could not be opened. It has been left untouched. You can still try this sample and download a save.';storageOK=false;}
 function save(){if(!storageOK){$('save-status').textContent='Session only · download a save to keep your progress';return;}try{localStorage.setItem(KEY,JSON.stringify(state));$('save-status').textContent='Local sample playtest · saved on this browser';}catch{storageOK=false;$('save-status').textContent='Session only · download a save to keep your progress';announce('Browser saving is unavailable. Download your save from settings to keep this journey.');}}
 function announce(msg){if(msg)$('notice').textContent=msg;}
 function act(action){const r=E.dispatch(state,action);state=r.state;if(r.changed)save();render();announce(r.message);}
 function art(id,still=false){const key=id+(still||state.quiet||quietSystem.matches?'.png':'.gif');return globalThis.FIRST_TRAIL_ART?.[key]||'assets/'+key;}
 function setView(next){if(!['home','trail','practice','journal'].includes(next))return;view=next;render();}
 function render(){
  document.body.classList.toggle('quiet',state.quiet||quietSystem.matches);
  for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));
  $('habitat-view').hidden=!['home','trail'].includes(view);$('practice-view').hidden=view!=='practice';$('journal-view').hidden=view!=='journal';$('home-tools').hidden=view==='trail';$('trail-tools').hidden=view!=='trail';
  $('stamp-count').textContent=E.stamps(state)+' trail stamp'+(E.stamps(state)===1?'':'s');
  const memories=E.IDS.reduce((n,id)=>n+state.pets[id].memories.length,0);$('journal-count').textContent=memories;
  $('weather').value=state.weather;$('scene').dataset.weather=state.weather;$('scene').dataset.trailStop=view==='trail'?state.stop:'home';
  $('trail-landmark').innerHTML=view!=='trail'?'':state.stop===0?'<span class=seed-bed>🌱</span><span class=seed-note>A LITTLE PATIENCE GROWS THINGS</span>':state.stop===1?'<span class=waterwheel>✳</span><span class=wheel-post></span><span class=seed-note>THE OLD WATERWHEEL</span>':'<span class=pond-stars>✧　✦<br>　✧　✧</span><span class=seed-note>THE SKY HAS A SECOND HOME</span>';
  $('scene-title').textContent=view==='trail'?E.STOPS[state.stop].name:'Willowbank clearing';$('scene-subtitle').textContent={sun:'A little sunlight through the leaves.',rain:'Shelter is always close by.',dusk:'Small lights. Long shadows.'}[state.weather];
  const p=state.pets[state.selected],spec=E.SPECIES[state.selected];
  // All dynamic strings, including imported nicknames and memories, stay plain text.
  $('scene-actors').innerHTML=E.IDS.map(id=>'<button type="button" class="actor" data-pet="'+id+'" aria-pressed="'+(id===state.selected)+'" aria-label="Spend time with '+esc(E.name(state,id))+'"><img src="'+art(id)+'" alt="" width="160" height="160"><span class="actor-name">'+esc(E.name(state,id))+'</span></button>').join('');
  $('founder-tabs').innerHTML=E.IDS.map(id=>'<button type="button" data-pet="'+id+'" aria-pressed="'+(id===state.selected)+'">'+E.SPECIES[id].name+'</button>').join('');
  $('pet-region').textContent=spec.region.toUpperCase()+' / ORIGINAL FOUNDER';$('pet-name').textContent=E.name(state);$('pet-title').textContent=spec.title;$('pet-personality').textContent=spec.personality;$('pet-preference').textContent=spec.preference;
  $('vitals').innerHTML=[['food','Appetite','Comfortably fed','Ready for a meal'],['energy','Energy','Ready to explore','A little rest would help'],['clean','Comfort','Clean and settled','Could use a tidy'],['joy','Spirits','In good company','Time together would help'],['bond','Familiarity','A familiar friend','Getting acquainted']].map(([key,label,high,low])=>'<div class="vital-row"><dt>'+label+'</dt><dd><span>'+esc(key==='bond'?(p[key]>=30?'A familiar friend':p[key]>0?'Getting to know you':'A new beginning'):p[key]>=60?high:low)+'</span><meter min="0" max="100" value="'+p[key]+'" aria-label="'+label+' '+p[key]+' out of 100">'+p[key]+' / 100</meter></dd></div>').join('');
  $('latest-memory').textContent=p.memories.at(-1)?.text||'A new beginning. The things you do together will appear here.';
  $('route-stops').innerHTML=E.STOPS.map((s,i)=>'<button type="button" data-stop="'+i+'" aria-pressed="'+(state.stop===i)+'">'+(i+1)+'. '+s.name.replace('The ','')+(p.discoveries.includes(i)?' ✓':'')+'</button>').join('');
  const stop=E.STOPS[state.stop];$('stop-eyebrow').textContent=stop.eyebrow;$('stop-title').textContent=stop.name;$('stop-copy').textContent=stop.text;$('discover').textContent=spec.verb+' ↗';$('stop-hint').textContent=p.discoveries.includes(state.stop)?'Recorded in your journal. Another founder will notice something different.':'A discovery uses 18 energy. Rest at any time; all essential care is free.';
  const cares=E.IDS.some(id=>state.pets[id].care.length>0),finds=E.IDS.reduce((n,id)=>n+state.pets[id].discoveries.length,0);
  $('goals').innerHTML=[[cares,'Make time for a founder'],[finds>0,'Bring home a discovery'],[state.decor.length>0,'Make the clearing yours']].map(([yes,label],i)=>'<li class="'+(yes?'done':'')+'"><span aria-hidden="true">'+(yes?'✓':i+1)+'</span>'+label+(yes?' · done':'')+'</li>').join('');
  $('decor-options').innerHTML=E.DECOR.map((d,i)=>{const can=E.stamps(state)>=d.cost,owned=state.decor.includes(d.id),equipped=state.equipped===d.id;return '<article class="decor-card"><span class="deco-icon" aria-hidden="true">'+['♧','◈','⚑'][i]+'</span><h3>'+d.name+'</h3><p>'+d.description+'</p><button type="button" data-decor="'+d.id+'" '+(can?'':'disabled')+' aria-pressed="'+equipped+'">'+(equipped?'In your clearing':owned?'Place in clearing':can?'Make it yours':d.cost+' stamps to unlock')+'</button></article>';}).join('');
  $('decor-art').textContent={planter:'🪴',lantern:'🏮',pennants:'⚑ ⚑'}[state.equipped]||'';
  $('quiet-toggle').setAttribute('aria-pressed',String(state.quiet));$('quiet-toggle').textContent='Quiet mode '+(state.quiet?'on':'off')+(quietSystem.matches&&!state.quiet?' · system motion reduction active':'');
  if(view==='journal')renderJournal();if(view==='practice')renderBattle();
 }
 function renderJournal(){
  $('journal-pets').innerHTML=E.IDS.map(id=>{const p=state.pets[id];return '<article class="journal-card"><header><img src="'+art(id,true)+'" alt="" width="85" height="85"><div><p class="eyebrow">'+E.SPECIES[id].region.toUpperCase()+'</p><h3>'+esc(E.name(state,id))+'</h3><p>'+p.discoveries.length+' / 3 discoveries · '+(p.battles?'Practice badge earned':'A keeper’s pace is welcome')+'</p></div></header>'+(p.memories.length?'<ol>'+p.memories.slice().reverse().map(m=>'<li class="'+(m.id.startsWith('find')?'discovery':'')+'">'+esc(m.text)+'</li>').join('')+'</ol>':'<p>No shared history yet. A quiet moment, a discovery, or a friendly practice will leave something to remember.</p>')+'</article>';}).join('');
 }
 function renderBattle(){
  $('battle-welcome').hidden=!!battle;$('battle-area').hidden=!battle;$('start-practice').textContent=battle?'Begin a new practice':'Start friendly practice';if(!battle)return;
  const p=battle.fighters[battle.active];$('battle-pet-art').src=art(battle.active);$('battle-pet-name').textContent=E.name(state,battle.active);$('battle-stats').textContent=p.hp+' / 65 practice health · '+p.stamina+' / 10 stamina';$('battle-hp').value=p.hp;$('dummy-hp').value=battle.enemy;$('dummy-hp-label').textContent=battle.enemy+' / 125 practice health';$('battle-round').textContent='ROUND '+battle.round;
  $('signature-note').textContent=E.SPECIES[battle.active].signature+': '+E.SPECIES[battle.active].signatureHint+(battle.active==='bolt'?' Stored charges: '+p.charge+'.':battle.active==='ember'?' Heat '+(p.heat?'stored.':'not yet stored.'):'');
  const intent=E.intents[battle.turn%4];$('enemy-intent').textContent=battle.result?'Practice finished':intent.name;$('enemy-hint').textContent=battle.result?'Everyone can return home safely.':intent.detail;
  for(const b of document.querySelectorAll('[data-move]'))b.disabled=!!battle.result||p.hp===0||(b.dataset.move==='strike'&&p.stamina<3)||(b.dataset.move==='signature'&&p.stamina<5);
  $('battle-result').hidden=!battle.result;$('battle-result').textContent=battle.result==='win'?'A good practice. Your starting founder keeps the badge, and everyone returns home healthy. Try another founder’s signature next time.':'Everyone returns safely. Watch for the heavy swing, and try guarding it. Rest, practice, and another attempt are always free.';
  $('battle-switches').innerHTML=E.IDS.map(id=>'<button type="button" data-switch="'+id+'" aria-pressed="'+(battle.active===id)+'" '+(battle.result||battle.fighters[id].hp===0?'disabled':'')+'>'+E.SPECIES[id].name+' · '+battle.fighters[id].hp+' HP</button>').join('');
  $('battle-log').innerHTML=battle.log.map(text=>'<li>'+esc(text)+'</li>').join('');
 }
 let practiceFounder=state.selected;
 function practice(move,swap){if(!battle)return;const r=E.battleMove(battle,move,swap);battle=r.battle;if(r.changed&&battle.result==='win'){const original=state.selected;state.selected=practiceFounder;act({type:'battle-win'});state.selected=original;save();}renderBattle();announce(r.message);}
 function openSettings(){$('settings-dialog').showModal();try{$('undo-import').hidden=!localStorage.getItem(BACKUP);}catch{$('undo-import').hidden=true;}}
 function exportSave(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Checklings-First-Trail-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('import-message').textContent='Your browser was asked to download a save. Keep the JSON file somewhere you can find it.';}
 document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  const focused=b===document.activeElement;
  if(b.dataset.view){setView(b.dataset.view);return;}
  if(b.dataset.pet){act({type:'select',id:b.dataset.pet});if(focused)document.querySelector('#founder-tabs [data-pet="'+b.dataset.pet+'"]').focus();return;}
  if(b.dataset.care){act({type:b.dataset.care});return;}
  if(b.dataset.stop!==undefined){const n=+b.dataset.stop;act({type:'stop',value:n});if(focused)document.querySelector('[data-stop="'+n+'"]').focus();return;}
  if(b.dataset.decor){const id=b.dataset.decor;act({type:'unlock',id});if(focused)document.querySelector('[data-decor="'+id+'"]').focus();return;}
  if(b.dataset.move){practice(b.dataset.move);return;}
  if(b.dataset.switch){const id=b.dataset.switch;practice('switch',id);if(focused)document.querySelector('[data-switch="'+id+'"]').focus();return;}
 });
 $('weather').addEventListener('change',e=>act({type:'weather',value:e.target.value}));$('go-trail').onclick=()=>{setView('trail');$('discover').focus();};$('discover').onclick=()=>act({type:'discover'});
 $('open-settings').onclick=openSettings;$('about-footer').onclick=openSettings;$('quiet-toggle').onclick=()=>act({type:'quiet'});$('export-save').onclick=exportSave;$('journal-export').onclick=exportSave;
 $('rename').onclick=()=>{$('nickname').value=state.pets[state.selected].nickname;$('rename-dialog').showModal();$('nickname').focus();};$('cancel-rename').onclick=()=>$('rename-dialog').close();$('rename-form').onsubmit=e=>{e.preventDefault();act({type:'rename',value:$('nickname').value});$('rename-dialog').close();};
 $('start-practice').onclick=()=>{practiceFounder=state.selected;battle=E.startBattle(practiceFounder);renderBattle();announce('Practice begins. The dummy will use a measured strike. Try a move.');};$('leave-practice').onclick=()=>{battle=null;setView('home');announce('Back in the clearing. Everyone is healthy.');document.querySelector('[data-view="home"]').focus();};
 $('import-file').addEventListener('change',async event=>{
  pending=null;$('import-preview').hidden=true;const file=event.target.files[0];if(!file)return;
  if(file.size>100000){$('import-message').textContent='That file is too large for a First Trail save (100 KB maximum). Your current journey is unchanged.';return;}
  try{pending=E.hydrate(JSON.parse(await file.text()));$('import-description').textContent='This journey has '+E.stamps(pending)+' trail stamps and '+E.IDS.reduce((n,id)=>n+pending.pets[id].memories.length,0)+' memories. Load it into this browser?';$('import-preview').hidden=false;$('import-message').textContent='Save checked. Your current journey has not changed.';}catch(err){$('import-message').textContent='This save could not be read. '+err.message;}
 });
 $('confirm-import').onclick=()=>{if(!pending)return;try{if(!storageOK)throw Error('Browser saving is unavailable; a safety copy cannot be kept.');localStorage.setItem(BACKUP,JSON.stringify(state));}catch(err){$('import-message').textContent=err.message+' Download your current save first and use another browser to load a journey.';return;}state=pending;pending=null;battle=null;$('import-preview').hidden=true;$('undo-import').hidden=false;save();render();$('import-message').textContent='Saved journey loaded. Your previous journey is kept as a safety copy.';announce('Your saved journey is here. Welcome back.');};
 $('undo-import').onclick=()=>{try{const restored=E.hydrate(JSON.parse(localStorage.getItem(BACKUP)));localStorage.setItem(BACKUP,JSON.stringify(state));state=restored;battle=null;save();render();$('import-message').textContent='Previous journey restored. The other journey is now the safety copy.';}catch{ $('import-message').textContent='The safety copy could not be read. Your current journey is unchanged.';}};
 quietSystem.addEventListener('change',render);
 window.addEventListener('storage',event=>{if(event.key!==KEY||!event.newValue)return;try{state=E.hydrate(JSON.parse(event.newValue));battle=null;render();announce('This local journey was updated in another tab. The latest saved progress is now shown here.');}catch{announce('Another tab supplied an unreadable save. This journey is unchanged.');}});
 render();if(storageOK)save();else $('save-status').textContent='Session only · download a save to keep your progress';if(loadIssue)announce(loadIssue);
})();
