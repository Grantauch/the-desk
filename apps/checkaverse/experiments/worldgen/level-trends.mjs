// Read-only level progression comparison for the actual Checkaverse founders.
// Not a proposed stat rebalance. No school, database, network or server imports.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCurrentContent, auditCrossPolicies } from "./balance-lab.mjs";

export const MILESTONE_LEVELS=Object.freeze([1,10,15,20,30,50]);
const rounded=n=>Number(n.toFixed(4));

export function levelTrendReport(rules, options = {}) {
  const levels=options.levels || MILESTONE_LEVELS;
  for(const lv of levels)if(!Number.isInteger(lv)||lv<1||lv>50)throw new RangeError("Level outside 1..50");
  const matrix=auditCrossPolicies(rules,{...options,levels});
  const typeOf=id=>rules.species.species[id].type;
  const groups=new Map();
  for(const row of matrix.outcomes){
    const k=row.species_a+"/"+row.species_b+"@"+row.level;
    if(!groups.has(k))groups.set(k,[]);
    groups.get(k).push(row);
  }
  const results=[...groups.values()].map(rows=>{
    const first=rows[0],a=first.species_a,b=first.species_b;
    const ta=typeOf(a),tb=typeOf(b);
    const advantage=rules.types.types[ta].beats.includes(tb)?"A":rules.types.types[tb].beats.includes(ta)?"B":"neutral";
    return {
      species_a:a,species_b:b,level:first.level,type_advantage:advantage,
      policy_pairs:rows.length,samples:rows.reduce((s,r)=>s+r.samples,0),
      mean_a_win_share:rounded(rows.reduce((s,r)=>s+r.a_win_share,0)/rows.length),
      most_favorable_policy_share:Math.max(...rows.map(r=>r.a_win_share)),
      least_favorable_policy_share:Math.min(...rows.map(r=>r.a_win_share)),
      mean_turns:rounded(rows.reduce((s,r)=>s+r.mean_turns,0)/rows.length),
      mean_limit_rate:rounded(rows.reduce((s,r)=>s+r.limit_rate,0)/rows.length)
    };
  });
  return {experiment:"cross-policy-level-v1",seeded_trials_per_seat:matrix.seeds_per_seat,
    policy_pairs:matrix.policies.length**2,levels:matrix.levels,roster:matrix.roster,
    interpretation:"Synthetic policy diagnostics only, no human win-rate inference",
    outcomes:results};
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const {rules}=loadCurrentContent();
  process.stdout.write(JSON.stringify(levelTrendReport(rules,{seeds:12}),null,2)+"\n");
}
