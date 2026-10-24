'use strict';
// Read-only ZIP delivery audit. Parses central directory, never extracts or executes files.
const fs = require('node:fs');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const path = require('node:path');
const MAX_ZIP = 64 * 1024 * 1024;
const MAX_ENTRY = 16 * 1024 * 1024;
const MAX_TOTAL = 64 * 1024 * 1024;
const MAX_COUNT = 2000;
function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function safeName(name) {
  return typeof name === 'string' && !!name.length && !name.includes('\\') && !name.includes('\u0000') &&
    !name.startsWith('/') && !/^[a-zA-Z]:/.test(name) &&
    name.split('/').every((part,i,a)=>part === '' ? i === a.length-1 : part !== '.' && part !== '..');
}
function entries(zip) {
  if (!Buffer.isBuffer(zip) || zip.length > MAX_ZIP) throw Error('ZIP must be a Buffer of at most 64 MiB');
  let end=-1;
  for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--) {
    if (zip.readUInt32LE(i)===0x06054b50 && i+22+zip.readUInt16LE(i+20)===zip.length){end=i;break;}
  }
  if(end<0) throw Error('Missing or malformed ZIP end-of-central-directory');
  if(zip.readUInt16LE(end+4)!==0 || zip.readUInt16LE(end+6)!==0) throw Error('Multi-disk ZIP unsupported');
  const n=zip.readUInt16LE(end+10), size=zip.readUInt32LE(end+12), offset=zip.readUInt32LE(end+16);
  if(n>MAX_COUNT || n!==zip.readUInt16LE(end+8) || offset+size>end) throw Error('Invalid ZIP central-directory bounds/count');
  const found=new Map(); let cursor=offset,total=0;
  for(let i=0;i<n;i++) {
    if(cursor+46>offset+size || zip.readUInt32LE(cursor)!==0x02014b50) throw Error('Invalid ZIP central record');
    const flags=zip.readUInt16LE(cursor+8), method=zip.readUInt16LE(cursor+10);
    const crc=zip.readUInt32LE(cursor+16), comp=zip.readUInt32LE(cursor+20), raw=zip.readUInt32LE(cursor+24);
    const nl=zip.readUInt16LE(cursor+28),el=zip.readUInt16LE(cursor+30),cl=zip.readUInt16LE(cursor+32);
    const disk=zip.readUInt16LE(cursor+34),mode=(zip.readUInt32LE(cursor+38)>>>16)&0xf000;
    const loc=zip.readUInt32LE(cursor+42);
    if(cursor+46+nl+el+cl>offset+size || disk!==0) throw Error('Out-of-bounds ZIP entry');
    const name=zip.subarray(cursor+46,cursor+46+nl).toString('utf8');
    cursor+=46+nl+el+cl;
    if(!safeName(name) || found.has(name)) throw Error('Unsafe or duplicate ZIP path: '+name);
    if(mode===0xa000 || (flags&1) || !(method===0||method===8)) throw Error('Unsafe ZIP file type/flags/method: '+name);
    if(raw>MAX_ENTRY || (total+=raw)>MAX_TOTAL || (comp===0 && raw>0) || (comp>0 && raw/comp>200)) throw Error('Oversize or suspicious ZIP entry: '+name);
    if(loc+30>zip.length || zip.readUInt32LE(loc)!==0x04034b50) throw Error('Missing local header: '+name);
    const lnl=zip.readUInt16LE(loc+26),lel=zip.readUInt16LE(loc+28);
    const localName=zip.subarray(loc+30,loc+30+lnl).toString('utf8');
    const pos=loc+30+lnl+lel;
    if(localName!==name || pos+comp>offset) throw Error('Invalid local ZIP record: '+name);
    const bytes=name.endsWith('/')?Buffer.alloc(0):method===0?zip.subarray(pos,pos+comp):zlib.inflateRawSync(zip.subarray(pos,pos+comp),{maxOutputLength:MAX_ENTRY});
    if(bytes.length!==raw || crc32(bytes)!==crc) throw Error('ZIP length/CRC mismatch: '+name);
    found.set(name,bytes);
  }
  if(cursor!==offset+size) throw Error('ZIP central-directory size mismatch');
  return found;
}
function audit(zip,manifest={}) {
  const found=entries(zip), errors=[],warnings=[];
  if(manifest.schema!==1 || !Array.isArray(manifest.requiredPaths)) throw Error('Manifest requires schema:1 and requiredPaths array');
  const seen=new Set();
  for(const item of manifest.requiredPaths) {
    const spec=typeof item==='string'?{path:item}:item;
    if(!spec || !safeName(spec.path) || spec.path.endsWith('/') || seen.has(spec.path)) throw Error('Invalid or duplicate manifest path');
    seen.add(spec.path);
    const bytes=found.get(spec.path);
    if(!bytes) errors.push('MISSING '+spec.path);
    else if(spec.sha256 && crypto.createHash('sha256').update(bytes).digest('hex')!==spec.sha256) errors.push('HASH_MISMATCH '+spec.path);
  }
  for(const name of found.keys()) if(name.startsWith('apps-script/hall-pass/') || name.startsWith('apps/checklings-service/') || name==='.env' || /(^|\/)\.env(\.|$)/.test(name)) errors.push('RESERVED '+name);
  const extra=[...found.keys()].filter(x=>!x.endsWith('/') && !seen.has(x));
  if(extra.length) warnings.push('Extra files not claimed: '+extra.length);
  return {pass:!errors.length,archiveEntries:found.size,required:seen.size,errors,warnings,extras:extra};
}
if(require.main===module) {
  try {
    if(process.argv.length!==4) throw Error('Usage: node audit-bundle.cjs bundle.zip required-paths.json');
    const result=audit(fs.readFileSync(path.resolve(process.argv[2])),JSON.parse(fs.readFileSync(path.resolve(process.argv[3]),'utf8')));
    console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
  }catch(error){console.error('AUDIT_ERROR '+error.message);process.exitCode=2;}
}
module.exports={crc32,safeName,entries,audit};
