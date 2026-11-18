'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {entries,crc32}=require('./audit-bundle.cjs');
function zip(name, content, {unixType=0x8000,flags=0}={}){
 const fn=Buffer.from(name),data=Buffer.from(content),local=Buffer.alloc(30),c=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(flags,6);local.writeUInt32LE(crc32(data),14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(fn.length,26);
 c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(0x0314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(flags,8);c.writeUInt32LE(crc32(data),16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(fn.length,28);c.writeUInt32LE((unixType|0o644)*65536,38);
 const offset=30+fn.length+data.length;end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(46+fn.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([local,fn,data,c,fn,end]);
}
test('ZIP Unix character and block devices must never be accepted as ordinary source files',()=>{
 for(const type of [0x2000,0x6000])assert.throws(()=>entries(zip('docs/checklings/trick.md','x',{unixType:type})),/unsafe|type|file/i);
});
test('ZIP Unix FIFOs and sockets must never be accepted as ordinary source files',()=>{
 for(const type of [0x1000,0xc000])assert.throws(()=>entries(zip('docs/checklings/trick.md','x',{unixType:type})),/unsafe|type|file/i);
});
test('strong encryption general-purpose flag is unsupported, even without bit0',()=>{
 assert.throws(()=>entries(zip('docs/checklings/trick.md','x',{flags:0x40})),/unsafe|flags|encrypt/i);
});
test('Unix regular file with benign flag and valid CRC remains supported',()=>{
 assert.equal(entries(zip('docs/checklings/regular.md','ok')).get('docs/checklings/regular.md').toString(),'ok');
});
test('declared directory must not carry nonempty file content',()=>{
 assert.throws(()=>entries(zip('docs/checklings/','x',{unixType:0x4000})),/directory|unsafe|type|file/i);
});
