// Preproduction baseline only: combines current live battle JSON IN MEMORY with
// twelve UNAPPROVED wetland candidates and runs the actual battle engine.
// Never writes live content, accounts, wins, rewards, saved games or art.
// Usage: node apps/checkaverse/experiments/worldgen/bramblefen-audit.mjs [--full]
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import * as B from "../../battle.mjs";
import {auditCrossPolicies,loadCurrentContent} from "./balance-lab.mjs";

const HERE=path.dirname(fileURLToPath(import.meta.url));
export function proposalRules(){
  const current=loadCurrentContent().rules;
  const p=JSON.parse(fs.readFileSync(path.join(HERE,"bramblefen-wave2.content.json"),"utf8"));
  const rules=B.checkRules({
    types:structuredClone(current.types),
    moves:{...structuredClone(current.moves),...p.moves},
    species:{...structuredClone(current.species),species:{...structuredClone(current.species.species),...p.species}},
    settings:structuredClone(current.settings)
  });
  return {rules,p,founders:Object.keys(current.species.species),candidates:Object.keys(p.species)};
}

const average = a=>a.reduce((s,n)=>s+n,0)/Math.max(a.length,1);

export function summarizeAudit(source){
  const {rules,p,founders,candidates}=source;
  const roster=[...founders,...candidates];
  const levelSweep=auditCrossPolicies(rules,{roster,levels:[10,30],seeds:8});
  const grouped=new Map();
  for(const row of levelSweep.outcomes){
    const key=row.species_a+"/"+row.species_b+"@"+row.level;
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(row);
  }
  const rows=[];
  for(const [key,v] of grouped){
    const first=v[0];
    const {species_a:a,species_b:b,level}=first;
    const ta=rules.species.species[a].type, tb=rules.species.species[b].type;
    const aStrong=rules.types.types[ta].beats.includes(tb),bStrong=rules.types.types[tb].beats.includes(ta);
    const edge=aStrong?"A":bStrong?"B":"neutral";
    const n=average(v.map(x=>x.a_win_share));
    rows.push({a,b,level,edge,meanAWin:Number(n.toFixed(3)),
      mostA:Number(Math.max(...v.map(x=>x.a_win_share)).toFixed(3)),
      leastA:Number(Math.min(...v.map(x=>x.a_win_share)).toFixed(3)),
      avgTurns:Number(average(v.map(x=>x.mean_turns)).toFixed(2)),
      timeLimitRate:Number(average(v.map(x=>x.limit_rate)).toFixed(3)),
      samples:v.reduce((s,x)=>s+x.samples,0)});
  }
  // Competitive index: each candidate's win share across ALL founder duels,
  // not adjusted for type advantage. Good for flagging, not a balance grade.
  const vsFounders=candidates.map(id=>{
    const mine=rows.filter(r=>(r.a===id&&founders.includes(r.b))||(r.b===id&&founders.includes(r.a)));
    const wins=mine.map(r=>r.a===id?r.meanAWin:1-r.meanAWin);
    const neutral=mine.filter(r=>r.edge==="neutral");
    return {id,type:rules.species.species[id].type,
      vsFounderMean:Number(average(wins).toFixed(3)),
      minFounder:Number(Math.min(...wins).toFixed(3)),
      maxFounder:Number(Math.max(...wins).toFixed(3)),
      neutralOutliers:neutral.filter(r=>r.meanAWin<0.2||r.meanAWin>0.8).map(r=>({
        opponent:r.a===id?r.b:r.a,level:r.level,ownWin:Number((r.a===id?r.meanAWin:1-r.meanAWin).toFixed(3))
      }))
    };
  });
  const neutralAlerts=rows.filter(r=>r.a!==r.b&&r.edge==="neutral"&&
    (r.meanAWin<=0.2||r.meanAWin>=0.8)&& (candidates.includes(r.a)||candidates.includes(r.b)));
  const timeAlerts=rows.filter(r=>r.timeLimitRate>=0.25&&(candidates.includes(r.a)||candidates.includes(r.b)));
  return {labVersion:"bramblefen-candidate-v1",status:"unapproved concepts and simulated stats only",
    reference:"actual current Checkaverse battle.mjs with in-memory 12-species overlay",
    candidates:candidates.length,founders:founders.length,
    levels:[10,30],policies:3,randomSeedsPerPair:8,totalMatches:levelSweep.outcomes.length*16,
    comparisons:rows.length,candidateVsFounder:vsFounders,
    neutralFlagThreshold:"A-side share outside 20–80%, for manual inspection only",
    neutralAlerts,timeLimitAlerts:timeAlerts,
    rows
  };
}

const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
  const result=summarizeAudit(proposalRules());
  if(!process.argv.includes("--full"))delete result.rows;
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
}
