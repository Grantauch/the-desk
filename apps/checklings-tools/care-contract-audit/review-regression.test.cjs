'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditCare}=require('./audit.cjs');
const canonical='interface Creature {care:{nutrition:number; happiness:number; energy:number; cleanliness:number; focus:number}; friendship:number} // All care numbers are 0-100';
const migration='const INITIAL_CARE=Object.freeze({nutrition:82,happiness:85,energy:84,cleanliness:88,focus:78})';
const rows=['nutrition','happiness','energy','cleanliness','focus'].map(k=>'| `'+k+'` | `INT (0..100)` | `82` |');
const proposal=lines=>'## 1. Core care\n'+lines.join('\n')+'\n## 2. Other';
test('reject out-of-range numeric proposal default',()=>{
 const bad=[...rows];bad[0]='| `nutrition` | `INT (0..100)` | `900` |';
 const result=auditCare(canonical,migration,proposal(bad));
 assert.equal(result.pass,false,'default 900 cannot pass field range 0-100');
 assert.ok(result.errors.includes('PROPOSAL_DEFAULT_OUT_OF_RANGE nutrition'));
});
test('reject duplicate care field rows',()=>{
 const result=auditCare(canonical,migration,proposal([...rows,rows[0]]));
 assert.equal(result.pass,false,'duplicate nutrition must not pass as a unique schema');
 assert.ok(result.errors.includes('PROPOSAL_DUPLICATE nutrition'));
});
test('reject duplicate migration defaults before Object.fromEntries overwrites them',()=>{
 const duplicated=migration.replace('focus:78','focus:78,nutrition:4');
 const result=auditCare(canonical,duplicated,proposal(rows));
 assert.equal(result.pass,false,'duplicate nutrition defaults must be detected');
 assert.ok(result.errors.includes('MIGRATION_DUPLICATE nutrition'));
});
