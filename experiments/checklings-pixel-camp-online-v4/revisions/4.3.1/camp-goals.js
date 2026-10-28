(function(root){
  'use strict';
  const IDS=['mochi','bolt','zee','ember'];
  const CARE=['feed','play','clean','rest','observe'];
  const DECOR=['planter','lantern','pennants'];
  function read(state){
    if(!state||!state.pets||IDS.some(id=>!state.pets[id]||typeof state.pets[id]!=='object'))throw TypeError('Camp goals need the four founders.');
    const order=IDS.includes(state.selected)?[state.selected,...IDS.filter(id=>id!==state.selected)]:IDS;
    const list=value=>Array.isArray(value)?value:[];
    let careDone=0,findDone=0,practiceDone=0;
    for(const id of IDS){const p=state.pets[id];careDone+=CARE.filter(action=>list(p.care).includes(action)).length;findDone+=[0,1,2].filter(stop=>list(p.discoveries).includes(stop)).length;if(Number.isInteger(p.battles)&&p.battles>0)practiceDone++;}
    const decorDone=DECOR.filter(id=>list(state.decor).includes(id)).length;
    const carePet=order.find(id=>CARE.some(action=>!list(state.pets[id].care).includes(action)));
    const findPet=order.find(id=>[0,1,2].some(stop=>!list(state.pets[id].discoveries).includes(stop)));
    const practicePet=order.find(id=>!(Number.isInteger(state.pets[id].battles)&&state.pets[id].battles>0));
    const nextDecor=DECOR.find(id=>!list(state.decor).includes(id));
    const tracks=[
      {id:'keeper',title:'Camp keeper',icon:'brush',done:careDone,total:20,next:carePet?{kind:'care',pet:carePet,action:CARE.find(action=>!list(state.pets[carePet].care).includes(action))}:null},
      {id:'explorer',title:'Trail finder',icon:'map',done:findDone,total:12,next:findPet?{kind:'trail',pet:findPet,stop:[0,1,2].find(stop=>!list(state.pets[findPet].discoveries).includes(stop))}:null},
      {id:'practice',title:'Practice pals',icon:'sword',done:practiceDone,total:4,next:practicePet?{kind:'practice',pet:practicePet}:null},
      {id:'decorator',title:'Make it home',icon:'planter',done:decorDone,total:3,next:nextDecor?{kind:'decor',id:nextDecor}:null}
    ];
    return{tracks,complete:tracks.every(t=>t.done===t.total),completedTracks:tracks.filter(t=>t.done===t.total).length,done:tracks.reduce((n,t)=>n+t.done,0),total:39};
  }
  const api={read};root.CampGoals=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
