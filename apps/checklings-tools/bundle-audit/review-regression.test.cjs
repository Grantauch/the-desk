'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {crc32,entries,audit,safeName}=require('./audit-bundle.cjs');
function fixture(name='docs/checklings/test.md',text='hello') {
 const data=Buffer.from(text), fn=Buffer.from(name), local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 const hash=crc32(data);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt32LE(0,6);local.writeUInt16LE(0,8);local.writeUInt32LE(hash,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(fn.length,26);
 central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0,8);central.writeUInt16LE(0,10);central.writeUInt32LE(hash,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(fn.length,28);central.writeUInt32LE(0,42);
 const offset=local.length+fn.length+data.length,size=central.length+fn.length;
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([local,fn,data,central,fn,end]);
}
const M={schema:1,requiredPaths:['docs/checklings/test.md']};
test('reject contradictory local compression method',()=>{
 const z=fixture();z.writeUInt16LE(8,8);
 assert.throws(()=>entries(z),/mismatch/i);
});
test('reject contradictory encryption flag in local record',()=>{
 const z=fixture();z.writeUInt16LE(1,6);
 assert.throws(()=>entries(z),/mismatch/i);
});
test('reject contradictory local CRC when data descriptor flag is clear',()=>{
 const z=fixture();z.writeUInt32LE(0,14);
 assert.throws(()=>entries(z),/mismatch/i);
});
test('reserved school subtree is case insensitive',()=>{
 const z=fixture('Apps-Script/Hall-Pass/Code.gs');
 assert.ok(audit(z,{schema:1,requiredPaths:['Apps-Script/Hall-Pass/Code.gs']}).errors.some(s=>s.startsWith('RESERVED')));
});
test('ZIP paths cannot contain log-injection controls',()=>{
 assert.equal(safeName('docs/checklings/line\nbreak.md'),false);
 assert.throws(()=>entries(fixture('docs/checklings/line\nbreak.md')),/Unsafe/);
});
