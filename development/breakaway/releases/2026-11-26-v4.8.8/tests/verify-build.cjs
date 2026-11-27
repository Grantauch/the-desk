#!/usr/bin/env node
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),old=fs.readFileSync(path.join(root,'source/baseline-v4.8.7.html'),'utf8');
assert.equal(crypto.createHash('sha256').update(html).digest('hex'),'1f9bcc89d94f96b1265ff0678272c9c33e354564f09c20e29b96bdf6cea2a9a9');
const core=s=>s.split('<script>')[1].split('// Canvas field view, independent of physics and DOM controls.')[0];
assert.equal(core(html),core(old),'Football engine changed');
for(const q of ['kitGradient(kind,s,layer=',"const airborne=kind==='runner'&&(o.air||0)>0;",'const planted=grounded||(!pose.hurdle'])assert(html.includes(q),'Missing '+q);
assert(!/<script[^>]+src\s*=/i.test(html),'External dependency');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);
console.log('PASS V4.8.8 hash, syntax, physics identity and material/gait changes');
