const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const tests=fs.readdirSync(__dirname).filter(name=>name.endsWith('.cjs'));
const pkg=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../package.json'),'utf8')).scripts;

test('every ICEBREAK source regression is part of the standard npm test command',()=>{
 const unit=tests.filter(name=>name!=='fixture.cjs'&&!name.endsWith('-browser.cjs')&&name!=='browser.cjs');
 const missing=unit.filter(name=>!pkg['icebreak:test'].includes('tests/icebreak/'+name));
 assert.deepEqual(missing,[],'source tests omitted from npm run icebreak:test');
});

test('every ICEBREAK browser regression is part of the standard npm browser command',()=>{
 const browser=tests.filter(name=>name==='browser.cjs'||name.endsWith('-browser.cjs'));
 const missing=browser.filter(name=>!pkg['icebreak:browser'].includes('tests/icebreak/'+name));
 assert.deepEqual(missing,[],'browser scenarios omitted from npm run icebreak:browser');
});
