#!/usr/bin/env node
// Run: node tests/verify-build.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..');
const entry=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const baseline=fs.readFileSync(path.join(dir,'source/baseline-v4.8.6.html'),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(entry),'81ed2080bbe91473c8c003f4a178fa4297e8bd057fd8459a7905739cfd4571ce');
const engine=s=>s.split('const CONFIG=Object.freeze(')[1].split('class FieldRenderer{')[0];
assert.equal(engine(entry),engine(baseline),'Football engine was modified');
assert.ok(entry.includes('visualChannel(kind,o,channel,target,rate=20,snap=false)'));
assert.ok(entry.includes('footfallPhase(kind,o,speed,offset)'));
assert.ok(!/<script[^>]+src\s*=/i.test(entry),'No external scripts expected');
for(const match of entry.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(match[1]);
console.log('PASS V4.8.7 integrity, engine unchanged, motion blending, offline JavaScript syntax');
