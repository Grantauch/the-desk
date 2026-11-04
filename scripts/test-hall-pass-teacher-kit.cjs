#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const kit = path.join(root,'distribution','hall-pass-teacher-kit');
const html = fs.readFileSync(path.join(kit,'Start Here.html'),'utf8');
const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/i);
assert.ok(script,'Setup wizard must contain inline standalone script');
const handlers = {};
const elements = {};
['setup','url','error','results','kiosk','teacher','open-kiosk','open-teacher'].forEach(id => {
  elements[id] = {
    value:'',textContent:'',className:'',href:'',
    addEventListener(name,fn){handlers[id+':'+name]=fn}
  };
});
const context = {document:{getElementById(id){if(!elements[id])throw Error('Unexpected element: '+id);return elements[id]}},URL};
vm.runInNewContext(script[1],context,{timeout:1000,filename:'Start Here.html:script'});
const submit = handlers['setup:submit'];
assert.equal(typeof submit,'function','Setup form must be interactive');
const event = {preventDefault(){}};
elements.url.value='https://script.google.com/a/macros/testschool.example.org/s/synthetic-123/exec';
submit(event);
assert.equal(elements.results.className,'ready');
assert.equal(elements.kiosk.textContent,elements['open-kiosk'].href);
assert.equal(elements.teacher.textContent,elements['open-teacher'].href);
assert.equal(elements.kiosk.textContent,'https://script.google.com/a/macros/testschool.example.org/s/synthetic-123/exec?mode=kiosk');
assert.equal(elements.teacher.textContent,'https://script.google.com/a/macros/testschool.example.org/s/synthetic-123/exec?mode=teacher');
elements.url.value='https://malicious.example/s/123/exec';
submit(event);
assert.equal(elements.results.className,'');
assert.match(elements.error.textContent,/Google Apps Script/i);
elements.url.value='https://script.google.com/a/macros/testschool.example.org/s/synthetic-123/dev';
submit(event);
assert.equal(elements.results.className,'');
assert.match(elements.error.textContent,/exec/i);
const version = JSON.parse(fs.readFileSync(path.join(kit,'VERSION.json'),'utf8'));
assert.equal(version.selfInstalling,false,'Google consent and deployment are still required');
assert.equal(version.schoolwideDirectorySync,true,'Shared private directory is supported');
assert.equal(version.studentDataIncluded,false);
console.log('PASS: 14 offline teacher kit assertions: valid/invalid links, separate roles, Google setup requirements and privacy state.');

// Verify the exact downloadable archive, including every source byte and checksum.
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const archive = fs.readFileSync(path.join(root, 'public/downloads/HallPass-Teacher-Installer-v' + version.version + '.zip'));
const entries = new Map();
let offset = 0;
while (archive.readUInt32LE(offset) === 0x04034b50) {
  const method = archive.readUInt16LE(offset + 8), size = archive.readUInt32LE(offset + 18);
  const nameLength = archive.readUInt16LE(offset + 26), extraLength = archive.readUInt16LE(offset + 28);
  const name = archive.subarray(offset + 30, offset + 30 + nameLength).toString();
  assert.ok(!name.includes('..') && !name.startsWith('/'));
  const start = offset + 30 + nameLength + extraLength;
  const value = archive.subarray(start, start + size);
  entries.set(name, method === 8 ? zlib.inflateRawSync(value) : value);
  offset = start + size;
}
const sourcePaths = {
  'Code.gs':'apps-script/hall-pass/Code.gs', 'Index.html':'apps-script/hall-pass/Index.html',
  'ReleaseChecks.gs':'apps-script/hall-pass/ReleaseChecks.gs', 'ReleaseCheck.html':'apps-script/hall-pass/ReleaseCheck.html',
  'appsscript.json':'apps-script/hall-pass/appsscript.json', 'Setup.gs':'apps-script/hall-pass-template/Setup.gs',
  'SetupWizard.html':'apps-script/hall-pass-template/SetupWizard.html',
};
for (const [name, relative] of Object.entries(sourcePaths)) assert.deepEqual(entries.get('source/' + name), fs.readFileSync(path.join(root,relative)), 'Published ZIP source matches ' + name);
for (const name of ['Start Here.html','README.md','Recovery.md','School-IT-Checklist.md','VERSION.json']) assert.deepEqual(entries.get(name),fs.readFileSync(path.join(kit,name)));
for (const line of entries.get('MANIFEST.sha256').toString().trim().split('\n')) {
 const [hash,name] = line.split('  '); assert.equal(crypto.createHash('sha256').update(entries.get(name)).digest('hex'), hash);
}
assert.equal(entries.size,13, 'Only the twelve allowed files plus checksum manifest ship');
console.log('PASS: exact published ZIP source bytes, safe filenames, approved file set and SHA-256 checksums.');
