// Provisional content validation. Never loads a student's account or modifies live files.
// Run: node --test apps/checkaverse/experiments/worldgen/bramblefen-wave2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import * as B from "../../battle.mjs";
import {loadCurrentContent, auditCrossPolicies} from "./balance-lab.mjs";
const file=path.join(path.dirname(fileURLToPath(import.meta.url)),"bramblefen-wave2.content.json");
const proposal=JSON.parse(fs.readFileSync(file,"utf8"));
const live=loadCurrentContent().rules;
const augmented=B.checkRules({
  types:structuredClone(live.types),
  moves:{...structuredClone(live.moves),...proposal.moves},
  species:{...structuredClone(live.species),species:{...structuredClone(live.species.species),...proposal.species}},
  settings:structuredClone(live.settings)
});
const protoIds=Object.keys(proposal.species);

test("candidate IDs, 12 signatures, exact slots and 6+6 regional types",()=>{
  assert.equal(protoIds.length,12);
  assert.equal(Object.keys(proposal.moves).length,12);
  assert.equal(new Set(proposal.slots.map(x=>x.slot)).size,12);
  assert.deepEqual(proposal.slots.map(x=>x.slot),Array.from({length:12},(_,i)=>"CK"+String(i+13).padStart(3,"0")));
  assert.deepEqual(Object.values(proposal.species).reduce((a,s)=>(a[s.type]=(a[s.type]??0)+1,a),{}),{meadow:6,tide:6});
  assert.equal(new Set(proposal.slots.map(x=>x.name.toLowerCase())).size,12);
  assert.ok(proposal.slots.every(x=>x.approved===false));
  assert.deepEqual(Object.keys(live.species.species).sort(),["bolt","ember","mochi","zee"]);
});

test("all candidate attacks use current supported engine fields and have one free move",()=>{
  for(const [id,entry] of Object.entries(proposal.species)){
    assert.deepEqual(entry.moves.slice(0,3),["strike","guard","recover"],id);
    assert.equal(entry.moves.length,4);
    const signature=proposal.moves[entry.moves[3]];
    assert.equal(signature.type,entry.type);
    assert.ok(signature.cost>=4&&signature.cost<=7);
    assert.ok((signature.damage??0)>0||signature.phases?.every(x=>x.damage>0));
    for(const key of Object.keys(signature))assert.ok(
      ["name","type","cost","damage","guard","restore","shield","first","bonus","phases","detail"].includes(key),
      id+" has an unsupported move key "+key
    );
  }
  assert.doesNotThrow(()=>B.checkRules(augmented));
});

test("all 12 candidates can battle every released founder and each other without violating limits",()=>{
  for(const a of protoIds){
    for(const b of [...Object.keys(live.species.species),...protoIds]){
      for(const level of [1,10,30]){
        const battle=B.createBattle(augmented,[{name:"Proposal A",species:a,level},{name:"Opponent",species:b,level}],19);
        let steps=0;
        while(!battle.over){
          const picks=[0,1].map(i=>{
            const moves=augmented.species.species[battle.sides[i].species].moves;
            return moves.find(m=>m!=="guard"&&m!=="recover"&&B.canUse(augmented,battle,i,m))
              ?? (B.canUse(augmented,battle,i,"strike")?"strike":"recover");
          });
          B.resolveTurn(augmented,battle,picks);
          steps++;
          assert.ok(steps<=augmented.settings.maxTurns,a+"/"+b+"/"+level);
        }
        assert.ok(["knockout","time"].includes(battle.reason));
      }
    }
  }
});

test("candidate stat proposals stay within deliberately narrow preproduction starting bounds",()=>{
  for(const [id,s] of Object.entries(proposal.species)){
    assert.ok(s.base.hp>=40&&s.base.hp<=58,id);
    assert.ok(s.base.power>=7&&s.base.power<=10,id);
    assert.ok(s.base.stamina>=8&&s.base.stamina<=11,id);
    assert.ok(s.base.speed>=4&&s.base.speed<=11,id);
    for(const growth of Object.values(s.growth))assert.ok(growth>=0&&Number.isFinite(growth));
  }
});

test("actual engine produces repeatable baseline comparisons without imported production content",()=>{
  const options={roster:["mochi","ember","reedawn","skidril","pollisk","mudhorn"],levels:[10],seeds:3,policies:["pressure","conserve","defend"]};
  const first=auditCrossPolicies(augmented,options);
  assert.equal(first.outcomes.length,21*9);
  assert.ok(first.outcomes.every(x=>x.samples===6));
  assert.deepEqual(first,auditCrossPolicies(augmented,options));
  assert.equal(Object.keys(live.species.species).length,4);
});
