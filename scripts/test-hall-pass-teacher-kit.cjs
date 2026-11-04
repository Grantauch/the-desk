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
assert.equal(version.selfInstalling,false,'Preview must not claim automatic schoolwide setup');
assert.equal(version.schoolwideDirectorySync,false,'Preview must not claim cross-teacher sync');
assert.equal(version.studentDataIncluded,false);
console.log('PASS: 14 offline teacher kit assertions: valid/invalid links, separate roles, preview and privacy state.');
