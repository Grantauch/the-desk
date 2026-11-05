#!/usr/bin/env node
'use strict';
// Local synthetic checks only. Never contact Google or a student service.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const kit = path.join(root,'distribution','hall-pass-teacher-kit');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(),'hall-pass-kit-test-'));
const python = process.env.CODEX_PRIMARY_RUNTIME_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
function run(args, status=0) { const r=spawnSync(python,args,{cwd:root,encoding:'utf8'}); assert.equal(r.status,status,r.stderr || r.stdout); return r; }
const version = JSON.parse(fs.readFileSync(path.join(kit,'VERSION.json'),'utf8'));
assert.equal(version.selfInstalling,false);
assert.equal(version.schoolwideDirectorySync,true);
assert.equal(version.studentDataIncluded,false);
assert.equal(version.distributionApproved,false);
assert.equal(version.productionCutoverAuthorized,false);
assert.equal(version.automaticSoftwareUpdates,false,'Unmet update requirement is explicit');
const html = fs.readFileSync(path.join(kit,'Start Here.html'),'utf8');
const handlers = {}, elements = {};
for (const id of ['setup','template-setup','template-url','template-error','copy-template','url','error','results','kiosk','teacher','open-kiosk','open-teacher','open-releasecheck','save-shortcut']) {
  elements[id] = {value:'',textContent:'',className:'',href:'',hidden:true,
    removeAttribute(name){delete this[name]},addEventListener(name,fn){handlers[id+':'+name]=fn}};
}
const revoked=[];
class FakeURL extends URL { static createObjectURL(){return 'blob:synthetic-shortcut'} static revokeObjectURL(url){revoked.push(url)} }
const context={document:{getElementById(id){assert.ok(elements[id],id);return elements[id]}},URL:FakeURL,Blob,window:{addEventListener(){}}};
vm.runInNewContext(html.match(/<script>\s*([\s\S]*?)\s*<\/script>/i)[1],context,{timeout:1000});
const event = {preventDefault(){}};
const submit=handlers['setup:submit'];
const deployment='https://script.google.com/a/macros/testschool.example.org/s/AKfycbSyntheticTeacherDeployment00000/exec';
for (const good of [deployment, 'https://script.google.com/macros/s/AKfycbSyntheticTeacherDeployment00000/exec?mode=teacher#old']) {
 elements.url.value=good; submit(event);
 assert.equal(elements.results.className,'ready');
 assert.equal(elements.kiosk.textContent,elements['open-kiosk'].href);
 assert.match(elements.kiosk.textContent,/\/exec\?mode=kiosk$/);
 assert.match(elements.teacher.textContent,/\/exec\?mode=teacher$/);
 assert.match(elements['open-releasecheck'].href,/\/exec\?mode=releasecheck$/);
 assert.equal(elements['save-shortcut'].download,'HallPass-Kiosk.html');
}
for (const bad of ['https://malicious.example/s/123/exec', deployment.replace('/exec','/dev'),deployment.replace('https:','http:'),deployment.replace('script.google.com','script.google.com.evil.example'),deployment.replace('script.google.com','script.google.com:444'),deployment.replace('/s/','/wrong/'),deployment.replace('https://','https://user:password@')]) {
 elements.url.value=bad;submit(event);
 assert.equal(elements.results.className,'');assert.match(elements.error.textContent,/Google Apps Script/i);
 assert.equal(elements['open-kiosk'].href,undefined,'No stale previously valid link after error');
 assert.equal(elements.kiosk.textContent,'');
}
const template='https://docs.google.com/spreadsheets/d/syntheticBlankTemplate000000000000/edit#gid=0';
elements['template-url'].value=template;handlers['template-setup:submit'](event);
assert.equal(elements['copy-template'].hidden,false);
assert.equal(elements['copy-template'].href,template.replace('/edit#gid=0','/copy'));
elements['template-url'].value=template.replace('docs.google.com','phishing.example');handlers['template-setup:submit'](event);
assert.equal(elements['copy-template'].hidden,true);assert.equal(elements['copy-template'].href,undefined);
assert.ok(revoked.length,'Old shortcut URLs are revoked');
assert.ok(!html.includes('18rWtvX'),'No mutable default template binding');
console.log('PASS: browser setup role links, strict URL rejection, stale-link clearing, approved-template entry and portable shortcut.');

function unzip(bytes) {
 const entries = new Map(); let offset=0;
 while(bytes.readUInt32LE(offset)===0x04034b50){
  const method=bytes.readUInt16LE(offset+8), size=bytes.readUInt32LE(offset+18), n=bytes.readUInt16LE(offset+26), e=bytes.readUInt16LE(offset+28);
  const name=bytes.subarray(offset+30,offset+30+n).toString(); assert.ok(!name.includes('..')&&!name.startsWith('/')&&!entries.has(name));
  const start=offset+30+n+e, value=bytes.subarray(start,start+size);
  entries.set(name,method===8?zlib.inflateRawSync(value):value);offset=start+size;
 } return entries;
}
function selected(entries){return Array.from(entries,([name,data])=>({name:path.basename(name),webkitRelativePath:'extracted/'+name,size:data.length,
 text:async()=>data.toString('utf8'),arrayBuffer:async()=>Uint8Array.from(data).buffer}));}
async function main(){try {
 const archive=path.join(scratch,'candidate.zip');run(['scripts/build-hall-pass-teacher-kit.py','--output',archive]);
 const first=fs.readFileSync(archive);run(['scripts/build-hall-pass-teacher-kit.py','--output',archive]);assert.deepEqual(fs.readFileSync(archive),first,'Deterministic build');
 const refusal=run(['scripts/build-hall-pass-teacher-kit.py','--output',path.join(root,'public','candidate-must-not-exist.zip')],1);
 assert.match(refusal.stderr,/outside public/);assert.ok(!fs.existsSync(path.join(root,'public','candidate-must-not-exist.zip')));
 const entries=unzip(first);
 const sourcePaths={'Code.gs':'apps-script/hall-pass/Code.gs','Index.html':'apps-script/hall-pass/Index.html','ReleaseChecks.gs':'apps-script/hall-pass/ReleaseChecks.gs','ReleaseCheck.html':'apps-script/hall-pass/ReleaseCheck.html','appsscript.json':'apps-script/hall-pass/appsscript.json','Setup.gs':'apps-script/hall-pass-template/Setup.gs','SetupWizard.html':'apps-script/hall-pass-template/SetupWizard.html'};
 for(const [name,relative] of Object.entries(sourcePaths))assert.deepEqual(entries.get('source/'+name),fs.readFileSync(path.join(root,relative)));
 for(const name of fs.readdirSync(kit))assert.deepEqual(entries.get(name),fs.readFileSync(path.join(kit,name)));
 const preflight={crypto:crypto.webcrypto,TextEncoder};vm.runInNewContext(entries.get('preflight.js').toString(),preflight,{timeout:1000});
 const api=preflight.HallPassKit;
 const checked=await api.verifyFiles(selected(entries));assert.equal(checked.integrity,'PASS');assert.equal(checked.checkedFiles,17);
 // Run the actual Preflight UI handlers, including invalidating stale field results.
 const nodes={};
 function element(tag='div') {
  const el={tag,value:'',textContent:'',disabled:false,files:[],children:[],handlers:{},
   appendChild(child){this.children.push(child);if(tag==='select'&&this.children.length===1)this.value=child.value},
   addEventListener(name,fn){this.handlers[name]=fn},click(){}};
  Object.defineProperty(el,'id',{get(){return this._id},set(id){this._id=id;nodes[id]=this}});return el;
 }
 for(const id of ['cases','download','summary','folder','zip','check-result','zip-result']){const el=element();el.id=id;}
 const pageContext={HallPassKit:api,document:{getElementById(id){assert.ok(nodes[id],id);return nodes[id]},createElement:element},URL:FakeURL,Blob,setTimeout};
 const preflightHtml=entries.get('Preflight.html').toString();
 vm.runInNewContext(preflightHtml.match(/<script>\s*([\s\S]*?)\s*<\/script>/i)[1],pageContext,{timeout:1000});
 assert.equal(nodes.download.disabled,true);
 nodes.folder.files=selected(entries);await nodes.folder.handlers.change.call(nodes.folder);
 assert.equal(nodes.download.disabled,true,'Original ZIP fingerprint still required');
 nodes.zip.files=[{arrayBuffer:async()=>Uint8Array.from(first).buffer}];await nodes.zip.handlers.change.call(nodes.zip);
 assert.equal(nodes.download.disabled,false);
 nodes['case-clean_environment'].value='PASS';nodes['case-clean_environment'].handlers.change();
 assert.match(nodes.summary.textContent,/15 field checks/);
 await nodes.zip.handlers.change.call(nodes.zip);assert.equal(nodes['case-clean_environment'].value,'NOT_RUN','Changing artifact clears prior field evidence');
 nodes.folder.files=[];await nodes.folder.handlers.change.call(nodes.folder);
 assert.equal(nodes.download.disabled,true,'Invalid extraction cannot reuse previous valid integrity or ZIP');
 assert.match(nodes['check-result'].textContent,/FAILED/);
 for(const mutation of ['missing','changed','extra','duplicate','wrong-version','bad-manifest','wrong-source-manifest']) {
  const bad=new Map(entries);
  if(mutation==='missing')bad.delete('source/Code.gs');
  if(mutation==='changed')bad.set('source/Code.gs',Buffer.from('tampered'));
  if(mutation==='extra')bad.set('unexpected-private-data.txt',Buffer.from('SYNTHETIC'));
  if(mutation==='wrong-version')bad.set('VERSION.json',Buffer.from('{}'));
  if(mutation==='bad-manifest')bad.set('MANIFEST.sha256',Buffer.from('bad'));
  if(mutation==='wrong-source-manifest')bad.set('SOURCE-MANIFEST.json',Buffer.from('{}'));
  const files=selected(bad);if(mutation==='duplicate')files.push(files[0]);
  await assert.rejects(api.verifyFiles(files),/Package check failed/);
 }
 const zipHash=crypto.createHash('sha256').update(first).digest('hex');
 const empty=api.report(checked,{},zipHash);
 assert.ok(empty.results.every(row=>row.result==='NOT_RUN'));
 assert.equal(empty.distributionApproved,false);assert.equal(empty.productionCutoverAuthorized,false);
 assert.throws(()=>api.report(null,{},zipHash));assert.throws(()=>api.report(checked,{},''));
 const evidence=path.join(scratch,'evidence.json');fs.writeFileSync(evidence,JSON.stringify(empty));
 const output=JSON.parse(run([path.join(kit,'verify.py'),archive]).stdout);assert.equal(output.zipSha256,zipHash);
 assert.equal(JSON.parse(run([path.join(kit,'verify.py'),archive,'--evidence',evidence],2).stdout).fieldEvidence,'INCOMPLETE_OR_BLOCKED');
 const all=Object.fromEntries(api.cases.map(([id])=>[id,'PASS']));
 const report=api.report(checked,all,zipHash);fs.writeFileSync(evidence,JSON.stringify(report));
 const full=JSON.parse(run([path.join(kit,'verify.py'),archive,'--evidence',evidence]).stdout);
 assert.equal(full.fieldEvidence,'OPERATOR_REPORT_ALL_PASS');assert.equal(full.distributionApproved,false,'Operator report never approves release');
 report.zipSha256='0'.repeat(64);fs.writeFileSync(evidence,JSON.stringify(report));
 const mismatch=run([path.join(kit,'verify.py'),archive,'--evidence',evidence],1);assert.match(mismatch.stderr,/could not be verified/);
 console.log('PASS: deterministic private candidate, exact source bytes, browser tamper/missing/extra/duplicate rejection, evidence defaults, exact-ZIP binding and no approval escalation.');
 run(['-B','scripts/test-hall-pass-kit-preflight.py']);
 console.log('PASS: Python verifier rejects archive tampering, duplicate entries, path escape, altered evidence, duplicate cases and forged approval flags.');
} finally {fs.rmSync(scratch,{recursive:true,force:true})}}
main().catch(error=>{console.error(error);process.exitCode=1;});
