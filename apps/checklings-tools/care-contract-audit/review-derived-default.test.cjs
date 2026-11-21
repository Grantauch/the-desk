'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {proposalCare,auditCare}=require('./audit.cjs');
const ts='interface Creature {care:{nutrition:number; happiness:number; energy:number; cleanliness:number; focus:number};friendship:number;} // All care numbers are 0-100';
const mig='const INITIAL_CARE = Object.freeze({nutrition:82,happiness:85,energy:84,cleanliness:88,focus:78});';
const rows=['nutrition','happiness','energy','cleanliness','focus'].map(f=>'| `'+f+'` | `INT (0..100)` | `82` |');
const make=def=>'## 1. Core Care\n'+[...rows,'| `development_stage` | `INT (0..4)` | '+def+' |'].join('\n')+'\n## 2. More';
test('actual official-streak-derived development stage is not a fabricated numeric missing default',()=>{
 const s=make('Preserved from founder streak (`0..4`)');
 const out=auditCare(ts,mig,s);
 assert.deepEqual(out.errors,[]);
 assert.ok(out.warnings.some(w=>w.includes('PROPOSAL_DERIVED_DEFAULT development_stage')));
});
test('blank and unspecified-derived default still fail closed',()=>{
 for(const invalid of ['','TBD','Preserved someday']){
   const r=auditCare(ts,mig,make(invalid));
   assert.ok(r.errors.includes('PROPOSAL_DEFAULT_MISSING development_stage'),invalid);
 }
});
