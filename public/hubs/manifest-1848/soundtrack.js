/* Manifest soundtrack: all audio stays local; victory music is gated by finish(true). */
window.TrailSound = (() => {
  const tracks = {main:'copper-and-talon',camp:'copper-sky',victory:'west-of-the-divide'};
  let enabled=true, unlocked=false, screen='title', current='', loop='', wantedLoop='', victory=false;
  const music = new Audio();
  music.preload='none';
  function safe(fn){ try { return fn(); } catch { return undefined; } }
  function play(){
    if(!enabled || !unlocked || document.hidden) return;
    safe(()=>window.ManifestAudio.setMuted(false));
    if(current) music.play().catch(()=>{});
    if(wantedLoop && loop!==wantedLoop){ safe(()=>window.ManifestAudio.startLoop(wantedLoop)); loop=wantedLoop; }
  }
  function stopLoops(){safe(()=>window.ManifestAudio.stopAllLoops()); loop='';}
  function track(key){
    if(current===key) return;
    music.pause(); current=key;
    if(key){music.src='audio/'+tracks[key]+'.m4a'; music.loop=key!=='victory';}
    else {music.removeAttribute('src'); music.load();}
  }
  function apply(){
    stopLoops();
    wantedLoop=screen==='camp'?'camp':screen==='fort'?'saloonTable':'';
    const key=screen==='end'?(victory?'victory':''):screen==='camp'?'camp':'main';
    track(key);
    music.volume=screen==='combat' || screen==='event' ? .20 : .36;
    play();
  }
  function setEnabled(value){
    enabled=Boolean(value);
    safe(()=>window.ManifestAudio.setVolume(.34));
    safe(()=>window.ManifestAudio.setMuted(!enabled || document.hidden));
    const button=document.getElementById('audioToggle');
    if(button){button.textContent=enabled?'Sound: On':'Sound: Off';button.setAttribute('aria-pressed',String(enabled));}
    if(!enabled){music.pause();stopLoops();safe(()=>window.ManifestAudio.suspend());} else play();
  }
  document.addEventListener('pointerdown',()=>{unlocked=true;play();}, {capture:true});
  document.addEventListener('keydown',()=>{unlocked=true;play();}, {capture:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){music.pause();stopLoops();safe(()=>window.ManifestAudio.setMuted(true));safe(()=>window.ManifestAudio.suspend());}
    else {safe(()=>window.ManifestAudio.setMuted(!enabled));play();}
  });
  window.addEventListener('pagehide',()=>{music.pause();stopLoops();safe(()=>window.ManifestAudio.suspend());});
  return {
    setEnabled,
    scene(id){screen=id;victory=false;apply();},
    finish(won){victory=won===true;screen='end';apply();},
    encounter(tags){if(screen!=='combat')return;stopLoops();wantedLoop=tags.includes('river')?'river':'';play();},
    effect(cue){if(enabled&&unlocked&&!document.hidden)safe(()=>window.ManifestAudio.play(cue));},
    deal(index){setTimeout(()=>{if(screen==='combat')this.effect('dealerDealSingle');},index*90);}
  };
})();
