import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Accompanies audit-visual-assets.mjs: track interface code, not only binary art.
const run = args => execFileSync('git', args, { encoding:'utf8', maxBuffer: 128 * 1024 * 1024 });
const exit = args => spawnSync('git', args).status;
const root = 'refs/remotes/origin/main';
const mainSha = run(['rev-parse',root]).trim();
const visualSource = path => /^(?:public\/(?:hubs|storyhub|atlas|images)\/|src\/(?:pages|components|styles|data)\/|apps\/over-the-somme\/)/.test(path)
  && /\.(?:html|astro|css|js|mjs|cjs|ts|tsx|jsx)$/.test(path);
const priority = path => /(arsenal|over.the.top|over.the.somme|wwi|world.war|atlas|history|marne|trench)/i.test(path);
function tree(ref) {
  const files = new Map();
  for (const item of run(['ls-tree','-r','-l','-z',ref]).split('\0').filter(Boolean)) {
    const tab = item.indexOf('\t');
    if (tab < 0) continue;
    const [,type,sha,size] = item.slice(0,tab).split(/\s+/);
    const path = item.slice(tab+1);
    if (type === 'blob' && visualSource(path)) files.set(path,{sha,bytes:Number(size)||0});
  }
  return files;
}
const main = tree(root), bySha = new Set([...main.values()].map(x=>x.sha));
const branches = run(['for-each-ref','--format=%(refname:short)|%(objectname)','refs/remotes/origin/'])
  .split('\n').filter(Boolean).map(row=>{const [name,sha]=row.split('|');return {name,sha}})
  .filter(x=>x.name!=='origin/HEAD'&&x.name!=='origin/main');
const results=new Map();
for (const branch of branches) {
  if (exit(['merge-base','--is-ancestor',branch.sha,mainSha])===0) continue;
  if (Number(run(['rev-list','--count',root+'..'+branch.sha]).trim())===0) continue;
  for (const [path,blob] of tree(branch.sha)) {
    if (main.get(path)?.sha===blob.sha || bySha.has(blob.sha)) continue;
    const key=path+'|'+blob.sha;
    const record=results.get(key)||{path,gitBlobSha:blob.sha,mainPathSha:main.get(path)?.sha||null,bytes:blob.bytes,priority:priority(path),branches:[]};
    record.branches.push(branch.name);results.set(key,record);
  }
}
const records=[...results.values()].sort((a,b)=>Number(b.priority)-Number(a.priority)||b.branches.length-a.branches.length||a.path.localeCompare(b.path));
for(const r of records){
  try{r.contentSha256=createHash('sha256').update(execFileSync('git',['cat-file','blob',r.gitBlobSha],{maxBuffer:Math.max(r.bytes+1024,4*1024*1024)})).digest('hex')}
  catch(e){r.hashError=String(e.message)}
}
const output=join('reports','visual-assets');mkdirSync(output,{recursive:true});
writeFileSync(join(output,'visual-code-variants.json'),JSON.stringify({baseCommit:mainSha,branchCount:branches.length,records},null,2)+'\n');
const top=records.filter(x=>x.priority);
const text=['# Branch-exclusive visual interface code','',
  'These are *code variants* rather than missing binary artwork. Some are old and worse than main. Compare with current student pages before recovery.','',
  'Branch count: '+branches.length+'. Distinct code variants: '+records.length+'. Priority-themed: '+top.length+'.','',
  '| Path | Branch(es) | Git blob SHA | SHA-256 |','| --- | --- | --- | --- |',
  ...records.slice(0,110).map(x=>'| '+x.path+' | '+x.branches.slice(0,3).join(', ')+' | '+x.gitBlobSha.slice(0,12)+' | '+(x.contentSha256||'FAILED').slice(0,16)+' |'),
  '',
  'The complete review queue is in visual-code-variants.json; do not apply code automatically.'
].join('\n');
writeFileSync(join(output,'visual-code-triage.md'),text+'\n');
console.log('VISUAL_CODE_AUDIT branches='+branches.length+' variants='+records.length+' priority='+top.length);
for(const x of top.slice(0,30))console.log('CODE_CANDIDATE',x.path,x.branches.slice(0,2).join(','));
