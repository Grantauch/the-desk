#!/usr/bin/env node
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..'),original=fs.readFileSync(path.join(__dirname,'baseline-v4.8.8.html'),'utf8');
const edits=JSON.parse(fs.readFileSync(path.join(__dirname,'changes.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(root,'BUILD_MANIFEST.json'),'utf8'));
let output=original;
for(const e of edits){
 const at=output.indexOf(e.from);
 assert(at>=0,'Missing source hunk: '+e.name);
 assert(output.indexOf(e.from,at+1)<0,'Nonunique source hunk: '+e.name);
 output=output.slice(0,at)+e.to+output.slice(at+e.from.length);
}
const sha=crypto.createHash('sha256').update(output).digest('hex');
assert.equal(sha,manifest.sha256,'Source recipe checksum mismatch');
const dest=process.argv[2]||path.join(__dirname,'reproduced-v4.8.9.html');
fs.writeFileSync(dest,output);
console.log('PASS exact V4.8.9',sha,'written',dest);
