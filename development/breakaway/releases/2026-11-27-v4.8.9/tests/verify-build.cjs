#!/usr/bin/env node
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),
 baseline=fs.readFileSync(path.join(root,'source/baseline-v4.8.8.html'),'utf8');
const edits=JSON.parse(fs.readFileSync(path.join(root,'source/changes.json'),'utf8')),
 manifest=JSON.parse(fs.readFileSync(path.join(root,'BUILD_MANIFEST.json'),'utf8'));
let expected=baseline;for(const e of edits){const p=expected.indexOf(e.from);assert(p>=0&&expected.indexOf(e.from,p+1)<0,'recipe '+e.name);expected=expected.slice(0,p)+e.to+expected.slice(p+e.from.length);}
assert.equal(html,expected,'Reconstruction differs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(hash(html),manifest.sha256,'SHA256 mismatch');
assert.equal(hash(baseline),manifest.base_sha256,'Base SHA256 mismatch');
const core=s=>s.split('<script>')[1].split('// Canvas field view, independent of physics and DOM controls.')[0];
assert.equal(core(html),core(baseline),'Football engine changed');
assert(!/<script[^>]+src\s*=/i.test(html),'External JavaScript dependency');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);
for(const s of ['cameraTarget(game)','blendRecordedFrames(a,b,t)','REPLAY_PLAYBACK_MAX=60','STILL FRAME'])assert(html.includes(s),'Missing '+s);
console.log('PASS V4.8.9 reconstructed source, hashes, JS syntax, offline source and football-engine parity');
