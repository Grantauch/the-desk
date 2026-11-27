#!/usr/bin/env node
// Run: node tests/verify-build.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const entry=fs.readFileSync(path.join(root,'index.html'),'utf8');
const baseline=fs.readFileSync(path.join(root,'source','baseline-v4.8.5.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'BUILD_MANIFEST.json'),'utf8'));
const sha=crypto.createHash('sha256').update(entry).digest('hex');
assert.equal(sha,manifest.html_sha256,'Latest HTML checksum differs from frozen build; create a new release instead.');
const core=s=>{const parts=s.split('const CONFIG=Object.freeze(');assert.equal(parts.length,2,'CONFIG marker');return parts[1].split('class FieldRenderer{')[0]};
assert.equal(core(entry),core(baseline),'V4.8.6 must not modify football engine physics');
const matches=[...entry.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert.ok(matches.length>0,'Missing game script');
for(const m of matches)new vm.Script(m[1]);
assert.ok(entry.includes('footfallPhase(kind,o,speed,offset)'),'Missing distance-based gait');
assert.ok(!entry.includes('const cycle=this.motionClock*(6.3+Math.min(speed,19)*.78)+offset;'),'Old speed-based gait reintroduced');
assert.ok(entry.includes('this.gaitTracks=new Map()'),'Missing independent athlete gait tracking');
assert.ok(entry.includes('const swing=footShift*side*(lift<.05?.42:1);'),'Planted-cleat stance hold missing');
assert.ok(!/<script[^>]+src\s*=/i.test(entry),'External script dependency introduced');
console.log('PASS: pinned SHA-256, identical football engine, inline JS syntax, gait invariants, no external script');
