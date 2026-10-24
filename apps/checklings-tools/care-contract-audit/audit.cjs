'use strict';
// Read-only cross-contract checker. Does not migrate or alter classroom/game records.
const fs=require('node:fs');
function sourceCareContract(ts) {
  const match=ts.match(/\bcare\s*:\s*\{([^{}]+)\}/);
  if(!match)throw Error('Creature care contract not found');
  const names=[...match[1].matchAll(/\b([a-z][a-zA-Z0-9_]*)\s*:\s*number\b/g)].map(m=>m[1]);
  if(!names.length||new Set(names).size!==names.length)throw Error('Invalid care field declarations');
  const range=ts.match(/All care numbers are\s*(\d+)\s*-\s*(\d+)/);
  if(!range)throw Error('Canonical care range comment not found; manual review required');
  return {names,minimum:Number(range[1]),maximum:Number(range[2]),friendship:/\bfriendship\s*:\s*number/.test(ts)};
}
function migrationDefaults(source) {
  const m=source.match(/\bconst\s+INITIAL_CARE\s*=\s*Object\.freeze\(\{([^}]+)\}\)/);
  if(!m)throw Error('Published migration defaults not found');
  const entries=[...m[1].matchAll(/\b([a-z][a-zA-Z0-9_]*)\s*:\s*(\d+)/g)].map(v=>[v[1],Number(v[2])]);
  if(!entries.length)throw Error('Missing migration defaults');
  return Object.fromEntries(entries);
}
function proposalCare(proposal) {
  const block=proposal.split('## 2.')[0];
  const meters=[];
  for(const line of block.split(/\r?\n/)) {
    const m=line.match(/^\|\s*`([^`]+)`\s*\|\s*`?INT\s*\((\-?\d+)\.\.(\+?\d+)\)/);
    if(m)meters.push({field:m[1],minimum:Number(m[2]),maximum:Number(m[3])});
  }
  if(!meters.length)throw Error('No proposed INT fields found in first care-state table');
  return meters;
}
function auditCare(ts,migration,proposal) {
  const contract=sourceCareContract(ts),defaults=migrationDefaults(migration),proposed=proposalCare(proposal);
  const errors=[],warnings=[];
  for(const field of contract.names) {
    if(!Object.hasOwn(defaults,field))errors.push('MIGRATION_MISSING '+field);
    else if(defaults[field]<contract.minimum||defaults[field]>contract.maximum)errors.push('MIGRATION_OUT_OF_RANGE '+field);
  }
  for(const key of Object.keys(defaults))if(!contract.names.includes(key))errors.push('MIGRATION_EXTRA '+key);
  const proposedNames=new Set(proposed.map(m=>m.field));
  for(const field of contract.names)if(!proposedNames.has(field))errors.push('PROPOSAL_MISSING_CANONICAL '+field);
  for(const m of proposed) {
    if(contract.names.includes(m.field) && (m.minimum!==contract.minimum || m.maximum!==contract.maximum))errors.push('PROPOSAL_SCALE_MISMATCH '+m.field);
    if(!contract.names.includes(m.field))warnings.push('PROPOSAL_NEW_OR_RENAMED_FIELD '+m.field+' needs an explicitly accepted mapping/migration');
  }
  if(/\bfriendship_bond\b/.test(proposal) && contract.friendship)warnings.push('PROPOSAL_RENAMES friendship to friendship_bond');
  if(/\bbody_condition_reserved\b/.test(proposal) && !/\bbody_condition_reserved\b/.test(ts))warnings.push('PROPOSAL_RESERVED_COLUMN is not in Creature schema v2');
  if(/\bt:\s*["']/.test(proposal) && !/\bsource\.t\b/.test(migration))warnings.push('PROPOSAL_LEGACY_T is not read by official migration planner');
  return {pass:errors.length===0,contract,defaults,proposed,errors,warnings};
}
if(require.main===module){
  try{
    if(process.argv.length!==5)throw Error('Usage: node audit.cjs contracts.ts migration.cjs care-interface.md');
    const files=process.argv.slice(2).map(f=>fs.readFileSync(f,'utf8'));
    const r=auditCare(...files);console.log(JSON.stringify(r,null,2));if(!r.pass)process.exitCode=1;
  }catch(err){console.error('AUDIT_ERROR '+err.message);process.exitCode=2;}
}
module.exports={sourceCareContract,migrationDefaults,proposalCare,auditCare};
