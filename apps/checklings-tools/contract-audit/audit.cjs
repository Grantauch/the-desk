'use strict';
const fs = require('node:fs');
const path = require('node:path');

function parseAffinityUnion(ts) {
  const match = ts.match(/\bexport\s+type\s+Affinity\s*=\s*([^;]+);/);
  if (!match) throw Error('Cannot find exported Affinity union in contracts.ts');
  const tokens = match[1].trim().split('|').map(x=>x.trim());
  if(!tokens.length || tokens.some(token=>!/^'[a-z][a-z0-9_-]*'$/.test(token))) throw Error('Invalid canonical affinity union term');
  const names = tokens.map(token=>token.slice(1,-1));
  if (!names.length || new Set(names).size !== names.length) throw Error('Invalid or duplicate canonical affinity values');
  return names;
}
function checkCanonical(planText, typescriptText) {
  const plan = JSON.parse(planText);
  const affinities = parseAffinityUnion(typescriptText);
  if (!Array.isArray(plan.slice) || !Array.isArray(plan.ecosystems)) throw Error('Canonical plan needs slice and ecosystems arrays');
  const errors = [], seen = new Set();
  for (const species of plan.slice) {
    if (!species.id || seen.has(species.id)) errors.push('Duplicate or missing species ID: ' + species.id);
    seen.add(species.id);
    if (!affinities.includes(species.affinity)) errors.push(species.id + ': unknown canonical affinity ' + species.affinity);
    if (!plan.ecosystems.includes(species.ecosystem)) errors.push(species.id + ': unknown ecosystem ' + species.ecosystem);
  }
  return { affinities, speciesCount: plan.slice.length, species: Object.fromEntries(plan.slice.map(s => [s.id, { affinity:s.affinity,ecosystem:s.ecosystem }])), errors };
}
function readIds(cell) {
  const ids=[...cell.matchAll(/`([A-Z][A-Z0-9_]*)`/g)].map(m=>m[1]);
  const remaining=cell.replace(/`[A-Z][A-Z0-9_]*`/g,'').replace(/[,\\s]/g,'');
  if(remaining && !['-','—','–','none','None','N/A'].includes(remaining)) throw Error('Unrecognized battle matchup token: '+cell);
  return ids;
}
function checkBattleChart(markdown, canonical) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex(l => /^\|\s*Affinity ID\s*\|/.test(l));
  if (start < 0) throw Error('No Affinity ID table found');
  const groups = [], references=[], strong=new Map(), resisted=new Map();
  for (const line of lines.slice(start+2)) {
    if (!line.startsWith('|')) break;
    const cols = line.split('|').slice(1,-1).map(x=>x.trim());
    if (cols.length < 5) throw Error('Malformed affinity chart row: ' + line);
    const ids = readIds(cols[0]);
    if (ids.length !== 1) throw Error('Chart row must define one group ID: ' + line);
    groups.push(ids[0]);
    strong.set(ids[0],readIds(cols[3]));
    resisted.set(ids[0],readIds(cols[4]));
    for (const c of [cols[3],cols[4]]) for(const id of readIds(c)) references.push({group:ids[0],target:id});
  }
  if (!groups.length) throw Error('Empty affinity table');
  const declared = new Set(groups);
  const errors = [];
  if (declared.size !== groups.length) errors.push('Duplicate battle group ID');
  for(const ref of references) if(!declared.has(ref.target)) errors.push('Undefined battle group ' + ref.target + ' referenced by ' + ref.group);
  // The chart describes one directional matchup twice: A strong against B
  // must agree with B's 'Resisted By A'. Otherwise a single battle has two answers.
  for (const a of groups) {
    for (const b of strong.get(a)) {
      if (!declared.has(b)) continue; // already reported as undefined
      if (a===b) errors.push('Self-advantage '+a+' needs a move-specific exception, not a blanket affinity multiplier');
      if (!resisted.get(b).includes(a)) errors.push('Nonreciprocal matchup: '+a+' strong against '+b+' but '+b+' does not list '+a+' under Resisted By');
    }
    for (const b of resisted.get(a)) {
      if (!declared.has(b)) continue;
      if (!strong.get(b).includes(a)) errors.push('Nonreciprocal matchup: '+a+' resisted by '+b+' but '+b+' does not list '+a+' under Strong Against');
    }
  }
  const differs = groups.filter(g => !canonical.affinities.includes(g));
  const warnings = differs.length ? ['Proposed battle group IDs are NOT canonical Affinity values; require explicit accepted interface/mapping before use: ' + differs.join(', ')] : [];
  return { declaredGroups:groups, checkedReferences:references.length, errors:[...new Set(errors)],warnings };
}
function checkProposalSpecies(md, battle) {
  const hit = md.match(/\*\*Ecological Affinity\*\*:\s*`([A-Z][A-Z0-9_]*)`/);
  if (!hit && /\*\*Ecological Affinity\*\*\s*:/.test(md)) return {state:'invalid-group-label',errors:['Malformed Ecological Affinity label']};
  if (!hit) return {state:'not-specified',errors:[]};
  return {state:'proposed-ecological-group',group:hit[1],errors:battle.declaredGroups.includes(hit[1])?[]:['Undeclared proposed species group: '+hit[1]]};
}
function run(args) {
  if (args.length < 3) throw Error('Usage: node audit.cjs <species-plan.json> <contracts.ts> <battle-rules.md> [species-brief.md ...]');
  const read = p => fs.readFileSync(path.resolve(p),'utf8');
  const canonical = checkCanonical(read(args[0]),read(args[1]));
  const battle = checkBattleChart(read(args[2]),canonical);
  const speciesChecks = args.slice(3).map(file=>({file, ...checkProposalSpecies(read(file),battle)}));
  const result = {sourceTypeCount:canonical.affinities.length,canonicalSpeciesCount:canonical.speciesCount,canonicalErrors:canonical.errors,battle,speciesChecks};
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(canonical.errors.length || battle.errors.length || speciesChecks.some(s=>s.errors.length)) process.exitCode=1;
}
if(require.main===module){try{run(process.argv.slice(2))}catch(err){process.stderr.write('Audit error: '+err.message+'\n');process.exitCode=2;}}
module.exports = {parseAffinityUnion,checkCanonical,checkBattleChart,checkProposalSpecies};
