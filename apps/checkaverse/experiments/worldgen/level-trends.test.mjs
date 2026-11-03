import test from "node:test";
import assert from "node:assert/strict";
import { loadCurrentContent } from "./balance-lab.mjs";
import { MILESTONE_LEVELS, levelTrendReport } from "./level-trends.mjs";

const {rules}=loadCurrentContent();

test("six canonical milestone levels include both evolution thresholds",()=>{
  assert.deepEqual(MILESTONE_LEVELS,[1,10,15,20,30,50]);
});

test("level trend summary uses nine tactic pairs and mirrored seat samples",()=>{
  const opts={roster:["mochi","bolt"],levels:[10,30],policies:["pressure","conserve","defend"],seeds:3};
  const a=levelTrendReport(rules,opts);
  const b=levelTrendReport(rules,opts);
  assert.deepEqual(a,b);
  assert.equal(a.outcomes.length,6); // 3 unordered pairs at two levels
  for(const row of a.outcomes){
    assert.equal(row.policy_pairs,9);
    assert.equal(row.samples,54); // 9 policy pairings * 3 seeds * 2 seats
    assert.ok(row.mean_a_win_share>=0&&row.mean_a_win_share<=1);
    assert.ok(row.mean_turns>=1&&row.mean_turns<=40);
    assert.ok(["A","B","neutral"].includes(row.type_advantage));
  }
});

test("neutral same-species matched tactics are not counted as extra type strengths",()=>{
  const report=levelTrendReport(rules,{roster:["mochi"],levels:[1,10],seeds:3});
  assert.equal(report.outcomes.length,2);
  for(const row of report.outcomes){
    assert.equal(row.type_advantage,"neutral");
    assert.equal(row.mean_a_win_share,0.5);
  }
});

test("level trend refuses impossible levels and uses actual species types",()=>{
  assert.throws(()=>levelTrendReport(rules,{levels:[0]}),RangeError);
  assert.throws(()=>levelTrendReport(rules,{levels:[51]}),RangeError);
  const rows=levelTrendReport(rules,{roster:["mochi","bolt"],levels:[10],seeds:2}).outcomes;
  assert.equal(rows.find(x=>x.species_a==="mochi"&&x.species_b==="bolt").type_advantage,"A");
});
