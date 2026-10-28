(function(root){
  'use strict';
  const IDS=['mochi','bolt','zee','ember'];
  const CARE=['feed','play','clean','rest','observe'];
  const DECOR_V1=['planter','lantern','pennants'];
  const DECOR_V2=['planter','lantern','pennants','shelf','campfire','chimes'];
  /* Options: full (version 2 features available) and today (YYYY-MM-DD for foraging). */
  function read(state,options={}){
    if(!state||!state.pets||IDS.some(id=>!state.pets[id]||typeof state.pets[id]!=='object'))throw TypeError('Camp goals need the four founders.');
    const full=options.full===true,E=root.FirstTrail;
    const order=IDS.includes(state.selected)?[state.selected,...IDS.filter(id=>id!==state.selected)]:IDS;
    const list=value=>Array.isArray(value)?value:[];
    const badges=id=>Number.isInteger(state.pets[id].battles)?Math.max(0,Math.min(full?3:1,state.pets[id].battles)):0;
    let careDone=0,findDone=0,practiceDone=0;
    for(const id of IDS){const p=state.pets[id];careDone+=CARE.filter(action=>list(p.care).includes(action)).length;findDone+=[0,1,2].filter(stop=>list(p.discoveries).includes(stop)).length;practiceDone+=badges(id);}
    const decorList=full?DECOR_V2:DECOR_V1;
    const decorDone=decorList.filter(id=>list(state.decor).includes(id)).length;
    const carePet=order.find(id=>CARE.some(action=>!list(state.pets[id].care).includes(action)));
    const findPet=order.find(id=>[0,1,2].some(stop=>!list(state.pets[id].discoveries).includes(stop)));
    const practiceMax=full?3:1;
    const practicePet=order.find(id=>badges(id)<practiceMax);
    const nextDecor=decorList.find(id=>!list(state.decor).includes(id));
    const tracks=[
      {id:'keeper',title:'Camp keeper',icon:'brush',done:careDone,total:20,next:carePet?{kind:'care',pet:carePet,action:CARE.find(action=>!list(state.pets[carePet].care).includes(action))}:null},
      {id:'explorer',title:'Trail finder',icon:'map',done:findDone,total:12,next:findPet?{kind:'trail',pet:findPet,stop:[0,1,2].find(stop=>!list(state.pets[findPet].discoveries).includes(stop))}:null},
      {id:'practice',title:full?'Stump ladder':'Practice pals',icon:'sword',done:practiceDone,total:4*practiceMax,next:practicePet?{kind:'practice',pet:practicePet,tier:badges(practicePet)+1}:null},
      {id:'decorator',title:'Make it home',icon:'planter',done:decorDone,total:decorList.length,next:nextDecor?{kind:'decor',id:nextDecor}:null}
    ];
    if(full&&E){
      const owned=list(state.curios).filter(id=>E.CURIOS.some(c=>c.id===id)).length,total=E.CURIOS.length;
      const openStop=[0,1,2].find(stop=>E.forageOpen(state,options.today,stop));
      tracks.push({id:'curator',title:'Curio shelf',icon:'shelf',done:owned,total,next:owned<total?{kind:'forage',stop:openStop===undefined?null:openStop}:null});
    }
    return{tracks,complete:tracks.every(t=>t.done===t.total),completedTracks:tracks.filter(t=>t.done===t.total).length,done:tracks.reduce((n,t)=>n+t.done,0),total:tracks.reduce((n,t)=>n+t.total,0)};
  }
  const api={read};root.CampGoals=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
