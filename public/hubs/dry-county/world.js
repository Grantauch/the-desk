/* Mt. Morris prototype map. Road centerlines manually traced from the user's
   reference captures. Buildings and people are fictional period scenery. */
'use strict';
window.DryWorld=(()=>{
 const width=6000,height=3300,S=4,P=(x,y)=>({x:100+x*S,y:100+y*S});
 const roads=[];function road(name,w,points){roads.push({name,width:w,points:points.map(p=>P(...p))})}
 road('MT. MORRIS ROAD',96,[[0,362],[266,360],[518,358],[690,354],[972,345],[1435,324]]);
 road('SAGINAW STREET',82,[[517,0],[518,114],[518,211],[518,358],[522,440],[521,608],[519,755]]);
 road('DORT HIGHWAY',100,[[882,0],[916,62],[938,128],[961,245],[972,345],[974,510],[974,755]]);
 road('BRAY ROAD',76,[[1430,0],[1432,324],[1432,755]]);
 road('NORTH NEIGHBORHOOD',58,[[145,0],[145,127],[145,235],[266,235]]);
 road('WEST ROAD',64,[[23,0],[23,362],[23,755]]);
 road('NORTH CROSS STREET',58,[[145,127],[266,127],[266,114],[518,114],[630,113],[690,112],[806,113]]);
 road('WEST NEIGHBORHOOD',58,[[266,114],[266,175],[266,235],[270,360]]);
 road('NORTH RESIDENTIAL',54,[[295,175],[295,360]]);
 road('NORTH RESIDENTIAL',54,[[318,175],[318,360]]);
 road('NORTH RESIDENTIAL',54,[[341,175],[341,360]]);
 road('NORTH RESIDENTIAL',54,[[367,56],[367,114],[367,360]]);
 road('NORTH RESIDENTIAL',54,[[398,175],[398,360]]);
 road('NORTH RESIDENTIAL',54,[[434,0],[434,114],[434,264],[518,264]]);
 road('NORTH RESIDENTIAL',54,[[266,175],[518,175]]);
 road('NORTH RESIDENTIAL',54,[[266,211],[518,211]]);
 road('NORTH RESIDENTIAL',54,[[266,235],[518,235]]);
 road('NORTH RESIDENTIAL',54,[[266,289],[518,289]]);
 road('NORTH RESIDENTIAL',54,[[266,316],[518,316],[590,316]]);
 road('NORTH TERRACE',54,[[367,56],[518,56],[625,55],[694,54]]);
 road('NORTH TERRACE',54,[[518,22],[625,21],[694,18]]);
 road('NORTH TERRACE',54,[[518,78],[625,77],[694,76]]);
 road('NORTH TERRACE',54,[[518,99],[694,98],[694,18]]);
 road('NORTH TERRACE',54,[[625,0],[625,113]]);
 road('EAST RESIDENTIAL',54,[[630,113],[630,199],[655,199],[655,360]]);
 road('EAST RESIDENTIAL',54,[[518,139],[630,138]]);
 road('EAST RESIDENTIAL',54,[[518,163],[630,162]]);
 road('EAST RESIDENTIAL',54,[[518,187],[590,186],[590,238],[630,238]]);
 road('EAST RESIDENTIAL',54,[[518,236],[578,235],[578,219],[630,219]]);
 road('EAST RESIDENTIAL',54,[[518,279],[655,277]]);
 road('EAST RESIDENTIAL',54,[[518,305],[655,303],[710,302],[710,198],[808,197]]);
 road('EAST RESIDENTIAL',54,[[518,331],[655,329]]);
 road('SOUTH BLOCKS',58,[[273,440],[430,440],[522,440],[548,440],[575,470],[600,510],[600,560],[521,560]]);
 road('SOUTH BLOCKS',54,[[273,440],[273,537],[521,537]]);
 road('SOUTH BLOCKS',54,[[273,463],[522,463]]);
 road('SOUTH BLOCKS',54,[[273,486],[522,486],[576,486]]);
 road('SOUTH BLOCKS',54,[[273,512],[521,512],[600,512]]);
 for(const x of [299,323,348,373,398,435,467,491])road('SOUTH BLOCKS',52,[[x,440],[x,537]]);
 road('SOUTH BLOCKS',52,[[548,440],[548,560]]);
 road('SOUTH BLOCKS',52,[[576,486],[576,560]]);
 road('SOUTH YARDS',62,[[273,585],[519,585],[519,608],[600,608],[600,643],[662,643]]);
 road('SOUTH YARDS',54,[[273,585],[273,755]]);
 road('SOUTH YARDS',54,[[273,618],[519,618]]);
 road('SOUTH YARDS',54,[[273,642],[519,642],[554,642],[554,705],[600,705],[600,643]]);
 road('SOUTH YARDS',54,[[273,669],[519,669]]);
 road('SOUTH YARDS',54,[[273,694],[519,694]]);
 road('SOUTH YARDS',54,[[273,722],[519,722]]);
 for(const x of [323,373,435,467,491])road('SOUTH YARDS',52,[[x,585],[x,755]]);
 road('DORT CROSSING',60,[[972,80],[1049,79]]);
 road('EAST TERRACE',58,[[1075,111],[1075,196],[1074,287],[1074,357]]);
 road('EAST TERRACE',54,[[1075,139],[1177,137],[1177,110],[1177,78]]);
 road('EAST TERRACE',54,[[1075,165],[1177,163]]);
 road('EAST TERRACE',54,[[1075,195],[1177,194],[1177,110]]);
 road('EAST TERRACE',54,[[1102,111],[1102,279],[1127,305],[1177,306]]);
 road('EAST TERRACE',54,[[1131,111],[1131,279],[1177,279],[1177,194]]);
 road('EAST TERRACE',54,[[1154,111],[1154,279]]);
 road('EAST TERRACE',54,[[1074,357],[1075,454],[1110,490],[1160,506],[1205,528],[1252,539],[1275,526],[1265,505],[1214,498],[1177,479],[1127,477],[1127,432],[1177,431],[1177,346]]);
 road('EAST TERRACE',54,[[1106,349],[1106,432],[1127,454],[1215,455],[1252,474],[1252,510]]);
 road('EAST TERRACE',54,[[1127,455],[1127,477],[1153,506]]);
 road('EAST TERRACE',54,[[1215,344],[1215,455]]);
 road('EAST TERRACE',54,[[1252,342],[1252,474]]);
 road('EAST TERRACE',54,[[1210,37],[1280,36],[1280,78],[1215,80],[1210,37]]);
 road('EAST TERRACE',54,[[1215,57],[1280,56]]);
 // The rail line is scenery, not a road: its diagonal breaks up the town.
 const railway=[[319,114],[367,210],[434,318],[491,409],[548,490],[609,566],[651,655],[694,755]].map(p=>P(...p));
 const segments=[];for(const r of roads)for(let i=1;i<r.points.length;i++)segments.push({a:r.points[i-1],b:r.points[i],road:r,cuts:[0,1]});
 const cross=(a,b)=>a.x*b.y-a.y*b.x;
 const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
 function projection(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return{x:a.x+dx*t,y:a.y+dy*t,t,d:Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)}}
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const a=segments[i],b=segments[j],r=sub(a.b,a.a),s=sub(b.b,b.a),den=cross(r,s),q=sub(b.a,a.a);if(Math.abs(den)>1e-6){const t=cross(q,s)/den,u=cross(q,r)/den;if(t>=-.0001&&t<=1.0001&&u>=-.0001&&u<=1.0001){a.cuts.push(Math.max(0,Math.min(1,t)));b.cuts.push(Math.max(0,Math.min(1,u)))}}else{for(const p of [b.a,b.b]){const z=projection(p,a.a,a.b);if(z.d<.5)a.cuts.push(z.t)}for(const p of [a.a,a.b]){const z=projection(p,b.a,b.b);if(z.d<.5)b.cuts.push(z.t)}}}
 const nodes=[],edges=[],byKey=new Map();function node(p){const close=nodes.find(n=>Math.hypot(n.x-p.x,n.y-p.y)<2);if(close)return close.id;const key=Math.round(p.x*5)+','+Math.round(p.y*5);if(byKey.has(key))return byKey.get(key);const id=nodes.length;nodes.push({...p,id,links:[]});byKey.set(key,id);return id}
 for(const seg of segments){const ts=[...new Set(seg.cuts.map(v=>Math.round(v*1e5)/1e5))].sort((a,b)=>a-b);for(let i=1;i<ts.length;i++){const a={x:seg.a.x+(seg.b.x-seg.a.x)*ts[i-1],y:seg.a.y+(seg.b.y-seg.a.y)*ts[i-1]},b={x:seg.a.x+(seg.b.x-seg.a.x)*ts[i],y:seg.a.y+(seg.b.y-seg.a.y)*ts[i]};if(Math.hypot(a.x-b.x,a.y-b.y)<1)continue;const ai=node(a),bi=node(b),d=Math.hypot(a.x-b.x,a.y-b.y);nodes[ai].links.push({id:bi,d});nodes[bi].links.push({id:ai,d});edges.push({a:nodes[ai],b:nodes[bi],road:seg.road,d})}}
 const components=[];for(const n of nodes)n.component=-1;for(const start of nodes){if(start.component>=0)continue;const id=components.length,group=[],stack=[start];start.component=id;while(stack.length){const n=stack.pop();group.push(n);for(const edge of n.links){const other=nodes[edge.id];if(other.component<0){other.component=id;stack.push(other)}}}components.push(group)}
 function nearest(p){let best=null;for(const e of edges){const q=projection(p,e.a,e.b);if(!best||q.d<best.d)best={...q,edge:e,angle:Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x)}}return best}
 function route(a,b){const start=nearest(a),end=nearest(b);if(start.edge===end.edge)return[start,{x:end.x,y:end.y},{x:b.x,y:b.y}];const costs=new Map(),came=new Map(),open=new Set();for(const v of [start.edge.a,start.edge.b]){costs.set(v.id,Math.hypot(v.x-start.x,v.y-start.y));open.add(v.id)}const ends=[end.edge.a.id,end.edge.b.id];let goal=null;
 while(open.size){let id=-1,best=Infinity;for(const v of open){const score=costs.get(v)+Math.hypot(nodes[v].x-end.x,nodes[v].y-end.y);if(score<best){best=score;id=v}}if(ends.includes(id)){goal=id;break}open.delete(id);for(const link of nodes[id].links){const cost=costs.get(id)+link.d;if(cost<(costs.get(link.id)??Infinity)){costs.set(link.id,cost);came.set(link.id,id);open.add(link.id)}}}
 if(goal===null)return[{x:start.x,y:start.y}];const ids=[goal];while(came.has(ids[0]))ids.unshift(came.get(ids[0]));return[{x:start.x,y:start.y},...ids.map(id=>({x:nodes[id].x,y:nodes[id].y})),{x:end.x,y:end.y},{x:b.x,y:b.y}].filter((v,i,arr)=>i===0||Math.hypot(v.x-arr[i-1].x,v.y-arr[i-1].y)>3)
 }
 const zones=[{name:'DOWNTOWN MT. MORRIS',...P(520,360)},{name:'NORTH NEIGHBORHOODS',...P(420,170)},{name:'SOUTH YARDS',...P(430,650)},{name:'WEST WOODS',...P(120,500)},{name:'DORT CORRIDOR',...P(974,400)},{name:'EAST TERRACE',...P(1180,230)}];
 function district(x,y){return zones.reduce((a,b)=>Math.hypot(x-a.x,y-a.y)<Math.hypot(x-b.x,y-b.y)?a:b).name}
 const places=[
 {id:'garage',name:'BELL & SONS GARAGE',...P(480,358),icon:'G',color:'#8ebaa2',type:'garage'},
 {id:'still',name:'THE WOODLAND STILL',...P(23,555),icon:'B',color:'#c9a961',type:'still'},
 {id:'velvet',name:'THE VELVET ROOM',...P(600,355),icon:'V',color:'#c9a961',type:'club'},
 {id:'lucky',name:'LUCKY SEVEN',...P(972,345),icon:'7',color:'#c9a961',type:'club'},
 {id:'blue',name:'BLUE LANTERN',...P(435,669),icon:'L',color:'#c9a961',type:'club'},
 {id:'docks',name:'THE FREIGHT DEPOT',...P(548,486),icon:'D',color:'#c9a961',type:'club'},
 {id:'safe',name:'THE BACK ROOM',...P(299,486),icon:'S',color:'#8ebaa2',type:'safe'},
 {id:'phone',name:'DOWNTOWN PAYPHONE',...P(518,211),icon:'☎',color:'#c9a961',type:'phone'},
 {id:'grocer',name:"FINCH'S GROCERY",...P(398,358),icon:'F',color:'#b4bc83',type:'shop'},
 {id:'diner',name:"ROSE'S DINER",...P(548,358),icon:'R',color:'#dcb18b',type:'shop'},
 {id:'pharmacy',name:"WARD'S PHARMACY",...P(434,264),icon:'+',color:'#a5c5b6',type:'shop'},
 {id:'tailor',name:'BROOKS TAILORING',...P(367,114),icon:'T',color:'#bb9c7d',type:'shop'},
 {id:'pawn',name:"PRICE'S SECONDHAND",...P(491,585),icon:'P',color:'#c2a465',type:'shop'},
 {id:'dealer',name:'COLE MOTOR COMPANY',...P(630,305),icon:'A',color:'#c4ba94',type:'shop'},
 {id:'hardware',name:"BELL'S HARDWARE",...P(435,537),icon:'H',color:'#b2af83',type:'shop'},
 {id:'furniture',name:'ABBOTT HOME FURNISHINGS',...P(398,211),icon:'U',color:'#c7a78a',type:'shop'},
 {id:'home',name:'YOUR HOME LOT',...P(323,618),icon:'⌂',color:'#a8bd9a',type:'home'},
 {id:'barber',name:"LEO'S BARBERSHOP",...P(576,512),icon:'C',color:'#bda8a3',type:'shop'}];
 // Snap all objective locations to the actual hand-traced centerlines.
 for(const p of places){const q=nearest(p);p.x=q.x;p.y=q.y}
 // Speakeasies are reached through their ordinary shop fronts.
 for(const [club,front] of [['velvet','grocer'],['lucky','tailor'],['blue','barber']]){const c=places.find(p=>p.id===club),f=places.find(p=>p.id===front);c.x=f.x;c.y=f.y;c.hidden=true;c.front=front}
 const mainComponent=nearest(places[0]).edge.a.component,driveNodes=nodes.filter(n=>n.component===mainComponent),driveEdges=edges.filter(e=>e.a.component===mainComponent);
 return{width,height,P,roads,railway,segments,nodes,edges,nearest,route,district,zones,places,components,driveNodes,driveEdges};
})();
