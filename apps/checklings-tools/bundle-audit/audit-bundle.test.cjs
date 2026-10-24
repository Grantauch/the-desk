'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {crc32,entries,audit,safeName}=require('./audit-bundle.cjs');
function fixture(pairs,method=8){
  const chunks=[],central=[];let offset=0;
  for(const [name,text] of pairs){
    const fn=Buffer.from(name),data=Buffer.from(text),compressed=method===8?zlib.deflateRawSync(data):data;
    const local=Buffer.alloc(30),c=Buffer.alloc(46),hash=crc32(data);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(method,8);local.writeUInt32LE(hash,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(fn.length,26);
    c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(method,10);c.writeUInt32LE(hash,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(fn.length,28);c.writeUInt32LE(offset,42);
    chunks.push(local,fn,compressed);central.push(c,fn);offset+=local.length+fn.length+compressed.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(pairs.length,8);end.writeUInt16LE(pairs.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,directory,end]);
}
const M={schema:1,requiredPaths:['docs/checklings/test.md']};
const F=()=>fixture([['docs/checklings/test.md','hello']]);
test('validated real ZIP central entries and content CRC',()=>{assert.equal(entries(F()).get('docs/checklings/test.md').toString(),'hello');assert.equal(audit(F(),M).pass,true);});
test('stored entries work as well as deflated',()=>assert.equal(audit(fixture([['docs/checklings/test.md','hello']],0),M).pass,true));
test('missing claimed file is a hard failure',()=>assert.deepEqual(audit(F(),{schema:1,requiredPaths:['missing.cjs']}).errors,['MISSING missing.cjs']));
test('hash comparison verifies bytes, not filenames',()=>{const hash=crypto.createHash('sha256').update('hello').digest('hex');assert.equal(audit(F(),{schema:1,requiredPaths:[{path:'docs/checklings/test.md',sha256:hash}]}).pass,true);assert.match(audit(F(),{schema:1,requiredPaths:[{path:'docs/checklings/test.md',sha256:'0'.repeat(64)}]}).errors[0],/HASH_MISMATCH/);});
test('rejects traversal, absolute paths, and alternate slash separators',()=>{for(const name of ['../escape.txt','a/../evil','/private','C:/private','a\\b']){assert.equal(safeName(name),false,name);assert.throws(()=>entries(fixture([[name,'no']])),/Unsafe/);}});
test('rejects duplicate normalized names',()=>assert.throws(()=>entries(fixture([['a.txt','1'],['a.txt','2']])),/duplicate/));
test('rejects corrupt CRC, tampered local header, truncated end',()=>{const a=F();a[50]^=0x1;assert.throws(()=>entries(a));const b=F();b.writeUInt32LE(0,0);assert.throws(()=>entries(b),/local/);assert.throws(()=>entries(F().subarray(0,50)),/end/);});
test('rejects impossible huge uncompressed entry',()=>{const b=F();const central=b.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));b.writeUInt32LE(40*1024*1024,central+24);assert.throws(()=>entries(b),/Oversize/);});
test('reserved school files are hard failures while extra files only warn',()=>{const b=fixture([['docs/checklings/test.md','hello'],['apps-script/hall-pass/Code.gs','bad'],['other.txt','fine']]);const r=audit(b,M);assert.ok(r.errors.some(e=>e.startsWith('RESERVED ')));assert.equal(r.extras.length,2);});
test('manifest entries must be unique safe normalized paths',()=>assert.throws(()=>audit(F(),{schema:1,requiredPaths:['docs/checklings/test.md','docs/checklings/test.md']}),/duplicate/));
test('no extraction, loading source or script execution required',()=>{const b=fixture([['docs/checklings/test.md','require("node:fs").writeFileSync("/tmp/bad", "x")']]);assert.equal(audit(b,M).pass,true);});
