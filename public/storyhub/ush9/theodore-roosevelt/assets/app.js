(() => {
 'use strict';
 const $ = s => document.querySelector(s);
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 const sections = [...document.querySelectorAll('main > section')];
 const videos = [...document.querySelectorAll('video')];
 const opening = $('#opening'), openingFilm = $('#opening-film');
 const openingControl=$('#play-opening');
 let openingRequested=false,openingEnded=false,openingExplicitPlay=false;
 openingFilm.controls=false;
 let active = opening, paused = reduced.matches, effects = !reduced.matches, ticking = false;
 const sourceData = JSON.parse($('#source-data').textContent);
 const dialog = $('#source-dialog'), sourceContent = $('#source-content');
 const textNode = (tag, text, cls) => { const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n; };
 function showSources(key) {
  sourceContent.replaceChildren();
  if(key && sourceData[key]) {
   const s = sourceData[key], article=document.createElement('article');
   article.append(textNode('p',s.type,'source-type'),textNode('h3',s.title),textNode('p',s.note));
   const link=textNode('a','Open original source ↗');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';article.append(link);sourceContent.append(article);
  } else sourceContent.append($('#source-catalog').content.cloneNode(true));
  dialog.showModal();document.body.classList.add('modal-open');playVisibleVideos();
 }
 document.querySelectorAll('[data-source]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();showSources(b.dataset.source);}));
 $('#sources').addEventListener('click',()=>showSources());$('#footer-sources').addEventListener('click',()=>showSources());
 $('#close-dialog').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');playVisibleVideos();});
 dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
 $('#chapters').addEventListener('change',e=>{const target=document.getElementById(e.target.value);if(target)target.scrollIntoView({behavior:reduced.matches?'instant':'smooth'});});
 const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
 function playVisibleVideos() {
  videos.forEach(v=>{
   const owner=v.closest('section'), visible=owner===active;
   const permitted=v!==openingFilm||((effects||openingExplicitPlay)&&!openingEnded&&(openingRequested||opening.getBoundingClientRect().top < -30));
   if(!paused && !document.hidden && !dialog.open && visible && permitted){if(v.paused)v.play().catch(()=>{});}else if(!v.paused)v.pause();
  });
 }
 const observer=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){const candidate=e.target;if(candidate!==active){active=candidate;particles=[];if(['training','war','battle'].includes(active.dataset.theme))burnUntil=performance.now()+320;playVisibleVideos();startAnimation();}}});
 },{rootMargin:'-30% 0px -55% 0px',threshold:0});
 sections.forEach(s=>observer.observe(s));
 function updateScroll(){
  ticking=false;
  const y=window.scrollY,h=window.innerHeight;
  $('.reading-progress').style.transform=`scaleX(${clamp(y/(document.documentElement.scrollHeight-h))})`;
  const o=opening.getBoundingClientRect(),p=clamp(-o.top/(opening.offsetHeight-h));
  $('.opening-film-wrap').style.opacity='1';
  $('.opening-film-wrap').style.transform='none';
  if(active!==opening){const r=active.getBoundingClientRect(),progress=clamp(-r.top/Math.max(1,active.offsetHeight-h));
   const art=active.querySelector('.art');if(art&&effects&&innerWidth>640)art.style.transform=`scale(${1.025+progress*.035})`;
   if(active.classList.contains('conservation'))active.classList.toggle('color-release',progress>.18||innerWidth<=640);
  }
  const ar=active.getBoundingClientRect(),quiet=active.dataset.theme==='battle'&&-ar.top>active.offsetHeight*.3;
  active.classList.toggle('quiet',quiet);updateSound(active.dataset.theme,quiet);
  playVisibleVideos();
 }
 addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(updateScroll);}},{passive:true});
 addEventListener('resize',()=>{resizeCanvas();updateScroll();});
 document.addEventListener('visibilitychange',()=>{playVisibleVideos();if(!document.hidden)startAnimation();});
 function setPaused(value){paused=value;$('#pause-film').textContent=paused?'Play films':'Pause films';$('#pause-film').setAttribute('aria-pressed',String(paused));playVisibleVideos();}
 $('#pause-film').addEventListener('click',()=>setPaused(!paused));
 openingControl.addEventListener('click',()=>{
  if(!openingFilm.paused&&!openingEnded){setPaused(true);return;}
  if(openingEnded){openingFilm.currentTime=0;openingEnded=false;document.body.classList.remove('opening-ended');}
  openingRequested=true;openingExplicitPlay=true;document.body.classList.add('opening-explicit');setPaused(false);
 });
 openingFilm.addEventListener('play',()=>{openingRequested=true;openingControl.textContent='Pause opening';});
 openingFilm.addEventListener('pause',()=>{openingControl.textContent=openingEnded?'Replay opening':'Play opening · 0:30';});
 openingFilm.addEventListener('ended',()=>{openingEnded=true;openingControl.textContent='Replay opening';document.body.classList.add('opening-ended');});
 openingFilm.addEventListener('error',()=>{document.body.classList.add('opening-error');openingControl.textContent='Film unavailable';openingControl.disabled=true;});
 function setEffects(value){effects=value&&!reduced.matches;document.body.classList.toggle('effects-off',!effects);$('#effects').setAttribute('aria-pressed',String(effects));$('#effects span').textContent=effects?'on':'off';if(!effects){openingExplicitPlay=false;document.body.classList.remove('opening-explicit');particles=[];ctx.clearRect(0,0,width,height);}else startAnimation();updateScroll();}
 $('#effects').addEventListener('click',()=>setEffects(!effects));
 reduced.addEventListener('change',()=>{setEffects(!reduced.matches);if(reduced.matches){paused=true;$('#pause-film').textContent='Play films';$('#pause-film').setAttribute('aria-pressed','true');playVisibleVideos();}});
 const canvas=$('#atmosphere'),ctx=canvas.getContext('2d');let width=0,height=0,particles=[],raf=0,last=0,burnUntil=0;
 function resizeCanvas(){const dpr=Math.min(devicePixelRatio||1,1.5);width=innerWidth;height=innerHeight;canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);particles=[];}
 function makeParticle(theme){
  const mobile=width<=640, rain=theme==='river'||theme==='illness';
  const side=Math.random()>.5;
  return {x:mobile?(side?width*.92:width*.03):width*(.57+Math.random()*.42),y:Math.random()*height,life:Math.random(),speed:rain?7+Math.random()*8:.25+Math.random()*1.3,length:rain?10+Math.random()*22:2+Math.random()*9,size:Math.random()*1.4+.3};
 }
 function animate(now){
  raf=0;if(!effects||document.hidden)return;
  const delta=Math.min((now-last)/16.67||1,2);last=now;
  const theme=active.dataset.theme||'',r=active.getBoundingClientRect();
  const casualties=theme==='battle' && -r.top>active.offsetHeight*.3;
  const allowed=['training','west','war','battle','river','illness'].includes(theme)&&!casualties;
  ctx.clearRect(0,0,width,height);
  if(!allowed&&now>=burnUntil){particles=[];updateSound(theme,casualties);return;}
  if(allowed){const rain=theme==='river'||theme==='illness';const max=width<=640?18:rain?45:theme==='battle'||theme==='war'?50:22;
   while(particles.length<max)particles.push(makeParticle(theme));if(particles.length>max)particles.length=max;
   particles.forEach(p=>{p.y+=(rain?p.speed:-p.speed)*delta;p.x+=(rain?-1.9:.35)*delta;p.life+=.005*delta;
    if(p.y<-20||p.y>height+30||p.x>width||p.x<0||(width>640&&p.x<width*.55)||p.life>1)Object.assign(p,makeParticle(theme),{y:rain?-25:height+10,life:0});
    const alpha=Math.sin(p.life*Math.PI)*(rain?.18:.5);ctx.strokeStyle=rain?`rgba(151,181,167,${alpha})`:`rgba(235,165,77,${alpha})`;ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=p.size;
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+(rain?-3:-p.length*.45),p.y+(rain?p.length:p.length));ctx.stroke();
   });
  }else particles=[];
  if(now<burnUntil&&!casualties){const a=(burnUntil-now)/320,gradient=ctx.createLinearGradient(width*.7,0,width,0);gradient.addColorStop(0,'transparent');gradient.addColorStop(.75,`rgba(192,72,16,${a*.13})`);gradient.addColorStop(1,`rgba(249,163,62,${a*.55})`);ctx.fillStyle=gradient;ctx.fillRect(width*.7,0,width*.3,height);}
  updateSound(theme,casualties);raf=requestAnimationFrame(animate);
 }
 function startAnimation(){if(!raf&&effects&&!document.hidden){last=performance.now();raf=requestAnimationFrame(animate);}}
 let audioContext,master,windGain,toneGain,soundOn=false;
 function initAudio(){
  audioContext=new (window.AudioContext||window.webkitAudioContext)();master=audioContext.createGain();master.gain.value=0;master.connect(audioContext.destination);
  const noise=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate),arr=noise.getChannelData(0);for(let i=0;i<arr.length;i++)arr[i]=Math.random()*2-1;
  const source=audioContext.createBufferSource();source.buffer=noise;source.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=300;
  windGain=audioContext.createGain();windGain.gain.value=.06;source.connect(filter);filter.connect(windGain);windGain.connect(master);source.start();
  const tone=audioContext.createOscillator();tone.type='sine';tone.frequency.value=55;toneGain=audioContext.createGain();toneGain.gain.value=.008;tone.connect(toneGain);toneGain.connect(master);tone.start();
 }
 function updateSound(theme,quiet){if(!audioContext)return;const now=audioContext.currentTime;master.gain.setTargetAtTime(soundOn&&theme!=='opening'&&!quiet&&!document.hidden&&!dialog.open?.6:0,now,.9);windGain.gain.setTargetAtTime(theme==='river'||theme==='illness'?.095:.04,now,1.5);}
 $('#sound').addEventListener('click',async()=>{try{if(!audioContext)initAudio();await audioContext.resume();soundOn=!soundOn;openingFilm.muted=!soundOn;$('#sound').setAttribute('aria-pressed',String(soundOn));$('#sound span').textContent=soundOn?'on':'off';updateSound(active.dataset.theme,false);playVisibleVideos();}catch{$('#sound span').textContent='unavailable';}});
 document.addEventListener('visibilitychange',()=>updateSound(active.dataset.theme,false));
 resizeCanvas();setEffects(effects);if(paused){$('#pause-film').textContent='Play films';$('#pause-film').setAttribute('aria-pressed','true');}updateScroll();
})();
